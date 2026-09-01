require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { execFile } = require('child_process');
const wsServer = require('./ws');
const state = require('./state');
const { randomUUID } = require('./ids');
const musicController = require('./musicController');
const musicCatalog = require('./musicCatalog');
const nfcReader = require('./nfcReader');
const servicos = require('./servicos');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

const UPLOADS_DIR = path.join(__dirname, 'uploads', 'gallery');

// uploads/ e data/ são deliberadamente excluídos do deploy (é conteúdo que vive
// no Pi, não no repo), então nada os cria por lá -- num Pi novo, ou se alguém
// apagar a pasta, o primeiro upload falhava com ENOENT depois de já ter aceitado
// o arquivo. Criar na subida é mais barato que documentar um passo manual.
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Apenas imagens são permitidas'));
  },
});

if (NODE_ENV === 'development') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });
}

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// NFC
app.post('/api/nfc', (req, res) => {
  const { type, message } = req.body;
  if (typeof type !== 'string' || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  // `type` no corpo da requisição é a severidade ('info' | 'warning'), e no
  // broadcast ele vira `messageType`: no WebSocket o campo `type` é o
  // discriminador da união e não pode carregar outra coisa. Ver ws.js.
  wsServer.broadcast({
    type: 'nfc_message',
    messageType: type,
    message,
    timestamp: Date.now(),
  });
  res.status(200).json({ ok: true });
});

// Gallery API
app.get('/api/gallery', (req, res) => {
  res.json(state.getGallery());
});

/**
 * Reduz a foto recém-enviada para a resolução que a tela usa de fato.
 *
 * Foto de celular chega em 3468x4624. O arquivo é pequeno porque JPEG comprime
 * bem, mas o navegador precisa descomprimir para desenhar, e aí cada pixel vira
 * 4 bytes: 61 MB de RAM por foto num aparelho de 430 MB. O painel da galeria tem
 * cerca de 240x230 pixels.
 *
 * Isso não é otimização: em 25/08/2026 as cinco fotos da galeria somavam 190 MB
 * decodificados, o swap enchia e o Wi-Fi caía junto -- no BCM2835 o cartão SD e
 * o rádio dividem o controlador SDIO. Depois de reduzir, 8,2 MB.
 *
 * Feito em Python porque o Pillow já está no Pi; as alternativas em Node são
 * addons nativos que não compilam bem no ARMv6.
 *
 * Falha aqui não derruba o upload: a foto original fica, grande, e o
 * resize-gallery.py em lote conserta depois. Perder a foto seria pior.
 */
function reduzirImagem(caminho) {
  return new Promise((resolve) => {
    const script = path.join(__dirname, 'scripts', 'resize-gallery.py');
    execFile('python3', [script, '--arquivo', caminho], { timeout: 60000 }, (err, _out, stderr) => {
      if (err) {
        console.warn(`[galeria] não consegui reduzir ${path.basename(caminho)}: ${stderr || err.message}`);
      }
      resolve();
    });
  });
}

app.post('/api/gallery/upload', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  // Antes de registrar no catálogo: se a redução demorar, é melhor o upload
  // parecer lento do que a galeria exibir a foto gigante por alguns segundos.
  await reduzirImagem(req.file.path);

  const item = {
    id: path.basename(req.file.filename, path.extname(req.file.filename)),
    filename: req.file.filename,
    url: `/uploads/gallery/${req.file.filename}`,
    order: state.getGallery().length + 1,
    uploadedAt: Date.now(),
  };

  state.addGalleryItem(item);
  wsServer.broadcast({ type: 'gallery_updated' });
  res.status(201).json(item);
});

app.put('/api/gallery/reorder', (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'Expected array' });
  const items = state.reorderGallery(updates);
  wsServer.broadcast({ type: 'gallery_updated' });
  res.json(items);
});

