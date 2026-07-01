/**
 * TTS API — /api/tts
 * 输入文本 + 音色 ID -> 输出合成音频
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getVoice } from '../services/voiceService.js';
import { synthesizeTTS } from '../services/mockAIEngine.js';
import { saveOutput } from '../storage/fileStorage.js';
import type { ApiResult, AudioParameters, Emotion } from '@shared/types.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { text, voiceId, emotion, options } = (req.body || {}) as {
      text?: string;
      voiceId?: string;
      emotion?: Emotion;
      options?: Partial<AudioParameters>;
    };

    if (!text || !text.trim()) {
      res.status(400).json({ success: false, error: '请输入文本' });
      return;
    }
    if (!voiceId) {
      res.status(400).json({ success: false, error: '请选择音色' });
      return;
    }
    const voice = getVoice(voiceId);
    if (!voice) {
      res.status(404).json({ success: false, error: '音色不存在' });
      return;
    }

    const { buffer, duration } = await synthesizeTTS({
      text: text.trim(),
      voice,
      emotion: emotion || 'neutral',
      parameters: options,
    });

    const jobId = `tts_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const outputPath = saveOutput(buffer, 'tts', jobId);

    const result: ApiResult<{
      jobId: string;
      status: 'completed';
      outputPath: string;
      duration: number;
    }> = {
      success: true,
      data: { jobId, status: 'completed', outputPath, duration },
    };
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS 合成失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
