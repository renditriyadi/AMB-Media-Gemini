import React, { useState, useRef } from 'react';
import {
  UserCheck,
  Sparkles,
  Image as ImageIcon,
  Upload,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Wand2,
  Camera,
  Box,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  ZoomIn,
  X,
  Download
} from 'lucide-react';
import {
  TalentGender,
  TalentShotType,
  TalentAgeRange,
  TalentEthnicity
} from '../../types/studio';
import { uploadMediaWithProgress, downloadMediaFile } from '../../utils';
import {
  generateStudioCustomImage,
  getActiveWeavyAccount,
  getAllWeavyAccounts
} from '../../lib/studioService';

interface Props {
  activeAccountId?: string;
  onSendToCanvas?: (imageUrls: string[]) => void;
  onSuccessToast?: (msg: string) => void;
}

interface UploadSlotState {
  id: string;
  type: 'product' | 'character';
  previewUrl: string;
  status: 'uploading' | 'success';
  progress: number;
}

const ETHNICITIES: { id: TalentEthnicity; label: string; flag: string; promptDesc: string }[] = [
  {
    id: 'indonesian-local',
    label: 'Indonesia (Lokal)',
    flag: '🇮🇩',
    promptDesc: 'authentic Indonesian Southeast Asian descent, natural warm sun-kissed Indonesian facial features, relatable and charming Indonesian aesthetic'
  },
  {
    id: 'east-asian',
    label: 'Asia Timur (Korea/Jepang)',
    flag: '🇰🇷',
    promptDesc: 'modern East Asian aesthetic, glowing glass skin, contemporary K-drama/Tokyo style elegance'
  },
  {
    id: 'southeast-asian',
    label: 'Asia Tenggara',
    flag: '🌏',
    promptDesc: 'warm Southeast Asian features, youthful vibrant look, friendly natural charisma'
  },
  {
    id: 'caucasian',
    label: 'Kaukasia / Barat',
    flag: '🇺🇸',
    promptDesc: 'striking Caucasian features, editorial fashion model aesthetic, high fashion composure'
  },
  {
    id: 'middle-eastern',
    label: 'Timur Tengah',
    flag: '🇦🇪',
    promptDesc: 'refined Middle Eastern descent, expressive deep eyes, elegant regal presence, warm olive undertone'
  },
  {
    id: 'south-asian',
    label: 'Asia Selatan',
    flag: '🇮🇳',
    promptDesc: 'warm South Asian features, expressive bright eyes, elegant modern posture'
  },
  {
    id: 'african-descent',
    label: 'Afro / Kulit Eksotis',
    flag: '🌍',
    promptDesc: 'striking African descent, rich radiant melanin skin tone, sharp chiseled editorial facial features'
  },
  {
    id: 'latino-hispanic',
    label: 'Latino / Hispanik',
    flag: '🇲🇽',
    promptDesc: 'warm Latino/Hispanic heritage, vibrant lively demeanor, cinematic charm'
  }
];

const AGE_GROUPS: { id: TalentAgeRange; label: string; ageRange: string; promptDesc: string }[] = [
  { id: 'teen', label: 'Remaja', ageRange: '17 - 21 Tahun', promptDesc: '18-20 years old, youthful gen-z energy, fresh energetic look' },
  { id: 'young-adult', label: 'Dewasa Muda', ageRange: '22 - 32 Tahun', promptDesc: '24-28 years old, fresh professional adult, radiant and confident' },
  { id: 'mature-adult', label: 'Dewasa Matang', ageRange: '33 - 48 Tahun', promptDesc: '35-42 years old, mature credible professional, sophisticated demeanor' },
  { id: 'senior', label: 'Senior / Elegan', ageRange: '50+ Tahun', promptDesc: '55+ years old, distinguished dignified senior, warm graceful charisma' }
];

const SHOT_TYPES: { id: TalentShotType; label: string; sub: string; promptDesc: string }[] = [
  { id: 'half-body', label: 'Setengah Badan (Half Body)', sub: 'Pinggang ke atas, fokus tangan & produk', promptDesc: 'medium shot from the waist up, crystal clear hands and facial expression' },
  { id: 'full-body', label: 'Seluruh Badan (Full Body)', sub: 'Kepala hingga kaki, gaya & fashion', promptDesc: 'full body editorial shot, head to toe visible, stylish footwear and posture, confident stance' },
  { id: 'portrait-closeup', label: 'Close-Up / Portrait', sub: 'Fokus wajah, kecantikan & aksesoris', promptDesc: 'close-up beauty portrait shot, extreme attention to flawless skin texture, focused expression and shoulder level product presentation' }
];

