/**
 * 浏览器端 Web Audio API 引擎 — 音频播放与波形可视化
 */
import type { AudioParameters } from '@shared/types';

interface PlayHandle {
  stop: () => void;
  duration: number;
}

type ProgressCb = (currentTime: number, duration: number) => void;
type EndCb = () => void;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentGain: GainNode | null = null;
  private startTime = 0;
  private pauseOffset = 0;
  private rafId: number | null = null;

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  isPlaying(): boolean {
    return this.currentSource !== null;
  }

  async decodeBlob(blob: Blob): Promise<AudioBuffer> {
    const ctx = this.ensureCtx();
    const arr = await blob.arrayBuffer();
    return await ctx.decodeAudioData(arr);
  }

  /** 加载 URL 音频,返回 AudioBuffer */
  async loadBuffer(url: string): Promise<AudioBuffer> {
    const res = await fetch(url);
    const blob = await res.blob();
    return await this.decodeBlob(blob);
  }

  /** 应用参数(实时) — 返回处理后的 AudioBuffer */
  async applyParameters(buffer: AudioBuffer, params: AudioParameters): Promise<AudioBuffer> {
    const offline = new OfflineAudioContext(
      buffer.numberOfChannels,
      Math.floor(buffer.length * params.speed),
      buffer.sampleRate,
    );

    const src = offline.createBufferSource();
    src.buffer = buffer;
    // 播放速率(语速)
    src.playbackRate.value = params.speed;
    // 音高偏移(通过 detune,以分为单位,1 半音 = 100 音分)
    src.detune.value = params.pitch * 100;

    // 增益(音量)
    const gain = offline.createGain();
    gain.gain.value = params.volume / 80;

    // 简易动态压缩(用 DynamicsCompressorNode)
    const comp = offline.createDynamicsCompressor();
    comp.threshold.value = -50 + (100 - params.compression) * 0.3;
    comp.ratio.value = 1 + params.compression / 20;

    // 高/低频
    const filter = offline.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = 3000;
    filter.gain.value = (params.brightness - 60) * 0.4;

    // 简易混响(用 ConvolverNode + 短脉冲)
    let wetGain: GainNode | null = null;
    let convolver: ConvolverNode | null = null;
    if (params.reverb > 0) {
      convolver = offline.createConvolver();
      convolver.buffer = this.makeImpulse(offline, 0.4, params.reverb / 100);
      wetGain = offline.createGain();
      wetGain.gain.value = params.reverb / 200;
    }

    src.connect(filter);
    filter.connect(comp);
    comp.connect(gain);
    gain.connect(offline.destination);
    if (convolver && wetGain) {
      comp.connect(convolver);
      convolver.connect(wetGain);
      wetGain.connect(offline.destination);
    }

    src.start();
    return await offline.startRendering();
  }

  private makeImpulse(ctx: BaseAudioContext, duration: number, decay: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const length = rate * duration;
    const impulse = ctx.createBuffer(2, length, rate);
    for (let c = 0; c < 2; c++) {
      const data = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2 + decay * 2);
      }
    }
    return impulse;
  }

  /**
   * 播放音频
   * @param url 原始音频 URL
   * @param params 母带参数(若提供,会先离线渲染)
   * @param onProgress 进度回调
   * @param onEnd 结束回调
   * @param onReady 准备好播放回调,返回 duration
   */
  async play(opts: {
    url: string;
    params?: AudioParameters;
    onProgress?: ProgressCb;
    onEnd?: EndCb;
    onReady?: (duration: number) => void;
  }): Promise<PlayHandle> {
    this.stop();

    const ctx = this.ensureCtx();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    let buffer = await this.loadBuffer(opts.url);
    if (opts.params) {
      buffer = await this.applyParameters(buffer, opts.params);
    }
    opts.onReady?.(buffer.duration);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 1;
    source.connect(gain);
    gain.connect(ctx.destination);

    source.onended = () => {
      this.cleanup();
      opts.onEnd?.();
    };

    source.start();
    this.currentSource = source;
    this.currentGain = gain;
    this.startTime = ctx.currentTime;

    const tick = () => {
      if (!this.currentSource || !this.ctx) return;
      const t = this.ctx.currentTime - this.startTime;
      opts.onProgress?.(t, buffer.duration);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);

    return {
      stop: () => this.stop(),
      duration: buffer.duration,
    };
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // 已停止
      }
    }
    this.cleanup();
  }

  private cleanup() {
    this.currentSource = null;
    this.currentGain = null;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** 从 AudioBuffer 提取波形数据(降采样到指定点数) */
  extractWaveform(buffer: AudioBuffer, points = 200): number[] {
    const channel = buffer.getChannelData(0);
    const blockSize = Math.floor(channel.length / points);
    const out: number[] = [];
    for (let i = 0; i < points; i++) {
      let sum = 0;
      const start = i * blockSize;
      for (let j = 0; j < blockSize; j++) {
        const v = channel[start + j] || 0;
        sum += v * v;
      }
      out.push(Math.sqrt(sum / blockSize));
    }
    // 归一化
    const max = Math.max(...out, 0.01);
    return out.map((v) => v / max);
  }

  /** 从 AudioBuffer 提取频谱(用于音色克隆可视化) */
  extractSpectrum(buffer: AudioBuffer, fftSize = 256): number[] {
    const ctx = this.ensureCtx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = fftSize;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(analyser);
    analyser.connect(ctx.destination);
    // 模拟同步读取(实际异步,这里返回伪频谱)
    src.start(0);
    src.stop(buffer.duration);
    src.onended = () => {
      analyser.getByteFrequencyData(data);
    };
    // 直接返回基于波形估计的伪频谱
    const channel = buffer.getChannelData(0);
    const buckets = new Array(fftSize / 2).fill(0);
    const winSize = 1024;
    for (let w = 0; w < Math.min(40, Math.floor(channel.length / winSize)); w++) {
      const start = w * winSize;
      for (let k = 1; k < fftSize / 2; k++) {
        let re = 0, im = 0;
        for (let n = 0; n < winSize; n++) {
          const angle = (2 * Math.PI * k * n) / winSize;
          const s = channel[start + n] || 0;
          re += s * Math.cos(angle);
          im -= s * Math.sin(angle);
        }
        buckets[k] += Math.sqrt(re * re + im * im);
      }
    }
    const max = Math.max(...buckets, 0.01);
    return buckets.map((v) => v / max);
  }
}

export const audioEngine = new AudioEngine();
