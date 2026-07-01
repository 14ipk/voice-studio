/**
 * 音频播放 Hook — 全局单例,避免多实例冲突
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { audioEngine } from '@/lib/audioEngine';
import type { AudioParameters } from '@shared/types';

interface PlayState {
  url: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  error?: string;
}

const initialState: PlayState = {
  url: null,
  isPlaying: false,
  isLoading: false,
  currentTime: 0,
  duration: 0,
};

export function useAudioPlayer() {
  const [state, setState] = useState<PlayState>(initialState);
  const handleRef = useRef<{ stop: () => void; duration: number } | null>(null);

  const stop = useCallback(() => {
    if (handleRef.current) {
      handleRef.current.stop();
      handleRef.current = null;
    }
    setState((s) => ({ ...s, isPlaying: false, currentTime: 0 }));
  }, []);

  const play = useCallback(async (url: string, params?: AudioParameters) => {
    stop();
    setState({
      url,
      isPlaying: false,
      isLoading: true,
      currentTime: 0,
      duration: 0,
      error: undefined,
    });
    try {
      const handle = await audioEngine.play({
        url,
        params,
        onReady: (duration) => {
          setState((s) => ({ ...s, duration, isLoading: false, isPlaying: true }));
        },
        onProgress: (currentTime) => {
          setState((s) => ({ ...s, currentTime }));
        },
        onEnd: () => {
          setState((s) => ({ ...s, isPlaying: false, currentTime: 0 }));
        },
      });
      handleRef.current = handle;
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        isPlaying: false,
        error: err instanceof Error ? err.message : '播放失败',
      }));
    }
  }, [stop]);

  const toggle = useCallback((url: string, params?: AudioParameters) => {
    if (state.isPlaying && state.url === url) {
      stop();
    } else {
      play(url, params);
    }
  }, [state.isPlaying, state.url, play, stop]);

  useEffect(() => {
    return () => {
      if (handleRef.current) handleRef.current.stop();
    };
  }, []);

  return {
    ...state,
    play,
    stop,
    toggle,
  };
}
