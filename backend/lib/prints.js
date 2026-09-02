/**
 * Prints guardados: os arquivos e o índice deles.
 *
 * Estrutura, espelhando o que a galeria já faz (imagem em uploads/, índice em
 * data/) para não inventar uma convenção nova:
 *
 *   backend/uploads/prints/2026-09/2026-09-01T12-02-14.png
 *   backend/data/prints.json
 *
 * As duas pastas já são gitignored e já saem do rsync do deploy, então os prints
 * herdam a proteção que hoje guarda as fotos da galeria e os MP3s -- não há
 * regra nova para lembrar.
 *
 * Por que o índice mora aqui e não no state.js, que cuida do resto: arquivo e
 * entrada precisam nascer e morrer juntos. Um índice apontando para um PNG que
 * não existe (ou um PNG órfão ocupando cartão) é o tipo de divergência que só
 * aparece meses depois, quando ninguém lembra do que se trata. Mantendo os dois
 * atrás das mesmas funções, não há como uma metade mudar sem a outra.
 *
 * O nome do arquivo é ISO até o segundo, sem o `_480x320_scrot` que o scrot
 * colava: ordenar por nome continua sendo ordenar por data -- a única coisa boa
 * do padrão antigo --, e a resolução vai para o índice, onde dá para consultar
 * sem parsear nome de arquivo.
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('./ids');

const { PRINTS_DIR: DIR, DATA_DIR } = require('../config');

const INDICE = path.join(DATA_DIR, 'prints.json');

// Mesmo motivo do uploads/gallery em routes/api/gallery.js: estas pastas não vêm
// no deploy, então num Pi novo nada as cria e o primeiro "guardar" falharia com ENOENT
// depois de já ter capturado a imagem.
fs.mkdirSync(DIR, { recursive: true });
fs.mkdirSync(path.dirname(INDICE), { recursive: true });

function read() {
  try {
    return JSON.parse(fs.readFileSync(INDICE, 'utf-8'));
  } catch (err) {
    // Não existir ainda é o caso normal do primeiro print. Qualquer outro erro
    // precisa aparecer: tratar JSON corrompido como "lista vazia" faria a
    // próxima escrita apagar o histórico inteiro em silêncio -- mesma decisão
    // que o state.js toma para a galeria.
    if (err.code !== 'ENOENT') console.error(`Falha ao ler ${INDICE}:`, err.message);
    return [];
  }
}

function write(entries) {
  fs.writeFileSync(INDICE, JSON.stringify(entries, null, 2));
}

/**
 * Largura e altura lidas do cabeçalho do PNG.
 *
 * O IHDR é sempre o primeiro chunk e fica em posição fixa, então são dois
 * readUInt32BE -- não vale uma dependência para isso. A resolução mudou uma vez
 * na vida do projeto (708x480 -> 480x320) e é justamente o tipo de coisa que o
 * histórico deve registrar sozinho.
 */
function dimensions(png) {
  if (png.length < 24 || png.readUInt32BE(12) !== 0x49484452 /* 'IHDR' */) {
    return { width: null, height: null };
  }
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/** `2026-09-01T12-02-14` -- ISO sem os dois-pontos, que complicam em alguns sistemas de arquivos. */
function stamp(date) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    date.getFullYear() + '-' + p(date.getMonth() + 1) + '-' + p(date.getDate()) +
    'T' + p(date.getHours()) + '-' + p(date.getMinutes()) + '-' + p(date.getSeconds())
  );
}

