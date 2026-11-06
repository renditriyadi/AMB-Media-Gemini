import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Play,
  Pause,
  Download,
  Trash2,
  Copy,
  Box,
  Smartphone,
  Clock,
  Tv,
  Check,
  ExternalLink,
  Sparkles,
  Loader2,
  Server,
  Undo2,
  Camera,
  Film,
  Image as ImageIcon,
  X,
  Share2,
  AlertCircle,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { GenerationItem, getCleanPrompt, getCleanModelName } from '../types';
import { formatTo24h, downloadMediaFile } from '../utils';
import { getBestThumbnailImage, isRealImageUrl } from './MediaThumbnail';

const getProviderDetails = (provider?: string, model?: string) => {
  const p = (provider || '').toLowerCase();
  const m = (model || '').toLowerCase();

  if (p === 'vids' || p === 'google vids' || m.includes('google vids') || m.includes('vids omni')) {
    return {
      name: 'Google Vids',
      logoUrl: 'https://ssl.gstatic.com/docs/videos/images/favicon-2026-v2.ico',
      bgClass: 'bg-stone-900 border border-stone-700',
    };
  }

  if (
    p === 'gemini' ||
    p === 'google gemini' ||
    m.includes('gemini') ||
    m.includes('veo') ||
    m.includes('imagen') ||
    m.includes('omni flash')
  ) {
    return {
      name: 'Google Gemini',
      logoUrl: 'https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg',
      bgClass: 'bg-indigo-950/80 border border-indigo-800/60',
    };
  }
  if (p === 'runninghub' || m.includes('runninghub') || m.includes('s2 motion') || m.includes('ambmedia') || m.includes('motion control motionfly') || (m === 'motion control' && p !== 'roboneo')) {
    return {
      name: 'RunningHub',
      logoUrl: 'https://www.runninghub.ai/favicon.ico?v=1.4',
      bgClass: 'bg-amber-950/80 border border-amber-800/60',
    };
  }
  if (p === 'weavy' || p === 'weavy ai') {
    return {
      name: 'Weavy',
      logoUrl: 'https://cdn.prod.website-files.com/681b040781d5b5e278a69989/6829dad31872740b3fb4f912_favicon.svg',
      bgClass: 'bg-slate-900',
    };
  }
  if (p === 'kie' || p === 'kie.ai') {
    return {
      name: 'Kie.ai',
      logoUrl: 'https://kie.ai/logo.png',
      bgClass: 'bg-slate-900 border border-slate-800',
    };
  }
  if (p === 'galleri5') {
    return {
      name: 'Galleri5',
      logoUrl: 'https://aistudio.galleri5.com/assets/Light%20mode-ClfS0paP.png',
      bgClass: 'bg-slate-900 border border-slate-800',
    };
  }
  if (p === 'roboneo') {
    return {
      name: 'RoboNeo',
      logoUrl: 'https://www.roboneo.com/favicon.ico',
      bgClass: 'bg-purple-900 border border-purple-800',
    };
  }

  if (m.includes('grok imagine image')) {
    return {
      name: 'Weavy',
      logoUrl: 'https://cdn.prod.website-files.com/681b040781d5b5e278a69989/6829dad31872740b3fb4f912_favicon.svg',
      bgClass: 'bg-slate-900',
    };
  }

  let isKie = m.includes('1.5 preview') || m.includes('kie');
  let isGalleri5 = !isKie && (m.includes('standar') || m.includes('galleri5'));
  let isRoboNeo = !isKie && !isGalleri5 && ((m.includes('kling 2.6') && !m.includes('standar')) || m.includes('hailuo') || m.includes('minimax'));

  if (isKie) {
    return {
      name: 'Kie.ai',
      logoUrl: 'https://kie.ai/logo.png',
      bgClass: 'bg-slate-900 border border-slate-800',
    };
  }
  if (isGalleri5) {
    return {
      name: 'Galleri5',
      logoUrl: 'https://aistudio.galleri5.com/assets/Light%20mode-ClfS0paP.png',
      bgClass: 'bg-slate-900 border border-slate-800',
    };
  }
  if (isRoboNeo) {
    return {
      name: 'RoboNeo',
      logoUrl: 'https://www.roboneo.com/favicon.ico',
      bgClass: 'bg-purple-900 border border-purple-800',
    };
  }
  return {
    name: 'Weavy',
    logoUrl: 'https://cdn.prod.website-files.com/681b040781d5b5e278a69989/6829dad31872740b3fb4f912_favicon.svg',
    bgClass: 'bg-slate-900',
  };
};

