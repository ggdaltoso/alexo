/**
 * Páginas do admin.
 *
 * Aqui só se juntam os dados; o HTML mora em views/admin/. A divisão é o que
 * mantém cada metade legível -- as páginas passam de 100 linhas de template
 * cada, e antes elas ficavam no meio das rotas de API.
 */
const express = require('express');

const { PORT, ehProducao } = require('../config');
const state = require('../lib/state');
const prints = require('../lib/prints');

const paginaInicial = require('../views/admin/home');
const paginaMusica = require('../views/admin/musica');
const paginaGaleria = require('../views/admin/galeria');
const paginaPrints = require('../views/admin/prints');

const router = express.Router();

/**
 * De onde a página chama a API.
 *
 * Vazio em produção, onde o backend serve o próprio admin e a origem é a mesma.
 * Em desenvolvimento a página abre direto no backend, mas o frontend roda noutra
 * porta -- então o caminho precisa ser absoluto.
 */
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
  // O `qtd` é contado aqui para a view não precisar conhecer o state. Zero
  // faixas é o caso que a página precisa gritar: pasta renomeada depois do
  // cadastro.
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

module.exports = router;
