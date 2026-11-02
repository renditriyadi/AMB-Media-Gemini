import React, { useState, useEffect } from 'react';

export const Footer: React.FC = () => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="w-full max-w-4xl mx-auto py-8 px-4 mt-auto border-t border-stone-200/60 dark:border-stone-800/60 text-center space-y-2">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-400 dark:text-stone-600 font-sans-body">
        <p className="font-light">
          Crafted with <span className="font-serif-display italic">Playfair Display</span> &{' '}
          <span className="font-sans-body font-medium">Plus Jakarta Sans</span>
        </p>

        <div className="flex items-center gap-3 text-[11px] font-mono tracking-wide">
          <span>{time}</span>
          <span className="inline-block w-1 h-1 rounded-full bg-emerald-500"></span>
          <span>Google AI Studio</span>
        </div>
      </div>
    </footer>
  );
};
