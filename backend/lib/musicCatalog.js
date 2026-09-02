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

function varrer(dir, base) {
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

/** Varre o disco e devolve o catálogo, sem gravar nada. */
function scan() {
  return varrer(MUSIC_DIR, MUSIC_DIR)
    .sort()
    .map((relativo) => {
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
}

/** Compara o disco com o catálogo atual, sem gravar. */
function diff(anteriores, atuais) {
  const idsAntes = new Set(anteriores.map((t) => t.id));
  const idsDepois = new Set(atuais.map((t) => t.id));
  return {
    novos: atuais.filter((t) => !idsAntes.has(t.id)),
    sumidos: anteriores.filter((t) => !idsDepois.has(t.id)),
  };
}

module.exports = { scan, diff, MUSIC_DIR };
