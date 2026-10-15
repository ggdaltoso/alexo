/** `mappings` chega com o `count` já contado pela rota. */
const layout = require('./layout');
const janela = require('./janela');
const esc = require('./esc');

module.exports = function musicPage({ apiBase, albums, mappings }) {
  const options = albums
    .map((a) => `<option value="${esc(a)}">${esc(a)}</option>`)
    .join('');

  // O álbum e o UID vão em data-*, escapados, e o music.js lê de lá. Antes iam
  // dentro de um onclick inline, e um álbum com aspas no nome quebrava o botão.
  const rows = mappings.length === 0
    ? '<tr><td colspan="4" class="empty">Nenhuma tag cadastrada.</td></tr>'
    : mappings.map(({ uid, album, count }) => {
        // Álbum sem faixas = pasta renomeada depois do cadastro. Precisa gritar,
        // porque o sintoma sem isso é "encostei a tag e não tocou".
        const notify = count === 0
          ? ' <span class="error">sem faixas: a pasta mudou de nome?</span>'
          : '';
        return `<tr>
          <td class="uid">${esc(uid)}</td>
          <td>${esc(album)}${notify}</td>
          <td class="num">${count}</td>
          <td class="acoes">
            <button data-tocar="${esc(album)}">Tocar</button>
            <button data-remover="${esc(uid)}" data-album="${esc(album)}">Remover</button>
          </td>
        </tr>`;
      }).join('');

  return layout({
    title: 'Música — Admin',
    page: 'music',
    apiBase,
    body: janela({
      aba: 'music',
      status: [`${albums.length} álbuns`, `${mappings.length} tags cadastradas`],
      conteudo: `
  <fieldset>
    <legend>Cadastrar tag</legend>
    <div class="field-row linha">
      <span>Tag no leitor:</span>
      <span class="pill" id="pill">Nenhuma</span>
    </div>
    <div class="field-row linha">
      <input id="uid" type="text" placeholder="UID (ou encoste uma tag)" size="20" />
      <select id="album">${options}</select>
      <button id="btCadastrar">Cadastrar</button>
    </div>
    <p class="status" id="msg"></p>
  </fieldset>

  <fieldset>
    <legend>Tags cadastradas</legend>
    <div class="sunken-panel tabela">
      <table>
        <thead><tr><th>UID</th><th>Álbum</th><th class="num">Faixas</th><th></th></tr></thead>
        <tbody id="tags">${rows}</tbody>
      </table>
    </div>
  </fieldset>

  <fieldset>
    <legend>Player</legend>
    <div class="field-row linha">
      <select id="pAlbum">${options}</select>
      <select id="pTrack"><option>Carregando…</option></select>
      <button id="btTocar">Tocar</button>
    </div>
    <p class="status" id="player">Carregando…</p>
    <div class="field-row linha">
      <button data-acao="previous"><span class="icone" aria-hidden="true">|◀</span>Anterior</button>
      <button data-acao="pause"><span class="icone" aria-hidden="true">||</span>Pausar</button>
      <button data-acao="resume"><span class="icone" aria-hidden="true">▶</span>Retomar</button>
      <button data-acao="next">Próxima<span class="icone" aria-hidden="true">▶|</span></button>
      <button data-acao="stop"><span class="icone" aria-hidden="true">■</span>Parar</button>
    </div>
    <div class="field-row linha">
      <button data-volume="-10">Volume −</button>
      <button data-volume="10">Volume +</button>
      <button id="btReimportar">Reimportar catálogo</button>
    </div>
  </fieldset>
`,
    }),
  });
};