const PRODUCT_INTERACTIONS = [
  { id: 'holding-product', label: 'Memegang Produk', desc: 'Tangan dengan anggun memegang produk menghadap kamera' },
  { id: 'wearing-product', label: 'Memakai / Menggunakan Produk', desc: 'Sedang memakai produk (pakaian, skincare, gadget, aksesoris)' },
  { id: 'pointing-at-product', label: 'Menunjuk Produk (UGC Endorsement)', desc: 'Tersenyum ramah sembari menunjukkan produk di dekatnya' },
  { id: 'standing-beside-product', label: 'Berdiri di Dekat Produk', desc: 'Pose elegan berdampingan dengan produk di studio katalog' },
];

const ENVIRONMENTS = [
  { id: 'minimal-studio', label: 'Studio Minimalis Mewah', prompt: 'clean minimalist photo studio backdrop with subtle softbox gradient lighting and gentle shadows' },
  { id: 'modern-home', label: 'Interior Rumah Modern', prompt: 'bright modern cozy scandinavian living room, natural warm window sunlight, aesthetic interior' },
  { id: 'trendy-cafe', label: 'Kafe Estetik Kekinian', prompt: 'chic aesthetic modern cafe interior, bokeh coffee shop ambiance, warm gentle natural light' },
  { id: 'outdoor-urban', label: 'Outdoor Perkotaan Elegan', prompt: 'bright sunny modern outdoor city boulevard, clean architectural glass building blur background' },
  { id: 'commercial-white', label: 'Pure White E-Commerce', prompt: 'high-end commercial clean isolated pure bright studio lighting, commercial catalogue standard' }
];

const WEAVY_IMAGE_MODELS = [
  {
    id: 'ChatGPT Images 2.0 Edit',
    name: 'ChatGPT Images 2.0 Edit',
    cost: 11,
    provider: 'OpenAI',
    description: 'High Consistency Model & Product Interaction (11 Kredit)',
  },
  {
    id: 'GPT Image 2.5',
    name: 'GPT Image 2.5',
    cost: 4,
    provider: 'Weavy Flare',
    description: 'High Quality Commercial Photorealistic (4 Kredit)',
  },
  {
    id: 'Seedream V5.0 Pro Edit',
    name: 'Seedream V5.0 Pro Edit',
    cost: 12,
    provider: 'Seedream',
    description: 'Ultra Detail & Product Integrity Focus (12 Kredit)',
  },
  {
    id: 'Nano Banana Pro',
    name: 'Nano Banana Pro',
    cost: 11,
    provider: 'Nano Banana',
    description: 'Vibrant Colors & Fast Commercial Render (11 Kredit)',
  },
  {
    id: 'Grok Imagine Image',
    name: 'Grok Imagine Image',
    cost: 4,
    provider: 'Grok Imagine',
    description: 'Clean Studio Lighting & Natural Look (4 Kredit)',
  },
];

