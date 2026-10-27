/**
 * Folha de adesivos para as tags NFC, um por tag, pronta para imprimir.
 *
 * Página solta, sem a moldura do 98.css: o que importa aqui é o papel. A tag
 * que tem imagem (enviada pelo "Personalizar" da aba Música) sai com ela; as
 * outras caem no tema do álbum. Cada jogo tem um tema desenhado só com CSS e SVG -- as pastas não trazem capa, e
 * baixar logo de fora deixaria a folha dependendo de rede. Álbum sem tema
 * ganha um genérico, com a cor tirada do nome, para nunca sair em branco.
 */
const esc = require('./esc');

const SVG = (corpo) => `<svg viewBox="0 0 100 100" aria-hidden="true">${corpo}</svg>`;
const TRIFORCE = SVG('<g fill="#f2c94c" stroke="#7a5a00" stroke-width="2">'
  + '<polygon points="50,8 71,44 29,44"/><polygon points="29,44 50,80 8,80"/><polygon points="71,44 92,80 50,80"/></g>');
const ESTRELA = (cor) => SVG(`<polygon fill="${cor}" stroke="#000" stroke-width="3" stroke-linejoin="round"
  points="50,6 61,38 95,38 68,58 78,92 50,72 22,92 32,58 5,38 39,38"/>`);
const BLOCO = SVG('<rect x="8" y="8" width="84" height="84" rx="8" fill="#f8b800" stroke="#7a3d00" stroke-width="5"/>'
  + '<g fill="#7a3d00"><circle cx="20" cy="20" r="4"/><circle cx="80" cy="20" r="4"/><circle cx="20" cy="80" r="4"/><circle cx="80" cy="80" r="4"/></g>'
  + '<text x="50" y="72" text-anchor="middle" font-size="62" font-family="Press Start 2P, monospace" fill="#fff" stroke="#7a3d00" stroke-width="3" paint-order="stroke">?</text>');
const FOLHA = SVG('<path d="M50 6 C86 28 84 72 50 94 C16 72 14 28 50 6 Z" fill="#7ed957" stroke="#1f5c12" stroke-width="4"/>'
  + '<path d="M50 14 V88" stroke="#1f5c12" stroke-width="3"/>');
const BANANA = SVG('<path d="M14 30 Q22 86 88 70 Q92 66 86 64 Q36 70 26 26 Z" fill="#ffe135" stroke="#5c3a00" stroke-width="4" stroke-linejoin="round"/>');
const BANDEIRA = SVG('<rect x="14" y="8" width="77" height="52" rx="3" fill="#fff"/><rect x="14" y="8" width="13" height="88" rx="3" fill="#fff"/>'
  + '<rect x="18" y="12" width="5" height="80" fill="#333"/>'
  + '<rect x="23" y="12" width="64" height="44" fill="#fff" stroke="#000" stroke-width="3"/>'
  + '<g fill="#000"><rect x="23" y="12" width="16" height="11"/><rect x="55" y="12" width="16" height="11"/><rect x="39" y="23" width="16" height="11"/><rect x="71" y="23" width="16" height="11"/>'
  + '<rect x="23" y="34" width="16" height="11"/><rect x="55" y="34" width="16" height="11"/><rect x="39" y="45" width="16" height="11"/><rect x="71" y="45" width="16" height="11"/></g>');
const NOTA = SVG('<path d="M38 18 L82 10 V66" fill="none" stroke="#111" stroke-width="7" stroke-linejoin="round"/>'
  + '<ellipse cx="28" cy="74" rx="14" ry="10" fill="#111"/><ellipse cx="70" cy="68" rx="14" ry="10" fill="#111"/><path d="M38 18 V74" stroke="#111" stroke-width="7"/>');

