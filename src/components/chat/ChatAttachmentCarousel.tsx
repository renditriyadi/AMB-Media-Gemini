import React, { useState } from "react";
import {
  Maximize2,
  Download,
  Pencil,
  Undo2,
  FileText,
  ImageIcon,
  Video as VideoIcon,
} from "lucide-react";
import { ChatAttachment } from "../../types";
import { downloadMediaFile } from "../../utils";

interface ChatAttachmentCarouselProps {
  attachments: ChatAttachment[];
  isUser: boolean;
  onOpenPreview: (url: string) => void;
  onOpenMarkup: (url: string, name?: string) => void;
  onUseInPrompt: (url: string) => void;
  onSendToGenerateVideo?: (url: string) => void;
}

export const ChatAttachmentCarousel: React.FC<ChatAttachmentCarouselProps> = ({
  attachments,
  isUser,
  onOpenPreview,
  onOpenMarkup,
  onUseInPrompt,
  onSendToGenerateVideo,
}) => {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

  const validAttachments = attachments.filter((att) => {
    // Only image or non-video attachments are rendered in the image carousel
    if (att.type === "video") return false;
    if (att.playbackUrl) return false;
    if (att.name && att.name.match(/\.(mp4|webm|mov|mkv|m4v)$/i)) return false;
    const src = (att.url && att.url.trim()) || (att.base64 && att.base64.trim()) || "";
    return src && !failedUrls.has(src);
  });

  if (validAttachments.length === 0 && attachments.length > 0) {
    return null;
  }

  const handleImageError = (src: string) => {
    setFailedUrls((prev) => {
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  };

  return (
    <div className="space-y-1.5 w-full">
      {!isUser && (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-500/90 dark:text-amber-400/90 px-0.5">
          <ImageIcon className="w-3.5 h-3.5" />
          <span>
            {validAttachments.length === 1
              ? "Gambar Hasil / Terlampir:"
              : `${validAttachments.length} Gambar Hasil / Terlampir:`}
          </span>
        </div>
      )}

      {/* Grid tampilan langsung semua gambar tanpa slider */}
      <div className={`flex flex-wrap gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
        {validAttachments.map((att, idx) => {
          const imageSrc = (att.url && att.url.trim()) || (att.base64 && att.base64.trim()) || "";

          if (!imageSrc) {
            return (
              <div
                key={att.id || idx}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-white/15 text-xs text-stone-300 bg-black/20"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                <span className="truncate max-w-[150px]">{att.name}</span>
              </div>
            );
          }

          return (
            <div
              key={att.id || idx}
              draggable={true}
              onDragStart={(e) => {
                e.dataTransfer.setData("application/x-amb-image-url", imageSrc);
                e.dataTransfer.setData("text/uri-list", imageSrc);
                e.dataTransfer.setData("text/plain", imageSrc);
              }}
              className={`relative group rounded-xl overflow-hidden border cursor-grab active:cursor-grabbing shadow-md select-none transition-all flex-shrink-0 ${
                isUser
                  ? "w-14 h-14 sm:w-16 sm:h-16 border-amber-500/40 bg-black/50 hover:border-amber-400"
                  : "w-36 sm:w-44 h-36 sm:h-44 border-stone-300/80 dark:border-white/15 bg-black/40 hover:border-amber-500/50 hover:shadow-lg"
              }`}
            >
              <img
                src={imageSrc}
                alt={att.name || `Foto ${idx + 1}`}
                onError={() => handleImageError(imageSrc)}
                className="w-full h-full object-cover bg-black/20 transition-transform duration-300 group-hover:scale-105 pointer-events-none"
                draggable={false}
              />

              {/* Badge nomor foto (@img1 untuk user, #1 untuk asisten) */}
              {isUser ? (
                <div className="absolute bottom-1 left-1 z-10 pointer-events-none">
                  <span className="px-1.5 py-0.2 rounded bg-blue-600/90 text-[9px] font-mono text-white font-bold shadow border border-blue-400/40">
                    @img{idx + 1}
                  </span>
                </div>
              ) : (
                <div className="absolute top-2 left-2 z-10 pointer-events-none">
                  <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-mono text-amber-300 border border-white/20 font-bold shadow">
                    #{idx + 1}
                  </span>
                </div>
              )}

              {/* Action buttons on hover */}
              <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white pointer-events-none z-20">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenPreview(imageSrc);
                  }}
                  className="p-1.5 rounded-xl bg-black/70 hover:bg-black/90 text-white border border-white/20 transition-transform active:scale-95 pointer-events-auto cursor-pointer"
                  title="Perbesar"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadMediaFile(imageSrc, att.name || `photo_${idx + 1}.jpg`);
                  }}
                  className="p-1.5 rounded-xl bg-black/70 hover:bg-black/90 text-white border border-white/20 transition-transform active:scale-95 pointer-events-auto cursor-pointer"
                  title="Unduh gambar"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenMarkup(imageSrc, att.name);
                  }}
                  className="p-1.5 rounded-xl bg-black/70 hover:bg-black/90 text-amber-400 border border-white/20 transition-transform active:scale-95 pointer-events-auto cursor-pointer"
                  title="Coret / Beri tanda visual"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUseInPrompt(imageSrc);
                  }}
                  className="p-1.5 rounded-xl bg-black/70 hover:bg-black/90 text-amber-400 border border-white/20 transition-transform active:scale-95 pointer-events-auto cursor-pointer"
                  title="Gunakan lagi di kolom chat"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                {onSendToGenerateVideo && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSendToGenerateVideo(imageSrc);
                    }}
                    className="p-1.5 rounded-xl bg-black/70 hover:bg-black/90 text-amber-400 border border-white/20 transition-transform active:scale-95 pointer-events-auto cursor-pointer"
                    title="Jadikan Video (Kirim ke Generator)"
                  >
                    <VideoIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
