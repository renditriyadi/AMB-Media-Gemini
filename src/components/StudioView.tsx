import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Layers,
  Download,
  Folder,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ZoomIn,
  X,
  FileArchive,
  Grid,
  Settings,
  Plus,
  ArrowLeft,
  ChevronDown,
  Sun,
  Moon,
  Coins,
  Check,
  Film,
  Zap,
  LayoutGrid,
  Info,
  Eye,
  EyeOff,
  Copy,
  PanelLeftClose,
  PanelLeft,
  Menu,
  Clapperboard,
  UserCheck
} from 'lucide-react';
import {
  StudioProject,
  StudioScene,
  StudioAspectRatio,
  StudioImageModel,
  StudioAiModel,
  StudioAnalysis,
  StudioVideoMetadata,
  StudioCustomAsset
} from '../types/studio';
import { StudioVideoIngestCard } from './studio/StudioVideoIngestCard';
import { StudioAnalysisCard } from './studio/StudioAnalysisCard';
import { StudioSceneCard } from './studio/StudioSceneCard';
import { StudioCompositeModal } from './studio/StudioCompositeModal';
import { StudioProjectHistoryModal } from './studio/StudioProjectHistoryModal';
import { StudioTalentCard } from './studio/StudioTalentCard';
import { StudioCharacterSheetCard } from './studio/StudioCharacterSheetCard';
import { StudioMasterVisualCard } from './studio/StudioMasterVisualCard';
import { StudioAtmRemixCard } from './studio/StudioAtmRemixCard';
import {
  analyzeVideoForStudio,
  generateStudioSceneImage,
  initiateStudioSceneGeneration,
  pollStudioTaskCompletion,
  collectStudioReferenceImages,
  getActiveWeavyAccount,
  getAllWeavyAccounts,
  switchActiveWeavyAccount,
  syncWeavyAccountCredits
} from '../lib/studioService';
import {
  saveStudioProjectToDb,
  getStudioProjectFromDb,
  getAllStudioProjectsFromDb
} from '../lib/studioIndexedDb';
import { ProviderAccount } from './GlobalSettingsView';

export type StudioSubMenu = 'storyboard' | 'talent' | 'character-sheet';

export interface StudioMenuItem {
  id: StudioSubMenu;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const STUDIO_MENU_ITEMS: StudioMenuItem[] = [
  {
    id: 'storyboard',
    label: 'Storyboard',
    subtitle: 'Video & Script Breakdown',
    icon: Film,
    badge: 'Aktif',
  },
  {
    id: 'talent',
    label: 'AI Talent',
    subtitle: 'Virtual Model & Product Actor',
    icon: UserCheck,
    badge: 'Populer',
  },
  {
    id: 'character-sheet',
    label: 'Karakter Sheet',
    subtitle: 'Multi-Angle Turnaround Sheet',
    icon: Layers,
    badge: 'Baru',
  },
];

interface Props {
  onBack?: () => void;
  onNavigateToCanvas?: (imageUrls: string[]) => void;
  onNavigateToSettings?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const StudioView: React.FC<Props> = ({
  onBack,
  onNavigateToCanvas,
  onNavigateToSettings,
  isDarkMode = true,
  onToggleDarkMode
}) => {
  // 1. Initial Default Clean Empty Project State
  const [project, setProject] = useState<StudioProject>(() => ({
    id: `proj_${Date.now()}`,
    name: 'Proyek Studio Baru',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aspectRatio: '9:16',
    imageModel: 'GPT Image 2.5',
    aiModel: 'google/gemini-2.5-flash',
    scenes: [],
    compositeConfig: {
      gridColumns: 3,
      gridRows: 2,
      showBadges: true,
      showTitleBanner: true,
      titleText: 'STORYBOARD BARU',
      borderColor: '#0A0A0E',
      borderWidth: 16,
      padding: 24,
      aspectRatio: '16:9',
    },
  }));

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDispatchingBatch, setIsDispatchingBatch] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<{ message: string; type: 'info' | 'success' | 'warning' } | null>(null);

