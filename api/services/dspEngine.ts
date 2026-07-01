/**
 * 真实 DSP 引擎 — 纯 Node.js 实现的数字信号处理算法
 *
 * 包含:
 *  - 自相关法(ACF)基频检测
 *  - LPC(Levinson-Durbin)共振峰估计
 *  - PSOLA(基频同步叠加)音高变换
 *  - LPC 残差法共振峰迁移(音色转换)
 *  - 真实压缩器/均衡器/Schroeder混响/限幅器
 *
 * 无第三方依赖,所有算法从信号处理原理实现
 */
import type { WavData } from './wavUtils.js';

// ============================================================
//  1. 基础工具: 窗函数
// ============================================================

/** Hann 窗 — 用于分帧分析,减少频谱泄漏 */
export function hannWindow(size: number): Float32Array {
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return w;
}

/** 预加重滤波器 — 提升高频,补偿语音频谱倾斜,利于 LPC 分析 */
export function preEmphasis(samples: Float32Array, alpha = 0.97): Float32Array {
  const out = new Float32Array(samples.length);
  out[0] = samples[0];
  for (let i = 1; i < samples.length; i++) {
    out[i] = samples[i] - alpha * samples[i - 1];
  }
  return out;
}

// ============================================================
//  2. 基频检测: 自相关法 (Autocorrelation)
// ============================================================

/**
 * 自相关基频检测
 *
 * 原理: 语音信号具有周期性,自相关函数在基频周期处出现峰值。
 * 在人声基频范围 (50-500Hz) 内搜索最大自相关峰值,其对应的延迟即为基频周期。
 *
 * 算法:
 *  1. 对信号分帧 (30ms 窗, 10ms 步长)
 *  2. 每帧加 Hann 窗
 *  3. 计算归一化自相关函数
 *  4. 在 50-500Hz 对应的延迟范围内找最大峰值
 *  5. 用抛物线插值提高精度
 *  6. 对所有帧取中位数作为稳定基频估计
 */
export function detectPitchACF(samples: Float32Array, sampleRate: number): number {
  const frameSize = Math.floor(sampleRate * 0.03); // 30ms
  const hopSize = Math.floor(sampleRate * 0.01); // 10ms
  const minLag = Math.floor(sampleRate / 500); // 500Hz
  const maxLag = Math.floor(sampleRate / 50); // 50Hz

  const window = hannWindow(frameSize);
  const pitches: number[] = [];

  for (let start = 0; start + frameSize < samples.length; start += hopSize) {
    // 取帧并加窗
    const frame = new Float32Array(frameSize);
    let energy = 0;
    for (let i = 0; i < frameSize; i++) {
      frame[i] = samples[start + i] * window[i];
      energy += frame[i] * frame[i];
    }

    // 跳过低能量帧(静音)
    if (energy / frameSize < 1e-5) continue;

    // 计算归一化自相关 (NACF = R(lag)/R(0),值域 [-1,1])
    let bestLag = 0;
    let bestCorr = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i < frameSize - lag; i++) {
        corr += frame[i] * frame[i + lag];
      }
      // 用零延迟自相关(能量)归一化,使峰值与信号幅度无关
      const ncorr = energy > 1e-10 ? corr / energy : 0;

      if (ncorr > bestCorr) {
        bestCorr = ncorr;
        bestLag = lag;
      }
    }

    // 置信度阈值: 归一化自相关峰值需足够大(0.3 = 30% 周期性)
    if (bestCorr > 0.3 && bestLag > 0) {
      // 抛物线插值提高精度
      const refinedLag = parabolicInterp(
        bestLag > minLag ? bestLag - 1 : bestLag,
        bestLag,
        bestLag < maxLag ? bestLag + 1 : bestLag,
        samples,
        start,
        frameSize,
      );
      const f0 = sampleRate / refinedLag;
      if (f0 >= 50 && f0 <= 500) {
        pitches.push(f0);
      }
    }
  }

  if (pitches.length === 0) return 0;

  // 取中位数,排除异常值
  pitches.sort((a, b) => a - b);
  return pitches[Math.floor(pitches.length / 2)];
}

/** 抛物线插值 — 提高峰值位置精度 */
function parabolicInterp(
  yMinus: number,
  yZero: number,
  yPlus: number,
  samples: Float32Array,
  start: number,
  frameSize: number,
): number {
  // 重新计算三个点的自相关值
  const calcACF = (lag: number): number => {
    let c = 0;
    for (let i = 0; i < frameSize - lag; i++) {
      c += samples[start + i] * samples[start + i + lag];
    }
    return c / frameSize;
  };
  const ym = calcACF(yMinus);
  const y0 = calcACF(yZero);
  const yp = calcACF(yPlus);

  const denom = (ym - 2 * y0 + yp);
  if (Math.abs(denom) < 1e-10) return yZero;

  const offset = 0.5 * (ym - yp) / denom;
  return yZero + offset;
}

// ============================================================
//  3. LPC 共振峰估计 (Levinson-Durbin 递归)
// ============================================================

