/**
 * 音色服务 — CRUD 与预设种子
 */
import { randomUUID } from 'crypto';
import type { VoiceProfile, VoiceSource } from '@shared/types.js';
import { deleteVoiceById, findVoice, loadVoices, saveVoices, upsertVoice } from '../storage/jsonDB.js';
import { deleteFile } from '../storage/fileStorage.js';
import { ensurePresetSample } from './mockAIEngine.js';

const PRESET_VOICES: VoiceProfile[] = [
  {
    id: 'preset_female_01',
    name: '柔语·女声',
    tags: ['预设', '女声', '温柔'],
    description: '默认预设温柔女声,适合播客旁白与有声书',
    createdAt: '2025-01-01T00:00:00.000Z',
    samplePath: 'uploads/samples/preset_female_01.wav',
    duration: 4,
    features: {
      pitch: 220,
      formants: [850, 1220, 2810],
      spectralTilt: -8,
      breathiness: 0.4,
      brightness: 0.65,
      roughness: 0.2,
    },
    isFavorite: true,
    source: 'preset',
    gender: 'female',
    language: 'zh-CN',
  },
  {
    id: 'preset_male_01',
    name: '醇音·男声',
    tags: ['预设', '男声', '磁性'],
    description: '默认预设磁性男声,适合新闻播报与广告配音',
    createdAt: '2025-01-01T00:00:00.000Z',
    samplePath: 'uploads/samples/preset_male_01.wav',
    duration: 4,
    features: {
      pitch: 120,
      formants: [800, 1150, 2400],
      spectralTilt: -6,
      breathiness: 0.2,
      brightness: 0.7,
      roughness: 0.3,
    },
    isFavorite: false,
    source: 'preset',
    gender: 'male',
    language: 'zh-CN',
  },
  {
    id: 'preset_female_02',
    name: '清越·少女',
    tags: ['预设', '女声', '活泼'],
    description: '高亢清亮的少女音色,适合游戏配音与短视频',
    createdAt: '2025-01-01T00:00:00.000Z',
    samplePath: 'uploads/samples/preset_female_02.wav',
    duration: 4,
    features: {
      pitch: 280,
      formants: [920, 1380, 3050],
      spectralTilt: -10,
      breathiness: 0.5,
      brightness: 0.85,
      roughness: 0.15,
    },
    isFavorite: false,
    source: 'preset',
    gender: 'female',
    language: 'zh-CN',
  },
  {
    id: 'preset_male_02',
    name: '沉稳·大叔',
    tags: ['预设', '男声', '低沉'],
    description: '低沉有力的成熟男声,适合纪录片解说',
    createdAt: '2025-01-01T00:00:00.000Z',
    samplePath: 'uploads/samples/preset_male_02.wav',
    duration: 4,
    features: {
      pitch: 95,
      formants: [740, 1080, 2250],
      spectralTilt: -5,
      breathiness: 0.15,
      brightness: 0.55,
      roughness: 0.4,
    },
    isFavorite: false,
    source: 'preset',
    gender: 'male',
    language: 'zh-CN',
  },
];

/** 启动时初始化预设音色与样本 */
export function seedPresets() {
  const existing = loadVoices();
  const presetIds = new Set(existing.filter((v) => v.source === 'preset').map((v) => v.id));
  const toAdd = PRESET_VOICES.filter((p) => !presetIds.has(p.id));
  if (toAdd.length === 0) return;
  const next = [...existing, ...toAdd];
  saveVoices(next);
  // 生成预设样本文件(若不存在)
  for (const voice of toAdd) {
    ensurePresetSample(voice);
  }
  console.log(`[voiceService] 已播种 ${toAdd.length} 个预设音色`);
}

export function listVoices(filter?: { source?: VoiceSource; keyword?: string }): VoiceProfile[] {
  let voices = loadVoices();
  if (filter?.source) {
    voices = voices.filter((v) => v.source === filter.source);
  }
  if (filter?.keyword) {
    const kw = filter.keyword.toLowerCase();
    voices = voices.filter(
      (v) =>
        v.name.toLowerCase().includes(kw) ||
        v.tags.some((t) => t.toLowerCase().includes(kw)) ||
        v.description?.toLowerCase().includes(kw),
    );
  }
  return voices.sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function getVoice(id: string): VoiceProfile | undefined {
  return findVoice(id);
}

export interface CreateVoiceInput {
  name: string;
  tags: string[];
  description?: string;
  gender?: 'male' | 'female' | 'neutral';
  language?: string;
  samplePath: string;
  duration: number;
  features: VoiceProfile['features'];
}

export function createVoice(input: CreateVoiceInput): VoiceProfile {
  const voice: VoiceProfile = {
    id: `clone_${Date.now()}_${randomUUID().slice(0, 8)}`,
    name: input.name,
    tags: input.tags,
    description: input.description,
    createdAt: new Date().toISOString(),
    samplePath: input.samplePath,
    duration: input.duration,
    features: input.features,
    isFavorite: false,
    source: 'cloned',
    gender: input.gender,
    language: input.language,
  };
  upsertVoice(voice);
  return voice;
}

export function updateVoice(id: string, patch: Partial<VoiceProfile>): VoiceProfile | undefined {
  const voice = findVoice(id);
  if (!voice) return undefined;
  const updated = { ...voice, ...patch, id: voice.id };
  upsertVoice(updated);
  return updated;
}

export function removeVoice(id: string): boolean {
  const voice = findVoice(id);
  if (!voice) return false;
  // 删除样本文件
  if (voice.source === 'cloned') {
    deleteFile(voice.samplePath);
  }
  return deleteVoiceById(id);
}

export function toggleFavorite(id: string): VoiceProfile | undefined {
  const voice = findVoice(id);
  if (!voice) return undefined;
  return updateVoice(id, { isFavorite: !voice.isFavorite });
}