  // Accounts state
  const [accounts, setAccounts] = useState<ProviderAccount[]>(() => getAllWeavyAccounts());
  const [activeAccount, setActiveAccount] = useState<ProviderAccount | null>(() => getActiveWeavyAccount());
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [isSyncingCredits, setIsSyncingCredits] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [isCompositeModalOpen, setIsCompositeModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [showAllPrompts, setShowAllPrompts] = useState(false);
  const [zoomModal, setZoomModal] = useState<{ open: boolean; url: string; title: string }>({
    open: false,
    url: '',
    title: '',
  });

  // Studio Sidebar sub-menu state
  const [activeSubMenu, setActiveSubMenu] = useState<StudioSubMenu>('storyboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('amb_studio_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('amb_studio_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Refresh accounts list from storage
  const refreshAccountsFromStorage = useCallback(() => {
    const list = getAllWeavyAccounts();
    setAccounts(list);
    const active = list.find((a) => a.isActive) || list[0] || null;
    setActiveAccount(active);
  }, []);

  // Listen for account updates across the app
  useEffect(() => {
    refreshAccountsFromStorage();
    const handleAccUpdate = () => refreshAccountsFromStorage();
    window.addEventListener('weavy_accounts_updated', handleAccUpdate);
    window.addEventListener('accounts-updated', handleAccUpdate);
    return () => {
      window.removeEventListener('weavy_accounts_updated', handleAccUpdate);
      window.removeEventListener('accounts-updated', handleAccUpdate);
    };
  }, [refreshAccountsFromStorage]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsAccountDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Load last saved project from IndexedDB
  useEffect(() => {
    const initLoad = async () => {
      try {
        const list = await getAllStudioProjectsFromDb();
        if (list.length > 0) {
          setProject(list[0]);
        }
      } catch (e) {
        console.warn('Initial project load warning:', e);
      }
    };
    initLoad();
  }, []);

  // Auto-save project changes
  useEffect(() => {
    if (project.scenes.length > 0 || project.analysis) {
      saveStudioProjectToDb(project);
    }
  }, [project]);

  // Sync Active Account Credits
  const handleSyncCredits = async () => {
    if (!activeAccount || isSyncingCredits) return;
    setIsSyncingCredits(true);
    try {
      const creds = await syncWeavyAccountCredits(activeAccount);
      refreshAccountsFromStorage();
      if (creds !== null) {
        showNotice(`Kredit berhasil disinkronkan: ${creds} CR`, 'success');
      }
    } catch (e) {
      console.warn('Sync credit error:', e);
    } finally {
      setIsSyncingCredits(false);
    }
  };

  const showNotice = (message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setStatusNotice({ message, type });
    setTimeout(() => {
      setStatusNotice(null);
    }, 4000);
  };

  // Check for pending Storyboard project from Chat Copilot
  useEffect(() => {
    const handleLoadPendingProject = (rawProjectData?: any) => {
      try {
        let pData = rawProjectData;
        if (!pData) {
          const stored = localStorage.getItem('amb_studio_pending_project');
          if (stored) {
            pData = JSON.parse(stored);
            localStorage.removeItem('amb_studio_pending_project');
          }
        }
        if (!pData) return;

        const rawScenes = Array.isArray(pData.scenes) ? pData.scenes : [];
        const mappedScenes: StudioScene[] = rawScenes.map((sc: any, idx: number) => ({
          id: sc.id || `sc_${Date.now()}_${idx + 1}`,
          sceneNumber: Number(sc.sceneNumber || sc.scene_number || idx + 1),
          title: sc.title || sc.name || `Scene ${idx + 1}`,
          durationSec: Number(sc.durationSec || sc.duration_sec || (typeof sc.duration === 'number' ? sc.duration : parseInt(String(sc.duration || '').replace(/[^\d]/g, ''), 10))) || 10,
          timecode: sc.timecode || `${(idx * 10).toString().padStart(2, '0')}:00 - ${((idx + 1) * 10).toString().padStart(2, '0')}:00`,
          visualDescription: sc.visualDescription || sc.visual_description || sc.visual || '',
          voiceover: sc.voiceover || sc.vo || sc.narration || '',
          onScreenText: sc.onScreenText || sc.on_screen_text || '',
          cameraAngle: sc.cameraAngle || sc.cameraMovement || sc.camera || 'Medium Shot',
          imagePrompt: sc.imagePrompt || sc.image_prompt || sc.prompt || '',
          videoPrompt: sc.videoPrompt || sc.video_prompt || '',
          status: 'idle' as const,
        }));

        if (mappedScenes.length > 0 || pData.title) {
          const newStudioProject: StudioProject = {
            id: pData.id || `proj_${Date.now()}`,
            name: pData.title || pData.productName || 'Proyek Storyboard Copilot',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            aspectRatio: (pData.aspectRatio === '16:9' || pData.aspectRatio === '1:1') ? pData.aspectRatio : '9:16',
            imageModel: 'GPT Image 2.5',
            aiModel: 'google/gemini-2.5-flash',
            scenes: mappedScenes,
            compositeConfig: {
              gridColumns: Math.min(3, Math.max(2, Math.ceil(mappedScenes.length / 2))),
              gridRows: Math.max(1, Math.ceil(mappedScenes.length / 3)),
              showBadges: true,
              showTitleBanner: true,
              titleText: (pData.title || pData.productName || 'STORYBOARD COPILOT').toUpperCase(),
              borderColor: '#0A0A0E',
              borderWidth: 16,
              padding: 24,
              aspectRatio: '16:9',
            },
          };

          setProject(newStudioProject);
          saveStudioProjectToDb(newStudioProject);
          showNotice(`🎬 Proyek Storyboard "${newStudioProject.name}" berhasil dimuat ke Studio! (${mappedScenes.length} Adegan)`, 'success');
        }
      } catch (err) {
        console.warn('Failed to load pending studio project:', err);
      }
    };

    // Check immediate pending project on mount
    handleLoadPendingProject();

    // Listen to custom dispatch event
    const handleCustomEvent = (e: any) => {
      handleLoadPendingProject(e?.detail);
    };
    window.addEventListener('amb_load_studio_project', handleCustomEvent);
    return () => {
      window.removeEventListener('amb_load_studio_project', handleCustomEvent);
    };
  }, []);

  // Create new fresh Studio Project
  const handleCreateNewProject = () => {
    const newProj: StudioProject = {
      id: `proj_${Date.now()}`,
      name: 'Proyek Studio Baru',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aspectRatio: '9:16',
      imageModel: 'GPT Image 2.5',
      scenes: [],
      compositeConfig: {
        gridColumns: 3,
        gridRows: 2,
        showBadges: true,
        showTitleBanner: true,
        titleText: 'STORYBOARD BARU',
        borderColor: '#0A0A0E',
        borderWidth: 16,
        padding: 24,
        aspectRatio: '16:9',
      },
    };
    setProject(newProj);
    setIsHistoryModalOpen(false);
    showNotice('Proyek baru telah dibuat. Silakan masukkan URL video atau prompt analisis.', 'info');
  };

  // Switch Weavy Account
  const handleSelectAccount = (accId: string) => {
    const switched = switchActiveWeavyAccount(accId);
    if (switched) {
      setActiveAccount(switched);
      setIsAccountDropdownOpen(false);
      showNotice(`Beralih ke akun ${switched.name || switched.email} (${switched.credits ?? 0} CR)`, 'info');
      syncWeavyAccountCredits(switched).then(() => refreshAccountsFromStorage());
    }
  };

  // 1. Handle Video Analysis & Storyboard Breakdown
  const handleAnalyze = async (params: {
    videoUrl?: string;
    title?: string;
    rawPrompt?: string;
    productName?: string;
    productDescription?: string;
    productImage?: string;
    modelTalent?: string;
    modelImage?: string;
    backgroundSetting?: string;
    backgroundImage?: string;
    mainBrief?: string;
    totalDurationSec?: number;
    numScenes?: number;
    aspectRatio: StudioAspectRatio;
    imageModel: StudioImageModel;
    aiModel?: StudioAiModel;
    customAssets?: StudioCustomAsset[];
  }) => {
    setIsAnalyzing(true);
    setGlobalError(null);

    try {
      const result = await analyzeVideoForStudio({
        videoUrl: params.videoUrl,
        title: params.title,
        rawPrompt: params.rawPrompt,
        productName: params.productName,
        productDescription: params.productDescription,
        productImage: params.productImage,
        modelTalent: params.modelTalent,
        modelImage: params.modelImage,
        backgroundSetting: params.backgroundSetting,
        backgroundImage: params.backgroundImage,
        mainBrief: params.mainBrief,
        totalDurationSec: params.totalDurationSec,
        numScenes: params.numScenes,
        aspectRatio: params.aspectRatio,
        imageModel: params.imageModel,
        aiModel: params.aiModel,
        customAssets: params.customAssets,
      });

      const projectName = result.metadata?.title || params.productName || params.title || 'Studio Storyboard Project';

      const updatedProject: StudioProject = {
        ...project,
        id: `proj_${Date.now()}`,
        name: projectName,
        updatedAt: new Date().toISOString(),
        oneSheetGrid: undefined,
        compositeImageUrl: undefined,
        briefInputs: {
          productName: params.productName,
          productDescription: params.productDescription,
          productImage: params.productImage,
          modelTalent: params.modelTalent,
          modelImage: params.modelImage,
          backgroundSetting: params.backgroundSetting,
          backgroundImage: params.backgroundImage,
          mainBrief: params.mainBrief,
          totalDurationSec: params.totalDurationSec,
          numScenes: params.numScenes,
          customAssets: params.customAssets,
        },
        videoSource: {
          type: params.videoUrl ? 'url' : 'sample',
          urlOrFilename: params.videoUrl || params.productName || params.title || '',
          metadata: result.metadata,
        },
        analysis: result.analysis,
        scenes: result.scenes,
        aspectRatio: params.aspectRatio,
        imageModel: params.imageModel,
        aiModel: result.aiModel || params.aiModel || 'google/gemini-2.5-flash',
        compositeConfig: {
          ...project.compositeConfig,
          titleText: projectName.toUpperCase(),
        },
      };

      setProject(updatedProject);
      await saveStudioProjectToDb(updatedProject);
      refreshAccountsFromStorage();
      showNotice(`Analisis berhasil! Dibuat ${result.scenes.length} scene storyboard.`, 'success');
    } catch (err: any) {
      console.error('[Studio Analysis Error]:', err);
      setGlobalError(err.message || 'Gagal menganalisis video dengan Weavy AI.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle ATM (Amati, Tiru, Modifikasi) Remix Success
  const handleRemixSuccess = async (updatedProject: StudioProject) => {
    setProject(updatedProject);
    await saveStudioProjectToDb(updatedProject);
    refreshAccountsFromStorage();
    showNotice(`✨ Versi Baru Storyboard (${updatedProject.scenes.length} scene) berhasil dirancang dengan formula ATM!`, 'success');
  };

  // 2. Handle Single Scene Generation (Initiate + Poll)
  const handleGenerateSingleScene = async (sceneToGen: StudioScene) => {
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) =>
        s.id === sceneToGen.id ? { ...s, status: 'generating', errorMessage: undefined, progress: 10 } : s
      ),
    }));

    try {
      // 1. Initiate task to get task ID with reference image consistency
      const refImgs = collectStudioReferenceImages(project);
      const { recipeId, nodeId, taskId, accountUsed } = await initiateStudioSceneGeneration(
        sceneToGen,
        project.imageModel,
        project.aspectRatio,
        undefined,
        refImgs,
        project.briefInputs
      );

      refreshAccountsFromStorage();

      setProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === sceneToGen.id ? { ...s, progress: 25 } : s
        ),
      }));

