import React, { useState } from 'react';
import { Lightbulb, Target, CheckCircle2, Megaphone, Flame, ShieldCheck, Music, User, Copy, Check, ChevronDown, ChevronUp, Link as LinkIcon, ExternalLink, Cpu, Sparkles } from 'lucide-react';
import { StudioAnalysis, StudioVideoMetadata } from '../../types/studio';
import { STUDIO_AI_MODELS } from './StudioVideoIngestCard';

interface Props {
  analysis?: StudioAnalysis;
  metadata?: StudioVideoMetadata;
  aiModel?: string;
}

export const StudioAnalysisCard: React.FC<Props> = ({ analysis, metadata, aiModel }) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  if (!analysis) return null;

  const getModelDisplayName = (modelId?: string) => {
    if (!modelId) return null;
    const found = STUDIO_AI_MODELS.find((m) => m.value === modelId);
    if (found) return found.label.split(' (')[0];
    if (modelId.includes('/')) return modelId.split('/')[1];
    return modelId;
  };

  const modelDisplayName = getModelDisplayName(aiModel);

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Helper to format clean audio or clean link string without overflowing
  const formatAudioDisplay = (rawAudio?: string) => {
    if (!rawAudio) return null;
    if (rawAudio.startsWith('http://') || rawAudio.startsWith('https://') || rawAudio.length > 35) {
      return 'Audio TikTok Original';
    }
    return rawAudio;
  };

  const cleanAudio = formatAudioDisplay(metadata?.audioName);

  return (
    <div className="bg-[#FAF9F6] dark:bg-[#141418] border border-stone-300 dark:border-white/10 rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm transition-colors duration-200 overflow-hidden">
      <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-stone-200 dark:border-white/10 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 truncate font-serif-display">
                Hasil Analisis Strategi Konten Video
              </h3>
              <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                AI Marketing Breakdown
              </span>
              {modelDisplayName && (
                <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-amber-500" />
                  Model: {modelDisplayName}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 truncate font-sans-body">
              Hook visual, keunggulan produk (USP), pembuktian (proof), dan arahan CTA
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-[#1B1B22] hover:bg-stone-200 dark:hover:bg-[#22222B] text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white border border-stone-300 dark:border-white/10 text-xs font-medium flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tutup</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lihat Detail</span>
            </>
          )}
        </button>
      </div>

      {/* Video Source Quick Meta with strictly truncated labels */}
      {metadata && (
        <div className="mt-3.5 flex flex-wrap items-center gap-2 sm:gap-3 py-2 px-3 rounded-xl bg-stone-100 dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 text-xs text-stone-700 dark:text-stone-300 max-w-full overflow-hidden">
          <span className="font-semibold text-stone-900 dark:text-stone-200 truncate max-w-[200px] sm:max-w-xs md:max-w-sm flex items-center gap-1.5" title={metadata.title}>
            <span>🎬</span>
            <span className="truncate">{metadata.title || 'Video Konten'}</span>
          </span>

          {metadata.author && (
            <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1 truncate max-w-[140px] sm:max-w-[180px]" title={metadata.author}>
              <User className="w-3 h-3 text-amber-500 dark:text-amber-400 shrink-0" />
              <span className="truncate">{metadata.author}</span>
            </span>
          )}

          {cleanAudio && (
            <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1 truncate max-w-[150px] sm:max-w-[200px]" title={metadata.audioName}>
              <Music className="w-3 h-3 text-amber-500 dark:text-amber-400 shrink-0" />
              <span className="truncate">{cleanAudio}</span>
            </span>
          )}

          {metadata.url && (
            <a
              href={metadata.url}
              target="_blank"
              rel="noreferrer"
              className="text-amber-600 dark:text-amber-400 hover:text-amber-500 ml-auto flex items-center gap-1 text-[11px] font-medium hover:underline shrink-0"
              title={metadata.url}
            >
              <LinkIcon className="w-3 h-3" />
              <span>Buka Sumber</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      )}

      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-4">
          {/* Hook Analysis */}
          <div className="bg-stone-100/70 dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 rounded-xl p-3.5 sm:p-4 relative group hover:border-stone-400 dark:hover:border-white/20 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-500 dark:text-orange-400 shrink-0" />
                Analisis Hook 3 Detik Pertama
              </span>
              <button
                type="button"
                onClick={() => handleCopy(analysis.hookAnalysis, 'hook')}
                className="text-stone-400 hover:text-stone-900 dark:hover:text-white p-1 rounded hover:bg-stone-200/80 dark:hover:bg-[#141418] transition-colors cursor-pointer"
                title="Salin Analisis Hook"
              >
                {copiedSection === 'hook' ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed break-words">
              {analysis.hookAnalysis}
            </p>
          </div>

          {/* Target Audience & Topic */}
          <div className="bg-stone-100/70 dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 rounded-xl p-3.5 sm:p-4 relative group hover:border-stone-400 dark:hover:border-white/20 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0" />
                Target Audiens & Produk
              </span>
              <button
                type="button"
                onClick={() => handleCopy(`${analysis.productOrTopicName}\nTarget: ${analysis.targetAudience}`, 'audience')}
                className="text-stone-400 hover:text-stone-900 dark:hover:text-white p-1 rounded hover:bg-stone-200/80 dark:hover:bg-[#141418] transition-colors cursor-pointer"
                title="Salin Target Audiens"
              >
                {copiedSection === 'audience' ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="text-xs space-y-1 text-stone-700 dark:text-stone-300 break-words">
              <p><strong className="text-stone-900 dark:text-stone-100">Produk:</strong> {analysis.productOrTopicName}</p>
              <p><strong className="text-stone-900 dark:text-stone-100">Audiens:</strong> {analysis.targetAudience}</p>
            </div>
          </div>

          {/* Core USPs */}
          <div className="bg-stone-100/70 dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 rounded-xl p-3.5 sm:p-4 relative group hover:border-stone-400 dark:hover:border-white/20 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                Keunggulan Utama (USPs)
              </span>
              <button
                type="button"
                onClick={() => handleCopy(analysis.coreUSPs.join('\n- '), 'usps')}
                className="text-stone-400 hover:text-stone-900 dark:hover:text-white p-1 rounded hover:bg-stone-200/80 dark:hover:bg-[#141418] transition-colors cursor-pointer"
                title="Salin USPs"
              >
                {copiedSection === 'usps' ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <ul className="text-xs text-stone-700 dark:text-stone-300 space-y-1.5 list-none">
              {analysis.coreUSPs.map((usp, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">•</span>
                  <span className="break-words">{usp}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Proof Strategy & CTA */}
          <div className="bg-stone-100/70 dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 rounded-xl p-3.5 sm:p-4 relative group space-y-3 hover:border-stone-400 dark:hover:border-white/20 transition-colors">
            <div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 mb-1">
                <ShieldCheck className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                Strategi Pembuktian Visual (Proof)
              </span>
              <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed break-words">
                {analysis.visualProofStrategy}
              </p>
            </div>
            <div className="pt-2 border-t border-stone-200 dark:border-white/10">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mb-1">
                <Megaphone className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                Arahan Call to Action (CTA)
              </span>
              <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed break-words">
                {analysis.callToActionAnalysis}
              </p>
            </div>
          </div>

          {/* Frame Observations & Pipeline Telemetry if present */}
          {analysis.frameObservations && analysis.frameObservations.length > 0 && (
            <div className="md:col-span-2 bg-stone-100/70 dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 rounded-xl p-3.5 sm:p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Inspeksi Visual Per-Frame (VLM & Temporal Aggregator)</span>
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  {analysis.frameObservations.length} Frame Teranalisis
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
                {analysis.frameObservations.map((f, idx) => (
                  <div key={idx} className="bg-white dark:bg-[#141418] border border-stone-200 dark:border-white/10 rounded-lg p-2.5 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-stone-900 dark:text-stone-200 font-semibold pb-1 border-b border-stone-100 dark:border-white/5">
                      <span>Frame #{f.frameIndex}</span>
                      <span className="text-amber-600 dark:text-amber-400 font-mono text-[10px]">{f.timestamp}</span>
                    </div>
                    <p className="text-stone-700 dark:text-stone-300 line-clamp-2" title={f.subject}>
                      <strong className="text-stone-900 dark:text-stone-100">Subjek:</strong> {f.subject}
                    </p>
                    <p className="text-stone-600 dark:text-stone-400 truncate" title={f.action}>
                      <strong>Aksi:</strong> {f.action}
                    </p>
                    <p className="text-stone-600 dark:text-stone-400 truncate" title={`${f.camera} • ${f.lighting}`}>
                      <strong>Kamera:</strong> {f.camera} ({f.lighting})
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI VLM Input Images Analysis */}
          {(analysis.productImageAnalysis || analysis.modelImageAnalysis || analysis.backgroundImageAnalysis) && (
            <div className="md:col-span-2 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 sm:p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Hasil Analisis AI pada Gambar Input (Image-to-Image Visual Consistency)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {analysis.productImageAnalysis && (
                  <div className="bg-white/70 dark:bg-[#141418] border border-amber-500/20 rounded-lg p-2.5 space-y-1">
                    <span className="font-bold text-amber-800 dark:text-amber-200 block">📦 Analisis Gambar Produk:</span>
                    <p className="text-stone-700 dark:text-stone-300 leading-relaxed text-[11px]">{analysis.productImageAnalysis}</p>
                  </div>
                )}
                {analysis.modelImageAnalysis && (
                  <div className="bg-white/70 dark:bg-[#141418] border border-amber-500/20 rounded-lg p-2.5 space-y-1">
                    <span className="font-bold text-amber-800 dark:text-amber-200 block">👤 Analisis Gambar Model:</span>
                    <p className="text-stone-700 dark:text-stone-300 leading-relaxed text-[11px]">{analysis.modelImageAnalysis}</p>
                  </div>
                )}
                {analysis.backgroundImageAnalysis && (
                  <div className="bg-white/70 dark:bg-[#141418] border border-amber-500/20 rounded-lg p-2.5 space-y-1">
                    <span className="font-bold text-amber-800 dark:text-amber-200 block">🖼️ Analisis Gambar Background:</span>
                    <p className="text-stone-700 dark:text-stone-300 leading-relaxed text-[11px]">{analysis.backgroundImageAnalysis}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transcript / Content Summary if present */}
          {(analysis.contentSummary || analysis.transcript) && (
            <div className="md:col-span-2 bg-stone-100/70 dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 rounded-xl p-3.5 sm:p-4 space-y-2">
              {analysis.contentSummary && (
                <div>
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5 mb-1">
                    <span>📝</span>
                    <span>Ringkasan Konten:</span>
                  </span>
                  <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                    {analysis.contentSummary}
                  </p>
                </div>
              )}
              {analysis.transcript && (
                <div className="pt-2 border-t border-stone-200 dark:border-white/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                      <span>🎙️</span>
                      <span>Transkrip Audio / VO:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(analysis.transcript!, 'transcript')}
                      className="text-stone-400 hover:text-stone-900 dark:hover:text-white p-1 rounded hover:bg-stone-200/80 dark:hover:bg-[#141418] transition-colors cursor-pointer"
                      title="Salin Transkrip"
                    >
                      {copiedSection === 'transcript' ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-xs italic text-stone-700 dark:text-stone-300 leading-relaxed font-sans">
                    "{analysis.transcript}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ATM Next Step Banner */}
          <div className="md:col-span-2 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/30 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-black flex items-center justify-center font-extrabold text-xs shrink-0 shadow-xs">
                ATM
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Formula ATM: Amati, Tiru & Modifikasi</span>
                </p>
                <p className="text-[11px] text-stone-600 dark:text-stone-300 truncate">
                  Ingin durasi baru & ganti karakter? Gunakan panel <strong>ATM Remix</strong> di bawah untuk merancang versi superior!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
