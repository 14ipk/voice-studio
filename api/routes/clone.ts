/**
 * 音色克隆 API — /api/clone
 * 上传样本 -> 提取特征 -> 保存到音色库
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { uploadSingle } from '../storage/upload.js';
import { saveUpload } from '../storage/fileStorage.js';
import { createVoice } from '../services/voiceService.js';
import { extractFeatures } from '../services/mockAIEngine.js';
import { decodeWav } from '../services/wavUtils.js';
import type { ApiResult, VoiceProfile } from '@shared/types.js';

const router = Router();

router.post('/', uploadSingle, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: '请上传音频样本文件' });
      return;
    }

    const { name, tags, description, gender, language } = req.body as {
      name?: string;
      tags?: string;
      description?: string;
      gender?: 'male' | 'female' | 'neutral';
      language?: string;
    };

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: '请输入音色名称' });
      return;
    }

    // 保存上传文件
    const samplePath = saveUpload(req.file, 'sample');

    // 模拟分析延迟
    await new Promise<void>((r) => setTimeout(r, 800));

    // 提取特征
    const features = extractFeatures(req.file.buffer);

    // 估算时长
    let duration = 5;
    try {
      const wav = decodeWav(req.file.buffer);
      if (wav.samples.length > 0) {
        duration = Math.max(0.1, wav.samples.length / wav.sampleRate);
      }
    } catch {
      // 不是 WAV,用估算
    }

    // 解析标签
    const tagList = (tags || '').split(/[,，]/).map((t) => t.trim()).filter(Boolean);

    const voice = createVoice({
      name: name.trim(),
      tags: tagList,
      description: description?.trim() || undefined,
      gender,
      language: language || 'zh-CN',
      samplePath,
      duration,
      features,
    });

    const result: ApiResult<VoiceProfile> = { success: true, data: voice };
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '克隆失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