      // 2. Poll completion
      const token = accountUsed.refreshToken || (accountUsed as any).token || accountUsed.accessToken || '';
      const finalUrl = await pollStudioTaskCompletion(
        recipeId,
        nodeId,
        taskId,
        token,
        (prog) => {
          setProject((prev) => ({
            ...prev,
            scenes: prev.scenes.map((s) =>
              s.id === sceneToGen.id ? { ...s, progress: prog } : s
            ),
          }));
        },
        {
          scene: sceneToGen,
          modelName: project.imageModel,
          aspectRatio: project.aspectRatio,
        }
      );

      setProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === sceneToGen.id
            ? {
                ...s,
                imageUrl: finalUrl,
                status: 'completed',
                progress: 100,
                generatedAt: new Date().toISOString(),
              }
            : s
        ),
      }));

      refreshAccountsFromStorage();
    } catch (err: any) {
      console.error(`[Studio Scene ${sceneToGen.sceneNumber} Error]:`, err);
      setProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === sceneToGen.id
            ? {
                ...s,
                status: 'failed',
                errorMessage: err.message || 'Gagal generate gambar',
                progress: 0,
              }
            : s
        ),
      }));
    }
  };

  // 3. Pipelined / Staggered Batch Generation:
  // "generate yang pertama ketika udah mendapatkan task id dari weavy lanjut ke yang berikutnya, begitu juga seterusnya jadi tidak usah menunggu satu selesai baru generate selanjutnya"
  const handleGenerateAllScenesPipelined = async () => {
    if (project.scenes.length === 0 || isDispatchingBatch) return;

    setIsDispatchingBatch(true);
    setGlobalError(null);

    const pendingScenes = project.scenes.filter((s) => s.status !== 'completed' || !s.imageUrl);
    const scenesToProcess = pendingScenes.length > 0 ? pendingScenes : project.scenes;

    showNotice(`Memulai pengiriman batch ${scenesToProcess.length} scene ke Weavy AI...`, 'info');

    for (let i = 0; i < scenesToProcess.length; i++) {
      const scene = scenesToProcess[i];

      // Mark scene as initiating
      setProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === scene.id ? { ...s, status: 'generating', errorMessage: undefined, progress: 15 } : s
        ),
      }));

      try {
        // Step A: Dispatch task to Weavy to obtain Task ID with reference image consistency
        const refImgs = collectStudioReferenceImages(project);
        const { recipeId, nodeId, taskId, accountUsed } = await initiateStudioSceneGeneration(
          scene,
          project.imageModel,
          project.aspectRatio,
          undefined,
          refImgs,
          project.briefInputs
        );

        // Update active accounts & credits locally
        refreshAccountsFromStorage();

        // Update scene to indicate task dispatched & polling started
        setProject((prev) => ({
          ...prev,
          scenes: prev.scenes.map((s) =>
            s.id === scene.id ? { ...s, progress: 25 } : s
          ),
        }));

        // Step B: Start background polling for THIS scene without blocking the loop!
        const token = accountUsed.refreshToken || (accountUsed as any).token || accountUsed.accessToken || '';
        pollStudioTaskCompletion(
          recipeId,
          nodeId,
          taskId,
          token,
          (prog) => {
            setProject((prev) => ({
              ...prev,
              scenes: prev.scenes.map((s) =>
                s.id === scene.id ? { ...s, progress: prog } : s
              ),
            }));
          },
          {
            scene,
            modelName: project.imageModel,
            aspectRatio: project.aspectRatio,
          }
        )
          .then((imageUrl) => {
            setProject((prev) => ({
              ...prev,
              scenes: prev.scenes.map((s) =>
                s.id === scene.id
                  ? {
                      ...s,
                      imageUrl,
                      status: 'completed',
                      progress: 100,
                      generatedAt: new Date().toISOString(),
                    }
                  : s
              ),
            }));
            refreshAccountsFromStorage();
          })
          .catch((pollErr) => {
            console.error(`[Scene ${scene.sceneNumber} Background Poll Error]:`, pollErr);
            setProject((prev) => ({
              ...prev,
              scenes: prev.scenes.map((s) =>
                s.id === scene.id
                  ? {
                      ...s,
                      status: 'failed',
                      errorMessage: pollErr.message || 'Gagal generate gambar',
                      progress: 0,
                    }
                  : s
              ),
            }));
          });

        // Brief delay (350ms) between task dispatches to prevent rate-limit bursts
        if (i < scenesToProcess.length - 1) {
          await new Promise((r) => setTimeout(r, 350));
        }
      } catch (dispatchErr: any) {
        console.error(`[Scene ${scene.sceneNumber} Dispatch Error]:`, dispatchErr);
        setProject((prev) => ({
          ...prev,
          scenes: prev.scenes.map((s) =>
            s.id === scene.id
              ? {
                  ...s,
                  status: 'failed',
                  errorMessage: dispatchErr.message || 'Gagal mengirim tugas ke Weavy',
                  progress: 0,
                }
              : s
          ),
        }));
      }
    }

    setIsDispatchingBatch(false);
    showNotice(`Semua ${scenesToProcess.length} scene berhasil dikirim! Gambar sedang diproses di background.`, 'success');
  };

  // 4. Update Scene Prompt
  const handleUpdatePrompt = (sceneId: string, newPrompt: string) => {
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => (s.id === sceneId ? { ...s, imagePrompt: newPrompt } : s)),
    }));
  };

  // 4b. Update Scene Video Prompt
  const handleUpdateVideoPrompt = (sceneId: string, newVideoPrompt: string) => {
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => (s.id === sceneId ? { ...s, videoPrompt: newVideoPrompt } : s)),
    }));
  };

  // 4c. Update entire project (e.g. from Master Visual Card)
  const handleUpdateProject = async (updated: StudioProject) => {
    setProject(updated);
    await saveStudioProjectToDb(updated);
  };

  // 4d. Copy All Scenes as Structured Storyboard Text matching user requested format
  const [copiedAllScenes, setCopiedAllScenes] = useState(false);
  const handleCopyAllScenesText = () => {
    if (project.scenes.length === 0) return;

    const voInstructionHeader = `[INSTRUKSIONAL KHUSUS GENERATOR VIDEO & VOICEOVER AI]
- NARRATION / VOICEOVER LANGUAGE: MUST BE STRICTLY 100% INDONESIAN (BAHASA INDONESIA SANTAI & NATURAL).
- ABSOLUTELY NO FOREIGN LANGUAGES, NO ENGLISH SPEECH, NO GIBBERISH, AND NO UNRELATED BACKGROUND CHATTER.
- SPEAK ONLY THE EXACT TEXT INSIDE QUOTES FOR VOICEOVER (VO). DO NOT NARRATE VISUAL DESCRIPTIONS OR TIMECODES.

==================================================

`;

    const scenesBody = project.scenes
      .map((s) => {
        const timecode = s.timecode || `00:00 - 00:${String(s.durationSec || 5).padStart(2, '0')} (Durasi: ${s.durationSec || 5} detik)`;
        return `${s.title.startsWith('Scene') ? s.title : `Scene ${s.sceneNumber}: ${s.title}`}
Timecode: ${timecode}
Arah Visual: ${s.visualDescription || s.sceneGoal || '-'}
${s.voiceover ? `Voiceover (VO) [Bahasa Indonesia]: "${s.voiceover}"\n` : ''}${s.onScreenText ? `Teks di Layar: ${s.onScreenText}\n` : ''}Prompt AI Image (${project.aspectRatio}):
${s.imagePrompt}
${s.videoPrompt ? `Prompt AI Video Motion:\n${s.videoPrompt}\n` : ''}`.trim();
      })
      .join('\n\n');

    const allText = voInstructionHeader + scenesBody;

    navigator.clipboard.writeText(allText);
    setCopiedAllScenes(true);
    showNotice('Semua scene berhasil disalin ke clipboard dengan instruksi Voiceover Bahasa Indonesia!', 'success');
    setTimeout(() => setCopiedAllScenes(false), 2500);
  };

  // 5. New Blank Project
  const handleNewProject = () => {
    const newProj: StudioProject = {
      id: `proj_${Date.now()}`,
      name: 'Proyek Storyboard Baru',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aspectRatio: '9:16',
      imageModel: 'GPT Image 2.5',
      scenes: [],
      compositeConfig: {
        gridColumns: 3,
        gridRows: 2,
        showBadges: true,
        showTitleBanner: true,
        titleText: 'STORYBOARD CAMPAIGN',
        borderColor: '#0A0A0E',
        borderWidth: 16,
        padding: 24,
        aspectRatio: '16:9',
      },
    };
    setProject(newProj);
    showNotice('Proyek baru dibuat. Silakan masukkan video atau prompt baru.', 'info');
  };

  const completedCount = project.scenes.filter((s) => s.imageUrl && s.status === 'completed').length;
  const isAnySceneGenerating = project.scenes.some((s) => s.status === 'generating') || isDispatchingBatch;

  return (
    <div className="w-full h-screen max-h-screen bg-[#E2DFD8] dark:bg-[#09090B] text-stone-900 dark:text-stone-100 flex overflow-hidden font-sans select-none overscroll-none transition-colors duration-200">
      {/* Mobile Sidebar Backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* 1. STUDIO LEFT SIDEBAR */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 md:z-20 ${
          isSidebarCollapsed ? 'w-18' : 'w-64'
        } bg-[#ECE9E3] dark:bg-[#0E0E12] border-r border-stone-300 dark:border-white/8 flex flex-col justify-between h-full shrink-0 select-none transition-all duration-200 ${
          isMobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top: Studio Header Brand & Menus */}
        <div className="p-3.5 space-y-4 overflow-y-auto no-scrollbar">
          {/* Studio Brand Header */}
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} gap-2 px-1`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-sm shadow-amber-500/10">
                <Clapperboard className="w-4.5 h-4.5" />
              </div>
              {!isSidebarCollapsed && (
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-serif-display text-base font-bold text-stone-900 dark:text-stone-100 tracking-tight leading-none truncate">
                      Studio
                    </h2>
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px] font-extrabold tracking-wider uppercase">
                      Suite
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400 font-sans mt-0.5 truncate">
                    Creative Modul
                  </p>
                </div>
              )}
            </div>

            {/* Mobile close button */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Shortcut: Kembali ke App Utama */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className={`w-full flex items-center ${
                isSidebarCollapsed ? 'justify-center' : 'gap-2 px-2.5'
              } py-2 rounded-lg text-xs font-semibold text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white bg-stone-200/60 dark:bg-[#1B1B22]/80 hover:bg-stone-200 dark:hover:bg-[#22222B] border border-stone-300/80 dark:border-white/10 active:scale-98 transition-all cursor-pointer`}
              title="Kembali ke AMB Media"
            >
              <ArrowLeft className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              {!isSidebarCollapsed && <span>Kembali ke AMB Media</span>}
            </button>
          )}

          {/* Divider */}
          <div className="h-px bg-stone-300/80 dark:bg-white/8 my-1" />

          {/* MENU STUDIO SECTION */}
          <div>
            {!isSidebarCollapsed ? (
              <div className="px-2 mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Menu Studio
                </span>
                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded font-semibold">
                  2 Modul
                </span>
              </div>
            ) : (
              <div className="w-full text-center mb-2">
                <span className="text-[9px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-tighter">
                  Menu
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              {STUDIO_MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeSubMenu === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveSubMenu(item.id);
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center ${
                      isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2.5'
                    } rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none ${
                      isActive
                        ? 'bg-stone-200/90 dark:bg-amber-500/15 border-stone-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 font-bold shadow-sm'
                        : 'border-transparent text-stone-700 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/60 dark:hover:bg-white/5'
                    }`}
                    title={item.label}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                            : 'bg-stone-200/70 dark:bg-stone-800/80 text-stone-500 dark:text-stone-400'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      {!isSidebarCollapsed && (
                        <div className="text-left truncate">
                          <p className="leading-tight text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                            {item.label}
                          </p>
                          <p className="text-[10px] text-stone-500 dark:text-stone-400 font-normal truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        </div>
                      )}
                    </div>

                    {!isSidebarCollapsed && item.badge && (
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase shrink-0 ml-1 ${
                          isActive
                            ? 'bg-amber-500 text-stone-950 shadow-xs'
                            : 'bg-stone-200 dark:bg-stone-800 text-stone-500'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom: Project Status Info & Collapse Toggle */}
        <div className="p-3 border-t border-stone-300 dark:border-white/8 space-y-2">
          {!isSidebarCollapsed && activeSubMenu === 'storyboard' && (
            <div className="p-2.5 rounded-xl bg-stone-100/80 dark:bg-[#141418] border border-stone-300/70 dark:border-white/10 text-xs space-y-1.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase">
                  Proyek Aktif
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                  {project.aspectRatio}
                </span>
              </div>
              <p className="font-semibold text-stone-900 dark:text-stone-100 truncate text-[11px]">
                {project.name || 'Proyek Tanpa Judul'}
              </p>
              <div className="flex items-center justify-between text-[10px] text-stone-500 dark:text-stone-400 pt-0.5">
                <span>Progress Scene:</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  {completedCount}/{project.scenes.length} Selesai
                </span>
              </div>
            </div>
          )}

          {/* Collapse / Expand Toggle Button on Desktop */}
          <button
            type="button"
            onClick={toggleSidebarCollapse}
            className={`hidden md:flex w-full items-center ${
              isSidebarCollapsed ? 'justify-center' : 'justify-between px-2.5'
            } py-1.5 rounded-lg text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/70 dark:hover:bg-[#1B1B22] text-xs transition-colors cursor-pointer`}
            title={isSidebarCollapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
          >
            <div className="flex items-center gap-2">
              {isSidebarCollapsed ? (
                <PanelLeft className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              ) : (
                <PanelLeftClose className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              )}
              {!isSidebarCollapsed && <span>Ciutkan Sidebar</span>}
            </div>
          </button>
        </div>
      </aside>

      {/* 2. RIGHT MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* DEDICATED TOP HEADER */}
        <header className="h-14 border-b border-stone-300 dark:border-white/8 bg-[#ECE9E3]/95 dark:bg-[#0E0E12]/95 backdrop-blur-md px-3 sm:px-5 flex items-center justify-between shrink-0 z-30 select-none transition-colors duration-200">
          {/* Left: Mobile sidebar toggle + Desktop toggle + Active Menu Header */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Mobile Hamburger toggle */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-stone-700 dark:text-stone-300 hover:bg-stone-200/80 dark:hover:bg-[#1B1B22] border border-stone-300 dark:border-white/10 cursor-pointer"
              title="Buka Menu Studio"
              aria-label="Buka Menu Studio"
            >
              <Menu className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </button>

            {/* Desktop uncollapse button if collapsed */}
            {isSidebarCollapsed && (
              <button
                type="button"
                onClick={toggleSidebarCollapse}
                className="hidden md:flex p-2 rounded-lg text-stone-700 dark:text-stone-300 hover:bg-stone-200/80 dark:hover:bg-[#1B1B22] border border-stone-300 dark:border-white/10 cursor-pointer"
                title="Buka Sidebar Studio"
              >
                <PanelLeft className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </button>
            )}

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-sm shadow-amber-500/10">
                {activeSubMenu === 'talent' ? (
                  <UserCheck className="w-4.5 h-4.5" />
                ) : (
                  <Film className="w-4.5 h-4.5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 tracking-tight leading-none font-serif-display">
                    {activeSubMenu === 'talent' ? 'AI Talent Studio' : 'Storyboard'}
                  </h1>
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-extrabold text-amber-600 dark:text-amber-300">
                    WEAVY AI
                  </span>
                </div>
                <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate max-w-[140px] sm:max-w-xs mt-0.5">
                  {activeSubMenu === 'talent'
                    ? 'Virtual Model & Product Actor'
                    : (project.name || 'Video Analyzer & Storyboard')}
                </p>
              </div>
            </div>
          </div>

        {/* Right Controls: Account Switcher & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Weavy Account Dropdown & Credit Badge */}
          {activeAccount && (
            <div className="relative" ref={dropdownRef}>
              <div className="flex items-center gap-1">
                {/* Account Name Dropdown Button */}
                <button
                  type="button"
                  onClick={() => setIsAccountDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-[#1B1B22] hover:bg-stone-200 dark:hover:bg-[#22222B] border border-stone-300 dark:border-white/10 text-xs text-stone-800 dark:text-stone-200 transition-all cursor-pointer"
                  title="Pilih akun Weavy"
                >
                  <div className="w-4 h-4 rounded-full bg-amber-500 text-stone-950 font-bold text-[9px] flex items-center justify-center shrink-0">
                    {(activeAccount.name || activeAccount.email || 'W').charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden md:inline truncate max-w-[100px] text-xs font-medium">
                    {activeAccount.name || (activeAccount.email ? activeAccount.email.split('@')[0] : 'Weavy')}
                  </span>
                  <ChevronDown className="w-3 h-3 text-stone-500 dark:text-stone-400" />
                </button>

                {/* Credit Balance Pill & Auto-Sync */}
                <button
                  type="button"
                  onClick={handleSyncCredits}
                  disabled={isSyncingCredits}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-xs font-semibold text-amber-600 dark:text-amber-300 transition-all cursor-pointer group select-none"
                  title={`Sisa kredit akun aktif (${activeAccount.email || 'Weavy'}). Klik untuk sinkronisasi.`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 ${
                      isSyncingCredits ? 'animate-ping' : 'animate-pulse'
                    }`}
                  />
                  <span className="font-mono text-xs">
                    {typeof activeAccount.credits === 'number' ? activeAccount.credits : 0}
                  </span>
                  <span className="hidden sm:inline text-[10px] text-amber-600 dark:text-amber-400/80 font-normal">CR</span>
                  <RefreshCw
                    className={`w-3 h-3 text-amber-600 dark:text-amber-400 group-hover:rotate-180 transition-transform ${
                      isSyncingCredits ? 'animate-spin' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Account Dropdown Menu */}
              {isAccountDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl bg-[#FAF9F6] dark:bg-[#141418] border border-stone-300 dark:border-white/10 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-2 py-1.5 border-b border-stone-200 dark:border-white/10 mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">Akun Weavy Terdaftar</span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">{accounts.length} Akun</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {accounts.map((acc) => {
                      const isSel = acc.id === activeAccount.id;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => handleSelectAccount(acc.id)}
                          className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors cursor-pointer ${
                            isSel
                              ? 'bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-semibold'
                              : 'hover:bg-stone-200/70 dark:hover:bg-[#1B1B22] text-stone-700 dark:text-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate text-left">
                            <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {(acc.name || acc.email || 'W').charAt(0).toUpperCase()}
                            </div>
                            <div className="truncate">
                              <p className="font-semibold truncate">{acc.name || acc.email}</p>
                              <p className="text-[10px] text-stone-400 dark:text-stone-500 truncate">{acc.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <span className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
                              {acc.credits ?? 0}
                            </span>
                            <span className="text-[9px] text-stone-400">CR</span>
                            {isSel && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 ml-1" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {onNavigateToSettings && (
                    <div className="pt-1.5 mt-1 border-t border-stone-200 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAccountDropdownOpen(false);
                          onNavigateToSettings();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 p-1.5 rounded-lg text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/70 dark:hover:bg-[#1B1B22] transition-all cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        Kelola Akun di Settings
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Storyboard Actions (Only active/visible when on Storyboard tab) */}
          {activeSubMenu === 'storyboard' && (
            <>
              {/* New Project Button */}
              <button
                type="button"
                onClick={handleNewProject}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-[#1B1B22] hover:bg-stone-200 dark:hover:bg-[#22222B] text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-white/10 text-xs font-medium active:scale-95 transition-all cursor-pointer"
                title="Mulai Proyek Storyboard Baru"
              >
                <Plus className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="hidden sm:inline">Baru</span>
              </button>

              {/* Project History Modal Button */}
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-[#1B1B22] hover:bg-stone-200 dark:hover:bg-[#22222B] border border-stone-300 dark:border-white/10 text-xs text-stone-800 dark:text-stone-200 font-medium transition-all cursor-pointer"
                title="Buka Riwayat Proyek Studio"
              >
                <Folder className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="hidden sm:inline">Riwayat</span>
              </button>

              {/* 1-Sheet Composite Grid Button */}
              <button
                type="button"
                onClick={() => setIsCompositeModalOpen(true)}
                disabled={project.scenes.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 text-xs font-bold shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                title="Generate & Export 1-Sheet Storyboard Composite Grid"
              >
                <Grid className="w-3.5 h-3.5" />
                <span className="hidden md:inline">1-Sheet Composite</span>
                {project.scenes.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-md bg-stone-950/20 text-stone-950 text-[10px] font-extrabold ml-0.5">
                    {completedCount}/{project.scenes.length}
                  </span>
                )}
              </button>
            </>
          )}

          {/* Dark Mode Toggle if provided */}
          {onToggleDarkMode && (
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="p-2 rounded-lg text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/80 dark:hover:bg-[#1B1B22] active:scale-95 transition-all cursor-pointer"
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          )}
        </div>
      </header>

      {/* 2. TOAST NOTIFICATION BANNER */}
      {statusNotice && (
        <div
          className={`px-4 py-2 text-xs font-semibold flex items-center justify-between border-b animate-in slide-in-from-top duration-200 shrink-0 ${
            statusNotice.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/30'
              : statusNotice.type === 'warning'
              ? 'bg-amber-950/90 text-amber-200 border-amber-500/30'
              : 'bg-stone-100 dark:bg-[#141418] text-stone-800 dark:text-stone-200 border-stone-300 dark:border-white/10'
          }`}
        >
          <div className="flex items-center gap-2 mx-auto">
            {statusNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            ) : statusNotice.type === 'warning' ? (
              <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            ) : (
              <Info className="w-4 h-4 text-sky-500 dark:text-sky-400" />
            )}
            <span>{statusNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-stone-400 hover:text-stone-800 dark:hover:text-white p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. MAIN SCROLLABLE WORKSPACE */}
      {activeSubMenu === 'talent' ? (
        <div className="flex-1 overflow-hidden">
          <StudioTalentCard
            activeAccountId={activeAccount?.id}
            onSendToCanvas={onNavigateToCanvas}
            onSuccessToast={(msg) => showNotice(msg, 'success')}
          />
        </div>
      ) : activeSubMenu === 'character-sheet' ? (
        <div className="flex-1 overflow-hidden">
          <StudioCharacterSheetCard
            activeAccountId={activeAccount?.id}
            onSendToCanvas={onNavigateToCanvas}
            onSuccessToast={(msg) => showNotice(msg, 'success')}
          />
        </div>
      ) : (
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 space-y-6 max-w-[1720px] mx-auto w-full">
        {/* Global Error Banner */}
        {globalError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-800 dark:text-rose-200 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-bold text-sm text-rose-900 dark:text-rose-100">Terjadi Kesalahan</p>
              <p className="mt-0.5 text-rose-800/90 dark:text-rose-200/90 leading-relaxed">{globalError}</p>
            </div>
            <button
              type="button"
              onClick={() => setGlobalError(null)}
              className="text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-200 p-1 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Section A: Video Ingestion & AI LLM Extraction Form */}
        <section>
          <StudioVideoIngestCard
            onAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing}
            defaultAspectRatio={project.aspectRatio}
            defaultImageModel={project.imageModel}
            defaultAiModel={project.aiModel || 'google/gemini-2.5-flash'}
          />
        </section>

        {/* Section B: Marketing Strategy & Hook Breakdown */}
        {project.analysis && (
          <section className="space-y-4">
            <StudioAnalysisCard
              analysis={project.analysis}
              metadata={project.videoSource?.metadata}
              aiModel={project.aiModel}
            />

            {/* ATM Remix Engine: Rancang Versi Baru dengan Durasi & Karakter Kustom */}
            <StudioAtmRemixCard
              project={project}
              onRemixSuccess={handleRemixSuccess}
              onSuccessToast={(msg) => showNotice(msg, 'success')}
              onErrorToast={(msg) => showNotice(msg, 'warning')}
            />
          </section>
        )}

        {/* Section B2: Master Production Sheet (Peta Visual Produksi 16:9 World Bible) */}
        {(project.analysis || project.scenes.length > 0) && (
          <section>
            <StudioMasterVisualCard
              project={project}
              onUpdateProject={handleUpdateProject}
              onGenerateAllScenes={handleGenerateAllScenesPipelined}
              onSuccessToast={(msg) => showNotice(msg, 'success')}
              isDispatchingScenes={isDispatchingBatch || isAnySceneGenerating}
            />
          </section>
        )}

        {/* Section C: Storyboard Scene Grid & Pipelined Batch Dispatcher */}
        {project.scenes.length > 0 && (
          <section className="space-y-4">
            {/* Storyboard Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF9F6] dark:bg-[#141418] border border-stone-300 dark:border-white/10 p-4 rounded-2xl shadow-xs sm:shadow-sm transition-colors duration-200">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 font-serif-display">
                    <LayoutGrid className="w-4.5 h-4.5 text-amber-500 dark:text-amber-400" />
                    Storyboard Scenes Breakdown
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-300 font-extrabold text-xs">
                    {completedCount}/{project.scenes.length} Selesai
                  </span>
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 font-sans-body">
                  Model Gambar:{' '}
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">{project.imageModel}</span> (Aspek {project.aspectRatio}) • Format Prompt Weavy AI
                </p>
              </div>

              {/* Action Buttons: Batch Generate, Composite, Export ZIP */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Pipelined Batch Generate Button */}
                <button
                  type="button"
                  onClick={handleGenerateAllScenesPipelined}
                  disabled={isDispatchingBatch || isAnySceneGenerating}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                  title="Generate semua scene secara berurutan tanpa menunggu polling selesai"
                >
                  {isDispatchingBatch ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengirim Tugas Batch...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>{completedCount === project.scenes.length ? 'Generate Ulang Semua' : '⚡ Generate Semua Scene'}</span>
                    </>
                  )}
                </button>

                {/* 1-Sheet Storyboard Modal Trigger */}
                <button
                  type="button"
                  onClick={() => setIsCompositeModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-[#1B1B22] hover:bg-stone-200 dark:hover:bg-[#22222B] text-stone-800 dark:text-stone-200 font-semibold text-xs border border-stone-300 dark:border-white/10 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  title="Generate 1x seluruh prompt & referensi visual ke format 1-Sheet Grid 16:9"
                >
                  <Grid className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span>1-Sheet Grid</span>
                </button>

                {/* Copy All Scenes Text */}
                <button
                  type="button"
                  onClick={handleCopyAllScenesText}
                  className="px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-[#1B1B22] hover:bg-stone-200 dark:hover:bg-[#22222B] text-stone-800 dark:text-stone-200 font-semibold text-xs border border-stone-300 dark:border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Salin semua scene dalam format terstruktur ke clipboard"
                >
                  {copiedAllScenes ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                      <span className="hidden sm:inline">Salin Semua Scene</span>
                      <span className="sm:hidden">Salin</span>
                    </>
                  )}
                </button>

                {/* Toggle All Prompts */}
                <button
                  type="button"
                  onClick={() => setShowAllPrompts((prev) => !prev)}
                  className="px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-[#1B1B22] hover:bg-stone-200 dark:hover:bg-[#22222B] text-stone-800 dark:text-stone-200 font-semibold text-xs border border-stone-300 dark:border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
                  title={showAllPrompts ? 'Sembunyikan semua prompt gambar di setiap scene' : 'Tampilkan semua prompt gambar di setiap scene'}
                >
                  {showAllPrompts ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                      <span className="hidden sm:inline">Tutup Prompt</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                      <span className="hidden sm:inline">Lihat Prompt</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Scenes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {project.scenes.map((scene) => (
                <StudioSceneCard
                  key={scene.id}
                  scene={scene}
                  imageModel={project.imageModel}
                  aspectRatio={project.aspectRatio}
                  onUpdatePrompt={handleUpdatePrompt}
                  onUpdateVideoPrompt={handleUpdateVideoPrompt}
                  onGenerate={handleGenerateSingleScene}
                  onOpenZoom={(url, title) => setZoomModal({ open: true, url, title })}
                  isGeneratingAny={isAnySceneGenerating}
                  globalExpandPrompts={showAllPrompts}
                />
              ))}
            </div>
          </section>
        )}
      </main>
      )}

      {/* 4. MODALS */}
      {/* 1-Sheet Storyboard Composite Modal */}
      {isCompositeModalOpen && (
        <StudioCompositeModal
          project={project}
          isOpen={isCompositeModalOpen}
          onClose={() => setIsCompositeModalOpen(false)}
          onUpdateProject={(updated) => {
            setProject(updated);
            saveStudioProjectToDb(updated);
          }}
          onSendToCanvas={(urls) => {
            setIsCompositeModalOpen(false);
            onNavigateToCanvas?.(urls);
          }}
        />
      )}

      {/* Project History Modal */}
      {isHistoryModalOpen && (
        <StudioProjectHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          onSelectProject={(selected) => {
            setProject(selected);
            setIsHistoryModalOpen(false);
            showNotice(`Proyek "${selected.name}" dimuat.`, 'info');
          }}
          activeProjectId={project.id}
          currentProjectId={project.id}
          onNewProject={handleCreateNewProject}
          onDeleteProject={(deletedId) => {
            if (project.id === deletedId) {
              handleCreateNewProject();
            }
          }}
        />
      )}

      {/* Zoom Lightbox Modal */}
      {zoomModal.open && (
        <div
          className="fixed inset-0 z-50 bg-black/75 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setZoomModal({ open: false, url: '', title: '' })}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-[#FAF9F6] dark:bg-[#141418] rounded-2xl overflow-hidden border border-stone-300 dark:border-white/10 p-2 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-stone-200 dark:border-white/10">
              <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate max-w-md">{zoomModal.title}</h4>
              <button
                type="button"
                onClick={() => setZoomModal({ open: false, url: '', title: '' })}
                className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/70 dark:hover:bg-[#1B1B22] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-2">
              <img
                src={zoomModal.url}
                alt={zoomModal.title}
                className="max-h-[75vh] w-auto object-contain rounded-xl shadow-lg border border-stone-200 dark:border-white/10"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="p-3 border-t border-stone-200 dark:border-white/10 flex justify-end gap-2">
              <a
                href={zoomModal.url}
                target="_blank"
                rel="noreferrer"
                download="scene_image.png"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh Gambar Asli
              </a>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
