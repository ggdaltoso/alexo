const layout = require('./layout');

module.exports = function galleryPage({ apiBase, images }) {
  const imageCards = images.length === 0
    ? '<p class="vazio">Nenhuma imagem cadastrada.</p>'
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
    title: 'Galeria — Admin',
    page: 'galeria',
    apiBase,
    body: `
  <h1>Galeria — Gerenciar Imagens</h1>
  <p class="nav"><a href="/admin">← Admin</a> · <a href="/admin/music">Música</a></p>

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
