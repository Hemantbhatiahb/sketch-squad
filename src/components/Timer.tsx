
import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface TimerProps {
  duration: number; // in seconds
  onTimeUp: () => void;
  isActive: boolean;
  currentTime?: number; // Add an optional prop for server-provided time
}

const Timer: React.FC<TimerProps> = ({ duration, onTimeUp, isActive, currentTime }) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [color, setColor] = useState('bg-primary');
  
  // Reset timer when duration changes
  useEffect(() => {
    if (currentTime === undefined) {
      setTimeLeft(duration);
    }
  }, [duration, currentTime]);
  
  // Update timer when server provides time
  useEffect(() => {
    if (currentTime !== undefined) {
      // console.log(`Timer updated from server: ${currentTime}s left`);
      setTimeLeft(currentTime);
    }
  }, [currentTime]);
  
  // Local timer countdown only when no server time is provided
  useEffect(() => {
    if (!isActive) return;
    
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        // Only decrement if we're not being driven by server updates
        if (currentTime === undefined) {
          if (prev <= 1) {
            clearInterval(interval);
            onTimeUp();
            return 0;
          }
          return prev - 1;
        }
        return prev;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [duration, onTimeUp, isActive, currentTime]);
  
  // Update color based on time left
  useEffect(() => {
    const percentage = timeLeft / duration;
    
    if (percentage <= 0.25) {
      setColor('bg-destructive');
    } else if (percentage <= 0.5) {
      setColor('bg-amber-500');
    } else {
      setColor('bg-primary');
    }
  }, [timeLeft, duration]);
  
  // Format time as MM:SS
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const progressValue = (timeLeft / duration) * 100;
  
  return (
    <div className="w-full space-y-1">
      <div className="flex justify-between text-sm font-medium">
        <span>Time Left</span>
        <span className={cn(
          "transition-colors duration-300",
          timeLeft <= duration * 0.25 ? "text-destructive animate-pulse" : ""
        )}>
          {formatTime(timeLeft)}
        </span>
      </div>
      <Progress 
        value={progressValue} 
        className="h-2 transition-all duration-300"
        indicatorClassName={cn("transition-all duration-300", color)}
      />
    </div>
  );
};

export default Timer;
