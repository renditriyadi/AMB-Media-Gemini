import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GEMINI_MAX_CREDITS } from '../lib/provider';
import { dedupeStoryboardScenes } from '../lib/storyboardScenes';
import {
  CanvasNode,
  CanvasEdge,
  CanvasRecipe,
  CanvasGroup,
  CanvasFile,
  WEAVY_IMAGE_MODELS,
  getNodeWidth,
  getPortCoordinate as getCanvasPortCoordinate,
  getStoryboardOutputs,
  getStoryboardPlannedSceneCount,
  getAiWorkerOutputs,
  getAiWorkerPortValue,
} from '../types/canvas';
import {
  createEmptyCanvasRecipe,
  formatSceneVideoPrompt,
  resolveModelInputs,
  resolveEnhancerInputs,
  resolveStitcherInputs,
} from '../lib/canvasRecipes';
import { expandChatPreset } from './chat/chatPresets';
import { getMasterDirectorSystemPrompt } from '../../ektension-weavy/js/chat/context-builder.js';
import { runAiWorkerExtraction } from '../lib/ecommerceWorker';
import { extractStoryboardProjectFromData } from './chat/ChatStoryboardCopilotCard';
import {
  acquireGeminiAccountLease,
  buildGeminiPayloadAccounts,
  getGeminiAccounts,
  type GeminiAccountLease,
} from '../lib/geminiAccountManager';
import { planCanvasGeminiAccountAssignments } from '../lib/canvasGeminiAccountPlanner';
import { executeGeminiVideoWithAutoSwitchAndRetry } from '../lib/geminiVideoRunner';
import {
  loadAllCanvasFiles,
  createNewCanvasFile,
  updateCanvasFile,
  duplicateCanvasFile,
  deleteCanvasFile,
  restoreCanvasFile,
  isDefaultPresetRecipe,
  deleteAllEmptyCanvasFiles,
} from '../lib/canvasFileManager';
import { CanvasDashboard } from './canvas/CanvasDashboard';
import { CanvasNodeCard } from './canvas/CanvasNodeCard';
import { CanvasGroupCard } from './canvas/CanvasGroupCard';
import { CanvasWires } from './canvas/CanvasWires';
import { CanvasInspectorPanel } from './canvas/CanvasInspectorPanel';
import { ImportWeavyModal } from './canvas/ImportWeavyModal';
import { CanvasPreviewModal } from './canvas/CanvasPreviewModal';
import { CanvasMarkupModal } from './canvas/CanvasMarkupModal';
import { CanvasContextMenu, CanvasNodeType } from './canvas/CanvasContextMenu';
import {
  Sparkles,
  Plus,
  Download,
  Share2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Upload,
  AlertCircle,
  HelpCircle,
  Layers,
  ChevronDown,
  LayoutGrid,
  ArrowLeft,
  Sun,
  Moon,
  RefreshCw,
  MousePointer2,
  Hand,
  StickyNote,
  Undo2,
  Redo2,
  Check,
  Copy,
  Trash2,
  Pencil,
  Play,
  Square,
  Loader2,
} from 'lucide-react';
import { GenerationItem, getCleanModelName } from '../types';
import { exchangeRefreshTokenAndGetInfo } from '../lib/weavy';
import { extensionBridge } from '../lib/extensionBridge';
import {
  buildWeavyStoryboardContext,
} from '../lib/weavyPrompts';
import { postProcessWeavyResponse } from '../lib/weavyAgent/chatTurn';
import { buildStoryboardDirectorSystemPrompt } from '../lib/storyboardDirector';

interface CanvasViewProps {
  weavyToken?: string;
  refreshToken?: string;
  weavyCredits?: number;
  activeAccountId?: string;
  workspaceName?: string;
  userAvatarInitial?: string;
  onAddGeneration?: (item: GenerationItem) => void;
  onRefreshCredits?: (usedAccount?: any) => void;
  onSelectWeavyAccount?: (accId: string) => void;
  onBack?: () => void;
  onNavigateHistory?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: (e?: React.MouseEvent) => void;
}

// Tipe node yang punya aksi "Run" (dipakai oleh Run Selected)
const RUNNABLE_NODE_TYPES: string[] = ['aiWorker', 'storyboard', 'promptEnhancer', 'anyLLM', 'imageModel', 'geminiVideo', 'vidsVideo', 'videoStitcher'];

const getAiWorkerAnalysisSignature = (
  node: CanvasNode,
  linkText: string,
  noteText: string
): string => {
  const data = node.data || {};
  if (
    node.type !== 'aiWorker' ||
    data.status !== 'completed' ||
    data.isSample === true ||
    !data.contextText?.trim() ||
    data.processedLinkText !== linkText ||
    data.processedNoteText !== noteText
  ) {
    return '';
  }

  return JSON.stringify({
    linkText,
    noteText,
    contextText: data.contextText,
    selectedImageUrls: data.selectedImageUrls || [],
  });
};

// Tipe node yang punya data hasil / input yang bisa di-reset (Prompt & Sticky Note sengaja tidak termasuk,
// karena isinya tulisan manual user, bukan hasil generate).
const RESETTABLE_NODE_TYPES: string[] = [
  'imageInput',
  'aiWorker',
  'storyboard',
  'promptEnhancer',
  'anyLLM',
  'imageModel',
  'geminiVideo',
  'vidsVideo',
  'videoStitcher',
  'imageViewer',
];

/**
 * Mengembalikan `data` node yang sudah dibersihkan dari input gambar & hasil generate.
 * Setting node (model, seed, aspect ratio, resolusi, prompt override, brief, dsb) dipertahankan.
 * HANYA data yang disentuh: `inputs`, `outputs`, dan `edges` (kabel) tidak diubah sama sekali.
 */
const getResetNodeData = (node: CanvasNode): any => {
  const d = { ...(node.data || {}) };
  const clearRun = {
    status: 'idle',
    progress: 0,
    errorMessage: undefined,
  };
  switch (node.type) {
    case 'imageInput':
      return {
        ...d,
        imageUrl: undefined,
        videoUrl: undefined,
        mediaType: undefined,
        fileName: undefined,
        naturalWidth: undefined,
        naturalHeight: undefined,
        aspectRatio: undefined,
      };
    case 'imageModel':
      return {
        ...d,
        ...clearRun,
        inputImageUrl: undefined,
        outputImage: undefined,
        resultUrl: undefined,
        naturalWidth: undefined,
        naturalHeight: undefined,
      };
    case 'geminiVideo':
      return {
        ...d,
        ...clearRun,
        inputImageUrl: undefined,
        inputPrompt: undefined,
        outputVideo: undefined,
        resultUrl: undefined,
        videoUrl: undefined,
        operationName: undefined,
        naturalWidth: undefined,
        naturalHeight: undefined,
      };
    case 'vidsVideo':
      return {
        ...d,
        ...clearRun,
        inputPrompt: undefined,
        outputVideo: undefined,
        resultUrl: undefined,
        videoUrl: undefined,
        naturalWidth: undefined,
        naturalHeight: undefined,
      };
    case 'videoStitcher':
      return {
        ...d,
        ...clearRun,
        inputVideos: undefined,
        outputVideo: undefined,
        resultUrl: undefined,
        videoUrl: undefined,
        duration: undefined,
        naturalWidth: undefined,
        naturalHeight: undefined,
      };
    case 'imageViewer':
      return {
        ...d,
        ...clearRun,
        resultUrl: undefined,
        coverUrl: undefined,
        promptSnippet: undefined,
        executionTime: undefined,
      };
    case 'promptEnhancer':
      return {
        ...d,
        ...clearRun,
        inputPrompt: undefined,
        inputImageUrl: undefined,
        enhancedPrompt: undefined,
        generations: undefined,
      };
    case 'anyLLM':
      return {
        ...d,
        ...clearRun,
        inputPrompt: undefined,
        inputImageUrl: undefined,
        inputImageUrls: undefined,
        enhancedPrompt: undefined,
        generatedText: undefined,
        generations: undefined,
      };
    case 'aiWorker':
      // linkText & note (input manual user) dipertahankan; hasil ekstraksi dibersihkan.
      return {
        ...d,
        ...clearRun,
        product: undefined,
        verified: undefined,
        contextText: undefined,
        galleryUrls: undefined,
        selectedImageUrls: undefined,
        processedLinkText: undefined,
        processedNoteText: undefined,
        storyboardAnalysis: undefined,
        storyboardAnalysisSignature: undefined,
        isSample: undefined,
      };
    case 'storyboard': {
      const next: any = {
        ...d,
        ...clearRun,
        scenes: undefined,
        projectTitle: undefined,
        generatedPresetKey: undefined,
        rawJson: undefined,
        activeTab: 0,
        productAnalysisStatus: undefined,
      };
      // Port output Storyboard diturunkan dari data (jumlah scene / durasi). Supaya kabel yang
      // sudah tersambung ke scene terakhir tidak kehilangan port-nya setelah scenes dikosongkan,
      // pastikan jumlah port rencana minimal sama dengan jumlah scene sebelumnya.
      const prevSceneCount = dedupeStoryboardScenes(d.scenes).length;
      if (prevSceneCount > 0 && getStoryboardPlannedSceneCount(next) < prevSceneCount) {
        next.targetDuration = prevSceneCount * 10;
      }
      return next;
    }
    default:
      return d;
  }
};

