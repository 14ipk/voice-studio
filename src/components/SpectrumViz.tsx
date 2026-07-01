/**
 * 频谱可视化 — 用于音色克隆特征展示
 */
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface SpectrumVizProps {
  /** 频谱数据(归一化 0-1) */
  data?: number[];
  /** 是否动画 */
  animated?: boolean;
  height?: number;
  className?: string;
}

export function SpectrumViz({
  data = [],
  animated = false,
  height = 120,
  className,
}: SpectrumVizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.offsetWidth;
    const h = height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let t = 0;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      const bars = Math.max(data.length, 64);
      const barWidth = w / bars;
      const gap = Math.max(1, barWidth * 0.25);
      const actualBarWidth = barWidth - gap;

      // 基线
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h - 1);
      ctx.lineTo(w, h - 1);
      ctx.stroke();

      for (let i = 0; i < bars; i++) {
        let amp: number;
        if (data.length > 0) {
          amp = data[i % data.length] || 0;
        } else if (animated) {
          // 动画装饰
          amp =
            0.3 +
            Math.sin(t * 0.02 + i * 0.3) * 0.25 +
            Math.sin(t * 0.05 + i * 0.1) * 0.15 +
            Math.random() * 0.05;
        } else {
          amp = 0.1;
        }
        amp = Math.max(0, Math.min(1, amp));
        const barH = amp * (h * 0.9);
        const x = i * barWidth + gap / 2;
        const y = h - barH;

        // 渐变填充
        const grad = ctx.createLinearGradient(0, y, 0, h);
        grad.addColorStop(0, 'rgba(255, 45, 126, 0.9)');
        grad.addColorStop(0.5, 'rgba(0, 240, 181, 0.7)');
        grad.addColorStop(1, 'rgba(0, 240, 181, 0.2)');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, actualBarWidth, barH);

        // 顶部高光
        if (amp > 0.3) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.fillRect(x, y, actualBarWidth, 1);
        }
      }

      t += 1;
      if (animated || data.length === 0) {
        raf = requestAnimationFrame(draw);
      }
    };
    draw();

    return () => cancelAnimationFrame(raf);
  }, [data, animated, height]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('w-full block', className)}
      style={{ height: `${height}px` }}
    />
  );
}
