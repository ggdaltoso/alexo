// Minimal ws server for Alexo backend
const WebSocket = require('ws');
let wss;

function attach(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    ws.on('close', () => {});
  });
}

// Contrato dos broadcasts: todo objeto enviado daqui precisa de um campo `type`
// que identifique o evento, e apenas isso -- ele é o discriminador que o cliente
// usa para saber o que chegou. O tipo espelho vive em frontend/src/types.ts
// (`ServerMessage`), e toda variante nova precisa ser adicionada lá também.
//
// Eventos atuais:
//   { type: 'nfc_message', messageType, message, timestamp }
//   { type: 'gallery_updated' }
//   { type: 'music_playback_state', album, trackId, trackIndex, trackCount,
//     title, filename, isPlaying, position, positionAt, duration, volume,
//     activeTagUid, timestamp }
function broadcast(data) {
  if (!wss) return;
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

module.exports = { attach, broadcast };
