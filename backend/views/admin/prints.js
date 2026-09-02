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

module.exports = function paginaPrints({ apiBase, lista, resumo }) {
  // Nomes de mês à mão em vez de toLocaleDateString('pt-BR'): o Node do Pi é um
  // build não-oficial para armv6l e não dá para contar com o ICU completo. Se
  // faltar, a data vira inglês em silêncio -- e ninguém percebe até estranhar a
  // página meses depois.
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB');

  // Agrupa preservando a ordem que veio (mais recente primeiro).
  const meses = [];
  const porMes = new Map();
  for (const p of lista) {
    const d = new Date(p.em);
    const chave = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    if (!porMes.has(chave)) {
      porMes.set(chave, []);
      meses.push({ chave, rotulo: MESES[d.getMonth()] + ' de ' + d.getFullYear() });
    }
    porMes.get(chave).push(p);
  }

  const cartao = (p) => {
    const d = new Date(p.em);
    const hora = String(d.getDate()).padStart(2, '0') + '/' +
      String(d.getMonth() + 1).padStart(2, '0') + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

    // O contexto só aparece quando existe: uma linha "sem música" repetida em
    // todo cartão seria ruído em cima do que interessa, que é a imagem.
    const contexto = [
      p.musica ? '♪ ' + esc(p.musica.faixa) + (p.musica.album ? ' — ' + esc(p.musica.album) : '') : '',
      p.tag ? 'tag ' + esc(p.tag) : '',
    ].filter(Boolean).map((t) => '<div class="ctx">' + t + '</div>').join('');

    return '<div class="card" data-id="' + esc(p.id) + '">' +
      '<a href="' + apiBase + '/uploads/prints/' + esc(p.arquivo) + '" target="_blank">' +
        '<img src="' + apiBase + '/uploads/prints/' + esc(p.arquivo) + '" alt="Print de ' + esc(hora) + '" />' +
      '</a>' +
      '<div class="corpo">' +
        '<div class="meta">' + esc(hora) +
          (p.largura ? ' · ' + p.largura + '×' + p.altura : '') +
          ' · ' + kb(p.bytes || 0) + '</div>' +
        contexto +
        '<input class="nota-in" value="' + esc(p.nota) + '" maxlength="120" placeholder="sem nota" />' +
      '</div>' +
      '<button class="del">✕ Remover</button>' +
    '</div>';
  };

  const corpo = lista.length === 0
    ? '<p class="vazio">Nenhum print guardado ainda. Tire um print no <a href="/admin">admin</a> e clique em “guardar no Pi”.</p>'
    : meses.map((m) =>
        '<h2>' + m.rotulo + ' <small>' + porMes.get(m.chave).length + '</small></h2>' +
        '<div class="grid">' + porMes.get(m.chave).map(cartao).join('') + '</div>').join('');

  return layout({
    titulo: 'Prints — Admin',
    pagina: 'prints',
    apiBase,
    corpo: `
  <h1>Prints</h1>
  <p class="sub">
    ${resumo.total} print(s), ${kb(resumo.bytes)} no cartão ·
    <a href="/admin">voltar ao admin</a>
  </p>

  ${corpo}

  <div id="aviso"></div>
`,
  });
};
