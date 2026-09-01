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

const DIR = path.join(__dirname, 'uploads', 'prints');
const INDICE = path.join(__dirname, 'data', 'prints.json');

// Mesmo motivo do uploads/gallery no server.js: estas pastas não vêm no deploy,
// então num Pi novo nada as cria e o primeiro "guardar" falharia com ENOENT
// depois de já ter capturado a imagem.
fs.mkdirSync(DIR, { recursive: true });
fs.mkdirSync(path.dirname(INDICE), { recursive: true });

function ler() {
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

function escrever(entradas) {
  fs.writeFileSync(INDICE, JSON.stringify(entradas, null, 2));
}

/**
 * Largura e altura lidas do cabeçalho do PNG.
 *
 * O IHDR é sempre o primeiro chunk e fica em posição fixa, então são dois
 * readUInt32BE -- não vale uma dependência para isso. A resolução mudou uma vez
 * na vida do projeto (708x480 -> 480x320) e é justamente o tipo de coisa que o
 * histórico deve registrar sozinho.
 */
function dimensoes(png) {
  if (png.length < 24 || png.readUInt32BE(12) !== 0x49484452 /* 'IHDR' */) {
    return { largura: null, altura: null };
  }
  return { largura: png.readUInt32BE(16), altura: png.readUInt32BE(20) };
}

/** `2026-09-01T12-02-14` -- ISO sem os dois-pontos, que complicam em alguns sistemas de arquivos. */
function carimbo(data) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    data.getFullYear() + '-' + p(data.getMonth() + 1) + '-' + p(data.getDate()) +
    'T' + p(data.getHours()) + '-' + p(data.getMinutes()) + '-' + p(data.getSeconds())
  );
}

function pasta(data) {
  return data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0');
}

/**
 * Escolhe um nome livre.
 *
 * Dois prints no mesmo segundo são raros mas possíveis (o botão fica a um clique
 * de distância), e o carimbo só vai até o segundo. Sem isto o segundo print
 * sobrescreveria o primeiro e o índice ficaria com duas entradas apontando para
 * o mesmo arquivo.
 */
function nomeLivre(subpasta, base) {
  for (let n = 1; ; n++) {
    const nome = n === 1 ? `${base}.png` : `${base}-${n}.png`;
    if (!fs.existsSync(path.join(DIR, subpasta, nome))) return nome;
  }
}

function listar() {
  // Mais recente primeiro: é a ordem em que se olha um histórico.
  return ler().sort((a, b) => String(b.em).localeCompare(String(a.em)));
}

/** Total e bytes ocupados, para a página dizer o tamanho do histórico. */
function resumo() {
  const entradas = ler();
  return {
    total: entradas.length,
    bytes: entradas.reduce((soma, e) => soma + (e.bytes || 0), 0),
  };
}

/**
 * Grava um PNG no histórico.
 *
 * `em` é a hora da captura e não a de agora: entre capturar e clicar em guardar
 * passa o tempo de olhar a imagem e escrever a nota, e o que interessa é quando
 * a tela estava daquele jeito. Vale a ressalva que o servicos.js já faz sobre
 * timestamps: o Zero W não tem RTC e fica sem NTP quando cai da rede, então em
 * datas absurdas o culpado costuma ser o relógio do Pi.
 */
function guardar({ png, em, nota, contexto }) {
  const data = em ? new Date(em) : new Date();
  const subpasta = pasta(data);
  fs.mkdirSync(path.join(DIR, subpasta), { recursive: true });

  const nome = nomeLivre(subpasta, carimbo(data));
  const relativo = `${subpasta}/${nome}`;
  fs.writeFileSync(path.join(DIR, subpasta, nome), png);

  const { largura, altura } = dimensoes(png);
  const entrada = Object.assign(
    {
      id: randomUUID(),
      arquivo: relativo,
      em: data.toISOString(),
      bytes: png.length,
      largura,
      altura,
      nota: (nota || '').trim(),
    },
    // Contexto que só o backend sabe na hora da captura -- música tocando, tag
    // encostada. Vai junto porque não dá para reconstruir depois olhando o PNG.
    contexto || {},
  );

  const entradas = ler();
  entradas.push(entrada);
  escrever(entradas);
  return entrada;
}

function remover(id) {
  const entradas = ler();
  const i = entradas.findIndex((e) => e.id === id);
  if (i === -1) return null;

  const [entrada] = entradas.splice(i, 1);
  try {
    fs.unlinkSync(path.join(DIR, entrada.arquivo));
  } catch (err) {
    // Arquivo já sumido não impede tirar do índice: o objetivo é justamente
    // deixar os dois em dia, e parar aqui manteria a entrada órfã para sempre.
    if (err.code !== 'ENOENT') throw err;
  }
  escrever(entradas);
  return entrada;
}

/** Anota (ou reanota) um print já guardado. */
function anotar(id, nota) {
  const entradas = ler();
  const entrada = entradas.find((e) => e.id === id);
  if (!entrada) return null;
  entrada.nota = String(nota || '').trim();
  escrever(entradas);
  return entrada;
}

module.exports = { DIR, INDICE, listar, resumo, guardar, remover, anotar, dimensoes, carimbo, pasta };
