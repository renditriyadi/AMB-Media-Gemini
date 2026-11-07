import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { PromptCard, WireframeGenState } from './components/PromptCard';
import { RecentGenerations } from './components/RecentGenerations';
import { AddMediaModal } from './components/AddMediaModal';
import { SettingsModal } from './components/SettingsModal';
import { InfoModal } from './components/InfoModal';
import { GenerationDetailModal } from './components/GenerationDetailModal';
import { HistoryView } from './components/HistoryView';
import { GlobalSettingsView } from './components/GlobalSettingsView';
import { ProfileView } from './components/ProfileView';
import { DesktopSidebar } from './components/DesktopSidebar';
import { BatchView } from './components/BatchView';
import { CanvasView } from './components/CanvasView';
import { ChatView } from './components/ChatView';
import { StudioView } from './components/StudioView';
import { ThemeSlideOverlay } from './components/ThemeSlideOverlay';
import { LoginModal } from './components/LoginModal';
import { AuthScreen } from './components/AuthScreen';

import {
  NavTab,
  GenerationSettings,
  AttachedMedia,
  GenerationItem,
  ProviderAccount,
  AppUser,
  AIProvider,
  VideoModel,
  ImageModel,
  VideoDuration,
  VideoAspectRatio,
  ImageAspectRatio,
  getCleanPrompt,
  getCleanModelName,
} from './types';
import { INITIAL_GENERATIONS } from './data/mockData';
import { autoImportWeavyAccountForEmail, exchangeRefreshTokenAndGetInfo } from './lib/weavy';
import { fetchWeavyHistory, deleteWeavyRecipe, pollWeavyStatusOnce } from './lib/weavyApi';
import {
  acquireGeminiAccountLease,
  buildGeminiPayloadAccounts,
  type GeminiAccountLease,
} from './lib/geminiAccountManager';
import { executeGeminiVideoWithAutoSwitchAndRetry } from './lib/geminiVideoRunner';
import { safeFetchJson, uploadMediaWithProgress } from './utils';
import { resolveActiveProvider, resolveActiveProviderId } from './lib/provider';
import { GEMINI_MAX_CREDITS } from './lib/provider';
import { extensionBridge } from './lib/extensionBridge';

