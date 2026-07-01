/**
 * 音色卡片 — 用于音色库与音色选择
 */
import { useState } from 'react';
import { Play, Square, Star, Trash2, Pencil, MoreVertical, Mic2, Check } from 'lucide-react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { api } from '@/lib/api';
import type { VoiceProfile } from '@shared/types';
import { formatDuration, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface VoiceCardProps {
  voice: VoiceProfile;
  /** 选择模式(用于在转换/TTS 中选音色) */
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (voice: VoiceProfile) => void;
  /** 显示操作菜单 */
  showActions?: boolean;
  onEdit?: (voice: VoiceProfile) => void;
  onDelete?: (voice: VoiceProfile) => void;
  onFavorite?: (voice: VoiceProfile) => void;
  className?: string;
}

const GENDER_LABEL: Record<string, string> = {
  male: '男声',
  female: '女声',
  neutral: '中性',
};

const SOURCE_LABEL: Record<string, string> = {
  preset: '预设',
  cloned: '已克隆',
};

export function VoiceCard({
  voice,
  selectable = false,
  selected = false,
  onSelect,
  showActions = true,
  onEdit,
  onDelete,
  onFavorite,
  className,
}: VoiceCardProps) {
  const player = useAudioPlayer();
  const [menuOpen, setMenuOpen] = useState(false);
  const sampleUrl = api.voiceSampleUrl(voice.id);
  const isPlaying = player.isPlaying && player.url === sampleUrl;

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      player.stop();
    } else {
      player.play(sampleUrl);
    }
  };

  const progress = player.duration > 0 ? player.currentTime / player.duration : 0;

  return (
    <div
      className={cn(
        'group relative rounded-xl border p-4 transition-all duration-300 cursor-pointer',
        selected
          ? 'border-neon-500/60 bg-neon-500/5 shadow-neon-sm'
          : 'border-white/5 bg-ink-850/60 hover:border-neon-500/30 hover:bg-ink-850',
        className,
      )}
      onClick={() => selectable && onSelect?.(voice)}
    >
      {/* 顶部信息 */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Mic2 className="w-3.5 h-3.5 text-neon-400/70 flex-shrink-0" />
            <h4 className="text-display text-sm text-white truncate">{voice.name}</h4>
            {voice.isFavorite && (
              <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={cn(
                'text-[10px] font-mono px-1.5 py-0.5 rounded border',
                voice.source === 'preset'
                  ? 'text-neon-300 bg-neon-500/10 border-neon-500/20'
                  : 'text-magenta-300 bg-magenta-400/10 border-magenta-400/20',
              )}
            >
              {SOURCE_LABEL[voice.source]}
            </span>
            {voice.gender && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 text-white/50 bg-white/5">
                {GENDER_LABEL[voice.gender]}
              </span>
            )}
            <span className="text-[10px] font-mono text-white/40">
              {formatDuration(voice.duration)}
            </span>
          </div>
        </div>

        {/* 操作菜单 */}
        {showActions && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="text-white/30 hover:text-white transition-colors p-1 rounded"
              aria-label="更多操作"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                  }}
                />
                <div className="absolute right-0 top-7 z-20 w-36 rounded-lg bg-ink-900 border border-white/10 shadow-panel py-1 backdrop-blur-xl">
                  {onFavorite && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onFavorite(voice);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5 hover:text-white"
                    >
                      <Star className="w-3.5 h-3.5" />
                      {voice.isFavorite ? '取消收藏' : '收藏'}
                    </button>
                  )}
                  {onEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onEdit(voice);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5 hover:text-white"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      编辑信息
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onDelete(voice);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-magenta-300 hover:bg-magenta-400/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      删除
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 描述 */}
      {voice.description && (
        <p className="text-xs text-white/50 mb-3 line-clamp-2 leading-relaxed">
          {voice.description}
        </p>
      )}

      {/* 迷你波形 */}
      <div className="mb-3 relative rounded-md bg-ink-900/60 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="relative h-12">
          <MiniWave data={[]} animated={isPlaying} />
        </div>
        <div
          className="absolute top-0 bottom-0 left-0 w-0.5 bg-neon-400 shadow-neon-sm transition-all"
          style={{ left: `${progress * 100}%` }}
        />
      </div>

      {/* 特征指标 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Feature label="基频" value={`${voice.features.pitch}Hz`} />
        <Feature
          label="亮度"
          value={`${Math.round(voice.features.brightness * 100)}%`}
        />
        <Feature
          label="气息"
          value={`${Math.round(voice.features.breathiness * 100)}%`}
        />
      </div>

      {/* 标签 */}
      {voice.tags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mb-3">
          {voice.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePlay}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all',
            isPlaying
              ? 'bg-magenta-400/15 text-magenta-200 border border-magenta-400/30'
              : 'bg-neon-500/10 text-neon-300 border border-neon-500/20 hover:bg-neon-500/20',
          )}
        >
          {isPlaying ? (
            <>
              <Square className="w-3.5 h-3.5" />
              停止
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              试听
            </>
          )}
        </button>
        {selectable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(voice);
            }}
            className={cn(
              'flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all',
              selected
                ? 'bg-neon-500 text-ink-950 border-neon-500'
                : 'border-white/10 text-white/70 hover:border-neon-500/40 hover:text-white',
            )}
          >
            {selected ? (
              <>
                <Check className="w-3.5 h-3.5" />
                已选
              </>
            ) : (
              '选择'
            )}
          </button>
        )}
      </div>

      <div className="mt-2 text-[10px] font-mono text-white/30 text-right">
        {formatDateTime(voice.createdAt)}
      </div>
    </div>
  );
}

function Feature({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-ink-900/60 border border-white/5 px-2 py-1.5">
      <div className="text-[9px] text-white/40 uppercase tracking-wider">{label}</div>
      <div className="text-xs font-mono text-white/80 mt-0.5">{value}</div>
    </div>
  );
}

/** 迷你波形 — 简化版,仅动画展示 */
function MiniWave({ animated = false }: { data?: number[]; animated?: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-0.5 px-2">
      {Array.from({ length: 28 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-0.5 rounded-full bg-neon-400/60',
            animated && 'spec-bar',
          )}
          style={{
            height: animated
              ? `${20 + Math.sin(i * 0.7) * 30 + Math.random() * 40}%`
              : `${20 + Math.sin(i * 0.5) * 15 + 10}%`,
            animationDelay: `${i * 0.04}s`,
            animationDuration: `${0.8 + (i % 4) * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}
