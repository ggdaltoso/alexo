const express = require('express');

const { PORT, ehProducao } = require('../config');
const state = require('../lib/state');
const prints = require('../lib/prints');
const servicos = require('../lib/servicos');

const paginaInicial = require('../views/admin/home');
const paginaMusica = require('../views/admin/musica');
const paginaGaleria = require('../views/admin/galeria');
const paginaPrints = require('../views/admin/prints');
const blocoServicos = require('../views/admin/blocos/servicos');

const router = express.Router();

/** Vazio em produção, onde o admin sai do próprio backend e a origem é a mesma. */
function baseDaApi(req) {
  return ehProducao ? '' : `http://${req.hostname}:${PORT}`;
}

router.get('/', (req, res) => {
  const tags = state.getTagMappings();
  // Mapeamento apontando para álbum que sumiu: o sintoma sem isso é "encostei a
  // tag e não tocou", que não sugere nada sobre a causa.
  const tagsQuebradas = tags.filter((t) => state.getTracksByAlbum(t.album).length === 0);

  res.send(paginaInicial({
    apiBase: baseDaApi(req),
    imagens: state.getGallery().length,
    faixas: state.getTracks().length,
    albuns: state.getAlbums().length,
    tags,
    tagsQuebradas,
    subiuEm: new Date(Date.now() - process.uptime() * 1000),
  }));
});

router.get('/music', (req, res) => {
  const mappings = state.getTagMappings().map((m) => ({
    uid: m.uid,
    album: m.album,
    qtd: state.getTracksByAlbum(m.album).length,
  }));

  res.send(paginaMusica({ apiBase: baseDaApi(req), albums: state.getAlbums(), mappings }));
});

router.get('/gallery', (req, res) => {
  res.send(paginaGaleria({ apiBase: baseDaApi(req), images: state.getGallery() }));
});

router.get('/prints', (req, res) => {
  res.send(paginaPrints({
    apiBase: baseDaApi(req),
    lista: prints.listar(),
    resumo: prints.resumo(),
  }));
});

/*
 * Fragmentos.
 *
 * Pedaços de HTML sem página em volta, para o htmx trocar no lugar. Ficam sob
 * /admin/blocos para não se confundirem com as páginas nem com a API JSON --
 * o que volta daqui não serve para mais nada além de ser inserido no DOM.
 */
router.get('/blocos/servicos', async (req, res) => {
  res.send(blocoServicos(await servicos.listar()));
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
router.post('/blocos/servicos/:chave/:acao', async (req, res) => {
  let plano;
  try {
    plano = servicos.executar(req.params.chave, req.params.acao);
  } catch (err) {
    return res.status(400).send(`<div class="linha"><span class="k erro">${err.message}</span></div>`);
  }

  if (plano.suicida) {
    res.send(blocoServicos(await servicos.listar()));
    setTimeout(() => {
      plano.rodar().catch((err) => console.error('[servicos] restart falhou:', err.message));
    }, 250);
    return;
  }

  try {
    await plano.rodar();
  } catch (err) {
    console.error(`[servicos] ${req.params.acao} em ${req.params.chave} falhou:`, err.message);
  }
  res.send(blocoServicos(await servicos.listar()));
});

module.exports = router;
