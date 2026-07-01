/**
 * 前端 API 客户端
 */
import type {
  AudioParameters,
  ApiResult,
  ConvertRequestPayload,
  Emotion,
  TTSRequestPayload,
  VoiceListResponse,
  VoiceProfile,
} from '@shared/types';

const BASE = '/api';

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${input}`, init);
  const data = (await res.json()) as ApiResult<T>;
  if (!res.ok || !data.success) {
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return data.data as T;
}

function formData(fields: Record<string, string | File | undefined>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) fd.append(k, v);
  }
  return fd;
}

// ---------- 音色库 ----------
export const api = {
  async listVoices(filter?: { source?: 'preset' | 'cloned'; keyword?: string }): Promise<VoiceListResponse> {
    const qs = new URLSearchParams();
    if (filter?.source) qs.set('source', filter.source);
    if (filter?.keyword) qs.set('keyword', filter.keyword);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<VoiceListResponse>(`/voices${suffix}`);
  },

  async getVoice(id: string): Promise<VoiceProfile> {
    return request<VoiceProfile>(`/voices/${id}`);
  },

  async updateVoice(id: string, patch: Partial<VoiceProfile>): Promise<VoiceProfile> {
    return request<VoiceProfile>(`/voices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  },

  async deleteVoice(id: string): Promise<void> {
    await request<void>(`/voices/${id}`, { method: 'DELETE' });
  },

  async toggleFavorite(id: string): Promise<VoiceProfile> {
    return request<VoiceProfile>(`/voices/${id}/favorite`, { method: 'POST' });
  },

  voiceSampleUrl(id: string): string {
    return `${BASE}/voices/${id}/sample`;
  },

  // ---------- 音色克隆 ----------
  async cloneVoice(input: {
    file: File;
    name: string;
    tags: string;
    description?: string;
    gender?: 'male' | 'female' | 'neutral';
    language?: string;
  }): Promise<VoiceProfile> {
    const fd = formData({
      file: input.file,
      name: input.name,
      tags: input.tags,
      description: input.description,
      gender: input.gender,
      language: input.language,
    });
    return request<VoiceProfile>('/clone', { method: 'POST', body: fd });
  },

  // ---------- 声音转换 ----------
  async convertVoice(input: {
    file: File;
    payload: ConvertRequestPayload;
  }): Promise<{
    jobId: string;
    status: 'completed';
    outputPath: string;
    duration: number;
  }> {
    const fd = formData({
      file: input.file,
      targetVoiceId: input.payload.targetVoiceId,
      options: JSON.stringify(input.payload.options || {}),
    });
    return request('/convert', { method: 'POST', body: fd });
  },

  // ---------- TTS ----------
  async synthesizeTTS(payload: TTSRequestPayload): Promise<{
    jobId: string;
    status: 'completed';
    outputPath: string;
    duration: number;
  }> {
    return request('/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  // ---------- 输出文件 ----------
  outputUrl(type: 'convert' | 'tts', filename: string): string {
    return `${BASE}/output/${type}/${filename}`;
  },

  // ---------- 引擎状态 ----------
  async getProviderStatus(): Promise<{
    provider: string;
    configured: boolean;
    capabilities: { convert: boolean; tts: boolean };
  }> {
    return request('/provider');
  },
};

export type { AudioParameters, Emotion, VoiceProfile };
