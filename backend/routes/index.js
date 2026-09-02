const express = require('express');

const nfc = require('./api/nfc');
const gallery = require('./api/gallery');
const music = require('./api/music');
const services = require('./api/services');
const system = require('./api/system');
const prints = require('./api/prints');
const admin = require('./admin');

const router = express.Router();

router.use('/api', nfc);
router.use('/api/gallery', gallery);
router.use('/api/music', music);
router.use('/api/services', services);
router.use('/api/system', system);
router.use('/api/prints', prints);
router.use('/admin', admin);

module.exports = router;
