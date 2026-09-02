// Geração de ids.
//
// `crypto.randomUUID()` só existe a partir do Node 14.17.0, e o Pi roda 14.15.1
// (o backend/package.json declara `"node": ">=14.0.0 <15.0.0"`). Usá-lo passava
// despercebido na máquina de dev, que roda um Node moderno, e derrubava o
// serviço em produção no primeiro upload -- o throw acontece dentro do callback
// de storage do multer, fora do alcance do error handler do Express, então vira
// uncaughtException e mata o processo.
//
// randomBytes existe desde sempre, então a UUID v4 é montada na mão.
const crypto = require('crypto');

function randomUUID() {
  const bytes = crypto.randomBytes(16);

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // versão 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122

  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

module.exports = { randomUUID };
