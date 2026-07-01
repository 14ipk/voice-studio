/**
 * 旋转旋钮组件 — 可拖拽调节,支持触摸与键盘
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface KnobProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onDoubleClick?: () => void;
  label: string;
  unit?: string;
  size?: number;
  color?: 'neon' | 'magenta' | 'amber';
  format?: (v: number) => string;
}

const COLOR_VARS: Record<NonNullable<KnobProps['color']>, { ring: string; glow: string; text: string; dot: string }> = {
  neon: {
    ring: 'rgba(0, 240, 181, 0.7)',
    glow: '0 0 12px rgba(0, 240, 181, 0.5)',
    text: 'text-neon-300',
    dot: '#00F0B5',
  },
  magenta: {
    ring: 'rgba(255, 45, 126, 0.7)',
    glow: '0 0 12px rgba(255, 45, 126, 0.5)',
    text: 'text-magenta-300',
    dot: '#FF2D7E',
  },
  amber: {
    ring: 'rgba(255, 181, 71, 0.7)',
    glow: '0 0 12px rgba(255, 181, 71, 0.5)',
    text: 'text-amber-300',
    dot: '#FFB547',
  },
};

const ANGLE_RANGE = 270; // 总可旋转角度
const START_ANGLE = -135; // 起始角度(左下)

export function Knob({
  value,
  min,
  max,
  step = 1,
  onChange,
  onDoubleClick,
  label,
  unit = '',
  size = 64,
  color = 'neon',
  format,
}: KnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const dragStartRef = useRef<{ y: number; value: number } | null>(null);

  const range = max - min;
  const normalized = (value - min) / range;
  const angle = START_ANGLE + normalized * ANGLE_RANGE;
  const colors = COLOR_VARS[color];

  const clamp = useCallback(
    (v: number) => {
      const stepped = Math.round((v - min) / step) * step + min;
      const clamped = Math.max(min, Math.min(max, stepped));
      return Number(clamped.toFixed(4));
    },
    [min, max, step],
  );

  // 鼠标拖拽
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dy = dragStartRef.current.y - e.clientY;
      const delta = (dy / 200) * range;
      const next = clamp(dragStartRef.current.value + delta);
      onChange(next);
    };
    const handleUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    document.body.style.cursor = 'ns-resize';
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
    };
  }, [isDragging, range, onChange, clamp]);

  // 触摸拖拽
  useEffect(() => {
    if (!isDragging) return;
    const handleTouch = (e: TouchEvent) => {
      if (!dragStartRef.current || !e.touches[0]) return;
      const dy = dragStartRef.current.y - e.touches[0].clientY;
      const delta = (dy / 200) * range;
      const next = clamp(dragStartRef.current.value + delta);
      onChange(next);
    };
    const handleEnd = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };
    window.addEventListener('touchmove', handleTouch, { passive: false });
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouch);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, range, onChange, clamp]);

  const handleStart = (clientY: number) => {
    dragStartRef.current = { y: clientY, value };
    setIsDragging(true);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    const next = clamp(value + dir * step * (e.shiftKey ? 5 : 1));
    onChange(next);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(clamp(value + step * (e.shiftKey ? 5 : 1)));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(clamp(value - step * (e.shiftKey ? 5 : 1)));
    } else if (e.key === 'Home') {
      onChange(min);
    } else if (e.key === 'End') {
      onChange(max);
    }
  };

  const displayValue = format ? format(value) : `${value}${unit}`;
  const radius = size / 2;
  const indicatorLength = radius - 6;

  // 旋钮刻度弧线
  const arcRadius = radius - 4;
  const arcStart = {
    x: radius + arcRadius * Math.cos((START_ANGLE * Math.PI) / 180),
    y: radius + arcRadius * Math.sin((START_ANGLE * Math.PI) / 180),
  };
  const arcEnd = {
    x: radius + arcRadius * Math.cos(((START_ANGLE + ANGLE_RANGE) * Math.PI) / 180),
    y: radius + arcRadius * Math.sin(((START_ANGLE + ANGLE_RANGE) * Math.PI) / 180),
  };
  const largeArc = ANGLE_RANGE > 180 ? 1 : 0;

  // 当前值的弧
  const valueAngleRad = (angle * Math.PI) / 180;
  const valueArcEnd = {
    x: radius + arcRadius * Math.cos(valueAngleRad),
    y: radius + arcRadius * Math.sin(valueAngleRad),
  };
  const valueLargeArc = (angle - START_ANGLE) > 180 ? 1 : 0;

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div
        className={cn(
          'relative cursor-ns-resize transition-transform',
          isDragging && 'scale-105',
        )}
        style={{ width: size, height: size }}
        onMouseDown={(e) => {
          e.preventDefault();
          handleStart(e.clientY);
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          if (e.touches[0]) handleStart(e.touches[0].clientY);
        }}
        onWheel={handleWheel}
        onDoubleClick={onDoubleClick}
        onKeyDown={handleKey}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        tabIndex={0}
        role="slider"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
          {/* 背景弧 */}
          <path
            d={`M ${arcStart.x} ${arcStart.y} A ${arcRadius} ${arcRadius} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={3}
            strokeLinecap="round"
          />
          {/* 数值弧 */}
          <path
            d={`M ${arcStart.x} ${arcStart.y} A ${arcRadius} ${arcRadius} 0 ${valueLargeArc} 1 ${valueArcEnd.x} ${valueArcEnd.y}`}
            fill="none"
            stroke={colors.ring}
            strokeWidth={3}
            strokeLinecap="round"
            style={{ filter: isDragging || isFocused ? `drop-shadow(${colors.glow})` : 'none' }}
          />
          {/* 旋钮主体 */}
          <circle
            cx={radius}
            cy={radius}
            r={radius - 6}
            fill="url(#knobGrad)"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={1}
          />
          <defs>
            <radialGradient id="knobGrad" cx="0.3" cy="0.3">
              <stop offset="0%" stopColor="#2A2A38" />
              <stop offset="100%" stopColor="#14141D" />
            </radialGradient>
          </defs>
          {/* 指示线 */}
          <line
            x1={radius}
            y1={radius}
            x2={radius + indicatorLength * Math.cos(valueAngleRad)}
            y2={radius + indicatorLength * Math.sin(valueAngleRad)}
            stroke={colors.dot}
            strokeWidth={3}
            strokeLinecap="round"
            style={{ filter: isDragging || isFocused ? `drop-shadow(${colors.glow})` : 'none' }}
          />
          {/* 中心点 */}
          <circle cx={radius} cy={radius} r={2.5} fill={colors.dot} />
        </svg>
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <span className={cn('text-xs font-mono font-semibold tabular-nums', colors.text)}>
          {displayValue}
        </span>
        <span className="text-[10px] text-white/40 font-medium tracking-wide">{label}</span>
      </div>
    </div>
  );
}
