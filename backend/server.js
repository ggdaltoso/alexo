// Minimal Express server setup for Alexo backend
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const path = require('path');
const wsServer = require('./ws');
const state = require('./state');
const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Enable CORS only in development
if (NODE_ENV === 'development') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS',
    );
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  });
}

app.use(express.json());

// app.get('/api/state', (req, res) => {
//   res.json(state.getState());
// });

app.post('/api/nfc', (req, res) => {
  const { type, message } = req.body;
  if (typeof type !== 'string' || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  // state.updateMessage({ type, message });

  wsServer.broadcast({ type, message, timestamp: Date.now() });

  res.status(200).json({ ok: true });
});

// Serve static files from frontend/dist in production
if (NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendPath));

  // SPA fallback: redirect all non-API routes to index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

const server = http.createServer(app);
wsServer.attach(server);

server.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  if (NODE_ENV === 'production') {
    console.log(`Frontend available at http://localhost:${PORT}`);
  }
});
