const express = require('express');

const prints = require('../../lib/prints');
const screen = require('../../lib/screen');
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
  res.json({ prints: prints.list(), summary: prints.summary() });
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
  const last = screen.lastCapture();
  if (!last) {
    return res.status(409).json({ error: 'Nenhuma captura para guardar — tire um print primeiro' });
  }
  if (req.body && req.body.at && req.body.at !== last.at) {
    return res.status(409).json({ error: 'O print mudou desde que você o viu — tire outro' });
  }

  // Contexto que só existe agora: o que estava tocando e a tag encostada. O PNG
  // não carrega nada disso, e daqui a um ano não há de onde tirar.
  let context = {};
  try {
    const player = await musicController.getStatus();
    if (player && player.title) {
      context.music = {
        album: player.album || null,
        track: player.title,
        playing: !!player.isPlaying,
      };
    }
    const tag = nfcReader.getCurrentTag();
    if (tag) context.tag = tag.uid;
  } catch (err) {
    // Contexto é enfeite: um player mudo não pode impedir de guardar a imagem.
    console.error('[prints] não consegui ler o contexto:', err.message);
  }

  try {
    const entry = prints.save({
      png: last.png,
      at: last.at,
      note: req.body && req.body.note,
      context,
    });
    res.status(201).json(entry);
  } catch (err) {
    console.error('[prints] falha ao guardar:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const entry = prints.annotate(req.params.id, req.body && req.body.note);
  if (!entry) return res.status(404).json({ error: 'Print não encontrado' });
  res.json(entry);
});

router.delete('/:id', (req, res) => {
  try {
    const entry = prints.remove(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Print não encontrado' });
    res.json({ ok: true, removido: entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
