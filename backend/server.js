// Minimal Express server setup for Alexo backend
const express = require('express');
const http = require('http');
const wsServer = require('./ws');
const state = require('./state');
const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

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

const server = http.createServer(app);
wsServer.attach(server);

server.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