// Chave = nome da pasta, exatamente como está em uploads/music/.
const TEMAS = {
  'Super Mario World': {
    fundo: 'radial-gradient(circle at 20% 92%, #fff 0 14%, transparent 15%), radial-gradient(circle at 45% 100%, #fff 0 18%, transparent 19%), radial-gradient(circle at 80% 95%, #fff 0 16%, transparent 17%), #5c94fc',
    chapeu: 'SUPER MARIO', titulo: 'WORLD', cor: '#ffd800', contorno: '#c4001a', chapeuCor: '#fff', motivo: BLOCO,
  },
  "Super Mario World 2 - Yoshi's Island": {
    // Ovo do Yoshi: o branco da própria tag vira a casca.
    fundo: 'radial-gradient(circle at 22% 24%, #3cb043 0 9%, transparent 10%), radial-gradient(circle at 78% 30%, #3cb043 0 11%, transparent 12%), radial-gradient(circle at 18% 78%, #3cb043 0 10%, transparent 11%), radial-gradient(circle at 82% 80%, #3cb043 0 8%, transparent 9%), radial-gradient(circle at 50% 8%, #3cb043 0 6%, transparent 7%), #fffdf4',
    chapeu: 'SUPER MARIO WORLD 2', titulo: "YOSHI'S ISLAND", cor: '#e83a3a', contorno: '#fff', chapeuCor: '#2a7d2f', chapeuContorno: '#fff',
  },
  'Super Mario All-Stars': {
    fundo: 'radial-gradient(circle at 50% 40%, #ff4d4d, #b8000f)',
    chapeu: 'SUPER MARIO', titulo: 'ALL-STARS', cor: '#ffd800', contorno: '#000', chapeuCor: '#fff', motivo: ESTRELA('#ffd800'),
  },
  'Pokemon LeafGreen': {
    fundo: 'linear-gradient(160deg, #6fd14a, #2e7d1e)',
    chapeu: 'POKÉMON', titulo: 'LEAFGREEN', cor: '#ffcb05', contorno: '#2a75bb', chapeuCor: '#fff', motivo: FOLHA,
  },
  'Legend of Zelda, The - The Minish Cap': {
    fundo: 'radial-gradient(circle at 50% 35%, #4f9a4a, #1d4a24)',
    chapeu: 'THE LEGEND OF ZELDA', titulo: 'THE MINISH CAP', cor: '#f2c94c', contorno: '#3b2a00', chapeuCor: '#e8f5d0', motivo: TRIFORCE,
  },
  'Legend of Zelda, The - A Link to the Past': {
    fundo: 'radial-gradient(circle at 50% 35%, #8e2626, #3d0b0b)',
    chapeu: 'THE LEGEND OF ZELDA', titulo: 'A LINK TO THE PAST', cor: '#f2c94c', contorno: '#3b2a00', chapeuCor: '#f5e6c8', motivo: TRIFORCE,
  },
  "Donkey Kong Country 3 - Dixie Kong's Double Trouble": {
    fundo: 'repeating-linear-gradient(90deg, #9a6532 0 14%, #6e4320 14% 16%)',
    chapeu: '', titulo: 'DONKEY KONG COUNTRY 3', cor: '#ffd200', contorno: '#5c1a00', chapeuCor: '#fff', motivo: BANANA,
  },
  'Super Mario Kart': {
    fundo: 'repeating-conic-gradient(#111 0 25%, #fff 0 50%) 0 0 / 22% 22%',
    chapeu: 'SUPER MARIO', titulo: 'KART', cor: '#fff', contorno: '#000', chapeuCor: '#fff', faixa: '#e60012', motivo: BANDEIRA,
  },
  Mix: {
    fundo: 'linear-gradient(180deg, #ff5f5f 0 20%, #ffb84d 20% 40%, #ffe66d 40% 60%, #6ed39a 60% 80%, #5fa8ff 80%)',
    chapeu: 'ALEXO', titulo: 'MIX', cor: '#fff', contorno: '#111', chapeuCor: '#111', motivo: NOTA,
  },
};

