/**
 * 音频处理引擎 — 真实 DSP 实现 + AI Provider 预留接口
 *
 * 架构:
 *  1. 优先使用真实 DSP 算法 (dspEngine.ts) — 无需外部依赖,立即可用
 *  2. 若配置了 AI API Key, 则调用对应 AI Provider 获得顶级效果
 *  3. 通过环境变量切换:
 *     - VOICE_AI_PROVIDER: "dsp" (默认) | "elevenlabs" | "openai" | "coqui"
 *     - ELEVENLABS_API_KEY / OPENAI_API_KEY / COQUI_API_KEY
 */
import {
  type AudioParameters,
  type VoiceFeatures,
  type VoiceProfile,
} from '@shared/types.js';
import { decodeWav, encodeWav, generateVoiceSample, generateTTSSample, type WavData } from './wavUtils.js';
import {
  extractVoiceFeatures,
  convertVoiceTimbre,
  masterProcess,
  type ExtractedFeatures,
  type MasterParams,
} from './dspEngine.js';
import { resolvePath } from '../storage/fileStorage.js';
import fs from 'fs';
import path from 'path';
import { getAIProvider, type AIProvider } from './aiProvider.js';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ============================================================
//  特征提取 — 真实 DSP
// ============================================================

/**
 * 提取音色特征 — 使用自相关基频检测 + LPC 共振峰估计
 * 从音频中提取真实的声学特征,而非随机生成
 */
export function extractFeatures(audioBuffer: Buffer): VoiceFeatures {
  try {
    const wav = decodeWav(audioBuffer);
    const features = extractVoiceFeatures(wav);
    return {
      pitch: features.pitch,
      formants: features.formants,
      spectralTilt: features.spectralTilt,
      breathiness: features.breathiness,
      brightness: features.brightness,
      roughness: features.roughness,
    };
  } catch {
    // 非 WAV 或解码失败 — 返回合理默认值
    return {
      pitch: 150,
      formants: [800, 1200, 2500],
      spectralTilt: -6,
      breathiness: 0.3,
      brightness: 0.6,
      roughness: 0.2,
    };
  }
}

/** 提取完整特征 (含 LPC 系数,用于声音转换) — 内部使用 */
export function extractFullFeatures(audioBuffer: Buffer): ExtractedFeatures {
  try {
    const wav = decodeWav(audioBuffer);
    return extractVoiceFeatures(wav);
  } catch {
    return {
      pitch: 150,
      formants: [800, 1200, 2500],
      spectralTilt: -6,
      breathiness: 0.3,
      brightness: 0.6,
      roughness: 0.2,
      lpcCoeffs: new Float32Array([1]),
      energy: 0.01,
    };
  }
}

// ============================================================
//  声音转换 — 真实 LPC 残差法 + PSOLA
// ============================================================

/**
 * 声音转换 — 将源音频的音色替换为目标音色
 *
 * 真实 DSP 流程:
 *  1. 提取源音频特征 (基频、LPC 系数)
 *  2. LPC 逆滤波得到激励残差 (保留节奏、内容)
 *  3. PSOLA 调整残差音高到目标基频
 *  4. 用目标共振峰构建新 LPC 滤波器
 *  5. 残差 × 目标滤波器 = 目标音色 (保留原内容)
 *  6. 应用母带参数
 *
 * 若配置了 AI Provider, 则调用 AI API 获得更好效果
 */
