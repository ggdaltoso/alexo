const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const GALLERY_FILE = path.join(DATA_DIR, 'gallery.json');

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

module.exports = { getState, updateMessage, getGallery, addGalleryItem, removeGalleryItem, reorderGallery };
