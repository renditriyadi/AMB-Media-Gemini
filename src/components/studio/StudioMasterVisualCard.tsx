import React, { useState, useEffect } from 'react';
import {
  Compass,
  Sparkles,
  Loader2,
  Download,
  RotateCcw,
  Maximize2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Eye,
  Layers,
  Wand2,
  ShieldCheck,
  Film,
  X,
  Play
} from 'lucide-react';
import { StudioProject, StudioImageModel } from '../../types/studio';
import {
  buildMasterProductionSheetPrompt,
  generateOneSheetGridImage,
  collectStudioReferenceImages
} from '../../lib/studioService';
import { downloadMediaFile } from '../../utils';

interface Props {
  project: StudioProject;
  onUpdateProject: (updated: StudioProject) => void;
  onGenerateAllScenes?: () => void;
  onSuccessToast?: (msg: string) => void;
  isDispatchingScenes?: boolean;
}

const WEAVY_IMAGE_MODELS = [
  { id: 'ChatGPT Images 2.0 Edit', name: 'ChatGPT Images 2.0 Edit', cost: 11, desc: 'High Consistency Face & Body Edit (11 CR)' },
  { id: 'GPT Image 2.5', name: 'GPT Image 2.5', cost: 4, desc: 'Ultra Photorealistic 8K (4 CR)' },
  { id: 'Seedream V5.0 Pro Edit', name: 'Seedream V5.0 Pro Edit', cost: 12, desc: 'Maximum Consistency (12 CR)' },
  { id: 'Nano Banana Pro', name: 'Nano Banana Pro', cost: 11, desc: 'Cinematic Lighting (11 CR)' },
  { id: 'Grok Imagine Image', name: 'Grok Imagine Image', cost: 4, desc: 'Fast Dynamic Pose (4 CR)' },
];

