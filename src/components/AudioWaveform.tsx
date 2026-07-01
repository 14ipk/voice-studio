/**
 * 音频波形可视化组件
 * 支持传入预生成的波形数组或音频 URL
 */
import { useEffect, useRef, useState } from 'react';
import { audioEngine } from '@/lib/audioEngine';
import { cn } from '@/lib/utils';

interface AudioWaveformProps {
  /** 音频 URL */
  url?: string;
  /** 预生成的波形数据(归一化 0-1) */
  data?: number[];
  /** 高度 */
  height?: number;
  /** 是否显示播放进度(需要外部控制) */
  progress?: number; // 0-1
  /** 颜色 */
  variant?: 'neon' | 'magenta' | 'mono' | 'mixed';
  /** 是否带动画 */
  animated?: boolean;
  className?: string;
  /** bar 数量 */
  bars?: number;
  /** 是否静默加载(不打印错误) */
  silent?: boolean;
}

const COLOR_MAP: Record<NonNullable<AudioWaveformProps['variant']>, { base: string; active: string; peak: string }> = {
  neon: { base: 'rgba(0, 240, 181, 0.4)', active: '#00F0B5', peak: 'rgba(0, 240, 181, 0.8)' },
  magenta: { base: 'rgba(255, 45, 126, 0.4)', active: '#FF2D7E', peak: 'rgba(255, 45, 126, 0.8)' },
  mono: { base: 'rgba(255, 255, 255, 0.2)', active: '#ffffff', peak: 'rgba(255, 255, 255, 0.7)' },
  mixed: { base: 'rgba(0, 240, 181, 0.3)', active: '#00F0B5', peak: 'rgba(255, 45, 126, 0.7)' },
};

export function AudioWaveform({
  url,
  data,
  height = 64,
  progress = 0,
  variant = 'neon',
  animated = false,
  className,
  bars = 80,
  silent = false,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wave, setWave] = useState<number[]>(data || []);

  // 加载音频并提取波形
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    audioEngine.loadBuffer(url).then((buffer) => {
      if (cancelled) return;
      const w = audioEngine.extractWaveform(buffer, bars);
      setWave(w);
    }).catch((err) => {
      if (!silent) console.warn('[AudioWaveform] load failed', err);
    });
    return () => {
      cancelled = true;
    };
  }, [url, bars, silent]);

  // 用 data prop 时直接使用
  useEffect(() => {
    if (data) setWave(data);
  }, [data]);

  // 绘制
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

    ctx.clearRect(0, 0, w, h);

    const colors = COLOR_MAP[variant];
    const barWidth = w / bars;
    const gap = Math.max(1, barWidth * 0.3);
    const actualBarWidth = barWidth - gap;

    const mid = h / 2;
    const activeIdx = Math.floor(progress * bars);

    for (let i = 0; i < bars; i++) {
      let amp: number;
      if (i < wave.length) {
        amp = wave[i];
      } else if (animated) {
        // 动画装饰用
        amp = 0.3 + Math.sin(Date.now() * 0.003 + i * 0.5) * 0.3 + Math.random() * 0.1;
      } else {
        amp = 0.1;
      }
      const barH = Math.max(2, amp * (h * 0.9));
      const x = i * barWidth + gap / 2;
      const y = mid - barH / 2;

      if (i <= activeIdx) {
        ctx.fillStyle = colors.active;
        ctx.shadowColor = colors.active;
        ctx.shadowBlur = 8;
      } else {
        ctx.fillStyle = colors.base;
        ctx.shadowBlur = 0;
      }
      ctx.fillRect(x, y, actualBarWidth, barH);

      // 峰值高光
      if (i <= activeIdx && amp > 0.6) {
        ctx.fillStyle = colors.peak;
        ctx.fillRect(x, y, actualBarWidth, 2);
        ctx.fillRect(x, y + barH - 2, actualBarWidth, 2);
      }
    }
    ctx.shadowBlur = 0;
  }, [wave, progress, height, variant, animated, bars]);

  // 动画装饰时持续重绘
  useEffect(() => {
    if (!animated) return;
    let raf = 0;
    const tick = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.offsetWidth;
      const h = height;
      ctx.clearRect(0, 0, w, h);
      const colors = COLOR_MAP[variant];
      const barWidth = w / bars;
      const gap = Math.max(1, barWidth * 0.3);
      const actualBarWidth = barWidth - gap;
      const mid = h / 2;
      for (let i = 0; i < bars; i++) {
        const amp = 0.2 + Math.sin(Date.now() * 0.003 + i * 0.5) * 0.25 + Math.random() * 0.1;
        const barH = Math.max(2, amp * (h * 0.9));
        const x = i * barWidth + gap / 2;
        const y = mid - barH / 2;
        ctx.fillStyle = colors.base;
        ctx.fillRect(x, y, actualBarWidth, barH);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animated, height, variant, bars]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('w-full block', className)}
      style={{ height: `${height}px` }}
    />
  );
}
