/**
 * Player de música — controla um processo mpv ocioso pelo socket IPC.
 *
 * Só cuida do mpv. Não conhece tags, nem WebSocket, nem estado da aplicação:
 * quem junta as pontas é o musicController.js.
 *
 * Emite 'status' a cada transição real (carregou faixa, pausou, retomou, trocou
 * de faixa, acabou a playlist, mudou volume) com:
 *   { album, trackId, trackIndex, trackCount, title, filename,
 *     isPlaying, position, positionAt, duration, volume }
 *
 * Deliberadamente NÃO emite a cada segundo. `position` vem acompanhado de
 * `positionAt` (o instante em que foi medida) justamente para o cliente
 * interpolar sozinho enquanto toca, em vez de receber um fluxo contínuo.
 *
 * Cliente IPC escrito à mão em vez de `node-mpv`: o protocolo é uma linha de
 * JSON por comando, já validado neste Pi, e a lib traz um timeout de conexão
 * próprio que provavelmente não cobre os ~11s que o mpv leva para subir aqui.
 */
const EventEmitter = require('events');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SOCKET_PATH = process.env.MPV_SOCKET || '/tmp/alexo-mpv.sock';
const AUDIO_DEVICE = process.env.MPV_AUDIO_DEVICE || 'alsa/hw:0,0';
const MUSIC_DIR = path.join(__dirname, 'uploads', 'music');

// 100 foi escolhido de ouvido no hardware real, não chutado: o speaker do projeto
// é ineficiente e volume audível importou mais que fidelidade.
//
// Acima de ~60 o som distorce. Subtensão foi descartada (`vcgencmd get_throttled`
// devolve 0x0); a suspeita é o ganho analógico fixo do MAX98357A, que aplica 9dB
// com o pino GAIN flutuando. Não incomoda no uso real, e a correção seria um
// jumper no GAIN, não código.
const DEFAULT_VOLUME = 100;

// O mpv leva ~11s para abrir o socket neste Pi. O timeout precisa de folga, e o
// boot do Express não pode esperar por isso -- ver init().
const SOCKET_TIMEOUT_MS = 45000;

// Em produção o mpv é o alexo-mpv.service, que sobe no boot junto com o resto.
// Com isto ligado o backend NUNCA sobe um mpv próprio: só espera o socket.
//
// Sem essa distinção haveria corrida no boot -- o backend não acharia o socket
// (o mpv systemd ainda subindo), removeria o arquivo e subiria o seu, deixando
// dois mpv disputando o mesmo caminho. Na máquina de dev, sem a variável, o
// spawn continua valendo: é o que faz `npm start` tocar som sem instalar unit
// nenhuma.
const MPV_EXTERNAL = process.env.MPV_EXTERNAL === '1';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Conexão com o mpv: uma linha de JSON por comando, respostas casadas por request_id. */
class MpvIpc extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buffer = '';
    this.nextId = 1;
    this.pending = new Map();

    socket.on('data', (chunk) => this._onData(chunk));
    socket.on('error', (err) => this.emit('error', err));
    socket.on('close', () => {
      // Rejeitar o que estava em voo: sem isso, quem chamou fica pendurado para
      // sempre se o mpv morrer no meio de um comando.
      for (const { reject } of this.pending.values()) {
        reject(new Error('conexão com o mpv fechou'));
      }
      this.pending.clear();
      this.emit('close');
    });
  }

  _onData(chunk) {
    this.buffer += chunk.toString('utf-8');
    let idx;
    while ((idx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;

      let msg;
      try {
        msg = JSON.parse(line);
      } catch (err) {
        continue; // linha truncada ou lixo: ignorar é mais seguro que derrubar
      }

      if (msg.request_id !== undefined && this.pending.has(msg.request_id)) {
        const { resolve, reject } = this.pending.get(msg.request_id);
        this.pending.delete(msg.request_id);
        if (msg.error && msg.error !== 'success') reject(new Error(msg.error));
        else resolve(msg.data);
      } else if (msg.event) {
        this.emit('event', msg);
      }
    }
  }

  command(...args) {
    return new Promise((resolve, reject) => {
      const id = this.nextId;
      this.nextId += 1;
      this.pending.set(id, { resolve, reject });
      try {
        this.socket.write(`${JSON.stringify({ command: args, request_id: id })}\n`);
      } catch (err) {
        this.pending.delete(id);
        reject(err);
        return;
      }
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`timeout no comando ${args[0]}`));
        }
      }, 5000);
    });
  }

  close() {
    this.socket.destroy();
  }
}

