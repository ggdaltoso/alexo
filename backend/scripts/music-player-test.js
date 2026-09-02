/**
 * Teste de bancada do backend/musicPlayer.js.
 *
 * Exercita a máquina de estados inteira com áudio de verdade: carrega um álbum,
 * pausa, retoma, pula faixa, muda volume e para. Cada transição imprime o status
 * que o musicController vai receber.
 *
 * Monta a lista de faixas varrendo a pasta, porque o importador (que gera
 * music-tracks.json) ainda não existe. O shape é o mesmo que ele vai produzir.
 *
 * Uso:
 *   node backend/scripts/music-player-test.js                # primeiro álbum
 *   node backend/scripts/music-player-test.js "Super Mario World"
 *   MPV_VOLUME=30 node backend/scripts/music-player-test.js
 */
const fs = require('fs');
const path = require('path');

const player = require(path.join(__dirname, '..', 'lib', 'musicPlayer'));

const MUSIC_DIR = path.join(__dirname, '..', 'uploads', 'music');
const VOLUME = Number(process.env.MPV_VOLUME || 50);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function albuns() {
  return fs.readdirSync(MUSIC_DIR).filter((d) => fs.statSync(path.join(MUSIC_DIR, d)).isDirectory());
}

function faixasDe(album, limite) {
  return fs
    .readdirSync(path.join(MUSIC_DIR, album))
    .filter((f) => f.toLowerCase().endsWith('.mp3'))
    .sort()
    .slice(0, limite)
    .map((f) => ({
      id: `${album}/${f}`,
      title: f.replace(/\.mp3$/i, '').replace(/^\d+\s*/, ''),
      album,
      filename: path.join(album, f),
    }));
}

function mostra(rotulo, s) {
  if (!s) {
    console.log(`  ${rotulo}: (sem status)`);
    return;
  }
  const pos = s.position.toFixed(1);
  const dur = s.duration ? s.duration.toFixed(1) : '?';
  console.log(
    `  ${rotulo.padEnd(10)} ${s.isPlaying ? 'tocando' : 'parado '}  ` +
      `faixa ${s.trackCount ? `${s.trackIndex + 1}/${s.trackCount}` : '-/-'}  ${pos}s/${dur}s  vol ${s.volume}  ${s.title || '-'}`
  );
}

async function main() {
  const album = process.argv[2] || albuns()[0];
  if (!album) {
    console.error(`nenhum álbum em ${MUSIC_DIR}`);
    process.exit(1);
  }
  const tracks = faixasDe(album, 3);
  if (!tracks.length) {
    console.error(`nenhum mp3 em ${album}`);
    process.exit(1);
  }

  console.log(`álbum: ${album}`);
  console.log(`faixas: ${tracks.map((t) => t.title).join(' | ')}\n`);

  console.log('subindo o mpv (pode levar ~11s na primeira vez)...');
  const ok = await player.init();
  if (!ok) {
    console.error('o player não subiu.');
    process.exit(1);
  }
  await player.setVolume(VOLUME);

  console.log('\n== tocando o álbum ==');
  mostra('play', await player.playAlbum(album, tracks));
  await sleep(6000);
  mostra('+6s', await player.getStatus());

  console.log('\n== pausa (o gesto de tirar a tag) ==');
  mostra('pause', await player.pause());
  await sleep(2500);
  mostra('+2.5s', await player.getStatus());
  console.log('  ^ a posição tem que estar CONGELADA em relação à linha anterior');

  console.log('\n== retoma (recolocou a mesma tag) ==');
  mostra('resume', await player.resume());
  await sleep(4000);
  mostra('+4s', await player.getStatus());

  console.log('\n== próxima faixa ==');
  await player.next();
  await sleep(3000);
  mostra('next', await player.getStatus());

  console.log('\n== volume ==');
  mostra('vol 20', await player.setVolume(20));
  await sleep(2000);

  console.log('\n== stop ==');
  mostra('stop', await player.stop());

  player.close();
  console.log('\nfim (o mpv fica ocioso de propósito, para o próximo init reaproveitar)');
  process.exit(0);
}

player.on('status', (s) => {
  if (process.env.VERBOSE) mostra('evento', s);
});

main().catch((err) => {
  console.error('explodiu:', err.message);
  process.exit(1);
});
