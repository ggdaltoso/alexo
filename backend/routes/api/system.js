const express = require('express');

const services = require('../../lib/services');
const screen = require('../../lib/screen');

const router = express.Router();

/**
 * Desliga ou reinicia a máquina.
 *
 * Sempre responde antes de executar: o systemd derruba este processo junto com
 * o resto, então esperar o systemctl terminar faria a resposta morrer no meio e
 * o admin mostraria erro num comando que deu certo. Mesmo motivo do restart do
 * próprio backend, só que aqui vale para as duas ações.
 */
router.post('/:action', (req, res) => {
  let plan;
  try {
    plan = services.system(req.params.action);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  res.json({ ok: true, label: plan.label, comesBack: plan.comesBack });
  setTimeout(() => {
    plan.run().catch((err) => console.error(`[system] ${req.params.action} falhou:`, err.message));
  }, 250);
});

/**
 * Print da tela do Pi.
 *
 * GET porque o que volta é a imagem, e não o resultado de uma ação: abrir a URL
 * no navegador já mostra a tela do Pi, sem admin e sem JS no meio. Não colide
 * com o `POST /api/system/:action` acima -- método diferente, e `screenshot` não
 * é uma ação da tabela de lá.
 *
 * A captura leva ~0,8 s neste Pi. O erro vai como JSON mesmo numa rota que
 * responde PNG: quem chama precisa conseguir ler o motivo, e "Can't open X
 * display" é a diferença entre "o display caiu" e "o backend caiu".
 */
router.get('/screenshot', async (req, res) => {
  try {
    const { png, at } = await screen.capture();
    res.type('png');
    // Retrato de um instante: guardar em cache é justamente o que não serve.
    res.set('Cache-Control', 'no-store');
    // A hora da captura vai no cabeçalho para o cliente devolver no "guardar":
    // é assim que o backend confere que o print salvo é o que está no preview,
    // e não um mais novo que tenha entrado no meio. Ver POST /api/prints.
    res.set('X-Print-Em', at);
    res.send(png);
  } catch (err) {
    console.error('[screen] print falhou:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
