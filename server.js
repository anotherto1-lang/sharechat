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

let users = [];

io.on('connection', (socket) => {

  socket.on('join-room', (name) => {
    users = users.filter(u => u.id !== socket.id);
    users.push({ id: socket.id, name: name });
    io.emit('update-users', users);
    // Avisa todos que um novo usuário entrou (permite quem já transmite enviar o vídeo pra ele)
    socket.broadcast.emit('new-user', socket.id);
  });

  socket.on('chat-message', (data) => {
    // broadcast: NÃO envia de volta pra quem mandou (o cliente já mostra a própria mensagem)
    socket.broadcast.emit('chat-message', data);
  });

  socket.on('start-share', () => {
    socket.broadcast.emit('user-started-share', socket.id);
  });

  socket.on('stop-share', () => {
    socket.broadcast.emit('user-stopped-share', socket.id);
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
    users = users.filter(u => u.id !== socket.id);
    io.emit('update-users', users);
    socket.broadcast.emit('user-stopped-share', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor Web rodando na porta ${PORT}`);
});
