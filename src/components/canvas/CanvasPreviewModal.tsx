import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  X,
  Download,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Loader2,
  Camera,
  AlertCircle,
} from 'lucide-react';
import { downloadMediaFile } from '../../utils';
import { ModelBadgeIcon } from './CanvasNodeCard';
import { getCleanModelName } from '../../types';

interface ExtractedFrameData {
  dataUrl: string;
  timestamp: number;
  formattedTime: string;
  width: number;
  height: number;
}

interface CanvasPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string;
  title?: string;
  model?: string;
  sourceNodeId?: string;
  onRemoveWatermark?: (nodeId: string) => Promise<void>;
  onToast?: (msg: string) => void;
}

export const CanvasPreviewModal: React.FC<CanvasPreviewModalProps> = ({
  isOpen,
  onClose,
  mediaUrl,
  title,
  model,
  sourceNodeId,
  onRemoveWatermark,
  onToast,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRemovingWatermark, setIsRemovingWatermark] = useState(false);
  const [useProxy, setUseProxy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Aspect ratio & dimension detection
  const [detectedAspect, setDetectedAspect] = useState<{
    ratioLabel: string;
    orientation: 'portrait' | 'landscape' | 'square';
    width: number;
    height: number;
  } | null>(null);

  // Video State & Frame Extraction
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isExtractingFrame, setIsExtractingFrame] = useState(false);
  const [extractedFrame, setExtractedFrame] = useState<ExtractedFrameData | null>(null);
  const [isFrameModalOpen, setIsFrameModalOpen] = useState(false);
  const [isDownloadingFrame, setIsDownloadingFrame] = useState(false);
  const [copiedFrame, setCopiedFrame] = useState(false);

  const cleanUrl = (mediaUrl || '').trim();
  const isVideo = !!cleanUrl.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/i);
  const canRemoveWatermark =
    isVideo &&
    Boolean(sourceNodeId && onRemoveWatermark) &&
    /^\/media-cache\/(?:vids|stitched)_[^/]+\.mp4$/i.test(cleanUrl) &&
    !/_nowm\.mp4$/i.test(cleanUrl);

  // Resolve accurate model name
  const rawModel = model || title || '';
  const isGeneric = !rawModel || rawModel.includes('Hasil Generasi Canvas') || rawModel.includes('Preview Gambar') || rawModel.includes('Video Preview');
  const resolvedModelName = isGeneric ? (isVideo ? 'SeeDance 2.0' : 'ChatGPT Images 2.0 Edit') : rawModel;
  const cleanModelName = getCleanModelName(resolvedModelName) || resolvedModelName;

  const effectiveSrc = useProxy
    ? isVideo
      ? `/api/proxy-video?url=${encodeURIComponent(cleanUrl)}`
      : `/api/proxy-image?url=${encodeURIComponent(cleanUrl)}`
    : cleanUrl;

  // Reset states on open / change URL
  useEffect(() => {
    if (isOpen) {
      setUseProxy(false);
      setIsLoading(true);
      setHasError(false);
      setIsDownloading(false);
      setIsRemovingWatermark(false);
      setDetectedAspect(null);
      setExtractedFrame(null);
      setIsFrameModalOpen(false);
    }
  }, [isOpen, cleanUrl]);

  // Keyboard navigation: Escape to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFrameModalOpen) {
          setIsFrameModalOpen(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFrameModalOpen, onClose]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

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
    setIsLoading(false);
    processDimensions(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
  };

  const handleVideoMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setIsLoading(false);
    processDimensions(e.currentTarget.videoWidth, e.currentTarget.videoHeight);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const safeTitle = (cleanModelName || title || 'media').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `canvas_${safeTitle}`;
      const success = await downloadMediaFile(cleanUrl, fileName, isVideo ? 'video' : 'image');
      if (success) {
        if (onToast) onToast('Media berhasil diunduh ke komputer!');
      } else {
        if (onToast) onToast('Gagal download otomatis, membuka file di tab baru...');
      }
    } catch (err) {
      console.error('[CanvasPreviewModal] Download error:', err);
      if (onToast) onToast('Terjadi kesalahan saat download.');
      window.open(cleanUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRemoveWatermark = async () => {
    if (!sourceNodeId || !onRemoveWatermark || isRemovingWatermark) return;
    setIsRemovingWatermark(true);
    try {
      await onRemoveWatermark(sourceNodeId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Remove watermark gagal.';
      onToast?.(message);
    } finally {
      setIsRemovingWatermark(false);
    }
  };

  // Video Frame Extraction
  const handleExtractFrame = async () => {
    if (!videoRef.current || !cleanUrl || isExtractingFrame) return;
    setIsExtractingFrame(true);

    try {
      const video = videoRef.current;
      if (!video.paused) {
        video.pause();
      }

      const captureTime = video.currentTime || 0;
      const formattedTime = formatSeconds(captureTime);
      const width = video.videoWidth || detectedAspect?.width || 1080;
      const height = video.videoHeight || detectedAspect?.height || 1920;

      let extractedDataUrl = '';

      // Direct canvas capture
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
        console.warn('[Canvas Frame Extraction] Direct capture tainted, trying proxy...', corsErr);
      }

      // Fallback via proxy video stream
      if (!extractedDataUrl) {
        const proxyStreamUrl = `/api/proxy-video?url=${encodeURIComponent(cleanUrl)}`;
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
      console.error('[Canvas Extract Frame Error]:', err);
      if (onToast) onToast('Gagal mengekstrak frame dari video.');
    } finally {
      setIsExtractingFrame(false);
    }
  };

  const handleDownloadExtractedFrame = () => {
    if (!extractedFrame?.dataUrl || isDownloadingFrame) return;
    setIsDownloadingFrame(true);
    try {
      const cleanName = (title || 'canvas_frame').replace(/[^a-zA-Z0-9_-]/g, '_');
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
      const res = await fetch(extractedFrame.dataUrl);
      const blob = await res.blob();
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopiedFrame(true);
        if (onToast) onToast('Gambar frame disalin ke clipboard!');
        setTimeout(() => setCopiedFrame(false), 2000);
      }
    } catch (err) {
      console.warn('Copy frame failed:', err);
    }
  };

  const isPortrait = detectedAspect?.orientation === 'portrait';
  const isSquare = detectedAspect?.orientation === 'square';

  return (
    <AnimatePresence>
      {isOpen && cleanUrl && (
        <div
          id="canvas-detail-backdrop"
          className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs select-none"
        >
          {/* Backdrop click to dismiss */}
          <div className="absolute inset-0" onClick={onClose} />

          <motion.div
            id="canvas-detail-modal"
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
            {/* Minimal Header (Identical to GenerationDetailModal) */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-stone-200/80 dark:border-white/10 bg-white dark:bg-[#141418] sticky top-0 z-20">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={onClose}
                  className="p-1 -ml-1 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer shrink-0"
                  title="Kembali (Esc)"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2.5 min-w-0 truncate">
                  <div className="w-6 h-6 rounded-lg bg-stone-100 dark:bg-stone-800/80 border border-stone-200/80 dark:border-white/10 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-xs">
                    <ModelBadgeIcon model={cleanModelName} className="w-full h-full object-contain" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                    {cleanModelName}
                  </span>
                  {isVideo && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider shrink-0 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                      Video
                    </span>
                  )}
                </div>
              </div>

              {/* Right: External link and Close */}
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={cleanUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                  title="Buka di Tab Baru"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  onClick={onClose}
                  className="p-1.5 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer shrink-0"
                  title="Tutup (Esc)"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* Center Stage: Minimalist Media Hero with Ambient Glow */}
            <div className="relative bg-black flex items-center justify-center overflow-hidden min-h-[220px] max-h-[64vh] sm:max-h-[70vh]">
              {/* Subtle ambient backdrop */}
              <div
                className="absolute inset-0 bg-cover bg-center blur-2xl opacity-30 scale-110 pointer-events-none transition-opacity duration-500"
                style={{ backgroundImage: effectiveSrc ? `url(${effectiveSrc})` : undefined }}
              />

              {/* Loading Indicator */}
              {isLoading && !hasError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-950/60 z-20 pointer-events-none">
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-2" />
                  <span className="text-xs font-medium text-stone-300">Memuat media resolusi penuh...</span>
                </div>
              )}

              {/* Error fallback */}
              {hasError ? (
                <div className="relative z-20 flex flex-col items-center justify-center text-center p-6 bg-stone-900/90 rounded-2xl border border-stone-800 max-w-sm m-4">
                  <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-2.5">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-semibold text-stone-100 mb-1">Gagal Menampilkan Media</h4>
                  <p className="text-[11px] text-stone-400 mb-3.5 leading-relaxed">
                    Browser tidak dapat merender media secara langsung. Silakan download atau buka tautan asli.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download File
                    </button>
                    <a
                      href={cleanUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Buka Tab Baru
                    </a>
                  </div>
                </div>
              ) : !cleanUrl ? (
                <div className="relative z-20 flex flex-col items-center justify-center text-center p-6 bg-stone-900/90 rounded-2xl border border-stone-800 max-w-sm m-4">
                  <p className="text-xs text-stone-400">Media tidak tersedia.</p>
                </div>
              ) : isVideo ? (
                <video
                  ref={videoRef}
                  key={`${cleanUrl}-${useProxy}`}
                  src={effectiveSrc || undefined}
                  onLoadedMetadata={handleVideoMetadata}
                  onError={() => {
                    if (!useProxy) {
                      setUseProxy(true);
                      setIsLoading(true);
                    } else {
                      setHasError(true);
                      setIsLoading(false);
                    }
                  }}
                  controls
                  autoPlay
                  loop
                  playsInline
                  preload="auto"
                  referrerPolicy="no-referrer"
                  className="relative z-10 w-full max-h-[62vh] sm:max-h-[68vh] object-contain mx-auto"
                />
              ) : (
                <img
                  key={`${cleanUrl}-${useProxy}`}
                  src={effectiveSrc || undefined}
                  alt={title || 'Canvas Image Preview'}
                  referrerPolicy="no-referrer"
                  onLoad={handleImageLoad}
                  onError={() => {
                    if (!useProxy) {
                      setUseProxy(true);
                      setIsLoading(true);
                    } else {
                      setHasError(true);
                      setIsLoading(false);
                    }
                  }}
                  className="relative z-10 w-full max-h-[62vh] sm:max-h-[68vh] object-contain mx-auto"
                />
              )}
            </div>

            {/* Bottom: Quick Actions Bar (Clean, download-focused, identical tokens to GenerationDetailModal) */}
            <div className="p-3 sm:p-4 bg-white dark:bg-[#141418] border-t border-stone-200/80 dark:border-white/10 font-sans-body">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {/* Left: Download Button (and Extract Frame for Video) */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    id="btn-canvas-preview-download"
                    type="button"
                    onClick={handleDownload}
                    disabled={isDownloading || !cleanUrl}
                    className="px-3.5 py-2 bg-amber-600 dark:bg-amber-500 hover:bg-amber-700 dark:hover:bg-amber-400 active:scale-[0.98] text-white dark:text-stone-950 font-semibold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    ) : (
                      <Download className="w-4 h-4 shrink-0" />
                    )}
                    <span>Download</span>
                  </button>

                  {canRemoveWatermark && (
                    <button
                      id="btn-canvas-remove-watermark"
                      type="button"
                      onClick={handleRemoveWatermark}
                      disabled={isRemovingWatermark}
                      className="px-3 py-2 bg-stone-700 hover:bg-stone-600 active:scale-[0.98] text-white font-semibold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
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
                  {isVideo && cleanUrl && (
                    <button
                      id="btn-canvas-extract-frame"
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

              </div>
            </div>
          </motion.div>

          {/* EXTRACTED FRAME MODAL PREVIEW (For Video) */}
          <AnimatePresence>
            {isFrameModalOpen && extractedFrame && (
              <div
                id="canvas-extracted-frame-modal"
                className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md"
              >
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
                        type="button"
                        onClick={handleDownloadExtractedFrame}
                        disabled={isDownloadingFrame}
                        className="w-full py-2.5 px-4 bg-stone-900 dark:bg-white/10 hover:bg-stone-800 dark:hover:bg-white/15 active:scale-[0.98] text-white dark:text-stone-100 font-semibold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>Download Frame (.PNG)</span>
                      </button>

                      {/* Copy to clipboard */}
                      <button
                        type="button"
                        onClick={handleCopyExtractedFrame}
                        className="w-full py-2.5 px-4 bg-amber-600 dark:bg-amber-500 hover:bg-amber-700 dark:hover:bg-amber-400 active:scale-[0.98] text-white dark:text-stone-950 font-semibold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {copiedFrame ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedFrame ? 'Tersalin!' : 'Salin ke Clipboard'}</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-end pt-1 text-xs">
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
