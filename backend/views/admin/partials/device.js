/**
 * Hardware e "tocando agora", os dois blocos do índice que mudam sozinhos.
 *
 * Uma resposta só para os dois de propósito. Eles saem da mesma leitura --
 * `nfcReader.getCurrentTag()` e `musicController.getStatus()` -- e o getStatus
 * faz cinco chamadas IPC ao mpv por invocação, sem cache. Dois fragmentos
 * independentes dobrariam esse tráfego a cada 2s num Zero W, para mostrar dois
 * pedaços do mesmo instante.
 *
 * Então o bloco de hardware é o alvo principal e o de "tocando agora" vem junto
 * marcado com hx-swap-oob, que é como o htmx atualiza um segundo elemento a
 * partir da mesma resposta. Ele precisa vir com o próprio id e a própria classe,
 * porque a troca é do elemento inteiro.
 */
const esc = require('../esc');

/** Segundos -> mm:ss. Era o `mm()` do cliente. */
function mmss(v) {
  return String(Math.floor(v / 60)).padStart(2, '0') + ':' +
         String(Math.floor(v % 60)).padStart(2, '0');
}

function row(label, valor, classe = '') {
  return `<div class="row"><span class="key-cell">${label}</span>` +
         `<span class="value-cell${classe ? ' ' + classe : ''}">${valor}</span></div>`;
}

module.exports = function deviceBlock({ reader, player }) {
  // O player não expõe "disponível" direto; volume nulo é o sinal de que não há
  // mpv atendendo do outro lado.
  const alive = player && player.volume !== undefined && player.volume !== null;

  const hardware =
    row('Leitor NFC', reader.running ? 'ativo' : 'inativo', reader.running ? 'ok' : 'off') +
    row('Tag encostada', reader.tag ? esc(reader.tag.uid) : '—') +
    row('Player (mpv)', alive ? 'conectado' : 'sem mpv', alive ? 'ok' : 'off');

  const faixa = player.title
    ? `${esc(player.title)}  (${player.trackIndex + 1}/${player.trackCount})`
    : '—';
  const posicao = player.title
    ? (player.isPlaying ? '▶ ' : '|| ') + mmss(player.position) +
      (player.duration ? ' / ' + mmss(player.duration) : '')
    : '—';

  const tocando =
    row('Álbum', player.album ? esc(player.album) : '—') +
    row('Faixa', faixa) +
    row('Posição', posicao) +
    row('Volume', alive ? player.volume : '—');

  return hardware + `<div class="card" id="playing" hx-swap-oob="true">${tocando}</div>`;
};
