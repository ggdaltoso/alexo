/**
 * Gera o catálogo de músicas a partir do que já está em backend/uploads/music/.
 *
 * O desenho original assumia upload manual de poucas faixas pela /admin/music. A
 * realidade é outra: já existem centenas de MP3s copiados para o Pi, em pastas
 * de álbum. Subir isso um a um por formulário é inviável, então o catálogo é
 * derivado do disco.
 *
 * Uso:
 *   node backend/scripts/import-music.js            # varre e grava
 *   node backend/scripts/import-music.js --dry-run  # só relata o que faria
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const state = require(path.join(__dirname, '..', 'state'));

const MUSIC_DIR = path.join(__dirname, '..', 'uploads', 'music');
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * id derivado do caminho, NÃO aleatório.
 *
 * Essa é a diferença crítica em relação ao resto do projeto, que usa randomUUID.
 * Um id aleatório faria cada re-execução gerar ids novos para os mesmos
 * arquivos. Com id derivado do caminho, reimportar é idempotente: arquivos novos
 * entram, removidos saem, e os que continuam lá mantêm o id.
 *
 * Contrapartida a aceitar: renomear ou mover um arquivo muda o id. Desde que a
 * tag mapeia para o *álbum* e não para a faixa, isso deixou de órfãos
 * mapeamento nenhum -- só renomear a pasta quebra, o que é raro e visível.
 */
function idDoCaminho(relativo) {
  return crypto.createHash('sha1').update(relativo).digest('hex').slice(0, 16);
}

/** `01 Title ~ Link to the Past.mp3` -> `Title ~ Link to the Past` */
function tituloDoArquivo(nomeArquivo) {
  return nomeArquivo
    .replace(/\.mp3$/i, '')
    .replace(/^\d+\s*[-.]?\s*/, '')
    .trim();
}

function varrer(dir, base = dir) {
  let achados = [];
  let entradas;
  try {
    entradas = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  for (const entrada of entradas) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      achados = achados.concat(varrer(completo, base));
    } else if (entrada.name.toLowerCase().endsWith('.mp3')) {
      achados.push(path.relative(base, completo));
    }
  }
  return achados;
}

function main() {
  if (!fs.existsSync(MUSIC_DIR)) {
    console.error(`${MUSIC_DIR} não existe — nada a importar.`);
    process.exit(1);
  }

  const arquivos = varrer(MUSIC_DIR).sort();
  if (!arquivos.length) {
    console.error(`nenhum .mp3 em ${MUSIC_DIR}`);
    process.exit(1);
  }

  const tracks = arquivos.map((relativo) => {
    const pasta = path.dirname(relativo);
    return {
      id: idDoCaminho(relativo),
      // Um MP3 solto na raiz não tem pasta pai; `.` viraria um álbum de nome
      // esquisito no admin.
      album: pasta === '.' ? 'Sem álbum' : path.basename(pasta),
      title: tituloDoArquivo(path.basename(relativo)),
      filename: relativo,
      duration: null, // só é conhecida na primeira reprodução
    };
  });

  const anteriores = state.getTracks();
  const idsAntes = new Set(anteriores.map((t) => t.id));
  const idsDepois = new Set(tracks.map((t) => t.id));
  const novos = tracks.filter((t) => !idsAntes.has(t.id));
  const sumidos = anteriores.filter((t) => !idsDepois.has(t.id));

  const porAlbum = new Map();
  for (const t of tracks) porAlbum.set(t.album, (porAlbum.get(t.album) || 0) + 1);

  console.log(`${tracks.length} faixa(s) em ${porAlbum.size} álbum(ns):\n`);
  // Comparador explícito: o sort() padrão converte cada par em "album,qtd" e
  // compara a string inteira, então a vírgula participa da ordenação e
  // "Super Mario World 2" acaba antes de "Super Mario World".
  for (const [album, qtd] of [...porAlbum].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${String(qtd).padStart(4)}  ${album}`);
  }

  console.log(`\ncatálogo atual: ${anteriores.length} faixa(s)`);
  console.log(`  entram: ${novos.length}`);
  console.log(`  saem:   ${sumidos.length}`);
  if (sumidos.length) {
    for (const t of sumidos.slice(0, 10)) console.log(`    - ${t.filename}`);
    if (sumidos.length > 10) console.log(`    ... e mais ${sumidos.length - 10}`);
  }

  if (DRY_RUN) {
    console.log('\n--dry-run: nada foi gravado.');
    return;
  }

  // Uma única escrita, não uma por faixa -- ver replaceTracks em state.js.
  state.replaceTracks(tracks);
  console.log(`\ngravado em backend/data/music-tracks.json`);
}

main();
