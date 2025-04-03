
import React from 'react';
import { cn } from '@/lib/utils';

interface WordDisplayProps {
  word: string;
  isRevealed: boolean;
  isDrawing: boolean;
}

const WordDisplay: React.FC<WordDisplayProps> = ({ word, isRevealed, isDrawing }) => {
  const renderWord = () => {
    if (isRevealed || isDrawing) {
      return word;
    } else {
      // Replace each letter with an underscore, preserve spaces
      return word.split('').map(char => 
        char === ' ' ? ' ' : '_'
      ).join('');
    }
  };
  
  return (
    <div className="w-full flex flex-col items-center justify-center py-3 px-4 bg-card rounded-lg border shadow-sm">
      <span className="text-sm text-muted-foreground mb-1">
        {isDrawing ? 'Your word to draw' : 'Current word'}
      </span>
      <div 
        className={cn(
          "text-center text-2xl sm:text-3xl font-bold tracking-wide",
          !isRevealed && !isDrawing && "font-mono"
        )}
      >
        {renderWord()}
      </div>
      {isDrawing && (
        <p className="mt-2 text-sm text-center max-w-md">
          Draw this word so others can guess it!
        </p>
      )}
    </div>
  );
};

export default WordDisplay;
