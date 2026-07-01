/**
 * 内存文件存储 — Vercel Serverless 环境
 * 文件存储在内存中，重启后丢失
 */
import type { WavData } from '../services/wavUtils.js';

// 内存文件存储
const files = new Map<string, Buffer>();

export function ensureDirs(): void {
  // 内存存储无需创建目录
}

export function saveUpload(file: Express.Multer.File, kind: 'sample' | 'recording'): string {
  const filename = `${Date.now()}_${file.originalname}`;
  const path = `uploads/${kind}/${filename}`;
  files.set(path, file.buffer);
  return path;
}

export function saveOutput(buffer: Buffer, type: 'convert' | 'tts', name: string): string {
  const filename = `${name}.wav`;
  const path = `outputs/${type}/${filename}`;
  files.set(path, buffer);
  return path;
}

export function getFile(path: string): Buffer | undefined {
  return files.get(path);
}

export function deleteFile(path: string): void {
  files.delete(path);
}

export function resolvePath(relativePath: string): string {
  return relativePath;
}
