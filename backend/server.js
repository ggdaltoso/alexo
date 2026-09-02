/**
 * Ponto de entrada: sobe o HTTP, pendura o WebSocket no mesmo servidor e
 * encerra limpo.
 *
 * O config vem primeiro de propósito: é ele que carrega o .env, e módulos como
 * o musicPlayer e o nfcReader leem process.env já no require. Qualquer coisa
 * requerida antes dele pegaria os valores padrão em vez dos do .env.
 *
 * O que a aplicação responde está no app.js e em routes/.
 */
const { PORT, NODE_ENV } = require('./config');

const http = require('http');

const app = require('./app');
const wsServer = require('./lib/ws');
const musicController = require('./lib/musicController');

const server = http.createServer(app);
wsServer.attach(server);

server.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  if (NODE_ENV === 'production') {
    console.log(`Frontend available at http://localhost:${PORT}`);
  }
  console.log(`Admin: http://localhost:${PORT}/admin`);

  // Depois do listen, e sem await: o mpv leva ~11s para subir neste Pi, e o
  // servidor não pode ficar sem atender HTTP nesse intervalo. Falha aqui não
  // derruba nada -- o controller já trata tudo internamente e o backend segue
  // funcionando sem música.
  musicController.init().catch((err) => {
    console.error('[music] init falhou:', err.message);
  });
});

// Encerrar limpo: sem isso o leitor NFC fica com o barramento aberto e o
// próximo processo herda um comando pendente.
for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => {
    musicController.stop().finally(() => process.exit(0));
  });
}
