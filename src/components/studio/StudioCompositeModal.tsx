import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  Sliders,
  Check,
  Sparkles,
  Loader2,
  Image as ImageIcon,
  RefreshCw,
  Copy,
  Plus,
  Trash2,
  Layers,
  Wand2,
  Eye,
  Upload,
  AlertCircle,
  LayoutGrid
} from 'lucide-react';
import { StudioProject, StudioCompositeConfig, StudioImageModel } from '../../types/studio';
import { generateCompositeStoryboardCanvas } from '../../lib/studioStitcher';
import { downloadMediaFile } from '../../utils';
import {
  buildOneSheetGridPrompt,
  collectStudioReferenceImages,
  generateOneSheetGridImage
} from '../../lib/studioService';

interface Props {
  project: StudioProject;
  isOpen: boolean;
  onClose: () => void;
  onUpdateProject?: (updated: StudioProject) => void;
  onSendToCanvas?: (imageUrls: string[]) => void;
}

export const StudioCompositeModal: React.FC<Props> = ({
  project,
  isOpen,
  onClose,
  onUpdateProject,
  onSendToCanvas,
}) => {
  // Mode Tabs: 'ai-generate' (1-Shot AI 16:9 Grid) vs 'canvas-stitch' (Local Stitcher)
  const [activeTab, setActiveTab] = useState<'ai-generate' | 'canvas-stitch'>('ai-generate');

  // --- AI 1-Shot 16:9 Grid States ---
  const [compiledPrompt, setCompiledPrompt] = useState<string>(() =>
    project.oneSheetGrid?.prompt || buildOneSheetGridPrompt(project.scenes, project.name)
  );
  const [selectedModel, setSelectedModel] = useState<StudioImageModel>(
    (project.oneSheetGrid?.imageModel as StudioImageModel) || project.imageModel || 'GPT Image 2.5'
  );
  const [referenceImages, setReferenceImages] = useState<string[]>(() =>
    project.oneSheetGrid?.referenceImages || collectStudioReferenceImages(project)
  );
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [generated16x9Url, setGenerated16x9Url] = useState<string | null>(
    project.oneSheetGrid?.imageUrl || project.compositeImageUrl || null
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genStatusText, setGenStatusText] = useState('');
  const [genError, setGenError] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Zoom preview modal
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Manual Canvas Stitcher States ---
  const [config, setConfig] = useState<StudioCompositeConfig>(
    project.compositeConfig || {
      gridColumns: 3,
      gridRows: 2,
      showBadges: true,
      showTitleBanner: true,
      titleText: project.name || 'STORYBOARD SEMANGKA RAKSASA LONJONG',
      borderColor: '#0A0A0E',
      borderWidth: 16,
      padding: 24,
      aspectRatio: '16:9',
    }
  );
  const [compositeDataUrl, setCompositeDataUrl] = useState<string | null>(null);
  const [compositeBlob, setCompositeBlob] = useState<Blob | null>(null);
  const [isStitching, setIsStitching] = useState(false);
  const [stitchError, setStitchError] = useState<string | null>(null);

  const validScenes = project.scenes.filter((s) => s.imageUrl && s.status === 'completed');

  // Helper to sync references & prompt with current project scenes
  const handleSyncWithLatestStoryboard = () => {
    const freshPrompt = buildOneSheetGridPrompt(project.scenes, project.name);
    const freshRefs = collectStudioReferenceImages(project);
    setCompiledPrompt(freshPrompt);
    setReferenceImages(freshRefs);
  };

  // Unique signature of scene image URLs to detect re-generations
  const scenesImageSignature = project.scenes.map((s) => `${s.id}:${s.imageUrl || ''}`).join('|');

  // Sync references & default prompt on open or when scenes change
  useEffect(() => {
    if (isOpen) {
      const freshRefs = collectStudioReferenceImages(project);

      // If project has no stored oneSheetGrid (e.g. newly generated storyboard or brief re-analysis)
      if (!project.oneSheetGrid) {
        setCompiledPrompt(buildOneSheetGridPrompt(project.scenes, project.name));
        setReferenceImages(freshRefs);
        setGenerated16x9Url(null);
      } else {
        // If oneSheetGrid exists, auto-update reference images to include newly generated scene images
        setReferenceImages(freshRefs);
        
        // If compiledPrompt is empty or outdated
        if (!compiledPrompt) {
          setCompiledPrompt(project.oneSheetGrid.prompt || buildOneSheetGridPrompt(project.scenes, project.name));
        }

        if (generated16x9Url === null) {
          setGenerated16x9Url(project.oneSheetGrid.imageUrl || project.compositeImageUrl || null);
        }
      }
    }
  }, [isOpen, scenesImageSignature, project.id, project.name, project.updatedAt]);

  // Handle local canvas stitcher when switching to canvas tab
  const handleGenerateCanvasStitch = async () => {
    if (validScenes.length === 0) return;
    setIsStitching(true);
    setStitchError(null);

    try {
      const result = await generateCompositeStoryboardCanvas(project.scenes, config, project.name);
      setCompositeDataUrl(result.dataUrl);
      setCompositeBlob(result.blob);
    } catch (err: any) {
      console.error('[Composite Modal Stitch Error]:', err);
      setStitchError(err.message || 'Gagal menggabungkan storyboard canvas.');
    } finally {
      setIsStitching(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'canvas-stitch' && validScenes.length > 0) {
      handleGenerateCanvasStitch();
    }
  }, [isOpen, activeTab, config.gridColumns, config.showBadges, config.showTitleBanner, config.borderColor, config.borderWidth, config.titleText]);

  if (!isOpen) return null;

  // 1. Reset prompt to standard template
  const handleResetPrompt = () => {
    const freshPrompt = buildOneSheetGridPrompt(project.scenes, project.name);
    setCompiledPrompt(freshPrompt);
  };

  // 2. Copy compiled prompt
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(compiledPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  // 3. Handle Add Reference Image from File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const resultUrl = loadEvt.target?.result as string;
        if (resultUrl) {
          setReferenceImages((prev) => (prev.includes(resultUrl) ? prev : [...prev, resultUrl]));
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 4. Handle Add Reference Image from URL
  const handleAddUrlReference = () => {
    const clean = newImageUrl.trim();
    if (!clean) return;
    if (!referenceImages.includes(clean)) {
      setReferenceImages((prev) => [...prev, clean]);
    }
    setNewImageUrl('');
    setIsAddingUrl(false);
  };

  // 5. Remove Reference Image
  const handleRemoveReference = (indexToRemove: number) => {
    setReferenceImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // 6. Execute AI 1-Shot 16:9 Grid Generation
  const handleGenerate1ShotGrid = async () => {
    if (!compiledPrompt.trim()) {
      setGenError('Prompt 1-Sheet Grid tidak boleh kosong.');
      return;
    }

    setIsGenerating(true);
    setGenError(null);
    setGenProgress(10);
    setGenStatusText('Menyiapkan prompt terpadu & referensi visual...');

    try {
      const generatedUrl = await generateOneSheetGridImage({
        prompt: compiledPrompt,
        referenceImages,
        modelName: selectedModel,
        aspectRatio: '16:9',
        onProgress: (progress) => {
          setGenProgress(progress);
          if (progress <= 20) {
            setGenStatusText('Mengunggah & memproses referensi visual...');
          } else if (progress <= 40) {
            setGenStatusText('Mengirim task 1-Sheet Grid ke Weavy AI...');
          } else if (progress < 100) {
            setGenStatusText(`Merender 1-Sheet Grid 16:9 (${progress}%)...`);
          } else {
            setGenStatusText('1-Sheet Grid 16:9 selesai dibuat!');
          }
        },
      });

      setGenerated16x9Url(generatedUrl);

      // Save to project state
      if (onUpdateProject) {
        const updatedProject: StudioProject = {
          ...project,
          compositeImageUrl: generatedUrl,
          oneSheetGrid: {
            imageUrl: generatedUrl,
            prompt: compiledPrompt,
            referenceImages,
            generatedAt: new Date().toISOString(),
            imageModel: selectedModel,
            aspectRatio: '16:9',
          },
          updatedAt: new Date().toISOString(),
        };
        onUpdateProject(updatedProject);
      }
    } catch (err: any) {
      console.error('[Generate 1-Shot Grid Error]:', err);
      setGenError(err.message || 'Gagal menghasilkan 1-Sheet Grid 16:9.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 7. Download Generated 16:9 PNG
  const handleDownload16x9Png = async () => {
    const url = generated16x9Url || compositeDataUrl;
    if (!url) return;

    try {
      const filename = `${project.name.replace(/[^\w\d-_]/g, '_')}_1sheet_grid_16x9`;
      await downloadMediaFile(url, filename, 'image', selectedModel);
    } catch (err) {
      console.error('[StudioCompositeModal] Download error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-[#FAF9F6] dark:bg-[#141418] border border-stone-300 dark:border-white/10 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden transition-colors duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200 dark:border-white/10 bg-stone-100/90 dark:bg-[#1B1B22]/95">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-serif-display">
                  1-Sheet Grid Generator
                </h3>
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-amber-500 text-stone-950 shadow-xs">
                  Format 16:9
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-stone-200 dark:bg-white/10 text-stone-700 dark:text-stone-300">
                  {project.scenes.length} Scenes
                </span>
                {referenceImages.length > 0 && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                    {referenceImages.length} Referensi
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-sans-body">
                Generate 1 kali seluruh rangkaian scene menjadi satu gambar storyboard grid berformat 16:9 dengan semua gambar referensi terpadu.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab Switcher */}
            <div className="hidden sm:flex items-center bg-stone-200 dark:bg-[#111116] p-1 rounded-xl border border-stone-300 dark:border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab('ai-generate')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'ai-generate'
                    ? 'bg-amber-500 text-stone-950 shadow-sm'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI 1-Shot 16:9</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('canvas-stitch')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'canvas-stitch'
                    ? 'bg-amber-500 text-stone-950 shadow-sm'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Canvas Stitcher</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-stone-200/80 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* ========================================================================= */}
          {/* TAB 1: AI 1-SHOT 16:9 GENERATOR (PRIMARY REQUESTED FEATURE)               */}
          {/* ========================================================================= */}
          {activeTab === 'ai-generate' ? (
            <>
              {/* Left Column: Prompt & Reference Settings (5 Columns) */}
              <div className="lg:col-span-5 space-y-4 flex flex-col">
                
                {/* 1. Compiled Unified Prompt Box */}
                <div className="bg-stone-100 dark:bg-[#1B1B22] p-4 rounded-xl border border-stone-300 dark:border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5 text-amber-500" />
                      <span>Prompt Terpadu (16:9 Grid)</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSyncWithLatestStoryboard}
                        disabled={isGenerating}
                        className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                        title="Ambil gambar referensi & prompt terbaru dari seluruh scene storyboard"
                      >
                        <RefreshCw className="w-3 h-3 text-amber-500" />
                        <span>Sync Scene Terbaru</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleResetPrompt}
                        className="text-[11px] font-semibold text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                        title="Susun ulang otomatis dari seluruh scene"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyPrompt}
                        className="px-2 py-1 rounded bg-stone-200 dark:bg-white/10 hover:bg-stone-300 dark:hover:bg-white/20 text-stone-700 dark:text-stone-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Salin prompt terpadu"
                      >
                        {copiedPrompt ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedPrompt ? 'Disalin' : 'Salin'}</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Semua skenario scene dari awal sampai akhir disusun menjadi 1 prompt multi-panel storyboard berformat 16:9.
                  </p>

                  <textarea
                    rows={7}
                    value={compiledPrompt}
                    onChange={(e) => setCompiledPrompt(e.target.value)}
                    disabled={isGenerating}
                    placeholder="Susunan prompt 1-sheet grid..."
                    className="w-full bg-white dark:bg-[#141418] border border-stone-300 dark:border-white/10 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-900 dark:text-stone-100 focus:outline-none font-mono leading-relaxed resize-none disabled:opacity-60"
                  />
                </div>

                {/* 2. Reference Images Input Section ("Semua gambar referensi dimasukkan") */}
                <div className="bg-stone-100 dark:bg-[#1B1B22] p-4 rounded-xl border border-stone-300 dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                        <span>Gambar Referensi ({referenceImages.length})</span>
                      </label>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400">
                        Dimasukkan ke AI generator sebagai panduan visual konsisten.
                      </p>
                    </div>

                    {/* Hidden File Input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSyncWithLatestStoryboard}
                        disabled={isGenerating}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                        title="Ambil ulang seluruh gambar scene terbaru"
                      >
                        <RefreshCw className="w-3 h-3 text-amber-500" />
                        <span>Sync</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isGenerating}
                        className="px-2.5 py-1.5 rounded-lg bg-stone-200 dark:bg-white/10 hover:bg-stone-300 dark:hover:bg-white/20 text-stone-800 dark:text-stone-200 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                        title="Unggah gambar dari perangkat"
                      >
                        <Upload className="w-3 h-3 text-amber-500" />
                        <span>Upload</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingUrl(!isAddingUrl)}
                        disabled={isGenerating}
                        className="px-2.5 py-1.5 rounded-lg bg-stone-200 dark:bg-white/10 hover:bg-stone-300 dark:hover:bg-white/20 text-stone-800 dark:text-stone-200 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                        title="Tambah link URL gambar"
                      >
                        <Plus className="w-3 h-3 text-amber-500" />
                        <span>Link</span>
                      </button>
                    </div>
                  </div>

                  {/* Add URL Field if toggled */}
                  {isAddingUrl && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="text"
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                        placeholder="https://example.com/gambar-referensi.jpg"
                        className="flex-1 bg-white dark:bg-[#141418] border border-stone-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 dark:text-white focus:outline-none focus:border-amber-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddUrlReference();
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddUrlReference}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                      >
                        Tambah
                      </button>
                    </div>
                  )}

                  {/* Thumbnails Grid of Reference Images */}
                  {referenceImages.length > 0 ? (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-36 overflow-y-auto p-1 bg-white/50 dark:bg-[#141418]/60 rounded-lg border border-stone-200 dark:border-white/5">
                      {referenceImages.map((imgUrl, idx) => (
                        <div
                          key={idx}
                          className="relative group aspect-square rounded-lg overflow-hidden border border-stone-300 dark:border-white/10 bg-stone-900"
                        >
                          <img
                            src={imgUrl}
                            alt={`Ref ${idx + 1}`}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveReference(idx)}
                            disabled={isGenerating}
                            className="absolute top-1 right-1 p-1 rounded-md bg-black/70 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                            title="Hapus referensi ini"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                          <span className="absolute bottom-0.5 left-0.5 text-[9px] font-mono px-1 py-0.2 rounded bg-black/60 text-white">
                            #{idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-center border border-dashed border-stone-300 dark:border-white/10 rounded-lg">
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        Belum ada gambar referensi. Klik Upload atau Link di atas untuk menambahkan.
                      </p>
                    </div>
                  )}
                </div>

                {/* 3. Model & Aspect Ratio Selection */}
                <div className="bg-stone-100 dark:bg-[#1B1B22] p-4 rounded-xl border border-stone-300 dark:border-white/10 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider mb-1">
                        Model Generator AI
                      </label>
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value as StudioImageModel)}
                        disabled={isGenerating}
                        className="w-full bg-white dark:bg-[#141418] border border-stone-300 dark:border-white/10 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 dark:text-white font-semibold cursor-pointer focus:outline-none"
                      >
                        <option value="ChatGPT Images 2.0 Edit">ChatGPT Images 2.0 Edit / GPT Image 2.0 (11 CR)</option>
                        <option value="GPT Image 2.5">GPT Image 2.5 (Weavy Engine - 4 CR)</option>
                        <option value="Seedream V5.0 Pro Edit">Seedream V5.0 Pro Edit (12 CR)</option>
                        <option value="Nano Banana Pro">Nano Banana Pro (11 CR)</option>
                        <option value="Grok Imagine Image">Grok Imagine Image (4 CR)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider mb-1">
                        Format Output
                      </label>
                      <div className="w-full bg-white/70 dark:bg-[#141418]/80 border border-stone-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center justify-between">
                        <span>16:9 (Widescreen)</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono">
                          1-Sheet Grid
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Prominent 1-Click Generate Button */}
                  <button
                    type="button"
                    onClick={handleGenerate1ShotGrid}
                    disabled={isGenerating}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:via-orange-400 hover:to-amber-500 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sedang Menghasilkan 1-Sheet Grid (16:9)...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Generate 1-Sheet Grid (16:9) Sekarang</span>
                      </>
                    )}
                  </button>

                  {genError && (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{genError}</span>
                    </div>
                  )}
                </div>

              </div>

              {/* Right Column: Live Output & Result Preview (7 Columns) */}
              <div className="lg:col-span-7 flex flex-col items-center justify-center bg-stone-200/50 dark:bg-black/50 border border-stone-300 dark:border-white/10 rounded-2xl p-4 min-h-[420px] relative overflow-hidden">
                
                {isGenerating ? (
                  <div className="w-full max-w-md text-center space-y-4 py-12 px-4">
                    <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-ping"></div>
                      <div className="w-16 h-16 rounded-full border-4 border-amber-500 border-t-transparent animate-spin flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-amber-500" />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-base font-extrabold text-stone-900 dark:text-white">
                        Menghasilkan 1-Sheet Grid (16:9)...
                      </h4>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                        {genStatusText || 'Menyusun semua scene dan gambar referensi ke dalam format 16:9'}
                      </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-stone-300 dark:bg-white/10 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-orange-500 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(8, genProgress)}%` }}
                      ></div>
                    </div>
                    <span className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
                      {genProgress}% selesai
                    </span>
                  </div>
                ) : generated16x9Url ? (
                  <div className="w-full h-full flex flex-col items-center justify-center space-y-3">
                    <div className="relative group w-full flex items-center justify-center aspect-video max-h-[440px] bg-black/40 rounded-xl overflow-hidden border border-stone-300 dark:border-white/10 shadow-2xl">
                      <img
                        src={generated16x9Url}
                        alt="1-Sheet Grid 16:9 Storyboard"
                        className="w-full h-full object-contain cursor-zoom-in"
                        onClick={() => setIsZoomOpen(true)}
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Floating overlay actions */}
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setIsZoomOpen(true)}
                          className="p-2 rounded-xl bg-black/70 hover:bg-black/90 text-white backdrop-blur-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-md"
                          title="Perbesar Tampilan (Zoom)"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-md px-3 py-1 rounded-lg text-[11px] font-semibold text-white border border-white/10">
                        1-Sheet Grid (16:9 Widescreen)
                      </div>
                    </div>

                    <div className="flex items-center justify-between w-full px-2 text-xs text-stone-500 dark:text-stone-400">
                      <span>Berhasil digenerate dalam format 16:9 dengan model {selectedModel}</span>
                      <button
                        type="button"
                        onClick={handleGenerate1ShotGrid}
                        className="text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Generate Ulang (Re-roll)</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 px-6 max-w-md space-y-3 text-stone-500 dark:text-stone-400">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                      <LayoutGrid className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-stone-800 dark:text-stone-200">
                        1-Sheet Grid 16:9 Siap Dihasilkan
                      </h4>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                        Klik tombol <strong>"Generate 1-Sheet Grid (16:9) Sekarang"</strong> di sebelah kiri untuk menghasilkan seluruh susunan scene sekaligus dalam 1 gambar kontak sheet widescreen.
                      </p>
                    </div>
                  </div>
                )}

              </div>
            </>
          ) : (
            /* ========================================================================= */
            /* TAB 2: MANUAL CANVAS STITCHER (STITCH INDIVIDUAL COMPLETED SCENES)          */
            /* ========================================================================= */
            <>
              {/* Left Column: Stitch Customization */}
              <div className="lg:col-span-5 space-y-4 bg-stone-100 dark:bg-[#1B1B22] p-5 rounded-xl border border-stone-300 dark:border-white/10 self-start">
                <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-stone-200 dark:border-white/10">
                  <Sliders className="w-4 h-4 text-amber-500" />
                  Kustomisasi Framing Canvas
                </h4>

                {/* Grid Columns */}
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                    Jumlah Kolom Grid
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[2, 3, 4].map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setConfig({ ...config, gridColumns: col })}
                        className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          config.gridColumns === col
                            ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                            : 'bg-stone-200 dark:bg-[#141418] text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white border border-stone-300/60 dark:border-white/5'
                        }`}
                      >
                        {col} Kolom
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title Banner */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
                      Banner Judul Header
                    </label>
                    <input
                      type="checkbox"
                      checked={config.showTitleBanner}
                      onChange={(e) => setConfig({ ...config, showTitleBanner: e.target.checked })}
                      className="rounded accent-amber-500 cursor-pointer"
                    />
                  </div>
                  {config.showTitleBanner && (
                    <input
                      type="text"
                      value={config.titleText || ''}
                      onChange={(e) => setConfig({ ...config, titleText: e.target.value })}
                      placeholder="Judul Storyboard Campaign"
                      className="w-full bg-white dark:bg-[#141418] border border-stone-300 dark:border-white/10 focus:border-amber-500 rounded-lg px-3 py-1.5 text-xs text-stone-900 dark:text-white focus:outline-none"
                    />
                  )}
                </div>

                {/* Badges Toggle */}
                <div className="flex items-center justify-between py-2 border-t border-stone-200 dark:border-white/10">
                  <div>
                    <span className="block text-xs font-medium text-stone-800 dark:text-stone-300">Label Scene Badge</span>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400">Overlay pill nomor dan judul scene</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.showBadges}
                    onChange={(e) => setConfig({ ...config, showBadges: e.target.checked })}
                    className="rounded accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* Border Color */}
                <div className="py-2 border-t border-stone-200 dark:border-white/10">
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                    Warna Frame Border
                  </label>
                  <div className="flex items-center gap-2">
                    {[
                      { color: '#0A0A0E', label: 'Dark' },
                      { color: '#181824', label: 'Slate' },
                      { color: '#FFFFFF', label: 'White' },
                      { color: '#F59E0B', label: 'Amber' },
                    ].map((c) => (
                      <button
                        key={c.color}
                        type="button"
                        onClick={() => setConfig({ ...config, borderColor: c.color })}
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                          config.borderColor === c.color ? 'ring-2 ring-amber-400 border-white' : 'border-stone-400 dark:border-slate-700'
                        }`}
                        style={{ backgroundColor: c.color }}
                      >
                        {config.borderColor === c.color && (
                          <Check className={`w-3.5 h-3.5 ${c.color === '#FFFFFF' ? 'text-black' : 'text-white'}`} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateCanvasStitch}
                  disabled={isStitching || validScenes.length === 0}
                  className="w-full py-2.5 rounded-xl bg-stone-200 dark:bg-[#141418] hover:bg-stone-300 dark:hover:bg-stone-800 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isStitching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Render Ulang Canvas Stitch
                </button>
              </div>

              {/* Right Column: Canvas Live Preview */}
              <div className="lg:col-span-7 flex flex-col items-center justify-center bg-stone-200/50 dark:bg-black/40 border border-stone-300 dark:border-white/10 rounded-2xl p-4 min-h-[420px] relative overflow-hidden">
                {isStitching ? (
                  <div className="text-center space-y-3 py-16">
                    <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto" />
                    <p className="text-sm font-semibold text-stone-900 dark:text-white">Menjahit Gambar ke Canvas...</p>
                  </div>
                ) : compositeDataUrl ? (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <img
                      src={compositeDataUrl}
                      alt="Storyboard Composite Preview"
                      className="max-h-[440px] w-auto object-contain rounded-xl shadow-2xl border border-stone-300 dark:border-white/10"
                    />
                  </div>
                ) : (
                  <div className="text-center py-16 space-y-2 text-stone-500 dark:text-stone-400">
                    <ImageIcon className="w-10 h-10 text-stone-400 dark:text-stone-600 mx-auto" />
                    <p className="text-sm font-semibold text-stone-800 dark:text-stone-300">Belum Ada Scene yang Selesai</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">Generate minimal 1 scene di menu Studio sebelum menggabungkan.</p>
                  </div>
                )}
              </div>
            </>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3.5 border-t border-stone-200 dark:border-white/10 bg-stone-100/90 dark:bg-[#1B1B22]/95 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleDownload16x9Png}
            disabled={!generated16x9Url && !compositeDataUrl}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-orange-500/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download 1-Sheet Grid (16:9 PNG)</span>
          </button>
        </div>

      </div>

      {/* High-Resolution Zoom Modal */}
      {isZoomOpen && (generated16x9Url || compositeDataUrl) && (
        <div
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setIsZoomOpen(false)}
        >
          <div className="relative max-w-7xl max-h-[90vh] flex flex-col items-center">
            <img
              src={generated16x9Url || compositeDataUrl!}
              alt="1-Sheet Grid Zoom"
              className="max-h-[85vh] max-w-full object-contain rounded-xl shadow-2xl border border-white/15"
              referrerPolicy="no-referrer"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload16x9Png();
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Gambar (16:9)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsZoomOpen(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