function temaGenerico(album) {
  let h = 0;
  for (const c of album) h = (h * 31 + c.charCodeAt(0)) % 360;
  return {
    fundo: `linear-gradient(160deg, hsl(${h} 70% 55%), hsl(${h} 70% 30%))`,
    chapeu: '', titulo: album.toUpperCase(), cor: '#fff', contorno: '#000', chapeuCor: '#fff', motivo: NOTA,
  };
}

function adesivo({ album, imagem }) {
  // Imagem enviada pelo editor ganha do tema: já foi recortada para o círculo.
  if (imagem) {
    return `<figure class="adesivo" style="background:#fff url('${esc(imagem)}') center / cover" title="${esc(album)}"></figure>`;
  }
  const t = TEMAS[album] || temaGenerico(album);
  // Título longo encolhe para caber no círculo. A fonte é monoespaçada (1 letra
  // = 1em), então dá para contar: cabe a maior palavra numa linha de 64cqw e o
  // bloco inteiro em ~30cqw de altura. Tudo em cqw, a largura do adesivo.
  const maiorPalavra = Math.max(...t.titulo.split(' ').map((p) => p.length));
  let tam = 13;
  while (tam > 4 && (maiorPalavra * tam > 64
    || Math.ceil((t.titulo.length * tam) / 64) * 1.15 * tam > 30)) tam -= 0.5;
  return `<figure class="adesivo" style="background:${t.fundo}" title="${esc(album)}">
    ${t.motivo ? `<div class="motivo">${t.motivo}</div>` : ''}
    <div class="texto"${t.faixa ? ` style="background:${t.faixa}"` : ''}>
      ${t.chapeu ? `<span class="chapeu" style="color:${t.chapeuCor}${t.chapeuContorno ? `;-webkit-text-stroke:1cqw ${t.chapeuContorno};text-shadow:none` : ''}">${esc(t.chapeu)}</span>` : ''}
      <span class="titulo" style="color:${t.cor};-webkit-text-stroke-color:${t.contorno};font-size:${tam.toFixed(1)}cqw">${esc(t.titulo)}</span>
    </div>
  </figure>`;
}

// Papel adesivo 5x7,5 cm: 2x3 adesivos de 24 mm. 24 e não 25 deixa 1 mm para a
// tesoura entre eles e o adesivo não passa da borda da tag.
const POR_PAPEL = 6;

function papeis(tags) {
  const folhas = [];
  for (let i = 0; i < tags.length; i += POR_PAPEL) {
    folhas.push(`<div class="papel">${tags.slice(i, i + POR_PAPEL).map(adesivo).join('\n')}</div>`);
  }
  return `<div class="previa" id="previa">${folhas.join('\n')}</div>`;
}

