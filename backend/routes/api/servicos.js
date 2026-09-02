const express = require('express');

const servicos = require('../../lib/servicos');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    res.json(await servicos.listar());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Liga, desliga ou reinicia um serviço.
 *
 * A unidade nunca vem do pedido -- `chave` é procurada na tabela do
 * servicos.js. Ver o comentário de lá sobre por que isso importa aqui.
 */
router.post('/:chave/:acao', async (req, res) => {
  let plano;
  try {
    plano = servicos.executar(req.params.chave, req.params.acao);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Reiniciar o próprio backend faz o systemd mandar SIGTERM neste processo:
  // se a gente esperasse o systemctl terminar, a resposta morreria junto e o
  // admin veria um erro de rede num restart que deu certo. Responde primeiro,
  // reinicia depois -- a folga é só para o socket esvaziar.
  if (plano.suicida) {
    res.json({ ok: true, reiniciandoOBackend: true });
    setTimeout(() => {
      plano.rodar().catch((err) => console.error('[servicos] restart falhou:', err.message));
    }, 250);
    return;
  }

  try {
    await plano.rodar();
    res.json({ ok: true, servico: await servicos.statusDe(req.params.chave) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
