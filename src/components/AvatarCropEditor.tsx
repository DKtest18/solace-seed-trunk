import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { ZoomIn, ZoomOut, Move, RotateCcw } from 'lucide-react';

interface AvatarCropEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  initialZoom?: number;
  initialPositionX?: number;
  initialPositionY?: number;
  onSave: (zoom: number, positionX: number, positionY: number) => void;
}

export function AvatarCropEditor({
  open,
  onOpenChange,
  imageUrl,
  initialZoom = 1,
  initialPositionX = 50,
  initialPositionY = 50,
  onSave,
}: AvatarCropEditorProps) {
  const [zoom, setZoom] = useState(initialZoom);
  const [posX, setPosX] = useState(initialPositionX);
  const [posY, setPosY] = useState(initialPositionY);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setZoom(initialZoom);
      setPosX(initialPositionX);
      setPosY(initialPositionY);
    }
  }, [open, initialZoom, initialPositionX, initialPositionY]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = (e.clientX - dragStart.x) / 2;
    const dy = (e.clientY - dragStart.y) / 2;
    setPosX(prev => Math.max(0, Math.min(100, prev - dx / zoom)));
    setPosY(prev => Math.max(0, Math.min(100, prev - dy / zoom)));
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX, y: touch.clientY });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const dx = (touch.clientX - dragStart.x) / 2;
    const dy = (touch.clientY - dragStart.y) / 2;
    setPosX(prev => Math.max(0, Math.min(100, prev - dx / zoom)));
    setPosY(prev => Math.max(0, Math.min(100, prev - dy / zoom)));
    setDragStart({ x: touch.clientX, y: touch.clientY });
  }, [isDragging, dragStart, zoom]);

  const handleReset = () => {
    setZoom(1);
    setPosX(50);
    setPosY(50);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Profile Picture</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Preview circle */}
          <div className="flex justify-center">
            <div
              ref={containerRef}
              className="w-64 h-64 rounded-full overflow-hidden border-4 border-border cursor-grab active:cursor-grabbing relative select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
            >
              <img
                src={imageUrl}
                alt="Avatar preview"
                className="w-full h-full object-cover pointer-events-none"
                draggable={false}
                style={{
                  transform: `scale(${zoom})`,
                  objectPosition: `${posX}% ${posY}%`,
                  transformOrigin: `${posX}% ${posY}%`,
                }}
              />
            </div>
          </div>

          <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-1">
            <Move className="h-3 w-3" /> Drag to reposition
          </p>

          {/* Zoom control */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              Zoom
            </Label>
            <div className="flex items-center gap-3">
              <ZoomOut className="h-4 w-4 text-muted-foreground" />
              <Slider
                value={[zoom]}
                onValueChange={([v]) => setZoom(v)}
                min={1}
                max={3}
                step={0.05}
                className="flex-1"
              />
              <ZoomIn className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Reset */}
          <Button variant="outline" size="sm" onClick={handleReset} className="w-full">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => { onSave(zoom, posX, posY); onOpenChange(false); }}>
            Save Position
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Helper: returns inline style for rendering avatar with crop settings */
export function getAvatarCropStyle(zoom?: number, posX?: number, posY?: number): React.CSSProperties {
  if (!zoom || zoom === 1) {
    return {
      objectPosition: `${posX ?? 50}% ${posY ?? 50}%`,
    };
  }
  return {
    transform: `scale(${zoom})`,
    objectPosition: `${posX ?? 50}% ${posY ?? 50}%`,
    transformOrigin: `${posX ?? 50}% ${posY ?? 50}%`,
  };
}
