const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Enable CORS for all routes
app.use(cors({
  origin: process.env.FRONTEND_URL, // In production, you might want to restrict this
  methods: ['GET', 'POST'],
  credentials: true
}));

// Initialize Socket.io with CORS settings
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL, // In production, you might want to restrict this
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Data storage paths
const DATA_DIR = path.join(__dirname, 'data');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const WORDS_FILE = path.join(DATA_DIR, 'words.json');

// Words list for the game
const WORDS = [
  'apple', 'banana', 'car', 'dog', 'elephant', 
  'flower', 'guitar', 'house', 'ice cream', 'jacket',
  'mountain', 'ocean', 'piano', 'rainbow', 'soccer',
  'computer', 'pizza', 'beach', 'cat', 'bicycle',
  'tree', 'book', 'sun', 'moon', 'star'
];

// In-memory rooms storage
let roomsCache = {};

// Ensure the data directory exists
async function ensureDataDirExists() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log(`Created data directory: ${DATA_DIR}`);
    
    // Initialize words.json if it doesn't exist
    try {
      await fs.access(WORDS_FILE);
      console.log('words.json already exists');
    } catch {
      await fs.writeFile(WORDS_FILE, JSON.stringify(WORDS));
      console.log('Created words.json with default words');
    }
    
    // Initialize rooms.json if it doesn't exist
    try {
      await fs.access(ROOMS_FILE);
      console.log('rooms.json already exists');
      
      // Load existing rooms into cache
      const roomsData = await fs.readFile(ROOMS_FILE, 'utf8');
      if (roomsData && roomsData.trim() !== '') {
        roomsCache = JSON.parse(roomsData);
        console.log(`Loaded ${Object.keys(roomsCache).length} rooms from file`);
      } else {
        console.log('rooms.json exists but is empty, initializing with empty object');
        roomsCache = {};
        await fs.writeFile(ROOMS_FILE, JSON.stringify(roomsCache, null, 2));
      }
    } catch {
      roomsCache = {};
      await fs.writeFile(ROOMS_FILE, JSON.stringify(roomsCache, null, 2));
      console.log('Created rooms.json with empty object');
    }
  } catch (error) {
    console.error('Error initializing data directory:', error);
  }
}

// Room management functions
async function getRooms() {
  try {
    // Always use the cache as the source of truth
    return roomsCache;
  } catch (error) {
    console.error('Error getting rooms:', error);
    return {};
  }
}

async function saveRooms(rooms) {
  try {
    // Update cache first
    roomsCache = rooms;
    
    // Then save to file
    await fs.writeFile(ROOMS_FILE, JSON.stringify(rooms, null, 2));
    console.log(`Saved ${Object.keys(rooms).length} rooms to file`);
  } catch (error) {
    console.error('Error saving rooms file:', error);
  }
}

// Improved function to clean stale rooms
async function cleanupRooms() {
  const rooms = await getRooms();
  let roomsRemoved = 0;
  
  const now = new Date();
  
  for (const roomId in rooms) {
    const room = rooms[roomId];
    
    // Check if the room has any connected players
    const connectedPlayers = room.players.filter(p => p.isConnected);
    
    if (connectedPlayers.length === 0) {
      console.log(`Removing empty room: ${roomId}`);
      delete rooms[roomId];
      roomsRemoved++;
    }
    
    // Also check for games that have been idle for too long (more than 1 hour)
    else if (room.createdAt) {
      const createdAt = new Date(room.createdAt);
      const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
      
      if (hoursSinceCreation > 6) {  // 6 hours max lifetime for a room
        console.log(`Removing stale room ${roomId} after ${hoursSinceCreation.toFixed(1)} hours`);
        delete rooms[roomId];
        roomsRemoved++;
      }
    }
  }
  
  if (roomsRemoved > 0) {
    await saveRooms(rooms);
    console.log(`Removed ${roomsRemoved} stale rooms during cleanup`);
  }
}

// Run cleanup more frequently - every 15 minutes
setInterval(cleanupRooms, 15 * 60 * 1000);

