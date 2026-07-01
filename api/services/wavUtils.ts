/**
 * WAV 文件读写工具 — 纯 Node 实现,无第三方依赖
 * 仅支持 PCM 16-bit 单声道,采样率可变
 */

export interface WavData {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  /** PCM 样本,范围 -1 ~ 1 */
  samples: Float32Array;
}

/** 生成 WAV 文件的字节 Buffer */
export function encodeWav(data: WavData): Buffer {
  const { sampleRate, channels, bitsPerSample, samples } = data;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // sub-chunk size
  buffer.writeUInt16LE(1, 20); // PCM = 1
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28); // byte rate
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // 写入样本
  if (bitsPerSample === 16) {
    for (let i = 0; i < samples.length; i++) {
      let s = samples[i];
      s = Math.max(-1, Math.min(1, s));
      const int = Math.round(s * 32767);
      buffer.writeInt16LE(int, 44 + i * 2);
    }
  }
  return buffer;
}

/** 解析 WAV 文件 */
export function decodeWav(buffer: Buffer): WavData {
  const riff = buffer.toString('ascii', 0, 4);
  if (riff !== 'RIFF') throw new Error('Not a valid WAV file');

  const sampleRate = buffer.readUInt32LE(24);
  const channels = buffer.readUInt16LE(22);
  const bitsPerSample = buffer.readUInt16LE(34);
  const dataOffset = 44;
  const dataSize = buffer.length - dataOffset;
  const samplesCount = dataSize / (bitsPerSample / 8);

  const samples = new Float32Array(samplesCount);
  if (bitsPerSample === 16) {
    for (let i = 0; i < samplesCount; i++) {
      samples[i] = buffer.readInt16LE(dataOffset + i * 2) / 32768;
    }
  } else if (bitsPerSample === 8) {
    for (let i = 0; i < samplesCount; i++) {
      samples[i] = (buffer.readUInt8(dataOffset + i) - 128) / 128;
    }
  }
  return { sampleRate, channels, bitsPerSample, samples };
}

/**
 * 生成一段简短的"语音"演示音 — 模拟人声基频+共振峰
 * 用于预设音色样本生成
 */
export function generateVoiceSample(opts: {
  sampleRate?: number;
  duration?: number;
  baseFreq: number; // 基频
  formants: number[]; // 共振峰频率
  breathiness?: number; // 0-1
  brightness?: number; // 0-1
  speechPattern?: boolean; // 是否模拟说话起伏
}): WavData {
  const sampleRate = opts.sampleRate ?? 22050;
  const duration = opts.duration ?? 4;
  const total = Math.floor(sampleRate * duration);
  const samples = new Float32Array(total);

  const baseFreq = opts.baseFreq;
  const formants = opts.formants;
  const breathiness = opts.breathiness ?? 0.3;
  const brightness = opts.brightness ?? 0.6;
  const speech = opts.speechPattern ?? true;

  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    // 说话起伏: 0.5-1 的振幅包络,模拟音节
    const syllable = speech
      ? (0.5 + 0.5 * Math.sin(t * Math.PI * 1.2)) * (0.6 + 0.4 * Math.sin(t * Math.PI * 0.3))
      : 1;

    // 基频微抖动(vibrato)
    const vibrato = 1 + 0.02 * Math.sin(t * 2 * Math.PI * 5);
    const f0 = baseFreq * vibrato;

    // 基频方波 + 谐波(模拟声带)
    let s = 0;
    s += Math.sin(2 * Math.PI * f0 * t) * 0.5;
    s += Math.sin(2 * Math.PI * f0 * 2 * t) * 0.25 * brightness;
    s += Math.sin(2 * Math.PI * f0 * 3 * t) * 0.12 * brightness;
    s += Math.sin(2 * Math.PI * f0 * 4 * t) * 0.06 * brightness;

    // 共振峰滤波(简化版:加入共振频率正弦)
    for (let k = 0; k < formants.length; k++) {
      s += Math.sin(2 * Math.PI * formants[k] * t) * 0.08 * (1 - k * 0.2);
    }

    // 气息噪声
    const noise = (Math.random() * 2 - 1) * breathiness * 0.15;

    samples[i] = (s + noise) * syllable * 0.55;
  }

  // 淡入淡出
  const fadeLen = Math.floor(sampleRate * 0.05);
  for (let i = 0; i < fadeLen; i++) {
    const gain = i / fadeLen;
    samples[i] *= gain;
    samples[total - 1 - i] *= gain;
  }

  return { sampleRate, channels: 1, bitsPerSample: 16, samples };
}

