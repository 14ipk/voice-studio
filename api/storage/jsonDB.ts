/**
 * 内存存储层 — Vercel Serverless 环境
 * 预设音色硬编码，用户数据重启后丢失
 */
import type { VoiceProfile, JobRecord } from '@shared/types.js';

// 内存存储
let voices: VoiceProfile[] = [];
let jobs: JobRecord[] = [];

// ---------- 音色库 ----------
export function loadVoices(): VoiceProfile[] {
  return voices;
}

export function saveVoices(newVoices: VoiceProfile[]): void {
  voices = newVoices;
}

export function upsertVoice(voice: VoiceProfile): void {
  const idx = voices.findIndex((v) => v.id === voice.id);
  if (idx >= 0) {
    voices[idx] = voice;
  } else {
    voices.push(voice);
  }
}

export function deleteVoiceById(id: string): boolean {
  const next = voices.filter((v) => v.id !== id);
  if (next.length === voices.length) return false;
  voices = next;
  return true;
}

export function findVoice(id: string): VoiceProfile | undefined {
  return voices.find((v) => v.id === id);
}

// ---------- 任务记录 ----------
export function loadJobs(): JobRecord[] {
  return jobs;
}

export function saveJobs(newJobs: JobRecord[]): void {
  jobs = newJobs;
}

export function upsertJob(job: JobRecord): void {
  const idx = jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) {
    jobs[idx] = job;
  } else {
    jobs.push(job);
  }
}

export function findJob(id: string): JobRecord | undefined {
  return jobs.find((j) => j.id === id);
}