async function getWords() {
  try {
    const data = await fs.readFile(WORDS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading words file:', error);
    return WORDS;
  }
}

async function createRoom(hostId, settings) {
  const roomId = generateRoomId();
  const rooms = await getRooms();
  
  rooms[roomId] = {
    id: roomId,
    hostId,
    settings,
    players: [],
    messages: [],
    currentRound: 0,
    totalRounds: settings.rounds,
    currentWord: '',
    drawingPlayerId: null,
    gameStatus: 'waiting',
    roundTimeLeft: settings.roundDuration,
    correctGuessers: [], // Track who has already guessed correctly
    createdAt: new Date().toISOString()
  };
  
  await saveRooms(rooms);
  return roomId;
}

async function joinRoom(roomId, player) {
  const rooms = await getRooms();
  
  if (!rooms[roomId]) {
    return { success: false, message: 'Room not found' };
  }
  
  // Check if player is already in the room
  const existingPlayerIndex = rooms[roomId].players.findIndex(p => p.id === player.id);
  
  if (existingPlayerIndex !== -1) {
    // Update existing player
    rooms[roomId].players[existingPlayerIndex] = {
      ...rooms[roomId].players[existingPlayerIndex],
      ...player,
      isConnected: true
    };
  } else {
    // Add new player
    if (rooms[roomId].players.length >= rooms[roomId].settings.maxPlayers) {
      return { success: false, message: 'Room is full' };
    }
    
    rooms[roomId].players.push({
      ...player,
      score: 0,
      isDrawing: false,
      isConnected: true
    });
  }
  
  await saveRooms(rooms);
  return { success: true, room: rooms[roomId] };
}

async function leaveRoom(roomId, playerId) {
  const rooms = await getRooms();
  
  if (!rooms[roomId]) {
    return { success: false, message: 'Room not found' };
  }
  
  const playerIndex = rooms[roomId].players.findIndex(p => p.id === playerId);
  if (playerIndex !== -1) {
    // Mark player as disconnected
    rooms[roomId].players[playerIndex].isConnected = false;
    
    // Check if all players are disconnected
    const connectedPlayers = rooms[roomId].players.filter(p => p.isConnected);
    if (connectedPlayers.length === 0) {
      delete rooms[roomId]; // Remove room if empty
    } else if (playerId === rooms[roomId].hostId) {
      // Assign a new host if the current host leaves
      rooms[roomId].hostId = connectedPlayers[0].id;
    }
    
    await saveRooms(rooms);
    return { success: true };
  }
  
  return { success: false, message: 'Player not found in room' };
}

async function addMessage(roomId, message) {
  const rooms = await getRooms();
  
  if (!rooms[roomId]) {
    return { success: false, message: 'Room not found' };
  }
  
  // Initialize correctGuessers array if it doesn't exist yet
  if (!rooms[roomId].correctGuessers) {
    rooms[roomId].correctGuessers = [];
  }
  
  // Check if the message is a correct guess during game
  let isCorrect = false;
  if (
    rooms[roomId].gameStatus === 'playing' &&
    message.user.id !== rooms[roomId].drawingPlayerId &&
    message.text.toLowerCase().trim() === rooms[roomId].currentWord.toLowerCase().trim()
  ) {
    // Check if this player has already guessed correctly this round
    if (!rooms[roomId].correctGuessers.includes(message.user.id)) {
      isCorrect = true;
      
      // Add player to correctGuessers list
      rooms[roomId].correctGuessers.push(message.user.id);
      
      // Update player score
      const playerIndex = rooms[roomId].players.findIndex(p => p.id === message.user.id);
      if (playerIndex !== -1) {
        rooms[roomId].players[playerIndex].score += 100;
      }
      
      // Modify message to hide the word
      message.text = '🎯 Guessed the word!';
    } else {
      // Player already guessed correctly this round
      message.text = "Already guessed";
    }
  }
  
  message.isCorrect = isCorrect;
  message.timestamp = new Date().toISOString();
  
  rooms[roomId].messages.push(message);
  await saveRooms(rooms);
  
  return { success: true, isCorrect };
}

async function startGame(roomId) {
  const rooms = await getRooms();
  const words = await getWords();
  
  if (!rooms[roomId]) {
    return { success: false, message: 'Room not found' };
  }
  
  if (rooms[roomId].players.filter(p => p.isConnected).length < 2) {
    return { success: false, message: 'Need at least 2 players to start' };
  }
  
  // Choose a random player to draw first
  const connectedPlayers = rooms[roomId].players.filter(p => p.isConnected);
  const firstPlayerIndex = Math.floor(Math.random() * connectedPlayers.length);
  const firstPlayerId = connectedPlayers[firstPlayerIndex].id;
  
  // Select a random word
  const wordIndex = Math.floor(Math.random() * words.length);
  const randomWord = words[wordIndex];
  
  rooms[roomId] = {
    ...rooms[roomId],
    gameStatus: 'playing',
    currentRound: 1,
    currentWord: randomWord,
    drawingPlayerId: firstPlayerId,
    roundTimeLeft: rooms[roomId].settings.roundDuration,
    correctGuessers: [], // Reset for new game
    players: rooms[roomId].players.map(p => ({
      ...p,
      isDrawing: p.id === firstPlayerId,
      score: 0 // Reset scores for new game
    }))
  };
  
  await saveRooms(rooms);
  
  // Start the timer immediately after starting the game
  startRoundTimer(roomId);
  
  return { success: true, room: rooms[roomId] };
}

// Add a new function to handle the round timer
async function startRoundTimer(roomId) {
  console.log(`Starting round timer for room ${roomId}`);
  const rooms = await getRooms();
  
  if (!rooms[roomId] || rooms[roomId].gameStatus !== 'playing') {
    console.log(`Cannot start timer: Room ${roomId} not found or not playing`);
    return;
  }
  
  // Set up a timer that counts down from the round duration
  const countdownInterval = setInterval(async () => {
    const currentRooms = await getRooms();
    
    if (!currentRooms[roomId] || currentRooms[roomId].gameStatus !== 'playing') {
      console.log(`Stopping timer: Room ${roomId} not found or not playing`);
      clearInterval(countdownInterval);
      return;
    }
    
    // Decrement the time
    currentRooms[roomId].roundTimeLeft -= 1;
    
    // Broadcast the timer update to all clients
    io.to(roomId).emit('timerUpdate', currentRooms[roomId].roundTimeLeft);
    
    // If time is up, end the round
    if (currentRooms[roomId].roundTimeLeft <= 0) {
      console.log(`Time's up for room ${roomId}, round ${currentRooms[roomId].currentRound}`);
      clearInterval(countdownInterval);
      
      const endResult = await endRound(roomId);
      if (endResult.success) {
        io.to(roomId).emit('roundEnded', {
          round: currentRooms[roomId].currentRound,
          word: currentRooms[roomId].currentWord
        });
        io.to(roomId).emit('gameUpdate', currentRooms[roomId]);
      }
    }
    
    await saveRooms(currentRooms);
  }, 1000);
}

async function endRound(roomId) {
  const rooms = await getRooms();
  const words = await getWords();
  
  if (!rooms[roomId]) {
    return { success: false, message: 'Room not found' };
  }
  
  if (rooms[roomId].gameStatus !== 'playing') {
    return { success: false, message: 'Game is not in progress' };
  }
  
  // Set round end status
  rooms[roomId].gameStatus = 'roundEnd';
  await saveRooms(rooms);
  
  // After delay, start next round or end game
  setTimeout(async () => {
    const currentRooms = await getRooms();
    if (!currentRooms[roomId]) return; // Room might have been deleted
    
    if (currentRooms[roomId].currentRound >= currentRooms[roomId].totalRounds) {
      // End game
      currentRooms[roomId].gameStatus = 'gameEnd';
      await saveRooms(currentRooms);
      io.to(roomId).emit('gameUpdate', currentRooms[roomId]);
    } else {
      // Start next round
      const connectedPlayers = currentRooms[roomId].players.filter(p => p.isConnected);
      if (connectedPlayers.length < 2) {
        currentRooms[roomId].gameStatus = 'waiting';
        await saveRooms(currentRooms);
        io.to(roomId).emit('gameUpdate', currentRooms[roomId]);
      } else {
        // Find the next player to draw (cyclic)
        const currentDrawingIndex = connectedPlayers.findIndex(p => p.id === currentRooms[roomId].drawingPlayerId);
        const nextDrawingIndex = (currentDrawingIndex + 1) % connectedPlayers.length;
        const nextDrawingId = connectedPlayers[nextDrawingIndex].id;
        
        // Select a random word
        const wordIndex = Math.floor(Math.random() * words.length);
        const randomWord = words[wordIndex];
        
        currentRooms[roomId] = {
          ...currentRooms[roomId],
          gameStatus: 'playing',
          currentRound: currentRooms[roomId].currentRound + 1,
          currentWord: randomWord,
          drawingPlayerId: nextDrawingId,
          roundTimeLeft: currentRooms[roomId].settings.roundDuration,
          correctGuessers: [], // Reset correct guessers for new round
          players: currentRooms[roomId].players.map(p => ({
            ...p,
            isDrawing: p.id === nextDrawingId
          }))
        };
        
        await saveRooms(currentRooms);
        io.to(roomId).emit('gameUpdate', currentRooms[roomId]);
        
        // Start the timer for the new round
        startRoundTimer(roomId);
      }
    }
  }, 5000); // 5 seconds between rounds
  
  return { success: true };
}

async function handleDrawing(roomId, drawingData) {
  // We don't persist drawing data to the JSON file to keep it small
  // Instead, just broadcast it to all clients in the room
  io.to(roomId).emit('drawingUpdate', drawingData);
  return { success: true };
}

// Generate a 6-character room ID
function generateRoomId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Create a new room
  socket.on('createRoom', async (data, callback) => {
    try {
      const { hostId, settings, userName } = data;
      
      if (!hostId || !settings || !userName) {
        console.error('Missing required data for room creation');
        if (callback) callback({ success: false, message: 'Missing required data' });
        return;
      }
      
      const roomId = await createRoom(hostId, settings);
      
      // Join the room
      socket.join(roomId);
      
      // Add host player to the room
      const result = await joinRoom(roomId, {
        id: hostId,
        name: userName,
        avatar: null
      });
      
      if (callback) {
        callback({ roomId, success: true });
      }
      
      // Debug: verify room was saved properly
      const rooms = await getRooms();
    } catch (error) {
      console.error('Error creating room:', error);
      if (callback) callback({ success: false, message: 'Failed to create room' });
    }
  });
  
  // Join an existing room
  socket.on('joinRoom', async (data, callback) => {
    try {
      const { roomId, player } = data;
      
      // Debug: check what rooms exist before joining
      const rooms = await getRooms();
      
      const result = await joinRoom(roomId, player);
      
      if (result.success) {
        socket.join(roomId);
        
        // Notify all clients in the room about the new player
        io.to(roomId).emit('playerJoined', player);
        io.to(roomId).emit('gameUpdate', result.room);
        
        if (callback) callback({ success: true, room: result.room });
      } else {
        if (callback) callback(result);
      }
    } catch (error) {
      console.error('Error joining room:', error);
      if (callback) callback({ success: false, message: 'Failed to join room' });
    }
  });
  
  // Leave room
  socket.on('leaveRoom', async (data, callback) => {
    try {
      const { roomId, playerId } = data;
      const result = await leaveRoom(roomId, playerId);
      
      socket.leave(roomId);
      
      // Notify all clients in the room about the player leaving
      io.to(roomId).emit('playerLeft', { playerId });
      
      const rooms = await getRooms();
      if (rooms[roomId]) {
        io.to(roomId).emit('gameUpdate', rooms[roomId]);
      }
      
      if (callback) callback(result);
    } catch (error) {
      console.error('Error leaving room:', error);
      if (callback) callback({ success: false, message: 'Failed to leave room' });
    }
  });
  
  // Send chat message
  socket.on('sendMessage', async (data, callback) => {
    try {
      const { roomId, message } = data;
      const result = await addMessage(roomId, message);
      
      // Broadcast message to all clients in the room
      io.to(roomId).emit('newMessage', {
        ...message,
        isCorrect: result.isCorrect,
        timestamp: message.timestamp || new Date().toISOString()
      });
      
      // If it was a correct guess, update game state for all clients
      if (result.isCorrect) {
        const rooms = await getRooms();
        io.to(roomId).emit('gameUpdate', rooms[roomId]);
      }
      
      if (callback) callback(result);
    } catch (error) {
      console.error('Error sending message:', error);
      if (callback) callback({ success: false, message: 'Failed to send message' });
    }
  });
  
  // Start game
  socket.on('startGame', async (data, callback) => {
    try {
      const { roomId } = data;
      const result = await startGame(roomId);
      
      if (result.success) {
        // Notify all clients in the room that the game has started
        io.to(roomId).emit('gameStarted', result.room);
        io.to(roomId).emit('gameUpdate', result.room);
        
        if (callback) callback(result);
      } else {
        if (callback) callback(result);
      }
    } catch (error) {
      console.error('Error starting game:', error);
      if (callback) callback({ success: false, message: 'Failed to start game' });
    }
  });
  
  // Drawing updates - now better handling batched updates
  socket.on('drawing', (data) => {
    const { roomId, drawingData } = data;
    handleDrawing(roomId, drawingData);
  });
  
  // Improved disconnect handling
  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.id);
    
    // Run cleanup more aggressively on disconnects
    try {
      await cleanupRooms();
    } catch (error) {
      console.error('Error during room cleanup on disconnect:', error);
    }
  });
});

// Initialize data directory and start server
ensureDataDirExists().then(async () => {
  // Run cleanup on startup
  try {
    await cleanupRooms();
  } catch (error) {
    console.error('Error during initial room cleanup:', error);
  }
  
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
