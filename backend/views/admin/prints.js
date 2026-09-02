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
module.exports = function paginaPrints({ apiBase, lista, resumo }) {
  // Nomes de mês à mão em vez de toLocaleDateString('pt-BR'): o Node do Pi é um
  // build não-oficial para armv6l e não dá para contar com o ICU completo. Se
  // faltar, a data vira inglês em silêncio -- e ninguém percebe até estranhar a
  // página meses depois.
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prints — Admin</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #111; color: #eee; margin: 0; padding: 2rem; }
    h1 { margin: 0 0 .25rem; font-size: 1.4rem; }
    .sub { color: #888; font-size: .9rem; margin: 0 0 1.5rem; }
    .sub a { color: #3b82f6; }
    h2 { font-size: .8rem; margin: 2rem 0 .75rem; color: #888; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
    h2 small { color: #555; font-weight: 400; text-transform: none; letter-spacing: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
    .card { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; overflow: hidden; }
    /* A tela é 480x320 e a UI é pixelada de propósito; sem o pixelated o
       navegador suaviza e mostra uma tela que não é a que estava lá. */
    .card img { width: 100%; display: block; image-rendering: pixelated; background: #000; }
    .corpo { padding: .6rem .7rem; }
    .meta { color: #888; font-size: .75rem; font-family: ui-monospace, monospace; }
    .ctx { color: #6ee7b7; font-size: .75rem; margin-top: .3rem; }
    .nota-in { width: 100%; margin-top: .5rem; padding: .35rem .5rem; background: #111; color: #eee; border: 1px solid #333; border-radius: 4px; font-family: inherit; font-size: .8rem; }
    .nota-in:focus { outline: none; border-color: #3b82f6; }
    .nota-in::placeholder { color: #555; font-style: italic; }
    .del { width: 100%; padding: .45rem; background: #2a2a2a; color: #888; border: none; border-top: 1px solid #333; cursor: pointer; font-size: .8rem; font-family: inherit; }
    .del:hover { background: #7f1d1d; color: #fff; }
    .vazio { color: #888; text-align: center; margin: 3rem 0; }
    .vazio a { color: #3b82f6; }
    #aviso { position: fixed; bottom: 1rem; right: 1rem; background: #1e3a2f; color: #6ee7b7; border: 1px solid #2f6b52; padding: .6rem 1rem; border-radius: 6px; font-size: .85rem; opacity: 0; transition: opacity .2s; pointer-events: none; }
    #aviso.on { opacity: 1; }
  </style>
</head>
<body>
  <h1>Prints</h1>
  <p class="sub">
    ${resumo.total} print(s), ${kb(resumo.bytes)} no cartão ·
    <a href="/admin">voltar ao admin</a>
  </p>

  ${corpo}

  <div id="aviso"></div>

  <script>
    const API = '${apiBase}';

    function avisar(texto) {
      const el = document.getElementById('aviso');
      el.textContent = texto;
      el.classList.add('on');
      clearTimeout(el._t);
      el._t = setTimeout(() => el.classList.remove('on'), 1800);
    }

    /*
     * A nota salva ao sair do campo, e não a cada tecla: são escritas no cartão
     * SD, e uma por caractere digitado é justamente o que este projeto evita em
     * todo lugar. Enter também salva, para quem não quer clicar fora.
     */
    document.addEventListener('change', async (ev) => {
      const campo = ev.target.closest('.nota-in');
      if (!campo) return;

      const id = campo.closest('.card').dataset.id;
      try {
        const r = await fetch(API + '/api/prints/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nota: campo.value }),
        });
        if (!r.ok) throw new Error((await r.json()).error || 'Falhou');
        avisar('nota salva');
      } catch (e) {
        alert('Não deu para salvar a nota: ' + e.message);
      }
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && ev.target.closest('.nota-in')) ev.target.blur();
    });

    document.addEventListener('click', async (ev) => {
      const bt = ev.target.closest('.del');
      if (!bt) return;

      const cartao = bt.closest('.card');
      // Apagar um print não tem desfazer e o arquivo sai do cartão junto.
      if (!confirm('Remover este print? O arquivo sai do Pi.')) return;

      try {
        const r = await fetch(API + '/api/prints/' + cartao.dataset.id, { method: 'DELETE' });
        if (!r.ok) throw new Error((await r.json()).error || 'Falhou');
        cartao.remove();
        avisar('print removido');
      } catch (e) {
        alert('Não deu para remover: ' + e.message);
      }
    });
  </script>
</body>
</html>`;
};
