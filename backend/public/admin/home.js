const API = window.ADMIN_API;
const $ = (id) => document.getElementById(id);
const mm = (v) => String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(Math.floor(v % 60)).padStart(2, '0');

async function tick() {
  try {
    const [leitor, player] = await Promise.all([
      fetch(API + '/api/music/reader').then((r) => r.json()),
      fetch(API + '/api/music/player/status').then((r) => r.json()),
    ]);

    $('leitorEstado').textContent = leitor.running ? 'ativo' : 'inativo';
    $('leitorEstado').className = 'v ' + (leitor.running ? 'ok' : 'off');
    $('leitorTag').textContent = leitor.tag ? leitor.tag.uid : '—';

    // O player não expõe "disponível" direto; volume nulo é o sinal de que
    // não há mpv atendendo do outro lado.
    const alive = player && player.volume !== undefined && player.volume !== null;
    $('playerEstado').textContent = alive ? 'conectado' : 'sem mpv';
    $('playerEstado').className = 'v ' + (alive ? 'ok' : 'off');

    $('pAlbum').textContent = player.album || '—';
    $('pFaixa').textContent = player.title
      ? player.title + '  (' + (player.trackIndex + 1) + '/' + player.trackCount + ')'
      : '—';
    $('pPos').textContent = player.title
      ? (player.isPlaying ? '▶ ' : '|| ') + mm(player.position) + (player.duration ? ' / ' + mm(player.duration) : '')
      : '—';
    $('pVol').textContent = alive ? player.volume : '—';
  } catch (e) {
    // backend reiniciando: a próxima volta pega
  }
}

/*
 * Print da tela.
 *
 * A captura leva ~0,8 s no Zero W, então o botão precisa dizer que está
 * fazendo alguma coisa: sem isso o clique parece não ter pegado e vira dois
 * cliques. Desabilitar durante a captura casa com a trava que o backend já
 * tem -- é a mesma ideia do hx-disabled-elt que os botões de serviço usam.
 *
 * A imagem vem como blob em vez de <img src="/api/system/screenshot">
 * porque o link de salvar aproveita o mesmo objeto -- com src apontando
 * para a rota, salvar dispararia uma segunda captura e o arquivo salvo
 * seria de um instante diferente do que está na tela.
 */
let printUrl = null;
let captureTakenAt = null;

$('btPrint').addEventListener('click', async () => {
  const b = $('btPrint');
  b.disabled = true;
  b.textContent = 'capturando…';

  try {
    const r = await fetch(API + '/api/system/screenshot');
    // O erro vem em JSON mesmo numa rota que responde PNG; ver a rota.
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.error || 'Falhou');
    }

    // Sem o revoke o blob anterior fica preso na memória do navegador até
    // fechar a aba, e são ~80 KB por clique.
    if (printUrl) URL.revokeObjectURL(printUrl);
    printUrl = URL.createObjectURL(await r.blob());

    // A hora da captura viaja com a imagem: é o que o "guardar" devolve
    // para o backend confirmar que salvou o print que estava na tela.
    captureTakenAt = r.headers.get('X-Print-Em');

    const name = 'alexo-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png';
    $('print').innerHTML =
      '<img src="' + printUrl + '" alt="Print da tela do Pi" />' +
      '<a href="' + printUrl + '" download="' + name + '">baixar ' + name + '</a>';
    $('print').classList.add('visivel');

    // A linha de guardar só existe depois de haver o que guardar.
    $('guardar').classList.add('visivel');
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
      body: JSON.stringify({ at: captureTakenAt, note: $('nota').value }),
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body.error || 'Falhou');

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
async function machine(action, pergunta) {
  if (!confirm(pergunta)) return;

  try {
    const r = await fetch(API + '/api/system/' + action, { method: 'POST' });
    const body = await r.json();
    if (!r.ok) return alert(body.error || 'Falhou');
  } catch (e) {
    // A máquina pode cair antes da resposta chegar; não é erro.
  }

  clearInterval(heartbeat);
  document.querySelectorAll('button').forEach((b) => (b.disabled = true));

  // outerHTML, e não innerHTML: o #servicos se repinta sozinho pelo htmx, e
  // trocar só o conteúdo deixaria o polling vivo para apagar esta mensagem na
  // volta seguinte. Substituindo o elemento inteiro por um sem hx-*, o htmx
  // recolhe o timer junto com o nó que saiu.
  $('servicos').outerHTML =
    '<div class="card"><div class="linha"><span class="k">' +
    (action === 'reboot'
      ? 'Reiniciando… recarregue a página em cerca de um minuto.'
      : 'Desligando. Para ligar de novo é preciso ir até o Pi.') +
    '</span></div></div>';
}

$('btReboot').addEventListener('click', () =>
  machine('reboot', 'Reiniciar o Pi? A tela apaga e volta em cerca de um minuto.'));

$('btPoweroff').addEventListener('click', () =>
  machine('poweroff', 'DESLIGAR o Pi?\\n\\nNão há como ligar de volta pela rede: ' +
    'o Zero W não tem wake-on-LAN. Só indo até ele.'));

tick();
const heartbeat = setInterval(tick, 2000);
