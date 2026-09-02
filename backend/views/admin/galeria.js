/** Galeria: reordenar e remover as fotos que a tela mostra. */
const layout = require('./layout');

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

  return layout({
    titulo: 'Galeria — Admin',
    pagina: 'galeria',
    apiBase,
    corpo: `
  <h1>Galeria — Gerenciar Imagens</h1>
  <p style="color:#888;margin:-1rem 0 1.5rem"><a href="/admin" style="color:#7dd3fc">← Admin</a> · <a href="/admin/music" style="color:#7dd3fc">Música</a></p>

  <div class="upload-form">
    <label for="fileInput">Adicionar imagem (JPG, PNG, GIF, WebP — máx. 20 MB)</label>
    <input type="file" id="fileInput" accept="image/*" multiple />
    <button onclick="uploadFiles()">Enviar</button>
    <div id="status"></div>
  </div>

  <div class="grid" id="grid">${imageCards}</div>
`,
  });
};