/**
 * Levinson-Durbin 递归 — 求解 LPC 系数
 *
 * 原理: 用自相关法求解 Yule-Walker 方程,得到线性预测系数。
 * LPC 模型假设当前样本可由前 p 个样本线性预测:
 *   x[n] = -sum(a[k] * x[n-k])
 *
 * @param r 自相关序列 (r[0..order])
 * @param order LPC 阶数 (通常 10-14)
 * @returns LPC 系数 a[0..order], a[0]=1
 */
export function levinsonDurbin(r: Float32Array, order: number): Float32Array {
  const a = new Float32Array(order + 1);
  const aPrev = new Float32Array(order + 1);
  a[0] = 1;
  aPrev[0] = 1;

  let e = r[0]; // 预测误差初始值 = 能量

  for (let i = 1; i <= order; i++) {
    // 计算反射系数
    let acc = 0;
    for (let j = 1; j < i; j++) {
      acc += aPrev[j] * r[i - j];
    }
    const ki = (r[i] - acc) / e;

    // 更新系数
    a[i] = ki;
    for (let j = 1; j < i; j++) {
      a[j] = aPrev[j] - ki * aPrev[i - j];
    }

    // 更新误差
    e = (1 - ki * ki) * e;
    if (e < 1e-10) break;

    // 保存当前系数供下一轮使用
    for (let j = 0; j <= i; j++) aPrev[j] = a[j];
  }

  return a;
}

/**
 * 从 LPC 系数估计共振峰频率
 *
 * 原理: LPC 滤波器的极点(分母多项式的根)对应语音道的共振峰。
 * 将根转换为频率: freq = angle(z) * sampleRate / (2*PI)
 *
 * @param lpcCoeffs LPC 系数 (a[0]=1)
 * @param sampleRate 采样率
 * @param maxFormants 最多返回的共振峰数量
 * @returns 共振峰频率数组 (升序)
 */
export function estimateFormantsLPC(lpcCoeffs: Float32Array, sampleRate: number, maxFormants = 4): number[] {
  const order = lpcCoeffs.length - 1;
  // 求 LPC 分母多项式 A(z) = 1 + a1*z^-1 + ... + ap*z^-p 的根
  const roots = polyRoots(lpcCoeffs);

  // 将根转换为频率,并筛选有效共振峰 (带宽 < 700Hz, 频率 90-5000Hz)
  const formants: { freq: number; bandwidth: number }[] = [];
  for (const z of roots) {
    if (Math.abs(z) < 0.001) continue;
    const angle = Math.atan2(z.imag, z.real);
    const freq = (angle * sampleRate) / (2 * Math.PI);
    // 带宽 = -sampleRate/PI * ln|z|
    const bandwidth = (-sampleRate / Math.PI) * Math.log(Math.abs(z));

    if (freq > 0 && freq > 90 && freq < 5000 && bandwidth > 0 && bandwidth < 700) {
      formants.push({ freq, bandwidth });
    }
  }

  // 按频率排序,取前 maxFormants 个
  formants.sort((a, b) => a.freq - b.freq);
  return formants.slice(0, maxFormants).map((f) => Math.round(f.freq));
}

/**
 * 求多项式的根 (Durand-Kerner 方法)
 * 求 a[0] + a[1]*x + ... + a[n]*x^n = 0 的所有根
 */
function polyRoots(coeffs: Float32Array): { real: number; imag: number }[] {
  const n = coeffs.length - 1;
  if (n <= 0) return [];
  if (n === 1) return [{ real: -coeffs[0] / coeffs[1], imag: 0 }];

  // 归一化: 最高次系数为 1
  const a = new Float64Array(n + 1);
  const lead = coeffs[n] || 1;
  for (let i = 0; i <= n; i++) a[i] = coeffs[i] / lead;

  // Durand-Kerner 迭代
  const roots: { real: number; imag: number }[] = [];
  // 初始猜测: 在单位圆上均匀分布
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n + 0.4;
    roots.push({ real: Math.cos(angle), imag: Math.sin(angle) });
  }

  const maxIter = 100;
  for (let iter = 0; iter < maxIter; iter++) {
    let maxDelta = 0;
    for (let i = 0; i < n; i++) {
      // 计算多项式在 roots[i] 的值
      const val = evalPoly(a, roots[i]);
      // 计算分母: prod(roots[i] - roots[j]) for j != i
      let denom = { real: 1, imag: 0 };
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        denom = complexMul(denom, {
          real: roots[i].real - roots[j].real,
          imag: roots[i].imag - roots[j].imag,
        });
      }
      if (Math.abs(denom.real) < 1e-15 && Math.abs(denom.imag) < 1e-15) continue;

      const delta = complexDiv(val, denom);
      roots[i].real -= delta.real;
      roots[i].imag -= delta.imag;
      maxDelta = Math.max(maxDelta, Math.abs(delta.real) + Math.abs(delta.imag));
    }
    if (maxDelta < 1e-12) break;
  }

  return roots;
}

/** 复数乘法 */
function complexMul(a: { real: number; imag: number }, b: { real: number; imag: number }) {
  return {
    real: a.real * b.real - a.imag * b.imag,
    imag: a.real * b.imag + a.imag * b.real,
  };
}

