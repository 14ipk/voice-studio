/**
 * 音色库页 — 网格 / 试听 / 编辑 / 删除
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Library, Search, Star, Trash2, Plus, Filter, FlaskConical, Wand2, X, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { VoiceCard } from '@/components/VoiceCard';
import { useVoiceStore } from '@/store/useVoiceStore';
import { toast } from '@/store/useToastStore';
import { cn } from '@/lib/utils';
import type { VoiceProfile, VoiceSource } from '@shared/types';

type FilterSource = 'all' | VoiceSource | 'favorite';

export function LibraryPage() {
  const navigate = useNavigate();
  const voices = useVoiceStore((s) => s.voices);
  const loading = useVoiceStore((s) => s.loading);
  const loaded = useVoiceStore((s) => s.loaded);
  const fetchVoices = useVoiceStore((s) => s.fetchVoices);
  const removeVoice = useVoiceStore((s) => s.removeVoice);
  const toggleFavorite = useVoiceStore((s) => s.toggleFavorite);
  const updateVoiceMeta = useVoiceStore((s) => s.updateVoiceMeta);

  const [keyword, setKeyword] = useState('');
  const [sourceFilter, setSourceFilter] = useState<FilterSource>('all');
  const [editing, setEditing] = useState<VoiceProfile | null>(null);
  const [deleting, setDeleting] = useState<VoiceProfile | null>(null);

  useEffect(() => {
    if (!loaded) fetchVoices();
  }, [loaded, fetchVoices]);

  const filtered = useMemo(() => {
    let list = voices;
    if (sourceFilter === 'favorite') {
      list = list.filter((v) => v.isFavorite);
    } else if (sourceFilter !== 'all') {
      list = list.filter((v) => v.source === sourceFilter);
    }
    if (keyword.trim()) {
      const kw = keyword.toLowerCase();
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(kw) ||
          v.tags.some((t) => t.toLowerCase().includes(kw)) ||
          v.description?.toLowerCase().includes(kw),
      );
    }
    return list;
  }, [voices, keyword, sourceFilter]);

  const stats = useMemo(() => {
    return {
      total: voices.length,
      preset: voices.filter((v) => v.source === 'preset').length,
      cloned: voices.filter((v) => v.source === 'cloned').length,
      favorite: voices.filter((v) => v.isFavorite).length,
    };
  }, [voices]);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await removeVoice(deleting.id);
      toast.success(`已删除「${deleting.name}」`);
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleFavorite = async (voice: VoiceProfile) => {
    try {
      await toggleFavorite(voice.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleSaveEdit = async (patch: Partial<VoiceProfile>) => {
    if (!editing) return;
    try {
      await updateVoiceMeta(editing.id, patch);
      toast.success('已更新音色信息');
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新失败');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Library}
        title="音色库"
        subtitle="管理已克隆与预设的音色,可试听、收藏、编辑或删除。所有音色可在声音转换与 TTS 工作室中复用。"
        badge="Voice Library"
        actions={
          <>
            <button onClick={() => navigate('/clone')} className="btn-secondary">
              <FlaskConical className="w-4 h-4" />
              <span>新建克隆</span>
            </button>
            <button onClick={() => navigate('/convert')} className="btn-primary">
              <Wand2 className="w-4 h-4" />
              <span>声音转换</span>
            </button>
          </>
        }
      />

      {/* 统计 + 过滤 */}
      <div className="grid sm:grid-cols-4 gap-3">
        <StatCard label="音色总数" value={stats.total} icon={Library} color="neon" />
        <StatCard label="预设音色" value={stats.preset} icon={Star} color="amber" />
        <StatCard label="已克隆" value={stats.cloned} icon={FlaskConical} color="magenta" />
        <StatCard label="已收藏" value={stats.favorite} icon={Star} color="neon" />
      </div>

      {/* 工具栏 */}
      <div className="glass-panel rounded-2xl p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索音色名 / 标签 / 描述…"
            className="input-search"
          />
          {keyword && (
            <button
              onClick={() => setKeyword('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-ink-800/60 p-1">
          <Filter className="w-3.5 h-3.5 text-white/30 ml-2 mr-1" />
          {[
            { key: 'all' as const, label: '全部' },
            { key: 'preset' as const, label: '预设' },
            { key: 'cloned' as const, label: '已克隆' },
            { key: 'favorite' as const, label: '收藏' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSourceFilter(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                sourceFilter === tab.key
                  ? 'bg-neon-500/15 text-neon-300 shadow-neon-sm'
                  : 'text-white/50 hover:text-white hover:bg-white/5',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 卡片网格 */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="glass-panel rounded-xl p-4 h-72 animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="h-4 bg-white/5 rounded w-1/2 mb-3" />
              <div className="h-3 bg-white/5 rounded w-1/3 mb-2" />
              <div className="h-12 bg-white/5 rounded mb-3" />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-12 bg-white/5 rounded" />
                <div className="h-12 bg-white/5 rounded" />
                <div className="h-12 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
            <Library className="w-8 h-8 text-white/30" />
          </div>
          <h3 className="text-display text-lg text-white mb-1">
            {voices.length === 0 ? '音色库为空' : '无匹配结果'}
          </h3>
          <p className="text-sm text-white/50 mb-5">
            {voices.length === 0
              ? '从克隆一段音频样本开始,创建你的第一个音色'
              : '尝试其他关键词或清除筛选条件'}
          </p>
          {voices.length === 0 && (
            <button onClick={() => navigate('/clone')} className="btn-primary">
              <Plus className="w-4 h-4" />
              <span>新建音色克隆</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((voice) => (
            <VoiceCard
              key={voice.id}
              voice={voice}
              onFavorite={handleFavorite}
              onEdit={(v) => setEditing(v)}
              onDelete={(v) => setDeleting(v)}
            />
          ))}
        </div>
      )}

      {/* 编辑弹窗 */}
      {editing && (
        <EditVoiceModal
          voice={editing}
          onClose={() => setEditing(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* 删除确认 */}
      {deleting && (
        <DeleteConfirmModal
          voice={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof Library;
  color: 'neon' | 'amber' | 'magenta';
}) {
  const colorMap = {
    neon: 'text-neon-300 border-neon-500/30',
    amber: 'text-amber-300 border-amber-400/30',
    magenta: 'text-magenta-300 border-magenta-400/30',
  };
  return (
    <div className="glass-panel rounded-xl p-4 flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-lg border flex items-center justify-center', colorMap[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-display font-bold text-white tabular-nums">{value}</div>
        <div className="text-xs text-white/40">{label}</div>
      </div>
    </div>
  );
}

function EditVoiceModal({
  voice,
  onClose,
  onSave,
}: {
  voice: VoiceProfile;
  onClose: () => void;
  onSave: (patch: Partial<VoiceProfile>) => void;
}) {
  const [name, setName] = useState(voice.name);
  const [tags, setTags] = useState(voice.tags.join(', '));
  const [description, setDescription] = useState(voice.description || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 backdrop-blur-md p-4">
      <div className="glass-panel rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-neon-400" />
            <h3 className="text-display text-lg text-white">编辑音色</h3>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1.5">名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">标签(逗号分隔)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="input-field resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn-secondary">取消</button>
          <button
            onClick={() => onSave({
              name: name.trim(),
              tags: tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
              description: description.trim() || undefined,
            })}
            disabled={!name.trim()}
            className="btn-primary"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  voice,
  onClose,
  onConfirm,
}: {
  voice: VoiceProfile;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 backdrop-blur-md p-4">
      <div className="glass-panel rounded-2xl p-6 w-full max-w-md border-magenta-400/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-magenta-400/10 border border-magenta-400/30 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-6 h-6 text-magenta-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-display text-lg text-white mb-1">确认删除</h3>
            <p className="text-sm text-white/60">
              即将删除音色「<span className="text-magenta-300">{voice.name}</span>」,此操作不可撤销,关联的样本文件也会一并清除。
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn-secondary">取消</button>
          <button onClick={onConfirm} className="btn-danger !px-5 !py-2.5">
            <Trash2 className="w-4 h-4" />
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}