module.exports = function etiquetasPage({ tags, papel }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Adesivos das tags</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=block" crossorigin="anonymous" />
  <style>
    /* As tags NTAG215 são redondas de 25 mm. */
    :root { --mm: 25mm; }
    body { margin: 16px; font-family: system-ui, sans-serif; background: #fff; color: #111; }
    .controles { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 16px; }
    .controles input { width: 4.5em; }
    .folha { display: flex; flex-wrap: wrap; gap: 4mm; }
    .adesivo {
      container-type: inline-size; position: relative; margin: 0; overflow: hidden;
      width: var(--mm); height: var(--mm); border-radius: 50%;
      outline: 0.2mm dashed #999; outline-offset: 0.6mm;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      font-family: 'Press Start 2P', monospace; text-align: center;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .quadrado .adesivo { border-radius: 8%; }
    .motivo { width: 34cqw; height: 34cqw; margin-bottom: 3cqw; }
    .motivo svg { width: 100%; height: 100%; display: block; }
    .texto { display: flex; flex-direction: column; align-items: center; gap: 2.5cqw; padding: 2cqw 10cqw; max-width: 80cqw; }
    .chapeu { font-size: 6cqw; line-height: 1.2; paint-order: stroke fill; text-shadow: 0 0 1.5cqw rgba(0,0,0,.6); }
    .titulo { line-height: 1.15; -webkit-text-stroke-width: 1.4cqw; paint-order: stroke fill; }
    @media print { body { margin: 0; } .controles { display: none; } }

    /* Papel 5x7,5: na tela, ampliado e com sombra para parecer o papel. */
    .previa { display: flex; flex-wrap: wrap; gap: 6mm; zoom: 2; }
    .papel {
      --mm: 24mm; width: 50mm; height: 75mm; background: #fff; box-sizing: border-box;
      display: grid; grid-template-columns: repeat(2, 24mm); grid-auto-rows: 24mm;
      gap: 1mm; padding: 0.75mm 0.5mm; justify-content: center;
      box-shadow: 0 0.3mm 1.5mm rgba(0,0,0,.35);
    }
    .papel .adesivo { outline: 0.15mm solid #bbb; outline-offset: 0; }
    ${papel
    ? `@page { size: 50mm 75mm; margin: 0; }
    @media print { .previa { zoom: 1; display: block; } .papel { box-shadow: none; break-after: page; } }`
    : '@page { margin: 10mm; }'}
  </style>
</head>
<body>
  <div class="controles">
    <label>Formato
      <select id="forma"><option value="">Redondo</option><option value="quadrado">Quadrado</option></select>
    </label>
    ${papel ? '' : '<label>Tamanho <input id="mm" type="number" min="15" max="90" value="25" /> mm</label>'}
    <button id="imprimir">Imprimir</button>
    ${papel
    ? `<button id="baixar">Baixar PNGs</button>
    <a href="?">Voltar para folha comum</a>
    <span id="erro" style="color:#c00"></span>
    <span>${Math.ceil(tags.length / POR_PAPEL)} papel(is) de 5×7,5 cm, ${POR_PAPEL} adesivos de 24 mm cada.</span>`
    : `<a href="?papel=5x75">Papel adesivo 5×7,5 cm</a>
    <span>Imprima em 100% (sem "ajustar à página") para o tamanho em mm sair certo.</span>`}
  </div>
  <div class="folha" id="folha">
    ${papel ? papeis(tags) : tags.map(adesivo).join('\n')}
  </div>
  ${papel ? '<script src="https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js"></script>' : ''}
  <script>
    const folha = document.getElementById('folha');
    const mm = document.getElementById('mm');
    if (mm) mm.oninput = (e) => document.documentElement.style.setProperty('--mm', e.target.value + 'mm');
    const baixar = document.getElementById('baixar');
    // Um PNG por papel, a ~384 dpi (756x1134). O zoom da prévia sai durante a
    // captura: com ele, o html-to-image mede o papel ampliado.
    if (baixar) baixar.onclick = async () => {
      const previa = document.getElementById('previa');
      baixar.disabled = true;
      previa.style.zoom = 1;
      try {
        await document.fonts.ready;
        const papeis = document.querySelectorAll('.papel');
        // Passada à mão: deixando o html-to-image embutir sozinho, o PNG saía
        // com a fonte do sistema no lugar da pixelada.
        const fontEmbedCSS = await htmlToImage.getFontEmbedCSS(papeis[0]);
        // 50x75 mm a 96 px/pol = 189x283,5; x4 = 756x1134, proporção exata 2:3.
        const opcoes = { pixelRatio: 4, canvasWidth: 189, canvasHeight: 283.5, fontEmbedCSS, style: { boxShadow: 'none' } };
        for (let i = 0; i < papeis.length; i++) {
          const a = document.createElement('a');
          a.download = 'adesivos-' + (i + 1) + '.png';
          a.href = await htmlToImage.toPng(papeis[i], opcoes);
          a.click();
        }
      } catch (err) {
        document.getElementById('erro').textContent = 'Não deu para gerar os PNGs: ' + err.message;
      } finally {
        previa.style.zoom = '';
        baixar.disabled = false;
      }
    };
    document.getElementById('forma').onchange = (e) => { folha.className = 'folha ' + e.target.value; };
    document.getElementById('imprimir').onclick = () => print();
  </script>
</body>
</html>`;
};
