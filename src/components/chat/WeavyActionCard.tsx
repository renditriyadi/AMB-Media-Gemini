import React, { useState } from "react";
import {
  Sparkles,
  Maximize2,
  Download,
  Check,
  RotateCcw,
  Undo2,
  AlertCircle,
  Pencil,
  Copy,
  Film,
  ArrowRight,
} from "lucide-react";
import { WEAVY_IMAGE_MODELS } from "../../types/canvas";
import { ImageGenerationSpinner } from "./ImageGenerationSpinner";

export interface WeavyActionData {
  prompt: string;
  model: string;
  aspectRatio: string;
  useReference?: boolean;
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  reason?: string;
  status: "suggested" | "loading" | "completed" | "failed";
  resultUrl?: string;
  errorMessage?: string;
  creditsUsed?: number;
  isVideoPrompt?: boolean;
}

interface WeavyActionCardProps {
  action: WeavyActionData;
  onExecute: (action: WeavyActionData) => void;
  onUseInPrompt?: (prompt: string, imageUrl?: string) => void;
  onUseImageAsReference?: (imageUrl: string, promptText?: string) => void;
  onMarkupImage?: (imageUrl: string, prompt?: string) => void;
  onOpenPreview?: (imageUrl: string) => void;
  onSendToGenerateVideo?: (prompt: string) => void;
  onNavigateCanvas?: (promptText?: string, imageUrl?: string) => void;
  isExecuting?: boolean;
}

