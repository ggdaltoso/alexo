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
    : mappings.map(({ uid, album, count, imagem }) => {
        // Álbum sem faixas = pasta renomeada depois do cadastro. Precisa gritar,
        // porque o sintoma sem isso é "encostei a tag e não tocou".
        const notify = count === 0
          ? ' <span class="error">sem faixas: a pasta mudou de nome?</span>'
          : '';
        return `<tr>
          <td class="uid">${esc(uid)}</td>
          <td>${imagem ? `<img class="mini" src="${esc(imagem)}" alt="" />` : ''}${esc(album)}${notify}</td>
          <td class="num">${count}</td>
          <td class="acoes">
            <button data-personalizar="${esc(uid)}" data-album="${esc(album)}" data-imagem="${esc(imagem || '')}">Personalizar</button>
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
    <form class="field-row linha" action="/admin/music/etiquetas" target="_blank">
      <button>Adesivos de todas as tags</button>
    </form>
  </fieldset>

  <dialog class="dialogo editor" id="editor">
    <div class="window">
      <div class="title-bar"><div class="title-bar-text" id="edTitulo">Personalizar tag</div></div>
      <div class="window-body">
        <p>Arraste para posicionar e use o zoom. O círculo é o adesivo de 25 mm.</p>
        <canvas id="edCanvas" width="280" height="280"></canvas>
        <div class="field-row">
          <label for="edZoom">Zoom</label>
          <input id="edZoom" type="range" min="1" max="5" step="0.01" value="1" />
        </div>
        <section class="field-row dialogo-botoes">
          <label class="button-like"><input id="edArquivo" type="file" accept="image/*" hidden />Escolher imagem…</label>
          <button id="edRemover">Usar o tema</button>
          <button id="edCancelar">Cancelar</button>
          <button id="edSalvar">Salvar</button>
        </section>
      </div>
    </div>
  </dialog>

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
