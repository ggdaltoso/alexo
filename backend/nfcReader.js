/**
 * Leitor NFC — PN532 em I2C.
 *
 * Porte para Node do backend/scripts/pn532-i2c-probe.py, que é a implementação
 * de referência: se este módulo divergir do probe, o probe é quem está certo.
 *
 * Emite dois eventos, ambos com { uid, sak }:
 *   'tag-present'  tag entrou no campo (UID novo)
 *   'tag-vanish'   tag saiu do campo
 *
 * O UID vem normalizado em hex maiúsculo sem separadores ("693B9D29"), que é a
 * forma usada como chave em data/nfc-tags.json.
 *
 * Só lê UID. Não escreve em tag e não lê memória de tag -- decisão registrada em
 * docs/nfc-music-player-plan.md: o mapeamento UID->álbum mora no JSON e ponto,
 * porque gravar na tag criaria uma segunda cópia do mesmo fato.
 */
const EventEmitter = require('events');

const PN532_ADDRESS = 0x24;
const HOST_TO_PN532 = 0xd4;
const PN532_TO_HOST = 0xd5;
const ACK_FRAME = Buffer.from([0x00, 0x00, 0xff, 0x00, 0xff, 0x00]);

const CMD_GET_FIRMWARE_VERSION = 0x02;
const CMD_SAM_CONFIGURATION = 0x14;
const CMD_IN_LIST_PASSIVE_TARGET = 0x4a;

// /dev/i2c-3 é o barramento por software criado pelo overlay i2c-gpio em
// GPIO14/15. Não é o i2c-1 do hardware: o módulo está soldado direto nos pinos
// da UART e não dá pra mover. Ver o plano.
const BUS_NUMBER = Number(process.env.PN532_I2C_BUS || 3);

const POLL_INTERVAL_MS = 150;
const CMD_TIMEOUT_MS = 1000;
const IN_LIST_TIMEOUT_MS = 800;

// Quantas varreduras vazias seguidas antes de dar a tag por removida. Existe
// porque uma tag parada na antena erra uma leitura de vez em quando, e um
// 'tag-vanish' falso faria a música pausar e voltar sozinha. O custo é latência:
// cada varredura vazia gasta ~IN_LIST_TIMEOUT_MS, então 2 confirmações ≈ 1,6s
// entre tirar a tag e a música pausar. Medir no Pi antes de mexer neste número.
const VANISH_CONFIRMATIONS = 2;

