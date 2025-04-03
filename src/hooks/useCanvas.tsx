
import { useState, useCallback } from 'react';

interface DrawData {
  x: number;
  y: number;
  drawing: boolean;
  color: string;
  size: number;
}

export const useCanvas = () => {
  const [isDrawing, setIsDrawing] = useState(false);
  
  // This would normally connect to a backend socket.io server
  const startDrawing = useCallback(() => {
    setIsDrawing(true);
  }, []);
  
  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);
  
  const handleDraw = useCallback((data: DrawData) => {
    // In a real app, this would send the drawing data to the server
    console.log('Drawing data:', data);
  }, []);
  
  return {
    isDrawing,
    startDrawing,
    stopDrawing,
    handleDraw
  };
};
