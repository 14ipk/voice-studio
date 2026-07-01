/**
 * 音频播放器组件 — 完整的播放控件
 */
import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, Repeat } from 'lucide-react';
import { audioEngine } from '@/lib/audioEngine';
import { useAudioStore } from '@/store/useAudioStore';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AudioWaveform } from './AudioWaveform';

interface AudioPlayerProps {
  url: string;
  params?: boolean; // 是否应用母带参数
  filename?: string;
  className?: string;
  compact?: boolean;
}

export function AudioPlayer({ url, params: useParams, filename, className, compact = false }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const handleRef = useRef<{ stop: () => void; duration: number } | null>(null);

  const audioParams = useAudioStore((s) => s.params);

  const play = async () => {
    if (isPlaying) {
      stop();
      return;
    }
    setIsLoading(true);
    try {
      const handle = await audioEngine.play({
        url,
        params: useParams ? audioParams : undefined,
        onReady: (d) => {
          setDuration(d);
          setIsLoading(false);
          setIsPlaying(true);
        },
        onProgress: (t) => setCurrentTime(t),
        onEnd: () => {
          setIsPlaying(false);
          setCurrentTime(0);
        },
      });
      handleRef.current = handle;
    } catch (err) {
      console.error('[AudioPlayer] play failed:', err);
      setIsLoading(false);
    }
  };

  const stop = () => {
    if (handleRef.current) {
      handleRef.current.stop();
      handleRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  };

  useEffect(() => {
    return () => {
      if (handleRef.current) handleRef.current.stop();
    };
  }, []);

  useEffect(() => {
    if (isPlaying) {
      // 参数变化时重新播放(简化版:停止后重启)
    }
  }, [audioParams, isPlaying]);

  const progress = duration > 0 ? currentTime / duration : 0;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'output.wav';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={cn('glass-panel rounded-2xl p-4', className)}>
      <div className="flex items-center gap-4">
        {/* 播放按钮 */}
        <button
          onClick={play}
          disabled={isLoading}
          className={cn(
            'flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all',
            isPlaying
              ? 'bg-magenta-400/15 text-magenta-300 border border-magenta-400/40 shadow-magenta-sm'
              : 'bg-neon-500 text-ink-950 shadow-neon hover:scale-105',
            isLoading && 'opacity-50',
          )}
          aria-label={isPlaying ? '暂停' : '播放'}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </button>

        {/* 波形与时间 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-white/60 truncate font-mono">
              {filename || 'audio-output.wav'}
            </span>
            <span className="text-xs font-mono text-white/40 flex-shrink-0 ml-2">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
          </div>
          <AudioWaveform
            url={url}
            height={compact ? 36 : 48}
            progress={progress}
            variant="mixed"
            silent
          />
        </div>

        {/* 音量 */}
        {!compact && (
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setMuted((m) => !m)}
              className="text-white/50 hover:text-white transition-colors"
              aria-label={muted ? '取消静音' : '静音'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                setMuted(false);
              }}
              className="w-20"
            />
          </div>
        )}

        {/* 下载 */}
        <button
          onClick={handleDownload}
          className="flex-shrink-0 btn-secondary !px-3 !py-2"
          title="下载音频"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* 重播 */}
      {duration > 0 && !isPlaying && currentTime > 0 && (
        <button
          onClick={play}
          className="mt-3 flex items-center gap-1.5 text-xs text-neon-300 hover:text-neon-200 transition-colors"
        >
          <Repeat className="w-3.5 h-3.5" />
          重新播放
        </button>
      )}
    </div>
  );
}
