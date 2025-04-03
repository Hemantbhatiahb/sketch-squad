
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PencilLine } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Player {
  id: string;
  name: string;
  avatar?: string;
  score: number;
  isDrawing: boolean;
  isCurrentUser: boolean;
}

interface PlayerListProps {
  players: Player[];
}

const PlayerList: React.FC<PlayerListProps> = ({ players }) => {
  // Sort players by score (descending)
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  
  return (
    <div className="w-full rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="px-4 py-3 border-b">
        <h3 className="font-semibold text-lg">Players</h3>
      </div>
      
      <div className="p-2">
        {sortedPlayers.map((player) => (
          <div 
            key={player.id}
            className={cn(
              "flex items-center justify-between p-2 rounded-md",
              player.isCurrentUser && "bg-secondary",
              player.isDrawing && "bg-primary/10 dark:bg-primary/20",
              "transition-colors"
            )}
          >
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={player.avatar} alt={player.name} />
                  <AvatarFallback className="text-xs">
                    {player.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {player.isDrawing && (
                  <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                    <PencilLine className="h-3 w-3" />
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {player.name} {player.isCurrentUser && '(You)'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm bg-secondary px-2 py-0.5 rounded">
                {player.score}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerList;
