/** `mappings` chega com o `qtd` já contado pela rota. */
const layout = require('./layout');

module.exports = function paginaMusica({ apiBase, albums, mappings }) {
  const opcoes = albums
    .map((a) => `<option value="${a.replace(/"/g, '&quot;')}">${a}</option>`)
    .join('');

  const linhas = mappings.length === 0
    ? '<tr><td colspan="4" class="vazio">Nenhuma tag cadastrada.</td></tr>'
    : mappings.map(({ uid, album, qtd }) => {
        // Álbum sem faixas = pasta renomeada depois do cadastro. Precisa gritar,
        // porque o sintoma sem isso é "encostei a tag e não tocou".
        const aviso = qtd === 0 ? ' <span class="erro">sem faixas!</span>' : '';
        return `<tr>
          <td class="uid">${uid}</td>
          <td>${album}${aviso}</td>
          <td>${qtd}</td>
          <td>
            <button onclick="tocar('${album.replace(/'/g, "\\'")}')">Tocar</button>
            <button class="del" onclick="remover('${uid}', '${album.replace(/'/g, "\\'")}')">Remover</button>
          </td>
        </tr>`;
      }).join('');

  return layout({
    titulo: 'Música — Admin',
    pagina: 'musica',
    apiBase,
    corpo: `
  <h1>Música — Admin</h1>
  <p class="nav"><a href="/admin">← Admin</a> · <a href="/admin/gallery">Galeria</a></p>

  <h2>Cadastrar tag</h2>
  <div class="box">
    <div class="leitor">
      <span>Tag no leitor:</span>
      <span class="pill" id="pill">nenhuma</span>
      <input id="uid" placeholder="UID (ou encoste uma tag)" size="20" />
      <select id="album">${opcoes}</select>
      <button onclick="salvar()">Mapear</button>
    </div>
    <div class="status" id="msg"></div>
  </div>

  <h2>Tags cadastradas</h2>
  <div class="box">
    <table>
      <thead><tr><th>UID</th><th>Álbum</th><th>Faixas</th><th></th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>
  </div>

  <h2>Player</h2>
  <div class="box">
    <div class="leitor">
      <select id="pAlbum" onchange="carregarFaixas()">${opcoes}</select>
      <select id="pFaixa"><option>carregando...</option></select>
      <button onclick="tocarSelecao()">Tocar</button>
    </div>
    <div class="status" id="player">carregando...</div>
    <div class="controles">
      <button onclick="acao('previous')">|◀ Anterior</button>
      <button onclick="acao('pause')">|| Pausar</button>
      <button onclick="acao('resume')">▶ Retomar</button>
      <button onclick="acao('next')">Próxima ▶|</button>
      <button class="del" onclick="acao('stop')">Parar</button>
    </div>
    <div class="controles">
      <button onclick="volume(-10)">Vol −</button>
      <button onclick="volume(10)">Vol +</button>
      <button class="del" onclick="reimportar()">Reimportar catálogo</button>
    </div>
  </div>
`,
  });
};