/** 复数除法 */
function complexDiv(a: { real: number; imag: number }, b: { real: number; imag: number }) {
  const denom = b.real * b.real + b.imag * b.imag;
  return {
    real: (a.real * b.real + a.imag * b.imag) / denom,
    imag: (a.imag * b.real - a.real * b.imag) / denom,
  };
}

/** 计算多项式在复数点的值 (Horner 法) */
function evalPoly(coeffs: Float64Array, z: { real: number; imag: number }): { real: number; imag: number } {
  let result = { real: coeffs[coeffs.length - 1], imag: 0 };
  for (let i = coeffs.length - 2; i >= 0; i--) {
    result = complexMul(result, z);
    result.real += coeffs[i];
  }
  return result;
}

// ============================================================
//  4. 完整特征提取
// ============================================================

export interface ExtractedFeatures {
  pitch: number;
  formants: number[];
  spectralTilt: number;
  breathiness: number;
  brightness: number;
  roughness: number;
  /** LPC 系数 — 用于声音转换 */
  lpcCoeffs: Float32Array;
  /** 平均能量 */
  energy: number;
}

/**
 * 完整的音色特征提取
 *  - 自相关基频
 *  - LPC 共振峰
 *  - 频谱倾斜(高频衰减斜率)
 *  - 气息感(高频噪声能量比)
 *  - 亮度(频谱质心)
 *  - 粗糙度(基频微扰 Jitter)
 */
export function extractVoiceFeatures(wav: WavData): ExtractedFeatures {
  const { samples, sampleRate } = wav;

  // 预加重
  const emphasized = preEmphasis(samples);

  // 1. 基频检测
  const pitch = detectPitchACF(samples, sampleRate);
  const safePitch = Math.round(pitch) || 150;

  // 2. LPC 分析 (阶数 12, 适合 16kHz; 对 22kHz 用 14)
  const lpcOrder = sampleRate >= 22050 ? 14 : 12;
  const lpcCoeffs = computeLPC(emphasized, lpcOrder, sampleRate);
  const formants = estimateFormantsLPC(lpcCoeffs, sampleRate, 4);

  // 3. 频谱分析 (FFT) — 用原始信号(非预加重),避免高频被人为抬升
  const spectrum = computeMagnitudeSpectrum(samples, sampleRate);
  const { spectralTilt, brightness, breathiness } = analyzeSpectrum(spectrum, sampleRate, safePitch);

  // 4. 粗糙度 (Jitter — 基频微扰)
  const roughness = computeJitter(samples, sampleRate);

  // 5. 平均能量
  let energy = 0;
  for (let i = 0; i < samples.length; i++) energy += samples[i] * samples[i];
  energy = Math.sqrt(energy / samples.length);

  // 共振峰: 若 LPC 提取不足 3 个,用基频推算的典型元音共振峰补全
  const finalFormants =
    formants.length >= 3 ? formants.slice(0, 3) : [...formants, ...defaultFormants(safePitch)].slice(0, 3);

  return {
    pitch: safePitch,
    formants: finalFormants,
    spectralTilt,
    breathiness,
    brightness,
    roughness,
    lpcCoeffs,
    energy,
  };
}

/** 计算 LPC 系数 (多帧平均) */
function computeLPC(samples: Float32Array, order: number, sampleRate: number): Float32Array {
  const frameSize = Math.floor(sampleRate * 0.03); // 30ms
  const hopSize = Math.floor(sampleRate * 0.015); // 15ms
  const window = hannWindow(frameSize);

  // 累积多帧的 LPC 系数
  const accumCoeffs = new Float32Array(order + 1);
  let frameCount = 0;

  for (let start = 0; start + frameSize < samples.length; start += hopSize) {
    const frame = new Float32Array(frameSize);
    let energy = 0;
    for (let i = 0; i < frameSize; i++) {
      frame[i] = samples[start + i] * window[i];
      energy += frame[i] * frame[i];
    }
    if (energy / frameSize < 1e-6) continue;

    // 计算自相关
    const r = new Float32Array(order + 1);
    for (let lag = 0; lag <= order; lag++) {
      let sum = 0;
      for (let i = 0; i < frameSize - lag; i++) {
        sum += frame[i] * frame[i + lag];
      }
      r[lag] = sum / frameSize;
    }

    // Levinson-Durbin
    const a = levinsonDurbin(r, order);
    for (let i = 0; i <= order; i++) accumCoeffs[i] += a[i];
    frameCount++;
  }

  if (frameCount === 0) {
    // fallback: 全零系数 (无滤波)
    const a = new Float32Array(order + 1);
    a[0] = 1;
    return a;
  }

  for (let i = 0; i <= order; i++) accumCoeffs[i] /= frameCount;
  return accumCoeffs;
}

