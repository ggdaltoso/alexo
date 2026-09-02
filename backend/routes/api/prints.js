const express = require('express');

const prints = require('../../lib/prints');
const tela = require('../../lib/tela');
const musicController = require('../../lib/musicController');
const nfcReader = require('../../lib/nfcReader');

const router = express.Router();

/*
 * Histórico de prints.
 *
 * Capturar e guardar são separados de propósito. O alias do Pi sempre escrevia
 * um arquivo, e é por isso que a home juntou dezenas de prints sem que ninguém
 * decidisse guardá-los. Aqui a captura só mostra; guardar é um segundo clique,
 * depois de olhar.
 */
router.get('/', (req, res) => {
  res.json({ prints: prints.listar(), resumo: prints.resumo() });
});

/**
 * Guarda no Pi o print que está no preview.
 *
 * O corpo manda o `em` que veio no cabeçalho X-Print-Em da captura. Se não
 * bater com a última, alguém capturou de novo no meio do caminho e o que seria
 * salvo não é o que está na tela de quem clicou -- melhor recusar e pedir outro
 * print do que gravar a imagem errada com a nota certa.
 */
router.post('/', async (req, res) => {
  const ultima = tela.ultimaCaptura();
  if (!ultima) {
    return res.status(409).json({ error: 'Nenhuma captura para guardar — tire um print primeiro' });
  }
  if (req.body && req.body.em && req.body.em !== ultima.em) {
    return res.status(409).json({ error: 'O print mudou desde que você o viu — tire outro' });
  }

  // Contexto que só existe agora: o que estava tocando e a tag encostada. O PNG
  // não carrega nada disso, e daqui a um ano não há de onde tirar.
  let contexto = {};
  try {
    const player = await musicController.getStatus();
    if (player && player.title) {
      contexto.musica = {
        album: player.album || null,
        faixa: player.title,
        tocando: !!player.isPlaying,
      };
    }
    const tag = nfcReader.getCurrentTag();
    if (tag) contexto.tag = tag.uid;
  } catch (err) {
    // Contexto é enfeite: um player mudo não pode impedir de guardar a imagem.
    console.error('[prints] não consegui ler o contexto:', err.message);
  }

  try {
    const entrada = prints.guardar({
      png: ultima.png,
      em: ultima.em,
      nota: req.body && req.body.nota,
      contexto,
    });
    res.status(201).json(entrada);
  } catch (err) {
    console.error('[prints] falha ao guardar:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const entrada = prints.anotar(req.params.id, req.body && req.body.nota);
  if (!entrada) return res.status(404).json({ error: 'Print não encontrado' });
  res.json(entrada);
});

router.delete('/:id', (req, res) => {
  try {
    const entrada = prints.remover(req.params.id);
    if (!entrada) return res.status(404).json({ error: 'Print não encontrado' });
    res.json({ ok: true, removido: entrada });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
