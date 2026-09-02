/**
 * Print da tela do Pi.
 *
 * O usuário já tirava print por ssh com o alias do ~/.bashrc do Pi:
 *
 *     alias screenshot="DISPLAY=:0 scrot"
 *
 * Aqui é o mesmo comando, mas não dá para chamar o alias em si: alias só existe
 * em shell interativo, e o backend não tem shell nenhum no meio -- `execFile`
 * com argumentos em array, como no services.js. Então o que é reusado é o
 * comando, não o atalho; se o alias mudar lá, esta constante muda junto.
 *
 * `DISPLAY=:0` é a metade do alias que importa aqui: o backend sobe pelo
 * systemd, fora de qualquer sessão gráfica, e sem isso o scrot não encontra o
 * servidor X. O resto do ambiente vai herdado de propósito -- o systemd roda a
 * unidade como `pi` e define `HOME=/home/pi`, que é como o X acha o
 * `~/.Xauthority` sozinho, do mesmo jeito que acharia numa sessão ssh.
 */

const { execFile } = require('child_process');
const fs = require('fs');

/*
 * O scrot 0.9 (o que está no Pi) não escreve em stdout, só em arquivo, então
 * precisa de um caminho. /dev/shm e não /tmp porque aqui /tmp mora no cartão
 * SD: são ~80 KB gravados por clique, e cartão SD tem escrita contada. O
 * /dev/shm é tmpfs -- sai da RAM, e 80 KB num tmpfs de 216 MB não incomoda
 * ninguém, nem com o Chromium apertado do jeito que está.
 *
 * Nome fixo, sobrescrito a cada captura: o scrot 0.9 sobrescreve sem reclamar
 * (o `-o` que pediria isso só existe no 1.x, e passá-lo aqui dá erro de opção
 * inválida), e um arquivo só evita deixar lixo acumulado na RAM.
 */
const ARQUIVO = '/dev/shm/alexo-screenshot.png';

// Medido no Zero W: ~0,8 s por captura. O teto é folgado porque o que mata o
// tempo aqui é disputa de CPU com o Chromium, não o scrot em si.
const TIMEOUT = 15000;

/*
 * Uma captura de cada vez.
 *
 * Sem isto, clicar duas vezes no botão sobe dois scrots que escrevem no mesmo
 * arquivo ao mesmo tempo -- e o segundo leitor pega um PNG cortado. Num Zero W
 * ainda tem o outro lado: dois scrots concorrendo custam mais que o dobro,
 * porque brigam com o Chromium pela mesma CPU. Quem chega no meio de uma
 * captura recebe a mesma imagem, que é a resposta certa: é o mesmo instante.
 */
let inFlight = null;

/*
 * A última captura fica em memória.
 *
 * É o que faz "guardar no Pi" salvar exatamente a imagem que está no preview, e
 * não uma nova: entre olhar e clicar em guardar passa o tempo de escrever a
 * nota, e o relógio da tela já mudou. Guardar o buffer também evita reler o
 * /dev/shm, que a essa altura pode ter sido sobrescrito por outra captura.
 *
 * É um buffer só, trocado a cada captura -- ~100 KB que não acumulam. Num Pi
 * onde o Chromium roda com 48 MB de heap, isso importa o suficiente para valer
 * a frase, e pouco o suficiente para não valer mais que isso.
 */
let last = null;

/** A última captura, ou null se ainda não houve nenhuma desde que o backend subiu. */
function lastCapture() {
  return last;
}

/**
 * Captura a tela. Resolve `{ png, em }` -- o Buffer e a hora da captura.
 *
 * A hora vai junto porque é ela, e não a hora de gravar, que descreve o que está
 * na imagem. Lança se o X não responder.
 */
function capture() {
  if (inFlight) return inFlight;

  inFlight = new Promise((resolve, reject) => {
    execFile(
      'scrot',
      [ARQUIVO],
      { timeout: TIMEOUT, env: Object.assign({}, process.env, { DISPLAY: ':0' }) },
      (err, stdout, stderr) => {
        if (err) {
          // Num Pi sem scrot o erro cru é "spawn scrot ENOENT", que não diz a
          // quem clicou o que fazer. As duas falhas prováveis são esta e o X
          // fora do ar, e vale distinguir: uma se resolve com apt, a outra não.
          if (err.code === 'ENOENT') {
            return reject(new Error('scrot não está instalado no Pi (apt install scrot)'));
          }
          // Fora isso o scrot fala por stderr, e a mensagem dele ("Can't open X
          // display") diz mais do que "Command failed".
          return reject(new Error((String(stderr).trim() || err.message).trim()));
        }
        fs.readFile(ARQUIVO, (erroLeitura, png) => {
          if (erroLeitura) return reject(erroLeitura);
          last = { png, at: new Date().toISOString() };
          resolve(last);
        });
      },
    );
  });

  // Solta a trava dos dois lados: se uma captura falha e a trava fica presa, o
  // botão nunca mais funciona até o backend reiniciar.
  const release = () => { inFlight = null; };
  inFlight.then(release, release);

  return inFlight;
}

module.exports = { capture, lastCapture, ARQUIVO };
