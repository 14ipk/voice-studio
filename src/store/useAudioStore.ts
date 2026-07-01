/**
 * 音频参数与当前任务状态
 */
import { create } from 'zustand';
import {
  DEFAULT_AUDIO_PARAMETERS,
  type AudioParameters,
  type AudioFormat,
  type Emotion,
  type ExportOptions,
} from '@shared/types';

export type JobKind = 'convert' | 'tts' | null;

export interface ActiveJob {
  kind: JobKind;
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number;
  label: string;
  error?: string;
  /** 输出文件 URL */
  outputUrl?: string;
  outputPath?: string;
  duration?: number;
}

interface AudioStore {
  // 当前参数
  params: AudioParameters;
  // 当前任务
  job: ActiveJob;
  // 导出选项
  export: ExportOptions;
  // 选中的音色
  selectedVoiceId: string | null;
  // 选中的情感
  emotion: Emotion;
  // 是否展开母带面板
  showMastering: boolean;

  setParam: <K extends keyof AudioParameters>(key: K, value: AudioParameters[K]) => void;
  setParams: (patch: Partial<AudioParameters>) => void;
  resetParams: () => void;
  resetParam: (key: keyof AudioParameters) => void;

  setJob: (patch: Partial<ActiveJob>) => void;
  resetJob: () => void;

  setExport: (patch: Partial<ExportOptions>) => void;
  setFormat: (format: AudioFormat) => void;
  setSelectedVoiceId: (id: string | null) => void;
  setEmotion: (e: Emotion) => void;
  setShowMastering: (v: boolean) => void;
}

const initialJob: ActiveJob = {
  kind: null,
  status: 'idle',
  progress: 0,
  label: '',
};

export const useAudioStore = create<AudioStore>((set) => ({
  params: { ...DEFAULT_AUDIO_PARAMETERS },
  job: initialJob,
  export: { format: 'wav', sampleRate: 44100, bitDepth: 16 },
  selectedVoiceId: null,
  emotion: 'neutral',
  showMastering: false,

  setParam: (key, value) =>
    set((s) => ({ params: { ...s.params, [key]: value } })),

  setParams: (patch) => set((s) => ({ params: { ...s.params, ...patch } })),
  resetParams: () => set({ params: { ...DEFAULT_AUDIO_PARAMETERS } }),
  resetParam: (key) =>
    set((s) => ({ params: { ...s.params, [key]: DEFAULT_AUDIO_PARAMETERS[key] } })),

  setJob: (patch) => set((s) => ({ job: { ...s.job, ...patch } })),
  resetJob: () => set({ job: { ...initialJob } }),

  setExport: (patch) => set((s) => ({ export: { ...s.export, ...patch } })),
  setFormat: (format) => set((s) => ({ export: { ...s.export, format } })),
  setSelectedVoiceId: (id) => set({ selectedVoiceId: id }),
  setEmotion: (e) => set({ emotion: e }),
  setShowMastering: (v) => set({ showMastering: v }),
}));
