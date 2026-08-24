const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const GALLERY_FILE = path.join(DATA_DIR, 'gallery.json');
const TRACKS_FILE = path.join(DATA_DIR, 'music-tracks.json');

// data/ não é sincronizado pelo deploy -- ver o comentário em server.js.
fs.mkdirSync(DATA_DIR, { recursive: true });

let state = {
  message: null,
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
  const nomes = new Set(readTracks().map((t) => t.album));
  return [...nomes].sort((a, b) => a.localeCompare(b));
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
};
