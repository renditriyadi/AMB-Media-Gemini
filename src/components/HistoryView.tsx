import React, { useState } from 'react';
import {
  Play,
  MoreVertical,
  Clock,
  Sparkles,
  Trash2,
  Eye,
  RefreshCw,
  Film,
  LayoutGrid,
  List,
  Download,
  Loader2,
  CheckSquare,
  Square,
  Search,
  X,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Video,
  Image as ImageIcon,
  Undo2,
} from 'lucide-react';
import { GenerationItem, getCleanPrompt, getShortPrompt, getAspectRatioLabel, getCleanModelName } from '../types';
import { downloadMediaFile } from '../utils';
import { MediaThumbnail } from './MediaThumbnail';

interface HistoryViewProps {
  items: GenerationItem[];
  onSelect: (item: GenerationItem) => void;
  onDelete: (id: string) => void;
  onDeleteGenerations?: (ids: string[], onProgress?: (current: number, total: number) => void) => Promise<void> | void;
  onToggleFavorite: (id: string) => void;
  onNavigateGenerate: () => void;
  onSyncHistory?: () => Promise<void>;
  isSyncing?: boolean;
  providerName?: string;
  onSendAsReference?: (item: GenerationItem) => void;
  onReuseItem?: (item: GenerationItem) => void;
}

