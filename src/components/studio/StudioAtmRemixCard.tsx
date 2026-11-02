import React, { useState } from 'react';
import {
  Sparkles,
  Flame,
  Clock,
  User,
  Package,
  Wand2,
  Upload,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  CheckCircle2,
  Sliders,
  Layers,
  Camera,
  Cpu,
  Image as ImageIcon,
  Compass,
  ArrowRight,
  Info,
  Check,
  X,
  Target,
  Zap
} from 'lucide-react';
import {
  StudioProject,
  StudioAnalysis,
  StudioVideoMetadata,
  StudioAtmStyle,
  StudioImageModel,
  StudioAspectRatio,
  StudioAiModel,
} from '../../types/studio';
import { remixStudioStoryboard, isCreditErrorMessage } from '../../lib/studioService';
import { STUDIO_AI_MODELS } from './StudioVideoIngestCard';

interface Props {
  project: StudioProject;
  onRemixSuccess: (updatedProject: StudioProject) => void;
  onSuccessToast?: (msg: string) => void;
  onErrorToast?: (msg: string) => void;
}

const WEAVY_IMAGE_MODELS: { id: StudioImageModel; name: string; cost: number; desc: string }[] = [
  { id: 'ChatGPT Images 2.0 Edit', name: 'ChatGPT Images 2.0 Edit', cost: 11, desc: 'High Consistency Character & Product Edit (11 CR)' },
  { id: 'GPT Image 2.5', name: 'GPT Image 2.5', cost: 4, desc: 'Ultra Photorealistic 8K (4 CR)' },
  { id: 'Seedream V5.0 Pro Edit', name: 'Seedream V5.0 Pro Edit', cost: 12, desc: 'Maximum Consistency (12 CR)' },
  { id: 'Nano Banana Pro', name: 'Nano Banana Pro', cost: 11, desc: 'Cinematic Lighting (11 CR)' },
  { id: 'Grok Imagine Image', name: 'Grok Imagine Image', cost: 4, desc: 'Fast Dynamic Pose (4 CR)' },
];

const DURATION_PRESETS = [
  { sec: 15, scenes: 4, label: '15s' },
  { sec: 30, scenes: 6, label: '30s' },
  { sec: 45, scenes: 7, label: '45s' },
  { sec: 60, scenes: 8, label: '60s' },
];

const SCENE_PRESETS = [
  { count: 3, label: '3 Scene' },
  { count: 4, label: '4 Scene' },
  { count: 6, label: '6 Scene' },
  { count: 8, label: '8 Scene' },
];

const ANGLE_PRESETS = [
  { count: 2, label: '2 Angle' },
  { count: 3, label: '3 Angle' },
  { count: 4, label: '4 Angle' },
  { count: 6, label: '6 Angle' },
];

const AVAILABLE_ANGLES = [
  { id: 'Eye-Level Medium Shot', label: 'Eye-Level', icon: '👀' },
  { id: 'Extreme Close-Up Macro', label: 'Close-Up/Macro', icon: '🔍' },
  { id: 'Low-Angle Hero Shot', label: 'Low Angle', icon: '🚀' },
  { id: 'Top-Down Flatlay 90°', label: 'Top-Down', icon: '📐' },
  { id: 'Over-The-Shoulder (OTS) POV', label: 'POV/OTS', icon: '👤' },
  { id: 'Dutch Tilt Dynamic 45°', label: 'Dutch Tilt', icon: '⚡' },
  { id: 'Side-Profile Tracking Shot', label: 'Side Tracking', icon: '↔️' },
  { id: 'Wide Establishing Shot', label: 'Wide Shot', icon: '🏞️' },
];