function connectOnce(socketPath) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    socket.once('connect', () => resolve(socket));
    socket.once('error', (err) => reject(err));
  });
}

async function waitForSocket(socketPath, timeoutMs, desistir) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // Sem isto, uma máquina sem o mpv instalado esperaria os 45s inteiros por um
    // socket que nunca vai existir -- o spawn já falhou com ENOENT no primeiro
    // instante. É o caso normal da máquina de dev.
    if (desistir && desistir()) return null;
    try {
      return await connectOnce(socketPath);
    } catch (err) {
      await sleep(500);
    }
  }
  return null;
}

/**
 * Reconecta ao mpv depois que a conexão cai.
 *
 * Obrigatório desde que o mpv virou um serviço systemd com Restart=always: ele
 * reinicia sozinho, e sem isto o backend ficaria sem player até *ele* reiniciar
 * também. Enquanto o mpv era filho do backend o caso não existia, porque os dois
 * morriam juntos.
 *
 * Não retoma a reprodução de propósito. O mpv novo sobe com a playlist vazia, e
 * voltar a tocar sozinho seria surpresa desagradável -- som saindo do nada, sem
 * ninguém ter encostado tag. O estado é zerado e o gesto vale de novo.
 */
async function reconectar() {
  if (reconectando || encerrando) return;
  reconectando = true;

  let tentativa = 0;
  while (!encerrando) {
    tentativa += 1;
    try {
      const socket = await connectOnce(SOCKET_PATH);
      ipc = new MpvIpc(socket);
      wireEvents();
      atual = { album: null, tracks: [], volume: atual.volume };
      available = true;
      console.log(`[music] reconectado ao mpv após ${tentativa} tentativa(s)`);
      // Solta a trava ANTES dos awaits abaixo. Se a conexão recém-aberta morrer
      // durante eles, o handler de 'close' chama reconectar() de novo -- e com
      // a trava ainda presa ele retornaria sem fazer nada, deixando o player
      // morto até alguém reiniciar o backend. Acontece de verdade num
      // `systemctl restart alexo-mpv`: o socket do mpv que está morrendo ainda
      // aceita a conexão e só depois dá EPIPE. Visto em 27/08/2026.
      reconectando = false;
      await ipc.command('set_property', 'volume', atual.volume).catch(() => {});
      emitStatus().catch(() => {});
      return;
    } catch (err) {
      // Só a primeira e depois de 10 em 10: o mpv leva ~11s para subir e o
      // RestartSec soma mais alguns, então um punhado de falhas é o normal.
      if (tentativa === 1 || tentativa % 10 === 0) {
        console.warn(`[music] mpv fora do ar, tentando reconectar (${tentativa})`);
      }
      await sleep(3000);
    }
  }
  reconectando = false;
}

const player = new EventEmitter();

let ipc = null;
let child = null;
let available = false;
let reconectando = false;
let encerrando = false;

// Espelho local do que está tocando. O mpv sabe da playlist, mas não sabe o que
// é "álbum" nem qual id o catálogo deu para cada faixa -- isso é nosso.
let atual = {
  album: null,
  tracks: [],
  volume: DEFAULT_VOLUME,
};

// Instante da última mudança real entre tocando e parado.
//
// Não dá para derivar isso de `positionAt`, que é recalculado a cada consulta:
// quem perguntar o status de uma faixa pausada há dez minutos recebe
// positionAt = agora. O cliente precisa saber HÁ QUANTO TEMPO parou (é o que
// decide se o painel de música ainda aparece), e para isso o carimbo tem de ser
// estável entre consultas.
let ultimoIsPlaying = null;
let mudouEstadoEm = Date.now();

function trackAt(index) {
  return atual.tracks[index] || null;
}

