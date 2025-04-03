
import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface GameSettings {
  maxPlayers: number;
  roundDuration: number;
  rounds: number;
  wordCount: number;
  hints: number;
}

export interface GamePlayer {
  id: string;
  name: string;
  avatar?: string;
  score: number;
  isDrawing: boolean;
  isConnected?: boolean;
  isCurrentUser: boolean;
}

const defaultSettings: GameSettings = {
  maxPlayers: 4,
  roundDuration: 60,
  rounds: 3,
  wordCount: 5,
  hints: 2
};

interface GameContextType {
  // User info
  userName: string;
  setUserName: (name: string) => void;
  
  // Current room info
  roomId: string | null;
  setRoomId: (id: string | null) => void;
  isHost: boolean;
  setIsHost: (isHost: boolean) => void;
  
  // Settings for room creation only
  settings: GameSettings;
  updateSettings: (settings: Partial<GameSettings>) => void;
  
  // Active games tracking
  activeGames: Record<string, {
    hostId: string;
    settings: GameSettings;
    createdAt: Date;
  }>;
  addActiveGame: (id: string, hostId: string, gameSettings: GameSettings) => void;
  removeActiveGame: (id: string) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<GameSettings>(defaultSettings);
  const [userName, setUserName] = useState<string>('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [activeGames, setActiveGames] = useState<Record<string, {
    hostId: string;
    settings: GameSettings;
    createdAt: Date;
  }>>({});

  const updateSettings = (newSettings: Partial<GameSettings>) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      ...newSettings
    }));
  };

  const addActiveGame = (id: string, hostId: string, gameSettings: GameSettings) => {
    setActiveGames(prev => ({
      ...prev,
      [id]: {
        hostId,
        settings: gameSettings,
        createdAt: new Date()
      }
    }));
  };

  const removeActiveGame = (id: string) => {
    setActiveGames(prev => {
      const newGames = { ...prev };
      delete newGames[id];
      return newGames;
    });
  };

  return (
    <GameContext.Provider 
      value={{ 
        // User info
        userName, 
        setUserName,
        
        // Current room
        roomId, 
        setRoomId,
        isHost,
        setIsHost,
        
        // Settings
        settings, 
        updateSettings,
        
        // Active games
        activeGames,
        addActiveGame,
        removeActiveGame
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGameContext = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
};