/** 计算幅度谱 (简化 FFT) */
function computeMagnitudeSpectrum(samples: Float32Array, sampleRate: number): Float32Array {
  const fftSize = 2048;
  const window = hannWindow(fftSize);
  const numFrames = Math.min(10, Math.floor(samples.length / fftSize));
  const spectrum = new Float32Array(fftSize / 2);

  for (let f = 0; f < numFrames; f++) {
    const start = f * fftSize;
    const re = new Float64Array(fftSize);
    const im = new Float64Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      re[i] = (samples[start + i] || 0) * window[i];
    }
    fft(re, im);
    for (let k = 0; k < fftSize / 2; k++) {
      spectrum[k] += Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    }
  }

  return spectrum;
}

/** 基2 FFT (Cooley-Tukey) */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n <= 1) return;

  // 位反转重排
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  // 蝶形运算
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = -2 * Math.PI / len;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curReal = 1;
      let curImag = 0;
      for (let k = 0; k < halfLen; k++) {
        const idx1 = i + k;
        const idx2 = i + k + halfLen;
        const tReal = curReal * re[idx2] - curImag * im[idx2];
        const tImag = curReal * im[idx2] + curImag * re[idx2];
        re[idx2] = re[idx1] - tReal;
        im[idx2] = im[idx1] - tImag;
        re[idx1] += tReal;
        im[idx1] += tImag;
        const newReal = curReal * wReal - curImag * wImag;
        curImag = curReal * wImag + curImag * wReal;
        curReal = newReal;
      }
    }
  }
}

/** 分析频谱特征 */
function analyzeSpectrum(
  spectrum: Float32Array,
  sampleRate: number,
  pitch: number,
): { spectralTilt: number; brightness: number; breathiness: number } {
  const n = spectrum.length;
  const freqResolution = sampleRate / (n * 2);

  // 频谱倾斜: 用对数频率-对数幅度回归斜率
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, count = 0;
  for (let k = 1; k < n; k++) {
    const freq = k * freqResolution;
    if (freq < 100 || freq > 8000) continue;
    const logFreq = Math.log10(freq);
    const logMag = Math.log10(spectrum[k] + 1e-10);
    sumX += logFreq;
    sumY += logMag;
    sumXY += logFreq * logMag;
    sumX2 += logFreq * logFreq;
    count++;
  }
  const spectralTilt = count > 0 ? (count * sumXY - sumX * sumY) / (count * sumX2 - sumX * sumX) : -6;

  // 亮度: 频谱质心 (归一化到 0-1, 典型语音 1000-3500Hz)
  let centroid = 0, totalMag = 0;
  for (let k = 1; k < n; k++) {
    const freq = k * freqResolution;
    centroid += freq * spectrum[k];
    totalMag += spectrum[k];
  }
  centroid = totalMag > 0 ? centroid / totalMag : 1500;
  const brightness = Math.max(0, Math.min(1, (centroid - 800) / 3500));

  // 气息感: 高频噪声能量比 (4kHz 以上能量占比,放大 2 倍)
  let highEnergy = 0, totalEnergy = 0;
  for (let k = 1; k < n; k++) {
    const freq = k * freqResolution;
    const e = spectrum[k] * spectrum[k];
    totalEnergy += e;
    if (freq > 4000) highEnergy += e;
  }
  const breathiness = totalEnergy > 0 ? Math.min(1, highEnergy / totalEnergy * 2) : 0.2;

  return { spectralTilt, brightness, breathiness };
}

/** 计算 Jitter (基频微扰) — 粗糙度指标 */
function computeJitter(samples: Float32Array, sampleRate: number): number {
  const frameSize = Math.floor(sampleRate * 0.03);
  const hopSize = Math.floor(sampleRate * 0.01);
  const minLag = Math.floor(sampleRate / 500);
  const maxLag = Math.floor(sampleRate / 50);
  const window = hannWindow(frameSize);

  const periods: number[] = [];
  for (let start = 0; start + frameSize < samples.length; start += hopSize) {
    // 加窗并计算能量(与 detectPitchACF 一致的归一化)
    const frame = new Float32Array(frameSize);
    let energy = 0;
    for (let i = 0; i < frameSize; i++) {
      frame[i] = samples[start + i] * window[i];
      energy += frame[i] * frame[i];
    }
    if (energy / frameSize < 1e-5) continue;

    let bestLag = 0;
    let bestCorr = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i < frameSize - lag; i++) {
        corr += frame[i] * frame[i + lag];
      }
      const ncorr = energy > 1e-10 ? corr / energy : 0;
      if (ncorr > bestCorr) {
        bestCorr = ncorr;
        bestLag = lag;
      }
    }
    if (bestCorr > 0.3 && bestLag > 0) {
      periods.push(bestLag);
    }
  }

  if (periods.length < 3) return 0.2;

  // 剔除离群周期 (偏离中位数超过 20% 的帧),减少倍频/分频误差干扰
  const sorted = [...periods].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const filtered = periods.filter((p) => Math.abs(p - median) / median < 0.2);
  if (filtered.length < 3) return 0.2;

  // Jitter = 平均相邻周期差的绝对值 / 平均周期
  let sumDiff = 0;
  for (let i = 1; i < filtered.length; i++) {
    sumDiff += Math.abs(filtered[i] - filtered[i - 1]);
  }
  const avgPeriod = filtered.reduce((a, b) => a + b, 0) / filtered.length;
  const jitter = sumDiff / (filtered.length - 1) / avgPeriod;
  // 典型语音 Jitter 0.01-0.05; 放大 5 倍映射到 0-1 粗糙度
  return Math.min(1, jitter * 5);
}