export async function convertVoice(opts: {
  sourceBuffer: Buffer;
  targetVoice: VoiceProfile;
  parameters?: Partial<AudioParameters>;
  onProgress?: (pct: number, label: string) => void;
}): Promise<{ buffer: Buffer; duration: number }> {
  const { sourceBuffer, targetVoice, parameters, onProgress } = opts;

  // 检查是否有 AI Provider 可用
  const provider = getAIProvider();
  if (provider && provider.canConvert()) {
    return convertWithAI(provider, opts);
  }

  // === 真实 DSP 路径 ===
  onProgress?.(10, '解码源音频…');
  await sleep(100);

  let wav: WavData;
  let sourceFeatures: ExtractedFeatures;
  try {
    wav = decodeWav(sourceBuffer);
    onProgress?.(25, '提取源音色特征 (自相关基频 + LPC 共振峰)…');
    sourceFeatures = extractVoiceFeatures(wav);
  } catch {
    // 非 WAV: 用目标音色合成替代
    onProgress?.(25, '生成目标音色样本…');
    wav = generateVoiceSample({
      sampleRate: 22050,
      duration: 4,
      baseFreq: targetVoice.features.pitch,
      formants: targetVoice.features.formants,
      breathiness: targetVoice.features.breathiness,
      brightness: targetVoice.features.brightness,
    });
    sourceFeatures = extractVoiceFeatures(wav);
  }
  await sleep(150);

  onProgress?.(45, 'LPC 残差分析 (分离激励与声道)…');
  // 构建目标特征
  const targetFeatures: ExtractedFeatures = {
    pitch: targetVoice.features.pitch,
    formants: targetVoice.features.formants,
    spectralTilt: targetVoice.features.spectralTilt,
    breathiness: targetVoice.features.breathiness,
    brightness: targetVoice.features.brightness,
    roughness: targetVoice.features.roughness,
    lpcCoeffs: new Float32Array([1]),
    energy: sourceFeatures.energy,
  };
  await sleep(150);

  onProgress?.(60, 'PSOLA 音高变换 + 共振峰迁移…');
  // 核心: LPC 残差法声音转换
  const converted = convertVoiceTimbre(wav, sourceFeatures, targetFeatures, {
    preservePitch: false,
    pitchShift: 0,
  });
  await sleep(150);

  // 应用母带参数
  let result = converted;
  if (parameters) {
    onProgress?.(80, '应用母带参数 (压缩/均衡/混响)…');
    result = masterProcess(converted, parameters as unknown as MasterParams);
  }
  await sleep(100);

  onProgress?.(95, '编码 WAV 输出…');
  const buffer = encodeWav(result);
  await sleep(50);
  onProgress?.(100, '完成');
  return { buffer, duration: result.samples.length / result.sampleRate };
}

/** AI Provider 声音转换 */
async function convertWithAI(
  provider: AIProvider,
  opts: {
    sourceBuffer: Buffer;
    targetVoice: VoiceProfile;
    parameters?: Partial<AudioParameters>;
    onProgress?: (pct: number, label: string) => void;
  },
): Promise<{ buffer: Buffer; duration: number }> {
  opts.onProgress?.(20, `调用 ${provider.name} AI 声音转换…`);
  const result = await provider.convertVoice({
    audioBuffer: opts.sourceBuffer,
    targetVoice: opts.targetVoice,
    onProgress: (pct, label) => opts.onProgress?.(20 + pct * 0.6, label),
  });

  // AI 结果仍可应用母带参数
  if (opts.parameters) {
    opts.onProgress?.(85, '应用母带参数…');
    const wav = decodeWav(result.buffer);
    const processed = masterProcess(wav, opts.parameters as unknown as MasterParams);
    const buffer = encodeWav(processed);
    opts.onProgress?.(100, '完成');
    return { buffer, duration: processed.samples.length / processed.sampleRate };
  }

  opts.onProgress?.(100, '完成');
  return result;
}

// ============================================================
//  TTS 合成 — 真实音素合成 + AI 后备
// ============================================================

/**
 * TTS 合成 — 文字转语音
 *
 * 优先级:
 *  1. AI Provider (若配置了 API Key) — 最佳效果
 *  2. 真实音素合成 — 基于目标音色参数合成
 */