/**
 * 生成 TTS 风格的"语音"片段 — 模拟不同音节的节奏
 * 每个中文字符对应一个音节
 */
export function generateTTSSample(opts: {
  sampleRate?: number;
  baseFreq: number;
  formants: number[];
  text: string;
  speed?: number;
  breathiness?: number;
  brightness?: number;
}): WavData {
  const sampleRate = opts.sampleRate ?? 22050;
  const speed = opts.speed ?? 1;
  // 每个字符时长(秒)
  const charDur = 0.32 / speed;
  // 仅取可见字符
  const chars = [...opts.text].filter((c) => c.trim().length > 0);
  const total = Math.floor(sampleRate * charDur * chars.length);
  const samples = new Float32Array(total);

  const baseFreq = opts.baseFreq;
  const formants = opts.formants;
  const breathiness = opts.breathiness ?? 0.3;
  const brightness = opts.brightness ?? 0.6;

  // 字符 -> 音节频率偏移(简易音高曲线)
  const charToFreqShift = (ch: string, idx: number): number => {
    const code = ch.charCodeAt(0);
    // 用字符编码做伪音高,让不同字符听起来略有起伏
    const base = ((code % 7) - 3) * 0.06;
    const drift = Math.sin(idx * 0.5) * 0.04;
    return base + drift;
  };

  let cursor = 0;
  for (let c = 0; c < chars.length; c++) {
    const ch = chars[c];
    const shift = charToFreqShift(ch, c);
    const segLen = Math.floor(sampleRate * charDur);
    const f0 = baseFreq * (1 + shift);

    for (let i = 0; i < segLen && cursor < total; i++) {
      const t = i / sampleRate;
      // 音节包络: 快速起音 + 慢释放
      const attack = Math.min(1, i / (sampleRate * 0.02));
      const release = Math.min(1, (segLen - i) / (sampleRate * 0.06));
      const env = attack * release;

      // 基频 + 谐波
      let s = 0;
      s += Math.sin(2 * Math.PI * f0 * t) * 0.5;
      s += Math.sin(2 * Math.PI * f0 * 2 * t) * 0.25 * brightness;
      s += Math.sin(2 * Math.PI * f0 * 3 * t) * 0.12 * brightness;

      for (let k = 0; k < formants.length; k++) {
        s += Math.sin(2 * Math.PI * formants[k] * t) * 0.07 * (1 - k * 0.2);
      }

      const noise = (Math.random() * 2 - 1) * breathiness * 0.12;
      samples[cursor] = (s + noise) * env * 0.5;
      cursor++;
    }
  }

  // 整体淡入淡出
  const fadeLen = Math.min(Math.floor(sampleRate * 0.04), Math.floor(total / 4));
  for (let i = 0; i < fadeLen; i++) {
    const gain = i / fadeLen;
    samples[i] *= gain;
    if (total - 1 - i >= 0) samples[total - 1 - i] *= gain;
  }

  return { sampleRate, channels: 1, bitsPerSample: 16, samples };
}

