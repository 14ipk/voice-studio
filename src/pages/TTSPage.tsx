/**
 * TTS 工作室 — 输入文字 + 选音色 + 情感 → 合成
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Type, Sparkles, Eraser, ArrowRight, Gauge, Play } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { VoicePicker } from '@/components/VoicePicker';
import { KnobPanel } from '@/components/KnobPanel';
import { AudioPlayer } from '@/components/AudioPlayer';
import { ProcessingOverlay } from '@/components/ProcessingOverlay';
import { useAudioStore } from '@/store/useAudioStore';
import { api } from '@/lib/api';
import { toast } from '@/store/useToastStore';
import { estimateSpeechDuration, formatDuration, getFilenameFromPath } from '@/lib/format';
import type { Emotion } from '@shared/types';
import { cn } from '@/lib/utils';

const EMOTIONS: { value: Emotion; label: string; icon: string; desc: string }[] = [
  { value: 'neutral', label: '平静', icon: '😐', desc: '中性自然' },
  { value: 'happy', label: '愉悦', icon: '😊', desc: '轻快明朗' },
  { value: 'excited', label: '激动', icon: '🤩', desc: '高亢热烈' },
  { value: 'sad', label: '忧伤', icon: '😢', desc: '低沉悲伤' },
  { value: 'serious', label: '严肃', icon: '🧐', desc: '庄重正式' },
  { value: 'whisper', label: '耳语', icon: '🤫', desc: '气息轻语' },
];

const SAMPLE_TEXTS = [
  '欢迎使用 VoiceForge 声音克隆工作台,在这里你可以将文字转换为任意音色的自然语音。',
  '夜空中最亮的星,请照亮我前行,我祈祷拥有一颗透明的心灵,和会流泪的眼睛。',
  '在很久很久以前,你拥有我,我拥有你,在那座古老的城市里,你像我一样,在微风中歌唱。',
  '人工智能正在改变我们创造内容的方式,让每个人都能成为自己故事的讲述者。',
];

export function TTSPage() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [emotion, setEmotion] = useState<Emotion>('neutral');
  const [applyParams, setApplyParams] = useState(true);

  const job = useAudioStore((s) => s.job);
  const setJob = useAudioStore((s) => s.setJob);
  const params = useAudioStore((s) => s.params);

  const charCount = useMemo(() => [...text].filter((c) => c.trim().length > 0).length, [text]);
  const estDuration = useMemo(
    () => estimateSpeechDuration(text, params.speed),
    [text, params.speed],
  );

  const handleSynthesize = async () => {
    if (!text.trim()) {
      toast.warning('请输入要合成的文本');
      return;
    }
    if (!voiceId) {
      toast.warning('请选择音色');
      return;
    }

    setJob({
      kind: 'tts',
      status: 'processing',
      progress: 5,
      label: '初始化 TTS 任务…',
    });

    const stages = [
      { pct: 15, label: '分析文本语义…' },
      { pct: 30, label: '生成音素序列…' },
      { pct: 50, label: '加载目标音色…' },
      { pct: 70, label: '应用情感与韵律…' },
      { pct: 85, label: '应用母带参数…' },
      { pct: 95, label: '编码输出…' },
    ];
    let i = 0;
    const timer = setInterval(() => {
      if (i < stages.length) {
        setJob({ progress: stages[i].pct, label: stages[i].label });
        i++;
      }
    }, 350);

    try {
      const result = await api.synthesizeTTS({
        text: text.trim(),
        voiceId,
        emotion,
        options: applyParams ? params : undefined,
      });
      clearInterval(timer);
      setJob({
        status: 'completed',
        progress: 100,
        label: '合成完成',
        outputPath: result.outputPath,
        outputUrl: `/outputs/tts/${getFilenameFromPath(result.outputPath)}`,
        duration: result.duration,
      });
      toast.success(`合成完成,时长 ${result.duration.toFixed(1)} 秒`);
    } catch (err) {
      clearInterval(timer);
      setJob({
        status: 'error',
        progress: 0,
        label: '',
        error: err instanceof Error ? err.message : '合成失败',
      });
      toast.error(err instanceof Error ? err.message : '合成失败');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Type}
        title="TTS 工作室"
        subtitle="输入文字,选择已克隆或预设的音色,生成自然流畅的语音。可在下方母带面板调节音高、语速、情感等参数。"
        badge="Text to Speech"
        actions={
          <button onClick={() => navigate('/library')} className="btn-secondary">
            <Sparkles className="w-4 h-4" />
            <span>选择音色</span>
          </button>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 主区:文本与音色 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 文本输入 */}
          <section className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-neon-400" />
                <h3 className="text-display text-sm text-white">输入文本</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setText('')}
                  disabled={!text}
                  className="btn-ghost text-xs"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  清空
                </button>
              </div>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="在此输入要合成的文本,支持中英文混合…"
              rows={8}
              maxLength={2000}
              className="input-field resize-none !text-base !leading-relaxed"
            />

            <div className="mt-3 flex items-center justify-between text-xs text-white/40">
              <div className="flex items-center gap-3">
                <span>字符数 <span className="font-mono text-white/70">{charCount}</span></span>
                <span>·</span>
                <span>预计时长 <span className="font-mono text-neon-300">{formatDuration(estDuration)}</span></span>
              </div>
              <span className="font-mono">{charCount}/2000</span>
            </div>

            {/* 示例文本 */}
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="text-xs text-white/40 mb-2">示例文本(点击使用)</div>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_TEXTS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setText(s)}
                    className="text-xs px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-neon-500/40 hover:bg-neon-500/5 transition-all max-w-xs truncate"
                  >
                    {s.slice(0, 24)}…
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 音色与情感 */}
          <section className="glass-panel rounded-2xl p-5">
            <h3 className="text-display text-sm text-white mb-3">音色与情感</h3>
            <VoicePicker
              value={voiceId}
              onChange={setVoiceId}
              label="朗读音色"
            />

            <div className="mt-4">
              <label className="block text-xs text-white/50 mb-2">情感风格</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {EMOTIONS.map((emo) => (
                  <button
                    key={emo.value}
                    onClick={() => setEmotion(emo.value)}
                    className={cn(
                      'flex flex-col items-center gap-1 py-2.5 rounded-lg border transition-all',
                      emotion === emo.value
                        ? 'border-neon-500/50 bg-neon-500/10 shadow-neon-sm'
                        : 'border-white/10 hover:border-white/20 hover:bg-white/5',
                    )}
                    title={emo.desc}
                  >
                    <span className="text-xl">{emo.icon}</span>
                    <span className={cn(
                      'text-xs',
                      emotion === emo.value ? 'text-neon-300 font-medium' : 'text-white/60',
                    )}>
                      {emo.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 母带调节 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-neon-400" />
                <h3 className="text-display text-sm text-white">母带调节(可选)</h3>
              </div>
              <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyParams}
                  onChange={(e) => setApplyParams(e.target.checked)}
                  className="accent-neon-500"
                />
                <span>应用参数</span>
              </label>
            </div>
            <KnobPanel className={cn(!applyParams && 'opacity-50 pointer-events-none')} />
          </section>
        </div>

        {/* 右侧操作面板 */}
        <aside className="lg:sticky lg:top-24 h-fit space-y-4">
          <div className="glass-panel rounded-2xl p-5">
            <h3 className="text-display text-sm text-white mb-4">合成控制</h3>

            <div className="space-y-3 mb-5 text-xs">
              <InfoRow label="文本字符" value={`${charCount}`} />
              <InfoRow label="预计时长" value={formatDuration(estDuration)} accent />
              <InfoRow label="语速" value={`${params.speed.toFixed(2)}x`} />
              <InfoRow label="情感" value={EMOTIONS.find((e) => e.value === emotion)?.label || '平静'} />
            </div>

            <button
              onClick={handleSynthesize}
              disabled={!text.trim() || !voiceId || job.status === 'processing'}
              className="btn-primary w-full"
            >
              <Sparkles className="w-4 h-4" />
              <span>{job.status === 'processing' ? '合成中…' : '开始合成'}</span>
            </button>

            {job.status === 'completed' && job.outputUrl && (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg bg-neon-500/5 border border-neon-500/30 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-neon-400 shadow-neon-sm animate-pulse" />
                    <span className="text-xs text-neon-300 font-mono">合成完成</span>
                  </div>
                  <p className="text-[11px] text-white/50">
                    时长 {(job.duration || 0).toFixed(1)} 秒 · 可试听或下载
                  </p>
                </div>

                <AudioPlayer
                  url={job.outputUrl}
                  params={applyParams}
                  filename="tts-output.wav"
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

          {/* 提示 */}
          <div className="glass-panel rounded-2xl p-4">
            <h4 className="text-xs text-white/60 font-medium mb-2 flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5 text-neon-400" />
              使用提示
            </h4>
            <ul className="space-y-1.5 text-xs text-white/50 leading-relaxed">
              <li>· 文本越长合成越慢,建议分段提交</li>
              <li>· 调节语速可影响合成时长与节奏</li>
              <li>· 情感标签会调整音高与气息感</li>
              <li>· 合成结果可在导出中心选择格式下载</li>
            </ul>
          </div>
        </aside>
      </div>

      <ProcessingOverlay variant="neon" />
    </div>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/40">{label}</span>
      <span className={cn('font-mono', accent ? 'text-neon-300' : 'text-white/80')}>{value}</span>
    </div>
  );
}
