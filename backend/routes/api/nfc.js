/**
 * Montado em /api, e não em /api/nfc: os dois caminhos daqui não compartilham
 * prefixo -- /api/nfc e /api/nfc-tag/simulate.
 */
const express = require('express');

const wsServer = require('../../lib/ws');
const musicController = require('../../lib/musicController');

const router = express.Router();

router.post('/nfc', (req, res) => {
  const { type, message } = req.body;
  if (typeof type !== 'string' || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  // `type` no corpo da requisição é a severidade ('info' | 'warning'), e no
  // broadcast ele vira `messageType`: no WebSocket o campo `type` é o
  // discriminador da união e não pode carregar outra coisa. Ver lib/ws.js.
  wsServer.broadcast({
    type: 'nfc_message',
    messageType: type,
    message,
    timestamp: Date.now(),
  });
  res.status(200).json({ ok: true });
});

/**
 * Simula encostar/tirar uma tag.
 *
 * Existe para desenvolver o frontend numa máquina sem PN532: os eventos passam
 * exatamente pelo mesmo caminho dos do leitor real.
 */
router.post('/nfc-tag/simulate', async (req, res) => {
  const { uid, event } = req.body || {};
  if (!uid || !event) return res.status(400).json({ error: 'uid e event são obrigatórios' });
  try {
    await musicController.simulateTag(String(uid).toUpperCase(), event);
    res.json(await musicController.getStatus());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
