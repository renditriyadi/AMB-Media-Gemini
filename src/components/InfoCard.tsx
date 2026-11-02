import React, { useState } from 'react';
import { Info, Code2, Sparkles, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const InfoCard: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full max-w-xl mx-auto my-4 px-4">
      <div className="rounded-2xl bg-white/80 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800/80 p-4 transition-all duration-300 shadow-xs">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Why "Hello, World!"?</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-stone-400 transition-transform duration-300 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-3 border-t border-stone-200/50 dark:border-stone-800/80 text-xs font-light text-stone-500 dark:text-stone-400 space-y-2 leading-relaxed">
                <p>
                  The phrase <strong className="font-semibold text-stone-700 dark:text-stone-300">"Hello, World!"</strong> became famous in Brian Kernighan & Dennis Ritchie's 1978 book <em>The C Programming Language</em>. It represents the timeless tradition of verifying runtime sanity with the simplest possible output.
                </p>
                <div className="flex items-center gap-2 text-[11px] font-mono text-amber-700 dark:text-amber-400 pt-1">
                  <Code2 className="w-3.5 h-3.5" />
                  <span>console.log("Hello, World!");</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
