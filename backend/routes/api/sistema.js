/**
 * Desligar/reiniciar a máquina e tirar print da tela.
 */
const express = require('express');

const servicos = require('../../lib/servicos');
const tela = require('../../lib/tela');

const router = express.Router();

/**
 * Desliga ou reinicia a máquina.
 *
 * Sempre responde antes de executar: o systemd derruba este processo junto com
 * o resto, então esperar o systemctl terminar faria a resposta morrer no meio e
 * o admin mostraria erro num comando que deu certo. Mesmo motivo do restart do
 * próprio backend, só que aqui vale para as duas ações.
 */
router.post('/:acao', (req, res) => {
  let plano;
  try {
    plano = servicos.sistema(req.params.acao);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  res.json({ ok: true, rotulo: plano.rotulo, volta: plano.volta });
  setTimeout(() => {
    plano.rodar().catch((err) => console.error(`[sistema] ${req.params.acao} falhou:`, err.message));
  }, 250);
});

/**
 * Print da tela do Pi.
 *
 * GET porque o que volta é a imagem, e não o resultado de uma ação: abrir a URL
 * no navegador já mostra a tela do Pi, sem admin e sem JS no meio. Não colide
 * com o `POST /api/system/:acao` acima -- método diferente, e `screenshot` não
 * é uma ação da tabela de lá.
 *
 * A captura leva ~0,8 s neste Pi. O erro vai como JSON mesmo numa rota que
 * responde PNG: quem chama precisa conseguir ler o motivo, e "Can't open X
 * display" é a diferença entre "o display caiu" e "o backend caiu".
 */
router.get('/screenshot', async (req, res) => {
  try {
    const { png, em } = await tela.capturar();
    res.type('png');
    // Retrato de um instante: guardar em cache é justamente o que não serve.
    res.set('Cache-Control', 'no-store');
    // A hora da captura vai no cabeçalho para o cliente devolver no "guardar":
    // é assim que o backend confere que o print salvo é o que está no preview,
    // e não um mais novo que tenha entrado no meio. Ver POST /api/prints.
    res.set('X-Print-Em', em);
    res.send(png);
  } catch (err) {
    console.error('[tela] print falhou:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
