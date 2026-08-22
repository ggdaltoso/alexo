#!/usr/bin/env node
'use strict';

/**
 * Smoke test do PN532 em modo HSU (UART) — sem nenhuma dependência.
 *
 * Objetivo: provar que o módulo está alimentado, com as chaves DIP corretas e
 * conversando com o Pi, ANTES de instalar `pn532`/`serialport` (addons nativos
 * que no Pi Zero W, ARMv6 + Node 14, podem dar trabalho pra compilar).
 *
 * Fala o protocolo HSU direto no device serial via `stty` + `fs`, então roda
 * com o Node que já estiver no Pi.
 *
 * Uso:
 *   node backend/scripts/pn532-smoke-test.js
 *   node backend/scripts/pn532-smoke-test.js --device /dev/ttyS0 --verbose
 *
 * O que ele faz, em ordem:
 *   1. Checagens de ambiente (device existe, console serial desligado, enable_uart)
 *   2. Wakeup + GetFirmwareVersion  -> confirma que o PN532 responde
 *   3. SAMConfiguration             -> coloca o chip em modo normal de leitura
 *   4. Loop de InListPassiveTarget  -> imprime UID/SAK de cada tag aproximada
 *
 * Ctrl+C encerra.
 *
 * Fiação esperada (chaves DIP em HSU — na placa do projeto, SW1=0 SW2=0):
 *   PN532 VCC          <-- Pi 3V3       (pino 1)
 *   PN532 GND          <-- Pi GND       (pino 6)
 *   PN532 SDA (= TXD)  --> Pi GPIO15/RXD (pino 10)
 *   PN532 SCL (= RXD)  <-- Pi GPIO14/TXD (pino 8)
 */

const fs = require('fs');
const { execFileSync } = require('child_process');

const DEFAULT_DEVICE = '/dev/serial0';
const DEFAULT_BAUD = 115200;

