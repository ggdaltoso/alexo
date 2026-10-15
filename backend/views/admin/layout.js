/**
 * Casca das páginas de admin.
 *
 * `apiBase` é a única coisa que o servidor conta para o navegador: sai numa
 * linha inline antes do arquivo da página, que a lê em window.ADMIN_API.
 *
 * `ui98` marca as páginas já migradas para o 98.css: elas trocam o base.css
 * pelo base98.css e ganham o dialogo.js, que substitui alert/confirm. Some
 * quando a última página migrar.
 */
module.exports = function layout({ title, page, apiBase, body, ui98 = false }) {
  const base = ui98
    ? `<link rel="stylesheet" href="/admin/assets/vendor/98/98.css" />
  <link rel="stylesheet" href="/admin/assets/base98.css" />`
    : '<link rel="stylesheet" href="/admin/assets/base.css" />';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  ${base}
  <link rel="stylesheet" href="/admin/assets/${page}.css" />
  <script src="/admin/assets/vendor/htmx.min.js" defer></script>
</head>
<body>
${body}

  <script>window.ADMIN_API = '${apiBase}';</script>
  ${ui98 ? '<script src="/admin/assets/dialogo.js"></script>' : ''}
  <script src="/admin/assets/${page}.js"></script>
</body>
</html>`;
};