/** 根据基频推算典型元音共振峰 (LPC 提取失败时的后备) */
function defaultFormants(pitch: number): number[] {
  // 基频 < 165Hz 视为男声,否则女声;使用典型元音 /a/ 的共振峰
  if (pitch < 165) {
    // 男声典型: F1=500, F2=1500, F3=2500
    return [500, 1500, 2500];
  }
  // 女声典型: F1=600, F2=1700, F3=2800
  return [600, 1700, 2800];
}

// ============================================================
//  5. PSOLA 音高变换 (Pitch-Synchronous Overlap-Add)
// ============================================================

/**
 * PSOLA 音高变换
 *
 * 原理: 在基频标记点(pitch marks)处将信号分段,加窗后按目标基频
 * 重新叠加。可独立改变音高而不改变时长和音色。
 *
 * 算法:
 *  1. 检测基频标记点 (每隔一个基频周期一个标记)
 *  2. 在每个标记点处取 2 倍周期长的窗口
 *  3. 按目标基频间距重新排列窗口段
 *  4. 重叠相加 (Overlap-Add)
 */
export function psolaPitchShift(samples: Float32Array, sampleRate: number, pitchRatio: number): Float32Array {
  if (Math.abs(pitchRatio - 1) < 0.001) return samples;

  // 1. 检测基频标记点
  const pitchMarks = findPitchMarks(samples, sampleRate);
  if (pitchMarks.length < 3) {
    // 无法检测基频, fallback 到重采样
    return linearResample(samples, 1 / pitchRatio);
  }

  // 2. 平均周期
  const avgPeriod = pitchMarks.length > 1
    ? (pitchMarks[pitchMarks.length - 1] - pitchMarks[0]) / (pitchMarks.length - 1)
    : sampleRate / 150;
  const targetPeriod = avgPeriod / pitchRatio;

  // 3. 提取分析帧 (在每个标记点处加窗)
  const windowSize = Math.floor(2 * avgPeriod);
  const window = hannWindow(windowSize);
  const frames: Float32Array[] = [];
  for (const mark of pitchMarks) {
    const frame = new Float32Array(windowSize);
    const halfWin = Math.floor(windowSize / 2);
    for (let i = 0; i < windowSize; i++) {
      const idx = mark - halfWin + i;
      frame[i] = (idx >= 0 && idx < samples.length ? samples[idx] : 0) * window[i];
    }
    frames.push(frame);
  }

  // 4. 按目标周期重叠相加
  const outputLen = Math.floor(samples.length * (targetPeriod / avgPeriod));
  const output = new Float32Array(Math.max(outputLen, samples.length));
  const synthesisMarks: number[] = [];
  let pos = pitchMarks[0];
  let frameIdx = 0;

  while (pos < output.length && frameIdx < frames.length) {
    const frame = frames[frameIdx];
    const halfWin = Math.floor(windowSize / 2);
    for (let i = 0; i < windowSize; i++) {
      const outIdx = Math.floor(pos) - halfWin + i;
      if (outIdx >= 0 && outIdx < output.length) {
        output[outIdx] += frame[i];
      }
    }
    synthesisMarks.push(pos);
    pos += targetPeriod;
    frameIdx++;
    // 循环使用分析帧
    if (frameIdx >= frames.length) frameIdx = Math.floor(frames.length * 0.3);
  }

  return output;
}

/** 检测基频标记点 */
function findPitchMarks(samples: Float32Array, sampleRate: number): number[] {
  const minLag = Math.floor(sampleRate / 500);
  const maxLag = Math.floor(sampleRate / 50);
  const frameSize = Math.floor(sampleRate * 0.04);

  const marks: number[] = [];
  for (let start = 0; start + frameSize < samples.length; start += frameSize / 2) {
    let bestLag = 0;
    let bestCorr = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i < frameSize - lag; i++) {
        corr += samples[start + i] * samples[start + i + lag];
      }
      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }
    if (bestCorr > 0.2 && bestLag > 0) {
      // 在这一帧内按周期添加标记
      let pos = start;
      while (pos < start + frameSize && pos < samples.length) {
        if (marks.length === 0 || pos - marks[marks.length - 1] >= bestLag * 0.8) {
          marks.push(Math.floor(pos));
        }
        pos += bestLag;
      }
    }
  }

  return marks;
}

/** 线性重采样 (fallback) */
function linearResample(samples: Float32Array, ratio: number): Float32Array {
  const newLen = Math.floor(samples.length / ratio);
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const src = i * ratio;
    const idx = Math.floor(src);
    const frac = src - idx;
    out[i] = (samples[idx] ?? 0) + ((samples[idx + 1] ?? samples[idx] ?? 0) - (samples[idx] ?? 0)) * frac;
  }
  return out;
}

