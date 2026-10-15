/**
 * As abas do admin: a navegação entre as páginas, no formato de abas do 98.css.
 *
 * São links de verdade, cada aba carrega a sua página -- o 98.css só pede o
 * `role="tab"` para desenhar. A aba da página atual vem marcada e o conteúdo
 * entra no painel logo abaixo, que é o que faz a aba parecer "presa" nele.
 */
const ABAS = [
  { key: 'home', href: '/admin', label: 'Início' },
  { key: 'gallery', href: '/admin/gallery', label: 'Galeria' },
  { key: 'music', href: '/admin/music', label: 'Música' },
  { key: 'prints', href: '/admin/prints', label: 'Prints' },
];

module.exports = function abas(atual, conteudo) {
  const itens = ABAS.map((a) => {
    const sel = a.key === atual;
    return `<li role="tab"${sel ? ' aria-selected="true"' : ''}>` +
      `<a href="${a.href}"${sel ? ' aria-current="page"' : ''}>${a.label}</a></li>`;
  }).join('');

  return `<menu role="tablist">${itens}</menu>
  <div class="window" role="tabpanel">
    <div class="window-body">
${conteudo}
    </div>
  </div>`;
};
