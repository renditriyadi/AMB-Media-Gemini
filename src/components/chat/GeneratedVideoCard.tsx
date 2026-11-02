import React, { useState, useRef } from "react";
import {
  Play,
  Pause,
  Maximize2,
  Download,
  Copy,
  Check,
  RotateCcw,
  Volume2,
  VolumeX,
  Flame,
  Sparkles,
  Undo2,
} from "lucide-react";
import { downloadMediaFile } from "../../utils";
import { resolveVideoProvider } from "./videoProvider";

interface GeneratedVideoData {
  url?: string;
  coverUrl?: string;
  prompt?: string;
  modelName?: string;
  aspectRatio?: string;
  duration?: string;
  resolution?: string;
  provider?: string;
  creditsUsed?: number;
  status?: "loading" | "completed" | "failed" | string;
  errorMessage?: string;
  referenceImageUrl?: string;
  referenceVideoUrl?: string;
}

interface GeneratedVideoCardProps {
  video?: GeneratedVideoData;
  url?: string;
  prompt?: string;
  coverUrl?: string;
  modelName?: string;
  aspectRatio?: string;
  duration?: string;
  resolution?: string;
  provider?: string;
  creditsUsed?: number;
  status?: "loading" | "completed" | "failed" | string;
  errorMessage?: string;
  referenceImageUrl?: string;
  referenceVideoUrl?: string;
  onRetry?: (prompt: string) => void;
  onUseAsReference?: (videoUrl: string, prompt: string) => void;
  onUseInPrompt?: (videoUrl: string, prompt: string) => void;
  onSendToStudio?: (prompt: string, videoUrl?: string) => void;
  onSendToGenerateVideo?: (prompt: string, videoUrl?: string) => void;
  onNavigateCanvas?: () => void;
}

