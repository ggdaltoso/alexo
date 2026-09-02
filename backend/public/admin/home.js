const API = window.ADMIN_API;
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
