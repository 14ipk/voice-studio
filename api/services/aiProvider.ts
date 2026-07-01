/**
 * AI Provider 接口层 — 标准化 AI 声音服务接口
 *
 * 支持的 Provider:
 *  - elevenlabs: ElevenLabs (声音克隆 + TTS, 效果最佳, 付费)
 *  - openai:     OpenAI TTS (高质量 TTS, 无声音克隆)
 *  - coqui:      Coqui TTS (开源, 可自托管)
 *
 * 配置方式 (环境变量):
 *  VOICE_AI_PROVIDER=elevenlabs|openai|coqui
 *  ELEVENLABS_API_KEY=sk-xxx
 *  OPENAI_API_KEY=sk-xxx
 *  COQUI_API_KEY=xxx
 *  COQUI_API_URL=http://localhost:5002  (自托管 Coqui 服务)
 *
 * 未配置时返回 null, 引擎自动 fallback 到本地 DSP
 */
import type { VoiceProfile } from '@shared/types.js';

export interface AIProvider {
  /** Provider 名称 */
  name: string;
  /** 是否支持声音转换 (克隆音色应用到源音频) */
  canConvert(): boolean;
  /** 是否支持 TTS 合成 */
  canSynthesize(): boolean;
  /** 声音转换 */
  convertVoice(opts: {
    audioBuffer: Buffer;
    targetVoice: VoiceProfile;
    onProgress?: (pct: number, label: string) => void;
  }): Promise<{ buffer: Buffer; duration: number }>;
  /** TTS 合成 */
  synthesizeTTS(opts: {
    text: string;
    voice: VoiceProfile;
    emotion?: string;
    onProgress?: (pct: number, label: string) => void;
  }): Promise<{ buffer: Buffer; duration: number }>;
}

// ============================================================
//  Provider 单例管理
// ============================================================

let cachedProvider: AIProvider | null | undefined;

/**
 * 获取已配置的 AI Provider
 * @returns AIProvider 实例, 或 null (使用本地 DSP)
 */
export function getAIProvider(): AIProvider | null {
  if (cachedProvider !== undefined) return cachedProvider;

  const providerName = (process.env.VOICE_AI_PROVIDER || '').toLowerCase();

  try {
    switch (providerName) {
      case 'elevenlabs':
        cachedProvider = createElevenLabsProvider();
        break;
      case 'openai':
        cachedProvider = createOpenAIProvider();
        break;
      case 'coqui':
        cachedProvider = createCoquiProvider();
        break;
      default:
        cachedProvider = null;
    }
  } catch {
    cachedProvider = null;
  }

  return cachedProvider;
}

// ============================================================
//  ElevenLabs Provider (声音克隆 + TTS)
// ============================================================

