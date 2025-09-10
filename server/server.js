require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// ✅ PORT environment variable use karein (Railway automatically provides this)
const PORT = process.env.PORT || 3000;

// server.js - CORS configuration
const allowedOrigins = [
  'https://crosszero-game.netlify.app',
  'https://crosszero-game.netlify.app/',
  'http://localhost:3000',
  'http://localhost:8000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8000'
];

const io = socketIo(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      } else {
        console.log('CORS blocked for origin:', origin);
        return callback(new Error('Not allowed by CORS'), false);
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});
// Enable CORS
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true
}));

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '../')));

// ✅ Add health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Route to serve local game page
app.get('/local', (req, res) => {
  res.sendFile(path.join(__dirname, '../local.html'));
});

// Route to serve online game page
app.get('/online', (req, res) => {
  res.sendFile(path.join(__dirname, '../online.html'));
});

// Route to serve settings page
app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, '../settings.html'));
});

// Game state storage
const rooms = new Map();
const players = new Map();

// Generate a random room ID
function generateRoomId() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create a new room
  socket.on('createRoom', (data) => {
    const roomId = generateRoomId();
    const playerName = data.playerName || 'Player';
    
    rooms.set(roomId, {
      players: [{
        id: socket.id,
        name: playerName,
        symbol: 'X'
      }],
      board: ['', '', '', '', '', '', '', '', ''],
      currentPlayer: 'X',
      gameActive: false,
      isWaiting: true,
      createdAt: Date.now() // ✅ Add creation timestamp
    });
    
    players.set(socket.id, {
      roomId: roomId,
      playerName: playerName
    });
    
    socket.join(roomId);
    socket.emit('roomCreated', { roomId });
    console.log(`Room created: ${roomId} by ${playerName}`);
  });

  // Join an existing room
  socket.on('joinRoom', (data) => {
    const roomId = data.roomId.toUpperCase(); // ✅ Convert to uppercase
    const playerName = data.playerName || 'Player';
    
    if (!rooms.has(roomId)) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    const room = rooms.get(roomId);
    
    // ✅ Clean up old rooms (1 hour old)
    const now = Date.now();
    if (now - room.createdAt > 3600000) {
      rooms.delete(roomId);
      socket.emit('error', { message: 'Room has expired' });
      return;
    }
    
    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }
    
    room.players.push({
      id: socket.id,
      name: playerName,
      symbol: 'O'
    });
    
    room.gameActive = true;
    room.isWaiting = false;
    
    players.set(socket.id, {
      roomId: roomId,
      playerName: playerName
    });
    
    socket.join(roomId);
    
    // Notify both players that the game can start
    io.to(roomId).emit('roomJoined', { 
      roomId, 
      opponentName: room.players[0].name 
    });
    
    // Send game state to the new player
    socket.emit('gameState', {
      board: room.board,
      currentPlayer: room.currentPlayer,
      players: room.players
    });
    
    console.log(`Player ${playerName} joined room: ${roomId}`);
  });

  // Handle player making a move
  socket.on('makeMove', (data) => {
    const roomId = data.roomId;
    const cellIndex = data.cellIndex;
    
    if (!rooms.has(roomId)) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    const room = rooms.get(roomId);
    const player = room.players.find(p => p.id === socket.id);
    
    if (!player || player.symbol !== room.currentPlayer || !room.gameActive) {
      return;
    }
    
    if (room.board[cellIndex] !== '') {
      return;
    }
    
    // Update the board
    room.board[cellIndex] = room.currentPlayer;
    
    // Check for win or draw
    const result = checkGameResult(room.board);
    
    if (result.win) {
      room.gameActive = false;
      io.to(roomId).emit('gameWon', {
        winner: room.currentPlayer,
        winningCombo: result.winningCombo
      });
    } else if (result.draw) {
      room.gameActive = false;
      io.to(roomId).emit('gameDraw');
    } else {
      // Switch turns
      room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
      io.to(roomId).emit('playerSwitched', { currentPlayer: room.currentPlayer });
    }
    
    // Broadcast the move to all players in the room
    io.to(roomId).emit('moveMade', {
      cellIndex,
      symbol: room.currentPlayer
    });
  });

  // Handle play again request
  socket.on('playAgain', (data) => {
    const roomId = data.roomId;
    
    if (!rooms.has(roomId)) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    const room = rooms.get(roomId);
    
    // Reset game state
    room.board = ['', '', '', '', '', '', '', '', ''];
    room.currentPlayer = 'X';
    room.gameActive = true;
    
    // Notify both players
    io.to(roomId).emit('gameReset');
  });

  // Handle player name updates
  socket.on('updateName', (data) => {
    const roomId = data.roomId;
    const playerName = data.playerName;
    
    if (!rooms.has(roomId)) {
      return;
    }
    
    const room = rooms.get(roomId);
    const player = room.players.find(p => p.id === socket.id);
    
    if (player) {
      player.name = playerName;
      players.set(socket.id, {
        roomId: roomId,
        playerName: playerName
      });
      
      // Notify the other player
      socket.to(roomId).emit('playerNameUpdated', {
        playerId: socket.id,
        playerName: playerName
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const playerInfo = players.get(socket.id);
    if (playerInfo) {
      const roomId = playerInfo.roomId;
      
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        
        // Remove player from room
        room.players = room.players.filter(p => p.id !== socket.id);
        
        // Notify other player
        socket.to(roomId).emit('playerLeft');
        
        // If room is empty, delete it
        if (room.players.length === 0) {
          rooms.delete(roomId);
          console.log(`Room deleted: ${roomId}`);
        }
      }
      
      players.delete(socket.id);
    }
  });

  // Handle leaving room
  socket.on('leaveRoom', (data) => {
    const roomId = data.roomId;
    
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      
      // Remove player from room
      room.players = room.players.filter(p => p.id !== socket.id);
      
      // Notify other player
      socket.to(roomId).emit('playerLeft');
      
      // If room is empty, delete it
      if (room.players.length === 0) {
        rooms.delete(roomId);
        console.log(`Room deleted: ${roomId}`);
      }
    }
    
    players.delete(socket.id);
    socket.leave(roomId);
  });
});

// Check game result
function checkGameResult(board) {
  const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];

  for (let i = 0; i < winningConditions.length; i++) {
    const [a, b, c] = winningConditions[i];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { win: true, winningCombo: winningConditions[i] };
    }
  }

  if (!board.includes('')) {
    return { draw: true };
  }

  return { win: false, draw: false };
}

// ✅ Clean up old rooms periodically
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.createdAt > 3600000) { // 1 hour
      rooms.delete(roomId);
      console.log(`Cleaned up old room: ${roomId}`);
    }
  }
}, 300000); // Run every 5 minutes

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
});

// Additional CORS debugging
app.use((req, res, next) => {
  console.log('Incoming request from origin:', req.headers.origin);
  next();
});
