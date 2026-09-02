const express = require('express');

const services = require('../../lib/services');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    res.json(await services.list());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Liga, desliga ou reinicia um serviço.
 *
 * A unidade nunca vem do pedido -- `chave` é procurada na tabela do
 * services.js. Ver o comentário de lá sobre por que isso importa aqui.
 */
router.post('/:key/:action', async (req, res) => {
  let plan;
  try {
    plan = services.prepare(req.params.key, req.params.action);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Reiniciar o próprio backend faz o systemd mandar SIGTERM neste processo:
  // se a gente esperasse o systemctl terminar, a resposta morreria junto e o
  // admin veria um erro de rede num restart que deu certo. Responde primeiro,
  // reinicia depois -- a folga é só para o socket esvaziar.
  if (plan.selfKilling) {
    res.json({ ok: true, reiniciandoOBackend: true });
    setTimeout(() => {
      plan.run().catch((err) => console.error('[services] restart falhou:', err.message));
    }, 250);
    return;
  }

  try {
    await plan.run();
    res.json({ ok: true, service: await services.statusDe(req.params.key) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