const REMIX_STYLES: { id: StudioAtmStyle; title: string; subtitle: string; icon: string; badge: string }[] = [
  {
    id: 'viral-hook-pain-agitate',
    title: 'Pain-Agitate-Solve Hook',
    subtitle: 'Serang masalah emosional di detik pertama, lalu hadirkan produk sebagai solusi instan.',
    icon: '🔥',
    badge: 'Paling Viral',
  },
  {
    id: 'ugc-honest-review',
    title: 'UGC Review Jujur & Spontan',
    subtitle: 'Gaya kreator santai bicara di depan kamera, unboxing asli, dan bukti tekstur.',
    icon: '💬',
    badge: 'High Trust',
  },
  {
    id: 'extreme-demo-proof',
    title: 'Pembuktian Ekstrem & Demo',
    subtitle: 'Fokus pada tes ketahanan, perbandingan before-after langsung, dan bukti nyata.',
    icon: '⚡',
    badge: 'Anti Ragu',
  },
  {
    id: 'daily-vlog-storytelling',
    title: 'Daily Vlog & Lifestyle',
    subtitle: 'Alur cerita rutinitas harian yang relate dengan masalah sehari-hari audiens.',
    icon: '☕',
    badge: 'Emotional',
  },
  {
    id: 'hard-sell-fomo',
    title: 'Hard-Selling & Promo FOMO',
    subtitle: 'Penekanan pada diskon kilat, stok menipis, dan ajakan checkout keranjang kuning.',
    icon: '🛒',
    badge: 'Flash Sale',
  },
  {
    id: 'educational-unboxing',
    title: 'Edukasi & Unboxing Elegan',
    subtitle: 'Penjelasan manfaat formula atau bahan dengan cara mudah dipahami dan visual estetik.',
    icon: '✨',
    badge: 'Premium',
  },
];

const CHARACTER_SUGGESTIONS = [
  'Wanita muda Indonesia usia 25 tahun, hijab kasual modern, senyum ramah dan ekspresif',
  'Pria milenial santai usia 28 tahun, kaos polo hijau olive, gaya rapi dan antusias',
  'Ibu rumah tangga cerdas usia 32 tahun, daster modern, aktif dan penuh tips berkebun',
  'Content creator kecantikan Gen-Z usia 22 tahun, rambut bob, kulit bersih glowing',
  'Petani / pengusaha muda modern berkacamata, topi fedora / bucket hat, ramah di kebun',
];

