/**
 * Onde cada grupo de rotas é pendurado.
 *
 * Os caminhos dentro de cada módulo são relativos ao prefixo daqui: quem
 * procura /api/music/tags encontra `/tags` no routes/api/music.js. O nfc é a
 * exceção e monta em /api inteiro -- ver o comentário no próprio arquivo.
 */
const express = require('express');

const nfc = require('./api/nfc');
const gallery = require('./api/gallery');
const music = require('./api/music');
const servicos = require('./api/servicos');
const sistema = require('./api/sistema');
const prints = require('./api/prints');
const admin = require('./admin');

const router = express.Router();

router.use('/api', nfc);
router.use('/api/gallery', gallery);
router.use('/api/music', music);
router.use('/api/services', servicos);
router.use('/api/system', sistema);
router.use('/api/prints', prints);
router.use('/admin', admin);

module.exports = router;
