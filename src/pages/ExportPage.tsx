/**
 * 导出中心 — 展示最近输出,选择格式下载
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileAudio, FileMusic, Clock, HardDrive, Check, RefreshCw, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { AudioPlayer } from '@/components/AudioPlayer';
import { useAudioStore } from '@/store/useAudioStore';
import { toast } from '@/store/useToastStore';
import { formatDuration } from '@/lib/format';
import type { AudioFormat } from '@shared/types';
import { cn } from '@/lib/utils';

const FORMAT_OPTIONS: {
  value: AudioFormat;
  label: string;
  desc: string;
  icon: typeof FileAudio;
}[] = [
  { value: 'wav', label: 'WAV', desc: '无损 · 体积大 · 适合后期', icon: FileAudio },
  { value: 'mp3', label: 'MP3', desc: '有损 · 体积小 · 通用性强', icon: FileMusic },
];

const SAMPLE_RATES = [
  { value: 22050, label: '22050 Hz · 电话级' },
  { value: 44100, label: '44100 Hz · CD 级' },
  { value: 48000, label: '48000 Hz · 录音棚级' },
];

const BIT_DEPTHS = [
  { value: 16, label: '16-bit · 标准' },
  { value: 24, label: '24-bit · 高保真' },
];

export function ExportPage() {
  const navigate = useNavigate();
  const job = useAudioStore((s) => s.job);
  const exportOpts = useAudioStore((s) => s.export);
  const setExport = useAudioStore((s) => s.setExport);
  const setFormat = useAudioStore((s) => s.setFormat);
  const params = useAudioStore((s) => s.params);

  const [downloading, setDownloading] = useState(false);

  const hasOutput = job.status === 'completed' && job.outputUrl;

  const handleDownload = async () => {
    if (!job.outputUrl) return;
    setDownloading(true);
    try {
      const link = document.createElement('a');
      link.href = job.outputUrl;
      const ext = exportOpts.format === 'mp3' ? 'mp3' : 'wav';
      const prefix = job.kind === 'tts' ? 'tts' : 'converted';
      link.download = `${prefix}_${Date.now()}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('已开始下载');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '下载失败');
    } finally {
      setTimeout(() => setDownloading(false), 800);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Download}
        title="导出中心"
        subtitle="在此选择音频格式、采样率与位深,完成最终下载。所有母带参数将一并应用到导出文件。"
        badge="Export"
        actions={
          <button onClick={() => navigate(-1)} className="btn-secondary">
            <ArrowLeft className="w-4 h-4" />
            <span>返回</span>
          </button>
        }
      />

      {!hasOutput ? (
        <div className="glass-panel rounded-2xl p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
            <FileAudio className="w-8 h-8 text-white/30" />
          </div>
          <h3 className="text-display text-lg text-white mb-2">暂无可导出的音频</h3>
          <p className="text-sm text-white/50 mb-6">
            请先在声音转换或 TTS 工作室生成音频,生成完成后可在此处下载。
          </p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => navigate('/convert')} className="btn-primary">
              前往声音转换
            </button>
            <button onClick={() => navigate('/tts')} className="btn-secondary">
              前往 TTS 工作室
            </button>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* 左:输出信息 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 输出预览 */}
            <section className="glass-panel rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileAudio className="w-4 h-4 text-neon-400" />
                  <h3 className="text-display text-sm text-white">输出预览</h3>
                </div>
                <span className="tag">已就绪</span>
              </div>

              <AudioPlayer
                url={job.outputUrl!}
                params
                filename={`${job.kind || 'output'}-output.wav`}
              />

              {/* 元信息 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <MetaItem
                  icon={Clock}
                  label="时长"
                  value={formatDuration(job.duration || 0)}
                />
                <MetaItem
                  icon={FileAudio}
                  label="类型"
                  value={job.kind === 'tts' ? 'TTS 合成' : '声音转换'}
                />
                <MetaItem
                  icon={HardDrive}
                  label="采样率"
                  value={`${exportOpts.sampleRate}`}
                />
                <MetaItem
                  icon={HardDrive}
                  label="位深"
                  value={`${exportOpts.bitDepth}-bit`}
                />
              </div>
            </section>

            {/* 格式选择 */}
            <section className="glass-panel rounded-2xl p-5">
              <h3 className="text-display text-sm text-white mb-4">导出格式</h3>
              <div className="grid sm:grid-cols-2 gap-3 mb-5">
                {FORMAT_OPTIONS.map((opt) => {
                  const active = exportOpts.format === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setFormat(opt.value)}
                      className={cn(
                        'flex items-center gap-3 p-4 rounded-lg border transition-all text-left',
                        active
                          ? 'border-neon-500/50 bg-neon-500/5 shadow-neon-sm'
                          : 'border-white/10 hover:border-white/20 hover:bg-white/5',
                      )}
                    >
                      <div className={cn(
                        'w-10 h-10 rounded-md flex items-center justify-center border',
                        active ? 'bg-neon-500/15 border-neon-500/40' : 'bg-white/5 border-white/10',
                      )}>
                        <opt.icon className={cn('w-5 h-5', active ? 'text-neon-400' : 'text-white/50')} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold text-white">{opt.label}</span>
                          {active && (
                            <Check className="w-3.5 h-3.5 text-neon-400" />
                          )}
                        </div>
                        <div className="text-xs text-white/50 mt-0.5">{opt.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 采样率 */}
              <div className="mb-4">
                <label className="block text-xs text-white/50 mb-2">采样率</label>
                <div className="grid sm:grid-cols-3 gap-2">
                  {SAMPLE_RATES.map((sr) => (
                    <button
                      key={sr.value}
                      onClick={() => setExport({ sampleRate: sr.value as 22050 | 44100 | 48000 })}
                      className={cn(
                        'px-3 py-2 rounded-md text-xs font-mono border transition-all text-left',
                        exportOpts.sampleRate === sr.value
                          ? 'border-neon-500/40 bg-neon-500/10 text-neon-300'
                          : 'border-white/10 text-white/60 hover:text-white hover:border-white/20',
                      )}
                    >
                      {sr.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 位深 */}
              <div>
                <label className="block text-xs text-white/50 mb-2">位深 {exportOpts.format === 'mp3' && '(MP3 仅支持 16-bit)'}</label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {BIT_DEPTHS.map((bd) => {
                    const disabled = exportOpts.format === 'mp3' && bd.value === 24;
                    return (
                      <button
                        key={bd.value}
                        onClick={() => !disabled && setExport({ bitDepth: bd.value as 16 | 24 })}
                        disabled={disabled}
                        className={cn(
                          'px-3 py-2 rounded-md text-xs font-mono border transition-all text-left',
                          disabled && 'opacity-30 cursor-not-allowed',
                          exportOpts.bitDepth === bd.value && !disabled
                            ? 'border-neon-500/40 bg-neon-500/10 text-neon-300'
                            : 'border-white/10 text-white/60 hover:text-white hover:border-white/20',
                        )}
                      >
                        {bd.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* 母带参数概览 */}
            <section className="glass-panel rounded-2xl p-5">
              <h3 className="text-display text-sm text-white mb-3">应用参数概览</h3>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {Object.entries(params).map(([k, v]) => (
                  <div key={k} className="rounded-md bg-ink-900/60 border border-white/5 px-2 py-1.5 text-center">
                    <div className="text-[9px] text-white/40 uppercase">{k}</div>
                    <div className="text-xs font-mono text-neon-300 mt-0.5">
                      {typeof v === 'number' ? (Math.abs(v) < 10 ? v.toFixed(2) : v.toString()) : v}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* 右:下载面板 */}
          <aside className="lg:sticky lg:top-24 h-fit">
            <div className="glass-panel rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-display text-sm text-white mb-1">最终下载</h3>
                <p className="text-xs text-white/40">所有设置已应用,点击下方按钮下载</p>
              </div>

              {/* 文件名预览 */}
              <div className="rounded-lg bg-ink-900/60 border border-white/5 p-3">
                <div className="text-[10px] text-white/40 uppercase mb-1">文件名</div>
                <div className="font-mono text-sm text-neon-300">
                  {(job.kind || 'output')}_{Date.now().toString().slice(-6)}.{exportOpts.format}
                </div>
              </div>

              {/* 文件信息 */}
              <div className="space-y-2 text-xs">
                <Row label="格式" value={exportOpts.format.toUpperCase()} />
                <Row label="采样率" value={`${exportOpts.sampleRate} Hz`} />
                <Row label="位深" value={`${exportOpts.bitDepth}-bit`} />
                <Row label="时长" value={formatDuration(job.duration || 0)} />
                <Row
                  label="估算大小"
                  value={estimateFileSize(
                    job.duration || 0,
                    exportOpts.sampleRate,
                    exportOpts.bitDepth,
                    exportOpts.format,
                  )}
                />
              </div>

              <button
                onClick={handleDownload}
                disabled={downloading}
                className="btn-primary w-full !py-3"
              >
                {downloading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    下载中…
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    下载音频
                  </>
                )}
              </button>

              <div className="pt-3 border-t border-white/5 text-[10px] text-white/30 leading-relaxed">
                <p>· WAV 为无损格式,适合后期处理</p>
                <p>· MP3 已压缩,适合网络分享</p>
                <p>· 实际文件以浏览器下载为准</p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-ink-900/60 border border-white/5 p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-white/40 uppercase mb-1">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="text-sm font-mono text-white/80">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/40">{label}</span>
      <span className="font-mono text-white/80">{value}</span>
    </div>
  );
}

function estimateFileSize(
  duration: number,
  sampleRate: number,
  bitDepth: number,
  format: AudioFormat,
): string {
  if (format === 'mp3') {
    const sizeMB = (duration * 128 * 1024) / 8 / (1024 * 1024);
    return `${sizeMB.toFixed(2)} MB`;
  }
  const bytesPerSample = bitDepth / 8;
  const sizeBytes = duration * sampleRate * bytesPerSample;
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}
