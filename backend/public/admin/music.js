const API = window.ADMIN_API;
let currentVolume = 100;

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
  else notify((await r.json()).error, true);
}

async function remove(uid, album) {
  // Confirmação porque a ação é destrutiva e o botão fica ao lado de
  // "Tocar", que é inofensivo.
  if (!confirm('Remover o mapeamento da tag ' + uid + ' (' + album + ')?')) return;
  await fetch(API + '/api/music/tags/' + uid, { method: 'DELETE' });
  location.reload();
}

async function play(album, trackId) {
  await fetch(API + '/api/music/player/play', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ album, trackId }),
  });
  refreshPlayer();
}

// Preenche o seletor de faixas do álbum escolhido. A primeira opção é
// "álbum inteiro" (trackId vazio): tocar do começo é o caso comum, e sem ela
// seria preciso escolher a faixa 1 explicitamente.
async function loadTracks() {
  const album = document.getElementById('pAlbum').value;
  const sel = document.getElementById('pTrack');
  sel.innerHTML = '<option value="">carregando...</option>';
  try {
    const r = await fetch(API + '/api/music/tracks?album=' + encodeURIComponent(album));
    const tracks = await r.json();
    sel.innerHTML = '<option value="">— álbum inteiro (' + tracks.length + ' faixas) —</option>' +
      tracks.map((t, i) =>
        '<option value="' + t.id + '">' + String(i + 1).padStart(2, '0') + '. ' +
        t.title.replace(/</g, '&lt;') + '</option>').join('');
  } catch (e) {
    sel.innerHTML = '<option value="">erro ao carregar</option>';
  }
}

function playSelection() {
  play(document.getElementById('pAlbum').value, document.getElementById('pTrack').value || undefined);
}

async function action(name) {
  await fetch(API + '/api/music/player/' + name, { method: 'POST' });
  refreshPlayer();
}

async function volume(delta) {
  currentVolume = Math.max(0, Math.min(100, currentVolume + delta));
  await fetch(API + '/api/music/player/volume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: currentVolume }),
  });
  refreshPlayer();
}

async function reimport() {
  const r = await fetch(API + '/api/music/import', { method: 'POST' });
  const d = await r.json();
  if (r.ok) {
    notify(d.total + ' faixas (' + d.added + ' novas, ' + d.removed + ' removidas)');
    setTimeout(() => location.reload(), 1200);
  } else notify(d.error, true);
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
      pill.textContent = d.running ? 'nenhuma' : 'leitor off';
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

readTag(); refreshPlayer(); loadTracks();
setInterval(readTag, 1000);
setInterval(refreshPlayer, 2000);
