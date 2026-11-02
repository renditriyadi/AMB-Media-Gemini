import React, { useState } from 'react';
import {
  Video,
  Link as LinkIcon,
  Sparkles,
  Loader2,
  Monitor,
  Smartphone,
  Square,
  Bot,
  Package,
  User,
  Image as ImageIcon,
  FileText,
  Clock,
  Layers,
  SlidersHorizontal,
  Upload,
  X,
  Plus,
  ZoomIn
} from 'lucide-react';
import { StudioAspectRatio, StudioImageModel, StudioAiModel, StudioCustomAsset } from '../../types/studio';

export interface StudioAiModelOption {
  value: StudioAiModel;
  label: string;
  provider: 'Google' | 'Anthropic' | 'OpenAI' | 'Meta';
  badge?: string;
}

export const STUDIO_AI_MODELS: StudioAiModelOption[] = [
  // Google
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Cepat & Cerdas)', provider: 'Google', badge: 'Rekomendasi' },
  { value: 'google/gemini-3.6-flash', label: 'Gemini 3.6 Flash (Ultra Fast Multimodal)', provider: 'Google' },
  { value: 'google/gemini-3-pro', label: 'Gemini 3 Pro (Multimodal Flagship)', provider: 'Google' },
  { value: 'google/gemini-3.1-pro', label: 'Gemini 3.1 Pro (Reasoning Mendalam)', provider: 'Google' },
  { value: 'google/gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite (Super Kilat)', provider: 'Google' },
  { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (Hemat Token)', provider: 'Google' },

  // Anthropic
  { value: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5 (Storytelling & Visual Tajam)', provider: 'Anthropic' },
  { value: 'anthropic/claude-opus-5', label: 'Claude Opus 5 (Detail Kreatif Maksimal)', provider: 'Anthropic' },
  { value: 'anthropic/claude-haiku-4-5', label: 'Claude Haiku 4.5 (Respons Kilat)', provider: 'Anthropic' },
  { value: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6', provider: 'Anthropic' },

  // OpenAI
  { value: 'openai/gpt-4o', label: 'GPT-4o Omnichannel', provider: 'OpenAI' },
  { value: 'openai/gpt-4.1', label: 'GPT-4.1 Instruction Following', provider: 'OpenAI' },
  { value: 'openai/gpt-5.6-sol', label: 'GPT-5.6 Sol (Rich Detail Prompts)', provider: 'OpenAI' },
  { value: 'openai/gpt-5.6-terra', label: 'GPT-5.6 Terra (Grounded Scene Design)', provider: 'OpenAI' },
  { value: 'openai/gpt-5.6-luna', label: 'GPT-5.6 Luna (Lighting & Styling)', provider: 'OpenAI' },

  // Meta
  { value: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick (Frontier Open Reasoning)', provider: 'Meta' },
  { value: 'meta-llama/llama-4-scout', label: 'Llama 4 Scout (Expressive Scene Builder)', provider: 'Meta' },
];

interface Props {
  onAnalyze: (params: {
    videoUrl?: string;
    title?: string;
    rawPrompt?: string;
    productName?: string;
    productDescription?: string;
    productImage?: string;
    modelTalent?: string;
    modelImage?: string;
    backgroundSetting?: string;
    backgroundImage?: string;
    mainBrief?: string;
    totalDurationSec?: number;
    numScenes?: number;
    aspectRatio: StudioAspectRatio;
    imageModel: StudioImageModel;
    aiModel?: StudioAiModel;
    customAssets?: StudioCustomAsset[];
  }) => Promise<void>;
  isAnalyzing?: boolean;
  isLoading?: boolean;
  defaultAspectRatio?: StudioAspectRatio;
  defaultImageModel?: StudioImageModel;
  defaultAiModel?: StudioAiModel;
  aspectRatio?: StudioAspectRatio;
  setAspectRatio?: (ar: StudioAspectRatio) => void;
  imageModel?: StudioImageModel;
  setImageModel?: (m: StudioImageModel) => void;
  aiModel?: StudioAiModel;
  setAiModel?: (m: StudioAiModel) => void;
}

interface BriefImageUploaderProps {
  label: string;
  imageSrc?: string;
  onImageChange: (base64: string) => void;
  id: string;
  disabled?: boolean;
}

const BriefImageUploader: React.FC<BriefImageUploaderProps> = ({
  label,
  imageSrc,
  onImageChange,
  id,
  disabled
}) => {
  const [hovered, setHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onImageChange(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="relative shrink-0 w-24 sm:w-28 flex flex-col justify-start">
      <input
        type="file"
        id={id}
        accept="image/*"
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />
      {imageSrc ? (
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onMouseMove={handleMouseMove}
          className="relative group w-full h-24 sm:h-28 rounded-xl border border-stone-300 dark:border-white/10 hover:border-amber-500 overflow-hidden bg-stone-150 dark:bg-stone-900 shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-center"
        >
          <img
            src={imageSrc}
            alt={label}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1">
            <span className="text-[9px] font-bold text-amber-400 flex items-center gap-0.5 bg-stone-900/80 px-1 py-0.5 rounded">
              <ZoomIn className="w-2.5 h-2.5" /> Hover
            </span>
            <div className="flex gap-1">
              <label
                htmlFor={id}
                onClick={(e) => e.stopPropagation()}
                className="text-[9px] bg-amber-500 text-stone-950 px-1.5 py-0.5 rounded font-bold hover:bg-amber-400 cursor-pointer"
              >
                Ganti
              </label>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onImageChange('');
                }}
                className="text-[9px] bg-rose-600 text-white px-1.5 py-0.5 rounded font-semibold hover:bg-rose-500"
              >
                X
              </button>
            </div>
          </div>

          {/* Hover Floating Preview */}
          {hovered && (
            <div
              className="fixed z-[9999] pointer-events-none p-2 bg-stone-900/95 backdrop-blur-md border border-amber-500/40 rounded-2xl shadow-2xl transition-all duration-150 animate-in fade-in zoom-in-95"
              style={{
                top: Math.min(window.innerHeight - 280, Math.max(10, mousePos.y - 120)),
                left: Math.min(window.innerWidth - 280, mousePos.x + 20),
              }}
            >
              <div className="relative rounded-xl overflow-hidden border border-amber-500/20 w-52 h-52 bg-black">
                <img src={imageSrc} alt="Preview" className="w-full h-full object-contain" />
              </div>
              <p className="mt-1.5 text-center text-[10px] font-bold text-amber-400 flex items-center justify-center gap-1">
                <Sparkles className="w-3 h-3" /> Preview {label}
              </p>
            </div>
          )}
        </div>
      ) : (
        <label
          htmlFor={id}
          className="w-full h-24 sm:h-28 rounded-xl border border-dashed border-stone-300 dark:border-white/10 hover:border-amber-500/70 bg-stone-100/50 dark:bg-stone-900/30 hover:bg-amber-500/5 transition-all duration-200 flex flex-col items-center justify-center p-2 text-stone-400 hover:text-amber-500 cursor-pointer group"
        >
          <Upload className="w-4 h-4 mb-1 text-stone-400 group-hover:text-amber-500 transition-colors" />
          <span className="text-[10px] font-semibold text-stone-600 dark:text-stone-300 group-hover:text-amber-400 text-center leading-tight">
            Upload
          </span>
          <span className="text-[8px] text-stone-400 dark:text-stone-500 mt-0.5 text-center truncate w-full">{label}</span>
        </label>
      )}
    </div>
  );
};

export const StudioVideoIngestCard: React.FC<Props> = ({
  onAnalyze,
  isAnalyzing,
  isLoading,
  defaultAspectRatio = '9:16',
  defaultImageModel = 'GPT Image 2.5',
  defaultAiModel = 'google/gemini-2.5-flash',
  aspectRatio: controlledAspect,
  setAspectRatio: controlledSetAspect,
  imageModel: controlledModel,
  setImageModel: controlledSetModel,
  aiModel: controlledAiModel,
  setAiModel: controlledSetAiModel,
}) => {
  const [internalAspect, setInternalAspect] = useState<StudioAspectRatio>(defaultAspectRatio);
  const [internalModel, setInternalModel] = useState<StudioImageModel>(defaultImageModel);
  const [internalAiModel, setInternalAiModel] = useState<StudioAiModel>(defaultAiModel);

  const currentAspect = controlledAspect || internalAspect;
  const setAspect = controlledSetAspect || setInternalAspect;
  const currentModel = controlledModel || internalModel;
  const setModel = controlledSetModel || setInternalModel;
  const currentAiModel = controlledAiModel || internalAiModel;
  const setAiModelVal = controlledSetAiModel || setInternalAiModel;

  const busy = isAnalyzing || isLoading;

  const [activeTab, setActiveTab] = useState<'manual' | 'url'>('manual');
  const [videoUrl, setVideoUrl] = useState('https://vt.tiktok.com/ZSqg9mNDY/');

  // Detailed Brief & Visual Consistency State
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productImage, setProductImage] = useState('');

  const [modelTalent, setModelTalent] = useState('');
  const [modelImage, setModelImage] = useState('');

  const [backgroundSetting, setBackgroundSetting] = useState('');
  const [backgroundImage, setBackgroundImage] = useState('');

  const [customAssets, setCustomAssets] = useState<StudioCustomAsset[]>([]);

  const [mainBrief, setMainBrief] = useState('');
  const [totalDurationSec, setTotalDurationSec] = useState<number>(30);
  const [numScenes, setNumScenes] = useState<number>(6);

  const handleAddCustomAsset = () => {
    setCustomAssets((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: `Aset Lain #${prev.length + 1}`,
        textDescription: '',
        image: '',
      },
    ]);
  };

  const handleUpdateCustomAsset = (id: string, field: keyof StudioCustomAsset, value: string) => {
    setCustomAssets((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveCustomAsset = (id: string) => {
    setCustomAssets((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'url' && !videoUrl.trim()) return;
    if (activeTab === 'manual' && !productName.trim() && !mainBrief.trim() && !modelTalent.trim() && !productImage && !modelImage && !backgroundImage && customAssets.length === 0) return;

    onAnalyze({
      videoUrl: activeTab === 'url' ? videoUrl.trim() : undefined,
      title: productName.trim() || undefined,
      productName: productName.trim() || undefined,
      productDescription: productDescription.trim() || undefined,
      productImage: productImage || undefined,
      modelTalent: modelTalent.trim() || undefined,
      modelImage: modelImage || undefined,
      backgroundSetting: backgroundSetting.trim() || undefined,
      backgroundImage: backgroundImage || undefined,
      mainBrief: mainBrief.trim() || undefined,
      rawPrompt: mainBrief.trim() || undefined,
      totalDurationSec,
      numScenes,
      aspectRatio: currentAspect,
      imageModel: currentModel,
      aiModel: currentAiModel,
      customAssets: customAssets.length > 0 ? customAssets : undefined,
    });
  };

  return (
    <div id="studio-video-ingest" className="bg-[#FAF9F6] dark:bg-[#141418] border border-stone-300 dark:border-white/10 rounded-2xl p-4 sm:p-6 shadow-sm relative overflow-hidden transition-colors duration-200">
      {/* Subtle Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 sm:pb-5 border-b border-stone-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-stone-950 font-bold shadow-lg shadow-orange-500/20 shrink-0">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 font-serif-display">
              Studio Brief & Storyboard Generator
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                KONSISTENSI VISUAL AI
              </span>
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-sans-body">
              Input Produk, Model, Background, Gambar Referensi & Brief untuk menghasilkan storyboard konsisten
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-stone-200/80 dark:bg-[#1B1B22] p-1 rounded-xl border border-stone-300 dark:border-white/10 self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-amber-500 text-stone-950 shadow-sm font-bold'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Brief & Produk Manual
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'url'
                ? 'bg-amber-500 text-stone-950 shadow-sm font-bold'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            Link Video TikTok
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 sm:mt-5 space-y-4">
        {activeTab === 'manual' ? (
          <div className="space-y-4">
            {/* Grid for Produk, Model, Background */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 1. Produk */}
              <div className="space-y-2 bg-stone-100/70 dark:bg-[#1B1B22]/70 p-3 rounded-xl border border-stone-200 dark:border-white/5 flex flex-col justify-between">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-amber-500 shrink-0" />
                    1. Produk
                  </label>
                  
                  <div className="flex gap-3 items-start">
                    <BriefImageUploader
                      id="brief_product_img"
                      label="Produk"
                      imageSrc={productImage}
                      onImageChange={setProductImage}
                      disabled={busy}
                    />
                    <div className="flex-1 space-y-2 min-w-0">
                      <input
                        type="text"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        placeholder="Nama Produk (misal: Serum Brightening 30ml)"
                        disabled={busy}
                        className="w-full bg-white dark:bg-[#141418] border border-stone-300 dark:border-white/10 focus:border-amber-500 text-stone-900 dark:text-stone-100 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      />
                      <textarea
                        rows={2}
                        value={productDescription}
                        onChange={(e) => setProductDescription(e.target.value)}
                        placeholder="Detail fisik: Botol kaca amber pipet, cair keemasan, label gold..."
                        disabled={busy}
                        className="w-full bg-white dark:bg-[#141418] border border-stone-300 dark:border-white/10 focus:border-amber-500 text-stone-800 dark:text-stone-200 rounded-lg px-2.5 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500/50 placeholder:text-stone-400 resize-none h-[52px]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Model / Talent */}
              <div className="space-y-2 bg-stone-100/70 dark:bg-[#1B1B22]/70 p-3 rounded-xl border border-stone-200 dark:border-white/5 flex flex-col justify-between">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-amber-500 shrink-0" />
                    2. Model / Talent
                  </label>
                  
                  <div className="flex gap-3 items-start">
                    <BriefImageUploader
                      id="brief_model_img"
                      label="Model"
                      imageSrc={modelImage}
                      onImageChange={setModelImage}
                      disabled={busy}
                    />
                    <div className="flex-1 min-w-0">
                      <textarea
                        rows={3}
                        value={modelTalent}
                        onChange={(e) => setModelTalent(e.target.value)}
                        placeholder="Ciri model: Wanita Asia 22 tahun, rambut sebahu, kulit glowing, baju casual..."
                        disabled={busy}
                        className="w-full bg-white dark:bg-[#141418] border border-stone-300 dark:border-white/10 focus:border-amber-500 text-stone-900 dark:text-stone-100 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none h-[78px]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Background / Setting */}
              <div className="space-y-2 bg-stone-100/70 dark:bg-[#1B1B22]/70 p-3 rounded-xl border border-stone-200 dark:border-white/5 flex flex-col justify-between">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-amber-500 shrink-0" />
                    3. Background / Latar Tempat
                  </label>
                  
                  <div className="flex gap-3 items-start">
                    <BriefImageUploader
                      id="brief_bg_img"
                      label="Background"
                      imageSrc={backgroundImage}
                      onImageChange={setBackgroundImage}
                      disabled={busy}
                    />
                    <div className="flex-1 min-w-0">
                      <textarea
                        rows={3}
                        value={backgroundSetting}
                        onChange={(e) => setBackgroundSetting(e.target.value)}
                        placeholder="Suasana tempat: Kamar mandi estetik serba putih minimalis, cermin LED..."
                        disabled={busy}
                        className="w-full bg-white dark:bg-[#141418] border border-stone-300 dark:border-white/10 focus:border-amber-500 text-stone-900 dark:text-stone-100 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none h-[78px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Assets Section (Other) */}
            {customAssets.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Aset Referensi Tambahan (Other)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {customAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="bg-stone-100/70 dark:bg-[#1B1B22]/70 p-3 rounded-xl border border-stone-200 dark:border-white/5 relative group space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={asset.title}
                          onChange={(e) => handleUpdateCustomAsset(asset.id, 'title', e.target.value)}
                          disabled={busy}
                          placeholder="Nama Aset (misal: Aksesoris)"
                          className="bg-transparent text-xs font-bold text-amber-600 dark:text-amber-400 border-b border-dashed border-stone-300 dark:border-white/10 focus:border-amber-500 focus:outline-none py-0.5 px-1 max-w-[180px] truncate"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomAsset(asset.id)}
                          className="text-[10px] text-red-500 hover:text-red-600 font-semibold flex items-center gap-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" /> Hapus
                        </button>
                      </div>

                      <div className="flex gap-3 items-start">
                        <BriefImageUploader
                          id={`custom_asset_${asset.id}`}
                          label={asset.title}
                          imageSrc={asset.image}
                          onImageChange={(val) => handleUpdateCustomAsset(asset.id, 'image', val)}
                          disabled={busy}
                        />
                        <div className="flex-1 min-w-0">
                          <textarea
                            rows={3}
                            value={asset.textDescription}
                            onChange={(e) => handleUpdateCustomAsset(asset.id, 'textDescription', e.target.value)}
                            placeholder="Deskripsi detail aset tambahan (misal: Cangkir marmer, busana kemeja, dll...)"
                            disabled={busy}
                            className="w-full bg-white dark:bg-[#141418] border border-stone-300 dark:border-white/10 focus:border-amber-500 text-stone-900 dark:text-stone-100 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none h-[78px]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Other Asset Button */}
            <div className="pt-1 flex justify-start">
              <button
                type="button"
                onClick={handleAddCustomAsset}
                disabled={busy}
                className="bg-amber-500/10 hover:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:border-amber-500/50 rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Tambah Referensi / Aset Lain (Other)</span>
              </button>
            </div>

            {/* Main Brief & Duration / Scene Count row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Main Brief */}
              <div className="md:col-span-2 bg-stone-100/70 dark:bg-[#1B1B22]/70 p-3 rounded-xl border border-stone-200 dark:border-white/5 space-y-2">
                <label className="block text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                  4. Main Brief & Arahan Alur Cerita
                </label>
                <textarea
                  rows={3}
                  value={mainBrief}
                  onChange={(e) => setMainBrief(e.target.value)}
                  placeholder="Instruksi alur: Hook kulit kusam -> Solusi 3 tetes serum -> Tunjukkan tekstur di pipi -> Hasil glowing instan -> Call to Action keranjang kuning!"
                  disabled={busy}
                  className="w-full bg-white dark:bg-[#141418] border border-stone-300 dark:border-white/10 focus:border-amber-500 text-stone-900 dark:text-stone-100 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
                />
              </div>

              {/* Durasi & Jumlah Scene */}
              <div className="bg-stone-100/70 dark:bg-[#1B1B22]/70 p-3 rounded-xl border border-stone-200 dark:border-white/5 space-y-2.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-800 dark:text-stone-200 mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    Total Durasi Video
                  </label>
                  <select
                    value={totalDurationSec}
                    onChange={(e) => setTotalDurationSec(Number(e.target.value))}
                    disabled={busy}
                    className="w-full bg-white dark:bg-[#141418] text-stone-900 dark:text-stone-100 text-xs font-medium rounded-lg px-2.5 py-1.5 border border-stone-300 dark:border-white/10 focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value={15}>15 Detik (TikTok Short)</option>
                    <option value={30}>30 Detik (Standard Commercial)</option>
                    <option value={45}>45 Detik (Deep Review)</option>
                    <option value={60}>60 Detik (Full Storytelling)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-800 dark:text-stone-200 mb-1 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    Jumlah Scene Breakdown
                  </label>
                  <select
                    value={numScenes}
                    onChange={(e) => setNumScenes(Number(e.target.value))}
                    disabled={busy}
                    className="w-full bg-white dark:bg-[#141418] text-stone-900 dark:text-stone-100 text-xs font-medium rounded-lg px-2.5 py-1.5 border border-stone-300 dark:border-white/10 focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value={3}>3 Scene ({Math.round(totalDurationSec / 3)}s / scene)</option>
                    <option value={4}>4 Scene ({Math.round(totalDurationSec / 4)}s / scene)</option>
                    <option value={5}>5 Scene ({Math.round(totalDurationSec / 5)}s / scene)</option>
                    <option value={6}>6 Scene ({Math.round(totalDurationSec / 6)}s / scene)</option>
                    <option value={8}>8 Scene ({Math.round(totalDurationSec / 8)}s / scene)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              URL Video TikTok / Reels / Shorts
            </label>
            <div className="relative">
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Contoh: https://vt.tiktok.com/ZSqg9mNDY/ atau https://www.tiktok.com/@creator/video/..."
                disabled={busy}
                className="w-full bg-white dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 focus:border-amber-500 text-stone-900 dark:text-stone-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all placeholder:text-stone-400 dark:placeholder:text-stone-500 disabled:opacity-50"
              />
              {videoUrl && (
                <button
                  type="button"
                  onClick={() => setVideoUrl('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 px-1.5 py-0.5 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1.5 flex items-center gap-1">
              <span>💡</span> Mendukung link pendek TikTok (<code className="text-amber-600 dark:text-amber-400 font-mono">vt.tiktok.com</code>), video web publik, atau reels.
            </p>
          </div>
        )}

        {/* Configuration Toolbar with AI Model Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* AI LLM Model Selection */}
          <div className="bg-stone-100 dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 p-2.5 rounded-xl flex flex-col justify-between">
            <span className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1">
              <Bot className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              Model AI Analisis
            </span>
            <select
              value={currentAiModel}
              onChange={(e) => setAiModelVal(e.target.value as StudioAiModel)}
              disabled={busy}
              className="w-full bg-white dark:bg-[#141418] text-stone-900 dark:text-stone-100 text-xs font-medium rounded-lg px-2.5 py-1.5 border border-stone-300 dark:border-white/10 focus:border-amber-500 focus:outline-none cursor-pointer"
            >
              {(['Google', 'Anthropic', 'OpenAI', 'Meta'] as const).map((prov) => (
                <optgroup key={prov} label={`Model ${prov} (Weavy)`}>
                  {STUDIO_AI_MODELS.filter((m) => m.provider === prov).map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Image Model */}
          <div className="bg-stone-100 dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 p-2.5 rounded-xl flex flex-col justify-between">
            <span className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              Model Gambar Weavy
            </span>
            <select
              value={currentModel}
              onChange={(e) => setModel(e.target.value as StudioImageModel)}
              disabled={busy}
              className="w-full bg-white dark:bg-[#141418] text-stone-900 dark:text-stone-100 text-xs font-medium rounded-lg px-2.5 py-1.5 border border-stone-300 dark:border-white/10 focus:border-amber-500 focus:outline-none cursor-pointer"
            >
              <option value="ChatGPT Images 2.0 Edit">ChatGPT Images 2.0 Edit / GPT Image 2.0 (11 CR)</option>
              <option value="GPT Image 2.5">GPT Image 2.5 (Super High Quality - 4 CR)</option>
              <option value="Seedream V5.0 Pro Edit">Seedream V5.0 Pro Edit (12 CR)</option>
              <option value="Nano Banana Pro">Nano Banana Pro (11 CR)</option>
              <option value="Grok Imagine Image">Grok Imagine Image (4 CR)</option>
            </select>
          </div>

          {/* Aspect Ratio */}
          <div className="bg-stone-100 dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 p-2.5 rounded-xl flex flex-col justify-between">
            <span className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              Rasio Visual
            </span>
            <div className="grid grid-cols-3 gap-1">
              {[
                { label: '9:16', val: '9:16' as StudioAspectRatio, icon: Smartphone },
                { label: '16:9', val: '16:9' as StudioAspectRatio, icon: Monitor },
                { label: '1:1', val: '1:1' as StudioAspectRatio, icon: Square },
              ].map((r) => (
                <button
                  key={r.val}
                  type="button"
                  onClick={() => setAspect(r.val)}
                  disabled={busy}
                  className={`py-1 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    currentAspect === r.val
                      ? 'bg-amber-500 text-stone-950 shadow-sm font-bold'
                      : 'bg-stone-200 dark:bg-[#141418] text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white border border-stone-300/60 dark:border-white/5'
                  }`}
                >
                  <r.icon className="w-3 h-3" />
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Scene Info & Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              {activeTab === 'manual'
                ? `Merancang ${numScenes} scene konsisten (${totalDurationSec} detik total durasi)`
                : 'Jumlah scene ditentukan otomatis sesuai alur video'}
            </span>
          </div>

          <button
            type="submit"
            disabled={
              busy ||
              (activeTab === 'url' && !videoUrl.trim()) ||
              (activeTab === 'manual' && !productName.trim() && !mainBrief.trim() && !modelTalent.trim() && !productImage && !modelImage && !backgroundImage)
            }
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-stone-950 font-bold text-sm shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95 shrink-0"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Merancang Storyboard Konsisten...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 fill-current" />
                Mulai Buat Storyboard Konsisten
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
