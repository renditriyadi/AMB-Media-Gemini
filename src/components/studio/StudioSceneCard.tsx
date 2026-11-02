import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  ZoomIn,
  Camera,
  Clock,
  AlertCircle,
  Edit3,
  ChevronDown,
  ChevronUp,
  Mic,
  MessageSquare,
  Film,
  Share2,
  Download
} from 'lucide-react';
import { StudioScene, StudioImageModel } from '../../types/studio';
import { downloadMediaFile } from '../../utils';

interface Props {
  scene: StudioScene;
  imageModel: StudioImageModel;
  aspectRatio: string;
  onUpdatePrompt: (sceneId: string, newPrompt: string) => void;
  onUpdateVideoPrompt?: (sceneId: string, newVideoPrompt: string) => void;
  onGenerate: (scene: StudioScene) => Promise<void>;
  onOpenZoom: (imageUrl: string, title: string) => void;
  isGeneratingAny: boolean;
  globalExpandPrompts?: boolean;
}

export const StudioSceneCard: React.FC<Props> = ({
  scene,
  imageModel,
  aspectRatio,
  onUpdatePrompt,
  onUpdateVideoPrompt,
  onGenerate,
  onOpenZoom,
  isGeneratingAny,
  globalExpandPrompts,
}) => {
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [isEditingVideoPrompt, setIsEditingVideoPrompt] = useState(false);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [isVideoPromptExpanded, setIsVideoPromptExpanded] = useState(false);

  const [tempPrompt, setTempPrompt] = useState(scene.imagePrompt);
  const [tempVideoPrompt, setTempVideoPrompt] = useState(scene.videoPrompt || '');

  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedVideoPrompt, setCopiedVideoPrompt] = useState(false);
  const [copiedVO, setCopiedVO] = useState(false);
  const [copiedOnScreen, setCopiedOnScreen] = useState(false);
  const [copiedFullScene, setCopiedFullScene] = useState(false);

  useEffect(() => {
    if (globalExpandPrompts !== undefined) {
      setIsPromptExpanded(globalExpandPrompts);
      setIsVideoPromptExpanded(globalExpandPrompts);
    }
  }, [globalExpandPrompts]);

  useEffect(() => {
    setTempPrompt(scene.imagePrompt);
    setTempVideoPrompt(scene.videoPrompt || '');
  }, [scene.imagePrompt, scene.videoPrompt]);

  const handleSavePrompt = () => {
    onUpdatePrompt(scene.id, tempPrompt);
    setIsEditingPrompt(false);
  };

  const handleSaveVideoPrompt = () => {
    if (onUpdateVideoPrompt) {
      onUpdateVideoPrompt(scene.id, tempVideoPrompt);
    }
    setIsEditingVideoPrompt(false);
  };

  const handleCopyPrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(scene.imagePrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleCopyVideoPrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scene.videoPrompt) {
      navigator.clipboard.writeText(scene.videoPrompt);
      setCopiedVideoPrompt(true);
      setTimeout(() => setCopiedVideoPrompt(false), 2000);
    }
  };

  const handleCopyVO = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scene.voiceover) {
      navigator.clipboard.writeText(scene.voiceover);
      setCopiedVO(true);
      setTimeout(() => setCopiedVO(false), 2000);
    }
  };

  const handleCopyOnScreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scene.onScreenText) {
      navigator.clipboard.writeText(scene.onScreenText);
      setCopiedOnScreen(true);
      setTimeout(() => setCopiedOnScreen(false), 2000);
    }
  };

  const handleCopyFullScene = (e: React.MouseEvent) => {
    e.stopPropagation();
    const timecodeStr = scene.timecode || `00:00 - 00:${String(scene.durationSec).padStart(2, '0')} (Durasi: ${scene.durationSec} detik)`;
    const text = `${scene.title}
Timecode: ${timecodeStr}
Arah Visual: ${scene.visualDescription || '-'}
${scene.voiceover ? `Voiceover (VO): "${scene.voiceover}"\n` : ''}${scene.onScreenText ? `Teks di Layar: ${scene.onScreenText}\n` : ''}Prompt AI Image (${aspectRatio}):
${scene.imagePrompt}
${scene.videoPrompt ? `Prompt AI Video Motion:\n${scene.videoPrompt}\n` : ''}`.trim();

    navigator.clipboard.writeText(text);
    setCopiedFullScene(true);
    setTimeout(() => setCopiedFullScene(false), 2000);
  };

  const handleDownloadImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!scene.imageUrl) return;
    try {
      const filename = `scene_${scene.sceneNumber}_${scene.title.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      await downloadMediaFile(scene.imageUrl, filename, 'image', imageModel);
    } catch (err) {
      console.error('[StudioSceneCard] Download error:', err);
    }
  };

  const isGeneratingThis = scene.status === 'generating';

  return (
    <div
      className={`bg-[#FAF9F6] dark:bg-[#141418] border rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 relative overflow-hidden shadow-xs hover:shadow-md ${
        isGeneratingThis
          ? 'border-amber-500/60 shadow-amber-500/10 ring-1 ring-amber-500/30'
          : scene.status === 'completed'
          ? 'border-emerald-500/40 dark:border-emerald-500/30'
          : scene.status === 'failed'
          ? 'border-rose-500/40'
          : 'border-stone-300 dark:border-white/10 hover:border-stone-400 dark:hover:border-white/20'
      }`}
    >
      {/* Top Section */}
      <div className="space-y-3">
        {/* 1. Meta Top Bar: Scene Pill + Timecode + Full Scene Copy Button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-stone-950 text-xs font-extrabold shadow-xs whitespace-nowrap flex-shrink-0">
              Scene {scene.sceneNumber}
            </span>

            {/* Timecode Badge */}
            <span
              className="text-[11px] font-semibold text-stone-700 dark:text-stone-300 bg-stone-200/70 dark:bg-[#1B1B22] px-2 py-0.5 rounded-md border border-stone-300/80 dark:border-white/10 flex items-center gap-1 whitespace-nowrap flex-shrink-0"
              title={scene.timecode || `Durasi: ${scene.durationSec} detik`}
            >
              <Clock className="w-3 h-3 text-amber-500 dark:text-amber-400" />
              {scene.timecode ? (
                <span className="truncate max-w-[140px] sm:max-w-none">{scene.timecode}</span>
              ) : (
                `${scene.durationSec}s`
              )}
            </span>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Quick Copy Full Scene Button */}
            <button
              type="button"
              onClick={handleCopyFullScene}
              className="px-2 py-1 rounded-lg bg-stone-200/70 dark:bg-white/5 hover:bg-stone-300/70 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Salin Seluruh Format Scene Ini (Timecode, Visual, VO, Prompts)"
            >
              {copiedFullScene ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>Salin Scene</span>
                </>
              )}
            </button>

            {scene.status === 'completed' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                ✓ Selesai
              </span>
            )}
            {isGeneratingThis && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap flex items-center gap-1">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                Proses
              </span>
            )}
          </div>
        </div>

        {/* 2. Scene Title */}
        <h4 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 leading-snug">
          {scene.title}
        </h4>

        {/* 3. Arah Visual & Scene Goal */}
        <div className="bg-stone-100 dark:bg-[#1B1B22] rounded-xl p-3 border border-stone-200/80 dark:border-white/10 text-xs space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
              <span>🎥</span>
              <span>Arah Visual:</span>
            </span>
            {scene.cameraAngle && (
              <span className="text-[10px] font-medium text-sky-700 dark:text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 truncate max-w-[140px]">
                {scene.cameraAngle}
              </span>
            )}
          </div>

          <p className="text-stone-700 dark:text-stone-300 leading-relaxed font-normal">
            {scene.visualDescription || scene.sceneGoal || '-'}
          </p>
        </div>

        {/* 4. Voiceover (VO) Script Narasi */}
        {scene.voiceover && (
          <div className="bg-amber-500/10 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Voiceover (VO):</span>
              </span>
              <button
                type="button"
                onClick={handleCopyVO}
                className="text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white p-1 rounded hover:bg-stone-200/80 dark:hover:bg-white/5 cursor-pointer"
                title="Salin Teks Voiceover"
              >
                {copiedVO ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <p className="italic text-stone-800 dark:text-stone-200 font-medium leading-relaxed">
              "{scene.voiceover}"
            </p>
          </div>
        )}

        {/* 5. Teks di Layar (On-Screen Text / Caption / Hook) */}
        {scene.onScreenText && (
          <div className="bg-rose-500/10 dark:bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-xs">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="font-bold text-rose-800 dark:text-rose-400 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Teks di Layar:</span>
              </span>
              <button
                type="button"
                onClick={handleCopyOnScreen}
                className="text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white p-1 rounded hover:bg-stone-200/80 dark:hover:bg-white/5 cursor-pointer"
                title="Salin Teks di Layar"
              >
                {copiedOnScreen ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <p className="font-bold text-rose-900 dark:text-rose-200 tracking-wide leading-relaxed">
              {scene.onScreenText}
            </p>
          </div>
        )}

        {/* 6. Prompt AI Image (Aspect Ratio) */}
        <div>
          <div className="flex items-center justify-between gap-1 bg-stone-100 dark:bg-[#1B1B22] p-1.5 px-2.5 rounded-xl border border-stone-200 dark:border-white/10">
            <button
              type="button"
              onClick={() => setIsPromptExpanded(!isPromptExpanded)}
              className="flex items-center gap-1.5 text-left text-xs font-semibold text-stone-700 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400 min-w-0 flex-1 py-1 cursor-pointer transition-colors"
              title={isPromptExpanded ? 'Sembunyikan prompt gambar' : 'Tampilkan prompt gambar lengkap'}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span className="truncate text-[11px] sm:text-xs">
                Prompt AI Image ({aspectRatio})
              </span>
              {isPromptExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
              )}
            </button>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="text-[11px] text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white px-2 py-1 rounded-md hover:bg-stone-200 dark:hover:bg-white/5 flex items-center gap-1 transition-colors cursor-pointer"
                title="Salin Prompt Gambar ke Clipboard"
              >
                {copiedPrompt ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span className="text-[10px]">Salin</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isEditingPrompt) {
                    handleSavePrompt();
                  } else {
                    setTempPrompt(scene.imagePrompt);
                    setIsEditingPrompt(true);
                    setIsPromptExpanded(true);
                  }
                }}
                className="text-[11px] text-amber-600 dark:text-amber-400 hover:text-amber-500 px-2 py-1 rounded-md hover:bg-stone-200 dark:hover:bg-white/5 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                title={isEditingPrompt ? 'Simpan Prompt' : 'Edit Prompt Gambar'}
              >
                <Edit3 className="w-3 h-3" />
                <span className="text-[10px]">{isEditingPrompt ? 'Simpan' : 'Edit'}</span>
              </button>
            </div>
          </div>

          {/* Expanded Image Prompt Box */}
          {isPromptExpanded && (
            <div className="mt-2 animate-in fade-in duration-150">
              {isEditingPrompt ? (
                <div className="space-y-2">
                  <textarea
                    value={tempPrompt}
                    onChange={(e) => setTempPrompt(e.target.value)}
                    rows={4}
                    className="w-full bg-white dark:bg-[#1B1B22] border border-amber-500/50 rounded-xl p-2.5 text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono leading-relaxed"
                    placeholder="Tulis / edit prompt gambar AI..."
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingPrompt(false)}
                      className="px-2.5 py-1 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePrompt}
                      className="px-3 py-1 bg-amber-500 text-stone-950 font-bold text-xs rounded-lg shadow-xs cursor-pointer"
                    >
                      Simpan Prompt
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-[#1B1B22] p-3 rounded-xl border border-stone-200 dark:border-white/10 leading-relaxed font-sans text-left break-words select-text">
                  {scene.imagePrompt}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 7. Prompt AI Video Motion (Minimax/Hailuo/Kling/Wan2.1) */}
        {scene.videoPrompt && (
          <div>
            <div className="flex items-center justify-between gap-1 bg-sky-50 dark:bg-sky-950/20 p-1.5 px-2.5 rounded-xl border border-sky-200 dark:border-sky-500/20">
              <button
                type="button"
                onClick={() => setIsVideoPromptExpanded(!isVideoPromptExpanded)}
                className="flex items-center gap-1.5 text-left text-xs font-semibold text-sky-800 dark:text-sky-300 hover:text-sky-600 dark:hover:text-sky-200 min-w-0 flex-1 py-1 cursor-pointer transition-colors"
                title={isVideoPromptExpanded ? 'Sembunyikan prompt video' : 'Tampilkan prompt video motion lengkap'}
              >
                <Film className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 flex-shrink-0" />
                <span className="truncate text-[11px] sm:text-xs">
                  Prompt AI Video Motion (Minimax/Hailuo/Kling)
                </span>
                {isVideoPromptExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                )}
              </button>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleCopyVideoPrompt}
                  className="text-[11px] text-sky-700 dark:text-sky-400 hover:text-sky-900 dark:hover:text-white px-2 py-1 rounded-md hover:bg-sky-100 dark:hover:bg-white/5 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Salin Prompt Video Motion ke Clipboard"
                >
                  {copiedVideoPrompt ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span className="text-[10px]">Salin</span>
                    </>
                  )}
                </button>

                {onUpdateVideoPrompt && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingVideoPrompt) {
                        handleSaveVideoPrompt();
                      } else {
                        setTempVideoPrompt(scene.videoPrompt || '');
                        setIsEditingVideoPrompt(true);
                        setIsVideoPromptExpanded(true);
                      }
                    }}
                    className="text-[11px] text-sky-600 dark:text-sky-400 hover:text-sky-500 px-2 py-1 rounded-md hover:bg-sky-100 dark:hover:bg-white/5 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                    title={isEditingVideoPrompt ? 'Simpan Prompt' : 'Edit Prompt Video'}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span className="text-[10px]">{isEditingVideoPrompt ? 'Simpan' : 'Edit'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Expanded Video Motion Prompt Box */}
            {isVideoPromptExpanded && (
              <div className="mt-2 animate-in fade-in duration-150">
                {isEditingVideoPrompt ? (
                  <div className="space-y-2">
                    <textarea
                      value={tempVideoPrompt}
                      onChange={(e) => setTempVideoPrompt(e.target.value)}
                      rows={3}
                      className="w-full bg-white dark:bg-[#1B1B22] border border-sky-500/50 rounded-xl p-2.5 text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono leading-relaxed"
                      placeholder="Tulis / edit instruksi camera motion..."
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingVideoPrompt(false)}
                        className="px-2.5 py-1 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveVideoPrompt}
                        className="px-3 py-1 bg-sky-500 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer"
                      >
                        Simpan Prompt Video
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-stone-700 dark:text-stone-300 bg-sky-50/50 dark:bg-[#1B1B22] p-3 rounded-xl border border-sky-200 dark:border-white/10 leading-relaxed font-sans text-left break-words select-text">
                    {scene.videoPrompt}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image Preview / Generation Canvas Area */}
      <div className="mt-4 pt-3 border-t border-stone-200 dark:border-white/10">
        <div
          className={`relative rounded-xl overflow-hidden bg-stone-100 dark:bg-black/50 border border-stone-300 dark:border-white/10 flex items-center justify-center ${
            aspectRatio === '9:16' ? 'aspect-[9/16] max-h-96' : aspectRatio === '16:9' ? 'aspect-[16/9]' : 'aspect-square'
          }`}
        >
          {scene.imageUrl ? (
            <div className="w-full h-full relative group">
              <img
                src={scene.imageUrl}
                alt={scene.title}
                className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2.5 p-2 backdrop-blur-[2px]">
                <button
                  type="button"
                  onClick={() => onOpenZoom(scene.imageUrl!, scene.title)}
                  className="p-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white backdrop-blur-md shadow-lg cursor-pointer transition-transform hover:scale-105 active:scale-95"
                  title="Perbesar Gambar"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  className="p-2.5 rounded-xl bg-sky-500/80 hover:bg-sky-500 text-white font-bold backdrop-blur-md shadow-lg cursor-pointer transition-transform hover:scale-105 active:scale-95"
                  title="Unduh Gambar Scene Ini"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => onGenerate(scene)}
                  disabled={isGeneratingAny}
                  className="p-2.5 rounded-xl bg-amber-500/90 hover:bg-amber-500 text-stone-950 font-bold backdrop-blur-md shadow-lg disabled:opacity-50 cursor-pointer transition-transform hover:scale-105 active:scale-95"
                  title="Generate Ulang"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : isGeneratingThis ? (
            <div className="p-4 text-center space-y-3 w-full">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 mx-auto animate-pulse">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-900 dark:text-white">Sedang Generate Gambar...</p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">Weavy {imageModel}</p>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-stone-200 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${scene.progress || 40}%` }}
                />
              </div>
            </div>
          ) : scene.status === 'failed' ? (
            <div className="p-4 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-500 dark:text-rose-400 mx-auto" />
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">Generasi Gagal</p>
              {scene.errorMessage && (
                <p className="text-[10px] text-stone-500 dark:text-stone-400 max-w-xs line-clamp-2">{scene.errorMessage}</p>
              )}
              <button
                type="button"
                onClick={() => onGenerate(scene)}
                disabled={isGeneratingAny}
                className="mt-2 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-700 dark:text-rose-200 text-xs font-medium border border-rose-500/30 flex items-center gap-1.5 mx-auto cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Coba Lagi
              </button>
            </div>
          ) : (
            <div className="p-4 text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-stone-200/70 dark:bg-stone-900 flex items-center justify-center text-stone-400 dark:text-stone-500 mx-auto">
                <Sparkles className="w-5 h-5" />
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Belum Ada Gambar</p>
              <button
                type="button"
                onClick={() => onGenerate(scene)}
                disabled={isGeneratingAny}
                className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-bold transition-all flex items-center gap-1.5 mx-auto disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate Scene Ini
              </button>
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div className="mt-3 flex items-center justify-between gap-2">
          {scene.imageUrl ? (
            <button
              type="button"
              onClick={() => onGenerate(scene)}
              disabled={isGeneratingAny}
              className="w-full py-2 px-3 rounded-xl bg-stone-100 dark:bg-[#1B1B22] hover:bg-stone-200 dark:hover:bg-[#22222B] text-stone-800 dark:text-stone-200 text-xs font-semibold border border-stone-300 dark:border-white/10 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              Generate Ulang Scene {scene.sceneNumber}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onGenerate(scene)}
              disabled={isGeneratingAny || isGeneratingThis}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isGeneratingThis ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate Gambar Weavy
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