/** 应用音频参数到 WAV 数据 — 模拟母带处理 */
export function applyParameters(data: WavData, params: {
  pitch: number;       // -12 ~ 12 (半音)
  speed: number;       // 0.5 ~ 2
  formant: number;     // -50 ~ 50
  brightness: number;  // 0 ~ 100
  reverb: number;      // 0 ~ 100
  compression: number; // 0 ~ 100
  volume: number;      // 0 ~ 100
}): WavData {
  const { samples, sampleRate } = data;

  // 1. 语速: 重采样(线性插值)
  const speedRatio = params.speed;
  const newLen = Math.floor(samples.length / speedRatio);
  const spedUp = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const src = i * speedRatio;
    const idx = Math.floor(src);
    const frac = src - idx;
    const a = samples[idx] ?? 0;
    const b = samples[idx + 1] ?? a;
    spedUp[i] = a + (b - a) * frac;
  }

  // 2. 音高: 通过整体频率偏移实现(简化:乘以 2^(n/12))
  const pitchRatio = Math.pow(2, params.pitch / 12);
  const pitchAdjusted = new Float32Array(spedUp.length);
  for (let i = 0; i < spedUp.length; i++) {
    const src = i * pitchRatio;
    const idx = Math.floor(src);
    const frac = src - idx;
    const a = spedUp[idx] ?? 0;
    const b = spedUp[idx + 1] ?? a;
    pitchAdjusted[i] = a + (b - a) * frac;
  }

  // 3. 共振峰偏移: 简化版 = 整体频谱缩放(此处用简易低通/高通近似)
  const formantFactor = 1 + params.formant / 100;
  let filtered = pitchAdjusted;
  if (params.formant !== 0) {
    filtered = new Float32Array(pitchAdjusted.length);
    // 简单一阶低通/高通
    const alpha = formantFactor > 1 ? 0.3 : 0.7;
    let prev = 0;
    for (let i = 0; i < pitchAdjusted.length; i++) {
      prev = prev + alpha * (pitchAdjusted[i] - prev);
      filtered[i] = formantFactor > 1 ? pitchAdjusted[i] - prev * 0.5 : prev;
    }
  }

  // 4. 亮度: 高频强调(简化的差分高频)
  if (params.brightness !== 60) {
    const target = params.brightness / 60;
    const out = new Float32Array(filtered.length);
    for (let i = 0; i < filtered.length; i++) {
      const diff = i > 0 ? filtered[i] - filtered[i - 1] : 0;
      out[i] = filtered[i] + diff * (target - 1) * 0.5;
    }
    filtered = out;
  }

  // 5. 压限: 简易动态范围压缩
  if (params.compression > 0) {
    const ratio = params.compression / 100;
    const threshold = 0.5;
    const out = new Float32Array(filtered.length);
    for (let i = 0; i < filtered.length; i++) {
      const s = filtered[i];
      const abs = Math.abs(s);
      if (abs > threshold) {
        const over = abs - threshold;
        out[i] = Math.sign(s) * (threshold + over * (1 - ratio * 0.6));
      } else {
        out[i] = s;
      }
    }
    filtered = out;
  }

  // 6. 混响: 简易回声(延迟 100ms,衰减 0.3)
  if (params.reverb > 0) {
    const delaySamples = Math.floor(sampleRate * 0.1);
    const wet = params.reverb / 100 * 0.3;
    const out = new Float32Array(filtered.length);
    for (let i = 0; i < filtered.length; i++) {
      out[i] = filtered[i] + (i >= delaySamples ? filtered[i - delaySamples] * wet : 0);
    }
    filtered = out;
  }

  // 7. 音量
  const volGain = params.volume / 80;
  const out = new Float32Array(filtered.length);
  let peak = 0;
  for (let i = 0; i < filtered.length; i++) {
    out[i] = filtered[i] * volGain;
    if (Math.abs(out[i]) > peak) peak = Math.abs(out[i]);
  }

  // 防止削波
  if (peak > 1) {
    for (let i = 0; i < out.length; i++) out[i] /= peak;
  }

  return { ...data, samples: out };
}

/** 计算音频时长(秒) */
export function getDuration(data: WavData): number {
  return data.samples.length / data.sampleRate;
}
