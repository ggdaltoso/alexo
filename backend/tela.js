/**
 * Print da tela do Pi.
 *
 * O usuário já tirava print por ssh com o alias do ~/.bashrc do Pi:
 *
 *     alias screenshot="DISPLAY=:0 scrot"
 *
 * Aqui é o mesmo comando, mas não dá para chamar o alias em si: alias só existe
 * em shell interativo, e o backend não tem shell nenhum no meio -- `execFile`
 * com argumentos em array, como no servicos.js. Então o que é reusado é o
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
let emCurso = null;

/** Captura a tela e devolve o PNG como Buffer. Lança se o X não responder. */
function capturar() {
  if (emCurso) return emCurso;

  emCurso = new Promise((resolve, reject) => {
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
          resolve(png);
        });
      },
    );
  });

  // Solta a trava dos dois lados: se uma captura falha e a trava fica presa, o
  // botão nunca mais funciona até o backend reiniciar.
  const soltar = () => { emCurso = null; };
  emCurso.then(soltar, soltar);

  return emCurso;
}

module.exports = { capturar, ARQUIVO };
