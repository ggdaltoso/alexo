const fs = require('fs');
const path = require('path');

const { DATA_DIR } = require('../config');
const GALLERY_FILE = path.join(DATA_DIR, 'gallery.json');
const TRACKS_FILE = path.join(DATA_DIR, 'music-tracks.json');
const TAGS_FILE = path.join(DATA_DIR, 'nfc-tags.json');

// data/ não é sincronizado pelo deploy -- ver o comentário no config.js.
fs.mkdirSync(DATA_DIR, { recursive: true });

let state = {
  message: null,
  // Estado do player: em memória, NUNCA em disco. A posição de reprodução muda o
  // tempo todo, e persistir a cada tick faria escrita constante no cartão SD do
  // Pi Zero. Mesmo tratamento que `message` já recebe.
  player: {
    album: null,
    trackId: null,
    trackIndex: 0,
    trackCount: 0,
    title: null,
    filename: null,
    isPlaying: false,
    position: 0,
    positionAt: 0,
    duration: null,
    volume: 100,
    activeTagUid: null,
    // Última tag pausada. É o que permite distinguir "recolocou a mesma tag"
    // (retoma de onde parou) de "encostou outra" (começa do zero).
    pausedUid: null,
  },
};

function getState() {
  return state;
}

function updateMessage({ type, message }) {
  state.message = { type, message, timestamp: Date.now() };
}

// Gallery

function readGallery() {
  try {
    return JSON.parse(fs.readFileSync(GALLERY_FILE, 'utf-8'));
  } catch (err) {
    // Arquivo ainda não existe é o caso normal na primeira execução.
    // Qualquer outro erro (JSON corrompido, permissão) precisa aparecer: tratar
    // como "galeria vazia" faria a próxima escrita apagar tudo em silêncio.
    if (err.code !== 'ENOENT') {
      console.error(`Falha ao ler ${GALLERY_FILE}:`, err.message);
    }
    return [];
  }
}

function writeGallery(items) {
  fs.writeFileSync(GALLERY_FILE, JSON.stringify(items, null, 2));
}

function getGallery() {
  return readGallery();
}

function addGalleryItem(item) {
  const items = readGallery();
  items.push(item);
  writeGallery(items);
  return item;
}

function removeGalleryItem(id) {
  const items = readGallery();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const [removed] = items.splice(idx, 1);
  writeGallery(items);
  return removed;
}

function reorderGallery(updates) {
  const items = readGallery();
  for (const { id, order } of updates) {
    const item = items.find((i) => i.id === id);
    if (item) item.order = order;
  }
  writeGallery(items);
  return items;
}

// Catálogo de músicas
//
// Mesmo padrão da galeria: o JSON é a fonte da verdade e cada operação reabre o
// arquivo. Aceitável pelo volume de escrita (rara), mas é o motivo de
// replaceTracks existir -- ver o comentário lá.

function readTracks() {
  try {
    return JSON.parse(fs.readFileSync(TRACKS_FILE, 'utf-8'));
  } catch (err) {
    // Igual à galeria: ENOENT é o caso normal antes da primeira importação;
    // qualquer outro erro precisa aparecer, porque tratar como "catálogo vazio"
    // faria a próxima escrita apagar tudo em silêncio.
    if (err.code !== 'ENOENT') {
      console.error(`Falha ao ler ${TRACKS_FILE}:`, err.message);
    }
    return [];
  }
}

function writeTracks(tracks) {
  fs.writeFileSync(TRACKS_FILE, JSON.stringify(tracks, null, 2));
}

function getTracks() {
  return readTracks();
}

/**
 * Substitui o catálogo inteiro numa única escrita.
 *
 * Exigido pelo importador: chamar addTrack() 404 vezes reescreveria o JSON
 * inteiro 404 vezes, que é exatamente o padrão de I/O que a galeria já ilustra
 * como problema no cartão SD do Pi Zero.
 */
function replaceTracks(tracks) {
  writeTracks(tracks);
  return tracks;
}

function addTrack(track) {
  const tracks = readTracks();
  tracks.push(track);
  writeTracks(tracks);
  return track;
}

function removeTrack(id) {
  const tracks = readTracks();
  const idx = tracks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const [removed] = tracks.splice(idx, 1);
  writeTracks(tracks);
  return removed;
}

/** Nomes de álbum distintos, em ordem alfabética. */
function getAlbums() {
  const names = new Set(readTracks().map((t) => t.album));
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * Faixas de um álbum, ordenadas por `filename`.
 *
 * A ordenação por filename é o que preserva a numeração `01 ...`, `02 ...` que o
 * importador lê do disco -- ordenar por `title` perderia isso, porque o número
 * de faixa é justamente o que ele remove do título.
 */
function getTracksByAlbum(album) {
  return readTracks()
    .filter((t) => t.album === album)
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

// Mapeamento tag -> álbum
//
// A chave é o nome do álbum (= nome da pasta), não um trackId: a tag representa
// o álbum inteiro, não uma faixa. É o que dá alvo real para anterior/próxima.

function readTagMappings() {
  try {
    return JSON.parse(fs.readFileSync(TAGS_FILE, 'utf-8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Falha ao ler ${TAGS_FILE}:`, err.message);
    }
    return [];
  }
}

function writeTagMappings(mappings) {
  fs.writeFileSync(TAGS_FILE, JSON.stringify(mappings, null, 2));
}

function getTagMappings() {
  return readTagMappings();
}

function getTagMapping(uid) {
  return readTagMappings().find((m) => m.uid === uid) || null;
}

/** Upsert: cadastrar a mesma tag de novo troca o álbum em vez de duplicar. */
function setTagMapping({ uid, album }) {
  const mappings = readTagMappings();
  const existing = mappings.find((m) => m.uid === uid);
  if (existing) {
    existing.album = album;
  } else {
    mappings.push({ uid, album });
  }
  writeTagMappings(mappings);
  return { uid, album };
}

function removeTagMapping(uid) {
  const mappings = readTagMappings();
  const idx = mappings.findIndex((m) => m.uid === uid);
  if (idx === -1) return null;
  const [removido] = mappings.splice(idx, 1);
  writeTagMappings(mappings);
  return removido;
}

// Estado do player (memória)

function getPlayerState() {
  return state.player;
}

function setPlayerState(partial) {
  state.player = { ...state.player, ...partial };
  return state.player;
}

module.exports = {
  getState,
  updateMessage,
  getGallery,
  addGalleryItem,
  removeGalleryItem,
  reorderGallery,
  getTracks,
  replaceTracks,
  addTrack,
  removeTrack,
  getAlbums,
  getTracksByAlbum,
  getTagMappings,
  getTagMapping,
  setTagMapping,
  removeTagMapping,
  getPlayerState,
  setPlayerState,
};
