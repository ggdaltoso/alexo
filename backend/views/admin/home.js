/**
 * Índice do admin.
 *
 * Server-rendered como as outras páginas de admin, mas os blocos que mudam
 * sozinhos (leitor NFC, player) são atualizados por polling -- renderizar uma
 * vez mostraria um retrato velho de coisas que mudam a cada segundo.
 */
const layout = require('./layout');

module.exports = function paginaInicial({ apiBase, imagens, faixas, albuns, tags, tagsQuebradas, subiuEm }) {
  return layout({
    titulo: 'Alexo — Admin',
    pagina: 'home',
    apiBase,
    corpo: `
  <h1>Alexo — Admin</h1>
  <p class="sub">backend no ar desde ${subiuEm.toLocaleString('pt-BR')}</p>

  <div class="acoes">
    <a href="/admin/gallery">Galeria</a>
    <a href="/admin/music">Música</a>
    <a href="/admin/prints">Prints</a>
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
  <div class="card" id="servicos"
       hx-get="/admin/blocos/servicos"
       hx-trigger="load, every 2s"
       hx-swap="innerHTML"
       hx-sync="this:replace"><div class="linha"><span class="k">carregando…</span></div></div>
  <p class="nota">
    Sem autenticação: qualquer um na rede que abrir esta página pode parar os serviços.
    O Backend não tem botão de parar de propósito — pará-lo mataria o servidor
    que serve esta página, e só o ssh traria de volta.
  </p>

  <h2>Tela</h2>
  <div class="card">
    <div class="linha">
      <span class="k">Print da tela<br><small>O que o display está mostrando agora, 480×320</small></span>
      <span class="btns"><button id="btPrint">tirar print</button></span>
    </div>
    <div id="print"></div>
    <div class="linha" id="guardar">
      <span class="k"><input id="nota" type="text" maxlength="120" placeholder="uma nota: o que mudou nesta tela?" /></span>
      <span class="btns"><button id="btGuardar">guardar no Pi</button></span>
    </div>
  </div>
  <p class="nota">
    É o mesmo <code>scrot</code> do alias <code>screenshot</code> do Pi, rodado
    pelo backend. Ele fotografa o servidor X inteiro, não o Chromium: com o
    Display (kiosk) parado o print sai, só que vazio.
    Tirar o print não grava nada — <a href="/admin/prints">guardar no Pi</a> é o
    segundo clique, para o print que valeu a pena.
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
`,
  });
};
