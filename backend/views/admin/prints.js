/**
 * Histórico de prints.
 *
 * Server-rendered e sem polling, ao contrário do índice: a lista só muda quando
 * alguém guarda ou apaga um print, e as duas coisas passam por aqui.
 *
 * Agrupado por mês porque a pergunta que se faz a um histórico é "como estava
 * em agosto", não "qual é o 47º print". A ordenação por nome de arquivo, que
 * era tudo o que existia antes, continua valendo por baixo -- o carimbo ISO no
 * nome ordena sozinho -- mas deixou de ser a única forma de achar as coisas.
 */
const layout = require('./layout');
const esc = require('./esc');

module.exports = function printsPage({ apiBase, list, summary }) {
  // Nomes de mês à mão em vez de toLocaleDateString('pt-BR'): o Node do Pi é um
  // build não-oficial para armv6l e não dá para contar com o ICU completo. Se
  // faltar, a data vira inglês em silêncio -- e ninguém percebe até estranhar a
  // página meses depois.
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB');

  // Agrupa preservando a ordem que veio (mais recente primeiro).
  const months = [];
  const byMonth = new Map();
  for (const p of list) {
    const d = new Date(p.at);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    if (!byMonth.has(key)) {
      byMonth.set(key, []);
      months.push({ key, label: MESES[d.getMonth()] + ' de ' + d.getFullYear() });
    }
    byMonth.get(key).push(p);
  }

  const card = (p) => {
    const d = new Date(p.at);
    const time = String(d.getDate()).padStart(2, '0') + '/' +
      String(d.getMonth() + 1).padStart(2, '0') + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

    // O contexto só aparece quando existe: uma linha "sem música" repetida em
    // todo cartão seria ruído em cima do que interessa, que é a imagem.
    const context = [
      p.music ? '♪ ' + esc(p.music.track) + (p.music.album ? ' — ' + esc(p.music.album) : '') : '',
      p.tag ? 'tag ' + esc(p.tag) : '',
    ].filter(Boolean).map((t) => '<div class="context">' + t + '</div>').join('');

    return '<div class="card" data-id="' + esc(p.id) + '">' +
      '<a href="' + apiBase + '/uploads/prints/' + esc(p.file) + '" target="_blank">' +
        '<img src="' + apiBase + '/uploads/prints/' + esc(p.file) + '" alt="Print de ' + esc(time) + '" />' +
      '</a>' +
      '<div class="body">' +
        '<div class="meta">' + esc(time) +
          (p.width ? ' · ' + p.width + '×' + p.height : '') +
          ' · ' + kb(p.bytes || 0) + '</div>' +
        context +
        '<input class="note-input" value="' + esc(p.note) + '" maxlength="120" placeholder="sem nota" />' +
      '</div>' +
      '<button class="del">✕ Remover</button>' +
    '</div>';
  };

  const body = list.length === 0
    ? '<p class="empty">Nenhum print guardado ainda. Tire um print no <a href="/admin">admin</a> e clique em “guardar no Pi”.</p>'
    : months.map((m) =>
        '<h2>' + m.label + ' <small>' + byMonth.get(m.key).length + '</small></h2>' +
        '<div class="grid">' + byMonth.get(m.key).map(card).join('') + '</div>').join('');

  return layout({
    title: 'Prints — Admin',
    page: 'prints',
    apiBase,
    body: `
  <h1>Prints</h1>
  <p class="subtitle">
    ${summary.total} print(s), ${kb(summary.bytes)} no cartão ·
    <a href="/admin">voltar ao admin</a>
  </p>

  ${body}

  <div id="notice"></div>
`,
  });
};
