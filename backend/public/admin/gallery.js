const API = window.ADMIN_API;
const $ = (id) => document.getElementById(id);

// Motivo do backend quando ele manda um; sem isso, o status HTTP. O limite de
// 20 MB, por exemplo, sai do multer sem JSON.
async function motivo(r) {
  const body = await r.json().catch(() => ({}));
  return body.error || 'erro ' + r.status;
}

async function uploadFiles() {
  const input = $('fileInput');
  const status = $('status');
  const files = [...input.files];
  if (!files.length) { status.textContent = 'Selecione pelo menos um arquivo.'; return; }

  // Uma por vez: a rota recebe um arquivo por requisição. Se uma falhar, as
  // anteriores já estão no Pi, então a página recarrega mesmo assim.
  let enviadas = 0;
  for (const file of files) {
    status.textContent = 'Enviando ' + (enviadas + 1) + ' de ' + files.length + '…';
    const fd = new FormData();
    fd.append('image', file);
    const r = await fetch(API + '/api/gallery/upload', { method: 'POST', body: fd });
    if (!r.ok) {
      status.textContent = '';
      await aviso('Não deu para enviar ' + file.name + ': ' + (await motivo(r)) +
        (enviadas ? '\n\nAs ' + enviadas + ' anteriores foram enviadas.' : ''), { titulo: 'Galeria' });
      if (enviadas) location.reload();
      return;
    }
    enviadas += 1;
  }
  status.textContent = enviadas === 1 ? 'Imagem enviada.' : enviadas + ' imagens enviadas.';
  input.value = '';
  setTimeout(() => location.reload(), 800);
}

async function deleteImage(id) {
  const sim = await confirmar('Remover esta imagem da galeria?\n\nO arquivo é apagado do Pi.',
    { titulo: 'Remover imagem', ok: 'Remover', perigo: true });
  if (!sim) return;
  const r = await fetch(API + '/api/gallery/' + encodeURIComponent(id), { method: 'DELETE' });
  if (r.ok) location.reload();
  else aviso('Não deu para remover a imagem: ' + (await motivo(r)), { titulo: 'Galeria' });
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
  else aviso('Não deu para reordenar: ' + (await motivo(r)), { titulo: 'Galeria' });
}

// Um listener para a grade inteira: o id da imagem está no card, e o botão diz
// só o que fazer com ela.
$('grid').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const id = b.closest('.card').dataset.id;
  if (b.dataset.mover) move(id, Number(b.dataset.mover));
  else if (b.dataset.remover !== undefined) deleteImage(id);
});
$('btEnviar').addEventListener('click', uploadFiles);
