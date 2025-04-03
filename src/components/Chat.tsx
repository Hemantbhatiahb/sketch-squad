
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
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

interface ChatProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  currentUser: { id: string; name: string; avatar?: string };
  isGuessing: boolean;
}

const Chat: React.FC<ChatProps> = ({ messages, onSendMessage, currentUser, isGuessing }) => {
  const [message, setMessage] = useState('');
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  
  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() === '') return;
    
    onSendMessage(message);
    setMessage('');
  };
  
  // Format time as HH:MM
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div className="h-full flex flex-col rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="px-4 py-3 border-b">
        <h3 className="font-semibold text-lg">Chat {isGuessing ? '(Guess the word!)' : ''}</h3>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex items-start gap-2 group transition-opacity",
                msg.isCorrect && "bg-green-100 dark:bg-green-900/20 p-2 rounded-lg",
                msg.user.id === currentUser.id ? "flex-row-reverse" : ""
              )}
            >
              <Avatar className={cn("h-8 w-8 flex-shrink-0", msg.user.id === currentUser.id ? "ml-2" : "mr-2")}>
                <AvatarImage src={msg.user.avatar} alt={msg.user.name} />
                <AvatarFallback className="text-xs">
                  {msg.user.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm max-w-[80%]",
                msg.user.id === currentUser.id 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-secondary text-secondary-foreground"
              )}>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-xs opacity-80">
                    {msg.user.id === currentUser.id ? 'You' : msg.user.name}
                  </p>
                  <span className="text-[10px] opacity-60">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <p>{msg.text}</p>
                {msg.isCorrect && (
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
                    Correct guess! 🎉
                  </p>
                )}
              </div>
            </div>
          ))}
          <div ref={endOfMessagesRef} />
        </div>
      </ScrollArea>
      
      <form onSubmit={handleSubmit} className="p-4 border-t bg-card">
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isGuessing ? "Type your guess..." : "Type a message..."}
            className="flex-1"
            disabled={!isGuessing}
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={!isGuessing || message.trim() === ''}
            className="button-hover"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default Chat;
