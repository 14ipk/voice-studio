/**
 * 声音转换 API — /api/convert
 * 上传录音 + 目标音色 ID -> 输出转换后音频
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { uploadSingle } from '../storage/upload.js';
import { getVoice } from '../services/voiceService.js';
import { convertVoice } from '../services/mockAIEngine.js';
import { saveOutput } from '../storage/fileStorage.js';
import { randomUUID } from 'crypto';
import type { ApiResult, AudioParameters } from '@shared/types.js';

const router = Router();

router.post('/', uploadSingle, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: '请上传录音文件' });
      return;
    }
    const targetVoiceId = req.body.targetVoiceId as string;
    if (!targetVoiceId) {
      res.status(400).json({ success: false, error: '请选择目标音色' });
      return;
    }
    const targetVoice = getVoice(targetVoiceId);
    if (!targetVoice) {
      res.status(404).json({ success: false, error: '目标音色不存在' });
      return;
    }

    let parameters: Partial<AudioParameters> | undefined;
    try {
      if (req.body.options) {
        parameters = typeof req.body.options === 'string' ? JSON.parse(req.body.options) : req.body.options;
      }
    } catch {
      // 解析失败忽略
    }

    // 执行转换(Mock)
    const { buffer, duration } = await convertVoice({
      sourceBuffer: req.file.buffer,
      targetVoice,
      parameters,
    });

    const jobId = `convert_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const outputPath = saveOutput(buffer, 'convert', jobId);

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
    const message = err instanceof Error ? err.message : '转换失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
