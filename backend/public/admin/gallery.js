const API = window.ADMIN_API;

async function uploadFiles() {
  const input = document.getElementById('fileInput');
  const status = document.getElementById('status');
  if (!input.files.length) { status.textContent = 'Selecione pelo menos um arquivo.'; return; }
  status.textContent = 'Enviando...';
  for (const file of input.files) {
    const fd = new FormData();
    fd.append('image', file);
    const r = await fetch(API + '/api/gallery/upload', { method: 'POST', body: fd });
    if (!r.ok) { status.textContent = 'Erro ao enviar ' + file.name; return; }
  }
  status.textContent = 'Enviado com sucesso!';
  input.value = '';
  setTimeout(() => location.reload(), 800);
}

async function deleteImage(id) {
  if (!confirm('Remover esta imagem?')) return;
  const r = await fetch(API + '/api/gallery/' + id, { method: 'DELETE' });
  if (r.ok) location.reload();
  else alert('Erro ao remover imagem.');
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
  else alert('Erro ao reordenar.');
}
