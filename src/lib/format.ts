/**
 * 格式化工具
 */

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function formatNumber(value: number, digits = 1): string {
  return value.toFixed(digits);
}

export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function getFilenameFromPath(p: string): string {
  const parts = p.split('/');
  return parts[parts.length - 1] || p;
}

/** 估计文本朗读时长(中文 4 字/秒) */
export function estimateSpeechDuration(text: string, speed = 1): number {
  const chars = [...text].filter((c) => c.trim().length > 0).length;
  return (chars / 4) / speed;
}
