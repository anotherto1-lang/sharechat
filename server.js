const express = require('express');
const compression = require('compression');
const app = express();
const http = require('http');
const path = require('path');
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingInterval: 20000,
  pingTimeout: 25000
});

// Gzip: comprime tudo (HTML/CSS/JS chega 3-4x menor pela rede)
app.use(compression());

// IMPORTANTE PARA A WEB: O servidor precisa entregar a pasta 'public' para o navegador
// Cache de 7 dias para arquivos com hash/versão; HTML sem cache (sempre atualiza)
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.endsWith('.css') || filePath.endsWith('.js') || filePath.endsWith('.woff2')) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
  }
}));

// ===== SALAS PRIVADAS =====
// Cada sala guarda usuários separados. Tudo é escopado por sala (io.to(sala).emit).
const salas = new Map(); // sala -> [{id, name}]

function emitirUsuarios(sala) {
  const usuarios = salas.get(sala) || [];
  io.to(sala).emit('update-users', usuarios);
}

io.on('connection', (socket) => {
  let salaAtual = null;

  socket.on('join-room', (name, sala) => {
    // valida/saneia o nome da sala (evita injeção estranha no hash)
    const salaLimpa = String(sala || '').replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 64) || 'lobby';
    salaAtual = salaLimpa;
    socket.join(salaLimpa);
    if (!salas.has(salaLimpa)) salas.set(salaLimpa, []);
    salas.set(salaLimpa, salas.get(salaLimpa).filter(u => u.id !== socket.id));
    salas.get(salaLimpa).push({ id: socket.id, name: name });
    emitirUsuarios(salaLimpa);
    // Avisa os OUTROS da sala que alguém novo entrou (para reenviar stream pra ele)
    socket.to(salaLimpa).emit('new-user', socket.id);
  });

  socket.on('chat-message', (data) => {
    // broadcast: NÃO envia de volta pra quem mandou (o cliente já mostra a própria mensagem)
    if (salaAtual) socket.to(salaAtual).emit('chat-message', data);
  });

  socket.on('start-share', () => {
    if (salaAtual) socket.to(salaAtual).emit('user-started-share', socket.id);
  });

  socket.on('stop-share', () => {
    if (salaAtual) socket.to(salaAtual).emit('user-stopped-share', socket.id);
  });

  // Quem já está transmitindo avisa o novo usuário que existe uma transmissão ativa
  socket.on('notify-already-sharing', (targetId) => {
    socket.to(targetId).emit('user-started-share', socket.id);
  });

  socket.on('offer', (data) => {
    socket.to(data.target).emit('offer', { sender: socket.id, offer: data.offer });
  });

  socket.on('answer', (data) => {
    socket.to(data.target).emit('answer', { sender: socket.id, answer: data.answer });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.target).emit('ice-candidate', { sender: socket.id, candidate: data.candidate });
  });

  socket.on('disconnect', () => {
    if (salaAtual && salas.has(salaAtual)) {
      salas.set(salaAtual, salas.get(salaAtual).filter(u => u.id !== socket.id));
      if (salas.get(salaAtual).length === 0) salas.delete(salaAtual);
      else emitirUsuarios(salaAtual);
      socket.to(salaAtual).emit('user-stopped-share', socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor Web rodando na porta ${PORT}`);
});
