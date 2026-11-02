import React from 'react';
import { Greeting } from '../types';
import { Globe } from 'lucide-react';

interface LanguageSelectorProps {
  greetings: Greeting[];
  selectedGreeting: Greeting;
  onSelectGreeting: (greeting: Greeting) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  greetings,
  selectedGreeting,
  onSelectGreeting,
}) => {
  return (
    <div className="w-full max-w-2xl mx-auto my-6 px-4">
      <div className="flex items-center justify-center gap-1.5 mb-3 text-xs font-medium text-stone-400 dark:text-stone-500">
        <Globe className="w-3.5 h-3.5" />
        <span>Select Language / Languages</span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl mx-auto">
        {greetings.map((g) => {
          const isSelected = g.id === selectedGreeting.id;
          return (
            <button
              key={g.id}
              onClick={() => onSelectGreeting(g)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-medium font-sans-body transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 shadow-2xs font-semibold'
                  : 'bg-white/80 dark:bg-stone-900/60 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <span>{g.flag}</span>
              <span>{g.language}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