export const WeavyActionCard: React.FC<WeavyActionCardProps> = ({
  action,
  onExecute,
  onUseInPrompt,
  onUseImageAsReference,
  onMarkupImage,
  onOpenPreview,
  onSendToGenerateVideo,
  onNavigateCanvas,
  isExecuting = false,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Match model meta from official WEAVY_IMAGE_MODELS
  const modelMeta =
    WEAVY_IMAGE_MODELS.find(
      (m) =>
        action?.model &&
        (m.name.toLowerCase() === action.model.toLowerCase() ||
          m.id.toLowerCase().includes(action.model.toLowerCase()) ||
          action.model.toLowerCase().includes(m.name.toLowerCase())),
    ) || WEAVY_IMAGE_MODELS[0];

  const handleDownload = async (url: string) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `weavy_${modelMeta.name.replace(/\s+/g, "_").toLowerCase()}_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } catch {
      window.open(url, "_blank");
    }
  };

  // 1. Loading State - Render clean circular progress spinner directly
  if (action.status === "loading") {
    const refCount = (action.referenceImageUrls && action.referenceImageUrls.length > 0)
      ? action.referenceImageUrls.length
      : (action.referenceImageUrl ? 1 : 0);

    return (
      <div className="w-full">
        <ImageGenerationSpinner
          aspectRatio={action.aspectRatio || "9:16"}
          referenceImages={action.referenceImageUrls}
          referenceCount={refCount}
        />
      </div>
    );
  }

  // 2. Completed State - Clean image card matching Create Image style without any clutter
  if (action.status === "completed" && action.resultUrl) {
    const refCount = (action.referenceImageUrls && action.referenceImageUrls.length > 0)
      ? action.referenceImageUrls.length
      : (action.referenceImageUrl ? 1 : 0);

    return (
      <div
        draggable={true}
        onDragStart={(e) => {
          if (action.resultUrl) {
            e.dataTransfer.setData("application/x-amb-image-url", action.resultUrl);
            e.dataTransfer.setData("text/uri-list", action.resultUrl);
            e.dataTransfer.setData("text/plain", action.resultUrl);
          }
        }}
        className="relative inline-block max-w-full rounded-2xl border border-stone-300/80 dark:border-white/10 bg-black/40 overflow-hidden shadow-2xl group select-none mt-2 cursor-grab active:cursor-grabbing"
      >
        <div
          className="relative overflow-hidden cursor-pointer flex items-center justify-center"
          onClick={() => onOpenPreview && onOpenPreview(action.resultUrl!)}
        >
          <img
            src={action.resultUrl}
            alt={action.prompt || "Hasil Gambar"}
            className="block max-w-full max-h-[75vh] w-auto h-auto object-contain transition-transform duration-300 group-hover:scale-[1.01] cursor-grab active:cursor-grabbing"
            loading="lazy"
            draggable={true}
            onDragStart={(e) => {
              if (action.resultUrl) {
                e.dataTransfer.setData("application/x-amb-image-url", action.resultUrl);
                e.dataTransfer.setData("text/uri-list", action.resultUrl);
                e.dataTransfer.setData("text/plain", action.resultUrl);
              }
            }}
          />

          {/* Aspect Ratio Badge */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none opacity-85 group-hover:opacity-100 transition-opacity">
            {action.aspectRatio && (
              <span className="px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md text-[10px] font-mono text-amber-300 border border-white/15 font-bold shadow-md">
                {action.aspectRatio}
              </span>
            )}
          </div>

          {/* Floating Hover Action Icons (Generate Ulang, Gunakan, Perbesar, Unduh) */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
            {/* Generate Ulang Button */}
            <div className="relative group/btn">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onExecute(action);
                }}
                disabled={isExecuting}
                className="p-2 rounded-xl bg-black/75 hover:bg-black/90 backdrop-blur-md text-stone-300 hover:text-white border border-white/20 shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                title="Generate Ulang"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-white text-stone-900 text-[11px] font-medium rounded shadow-md pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap z-30">
                Generate Ulang
              </div>
            </div>

            {/* Gunakan Button */}
            {(onUseImageAsReference || onUseInPrompt) && (
              <div className="relative group/btn">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onUseImageAsReference && action.resultUrl) {
                      onUseImageAsReference(action.resultUrl, action.prompt);
                    } else if (onUseInPrompt) {
                      onUseInPrompt(action.prompt, action.resultUrl);
                    }
                  }}
                  className="p-2 rounded-xl bg-black/75 hover:bg-black/90 backdrop-blur-md text-amber-400 hover:text-amber-300 border border-white/20 shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                  title="Gunakan"
                >
                  <Undo2 className="w-4 h-4 text-amber-400" />
                </button>
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-white text-stone-900 text-[11px] font-medium rounded shadow-md pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap z-30">
                  Gunakan
                </div>
              </div>
            )}

            {/* Coret / Beri Tanda Button */}
            {onMarkupImage && (
              <div className="relative group/btn">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (action.resultUrl) {
                      onMarkupImage(action.resultUrl, action.prompt);
                    }
                  }}
                  className="p-2 rounded-xl bg-black/75 hover:bg-black/90 backdrop-blur-md text-amber-400 hover:text-amber-300 border border-white/20 shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                  title="Coret / Beri Tanda Visual"
                >
                  <Pencil className="w-4 h-4 text-amber-400" />
                </button>
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-white text-stone-900 text-[11px] font-medium rounded shadow-md pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap z-30">
                  Coret / Tanda Visual
                </div>
              </div>
            )}

            {/* Zoom Button */}
            <div className="relative group/btn">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPreview && onOpenPreview(action.resultUrl!);
                }}
                className="p-2 rounded-xl bg-black/75 hover:bg-black/90 backdrop-blur-md text-white border border-white/20 shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                title="Perbesar gambar"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-white text-stone-900 text-[11px] font-medium rounded shadow-md pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap z-30">
                Perbesar
              </div>
            </div>

            {/* Download Button */}
            <div className="relative group/btn">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(action.resultUrl!);
                }}
                className="p-2 rounded-xl bg-black/75 hover:bg-black/90 backdrop-blur-md text-emerald-400 hover:text-emerald-300 border border-white/20 shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                title="Unduh gambar"
              >
                {downloadSuccess ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-white text-stone-900 text-[11px] font-medium rounded shadow-md pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap z-30">
                Unduh
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Failed State - Clean compact error banner with retry button
  if (action.status === "failed") {
    return (
      <div className="mt-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-200 text-xs flex items-center justify-between gap-3 max-w-md">
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="truncate">
            {action.errorMessage || "Gagal membuat gambar."}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onExecute(action)}
          disabled={isExecuting}
          className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 text-xs font-semibold cursor-pointer shrink-0 transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  // 4. Suggested State - Clean dedicated Prompt Card with 1-click copy & optional trigger
  const handleCopyPrompt = () => {
    if (!action.prompt) return;
    navigator.clipboard.writeText(action.prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const refImages = (action.referenceImageUrls && action.referenceImageUrls.length > 0)
    ? action.referenceImageUrls
    : (action.referenceImageUrl ? [action.referenceImageUrl] : []);

  const isVideo = Boolean(action.isVideoPrompt);

  return (
    <div className="mt-3 w-full max-w-2xl rounded-2xl border border-stone-300/80 dark:border-white/10 bg-white dark:bg-[#121217] shadow-xl overflow-hidden transition-all select-none">
      {/* Header with Title, Badge, and 1-Click Salin Button */}
      <div className="px-3.5 sm:px-4 py-2.5 bg-stone-100/80 dark:bg-white/[0.04] border-b border-stone-200 dark:border-white/8 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`p-1.5 rounded-lg shrink-0 ${
              isVideo
                ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
            }`}
          >
            {isVideo ? <Film className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-xs font-bold text-stone-900 dark:text-white tracking-tight">
              {isVideo ? "Prompt Video" : "Prompt Gambar AI"}
            </span>
            {action.aspectRatio && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                {action.aspectRatio}
              </span>
            )}
            {!isVideo && action.model && (
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-stone-200 dark:bg-white/10 text-stone-700 dark:text-stone-300">
                {action.model}
              </span>
            )}
          </div>
        </div>

        {/* 1-Click Copy Button */}
        <button
          type="button"
          onClick={handleCopyPrompt}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-95 shrink-0 ${
            copiedPrompt
              ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25"
              : "bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md shadow-amber-500/15 hover:shadow-amber-500/25"
          }`}
          title="Salin Prompt ke Clipboard"
        >
          {copiedPrompt ? (
            <>
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Tersalin!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Salin Prompt</span>
            </>
          )}
        </button>
      </div>

      {/* Prompt Body Content */}
      <div className="p-3.5 sm:p-4 space-y-3">
        <div className="rounded-xl bg-stone-50 dark:bg-black/60 border border-stone-200/80 dark:border-white/5 p-3 select-text">
          <p className="text-xs sm:text-[13px] font-mono text-stone-800 dark:text-stone-200 leading-relaxed break-words">
            {action.prompt}
          </p>
        </div>

        {/* Reference Images if any */}
        {action.useReference && refImages.length > 0 && (
          <div className="p-2.5 rounded-xl bg-stone-100/70 dark:bg-white/[0.02] border border-stone-200 dark:border-white/8">
            <div className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1.5 flex items-center gap-1.5">
              <span>Referensi Gambar Obrolan:</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              {refImages.map((url, idx) => (
                <div
                  key={idx}
                  className="relative group/thumb w-12 h-12 rounded-lg overflow-hidden border border-amber-500/40 bg-black/60 shrink-0 cursor-pointer shadow hover:scale-105 transition-all"
                  onClick={() => onOpenPreview && onOpenPreview(url)}
                  title={`Lihat Gambar Acuan #${idx + 1}`}
                >
                  <img
                    src={url}
                    alt={`Referensi #${idx + 1}`}
                    className="w-full h-full object-cover cursor-grab active:cursor-grabbing"
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-amb-image-url", url);
                      e.dataTransfer.setData("text/uri-list", url);
                      e.dataTransfer.setData("text/plain", url);
                    }}
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[9px] text-center text-amber-300 font-bold py-0.5">
                    #{idx + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            {!isVideo ? (
              <button
                type="button"
                onClick={() => onExecute(action)}
                disabled={isExecuting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-white/10 dark:hover:bg-white/15 text-white text-xs font-semibold cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Generate Gambar ({action.model || "Nano Banana Pro"})</span>
              </button>
            ) : onSendToGenerateVideo ? (
              <button
                type="button"
                onClick={() => onSendToGenerateVideo(action.prompt)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer transition-all active:scale-95 shadow-md shadow-purple-600/20"
              >
                <Film className="w-3.5 h-3.5" />
                <span>Pakai di Generator Video</span>
                <ArrowRight className="w-3 h-3 stroke-[2.5]" />
              </button>
            ) : null}

            {onUseInPrompt && (
              <button
                type="button"
                onClick={() => onUseInPrompt(action.prompt)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-200/80 hover:bg-stone-200 dark:bg-white/5 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 text-xs font-medium cursor-pointer transition-all active:scale-95"
              >
                <span>Gunakan di Chat</span>
              </button>
            )}
          </div>

          <span className="text-[11px] text-stone-600 dark:text-stone-300">
            {isVideo
              ? "Salin prompt ini ke generator video (Sora, Kling, Runway, dll.)"
              : "Klik 'Salin Prompt' untuk menyalin teks prompt"}
          </span>
        </div>
      </div>
    </div>
  );
};
