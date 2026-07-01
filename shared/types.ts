/**
 * VoiceForge 共享类型定义
 * 前后端通用
 */

export type VoiceSource = 'preset' | 'cloned';

export type Emotion = 'neutral' | 'happy' | 'sad' | 'excited' | 'serious' | 'whisper';

export type JobType = 'convert' | 'tts' | 'clone';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type AudioFormat = 'wav' | 'mp3';

export interface VoiceFeatures {
  /** 基频均值 (Hz) */
  pitch: number;
  /** 共振峰频率数组 [F1, F2, F3] */
  formants: number[];
  /** 频谱倾斜 (dB/oct) */
  spectralTilt: number;
  /** 气息感 0-1 */
  breathiness: number;
  /** 亮度 0-1 */
  brightness: number;
  /** 粗糙度 0-1 */
  roughness: number;
}

export interface VoiceProfile {
  id: string;
  name: string;
  tags: string[];
  description?: string;
  createdAt: string;
  /** 样本音频文件相对路径(uploads 下) */
  samplePath: string;
  /** 样本时长(秒) */
  duration: number;
  features: VoiceFeatures;
  isFavorite: boolean;
  source: VoiceSource;
  /** 性别标记,用于筛选 */
  gender?: 'male' | 'female' | 'neutral';
  /** 语言标记 */
  language?: string;
}

/** 母带调节参数,所有工作模式共用 */
export interface AudioParameters {
  /** 音高 -12 ~ +12 半音 */
  pitch: number;
  /** 语速 0.5 ~ 2.0 */
  speed: number;
  /** 共振峰偏移 -50 ~ +50 */
  formant: number;
  /** 气息感 0 ~ 100 */
  breathiness: number;
  /** 亮度 0 ~ 100 */
  brightness: number;
  /** 混响 0 ~ 100 */
  reverb: number;
  /** 压限 0 ~ 100 */
  compression: number;
  /** 音量 0 ~ 100 */
  volume: number;
}

export const DEFAULT_AUDIO_PARAMETERS: AudioParameters = {
  pitch: 0,
  speed: 1.0,
  formant: 0,
  breathiness: 30,
  brightness: 60,
  reverb: 20,
  compression: 50,
  volume: 80,
};

export interface JobRecord {
  id: string;
  type: JobType;
  voiceId?: string;
  status: JobStatus;
  /** 输出文件相对路径(outputs 下) */
  outputPath?: string;
  duration?: number;
  createdAt: string;
  /** 关联参数快照 */
  parameters?: AudioParameters;
  /** 关联文本(TTS) */
  text?: string;
  /** 错误信息 */
  error?: string;
}

export interface JobResult {
  jobId: string;
  status: JobStatus;
  outputPath?: string;
  duration?: number;
  estimatedDuration?: number;
}

/** 旋钮参数的元数据,用于 UI 渲染 */
export interface KnobMeta {
  key: keyof AudioParameters;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  /** 默认值 */
  def: number;
  /** 描述 */
  hint: string;
  /** 颜色: 'neon' | 'magenta' | 'amber' */
  color: 'neon' | 'magenta' | 'amber';
}

export const KNOB_META: KnobMeta[] = [
  { key: 'pitch', label: '音高', min: -12, max: 12, step: 0.5, unit: 'st', def: 0, hint: '半音偏移,负值更低沉', color: 'neon' },
  { key: 'speed', label: '语速', min: 0.5, max: 2, step: 0.05, unit: 'x', def: 1, hint: '播放速率,1 为原速', color: 'neon' },
  { key: 'formant', label: '共振峰', min: -50, max: 50, step: 1, unit: '', def: 0, hint: '调节声道共振,改变音色厚度', color: 'magenta' },
  { key: 'breathiness', label: '气息感', min: 0, max: 100, step: 1, unit: '%', def: 30, hint: '气息感强度', color: 'magenta' },
  { key: 'brightness', label: '亮度', min: 0, max: 100, step: 1, unit: '%', def: 60, hint: '高频能量,影响音色清晰度', color: 'amber' },
  { key: 'reverb', label: '混响', min: 0, max: 100, step: 1, unit: '%', def: 20, hint: '空间感与残响', color: 'neon' },
  { key: 'compression', label: '压限', min: 0, max: 100, step: 1, unit: '%', def: 50, hint: '动态范围压缩', color: 'amber' },
  { key: 'volume', label: '音量', min: 0, max: 100, step: 1, unit: '%', def: 80, hint: '总输出增益', color: 'neon' },
];

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface VoiceListResponse {
  voices: VoiceProfile[];
  total: number;
}

export interface CloneRequestPayload {
  name: string;
  tags: string;
  description?: string;
  gender?: 'male' | 'female' | 'neutral';
  language?: string;
}

export interface ConvertRequestPayload {
  targetVoiceId: string;
  options?: Partial<AudioParameters>;
}

export interface TTSRequestPayload {
  text: string;
  voiceId: string;
  emotion?: Emotion;
  options?: Partial<AudioParameters>;
}

export interface ExportOptions {
  format: AudioFormat;
  sampleRate: 22050 | 44100 | 48000;
  bitDepth: 16 | 24;
}
