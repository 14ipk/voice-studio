/**
 * 音色库 API — /api/voices
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import {
  getVoice,
  listVoices,
  removeVoice,
  toggleFavorite,
  updateVoice,
} from '../services/voiceService.js';
import { resolvePath } from '../storage/fileStorage.js';
import { ensurePresetSample } from '../services/mockAIEngine.js';
import { ApiResult } from '@shared/types.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const source = (req.query.source as 'preset' | 'cloned') || undefined;
  const keyword = (req.query.keyword as string) || undefined;
  const voices = listVoices({ source, keyword });
  const result: ApiResult<{ voices: typeof voices; total: number }> = {
    success: true,
    data: { voices, total: voices.length },
  };
  res.json(result);
});

router.get('/:id', (req: Request, res: Response) => {
  const voice = getVoice(req.params.id);
  if (!voice) {
    res.status(404).json({ success: false, error: '音色不存在' });
    return;
  }
  res.json({ success: true, data: voice });
});

router.patch('/:id', (req: Request, res: Response) => {
  const patch = req.body || {};
  // 禁止改这些字段
  delete patch.id;
  delete patch.source;
  delete patch.createdAt;
  delete patch.samplePath;
  delete patch.features;
  const updated = updateVoice(req.params.id, patch);
  if (!updated) {
    res.status(404).json({ success: false, error: '音色不存在' });
    return;
  }
  res.json({ success: true, data: updated });
});

router.delete('/:id', (req: Request, res: Response) => {
  const ok = removeVoice(req.params.id);
  if (!ok) {
    res.status(404).json({ success: false, error: '音色不存在' });
    return;
  }
  res.json({ success: true });
});

router.post('/:id/favorite', (req: Request, res: Response) => {
  const updated = toggleFavorite(req.params.id);
  if (!updated) {
    res.status(404).json({ success: false, error: '音色不存在' });
    return;
  }
  res.json({ success: true, data: updated });
});

/** 获取音色样本音频流 */
router.get('/:id/sample', (req: Request, res: Response) => {
  const voice = getVoice(req.params.id);
  if (!voice) {
    res.status(404).json({ success: false, error: '音色不存在' });
    return;
  }
  // 确保预设样本存在
  if (voice.source === 'preset') {
    ensurePresetSample(voice);
  }
  const abs = resolvePath(voice.samplePath);
  res.sendFile(abs);
});

router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ success: false, error: err.message });
});

export default router;
