import React, { useState } from 'react';
import { Download, Maximize2, Undo2, Check } from 'lucide-react';

interface RepostMediaCardProps {
  media: {
    url: string;
    index?: number;
    caption?: string;
    prompt?: string;
  };
  onUseAsReference: (url: string, promptText?: string) => void;
  onOpenPreview: (url: string) => void;
}

export const RepostMediaCard: React.FC<RepostMediaCardProps> = ({
  media,
  onUseAsReference,
  onOpenPreview,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!media.url) return;
    setDownloading(true);
    try {
      const resp = await fetch(media.url);
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      const cleanIndex = media.index ? `_ke_${media.index}` : '';
      a.download = `weavy_gambar${cleanIndex}_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } catch {
      window.open(media.url, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="relative inline-block max-w-full rounded-2xl border border-stone-300/80 dark:border-white/10 bg-black/40 overflow-hidden shadow-2xl group select-none mt-2">
      {/* Image Display with Clean Auto Fit */}
      <div
        onClick={() => onOpenPreview(media.url)}
        className="relative overflow-hidden cursor-pointer flex items-center justify-center"
      >
        <img
          src={media.url}
          alt={media.caption || 'Gambar sesi'}
          className="block max-w-full max-h-[75vh] w-auto h-auto object-contain transition-transform duration-300 group-hover:scale-[1.01] cursor-grab active:cursor-grabbing"
          loading="lazy"
          crossOrigin="anonymous"
          draggable={true}
          onDragStart={(e) => {
            e.dataTransfer.setData("application/x-amb-image-url", media.url);
            e.dataTransfer.setData("text/uri-list", media.url);
            e.dataTransfer.setData("text/plain", media.url);
          }}
        />

        {/* Floating Quick Action Overlay on hover / touch */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
          {/* Gunakan Button */}
          <div className="relative group/btn">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUseAsReference(media.url, media.prompt);
              }}
              title="Gunakan"
              className="p-2 rounded-xl bg-black/75 hover:bg-black/90 backdrop-blur-md text-amber-400 hover:text-amber-300 border border-white/20 shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
            >
              <Undo2 className="w-4 h-4 text-amber-400" />
            </button>
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-white text-stone-900 text-[11px] font-medium rounded shadow-md pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap z-30">
              Gunakan
            </div>
          </div>

          {/* Zoom Button */}
          <div className="relative group/btn">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPreview(media.url);
              }}
              title="Perbesar gambar"
              className="p-2 rounded-xl bg-black/75 hover:bg-black/90 backdrop-blur-md text-white border border-white/20 shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
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
              onClick={handleDownload}
              disabled={downloading}
              title="Unduh gambar"
              className="p-2 rounded-xl bg-black/75 hover:bg-black/90 backdrop-blur-md text-emerald-400 hover:text-emerald-300 border border-white/20 shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
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
};
