import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Palette, Eraser, Trash, Minus, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface CanvasProps {
  isDrawing: boolean;
  onDraw: (data: {
    x: number;
    y: number;
    drawing: boolean;
    color: string;
    size: number;
    clear?: boolean;
  }) => void;
  onStartDrawing?: () => void;
  onStopDrawing?: () => void;
  drawingHistory?: Array<{
    x: number;
    y: number;
    drawing: boolean;
    color: string;
    size: number;
    clear?: boolean;
  }>;
}

const Canvas: React.FC<CanvasProps> = ({ 
  isDrawing: canDraw, 
  onDraw,
  onStartDrawing,
  onStopDrawing,
  drawingHistory = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(5);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const renderedDrawingsRef = useRef<number>(0);
  
  const getContext = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    return ctx;
  };
  
  const clearCanvas = () => {
    const ctx = getContext();
    if (!ctx || !canvasRef.current) return;
    
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Signal that canvas was cleared
    onDraw({
      x: 0,
      y: 0,
      drawing: false,
      color: 'clear',
      size: 0,
      clear: true
    });
  };
  
  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set canvas dimensions to match its displayed size
    const resizeCanvas = () => {
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      // Reset context properties after resize
      const ctx = getContext();
      if (ctx) {
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = size;
        ctx.strokeStyle = color;
      }
      
      // Re-render all drawing history after resize
      renderedDrawingsRef.current = 0; // Force re-render all points
      renderDrawingHistory();
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);
  
  // Update context when color or size changes
  useEffect(() => {
    const ctx = getContext();
    if (!ctx) return;
    
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = size;
    ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
  }, [color, size, tool]);
  
  // Render the drawing history whenever it changes
  const renderDrawingHistory = useCallback(() => {
    if (!drawingHistory || drawingHistory.length === 0) return;
    
    const ctx = getContext();
    if (!ctx || !canvasRef.current) return;
    
    // Check if there's a clear event in the history
    const hasClearEvent = drawingHistory.some(d => d.clear);
    if (hasClearEvent) {
      console.log("Found clear event, clearing canvas");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      renderedDrawingsRef.current = 0;
      return;
    }
    
    // Start from where we left off
    const startFrom = renderedDrawingsRef.current;
    
    if (startFrom >= drawingHistory.length) {
      return; // No new points to render
    }
    
    let lastX = 0;
    let lastY = 0;
    let isCurrentlyDrawing = false;
    
    // For each drawing point after the last rendered one
    for (let i = 0; i < drawingHistory.length; i++) {
      const point = drawingHistory[i];
      
      if (point.clear) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        isCurrentlyDrawing = false;
        continue;
      }
      
      // If this is the end of a drawing session or starting a new one
      if (!point.drawing || !isCurrentlyDrawing) {
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        isCurrentlyDrawing = point.drawing;
      } else if (isCurrentlyDrawing) {
        // Configure line style for this segment
        ctx.strokeStyle = point.color;
        ctx.lineWidth = point.size;
        
        // Draw the line segment
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
      
      lastX = point.x;
      lastY = point.y;
    }
    
    // Update our rendered count
    renderedDrawingsRef.current = drawingHistory.length;
  }, [drawingHistory]);
  
  // Apply the drawing history when it changes
  useEffect(() => {
    // console.log("Drawing history updated, length:", drawingHistory.length);
    
    // Clear canvas if needed and redraw all points
    const ctx = getContext();
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      renderedDrawingsRef.current = 0;
      
      if (drawingHistory.length > 0) {
        renderDrawingHistory();
      }
    }
  }, [drawingHistory, renderDrawingHistory]);
  
  // Drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setIsDrawing(true);
    if (onStartDrawing) onStartDrawing();
    
    const { offsetX, offsetY } = getCoordinates(e);
    
    const ctx = getContext();
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY);
    }
    
    // Send drawing data to parent
    onDraw({
      x: offsetX,
      y: offsetY,
      drawing: true,
      color: tool === 'eraser' ? '#FFFFFF' : color,
      size
    });
  };
  
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canDraw) return;
    
    const { offsetX, offsetY } = getCoordinates(e);
    
    const ctx = getContext();
    if (ctx) {
      ctx.lineTo(offsetX, offsetY);
      ctx.stroke();
    }
    
    // Send drawing data to parent
    onDraw({
      x: offsetX,
      y: offsetY,
      drawing: true,
      color: tool === 'eraser' ? '#FFFFFF' : color,
      size
    });
  };
  
  const stopDrawing = () => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    if (onStopDrawing) onStopDrawing();
    
    const ctx = getContext();
    if (ctx) {
      ctx.closePath();
    }
    
    // Signal drawing ended
    onDraw({
      x: 0,
      y: 0,
      drawing: false,
      color: tool === 'eraser' ? '#FFFFFF' : color,
      size
    });
  };
  
  // Helper to get coordinates from mouse or touch event
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { offsetX: 0, offsetY: 0 };
    
    let offsetX = 0;
    let offsetY = 0;
    
    if ('touches' in e) {
      // Touch event
      const rect = canvas.getBoundingClientRect();
      offsetX = e.touches[0].clientX - rect.left;
      offsetY = e.touches[0].clientY - rect.top;
    } else {
      // Mouse event
      offsetX = e.nativeEvent.offsetX;
      offsetY = e.nativeEvent.offsetY;
    }
    
    return { offsetX, offsetY };
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Color picker */}
          <div className="relative">
            <input 
              type="color" 
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-10 p-0 border-2 border-border rounded-md cursor-pointer appearance-none"
              title="Pick a color"
              disabled={!canDraw || tool === 'eraser'}
            />
          </div>
          
          {/* Rest of the toolbar remains the same */}
          {/* Brush/Eraser toggle */}
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant={tool === 'brush' ? 'default' : 'outline'}
              onClick={() => setTool('brush')}
              className="h-8 w-8"
              title="Brush"
              disabled={!canDraw}
            >
              <Palette className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={tool === 'eraser' ? 'default' : 'outline'}
              onClick={() => setTool('eraser')}
              className="h-8 w-8"
              title="Eraser"
              disabled={!canDraw}
            >
              <Eraser className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Size control */}
          <div className="flex items-center gap-2 ml-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setSize(Math.max(1, size - 2))}
              className="h-8 w-8"
              title="Decrease size"
              disabled={!canDraw}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <div className="w-8 text-center text-sm">{size}px</div>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setSize(Math.min(30, size + 2))}
              className="h-8 w-8"
              title="Increase size"
              disabled={!canDraw}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Clear canvas */}
        <Button
          variant="outline"
          size="sm"
          onClick={clearCanvas}
          disabled={!canDraw}
          className="h-8"
          title="Clear canvas"
        >
          <Trash className="h-4 w-4 mr-2" />
          Clear
        </Button>
      </div>
      
      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        {canDraw && (
          <div className="absolute top-2 left-2 z-10 bg-primary text-primary-foreground text-sm px-3 py-1 rounded-full opacity-70">
            Your turn to draw
          </div>
        )}
        {!canDraw && (
          <div className="absolute top-2 left-2 z-10 bg-secondary text-secondary-foreground text-sm px-3 py-1 rounded-full opacity-70">
            Watching...
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full h-full bg-white border cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  );
};

export default Canvas;
