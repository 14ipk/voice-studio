/**
 * Toast 通知容器
 */
import { useToastStore } from '@/store/useToastStore';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const STYLES: Record<string, string> = {
  success: 'border-neon-500/40 bg-neon-500/10 text-neon-200',
  error: 'border-magenta-400/40 bg-magenta-400/10 text-magenta-200',
  info: 'border-white/15 bg-white/5 text-white/90',
  warning: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
};

const ICON_COLORS: Record<string, string> = {
  success: 'text-neon-400',
  error: 'text-magenta-400',
  info: 'text-white/70',
  warning: 'text-amber-400',
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const Icon = ICONS[t.type];
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg backdrop-blur-xl border shadow-panel',
              'animate-[fadeIn_0.2s_ease-out]',
              STYLES[t.type],
            )}
          >
            <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', ICON_COLORS[t.type])} />
            <p className="flex-1 text-sm leading-relaxed">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-current/60 hover:text-current transition-colors"
              aria-label="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