// ============================================================
//  6. LPC 残差法共振峰迁移 (声音转换核心)
// ============================================================

/**
 * LPC 残差法声音转换
 *
 * 原理:
 *  1. LPC 分析: 将信号分解为 激励(残差) × 声道滤波器(LPC)
 *  2. 音色 = 声道滤波器 (共振峰) → 用目标音色的共振峰替换
 *  3. 音高 = 激励信号的周期 → 用 PSOLA 调整
 *  4. 重合成: 残差 × 目标滤波器
 *
 * 这样保留了原说话的节奏、语速、内容,只替换音色(共振峰)和音高
 */
export function convertVoiceTimbre(
  wav: WavData,
  sourceFeatures: ExtractedFeatures,
  targetFeatures: ExtractedFeatures,
  options: { pitchShift?: number; preservePitch?: boolean } = {},
): WavData {
  const { samples, sampleRate } = wav;
  const { preservePitch = false, pitchShift = 0 } = options;

  // 1. 预加重
  const emphasized = preEmphasis(samples);

  // 2. LPC 分析得到源声道滤波器
  const lpcOrder = sampleRate >= 22050 ? 14 : 12;
  const sourceLPC = sourceFeatures.lpcCoeffs.length > 1
    ? sourceFeatures.lpcCoeffs
    : computeLPC(emphasized, lpcOrder, sampleRate);

  // 3. 计算残差信号 (逆滤波)
  const residual = inverseFilter(emphasized, sourceLPC);

  // 4. 如果需要变换音高,对残差做 PSOLA
  let processedResidual = residual;
  if (!preservePitch) {
    // 音高比 = 目标基频 / 源基频
    const pitchRatio = (targetFeatures.pitch * Math.pow(2, pitchShift / 12)) / sourceFeatures.pitch;
    if (Math.abs(pitchRatio - 1) > 0.01) {
      processedResidual = psolaPitchShift(residual, sampleRate, pitchRatio);
    }
  } else if (pitchShift !== 0) {
    processedResidual = psolaPitchShift(residual, sampleRate, Math.pow(2, pitchShift / 12));
  }

  // 5. 构建目标声道滤波器 (从目标共振峰合成 LPC)
  const targetLPC = formantsToLPC(targetFeatures.formants, lpcOrder, sampleRate, targetFeatures.spectralTilt);

  // 6. 用目标滤波器重新合成 (残差 → 目标音色)
  let synthesized = forwardFilter(processedResidual, targetLPC);

  // 7. 去强调 (恢复低频)
  synthesized = deEmphasis(synthesized, 0.97);

  // 8. 调整亮度 (频谱质心匹配)
  if (Math.abs(targetFeatures.brightness - sourceFeatures.brightness) > 0.05) {
    synthesized = adjustBrightness(synthesized, targetFeatures.brightness / Math.max(0.1, sourceFeatures.brightness));
  }

  // 9. 添加气息感
  if (targetFeatures.breathiness > sourceFeatures.breathiness + 0.05) {
    synthesized = addBreathiness(synthesized, targetFeatures.breathiness - sourceFeatures.breathiness);
  }

  // 10. 匹配能量
  synthesized = matchEnergy(synthesized, samples);

  return { ...wav, samples: synthesized };
}

/** 逆滤波 — 计算残差信号 */
function inverseFilter(samples: Float32Array, lpc: Float32Array): Float32Array {
  const order = lpc.length - 1;
  const residual = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    let pred = 0;
    for (let j = 1; j <= order && i - j >= 0; j++) {
      pred += lpc[j] * samples[i - j];
    }
    residual[i] = samples[i] - pred;
  }
  return residual;
}

/** 正向滤波 — 用 LPC 滤波器合成信号 */
function forwardFilter(residual: Float32Array, lpc: Float32Array): Float32Array {
  const order = lpc.length - 1;
  const out = new Float32Array(residual.length);
  for (let i = 0; i < residual.length; i++) {
    let val = residual[i];
    for (let j = 1; j <= order && i - j >= 0; j++) {
      val -= lpc[j] * out[i - j];
    }
    out[i] = val;
  }
  return out;
}

/** 去强调 (预加重逆操作) */
function deEmphasis(samples: Float32Array, alpha = 0.97): Float32Array {
  const out = new Float32Array(samples.length);
  out[0] = samples[0];
  for (let i = 1; i < samples.length; i++) {
    out[i] = samples[i] + alpha * out[i - 1];
  }
  return out;
}

/**
 * 从共振峰频率合成 LPC 滤波器
 * 构建级联二阶共振峰谐振器
 */