// Helper to read file to Base64 with optional progress callback
const readFileAsBase64 = (file: File, onProgress?: (percent: number) => void): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('generate');
  const [externalProviderId, setExternalProviderId] = useState<string | null>(null);
  const [accountsTick, setAccountsTick] = useState(0);

  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem('amb_active_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.userName) return parsed;
      }
    } catch (e) {}
    return null;
  });
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const handleLoginSuccess = async (user: AppUser) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('amb_active_user', JSON.stringify(user));
    } catch (e) {}

    // Immediately fetch user's provider accounts from spreadsheet
    if (user?.userId) {
      try {
        const resp = await fetch(`/api/providers/accounts?userId=${encodeURIComponent(user.userId)}`);
        const data = await resp.json();
        if (resp.ok && data.success && data.accounts) {
          const { weavy, roboneo, galleri5, kie, runninghub, gemini, flow, vids } = data.accounts;
          const mergeWithLocal = (storageKey: string, remoteAccs: any[], defaultCredits: number) => {
            if (!Array.isArray(remoteAccs) || remoteAccs.length === 0) return;
            try {
              const rawLocal = localStorage.getItem(storageKey);
              const localList: any[] = rawLocal ? JSON.parse(rawLocal) : [];
              const activeKey = `${storageKey.replace('_accounts', '')}_active_account_id`;
              const savedActiveId = localStorage.getItem(activeKey);

              const merged = remoteAccs.map((r: any, idx: number) => {
                const matchedLocal = localList.find((l) =>
                  (r.id && l.id === r.id) ||
                  (r.email && l.email && l.email.toLowerCase() === r.email.toLowerCase()) ||
                  (r.refreshToken && l.refreshToken === r.refreshToken)
                );
                const isThisActive = savedActiveId
                  ? (r.id === savedActiveId || matchedLocal?.id === savedActiveId)
                  : (matchedLocal?.isActive ?? r.isActive ?? (idx === 0));

                const resolvedStatus = (matchedLocal?.accountStatus && matchedLocal.accountStatus !== 'active')
                  ? matchedLocal.accountStatus
                  : (r.accountStatus || matchedLocal?.accountStatus || 'active');
                const isDead = resolvedStatus !== 'active';
                const effectiveCredits = isDead
                  ? 0
                  : (typeof matchedLocal?.credits === 'number'
                      ? matchedLocal.credits
                      : (typeof r.credits === 'number' ? r.credits : (storageKey === 'gemini_accounts' ? 0 : defaultCredits)));

                return {
                  ...r,
                  id: matchedLocal?.id || r.id,
                  isActive: isDead ? false : Boolean(isThisActive),
                  accountStatus: resolvedStatus,
                  statusMessage: matchedLocal?.statusMessage || r.statusMessage,
                  credits: effectiveCredits,
                  creditSyncStatus: storageKey === 'gemini_accounts'
                    ? (r.creditSyncStatus || matchedLocal?.creditSyncStatus || 'unknown')
                    : undefined,
                  totalCredits: typeof matchedLocal?.totalCredits === 'number' ? matchedLocal.totalCredits : (typeof r.totalCredits === 'number' ? r.totalCredits : (storageKey === 'gemini_accounts' ? GEMINI_MAX_CREDITS : (storageKey === 'flow_accounts' ? 50 : (storageKey === 'vids_accounts' ? 500 : undefined)))),
                  cookies: r.cookies || matchedLocal?.cookies || (r.refreshToken?.includes('SAPISID=') ? r.refreshToken : matchedLocal?.refreshToken),
                  docId: r.docId || matchedLocal?.docId,
                  serverToken: r.serverToken || matchedLocal?.serverToken,
                };
              });
              localStorage.setItem(storageKey, JSON.stringify(merged));
            } catch (e) {
              localStorage.setItem(storageKey, JSON.stringify(remoteAccs));
            }
          };

          mergeWithLocal('weavy_accounts', weavy, 150);
          mergeWithLocal('flow_accounts', flow, 50);
          mergeWithLocal('gemini_accounts', gemini, GEMINI_MAX_CREDITS);
          mergeWithLocal('vids_accounts', vids, 500);
          mergeWithLocal('runninghub_accounts', runninghub, 600);
          mergeWithLocal('roboneo_accounts', roboneo, 100);
          mergeWithLocal('galleri5_accounts', galleri5, 100);
          mergeWithLocal('kie_accounts', kie, 80);

          window.dispatchEvent(new Event('accounts-updated'));
          window.dispatchEvent(new Event('weavy_accounts_updated'));
          window.dispatchEvent(new Event('gemini_accounts_updated'));
          window.dispatchEvent(new Event('flow_accounts_updated'));
          window.dispatchEvent(new Event('vids_accounts_updated'));
        }
      } catch (err) {
        console.warn('[App login sync accounts]:', err);
      }
    }
  };

  // Sync provider accounts on mount if currentUser exists
  React.useEffect(() => {
    if (!currentUser?.userId) return;
    const fetchAccountsOnStart = async () => {
      try {
        const resp = await fetch(`/api/providers/accounts?userId=${encodeURIComponent(currentUser.userId)}`);
        const data = await resp.json();
        if (resp.ok && data.success && data.accounts) {
          const { weavy, roboneo, galleri5, kie, runninghub, gemini, flow, vids } = data.accounts;
          const mergeWithLocal = (storageKey: string, remoteAccs: any[], defaultCredits: number) => {
            if (!Array.isArray(remoteAccs) || remoteAccs.length === 0) return;
            try {
              const rawLocal = localStorage.getItem(storageKey);
              const localList: any[] = rawLocal ? JSON.parse(rawLocal) : [];
              const activeKey = `${storageKey.replace('_accounts', '')}_active_account_id`;
              const savedActiveId = localStorage.getItem(activeKey);

              const merged = remoteAccs.map((r: any, idx: number) => {
                const matchedLocal = localList.find((l) =>
                  (r.id && l.id === r.id) ||
                  (r.email && l.email && l.email.toLowerCase() === r.email.toLowerCase()) ||
                  (r.refreshToken && l.refreshToken === r.refreshToken)
                );
                const isThisActive = savedActiveId
                  ? (r.id === savedActiveId || matchedLocal?.id === savedActiveId)
                  : (matchedLocal?.isActive ?? r.isActive ?? (idx === 0));

                const resolvedStatus = (matchedLocal?.accountStatus && matchedLocal.accountStatus !== 'active')
                  ? matchedLocal.accountStatus
                  : (r.accountStatus || matchedLocal?.accountStatus || 'active');
                const isDead = resolvedStatus !== 'active';
                const effectiveCredits = isDead
                  ? 0
                  : (typeof matchedLocal?.credits === 'number'
                      ? matchedLocal.credits
                      : (typeof r.credits === 'number' ? r.credits : (storageKey === 'gemini_accounts' ? 0 : defaultCredits)));

                return {
                  ...r,
                  id: matchedLocal?.id || r.id,
                  isActive: isDead ? false : Boolean(isThisActive),
                  accountStatus: resolvedStatus,
                  statusMessage: matchedLocal?.statusMessage || r.statusMessage,
                  credits: effectiveCredits,
                  creditSyncStatus: storageKey === 'gemini_accounts'
                    ? (r.creditSyncStatus || matchedLocal?.creditSyncStatus || 'unknown')
                    : undefined,
                  totalCredits: typeof matchedLocal?.totalCredits === 'number' ? matchedLocal.totalCredits : (typeof r.totalCredits === 'number' ? r.totalCredits : (storageKey === 'gemini_accounts' ? GEMINI_MAX_CREDITS : (storageKey === 'flow_accounts' ? 50 : (storageKey === 'vids_accounts' ? 500 : undefined)))),
                  cookies: r.cookies || matchedLocal?.cookies || (r.refreshToken?.includes('SAPISID=') ? r.refreshToken : matchedLocal?.refreshToken),
                  docId: r.docId || matchedLocal?.docId,
                  serverToken: r.serverToken || matchedLocal?.serverToken,
                };
              });
              localStorage.setItem(storageKey, JSON.stringify(merged));
            } catch (e) {
              localStorage.setItem(storageKey, JSON.stringify(remoteAccs));
            }
          };

          mergeWithLocal('weavy_accounts', weavy, 150);
          mergeWithLocal('flow_accounts', flow, 50);
          mergeWithLocal('gemini_accounts', gemini, GEMINI_MAX_CREDITS);
          mergeWithLocal('vids_accounts', vids, 500);
          mergeWithLocal('runninghub_accounts', runninghub, 600);
          mergeWithLocal('roboneo_accounts', roboneo, 100);
          mergeWithLocal('galleri5_accounts', galleri5, 100);
          mergeWithLocal('kie_accounts', kie, 80);

          window.dispatchEvent(new Event('accounts-updated'));
          window.dispatchEvent(new Event('weavy_accounts_updated'));
          window.dispatchEvent(new Event('gemini_accounts_updated'));
          window.dispatchEvent(new Event('flow_accounts_updated'));
          window.dispatchEvent(new Event('vids_accounts_updated'));
        }
      } catch (e) {}
    };
    fetchAccountsOnStart();
  }, [currentUser?.userId]);

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoginOpen(false);
    try {
      localStorage.removeItem('amb_active_user');
    } catch (e) {}
  };

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
      return false;
    }
  });

  const applyThemeToDOM = (dark: boolean) => {
    try {
      const root = document.documentElement;
      const body = document.body;
      if (dark) {
        root.classList.add('dark');
        body.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        root.classList.remove('dark');
        body.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    } catch (e) {}
  };

  React.useEffect(() => {
    applyThemeToDOM(isDarkMode);
  }, [isDarkMode]);

  const [overlayState, setOverlayState] = useState<{
    isAnimating: boolean;
    targetIsDark: boolean;
    originX: number;
    originY: number;
  }>({
    isAnimating: false,
    targetIsDark: false,
    originX: 0,
    originY: 0,
  });

  const toggleDarkMode = (e?: React.MouseEvent) => {
    const x = e && e.clientX ? e.clientX : window.innerWidth;
    const y = e && e.clientY ? e.clientY : 0;
    const nextMode = !isDarkMode;

    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--slide-x', `${x}px`);
      document.documentElement.style.setProperty('--slide-y', `${y}px`);
    }

    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      (document as any).startViewTransition(() => {
        flushSync(() => {
          applyThemeToDOM(nextMode);
          setIsDarkMode(nextMode);
        });
      });
    } else {
      applyThemeToDOM(nextMode);
      setOverlayState({
        isAnimating: true,
        targetIsDark: nextMode,
        originX: x,
        originY: y,
      });
      setIsDarkMode(nextMode);
    }
  };

  React.useEffect(() => {
    const handleStorageChange = () => {
      setAccountsTick((prev) => prev + 1);
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('accounts-updated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('accounts-updated', handleStorageChange);
    };
  }, []);

  const [settings, setSettings] = useState<GenerationSettings>({
    mode: 'video',
    provider: 'vids',
    videoModel: 'Google Vids Omni',
    imageModel: '-',
    videoAspectRatio: '9:16 (Vertical)',
    imageAspectRatio: '9:16 (Vertical)',
    videoDuration: '10 seconds',
    videoResolution: '1080p',
    imageResolution: '1024 x 1024',
    enableAudio: true,
  });

  const [prompt, setPrompt] = useState('');
  const [attachedMedia, setAttachedMedia] = useState<AttachedMedia[]>([]);
  const [generations, setGenerations] = useState<GenerationItem[]>(() => {
    try {
      let deletedSet = new Set<string>();
      try {
        const rawDel = localStorage.getItem('weavy_deleted_ids');
        if (rawDel) deletedSet = new Set(JSON.parse(rawDel));
      } catch (e) {}

      const saved = localStorage.getItem('weavy_generations');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .filter((item: GenerationItem) => {
              if (item.id && deletedSet.has(item.id)) return false;
              if (item.recipeId && deletedSet.has(item.recipeId)) return false;
              if (item.mediaUrl && deletedSet.has(item.mediaUrl)) return false;
              if (item.taskId && deletedSet.has(item.taskId)) return false;
              return true;
            })
            .map((item: GenerationItem) => {
              let updated = { ...item };
              const m = (item.model || '').toLowerCase();
              if (m.includes('gemini') || m.includes('veo') || m.includes('imagen') || m.includes('omni flash')) {
                updated = { ...updated, provider: 'gemini', providerName: 'Google Gemini' };
              } else if (item.model === 'Grok Imagine Image') {
                updated = { ...updated, provider: 'weavy', providerName: 'Weavy' };
              }
              return {
                ...updated,
                prompt: getCleanPrompt(updated.prompt, updated.model)
              };
            });
        }
      }
    } catch (e) {}
    return INITIAL_GENERATIONS;
  });

  // Calculate saved Weavy accounts count and list
  const getWeavyAccounts = (): ProviderAccount[] => {
    try {
      const item = localStorage.getItem('weavy_accounts');
      if (item) {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  };

  const getWeavyAccountsCount = () => {
    return getWeavyAccounts().length;
  };

  const getRoboneoAccounts = (): ProviderAccount[] => {
    try {
      const item = localStorage.getItem('roboneo_accounts');
      if (item) {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  };

  const getRoboneoAccountsCount = () => {
    return getRoboneoAccounts().length;
  };

  const getGalleri5Accounts = (): ProviderAccount[] => {
    try {
      const item = localStorage.getItem('galleri5_accounts');
      if (item) {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  };

  const getGalleri5AccountsCount = () => {
    return getGalleri5Accounts().length;
  };

  const getActiveGalleri5Account = (): ProviderAccount | null => {
    const accounts = getGalleri5Accounts();
    if (accounts.length === 0) return null;
    return accounts.find((a) => a.isActive) || accounts[0];
  };

  const getKieAccounts = (): ProviderAccount[] => {
    try {
      const item = localStorage.getItem('kie_accounts');
      if (item) {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  };

  const getKieAccountsCount = () => {
    return getKieAccounts().length;
  };

  const getRunningHubAccounts = (): ProviderAccount[] => {
    try {
      const item = localStorage.getItem('runninghub_accounts');
      if (item) {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  };

  const getRunningHubAccountsCount = () => {
    return getRunningHubAccounts().length;
  };

  const getFlowAccounts = (): ProviderAccount[] => {
    try {
      const item = localStorage.getItem('flow_accounts');
      if (item) {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((a: any) => ({
            ...a,
            credits: typeof a.credits === 'number' ? Math.max(0, a.credits) : (a.credits ?? 50),
            totalCredits: typeof a.totalCredits === 'number' && a.totalCredits > 0 ? a.totalCredits : 50,
          }));
        }
      }
    } catch (e) {}
    return [];
  };

  const getFlowAccountsCount = () => {
    return getFlowAccounts().length;
  };

  const getVidsAccounts = (): ProviderAccount[] => {
    try {
      const item = localStorage.getItem('vids_accounts');
      if (!item) return [];
      const parsed = JSON.parse(item);
      if (Array.isArray(parsed)) {
        return parsed.map((a: any) => {
          const isDead = a.accountStatus && a.accountStatus !== 'active';
          return {
            ...a,
            isActive: isDead ? false : !!a.isActive,
            credits: isDead ? 0 : (typeof a.credits === 'number' ? Math.max(0, a.credits) : 0),
            totalCredits: typeof a.totalCredits === 'number' && a.totalCredits > 0 ? a.totalCredits : 500,
          };
        });
      }
      console.error('[Google Vids] Saved account list is not an array.');
    } catch (error) {
      console.error('[Google Vids] Could not read saved accounts:', error);
    }
    return [];
  };

  const getVidsAccountsCount = () => {
    return getVidsAccounts().length;
  };

  const getGeminiAccounts = (): ProviderAccount[] => {
    try {
      const item = localStorage.getItem('gemini_accounts');
      if (item) {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((a: any) => ({
            ...a,
            credits: typeof a.credits === 'number' ? Math.min(GEMINI_MAX_CREDITS, Math.max(0, a.credits)) : 0,
            totalCredits: GEMINI_MAX_CREDITS,
          }));
        }
      }
    } catch (e) {}
    return [];
  };

  const getGeminiAccountsCount = () => {
    return getGeminiAccounts().length;
  };

  const handleSelectProvider = (providerId: string) => {
    setExternalProviderId(providerId);
    try {
      localStorage.setItem('amb_active_provider', providerId);
    } catch (e) {}

    // Auto-sync prompt settings model based on selected provider
    if (providerId === 'gemini') {
      setSettings((prev) => ({
        ...prev,
        provider: 'gemini',
        videoModel: 'Omni Flash',
        videoAspectRatio: '9:16 (Vertical)',
        videoDuration: '10 seconds',
        videoResolution: '1080p',
        imageModel: 'Google Imagen 3 Pro',
      }));
    } else if (providerId === 'vids') {
      setSettings((prev) => ({
        ...prev,
        provider: 'vids',
        videoModel: 'Google Vids Omni',
        videoAspectRatio: '9:16 (Vertical)',
        videoDuration: '10 seconds',
        videoResolution: '1080p',
        imageModel: '-',
      }));
    } else if (providerId === 'flow') {
      setSettings((prev) => ({
        ...prev,
        provider: 'flow',
        videoModel: 'Google Flow Video (1)',
        videoAspectRatio: '9:16 (Vertical)',
        videoDuration: '10 seconds',
        videoResolution: '1080p',
        imageModel: 'Google Flow Image',
      }));
    } else if (providerId === 'runninghub') {
      setSettings((prev) => {
        const isCurrentRunningHub =
          prev.videoModel === 'MiniMax H3 Turbo Video' ||
          prev.videoModel === 'S2 Motion Control' ||
          prev.videoModel === 'Motion Control' ||
          (typeof prev.videoModel === 'string' && (
            prev.videoModel.toLowerCase().includes('minimax') ||
            prev.videoModel.toLowerCase().includes('s2 motion') ||
            prev.videoModel.toLowerCase().includes('motion control')
          ));
        const resolvedModel = isCurrentRunningHub ? prev.videoModel : 'MiniMax H3 Turbo Video';
        const defaultDur = resolvedModel === 'MiniMax H3 Turbo Video'
          ? (prev.videoDuration === '15 seconds' || prev.videoDuration === '10 seconds' ? prev.videoDuration : '10 seconds')
          : prev.videoDuration;
        return {
          ...prev,
          provider: 'runninghub',
          videoModel: resolvedModel,
          videoDuration: defaultDur,
          imageModel: '-',
        };
      });
    } else if (providerId === 'kie') {
      setSettings((prev) => {
        const isSeeDanceMini = prev.videoModel === 'SeeDance 2.0 Mini';
        return {
          ...prev,
          provider: 'kie',
          videoModel: isSeeDanceMini ? 'SeeDance 2.0 Mini' : 'Grok Imagine 1.5 Preview',
          videoResolution: isSeeDanceMini ? '480p' : (prev.videoResolution || '720p'),
          imageModel: 'GPT Image 2 (Image-to-Image)',
        };
      });
    } else if (providerId === 'roboneo') {
      setSettings((prev) => ({
        ...prev,
        provider: 'roboneo',
        videoModel: 'Kling 2.6 Motion Control',
      }));
    } else if (providerId === 'galleri5') {
      setSettings((prev) => ({
        ...prev,
        provider: 'galleri5',
        videoModel: 'Kling 2.6 Motion Control Standar',
      }));
    } else if (providerId === 'weavy') {
      setSettings((prev) => ({
        ...prev,
        provider: 'weavy',
        videoModel: 'Kling 3.0 Pro Motion Control',
        imageModel: 'ChatGPT Images 2.0 Edit',
      }));
    }
    setActiveTab('settings');
  };

  // Persist generations to local storage
  React.useEffect(() => {
    try {
      localStorage.setItem('weavy_generations', JSON.stringify(generations));
    } catch (e) {}
  }, [generations]);

  // Simpan token Weavy yang diperbarui otomatis oleh Ekstensi (auto-refresh 403)
  React.useEffect(() => {
    return extensionBridge.onTokenRefreshed((account) => {
      try {
        const raw = localStorage.getItem('weavy_accounts');
        if (!raw) return;
        const accounts = JSON.parse(raw);
        if (!Array.isArray(accounts) || accounts.length === 0) return;

        const email = (account.email || '').toLowerCase();
        let changed = false;
        const updated = accounts.map((a: any) => {
          const matchEmail = Boolean(email && a.email && a.email.toLowerCase() === email);
          const matchUserId = Boolean(account.userId && a.userId === account.userId);
          if (matchEmail || matchUserId) {
            changed = true;
            return {
              ...a,
              idToken: account.idToken || a.idToken,
              refreshToken: account.refreshToken || a.refreshToken,
              name: account.name || a.name,
            };
          }
          return a;
        });

        if (!changed) return;
        localStorage.setItem('weavy_accounts', JSON.stringify(updated));
        window.dispatchEvent(new Event('weavy_accounts_updated'));
        window.dispatchEvent(new Event('accounts-updated'));
      } catch (e) {
        console.warn('Gagal menyimpan token Weavy yang diperbarui:', e);
      }
    });
  }, []);

  // Auto-resume background polling for any processing items on app reload / startup
  React.useEffect(() => {
    const activeAcc = getActiveAccount();
    if (!activeAcc) return;

    const processingItems = generations.filter(
      (item) => item.status === 'processing' && item.recipeId
    );

    if (processingItems.length === 0) return;

    processingItems.forEach((procItem) => {
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount += 1;
        // Keep polling up to 1800 attempts (2 hours) so long generations in queue complete naturally
        if (pollCount > 1800) {
          clearInterval(pollInterval);
          setGenerations((prev) =>
            prev.map((g) =>
              g.id === procItem.id
                ? {
                    ...g,
                    status: 'failed',
                    errorMessage: 'Waktu tunggu generasi habis (2 jam). Silakan klik Sync History.',
                  }
                : g
            )
          );
          return;
        }

        try {
          const pollData = await pollWeavyStatusOnce({
            refreshToken: activeAcc.refreshToken,
            idToken: activeAcc.idToken,
            recipeId: procItem.recipeId!,
            nodeId: procItem.nodeId,
            taskId: procItem.taskId,
          });

          if (pollData?.status === 'completed' && pollData?.resultUrl) {
            clearInterval(pollInterval);
            setGenerations((prev) =>
              prev.map((g) =>
                g.id === procItem.id
                  ? {
                      ...g,
                      status: 'completed',
                      mediaUrl: pollData.resultUrl,
                      thumbnailUrl: pollData.coverUrl || pollData.resultUrl || g.thumbnailUrl || '',
                      progress: 100,
                    }
                  : g
              )
            );
          } else if (pollData?.status === 'failed') {
            clearInterval(pollInterval);
            setGenerations((prev) =>
              prev.map((g) =>
                g.id === procItem.id
                  ? {
                      ...g,
                      status: 'failed',
                      errorMessage: pollData.error || 'Generasi gagal di Weavy.',
                    }
                  : g
              )
            );
          }
        } catch (e) {
          console.warn('Auto-resume poll error:', e);
        }
      }, 4000);
    });
  }, []);

  // Helper to get active provider dynamically based on settings or selected provider
  const getActiveProvider = () => {
    return resolveActiveProvider(settings, activeTab, externalProviderId);
  };

  // Sync history dynamically based on active provider
  const [isSyncingHistory, setIsSyncingHistory] = useState(false);

  const handleSyncHistory = async () => {
    const activeProvider = getActiveProvider();

    setIsSyncingHistory(true);
    try {
      if (activeProvider.id === 'runninghub') {
        alert('Fitur Tarik Histori RunningHub belum didukung oleh API provider.');
      } else if (activeProvider.id === 'kie') {
        const kieAccs = getKieAccounts();
        const activeKieAcc = kieAccs.find((a) => a.isActive) || kieAccs[0];
        if (!activeKieAcc || (!activeKieAcc.refreshToken && !activeKieAcc.accessToken)) {
          alert('Silakan pilih atau tambahkan API Key Kie.ai di tab Settings terlebih dahulu.');
          setActiveTab('settings');
          return;
        }

        const apiKey = activeKieAcc.refreshToken || activeKieAcc.accessToken;
        const { ok, data } = await safeFetchJson('/api/kie/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, pageNum: 1, pageSize: 50 }),
        });

        if (ok && data && data.success && Array.isArray(data.records)) {
          let deletedSet = new Set<string>();
          try {
            const rawDel = localStorage.getItem('weavy_deleted_ids');
            if (rawDel) deletedSet = new Set(JSON.parse(rawDel));
          } catch (e) {}

          setGenerations((prev) => {
            const updatedPrev = [...prev];

            data.records.forEach((rec: any) => {
              if (!rec.taskId) return;
              const remoteId = `kie-${rec.taskId}`;
              if (
                deletedSet.has(remoteId) ||
                deletedSet.has(rec.taskId) ||
                (rec.mediaUrl && deletedSet.has(rec.mediaUrl))
              ) {
                return;
              }

              const matchIndex = updatedPrev.findIndex(
                (local) => local.id === remoteId || local.taskId === rec.taskId
              );

              const recStatus: 'completed' | 'processing' | 'failed' =
                rec.state === 'success' || rec.state === 'completed' || rec.state === 'done'
                  ? 'completed'
                  : rec.state === 'fail' || rec.state === 'failed'
                  ? 'failed'
                  : 'processing';

              const cleanPrompt = rec.prompt || 'Generasi Kie.ai';
              const derivedTitle = cleanPrompt.length > 28 ? `${cleanPrompt.slice(0, 28)}...` : cleanPrompt;

              const dateObj = rec.createTime ? new Date(rec.createTime) : new Date();
              const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

              const recMode: 'video' | 'image' =
                rec.mode === 'image' ||
                rec.model?.toLowerCase().includes('gpt-image') ||
                rec.model?.toLowerCase().includes('image') ||
                rec.mediaUrl?.match(/\.(png|jpg|jpeg|webp)(\?.*)?$/i)
                  ? 'image'
                  : 'video';

              const remoteItem: GenerationItem = {
                id: remoteId,
                mode: recMode,
                title: derivedTitle,
                prompt: cleanPrompt,
                createdAt: 'Tarik Histori',
                timestamp: timeString,
                aspectRatio: rec.aspectRatio || '9:16',
                resolution: rec.resolution || (recMode === 'image' ? '1K' : '720p'),
                duration: rec.duration || (recMode === 'image' ? undefined : '5s'),
                model: rec.model || (recMode === 'image' ? 'GPT Image 2 (Image-to-Image)' : 'Grok Imagine 1.5 Preview'),
                mediaUrl: rec.mediaUrl || '',
                thumbnailUrl: rec.thumbnailUrl || rec.mediaUrl || '',
                status: recStatus,
                progress: recStatus === 'completed' ? 100 : 50,
                taskId: rec.taskId,
              };

              if (matchIndex !== -1) {
                updatedPrev[matchIndex] = {
                  ...updatedPrev[matchIndex],
                  ...remoteItem,
                  mediaUrl: remoteItem.mediaUrl || updatedPrev[matchIndex].mediaUrl,
                  thumbnailUrl: remoteItem.thumbnailUrl || updatedPrev[matchIndex].thumbnailUrl,
                  status: recStatus,
                  progress: recStatus === 'completed' ? 100 : updatedPrev[matchIndex].progress,
                };
              } else {
                updatedPrev.unshift(remoteItem);
              }
            });

            return updatedPrev;
          });
        } else {
          alert(data?.error || 'Gagal mengambil histori Kie.ai.');
        }
      } else if (activeProvider.id === 'roboneo') {
        alert('Fitur Tarik Histori RoboNeo belum didukung oleh API provider.');
      } else if (activeProvider.id === 'galleri5') {
        const galleri5Acc = getActiveGalleri5Account();
        if (!galleri5Acc || (!galleri5Acc.refreshToken && !galleri5Acc.idToken && !galleri5Acc.accessToken)) {
          alert('Silakan pilih atau tambahkan akun Galleri5 di tab Settings terlebih dahulu.');
          setActiveTab('settings');
          return;
        }

        const { ok, data } = await safeFetchJson('/api/galleri5/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            refreshToken: galleri5Acc.refreshToken || galleri5Acc.accessToken || galleri5Acc.idToken,
            organizationId: galleri5Acc.organizationId,
          }),
        });

        if (ok && data && data.success && Array.isArray(data.items)) {
          let deletedSet = new Set<string>();
          try {
            const rawDel = localStorage.getItem('weavy_deleted_ids');
            if (rawDel) deletedSet = new Set(JSON.parse(rawDel));
          } catch (e) {}

          setGenerations((prev) => {
            const updatedPrev = [...prev];

            data.items.forEach((remoteItem: GenerationItem) => {
              if (
                (remoteItem.id && deletedSet.has(remoteItem.id)) ||
                (remoteItem.taskId && deletedSet.has(remoteItem.taskId)) ||
                (remoteItem.recipeId && deletedSet.has(remoteItem.recipeId)) ||
                (remoteItem.mediaUrl && deletedSet.has(remoteItem.mediaUrl))
              ) {
                return;
              }

              const matchIndex = updatedPrev.findIndex(
                (local) =>
                  (remoteItem.taskId && local.taskId === remoteItem.taskId) ||
                  (remoteItem.recipeId && local.recipeId === remoteItem.recipeId) ||
                  (remoteItem.mediaUrl && local.mediaUrl === remoteItem.mediaUrl)
              );

              if (matchIndex !== -1) {
                updatedPrev[matchIndex] = {
                  ...updatedPrev[matchIndex],
                  ...remoteItem,
                  mediaUrl: remoteItem.mediaUrl || updatedPrev[matchIndex].mediaUrl,
                  thumbnailUrl: remoteItem.thumbnailUrl || updatedPrev[matchIndex].thumbnailUrl,
                  status: remoteItem.status || updatedPrev[matchIndex].status,
                  progress: remoteItem.status === 'completed' ? 100 : updatedPrev[matchIndex].progress,
                };
              } else {
                updatedPrev.unshift(remoteItem);
              }
            });

            return updatedPrev;
          });
        } else {
          alert(data?.error || 'Gagal mengambil histori Galleri5.');
        }
      } else {
        // Default: WEAVY
        const activeAcc = getActiveAccount();
        if (!activeAcc || (!activeAcc.refreshToken && !activeAcc.idToken)) {
          alert('Silakan pilih atau tambahkan akun Weavy di tab Settings terlebih dahulu.');
          setActiveTab('settings');
          return;
        }

        const weavyHistory = await fetchWeavyHistory({
          refreshToken: activeAcc.refreshToken,
          idToken: activeAcc.idToken,
        });
        const data = weavyHistory.success
          ? { success: true, items: weavyHistory.items }
          : { success: false, items: [], error: weavyHistory.error };
        const ok = weavyHistory.success;

        if (ok && data && data.success && Array.isArray(data.items)) {
          let deletedSet = new Set<string>();
          try {
            const rawDel = localStorage.getItem('weavy_deleted_ids');
            if (rawDel) deletedSet = new Set(JSON.parse(rawDel));
          } catch (e) {}

          const cleanItems = data.items.filter((item: any) => {
            if (item.id && deletedSet.has(item.id)) return false;
            if (item.recipeId && deletedSet.has(item.recipeId)) return false;
            if (item.mediaUrl && deletedSet.has(item.mediaUrl)) return false;
            return true;
          });

          const remoteMediaUrls = new Set(cleanItems.map((i: any) => i.mediaUrl).filter(Boolean));
          const remoteRecipeIds = new Set(cleanItems.map((i: any) => i.recipeId).filter(Boolean));

          setGenerations((prev) => {
            // Keep ALL local items that are not in deletedSet (do not purge history from other accounts)
            const filteredPrev = prev.filter((local) => {
              if (local.id && deletedSet.has(local.id)) return false;
              if (local.recipeId && deletedSet.has(local.recipeId)) return false;
              if (local.mediaUrl && deletedSet.has(local.mediaUrl)) return false;
              if (local.taskId && deletedSet.has(local.taskId)) return false;
              return true;
            });

            const updatedPrev = [...filteredPrev];

            cleanItems.forEach((remoteItem: GenerationItem) => {
              const matchIndex = updatedPrev.findIndex(
                (local) =>
                  (remoteItem.recipeId && local.recipeId === remoteItem.recipeId) ||
                  (remoteItem.mediaUrl && local.mediaUrl === remoteItem.mediaUrl) ||
                  (remoteItem.id && local.id === remoteItem.id) ||
                  (remoteItem.taskId && local.taskId === remoteItem.taskId)
              );

              if (matchIndex !== -1) {
                updatedPrev[matchIndex] = {
                  ...updatedPrev[matchIndex],
                  ...remoteItem,
                  status: 'completed',
                  progress: 100,
                  mediaUrl: remoteItem.mediaUrl || updatedPrev[matchIndex].mediaUrl,
                  thumbnailUrl: remoteItem.thumbnailUrl || updatedPrev[matchIndex].thumbnailUrl,
                };
              } else {
                updatedPrev.unshift(remoteItem);
              }
            });

            try {
              localStorage.setItem('weavy_generations', JSON.stringify(updatedPrev));
            } catch (e) {}

            return updatedPrev;
          });
        } else {
          alert(data?.error || 'Gagal mengambil histori Weavy.');
        }
      }
    } catch (err: any) {
      console.error('Failed syncing history:', err);
      alert('Gagal terhubung ke server untuk penarikan histori.');
    } finally {
      setIsSyncingHistory(false);
    }
  };

  // Modals state
  const [isAddMediaOpen, setIsAddMediaOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<GenerationItem | null>(null);

  // Wireframe State (idle, processing, completed, failed)
  const [genState, setGenState] = useState<WireframeGenState>('idle');
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string>('task_8f3a7d2e6c1b');
  const [currentTimerString, setCurrentTimerString] = useState<string>('00:32');
  const [generationProgress, setGenerationProgress] = useState<number>(25);

  // Helper to determine minimum required credits for Weavy models
  const getWeavyRequiredCredits = (modelName: string, isVideo: boolean): number => {
    if (isVideo) {
      return 50;
    }
    const clean = (modelName || '').toLowerCase();
    // Seedream V5.0 Pro Edit requires >= 12 credits
    if (clean.includes('seedream') || clean.includes('v5')) {
      return 12;
    }
    // GPT Image 2.5 / Flare requires 4 credits
    if (clean.includes('gpt image 2.5') || clean.includes('flare') || clean.includes('gpt-image-2.5')) {
      return 4;
    }
    // GPT Image 2 / ChatGPT Images 2.0 Edit requires >= 9 credits
    if (clean.includes('gpt') || clean.includes('chatgpt') || clean.includes('fpt')) {
      return 9;
    }
    // Nano Banana 2 requires >= 6 credits
    if (clean.includes('banana') || clean.includes('nano')) {
      return 6;
    }
    // Grok Imagine Image / other default
    return 4;
  };

  const handleUpdateSettings = (newSettings: Partial<GenerationSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (newSettings.videoModel === 'SeeDance 2.0 Mini') {
        if (!newSettings.videoResolution) {
          updated.videoResolution = '480p';
        }
        // If there is an existing video attached, sync to its duration for SeeDance 2.0 Mini
        const existingVid = attachedMedia.find((m) => m.type === 'video');
        if (existingVid?.durationSeconds) {
          const safeDur = Math.min(15, Math.max(3, Math.round(existingVid.durationSeconds)));
          updated.videoDuration = `${safeDur} seconds` as VideoDuration;
        }
      } else if (newSettings.videoModel) {
        if (newSettings.videoModel === 'MiniMax H3 Turbo Video' && (!newSettings.videoDuration || prev.videoDuration === '5 seconds')) {
          updated.videoDuration = '10 seconds';
        } else if (prev.videoModel === 'SeeDance 2.0 Mini' && !newSettings.videoDuration) {
          updated.videoDuration = '5 seconds';
        }
      }
      if (newSettings.videoModel || newSettings.imageModel || newSettings.mode || newSettings.provider) {
        const isVideo = updated.mode === 'video';
        const derivedProvider = resolveActiveProviderId(updated, activeTab, newSettings.provider || externalProviderId);
        updated.provider = derivedProvider;
        setExternalProviderId(derivedProvider);

        // Auto-swap active Weavy account when model is selected if current account lacks required credits
        if (derivedProvider === 'weavy') {
          const reqCredits = getWeavyRequiredCredits(isVideo ? updated.videoModel : updated.imageModel, isVideo);
          try {
            const raw = localStorage.getItem('weavy_accounts');
            if (raw) {
              const accounts = JSON.parse(raw);
              if (Array.isArray(accounts) && accounts.length > 0) {
                const currentActive = accounts.find((a: any) => a.isActive) || accounts[0];
                const currentCredits = typeof currentActive?.credits === 'number' ? currentActive.credits : 150;
                if (currentCredits < reqCredits) {
                  const suitableIdx = accounts.findIndex((a: any) => (typeof a.credits === 'number' ? a.credits : 150) >= reqCredits);
                  if (suitableIdx !== -1) {
                    const swapped = accounts.map((a: any, idx: number) => ({
                      ...a,
                      isActive: idx === suitableIdx,
                    }));
                    localStorage.setItem('weavy_accounts', JSON.stringify(swapped));
                    window.dispatchEvent(new Event('weavy_accounts_updated'));
                    window.dispatchEvent(new Event('accounts-updated'));
                  }
                }
              }
            }
          } catch (e) {}
        }
      }
      return updated;
    });
  };

  const uploadMediaFile = async (mediaItem: AttachedMedia) => {
    if (!mediaItem.fileObject) {
      setAttachedMedia((prev) =>
        prev.map((m) => (m.id === mediaItem.id ? { ...m, isUploading: false, uploadProgress: 100 } : m))
      );
      return;
    }

    const isVideoMode = settings.mode === 'video';
    const activeProvider = resolveActiveProviderId(settings, activeTab, externalProviderId);
    const isVidsModel = activeProvider === 'vids' || settings.videoModel === 'Google Vids Omni' || (settings.videoModel && settings.videoModel.toLowerCase().includes('vids'));
    const isFlowModel = activeProvider === 'flow' || (settings.videoModel && settings.videoModel.toLowerCase().includes('flow')) || (settings.imageModel && settings.imageModel.toLowerCase().includes('flow'));
    const isGeminiModel = activeProvider === 'gemini';
    const isRunningHubModel = activeProvider === 'runninghub';
    const isRoboneoModel = activeProvider === 'roboneo';
    const isKieModel = activeProvider === 'kie';
    const isGalleri5Model = activeProvider === 'galleri5';

    const kieAccs = getKieAccounts();
    const kieAcc = kieAccs.find((a) => a.isActive) || kieAccs[0];

    const handleUploadSuccess = (url: string) => {
      console.log(`[Client ✅ Upload Success] File ${mediaItem.name} terunggah:`, url);
      setAttachedMedia((prev) =>
        prev.map((m) =>
          m.id === mediaItem.id
            ? {
                ...m,
                url,
                previewUrl: m.previewUrl || mediaItem.previewUrl || (mediaItem.fileObject ? URL.createObjectURL(mediaItem.fileObject) : (m.url && (m.url.startsWith('blob:') || m.url.startsWith('data:') || m.url.startsWith('http')) ? m.url : undefined)),
                isUploading: false,
                uploadProgress: 100,
                uploadError: undefined,
              }
            : m
        )
      );
    };

    const handleUploadFailure = (errorMsg: string) => {
      console.error(`[Client ❌ Upload Failed]:`, errorMsg);
      setAttachedMedia((prev) =>
        prev.map((m) =>
          m.id === mediaItem.id
            ? { ...m, isUploading: false, uploadError: errorMsg }
            : m
        )
      );
    };

    // --- GOOGLE VIDS & FLOW UPLOAD BRANCH (Direct Local Base64 / No External Weavy Upload Needed) ---
    if (isVidsModel || isFlowModel) {
      console.log(`[Client 📤 Upload Start ${isVidsModel ? 'Google Vids' : 'Google Flow'}] Memproses file ${mediaItem.name} secara lokal...`);
      try {
        setAttachedMedia((prev) =>
          prev.map((m) => (m.id === mediaItem.id ? { ...m, isUploading: true, uploadProgress: 50 } : m))
        );
        const base64Data = await readFileAsBase64(mediaItem.fileObject, (percent) => {
          setAttachedMedia((prev) =>
            prev.map((m) => (m.id === mediaItem.id ? { ...m, isUploading: true, uploadProgress: percent } : m))
          );
        });
        handleUploadSuccess(base64Data);
      } catch (err: any) {
        handleUploadFailure(err?.message || `Gagal memproses file untuk ${isVidsModel ? 'Google Vids' : 'Google Flow'}.`);
      }
      return;
    }

    // --- GEMINI UPLOAD BRANCH ---
    if (isGeminiModel) {
      console.log(`[Client 📤 Upload Start Gemini] Memproses ${mediaItem.type} ${mediaItem.name} untuk Google Gemini...`);
      try {
        const isVid = mediaItem.type === 'video' || mediaItem.name?.match(/\.(mp4|mov|webm)$/i);
        const mime = isVid ? 'video/mp4' : 'image/png';
        const result = await uploadMediaWithProgress({
          url: '/api/gemini/upload',
          file: mediaItem.fileObject,
          base64Data: !mediaItem.fileObject && mediaItem.url?.startsWith('data:') ? mediaItem.url : null,
          fileName: mediaItem.name,
          mimeType: mime,
          fields: {
            fileName: mediaItem.name,
            mimeType: mime,
          },
          onProgress: (percent) => {
            setAttachedMedia((prev) =>
              prev.map((m) => (m.id === mediaItem.id ? { ...m, isUploading: true, uploadProgress: percent } : m))
            );
          },
        });

        if (result.success && result.url) {
          handleUploadSuccess(result.url);
        } else {
          if (mediaItem.url && (mediaItem.url.startsWith('data:') || mediaItem.url.startsWith('http') || mediaItem.url.startsWith('/media-cache/'))) {
            handleUploadSuccess(mediaItem.url);
          } else {
            handleUploadFailure(result.error || 'Gagal memproses file untuk Gemini.');
          }
        }
      } catch (err: any) {
        handleUploadFailure(err.message || 'Gagal mengunggah media ke Gemini.');
      }
      return;
    }

    // --- RUNNINGHUB UPLOAD BRANCH ---
    if (isRunningHubModel) {
      const rhAcc = getActiveRunningHubAccount();
      if (!rhAcc || (!rhAcc.refreshToken && !rhAcc.accessToken && !rhAcc.idToken && !rhAcc.email)) {
        console.error('[Client ❌ Pre-Upload Error] Belum ada akun RunningHub terhubung di Settings.');
        setAttachedMedia((prev) =>
          prev.map((m) =>
            m.id === mediaItem.id
              ? { ...m, isUploading: false, uploadError: 'Belum ada akun RunningHub terhubung di Settings.' }
              : m
          )
        );
        return;
      }

      console.log(`[Client 📤 Upload Start RunningHub] Mengirim file ${mediaItem.name} (${mediaItem.size}) ke /api/runninghub/upload...`);

      const apiKey = rhAcc.refreshToken || rhAcc.accessToken || rhAcc.idToken || rhAcc.email;
      
      const result = await uploadMediaWithProgress({
        url: '/api/runninghub/upload',
        file: mediaItem.fileObject,
        base64Data: !mediaItem.fileObject && mediaItem.url?.startsWith('data:') ? mediaItem.url : null,
        fileName: mediaItem.name,
        mimeType: mediaItem.type === 'video' ? 'video/mp4' : (mediaItem.type === 'image' ? 'image/jpeg' : 'application/octet-stream'),
        fields: { apiKey },
        onProgress: (percent) => {
          setAttachedMedia((prev) =>
            prev.map((m) => (m.id === mediaItem.id ? { ...m, isUploading: true, uploadProgress: percent } : m))
          );
        },
      });

      if (result.success && result.url) {
        handleUploadSuccess(result.url);
      } else {
        handleUploadFailure(result.error || 'Gagal mengunggah media ke RunningHub.');
      }
      return;
    }

    // --- KIE UPLOAD BRANCH ---
    if (isKieModel || (kieAcc && !getActiveAccount() && !isRoboneoModel && !isGalleri5Model)) {
      if (!kieAcc || (!kieAcc.refreshToken && !kieAcc.accessToken)) {
        console.error('[Client ❌ Pre-Upload Error] Belum ada akun Kie.ai terhubung di Settings.');
        setAttachedMedia((prev) =>
          prev.map((m) =>
            m.id === mediaItem.id
              ? { ...m, isUploading: false, uploadError: 'Belum ada akun Kie.ai terhubung di Settings.' }
              : m
          )
        );
        return;
      }

      console.log(`[Client 📤 Upload Start Kie] Mengirim file ${mediaItem.name} (${mediaItem.size}) ke /api/kie/upload...`);

      const apiKey = kieAcc.refreshToken || kieAcc.accessToken;
      
      const result = await uploadMediaWithProgress({
        url: '/api/kie/upload',
        file: mediaItem.fileObject,
        base64Data: !mediaItem.fileObject && mediaItem.url?.startsWith('data:') ? mediaItem.url : null,
        fileName: mediaItem.name,
        mimeType: mediaItem.type === 'video' ? 'video/mp4' : (mediaItem.type === 'image' ? 'image/jpeg' : 'application/octet-stream'),
        fields: { apiKey, fileName: mediaItem.name },
        onProgress: (percent) => {
          setAttachedMedia((prev) =>
            prev.map((m) => (m.id === mediaItem.id ? { ...m, isUploading: true, uploadProgress: percent } : m))
          );
        },
      });

      if (result.success && result.url) {
        handleUploadSuccess(result.url);
      } else {
        handleUploadFailure(result.error || 'Gagal mengunggah media ke Kie.ai.');
      }
      return;
    }

    // --- ROBONEO UPLOAD BRANCH ---
    if (isRoboneoModel) {
      const roboneoAcc = getActiveRoboneoAccount();
      if (!roboneoAcc || (!roboneoAcc.refreshToken && !roboneoAcc.accessToken && !roboneoAcc.idToken)) {
        console.error('[Client ❌ Pre-Upload Error] Belum ada akun RoboNeo terhubung di Settings.');
        setAttachedMedia((prev) =>
          prev.map((m) =>
            m.id === mediaItem.id
              ? { ...m, isUploading: false, uploadError: 'Belum ada akun RoboNeo terhubung di Settings.' }
              : m
          )
        );
        return;
      }

      console.log(`[Client 📤 Upload Start RoboNeo] Mengirim file ${mediaItem.name} (${mediaItem.size}) ke /api/roboneo/upload...`);

      const token = roboneoAcc.refreshToken || roboneoAcc.accessToken || roboneoAcc.idToken;

      const result = await uploadMediaWithProgress({
        url: '/api/roboneo/upload',
        file: mediaItem.fileObject,
        base64Data: !mediaItem.fileObject && mediaItem.url?.startsWith('data:') ? mediaItem.url : null,
        fileName: mediaItem.name,
        mimeType: mediaItem.type === 'video' ? 'video/mp4' : (mediaItem.type === 'image' ? 'image/jpeg' : 'application/octet-stream'),
        fields: { accessToken: token, fileName: mediaItem.name },
        headers: { 'access-token': token, 'authorization': `Bearer ${token}` },
        onProgress: (percent) => {
          setAttachedMedia((prev) =>
            prev.map((m) => (m.id === mediaItem.id ? { ...m, isUploading: true, uploadProgress: percent } : m))
          );
        },
      });

      if (result.success && result.url) {
        handleUploadSuccess(result.url);
      } else {
        handleUploadFailure(result.error || 'Gagal mengunggah media ke RoboNeo OSS.');
      }
      return;
    }

    // --- GALLERI5 UPLOAD BRANCH ---
    if (isGalleri5Model) {
      const galleri5Acc = getActiveGalleri5Account();
      if (!galleri5Acc || (!galleri5Acc.refreshToken && !galleri5Acc.accessToken && !galleri5Acc.idToken)) {
        console.error('[Client ❌ Pre-Upload Error] Belum ada akun Galleri5 terhubung di Settings.');
        setAttachedMedia((prev) =>
          prev.map((m) =>
            m.id === mediaItem.id
              ? { ...m, isUploading: false, uploadError: 'Belum ada akun Galleri5 terhubung di Settings.' }
              : m
          )
        );
        return;
      }

      console.log(`[Client 📤 Upload Start Galleri5] Mengirim file ${mediaItem.name} (${mediaItem.size}) ke /api/galleri5/upload...`);

      const token = galleri5Acc.refreshToken || galleri5Acc.accessToken || galleri5Acc.idToken;

      const result = await uploadMediaWithProgress({
        url: '/api/galleri5/upload',
        file: mediaItem.fileObject,
        base64Data: !mediaItem.fileObject && mediaItem.url?.startsWith('data:') ? mediaItem.url : null,
        fileName: mediaItem.name,
        mimeType: mediaItem.type === 'video' ? 'video/mp4' : (mediaItem.type === 'image' ? 'image/jpeg' : 'application/octet-stream'),
        fields: { accessToken: token, fileName: mediaItem.name },
        onProgress: (percent) => {
          setAttachedMedia((prev) =>
            prev.map((m) => (m.id === mediaItem.id ? { ...m, isUploading: true, uploadProgress: percent } : m))
          );
        },
      });

      if (result.success && result.url) {
        handleUploadSuccess(result.url);
      } else {
        handleUploadFailure(result.error || 'Gagal mengunggah media ke Galleri5.');
      }
      return;
    }

    // --- WEAVY UPLOAD BRANCH ---
    let activeAcc = getActiveAccount();
    if (!activeAcc) {
      console.error('[Client ❌ Pre-Upload Error] Belum ada akun Weavy terhubung di Settings.');
      setAttachedMedia((prev) =>
        prev.map((m) =>
          m.id === mediaItem.id
            ? { ...m, isUploading: false, uploadError: 'Belum ada akun Weavy terhubung di Settings.' }
            : m
        )
      );
      return;
    }

    console.log(`[Client 📤 Upload Start Weavy] Mengirim file ${mediaItem.name} (${mediaItem.size}) ke /api/upload-media...`, {
      activeAccountEmail: activeAcc.email,
      hasRefreshToken: !!activeAcc.refreshToken,
      hasIdToken: !!activeAcc.idToken,
    });

    // Proactively refresh active account token before uploading to prevent expired token issues
    if (activeAcc.refreshToken) {
      try {
        const freshInfo = await exchangeRefreshTokenAndGetInfo(activeAcc.refreshToken, activeAcc.email);
        const raw = localStorage.getItem('weavy_accounts');
        if (raw) {
          const accounts = JSON.parse(raw);
          const updatedAccounts = accounts.map((a: any) =>
            a.id === activeAcc.id || a.email?.toLowerCase() === activeAcc.email?.toLowerCase()
              ? {
                  ...a,
                  credits: freshInfo.credits,
                  totalCredits: freshInfo.totalCredits,
                  idToken: freshInfo.idToken,
                  refreshToken: freshInfo.refreshToken,
                }
              : a
          );
          localStorage.setItem('weavy_accounts', JSON.stringify(updatedAccounts));
          window.dispatchEvent(new Event('weavy_accounts_updated'));
          activeAcc = { ...activeAcc, idToken: freshInfo.idToken, refreshToken: freshInfo.refreshToken };
        }
      } catch (err) {
        console.warn('[Client ⚠️ Pre-upload] Token refresh warning:', err);
      }
    }

    // Collect ALL saved refresh tokens as fallback list
    let allTokens: string[] = [];
    try {
      const rawAccounts = localStorage.getItem('weavy_accounts');
      if (rawAccounts) {
        const parsed = JSON.parse(rawAccounts);
        if (Array.isArray(parsed)) {
          allTokens = parsed
            .map((a: any) => a.refreshToken)
            .filter((t: any) => typeof t === 'string' && t.trim().length > 0);
        }
      }
    } catch (e) {}

    // Upload with real progress
    const weavyResult = await uploadMediaWithProgress({
      url: '/api/upload-media',
      file: mediaItem.fileObject,
      base64Data: !mediaItem.fileObject && mediaItem.url?.startsWith('data:') ? mediaItem.url : null,
      fileName: mediaItem.name,
      mimeType: mediaItem.type === 'video' ? 'video/mp4' : (mediaItem.type === 'image' ? 'image/jpeg' : 'application/octet-stream'),
      fields: {
        refreshToken: activeAcc.refreshToken,
        idToken: activeAcc.idToken,
        allRefreshTokens: allTokens.length > 0 ? JSON.stringify(allTokens) : undefined,
      },
      onProgress: (percent) => {
        setAttachedMedia((prev) =>
          prev.map((m) => (m.id === mediaItem.id ? { ...m, isUploading: true, uploadProgress: percent } : m))
        );
      },
    });

    if (weavyResult.success && weavyResult.url) {
      handleUploadSuccess(weavyResult.url);
    } else {
      handleUploadFailure(weavyResult.error || 'Gagal mengunggah media ke Weavy AI.');
    }
  };

  const handleAttachMedia = (media: AttachedMedia) => {
    const isGemini = resolveActiveProviderId(settings, activeTab, externalProviderId) === 'gemini';
    if (isGemini) {
      const currentImages = attachedMedia.filter((m) => m.type === 'image' || (!m.type && !m.name?.match(/\.(mp4|mov|webm)$/i)));
      const currentVideos = attachedMedia.filter((m) => m.type === 'video' || m.name?.match(/\.(mp4|mov|webm)$/i));
      const isVid = media.type === 'video' || media.name?.match(/\.(mp4|mov|webm)$/i);

      if (isVid && currentVideos.length >= 1) {
        return;
      }
      if (!isVid && currentImages.length >= 5) {
        return;
      }
    }

    const preparedMedia: AttachedMedia = {
      ...media,
      previewUrl:
        media.previewUrl ||
        (media.fileObject ? URL.createObjectURL(media.fileObject) : undefined) ||
        (media.url && (media.url.startsWith('blob:') || media.url.startsWith('data:') || media.url.startsWith('http')) ? media.url : undefined),
    };
    setAttachedMedia((prev) => [...prev, preparedMedia]);

    // If video is attached, auto detect and sync duration ONLY for SeeDance 2.0 Mini
    if (preparedMedia.type === 'video') {
      const isSeeDanceMini = settings.videoModel === 'SeeDance 2.0 Mini';

      if (isSeeDanceMini) {
        const detectAndSyncDuration = (durSec: number) => {
          // Use the exact rounded duration if <= 15s (e.g. 11.2s -> 11 seconds), and cap at 15s if > 15s
          const safeDur = Math.min(15, Math.max(3, Math.round(durSec)));
          const mappedDurationStr: VideoDuration = `${safeDur} seconds` as VideoDuration;
          setSettings((prev) => ({
            ...prev,
            videoDuration: mappedDurationStr,
          }));
          console.log(`[Video Duration Detected] Durasi video referensi: ${durSec.toFixed(1)}s -> Auto sync ke durasi file asli (khusus SeeDance 2.0 Mini): ${mappedDurationStr}`);
        };

        if (preparedMedia.durationSeconds) {
          detectAndSyncDuration(preparedMedia.durationSeconds);
        } else if (preparedMedia.previewUrl || preparedMedia.url) {
          const tempVid = document.createElement('video');
          tempVid.preload = 'metadata';
          tempVid.src = preparedMedia.previewUrl || preparedMedia.url;
          tempVid.onloadedmetadata = () => {
            if (tempVid.duration && !isNaN(tempVid.duration) && isFinite(tempVid.duration)) {
              preparedMedia.durationSeconds = tempVid.duration;
              setAttachedMedia((prev) =>
                prev.map((m) => (m.id === preparedMedia.id ? { ...m, durationSeconds: tempVid.duration } : m))
              );
              detectAndSyncDuration(tempVid.duration);
            }
          };
        }
      } else {
        // Model selain SeeDance 2.0 Mini: Jangan ubah/sync videoDuration di settings!
        if (!preparedMedia.durationSeconds && (preparedMedia.previewUrl || preparedMedia.url)) {
          const tempVid = document.createElement('video');
          tempVid.preload = 'metadata';
          tempVid.src = preparedMedia.previewUrl || preparedMedia.url;
          tempVid.onloadedmetadata = () => {
            if (tempVid.duration && !isNaN(tempVid.duration) && isFinite(tempVid.duration)) {
              preparedMedia.durationSeconds = tempVid.duration;
              setAttachedMedia((prev) =>
                prev.map((m) => (m.id === preparedMedia.id ? { ...m, durationSeconds: tempVid.duration } : m))
              );
            }
          };
        }
      }
    }

    uploadMediaFile(preparedMedia);
  };

  const handleRetryUpload = (id: string) => {
    const item = attachedMedia.find((m) => m.id === id);
    if (item) {
      setAttachedMedia((prev) =>
        prev.map((m) => (m.id === id ? { ...m, isUploading: true, uploadProgress: 0, uploadError: undefined } : m))
      );
      uploadMediaFile(item);
    }
  };

  const handleRemoveMedia = (id: string) => {
    setAttachedMedia((prev) => prev.filter((m) => m.id !== id));
  };

  const handleToggleFavorite = (id: string) => {
    setGenerations((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
      )
    );
    if (selectedDetailItem && selectedDetailItem.id === id) {
      setSelectedDetailItem((prev) =>
        prev ? { ...prev, isFavorite: !prev.isFavorite } : null
      );
    }
  };

  const handleDeleteGeneration = async (id: string) => {
    if (!id) return;
    const activeAcc = getActiveAccount();

    const itemsToDelete = generations.filter(
      (g) =>
        g.id === id ||
        (g.recipeId && g.recipeId === id) ||
        (g.mediaUrl && g.mediaUrl === id) ||
        (g.taskId && g.taskId === id)
    );

    const idsToPurge = new Set<string>([id]);
    const recipeIdsToPurge = new Set<string>();
    const mediaUrlsToPurge = new Set<string>();
    const taskIdsToPurge = new Set<string>();

    itemsToDelete.forEach((item) => {
      if (item.id) idsToPurge.add(item.id);
      if (item.recipeId) {
        recipeIdsToPurge.add(item.recipeId);
        idsToPurge.add(item.recipeId);
      }
      if (item.mediaUrl) {
        mediaUrlsToPurge.add(item.mediaUrl);
        idsToPurge.add(item.mediaUrl);
      }
      if (item.thumbnailUrl) {
        idsToPurge.add(item.thumbnailUrl);
      }
      if (item.taskId) {
        taskIdsToPurge.add(item.taskId);
        idsToPurge.add(item.taskId);
      }
    });

    try {
      const rawDeleted = localStorage.getItem('weavy_deleted_ids');
      const deletedSet = new Set<string>(rawDeleted ? JSON.parse(rawDeleted) : []);
      idsToPurge.forEach((identifier) => deletedSet.add(identifier));
      localStorage.setItem('weavy_deleted_ids', JSON.stringify(Array.from(deletedSet)));
    } catch (e) {}

    setGenerations((prev) => {
      const updated = prev.filter((item) => {
        if (idsToPurge.has(item.id)) return false;
        if (item.recipeId && recipeIdsToPurge.has(item.recipeId)) return false;
        if (item.mediaUrl && mediaUrlsToPurge.has(item.mediaUrl)) return false;
        if (item.taskId && taskIdsToPurge.has(item.taskId)) return false;
        return true;
      });
      try {
        localStorage.setItem('weavy_generations', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    if (
      selectedDetailItem &&
      (idsToPurge.has(selectedDetailItem.id) ||
        (selectedDetailItem.recipeId && recipeIdsToPurge.has(selectedDetailItem.recipeId)) ||
        (selectedDetailItem.mediaUrl && mediaUrlsToPurge.has(selectedDetailItem.mediaUrl)))
    ) {
      setSelectedDetailItem(null);
    }

    if (activeAcc) {
      recipeIdsToPurge.forEach((rId) => {
        deleteWeavyRecipe(rId, {
          refreshToken: activeAcc.refreshToken,
          idToken: activeAcc.idToken,
        }).catch(() => {});
      });
    }
  };

  const handleDeleteGenerations = async (
    ids: string[],
    onProgress?: (current: number, total: number) => void
  ) => {
    if (!ids || ids.length === 0) return;

    const inputIdsSet = new Set(ids);
    const activeAcc = getActiveAccount();

    const itemsToDelete = generations.filter(
      (g) =>
        inputIdsSet.has(g.id) ||
        (g.recipeId && inputIdsSet.has(g.recipeId)) ||
        (g.mediaUrl && inputIdsSet.has(g.mediaUrl)) ||
        (g.taskId && inputIdsSet.has(g.taskId))
    );

    const idsToPurge = new Set<string>(ids);
    const recipeIdsToPurge = new Set<string>();
    const mediaUrlsToPurge = new Set<string>();
    const taskIdsToPurge = new Set<string>();

    itemsToDelete.forEach((item) => {
      if (item.id) idsToPurge.add(item.id);
      if (item.recipeId) {
        recipeIdsToPurge.add(item.recipeId);
        idsToPurge.add(item.recipeId);
      }
      if (item.mediaUrl) {
        mediaUrlsToPurge.add(item.mediaUrl);
        idsToPurge.add(item.mediaUrl);
      }
      if (item.thumbnailUrl) {
        idsToPurge.add(item.thumbnailUrl);
      }
      if (item.taskId) {
        taskIdsToPurge.add(item.taskId);
        idsToPurge.add(item.taskId);
      }
    });

    try {
      const rawDeleted = localStorage.getItem('weavy_deleted_ids');
      const deletedSet = new Set<string>(rawDeleted ? JSON.parse(rawDeleted) : []);
      idsToPurge.forEach((identifier) => deletedSet.add(identifier));
      localStorage.setItem('weavy_deleted_ids', JSON.stringify(Array.from(deletedSet)));
    } catch (e) {}

    setGenerations((prev) => {
      const updated = prev.filter((item) => {
        if (idsToPurge.has(item.id)) return false;
        if (item.recipeId && recipeIdsToPurge.has(item.recipeId)) return false;
        if (item.mediaUrl && mediaUrlsToPurge.has(item.mediaUrl)) return false;
        if (item.taskId && taskIdsToPurge.has(item.taskId)) return false;
        return true;
      });
      try {
        localStorage.setItem('weavy_generations', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    if (
      selectedDetailItem &&
      (idsToPurge.has(selectedDetailItem.id) ||
        (selectedDetailItem.recipeId && recipeIdsToPurge.has(selectedDetailItem.recipeId)) ||
        (selectedDetailItem.mediaUrl && mediaUrlsToPurge.has(selectedDetailItem.mediaUrl)))
    ) {
      setSelectedDetailItem(null);
    }

    const recipeList = Array.from(recipeIdsToPurge);
    const total = recipeList.length;

    if (total === 0) {
      if (onProgress) onProgress(1, 1);
      return;
    }

    for (let i = 0; i < total; i++) {
      if (onProgress) onProgress(i + 1, total);
      const rId = recipeList[i];
      if (activeAcc) {
        try {
          await deleteWeavyRecipe(rId, {
            refreshToken: activeAcc.refreshToken,
            idToken: activeAcc.idToken,
          });
        } catch (e) {}
      }
      if (total > 1) {
        await new Promise((r) => setTimeout(r, 20));
      }
    }
  };

  const handleSendAsReference = (item: GenerationItem) => {
    if (!item.mediaUrl) return;
    const isVideo = item.mode === 'video' || item.mediaUrl.toLowerCase().includes('.mp4');
    const refMedia: AttachedMedia = {
      id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: isVideo ? 'video' : 'image',
      source: 'device',
      name: item.title ? `${item.title.substring(0, 18)} (Ref)` : `Hasil ${isVideo ? 'Video' : 'Gambar'}`,
      url: item.mediaUrl,
      size: isVideo ? 'Video Ref' : 'Gambar Ref',
      isUploading: false,
      uploadProgress: 100,
    };

    setAttachedMedia((prev) => {
      if (prev.some((m) => m.url === item.mediaUrl)) return prev;
      return [...prev, refMedia];
    });

    setActiveTab('generate');
    if (selectedDetailItem) {
      setSelectedDetailItem(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSendExtractedFrameAsReference = (frameDataUrl: string, frameLabel: string) => {
    if (!frameDataUrl) return;
    const refMedia: AttachedMedia = {
      id: `frame_ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'image',
      source: 'device',
      name: frameLabel || `Frame PNG (${new Date().toLocaleTimeString()})`,
      url: frameDataUrl,
      size: 'Frame PNG',
      isUploading: false,
      uploadProgress: 100,
    };

    setAttachedMedia((prev) => [refMedia, ...prev]);
    setActiveTab('generate');
    if (selectedDetailItem) {
      setSelectedDetailItem(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReuseGeneration = (item: GenerationItem) => {
    // 1. Restore Prompt Text
    const cleanPromptText = getCleanPrompt(item.prompt, item.model) || item.prompt || item.title || '';
    setPrompt(cleanPromptText);

    // 2. Restore Attached Media (Images & Videos)
    const reusedMedia: AttachedMedia[] = [];

    if (item.attachedMedia && Array.isArray(item.attachedMedia) && item.attachedMedia.length > 0) {
      item.attachedMedia.forEach((m) => {
        reusedMedia.push({
          ...m,
          id: `reuse_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          isUploading: false,
          uploadProgress: 100,
        });
      });
    } else {
      if (item.queuedData?.imgUrl) {
        reusedMedia.push({
          id: `reuse_img_${Date.now()}`,
          type: 'image',
          source: 'device',
          name: 'Input Gambar',
          url: item.queuedData.imgUrl,
          size: 'Gambar Input',
          isUploading: false,
          uploadProgress: 100,
        });
      }
      if (item.queuedData?.vidUrl) {
        reusedMedia.push({
          id: `reuse_vid_${Date.now()}`,
          type: 'video',
          source: 'device',
          name: 'Input Video',
          url: item.queuedData.vidUrl,
          size: 'Video Input',
          isUploading: false,
          uploadProgress: 100,
        });
      }
      if (reusedMedia.length === 0 && item.thumbnailUrl && item.thumbnailUrl !== item.mediaUrl) {
        reusedMedia.push({
          id: `reuse_thumb_${Date.now()}`,
          type: 'image',
          source: 'device',
          name: 'Gambar Input',
          url: item.thumbnailUrl,
          size: 'Gambar Input',
          isUploading: false,
          uploadProgress: 100,
        });
      }
    }

    setAttachedMedia(reusedMedia);

    // 3. Restore Settings (Mode, Model, Aspect Ratio, Resolution)
    if (item.mode) {
      const isVideo = item.mode === 'video';
      setSettings((prev) => {
        const next = { ...prev, mode: item.mode };
        if (isVideo && item.model) {
          next.videoModel = item.model as VideoModel;
        } else if (!isVideo && item.model) {
          next.imageModel = item.model as ImageModel;
        }

        if (item.aspectRatio && item.aspectRatio !== 'Auto') {
          if (isVideo) {
            const match = (['9:16 (Vertical)', '16:9 (Landscape)', '1:1 (Square)', '4:3', '3:4', '21:9', '3:2', '2:3'] as VideoAspectRatio[]).find(
              (r) => r.startsWith(item.aspectRatio)
            );
            if (match) next.videoAspectRatio = match;
          } else {
            const match = (['1:1 (Square)', '9:16 (Vertical)', '16:9 (Landscape)'] as ImageAspectRatio[]).find(
              (r) => r.startsWith(item.aspectRatio)
            );
            if (match) next.imageAspectRatio = match;
          }
        }

        if (item.resolution && item.resolution !== 'Auto') {
          if (isVideo) {
            if (item.resolution.includes('1080')) next.videoResolution = '1080p';
            else if (item.resolution.includes('720')) next.videoResolution = '720p';
            else if (item.resolution.includes('480')) next.videoResolution = '480p';
          }
        }

        return next;
      });
    }

    // 4. Navigate back to Generate tab, close detail modal, and smooth scroll to top
    setActiveTab('generate');
    if (selectedDetailItem) {
      setSelectedDetailItem(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Helper to sync provider accounts to Google Sheets
  const syncProviderAccountsToSheet = async (providerId: string, accounts: any[]) => {
    const userToUse = currentUser?.userId ? currentUser : (() => {
      try {
        const saved = localStorage.getItem('amb_active_user');
        return saved ? JSON.parse(saved) : null;
      } catch (e) {
        return null;
      }
    })();
    if (!userToUse?.userId || !Array.isArray(accounts)) return;
    try {
      await safeFetchJson(`/api/providers/${providerId}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userToUse.userId,
          accounts,
        }),
      });
    } catch (e) {
      console.warn(`[Sync ${providerId} to sheet notice]:`, e);
    }
  };

  // Helper to get or auto-select an account with sufficient credits (with fresh online verification)
  const verifyAndSelectSufficientAccount = async (requiredCredits: number) => {
    try {
      const raw = localStorage.getItem('weavy_accounts');
      if (!raw) return null;
      const accounts = JSON.parse(raw);
      if (!Array.isArray(accounts) || accounts.length === 0) return null;

      let activeIdx = accounts.findIndex((a: any) => a.isActive);
      if (activeIdx === -1) activeIdx = 0;

      const saveAccounts = (updatedAccounts: any[]) => {
        localStorage.setItem('weavy_accounts', JSON.stringify(updatedAccounts));
        window.dispatchEvent(new Event('weavy_accounts_updated'));
        window.dispatchEvent(new Event('accounts-updated'));
        syncProviderAccountsToSheet('weavy', updatedAccounts);
      };

      const orderedIndices = [activeIdx, ...accounts.map((_: any, index: number) => index).filter((index: number) => index !== activeIdx)];
      const failedAuthIndices = new Set<number>();

      for (const index of orderedIndices) {
        const account = accounts[index];
        if (!account) continue;

        let updatedAccount = { ...account };
        let refreshError: unknown = null;
        if (account.refreshToken) {
          try {
            const info = await exchangeRefreshTokenAndGetInfo(account.refreshToken, account.email);
            updatedAccount = {
              ...updatedAccount,
              credits: info.credits,
              totalCredits: info.totalCredits,
              idToken: info.idToken,
              refreshToken: info.refreshToken,
            };
          } catch (error) {
            refreshError = error;
            const message = error instanceof Error ? error.message : String(error);
            const isAuthFailure = /token|auth|expired|invalid|unauthorized|disabled/i.test(message);
            if (isAuthFailure) failedAuthIndices.add(index);
            console.warn(`Notice verifying Weavy account ${account.email}:`, error);
          }
        }

        const refreshedCredits = typeof updatedAccount.credits === 'number' ? updatedAccount.credits : 0;
        const shouldTryAutoImport =
          Boolean(account.email) &&
          (failedAuthIndices.has(index) || (!refreshError && refreshedCredits < requiredCredits));

        if (shouldTryAutoImport) {
          try {
            const imported = await autoImportWeavyAccountForEmail(account.email);
            updatedAccount = {
              ...updatedAccount,
              email: imported.email || account.email,
              name: imported.name || updatedAccount.name,
              displayName: imported.displayName || imported.name || updatedAccount.displayName,
              refreshToken: imported.refreshToken || updatedAccount.refreshToken,
              idToken: imported.idToken || updatedAccount.idToken,
              credits: typeof imported.credits === 'number' ? imported.credits : updatedAccount.credits,
              totalCredits: typeof imported.totalCredits === 'number' ? imported.totalCredits : updatedAccount.totalCredits,
              accountStatus: 'active',
              statusMessage: undefined,
            };
            failedAuthIndices.delete(index);
            refreshError = null;
          } catch (importError) {
            console.warn(`Auto-Import recovery for ${account.email} was not used:`, importError);
          }
        }

        accounts[index] = updatedAccount;
        const availableCredits = typeof updatedAccount.credits === 'number' ? updatedAccount.credits : 0;
        const hasUsableAuth = Boolean(updatedAccount.refreshToken || updatedAccount.idToken);
        const mayUseCachedCredits = !failedAuthIndices.has(index) && !refreshError;

        if (hasUsableAuth && availableCredits >= requiredCredits && mayUseCachedCredits) {
          const selectedAccounts = accounts.map((saved: any, savedIndex: number) => ({
            ...saved,
            isActive: savedIndex === index,
          }));
          saveAccounts(selectedAccounts);
          return selectedAccounts[index];
        }
      }

      saveAccounts(accounts);
      return null;
    } catch (e) {
      console.error('[Weavy Account Verification Error]:', e);
      return null;
    }
  };

  // Helper to get selected active account
  const getActiveAccount = () => {
    try {
      const raw = localStorage.getItem('weavy_accounts');
      if (!raw) return null;
      const accounts = JSON.parse(raw);
      if (!Array.isArray(accounts) || accounts.length === 0) return null;
      return accounts.find((a: any) => a.isActive) || accounts[0];
    } catch (e) {
      return null;
    }
  };

  // Helper to directly update account credits in localStorage from real-time polling response
  const updateDirectAccountCredits = (targetAccount: any, newCredits: number) => {
    if (!targetAccount || typeof newCredits !== 'number' || isNaN(newCredits)) return;
    try {
      const raw = localStorage.getItem('weavy_accounts');
      if (!raw) return;
      const accounts = JSON.parse(raw);
      if (!Array.isArray(accounts) || accounts.length === 0) return;

      const targetId = targetAccount.id;
      const targetToken = targetAccount.refreshToken;
      const targetEmail = targetAccount.email ? targetAccount.email.toLowerCase() : null;

      let updated = false;
      const updatedAccounts = accounts.map((a: any) => {
        const matchId = Boolean(targetId && a.id === targetId);
        const matchToken = Boolean(targetToken && a.refreshToken === targetToken);
        const matchEmail = Boolean(targetEmail && a.email && a.email.toLowerCase() === targetEmail);

        // STRICT MATCH: Only update this specific account, NEVER touch other accounts!
        if (matchId || (!targetId && (matchToken || matchEmail))) {
          if (a.credits !== newCredits) {
            updated = true;
            return {
              ...a,
              credits: newCredits,
            };
          }
        }
        return a;
      });

      if (updated) {
        console.log(`[Client 🪙 Real-time Credit Update] Sisa kredit akun ${targetAccount.email || targetAccount.id} diperbarui: ${newCredits}`);
        localStorage.setItem('weavy_accounts', JSON.stringify(updatedAccounts));
        window.dispatchEvent(new Event('weavy_accounts_updated'));
      }
    } catch (err) {
      console.warn('Notice updating direct credits:', err);
    }
  };

  // Helper to sync credits for active account after generation finished (success/fail)
  const autoSyncActiveAccountCredits = async (usedAccount?: any) => {
    const activeAcc = usedAccount || getActiveAccount();
    if (!activeAcc || !activeAcc.refreshToken) return;

    try {
      const info = await exchangeRefreshTokenAndGetInfo(activeAcc.refreshToken, activeAcc.email);
      const raw = localStorage.getItem('weavy_accounts');
      if (!raw) return;
      const accounts = JSON.parse(raw);
      if (!Array.isArray(accounts) || accounts.length === 0) return;

      const targetId = activeAcc.id;
      const targetToken = activeAcc.refreshToken;
      const targetEmail = activeAcc.email ? activeAcc.email.toLowerCase() : null;

      const updatedAccounts = accounts.map((a: any) => {
        const matchId = Boolean(targetId && a.id === targetId);
        const matchToken = Boolean(targetToken && a.refreshToken === targetToken);
        const matchEmail = Boolean(targetEmail && a.email && a.email.toLowerCase() === targetEmail);

        // STRICT MATCH: Only update the target active account
        if (matchId || (!targetId && (matchToken || matchEmail))) {
          return {
            ...a,
            credits: info.credits,
            totalCredits: typeof info.totalCredits === 'number' ? info.totalCredits : a.totalCredits,
            idToken: info.idToken || a.idToken,
            refreshToken: info.refreshToken || a.refreshToken,
          };
        }
        return a;
      });

      localStorage.setItem('weavy_accounts', JSON.stringify(updatedAccounts));
      // Dispatch custom storage events
      window.dispatchEvent(new Event('weavy_accounts_updated'));
      window.dispatchEvent(new Event('accounts-updated'));
      syncProviderAccountsToSheet('weavy', updatedAccounts);
    } catch (err) {
      console.warn('Auto-sync credits notice:', err);
    }
  };

  const deductedKieTaskIdsRef = React.useRef<Set<string>>(new Set());

  // Helper to get or auto-select a Kie account with sufficient credits (matching duration & resolution cost)
  const verifyAndSelectSufficientKieAccount = async (requiredCredits: number) => {
    try {
      const kieAccs = getKieAccounts();
      if (!Array.isArray(kieAccs) || kieAccs.length === 0) return null;

      let activeIdx = kieAccs.findIndex((a) => a.isActive);
      if (activeIdx === -1) activeIdx = 0;

      const activeAcc = kieAccs[activeIdx];

      // 1. Try active account first (with fresh verification from API)
      if (activeAcc) {
        const tokenToVerify = activeAcc.refreshToken || activeAcc.accessToken || activeAcc.idToken;
        if (tokenToVerify) {
          try {
            const { ok, data } = await safeFetchJson('/api/kie/accounts/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accessToken: tokenToVerify }),
            });
            if (ok && data && data.success) {
              const freshCredits = (data.hasValidCredits && typeof data.credits === 'number')
                ? data.credits
                : (typeof activeAcc.credits === 'number' ? activeAcc.credits : 80);
              kieAccs[activeIdx] = {
                ...activeAcc,
                credits: freshCredits,
                totalCredits: typeof data.totalCredits === 'number' ? data.totalCredits : activeAcc.totalCredits,
              };
              localStorage.setItem('kie_accounts', JSON.stringify(kieAccs));
              window.dispatchEvent(new Event('kie_accounts_updated'));
              window.dispatchEvent(new Event('accounts-updated'));

              if (freshCredits >= requiredCredits) {
                return kieAccs[activeIdx];
              }
            }
          } catch (e) {
            console.warn('Notice verifying active Kie account:', e);
          }
        } else if ((activeAcc.credits ?? 80) >= requiredCredits) {
          return activeAcc;
        }
      }

      // 2. Active account doesn't have enough credits or verification failed. Check other saved Kie accounts!
      for (let i = 0; i < kieAccs.length; i++) {
        if (i === activeIdx) continue;
        const acc = kieAccs[i];
        const tokenToVerify = acc?.refreshToken || acc?.accessToken || acc?.idToken;
        if (!acc || !tokenToVerify) continue;

        try {
          const { ok, data } = await safeFetchJson('/api/kie/accounts/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: tokenToVerify }),
          });

          if (ok && data && data.success) {
            const freshCredits = (data.hasValidCredits && typeof data.credits === 'number')
              ? data.credits
              : (typeof acc.credits === 'number' ? acc.credits : 80);
            kieAccs[i] = {
              ...acc,
              credits: freshCredits,
              totalCredits: typeof data.totalCredits === 'number' ? data.totalCredits : acc.totalCredits,
            };

            if (freshCredits >= requiredCredits) {
              const updatedAccounts = kieAccs.map((a, idx) => ({
                ...a,
                isActive: idx === i,
              }));
              localStorage.setItem('kie_accounts', JSON.stringify(updatedAccounts));
              window.dispatchEvent(new Event('kie_accounts_updated'));
              window.dispatchEvent(new Event('accounts-updated'));
              syncProviderAccountsToSheet('kie', updatedAccounts);
              return updatedAccounts[i];
            }
          }
        } catch (e) {
          console.warn(`Notice verifying Kie account ${acc.email || acc.id}:`, e);
        }
      }

      // Save updated account list state
      localStorage.setItem('kie_accounts', JSON.stringify(kieAccs));
      window.dispatchEvent(new Event('kie_accounts_updated'));
      window.dispatchEvent(new Event('accounts-updated'));

      // Fallback to local stored accounts if credits match
      const fallbackIdx = kieAccs.findIndex((a) => (a.credits ?? 0) >= requiredCredits);
      if (fallbackIdx !== -1) {
        const updatedAccounts = kieAccs.map((a, idx) => ({
          ...a,
          isActive: idx === fallbackIdx,
        }));
        localStorage.setItem('kie_accounts', JSON.stringify(updatedAccounts));
        window.dispatchEvent(new Event('kie_accounts_updated'));
        window.dispatchEvent(new Event('accounts-updated'));
        syncProviderAccountsToSheet('kie', updatedAccounts);
        return updatedAccounts[fallbackIdx];
      }

      return null;
    } catch (e) {
      return null;
    }
  };

  // Helper to sync credits for Kie.ai account after generation finished (success/fail)
  const autoSyncKieAccountCredits = async (usedToken?: string) => {
    try {
      const kieAccs = getKieAccounts();
      if (kieAccs.length === 0) return;
      
      const cleanT = (t?: string) => (t || '').replace(/^bearer\s+/i, '').trim();
      const cleanUsed = cleanT(usedToken);
      
      const targetAcc = cleanUsed
        ? (kieAccs.find((a) => cleanT(a.refreshToken) === cleanUsed || cleanT(a.accessToken) === cleanUsed) || kieAccs.find((a) => a.isActive) || kieAccs[0])
        : (kieAccs.find((a) => a.isActive) || kieAccs[0]);
      
      const tokenToVerify = cleanUsed || cleanT(targetAcc?.refreshToken || targetAcc?.accessToken);
      if (!tokenToVerify) return;

      const { ok, data } = await safeFetchJson('/api/kie/accounts/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: tokenToVerify }),
      });

      if (ok && data && data.success && data.hasValidCredits && typeof data.credits === 'number') {
        const updatedAccounts = kieAccs.map((a: any) => {
          const accToken = cleanT(a.refreshToken || a.accessToken);
          if (accToken === tokenToVerify || a.id === targetAcc?.id || (targetAcc?.isActive && a.isActive)) {
            return {
              ...a,
              credits: data.credits,
              totalCredits: typeof data.totalCredits === 'number' ? data.totalCredits : a.totalCredits,
            };
          }
          return a;
        });
        localStorage.setItem('kie_accounts', JSON.stringify(updatedAccounts));
        window.dispatchEvent(new Event('kie_accounts_updated'));
        window.dispatchEvent(new Event('accounts-updated'));
        syncProviderAccountsToSheet('kie', updatedAccounts);
      }
    } catch (err) {
      console.warn('Auto-sync Kie.ai credits notice:', err);
    }
  };

  // Helper to directly update Kie.ai account credits from real-time polling response
  const updateDirectKieAccountCredits = (
    targetAccount: any,
    newCreditsOrConsumed: { remainingCredits?: number; creditsConsumed?: number },
    taskId?: string
  ) => {
    if (!targetAccount) return;
    try {
      const raw = localStorage.getItem('kie_accounts');
      if (!raw) return;
      const accounts = JSON.parse(raw);
      if (!Array.isArray(accounts)) return;

      // If deduction by consumed amount, ensure each taskId is deducted at most once
      if (typeof newCreditsOrConsumed.creditsConsumed === 'number' && newCreditsOrConsumed.creditsConsumed > 0) {
        if (taskId) {
          if (deductedKieTaskIdsRef.current.has(taskId)) {
            // Already deducted for this taskId, do not deduct again
            return;
          }
          deductedKieTaskIdsRef.current.add(taskId);
        }
      }

      let updated = false;
      const cleanT = (t?: string) => (t || '').replace(/^bearer\s+/i, '').trim();
      const targetToken = cleanT(targetAccount.refreshToken || targetAccount.accessToken);
      const updatedAccounts = accounts.map((a: any) => {
        const accToken = cleanT(a.refreshToken || a.accessToken);
        const matchId = (targetAccount.id && a.id === targetAccount.id) || (targetToken && accToken === targetToken);
        const matchEmail = targetAccount.email && a.email && a.email.toLowerCase() === targetAccount.email.toLowerCase();
        if (matchId || matchEmail) {
          let updatedCredit = typeof a.credits === 'number' ? a.credits : 80;
          if (typeof newCreditsOrConsumed.remainingCredits === 'number') {
            updatedCredit = newCreditsOrConsumed.remainingCredits;
          } else if (typeof newCreditsOrConsumed.creditsConsumed === 'number' && newCreditsOrConsumed.creditsConsumed > 0) {
            updatedCredit = Math.max(0, parseFloat((updatedCredit - newCreditsOrConsumed.creditsConsumed).toFixed(2)));
          }

          if (a.credits !== updatedCredit) {
            updated = true;
            return {
              ...a,
              credits: updatedCredit,
            };
          }
        }
        return a;
      });

      if (updated) {
        console.log(`[Client 🪙 Kie.ai Real-time Credit Update] Kredit akun Kie.ai diperbarui:`, newCreditsOrConsumed);
        localStorage.setItem('kie_accounts', JSON.stringify(updatedAccounts));
        window.dispatchEvent(new Event('kie_accounts_updated'));
        window.dispatchEvent(new Event('accounts-updated'));
        syncProviderAccountsToSheet('kie', updatedAccounts);
      }
    } catch (err) {
      console.warn('Notice updating direct Kie credits:', err);
    }
  };

  // Helper to get or auto-select a Galleri5 account with sufficient credits (>= 60 credits required)
  const verifyAndSelectSufficientGalleri5Account = async (requiredCredits: number = 60) => {
    try {
      const galleri5Accs = getGalleri5Accounts();
      if (!Array.isArray(galleri5Accs) || galleri5Accs.length === 0) return null;

      let activeIdx = galleri5Accs.findIndex((a) => a.isActive);
      if (activeIdx === -1) activeIdx = 0;

      const activeAcc = galleri5Accs[activeIdx];

      // 1. Try active account first (with fresh verification from API)
      if (activeAcc) {
        const tokenToVerify = activeAcc.refreshToken || activeAcc.accessToken || activeAcc.idToken;
        if (tokenToVerify) {
          try {
            const { ok, data } = await safeFetchJson('/api/galleri5/accounts/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accessToken: tokenToVerify }),
            });
            if (ok && data && data.success) {
              const freshCredits = typeof data.credits === 'number' ? data.credits : (activeAcc.credits ?? 100);
              galleri5Accs[activeIdx] = {
                ...activeAcc,
                credits: freshCredits,
                totalCredits: typeof data.totalCredits === 'number' ? data.totalCredits : activeAcc.totalCredits,
                refreshToken: data.cleanToken || activeAcc.refreshToken,
              };
              localStorage.setItem('galleri5_accounts', JSON.stringify(galleri5Accs));
              window.dispatchEvent(new Event('galleri5_accounts_updated'));
              window.dispatchEvent(new Event('accounts-updated'));

              if (freshCredits >= requiredCredits) {
                return galleri5Accs[activeIdx];
              }
            }
          } catch (e) {
            console.warn('Notice verifying active Galleri5 account:', e);
          }
        } else if ((activeAcc.credits ?? 100) >= requiredCredits) {
          return activeAcc;
        }
      }

      // 2. Active account doesn't have enough credits or verification failed. Check other saved Galleri5 accounts!
      for (let i = 0; i < galleri5Accs.length; i++) {
        if (i === activeIdx) continue;
        const acc = galleri5Accs[i];
        const tokenToVerify = acc?.refreshToken || acc?.accessToken || acc?.idToken;
        if (!acc || !tokenToVerify) continue;

        try {
          const { ok, data } = await safeFetchJson('/api/galleri5/accounts/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: tokenToVerify }),
          });

          if (ok && data && data.success) {
            const freshCredits = typeof data.credits === 'number' ? data.credits : (acc.credits ?? 100);
            galleri5Accs[i] = {
              ...acc,
              credits: freshCredits,
              totalCredits: typeof data.totalCredits === 'number' ? data.totalCredits : acc.totalCredits,
              refreshToken: data.cleanToken || acc.refreshToken,
            };

            if (freshCredits >= requiredCredits) {
              const updatedAccounts = galleri5Accs.map((a, idx) => ({
                ...a,
                isActive: idx === i,
              }));
              localStorage.setItem('galleri5_accounts', JSON.stringify(updatedAccounts));
              window.dispatchEvent(new Event('galleri5_accounts_updated'));
              window.dispatchEvent(new Event('accounts-updated'));
              syncProviderAccountsToSheet('galleri5', updatedAccounts);
              return updatedAccounts[i];
            }
          }
        } catch (e) {
          console.warn(`Notice verifying Galleri5 account ${acc.email || acc.id}:`, e);
        }
      }

      // Save updated account list state
      localStorage.setItem('galleri5_accounts', JSON.stringify(galleri5Accs));
      window.dispatchEvent(new Event('galleri5_accounts_updated'));
      window.dispatchEvent(new Event('accounts-updated'));

      // Fallback to local stored accounts if credits match
      const fallbackIdx = galleri5Accs.findIndex((a) => (a.credits ?? 0) >= requiredCredits);
      if (fallbackIdx !== -1) {
        const updatedAccounts = galleri5Accs.map((a, idx) => ({
          ...a,
          isActive: idx === fallbackIdx,
        }));
        localStorage.setItem('galleri5_accounts', JSON.stringify(updatedAccounts));
        window.dispatchEvent(new Event('galleri5_accounts_updated'));
        window.dispatchEvent(new Event('accounts-updated'));
        syncProviderAccountsToSheet('galleri5', updatedAccounts);
        return updatedAccounts[fallbackIdx];
      }

      return null;
    } catch (e) {
      return null;
    }
  };

  // Helper to sync credits for Galleri5 account after generation finished (success/fail)
  const autoSyncGalleri5AccountCredits = async (usedToken?: string) => {
    try {
      const galleri5Accs = getGalleri5Accounts();
      if (galleri5Accs.length === 0) return;
      const targetAcc = usedToken
        ? (galleri5Accs.find((a) => a.refreshToken === usedToken || a.accessToken === usedToken || a.idToken === usedToken) || galleri5Accs.find((a) => a.isActive) || galleri5Accs[0])
        : (galleri5Accs.find((a) => a.isActive) || galleri5Accs[0]);
      const tokenToVerify = usedToken || targetAcc?.refreshToken || targetAcc?.accessToken || targetAcc?.idToken;
      if (!tokenToVerify) return;

      const { ok, data } = await safeFetchJson('/api/galleri5/accounts/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: tokenToVerify }),
      });

      if (ok && data && data.success) {
        const updatedAccounts = galleri5Accs.map((a: any) => {
          const accToken = a.refreshToken || a.accessToken || a.idToken;
          if (accToken === tokenToVerify || a.id === targetAcc?.id) {
            return {
              ...a,
              credits: typeof data.credits === 'number' ? data.credits : a.credits,
              totalCredits: typeof data.totalCredits === 'number' ? data.totalCredits : a.totalCredits,
              refreshToken: data.cleanToken || a.refreshToken,
            };
          }
          return a;
        });
        localStorage.setItem('galleri5_accounts', JSON.stringify(updatedAccounts));
        window.dispatchEvent(new Event('galleri5_accounts_updated'));
        window.dispatchEvent(new Event('accounts-updated'));
        syncProviderAccountsToSheet('galleri5', updatedAccounts);
      }
    } catch (err) {
      console.warn('Auto-sync Galleri5 credits notice:', err);
    }
  };

  const autoSyncVidsAccountCredits = async (email?: string) => {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) {
      console.warn('[Google Vids] Cannot refresh quota without the selected account email.');
      return;
    }

    try {
      const response = await fetch(`/api/vids/quota?email=${encodeURIComponent(normalizedEmail)}`);
      const quota = await response.json().catch(() => ({}));
      if (!response.ok || !quota.success) {
        throw new Error(quota.error || `Quota refresh failed (HTTP ${response.status}).`);
      }
      if (quota.quotaLive !== true || typeof quota.credits !== 'number' || typeof quota.totalCredits !== 'number') {
        console.warn(`[Google Vids] Live quota unavailable for ${normalizedEmail}; stored quota was not changed.`);
        return;
      }

      const raw = localStorage.getItem('vids_accounts');
      if (!raw) {
        console.warn('[Google Vids] No saved account list is available to update.');
        return;
      }
      const accs = JSON.parse(raw);
      if (!Array.isArray(accs)) {
        throw new Error('Saved Google Vids accounts are not a list.');
      }

      let matchedAccount = false;
      const updated = accs.map((account: any) => {
        if (account.email?.trim().toLowerCase() !== normalizedEmail) return account;
        matchedAccount = true;
        return {
          ...account,
          credits: quota.credits,
          totalCredits: quota.totalCredits,
          cookies: quota.cookies || account.cookies,
          token: quota.cookies || account.token,
          docId: quota.docId || account.docId,
          serverToken: quota.serverToken || account.serverToken,
          lastChecked: quota.lastChecked || new Date().toISOString(),
          quotaLive: true,
        };
      });
      if (!matchedAccount) {
        console.warn(`[Google Vids] Account ${normalizedEmail} was not found in the saved account list.`);
        return;
      }

      localStorage.setItem('vids_accounts', JSON.stringify(updated));
      window.dispatchEvent(new Event('vids_accounts_updated'));
      window.dispatchEvent(new Event('accounts-updated'));
      await syncProviderAccountsToSheet('vids', updated);
    } catch (error) {
      console.warn('[Google Vids] Live quota refresh failed:', error);
    }
  };

  const updateDirectGalleri5AccountCredits = (targetAccount: any, newCredits: number) => {
    if (!targetAccount || typeof newCredits !== 'number' || isNaN(newCredits)) return;
    try {
      const raw = localStorage.getItem('galleri5_accounts');
      if (!raw) return;
      const accounts = JSON.parse(raw);
      if (!Array.isArray(accounts)) return;

      let updated = false;
      const updatedAccounts = accounts.map((a: any) => {
        const matchId = targetAccount.id && a.id === targetAccount.id;
        const matchEmail = targetAccount.email && a.email && a.email.toLowerCase() === targetAccount.email.toLowerCase();
        if (matchId || matchEmail) {
          if (a.credits !== newCredits) {
            updated = true;
            return {
              ...a,
              credits: newCredits,
            };
          }
        }
        return a;
      });

      if (updated) {
        console.log(`[Client 🪙 Galleri5 Credit Update] Sisa kredit diperbarui langsung: ${newCredits}`);
        localStorage.setItem('galleri5_accounts', JSON.stringify(updatedAccounts));
        window.dispatchEvent(new Event('galleri5_accounts_updated'));
      }
    } catch (err) {
      console.warn('Notice updating direct Galleri5 credits:', err);
    }
  };

  // Helper to sync Gemini account credits in localStorage
  const autoSyncGeminiAccountCredits = (targetAcc?: any, remainingCredits?: number, usedTotal?: number) => {
    try {
      const raw = localStorage.getItem('gemini_accounts');
      if (!raw) return;
      const accounts = JSON.parse(raw);
      if (!Array.isArray(accounts) || accounts.length === 0) return;

      if (typeof remainingCredits !== 'number') {
        const token = targetAcc?.token || targetAcc?.refreshToken || targetAcc?.apiKey || targetAcc?.cookies;
        if (!token) return;
        void fetch('/api/gemini/accounts/sync-daily', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, email: targetAcc?.email }),
        })
          .then((response) => response.json())
          .then((data) => {
            if (data?.accountStatus === 'expired' || data?.success === false) {
              const targetId = targetAcc?.id;
              const targetEmail = targetAcc?.email;
              const targetToken = targetAcc?.token || targetAcc?.refreshToken || targetAcc?.apiKey || targetAcc?.cookies;
              const rawNow = localStorage.getItem('gemini_accounts');
              if (rawNow) {
                const accsNow = JSON.parse(rawNow);
                if (Array.isArray(accsNow)) {
                  const updated = accsNow.map((a: any) => {
                    const match =
                      (targetId && a.id === targetId) ||
                      (targetEmail && a.email && a.email.toLowerCase() === targetEmail.toLowerCase()) ||
                      (targetToken && (a.token === targetToken || a.refreshToken === targetToken || a.apiKey === targetToken || a.cookies === targetToken));
                    if (match) {
                      return {
                        ...a,
                        credits: 0,
                        isActive: false,
                        accountStatus: 'expired',
                        statusMessage: 'EXPIRED',
                      };
                    }
                    return a;
                  });
                  localStorage.setItem('gemini_accounts', JSON.stringify(updated));
                  window.dispatchEvent(new Event('gemini_accounts_updated'));
                  window.dispatchEvent(new Event('accounts-updated'));
                  syncProviderAccountsToSheet('gemini', updated);
                }
              }
              return;
            }
            const liveCredits = typeof data?.remainingCredits === 'number'
              ? data.remainingCredits
              : data?.credits;
            if (data?.success && typeof liveCredits === 'number') {
              autoSyncGeminiAccountCredits(
                targetAcc,
                liveCredits,
                typeof data.usedTotal === 'number' ? data.usedTotal : data.usedToday,
              );
            }
          })
          .catch((err) => console.warn('[Gemini Credit Sync Notice]:', err));
        return;
      }

      const targetId = targetAcc?.id;
      const targetToken = targetAcc?.token || targetAcc?.refreshToken || targetAcc?.apiKey || targetAcc?.cookies;
      const targetEmail = targetAcc?.email;

      let hasChanged = false;
      const updated = accounts.map((a: any) => {
        const match =
          (targetId && a.id === targetId) ||
          (targetEmail && a.email && a.email.toLowerCase() === targetEmail.toLowerCase()) ||
          (targetToken && (a.token === targetToken || a.refreshToken === targetToken || a.apiKey === targetToken || a.cookies === targetToken));
        if (match) {
          const currentCr = typeof a.credits === 'number' ? a.credits : 0;
          const newCredit = Math.min(GEMINI_MAX_CREDITS, Math.max(0, remainingCredits));
          const newUsedTotal = typeof usedTotal === 'number'
            ? Math.min(GEMINI_MAX_CREDITS, Math.max(0, usedTotal))
            : GEMINI_MAX_CREDITS - newCredit;
          if (newCredit !== currentCr || a.creditsUsed !== newUsedTotal) {
            hasChanged = true;
          }
          return {
            ...a,
            credits: newCredit,
            totalCredits: GEMINI_MAX_CREDITS,
            creditsUsed: newUsedTotal,
          };
        }
        return a;
      });

      if (hasChanged) {
        localStorage.setItem('gemini_accounts', JSON.stringify(updated));
        window.dispatchEvent(new Event('gemini_accounts_updated'));
        window.dispatchEvent(new Event('accounts-updated'));
        syncProviderAccountsToSheet('gemini', updated);
      }
    } catch (e) {}
  };

  // Helper to immediately mark exhausted Gemini accounts to 0 credits in localStorage & sheets
  const handleGeminiExhaustedAccounts = (data?: any, errMessage?: string, defaultAcc?: any) => {
    try {
      const raw = localStorage.getItem('gemini_accounts');
      if (!raw) return;
      const allGem = JSON.parse(raw);
      if (!Array.isArray(allGem) || allGem.length === 0) return;

      const exhaustedList = Array.isArray(data?.exhaustedAccounts) ? data.exhaustedAccounts : [];
      const exIds = new Set<string>();
      const exEmails = new Set<string>();
      const exNames = new Set<string>();

      for (const ex of exhaustedList) {
        if (ex?.id) exIds.add(String(ex.id));
        if (ex?.email) exEmails.add(String(ex.email).toLowerCase().trim());
        if (ex?.name) exNames.add(String(ex.name).toLowerCase().trim());
      }

      const textToCheck = `${errMessage || ''} ${data?.error || ''} ${data?.errorMessage || ''}`;
      const matchAccName = textToCheck.match(/Akun\s+["']([^"']+)["']/i);
      if (matchAccName && matchAccName[1]) {
        const extractedName = matchAccName[1].toLowerCase().trim();
        exNames.add(extractedName);
        if (extractedName.includes('@')) {
          exEmails.add(extractedName);
        }
      }

      const isQuotaRefusal =
        data?.isQuotaExhausted === true ||
        /mencapai kuota/i.test(textToCheck) ||
        /kuota.*habis/i.test(textToCheck) ||
        /tidak bisa membuatkan.*video.*hari ini/i.test(textToCheck) ||
        /tidak bisa membuatkan Anda video lagi hari ini/i.test(textToCheck) ||
        /batas kredit/i.test(textToCheck) ||
        /quota/i.test(textToCheck);

      if (isQuotaRefusal && defaultAcc) {
        if (defaultAcc.id) exIds.add(String(defaultAcc.id));
        if (defaultAcc.email) exEmails.add(String(defaultAcc.email).toLowerCase().trim());
        if (defaultAcc.name) exNames.add(String(defaultAcc.name).toLowerCase().trim());
        if (defaultAcc.displayName) exNames.add(String(defaultAcc.displayName).toLowerCase().trim());
      }

      if (exIds.size === 0 && exEmails.size === 0 && exNames.size === 0) return;

      let hasChanged = false;
      const updated = allGem.map((a: any) => {
        const aId = String(a.id || '');
        const aEmail = String(a.email || '').toLowerCase().trim();
        const aName = String(a.name || '').toLowerCase().trim();
        const aDisplay = String(a.displayName || '').toLowerCase().trim();

        const isMatch =
          exIds.has(aId) ||
          (aEmail && exEmails.has(aEmail)) ||
          (aName && exNames.has(aName)) ||
          (aDisplay && exNames.has(aDisplay)) ||
          (aEmail && exNames.has(aEmail.split('@')[0]));

        if (isMatch) {
          if (a.credits !== 0) {
            hasChanged = true;
          }
          return {
            ...a,
            credits: 0,
            totalCredits: GEMINI_MAX_CREDITS,
          };
        }
        return a;
      });

      if (hasChanged) {
        localStorage.setItem('gemini_accounts', JSON.stringify(updated));
        window.dispatchEvent(new Event('gemini_accounts_updated'));
        window.dispatchEvent(new Event('accounts-updated'));
        syncProviderAccountsToSheet('gemini', updated);
      }
    } catch (e) {
      console.warn('[handleGeminiExhaustedAccounts error]:', e);
    }
  };

  // Select an active Gemini account with available lifetime video credits.
  const verifyAndSelectSufficientGeminiAccount = async (requiredCredits: number = 1): Promise<ProviderAccount | null> => {
    try {
      const gemAccs = getGeminiAccounts();
      if (!Array.isArray(gemAccs) || gemAccs.length === 0) return null;

      // Filter valid accounts with token/cookies/apiKey and NOT failed/expired
      const validAccs = gemAccs.filter((a: any) => {
        const tok = (a?.token || a?.refreshToken || a?.apiKey || a?.cookies || '').trim();
        const isNotDead = !a?.accountStatus || a?.accountStatus === 'active';
        return tok.length > 0 && isNotDead;
      });

      if (validAccs.length === 0) return null;

      // Prioritize the user's manually chosen active account
      let activeAcc: any = null;
      try {
        const savedActiveId = localStorage.getItem('gemini_active_account_id');
        if (savedActiveId) {
          activeAcc = validAccs.find((a) => a.id === savedActiveId);
        }
      } catch (e) {}
      if (!activeAcc) {
        activeAcc = validAccs.find((a) => a.isActive) || validAccs[0];
      }

      const activeCredits = typeof activeAcc.credits === 'number' ? activeAcc.credits : 0;

      // 1. If active account has sufficient credits, use it directly (allows parallel generations on the same account up to its available quota)
      if (activeCredits >= requiredCredits) {
        return activeAcc;
      }

      // 2. Active account is truly exhausted (0 credits). Search candidate backup accounts with credits > 0 in order
      const candidateList = validAccs.filter((a) => a.id !== activeAcc.id);

      for (const candidate of candidateList) {
        const rawCredits = typeof candidate.credits === 'number' ? candidate.credits : 0;

        if (rawCredits >= requiredCredits) {
          console.log(`[Gemini Auto-Switch ⚡] Akun aktif sebelumnya telah habis kuota (0 kredit). Otomatis beralih ke akun cadangan "${candidate.displayName || candidate.name || candidate.email}" (sisa ${rawCredits}/${GEMINI_MAX_CREDITS} kredit).`);
          const updated = gemAccs.map((a) => ({
            ...a,
            isActive: a.id === candidate.id,
          }));
          localStorage.setItem('gemini_accounts', JSON.stringify(updated));
          localStorage.setItem('gemini_active_account_id', candidate.id);
          window.dispatchEvent(new Event('gemini_accounts_updated'));
          window.dispatchEvent(new Event('accounts-updated'));
          syncProviderAccountsToSheet('gemini', updated);
          return candidate;
        }
      }

      // If all accounts reached 0, return the active account
      return activeAcc;
    } catch (e) {
      return null;
    }
  };



  // Master background live timer loop: Keep all processing & queued generation timers ticking accurately in real-time across tabs/menus
  React.useEffect(() => {
    const interval = setInterval(() => {
      setGenerations((prev) => {
        const hasActive = prev.some((g) => g.status === 'processing' || g.status === 'queued');
        if (!hasActive) return prev;

        const now = Date.now();
        let changed = false;
        const updated = prev.map((g) => {
          if (g.status === 'processing' || g.status === 'queued') {
            const start =
              g.startedAt ||
              g.createdAtTimestamp ||
              (g.id.startsWith('gen-') ? Number(g.id.replace('gen-', '')) : null);
            if (start && !isNaN(start) && start > 0) {
              const elapsedSec = Math.max(1, Math.floor((now - start) / 1000));
              const mins = Math.floor(elapsedSec / 60);
              const remSecs = elapsedSec % 60;
              const formattedTimer = `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
              const calculatedProgress = Math.min(10 + Math.floor(elapsedSec * 2.2), 94);

              if (g.timerString !== formattedTimer || g.progress !== calculatedProgress) {
                changed = true;
                return {
                  ...g,
                  timerString: formattedTimer,
                  progress: Math.max(g.progress || 10, calculatedProgress),
                };
              }
            }
          }
          return g;
        });
        return changed ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Helper to get selected active RoboNeo account
  const getActiveRoboneoAccount = () => {
    try {
      const raw = localStorage.getItem('roboneo_accounts');
      if (!raw) return null;
      const accs = JSON.parse(raw);
      if (!Array.isArray(accs) || accs.length === 0) return null;
      return accs.find((a: any) => a.isActive) || accs[0];
    } catch (e) {
      return null;
    }
  };

  // Helper to get selected active RunningHub account
  const getActiveRunningHubAccount = (): ProviderAccount | null => {
    const accounts = getRunningHubAccounts();
    if (accounts.length === 0) return null;
    return accounts.find((a) => a.isActive) || accounts[0];
  };

  // Helper to check if an account API key is currently busy processing a task
  const isRunningHubAccountBusy = (apiKey: string, currentGenerations?: GenerationItem[]): boolean => {
    if (!apiKey) return false;
    const list = currentGenerations || generations;
    const cleanTargetKey = apiKey.trim();
    return list.some(
      (g) =>
        g.status === 'processing' &&
        g.accountKey &&
        (g.accountKey === cleanTargetKey || g.accountKey.replace(/^bearer /i, '').trim() === cleanTargetKey.replace(/^bearer /i, '').trim())
    );
  };

  // Smart Multi-Account Dispatcher for RunningHub:
  // 1. Prioritize user's explicitly selected active account (isActive: true) if free & has sufficient credits.
  // 2. If active account is busy generating, automatically find another FREE account with sufficient credits for instant parallel render!
  // 3. If ALL accounts are busy, mark as isAllBusy: true so it enters the smart queue.
  // 4. NEVER alters isActive in localStorage, keeping user's preferred default account intact.
  const selectRunningHubAccountForTask = async (
    requiredCoins: number = 1
  ): Promise<{
    account: ProviderAccount | null;
    isBusyParallel: boolean;
    isAllBusy: boolean;
    assignedKey: string;
  }> => {
    try {
      const rhAccs = getRunningHubAccounts();
      if (rhAccs.length === 0) {
        return { account: null, isBusyParallel: false, isAllBusy: false, assignedKey: '' };
      }

      // 1. Identify user's chosen active account
      const validAccountsWithCoins = rhAccs.filter((a) => {
        const key = (a.refreshToken || a.accessToken || a.idToken || a.email || '').trim();
        return key.length > 0 && a.accountStatus !== 'error' && (a.credits === undefined || a.credits > 0);
      });

      const userActiveAcc = validAccountsWithCoins.find((a) => a.isActive) ||
        rhAccs.find((a) => a.isActive && (a.credits === undefined || a.credits > 0)) ||
        validAccountsWithCoins[0] ||
        rhAccs[0];

      const activeKey = (userActiveAcc?.refreshToken || userActiveAcc?.accessToken || userActiveAcc?.idToken || userActiveAcc?.email || '').trim();
      const activeIsBusy = activeKey ? isRunningHubAccountBusy(activeKey) : false;
      const activeHasCoins = (userActiveAcc?.credits ?? 1) >= requiredCoins && userActiveAcc?.accountStatus !== 'error';

      // If user's chosen account is FREE and has coins, execute with active account
      if (userActiveAcc && !activeIsBusy && activeHasCoins) {
        return {
          account: userActiveAcc,
          isBusyParallel: false,
          isAllBusy: false,
          assignedKey: activeKey,
        };
      }

      // 2. User's chosen account is busy OR low credits -> search for another FREE account with sufficient coins
      const freeCandidateAccounts = rhAccs.filter((acc) => {
        const key = (acc.refreshToken || acc.accessToken || acc.idToken || acc.email || '').trim();
        if (!key) return false;
        const busy = isRunningHubAccountBusy(key);
        const hasCredits = (acc.credits ?? 1) >= requiredCoins && acc.accountStatus !== 'error';
        return !busy && hasCredits;
      });

      if (freeCandidateAccounts.length > 0) {
        const freeWorkerAcc = freeCandidateAccounts[0];
        const workerKey = (freeWorkerAcc.refreshToken || freeWorkerAcc.accessToken || freeWorkerAcc.idToken || freeWorkerAcc.email || '').trim();
        console.log(
          `[RunningHub ⚡ Smart Dispatcher] Mengalihkan ke akun (${freeWorkerAcc.name || freeWorkerAcc.email}) dengan koin mencukupi.`
        );
        return {
          account: freeWorkerAcc,
          isBusyParallel: true,
          isAllBusy: false,
          assignedKey: workerKey,
        };
      }

      // 3. ALL accounts are currently busy with active generations
      const anyWithCredits = validAccountsWithCoins[0] || rhAccs.find((acc) => (acc.credits ?? 1) >= requiredCoins) || userActiveAcc;
      const fallbackKey = (anyWithCredits?.refreshToken || anyWithCredits?.accessToken || anyWithCredits?.idToken || anyWithCredits?.email || '').trim();
      console.log(`[RunningHub ⏳ All Accounts Busy] Semua akun RunningHub sedang sibuk. Tugas dimasukkan ke antrean.`);
      return {
        account: anyWithCredits,
        isBusyParallel: false,
        isAllBusy: true,
        assignedKey: fallbackKey,
      };
    } catch (e) {
      return { account: null, isBusyParallel: false, isAllBusy: false, assignedKey: '' };
    }
  };

  // Helper to sync credits for RunningHub account after generation finished without modifying isActive state
  const autoSyncRunningHubAccountCredits = async (apiKey?: string) => {
    try {
      const rhAccs = getRunningHubAccounts();
      if (rhAccs.length === 0) return;
      const targetAcc = apiKey
        ? (rhAccs.find((a) => a.refreshToken === apiKey || a.accessToken === apiKey || a.idToken === apiKey) || rhAccs.find((a) => a.isActive) || rhAccs[0])
        : (rhAccs.find((a) => a.isActive) || rhAccs[0]);
      const keyToVerify = (apiKey || targetAcc?.refreshToken || targetAcc?.accessToken || targetAcc?.idToken || targetAcc?.email || '').trim();
      if (!keyToVerify) return;

      const { ok, data } = await safeFetchJson('/api/runninghub/account/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToVerify }),
      });

      if (ok && data && data.success) {
        const updatedAccounts = rhAccs.map((a: any) => {
          const accKey = (a.refreshToken || a.accessToken || a.idToken || a.email || '').trim();
          if (accKey === keyToVerify || a.id === targetAcc?.id) {
            return {
              ...a,
              credits: typeof data.credits === 'number' ? data.credits : a.credits,
              totalCredits: typeof data.totalCredits === 'number' ? data.totalCredits : a.totalCredits,
            };
          }
          return a;
        });
        localStorage.setItem('runninghub_accounts', JSON.stringify(updatedAccounts));
        window.dispatchEvent(new Event('runninghub_accounts_updated'));
        window.dispatchEvent(new Event('accounts-updated'));
        syncProviderAccountsToSheet('runninghub', updatedAccounts);
      }
    } catch (err) {
      console.warn('Auto-sync RunningHub credits notice:', err);
    }
  };

  // Helper to execute RunningHub rendering task and handle polling until finished
  const executeRunningHubTask = async (
    targetItem: GenerationItem,
    assignedAccount: ProviderAccount,
    assignedApiKey: string,
    imgUrl?: string,
    vidUrl?: string,
    promptText?: string
  ) => {
    // Collect all candidate RunningHub account keys for automatic multi-account fallback (prioritizing available coins)
    const allRhAccounts = getRunningHubAccounts();
    const fallbackKeys = allRhAccounts
      .filter((a) => {
        const k = (a.refreshToken || a.accessToken || a.idToken || a.email || '').trim();
        return k && k !== assignedApiKey.trim() && a.accountStatus !== 'error';
      })
      .sort((a, b) => (b.credits ?? 600) - (a.credits ?? 600))
      .map((a) => (a.refreshToken || a.accessToken || a.idToken || a.email || '').trim());

    // 1. Mark generation item as processing with accountKey
    setGenerations((prev) =>
      prev.map((g) =>
        g.id === targetItem.id
          ? {
              ...g,
              status: 'processing',
              accountKey: assignedApiKey,
              errorMessage: undefined,
            }
          : g
      )
    );
    // Keep PromptCard unlocked and available for subsequent tasks
    setGenState('idle');
    setIsSubmittingTask(false);

    // Live timer
    let seconds = 1;
    const timerInterval = setInterval(() => {
      seconds += 1;
      const mins = Math.floor(seconds / 60);
      const remSecs = seconds % 60;
      const formattedTimer = `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
      const calculatedProgress = Math.min(10 + Math.floor(seconds * 2.5), 92);

      setCurrentTimerString(formattedTimer);
      setGenerationProgress(calculatedProgress);

      setGenerations((prev) =>
        prev.map((g) =>
          g.id === targetItem.id
            ? { ...g, progress: calculatedProgress, timerString: formattedTimer }
            : g
        )
      );
    }, 1000);

    try {
      const selectedModel = targetItem.model || settings.videoModel || 'Motion Control';
      const targetWorkflowId = selectedModel === 'MiniMax H3 Turbo Video'
        ? '2098388825144184833'
        : selectedModel === 'S2 Motion Control'
        ? '2091060763809492994'
        : '2088843516532506626';

      const payload = {
        apiKey: assignedApiKey,
        fallbackApiKeys: fallbackKeys,
        image: imgUrl || targetItem.thumbnailUrl || (targetItem.attachedMedia?.[0]?.url),
        video: vidUrl || (targetItem.attachedMedia?.find((m) => m.type === 'video')?.url),
        prompt: promptText || (targetItem.prompt ? targetItem.prompt : undefined),
        workflowId: targetWorkflowId,
        model: selectedModel,
        aspectRatio: targetItem.aspectRatio && targetItem.aspectRatio !== 'Auto' ? targetItem.aspectRatio : settings.videoAspectRatio,
        duration: targetItem.duration && targetItem.duration !== 'Auto' ? targetItem.duration : settings.videoDuration,
        resolution: targetItem.resolution && targetItem.resolution !== 'Auto' ? targetItem.resolution : settings.videoResolution,
      };

      const { ok, data } = await safeFetchJson('/api/runninghub/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // If exhausted accounts detected, update local account cache immediately
      if (Array.isArray(data?.exhaustedApiKeys) && data.exhaustedApiKeys.length > 0) {
        try {
          const raw = localStorage.getItem('runninghub_accounts');
          if (raw) {
            const accs = JSON.parse(raw);
            if (Array.isArray(accs)) {
              let changed = false;
              const updated = accs.map((a: any) => {
                const key = (a.refreshToken || a.accessToken || a.idToken || a.email || '').trim();
                if (data.exhaustedApiKeys.includes(key)) {
                  changed = true;
                  return { ...a, credits: 0, totalCredits: 0, statusMessage: 'Koin habis (0 Coins)', accountStatus: 'error' };
                }
                return a;
              });
              if (changed) {
                localStorage.setItem('runninghub_accounts', JSON.stringify(updated));
                window.dispatchEvent(new Event('runninghub_accounts_updated'));
              }
            }
          }
        } catch (e) {}
      }

      const isQueueMaxed = data?.isQueueMaxed === true || data?.queued === true;
      const serverTaskId = data?.taskId || data?.sessionId;
      const usedApiKey = data?.usedApiKey || assignedApiKey;

      // CASE 1: Queue is maxed or no server taskId returned -> enter queued state safely (NO polling!)
      if (!ok || isQueueMaxed || !serverTaskId) {
        clearInterval(timerInterval);
        setGenState('idle');

        if (isQueueMaxed || (!ok && String(data?.error || '').toUpperCase().includes('QUEUE'))) {
          console.log(`[RunningHub ⏳ Queued] Task ${targetItem.id} masuk antrean (Menunggu slot bebas pada akun RunningHub).`);
          setGenerations((prev) =>
            prev.map((g) =>
              g.id === targetItem.id
                ? {
                    ...g,
                    status: 'queued',
                    accountKey: undefined,
                    errorMessage: 'Antre di RunningHub (Semua akun sedang memproses tugas / antrean penuh)...',
                    queuedData: { payload, imgUrl, vidUrl, promptText },
                  }
                : g
            )
          );
        } else {
          setGenerations((prev) =>
            prev.map((g) =>
              g.id === targetItem.id
                ? {
                    ...g,
                    status: 'failed',
                    errorMessage: data?.error || 'Generasi RunningHub gagal dibuat.',
                    progress: 0,
                  }
                : g
            )
          );
          setGenState('idle');
          autoSyncRunningHubAccountCredits(assignedApiKey);
        }
        return;
      }

      // CASE 2: Real RunningHub taskId received successfully!
      console.log(`[RunningHub 🚀 Task Created] Task ID: ${serverTaskId} (Akun: ${usedApiKey.slice(0, 6)}...)`);
      setCurrentTaskId(serverTaskId);

      setGenerations((prev) =>
        prev.map((g) =>
          g.id === targetItem.id
            ? {
                ...g,
                status: 'processing',
                taskId: serverTaskId,
                accountKey: usedApiKey,
                errorMessage: undefined,
                queuedData: undefined,
              }
            : g
        )
      );

      // Start Polling loop every 4s ONLY because we have a valid serverTaskId
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount += 1;

        if (pollCount > 1800) {
          clearInterval(pollInterval);
          clearInterval(timerInterval);
          setGenerations((prev) =>
            prev.map((g) =>
              g.id === targetItem.id
                ? {
                    ...g,
                    status: 'failed',
                    errorMessage: 'Waktu tunggu generasi habis (2 jam).',
                  }
                : g
            )
          );
          autoSyncRunningHubAccountCredits(usedApiKey);
          return;
        }

        try {
          const { data: pollData } = await safeFetchJson('/api/runninghub/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: usedApiKey,
              taskId: serverTaskId,
            }),
          });

          if (pollCount % 3 === 1 || pollData?.status === 'completed' || pollData?.status === 'SUCCESS' || pollData?.status === 'failed') {
            console.log(`[Client 🔄 RunningHub Polling] Task: ${serverTaskId} | Status: ${pollData?.status || 'processing'}`);
          }

          const resultMediaUrl =
            pollData?.mediaUrl ||
            pollData?.resultUrl ||
            pollData?.videoUrl ||
            (Array.isArray(pollData?.outputs) && pollData.outputs.length > 0
              ? (pollData.outputs[0]?.fileUrl || pollData.outputs[0]?.url || (typeof pollData.outputs[0] === 'string' ? pollData.outputs[0] : ''))
              : '');

          const isCompleted =
            (pollData?.status === 'completed' || pollData?.status === 'SUCCESS' || pollData?.rawStatus === 'SUCCESS') &&
            !!resultMediaUrl;

          if (isCompleted) {
            clearInterval(pollInterval);
            clearInterval(timerInterval);

            setGenerations((prev) =>
              prev.map((g) =>
                g.id === targetItem.id
                  ? {
                      ...g,
                      status: 'completed',
                      mediaUrl: resultMediaUrl,
                      thumbnailUrl: pollData.coverUrl || targetItem.thumbnailUrl || resultMediaUrl || '',
                      progress: 100,
                    }
                  : g
              )
            );
            autoSyncRunningHubAccountCredits(usedApiKey);
          } else if (pollData?.status === 'failed' || pollData?.status === 'FAILED') {
            clearInterval(pollInterval);
            clearInterval(timerInterval);

            setGenerations((prev) =>
              prev.map((g) =>
                g.id === targetItem.id
                  ? {
                      ...g,
                      status: 'failed',
                      errorMessage: pollData.errorMessage || pollData.error || 'Generasi RunningHub gagal.',
                    }
                  : g
              )
            );
            autoSyncRunningHubAccountCredits(usedApiKey);
          }
        } catch (pollErr) {
          console.warn('RunningHub poll error:', pollErr);
        }
      }, 4000);
    } catch (err: any) {
      clearInterval(timerInterval);
      setGenState('failed');
      setGenerations((prev) =>
        prev.map((g) =>
          g.id === targetItem.id
            ? {
                ...g,
                status: 'failed',
                errorMessage: err?.message || 'Gagal terhubung ke RunningHub.',
              }
            : g
        )
      );
      autoSyncRunningHubAccountCredits(assignedApiKey);
    }
  };

  // Auto-Queue Dispatcher for RunningHub:
  // Monitors queued generations and immediately executes them as soon as any account becomes free!
  const isQueueDispatchingRef = React.useRef(false);
  React.useEffect(() => {
    const queueCheckerInterval = setInterval(async () => {
      if (isQueueDispatchingRef.current) return;

      const queuedItem = generations
        .slice()
        .reverse()
        .find((g) => g.status === 'queued' && (g.provider === 'runninghub' || g.model?.includes('Motion Control') || g.model?.includes('RunningHub')));

      if (!queuedItem) return;

      // Check if any RunningHub account is now FREE
      const rhSelection = await selectRunningHubAccountForTask(1);
      if (!rhSelection.account || rhSelection.isAllBusy || !rhSelection.assignedKey) {
        // Still all busy, wait for next cycle
        return;
      }

      // Found a free worker account! Dispatch task immediately!
      isQueueDispatchingRef.current = true;
      try {
        console.log(
          `[RunningHub 🚀 Queue Auto-Runner] Memproses antrean task ${queuedItem.id} dengan akun bebas tugas: ${rhSelection.account.name || rhSelection.account.email}`
        );
        const qData = queuedItem.queuedData || {};
        const imgUrl = qData.imgUrl || queuedItem.thumbnailUrl || queuedItem.attachedMedia?.[0]?.url;
        const vidUrl = qData.vidUrl || queuedItem.attachedMedia?.find((m) => m.type === 'video')?.url;
        const pText = qData.promptText || queuedItem.prompt;

        await executeRunningHubTask(queuedItem, rhSelection.account, rhSelection.assignedKey, imgUrl, vidUrl, pText);
      } finally {
        isQueueDispatchingRef.current = false;
      }
    }, 3000);

    return () => clearInterval(queueCheckerInterval);
  }, [generations]);

  // Trigger real generation flow
  const handleGenerate = async () => {
    if (isSubmittingTask) return;

    const isVideo = settings.mode === 'video';
    const activeProvider = resolveActiveProviderId(settings, activeTab, externalProviderId);
    const isGeminiModel = activeProvider === 'gemini';
    const isFlowModel = activeProvider === 'flow';
    const isVidsModel = activeProvider === 'vids' || settings.videoModel === 'Google Vids Omni';
    const isRunningHubModel = activeProvider === 'runninghub';
    const isGalleri5Model = activeProvider === 'galleri5';
    const isKieModel = activeProvider === 'kie';
    const isRoboneoModel = activeProvider === 'roboneo';
    const isKlingMotion = isVideo && (settings.videoModel === 'Motion Control' || (settings.videoModel as string).includes('Motion Control') || (settings.videoModel as string).toLowerCase().includes('ambmedia') || settings.videoModel === 'RunningHub Video Studio' || settings.videoModel === 'Kling 3.0 Pro Motion Control' || settings.videoModel === 'Kling 2.6 Motion Control' || settings.videoModel === 'Kling 2.6 Motion Control Standar' || settings.videoModel === 'Galleri5 Video Studio');
    const isMiniMax = isVideo && settings.videoModel === 'MiniMax H3 Turbo Video';

    const imgItem = attachedMedia.find((m) => m.type === 'image' || (!m.type && !m.name?.match(/\.(mp4|mov|webm)$/i)) || m.url?.match(/\.(jpg|jpeg|png|webp|gif)/i));
    const vidItem = attachedMedia.find((m) => m.type === 'video' || (!m.type && !!m.name?.match(/\.(mp4|mov|webm)$/i)));

    if (imgItem && imgItem.isUploading) {
      alert('Foto referensi masih dalam proses upload. Silakan tunggu sebentar...');
      return;
    }

    if (!isKlingMotion && !isMiniMax && !isVidsModel && !((isGeminiModel || isFlowModel) && (imgItem || attachedMedia.some((m) => m.type === 'image' || (!m.type && !m.name?.match(/\.(mp4|mov|webm)$/i))))) && !prompt.trim()) return;

    if (isKlingMotion && (!imgItem?.url || !vidItem?.url)) {
      alert(`${getCleanModelName(settings.videoModel)} memerlukan 1 Foto Referensi dan 1 Video Motion Control. Silakan unggah keduanya melalui tombol (+).`);
      return;
    }

    if (isMiniMax && !imgItem?.url && !prompt.trim()) {
      alert('MiniMax H3 Turbo Video memerlukan teks prompt (untuk Text-to-Video) atau foto referensi (untuk Image-to-Video).');
      return;
    }

    if (isVidsModel && !prompt.trim() && !imgItem && !attachedMedia.some((m) => m.type === 'image' || (!m.type && !m.name?.match(/\.(mp4|mov|webm)$/i)))) {
      alert('Google Vids Omni memerlukan teks prompt (Text-to-Video) atau gambar referensi (Image-to-Video).');
      return;
    }

    if ((isGeminiModel || isFlowModel) && !imgItem && !prompt.trim()) {
      alert(`${isFlowModel ? 'Google Flow' : 'Google Gemini'} memerlukan teks prompt (untuk Text-to-Video) atau foto referensi (untuk Image-to-Video).`);
      return;
    }

    const isWeavyKling = !isRoboneoModel && !isKieModel && !isGalleri5Model && !isRunningHubModel && !isGeminiModel && !isFlowModel && !isVidsModel && (isKlingMotion || (isVideo && settings.videoModel.toLowerCase().includes('kling')));
    const requiredCredits = isRunningHubModel || isRoboneoModel || isKieModel || isGalleri5Model || isGeminiModel || isFlowModel || isVidsModel
      ? 1
      : isWeavyKling
      ? 50
      : getWeavyRequiredCredits(isVideo ? settings.videoModel : settings.imageModel, isVideo);

    setIsSubmittingTask(true);

    let activeAcc: any = null;
    let geminiAcc: any = null;
    let geminiLease: GeminiAccountLease | null = null;
    let activeGeminiLease: GeminiAccountLease | null = null;
    const releaseGeminiLease = () => {
      activeGeminiLease?.release();
      activeGeminiLease = null;
      geminiLease = null;
    };
    let flowAcc: any = null;
    let vidsAcc: any = null;
    let roboneoAcc: any = null;
    let kieAcc: any = null;
    let galleri5Acc: any = null;
    let runninghubAcc: any = null;
    let runninghubAssignedKey = '';
    let runninghubIsAllBusy = false;

    if (isGeminiModel) {
      geminiLease = await acquireGeminiAccountLease(1, undefined, {
        onQueued: () => console.info('[Gemini Queue] Semua akun dengan kredit cukup sedang digunakan; menunggu akun tersedia.'),
      });
      activeGeminiLease = geminiLease;
      geminiAcc = geminiLease?.account || null;
      if (!geminiAcc || (!geminiAcc.token && !geminiAcc.refreshToken && !geminiAcc.apiKey && !geminiAcc.cookies)) {
        releaseGeminiLease();
        setIsSubmittingTask(false);
        alert('Tidak ada akun Google Gemini yang terhubung di Settings. Silakan hubungkan akun Google Gemini atau masukkan API Key di tab Settings.');
        setActiveTab('settings');
        return;
      }
      if (typeof geminiAcc.credits === 'number' && geminiAcc.credits <= 0) {
        releaseGeminiLease();
        setIsSubmittingTask(false);
        alert(`Semua akun Google Gemini tersimpan telah mencapai batas kuota (${GEMINI_MAX_CREDITS}/${GEMINI_MAX_CREDITS} kredit pada akun telah habis). Silakan tambahkan akun Google Gemini baru di tab Settings atau gunakan provider Weavy / RunningHub.`);
        return;
      }
    } else if (isFlowModel) {
      const flowAccs = getFlowAccounts();
      flowAcc = flowAccs.find((a) => a.isActive) || flowAccs[0];
      if (!flowAcc || (!flowAcc.token && !flowAcc.cookies)) {
        setIsSubmittingTask(false);
        alert('Tidak ada akun Google Flow yang terhubung di Settings. Silakan tambahkan cURL / sesi akun Google Flow di tab Settings.');
        setActiveTab('settings');
        return;
      }
      if (typeof flowAcc.credits === 'number' && flowAcc.credits <= 0) {
        setIsSubmittingTask(false);
        alert('Akun Google Flow telah mencapai batas kredit harian (3/3 kredit). Silakan coba lagi besok.');
        return;
      }
    } else if (isVidsModel) {
      const vidsAccs = getVidsAccounts();
      vidsAcc = vidsAccs.find((a) => a.isActive) || vidsAccs[0];
      if (!vidsAcc) {
        setIsSubmittingTask(false);
        alert('Tidak ada akun Google Vids yang terhubung di Settings. Silakan tambahkan akun Google Vids di tab Settings.');
        setActiveTab('settings');
        return;
      }
    } else if (isRunningHubModel) {
      const requiredCoins = 1;
      const rhSelection = await selectRunningHubAccountForTask(requiredCoins);
      runninghubAcc = rhSelection.account;
      runninghubAssignedKey = rhSelection.assignedKey;
      runninghubIsAllBusy = rhSelection.isAllBusy;

      if (!runninghubAcc && (!rhSelection.account || !runninghubAssignedKey)) {
        setIsSubmittingTask(false);
        const rhAccs = getRunningHubAccounts();
        if (!rhAccs || rhAccs.length === 0) {
          alert('Tidak ada akun / API Key RunningHub yang terhubung di Settings. Silakan hubungkan akun RunningHub terlebih dahulu.');
        } else {
          alert('Semua akun RunningHub tersimpan tidak memiliki saldo koin/kredit yang cukup. Silakan periksa di tab Settings.');
        }
        setActiveTab('settings');
        return;
      }
    } else if (isGalleri5Model) {
      const requiredGalleri5Credits = 60;
      galleri5Acc = await verifyAndSelectSufficientGalleri5Account(requiredGalleri5Credits);
      if (!galleri5Acc || (!galleri5Acc.refreshToken && !galleri5Acc.idToken && !galleri5Acc.accessToken)) {
        setIsSubmittingTask(false);
        const g5Accs = getGalleri5Accounts();
        if (!g5Accs || g5Accs.length === 0) {
          alert('Tidak ada akun Galleri5 yang terhubung di Settings. Silakan hubungkan akun Galleri5 terlebih dahulu.');
        } else {
          alert(`Semua akun Galleri5 tersimpan tidak memiliki kredit yang cukup (${requiredGalleri5Credits} credits minimal). Silakan sync/tambah akun Galleri5 di tab Settings.`);
        }
        setActiveTab('settings');
        return;
      }
    } else if (isKieModel) {
      let requiredKieCredits = 4;
      if (isVideo) {
        const durSec = parseInt(settings.videoDuration.split(' ')[0], 10) || 5;
        const ratePerSec = settings.videoResolution === '480p' ? 2.4 : 4.5;
        requiredKieCredits = durSec * ratePerSec;
      }

      kieAcc = await verifyAndSelectSufficientKieAccount(requiredKieCredits);
      if (!kieAcc || (!kieAcc.refreshToken && !kieAcc.accessToken)) {
        setIsSubmittingTask(false);
        const kieAccs = getKieAccounts();
        if (!kieAccs || kieAccs.length === 0) {
          alert('Tidak ada akun / API Key Kie.ai yang terhubung di Settings. Silakan tambahkan API Key Kie.ai terlebih dahulu.');
        } else {
          alert(`Semua akun Kie.ai tersimpan tidak memiliki kredit yang cukup (${requiredKieCredits} credits dibutuhkan). Silakan sync atau tambahkan akun Kie.ai di tab Settings.`);
        }
        setActiveTab('settings');
        return;
      }
    } else if (isRoboneoModel) {
      roboneoAcc = getActiveRoboneoAccount();
      if (!roboneoAcc || (!roboneoAcc.refreshToken && !roboneoAcc.idToken && !roboneoAcc.accessToken)) {
        setIsSubmittingTask(false);
        alert('Tidak ada akun RoboNeo yang terhubung di Settings. Silakan hubungkan akun RoboNeo terlebih dahulu.');
        setActiveTab('settings');
        return;
      }
    } else {
      // Verify & Auto-select a Weavy account with sufficient verified credits & fresh token
      activeAcc = await verifyAndSelectSufficientAccount(requiredCredits);
      if (!activeAcc || (!activeAcc.refreshToken && !activeAcc.idToken)) {
        setIsSubmittingTask(false);
        alert(`Semua akun tersimpan tidak memiliki kuota kredit yang cukup (${requiredCredits} credits minimal untuk model ini). Silakan sync/tambah akun Weavy di tab Settings.`);
        setActiveTab('settings');
        return;
      }
    }

    const newTaskId = `task_${Math.random().toString(36).substring(2, 10)}`;
    setCurrentTaskId(newTaskId);
    setCurrentTimerString('00:01');
    setGenerationProgress(10);

    const cleanPrompt = prompt.trim();
    let defaultMotionTitle = 'Ambmedia Motion Control';
    if (settings.videoModel === 'S2 Motion Control') {
      defaultMotionTitle = 'Ambmedia S2 Motion Control';
    } else if (settings.videoModel === 'Kling 2.6 Motion Control') {
      defaultMotionTitle = 'RoboNeo Kling 2.6 Motion Control';
    } else if (settings.videoModel === 'Kling 2.6 Motion Control Standar' || settings.videoModel === 'Galleri5 Video Studio') {
      defaultMotionTitle = 'Galleri5 Motion Control';
    } else if (settings.videoModel === 'Kling 3.0 Pro Motion Control') {
      defaultMotionTitle = 'Kling 3.0 Pro Motion Control';
    } else if (isGeminiModel) {
      defaultMotionTitle = isVideo ? (imgItem ? 'Gemini Image to Video' : 'Google Gemini Video') : 'Google Gemini Image';
    } else if (isVidsModel) {
      defaultMotionTitle = isVideo && (imgItem || attachedMedia.some((m) => m.type === 'image' || (!m.type && !m.name?.match(/\.(mp4|mov|webm)$/i)))) ? 'Google Vids Image to Video' : 'Google Vids Omni';
    } else if (isRunningHubModel) {
      defaultMotionTitle = settings.videoModel === 'MiniMax H3 Turbo Video'
        ? 'MiniMax H3 Turbo Video'
        : settings.videoModel?.includes('S2')
        ? 'Ambmedia S2 Motion Control'
        : 'Ambmedia Motion Control';
    }

    const derivedTitle = cleanPrompt.length > 0
      ? (cleanPrompt.length > 28 ? `${cleanPrompt.slice(0, 28)}...` : cleanPrompt)
      : (isKlingMotion || isMiniMax || isGeminiModel || isVidsModel ? defaultMotionTitle : 'Untitled Generation');

    const refImage =
      imgItem?.previewUrl ||
      (imgItem?.url && !imgItem.url.startsWith('api/') ? imgItem.url : null) ||
      attachedMedia[0]?.previewUrl ||
      (attachedMedia[0]?.url && !attachedMedia[0].url.startsWith('api/') ? attachedMedia[0].url : null) ||
      imgItem?.url ||
      attachedMedia[0]?.url ||
      '';

    const currentProv = isRunningHubModel
      ? { id: 'runninghub', name: 'RunningHub' }
      : isGeminiModel
      ? { id: 'gemini', name: 'Google Gemini' }
      : isFlowModel
      ? { id: 'flow', name: 'Google Flow' }
      : isVidsModel
      ? { id: 'vids', name: 'Google Vids' }
      : isGalleri5Model
      ? { id: 'galleri5', name: 'Galleri5' }
      : isKieModel
      ? { id: 'kie', name: 'Kie.ai' }
      : isRoboneoModel
      ? { id: 'roboneo', name: 'RoboNeo' }
      : { id: 'weavy', name: 'Weavy' };

    // Dedicated Handler for RunningHub: Instant parallel worker dispatch or smart auto-queueing
    if (isRunningHubModel) {
      const nowMs = Date.now();
      const runningHubItem: GenerationItem = {
        id: `gen-${nowMs}`,
        mode: settings.mode,
        title: derivedTitle,
        prompt: getCleanPrompt(cleanPrompt, isVideo ? settings.videoModel : settings.imageModel),
        createdAt: 'Barusan',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        aspectRatio: settings.videoModel === 'MiniMax H3 Turbo Video' ? settings.videoAspectRatio : 'Auto',
        resolution: settings.videoModel === 'MiniMax H3 Turbo Video' ? settings.videoResolution : 'Auto',
        duration: settings.videoModel === 'MiniMax H3 Turbo Video' ? settings.videoDuration : 'Auto',
        model: settings.videoModel,
        provider: 'runninghub',
        providerName: 'RunningHub',
        attachedMedia: [...attachedMedia],
        thumbnailUrl: refImage || '',
        mediaUrl: '',
        isFavorite: false,
        status: runninghubIsAllBusy ? 'queued' : 'processing',
        accountKey: runninghubIsAllBusy ? undefined : runninghubAssignedKey,
        taskId: newTaskId,
        progress: 10,
        timerString: '00:01',
        startedAt: nowMs,
        createdAtTimestamp: nowMs,
        errorMessage: runninghubIsAllBusy ? 'Semua akun sibuk (Antre otomatis)...' : undefined,
        queuedData: {
          imgUrl: imgItem?.url,
          vidUrl: vidItem?.url,
          promptText: cleanPrompt,
          aspectRatio: settings.videoAspectRatio,
          resolution: settings.videoResolution,
          duration: settings.videoDuration,
        },
      };

      setGenerations((prev) => [runningHubItem, ...prev]);

      // Clean inputs
      setIsSubmittingTask(false);
      setPrompt('');
      setAttachedMedia([]);

      if (!runninghubIsAllBusy && runninghubAcc && runninghubAssignedKey) {
        executeRunningHubTask(
          runningHubItem,
          runninghubAcc,
          runninghubAssignedKey,
          imgItem?.url,
          vidItem?.url,
          cleanPrompt
        );
      } else {
        setGenState('idle');
      }
      return;
    }

    const nowMs = Date.now();
    const activeItem: GenerationItem = {
      id: `gen-${nowMs}`,
      mode: settings.mode,
      title: derivedTitle,
      prompt: getCleanPrompt(cleanPrompt, isVideo ? settings.videoModel : settings.imageModel),
      createdAt: 'Barusan',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      aspectRatio: isKlingMotion ? 'Auto' : (isVideo ? settings.videoAspectRatio.split(' ')[0] : settings.imageAspectRatio.split(' ')[0]),
      resolution: isKlingMotion ? 'Auto' : (isVideo ? settings.videoResolution : settings.imageResolution),
      duration: isKlingMotion ? 'Auto' : (isVideo ? `00:${settings.videoDuration.split(' ')[0].padStart(2, '0')}` : undefined),
      model: isVideo ? settings.videoModel : settings.imageModel,
      provider: currentProv.id,
      providerName: currentProv.name,
      attachedMedia: [...attachedMedia],
      thumbnailUrl: refImage || '',
      mediaUrl: '',
      isFavorite: false,
      status: 'processing',
      taskId: newTaskId,
      accountKey: isGeminiModel ? (geminiAcc?.id || geminiAcc?.email) : undefined,
      progress: 10,
      timerString: '00:01',
      startedAt: nowMs,
      createdAtTimestamp: nowMs,
    };

    setGenerations((prev) => [activeItem, ...prev]);

    // Clean inputs & unlock Prompt Card immediately so user can type the next prompt without waiting
    setIsSubmittingTask(false);
    setGenState('idle');
    setPrompt('');
    setAttachedMedia([]);

    // Live Timer tick
    let seconds = 1;
    const timerInterval = setInterval(() => {
      seconds += 1;
      const mins = Math.floor(seconds / 60);
      const remSecs = seconds % 60;
      const formattedTimer = `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
      setCurrentTimerString(formattedTimer);

      const calculatedProgress = Math.min(10 + Math.floor(seconds * 2.5), 92);
      setGenerationProgress(calculatedProgress);

      setGenerations((prev) =>
        prev.map((g) =>
          g.id === activeItem.id
            ? { ...g, progress: calculatedProgress, timerString: formattedTimer }
            : g
        )
      );
    }, 1000);

    try {
      const isVideoMode = settings.mode === 'video';
      const activeModel = isVideoMode ? settings.videoModel : settings.imageModel;
      const activeAspectRatio = isVideoMode ? settings.videoAspectRatio : settings.imageAspectRatio;
      const activeResolution = isVideoMode ? settings.videoResolution : settings.imageResolution;

      const endpoint = isGeminiModel
        ? (isVideoMode ? '/api/gemini/generate-video' : '/api/gemini/generate-image')
        : isFlowModel
        ? '/api/flow/generate-video'
        : isVidsModel
        ? '/api/vids/generate-video'
        : isRunningHubModel
        ? '/api/runninghub/generate'
        : isGalleri5Model
        ? '/api/galleri5/generate'
        : isKieModel
        ? '/api/generate-kie'
        : isRoboneoModel
        ? '/api/generate-roboneo'
        : '/api/generate-weavy';

      const selectedModel = settings.videoModel || 'Motion Control';
      const targetWorkflowId = selectedModel === 'MiniMax H3 Turbo Video'
        ? '2098388825144184833'
        : selectedModel === 'S2 Motion Control'
        ? '2091060763809492994'
        : '2088843516532506626';

      const imgItems = attachedMedia.filter((m) => m.type === 'image' || (!m.type && !m.name?.match(/\.(mp4|mov|webm)$/i)));
      const vidItems = attachedMedia.filter((m) => m.type === 'video' || m.name?.match(/\.(mp4|mov|webm)$/i));
      const refImages = imgItems.slice(0, 5);
      const refVideo = vidItems[0];

      const targetImgItem = imgItem || refImages[0] || attachedMedia.find((m) => m.type === 'image' || (!m.type && !m.name?.match(/\.(mp4|mov|webm)$/i)));
      let resolvedRefImageData: string | undefined = undefined;
      if (targetImgItem) {
        if (targetImgItem.fileObject) {
          try {
            resolvedRefImageData = await readFileAsBase64(targetImgItem.fileObject);
          } catch (e) {}
        } else if (targetImgItem.url && targetImgItem.url.startsWith('data:')) {
          resolvedRefImageData = targetImgItem.url;
        } else if (targetImgItem.url && targetImgItem.url.startsWith('blob:')) {
          try {
            const resp = await fetch(targetImgItem.url);
            const blob = await resp.blob();
            resolvedRefImageData = await readFileAsBase64(new File([blob], targetImgItem.name || 'image.png', { type: blob.type || 'image/png' }));
          } catch (e) {}
        } else if (targetImgItem.url) {
          resolvedRefImageData = targetImgItem.url;
        }
      }

      const payload = isGeminiModel
        ? {
            prompt: cleanPrompt,
            aspectRatio: isVideo ? settings.videoAspectRatio.split(' ')[0] : settings.imageAspectRatio.split(' ')[0],
            duration: isVideo ? settings.videoDuration.split(' ')[0] : undefined,
            resolution: isVideo ? settings.videoResolution : undefined,
            model: isVideo ? settings.videoModel : settings.imageModel,
            id: geminiAcc?.id,
            email: geminiAcc?.email,
            name: geminiAcc?.displayName || geminiAcc?.name || geminiAcc?.email,
            token: geminiAcc?.token || geminiAcc?.refreshToken || geminiAcc?.apiKey || geminiAcc?.idToken,
            apiKey: geminiAcc?.apiKey,
            cookies: geminiAcc?.cookies || (/(?:__Secure-1PSID|(?:^|;\s*)SID=|(?:^|;\s*)SAPISID=)/i.test(geminiAcc?.token || '') ? geminiAcc.token : undefined),
            referenceImageUrl: targetImgItem?.url || refImages[0]?.url || attachedMedia[0]?.url,
            referenceImageData: resolvedRefImageData || targetImgItem?.url || refImages[0]?.url,
            referenceImageUrls: refImages.map((m) => m.url).filter(Boolean),
            referenceVideoUrl: refVideo?.url,
            referenceVideoUrls: refVideo?.url ? [refVideo.url] : [],
            attachedMedia: attachedMedia.slice(0, 6),
            fallbackAccounts: [],
          }
        : isFlowModel
        ? {
            prompt: cleanPrompt,
            aspectRatio: isVideo ? settings.videoAspectRatio.split(' ')[0] : '16:9',
            duration: isVideo ? settings.videoDuration.split(' ')[0] : '10s',
            resolution: isVideo ? settings.videoResolution : '1080p',
            model: 'Google Flow Video (10s)',
            id: flowAcc?.id,
            email: flowAcc?.email,
            name: flowAcc?.displayName || flowAcc?.name || flowAcc?.email,
            token: flowAcc?.token || flowAcc?.cookies,
            cookies: flowAcc?.cookies || flowAcc?.token,
            authHeader: flowAcc?.authHeader,
            apiKey: flowAcc?.apiKey,
            referenceImageUrl: targetImgItem?.url || refImages[0]?.url || attachedMedia[0]?.url,
            referenceImageData: resolvedRefImageData || targetImgItem?.url || refImages[0]?.url,
          }
        : isVidsModel
        ? {
            prompt: cleanPrompt,
            aspectRatio: isVideo ? settings.videoAspectRatio : '9:16 (Vertical)',
            duration: Math.min(15, Math.max(3, Number.parseInt(settings.videoDuration, 10) || 10)),
            resolution: settings.videoResolution,
            email: vidsAcc?.email,
            cookies: vidsAcc?.cookies || vidsAcc?.token,
            docId: vidsAcc?.docId || vidsAcc?.flixDocId,
            flixDocId: vidsAcc?.flixDocId || vidsAcc?.docId,
            serverToken: vidsAcc?.serverToken,
            referenceImageUrl: targetImgItem?.url || refImages[0]?.url || attachedMedia[0]?.url,
            referenceImageData: resolvedRefImageData || targetImgItem?.url || refImages[0]?.url,
          }
        : isRunningHubModel
        ? {
            apiKey: runninghubAcc?.refreshToken || runninghubAcc?.accessToken || runninghubAcc?.idToken || runninghubAcc?.email,
            image: imgItem?.url,
            video: vidItem?.url,
            prompt: cleanPrompt || undefined,
            workflowId: targetWorkflowId,
            model: selectedModel,
            aspectRatio: settings.videoAspectRatio,
            duration: settings.videoDuration,
            resolution: settings.videoResolution,
          }
        : isGalleri5Model
        ? {
            accessToken: galleri5Acc.refreshToken || galleri5Acc.accessToken || galleri5Acc.idToken,
            imageUrl: imgItem?.url,
            videoUrl: vidItem?.url,
            prompt: cleanPrompt || undefined,
            keepOriginalSound: true,
            characterOrientation: 'video',
            safetyTolerance: 5,
            modelPath: 'fal-ai/kling-video-v2.6-standard-motion-control',
          }
        : isKieModel
        ? {
            apiKey: kieAcc.refreshToken || kieAcc.accessToken,
            prompt: cleanPrompt,
            mode: settings.mode,
            model: isVideo ? settings.videoModel : settings.imageModel,
            videoAspectRatio: settings.videoAspectRatio,
            imageAspectRatio: settings.imageAspectRatio,
            videoDuration: settings.videoModel === 'SeeDance 2.0 Mini' && vidItem?.durationSeconds
              ? `${Math.min(15, Math.max(3, Math.round(vidItem.durationSeconds)))} seconds`
              : settings.videoDuration,
            videoResolution: settings.videoResolution,
            imageResolution: settings.imageResolution,
            enableAudio: settings.enableAudio,
            imageUrls: Array.from(new Set(attachedMedia.filter((m) => m.type === 'image' || !m.type).map((m) => m.url).filter(Boolean))),
            videoUrls: Array.from(new Set(attachedMedia.filter((m) => m.type === 'video').map((m) => m.url).filter(Boolean))),
            videoUrl: vidItem?.url,
            attachedMedia: attachedMedia,
          }
        : isRoboneoModel
        ? {
            accessToken: roboneoAcc.refreshToken || roboneoAcc.accessToken || roboneoAcc.idToken,
            imageUrl: imgItem?.url,
            motionVideoUrl: vidItem?.url,
            prompt: cleanPrompt || 'Refer to the movements and facial expressions in the reference video to animate photos without changing the original background.',
          }
        : {
            refreshToken: activeAcc.refreshToken,
            idToken: activeAcc.idToken,
            mode: settings.mode,
            prompt: cleanPrompt,
            model: activeModel,
            videoModel: settings.videoModel,
            imageModel: settings.imageModel,
            aspect_ratio: activeAspectRatio,
            resolution: activeResolution,
            duration: settings.videoDuration,
            generate_audio: settings.enableAudio,
            image_url: imgItem?.url || (attachedMedia.length > 0 ? attachedMedia[0].url : undefined),
            video_url: vidItem?.url || (attachedMedia.length > 1 ? attachedMedia[1].url : undefined),
            attached_media: attachedMedia,
          };

      let genResponseOk = false;
      let genResponseData: any = null;

      const isWeavyModel = !isGeminiModel && !isFlowModel && !isVidsModel && !isRunningHubModel && !isGalleri5Model && !isKieModel && !isRoboneoModel;

      // 1. Eksekusi Weavy langsung via Chrome Extension Bridge jika terhubung (100% Bebas 403 & Cloudflare WAF)
      if (isWeavyModel && extensionBridge.getStatus().isConnected && activeAcc) {
        try {
          console.log('[App 🚀] Menjalankan generasi Weavy langsung via Chrome Extension Bridge...');
          const bridgeGenResult = await extensionBridge.generateWeavy({
            ...payload,
            idToken: activeAcc.idToken,
            refreshToken: activeAcc.refreshToken,
          });
          if (bridgeGenResult && bridgeGenResult.success) {
            genResponseOk = true;
            genResponseData = bridgeGenResult;
          }
        } catch (bErr) {
          console.warn('[App] Extension Bridge direct generation error:', bErr);
        }
      }

      // 2. Fallback atau provider lain via server
      if (!genResponseOk) {
        const { ok, data } = await safeFetchJson(
          endpoint,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
          (isGeminiModel || isFlowModel || isVidsModel) ? 0 : 2
        );
        genResponseOk = ok;
        genResponseData = data;
      }

      const initialWeavyError = [
        genResponseData?.code,
        genResponseData?.errorCode,
        genResponseData?.status,
        genResponseData?.statusCode,
        genResponseData?.errorMessage,
        genResponseData?.error,
        genResponseData?.message,
        genResponseData?.text,
      ]
        .filter(Boolean)
        .join(' ');
      const isExplicitWeavyAuthFailure =
        isWeavyModel &&
        /401|403|forbidden|auth_invalid|unauthorized|invalid[_\s-]*token|token[_\s-]*(expired|invalid)|expired[_\s-]*token/i.test(initialWeavyError);
      const initialWeavyResultFailed =
        !genResponseOk || !genResponseData?.success ||
        (isVideoMode && !(
          genResponseData?.videoUrl ||
          genResponseData?.imageUrl ||
          genResponseData?.mediaUrl ||
          genResponseData?.operationName ||
          genResponseData?.taskId ||
          genResponseData?.recipeId
        ));

      if (isExplicitWeavyAuthFailure && initialWeavyResultFailed && activeAcc?.email) {
        try {
          const imported = await autoImportWeavyAccountForEmail(activeAcc.email);
          const refreshedActiveAccount = {
            ...activeAcc,
            email: imported.email || activeAcc.email,
            name: imported.name || activeAcc.name,
            displayName: imported.displayName || imported.name || activeAcc.displayName,
            refreshToken: imported.refreshToken || activeAcc.refreshToken,
            idToken: imported.idToken || activeAcc.idToken,
            credits: typeof imported.credits === 'number' ? imported.credits : activeAcc.credits,
            totalCredits: typeof imported.totalCredits === 'number' ? imported.totalCredits : activeAcc.totalCredits,
          };

          const storedAccounts = getWeavyAccounts();
          const matchingIndex = storedAccounts.findIndex(
            (account) => account.email?.trim().toLowerCase() === activeAcc.email.trim().toLowerCase()
          );
          if (matchingIndex < 0) {
            throw new Error(`Akun ${activeAcc.email} tidak ditemukan di daftar akun tersimpan.`);
          }

          const refreshedAccounts = storedAccounts.map((account, index) => ({
            ...account,
            ...(index === matchingIndex ? refreshedActiveAccount : {}),
            isActive: index === matchingIndex,
          }));
          activeAcc = refreshedActiveAccount;
          localStorage.setItem('weavy_accounts', JSON.stringify(refreshedAccounts));
          window.dispatchEvent(new Event('weavy_accounts_updated'));
          window.dispatchEvent(new Event('accounts-updated'));
          syncProviderAccountsToSheet('weavy', refreshedAccounts);

          const retryPayload = {
            ...payload,
            refreshToken: refreshedActiveAccount.refreshToken,
            idToken: refreshedActiveAccount.idToken,
          };
          let retrySucceeded = false;
          let retryData: any = null;

          if (extensionBridge.getStatus().isConnected) {
            try {
              const bridgeRetry = await extensionBridge.generateWeavy(retryPayload);
              if (bridgeRetry?.success) {
                retrySucceeded = true;
                retryData = bridgeRetry;
              } else {
                retryData = bridgeRetry;
              }
            } catch (retryError) {
              console.warn('[App] Weavy extension retry after Auto-Import failed:', retryError);
            }
          }

          if (!retrySucceeded) {
            const retryResponse = await safeFetchJson(
              endpoint,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(retryPayload),
              },
              0
            );
            retrySucceeded = retryResponse.ok;
            retryData = retryResponse.data;
          }

          genResponseOk = retrySucceeded;
          genResponseData = retryData;
        } catch (recoveryError) {
          console.warn('[App] Weavy Auto-Import recovery was not used:', recoveryError);
        }
      }

      const hasValidMediaOrTask = Boolean(
        genResponseData?.videoUrl ||
        genResponseData?.imageUrl ||
        genResponseData?.mediaUrl ||
        genResponseData?.operationName ||
        genResponseData?.taskId ||
        genResponseData?.recipeId
      );

      if (!genResponseOk || !genResponseData || !genResponseData.success || (!hasValidMediaOrTask && isVideoMode)) {
        // Fail Fast
        clearInterval(timerInterval);
        setIsSubmittingTask(false);
        setGenState('idle');
        const errMessage =
          genResponseData?.errorMessage ||
          genResponseData?.error ||
          genResponseData?.text ||
          `Generasi ${isGeminiModel ? 'Google Gemini' : isFlowModel ? 'Google Flow' : isVidsModel ? 'Google Vids' : isRunningHubModel ? 'RunningHub' : isGalleri5Model ? 'Galleri5' : isKieModel ? 'Kie.ai' : isRoboneoModel ? 'Kling Motion Control RoboNeo' : 'Weavy'} gagal (respons bukan hasil video generate).`;
        setGenerations((prev) =>
          prev.map((g) =>
            g.id === activeItem.id
              ? {
                  ...g,
                  status: 'failed',
                  errorMessage: errMessage,
                  progress: 0,
                }
              : g
          )
        );
        if (isGeminiModel) {
          handleGeminiExhaustedAccounts(genResponseData, errMessage, geminiAcc);
        } else if (isVidsModel) {
          await autoSyncVidsAccountCredits(vidsAcc?.email);
        } else if (isRunningHubModel) {
          autoSyncRunningHubAccountCredits(runninghubAcc?.refreshToken || runninghubAcc?.accessToken || runninghubAcc?.idToken || runninghubAcc?.email);
        } else if (isKieModel) {
          autoSyncKieAccountCredits(kieAcc?.refreshToken || kieAcc?.accessToken);
        } else if (isGalleri5Model) {
          autoSyncGalleri5AccountCredits(galleri5Acc?.refreshToken || galleri5Acc?.accessToken || galleri5Acc?.idToken);
        } else if (!isRoboneoModel && !isGeminiModel && !isFlowModel && !isVidsModel) {
          autoSyncActiveAccountCredits();
        }
        releaseGeminiLease();
        return;
      }

      const data = genResponseData;
      const dataFinal = genResponseData;

      // Gemini auto-switch & credit sync handling
      if (isGeminiModel) {
        handleGeminiExhaustedAccounts(data, '', geminiAcc);

        if (data.wasSwitched && data.usedAccount) {
          const allGem = getGeminiAccounts();
          const targetId = data.usedAccount.id;
          const targetEmail = data.usedAccount.email;
          const updated = allGem.map((a: any) => ({
            ...a,
            isActive: (targetId && a.id === targetId) || (targetEmail && a.email && a.email.toLowerCase() === targetEmail.toLowerCase()),
          }));
          localStorage.setItem('gemini_accounts', JSON.stringify(updated));
          window.dispatchEvent(new Event('gemini_accounts_updated'));
          window.dispatchEvent(new Event('accounts-updated'));
          syncProviderAccountsToSheet('gemini', updated);
        }

        const targetAcc = (data.wasSwitched && data.usedAccount) ? data.usedAccount : geminiAcc;
        if (targetAcc && typeof data.remainingCredits === 'number') {
          autoSyncGeminiAccountCredits(targetAcc, data.remainingCredits);
        }
      }

      if (isGeminiModel || isGalleri5Model || isFlowModel || isVidsModel) {
        const directMediaUrl = data.videoUrl || data.imageUrl || data.mediaUrl || data.resultUrl;
        if (directMediaUrl) {
          if (isGalleri5Model) {
            autoSyncGalleri5AccountCredits(galleri5Acc?.refreshToken || galleri5Acc?.accessToken || galleri5Acc?.idToken);
          } else if (isVidsModel) {
            await autoSyncVidsAccountCredits(vidsAcc?.email);
          }
          clearInterval(timerInterval);

          setGenerations((prev) =>
            prev.map((g) =>
              g.id === activeItem.id
                ? {
                    ...g,
                    status: 'completed',
                    mediaUrl: directMediaUrl,
                    thumbnailUrl: data.coverUrl || imgItem?.url || directMediaUrl,
                    progress: 100,
                  }
                : g
            )
          );
          releaseGeminiLease();
          return;
        }
      }

      if (isGeminiModel && isVideoMode) {
        setIsSubmittingTask(false);
        setGenState('idle');
        setPrompt('');
        setAttachedMedia([]);

        const activeGeminiAccount = dataFinal.usedAccount
          ? { ...geminiAcc, ...dataFinal.usedAccount }
          : geminiAcc;
        const operationName = dataFinal.operationName || dataFinal.taskId;
        setCurrentTaskId(operationName || null);
        setGenerations((prev) =>
          prev.map((g) =>
            g.id === activeItem.id
              ? { ...g, status: 'processing', taskId: operationName || g.taskId }
              : g
          )
        );

        void executeGeminiVideoWithAutoSwitchAndRetry({
          prompt: cleanPrompt,
          aspectRatio: settings.videoAspectRatio.split(' ')[0],
          duration: settings.videoDuration.split(' ')[0],
          resolution: settings.videoResolution,
          model: settings.videoModel,
          referenceImageUrls: refImages.map((media) => media.url).filter(Boolean),
          referenceVideoUrls: refVideo?.url ? [refVideo.url] : [],
          attachedMedia: attachedMedia
            .filter((media) => media.url)
            .slice(0, 6)
            .map((media) => ({ type: media.type, url: media.url })),
          accountPayload: {
            ...buildGeminiPayloadAccounts(activeGeminiAccount),
            fallbackAccounts: [],
          },
          initialResponseData: dataFinal,
          onProgress: (progress, message) => {
            setGenerations((prev) =>
              prev.map((g) =>
                g.id === activeItem.id
                  ? { ...g, status: 'processing', progress, errorMessage: message }
                  : g
              )
            );
          },
          onAccountSwitch: (account) => {
            setGenerations((prev) =>
              prev.map((g) =>
                g.id === activeItem.id
                  ? { ...g, accountKey: account.id || account.email }
                  : g
              )
            );
          },
        })
          .then(({ videoUrl }) => {
            clearInterval(timerInterval);
            releaseGeminiLease();
            setGenerations((prev) =>
              prev.map((g) =>
                g.id === activeItem.id
                  ? {
                      ...g,
                      status: 'completed',
                      mediaUrl: videoUrl,
                      thumbnailUrl: imgItem?.url || g.thumbnailUrl || videoUrl,
                      progress: 100,
                      errorMessage: undefined,
                    }
                  : g
              )
            );
          })
          .catch((error: unknown) => {
            clearInterval(timerInterval);
            releaseGeminiLease();
            const errorMessage = error instanceof Error ? error.message : String(error);
            setGenerations((prev) =>
              prev.map((g) =>
                g.id === activeItem.id
                  ? { ...g, status: 'failed', errorMessage, progress: 0 }
                  : g
              )
            );
          });
        return;
      }

      // UNLOCK Prompt Card immediately so user can generate subsequent videos without waiting!
      setIsSubmittingTask(false);
      setGenState('idle');
      setPrompt('');
      setAttachedMedia([]);

      const recipeId = dataFinal.recipeId || dataFinal.sessionId;
      const nodeId = dataFinal.nodeId;
      let serverTaskId = dataFinal.taskId || dataFinal.batchId || dataFinal.sessionId;
      const predictionId = dataFinal.predictionId;
      const isInitialQueued = isRunningHubModel && (dataFinal.queued === true || dataFinal.isQueueMaxed === true || !serverTaskId);

      if (serverTaskId) {
        setCurrentTaskId(serverTaskId);
      }

      setGenerations((prev) =>
        prev.map((g) =>
          g.id === activeItem.id
            ? {
                ...g,
                status: isInitialQueued ? 'queued' : 'processing',
                recipeId,
                nodeId,
                taskId: serverTaskId || g.taskId,
                errorMessage: isInitialQueued ? 'Antre di RunningHub (Auto-Retrying)...' : undefined,
              }
            : g
        )
      );

      // Start Polling loop every 4 seconds until video completes or fails
      let pollCount = 0;
      let activeGeminiAccount: any = dataFinal.usedAccount
        ? { ...geminiAcc, ...dataFinal.usedAccount }
        : geminiAcc;
      let activeGeminiOperationName = dataFinal.operationName || serverTaskId;
      let activeGeminiTaskStartedAt = Date.now();
      let activeGeminiDeadline = activeGeminiTaskStartedAt + 9 * 60 * 1000;
      const attemptedGeminiAccountKeys = new Set<string>();
      const addAttemptedGeminiAccount = (account: any) => {
        if (account?.id) attemptedGeminiAccountKeys.add(`id:${String(account.id).toLowerCase()}`);
        if (account?.email) attemptedGeminiAccountKeys.add(`email:${String(account.email).toLowerCase()}`);
      };
      const hasAttemptedGeminiAccount = (account: any) =>
        Boolean(
          (account?.id && attemptedGeminiAccountKeys.has(`id:${String(account.id).toLowerCase()}`)) ||
          (account?.email && attemptedGeminiAccountKeys.has(`email:${String(account.email).toLowerCase()}`))
        );
      addAttemptedGeminiAccount(activeGeminiAccount);
      for (const exhausted of dataFinal.exhaustedAccounts || []) addAttemptedGeminiAccount(exhausted);
      let geminiFailoverInProgress = false;
      let geminiPollInProgress = false;
      const pollEndpoint = isGeminiModel
        ? '/api/gemini/video-status'
        : isFlowModel
        ? '/api/flow/video-status'
        : isRunningHubModel
        ? '/api/runninghub/status'
        : isGalleri5Model
        ? '/api/poll-galleri5-status'
        : isKieModel
        ? '/api/poll-kie-status'
        : isRoboneoModel
        ? '/api/poll-roboneo-status'
        : '/api/poll-weavy-status';

      const pollInterval = setInterval(async () => {
        if (isGeminiModel && (geminiFailoverInProgress || geminiPollInProgress)) return;
        pollCount += 1;

        // If RunningHub task was queued due to TASK_QUEUE_MAXED, auto-retry task submission until slot is freed
        if (isRunningHubModel && !serverTaskId) {
          try {
            console.log(`[Client ⏳ RunningHub Auto-Queue Dispatcher] Mencoba mengirim task ke antrian RunningHub (Percobaan #${pollCount})...`);
            const retryPayload = {
              apiKey: runninghubAcc?.refreshToken || runninghubAcc?.accessToken || runninghubAcc?.idToken || runninghubAcc?.email,
              image: data.uploadedImage || imgItem?.url,
              video: data.uploadedVideo || vidItem?.url,
              prompt: cleanPrompt || undefined,
              workflowId: targetWorkflowId,
              model: selectedModel,
            };
            const retryRes = await safeFetchJson('/api/runninghub/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(retryPayload),
            });

            if (retryRes.ok && retryRes.data?.success && retryRes.data?.taskId) {
              serverTaskId = retryRes.data.taskId;
              setCurrentTaskId(serverTaskId);
              console.log(`[Client 🚀 RunningHub Task Accepted!] TaskId didapatkan: ${serverTaskId}. Memulai polling render...`);
              setGenerations((prev) =>
                prev.map((g) =>
                  g.id === activeItem.id
                    ? {
                        ...g,
                        status: 'processing',
                        taskId: serverTaskId,
                        errorMessage: undefined,
                      }
                    : g
                )
              );
            }
          } catch (qErr) {
            console.warn('Notice retrying queued RunningHub task:', qErr);
          }
          return;
        }

        if ((isGeminiModel && Date.now() >= activeGeminiDeadline) || (!isGeminiModel && pollCount > 1800)) {
          clearInterval(pollInterval);
          clearInterval(timerInterval);
          releaseGeminiLease();
          setGenerations((prev) =>
            prev.map((g) =>
              g.id === activeItem.id
                ? {
                    ...g,
                    status: 'failed',
                    errorMessage: isGeminiModel
                      ? 'Gemini belum mengembalikan hasil final setelah 9 menit. Periksa riwayat Gemini sebelum mencoba ulang.'
                      : 'Waktu tunggu generasi habis (2 jam). Silakan periksa histori di Settings.',
                  }
                : g
            )
          );
          if (isGeminiModel && activeGeminiAccount) {
            autoSyncGeminiAccountCredits(activeGeminiAccount);
          } else if (isRunningHubModel) {
            autoSyncRunningHubAccountCredits(runninghubAcc?.refreshToken || runninghubAcc?.accessToken || runninghubAcc?.idToken || runninghubAcc?.email);
          } else if (isKieModel) {
            autoSyncKieAccountCredits(kieAcc?.refreshToken || kieAcc?.accessToken);
          } else if (isGalleri5Model) {
            autoSyncGalleri5AccountCredits(galleri5Acc?.refreshToken || galleri5Acc?.accessToken || galleri5Acc?.idToken);
          } else if (!isRoboneoModel) {
            autoSyncActiveAccountCredits();
          }
          return;
        }

        const isWeavyModel = !isGeminiModel && !isRunningHubModel && !isGalleri5Model && !isKieModel && !isRoboneoModel;

        // 1. Polling Weavy langsung via Chrome Extension Bridge (100% Bebas 403 & WAF)
        if (isWeavyModel && extensionBridge.getStatus().isConnected && recipeId && serverTaskId) {
          try {
            const bridgeMediaUrl = await extensionBridge.pollWeavyStatus({
              recipeId,
              taskId: serverTaskId,
              batchId: serverTaskId,
              idToken: activeAcc?.idToken,
              refreshToken: activeAcc?.refreshToken,
              maxAttempts: 1, // Single iteration check inside interval
              pollInterval: 100,
              onCreditUpdate: (returnedCredits) => {
                if (activeAcc) updateDirectAccountCredits(activeAcc, returnedCredits);
              },
            });

            if (bridgeMediaUrl) {
              clearInterval(pollInterval);
              clearInterval(timerInterval);

              setGenerations((prev) =>
                prev.map((g) =>
                  g.id === activeItem.id
                    ? {
                        ...g,
                        status: 'completed',
                        mediaUrl: bridgeMediaUrl,
                        thumbnailUrl: refImage || g.thumbnailUrl || bridgeMediaUrl || '',
                        progress: 100,
                      }
                    : g
                )
              );
              autoSyncActiveAccountCredits();
              return;
            }
          } catch (bPollErr: any) {
            if (bPollErr?.message && (bPollErr.message.includes('gagal') || bPollErr.message.includes('failed'))) {
              clearInterval(pollInterval);
              clearInterval(timerInterval);
              setGenerations((prev) =>
                prev.map((g) =>
                  g.id === activeItem.id
                    ? { ...g, status: 'failed', errorMessage: bPollErr.message, progress: 0 }
                    : g
                )
              );
              return;
            }
          }
          return; // Lanjut ke interval tick berikutnya tanpa memanggil server yang terblokir
        }

        if (isGeminiModel) geminiPollInProgress = true;
        try {
          const activeGemAcc = isGeminiModel
            ? activeGeminiAccount
            : (dataFinal.wasSwitched && dataFinal.usedAccount) ? dataFinal.usedAccount : (dataFinal.usedAccount || geminiAcc);
          const pollBody = isGeminiModel
            ? {
                operationName: activeGeminiOperationName || serverTaskId,
                startedAt: activeGeminiTaskStartedAt,
                taskId: serverTaskId,
                apiKey: activeGemAcc?.apiKey,
                token: activeGemAcc?.token || activeGemAcc?.refreshToken || activeGemAcc?.cookies,
                cookies: activeGemAcc?.cookies || (/(?:__Secure-1PSID|(?:^|;\s*)SID=|(?:^|;\s*)SAPISID=)/i.test(activeGemAcc?.token || '') ? activeGemAcc.token : undefined),
                email: activeGemAcc?.email,
              }
            : isFlowModel
            ? {
                taskId: serverTaskId,
                token: flowAcc?.token || flowAcc?.cookies,
                cookies: flowAcc?.cookies || flowAcc?.token,
                authHeader: flowAcc?.authHeader,
                apiKey: flowAcc?.apiKey,
                email: flowAcc?.email,
              }
            : isRunningHubModel
            ? {
                apiKey: runninghubAcc?.refreshToken || runninghubAcc?.accessToken || runninghubAcc?.idToken || runninghubAcc?.email,
                taskId: serverTaskId,
              }
            : isGalleri5Model
            ? {
                accessToken: galleri5Acc?.refreshToken || galleri5Acc?.accessToken || galleri5Acc?.idToken,
                sessionId: recipeId || serverTaskId,
                predictionId: predictionId,
                organizationId: galleri5Acc?.organizationId,
              }
            : isKieModel
            ? {
                apiKey: kieAcc.refreshToken || kieAcc.accessToken,
                taskId: serverTaskId,
              }
            : isRoboneoModel
            ? {
                accessToken: roboneoAcc.refreshToken || roboneoAcc.accessToken || roboneoAcc.idToken,
                recipeId,
                taskId: serverTaskId,
              }
            : {
                refreshToken: activeAcc.refreshToken,
                idToken: activeAcc.idToken,
                recipeId,
                nodeId,
                taskId: serverTaskId,
              };

          const { data: pollData } = await safeFetchJson(pollEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pollBody),
          });

          if (pollCount % 2 === 1 || pollData?.status === 'completed' || pollData?.status === 'SUCCESS' || pollData?.status === 'failed') {
            console.log(`[Client 🔄 Polling] Task: ${serverTaskId} | Status: ${pollData?.status || 'processing'} (${pollData?.rawStatus || '-'})`);
          }

          // Real-time credit update directly from status polling response
          const returnedCredits = typeof pollData?.userRemainingCredits === 'number'
            ? pollData.userRemainingCredits
            : (typeof pollData?.remainingCredits === 'number'
              ? pollData.remainingCredits
              : (typeof pollData?.credits === 'number' ? pollData.credits : undefined));

          if (isGeminiModel && activeGeminiAccount) {
            if (returnedCredits !== undefined) {
              autoSyncGeminiAccountCredits(activeGeminiAccount, returnedCredits);
            }
          } else if (isKieModel && kieAcc) {
            if (typeof pollData?.creditsConsumed === 'number' && pollData.creditsConsumed > 0) {
              updateDirectKieAccountCredits(kieAcc, { creditsConsumed: pollData.creditsConsumed }, serverTaskId);
            } else if (returnedCredits !== undefined) {
              updateDirectKieAccountCredits(kieAcc, { remainingCredits: returnedCredits }, serverTaskId);
            }
          } else if (returnedCredits !== undefined) {
            if (isGalleri5Model && galleri5Acc) {
              updateDirectGalleri5AccountCredits(galleri5Acc, returnedCredits);
            } else if (activeAcc) {
              updateDirectAccountCredits(activeAcc, returnedCredits);
            }
          }

          const resultMediaUrl =
            pollData?.mediaUrl ||
            pollData?.resultUrl ||
            pollData?.videoUrl ||
            (Array.isArray(pollData?.outputs) && pollData.outputs.length > 0
              ? (pollData.outputs[0]?.fileUrl || pollData.outputs[0]?.url || (typeof pollData.outputs[0] === 'string' ? pollData.outputs[0] : ''))
              : '');

          const isCompleted =
            (pollData?.status === 'completed' || pollData?.status === 'SUCCESS' || pollData?.rawStatus === 'SUCCESS') &&
            !!resultMediaUrl;

          const isFailureResponse =
            pollData?.status === 'failed' ||
            pollData?.status === 'FAILED' ||
            (pollData && pollData.success === false && (pollData.error || pollData.errorMessage)) ||
            (isVideoMode && Boolean(pollData?.done && !resultMediaUrl)) ||
            (isVideoMode && pollData?.status === 'completed' && !resultMediaUrl) ||
            (typeof (pollData?.error || pollData?.errorMessage || pollData?.text) === 'string' &&
              (String(pollData?.error || pollData?.errorMessage || pollData?.text).toLowerCase().includes('traffic pembuatan video') ||
                String(pollData?.error || pollData?.errorMessage || pollData?.text).toLowerCase().includes('kapasitas saya penuh') ||
                String(pollData?.error || pollData?.errorMessage || pollData?.text).toLowerCase().includes('kapasitas penuh') ||
                String(pollData?.error || pollData?.errorMessage || pollData?.text).toLowerCase().includes('kapasitas sedang penuh') ||
                String(pollData?.error || pollData?.errorMessage || pollData?.text).toLowerCase().includes('luar biasa tinggi') ||
                String(pollData?.error || pollData?.errorMessage || pollData?.text).toLowerCase().includes('coba lagi nanti') ||
                String(pollData?.error || pollData?.errorMessage || pollData?.text).toLowerCase().includes('capacity is full') ||
                String(pollData?.error || pollData?.errorMessage || pollData?.text).toLowerCase().includes('try again later')));

          if (isCompleted) {
            clearInterval(pollInterval);
            clearInterval(timerInterval);

            setGenerations((prev) =>
              prev.map((g) =>
                g.id === activeItem.id
                  ? {
                      ...g,
                      status: 'completed',
                      mediaUrl: resultMediaUrl,
                      thumbnailUrl: pollData.coverUrl || refImage || g.thumbnailUrl || resultMediaUrl || '',
                      progress: 100,
                    }
                  : g
              )
            );
            if (isGeminiModel && activeGeminiAccount) {
              autoSyncGeminiAccountCredits(activeGeminiAccount, returnedCredits);
            } else if (isRunningHubModel) {
              autoSyncRunningHubAccountCredits(runninghubAcc?.refreshToken || runninghubAcc?.accessToken || runninghubAcc?.idToken || runninghubAcc?.email);
            } else if (isKieModel) {
              autoSyncKieAccountCredits(kieAcc?.refreshToken || kieAcc?.accessToken);
            } else if (isGalleri5Model) {
              autoSyncGalleri5AccountCredits(galleri5Acc?.refreshToken || galleri5Acc?.accessToken || galleri5Acc?.idToken);
            } else if (!isRoboneoModel) {
              autoSyncActiveAccountCredits();
            }
            releaseGeminiLease();
          } else if (
            isGeminiModel &&
            (pollData?.failureSource === 'generation_not_confirmed' ||
              pollData?.failureSource === 'status_poll' ||
              pollData?.error === 'Respon server bukan JSON valid (HTML/Timeout). Silakan coba lagi.')
          ) {
            clearInterval(pollInterval);
            clearInterval(timerInterval);
            setGenerations((prev) =>
              prev.map((g) =>
                g.id === activeItem.id
                  ? {
                      ...g,
                      status: 'failed',
                      errorMessage:
                        pollData.errorMessage ||
                        pollData.error ||
                        'Gemini tidak mengonfirmasi generasi video. Task dihentikan.',
                      progress: 0,
                    }
                  : g
              )
            );
            if (activeGeminiAccount) {
              autoSyncGeminiAccountCredits(activeGeminiAccount, returnedCredits);
            }
            releaseGeminiLease();
          } else if (isFailureResponse) {
            let terminalErrorMessage =
              pollData?.errorMessage ||
              pollData?.error ||
              pollData?.text ||
              'Generasi gagal.';
            if (isGeminiModel && isVideoMode) {
              if (geminiFailoverInProgress) return;
              geminiFailoverInProgress = true;
              let retryFailureMessage =
                terminalErrorMessage;
              try {
                handleGeminiExhaustedAccounts(pollData, retryFailureMessage, activeGeminiAccount);
                if (typeof returnedCredits === 'number' && activeGeminiAccount) {
                  autoSyncGeminiAccountCredits(
                    activeGeminiAccount,
                    pollData?.isQuotaExhausted ? 0 : returnedCredits,
                  );
                }

                const retryAccounts = getGeminiAccounts()
                  .filter((account: any) => {
                    const token = String(account.cookies || account.token || account.refreshToken || '').trim();
                    const hasWebSession = /(?:__Secure-1PSID|(?:^|;\s*)SID=|(?:^|;\s*)SAPISID=)/i.test(token);
                    const credits = typeof account.credits === 'number' ? account.credits : 0;
                    return (
                      !hasAttemptedGeminiAccount(account) &&
                      hasWebSession &&
                      credits > 0 &&
                      (!account.accountStatus || account.accountStatus === 'active')
                    );
                  })
                  .sort((a: any, b: any) => {
                    const creditsA = typeof a.credits === 'number' ? a.credits : 0;
                    const creditsB = typeof b.credits === 'number' ? b.credits : 0;
                    return creditsB - creditsA;
                  });

                for (const retryAccount of retryAccounts) {
                  addAttemptedGeminiAccount(retryAccount);
                  const retryLease = await acquireGeminiAccountLease(1, retryAccount.id, {
                    exactAccountId: retryAccount.id,
                    onQueued: () =>
                      console.info(
                        `[Gemini Queue] Akun ${retryAccount.email || retryAccount.name || retryAccount.id} sedang digunakan; menunggu sebelum failover.`,
                      ),
                  });
                  if (!retryLease) continue;
                  console.info(
                    `[Gemini Account Failover] ${activeGeminiAccount?.email || 'Akun aktif'} gagal; mencoba ${retryAccount.email || retryAccount.name || retryAccount.id}.`,
                  );
                  setGenerations((prev) =>
                    prev.map((g) =>
                      g.id === activeItem.id
                        ? { ...g, status: 'processing', errorMessage: 'Gemini gagal pada akun sebelumnya; mencoba akun lain...' }
                        : g
                    )
                  );

                  const retryToken = String(retryAccount.token || retryAccount.refreshToken || retryAccount.cookies || '').trim();
                  const retryCookies = retryAccount.cookies ||
                    (/(?:__Secure-1PSID|(?:^|;\s*)SID=|(?:^|;\s*)SAPISID=)/i.test(retryToken)
                      ? retryToken
                      : undefined);
                  try {
                    const retryResponse = await fetch('/api/gemini/generate-video', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...payload,
                        id: retryAccount.id,
                        accountId: retryAccount.id,
                        email: retryAccount.email,
                        name: retryAccount.displayName || retryAccount.name || retryAccount.email,
                        token: retryToken,
                        apiKey: undefined,
                        cookies: retryCookies,
                        fallbackAccounts: [],
                      }),
                    });
                    const retryData = await retryResponse.json();
                    if (!retryResponse.ok || !retryData?.success) {
                      retryFailureMessage =
                        retryData?.errorMessage ||
                        retryData?.error ||
                        `Generasi gagal menggunakan akun ${retryAccount.email || retryAccount.name || retryAccount.id}.`;
                      handleGeminiExhaustedAccounts(retryData, retryFailureMessage, retryAccount);
                      if (typeof retryData?.remainingCredits === 'number') {
                        autoSyncGeminiAccountCredits(retryAccount, retryData.remainingCredits);
                      } else if (retryData?.isQuotaExhausted) {
                        autoSyncGeminiAccountCredits(retryAccount, 0);
                      }
                      for (const exhausted of retryData?.exhaustedAccounts || []) {
                        addAttemptedGeminiAccount(exhausted);
                      }
                      retryLease.release();
                      terminalErrorMessage = retryFailureMessage;
                      continue;
                    }

                    const usedGeminiAccount = {
                      ...retryAccount,
                      ...(retryData.usedAccount || {}),
                    };
                    addAttemptedGeminiAccount(usedGeminiAccount);
                    activeGeminiAccount = usedGeminiAccount;
                    const retryVideoUrl =
                      retryData.videoUrl || retryData.mediaUrl || retryData.resultUrl;
                    if (retryVideoUrl) {
                      clearInterval(pollInterval);
                      clearInterval(timerInterval);
                      activeGeminiLease?.release();
                      activeGeminiLease = retryLease;
                      geminiLease = retryLease;
                      setGenerations((prev) =>
                        prev.map((g) =>
                          g.id === activeItem.id
                            ? {
                                ...g,
                                status: 'completed',
                                mediaUrl: retryVideoUrl,
                                thumbnailUrl: retryData.coverUrl || imgItem?.url || retryVideoUrl,
                                progress: 100,
                                errorMessage: undefined,
                              }
                            : g
                        )
                      );
                      if (typeof retryData.remainingCredits === 'number') {
                        autoSyncGeminiAccountCredits(usedGeminiAccount, retryData.remainingCredits);
                      }
                      releaseGeminiLease();
                      return;
                    }

                    const retryOperationName = retryData.operationName || retryData.taskId;
                    if (!retryOperationName) {
                      retryFailureMessage = 'Akun Gemini cadangan tidak mengembalikan ID operasi video.';
                      retryLease.release();
                      continue;
                    }

                    activeGeminiLease?.release();
                    activeGeminiLease = retryLease;
                    geminiLease = retryLease;
                    activeGeminiOperationName = retryOperationName;
                    activeGeminiTaskStartedAt = Date.now();
                    activeGeminiDeadline = activeGeminiTaskStartedAt + 9 * 60 * 1000;
                    serverTaskId = retryData.taskId || retryOperationName;
                    setCurrentTaskId(serverTaskId);
                    if (typeof retryData.remainingCredits === 'number') {
                      autoSyncGeminiAccountCredits(usedGeminiAccount, retryData.remainingCredits);
                    }
                    setGenerations((prev) =>
                      prev.map((g) =>
                        g.id === activeItem.id
                          ? {
                              ...g,
                              status: 'processing',
                              taskId: serverTaskId,
                              errorMessage: undefined,
                            }
                          : g
                      )
                    );
                    console.info(
                      `[Gemini Account Failover] Render dilanjutkan dengan ${usedGeminiAccount.email || usedGeminiAccount.name || 'akun cadangan'}.`,
                    );
                    return;
                  } catch (retryError: any) {
                    retryLease.release();
                    retryFailureMessage =
                      retryError?.message ||
                      `Koneksi ke akun Gemini ${retryAccount.email || retryAccount.name || retryAccount.id} gagal.`;
                    console.warn('[Gemini Account Failover] Retry request failed:', retryError);
                    break;
                  }
                }
                if (retryAccounts.length === 0) {
                  terminalErrorMessage = `${terminalErrorMessage} Tidak ada akun Gemini lain dengan sesi valid dan kuota tersedia.`;
                } else if (retryFailureMessage !== pollData?.errorMessage && retryFailureMessage !== pollData?.error && retryFailureMessage !== pollData?.text) {
                  terminalErrorMessage = retryFailureMessage;
                }
              } finally {
                geminiFailoverInProgress = false;
              }
            }

            clearInterval(pollInterval);
            clearInterval(timerInterval);

            const failErrorMessage = terminalErrorMessage;

            setGenerations((prev) =>
              prev.map((g) =>
                g.id === activeItem.id
                  ? {
                      ...g,
                      status: 'failed',
                      errorMessage: failErrorMessage,
                    }
                  : g
              )
            );
            if (isGeminiModel && activeGeminiAccount) {
              handleGeminiExhaustedAccounts(pollData, failErrorMessage, activeGeminiAccount);
              const isQuotaExhausted =
                pollData?.isQuotaExhausted ||
                (typeof pollData?.error === 'string' &&
                  (pollData.error.toLowerCase().includes('lagi hari ini') ||
                    pollData.error.toLowerCase().includes('batas') ||
                    pollData.error.toLowerCase().includes('kuota')));
              autoSyncGeminiAccountCredits(activeGeminiAccount, isQuotaExhausted ? 0 : returnedCredits);
            } else if (isRunningHubModel) {
              autoSyncRunningHubAccountCredits(runninghubAcc?.refreshToken || runninghubAcc?.accessToken || runninghubAcc?.idToken || runninghubAcc?.email);
            } else if (isKieModel) {
              autoSyncKieAccountCredits(kieAcc?.refreshToken || kieAcc?.accessToken);
            } else if (isGalleri5Model) {
              autoSyncGalleri5AccountCredits(galleri5Acc?.refreshToken || galleri5Acc?.accessToken || galleri5Acc?.idToken);
            } else if (!isRoboneoModel) {
              autoSyncActiveAccountCredits();
            }
            releaseGeminiLease();
          } else if (isGalleri5Model && galleri5Acc && pollCount % 2 === 0) {
            // Background Auto-Sync History fallback for Galleri5
            try {
              const { ok, data: syncData } = await safeFetchJson('/api/galleri5/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  refreshToken: galleri5Acc.refreshToken || galleri5Acc.accessToken || galleri5Acc.idToken,
                  organizationId: galleri5Acc.organizationId,
                }),
              });
              if (ok && syncData && syncData.success && Array.isArray(syncData.items)) {
                const targetSid = recipeId || serverTaskId;
                const match = syncData.items.find((it: any) =>
                  (targetSid && (it.taskId === targetSid || it.recipeId === targetSid || (typeof it.id === 'string' && it.id.includes(targetSid))))
                );
                if (match && match.mediaUrl) {
                  clearInterval(pollInterval);
                  clearInterval(timerInterval);
                  setGenerations((prev) =>
                    prev.map((g) =>
                      g.id === activeItem.id
                        ? {
                            ...g,
                            status: 'completed',
                            mediaUrl: match.mediaUrl,
                            thumbnailUrl: match.mediaUrl,
                            progress: 100,
                          }
                        : g
                    )
                  );
                }
              }
            } catch (syncErr) {}
          }
        } catch (pollErr: any) {
          console.warn('Poll error:', pollErr);
        } finally {
          if (isGeminiModel) geminiPollInProgress = false;
        }
      }, 4000);

    } catch (err: any) {
      clearInterval(timerInterval);
      releaseGeminiLease();
      setIsSubmittingTask(false);
      setGenState('failed');
      setGenerations((prev) =>
        prev.map((g) =>
          g.id === activeItem.id
            ? {
                ...g,
                status: 'failed',
                errorMessage: err?.message || 'Gagal terhubung ke server generasi.',
              }
            : g
        )
      );
      if (isVidsModel) {
        await autoSyncVidsAccountCredits(vidsAcc?.email);
      } else if (isKieModel) {
        autoSyncKieAccountCredits(kieAcc?.refreshToken || kieAcc?.accessToken);
      } else if (!isRoboneoModel && !isGalleri5Model && !isVidsModel) {
        autoSyncActiveAccountCredits();
      }
    }
  };

  // Reset or Retry handler
  const handleResetOrRetry = () => {
    setGenState('idle');
  };

  // Simulate explicit wireframe views (01, 02, 03, 04)
  const handleSimulateState = (targetState: WireframeGenState) => {
    setGenState(targetState);

    if (targetState === 'idle') {
      setCurrentTaskId('task_8f3a7d2e6c1b');
      setPrompt('');
      setGenerations((prev) =>
        prev.map((item, idx) =>
          idx === 0
            ? {
                ...item,
                status: 'completed',
                timerString: undefined,
              }
            : item
        )
      );
    } else if (targetState === 'processing') {
      const promptText = 'Cinematic sunrise over misty mountains with soft clouds, golden light, and a calm atmosphere.';
      setPrompt(promptText);
      setCurrentTaskId('task_8f3a7d2e6c1b');
      setCurrentTimerString('00:32');
      setGenerationProgress(25);

      setGenerations((prev) => {
        const topItem = prev[0];
        if (!topItem) return prev;
        return [
          {
            ...topItem,
            title: 'Sunrise in the Mountains',
            status: 'processing',
            timerString: '00:32',
            progress: 25,
            timestamp: '09:20',
            aspectRatio: '16:9',
            resolution: '1080p',
          },
          ...prev.slice(1),
        ];
      });
    } else if (targetState === 'completed') {
      const promptText = 'Cinematic sunrise over misty mountains with soft clouds, golden light, and a calm atmosphere.';
      setPrompt(promptText);
      setCurrentTaskId('task_8f3a7d2e6c1b');
      setCurrentTimerString('06:45');

      setGenerations((prev) => {
        const topItem = prev[0];
        if (!topItem) return prev;
        return [
          {
            ...topItem,
            title: 'Sunrise in the Mountains',
            status: 'completed',
            timerString: '06:45',
            timestamp: '09:20',
            aspectRatio: '16:9',
            resolution: '1080p',
          },
          ...prev.slice(1),
        ];
      });
    } else if (targetState === 'failed') {
      const promptText = 'Cinematic sunrise over misty mountains with soft clouds, golden light, and a calm atmosphere.';
      setPrompt(promptText);
      setCurrentTaskId('task_8f3a7d2e6c1b');
      setCurrentTimerString('02:18');

      setGenerations((prev) => {
        const topItem = prev[0];
        if (!topItem) return prev;
        return [
          {
            ...topItem,
            title: 'Sunrise in the Mountains',
            status: 'failed',
            timerString: '02:18',
            errorMessage: 'Failed to generate video. Please try again.',
            timestamp: '09:20',
            aspectRatio: '16:9',
            resolution: '1080p',
          },
          ...prev.slice(1),
        ];
      });
    }
  };

  if (!currentUser) {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <AuthScreen
          onLoginSuccess={handleLoginSuccess}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
        />
        <ThemeSlideOverlay
          isAnimating={overlayState.isAnimating}
          targetIsDark={overlayState.targetIsDark}
          originX={overlayState.originX}
          originY={overlayState.originY}
          onAnimationEnd={() =>
            setOverlayState((prev) => ({ ...prev, isAnimating: false }))
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E2DFD8] dark:bg-[#0A0A0E] text-stone-800 dark:text-stone-100 flex font-sans-body antialiased selection:bg-amber-200 selection:text-amber-900">
      {/* Desktop Left Sidebar */}
      {activeTab !== 'canvas' && activeTab !== 'chat' && activeTab !== 'studio' && (
        <DesktopSidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            if (tab === 'batch') {
              setExternalProviderId('runninghub');
            } else if (tab === 'canvas') {
              setExternalProviderId('weavy');
            } else if (tab === 'settings') {
              setExternalProviderId(resolveActiveProviderId(settings));
            } else {
              setExternalProviderId(settings.provider || resolveActiveProviderId(settings));
            }
            setActiveTab(tab);
          }}
          onSelectProvider={handleSelectProvider}
          selectedProviderId={activeTab === 'batch' ? 'runninghub' : externalProviderId}
          weavyAccountsCount={getWeavyAccountsCount()}
          weavyAccounts={getWeavyAccounts()}
          geminiAccountsCount={getGeminiAccountsCount()}
          geminiAccounts={getGeminiAccounts()}
          flowAccountsCount={getFlowAccountsCount()}
          flowAccounts={getFlowAccounts()}
          vidsAccountsCount={getVidsAccountsCount()}
          vidsAccounts={getVidsAccounts()}
          roboneoAccountsCount={getRoboneoAccountsCount()}
          roboneoAccounts={getRoboneoAccounts()}
          galleri5AccountsCount={getGalleri5AccountsCount()}
          galleri5Accounts={getGalleri5Accounts()}
          kieAccountsCount={getKieAccountsCount()}
          kieAccounts={getKieAccounts()}
          runninghubAccountsCount={getRunningHubAccountsCount()}
          runninghubAccounts={getRunningHubAccounts()}
          settings={settings}
        />
      )}

      {/* Main Container */}
      <div className={`flex-1 min-w-0 flex flex-col ${activeTab === 'canvas' || activeTab === 'chat' || activeTab === 'studio' ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
        {/* Header */}
        {activeTab !== 'canvas' && activeTab !== 'chat' && activeTab !== 'studio' && (
          <Header
            activeTab={activeTab}
            providerName={getActiveProvider().name}
            currentUser={currentUser}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenInfo={() => setIsInfoOpen(true)}
            onOpenLogin={() => setIsLoginOpen(true)}
            onOpenProfile={() => setActiveTab('profile')}
            onLogout={handleLogout}
            onSyncHistory={handleSyncHistory}
            isSyncingHistory={isSyncingHistory}
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
          />
        )}

        {/* Content Body */}
        <div
          className={
            activeTab === 'canvas' || activeTab === 'chat' || activeTab === 'studio'
              ? 'w-full h-full flex-1 overflow-hidden p-0 m-0 max-w-none'
              : `flex-1 p-3 sm:p-5 lg:p-6 w-full mx-auto pb-28 lg:pb-12 space-y-6 ${
                  activeTab === 'batch' || activeTab === 'history' || activeTab === 'settings'
                    ? 'max-w-[1720px]'
                    : 'max-w-6xl'
                }`
          }
        >
          {activeTab === 'generate' && (
            <div className="space-y-6">
              {/* Main Prompt Card */}
              <PromptCard
                prompt={prompt}
                onPromptChange={setPrompt}
                settings={settings}
                activeProvider={getActiveProvider()}
                attachedMedia={attachedMedia}
                onRemoveMedia={handleRemoveMedia}
                onRetryMediaUpload={handleRetryUpload}
                onAttachMedia={handleAttachMedia}
                onOpenAddMedia={() => setIsAddMediaOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onGenerate={handleGenerate}
                genState={genState}
                isSubmittingTask={isSubmittingTask}
                taskId={currentTaskId}
                timerString={currentTimerString}
                generationProgress={generationProgress}
                onResetOrRetry={handleResetOrRetry}
                onSimulateState={handleSimulateState}
              />

              {/* Recent Generations Grid Section matching Wireframe 1 */}
              <RecentGenerations
                items={generations}
                onSelect={setSelectedDetailItem}
                onViewAll={() => setActiveTab('history')}
                onDelete={handleDeleteGeneration}
                onToggleFavorite={handleToggleFavorite}
                onRetryItem={(id) => handleGenerate()}
                onSendAsReference={handleSendAsReference}
                onReuseItem={handleReuseGeneration}
              />
            </div>
          )}

          {activeTab === 'batch' && (
            <BatchView
              onAddGenerationToHistory={(item) => setGenerations((prev) => [item, ...prev])}
              onSwitchToHistory={() => setActiveTab('history')}
            />
          )}

          {activeTab === 'canvas' && (
            <CanvasView
              weavyToken={getWeavyAccounts().find((a) => a.isActive)?.idToken || getWeavyAccounts()[0]?.idToken}
              refreshToken={getWeavyAccounts().find((a) => a.isActive)?.refreshToken || getWeavyAccounts()[0]?.refreshToken}
              weavyCredits={typeof getWeavyAccounts().find((a) => a.isActive)?.credits === 'number' ? (getWeavyAccounts().find((a) => a.isActive)!.credits as number) : 150}
              activeAccountId={getWeavyAccounts().find((a) => a.isActive)?.id || getWeavyAccounts()[0]?.id}
              workspaceName={
                getWeavyAccounts().find((a) => a.isActive)?.name ||
                getWeavyAccounts().find((a) => a.isActive)?.email?.split('@')[0] ||
                'Tempat Fashion'
              }
              userAvatarInitial={
                (
                  getWeavyAccounts().find((a) => a.isActive)?.name ||
                  getWeavyAccounts().find((a) => a.isActive)?.email?.split('@')[0] ||
                  'Tempat Fashion'
                )
                  .charAt(0)
                  .toUpperCase()
              }
              onAddGeneration={(item) => {
                setGenerations((prev) => {
                  const filtered = prev.filter((g) => g.id !== item.id && (g.mediaUrl ? g.mediaUrl !== item.mediaUrl : true));
                  return [item, ...filtered];
                });
              }}
              onRefreshCredits={(usedAcc) => autoSyncActiveAccountCredits(usedAcc)}
              onSelectWeavyAccount={(accId) => {
                try {
                  const raw = localStorage.getItem('weavy_accounts');
                  if (!raw) return;
                  const accounts = JSON.parse(raw);
                  if (!Array.isArray(accounts)) return;
                  const updated = accounts.map((a: any) => ({
                    ...a,
                    isActive: a.id === accId,
                  }));
                  localStorage.setItem('weavy_accounts', JSON.stringify(updated));
                  window.dispatchEvent(new Event('weavy_accounts_updated'));
                  window.dispatchEvent(new Event('accounts-updated'));
                  syncProviderAccountsToSheet('weavy', updated);
                } catch (e) {}
              }}
              onBack={() => setActiveTab('generate')}
              onNavigateHistory={() => setActiveTab('history')}
              isDarkMode={isDarkMode}
              onToggleDarkMode={toggleDarkMode}
            />
          )}

          {activeTab === 'chat' && (
            <ChatView
              activeAccountId={getWeavyAccounts().find((a) => a.isActive)?.id || getWeavyAccounts()[0]?.id}
              onSelectWeavyAccount={(accId) => {
                try {
                  const raw = localStorage.getItem('weavy_accounts');
                  if (!raw) return;
                  const accounts = JSON.parse(raw);
                  if (!Array.isArray(accounts)) return;
                  const updated = accounts.map((a: any) => ({
                    ...a,
                    isActive: a.id === accId,
                  }));
                  localStorage.setItem('weavy_accounts', JSON.stringify(updated));
                  window.dispatchEvent(new Event('weavy_accounts_updated'));
                  window.dispatchEvent(new Event('accounts-updated'));
                  syncProviderAccountsToSheet('weavy', updated);
                } catch (e) {}
              }}
              onRefreshCredits={(usedAcc) => autoSyncActiveAccountCredits(usedAcc)}
              onBack={() => setActiveTab('generate')}
              onNavigateCanvas={(promptText, imageUrl) => {
                if (promptText) {
                  try {
                    localStorage.setItem('amb_canvas_pending_prompt', promptText);
                    if (imageUrl) {
                      localStorage.setItem('amb_canvas_pending_image', imageUrl);
                    }
                  } catch (e) {}
                }
                setActiveTab('canvas');
              }}
              onNavigateGenerate={(promptText) => {
                if (promptText) {
                  setPrompt(promptText);
                }
                setActiveTab('generate');
              }}
              onNavigateStudio={(storyboardProject) => {
                if (storyboardProject) {
                  try {
                    localStorage.setItem('amb_studio_pending_project', JSON.stringify(storyboardProject));
                  } catch (e) {}
                  window.dispatchEvent(new CustomEvent('amb_load_studio_project', { detail: storyboardProject }));
                }
                setActiveTab('studio');
              }}
              isDarkMode={isDarkMode}
              onToggleDarkMode={toggleDarkMode}
            />
          )}

          {activeTab === 'studio' && (
            <StudioView
              onBack={() => setActiveTab('generate')}
              onNavigateToCanvas={(imageUrls) => {
                if (imageUrls && imageUrls.length > 0) {
                  try {
                    localStorage.setItem('amb_canvas_pending_image', imageUrls[0]);
                  } catch (e) {}
                }
                setActiveTab('canvas');
              }}
              onNavigateToSettings={() => setActiveTab('settings')}
              isDarkMode={isDarkMode}
              onToggleDarkMode={toggleDarkMode}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              items={generations}
              onSelect={setSelectedDetailItem}
              onDelete={handleDeleteGeneration}
              onDeleteGenerations={handleDeleteGenerations}
              onToggleFavorite={handleToggleFavorite}
              onNavigateGenerate={() => setActiveTab('generate')}
              onSyncHistory={handleSyncHistory}
              isSyncing={isSyncingHistory}
              providerName={getActiveProvider().name}
              onSendAsReference={handleSendAsReference}
              onReuseItem={handleReuseGeneration}
            />
          )}

          <div style={{ display: activeTab === 'settings' ? 'contents' : 'none' }}>
            <GlobalSettingsView
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              externalProviderId={externalProviderId}
              onSelectProvider={handleSelectProvider}
              onClearExternalProviderId={() => setExternalProviderId(null)}
              currentUser={currentUser}
            />
          </div>

          {activeTab === 'profile' && (
            <ProfileView
              favoriteCount={generations.filter((g) => g.isFavorite).length}
              totalGenerationsCount={generations.length}
              onNavigateHistory={() => setActiveTab('history')}
              currentUser={currentUser}
              onOpenLogin={() => setIsLoginOpen(true)}
              onLogout={handleLogout}
              isDarkMode={isDarkMode}
              onToggleDarkMode={toggleDarkMode}
            />
          )}
        </div>
      </div>

      {/* Bottom Navigation for Mobile */}
      {activeTab !== 'canvas' && activeTab !== 'chat' && (
        <BottomNav
          activeTab={activeTab}
          onChangeTab={(tab) => {
            if (tab === 'batch') {
              setExternalProviderId('runninghub');
            } else {
              setExternalProviderId(null);
            }
            setActiveTab(tab);
          }}
        />
      )}

      {/* Modals & BottomSheets */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        currentUser={currentUser}
      />

      <AddMediaModal
        isOpen={isAddMediaOpen}
        onClose={() => setIsAddMediaOpen(false)}
        onAttachMedia={handleAttachMedia}
        activeProvider={getActiveProvider()}
        weavyAccounts={getWeavyAccounts()}
        roboneoAccounts={getRoboneoAccounts()}
        galleri5Accounts={getGalleri5Accounts()}
        kieAccounts={getKieAccounts()}
        runninghubAccounts={getRunningHubAccounts()}
        mode={settings.mode}
        videoModel={settings.videoModel}
        imageModel={settings.imageModel}
        attachedMedia={attachedMedia}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      <InfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
      />

      <GenerationDetailModal
        item={selectedDetailItem}
        onClose={() => setSelectedDetailItem(null)}
        onUsePrompt={(p) => {
          setPrompt(p);
          setActiveTab('generate');
        }}
        onDelete={handleDeleteGeneration}
        onSendAsReference={handleSendAsReference}
        onReuseItem={handleReuseGeneration}
        onSendExtractedFrameAsReference={handleSendExtractedFrameAsReference}
        onMediaUpdated={(id, mediaUrl) => {
          setGenerations((current) =>
            current.map((generation) =>
              generation.id === id ? { ...generation, mediaUrl } : generation
            )
          );
        }}
      />

      {/* Theme Transition Slide Overlay */}
      <ThemeSlideOverlay
        isAnimating={overlayState.isAnimating}
        targetIsDark={overlayState.targetIsDark}
        originX={overlayState.originX}
        originY={overlayState.originY}
        onAnimationEnd={() =>
          setOverlayState((prev) => ({ ...prev, isAnimating: false }))
        }
      />
    </div>
  );
}
