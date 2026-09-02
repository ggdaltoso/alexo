const path = require('path');
const { execFile } = require('child_process');

const { SCRIPTS_DIR } = require('../config');

/**
 * Reduz a foto recém-enviada para a resolução que a tela usa de fato.
 *
 * Foto de celular chega em 3468x4624. O arquivo é pequeno porque JPEG comprime
 * bem, mas o navegador precisa descomprimir para desenhar, e aí cada pixel vira
 * 4 bytes: 61 MB de RAM por foto num aparelho de 430 MB. O painel da galeria tem
 * cerca de 240x230 pixels.
 *
 * Isso não é otimização: em 25/08/2026 as cinco fotos da galeria somavam 190 MB
 * decodificados, o swap enchia e o Wi-Fi caía junto -- no BCM2835 o cartão SD e
 * o rádio dividem o controlador SDIO. Depois de reduzir, 8,2 MB.
 *
 * Feito em Python porque o Pillow já está no Pi; as alternativas em Node são
 * addons nativos que não compilam bem no ARMv6.
 *
 * Falha aqui não derruba o upload: a foto original fica, grande, e o
 * resize-gallery.py em lote conserta depois. Perder a foto seria pior.
 */
function reduzirImagem(caminho) {
  return new Promise((resolve) => {
    const script = path.join(SCRIPTS_DIR, 'resize-gallery.py');
    execFile('python3', [script, '--arquivo', caminho], { timeout: 60000 }, (err, _out, stderr) => {
      if (err) {
        console.warn(`[galeria] não consegui reduzir ${path.basename(caminho)}: ${stderr || err.message}`);
      }
      resolve();
    });
  });
}

module.exports = { reduzirImagem };
