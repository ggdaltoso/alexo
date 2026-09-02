/**
 * Índice do admin.
 *
 * Server-rendered como as outras páginas de admin, mas os blocos que mudam
 * sozinhos (leitor NFC, player) são atualizados por polling -- renderizar uma
 * vez mostraria um retrato velho de coisas que mudam a cada segundo.
 */
module.exports = function paginaInicial({ apiBase, imagens, faixas, albuns, tags, tagsQuebradas, subiuEm }) {
  return `<!DOCTYPE html>
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
    /* O print só aparece depois do primeiro clique; nascer vazio deixaria um
       buraco no card. Largura fixa em 480 (o tamanho real da tela) e pixelated:
       a UI do Alexo é pixelada de propósito, e deixar o navegador suavizar na
       escala mostraria uma tela que não é a que está lá. */
    #print { display: none; padding-top: 1rem; }
    #print img { display: block; width: 480px; max-width: 100%; image-rendering: pixelated; border: 1px solid #333; border-radius: 4px; }
    #print a { display: inline-block; margin-top: .6rem; color: #3b82f6; font-size: .85rem; }
    #guardar { display: none; }
    #guardar .k { flex: 1; }
    #nota { width: 100%; max-width: 28rem; padding: .4rem .6rem; background: #111; color: #eee; border: 1px solid #444; border-radius: 5px; font-family: inherit; font-size: .85rem; }
    #nota:focus { outline: none; border-color: #3b82f6; }
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
  <div class="card" id="servicos"><div class="linha"><span class="k">carregando…</span></div></div>
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
     * Print da tela.
     *
     * A captura leva ~0,8 s no Zero W, então o botão precisa dizer que está
     * fazendo alguma coisa: sem isso o clique parece não ter pegado e vira dois
     * cliques. Desabilitar durante a captura é a mesma ideia do "mexendo" dos
     * serviços, e casa com a trava que o backend já tem.
     *
     * A imagem vem como blob em vez de <img src="/api/system/screenshot">
     * porque o link de salvar aproveita o mesmo objeto -- com src apontando
     * para a rota, salvar dispararia uma segunda captura e o arquivo salvo
     * seria de um instante diferente do que está na tela.
     */
    let urlDoPrint = null;
    let emDaCaptura = null;

    $('btPrint').addEventListener('click', async () => {
      const b = $('btPrint');
      b.disabled = true;
      b.textContent = 'capturando…';

      try {
        const r = await fetch(API + '/api/system/screenshot');
        // O erro vem em JSON mesmo numa rota que responde PNG; ver a rota.
        if (!r.ok) {
          const corpo = await r.json().catch(() => ({}));
          throw new Error(corpo.error || 'Falhou');
        }

        // Sem o revoke o blob anterior fica preso na memória do navegador até
        // fechar a aba, e são ~80 KB por clique.
        if (urlDoPrint) URL.revokeObjectURL(urlDoPrint);
        urlDoPrint = URL.createObjectURL(await r.blob());

        // A hora da captura viaja com a imagem: é o que o "guardar" devolve
        // para o backend confirmar que salvou o print que estava na tela.
        emDaCaptura = r.headers.get('X-Print-Em');

        const nome = 'alexo-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png';
        $('print').innerHTML =
          '<img src="' + urlDoPrint + '" alt="Print da tela do Pi" />' +
          '<a href="' + urlDoPrint + '" download="' + nome + '">baixar ' + nome + '</a>';
        $('print').style.display = 'block';

        // A linha de guardar só existe depois de haver o que guardar.
        $('guardar').style.display = 'flex';
        $('nota').value = '';
        $('btGuardar').disabled = false;
        $('btGuardar').textContent = 'guardar no Pi';
      } catch (e) {
        alert('Não deu para tirar o print: ' + e.message);
      }

      b.disabled = false;
      b.textContent = 'tirar print';
    });

    /*
     * Guardar no Pi.
     *
     * Só grava o print que já está no preview -- e manda de volta o "em" que
     * veio na captura, para o backend recusar se alguém tiver capturado de novo
     * no meio. Gravar a imagem errada com a nota certa é pior que recusar.
     */
    $('btGuardar').addEventListener('click', async () => {
      const b = $('btGuardar');
      b.disabled = true;
      b.textContent = 'guardando…';

      try {
        const r = await fetch(API + '/api/prints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ em: emDaCaptura, nota: $('nota').value }),
        });
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo.error || 'Falhou');

        // Confirmação no próprio botão em vez de alert: guardar é a ação
        // esperada, e um alert por print viraria um clique a mais toda vez.
        b.textContent = 'guardado ✓';
      } catch (e) {
        alert('Não deu para guardar: ' + e.message);
        b.disabled = false;
        b.textContent = 'guardar no Pi';
      }
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
</html>`;
};