app.delete('/api/gallery/:id', (req, res) => {
  const removed = state.removeGalleryItem(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Imagem não encontrada' });

  const filePath = path.join(UPLOADS_DIR, removed.filename);
  fs.unlink(filePath, () => {});

  wsServer.broadcast({ type: 'gallery_updated' });
  res.json({ ok: true });
});

// Música
//
// Convenções da galeria mantidas: broadcast após mutação, 404 com corpo JSON.
// A diferença é que faixas não sobem por formulário -- vêm do disco, via
// importador. Ver musicCatalog.js.

app.get('/api/music/albums', (req, res) => {
  const albums = state.getAlbums().map((album) => ({
    album,
    trackCount: state.getTracksByAlbum(album).length,
  }));
  res.json(albums);
});

app.get('/api/music/tracks', (req, res) => {
  const { album } = req.query;
  res.json(album ? state.getTracksByAlbum(album) : state.getTracks());
});

/** Revarre uploads/music/ e regrava o catálogo. Idempotente. */
app.post('/api/music/import', (req, res) => {
  const tracks = musicCatalog.scan();
  if (!tracks.length) {
    return res.status(400).json({ error: 'Nenhum .mp3 encontrado em uploads/music' });
  }
  const { novos, sumidos } = musicCatalog.diff(state.getTracks(), tracks);
  state.replaceTracks(tracks);
  wsServer.broadcast({ type: 'music_tracks_updated' });
  res.json({ total: tracks.length, novos: novos.length, sumidos: sumidos.length });
});

app.get('/api/music/tags', (req, res) => {
  res.json(state.getTagMappings());
});

app.post('/api/music/tags', (req, res) => {
  const { uid, album } = req.body || {};
  if (!uid || !album) return res.status(400).json({ error: 'uid e album são obrigatórios' });
  // Recusar álbum inexistente aqui evita um mapeamento que só falharia na hora
  // de encostar a tag, longe do lugar onde o erro foi cometido.
  if (!state.getTracksByAlbum(album).length) {
    return res.status(400).json({ error: `Álbum "${album}" não tem faixas no catálogo` });
  }
  const mapping = state.setTagMapping({ uid: String(uid).toUpperCase(), album });
  wsServer.broadcast({ type: 'music_tags_updated' });
  res.status(201).json(mapping);
});

app.delete('/api/music/tags/:uid', (req, res) => {
  const removed = state.removeTagMapping(req.params.uid.toUpperCase());
  if (!removed) return res.status(404).json({ error: 'Tag não mapeada' });
  wsServer.broadcast({ type: 'music_tags_updated' });
  res.json({ ok: true });
});

/** Tag encostada no leitor AGORA. É o que deixa o admin preencher o UID sozinho. */
app.get('/api/music/reader', (req, res) => {
  res.json({ tag: nfcReader.getCurrentTag(), running: nfcReader.isRunning() });
});

app.get('/api/music/player/status', async (req, res) => {
  res.json(await musicController.getStatus());
});

const acoesDoPlayer = {
  play: (body) => musicController.play(body.album, body.trackId),
  pause: () => musicController.pause(),
  resume: () => musicController.resume(),
  restart: () => musicController.restart(),
  next: () => musicController.next(),
  previous: () => musicController.previous(),
  volume: (body) => musicController.setVolume(body.value),
  // stopPlayback, NÃO stop: `musicController.stop()` desliga o controller
  // inteiro, leitor NFC junto. Ver o comentário lá.
  stop: () => musicController.stopPlayback(),
};

app.post('/api/music/player/:acao', async (req, res) => {
  const acao = acoesDoPlayer[req.params.acao];
  if (!acao) return res.status(404).json({ error: `Ação desconhecida: ${req.params.acao}` });
  try {
    const status = await acao(req.body || {});
    // status nulo = player indisponível (sem mpv). Não é erro do pedido.
    res.json(status || (await musicController.getStatus()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Simula encostar/tirar uma tag.
 *
 * Existe para desenvolver o frontend numa máquina sem PN532: os eventos passam
 * exatamente pelo mesmo caminho dos do leitor real.
 */
app.post('/api/nfc-tag/simulate', async (req, res) => {
  const { uid, event } = req.body || {};
  if (!uid || !event) return res.status(400).json({ error: 'uid e event são obrigatórios' });
  try {
    await musicController.simulateTag(String(uid).toUpperCase(), event);
    res.json(await musicController.getStatus());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/services', async (req, res) => {
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
app.post('/api/services/:chave/:acao', async (req, res) => {
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

/**
 * Desliga ou reinicia a máquina.
 *
 * Sempre responde antes de executar: o systemd derruba este processo junto com
 * o resto, então esperar o systemctl terminar faria a resposta morrer no meio e
 * o admin mostraria erro num comando que deu certo. Mesmo motivo do restart do
 * próprio backend, só que aqui vale para as duas ações.
 */
app.post('/api/system/:acao', (req, res) => {
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
 * Índice do admin.
 *
 * Server-rendered como as outras páginas de admin, mas os blocos que mudam
 * sozinhos (leitor NFC, player) são atualizados por polling -- renderizar uma
 * vez mostraria um retrato velho de coisas que mudam a cada segundo.
 */
app.get('/admin', (req, res) => {
  const backendBase = `http://${req.hostname}:${PORT}`;
  const apiBase = NODE_ENV === 'production' ? '' : backendBase;

  const imagens = state.getGallery().length;
  const faixas = state.getTracks().length;
  const albuns = state.getAlbums().length;
  const tags = state.getTagMappings();
  // Mapeamento apontando para álbum que sumiu: o sintoma sem isso é "encostei a
  // tag e não tocou", que não sugere nada sobre a causa.
  const tagsQuebradas = tags.filter((t) => state.getTracksByAlbum(t.album).length === 0);

  const subiuEm = new Date(Date.now() - process.uptime() * 1000);

  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Alexo — Admin</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #111; color: #eee; margin: 0; padding: 2rem; }
    h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
    .sub { color: #888; font-size: .9rem; margin: 0 0 2rem; }
    h2 { font-size: .8rem; margin: 2rem 0 .75rem; color: #888; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 1rem; }
    .card { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; padding: 1.25rem; text-decoration: none; color: inherit; display: block; }
    a.card:hover { border-color: #3b82f6; }
    .num { font-size: 2rem; font-weight: 700; line-height: 1; }
    .rot { color: #888; font-size: .85rem; margin-top: .35rem; }
    .linha { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; padding: .5rem 0; border-bottom: 1px solid #2a2a2a; font-size: .9rem; }
    .linha:last-child { border-bottom: none; }
    .linha .k { color: #888; }
    .v { font-family: ui-monospace, monospace; }
    .ok { color: #6ee7b7; }
    .off { color: #f87171; }
    .warn { background: #422006; border-color: #854d0e; }
    .warn .rot { color: #fbbf24; }
    .acoes { display: flex; gap: .75rem; flex-wrap: wrap; margin-top: .5rem; }
    .acoes a { padding: .6rem 1.1rem; background: #3b82f6; color: #fff; border-radius: 6px; text-decoration: none; font-size: .9rem; }
    .acoes a:hover { background: #2563eb; }
    .linha small { color: #666; font-size: .75rem; font-weight: 400; }
    /* Indicador de status ao lado do nome. O estado por extenso fica no title:
       o ponto nao distingue "inactive" de "failed", e essa diferenca importa. */
    .pt { display: inline-block; width: .5rem; height: .5rem; border-radius: 50%; margin-right: .5rem; vertical-align: middle; }
    .pt-ok { background: #6ee7b7; }
    .pt-erro { background: #f87171; }
    .pt-off { background: #555; }
    .pt-meio { background: #fbbf24; }
    /* Alinha a descricao sob o rotulo, e nao sob o ponto (0,5rem + 0,5rem). */
    .linha .k small { display: inline-block; padding-left: 1rem; }
    .btns { display: flex; gap: .4rem; flex-shrink: 0; }
    .btns button { padding: .35rem .7rem; background: #2a2a2a; color: #ddd; border: 1px solid #444; border-radius: 5px; font-size: .8rem; cursor: pointer; font-family: inherit; }
    .btns button:hover:not(:disabled) { border-color: #3b82f6; color: #fff; }
    .btns button[data-a="stop"]:hover:not(:disabled) { border-color: #f87171; color: #f87171; }
    .btns button:disabled { opacity: .4; cursor: default; }
    .nota { color: #666; font-size: .8rem; line-height: 1.5; margin: .75rem 0 0; max-width: 46rem; }
    .nota code { font-family: ui-monospace, monospace; color: #888; }
    /* Desligar não tem volta pela rede; a moldura separa isso do resto da página. */
    .perigo { border-color: #7f1d1d; }
    .btns button.ruim { border-color: #7f1d1d; color: #f87171; }
    .btns button.ruim:hover:not(:disabled) { background: #7f1d1d; color: #fff; }
  </style>
</head>
<body>
  <h1>Alexo — Admin</h1>
  <p class="sub">backend no ar desde ${subiuEm.toLocaleString('pt-BR')}</p>

  <div class="acoes">
    <a href="/admin/gallery">Galeria</a>
    <a href="/admin/music">Música</a>
  </div>

  <h2>Conteúdo</h2>
  <div class="grid">
    <a class="card" href="/admin/gallery"><div class="num">${imagens}</div><div class="rot">imagens na galeria</div></a>
    <a class="card" href="/admin/music"><div class="num">${albuns}</div><div class="rot">álbuns</div></a>
    <a class="card" href="/admin/music"><div class="num">${faixas}</div><div class="rot">faixas no catálogo</div></a>
    <a class="card ${tagsQuebradas.length ? 'warn' : ''}" href="/admin/music">
      <div class="num">${tags.length}</div>
      <div class="rot">${tagsQuebradas.length
        ? `tags — ${tagsQuebradas.length} apontando para álbum inexistente`
        : 'tags cadastradas'}</div>
    </a>
  </div>

  <h2>Hardware</h2>
  <div class="card">
    <div class="linha"><span class="k">Leitor NFC</span><span class="v" id="leitorEstado">...</span></div>
    <div class="linha"><span class="k">Tag encostada</span><span class="v" id="leitorTag">...</span></div>
    <div class="linha"><span class="k">Player (mpv)</span><span class="v" id="playerEstado">...</span></div>
  </div>

  <h2>Tocando agora</h2>
  <div class="card">
    <div class="linha"><span class="k">Álbum</span><span class="v" id="pAlbum">—</span></div>
    <div class="linha"><span class="k">Faixa</span><span class="v" id="pFaixa">—</span></div>
    <div class="linha"><span class="k">Posição</span><span class="v" id="pPos">—</span></div>
    <div class="linha"><span class="k">Volume</span><span class="v" id="pVol">—</span></div>
  </div>

  <h2>Serviços</h2>
  <div class="card" id="servicos"><div class="linha"><span class="k">carregando…</span></div></div>
  <p class="nota">
    Sem autenticação: qualquer um na rede que abrir esta página pode parar os serviços.
    O Backend não tem botão de parar de propósito — pará-lo mataria o servidor
    que serve esta página, e só o ssh traria de volta.
  </p>

  <h2>Máquina</h2>
  <div class="card perigo">
    <div class="linha">
      <span class="k">Reiniciar o Pi<br><small>Volta sozinho em ~1 minuto</small></span>
      <span class="btns"><button id="btReboot">reiniciar</button></span>
    </div>
    <div class="linha">
      <span class="k">Desligar o Pi<br><small>Só liga de volta presencialmente</small></span>
      <span class="btns"><button id="btPoweroff" class="ruim">desligar</button></span>
    </div>
  </div>
  <p class="nota">
    Desligar por aqui é melhor que puxar o cabo: o Pi escreve em segundo plano e
    um corte no meio de uma escrita corrompe o cartão SD. O <code>poweroff</code>
    faz sync, desmonta e só então corta.
  </p>

  <script>
    const API = '${apiBase}';
    const $ = (id) => document.getElementById(id);
    const mm = (v) => String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(Math.floor(v % 60)).padStart(2, '0');

    async function tick() {
      try {
        const [leitor, player, servicos] = await Promise.all([
          fetch(API + '/api/music/reader').then((r) => r.json()),
          fetch(API + '/api/music/player/status').then((r) => r.json()),
          fetch(API + '/api/services').then((r) => r.json()),
        ]);

        pinta(servicos);

        $('leitorEstado').textContent = leitor.running ? 'ativo' : 'inativo';
        $('leitorEstado').className = 'v ' + (leitor.running ? 'ok' : 'off');
        $('leitorTag').textContent = leitor.tag ? leitor.tag.uid : '—';

        // O player não expõe "disponível" direto; volume nulo é o sinal de que
        // não há mpv atendendo do outro lado.
        const vivo = player && player.volume !== undefined && player.volume !== null;
        $('playerEstado').textContent = vivo ? 'conectado' : 'sem mpv';
        $('playerEstado').className = 'v ' + (vivo ? 'ok' : 'off');

        $('pAlbum').textContent = player.album || '—';
        $('pFaixa').textContent = player.title
          ? player.title + '  (' + (player.trackIndex + 1) + '/' + player.trackCount + ')'
          : '—';
        $('pPos').textContent = player.title
          ? (player.isPlaying ? '▶ ' : '|| ') + mm(player.position) + (player.duration ? ' / ' + mm(player.duration) : '')
          : '—';
        $('pVol').textContent = vivo ? player.volume : '—';
      } catch (e) {
        // backend reiniciando: a próxima volta pega
      }
    }

    /*
     * Serviços.
     *
     * Redesenhado a cada volta e não só na carga, porque um "stop" daqui muda
     * o estado e um "restart" do backend muda duas vezes -- cai e volta.
     */
    let mexendo = null; // chave em ação: trava os botões e evita o piscar do polling

    // Estado do systemd -> cor do ponto. O que nao estiver aqui (activating,
    // deactivating, desconhecido) cai no amarelo: e transitorio ou ilegivel,
    // e nos dois casos "nem verde nem vermelho" e a leitura honesta.
    const COR_DO_ESTADO = { active: 'pt-ok', failed: 'pt-erro', inactive: 'pt-off' };

    const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

    function pinta(servicos) {
      if (mexendo) return;
      $('servicos').innerHTML = servicos.map((s) => {
        const ativo = s.estado === 'active';
        const botoes = [
          ativo ? '' : '<button data-s="' + s.chave + '" data-a="start">ligar</button>',
          s.podeParar && ativo ? '<button data-s="' + s.chave + '" data-a="stop">desligar</button>' : '',
          '<button data-s="' + s.chave + '" data-a="restart">reiniciar</button>',
        ].join('');

        // O estado completo vai no title: o ponto sozinho nao distingue
        // "inactive" de "failed", e e justamente essa diferenca que interessa
        // quando alguma coisa quebrou. Escapado porque o erro vem do stderr do
        // systemctl e pode conter aspas.
        const titulo = esc(
          s.estado + (s.sub ? ' (' + s.sub + ')' : '') + (s.erro ? ' — ' + s.erro : ''),
        );

        return '<div class="linha">' +
          '<span class="k">' +
            '<span class="pt ' + (COR_DO_ESTADO[s.estado] || 'pt-meio') + '" title="' + titulo + '"></span>' +
            esc(s.rotulo) + '<br><small>' + esc(s.descricao) + '</small>' +
          '</span>' +
          '<span class="btns">' + botoes + '</span>' +
          '</div>';
      }).join('');
    }

    $('servicos').addEventListener('click', async (ev) => {
      const b = ev.target.closest('button');
      if (!b || mexendo) return;

      const chave = b.dataset.s, acao = b.dataset.a;
      if (acao === 'stop' && !confirm('Desligar ' + chave + '?')) return;

      mexendo = chave;
      $('servicos').querySelectorAll('button').forEach((x) => (x.disabled = true));
      b.textContent = '...';

      try {
        const r = await fetch(API + '/api/services/' + chave + '/' + acao, { method: 'POST' });
        const corpo = await r.json();
        if (!r.ok) alert(corpo.error || 'Falhou');
      } catch (e) {
        // Reiniciar o backend derruba a conexão às vezes antes da resposta
        // chegar. Não é erro: o serviço volta e o polling reencontra.
        if (chave !== 'alexo') alert('Falhou: ' + e.message);
      }

      mexendo = null;
      // O systemd leva um instante para assentar; ler cedo mostra o estado velho.
      setTimeout(tick, 1200);
    });

    /*
     * Máquina.
     *
     * Desligar não tem volta pelo admin, então a confirmação diz isso com
     * todas as letras em vez de um "tem certeza?" genérico. Depois de mandar,
     * o polling para: ficar tentando buscar status de uma maquina que esta
     * caindo so encheria o console de erro.
     */
    async function maquina(acao, pergunta) {
      if (!confirm(pergunta)) return;

      try {
        const r = await fetch(API + '/api/system/' + acao, { method: 'POST' });
        const corpo = await r.json();
        if (!r.ok) return alert(corpo.error || 'Falhou');
      } catch (e) {
        // A máquina pode cair antes da resposta chegar; não é erro.
      }

      clearInterval(pulso);
      document.querySelectorAll('button').forEach((b) => (b.disabled = true));
      $('servicos').innerHTML =
        '<div class="linha"><span class="k">' +
        (acao === 'reboot'
          ? 'Reiniciando… recarregue a página em cerca de um minuto.'
          : 'Desligando. Para ligar de novo é preciso ir até o Pi.') +
        '</span></div>';
    }

    $('btReboot').addEventListener('click', () =>
      maquina('reboot', 'Reiniciar o Pi? A tela apaga e volta em cerca de um minuto.'));

    $('btPoweroff').addEventListener('click', () =>
      maquina('poweroff', 'DESLIGAR o Pi?\\n\\nNão há como ligar de volta pela rede: ' +
        'o Zero W não tem wake-on-LAN. Só indo até ele.'));

    tick();
    const pulso = setInterval(tick, 2000);
  </script>
</body>
</html>`);
});

app.get('/admin/music', (req, res) => {
  const backendBase = `http://${req.hostname}:${PORT}`;
  const apiBase = NODE_ENV === 'production' ? '' : backendBase;

  const albums = state.getAlbums();
  const mappings = state.getTagMappings();

  const opcoes = albums
    .map((a) => `<option value="${a.replace(/"/g, '&quot;')}">${a}</option>`)
    .join('');

  const linhas = mappings.length === 0
    ? '<tr><td colspan="4" class="vazio">Nenhuma tag cadastrada.</td></tr>'
    : mappings.map((m) => {
        const qtd = state.getTracksByAlbum(m.album).length;
        // Álbum sem faixas = pasta renomeada depois do cadastro. Precisa gritar,
        // porque o sintoma sem isso é "encostei a tag e não tocou".
        const aviso = qtd === 0 ? ' <span class="erro">sem faixas!</span>' : '';
        return `<tr>
          <td class="uid">${m.uid}</td>
          <td>${m.album}${aviso}</td>
          <td>${qtd}</td>
          <td>
            <button onclick="tocar('${m.album.replace(/'/g, "\\'")}')">Tocar</button>
            <button class="del" onclick="remover('${m.uid}', '${m.album.replace(/'/g, "\\'")}')">Remover</button>
          </td>
        </tr>`;
      }).join('');

  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Música — Admin</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #111; color: #eee; margin: 0; padding: 2rem; }
    h1 { font-size: 1.5rem; margin: 0 0 1.5rem; }
    h2 { font-size: 1.1rem; margin: 2rem 0 .75rem; color: #aaa; font-weight: 600; }
    .box { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; padding: 1.25rem; }
    select, input { padding: .5rem; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #eee; font-size: .95rem; }
    select { min-width: 18rem; }
    button { padding: .5rem 1rem; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: .9rem; }
    button:hover { background: #2563eb; }
    button.del { background: #444; }
    button.del:hover { background: #b91c1c; }
    button:disabled { background: #333; color: #777; cursor: not-allowed; }
    table { width: 100%; border-collapse: collapse; margin-top: .5rem; }
    th, td { text-align: left; padding: .6rem .5rem; border-bottom: 1px solid #2a2a2a; font-size: .9rem; }
    th { color: #888; font-weight: 600; font-size: .8rem; text-transform: uppercase; }
    .uid { font-family: ui-monospace, monospace; color: #7dd3fc; }
    .vazio { color: #888; text-align: center; padding: 1.5rem; }
    .erro { color: #f87171; font-size: .8rem; }
    .leitor { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .pill { font-family: ui-monospace, monospace; padding: .35rem .7rem; border-radius: 999px; background: #2a2a2a; color: #888; }
    .pill.viva { background: #064e3b; color: #6ee7b7; }
    .status { margin-top: .75rem; color: #aaa; font-size: .9rem; }
    .controles { display: flex; gap: .5rem; margin-top: .75rem; flex-wrap: wrap; }
    a { color: #7dd3fc; }
  </style>
</head>
<body>
  <h1>Música — Admin</h1>
  <p style="color:#888;margin:-1rem 0 1.5rem"><a href="/admin">← Admin</a> · <a href="/admin/gallery">Galeria</a></p>

  <h2>Cadastrar tag</h2>
  <div class="box">
    <div class="leitor">
      <span>Tag no leitor:</span>
      <span class="pill" id="pill">nenhuma</span>
      <input id="uid" placeholder="UID (ou encoste uma tag)" size="20" />
      <select id="album">${opcoes}</select>
      <button onclick="salvar()">Mapear</button>
    </div>
    <div class="status" id="msg"></div>
  </div>

  <h2>Tags cadastradas</h2>
  <div class="box">
    <table>
      <thead><tr><th>UID</th><th>Álbum</th><th>Faixas</th><th></th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>
  </div>

  <h2>Player</h2>
  <div class="box">
    <div class="leitor">
      <select id="pAlbum" onchange="carregarFaixas()">${opcoes}</select>
      <select id="pFaixa"><option>carregando...</option></select>
      <button onclick="tocarSelecao()">Tocar</button>
    </div>
    <div class="status" id="player">carregando...</div>
    <div class="controles">
      <button onclick="acao('previous')">|◀ Anterior</button>
      <button onclick="acao('pause')">|| Pausar</button>
      <button onclick="acao('resume')">▶ Retomar</button>
      <button onclick="acao('next')">Próxima ▶|</button>
      <button class="del" onclick="acao('stop')">Parar</button>
    </div>
    <div class="controles">
      <button onclick="volume(-10)">Vol −</button>
      <button onclick="volume(10)">Vol +</button>
      <button class="del" onclick="reimportar()">Reimportar catálogo</button>
    </div>
  </div>

  <script>
    const API = '${apiBase}';
    let volAtual = 100;

    function aviso(t, erro) {
      const el = document.getElementById('msg');
      el.textContent = t;
      el.style.color = erro ? '#f87171' : '#6ee7b7';
    }

    async function salvar() {
      const uid = document.getElementById('uid').value.trim().toUpperCase();
      const album = document.getElementById('album').value;
      if (!uid) return aviso('Encoste uma tag ou digite o UID.', true);
      const r = await fetch(API + '/api/music/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, album }),
      });
      if (r.ok) location.reload();
      else aviso((await r.json()).error, true);
    }

    async function remover(uid, album) {
      // Confirmação porque a ação é destrutiva e o botão fica ao lado de
      // "Tocar", que é inofensivo.
      if (!confirm('Remover o mapeamento da tag ' + uid + ' (' + album + ')?')) return;
      await fetch(API + '/api/music/tags/' + uid, { method: 'DELETE' });
      location.reload();
    }

    async function tocar(album, trackId) {
      await fetch(API + '/api/music/player/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ album, trackId }),
      });
      atualizarPlayer();
    }

    // Preenche o seletor de faixas do álbum escolhido. A primeira opção é
    // "álbum inteiro" (trackId vazio): tocar do começo é o caso comum, e sem ela
    // seria preciso escolher a faixa 1 explicitamente.
    async function carregarFaixas() {
      const album = document.getElementById('pAlbum').value;
      const sel = document.getElementById('pFaixa');
      sel.innerHTML = '<option value="">carregando...</option>';
      try {
        const r = await fetch(API + '/api/music/tracks?album=' + encodeURIComponent(album));
        const faixas = await r.json();
        sel.innerHTML = '<option value="">— álbum inteiro (' + faixas.length + ' faixas) —</option>' +
          faixas.map((t, i) =>
            '<option value="' + t.id + '">' + String(i + 1).padStart(2, '0') + '. ' +
            t.title.replace(/</g, '&lt;') + '</option>').join('');
      } catch (e) {
        sel.innerHTML = '<option value="">erro ao carregar</option>';
      }
    }

    function tocarSelecao() {
      tocar(document.getElementById('pAlbum').value, document.getElementById('pFaixa').value || undefined);
    }

    async function acao(nome) {
      await fetch(API + '/api/music/player/' + nome, { method: 'POST' });
      atualizarPlayer();
    }

    async function volume(delta) {
      volAtual = Math.max(0, Math.min(100, volAtual + delta));
      await fetch(API + '/api/music/player/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: volAtual }),
      });
      atualizarPlayer();
    }

    async function reimportar() {
      const r = await fetch(API + '/api/music/import', { method: 'POST' });
      const d = await r.json();
      if (r.ok) {
        aviso(d.total + ' faixas (' + d.novos + ' novas, ' + d.sumidos + ' removidas)');
        setTimeout(() => location.reload(), 1200);
      } else aviso(d.error, true);
    }

    // Preenche o UID sozinho com a tag que estiver no leitor. É o que evita
    // digitar hexadecimal a mão -- e o UID vem do mesmo caminho que o player usa,
    // então não tem como divergir.
    async function lerTag() {
      try {
        const r = await fetch(API + '/api/music/reader');
        const d = await r.json();
        const pill = document.getElementById('pill');
        const campo = document.getElementById('uid');
        if (d.tag) {
          pill.textContent = d.tag.uid;
          pill.className = 'pill viva';
          if (document.activeElement !== campo) campo.value = d.tag.uid;
        } else {
          pill.textContent = d.running ? 'nenhuma' : 'leitor off';
          pill.className = 'pill';
        }
      } catch (e) { /* backend reiniciando: a próxima volta pega */ }
    }

    async function atualizarPlayer() {
      try {
        const r = await fetch(API + '/api/music/player/status');
        const s = await r.json();
        volAtual = s.volume;
        const el = document.getElementById('player');
        if (!s.title) {
          el.textContent = 'nada tocando  ·  volume ' + s.volume;
          return;
        }
        const mm = (v) => String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(Math.floor(v % 60)).padStart(2, '0');
        el.textContent = (s.isPlaying ? '▶ ' : '|| ') + s.album + '  ·  ' + s.title +
          '  ·  faixa ' + (s.trackIndex + 1) + '/' + s.trackCount +
          '  ·  ' + mm(s.position) + (s.duration ? ' / ' + mm(s.duration) : '') +
          '  ·  vol ' + s.volume;
      } catch (e) { /* idem */ }
    }

    lerTag(); atualizarPlayer(); carregarFaixas();
    setInterval(lerTag, 1000);
    setInterval(atualizarPlayer, 2000);
  </script>
</body>
</html>`);
});

// Admin page
app.get('/admin/gallery', (req, res) => {
  const backendBase = `http://${req.hostname}:${PORT}`;
  const apiBase = NODE_ENV === 'production' ? '' : backendBase;

  const images = state.getGallery();
  const imageCards = images.length === 0
    ? '<p style="color:#888;text-align:center;margin:2rem 0">Nenhuma imagem cadastrada.</p>'
    : [...images].sort((a, b) => a.order - b.order).map((img, i, arr) => `
      <div class="card" data-id="${img.id}" data-order="${img.order}">
        <span class="order">#${img.order}</span>
        <img src="${apiBase}${img.url}" alt="${img.filename}" />
        <div class="move-btns">
          <button onclick="move('${img.id}', -1)" ${i === 0 ? 'disabled' : ''}>↑ Subir</button>
          <button onclick="move('${img.id}', 1)" ${i === arr.length - 1 ? 'disabled' : ''}>↓ Descer</button>
        </div>
        <button class="del" onclick="deleteImage('${img.id}')">✕ Remover</button>
      </div>`).join('');

  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Galeria — Admin</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #111; color: #eee; margin: 0; padding: 2rem; }
    h1 { margin: 0 0 1.5rem; font-size: 1.4rem; }
    .upload-form { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; }
    .upload-form label { display: block; margin-bottom: .5rem; font-size: .9rem; color: #aaa; }
    .upload-form input[type=file] { width: 100%; padding: .5rem; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #eee; }
    .upload-form button { margin-top: 1rem; padding: .6rem 1.4rem; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: .95rem; }
    .upload-form button:hover { background: #2563eb; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; }
    .card { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; overflow: hidden; position: relative; }
    .card img { width: 100%; height: 150px; object-fit: cover; display: block; }
    .order { position: absolute; top: 6px; left: 6px; background: rgba(0,0,0,.65); color: #fff; font-size: .75rem; padding: 2px 6px; border-radius: 4px; }
    .move-btns { display: flex; }
    .move-btns button { flex: 1; padding: .4rem; background: #374151; color: #fff; border: none; cursor: pointer; font-size: .85rem; }
    .move-btns button:hover { background: #4b5563; }
    .move-btns button:disabled { opacity: .3; cursor: default; }
    .del { width: 100%; padding: .5rem; background: #ef4444; color: #fff; border: none; cursor: pointer; font-size: .85rem; }
    .del:hover { background: #dc2626; }
    #status { margin-top: 1rem; font-size: .9rem; color: #4ade80; min-height: 1.2rem; }
  </style>
</head>
<body>
  <h1>Galeria — Gerenciar Imagens</h1>
  <p style="color:#888;margin:-1rem 0 1.5rem"><a href="/admin" style="color:#7dd3fc">← Admin</a> · <a href="/admin/music" style="color:#7dd3fc">Música</a></p>

  <div class="upload-form">
    <label for="fileInput">Adicionar imagem (JPG, PNG, GIF, WebP — máx. 20 MB)</label>
    <input type="file" id="fileInput" accept="image/*" multiple />
    <button onclick="uploadFiles()">Enviar</button>
    <div id="status"></div>
  </div>

  <div class="grid" id="grid">${imageCards}</div>

  <script>
    const API = '${apiBase}';

    async function uploadFiles() {
      const input = document.getElementById('fileInput');
      const status = document.getElementById('status');
      if (!input.files.length) { status.textContent = 'Selecione pelo menos um arquivo.'; return; }
      status.textContent = 'Enviando...';
      for (const file of input.files) {
        const fd = new FormData();
        fd.append('image', file);
        const r = await fetch(API + '/api/gallery/upload', { method: 'POST', body: fd });
        if (!r.ok) { status.textContent = 'Erro ao enviar ' + file.name; return; }
      }
      status.textContent = 'Enviado com sucesso!';
      input.value = '';
      setTimeout(() => location.reload(), 800);
    }

    async function deleteImage(id) {
      if (!confirm('Remover esta imagem?')) return;
      const r = await fetch(API + '/api/gallery/' + id, { method: 'DELETE' });
      if (r.ok) location.reload();
      else alert('Erro ao remover imagem.');
    }

    async function move(id, direction) {
      const cards = [...document.querySelectorAll('.card')];
      const idx = cards.findIndex(c => c.dataset.id === id);
      const swapIdx = idx + direction;
      if (swapIdx < 0 || swapIdx >= cards.length) return;

      const a = cards[idx];
      const b = cards[swapIdx];
      const orderA = Number(a.dataset.order);
      const orderB = Number(b.dataset.order);

      const updates = [
        { id: a.dataset.id, order: orderB },
        { id: b.dataset.id, order: orderA },
      ];

      const r = await fetch(API + '/api/gallery/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (r.ok) location.reload();
      else alert('Erro ao reordenar.');
    }
  </script>
</body>
</html>`);
});

// Serve frontend in production
if (NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

const server = http.createServer(app);
wsServer.attach(server);

server.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  if (NODE_ENV === 'production') {
    console.log(`Frontend available at http://localhost:${PORT}`);
  }
  console.log(`Admin: http://localhost:${PORT}/admin`);

  // Depois do listen, e sem await: o mpv leva ~11s para subir neste Pi, e o
  // servidor não pode ficar sem atender HTTP nesse intervalo. Falha aqui não
  // derruba nada -- o controller já trata tudo internamente e o backend segue
  // funcionando sem música.
  musicController.init().catch((err) => {
    console.error('[music] init falhou:', err.message);
  });
});

// Encerrar limpo: sem isso o leitor NFC fica com o barramento aberto e o
// próximo processo herda um comando pendente.
for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => {
    musicController.stop().finally(() => process.exit(0));
  });
}
