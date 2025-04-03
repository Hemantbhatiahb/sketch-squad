import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { GameSettings } from '@/contexts/GameContext';

// Types
export interface GamePlayer {
  id: string;
  name: string;
  avatar?: string;
  score: number;
  isDrawing: boolean;
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

// Mock data for demonstration
const MOCK_WORDS = [
  'apple', 'banana', 'car', 'dog', 'elephant', 
  'flower', 'guitar', 'house', 'ice cream', 'jacket',
  'mountain', 'ocean', 'piano', 'rainbow', 'soccer'
];

// Default game settings
const DEFAULT_SETTINGS = {
  roundDuration: 60, // 60 seconds per round
  rounds: 3,        // 3 rounds total
  maxPlayers: 8     // Maximum 8 players
};

export const useGame = (roomId: string, userName: string, settings?: GameSettings) => {
  const navigate = useNavigate();
  
  // Use settings from context or fallback to defaults
  const gameSettings = settings || DEFAULT_SETTINGS;
  
  // Start with just the current user in the room
  const initialPlayers = [
    { id: 'user-1', name: userName || 'You', score: 0, isDrawing: false, isCurrentUser: true }
  ];
  
  const [gameState, setGameState] = useState<GameState>({
    roomId,
    players: initialPlayers,
    messages: [],
    currentRound: 0,
    totalRounds: gameSettings.rounds,
    currentWord: '',
    wordRevealed: false,
    roundTimeLeft: gameSettings.roundDuration,
    gameStatus: 'waiting',
    roundDuration: gameSettings.roundDuration,
    drawingPlayerId: null
  });
  
  // Current user info
  const [currentUser, setCurrentUser] = useState({
    id: 'user-1',
    name: userName || 'You',
    avatar: undefined
  });
  
  // Mock game initialization
  useEffect(() => {
    // This would normally connect to a socket server
    toast.success(`Connected to room: ${roomId}`);
    
    // Set current user info
    if (userName) {
      setCurrentUser(prev => ({ ...prev, name: userName }));
      
      // Update player name in the player list
      setGameState(prev => ({
        ...prev,
        players: prev.players.map(p => 
          p.isCurrentUser ? { ...p, name: userName } : p
        )
      }));
    }
    
    // Clean up function
    return () => {
      // This would disconnect from socket server
      console.log("Disconnecting from game");
    };
  }, [roomId, userName]);
  
  // Update game settings when they change
  useEffect(() => {
    if (settings && gameState.gameStatus === 'waiting') {
      setGameState(prev => ({
        ...prev,
        totalRounds: settings.rounds,
        roundDuration: settings.roundDuration
      }));
    }
  }, [settings, gameState.gameStatus]);
  
  // Start the game (would be triggered by server in real app)
  const startGame = useCallback(() => {
    // Select first player to draw
    const firstPlayerIndex = Math.floor(Math.random() * gameState.players.length);
    const firstPlayerId = gameState.players[firstPlayerIndex].id;
    
    // Select random word
    const randomWord = MOCK_WORDS[Math.floor(Math.random() * MOCK_WORDS.length)];
    
    setGameState(prev => ({
      ...prev,
      gameStatus: 'playing',
      currentRound: 1,
      currentWord: randomWord,
      wordRevealed: false,
      roundTimeLeft: prev.roundDuration,
      drawingPlayerId: firstPlayerId,
      players: prev.players.map(p => ({
        ...p,
        isDrawing: p.id === firstPlayerId
      }))
    }));
    
    toast.info("Game started! First round beginning...");
  }, [gameState.players]);
  
  // Handle round end
  const endRound = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      gameStatus: 'roundEnd',
      wordRevealed: true
    }));
    
    toast.info(`Round ended! The word was "${gameState.currentWord}"`);
    
    // After a delay, start the next round or end the game
    setTimeout(() => {
      if (gameState.currentRound >= gameState.totalRounds) {
        // End game
        setGameState(prev => ({
          ...prev,
          gameStatus: 'gameEnd'
        }));
        toast.success("Game over! Check the final scores.");
      } else {
        // Start next round
        // Find next player to draw (cyclic)
        const currentDrawingIndex = gameState.players.findIndex(p => p.isDrawing);
        const nextDrawingIndex = (currentDrawingIndex + 1) % gameState.players.length;
        const nextDrawingId = gameState.players[nextDrawingIndex].id;
        
        // Select random word
        const randomWord = MOCK_WORDS[Math.floor(Math.random() * MOCK_WORDS.length)];
        
        setGameState(prev => ({
          ...prev,
          gameStatus: 'playing',
          currentRound: prev.currentRound + 1,
          currentWord: randomWord,
          wordRevealed: false,
          roundTimeLeft: prev.roundDuration,
          drawingPlayerId: nextDrawingId,
          players: prev.players.map(p => ({
            ...p,
            isDrawing: p.id === nextDrawingId
          }))
        }));
        
        toast.info(`Round ${gameState.currentRound + 1} starting!`);
      }
    }, 5000); // 5 seconds between rounds
  }, [gameState.currentRound, gameState.currentWord, gameState.players, gameState.totalRounds]);
  
  // Mock function to add a new player (simulating someone joining)
  const addMockPlayer = useCallback(() => {
    const mockNames = ['Alice', 'Bob', 'Charlie', 'Dana', 'Elijah', 'Fiona', 'George', 'Hannah'];
    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
    const newPlayerId = `user-${Date.now()}`;
    
    setGameState(prev => ({
      ...prev,
      players: [
        ...prev.players,
        {
          id: newPlayerId,
          name: randomName,
          score: 0,
          isDrawing: false,
          isCurrentUser: false
        }
      ]
    }));
    
    toast.info(`${randomName} joined the room`);
  }, []);
  
  // Send a message/guess
  const sendMessage = useCallback((text: string) => {
    // Check if the message is a correct guess
    const isCorrect = gameState.gameStatus === 'playing' && 
                      !gameState.players.find(p => p.id === currentUser.id)?.isDrawing &&
                      text.toLowerCase().trim() === gameState.currentWord.toLowerCase().trim();
    
    const newMessage: GameMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user: currentUser,
      text: isCorrect ? '🎯 Guessed the word!' : text,
      isCorrect,
      timestamp: new Date()
    };
    
    setGameState(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage],
      players: isCorrect 
        ? prev.players.map(p => 
            p.id === currentUser.id 
              ? { ...p, score: p.score + 100 } 
              : p
          )
        : prev.players
    }));
    
    if (isCorrect) {
      toast.success("You guessed correctly! +100 points");
    }
  }, [currentUser, gameState.currentWord, gameState.gameStatus, gameState.players]);
  
  // Leave the game/room
  const leaveGame = useCallback(() => {
    // Clean up and redirect to lobby
    navigate('/');
    toast.info("You left the game");
  }, [navigate]);
  
  return {
    gameState,
    currentUser,
    startGame,
    endRound,
    sendMessage,
    leaveGame,
    addMockPlayer,
    isCurrentPlayerDrawing: gameState.players.some(p => p.isCurrentUser && p.isDrawing),
    isGuessing: gameState.gameStatus === 'playing' && !gameState.players.some(p => p.isCurrentUser && p.isDrawing)
  };
};
