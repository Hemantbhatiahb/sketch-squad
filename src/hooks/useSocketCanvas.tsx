
import { useState, useEffect, useCallback, useRef } from 'react';
import socketService from '@/services/socketService';

interface DrawData {
  x: number;
  y: number;
  drawing: boolean;
  color: string;
  size: number;
  clear?: boolean;
}

export const useSocketCanvas = (roomId: string, isDrawingUser: boolean) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingHistory, setDrawingHistory] = useState<DrawData[]>([]);
  const drawBatchRef = useRef<DrawData[]>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBatchSentTimeRef = useRef<number>(0);
  
  // Listen for drawing updates from other users
  useEffect(() => {
    const handleDrawingUpdate = (data: DrawData | DrawData[]) => {
      // Handle batched drawing data
      if (Array.isArray(data)) {
        // Process clear events first (if any)
        if (data.some(d => d.clear)) {
          setDrawingHistory([]);
          return;
        }
        
        // Add all batch points to history
        setDrawingHistory(prev => [...prev, ...data]);
        return;
      }
      
      // Process single draw data (backward compatibility)
      if (data.clear) {
        setDrawingHistory([]);
        return;
      }
      
      // Add new drawing data to history for all users
      setDrawingHistory(prev => [...prev, data]);
    };
    
    socketService.on('drawingUpdate', handleDrawingUpdate);
    
    // Clean up on component unmount
    return () => {
      socketService.off('drawingUpdate', handleDrawingUpdate);
    };
  }, []);
  
  // Reset drawing history when game state changes or round ends
  useEffect(() => {
    const handleGameUpdate = (data: any) => {
      // Only clear canvas when a new round is starting
      if (data.currentRound && data.gameStatus === 'playing' && data.roundTimeLeft === data.roundDuration) {
        setDrawingHistory([]);
      }
    };
    
    const handleRoundEnded = () => {
      // Clear the canvas after a delay to show the drawing briefly
      setTimeout(() => {
        setDrawingHistory([]);
      }, 5000); // 5 second delay matches the server's round transition timing
    };
    
    socketService.on('gameUpdate', handleGameUpdate);
    socketService.on('roundEnded', handleRoundEnded);
    
    return () => {
      socketService.off('gameUpdate', handleGameUpdate);
      socketService.off('roundEnded', handleRoundEnded);
      
      // Clear any pending batches
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);
  
  // Send batched drawing data to server
  const sendDrawingBatch = useCallback(() => {
    if (drawBatchRef.current.length === 0) return;
    
    const now = Date.now();
    lastBatchSentTimeRef.current = now;
    
    // Only send if we have drawing data
    socketService.sendDrawing(roomId, [...drawBatchRef.current]);
    drawBatchRef.current = [];
    batchTimeoutRef.current = null;
  }, [roomId]);
  
  const startDrawing = useCallback(() => {
    if (isDrawingUser) {
      setIsDrawing(true);
    }
  }, [isDrawingUser]);
  
  const stopDrawing = useCallback(() => {
    if (isDrawingUser) {
      setIsDrawing(false);
      
      // Send any remaining batch immediately when stopping drawing
      sendDrawingBatch();
    }
  }, [isDrawingUser, sendDrawingBatch]);
  
  const handleDraw = useCallback((data: DrawData) => {
    if (isDrawingUser) {
      // Special case for clear command - send immediately
      if (data.clear) {
        // Clear any pending batches
        if (batchTimeoutRef.current) {
          clearTimeout(batchTimeoutRef.current);
          batchTimeoutRef.current = null;
        }
        drawBatchRef.current = [];
        
        // Update locally first for immediate feedback
        setDrawingHistory([]);
        
        // Then sync with server
        socketService.sendDrawing(roomId, data);
        return;
      }
      
      // *** LOCAL-FIRST APPROACH ***
      // Add to local history immediately for responsive UI
      setDrawingHistory(prev => [...prev, data]);
      
      // Add to batch for server sync (background process)
      drawBatchRef.current.push(data);
      
      // Adaptive batching - more aggressive for smoother syncing
      const now = Date.now();
      const timeSinceLastBatch = now - lastBatchSentTimeRef.current;
      
      // If batch is getting large (> 15 points) or it's been more than 80ms, send immediately
      if (drawBatchRef.current.length > 15 || timeSinceLastBatch > 80) {
        if (batchTimeoutRef.current) {
          clearTimeout(batchTimeoutRef.current);
        }
        sendDrawingBatch();
      } 
      // Otherwise, set timeout to send soon if not already set
      else if (!batchTimeoutRef.current) {
        batchTimeoutRef.current = setTimeout(sendDrawingBatch, 30); // Send every 30ms at most
      }
    }
  }, [roomId, isDrawingUser, sendDrawingBatch]);
  
  const clearCanvas = useCallback(() => {
    if (isDrawingUser) {
      const clearData = { 
        x: 0, 
        y: 0, 
        drawing: false, 
        color: 'clear', 
        size: 0,
        clear: true 
      };
      
      // Update locally first for immediate feedback
      setDrawingHistory([]);
      
      // Then sync with server
      socketService.sendDrawing(roomId, clearData);
    }
  }, [roomId, isDrawingUser]);
  
  return {
    isDrawing,
    startDrawing,
    stopDrawing,
    handleDraw,
    clearCanvas,
    drawingHistory
  };
};
