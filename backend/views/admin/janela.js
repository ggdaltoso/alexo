/**
 * A moldura das páginas de admin no 98.css: a janela "Alexo — Admin", as abas
 * no topo e, se houver o que dizer, uma barra de status embaixo.
 *
 * `status` são os campos da barra, já em HTML; cada um vira uma divisória.
 */
const abas = require('./abas');

module.exports = function janela({ aba, conteudo, status = [] }) {
  const barra = status.length
    ? `
    <div class="status-bar">
      ${status.map((s) => `<p class="status-bar-field">${s}</p>`).join('')}
    </div>`
    : '';

  return `
  <div class="window janela">
    <div class="title-bar">
      <div class="title-bar-text">Alexo — Admin</div>
    </div>
    <div class="window-body">
${abas(aba, conteudo)}
    </div>${barra}
  </div>
`;
};
