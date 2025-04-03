
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PencilLine, Users, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useGameContext } from '@/contexts/GameContext';
import socketService from '@/services/socketService';
import { v4 as uuidv4 } from 'uuid';

const Index = () => {
  const navigate = useNavigate();
  const { settings, updateSettings, setUserName, setRoomId, setIsHost } = useGameContext();
  
  const [userNameInput, setUserNameInput] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [createRoom, setCreateRoom] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Connect to socket server when page loads
  useEffect(() => {
    const connectToServer = async () => {
      try {
        setIsConnecting(true);
        await socketService.connect();
        setIsConnecting(false);
        setConnectionError(null);
      } catch (error: any) {
        console.error("Socket connection error:", error);
        setIsConnecting(false);
        setConnectionError(error?.message || "Failed to connect to server");
      }
    };
    
    connectToServer();
    
    return () => {
      // No need to disconnect on unmount as we want to keep the connection
    };
  }, []);
  
  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userNameInput.trim()) {
      toast.error('Please enter your name');
      return;
    }
    
    // Store user name in context
    setUserName(userNameInput);
    
    // Ensure we're connected to the socket server
    if (!socketService.isConnected()) {
      try {
        setIsConnecting(true);
        await socketService.connect();
        setIsConnecting(false);
      } catch (error) {
        console.error("Failed to connect to socket server:", error);
        toast.error("Failed to connect to game server. Please try again later.");
        setIsConnecting(false);
        return;
      }
    }
    
    if (createRoom) {
      try {
        setIsCreatingRoom(true);
        // Generate a base user ID if not already stored
        const userId = localStorage.getItem('userId') || uuidv4();
        localStorage.setItem('userId', userId);
        
        // Use the createRoom function from socketService directly
        const response = await socketService.createRoom(
          userId,
          settings,
          userNameInput
        );
        
        if (response.success) {
          // Store data in context
          setRoomId(response.roomId);
          setIsHost(true);
          
          // Navigate to game room
          navigate(`/game/${response.roomId}`);
          toast.success(`Created room: ${response.roomId}`);
        } else {
          toast.error('Failed to create room. Please try again.');
        }
      } catch (error: any) {
        console.error('Error creating room:', error);
        toast.error(error?.message || 'Failed to create room');
      } finally {
        setIsCreatingRoom(false);
      }
    } else {
      if (!roomIdInput.trim()) {
        toast.error('Please enter a room ID');
        return;
      }
      
      try {
        setIsJoiningRoom(true);
        // Store data in context
        const roomIdUpper = roomIdInput.toUpperCase();
        setRoomId(roomIdUpper);
        setIsHost(false);
        
        // Get base ID and generate a unique ID for this joining session
        const baseId = localStorage.getItem('userId') || uuidv4();
        // Store the base ID in localStorage
        localStorage.setItem('userId', baseId);
        
        // Log that we're about to navigate to the game
        console.log(`Navigating to game room ${roomIdUpper} as joiner with base ID ${baseId}`);
        
        // First, attempt to just connect to the socket server
        if (!socketService.isConnected()) {
          await socketService.connect();
        }
        
        // We'll join the room in the Game component
        navigate(`/game/${roomIdUpper}`);
      } catch (error: any) {
        console.error('Error joining room:', error);
        toast.error(error?.message || 'Failed to join room');
        setIsJoiningRoom(false);
      }
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-2">
            <PencilLine className="h-8 w-8 text-primary" />
          </div>
          <h1 className="title-text">Sketch Guess</h1>
          <p className="subtitle-text">
            Draw, guess, and have fun with friends!
          </p>
          
          {/* New informational message about opening in new tab */}
          <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
            <ExternalLink className="h-3 w-3" />
            Open this page in a new tab to join as another player
          </p>
          
          {connectionError ? (
            <p className="text-xs text-destructive mt-1 flex items-center justify-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {connectionError}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              {isConnecting ? (
                <span className="flex items-center justify-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Connecting to server...
                </span>
              ) : (
                socketService.isConnected() ? 
                  "Connected to server ✓" : 
                  "Not connected to server"
              )}
            </p>
          )}
        </div>
        
        <div className="glass-panel p-6 shadow-lg">
          <div className="flex space-x-2 mb-6">
            <Button 
              variant={createRoom ? "default" : "outline"} 
              className={cn("flex-1 button-hover", !createRoom && "bg-secondary/50")}
              onClick={() => setCreateRoom(true)}
            >
              Create Room
            </Button>
            <Button 
              variant={!createRoom ? "default" : "outline"} 
              className={cn("flex-1 button-hover", createRoom && "bg-secondary/50")}
              onClick={() => setCreateRoom(false)}
            >
              Join Room
            </Button>
          </div>
          
          <form onSubmit={handleJoinGame} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userName">Your Name</Label>
              <Input
                id="userName"
                placeholder="Enter your name"
                value={userNameInput}
                onChange={(e) => setUserNameInput(e.target.value)}
                className="focus-ring"
                required
              />
            </div>
            
            {createRoom ? (
              // ... keep existing code (room creation options)
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxPlayers">Players 👥</Label>
                    <Select 
                      value={settings.maxPlayers.toString()} 
                      onValueChange={(value) => updateSettings({ maxPlayers: parseInt(value) })}
                    >
                      <SelectTrigger className="focus-ring">
                        <SelectValue placeholder="Max Players" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 players</SelectItem>
                        <SelectItem value="3">3 players</SelectItem>
                        <SelectItem value="4">4 players</SelectItem>
                        <SelectItem value="5">5 players</SelectItem>
                        <SelectItem value="6">6 players</SelectItem>
                        <SelectItem value="8">8 players</SelectItem>
                        <SelectItem value="10">10 players</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="roundTime">Draw Time ⏳</Label>
                    <Select 
                      value={settings.roundDuration.toString()} 
                      onValueChange={(value) => updateSettings({ roundDuration: parseInt(value) })}
                    >
                      <SelectTrigger className="focus-ring">
                        <SelectValue placeholder="Draw Time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 seconds</SelectItem>
                        <SelectItem value="30">30 seconds</SelectItem>
                        <SelectItem value="45">45 seconds</SelectItem>
                        <SelectItem value="60">60 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rounds">Rounds 🔄</Label>
                    <Select 
                      value={settings.rounds.toString()} 
                      onValueChange={(value) => updateSettings({ rounds: parseInt(value) })}
                    >
                      <SelectTrigger className="focus-ring">
                        <SelectValue placeholder="Rounds" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 rounds</SelectItem>
                        <SelectItem value="3">3 rounds</SelectItem>
                        <SelectItem value="4">4 rounds</SelectItem>
                        <SelectItem value="5">5 rounds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="wordCount">Word Count 🔤</Label>
                    <Select 
                      value={settings.wordCount.toString()} 
                      onValueChange={(value) => updateSettings({ wordCount: parseInt(value) })}
                    >
                      <SelectTrigger className="focus-ring">
                        <SelectValue placeholder="Word Count" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 words</SelectItem>
                        <SelectItem value="5">5 words</SelectItem>
                        <SelectItem value="7">7 words</SelectItem>
                        <SelectItem value="10">10 words</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="hints">Hints 💡</Label>
                    <Select 
                      value={settings.hints.toString()} 
                      onValueChange={(value) => updateSettings({ hints: parseInt(value) })}
                    >
                      <SelectTrigger className="focus-ring">
                        <SelectValue placeholder="Hints" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">No hints</SelectItem>
                        <SelectItem value="1">1 letter</SelectItem>
                        <SelectItem value="2">2 letters</SelectItem>
                        <SelectItem value="3">3 letters</SelectItem>
                        <SelectItem value="5">5 letters</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="roomId">Room ID</Label>
                <Input
                  id="roomId"
                  placeholder="Enter room ID"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                  className="focus-ring"
                  required
                />
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full button-hover"
              size="lg"
              disabled={isConnecting || isCreatingRoom || isJoiningRoom}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : isCreatingRoom ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Room...
                </>
              ) : isJoiningRoom ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining Room...
                </>
              ) : (
                createRoom ? 'Create Game' : 'Join Game'
              )}
            </Button>
          </form>
        </div>
        
        <div className="text-center">
          <div className="inline-flex items-center text-muted-foreground text-sm">
            <Users className="h-4 w-4 mr-1" />
            <span>Players online: {socketService.isConnected() ? "248" : "0"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
