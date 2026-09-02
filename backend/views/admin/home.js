/**
 * Índice do admin.
 *
 * Server-rendered como as outras páginas de admin, mas os blocos que mudam
 * sozinhos (leitor NFC, player) são atualizados por polling -- renderizar uma
 * vez mostraria um retrato velho de coisas que mudam a cada segundo.
 */
const layout = require('./layout');

module.exports = function homePage({ apiBase, imageCount, trackCount, albumCount, tags, brokenTags, startedAt }) {
  return layout({
    title: 'Alexo — Admin',
    page: 'home',
    apiBase,
    body: `
  <h1>Alexo — Admin</h1>
  <p class="subtitle">backend no ar desde ${startedAt.toLocaleString('pt-BR')}</p>

  <div class="actions">
    <a href="/admin/gallery">Galeria</a>
    <a href="/admin/music">Música</a>
    <a href="/admin/prints">Prints</a>
  </div>

  <h2>Conteúdo</h2>
  <div class="grid">
    <a class="card" href="/admin/gallery"><div class="number">${imageCount}</div><div class="caption">imagens na galeria</div></a>
    <a class="card" href="/admin/music"><div class="number">${albumCount}</div><div class="caption">álbuns</div></a>
    <a class="card" href="/admin/music"><div class="number">${trackCount}</div><div class="caption">faixas no catálogo</div></a>
    <a class="card ${brokenTags.length ? 'warn' : ''}" href="/admin/music">
      <div class="number">${tags.length}</div>
      <div class="caption">${brokenTags.length
        ? `tags — ${brokenTags.length} apontando para álbum inexistente`
        : 'tags cadastradas'}</div>
    </a>
  </div>

  <h2>Hardware</h2>
  <div class="card">
    <div class="row"><span class="key-cell">Leitor NFC</span><span class="value-cell" id="readerState">...</span></div>
    <div class="row"><span class="key-cell">Tag encostada</span><span class="value-cell" id="readerTag">...</span></div>
    <div class="row"><span class="key-cell">Player (mpv)</span><span class="value-cell" id="playerState">...</span></div>
  </div>

  <h2>Tocando agora</h2>
  <div class="card">
    <div class="row"><span class="key-cell">Álbum</span><span class="value-cell" id="pAlbum">—</span></div>
    <div class="row"><span class="key-cell">Faixa</span><span class="value-cell" id="pTrack">—</span></div>
    <div class="row"><span class="key-cell">Posição</span><span class="value-cell" id="pPos">—</span></div>
    <div class="row"><span class="key-cell">Volume</span><span class="value-cell" id="pVol">—</span></div>
  </div>

  <h2>Serviços</h2>
  <div class="card" id="services"
       hx-get="/admin/partials/services"
       hx-trigger="load, every 2s"
       hx-swap="innerHTML"
       hx-sync="this:replace"><div class="row"><span class="key-cell">carregando…</span></div></div>
  <p class="note">
    Sem autenticação: qualquer um na rede que abrir esta página pode parar os serviços.
    O Backend não tem botão de parar de propósito — pará-lo mataria o servidor
    que serve esta página, e só o ssh traria de volta.
  </p>

  <h2>Tela</h2>
  <div class="card">
    <div class="row">
      <span class="key-cell">Print da tela<br><small>O que o display está mostrando agora, 480×320</small></span>
      <span class="buttons"><button id="btShot">tirar print</button></span>
    </div>
    <div id="print"></div>
    <div class="row" id="saveRow">
      <span class="key-cell"><input id="note" type="text" maxlength="120" placeholder="uma nota: o que mudou nesta tela?" /></span>
      <span class="buttons"><button id="btSave">guardar no Pi</button></span>
    </div>
  </div>
  <p class="note">
    É o mesmo <code>scrot</code> do alias <code>screenshot</code> do Pi, rodado
    pelo backend. Ele fotografa o servidor X inteiro, não o Chromium: com o
    Display (kiosk) parado o print sai, só que vazio.
    Tirar o print não grava nada — <a href="/admin/prints">guardar no Pi</a> é o
    segundo clique, para o print que valeu a pena.
  </p>

  <h2>Máquina</h2>
  <div class="card danger">
    <div class="row">
      <span class="key-cell">Reiniciar o Pi<br><small>Volta sozinho em ~1 minuto</small></span>
      <span class="buttons"><button id="btReboot">reiniciar</button></span>
    </div>
    <div class="row">
      <span class="key-cell">Desligar o Pi<br><small>Só liga de volta presencialmente</small></span>
      <span class="buttons"><button id="btPoweroff" class="bad">desligar</button></span>
    </div>
  </div>
  <p class="note">
    Desligar por aqui é melhor que puxar o cabo: o Pi escreve em segundo plano e
    um corte no meio de uma escrita corrompe o cartão SD. O <code>poweroff</code>
    faz sync, desmonta e só então corta.
  </p>
`,
  });
};
