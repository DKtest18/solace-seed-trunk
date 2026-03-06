import { useEffect, useRef } from 'react';

export function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let mouseX = 0;
    let mouseY = 0;

    const shapes: { x: number; y: number; size: number; speed: number; angle: number; type: number }[] = [];
    for (let i = 0; i < 20; i++) {
      shapes.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 30 + 10,
        speed: Math.random() * 0.5 + 0.1,
        angle: Math.random() * Math.PI * 2,
        type: Math.floor(Math.random() * 3),
      });
    }

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const handleMouse = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('mousemove', handleMouse);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      shapes.forEach((s) => {
        s.angle += s.speed * 0.01;
        const px = s.x + mouseX * 30 + Math.sin(s.angle) * 20;
        const py = s.y + mouseY * 30 + Math.cos(s.angle) * 20;

        ctx.strokeStyle = 'rgba(14, 165, 233, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (s.type === 0) {
          ctx.arc(px, py, s.size, 0, Math.PI * 2);
        } else if (s.type === 1) {
          ctx.rect(px - s.size / 2, py - s.size / 2, s.size, s.size);
        } else {
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i + s.angle;
            const hx = px + Math.cos(a) * s.size;
            const hy = py + Math.sin(a) * s.size;
            i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
          }
          ctx.closePath();
        }
        ctx.stroke();
      });
      animationId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 -z-10 w-full h-full"
    />
  );
}