export const CanvasView: React.FC<CanvasViewProps> = ({
  weavyToken,
  refreshToken,
  weavyCredits = 150,
  activeAccountId,
  workspaceName = 'Tempat Fashion',
  userAvatarInitial = 'T',
  onAddGeneration,
  onRefreshCredits,
  onSelectWeavyAccount,
  onBack,
  onNavigateHistory,
  isDarkMode,
  onToggleDarkMode,
}) => {
  // Canvas Files Management (Weavy-style My Files Dashboard)
  const [files, setFiles] = useState<CanvasFile[]>(() => loadAllCanvasFiles());
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);

  const activeFile = useMemo(() => {
    return files.find((f) => f.id === currentFileId) || null;
  }, [files, currentFileId]);

  // Master Recipe State
  const [recipe, setRecipe] = useState<CanvasRecipe>(() => {
    try {
      const saved = localStorage.getItem('amb_media_canvas_recipe');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.nodes && parsed?.edges && !isDefaultPresetRecipe(parsed)) {
          return parsed;
        } else {
          localStorage.removeItem('amb_media_canvas_recipe');
        }
      }
    } catch (e) {}
    return createEmptyCanvasRecipe('untitled');
  });
  const [geminiAccountsRevision, setGeminiAccountsRevision] = useState(0);
  const geminiAccountAssignments = useMemo(() => {
    let activeGeminiAccountId: string | null = null;
    try {
      activeGeminiAccountId = localStorage.getItem('gemini_active_account_id');
    } catch (error) {
      console.warn('[Canvas] Could not read the active Gemini account:', error);
    }
    return planCanvasGeminiAccountAssignments(
      recipe.nodes,
      getGeminiAccounts(),
      activeGeminiAccountId
    );
  }, [recipe.nodes, geminiAccountsRevision]);

  useEffect(() => {
    const refreshGeminiAccounts = () => setGeminiAccountsRevision((revision) => revision + 1);
    window.addEventListener('gemini_accounts_updated', refreshGeminiAccounts);
    window.addEventListener('accounts-updated', refreshGeminiAccounts);
    window.addEventListener('storage', refreshGeminiAccounts);
    return () => {
      window.removeEventListener('gemini_accounts_updated', refreshGeminiAccounts);
      window.removeEventListener('accounts-updated', refreshGeminiAccounts);
      window.removeEventListener('storage', refreshGeminiAccounts);
    };
  }, []);

  // Active Canvas Tool: 'select' (Move/Select) or 'pan' (Hand)
  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select');

  // History Stacks for Undo / Redo
  const [undoStack, setUndoStack] = useState<CanvasRecipe[]>([]);
  const [redoStack, setRedoStack] = useState<CanvasRecipe[]>([]);
  const dragSnapshotRef = useRef<CanvasRecipe | null>(null);

  // Zoom Popover Dropdown
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const zoomMenuRef = useRef<HTMLDivElement>(null);

  // Helper to record history before mutating recipe
  const recordHistory = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-30), JSON.parse(JSON.stringify(recipe))]);
    setRedoStack([]);
  }, [recipe]);

  // Undo Handler
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, JSON.parse(JSON.stringify(recipe))]);
    setUndoStack((prev) => prev.slice(0, -1));
    setRecipe(previous);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
  }, [undoStack, recipe]);

  // Redo Handler
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, JSON.parse(JSON.stringify(recipe))]);
    setRedoStack((prev) => prev.slice(0, -1));
    setRecipe(next);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
  }, [redoStack, recipe]);

  // Close Zoom Menu on Click Outside
  useEffect(() => {
    if (!isZoomMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (zoomMenuRef.current && !zoomMenuRef.current.contains(e.target as Node)) {
        setIsZoomMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isZoomMenuOpen]);

  // Multi-Selection State for Group Dragging
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Exactly ONE node selected -> selectedNodeId. If 0 or >1 nodes selected (Select All / Multi-select) -> null
  const selectedNodeId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;
  const setSelectedNodeId = (id: string | null) => {
    setSelectedNodeIds(id ? [id] : []);
    if (id) {
      const node = recipe.nodes.find((n) => n.id === id);
      if (node?.type === 'imageModel' || node?.type === 'geminiVideo' || node?.type === 'vidsVideo' || node?.type === 'videoStitcher' || node?.type === 'anyLLM' || node?.type === 'promptEnhancer' || node?.type === 'storyboard') {
        setIsInspectorOpen(true);
      }
    } else {
      setIsInspectorOpen(false);
    }
  };
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const selectedNode = useMemo(
    () => (selectedNodeId ? recipe.nodes.find((n) => n.id === selectedNodeId) || null : null),
    [recipe.nodes, selectedNodeId]
  );

  // Auto-open Inspector panel ONLY when exactly ONE inspectable node is selected.
  // When multiple nodes are selected (> 1) or Select All is active, do NOT trigger active node settings.
  useEffect(() => {
    if (selectedNodeIds.length === 1) {
      const singleId = selectedNodeIds[0];
      const node = recipe.nodes.find((n) => n.id === singleId);
      if (
        node &&
        (node.type === 'imageModel' ||
          node.type === 'geminiVideo' ||
          node.type === 'vidsVideo' ||
          node.type === 'videoStitcher' ||
          node.type === 'anyLLM' ||
          node.type === 'promptEnhancer' ||
          node.type === 'storyboard')
      ) {
        setIsInspectorOpen(true);
      }
    } else if (selectedNodeIds.length > 1) {
      // Suppress inspector settings panel when multiple nodes or select-all are active
      setIsInspectorOpen(false);
    }
  }, [selectedNodeIds, recipe.nodes]);

  // Pan & Zoom
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const setCanvasContainerRef = useCallback((node: HTMLDivElement | null) => {
    canvasContainerRef.current = node;
    setContainerEl(node);
  }, []);

  // Spacebar Quick Pan State (Space + Left Click Drag)
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const isSpacePressedRef = useRef(false);
  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Group / Node Dragging
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragOriginMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragDidMoveRef = useRef<boolean>(false);
  const dragStartClientPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pendingSingleSelectNodeIdRef = useRef<string | null>(null);
  const ignoreNextClickNodeIdRef = useRef<string | null>(null);
  const recipeRef = useRef(recipe);
  recipeRef.current = recipe;
  const geminiNodeRunIdsRef = useRef(new Map<string, string>());
  const updateAndPersistRecipe = useCallback(
    (update: (currentRecipe: CanvasRecipe) => CanvasRecipe) => {
      const updatedRecipe = update(recipeRef.current);
      recipeRef.current = updatedRecipe;
      setRecipe(updatedRecipe);
      if (currentFileId) {
        updateCanvasFile(currentFileId, { recipe: updatedRecipe, updatedAt: Date.now() });
        window.dispatchEvent(
          new CustomEvent('canvas-file-recipe-updated', {
            detail: { fileId: currentFileId, recipe: updatedRecipe },
          }),
        );
      }
    },
    [currentFileId],
  );
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  selectedNodeIdsRef.current = selectedNodeIds;
  // Run Selected: ref ke handler terbaru supaya tiap node membaca data hasil node sebelumnya
  const runModelNodeRef = useRef<((id: string, preferredAccountId?: string) => Promise<void>) | null>(null);
  const runSelectedRef = useRef<(() => Promise<void>) | null>(null);
  const isRunningAllRef = useRef(false);
  const runAllCancelRef = useRef(false);

  // Hanya node viewer (imageViewer) yang boleh ikut diberi status/hasil dari node runner di hulunya.
  // Node eksekusi lain (geminiVideo, videoStitcher, imageModel, dll) punya status sendiri dan TIDAK boleh
  // ditimpa oleh node hulu — kalau ditimpa, Video Stitcher tampak "running"/"completed" padahal belum jalan.
  const getConnectedViewerIds = (sourceNodeId: string): string[] => {
    const nodes = recipeRef.current.nodes;
    return recipeRef.current.edges
      .filter((e) => e.sourceNodeId === sourceNodeId)
      .map((e) => e.targetNodeId)
      .filter((id) => !!id && nodes.find((n) => n.id === id)?.type === 'imageViewer');
  };
  const [runAllState, setRunAllState] = useState<{ current: number; total: number; title: string } | null>(null);
  const lastPointerCanvasPosRef = useRef<{ x: number; y: number } | null>(null);
  const [isCanvasDragOver, setIsCanvasDragOver] = useState(false);

  // Marquee Selection Box (Ctrl/Shift Drag on Canvas)
  const [marqueeBox, setMarqueeBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const marqueeInitialSelectionRef = useRef<string[]>([]);

  // Port Connecting Wire
  const [connectingWire, setConnectingWire] = useState<{
    sourceNodeId: string;
    sourcePortId: string;
    sourceOutputId?: string;
    isInput: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  // Last screen-space pointer position while a wire is being dragged.
  // Used by edge auto-pan so distant nodes can be reached without releasing the wire.
  const wirePointerClientRef = useRef<{ x: number; y: number } | null>(null);

  // Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingProgress, setExecutingProgress] = useState<number>(0);
  const [executingNodeId, setExecutingNodeId] = useState<string | null>(null);
  const [executingNodeIds, setExecutingNodeIds] = useState<string[]>([]);
  const executingNodeIdsRef = useRef<string[]>([]);
  executingNodeIdsRef.current = executingNodeIds;
  const setStatusMessage = useCallback((_msg?: string) => {}, []);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [fullPreviewModal, setFullPreviewModal] = useState<{
    isOpen: boolean;
    url: string;
    title?: string;
    model?: string;
  }>({
    isOpen: false,
    url: '',
  });

  // Canvas Image Markup / Drawing Tool Modal State
  const [markupModal, setMarkupModal] = useState<{
    isOpen: boolean;
    imageUrl: string;
    sourceNodeId?: string;
    sourceNodeTitle?: string;
  }>({
    isOpen: false,
    imageUrl: '',
  });

  // Right-Click Canvas Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    canvasPosition: { x: number; y: number };
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    canvasPosition: { x: 0, y: 0 },
  });

  // Helper to load accounts from localStorage safely
  const getWeavyAccountsFromStorage = useCallback((): any[] => {
    try {
      const raw = localStorage.getItem('weavy_accounts');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }, []);

  const [weavyAccountsList, setWeavyAccountsList] = useState<any[]>(() => getWeavyAccountsFromStorage());
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Close account menu when clicking outside
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setIsAccountMenuOpen(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Determine current active account in Canvas
  const currentActiveAccount = useMemo(() => {
    if (activeAccountId) {
      const match = weavyAccountsList.find((a: any) => a.id === activeAccountId);
      if (match) return match;
    }
    const active = weavyAccountsList.find((a: any) => a.isActive);
    if (active) return active;
    return weavyAccountsList[0] || null;
  }, [weavyAccountsList, activeAccountId]);

  // Ambil akun Weavy TERPILIH langsung dari penyimpanan saat ini (bukan dari state/closure lama),
  // supaya generate selalu memakai akun yang sedang dipilih user di Pengaturan / menu akun Canvas.
  const getSelectedWeavyAccountNow = useCallback((): any | null => {
    try {
      const raw = localStorage.getItem('weavy_accounts');
      const accs = raw ? JSON.parse(raw) : [];
      if (Array.isArray(accs) && accs.length > 0) {
        // Match ChatView account precedence: explicit selected ID first, then
        // persisted active ID, then isActive flag. The old order could silently
        // choose a different account from the one that works in Chat.
        const selectedId = activeAccountId || localStorage.getItem('weavy_active_account_id');
        const selected = selectedId ? accs.find((a: any) => a.id === selectedId) : null;
        if (selected && (!selected.accountStatus || selected.accountStatus === 'active')) return selected;
        const active = accs.find((a: any) => a.isActive && (!a.accountStatus || a.accountStatus === 'active'));
        if (active) return active;
        return accs.find((a: any) => !a.accountStatus || a.accountStatus === 'active') || accs[0];
      }
    } catch (_) {}
    return null;
  }, [activeAccountId]);

  // Reactive Credits State (strictly synced from active account)
  const [credits, setCredits] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('weavy_accounts');
      if (raw) {
        const accs = JSON.parse(raw);
        if (Array.isArray(accs) && accs.length > 0) {
          const active = (activeAccountId ? accs.find((a: any) => a.id === activeAccountId) : null) || accs.find((a: any) => a.isActive) || accs[0];
          if (active && typeof active.credits === 'number') return active.credits;
        }
      }
    } catch (e) {}
    return typeof weavyCredits === 'number' ? weavyCredits : 150;
  });
  const [isSyncingCredits, setIsSyncingCredits] = useState(false);

  // Keep credits updated if currentActiveAccount credits change
  useEffect(() => {
    if (currentActiveAccount && typeof currentActiveAccount.credits === 'number') {
      setCredits(currentActiveAccount.credits);
    } else if (typeof weavyCredits === 'number') {
      setCredits(weavyCredits);
    }
  }, [currentActiveAccount?.credits, weavyCredits]);

  // Check for pending prompt injected from Chat view
  useEffect(() => {
    try {
      const pendingPrompt = localStorage.getItem('amb_canvas_pending_prompt');
      if (pendingPrompt) {
        localStorage.removeItem('amb_canvas_pending_prompt');
        const pendingImage = localStorage.getItem('amb_canvas_pending_image');
        if (pendingImage) {
          localStorage.removeItem('amb_canvas_pending_image');
        }

        const newNodeId = `node_${Date.now()}`;
        const newPromptNode: CanvasNode = {
          id: newNodeId,
          type: 'prompt',
          title: 'Prompt dari Chat',
          colorTheme: 'green',
          position: { x: 200, y: 200 },
          data: {
            text: pendingPrompt,
            model: 'google/gemini-3-pro',
          },
          inputs: [],
          outputs: [{ id: 'out-text', name: 'Prompt', label: 'Prompt', type: 'text' }],
        };

        setRecipe((prev) => ({
          ...prev,
          nodes: [...prev.nodes, newPromptNode],
        }));
        setSelectedNodeId(newNodeId);
      }
    } catch (e) {}
  }, []);

  // Handler to switch active account in Canvas
  const handleSelectWeavyAccount = useCallback((accId: string) => {
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
      setWeavyAccountsList(updated);
      window.dispatchEvent(new Event('weavy_accounts_updated'));
      window.dispatchEvent(new Event('accounts-updated'));

      const target = updated.find((a: any) => a.id === accId);
      if (target && typeof target.credits === 'number') {
        setCredits(target.credits);
      }

      if (onSelectWeavyAccount) {
        onSelectWeavyAccount(accId);
      }
    } catch (e) {
      console.warn('Error selecting active Weavy account:', e);
    }
  }, [onSelectWeavyAccount]);

  // Directly update credits in state and localStorage ONLY for the active account being used in Canvas!
  const updateCanvasDirectAccountCredits = useCallback(
    (newCredits: number) => {
      if (typeof newCredits !== 'number' || isNaN(newCredits)) return;
      setCredits(newCredits);
      try {
        const raw = localStorage.getItem('weavy_accounts');
        if (!raw) return;
        const accounts = JSON.parse(raw);
        if (!Array.isArray(accounts) || accounts.length === 0) return;

        // Target ONLY the active account in Canvas
        const targetAcc = (activeAccountId ? accounts.find((a: any) => a.id === activeAccountId) : null) ||
          accounts.find((a: any) => a.isActive) ||
          accounts[0];

        if (!targetAcc) return;
        const targetId = targetAcc.id;

        let updated = false;
        const updatedAccounts = accounts.map((a: any) => {
          // STRICT CHECK: ONLY update this exact account! NEVER touch other accounts!
          if (a.id === targetId) {
            if (a.credits !== newCredits) {
              updated = true;
              return {
                ...a,
                credits: newCredits,
              };
            }
          }
          return a; // ALL other accounts remain completely UNTOUCHED!
        });

        if (updated) {
          console.log(`[Canvas 🪙 Direct Credit Update] Sisa kredit akun aktif (${targetAcc.email || targetId}) diperbarui: ${newCredits}`);
          localStorage.setItem('weavy_accounts', JSON.stringify(updatedAccounts));
          setWeavyAccountsList(updatedAccounts);
          window.dispatchEvent(new Event('weavy_accounts_updated'));
          window.dispatchEvent(new Event('accounts-updated'));
        }
      } catch (err) {
        console.warn('Notice updating direct credits in Canvas:', err);
      }
    },
    [activeAccountId]
  );

  // Sync credits with backend verify endpoint: ONLY for the active account being used in Canvas!
  const syncCanvasCredits = useCallback(
    async () => {
      let targetAccount: any = null;
      try {
        const rawAccounts = localStorage.getItem('weavy_accounts');
        if (!rawAccounts) return;
        const accounts = JSON.parse(rawAccounts);
        if (!Array.isArray(accounts) || accounts.length === 0) return;

        targetAccount = (activeAccountId ? accounts.find((a: any) => a.id === activeAccountId) : null) ||
          accounts.find((a: any) => a.isActive) ||
          accounts[0];
      } catch (e) {}

      if (!targetAccount || !targetAccount.refreshToken) {
        console.warn('[Canvas] Akun Weavy aktif tidak ditemukan atau tidak memiliki refreshToken.');
        return;
      }

      setIsSyncingCredits(true);
      try {
        const info = await exchangeRefreshTokenAndGetInfo(targetAccount.refreshToken, targetAccount.email);
        if (typeof info.credits === 'number') {
          setCredits(info.credits);
          const raw = localStorage.getItem('weavy_accounts');
          if (raw) {
            const accounts = JSON.parse(raw);
            if (Array.isArray(accounts)) {
              let updated = false;
              const updatedAccounts = accounts.map((a: any) => {
                // STRICT CHECK: ONLY update this exact account! NEVER touch other accounts!
                if (a.id === targetAccount.id) {
                  updated = true;
                  return {
                    ...a,
                    credits: info.credits,
                    totalCredits: typeof info.totalCredits === 'number' ? info.totalCredits : a.totalCredits,
                    idToken: info.idToken || a.idToken,
                    refreshToken: info.refreshToken || a.refreshToken,
                  };
                }
                return a; // ALL other accounts remain completely UNTOUCHED!
              });

              if (updated) {
                console.log(`[Canvas 🪙 Sync Credits] Berhasil sinkronisasi kredit untuk akun aktif (${targetAccount.email || targetAccount.id}): ${info.credits} kredit`);
                localStorage.setItem('weavy_accounts', JSON.stringify(updatedAccounts));
                setWeavyAccountsList(updatedAccounts);
                window.dispatchEvent(new Event('weavy_accounts_updated'));
                window.dispatchEvent(new Event('accounts-updated'));

                if (onRefreshCredits) {
                  onRefreshCredits(targetAccount);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Canvas] Notice syncing Weavy credits for active account:', err);
      } finally {
        setIsSyncingCredits(false);
      }
    },
    [activeAccountId, onRefreshCredits]
  );

  // Listen for account updates across tabs and views
  useEffect(() => {
    const handleAccountsUpdated = () => {
      try {
        const raw = localStorage.getItem('weavy_accounts');
        if (raw) {
          const accs = JSON.parse(raw);
          if (Array.isArray(accs)) {
            setWeavyAccountsList(accs);
            const active = (activeAccountId ? accs.find((a: any) => a.id === activeAccountId) : null) || accs.find((a: any) => a.isActive) || accs[0];
            if (active && typeof active.credits === 'number') {
              setCredits(active.credits);
            }
          }
        }
      } catch (e) {}
    };

    window.addEventListener('accounts-updated', handleAccountsUpdated);
    window.addEventListener('weavy_accounts_updated', handleAccountsUpdated);
    window.addEventListener('storage', handleAccountsUpdated);
    return () => {
      window.removeEventListener('accounts-updated', handleAccountsUpdated);
      window.removeEventListener('weavy_accounts_updated', handleAccountsUpdated);
      window.removeEventListener('storage', handleAccountsUpdated);
    };
  }, [activeAccountId]);

  // Listen for IndexedDB hydration of canvas files
  useEffect(() => {
    const handleFilesSynced = (e: any) => {
      const syncedFiles = e.detail;
      if (Array.isArray(syncedFiles)) {
        setFiles(syncedFiles);
        if (currentFileId) {
          const current = syncedFiles.find((f: CanvasFile) => f.id === currentFileId);
          if (current?.recipe?.nodes && current.recipe.nodes.length > 0) {
            setRecipe((prev) => {
              if (!prev.nodes || prev.nodes.length === 0) {
                return current.recipe;
              }
              return prev;
            });
          }
        }
      }
    };
    window.addEventListener('canvas-files-synced', handleFilesSynced);
    return () => window.removeEventListener('canvas-files-synced', handleFilesSynced);
  }, [currentFileId]);

  useEffect(() => {
    const handleCanvasRecipeUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ fileId: string; recipe: CanvasRecipe }>).detail;
      if (!detail?.fileId || !detail.recipe) return;

      setFiles(loadAllCanvasFiles());
      if (detail.fileId === currentFileId) {
        recipeRef.current = detail.recipe;
        setRecipe(detail.recipe);
      }
    };

    window.addEventListener('canvas-file-recipe-updated', handleCanvasRecipeUpdated);
    return () => window.removeEventListener('canvas-file-recipe-updated', handleCanvasRecipeUpdated);
  }, [currentFileId]);

  // Save recipe state to active file in storage (debounced to avoid I/O bottlenecks)
  useEffect(() => {
    if (!currentFileId) return;
    const timer = setTimeout(() => {
      updateCanvasFile(currentFileId, { recipe, updatedAt: Date.now() });
    }, 300);
    return () => clearTimeout(timer);
  }, [recipe, currentFileId]);

  // Node CRUD operations
  const handleAddNode = (
    type: CanvasNodeType,
    positionOverride?: { x: number; y: number }
  ) => {
    recordHistory();
    const id = `node_${type}_${Date.now()}`;
    const x = positionOverride ? positionOverride.x : Math.round((-pan.x + 300) / zoom);
    const y = positionOverride ? positionOverride.y : Math.round((-pan.y + 200) / zoom);

    let newNode: CanvasNode;

    if (type === 'storyboard') {
      newNode = {
        id,
        type: 'storyboard',
        title: 'Storyboard Copilot',
        subtitle: 'Faceless Garden UGC (20s)',
        colorTheme: 'amber',
        position: { x, y },
        inputs: [
          { id: 'input-brief', name: 'brief', type: 'text', label: 'Prompt', required: false },
          { id: 'input-ai-worker', name: 'ai_worker_context', type: 'text', label: 'AI Worker', required: false },
          { id: 'input-image', name: 'image', type: 'image', label: 'Image 1', required: false },
        ],
        outputs: [], // Dynamically generated when scenes are created
        data: {
          presetKey: '/facelessgardenugc',
          generatorMode: 'preset',
          brief: '',
          targetDuration: 20,
          aspectRatio: '9:16',
          provider: 'weavy',
          model: 'google/gemini-3.6-flash',
          modelDisplayName: 'Gemini 3.6 Flash',
          status: 'idle',
          progress: 0,
          activeTab: 0,
          creditsCost: 1,
        },
      };
    } else if (type === 'aiWorker') {
      newNode = {
        id,
        type: 'aiWorker',
        title: 'AI Worker',
        subtitle: 'Ekstraksi link produk',
        colorTheme: 'green',
        position: { x, y },
        inputs: [
          { id: 'input-link', name: 'link', type: 'text', label: 'Link', required: false },
        ],
        outputs: getAiWorkerOutputs({}),
        data: {
          linkText: '',
          note: '',
          status: 'idle',
          progress: 0,
        },
      };
    } else if (type === 'prompt') {
      newNode = {
        id,
        type: 'prompt',
        title: 'Text Prompt',
        subtitle: 'Input prompt teks',
        colorTheme: 'green',
        position: { x, y },
        inputs: [],
        outputs: [
          { id: 'output-text', name: 'text', type: 'text', label: 'Text Prompt' },
        ],
        data: {
          prompt: '',
          negativePrompt: '',
        },
      };
    } else if (type === 'geminiVideo') {
      newNode = {
        id,
        type: 'geminiVideo',
        title: 'Gemini Omni Flash',
        subtitle: 'Gemini Omni Flash',
        colorTheme: 'purple',
        position: { x, y },
        inputs: [
          { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
          { id: 'input-image', name: 'image_1', type: 'image', label: 'Image 1', required: false },
        ],
        outputs: [
          { id: 'output-video', name: 'video', type: 'video', label: 'Generated Video' },
        ],
        data: {
          modelId: 'gemini-omni-1.1-flash',
          modelDisplayName: 'Gemini Omni Flash',
          provider: 'gemini',
          duration: '10s',
          aspectRatio: '9:16',
          creditsCost: 0,
          status: 'idle',
          progress: 0,
        },
      };
    } else if (type === 'vidsVideo') {
      newNode = {
        id,
        type: 'vidsVideo',
        title: 'Google Vids Omni',
        subtitle: 'Video generation · Google Vids',
        colorTheme: 'blue',
        position: { x, y },
        inputs: [
          { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
        ],
        outputs: [
          { id: 'output-video', name: 'video', type: 'video', label: 'Google Vids Video' },
        ],
        data: {
          modelDisplayName: 'Google Vids Omni',
          aspectRatio: '9:16',
          resolution: '720p',
          status: 'idle',
          progress: 0,
        },
      };
    } else if (type === 'videoStitcher') {
      newNode = {
        id,
        type: 'videoStitcher',
        title: 'Video Stitcher',
        subtitle: 'Multi-Scene Concat (FFmpeg)',
        colorTheme: 'red',
        position: { x, y },
        inputs: [
          { id: 'input-video-1', name: 'video_1', type: 'video', label: 'Video 1', required: true },
        ],
        outputs: [
          { id: 'output-video', name: 'video', type: 'video', label: 'Stitched Video' },
        ],
        data: {
          aspectRatio: '9:16',
          resolution: '1080p',
          transition: 'none',
          status: 'idle',
          progress: 0,
        },
      };
    } else if (type === 'anyLLM') {
      newNode = {
        id,
        type: 'anyLLM',
        title: 'Any LLM',
        subtitle: 'Gemini 3 Pro (Google)',
        colorTheme: 'purple',
        position: { x, y },
        inputs: [
          { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
          { id: 'input-image', name: 'image', type: 'image', label: 'Image 1', required: false },
        ],
        outputs: [
          { id: 'output-text', name: 'text', type: 'text', label: 'Text' },
        ],
        data: {
          model: 'google/gemini-3-pro',
          modelDisplayName: 'Gemini 3 Pro',
          systemPrompt: 'You are an advanced AI assistant. Analyze the inputs and provide high quality, comprehensive responses.',
          temperature: 0,
          thinking: false,
          inputPrompt: '',
          generatedText: '',
          enhancedPrompt: '',
          status: 'idle',
          creditsCost: 1,
        },
      };
    } else if (type === 'promptEnhancer') {
      newNode = {
        id,
        type: 'promptEnhancer',
        title: 'Prompt Enhancer',
        subtitle: 'GPT-5.6 Sol (OpenAI)',
        colorTheme: 'purple',
        position: { x, y },
        inputs: [
          { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: false },
          { id: 'input-image', name: 'image', type: 'image', label: 'Image 1', required: false },
        ],
        outputs: [
          { id: 'output-enhanced_prompt', name: 'enhanced_prompt', type: 'text', label: 'Enhanced Prompt' },
        ],
        data: {
          model: 'openai/gpt-5.6-sol',
          systemPrompt: 'Your job is to write prompts for text-to-image models. Your input will be a general description for the scene, You should write a detailed prompt without any additions, not longer than 3 sentences.',
          inputPrompt: '',
          enhancedPrompt: '',
          status: 'idle',
        },
      };
    } else if (type === 'imageInput') {
      newNode = {
        id,
        type: 'imageInput',
        title: 'File',
        subtitle: 'File Input',
        colorTheme: 'blue',
        position: { x, y },
        inputs: [],
        outputs: [
          { id: 'output-image', name: 'image', type: 'image', label: 'File' },
        ],
        data: {
          imageUrl: '',
          fileName: '',
        },
      };
    } else if (type === 'imageModel') {
      newNode = {
        id,
        type: 'imageModel',
        title: 'Weavy',
        subtitle: 'Weavy AI Model',
        colorTheme: 'red',
        position: { x, y },
        inputs: [
          { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
          { id: 'input-image', name: 'image_1', type: 'image', label: 'Image 1', required: false },
        ],
        outputs: [
          { id: 'output-result', name: 'result', type: 'image', label: 'Generated Image' },
        ],
        data: {
          modelId: 'fal-ai/nano-banana-pro/edit',
          modelDisplayName: 'Gemini 3 (Nano Banana Pro)',
          provider: 'weavy',
          resolution: '1K',
          aspectRatio: '1:1',
          seed: Math.floor(Math.random() * 999999),
          isRandomSeed: true,
          creditsCost: 11,
        },
      };
    } else if (type === 'note') {
      newNode = {
        id,
        type: 'note',
        title: 'Catatan',
        subtitle: 'Sticky Note',
        colorTheme: 'amber',
        position: { x, y },
        inputs: [],
        outputs: [],
        data: {
          text: '',
        },
      };
    } else {
      newNode = {
        id,
        type: 'imageViewer',
        title: 'Image Output',
        subtitle: 'Viewer & Download',
        colorTheme: 'purple',
        position: { x, y },
        inputs: [
          { id: 'input-image', name: 'image', type: 'image', label: 'Result Image' },
        ],
        outputs: [
          { id: 'output-image', name: 'image', type: 'image', label: 'Jadikan Gambar Referensi' },
        ],
        data: {
          status: 'idle',
        },
      };
    }

    setRecipe((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));
    setSelectedNodeId(id);
    setSelectedNodeIds([id]);
    setStatusMessage(`✓ Node ${newNode.title} berhasil ditambahkan`);
  };

  // Add Sticky Note directly at viewport center
  const handleAddStickyNote = () => {
    recordHistory();
    const container = canvasContainerRef.current?.getBoundingClientRect();
    const centerX = container ? (container.width / 2 - pan.x) / zoom - 125 : 200;
    const centerY = container ? (container.height / 2 - pan.y) / zoom - 100 : 200;

    const id = `node_note_${Date.now()}`;
    const newNode: CanvasNode = {
      id,
      type: 'note',
      title: 'Catatan',
      subtitle: 'Sticky Note',
      colorTheme: 'amber',
      position: {
        x: Math.round(centerX + (Math.random() * 30 - 15)),
        y: Math.round(centerY + (Math.random() * 30 - 15)),
      },
      inputs: [],
      outputs: [],
      data: {
        text: '',
      },
    };

    setRecipe((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));
    setSelectedNodeIds([id]);
  };

  const handleDeleteNode = (nodeId: string) => {
    recordHistory();
    setRecipe((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter(
        (e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId
      ),
      groups: (prev.groups || [])
        .map((g) => ({
          ...g,
          nodeIds: g.nodeIds.filter((id) => id !== nodeId),
        }))
        .filter((g) => g.nodeIds.length > 0),
    }));
    setSelectedNodeIds((prev) => prev.filter((id) => id !== nodeId));
  };

  // Duplicate specified nodes or all currently selected nodes (Ctrl+D)
  const handleDuplicateNodes = useCallback((nodeIdsToDuplicate?: string[]) => {
    let targetIds =
      nodeIdsToDuplicate && nodeIdsToDuplicate.length > 0
        ? nodeIdsToDuplicate
        : selectedNodeIds;

    if ((!targetIds || targetIds.length === 0) && document.activeElement) {
      const closestCard = document.activeElement.closest('[data-node-id]');
      const foundId = closestCard?.getAttribute('data-node-id');
      if (foundId) targetIds = [foundId];
    }

    const currentRecipe = recipeRef.current;
    const nodesToDuplicate = currentRecipe.nodes.filter((node) => targetIds.includes(node.id));
    if (nodesToDuplicate.length === 0) {
      setStatusMessage('Klik node terlebih dahulu, lalu tekan Ctrl+D untuk menduplikat.');
      return;
    }

    recordHistory();

    const idMap = new Map<string, string>();
    const newNodes: CanvasNode[] = [];
    const OFFSET_X = 40;
    const OFFSET_Y = 40;

    nodesToDuplicate.forEach((node) => {
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newId = `node_${node.type}_${uniqueSuffix}`;
      idMap.set(node.id, newId);

      const clonedData = node.data ? JSON.parse(JSON.stringify(node.data)) : {};
      if (node.type === 'imageViewer' && clonedData.status === 'executing') {
        clonedData.status = 'idle';
      }

      const duplicatedNode: CanvasNode = {
        ...node,
        id: newId,
        position: {
          x: Math.round(node.position.x + OFFSET_X),
          y: Math.round(node.position.y + OFFSET_Y),
        },
        inputs: (node.inputs || []).map((port) => ({
          ...port,
          id: `${port.id}_${uniqueSuffix}`,
        })),
        outputs: (node.outputs || []).map((port) => ({
          ...port,
          id: `${port.id}_${uniqueSuffix}`,
        })),
        data: clonedData,
      };

      newNodes.push(duplicatedNode);
    });

    const newEdges: CanvasEdge[] = [];
    currentRecipe.edges.forEach((edge) => {
      const newSourceNodeId = idMap.get(edge.sourceNodeId);
      const newTargetNodeId = idMap.get(edge.targetNodeId);
      if (!newSourceNodeId || !newTargetNodeId) return;

      const srcOldNode = nodesToDuplicate.find((node) => node.id === edge.sourceNodeId);
      const dstOldNode = nodesToDuplicate.find((node) => node.id === edge.targetNodeId);
      const srcPortIdx =
        srcOldNode?.outputs?.findIndex(
          (port) => port.id === (edge.sourceOutputId || edge.sourcePortId)
        ) ?? -1;
      const dstPortIdx =
        dstOldNode?.inputs?.findIndex(
          (port) => port.id === (edge.targetInputId || edge.targetPortId)
        ) ?? -1;
      const srcNewNode = newNodes.find((node) => node.id === newSourceNodeId);
      const dstNewNode = newNodes.find((node) => node.id === newTargetNodeId);

      newEdges.push({
        id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        sourceNodeId: newSourceNodeId,
        sourceOutputId:
          srcPortIdx >= 0 && srcNewNode?.outputs?.[srcPortIdx]
            ? srcNewNode.outputs[srcPortIdx].id
            : edge.sourceOutputId,
        targetNodeId: newTargetNodeId,
        targetInputId:
          dstPortIdx >= 0 && dstNewNode?.inputs?.[dstPortIdx]
            ? dstNewNode.inputs[dstPortIdx].id
            : edge.targetInputId,
      });
    });

    const nextRecipe = {
      ...currentRecipe,
      nodes: [...currentRecipe.nodes, ...newNodes],
      edges: [...currentRecipe.edges, ...newEdges],
    };
    const createdIds = newNodes.map((node) => node.id);
    recipeRef.current = nextRecipe;
    setRecipe(nextRecipe);
    setSelectedNodeIds(createdIds);
    setSelectedGroupId(null);
    setIsInspectorOpen(false);

    setStatusMessage(
      newNodes.length > 1
        ? `✓ ${newNodes.length} node berhasil diduplikat (Ctrl+D)`
        : `✓ Node "${nodesToDuplicate[0]?.title || 'Node'}" berhasil diduplikat (Ctrl+D)`
    );
  }, [selectedNodeIds, recordHistory]);

  const handleUpdateNodeData = (nodeId: string, newData: any) => {
    setRecipe((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: newData,
              outputs:
                n.type === 'imageInput' &&
                (newData?.videoUrl || newData?.mediaType === 'video') &&
                !(n.outputs || []).some((port) => port.id === 'output-video')
                  ? [
                      ...(n.outputs || [
                        { id: 'output-image', name: 'image', type: 'image' as const, label: 'Image Output' },
                      ]),
                      { id: 'output-video', name: 'video', type: 'video', label: 'Video Output' },
                    ]
                  : n.outputs,
            }
          : n
      ),
    }));
  };

  // Reset only generated Storyboard Copilot results. Keep its brief/configuration,
  // all upstream nodes (Prompt/AI Worker), and incoming connections untouched.
  const handleResetStoryboard = (storyboardNodeId: string) => {
    const target = recipeRef.current.nodes.find((n) => n.id === storyboardNodeId);
    if (!target || target.type !== 'storyboard') return;
    recordHistory();
    // Hanya data hasil analisis yang dibersihkan. `outputs` dan `edges` TIDAK disentuh,
    // jadi kabel Scene -> Model Gambar / Video tetap tersambung.
    setRecipe((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === storyboardNodeId
          ? { ...n, error: undefined, progress: 0, data: getResetNodeData(n) }
          : n
      ),
    }));
    setStatusMessage('Hasil analisis Storyboard dibersihkan. Brief, koneksi input, dan kabel output tetap dipertahankan.');
  };

  // Reset node TERPILIH: bersihkan input gambar + hasil generate, kabel tidak disentuh.
  const handleResetSelectedNodes = () => {
    if (isRunningAllRef.current) return;
    const selected = new Set(selectedNodeIdsRef.current);
    const targets = recipeRef.current.nodes.filter(
      (n) => selected.has(n.id) && RESETTABLE_NODE_TYPES.includes(n.type)
    );
    if (targets.length === 0) return;
    if (targets.some((n) => executingNodeIdsRef.current.includes(n.id))) return;

    recordHistory();
    const ids = new Set(targets.map((n) => n.id));
    setRecipe((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        ids.has(n.id) ? { ...n, error: undefined, progress: 0, data: getResetNodeData(n) } : n
      ),
      // edges sengaja tidak diubah
    }));
    setStatusMessage(`${targets.length} node di-reset. Kabel tetap tersambung.`);
  };

  // Open Canvas Markup / Drawing Tool
  const handleOpenMarkup = (imageUrl: string, sourceNodeId?: string, title?: string) => {
    if (!imageUrl) return;
    setMarkupModal({
      isOpen: true,
      imageUrl,
      sourceNodeId,
      sourceNodeTitle: title || 'Media Canvas',
    });
  };

  // Save Canvas Markup (either overwrite source node or create new ImageInput node)
  const handleSaveMarkup = (markupDataUrl: string, targetMode: 'overwrite' | 'newNode') => {
    recordHistory();

    if (targetMode === 'overwrite' && markupModal.sourceNodeId) {
      const sourceId = markupModal.sourceNodeId;
      setRecipe((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => {
          if (n.id === sourceId) {
            return {
              ...n,
              data: {
                ...n.data,
                imageUrl: markupDataUrl,
                outputImage: markupDataUrl,
                resultUrl: markupDataUrl,
              },
            };
          }
          return n;
        }),
      }));
      setStatusMessage('✓ Gambar berhasil diperbarui dengan coretan markup!');
    } else {
      // Create new File/ImageInput node containing marked-up image
      const sourceNode = recipe.nodes.find((n) => n.id === markupModal.sourceNodeId);
      const posX = sourceNode ? sourceNode.position.x + 320 : Math.round((-pan.x + 350) / zoom);
      const posY = sourceNode ? sourceNode.position.y : Math.round((-pan.y + 250) / zoom);
      const id = `node_imageInput_${Date.now()}`;

      const newNode: CanvasNode = {
        id,
        type: 'imageInput',
        title: `Markup (${markupModal.sourceNodeTitle || 'Gambar'})`,
        subtitle: 'Coretan Gambar',
        colorTheme: 'blue',
        position: { x: posX, y: posY },
        inputs: [],
        outputs: [
          { id: 'output-image', name: 'image', type: 'image', label: 'File' },
        ],
        data: {
          imageUrl: markupDataUrl,
          fileName: `markup_${Date.now()}.png`,
        },
      };

      setRecipe((prev) => ({
        ...prev,
        nodes: [...prev.nodes, newNode],
      }));
      setSelectedNodeId(id);
      setSelectedNodeIds([id]);
      setStatusMessage('✓ Node gambar baru dengan coretan markup berhasil dibuat!');
    }

    setMarkupModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleDeleteEdge = useCallback((edgeId: string) => {
    if (!recipeRef.current.edges.some((edge) => edge.id === edgeId)) return;
    recordHistory();
    setRecipe((prev) => ({
      ...prev,
      edges: prev.edges.filter((e) => e.id !== edgeId),
    }));
    setSelectedEdgeId(null);
  }, [recordHistory]);

  // Add another image input reference slot to a model node
  const handleAddImageInput = (modelNodeId: string) => {
    setRecipe((prev) => {
      const targetNode = prev.nodes.find((n) => n.id === modelNodeId);
      if (!targetNode) return prev;

      const currentImageInputs = targetNode.inputs.filter((p) => p.type === 'image');
      if (currentImageInputs.length >= 8) {
        setStatusMessage('Maksimal 8 input gambar referensi untuk model ini.');
        return prev;
      }

      const nextNum = currentImageInputs.length + 1;
      const newPortId = `input-image-${Date.now()}`;
      const newPort = {
        id: newPortId,
        name: `image_${nextNum}`,
        type: 'image' as const,
        label: `Image ${nextNum}`,
      };

      setStatusMessage(`✓ Port "Image ${nextNum}" ditambahkan ke node model!`);

      return {
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === modelNodeId
            ? {
                ...n,
                inputs: [...n.inputs, newPort],
              }
            : n
        ),
      };
    });
  };

  // Remove the last added image input slot from a model node
  const handleRemoveLastImageInput = (modelNodeId: string) => {
    setRecipe((prev) => {
      const targetNode = prev.nodes.find((n) => n.id === modelNodeId);
      if (!targetNode) return prev;

      const imageInputs = targetNode.inputs.filter((p) => p.type === 'image');
      if (imageInputs.length <= 1) {
        setStatusMessage('Minimal harus ada 1 input gambar referensi.');
        return prev;
      }

      const lastImagePort = imageInputs[imageInputs.length - 1];

      // Disconnect any edges connecting to this removed port
      const remainingEdges = prev.edges.filter(
        (e) => !(e.targetNodeId === modelNodeId && e.targetInputId === lastImagePort.id)
      );

      setStatusMessage(`Port "${lastImagePort.label || lastImagePort.name}" dihapus.`);

      return {
        ...prev,
        edges: remainingEdges,
        nodes: prev.nodes.map((n) =>
          n.id === modelNodeId
            ? {
                ...n,
                inputs: n.inputs.filter((p) => p.id !== lastImagePort.id),
              }
            : n
        ),
      };
    });
  };

  // Add another video input slot to a Video Stitcher node
  const handleAddVideoInput = (stitcherNodeId: string) => {
    setRecipe((prev) => {
      const targetNode = prev.nodes.find((n) => n.id === stitcherNodeId);
      if (!targetNode) return prev;

      const currentVideoInputs = targetNode.inputs || [];
      if (currentVideoInputs.length >= 16) {
        setStatusMessage('Maksimal 16 input video untuk Video Stitcher.');
        return prev;
      }

      const nextNum = currentVideoInputs.length + 1;
      const newPortId = `input-video-${nextNum}`;
      const newPort = {
        id: newPortId,
        name: `video_${nextNum}`,
        type: 'video' as const,
        label: `Video ${nextNum}`,
      };

      setStatusMessage(`✓ Port "Video ${nextNum}" ditambahkan ke Video Stitcher!`);

      return {
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === stitcherNodeId
            ? {
                ...n,
                inputs: [...n.inputs, newPort],
              }
            : n
        ),
      };
    });
  };

  // Remove the last video input slot from a Video Stitcher node
  const handleRemoveLastVideoInput = (stitcherNodeId: string) => {
    setRecipe((prev) => {
      const targetNode = prev.nodes.find((n) => n.id === stitcherNodeId);
      if (!targetNode || !targetNode.inputs || targetNode.inputs.length <= 1) {
        setStatusMessage('Minimal harus ada 1 input video.');
        return prev;
      }

      const lastVideoPort = targetNode.inputs[targetNode.inputs.length - 1];

      // Disconnect any edges connecting to this removed port
      const remainingEdges = prev.edges.filter(
        (e) => !(e.targetNodeId === stitcherNodeId && e.targetInputId === lastVideoPort.id)
      );

      setStatusMessage(`Port "${lastVideoPort.label || lastVideoPort.name}" dihapus.`);

      return {
        ...prev,
        edges: remainingEdges,
        nodes: prev.nodes.map((n) =>
          n.id === stitcherNodeId
            ? {
                ...n,
                inputs: n.inputs.filter((p) => p.id !== lastVideoPort.id),
              }
            : n
        ),
      };
    });
  };

  // Helper to accurately get port coordinates in canvas coordinates
  const getPortCoordinate = (
    nodeId: string,
    portId: string,
    isInput: boolean
  ): { x: number; y: number } | null => {
    const node = recipe.nodes.find((n) => n.id === nodeId);
    if (!node) return null;
    const incomingEdge = recipe.edges.find((e) => e.targetNodeId === nodeId);
    const srcNode = incomingEdge ? recipe.nodes.find((n) => n.id === incomingEdge.sourceNodeId) : undefined;
    return getCanvasPortCoordinate(node, portId, isInput, srcNode?.data?.aspectRatio);
  };

  // Node Selection Handler (Shift+Click to block/multi-select, normal click to single-select)
  const handleSelectNode = useCallback(
    (nodeId: string, e?: React.MouseEvent) => {
      // If the node was dragged, do not alter selection on mouse up/click
      if (dragDidMoveRef.current) {
        dragDidMoveRef.current = false;
        return;
      }
      setSelectedEdgeId(null);
      // If pointerdown on header already handled this click, skip selection toggle but guarantee inspector is open only if exactly 1 node selected
      if (ignoreNextClickNodeIdRef.current === nodeId) {
        ignoreNextClickNodeIdRef.current = null;
        if (selectedNodeIds.length === 1) {
          const node = recipe.nodes.find((n) => n.id === nodeId);
          if (
            node &&
            (node.type === 'imageModel' ||
              node.type === 'geminiVideo' ||
              node.type === 'vidsVideo' ||
              node.type === 'videoStitcher' ||
              node.type === 'anyLLM' ||
              node.type === 'promptEnhancer' ||
              node.type === 'storyboard')
          ) {
            setIsInspectorOpen(true);
          }
        } else {
          setIsInspectorOpen(false);
        }
        return;
      }

      const isModifier = e?.ctrlKey || e?.metaKey || e?.shiftKey;
      if (isModifier) {
        setSelectedNodeIds((prev) => {
          const next = prev.includes(nodeId)
            ? prev.filter((id) => id !== nodeId)
            : [...prev, nodeId];
          const count = next.length;
          if (count > 1) {
            setStatusMessage(`✓ ${count} node terpilih (blok seleksi)`);
            setIsInspectorOpen(false);
          } else if (count === 1) {
            setStatusMessage(`✓ 1 node terpilih`);
            const single = recipe.nodes.find((n) => n.id === next[0]);
            if (
              single &&
              (single.type === 'imageModel' ||
                single.type === 'geminiVideo' ||
                single.type === 'vidsVideo' ||
                single.type === 'videoStitcher' ||
                single.type === 'anyLLM' ||
                single.type === 'promptEnhancer' ||
                single.type === 'storyboard')
            ) {
              setIsInspectorOpen(true);
            }
          } else {
            setIsInspectorOpen(false);
          }
          return next;
        });
      } else {
        setSelectedNodeIds([nodeId]);
        const node = recipe.nodes.find((n) => n.id === nodeId);
        if (
          node &&
          (node.type === 'imageModel' ||
            node.type === 'geminiVideo' ||
            node.type === 'vidsVideo' ||
            node.type === 'videoStitcher' ||
            node.type === 'anyLLM' ||
            node.type === 'promptEnhancer' ||
            node.type === 'storyboard')
        ) {
          setIsInspectorOpen(true);
        }
      }
    },
    [recipe.nodes, selectedNodeIds]
  );

  // Node Drag Handler directly on card header (supports group dragging & Shift+Click multi-selection)
  const handleStartDragNode = (
    nodeId: string,
    e: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>
  ) => {
    e.stopPropagation();

    // If tool is 'pan' or spacebar is held, dragging on a node card header still pans canvas
    if (activeTool === 'pan' || isSpacePressedRef.current) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    setSelectedEdgeId(null);
    const container = canvasContainerRef.current?.getBoundingClientRect();
    const node = recipe.nodes.find((n) => n.id === nodeId);
    if (!container || !node) return;

    dragDidMoveRef.current = false;
    dragStartClientPosRef.current = { x: e.clientX, y: e.clientY };

    const isModifier = e.ctrlKey || e.metaKey || e.shiftKey;
    let nextSelected = [...selectedNodeIds];

    if (isModifier) {
      // Shift / Ctrl / Cmd is held: Toggle or add this node to the blocked/multi-selected group
      if (nextSelected.includes(nodeId)) {
        nextSelected = nextSelected.filter((id) => id !== nodeId);
      } else {
        nextSelected = [...nextSelected, nodeId];
      }
      setSelectedNodeIds(nextSelected);
      ignoreNextClickNodeIdRef.current = nodeId;
      pendingSingleSelectNodeIdRef.current = null;

      const count = nextSelected.length;
      if (count > 1) {
        setStatusMessage(`✓ ${count} node terpilih (blok seleksi)`);
        setIsInspectorOpen(false);
      } else if (count === 1) {
        setStatusMessage(`✓ 1 node terpilih`);
      } else {
        setIsInspectorOpen(false);
      }
    } else {
      // Normal click / drag without modifier:
      if (selectedNodeIds.includes(nodeId)) {
        // If clicking an already selected node in a multi-selected group, KEEP all of them selected for group drag!
        // Do not deselect others immediately; if it turns out to be just a click (no drag), collapse on pointerup.
        nextSelected = selectedNodeIds;
        pendingSingleSelectNodeIdRef.current = nodeId;
        ignoreNextClickNodeIdRef.current = null;
      } else {
        // Simple click on an unselected node: select it immediately
        nextSelected = [nodeId];
        setSelectedNodeIds(nextSelected);
        pendingSingleSelectNodeIdRef.current = null;
        ignoreNextClickNodeIdRef.current = nodeId;
        if (
          node &&
          (node.type === 'imageModel' ||
            node.type === 'geminiVideo' ||
            node.type === 'vidsVideo' ||
            node.type === 'videoStitcher' ||
            node.type === 'anyLLM' ||
            node.type === 'promptEnhancer' ||
            node.type === 'storyboard')
        ) {
          setIsInspectorOpen(true);
        }
      }
    }

    setDraggingNodeId(nodeId);

    // Snapshot state before dragging starts for Undo
    dragSnapshotRef.current = JSON.parse(JSON.stringify(recipe));

    const mouseCanvasX = (e.clientX - container.left - pan.x) / zoom;
    const mouseCanvasY = (e.clientY - container.top - pan.y) / zoom;

    // Record starting positions for every node in the selection
    const posMap = new Map<string, { x: number; y: number }>();
    recipe.nodes.forEach((n) => {
      if (nextSelected.includes(n.id) || n.id === nodeId) {
        posMap.set(n.id, { x: n.position.x, y: n.position.y });
      }
    });

    dragStartPositionsRef.current = posMap;
    dragOriginMouseRef.current = { x: mouseCanvasX, y: mouseCanvasY };
  };

  // Group Drag Handler (moves all child nodes together)
  const handleStartDragGroup = (
    groupId: string,
    e: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>
  ) => {
    e.stopPropagation();

    if (activeTool === 'pan' || isSpacePressedRef.current) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    setSelectedEdgeId(null);
    const container = canvasContainerRef.current?.getBoundingClientRect();
    const group = (recipe.groups || []).find((g) => g.id === groupId);
    if (!container || !group) return;

    dragDidMoveRef.current = false;
    dragStartClientPosRef.current = { x: e.clientX, y: e.clientY };

    setSelectedGroupId(groupId);
    setSelectedNodeIds(group.nodeIds);
    pendingSingleSelectNodeIdRef.current = null;
    ignoreNextClickNodeIdRef.current = null;

    setDraggingNodeId(group.nodeIds[0] || groupId);
    dragSnapshotRef.current = JSON.parse(JSON.stringify(recipe));

    const mouseCanvasX = (e.clientX - container.left - pan.x) / zoom;
    const mouseCanvasY = (e.clientY - container.top - pan.y) / zoom;

    const posMap = new Map<string, { x: number; y: number }>();
    recipe.nodes.forEach((n) => {
      if (group.nodeIds.includes(n.id)) {
        posMap.set(n.id, { x: n.position.x, y: n.position.y });
      }
    });

    dragStartPositionsRef.current = posMap;
    dragOriginMouseRef.current = { x: mouseCanvasX, y: mouseCanvasY };
  };

  const handleUpdateGroupTitle = (groupId: string, newTitle: string) => {
    recordHistory();
    setRecipe((prev) => ({
      ...prev,
      groups: (prev.groups || []).map((g) =>
        g.id === groupId ? { ...g, title: newTitle.trim() || 'Group' } : g
      ),
    }));
  };

  // Wire Connection Handlers
  const handleStartConnect = (
    nodeId: string,
    portId: string,
    e: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
    isInput: boolean = false
  ) => {
    e.stopPropagation();
    const coord = getPortCoordinate(nodeId, portId, isInput);
    if (!coord) return;

    const container = canvasContainerRef.current?.getBoundingClientRect();
    const currentX = container ? (e.clientX - container.left - pan.x) / zoom : coord.x;
    const currentY = container ? (e.clientY - container.top - pan.y) / zoom : coord.y;

    setConnectingWire({
      sourceNodeId: nodeId,
      sourcePortId: portId,
      sourceOutputId: portId,
      isInput,
      startX: coord.x,
      startY: coord.y,
      currentX,
      currentY,
    });
  };

  const handleEndConnect = (
    targetNodeId: string,
    targetPortId: string,
    isInput: boolean = true
  ) => {
    if (!connectingWire) return;
    if (connectingWire.sourceNodeId === targetNodeId) {
      setStatusMessage('Tidak bisa menghubungkan node ke dirinya sendiri.');
      setConnectingWire(null);
      return;
    }

    // Determine directional source (output) & target (input)
    let srcNodeId = connectingWire.sourceNodeId;
    let srcOutputId = connectingWire.sourcePortId;
    let dstNodeId = targetNodeId;
    let dstInputId = targetPortId;

    if (connectingWire.isInput && !isInput) {
      // Wire was dragged from input port to output port
      srcNodeId = targetNodeId;
      srcOutputId = targetPortId;
      dstNodeId = connectingWire.sourceNodeId;
      dstInputId = connectingWire.sourcePortId;
    } else if (connectingWire.isInput === isInput) {
      setStatusMessage(
        isInput
          ? 'Hubungkan port Output (lingkaran oranye/kanan) ke port Input (kiri).'
          : 'Hubungkan port Output (kanan) ke port Input (lingkaran abu-abu/kiri).'
      );
      setConnectingWire(null);
      return;
    }

    const sourceNode = recipe.nodes.find((node) => node.id === srcNodeId);
    const targetNode = recipe.nodes.find((node) => node.id === dstNodeId);
    if (sourceNode?.type === 'aiWorker' && targetNode?.type === 'storyboard') {
      const sourcePort = getAiWorkerOutputs(sourceNode.data).find((port) => port.id === srcOutputId);
      const semanticInput = sourcePort?.type === 'image'
        ? targetNode.inputs.find(
            (port) =>
              port.id === 'input-image' ||
              (port.type === 'image' && port.name === 'image')
          )
        : targetNode.inputs.find(
            (port) =>
              port.id === 'input-ai-worker' ||
              port.name === 'ai_worker_context' ||
              port.label?.toLowerCase() === 'ai worker'
          );
      if (semanticInput) dstInputId = semanticInput.id;
    } else if (sourceNode?.type === 'prompt' && targetNode?.type === 'storyboard') {
      const briefInput = targetNode.inputs.find(
        (port) => port.id === 'input-brief' || port.name === 'brief'
      );
      if (briefInput) dstInputId = briefInput.id;
    }

    // Check if edge already exists identically
    const identicalExists = recipe.edges.some(
      (e) =>
        e.sourceNodeId === srcNodeId &&
        e.sourceOutputId === srcOutputId &&
        e.targetNodeId === dstNodeId &&
        e.targetInputId === dstInputId
    );

    if (!identicalExists) {
      recordHistory();
      const edgeColor =
        sourceNode?.type === 'prompt'
          ? '#10b981'
          : sourceNode?.type === 'imageInput'
          ? '#14b8a6'
          : sourceNode?.type === 'imageViewer'
          ? '#a855f7'
          : '#a855f7';

      const newEdge: CanvasEdge = {
        id: `edge_${srcNodeId}_${dstNodeId}_${Date.now()}`,
        sourceNodeId: srcNodeId,
        sourceOutputId: srcOutputId,
        targetNodeId: dstNodeId,
        targetInputId: dstInputId,
        color: edgeColor,
      };

      // In node editors, an input port connects to one source. Replace any existing edge to this input port.
      const isStoryboardTarget = targetNode?.type === 'storyboard';
      const promptSourceText = (
        sourceNode?.type === 'prompt'
          ? (sourceNode.data?.prompt || sourceNode.data?.output?.prompt || sourceNode.data?.text || '')
          : ''
      ).trim();

      setRecipe((prev) => ({
        ...prev,
        nodes: isStoryboardTarget && dstInputId === 'input-brief' && promptSourceText
          ? prev.nodes.map((n) => n.id === dstNodeId ? { ...n, data: { ...n.data, brief: promptSourceText } } : n)
          : prev.nodes,
        edges: [
          ...prev.edges.filter(
            (e) => !(e.targetNodeId === dstNodeId && e.targetInputId === dstInputId)
          ),
          newEdge,
        ],
      }));
      setStatusMessage('✓ Kabel berhasil disambungkan!');
    } else {
      setStatusMessage('Kabel ini sudah terhubung.');
    }

    setConnectingWire(null);
  };

  // High-performance window-level pointer tracking (supports group dragging & marquee selection)
  useEffect(() => {
    if (!draggingNodeId && !isPanning && !connectingWire && !marqueeBox) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      const container = canvasContainerRef.current?.getBoundingClientRect();
      if (!container) return;

      if (draggingNodeId) {
        const dist = Math.hypot(
          e.clientX - dragStartClientPosRef.current.x,
          e.clientY - dragStartClientPosRef.current.y
        );
        if (dist > 3) {
          dragDidMoveRef.current = true;
          // Dragging started: cancel pending single-select collapse so all multi-selected nodes stay selected
          pendingSingleSelectNodeIdRef.current = null;
        }

        const mouseCanvasX = (e.clientX - container.left - pan.x) / zoom;
        const mouseCanvasY = (e.clientY - container.top - pan.y) / zoom;
        const dx = Math.round(mouseCanvasX - dragOriginMouseRef.current.x);
        const dy = Math.round(mouseCanvasY - dragOriginMouseRef.current.y);

        setRecipe((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) => {
            const startPos = dragStartPositionsRef.current.get(n.id);
            if (startPos) {
              return {
                ...n,
                position: {
                  x: Math.round(startPos.x + dx),
                  y: Math.round(startPos.y + dy),
                },
              };
            }
            return n;
          }),
        }));
      } else if (marqueeBox) {
        const currentX = (e.clientX - container.left - pan.x) / zoom;
        const currentY = (e.clientY - container.top - pan.y) / zoom;
        setMarqueeBox((prev) => (prev ? { ...prev, currentX, currentY } : null));

        const minX = Math.min(marqueeBox.startX, currentX);
        const maxX = Math.max(marqueeBox.startX, currentX);
        const minY = Math.min(marqueeBox.startY, currentY);
        const maxY = Math.max(marqueeBox.startY, currentY);

        // Auto-select nodes that intersect with the marquee selection box
        const boxedNodeIds = recipeRef.current.nodes
          .filter((n) => {
            const incomingEdge = recipeRef.current.edges.find((edge) => edge.targetNodeId === n.id);
            const srcNode = incomingEdge
              ? recipeRef.current.nodes.find((edgeNode) => edgeNode.id === incomingEdge.sourceNodeId)
              : undefined;
            const w = getNodeWidth(n, srcNode?.data?.aspectRatio);
            const h = 260; // Estimated card height

            const nodeMinX = n.position.x;
            const nodeMaxX = n.position.x + w;
            const nodeMinY = n.position.y;
            const nodeMaxY = n.position.y + h;

            return (
              nodeMinX <= maxX &&
              nodeMaxX >= minX &&
              nodeMinY <= maxY &&
              nodeMaxY >= minY
            );
          })
          .map((n) => n.id);

        const combined = Array.from(new Set([...marqueeInitialSelectionRef.current, ...boxedNodeIds]));
        setSelectedNodeIds(combined);
      } else if (connectingWire) {
        wirePointerClientRef.current = { x: e.clientX, y: e.clientY };
        const currentX = (e.clientX - container.left - pan.x) / zoom;
        const currentY = (e.clientY - container.top - pan.y) / zoom;
        setConnectingWire((prev) => (prev ? { ...prev, currentX, currentY } : null));
      } else if (isPanning) {
        setPan({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        });
      }
    };

    const handleWindowPointerUp = (e: PointerEvent) => {
      if (draggingNodeId) {
        // If user clicked without dragging on an already-selected node (without Shift),
        // collapse selection to just that single clicked node and ensure inspector is open
        if (!dragDidMoveRef.current && pendingSingleSelectNodeIdRef.current) {
          const singleId = pendingSingleSelectNodeIdRef.current;
          setSelectedNodeIds([singleId]);
          pendingSingleSelectNodeIdRef.current = null;
          const node = recipe.nodes.find((n) => n.id === singleId);
          if (
            node &&
            (node.type === 'imageModel' ||
              node.type === 'geminiVideo' ||
              node.type === 'vidsVideo' ||
              node.type === 'anyLLM' ||
              node.type === 'promptEnhancer' ||
              node.type === 'storyboard')
          ) {
            setIsInspectorOpen(true);
          }
        }

        if (dragSnapshotRef.current) {
          const snapshot = dragSnapshotRef.current;
          const hasMoved = recipeRef.current.nodes.some((n) => {
            const startPos = dragStartPositionsRef.current.get(n.id);
            return startPos && (startPos.x !== n.position.x || startPos.y !== n.position.y);
          });
          if (hasMoved) {
            setUndoStack((prev) => [...prev.slice(-30), snapshot]);
            setRedoStack([]);
          }
          dragSnapshotRef.current = null;
        }
        setDraggingNodeId(null);
      }
      if (isPanning) setIsPanning(false);

      if (connectingWire) {
        wirePointerClientRef.current = null;
        const container = canvasContainerRef.current?.getBoundingClientRect();
        const releaseCanvasX = container
          ? (e.clientX - container.left - pan.x) / zoom
          : connectingWire.currentX;
        const releaseCanvasY = container
          ? (e.clientY - container.top - pan.y) / zoom
          : connectingWire.currentY;

        const dragDist = Math.hypot(
          releaseCanvasX - connectingWire.startX,
          releaseCanvasY - connectingWire.startY
        );

        // If pulled away into open canvas from an output port:
        if (!connectingWire.isInput && dragDist > 30) {
          const sourceNode = recipeRef.current.nodes.find((n) => n.id === connectingWire.sourceNodeId);

          if (sourceNode?.type === 'prompt') {
            // User pulled wire from Prompt output and dropped on empty canvas -> Auto-spawn Image Model Node!
            recordHistory();
            const modelNodeId = `node_imageModel_${Date.now()}`;
            const dropX = Math.round(releaseCanvasX);
            const dropY = Math.round(releaseCanvasY - 60);

            const newModelNode: CanvasNode = {
              id: modelNodeId,
              type: 'imageModel',
              title: 'Weavy',
              subtitle: 'Weavy AI Model',
              colorTheme: 'red',
              position: { x: dropX, y: dropY },
              inputs: [
                { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
                { id: 'input-image', name: 'image_1', type: 'image', label: 'Image 1', required: false },
              ],
              outputs: [
                { id: 'output-result', name: 'result', type: 'image', label: 'Generated Image' },
              ],
              data: {
                modelId: 'fal-ai/nano-banana-pro/edit',
                modelDisplayName: 'Gemini 3 (Nano Banana Pro)',
                provider: 'weavy',
                resolution: '1K',
                aspectRatio: '1:1',
                seed: Math.floor(Math.random() * 999999),
                isRandomSeed: true,
                creditsCost: 11,
              },
            };

            const newEdge: CanvasEdge = {
              id: `edge_${sourceNode.id}_${modelNodeId}_${Date.now()}`,
              sourceNodeId: sourceNode.id,
              sourceOutputId: connectingWire.sourcePortId || 'output-text',
              targetNodeId: modelNodeId,
              targetInputId: 'input-prompt',
              color: '#10b981',
            };

            setRecipe((prev) => ({
              ...prev,
              nodes: [...prev.nodes, newModelNode],
              edges: [
                ...prev.edges.filter(
                  (ed) => !(ed.targetNodeId === modelNodeId && ed.targetInputId === 'input-prompt')
                ),
                newEdge,
              ],
            }));
            setSelectedNodeIds([modelNodeId]);
            setStatusMessage('✓ Node Model AI otomatis dibuat dan terhubung!');
          } else if (sourceNode?.type === 'imageModel') {
            // User pulled wire from Image Model output and dropped on empty canvas -> Auto-spawn next Model Node in chain!
            recordHistory();
            const nextModelNodeId = `node_imageModel_${Date.now()}`;
            const dropX = Math.round(releaseCanvasX);
            const dropY = Math.round(releaseCanvasY - 94);

            const newModelNode: CanvasNode = {
              id: nextModelNodeId,
              type: 'imageModel',
              title: 'Nano Banana Pro',
              subtitle: 'Image Pipeline',
              colorTheme: 'amber',
              position: { x: dropX, y: dropY },
              inputs: [
                { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt' },
                { id: 'input-image-1', name: 'image', type: 'image', label: 'Image 1' },
              ],
              outputs: [
                { id: 'output-result', name: 'image', type: 'image', label: 'Output' },
              ],
              data: {
                modelId: 'nano-banana-pro',
                modelName: 'Nano Banana Pro',
                aspectRatio: '3:4',
                status: 'idle',
              },
            };

            const newEdge: CanvasEdge = {
              id: `edge_${sourceNode.id}_${nextModelNodeId}_${Date.now()}`,
              sourceNodeId: sourceNode.id,
              sourceOutputId: connectingWire.sourcePortId || 'output-result',
              targetNodeId: nextModelNodeId,
              targetInputId: 'input-image-1',
              color: '#10b981',
            };

            setRecipe((prev) => ({
              ...prev,
              nodes: [...prev.nodes, newModelNode],
              edges: [
                ...prev.edges.filter(
                  (ed) => !(ed.targetNodeId === nextModelNodeId && ed.targetInputId === 'input-image-1')
                ),
                newEdge,
              ],
            }));
            setSelectedNodeIds([nextModelNodeId]);
            setStatusMessage('✓ Node Model AI berikutnya otomatis dibuat dan terhubung!');
          } else if (sourceNode?.type === 'storyboard') {
            // Tarik kabel dari konektor "Scene N Image" / "Scene N Video" Storyboard Copilot lalu lepas di canvas kosong:
            //  - Scene N Image -> otomatis buat node Model Gambar & sambungkan ke input Prompt
            //  - Scene N Video -> otomatis buat node Gemini Omni Flash & sambungkan ke input Prompt
            const portMatch = /^scene(\d+)_(image|video)$/i.exec(connectingWire.sourcePortId || '');
            if (portMatch) {
              recordHistory();
              const sceneNum = parseInt(portMatch[1], 10);
              const kind = portMatch[2].toLowerCase() as 'image' | 'video';
              const scenesList = dedupeStoryboardScenes(sourceNode.data?.scenes);
              const scene: any =
                scenesList.find((sc: any, i: number) => (sc.sceneNumber || i + 1) === sceneNum) || {};
              const dropX = Math.round(releaseCanvasX);
              const dropY = Math.round(releaseCanvasY - 60);
              const ts = Date.now();
              const aspect = sourceNode.data?.aspectRatio || '9:16';

              let newNode: CanvasNode;
              if (kind === 'image') {
                newNode = {
                  id: `node_imageModel_${ts}`,
                  type: 'imageModel',
                  title: 'Weavy Image Engine',
                  subtitle: `Nano Banana Pro (Scene ${sceneNum})`,
                  colorTheme: 'red',
                  position: { x: dropX, y: dropY },
                  inputs: [
                    { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
                    { id: 'input-image', name: 'image_1', type: 'image', label: 'Image 1', required: false },
                  ],
                  outputs: [
                    { id: 'output-result', name: 'result', type: 'image', label: 'Generated Image' },
                  ],
                  data: {
                    modelId: 'fal-ai/nano-banana-pro/edit',
                    modelDisplayName: 'Nano Banana Pro',
                    provider: 'weavy',
                    resolution: '1K',
                    aspectRatio: aspect,
                    seed: Math.floor(Math.random() * 999999),
                    isRandomSeed: true,
                    creditsCost: 11,
                    promptOverride: scene.imagePrompt || scene.visualDescription || '',
                    sceneNumber: sceneNum,
                    sceneTitle: scene.title,
                    voiceover: scene.voiceover,
                    shoots: scene.shoots,
                  },
                };
              } else {
                newNode = {
                  id: `node_geminiVideo_${ts}`,
                  type: 'geminiVideo',
                  title: 'Gemini Omni Flash',
                  subtitle: `Scene ${sceneNum} Video (${scene.durationSec || 10}s)`,
                  colorTheme: 'purple',
                  position: { x: dropX, y: dropY },
                  inputs: [
                    { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
                    { id: 'input-image', name: 'image_1', type: 'image', label: 'Image 1', required: false },
                  ],
                  outputs: [
                    { id: 'output-video', name: 'video', type: 'video', label: 'Generated Video' },
                  ],
                  data: {
                    modelId: 'gemini-omni-1.1-flash',
                    modelDisplayName: 'Gemini Omni Flash',
                    provider: 'gemini',
                    duration: `${scene.durationSec || 10}s`,
                    aspectRatio: aspect,
                    creditsCost: 0,
                    status: 'idle',
                    progress: 0,
                    promptOverride: formatSceneVideoPrompt(scene),
                    voiceover: scene.voiceover,
                    shoots: scene.shoots,
                    sceneNumber: sceneNum,
                    sceneTitle: scene.title,
                    visualDescription: scene.visualDescription,
                    videoPrompt: scene.videoPrompt,
                  },
                };
              }

              const newEdge: CanvasEdge = {
                id: `edge_${sourceNode.id}_${newNode.id}_${ts}`,
                sourceNodeId: sourceNode.id,
                sourceOutputId: connectingWire.sourcePortId || '',
                targetNodeId: newNode.id,
                targetInputId: 'input-prompt',
                color: '#f59e0b',
              };

              setRecipe((prev) => ({
                ...prev,
                nodes: [...prev.nodes, newNode],
                edges: [...prev.edges, newEdge],
              }));
              setSelectedNodeIds([newNode.id]);
              setStatusMessage(
                kind === 'image'
                  ? `✓ Node Model Gambar untuk Scene ${sceneNum} otomatis dibuat dan terhubung!`
                  : `✓ Node Gemini Omni Flash untuk Scene ${sceneNum} otomatis dibuat dan terhubung!`
              );
            }
          } else if (sourceNode?.type === 'imageInput') {
            // User pulled wire from Source Image output and dropped on empty canvas -> Auto-spawn Model Node connected to image!
            recordHistory();
            const modelNodeId = `node_imageModel_${Date.now()}`;
            const dropX = Math.round(releaseCanvasX);
            const dropY = Math.round(releaseCanvasY - 94);

            const newModelNode: CanvasNode = {
              id: modelNodeId,
              type: 'imageModel',
              title: 'Weavy',
              subtitle: 'Weavy AI Model',
              colorTheme: 'red',
              position: { x: dropX, y: dropY },
              inputs: [
                { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
                { id: 'input-image', name: 'image_1', type: 'image', label: 'Image 1', required: false },
              ],
              outputs: [
                { id: 'output-result', name: 'result', type: 'image', label: 'Generated Image' },
              ],
              data: {
                modelId: 'fal-ai/nano-banana-pro/edit',
                modelDisplayName: 'Gemini 3 (Nano Banana Pro)',
                provider: 'weavy',
                resolution: '1K',
                aspectRatio: '1:1',
                seed: Math.floor(Math.random() * 999999),
                isRandomSeed: true,
                creditsCost: 11,
              },
            };

            const newEdge: CanvasEdge = {
              id: `edge_${sourceNode.id}_${modelNodeId}_${Date.now()}`,
              sourceNodeId: sourceNode.id,
              sourceOutputId: connectingWire.sourcePortId || 'output-image',
              targetNodeId: modelNodeId,
              targetInputId: 'input-image',
              color: '#14b8a6',
            };

            setRecipe((prev) => ({
              ...prev,
              nodes: [...prev.nodes, newModelNode],
              edges: [
                ...prev.edges.filter(
                  (ed) => !(ed.targetNodeId === modelNodeId && ed.targetInputId === 'input-image')
                ),
                newEdge,
              ],
            }));
            setSelectedNodeIds([modelNodeId]);
            setStatusMessage('✓ Node Model AI otomatis dibuat dan terhubung!');
          }
        } else if (connectingWire.isInput && dragDist > 30) {
          // User pulled wire FROM an input connector (e.g. Prompt* or Image 1 on Model node) into empty canvas!
          const targetNode = recipeRef.current.nodes.find((n) => n.id === connectingWire.sourceNodeId);
          if (targetNode) {
            const inputPort = targetNode.inputs.find((p) => p.id === connectingWire.sourcePortId);
            const portIdLower = (connectingWire.sourcePortId || '').toLowerCase();
            const portNameLower = (inputPort?.name || '').toLowerCase();
            const portLabelLower = (inputPort?.label || '').toLowerCase();

            const isAiWorkerPort =
              targetNode.type === 'storyboard' &&
              (portIdLower.includes('ai-worker') ||
                portIdLower.includes('ai_worker') ||
                portNameLower === 'ai_worker_context' ||
                portLabelLower === 'ai worker');
            const isPromptPort =
              !isAiWorkerPort &&
              (inputPort?.type === 'text' ||
                portIdLower.includes('prompt') ||
                portNameLower.includes('prompt') ||
                portLabelLower.includes('prompt'));

            const isImagePort =
              inputPort?.type === 'image' ||
              portIdLower.includes('image') ||
              portNameLower.includes('image') ||
              portLabelLower.includes('image');

            const nodeWidth = 340;

            if (isAiWorkerPort) {
              recordHistory();
              const aiWorkerNodeId = `node_aiWorker_${Date.now()}`;
              const dropX =
                releaseCanvasX < connectingWire.startX
                  ? Math.round(releaseCanvasX - nodeWidth + 20)
                  : Math.round(releaseCanvasX);
              const dropY = Math.round(releaseCanvasY - 50);

              const newAiWorkerNode: CanvasNode = {
                id: aiWorkerNodeId,
                type: 'aiWorker',
                title: 'AI Worker',
                subtitle: 'Ekstraksi link produk',
                colorTheme: 'green',
                position: { x: dropX, y: dropY },
                inputs: [
                  { id: 'input-link', name: 'link', type: 'text', label: 'Link', required: false },
                ],
                outputs: getAiWorkerOutputs({}),
                data: {
                  linkText: '',
                  note: '',
                  status: 'idle',
                  progress: 0,
                },
              };

              const newEdge: CanvasEdge = {
                id: `edge_${aiWorkerNodeId}_${targetNode.id}_${Date.now()}`,
                sourceNodeId: aiWorkerNodeId,
                sourceOutputId: 'output-context',
                targetNodeId: targetNode.id,
                targetInputId: connectingWire.sourcePortId,
                color: '#a855f7',
              };

              setRecipe((prev) => ({
                ...prev,
                nodes: [...prev.nodes, newAiWorkerNode],
                edges: [
                  ...prev.edges.filter(
                    (ed) => !(ed.targetNodeId === targetNode.id && ed.targetInputId === connectingWire.sourcePortId)
                  ),
                  newEdge,
                ],
              }));
              setSelectedNodeIds([aiWorkerNodeId]);
              setStatusMessage('✓ Node AI Worker otomatis dibuat dan tersambung!');
            } else if (isPromptPort) {
              recordHistory();
              const promptNodeId = `node_prompt_${Date.now()}`;
              // Position node so its right-side output port lands near the drop position
              const dropX =
                releaseCanvasX < connectingWire.startX
                  ? Math.round(releaseCanvasX - nodeWidth + 20)
                  : Math.round(releaseCanvasX);
              const dropY = Math.round(releaseCanvasY - 50);

              const newPromptNode: CanvasNode = {
                id: promptNodeId,
                type: 'prompt',
                title: 'Text Prompt',
                subtitle: 'Input prompt teks',
                colorTheme: 'green',
                position: { x: dropX, y: dropY },
                inputs: [],
                outputs: [
                  { id: 'output-text', name: 'text', type: 'text', label: 'Text Prompt' },
                ],
                data: {
                  prompt: '',
                  negativePrompt: '',
                },
              };

              const newEdge: CanvasEdge = {
                id: `edge_${promptNodeId}_${targetNode.id}_${Date.now()}`,
                sourceNodeId: promptNodeId,
                sourceOutputId: 'output-text',
                targetNodeId: targetNode.id,
                targetInputId: connectingWire.sourcePortId,
                color: '#10b981',
              };

              setRecipe((prev) => ({
                ...prev,
                nodes: [...prev.nodes, newPromptNode],
                edges: [
                  ...prev.edges.filter(
                    (ed) => !(ed.targetNodeId === targetNode.id && ed.targetInputId === connectingWire.sourcePortId)
                  ),
                  newEdge,
                ],
              }));
              setSelectedNodeIds([promptNodeId]);
              setStatusMessage('✓ Node Text Prompt otomatis dibuat dan tersambung!');
            } else if (isImagePort) {
              recordHistory();
              const imageNodeId = `node_imageInput_${Date.now()}`;
              // Position node so its right-side output port lands near the drop position
              const dropX =
                releaseCanvasX < connectingWire.startX
                  ? Math.round(releaseCanvasX - nodeWidth + 20)
                  : Math.round(releaseCanvasX);
              const dropY = Math.round(releaseCanvasY - 70);

              const newImageNode: CanvasNode = {
                id: imageNodeId,
                type: 'imageInput',
                title: 'Source Image',
                subtitle: 'Input gambar referensi',
                colorTheme: 'blue',
                position: { x: dropX, y: dropY },
                inputs: [],
                outputs: [
                  { id: 'output-image', name: 'image', type: 'image', label: 'Image Output' },
                ],
                data: {
                  imageUrl: '',
                  fileName: '',
                },
              };

              const newEdge: CanvasEdge = {
                id: `edge_${imageNodeId}_${targetNode.id}_${Date.now()}`,
                sourceNodeId: imageNodeId,
                sourceOutputId: 'output-image',
                targetNodeId: targetNode.id,
                targetInputId: connectingWire.sourcePortId,
                color: '#14b8a6',
              };

              setRecipe((prev) => ({
                ...prev,
                nodes: [...prev.nodes, newImageNode],
                edges: [
                  ...prev.edges.filter(
                    (ed) => !(ed.targetNodeId === targetNode.id && ed.targetInputId === connectingWire.sourcePortId)
                  ),
                  newEdge,
                ],
              }));
              setSelectedNodeIds([imageNodeId]);
              setStatusMessage('✓ Node Source Image otomatis dibuat dan tersambung!');
            }
          }
        }

        setConnectingWire(null);
      }

      if (marqueeBox) {
        setMarqueeBox(null);
        marqueeInitialSelectionRef.current = [];
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, [draggingNodeId, isPanning, connectingWire, marqueeBox, pan.x, pan.y, zoom]);

  // Edge auto-pan while connecting a wire. When the pointer reaches the viewport
  // edge, continuously move the canvas in that direction until the pointer moves
  // away or the user releases the wire. This mirrors node-editor UX in tools like
  // Weavy/ComfyUI and keeps the wire attached to the cursor during the pan.
  const isConnectingWire = connectingWire !== null;
  useEffect(() => {
    if (!isConnectingWire) {
      wirePointerClientRef.current = null;
      return;
    }

    let frameId = 0;
    const edgeSize = 64;
    const maxSpeed = 14;

    const autoPanFrame = () => {
      const container = canvasContainerRef.current?.getBoundingClientRect();
      const pointer = wirePointerClientRef.current;

      if (container && pointer) {
        let dx = 0;
        let dy = 0;

        if (pointer.x < container.left + edgeSize) {
          dx = maxSpeed * (1 - Math.max(0, pointer.x - container.left) / edgeSize);
        } else if (pointer.x > container.right - edgeSize) {
          dx = -maxSpeed * (1 - Math.max(0, container.right - pointer.x) / edgeSize);
        }

        if (pointer.y < container.top + edgeSize) {
          dy = maxSpeed * (1 - Math.max(0, pointer.y - container.top) / edgeSize);
        } else if (pointer.y > container.bottom - edgeSize) {
          dy = -maxSpeed * (1 - Math.max(0, container.bottom - pointer.y) / edgeSize);
        }

        if (dx !== 0 || dy !== 0) {
          const currentPan = panRef.current;
          const nextPan = { x: currentPan.x + dx, y: currentPan.y + dy };
          // Update the ref immediately so wire coordinates remain in sync before React rerenders.
          panRef.current = nextPan;
          setPan(nextPan);
          setConnectingWire((prev) => {
            if (!prev) return null;
            const scale = zoomRef.current || 1;
            return {
              ...prev,
              currentX: (pointer.x - container.left - nextPan.x) / scale,
              currentY: (pointer.y - container.top - nextPan.y) / scale,
            };
          });
        }
      }

      frameId = window.requestAnimationFrame(autoPanFrame);
    };

    frameId = window.requestAnimationFrame(autoPanFrame);
    return () => window.cancelAnimationFrame(frameId);
  }, [isConnectingWire]);

  // Keyboard Shortcuts: Space to Pan, Escape to cancel, Delete to remove, Ctrl+A select all, Ctrl+Z undo, Ctrl+Y redo, V/H tool switch
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If modal is open, let modal handle its own key events
      if (markupModal.isOpen || fullPreviewModal.isOpen || isImportModalOpen) {
        return;
      }

      const activeEl = document.activeElement;
      const isTyping =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable);

      // Spacebar for fast canvas panning
      if (e.code === 'Space' || e.key === ' ') {
        if (!isTyping) {
          e.preventDefault();
          if (!isSpacePressedRef.current) {
            isSpacePressedRef.current = true;
            setIsSpacePressed(true);
          }
          return;
        }
      }

      if (e.key === 'Escape') {
        if (connectingWire) setConnectingWire(null);
        if (marqueeBox) setMarqueeBox(null);
        setSelectedNodeIds([]);
        setSelectedGroupId(null);
        setSelectedEdgeId(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!isTyping) {
          if (selectedEdgeId) {
            e.preventDefault();
            handleDeleteEdge(selectedEdgeId);
          } else if (selectedGroupId && selectedNodeIds.length === 0) {
            recordHistory();
            setRecipe((prev) => ({
              ...prev,
              groups: (prev.groups || []).filter((g) => g.id !== selectedGroupId),
            }));
            setSelectedGroupId(null);
            return;
          }

          if (selectedNodeIds.length > 0) {
            recordHistory();
            const idsToDelete = [...selectedNodeIds];
            setRecipe((prev) => ({
              ...prev,
              nodes: prev.nodes.filter((n) => !idsToDelete.includes(n.id)),
              edges: prev.edges.filter(
                (edge) =>
                  !idsToDelete.includes(edge.sourceNodeId) &&
                  !idsToDelete.includes(edge.targetNodeId)
              ),
              groups: (prev.groups || [])
                .map((g) => ({
                  ...g,
                  nodeIds: g.nodeIds.filter((id) => !idsToDelete.includes(id)),
                }))
                .filter((g) => g.nodeIds.length > 0),
            }));
            setSelectedNodeIds([]);
            setSelectedGroupId(null);
            setStatusMessage(
              idsToDelete.length > 1
                ? `${idsToDelete.length} node berhasil dihapus.`
                : 'Node berhasil dihapus.'
            );
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        if (!isTyping) {
          e.preventDefault();
          e.stopPropagation();

          const currentGroups = recipe.groups || [];
          let targetGroupToUngroup: CanvasGroup | null = null;

          // 1. Check if selectedGroupId points to a group
          if (selectedGroupId) {
            targetGroupToUngroup = currentGroups.find((g) => g.id === selectedGroupId) || null;
          }

          // 2. If no selectedGroupId, check if selected nodes match an existing group
          if (!targetGroupToUngroup && selectedNodeIds.length > 0) {
            targetGroupToUngroup =
              currentGroups.find(
                (g) =>
                  g.nodeIds.length > 0 &&
                  g.nodeIds.length === selectedNodeIds.length &&
                  g.nodeIds.every((id) => selectedNodeIds.includes(id))
              ) || null;

            if (!targetGroupToUngroup) {
              targetGroupToUngroup =
                currentGroups.find((g) =>
                  selectedNodeIds.every((id) => g.nodeIds.includes(id))
                ) || null;
            }
          }

          if (targetGroupToUngroup) {
            // UNGROUP / UNDO GRUP NODE
            recordHistory();
            setRecipe((prev) => ({
              ...prev,
              groups: (prev.groups || []).filter((g) => g.id !== targetGroupToUngroup!.id),
            }));
            setSelectedGroupId(null);
          } else if (selectedNodeIds.length > 0) {
            // CREATE GROUP
            recordHistory();
            const groupNum = (recipe.groups?.length || 0) + 1;
            const newGroupId = `group-${Date.now()}`;
            const newGroup: CanvasGroup = {
              id: newGroupId,
              title: `Group ${groupNum}`,
              nodeIds: [...selectedNodeIds],
            };

            setRecipe((prev) => {
              const cleanedGroups = (prev.groups || [])
                .map((g) => ({
                  ...g,
                  nodeIds: g.nodeIds.filter((id) => !selectedNodeIds.includes(id)),
                }))
                .filter((g) => g.nodeIds.length > 0);

              return {
                ...prev,
                groups: [...cleanedGroups, newGroup],
              };
            });
            setSelectedGroupId(newGroupId);
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        // Intercept Ctrl+D / Cmd+D to duplicate node, preventing browser bookmark dialog
        e.preventDefault();
        e.stopPropagation();

        let targetIds = [...selectedNodeIds];
        if (targetIds.length === 0 && activeEl) {
          const nodeCardEl = activeEl.closest('[data-node-id]');
          const foundId = nodeCardEl?.getAttribute('data-node-id');
          if (foundId) {
            targetIds = [foundId];
          }
        }

        if (targetIds.length > 0) {
          handleDuplicateNodes(targetIds);
        } else {
          setStatusMessage('Klik node terlebih dahulu, lalu tekan Ctrl+D untuk menduplikat.');
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (!isTyping) {
          e.preventDefault();
          runSelectedRef.current?.();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        if (!isTyping) {
          e.preventDefault();
          setSelectedNodeIds(recipe.nodes.map((n) => n.id));
          setIsInspectorOpen(false);
          setStatusMessage(`Semua node (${recipe.nodes.length}) terpilih.`);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (!isTyping) {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (!isTyping) {
          e.preventDefault();
          handleRedo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        if (!isTyping) {
          e.preventDefault();
          setZoom((z) => Math.min(z + 0.15, 3.0));
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        if (!isTyping) {
          e.preventDefault();
          setZoom((z) => Math.max(z - 0.15, 0.2));
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        if (!isTyping) {
          e.preventDefault();
          setZoom(1);
          setPan({ x: 40, y: 40 });
        }
      } else if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!isTyping) {
          setActiveTool('select');
        }
      } else if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!isTyping) {
          setActiveTool('pan');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        isSpacePressedRef.current = false;
        setIsSpacePressed(false);
      }
    };

    const handleBlur = () => {
      isSpacePressedRef.current = false;
      setIsSpacePressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [selectedNodeIds, selectedGroupId, selectedEdgeId, connectingWire, marqueeBox, recipe.nodes, recipe.groups, handleUndo, handleRedo, recordHistory, handleDeleteEdge, handleDuplicateNodes]);


  // Optional background upload of pasted image to Weavy asset CDN
  const uploadImageInBackground = useCallback(
    (base64: string, fileName: string, nodeId: string) => {
      const targetAccountToUse =
        currentActiveAccount ||
        weavyAccountsList.find((a) => a.isActive) ||
        weavyAccountsList[0];
      const tokenToUse = (targetAccountToUse ? (targetAccountToUse.idToken || '') : (weavyToken || ''));
      const refreshTokenToUse = (targetAccountToUse ? (targetAccountToUse.refreshToken || '') : (refreshToken || ''));

      if (!tokenToUse && !refreshTokenToUse) return;

      fetch('/api/upload-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64,
          fileName,
          refreshToken: refreshTokenToUse,
          idToken: tokenToUse,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.url) {
            setRecipe((prev) => ({
              ...prev,
              nodes: prev.nodes.map((n) =>
                n.id === nodeId
                  ? { ...n, data: { ...n.data, imageUrl: data.url } }
                  : n
              ),
            }));
          }
        })
        .catch((err) => {
          console.warn('[Background Upload] Weavy CDN upload warning:', err);
        });
    },
    [currentActiveAccount, weavyAccountsList, weavyToken, refreshToken]
  );

  // Helper to extract image files from clipboard data
  const extractImagesFromClipboard = useCallback((clipboardData: DataTransfer): File[] => {
    const imageFiles: File[] = [];

    // Check files array
    if (clipboardData.files && clipboardData.files.length > 0) {
      for (let i = 0; i < clipboardData.files.length; i++) {
        const file = clipboardData.files[i];
        if (
          file.type.startsWith('image/') ||
          file.name.match(/\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i)
        ) {
          imageFiles.push(file);
        }
      }
    }

    // Check items (screenshots, copied bitmaps)
    if (imageFiles.length === 0 && clipboardData.items) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const ext = item.type.split('/')[1] || 'png';
            const namedFile = new File(
              [file],
              file.name && file.name !== 'image.png'
                ? file.name
                : `pasted_image_${Date.now()}.${ext}`,
              { type: file.type }
            );
            imageFiles.push(namedFile);
          }
        }
      }
    }

    return imageFiles;
  }, []);

  // Helper to read file as dataUrl and extract natural dimensions + aspect ratio
  const processImageFile = useCallback((file: File | Blob): Promise<{
    dataUrl: string;
    fileName: string;
    width: number;
    height: number;
    aspectRatio: string;
  }> => {
    return new Promise((resolve) => {
      const defaultName = `pasted_image_${Date.now()}.png`;
      const fileName = (file as File).name || defaultName;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const width = img.naturalWidth || 512;
          const height = img.naturalHeight || 512;
          const detectedRatio =
            width / height >= 1.5
              ? '16:9'
              : width / height >= 1.15
              ? '4:3'
              : height / width >= 1.5
              ? '9:16'
              : height / width >= 1.15
              ? '3:4'
              : '1:1';
          resolve({ dataUrl, fileName, width, height, aspectRatio: detectedRatio });
        };
        img.onerror = () => {
          resolve({ dataUrl, fileName, width: 512, height: 512, aspectRatio: '1:1' });
        };
        img.src = dataUrl;
      };
      reader.onerror = () => {
        resolve({ dataUrl: '', fileName, width: 512, height: 512, aspectRatio: '1:1' });
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Core processor for pasted or dropped image files
  const handleProcessImages = useCallback(
    async (
      files: (File | Blob)[],
      targetPosition?: { x: number; y: number }
    ) => {
      if (!files || files.length === 0) return;

      setStatusMessage(`Memproses ${files.length} gambar yang di-paste...`);

      const processedList: {
        dataUrl: string;
        fileName: string;
        width: number;
        height: number;
        aspectRatio: string;
      }[] = [];

      for (const file of files) {
        const res = await processImageFile(file);
        if (res.dataUrl) {
          processedList.push(res);
        }
      }

      if (processedList.length === 0) {
        setStatusMessage('Gagal membaca data gambar dari clipboard.');
        return;
      }

      recordHistory();

      const currentRecipe = recipeRef.current;
      const selectedIds = selectedNodeIdsRef.current;

      // Case 1: Exactly 1 image pasted AND an imageInput node is currently selected -> replace image on selected node
      if (processedList.length === 1 && selectedIds.length === 1) {
        const targetNode = currentRecipe.nodes.find((n) => n.id === selectedIds[0]);
        if (targetNode && targetNode.type === 'imageInput') {
          const item = processedList[0];
          setRecipe((prev) => ({
            ...prev,
            nodes: prev.nodes.map((n) =>
              n.id === targetNode.id
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      imageUrl: item.dataUrl,
                      fileName: item.fileName,
                      naturalWidth: item.width,
                      naturalHeight: item.height,
                      aspectRatio: item.aspectRatio,
                    },
                  }
                : n
            ),
          }));
          setStatusMessage(
            `📸 Berhasil upload gambar (${item.fileName}) ke node "${targetNode.title}"!`
          );
          uploadImageInBackground(item.dataUrl, item.fileName, targetNode.id);
          return;
        }

        // Case 2: Exactly 1 image pasted AND an imageModel node is selected -> create imageInput & wire to model
        if (targetNode && targetNode.type === 'imageModel') {
          const item = processedList[0];
          const newId = `node_imageInput_${Date.now()}`;
          const posX = targetNode.position.x - 340;
          const posY = targetNode.position.y;

          const newNode: CanvasNode = {
            id: newId,
            type: 'imageInput',
            title: 'Source Image',
            subtitle: 'Input gambar referensi',
            colorTheme: 'blue',
            position: { x: posX, y: posY },
            inputs: [],
            outputs: [
              { id: 'output-image', name: 'image', type: 'image', label: 'Image Output' },
            ],
            data: {
              imageUrl: item.dataUrl,
              fileName: item.fileName,
              naturalWidth: item.width,
              naturalHeight: item.height,
              aspectRatio: item.aspectRatio,
            },
          };

          const targetPort =
            targetNode.inputs.find((inp) => inp.type === 'image')?.id || 'input-image';
          const newEdge: CanvasEdge = {
            id: `edge_${newId}_output-image_${targetNode.id}_${targetPort}`,
            sourceNodeId: newId,
            sourceOutputId: 'output-image',
            targetNodeId: targetNode.id,
            targetInputId: targetPort,
            color: '#3b82f6',
          };

          setRecipe((prev) => ({
            ...prev,
            nodes: [...prev.nodes, newNode],
            edges: [
              ...prev.edges.filter(
                (e) => !(e.targetNodeId === targetNode.id && e.targetInputId === targetPort)
              ),
              newEdge,
            ],
          }));
          setSelectedNodeIds([newId]);
          setStatusMessage(
            `📸 Node Image Input baru dibuat dan dihubungkan ke "${
              targetNode.data?.modelDisplayName || targetNode.title
            }"!`
          );
          uploadImageInBackground(item.dataUrl, item.fileName, newId);
          return;
        }
      }

      // Case 3: Create new imageInput node(s) on canvas (positioned at cursor or viewport center)
      let basePosition = targetPosition;
      if (!basePosition) {
        if (lastPointerCanvasPosRef.current) {
          basePosition = {
            x: Math.round(lastPointerCanvasPosRef.current.x - 140),
            y: Math.round(lastPointerCanvasPosRef.current.y - 100),
          };
        } else {
          const container = canvasContainerRef.current?.getBoundingClientRect();
          const centerX = container ? container.width / 2 : window.innerWidth / 2;
          const centerY = container ? container.height / 2 : window.innerHeight / 2;
          basePosition = {
            x: Math.round((centerX - panRef.current.x) / zoomRef.current - 140),
            y: Math.round((centerY - panRef.current.y) / zoomRef.current - 100),
          };
        }
      }

      const newNodes: CanvasNode[] = [];
      const newNodeIds: string[] = [];

      processedList.forEach((item, idx) => {
        const newId = `node_imageInput_${Date.now()}_${idx}`;
        newNodeIds.push(newId);
        newNodes.push({
          id: newId,
          type: 'imageInput',
          title: 'Source Image',
          subtitle: 'Input gambar referensi',
          colorTheme: 'blue',
          position: {
            x: basePosition!.x + idx * 40,
            y: basePosition!.y + idx * 40,
          },
          inputs: [],
          outputs: [
            { id: 'output-image', name: 'image', type: 'image', label: 'Image Output' },
          ],
          data: {
            imageUrl: item.dataUrl,
            fileName: item.fileName,
            naturalWidth: item.width,
            naturalHeight: item.height,
            aspectRatio: item.aspectRatio,
          },
        });

        uploadImageInBackground(item.dataUrl, item.fileName, newId);
      });

      setRecipe((prev) => ({
        ...prev,
        nodes: [...prev.nodes, ...newNodes],
      }));
      setSelectedNodeIds(newNodeIds);

      setStatusMessage(
        newNodes.length === 1
          ? `📸 Gambar (${processedList[0].fileName}) berhasil di-paste & di-upload ke Canvas!`
          : `📸 ${newNodes.length} gambar berhasil di-paste & di-upload ke Canvas!`
      );
    },
    [recordHistory, processImageFile, uploadImageInBackground]
  );

  // Helper to load and process pasted image URL
  const handleProcessImageUrl = useCallback(
    async (url: string, targetPosition?: { x: number; y: number }) => {
      const trimmed = url.trim();
      if (!trimmed.startsWith('http') && !trimmed.startsWith('data:image/')) return false;

      try {
        setStatusMessage('Memuat URL gambar yang di-paste...');
        const img = new Image();
        const loaded = await new Promise<boolean>((resolve) => {
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = trimmed;
        });

        if (loaded) {
          const width = img.naturalWidth || 512;
          const height = img.naturalHeight || 512;
          const detectedRatio =
            width / height >= 1.5
              ? '16:9'
              : width / height >= 1.15
              ? '4:3'
              : height / width >= 1.5
              ? '9:16'
              : height / width >= 1.15
              ? '3:4'
              : '1:1';

          const fileName =
            trimmed.split('/').pop()?.split('?')[0] || 'pasted_web_image.jpg';

          recordHistory();
          const currentRecipe = recipeRef.current;
          const selectedIds = selectedNodeIdsRef.current;

          if (selectedIds.length === 1) {
            const targetNode = currentRecipe.nodes.find((n) => n.id === selectedIds[0]);
            if (targetNode && targetNode.type === 'imageInput') {
              setRecipe((prev) => ({
                ...prev,
                nodes: prev.nodes.map((n) =>
                  n.id === targetNode.id
                    ? {
                        ...n,
                        data: {
                          ...n.data,
                          imageUrl: trimmed,
                          fileName,
                          naturalWidth: width,
                          naturalHeight: height,
                          aspectRatio: detectedRatio,
                        },
                      }
                    : n
                ),
              }));
              setStatusMessage(`📸 Berhasil memuat URL gambar ke node "${targetNode.title}"!`);
              return true;
            }
          }

          let basePosition = targetPosition;
          if (!basePosition) {
            if (lastPointerCanvasPosRef.current) {
              basePosition = {
                x: Math.round(lastPointerCanvasPosRef.current.x - 140),
                y: Math.round(lastPointerCanvasPosRef.current.y - 100),
              };
            } else {
              const container = canvasContainerRef.current?.getBoundingClientRect();
              const centerX = container ? container.width / 2 : window.innerWidth / 2;
              const centerY = container ? container.height / 2 : window.innerHeight / 2;
              basePosition = {
                x: Math.round((centerX - panRef.current.x) / zoomRef.current - 140),
                y: Math.round((centerY - panRef.current.y) / zoomRef.current - 100),
              };
            }
          }

          const newId = `node_imageInput_${Date.now()}`;
          const newNode: CanvasNode = {
            id: newId,
            type: 'imageInput',
            title: 'Source Image',
            subtitle: 'Input gambar referensi',
            colorTheme: 'blue',
            position: basePosition!,
            inputs: [],
            outputs: [
              { id: 'output-image', name: 'image', type: 'image', label: 'Image Output' },
            ],
            data: {
              imageUrl: trimmed,
              fileName,
              naturalWidth: width,
              naturalHeight: height,
              aspectRatio: detectedRatio,
            },
          };

          setRecipe((prev) => ({
            ...prev,
            nodes: [...prev.nodes, newNode],
          }));
          setSelectedNodeIds([newId]);
          setStatusMessage(`📸 Node Image Input baru dibuat dari URL gambar!`);
          return true;
        }
      } catch (err) {
        console.warn('Failed to load image from url:', err);
      }
      return false;
    },
    [recordHistory]
  );

  // Global window paste event listener: allows Ctrl+V paste from PC / clipboard anywhere on Canvas
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl &&
        ((activeEl.tagName === 'INPUT' && (activeEl as HTMLInputElement).type !== 'file') ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const imageFiles = extractImagesFromClipboard(clipboardData);

      if (imageFiles.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        handleProcessImages(imageFiles);
        return;
      }

      // If user is not typing in a text field, check if text in clipboard is an image URL or dataUrl
      if (!isTyping) {
        const text = clipboardData.getData('text/plain')?.trim();
        if (
          text &&
          (text.startsWith('data:image/') ||
            text.match(/^https?:\/\/.*\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$/i))
        ) {
          e.preventDefault();
          e.stopPropagation();
          handleProcessImageUrl(text);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [extractImagesFromClipboard, handleProcessImages, handleProcessImageUrl]);

  // Pointer position tracker for accurate paste/drop coordinates
  const handleContainerPointerMove = useCallback((e: React.PointerEvent) => {
    const container = canvasContainerRef.current?.getBoundingClientRect();
    if (container) {
      const mouseCanvasX = (e.clientX - container.left - panRef.current.x) / zoomRef.current;
      const mouseCanvasY = (e.clientY - container.top - panRef.current.y) / zoomRef.current;
      lastPointerCanvasPosRef.current = { x: mouseCanvasX, y: mouseCanvasY };
    }
  }, []);

  // Canvas Drag & Drop handlers
  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      setIsCanvasDragOver(true);
    }
  }, []);

  const handleCanvasDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsCanvasDragOver(false);
  }, []);

  const handleCanvasDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsCanvasDragOver(false);

      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (
          file.type.startsWith('image/') ||
          file.name.match(/\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i)
        ) {
          imageFiles.push(file);
        }
      }

      if (imageFiles.length === 0) return;

      const container = canvasContainerRef.current?.getBoundingClientRect();
      let dropPosition: { x: number; y: number } | undefined;
      if (container) {
        dropPosition = {
          x: Math.round((e.clientX - container.left - panRef.current.x) / zoomRef.current - 140),
          y: Math.round((e.clientY - container.top - panRef.current.y) / zoomRef.current - 100),
        };
      }

      handleProcessImages(imageFiles, dropPosition);
    },
    [handleProcessImages]
  );

  // Auto-Align Nodes in clean column workflow
  const handleAutoAlign = () => {
    recordHistory();
    const inputs = recipe.nodes.filter(
      (n) => n.type === 'prompt' || n.type === 'imageInput'
    );
    const models = recipe.nodes.filter((n) => n.type === 'imageModel');
    const viewers = recipe.nodes.filter((n) => n.type === 'imageViewer');

    const updatedNodes = [...recipe.nodes];

    let y1 = 120;
    inputs.forEach((n) => {
      const idx = updatedNodes.findIndex((x) => x.id === n.id);
      if (idx >= 0) {
        updatedNodes[idx] = { ...updatedNodes[idx], position: { x: 80, y: y1 } };
        y1 += 340;
      }
    });

    let y2 = 140;
    models.forEach((n) => {
      const idx = updatedNodes.findIndex((x) => x.id === n.id);
      if (idx >= 0) {
        updatedNodes[idx] = { ...updatedNodes[idx], position: { x: 480, y: y2 } };
        y2 += 440;
      }
    });

    let y3 = 140;
    viewers.forEach((n) => {
      const idx = updatedNodes.findIndex((x) => x.id === n.id);
      if (idx >= 0) {
        updatedNodes[idx] = { ...updatedNodes[idx], position: { x: 880, y: y3 } };
        y3 += 420;
      }
    });

    setRecipe((prev) => ({ ...prev, nodes: updatedNodes }));
    setPan({ x: 40, y: 40 });
    setZoom(1);
    setStatusMessage('✓ Layout node berhasil disusun rapi!');
  };

  // Canvas Context Menu (Right-Click on Canvas to Add Node)
  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't intercept right click inside form inputs or textareas so user can copy/paste naturally
    if (target.closest('input, textarea, select, [contenteditable="true"]')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Stop active panning
    setIsPanning(false);

    const container = canvasContainerRef.current?.getBoundingClientRect();
    const screenX = e.clientX;
    const screenY = e.clientY;

    let canvasX = 200;
    let canvasY = 200;
    if (container) {
      canvasX = Math.round((screenX - container.left - pan.x) / zoom - 50);
      canvasY = Math.round((screenY - container.top - pan.y) / zoom - 40);
    }

    setContextMenu({
      isOpen: true,
      position: { x: screenX, y: screenY },
      canvasPosition: { x: canvasX, y: canvasY },
    });
  };

  // Mouse / Canvas Panning & Selection Handler
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Close right-click context menu if open
    setContextMenu((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));

    // Check if space is held, pan tool active, or middle mouse clicked
    const isPanMode = isSpacePressedRef.current || activeTool === 'pan' || e.button === 1;

    // In pan mode, left click or middle click anywhere immediately pans the canvas!
    if (isPanMode && (e.button === 0 || e.button === 1)) {
      if (target.closest('input, textarea, select, button, a')) {
        return;
      }
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    // If clicking inside a node card or interactive element, don't pan or box-select canvas
    if (target.closest('[data-node-id], button, input, textarea, select, a')) {
      return;
    }

    // Cancel connecting wire if clicking blank canvas
    if (connectingWire) {
      setConnectingWire(null);
      return;
    }

    const isModifier = e.ctrlKey || e.metaKey || e.shiftKey;

    if (isModifier) {
      // User is holding Ctrl/Shift to drag-select a block of nodes
      const container = canvasContainerRef.current?.getBoundingClientRect();
      if (container) {
        const startX = (e.clientX - container.left - pan.x) / zoom;
        const startY = (e.clientY - container.top - pan.y) / zoom;
        marqueeInitialSelectionRef.current = e.shiftKey ? [...selectedNodeIds] : [];
        setMarqueeBox({
          startX,
          startY,
          currentX: startX,
          currentY: startY,
        });
      }
      return;
    }

    // Deselect active nodes and groups on simple blank canvas click
    setSelectedNodeIds([]);
    setSelectedGroupId(null);
    setSelectedEdgeId(null);

    // Left or Middle click on empty canvas pans canvas
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  // High-performance Native Wheel: Ctrl+Scroll to Zoom In/Out to Cursor, Normal Scroll to Pan
  useEffect(() => {
    if (!containerEl) return;

    const handleNativeWheel = (e: WheelEvent) => {
      // If user is inside a modal or overlay (e.g. CanvasMarkupModal, PreviewModal), let the modal handle wheel completely
      const target = e.target as HTMLElement | null;
      if (
        markupModal.isOpen ||
        fullPreviewModal.isOpen ||
        isImportModalOpen ||
        (target && target.closest('.fixed, [role="dialog"], [data-modal], .canvas-markup-modal'))
      ) {
        return;
      }

      // If user is doing normal scroll inside a textarea/input/dropdown, let the element scroll naturally
      const isInsideTextareaOrInput = target && target.closest('textarea, input, select');
      if (isInsideTextareaOrInput && !e.ctrlKey && !e.metaKey) {
        return;
      }

      // Block default browser page zooming or scrolling
      e.preventDefault();

      // Close context menu on canvas zoom/pan
      setContextMenu((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));

      if (e.ctrlKey || e.metaKey) {
        // Ctrl + Mouse Wheel / Trackpad pinch: Zoom in / Zoom out focused directly onto cursor position
        const rect = containerEl.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setZoom((currentZoom) => {
          const currentPan = panRef.current;
          const canvasX = (mouseX - currentPan.x) / currentZoom;
          const canvasY = (mouseY - currentPan.y) / currentZoom;

          // Sensitive step for smooth zoom
          const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
          const nextZoom = Math.min(Math.max(0.2, currentZoom * zoomFactor), 3.0);

          const nextPanX = mouseX - canvasX * nextZoom;
          const nextPanY = mouseY - canvasY * nextZoom;

          setPan({ x: Math.round(nextPanX), y: Math.round(nextPanY) });
          return nextZoom;
        });
      } else {
        // Regular wheel scroll without Ctrl: Pan canvas up/down and left/right
        const dx = e.shiftKey ? e.deltaY : e.deltaX;
        const dy = e.shiftKey ? 0 : e.deltaY;
        setPan((prev) => ({
          x: Math.round(prev.x - dx),
          y: Math.round(prev.y - dy),
        }));
      }
    };

    containerEl.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      containerEl.removeEventListener('wheel', handleNativeWheel);
    };
  }, [containerEl, markupModal.isOpen, fullPreviewModal.isOpen, isImportModalOpen]);

  // Prompt Enhancer & Any LLM execution handler
  const handleRunPromptEnhancerNode = async (enhancerNodeId: string) => {
    const enhancerNode = recipe.nodes.find((n) => n.id === enhancerNodeId);
    if (!enhancerNode || (enhancerNode.type !== 'promptEnhancer' && enhancerNode.type !== 'anyLLM')) return;

    const isAnyLLM = enhancerNode.type === 'anyLLM';
    const {
      prompt: resolvedPrompt,
      mainPrompt: resolvedMainPrompt,
      aiWorkerContext: resolvedAiWorkerContext,
      imageUrl: resolvedImageUrl,
      imageUrls: resolvedImageUrls,
    } = resolveEnhancerInputs(
      enhancerNodeId,
      recipe.nodes,
      recipe.edges
    );

    const effectivePrompt = (
      resolvedPrompt ||
      enhancerNode.data?.inputPrompt ||
      enhancerNode.data?.prompt ||
      enhancerNode.data?.generatedText ||
      enhancerNode.data?.enhancedPrompt ||
      ''
    ).trim();

    if (!effectivePrompt && !resolvedImageUrl && resolvedImageUrls.length === 0) {
      const errMsg = isAnyLLM
        ? 'Silakan hubungkan Node Prompt atau gambar pada Any LLM.'
        : 'Silakan hubungkan Node Prompt atau isi input teks pada Prompt Enhancer.';
      setStatusMessage(errMsg);
      setRecipe((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === enhancerNodeId
            ? { ...n, data: { ...n.data, errorMessage: errMsg } }
            : n
        ),
      }));
      return;
    }

    const targetAccountToUse = getSelectedWeavyAccountNow() || currentActiveAccount || (weavyAccountsList.find((a: any) => a.isActive) || weavyAccountsList[0]);
    const tokenToUse = (targetAccountToUse ? (targetAccountToUse.idToken || '') : (weavyToken || ''));
    const refreshTokenToUse = (targetAccountToUse ? (targetAccountToUse.refreshToken || '') : (refreshToken || ''));
    const allTokensToUse = weavyAccountsList.map((a: any) => a.refreshToken).filter(Boolean);

    const payloadPrompt = effectivePrompt || (resolvedImageUrl || resolvedImageUrls.length > 0 ? 'Jelaskan dan analisis gambar ini secara mendetail.' : 'Halo!');

    setIsExecuting(true);
    setExecutingProgress(20);
    setExecutingNodeId(enhancerNodeId);
    setExecutingNodeIds((prev) => [...prev.filter((id) => id !== enhancerNodeId), enhancerNodeId]);
    const modelName = enhancerNode.data?.modelDisplayName || (isAnyLLM ? 'Any LLM' : 'AI Enhancer');
    setStatusMessage(`Menjalankan ${modelName}...`);

    setRecipe((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === enhancerNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                status: 'running',
                progress: 20,
                errorMessage: undefined,
              },
            }
          : n
      ),
    }));

    try {
      const response = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: payloadPrompt,
          systemPrompt: enhancerNode.data?.systemPrompt,
          model: enhancerNode.data?.model || (isAnyLLM ? 'google/gemini-3-pro' : 'openai/gpt-5.6-sol'),
          imageUrl: resolvedImageUrl,
          images: resolvedImageUrls,
          temperature: enhancerNode.data?.temperature,
          thinking: enhancerNode.data?.thinking,
          nodeType: enhancerNode.type,
          isAnyLLM,
          refreshToken: refreshTokenToUse,
          idToken: tokenToUse,
          allRefreshTokens: allTokensToUse,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Gagal memproses LLM.');
      }

      const generatedResult = data.text || data.enhancedPrompt || '';

      if (typeof data.remainingCredits === 'number') {
        setCredits(data.remainingCredits);
        if (targetAccountToUse?.id) {
          const updatedAccounts = weavyAccountsList.map((a: any) =>
            a.id === targetAccountToUse.id ? { ...a, credits: data.remainingCredits } : a
          );
          setWeavyAccountsList(updatedAccounts);
          try {
            localStorage.setItem('weavy_accounts', JSON.stringify(updatedAccounts));
          } catch (e) {}
        }
      }

      setRecipe((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === enhancerNodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  status: 'completed',
                  progress: 100,
                  generatedText: generatedResult,
                  enhancedPrompt: generatedResult,
                  inputPrompt: effectivePrompt || payloadPrompt,
                  errorMessage: undefined,
                  generations: [
                    {
                      id: `gen_${Date.now()}`,
                      model: enhancerNode.data?.modelDisplayName || enhancerNode.data?.model || (isAnyLLM ? 'Any LLM' : 'Prompt Enhancer'),
                      value: generatedResult,
                      timestamp: new Date().toLocaleTimeString(),
                    },
                    ...(n.data?.generations || []),
                  ],
                },
              }
            : n
        ),
      }));

      setStatusMessage(`Respon dari ${modelName} berhasil diterima!`);
      setExecutingProgress(100);
    } catch (err: any) {
      console.error('Error running LLM node:', err);
      const errMsg = err.message || 'Gagal menjalankan LLM node.';
      setStatusMessage(`Gagal: ${errMsg}`);
      setRecipe((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === enhancerNodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  status: 'failed',
                  progress: 0,
                  errorMessage: errMsg,
                },
              }
            : n
        ),
      }));
    } finally {
      setExecutingProgress(0);
      setExecutingNodeIds((prev) => {
        const next = prev.filter((id) => id !== enhancerNodeId);
        if (next.length === 0) {
          setIsExecuting(false);
          setExecutingNodeId(null);
        } else {
          setExecutingNodeId(next[next.length - 1]);
        }
        return next;
      });
    }
  };

  // Execution Engine: Run Storyboard Copilot Node
  const handleRunStoryboardNode = async (storyboardNodeId: string) => {
    let storyboardNode = recipeRef.current.nodes.find((n) => n.id === storyboardNodeId);
    if (!storyboardNode || storyboardNode.type !== 'storyboard') return;
    let geminiLease: GeminiAccountLease | null = null;

    const connectedWorkerIds = recipeRef.current.edges
      .filter((edge) => edge.targetNodeId === storyboardNodeId)
      .map((edge) => recipeRef.current.nodes.find((node) => node.id === edge.sourceNodeId))
      .filter((node) => node?.type === 'aiWorker')
      .map((node) => node!.id);

    for (const workerId of connectedWorkerIds) {
      const workerNode = recipeRef.current.nodes.find((node) => node.id === workerId);
      if (!workerNode || workerNode.type !== 'aiWorker') continue;

      const workerInputs = resolveEnhancerInputs(workerId, recipeRef.current.nodes, recipeRef.current.edges);
      const linkText = (workerInputs.prompt || workerNode.data?.linkText || '').trim();
      const noteText = String(workerNode.data?.note || '');
      const currentAnalysisSignature = getAiWorkerAnalysisSignature(workerNode, linkText, noteText);
      const hasCurrentExtraction = Boolean(currentAnalysisSignature);

      if (!hasCurrentExtraction) {
        setStatusMessage(`AI Worker belum selesai atau link berubah. Menjalankan AI Worker "${workerNode.title || 'Produk'}" terlebih dahulu...`);
        await handleRunAiWorkerNode(workerId);

        const completedWorker = recipeRef.current.nodes.find((node) => node.id === workerId);
        if (
          completedWorker?.type !== 'aiWorker' ||
          completedWorker.data?.status !== 'completed' ||
          !completedWorker.data?.contextText?.trim() ||
          completedWorker.data?.processedLinkText !== linkText ||
          completedWorker.data?.processedNoteText !== noteText
        ) {
          setStatusMessage(
            `Storyboard dihentikan: AI Worker "${workerNode.title || 'Produk'}" gagal menyiapkan konteks produk. Periksa link dan hasil AI Worker, lalu coba lagi.`
          );
          return;
        }
      }
    }

    const connectedWorkers = recipeRef.current.edges
      .filter((edge) => edge.targetNodeId === storyboardNodeId)
      .map((edge) => recipeRef.current.nodes.find((node) => node.id === edge.sourceNodeId))
      .filter((node): node is CanvasNode => node?.type === 'aiWorker');

    storyboardNode = recipeRef.current.nodes.find((n) => n.id === storyboardNodeId);
    if (!storyboardNode || storyboardNode.type !== 'storyboard') return;

    // A Storyboard Copilot run must be grounded in at least one connected node.
    // Do not silently generate from the preset alone when all input cables are absent.
    const incomingStoryboardEdges = recipeRef.current.edges.filter((edge) => edge.targetNodeId === storyboardNodeId);
    const connectedSourceNodes = incomingStoryboardEdges
      .map((edge) => recipeRef.current.nodes.find((node) => node.id === edge.sourceNodeId))
      .filter((node): node is NonNullable<typeof node> => Boolean(node));
    if (incomingStoryboardEdges.length === 0 || connectedSourceNodes.length === 0) {
      setStatusMessage('Storyboard Copilot belum bisa dijalankan: hubungkan minimal satu node input (Prompt atau AI Worker) ke Storyboard Copilot.');
      return;
    }

    // Resolve every connected input from the live recipe graph before building the
    // request. resolveEnhancerInputs combines connected Prompt/AI Worker context
    // and connected media into the exact prompt/images sent to the selected model.
    const {
      prompt: resolvedPrompt,
      mainPrompt: resolvedMainPrompt,
      aiWorkerContext: resolvedAiWorkerContext,
      imageUrl: resolvedImageUrl,
      imageUrls: resolvedImageUrls,
    } = resolveEnhancerInputs(
      storyboardNodeId,
      recipeRef.current.nodes,
      recipeRef.current.edges
    );
    if (!resolvedPrompt.trim() && resolvedImageUrls.length === 0) {
      setStatusMessage('Storyboard Copilot tidak menemukan data dari node yang tersambung. Jalankan AI Worker terlebih dahulu atau isi node Prompt, lalu coba lagi.');
      return;
    }

    const hasConnectedWorkerImage = recipeRef.current.edges.some((edge) => {
      if (edge.targetNodeId !== storyboardNodeId) return false;
      const source = recipeRef.current.nodes.find((n) => n.id === edge.sourceNodeId);
      return source?.type === 'aiWorker' && String(edge.sourceOutputId || '').toLowerCase().includes('image');
    });
    if (hasConnectedWorkerImage && resolvedImageUrls.length === 0) {
      setStatusMessage('Storyboard dibatalkan: konektor gambar AI Worker tersambung, tetapi foto terpilih tidak berhasil dibaca. Periksa hasil AI Worker dan koneksi port gambar.');
      return;
    }

    const userBrief = (
      resolvedMainPrompt ||
      (resolvedAiWorkerContext ? '' : resolvedPrompt) ||
      storyboardNode.data?.brief ||
      storyboardNode.data?.prompt ||
      ''
    ).trim();

    const presetKey = storyboardNode.data?.presetKey || '/facelessgardenugc';
    const normalizedPresetKey = presetKey.replace(/^\//, '').toLowerCase();
    const normalizedGeneratedPresetKey = String(storyboardNode.data?.generatedPresetKey || '')
      .replace(/^\//, '')
      .toLowerCase();
    const normalizedFormula = String(storyboardNode.data?.formula || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const formulaMatchesPreset =
      normalizedFormula.includes(normalizedPresetKey) ||
      (normalizedPresetKey === 'facelessgardenugc' && /faceless|garden/.test(normalizedFormula)) ||
      (normalizedPresetKey === 'buahunggul' && /buah|unggul|bibit/.test(normalizedFormula)) ||
      (normalizedPresetKey === 'onthespot' && /spot|investigasi/.test(normalizedFormula)) ||
      (normalizedPresetKey === 'harvestpov' && /harvest|asmr/.test(normalizedFormula));
    const presetChangedSinceGeneration = Boolean(
      Array.isArray(storyboardNode.data?.scenes) &&
      storyboardNode.data.scenes.length > 0 &&
      (normalizedGeneratedPresetKey
        ? normalizedGeneratedPresetKey !== normalizedPresetKey
        : !formulaMatchesPreset)
    );
    const includesExpandedPreset = /\[STORYBOARD DIRECTOR PRESET:|STORYBOARD DIRECTOR & TIKTOK\/SHORTS ARCHITECT:/i.test(userBrief);
    let inputCommand = userBrief;
    if (!includesExpandedPreset && !inputCommand.startsWith('/')) {
      inputCommand = `${presetKey} ${userBrief}`;
    }
    // Resolve provider BEFORE expanding the slash preset. Chat and Canvas must
    // use the same provider-aware preset expansion rather than forcing Gemini.
    const provider = storyboardNode.data?.provider || 'weavy';
    const isGemini = provider === 'gemini';
    const expandedPrompt = expandChatPreset(inputCommand, provider);
    const connectedInputPriority = resolvedAiWorkerContext
      ? `

[DATA FAKTUAL AI WORKER]
${resolvedAiWorkerContext}
Gunakan sebagai sumber fakta produk. Jangan membuat klaim yang tidak didukung data.`
      : '';
    const connectedImageInstructions = resolvedImageUrls.length > 0
      ? `\n\n[WAJIB ANALISIS GAMBAR REFERENSI SEBELUM MEMBUAT PROJECT]\nAnalisis semua gambar referensi yang dilampirkan dan gunakan hanya detail yang benar-benar terlihat untuk menjaga bentuk, warna, kemasan, tekstur, serta kontinuitas produk. Jangan mengarang detail yang tidak terlihat.`
      : '';

    // Keep the extension preset's timing, scene, voiceover, and CTA rules intact.
    const canvasOutputContract = `

[CANVAS STORYBOARD OUTPUT CONTRACT — WAJIB]
Keluarkan storyboard lengkap dalam satu blok \`\`\`storyboard_project ... \`\`\` yang dapat dibaca aplikasi Canvas.
Ikuti format dan nama field yang ditentukan preset ekstensi. Bila preset tidak menentukan format project, gunakan objek dengan title, brief, duration, numScenes, aspectRatio, preset, formula, dan scenes.
Jangan mengubah jumlah scene, durasi, pembagian shoot, aturan voiceover, CTA, atau aturan visual dari preset. Pertahankan format waktu preset (termasuk start/end atau startSec/endSec) dan gunakan duration atau durationSec sesuai format preset.`;
    const storyboardPrompt = `${expandedPrompt}${connectedInputPriority}${connectedImageInstructions}${
      /\[CANVAS STORYBOARD OUTPUT CONTRACT/i.test(expandedPrompt) ? '' : canvasOutputContract
    }`;

    // Account resolution based on chosen provider
    let targetAccountToUse: any = null;
    let tokenToUse = '';
    let refreshTokenToUse = '';
    let allTokensToUse: string[] = [];
    let effectiveCookies: string | undefined = undefined;
    let effectiveApiKey: string | undefined = undefined;

    if (isGemini) {
      geminiLease = await acquireGeminiAccountLease(1, storyboardNode.data?.accountId, {
        onQueued: () => setStatusMessage('Semua akun Gemini dengan kredit cukup sedang digunakan. Menunggu akun tersedia...'),
      });
      targetAccountToUse = geminiLease?.account;
      if (!targetAccountToUse) {
        throw new Error('Tidak ada akun Gemini dengan kredit cukup dan sesi valid.');
      }

      tokenToUse = targetAccountToUse?.token || targetAccountToUse?.refreshToken || targetAccountToUse?.apiKey || targetAccountToUse?.cookies || '';
      effectiveCookies = targetAccountToUse?.cookies || targetAccountToUse?.token || targetAccountToUse?.refreshToken;
      effectiveApiKey = targetAccountToUse?.apiKey || (typeof targetAccountToUse?.refreshToken === 'string' && targetAccountToUse.refreshToken.startsWith('AIza') ? targetAccountToUse.refreshToken : undefined);
    } else {
      targetAccountToUse = getSelectedWeavyAccountNow() || currentActiveAccount || (weavyAccountsList.find((a: any) => a.isActive) || weavyAccountsList[0]);
      tokenToUse = (targetAccountToUse ? (targetAccountToUse.idToken || '') : (weavyToken || ''));
      refreshTokenToUse = (targetAccountToUse ? (targetAccountToUse.refreshToken || '') : (refreshToken || ''));
      allTokensToUse = weavyAccountsList.map((a: any) => a.refreshToken).filter(Boolean);
    }

    const defaultModel = isGemini ? 'gemini-3.6-flash' : 'google/gemini-3.6-flash';
    const effectiveModel = storyboardNode.data?.model || defaultModel;
    const applyRemainingCredits = (remainingCredits: number) => {
      if (isGemini) return;
      setCredits(remainingCredits);
      if (!targetAccountToUse?.id) return;
      const updatedAccounts = weavyAccountsList.map((account: any) =>
        account.id === targetAccountToUse.id
          ? { ...account, credits: remainingCredits }
          : account
      );
      setWeavyAccountsList(updatedAccounts);
      try {
        localStorage.setItem('weavy_accounts', JSON.stringify(updatedAccounts));
      } catch (error) {
        console.warn('Gagal menyimpan pembaruan kredit Weavy:', error);
      }
    };

    updateAndPersistRecipe((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === storyboardNodeId
          ? {
              ...node,
              data: {
                ...node.data,
                productAnalysisStatus: connectedWorkers.length > 0 ? 'running' : undefined,
              },
            }
          : node
      ),
    }));

    setIsExecuting(true);
    setExecutingProgress(20);
    setExecutingNodeId(storyboardNodeId);
    setExecutingNodeIds((prev) => [...prev.filter((id) => id !== storyboardNodeId), storyboardNodeId]);
    setStatusMessage(`Menyusun Storyboard (${presetKey} • ${isGemini ? 'Google Gemini' : 'Weavy LLM'})...`);

    setRecipe((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === storyboardNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                brief: userBrief || n.data?.brief,
                status: 'running',
                progress: 25,
                errorMessage: undefined,
              },
            }
          : n
      ),
    }));

    const storyboardSystemPrompt = getMasterDirectorSystemPrompt({
      provider,
      isStoryboardActive: true,
    });

    // Mode Director = port generator storyboard ekstensi (output JSON murni, analisis,
    // anti-repetisi kamera, lock konsistensi). Mode 'preset' = jalur lama.
    const isDirector = (storyboardNode.data?.generatorMode || 'preset') === 'director';
    // PRESET adalah pemegang aturan isi (struktur, durasi, jumlah scene, VO, OST, talent, CTA).
    // Teks preset yang sudah di-expand dikirim ke Director sebagai ATURAN OTORITATIF; Director
    // hanya menambah kontrak JSON, variasi kamera di dalam batas preset, dan lock konsistensi.
    // Header tiap preset berbeda, jadi penanda dideteksi dari perubahan teks: bila expandChatPreset
    // mengubah perintah menjadi instruksi panjang, itu preset. (Kasus brief yang sudah memuat
    // preset ter-expand ditangani lewat includesExpandedPreset.)
    const hasExpandedPreset =
      includesExpandedPreset || expandedPrompt.trim() !== inputCommand.trim();
    // Brief yang sudah berisi preset ter-expand tidak ditulis ulang (menghindari duplikasi).
    const directorBrief = includesExpandedPreset ? '' : userBrief.replace(/^\/[a-z0-9_-]+\s*/i, '').trim();
    const buildDirector = (workerAnalysis?: string) =>
      buildStoryboardDirectorSystemPrompt({
        productName:
          storyboardNode.data?.productName ||
          connectedWorkers.map((w) => w.data?.product?.title).find(Boolean) ||
          '',
        productDesc: storyboardNode.data?.productDesc,
        modelTalent: storyboardNode.data?.modelTalent,
        bgSetting: storyboardNode.data?.bgSetting,
        brief: directorBrief,
        briefInPreset: hasExpandedPreset,
        presetRules: hasExpandedPreset ? expandedPrompt : undefined,
        // Durasi hanya dipakai bila tidak ada preset ter-expand; dengan preset, durasi mengikuti preset.
        duration: Number(storyboardNode.data?.targetDuration) || 30,
        // Override jumlah scene HANYA bila user mengisinya di Inspector. Jangan memakai
        // getStoryboardPlannedSceneCount: ia mengembalikan jumlah scene lama bila node sudah
        // pernah digenerate, sehingga re-run dengan durasi baru memakai jumlah scene yang usang.
        numScenes: Number(storyboardNode.data?.numScenes) || undefined,
        aspectRatio: storyboardNode.data?.aspectRatio || '9:16',
        formulaAngle: storyboardNode.data?.formulaAngle,
        tiktokStyle: storyboardNode.data?.tiktokStyle,
        hookPattern: storyboardNode.data?.hookPattern,
        lockConsistency: storyboardNode.data?.lockConsistency,
        workerContext: resolvedAiWorkerContext || undefined,
        workerAnalysis,
        referenceImageCount: resolvedImageUrls.length,
      });
    const directorUserPrompt = buildDirector().userPrompt;

    // Semua permintaan Weavy (termasuk yang memakai gambar referensi) selalu lewat
    // Extension Bridge supaya tidak kena 403 Cloudflare WAF.
    const requestStoryboardModel = async (
      requestPrompt: string,
      requestSystemPrompt: string,
      requestTemperature: number,
      requestOptions: {
        imageUrl?: string | null;
        imageUrls?: string[];
        extraContext?: string;
        storyboardMode?: boolean;
        workerContext?: string;
      } = {}
    ) => {
      let serverError: Error | null = null;
      const requestImageUrl =
        requestOptions.imageUrl !== undefined ? requestOptions.imageUrl : resolvedImageUrl;
      const requestImageUrls = requestOptions.imageUrls || resolvedImageUrls;
      const requestHasImages = Boolean(requestImageUrl) || requestImageUrls.length > 0;
      const requestStoryboardContext =
        requestOptions.extraContext !== undefined
          ? requestOptions.extraContext
          : buildWeavyStoryboardContext({
          preset: presetKey,
          brief: userBrief,
          judulProject: presetChangedSinceGeneration ? undefined : storyboardNode.data?.projectTitle,
          namaProduk: storyboardNode.data?.productName,
          deskripsiProduk: storyboardNode.data?.productDesc,
          modelTalent: storyboardNode.data?.modelTalent,
          backgroundSetting: storyboardNode.data?.bgSetting,
          formula: presetChangedSinceGeneration ? presetKey : storyboardNode.data?.formula,
          durasiTargetDetik: storyboardNode.data?.targetDuration,
          aspectRatio: storyboardNode.data?.aspectRatio,
          sceneSudahAda: presetChangedSinceGeneration ? 0 : (Array.isArray(storyboardNode.data?.scenes) ? storyboardNode.data.scenes.length : 0),
          scenes: presetChangedSinceGeneration ? undefined : (Array.isArray(storyboardNode.data?.scenes) ? storyboardNode.data.scenes : undefined),
          konteksAIWorker: (requestOptions.workerContext ?? resolvedAiWorkerContext) || undefined,
          referensiGambar: requestHasImages || undefined,
        });

      // ChatView uses the browser extension as its primary Weavy execution path
      // when connected. Canvas previously called the backend first, which could
      // hit the Recipe-create 403 path even though Chat could run an existing
      // Recipe. Mirror Chat's successful path for storyboard runs.
      if (provider === 'weavy' && extensionBridge.getStatus().isConnected) {
        // Match ChatView exactly: when the extension is connected, it is the
        // primary execution path. Do not silently switch to /api/enhance-prompt
        // after a bridge error, because that server path can try to create a
        // Recipe and return 403 while Chat can use the extension session.
        const storyboardAttachments = requestHasImages
          ? [
              ...(requestImageUrl
                ? [{ type: 'image', url: requestImageUrl, name: 'gambar referensi produk', referenceRole: 'product' }]
                : []),
              ...requestImageUrls.map((imgUrl, idx) => ({
                type: 'image',
                url: imgUrl,
                name: `gambar referensi ${idx + 1}`,
                referenceRole: idx === 0 && !requestImageUrl ? 'product' : 'custom',
              })),
            ]
          : [];
        const bridgeResult = await extensionBridge.executeWeavyChat({
          messages: [
            {
              role: 'user',
              content: requestPrompt,
              attachments: storyboardAttachments,
            },
          ],
          model: effectiveModel,
          mode: 'canvas',
          thinking: false,
          temperature: requestTemperature,
          systemPrompt: requestSystemPrompt,
          storyboardMode: requestOptions.storyboardMode ?? false,
          extraContext: requestStoryboardContext,
          refreshToken: refreshTokenToUse,
          idToken: tokenToUse,
        });
        if (bridgeResult?.success && bridgeResult.text?.trim()) {
          return {
            success: true,
            text: bridgeResult.text,
            enhancedPrompt: bridgeResult.text,
            provider: 'weavy',
            model: effectiveModel,
            remainingCredits: bridgeResult.remainingCredits,
          };
        }
        throw new Error(bridgeResult?.error || 'Gagal memproses storyboard melalui Extension Weavy.');
      }

      try {
        const response = await fetch('/api/enhance-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            prompt: requestPrompt,
            systemPrompt: requestSystemPrompt,
            model: effectiveModel,
            imageUrl: requestImageUrl,
            images: requestImageUrls,
            temperature: requestTemperature,
            nodeType: 'storyboard',
            isAnyLLM: !isGemini,
            refreshToken: refreshTokenToUse,
            idToken: tokenToUse,
            token: tokenToUse,
            cookies: effectiveCookies,
            apiKey: effectiveApiKey,
            accountId: targetAccountToUse?.id,
            allRefreshTokens: allTokensToUse,
            streamResponse: isGemini,
            // Konteks storyboard aktif ikut dikirim ke jalur server (Gemini Web / Weavy fallback),
            // sebelumnya hanya dipakai oleh jalur bridge ekstensi.
            extraContext: requestStoryboardContext || undefined,
          }),
        });
        let result: any;
        if (response.headers.get('content-type')?.includes('text/event-stream') && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let streamedResult: any;
          let streamedError = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';
            for (const eventBlock of events) {
              const dataLine = eventBlock.split('\n').find((line) => line.startsWith('data:'));
              if (!dataLine) continue;
              try {
                const event = JSON.parse(dataLine.slice(5).trim());
                if (event.type === 'progress' && typeof event.message === 'string') {
                  setStatusMessage(event.message);
                } else if (event.type === 'result') {
                  streamedResult = event.result;
                } else if (event.type === 'error') {
                  streamedError = event.error || 'Gemini Web gagal memproses Storyboard.';
                }
              } catch (parseError) {
                console.warn('[Storyboard Copilot] Invalid progress event from server:', parseError);
              }
            }
          }
          result = streamedResult || { success: false, error: streamedError || 'Koneksi Storyboard berakhir sebelum Gemini mengembalikan hasil.' };
        } else {
          result = await response.json().catch(() => ({} as any));
        }
        if (response.ok && result?.success && (result.text || result.enhancedPrompt)) return result;
        serverError = new Error(result?.error || `Permintaan storyboard gagal (HTTP ${response.status}).`);
      } catch (error: any) {
        serverError = error instanceof Error ? error : new Error(String(error));
      }

      throw serverError || new Error('Gagal memproses Storyboard Copilot.');
    };

    try {
      const workerAnalysisResults: Array<{ title: string; analysis: string }> = [];
      for (const workerId of connectedWorkerIds) {
        const workerNode = recipeRef.current.nodes.find((node) => node.id === workerId);
        if (!workerNode || workerNode.type !== 'aiWorker') continue;

        const workerInputs = resolveEnhancerInputs(workerId, recipeRef.current.nodes, recipeRef.current.edges);
        const linkText = (workerInputs.prompt || workerNode.data?.linkText || '').trim();
        const noteText = String(workerNode.data?.note || '');
        const analysisSignature = getAiWorkerAnalysisSignature(workerNode, linkText, noteText);
        if (!analysisSignature) {
          throw new Error(`AI Worker "${workerNode.title || 'Produk'}" belum memiliki hasil ekstraksi terbaru.`);
        }

        let analysis = workerNode.data?.storyboardAnalysisSignature === analysisSignature
          ? String(workerNode.data?.storyboardAnalysis || '').trim()
          : '';

        if (!analysis) {
          setStatusMessage(`Menganalisis produk dari AI Worker "${workerNode.title || 'Produk'}"...`);
          const workerImages = Array.isArray(workerNode.data?.selectedImageUrls)
            ? workerNode.data.selectedImageUrls.filter((url: unknown): url is string => typeof url === 'string' && Boolean(url.trim()))
            : [];
          const analysisResult = await requestStoryboardModel(
            `Analisis data produk berikut secara ringkas dan faktual untuk persiapan storyboard. Identifikasi nama/jenis produk, karakteristik, keunggulan yang didukung data, target pembeli yang mungkin, dan detail visual penting. Tandai informasi yang tidak tersedia; jangan menebak harga, klaim, atau spesifikasi. Jangan buat storyboard, scene, naskah, atau prompt pada tahap ini.\n\nDATA AI WORKER:\n${workerNode.data.contextText}`,
            'Kamu adalah analis produk. Tugasmu hanya menyusun ringkasan analisis produk berdasarkan data dan gambar yang diberikan. Jangan membuat storyboard, naskah iklan, atau menambahkan fakta yang tidak tersedia.',
            0.1,
            {
              imageUrl: null,
              imageUrls: workerImages,
              extraContext: `[KONTEKS DATA AI WORKER]\n${workerNode.data.contextText}`,
              storyboardMode: false,
            }
          );
          if (typeof analysisResult.remainingCredits === 'number') {
            applyRemainingCredits(analysisResult.remainingCredits);
          }
          analysis = String(analysisResult.text || analysisResult.enhancedPrompt || '').trim();
          if (!analysis) {
            throw new Error(`AI tidak memberikan hasil analisis untuk "${workerNode.title || 'Produk'}".`);
          }

          updateAndPersistRecipe((current) => ({
            ...current,
            nodes: current.nodes.map((node) =>
              node.id === workerId
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      storyboardAnalysis: analysis,
                      storyboardAnalysisSignature: analysisSignature,
                    },
                  }
                : node
            ),
          }));
        }

        workerAnalysisResults.push({
          title: workerNode.data?.product?.title || workerNode.title || 'Produk',
          analysis,
        });
      }

      const workerAnalysisContext = workerAnalysisResults
        .map(({ title, analysis }, index) => `[Analisis AI Worker ${index + 1}: ${title}]\n${analysis}`)
        .join('\n\n');

      if (workerAnalysisResults.length > 0) {
        updateAndPersistRecipe((current) => ({
          ...current,
          nodes: current.nodes.map((node) =>
            node.id === storyboardNodeId
              ? { ...node, data: { ...node.data, productAnalysisStatus: 'valid' } }
              : node
          ),
        }));
      }

      const finalStoryboardPrompt = workerAnalysisContext
        ? `${storyboardPrompt}\n\n[HASIL ANALISIS PRODUK AI WORKER]\n${workerAnalysisContext}\nGunakan analisis ini sebagai dasar fakta, tetapi ikuti preset dan Main Brief pengguna sebagai instruksi kreatif utama. Jangan mengarang klaim yang tidak tercantum pada data atau analisis.`
        : storyboardPrompt;
      const data = isDirector
        ? await requestStoryboardModel(
            directorUserPrompt,
            buildDirector(workerAnalysisContext || undefined).systemPrompt,
            0.3,
            { extraContext: '', storyboardMode: false },
          )
        : await requestStoryboardModel(finalStoryboardPrompt, storyboardSystemPrompt, 0.2, {
            workerContext: [resolvedAiWorkerContext, workerAnalysisContext].filter(Boolean).join('\n\n'),
          });

      let generatedResult = data.text || data.enhancedPrompt || '';

      // Check if generatedResult is an obvious AI failure/error message before attempting repair
      const isAiGlitchText = (text: string) => {
        const t = String(text || '').trim();
        if (t.length > 300) return false;
        return /i encountered an error|something went wrong|an error occurred|terjadi kesalahan|tidak dapat memproses|saya mengalami masalah/i.test(t);
      };

      if (isAiGlitchText(generatedResult)) {
        throw new Error(`Google Gemini mengalami kendala internal: "${generatedResult.slice(0, 150)}". Silakan klik tombol Generate sekali lagi atau alihkan akun/provider.`);
      }

      // Merge lokal Storyboard Copilot (field-level per scene) - parity dengan
      // applyStoryboardCopilotSceneUpdate di ekstensi. Kalau model mengirim aksi
      // `update_scenes`, patch digabung ke scene yang sudah ada di node.
      const existingScenes = presetChangedSinceGeneration ? undefined : storyboardNode.data?.scenes;
      if (!isDirector && Array.isArray(existingScenes) && existingScenes.length > 0) {
        const existingProject = {
          title: storyboardNode.data?.projectTitle,
          productName: storyboardNode.data?.productName,
          productDesc: storyboardNode.data?.productDesc,
          modelTalent: storyboardNode.data?.modelTalent,
          bgSetting: storyboardNode.data?.bgSetting,
          brief: storyboardNode.data?.brief,
          duration: storyboardNode.data?.targetDuration,
          aspectRatio: storyboardNode.data?.aspectRatio,
          formula: storyboardNode.data?.formula,
          numScenes: existingScenes.length,
          scenes: existingScenes,
        };
        const mergedResult = postProcessWeavyResponse({
          responseText: generatedResult,
          existingProject,
        });
        if (mergedResult.mergedProject) {
          generatedResult = mergedResult.content;
        }
      }

      let extractedProject = extractStoryboardProjectFromData(generatedResult, userBrief);

      // Some model responses contain a useful storyboard in prose/Markdown but omit
      // the machine-readable storyboard_project block. Ask the same model to repair
      // its own response once, preserving the original brief and image attachments.
      // This avoids failing the whole node on a formatting-only issue.
      if (!extractedProject || !Array.isArray(extractedProject.scenes) || extractedProject.scenes.length === 0) {
        const repairPrompt = isDirector
          ? `${directorUserPrompt}\n\n[FORMAT REPAIR — WAJIB]\nUbah hasil berikut menjadi SATU objek JSON valid (tanpa Markdown fence dan tanpa teks lain) dengan key metadata, analysis, masterProductionSheetPrompt, dan scenes berupa array tidak kosong. Pertahankan isi dan aturan preset, termasuk jumlah scene, durasi, shoot, VO, onScreenText, dan CTA. Jangan menambah klaim produk yang tidak didukung.\n\nHASIL SEBELUMNYA UNTUK DIPERBAIKI:\n${String(generatedResult).slice(0, 18000)}`
          : `${storyboardPrompt}\n\n[FORMAT REPAIR — WAJIB]\nPerbaiki format hasil berikut agar menjadi satu blok \`\`\`storyboard_project ... \`\`\` berisi JSON valid dengan key title dan scenes berupa array tidak kosong. Pertahankan isi dan struktur preset, termasuk jumlah scene, durasi, VO, CTA, dan format waktu. Jangan menambah klaim produk yang tidak didukung.\n\nHASIL SEBELUMNYA UNTUK DIPERBAIKI:\n${String(generatedResult).slice(0, 18000)}`;
        let repairData: any = null;
        try {
          repairData = await requestStoryboardModel(
            repairPrompt,
            'You are a strict JSON storyboard formatter. Return only valid JSON with a non-empty scenes array. Do not use Markdown fences or explanatory text.',
            0.1,
            isDirector ? { extraContext: '', storyboardMode: false } : {},
          );
        } catch (repairError: any) {
          console.warn('[Storyboard Copilot] Format repair failed:', repairError?.message || repairError);
        }
        if (repairData?.success) {
          const repairedText = repairData.text || repairData.enhancedPrompt || '';
          const repairedProject = extractStoryboardProjectFromData(repairedText, userBrief);
          if (repairedProject && Array.isArray(repairedProject.scenes) && repairedProject.scenes.length > 0) {
            generatedResult = repairedText;
            extractedProject = repairedProject;
          }
        }
      }

      if (!extractedProject || !Array.isArray(extractedProject.scenes) || extractedProject.scenes.length === 0) {
        const preview = String(generatedResult || '').replace(/\s+/g, ' ').slice(0, 240);
        throw new Error(`AI berhasil merespons, tetapi format breakdown scene tidak terbaca setelah percobaan perbaikan. Respons awal: ${preview || '(kosong)'}`);
      }

      if (typeof data.remainingCredits === 'number' && !isGemini) {
        applyRemainingCredits(data.remainingCredits);
      }

      const newOutputs = getStoryboardOutputs(extractedProject.scenes);

      setRecipe((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === storyboardNodeId
            ? {
                ...n,
                outputs: newOutputs,
                data: {
                  ...n.data,
                  status: 'completed',
                  progress: 100,
                  scenes: extractedProject.scenes,
                  projectTitle: extractedProject.title || extractedProject.productName,
                  productName: isDirector ? (n.data?.productName || extractedProject.productName) : extractedProject.productName,
                  productDesc: isDirector ? (n.data?.productDesc || extractedProject.productDesc) : extractedProject.productDesc,
                  modelTalent: isDirector ? (n.data?.modelTalent || extractedProject.modelTalent) : extractedProject.modelTalent,
                  bgSetting: isDirector ? (n.data?.bgSetting || extractedProject.bgSetting) : extractedProject.bgSetting,
                  analysis: extractedProject.analysis || null,
                  masterProductionSheetPrompt: extractedProject.masterProductionSheetPrompt || null,
                  aspectRatio: extractedProject.aspectRatio || '9:16',
                  formula: extractedProject.formula || presetKey,
                  generatedPresetKey: presetKey,
                  targetDuration: extractedProject.duration || storyboardNode.data?.targetDuration || 30,
                  rawJson: JSON.stringify(extractedProject, null, 2),
                  brief: userBrief,
                  errorMessage: undefined,
                  activeTab: 0,
                },
              }
            : n
        ),
      }));

      setStatusMessage(`Storyboard berhasil disusun! (${extractedProject.scenes.length} Scene siap)`);
      setExecutingProgress(100);
    } catch (err: any) {
      console.error('Error running Storyboard node:', err);
      const errMsg = err.message || 'Gagal menyusun Storyboard.';
      setStatusMessage(`Gagal: ${errMsg}`);
      setRecipe((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === storyboardNodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  status: 'error',
                  progress: 0,
                  productAnalysisStatus:
                    n.data?.productAnalysisStatus === 'running'
                      ? 'error'
                      : n.data?.productAnalysisStatus,
                  errorMessage: errMsg,
                },
              }
            : n
        ),
      }));
    } finally {
      geminiLease?.release();
      setExecutingProgress(0);
      setExecutingNodeIds((prev) => {
        const next = prev.filter((id) => id !== storyboardNodeId);
        if (next.length === 0) {
          setIsExecuting(false);
          setExecutingNodeId(null);
        } else {
          setExecutingNodeId(next[next.length - 1]);
        }
        return next;
      });
    }
  };

  // Helper to dynamically spawn/update Image Model and Gemini Video nodes on Canvas for each Storyboard Scene
  const handleSpawnSceneNodes = (storyboardNodeId: string) => {
    const sbNode = recipe.nodes.find((n) => n.id === storyboardNodeId);
    if (!sbNode || sbNode.type !== 'storyboard') return;

    const scenes = dedupeStoryboardScenes(sbNode.data?.scenes);
    if (scenes.length === 0) {
      setStatusMessage('Belum ada scene yang di-generate. Silakan jalankan Storyboard terlebih dahulu.');
      return;
    }

    recordHistory();

    const timestamp = Date.now();
    const newNodes: CanvasNode[] = [];
    const newEdges: CanvasEdge[] = [];

    // Prefix for spawned scene nodes linked to this storyboard node
    const spawnedPrefix = `sc_${storyboardNodeId}_`;

    // Remove any previously spawned scene nodes and their edges
    const remainingNodes = recipe.nodes.filter(
      (n) => !n.id.startsWith(spawnedPrefix)
    );
    const remainingEdges = recipe.edges.filter(
      (e) =>
        !e.id.startsWith(`edge_${spawnedPrefix}`) &&
        !recipe.nodes.some((n) => n.id.startsWith(spawnedPrefix) && (n.id === e.sourceNodeId || n.id === e.targetNodeId))
    );

    const xOffsetModel = sbNode.position.x + 470;
    const xOffsetViewer = sbNode.position.x + 850;
    const xOffsetVideo = sbNode.position.x + 1220;

    scenes.forEach((scene: any, idx: number) => {
      const sceneNum = scene.sceneNumber || idx + 1;
      const yPos = sbNode.position.y + idx * 460;

      const modelNodeId = `${spawnedPrefix}model_sc${sceneNum}_${timestamp}`;
      const viewerNodeId = `${spawnedPrefix}viewer_sc${sceneNum}_${timestamp}`;
      const videoNodeId = `${spawnedPrefix}video_sc${sceneNum}_${timestamp}`;

      // 1. Image Model Node (Weavy Nano Banana Pro)
      const imageModelNode: CanvasNode = {
        id: modelNodeId,
        type: 'imageModel',
        title: 'Weavy Image Engine',
        subtitle: `Nano Banana Pro (Scene ${sceneNum})`,
        colorTheme: 'red',
        position: { x: xOffsetModel, y: yPos },
        inputs: [
          { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
          { id: 'input-image', name: 'image_1', type: 'image', label: 'Image 1', required: false },
        ],
        outputs: [
          { id: 'output-result', name: 'result', type: 'image', label: 'Generated Image' },
        ],
        data: {
          modelId: 'fal-ai/nano-banana-pro/edit',
          modelDisplayName: 'Nano Banana Pro',
          provider: 'weavy',
          resolution: '1K',
          aspectRatio: sbNode.data?.aspectRatio || '9:16',
          seed: Math.floor(Math.random() * 999999),
          isRandomSeed: true,
          creditsCost: 11,
          promptOverride: scene.imagePrompt || scene.visualDescription || '',
          sceneNumber: sceneNum,
          sceneTitle: scene.title,
          voiceover: scene.voiceover,
          shoots: scene.shoots,
        },
      };

      // 2. Viewer Node
      const viewerNode: CanvasNode = {
        id: viewerNodeId,
        type: 'imageViewer',
        title: `Scene ${sceneNum} Keyframe`,
        subtitle: 'Viewer & Download',
        colorTheme: 'purple',
        position: { x: xOffsetViewer, y: yPos },
        inputs: [
          { id: 'input-image', name: 'image', type: 'image', label: 'Input Result', required: true },
        ],
        outputs: [
          { id: 'output-image', name: 'image', type: 'image', label: 'Jadikan Gambar Referensi' },
        ],
        data: {
          status: 'idle',
          progress: 0,
        },
      };

      // 3. Gemini Video Node
      const fullVideoPrompt = formatSceneVideoPrompt(scene);
      const videoNode: CanvasNode = {
        id: videoNodeId,
        type: 'geminiVideo',
        title: 'Gemini Omni Flash',
        subtitle: `Scene ${sceneNum} Video (${scene.durationSec || 10}s)`,
        colorTheme: 'purple',
        position: { x: xOffsetVideo, y: yPos },
        inputs: [
          { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
          { id: 'input-image', name: 'image_1', type: 'image', label: 'Image 1', required: false },
        ],
        outputs: [
          { id: 'output-video', name: 'video', type: 'video', label: 'Generated Video' },
        ],
        data: {
          modelId: 'gemini-omni-1.1-flash',
          modelDisplayName: 'Gemini Omni Flash',
          provider: 'gemini',
          duration: `${scene.durationSec || 10}s`,
          aspectRatio: sbNode.data?.aspectRatio || '9:16',
          creditsCost: 0,
          status: 'idle',
          progress: 0,
          promptOverride: fullVideoPrompt,
          voiceover: scene.voiceover,
          shoots: scene.shoots,
          sceneNumber: sceneNum,
          sceneTitle: scene.title,
          visualDescription: scene.visualDescription,
          videoPrompt: scene.videoPrompt,
        },
      };

      newNodes.push(imageModelNode, viewerNode, videoNode);

      // Wire edges:
      // Storyboard (sceneX_image) -> Image Model
      newEdges.push({
        id: `edge_${spawnedPrefix}sb_to_model_sc${sceneNum}_${timestamp}`,
        sourceNodeId: storyboardNodeId,
        sourceOutputId: `scene${sceneNum}_image`,
        targetNodeId: modelNodeId,
        targetInputId: 'input-prompt',
        color: '#f59e0b',
      });

      // Image Model -> Viewer
      newEdges.push({
        id: `edge_${spawnedPrefix}model_to_viewer_sc${sceneNum}_${timestamp}`,
        sourceNodeId: modelNodeId,
        sourceOutputId: 'output-result',
        targetNodeId: viewerNodeId,
        targetInputId: 'input-image',
        color: '#a855f7',
      });

      // Storyboard (sceneX_video) -> Gemini Video
      newEdges.push({
        id: `edge_${spawnedPrefix}sb_to_video_sc${sceneNum}_${timestamp}`,
        sourceNodeId: storyboardNodeId,
        sourceOutputId: `scene${sceneNum}_video`,
        targetNodeId: videoNodeId,
        targetInputId: 'input-prompt',
        color: '#f59e0b',
      });

      // Viewer -> Gemini Video (Ref Image)
      newEdges.push({
        id: `edge_${spawnedPrefix}viewer_to_video_sc${sceneNum}_${timestamp}`,
        sourceNodeId: viewerNodeId,
        sourceOutputId: 'output-image',
        targetNodeId: videoNodeId,
        targetInputId: 'input-image',
        color: '#38bdf8',
      });
    });

    // Otomatis buat node Video Stitcher di ujung jika scene lebih dari 1
    if (scenes.length > 1) {
      const xOffsetStitcher = sbNode.position.x + 1600;
      const yOffsetStitcher = sbNode.position.y + Math.floor(((scenes.length - 1) * 460) / 2);
      const stitcherNodeId = `${spawnedPrefix}stitcher_${timestamp}`;
      const stitcherViewerNodeId = `${spawnedPrefix}stitcher_viewer_${timestamp}`;

      const stitcherInputs = scenes.map((_: any, idx: number) => ({
        id: `input-video-${idx + 1}`,
        name: `video_${idx + 1}`,
        type: 'video' as const,
        label: `Video ${idx + 1}`,
        required: idx === 0,
      }));

      const stitcherNode: CanvasNode = {
        id: stitcherNodeId,
        type: 'videoStitcher',
        title: 'Video Stitcher',
        subtitle: `Gabung ${scenes.length} Scene (FFmpeg)`,
        colorTheme: 'red',
        position: { x: xOffsetStitcher, y: yOffsetStitcher },
        inputs: stitcherInputs,
        outputs: [
          { id: 'output-video', name: 'video', type: 'video', label: 'Stitched Video' },
        ],
        data: {
          aspectRatio: sbNode.data?.aspectRatio || '9:16',
          resolution: '1080p',
          transition: 'none',
          status: 'idle',
          progress: 0,
        },
      };

      const stitcherViewerNode: CanvasNode = {
        id: stitcherViewerNodeId,
        type: 'imageViewer',
        title: 'Final Video (Full)',
        subtitle: 'Hasil Gabungan Semua Scene',
        colorTheme: 'purple',
        position: { x: xOffsetStitcher + 380, y: yOffsetStitcher },
        inputs: [
          { id: 'input-image', name: 'image', type: 'image', label: 'Input Result', required: true },
        ],
        outputs: [
          { id: 'output-image', name: 'image', type: 'image', label: 'Video Output' },
        ],
        data: {
          status: 'idle',
          progress: 0,
        },
      };

      newNodes.push(stitcherNode, stitcherViewerNode);

      // Hubungkan kabel dari setiap scene video output -> stitcher input-video-N
      scenes.forEach((_: any, idx: number) => {
        const sceneNum = idx + 1;
        const videoNodeId = `${spawnedPrefix}video_sc${sceneNum}_${timestamp}`;
        newEdges.push({
          id: `edge_${spawnedPrefix}video_to_stitcher_sc${sceneNum}_${timestamp}`,
          sourceNodeId: videoNodeId,
          sourceOutputId: 'output-video',
          targetNodeId: stitcherNodeId,
          targetInputId: `input-video-${sceneNum}`,
          color: '#ef4444',
        });
      });

      // Hubungkan output stitcher -> viewer
      newEdges.push({
        id: `edge_${spawnedPrefix}stitcher_to_viewer_${timestamp}`,
        sourceNodeId: stitcherNodeId,
        sourceOutputId: 'output-video',
        targetNodeId: stitcherViewerNodeId,
        targetInputId: 'input-image',
        color: '#a855f7',
      });
    }

    setRecipe((prev) => ({
      ...prev,
      nodes: [...remainingNodes, ...newNodes],
      edges: [...remainingEdges, ...newEdges],
    }));

    setStatusMessage(`Node alur kerja berhasil dibuat untuk ${scenes.length} scene (lengkap dengan Video Stitcher)!`);
  };

  // Execution Engine: Run Gemini Video Node (Synchronized with App.tsx Logic)
  const handleRunGeminiVideoNode = async (videoNodeId: string, plannedAccountId?: string) => {
    const targetNode = recipeRef.current.nodes.find((n) => n.id === videoNodeId);
    if (!targetNode || targetNode.type !== 'geminiVideo') return;
    const nodeRunId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    geminiNodeRunIdsRef.current.set(videoNodeId, nodeRunId);

    // Resolve connected inputs (prompt and reference media)
    const {
      prompt,
      imageUrl,
      imageUrls,
      videoUrl,
      videoUrls,
      voiceover,
    } = resolveModelInputs(
      videoNodeId,
      recipeRef.current.nodes,
      recipeRef.current.edges
    );

    let effectivePrompt = (prompt || targetNode.data?.inputPrompt || targetNode.data?.promptOverride || '').trim();

    // Ensure voiceover is included in effectivePrompt if available
    const effectiveVo = (voiceover || targetNode.data?.voiceover || '').trim();
    if (effectiveVo && !effectivePrompt.includes(effectiveVo)) {
      effectivePrompt = `${effectivePrompt}\n\n[VOICEOVER / SPOKEN NARRATION]:\n"${effectiveVo}"`.trim();
    }

    // Helper to resolve blob: URLs to Base64 data URLs for Node.js server compatibility
    const ensureDataUrlIfBlob = async (url: string): Promise<string> => {
      if (!url || typeof url !== 'string') return '';
      if (url.startsWith('blob:')) {
        try {
          const resp = await fetch(url);
          const blob = await resp.blob();
          return await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve(url);
            reader.readAsDataURL(blob);
          });
        } catch {
          return url;
        }
      }
      return url;
    };

    // Find all connected image/video viewer nodes
    const connectedViewerNodeIds = getConnectedViewerIds(videoNodeId);
    const viewerNodeId = connectedViewerNodeIds[0];

    setIsExecuting(true);
    setExecutingProgress(10);
    setExecutingNodeId(videoNodeId);
    setExecutingNodeIds((prev) => [...prev.filter((id) => id !== videoNodeId), videoNodeId]);
    setStatusMessage('Menyiapkan media dan menghubungkan ke Google Gemini Veo... 10%');

    // Set video node and connected viewer to running
    updateAndPersistRecipe((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === videoNodeId || (viewerNodeId && n.id === viewerNodeId) || connectedViewerNodeIds.includes(n.id)
          ? {
              ...n,
              data: {
                ...n.data,
                status: 'running',
                progress: 10,
                ...(n.id === videoNodeId
                  ? { startedAt: Date.now(), operationName: undefined }
                  : {}),
                errorMessage: undefined,
              },
            }
          : n
      ),
    }));

    let geminiLease: GeminiAccountLease | null = null;
    try {
      const nodeData = targetNode.data || {};
      const modelId = nodeData.modelId || 'gemini-omni-1.1-flash';
      const duration = nodeData.duration || '10s';
      const aspectRatio = (nodeData.aspectRatio || '9:16').split(' ')[0];

      // Verifikasi & auto-switch akun Gemini jika kuota habis (sinkron dengan menu generate utama)
      const selectedAccountId = plannedAccountId || nodeData.accountId;
      const isAutoAccountMode = !selectedAccountId || selectedAccountId === 'auto';
      geminiLease = await acquireGeminiAccountLease(1, isAutoAccountMode ? undefined : selectedAccountId, {
        onQueued: () => setStatusMessage('Semua akun Gemini dengan kredit cukup sedang digunakan. Menunggu akun tersedia...'),
      });
      const activeAccount = geminiLease?.account;

      if (!activeAccount || (!activeAccount.token && !activeAccount.refreshToken && !activeAccount.apiKey && !activeAccount.cookies)) {
        throw new Error('Tidak ada akun Google Gemini yang terhubung atau semua akun telah kadaluarsa. Silakan periksa menu Settings.');
      }

      setRecipe((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === videoNodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  currentRunAccountId: activeAccount.id,
                  currentRunAccountEmail: activeAccount.email || activeAccount.name,
                },
              }
            : n
        ),
      }));

      if (!isAutoAccountMode && selectedAccountId !== activeAccount.id) {
        setStatusMessage(
          `⚡ Akun "${activeAccount.name || activeAccount.email}" dipilih karena akun prioritas sedang digunakan atau kuotanya tidak cukup (${activeAccount.credits ?? 0}/${GEMINI_MAX_CREDITS} kredit)...`
        );
        setRecipe((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === videoNodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    currentRunAccountId: activeAccount.id,
                    currentRunAccountEmail: activeAccount.email || activeAccount.name,
                  },
                }
              : n
          ),
        }));
      }

      const accountPayload = {
        ...buildGeminiPayloadAccounts(activeAccount),
        fallbackAccounts: [],
      };

      // Convert any client-side blob URLs in reference images to Base64
      const rawRefImages = imageUrls && imageUrls.length > 0 ? imageUrls : imageUrl ? [imageUrl] : [];
      const refImages = await Promise.all(rawRefImages.map((u) => ensureDataUrlIfBlob(u)));
      const rawRefVideos = videoUrls && videoUrls.length > 0 ? videoUrls : videoUrl ? [videoUrl] : [];
      const refVideos = await Promise.all(rawRefVideos.map((u) => ensureDataUrlIfBlob(u)));

      const hasReferences = refImages.length > 0 || refVideos.length > 0;
      if (!effectivePrompt && !hasReferences) {
        throw new Error('Silakan sambungkan Text Prompt atau tambahkan gambar/video referensi terlebih dahulu.');
      }

      console.log('[Canvas Run Gemini Video 🚀] Menjalankan Gemini Video dengan Self-Healing Auto-Switch & Retry Engine...');
      setStatusMessage('Mengirim permintaan video ke Google Gemini Veo...');
      setExecutingProgress(10);

      const geminiResult = await executeGeminiVideoWithAutoSwitchAndRetry({
        prompt: effectivePrompt,
        aspectRatio,
        duration,
        resolution: targetNode.data?.resolution || '1080p',
        model: modelId,
        referenceImageUrls: refImages,
        referenceVideoUrls: refVideos,
        accountPayload,
        attachedMedia: [
          ...refImages.map((u) => ({ type: 'image', url: u })),
          ...refVideos.map((u) => ({ type: 'video', url: u })),
        ].slice(0, 6),
        onTaskAccepted: (operationName) => {
          if (geminiNodeRunIdsRef.current.get(videoNodeId) !== nodeRunId) return;
          updateAndPersistRecipe((prev) => ({
            ...prev,
            nodes: prev.nodes.map((n) =>
              n.id === videoNodeId && n.data?.status === 'running'
                ? { ...n, data: { ...n.data, operationName } }
                : n
            ),
          }));
        },
        onProgress: (prog, text) => {
          setExecutingProgress(prog);
          setStatusMessage(text);
          setRecipe((prev) => ({
            ...prev,
            nodes: prev.nodes.map((n) =>
              n.id === videoNodeId || (viewerNodeId && n.id === viewerNodeId) || connectedViewerNodeIds.includes(n.id)
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      status: 'running',
                      progress: prog,
                    },
                  }
                : n
            ),
          }));
        },
        onAccountSwitch: (newAcc, reason) => {
          setStatusMessage(`✓ ${reason}`);
          setRecipe((prev) => ({
            ...prev,
            nodes: prev.nodes.map((n) =>
              n.id === videoNodeId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      currentRunAccountId: newAcc.id,
                      currentRunAccountEmail: newAcc.email || newAcc.name,
                    },
                  }
                : n
            ),
          }));
        },
        onRetry: (attempt, maxAttempts, reason, accName) => {
          setStatusMessage(
            `Status task Gemini belum bisa dipastikan (${attempt}/${maxAttempts}) untuk akun "${accName}". Mencoba cek lagi: ${reason}`,
          );
        },
      });

      const finalVideoUrl = geminiResult.videoUrl;
      const operationName = geminiResult.operationName;

      // Success! Update video node and viewer node
      const finalModelName = nodeData.modelDisplayName || 'Google Veo 2 / Gemini Video';
      updateAndPersistRecipe((prev) => {
        const nextNodes = prev.nodes.map((n) => {
          if (n.id === videoNodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                outputVideo: finalVideoUrl,
                videoUrl: finalVideoUrl,
                resultUrl: finalVideoUrl,
                operationName: geminiResult.operationName,
                status: 'completed',
                progress: 100,
                aspectRatio,
                duration,
                errorMessage: undefined,
              },
            };
          }
          if ((viewerNodeId && n.id === viewerNodeId) || connectedViewerNodeIds.includes(n.id)) {
            return {
              ...n,
              title: finalModelName,
              data: {
                ...n.data,
                resultUrl: finalVideoUrl,
                outputVideo: finalVideoUrl,
                status: 'completed',
                progress: 100,
                aspectRatio,
                errorMessage: undefined,
              },
            };
          }
          return n;
        });

        return { ...prev, nodes: nextNodes };
      });

      // Save to History tab
      const canvasHistoryItem: GenerationItem = {
        id: `gen_canvas_vid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        mode: 'video',
        title: effectivePrompt ? (effectivePrompt.length > 50 ? effectivePrompt.slice(0, 50) + '...' : effectivePrompt) : finalModelName,
        prompt: effectivePrompt,
        createdAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
        aspectRatio,
        resolution: 'Auto',
        duration,
        status: 'completed',
        mediaUrl: finalVideoUrl,
        thumbnailUrl: finalVideoUrl,
        model: finalModelName,
        provider: 'gemini',
        providerName: 'Google Gemini Omni Flash',
        progress: 100,
        taskId: operationName,
      };

      try {
        const rawGen = localStorage.getItem('weavy_generations');
        const existingGen = rawGen ? JSON.parse(rawGen) : [];
        if (Array.isArray(existingGen)) {
          const filtered = existingGen.filter((g: any) => g.mediaUrl !== finalVideoUrl && g.id !== canvasHistoryItem.id);
          localStorage.setItem('weavy_generations', JSON.stringify([canvasHistoryItem, ...filtered]));
        }
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('storage', { detail: { key: 'weavy_generations' } }));

      if (onAddGeneration) {
        onAddGeneration(canvasHistoryItem);
      }

      setExecutingProgress(100);
      setStatusMessage(`✓ Video ${finalModelName} berhasil dibuat dan siap diputar!`);
    } catch (err: any) {
      console.error('[Canvas Video Execution Error]:', err);
      const errMsg = err?.message || String(err) || 'Terjadi kesalahan saat membuat video.';
      setStatusMessage(`Gagal: ${errMsg}`);

      updateAndPersistRecipe((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === videoNodeId || (viewerNodeId && n.id === viewerNodeId)
            ? {
                ...n,
                data: {
                  ...n.data,
                  status: 'error',
                  errorMessage: errMsg,
                  progress: 0,
                },
              }
            : n
        ),
      }));
    } finally {
      if (geminiNodeRunIdsRef.current.get(videoNodeId) === nodeRunId) {
        geminiNodeRunIdsRef.current.delete(videoNodeId);
      }
      geminiLease?.release();
      setExecutingProgress(0);
      setExecutingNodeIds((prev) => {
        const next = prev.filter((id) => id !== videoNodeId);
        if (next.length === 0) {
          setIsExecuting(false);
          setExecutingNodeId(null);
        } else {
          setExecutingNodeId(next[next.length - 1]);
        }
        return next;
      });
    }
  };

  const handleRunVidsVideoNode = async (videoNodeId: string) => {
    const targetNode = recipeRef.current.nodes.find((node) => node.id === videoNodeId);
    if (!targetNode || targetNode.type !== 'vidsVideo') return;

    const { prompt: connectedPrompt } = resolveModelInputs(
      videoNodeId,
      recipeRef.current.nodes,
      recipeRef.current.edges
    );
    const effectivePrompt = (
      targetNode.data?.promptOverride ||
      connectedPrompt ||
      targetNode.data?.inputPrompt ||
      ''
    ).trim();
    const connectedViewerNodeIds = getConnectedViewerIds(videoNodeId);

    if (!effectivePrompt) {
      const errorMessage = 'Hubungkan node Prompt atau isi prompt di pengaturan Vids Omni.';
      setStatusMessage(errorMessage);
      setRecipe((prev) => ({
        ...prev,
        nodes: prev.nodes.map((node) =>
          node.id === videoNodeId
            ? { ...node, data: { ...node.data, status: 'error', errorMessage, progress: 0 } }
            : node
        ),
      }));
      return;
    }

    setIsExecuting(true);
    setExecutingProgress(5);
    setExecutingNodeId(videoNodeId);
    setExecutingNodeIds((prev) => [...prev.filter((id) => id !== videoNodeId), videoNodeId]);
    setStatusMessage('Mengirim permintaan ke Google Vids...');

    const startedAt = Date.now();
    updateAndPersistRecipe((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) =>
        node.id === videoNodeId || connectedViewerNodeIds.includes(node.id)
          ? {
              ...node,
              data: {
                ...node.data,
                status: 'running',
                progress: 5,
                ...(node.id === videoNodeId ? { startedAt, errorMessage: undefined } : {}),
              },
            }
          : node
      ),
    }));

    let progress = 5;
    const progressInterval = window.setInterval(() => {
      progress = Math.min(progress + 1, 90);
      setExecutingProgress(progress);
      setStatusMessage(`Google Vids sedang merender video... ${progress}%`);
      setRecipe((prev) => ({
        ...prev,
        nodes: prev.nodes.map((node) =>
          node.id === videoNodeId || connectedViewerNodeIds.includes(node.id)
            ? { ...node, data: { ...node.data, status: 'running', progress } }
            : node
        ),
      }));
    }, 2500);

    try {
      const rawAccounts = localStorage.getItem('vids_accounts');
      const accounts = rawAccounts ? JSON.parse(rawAccounts) : [];
      if (!Array.isArray(accounts)) {
        throw new Error('Daftar akun Google Vids di Settings tidak valid.');
      }

      const nodeAccountId = targetNode.data?.accountId;
      const selectedAccount = nodeAccountId
        ? accounts.find((account: any) => account.id === nodeAccountId || account.email === nodeAccountId)
        : undefined;
      const account = selectedAccount || accounts.find((item: any) => item.isActive) || accounts[0];
      if (!account) {
        throw new Error('Tidak ada akun Google Vids. Tambahkan akun terlebih dahulu di Settings.');
      }

      const aspectRatio = targetNode.data?.aspectRatio === '16:9' ? '16:9' : '9:16';
      const resolution = aspectRatio === '16:9'
        ? '720p'
        : targetNode.data?.resolution === '1080p'
        ? '1080p'
        : '720p';
      const response = await fetch('/api/vids/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: effectivePrompt,
          aspectRatio,
          duration: 10,
          resolution,
          email: account.email,
          cookies: account.cookies || account.token,
          docId: account.docId || account.flixDocId,
          flixDocId: account.flixDocId || account.docId,
          serverToken: account.serverToken,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success || !result.videoUrl) {
        throw new Error(result?.error || `Google Vids gagal (HTTP ${response.status}).`);
      }

      if (typeof result.quota?.remaining === 'number') {
        const updatedAccounts = accounts.map((item: any) =>
          (account.id ? item.id === account.id : item.email === account.email)
            ? { ...item, credits: result.quota.remaining }
            : item
        );
        localStorage.setItem('vids_accounts', JSON.stringify(updatedAccounts));
        window.dispatchEvent(new Event('vids_accounts_updated'));
        window.dispatchEvent(new Event('accounts-updated'));
      }

      const videoUrl = result.videoUrl as string;
      updateAndPersistRecipe((prev) => ({
        ...prev,
        nodes: prev.nodes.map((node) => {
          if (node.id === videoNodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                outputVideo: videoUrl,
                videoUrl,
                resultUrl: videoUrl,
                accountId: account.id,
                accountEmail: account.email,
                status: 'completed',
                progress: 100,
                errorMessage: undefined,
              },
            };
          }
          if (connectedViewerNodeIds.includes(node.id)) {
            return {
              ...node,
              title: 'Google Vids Omni',
              data: {
                ...node.data,
                resultUrl: videoUrl,
                outputVideo: videoUrl,
                aspectRatio,
                status: 'completed',
                progress: 100,
                errorMessage: undefined,
              },
            };
          }
          return node;
        }),
      }));

      const historyItem: GenerationItem = {
        id: `gen_canvas_vids_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        mode: 'video',
        title: effectivePrompt.length > 50 ? `${effectivePrompt.slice(0, 50)}...` : effectivePrompt,
        prompt: effectivePrompt,
        createdAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
        aspectRatio,
        resolution,
        duration: '10s',
        status: 'completed',
        mediaUrl: videoUrl,
        thumbnailUrl: videoUrl,
        model: 'Google Vids Omni',
        provider: 'vids',
        providerName: 'Google Vids Omni',
        progress: 100,
      };
      try {
        const rawHistory = localStorage.getItem('weavy_generations');
        const history = rawHistory ? JSON.parse(rawHistory) : [];
        if (Array.isArray(history)) {
          localStorage.setItem('weavy_generations', JSON.stringify([historyItem, ...history]));
        }
      } catch (error) {
        console.error('[Canvas Vids] Gagal menyimpan video ke riwayat lokal:', error);
      }
      window.dispatchEvent(new CustomEvent('storage', { detail: { key: 'weavy_generations' } }));
      onAddGeneration?.(historyItem);

      setExecutingProgress(100);
      setStatusMessage('✓ Video Google Vids Omni berhasil dibuat.');
    } catch (error) {
      console.error('[Canvas Vids Execution Error]:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatusMessage(`Google Vids gagal: ${errorMessage}`);
      setRecipe((prev) => ({
        ...prev,
        nodes: prev.nodes.map((node) =>
          node.id === videoNodeId || connectedViewerNodeIds.includes(node.id)
            ? {
                ...node,
                data: { ...node.data, status: 'error', errorMessage, progress: 0 },
              }
            : node
        ),
      }));
    } finally {
      window.clearInterval(progressInterval);
      setExecutingProgress(0);
      setExecutingNodeIds((prev) => {
        const next = prev.filter((id) => id !== videoNodeId);
        if (next.length === 0) {
          setIsExecuting(false);
          setExecutingNodeId(null);
        } else {
          setExecutingNodeId(next[next.length - 1]);
        }
        return next;
      });
    }
  };

  const handleRemoveVidsWatermark = async (videoNodeId: string) => {
    const targetNode = recipeRef.current.nodes.find((node) => node.id === videoNodeId);
    if (
      !targetNode ||
      (targetNode.type !== 'vidsVideo' &&
        targetNode.type !== 'videoStitcher' &&
        targetNode.type !== 'imageInput')
    ) {
      throw new Error('Node video tidak ditemukan.');
    }

    let originalVideoUrl =
      targetNode.data?.outputVideo || targetNode.data?.videoUrl || targetNode.data?.resultUrl;
    if (targetNode.type === 'imageInput') {
      if (targetNode.data?.mediaType !== 'video' || !originalVideoUrl) {
        throw new Error('Node File tidak berisi video yang dapat diproses.');
      }

      if (originalVideoUrl.startsWith('data:video/')) {
        const videoBlob = await fetch(originalVideoUrl).then((response) => response.blob());
        if (!videoBlob.size) {
          throw new Error('File video lokal kosong atau tidak dapat dibaca.');
        }
        const formData = new FormData();
        formData.append('file', videoBlob, targetNode.data?.fileName || 'canvas-video.mp4');
        const cacheResponse = await fetch('/api/vids/cache-imported-video', {
          method: 'POST',
          body: formData,
        });
        const cacheResult = await cacheResponse.json().catch(() => ({}));
        if (!cacheResponse.ok || !cacheResult.videoUrl) {
          throw new Error(
            cacheResult.error || `Gagal menyiapkan video lokal (HTTP ${cacheResponse.status}).`
          );
        }
        originalVideoUrl = cacheResult.videoUrl;
      }
    }

    if (!/^\/media-cache\/(?:vids|stitched|canvas)_[^/]+\.mp4$/i.test(originalVideoUrl || '')) {
      throw new Error('Video ini tidak didukung proses remove watermark.');
    }
    if (/_nowm\.mp4$/i.test(originalVideoUrl)) {
      throw new Error('Watermark video ini sudah pernah dihapus.');
    }

    setStatusMessage(
      targetNode.type === 'videoStitcher'
        ? 'Memproses remove watermark untuk hasil Video Stitcher...'
        : targetNode.type === 'imageInput'
        ? 'Memproses remove watermark untuk video impor...'
        : 'Memproses remove watermark untuk video Google Vids...'
    );
    const response = await fetch('/api/vids/remove-watermark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl: originalVideoUrl }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `Permintaan gagal (HTTP ${response.status}).`);
    }
    if (!response.body) {
      throw new Error('Server tidak mengirim log proses remove watermark.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let processedVideoUrl: string | undefined;
    const handleEvent = (line: string) => {
      if (!line.trim()) return;
      const event = JSON.parse(line) as { type: string; message?: string; videoUrl?: string };
      if (event.type === 'log' && event.message) {
        setStatusMessage(event.message);
      } else if (event.type === 'complete' && event.videoUrl) {
        processedVideoUrl = event.videoUrl;
      } else if (event.type === 'error') {
        throw new Error(event.message || 'Proses remove watermark gagal.');
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) handleEvent(line);
      if (done) break;
    }
    handleEvent(buffer);
    if (!processedVideoUrl) {
      throw new Error('Proses berakhir tanpa mengembalikan file hasil.');
    }

    const connectedViewerNodeIds = getConnectedViewerIds(videoNodeId);
    updateAndPersistRecipe((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) =>
        node.id === videoNodeId || connectedViewerNodeIds.includes(node.id)
          ? {
              ...node,
              data: {
                ...node.data,
                videoUrl: processedVideoUrl,
                ...(node.type === 'imageInput'
                  ? { mediaType: 'video' }
                  : { outputVideo: processedVideoUrl, resultUrl: processedVideoUrl }),
              },
            }
          : node
      ),
    }));

    try {
      const rawHistory = localStorage.getItem('weavy_generations');
      const history = rawHistory ? JSON.parse(rawHistory) : [];
      if (Array.isArray(history)) {
        const updatedHistory = history.map((item: GenerationItem) =>
          item.mediaUrl === originalVideoUrl
            ? { ...item, mediaUrl: processedVideoUrl, thumbnailUrl: processedVideoUrl }
            : item
        );
        localStorage.setItem('weavy_generations', JSON.stringify(updatedHistory));
      }
    } catch (error) {
      console.error('[Canvas Vids] Gagal memperbarui riwayat setelah remove watermark:', error);
    }
    window.dispatchEvent(new CustomEvent('storage', { detail: { key: 'weavy_generations' } }));
    setStatusMessage('✓ Remove watermark selesai. Preview video diperbarui.');
  };

  // Execution Engine: Run Video Stitcher Node (FFmpeg Multi-Scene Concat)
  const handleRunVideoStitcherNode = async (stitcherNodeId: string) => {
    const targetNode = recipeRef.current.nodes.find((n) => n.id === stitcherNodeId);
    if (!targetNode || targetNode.type !== 'videoStitcher') return;

    const videoUrls = resolveStitcherInputs(stitcherNodeId, recipeRef.current.nodes, recipeRef.current.edges);

    // Guard: semua port yang terhubung HARUS sudah punya video. Kalau belum, jangan stitch sebagian.
    const connectedPortCount = (targetNode.inputs || []).filter((port) =>
      recipeRef.current.edges.some((e) => e.targetNodeId === stitcherNodeId && e.targetInputId === port.id)
    ).length;
    if (videoUrls.length < connectedPortCount) {
      const pending = connectedPortCount - videoUrls.length;
      const errMsg = `Masih ada ${pending} input video yang belum selesai/kosong. Tunggu node hulu selesai dulu.`;
      setStatusMessage(`Video Stitcher: ${errMsg}`);
      setRecipe((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === stitcherNodeId
            ? { ...n, data: { ...n.data, status: 'error', errorMessage: errMsg, progress: 0 } }
            : n
        ),
      }));
      return;
    }

    if (videoUrls.length === 0) {
      const errMsg = 'Hubungkan minimal 1 atau lebih video ke port input Video Stitcher.';
      setStatusMessage(`Video Stitcher: ${errMsg}`);
      setRecipe((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === stitcherNodeId
            ? { ...n, data: { ...n.data, status: 'error', errorMessage: errMsg, progress: 0 } }
            : n
        ),
      }));
      return;
    }

    // Find all connected video/image viewer nodes
    const connectedViewerNodeIds = getConnectedViewerIds(stitcherNodeId);
    const viewerNodeId = connectedViewerNodeIds[0];

    setIsExecuting(true);
    setExecutingProgress(20);
    setExecutingNodeId(stitcherNodeId);
    setExecutingNodeIds((prev) => [...prev.filter((id) => id !== stitcherNodeId), stitcherNodeId]);
    setStatusMessage(`Menggabungkan ${videoUrls.length} klip video (FFmpeg)... 20%`);

    setRecipe((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === stitcherNodeId || (viewerNodeId && n.id === viewerNodeId) || connectedViewerNodeIds.includes(n.id)
          ? { ...n, data: { ...n.data, status: 'running', progress: 20, errorMessage: undefined } }
          : n
      ),
    }));

    try {
      const resp = await fetch('/api/canvas/stitch-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrls,
          aspectRatio: targetNode.data?.aspectRatio || '9:16',
          resolution: targetNode.data?.resolution || '1080p',
          transition: targetNode.data?.transition || 'none',
        }),
      });

      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.success) {
        throw new Error(data?.error || 'Gagal menggabungkan video via FFmpeg.');
      }

      const finalVideoUrl = data.mediaUrl;
      const duration = data.duration || '0s';

      setRecipe((prev) => {
        const nextNodes = prev.nodes.map((n) => {
          if (n.id === stitcherNodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                outputVideo: finalVideoUrl,
                videoUrl: finalVideoUrl,
                resultUrl: finalVideoUrl,
                status: 'completed',
                progress: 100,
                duration,
                errorMessage: undefined,
              },
            };
          }
          if ((viewerNodeId && n.id === viewerNodeId) || connectedViewerNodeIds.includes(n.id)) {
            return {
              ...n,
              title: 'Stitched Video',
              data: {
                ...n.data,
                resultUrl: finalVideoUrl,
                outputVideo: finalVideoUrl,
                videoUrl: finalVideoUrl,
                status: 'completed',
                progress: 100,
                duration,
                errorMessage: undefined,
              },
            };
          }
          return n;
        });

        const updatedRecipe = { ...prev, nodes: nextNodes };
        recipeRef.current = updatedRecipe;
        if (currentFileId) {
          updateCanvasFile(currentFileId, { recipe: updatedRecipe, updatedAt: Date.now() });
        }
        return updatedRecipe;
      });

      // Save to History tab
      const canvasHistoryItem: GenerationItem = {
        id: `gen_stitch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        mode: 'video',
        title: `Video Stitcher (${videoUrls.length} klip • ${duration})`,
        prompt: `FFmpeg Concat ${videoUrls.length} klip video (${targetNode.data?.aspectRatio || '9:16'})`,
        createdAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
        aspectRatio: targetNode.data?.aspectRatio || '9:16',
        resolution: targetNode.data?.resolution || '1080p',
        duration,
        status: 'completed',
        mediaUrl: finalVideoUrl,
        thumbnailUrl: finalVideoUrl,
        model: 'Video Stitcher',
        provider: 'gemini',
        providerName: 'FFmpeg Concat',
        progress: 100,
        taskId: `stitch_${Date.now()}`,
      };

      try {
        const rawGen = localStorage.getItem('weavy_generations');
        const existingGen = rawGen ? JSON.parse(rawGen) : [];
        if (Array.isArray(existingGen)) {
          const filtered = existingGen.filter((g: any) => g.mediaUrl !== finalVideoUrl && g.id !== canvasHistoryItem.id);
          localStorage.setItem('weavy_generations', JSON.stringify([canvasHistoryItem, ...filtered]));
        }
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('storage', { detail: { key: 'weavy_generations' } }));

      if (onAddGeneration) {
        onAddGeneration(canvasHistoryItem);
      }

      setExecutingProgress(100);
      setStatusMessage(`✓ Berhasil menggabungkan ${videoUrls.length} klip video menjadi satu!`);
    } catch (err: any) {
      console.error('[Canvas Video Stitcher Execution Error]:', err);
      const errMsg = err?.message || String(err) || 'Terjadi kesalahan saat menggabungkan video.';
      setStatusMessage(`Video Stitcher: ${errMsg}`);

      setRecipe((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === stitcherNodeId || (viewerNodeId && n.id === viewerNodeId)
            ? {
                ...n,
                data: {
                  ...n.data,
                  status: 'error',
                  errorMessage: errMsg,
                  progress: 0,
                },
              }
            : n
        ),
      }));
    } finally {
      setExecutingProgress(0);
      setExecutingNodeIds((prev) => {
        const next = prev.filter((id) => id !== stitcherNodeId);
        if (next.length === 0) {
          setIsExecuting(false);
          setExecutingNodeId(null);
        } else {
          setExecutingNodeId(next[next.length - 1]);
        }
        return next;
      });
    }
  };

  // Execution Engine: Run AI Worker (ekstraksi data produk dari link)
  const handleRunAiWorkerNode = async (workerNodeId: string) => {
    const workerNode = recipeRef.current.nodes.find((n) => n.id === workerNodeId);
    if (!workerNode || workerNode.type !== 'aiWorker') return;

    const setWorkerData = (patch: Record<string, any>) =>
      setRecipe((prev) => {
        const nextRecipe = {
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === workerNodeId ? { ...n, data: { ...n.data, ...patch } } : n
          ),
        };
        recipeRef.current = nextRecipe;
        return nextRecipe;
      });

    // Link dari node yang tersambung ke port Link didahulukan, lalu kolom link di node ini
    const connectedText = resolveEnhancerInputs(workerNodeId, recipeRef.current.nodes, recipeRef.current.edges).prompt;
    const linkText = (connectedText || workerNode.data?.linkText || '').trim();
    const note = workerNode.data?.note || '';

    if (!linkText) {
      const errMsg = 'Isi link produk dulu atau hubungkan node teks ke port Link.';
      setStatusMessage(`AI Worker: ${errMsg}`);
      setWorkerData({ status: 'error', progress: 0, errorMessage: errMsg });
      return;
    }

    setIsExecuting(true);
    setExecutingProgress(30);
    setExecutingNodeId(workerNodeId);
    setExecutingNodeIds((prev) => [...prev.filter((id) => id !== workerNodeId), workerNodeId]);
    setStatusMessage('AI Worker: mengekstrak data produk...');
    setWorkerData({ status: 'running', progress: 30, errorMessage: undefined, isSample: false });

    try {
      const r = await runAiWorkerExtraction(linkText, note);
      const selected = r.galleryUrls.slice(0, 3);

      setRecipe((prev) => {
        const nextRecipe = {
          ...prev,
          nodes: prev.nodes.map((n) => {
            if (n.id === workerNodeId) {
              return {
                ...n,
                data: {
                  ...n.data,
                  status: 'completed',
                  progress: 100,
                  errorMessage: undefined,
                  isSample: false,
                  product: r.product,
                  verified: r.verified,
                  contextText: r.contextText,
                  galleryUrls: r.galleryUrls,
                  selectedImageUrls: selected,
                  processedLinkText: linkText,
                  processedNoteText: note,
                },
              };
            }
            return n;
          }),
        };
        recipeRef.current = nextRecipe;
        return nextRecipe;
      });

      const notes: string[] = [];
      if (r.linkCount > 1) notes.push(`hanya link pertama dari ${r.linkCount} link yang diproses`);
      if (!r.verified.title) notes.push('nama produk tidak terbaca');
      if (r.galleryUrls.length === 0) notes.push('tidak ada foto yang bisa dimuat');
      setStatusMessage(
        `✓ AI Worker selesai (${r.galleryUrls.length} foto)${notes.length ? ' • ' + notes.join(', ') : ''}`
      );
    } catch (err: any) {
      const errMsg = err?.message || 'Gagal menjalankan AI Worker.';
      setWorkerData({ status: 'error', progress: 0, errorMessage: errMsg });
      setStatusMessage(`AI Worker: ${errMsg}`);
    } finally {
      setExecutingProgress(0);
      setExecutingNodeIds((prev) => {
        const next = prev.filter((id) => id !== workerNodeId);
        if (next.length === 0) {
          setIsExecuting(false);
          setExecutingNodeId(null);
        } else {
          setExecutingNodeId(next[next.length - 1]);
        }
        return next;
      });
    }
  };

  // Run Selected: jalankan node yang terpilih satu per satu, urut sesuai arah kabel (kiri → kanan).
  // Node yang tidak terpilih dilewati. Node yang sudah punya hasil tetap dijalankan ulang.
  // Berhenti di node pertama yang gagal.
  useEffect(() => {
    runModelNodeRef.current = handleRunModelNode;
    runSelectedRef.current = handleRunSelectedNodes;
  });

  // Run Selected: eksekusi node terpilih secara cerdas berbasis DAG (Directed Acyclic Graph).
  // Node pada gelombang (wave) yang independen / tidak saling bergantung (seperti beberapa node Gemini Video atau Image Model)
  // dieksekusi secara PARALEL BERSAMAAN (Promise.allSettled) agar proses sangat cepat tanpa antre satu per satu.
  const handleRunSelectedNodes = async () => {
    if (isRunningAllRef.current) return;

    const snapshot = recipeRef.current;
    const selected = new Set(selectedNodeIdsRef.current);
    const nodes = snapshot.nodes;

    // Filter runnable nodes yang sedang dipilih
    const runnableSelected = nodes
      .filter((n) =>
        selected.has(n.id) &&
        RUNNABLE_NODE_TYPES.includes(n.type) &&
        !(n.type === 'aiWorker' && snapshot.edges.some((edge) =>
          edge.sourceNodeId === n.id &&
          snapshot.nodes.some((target) => target.id === edge.targetNodeId && target.type === 'storyboard')
        ))
      )
      .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);

    if (runnableSelected.length === 0) return;

    // Fungsi helper: apakah ada path terarah dari startId menuju targetId pada graph kabel canvas
    // (Bisa melewati node perantara seperti imageViewer atau promptEnhancer)
    const hasPath = (startId: string, targetId: string, edges: CanvasEdge[]): boolean => {
      if (startId === targetId) return false;
      const visited = new Set<string>();
      const queue = [startId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (curr === targetId) return true;
        for (const edge of edges) {
          if (edge.sourceNodeId === curr && !visited.has(edge.targetNodeId)) {
            visited.add(edge.targetNodeId);
            queue.push(edge.targetNodeId);
          }
        }
      }
      return false;
    };

    const tick = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    isRunningAllRef.current = true;
    runAllCancelRef.current = false;
    setIsExecuting(true);

    const totalNodesCount = runnableSelected.length;
    let completedCount = 0;
    let remaining = [...runnableSelected];

    try {
      while (remaining.length > 0) {
        if (runAllCancelRef.current) break;

        const currentEdges = recipeRef.current.edges;

        // Ambil semua node yang sudah siap (tidak memiliki dependency hulu yang belum selesai di dalam 'remaining')
        const readyNodes = remaining.filter((candidate) => {
          return !remaining.some(
            (other) => other.id !== candidate.id && hasPath(other.id, candidate.id, currentEdges)
          );
        });

        // Fallback jika ada siklus kabel (cycle): ambil node pertama berdasarkan posisi X terkiri
        const wave = readyNodes.length > 0 ? readyNodes : [remaining[0]];

        // Update toolbar running status
        const isParallel = wave.length > 1;
        const waveNames = wave.map((n) => n.title || n.data?.modelDisplayName || n.type).join(', ');
        const waveTitle = isParallel ? `${wave.length} Node Paralel (${waveNames})` : wave[0].title;

        setRunAllState({
          current: Math.min(completedCount + wave.length, totalNodesCount),
          total: totalNodesCount,
          title: waveTitle,
        });

        // Reset status node pada wave ini ke idle agar re-run bersih
        const waveIdSet = new Set(wave.map((n) => n.id));
        setRecipe((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) =>
            waveIdSet.has(n.id)
              ? { ...n, data: { ...n.data, status: 'idle', errorMessage: undefined } }
              : n
          ),
        }));
        await tick(100);

        // Planner preview mengalokasikan seluruh recipe secara unik; node terpilih
        // pada wave mempertahankan assignment yang sama saat dikirim ke lease runner.
        await Promise.allSettled(
          wave.map(async (node) => {
            try {
              const plannedAccountId = node.type === 'geminiVideo'
                ? geminiAccountAssignments.get(node.id)?.accountId
                : undefined;
              await runModelNodeRef.current?.(node.id, plannedAccountId);
            } catch (nodeErr) {
              console.error(`[Canvas Run Selected] Error on node ${node.id}:`, nodeErr);
            } finally {
              completedCount++;
              setRunAllState((prev) =>
                prev ? { ...prev, current: Math.min(completedCount, totalNodesCount) } : null
              );
            }
          })
        );
        await tick(100);

        // Keluarkan node wave saat ini dari remaining
        remaining = remaining.filter((n) => !waveIdSet.has(n.id));

        // Periksa apakah ada node pada wave ini yang gagal
        const failedNodes = wave.filter((node) => {
          const after = recipeRef.current.nodes.find((n) => n.id === node.id);
          return after?.data?.status !== 'completed';
        });

        // Jika ada node gagal, lewati node downstream yang bergantung padanya
        if (failedNodes.length > 0) {
          const failedIdSet = new Set(failedNodes.map((f) => f.id));
          const blockedDownstream = remaining.filter((rem) =>
            Array.from(failedIdSet).some((failedId) => hasPath(failedId, rem.id, currentEdges))
          );

          if (blockedDownstream.length > 0) {
            const blockedIds = new Set(blockedDownstream.map((b) => b.id));
            remaining = remaining.filter((r) => !blockedIds.has(r.id));
            setStatusMessage(
              `Node "${failedNodes[0].title}" gagal. Melewati ${blockedDownstream.length} node turunannya.`
            );
          } else {
            setStatusMessage(
              `Peringatan: Node "${failedNodes[0].title}" tidak selesai.`
            );
          }
        }
      }
    } finally {
      isRunningAllRef.current = false;
      runAllCancelRef.current = false;
      setRunAllState(null);
      setIsExecuting(false);
      setExecutingProgress(0);
      setExecutingNodeId(null);
      setExecutingNodeIds([]);
    }
  };

  // Execution Engine: Run Node or Recipe
  const handleRunModelNode = async (modelNodeId: string, plannedAccountId?: string) => {
    const targetNode = recipeRef.current.nodes.find((n) => n.id === modelNodeId);
    if (!targetNode) return;

    if (targetNode.type === 'promptEnhancer' || targetNode.type === 'anyLLM') {
      return handleRunPromptEnhancerNode(modelNodeId);
    }

    if (targetNode.type === 'geminiVideo') {
      return handleRunGeminiVideoNode(modelNodeId, plannedAccountId);
    }

    if (targetNode.type === 'vidsVideo') {
      return handleRunVidsVideoNode(modelNodeId);
    }

    if (targetNode.type === 'videoStitcher') {
      return handleRunVideoStitcherNode(modelNodeId);
    }

    if (targetNode.type === 'storyboard') {
      return handleRunStoryboardNode(modelNodeId);
    }

    if (targetNode.type === 'aiWorker') {
      return handleRunAiWorkerNode(modelNodeId);
    }

    if (targetNode.type !== 'imageModel') return;
    const modelNode = targetNode;

    // Resolve connected inputs (prompt and multiple reference images)
    const { prompt, imageUrl, imageUrls } = resolveModelInputs(
      modelNodeId,
      recipeRef.current.nodes,
      recipeRef.current.edges
    );

    if (!prompt) {
      setStatusMessage('Silakan isi teks prompt pada Prompt Node terlebih dahulu.');
      return;
    }

    // Find all connected image viewer nodes
    const connectedViewerNodeIds = getConnectedViewerIds(modelNodeId);
    const viewerNodeId = connectedViewerNodeIds[0];

    setIsExecuting(true);
    setExecutingProgress(10);
    setExecutingNodeId(modelNodeId);
    setExecutingNodeIds((prev) => [...prev.filter((id) => id !== modelNodeId), modelNodeId]);
    setStatusMessage('Merender AI... 10%');

    // Set model node and viewer to running
    setRecipe((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === modelNodeId || (viewerNodeId && n.id === viewerNodeId) || connectedViewerNodeIds.includes(n.id)
          ? { ...n, data: { ...n.data, status: 'running', progress: 10, errorMessage: undefined } }
          : n
      ),
    }));

    try {
      const modelData = modelNode.data;
      const modelId = modelData.modelId || 'fal-ai/nano-banana-pro/edit';

      // Map to AMB Media model name for Weavy engine
      let friendlyModelName = 'Nano Banana Pro';
      if (modelId.includes('seedream')) friendlyModelName = 'Seedream V5.0 Pro Edit';
      else if (modelId.includes('flare') || modelId.includes('gpt-image-2.5') || modelId.includes('gpt_image_2.5') || modelId.toLowerCase().includes('gpt image 2.5'))
        friendlyModelName = 'GPT Image 2.5';
      else if (modelId.includes('grok')) friendlyModelName = 'Grok Imagine Image';
      else if (modelId.includes('gpt_image') || modelId.includes('chatgpt'))
        friendlyModelName = 'ChatGPT Images 2.0 Edit';

      const estimatedCost = modelData.creditsCost || (friendlyModelName.includes('Seedream') ? 12 : (friendlyModelName.includes('GPT Image 2.5') ? 4 : (friendlyModelName.includes('Grok') ? 4 : 11)));
      if (typeof credits === 'number' && credits < estimatedCost) {
        setStatusMessage(`Kredit tidak mencukupi (Sisa: ${credits}, Butuh: ~${estimatedCost}). Silakan tambah atau ganti akun Weavy.`);
        throw new Error(`Kredit tidak mencukupi (Sisa: ${credits}, Dibutuhkan: ~${estimatedCost} kredit).`);
      }

      const targetAccountToUse = getSelectedWeavyAccountNow() || currentActiveAccount || (weavyAccountsList.find((a) => a.isActive) || weavyAccountsList[0]);
      const tokenToUse = (targetAccountToUse ? (targetAccountToUse.idToken || '') : (weavyToken || ''));
      const refreshTokenToUse = (targetAccountToUse ? (targetAccountToUse.refreshToken || '') : (refreshToken || ''));

      const payload = {
        refreshToken: refreshTokenToUse,
        idToken: tokenToUse,
        prompt,
        mode: 'image',
        model: friendlyModelName,
        quality: modelData.quality || 'high',
        aspect_ratio: modelData.aspectRatio || '9:16',
        resolution: modelData.resolution || '1080p',
        image_url: imageUrl || undefined,
        images: imageUrls && imageUrls.length > 0 ? imageUrls : undefined,
        attached_media: (imageUrls && imageUrls.length > 0)
          ? imageUrls.map((url) => ({ url, type: 'image' }))
          : imageUrl
          ? [{ url: imageUrl, type: 'image' }]
          : undefined,
      };

      console.log('[Canvas Run] Submitting image generation task...', payload);

      const extensionConnected = await extensionBridge.waitForConnection(4000);
      if (!extensionConnected) {
        throw new Error('Ekstensi Weavy belum terhubung. Buka tab app.weavy.ai dan pastikan ekstensi aktif; generasi Canvas tidak dikirim ke server.');
      }

      console.log('[Canvas Run 🎨] Menjalankan generasi Weavy via Chrome Extension Bridge...');
      const genData = await extensionBridge.generateWeavy(payload, { bridgeOnly: true });

      if (!genData || !genData.success) {
        throw new Error(genData?.error || 'Gagal mengirim instruksi generasi ke Weavy.');
      }

      const taskId = genData.taskId || genData.batchId;
      const recipeId = genData.recipeId;
      setStatusMessage('Task berhasil dibuat. Menunggu proses render Weavy...');

      // Optimistic credit deduction immediately so UI reflects usage right away
      updateCanvasDirectAccountCredits(Math.max(0, credits - estimatedCost));

      // Polling for completion
      if (!recipeId || !taskId) {
        throw new Error('Ekstensi Weavy tidak mengembalikan ID recipe atau task untuk proses Canvas.');
      }

      const resultUrl = await extensionBridge.pollWeavyStatus({
        recipeId,
        taskId,
        batchId: taskId,
        idToken: tokenToUse,
        refreshToken: refreshTokenToUse,
        bridgeOnly: true,
        maxAttempts: 45,
        pollInterval: 2500,
        onProgress: (progress) => {
          setExecutingProgress(progress);
          setStatusMessage(`Merender AI... ${Math.round(progress)}%`);
          setRecipe((prev) => ({
            ...prev,
            nodes: prev.nodes.map((n) =>
              n.id === modelNodeId || connectedViewerNodeIds.includes(n.id)
                ? { ...n, data: { ...n.data, status: 'running', progress } }
                : n
            ),
          }));
        },
        onCreditUpdate: (returnedCredits) => {
          updateCanvasDirectAccountCredits(returnedCredits);
        },
      });

      if (!resultUrl) {
        throw new Error('Ekstensi Weavy tidak mengembalikan URL hasil generasi.');
      }

      // Success! Update Model node and Viewer node with result
      const finalModelName = getCleanModelName(friendlyModelName);
      setRecipe((prev) => {
        const nextNodes = prev.nodes.map((n) => {
          if (n.id === modelNodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                resultUrl,
                outputImage: resultUrl,
                status: 'completed',
                progress: 100,
                aspectRatio: modelData.aspectRatio || '1:1',
                modelDisplayName: finalModelName,
                errorMessage: undefined,
              },
            };
          }
          if ((viewerNodeId && n.id === viewerNodeId) || connectedViewerNodeIds.includes(n.id)) {
            return {
              ...n,
              title: finalModelName,
              data: {
                ...n.data,
                resultUrl,
                outputImage: resultUrl,
                status: 'completed',
                progress: 100,
                aspectRatio: modelData.aspectRatio || '1:1',
                modelDisplayName: finalModelName,
                modelId: modelData.modelId,
                errorMessage: undefined,
              },
            };
          }
          return n;
        });

        const updatedRecipe = { ...prev, nodes: nextNodes };
        if (currentFileId) {
          updateCanvasFile(currentFileId, { recipe: updatedRecipe, updatedAt: Date.now() });
        }
        return updatedRecipe;
      });

      // Also record accurately in History tab
      const canvasHistoryItem: GenerationItem = {
        id: `gen_canvas_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        mode: 'image',
        title: prompt ? (prompt.length > 50 ? prompt.slice(0, 50) + '...' : prompt) : finalModelName,
        prompt: prompt || finalModelName,
        createdAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
        aspectRatio: modelData.aspectRatio || '1:1',
        resolution: modelData.resolution || '1K',
        status: 'completed',
        mediaUrl: resultUrl,
        thumbnailUrl: resultUrl,
        model: finalModelName,
        provider: 'weavy',
        providerName: 'Weavy',
        progress: 100,
        taskId: taskId || `canvas_task_${Date.now()}`,
        recipeId: recipeId || `recipe_${Date.now()}`,
      };

      // 1. Persist directly to localStorage 'weavy_generations' for instant synchronization
      try {
        const rawGen = localStorage.getItem('weavy_generations');
        const existingGen = rawGen ? JSON.parse(rawGen) : [];
        if (Array.isArray(existingGen)) {
          const filtered = existingGen.filter((g: any) => g.mediaUrl !== resultUrl && g.id !== canvasHistoryItem.id);
          localStorage.setItem('weavy_generations', JSON.stringify([canvasHistoryItem, ...filtered]));
        }
      } catch (e) {
        console.warn('Failed saving canvas item directly to localStorage:', e);
      }

      // 2. Dispatch storage event so all tabs/views update reactively
      window.dispatchEvent(new CustomEvent('storage', { detail: { key: 'weavy_generations' } }));

      // 3. Update parent App state
      if (onAddGeneration) {
        onAddGeneration(canvasHistoryItem);
      }

      if (onRefreshCredits) onRefreshCredits(targetAccountToUse);
      setExecutingProgress(100);
      setStatusMessage(`✓ Gambar ${finalModelName} selesai digenerate dan tersimpan ke menu Histori!`);
    } catch (err: any) {
      console.error('[Canvas Execution Error]:', err);
      // Re-sync credits in case of deduction rollback or error
      const targetAccountToUse = getSelectedWeavyAccountNow() || currentActiveAccount || (weavyAccountsList.find((a) => a.isActive) || weavyAccountsList[0]);
      if (onRefreshCredits) onRefreshCredits(targetAccountToUse);
      let errMsg = err?.message || String(err) || 'Terjadi kesalahan render.';

      // Clean up common verbose backend prefixes
      if (errMsg.includes('Failed running ChatGPT Images 2.0 Edit: ')) {
        errMsg = errMsg.replace('Failed running ChatGPT Images 2.0 Edit: ', '');
      } else if (errMsg.includes('Failed running Seedream V5.0 Pro Edit: ')) {
        errMsg = errMsg.replace('Failed running Seedream V5.0 Pro Edit: ', '');
      } else if (errMsg.includes('Prediction failed: Async prediction failed: Exception: ')) {
        errMsg = errMsg.replace('Prediction failed: Async prediction failed: Exception: ', '');
      } else if (errMsg.includes('Prediction failed: ')) {
        errMsg = errMsg.replace('Prediction failed: ', '');
      }

      // Handle safety system violations gracefully
      if (
        errMsg.toLowerCase().includes('safety system') ||
        errMsg.toLowerCase().includes('safety_violations') ||
        errMsg.toLowerCase().includes('content violation') ||
        errMsg.toLowerCase().includes('nsfw')
      ) {
        errMsg = 'OpenAI Safety System: Permintaan ditolak karena melanggar panduan konten/keamanan. Silakan sesuaikan prompt atau gambar input Anda.';
      }

      setStatusMessage(`Gagal: ${errMsg}`);
      setRecipe((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === modelNodeId || (viewerNodeId && n.id === viewerNodeId)
            ? {
                ...n,
                data: {
                  ...n.data,
                  status: 'error',
                  errorMessage: errMsg,
                  progress: 0,
                },
              }
            : n
        ),
      }));
    } finally {
      setExecutingProgress(0);
      setExecutingNodeIds((prev) => {
        const next = prev.filter((id) => id !== modelNodeId);
        if (next.length === 0) {
          setIsExecuting(false);
          setExecutingNodeId(null);
        } else {
          setExecutingNodeId(next[next.length - 1]);
        }
        return next;
      });
    }
  };

  // Export recipe JSON
  const handleExportJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(recipe, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `${recipe.name.toLowerCase().replace(/\s+/g, '_')}_canvas.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // If no file is opened, show Weavy-style "My files" Dashboard
  if (currentFileId === null) {
    return (
      <CanvasDashboard
        files={files}
        activeWorkspaceName={
          currentActiveAccount?.name ||
          (currentActiveAccount?.email ? currentActiveAccount.email.split('@')[0] : workspaceName)
        }
        userAvatarInitial={
          (
            currentActiveAccount?.name ||
            (currentActiveAccount?.email ? currentActiveAccount.email.split('@')[0] : workspaceName)
          )
            .charAt(0)
            .toUpperCase()
        }
        weavyAccounts={weavyAccountsList}
        activeAccountId={currentActiveAccount?.id}
        onSelectAccount={handleSelectWeavyAccount}
        onCreateNewFile={(presetRecipe, title) => {
          const newFile = createNewCanvasFile(title || 'untitled', presetRecipe);
          const allFiles = loadAllCanvasFiles();
          setFiles(allFiles);
          setCurrentFileId(newFile.id);
          setRecipe(newFile.recipe);
          setUndoStack([]);
          setRedoStack([]);
          setSelectedNodeIds([]);
          setSelectedEdgeId(null);
        }}
        onOpenFile={(file) => {
          setCurrentFileId(file.id);
          setRecipe(file.recipe);
          setUndoStack([]);
          setRedoStack([]);
          setSelectedNodeIds([]);
          setSelectedEdgeId(null);
        }}
        onDuplicateFile={(fileId) => {
          duplicateCanvasFile(fileId);
          setFiles(loadAllCanvasFiles());
        }}
        onRenameFile={(fileId, newName) => {
          updateCanvasFile(fileId, { name: newName });
          setFiles(loadAllCanvasFiles());
        }}
        onDeleteFile={(fileId, permanent) => {
          deleteCanvasFile(fileId, permanent);
          setFiles(loadAllCanvasFiles());
        }}
        onRestoreFile={(fileId) => {
          restoreCanvasFile(fileId);
          setFiles(loadAllCanvasFiles());
        }}
        onCleanEmptyFiles={() => {
          deleteAllEmptyCanvasFiles();
          setFiles(loadAllCanvasFiles());
        }}
        onBackToApp={onBack}
      />
    );
  }

  return (
    <div className="flex w-full h-screen min-h-screen overflow-hidden bg-[#E6E2DA] dark:bg-[#0E0E12]">
    <div
      ref={setCanvasContainerRef}
      className={`relative flex-1 min-w-0 h-screen min-h-screen bg-[#E6E2DA] dark:bg-[#0E0E12] overflow-hidden select-none canvas-grid-dots ${
        isPanning
          ? 'cursor-grabbing'
          : isSpacePressed || activeTool === 'pan'
          ? 'cursor-grab'
          : 'cursor-default'
      }`}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onPointerMove={handleContainerPointerMove}
      onDragOver={handleCanvasDragOver}
      onDragLeave={handleCanvasDragLeave}
      onDrop={handleCanvasDrop}
    >
      {/* Subtle drag-over indicator */}
      {isCanvasDragOver && (
        <div className="absolute inset-0 z-50 pointer-events-none border-2 border-dashed border-blue-500/40 bg-blue-500/5 transition-all" />
      )}
      {/* Top Floating Control Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-40 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Back to My Files & File Name Title */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              setFiles(loadAllCanvasFiles());
              setCurrentFileId(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-700 dark:text-stone-200 hover:text-stone-950 dark:hover:text-white bg-white/80 dark:bg-[#1a1a20]/90 hover:bg-stone-100 dark:hover:bg-[#25252c] border border-stone-200 dark:border-white/10 active:scale-95 transition-all cursor-pointer select-none shadow-xs"
            title="Kembali ke My files"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>My files</span>
          </button>

          {activeFile && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/80 dark:bg-[#1a1a20]/90 border border-stone-200 dark:border-white/10 shadow-xs text-xs font-medium text-stone-700 dark:text-stone-200">
              <span className="text-stone-400 font-normal">/</span>
              <input
                type="text"
                value={activeFile.name}
                onChange={(e) => {
                  const val = e.target.value;
                  updateCanvasFile(activeFile.id, { name: val });
                  setFiles((prev) => prev.map((f) => (f.id === activeFile.id ? { ...f, name: val } : f)));
                  setRecipe((prev) => ({ ...prev, name: val }));
                }}
                className="bg-transparent text-stone-900 dark:text-white font-semibold focus:outline-none focus:bg-black/5 dark:focus:bg-white/10 rounded px-1 max-w-[140px] sm:max-w-[200px] truncate"
                placeholder="untitled"
              />
            </div>
          )}
        </div>

        {/* Right: Account, Credits, Theme & Export */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Active Account & Credit Pill */}
          <div className="relative flex items-center gap-1.5" ref={accountMenuRef}>
            {weavyAccountsList.length > 1 && (
              <button
                type="button"
                onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-[#1a1a20]/90 hover:bg-white dark:hover:bg-[#25252c] border border-stone-200 dark:border-white/10 text-xs font-semibold text-stone-700 dark:text-stone-200 shadow-xs active:scale-95 transition-all cursor-pointer select-none"
                title="Pilih akun Weavy yang aktif di Canvas"
              >
                <div className="w-4 h-4 rounded-full bg-sky-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                  {(currentActiveAccount?.name || currentActiveAccount?.email || 'W').charAt(0).toUpperCase()}
                </div>
                <span className="truncate max-w-[85px] sm:max-w-[120px]">
                  {currentActiveAccount?.name || (currentActiveAccount?.email ? currentActiveAccount.email.split('@')[0] : 'Akun Weavy')}
                </span>
                <ChevronDown className={`w-3 h-3 text-stone-400 transition-transform ${isAccountMenuOpen ? 'rotate-180' : ''}`} />
              </button>
            )}

            <button
              type="button"
              onClick={syncCanvasCredits}
              disabled={isSyncingCredits}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 active:scale-95 transition-all cursor-pointer group select-none"
              title={`Sisa kredit akun aktif (${currentActiveAccount?.email || 'Weavy'}). Klik untuk sinkronisasi hanya akun ini.`}
            >
              <span className={`w-2 h-2 rounded-full bg-amber-500 shrink-0 ${isSyncingCredits ? 'animate-ping' : 'animate-pulse'}`} />
              <span>{credits} Kredit</span>
              <RefreshCw className={`w-3 h-3 text-amber-600 dark:text-amber-400 group-hover:rotate-180 transition-transform ${isSyncingCredits ? 'animate-spin' : ''}`} />
            </button>

            {/* Dropdown for switching accounts */}
            {isAccountMenuOpen && weavyAccountsList.length > 0 && (
              <div className="absolute top-full right-0 mt-1.5 w-64 bg-white dark:bg-[#1a1a20] border border-stone-200 dark:border-white/10 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 backdrop-blur-xl">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 border-b border-stone-100 dark:border-white/5 flex items-center justify-between">
                  <span>Pilih Akun Weavy</span>
                  <span>{weavyAccountsList.length} Akun</span>
                </div>
                <div className="max-h-52 overflow-y-auto flex flex-col gap-1 pr-1 custom-scrollbar">
                  {weavyAccountsList.map((acc: any) => {
                    const isCurrent = acc.id === currentActiveAccount?.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          handleSelectWeavyAccount(acc.id);
                          setIsAccountMenuOpen(false);
                        }}
                        className={`flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 text-stone-900 dark:text-white font-semibold'
                            : 'hover:bg-black/5 dark:hover:bg-white/5 text-stone-600 dark:text-stone-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                            isCurrent ? 'bg-amber-500 text-stone-950' : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                          }`}>
                            {(acc.name || acc.email || 'W').charAt(0).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <p className="truncate text-xs leading-tight">
                              {acc.name || (acc.email ? acc.email.split('@')[0] : 'Akun Weavy')}
                            </p>
                            {acc.email && (
                              <p className="text-[10px] text-stone-400 truncate">{acc.email}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                            {typeof acc.credits === 'number' ? acc.credits : 0} K
                          </span>
                          {isCurrent && <Check className="w-3.5 h-3.5 text-amber-500" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {onToggleDarkMode && (
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-colors cursor-pointer"
              title={isDarkMode ? 'Mode Terang' : 'Mode Gelap'}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={handleExportJson}
            className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-colors cursor-pointer"
            title="Export Recipe JSON"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weavy-Style Bottom Canvas Floating Toolbar (Move, Pan, Sticky Note | Undo, Redo | Zoom %) Centered */}
      <div
        ref={zoomMenuRef}
        className="canvas-light-skin absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-[#18181c]/95 dark:bg-[#18181c]/95 backdrop-blur-md px-2 py-1.5 rounded-xl border border-white/10 shadow-xl text-stone-300 select-none"
      >
        {/* 1. Move / Select Tool */}
        <button
          type="button"
          onClick={() => setActiveTool('select')}
          className={`w-8 h-8 rounded-lg transition-all cursor-pointer select-none flex items-center justify-center ${
            activeTool === 'select' && !isSpacePressed
              ? 'bg-white text-stone-950 shadow-xs'
              : 'text-stone-400 hover:text-white hover:bg-white/10'
          }`}
          title="Move / Selection Tool (V)"
        >
          <MousePointer2 className="w-4 h-4" />
        </button>

        {/* 2. Pan / Hand Tool */}
        <button
          type="button"
          onClick={() => setActiveTool('pan')}
          className={`w-8 h-8 rounded-lg transition-all cursor-pointer select-none flex items-center justify-center ${
            activeTool === 'pan' || isSpacePressed
              ? 'bg-white text-stone-950 shadow-xs'
              : 'text-stone-400 hover:text-white hover:bg-white/10'
          }`}
          title="Pan / Hand Tool (H / Tahan Spasi + Klik Kiri)"
        >
          <Hand className="w-4 h-4" />
        </button>

        {/* 3. Sticker Note (Sticky Note) */}
        <button
          type="button"
          onClick={handleAddStickyNote}
          className="w-8 h-8 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-all active:scale-95 cursor-pointer select-none flex items-center justify-center"
          title="Tambah Catatan / Sticky Note"
        >
          <StickyNote className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-[1px] h-4 bg-white/15 mx-1" />

        {/* 4. Undo */}
        <button
          type="button"
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          className={`w-8 h-8 rounded-lg transition-all select-none flex items-center justify-center ${
            undoStack.length > 0
              ? 'text-stone-300 hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer'
              : 'text-stone-600 opacity-40 cursor-not-allowed'
          }`}
          title={undoStack.length > 0 ? 'Undo (Ctrl+Z)' : 'Undo (Tidak ada riwayat)'}
        >
          <Undo2 className="w-4 h-4" />
        </button>

        {/* 5. Redo */}
        <button
          type="button"
          onClick={handleRedo}
          disabled={redoStack.length === 0}
          className={`w-8 h-8 rounded-lg transition-all select-none flex items-center justify-center ${
            redoStack.length > 0
              ? 'text-stone-300 hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer'
              : 'text-stone-600 opacity-40 cursor-not-allowed'
          }`}
          title={redoStack.length > 0 ? 'Redo (Ctrl+Y)' : 'Redo (Tidak ada riwayat)'}
        >
          <Redo2 className="w-4 h-4" />
        </button>

        {/* 6. Duplicate (Ctrl+D) */}
        <button
          type="button"
          onClick={() => handleDuplicateNodes()}
          disabled={selectedNodeIds.length === 0}
          className={`w-8 h-8 rounded-lg transition-all select-none flex items-center justify-center ${
            selectedNodeIds.length > 0
              ? 'text-stone-300 hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer'
              : 'text-stone-600 opacity-40 cursor-not-allowed'
          }`}
          title={
            selectedNodeIds.length > 0
              ? 'Duplikat Node Terpilih (Ctrl+D)'
              : 'Klik node lalu tekan Ctrl+D untuk menduplikat'
          }
        >
          <Copy className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-[1px] h-4 bg-white/15 mx-1" />

        {/* Run Selected (Ctrl+Enter) */}
        {(() => {
          const runnableCount = selectedNodeIds.filter((id) => {
            const n = recipe.nodes.find((node) => node.id === id);
            return !!n &&
              RUNNABLE_NODE_TYPES.includes(n.type) &&
              !(n.type === 'aiWorker' && recipe.edges.some((edge) =>
                edge.sourceNodeId === n.id &&
                recipe.nodes.some((target) => target.id === edge.targetNodeId && target.type === 'storyboard')
              ));
          }).length;
          const isRunning = !!runAllState;
          const canRun = isRunning || runnableCount > 0;
          return (
            <button
              type="button"
              onClick={() => {
                if (isRunning) {
                  runAllCancelRef.current = true;
                } else {
                  runSelectedRef.current?.();
                }
              }}
              disabled={!canRun}
              className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold transition-all select-none ${
                isRunning
                  ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 cursor-pointer'
                  : canRun
                  ? 'bg-amber-500 text-stone-950 hover:bg-amber-400 active:scale-95 cursor-pointer'
                  : 'text-stone-600 opacity-40 cursor-not-allowed'
              }`}
              title={
                isRunning
                  ? `Menjalankan "${runAllState?.title}". Klik untuk berhenti setelah node ini selesai.`
                  : canRun
                  ? `Jalankan ${runnableCount} node terpilih berurutan, kiri ke kanan (Ctrl+Enter)`
                  : 'Pilih node dulu (Ctrl+A untuk semua), lalu Run (Ctrl+Enter)'
              }
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="font-mono">
                    {runAllState?.current}/{runAllState?.total}
                  </span>
                  <Square className="w-3 h-3 fill-current" />
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{runnableCount > 0 ? `Run (${runnableCount})` : 'Run'}</span>
                </>
              )}
            </button>
          );
        })()}

        {/* Reset Selected: bersihkan input gambar + hasil generate node terpilih (kabel tidak disentuh) */}
        {(() => {
          const resettableCount = selectedNodeIds.filter((id) => {
            const n = recipe.nodes.find((node) => node.id === id);
            return !!n && RESETTABLE_NODE_TYPES.includes(n.type);
          }).length;
          const isBusy = !!runAllState || executingNodeIds.length > 0;
          const canReset = resettableCount > 0 && !isBusy;
          return (
            <button
              type="button"
              onClick={() => handleResetSelectedNodes()}
              disabled={!canReset}
              className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold transition-all select-none ${
                canReset
                  ? 'bg-white/10 text-stone-200 hover:bg-rose-500/20 hover:text-rose-200 active:scale-95 cursor-pointer'
                  : 'text-stone-600 opacity-40 cursor-not-allowed'
              }`}
              title={
                isBusy
                  ? 'Tunggu proses Run selesai dulu'
                  : canReset
                  ? `Reset ${resettableCount} node terpilih: hapus input gambar & hasil generate. Kabel tetap tersambung (Ctrl+Z untuk batal)`
                  : 'Pilih node dulu, lalu Reset untuk membersihkan input & hasil generate'
              }
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{resettableCount > 0 ? `Reset (${resettableCount})` : 'Reset'}</span>
            </button>
          );
        })()}

        {/* Divider */}
        <div className="w-[1px] h-4 bg-white/15 mx-1" />

        {/* 6. Zoom Dropdown Trigger */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsZoomMenuOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-semibold text-stone-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer select-none"
            title="Pengaturan Zoom Canvas"
          >
            <span className="font-mono font-bold">{Math.round(zoom * 100)}%</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${
                isZoomMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Zoom Popover Menu */}
          {isZoomMenuOpen && (
            <div className="canvas-light-skin absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-48 bg-[#18181c]/95 border border-white/10 rounded-xl shadow-xl p-1.5 z-50 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150">
              <button
                type="button"
                onClick={() => {
                  setZoom((z) => Math.min(z + 0.15, 2.2));
                  setIsZoomMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-stone-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <span>Perbesar (Zoom In)</span>
                <span className="text-[10px] text-stone-500 font-mono">+15%</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setZoom((z) => Math.max(z - 0.15, 0.3));
                  setIsZoomMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-stone-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <span>Perkecil (Zoom Out)</span>
                <span className="text-[10px] text-stone-500 font-mono">-15%</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 40, y: 40 });
                  setIsZoomMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-stone-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <span>Reset Tampilan</span>
                <span className="text-[10px] text-stone-500 font-mono">100%</span>
              </button>

              <div className="my-1 border-t border-white/10" />

              {/* Preset Zoom Levels */}
              {[2, 1.5, 1, 0.75, 0.5, 0.25].map((level) => {
                const isCurrent = Math.abs(zoom - level) < 0.05;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      setZoom(level);
                      setIsZoomMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                      isCurrent
                        ? 'text-amber-400 font-bold bg-amber-500/10'
                        : 'text-stone-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span>{Math.round(level * 100)}%</span>
                    {isCurrent && <Check className="w-3 h-3 text-amber-400" />}
                  </button>
                );
              })}

              <div className="my-1 border-t border-white/10" />

              <button
                type="button"
                onClick={() => {
                  handleAutoAlign();
                  setIsZoomMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer font-medium"
                title="Susun node secara otomatis"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-amber-400" />
                <span>Susun Rapi Otomatis</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Infinite Canvas Content Area (Scaled & Panned) */}
      <div
        className={`absolute inset-0 origin-top-left ${
          isPanning
            ? 'cursor-grabbing'
            : isSpacePressed || activeTool === 'pan'
            ? 'cursor-grab'
            : 'cursor-default'
        }`}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          width: '5000px',
          height: '5000px',
        }}
      >
        {/* SVG Wires Layer */}
        <CanvasWires
          edges={recipe.edges}
          nodes={recipe.nodes}
          selectedEdgeId={selectedEdgeId}
          onSelectEdge={(edgeId) => {
            setSelectedEdgeId(edgeId);
            setSelectedNodeIds([]);
            setSelectedGroupId(null);
            setIsInspectorOpen(false);
          }}
          onDeleteEdge={handleDeleteEdge}
          connectingWire={connectingWire}
          isGenerating={isExecuting || executingNodeIds.length > 0}
          executingNodeId={executingNodeId}
          executingNodeIds={executingNodeIds}
        />

        {/* Groups Layer (Rendered behind nodes) */}
        {(recipe.groups || []).map((group) => {
          const isGroupSelected =
            selectedGroupId === group.id ||
            (group.nodeIds.length > 0 &&
              group.nodeIds.length === selectedNodeIds.length &&
              group.nodeIds.every((id) => selectedNodeIds.includes(id)));

          return (
            <CanvasGroupCard
              key={group.id}
              group={group}
              nodes={recipe.nodes}
              isSelected={isGroupSelected}
              onSelect={() => {
                setSelectedEdgeId(null);
                setSelectedGroupId(group.id);
                setSelectedNodeIds(group.nodeIds);
              }}
              onStartDrag={(e) => handleStartDragGroup(group.id, e)}
              onUpdateTitle={(title) => handleUpdateGroupTitle(group.id, title)}
            />
          );
        })}

        {/* Nodes Layer */}
        {recipe.nodes.map((node) => {
          const incomingEdge = recipe.edges.find((e) => e.targetNodeId === node.id);
          const sourceNode = incomingEdge ? recipe.nodes.find((n) => n.id === incomingEdge.sourceNodeId) : null;
          const connectedSourceAspectRatio = sourceNode?.data?.aspectRatio;
          const isNodeSelected = selectedNodeIds.includes(node.id);
          const hideAiWorkerRunButton =
            node.type === 'aiWorker' &&
            recipe.edges.some((edge) =>
              edge.sourceNodeId === node.id &&
              recipe.nodes.some((target) => target.id === edge.targetNodeId && target.type === 'storyboard')
            );
          const storyboardWorkerNodes =
            node.type === 'storyboard'
              ? recipe.edges
                  .filter((edge) => edge.targetNodeId === node.id)
                  .map((edge) => recipe.nodes.find((source) => source.id === edge.sourceNodeId))
                  .filter((source): source is CanvasNode => source?.type === 'aiWorker')
              : [];
          const hasValidProductAnalysis =
            storyboardWorkerNodes.length > 0 &&
            storyboardWorkerNodes.every((worker) => {
              const inputs = resolveEnhancerInputs(worker.id, recipe.nodes, recipe.edges);
              const linkText = (inputs.prompt || worker.data?.linkText || '').trim();
              const signature = getAiWorkerAnalysisSignature(
                worker,
                linkText,
                String(worker.data?.note || '')
              );
              return Boolean(
                signature &&
                worker.data?.storyboardAnalysis?.trim() &&
                worker.data?.storyboardAnalysisSignature === signature
              );
            });
          const productAnalysisStatus =
            node.type === 'storyboard'
              ? node.data?.productAnalysisStatus === 'running'
                ? 'running'
                : hasValidProductAnalysis
                ? 'valid'
                : node.data?.productAnalysisStatus === 'error'
                ? 'error'
                : undefined
              : undefined;

          // Resolve connected model info for imageViewer nodes
          let connectedModelName: string | undefined = undefined;
          let connectedModelId: string | undefined = undefined;
          if (node.type === 'imageViewer') {
            if (sourceNode && sourceNode.type === 'imageModel') {
              connectedModelName = sourceNode.data?.modelDisplayName;
              connectedModelId = sourceNode.data?.modelId;
            } else {
              const modelNode = recipe.nodes.find((n) => n.type === 'imageModel');
              if (modelNode) {
                connectedModelName = modelNode.data?.modelDisplayName;
                connectedModelId = modelNode.data?.modelId;
              }
            }
          }

          // Resolve model inputs & scene metadata for model/video nodes
          const resolvedModel = (node.type === 'geminiVideo' || node.type === 'vidsVideo' || node.type === 'imageModel')
            ? resolveModelInputs(node.id, recipe.nodes, recipe.edges)
            : null;

          return (
            <div
              key={node.id}
              id={`canvas-node-${node.id}`}
              className="absolute cursor-default"
              style={{
                left: `${node.position.x}px`,
                top: `${node.position.y}px`,
                zIndex: isNodeSelected ? 20 : 10,
              }}
            >
              <CanvasNodeCard
                node={node}
                isSelected={isNodeSelected}
                isConnectingWire={connectingWire !== null}
                connectingWireSourceNodeId={connectingWire?.sourceNodeId}
                connectedInputPortIds={recipe.edges
                  .filter((e) => e.targetNodeId === node.id)
                  .map((e) => e.targetInputId)}
                connectedOutputPortIds={recipe.edges
                  .filter((e) => e.sourceNodeId === node.id)
                  .map((e) => e.sourceOutputId)}
                connectedSourceAspectRatio={connectedSourceAspectRatio}
                connectedModelName={connectedModelName}
                connectedModelId={connectedModelId}
                onSelect={(e) => handleSelectNode(node.id, e)}
                onDelete={handleDeleteNode}
                onUpdateData={handleUpdateNodeData}
                onRemoveWatermark={handleRemoveVidsWatermark}
                onStartDrag={handleStartDragNode}
                onStartConnect={handleStartConnect}
                onEndConnect={handleEndConnect}
                onRunNode={(nodeId) => {
                  const plannedAccountId = geminiAccountAssignments.get(nodeId)?.accountId;
                  return handleRunModelNode(nodeId, plannedAccountId);
                }}
                onAddImageInput={handleAddImageInput}
                onRemoveLastImageInput={handleRemoveLastImageInput}
                onAddVideoInput={handleAddVideoInput}
                onRemoveLastVideoInput={handleRemoveLastVideoInput}
                onToast={(msg) => setStatusMessage(msg)}
                onOpenFullPreview={(url, title, model) =>
                  setFullPreviewModal({ isOpen: true, url, title, model })
                }
                onOpenMarkup={handleOpenMarkup}
                onSpawnSceneNodes={handleSpawnSceneNodes}
                onResetStoryboard={handleResetStoryboard}
                hideAiWorkerRunButton={hideAiWorkerRunButton}
                hasConnectedAiWorker={storyboardWorkerNodes.length > 0}
                productAnalysisStatus={productAnalysisStatus}
                connectedPrompt={
                  node.type === 'storyboard' || node.type === 'anyLLM' || node.type === 'promptEnhancer'
                    ? resolveEnhancerInputs(node.id, recipe.nodes, recipe.edges).prompt
                    : resolvedModel?.prompt
                }
                connectedVoiceover={resolvedModel?.voiceover}
                connectedShoots={resolvedModel?.shoots}
                connectedSceneNumber={resolvedModel?.sceneNumber}
                connectedSceneTitle={resolvedModel?.sceneTitle}
                isExecuting={executingNodeIds.includes(node.id) || (isExecuting && executingNodeId === node.id)}
              />
            </div>
          );
        })}

        {/* Marquee Selection Box (rendered in canvas coordinates) */}
        {marqueeBox && (
          <div
            className="absolute border border-stone-400/60 dark:border-white/30 bg-stone-500/10 dark:bg-white/5 rounded-sm pointer-events-none z-30"
            style={{
              left: `${Math.min(marqueeBox.startX, marqueeBox.currentX)}px`,
              top: `${Math.min(marqueeBox.startY, marqueeBox.currentY)}px`,
              width: `${Math.abs(marqueeBox.currentX - marqueeBox.startX)}px`,
              height: `${Math.abs(marqueeBox.currentY - marqueeBox.startY)}px`,
            }}
          />
        )}
      </div>

      {/* Fullscreen Popup Preview Modal */}
      <CanvasPreviewModal
        isOpen={fullPreviewModal.isOpen}
        onClose={() => setFullPreviewModal({ isOpen: false, url: '' })}
        mediaUrl={fullPreviewModal.url}
        title={fullPreviewModal.title}
        model={fullPreviewModal.model}
        onToast={(msg) => setStatusMessage(msg)}
      />

      {/* Canvas Drawing / Markup Annotation Modal */}
      <CanvasMarkupModal
        isOpen={markupModal.isOpen}
        onClose={() => setMarkupModal((prev) => ({ ...prev, isOpen: false }))}
        imageUrl={markupModal.imageUrl}
        sourceNodeTitle={markupModal.sourceNodeTitle}
        onSaveMarkup={handleSaveMarkup}
        onToast={(msg) => setStatusMessage(msg)}
      />

      {/* Import Modal */}
      <ImportWeavyModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={(newRecipe) => {
          setRecipe(newRecipe);
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
          setPan({ x: 40, y: 40 });
          setZoom(1);
          setStatusMessage(`Berhasil mengimpor recipe "${newRecipe.name}"!`);
        }}
        weavyToken={weavyToken}
        refreshToken={refreshToken}
      />

      {/* Canvas Context Menu (Right Click to Add Node) */}
      <CanvasContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
        onSelectType={(type: CanvasNodeType) => {
          handleAddNode(type, contextMenu.canvasPosition);
          setContextMenu((prev) => ({ ...prev, isOpen: false }));
        }}
      />

    </div>

      {/* Side Inspector Panel (For Model, Video, Stitcher, LLM, and Storyboard nodes) */}
      {selectedNode && selectedNodeIds.length === 1 && (selectedNode.type === 'imageModel' || selectedNode.type === 'anyLLM' || selectedNode.type === 'promptEnhancer' || selectedNode.type === 'geminiVideo' || selectedNode.type === 'vidsVideo' || selectedNode.type === 'videoStitcher' || selectedNode.type === 'storyboard') && isInspectorOpen && (
        <CanvasInspectorPanel
          key={selectedNode.id}
          selectedNode={selectedNode}
          canvasNodes={recipe.nodes}
          geminiAccountAssignments={geminiAccountAssignments}
          onClose={() => setIsInspectorOpen(false)}
          onUpdateData={handleUpdateNodeData}
          onRunNode={(nodeId) => {
            const plannedAccountId = geminiAccountAssignments.get(nodeId)?.accountId;
            return handleRunModelNode(nodeId, plannedAccountId);
          }}
          onRemoveWatermark={handleRemoveVidsWatermark}
          onDeleteNode={handleDeleteNode}
          isExecuting={executingNodeIds.includes(selectedNode.id) || (isExecuting && executingNodeId === selectedNode.id)}
          executingProgress={executingProgress}
          credits={credits}
          hasConnectedInput={recipe.edges.some((edge) => edge.targetNodeId === selectedNode.id && recipe.nodes.some((node) => node.id === edge.sourceNodeId))}
          connectedPrompt={
            selectedNode.type === 'storyboard' || selectedNode.type === 'anyLLM' || selectedNode.type === 'promptEnhancer'
              ? resolveEnhancerInputs(selectedNode.id, recipe.nodes, recipe.edges).prompt
              : (selectedNode.type === 'geminiVideo' || selectedNode.type === 'vidsVideo' || selectedNode.type === 'imageModel')
              ? resolveModelInputs(selectedNode.id, recipe.nodes, recipe.edges).prompt
              : undefined
          }
          onOpenFullPreview={(url, title) =>
            setFullPreviewModal({ isOpen: true, url, title, model: title })
          }
        />
      )}
    </div>
  );
};