// Helper to render provider icon in history card
const ProviderBadgeIcon: React.FC<{ provider?: string; model?: string }> = ({ provider, model }) => {
  const p = (provider || '').toLowerCase();
  const m = (model || '').toLowerCase();

  let isGemini = p === 'gemini' || p === 'google gemini' || m.includes('gemini') || m.includes('veo') || m.includes('imagen') || m.includes('omni flash');
  let isRunningHub = !isGemini && (p === 'runninghub' || m.includes('runninghub') || m.includes('s2 motion') || m.includes('ambmedia') || m.includes('motion control motionfly') || (m === 'motion control' && p !== 'roboneo'));
  let isKie = !isGemini && (p === 'kie' || p === 'kie.ai' || m.includes('grok imagine 1.5')) && p !== 'weavy';
  let isGalleri5 = !isGemini && (p === 'galleri5' || (!isKie && p !== 'weavy' && (m.includes('standar') || m.includes('galleri5'))));
  let isRoboNeo = !isGemini && (p === 'roboneo' || (!isKie && !isGalleri5 && p !== 'weavy' && ((m.includes('kling 2.6') && !m.includes('standar')) || m.includes('hailuo') || m.includes('minimax'))));

  if (isGemini) {
    return (
      <img
        src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg"
        alt="Google Gemini"
        className="w-3.5 h-3.5 rounded object-contain shrink-0"
        title="Provider: Google Gemini"
        referrerPolicy="no-referrer"
      />
    );
  }

  if (isRunningHub) {
    return (
      <img
        src="https://www.runninghub.ai/favicon.ico?v=1.4"
        alt="RunningHub"
        className="w-3.5 h-3.5 rounded object-contain shrink-0"
        title="Provider: RunningHub"
        referrerPolicy="no-referrer"
      />
    );
  }

  if (isKie) {
    return (
      <img
        src="https://kie.ai/logo.png"
        alt="Kie.ai"
        className="w-3.5 h-3.5 object-contain shrink-0"
        title="Provider: Kie.ai"
        referrerPolicy="no-referrer"
      />
    );
  }

  if (isGalleri5) {
    return (
      <>
        <img
          src="https://aistudio.galleri5.com/assets/Light%20mode-ClfS0paP.png"
          alt="Galleri5"
          className="w-3.5 h-3.5 object-contain shrink-0 dark:hidden"
          title="Provider: Galleri5"
          referrerPolicy="no-referrer"
        />
        <img
          src="https://aistudio.galleri5.com/assets/dark%20mode-D5XIT4aZ.png"
          alt="Galleri5"
          className="w-3.5 h-3.5 object-contain shrink-0 hidden dark:block"
          title="Provider: Galleri5"
          referrerPolicy="no-referrer"
        />
      </>
    );
  }

  if (isRoboNeo) {
    return (
      <img
        src="https://www.roboneo.com/favicon.ico"
        alt="RoboNeo"
        className="w-3.5 h-3.5 object-contain shrink-0"
        title="Provider: RoboNeo"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <>
      <img
        src="https://cdn.prod.website-files.com/681b040781d5b5e278a69989/6829dad31872740b3fb4f912_favicon.svg"
        alt="Weavy"
        className="w-3.5 h-3.5 object-contain shrink-0 dark:hidden"
        title="Provider: Weavy"
        referrerPolicy="no-referrer"
      />
      <img
        src="https://cdn.prod.website-files.com/681b040781d5b5e278a69989/69d4f1efa9dc89ccca92be1a_logo%20-%20squeare%20Weavy%20W.svg"
        alt="Weavy"
        className="w-3.5 h-3.5 object-contain shrink-0 hidden dark:block"
        title="Provider: Weavy"
        referrerPolicy="no-referrer"
      />
    </>
  );
};

export const HistoryView: React.FC<HistoryViewProps> = ({
  items,
  onSelect,
  onDelete,
  onDeleteGenerations,
  onToggleFavorite,
  onNavigateGenerate,
  onSyncHistory,
  isSyncing = false,
  providerName = 'Weavy AI',
  onSendAsReference,
  onReuseItem,
}) => {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'video' | 'image' | 'completed' | 'processing' | 'failed'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  // Batch action states
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDownloadProgress, setBatchDownloadProgress] = useState<{ current: number; total: number } | null>(null);
  const [deletingProgress, setDeletingProgress] = useState<{ current: number; total: number } | null>(null);

  const handleDownloadItem = async (item: GenerationItem) => {
    if (!item.mediaUrl || downloadingId) return;
    setDownloadingId(item.id);
    try {
      const cleanTitle = getCleanPrompt(item.prompt, item.model) || item.title || 'weavy_media';
      await downloadMediaFile(item.mediaUrl, cleanTitle, item.mode || 'image', item.model);
    } catch (e) {
      console.warn('Download media failed:', e);
      if (item?.mediaUrl) {
        window.open(item.mediaUrl, '_blank');
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCopyPrompt = (item: GenerationItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const cleanPrompt = getCleanPrompt(item.prompt, item.model) || item.title;
    navigator.clipboard.writeText(cleanPrompt);
    setCopiedPromptId(item.id);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  const toggleSelectItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const totalAll = items.length;
  const totalVideos = items.filter((i) => i.mode === 'video').length;
  const totalImages = items.filter((i) => i.mode !== 'video').length;
  const completedCount = items.filter((i) => (i.status || 'completed') === 'completed').length;
  const processingCount = items.filter((i) => i.status === 'processing' || i.status === 'queued').length;
  const failedCount = items.filter((i) => i.status === 'failed').length;

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.prompt.toLowerCase().includes(search.toLowerCase()) ||
      (item.model && item.model.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeFilter === 'all') return true;
    if (activeFilter === 'video') return item.mode === 'video';
    if (activeFilter === 'image') return item.mode !== 'video';
    if (activeFilter === 'completed') return (item.status || 'completed') === 'completed';
    if (activeFilter === 'processing') return item.status === 'processing' || item.status === 'queued';
    if (activeFilter === 'failed') return item.status === 'failed';
    return true;
  });

  const handleSelectAll = () => {
    const allFilteredIds = filteredItems.map((i) => i.id);
    if (selectedIds.size === allFilteredIds.length && allFilteredIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
  };

  const handleBatchDownload = async () => {
    const itemsToDownload = filteredItems.filter(
      (item) => selectedIds.has(item.id) && item.mediaUrl
    );
    if (itemsToDownload.length === 0) return;

    setBatchDownloadProgress({ current: 0, total: itemsToDownload.length });

    for (let i = 0; i < itemsToDownload.length; i++) {
      const item = itemsToDownload[i];
      setBatchDownloadProgress({ current: i + 1, total: itemsToDownload.length });
      await handleDownloadItem(item);
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    setBatchDownloadProgress(null);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0 || deletingProgress) return;
    const count = selectedIds.size;
    const idsArray = Array.from(selectedIds);
    setDeletingProgress({ current: 0, total: count });

    try {
      if (onDeleteGenerations) {
        await onDeleteGenerations(idsArray, (current, total) => {
          setDeletingProgress({ current, total });
        });
      } else {
        for (let i = 0; i < idsArray.length; i++) {
          setDeletingProgress({ current: i + 1, total: count });
          await onDelete(idsArray[i]);
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
      }
    } catch (err) {
      console.error('Error during batch delete:', err);
    } finally {
      setDeletingProgress(null);
      setSelectedIds(new Set());
      setIsBatchMode(false);
    }
  };

  const groups = ['Today', 'Yesterday', 'Earlier'] as const;

  const groupedItems = groups.reduce((acc, groupName) => {
    const groupList = filteredItems.filter((item) => {
      if (item.group) return item.group === groupName;
      if (groupName === 'Today') return item.createdAt.toLowerCase().includes('today');
      if (groupName === 'Yesterday') return item.createdAt.toLowerCase().includes('yesterday');
      return groupName === 'Earlier';
    });
    if (groupList.length > 0) {
      acc[groupName] = groupList;
    }
    return acc;
  }, {} as Record<string, GenerationItem[]>);

  const categorizedIds = new Set(Object.values(groupedItems).flat().map((i) => i.id));
  const uncategorized = filteredItems.filter((i) => !categorizedIds.has(i.id));
  if (uncategorized.length > 0) {
    groupedItems['Earlier'] = [...(groupedItems['Earlier'] || []), ...uncategorized];
  }

  const isAllSelected = filteredItems.length > 0 && selectedIds.size === filteredItems.length;

  return (
    <div className="space-y-5 pb-24 w-full transition-all">
      {/* Controls Section: Search Bar, Action Buttons, and View Mode Toggle */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari prompt, model, atau kata kunci..."
              className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-[#141418] border border-stone-200/80 dark:border-white/10 rounded-lg text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-amber-500/50 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sync History Button */}
          {onSyncHistory && (
            <button
              type="button"
              onClick={onSyncHistory}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white dark:bg-[#141418] hover:bg-stone-50 dark:hover:bg-[#1E1E26] text-stone-800 dark:text-stone-100 font-medium text-xs rounded-lg border border-stone-200/80 dark:border-white/10 transition-all active:scale-95 disabled:opacity-60 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-stone-600 dark:text-stone-300' : 'text-stone-600 dark:text-stone-300'}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : `Tarik Histori ${providerName}`}</span>
              <span className="sm:hidden">{isSyncing ? '...' : 'Sync'}</span>
            </button>
          )}

          {/* Batch Mode Toggle Button */}
          <button
            type="button"
            onClick={() => {
              if (isBatchMode) {
                setIsBatchMode(false);
                setSelectedIds(new Set());
              } else {
                setIsBatchMode(true);
              }
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium rounded-lg border transition-all cursor-pointer shrink-0 ${
              isBatchMode
                ? 'bg-stone-900 text-white border-stone-900 dark:bg-amber-500 dark:text-stone-950 dark:border-amber-500 font-bold'
                : 'bg-white dark:bg-[#141418] text-stone-800 dark:text-stone-100 border-stone-200/80 dark:border-white/10 hover:bg-stone-50 dark:hover:bg-[#1E1E26]'
            }`}
            title="Mode Pilih Banyak (Batch Actions)"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{isBatchMode ? 'Selesai Pilih' : 'Pilih Banyak'}</span>
            {selectedIds.size > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 dark:bg-stone-950 dark:text-amber-400 text-white rounded-full text-[10px] font-bold font-mono">
                {selectedIds.size}
              </span>
            )}
          </button>

          {/* View Mode Toggle (Grid vs List) */}
          <div className="flex items-center bg-white dark:bg-[#141418] p-1 rounded-lg border border-stone-200/80 dark:border-white/10 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              title="Tampilan Grid"
              className={`p-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-stone-100 dark:bg-amber-500/15 dark:border dark:border-amber-500/20 text-stone-900 dark:text-amber-300 font-semibold'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px] font-sans-body">Grid</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="Tampilan List"
              className={`p-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-stone-100 dark:bg-amber-500/15 dark:border dark:border-amber-500/20 text-stone-900 dark:text-amber-300 font-semibold'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px] font-sans-body">List</span>
            </button>
          </div>
        </div>

        {/* Status & Media Filter Pill Tabs */}
        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar shrink-0 max-w-full">
            {[
              { key: 'all', label: 'All', count: totalAll, icon: undefined },
              { key: 'video', label: 'Video', count: totalVideos, icon: Video },
              { key: 'image', label: 'Image', count: totalImages, icon: ImageIcon },
              { key: 'completed', label: 'Completed', count: completedCount, icon: undefined },
              { key: 'processing', label: 'Processing', count: processingCount, icon: undefined },
              { key: 'failed', label: 'Failed', count: failedCount, icon: undefined },
            ].map((tab) => {
              const isActive = activeFilter === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key as any)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 cursor-pointer border ${
                    isActive
                      ? 'bg-stone-900 text-white border-stone-900 dark:bg-amber-500 dark:text-stone-950 dark:border-amber-500 font-bold'
                      : 'bg-white dark:bg-[#141418] text-stone-600 dark:text-stone-400 border-stone-200/80 dark:border-white/10 hover:bg-stone-50 dark:hover:bg-[#1E1E26] hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? 'bg-stone-800 text-stone-200 dark:bg-stone-900 dark:text-amber-400'
                        : 'bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-stone-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* BATCH ACTIONS TOOLBAR (Floating inline on the right side) */}
          {isBatchMode && (
            <div className="flex items-center gap-2.5 ml-auto shrink-0 animate-in fade-in duration-200 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#141418] hover:bg-stone-50 dark:hover:bg-[#1E1E26] text-stone-700 dark:text-stone-100 rounded-md text-xs font-semibold border border-stone-200/80 dark:border-white/10 transition-colors cursor-pointer"
                >
                  {isAllSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  <span>{isAllSelected ? 'Batal' : 'Pilih Semua'}</span>
                </button>
                <span className="text-xs font-medium text-stone-600 dark:text-stone-300">
                  <strong className="font-bold font-mono text-stone-900 dark:text-stone-100">{selectedIds.size}/{filteredItems.length}</strong> terpilih
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Batch Download */}
                <button
                  type="button"
                  onClick={handleBatchDownload}
                  disabled={selectedIds.size === 0 || !!batchDownloadProgress}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#141418] hover:bg-stone-50 dark:hover:bg-[#1E1E26] text-stone-700 dark:text-stone-100 border border-stone-200/80 dark:border-white/10 font-semibold text-xs rounded-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  {batchDownloadProgress ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-600 dark:text-stone-300" />
                      <span>
                        ({batchDownloadProgress.current}/{batchDownloadProgress.total})
                      </span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 text-stone-600 dark:text-stone-300" />
                      <span>Download</span>
                    </>
                  )}
                </button>

                {/* Batch Delete */}
                <button
                  type="button"
                  onClick={handleBatchDelete}
                  disabled={selectedIds.size === 0 || !!deletingProgress}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs rounded-md transition-all disabled:opacity-50 cursor-pointer justify-center"
                >
                  {deletingProgress ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white shrink-0" />
                      <span>{deletingProgress.current}/{deletingProgress.total}</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      <span>({selectedIds.size})</span>
                    </>
                  )}
                </button>

                {/* Close Batch Mode */}
                <button
                  type="button"
                  onClick={() => {
                    setIsBatchMode(false);
                    setSelectedIds(new Set());
                  }}
                  className="p-1.5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 rounded-xl transition-colors cursor-pointer"
                  title="Tutup Mode Batch"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* List / Grid items grouped by date */}
      {Object.keys(groupedItems).length === 0 ? (
        <div className="py-12 text-center bg-white/80 dark:bg-[#141418] rounded-2xl border border-dashed border-stone-200 dark:border-white/10">
          <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">Tidak ada riwayat ditemukan</p>
          <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1">Coba ubah kata kunci pencarian atau filter status.</p>
          <button
            onClick={onNavigateGenerate}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white hover:bg-stone-800 dark:bg-amber-500 dark:text-stone-950 dark:hover:bg-amber-400 text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Buat Prompt Baru</span>
          </button>
        </div>
      ) : (
        Object.entries(groupedItems).map(([groupTitle, list]) => (
          <div key={groupTitle} className="space-y-3">
            <h3 className="text-xs font-semibold text-stone-400 dark:text-stone-400 uppercase tracking-wider px-1 font-sans-body flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span>{groupTitle}</span>
            </h3>

            <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4' : 'space-y-3 w-full'}>
              {list.map((item) => {
                const isVideo = item.mode === 'video';
                const isMenuOpen = activeMenuId === item.id;
                const isSelected = selectedIds.has(item.id);
                const isDownloadingThis = downloadingId === item.id;
                const isCopiedThis = copiedPromptId === item.id;

                if (viewMode === 'grid') {
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (isBatchMode) {
                          toggleSelectItem(item.id);
                        }
                      }}
                      className={`bg-white/90 dark:bg-[#141418] rounded-xl border transition-all duration-200 overflow-hidden flex flex-col p-2.5 gap-2.5 relative group ${
                        isSelected
                          ? 'border-amber-500/80 dark:border-amber-500 ring-2 ring-amber-500/20 dark:ring-amber-500/30 bg-amber-50/50 dark:bg-[#1C1C24]'
                          : 'border-stone-200/80 dark:border-white/10 dark:hover:border-white/20'
                      }`}
                    >
                      {/* Checkbox Overlay for Batch Select */}
                      {isBatchMode && (
                        <div
                          onClick={(e) => toggleSelectItem(item.id, e)}
                          className="absolute top-4 left-4 z-20 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-amber-500 bg-white/90 dark:bg-[#141418] rounded-md shadow-xs fill-amber-500/20" />
                          ) : (
                            <Square className="w-5 h-5 text-white/90 drop-shadow-md hover:text-amber-400" />
                          )}
                        </div>
                      )}

                      {/* Thumbnail Box */}
                      <div
                        onClick={(e) => {
                          if (isBatchMode) {
                            toggleSelectItem(item.id, e);
                          } else {
                            onSelect(item);
                          }
                        }}
                        className="relative w-full aspect-video bg-stone-900 rounded-xl overflow-hidden cursor-pointer shrink-0 flex items-center justify-center border border-black/10 dark:border-white/5"
                      >
                        <MediaThumbnail
                          item={item}
                          showPlayIcon={true}
                          hoverPlay={true}
                          className="w-full h-full"
                        />

                        {/* Duration / Aspect Ratio Badge */}
                        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/75 backdrop-blur-xs rounded text-[9px] font-mono font-bold text-white z-10">
                          {isVideo
                            ? (item.model?.includes('Kling') || item.model?.includes('Motion Control') ? (item.duration || 'Auto') : (item.duration || '00:05'))
                            : getAspectRatioLabel(item)}
                        </div>

                        {/* Completed Green Check Icon */}
                        {(item.status === 'completed' || (!item.status && (item.mediaUrl || item.thumbnailUrl))) && item.status !== 'processing' && item.status !== 'queued' && (
                          <CheckCircle2 className="absolute top-1.5 right-1.5 w-4 h-4 text-emerald-500 drop-shadow-md z-10" title="Selesai" />
                        )}
                      </div>

                      {/* Card Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <ProviderBadgeIcon provider={item.provider} model={item.model} />
                              <h4
                                onClick={(e) => {
                                  if (isBatchMode) {
                                    toggleSelectItem(item.id, e);
                                  } else {
                                    onSelect(item);
                                  }
                                }}
                                className="text-xs sm:text-sm font-medium text-stone-800 dark:text-stone-200 line-clamp-1 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer font-sans-body leading-snug"
                                title={getCleanPrompt(item.prompt, item.model) || item.title}
                              >
                                {getShortPrompt(item.prompt, item.model) || (
                                  <span className="text-stone-400 italic font-light">(Tanpa Prompt)</span>
                                )}
                              </h4>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 dark:text-stone-400">
                              {((item.model || '').toLowerCase().includes('seedance') || (item.model || '').toLowerCase().includes('seedream')) && (
                                <img
                                  src="https://lf3-static.bytednsdoc.com/obj/eden-cn/lapzild-tss/ljhwZthlaukjlkulzlp/favicon_1/favicon.ico"
                                  alt="Seedance / Seedream"
                                  className="w-3 h-3 object-contain shrink-0 rounded-xs"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              {(item.model || '').toLowerCase().includes('kling') && (
                                <img
                                  src="https://kling.ai/favicon.ico"
                                  alt="Kling"
                                  className="w-3 h-3 object-contain shrink-0 rounded-xs"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              {(item.model || '').toLowerCase().includes('grok') && (
                                <img
                                  src="https://grok.com/images/favicon.ico"
                                  alt="Grok"
                                  className="w-3 h-3 object-contain shrink-0 rounded-xs"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              {(item.model || '').toLowerCase().includes('chatgpt') && (
                                <div className="w-3.5 h-3.5 rounded-full bg-[#10a37f] flex items-center justify-center shrink-0 p-0.5 shadow-xs">
                                  <img
                                    src="https://chatgpt.com/cdn/assets/favicon-l4nq08hd.svg"
                                    alt="ChatGPT"
                                    className="w-full h-full object-contain"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              )}
                              {((item.model || '').toLowerCase().includes('banana') || (item.model || '').toLowerCase().includes('nano')) && (
                                <img
                                  src="https://devicons.io/devicons/icons/nanobanana.svg"
                                  alt="Nano Banana Pro"
                                  className="w-3.5 h-3.5 object-contain shrink-0 rounded-xs"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <span>{getCleanModelName(item.model) || 'SeeDance 2.0'}</span>
                            </span>

                            {/* Status Badge */}
                            {item.status === 'queued' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded text-[10px] font-semibold border border-amber-500/30 animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                                <span>Antre ({item.timerString || '00:01'})</span>
                              </span>
                            )}
                            {item.status === 'processing' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded text-[10px] font-semibold border border-amber-500/20">
                                <Sparkles className="w-3 h-3 animate-spin text-amber-500" />
                                {item.timerString && <span>{item.timerString}</span>}
                              </span>
                            )}
                            {item.status === 'failed' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 rounded text-[10px] font-semibold border border-rose-500/20">
                                <AlertCircle className="w-3 h-3" />
                                <span>Gagal</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Direct Quick Action Toolbar (Parity with List View) */}
                        <div className="flex items-center justify-between border-t border-stone-200/60 dark:border-white/8 pt-2 mt-2 gap-1">
                          <div className="flex items-center gap-0.5">
                            {item.mediaUrl && onSendAsReference && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSendAsReference(item);
                                }}
                                className="p-1.5 text-stone-500 hover:text-amber-500 dark:hover:text-amber-400 rounded-lg hover:bg-stone-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                title="Gunakan Sebagai Referensi di Generator"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onReuseItem && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onReuseItem(item);
                                }}
                                className="p-1.5 text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-stone-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                title="Gunakan Kembali ke Perintah (Prompt & Media)"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={(e) => handleCopyPrompt(item, e)}
                              className="p-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-amber-300 rounded-lg hover:bg-stone-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                              title="Salin Prompt"
                            >
                              {isCopiedThis ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>

                            {item.mediaUrl && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadItem(item);
                                }}
                                disabled={isDownloadingThis}
                                className="p-1.5 text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-stone-100 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
                                title="Download Hasil Media"
                              >
                                {isDownloadingThis ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelect(item);
                              }}
                              className="p-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 rounded-lg hover:bg-stone-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                              title="Lihat Detail"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(item.id);
                              }}
                              className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-stone-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Enhanced Full-Featured List View Mode (Parity with Grid View + Direct Action Controls)
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (isBatchMode) {
                        toggleSelectItem(item.id);
                      }
                    }}
                    className={`bg-white/90 dark:bg-[#141418] rounded-xl border p-3 transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center gap-3 relative ${
                      isSelected
                        ? 'border-amber-500/80 dark:border-amber-500 ring-2 ring-amber-500/20 dark:ring-amber-500/30 bg-amber-50/50 dark:bg-[#1C1C24]'
                        : 'border-stone-200/80 dark:border-white/10 dark:hover:border-white/20'
                    }`}
                  >
                    {/* Left Checkbox (Batch Selection) */}
                    {isBatchMode && (
                      <div
                        onClick={(e) => toggleSelectItem(item.id, e)}
                        className="cursor-pointer shrink-0 pt-1 sm:pt-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-amber-500 fill-amber-500/20" />
                        ) : (
                          <Square className="w-5 h-5 text-stone-300 dark:text-stone-500 hover:text-amber-500 dark:hover:text-amber-400" />
                        )}
                      </div>
                    )}

                    {/* Thumbnail Box */}
                    <div
                      onClick={(e) => {
                        if (isBatchMode) {
                          toggleSelectItem(item.id, e);
                        } else {
                          onSelect(item);
                        }
                      }}
                      className="w-full sm:w-28 h-24 sm:h-20 bg-stone-900 rounded-xl overflow-hidden shrink-0 cursor-pointer relative flex items-center justify-center group/thumb border border-black/10 dark:border-white/5"
                    >
                      <MediaThumbnail
                        item={item}
                        showPlayIcon={true}
                        hoverPlay={true}
                        className="w-full h-full"
                      />

                      {/* Duration / Format Badge */}
                      <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 backdrop-blur-xs rounded text-[8px] font-mono font-bold text-white z-10">
                        {isVideo ? (item.model?.includes('Kling') || item.model?.includes('Motion Control') ? (item.duration || 'Auto') : (item.duration || '00:05')) : getAspectRatioLabel(item)}
                      </div>

                      {/* Completed Green Check Icon */}
                      {(item.status === 'completed' || (!item.status && (item.mediaUrl || item.thumbnailUrl))) && item.status !== 'processing' && item.status !== 'queued' && (
                        <CheckCircle2 className="absolute top-1 right-1 w-3.5 h-3.5 text-emerald-500 drop-shadow-md z-10" title="Selesai" />
                      )}
                    </div>

                    {/* Middle Info Column */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Prompt Text with Provider Badge */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <ProviderBadgeIcon provider={item.provider} model={item.model} />
                        <h4
                          onClick={(e) => {
                            if (isBatchMode) {
                              toggleSelectItem(item.id, e);
                            } else {
                              onSelect(item);
                            }
                          }}
                          className="text-xs sm:text-sm font-medium text-stone-800 dark:text-stone-200 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer font-sans-body line-clamp-1 leading-snug"
                          title={getCleanPrompt(item.prompt, item.model) || item.title}
                        >
                          {getShortPrompt(item.prompt, item.model) || item.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Model Badge */}
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 dark:text-stone-400">
                          {((item.model || '').toLowerCase().includes('seedance') || (item.model || '').toLowerCase().includes('seedream')) && (
                            <img
                              src="https://lf3-static.bytednsdoc.com/obj/eden-cn/lapzild-tss/ljhwZthlaukjlkulzlp/favicon_1/favicon.ico"
                              alt="Seedance / Seedream"
                              className="w-3 h-3 object-contain shrink-0 rounded-xs"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          {(item.model || '').toLowerCase().includes('kling') && (
                            <img
                              src="https://kling.ai/favicon.ico"
                              alt="Kling"
                              className="w-3 h-3 object-contain shrink-0 rounded-xs"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          {(item.model || '').toLowerCase().includes('grok') && (
                            <img
                              src="https://grok.com/images/favicon.ico"
                              alt="Grok"
                              className="w-3 h-3 object-contain shrink-0 rounded-xs"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          {(item.model || '').toLowerCase().includes('chatgpt') && (
                            <div className="w-3.5 h-3.5 rounded-full bg-[#10a37f] flex items-center justify-center shrink-0 p-0.5 shadow-xs">
                              <img
                                src="https://chatgpt.com/cdn/assets/favicon-l4nq08hd.svg"
                                alt="ChatGPT"
                                className="w-full h-full object-contain"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          {((item.model || '').toLowerCase().includes('banana') || (item.model || '').toLowerCase().includes('nano')) && (
                            <img
                              src="https://devicons.io/devicons/icons/nanobanana.svg"
                              alt="Nano Banana Pro"
                              className="w-3.5 h-3.5 object-contain shrink-0 rounded-xs"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <span>{getCleanModelName(item.model) || 'SeeDance 2.0'}</span>
                        </span>

                        {/* Status Badge */}
                        {item.status === 'processing' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded text-[10px] font-semibold border border-amber-500/20">
                            <Sparkles className="w-3 h-3 animate-spin text-amber-500" />
                            {item.timerString && <span>{item.timerString}</span>}
                          </span>
                        )}
                        {item.status === 'failed' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 rounded text-[10px] font-semibold border border-rose-500/20">
                            <AlertCircle className="w-3 h-3" />
                            <span>Gagal</span>
                          </span>
                        )}

                        {/* Timestamp */}
                        <span className="text-[10px] font-mono text-stone-400 dark:text-stone-500">
                          {item.createdAt}
                        </span>
                      </div>
                    </div>

                    {/* Right Direct Action Buttons (List View Rich Actions) */}
                    <div className="flex items-center gap-1 self-end sm:self-center shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto justify-end">
                      {/* Gunakan Sebagai Referensi */}
                      {item.mediaUrl && onSendAsReference && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSendAsReference(item);
                          }}
                          className="p-2 text-stone-500 hover:text-amber-500 dark:hover:text-amber-400 rounded-xl hover:bg-stone-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                          title="Gunakan Sebagai Referensi di Generator"
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>
                      )}

                      {/* Gunakan Kembali ke Perintah */}
                      {onReuseItem && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onReuseItem(item);
                          }}
                          className="p-2 text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 rounded-xl hover:bg-stone-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                          title="Gunakan Kembali ke Perintah (Prompt & Media)"
                        >
                          <Undo2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* Salin Prompt */}
                      <button
                        type="button"
                        onClick={(e) => handleCopyPrompt(item, e)}
                        className="p-2 text-stone-500 hover:text-stone-900 dark:hover:text-amber-300 rounded-xl hover:bg-stone-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        title="Salin Prompt"
                      >
                        {isCopiedThis ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>

                      {/* Download Direct */}
                      {item.mediaUrl && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadItem(item);
                          }}
                          disabled={isDownloadingThis}
                          className="p-2 text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 rounded-xl hover:bg-stone-100 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
                          title="Download Hasil Media"
                        >
                          {isDownloadingThis ? (
                            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      {/* View Detail Modal */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(item);
                        }}
                        className="p-2 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 rounded-xl hover:bg-stone-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        title="Lihat Detail"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item.id);
                        }}
                        className="p-2 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-stone-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
