/**
 * A cola entre o leitor NFC, o player e o resto do backend.
 *
 * É o único módulo que enxerga nfcReader, musicPlayer, state e ws ao mesmo
 * tempo. Os dois primeiros não se conhecem de propósito: o leitor não sabe o que
 * é música e o player não sabe o que é tag.
 *
 * Regras do gesto:
 *   tag encostada, sem mapeamento     -> ignora
 *   tag encostada, é a que pausou     -> retoma de onde parou
 *   tag encostada, é outra            -> troca de álbum, começa do zero
 *   tag removida, é a que está ativa  -> pausa
 *   tag removida, é outra             -> ignora
 */
const nfcReader = require('./nfcReader');
const musicPlayer = require('./musicPlayer');
const state = require('./state');
const wsServer = require('./ws');

// Rede de segurança contra drift do relógio do cliente, que interpola a posição
// localmente entre transições. Não é streaming: 10s é ordens de grandeza abaixo
// de um broadcast por segundo, que este projeto não tem precedente de fazer.
const REBROADCAST_MS = 10000;

let rebroadcastTimer = null;

function broadcastStatus(status) {
  wsServer.broadcast({
    type: 'music_playback_state',
    ...status,
    activeTagUid: state.getPlayerState().activeTagUid,
    timestamp: Date.now(),
  });
}

function agendarRebroadcast() {
  if (rebroadcastTimer) clearInterval(rebroadcastTimer);
  rebroadcastTimer = setInterval(async () => {
    const player = state.getPlayerState();
    if (!player.isPlaying) return;
    const status = await musicPlayer.getStatus();
    if (status) {
      state.setPlayerState(status);
      broadcastStatus(status);
    }
  }, REBROADCAST_MS);
  // Não segurar o processo vivo só por causa deste timer.
  if (rebroadcastTimer.unref) rebroadcastTimer.unref();
}

async function onTagPresent({ uid }) {
  const mapeamento = state.getTagMapping(uid);
  if (!mapeamento) {
    console.log(`[music] tag ${uid} sem álbum mapeado — ignorando`);
    return;
  }

  const player = state.getPlayerState();

  if (player.pausedUid === uid) {
    // Mesma tag que acabou de sair: retomar preserva a posição, que é o efeito
    // que faz a caixinha parecer ter memória.
    console.log(`[music] tag ${uid} de volta — retomando ${mapeamento.album}`);
    state.setPlayerState({ activeTagUid: uid, pausedUid: null });
    await musicPlayer.resume();
    return;
  }

  const faixas = state.getTracksByAlbum(mapeamento.album);
  if (!faixas.length) {
    // Mapeamento apontando para álbum que não existe mais: acontece se a pasta
    // for renomeada depois do cadastro.
    console.warn(`[music] álbum "${mapeamento.album}" (tag ${uid}) não tem faixas no catálogo`);
    return;
  }

  console.log(`[music] tag ${uid} — tocando ${mapeamento.album} (${faixas.length} faixas)`);
  state.setPlayerState({ activeTagUid: uid, pausedUid: null, album: mapeamento.album });
  await musicPlayer.playAlbum(mapeamento.album, faixas);
}

async function onTagVanish({ uid }) {
  const player = state.getPlayerState();
  if (player.activeTagUid !== uid) return;

  console.log(`[music] tag ${uid} removida — pausando`);
  state.setPlayerState({ activeTagUid: null, pausedUid: uid });
  await musicPlayer.pause();
}

/**
 * Liga tudo. Nunca lança: sem leitor ou sem player o backend precisa subir
 * normalmente, só sem música.
 */
async function init() {
  musicPlayer.on('status', (status) => {
    state.setPlayerState(status);
    broadcastStatus(status);
  });

  nfcReader.on('tag-present', (tag) => {
    onTagPresent(tag).catch((err) => console.error('[music] falha ao tocar:', err.message));
  });

  nfcReader.on('tag-vanish', (tag) => {
    onTagVanish(tag).catch((err) => console.error('[music] falha ao pausar:', err.message));
  });

  // Em paralelo de propósito: o mpv leva ~11s para subir e o PN532 responde em
  // menos de um segundo. Em série, o leitor só começaria a varrer depois do mpv.
  const [playerOk, readerOk] = await Promise.all([
    musicPlayer.init(),
    nfcReader.init(),
  ]);

  agendarRebroadcast();

  if (playerOk && readerOk) {
    console.log('[music] pronto — encoste uma tag mapeada');
  } else {
    console.warn(
      `[music] parcialmente disponível (player: ${playerOk ? 'ok' : 'não'}, ` +
        `leitor: ${readerOk ? 'ok' : 'não'})`
    );
  }
  return { playerOk, readerOk };
}

/**
 * Simula o gesto de encostar/tirar uma tag, sem hardware.
 *
 * É o que permite desenvolver o frontend numa máquina sem PN532: os eventos
 * passam exatamente pelo mesmo caminho que os do leitor real.
 */
async function simulateTag(uid, evento) {
  if (evento === 'present') return onTagPresent({ uid });
  if (evento === 'remove') return onTagVanish({ uid });
  throw new Error(`evento desconhecido: ${evento}`);
}

async function getStatus() {
  const status = await musicPlayer.getStatus();
  const player = state.getPlayerState();
  return { ...status, activeTagUid: player.activeTagUid, pausedUid: player.pausedUid };
}

/**
 * Para a reprodução e esvazia a playlist.
 *
 * Cuidado com o nome: `stop()` (abaixo) desliga o controller inteiro -- leitor e
 * player. Esta aqui é a ação do usuário, aquela é o encerramento do processo.
 * Ligar um botão de UI na função errada derrubaria o NFC junto.
 */
async function stopPlayback() {
  state.setPlayerState({ activeTagUid: null, pausedUid: null, album: null });
  return musicPlayer.stop();
}

async function stop() {
  if (rebroadcastTimer) clearInterval(rebroadcastTimer);
  rebroadcastTimer = null;
  await musicPlayer.stop().catch(() => {});
  musicPlayer.close();
  await nfcReader.stop().catch(() => {});
}

module.exports = {
  init,
  stop,
  simulateTag,
  getStatus,
  stopPlayback,
  /**
   * Toca um álbum, opcionalmente a partir de uma faixa.
   *
   * `trackId` é o id do catálogo, não o índice: índice mudaria se a pasta
   * ganhasse arquivo novo, e o cliente estaria se referindo a outra faixa sem
   * perceber.
   */
  play: (album, trackId) => {
    const faixas = state.getTracksByAlbum(album);
    const idx = trackId ? faixas.findIndex((t) => t.id === trackId) : 0;
    return musicPlayer.playAlbum(album, faixas, idx < 0 ? 0 : idx);
  },
  pause: () => musicPlayer.pause(),
  resume: () => musicPlayer.resume(),
  restart: () => musicPlayer.restart(),
  next: () => musicPlayer.next(),
  previous: () => musicPlayer.previous(),
  setVolume: (v) => musicPlayer.setVolume(v),
};
