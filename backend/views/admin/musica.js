/**
 * Cadastro de tags NFC e controle do player.
 *
 * `mappings` chega com o `qtd` já contado pela rota: contar faixas aqui exigiria
 * que a view conhecesse o state, e o que ela precisa saber é só quantas são.
 */
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

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Música — Admin</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #111; color: #eee; margin: 0; padding: 2rem; }
    h1 { font-size: 1.5rem; margin: 0 0 1.5rem; }
    h2 { font-size: 1.1rem; margin: 2rem 0 .75rem; color: #aaa; font-weight: 600; }
    .box { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; padding: 1.25rem; }
    select, input { padding: .5rem; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #eee; font-size: .95rem; }
    select { min-width: 18rem; }
    button { padding: .5rem 1rem; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: .9rem; }
    button:hover { background: #2563eb; }
    button.del { background: #444; }
    button.del:hover { background: #b91c1c; }
    button:disabled { background: #333; color: #777; cursor: not-allowed; }
    table { width: 100%; border-collapse: collapse; margin-top: .5rem; }
    th, td { text-align: left; padding: .6rem .5rem; border-bottom: 1px solid #2a2a2a; font-size: .9rem; }
    th { color: #888; font-weight: 600; font-size: .8rem; text-transform: uppercase; }
    .uid { font-family: ui-monospace, monospace; color: #7dd3fc; }
    .vazio { color: #888; text-align: center; padding: 1.5rem; }
    .erro { color: #f87171; font-size: .8rem; }
    .leitor { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .pill { font-family: ui-monospace, monospace; padding: .35rem .7rem; border-radius: 999px; background: #2a2a2a; color: #888; }
    .pill.viva { background: #064e3b; color: #6ee7b7; }
    .status { margin-top: .75rem; color: #aaa; font-size: .9rem; }
    .controles { display: flex; gap: .5rem; margin-top: .75rem; flex-wrap: wrap; }
    a { color: #7dd3fc; }
  </style>
</head>
<body>
  <h1>Música — Admin</h1>
  <p style="color:#888;margin:-1rem 0 1.5rem"><a href="/admin">← Admin</a> · <a href="/admin/gallery">Galeria</a></p>

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

  <script>
    const API = '${apiBase}';
    let volAtual = 100;

    function aviso(t, erro) {
      const el = document.getElementById('msg');
      el.textContent = t;
      el.style.color = erro ? '#f87171' : '#6ee7b7';
    }

    async function salvar() {
      const uid = document.getElementById('uid').value.trim().toUpperCase();
      const album = document.getElementById('album').value;
      if (!uid) return aviso('Encoste uma tag ou digite o UID.', true);
      const r = await fetch(API + '/api/music/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, album }),
      });
      if (r.ok) location.reload();
      else aviso((await r.json()).error, true);
    }

    async function remover(uid, album) {
      // Confirmação porque a ação é destrutiva e o botão fica ao lado de
      // "Tocar", que é inofensivo.
      if (!confirm('Remover o mapeamento da tag ' + uid + ' (' + album + ')?')) return;
      await fetch(API + '/api/music/tags/' + uid, { method: 'DELETE' });
      location.reload();
    }

    async function tocar(album, trackId) {
      await fetch(API + '/api/music/player/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ album, trackId }),
      });
      atualizarPlayer();
    }

    // Preenche o seletor de faixas do álbum escolhido. A primeira opção é
    // "álbum inteiro" (trackId vazio): tocar do começo é o caso comum, e sem ela
    // seria preciso escolher a faixa 1 explicitamente.
    async function carregarFaixas() {
      const album = document.getElementById('pAlbum').value;
      const sel = document.getElementById('pFaixa');
      sel.innerHTML = '<option value="">carregando...</option>';
      try {
        const r = await fetch(API + '/api/music/tracks?album=' + encodeURIComponent(album));
        const faixas = await r.json();
        sel.innerHTML = '<option value="">— álbum inteiro (' + faixas.length + ' faixas) —</option>' +
          faixas.map((t, i) =>
            '<option value="' + t.id + '">' + String(i + 1).padStart(2, '0') + '. ' +
            t.title.replace(/</g, '&lt;') + '</option>').join('');
      } catch (e) {
        sel.innerHTML = '<option value="">erro ao carregar</option>';
      }
    }

    function tocarSelecao() {
      tocar(document.getElementById('pAlbum').value, document.getElementById('pFaixa').value || undefined);
    }

    async function acao(nome) {
      await fetch(API + '/api/music/player/' + nome, { method: 'POST' });
      atualizarPlayer();
    }

    async function volume(delta) {
      volAtual = Math.max(0, Math.min(100, volAtual + delta));
      await fetch(API + '/api/music/player/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: volAtual }),
      });
      atualizarPlayer();
    }

    async function reimportar() {
      const r = await fetch(API + '/api/music/import', { method: 'POST' });
      const d = await r.json();
      if (r.ok) {
        aviso(d.total + ' faixas (' + d.novos + ' novas, ' + d.sumidos + ' removidas)');
        setTimeout(() => location.reload(), 1200);
      } else aviso(d.error, true);
    }

    // Preenche o UID sozinho com a tag que estiver no leitor. É o que evita
    // digitar hexadecimal a mão -- e o UID vem do mesmo caminho que o player usa,
    // então não tem como divergir.
    async function lerTag() {
      try {
        const r = await fetch(API + '/api/music/reader');
        const d = await r.json();
        const pill = document.getElementById('pill');
        const campo = document.getElementById('uid');
        if (d.tag) {
          pill.textContent = d.tag.uid;
          pill.className = 'pill viva';
          if (document.activeElement !== campo) campo.value = d.tag.uid;
        } else {
          pill.textContent = d.running ? 'nenhuma' : 'leitor off';
          pill.className = 'pill';
        }
      } catch (e) { /* backend reiniciando: a próxima volta pega */ }
    }

    async function atualizarPlayer() {
      try {
        const r = await fetch(API + '/api/music/player/status');
        const s = await r.json();
        volAtual = s.volume;
        const el = document.getElementById('player');
        if (!s.title) {
          el.textContent = 'nada tocando  ·  volume ' + s.volume;
          return;
        }
        const mm = (v) => String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(Math.floor(v % 60)).padStart(2, '0');
        el.textContent = (s.isPlaying ? '▶ ' : '|| ') + s.album + '  ·  ' + s.title +
          '  ·  faixa ' + (s.trackIndex + 1) + '/' + s.trackCount +
          '  ·  ' + mm(s.position) + (s.duration ? ' / ' + mm(s.duration) : '') +
          '  ·  vol ' + s.volume;
      } catch (e) { /* idem */ }
    }

    lerTag(); atualizarPlayer(); carregarFaixas();
    setInterval(lerTag, 1000);
    setInterval(atualizarPlayer, 2000);
  </script>
</body>
</html>`;
};
