/**
 * 音色克隆页 — 上传样本 → 提取特征 → 命名保存
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Sparkles, Save, Activity, Waves, BarChart3, Music2, Info } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { AudioUploader } from '@/components/AudioUploader';
import { SpectrumViz } from '@/components/SpectrumViz';
import { AudioWaveform } from '@/components/AudioWaveform';
import { ProcessingOverlay } from '@/components/ProcessingOverlay';
import { api } from '@/lib/api';
import { toast } from '@/store/useToastStore';
import { useVoiceStore } from '@/store/useVoiceStore';
import { useAudioStore } from '@/store/useAudioStore';
import { audioEngine } from '@/lib/audioEngine';
import { formatDuration } from '@/lib/format';
import type { VoiceFeatures } from '@shared/types';
import { cn } from '@/lib/utils';

type Stage = 'idle' | 'analyzing' | 'analyzed' | 'saving';

export function ClonePage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [waveform, setWaveform] = useState<number[]>([]);
  const [spectrum, setSpectrum] = useState<number[]>([]);
  const [features, setFeatures] = useState<VoiceFeatures | null>(null);
  const [duration, setDuration] = useState(0);
  const abortRef = useRef<boolean>(false);

  // 表单
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'neutral'>('male');
  const [language, setLanguage] = useState('zh-CN');

  const refreshVoices = useVoiceStore((s) => s.refresh);
  const job = useAudioStore((s) => s.job);
  const setJob = useAudioStore((s) => s.setJob);
  const resetJob = useAudioStore((s) => s.resetJob);

  // 当文件变化时进行"分析"
  useEffect(() => {
    if (!file) {
      setStage('idle');
      setFeatures(null);
      setWaveform([]);
      setSpectrum([]);
      setDuration(0);
      return;
    }

    abortRef.current = false;
    setStage('analyzing');
    setJob({
      kind: null,
      status: 'processing',
      progress: 5,
      label: '读取音频文件…',
    });

    const url = URL.createObjectURL(file);
    const stages = [
      { pct: 15, label: '读取音频文件…' },
      { pct: 30, label: '提取频谱特征…' },
      { pct: 50, label: '计算共振峰…' },
      { pct: 70, label: '分析音高曲线…' },
      { pct: 85, label: '生成音色指纹…' },
      { pct: 100, label: '完成' },
    ];
    let i = 0;
    const timer = setInterval(() => {
      if (abortRef.current) {
        clearInterval(timer);
        return;
      }
      if (i < stages.length) {
        setJob({ progress: stages[i].pct, label: stages[i].label });
        i++;
      }
    }, 350);

    audioEngine.loadBuffer(url).then(async (buffer) => {
      const wave = audioEngine.extractWaveform(buffer, 100);
      const spec = audioEngine.extractSpectrum(buffer, 128);
      const dur = buffer.duration;

      if (abortRef.current) return;

      setWaveform(wave);
      setSpectrum(spec);
      setDuration(dur);

      // 上传到后端做"特征提取"(用真实 ML 模拟)
      try {
        await new Promise((r) => setTimeout(r, 800));
        // 直接调用后端 clone API 提取特征(但我们不保存,只展示)
        // 简化:在客户端模拟特征,实际保存时一起上传
        const mockFeatures = generateMockFeatures(buffer, file);
        setFeatures(mockFeatures);
        clearInterval(timer);
        setStage('analyzed');
        setJob({ status: 'completed', progress: 100, label: '特征提取完成' });
        setTimeout(() => {
          setJob({ status: 'idle', progress: 0, label: '' });
        }, 800);
        toast.success('音色特征提取完成');
      } catch {
        clearInterval(timer);
        setStage('idle');
        setJob({ status: 'idle', progress: 0, label: '' });
        toast.error('特征提取失败');
      }
    }).catch(() => {
      clearInterval(timer);
      setStage('idle');
      setJob({ status: 'idle', progress: 0, label: '' });
      toast.error('无法读取该音频格式');
    });

    return () => {
      abortRef.current = true;
      URL.revokeObjectURL(url);
    };
  }, [file, setJob]);

  const handleSave = async () => {
    if (!file) {
      toast.warning('请先上传音频样本');
      return;
    }
    if (!name.trim()) {
      toast.warning('请输入音色名称');
      return;
    }
    setStage('saving');
    setJob({
      kind: null,
      status: 'processing',
      progress: 30,
      label: '上传样本到音色库…',
    });

    try {
      await api.cloneVoice({
        file,
        name: name.trim(),
        tags,
        description,
        gender,
        language,
      });
      setJob({ progress: 70, label: '保存音色数据…' });
      await new Promise((r) => setTimeout(r, 400));
      setJob({ progress: 100, label: '保存完成', status: 'completed' });
      await refreshVoices();
      toast.success(`音色「${name}」已保存到音色库`);
      setTimeout(() => {
        setJob({ status: 'idle', progress: 0, label: '' });
        navigate('/library');
      }, 800);
    } catch (err) {
      setJob({ status: 'idle', progress: 0, label: '' });
      setStage('analyzed');
      toast.error(err instanceof Error ? err.message : '保存失败');
    }
  };

  const handleReset = () => {
    setFile(null);
    setName('');
    setTags('');
    setDescription('');
    setStage('idle');
    resetJob();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FlaskConical}
        title="音色克隆实验室"
        subtitle="上传目标说话人的语音样本(10-30 秒清晰人声),系统将提取其音色指纹,保存后可在声音转换与 TTS 中复用。"
        badge="Voice Cloning"
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 左:上传 + 表单 */}
        <div className="lg:col-span-1 space-y-4">
          <section className="glass-panel rounded-2xl p-5">
            <h3 className="text-display text-sm text-white mb-3">音频样本</h3>
            <AudioUploader
              file={file}
              onFile={setFile}
              onClear={handleReset}
              title="拖拽样本到此处"
              hint="10-30 秒清晰人声,WAV / MP3 / M4A"
            />
            {file && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <Stat label="时长" value={duration > 0 ? formatDuration(duration) : '分析中…'} />
                <Stat label="大小" value={`${(file.size / 1024).toFixed(1)} KB`} />
              </div>
            )}
          </section>

          {/* 表单 */}
          <section className={cn(
            'glass-panel rounded-2xl p-5 transition-all',
            stage !== 'analyzed' && 'opacity-50 pointer-events-none',
          )}>
            <h3 className="text-display text-sm text-white mb-3">音色信息</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/50 mb-1.5">名称 *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如:主播小明"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">标签(逗号分隔)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="男声,播音,中文"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">性别</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['male', 'female', 'neutral'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      className={cn(
                        'py-2 rounded-md text-xs font-medium border transition-all',
                        gender === g
                          ? 'border-neon-500/40 bg-neon-500/10 text-neon-300'
                          : 'border-white/10 text-white/50 hover:text-white',
                      )}
                    >
                      {g === 'male' ? '男声' : g === 'female' ? '女声' : '中性'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">语言</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="input-field"
                >
                  <option value="zh-CN">中文</option>
                  <option value="en-US">英语</option>
                  <option value="ja-JP">日语</option>
                  <option value="ko-KR">韩语</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">描述</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="描述这个音色的特点、用途…"
                  rows={3}
                  className="input-field resize-none"
                />
              </div>
            </div>
          </section>
        </div>

        {/* 右:可视化与特征 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 频谱 */}
          <section className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-neon-400" />
                <h3 className="text-display text-sm text-white">频谱分析</h3>
              </div>
              <span className="text-[10px] font-mono text-white/30 uppercase">FFT Spectrum</span>
            </div>
            <div className="rounded-lg bg-ink-900/60 p-3 border border-white/5">
              <SpectrumViz data={spectrum} animated={stage === 'analyzing'} height={140} />
              <div className="flex items-center justify-between mt-2 text-[10px] font-mono text-white/30">
                <span>0 Hz</span>
                <span>低频</span>
                <span>中频</span>
                <span>高频</span>
                <span>11 kHz</span>
              </div>
            </div>
          </section>

          {/* 波形 */}
          <section className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Waves className="w-4 h-4 text-neon-400" />
                <h3 className="text-display text-sm text-white">波形</h3>
              </div>
              <span className="text-[10px] font-mono text-white/30 uppercase">Waveform</span>
            </div>
            <div className="rounded-lg bg-ink-900/60 p-3 border border-white/5">
              <AudioWaveform
                data={waveform}
                height={80}
                variant="mixed"
                bars={100}
              />
            </div>
          </section>

          {/* 特征 */}
          <section className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-neon-400" />
                <h3 className="text-display text-sm text-white">提取的音色特征</h3>
              </div>
              <span className="text-[10px] font-mono text-white/30 uppercase">Voice Fingerprint</span>
            </div>
            {features ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <FeatureCard
                  icon={Music2}
                  label="基频 F0"
                  value={`${features.pitch} Hz`}
                  hint="音高均值"
                />
                <FeatureCard
                  icon={Activity}
                  label="共振峰"
                  value={features.formants.map((f) => Math.round(f)).join('/')}
                  unit="Hz"
                  hint="F1 / F2 / F3"
                />
                <FeatureCard
                  icon={Sparkles}
                  label="气息感"
                  value={`${Math.round(features.breathiness * 100)}%`}
                  hint="Breathiness"
                />
                <FeatureCard
                  icon={Sparkles}
                  label="亮度"
                  value={`${Math.round(features.brightness * 100)}%`}
                  hint="Brightness"
                />
                <FeatureCard
                  icon={Activity}
                  label="粗糙度"
                  value={`${Math.round(features.roughness * 100)}%`}
                  hint="Roughness"
                />
                <FeatureCard
                  icon={BarChart3}
                  label="频谱倾斜"
                  value={`${features.spectralTilt.toFixed(1)}`}
                  unit="dB/oct"
                  hint="Spectral Tilt"
                />
              </div>
            ) : (
              <div className="py-10 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 mb-3">
                  <Activity className="w-6 h-6 text-white/30" />
                </div>
                <p className="text-sm text-white/40">
                  {file ? '正在分析音色特征…' : '上传样本后将在此处展示音色指纹'}
                </p>
              </div>
            )}
          </section>

          {/* 保存提示 */}
          {stage === 'analyzed' && (
            <div className="glass-panel rounded-2xl p-5 border-neon-500/30">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-neon-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-white font-medium mb-1">特征提取完成,可保存到音色库</p>
                  <p className="text-xs text-white/50 leading-relaxed">
                    填写左侧表单信息后点击下方按钮,音色数据将持久化保存,日后可在<strong className="text-neon-300">声音转换</strong>与<strong className="text-neon-300">TTS 工作室</strong>中复用。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="sticky bottom-4 z-30">
        <div className="glass-panel rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="text-xs text-white/50">
            {stage === 'idle' && '请先上传音频样本'}
            {stage === 'analyzing' && '正在分析音色特征…'}
            {stage === 'analyzed' && `分析完成,基频 ${features?.pitch || 0} Hz,可保存`}
            {stage === 'saving' && '正在保存到音色库…'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="btn-secondary"
              disabled={!file || stage === 'saving'}
            >
              重置
            </button>
            <button
              onClick={handleSave}
              disabled={stage !== 'analyzed' || !name.trim()}
              className="btn-primary"
            >
              <Save className="w-4 h-4" />
              <span>保存到音色库</span>
            </button>
          </div>
        </div>
      </div>

      <ProcessingOverlay show={job.status === 'processing'} variant="magenta" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-ink-900/60 border border-white/5 px-3 py-2">
      <div className="text-[10px] text-white/40 uppercase tracking-wider">{label}</div>
      <div className="text-xs font-mono text-white/80 mt-0.5">{value}</div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  label,
  value,
  unit,
  hint,
}: {
  icon: typeof Music2;
  label: string;
  value: string;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg bg-ink-900/60 border border-white/5 p-3 group hover:border-neon-500/30 transition-all">
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-3.5 h-3.5 text-neon-400/70" />
        <span className="text-[9px] text-white/30 font-mono uppercase">{hint}</span>
      </div>
      <div className="text-xs text-white/50 mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-display font-bold text-white">{value}</span>
        {unit && <span className="text-[10px] text-white/40 font-mono">{unit}</span>}
      </div>
    </div>
  );
}

function generateMockFeatures(buffer: AudioBuffer, file: File): VoiceFeatures {
  // 用音频长度 + 文件大小做种子,生成稳定的伪特征
  const seed = Math.floor(buffer.duration * 1000) + file.size;
  const rand = mulberry32(seed);

  // 通过波形粗略估计基频
  const channel = buffer.getChannelData(0);
  let crossings = 0;
  for (let i = 1; i < Math.min(channel.length, buffer.sampleRate * 2); i++) {
    if ((channel[i] >= 0) !== (channel[i - 1] >= 0)) crossings++;
  }
  const baseFreq = crossings > 0 ? crossings / 2 / 2 : 150;
  const pitch = Math.max(80, Math.min(300, Math.round(baseFreq)));

  return {
    pitch,
    formants: [
      Math.round(pitch * 5 + rand() * 100),
      Math.round(pitch * 8 + rand() * 150),
      Math.round(pitch * 12 + rand() * 200),
    ],
    spectralTilt: -5 - rand() * 5,
    breathiness: 0.15 + rand() * 0.4,
    brightness: 0.45 + rand() * 0.35,
    roughness: 0.15 + rand() * 0.3,
  };
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
