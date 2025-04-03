import { io, Socket } from "socket.io-client";
import { GameSettings } from "@/contexts/GameContext";
import { toast } from "sonner";

// Use environment variable for server URL with fallback for local development
const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || "http://localhost:3001";

class SocketService {
  private socket: Socket | null = null;
  private isConnecting: boolean = false;
  private callbacks: {
    [key: string]: ((...args: any[]) => void)[];
  } = {};

  constructor() {
    this.callbacks = {
      connect: [],
      connectError: [],
      disconnect: [],
      gameUpdate: [],
      playerJoined: [],
      playerLeft: [],
      newMessage: [],
      gameStarted: [],
      roundEnded: [],
      timerUpdate: [],
      drawingUpdate: [],
    };
  }

  connect(): Promise<void> {
    if (this.socket?.connected) {
      return Promise.resolve();
    }
    
    if (this.isConnecting) {
      return new Promise((resolve) => {
        this.callbacks.connect.push(() => resolve());
      });
    }
    
    this.isConnecting = true;
    
    return new Promise((resolve, reject) => {
      // Existing connection setup code, with reduced logging
      this.socket = io(SOCKET_SERVER_URL, {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
        transports: ['websocket', 'polling']
      });

      this.socket.on("connect", () => {
        this.isConnecting = false;
        this.callbacks.connect.forEach(callback => callback());
        resolve();
      });

      this.socket.on("connect_error", (error) => {
        this.isConnecting = false;
        this.callbacks.connectError.forEach(callback => callback(error));
        reject(error);
      });

      this.socket.on("disconnect", (reason) => {
        this.callbacks.disconnect.forEach(callback => callback(reason));
      });

      // Set up event listeners
      this.setupEventListeners();
      
      // Set a connection timeout
      setTimeout(() => {
        if (this.isConnecting) {
          this.isConnecting = false;
          reject(new Error("Connection timeout"));
        }
      }, 10000);
    });
  }

  private setupEventListeners(): void {
    if (!this.socket) return;
    
    this.socket.on("gameUpdate", (data: any) => {
      this.callbacks.gameUpdate.forEach(callback => callback(data));
    });

    this.socket.on("playerJoined", (player: any) => {
      this.callbacks.playerJoined.forEach(callback => callback(player));
    });

    this.socket.on("playerLeft", (data: { playerId: string }) => {
      this.callbacks.playerLeft.forEach(callback => callback(data.playerId));
    });

    this.socket.on("newMessage", (message: any) => {
      this.callbacks.newMessage.forEach(callback => callback(message));
    });

    this.socket.on("gameStarted", (room: any) => {
      this.callbacks.gameStarted.forEach(callback => callback(room));
    });

    this.socket.on("roundEnded", (data: { round: number; word: string }) => {
      this.callbacks.roundEnded.forEach(callback => callback(data));
    });

    this.socket.on("timerUpdate", (timeLeft: number) => {
      this.callbacks.timerUpdate.forEach(callback => callback(timeLeft));
    });

    this.socket.on("drawingUpdate", (drawingData: any) => {
      this.callbacks.drawingUpdate.forEach(callback => callback(drawingData));
    });
  }

  disconnect(): void {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
    this.isConnecting = false;
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }

  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    if (!this.callbacks[event]) return;
    this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
  }

  createRoom(hostId: string, settings: GameSettings, userName: string): Promise<{ roomId: string; success: boolean }> {
    return new Promise(async (resolve, reject) => {
      try {
        // First ensure we're connected
        if (!this.isConnected()) {
          await this.connect();
        }

        if (!this.socket) {
          return reject(new Error("Socket not connected"));
        }

        this.socket.emit(
          "createRoom",
          { hostId, settings, userName },
          (response: { roomId: string; success: boolean; message?: string }) => {
            if (response.success) {
              resolve(response);
            } else {
              reject(new Error(response.message || "Failed to create room"));
            }
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  joinRoom(roomId: string, player: { id: string; name: string; avatar?: string }): Promise<{ success: boolean; room: any }> {
    return new Promise(async (resolve, reject) => {
      try {
        // First ensure we're connected
        if (!this.isConnected()) {
          await this.connect();
        }

        if (!this.socket) {
          return reject(new Error("Socket not connected"));
        }

        this.socket.emit(
          "joinRoom",
          { roomId, player },
          (response: { success: boolean; room?: any; message?: string }) => {
            if (response.success && response.room) {
              resolve({ success: true, room: response.room });
            } else {
              const errorMsg = response.message || "Room not found";
              reject(new Error(errorMsg));
            }
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  leaveRoom(roomId: string, playerId: string): Promise<{ success: boolean }> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        resolve({ success: true }); // Resolve anyway since we're already disconnected
        return;
      }

      this.socket.emit(
        "leaveRoom",
        { roomId, playerId },
        (response: { success: boolean; message?: string }) => {
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.message || "Failed to leave room"));
          }
        }
      );
    });
  }

  sendMessage(roomId: string, message: any): Promise<{ success: boolean; isCorrect?: boolean }> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        return reject(new Error("Socket not connected"));
      }

      this.socket.emit(
        "sendMessage",
        { roomId, message },
        (response: { success: boolean; isCorrect?: boolean; message?: string }) => {
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.message || "Failed to send message"));
          }
        }
      );
    });
  }

  startGame(roomId: string): Promise<{ success: boolean; room?: any }> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        return reject(new Error("Socket not connected"));
      }

      this.socket.emit(
        "startGame",
        { roomId },
        (response: { success: boolean; room?: any; message?: string }) => {
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.message || "Failed to start game"));
          }
        }
      );
    });
  }

  sendDrawing(roomId: string, drawingData: any): void {
    if (!this.socket || !this.socket.connected) {
      console.warn("Socket not connected, can't send drawing");
      return;
    }
    
    this.socket.emit("drawing", { roomId, drawingData });
  }
}

// Create and export a singleton instance
const socketService = new SocketService();
export default socketService;
