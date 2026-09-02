/**
 * Gera o catálogo de músicas a partir do que já está em backend/uploads/music/.
 *
 * A varredura em si mora em backend/musicCatalog.js, compartilhada com a rota
 * POST /api/music/import -- duas implementações divergindo gerariam ids
 * diferentes para os mesmos arquivos.
 *
 * Uso:
 *   node backend/scripts/import-music.js            # varre e grava
 *   node backend/scripts/import-music.js --dry-run  # só relata o que faria
 */
const fs = require('fs');
const path = require('path');

const state = require(path.join(__dirname, '..', 'lib', 'state'));
const catalog = require(path.join(__dirname, '..', 'lib', 'musicCatalog'));

const DRY_RUN = process.argv.includes('--dry-run');

function main() {
  if (!fs.existsSync(catalog.MUSIC_DIR)) {
    console.error(`${catalog.MUSIC_DIR} não existe — nada a importar.`);
    process.exit(1);
  }

  const tracks = catalog.scan();
  if (!tracks.length) {
    console.error(`nenhum .mp3 em ${catalog.MUSIC_DIR}`);
    process.exit(1);
  }

  const previous = state.getTracks();
  const { added, removed } = catalog.diff(previous, tracks);

  const byAlbum = new Map();
  for (const t of tracks) byAlbum.set(t.album, (byAlbum.get(t.album) || 0) + 1);

  console.log(`${tracks.length} faixa(s) em ${byAlbum.size} álbum(ns):\n`);
  // Comparador explícito: o sort() padrão converte cada par em "album,qtd" e
  // compara a string inteira, então a vírgula participa da ordenação e
  // "Super Mario World 2" acaba antes de "Super Mario World".
  for (const [album, count] of [...byAlbum].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${String(count).padStart(4)}  ${album}`);
  }

  console.log(`\ncatálogo atual: ${previous.length} faixa(s)`);
  console.log(`  entram: ${added.length}`);
  console.log(`  saem:   ${removed.length}`);
  for (const t of removed.slice(0, 10)) console.log(`    - ${t.filename}`);
  if (removed.length > 10) console.log(`    ... e mais ${removed.length - 10}`);

  if (DRY_RUN) {
    console.log('\n--dry-run: nada foi gravado.');
    return;
  }

  // Uma única escrita, não uma por faixa -- ver replaceTracks em state.js.
  state.replaceTracks(tracks);
  console.log('\ngravado em backend/data/music-tracks.json');
}

main();