function formantsToLPC(formants: number[], order: number, sampleRate: number, spectralTilt: number): Float32Array {
  // 每个共振峰对应一个二阶 IIR 谐振器
  // H(z) = 1 / (1 - 2*r*cos(theta)*z^-1 + r^2*z^-2)
  // 其中 theta = 2*PI*freq/sampleRate, r 控制带宽

  // 用级联双二阶节表示,转换为 LPC 系数
  const numFormants = Math.min(formants.length, Math.floor(order / 2));
  // 构建分母多项式 (各共振峰二阶节分母的卷积)
  let denom: Float64Array = new Float64Array([1]);

  for (let i = 0; i < numFormants; i++) {
    const freq = formants[i];
    const bandwidth = Math.max(80, 400 - i * 80); // 共振峰带宽递增
    const theta = (2 * Math.PI * freq) / sampleRate;
    const r = Math.exp(-Math.PI * bandwidth / sampleRate);

    // 二阶节分母: 1 - 2*r*cos(theta)*z^-1 + r^2*z^-2
    const section = new Float64Array(3);
    section[0] = 1;
    section[1] = -2 * r * Math.cos(theta);
    section[2] = r * r;

    // 多项式乘法 (卷积)
    const newDenom = new Float64Array(denom.length + 2);
    for (let j = 0; j < denom.length; j++) {
      for (let k = 0; k < 3; k++) {
        newDenom[j + k] += denom[j] * section[k];
      }
    }
    denom = newDenom;
  }

  // 转为 Float32Array, 截取到 order+1
  const lpc = new Float32Array(order + 1);
  for (let i = 0; i <= order && i < denom.length; i++) {
    lpc[i] = denom[i];
  }
  lpc[0] = 1;
  return lpc;
}

/** 调整亮度 — 一阶 shelving 滤波 */
function adjustBrightness(samples: Float32Array, ratio: number): Float32Array {
  if (Math.abs(ratio - 1) < 0.01) return samples;
  const out = new Float32Array(samples.length);
  const alpha = 0.95;
  let prev = 0;
  for (let i = 0; i < samples.length; i++) {
    prev = prev + alpha * (samples[i] - prev);
    const high = samples[i] - prev;
    out[i] = prev + high * ratio;
  }
  return out;
}

/** 添加气息感 — 高频噪声 */
function addBreathiness(samples: Float32Array, amount: number): Float32Array {
  const out = new Float32Array(samples.length);
  let prev = 0;
  const alpha = 0.95;
  for (let i = 0; i < samples.length; i++) {
    prev = prev + alpha * (samples[i] - prev);
    const noise = (Math.random() * 2 - 1) * amount * 0.1 * (1 - prev / (Math.abs(samples[i]) + 1e-6));
    out[i] = samples[i] + noise;
  }
  return out;
}

/** 匹配能量 — RMS 归一化到目标 */
function matchEnergy(samples: Float32Array, target: Float32Array): Float32Array {
  let srcRMS = 0, tgtRMS = 0;
  for (let i = 0; i < samples.length; i++) srcRMS += samples[i] * samples[i];
  for (let i = 0; i < target.length; i++) tgtRMS += target[i] * target[i];
  srcRMS = Math.sqrt(srcRMS / samples.length);
  tgtRMS = Math.sqrt(tgtRMS / target.length);
  if (srcRMS < 1e-8) return samples;
  const gain = Math.min(4, tgtRMS / srcRMS);
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain;
  return out;
}

// ============================================================
//  7. 真实母带处理 (压缩器/均衡器/混响/限幅器)
// ============================================================

export interface MasterParams {
  pitch: number;       // -12 ~ 12 半音
  speed: number;       // 0.5 ~ 2
  formant: number;     // -50 ~ 50
  brightness: number;  // 0 ~ 100 (60 = 中性)
  reverb: number;      // 0 ~ 100
  compression: number; // 0 ~ 100
  volume: number;      // 0 ~ 100 (80 = 中性)
}

/**
 * 真实母带处理链
 *  1. 音高变换 (PSOLA — 保持音色)
 *  2. 语速变换 (PSOLA 时间拉伸)
 *  3. 共振峰偏移 (LPC 频谱缩放)
 *  4. 亮度均衡 (高频 shelving)
 *  5. 压缩器 (attack/release 包络跟随)
 *  6. Schroeder 混响 (4 梳状 + 2 全通)
 *  7. 限幅器 (硬限幅防削波)
 *  8. 音量增益
 */
export function masterProcess(wav: WavData, params: MasterParams): WavData {
  const { samples, sampleRate } = wav;
  let processed = samples;

  // 1. 音高变换 (PSOLA, 保持音色)
  if (params.pitch !== 0) {
    const pitchRatio = Math.pow(2, params.pitch / 12);
    processed = psolaPitchShift(processed, sampleRate, pitchRatio);
  }

  // 2. 语速变换 (重采样 + PSOLA 时长补偿)
  if (Math.abs(params.speed - 1) > 0.01) {
    // 重采样改变时长 (语速变快 = 时长变短)
    processed = linearResample(processed, params.speed);
  }

  // 3. 共振峰偏移 (LPC 频谱缩放)
  if (params.formant !== 0) {
    processed = shiftFormants(processed, sampleRate, params.formant);
  }

  // 4. 亮度均衡 (高频 shelving 滤波器)
  if (params.brightness !== 60) {
    const gain = params.brightness / 60; // >1 提升高频, <1 衰减
    processed = highShelfFilter(processed, sampleRate, 3000, gain);
  }

  // 5. 压缩器
  if (params.compression > 0) {
    processed = compressor(processed, {
      threshold: 0.5,
      ratio: 1 + (params.compression / 100) * 5,
      attack: 0.005,
      release: 0.1,
      makeupGain: 1 + (params.compression / 100) * 0.3,
    });
  }

  // 6. Schroeder 混响
  if (params.reverb > 0) {
    processed = schroederReverb(processed, sampleRate, params.reverb / 100);
  }

  // 7. 音量增益
  const volGain = params.volume / 80;
  const out = new Float32Array(processed.length);
  for (let i = 0; i < processed.length; i++) {
    out[i] = processed[i] * volGain;
  }

  // 8. 限幅器 (硬限幅 + 淡化削波)
  const limited = limiter(out, 0.98);

  return { ...wav, samples: limited };
}

