import React, { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";

export const ImageGenerationSpinner: React.FC<{
  aspectRatio?: string;
  referenceImages?: string[];
  referenceCount?: number;
}> = ({
  aspectRatio = "9:16",
  referenceImages,
  referenceCount,
}) => {
  const [percent, setPercent] = useState(8);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      let nextP = 8;
      if (elapsed < 2500) {
        nextP = 8 + (elapsed / 2500) * 22; // 8% -> 30%
      } else if (elapsed < 7000) {
        nextP = 30 + ((elapsed - 2500) / 4500) * 35; // 30% -> 65%
      } else if (elapsed < 14000) {
        nextP = 65 + ((elapsed - 7000) / 7000) * 23; // 65% -> 88%
      } else if (elapsed < 24000) {
        nextP = 88 + ((elapsed - 14000) / 10000) * 9; // 88% -> 97%
      } else {
        nextP = 98;
      }
      setPercent(Math.min(98, Math.round(nextP)));
    }, 120);

    return () => clearInterval(interval);
  }, []);

  const getAspectClass = () => {
    if (aspectRatio === "9:16") {
      return "w-[240px] sm:w-[260px] aspect-[9/16] max-h-[460px]";
    }
    if (aspectRatio === "16:9") {
      return "w-[300px] sm:w-[380px] aspect-[16/9] max-h-[260px]";
    }
    if (aspectRatio === "4:3") {
      return "w-[280px] sm:w-[320px] aspect-[4/3] max-h-[300px]";
    }
    if (aspectRatio === "3:4") {
      return "w-[240px] sm:w-[270px] aspect-[3/4] max-h-[380px]";
    }
    return "w-[250px] sm:w-[280px] aspect-square max-h-[320px]";
  };

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div
      className={`relative rounded-2xl border border-stone-300/80 dark:border-white/10 bg-stone-200/60 dark:bg-black/40 backdrop-blur-md shadow-2xl flex flex-col items-center justify-center overflow-hidden select-none max-w-full my-2 ${getAspectClass()}`}
    >
      {/* Ambient background glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-amber-500/5 pointer-events-none" />

      {/* Spinner with progress percentage */}
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Soft pulsing glow behind */}
        <div className="absolute inset-2 rounded-full bg-amber-500/15 blur-lg animate-pulse" />

        {/* Outer rotating accent ring */}
        <div className="absolute inset-0 rounded-full border border-amber-500/20 border-t-amber-400/70 animate-spin [animation-duration:2.5s]" />

        {/* SVG Progress Circle */}
        <svg className="w-20 h-20 -rotate-90 transform" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            className="text-stone-900/10 dark:text-white/10"
            fill="transparent"
          />
          <circle
            cx="40"
            cy="40"
            r={radius}
            stroke="url(#spinnerGradient)"
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-150 ease-out"
          />
          <defs>
            <linearGradient
              id="spinnerGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#FBBF24" />
            </linearGradient>
          </defs>
        </svg>

        {/* Percentage Counter in Center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-bold font-mono text-amber-400 tracking-tight">
            {percent}%
          </span>
        </div>
      </div>

      {/* Multi-reference image badge */}
      {Boolean(referenceCount || (referenceImages && referenceImages.length > 0)) && (
        <div className="mt-3.5 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-[11px] font-medium text-amber-300 shadow-sm animate-pulse">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            Memproses dengan {(referenceCount || referenceImages?.length || 1) > 1 ? `${referenceCount || referenceImages?.length} gambar acuan` : '1 gambar acuan'}
          </span>
        </div>
      )}
    </div>
  );
};