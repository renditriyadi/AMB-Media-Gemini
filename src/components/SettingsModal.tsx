import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, ChevronRight, Box, Monitor, Clock, Tv, Volume2, Cpu } from 'lucide-react';
import {
  GenerationSettings,
  GenerationMode,
  VideoModel,
  ImageModel,
  VideoAspectRatio,
  ImageAspectRatio,
  VideoDuration,
  VideoResolution,
  ImageResolution,
  getCleanModelName,
} from '../types';
import { resolveActiveProviderId } from '../lib/provider';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GenerationSettings;
  onUpdateSettings: (newSettings: Partial<GenerationSettings>) => void;
}

type ActiveDropdown = 'provider' | 'model' | 'aspect' | 'duration' | 'resolution' | null;

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdown>(null);

  const isVideo = settings.mode === 'video';
  const currentProvider = resolveActiveProviderId(settings);
  const vidsDuration = Math.min(15, Math.max(3, Number.parseInt(settings.videoDuration, 10) || 10));

  const handleModeChange = (mode: GenerationMode) => {
    if (mode === 'image') {
      if (currentProvider === 'flow' || currentProvider === 'runninghub' || currentProvider === 'roboneo' || currentProvider === 'galleri5') {
        onUpdateSettings({ mode, provider: currentProvider, imageModel: '-' });
      } else if (currentProvider === 'gemini') {
        onUpdateSettings({ mode, provider: 'gemini', imageModel: 'Google Imagen 3 Pro', imageAspectRatio: '9:16 (Vertical)' });
      } else if (currentProvider === 'kie') {
        onUpdateSettings({ mode, provider: 'kie', imageModel: 'GPT Image 2 (Image-to-Image)' });
      } else {
        onUpdateSettings({ mode, provider: 'weavy', imageModel: 'Seedream V5.0 Pro Edit' });
      }
    } else {
      if (currentProvider === 'gemini') {
        onUpdateSettings({
          mode,
          provider: 'gemini',
          videoModel: 'Omni Flash',
          videoAspectRatio: '9:16 (Vertical)',
          videoDuration: '10 seconds',
          videoResolution: '1080p',
        });
      } else if (currentProvider === 'vids') {
        onUpdateSettings({
          mode,
          provider: 'vids',
          videoModel: 'Google Vids Omni',
          videoAspectRatio: '9:16 (Vertical)',
          videoDuration: '10 seconds',
          videoResolution: '1080p',
        });
      } else if (currentProvider === 'flow') {
        onUpdateSettings({
          mode,
          provider: 'flow',
          videoModel: 'Google Flow Video (10s)',
          videoAspectRatio: '16:9 (Landscape)',
          videoDuration: '10 seconds',
          videoResolution: '1080p',
        });
      } else if (currentProvider === 'runninghub') {
        const activeRunningHubModel =
          settings.videoModel === 'MiniMax H3 Turbo Video' ||
          settings.videoModel === 'S2 Motion Control' ||
          settings.videoModel === 'Motion Control'
            ? settings.videoModel
            : 'MiniMax H3 Turbo Video';
        const durationForModel = activeRunningHubModel === 'MiniMax H3 Turbo Video'
          ? (settings.videoDuration === '15 seconds' || settings.videoDuration === '10 seconds' ? settings.videoDuration : '10 seconds')
          : settings.videoDuration;
        const resForRunningHub = settings.videoResolution === '720p' || settings.videoResolution === '768p' ? settings.videoResolution : '768p';
        onUpdateSettings({ mode, provider: 'runninghub', videoModel: activeRunningHubModel, videoDuration: durationForModel, videoResolution: resForRunningHub, imageModel: '-' });
      } else if (currentProvider === 'kie') {
        const isSeeDanceMini = settings.videoModel === 'SeeDance 2.0 Mini';
        onUpdateSettings({
          mode,
          provider: 'kie',
          videoModel: isSeeDanceMini ? 'SeeDance 2.0 Mini' : 'Grok Imagine 1.5 Preview',
          videoResolution: isSeeDanceMini ? '480p' : (settings.videoResolution || '720p'),
        });
      } else if (currentProvider === 'galleri5') {
        onUpdateSettings({ mode, provider: 'galleri5', videoModel: 'Kling 2.6 Motion Control Standar' });
      } else if (currentProvider === 'roboneo') {
        onUpdateSettings({ mode, provider: 'roboneo', videoModel: 'Kling 2.6 Motion Control' });
      } else {
        onUpdateSettings({ mode, provider: 'weavy', videoModel: 'Kling 3.0 Pro Motion Control' });
      }
    }
    setActiveDropdown(null);
  };

  const handleProviderSelect = (provider: 'weavy' | 'gemini' | 'flow' | 'vids' | 'roboneo' | 'galleri5' | 'kie' | 'runninghub') => {
    if (provider === 'vids') {
      onUpdateSettings({
        provider: 'vids',
        videoModel: 'Google Vids Omni',
        videoAspectRatio: '9:16 (Vertical)',
        videoDuration: '10 seconds',
        videoResolution: '1080p',
        imageModel: '-',
      });
    } else if (provider === 'gemini') {
      if (isVideo) {
        onUpdateSettings({
          provider,
          videoModel: 'Omni Flash',
          videoAspectRatio: '9:16 (Vertical)',
          videoDuration: '10 seconds',
          videoResolution: '1080p',
          imageModel: '-',
        });
      } else {
        onUpdateSettings({
          provider,
          imageModel: 'Google Imagen 3 Pro',
          imageAspectRatio: '9:16 (Vertical)',
          videoModel: '-',
        });
      }
    } else if (provider === 'flow') {
      onUpdateSettings({
        provider: 'flow',
        videoModel: 'Google Flow Video (10s)',
        videoAspectRatio: '16:9 (Landscape)',
        videoDuration: '10 seconds',
        videoResolution: '1080p',
        imageModel: '-',
      });
    } else if (provider === 'runninghub') {
      const activeRunningHubModel = settings.videoModel === 'MiniMax H3 Turbo Video' || settings.videoModel === 'S2 Motion Control' || settings.videoModel === 'Motion Control' ? settings.videoModel : 'MiniMax H3 Turbo Video';
      const durationForModel = activeRunningHubModel === 'MiniMax H3 Turbo Video'
        ? (settings.videoDuration === '15 seconds' || settings.videoDuration === '10 seconds' ? settings.videoDuration : '10 seconds')
        : settings.videoDuration;
      const resForRunningHub = settings.videoResolution === '720p' || settings.videoResolution === '768p' ? settings.videoResolution : '768p';
      onUpdateSettings({ provider, videoModel: activeRunningHubModel, videoDuration: durationForModel, videoResolution: resForRunningHub, imageModel: '-' });
    } else if (provider === 'kie') {
      if (isVideo) {
        const isSeeDanceMini = settings.videoModel === 'SeeDance 2.0 Mini';
        onUpdateSettings({
          provider,
          videoModel: isSeeDanceMini ? 'SeeDance 2.0 Mini' : 'Grok Imagine 1.5 Preview',
          videoResolution: isSeeDanceMini ? '480p' : (settings.videoResolution || '720p'),
          imageModel: '-',
        });
      } else {
        onUpdateSettings({ provider, imageModel: 'GPT Image 2 (Image-to-Image)', videoModel: '-' });
      }
    } else if (provider === 'galleri5') {
      onUpdateSettings({ provider, videoModel: 'Kling 2.6 Motion Control Standar', imageModel: '-' });
    } else if (provider === 'roboneo') {
      onUpdateSettings({ provider, videoModel: 'Kling 2.6 Motion Control', imageModel: '-' });
    } else {
      onUpdateSettings({ provider: 'weavy', videoModel: 'Kling 3.0 Pro Motion Control', imageModel: 'Seedream V5.0 Pro Edit' });
    }
    setActiveDropdown(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs">
        {/* Backdrop click to dismiss */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          className="relative w-full max-w-md bg-white dark:bg-stone-900 rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden z-10 border border-stone-200/80 dark:border-stone-800 max-h-[85vh] flex flex-col transition-colors duration-300"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 sticky top-0 z-10">
            <h3 className="font-serif-display text-base font-normal text-stone-900 dark:text-stone-100">Settings</h3>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-6 font-sans-body">
            {/* Mode Switcher */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-stone-800 dark:text-stone-200">Mode</span>
              <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-1 rounded-lg border border-stone-200/80 dark:border-stone-700/80 w-48">
                <button
                  type="button"
                  onClick={() => handleModeChange('video')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                    isVideo
                      ? 'bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                      : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
                  }`}
                >
                  Video
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('image')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                    !isVideo
                      ? 'bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                      : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
                  }`}
                >
                  Image
                </button>
              </div>
            </div>

            {/* Dynamic Options List */}
            <div className="space-y-3">
              {/* 0. Provider */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActiveDropdown(activeDropdown === 'provider' ? null : 'provider')}
                  className="w-full flex items-center justify-between p-3.5 bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100/80 dark:hover:bg-stone-800 rounded-lg border border-stone-200/80 dark:border-stone-700/80 transition-all text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Cpu className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Provider</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-stone-900 dark:text-stone-100">
                    {currentProvider === 'weavy' ? (
                      <>
                        <img
                          src="https://cdn.prod.website-files.com/681b040781d5b5e278a69989/6829dad31872740b3fb4f912_favicon.svg"
                          alt="Weavy"
                          className="w-4.5 h-4.5 object-contain shrink-0 dark:hidden"
                          referrerPolicy="no-referrer"
                        />
                        <img
                          src="https://cdn.prod.website-files.com/681b040781d5b5e278a69989/69d4f1efa9dc89ccca92be1a_logo%20-%20squeare%20Weavy%20W.svg"
                          alt="Weavy"
                          className="w-4.5 h-4.5 object-contain shrink-0 hidden dark:block"
                          referrerPolicy="no-referrer"
                        />
                      </>
                    ) : currentProvider === 'gemini' ? (
                      <div className="w-4.5 h-4.5 rounded flex items-center justify-center shrink-0">
                        <img
                          src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg"
                          alt="Google Gemini"
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : currentProvider === 'flow' ? (
                      <div className="w-4.5 h-4.5 rounded flex items-center justify-center shrink-0">
                        <img
                          src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg"
                          alt="Google Flow"
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : currentProvider === 'vids' ? (
                      <div className="w-4.5 h-4.5 rounded flex items-center justify-center shrink-0">
                        <img
                          src="https://ssl.gstatic.com/docs/videos/images/favicon-2026-v2.ico"
                          alt="Google Vids"
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : currentProvider === 'galleri5' ? (
                      <>
                        <img
                          src="https://aistudio.galleri5.com/assets/Light%20mode-ClfS0paP.png"
                          alt="Galleri5"
                          className="w-4.5 h-4.5 object-contain shrink-0 dark:hidden"
                          referrerPolicy="no-referrer"
                        />
                        <img
                          src="https://aistudio.galleri5.com/assets/dark%20mode-D5XIT4aZ.png"
                          alt="Galleri5"
                          className="w-4.5 h-4.5 object-contain shrink-0 hidden dark:block"
                          referrerPolicy="no-referrer"
                        />
                      </>
                    ) : currentProvider === 'kie' ? (
                      <div className="w-4 h-4 rounded bg-slate-900 flex items-center justify-center p-0.5 shrink-0 border border-slate-800">
                        <img
                          src="https://kie.ai/logo.png"
                          alt="Kie.ai"
                          className="w-full h-full object-contain rounded-xs"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : currentProvider === 'runninghub' ? (
                      <div className="w-4 h-4 rounded bg-[#0A0A10] flex items-center justify-center p-0.5 shrink-0 border border-stone-700">
                        <img
                          src="https://www.runninghub.ai/favicon.ico?v=1.4"
                          alt="RunningHub"
                          className="w-full h-full object-contain rounded-xs"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded bg-purple-900 flex items-center justify-center p-0.5 shrink-0 border border-purple-800">
                        <img
                          src="https://www.roboneo.com/favicon.ico"
                          alt="RoboNeo"
                          className="w-full h-full object-contain rounded-xs"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <span>{currentProvider === 'weavy' ? 'Weavy' : currentProvider === 'gemini' ? 'Google Gemini' : currentProvider === 'flow' ? 'Google Flow' : currentProvider === 'vids' ? 'Google Vids' : currentProvider === 'galleri5' ? 'Galleri5' : currentProvider === 'kie' ? 'Kie.ai' : currentProvider === 'runninghub' ? 'RunningHub' : 'RoboNeo'}</span>
                    <ChevronRight className={`w-4 h-4 text-stone-400 transition-transform ${activeDropdown === 'provider' ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {activeDropdown === 'provider' && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 p-2 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 shadow-md space-y-1 z-20 relative"
                  >
                    <button
                      type="button"
                      onClick={() => handleProviderSelect('vids')}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md hover:bg-amber-50 dark:hover:bg-stone-700 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src="https://ssl.gstatic.com/docs/videos/images/favicon-2026-v2.ico"
                          alt="Google Vids"
                          className="w-4.5 h-4.5 object-contain shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <span className={currentProvider === 'vids' ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-stone-700 dark:text-stone-200'}>Google Vids</span>
                      </div>
                      {currentProvider === 'vids' && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleProviderSelect('gemini')}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md hover:bg-amber-50 dark:hover:bg-stone-700 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg"
                          alt="Google Gemini"
                          className="w-4.5 h-4.5 object-contain shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <span className={currentProvider === 'gemini' ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-stone-700 dark:text-stone-200'}>Google Gemini</span>
                      </div>
                      {currentProvider === 'gemini' && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                    </button>

                    {/* GOOGLE FLOW PROVIDER — MAINTENANCE: restore this option when the provider is re-enabled. */}
                    {/* <button
                      type="button"
                      onClick={() => handleProviderSelect('flow')}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md hover:bg-amber-50 dark:hover:bg-stone-700 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg"
                          alt="Google Flow"
                          className="w-4.5 h-4.5 object-contain shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <span className={currentProvider === 'flow' ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-stone-700 dark:text-stone-200'}>Google Flow (flow.google.com)</span>
                      </div>
                      {currentProvider === 'flow' && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                    </button> */}

                    <button
                      type="button"
                      onClick={() => handleProviderSelect('weavy')}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md hover:bg-amber-50 dark:hover:bg-stone-700 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src="https://cdn.prod.website-files.com/681b040781d5b5e278a69989/6829dad31872740b3fb4f912_favicon.svg"
                          alt="Weavy"
                          className="w-4.5 h-4.5 object-contain shrink-0 dark:hidden"
                          referrerPolicy="no-referrer"
                        />
                        <img
                          src="https://cdn.prod.website-files.com/681b040781d5b5e278a69989/69d4f1efa9dc89ccca92be1a_logo%20-%20squeare%20Weavy%20W.svg"
                          alt="Weavy"
                          className="w-4.5 h-4.5 object-contain shrink-0 hidden dark:block"
                          referrerPolicy="no-referrer"
                        />
                        <span className={currentProvider === 'weavy' ? 'font-bold text-amber-700 dark:text-stone-100' : 'text-stone-700 dark:text-stone-200'}>Weavy</span>
                      </div>
                      {currentProvider === 'weavy' && <Check className="w-4 h-4 text-amber-600 dark:text-stone-100" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleProviderSelect('runninghub')}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md hover:bg-amber-50 dark:hover:bg-stone-700 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-[#0A0A10] flex items-center justify-center p-0.5 shrink-0 border border-stone-700">
                          <img
                            src="https://www.runninghub.ai/favicon.ico?v=1.4"
                            alt="RunningHub"
                            className="w-full h-full object-contain rounded-xs"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <span className={currentProvider === 'runninghub' ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-stone-700 dark:text-stone-200'}>RunningHub</span>
                      </div>
                      {currentProvider === 'runninghub' && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                    </button>

                    {/* ROBONEO PROVIDER — MAINTENANCE: restore this option when the provider is re-enabled. */}
                    {/* <button
                      type="button"
                      onClick={() => handleProviderSelect('roboneo')}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md hover:bg-amber-50 dark:hover:bg-stone-700 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-purple-900 flex items-center justify-center p-0.5 shrink-0 border border-purple-800">
                          <img
                            src="https://www.roboneo.com/favicon.ico"
                            alt="RoboNeo"
                            className="w-full h-full object-contain rounded-xs"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <span className={currentProvider === 'roboneo' ? 'font-bold text-amber-700 dark:text-stone-100' : 'text-stone-700 dark:text-stone-200'}>RoboNeo</span>
                      </div>
                      {currentProvider === 'roboneo' && <Check className="w-4 h-4 text-amber-600 dark:text-stone-100" />}
                    </button> */}

                    {/* galleri5 maintenance
                    <button
                      type="button"
                      onClick={() => handleProviderSelect('galleri5')}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md hover:bg-amber-50 dark:hover:bg-stone-700 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src="https://aistudio.galleri5.com/assets/Light%20mode-ClfS0paP.png"
                          alt="Galleri5"
                          className="w-4.5 h-4.5 object-contain shrink-0 dark:hidden"
                          referrerPolicy="no-referrer"
                        />
                        <img
                          src="https://aistudio.galleri5.com/assets/dark%20mode-D5XIT4aZ.png"
                          alt="Galleri5"
                          className="w-4.5 h-4.5 object-contain shrink-0 hidden dark:block"
                          referrerPolicy="no-referrer"
                        />
                        <span className={currentProvider === 'galleri5' ? 'font-bold text-amber-700 dark:text-stone-100' : 'text-stone-700 dark:text-stone-200'}>Galleri5</span>
                      </div>
                      {currentProvider === 'galleri5' && <Check className="w-4 h-4 text-amber-600 dark:text-stone-100" />}
                    </button>
                    */}

                    {/* KIE.AI PROVIDER — MAINTENANCE: restore this option when the provider is re-enabled. */}
                    {/* <button
                      type="button"
                      onClick={() => handleProviderSelect('kie')}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md hover:bg-amber-50 dark:hover:bg-stone-700 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-slate-900 flex items-center justify-center p-0.5 shrink-0 border border-slate-800">
                          <img
                            src="https://kie.ai/logo.png"
                            alt="Kie.ai"
                            className="w-full h-full object-contain rounded-xs"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <span className={currentProvider === 'kie' ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-stone-700 dark:text-stone-200'}>Kie.ai</span>
                      </div>
                      {currentProvider === 'kie' && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                    </button> */}
                  </motion.div>
                )}
              </div>

              {/* 1. Model */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActiveDropdown(activeDropdown === 'model' ? null : 'model')}
                  className="w-full flex items-center justify-between p-3.5 bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100/80 dark:hover:bg-stone-800 rounded-lg border border-stone-200/80 dark:border-stone-700/80 transition-all text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Box className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                    <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Model</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-stone-900 dark:text-stone-100">
                    {(isVideo ? settings.videoModel : settings.imageModel).toLowerCase().includes('galleri5') && (
                      <>
                        <img
                          src="https://aistudio.galleri5.com/assets/Light%20mode-ClfS0paP.png"
                          alt="Galleri5"
                          className="w-3.5 h-3.5 object-contain shrink-0 dark:hidden"
                          referrerPolicy="no-referrer"
                        />
                        <img
                          src="https://aistudio.galleri5.com/assets/dark%20mode-D5XIT4aZ.png"
                          alt="Galleri5"
                          className="w-3.5 h-3.5 object-contain shrink-0 hidden dark:block"
                          referrerPolicy="no-referrer"
                        />
                      </>
                    )}
                    {((isVideo ? settings.videoModel : settings.imageModel).toLowerCase().includes('veo') || (isVideo ? settings.videoModel : settings.imageModel).toLowerCase().includes('gemini') || (isVideo ? settings.videoModel : settings.imageModel).toLowerCase().includes('imagen')) && (
                      <img
                        src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg"
                        alt="Google Gemini"
                        className="w-3.5 h-3.5 object-contain shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    {((isVideo ? settings.videoModel : settings.imageModel).toLowerCase().includes('seedance') || (isVideo ? settings.videoModel : settings.imageModel).toLowerCase().includes('seedream')) && (
                      <img
                        src="https://lf3-static.bytednsdoc.com/obj/eden-cn/lapzild-tss/ljhwZthlaukjlkulzlp/favicon_1/favicon.ico"
                        alt="ByteDance"
                        className="w-3.5 h-3.5 object-contain shrink-0 rounded-xs"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    {isVideo && settings.videoModel.toLowerCase().includes('kling') && (
                      <img
                        src="https://kling.ai/favicon.ico"
                        alt="Kling"
                        className="w-3.5 h-3.5 object-contain shrink-0 rounded-xs"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    {isVideo && (settings.videoModel === 'MiniMax H3 Turbo Video' || settings.videoModel === 'Motion Control AmbMedia 1080HD' || settings.videoModel === 'Motion Control' || settings.videoModel === 'S2 Motion Control' || settings.videoModel.toLowerCase().includes('ambmedia') || settings.videoModel.toLowerCase().includes('motionfly')) && (
                      <img
                        src="https://www.runninghub.ai/favicon.ico?v=1.4"
                        alt="RunningHub"
                        className="w-3.5 h-3.5 object-contain shrink-0 rounded-xs"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    {(isVideo ? settings.videoModel : settings.imageModel).toLowerCase().includes('grok') && (
                      <img
                        src="https://grok.com/images/favicon.ico"
                        alt="Grok"
                        className="w-3.5 h-3.5 object-contain shrink-0 rounded-xs"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    {((isVideo ? settings.videoModel : settings.imageModel).toLowerCase().includes('chatgpt') || (isVideo ? settings.videoModel : settings.imageModel).toLowerCase().includes('gpt')) && (
                      <div className="w-4 h-4 rounded-full bg-[#10a37f] flex items-center justify-center shrink-0 p-0.5 shadow-xs">
                        <img
                          src="https://chatgpt.com/cdn/assets/favicon-l4nq08hd.svg"
                          alt="GPT"
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    {((isVideo ? settings.videoModel : settings.imageModel).toLowerCase().includes('banana') || (isVideo ? settings.videoModel : settings.imageModel).toLowerCase().includes('nano')) && (
                      <img
                        src="https://devicons.io/devicons/icons/nanobanana.svg"
                        alt="Nano Banana Pro"
                        className="w-3.5 h-3.5 object-contain shrink-0 rounded-xs"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <span>
                      {isVideo && settings.videoModel === 'Google Vids Omni'
                        ? 'Vids Omni'
                        : getCleanModelName(isVideo ? settings.videoModel : settings.imageModel)}
                    </span>
                    <ChevronRight className={`w-4 h-4 text-stone-400 transition-transform ${activeDropdown === 'model' ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {activeDropdown === 'model' && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 p-2 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 shadow-md space-y-1 z-20 relative"
                  >
                    {isVideo
                      ? (currentProvider === 'vids'
                          ? (['Google Vids Omni'] as VideoModel[])
                          : currentProvider === 'gemini'
                          ? (['Omni Flash', 'Google Veo 2 / Gemini Video'] as VideoModel[])
                          : currentProvider === 'runninghub'
                          ? (['MiniMax H3 Turbo Video', 'S2 Motion Control', 'Motion Control'] as VideoModel[])
                          : currentProvider === 'kie'
                          ? (['Grok Imagine 1.5 Preview', 'Grok Imagine (Image-to-Video)', 'SeeDance 2.0 Mini'] as VideoModel[])
                          : currentProvider === 'galleri5'
                          ? (['Kling 2.6 Motion Control Standar'] as VideoModel[])
                          : currentProvider === 'roboneo'
                          ? (['Kling 2.6 Motion Control'] as VideoModel[])
                          : (['Kling 3.0 Pro Motion Control', 'SeeDance 2.5', 'SeeDance 2.0 Mini'] as VideoModel[])
                        ).map((m) => (
                          <button
                            key={m}
                            onClick={() => {
                              if (m === 'Google Vids Omni') {
                                onUpdateSettings({
                                  videoModel: 'Google Vids Omni',
                                  provider: currentProvider,
                                  videoDuration: '10 seconds',
                                  videoResolution: '1080p',
                                  videoAspectRatio: '9:16 (Vertical)',
                                });
                              } else if (m === 'Omni Flash' || m === 'Gemini Omni Flash Video (10s)') {
                                onUpdateSettings({
                                  videoModel: 'Omni Flash',
                                  provider: currentProvider,
                                  videoDuration: '10 seconds',
                                  videoResolution: '1080p',
                                  videoAspectRatio: settings.videoAspectRatio === '9:16 (Vertical)' || settings.videoAspectRatio === '1:1 (Square)' || settings.videoAspectRatio === '4:3' || settings.videoAspectRatio === '3:4' ? settings.videoAspectRatio : '16:9 (Landscape)',
                                });
                              } else if (m === 'Google Veo 2 / Gemini Video' || m === 'Google Veo 2') {
                                onUpdateSettings({
                                  videoModel: m,
                                  provider: currentProvider,
                                  videoDuration: '10 seconds',
                                  videoResolution: '1080p',
                                  videoAspectRatio: settings.videoAspectRatio === '9:16 (Vertical)' || settings.videoAspectRatio === '1:1 (Square)' || settings.videoAspectRatio === '4:3' || settings.videoAspectRatio === '3:4' ? settings.videoAspectRatio : '16:9 (Landscape)',
                                });
                              } else if (m === 'MiniMax H3 Turbo Video') {
                                onUpdateSettings({
                                  videoModel: m,
                                  provider: currentProvider,
                                  videoDuration: settings.videoDuration === '15 seconds' || settings.videoDuration === '10 seconds' ? settings.videoDuration : '10 seconds',
                                  videoResolution: settings.videoResolution === '768p' || settings.videoResolution === '720p' ? settings.videoResolution : '768p',
                                  videoAspectRatio: settings.videoAspectRatio === '16:9 (Landscape)' || settings.videoAspectRatio === '1:1 (Square)' || settings.videoAspectRatio === '4:3' || settings.videoAspectRatio === '3:4' ? settings.videoAspectRatio : '9:16 (Vertical)',
                                });
                              } else if (m === 'SeeDance 2.5' || m === 'Grok Imagine (Image-to-Video)' || (m as string) === 'grok-imagine/image-to-video') {
                                onUpdateSettings({ videoModel: m, provider: currentProvider, videoDuration: '5 seconds' });
                              } else if (m === 'SeeDance 2.0 Mini') {
                                onUpdateSettings({ videoModel: m, provider: currentProvider, videoResolution: '480p' });
                              } else {
                                onUpdateSettings({ videoModel: m, provider: currentProvider });
                              }
                              setActiveDropdown(null);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md hover:bg-amber-50 dark:hover:bg-stone-700 transition-colors text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              {m === 'Google Veo 2 / Gemini Video' || m === 'Gemini Omni Flash Video (10s)' || m.toLowerCase().includes('veo') || m.toLowerCase().includes('gemini') ? (
                                <img
                                  src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg"
                                  alt="Google Gemini"
                                  className="w-3.5 h-3.5 object-contain shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              ) : null}
                              {m === 'MiniMax H3 Turbo Video' || m === 'Motion Control' || m === 'S2 Motion Control' || m.toLowerCase().includes('runninghub') || m.toLowerCase().includes('ambmedia') || m.toLowerCase().includes('motionfly') ? (
                                <img
                                  src="https://www.runninghub.ai/favicon.ico?v=1.4"
                                  alt="RunningHub"
                                  className="w-3.5 h-3.5 object-contain shrink-0 rounded-xs"
                                  referrerPolicy="no-referrer"
                                />
                              ) : null}
                              {m.toLowerCase().includes('galleri5') && (
                                <>
                                  <img
                                    src="https://aistudio.galleri5.com/assets/Light%20mode-ClfS0paP.png"
                                    alt="Galleri5"
                                    className="w-3.5 h-3.5 object-contain shrink-0 dark:hidden"
                                    referrerPolicy="no-referrer"
                                  />
                                  <img
                                    src="https://aistudio.galleri5.com/assets/dark%20mode-D5XIT4aZ.png"
                                    alt="Galleri5"
                                    className="w-3.5 h-3.5 object-contain shrink-0 hidden dark:block"
                                    referrerPolicy="no-referrer"
                                  />
                                </>
                              )}
                              {m.toLowerCase().includes('seedance') && (
                                <img
                                  src="https://lf3-static.bytednsdoc.com/obj/eden-cn/lapzild-tss/ljhwZthlaukjlkulzlp/favicon_1/favicon.ico"
                                  alt="Seedance"
                                  className="w-3.5 h-3.5 object-contain shrink-0 rounded-xs"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              {m.toLowerCase().includes('kling') && (
                                <img
                                  src="https://kling.ai/favicon.ico"
                                  alt="Kling"
                                  className="w-3.5 h-3.5 object-contain shrink-0 rounded-xs"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              {m.toLowerCase().includes('grok') && (
                                <img
                                  src="https://grok.com/images/favicon.ico"
                                  alt="Grok"
                                  className="w-3.5 h-3.5 object-contain shrink-0 rounded-xs"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <span className={settings.videoModel === m || (m === 'Motion Control' && (settings.videoModel.toLowerCase().includes('ambmedia') || settings.videoModel.toLowerCase().includes('motionfly'))) ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-stone-700 dark:text-stone-200'}>
                                {m === 'Google Vids Omni' ? 'Vids Omni' : getCleanModelName(m)}
                              </span>
                            </div>
                            {(settings.videoModel === m || (m === 'Motion Control' && (settings.videoModel.toLowerCase().includes('ambmedia') || settings.videoModel.toLowerCase().includes('motionfly')))) && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                          </button>
                        ))
                      : (currentProvider === 'gemini'
                          ? (['Google Imagen 3 Pro', 'Gemini 3 Pro Image'] as ImageModel[])
                          : currentProvider === 'kie'
                          ? (['GPT Image 2 (Image-to-Image)', 'Seedream 4.0 Edit', 'GPT Image 2 (Text-to-Image)'] as ImageModel[])
                          : currentProvider === 'galleri5' || currentProvider === 'roboneo' || currentProvider === 'runninghub'
                          ? (['-'] as ImageModel[])
                          : (['Nano Banana Pro', 'Seedream V5.0 Pro Edit', 'ChatGPT Images 2.0 Edit', 'GPT Image 2.5', 'Grok Imagine Image'] as ImageModel[])
                        ).map((m) => (
                          <button
                            key={m}
                            onClick={() => {
                              onUpdateSettings({ imageModel: m, provider: currentProvider });
                              setActiveDropdown(null);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md hover:bg-amber-50 dark:hover:bg-stone-700 transition-colors text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              {m === 'Google Imagen 3 Pro' || m === 'Gemini 3 Pro Image' || m.toLowerCase().includes('imagen') || m.toLowerCase().includes('gemini') ? (
                                <img
                                  src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg"
                                  alt="Google Gemini"
                                  className="w-3.5 h-3.5 object-contain shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              ) : null}
                              {(m.toLowerCase().includes('seedance') || m.toLowerCase().includes('seedream')) && (
                                <img
                                  src="https://lf3-static.bytednsdoc.com/obj/eden-cn/lapzild-tss/ljhwZthlaukjlkulzlp/favicon_1/favicon.ico"
                                  alt="Seedream"
                                  className="w-3.5 h-3.5 object-contain shrink-0 rounded-xs"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              {m.toLowerCase().includes('grok') && (
                                <img
                                  src="https://grok.com/images/favicon.ico"
                                  alt="Grok"
                                  className="w-3.5 h-3.5 object-contain shrink-0 rounded-xs"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              {(m.toLowerCase().includes('chatgpt') || m.toLowerCase().includes('gpt')) && (
                                <div className="w-4 h-4 rounded-full bg-[#10a37f] flex items-center justify-center shrink-0 p-0.5 shadow-xs">
                                  <img
                                    src="https://chatgpt.com/cdn/assets/favicon-l4nq08hd.svg"
                                    alt="GPT"
                                    className="w-full h-full object-contain"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              )}
                              {(m.toLowerCase().includes('banana') || m.toLowerCase().includes('nano')) && (
                                <img
                                  src="https://devicons.io/devicons/icons/nanobanana.svg"
                                  alt="Nano Banana Pro"
                                  className="w-3.5 h-3.5 object-contain shrink-0 rounded-xs"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <span className={settings.imageModel === m ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-stone-700 dark:text-stone-200'}>{m}</span>
                            </div>
                            {settings.imageModel === m && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                          </button>
                        ))}
                  </motion.div>
                )}
              </div>

              {/* Show provider-supported aspect ratio and resolution controls */}
              {(!isVideo || currentProvider === 'gemini' || currentProvider === 'vids' || settings.videoModel === 'Google Veo 2 / Gemini Video' || settings.videoModel === 'Gemini Omni Flash Video (10s)' || settings.videoModel === 'MiniMax H3 Turbo Video' || settings.videoModel === 'SeeDance 2.0 Mini' || settings.videoModel === 'SeeDance 2.5' || settings.videoModel === 'Grok Imagine 1.5 Preview' || settings.videoModel === 'Grok Imagine (Image-to-Video)' || (settings.videoModel as string) === 'grok-imagine/image-to-video') && (
                <>
                  {/* 2. Aspect Ratio */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveDropdown(activeDropdown === 'aspect' ? null : 'aspect')}
                      className="w-full flex items-center justify-between p-3.5 bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100/80 dark:hover:bg-stone-800 rounded-lg border border-stone-200/80 dark:border-stone-700/80 transition-all text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Monitor className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                        <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Aspect Ratio</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-stone-900 dark:text-stone-100">
                        <span>{isVideo ? settings.videoAspectRatio : settings.imageAspectRatio}</span>
                        <ChevronRight className={`w-4 h-4 text-stone-400 transition-transform ${activeDropdown === 'aspect' ? 'rotate-90' : ''}`} />
                      </div>
                    </button>

                    {activeDropdown === 'aspect' && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 p-2 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 shadow-md space-y-1 max-h-48 overflow-y-auto z-20 relative"
                      >
                        {isVideo
                          ? (currentProvider === 'vids'
                              ? (['9:16 (Vertical)', '16:9 (Landscape)'] as VideoAspectRatio[])
                              : currentProvider === 'gemini' || settings.videoModel === 'Google Veo 2 / Gemini Video' || settings.videoModel === 'Gemini Omni Flash Video (10s)'
                              ? (['16:9 (Landscape)', '9:16 (Vertical)', '1:1 (Square)', '4:3', '3:4'] as VideoAspectRatio[])
                              : settings.videoModel === 'MiniMax H3 Turbo Video'
                              ? (['9:16 (Vertical)', '16:9 (Landscape)', '1:1 (Square)', '4:3', '3:4'] as VideoAspectRatio[])
                              : settings.videoModel === 'Grok Imagine 1.5 Preview' || settings.videoModel === 'Grok Imagine (Image-to-Video)' || (settings.videoModel as string) === 'grok-imagine/image-to-video'
                              ? (['16:9 (Landscape)', '9:16 (Vertical)', '1:1 (Square)', '4:3', '3:4', '3:2', '2:3', 'Auto'] as VideoAspectRatio[])
                              : (['9:16 (Vertical)', '16:9 (Landscape)', '1:1 (Square)', '4:3', '3:4', '21:9'] as VideoAspectRatio[])
                            ).map((ar) => (
                              <button
                                key={ar}
                                onClick={() => {
                                  onUpdateSettings({
                                    videoAspectRatio: ar,
                                  });
                                  setActiveDropdown(null);
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md hover:bg-amber-50 dark:hover:bg-stone-700 transition-colors text-left cursor-pointer"
                              >
                                <span className={settings.videoAspectRatio === ar ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-stone-700 dark:text-stone-200'}>{ar}</span>
                                {settings.videoAspectRatio === ar && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                              </button>
                            ))
                          : (['16:9 (Landscape)', '9:16 (Vertical)', '1:1 (Square)', '4:3 (Landscape)', '3:4 (Portrait)', 'Auto / Default'] as ImageAspectRatio[]).map((ar) => (
                              <button
                                key={ar}
                                onClick={() => {
                                  onUpdateSettings({ imageAspectRatio: ar });
                                  setActiveDropdown(null);
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md hover:bg-amber-50 dark:hover:bg-stone-700 transition-colors text-left cursor-pointer"
                              >
                                <span className={settings.imageAspectRatio === ar ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-stone-700 dark:text-stone-200'}>{ar}</span>
                                {settings.imageAspectRatio === ar && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                              </button>
                            ))}
                      </motion.div>
                    )}
                  </div>

                  {/* 3. Duration */}
                  {isVideo && currentProvider === 'vids' && (
                    <div className="space-y-3 rounded-lg border border-stone-200/80 bg-stone-50 p-3.5 dark:border-stone-700/80 dark:bg-stone-800/50">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Clock className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                          <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Video duration</span>
                        </div>
                        <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">{vidsDuration}s</span>
                      </div>
                      <input
                        type="range"
                        min={3}
                        max={15}
                        step={1}
                        value={vidsDuration}
                        aria-label="Google Vids video duration"
                        aria-valuetext={`${vidsDuration} seconds`}
                        onChange={(event) => {
                          onUpdateSettings({ videoDuration: `${event.target.value} seconds` as VideoDuration });
                        }}
                        className="h-2 w-full cursor-pointer appearance-none rounded-lg accent-amber-600"
                      />
                    </div>
                  )}
                  {isVideo && currentProvider !== 'vids' && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveDropdown(activeDropdown === 'duration' ? null : 'duration')}
                        className="w-full flex items-center justify-between p-3.5 bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100/80 dark:hover:bg-stone-800 rounded-lg border border-stone-200/80 dark:border-stone-700/80 transition-all text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <Clock className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                          <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Duration</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-stone-900 dark:text-stone-100">
                          <span>{settings.videoDuration}</span>
                          <ChevronRight className={`w-4 h-4 text-stone-400 transition-transform ${activeDropdown === 'duration' ? 'rotate-90' : ''}`} />
                        </div>
                      </button>

                      {activeDropdown === 'duration' && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-2 p-2 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 shadow-md space-y-1 max-h-48 overflow-y-auto z-20 relative"
                        >
                          {(() => {
                            const isOmniFlash =
                              currentProvider === 'gemini' ||
                              settings.videoModel === 'Omni Flash' ||
                              settings.videoModel === 'Google Veo 2 / Gemini Video' ||
                              settings.videoModel === 'Gemini Omni Flash Video (10s)';
                            const baseDurations = isOmniFlash
                              ? ['5 seconds', '6 seconds', '8 seconds', '10 seconds']
                              : settings.videoModel === 'MiniMax H3 Turbo Video'
                              ? ['5 seconds', '10 seconds', '15 seconds']
                              : settings.videoModel === 'Grok Imagine (Image-to-Video)' || (settings.videoModel as string) === 'grok-imagine/image-to-video'
                              ? ['5 seconds', '6 seconds', '8 seconds', '10 seconds', '15 seconds', '20 seconds', '25 seconds', '30 seconds']
                              : settings.videoModel === 'Grok Imagine 1.5 Preview'
                              ? ['5 seconds', '6 seconds', '8 seconds', '10 seconds', '15 seconds']
                              : settings.videoModel === 'SeeDance 2.5'
                              ? ['4 seconds', '6 seconds', '10 seconds', '15 seconds', '20 seconds', '25 seconds', '30 seconds']
                              : ['4 seconds', '5 seconds', '6 seconds', '8 seconds', '10 seconds', '12 seconds', '15 seconds'];
                            const allDurations = Array.from(
                              new Set(
                                isOmniFlash
                                  ? baseDurations
                                  : settings.videoDuration
                                  ? [...baseDurations, settings.videoDuration]
                                  : baseDurations
                              )
                            ).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
                            return allDurations.map((d) => (
                              <button
                                key={d}
                                onClick={() => {
                                  onUpdateSettings({ videoDuration: d as VideoDuration });
                                  setActiveDropdown(null);
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md hover:bg-amber-50 dark:hover:bg-stone-700 transition-colors text-left cursor-pointer"
                              >
                                <span className={settings.videoDuration === d ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-stone-700 dark:text-stone-200'}>{d}</span>
                                {settings.videoDuration === d && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                              </button>
                            ));
                          })()}
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* 4. Resolution */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveDropdown(activeDropdown === 'resolution' ? null : 'resolution')}
                      className="w-full flex items-center justify-between p-3.5 bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100/80 dark:hover:bg-stone-800 rounded-lg border border-stone-200/80 dark:border-stone-700/80 transition-all text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Tv className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                        <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Resolution</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-stone-900 dark:text-stone-100">
                        <span>{isVideo ? settings.videoResolution : settings.imageResolution}</span>
                        <ChevronRight className={`w-4 h-4 text-stone-400 transition-transform ${activeDropdown === 'resolution' ? 'rotate-90' : ''}`} />
                      </div>
                    </button>

                    {activeDropdown === 'resolution' && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 p-2 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 shadow-md space-y-1 z-20 relative"
                      >
                        {isVideo
                          ? (currentProvider === 'vids'
                              ? (['1080p', '720p'] as VideoResolution[])
                              : currentProvider === 'gemini'
                              ? (['1080p', '720p'] as VideoResolution[])
                              : settings.videoModel === 'MiniMax H3 Turbo Video'
                              ? (['720p', '768p', '1080p'] as VideoResolution[])
                              : settings.videoModel === 'Grok Imagine 1.5 Preview' || settings.videoModel === 'Grok Imagine (Image-to-Video)' || (settings.videoModel as string) === 'grok-imagine/image-to-video'
                              ? (['1080p', '720p', '480p'] as VideoResolution[])
                              : (['720p', '480p'] as VideoResolution[])
                            ).map((r) => (
                              <button
                                key={r}
                                onClick={() => {
                                  onUpdateSettings({ videoResolution: r });
                                  setActiveDropdown(null);
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md hover:bg-amber-50 dark:hover:bg-stone-700 transition-colors text-left cursor-pointer"
                              >
                                <span className={settings.videoResolution === r ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-stone-700 dark:text-stone-200'}>{r}</span>
                                {settings.videoResolution === r && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                              </button>
                            ))
                          : (['1024 x 1024'] as ImageResolution[]).map((r) => (
                              <button
                                key={r}
                                onClick={() => {
                                  onUpdateSettings({ imageResolution: r });
                                  setActiveDropdown(null);
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md hover:bg-amber-50 dark:hover:bg-stone-700 transition-colors text-left cursor-pointer"
                              >
                                <span className={settings.imageResolution === r ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-stone-700 dark:text-stone-200'}>{r}</span>
                                {settings.imageResolution === r && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                              </button>
                            ))}
                      </motion.div>
                    )}
                  </div>

                  {/* 5. Audio / Sound Toggle */}
                  {isVideo && currentProvider !== 'vids' && settings.videoModel !== 'Grok Imagine 1.5 Preview' && settings.videoModel !== 'MiniMax H3 Turbo Video' && (
                    <div className="flex items-center justify-between p-3.5 bg-stone-50 dark:bg-stone-800/50 rounded-lg border border-stone-200/80 dark:border-stone-700/80 transition-all">
                      <div className="flex items-center gap-3">
                        <Volume2 className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Audio / Sound</span>
                          <span className="text-[10px] text-stone-400 font-light">Generasi audio AI otomatis</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ enableAudio: !settings.enableAudio })}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          settings.enableAudio ? 'bg-amber-600' : 'bg-stone-300 dark:bg-stone-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                            settings.enableAudio ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  )}
                </>
              )}

              {isVideo && (settings.videoModel === 'Grok Imagine (Image-to-Video)' || (settings.videoModel as string) === 'grok-imagine/image-to-video') && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-stone-800 dark:text-stone-200 leading-relaxed font-medium space-y-1">
                  <div>
                    ✨ <span className="font-bold text-amber-700 dark:text-amber-400">Grok Imagine (Image-to-Video)</span> (Kie.ai): Mendukung durasi panjang hingga <b>30 detik</b>! Biaya 2.4 credits/detik (480p) atau 4.5 credits/detik (720p/1080p).
                  </div>
                  <div className="text-[11px] text-stone-600 dark:text-stone-400">
                    ⚡ Sistem secara otomatis memverifikasi dan memilih akun Kie.ai dengan sisa kredit yang mencukupi saat kamu klik <b>Generate</b>!
                  </div>
                </div>
              )}

              {isVideo && settings.videoModel === 'Grok Imagine 1.5 Preview' && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-stone-800 dark:text-stone-200 leading-relaxed font-medium space-y-1">
                  <div>
                    ✨ <span className="font-bold text-amber-700 dark:text-amber-400">Grok Imagine 1.5 Preview</span> (Kie.ai): Durasi cepat (hingga 15 detik). Biaya 2.4 credits/detik (480p) atau 4.5 credits/detik (720p/1080p).
                  </div>
                  <div className="text-[11px] text-stone-600 dark:text-stone-400">
                    ⚡ Sistem secara otomatis memverifikasi dan memilih akun Kie.ai dengan sisa kredit yang mencukupi saat kamu klik <b>Generate</b>!
                  </div>
                </div>
              )}

              {isVideo && settings.videoModel === 'Kling 3.0 Pro Motion Control' && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-stone-800 dark:text-stone-200 leading-relaxed font-medium">
                  ✨ <span className="font-bold text-amber-700 dark:text-amber-400">Kling 3.0 Pro Motion Control</span> secara otomatis menyesuaikan durasi, resolusi, dan aspek rasio dari file referensi gambar & video gerakan yang kamu unggah.
                </div>
              )}

              {isVideo && settings.videoModel === 'SeeDance 2.5' && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-stone-800 dark:text-stone-200 leading-relaxed font-medium">
                  ✨ <span className="font-bold text-amber-700 dark:text-amber-400">SeeDance 2.5</span> mendukung hingga 5 gambar referensi dan durasi video hingga 30 detik.
                </div>
              )}

              {!isVideo && settings.imageModel === '-' && (
                <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 rounded-xl text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                  ⚠️ Provider <span className="font-bold">{currentProvider === 'galleri5' ? 'Galleri5' : 'RoboNeo'}</span> belum memiliki model pembuat gambar (Image). Silakan ganti ke mode Video atau pilih provider Weavy/Kie.ai untuk membuat gambar.
                </div>
              )}

              {!isVideo && (settings.imageModel === 'GPT Image 2 (Image-to-Image)' || settings.imageModel === 'Seedream 4.0 Edit' || settings.imageModel === 'GPT Image 2 (Text-to-Image)') && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-stone-800 dark:text-stone-200 leading-relaxed font-medium space-y-1">
                  <div>
                    ✨ <span className="font-bold text-amber-700 dark:text-amber-400">{settings.imageModel}</span> (Kie.ai) mendukung pengeditan gambar presisi ByteDance/OpenAI hingga kualitas 4K berdasarkan referensi & prompt teks!
                  </div>
                  <div className="text-[11px] text-stone-600 dark:text-stone-400">
                    ⚡ Sistem secara otomatis memverifikasi dan memilih akun Kie.ai dengan sisa kredit yang mencukupi saat kamu klik <b>Generate</b>!
                  </div>
                </div>
              )}

              {!isVideo && settings.imageModel === 'Grok Imagine Image' && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-stone-800 dark:text-stone-200 leading-relaxed font-medium">
                  ✨ <span className="font-bold text-amber-700 dark:text-amber-400">Grok Imagine Image</span> (xAI) mendukung teks-ke-gambar super cepat, serta edit pose & gaya dari referensi gambar!
                </div>
              )}

              {!isVideo && (settings.imageModel === 'Nano Banana Pro' || (settings.imageModel as string) === 'Nano Banana 2') && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-stone-800 dark:text-stone-200 leading-relaxed font-medium flex items-center gap-2">
                  <img
                    src="https://devicons.io/devicons/icons/nanobanana.svg"
                    alt="Nano Banana Pro"
                    className="w-4 h-4 object-contain shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    ✨ <span className="font-bold text-amber-700 dark:text-amber-400">Nano Banana Pro</span> mendukung generasi gambar & edit pose/kamera berakurasi tinggi (1K, 2K, 4K resolution)!
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
};
