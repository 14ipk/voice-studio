/**
 * 音色库状态管理
 */
import { create } from 'zustand';
import { api } from '@/lib/api';
import type { VoiceProfile } from '@shared/types';

interface VoiceStore {
  voices: VoiceProfile[];
  loading: boolean;
  loaded: boolean;
  error?: string;
  fetchVoices: () => Promise<void>;
  refresh: () => Promise<void>;
  removeVoice: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  updateVoiceMeta: (id: string, patch: Partial<VoiceProfile>) => Promise<void>;
  getById: (id: string) => VoiceProfile | undefined;
}

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  voices: [],
  loading: false,
  loaded: false,
  error: undefined,

  fetchVoices: async () => {
    set({ loading: true, error: undefined });
    try {
      const res = await api.listVoices();
      set({ voices: res.voices, loading: false, loaded: true });
    } catch (err) {
      set({
        loading: false,
        loaded: true,
        error: err instanceof Error ? err.message : '加载失败',
      });
    }
  },

  refresh: async () => {
    try {
      const res = await api.listVoices();
      set({ voices: res.voices, loaded: true });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '刷新失败' });
    }
  },

  removeVoice: async (id) => {
    await api.deleteVoice(id);
    set((s) => ({ voices: s.voices.filter((v) => v.id !== id) }));
  },

  toggleFavorite: async (id) => {
    const updated = await api.toggleFavorite(id);
    set((s) => ({
      voices: s.voices.map((v) => (v.id === id ? updated : v)),
    }));
  },

  updateVoiceMeta: async (id, patch) => {
    const updated = await api.updateVoice(id, patch);
    set((s) => ({
      voices: s.voices.map((v) => (v.id === id ? updated : v)),
    }));
  },

  getById: (id) => get().voices.find((v) => v.id === id),
}));
