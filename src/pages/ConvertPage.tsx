/**
 * 声音转换页 — 上传录音 + 选音色 → 替换音色
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wand2, ArrowRight, Layers, Mic, Info } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { AudioUploader } from '@/components/AudioUploader';
import { VoicePicker } from '@/components/VoicePicker';
import { AudioWaveform } from '@/components/AudioWaveform';
import { KnobPanel } from '@/components/KnobPanel';
import { AudioPlayer } from '@/components/AudioPlayer';
import { ProcessingOverlay } from '@/components/ProcessingOverlay';
import { useAudioStore } from '@/store/useAudioStore';
import { api } from '@/lib/api';
import { toast } from '@/store/useToastStore';
import { getFilenameFromPath } from '@/lib/format';
import { cn } from '@/lib/utils';

export function ConvertPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [targetVoiceId, setTargetVoiceId] = useState<string>('');
  const [applyParams, setApplyParams] = useState(true);

  const job = useAudioStore((s) => s.job);
  const setJob = useAudioStore((s) => s.setJob);
  const params = useAudioStore((s) => s.params);

  const handleConvert = async () => {
    if (!file) {
      toast.warning('请先上传录音文件');
      return;
    }
    if (!targetVoiceId) {
      toast.warning('请选择目标音色');
      return;
    }

    setJob({
      kind: 'convert',
      status: 'processing',
      progress: 5,
      label: '初始化转换任务…',
    });

    // 模拟进度更新
    const stages = [
      { pct: 15, label: '解码源音频…' },
      { pct: 30, label: '提取音色特征…' },
      { pct: 45, label: '加载目标音色模型…' },
      { pct: 60, label: '应用音色迁移…' },
      { pct: 75, label: '应用母带参数…' },
      { pct: 90, label: '编码输出…' },
    ];
    let i = 0;
    const timer = setInterval(() => {
      if (i < stages.length) {
        setJob({ progress: stages[i].pct, label: stages[i].label });
        i++;
      }
    }, 400);

    try {
      const result = await api.convertVoice({
        file,
        payload: {
          targetVoiceId,
          options: applyParams ? params : undefined,
        },
      });
      clearInterval(timer);
      setJob({
        status: 'completed',
        progress: 100,
        label: '转换完成',
        outputPath: result.outputPath,
        outputUrl: `/outputs/convert/${getFilenameFromPath(result.outputPath)}`,
        duration: result.duration,
      });
      toast.success(`转换完成,时长 ${result.duration.toFixed(1)} 秒`);
    } catch (err) {
      clearInterval(timer);
      setJob({
        status: 'error',
        progress: 0,
        label: '',
        error: err instanceof Error ? err.message : '转换失败',
      });
      toast.error(err instanceof Error ? err.message : '转换失败');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wand2}
        title="声音转换"
        subtitle="上传你的录音,选择目标音色,系统将保持原音调与语速,仅替换音色 — 听起来就像另一个人用同样的语气说话。"
        badge="Voice Conversion"
        actions={
          <button
            onClick={() => navigate('/library')}
            className="btn-secondary"
          >
            <Layers className="w-4 h-4" />
            <span>音色库</span>
          </button>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 左:上传 */}
        <div className="lg:col-span-2 space-y-6">
          <section className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Mic className="w-4 h-4 text-neon-400" />
              <h3 className="text-display text-sm text-white">1 · 上传你的录音</h3>
            </div>
            <AudioUploader
              file={file}
              onFile={setFile}
              onClear={() => setFile(null)}
              title="拖拽录音文件到此处"
              hint="支持 WAV / MP3 / M4A / OGG,建议 5-30 秒清晰人声"
            />
            {file && (
              <div className="mt-3 p-3 rounded-lg bg-ink-900/60 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/60 font-mono">原始波形</span>
                  <span className="text-[10px] text-white/30">SOURCE</span>
                </div>
                <AudioWaveform
                  url={URL.createObjectURL(file)}
                  height={48}
                  variant="mono"
                  silent
                />
              </div>
            )}
          </section>

          {/* 目标音色 */}
          <section className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-neon-400" />
              <h3 className="text-display text-sm text-white">2 · 选择目标音色</h3>
            </div>
            <VoicePicker
              value={targetVoiceId}
              onChange={setTargetVoiceId}
              label="目标音色(将被应用的音色)"
            />
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-neon-500/5 border border-neon-500/20">
              <Info className="w-4 h-4 text-neon-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-white/70 leading-relaxed">
                转换将保留你原录音的<strong className="text-neon-300">音调</strong>与<strong className="text-neon-300">语速</strong>,仅替换<strong className="text-neon-300">音色</strong>特征。可在下方母带面板进一步微调参数。
              </p>
            </div>
          </section>

          {/* 母带调节 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-display text-sm text-white">3 · 母带微调(可选)</h3>
              <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyParams}
                  onChange={(e) => setApplyParams(e.target.checked)}
                  className="accent-neon-500"
                />
                <span>应用参数到本次转换</span>
              </label>
            </div>
            <KnobPanel className={cn(!applyParams && 'opacity-50 pointer-events-none')} />
          </section>
        </div>

        {/* 右:操作面板 */}
        <aside className="lg:sticky lg:top-24 h-fit space-y-4">
          <div className="glass-panel rounded-2xl p-5">
            <h3 className="text-display text-sm text-white mb-4">操作面板</h3>

            {/* 步骤指示 */}
            <div className="space-y-3 mb-5">
              <StepRow num={1} label="上传录音" done={!!file} />
              <StepRow num={2} label="选择目标音色" done={!!targetVoiceId} />
              <StepRow num={3} label="调节参数(可选)" done={applyParams} optional />
              <StepRow num={4} label="开始转换" />
            </div>

            <button
              onClick={handleConvert}
              disabled={!file || !targetVoiceId || job.status === 'processing'}
              className="btn-primary w-full"
            >
              <Wand2 className="w-4 h-4" />
              <span>{job.status === 'processing' ? '转换中…' : '开始转换'}</span>
            </button>

            {job.status === 'completed' && job.outputUrl && (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg bg-neon-500/5 border border-neon-500/30 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-neon-400 shadow-neon-sm animate-pulse" />
                    <span className="text-xs text-neon-300 font-mono">转换完成</span>
                  </div>
                  <p className="text-[11px] text-white/50">
                    时长 {(job.duration || 0).toFixed(1)} 秒 · 可下方试听或进入导出页
                  </p>
                </div>

                <AudioPlayer
                  url={job.outputUrl}
                  params={applyParams}
                  filename="converted.wav"
                  compact
                />

                <button
                  onClick={() => navigate('/export')}
                  className="btn-secondary w-full"
                >
                  <span>前往导出中心</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {job.status === 'error' && (
              <div className="mt-4 rounded-lg bg-magenta-400/5 border border-magenta-400/30 p-3">
                <p className="text-xs text-magenta-300">{job.error}</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <ProcessingOverlay variant="neon" />
    </div>
  );
}

function StepRow({ num, label, done, optional }: { num: number; label: string; done?: boolean; optional?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono border transition-all',
          done
            ? 'border-neon-500 bg-neon-500/20 text-neon-300'
            : 'border-white/15 text-white/40',
        )}
      >
        {done ? '✓' : num}
      </div>
      <span className={cn('text-sm', done ? 'text-white' : 'text-white/50')}>
        {label}
        {optional && <span className="text-white/30 text-xs ml-1">(可选)</span>}
      </span>
    </div>
  );
}
