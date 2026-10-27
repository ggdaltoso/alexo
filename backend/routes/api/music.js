const express = require('express');
const fs = require('fs');

const wsServer = require('../../lib/ws');
const state = require('../../lib/state');
const musicCatalog = require('../../lib/musicCatalog');
const musicController = require('../../lib/musicController');
const nfcReader = require('../../lib/nfcReader');

const router = express.Router();

router.get('/albums', (req, res) => {
  const albums = state.getAlbums().map((album) => ({
    album,
    trackCount: state.getTracksByAlbum(album).length,
  }));
  res.json(albums);
});

router.get('/tracks', (req, res) => {
  const { album } = req.query;
  res.json(album ? state.getTracksByAlbum(album) : state.getTracks());
});

/** Revarre uploads/music/ e regrava o catálogo. Idempotente. */
router.post('/import', (req, res) => {
  const tracks = musicCatalog.scan();
  if (!tracks.length) {
    return res.status(400).json({ error: 'Nenhum .mp3 encontrado em uploads/music' });
  }
  const { added, removed } = musicCatalog.diff(state.getTracks(), tracks);
  state.replaceTracks(tracks);
  wsServer.broadcast({ type: 'music_tracks_updated' });
  res.json({ total: tracks.length, added: added.length, removed: removed.length });
});

router.get('/tags', (req, res) => {
  res.json(state.getTagMappings());
});

router.post('/tags', (req, res) => {
  const { uid, album } = req.body || {};
  if (!uid || !album) return res.status(400).json({ error: 'uid e album são obrigatórios' });
  // Recusar álbum inexistente aqui evita um mapeamento que só falharia na hora
  // de encostar a tag, longe do lugar onde o erro foi cometido.
  if (!state.getTracksByAlbum(album).length) {
    return res.status(400).json({ error: `Álbum "${album}" não tem faixas no catálogo` });
  }
  const mapping = state.setTagMapping({ uid: String(uid).toUpperCase(), album });
  wsServer.broadcast({ type: 'music_tags_updated' });
  res.status(201).json(mapping);
});

router.delete('/tags/:uid', (req, res) => {
  const uid = req.params.uid.toUpperCase();
  const removed = state.removeTagMapping(uid);
  if (!removed) return res.status(404).json({ error: 'Tag não mapeada' });
  const imagem = state.tagImagePath(uid);
  if (imagem) fs.unlink(imagem, () => {});
  wsServer.broadcast({ type: 'music_tags_updated' });
  res.json({ ok: true });
});

/**
 * Imagem do adesivo. Chega já recortada pelo editor do admin (um PNG quadrado
 * desenhado no canvas), então aqui é só conferir e gravar.
 */
router.put('/tags/:uid/imagem', express.raw({ type: 'image/png', limit: '5mb' }), (req, res) => {
  const uid = req.params.uid.toUpperCase();
  const destino = state.tagImagePath(uid);
  if (!destino || !state.getTagMapping(uid)) return res.status(404).json({ error: 'Tag não mapeada' });
  // Assinatura do PNG: o content-type sozinho é só o que o cliente disse.
  if (!Buffer.isBuffer(req.body) || req.body.toString('latin1', 1, 4) !== 'PNG') {
    return res.status(400).json({ error: 'Esperava uma imagem PNG' });
  }
  fs.writeFile(destino, req.body, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ url: state.getTagImageUrl(uid) });
  });
});

/** Volta a tag para o adesivo de tema. */
router.delete('/tags/:uid/imagem', (req, res) => {
  const destino = state.tagImagePath(req.params.uid.toUpperCase());
  if (!destino) return res.status(404).json({ error: 'Tag não mapeada' });
  fs.unlink(destino, (err) => {
    if (err && err.code !== 'ENOENT') return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

/** Tag encostada no leitor AGORA. É o que deixa o admin preencher o UID sozinho. */
router.get('/reader', (req, res) => {
  res.json({ tag: nfcReader.getCurrentTag(), running: nfcReader.isRunning() });
});

router.get('/player/status', async (req, res) => {
  res.json(await musicController.getStatus());
});

const playerActions = {
  play: (body) => musicController.play(body.album, body.trackId),
  pause: () => musicController.pause(),
  resume: () => musicController.resume(),
  restart: () => musicController.restart(),
  next: () => musicController.next(),
  previous: () => musicController.previous(),
  volume: (body) => musicController.setVolume(body.value),
  // stopPlayback, NÃO stop: `musicController.stop()` desliga o controller
  // inteiro, leitor NFC junto. Ver o comentário em lib/musicController.js.
  stop: () => musicController.stopPlayback(),
};

// O que acompanha a ação no log. Só o admin chama estas rotas -- a tela não tem
// controles -- e sem esta linha uma pausa do admin era indistinguível, no
// journal, de uma pausa que ninguém pediu. Em 13/10/2026 o "Parar" só pôde ser
// deduzido pelo estado zerado do player.
function detalheDaAcao(name, body) {
  if (name === 'play') return ` — ${body.album}${body.trackId ? ` / ${body.trackId}` : ''}`;
  if (name === 'volume') return ` — ${body.value}`;
  return '';
}

router.post('/player/:action', async (req, res) => {
  const action = playerActions[req.params.action];
  if (!action) return res.status(404).json({ error: `Ação desconhecida: ${req.params.action}` });
  console.log(`[music] admin: ${req.params.action}${detalheDaAcao(req.params.action, req.body || {})}`);
  try {
    const status = await action(req.body || {});
    // status nulo = player indisponível (sem mpv). Não é erro do pedido.
    res.json(status || (await musicController.getStatus()));
  } catch (err) {
    console.error(`[music] admin: ${req.params.action} falhou: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
