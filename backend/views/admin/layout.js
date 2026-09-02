/**
 * Casca das páginas de admin.
 *
 * Existe porque cada view era um documento HTML inteiro por conta própria: o
 * mesmo <head>, o mesmo reset e a mesma paleta repetidos quatro vezes, sem
 * lugar nenhum onde mexer uma vez só.
 *
 * O CSS e o JS de cada página são arquivos de verdade em public/admin/, e não
 * strings: os 404 linhas de JavaScript de cliente que moravam dentro de
 * template literals não tinham destaque de sintaxe, lint nem formatação, e
 * eram a maior parte do código das views.
 *
 * `apiBase` é a única coisa que o servidor precisa contar para o navegador --
 * vazio em produção, absoluto em desenvolvimento. Vai numa linha inline antes
 * do arquivo da página, que a lê em window.ADMIN_API.
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
</head>
<body>
${corpo}

  <script>window.ADMIN_API = '${apiBase}';</script>
  <script src="/admin/assets/${pagina}.js"></script>
</body>
</html>`;
};
