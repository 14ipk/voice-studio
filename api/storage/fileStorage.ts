/**
 * 文件系统存储助手 — 处理上传与输出文件
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from './jsonDB.js';

export function ensureDirs() {
  const dirs = [
    PATHS.UPLOADS_SAMPLES,
    PATHS.UPLOADS_RECORDINGS,
    PATHS.OUTPUTS_CONVERT,
    PATHS.OUTPUTS_TTS,
    path.dirname(PATHS.VOICES_FILE),
    path.dirname(PATHS.JOBS_FILE),
  ];
  for (const d of dirs) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

/** 保存上传文件到指定目录,返回相对路径用于持久化 */
export function saveUpload(file: Express.Multer.File, kind: 'sample' | 'recording'): string {
  const dir = kind === 'sample' ? PATHS.UPLOADS_SAMPLES : PATHS.UPLOADS_RECORDINGS;
  ensureDirs();
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueName = `${Date.now()}_${safeName}`;
  const fullPath = path.join(dir, uniqueName);
  fs.writeFileSync(fullPath, file.buffer);
  return path.relative(PATHS.ROOT, fullPath).split(path.sep).join('/');
}

/** 保存生成的 WAV Buffer 到输出目录 */
export function saveOutput(buffer: Buffer, type: 'convert' | 'tts', name: string): string {
  const dir = type === 'convert' ? PATHS.OUTPUTS_CONVERT : PATHS.OUTPUTS_TTS;
  ensureDirs();
  const safeName = `${name}.wav`;
  const fullPath = path.join(dir, safeName);
  fs.writeFileSync(fullPath, buffer);
  return path.relative(PATHS.ROOT, fullPath).split(path.sep).join('/');
}

/** 将相对路径转为绝对路径 */
export function resolvePath(relativePath: string): string {
  return path.join(PATHS.ROOT, relativePath);
}

/** 删除文件(若存在) */
export function deleteFile(relativePath: string) {
  try {
    const abs = resolvePath(relativePath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (err) {
    console.error('[fileStorage] delete failed:', err);
  }
}

/** 获取文件大小(字节) */
export function getFileSize(relativePath: string): number {
  try {
    const abs = resolvePath(relativePath);
    return fs.statSync(abs).size;
  } catch {
    return 0;
  }
}
