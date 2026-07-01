/**
 * 文件上传 multer 配置
 */
import multer from 'multer';

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(wav|mp3|m4a|aac|ogg|webm|flac)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的音频格式,允许: wav/mp3/m4a/aac/ogg/webm/flac'));
    }
  },
});

/** 单文件上传字段名: file */
export const uploadSingle = upload.single('file');
