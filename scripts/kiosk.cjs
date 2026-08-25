#!/usr/bin/env node
/**
 * Inspeciona o kiosk do Pi de fora, pelo protocolo DevTools do Chromium.
 *
 * O Chromium do Pi sobe com --remote-debugging-port=9222 (ver
 * deploy/systemd/alexo-display.service), mas ligado só em 127.0.0.1: o depurador
 * dá controle total do navegador sem autenticação nenhuma, então expô-lo na rede
 * seria abrir o kiosk para qualquer um do wi-fi. Este script abre um túnel SSH
 * sozinho, usa, e fecha.
 *
 * RODA NA MÁQUINA DE DEV, não no Pi. O script é que abre o ssh para lá -- rodá-lo
 * no próprio Pi faria o túnel apontar para ele mesmo, e o navegador daqui não
 * teria como alcançar.
 *
 * Uso (a partir da raiz do repo):
 *   node scripts/kiosk.cjs shot [arquivo.png]   captura a tela do kiosk
 *   node scripts/kiosk.cjs eval "<js>"          roda JS na página e imprime o retorno
 *   node scripts/kiosk.cjs console [segundos]   escuta o console (padrão: 10s)
 *   node scripts/kiosk.cjs reload               recarrega a página
 *   node scripts/kiosk.cjs info                 URL, título e tamanho da viewport
 *   node scripts/kiosk.cjs devtools             abre o túnel e imprime a URL do
 *                                               DevTools para colar no navegador
 *                                               (fica de pé até Ctrl+C)
 *
 *   ALEXO_HOST=pi@outro node scripts/kiosk.cjs shot
 */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const WebSocket = require(path.join(__dirname, '..', 'backend', 'node_modules', 'ws'));

const HOST = process.env.ALEXO_HOST || 'pi@192.168.0.96';
const PORTA = Number(process.env.ALEXO_CDP_PORT || 9222);
const BASE = `http://127.0.0.1:${PORTA}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(caminho) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE}${caminho}`, { timeout: 5000 }, (res) => {
      let corpo = '';
      res.on('data', (c) => (corpo += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(corpo));
        } catch (err) {
          reject(new Error(`resposta não-JSON de ${caminho}: ${corpo.slice(0, 80)}`));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function portaViva() {
  try {
    await getJson('/json/version');
    return true;
  } catch (err) {
    return false;
  }
}

/** Abre o túnel se a porta ainda não responder. Devolve o processo, ou null. */
async function abrirTunel() {
  if (await portaViva()) return null; // já tem túnel de pé

  const ssh = spawn('ssh', ['-N', '-L', `${PORTA}:localhost:${PORTA}`, HOST], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let erroSsh = '';
  ssh.stderr.on('data', (c) => (erroSsh += c.toString()));

  for (let i = 0; i < 30; i += 1) {
    await sleep(300);
    if (await portaViva()) return ssh;
    if (ssh.exitCode !== null) {
      throw new Error(`ssh saiu (${ssh.exitCode}): ${erroSsh.trim() || 'sem mensagem'}`);
    }
  }
  ssh.kill();
  throw new Error(`o túnel abriu mas ${BASE} não respondeu`);
}

/** Conexão CDP com a aba do kiosk. */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.proximoId = 1;
    this.pendentes = new Map();
    this.aoEvento = null;

    ws.on('message', (dados) => {
      const msg = JSON.parse(dados.toString());
      if (msg.id && this.pendentes.has(msg.id)) {
        const { resolve, reject } = this.pendentes.get(msg.id);
        this.pendentes.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method && this.aoEvento) {
        this.aoEvento(msg);
      }
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.proximoId;
      this.proximoId += 1;
      this.pendentes.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pendentes.has(id)) {
          this.pendentes.delete(id);
          reject(new Error(`timeout em ${method}`));
        }
      }, 15000);
    });
  }

  close() {
    this.ws.close();
  }
}