const SAK_TYPES = {
  0x00: 'Mifare Ultralight / NTAG21x',
  0x08: 'Mifare Classic 1K',
  0x18: 'Mifare Classic 4K',
  0x20: 'ISO14443-4 (DESFire / cartão bancário)',
  0x28: 'Mifare Classic 1K + ISO14443-4',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Falha no nível do barramento, não do protocolo.
 *
 * O caso que importa é o EREMOTEIO (errno 121): ninguém deu ACK no endereço. Em
 * I2C o escravo confirma o próprio endereço por hardware, então esse erro é
 * prova de que não há nada vivo em 0x24.
 */
class BusError extends Error {}

/** Normal information frame: 00 00 FF LEN LCS TFI ...dados DCS 00 */
function buildFrame(data) {
  const length = data.length + 1; // +1 pelo TFI
  const lcs = (0x100 - length) & 0xff;
  let checksum = HOST_TO_PN532;
  for (const b of data) checksum = (checksum + b) & 0xff;
  const dcs = (0x100 - checksum) & 0xff;
  return Buffer.from([0x00, 0x00, 0xff, length, lcs, HOST_TO_PN532, ...data, dcs, 0x00]);
}

class Pn532I2C {
  constructor(bus, address) {
    this.bus = bus;
    this.address = address;
  }

  async write(buffer) {
    try {
      await this.bus.i2cWrite(this.address, buffer.length, buffer);
    } catch (err) {
      throw new BusError(`escrita falhou: ${err.message}`);
    }
  }

  /**
   * O PN532 em I2C prefixa toda leitura com um byte de status cujo bit0 indica
   * "pronto". Ele não faz clock stretching: quem espera é o host.
   */
  async read(count) {
    try {
      const { buffer } = await this.bus.i2cRead(this.address, count, Buffer.alloc(count));
      return buffer;
    } catch (err) {
      throw new BusError(`leitura falhou: ${err.message}`);
    }
  }

  async waitReady(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const status = await this.read(1);
        if (status.length && status[0] & 0x01) return true;
      } catch (err) {
        if (!(err instanceof BusError)) throw err;
        // NACK enquanto o chip processa é normal; tentar de novo
      }
      await sleep(10);
    }
    return false;
  }

  async readFrame(expectedLen, timeoutMs) {
    if (!(await this.waitReady(timeoutMs))) return null;
    let raw;
    try {
      raw = await this.read(expectedLen + 1); // +1 pelo byte de status
    } catch (err) {
      if (!(err instanceof BusError)) throw err;
      return null;
    }
    if (!raw.length || !(raw[0] & 0x01)) return null;
    return raw.slice(1);
  }

  /**
   * Cancela o comando pendente.
   *
   * O manual do PN532 define que o host manda um frame de ACK para abortar o
   * comando em curso. Sem isso, um InListPassiveTarget que expirou sem achar tag
   * continua rodando no chip, e o próximo comando chega em cima dele -- as
   * respostas saem trocadas e a detecção fica intermitente de um jeito que
   * parece problema elétrico.
   */
  async abort() {
    try {
      await this.write(ACK_FRAME);
    } catch (err) {
      if (!(err instanceof BusError)) throw err;
    }
  }

  /**
   * Envia um comando, confirma o ACK e devolve { payload, error, kind }.
   *
   * O `kind` importa e não é decoração. Num InListPassiveTarget, "o chip aceitou
   * o comando e não achou nada até expirar" é o caso NORMAL de um leitor ocioso,
   * não uma falha -- é o que acontece a cada varredura enquanto ninguém encosta
   * uma tag. Sem separar isso de uma falha de verdade, o loop acusaria problema
   * de barramento o tempo todo:
   *
   *   'timeout'   comando aceito, sem resposta no prazo (varredura vazia)
   *   'bus'       o módulo não respondeu no nível elétrico/I2C
   *   'protocol'  respondeu, mas com frame que não bate (dessincronizado)
   */
  async sendCommand(data, responseLen, timeoutMs = CMD_TIMEOUT_MS) {
    const fail = (kind, error) => ({ payload: null, error, kind });

    try {
      await this.write(buildFrame(data));
    } catch (err) {
      if (!(err instanceof BusError)) throw err;
      return fail('bus', err.message);
    }

    const ack = await this.readFrame(ACK_FRAME.length, timeoutMs);
    if (ack === null) return fail('bus', 'sem ACK (o módulo não respondeu)');
    if (!ack.equals(ACK_FRAME)) return fail('protocol', `ACK inválido: ${ack.toString('hex')}`);

    const frame = await this.readFrame(responseLen, timeoutMs);
    if (frame === null) {
      await this.abort();
      return fail('timeout', 'ACK recebido, mas nenhum frame de resposta');
    }

    if (frame[0] !== 0x00 || frame[1] !== 0x00 || frame[2] !== 0xff) {
      return fail('protocol', `preâmbulo inesperado: ${frame.slice(0, 3).toString('hex')}`);
    }
    const length = frame[3];
    if (((length + frame[4]) & 0xff) !== 0) {
      return fail('protocol', `LCS inválido (LEN=${length} LCS=${frame[4]})`);
    }
    if (frame[5] !== PN532_TO_HOST) {
      return fail('protocol', `TFI inesperado: 0x${frame[5].toString(16)} (esperado 0xd5)`);
    }
    return { payload: frame.slice(6, 6 + length - 1), error: null, kind: null };
  }
}

const reader = new EventEmitter();

let bus = null;
let device = null;
let stopped = false;
let loopPromise = null;
let currentUid = null;
let currentSak = null;
let missStreak = 0;
let faultStreak = 0;

function handleMiss() {
  if (currentUid === null) return;
  missStreak += 1;
  if (missStreak < VANISH_CONFIRMATIONS) return;
  const uid = currentUid;
  const sak = currentSak;
  currentUid = null;
  currentSak = null;
  missStreak = 0;
  reader.emit('tag-vanish', { uid, sak });
}

function handleFound(payload) {
  // payload: 4B NbTg Tg SENS_RES(2) SEL_RES UIDLen UID...
  const sak = payload[5];
  const uidLen = payload[6];
  const uid = payload.slice(7, 7 + uidLen).toString('hex').toUpperCase();

  missStreak = 0;
  if (uid === currentUid) return;

  // Trocar de tag sem passar pelo campo vazio é possível na prática (encostar a
  // segunda antes de tirar a primeira). O consumidor precisa ver o vanish.
  if (currentUid !== null) {
    reader.emit('tag-vanish', { uid: currentUid, sak: currentSak });
  }
  currentUid = uid;
  currentSak = sak;
  reader.emit('tag-present', { uid, sak });
}

