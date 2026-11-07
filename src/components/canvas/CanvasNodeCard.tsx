import React, { useState, useRef, useEffect } from 'react';
import { dedupeStoryboardScenes } from '../../lib/storyboardScenes';
import {
  CanvasNode,
  CanvasPort,
  WEAVY_IMAGE_MODELS,
  WEAVY_PROMPT_ENHANCER_MODELS,
  WEAVY_LLM_MODELS,
  GEMINI_LLM_MODELS,
  PROMPT_ENHANCER_SYSTEM_PRESETS,
  GEMINI_VIDEO_MODELS,
  ImageModelNodeData,
  getNodeWidth,
  getPortOffsetTop,
  getStoryboardOutputs,
  getStoryboardNodeOutputs,
  getStoryboardPlannedSceneCount,
  getAiWorkerOutputs,
} from '../../types/canvas';
import { downloadMediaFile } from '../../utils';
import { optimizeImageForCanvas } from '../../utils/imageCompressor';
import { getCleanModelName } from '../../types';
import { CHAT_SLASH_PRESETS, getPresetBaseName } from '../chat/chatPresets';
import { buildSceneClipboardText } from '../chat/ChatStoryboardCopilotCard';
import {
  Sparkles,
  Type,
  Image as ImageIcon,
  Eye,
  Trash2,
  GripVertical,
  Play,
  Upload,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Maximize2,
  Copy,
  ChevronDown,
  ChevronUp,
  Plus,
  StickyNote,
  ArrowRight,
  Wand2,
  Link2,
  MoreHorizontal,
  AlignLeft,
  FileInput,
  Bot,
  Check,
  Pencil,
  Video,
  Film,
  Mic,
  Volume2,
  Clapperboard,
  Settings,
  SlidersHorizontal,
  Network,
  Zap,
  ShoppingBag,
} from 'lucide-react';

