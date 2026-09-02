/**
 * Teste de bancada do backend/nfcReader.js.
 *
 * Contraparte Node do nfc-read-uid.py, com uma diferença importante de propósito:
 * o script Python fala o protocolo direto e serve para provar o *hardware*; este
 * exercita o módulo que o servidor realmente usa, e serve para provar o *porte*.
 * Quando os dois discordam, o hardware está ok e o bug é do nfcReader.js.
 *
 * Imprime os eventos com o instante em que chegaram, para dar visibilidade à
 * latência de remoção (que depende de VANISH_CONFIRMATIONS no nfcReader.js).
 *
 * Uso:
 *   node backend/scripts/nfc-reader-test.js          # roda até Ctrl+C
 *   node backend/scripts/nfc-reader-test.js 45       # para sozinho em 45s
 *   PN532_I2C_BUS=1 node backend/scripts/nfc-reader-test.js
 */
const path = require('path');

const nfc = require(path.join(__dirname, '..', 'lib', 'nfcReader'));

const seconds = Number(process.argv[2]) || 0;
const t0 = Date.now();
const at = () => `${((Date.now() - t0) / 1000).toFixed(2).padStart(7)}s`;

let presents = 0;
let vanishes = 0;
let lastPresentAt = null;

nfc.on('tag-present', ({ uid, sak }) => {
  presents += 1;
  lastPresentAt = Date.now();
  console.log(`${at()}  PRESENTE  ${uid}  (SAK 0x${sak.toString(16).padStart(2, '0')})`);
});

nfc.on('tag-vanish', ({ uid }) => {
  vanishes += 1;
  // Quanto tempo a tag ficou "presente" do ponto de vista do consumidor. Inclui
  // o atraso das confirmações de remoção, então é sempre maior que o tempo real.
  const held = lastPresentAt ? `  (segurada ~${((Date.now() - lastPresentAt) / 1000).toFixed(1)}s)` : '';
  console.log(`${at()}  REMOVIDA  ${uid}${held}`);
});

async function finish(reason) {
  console.log(`\n${at()}  ${reason}`);
  await nfc.stop();
  console.log(`resumo: ${presents} leitura(s), ${vanishes} remoção(ões)`);
  process.exit(0);
}

process.on('SIGINT', () => {
  finish('Ctrl+C').catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
});

nfc.init().then((ok) => {
  if (!ok) {
    console.error('o leitor não subiu — rode o probe para diagnosticar:');
    console.error('  python3 backend/scripts/pn532-i2c-probe.py --bus 3');
    process.exit(1);
  }
  console.log(`${at()}  pronto. Encoste uma tag.${seconds ? ` Para at ${seconds}s.` : ' Ctrl+C para sair.'}`);
  if (seconds) setTimeout(() => finish('fim do tempo'), seconds * 1000);
});
