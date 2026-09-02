/**
 * Casca das páginas de admin.
 *
 * `apiBase` é a única coisa que o servidor conta para o navegador: sai numa
 * linha inline antes do arquivo da página, que a lê em window.ADMIN_API.
 */
module.exports = function layout({ titulo, pagina, apiBase, corpo }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titulo}</title>
  <link rel="stylesheet" href="/admin/assets/base.css" />
  <link rel="stylesheet" href="/admin/assets/${pagina}.css" />
  <script src="/admin/assets/vendor/htmx.min.js" defer></script>
</head>
<body>
${corpo}

  <script>window.ADMIN_API = '${apiBase}';</script>
  <script src="/admin/assets/${pagina}.js"></script>
</body>
</html>`;
};
