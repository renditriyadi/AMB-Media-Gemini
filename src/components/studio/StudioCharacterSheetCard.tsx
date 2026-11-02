import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Sparkles,
  Loader2,
  Download,
  RotateCcw,
  Trash2,
  Eye,
  EyeOff,
  Sliders,
  Copy,
  Check,
  Maximize2,
  X,
  RefreshCw,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Camera,
  Layers,
  HelpCircle,
  Settings2,
  ChevronDown
} from 'lucide-react';
import { StudioAspectRatio, StudioImageModel } from '../../types/studio';
import {
  generateOneSheetGridImage,
  getActiveWeavyAccount,
  getAllWeavyAccounts,
  switchActiveWeavyAccount,
  syncWeavyAccountCredits
} from '../../lib/studioService';
import { uploadMediaWithProgress } from '../../utils';
import { downloadMediaFile } from '../../utils';

export type CharacterCameraView = '1-view' | '2-view' | '3-view';

interface UploadSlotState {
  id: string;
  previewUrl: string;
  serverUrl?: string;
  status: 'uploading' | 'completed' | 'error';
  progress: number;
}

const WEAVY_IMAGE_MODELS = [
  {
    id: 'ChatGPT Images 2.0 Edit',
    name: 'ChatGPT Images 2.0 Edit',
    cost: 11,
    provider: 'OpenAI',
    description: 'High Consistency Face & Character Turnaround (11 Kredit)',
  },
  {
    id: 'GPT Image 2.5',
    name: 'GPT Image 2.5',
    cost: 4,
    provider: 'Weavy Flare',
    description: 'Ultra Photorealistic Model Turnaround (4 Kredit)',
  },
  {
    id: 'Seedream V5.0 Pro Edit',
    name: 'Seedream V5.0 Pro Edit',
    cost: 12,
    provider: 'Seedream',
    description: 'High Facial & Wardrobe Consistency (12 Kredit)',
  },
  {
    id: 'Nano Banana Pro',
    name: 'Nano Banana Pro',
    cost: 11,
    provider: 'Nano Banana',
    description: 'Vibrant Studio Lighting & Fast Render (11 Kredit)',
  },
  {
    id: 'Grok Imagine Image',
    name: 'Grok Imagine Image',
    cost: 4,
    provider: 'Grok Imagine',
    description: 'Natural Pose & Sharp Details (4 Kredit)',
  },
];

const DEFAULT_PROMPTS: Record<CharacterCameraView, string> = {
  '3-view': `photorealistic character reference sheet of this exact person, showing front view, side view, and back view side by side. Preserve real facial features, authentic skin tone, actual clothing and appearance. Ultra-realistic, hyperdetailed, photography style, no cartoon, no illustration, no 3D render, no stylization, no anime. Clean white background, neutral standing pose, full body visible, soft studio lighting.`,
  '2-view': `photorealistic character reference sheet of this exact person, showing front view and side view side by side. Preserve real facial features, authentic skin tone, actual clothing and appearance. Ultra-realistic, hyperdetailed, photography style, no cartoon, no illustration, no 3D render, no stylization, no anime. Clean white background, neutral standing pose, full body visible, soft studio lighting.`,
  '1-view': `photorealistic character reference portrait of this exact person, showing full front view. Preserve real facial features, authentic skin tone, actual clothing and appearance. Ultra-realistic, hyperdetailed, photography style, no cartoon, no illustration, no 3D render, no stylization, no anime. Clean white background, neutral standing pose, full body visible, soft studio lighting.`
};

interface Props {
  activeAccountId?: string;
  onSendToCanvas?: (imageUrls: string[]) => void;
  onSuccessToast?: (msg: string) => void;
}