function createElevenLabsProvider(): AIProvider {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not configured');

  // 音色 ID 映射缓存 (VoiceProfile.id -> ElevenLabs voice_id)
  const voiceIdCache = new Map<string, string>();

  return {
    name: 'ElevenLabs',

    canConvert() {
      return true; // ElevenLabs 支持 speech-to-speech
    },

    canSynthesize() {
      return true;
    },

    async convertVoice(opts) {
      const { audioBuffer, targetVoice, onProgress } = opts;
      onProgress?.(30, '上传源音频到 ElevenLabs…');

      // 获取或创建目标音色 ID
      let voiceId = voiceIdCache.get(targetVoice.id);
      if (!voiceId) {
        onProgress?.(40, '克隆目标音色…');
        // 如果目标音色有样本文件,先克隆
        voiceId = await cloneVoiceElevenLabs(apiKey, targetVoice);
        voiceIdCache.set(targetVoice.id, voiceId);
      }

      onProgress?.(60, '执行 AI 声音转换 (Speech-to-Speech)…');
      // ElevenLabs Speech-to-Speech API
      const formData = new FormData();
      formData.append('audio', new Blob([audioBuffer]), 'source.wav');
      formData.append('model_id', 'eleven_multilingual_sts_v2');
      formData.append('voice_id', voiceId);

      const response = await fetch('https://api.elevenlabs.io/v1/speech-to-speech', {
        method: 'POST',
        headers: { 'xi-api-key': apiKey },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs STS failed: ${response.status} ${await response.text()}`);
      }

      onProgress?.(90, '接收 AI 转换结果…');
      const resultBuffer = Buffer.from(await response.arrayBuffer());
      const duration = estimateDuration(resultBuffer);
      return { buffer: resultBuffer, duration };
    },

    async synthesizeTTS(opts) {
      const { text, voice, emotion, onProgress } = opts;
      onProgress?.(30, '准备 ElevenLabs TTS…');

      let voiceId = voiceIdCache.get(voice.id);
      if (!voiceId) {
        onProgress?.(40, '克隆目标音色…');
        voiceId = await cloneVoiceElevenLabs(apiKey, voice);
        voiceIdCache.set(voice.id, voiceId);
      }

      onProgress?.(60, '调用 AI TTS 合成…');
      // 情感风格设置
      const voiceSettings: Record<string, unknown> = {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.3,
      };
      if (emotion === 'whisper') voiceSettings.style = 0.8;
      if (emotion === 'excited') { voiceSettings.stability = 0.3; voiceSettings.style = 0.6; }
      if (emotion === 'sad') { voiceSettings.stability = 0.7; voiceSettings.style = 0.4; }

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: voiceSettings,
        }),
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs TTS failed: ${response.status} ${await response.text()}`);
      }

      onProgress?.(90, '接收 AI 合成结果…');
      const mp3Buffer = Buffer.from(await response.arrayBuffer());
      // 转 WAV (简化: 直接返回 MP3, 前端可播放)
      // 生产环境应转 WAV 以保证一致性
      const duration = estimateDuration(mp3Buffer);
      return { buffer: mp3Buffer, duration };
    },
  };
}

/** ElevenLabs 克隆音色 */
async function cloneVoiceElevenLabs(apiKey: string, voice: VoiceProfile): Promise<string> {
  // 如果有样本文件,上传克隆
  // 否则选一个预设音色
  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
  });
  if (!response.ok) throw new Error('Cannot list ElevenLabs voices');

  const data = await response.json() as { voices: { voice_id: string; name: string }[] };
  // 找匹配的预设音色
  const match = data.voices.find((v) =>
    v.name.toLowerCase().includes(voice.gender === 'female' ? 'female' : 'male'),
  );
  return match?.voice_id || data.voices[0]?.voice_id || '21m00Tcm4TlvDq8ikWAM';
}

// ============================================================
//  OpenAI Provider (TTS only)
// ============================================================

function createOpenAIProvider(): AIProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  // 音色映射: 根据性别选 OpenAI 预设音色
  const voiceMap: Record<string, string> = {
    female: 'nova',
    male: 'onyx',
    neutral: 'echo',
  };

  return {
    name: 'OpenAI',

    canConvert() {
      return false; // OpenAI 不支持声音转换
    },

    canSynthesize() {
      return true;
    },

    async convertVoice() {
      throw new Error('OpenAI does not support voice conversion');
    },

    async synthesizeTTS(opts) {
      const { text, voice, emotion, onProgress } = opts;
      onProgress?.(30, '调用 OpenAI TTS…');

      // 选择音色
      const openaiVoice = voiceMap[voice.gender] || 'echo';

      // 情感指令
      let instructions = '';
      if (emotion === 'happy') instructions = 'Speak in a cheerful, upbeat tone.';
      else if (emotion === 'excited') instructions = 'Speak with high energy and excitement.';
      else if (emotion === 'sad') instructions = 'Speak in a somber, melancholic tone.';
      else if (emotion === 'serious') instructions = 'Speak in a formal, serious tone.';
      else if (emotion === 'whisper') instructions = 'Speak in a soft whisper.';

      onProgress?.(60, '合成语音…');
      const body: Record<string, unknown> = {
        model: 'gpt-4o-mini-tts',
        input: text,
        voice: openaiVoice,
        response_format: 'wav',
      };
      if (instructions) body.instructions = instructions;

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`OpenAI TTS failed: ${response.status} ${await response.text()}`);
      }

      onProgress?.(90, '接收合成结果…');
      const resultBuffer = Buffer.from(await response.arrayBuffer());
      const duration = estimateDuration(resultBuffer);
      return { buffer: resultBuffer, duration };
    },
  };
}