async function buildStatus() {
  if (!ipc) return null;

  // Um get_property pode falhar legitimamente (nada carregado ainda, mpv ocioso).
  // Nesse caso o valor é nulo, não um erro do player.
  const get = async (prop) => {
    try {
      return await ipc.command('get_property', prop);
    } catch (err) {
      return null;
    }
  };

  const [pausado, posicao, duracao, indice, volume] = await Promise.all([
    get('pause'),
    get('time-pos'),
    get('duration'),
    get('playlist-pos'),
    get('volume'),
  ]);

  const idx = typeof indice === 'number' && indice >= 0 ? indice : 0;
  const faixa = trackAt(idx);
  const tocando = pausado === false && faixa !== null;

  // Só carimba quando o valor muda de verdade: buildStatus roda a cada polling,
  // e carimbar sempre destruiria a informação que este campo carrega.
  if (ultimoIsPlaying !== tocando) {
    ultimoIsPlaying = tocando;
    mudouEstadoEm = Date.now();
  }

  return {
    album: atual.album,
    trackId: faixa ? faixa.id : null,
    trackIndex: idx,
    trackCount: atual.tracks.length,
    title: faixa ? faixa.title : null,
    filename: faixa ? faixa.filename : null,
    isPlaying: tocando,
    position: typeof posicao === 'number' ? posicao : 0,
    positionAt: Date.now(),
    stateChangedAt: mudouEstadoEm,
    duration: typeof duracao === 'number' ? duracao : null,
    volume: typeof volume === 'number' ? volume : atual.volume,
  };
}

async function emitStatus() {
  const status = await buildStatus();
  if (status) player.emit('status', status);
  return status;
}

function wireEvents() {
  ipc.on('event', (msg) => {
    // Só transições reais viram evento. 'seek' e 'playback-restart' disparam em
    // rajada durante a troca de faixa e não acrescentam informação.
    if (['file-loaded', 'end-file', 'idle', 'pause', 'unpause'].includes(msg.event)) {
      emitStatus().catch(() => {});
    }
  });

  ipc.on('close', () => {
    available = false;
    ipc = null;
    if (encerrando) return;
    console.warn('[music] conexão com o mpv caiu');
    reconectar();
  });

  ipc.on('error', (err) => {
    console.warn(`[music] erro no socket do mpv: ${err.message}`);
  });
}

/**
 * Conecta ao mpv, subindo um se necessário. Nunca lança.
 *
 * Reaproveita um mpv já rodando se o socket responder. Isso importa com
 * Restart=always: o backend reinicia várias vezes ao longo da vida do
 * dispositivo, e subir um mpv novo a cada vez custaria ~11s de silêncio e
 * deixaria processos órfãos acumulando. Reaproveitar também evita a armadilha do
 * `pkill -f`, que já matou a própria sessão que o executou neste projeto.
 */
