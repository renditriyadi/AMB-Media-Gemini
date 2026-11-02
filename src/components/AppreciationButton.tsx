import React, { useState } from 'react';
import { Heart, Copy, Check, Share2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AppreciationButtonProps {
  likesCount: number;
  onLike: () => void;
  greetingText: string;
  onRandomize: () => void;
}

export const AppreciationButton: React.FC<AppreciationButtonProps> = ({
  likesCount,
  onLike,
  greetingText,
  onRandomize,
}) => {
  const [copied, setCopied] = useState(false);
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(greetingText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLikeClick = () => {
    onLike();
    // Add floating heart particle
    const newHeart = { id: Date.now(), x: (Math.random() - 0.5) * 40 };
    setHearts((prev) => [...prev, newHeart]);
    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center gap-4 my-6">
      {/* Action Buttons Row */}
      <div className="flex items-center gap-3">
        {/* Like Appreciation Button */}
        <div className="relative">
          {/* Floating Hearts Animation */}
          <AnimatePresence>
            {hearts.map((h) => (
              <motion.div
                key={h.id}
                initial={{ opacity: 1, y: 0, scale: 0.8, x: h.x }}
                animate={{ opacity: 0, y: -45, scale: 1.4 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none text-rose-500 z-10"
              >
                <Heart className="w-4 h-4 fill-rose-500" />
              </motion.div>
            ))}
          </AnimatePresence>

          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={handleLikeClick}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium font-sans-body bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all duration-200 cursor-pointer shadow-xs"
            title="Appreciate this greeting"
          >
            <Heart className="w-4 h-4 fill-rose-500/30 text-rose-600 dark:text-rose-400" />
            <span>Appreciate</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-rose-200/50 dark:bg-rose-500/20 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
              {likesCount}
            </span>
          </motion.button>
        </div>

        {/* Copy Greeting Snippet Button */}
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium font-sans-body bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700/80 transition-all duration-200 cursor-pointer shadow-xs"
          title="Copy text snippet"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Copied!
              </span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-stone-500 dark:text-stone-400" />
              <span>Copy Greeting</span>
            </>
          )}
        </motion.button>

        {/* Randomize Button */}
        <motion.button
          whileTap={{ scale: 0.91, rotate: 180 }}
          onClick={onRandomize}
          className="p-2.5 rounded-xl bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 transition-all duration-200 cursor-pointer shadow-xs"
          title="Shuffle language greeting"
        >
          <RefreshCw className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  );
};
