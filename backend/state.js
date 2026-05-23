const fs = require('fs');
const path = require('path');

const GALLERY_FILE = path.join(__dirname, 'data', 'gallery.json');

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
  } catch {
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