function folder(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

/**
 * Escolhe um nome livre.
 *
 * Dois prints no mesmo segundo são raros mas possíveis (o botão fica a um clique
 * de distância), e o carimbo só vai até o segundo. Sem isto o segundo print
 * sobrescreveria o primeiro e o índice ficaria com duas entradas apontando para
 * o mesmo arquivo.
 */
function freeName(subfolder, base) {
  for (let n = 1; ; n++) {
    const name = n === 1 ? `${base}.png` : `${base}-${n}.png`;
    if (!fs.existsSync(path.join(DIR, subfolder, name))) return name;
  }
}

/*
 * Migração do formato antigo, com as chaves em português.
 *
 * O índice vive no Pi e nunca é deployado, então o arquivo que já está lá foi
 * escrito com `em`, `arquivo`, `nota`, `largura`, `altura` e `contexto`. Ler
 * isso com os nomes novos daria um histórico de prints sem data, sem nota e
 * apontando para lugar nenhum -- e a próxima escrita gravaria essa versão vazia
 * por cima.
 *
 * Roda uma vez, na carga do módulo, e só se achar chave antiga. O backup fica
 * ao lado antes de qualquer escrita: é o cartão SD de um Pi, e um arquivo
 * truncado no meio da regravação levaria o histórico junto.
 */
const CHAVES_ANTIGAS = {
  em: 'at', arquivo: 'file', nota: 'note', largura: 'width', altura: 'height',
  contexto: 'context', musica: 'music', faixa: 'track', tocando: 'playing',
};

function migrarFormatoAntigo() {
  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(INDICE, 'utf-8'));
  } catch (err) {
    return; // sem índice ainda, ou ilegível -- o read() já reclama disso
  }
  if (!Array.isArray(entries) || !entries.some((e) => e && 'em' in e)) return;

  const renomear = (o) => {
    if (!o || typeof o !== 'object') return o;
    const novo = {};
    for (const [k, v] of Object.entries(o)) {
      novo[CHAVES_ANTIGAS[k] || k] = v && typeof v === 'object' ? renomear(v) : v;
    }
    return novo;
  };

  const backup = `${INDICE}.bak`;
  fs.copyFileSync(INDICE, backup);
  fs.writeFileSync(INDICE, JSON.stringify(entries.map(renomear), null, 2));
  console.log(`[prints] índice migrado para as chaves novas (${entries.length} prints; backup em ${path.basename(backup)})`);
}

migrarFormatoAntigo();

function list() {
  // Mais recente primeiro: é a ordem em que se olha um histórico.
  return read().sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/** Total e bytes ocupados, para a página dizer o tamanho do histórico. */
function summary() {
  const entries = read();
  return {
    total: entries.length,
    bytes: entries.reduce((sum, e) => sum + (e.bytes || 0), 0),
  };
}

/**
 * Grava um PNG no histórico.
 *
 * `em` é a hora da captura e não a de agora: entre capturar e clicar em guardar
 * passa o tempo de olhar a imagem e escrever a nota, e o que interessa é quando
 * a tela estava daquele jeito. Vale a ressalva que o services.js já faz sobre
 * timestamps: o Zero W não tem RTC e fica sem NTP quando cai da rede, então em
 * datas absurdas o culpado costuma ser o relógio do Pi.
 */
function save({ png, at, note, context }) {
  const date = at ? new Date(at) : new Date();
  const subfolder = folder(date);
  fs.mkdirSync(path.join(DIR, subfolder), { recursive: true });

  const name = freeName(subfolder, stamp(date));
  const relative = `${subfolder}/${name}`;
  fs.writeFileSync(path.join(DIR, subfolder, name), png);

  const { width, height } = dimensions(png);
  const entry = Object.assign(
    {
      id: randomUUID(),
      file: relative,
      at: date.toISOString(),
      bytes: png.length,
      width,
      height,
      note: (note || '').trim(),
    },
    // Contexto que só o backend sabe na hora da captura -- música tocando, tag
    // encostada. Vai junto porque não dá para reconstruir depois olhando o PNG.
    context || {},
  );

  const entries = read();
  entries.push(entry);
  write(entries);
  return entry;
}

function remove(id) {
  const entries = read();
  const i = entries.findIndex((e) => e.id === id);
  if (i === -1) return null;

  const [entry] = entries.splice(i, 1);
  try {
    fs.unlinkSync(path.join(DIR, entry.file));
  } catch (err) {
    // Arquivo já sumido não impede tirar do índice: o objetivo é justamente
    // deixar os dois em dia, e parar aqui manteria a entrada órfã para sempre.
    if (err.code !== 'ENOENT') throw err;
  }
  write(entries);
  return entry;
}

/** Anota (ou reanota) um print já guardado. */
function annotate(id, note) {
  const entries = read();
  const entry = entries.find((e) => e.id === id);
  if (!entry) return null;
  entry.note = String(note || '').trim();
  write(entries);
  return entry;
}

module.exports = { DIR, INDICE, list, summary, save, remove, annotate, dimensions, stamp, folder };
