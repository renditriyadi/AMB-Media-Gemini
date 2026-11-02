import React, { useState } from 'react';
import { ShoppingBag, ExternalLink, Sparkles, Copy, Check, ChevronRight, Layers, Tag } from 'lucide-react';

interface ExtractedProduct {
  title: string;
  author_name?: string;
  author_url?: string;
  url: string;
  platform?: string;
  thumbnail_url?: string;
  description?: string;
  price?: string;
  usps?: string[];
  images?: Array<{ url: string; title?: string; role?: string }>;
}

interface ChatProductCardProps {
  products: ExtractedProduct[];
  onUseInPrompt?: (text: string) => void;
  onOpenPreview?: (url: string, title?: string) => void;
  onNavigateCanvas?: (promptText?: string, imageUrl?: string) => void;
  onNavigateGenerate?: (promptText?: string) => void;
  onNavigateStudio?: (project?: any) => void;
}

export const ChatProductCard: React.FC<ChatProductCardProps> = ({
  products,
  onUseInPrompt,
  onOpenPreview,
  onNavigateCanvas,
  onNavigateGenerate,
  onNavigateStudio,
}) => {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  if (!products || products.length === 0) return null;

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="space-y-3 w-full my-2">
      {products.map((prod, idx) => {
        const hasGallery = Array.isArray(prod.images) && prod.images.length > 0;
        const mainImage = prod.thumbnail_url || (hasGallery ? prod.images![0]?.url : '');
        const allImages = hasGallery
          ? prod.images!
          : mainImage
          ? [{ url: mainImage, title: 'Foto Utama Produk', role: 'main_product' }]
          : [];

        const isTikTok =
          /tiktok/i.test(prod.platform || '') || /tiktok\.com|vt\.tokopedia/i.test(prod.url);

        return (
          <div
            key={`${prod.url}_${idx}`}
            className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-stone-900/60 to-stone-950/80 p-4 shadow-xl backdrop-blur-md transition-all hover:border-amber-500/50"
          >
            {/* Header Badge & Platform */}
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <ShoppingBag className="w-3 h-3 text-amber-400" />
                  {isTikTok ? 'TikTok Shop Keranjang Kuning' : prod.platform || 'E-Commerce'}
                </span>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  ⚡ Diekstrak Otomatis oleh AI Worker
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleCopyLink(prod.url)}
                className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-amber-300 transition-colors px-2 py-1 rounded-lg hover:bg-stone-800/60"
                title="Salin Tautan Produk"
              >
                {copiedUrl === prod.url ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Link</span>
                  </>
                )}
              </button>
            </div>

            {/* Product Title & Store */}
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-stone-100 line-clamp-2 leading-snug">
                {prod.title || 'Produk Unggulan'}
              </h4>
              <div className="flex items-center gap-2 mt-1 text-xs text-stone-400 flex-wrap">
                {prod.author_name && (
                  <span className="font-medium text-stone-300">
                    Toko/Merchant: <span className="text-amber-300">{prod.author_name}</span>
                  </span>
                )}
                {prod.price && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30">
                    <Tag className="w-3 h-3 text-emerald-400" />
                    {prod.price}
                  </span>
                )}
              </div>
            </div>

            {/* Product Image Gallery (Horizontal Scroll) */}
            {allImages.length > 0 && (
              <div className="my-3">
                <div className="flex items-center justify-between text-[11px] text-stone-400 mb-1.5">
                  <span className="flex items-center gap-1 font-medium text-stone-300">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    Galeri Visual Produk ({allImages.length} Foto Siap AI):
                  </span>
                  <span className="text-[10px] text-stone-500">Klik foto untuk perbesar</span>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-stone-700">
                  {allImages.map((img, imgIdx) => (
                    <div
                      key={`${img.url}_${imgIdx}`}
                      onClick={() => onOpenPreview?.(img.url, img.title || prod.title)}
                      className="group relative shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-stone-700/80 hover:border-amber-400 transition-all cursor-pointer bg-stone-900/90 shadow-md"
                    >
                      <img
                        src={img.url}
                        alt={img.title || `Foto ${imgIdx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <div className="chat-keep-dark absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950 via-stone-950/70 to-transparent p-1">
                        <p className="text-[9px] text-stone-200 truncate text-center font-medium">
                          {img.role === 'main_product' || imgIdx === 0 ? 'Foto Utama' : `Slide ${imgIdx + 1}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* USPs Pill List */}
            {prod.usps && prod.usps.length > 0 && (
              <div className="flex flex-wrap gap-1.5 my-2.5">
                {prod.usps.slice(0, 4).map((usp, uIdx) => (
                  <span
                    key={uIdx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-800/80 text-stone-300 border border-stone-700/60"
                  >
                    <Check className="w-2.5 h-2.5 text-amber-400" />
                    {usp}
                  </span>
                ))}
              </div>
            )}

            {/* Description Excerpt */}
            {prod.description && prod.description !== prod.title && (
              <p className="text-[11px] text-stone-400 line-clamp-2 my-2 leading-relaxed bg-stone-900/40 p-2 rounded-lg border border-stone-800/60">
                "{prod.description}"
              </p>
            )}

            {/* Quick Action Buttons */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-800/80 mt-2">
              <a
                href={prod.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-200 transition-colors"
              >
                <span>Buka di {isTikTok ? 'TikTok' : 'Toko'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <div className="flex items-center gap-1.5 flex-wrap">
                {onUseInPrompt && (
                  <button
                    type="button"
                    onClick={() => {
                      const promptText = `Tolong analisis produk "${prod.title}" ${prod.price ? `seharga ${prod.price}` : ''} ini, lalu rancang konsep video promosi TikTok Shop yang menarik dan siap checkout keranjang kuning!`;
                      onUseInPrompt(promptText);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-colors shadow-xs cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Analisis dengan AI</span>
                  </button>
                )}

                {onNavigateCanvas && (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateCanvas(
                        `Iklan Komersial TikTok Shop: ${prod.title}`,
                        mainImage
                      );
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition-colors cursor-pointer"
                    title="Bawa produk ini ke Canvas Visual Workflow"
                  >
                    <span>Ke Canvas</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}

                {onNavigateStudio && (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateStudio({
                        title: `Iklan: ${prod.title}`,
                        productName: prod.title,
                        productDesc: prod.description || prod.title,
                        scenes: [],
                      });
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/30 transition-colors cursor-pointer"
                    title="Buka produk ini di Studio Storyboard"
                  >
                    <span>Ke Studio</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
export default ChatProductCard;