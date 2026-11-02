import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Link as LinkIcon,
  FolderOpen,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { parseWeavyRecipeToCanvas } from '../../lib/canvasRecipes';
import { importWeavyRecipe, listMyWeavyRecipes } from '../../lib/weavyApi';
import { CanvasRecipe } from '../../types/canvas';

interface ImportWeavyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (recipe: CanvasRecipe) => void;
  weavyToken?: string;
  refreshToken?: string;
}

export const ImportWeavyModal: React.FC<ImportWeavyModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  weavyToken,
  refreshToken,
}) => {
  const [weavyUrl, setWeavyUrl] = useState(
    'https://app.weavy.ai/flow/HAvEs9qnHuGLDtfgv0j4rc'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [cloudRecipes, setCloudRecipes] = useState<any[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);

  if (!isOpen) return null;

  const handleImportByUrl = async () => {
    if (!weavyUrl.trim()) {
      setErrorMsg('Masukkan URL atau ID Recipe Weavy terlebih dahulu.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const rawUrl = weavyUrl.trim();
      const match = rawUrl.match(/flow\/([a-zA-Z0-9_-]+)/) || rawUrl.match(/recipes\/([a-zA-Z0-9_-]+)/);
      const recipeId = match
        ? match[1]
        : rawUrl.startsWith('http')
        ? rawUrl.split('/').pop()!.split('?')[0]
        : rawUrl;

      const data = await importWeavyRecipe(recipeId, {
        refreshToken: refreshToken || '',
        idToken: weavyToken || '',
      });

      if (!data.success || !data.recipe) {
        throw new Error(data.error || 'Gagal mengambil data recipe dari Weavy.');
      }

      // Convert Weavy structure to AMB Media Canvas format
      const convertedRecipe = parseWeavyRecipeToCanvas(data.recipe);
      onImportSuccess(convertedRecipe);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat mengimpor recipe.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchCloudRecipes = async () => {
    setIsLoadingCloud(true);
    setErrorMsg('');

    try {
      const data = await listMyWeavyRecipes({
        refreshToken: refreshToken || '',
        idToken: weavyToken || '',
      });

      if (!data.success) {
        throw new Error(data.error || 'Gagal mengambil daftar recipe.');
      }

      setCloudRecipes(data.recipes || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengambil recipe dari akun Weavy.');
    } finally {
      setIsLoadingCloud(false);
    }
  };

  const handleSelectCloudRecipe = (recipeItem: any) => {
    try {
      const converted = parseWeavyRecipeToCanvas(recipeItem);
      onImportSuccess(converted);
      onClose();
    } catch (err: any) {
      setErrorMsg('Gagal parsing format recipe ini: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-[#141418] border border-stone-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-200 dark:border-white/10 bg-stone-50/50 dark:bg-white/2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 leading-tight">
                Import Recipe dari Weavy AI
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Salin flow atau recipe yang sudah Anda buat di Weavy ke Canvas AMB Media
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto no-scrollbar">
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Option 1: URL / Recipe ID */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <LinkIcon className="w-4 h-4 text-amber-500" />
              <span>URL Flow atau ID Recipe Weavy</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={weavyUrl}
                onChange={(e) => setWeavyUrl(e.target.value)}
                placeholder="https://app.weavy.ai/flow/HAvEs9qnHuGLDtfgv0j4rc"
                className="flex-1 text-xs p-3 rounded-xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-white/10 text-stone-800 dark:text-stone-200 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 transition-colors font-mono"
              />
              <button
                type="button"
                onClick={handleImportByUrl}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-stone-950 font-bold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                <span>Import</span>
              </button>
            </div>
            <p className="text-[11px] text-stone-400">
              Contoh: Link flow Weavy yang Anda bagikan akan otomatis diuraikan menjadi nodes: Prompt, Source Image, Model (Nano Banana Pro / Seedream V5), dan Image Viewer.
            </p>
          </div>

          {/* Divider */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-stone-200 dark:border-white/10" />
            <span className="flex-shrink mx-4 text-[10px] uppercase font-bold text-stone-400 tracking-wider">
              Atau Pilih dari Recipe Tersimpan
            </span>
            <div className="flex-grow border-t border-stone-200 dark:border-white/10" />
          </div>

          {/* Option 2: Cloud Recipes List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-amber-500" />
                <span>Recipe Akun Weavy Anda</span>
              </span>
              <button
                type="button"
                onClick={handleFetchCloudRecipes}
                disabled={isLoadingCloud}
                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isLoadingCloud && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>{cloudRecipes.length > 0 ? 'Segarkan' : 'Muat Recipe Akun'}</span>
              </button>
            </div>

            {cloudRecipes.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto no-scrollbar pr-1">
                {cloudRecipes.map((r, idx) => (
                  <div
                    key={r.id || idx}
                    onClick={() => handleSelectCloudRecipe(r)}
                    className="flex items-center justify-between p-3 rounded-xl border border-stone-200 dark:border-white/10 hover:border-amber-500 dark:hover:border-amber-400/50 bg-stone-50/60 dark:bg-white/2 hover:bg-amber-500/5 transition-all cursor-pointer group"
                  >
                    <div>
                      <h4 className="text-xs font-semibold text-stone-900 dark:text-stone-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {r.name || 'Untitled Recipe'}
                      </h4>
                      <p className="text-[10px] text-stone-400">
                        {r.nodes?.length || 0} nodes • ID: {r.id?.slice(0, 10)}...
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-lg bg-stone-200 dark:bg-white/10 group-hover:bg-amber-500 group-hover:text-stone-950 font-medium transition-colors">
                      Pilih
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-dashed border-stone-200 dark:border-white/10 text-center text-stone-400 text-xs">
                Klik tombol <span className="font-semibold text-stone-600 dark:text-stone-300">"Muat Recipe Akun"</span> di atas untuk melihat seluruh recipe yang tersimpan di akun Weavy Anda.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 dark:border-white/10 bg-stone-50/50 dark:bg-white/2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-300 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
