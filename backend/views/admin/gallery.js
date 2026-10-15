const layout = require('./layout');
const janela = require('./janela');
const esc = require('./esc');

module.exports = function galleryPage({ apiBase, images }) {
  const imageCards = images.length === 0
    ? '<p class="empty">Nenhuma imagem na galeria.</p>'
    : [...images].sort((a, b) => a.order - b.order).map((img, i, arr) => `
      <div class="card" data-id="${esc(img.id)}" data-order="${img.order}">
        <div class="sunken-panel moldura">
          <span class="order">#${img.order}</span>
          <img src="${esc(apiBase + img.url)}" alt="${esc(img.filename)}" />
        </div>
        <div class="field-row botoes">
          <button data-mover="-1" ${i === 0 ? 'disabled' : ''}>↑ Subir</button>
          <button data-mover="1" ${i === arr.length - 1 ? 'disabled' : ''}>↓ Descer</button>
          <button data-remover>Remover</button>
        </div>
      </div>`).join('');

  return layout({
    title: 'Galeria — Admin',
    page: 'gallery',
    apiBase,
    body: janela({
      aba: 'gallery',
      status: [`${images.length} imagens na galeria`],
      conteudo: `
  <fieldset>
    <legend>Adicionar imagens</legend>
    <div class="field-row linha">
      <input type="file" id="fileInput" accept="image/*" multiple />
      <button id="btEnviar">Enviar</button>
    </div>
    <p class="note">JPG, PNG, GIF ou WebP, até 20 MB cada.</p>
    <p class="status" id="status"></p>
  </fieldset>

  <fieldset>
    <legend>Imagens</legend>
    <div class="grid" id="grid">${imageCards}</div>
  </fieldset>
`,
    }),
  });
};