export const StudioMasterVisualCard: React.FC<Props> = ({
  project,
  onUpdateProject,
  onGenerateAllScenes,
  onSuccessToast,
  isDispatchingScenes = false,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  
  // Prompt & Model states
  const [prompt, setPrompt] = useState<string>(() =>
    project.masterProductionSheet?.prompt || buildMasterProductionSheetPrompt(project)
  );
  const [isPromptCustomized, setIsPromptCustomized] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [selectedModel, setSelectedModel] = useState<StudioImageModel>(
    (project.masterProductionSheet?.imageModel as StudioImageModel) || project.imageModel || 'GPT Image 2.5'
  );

  // Generation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  // Master sheet image
  const masterImageUrl = project.masterProductionSheet?.imageUrl;
  const isAnchorActive = project.masterProductionSheet?.isUsedAsSceneAnchor !== false;

  // Refresh prompt if project changes and user hasn't edited manually
  useEffect(() => {
    if (!isPromptCustomized && !project.masterProductionSheet?.prompt) {
      setPrompt(buildMasterProductionSheetPrompt(project));
    }
  }, [project.name, project.briefInputs, isPromptCustomized]);

  const handleResetPrompt = () => {
    const fresh = buildMasterProductionSheetPrompt(project);
    setPrompt(fresh);
    setIsPromptCustomized(false);
    if (onSuccessToast) onSuccessToast('Prompt Master dikembalikan ke default');
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
      if (onSuccessToast) onSuccessToast('Prompt Master disalin!');
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleAnchor = () => {
    if (!project.masterProductionSheet) return;
    const nextState = !isAnchorActive;
    const updated: StudioProject = {
      ...project,
      masterProductionSheet: {
        ...project.masterProductionSheet,
        isUsedAsSceneAnchor: nextState,
      },
    };
    onUpdateProject(updated);
    if (onSuccessToast) {
      onSuccessToast(
        nextState
          ? 'Peta Visual Master diaktifkan sebagai acuan utama scene!'
          : 'Peta Visual Master dinonaktifkan sebagai acuan.'
      );
    }
  };

  // Generate Master Visual 16:9 Grid
  const handleGenerateMaster = async () => {
    setIsGenerating(true);
    setGenProgress(10);
    setGenError(null);

    try {
      // Collect initial reference images (Product, Model, Background)
      const initialRefs = collectStudioReferenceImages({
        ...project,
        masterProductionSheet: undefined, // exclude old master if regenerating
      });

      const finalUrl = await generateOneSheetGridImage({
        prompt: prompt.trim(),
        referenceImages: initialRefs,
        modelName: selectedModel,
        aspectRatio: '16:9',
        onProgress: (p) => setGenProgress(p),
      });

      if (!finalUrl) {
        throw new Error('Gagal menerima hasil Peta Visual dari Weavy AI.');
      }

      const updatedProject: StudioProject = {
        ...project,
        masterProductionSheet: {
          imageUrl: finalUrl,
          prompt: prompt.trim(),
          referenceImages: initialRefs,
          imageModel: selectedModel,
          aspectRatio: '16:9',
          generatedAt: new Date().toISOString(),
          isUsedAsSceneAnchor: true,
        },
      };

      onUpdateProject(updatedProject);
      if (onSuccessToast) onSuccessToast('Peta Visual Master (1-Sheet Grid) berhasil digenerate!');
    } catch (err: any) {
      console.error('[Master Visual Board Error]:', err);
      setGenError(err.message || 'Gagal menghasilkan Peta Visual Master. Cek saldo kredit atau koneksi Weavy.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!masterImageUrl) return;
    setIsDownloading(true);
    try {
      const filename = `Master_Visual_Board_${(project.name || 'Produksi').replace(/[^\w\d-_]/g, '_')}`;
      await downloadMediaFile(masterImageUrl, filename, 'image', selectedModel);
      if (onSuccessToast) onSuccessToast('Peta Visual Master berhasil diunduh!');
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(false);
    }
  };

  const pName = project.briefInputs?.productName || project.analysis?.productOrTopicName || 'Produk Utama';
  const mName = project.briefInputs?.modelTalent || project.analysis?.modelTalent || 'Model / Talent';
  const envName = project.briefInputs?.backgroundSetting || project.analysis?.backgroundSetting || 'Latar / Ruangan';
  const keyAction = project.scenes?.[0]?.visualDescription ? 'Aksi & Pembuktian' : 'Aksi Kunci';

  return (
    <div className="bg-[#FAF9F6] dark:bg-[#141418] border border-stone-300 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden transition-all duration-200">
      
      {/* Header Bar */}
      <div className="p-4 sm:p-5 flex items-center justify-between gap-3 border-b border-stone-200 dark:border-white/8 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-stone-950 font-bold shadow-sm">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold font-serif-display text-stone-900 dark:text-stone-100">
                Peta Visual Produksi (Master 1-Sheet Grid)
              </h3>
              {masterImageUrl ? (
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold flex items-center gap-1 ${
                  isAnchorActive
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-stone-300/60 dark:bg-white/10 text-stone-600 dark:text-stone-400'
                }`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{isAnchorActive ? 'Visual Anchor Terkunci (Aktif)' : 'Anchor Nonaktif'}</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold uppercase tracking-wide border border-amber-500/30">
                  Langkah Pra-Produksi
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-sans-body mt-0.5">
              Peta acuan visual (Produk + Model + Tempat + Aksi) yang dikunci sebagai referensi tunggal di semua scene agar karakter & objek 100% konsisten.
            </p>
          </div>
        </div>

        {/* Accordion Toggle */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-xl bg-stone-200/60 dark:bg-white/5 hover:bg-stone-300/80 dark:hover:bg-white/10 text-stone-600 dark:text-stone-300 transition-all cursor-pointer shrink-0"
          title={isOpen ? 'Tutup Panel' : 'Buka Panel'}
        >
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Content Body */}
      {isOpen && (
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* Top 4-Panel Preview Cards / Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-[#1B1B22] border border-stone-300/70 dark:border-white/10 text-xs">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                Panel 1: Produk
              </span>
              <p className="font-semibold text-stone-800 dark:text-stone-200 truncate mt-0.5" title={pName}>
                {pName}
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-[#1B1B22] border border-stone-300/70 dark:border-white/10 text-xs">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                Panel 2: Model / Talent
              </span>
              <p className="font-semibold text-stone-800 dark:text-stone-200 truncate mt-0.5" title={mName}>
                {mName}
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-[#1B1B22] border border-stone-300/70 dark:border-white/10 text-xs">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                Panel 3: Lingkungan / Ruangan
              </span>
              <p className="font-semibold text-stone-800 dark:text-stone-200 truncate mt-0.5" title={envName}>
                {envName}
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-[#1B1B22] border border-stone-300/70 dark:border-white/10 text-xs">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                Panel 4: Aksi Kunci & Bukti
              </span>
              <p className="font-semibold text-stone-800 dark:text-stone-200 truncate mt-0.5" title={keyAction}>
                {keyAction}
              </p>
            </div>
          </div>

          {/* Master Visual Display or Placeholder */}
          {masterImageUrl ? (
            <div className="space-y-3">
              {/* Image Canvas with 4 Panel Markers */}
              <div className="relative rounded-2xl overflow-hidden border border-stone-300 dark:border-white/15 bg-black/80 shadow-md group">
                <img
                  src={masterImageUrl}
                  alt="Peta Visual Master"
                  className="w-full h-auto max-h-[500px] object-contain mx-auto"
                />

                {/* Top Overlay Badge */}
                <div className="absolute top-3 left-3 px-3 py-1 rounded-lg bg-black/70 backdrop-blur-md text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>MASTER VISUAL MAP (16:9 GRID)</span>
                </div>

                {/* Bottom 4-Column Marker Overlay */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-6 grid grid-cols-4 text-center text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-white/90">
                  <span className="border-r border-white/20 px-1">1. PRODUK & TEKSTUR</span>
                  <span className="border-r border-white/20 px-1">2. MODEL / TALENT</span>
                  <span className="border-r border-white/20 px-1">3. RUANGAN / LATAR</span>
                  <span className="px-1">4. AKSI & PEMBUKTIAN</span>
                </div>

                {/* Hover Maximize Button */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setIsZoomOpen(true)}
                    className="p-2 rounded-xl bg-black/70 hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-md cursor-pointer shadow"
                  >
                    <Maximize2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Perbesar</span>
                  </button>
                </div>
              </div>

              {/* Action Bar Below Generated Master Image */}
              <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                
                {/* Left: Anchor Lock Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleAnchor}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
                      isAnchorActive
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30'
                        : 'bg-stone-200 dark:bg-white/5 border-stone-300 dark:border-white/10 text-stone-500'
                    }`}
                  >
                    <ShieldCheck className={`w-4 h-4 ${isAnchorActive ? 'text-emerald-500' : 'text-stone-400'}`} />
                    <span>{isAnchorActive ? 'Kunci Peta ke Storyboard: AKTIF' : 'Kunci Peta ke Storyboard: NONAKTIF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="px-3.5 py-2 rounded-xl bg-stone-200/80 dark:bg-white/10 hover:bg-stone-300 dark:hover:bg-white/15 text-stone-800 dark:text-stone-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    <span>Download HD</span>
                  </button>
                </div>

                {/* Right: Regenerate & Proceed to Scenes */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateMaster}
                    disabled={isGenerating}
                    className="px-3.5 py-2 rounded-xl bg-stone-200/80 dark:bg-white/10 hover:bg-stone-300 dark:hover:bg-white/15 text-stone-800 dark:text-stone-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>Generate Ulang Peta</span>
                  </button>

                  {onGenerateAllScenes && project.scenes.length > 0 && (
                    <button
                      type="button"
                      onClick={onGenerateAllScenes}
                      disabled={isDispatchingScenes}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 text-xs font-extrabold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isDispatchingScenes ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                      <span>Lanjut Generate Semua Scene Storyboard</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Pre-Generation State */
            <div className="p-5 sm:p-6 rounded-2xl bg-stone-100/70 dark:bg-[#1B1B22]/70 border border-dashed border-stone-300 dark:border-white/15 text-center space-y-4">
              
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                <Wand2 className="w-6 h-6" />
              </div>

              <div className="max-w-xl mx-auto space-y-1">
                <h4 className="text-sm font-bold text-stone-800 dark:text-stone-200">
                  Bangun Peta Visual Master Sebelum Mulai Storyboard
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                  AI akan merender lembar komposit 16:9 yang memuat detail produk, model asli, dan lingkungan secara presisi. Begitu peta ini selesai, setiap scene storyboard otomatis mengunci peta ini sebagai acuan sehingga tidak ada halusinasi objek.
                </p>
              </div>

              {/* Action Buttons & Engine Selector */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 max-w-lg mx-auto">
                {/* Model Engine Selector */}
                <div className="w-full sm:w-auto">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value as StudioImageModel)}
                    className="w-full py-2.5 px-3 rounded-xl bg-stone-200 dark:bg-[#25252F] border border-stone-300 dark:border-white/10 text-xs font-semibold text-stone-800 dark:text-stone-200 focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    {WEAVY_IMAGE_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.cost} CR)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Generate Master Button */}
                <button
                  type="button"
                  onClick={handleGenerateMaster}
                  disabled={isGenerating}
                  className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-stone-950" />
                      <span>Merender Peta Visual Master ({genProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Buat Peta Visual Master (1-Sheet Grid)</span>
                    </>
                  )}
                </button>
              </div>

              {genError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-center gap-2 max-w-md mx-auto">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{genError}</span>
                </div>
              )}
            </div>
          )}

          {/* Collapsible Prompt Master Section */}
          <div className="pt-2 border-t border-stone-200 dark:border-white/8">
            <button
              type="button"
              onClick={() => setIsPromptOpen(!isPromptOpen)}
              className="text-xs font-bold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              <span>{isPromptOpen ? 'Sembunyikan Prompt Peta Visual' : 'Lihat & Edit Prompt Peta Visual Master'}</span>
              {isPromptOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {isPromptOpen && (
              <div className="mt-2.5 p-3 rounded-xl bg-stone-100 dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                    Prompt Master (16:9 Contact Sheet)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      className="text-[11px] text-stone-500 hover:text-stone-800 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedPrompt ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPrompt ? 'Tersalin' : 'Salin'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetPrompt}
                      className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>

                <textarea
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    setIsPromptCustomized(true);
                  }}
                  rows={4}
                  className="w-full p-2.5 rounded-lg bg-stone-200/60 dark:bg-black/40 border border-stone-300 dark:border-white/10 text-xs font-mono text-stone-800 dark:text-stone-200 leading-relaxed focus:outline-none focus:ring-1 focus:ring-amber-500 resize-y"
                  placeholder="Susun prompt peta visual..."
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {isZoomOpen && masterImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 select-none animate-in fade-in duration-200"
          onClick={() => setIsZoomOpen(false)}
        >
          <div
            className="w-full max-w-6xl flex items-center justify-between py-2 px-4 mb-2 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-bold tracking-wide">Peta Visual Produksi (16:9 Master Grid)</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh HD</span>
              </button>
              <button
                type="button"
                onClick={() => setIsZoomOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div
            className="relative max-w-6xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={masterImageUrl}
              alt="Peta Visual Master Full"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
