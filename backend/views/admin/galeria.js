/** Galeria: reordenar e remover as fotos que a tela mostra. */
module.exports = function paginaGaleria({ apiBase, images }) {
  const imageCards = images.length === 0
    ? '<p style="color:#888;text-align:center;margin:2rem 0">Nenhuma imagem cadastrada.</p>'
    : [...images].sort((a, b) => a.order - b.order).map((img, i, arr) => `
      <div class="card" data-id="${img.id}" data-order="${img.order}">
        <span class="order">#${img.order}</span>
        <img src="${apiBase}${img.url}" alt="${img.filename}" />
        <div class="move-btns">
          <button onclick="move('${img.id}', -1)" ${i === 0 ? 'disabled' : ''}>↑ Subir</button>
          <button onclick="move('${img.id}', 1)" ${i === arr.length - 1 ? 'disabled' : ''}>↓ Descer</button>
        </div>
        <button class="del" onclick="deleteImage('${img.id}')">✕ Remover</button>
      </div>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Galeria — Admin</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #111; color: #eee; margin: 0; padding: 2rem; }
    h1 { margin: 0 0 1.5rem; font-size: 1.4rem; }
    .upload-form { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; }
    .upload-form label { display: block; margin-bottom: .5rem; font-size: .9rem; color: #aaa; }
    .upload-form input[type=file] { width: 100%; padding: .5rem; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #eee; }
    .upload-form button { margin-top: 1rem; padding: .6rem 1.4rem; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: .95rem; }
    .upload-form button:hover { background: #2563eb; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; }
    .card { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; overflow: hidden; position: relative; }
    .card img { width: 100%; height: 150px; object-fit: cover; display: block; }
    .order { position: absolute; top: 6px; left: 6px; background: rgba(0,0,0,.65); color: #fff; font-size: .75rem; padding: 2px 6px; border-radius: 4px; }
    .move-btns { display: flex; }
    .move-btns button { flex: 1; padding: .4rem; background: #374151; color: #fff; border: none; cursor: pointer; font-size: .85rem; }
    .move-btns button:hover { background: #4b5563; }
    .move-btns button:disabled { opacity: .3; cursor: default; }
    .del { width: 100%; padding: .5rem; background: #ef4444; color: #fff; border: none; cursor: pointer; font-size: .85rem; }
    .del:hover { background: #dc2626; }
    #status { margin-top: 1rem; font-size: .9rem; color: #4ade80; min-height: 1.2rem; }
  </style>
</head>
<body>
  <h1>Galeria — Gerenciar Imagens</h1>
  <p style="color:#888;margin:-1rem 0 1.5rem"><a href="/admin" style="color:#7dd3fc">← Admin</a> · <a href="/admin/music" style="color:#7dd3fc">Música</a></p>

  <div class="upload-form">
    <label for="fileInput">Adicionar imagem (JPG, PNG, GIF, WebP — máx. 20 MB)</label>
    <input type="file" id="fileInput" accept="image/*" multiple />
    <button onclick="uploadFiles()">Enviar</button>
    <div id="status"></div>
  </div>

  <div class="grid" id="grid">${imageCards}</div>

  <script>
    const API = '${apiBase}';

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
  </script>
</body>
</html>`;
};
