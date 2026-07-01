/**
 * 输出文件 API — /api/output
 * 通过 jobId 或文件名下载
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { resolvePath } from '../storage/fileStorage.js';
import path from 'path';

const router = Router();

router.get('/:type/:filename', (req: Request, res: Response) => {
  const type = req.params.type;
  const filename = path.basename(req.params.filename);
  if (!['convert', 'tts'].includes(type)) {
    res.status(400).json({ success: false, error: '无效类型' });
    return;
  }
  const rel = `outputs/${type}/${filename}`;
  const abs = resolvePath(rel);
  res.download(abs, filename, (err) => {
    if (err) {
      res.status(404).json({ success: false, error: '文件不存在或已被清理' });
    }
  });
});

export default router;
