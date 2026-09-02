/**
 * Montagem do Express: middlewares, rotas e os arquivos estáticos.
 *
 * Separado do server.js para que subir o HTTP (e o WebSocket junto) seja uma
 * coisa, e o que a aplicação responde seja outra.
 */
const path = require('path');
const express = require('express');

const { NODE_ENV, ehProducao, UPLOADS_DIR, FRONTEND_DIST } = require('./config');
const rotas = require('./routes');

const app = express();

if (NODE_ENV === 'development') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    // Sem isto o fetch em dev enxerga o cabeçalho como null: por padrão o CORS
    // só entrega os cabeçalhos simples, e X-Print-Em não é um deles.
    res.header('Access-Control-Expose-Headers', 'X-Print-Em');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });
}

app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

app.use(rotas);

// O frontend é servido pelo próprio backend em produção. O curinga vem depois
// das rotas para não engolir /api nem /admin.
if (ehProducao) {
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

module.exports = app;
