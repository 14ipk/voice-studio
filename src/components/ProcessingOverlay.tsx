/**
 * 处理进度遮罩层 — 用于音频处理中
 */
import { Loader2 } from 'lucide-react';
import { useAudioStore } from '@/store/useAudioStore';
import { cn } from '@/lib/utils';

interface ProcessingOverlayProps {
  show?: boolean;
  progress?: number;
  label?: string;
  variant?: 'neon' | 'magenta';
}

export function ProcessingOverlay({
  show,
  progress,
  label,
  variant = 'neon',
}: ProcessingOverlayProps) {
  const job = useAudioStore((s) => s.job);
  const visible = show ?? (job.status === 'processing');
  const pct = progress ?? job.progress;
  const text = label ?? job.label;

  if (!visible) return null;

  const colorClass = variant === 'neon' ? 'text-neon-400' : 'text-magenta-400';
  const barClass = variant === 'neon' ? 'from-neon-500 to-neon-300' : 'from-magenta-500 to-magenta-300';
  const glowClass = variant === 'neon' ? 'shadow-neon' : 'shadow-magenta';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
      <div className="glass-panel rounded-2xl p-8 w-full max-w-md scanline-overlay">
        <div className="flex flex-col items-center gap-5">
          {/* 动画图标 */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-2 border-white/10 flex items-center justify-center">
              <Loader2 className={cn('w-10 h-10 animate-spin', colorClass)} />
            </div>
            {/* 辉光圈 */}
            <div
              className={cn(
                'absolute inset-0 rounded-full blur-xl opacity-30 animate-pulse-slow',
                variant === 'neon' ? 'bg-neon-500' : 'bg-magenta-400',
              )}
            />
          </div>

          <div className="text-center">
            <p className="text-display text-lg text-white">处理中</p>
            <p className={cn('text-sm mt-1 font-mono', colorClass)}>{text || '请稍候…'}</p>
          </div>

          {/* 进度条 */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40 font-mono">PROGRESS</span>
              <span className="text-xs font-mono text-white">{Math.round(pct)}%</span>
            </div>
            <div className="relative h-2 rounded-full bg-ink-800 overflow-hidden">
              <div
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-all duration-300',
                  barClass,
                  glowClass,
                )}
                style={{ width: `${pct}%` }}
              >
                <div className="absolute inset-0 progress-stripe opacity-30" />
              </div>
            </div>
          </div>

          {/* 阶段指示 */}
          <div className="grid grid-cols-4 gap-2 w-full">
            {[
              { label: '解码', pct: 25 },
              { label: '分析', pct: 50 },
              { label: '处理', pct: 75 },
              { label: '编码', pct: 100 },
            ].map((stage) => {
              const active = pct >= stage.pct - 25;
              const done = pct >= stage.pct;
              return (
                <div
                  key={stage.label}
                  className={cn(
                    'flex flex-col items-center gap-1 py-1.5 rounded-md border text-[10px] font-mono transition-all',
                    done
                      ? 'border-neon-500/40 bg-neon-500/5 text-neon-300'
                      : active
                        ? 'border-white/20 bg-white/5 text-white'
                        : 'border-white/5 text-white/30',
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full', done ? 'bg-neon-400' : active ? 'bg-white animate-pulse' : 'bg-white/20')} />
                  {stage.label}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