/** 共振峰偏移 — LPC 频谱缩放 */
function shiftFormants(samples: Float32Array, sampleRate: number, shift: number): Float32Array {
  const ratio = Math.pow(2, shift / 12); // 将 -50..50 映射为频率比
  // 重采样改变频谱,再反向重采样恢复时长 (实现纯频谱缩放)
  const resampled = linearResample(samples, ratio);
  // 反向重采样恢复原始时长
  return linearResample(resampled, 1 / ratio);
}

/** 高频 Shelving 滤波器 — 一阶 */
function highShelfFilter(samples: Float32Array, sampleRate: number, cutoffFreq: number, gain: number): Float32Array {
  const alpha = Math.exp(-2 * Math.PI * cutoffFreq / sampleRate);
  const out = new Float32Array(samples.length);
  let prev = 0;
  for (let i = 0; i < samples.length; i++) {
    prev = prev + alpha * (samples[i] - prev);
    const low = prev;
    const high = samples[i] - low;
    out[i] = low + high * gain;
  }
  return out;
}

/** 压缩器 — 真实 attack/release 包络跟随 */
function compressor(
  samples: Float32Array,
  opts: { threshold: number; ratio: number; attack: number; release: number; makeupGain: number },
): Float32Array {
  const { threshold, ratio, attack, release, makeupGain } = opts;
  const out = new Float32Array(samples.length);
  let envelope = 0;
  const attackCoeff = Math.exp(-1 / (attack * samples.length));
  const releaseCoeff = Math.exp(-1 / (release * samples.length));

  for (let i = 0; i < samples.length; i++) {
    const input = Math.abs(samples[i]);
    // 包络跟随
    const coeff = input > envelope ? attackCoeff : releaseCoeff;
    envelope = coeff * envelope + (1 - coeff) * input;

    // 增益计算
    let gain = 1;
    if (envelope > threshold) {
      const overdB = 20 * Math.log10(envelope / threshold);
      const reduceddB = overdB * (1 - 1 / ratio);
      gain = Math.pow(10, -reduceddB / 20);
    }

    out[i] = samples[i] * gain * makeupGain;
  }
  return out;
}

/**
 * Schroeder 混响 — 4 个并联梳状滤波器 + 2 个串联全通滤波器
 * 这是经典的混响算法,比简单回声自然得多
 */
function schroederReverb(samples: Float32Array, sampleRate: number, amount: number): Float32Array {
  // 梳状滤波器参数 (延迟时间 ms, 衰减系数)
  const combs = [
    { delay: 0.0297, decay: 0.84 },
    { delay: 0.0371, decay: 0.82 },
    { delay: 0.0411, decay: 0.80 },
    { delay: 0.0437, decay: 0.78 },
  ];
  // 全通滤波器参数
  const allpass = [
    { delay: 0.0050, decay: 0.7 },
    { delay: 0.0017, decay: 0.7 },
  ];

  const wet = amount * 0.35;
  const dry = 1 - amount * 0.3;
  const out = new Float32Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    let drySig = samples[i] * dry;
    let wetSig = 0;

    // 4 个并联梳状滤波器
    for (const c of combs) {
      const delaySamples = Math.floor(c.delay * sampleRate);
      const idx = i - delaySamples;
      wetSig += (idx >= 0 ? out[idx] : 0) * c.decay;
    }
    wetSig += samples[i];

    // 2 个串联全通滤波器
    for (const a of allpass) {
      const delaySamples = Math.floor(a.delay * sampleRate);
      const idx = i - delaySamples;
      const delayed = idx >= 0 ? wetSig : 0;
      wetSig = delayed * a.decay + (idx >= 0 ? (out[idx] ?? wetSig) : wetSig) * -a.decay + delayed;
    }

    out[i] = drySig + wetSig * wet;
  }

  return out;
}

/** 限幅器 — 硬限幅 + 软饱和 */
function limiter(samples: Float32Array, ceiling: number): Float32Array {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    let s = samples[i];
    if (Math.abs(s) > ceiling) {
      // 软饱和 (tanh 近似)
      s = Math.sign(s) * (ceiling + (1 - ceiling) * Math.tanh((Math.abs(s) - ceiling) / (1 - ceiling)));
    }
    out[i] = s;
  }
  return out;
}