// Frames de controle do protocolo HSU (UM0701-02, seção 6.2.1).
const ACK = Buffer.from([0x00, 0x00, 0xff, 0x00, 0xff, 0x00]);
const WAKEUP = Buffer.from([0x55, 0x55, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

const HOST_TO_PN532 = 0xd4;
const PN532_TO_HOST = 0xd5;

// Quantos polls seguidos sem resposta até declarar que a tag saiu de campo.
const MISS_THRESHOLD = 2;

let verbose = false;

// ---------------------------------------------------------------- utilidades

function log(msg) {
  console.log(msg);
}

function trace(direction, buf) {
  if (!verbose) return;
  console.log(`  ${direction} ${buf.toString('hex').replace(/(..)/g, '$1 ').trim()}`);
}

function hex(buf) {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join('');
}

/** Sleep síncrono — o script é sequencial de ponta a ponta, não tem event loop pra travar. */
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readIfExists(path) {
  try {
    return fs.readFileSync(path, 'utf8');
  } catch (err) {
    return null;
  }
}

// -------------------------------------------------------- protocolo PN532

/** Monta um "normal information frame": 00 00 FF LEN LCS TFI ...dados DCS 00 */
function buildFrame(data) {
  const len = data.length + 1; // +1 do TFI
  if (len > 0xfe) throw new Error('comando longo demais para frame normal');

  const lcs = (0x100 - len) & 0xff;
  let sum = HOST_TO_PN532;
  for (const byte of data) sum = (sum + byte) & 0xff;
  const dcs = (0x100 - sum) & 0xff;

  return Buffer.concat([
    Buffer.from([0x00, 0x00, 0xff, len, lcs, HOST_TO_PN532]),
    Buffer.from(data),
    Buffer.from([dcs, 0x00]),
  ]);
}

/**
 * Tenta extrair o primeiro frame completo do buffer.
 * Retorna null se ainda faltam bytes (o chamador acumula mais e tenta de novo).
 */
function takeFrame(buf) {
  for (let i = 0; i + 2 < buf.length; i++) {
    if (buf[i] !== 0x00 || buf[i + 1] !== 0x00 || buf[i + 2] !== 0xff) continue;

    const body = buf.slice(i + 3);
    if (body.length < 2) return null;

    if (body[0] === 0x00 && body[1] === 0xff) {
      return { kind: 'ack', rest: buf.slice(i + 5) };
    }
    if (body[0] === 0xff && body[1] === 0x00) {
      return { kind: 'nack', rest: buf.slice(i + 5) };
    }

    const len = body[0];
    const lcs = body[1];
    if (((len + lcs) & 0xff) !== 0) continue; // não era início de frame, segue procurando
    if (len === 0xff) throw new Error('frame estendido não suportado por este script');
    if (body.length < len + 3) return null; // LEN + LCS + (TFI..dados) + DCS

    const tfi = body[2];
    const data = body.slice(3, len + 2);
    const dcs = body[len + 2];

    let sum = 0;
    for (let k = 2; k < len + 2; k++) sum = (sum + body[k]) & 0xff;
    if (((sum + dcs) & 0xff) !== 0) {
      throw new Error('checksum de dados inválido no frame recebido');
    }

    return { kind: 'frame', tfi, data, rest: buf.slice(i + len + 6) };
  }
  return null;
}

// ----------------------------------------------------------- porta serial

function configurePort(device, baud) {
  // `min 0 time 1` = VMIN 0 / VTIME 0.1s: readSync sempre volta em <=100ms,
  // com 0 ou mais bytes. É o que deixa o loop de leitura controlável sem
  // depender de I/O não-bloqueante.
  const args = [
    '-F', device,
    'raw',
    String(baud),
    'cs8', '-cstopb', '-parenb', '-crtscts',
    '-echo', '-echoe', '-echok',
    'min', '0', 'time', '1',
  ];
  try {
    execFileSync('stty', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (err) {
    const detail = err.stderr ? err.stderr.toString().trim() : err.message;
    throw new Error(`falha ao configurar ${device} com stty: ${detail}`);
  }
}

function openPort(device) {
  try {
    return fs.openSync(device, fs.constants.O_RDWR | fs.constants.O_NOCTTY);
  } catch (err) {
    if (err.code === 'EACCES') {
      throw new Error(
        `sem permissão para abrir ${device}.\n` +
        `  Adicione seu usuário ao grupo dialout e refaça o login:\n` +
        `    sudo usermod -aG dialout $USER`
      );
    }
    throw err;
  }
}

const scratch = Buffer.alloc(512);

function readAvailable(fd) {
  let n;
  try {
    n = fs.readSync(fd, scratch, 0, scratch.length, null);
  } catch (err) {
    if (err.code === 'EAGAIN') return null;
    throw err;
  }
  if (!n) return null;
  const chunk = Buffer.from(scratch.slice(0, n));
  trace('<--', chunk);
  return chunk;
}

function drain(fd, ms = 120) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (!readAvailable(fd)) break;
  }
}

function write(fd, buf) {
  trace('-->', buf);
  fs.writeSync(fd, buf);
}

/**
 * Envia um comando, descarta o ACK e devolve os bytes de dados da resposta.
 * Retorna null se estourou o timeout.
 */
function transact(fd, command, timeoutMs) {
  write(fd, buildFrame(command));

  const deadline = Date.now() + timeoutMs;
  let rx = Buffer.alloc(0);

  while (Date.now() < deadline) {
    const chunk = readAvailable(fd);
    if (chunk) rx = Buffer.concat([rx, chunk]);

    let parsed;
    while ((parsed = takeFrame(rx)) !== null) {
      rx = parsed.rest;

      if (parsed.kind === 'ack') continue; // só confirma o recebimento, a resposta vem depois
      if (parsed.kind === 'nack') {
        throw new Error('PN532 respondeu NACK (frame corrompido no caminho)');
      }
      if (parsed.tfi === 0x7f) {
        throw new Error('PN532 respondeu um error frame (comando inválido)');
      }
      if (parsed.tfi !== PN532_TO_HOST) {
        throw new Error(`TFI inesperado na resposta: 0x${parsed.tfi.toString(16)}`);
      }
      return parsed.data;
    }
  }

  return null;
}

// -------------------------------------------------------------- comandos

function getFirmwareVersion(fd) {
  const d = transact(fd, [0x02], 1500);
  if (!d) return null;
  if (d[0] !== 0x03 || d.length < 5) {
    throw new Error(`resposta inesperada de GetFirmwareVersion: ${hex(d)}`);
  }
  return { ic: d[1], version: d[2], revision: d[3], support: d[4] };
}

function samConfiguration(fd) {
  // modo 0x01 = normal, timeout 0x14 (~1s), IRQ habilitado
  const d = transact(fd, [0x14, 0x01, 0x14, 0x01], 1500);
  if (!d) return false;
  if (d[0] !== 0x15) {
    throw new Error(`resposta inesperada de SAMConfiguration: ${hex(d)}`);
  }
  return true;
}

/** SAK -> tipo provável da tag. É o que decide se a tag serve pro projeto. */
function describeTag(sak, uidLength) {
  if (sak === 0x00) {
    return uidLength === 7
      ? 'Mifare Ultralight / NTAG21x  <- serve pro projeto'
      : 'Mifare Ultralight (UID curto)';
  }
  if (sak === 0x08) return 'Mifare Classic 1K';
  if (sak === 0x09) return 'Mifare Mini';
  if (sak === 0x18) return 'Mifare Classic 4K';
  if (sak === 0x20) return 'ISO14443-4 (DESFire / cartão bancário)';
  if (sak === 0x28) return 'Mifare Classic + ISO14443-4';
  return 'desconhecido';
}

/**
 * Um ciclo de InListPassiveTarget (106 kbps type A, 1 alvo).
 * Se estourar o timeout, manda um ACK pra abortar o comando em andamento —
 * senão o PN532 fica esperando tag pra sempre e o próximo comando desalinha.
 */
function scanOnce(fd, timeoutMs) {
  let d;
  try {
    d = transact(fd, [0x4a, 0x01, 0x00], timeoutMs);
  } catch (err) {
    write(fd, ACK);
    drain(fd);
    throw err;
  }

  if (!d) {
    write(fd, ACK);
    drain(fd);
    return null;
  }

  if (d[0] !== 0x4b) {
    throw new Error(`resposta inesperada de InListPassiveTarget: ${hex(d)}`);
  }
  if (d[1] === 0x00) return null; // nenhum alvo em campo

  const sens = (d[3] << 8) | d[4];
  const sak = d[5];
  const uidLength = d[6];
  const uid = d.slice(7, 7 + uidLength);

  return { uid: hex(uid), sak, sens, description: describeTag(sak, uidLength) };
}

// ------------------------------------------------------------ preflight

function preflight(device) {
  const problems = [];
  const notes = [];

  if (!fs.existsSync(device)) {
    problems.push(
      `${device} não existe.\n` +
      `  - Confirme enable_uart=1 em /boot/firmware/config.txt (ou /boot/config.txt) e reinicie\n` +
      `  - Tente também --device /dev/ttyS0 ou --device /dev/ttyAMA0`
    );
    return { problems, notes };
  }

  try {
    const target = fs.realpathSync(device);
    if (target !== device) notes.push(`${device} aponta para ${target}`);
  } catch (err) {
    // symlink quebrado é problema do device em si, já coberto abaixo
  }

  const cmdline = readIfExists('/boot/firmware/cmdline.txt') || readIfExists('/boot/cmdline.txt');
  if (cmdline && /console=(serial0|ttyS0|ttyAMA0)/.test(cmdline)) {
    problems.push(
      'o console serial ainda está habilitado no cmdline.txt — ele briga com o PN532 pela porta.\n' +
      '  Desative com: sudo raspi-config -> Interface Options -> Serial Port\n' +
      '  (login shell: NÃO / hardware serial: SIM)'
    );
  }

  const config = readIfExists('/boot/firmware/config.txt') || readIfExists('/boot/config.txt');
  if (config) {
    if (!/^\s*enable_uart=1/m.test(config)) {
      problems.push('enable_uart=1 não encontrado no config.txt — adicione e reinicie.');
    }
    if (/^\s*dtoverlay=disable-bt/m.test(config)) {
      notes.push('disable-bt ativo: /dev/serial0 é o UART completo (PL011), o bom.');
    } else {
      notes.push('Bluetooth ativo: /dev/serial0 é a mini-UART. Se der instabilidade, ' +
        'adicione dtoverlay=disable-bt ao config.txt.');
    }
  }

  return { problems, notes };
}

// ----------------------------------------------------------------- main

function parseArgs(argv) {
  const opts = {
    device: process.env.PN532_DEVICE || DEFAULT_DEVICE,
    baud: DEFAULT_BAUD,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--device' || arg === '-d') opts.device = argv[++i];
    else if (arg === '--baud' || arg === '-b') opts.baud = Number(argv[++i]);
    else if (arg === '--verbose' || arg === '-v') opts.verbose = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`argumento desconhecido: ${arg}`);
  }
  return opts;
}

function usage() {
  log('Uso: node backend/scripts/pn532-smoke-test.js [opções]');
  log('');
  log('  -d, --device <path>   device serial (padrão: /dev/serial0)');
  log('  -b, --baud <n>        baud rate (padrão: 115200)');
  log('  -v, --verbose         mostra os bytes trocados com o módulo');
  log('  -h, --help            esta ajuda');
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Erro: ${err.message}\n`);
    usage();
    process.exit(2);
  }

  if (opts.help) {
    usage();
    return;
  }
  verbose = Boolean(opts.verbose);

  log('== Smoke test do PN532 (modo HSU) ==\n');

  log('[1/4] Checando ambiente...');
  const { problems, notes } = preflight(opts.device);
  for (const note of notes) log(`      nota: ${note}`);
  if (problems.length) {
    log('');
    for (const problem of problems) console.error(`  !! ${problem}`);
    process.exit(1);
  }
  log(`      ok — usando ${opts.device} a ${opts.baud} baud\n`);

  let fd;
  try {
    configurePort(opts.device, opts.baud);
    fd = openPort(opts.device);
  } catch (err) {
    console.error(`  !! ${err.message}`);
    process.exit(1);
  }

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    try {
      fs.closeSync(fd);
    } catch (err) {
      /* já fechado */
    }
  };

  try {
    log('[2/4] Acordando o módulo e pedindo a versão de firmware...');
    write(fd, WAKEUP);
    sleep(100);
    drain(fd);

    let firmware = null;
    for (let attempt = 1; attempt <= 3 && !firmware; attempt++) {
      firmware = getFirmwareVersion(fd);
      if (!firmware && attempt < 3) {
        log(`      sem resposta (tentativa ${attempt}/3), reenviando wakeup...`);
        write(fd, WAKEUP);
        sleep(100);
        drain(fd);
      }
    }

    if (!firmware) {
      console.error(
        '\n  !! O módulo não respondeu. Checklist:\n' +
        '     - Chaves DIP em HSU (na sua placa: SW1=0, SW2=0)\n' +
        '     - TX/RX CRUZADOS: SDA(=TXD) do PN532 no pino 10, SCL(=RXD) no pino 8\n' +
        '     - VCC no 3V3 (pino 1). Se a placa tiver regulador AMS1117, ela precisa\n' +
        '       de 5V — nesse caso mova para o pino 2. Nunca 5V num rail de 3.3V.\n' +
        '     - GND compartilhado com o Pi (pino 6)\n' +
        '     - LED de power do módulo aceso\n' +
        '     Rode de novo com --verbose para ver os bytes crus.'
      );
      close();
      process.exit(1);
    }

    const chip = firmware.ic === 0x32 ? 'PN532' : `IC desconhecido (0x${firmware.ic.toString(16)})`;
    log(`      ok — ${chip}, firmware v${firmware.version}.${firmware.revision}\n`);

    log('[3/4] Configurando o SAM em modo normal...');
    if (!samConfiguration(fd)) {
      console.error('  !! SAMConfiguration não respondeu.');
      close();
      process.exit(1);
    }
    log('      ok\n');

    log('[4/4] Lendo tags. Aproxime uma tag da antena (Ctrl+C para sair).\n');

    process.on('SIGINT', () => {
      log('\n\nEncerrando.');
      close();
      process.exit(0);
    });

    let currentUid = null;
    let misses = 0;

    for (;;) {
      let tag;
      try {
        tag = scanOnce(fd, 800);
      } catch (err) {
        log(`      aviso: ${err.message} — ressincronizando`);
        drain(fd, 300);
        continue;
      }

      if (tag) {
        misses = 0;
        if (tag.uid !== currentUid) {
          currentUid = tag.uid;
          log(`  [tag presente] UID ${tag.uid}`);
          log(`                 SAK 0x${tag.sak.toString(16).padStart(2, '0')} — ${tag.description}`);
        }
      } else if (currentUid) {
        misses += 1;
        if (misses >= MISS_THRESHOLD) {
          log(`  [tag removida] UID ${currentUid}\n`);
          currentUid = null;
          misses = 0;
        }
      }
    }
  } catch (err) {
    console.error(`\n  !! ${err.message}`);
    close();
    process.exit(1);
  }
}

main();
