/**
 * 音频上传组件 — 拖拽 + 点击
 */
import { useRef, useState } from 'react';
import { Upload, FileAudio, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes, formatDuration as fmtDuration } from '@/lib/format';

interface AudioUploaderProps {
  onFile: (file: File) => void;
  file?: File | null;
  onClear?: () => void;
  accept?: string;
  title?: string;
  hint?: string;
  className?: string;
}

const ACCEPTED = '.wav,.mp3,.m4a,.aac,.ogg,.webm,.flac,audio/*';

export function AudioUploader({
  onFile,
  file,
  onClear,
  accept = ACCEPTED,
  title = '拖拽音频文件到此处',
  hint = '或点击选择文件,支持 WAV / MP3 / M4A / OGG / WebM',
  className,
}: AudioUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setLoading(true);
    // 估算时长
    const url = URL.createObjectURL(f);
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      setDuration(audio.duration || 0);
      setLoading(false);
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => {
      setLoading(false);
      URL.revokeObjectURL(url);
    };
    audio.src = url;
    onFile(f);
  };

  return (
    <div
      className={cn(
        'relative rounded-2xl border-2 border-dashed transition-all duration-300 group',
        dragOver
          ? 'border-neon-500 bg-neon-500/5 shadow-neon-sm'
          : file
            ? 'border-neon-500/40 bg-neon-500/5'
            : 'border-white/10 bg-ink-850/40 hover:border-white/20 hover:bg-ink-850/60',
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden-file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />

      {file ? (
        <div className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-neon-500/10 border border-neon-500/30 flex items-center justify-center flex-shrink-0">
            <FileAudio className="w-6 h-6 text-neon-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{file.name}</p>
            <p className="text-xs text-white/50 mt-1 flex items-center gap-3">
              <span>{formatBytes(file.size)}</span>
              {duration > 0 && <span>· {fmtDuration(duration)}</span>}
              <span className="text-white/30">· {file.type || '未知格式'}</span>
            </p>
          </div>
          {loading ? (
            <Loader2 className="w-4 h-4 text-neon-400 animate-spin" />
          ) : null}
          {onClear && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
                setDuration(0);
              }}
              className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="移除文件"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="p-10 flex flex-col items-center justify-center text-center gap-3">
          <div className="relative">
            <div
              className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center border-2 transition-all',
                dragOver
                  ? 'border-neon-500 bg-neon-500/10 scale-110'
                  : 'border-white/10 bg-white/5 group-hover:border-neon-500/40 group-hover:bg-neon-500/5',
              )}
            >
              <Upload className="w-7 h-7 text-neon-400" />
            </div>
            {/* 装饰波形 */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-end gap-0.5 h-3">
              {[0.3, 0.6, 0.9, 0.5, 0.7].map((h, i) => (
                <div
                  key={i}
                  className="w-0.5 bg-neon-400/60 spec-bar rounded-full"
                  style={{
                    height: `${h * 100}%`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-white">{title}</p>
            <p className="text-xs text-white/40 mt-1">{hint}</p>
          </div>
        </div>
      )}
    </div>
  );
}