export const StudioAtmRemixCard: React.FC<Props> = ({
  project,
  onRemixSuccess,
  onSuccessToast,
  onErrorToast,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remixStepStatus, setRemixStepStatus] = useState<string>('');

  // 1. Duration & Scene Count state
  const [targetDurationSec, setTargetDurationSec] = useState<number>(30);
  const [customDurationInput, setCustomDurationInput] = useState<string>('30');
  const [isCustomDuration, setIsCustomDuration] = useState(false);

  const [targetSceneCount, setTargetSceneCount] = useState<number>(6);
  const [customSceneInput, setCustomSceneInput] = useState<string>('6');
  const [isCustomSceneCount, setIsCustomSceneCount] = useState(false);

  // 1C. Camera Angle Variety state (Default: OFF)
  const [isAngleVarietyEnabled, setIsAngleVarietyEnabled] = useState<boolean>(false);
  const [targetAngleCount, setTargetAngleCount] = useState<number>(3);
  const [customAngleInput, setCustomAngleInput] = useState<string>('3');
  const [isCustomAngleCount, setIsCustomAngleCount] = useState(false);
  const [selectedAngles, setSelectedAngles] = useState<string[]>([
    'Eye-Level Medium Shot',
    'Extreme Close-Up Macro',
    'Low-Angle Hero Shot',
  ]);

  // 2. Character / Talent state
  const [characterTalent, setCharacterTalent] = useState<string>(
    project.briefInputs?.modelTalent || project.analysis?.modelTalent || ''
  );
  const [characterImage, setCharacterImage] = useState<string>(
    project.briefInputs?.modelImage || ''
  );

  // 3. Product state (Optional override)
  const [productName, setProductName] = useState<string>(
    project.briefInputs?.productName || project.analysis?.productOrTopicName || project.name || ''
  );
  const [productDescription, setProductDescription] = useState<string>(
    project.briefInputs?.productDescription || ''
  );
  const [productImage, setProductImage] = useState<string>(
    project.briefInputs?.productImage || ''
  );

  // 4. Background / Setting state (Optional)
  const [backgroundSetting, setBackgroundSetting] = useState<string>(
    project.briefInputs?.backgroundSetting || project.analysis?.backgroundSetting || ''
  );
  const [backgroundImage, setBackgroundImage] = useState<string>(
    project.briefInputs?.backgroundImage || ''
  );

  // 5. Creative Style & Angle
  const [remixStyle, setRemixStyle] = useState<StudioAtmStyle>('viral-hook-pain-agitate');
  const [creativeAngle, setCreativeAngle] = useState<string>('');

  // 6. Image Engine & Aspect Ratio
  const [imageModel, setImageModel] = useState<StudioImageModel>(
    (project.masterProductionSheet?.imageModel as StudioImageModel) || project.imageModel || 'ChatGPT Images 2.0 Edit'
  );
  const [aspectRatio, setAspectRatio] = useState<StudioAspectRatio>(project.aspectRatio || '9:16');
  const [aiModel, setAiModel] = useState<StudioAiModel>(project.aiModel || 'google/gemini-2.5-flash');

  // Hover state for image preview
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleSelectPresetDuration = (sec: number, scenes: number) => {
    setTargetDurationSec(sec);
    setCustomDurationInput(String(sec));
    setIsCustomDuration(false);
    if (!isCustomSceneCount) {
      setTargetSceneCount(scenes);
      setCustomSceneInput(String(scenes));
    }
  };

  const handleCustomDurationChange = (val: string) => {
    setCustomDurationInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 5 && num <= 180) {
      setTargetDurationSec(num);
    }
  };

  const handleSelectPresetScenes = (count: number) => {
    setTargetSceneCount(count);
    setCustomSceneInput(String(count));
    setIsCustomSceneCount(false);
  };

  const handleCustomSceneChange = (val: string) => {
    setCustomSceneInput(val);
    setIsCustomSceneCount(true);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 2 && num <= 20) {
      setTargetSceneCount(num);
    }
  };

  const handleSelectPresetAngles = (count: number) => {
    setTargetAngleCount(count);
    setCustomAngleInput(String(count));
    setIsCustomAngleCount(false);
    const newAngles = AVAILABLE_ANGLES.slice(0, count).map(a => a.id);
    setSelectedAngles(newAngles);
  };

  const handleCustomAngleChange = (val: string) => {
    setCustomAngleInput(val);
    setIsCustomAngleCount(true);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1 && num <= 12) {
      setTargetAngleCount(num);
      if (selectedAngles.length < num) {
        const availableToAdd = AVAILABLE_ANGLES.filter(a => !selectedAngles.includes(a.id)).slice(0, num - selectedAngles.length);
        setSelectedAngles([...selectedAngles, ...availableToAdd.map(a => a.id)]);
      }
    }
  };

  const toggleAngleChip = (angleId: string) => {
    if (selectedAngles.includes(angleId)) {
      if (selectedAngles.length > 1) {
        const updated = selectedAngles.filter(a => a !== angleId);
        setSelectedAngles(updated);
        setTargetAngleCount(updated.length);
        setCustomAngleInput(String(updated.length));
        setIsCustomAngleCount(true);
      }
    } else {
      const updated = [...selectedAngles, angleId];
      setSelectedAngles(updated);
      setTargetAngleCount(updated.length);
      setCustomAngleInput(String(updated.length));
      setIsCustomAngleCount(true);
    }
  };

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const b64 = loadEvt.target?.result as string;
      if (b64) setter(b64);
    };
    reader.readAsDataURL(file);
  };

  // Execute ATM Remix
  const handleExecuteAtmRemix = async () => {
    if (!project.analysis) {
      onErrorToast?.('Analisis video asli belum tersedia untuk dilakukan ATM.');
      return;
    }

    setIsSubmitting(true);
    setRemixStepStatus('Menginspeksi parameter ATM & referensi gambar (Gemini VLM)...');

    try {
      setTimeout(() => setRemixStepStatus('Merombak alur Hook, Naskah & Timeline durasi baru...'), 1500);
      setTimeout(() => setRemixStepStatus('Menyusun Master 1-Sheet Grid (Peta Visual Produksi)...'), 3000);

      const remixResult = await remixStudioStoryboard({
        baseAnalysis: project.analysis,
        baseMetadata: project.videoSource?.metadata,
        targetDurationSec,
        numScenes: targetSceneCount,
        numCameraAngles: isAngleVarietyEnabled ? targetAngleCount : undefined,
        preferredAngles: isAngleVarietyEnabled && selectedAngles.length > 0 ? selectedAngles : undefined,
        remixStyle,
        characterTalent: characterTalent.trim() || undefined,
        characterImage: characterImage || undefined,
        productName: productName.trim() || undefined,
        productDescription: productDescription.trim() || undefined,
        productImage: productImage || undefined,
        backgroundSetting: backgroundSetting.trim() || undefined,
        backgroundImage: backgroundImage || undefined,
        creativeAngle: creativeAngle.trim() || undefined,
        aspectRatio,
        imageModel,
        aiModel,
      });

      const updatedProject: StudioProject = {
        ...project,
        updatedAt: new Date().toISOString(),
        analysis: remixResult.remixedAnalysis,
        scenes: remixResult.scenes,
        imageModel,
        aspectRatio,
        aiModel: remixResult.aiModel || aiModel,
        briefInputs: {
          ...project.briefInputs,
          productName: productName.trim() || project.briefInputs?.productName,
          productDescription: productDescription.trim() || project.briefInputs?.productDescription,
          productImage: productImage || project.briefInputs?.productImage,
          modelTalent: characterTalent.trim() || project.briefInputs?.modelTalent,
          modelImage: characterImage || project.briefInputs?.modelImage,
          backgroundSetting: backgroundSetting.trim() || project.briefInputs?.backgroundSetting,
          backgroundImage: backgroundImage || project.briefInputs?.backgroundImage,
          totalDurationSec: targetDurationSec,
          numScenes: targetSceneCount,
          numCameraAngles: isAngleVarietyEnabled ? targetAngleCount : undefined,
          preferredAngles: isAngleVarietyEnabled ? selectedAngles : undefined,
          mainBrief: `ATM Remix: ${remixResult.remixedAnalysis.mainBrief || remixStyle}`,
        },
        masterProductionSheet: {
          ...(project.masterProductionSheet || {}),
          prompt: remixResult.masterProductionSheetPrompt,
          imageModel,
          aspectRatio: '16:9',
          isUsedAsSceneAnchor: true,
        },
      };

      onRemixSuccess(updatedProject);
      setIsExpanded(false);
      onSuccessToast?.(`✨ Berhasil merancang ulang storyboard versi baru (${targetDurationSec} detik, ${remixResult.scenes.length} scene) dengan formula ATM!`);
    } catch (err: any) {
      console.error('[ATM Remix Error]:', err);
      onErrorToast?.(err.message || 'Gagal merancang versi baru dengan ATM.');
    } finally {
      setIsSubmitting(false);
      setRemixStepStatus('');
    }
  };

  return (
    <div className="bg-linear-to-b from-amber-500/10 via-[#FAF9F6] to-[#FAF9F6] dark:from-amber-500/10 dark:via-[#141418] dark:to-[#141418] border-2 border-amber-500/40 rounded-2xl p-4 sm:p-5 md:p-6 shadow-md transition-all duration-200 overflow-hidden relative">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-amber-500/20">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-500 text-white flex items-center justify-center shadow-md shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 font-serif-display">
                Rancang Versi Baru (Formula ATM)
              </h3>
              <span className="text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500 text-black shadow-xs tracking-wider uppercase">
                Amati • Tiru • Modifikasi
              </span>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300 font-sans-body mt-0.5">
              Tiru formula viral video kompetitor, lalu modifikasi dengan <strong className="text-amber-600 dark:text-amber-400">durasi baru</strong> & <strong className="text-amber-600 dark:text-amber-400">karakter/produk Anda</strong>!
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 shadow-sm ${
            isExpanded
              ? 'bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-300 dark:hover:bg-stone-700'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 hover:shadow-amber-500/25 hover:shadow-lg'
          }`}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              <span>Sembunyikan Panel ATM</span>
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              <span>Buka Menu Rancang Versi Baru</span>
            </>
          )}
        </button>
      </div>

      {/* Accordion Content */}
      {isExpanded && (
        <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* SECTION 1: Format & Parameter Storyboard (Durasi, Scene, Angle) */}
          <div className="bg-white/60 dark:bg-[#18181E] border border-stone-200 dark:border-white/10 rounded-xl p-3.5 space-y-3 shadow-xs">
            {/* Row 1: Target Durasi */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-[130px]">
                <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100">Durasi Video:</span>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{targetDurationSec}s</span>
              </div>

              <div className="flex items-center gap-2.5 flex-1 max-w-xl justify-end">
                {/* Preset Pills */}
                <div className="flex items-center gap-1 shrink-0">
                  {DURATION_PRESETS.map((p) => {
                    const isSelected = !isCustomDuration && targetDurationSec === p.sec;
                    return (
                      <button
                        key={p.sec}
                        type="button"
                        onClick={() => handleSelectPresetDuration(p.sec, p.scenes)}
                        className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-stone-950 shadow-xs'
                            : 'bg-stone-100 dark:bg-white/5 hover:bg-amber-500/20 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  value={targetDurationSec}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setTargetDurationSec(val);
                    setCustomDurationInput(String(val));
                    setIsCustomDuration(true);
                  }}
                  className="w-24 sm:w-36 accent-amber-500 h-1 bg-stone-200 dark:bg-stone-700 rounded-lg cursor-pointer"
                />

                {/* Input */}
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={customDurationInput}
                    onChange={(e) => handleCustomDurationChange(e.target.value)}
                    className="w-12 bg-white dark:bg-[#141418] border border-stone-300 dark:border-white/10 rounded-lg px-1.5 py-0.5 text-xs font-bold text-center text-stone-900 dark:text-white focus:border-amber-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-stone-500">dtk</span>
                </div>
              </div>
            </div>

            <div className="h-px bg-stone-200/70 dark:bg-white/5" />

            {/* Row 2: Jumlah Scene */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-[130px]">
                <Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100">Jumlah Scene:</span>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{targetSceneCount} Scene</span>
                <span className="text-[10px] text-stone-400 hidden sm:inline">(~{(targetDurationSec / targetSceneCount).toFixed(1)}s/scene)</span>
              </div>

              <div className="flex items-center gap-2.5 flex-1 max-w-xl justify-end">
                {/* Preset Pills */}
                <div className="flex items-center gap-1 shrink-0">
                  {SCENE_PRESETS.map((sc) => {
                    const isSelected = !isCustomSceneCount && targetSceneCount === sc.count;
                    return (
                      <button
                        key={sc.count}
                        type="button"
                        onClick={() => handleSelectPresetScenes(sc.count)}
                        className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-stone-950 shadow-xs'
                            : 'bg-stone-100 dark:bg-white/5 hover:bg-amber-500/20 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {sc.label}
                      </button>
                    );
                  })}
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min="2"
                  max="16"
                  step="1"
                  value={targetSceneCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setTargetSceneCount(val);
                    setCustomSceneInput(String(val));
                    setIsCustomSceneCount(true);
                  }}
                  className="w-24 sm:w-36 accent-amber-500 h-1 bg-stone-200 dark:bg-stone-700 rounded-lg cursor-pointer"
                />

                {/* Input */}
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min="2"
                    max="20"
                    value={customSceneInput}
                    onChange={(e) => handleCustomSceneChange(e.target.value)}
                    className="w-12 bg-white dark:bg-[#141418] border border-stone-300 dark:border-white/10 rounded-lg px-1.5 py-0.5 text-xs font-bold text-center text-stone-900 dark:text-white focus:border-amber-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-stone-500">scn</span>
                </div>
              </div>
            </div>

            <div className="h-px bg-stone-200/70 dark:bg-white/5" />

            {/* Row 3: Variasi Angle Kamera (With ON / OFF Toggle - Default: OFF) */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-[130px]">
                  <Camera className={`w-3.5 h-3.5 shrink-0 ${isAngleVarietyEnabled ? 'text-amber-500' : 'text-stone-400'}`} />
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100">Variasi Angle:</span>
                  {isAngleVarietyEnabled ? (
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{targetAngleCount} Angle</span>
                  ) : (
                    <span className="text-xs text-stone-400 font-medium">Off (Otomatis AI)</span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 flex-1 max-w-xl justify-end">
                  {isAngleVarietyEnabled && (
                    <>
                      {/* Preset Pills */}
                      <div className="flex items-center gap-1 shrink-0">
                        {ANGLE_PRESETS.map((ap) => {
                          const isSelected = !isCustomAngleCount && targetAngleCount === ap.count;
                          return (
                            <button
                              key={ap.count}
                              type="button"
                              onClick={() => handleSelectPresetAngles(ap.count)}
                              className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                                  : 'bg-stone-100 dark:bg-white/5 hover:bg-amber-500/20 text-stone-700 dark:text-stone-300'
                              }`}
                            >
                              {ap.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Slider */}
                      <input
                        type="range"
                        min="1"
                        max="8"
                        step="1"
                        value={targetAngleCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setTargetAngleCount(val);
                          setCustomAngleInput(String(val));
                          setIsCustomAngleCount(true);
                        }}
                        className="w-24 sm:w-36 accent-amber-500 h-1 bg-stone-200 dark:bg-stone-700 rounded-lg cursor-pointer"
                      />

                      {/* Input */}
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={customAngleInput}
                          onChange={(e) => handleCustomAngleChange(e.target.value)}
                          className="w-12 bg-white dark:bg-[#141418] border border-stone-300 dark:border-white/10 rounded-lg px-1.5 py-0.5 text-xs font-bold text-center text-stone-900 dark:text-white focus:border-amber-500 focus:outline-none"
                        />
                        <span className="text-[11px] text-stone-500">ang</span>
                      </div>
                    </>
                  )}

                  {/* ON / OFF Switch Toggle */}
                  <div className="flex items-center gap-1.5 pl-1 border-l border-stone-200 dark:border-white/10">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isAngleVarietyEnabled}
                      onClick={() => setIsAngleVarietyEnabled(!isAngleVarietyEnabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isAngleVarietyEnabled ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-700'
                      }`}
                      title={isAngleVarietyEnabled ? 'Matikan kustomisasi angle (Otomatis AI)' : 'Aktifkan kustomisasi angle kamera'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          isAngleVarietyEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className={`text-[11px] font-bold ${isAngleVarietyEnabled ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400'}`}>
                      {isAngleVarietyEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Compact Angle Selector Tags (Only when ON) */}
              {isAngleVarietyEnabled && (
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5 animate-in fade-in duration-150">
                  {AVAILABLE_ANGLES.map((ang) => {
                    const isActive = selectedAngles.includes(ang.id);
                    return (
                      <button
                        key={ang.id}
                        type="button"
                        onClick={() => toggleAngleChip(ang.id)}
                        className={`text-[11px] px-2 py-0.5 rounded-md border transition-all flex items-center gap-1 cursor-pointer ${
                          isActive
                            ? 'bg-amber-500/20 border-amber-500/60 text-amber-900 dark:text-amber-200 font-semibold'
                            : 'bg-stone-100 dark:bg-white/5 border-transparent text-stone-600 dark:text-stone-400 hover:border-stone-300'
                        }`}
                      >
                        <span>{ang.icon}</span>
                        <span>{ang.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: Karakter / Model Baru (Input & Analisis AI) */}
          <div className="space-y-3 pt-2 border-t border-stone-200 dark:border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <User className="w-4 h-4 text-amber-500" />
                <span>2. Input Karakter / Model Baru (Visual Persona & Foto):</span>
              </label>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                AI akan mengunci wajah & gaya karakter ke semua scene
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              {/* Character Photo Upload */}
              <div className="md:col-span-4">
                <input
                  type="file"
                  id="atm-character-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, setCharacterImage)}
                />
                {characterImage ? (
                  <div className="relative group rounded-xl border border-amber-500/40 overflow-hidden bg-black/40 h-32 flex items-center justify-center">
                    <img
                      src={characterImage}
                      alt="Karakter Baru"
                      className="w-full h-full object-cover"
                      onMouseEnter={(e) => {
                        setHoveredImage(characterImage);
                        setMousePos({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setHoveredImage(null)}
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                      <label
                        htmlFor="atm-character-upload"
                        className="px-2.5 py-1 bg-amber-500 text-black text-[10px] font-bold rounded-lg cursor-pointer hover:bg-amber-400"
                      >
                        Ganti Foto
                      </label>
                      <button
                        type="button"
                        onClick={() => setCharacterImage('')}
                        className="px-2.5 py-1 bg-rose-600 text-white text-[10px] font-bold rounded-lg cursor-pointer hover:bg-rose-500"
                      >
                        Hapus
                      </button>
                    </div>
                    <div className="absolute bottom-1.5 left-2 bg-black/70 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] text-amber-300 font-semibold">
                      Foto Karakter Terkunci ✨
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor="atm-character-upload"
                    className="h-32 rounded-xl border-2 border-dashed border-stone-300 dark:border-white/15 hover:border-amber-500 bg-white/50 dark:bg-stone-900/40 hover:bg-amber-500/5 transition-all flex flex-col items-center justify-center p-3 text-center cursor-pointer group"
                  >
                    <Upload className="w-5 h-5 text-stone-400 group-hover:text-amber-500 mb-1" />
                    <span className="text-xs font-bold text-stone-700 dark:text-stone-200 group-hover:text-amber-400">
                      Upload Foto Karakter
                    </span>
                    <span className="text-[10px] text-stone-400 mt-0.5">
                      Foto selfie / model asli Anda
                    </span>
                  </label>
                )}
              </div>

              {/* Character Text Description & Suggestions */}
              <div className="md:col-span-8 space-y-2">
                <textarea
                  rows={3}
                  value={characterTalent}
                  onChange={(e) => setCharacterTalent(e.target.value)}
                  placeholder="Deskripsikan karakter model (contoh: Wanita muda berhijab usia 25 tahun, senyum ramah ceria, gaya casual pastel)..."
                  className="w-full bg-white dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 rounded-xl p-2.5 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:border-amber-500 focus:outline-none"
                />

                {/* Quick Persona Suggestions */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-stone-400">Inspirasi Cepat:</span>
                  {CHARACTER_SUGGESTIONS.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCharacterTalent(sug)}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 dark:bg-[#1B1B22] hover:bg-amber-500/20 hover:text-amber-600 dark:hover:text-amber-400 border border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-300 transition-colors cursor-pointer truncate max-w-[200px]"
                      title={sug}
                    >
                      {sug.split(',')[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Pilihan Formula Gaya Modifikasi (Creative Angle) */}
          <div className="space-y-2.5 pt-2 border-t border-stone-200 dark:border-white/10">
            <label className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-500" />
              <span>3. Pilih Gaya Modifikasi & Sudut Pandang (Creative Angle):</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {REMIX_STYLES.map((st) => {
                const isSelected = remixStyle === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setRemixStyle(st.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500 text-stone-900 dark:text-white shadow-sm ring-1 ring-amber-500'
                        : 'bg-white dark:bg-[#1B1B22] border-stone-300 dark:border-white/10 hover:border-amber-500/50 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <span>{st.icon}</span>
                        <span>{st.title}</span>
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                        {st.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500 dark:text-stone-400 leading-tight">
                      {st.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Optional Custom Angle / Extra Notes */}
            <input
              type="text"
              value={creativeAngle}
              onChange={(e) => setCreativeAngle(e.target.value)}
              placeholder="Tambahan arahan khusus (opsional: misal 'Tambahkan penekanan pada garansi uang kembali 100%' atau 'Pakai bahasa gaul santai')..."
              className="w-full bg-white dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:border-amber-500 focus:outline-none mt-1"
            />
          </div>

          {/* SECTION 4: Produk & Latar Tempat (Opsional Kloning Video) */}
          <div className="space-y-2.5 pt-2 border-t border-stone-200 dark:border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-amber-500" />
                <span>4. Produk & Latar Tempat (Opsional - Jika ingin adaptasi ke produk sendiri):</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-300">Nama / USP Produk:</span>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Nama produk Anda (contoh: Paket Benih Sayur 25 Jenis)..."
                  className="w-full bg-white dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 dark:text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-300">Latar Tempat / Setting:</span>
                <input
                  type="text"
                  value={backgroundSetting}
                  onChange={(e) => setBackgroundSetting(e.target.value)}
                  placeholder="Latar tempat (contoh: Kebun pekarangan rumah hijau estetik)..."
                  className="w-full bg-white dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 dark:text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: Engine Model & Aspek Rasio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-stone-200 dark:border-white/10">
            <div>
              <label className="text-xs font-bold text-stone-900 dark:text-stone-100 block mb-1">
                Model Gambar Weavy AI:
              </label>
              <select
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value as StudioImageModel)}
                className="w-full bg-white dark:bg-[#1B1B22] border border-stone-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-900 dark:text-white focus:border-amber-500 focus:outline-none cursor-pointer"
              >
                {WEAVY_IMAGE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.cost} CR)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-900 dark:text-stone-100 block mb-1">
                Aspek Rasio Storyboard:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['9:16', '16:9', '1:1'] as StudioAspectRatio[]).map((asp) => (
                  <button
                    key={asp}
                    type="button"
                    onClick={() => setAspectRatio(asp)}
                    className={`py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer text-center ${
                      aspectRatio === asp
                        ? 'bg-amber-500 text-black border-amber-500 shadow-xs'
                        : 'bg-white dark:bg-[#1B1B22] border-stone-300 dark:border-white/10 text-stone-700 dark:text-stone-300 hover:border-amber-500/50'
                    }`}
                  >
                    {asp === '9:16' ? '9:16 (TikTok)' : asp === '16:9' ? '16:9 (Landscape)' : '1:1 (Square)'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* EXECUTION BUTTON */}
          <div className="pt-3 border-t border-amber-500/30">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleExecuteAtmRemix}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg hover:shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                  <span>{remixStepStatus || 'Memproses ATM Remix...'}</span>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span>⚡ Eksekusi ATM: Rancang Storyboard & Master Visual Baru ({targetDurationSec}s)</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-stone-500 dark:text-stone-400 mt-2">
              Sistem akan otomatis merombak alur scene, naskah narasi, visual prompt, dan membuat acuan Master Peta Visual 16:9 baru.
            </p>
          </div>
        </div>
      )}

      {/* Floating Image Preview on Hover */}
      {hoveredImage && (
        <div
          className="fixed z-[9999] pointer-events-none p-2 bg-stone-900/95 backdrop-blur-md border border-amber-500/40 rounded-2xl shadow-2xl transition-all duration-150 animate-in fade-in zoom-in-95"
          style={{
            top: Math.min(window.innerHeight - 280, Math.max(10, mousePos.y - 120)),
            left: Math.min(window.innerWidth - 280, mousePos.x + 20),
          }}
        >
          <div className="relative rounded-xl overflow-hidden border border-amber-500/20 w-52 h-52 bg-black">
            <img src={hoveredImage} alt="Preview" className="w-full h-full object-contain" />
          </div>
          <p className="mt-1.5 text-center text-[10px] font-bold text-amber-400 flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3" /> Preview Karakter
          </p>
        </div>
      )}
    </div>
  );
};
