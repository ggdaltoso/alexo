require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const wsServer = require('./ws');
const state = require('./state');
const { randomUUID } = require('./ids');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

const UPLOADS_DIR = path.join(__dirname, 'uploads', 'gallery');

// uploads/ e data/ são deliberadamente excluídos do deploy (é conteúdo que vive
// no Pi, não no repo), então nada os cria por lá -- num Pi novo, ou se alguém
// apagar a pasta, o primeiro upload falhava com ENOENT depois de já ter aceitado
// o arquivo. Criar na subida é mais barato que documentar um passo manual.
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Apenas imagens são permitidas'));
  },
});

if (NODE_ENV === 'development') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });
}

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// NFC
app.post('/api/nfc', (req, res) => {
  const { type, message } = req.body;
  if (typeof type !== 'string' || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  // `type` no corpo da requisição é a severidade ('info' | 'warning'), e no
  // broadcast ele vira `messageType`: no WebSocket o campo `type` é o
  // discriminador da união e não pode carregar outra coisa. Ver ws.js.
  wsServer.broadcast({
    type: 'nfc_message',
    messageType: type,
    message,
    timestamp: Date.now(),
  });
  res.status(200).json({ ok: true });
});

// Gallery API
app.get('/api/gallery', (req, res) => {
  res.json(state.getGallery());
});

app.post('/api/gallery/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  const item = {
    id: path.basename(req.file.filename, path.extname(req.file.filename)),
    filename: req.file.filename,
    url: `/uploads/gallery/${req.file.filename}`,
    order: state.getGallery().length + 1,
    uploadedAt: Date.now(),
  };

  state.addGalleryItem(item);
  wsServer.broadcast({ type: 'gallery_updated' });
  res.status(201).json(item);
});

app.put('/api/gallery/reorder', (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'Expected array' });
  const items = state.reorderGallery(updates);
  wsServer.broadcast({ type: 'gallery_updated' });
  res.json(items);
});

app.delete('/api/gallery/:id', (req, res) => {
  const removed = state.removeGalleryItem(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Imagem não encontrada' });

  const filePath = path.join(UPLOADS_DIR, removed.filename);
  fs.unlink(filePath, () => {});

  wsServer.broadcast({ type: 'gallery_updated' });
  res.json({ ok: true });
});

// Admin page
app.get('/admin/gallery', (req, res) => {
  const backendBase = `http://${req.hostname}:${PORT}`;
  const apiBase = NODE_ENV === 'production' ? '' : backendBase;

  const images = state.getGallery();
  const imageCards = images.length === 0
    ? '<p style="color:#888;text-align:center;margin:2rem 0">Nenhuma imagem cadastrada.</p>'
    : [...images].sort((a, b) => a.order - b.order).map((img, i, arr) => `
      <div class="card" data-id="${img.id}" data-order="${img.order}">
        <span class="order">#${img.order}</span>
        <img src="${apiBase}${img.url}" alt="${img.filename}" />
        <div class="move-btns">
          <button onclick="move('${img.id}', -1)" ${i === 0 ? 'disabled' : ''}>↑ Subir</button>
          <button onclick="move('${img.id}', 1)" ${i === arr.length - 1 ? 'disabled' : ''}>↓ Descer</button>
        </div>
        <button class="del" onclick="deleteImage('${img.id}')">✕ Remover</button>
      </div>`).join('');

  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Galeria — Admin</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #111; color: #eee; margin: 0; padding: 2rem; }
    h1 { margin: 0 0 1.5rem; font-size: 1.4rem; }
    .upload-form { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; }
    .upload-form label { display: block; margin-bottom: .5rem; font-size: .9rem; color: #aaa; }
    .upload-form input[type=file] { width: 100%; padding: .5rem; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #eee; }
    .upload-form button { margin-top: 1rem; padding: .6rem 1.4rem; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: .95rem; }
    .upload-form button:hover { background: #2563eb; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; }
    .card { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; overflow: hidden; position: relative; }
    .card img { width: 100%; height: 150px; object-fit: cover; display: block; }
    .order { position: absolute; top: 6px; left: 6px; background: rgba(0,0,0,.65); color: #fff; font-size: .75rem; padding: 2px 6px; border-radius: 4px; }
    .move-btns { display: flex; }
    .move-btns button { flex: 1; padding: .4rem; background: #374151; color: #fff; border: none; cursor: pointer; font-size: .85rem; }
    .move-btns button:hover { background: #4b5563; }
    .move-btns button:disabled { opacity: .3; cursor: default; }
    .del { width: 100%; padding: .5rem; background: #ef4444; color: #fff; border: none; cursor: pointer; font-size: .85rem; }
    .del:hover { background: #dc2626; }
    #status { margin-top: 1rem; font-size: .9rem; color: #4ade80; min-height: 1.2rem; }
  </style>
</head>
<body>
  <h1>Galeria — Gerenciar Imagens</h1>

  <div class="upload-form">
    <label for="fileInput">Adicionar imagem (JPG, PNG, GIF, WebP — máx. 20 MB)</label>
    <input type="file" id="fileInput" accept="image/*" multiple />
    <button onclick="uploadFiles()">Enviar</button>
    <div id="status"></div>
  </div>

  <div class="grid" id="grid">${imageCards}</div>

  <script>
    const API = '${apiBase}';

    async function uploadFiles() {
      const input = document.getElementById('fileInput');
      const status = document.getElementById('status');
      if (!input.files.length) { status.textContent = 'Selecione pelo menos um arquivo.'; return; }
      status.textContent = 'Enviando...';
      for (const file of input.files) {
        const fd = new FormData();
        fd.append('image', file);
        const r = await fetch(API + '/api/gallery/upload', { method: 'POST', body: fd });
        if (!r.ok) { status.textContent = 'Erro ao enviar ' + file.name; return; }
      }
      status.textContent = 'Enviado com sucesso!';
      input.value = '';
      setTimeout(() => location.reload(), 800);
    }

    async function deleteImage(id) {
      if (!confirm('Remover esta imagem?')) return;
      const r = await fetch(API + '/api/gallery/' + id, { method: 'DELETE' });
      if (r.ok) location.reload();
      else alert('Erro ao remover imagem.');
    }

    async function move(id, direction) {
      const cards = [...document.querySelectorAll('.card')];
      const idx = cards.findIndex(c => c.dataset.id === id);
      const swapIdx = idx + direction;
      if (swapIdx < 0 || swapIdx >= cards.length) return;

      const a = cards[idx];
      const b = cards[swapIdx];
      const orderA = Number(a.dataset.order);
      const orderB = Number(b.dataset.order);

      const updates = [
        { id: a.dataset.id, order: orderB },
        { id: b.dataset.id, order: orderA },
      ];

      const r = await fetch(API + '/api/gallery/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (r.ok) location.reload();
      else alert('Erro ao reordenar.');
    }
  </script>
</body>
</html>`);
});

// Serve frontend in production
if (NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

const server = http.createServer(app);
wsServer.attach(server);

server.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  if (NODE_ENV === 'production') {
    console.log(`Frontend available at http://localhost:${PORT}`);
  }
  console.log(`Admin da galeria: http://localhost:${PORT}/admin/gallery`);
});