async function init() {
  try {
    // 1. Já tem um mpv de pé?
    try {
      const socket = await connectOnce(SOCKET_PATH);
      ipc = new MpvIpc(socket);
      wireEvents();
      available = true;
      console.log(`[music] reaproveitando o mpv já ativo em ${SOCKET_PATH}`);
      await ipc.command('set_property', 'volume', atual.volume).catch(() => {});
      return true;
    } catch (err) {
      // Nenhum mpv atendendo ainda.
      if (MPV_EXTERNAL) {
        // Quem sobe o mpv é o systemd; aqui só resta esperar. Não remover o
        // socket e não subir processo nenhum.
        const socket = await waitForSocket(SOCKET_PATH, SOCKET_TIMEOUT_MS);
        if (!socket) {
          console.warn(
            `[music] MPV_EXTERNAL=1 mas ${SOCKET_PATH} não apareceu em ` +
              `${SOCKET_TIMEOUT_MS / 1000}s — o alexo-mpv.service está de pé?`
          );
          return false;
        }
        ipc = new MpvIpc(socket);
        wireEvents();
        available = true;
        console.log(`[music] conectado ao mpv externo em ${SOCKET_PATH}`);
        await ipc.command('set_property', 'volume', atual.volume).catch(() => {});
        return true;
      }

      // Se sobrou um socket morto, ele impede o bind do mpv que vamos subir.
      if (fs.existsSync(SOCKET_PATH)) {
        try {
          fs.unlinkSync(SOCKET_PATH);
        } catch (e) {
          /* se não der para remover, o spawn abaixo falha e o erro aparece lá */
        }
      }
    }

    // 2. Subir um.
    child = spawn(
      'mpv',
      [
        '--idle=yes',
        '--no-video',
        `--audio-device=${AUDIO_DEVICE}`,
        `--volume=${atual.volume}`,
        `--input-ipc-server=${SOCKET_PATH}`,
      ],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();

    let falhouAoSubir = false;
    child.on('error', (err) => {
      falhouAoSubir = true;
      console.warn(`[music] não consegui subir o mpv: ${err.message}`);
      available = false;
    });

    const socket = await waitForSocket(SOCKET_PATH, SOCKET_TIMEOUT_MS, () => falhouAoSubir);
    if (!socket) {
      if (!falhouAoSubir) {
        console.warn(`[music] o mpv não abriu ${SOCKET_PATH} em ${SOCKET_TIMEOUT_MS / 1000}s`);
      }
      return false;
    }

    ipc = new MpvIpc(socket);
    wireEvents();
    available = true;
    console.log(`[music] mpv pronto em ${SOCKET_PATH}`);
    return true;
  } catch (err) {
    console.warn(`[music] player indisponível, seguindo sem áudio: ${err.message}`);
    available = false;
    return false;
  }
}

/**
 * Carrega um álbum e toca a partir de `startIndex` (padrão: a primeira faixa).
 *
 * Carrega o álbum inteiro mesmo quando o alvo é uma faixa do meio, em vez de
 * carregar só ela: é o que mantém anterior/próxima navegando pelo álbum. Um
 * `loadfile` de arquivo único deixaria a playlist com um item só e os controles
 * sem para onde ir.
 */
async function playAlbum(album, tracks, startIndex = 0) {
  if (!available || !tracks || !tracks.length) return null;

  atual = { album, tracks: tracks.slice(), volume: atual.volume };

  const caminho = (t) => path.join(MUSIC_DIR, t.filename);

  // A primeira substitui a playlist; as demais entram na fila. Daí em diante o
  // avanço entre faixas é do mpv, não nosso.
  await ipc.command('loadfile', caminho(tracks[0]), 'replace');
  for (const faixa of tracks.slice(1)) {
    await ipc.command('loadfile', caminho(faixa), 'append');
  }

  const alvo = Math.max(0, Math.min(tracks.length - 1, Number(startIndex) || 0));
  if (alvo > 0) {
    await ipc.command('set_property', 'playlist-pos', alvo);
  }

  await ipc.command('set_property', 'pause', false);
  return emitStatus();
}

async function pause() {
  if (!available) return null;
  await ipc.command('set_property', 'pause', true);
  return emitStatus();
}

async function resume() {
  if (!available) return null;
  await ipc.command('set_property', 'pause', false);
  return emitStatus();
}

/** Volta ao início da faixa atual. */
async function restart() {
  if (!available) return null;
  await ipc.command('seek', 0, 'absolute');
  await ipc.command('set_property', 'pause', false);
  return emitStatus();
}

async function next() {
  if (!available) return null;
  await ipc.command('playlist-next', 'weak').catch(() => {});
  return emitStatus();
}

async function previous() {
  if (!available) return null;
  await ipc.command('playlist-prev', 'weak').catch(() => {});
  return emitStatus();
}

async function setVolume(value) {
  if (!available) return null;
  const v = Math.max(0, Math.min(100, Number(value)));
  if (Number.isNaN(v)) return null;
  atual.volume = v;
  await ipc.command('set_property', 'volume', v);
  return emitStatus();
}

/** Para e esvazia a playlist. O mpv continua ocioso, pronto para o próximo álbum. */
async function stop() {
  if (!available) return null;
  await ipc.command('stop').catch(() => {});
  atual = { album: null, tracks: [], volume: atual.volume };
  return emitStatus();
}

async function getStatus() {
  if (!available) {
    return {
      album: null, trackId: null, trackIndex: 0, trackCount: 0,
      title: null, filename: null, isPlaying: false,
      position: 0, positionAt: Date.now(), stateChangedAt: mudouEstadoEm,
      duration: null, volume: atual.volume,
    };
  }
  return buildStatus();
}

/**
 * Fecha a conexão. Não mata o mpv de propósito: ele é reaproveitado no próximo
 * init(), o que evita os ~11s de subida a cada reinício do backend.
 */
function close() {
  encerrando = true;
  if (ipc) {
    ipc.close();
    ipc = null;
  }
  available = false;
}

player.init = init;
player.playAlbum = playAlbum;
player.pause = pause;
player.resume = resume;
player.restart = restart;
player.next = next;
player.previous = previous;
player.setVolume = setVolume;
player.stop = stop;
player.getStatus = getStatus;
player.close = close;
player.isAvailable = () => available;

module.exports = player;