export const StudioTalentCard: React.FC<Props> = ({
  onSendToCanvas,
  onSuccessToast
}) => {
  // State
  const [gender, setGender] = useState<TalentGender>('female');
  const [ethnicity, setEthnicity] = useState<TalentEthnicity>('indonesian-local');
  const [ageGroup, setAgeGroup] = useState<TalentAgeRange>('young-adult');
  const [shotType, setShotType] = useState<TalentShotType>('half-body');
  const [interaction, setInteraction] = useState<string>('holding-product');
  const [environment, setEnvironment] = useState<string>('minimal-studio');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [selectedModel, setSelectedModel] = useState<string>('GPT Image 2.5');
  
  // Text inputs
  const [mainBrief, setMainBrief] = useState<string>('Mempromosikan produk minuman botol dingin dengan ekspresi segar dan ceria');
  const [clothing, setClothing] = useState<string>('Casual chic, kaos katun krem polos atau kemeja linen santai');
  const [expression, setExpression] = useState<string>('Senyum ceria, ramah, mata berbinar ramah menghadap kamera');
  
  // Images
  const [productImages, setProductImages] = useState<string[]>([]);
  const [characterRefImages, setCharacterRefImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingSlots, setUploadingSlots] = useState<UploadSlotState[]>([]);
  
  // Prompt & Generation
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const productInputRef = useRef<HTMLInputElement>(null);
  const charInputRef = useRef<HTMLInputElement>(null);

  // Direct Universal File Download Handler
  const handleDownloadTalentImage = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!generatedImageUrl) return;

    setIsDownloading(true);
    try {
      const cleanModelName = (selectedModel || 'GPT_Image_2_5').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `AI_Talent_${cleanModelName}_${Date.now()}`;
      const success = await downloadMediaFile(generatedImageUrl, filename, 'image', selectedModel);
      if (success && onSuccessToast) {
        onSuccessToast('Gambar AI Talent berhasil diunduh ke perangkat Anda!');
      }
    } catch (err: any) {
      console.error('Download talent image error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Function to compile structured prompt
  const handleBuildPrompt = () => {
    setIsGeneratingPrompt(true);
    
    const ethObj = ETHNICITIES.find((e) => e.id === ethnicity);
    const ageObj = AGE_GROUPS.find((a) => a.id === ageGroup);
    const shotObj = SHOT_TYPES.find((s) => s.id === shotType);
    const envObj = ENVIRONMENTS.find((en) => en.id === environment);
    
    const genderLabel = gender === 'female' ? 'young attractive female model' : gender === 'male' ? 'young attractive male model' : 'stylish model';
    
    let interactionDesc = '';
    if (interaction === 'holding-product') {
      interactionDesc = 'naturally holding the featured product in hand towards the camera, pristine hand anatomy with 5 fingers perfectly rendered, delicate grip showcasing product label clearly';
    } else if (interaction === 'wearing-product') {
      interactionDesc = 'effortlessly wearing/using the featured product, showcasing its premium material and fit, authentic lifestyle look';
    } else if (interaction === 'pointing-at-product') {
      interactionDesc = 'enthusiastically presenting and gently gesturing towards the product placed nearby, friendly UGC content creator review style';
    } else {
      interactionDesc = 'elegantly posing alongside the featured product placed on a sleek studio pedestal, commercial catalogue composition';
    }

    const promptParts = [
      `Masterpiece high-end commercial photograph of a ${genderLabel}.`,
      `[MODEL DEMOGRAPHICS]: ${ethObj?.promptDesc}, ${ageObj?.promptDesc}.`,
      `[SHOT COMPOSITION & FRAMING]: ${shotObj?.promptDesc}, aspect ratio ${aspectRatio}.`,
      `[ACTION & PRODUCT INTERACTION]: ${interactionDesc}.`,
      mainBrief ? `[PRIMARY BRIEF / NARRATIVE]: ${mainBrief}.` : '',
      clothing ? `[WARDROBE & STYLING]: dressed in ${clothing}, natural fabric creases and textures.` : '',
      expression ? `[FACIAL EXPRESSION]: ${expression}, realistic eye contact with camera lens.` : '',
      `[ENVIRONMENT & LIGHTING]: ${envObj?.prompt || 'professional studio lighting'}, soft natural rim lighting, 8k resolution, photorealistic Hasselblad camera quality, f/2.8 depth of field.`,
      productImages.length > 0 ? `[CRITICAL PRODUCT CONTINUITY]: Accurately replicate the exact appearance, logo, color, shape, and branding of the reference product image provided.` : '',
      characterRefImages.length > 0 ? `[CHARACTER FACE CONTINUITY]: Maintain consistent facial structure, haircut, and identity from the reference talent portrait provided.` : '',
      `[QUALITY BENCHMARK]: Ultra-realistic human skin pores, no plastic artificial skin, anatomically accurate hands and fingers, flawless cinematic color grading.`
    ].filter(Boolean);

    const result = promptParts.join('\n');
    setGeneratedPrompt(result);
    setIsGeneratingPrompt(false);
    if (onSuccessToast) onSuccessToast('Prompt AI Talent berhasil disusun!');
  };

  // Copy prompt
  const handleCopyPrompt = async () => {
    if (!generatedPrompt) return;
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
      if (onSuccessToast) onSuccessToast('Prompt berhasil disalin ke clipboard!');
    } catch (e) {
      console.error(e);
    }
  };

  // Handle File Uploads (Product or Character) with Weavy Sync & Visual Feedback
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>, type: 'product' | 'character') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentCount = type === 'product' ? productImages.length : characterRefImages.length;
    const currentUploadingCount = uploadingSlots.filter((s) => s.type === type).length;
    const availableSlots = Math.max(0, 4 - (currentCount + currentUploadingCount));
    const filesToProcess: File[] = Array.from(files).slice(0, availableSlots) as File[];

    if (filesToProcess.length === 0) {
      if (e.target) e.target.value = '';
      return;
    }

    // 1. Instantly register uploading slots with local object URLs for immediate preview
    const newSlots: UploadSlotState[] = filesToProcess.map((file, idx) => ({
      id: `slot_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      previewUrl: URL.createObjectURL(file),
      status: 'uploading',
      progress: 10,
    }));

    setUploadingSlots((prev) => [...prev, ...newSlots]);
    setIsUploading(true);

    const activeAcc = getActiveWeavyAccount();
    const allTokens = getAllWeavyAccounts().map((a) => a.refreshToken).filter(Boolean);

    let addedCount = 0;

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const slot = newSlots[i];

      try {
        let finalUrl = '';

        // Attempt upload to Weavy asset store via /api/upload-media
        try {
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
            onProgress: (percent) => {
              setUploadingSlots((prev) =>
                prev.map((s) => (s.id === slot.id ? { ...s, progress: Math.max(s.progress, percent) } : s))
              );
            },
          });

          if (uploadRes && uploadRes.success && uploadRes.url) {
            finalUrl = uploadRes.url;
          }
        } catch (uploadErr) {
          console.warn('[Weavy Upload asset fallback to base64]:', uploadErr);
        }

        // Fallback to FileReader Base64 data URL so image is 100% visible & functional
        if (!finalUrl) {
          finalUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }

        if (finalUrl) {
          // Add to state immediately
          if (type === 'product') {
            setProductImages((prev) => [...prev, finalUrl].slice(0, 4));
          } else {
            setCharacterRefImages((prev) => [...prev, finalUrl].slice(0, 4));
          }
          addedCount++;

          // Transition slot to 'success' (shows green checkmark / "cek lish" briefly)
          setUploadingSlots((prev) =>
            prev.map((s) => (s.id === slot.id ? { ...s, status: 'success', progress: 100 } : s))
          );

          // Brief delay (1.2s) for checkmark animation, then smoothly remove slot so the clean image is displayed
          setTimeout(() => {
            setUploadingSlots((prev) => prev.filter((s) => s.id !== slot.id));
          }, 1200);
        } else {
          setUploadingSlots((prev) => prev.filter((s) => s.id !== slot.id));
        }
      } catch (err: any) {
        console.error('Upload processing error:', err);
        setUploadingSlots((prev) => prev.filter((s) => s.id !== slot.id));
      }
    }

    setIsUploading(false);
    if (addedCount > 0 && onSuccessToast) {
      onSuccessToast(`Berhasil menambahkan gambar ${type === 'product' ? 'produk' : 'karakter'}!`);
    }
    if (e.target) e.target.value = '';
  };

  // Quick Direct Generation via active Weavy Engine
  const handleGenerateTalentImage = async () => {
    let promptToUse = generatedPrompt;
    if (!promptToUse) {
      handleBuildPrompt();
      const ethObj = ETHNICITIES.find((e) => e.id === ethnicity);
      const ageObj = AGE_GROUPS.find((a) => a.id === ageGroup);
      const shotObj = SHOT_TYPES.find((s) => s.id === shotType);
      const genderLabel = gender === 'female' ? 'female model' : 'male model';
      promptToUse = `Masterpiece commercial photograph of a ${genderLabel}, ${ethObj?.promptDesc}, ${ageObj?.promptDesc}, ${shotObj?.promptDesc}, ${mainBrief}`;
    }
    
    setIsGeneratingImage(true);
    setGenError(null);

    try {
      const refImages = [...productImages, ...characterRefImages];
      
      const resUrl = await generateStudioCustomImage({
        prompt: promptToUse,
        aspectRatio: aspectRatio,
        modelName: selectedModel,
        referenceImages: refImages,
      });

      if (resUrl) {
        setGeneratedImageUrl(resUrl);
        if (onSuccessToast) onSuccessToast('Foto AI Talent berhasil dibuat!');
      } else {
        throw new Error('Tidak menerima URL gambar dari engine generator.');
      }
    } catch (err: any) {
      console.error('[Generate Talent Error]:', err);
      setGenError(err.message || 'Gagal menghasilkan gambar AI Talent.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col lg:flex-row overflow-hidden bg-[#FAF9F6] dark:bg-[#09090B]">
      {/* LEFT COLUMN: Controls & Parameters */}
      <div className="w-full lg:w-[58%] h-full overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-6 border-b lg:border-b-0 lg:border-r border-stone-300/80 dark:border-white/8">
        {/* Intro Header */}
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent p-4 rounded-2xl border border-amber-500/20">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-sm">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 font-serif-display">
                  AI Talent Studio
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold uppercase">
                  Virtual Model & Product Actor
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Buat karakter model AI realistis untuk memegang produk, promosi endorsement, fashion, atau katalog komersial.
              </p>
            </div>
          </div>
        </div>

        {/* 1. ASAL DAERAH / ETNISITAS */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center text-[10px] font-extrabold">1</span>
            <span>Orang Asal Daerah / Etnisitas Model</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ETHNICITIES.map((eth) => {
              const isSelected = ethnicity === eth.id;
              return (
                <button
                  key={eth.id}
                  type="button"
                  onClick={() => setEthnicity(eth.id)}
                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500/60 shadow-sm text-amber-950 dark:text-amber-200 font-bold ring-1 ring-amber-500/40'
                      : 'bg-stone-100/80 dark:bg-[#141418] border-stone-300/80 dark:border-white/10 text-stone-700 dark:text-stone-300 hover:border-stone-400 dark:hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between text-base mb-1">
                    <span>{eth.flag}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                  </div>
                  <span className="text-xs truncate">{eth.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. GENDER & RENTANG USIA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Gender */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center text-[10px] font-extrabold">2</span>
              <span>Gender Model</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGender('female')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  gender === 'female'
                    ? 'bg-amber-500/15 border-amber-500/60 text-amber-900 dark:text-amber-200 font-bold'
                    : 'bg-stone-100/80 dark:bg-[#141418] border-stone-300/80 dark:border-white/10 text-stone-700 dark:text-stone-300'
                }`}
              >
                <span>👩 Wanita (Female)</span>
              </button>
              <button
                type="button"
                onClick={() => setGender('male')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  gender === 'male'
                    ? 'bg-amber-500/15 border-amber-500/60 text-amber-900 dark:text-amber-200 font-bold'
                    : 'bg-stone-100/80 dark:bg-[#141418] border-stone-300/80 dark:border-white/10 text-stone-700 dark:text-stone-300'
                }`}
              >
                <span>👨 Pria (Male)</span>
              </button>
            </div>
          </div>

          {/* Usia */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center text-[10px] font-extrabold">3</span>
              <span>Rentang Usia</span>
            </label>
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value as TalentAgeRange)}
              className="w-full py-2 px-3 rounded-xl border border-stone-300/80 dark:border-white/10 bg-stone-100/80 dark:bg-[#141418] text-xs font-semibold text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              {AGE_GROUPS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} ({a.ageRange})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. FRAMING & POSE (FULL BODY / SETENGAH BADAN) */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center text-[10px] font-extrabold">4</span>
            <span>Tipe Pose & Framing Kamera</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {SHOT_TYPES.map((st) => {
              const isSelected = shotType === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setShotType(st.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500/60 shadow-sm text-amber-950 dark:text-amber-200 ring-1 ring-amber-500/40'
                      : 'bg-stone-100/80 dark:bg-[#141418] border-stone-300/80 dark:border-white/10 text-stone-700 dark:text-stone-300 hover:border-stone-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">{st.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                  </div>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400 leading-snug">{st.sub}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. INTERAKSI DENGAN PRODUK */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center text-[10px] font-extrabold">5</span>
            <span>Interaksi & Hubungan dengan Produk</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRODUCT_INTERACTIONS.map((pi) => {
              const isSelected = interaction === pi.id;
              return (
                <button
                  key={pi.id}
                  type="button"
                  onClick={() => setInteraction(pi.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500/60 shadow-sm text-amber-950 dark:text-amber-200 ring-1 ring-amber-500/40'
                      : 'bg-stone-100/80 dark:bg-[#141418] border-stone-300/80 dark:border-white/10 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <span className="text-xs font-bold block mb-0.5">{pi.label}</span>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 block">{pi.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. UPLOAD GAMBAR REFERENSI PRODUK / KARAKTER */}
        <div className="p-4 rounded-2xl bg-stone-200/50 dark:bg-[#141418] border border-stone-300 dark:border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-2">
              <Box className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Input Gambar Produk (Wajib untuk Produk yang Dipegang / Dipakai)</span>
            </label>
            <span className="text-[10px] text-stone-500">Maksimal 4 gambar</span>
          </div>

          {/* Upload Box for Product */}
          <div className="flex flex-wrap gap-2.5 items-center">
            {/* Finalized Product Images */}
            {productImages.map((url, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-amber-500/50 group shadow-sm bg-stone-900">
                <img src={url} alt="Product" className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
                <button
                  type="button"
                  onClick={() => setProductImages(productImages.filter((_, i) => i !== idx))}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-400 transition-opacity cursor-pointer z-10"
                  title="Hapus Gambar Produk"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <span className="absolute bottom-0.5 left-0.5 px-1 bg-black/80 text-[9px] font-mono text-amber-300 rounded z-10">
                  Produk #{idx + 1}
                </span>
              </div>
            ))}

            {/* Uploading Slots (Spinner / Checkmark) */}
            {uploadingSlots
              .filter((s) => s.type === 'product')
              .map((slot) => (
                <div
                  key={slot.id}
                  className={`relative w-20 h-20 rounded-xl overflow-hidden border shadow-xs flex flex-col items-center justify-center transition-all duration-200 ${
                    slot.status === 'success'
                      ? 'border-emerald-500 bg-emerald-950/40 ring-2 ring-emerald-500/40'
                      : 'border-amber-500/60 bg-stone-900 ring-1 ring-amber-500/30'
                  }`}
                >
                  {slot.previewUrl && (
                    <img
                      src={slot.previewUrl}
                      alt="Uploading preview"
                      className="absolute inset-0 w-full h-full object-cover opacity-35 blur-[0.5px]"
                    />
                  )}
                  <div className="relative z-10 flex flex-col items-center justify-center p-1 text-center">
                    {slot.status === 'uploading' ? (
                      <>
                        <RefreshCw className="w-5 h-5 text-amber-400 animate-spin mb-1" />
                        <span className="text-[9px] font-bold text-amber-200 leading-tight">
                          {slot.progress > 10 ? `${slot.progress}%` : 'Upload...'}
                        </span>
                        <span className="text-[8px] text-amber-300/80 leading-none mt-0.5">Weavy AI</span>
                      </>
                    ) : (
                      <>
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 mb-0.5">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                        <span className="text-[9px] font-bold text-emerald-300 leading-none">Siap</span>
                      </>
                    )}
                  </div>
                </div>
              ))}

            {/* Add Product Button */}
            {productImages.length + uploadingSlots.filter((s) => s.type === 'product').length < 4 && (
              <button
                type="button"
                onClick={() => productInputRef.current?.click()}
                disabled={isUploading}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-stone-300 dark:border-white/15 hover:border-amber-500 flex flex-col items-center justify-center gap-1 text-stone-500 hover:text-amber-600 transition-all cursor-pointer bg-white/40 dark:bg-white/[0.02]"
              >
                <Upload className="w-4 h-4" />
                <span className="text-[10px] font-medium">+ Produk</span>
              </button>
            )}
            <input
              ref={productInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleUploadFile(e, 'product')}
            />
          </div>

          {/* Referensi Karakter Opsional */}
          <div className="pt-2 border-t border-stone-300/60 dark:border-white/8">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-sky-500" />
                <span>Referensi Wajah / Karakter Khusus (Opsional)</span>
              </label>
              <span className="text-[10px] text-stone-500">Maksimal 4 gambar</span>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {/* Finalized Character Images */}
              {characterRefImages.map((url, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-sky-500/50 group shadow-sm bg-stone-900">
                  <img src={url} alt="Character Ref" className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
                  <button
                    type="button"
                    onClick={() => setCharacterRefImages(characterRefImages.filter((_, i) => i !== idx))}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-400 transition-opacity cursor-pointer z-10"
                    title="Hapus Wajah"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="absolute bottom-0.5 left-0.5 px-1 bg-black/80 text-[8px] font-mono text-sky-300 rounded z-10">
                    Wajah #{idx + 1}
                  </span>
                </div>
              ))}

              {/* Uploading Slots for Character */}
              {uploadingSlots
                .filter((s) => s.type === 'character')
                .map((slot) => (
                  <div
                    key={slot.id}
                    className={`relative w-16 h-16 rounded-xl overflow-hidden border shadow-xs flex flex-col items-center justify-center transition-all duration-200 ${
                      slot.status === 'success'
                        ? 'border-emerald-500 bg-emerald-950/40 ring-2 ring-emerald-500/40'
                        : 'border-sky-500/60 bg-stone-900 ring-1 ring-sky-500/30'
                    }`}
                  >
                    {slot.previewUrl && (
                      <img
                        src={slot.previewUrl}
                        alt="Uploading preview"
                        className="absolute inset-0 w-full h-full object-cover opacity-35 blur-[0.5px]"
                      />
                    )}
                    <div className="relative z-10 flex flex-col items-center justify-center p-1 text-center">
                      {slot.status === 'uploading' ? (
                        <>
                          <RefreshCw className="w-4 h-4 text-sky-400 animate-spin mb-0.5" />
                          <span className="text-[8px] font-bold text-sky-200 leading-tight">
                            {slot.progress > 10 ? `${slot.progress}%` : 'Upload'}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 mb-0.5">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                          <span className="text-[8px] font-bold text-emerald-300 leading-none">Siap</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}

              {characterRefImages.length + uploadingSlots.filter((s) => s.type === 'character').length < 4 && (
                <button
                  type="button"
                  onClick={() => charInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-16 h-16 rounded-xl border border-dashed border-stone-300 dark:border-white/15 hover:border-sky-500 flex flex-col items-center justify-center gap-0.5 text-stone-500 hover:text-sky-500 transition-all cursor-pointer bg-white/40 dark:bg-white/[0.02]"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-medium">+ Wajah</span>
                </button>
              )}
              <input
                ref={charInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleUploadFile(e, 'character')}
              />
            </div>
          </div>
        </div>

        {/* 6. MAIN BRIEF & STYLING DETAIL */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-stone-800 dark:text-stone-200 block mb-1">
              Main Brief / Aktivitas Model
            </label>
            <textarea
              value={mainBrief}
              onChange={(e) => setMainBrief(e.target.value)}
              rows={2}
              placeholder="Contoh: Memegang botol minuman dingin menghadap kamera dengan ekspresi segar dan ceria..."
              className="w-full p-2.5 rounded-xl border border-stone-300/80 dark:border-white/10 bg-stone-100/80 dark:bg-[#141418] text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-stone-800 dark:text-stone-200 block mb-1">
                Gaya Pakaian (Wardrobe)
              </label>
              <input
                type="text"
                value={clothing}
                onChange={(e) => setClothing(e.target.value)}
                placeholder="Contoh: Kaos polos krem santai..."
                className="w-full p-2 rounded-xl border border-stone-300/80 dark:border-white/10 bg-stone-100/80 dark:bg-[#141418] text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-stone-800 dark:text-stone-200 block mb-1">
                Ekspresi Wajah
              </label>
              <input
                type="text"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                placeholder="Contoh: Senyum ramah, mata berbinar..."
                className="w-full p-2 rounded-xl border border-stone-300/80 dark:border-white/10 bg-stone-100/80 dark:bg-[#141418] text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* 7. LATAR BELAKANG, RASIO OUTPUT & MODEL AI IMAGE */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Latar Belakang / Lingkungan */}
          <div>
            <label className="text-xs font-bold text-stone-800 dark:text-stone-200 block mb-1">
              Latar Belakang / Lingkungan
            </label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="w-full h-[38px] px-3 rounded-xl border border-stone-300/80 dark:border-white/10 bg-stone-100/80 dark:bg-[#141418] text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              {ENVIRONMENTS.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.label}
                </option>
              ))}
            </select>
          </div>

          {/* Rasio Output */}
          <div>
            <label className="text-xs font-bold text-stone-800 dark:text-stone-200 block mb-1">
              Rasio Output
            </label>
            <div className="grid grid-cols-3 gap-1.5 h-[38px]">
              {(['9:16', '16:9', '1:1'] as const).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setAspectRatio(ratio)}
                  className={`h-full rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                    aspectRatio === ratio
                      ? 'bg-amber-500 text-stone-950 border-amber-600 shadow-xs'
                      : 'bg-stone-100/80 dark:bg-[#141418] border-stone-300/80 dark:border-white/10 text-stone-700 dark:text-stone-300 hover:border-amber-400'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          {/* Model AI Image (Dropdown) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-stone-800 dark:text-stone-200 block truncate">
                Model AI Image
              </label>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                {WEAVY_IMAGE_MODELS.find((m) => m.name === selectedModel)?.cost || 4} CR
              </span>
            </div>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full h-[38px] px-3 rounded-xl border border-stone-300/80 dark:border-white/10 bg-stone-100/80 dark:bg-[#141418] text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer font-medium"
            >
              {WEAVY_IMAGE_MODELS.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} ({m.cost} CR)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ACTION BUTTON: SUSUN PROMPT */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleBuildPrompt}
            disabled={isGeneratingPrompt}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-98 transition-all cursor-pointer"
          >
            <Wand2 className="w-4 h-4" />
            <span>Susun Prompt AI Talent Otomatis</span>
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: Generated Prompt & Preview / Generate */}
      <div className="w-full lg:w-[42%] h-full flex flex-col justify-between overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-5 bg-[#ECE9E3]/50 dark:bg-[#0E0E12]/50">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Prompt Master & Output Studio</span>
            </h3>
            {generatedPrompt && (
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="px-2.5 py-1 rounded-lg bg-stone-200 dark:bg-[#1B1B22] hover:bg-stone-300 dark:hover:bg-stone-800 text-[11px] font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1 border border-stone-300/80 dark:border-white/10 transition-all cursor-pointer"
              >
                {copiedPrompt ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-amber-500" />
                    <span>Salin Prompt</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Prompt Box */}
          <div className="relative">
            <textarea
              value={generatedPrompt}
              onChange={(e) => setGeneratedPrompt(e.target.value)}
              rows={9}
              placeholder="Klik 'Susun Prompt AI Talent Otomatis' di sebelah kiri untuk menghasilkan prompt sinematik siap pakai..."
              className="w-full p-3 font-mono text-[11px] leading-relaxed rounded-2xl border border-stone-300/80 dark:border-white/10 bg-white dark:bg-[#141418] text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500 custom-scrollbar resize-none"
            />
          </div>

          {/* Gambar Preview Hasil */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center justify-between">
              <span>Pratinjau Hasil Generate Foto Talent</span>
              {generatedImageUrl && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Berhasil Dibuat
                </span>
              )}
            </label>

            <div className="w-full aspect-[9/12] max-h-[340px] rounded-2xl border-2 border-dashed border-stone-300 dark:border-white/10 bg-stone-100 dark:bg-[#141418] flex items-center justify-center overflow-hidden relative group">
              {isGeneratingImage ? (
                <div className="flex flex-col items-center justify-center gap-2 text-center p-4">
                  <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                  <p className="text-xs font-bold text-stone-800 dark:text-stone-200">
                    Sedang Membuat Foto AI Talent...
                  </p>
                  <p className="text-[10px] text-stone-500">
                    Memadukan model karakter dengan referensi produk via AI Engine
                  </p>
                </div>
              ) : generatedImageUrl ? (
                <>
                  <img
                    src={generatedImageUrl}
                    alt="Hasil AI Talent"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3">
                    <button
                      type="button"
                      onClick={handleDownloadTalentImage}
                      disabled={isDownloading}
                      className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-75"
                      title="Unduh Foto AI Talent Full HD"
                    >
                      {isDownloading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-stone-950" />
                          <span>Mengunduh...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Unduh HD</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsZoomOpen(true)}
                      className="py-2.5 px-3 rounded-xl bg-stone-900/90 hover:bg-stone-800 text-white font-bold text-xs flex items-center gap-1.5 border border-white/20 shadow-md transition-all cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Perbesar</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-center p-6 text-stone-400 dark:text-stone-600">
                  <ImageIcon className="w-10 h-10 stroke-1" />
                  <p className="text-xs font-medium">Belum ada foto talent yang digenerate</p>
                  <p className="text-[10px] max-w-xs">
                    Susun prompt dan klik tombol Generate untuk langsung melihat hasil talent memegang atau memakai produk Anda.
                  </p>
                </div>
              )}
            </div>

            {genError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{genError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Generator Actions */}
        <div className="space-y-2 pt-2 border-t border-stone-300/80 dark:border-white/8">
          <button
            type="button"
            onClick={handleGenerateTalentImage}
            disabled={isGeneratingImage || isUploading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isGeneratingImage ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memproses Foto AI Talent...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Foto AI Talent Sekarang</span>
              </>
            )}
          </button>
          <p className="text-[10px] text-center text-stone-500 dark:text-stone-400">
            Menggunakan engine Weavy AI / <span className="font-bold text-amber-600 dark:text-amber-400">{selectedModel}</span> dengan referensi produk terintegrasi.
          </p>
        </div>
      </div>

      {/* FULLSCREEN ZOOM / LIGHTBOX MODAL */}
      {isZoomOpen && generatedImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-200"
          onClick={() => setIsZoomOpen(false)}
        >
          {/* Modal Header Controls */}
          <div
            className="w-full max-w-4xl flex items-center justify-between py-2 px-4 mb-2 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-wide">Pratinjau AI Talent (Full HD)</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-extrabold uppercase">
                Rasio {aspectRatio}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadTalentImage}
                disabled={isDownloading}
                className="py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer disabled:opacity-75"
                title="Unduh Foto AI Talent Full HD"
              >
                {isDownloading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-stone-950" />
                    <span>Mengunduh...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Gambar</span>
                  </>
                )}
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

          {/* Modal Image Container */}
          <div
            className="relative max-w-4xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={generatedImageUrl}
              alt="AI Talent Full Zoom"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
