import React from 'react';
import {
  Sparkles,
  Layers,
  History,
  Workflow,
  MessageSquare,
  Clapperboard,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import { NavTab, GenerationSettings, AIProvider } from '../types';
import { ProviderAccount } from './GlobalSettingsView';
import { resolveActiveProvider, GEMINI_MAX_CREDITS } from '../lib/provider';

interface DesktopSidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onSelectProvider: (providerId: string) => void;
  selectedProviderId?: string | null;
  weavyAccountsCount: number;
  weavyAccounts?: ProviderAccount[];
  geminiAccountsCount?: number;
  geminiAccounts?: ProviderAccount[];
  roboneoAccountsCount?: number;
  roboneoAccounts?: ProviderAccount[];
  galleri5AccountsCount?: number;
  galleri5Accounts?: ProviderAccount[];
  kieAccountsCount?: number;
  kieAccounts?: ProviderAccount[];
  flowAccountsCount?: number;
  flowAccounts?: ProviderAccount[];
  runninghubAccountsCount?: number;
  runninghubAccounts?: ProviderAccount[];
  settings?: GenerationSettings;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  onTabChange,
  onSelectProvider,
  selectedProviderId,
  weavyAccountsCount,
  weavyAccounts = [],
  geminiAccountsCount = 0,
  geminiAccounts = [],
  flowAccountsCount = 0,
  flowAccounts = [],
  roboneoAccountsCount = 0,
  roboneoAccounts = [],
  galleri5AccountsCount = 0,
  galleri5Accounts = [],
  kieAccountsCount = 0,
  kieAccounts = [],
  runninghubAccountsCount = 0,
  runninghubAccounts = [],
  settings,
}) => {
  const activeProvider = resolveActiveProvider(settings, activeTab, selectedProviderId);
  const activeProviderId: AIProvider = activeProvider.id;
  const isGeminiActive = activeProviderId === 'gemini';
  const isFlowActive = activeProviderId === 'flow';
  const isRunningHubActive = activeProviderId === 'runninghub';
  const isRoboneoActive = activeProviderId === 'roboneo';
  const isGalleri5Active = activeProviderId === 'galleri5';
  const isKieActive = activeProviderId === 'kie';
  const isWeavyActive = activeProviderId === 'weavy';

  const normalizedGeminiAccounts = geminiAccounts.map((a) => ({
    ...a,
    credits: typeof a.credits === 'number' ? Math.min(GEMINI_MAX_CREDITS, Math.max(0, a.credits)) : 0,
    totalCredits: GEMINI_MAX_CREDITS,
  }));

  const normalizedFlowAccounts = flowAccounts.map((a) => ({
    ...a,
    credits: typeof a.credits === 'number' ? Math.max(0, a.credits) : (a.credits ?? 50),
    totalCredits: typeof a.totalCredits === 'number' && a.totalCredits > 0 ? a.totalCredits : 50,
  }));

  const accs = isGeminiActive
    ? normalizedGeminiAccounts
    : isFlowActive
    ? normalizedFlowAccounts
    : isRunningHubActive
    ? runninghubAccounts
    : isKieActive
    ? kieAccounts
    : isGalleri5Active
    ? galleri5Accounts
    : isRoboneoActive
    ? roboneoAccounts
    : weavyAccounts;
  const savedActiveId = (() => {
    try {
      return localStorage.getItem(`${activeProviderId}_active_account_id`);
    } catch (e) {
      return null;
    }
  })();
  const savedActiveAcc = savedActiveId ? accs.find((a) => a.id === savedActiveId && (!a.accountStatus || a.accountStatus === 'active')) : null;
  const explicitlyActive = accs.find((a) => a.isActive && (!a.accountStatus || a.accountStatus === 'active'));
  const activeAcc = savedActiveAcc || explicitlyActive || accs.find((a) => !a.accountStatus || a.accountStatus === 'active') || accs[0];

  const activeAccCredits = activeAcc
    ? (isGeminiActive
        ? Math.min(GEMINI_MAX_CREDITS, typeof activeAcc.credits === 'number' ? activeAcc.credits : 0)
        : (typeof activeAcc.credits === 'number' ? activeAcc.credits : 0))
    : 0;

  const defaultProviderQuota = isGeminiActive ? GEMINI_MAX_CREDITS : activeProvider.defaultQuota;

  const remaining = isGeminiActive
    ? accs.reduce((sum, a) => sum + (typeof a.credits === 'number' ? Math.min(GEMINI_MAX_CREDITS, a.credits) : 0), 0)
    : accs.reduce((sum, a) => sum + (typeof a.credits === 'number' ? a.credits : 0), 0);
  const quota = isGeminiActive
    ? Math.max(GEMINI_MAX_CREDITS, accs.length * GEMINI_MAX_CREDITS)
    : accs.reduce((sum, a) => {
        const cred = typeof a.credits === 'number' ? a.credits : 0;
        const tot = typeof a.totalCredits === 'number' && a.totalCredits > 0 ? a.totalCredits : 0;
        return sum + (tot > defaultProviderQuota ? tot : Math.max(cred, defaultProviderQuota));
      }, 0);
  const pct = quota > 0 ? Math.min(100, Math.round((remaining / quota) * 1000) / 10) : 0;

  return (
    <aside className="hidden lg:flex flex-col w-56 xl:w-60 bg-[#ECE9E3] dark:bg-[#0E0E12] border-r border-stone-300 dark:border-white/8 h-screen sticky top-0 shrink-0 p-3 justify-between overflow-y-auto no-scrollbar z-20 select-none">
      <div className="space-y-5">
        {/* App Branding */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-display text-lg font-normal text-stone-900 dark:text-stone-100 tracking-tight leading-none whitespace-nowrap">AMB Media</h1>
            <p className="font-sans-body text-[11px] text-stone-500 dark:text-stone-400 font-light mt-0.5">AI Video Generator</p>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => onTabChange('generate')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-xs border transition-colors duration-100 outline-none select-none cursor-pointer ${
              activeTab === 'generate'
                ? 'bg-stone-200/80 dark:bg-amber-500/15 border-stone-300 dark:border-amber-500/25 text-amber-800 dark:text-amber-300 font-bold'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/60 dark:hover:bg-white/5'
            }`}
          >
            <Sparkles className={`w-4 h-4 shrink-0 transition-colors duration-100 ${activeTab === 'generate' ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400 dark:text-stone-500'}`} />
            <span>Generate</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('history')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-xs border transition-colors duration-100 outline-none select-none cursor-pointer ${
              activeTab === 'history'
                ? 'bg-stone-200/80 dark:bg-amber-500/15 border-stone-300 dark:border-amber-500/25 text-amber-800 dark:text-amber-300 font-bold'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/60 dark:hover:bg-white/5'
            }`}
          >
            <History className={`w-4 h-4 shrink-0 transition-colors duration-100 ${activeTab === 'history' ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400 dark:text-stone-500'}`} />
            <span>History</span>
          </button>

          {/* Menu Batch disembunyikan sementara */}
          {/*
          <button
            type="button"
            onClick={() => onTabChange('batch')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-xs border transition-colors duration-100 outline-none select-none cursor-pointer ${
              activeTab === 'batch'
                ? 'bg-stone-200/80 dark:bg-amber-500/15 border-stone-300 dark:border-amber-500/25 text-amber-800 dark:text-amber-300 font-bold'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/60 dark:hover:bg-white/5'
            }`}
          >
            <Layers className={`w-4 h-4 shrink-0 transition-colors duration-100 ${activeTab === 'batch' ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400 dark:text-stone-500'}`} />
            <span>Batch</span>
          </button>
          */}

          <button
            type="button"
            onClick={() => onTabChange('chat')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-xs border transition-colors duration-100 outline-none select-none cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-stone-200/80 dark:bg-amber-500/15 border-stone-300 dark:border-amber-500/25 text-amber-800 dark:text-amber-300 font-bold'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/60 dark:hover:bg-white/5'
            }`}
          >
            <MessageSquare className={`w-4 h-4 shrink-0 transition-colors duration-100 ${activeTab === 'chat' ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400 dark:text-stone-500'}`} />
            <span>Chat</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('canvas')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-xs border transition-colors duration-100 outline-none select-none cursor-pointer ${
              activeTab === 'canvas'
                ? 'bg-stone-200/80 dark:bg-amber-500/15 border-stone-300 dark:border-amber-500/25 text-amber-800 dark:text-amber-300 font-bold'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/60 dark:hover:bg-white/5'
            }`}
          >
            <Workflow className={`w-4 h-4 shrink-0 transition-colors duration-100 ${activeTab === 'canvas' ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400 dark:text-stone-500'}`} />
            <span>Canvas</span>
          </button>

          {/* Menu Studio disembunyikan sementara */}
          {/*
          <button
            type="button"
            onClick={() => onTabChange('studio')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md font-medium text-xs border transition-colors duration-100 outline-none select-none cursor-pointer ${
              activeTab === 'studio'
                ? 'bg-stone-200/80 dark:bg-amber-500/15 border-stone-300 dark:border-amber-500/25 text-amber-800 dark:text-amber-300 font-bold'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/60 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <Clapperboard className={`w-4 h-4 shrink-0 transition-colors duration-100 ${activeTab === 'studio' ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400 dark:text-stone-500'}`} />
              <span>Studio</span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
              New
            </span>
          </button>
          */}
        </div>

        {/* Management Section */}
        <div className="space-y-1 pt-2 border-t border-stone-200/60 dark:border-white/8">
          <p className="px-3 text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
            Management
          </p>

          {/* Settings Tree with Sub-menus */}
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => onTabChange('settings')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md font-medium text-xs border transition-colors duration-100 outline-none select-none cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-stone-200/80 dark:bg-amber-500/15 border-stone-300 dark:border-amber-500/25 text-amber-800 dark:text-amber-300 font-bold'
                  : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/60 dark:hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <SlidersHorizontal className={`w-4 h-4 shrink-0 transition-colors duration-100 ${activeTab === 'settings' ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400 dark:text-stone-500'}`} />
                <span>Settings</span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${activeTab === 'settings' ? 'rotate-180 text-amber-600 dark:text-amber-400' : 'text-stone-400'}`} />
            </button>

            {/* Submenu for Providers under Settings */}
            <div className="ml-3 pl-2.5 pr-1 py-1 space-y-0.5 border-l-2 border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => onSelectProvider('weavy')}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium border transition-colors duration-100 cursor-pointer ${
                  activeTab === 'settings' && activeProviderId === 'weavy'
                    ? 'bg-amber-100/60 dark:bg-stone-800/90 border-amber-500/20 dark:border-white/10 text-amber-800 dark:text-amber-300 font-semibold'
                    : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/50 dark:hover:bg-white/5'
                }`}
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
                  <span>Weavy</span>
                </div>
                <span className="text-xs font-mono font-medium text-stone-500 dark:text-stone-400">
                  {weavyAccountsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelectProvider('gemini')}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium border transition-colors duration-100 cursor-pointer ${
                  activeTab === 'settings' && activeProviderId === 'gemini'
                    ? 'bg-amber-100/60 dark:bg-stone-800/90 border-amber-500/20 dark:border-white/10 text-amber-800 dark:text-amber-300 font-semibold'
                    : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/50 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <img
                    src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg"
                    alt="Google Gemini"
                    className="w-4.5 h-4.5 rounded object-contain shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <span>Google Gemini</span>
                </div>
                <span className="text-xs font-mono font-medium text-stone-500 dark:text-stone-400">
                  {geminiAccountsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelectProvider('flow')}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium border transition-colors duration-100 cursor-pointer ${
                  activeTab === 'settings' && activeProviderId === 'flow'
                    ? 'bg-amber-100/60 dark:bg-stone-800/90 border-amber-500/20 dark:border-white/10 text-amber-800 dark:text-amber-300 font-semibold'
                    : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/50 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <img
                    src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg"
                    alt="Google Flow"
                    className="w-4.5 h-4.5 rounded object-contain shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <span>Google Flow</span>
                </div>
                <span className="text-xs font-mono font-medium text-stone-500 dark:text-stone-400">
                  {flowAccountsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelectProvider('runninghub')}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium border transition-colors duration-100 cursor-pointer ${
                  activeTab === 'settings' && activeProviderId === 'runninghub'
                    ? 'bg-amber-100/60 dark:bg-stone-800/90 border-amber-500/20 dark:border-white/10 text-amber-800 dark:text-amber-300 font-semibold'
                    : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/50 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <img
                    src="https://www.runninghub.ai/favicon.ico?v=1.4"
                    alt="RunningHub"
                    className="w-4.5 h-4.5 rounded object-contain shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <span>RunningHub</span>
                </div>
                <span className="text-xs font-mono font-medium text-stone-500 dark:text-stone-400">
                  {runninghubAccountsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelectProvider('roboneo')}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium border transition-colors duration-100 cursor-pointer ${
                  activeTab === 'settings' && activeProviderId === 'roboneo'
                    ? 'bg-amber-100/60 dark:bg-stone-800/90 border-amber-500/20 dark:border-white/10 text-amber-800 dark:text-amber-300 font-semibold'
                    : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/50 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <img
                    src="https://www.roboneo.com/favicon.ico"
                    alt="RoboNeo"
                    className="w-4.5 h-4.5 rounded object-contain shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <span>RoboNeo</span>
                </div>
                <span className="text-xs font-mono font-medium text-stone-500 dark:text-stone-400">
                  {roboneoAccountsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelectProvider('kie')}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium border transition-colors duration-100 cursor-pointer ${
                  activeTab === 'settings' && activeProviderId === 'kie'
                    ? 'bg-amber-100/60 dark:bg-stone-800/90 border-amber-500/20 dark:border-white/10 text-amber-800 dark:text-amber-300 font-semibold'
                    : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/50 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <img
                    src="https://kie.ai/logo.png"
                    alt="Kie.ai"
                    className="w-4.5 h-4.5 rounded object-contain shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <span>Kie.ai</span>
                </div>
                <span className="text-xs font-mono font-medium text-stone-500 dark:text-stone-400">
                  {kieAccountsCount}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Credits Overview Card (Bottom Pinned) */}
      <div className="mt-auto pt-3 border-t border-stone-200/60 dark:border-white/8">
        <div className="bg-stone-50/80 dark:bg-[#16161D] hover:bg-stone-100/80 dark:hover:bg-[#1D1D26] rounded-xl p-2.5 border border-stone-200/80 dark:border-white/10 transition-all space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isGeminiActive || isFlowActive ? (
                <img
                  src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg"
                  alt={isFlowActive ? "Google Flow" : "Google Gemini"}
                  className="w-5 h-5 object-contain shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : isRunningHubActive ? (
                <img
                  src="https://www.runninghub.ai/favicon.ico?v=1.4"
                  alt="RunningHub"
                  className="w-5 h-5 object-contain shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : isKieActive ? (
                <img
                  src="https://kie.ai/logo.png"
                  alt="Kie.ai"
                  className="w-5 h-5 object-contain shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : isGalleri5Active ? (
                <>
                  <img
                    src="https://aistudio.galleri5.com/assets/Light%20mode-ClfS0paP.png"
                    alt="Galleri5"
                    className="w-5 h-5 object-contain shrink-0 dark:hidden"
                    referrerPolicy="no-referrer"
                  />
                  <img
                    src="https://aistudio.galleri5.com/assets/dark%20mode-D5XIT4aZ.png"
                    alt="Galleri5"
                    className="w-5 h-5 object-contain shrink-0 hidden dark:block"
                    referrerPolicy="no-referrer"
                  />
                </>
              ) : isRoboneoActive ? (
                <img
                  src="https://www.roboneo.com/favicon.ico"
                  alt="RoboNeo"
                  className="w-5 h-5 object-contain shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <>
                  <img
                    src="https://cdn.prod.website-files.com/681b040781d5b5e278a69989/6829dad31872740b3fb4f912_favicon.svg"
                    alt="Weavy"
                    className="w-5 h-5 object-contain shrink-0 dark:hidden"
                    referrerPolicy="no-referrer"
                  />
                  <img
                    src="https://cdn.prod.website-files.com/681b040781d5b5e278a69989/69d4f1efa9dc89ccca92be1a_logo%20-%20squeare%20Weavy%20W.svg"
                    alt="Weavy"
                    className="w-5 h-5 object-contain shrink-0 hidden dark:block"
                    referrerPolicy="no-referrer"
                  />
                </>
              )}
              <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                {activeProvider.name}
              </span>
            </div>
            <div className="text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">
              {activeAccCredits.toLocaleString()} <span className="text-[10px] font-normal text-stone-400">{activeProvider.creditUnit || (isRunningHubActive ? 'Coins' : 'Credits')}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-stone-200/80 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-amber-500 dark:bg-gradient-to-r dark:from-amber-500 dark:to-amber-400 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px]">
            <span className="text-stone-500 dark:text-stone-400 font-light">Total Keseluruhan</span>
            <span className="font-mono font-medium text-amber-600 dark:text-amber-400">
              {remaining.toLocaleString()} <span className="text-stone-400 font-normal">/ {quota.toLocaleString()}</span>
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
