import React, { useState, useMemo, useEffect } from 'react';
import {
  Play,
  MoreVertical,
  ChevronRight,
  Download,
  Trash2,
  RotateCcw,
  Sparkles,
  Film,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  Eye,
  Undo2,
} from 'lucide-react';
import { GenerationItem, getCleanPrompt, getShortPrompt, getAspectRatioLabel, getCleanModelName } from '../types';
import { formatTo24h, downloadMediaFile } from '../utils';
import { MediaThumbnail } from './MediaThumbnail';

// Helper to render provider icon in recent cards
const ProviderBadgeIcon: React.FC<{ provider?: string; model?: string }> = ({ provider, model }) => {
  const p = (provider || '').toLowerCase();
  const m = (model || '').toLowerCase();

  // Determine provider by explicit provider property or model name fallback
  const isVids = p === 'vids' || p === 'google vids' || m.includes('google vids') || m.includes('vids omni');
  let isGemini = p === 'gemini' || p === 'google gemini' || m.includes('gemini') || m.includes('veo') || m.includes('imagen') || m.includes('omni flash');
  let isRunningHub = !isGemini && (p === 'runninghub' || m.includes('runninghub') || m.includes('s2 motion') || m.includes('ambmedia') || m.includes('motion control motionfly') || (m === 'motion control' && p !== 'roboneo'));
  let isKie = !isGemini && (p === 'kie' || p === 'kie.ai' || m.includes('grok imagine 1.5')) && p !== 'weavy';
  let isGalleri5 = !isGemini && (p === 'galleri5' || (!isKie && p !== 'weavy' && (m.includes('standar') || m.includes('galleri5'))));
  let isRoboNeo = !isGemini && (p === 'roboneo' || (!isKie && !isGalleri5 && p !== 'weavy' && ((m.includes('kling 2.6') && !m.includes('standar')) || m.includes('hailuo') || m.includes('minimax'))));
  let isWeavy = !isGemini && (p === 'weavy' || m.includes('grok imagine image') || (!isGalleri5 && !isRoboNeo && !isKie && !isRunningHub));

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

  if (isVids) {
    return (
      <img
        src="https://ssl.gstatic.com/docs/videos/images/favicon-2026-v2.ico"
        alt="Google Vids"
        className="w-3.5 h-3.5 rounded object-contain shrink-0"
        title="Provider: Google Vids"
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

  // Weavy (default)
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

interface RecentGenerationsProps {
  items: GenerationItem[];
  onSelect: (item: GenerationItem) => void;
  onViewAll: () => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onRetryItem?: (id: string) => void;
  onSendAsReference?: (item: GenerationItem) => void;
  onReuseItem?: (item: GenerationItem) => void;
}

export const RecentGenerations: React.FC<RecentGenerationsProps> = ({
  items,
  onSelect,
  onViewAll,
  onDelete,
  onToggleFavorite,
  onRetryItem,
  onSendAsReference,
  onReuseItem,
}) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Live timer tick so that active tasks keep ticking accurately second-by-second in real-time
  const [now, setNow] = useState<number>(() => Date.now());

  const hasActiveItems = useMemo(
    () => items.some((it) => it.status === 'processing' || it.status === 'queued'),
    [items]
  );

  React.useEffect(() => {
    if (!hasActiveItems) return;

    // Tick every 1000ms continuously without being interrupted by re-renders
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [hasActiveItems]);

  const getLiveTimerString = (item: GenerationItem): string => {
    if (item.status === 'completed' || item.status === 'failed') {
      return item.timerString || '00:00';
    }
    const start =
      item.startedAt ||
      item.createdAtTimestamp ||
      (item.id.startsWith('gen-') ? Number(item.id.replace('gen-', '')) : null);
    if (start && !isNaN(start) && start > 0) {
      const elapsedSec = Math.max(1, Math.floor((now - start) / 1000));
      const mins = Math.floor(elapsedSec / 60);
      const remSecs = elapsedSec % 60;
      return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
    }
    return item.timerString || '00:01';
  };

  const getLiveProgress = (item: GenerationItem): number => {
    if (item.status === 'completed') return 100;
    if (item.status === 'failed') return 0;
    if (item.status === 'queued') return 100;
    const start =
      item.startedAt ||
      item.createdAtTimestamp ||
      (item.id.startsWith('gen-') ? Number(item.id.replace('gen-', '')) : null);
    if (start && !isNaN(start) && start > 0) {
      const elapsedSec = Math.max(1, Math.floor((now - start) / 1000));
      const timeBasedProgress = Math.min(10 + Math.floor(elapsedSec * 2.5), 94);
      return Math.max(item.progress || 10, timeBasedProgress);
    }
    return item.progress || 25;
  };

  const handleCopyPrompt = (item: GenerationItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const text = getCleanPrompt(item.prompt, item.model) || item.title || '';
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadItem = async (item: GenerationItem) => {
    if (!item.mediaUrl) {
      onSelect(item);
      return;
    }
    setDownloadingId(item.id);
    try {
      const cleanTitle = getCleanPrompt(item.prompt, item.model) || item.title || 'weavy_media';
      await downloadMediaFile(item.mediaUrl, cleanTitle, item.mode || 'image', item.model);
    } catch (e) {
      console.warn('Download media failed:', e);
      if (item.mediaUrl) {
        window.open(item.mediaUrl, '_blank');
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const displayedItems = items.slice(0, 4);

  return (
    <div className="mt-6 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-serif-display text-lg font-normal text-stone-900 dark:text-stone-100 tracking-tight">Recent Generations</h2>
        <button
          onClick={onViewAll}
          className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer"
        >
          <span>View all</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Grid Layout matching Style Guide */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {displayedItems.map((item) => {
          const isVideo = item.mode === 'video';
          const isQueued = item.status === 'queued';
          const isProcessing = item.status === 'processing';
          const isFailed = item.status === 'failed';
          const isCompleted = item.status === 'completed';

          return (
            <div
              key={item.id}
              className={`rounded-xl p-3 border transition-all duration-300 flex flex-col justify-between relative group ${
                isQueued
                  ? 'bg-amber-50/90 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40'
                  : isProcessing
                  ? 'bg-amber-50/70 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
                  : isFailed
                  ? 'bg-rose-50/70 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'
                  : 'bg-[#FAF9F6] dark:bg-[#141418] border-stone-300/80 dark:border-white/10 dark:hover:border-white/20'
              }`}
            >
              <div className="space-y-2.5">
                {/* Thumbnail Container */}
                <div
                  onClick={() => !isProcessing && !isQueued && onSelect(item)}
                  className="relative w-full h-36 bg-stone-900 rounded-lg cursor-pointer overflow-hidden flex items-center justify-center border border-black/10 dark:border-white/5"
                >
                  <MediaThumbnail
                    item={{
                      ...item,
                      progress: getLiveProgress(item),
                      timerString: getLiveTimerString(item),
                    }}
                    showPlayIcon={true}
                    hoverPlay={true}
                    className="w-full h-full"
                  />

                  {/* Duration or Aspect Ratio Badge */}
                  <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/75 backdrop-blur-xs rounded text-[9px] font-mono font-bold text-white z-10">
                    {isVideo
                      ? (item.model?.includes('Kling') ? 'Auto' : (item.duration || '00:15'))
                      : getAspectRatioLabel(item)}
                  </div>

                  {/* Top Completed Check Badge */}
                  {(isCompleted || (!item.status && (item.mediaUrl || item.thumbnailUrl))) && !isProcessing && !isQueued && (
                    <CheckCircle2 className="absolute top-1.5 right-1.5 w-4 h-4 text-emerald-500 drop-shadow-md z-10" title="Selesai" />
                  )}
                </div>

                {/* Right Details */}
                <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
                  <div>
                    {/* Header Row: Provider Icon + Title & Status Badge */}
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <ProviderBadgeIcon provider={item.provider} model={item.model} />
                        <p
                          onClick={() => !isProcessing && !isQueued && onSelect(item)}
                          className="text-xs sm:text-sm font-normal text-stone-800 dark:text-stone-200 line-clamp-1 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer leading-snug font-sans-body"
                          title={getCleanPrompt(item.prompt, item.model) || item.prompt}
                        >
                          {getShortPrompt(item.prompt, item.model) ? (
                            getShortPrompt(item.prompt, item.model)
                          ) : (
                            <span className="text-stone-400 dark:text-stone-500 italic font-light">(Tanpa Prompt)</span>
                          )}
                        </p>
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isQueued && (
                          <div className="flex items-center gap-1">
                            <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase rounded-md tracking-wider animate-pulse">
                              Queued
                            </span>
                            <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-semibold">
                              {getLiveTimerString(item)}
                            </span>
                          </div>
                        )}

                        {isProcessing && !isQueued && (
                          <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-semibold">
                            {getLiveTimerString(item)}
                          </span>
                        )}

                        {isFailed && (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[10px] font-bold uppercase rounded-md tracking-wider">
                              Failed
                            </span>
                            <span className="text-[11px] font-mono text-rose-900 dark:text-rose-300 font-semibold">
                              {getLiveTimerString(item)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Timestamp & Model Badge Row */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
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
                        <span>{getCleanModelName(item.model) || 'SeeDance 2.0 Mini'}</span>
                      </span>
                      <span className="text-[11px] text-stone-400 dark:text-stone-500 font-light">
                        {formatTo24h(item.timestamp)} • {item.model?.includes('Kling') ? 'Auto Ratio' : item.aspectRatio} • {item.model?.includes('Kling') ? 'Auto Res' : item.resolution}
                      </span>
                    </div>

                    {/* Direct Action Toolbar */}
                    <div className="flex items-center justify-between border-t border-stone-200/60 dark:border-stone-800/60 pt-2 mt-2 gap-1">
                      <div className="flex items-center gap-0.5">
                        {item.mediaUrl && onSendAsReference && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSendAsReference(item);
                            }}
                            className="p-1.5 text-stone-500 hover:text-amber-500 dark:hover:text-amber-400 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
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
                            className="p-1.5 text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
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
                          className="p-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                          title="Salin Prompt"
                        >
                          {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        {item.mediaUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadItem(item);
                            }}
                            disabled={downloadingId === item.id}
                            className="p-1.5 text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-50"
                            title="Download Hasil Media"
                          >
                            {downloadingId === item.id ? (
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
                          className="p-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
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
                          className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Queued / Processing Progress Bar with Task ID */}
                  {(isQueued || isProcessing) && (
                    <div className="mt-2 space-y-1.5">
                      <div className="w-full bg-amber-200/80 dark:bg-stone-700/80 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${isQueued ? 'bg-amber-500 animate-pulse' : 'bg-amber-600 dark:bg-amber-400'}`}
                          style={{ width: isQueued ? '100%' : `${getLiveProgress(item)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-stone-700 dark:text-stone-300">
                        {item.taskId ? (
                          <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                            <span className="text-stone-500 dark:text-stone-400 font-sans text-[10px] uppercase tracking-wider font-semibold shrink-0">Task ID:</span>
                            <span className="font-mono text-[11px] font-semibold text-amber-700 dark:text-amber-400 truncate max-w-[140px]" title={item.taskId}>
                              {item.taskId}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(item.taskId || '');
                                setCopiedId(item.id + '_task');
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              className="p-0.5 hover:text-amber-600 dark:hover:text-amber-300 transition-colors cursor-pointer shrink-0"
                              title="Salin Task ID"
                            >
                              {copiedId === item.id + '_task' ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200" />
                              )}
                            </button>
                          </div>
                        ) : isQueued ? (
                          <span className="italic text-[10px] text-amber-600 dark:text-amber-400 font-sans font-medium">Antre di RunningHub...</span>
                        ) : (
                          <span className="text-[10px] text-stone-500 dark:text-stone-400 font-sans">Mempersiapkan task...</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Error Retry Message */}
                  {isFailed && (
                    <div className="mt-2 flex items-center justify-between text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                      <span>{item.errorMessage || 'Failed to generate video. Please try again.'}</span>
                      {onRetryItem && (
                        <button
                          type="button"
                          onClick={() => onRetryItem(item.id)}
                          className="p-1 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-md transition-colors text-rose-700 dark:text-rose-300 shrink-0 cursor-pointer"
                          title="Try again"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