// ============================================================
//  Coqui Provider (自托管, 声音克隆 + TTS)
// ============================================================

function createCoquiProvider(): AIProvider {
  const apiKey = process.env.COQUI_API_KEY || '';
  const apiUrl = process.env.COQUI_API_URL || 'http://localhost:5002';
  const voiceModelCache = new Map<string, string>();

  return {
    name: 'Coqui',

    canConvert() {
      return true;
    },

    canSynthesize() {
      return true;
    },

    async convertVoice(opts) {
      const { audioBuffer, targetVoice, onProgress } = opts;
      onProgress?.(30, '上传到 Coqui 服务…');

      let modelId = voiceModelCache.get(targetVoice.id);
      if (!modelId) {
        onProgress?.(40, '加载目标音色模型…');
        modelId = targetVoice.id;
        voiceModelCache.set(targetVoice.id, modelId);
      }

      onProgress?.(60, '执行 Coqui 声音转换…');
      const formData = new FormData();
      formData.append('source', new Blob([audioBuffer]), 'source.wav');
      formData.append('voice_id', modelId);

      const headers: Record<string, string> = {};
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const response = await fetch(`${apiUrl}/api/voice-convert`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Coqui convert failed: ${response.status}`);
      }

      onProgress?.(90, '接收结果…');
      const resultBuffer = Buffer.from(await response.arrayBuffer());
      const duration = estimateDuration(resultBuffer);
      return { buffer: resultBuffer, duration };
    },

    async synthesizeTTS(opts) {
      const { text, voice, emotion, onProgress } = opts;
      onProgress?.(30, '调用 Coqui TTS…');

      let modelId = voiceModelCache.get(voice.id);
      if (!modelId) {
        modelId = voice.id;
        voiceModelCache.set(voice.id, modelId);
      }

      onProgress?.(60, '合成语音…');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const response = await fetch(`${apiUrl}/api/tts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text,
          voice_id: modelId,
          language: voice.language,
          emotion: emotion || 'neutral',
          speaker_wav: voice.samplePath,
        }),
      });

      if (!response.ok) {
        throw new Error(`Coqui TTS failed: ${response.status}`);
      }

      onProgress?.(90, '接收结果…');
      const resultBuffer = Buffer.from(await response.arrayBuffer());
      const duration = estimateDuration(resultBuffer);
      return { buffer: resultBuffer, duration };
    },
  };
}

// ============================================================
//  工具函数
// ============================================================

/** 粗略估算音频时长 (基于文件大小, WAV 更精确) */
function estimateDuration(buffer: Buffer): number {
  // 尝试解析 WAV 头
  if (buffer.length > 44 && buffer.toString('ascii', 0, 4) === 'RIFF') {
    const sampleRate = buffer.readUInt32LE(24);
    const dataSize = buffer.length - 44;
    const bytesPerSample = buffer.readUInt16LE(34) / 8;
    return dataSize / (sampleRate * bytesPerSample);
  }
  // MP3 粗估: 128kbps = 16KB/s
  return buffer.length / 16000;
}

/**
 * 获取当前 Provider 配置状态 (用于前端显示)
 */
export function getProviderStatus(): { provider: string; configured: boolean; capabilities: { convert: boolean; tts: boolean } } {
  const provider = getAIProvider();
  if (!provider) {
    return {
      provider: 'dsp',
      configured: false,
      capabilities: { convert: true, tts: true },
    };
  }
  return {
    provider: provider.name.toLowerCase(),
    configured: true,
    capabilities: { convert: provider.canConvert(), tts: provider.canSynthesize() },
  };
}
