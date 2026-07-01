/**
 * 全局动画背景 — 缓慢流动的霓虹波形粒子
 * 使用 Canvas 绘制,性能受控
 */
import { useEffect, useRef } from 'react';

export function WaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    resize();
    window.addEventListener('resize', resize);

    // 多层波形
    const layers = [
      { amp: 60, freq: 0.008, speed: 0.6, color: 'rgba(0, 240, 181, 0.18)', y: 0.5 },
      { amp: 40, freq: 0.012, speed: -0.4, color: 'rgba(255, 45, 126, 0.12)', y: 0.55 },
      { amp: 80, freq: 0.005, speed: 0.3, color: 'rgba(0, 240, 181, 0.08)', y: 0.48 },
      { amp: 30, freq: 0.02, speed: -0.7, color: 'rgba(255, 45, 126, 0.06)', y: 0.62 },
    ];

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // 网格背景
      ctx.strokeStyle = 'rgba(0, 240, 181, 0.025)';
      ctx.lineWidth = 1 * dpr;
      const gridSize = 40 * dpr;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 波形
      for (const layer of layers) {
        ctx.beginPath();
        ctx.strokeStyle = layer.color;
        ctx.lineWidth = 2 * dpr;
        const centerY = h * layer.y;
        ctx.moveTo(0, centerY);
        for (let x = 0; x <= w; x += 4 * dpr) {
          const phase = t * layer.speed * 0.01;
          const y = centerY +
            Math.sin(x * layer.freq + phase) * layer.amp * dpr +
            Math.sin(x * layer.freq * 2 + phase * 1.7) * (layer.amp * 0.3) * dpr;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // 粒子
      const particleCount = 40;
      for (let i = 0; i < particleCount; i++) {
        const seed = i * 137.5;
        const x = ((seed + t * 0.5) % w);
        const y = (Math.sin(t * 0.005 + i) * 0.5 + 0.5) * h;
        const size = (Math.sin(t * 0.02 + i) * 0.5 + 0.5) * 2 + 0.5;
        const alpha = (Math.sin(t * 0.01 + i * 0.3) * 0.5 + 0.5) * 0.3;
        ctx.fillStyle = i % 2 === 0
          ? `rgba(0, 240, 181, ${alpha})`
          : `rgba(255, 45, 126, ${alpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(x, y, size * dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      t += 1;
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      aria-hidden="true"
    />
  );
}
