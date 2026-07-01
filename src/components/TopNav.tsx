/**
 * 顶部导航栏
 */
import { NavLink, useNavigate } from 'react-router-dom';
import { AudioWaveform, Wand2, FlaskConical, Library, Type, Download, Github } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/convert', label: '声音转换', icon: Wand2, hint: '录音 → 替换音色' },
  { to: '/clone', label: '音色克隆', icon: FlaskConical, hint: '样本 → 提取音色' },
  { to: '/library', label: '音色库', icon: Library, hint: '管理已克隆音色' },
  { to: '/tts', label: 'TTS 工作室', icon: Type, hint: '文字 → 语音' },
  { to: '/export', label: '导出中心', icon: Download, hint: '下载与格式' },
];

export function TopNav() {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-ink-950/70 border-b border-white/5">
      <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <button
          onClick={() => navigate('/convert')}
          className="flex items-center gap-2.5 group"
        >
          <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-neon-500/20 to-magenta-400/20 border border-neon-500/30 flex items-center justify-center overflow-hidden">
            <AudioWaveform className="w-5 h-5 text-neon-400 group-hover:scale-110 transition-transform" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-neon-500/10 to-transparent animate-shimmer" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display font-bold text-base text-white tracking-tight">
              Voice<span className="text-neon-400 text-glow-neon">Forge</span>
            </span>
            <span className="text-[10px] font-mono text-white/40 mt-0.5 tracking-wider uppercase">
              Audio · Clone · TTS
            </span>
          </div>
        </button>

        {/* Nav tabs */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'text-neon-300 bg-neon-500/10 shadow-neon-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/5',
                )
              }
              title={item.hint}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2">
          <a
            href="https://www.trae.ai/solo?showJoin=1"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost hidden sm:flex"
            title="由 Trae 提供支持"
          >
            <Github className="w-4 h-4" />
            <span className="text-xs">Trae Solo</span>
          </a>
        </div>
      </div>

      {/* Mobile nav row */}
      <div className="md:hidden border-t border-white/5 px-2 py-2 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  isActive
                    ? 'text-neon-300 bg-neon-500/10'
                    : 'text-white/60 hover:text-white hover:bg-white/5',
                )
              }
            >
              <item.icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </header>
  );
}
