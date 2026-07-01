/**
 * 母带旋钮面板 — 8 个参数旋钮
 */
import { Knob } from './Knob';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { KNOB_META, type AudioParameters } from '@shared/types';
import { useAudioStore } from '@/store/useAudioStore';
import { cn } from '@/lib/utils';

interface KnobPanelProps {
  className?: string;
  compact?: boolean;
}

export function KnobPanel({ className, compact = false }: KnobPanelProps) {
  const params = useAudioStore((s) => s.params);
  const setParam = useAudioStore((s) => s.setParam);
  const resetParam = useAudioStore((s) => s.resetParam);
  const resetParams = useAudioStore((s) => s.resetParams);

  return (
    <div className={cn('glass-panel rounded-2xl p-5', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-neon-400" />
          <h3 className="text-display text-sm tracking-wide text-white">
            母带调节
          </h3>
          <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
            Mastering
          </span>
        </div>
        <button
          onClick={resetParams}
          className="btn-ghost text-xs"
          title="重置全部参数"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>重置全部</span>
        </button>
      </div>

      <div
        className={cn(
          'grid gap-x-2 gap-y-4',
          compact
            ? 'grid-cols-4'
            : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-4',
        )}
      >
        {KNOB_META.map((meta) => {
          const value = params[meta.key];
          const format = (v: number) => {
            const num = meta.step < 1 ? v.toFixed(2) : v.toString();
            return `${num}${meta.unit}`;
          };
          return (
            <div key={meta.key} className="group relative">
              <Knob
                value={value}
                min={meta.min}
                max={meta.max}
                step={meta.step}
                unit={meta.unit}
                color={meta.color}
                label={meta.label}
                onChange={(v) => setParam(meta.key, v as AudioParameters[typeof meta.key])}
                onDoubleClick={() => resetParam(meta.key)}
                format={format}
                size={compact ? 56 : 64}
              />
              <button
                onClick={() => resetParam(meta.key)}
                className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-white/80"
                title={`重置 ${meta.label}`}
              >
                <RotateCcw className="w-3 h-3" />
              </button>
              {/* tooltip on hover */}
              <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity bg-ink-900 border border-white/10 rounded-md px-2 py-1 text-[10px] text-white/70 whitespace-nowrap z-10">
                {meta.hint}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