interface ExtractedFrameData {
  dataUrl: string;
  timestamp: number;
  formattedTime: string;
  width: number;
  height: number;
}

type RemoveWatermarkEvent =
  | { type: 'log'; message: string }
  | { type: 'complete'; videoUrl: string }
  | { type: 'error'; message: string };

interface GenerationDetailModalProps {
  item: GenerationItem | null;
  onClose: () => void;
  onUsePrompt: (prompt: string) => void;
  onDelete?: (id: string) => void;
  onSendAsReference?: (item: GenerationItem) => void;
  onReuseItem?: (item: GenerationItem) => void;
  onSendExtractedFrameAsReference?: (frameDataUrl: string, frameLabel: string) => void;
  onMediaUpdated?: (id: string, mediaUrl: string) => void;
}

export const GenerationDetailModal: React.FC<GenerationDetailModalProps> = ({
  item,
  onClose,
  onUsePrompt,
  onDelete,
  onSendAsReference,
  onReuseItem,
  onSendExtractedFrameAsReference,
  onMediaUpdated,
}) => {
  const isVideo = item?.mode === 'video';
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [detectedAspect, setDetectedAspect] = useState<{
    ratioLabel: string;
    orientation: 'portrait' | 'landscape' | 'square';
    width: number;
    height: number;
  } | null>(null);
  const [useProxy, setUseProxy] = useState(false);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const [processedVideoUrl, setProcessedVideoUrl] = useState<string | null>(null);
  const [isRemovingWatermark, setIsRemovingWatermark] = useState(false);
  const [watermarkLogs, setWatermarkLogs] = useState<string[]>([]);
  const [watermarkError, setWatermarkError] = useState<string | null>(null);
  const activeMediaUrl = processedVideoUrl || item?.mediaUrl || '';
  const isGoogleVids =
    (item?.provider || '').toLowerCase() === 'vids' ||
    (item?.model || '').toLowerCase().includes('google vids') ||
    (item?.model || '').toLowerCase().includes('vids omni');
  const canRemoveWatermark =
    isVideo &&
    isGoogleVids &&
    /^\/media-cache\/vids_[^/]+\.mp4$/i.test(item?.mediaUrl || '');

  useEffect(() => {
    setUseProxy(false);
    setHasPlaybackError(false);
    setProcessedVideoUrl(null);
    setIsRemovingWatermark(false);
    setWatermarkLogs([]);
    setWatermarkError(null);
  }, [item?.id, item?.mediaUrl]);

  // Video State & Frame Extraction State
  const [currentVideoTime, setCurrentVideoTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isVideoPaused, setIsVideoPaused] = useState<boolean>(true);
  const [isExtractingFrame, setIsExtractingFrame] = useState<boolean>(false);
  const [extractedFrame, setExtractedFrame] = useState<ExtractedFrameData | null>(null);
  const [isFrameModalOpen, setIsFrameModalOpen] = useState<boolean>(false);
  const [copiedFrame, setCopiedFrame] = useState<boolean>(false);
  const [isDownloadingFrame, setIsDownloadingFrame] = useState<boolean>(false);
  const [showPrompt, setShowPrompt] = useState<boolean>(false);

  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    setDetectedAspect(null);
    setUseProxy(false);
    setCurrentVideoTime(0);
    setVideoDuration(0);
    setExtractedFrame(null);
    setIsFrameModalOpen(false);
    setShowPrompt(false);
  }, [item?.id, item?.mediaUrl]);

  React.useEffect(() => {
    if (item && isVideo && videoRef.current && activeMediaUrl) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsVideoPaused(false))
          .catch(() => {
            setIsVideoPaused(true);
          });
      }
    }
  }, [activeMediaUrl, isVideo, useProxy]);

  const processDimensions = (w: number, h: number) => {
    if (!w || !h) return;
    const rawRatio = w / h;

    let orientation: 'portrait' | 'landscape' | 'square' = 'square';
    if (rawRatio < 0.88) {
      orientation = 'portrait';
    } else if (rawRatio > 1.12) {
      orientation = 'landscape';
    }

    let ratioLabel = '';
    if (Math.abs(rawRatio - 9 / 16) < 0.08) ratioLabel = '9:16 (Vertical)';
    else if (Math.abs(rawRatio - 3 / 4) < 0.06) ratioLabel = '3:4 (Vertical)';
    else if (Math.abs(rawRatio - 2 / 3) < 0.06) ratioLabel = '2:3 (Vertical)';
    else if (Math.abs(rawRatio - 1) < 0.08) ratioLabel = '1:1 (Square)';
    else if (Math.abs(rawRatio - 4 / 3) < 0.06) ratioLabel = '4:3 (Landscape)';
    else if (Math.abs(rawRatio - 16 / 9) < 0.08) ratioLabel = '16:9 (Landscape)';
    else if (Math.abs(rawRatio - 21 / 9) < 0.08) ratioLabel = '21:9 (Landscape)';
    else {
      ratioLabel = `${w}x${h} (${orientation === 'portrait' ? 'Vertical' : orientation === 'landscape' ? 'Landscape' : 'Square'})`;
    }

    setDetectedAspect({
      ratioLabel,
      orientation,
      width: w,
      height: h,
    });
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    processDimensions(img.naturalWidth, img.naturalHeight);
  };

  const handleVideoMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = e.currentTarget;
    processDimensions(vid.videoWidth, vid.videoHeight);
    if (vid.duration && !isNaN(vid.duration)) {
      setVideoDuration(vid.duration);
    }
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = e.currentTarget;
    setCurrentVideoTime(vid.currentTime || 0);
    setIsVideoPaused(vid.paused);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  };

  const formatDisplayTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Extract Frame Logic from Current Video Time into PNG
  const handleExtractFrame = async () => {
    if (!videoRef.current || !item?.mediaUrl || isExtractingFrame) return;
    setIsExtractingFrame(true);

    try {
      const video = videoRef.current;
      // Pause video for pristine frame snapshot
      if (!video.paused) {
        video.pause();
        setIsVideoPaused(true);
      }

      const captureTime = video.currentTime || 0;
      const formattedTime = formatSeconds(captureTime);
      const width = video.videoWidth || detectedAspect?.width || 1080;
      const height = video.videoHeight || detectedAspect?.height || 1920;

      let extractedDataUrl = '';

      // Attempt 1: Direct in-memory canvas capture
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          extractedDataUrl = canvas.toDataURL('image/png');
        }
      } catch (corsErr) {
        console.warn('[Frame Extraction] Canvas direct export tainted, fetching via proxy video stream...', corsErr);
      }

      // Attempt 2: If direct export failed due to CORS, use secondary video element with /api/proxy-video
      if (!extractedDataUrl) {
        const proxyStreamUrl = `/api/proxy-video?url=${encodeURIComponent(item.mediaUrl)}`;
        extractedDataUrl = await new Promise<string>((resolve, reject) => {
          const offVideo = document.createElement('video');
          offVideo.crossOrigin = 'anonymous';
          offVideo.src = proxyStreamUrl;
          offVideo.muted = true;
          offVideo.playsInline = true;
          offVideo.currentTime = captureTime;

          const timeoutTimer = setTimeout(() => {
            offVideo.src = '';
            reject(new Error('Timeout saat mengambil frame video'));
          }, 12000);

          offVideo.onseeked = () => {
            clearTimeout(timeoutTimer);
            try {
              const offCanvas = document.createElement('canvas');
              offCanvas.width = offVideo.videoWidth || width;
              offCanvas.height = offVideo.videoHeight || height;
              const offCtx = offCanvas.getContext('2d');
              if (offCtx) {
                offCtx.drawImage(offVideo, 0, 0, offCanvas.width, offCanvas.height);
                const resultUrl = offCanvas.toDataURL('image/png');
                offVideo.src = '';
                resolve(resultUrl);
              } else {
                reject(new Error('Gagal menginisialisasi canvas context'));
              }
            } catch (canvasErr) {
              reject(canvasErr);
            }
          };

          offVideo.onerror = () => {
            clearTimeout(timeoutTimer);
            reject(new Error('Gagal memuat video proxy stream'));
          };
        });
      }

      if (extractedDataUrl) {
        setExtractedFrame({
          dataUrl: extractedDataUrl,
          timestamp: captureTime,
          formattedTime,
          width,
          height,
        });
        setIsFrameModalOpen(true);
      }
    } catch (err: any) {
      console.error('[Extract Frame Error]:', err);
      alert('Gagal mengekstrak frame dari video. Silakan coba kembali.');
    } finally {
      setIsExtractingFrame(false);
    }
  };

  const handleDownloadExtractedFrame = () => {
    if (!extractedFrame?.dataUrl || isDownloadingFrame) return;
    setIsDownloadingFrame(true);
    try {
      const cleanName = (item?.model || 'video_frame').replace(/[^a-zA-Z0-9_-]/g, '_');
      const timeTag = extractedFrame.formattedTime.replace(/[:.]/g, '-');
      const filename = `frame_${timeTag}_${cleanName}.png`;

      const link = document.createElement('a');
      link.href = extractedFrame.dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.warn('Download frame failed:', e);
    } finally {
      setIsDownloadingFrame(false);
    }
  };

  const handleCopyExtractedFrame = async () => {
    if (!extractedFrame?.dataUrl) return;
    try {
      // Convert data URL to Blob for Clipboard API
      const res = await fetch(extractedFrame.dataUrl);
      const blob = await res.blob();
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setCopiedFrame(true);
        setTimeout(() => setCopiedFrame(false), 2000);
      } else {
        // Fallback: write base64 or inform user
        setCopiedFrame(true);
        setTimeout(() => setCopiedFrame(false), 2000);
      }
    } catch (err) {
      console.warn('Copy frame clipboard failed:', err);
    }
  };

  const handleUseExtractedFrameAsReference = () => {
    if (!extractedFrame?.dataUrl) return;
    if (onSendExtractedFrameAsReference) {
      onSendExtractedFrameAsReference(
        extractedFrame.dataUrl,
        `Frame ${extractedFrame.formattedTime} (${item?.model || 'Video'})`
      );
    } else if (onSendAsReference && item) {
      onSendAsReference({
        ...item,
        mediaUrl: extractedFrame.dataUrl,
        thumbnailUrl: extractedFrame.dataUrl,
        mode: 'image',
        title: `Frame ${extractedFrame.formattedTime}`,
      });
    }
    setIsFrameModalOpen(false);
    onClose();
  };

  const isPortrait =
    detectedAspect?.orientation === 'portrait' ||
    (!detectedAspect && (
      item?.aspectRatio?.includes('9:16') ||
      item?.aspectRatio?.includes('3:4') ||
      item?.aspectRatio?.includes('2:3') ||
      item?.aspectRatio?.includes('9/16') ||
      item?.aspectRatio?.toLowerCase().includes('portrait') ||
      (isVideo && !item?.aspectRatio?.includes('16:9') && !item?.aspectRatio?.includes('1:1'))
    ));

  const isSquare =
    detectedAspect?.orientation === 'square' ||
    (!detectedAspect && (
      item?.aspectRatio?.includes('1:1') || item?.aspectRatio?.includes('1/1')
    ));

  const mediaContainerClass = isPortrait
    ? 'w-full max-w-[320px] sm:max-w-[360px] max-h-[480px] sm:max-h-[520px] mx-auto shadow-md'
    : isSquare
    ? 'w-full max-w-[380px] sm:max-w-[400px] max-h-[440px] mx-auto shadow-sm'
    : 'w-full max-w-[500px] max-h-[440px] mx-auto shadow-xs';

  const handleDownload = async () => {
    if (!activeMediaUrl || isDownloading) return;
    setIsDownloading(true);
    try {
      const cleanTitle = getCleanPrompt(item.prompt, item.model) || item.title || 'weavy_media';
      await downloadMediaFile(activeMediaUrl, cleanTitle, item.mode || (isVideo ? 'video' : 'image'), item.model);
    } catch (e) {
      console.warn('Download media failed:', e);
      if (activeMediaUrl) {
        window.open(activeMediaUrl, '_blank');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRemoveWatermark = async () => {
    if (!item || !canRemoveWatermark || isRemovingWatermark) return;

    setIsRemovingWatermark(true);
    setWatermarkLogs(['Memulai remove watermark...']);
    setWatermarkError(null);

    try {
      const response = await fetch('/api/vids/remove-watermark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: item.mediaUrl }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || `Permintaan gagal (HTTP ${response.status}).`);
      }
      if (!response.body) throw new Error('Server tidak mengirim log proses.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let completed = false;

      const handleEvent = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as RemoveWatermarkEvent;
        if (event.type === 'log') {
          setWatermarkLogs((current) => [...current, event.message]);
        } else if (event.type === 'complete') {
          completed = true;
          setProcessedVideoUrl(event.videoUrl);
          onMediaUpdated?.(item.id, event.videoUrl);
          setWatermarkLogs((current) => [...current, 'Selesai. Preview diperbarui ke hasil remove watermark.']);
        } else if (event.type === 'error') {
          throw new Error(event.message);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) handleEvent(line);
        if (done) break;
      }
      handleEvent(buffer);
      if (!completed) throw new Error('Proses berakhir tanpa mengembalikan file hasil.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Proses remove watermark gagal.';
      setWatermarkError(message);
      setWatermarkLogs((current) => [...current, `Gagal: ${message}`]);
    } finally {
      setIsRemovingWatermark(false);
    }
  };

  const handleCopyPrompt = () => {
    if (item?.prompt) {
      navigator.clipboard.writeText(item.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDelete = () => {
    if (onDelete && item) {
      if (window.confirm('Apakah Anda yakin ingin menghapus media ini?')) {
        onDelete(item.id);
        onClose();
      }
    }
  };

  return (
    <AnimatePresence>
      {item && (
        <div id="generation-detail-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs">
          <div className="absolute inset-0" onClick={onClose} />

          <motion.div
            id="generation-detail-modal"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className={`relative w-full ${
              isPortrait
                ? 'max-w-md sm:max-w-lg'
                : isSquare
                ? 'max-w-lg sm:max-w-xl'
                : 'max-w-xl sm:max-w-2xl md:max-w-3xl'
            } bg-white dark:bg-[#141418] rounded-3xl shadow-2xl overflow-hidden z-10 max-h-[94vh] flex flex-col transition-all duration-300 border border-stone-200/80 dark:border-white/10`}
          >
            {/* Minimal Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-stone-200/80 dark:border-white/10 bg-white dark:bg-[#141418] sticky top-0 z-20">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  id="btn-detail-close-left"
                  onClick={onClose}
                  className="p-1 -ml-1 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer shrink-0"
                  title="Kembali"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2 min-w-0 truncate">
                  <div className="w-5 h-5 rounded-md bg-stone-100 dark:bg-stone-800 flex items-center justify-center p-0.5 shrink-0">
                    <img
                      src={getProviderDetails(item.provider, item.model).logoUrl}
                      alt="Provider"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                    {getCleanModelName(item.model) || item.model || (isVideo ? 'Video' : 'Image')}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider shrink-0 ${
                    item.mode === 'image'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                  }`}>
                    {item.mode === 'image' ? 'Image' : 'Video'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <div className="relative">
                  <button
                    id="btn-detail-more-opts"
                    onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
                    className="p-1.5 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                    title="Opsi Lanjutan"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {isHeaderMenuOpen && (
                    <div className="absolute right-0 top-8 z-30 w-52 bg-white dark:bg-[#1C1C24] rounded-xl shadow-xl border border-stone-200 dark:border-white/10 py-1.5 text-xs">
                      {item.mediaUrl && (
                        <a
                          href={activeMediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/5 font-medium cursor-pointer"
                          onClick={() => setIsHeaderMenuOpen(false)}
                        >
                          <ExternalLink className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                          <span>Buka di Tab Baru</span>
                        </a>
                      )}
                      {onReuseItem && (
                        <button
                          onClick={() => {
                            setIsHeaderMenuOpen(false);
                            onReuseItem(item);
                            onClose();
                          }}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-stone-700 dark:text-stone-200 hover:bg-amber-50 dark:hover:bg-white/5 hover:text-amber-700 dark:hover:text-amber-300 font-medium cursor-pointer"
                        >
                          <Undo2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>Gunakan Kembali Input</span>
                        </button>
                      )}
                      {item.mediaUrl && onSendAsReference && (
                        <button
                          onClick={() => {
                            setIsHeaderMenuOpen(false);
                            onSendAsReference(item);
                          }}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-stone-700 dark:text-stone-200 hover:bg-amber-50 dark:hover:bg-white/5 hover:text-amber-700 dark:hover:text-amber-300 font-medium cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>Gunakan sbg Referensi</span>
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => {
                            setIsHeaderMenuOpen(false);
                            handleDelete();
                          }}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer border-t border-stone-100 dark:border-white/5 mt-1"
                        >
                          <Trash2 className="w-4 h-4 shrink-0" />
                          <span>Hapus Media</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <button
                  id="btn-detail-close-right"
                  onClick={onClose}
                  className="p-1.5 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer shrink-0"
                  title="Tutup"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* Center Stage: Minimalist Media Hero Player */}
            <div className="relative bg-black flex items-center justify-center overflow-hidden min-h-[220px] max-h-[64vh] sm:max-h-[70vh]">
              {/* Subtle ambient backdrop */}
              {(() => {
                const backdrop = getBestThumbnailImage(item) || (!isVideo && item.mediaUrl ? item.mediaUrl : null);
                return backdrop ? (
                  <div
                    className="absolute inset-0 bg-cover bg-center blur-2xl opacity-30 scale-110 pointer-events-none transition-opacity duration-500"
                    style={{ backgroundImage: `url(${backdrop})` }}
                  />
                ) : null;
              })()}

              {isVideo ? (
                item.status === 'failed' || hasPlaybackError ? (
                  <div className="relative z-10 w-full min-h-[260px] max-w-md mx-auto my-auto p-6 rounded-3xl bg-stone-900/90 border border-rose-500/30 flex flex-col items-center justify-center text-center space-y-3.5 shadow-2xl backdrop-blur-md">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-rose-200">Gagal Memutar / Merender Video</h4>
                      <p className="text-xs text-stone-300 leading-relaxed max-w-sm">
                        {item.errorMessage || 'Server AI mengalami kendala saat merender frame video ini.'}
                      </p>
                    </div>
                    {item.prompt && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setHasPlaybackError(false);
                            setUseProxy(true);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs flex items-center gap-1.5 border border-white/10 transition-all cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Coba Muat Ulang</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onUsePrompt(item.prompt);
                          }}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Gunakan Prompt Ini</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : activeMediaUrl ? (
                  <video
                    key={`${activeMediaUrl}-${useProxy}`}
                    ref={videoRef}
                    src={(() => {
                      if (!activeMediaUrl) return '';
                      if (activeMediaUrl.startsWith('/media-cache/') || activeMediaUrl.startsWith('data:')) {
                        return activeMediaUrl;
                      }
                      if (useProxy || activeMediaUrl.includes('googleusercontent.com') || activeMediaUrl.includes('contribution.usercontent')) {
                        let activeToken = '';
                        try {
                          const gAccounts = JSON.parse(localStorage.getItem('gemini_accounts') || '[]');
                          const active = gAccounts.find((a: any) => a.isActive) || gAccounts[0];
                          if (active?.refreshToken) activeToken = active.refreshToken;
                        } catch (e) {}

                        let pUrl = `/api/proxy-video?url=${encodeURIComponent(activeMediaUrl)}`;
                        if (activeToken) {
                          pUrl += `&token=${encodeURIComponent(activeToken)}`;
                        }
                        return pUrl;
                      }
                      return activeMediaUrl;
                    })()}
                    onLoadedMetadata={handleVideoMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onPause={() => setIsVideoPaused(true)}
                    onPlay={() => setIsVideoPaused(false)}
                    onError={() => {
                      if (!useProxy && activeMediaUrl && activeMediaUrl.startsWith('http')) {
                        console.warn('[Video Player] Direct playback error, switching to proxy...');
                        setUseProxy(true);
                      } else {
                        console.warn('[Video Player] Video playback error detected.');
                        setHasPlaybackError(true);
                      }
                    }}
                    poster={getBestThumbnailImage(item) || undefined}
                    controls
                    autoPlay
                    playsInline
                    preload="auto"
                    referrerPolicy="no-referrer"
                    className="relative z-10 w-full max-h-[62vh] sm:max-h-[68vh] object-contain mx-auto"
                  />
                ) : (
                  <div className="relative z-10 w-full h-64 bg-stone-950 flex flex-col items-center justify-center p-4 text-center">
                    <div className="bg-black/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-white text-xs font-semibold shadow-lg">
                      Video sedang diproses...
                    </div>
                  </div>
                )
              ) : (
                Boolean(item.mediaUrl?.trim() || item.thumbnailUrl?.trim()) ? (
                  <img
                    src={(item.mediaUrl?.trim() || item.thumbnailUrl?.trim())!}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    onLoad={handleImageLoad}
                    className="relative z-10 w-full max-h-[62vh] sm:max-h-[68vh] object-contain mx-auto"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="relative z-10 w-full h-64 bg-slate-900 flex items-center justify-center text-stone-400 text-xs font-medium">
                    Pratinjau media tidak tersedia
                  </div>
                )
              )}
            </div>

            {/* Bottom: Aksi Cepat (Minimalist Quick Actions) */}
            <div className="p-3 sm:p-4 bg-white dark:bg-[#141418] border-t border-stone-200/80 dark:border-white/10 space-y-2.5 font-sans-body">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {/* Left: Essential Actions (Download & Frame Extractor) */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Download */}
                  <button
                    id="btn-detail-download-media"
                    type="button"
                    onClick={handleDownload}
                    disabled={isDownloading || !activeMediaUrl}
                    className="px-3.5 py-2 bg-amber-600 dark:bg-amber-500 hover:bg-amber-700 dark:hover:bg-amber-400 active:scale-[0.98] text-white dark:text-stone-950 font-semibold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    ) : (
                      <Download className="w-4 h-4 shrink-0" />
                    )}
                    <span>Download</span>
                  </button>

                  {canRemoveWatermark && !processedVideoUrl && (
                    <button
                      id="btn-remove-vids-watermark"
                      type="button"
                      onClick={handleRemoveWatermark}
                      disabled={isRemovingWatermark}
                      className="px-3.5 py-2 bg-stone-800 dark:bg-white/10 hover:bg-stone-700 dark:hover:bg-white/15 active:scale-[0.98] text-white dark:text-stone-100 font-semibold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                    >
                      {isRemovingWatermark ? (
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      ) : (
                        <Sparkles className="w-4 h-4 shrink-0" />
                      )}
                      <span>{isRemovingWatermark ? 'Memproses...' : 'Remove Watermark'}</span>
                    </button>
                  )}

                  {/* Extract Frame (.PNG) for Video */}
                  {isVideo && item.mediaUrl && (
                    <button
                      id="btn-quick-extract-frame"
                      type="button"
                      onClick={handleExtractFrame}
                      disabled={isExtractingFrame}
                      className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 active:scale-[0.98] text-white font-semibold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Ambil frame saat ini sebagai gambar PNG"
                    >
                      {isExtractingFrame ? (
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      ) : (
                        <Camera className="w-4 h-4 shrink-0" />
                      )}
                      <span>{isExtractingFrame ? 'Mengekstrak...' : 'Ekstrak Frame'}</span>
                    </button>
                  )}
                </div>

                {/* Right: Quick Tools (Copy Prompt & Peek Drawer) */}
                <div className="flex items-center gap-1.5">
                  {/* Copy Prompt */}
                  <button
                    id="btn-copy-prompt"
                    type="button"
                    onClick={handleCopyPrompt}
                    className="px-3 py-2 bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 active:scale-[0.98] text-stone-700 dark:text-stone-300 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer border border-stone-200/80 dark:border-white/10"
                    title="Salin Prompt"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    )}
                    <span>{copied ? 'Tersalin!' : 'Salin Prompt'}</span>
                  </button>

                  {/* Toggle Prompt Peek */}
                  {item.prompt && (
                    <button
                      type="button"
                      onClick={() => setShowPrompt(!showPrompt)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer border ${
                        showPrompt
                          ? 'bg-stone-200/70 dark:bg-white/15 border-stone-300 dark:border-white/20 text-stone-900 dark:text-white font-semibold'
                          : 'bg-stone-100/80 dark:bg-white/5 border-stone-200/80 dark:border-white/10 text-stone-600 dark:text-stone-400 hover:bg-stone-200/50 dark:hover:bg-white/10'
                      }`}
                      title={showPrompt ? 'Tutup Teks Prompt' : 'Lihat Teks Prompt'}
                    >
                      <span>Prompt</span>
                      {showPrompt ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {(watermarkLogs.length > 0 || watermarkError) && (
                <div
                  aria-live="polite"
                  className="max-h-28 overflow-y-auto rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-black/20 px-3 py-2 text-[11px] font-mono text-stone-600 dark:text-stone-300 space-y-1"
                >
                  {watermarkLogs.map((log, index) => (
                    <div key={`${index}-${log}`} className="whitespace-pre-wrap break-words">{log}</div>
                  ))}
                  {watermarkError && (
                    <div className="text-rose-600 dark:text-rose-400">{watermarkError}</div>
                  )}
                </div>
              )}

              {/* Optional Collapsible Prompt Peek */}
              {showPrompt && item.prompt && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 bg-stone-50 dark:bg-[#1B1B22] rounded-xl border border-stone-200/80 dark:border-white/10 text-xs space-y-1.5 overflow-hidden"
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                    <span>Prompt:</span>
                    {onUsePrompt && (
                      <button
                        type="button"
                        onClick={() => {
                          onUsePrompt(item.prompt);
                          onClose();
                        }}
                        className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                      >
                        <Undo2 className="w-3 h-3" />
                        <span>Gunakan di Form</span>
                      </button>
                    )}
                  </div>
                  <p className="max-h-24 overflow-y-auto break-words leading-relaxed text-stone-800 dark:text-stone-200">
                    {getCleanPrompt(item.prompt, item.model)}
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* EXTRACTED FRAME MODAL PREVIEW */}
          <AnimatePresence>
            {isFrameModalOpen && extractedFrame && (
              <div id="extracted-frame-modal" className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
                <div className="absolute inset-0" onClick={() => setIsFrameModalOpen(false)} />

                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  className="relative w-full max-w-lg bg-white dark:bg-[#181820] rounded-3xl shadow-2xl overflow-hidden z-20 border border-stone-200 dark:border-white/10 flex flex-col max-h-[90vh]"
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-[#141418]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                        <Camera className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                          Hasil Ekstraksi Frame
                        </h3>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                          Detik {extractedFrame.formattedTime} • {extractedFrame.width} × {extractedFrame.height} px
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsFrameModalOpen(false)}
                      className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Frame Image View */}
                  <div className="p-4 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-stone-950/5 dark:bg-black/40">
                    <div className="relative rounded-xl overflow-hidden border border-stone-200 dark:border-white/10 max-h-[420px] shadow-lg bg-stone-900 flex items-center justify-center">
                      <img
                        src={extractedFrame.dataUrl}
                        alt={`Extracted Frame ${extractedFrame.formattedTime}`}
                        className="max-h-[420px] w-auto max-w-full object-contain"
                      />
                    </div>
                  </div>

                  {/* Action Buttons for Extracted Frame */}
                  <div className="p-4 sm:p-5 border-t border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-[#141418] space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Download PNG */}
                      <button
                        id="btn-download-frame-png"
                        type="button"
                        onClick={handleDownloadExtractedFrame}
                        disabled={isDownloadingFrame}
                        className="w-full py-2.5 px-4 bg-stone-900 dark:bg-white/10 hover:bg-stone-800 dark:hover:bg-white/15 active:scale-[0.98] text-white dark:text-stone-100 font-semibold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>Download Frame (.PNG)</span>
                      </button>

                      {/* Use as Input Reference */}
                      <button
                        id="btn-use-frame-as-reference"
                        type="button"
                        onClick={handleUseExtractedFrameAsReference}
                        className="w-full py-2.5 px-4 bg-amber-600 dark:bg-amber-500 hover:bg-amber-700 dark:hover:bg-amber-400 active:scale-[0.98] text-white dark:text-stone-950 font-semibold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 shrink-0" />
                        <span>Gunakan sbg Referensi Input</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <button
                        type="button"
                        onClick={handleCopyExtractedFrame}
                        className="inline-flex items-center gap-1.5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 font-medium py-1 px-2 rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        {copiedFrame ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedFrame ? 'Tersalin ke Clipboard!' : 'Salin Gambar ke Clipboard'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsFrameModalOpen(false)}
                        className="text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 font-medium py-1 px-2 cursor-pointer"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
};
