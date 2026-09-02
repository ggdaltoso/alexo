/**
 * Galeria de fotos: upload, ordem e remoção.
 *
 * Convenção seguida também pelas outras rotas: broadcast no WebSocket depois de
 * toda mutação, e 404 com corpo JSON.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const { GALERIA_DIR } = require('../../config');
const wsServer = require('../../lib/ws');
const state = require('../../lib/state');
const { randomUUID } = require('../../lib/ids');
const { reduzirImagem } = require('../../lib/imagem');

// uploads/ e data/ são deliberadamente excluídos do deploy (é conteúdo que vive
// no Pi, não no repo), então nada os cria por lá -- num Pi novo, ou se alguém
// apagar a pasta, o primeiro upload falhava com ENOENT depois de já ter aceitado
// o arquivo. Criar na subida é mais barato que documentar um passo manual.
fs.mkdirSync(GALERIA_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, GALERIA_DIR),
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

const router = express.Router();

router.get('/', (req, res) => {
  res.json(state.getGallery());
});

router.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  // Antes de registrar no catálogo: se a redução demorar, é melhor o upload
  // parecer lento do que a galeria exibir a foto gigante por alguns segundos.
  await reduzirImagem(req.file.path);

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

router.put('/reorder', (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'Expected array' });
  const items = state.reorderGallery(updates);
  wsServer.broadcast({ type: 'gallery_updated' });
  res.json(items);
});

router.delete('/:id', (req, res) => {
  const removed = state.removeGalleryItem(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Imagem não encontrada' });

  const filePath = path.join(GALERIA_DIR, removed.filename);
  fs.unlink(filePath, () => {});

  wsServer.broadcast({ type: 'gallery_updated' });
  res.json({ ok: true });
});

module.exports = router;
