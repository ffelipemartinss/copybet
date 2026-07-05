require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const sinaisRoutes = require('./routes/sinais');
const seguidoresRoutes = require('./routes/seguidores');
const analistasRoutes = require('./routes/analistas');

const app = express();
const httpServer = http.createServer(app);

const origensPermitidas = [
  'http://localhost:5173',
  'https://copybet.vercel.app',
  process.env.CLIENT_URL,
].filter(Boolean);

const io = new Server(httpServer, {
  cors: {
    origin: origensPermitidas,
    methods: ['GET', 'POST'],
  },
});

// Middlewares
app.use(cors({ origin: origensPermitidas }));
app.use(express.json());

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/sinais', sinaisRoutes);
app.use('/api/seguidores', seguidoresRoutes);
app.use('/api/analistas', analistasRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// -------------------------------------------------------
// WebSocket para o painel web (Socket.IO)
// Mapa: userId -> socketId
// -------------------------------------------------------
const usuariosConectados = new Map();

io.on('connection', (socket) => {
  console.log(`Socket conectado: ${socket.id}`);

  socket.on('identificar', (userId) => {
    usuariosConectados.set(userId, socket.id);
    console.log(`Usuario ${userId} conectado no socket ${socket.id}`);
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of usuariosConectados.entries()) {
      if (socketId === socket.id) {
        usuariosConectados.delete(userId);
        console.log(`Usuario ${userId} desconectado`);
        break;
      }
    }
  });
});

// -------------------------------------------------------
// WebSocket nativo para a extensao de navegador (/ws)
// Mapa: userId -> ws connection
// -------------------------------------------------------
const extensaoConectadas = new Map();

const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
  // Socket.IO gerencia seus proprios upgrades em /socket.io/
});

wss.on('connection', (ws, request) => {
  const url = new URL(request.url, 'http://localhost');
  const token = url.searchParams.get('token');

  if (!token) {
    ws.close(1008, 'Token obrigatorio');
    return;
  }

  let userId;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    userId = payload.id;
  } catch (e) {
    ws.close(1008, 'Token invalido');
    return;
  }

  extensaoConectadas.set(userId, ws);
  console.log(`[Extensao] Usuario ${userId} conectado via WebSocket nativo`);

  ws.on('close', () => {
    extensaoConectadas.delete(userId);
    console.log(`[Extensao] Usuario ${userId} desconectado`);
  });

  ws.on('error', (err) => {
    console.error(`[Extensao] Erro WebSocket usuario ${userId}:`, err.message);
  });
});

// Exporta para uso nas rotas
app.set('io', io);
app.set('usuariosConectados', usuariosConectados);
app.set('extensaoConectadas', extensaoConectadas);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
