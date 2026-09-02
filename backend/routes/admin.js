const express = require('express');

const { PORT, isProduction } = require('../config');
const state = require('../lib/state');
const prints = require('../lib/prints');
const services = require('../lib/services');
const musicController = require('../lib/musicController');
const nfcReader = require('../lib/nfcReader');

const homePage = require('../views/admin/home');
const musicPage = require('../views/admin/music');
const galleryPage = require('../views/admin/gallery');
const printsPage = require('../views/admin/prints');
const servicesBlock = require('../views/admin/partials/services');
const deviceBlock = require('../views/admin/partials/device');

const router = express.Router();

/** Vazio em produção, onde o admin sai do próprio backend e a origem é a mesma. */
function apiBaseFor(req) {
  return isProduction ? '' : `http://${req.hostname}:${PORT}`;
}

router.get('/', (req, res) => {
  const tags = state.getTagMappings();
  // Mapeamento apontando para álbum que sumiu: o sintoma sem isso é "encostei a
  // tag e não tocou", que não sugere nada sobre a causa.
  const brokenTags = tags.filter((t) => state.getTracksByAlbum(t.album).length === 0);

  res.send(homePage({
    apiBase: apiBaseFor(req),
    imageCount: state.getGallery().length,
    trackCount: state.getTracks().length,
    albumCount: state.getAlbums().length,
    tags,
    brokenTags,
    startedAt: new Date(Date.now() - process.uptime() * 1000),
  }));
});

router.get('/music', (req, res) => {
  const mappings = state.getTagMappings().map((m) => ({
    uid: m.uid,
    album: m.album,
    count: state.getTracksByAlbum(m.album).length,
  }));

  res.send(musicPage({ apiBase: apiBaseFor(req), albums: state.getAlbums(), mappings }));
});

router.get('/gallery', (req, res) => {
  res.send(galleryPage({ apiBase: apiBaseFor(req), images: state.getGallery() }));
});

router.get('/prints', (req, res) => {
  res.send(printsPage({
    apiBase: apiBaseFor(req),
    list: prints.list(),
    summary: prints.summary(),
  }));
});

/*
 * Fragmentos.
 *
 * Pedaços de HTML sem página em volta, para o htmx trocar no lugar. Ficam sob
 * /admin/blocos para não se confundirem com as páginas nem com a API JSON --
 * o que volta daqui não serve para mais nada além de ser inserido no DOM.
 */
router.get('/partials/device', async (req, res) => {
  res.send(deviceBlock({
    reader: { tag: nfcReader.getCurrentTag(), running: nfcReader.isRunning() },
    player: await musicController.getStatus(),
  }));
});

router.get('/partials/services', async (req, res) => {
  res.send(servicesBlock(await services.list()));
});

/**
 * Executa a ação e devolve o bloco já atualizado.
 *
 * Uma resposta só, em vez de "faz" e depois "lê": era isso que o cliente fazia
 * com um setTimeout de 1,2s, chutando quanto tempo o systemd levava para
 * assentar. Aqui o estado é lido depois da ação ter terminado de fato.
 *
 * Reiniciar o próprio backend é a exceção: o plano é suicida, a resposta tem de
 * sair antes do systemd derrubar este processo. O bloco volta com o estado de
 * agora, e o polling reencontra o serviço quando ele voltar.
 */
router.post('/partials/services/:key/:action', async (req, res) => {
  let plan;
  try {
    plan = services.prepare(req.params.key, req.params.action);
  } catch (err) {
    return res.status(400).send(`<div class="row"><span class="key-cell error">${err.message}</span></div>`);
  }

  if (plan.selfKilling) {
    res.send(servicesBlock(await services.list()));
    setTimeout(() => {
      plan.run().catch((err) => console.error('[services] restart falhou:', err.message));
    }, 250);
    return;
  }

  try {
    await plan.run();
  } catch (err) {
    console.error(`[services] ${req.params.action} em ${req.params.key} falhou:`, err.message);
  }
  res.send(servicesBlock(await services.list()));
});

module.exports = router;
