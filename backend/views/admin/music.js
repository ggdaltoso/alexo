/** `mappings` chega com o `qtd` já contado pela rota. */
const layout = require('./layout');

module.exports = function musicPage({ apiBase, albums, mappings }) {
  const options = albums
    .map((a) => `<option value="${a.replace(/"/g, '&quot;')}">${a}</option>`)
    .join('');

  const rows = mappings.length === 0
    ? '<tr><td colspan="4" class="empty">Nenhuma tag cadastrada.</td></tr>'
    : mappings.map(({ uid, album, count }) => {
        // Álbum sem tracks = folder renomeada depois do cadastro. Precisa gritar,
        // porque o sintoma sem isso é "encostei a tag e não tocou".
        const notify = count === 0 ? ' <span class="error">sem faixas!</span>' : '';
        return `<tr>
          <td class="uid">${uid}</td>
          <td>${album}${notify}</td>
          <td>${count}</td>
          <td>
            <button onclick="play('${album.replace(/'/g, "\\'")}')">Tocar</button>
            <button class="del" onclick="remove('${uid}', '${album.replace(/'/g, "\\'")}')">Remover</button>
          </td>
        </tr>`;
      }).join('');

  return layout({
    title: 'Música — Admin',
    page: 'music',
    apiBase,
    body: `
  <h1>Música — Admin</h1>
  <p class="nav"><a href="/admin">← Admin</a> · <a href="/admin/gallery">Galeria</a></p>

  <h2>Cadastrar tag</h2>
  <div class="box">
    <div class="reader">
      <span>Tag no leitor:</span>
      <span class="pill" id="pill">nenhuma</span>
      <input id="uid" placeholder="UID (ou encoste uma tag)" size="20" />
      <select id="album">${options}</select>
      <button onclick="save()">Mapear</button>
    </div>
    <div class="status" id="msg"></div>
  </div>

  <h2>Tags cadastradas</h2>
  <div class="box">
    <table>
      <thead><tr><th>UID</th><th>Álbum</th><th>Faixas</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <h2>Player</h2>
  <div class="box">
    <div class="reader">
      <select id="pAlbum" onchange="loadTracks()">${options}</select>
      <select id="pTrack"><option>carregando...</option></select>
      <button onclick="playSelection()">Tocar</button>
    </div>
    <div class="status" id="player">carregando...</div>
    <div class="controls">
      <button onclick="action('previous')">|◀ Anterior</button>
      <button onclick="action('pause')">|| Pausar</button>
      <button onclick="action('resume')">▶ Retomar</button>
      <button onclick="action('next')">Próxima ▶|</button>
      <button class="del" onclick="action('stop')">Parar</button>
    </div>
    <div class="controls">
      <button onclick="volume(-10)">Vol −</button>
      <button onclick="volume(10)">Vol +</button>
      <button class="del" onclick="reimport()">Reimportar catálogo</button>
    </div>
  </div>
`,
  });
};