async function pollLoop() {
  while (!stopped) {
    const { payload, error, kind } = await device.sendCommand(
      [CMD_IN_LIST_PASSIVE_TARGET, 0x01, 0x00],
      25,
      IN_LIST_TIMEOUT_MS
    );

    // 'timeout' aqui é campo vazio, não falha: só 'bus' e 'protocol' contam.
    if (kind === 'bus' || kind === 'protocol') {
      faultStreak += 1;
      // Só o primeiro de uma sequência vira log: sem isso, um módulo
      // desconectado encheria o journal a ~1 linha por segundo.
      if (faultStreak === 1) console.warn(`[nfc] leitura falhou (${kind}): ${error}`);
    } else if (faultStreak) {
      console.log(`[nfc] leitor normalizado após ${faultStreak} falha(s)`);
      faultStreak = 0;
    }

    if (error || !payload || payload[0] !== 0x4b || payload[1] === 0) {
      handleMiss();
    } else {
      handleFound(payload);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

/**
 * Abre o barramento, confere o firmware e começa a varrer.
 *
 * Nunca lança: numa máquina de dev sem /dev/i2c-3 (ou sem o addon nativo
 * compilado) o servidor precisa subir normalmente, só sem NFC. Devolve true se
 * o leitor está de pé.
 */
async function init() {
  try {
    // require aqui dentro de propósito: i2c-bus é addon nativo e a compilação no
    // ARMv6 do Pi Zero é o passo mais frágil do deploy. Um require no topo do
    // arquivo derrubaria o servidor inteiro se ele faltasse.
    const i2c = require('i2c-bus');
    bus = await i2c.openPromisified(BUS_NUMBER);
    device = new Pn532I2C(bus, PN532_ADDRESS);
    // Ressincroniza o barramento antes do primeiro comando de verdade.
    //
    // Se o processo anterior morreu com um comando pendente -- rotina, com
    // Restart=always no systemd -- a resposta atrasada dele sai na primeira
    // leitura deste processo, que a leria como o ACK do próprio comando e
    // dessincronizaria tudo dali em diante.
    //
    // O jeito óbvio de limpar seria ler e descartar os bytes pendentes, e é o que
    // a versão Python das ferramentas faz. NÃO fazer isso aqui: o os.read do
    // Python aceita leitura curta, mas o i2cRead do i2c-bus exige o tamanho exato
    // e fica clocando um dispositivo que tem menos bytes que isso -- o que TRAVA
    // o barramento bit-banged e só sai com reboot (aconteceu em 24/08/2026).
    //
    // Em vez disso, um comando descartável: se o barramento estiver
    // dessincronizado, é ele que come a resposta velha e falha, e o próximo já
    // encontra tudo limpo. Só transações bem formadas.
    await device.abort();
    await sleep(50);
    await device.sendCommand([CMD_GET_FIRMWARE_VERSION], 12, 300);
    await sleep(50);

    const fw = await device.sendCommand([CMD_GET_FIRMWARE_VERSION], 12);
    if (fw.error) throw new Error(`GetFirmwareVersion: ${fw.error}`);
    if (fw.payload.length < 4 || fw.payload[0] !== 0x03) {
      throw new Error(`resposta inesperada do GetFirmwareVersion: ${fw.payload.toString('hex')}`);
    }
    console.log(
      `[nfc] PN532 em /dev/i2c-${BUS_NUMBER} — IC 0x${fw.payload[1].toString(16)}, ` +
        `firmware ${fw.payload[2]}.${fw.payload[3]}`
    );

    // mode=normal(0x01), timeout=0x14 (1s), IRQ=0x01
    const sam = await device.sendCommand([CMD_SAM_CONFIGURATION, 0x01, 0x14, 0x01], 9);
    if (sam.error) throw new Error(`SAMConfiguration: ${sam.error}`);
    if (!sam.payload.length || sam.payload[0] !== 0x15) {
      throw new Error(`resposta inesperada do SAMConfiguration: ${sam.payload.toString('hex')}`);
    }

    stopped = false;
    loopPromise = pollLoop().catch((err) => {
      console.error('[nfc] loop de leitura morreu:', err.message);
    });
    return true;
  } catch (err) {
    // Só a primeira linha: o MODULE_NOT_FOUND do Node vem com um "Require stack"
    // de várias linhas que não acrescenta nada aqui.
    console.warn(`[nfc] leitor indisponível, seguindo sem NFC: ${err.message.split('\n')[0]}`);
    if (bus) {
      await bus.close().catch(() => {});
    }
    bus = null;
    device = null;
    return false;
  }
}

async function stop() {
  stopped = true;
  // Esperar o loop terminar antes de fechar o barramento. Fechar por baixo dele
  // faz a varredura em voo falhar com EBADF e logar um "barramento com problema"
  // que não existe -- ruído que mascararia um problema de verdade no shutdown.
  // O pior caso é uma varredura vazia, ~IN_LIST_TIMEOUT_MS.
  if (loopPromise) {
    await loopPromise;
    loopPromise = null;
  }
  if (bus) {
    await bus.close().catch(() => {});
    bus = null;
    device = null;
  }
}

function getCurrentTag() {
  if (currentUid === null) return null;
  return { uid: currentUid, sak: currentSak, type: SAK_TYPES[currentSak] || null };
}

reader.init = init;
reader.stop = stop;
reader.getCurrentTag = getCurrentTag;
reader.isRunning = () => device !== null && !stopped;

module.exports = reader;
