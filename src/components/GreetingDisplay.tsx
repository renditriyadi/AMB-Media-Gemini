import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Volume2 } from 'lucide-react';
import { Greeting } from '../types';

interface GreetingDisplayProps {
  greeting: Greeting;
  name: string;
  onSpeak: () => void;
  isAudioMuted: boolean;
}

export const GreetingDisplay: React.FC<GreetingDisplayProps> = ({
  greeting,
  name,
  onSpeak,
  isAudioMuted,
}) => {
  // Replace {name} placeholder with active target or custom typed name
  const displayName = name.trim() || greeting.defaultTarget;
  const formattedHeading = greeting.template.replace('{name}', displayName);

  return (
    <div className="text-center max-w-3xl mx-auto px-4 py-8 sm:py-12 flex flex-col items-center">
      {/* Sparkle Badge */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 mb-6"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
        <span className="text-xs font-medium tracking-wide uppercase">
          {greeting.language} • {greeting.flag}
        </span>
      </motion.div>

      {/* Main Heading Display */}
      <div className="relative min-h-[90px] sm:min-h-[140px] flex items-center justify-center w-full">
        <AnimatePresence mode="wait">
          <motion.h1
            key={`${greeting.id}-${displayName}`}
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.98 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="font-serif-display text-4xl sm:text-6xl md:text-7xl font-normal leading-none text-stone-900 dark:text-stone-100 tracking-tight text-balance cursor-pointer group"
            onClick={onSpeak}
            title="Click to pronounce greeting"
          >
            {formattedHeading}
          </motion.h1>
        </AnimatePresence>
      </div>

      {/* Subtitle / Description */}
      <motion.p
        key={`sub-${greeting.id}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="font-sans-body text-base sm:text-lg font-light text-stone-500 dark:text-stone-400 max-w-lg mt-4 leading-relaxed"
      >
        {greeting.subtitle}
      </motion.p>

      {/* Pronunciation & Speak Action */}
      {greeting.pronunciation && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="mt-3 flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500 font-mono bg-stone-100/70 dark:bg-stone-900/40 px-3 py-1 rounded-md border border-stone-200/50 dark:border-stone-800"
        >
          <span>{greeting.pronunciation}</span>
          {!isAudioMuted && (
            <button
              onClick={onSpeak}
              className="text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
              title="Listen pronunciation"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
};
