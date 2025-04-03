import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import socketService from '@/services/socketService';
import { useGameContext, GameSettings } from '@/contexts/GameContext';

// Types
export interface GamePlayer {
  id: string;
  name: string;
  avatar?: string;
  score: number;
  isDrawing: boolean;
  isConnected?: boolean;
  isCurrentUser: boolean;
}

export interface GameMessage {
  id: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  text: string;
  isCorrect?: boolean;
  timestamp: Date;
}

export interface GameState {
  roomId: string;
  players: GamePlayer[];
  messages: GameMessage[];
  currentRound: number;
  totalRounds: number;
  currentWord: string;
  wordRevealed: boolean;
  roundTimeLeft: number;
  gameStatus: 'waiting' | 'playing' | 'roundEnd' | 'gameEnd';
  roundDuration: number;
  drawingPlayerId: string | null;
}

export const useSocketGame = (roomId: string) => {
  const navigate = useNavigate();
  const { userName, settings, setRoomId, isHost, setIsHost, addActiveGame } = useGameContext();
  
  // Generate a unique ID for this session to ensure multiple tabs/users get different IDs
  // By adding a session-specific component to the userID
  const [userId] = useState(() => {
    // We'll use a combination approach:
    // 1. Get the base user ID from localStorage if it exists
    // 2. For join scenarios, always append a unique session ID to ensure uniqueness
    const baseId = localStorage.getItem('userId') || uuidv4();
    
    // Only store the base ID in localStorage
    localStorage.setItem('userId', baseId);
    
    // For a completely new user experience, we'll append a session-specific unique ID
    // This ensures that even in the same browser, multiple tabs will have different IDs
    // But we'll only do this if we're not the host (to maintain host ID consistency)
    if (!isHost && roomId) {
      // We're joining a room, so use a unique session ID
      return `${baseId}-${uuidv4().substring(0, 8)}`;
    }
    
    return baseId;
  });
  
  // Track connection state
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const joinAttempted = useRef(false);
  
  // Current user info
  const [currentUser, setCurrentUser] = useState({
    id: userId,
    name: userName || 'Anonymous',
    avatar: undefined
  });
  
  const [gameState, setGameState] = useState<GameState>({
    roomId,
    players: [],
    messages: [],
    currentRound: 0,
    totalRounds: settings.rounds,
    currentWord: '',
    wordRevealed: false,
    roundTimeLeft: settings.roundDuration,
    gameStatus: 'waiting',
    roundDuration: settings.roundDuration,
    drawingPlayerId: null
  });
  
  // Connect to socket server
  useEffect(() => {
    const connectToSocket = async () => {
      if (isConnecting) return;
      
      setIsConnecting(true);
      try {
        await socketService.connect();
        setIsConnecting(false);
        setConnectionError(null);
      } catch (error: any) {
        setIsConnecting(false);
        setConnectionError(error?.message || "Failed to connect to server");
        toast.error("Failed to connect to game server. Please try again later.");
      }
    };
    
    connectToSocket();
    
    // Handle connection errors
    const handleConnectError = (error: any) => {
      setConnectionError(error?.message || "Failed to connect to server");
    };
    
    socketService.on('connectError', handleConnectError);
    
    // Cleanup on unmount
    return () => {
      socketService.off('connectError', handleConnectError);
      
      if (roomId) {
        // Attempt to leave room gracefully
        if (socketService.isConnected()) {
          socketService.leaveRoom(roomId, userId).catch(error => {
            console.warn('Non-critical error leaving room:', error);
          });
        }
      }
    };
  }, []);
  
  // Set up socket event listeners
  useEffect(() => {
    const handleGameUpdate = (data: any) => {
      setGameState(prev => {
        // Transform server data to match our GameState format
        const transformedPlayers = data.players.map((player: any) => ({
          ...player,
          isCurrentUser: player.id === userId
        }));
        
        const transformedMessages = data.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        
        return {
          ...prev,
          players: transformedPlayers,
          messages: transformedMessages,
          currentRound: data.currentRound,
          totalRounds: data.totalRounds,
          currentWord: data.currentWord,
          wordRevealed: data.gameStatus === 'roundEnd' || data.gameStatus === 'gameEnd',
          roundTimeLeft: data.roundTimeLeft,
          gameStatus: data.gameStatus,
          roundDuration: data.settings?.roundDuration || prev.roundDuration,
          drawingPlayerId: data.drawingPlayerId
        };
      });
    };
    
    const handlePlayerJoined = (player: any) => {
      if (player.id !== userId) {
        toast.info(`${player.name} joined the room`);
      }
    };
    
    const handlePlayerLeft = (playerId: string) => {
      setGameState(prev => {
        const player = prev.players.find(p => p.id === playerId);
        if (player && !player.isCurrentUser) {
          toast.info(`${player.name} left the room`);
        }
        
        return {
          ...prev,
          players: prev.players.map(p => 
            p.id === playerId ? { ...p, isConnected: false } : p
          )
        };
      });
    };
    
    const handleNewMessage = (message: any) => {
      setGameState(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            ...message,
            timestamp: new Date(message.timestamp)
          }
        ]
      }));
      
      if (message.isCorrect && message.user.id === userId) {
        toast.success("You guessed correctly! +100 points");
      }
    };
    
    const handleGameStarted = (room: any) => {
      toast.info("Game started! First round beginning...");
    };
    
    const handleRoundEnded = (data: { round: number; word: string }) => {
      toast.info(`Round ended! The word was "${data.word}"`);
    };
    
    const handleTimerUpdate = (timeLeft: number) => {
      setGameState(prev => ({
        ...prev,
        roundTimeLeft: timeLeft
      }));
    };
    
    // Register event listeners
    socketService.on('gameUpdate', handleGameUpdate);
    socketService.on('playerJoined', handlePlayerJoined);
    socketService.on('playerLeft', handlePlayerLeft);
    socketService.on('newMessage', handleNewMessage);
    socketService.on('gameStarted', handleGameStarted);
    socketService.on('roundEnded', handleRoundEnded);
    socketService.on('timerUpdate', handleTimerUpdate);
    
    return () => {
      // Unregister event listeners
      socketService.off('gameUpdate', handleGameUpdate);
      socketService.off('playerJoined', handlePlayerJoined);
      socketService.off('playerLeft', handlePlayerLeft);
      socketService.off('newMessage', handleNewMessage);
      socketService.off('gameStarted', handleGameStarted);
      socketService.off('roundEnded', handleRoundEnded);
      socketService.off('timerUpdate', handleTimerUpdate);
    };
  }, [userId]);
  
  // Join room when component mounts or connection is established
  useEffect(() => {
    const joinRoom = async () => {
      if (joinAttempted.current || !roomId || !userName || !socketService.isConnected()) {
        return;
      }
      
      joinAttempted.current = true;
      setIsConnecting(true);
      
      try {
        const player = {
          id: userId,
          name: userName,
          avatar: undefined
        };
        
        const response = await socketService.joinRoom(roomId, player);
        
        // Update isHost based on server response
        setIsHost(response.room.hostId === userId);
        
        // Add active game to context
        addActiveGame(roomId, response.room.hostId, response.room.settings);
        
        // Set roomId in context
        setRoomId(roomId);
        
        toast.success(`Connected to room: ${roomId}`);
        setIsConnecting(false);
        setConnectionError(null);
        setJoinError(null);
      } catch (error: any) {
        setJoinError(error?.message || 'Failed to join room');
        setIsConnecting(false);
        
        // Show toast with the error
        toast.error(error?.message || 'Failed to join room');
        
        // Only navigate away if we have a room error
        if (error?.message === 'Room not found') {
          toast.error('Room not found. Please check the room ID or create a new room.');
          setTimeout(() => navigate('/'), 2000);
        }
      }
    };
    
    joinRoom();
  }, [roomId, userName, userId, navigate, setRoomId, setIsHost, addActiveGame, socketService.isConnected()]);
  
  // Update current user when userName changes
  useEffect(() => {
    if (userName) {
      setCurrentUser(prev => ({
        ...prev,
        name: userName
      }));
    }
  }, [userName]);
  
  // Create a new room
  const createRoom = useCallback(async (gameSettings: GameSettings) => {
    try {
      if (!socketService.isConnected()) {
        await socketService.connect();
      }
      
      const response = await socketService.createRoom(userId, gameSettings, userName);
      
      setIsHost(true);
      setRoomId(response.roomId);
      addActiveGame(response.roomId, userId, gameSettings);
      
      // Navigate to the game room
      navigate(`/game/${response.roomId}`);
      toast.success(`Room created! Your room ID is: ${response.roomId}`);
      return response;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create room');
      throw error;
    }
  }, [userId, userName, navigate, setIsHost, setRoomId, addActiveGame]);
  
  // Send a message/guess
  const sendMessage = useCallback((text: string) => {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    socketService.sendMessage(roomId, {
      id: messageId,
      user: currentUser,
      text
    }).catch(error => {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    });
  }, [roomId, currentUser]);
  
  // Handle drawing
  const handleDraw = useCallback((drawingData: any) => {
    socketService.sendDrawing(roomId, drawingData);
  }, [roomId]);
  
  // Leave the game/room
  const leaveGame = useCallback(() => {
    // Check if we're connected before trying to leave
    if (socketService.isConnected()) {
      socketService.leaveRoom(roomId, userId)
        .then(() => {
          navigate('/');
          toast.info("You left the game");
        })
        .catch(error => {
          console.error('Error leaving room:', error);
          toast.error('Failed to leave room');
          navigate('/');
        });
    } else {
      // We're not connected, just navigate away
      navigate('/');
      toast.info("You left the game");
    }
  }, [roomId, userId, navigate]);
  
  return {
    gameState,
    currentUser,
    createRoom,
    startGame: () => socketService.startGame(roomId),
    sendMessage,
    leaveGame,
    handleDraw,
    isCurrentPlayerDrawing: gameState.drawingPlayerId === userId,
    isGuessing: gameState.gameStatus === 'playing' && gameState.drawingPlayerId !== userId,
    isConnecting,
    connectionError: connectionError || joinError
  };
};
