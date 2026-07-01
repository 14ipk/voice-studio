/**
 * JSON 文件数据库 — 用于音色元数据与任务记录
 * 采用文件读写 + 简易内存缓存,适合演示场景
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { JobRecord, VoiceProfile } from '@shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 生产环境 (Render.com) 使用持久化磁盘 DATA_DIR;开发环境回退到项目根
const ROOT = process.env.DATA_DIR || path.resolve(__dirname, '..', '..');

const VOICES_FILE = path.join(ROOT, 'data', 'voices.json');
const JOBS_FILE = path.join(ROOT, 'data', 'jobs.json');

interface VoicesDBShape {
  voices: VoiceProfile[];
}

interface JobsDBShape {
  jobs: JobRecord[];
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      ensureDir(filePath);
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf-8');
      return fallback;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`[jsonDB] read ${filePath} failed:`, err);
    return fallback;
  }
}

function writeJson<T>(filePath: string, data: T) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------- 音色库 ----------
export function loadVoices(): VoiceProfile[] {
  const db = readJson<VoicesDBShape>(VOICES_FILE, { voices: [] });
  return db.voices;
}

export function saveVoices(voices: VoiceProfile[]) {
  writeJson<VoicesDBShape>(VOICES_FILE, { voices });
}

export function upsertVoice(voice: VoiceProfile) {
  const voices = loadVoices();
  const idx = voices.findIndex((v) => v.id === voice.id);
  if (idx >= 0) {
    voices[idx] = voice;
  } else {
    voices.push(voice);
  }
  saveVoices(voices);
}

export function deleteVoiceById(id: string): boolean {
  const voices = loadVoices();
  const next = voices.filter((v) => v.id !== id);
  if (next.length === voices.length) return false;
  saveVoices(next);
  return true;
}

export function findVoice(id: string): VoiceProfile | undefined {
  return loadVoices().find((v) => v.id === id);
}

// ---------- 任务记录 ----------
export function loadJobs(): JobRecord[] {
  const db = readJson<JobsDBShape>(JOBS_FILE, { jobs: [] });
  return db.jobs;
}

export function saveJobs(jobs: JobRecord[]) {
  writeJson<JobsDBShape>(JOBS_FILE, { jobs });
}

export function upsertJob(job: JobRecord) {
  const jobs = loadJobs();
  const idx = jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) {
    jobs[idx] = job;
  } else {
    jobs.push(job);
  }
  saveJobs(jobs);
}

export function findJob(id: string): JobRecord | undefined {
  return loadJobs().find((j) => j.id === id);
}

export const PATHS = {
  ROOT,
  VOICES_FILE,
  JOBS_FILE,
  UPLOADS_SAMPLES: path.join(ROOT, 'uploads', 'samples'),
  UPLOADS_RECORDINGS: path.join(ROOT, 'uploads', 'recordings'),
  OUTPUTS_CONVERT: path.join(ROOT, 'outputs', 'convert'),
  OUTPUTS_TTS: path.join(ROOT, 'outputs', 'tts'),
};
