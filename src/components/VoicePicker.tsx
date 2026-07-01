/**
 * 音色选择器 — 用于转换页/TTS 页选择目标音色
 */
import { useEffect, useMemo, useState } from 'react';
import { Search, X, ChevronDown, ChevronUp, Mic2 } from 'lucide-react';
import { useVoiceStore } from '@/store/useVoiceStore';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { VoiceProfile } from '@shared/types';

interface VoicePickerProps {
  value?: string | null;
  onChange: (id: string) => void;
  label?: string;
  className?: string;
  /** 是否允许试听(选择时不需要进入音色库) */
  allowPreview?: boolean;
}

export function VoicePicker({
  value,
  onChange,
  label = '选择目标音色',
  className,
  allowPreview = true,
}: VoicePickerProps) {
  const voices = useVoiceStore((s) => s.voices);
  const fetchVoices = useVoiceStore((s) => s.fetchVoices);
  const loaded = useVoiceStore((s) => s.loaded);
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    if (!loaded) fetchVoices();
  }, [loaded, fetchVoices]);

  const filtered = useMemo(() => {
    if (!keyword.trim()) return voices;
    const kw = keyword.toLowerCase();
    return voices.filter(
      (v) =>
        v.name.toLowerCase().includes(kw) ||
        v.tags.some((t) => t.toLowerCase().includes(kw)),
    );
  }, [voices, keyword]);

  const selected = voices.find((v) => v.id === value);

  return (
    <div className={cn('', className)}>
      <label className="block text-xs text-white/50 mb-2 font-medium">{label}</label>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg border bg-ink-850/60 transition-all',
            open
              ? 'border-neon-500/50 shadow-neon-sm'
              : 'border-white/10 hover:border-white/20',
          )}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {selected ? (
              <>
                <div className="w-8 h-8 rounded-md bg-neon-500/10 border border-neon-500/30 flex items-center justify-center flex-shrink-0">
                  <Mic2 className="w-4 h-4 text-neon-400" />
                </div>
                <div className="text-left min-w-0">
                  <div className="text-sm text-white truncate">{selected.name}</div>
                  <div className="text-[10px] text-white/40 font-mono">
                    {selected.tags.slice(0, 3).join(' · ')}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-md bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <Mic2 className="w-4 h-4 text-white/30" />
                </div>
                <span className="text-sm text-white/40">尚未选择音色</span>
              </>
            )}
          </div>
          {open ? (
            <ChevronUp className="w-4 h-4 text-white/40" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/40" />
          )}
        </button>

        {open && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
            />
            <div className="absolute z-20 mt-2 w-full glass-panel rounded-lg p-2 max-h-80 overflow-hidden flex flex-col">
              {/* 搜索 */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜索音色名/标签…"
                  className="input-search"
                  autoFocus
                />
                {keyword && (
                  <button
                    onClick={() => setKeyword('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* 列表 */}
              <div className="flex-1 overflow-y-auto -mx-1 px-1">
                {filtered.length === 0 ? (
                  <div className="py-8 text-center text-sm text-white/40">
                    {voices.length === 0 ? '暂无音色,请先克隆' : '无匹配结果'}
                  </div>
                ) : (
                  filtered.map((voice) => (
                    <VoiceRow
                      key={voice.id}
                      voice={voice}
                      active={voice.id === value}
                      allowPreview={allowPreview}
                      onSelect={() => {
                        onChange(voice.id);
                        setOpen(false);
                      }}
                    />
                  ))
                )}
              </div>

              {voices.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/5 text-xs text-white/40 text-center font-mono">
                  共 {filtered.length} / {voices.length} 个音色
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function VoiceRow({
  voice,
  active,
  allowPreview,
  onSelect,
}: {
  voice: VoiceProfile;
  active: boolean;
  allowPreview: boolean;
  onSelect: () => void;
}) {
  const [playing, setPlaying] = useState(false);

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playing) {
      setPlaying(false);
      return;
    }
    const audio = new Audio(api.voiceSampleUrl(voice.id));
    audio.onended = () => setPlaying(false);
    audio.onerror = () => setPlaying(false);
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-all',
        active ? 'bg-neon-500/10' : 'hover:bg-white/5',
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          className={cn(
            'w-2 h-2 rounded-full flex-shrink-0',
            active ? 'bg-neon-400 shadow-neon-sm' : 'bg-white/20',
          )}
        />
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm truncate', active ? 'text-neon-200' : 'text-white')}>
            {voice.name}
          </div>
          <div className="text-[10px] text-white/40 font-mono truncate">
            {voice.tags.slice(0, 3).join(' · ')}
          </div>
        </div>
      </div>
      {allowPreview && (
        <button
          onClick={handlePreview}
          className={cn(
            'text-[10px] font-mono px-2 py-1 rounded border transition-all',
            playing
              ? 'border-magenta-400/40 text-magenta-300 bg-magenta-400/10'
              : 'border-white/10 text-white/50 hover:border-neon-500/40 hover:text-neon-300',
          )}
        >
          {playing ? '停止' : '试听'}
        </button>
      )}
    </button>
  );
}
