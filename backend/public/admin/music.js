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

// Editor da imagem da tag, no jeito de trocar avatar: a imagem anda e cresce
// por baixo de um círculo fixo, e o que fica dentro dele vira o adesivo. O
// recorte sai daqui pronto (PNG quadrado), o backend só grava.
const ed = { uid: null, img: null, zoom: 1, dx: 0, dy: 0 };
const LADO = 280;        // canvas do editor
const RAIO = 120;        // círculo do adesivo dentro dele
const SAIDA = 600;       // px do PNG: 25 mm a ~600 dpi

function escalaBase() {
  // "cover": no zoom 1 a imagem cobre o círculo todo, sem sobra branca.
  return Math.max((2 * RAIO) / ed.img.width, (2 * RAIO) / ed.img.height);
}

function limitar() {
  const s = escalaBase() * ed.zoom;
  const folgaX = (ed.img.width * s - 2 * RAIO) / 2;
  const folgaY = (ed.img.height * s - 2 * RAIO) / 2;
  ed.dx = Math.max(-folgaX, Math.min(folgaX, ed.dx));
  ed.dy = Math.max(-folgaY, Math.min(folgaY, ed.dy));
}

function desenhar() {
  const ctx = $('edCanvas').getContext('2d');
  ctx.clearRect(0, 0, LADO, LADO);
  if (ed.img) {
    const s = escalaBase() * ed.zoom;
    const w = ed.img.width * s, h = ed.img.height * s;
    ctx.drawImage(ed.img, LADO / 2 + ed.dx - w / 2, LADO / 2 + ed.dy - h / 2, w, h);
  }
  // Escurece o que fica fora do adesivo; evenodd fura o círculo no retângulo.
  ctx.beginPath();
  ctx.rect(0, 0, LADO, LADO);
  ctx.arc(LADO / 2, LADO / 2, RAIO, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(0, 0, 0, .55)';
  ctx.fill('evenodd');
  ctx.beginPath();
  ctx.arc(LADO / 2, LADO / 2, RAIO, 0, 2 * Math.PI);
  ctx.strokeStyle = '#fff';
  ctx.stroke();
}

function carregar(src) {
  const img = new Image();
  img.onload = () => {
    Object.assign(ed, { img, zoom: 1, dx: 0, dy: 0 });
    $('edZoom').value = 1;
    $('edSalvar').disabled = false;
    desenhar();
  };
  img.onerror = () => aviso('Não deu para abrir essa imagem.', { titulo: 'Personalizar' });
  img.src = src;
}

function abrirEditor(uid, album, imagem) {
  Object.assign(ed, { uid, img: null });
  $('edTitulo').textContent = 'Personalizar: ' + album;
  $('edSalvar').disabled = true;
  $('edRemover').hidden = !imagem;
  $('edArquivo').value = '';
  desenhar();
  // A imagem atual já é o recorte; abrir com ela deixa ajustar sem reenviar.
  if (imagem) carregar(imagem);
  $('editor').showModal();
}

async function salvarImagem() {
  const out = document.createElement('canvas');
  out.width = out.height = SAIDA;
  const k = SAIDA / (2 * RAIO);
  const s = escalaBase() * ed.zoom;
  const w = ed.img.width * s, h = ed.img.height * s;
  const x = LADO / 2 + ed.dx - w / 2 - (LADO / 2 - RAIO);
  const y = LADO / 2 + ed.dy - h / 2 - (LADO / 2 - RAIO);
  const ctx = out.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(ed.img, x * k, y * k, w * k, h * k);
  const blob = await new Promise((ok) => out.toBlob(ok, 'image/png'));
  const r = await fetch(API + '/api/music/tags/' + encodeURIComponent(ed.uid) + '/imagem', {
    method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: blob,
  });
  if (!r.ok) return falhou(r, 'salvar a imagem');
  location.reload();
}

async function removerImagem() {
  const r = await fetch(API + '/api/music/tags/' + encodeURIComponent(ed.uid) + '/imagem', { method: 'DELETE' });
  if (!r.ok) return falhou(r, 'remover a imagem');
  location.reload();
}

let arrasto = null;
$('edCanvas').addEventListener('pointerdown', (e) => {
  if (!ed.img) return;
  arrasto = { x: e.clientX - ed.dx, y: e.clientY - ed.dy };
  e.target.setPointerCapture(e.pointerId);
});
$('edCanvas').addEventListener('pointermove', (e) => {
  if (!arrasto) return;
  ed.dx = e.clientX - arrasto.x;
  ed.dy = e.clientY - arrasto.y;
  limitar();
  desenhar();
});
$('edCanvas').addEventListener('pointerup', () => { arrasto = null; });
$('edCanvas').addEventListener('wheel', (e) => {
  if (!ed.img) return;
  e.preventDefault();
  $('edZoom').value = Math.max(1, Math.min(5, ed.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
  $('edZoom').dispatchEvent(new Event('input'));
}, { passive: false });
$('edZoom').addEventListener('input', (e) => {
  if (!ed.img) return;
  ed.zoom = Number(e.target.value);
  limitar();
  desenhar();
});
$('edArquivo').addEventListener('change', (e) => {
  if (e.target.files[0]) carregar(URL.createObjectURL(e.target.files[0]));
});
$('edSalvar').addEventListener('click', salvarImagem);
$('edRemover').addEventListener('click', removerImagem);
$('edCancelar').addEventListener('click', () => $('editor').close());

// Os botões levam o que precisam em data-*, escapado pelo servidor. Um
// listener só para a tabela: as linhas são HTML que vem pronto da view.
$('tags').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.tocar !== undefined) play(b.dataset.tocar);
  else if (b.dataset.remover !== undefined) remove(b.dataset.remover, b.dataset.album);
  else if (b.dataset.personalizar !== undefined) abrirEditor(b.dataset.personalizar, b.dataset.album, b.dataset.imagem);
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
