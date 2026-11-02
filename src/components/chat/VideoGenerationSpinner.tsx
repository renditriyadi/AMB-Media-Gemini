import React, { useState, useEffect } from "react";
import { Sparkles, Clock, Flame } from "lucide-react";
import { resolveVideoProvider } from "./videoProvider";

export const VideoGenerationSpinner: React.FC<{
  aspectRatio?: string;
  modelName?: string;
  provider?: string;
  duration?: string;
  resolution?: string;
  referenceImageUrl?: string;
  referenceVideoUrl?: string;
}> = ({
  aspectRatio = "9:16",
  modelName = "MiniMax H3 Turbo Video",
  provider,
  duration = "15s",
  resolution = "768p",
  referenceImageUrl,
  referenceVideoUrl,
}) => {
  const providerInfo = resolveVideoProvider(provider, modelName);
  const isGeminiProvider = providerInfo.id === "gemini";
  const [percent, setPercent] = useState(6);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setSeconds(Math.floor(elapsed / 1000));

      // Realistic video render curve (RunningHub workflows take ~15-45s; Gemini may take longer, the bar holds at 97% until done)
      let nextP = 6;
      if (elapsed < 3000) {
        nextP = 6 + (elapsed / 3000) * 18; // 6% -> 24%
      } else if (elapsed < 10000) {
        nextP = 24 + ((elapsed - 3000) / 7000) * 36; // 24% -> 60%
      } else if (elapsed < 25000) {
        nextP = 60 + ((elapsed - 10000) / 15000) * 26; // 60% -> 86%
      } else if (elapsed < 45000) {
        nextP = 86 + ((elapsed - 25000) / 20000) * 10; // 86% -> 96%
      } else {
        nextP = 97;
      }
      setPercent(Math.min(98, Math.round(nextP)));
    }, 150);

    return () => clearInterval(interval);
  }, []);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getAspectClass = () => {
    if (aspectRatio === "9:16") {
      return "w-[240px] sm:w-[270px] aspect-[9/16] max-h-[460px]";
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
      className={`relative rounded-2xl border border-amber-500/30 dark:border-amber-500/20 bg-white/80 dark:bg-stone-950/80 backdrop-blur-md shadow-2xl flex flex-col items-center justify-between p-4 overflow-hidden select-none max-w-full my-2 text-stone-800 dark:text-stone-100 ${getAspectClass()}`}
    >
      {/* Ambient background glow & scanline */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 via-transparent to-amber-950/20 pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Badge */}
      <div className="w-full flex items-center justify-between z-10 text-[11px] font-medium">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-xs ${
            isGeminiProvider
              ? "bg-sky-500/20 border-sky-500/30 text-sky-300"
              : "bg-amber-500/20 border-amber-500/30 text-amber-300"
          }`}
        >
          {isGeminiProvider ? (
            <Sparkles className="w-3 h-3 text-sky-400 animate-pulse" />
          ) : (
            <Flame className="w-3 h-3 text-amber-400 animate-pulse" />
          )}
          <span className="font-semibold tracking-wide">{providerInfo.progressLabel}</span>
        </div>
        <div className="flex items-center gap-1 font-mono text-[10px] text-stone-400 bg-stone-900/90 px-2 py-0.5 rounded-md border border-white/10">
          <Clock className="w-3 h-3 text-amber-400" />
          <span>{formatTimer(seconds)}</span>
        </div>
      </div>

      {/* Center Spinner with Progress & Percentage */}
      <div className="relative w-28 h-28 flex items-center justify-center my-auto z-10">
        {/* Soft pulsing glow behind */}
        <div className="absolute inset-2 rounded-full bg-amber-500/20 blur-xl animate-pulse" />

        {/* Outer rotating accent ring */}
        <div className="absolute inset-0 rounded-full border border-amber-500/20 border-t-amber-400/80 animate-spin [animation-duration:3s]" />

        {/* SVG Progress Circle */}
        <svg className="w-24 h-24 -rotate-90 transform" viewBox="0 0 80 80">
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
            stroke="url(#videoSpinnerGradient)"
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-150 ease-out"
          />
          <defs>
            <linearGradient
              id="videoSpinnerGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#D97706" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#FCD34D" />
            </linearGradient>
          </defs>
        </svg>

        {/* Percentage Counter in Center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold font-mono text-amber-300 tracking-tight">
            {percent}%
          </span>
          <span className="text-[9px] font-mono text-stone-400 uppercase tracking-wider">
            Rendering
          </span>
        </div>
      </div>

      {/* Bottom Info Badges */}
      <div className="w-full flex flex-col items-center gap-1.5 z-10 text-center">
        {(referenceImageUrl || referenceVideoUrl) && (
          <div className="flex items-center gap-1 text-[10px] text-amber-300/90 font-medium">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Memproses dengan {referenceVideoUrl ? 'Video & Foto Acuan' : 'Foto Acuan'}</span>
          </div>
        )}
      </div>
    </div>
  );
};