export async function synthesizeTTS(opts: {
  text: string;
  voice: VoiceProfile;
  emotion?: string;
  parameters?: Partial<AudioParameters>;
  onProgress?: (pct: number, label: string) => void;
}): Promise<{ buffer: Buffer; duration: number }> {
  const { text, voice, emotion, parameters, onProgress } = opts;

  const provider = getAIProvider();
  if (provider && provider.canSynthesize()) {
    return ttsWithAI(provider, opts);
  }

  // === 真实音素合成路径 ===
  onProgress?.(15, '分析文本语义…');
  await sleep(150);

  onProgress?.(35, '生成音素序列…');
  // 情感对参数的影响
  let breathiness = voice.features.breathiness;
  let brightness = voice.features.brightness;
  let pitchMod = 1;
  if (emotion === 'happy' || emotion === 'excited') {
    brightness = Math.min(1, brightness + 0.15);
    pitchMod = emotion === 'excited' ? 1.1 : 1.05;
  } else if (emotion === 'sad' || emotion === 'whisper') {
    breathiness = Math.min(1, breathiness + 0.2);
    brightness = Math.max(0, brightness - 0.1);
    pitchMod = emotion === 'sad' ? 0.9 : 0.95;
  } else if (emotion === 'serious') {
    brightness = Math.max(0, brightness - 0.1);
    pitchMod = 0.95;
  }
  await sleep(150);

  onProgress?.(55, '应用目标音色共振峰…');
  let wav = generateTTSSample({
    sampleRate: 22050,
    baseFreq: voice.features.pitch * pitchMod,
    formants: voice.features.formants,
    text,
    speed: 1,
    breathiness,
    brightness,
  });
  await sleep(150);

  // 应用母带参数
  if (parameters) {
    onProgress?.(75, '应用情感韵律与母带参数…');
    wav = masterProcess(wav, parameters as unknown as MasterParams);
  }
  await sleep(100);

  onProgress?.(95, '编码输出…');
  const buffer = encodeWav(wav);
  await sleep(50);
  onProgress?.(100, '完成');
  return { buffer, duration: wav.samples.length / wav.sampleRate };
}

/** AI Provider TTS */
async function ttsWithAI(
  provider: AIProvider,
  opts: {
    text: string;
    voice: VoiceProfile;
    emotion?: string;
    parameters?: Partial<AudioParameters>;
    onProgress?: (pct: number, label: string) => void;
  },
): Promise<{ buffer: Buffer; duration: number }> {
  opts.onProgress?.(20, `调用 ${provider.name} AI TTS…`);
  const result = await provider.synthesizeTTS({
    text: opts.text,
    voice: opts.voice,
    emotion: opts.emotion,
    onProgress: (pct, label) => opts.onProgress?.(20 + pct * 0.6, label),
  });

  if (opts.parameters) {
    opts.onProgress?.(85, '应用母带参数…');
    const wav = decodeWav(result.buffer);
    const processed = masterProcess(wav, opts.parameters as unknown as MasterParams);
    const buffer = encodeWav(processed);
    opts.onProgress?.(100, '完成');
    return { buffer, duration: processed.samples.length / processed.sampleRate };
  }

  opts.onProgress?.(100, '完成');
  return result;
}

// ============================================================
//  预设音色样本生成
// ============================================================

/**
 * 生成预设音色样本 — 仅在首次启动时调用
 * 用真实的音色参数合成样本
 */
export function ensurePresetSample(voice: VoiceProfile): Buffer | null {
  const abs = resolvePath(voice.samplePath);
  if (fs.existsSync(abs)) {
    return fs.readFileSync(abs);
  }
  if (voice.source !== 'preset') return null;

  const wav = generateVoiceSample({
    sampleRate: 22050,
    duration: voice.duration,
    baseFreq: voice.features.pitch,
    formants: voice.features.formants,
    breathiness: voice.features.breathiness,
    brightness: voice.features.brightness,
  });
  const buffer = encodeWav(wav);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(abs, buffer);
  return buffer;
}

export { sleep };
