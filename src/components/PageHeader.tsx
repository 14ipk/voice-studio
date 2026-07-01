/**
 * 页面标题组件 — 用于各页面顶部
 */
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  badge?: string;
  className?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ icon: Icon, title, subtitle, badge, className, actions }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex items-start justify-between gap-4 flex-wrap', className)}>
      <div className="flex items-start gap-4">
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neon-500/20 to-magenta-400/10 border border-neon-500/30 flex items-center justify-center">
            <Icon className="w-6 h-6 text-neon-400" />
          </div>
          <div className="absolute inset-0 rounded-xl bg-neon-500/20 blur-xl opacity-50 -z-10" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-display text-2xl text-white tracking-tight">{title}</h1>
            {badge && (
              <span className="tag !text-[10px]">{badge}</span>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-white/50 mt-1 max-w-2xl">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
