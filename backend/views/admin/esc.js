/**
 * Escapa texto que vai para dentro do HTML.
 *
 * Existia duas vezes, e as duas cópias divergiam: a do cliente (no home.js)
 * não tratava null e não escapava `>`. Como a renderização voltou a acontecer
 * só no servidor, passou a haver um lugar só onde isso precisa estar certo.
 */
module.exports = function esc(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};
