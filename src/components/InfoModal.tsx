import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lightbulb, Sparkles, Plus, Sliders, CheckCircle2 } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl shadow-xl overflow-hidden z-10 border border-stone-200/80 dark:border-stone-800 p-6 space-y-5 transition-colors duration-300"
        >
          <div className="flex items-center justify-between border-b border-stone-200/80 dark:border-stone-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-500/20">
                <Lightbulb className="w-5 h-5" />
              </div>
              <h3 className="font-serif-display text-base font-normal text-stone-900 dark:text-stone-100">Catatan & Panduan Studio</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3.5 text-xs text-stone-700 dark:text-stone-300 font-sans-body leading-relaxed">
            <div className="flex items-start gap-3 p-3 bg-amber-50/60 dark:bg-amber-500/10 rounded-lg border border-amber-200/80 dark:border-amber-500/20">
              <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p>
                <strong className="text-stone-900 dark:text-amber-200 font-semibold">Header Dinamis:</strong> Header menampilkan judul "Generate Video" atau "Generate Image" sesuai dengan mode yang dipilih di Settings.
              </p>
            </div>

            <div className="flex items-start gap-3 p-3 bg-amber-50/60 dark:bg-amber-500/10 rounded-lg border border-amber-200/80 dark:border-amber-500/20">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p>
                <strong className="text-stone-900 dark:text-amber-200 font-semibold">Tombol Generate Otomatis:</strong> Tombol aksi akan berubah otomatis menyesuaikan mode (Generate Video / Generate Image).
              </p>
            </div>

            <div className="flex items-start gap-3 p-3 bg-amber-50/60 dark:bg-amber-500/10 rounded-lg border border-amber-200/80 dark:border-amber-500/20">
              <Plus className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p>
                <strong className="text-stone-900 dark:text-amber-200 font-semibold">Ikon "+":</strong> Digunakan untuk melampirkan media referensi (Gambar, Video, atau File dari perangkat).
              </p>
            </div>

            <div className="flex items-start gap-3 p-3 bg-amber-50/60 dark:bg-amber-500/10 rounded-lg border border-amber-200/80 dark:border-amber-500/20">
              <Sliders className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p>
                <strong className="text-stone-900 dark:text-amber-200 font-semibold">Pengaturan Model:</strong> Ubah Model AI, Aspect Ratio, Durasi, dan Resolusi di menu Settings.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-stone-100 dark:text-stone-900 font-medium text-xs rounded-lg transition-all cursor-pointer font-sans-body"
          >
            Mengerti & Tutup
          </button>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
};