async function conectar() {
  const alvos = await getJson('/json');
  // A aba do kiosk é a única `page` apontando para a aplicação. Filtrar por tipo
  // não basta: as extensões aparecem como background_page e devtools como page.
  const alvo = alvos.find((t) => t.type === 'page' && t.url.includes('localhost:3001'));
  if (!alvo) {
    throw new Error(
      `nenhuma aba em localhost:3001. Alvos: ${alvos.map((t) => `${t.type} ${t.url}`).join(', ')}`
    );
  }
  const ws = new WebSocket(alvo.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  return new Cdp(ws);
}

async function comandoShot(cdp, args) {
  const destino = args[0] || `kiosk-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(destino, Buffer.from(data, 'base64'));
  const { width, height } = fs.statSync(destino).size
    ? await metricas(cdp)
    : { width: 0, height: 0 };
  console.log(`${destino}  (${width}x${height})`);
}

async function metricas(cdp) {
  const { result } = await cdp.send('Runtime.evaluate', {
    expression: '({width: innerWidth, height: innerHeight})',
    returnByValue: true,
  });
  return result.value;
}

async function comandoEval(cdp, args) {
  const expressao = args.join(' ');
  if (!expressao) throw new Error('faltou o JS: kiosk.js eval "document.title"');
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression: expressao,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) {
    console.error(exceptionDetails.exception?.description || exceptionDetails.text);
    process.exitCode = 1;
    return;
  }
  console.log(
    typeof result.value === 'object' ? JSON.stringify(result.value, null, 2) : result.value
  );
}

async function comandoConsole(cdp, args) {
  const segundos = Number(args[0]) || 10;
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  console.log(`escutando o console por ${segundos}s...\n`);

  cdp.aoEvento = (msg) => {
    if (msg.method === 'Runtime.consoleAPICalled') {
      const texto = msg.params.args
        .map((a) => (a.value !== undefined ? a.value : a.description || a.type))
        .join(' ');
      console.log(`[${msg.params.type}] ${texto}`);
    } else if (msg.method === 'Log.entryAdded') {
      console.log(`[${msg.params.entry.level}] ${msg.params.entry.text}`);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      console.log(`[erro] ${d.exception?.description || d.text}`);
    }
  };
  await sleep(segundos * 1000);
}

async function comandoReload(cdp) {
  await cdp.send('Page.reload', { ignoreCache: true });
  console.log('recarregado');
}

async function comandoInfo(cdp) {
  const { result } = await cdp.send('Runtime.evaluate', {
    expression:
      '({url: location.href, title: document.title, w: innerWidth, h: innerHeight, dpr: devicePixelRatio})',
    returnByValue: true,
  });
  const v = result.value;
  console.log(`url   ${v.url}`);
  console.log(`title ${v.title}`);
  console.log(`view  ${v.w}x${v.h} @${v.dpr}x`);
}

/**
 * Mantém o túnel aberto e imprime a URL do DevTools.
 *
 * Usa o frontend servido pelo PRÓPRIO Pi (`/devtools/inspector.html`), e não o
 * `edge://inspect` / `chrome://inspect` do navegador local. Os dois funcionam,
 * mas o do Pi vem na versão do Chrome 88 que está rodando lá; o do navegador
 * local é muito mais novo e conversa com um protocolo de 2021, o que costuma
 * aparecer como painéis vazios ou botões que não fazem nada.
 */
async function comandoDevtools(cdp) {
  const alvos = await getJson('/json');
  const alvo = alvos.find((t) => t.type === 'page' && t.url.includes('localhost:3001'));
  const url = `${BASE}/devtools/inspector.html?ws=127.0.0.1:${PORTA}/devtools/page/${alvo.id}`;

  console.log('\nCole no navegador:\n');
  console.log(`  ${url}\n`);
  console.log(`Alternativa: edge://inspect/#devices, em "Discover network targets"`);
  console.log(`adicione 127.0.0.1:${PORTA}. O frontend será o do Edge, mais novo`);
  console.log(`que o Chrome 88 do Pi -- se algum painel vier vazio, use a URL acima.\n`);
  console.log(`Túnel aberto para ${HOST}. Ctrl+C para fechar.`);

  // Segura o processo: fechar aqui derrubaria o túnel no meio do uso.
  await new Promise(() => {});
}

const COMANDOS = {
  shot: comandoShot,
  devtools: comandoDevtools,
  eval: comandoEval,
  console: comandoConsole,
  reload: comandoReload,
  info: comandoInfo,
};

async function main() {
  const [comando, ...args] = process.argv.slice(2);
  const fn = COMANDOS[comando];
  if (!fn) {
    console.error(`comando desconhecido: ${comando || '(nenhum)'}\n`);
    // Imprime o bloco de doc do topo como ajuda, sem os delimitadores nem os
    // asteriscos de margem.
    const doc = fs.readFileSync(__filename, 'utf-8').split('*/')[0];
    console.error(
      doc
        .split('\n')
        .filter((l) => l.trim().startsWith('*'))
        .map((l) => l.replace(/^\s*\* ?/, ''))
        .join('\n')
        .trim()
    );
    process.exit(1);
  }

  let tunel = null;
  let cdp = null;
  try {
    tunel = await abrirTunel();
    cdp = await conectar();
    await fn(cdp, args);
  } catch (err) {
    console.error(`erro: ${err.message}`);
    process.exitCode = 1;
  } finally {
    if (cdp) cdp.close();
    if (tunel) tunel.kill();
  }
}

main();
