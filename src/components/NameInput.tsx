import React from 'react';
import { X, User } from 'lucide-react';

interface NameInputProps {
  name: string;
  onChangeName: (newName: string) => void;
  defaultTarget: string;
}

const QUICK_SUGGESTIONS = ['World', 'Friend', 'Explorer', 'Creator', 'Developer', 'Dreamer'];

export const NameInput: React.FC<NameInputProps> = ({
  name,
  onChangeName,
  defaultTarget,
}) => {
  return (
    <div className="w-full max-w-md mx-auto space-y-3 px-4">
      <div className="relative flex items-center">
        <div className="absolute left-3.5 text-stone-400 dark:text-stone-500 pointer-events-none">
          <User className="w-4 h-4" />
        </div>
        
        <input
          type="text"
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder={`Enter a name (e.g. ${defaultTarget})...`}
          maxLength={32}
          className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm font-normal font-sans-body text-stone-800 dark:text-stone-100 bg-stone-50/80 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 placeholder-stone-400 dark:placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:focus:ring-amber-400/20 focus:border-amber-500 dark:focus:border-amber-400/50 transition-all duration-200 shadow-2xs"
        />

        {name && (
          <button
            onClick={() => onChangeName('')}
            className="absolute right-3 p-1 rounded-md text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            title="Clear name"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Quick Suggestions Pills */}
      <div className="flex items-center justify-center flex-wrap gap-1.5 pt-1">
        <span className="text-[11px] font-medium text-stone-400 dark:text-stone-500 mr-1">
          Quick:
        </span>
        {QUICK_SUGGESTIONS.map((suggestion) => {
          const isActive = name.toLowerCase() === suggestion.toLowerCase();
          return (
            <button
              key={suggestion}
              onClick={() => onChangeName(isActive ? '' : suggestion)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30 font-medium'
                  : 'bg-white/60 dark:bg-stone-900/40 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-800/80 hover:border-stone-300 dark:hover:border-stone-700 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              {suggestion}
            </button>
          );
        })}
      </div>
    </div>
  );
};
