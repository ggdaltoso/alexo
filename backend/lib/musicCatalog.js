/**
 * Deriva o catálogo de músicas do que está em uploads/music/.
 *
 * Extraído de scripts/import-music.js para que a rota de reimportar e o script
 * de linha de comando compartilhem exatamente a mesma varredura -- duas
 * implementações divergindo geraria ids diferentes para os mesmos arquivos, e id
 * é justamente o que precisa ser estável aqui.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { MUSICA_DIR: MUSIC_DIR } = require('../config');

/**
 * id derivado do caminho, NÃO aleatório.
 *
 * Diferença deliberada em relação ao resto do projeto, que usa randomUUID. Um id
 * aleatório faria cada reimportação gerar ids novos para os mesmos arquivos.
 * Com id derivado do caminho, reimportar é idempotente.
 */
function idFromPath(relative) {
  return crypto.createHash('sha1').update(relative).digest('hex').slice(0, 16);
}

/** `01 Title ~ Link to the Past.mp3` -> `Title ~ Link to the Past` */
function titleFromFile(nomeArquivo) {
  return nomeArquivo
    .replace(/\.mp3$/i, '')
    .replace(/^\d+\s*[-.]?\s*/, '')
    .trim();
}

function walk(dir, base) {
  let found = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found = found.concat(walk(fullPath, base));
    } else if (entry.name.toLowerCase().endsWith('.mp3')) {
      found.push(path.relative(base, fullPath));
    }
  }
  return found;
}

/** Varre o disco e devolve o catálogo, sem gravar nada. */
function scan() {
  return walk(MUSIC_DIR, MUSIC_DIR)
    .sort()
    .map((relative) => {
      const folder = path.dirname(relative);
      return {
        id: idFromPath(relative),
        // Um MP3 solto na raiz não tem pasta pai; `.` viraria um álbum de nome
        // esquisito no admin.
        album: folder === '.' ? 'Sem álbum' : path.basename(folder),
        title: titleFromFile(path.basename(relative)),
        filename: relative,
        duration: null, // só é conhecida na primeira reprodução
      };
    });
}

/** Compara o disco com o catálogo atual, sem gravar. */
function diff(previous, atuais) {
  const idsBefore = new Set(previous.map((t) => t.id));
  const idsAfter = new Set(atuais.map((t) => t.id));
  return {
    added: atuais.filter((t) => !idsBefore.has(t.id)),
    removed: previous.filter((t) => !idsAfter.has(t.id)),
  };
}

module.exports = { scan, diff, MUSIC_DIR };
