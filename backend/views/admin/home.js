/**
 * Índice do admin.
 *
 * Server-rendered como as outras páginas de admin, mas os blocos que mudam
 * sozinhos (leitor NFC, player) são atualizados por polling -- renderizar uma
 * vez mostraria um retrato velho de coisas que mudam a cada segundo.
 */
const layout = require('./layout');
const janela = require('./janela');

module.exports = function homePage({ apiBase, imageCount, trackCount, albumCount, tags, brokenTags, startedAt }) {
  return layout({
    title: 'Alexo — Admin',
    page: 'home',
    apiBase,
    ui98: true,
    body: janela({
      aba: 'home',
      status: [`Backend no ar desde ${startedAt.toLocaleString('pt-BR')}`],
      conteudo: `

  <fieldset>
    <legend>Conteúdo</legend>
    <div class="grid">
      <a class="contador sunken-panel" href="/admin/gallery"><span class="number">${imageCount}</span><span class="caption">imagens na galeria</span></a>
      <a class="contador sunken-panel" href="/admin/music"><span class="number">${albumCount}</span><span class="caption">álbuns</span></a>
      <a class="contador sunken-panel" href="/admin/music"><span class="number">${trackCount}</span><span class="caption">faixas no catálogo</span></a>
      <a class="contador sunken-panel ${brokenTags.length ? 'warn' : ''}" href="/admin/music">
        <span class="number">${tags.length}</span>
        <span class="caption">${brokenTags.length
          ? `tags — ${brokenTags.length} apontando para álbum inexistente`
          : 'tags cadastradas'}</span>
      </a>
    </div>
  </fieldset>

  <div class="lado-a-lado">
    <fieldset>
      <legend>Hardware</legend>
      <div id="hardware"
           hx-get="/admin/partials/device"
           hx-trigger="load, every 2s"
           hx-swap="innerHTML"
           hx-sync="this:replace"><div class="row"><span class="key-cell">Carregando…</span></div></div>
    </fieldset>

    <fieldset>
      <legend>Tocando agora</legend>
      <!-- Atualizado junto com o #hardware, pela mesma resposta (hx-swap-oob). -->
      <div class="card" id="playing"><div class="row"><span class="key-cell">Carregando…</span></div></div>
    </fieldset>
  </div>

  <fieldset>
    <legend>Serviços</legend>
    <div id="services"
         hx-get="/admin/partials/services"
         hx-trigger="load, every 2s"
         hx-swap="innerHTML"
         hx-sync="this:replace"><div class="row"><span class="key-cell">Carregando…</span></div></div>
    <p class="note">
      Sem autenticação: qualquer um na rede que abrir esta página pode parar os serviços.
      O Backend não tem botão de parar de propósito — pará-lo mataria o servidor
      que serve esta página, e só o ssh traria de volta.
    </p>
  </fieldset>

  <fieldset>
    <legend>Tela</legend>
    <div class="row">
      <span class="key-cell">Print da tela<br><small>O que o display está mostrando agora, 480×320</small></span>
      <span class="buttons"><button id="btShot">Tirar print</button></span>
    </div>
    <div id="print"></div>
    <div class="row" id="saveRow">
      <span class="key-cell"><input id="note" type="text" maxlength="120" placeholder="uma nota: o que mudou nesta tela?" /></span>
      <span class="buttons"><button id="btSave">Guardar no Pi</button></span>
    </div>
    <p class="note">
      É o mesmo <code>scrot</code> do alias <code>screenshot</code> do Pi, rodado
      pelo backend. Ele fotografa o servidor X inteiro, não o Chromium: com o
      Display (kiosk) parado o print sai, só que vazio.
      Tirar o print não grava nada — <a href="/admin/prints">guardar no Pi</a> é o
      segundo clique, para o print que valeu a pena.
    </p>
  </fieldset>

  <fieldset class="danger">
    <legend>Máquina</legend>
    <div class="row">
      <span class="key-cell">Reiniciar o Pi<br><small>Volta sozinho em cerca de 1 minuto</small></span>
      <span class="buttons"><button id="btReboot">Reiniciar</button></span>
    </div>
    <div class="row">
      <span class="key-cell">Desligar o Pi<br><small>Só liga de volta presencialmente</small></span>
      <span class="buttons"><button id="btPoweroff">Desligar</button></span>
    </div>
    <p class="note">
      Desligar por aqui é melhor que puxar o cabo: o Pi escreve em segundo plano e
      um corte no meio de uma escrita corrompe o cartão SD. O <code>poweroff</code>
      faz sync, desmonta e só então corta.
    </p>
  </fieldset>
`,
    }),
  });
};
