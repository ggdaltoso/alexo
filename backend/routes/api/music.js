/**
 * Catálogo, tags e player.
 *
 * Convenções da galeria mantidas: broadcast após mutação, 404 com corpo JSON.
 * A diferença é que faixas não sobem por formulário -- vêm do disco, via
 * importador. Ver lib/musicCatalog.js.
 */
const express = require('express');

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
  const { novos, sumidos } = musicCatalog.diff(state.getTracks(), tracks);
  state.replaceTracks(tracks);
  wsServer.broadcast({ type: 'music_tracks_updated' });
  res.json({ total: tracks.length, novos: novos.length, sumidos: sumidos.length });
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
  const removed = state.removeTagMapping(req.params.uid.toUpperCase());
  if (!removed) return res.status(404).json({ error: 'Tag não mapeada' });
  wsServer.broadcast({ type: 'music_tags_updated' });
  res.json({ ok: true });
});

/** Tag encostada no leitor AGORA. É o que deixa o admin preencher o UID sozinho. */
router.get('/reader', (req, res) => {
  res.json({ tag: nfcReader.getCurrentTag(), running: nfcReader.isRunning() });
});

router.get('/player/status', async (req, res) => {
  res.json(await musicController.getStatus());
});

const acoesDoPlayer = {
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

router.post('/player/:acao', async (req, res) => {
  const acao = acoesDoPlayer[req.params.acao];
  if (!acao) return res.status(404).json({ error: `Ação desconhecida: ${req.params.acao}` });
  try {
    const status = await acao(req.body || {});
    // status nulo = player indisponível (sem mpv). Não é erro do pedido.
    res.json(status || (await musicController.getStatus()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
