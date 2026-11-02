import React, { useState, useEffect } from 'react';
import { X, Folder, Trash2, Plus, Clock, Layers, AlertTriangle, Check } from 'lucide-react';
import { StudioProject } from '../../types/studio';
import { getAllStudioProjectsFromDb, deleteStudioProjectFromDb } from '../../lib/studioIndexedDb';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeProjectId?: string;
  currentProjectId?: string;
  onSelectProject: (project: StudioProject) => void;
  onNewProject: () => void;
  onDeleteProject?: (id: string) => void;
}

export const StudioProjectHistoryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  activeProjectId,
  currentProjectId,
  onSelectProject,
  onNewProject,
  onDeleteProject,
}) => {
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const effectiveActiveId = activeProjectId || currentProjectId;

  const loadProjects = async () => {
    setLoading(true);
    try {
      const list = await getAllStudioProjectsFromDb();
      setProjects(list);
    } catch (e) {
      console.warn('Failed to load projects from DB:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setDeletingId(null);
      loadProjects();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirmDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await deleteStudioProjectFromDb(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setDeletingId(null);
      setToastNotice('Proyek berhasil dihapus.');
      setTimeout(() => setToastNotice(null), 3000);
      onDeleteProject?.(id);
    } catch (err) {
      console.error('Failed to delete project:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#FAF9F6] dark:bg-[#141418] border border-stone-300 dark:border-white/10 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden transition-colors duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-white/10 bg-stone-100/80 dark:bg-[#1B1B22]/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-serif-display">Riwayat Proyek Studio</h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-sans-body">Daftar project analisis video dan storyboard yang tersimpan</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-200/80 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Button: New Project */}
        <div className="p-4 border-b border-stone-200 dark:border-white/10 bg-stone-100/50 dark:bg-[#1B1B22]/40">
          <button
            type="button"
            onClick={() => {
              onNewProject();
              onClose();
            }}
            className="w-full py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Buat Proyek Studio Baru
          </button>
        </div>

        {/* Toast Notification */}
        {toastNotice && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{toastNotice}</span>
          </div>
        )}

        {/* Project List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading ? (
            <div className="text-center py-12 text-xs text-stone-500 dark:text-stone-400 flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span>Memuat proyek studio...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-14 space-y-2.5 text-stone-500 dark:text-stone-400">
              <div className="w-12 h-12 rounded-2xl bg-stone-200/70 dark:bg-stone-900 border border-stone-300 dark:border-stone-800 flex items-center justify-center mx-auto text-stone-400 dark:text-stone-600">
                <Folder className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-300">Belum Ada Proyek</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs mx-auto">
                Mulai dengan menganalisis video baru atau membuat prompt di Studio.
              </p>
            </div>
          ) : (
            projects.map((p) => {
              const completedCount = p.scenes.filter((s) => s.imageUrl && s.status === 'completed').length;
              const isCurrent = p.id === effectiveActiveId;
              const isConfirming = deletingId === p.id;

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    if (!isConfirming) {
                      onSelectProject(p);
                      onClose();
                    }
                  }}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                    isConfirming
                      ? 'bg-rose-500/10 border-rose-500/40 shadow-lg'
                      : isCurrent
                      ? 'bg-amber-500/10 border-amber-500/40 shadow-xs cursor-pointer'
                      : 'bg-stone-100 dark:bg-[#1B1B22] border-stone-300 dark:border-white/10 hover:border-stone-400 dark:hover:border-white/20 hover:bg-stone-200/60 dark:hover:bg-[#22222B] cursor-pointer'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate max-w-xs sm:max-w-md block" title={p.name}>
                        {p.name || 'Proyek Storyboard'}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] bg-amber-500 text-stone-950 font-extrabold px-1.5 py-0.5 rounded shadow-xs shrink-0">
                          Aktif
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-stone-500 dark:text-stone-400 flex-wrap">
                      <span className="flex items-center gap-1 text-stone-700 dark:text-stone-300">
                        <Layers className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                        {completedCount}/{p.scenes.length} Scene Selesai
                      </span>
                      <span className="flex items-center gap-1 text-stone-400 dark:text-stone-500">
                        <Clock className="w-3 h-3 text-stone-400 dark:text-stone-500" />
                        {new Date(p.updatedAt || p.createdAt).toLocaleDateString('id-ID', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Action or Inline Confirm */}
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    {isConfirming ? (
                      <div className="flex items-center gap-1.5 bg-white dark:bg-[#141418] border border-rose-500/40 p-1.5 rounded-xl shadow-lg">
                        <span className="text-[11px] text-rose-600 dark:text-rose-300 font-semibold px-1 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                          Hapus?
                        </span>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={(e) => handleConfirmDelete(e, p.id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="px-2 py-1 rounded-lg bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs transition-all cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(p.id);
                        }}
                        className="p-2 rounded-xl text-stone-400 hover:text-rose-500 hover:bg-rose-500/10 border border-transparent transition-all cursor-pointer"
                        title="Hapus Proyek Ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