// Helper component for model icons in canvas headers and output nodes
export const ModelBadgeIcon: React.FC<{ model?: string; className?: string }> = ({ model, className = "w-4 h-4" }) => {
  const m = (model || '').toLowerCase();

  // 1. Nano Banana Pro
  if (m.includes('banana') || m.includes('nano')) {
    return (
      <svg
        className={`${className} shrink-0`}
        viewBox="0 0 600 600"
        fill="none"
      >
        <path fill="#F3AD61" d="M37.5 495.6a25 25 0 0 1 24.8-24.8h18.6a24.8 24.8 0 1 1 0 49.6H62.2a25 25 0 0 1-24.7-24.8"/>
        <path fill="#F9C23C" d="M371 337.5h176.8c13 0 19.6-16.4 10.4-26.1l-40.9-42.6a79.6 79.6 0 0 0-115.9 0l-40.8 42.6c-9.3 9.6-2.7 26.1 10.3 26.1m-281.3 0h176.9c13 0 19.6-16.5 10.3-26.1L236 268.8a79.6 79.6 0 0 0-116 0l-40.8 42.6c-9.2 9.6-2.6 26.1 10.4 26.1"/>
        <path fill="#FEEFC2" d="M313.1 38C405.4 24.8 462.4 261.1 421 356.6S289.7 473.1 194.5 510.4q-15.4 6-32 6.1c-36 0-55.6 29.7-69.3-7a93 93 0 0 1 51.7-119c50.4-19.7 77.1-57.6 97.3-109 20.5-52.4 21.9-74 21.8-131 0-45.7-3-105 49.1-112.5"/>
        <path fill="#FCD53F" d="m420.9 356.6-177.4-81.4a188 188 0 0 1-104 101c-54 21.3-90 79.3-60.5 138.6 59.1 118.1 342-1.3 342-158.2"/>
        <path fill="#F9C23C" fillRule="evenodd" d="M342 309a14 14 0 0 1 9.1 17.7C314 443 205.7 496.7 109 501.7a14 14 0 1 1-1.4-28.1C196.3 469 291.8 420 324.3 318a14 14 0 0 1 17.7-9" clipRule="evenodd"/>
        <path fill="#FFF478" d="m435.8 496.3-191.2-221h168.8a76 76 0 0 1 71.1 76.9v141.6c0 25-22.4 32.6-48.7 2.4"/>
      </svg>
    );
  }

  // Google Vids uses a different product icon from Gemini.
  if (m.includes('google vids') || m.includes('vids omni')) {
    return (
      <img
        src="https://ssl.gstatic.com/docs/videos/images/favicon-2026-v2.ico"
        alt="Vids Omni"
        className={`${className} object-contain shrink-0`}
        referrerPolicy="no-referrer"
        onError={(event) => {
          event.currentTarget.src = 'https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_flix_x32.png';
        }}
      />
    );
  }

  // 2. Google / Gemini
  if (m.includes('gemini') || m.includes('google') || m.includes('omni flash')) {
    return (
      <img
        src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg"
        alt="Google Gemini"
        className={`${className} object-contain shrink-0`}
      />
    );
  }

  // 2. ByteDance / Seedream / SeeDance
  if (m.includes('seedance') || m.includes('seedream') || m.includes('bytedance')) {
    return (
      <img
        src="https://lf3-static.bytednsdoc.com/obj/eden-cn/lapzild-tss/ljhwZthlaukjlkulzlp/favicon_1/favicon.ico"
        alt="ByteDance"
        className={`${className} object-contain shrink-0 rounded-xs`}
        referrerPolicy="no-referrer"
      />
    );
  }

  // 3. Grok / xAI
  if (m.includes('grok') || m.includes('xai')) {
    return (
      <img
        src="https://grok.com/images/favicon.ico"
        alt="Grok"
        className={`${className} object-contain shrink-0 rounded-xs`}
        referrerPolicy="no-referrer"
      />
    );
  }

  // 4. OpenAI / ChatGPT / GPT Image
  if (m.includes('chatgpt') || m.includes('gpt') || m.includes('openai')) {
    return (
      <div className={`${className} rounded-full bg-[#10a37f] flex items-center justify-center shrink-0 p-0.5 shadow-xs`}>
        <img
          src="https://chatgpt.com/cdn/assets/favicon-l4nq08hd.svg"
          alt="OpenAI"
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // 5. Kling
  if (m.includes('kling')) {
    return (
      <img
        src="https://kling.ai/favicon.ico"
        alt="Kling"
        className={`${className} object-contain shrink-0 rounded-xs`}
        referrerPolicy="no-referrer"
      />
    );
  }

  // 6. RunningHub / MiniMax / Motion Control
  if (m.includes('runninghub') || m.includes('minimax') || m.includes('motion control') || m.includes('s2') || m.includes('ambmedia') || m.includes('motionfly')) {
    return (
      <img
        src="https://www.runninghub.ai/favicon.ico?v=1.4"
        alt="RunningHub"
        className={`${className} object-contain shrink-0 rounded-xs`}
        referrerPolicy="no-referrer"
      />
    );
  }

  // 7. Galleri5
  if (m.includes('galleri5')) {
    return (
      <img
        src="https://aistudio.galleri5.com/assets/dark%20mode-D5XIT4aZ.png"
        alt="Galleri5"
        className={`${className} object-contain shrink-0`}
        referrerPolicy="no-referrer"
      />
    );
  }

  // 8. RoboNeo
  if (m.includes('roboneo')) {
    return (
      <img
        src="https://www.roboneo.com/favicon.ico"
        alt="RoboNeo"
        className={`${className} object-contain shrink-0`}
        referrerPolicy="no-referrer"
      />
    );
  }

  // 9. Kie
  if (m.includes('kie')) {
    return (
      <img
        src="https://kie.ai/logo.png"
        alt="Kie"
        className={`${className} object-contain shrink-0`}
        referrerPolicy="no-referrer"
      />
    );
  }

  // 10. Flux / Black Forest Labs
  if (m.includes('flux') || m.includes('bfl')) {
    return (
      <div className={`${className} rounded bg-stone-900 flex items-center justify-center shrink-0 p-0.5`}>
        <img
          src="https://blackforestlabs.ai/favicon.ico"
          alt="Flux"
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // 11. Midjourney
  if (m.includes('midjourney') || m.includes('mj')) {
    return (
      <img
        src="https://www.midjourney.com/favicon.ico"
        alt="Midjourney"
        className={`${className} object-contain shrink-0`}
        referrerPolicy="no-referrer"
      />
    );
  }

  // 12. Weavy / Flare
  if (m.includes('flare') || m.includes('weavy')) {
    return (
      <img
        src="https://cdn.prod.website-files.com/681b040781d5b5e278a69989/69d4f1efa9dc89ccca92be1a_logo%20-%20squeare%20Weavy%20W.svg"
        alt="Weavy"
        className={`${className} object-contain shrink-0`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return <Sparkles className={`${className} text-amber-500`} />;
};

interface CanvasNodeCardProps {
  node: CanvasNode;
  isSelected: boolean;
  onSelect: (e?: React.MouseEvent) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onUpdateData: (id: string, newData: any) => void;
  onRemoveWatermark?: (nodeId: string) => Promise<void>;
  onStartDrag: (nodeId: string, e: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>) => void;
  onStartConnect: (nodeId: string, portId: string, e: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>, isInput?: boolean) => void;
  onEndConnect: (nodeId: string, portId: string, isInput?: boolean) => void;
  onRunNode: (nodeId: string) => void;
  isExecuting?: boolean;
  isConnectingWire?: boolean;
  connectingWireSourceNodeId?: string;
  onToast?: (msg: string) => void;
  onOpenFullPreview?: (url: string, title?: string, model?: string, nodeId?: string) => void;
  onOpenMarkup?: (imageUrl: string, sourceNodeId: string, title?: string) => void;
  connectedInputPortIds?: string[];
  connectedOutputPortIds?: string[];
  connectedSourceAspectRatio?: string;
  connectedModelName?: string;
  connectedModelId?: string;
  onAddImageInput?: (nodeId: string) => void;
  onRemoveLastImageInput?: (nodeId: string) => void;
  onAddVideoInput?: (nodeId: string) => void;
  onRemoveLastVideoInput?: (nodeId: string) => void;
  onSpawnSceneNodes?: (storyboardNodeId: string) => void;
  onResetStoryboard?: (storyboardNodeId: string) => void;
  hideAiWorkerRunButton?: boolean;
  hasConnectedAiWorker?: boolean;
  productAnalysisStatus?: 'running' | 'valid' | 'error';
  connectedPrompt?: string;
  connectedVoiceover?: string;
  connectedShoots?: any[];
  connectedSceneNumber?: number;
  connectedSceneTitle?: string;
}

// Helper to compute CSS aspect ratio for container
const getViewerAspectStyle = (
  ratio?: string,
  naturalWidth?: number,
  naturalHeight?: number
): React.CSSProperties => {
  if (naturalWidth && naturalHeight && naturalHeight > 0) {
    return { aspectRatio: `${naturalWidth} / ${naturalHeight}` };
  }
  switch (ratio) {
    case '16:9':
      return { aspectRatio: '16 / 9' };
    case '9:16':
      return { aspectRatio: '9 / 16' };
    case '4:3':
      return { aspectRatio: '4 / 3' };
    case '3:4':
      return { aspectRatio: '3 / 4' };
    case '1:1':
    default:
      return { aspectRatio: '1 / 1' };
  }
};

// Resilient Media Preview with Dynamic Aspect Ratio, Auto-Proxy Fallback, Retry & Download Handling
const CanvasMediaPreview: React.FC<{
  url: string;
  aspectRatio?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  onToast?: (msg: string) => void;
  onOpenFullPreview?: (url: string, title?: string, model?: string, nodeId?: string) => void;
  onDimensionsDetected?: (width: number, height: number) => void;
  previewTitle?: string;
  model?: string;
  extraActions?: React.ReactNode;
  hideDownloadAndCopy?: boolean;
  onOpenMarkup?: () => void;
}> = ({
  url,
  aspectRatio = '1:1',
  naturalWidth: initialNaturalWidth,
  naturalHeight: initialNaturalHeight,
  onToast,
  onOpenFullPreview,
  onDimensionsDetected,
  previewTitle,
  model,
  extraActions,
  hideDownloadAndCopy = false,
  onOpenMarkup,
}) => {
  const [useProxy, setUseProxy] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number } | null>(
    initialNaturalWidth && initialNaturalHeight
      ? { width: initialNaturalWidth, height: initialNaturalHeight }
      : null
  );

  const imgRef = useRef<HTMLImageElement | null>(null);
  const cleanUrl = (url || '').trim();
  const isVideo = cleanUrl.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/i);

  // If direct URL failed, fall back to our server's proxy
  const effectiveSrc = useProxy
    ? isVideo
      ? `/api/proxy-video?url=${encodeURIComponent(cleanUrl)}`
      : `/api/proxy-image?url=${encodeURIComponent(cleanUrl)}`
    : cleanUrl;

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const success = await downloadMediaFile(cleanUrl, 'canvas_output', isVideo ? 'video' : 'image');
      if (success) {
        if (onToast) onToast('Media berhasil diunduh ke komputer!');
      } else {
        if (onToast) onToast('Gagal download otomatis, membuka file...');
      }
    } catch (err) {
      console.error('[CanvasNodeCard] Download error:', err);
      if (onToast) onToast('Terjadi kesalahan saat download.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Reset error & proxy state when cleanUrl changes
  useEffect(() => {
    setUseProxy(false);
    setHasError(false);
  }, [cleanUrl, retryKey]);

  // Sync dimensions if updated externally
  useEffect(() => {
    if (initialNaturalWidth && initialNaturalHeight) {
      setNaturalDimensions((prev) => {
        if (prev?.width === initialNaturalWidth && prev?.height === initialNaturalHeight) return prev;
        return { width: initialNaturalWidth, height: initialNaturalHeight };
      });
    }
  }, [initialNaturalWidth, initialNaturalHeight]);

  // Immediately detect dimensions if cached by browser
  useEffect(() => {
    if (!isVideo && imgRef.current) {
      const img = imgRef.current;
      if (img.complete && img.naturalWidth > 0) {
        setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        onDimensionsDetected?.(img.naturalWidth, img.naturalHeight);
      }
    }
  }, [effectiveSrc, isVideo]);

  const handleMediaError = () => {
    if (!useProxy) {
      console.warn('[CanvasMediaPreview] Direct URL failed to load in browser, switching to proxy fallback:', cleanUrl);
      setUseProxy(true);
    } else {
      console.error('[CanvasMediaPreview] Both direct and proxy failed to load:', cleanUrl);
      setHasError(true);
    }
  };

  const handleRetry = () => {
    setUseProxy(false);
    setHasError(false);
    setRetryKey((k) => k + 1);
  };

  return (
    <div
      className="relative group rounded-xl overflow-hidden bg-stone-900 border border-stone-200 dark:border-white/10 flex items-center justify-center w-full transition-all duration-200 canvas-checkerboard"
      style={getViewerAspectStyle(aspectRatio, naturalDimensions?.width, naturalDimensions?.height)}
    >
      {hasError ? (
        <div className="w-full h-full p-4 flex flex-col items-center justify-center text-center text-stone-400 space-y-2 overflow-y-auto">
          <div className="w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-200">Gagal Memuat Preview</p>
            <p className="text-[10px] text-stone-400 mt-0.5 max-w-[200px] line-clamp-2">
              Media siap di server, tetapi browser memblokir direct render.
            </p>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={handleRetry}
              className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Coba Lagi
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-[11px] font-semibold flex items-center gap-1 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              Download
            </button>
          </div>
        </div>
      ) : !cleanUrl ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-stone-500 text-xs text-center">
          <ImageIcon className="w-6 h-6 mb-1 text-stone-600" />
          <span>Tidak ada media</span>
        </div>
      ) : isVideo ? (
        <video
          key={effectiveSrc}
          src={effectiveSrc || undefined}
          controls
          playsInline
          autoPlay
          loop
          muted
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onLoadedData={(e) => {
            const vid = e.currentTarget;
            if (vid.videoWidth && vid.videoHeight) {
              setNaturalDimensions({ width: vid.videoWidth, height: vid.videoHeight });
              onDimensionsDetected?.(vid.videoWidth, vid.videoHeight);
            }
          }}
          onError={handleMediaError}
          className="w-full h-full object-cover select-none"
        />
      ) : (
        <img
          ref={imgRef}
          key={effectiveSrc}
          src={effectiveSrc || undefined}
          alt="Generated Output"
          referrerPolicy="no-referrer"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) {
              setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
              onDimensionsDetected?.(img.naturalWidth, img.naturalHeight);
            }
          }}
          onError={handleMediaError}
          className="w-full h-full object-cover select-none"
        />
      )}

      {/* Floating Action Buttons on Hover */}
      {!hasError && (
        <div className="absolute inset-0 bg-stone-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-auto z-20">
          <button
            type="button"
            onClick={() => {
              if (onOpenFullPreview) {
                const titleToUse = previewTitle || model || 'ChatGPT Images 2.0 Edit';
                onOpenFullPreview(cleanUrl, titleToUse, model || previewTitle);
              } else {
                window.open(cleanUrl, '_blank');
              }
            }}
            className="p-2 rounded-xl bg-white/90 text-stone-900 hover:bg-white transition-colors cursor-pointer shadow-md"
            title="Buka Penuh (Popup)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          {onOpenMarkup && (
            <button
              type="button"
              onClick={onOpenMarkup}
              className="p-2 rounded-xl bg-white/90 text-stone-900 hover:bg-white transition-colors cursor-pointer shadow-md hover:text-amber-600"
              title="Coret / Tandai Gambar (Markup)"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {extraActions}
          {!hideDownloadAndCopy && (
            <>
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="p-2 rounded-xl bg-white/90 text-stone-900 hover:bg-white transition-colors cursor-pointer shadow-md disabled:opacity-50"
                title="Download Media"
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(cleanUrl);
                  setCopied(true);
                  if (onToast) onToast('URL gambar disalin!');
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="p-2 rounded-xl bg-white/90 text-stone-900 hover:bg-white transition-colors cursor-pointer shadow-md"
                title="Salin URL"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const CanvasNodeCard: React.FC<CanvasNodeCardProps> = ({
  node,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  onUpdateData,
  onRemoveWatermark,
  onStartDrag,
  onStartConnect,
  onEndConnect,
  onRunNode,
  isExecuting = false,
  isConnectingWire = false,
  connectingWireSourceNodeId,
  onToast,
  onOpenFullPreview,
  onOpenMarkup,
  connectedInputPortIds = [],
  connectedOutputPortIds = [],
  connectedSourceAspectRatio,
  connectedModelName,
  connectedModelId,
  onAddImageInput,
  onRemoveLastImageInput,
  onAddVideoInput,
  onRemoveLastVideoInput,
  onSpawnSceneNodes,
  onResetStoryboard,
  hideAiWorkerRunButton = false,
  hasConnectedAiWorker = false,
  productAnalysisStatus,
  connectedPrompt,
  connectedVoiceover,
  connectedShoots,
  connectedSceneNumber,
  connectedSceneTitle,
}) => {
  const [showNegative, setShowNegative] = useState(false);
  const [isUrlInputOpen, setIsUrlInputOpen] = useState(false);
  const [tempUrl, setTempUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedEnhanced, setCopiedEnhanced] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [isDragOverFile, setIsDragOverFile] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoLoadProgress, setVideoLoadProgress] = useState(0);
  const [isRemovingWatermark, setIsRemovingWatermark] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [geminiElapsedSeconds, setGeminiElapsedSeconds] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if ((node.type !== 'geminiVideo' && node.type !== 'vidsVideo') || node.data?.status !== 'running' || !node.data?.startedAt) {
      setGeminiElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      setGeminiElapsedSeconds(Math.floor((Date.now() - node.data.startedAt) / 1000));
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [node.id, node.type, node.data?.startedAt, node.data?.status]);

  const handleCopyText = (key: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1500);
    if (onToast) onToast('Disalin ke clipboard!');
  };

  // Close options menu when clicking outside
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Derive model name for imageViewer node
  const rawModelName =
    node.data?.modelDisplayName ||
    node.data?.modelName ||
    connectedModelName ||
    (node.title && node.title !== 'Image Output' && node.title !== 'Result Viewer' && node.title !== 'Viewer Node' ? node.title : '') ||
    'ChatGPT Images 2.0 Edit';
  const effectiveModelName = getCleanModelName(rawModelName);
  const effectiveModelTitle = node.type === 'imageModel'
    ? (node.data?.modelDisplayName || node.title || 'ChatGPT Images 2.0 Edit')
    : (node.type === 'imageViewer' ? effectiveModelName : node.title);

  const effectiveRatio =
    node.data?.aspectRatio ||
    connectedSourceAspectRatio ||
    '1:1';

  const nodeWidth = getNodeWidth(node, connectedSourceAspectRatio);

  // Guarantee that storyboard outputs match exact scenes, and other nodes have standard ports
  const effectiveOutputs =
    node.type === 'storyboard'
      ? // Konektor "Full Script" disembunyikan dari node Storyboard Copilot.
        getStoryboardNodeOutputs(node.data).filter(
          (p) => !/full[\s_-]?script/i.test(`${p.id} ${p.name || ''} ${p.label || ''}`)
        )
      : node.type === 'aiWorker'
      ? getAiWorkerOutputs(node.data)
      : node.type === 'imageInput'
      ? [
          ...(node.outputs && node.outputs.length > 0
            ? node.outputs
            : [{ id: 'output-image', name: 'image', type: 'image' as const, label: 'Image Output' }]),
          ...((!node.data?.videoUrl || (node.outputs || []).some((port) => port.id === 'output-video'))
            ? []
            : [{ id: 'output-video', name: 'video', type: 'video' as const, label: 'Video Output' }]),
        ]
      : node.outputs && node.outputs.length > 0
      ? node.outputs
      : node.type === 'imageViewer' || node.type === 'imageModel'
      ? [
          {
            id: node.type === 'imageModel' ? 'output-result' : 'output-image',
            name: 'image',
            type: 'image' as const,
            label: 'Image',
          },
        ]
      : node.type === 'geminiVideo' || node.type === 'vidsVideo' || node.type === 'videoStitcher'
      ? [
          {
            id: 'output-video',
            name: 'video',
            type: 'video' as const,
            label: node.type === 'videoStitcher' ? 'Stitched Video' : node.type === 'vidsVideo' ? 'Vids Omni Video' : 'Video',
          },
        ]
      : node.type === 'promptEnhancer' || node.type === 'anyLLM'
      ? [
          {
            id: 'output-text',
            name: 'text',
            type: 'text' as const,
            label: 'Text',
          },
        ]
      : [];

  const getHeaderTheme = () => {
    switch (node.type) {
      case 'storyboard':
        return {
          bg: 'bg-stone-50 dark:bg-[#16161b]',
          border: 'border-stone-200/80 dark:border-white/[0.07]',
          text: 'text-stone-900 dark:text-stone-100',
          badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
          dot: 'bg-amber-500',
          icon: Film,
        };
      case 'aiWorker':
        return {
          bg: 'bg-stone-50 dark:bg-[#16161b]',
          border: 'border-stone-200/80 dark:border-white/[0.07]',
          text: 'text-stone-900 dark:text-stone-100',
          badge: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
          dot: 'bg-teal-500',
          icon: ShoppingBag,
        };
      case 'prompt':
        return {
          bg: 'bg-stone-50 dark:bg-[#16161b]',
          border: 'border-stone-200/80 dark:border-white/[0.07]',
          text: 'text-stone-900 dark:text-stone-100',
          badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
          dot: 'bg-emerald-500',
          icon: Type,
        };
      case 'promptEnhancer':
      case 'anyLLM':
        return {
          bg: 'bg-stone-50 dark:bg-[#16161b]',
          border: 'border-stone-200/80 dark:border-white/[0.07]',
          text: 'text-stone-900 dark:text-stone-100',
          badge: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
          dot: 'bg-purple-500',
          icon: Bot,
        };
      case 'geminiVideo':
        return {
          bg: 'bg-stone-50 dark:bg-[#16161b]',
          border: 'border-stone-200/80 dark:border-white/[0.07]',
          text: 'text-stone-900 dark:text-stone-100',
          badge: 'bg-stone-500/15 text-stone-600 dark:text-stone-300',
          dot: 'bg-stone-400',
          icon: Video,
        };
      case 'vidsVideo':
        return {
          bg: 'bg-stone-50 dark:bg-[#16161b]',
          border: 'border-stone-200/80 dark:border-white/[0.07]',
          text: 'text-stone-900 dark:text-stone-100',
          badge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
          dot: 'bg-blue-500',
          icon: Video,
        };
      case 'videoStitcher':
        return {
          bg: 'bg-stone-50 dark:bg-[#16161b]',
          border: 'border-stone-200/80 dark:border-white/[0.07]',
          text: 'text-stone-900 dark:text-stone-100',
          badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
          dot: 'bg-rose-500',
          icon: Film,
        };
      case 'imageInput':
        return {
          bg: 'bg-stone-50 dark:bg-[#16161b]',
          border: 'border-stone-200/80 dark:border-white/[0.07]',
          text: 'text-stone-900 dark:text-stone-100',
          badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
          dot: 'bg-sky-500',
          icon: ImageIcon,
        };
      case 'imageModel':
        return {
          bg: 'bg-stone-50 dark:bg-[#16161b]',
          border: 'border-stone-200/80 dark:border-white/[0.07]',
          text: 'text-stone-900 dark:text-stone-100',
          badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
          dot: 'bg-amber-500',
          icon: Sparkles,
        };
      case 'imageViewer': {
        return {
          bg: 'bg-stone-50 dark:bg-[#16161b]',
          border: 'border-stone-200/80 dark:border-white/[0.07]',
          text: 'text-stone-900 dark:text-stone-100',
          badge: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
          dot: 'bg-indigo-500',
          icon: Eye,
        };
      }
      case 'note':
        return {
          bg: 'bg-amber-50/80 dark:bg-[#1a1712]',
          border: 'border-amber-200/70 dark:border-amber-500/20',
          text: 'text-amber-900 dark:text-amber-200',
          badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
          dot: 'bg-amber-400',
          icon: StickyNote,
        };
      default:
        return {
          bg: 'bg-stone-50 dark:bg-[#16161b]',
          border: 'border-stone-200/80 dark:border-white/[0.07]',
          text: 'text-stone-900 dark:text-stone-100',
          badge: 'bg-stone-500/15 text-stone-600 dark:text-stone-400',
          dot: 'bg-stone-400',
          icon: Sparkles,
        };
    }
  };

  const theme = getHeaderTheme();
  const Icon = theme.icon;

  const handleMediaFile = async (file: File) => {
    const isVideo =
      file.type.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/i.test(file.name);

    if (isVideo) {
      setIsLoadingVideo(true);
      setVideoLoadProgress(0);
      try {
        const videoUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onprogress = (event) => {
            if (event.lengthComputable) {
              setVideoLoadProgress(Math.round((event.loaded / event.total) * 100));
            }
          };
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              reject(new Error('Browser tidak menghasilkan data video yang valid.'));
            }
          };
          reader.onerror = () => reject(reader.error || new Error('Gagal membaca file video.'));
          reader.onabort = () => reject(new Error('Pembacaan file video dibatalkan.'));
          reader.readAsDataURL(file);
        });
        onUpdateData(node.id, {
          ...node.data,
          imageUrl: undefined,
          videoUrl,
          mediaType: 'video',
          fileName: file.name,
          naturalWidth: undefined,
          naturalHeight: undefined,
          aspectRatio: undefined,
        });
        if (onToast) onToast(`Video (${file.name}) dimuat dan disimpan lokal di canvas.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (onToast) onToast(`Gagal memuat video: ${message}`);
      } finally {
        setIsLoadingVideo(false);
        setVideoLoadProgress(0);
      }
      return;
    }

    if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i.test(file.name)) {
      if (onToast) onToast('Format file tidak didukung. Pilih gambar atau video.');
      return;
    }

    try {
      const optimized = await optimizeImageForCanvas(file);
      onUpdateData(node.id, {
        ...node.data,
        imageUrl: optimized.dataUrl,
        videoUrl: undefined,
        mediaType: 'image',
        fileName: file.name,
        naturalWidth: optimized.width,
        naturalHeight: optimized.height,
        aspectRatio: optimized.aspectRatio,
      });
    } catch (err) {
      console.warn('Failed to process uploaded image:', err);
      if (onToast) onToast(`Gagal memproses gambar: ${file.name}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleMediaFile(file);
    e.target.value = '';
  };

  const handleModelChange = (modelId: string) => {
    const found = WEAVY_IMAGE_MODELS.find((m) => m.id === modelId);
    if (!found) return;

    onUpdateData(node.id, {
      ...node.data,
      modelId: found.id,
      modelDisplayName: found.name,
      creditsCost: found.credits,
      aspectRatio: found.defaultAspectRatio,
      resolution: found.defaultResolution,
    });
  };

  const handleGeminiVideoModelChange = (_modelId: string) => {
    onUpdateData(node.id, {
      ...node.data,
      modelId: 'gemini-omni-1.1-flash',
      modelDisplayName: 'Gemini Omni Flash',
      duration: '10s',
      aspectRatio: node.data?.aspectRatio || '9:16',
    });
  };

  return (
    <div
      data-node-id={node.id}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, input, textarea, select, a, [data-prevent-select]')) return;
        onSelect(e);
      }}
      className={`canvas-light-skin canvas-node-card group/card relative rounded-2xl bg-[#1c1c21] border transition-all duration-150 shadow-xl ${
        isSelected
          ? 'border-white/40 ring-1 ring-white/20 shadow-2xl'
          : 'border-white/[0.12] hover:border-white/25'
      }`}
      style={{ width: `${nodeWidth}px`, minHeight: '150px' }}
    >
      {/* Input Ports (Left Edge) - Weavy Design Connectors */}
      {node.inputs.map((port, idx) => {
        const isTarget = isConnectingWire && connectingWireSourceNodeId !== node.id;
        const isConnected = connectedInputPortIds?.includes(port.id);
        const isTextPort = port.type === 'text' || port.id.includes('prompt');
        // Port video: node Video Stitcher (termasuk recipe lama yang tersimpan bertipe 'image')
        // atau port yang memang bertipe/ber-id video.
        const isVideoInputPort = !isTextPort && (
          node.type === 'videoStitcher' || port.type === 'video' || port.id.includes('video')
        );
        const portColor = isTextPort ? '#F1A0FA' : isVideoInputPort ? '#EF9092' : '#6EDDB3';
        // Port gambar selalu diberi nomor berurutan: Image 1, Image 2, ... (tanpa "Opsional")
        const imageOrdinal = node.inputs
          .slice(0, idx + 1)
          .filter((p) => !(p.type === 'text' || p.id.includes('prompt'))).length;
        // Keep Storyboard Copilot connector labels short, including nodes saved before this update.
        const portLabel = node.type === 'storyboard'
          ? (port.id === 'input-brief' || port.name === 'brief'
              ? 'Prompt'
              : port.id === 'input-ai-worker' || port.name === 'ai_worker_context'
                ? 'AI Worker'
                : isTextPort ? 'Prompt' : `Image ${imageOrdinal}`)
          : node.type === 'videoStitcher'
            ? `Video ${imageOrdinal}`
            : (node.type === 'aiWorker' && port.label ? port.label : isTextPort ? 'Prompt' : `Image ${imageOrdinal}`);

        return (
          <div
            key={port.id}
            className="absolute left-0 -translate-x-1/2 w-6 h-8 flex items-center justify-center group cursor-crosshair z-30"
            style={{ top: `${getPortOffsetTop(node.type, idx)}px` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartConnect(node.id, port.id, e, true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              onEndConnect(node.id, port.id, true);
            }}
          >
            {/* Connector Label on the Left (Appears only when node is actively selected) */}
            {isSelected && (
              <span
                className="absolute right-full mr-2 text-[11px] font-medium tracking-tight whitespace-nowrap pointer-events-none select-none transition-opacity duration-150"
                style={{ color: portColor }}
              >
                {portLabel}
              </span>
            )}

            {/* Precision Connector Bead: Normal ring connector without star/gear */}
            {isTextPort ? (
              <div
                className={`w-[14px] h-[14px] rounded-full border-[2.5px] bg-[#141418] transition-all duration-150 shadow-xs flex items-center justify-center select-none ${
                  isTarget ? 'scale-125 ring-2 ring-white/80' : 'group-hover:scale-115'
                }`}
                style={{
                  borderColor: '#F1A0FA',
                  boxShadow: isConnected ? '0 0 8px #F1A0FA80' : undefined,
                }}
                title={portLabel}
              >
                {isConnected && (
                  <div className="w-[4px] h-[4px] rounded-full bg-[#F1A0FA]" />
                )}
              </div>
            ) : (
              <div
                className={`w-[14px] h-[14px] rounded-full border-[2.5px] bg-[#141418] transition-all duration-150 shadow-xs flex items-center justify-center select-none ${
                  isTarget ? 'scale-125 ring-2 ring-white/80' : 'group-hover:scale-115'
                }`}
                style={{
                  borderColor: '#6EDDB3',
                  boxShadow: isConnected ? '0 0 8px #6EDDB380' : undefined,
                }}
                title={portLabel}
              >
                {isConnected && (
                  <div className="w-[4px] h-[4px] rounded-full bg-[#6EDDB3]" />
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Output Ports (Right Edge) - Weavy Design Connectors */}
      {effectiveOutputs.map((port, idx) => {
        const isTarget = isConnectingWire && connectingWireSourceNodeId !== node.id;
        const isConnected = connectedOutputPortIds?.includes(port.id);
        // Port "Scene N Image" milik Storyboard Copilot bertipe teks (berisi prompt gambar),
        // tapi konektornya ditampilkan hijau seperti konektor image di node lain.
        const isSceneImagePort = node.type === 'storyboard' && /^scene\d+_image$/i.test(port.id);
        const isTextPort = (port.type === 'text' || port.id.includes('prompt')) && !isSceneImagePort;
        const isFileInput = node.type === 'imageInput';
        const isVideoOutputPort = port.type === 'video' || port.id.includes('video');
        const portColor = isTextPort ? '#F1A0FA' : isVideoOutputPort ? '#EF9092' : isFileInput ? '#ffffff' : '#6EDDB3';
        const portLabel =
          node.type === 'prompt'
            ? ''
            : node.type === 'promptEnhancer' || node.type === 'anyLLM'
            ? 'Text'
            : node.type === 'imageModel'
            ? 'Image'
            : node.type === 'imageInput'
            ? isVideoOutputPort ? 'Video' : 'Image'
            : (port.label || 'Result');

        return (
          <div
            key={port.id}
            className="absolute right-0 translate-x-1/2 w-6 h-8 flex items-center justify-center group cursor-crosshair z-30"
            style={{ top: `${getPortOffsetTop(node.type, idx)}px` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartConnect(node.id, port.id, e, false);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              onEndConnect(node.id, port.id, false);
            }}
          >
            {/* Output Connector Label on the Right (Appears only when node is actively selected) */}
            {isSelected && portLabel && (
              <span
                className="absolute left-full ml-2 text-[11px] font-medium tracking-tight whitespace-nowrap pointer-events-none select-none transition-opacity duration-150"
                style={{ color: portColor }}
              >
                {portLabel}
              </span>
            )}

            {/* Precision Connector Ring / Target Bead */}
            {isTextPort ? (
              <div
                className={`w-[14px] h-[14px] rounded-full bg-[#141418] border-[2.5px] transition-all duration-150 shadow-xs flex items-center justify-center ${
                  isTarget ? 'scale-125 ring-2 ring-white/80' : 'group-hover:scale-115'
                }`}
                style={{
                  borderColor: '#F1A0FA',
                  boxShadow: isConnected ? '0 0 8px #F1A0FA80' : undefined,
                }}
                title={port.label || port.name}
              >
                {isConnected && (
                  <div className="w-[4px] h-[4px] rounded-full bg-[#F1A0FA]" />
                )}
              </div>
            ) : isFileInput ? (
              <div
                className={`w-[14px] h-[14px] rounded-full bg-[#141418] border-[2.5px] transition-all duration-150 shadow-xs flex items-center justify-center ${
                  isTarget ? 'scale-125 ring-2 ring-white/80' : 'group-hover:scale-115'
                }`}
                style={{
                  borderColor: '#ffffff',
                  boxShadow: isConnected ? '0 0 8px rgba(255,255,255,0.6)' : undefined,
                }}
                title={port.label || port.name}
              >
                {isConnected && (
                  <div className="w-[4px] h-[4px] rounded-full bg-white" />
                )}
              </div>
            ) : (
              <div
                className={`w-[14px] h-[14px] rounded-full bg-[#141418] border-[2.5px] transition-all duration-150 shadow-xs flex items-center justify-center ${
                  isTarget ? 'scale-125 ring-2 ring-white/80' : 'group-hover:scale-115'
                }`}
                style={{
                  borderColor: '#6EDDB3',
                  boxShadow: isConnected ? '0 0 8px #6EDDB380' : undefined,
                }}
                title={port.label || port.name}
              >
                {isConnected && (
                  <div className="w-[4px] h-[4px] rounded-full bg-[#6EDDB3]" />
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Node Header Row (Drag handle & title & options menu) */}
      <div
        className="flex items-center justify-between px-3.5 pt-3 pb-2 cursor-grab active:cursor-grabbing select-none"
        data-drag-handle="true"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button, input, textarea, select, a')) return;
          onStartDrag(node.id, e);
        }}
      >
        <div className="flex items-center gap-2 overflow-hidden min-w-0">
          {node.type === 'storyboard' ? (
            <>
              <Film className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-xs font-semibold text-white tracking-tight truncate max-w-[150px]">
                {node.title || 'Storyboard Copilot'}
              </span>
              <span className={`text-[9px] font-mono font-medium px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                (node.data?.provider || 'weavy') === 'gemini'
                  ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              }`}>
                {(node.data?.provider || 'weavy') === 'gemini' ? 'Gemini' : 'Weavy'}
              </span>
              {productAnalysisStatus === 'valid' && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0 bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                  Analisis valid
                </span>
              )}
              {productAnalysisStatus === 'running' && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0 bg-amber-500/10 text-amber-300 border border-amber-500/25">
                  Menganalisis...
                </span>
              )}
              {productAnalysisStatus === 'error' && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0 bg-rose-500/10 text-rose-300 border border-rose-500/25">
                  Analisis gagal
                </span>
              )}
            </>
          ) : node.type === 'aiWorker' ? (
            <>
              <ShoppingBag className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span className="text-xs font-semibold text-white tracking-tight truncate max-w-[150px]">
                {node.title || 'AI Worker'}
              </span>
            </>
          ) : node.type === 'prompt' ? (
            <>
              <span className="text-xs font-semibold text-stone-300 font-mono">T</span>
              <span className="text-xs font-semibold text-white tracking-tight">Prompt</span>
            </>
          ) : node.type === 'promptEnhancer' || node.type === 'anyLLM' ? (
            <>
              <Bot className="w-3.5 h-3.5 text-purple-400 stroke-[2.2] shrink-0" />
              <span className="text-xs font-semibold text-white tracking-tight truncate max-w-[210px]">
                {node.type === 'anyLLM'
                  ? (node.data?.modelDisplayName || 'Any LLM')
                  : (node.data?.modelDisplayName ? `Enhancer (${node.data.modelDisplayName})` : 'Prompt Enhancer')}
              </span>
            </>
          ) : node.type === 'videoStitcher' ? (
            <>
              <Film className="w-3.5 h-3.5 text-rose-400 stroke-[2] shrink-0" />
              <span className="text-xs font-semibold text-white tracking-tight truncate max-w-[210px]">
                Video Stitcher
              </span>
            </>
          ) : node.type === 'geminiVideo' ? (
            <>
              <img
                src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg"
                alt="Gemini Omni Flash"
                className="w-3.5 h-3.5 object-contain shrink-0"
              />
              <span className="text-xs font-semibold text-white tracking-tight truncate max-w-[210px]">
                Gemini Omni Flash
              </span>
            </>
          ) : node.type === 'vidsVideo' ? (
            <>
              <img
                src="https://ssl.gstatic.com/docs/videos/images/favicon-2026-v2.ico"
                alt="Google Vids"
                className="w-3.5 h-3.5 object-contain rounded shrink-0"
                referrerPolicy="no-referrer"
                onError={(event) => {
                  event.currentTarget.src = 'https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_flix_x32.png';
                }}
              />
              <span className="text-xs font-semibold text-white tracking-tight truncate max-w-[210px]">
                Vids Omni
              </span>
            </>
          ) : node.type === 'imageModel' ? (
            <>
              <ModelBadgeIcon
                model={node.data?.modelId || node.data?.modelDisplayName || effectiveModelTitle}
                className="w-4 h-4 shrink-0"
              />
              <span className="text-xs font-semibold text-white tracking-tight truncate max-w-[210px]">
                {effectiveModelTitle}
              </span>
            </>
          ) : node.type === 'imageInput' ? (
            <>
              <FileInput className="w-3.5 h-3.5 text-stone-200 stroke-[2] shrink-0" />
              <span className="text-xs font-semibold text-white tracking-tight">File</span>
            </>
          ) : node.type === 'imageViewer' ? (
            <>
              <Eye className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-xs font-semibold text-white tracking-tight">Image Viewer</span>
            </>
          ) : (
            <>
              <StickyNote className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-white tracking-tight">Sticky Note</span>
            </>
          )}
        </div>

        {/* ... Button for Options */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen((prev) => !prev);
            }}
            className="p-1 rounded-md text-stone-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer select-none"
            title="Opsi Node"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 w-52 rounded-xl bg-[#202026] border border-white/[0.12] shadow-2xl py-1.5 z-50 text-xs text-stone-200"
              onClick={(e) => e.stopPropagation()}
            >
              {node.type === 'geminiVideo' && (
                <>
                  <div className="px-3 py-1 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    Model Video
                  </div>
                  <div className="py-1">
                    <div className="w-full px-3 py-1.5 flex items-center justify-between text-xs text-stone-200 font-medium">
                      <div className="flex items-center gap-2 truncate">
                        <img
                          src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg"
                          alt="Gemini Omni Flash"
                          className="w-3.5 h-3.5 object-contain shrink-0"
                        />
                        <span className="truncate">Gemini Omni Flash</span>
                      </div>
                      <CheckCircle className="w-3.5 h-3.5 shrink-0 ml-1 text-emerald-400" />
                    </div>
                  </div>
                  <div className="my-1 border-t border-white/[0.08]" />
                </>
              )}

              {node.type === 'imageModel' && (
                <>
                  <div className="px-3 py-1 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    Ganti Model
                  </div>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {WEAVY_IMAGE_MODELS.map((m) => {
                      const isActive =
                        (node.data?.modelId || node.data?.modelDisplayName) === m.id ||
                        node.data?.modelDisplayName === m.name;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            handleModelChange(m.id);
                            setIsMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 flex items-center justify-between text-xs hover:bg-white/[0.08] cursor-pointer ${
                            isActive ? 'text-[#c084fc] font-medium' : 'text-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <ModelBadgeIcon model={m.id || m.name} className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{m.name}</span>
                          </div>
                          {isActive && <CheckCircle className="w-3.5 h-3.5 shrink-0 ml-1 text-[#c084fc]" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="my-1 border-t border-white/[0.08]" />
                </>
              )}

              {(node.type === 'promptEnhancer' || node.type === 'anyLLM') && (
                <>
                  <div className="px-3 py-1 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    Model LLM
                  </div>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {WEAVY_PROMPT_ENHANCER_MODELS.map((m) => {
                      const isActive = (node.data?.model || '') === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            onUpdateData(node.id, {
                              ...node.data,
                              model: m.id,
                              modelDisplayName: m.name,
                            });
                            setIsMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 flex items-center justify-between text-xs hover:bg-white/[0.08] cursor-pointer ${
                            isActive ? 'text-[#c084fc] font-medium' : 'text-stone-300'
                          }`}
                        >
                          <span className="truncate">{m.name}</span>
                          {isActive && <CheckCircle className="w-3.5 h-3.5 shrink-0 ml-1 text-[#c084fc]" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="my-1 border-t border-white/[0.08]" />
                </>
              )}

              {onDuplicate && (
                <button
                  type="button"
                  onClick={() => {
                    onDuplicate(node.id);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-white/[0.08] flex items-center gap-2 cursor-pointer text-stone-300 hover:text-white"
                >
                  <Copy className="w-3.5 h-3.5 text-stone-400" />
                  <span>Duplikat Node</span>
                </button>
              )}

              {/* Coret / Markup Action if node has an image */}
              {onOpenMarkup && (node.data?.imageUrl || node.data?.outputImage || node.data?.resultUrl) && (
                <button
                  type="button"
                  onClick={() => {
                    const img = node.data?.imageUrl || node.data?.outputImage || node.data?.resultUrl;
                    if (img) {
                      onOpenMarkup(img, node.id, node.title);
                    }
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-white/[0.08] flex items-center gap-2 cursor-pointer text-amber-300 hover:text-amber-200"
                >
                  <Pencil className="w-3.5 h-3.5 text-amber-400" />
                  <span>Coret / Tandai Gambar</span>
                </button>
              )}

              {node.type === 'prompt' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowNegative((prev) => !prev);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-white/[0.08] flex items-center gap-2 cursor-pointer text-stone-300 hover:text-white"
                >
                  <Plus className="w-3.5 h-3.5 text-stone-400" />
                  <span>{showNegative ? 'Sembunyikan Negative' : 'Tampilkan Negative'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onDelete(node.id);
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-rose-500/15 flex items-center gap-2 cursor-pointer text-rose-400 hover:text-rose-300"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Node</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Node Body Content */}
      <div className="px-3.5 pb-3.5 space-y-3">
        {/* TYPE 1: PROMPT NODE */}
        {node.type === 'prompt' && (
          <div className="flex flex-col gap-2.5">
            {/* Inner Textarea Container */}
            <div className="rounded-xl bg-[#25252b] border border-white/[0.04] p-3 min-h-[160px] flex flex-col focus-within:border-white/[0.12] transition-colors">
              <textarea
                value={node.data?.prompt || ''}
                onChange={(e) =>
                  onUpdateData(node.id, { ...node.data, prompt: e.target.value })
                }
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="tolong analisis gambar inih"
                rows={6}
                className="w-full flex-1 bg-transparent text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none resize-none leading-relaxed select-text cursor-text font-sans"
              />
            </div>

            {/* Optional Negative Prompt if opened */}
            {showNegative && (
              <div className="rounded-xl bg-[#25252b] border border-white/[0.04] p-2.5 flex flex-col">
                <span className="text-[10px] text-stone-400 mb-1 font-medium">Negative Prompt:</span>
                <textarea
                  value={node.data?.negativePrompt || ''}
                  onChange={(e) =>
                    onUpdateData(node.id, {
                      ...node.data,
                      negativePrompt: e.target.value,
                    })
                  }
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder="blurry, low quality, bad anatomy..."
                  rows={2}
                  className="w-full bg-transparent text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none resize-none leading-relaxed select-text cursor-text"
                />
              </div>
            )}

            {/* Footer: + Add variable */}
            <div className="flex items-center justify-between pt-0.5 px-0.5">
              <button
                type="button"
                onClick={() => {
                  const current = node.data?.prompt || '';
                  const addition = current ? ' {variable}' : '{variable}';
                  onUpdateData(node.id, { ...node.data, prompt: current + addition });
                  if (onToast) onToast('Variable {variable} ditambahkan!');
                }}
                className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 font-medium transition-colors cursor-pointer select-none"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add variable</span>
              </button>

              {node.data?.prompt && (
                <span className="text-[10px] text-stone-500 font-mono">
                  {node.data.prompt.length} char
                </span>
              )}
            </div>
          </div>
        )}

        {/* TYPE 2: IMAGE INPUT NODE */}
        {node.type === 'imageInput' && (
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,.mkv,.mov"
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* Checkerboard Viewport */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOverFile(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOverFile(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOverFile(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleMediaFile(file);
              }}
              onPaste={(e) => {
                const clipboardData = e.clipboardData;
                if (!clipboardData) return;
                let file: File | null = null;
                if (clipboardData.files && clipboardData.files.length > 0) {
                  for (let i = 0; i < clipboardData.files.length; i++) {
                    const f = clipboardData.files[i];
                    if (f.type.startsWith('image/') || f.type.startsWith('video/')) {
                      file = f;
                      break;
                    }
                  }
                }
                if (!file && clipboardData.items) {
                  for (let i = 0; i < clipboardData.items.length; i++) {
                    const item = clipboardData.items[i];
                    if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
                      file = item.getAsFile();
                      if (file) break;
                    }
                  }
                }
                if (file) {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleMediaFile(file);
                }
              }}
              className={`relative w-full rounded-xl overflow-hidden border border-white/[0.06] bg-[#0d0d11] transition-all duration-200 flex flex-col items-center justify-center cursor-pointer group select-none ${
                isDragOverFile ? 'ring-2 ring-white/50' : ''
              }`}
              style={
                node.data?.imageUrl || node.data?.videoUrl
                  ? getViewerAspectStyle(
                      node.data?.aspectRatio,
                      node.data?.naturalWidth,
                      node.data?.naturalHeight
                    )
                  : { aspectRatio: '1 / 1' }
              }
            >
              <div className="absolute inset-0 opacity-40 canvas-checkerboard pointer-events-none" />

              {Boolean(node.data?.videoUrl?.trim()) ? (
                <>
                  <video
                    src={node.data.videoUrl}
                    controls
                    preload="metadata"
                    className="w-full h-full object-contain relative z-10"
                    onClick={(e) => e.stopPropagation()}
                    onLoadedMetadata={(e) => {
                      const video = e.currentTarget;
                      if (!video.videoWidth || !video.videoHeight) return;
                      const width = video.videoWidth;
                      const height = video.videoHeight;
                      const detectedRatio =
                        width / height >= 1.5
                          ? '16:9'
                          : width / height >= 1.15
                          ? '4:3'
                          : height / width >= 1.5
                          ? '9:16'
                          : height / width >= 1.15
                          ? '3:4'
                          : '1:1';
                      if (
                        node.data?.naturalWidth !== width ||
                        node.data?.naturalHeight !== height ||
                        node.data?.aspectRatio !== detectedRatio
                      ) {
                        onUpdateData(node.id, {
                          ...node.data,
                          naturalWidth: width,
                          naturalHeight: height,
                          aspectRatio: detectedRatio,
                        });
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center gap-2 pointer-events-none">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-md text-xs font-medium text-white transition-colors cursor-pointer pointer-events-auto"
                    >
                      Ganti File
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateData(node.id, {
                          ...node.data,
                          videoUrl: undefined,
                          fileName: '',
                          mediaType: undefined,
                          naturalWidth: undefined,
                          naturalHeight: undefined,
                          aspectRatio: undefined,
                        });
                      }}
                      className="p-1.5 rounded-lg bg-red-500/30 hover:bg-red-500/50 backdrop-blur-md text-red-200 transition-colors cursor-pointer pointer-events-auto"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              ) : Boolean(node.data?.imageUrl?.trim()) ? (
                <>
                  <img
                    src={node.data!.imageUrl}
                    alt={node.data?.fileName || 'File'}
                    className="w-full h-full object-contain relative z-10"
                    referrerPolicy="no-referrer"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalWidth && img.naturalHeight) {
                        const width = img.naturalWidth;
                        const height = img.naturalHeight;
                        const detectedRatio =
                          width / height >= 1.5
                            ? '16:9'
                            : width / height >= 1.15
                            ? '4:3'
                            : height / width >= 1.5
                            ? '9:16'
                            : height / width >= 1.15
                            ? '3:4'
                            : '1:1';

                        if (
                          node.data?.naturalWidth !== width ||
                          node.data?.naturalHeight !== height ||
                          node.data?.aspectRatio !== detectedRatio
                        ) {
                          onUpdateData(node.id, {
                            ...node.data,
                            naturalWidth: width,
                            naturalHeight: height,
                            aspectRatio: detectedRatio,
                          });
                        }
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center gap-2">
                    {onOpenMarkup && node.data?.imageUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenMarkup(node.data.imageUrl, node.id, node.title);
                        }}
                        className="p-1.5 rounded-lg bg-amber-500/30 hover:bg-amber-500/50 backdrop-blur-md text-amber-200 transition-colors cursor-pointer"
                        title="Coret / Tandai Gambar (Markup)"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-md text-xs font-medium text-white transition-colors cursor-pointer"
                    >
                      Ganti File
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateData(node.id, {
                          ...node.data,
                          imageUrl: '',
                          videoUrl: undefined,
                          fileName: '',
                          mediaType: undefined,
                          naturalWidth: undefined,
                          naturalHeight: undefined,
                          aspectRatio: undefined,
                        });
                      }}
                      className="p-1.5 rounded-lg bg-red-500/30 hover:bg-red-500/50 backdrop-blur-md text-red-200 transition-colors cursor-pointer"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="relative z-10 flex flex-col items-center justify-center gap-2.5 p-4 text-center">
                  {isLoadingVideo ? (
                    <Loader2 className="w-5 h-5 text-stone-300 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5 text-stone-300 stroke-[1.8]" />
                  )}
                  <span className="text-xs text-stone-200 font-normal">
                    {isLoadingVideo
                      ? `Memuat video... ${videoLoadProgress}%`
                      : isDragOverFile
                      ? 'Lepaskan file di sini'
                      : 'Drag & drop or click to upload image/video'}
                  </span>
                </div>
              )}
              {isLoadingVideo && Boolean(node.data?.imageUrl || node.data?.videoUrl) && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 text-xs text-white">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memuat video... {videoLoadProgress}%
                </div>
              )}
            </div>
            {node.data?.mediaType === 'video' &&
              node.data?.videoUrl &&
              onRemoveWatermark &&
              !/_nowm\.mp4(?:$|[?#])/i.test(node.data.videoUrl) && (
                <button
                  type="button"
                  disabled={isRemovingWatermark || isLoadingVideo}
                  onClick={async (event) => {
                    event.stopPropagation();
                    setIsRemovingWatermark(true);
                    try {
                      await onRemoveWatermark(node.id);
                    } catch (error) {
                      const message =
                        error instanceof Error ? error.message : 'Remove watermark gagal.';
                      if (onToast) onToast(message);
                    } finally {
                      setIsRemovingWatermark(false);
                    }
                  }}
                  className="w-full py-2 px-3 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/15 text-blue-200 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                >
                  {isRemovingWatermark ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {isRemovingWatermark ? 'Memproses remove watermark...' : 'Remove Watermark'}
                </button>
              )}
          </div>
        )}

        {/* TYPE 3: IMAGE MODEL NODE */}
        {node.type === 'imageModel' && (
          <div className="space-y-2.5">
            {/* Center Viewport / Output Preview Area */}
            <div
              className="relative w-full rounded-xl overflow-hidden border border-white/[0.06] bg-[#0d0d11] transition-all duration-200"
              style={getViewerAspectStyle(effectiveRatio, node.data?.naturalWidth, node.data?.naturalHeight)}
            >
              {/* 1. If running / executing */}
              {(node.data?.status === 'running' || isExecuting) ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                  <div className="absolute inset-0 opacity-40 canvas-checkerboard pointer-events-none" />
                  <div className="relative flex items-center justify-center z-10">
                    <Loader2 className="w-10 h-10 text-amber-500 animate-spin stroke-[1.8]" />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-amber-400">
                      {Math.round(node.data?.progress || 15)}%
                    </span>
                  </div>
                </div>
              ) : node.data?.status === 'error' ? (
                /* 2. If Error */
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center relative overflow-hidden bg-rose-500/5 border border-rose-500/20">
                  <div className="w-7 h-7 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center mb-1.5 shrink-0">
                    <AlertCircle className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs font-semibold text-rose-300 mb-0.5">Render Gagal</h4>
                  <p className="text-[10px] text-rose-400/90 line-clamp-2 leading-relaxed max-w-[220px] mb-2 break-words px-1" title={node.data?.errorMessage}>
                    {node.data?.errorMessage || 'Terjadi kesalahan saat memproses render.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateData(node.id, {
                        ...node.data,
                        status: 'idle',
                        errorMessage: undefined,
                      });
                    }}
                    className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 transition-colors cursor-pointer border border-rose-500/30 active:scale-95"
                  >
                    Reset Status
                  </button>
                </div>
              ) : (node.data?.outputImage || node.data?.resultUrl) ? (
                /* 3. If Image Generated (Completed) */
                <div className="relative group w-full h-full">
                  <CanvasMediaPreview
                    url={node.data.outputImage || node.data.resultUrl}
                    aspectRatio={effectiveRatio}
                    naturalWidth={node.data?.naturalWidth}
                    naturalHeight={node.data?.naturalHeight}
                    onToast={onToast}
                    onOpenFullPreview={onOpenFullPreview}
                    onOpenMarkup={
                      onOpenMarkup
                        ? () => {
                            const img = node.data.outputImage || node.data.resultUrl;
                            if (img) onOpenMarkup(img, node.id, node.title);
                          }
                        : undefined
                    }
                    previewTitle={effectiveModelTitle}
                    model={effectiveModelName || effectiveModelTitle}
                    onDimensionsDetected={(width, height) => {
                      if (node.data?.naturalWidth !== width || node.data?.naturalHeight !== height) {
                        onUpdateData(node.id, {
                          ...node.data,
                          naturalWidth: width,
                          naturalHeight: height,
                        });
                      }
                    }}
                  />
                </div>
              ) : (
                /* 4. If Empty / Idle: Clean Weavy Viewport (Pure Canvas Checkerboard) */
                <div className="w-full h-full canvas-checkerboard select-none" />
              )}
            </div>

            {/* Bottom Bar: Left "+ Add another image input" & Right "Run Model" */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1 min-w-0">
                <button
                  type="button"
                  onClick={() => onAddImageInput && onAddImageInput(node.id)}
                  className="flex items-center gap-1 text-xs font-normal text-stone-400 hover:text-stone-200 active:scale-95 transition-colors cursor-pointer select-none py-1 px-1 rounded hover:bg-white/[0.04]"
                  title="Tambah slot input gambar referensi"
                >
                  <Plus className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span className="truncate">Add another image input</span>
                </button>

                {node.inputs.filter((p) => p.type === 'image').length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveLastImageInput && onRemoveLastImageInput(node.id)}
                    className="text-stone-400 hover:text-rose-400 transition-colors cursor-pointer p-1 rounded hover:bg-rose-500/10 shrink-0"
                    title="Hapus slot input gambar terakhir"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Right: Run Model button */}
              <button
                type="button"
                onClick={() => onRunNode && onRunNode(node.id)}
                disabled={isExecuting || node.data?.status === 'running'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-normal bg-[#24242b] border border-white/[0.12] hover:bg-[#2c2c36] text-stone-200 whitespace-nowrap shrink-0 transition-all cursor-pointer select-none shadow-xs active:scale-95 disabled:opacity-50 disabled:cursor-wait"
                title="Jalankan generasi pada model ini"
              >
                {isExecuting || node.data?.status === 'running' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400 shrink-0" />
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-3.5 h-3.5 stroke-[2] shrink-0" />
                    <span>Run Model</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TYPE 3B: GEMINI VIDEO NODE */}
        {node.type === 'geminiVideo' && (
          <div className="space-y-2.5">
            {/* Center Viewport / Output Video Preview Area */}
            <div
              className="relative w-full rounded-xl overflow-hidden border border-white/[0.06] bg-[#0d0d11] transition-all duration-200"
              style={getViewerAspectStyle(node.data?.aspectRatio || connectedSourceAspectRatio || '9:16', node.data?.naturalWidth, node.data?.naturalHeight)}
            >
              {/* 1. If running / executing */}
              {(node.data?.status === 'running' || isExecuting) ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                  <div className="absolute inset-0 opacity-40 canvas-checkerboard pointer-events-none" />
                  <div className="relative flex items-center justify-center z-10 mb-2">
                    <Loader2 className="w-10 h-10 text-amber-500 animate-spin stroke-[1.8]" />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-amber-400">
                      {`${Math.floor(geminiElapsedSeconds / 60).toString().padStart(2, '0')}:${(geminiElapsedSeconds % 60).toString().padStart(2, '0')}`}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-stone-200 z-10">
                    Membuat Video Gemini Omni Flash...
                  </span>
                  {node.data?.operationName ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCopyText('geminiTaskId', node.data.operationName || '');
                      }}
                      className="z-10 mt-1 flex max-w-[220px] items-center gap-1 text-[10px] text-amber-300 hover:text-amber-200 cursor-pointer"
                      title={`Task ID internal AMB Media: ${node.data.operationName} (klik untuk menyalin)`}
                    >
                      <span className="truncate">Task ID · {node.data.operationName}</span>
                      <Copy className="w-3 h-3 shrink-0" />
                    </button>
                  ) : (
                    <span className="text-[10px] text-stone-400 mt-1 max-w-[220px] z-10 line-clamp-1">
                      Gemini Omni Flash • {node.data?.duration || '10s'} • {node.data?.aspectRatio || connectedSourceAspectRatio || '9:16'}
                    </span>
                  )}
                </div>
              ) : node.data?.status === 'error' ? (
                /* 2. If Error */
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center relative overflow-hidden bg-rose-500/5 border border-rose-500/20">
                  <div className="w-7 h-7 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center mb-1.5 shrink-0">
                    <AlertCircle className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs font-semibold text-rose-300 mb-0.5">Render Video Gagal</h4>
                  <p className="text-[10px] text-rose-400/90 line-clamp-3 leading-relaxed max-w-[230px] mb-2 break-words px-1" title={node.data?.errorMessage}>
                    {node.data?.errorMessage || 'Terjadi kesalahan saat memproses render video.'}
                  </p>
                  {node.data?.operationName && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCopyText('geminiTaskId', node.data.operationName || '');
                      }}
                      className="mb-2 flex max-w-[230px] items-center gap-1 text-[10px] text-amber-300 hover:text-amber-200 cursor-pointer"
                      title={`Task ID internal AMB Media: ${node.data.operationName} (klik untuk menyalin)`}
                    >
                      <span className="truncate">Task ID · {node.data.operationName}</span>
                      <Copy className="w-3 h-3 shrink-0" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateData(node.id, {
                        ...node.data,
                        status: 'idle',
                        errorMessage: undefined,
                      });
                    }}
                    className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 transition-colors cursor-pointer border border-rose-500/30 active:scale-95"
                  >
                    Reset Status
                  </button>
                </div>
              ) : (node.data?.outputVideo || node.data?.videoUrl || node.data?.resultUrl) ? (
                /* 3. If Video Generated (Completed) */
                <div className="relative group w-full h-full">
                  <CanvasMediaPreview
                    url={node.data.outputVideo || node.data.videoUrl || node.data.resultUrl}
                    aspectRatio={node.data?.aspectRatio || connectedSourceAspectRatio || '9:16'}
                    naturalWidth={node.data?.naturalWidth}
                    naturalHeight={node.data?.naturalHeight}
                    onToast={onToast}
                    onOpenFullPreview={onOpenFullPreview}
                    previewTitle="Gemini Omni Flash"
                    model="Gemini Omni Flash"
                    onDimensionsDetected={(width, height) => {
                      if (node.data?.naturalWidth !== width || node.data?.naturalHeight !== height) {
                        onUpdateData(node.id, {
                          ...node.data,
                          naturalWidth: width,
                          naturalHeight: height,
                        });
                      }
                    }}
                  />
                  {node.data?.operationName && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCopyText('geminiTaskId', node.data.operationName || '');
                      }}
                      className="absolute bottom-2 left-2 z-20 flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-md border border-white/10 bg-black/70 px-2 py-1 text-[10px] text-stone-200 opacity-0 transition-opacity hover:text-white group-hover:opacity-100 cursor-pointer"
                      title={`Task ID internal AMB Media: ${node.data.operationName} (klik untuk menyalin)`}
                    >
                      <span className="truncate">Task ID · {node.data.operationName}</span>
                      <Copy className="w-3 h-3 shrink-0" />
                    </button>
                  )}
                </div>
              ) : (
                /* 4. If Empty / Idle: Clean Viewport (Matching Image Model with canvas checkerboard) */
                <div className="w-full h-full canvas-checkerboard select-none" />
              )}
            </div>

            {/* Bottom Bar: Left "+ Add another image input" & Right "Run Model" (identical to imageModel) */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1 min-w-0">
                <button
                  type="button"
                  onClick={() => onAddImageInput && onAddImageInput(node.id)}
                  className="flex items-center gap-1 text-xs font-normal text-stone-400 hover:text-stone-200 active:scale-95 transition-colors cursor-pointer select-none py-1 px-1 rounded hover:bg-white/[0.04]"
                  title="Tambah slot input gambar referensi"
                >
                  <Plus className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span className="truncate">Add another image input</span>
                </button>

                {node.inputs.filter((p) => p.type === 'image').length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveLastImageInput && onRemoveLastImageInput(node.id)}
                    className="text-stone-400 hover:text-rose-400 transition-colors cursor-pointer p-1 rounded hover:bg-rose-500/10 shrink-0"
                    title="Hapus slot input gambar terakhir"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Right: Run Model button (styled identical to imageModel node) */}
              <button
                type="button"
                onClick={() => onRunNode && onRunNode(node.id)}
                disabled={isExecuting || node.data?.status === 'running'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-normal bg-[#24242b] border border-white/[0.12] hover:bg-[#2c2c36] text-stone-200 whitespace-nowrap shrink-0 transition-all cursor-pointer select-none shadow-xs active:scale-95 disabled:opacity-50 disabled:cursor-wait"
                title="Jalankan generasi pada model ini"
              >
                {isExecuting || node.data?.status === 'running' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500 shrink-0" />
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-3.5 h-3.5 stroke-[2] shrink-0" />
                    <span>Run Model</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TYPE 3C: GOOGLE VIDS VIDEO NODE */}
        {node.type === 'vidsVideo' && (
          <div className="space-y-2.5">
            <div
              className="relative w-full rounded-xl overflow-hidden border border-white/[0.06] bg-[#0d0d11]"
              style={getViewerAspectStyle(node.data?.aspectRatio || '9:16', node.data?.naturalWidth, node.data?.naturalHeight)}
            >
              {node.data?.status === 'running' || isExecuting ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                  <div className="absolute inset-0 opacity-40 canvas-checkerboard pointer-events-none" />
                  <div className="relative flex items-center justify-center z-10 mb-2">
                    <Loader2 className="w-10 h-10 text-blue-400 animate-spin stroke-[1.8]" />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-300">
                      {`${Math.floor(geminiElapsedSeconds / 60).toString().padStart(2, '0')}:${(geminiElapsedSeconds % 60).toString().padStart(2, '0')}`}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-stone-200 z-10">
                    Membuat video Vids Omni...
                  </span>
                  <span className="text-[10px] text-stone-400 mt-1 max-w-[220px] z-10">
                    {node.data?.resolution || '720p'} · {node.data?.aspectRatio || '9:16'}
                  </span>
                </div>
              ) : node.data?.status === 'error' ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-rose-500/5 border border-rose-500/20">
                  <div className="w-7 h-7 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center mb-1.5 shrink-0">
                    <AlertCircle className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs font-semibold text-rose-300 mb-0.5">Generate Vids Gagal</h4>
                  <p className="text-[10px] text-rose-400/90 line-clamp-3 leading-relaxed max-w-[230px] mb-2 break-words px-1">
                    {node.data?.errorMessage || 'Terjadi kesalahan saat membuat video.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => onUpdateData(node.id, { ...node.data, status: 'idle', errorMessage: undefined })}
                    className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 cursor-pointer"
                  >
                    Reset Status
                  </button>
                </div>
              ) : (node.data?.outputVideo || node.data?.videoUrl || node.data?.resultUrl) ? (
                <CanvasMediaPreview
                  url={node.data.outputVideo || node.data.videoUrl || node.data.resultUrl}
                  aspectRatio={node.data?.aspectRatio || '9:16'}
                  naturalWidth={node.data?.naturalWidth}
                  naturalHeight={node.data?.naturalHeight}
                  onToast={onToast}
                  onOpenFullPreview={(url, title, model) => onOpenFullPreview?.(url, title, model, node.id)}
                  previewTitle="Vids Omni"
                  model="Vids Omni"
                  onDimensionsDetected={(width, height) => {
                    if (node.data?.naturalWidth !== width || node.data?.naturalHeight !== height) {
                      onUpdateData(node.id, { ...node.data, naturalWidth: width, naturalHeight: height });
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full canvas-checkerboard select-none" />
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => onRunNode && onRunNode(node.id)}
                disabled={isExecuting || node.data?.status === 'running'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#24242b] border border-white/[0.12] hover:bg-[#2c2c36] text-stone-200 whitespace-nowrap shrink-0 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                title="Generate video dengan Vids Omni"
              >
                {isExecuting || node.data?.status === 'running' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0" />
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-3.5 h-3.5 stroke-[2] shrink-0" />
                    <span>Generate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TYPE 3D: VIDEO STITCHER NODE */}
        {node.type === 'videoStitcher' && (
          <div className="space-y-2.5">
            {/* Center Viewport / Output Video Preview Area */}
            <div
              className="relative w-full rounded-xl overflow-hidden border border-white/[0.06] bg-[#0d0d11] transition-all duration-200"
              style={getViewerAspectStyle(node.data?.aspectRatio || '9:16', node.data?.naturalWidth, node.data?.naturalHeight)}
            >
              {/* 1. If running / executing */}
              {(node.data?.status === 'running' || isExecuting) ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                  <div className="absolute inset-0 opacity-40 canvas-checkerboard pointer-events-none" />
                  <div className="relative flex items-center justify-center z-10 mb-2">
                    <Loader2 className="w-10 h-10 text-rose-500 animate-spin stroke-[1.8]" />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-rose-400">
                      {Math.round(node.data?.progress || 15)}%
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-stone-200 z-10">
                    Menggabungkan Video (FFmpeg)...
                  </span>
                  <span className="text-[10px] text-stone-400 mt-1 max-w-[220px] z-10 line-clamp-1">
                    {node.inputs?.length || 2} Klip Video • {node.data?.aspectRatio || '9:16'} • {node.data?.resolution || '1080p'}
                  </span>
                </div>
              ) : node.data?.status === 'error' ? (
                /* 2. If Error */
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center relative overflow-hidden bg-rose-500/5 border border-rose-500/20">
                  <div className="w-7 h-7 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center mb-1.5 shrink-0">
                    <AlertCircle className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs font-semibold text-rose-300 mb-0.5">Penggabungan Video Gagal</h4>
                  <p className="text-[10px] text-rose-400/90 line-clamp-3 leading-relaxed max-w-[230px] mb-2 break-words px-1" title={node.data?.errorMessage}>
                    {node.data?.errorMessage || 'Terjadi kesalahan saat menggabungkan video.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateData(node.id, {
                        ...node.data,
                        status: 'idle',
                        errorMessage: undefined,
                      });
                    }}
                    className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 transition-colors cursor-pointer border border-rose-500/30 active:scale-95"
                  >
                    Reset Status
                  </button>
                </div>
              ) : (node.data?.outputVideo || node.data?.videoUrl || node.data?.resultUrl) ? (
                /* 3. If Video Stitched (Completed) */
                <div className="relative group w-full h-full">
                  <CanvasMediaPreview
                    url={node.data.outputVideo || node.data.videoUrl || node.data.resultUrl}
                    aspectRatio={node.data?.aspectRatio || '9:16'}
                    naturalWidth={node.data?.naturalWidth}
                    naturalHeight={node.data?.naturalHeight}
                    onToast={onToast}
                    onOpenFullPreview={onOpenFullPreview}
                    previewTitle="Video Stitcher"
                    model="FFmpeg Concat"
                    onDimensionsDetected={(width, height) => {
                      if (node.data?.naturalWidth !== width || node.data?.naturalHeight !== height) {
                        onUpdateData(node.id, {
                          ...node.data,
                          naturalWidth: width,
                          naturalHeight: height,
                        });
                      }
                    }}
                  />
                </div>
              ) : (
                /* 4. If Empty / Idle: Clean Viewport */
                <div className="w-full h-full canvas-checkerboard select-none flex flex-col items-center justify-center text-center p-4">
                  <Film className="w-8 h-8 text-stone-500/50 mb-1.5" />
                  <span className="text-[11px] font-medium text-stone-400">Siap Menggabungkan Video</span>
                  <span className="text-[10px] text-stone-500 mt-0.5">Hubungkan output video ke input di kiri</span>
                </div>
              )}
            </div>

            {/* Bottom Bar: Left "+ Add video input" & Right "Run Model" (identical to Gemini Omni Flash) */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1 min-w-0">
                <button
                  type="button"
                  onClick={() => onAddVideoInput && onAddVideoInput(node.id)}
                  className="flex items-center gap-1 text-xs font-normal text-stone-400 hover:text-stone-200 active:scale-95 transition-colors cursor-pointer select-none py-1 px-1 rounded hover:bg-white/[0.04]"
                  title="Tambah slot input video berikutnya"
                >
                  <Plus className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span className="truncate">Add video input</span>
                </button>

                {node.inputs && node.inputs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveLastVideoInput && onRemoveLastVideoInput(node.id)}
                    className="text-stone-400 hover:text-rose-400 transition-colors cursor-pointer p-1 rounded hover:bg-rose-500/10 shrink-0"
                    title="Hapus slot input video terakhir"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Right: Run Model button */}
              <button
                type="button"
                onClick={() => onRunNode && onRunNode(node.id)}
                disabled={isExecuting || node.data?.status === 'running'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-normal bg-[#24242b] border border-white/[0.12] hover:bg-[#2c2c36] text-stone-200 whitespace-nowrap shrink-0 transition-all cursor-pointer select-none shadow-xs active:scale-95 disabled:opacity-50 disabled:cursor-wait"
                title="Jalankan penggabungan video (FFmpeg)"
              >
                {isExecuting || node.data?.status === 'running' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500 shrink-0" />
                    <span>Stitching...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-3.5 h-3.5 stroke-[2] shrink-0" />
                    <span>Run Model</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TYPE 4: IMAGE VIEWER NODE */}
        {node.type === 'imageViewer' && (
          <div>
            {node.data?.status === 'running' ? (
              <div
                className="w-full rounded-lg bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 flex flex-col items-center justify-center p-4 text-center relative overflow-hidden transition-all duration-200"
                style={getViewerAspectStyle(effectiveRatio, node.data?.naturalWidth, node.data?.naturalHeight)}
              >
                <div className="relative flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-purple-600 dark:text-purple-400 animate-spin stroke-[1.8]" />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-purple-600 dark:text-purple-300">
                    {Math.round(node.data?.progress || 12)}%
                  </span>
                </div>
              </div>
            ) : node.data?.status === 'error' ? (
              <div
                className="w-full rounded-lg bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/25 flex flex-col items-center justify-center p-4 text-center relative overflow-hidden transition-all duration-200"
                style={getViewerAspectStyle(effectiveRatio, node.data?.naturalWidth, node.data?.naturalHeight)}
              >
                <div className="w-7 h-7 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center mb-1.5 shrink-0">
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-semibold text-rose-700 dark:text-rose-300 mb-0.5">
                  Render Gagal
                </h4>
                <p className="text-[10px] text-rose-600/90 dark:text-rose-400/90 line-clamp-2 leading-relaxed max-w-[210px] mb-2 break-words px-1" title={node.data?.errorMessage}>
                  {node.data?.errorMessage || 'Terjadi kesalahan saat memproses render.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateData(node.id, {
                      ...node.data,
                      status: 'idle',
                      errorMessage: undefined,
                    });
                  }}
                  className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 transition-colors cursor-pointer border border-rose-500/30 active:scale-95"
                >
                  Reset Status
                </button>
              </div>
            ) : (node.data?.resultUrl || node.data?.outputImage) ? (
              <CanvasMediaPreview
                url={node.data.resultUrl || node.data.outputImage || ''}
                aspectRatio={effectiveRatio}
                naturalWidth={node.data?.naturalWidth}
                naturalHeight={node.data?.naturalHeight}
                onToast={onToast}
                onOpenFullPreview={onOpenFullPreview}
                onOpenMarkup={
                  onOpenMarkup
                    ? () => {
                        const img = node.data.resultUrl || node.data.outputImage;
                        if (img) onOpenMarkup(img, node.id, node.title);
                      }
                    : undefined
                }
                previewTitle={effectiveModelTitle}
                model={effectiveModelName || effectiveModelTitle}
                onDimensionsDetected={(width, height) => {
                  if (node.data?.naturalWidth !== width || node.data?.naturalHeight !== height) {
                    onUpdateData(node.id, {
                      ...node.data,
                      naturalWidth: width,
                      naturalHeight: height,
                    });
                  }
                }}
              />
            ) : (
              <div
                className="w-full rounded-lg border border-dashed border-stone-200 dark:border-white/[0.08] flex flex-col items-center justify-center p-4 text-center text-stone-400 transition-all duration-200 bg-stone-50/50 dark:bg-[#0c0c10]"
                style={getViewerAspectStyle(effectiveRatio, node.data?.naturalWidth, node.data?.naturalHeight)}
              >
                <div className="mb-1.5 opacity-70">
                  <ModelBadgeIcon model={effectiveModelName} className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-stone-600 dark:text-stone-300">
                  {effectiveModelName}
                </span>
                <span className="text-[10px] text-stone-400 mt-0.5">
                  Klik tombol Run untuk merender gambar
                </span>
              </div>
            )}
          </div>
        )}

        {/* TYPE 5: STICKY NOTE NODE */}
        {node.type === 'note' && (
          <div className="space-y-2">
            <textarea
              value={node.data?.text || ''}
              onChange={(e) =>
                onUpdateData(node.id, {
                  ...node.data,
                  text: e.target.value,
                })
              }
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="Tulis catatan atau instruksi alur kerja..."
              rows={4}
              className="w-full text-xs p-2.5 rounded-lg border border-amber-300/40 dark:border-amber-500/20 bg-amber-50/60 dark:bg-amber-950/15 text-stone-800 dark:text-amber-100 placeholder:text-stone-400 dark:placeholder:text-amber-300/30 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none font-sans leading-relaxed"
            />
          </div>
        )}

        {/* TYPE 6: ANY LLM / PROMPT ENHANCER NODE */}
        {(node.type === 'promptEnhancer' || node.type === 'anyLLM') && (
          <div className="space-y-2.5">
            {/* Inner Textarea Container */}
            <div className="rounded-xl bg-[#25252b] border border-white/[0.04] p-3 min-h-[220px] flex flex-col focus-within:border-white/[0.12] transition-colors relative">
              {/* Top Row: Quick Copy button & character count if text present */}
              {(node.data?.generatedText || node.data?.enhancedPrompt || node.data?.inputPrompt) && (
                <div className="flex items-center justify-end gap-2 pb-1.5 mb-1 border-b border-white/[0.04]">
                  <span className="text-[10px] text-stone-500 font-mono">
                    {(node.data?.generatedText || node.data?.enhancedPrompt || node.data?.inputPrompt || '').length} chars
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const txt = node.data?.generatedText || node.data?.enhancedPrompt || node.data?.inputPrompt || '';
                      navigator.clipboard.writeText(txt);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                      onToast && onToast('Teks berhasil disalin ke clipboard');
                    }}
                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] text-stone-300 transition-colors cursor-pointer"
                    title="Salin hasil teks"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-stone-400" />
                        <span>Salin</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              <textarea
                value={node.data?.generatedText || node.data?.enhancedPrompt || node.data?.inputPrompt || ''}
                onChange={(e) =>
                  onUpdateData(node.id, {
                    ...node.data,
                    inputPrompt: e.target.value,
                    generatedText: e.target.value,
                    enhancedPrompt: e.target.value,
                  })
                }
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="The generated text will appear here"
                rows={9}
                className="w-full flex-1 bg-transparent text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none resize-none leading-relaxed select-text cursor-text font-sans"
              />

              {(node.data?.status === 'running' || isExecuting) && (
                <div className="absolute inset-0 bg-[#25252b]/85 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center gap-2 text-xs text-purple-300 z-10">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                  <span className="font-medium">Memproses dengan {node.data?.modelDisplayName || 'LLM'}...</span>
                </div>
              )}
            </div>

            {/* Error message if any */}
            {node.data?.errorMessage && (
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{node.data.errorMessage}</span>
              </div>
            )}

            {/* Bottom Bar: Left "+ Add another image input" & Right "Run Model" */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1 min-w-0">
                <button
                  type="button"
                  onClick={() => onAddImageInput && onAddImageInput(node.id)}
                  className="flex items-center gap-1 text-xs font-normal text-stone-400 hover:text-stone-200 active:scale-95 transition-colors cursor-pointer select-none py-1 px-1 rounded hover:bg-white/[0.04]"
                  title="Tambah slot input gambar referensi"
                >
                  <Plus className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span className="truncate">Add another image input</span>
                </button>

                {node.inputs.filter((p) => p.type === 'image').length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveLastImageInput && onRemoveLastImageInput(node.id)}
                    className="text-stone-400 hover:text-rose-400 transition-colors cursor-pointer p-1 rounded hover:bg-rose-500/10 shrink-0"
                    title="Hapus slot input gambar terakhir"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Right: Run Model button */}
              <button
                type="button"
                onClick={() => onRunNode && onRunNode(node.id)}
                disabled={isExecuting || node.data?.status === 'running'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-normal bg-[#24242b] border border-white/[0.12] hover:bg-[#2c2c36] text-stone-200 whitespace-nowrap shrink-0 transition-all cursor-pointer select-none shadow-xs active:scale-95 disabled:opacity-50 disabled:cursor-wait"
                title="Jalankan model ini"
              >
                {isExecuting || node.data?.status === 'running' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400 shrink-0" />
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-3.5 h-3.5 stroke-[2] shrink-0" />
                    <span>Run Model</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        {/* TYPE 8: AI WORKER NODE (UI) */}
        {node.type === 'aiWorker' && (() => {
          const d = node.data || {};
          // Abaikan data contoh lama yang mungkin masih tersimpan di node.
          const isLegacySample = Boolean(d.isSample);
          const product = isLegacySample ? undefined : d.product;
          const gallery: string[] = isLegacySample ? [] : (Array.isArray(d.galleryUrls) ? d.galleryUrls : []);
          const selected: string[] = isLegacySample ? [] : (Array.isArray(d.selectedImageUrls) ? d.selectedImageUrls : gallery);
          const verified = d.verified || {};
          const isRunning = d.status === 'running' || isExecuting;
          const linkConnected = connectedInputPortIds?.includes('input-link');
          const hasResult = !isLegacySample && (Boolean(product) || gallery.length > 0 || Boolean(d.contextText));

          const toggleImage = (url: string) => {
            const next = selected.includes(url) ? selected.filter((u) => u !== url) : [...selected, url];
            if (next.length === 0) return;
            onUpdateData(node.id, { ...node.data, selectedImageUrls: next });
          };

          const stopProp = (e: React.SyntheticEvent) => e.stopPropagation();

          return (
            <div className="space-y-2.5">
              {/* Link produk */}
              <div className="rounded-xl bg-[#25252b] border border-white/[0.04] p-3 focus-within:border-white/[0.12] transition-colors relative">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Link produk</span>
                  {linkConnected && (
                    <span className="flex items-center gap-1 text-[10px] text-pink-300">
                      <Link2 className="w-3 h-3" />
                      dari node tersambung
                    </span>
                  )}
                </div>
                <textarea
                  value={d.linkText || ''}
                  onChange={(e) => onUpdateData(node.id, { ...node.data, linkText: e.target.value })}
                  onPointerDown={stopProp}
                  onMouseDown={stopProp}
                  placeholder="Tempel link TikTok Shop, Tokopedia, atau Shopee"
                  rows={3}
                  className="w-full bg-transparent text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none resize-none leading-relaxed select-text cursor-text font-sans"
                />
                {isRunning && (
                  <div className="absolute inset-0 bg-[#25252b]/85 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center gap-2 text-xs text-teal-300 z-10">
                    <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
                    <span className="font-medium">Mengekstrak data produk...</span>
                  </div>
                )}
              </div>

              {/* Catatan tambahan */}
              <input
                type="text"
                value={d.note || ''}
                onChange={(e) => onUpdateData(node.id, { ...node.data, note: e.target.value })}
                onPointerDown={stopProp}
                onMouseDown={stopProp}
                placeholder="Catatan tambahan (opsional)"
                className="w-full text-xs px-3 py-2 rounded-lg bg-[#25252b] border border-white/[0.04] text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-white/[0.12] transition-colors select-text cursor-text font-sans"
              />

              {/* Error */}
              {d.errorMessage && (
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{d.errorMessage}</span>
                </div>
              )}

              {/* Hasil ekstraksi */}
              {hasResult && (
                <div className="rounded-xl bg-[#25252b] border border-white/[0.04] p-3 space-y-2.5">
                  {product && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-stone-100 leading-snug">{product.title || 'Produk tanpa judul'}</p>
                      <p className="text-[11px] text-stone-400">
                        {product.authorName
                          ? (product.authorName.includes('@') ? product.authorName : `@${product.authorName}`)
                          : 'Toko tidak diketahui'}
                        {product.price ? ` • ${product.price}` : ''}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${verified.title ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25' : 'bg-amber-500/10 text-amber-300 border-amber-500/25'}`}>
                          nama: {verified.title ? 'terverifikasi' : 'belum pasti'}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${verified.price ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25' : 'bg-amber-500/10 text-amber-300 border-amber-500/25'}`}>
                          harga: {verified.price ? 'terverifikasi' : 'belum pasti'}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${verified.usps ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25' : 'bg-white/[0.04] text-stone-400 border-white/[0.08]'}`}>
                          hashtag: {verified.usps ? 'terbaca' : 'tidak ada'}
                        </span>
                      </div>
                    </div>
                  )}

                  {gallery.length > 0 && (
                    <div>
                      <p className="text-[10px] text-stone-500 mb-1.5">
                        Foto produk ({selected.length}/{gallery.length} dipakai) • klik untuk pilih
                      </p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {gallery.slice(0, 8).map((url) => {
                          const isOn = selected.includes(url);
                          return (
                            <button
                              key={url}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleImage(url);
                              }}
                              onPointerDown={stopProp}
                              className={`relative aspect-square rounded-md overflow-hidden border-2 transition-colors cursor-pointer ${isOn ? 'border-teal-400' : 'border-white/[0.08] opacity-60 hover:opacity-100'}`}
                              title={isOn ? 'Klik untuk batal pakai' : 'Klik untuk pakai'}
                            >
                              {url.startsWith('sample:') ? (
                                <div className="w-full h-full bg-[#1c1c21] flex items-center justify-center">
                                  <ImageIcon className="w-4 h-4 text-stone-500" />
                                </div>
                              ) : (
                                <img src={url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                              )}
                              {isOn && (
                                <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-teal-400 flex items-center justify-center">
                                  <Check className="w-2.5 h-2.5 text-[#141418] stroke-[3]" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {d.contextText && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-stone-500">Context yang diteruskan</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyText('aiWorkerContext', d.contextText);
                          }}
                          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] text-stone-300 transition-colors cursor-pointer"
                          title="Salin context"
                        >
                          {copiedField === 'aiWorkerContext' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400 font-medium">Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-stone-400" />
                              <span>Salin</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="text-[11px] text-stone-300 whitespace-pre-wrap leading-relaxed font-sans max-h-24 overflow-y-auto select-text">{d.contextText}</pre>
                    </div>
                  )}
                </div>
              )}

              {!hideAiWorkerRunButton && (
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRunNode(node.id);
                    }}
                    disabled={isRunning}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-normal bg-[#24242b] border border-white/[0.12] hover:bg-[#2c2c36] text-stone-200 whitespace-nowrap shrink-0 transition-all cursor-pointer select-none shadow-xs active:scale-95 disabled:opacity-50 disabled:cursor-wait"
                    title="Jalankan AI Worker"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400 shrink-0" />
                        <span>Running...</span>
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-3.5 h-3.5 stroke-[2] shrink-0" />
                        <span>Run Model</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })()}
        {/* TYPE 7: STORYBOARD NODE */}
        {node.type === 'storyboard' && (() => {
          const scenes = dedupeStoryboardScenes(node.data?.scenes);
          const hasScenes = scenes.length > 0;
          const duration = Number(node.data?.targetDuration) || (hasScenes ? scenes.length * 10 : 30);
          const numScenes = getStoryboardPlannedSceneCount(node.data);
          const aspect = node.data?.aspectRatio || '9:16';
          const provider = node.data?.provider || 'weavy';
          const creditsLabel = provider === 'gemini'
            ? 'Gratis'
            : hasConnectedAiWorker && productAnalysisStatus !== 'valid'
            ? '2 Credits'
            : '1 Credit';
          const presetKey = node.data?.presetKey || '/facelessgardenugc';
          const selPreset = CHAT_SLASH_PRESETS.find((p) => p.slash === presetKey);
          const presetName = selPreset?.name || 'Storyboard Copilot';
          const formulaKey = presetKey.toLowerCase();

          const isGardenUgc = formulaKey.includes('garden') || formulaKey.includes('faceless');
          const isOnTheSpot = formulaKey.includes('spot') || formulaKey.includes('investigasi');
          const isHarvest = formulaKey.includes('harvest') || formulaKey.includes('asmr');
          const isBuahUnggul = formulaKey.includes('buah') || formulaKey.includes('unggul') || formulaKey.includes('bibit');

          const badgeLabel = isGardenUgc
            ? `🌱 FACELESS GARDEN UGC`
            : isOnTheSpot
            ? `🔥 ON THE SPOT`
            : isHarvest
            ? `🌾 POV HARVEST & TASTE`
            : isBuahUnggul
            ? `🌟 PRODUK UNGGUL`
            : `🎬 ${getPresetBaseName(presetName).toUpperCase()}`;

          const badgeTheme = isGardenUgc
            ? {
                badge: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
                dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
              }
            : isOnTheSpot
            ? {
                badge: 'border-rose-500/40 bg-rose-500/10 text-rose-400',
                dot: 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]',
              }
            : {
                badge: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
                dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]',
              };

          const activeIdx = typeof node.data?.activeTab === 'number' ? Math.min(node.data.activeTab, Math.max(0, scenes.length - 1)) : 0;
          const currentScene = scenes[activeIdx] || scenes[0];

          return (
            <div className="space-y-3">
              {/* Top Banner Card (Matching ChatStoryboardCopilotCard) */}
              <div className="p-3 rounded-xl bg-gradient-to-b from-amber-500/10 via-[#181615] to-[#141419] border border-amber-500/25 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-bold text-[10px] tracking-wide uppercase min-w-0 ${badgeTheme.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${badgeTheme.dot}`} />
                    <span className="truncate">{badgeLabel}</span>
                  </div>
                  <span className="text-[10px] font-mono text-stone-400 shrink-0">
                    {duration}s · {numScenes} scene · {aspect}
                  </span>
                </div>

                {/* Project Title & Brief Callout */}
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white tracking-tight leading-snug line-clamp-2">
                    {node.data?.projectTitle || presetName}
                  </div>

                  {node.data?.brief && (
                    <div className="text-[11px] text-stone-300 bg-black/40 px-2.5 py-1.5 rounded-lg border-l-2 border-amber-500/80 leading-relaxed italic line-clamp-2 hover:line-clamp-none transition-all">
                      "{node.data.brief}"
                    </div>
                  )}
                </div>
              </div>

              {/* Scenes Breakdown Content if generated */}
              {hasScenes ? (
                <div className="space-y-2">
                  {/* Scene Tabs Header */}
                  <div className="flex items-center gap-1 bg-[#18181f] p-1 rounded-xl border border-white/[0.08]">
                    {scenes.map((sc: any, idx: number) => {
                      const isActive = activeIdx === idx;
                      const words = (sc.voiceover || '').trim().split(/\s+/).filter(Boolean).length;
                      const isOptimal = words >= 27 && words <= 30;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            onUpdateData(node.id, {
                              ...node.data,
                              activeTab: idx,
                            });
                          }}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            isActive
                              ? 'bg-[#2a2a36] text-white shadow-xs font-semibold'
                              : 'text-stone-400 hover:text-stone-200 hover:bg-white/[0.04]'
                          }`}
                        >
                          <span>Scene {sc.sceneNumber || idx + 1}</span>
                          {sc.voiceover && (
                            <span className={`w-2 h-2 rounded-full shrink-0 ${isOptimal ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-amber-400'}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Scene Content Card (Matching ChatStoryboardCopilotCard) */}
                  {currentScene && (() => {
                    const voWords = (currentScene.voiceover || '').trim().split(/\s+/).filter(Boolean).length;
                    const voChars = (currentScene.voiceover || '').trim().length;
                    const isOptimal = voWords >= 27 && voWords <= 30;
                    const isShort = voWords < 27;
                    const hasShoots = Array.isArray(currentScene.shoots) && currentScene.shoots.length > 0;

                    const rawSceneTitle = (currentScene.title || `Adegan ${activeIdx + 1}`).trim();
                    const cleanSceneTitle = rawSceneTitle.replace(new RegExp(`^Scene\\s*${currentScene.sceneNumber || activeIdx + 1}\\s*[:\\-]?\\s*`, 'i'), '').trim();
                    const displaySceneTitle = cleanSceneTitle || rawSceneTitle;

                    return (
                      <div className="p-3 rounded-xl bg-[#1b1b22] border border-white/[0.08] hover:border-amber-500/30 transition-colors space-y-2.5">
                        {/* Scene Header */}
                        <div className="flex items-center justify-between gap-1.5 flex-wrap border-b border-white/[0.06] pb-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                              Scene {currentScene.sceneNumber || activeIdx + 1}
                            </span>
                            <span className="text-xs font-bold text-white tracking-tight truncate max-w-[190px]">
                              {displaySceneTitle}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {currentScene.durationSec && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25">
                                ⏱️ {currentScene.durationSec}s
                              </span>
                            )}
                            {(currentScene.cameraAngle || currentScene.cameraMovement) && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 max-w-[150px] truncate" title={currentScene.cameraAngle || currentScene.cameraMovement}>
                                🎥 {currentScene.cameraAngle || currentScene.cameraMovement}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Pacing Word Count Badge */}
                        {voWords > 0 && (
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-stone-400 font-medium">Kepadatan Voiceover:</span>
                            <span
                              className={`px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${
                                isOptimal
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : isShort
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              <Mic className="w-2.5 h-2.5" />
                              <span>{voWords} kata ({voChars} kar) • {isOptimal ? 'Pas Ideal (27–30 Kata) ✅' : isShort ? 'Kependekan (< 27 Kata)' : 'Kepanjangan (> 30 Kata)'}</span>
                            </span>
                          </div>
                        )}

                        {/* Visual Description */}
                        {currentScene.visualDescription && (
                          <div className="text-[11px] text-stone-300 leading-relaxed bg-[#141419] p-2 rounded-lg border border-white/[0.04]">
                            <span className="font-semibold text-stone-400">🖼️ Visual:</span>{' '}
                            <span>{currentScene.visualDescription}</span>
                          </div>
                        )}

                        {/* Sub-Shots List (Matching ChatStoryboardCopilotCard) */}
                        {hasShoots && (
                          <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20 space-y-1.5">
                            <div className="text-[10px] font-extrabold uppercase text-emerald-400 tracking-wider flex items-center gap-1">
                              <Clapperboard className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>Sub-Shots ({currentScene.shoots.length} Shoot):</span>
                            </div>
                            <div className="space-y-1.5 pl-1 border-l-2 border-emerald-500/40">
                              {currentScene.shoots.map((sh: any, sIdx: number) => {
                                const shootVisual = (sh.visualDescription || sh.action || '').trim();
                                return (
                                  <div key={sIdx} className="text-[10.5px] text-stone-300 pl-1.5 leading-snug">
                                    <span className="font-bold text-emerald-300">
                                      Shoot {sh.shootNumber || sIdx + 1} ({sh.start !== undefined && sh.end !== undefined ? `${sh.start}–${sh.end}s` : `${sIdx * 3}–${(sIdx + 1) * 3}s`}):
                                    </span>{' '}
                                    <span>{shootVisual}</span>
                                    {sh.voiceover && (
                                      <div className="italic text-stone-300 mt-0.5 text-[10px]">
                                        🎙️ "{sh.voiceover}"
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Voiceover Script */}
                        {currentScene.voiceover && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-stone-400">
                              <span className="font-semibold uppercase tracking-wider flex items-center gap-1">
                                <Volume2 className="w-3 h-3 text-amber-400" />
                                <span>Voiceover Naskah</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyText(`vo_${activeIdx}`, currentScene.voiceover || '')}
                                className="text-stone-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                              >
                                {copiedField === `vo_${activeIdx}` ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400 font-medium">Tersalin</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Salin</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="p-2 rounded-lg bg-[#141419] border-l-2 border-amber-400/80 text-[11px] text-stone-200 leading-relaxed font-sans italic">
                              "{currentScene.voiceover}"
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* Empty / Idle State */
                <div className="p-4 rounded-xl border border-dashed border-white/10 bg-[#17171d]/60 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Film className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">Storyboard Siap Dibuat</h5>
                    <p className="text-[11px] text-stone-400 mt-1 max-w-[280px] leading-relaxed">
                      {connectedPrompt || node.data?.brief
                        ? 'Brief aktif terhubung & siap dieksekusi. Klik Generate untuk menyusun adegan.'
                        : 'Klik node ini untuk mengatur formula, brief topik & provider di panel kanan, lalu tekan tombol Generate Storyboard.'}
                    </p>
                  </div>

                  {(connectedPrompt || node.data?.brief) && (
                    <div className="w-full mt-1.5 p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/25 text-left space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                        <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                        <span>Main Brief Terhubung:</span>
                      </div>
                      <p className="text-[11px] text-stone-200 line-clamp-3 italic leading-relaxed">
                        "{connectedPrompt || node.data?.brief}"
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {node.data?.errorMessage && (
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{node.data.errorMessage}</span>
                </div>
              )}

              {/* Bottom Action Bar */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[11px] text-stone-400 min-w-0 truncate">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${hasScenes ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span className="truncate">{hasScenes ? `${scenes.length} Scene Siap` : 'Siap Generate'}</span>
                  <span className="text-[10px] text-stone-500 font-mono shrink-0">
                    • {creditsLabel}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {hasScenes && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onResetStoryboard && onResetStoryboard(node.id);
                        }}
                        disabled={isExecuting || node.data?.status === 'running'}
                        className="px-2 py-1.5 rounded-lg text-xs font-medium text-rose-300 hover:text-white bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/20 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Reset hasil analisis storyboard; brief dan koneksi input tetap dipertahankan"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span className="text-[11px]">Reset</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const sceneNumber = currentScene.sceneNumber || activeIdx + 1;
                          const sceneScript = buildSceneClipboardText(currentScene, activeIdx);
                          handleCopyText(`scene_script_${activeIdx}`, sceneScript);
                          onToast && onToast(`Naskah Scene ${sceneNumber} berhasil disalin ke clipboard`);
                        }}
                        className="px-2 py-1.5 rounded-lg text-xs font-medium text-stone-300 hover:text-white bg-[#22222a] border border-white/10 hover:border-white/20 transition-all flex items-center gap-1 cursor-pointer"
                        title={`Salin naskah dan prompt Scene ${currentScene.sceneNumber || activeIdx + 1}`}
                      >
                        {copiedField === `scene_script_${activeIdx}` ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400 text-[11px]">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-stone-400" />
                            <span className="text-[11px]">Salin Scene {currentScene.sceneNumber || activeIdx + 1}</span>
                          </>
                        )}
                      </button>
                    </>
                  )}

                  {/* Run / Regenerate Storyboard Button */}
                  <button
                    type="button"
                    onClick={() => onRunNode && onRunNode(node.id)}
                    disabled={isExecuting || node.data?.status === 'running'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 whitespace-nowrap shrink-0 transition-all cursor-pointer select-none shadow-md disabled:opacity-50 disabled:cursor-wait"
                    title="Generate Storyboard dengan formula dan voiceover presisi"
                  >
                    {isExecuting || node.data?.status === 'running' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-950 shrink-0" />
                        <span>Menyusun...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-stone-950 fill-stone-950 shrink-0" />
                        <span>{hasScenes ? 'Regenerate' : 'Generate'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};