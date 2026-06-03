require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const sinaisRoutes = require('./routes/sinais');
const seguidoresRoutes = require('./routes/seguidores');
const analistasRoutes = require('./routes/analistas');

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Middlewares
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/sinais', sinaisRoutes);
app.use('/api/seguidores', seguidoresRoutes);
app.use('/api/analistas', analistasRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket
// Mapa: userId -> socketId
const usuariosConectados = new Map();

io.on('connection', (socket) => {
  console.log(`Socket conectado: ${socket.id}`);

  // Seguidor se identifica ao conectar
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

// Exporta io para usar nas rotas de sinal (fase 2)
app.set('io', io);
app.set('usuariosConectados', usuariosConectados);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