export const StudioCharacterSheetCard: React.FC<Props> = ({
  activeAccountId,
  onSendToCanvas,
  onSuccessToast,
}) => {
  // 1. Upload state
  const [refImage, setRefImage] = useState<string | null>(null);
  const [refServerUrl, setRefServerUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2. Camera Views & Aspect Ratio
  const [cameraView, setCameraView] = useState<CharacterCameraView>('3-view');
  
  // 3. Grid Overlay States
  const [isGridOn, setIsGridOn] = useState<boolean>(true);
  const [gridCount, setGridCount] = useState<number>(30); // 4 to 40
  const [gridThickness, setGridThickness] = useState<number>(0.5); // 0.5 to 4px
  const [gridColor, setGridColor] = useState<string>('rgba(132, 204, 22, 0.45)'); // lime/greenish or amber

  // 4. Prompt Master State
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPTS['3-view']);
  const [isPromptCustomized, setIsPromptCustomized] = useState<boolean>(false);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

  // 5. Model Selection
  const [selectedModel, setSelectedModel] = useState<string>('GPT Image 2.5');

  // 6. Output & Generation States
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [genProgress, setGenProgress] = useState<number>(0);
  const [genError, setGenError] = useState<string | null>(null);
  const [generatedSheetUrl, setGeneratedSheetUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isZoomOpen, setIsZoomOpen] = useState<boolean>(false);

  // Canvas / Image reference for stitching grid
  const imagePreviewRef = useRef<HTMLImageElement>(null);

  // Update prompt when camera view changes if user hasn't heavily customized it
  const handleSelectCameraView = (view: CharacterCameraView) => {
    setCameraView(view);
    if (!isPromptCustomized) {
      setPrompt(DEFAULT_PROMPTS[view]);
    }
  };

  const handleResetPrompt = () => {
    setPrompt(DEFAULT_PROMPTS[cameraView]);
    setIsPromptCustomized(false);
    if (onSuccessToast) onSuccessToast('Prompt dikembalikan ke default');
  };

  // Get current aspect ratio based on camera view
  const currentAspectRatio = cameraView === '3-view' ? '16:9' : cameraView === '2-view' ? '4:3' : '1:1';

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    setRefImage(localUrl);
    setIsUploading(true);
    setUploadProgress(15);
    setUploadSuccess(false);

    try {
      const activeAcc = getActiveWeavyAccount();
      const allTokens = getAllWeavyAccounts().map((a) => a.refreshToken).filter(Boolean);

      const uploadRes = await uploadMediaWithProgress({
        url: '/api/upload-media',
        file: file,
        fileName: file.name,
        mimeType: file.type || 'image/png',
        fields: {
          refreshToken: activeAcc?.refreshToken || '',
          idToken: activeAcc?.idToken || '',
          allRefreshTokens: JSON.stringify(allTokens),
        },
        onProgress: (pct) => setUploadProgress(pct),
      });

      if (uploadRes && uploadRes.url) {
        setRefServerUrl(uploadRes.url);
        setRefImage(uploadRes.url);
      }
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
      if (onSuccessToast) onSuccessToast('Foto referensi berhasil diunggah!');
    } catch (err: any) {
      console.warn('[Upload Reference] Gagal upload ke server Weavy, menggunakan local buffer:', err);
      // fallback to local dataURL
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target?.result as string;
        setRefImage(dataUrl);
        setRefServerUrl(dataUrl);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploading(false);
      setUploadProgress(100);
      if (e.target) e.target.value = '';
    }
  };

  // Handle Generate Character Sheet
  const handleGenerate = async () => {
    if (!refImage && !refServerUrl) {
      setGenError('Silakan unggah foto referensi orang terlebih dahulu.');
      return;
    }

    setIsGenerating(true);
    setGenProgress(10);
    setGenError(null);

    try {
      const referenceImages = [refServerUrl || refImage].filter(Boolean) as string[];

      const finalUrl = await generateOneSheetGridImage({
        prompt: prompt.trim(),
        referenceImages,
        modelName: selectedModel,
        aspectRatio: currentAspectRatio,
        onProgress: (p) => setGenProgress(p),
      });

      if (!finalUrl) {
        throw new Error('Gagal menerima URL gambar karakter dari server AI.');
      }

      setGeneratedSheetUrl(finalUrl);
      if (onSuccessToast) onSuccessToast('Karakter Sheet berhasil digenerate!');
    } catch (err: any) {
      console.error('[CharacterSheet] Generate Error:', err);
      setGenError(err.message || 'Gagal menghasilkan Karakter Sheet. Periksa koneksi atau saldo kredit Weavy.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper to bake grid overlay onto canvas and download
  const handleDownloadSheet = async (includeGrid: boolean) => {
    if (!generatedSheetUrl) return;

    setIsDownloading(true);
    try {
      const filename = `karakter_sheet_${cameraView}_${Date.now()}`;

      if (!includeGrid) {
        // Download clean HD image
        await downloadMediaFile(generatedSheetUrl, filename, 'image', selectedModel);
      } else {
        // Draw image and grid onto offscreen canvas
        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          // Use proxy download url if external to avoid tainted canvas
          if (generatedSheetUrl.startsWith('http')) {
            img.src = `/api/proxy-download?url=${encodeURIComponent(generatedSheetUrl)}&filename=${encodeURIComponent(filename)}`;
          } else {
            img.src = generatedSheetUrl;
          }
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1920;
        canvas.height = img.naturalHeight || 1080;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          // Draw image
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Draw Grid Overlay
          ctx.lineWidth = gridThickness * (canvas.width / 1200);
          ctx.strokeStyle = gridColor;

          const cols = gridCount;
          const rows = Math.round(gridCount * (canvas.height / canvas.width));

          const cellW = canvas.width / cols;
          const cellH = canvas.height / rows;

          ctx.beginPath();
          // Vertical lines
          for (let c = 0; c <= cols; c++) {
            ctx.moveTo(c * cellW, 0);
            ctx.lineTo(c * cellW, canvas.height);
          }
          // Horizontal lines
          for (let r = 0; r <= rows; r++) {
            ctx.moveTo(0, r * cellH);
            ctx.lineTo(canvas.width, r * cellH);
          }
          ctx.stroke();

          const dataUrl = canvas.toDataURL('image/png');
          await downloadMediaFile(dataUrl, `${filename}_grid`, 'image');
        } else {
          await downloadMediaFile(generatedSheetUrl, filename, 'image', selectedModel);
        }
      }

      if (onSuccessToast) onSuccessToast('Karakter Sheet berhasil diunduh!');
    } catch (err) {
      console.error('[CharacterSheet] Download Error:', err);
      // Fallback clean download
      await downloadMediaFile(generatedSheetUrl, `karakter_sheet_${cameraView}`, 'image', selectedModel);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
      if (onSuccessToast) onSuccessToast('Prompt disalin ke clipboard!');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-stone-100/50 dark:bg-[#0E0E12] text-stone-900 dark:text-stone-100 p-3 sm:p-4 lg:p-6 transition-colors duration-200">
      {/* Top Banner Header */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF9F6] dark:bg-[#141418] border border-stone-300 dark:border-white/10 p-4 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-serif-display text-stone-900 dark:text-stone-100 flex items-center gap-2">
                Karakter Sheet Generator
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold uppercase tracking-wide">
                  Model Turnaround 360°
                </span>
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-sans-body">
                Hasilkan lembar acuan karakter (Front, Side, Back View) yang konsisten 100% dari satu foto orang untuk kebutuhan storyboard & video AI.
              </p>
            </div>
          </div>
        </div>

        {/* Weavy Account Credits Quick Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="px-3 py-1.5 rounded-xl bg-stone-200/60 dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 flex items-center gap-2 text-xs">
            <span className="text-stone-500 dark:text-stone-400 text-[11px]">Model Engine:</span>
            <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">{selectedModel}</span>
          </div>
        </div>
      </div>

      {/* Main Split Grid (Left Controls, Right Preview Canvas) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start flex-1">
        
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Controls & Input Parameters (Col Span 5) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          
          {/* Card 1: Foto Referensi Orang */}
          <div className="bg-[#FAF9F6] dark:bg-[#141418] border border-stone-300 dark:border-white/10 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>Foto Referensi Orang</span>
              </label>
              {refImage && (
                <button
                  type="button"
                  onClick={() => {
                    setRefImage(null);
                    setRefServerUrl(null);
                  }}
                  className="text-[11px] text-rose-500 hover:text-rose-600 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Hapus</span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />

            {refImage ? (
              <div className="relative rounded-xl overflow-hidden border border-stone-300 dark:border-white/15 bg-black/5 dark:bg-black/40 group aspect-[4/3] flex items-center justify-center">
                <img
                  src={refImage}
                  alt="Referensi Orang"
                  className="w-full h-full object-contain"
                />
                
                {/* Uploading progress overlay */}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white p-3">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                    <span className="text-xs font-semibold">Mengunggah Foto ({uploadProgress}%)...</span>
                    <div className="w-32 bg-white/20 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-400 h-full transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Success upload badge */}
                {uploadSuccess && (
                  <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-emerald-500/90 text-white text-[10px] font-bold flex items-center gap-1 shadow-md">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Terunggah ke Cloud</span>
                  </div>
                )}

                {/* Change photo button on hover */}
                {!isUploading && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 shadow transition-transform active:scale-95 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Ganti Foto</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-stone-300 dark:border-white/15 hover:border-amber-500/60 dark:hover:border-amber-400/60 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 bg-stone-50/50 dark:bg-white/[0.02] hover:bg-amber-500/5 group"
              >
                <div className="p-3 rounded-full bg-stone-200 dark:bg-white/10 group-hover:bg-amber-500/20 text-stone-600 dark:text-stone-400 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-stone-700 dark:text-stone-300 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                  Klik atau drag & drop foto
                </p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                  Format JPG, PNG, WEBP (Wajah & pakaian terlihat jelas)
                </p>
              </div>
            )}
          </div>

          {/* Card 2: Camera Views (Pilihan Sudut Pandang) */}
          <div className="bg-[#FAF9F6] dark:bg-[#141418] border border-stone-300 dark:border-white/10 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>Camera Views</span>
              </label>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 text-[11px] font-mono font-bold">
                {cameraView === '3-view' ? '3' : cameraView === '2-view' ? '2' : '1'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Option 1 Posisi */}
              <button
                type="button"
                onClick={() => handleSelectCameraView('1-view')}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                  cameraView === '1-view'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 shadow-xs ring-1 ring-amber-500/30'
                    : 'border-stone-300 dark:border-white/10 hover:border-stone-400 dark:hover:border-white/20 text-stone-600 dark:text-stone-400'
                }`}
              >
                <div className="w-5 h-5 rounded-md border-2 border-current flex items-center justify-center text-[9px] font-bold">
                  1:1
                </div>
                <span className="text-[11px] font-bold">1 Posisi</span>
                <span className="text-[9px] opacity-75">1:1 Square</span>
              </button>

              {/* Option 2 Posisi */}
              <button
                type="button"
                onClick={() => handleSelectCameraView('2-view')}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                  cameraView === '2-view'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 shadow-xs ring-1 ring-amber-500/30'
                    : 'border-stone-300 dark:border-white/10 hover:border-stone-400 dark:hover:border-white/20 text-stone-600 dark:text-stone-400'
                }`}
              >
                <div className="w-6 h-4.5 rounded-md border-2 border-current flex items-center justify-center text-[9px] font-bold">
                  4:3
                </div>
                <span className="text-[11px] font-bold">2 Posisi</span>
                <span className="text-[9px] opacity-75">4:3 Ratio</span>
              </button>

              {/* Option 3 Posisi (Default) */}
              <button
                type="button"
                onClick={() => handleSelectCameraView('3-view')}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                  cameraView === '3-view'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 shadow-xs ring-1 ring-amber-500/30'
                    : 'border-stone-300 dark:border-white/10 hover:border-stone-400 dark:hover:border-white/20 text-stone-600 dark:text-stone-400'
                }`}
              >
                <div className="w-7 h-4 rounded-md border-2 border-current flex items-center justify-center text-[9px] font-bold">
                  16:9
                </div>
                <span className="text-[11px] font-bold">3 Posisi</span>
                <span className="text-[9px] opacity-75">16:9 Landscape</span>
              </button>
            </div>

            <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
              {cameraView === '3-view'
                ? 'Front View + Side View + Back View'
                : cameraView === '2-view'
                ? 'Front View + Side View'
                : 'Front View Stand Alone'}
            </p>
          </div>

          {/* Card 3: Grid Overlay Controls */}
          <div className="bg-[#FAF9F6] dark:bg-[#141418] border border-stone-300 dark:border-white/10 rounded-2xl p-4 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-lime-500 dark:text-lime-400" />
                <span>Grid Overlay</span>
              </label>

              {/* Grid Toggle */}
              <button
                type="button"
                onClick={() => setIsGridOn(!isGridOn)}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isGridOn
                    ? 'bg-lime-500/20 text-lime-600 dark:text-lime-400 border border-lime-500/40'
                    : 'bg-stone-200 dark:bg-white/10 text-stone-500 dark:text-stone-400'
                }`}
              >
                {isGridOn ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{isGridOn ? 'On' : 'Off'}</span>
              </button>
            </div>

            {/* Sliders for Grid Count & Thickness */}
            <div className="space-y-3 pt-1">
              {/* Jumlah Grid Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500 dark:text-stone-400 font-medium">Jumlah Grid</span>
                  <span className="font-mono font-bold text-lime-600 dark:text-lime-400">{gridCount}×{gridCount}</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="40"
                  step="2"
                  value={gridCount}
                  onChange={(e) => setGridCount(Number(e.target.value))}
                  className="w-full accent-lime-500 h-1.5 bg-stone-200 dark:bg-stone-700 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                  <span>4</span>
                  <span>40</span>
                </div>
              </div>

              {/* Ketebalan Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500 dark:text-stone-400 font-medium">Ketebalan Garis</span>
                  <span className="font-mono font-bold text-lime-600 dark:text-lime-400">{gridThickness}px</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="4"
                  step="0.5"
                  value={gridThickness}
                  onChange={(e) => setGridThickness(Number(e.target.value))}
                  className="w-full accent-lime-500 h-1.5 bg-stone-200 dark:bg-stone-700 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                  <span>0.5px</span>
                  <span>4px</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: AI Model Engine Dropdown */}
          <div className="bg-[#FAF9F6] dark:bg-[#141418] border border-stone-300 dark:border-white/10 rounded-2xl p-4 shadow-xs space-y-2">
            <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                AI Image Engine (Weavy)
              </span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-bold">
                {WEAVY_IMAGE_MODELS.find((m) => m.id === selectedModel)?.cost || 4} Kredit
              </span>
            </label>

            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full py-2.5 px-3 rounded-xl bg-stone-100 dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 text-xs font-semibold text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer appearance-none"
              >
                {WEAVY_IMAGE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.description}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Card 5: Prompt Box */}
          <div className="bg-[#FAF9F6] dark:bg-[#141418] border border-stone-300 dark:border-white/10 rounded-2xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>Prompt Master</span>
              </label>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="text-[11px] text-stone-500 hover:text-stone-800 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                  title="Salin Prompt"
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
                  <span>Reset ke default</span>
                </button>
              </div>
            </div>

            <textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setIsPromptCustomized(true);
              }}
              rows={5}
              className="w-full p-3 rounded-xl bg-stone-100 dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 text-xs font-mono text-stone-800 dark:text-stone-200 leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-y"
              placeholder="Susun prompt lembar karakter..."
            />
          </div>

          {/* Generate Button Action */}
          <div className="space-y-1.5 pt-1">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || isUploading || (!refImage && !refServerUrl)}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-98 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-stone-950" />
                  <span>Memproses Karakter Sheet ({genProgress}%)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Karakter</span>
                </>
              )}
            </button>

            {!refImage && !refServerUrl && (
              <p className="text-[11px] text-center text-stone-400 font-medium">
                Upload foto terlebih dahulu
              </p>
            )}

            {genError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{genError}</span>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Interactive Character Sheet Canvas Display (Col Span 7) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col space-y-3">
          
          {/* Canvas Wrapper */}
          <div className="bg-[#FAF9F6] dark:bg-[#141418] border border-stone-300 dark:border-white/10 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col min-h-[540px] justify-between relative overflow-hidden">
            
            {/* Canvas Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-white/8 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                  Pratinjau Lembar Karakter
                </span>
                <span className="px-2 py-0.5 rounded-md bg-stone-200 dark:bg-white/10 text-stone-700 dark:text-stone-300 text-[10px] font-mono font-bold">
                  {currentAspectRatio}
                </span>
                {generatedSheetUrl && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                    Siap Digunakan
                  </span>
                )}
              </div>

              {generatedSheetUrl && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsZoomOpen(true)}
                    className="p-1.5 rounded-lg bg-stone-200/70 dark:bg-white/10 hover:bg-stone-300 dark:hover:bg-white/20 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                    title="Perbesar Layar Penuh"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Perbesar</span>
                  </button>
                </div>
              )}
            </div>

            {/* Canvas Center Viewport */}
            <div className="flex-1 flex items-center justify-center relative rounded-xl overflow-hidden bg-stone-900/5 dark:bg-black/60 border border-stone-200/80 dark:border-white/5 min-h-[440px]">
              
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center animate-pulse">
                      <Sparkles className="w-8 h-8 text-amber-500 animate-spin" />
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-stone-800 dark:text-stone-200">
                    Sedang Merender Karakter Sheet...
                  </h4>
                  <p className="text-xs text-stone-500 max-w-sm">
                    AI sedang membangun komposisi multi-view (Front, Side, Back View) dengan retensi wajah dan busana 100% konsisten.
                  </p>
                  <div className="w-48 bg-stone-200 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full transition-all duration-300"
                      style={{ width: `${Math.max(15, genProgress)}%` }}
                    />
                  </div>
                </div>
              ) : generatedSheetUrl ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center group select-none">
                  
                  {/* Image Display */}
                  <div className="relative max-w-full max-h-[70vh] flex items-center justify-center overflow-hidden rounded-lg">
                    <img
                      ref={imagePreviewRef}
                      src={generatedSheetUrl}
                      alt="Hasil Karakter Sheet"
                      className="w-full h-auto max-h-[68vh] object-contain rounded-lg"
                    />

                    {/* DYNAMIC SVG GRID OVERLAY */}
                    {isGridOn && (
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <defs>
                          <pattern
                            id="character-grid-pattern"
                            width={`${100 / gridCount}%`}
                            height={`${100 / Math.round(gridCount * (9 / 16))}%`}
                            patternUnits="userSpaceOnUse"
                          >
                            <path
                              d={`M ${100 / gridCount} 0 L 0 0 0 ${100 / Math.round(gridCount * (9 / 16))}`}
                              fill="none"
                              stroke={gridColor}
                              strokeWidth={gridThickness}
                            />
                          </pattern>
                        </defs>
                        {/* Render simple dynamic grid lines */}
                        {Array.from({ length: gridCount }).map((_, i) => (
                          <line
                            key={`v-${i}`}
                            x1={`${(i / gridCount) * 100}%`}
                            y1="0%"
                            x2={`${(i / gridCount) * 100}%`}
                            y2="100%"
                            stroke={gridColor}
                            strokeWidth={gridThickness}
                          />
                        ))}
                        {Array.from({ length: Math.round(gridCount * (cameraView === '3-view' ? 0.56 : cameraView === '2-view' ? 0.75 : 1)) }).map((_, i) => (
                          <line
                            key={`h-${i}`}
                            x1="0%"
                            y1={`${(i / Math.round(gridCount * (cameraView === '3-view' ? 0.56 : 0.75))) * 100}%`}
                            x2="100%"
                            y2={`${(i / Math.round(gridCount * (cameraView === '3-view' ? 0.56 : 0.75))) * 100}%`}
                            stroke={gridColor}
                            strokeWidth={gridThickness}
                          />
                        ))}
                      </svg>
                    )}
                  </div>

                  {/* Multi-angle label markers below image */}
                  {cameraView === '3-view' && (
                    <div className="w-full grid grid-cols-3 text-center py-2 text-xs font-extrabold uppercase tracking-widest text-stone-700 dark:text-stone-300 border-t border-stone-200 dark:border-white/10 mt-2 bg-stone-100/50 dark:bg-black/30 rounded-b-lg">
                      <span>FRONT VIEW</span>
                      <span>SIDE VIEW</span>
                      <span>BACK VIEW</span>
                    </div>
                  )}

                  {cameraView === '2-view' && (
                    <div className="w-full grid grid-cols-2 text-center py-2 text-xs font-extrabold uppercase tracking-widest text-stone-700 dark:text-stone-300 border-t border-stone-200 dark:border-white/10 mt-2 bg-stone-100/50 dark:bg-black/30 rounded-b-lg">
                      <span>FRONT VIEW</span>
                      <span>SIDE VIEW</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Empty Placeholder State */
                <div className="flex flex-col items-center justify-center p-8 text-center text-stone-400 dark:text-stone-600 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-stone-200/50 dark:bg-white/5 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 stroke-1" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-stone-700 dark:text-stone-300">
                      Belum Ada Karakter Sheet
                    </p>
                    <p className="text-xs text-stone-500 max-w-sm mt-1">
                      Unggah foto referensi orang di sebelah kiri, pilih mode Camera Views, lalu klik tombol <span className="font-semibold text-amber-500">Generate Karakter</span>.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Action Controls (Download + Grid, Ulang, Hapus) */}
            {generatedSheetUrl && (
              <div className="pt-3 mt-3 border-t border-stone-200 dark:border-white/10 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {/* Primary Download Button with Grid */}
                  <button
                    type="button"
                    onClick={() => handleDownloadSheet(isGridOn)}
                    disabled={isDownloading}
                    className="py-2.5 px-4 rounded-xl bg-lime-500 hover:bg-lime-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-stone-950" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>{isGridOn ? 'Download + Grid' : 'Download Bersih (HD)'}</span>
                  </button>

                  {/* Secondary Clean Download Option if Grid is active */}
                  {isGridOn && (
                    <button
                      type="button"
                      onClick={() => handleDownloadSheet(false)}
                      disabled={isDownloading}
                      className="py-2.5 px-3 rounded-xl bg-stone-200 dark:bg-white/10 hover:bg-stone-300 dark:hover:bg-white/15 text-stone-800 dark:text-stone-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      title="Download gambar asli tanpa garis grid"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Tanpa Grid</span>
                    </button>
                  )}
                </div>

                {/* Secondary Actions: Ulang & Hapus */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="py-2.5 px-3 rounded-xl bg-stone-200 dark:bg-white/10 hover:bg-stone-300 dark:hover:bg-white/15 text-stone-800 dark:text-stone-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>Ulang</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGeneratedSheetUrl(null)}
                    className="py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FULLSCREEN LIGHTBOX / ZOOM MODAL */}
      {isZoomOpen && generatedSheetUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 select-none animate-in fade-in duration-200"
          onClick={() => setIsZoomOpen(false)}
        >
          {/* Modal Header */}
          <div
            className="w-full max-w-6xl flex items-center justify-between py-2 px-4 mb-2 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-wide">Karakter Sheet (Full Preview)</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-extrabold uppercase">
                {currentAspectRatio}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsGridOn(!isGridOn)}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isGridOn ? 'bg-lime-500/30 text-lime-300 border border-lime-500/40' : 'bg-white/10 text-white'
                }`}
              >
                {isGridOn ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>Grid: {isGridOn ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadSheet(isGridOn)}
                className="py-1.5 px-3 rounded-lg bg-lime-500 hover:bg-lime-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh</span>
              </button>

              <button
                type="button"
                onClick={() => setIsZoomOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Image Display */}
          <div
            className="relative max-w-6xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={generatedSheetUrl}
              alt="Karakter Sheet Full"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl"
            />

            {isGridOn && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {Array.from({ length: gridCount }).map((_, i) => (
                  <line
                    key={`vz-${i}`}
                    x1={`${(i / gridCount) * 100}%`}
                    y1="0%"
                    x2={`${(i / gridCount) * 100}%`}
                    y2="100%"
                    stroke={gridColor}
                    strokeWidth={gridThickness}
                  />
                ))}
                {Array.from({ length: Math.round(gridCount * (cameraView === '3-view' ? 0.56 : cameraView === '2-view' ? 0.75 : 1)) }).map((_, i) => (
                  <line
                    key={`hz-${i}`}
                    x1="0%"
                    y1={`${(i / Math.round(gridCount * (cameraView === '3-view' ? 0.56 : 0.75))) * 100}%`}
                    x2="100%"
                    y2={`${(i / Math.round(gridCount * (cameraView === '3-view' ? 0.56 : 0.75))) * 100}%`}
                    stroke={gridColor}
                    strokeWidth={gridThickness}
                  />
                ))}
              </svg>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
