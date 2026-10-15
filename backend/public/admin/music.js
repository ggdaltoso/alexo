const API = window.ADMIN_API;
const $ = (id) => document.getElementById(id);
let currentVolume = 100;

// Erro de uma ação vira aviso com o motivo do backend; sem motivo, o status
// HTTP é o que dá para dizer.
async function falhou(r, oQue) {
  const body = await r.json().catch(() => ({}));
  aviso('Não deu para ' + oQue + ': ' + (body.error || 'erro ' + r.status), { titulo: 'Música' });
}

function notify(t, error) {
  const el = document.getElementById('msg');
  el.textContent = t;
  el.classList.toggle('fail', error);
  el.classList.toggle('ok', !error);
}

async function save() {
  const uid = document.getElementById('uid').value.trim().toUpperCase();
  const album = document.getElementById('album').value;
  if (!uid) return notify('Encoste uma tag ou digite o UID.', true);
  const r = await fetch(API + '/api/music/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, album }),
  });
  if (r.ok) location.reload();
  else {
    const body = await r.json().catch(() => ({}));
    notify('Não deu para cadastrar: ' + (body.error || 'erro ' + r.status), true);
  }
}

async function remove(uid, album) {
  // Confirmação porque a ação é destrutiva e o botão fica ao lado de
  // "Tocar", que é inofensivo.
  const sim = await confirmar('Remover a tag ' + uid + '?\n\nEla deixa de tocar ' + album + '.',
    { titulo: 'Remover tag', ok: 'Remover', perigo: true });
  if (!sim) return;
  const r = await fetch(API + '/api/music/tags/' + encodeURIComponent(uid), { method: 'DELETE' });
  if (!r.ok) return falhou(r, 'remover a tag');
  location.reload();
}

async function play(album, trackId) {
  const r = await fetch(API + '/api/music/player/play', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ album, trackId }),
  });
  if (!r.ok) await falhou(r, 'tocar');
  refreshPlayer();
}

// Preenche o seletor de faixas do álbum escolhido. A primeira opção é
// "álbum inteiro" (trackId vazio): tocar do começo é o caso comum, e sem ela
// seria preciso escolher a faixa 1 explicitamente.
async function loadTracks() {
  const album = document.getElementById('pAlbum').value;
  const sel = document.getElementById('pTrack');
  sel.innerHTML = '<option value="">Carregando…</option>';
  try {
    const r = await fetch(API + '/api/music/tracks?album=' + encodeURIComponent(album));
    const tracks = await r.json();
    sel.innerHTML = '<option value="">— álbum inteiro (' + tracks.length + ' faixas) —</option>' +
      tracks.map((t, i) =>
        '<option value="' + t.id + '">' + String(i + 1).padStart(2, '0') + '. ' +
        t.title.replace(/</g, '&lt;') + '</option>').join('');
  } catch (e) {
    sel.innerHTML = '<option value="">Não deu para carregar as faixas</option>';
  }
}

function playSelection() {
  play(document.getElementById('pAlbum').value, document.getElementById('pTrack').value || undefined);
}

const NOME_DA_ACAO = {
  previous: 'voltar a faixa', pause: 'pausar', resume: 'retomar', next: 'pular a faixa', stop: 'parar',
};

async function action(name) {
  const r = await fetch(API + '/api/music/player/' + name, { method: 'POST' });
  if (!r.ok) await falhou(r, NOME_DA_ACAO[name]);
  refreshPlayer();
}

async function volume(delta) {
  currentVolume = Math.max(0, Math.min(100, currentVolume + delta));
  const r = await fetch(API + '/api/music/player/volume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: currentVolume }),
  });
  if (!r.ok) await falhou(r, 'mudar o volume');
  refreshPlayer();
}

async function reimport() {
  const r = await fetch(API + '/api/music/import', { method: 'POST' });
  const d = await r.json().catch(() => ({}));
  if (r.ok) {
    notify('Catálogo reimportado: ' + d.total + ' faixas (' + d.added + ' novas, ' + d.removed + ' removidas)');
    setTimeout(() => location.reload(), 1200);
  } else notify('Não deu para reimportar: ' + (d.error || 'erro ' + r.status), true);
}

// Preenche o UID sozinho com a tag que estiver no leitor. É o que evita
// digitar hexadecimal a mão -- e o UID vem do mesmo caminho que o player usa,
// então não tem como divergir.
async function readTag() {
  try {
    const r = await fetch(API + '/api/music/reader');
    const d = await r.json();
    const pill = document.getElementById('pill');
    const field = document.getElementById('uid');
    if (d.tag) {
      pill.textContent = d.tag.uid;
      pill.className = 'pill live';
      if (document.activeElement !== field) field.value = d.tag.uid;
    } else {
      pill.textContent = d.running ? 'Nenhuma' : 'Leitor desligado';
      pill.className = 'pill';
    }
  } catch (e) { /* backend reiniciando: a próxima volta pega */ }
}

async function refreshPlayer() {
  try {
    const r = await fetch(API + '/api/music/player/status');
    const s = await r.json();
    currentVolume = s.volume;
    const el = document.getElementById('player');
    if (!s.title) {
      el.textContent = 'Nada tocando  ·  volume ' + s.volume;
      return;
    }
    const mm = (v) => String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(Math.floor(v % 60)).padStart(2, '0');
    el.textContent = (s.isPlaying ? '▶ ' : '|| ') + s.album + '  ·  ' + s.title +
      '  ·  faixa ' + (s.trackIndex + 1) + '/' + s.trackCount +
      '  ·  ' + mm(s.position) + (s.duration ? ' / ' + mm(s.duration) : '') +
      '  ·  vol ' + s.volume;
  } catch (e) { /* idem */ }
}

// Os botões levam o que precisam em data-*, escapado pelo servidor. Um
// listener só para a tabela: as linhas são HTML que vem pronto da view.
$('tags').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.tocar !== undefined) play(b.dataset.tocar);
  else if (b.dataset.remover !== undefined) remove(b.dataset.remover, b.dataset.album);
});
document.querySelectorAll('[data-acao]').forEach((b) =>
  b.addEventListener('click', () => action(b.dataset.acao)));
document.querySelectorAll('[data-volume]').forEach((b) =>
  b.addEventListener('click', () => volume(Number(b.dataset.volume))));
$('btCadastrar').addEventListener('click', save);
$('btTocar').addEventListener('click', playSelection);
$('btReimportar').addEventListener('click', reimport);
$('pAlbum').addEventListener('change', loadTracks);

readTag(); refreshPlayer(); loadTracks();
setInterval(readTag, 1000);
setInterval(refreshPlayer, 2000);