export const GeneratedVideoCard: React.FC<GeneratedVideoCardProps> = (props) => {
  const videoObj = props.video || {};
  const effectiveUrl = props.url || videoObj.url || "";
  const effectivePrompt = props.prompt || videoObj.prompt || "";
  const effectiveModelName = props.modelName || videoObj.modelName || "MiniMax H3 Turbo Video";
  const effectiveAspectRatio = props.aspectRatio || videoObj.aspectRatio || "9:16";
  const effectiveDuration = props.duration || videoObj.duration || "15s";
  const effectiveResolution = props.resolution || videoObj.resolution || "768p";
  const effectiveStatus = props.status || videoObj.status || "completed";
  const effectiveErrorMessage = props.errorMessage || videoObj.errorMessage;

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [useProxy, setUseProxy] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const providerInfo = resolveVideoProvider(props.provider || videoObj.provider, effectiveModelName);
  const providerLabel = providerInfo.name;
  const providerSlug = providerInfo.id;

  const finalVideoSrc = effectiveUrl && effectiveUrl.trim()
    ? useProxy
      ? `/api/proxy-video?url=${encodeURIComponent(effectiveUrl)}`
      : effectiveUrl
    : "";

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleCopyPrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(effectivePrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!effectiveUrl) return;
    const filename = `${providerSlug}_video_${Date.now()}.mp4`;
    downloadMediaFile(effectiveUrl, filename);
  };

  const getAspectClass = () => {
    if (effectiveAspectRatio === "9:16") {
      return "w-[260px] sm:w-[280px] aspect-[9/16] max-h-[480px]";
    }
    if (effectiveAspectRatio === "16:9") {
      return "w-[320px] sm:w-[420px] aspect-[16/9] max-h-[280px]";
    }
    if (effectiveAspectRatio === "4:3") {
      return "w-[280px] sm:w-[340px] aspect-[4/3] max-h-[300px]";
    }
    if (effectiveAspectRatio === "3:4") {
      return "w-[260px] sm:w-[280px] aspect-[3/4] max-h-[380px]";
    }
    return "w-[260px] sm:w-[300px] aspect-square max-h-[320px]";
  };

  if (effectiveStatus === "failed") {
    const providerName = resolveVideoProvider(props.provider || videoObj.provider, effectiveModelName).name;

    return (
      <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 space-y-3 max-w-md my-2 shadow-sm">
        <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
          <RotateCcw className="w-4 h-4 shrink-0" />
          <span>Gagal Membuat Video ({providerName})</span>
        </div>
        <p className="text-xs text-rose-300 leading-relaxed">
          {effectiveErrorMessage ||
            `Terjadi kesalahan saat memproses pembuatan video pada provider ${providerName}.`}
        </p>
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {props.onRetry && effectivePrompt && (
            <button
              type="button"
              onClick={() => props.onRetry?.(effectivePrompt)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Coba Lagi</span>
            </button>
          )}
          {props.onSendToGenerateVideo && effectivePrompt && (
            <button
              type="button"
              onClick={() => props.onSendToGenerateVideo?.(effectivePrompt, effectiveUrl)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium cursor-pointer transition-all border border-white/10"
            >
              <span>Ganti Model Video</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!effectiveUrl) return null;

  return (
    <>
      <div className="chat-keep-dark my-2 space-y-2 max-w-full">
        {/* Main Video Container */}
        <div
          className={`relative rounded-2xl overflow-hidden border border-stone-300/80 dark:border-white/10 bg-black shadow-xl group select-none ${getAspectClass()}`}
          onClick={togglePlay}
        >
          {/* HTML5 Video */}
          <video
            ref={videoRef}
            src={finalVideoSrc}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            className="w-full h-full object-cover cursor-pointer"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={() => {
              if (!useProxy && effectiveUrl && effectiveUrl.startsWith('http')) {
                console.warn('[GeneratedVideoCard] Video play error, trying proxy...');
                setUseProxy(true);
              }
            }}
          />

          {/* Top Badges Overlay */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-semibold text-amber-400 shadow-md">
              {providerInfo.id === "gemini" ? (
                <Sparkles className="w-3 h-3 text-sky-400" />
              ) : (
                <Flame className="w-3 h-3 text-amber-400" />
              )}
              <span>{providerLabel}</span>
              <span className="text-white/60 font-mono">({effectiveDuration})</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white/80 hover:text-white hover:bg-black/80 pointer-events-auto transition-colors cursor-pointer"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsModalOpen(true);
                }}
                className="p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white/80 hover:text-white hover:bg-black/80 pointer-events-auto transition-colors cursor-pointer"
                title="Fullscreen Preview"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Center Play/Pause Indicator (Shows when paused) */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-2xs transition-opacity z-10">
              <div className="w-12 h-12 rounded-full bg-amber-500/90 text-stone-950 flex items-center justify-center shadow-xl pl-0.5">
                <Play className="w-6 h-6 fill-current" />
              </div>
            </div>
          )}

          {/* Bottom Hover Action Bar */}
          <div className="absolute bottom-0 inset-x-0 p-2.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between opacity-95 group-hover:opacity-100 transition-opacity z-10">
            <span className="text-[10px] font-mono text-stone-300 truncate max-w-[130px]" title={effectiveModelName}>
              {effectiveModelName}
            </span>

            <div className="flex items-center gap-1.5">
              {(props.onUseInPrompt || props.onUseAsReference) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (props.onUseInPrompt) {
                      props.onUseInPrompt(effectiveUrl, effectivePrompt);
                    } else if (props.onUseAsReference) {
                      props.onUseAsReference(effectiveUrl, effectivePrompt);
                    }
                  }}
                  className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  title="Gunakan video ini sebagai referensi di prompt chat"
                >
                  <Undo2 className="w-3 h-3 text-amber-400" />
                  <span>Gunakan</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopyPrompt}
                className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                title="Salin Prompt"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Disalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Prompt</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                title="Unduh MP4"
              >
                <Download className="w-3 h-3" />
                <span>Unduh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Fullscreen Preview */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={finalVideoSrc}
              autoPlay
              controls
              loop
              playsInline
              className="max-h-[80vh] max-w-full rounded-2xl shadow-2xl border border-white/15 object-contain"
            />

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Unduh MP4</span>
              </button>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};