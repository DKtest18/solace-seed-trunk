import { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PartyPopper } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
  continueLabel?: string;
  loading?: boolean;
}

interface Piece {
  x: number; y: number; vx: number; vy: number; size: number; rot: number; vr: number; color: string;
}

/** Lightweight HTML5 Canvas 2D confetti — no external animation libraries. */
function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = ['#2563eb', '#60a5fa', '#22c55e', '#f59e0b', '#a855f7'];
    const width = () => canvas.getBoundingClientRect().width;
    const height = () => canvas.getBoundingClientRect().height;

    const pieces: Piece[] = Array.from({ length: 110 }, () => ({
      x: Math.random() * width(),
      y: -20 - Math.random() * height(),
      vx: (Math.random() - 0.5) * 1.2,
      vy: 1.4 + Math.random() * 2.2,
      size: 4 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.2,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      ctx.clearRect(0, 0, width(), height());
      const elapsed = now - start;
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > height() + 20 && elapsed < 5000) {
          p.y = -20;
          p.x = Math.random() * width();
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (elapsed < 7000) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />;
}

export function SellerOnboardingCelebration({
  open, onOpenChange, onContinue, continueLabel = 'Start creating products', loading,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden">
        {open && <Confetti />}
        <DialogHeader className="relative z-10 text-center items-center">
          <div className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 animate-in zoom-in duration-500">
            <PartyPopper className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-2xl">Congratulations!</DialogTitle>
          <DialogDescription className="text-base">
            You've completed everything. You're now a seller and can start creating and uploading your products!
          </DialogDescription>
        </DialogHeader>
        <div className="relative z-10 flex flex-col gap-2 pt-2">
          <Button size="lg" onClick={onContinue} disabled={loading}>
            {continueLabel}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Stay on the checklist
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
