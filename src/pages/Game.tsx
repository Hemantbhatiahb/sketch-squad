import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Home, Share, UserPlus, AlertTriangle } from 'lucide-react';
import Canvas from '@/components/Canvas';
import Chat from '@/components/Chat';
import Timer from '@/components/Timer';
import WordDisplay from '@/components/WordDisplay';
import PlayerList from '@/components/PlayerList';
import { useSocketGame } from '@/hooks/useSocketGame';
import { useSocketCanvas } from '@/hooks/useSocketCanvas';
import { useGameContext } from '@/contexts/GameContext';
import { toast } from 'sonner';

const Game = () => {
  const { roomId = '' } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { userName, isHost, settings, roomId: contextRoomId } = useGameContext();
  
  // Redirect to home if no userName is set
  useEffect(() => {
    if (!userName) {
      toast.error('Invalid game access. Please join through the lobby.');
      navigate('/');
    }
  }, [userName, navigate]);
  
  // Ensure roomId in URL matches context
  useEffect(() => {
    if (contextRoomId && roomId !== contextRoomId) {
      navigate(`/game/${contextRoomId}`);
    }
  }, [contextRoomId, roomId, navigate]);
  
  const { 
    gameState, 
    currentUser, 
    startGame, 
    sendMessage, 
    leaveGame,
    handleDraw,
    isCurrentPlayerDrawing,
    isGuessing,
    isConnecting,
    connectionError
  } = useSocketGame(roomId);
  
  const { 
    isDrawing, 
    startDrawing, 
    stopDrawing,
    clearCanvas,
    drawingHistory
  } = useSocketCanvas(roomId, isCurrentPlayerDrawing);

  const copyRoomLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(roomId)
      .then(() => toast.success('Room ID copied to clipboard!'))
      .catch(() => toast.error('Failed to copy ID'));
  };
  
  // Show loading or error state
  if (isConnecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-10 w-10 rounded-full bg-primary/10 mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Connecting to game server...</h2>
          <p className="text-muted-foreground">This may take a few moments</p>
        </div>
      </div>
    );
  }
  
  if (connectionError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="glass-panel p-6 max-w-md text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Connection Error</h2>
          <p className="text-muted-foreground mb-6">{connectionError}</p>
          <p className="text-sm text-muted-foreground mb-6">
            Make sure your server is running at http://localhost:3001
          </p>
          <div className="flex gap-4">
            <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
              Back to Lobby
            </Button>
            <Button className="w-full" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={leaveGame} className="button-hover">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold">Room: {roomId}</h1>
              <p className="text-xs text-muted-foreground">
                {gameState.gameStatus === 'waiting' 
                  ? 'Waiting for game to start' 
                  : gameState.gameStatus === 'playing' 
                    ? `Round ${gameState.currentRound} of ${gameState.totalRounds}` 
                    : gameState.gameStatus === 'roundEnd'
                    ? 'Round ended'
                    : 'Game over'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyRoomLink} className="button-hover">
              <Share className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="button-hover">
              <Home className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 container py-4 px-4">
        {gameState.gameStatus === 'waiting' ? (
          <div className="flex flex-col items-center justify-center h-full space-y-6 max-w-md mx-auto animate-scale">
            <div className="glass-panel p-8 text-center space-y-4 w-full">
              <h2 className="text-2xl font-bold">Waiting for players</h2>
              <p className="text-muted-foreground">
                Share the room code with your friends to get started!
              </p>
              
              <div className="bg-muted p-3 rounded-md font-mono text-2xl font-semibold tracking-wider">
                {roomId}
              </div>
              
              <div className="border-t border-border pt-4 mt-4">
                <p className="text-sm mb-4">Players ({gameState.players.filter(p => p.isConnected !== false).length}):</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {gameState.players.filter(p => p.isConnected !== false).map(player => (
                    <div 
                      key={player.id} 
                      className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                        player.isCurrentUser 
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground'
                      }`}
                    >
                      {player.name} {player.isCurrentUser && '(You)'}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {isHost && (
              <div className="space-y-2 w-full">
                <div className="text-center text-sm text-muted-foreground mb-2">
                  Game Settings: {gameState.roundDuration}s rounds, {gameState.totalRounds} rounds total
                </div>
                <Button 
                  size="lg" 
                  onClick={startGame}
                  className="button-hover w-full"
                  disabled={gameState.players.filter(p => p.isConnected !== false).length < 2}
                >
                  Start Game
                </Button>
                {gameState.players.filter(p => p.isConnected !== false).length < 2 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Need at least 2 players to start
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
            <div className="lg:col-span-2 space-y-4">
              {/* Word and timer */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                <WordDisplay 
                  word={gameState.currentWord} 
                  isRevealed={gameState.wordRevealed}
                  isDrawing={isCurrentPlayerDrawing} 
                />
                
                {gameState.gameStatus === 'playing' && (
                  <Timer 
                    duration={gameState.roundDuration} 
                    onTimeUp={() => {}} // Handled by server now
                    isActive={gameState.gameStatus === 'playing'} 
                    currentTime={gameState.roundTimeLeft} // Pass server time
                  />
                )}
              </div>
              
              {/* Canvas */}
              <div className="h-[500px] rounded-lg bg-card animate-fade-in">
                <Canvas 
                  isDrawing={isCurrentPlayerDrawing && gameState.gameStatus === 'playing'} 
                  onDraw={handleDraw}
                  onStartDrawing={startDrawing}
                  onStopDrawing={stopDrawing}
                  drawingHistory={drawingHistory} // Pass drawing history
                />
              </div>
            </div>
            
            {/* Sidebar */}
            <div className="space-y-4 animate-fade-in">
              <PlayerList players={gameState.players} />
              <div className="h-[400px]">
                <Chat 
                  messages={gameState.messages} 
                  onSendMessage={sendMessage} 
                  currentUser={currentUser}
                  isGuessing={isGuessing}
                />
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Game end overlay */}
      {gameState.gameStatus === 'gameEnd' && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-20 animate-fade-in">
          <div className="glass-panel p-8 max-w-md w-full animate-scale">
            <h2 className="text-3xl font-bold text-center mb-6">Game Over!</h2>
            
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-center">Final Scores</h3>
              <div className="space-y-2">
                {[...gameState.players].sort((a, b) => b.score - a.score).map((player, index) => (
                  <div key={player.id} className="flex items-center justify-between p-2 rounded-md bg-secondary">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{index + 1}.</span>
                      <span>{player.name} {player.isCurrentUser && '(You)'}</span>
                    </div>
                    <span className="font-semibold">{player.score} pts</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-8 flex gap-4">
              <Button variant="outline" className="flex-1 button-hover" onClick={leaveGame}>
                Back to Lobby
              </Button>
              {isHost && (
                <Button className="flex-1 button-hover" onClick={startGame}>
                  Play Again
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Game;
