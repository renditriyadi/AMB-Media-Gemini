import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { GEMINI_MAX_CREDITS } from '../lib/provider';
import {
  ArrowLeft,
  ArrowDown,
  PanelLeft,
  Sun,
  Moon,
  Search,
  Sparkles,
  ArrowUp,
  Plus,
  ChevronDown,
  Copy,
  Check,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Trash2,
  Bot,
  User,
  Users,
  RefreshCw,
  Coins,
  ChevronRight,
  Workflow,
  BrainCircuit,
  MessageSquare,
  Maximize2,
  X,
  FileText,
  Download,
  Loader2,
  Crop,
  Undo2,
  Pencil,
  Pin,
  Image as ImageIcon,
  Video,
  Film,
  Clock,
  Flame,
  Play,
  AlertCircle,
  Zap,
} from "lucide-react";
import { ChatMessage, ChatSession, ChatAttachment } from "../types";
import {
  WEAVY_LLM_MODELS,
  WEAVY_IMAGE_MODELS,
  CHAT_PROVIDERS,
  GEMINI_LLM_MODELS,
  GEMINI_IMAGE_MODELS,
  GEMINI_VIDEO_MODELS,
} from "../types/canvas";
import {
  CleanMessageRenderer,
  cleanPlainText,
  hasStoryboardProject,
} from "./chat/CleanMessageRenderer";
import { WeavyActionCard, WeavyActionData } from "./chat/WeavyActionCard";
import { RepostMediaCard } from "./chat/RepostMediaCard";
import { ImageGenerationSpinner } from "./chat/ImageGenerationSpinner";
import { VideoGenerationSpinner } from "./chat/VideoGenerationSpinner";
import { postProcessWeavyResponse } from "../lib/weavyAgent/chatTurn";
import { extractStoryboardProjectFromData } from "./chat/ChatStoryboardCopilotCard";
import { resolveVideoProvider } from "./chat/videoProvider";
import { GeneratedVideoCard } from "./chat/GeneratedVideoCard";
import { ChatAttachmentCarousel } from "./chat/ChatAttachmentCarousel";
import { EmbeddedVideoPlayer } from "./chat/EmbeddedVideoPlayer";
import { exchangeRefreshTokenAndGetInfo } from "../lib/weavy";
import {
  acquireGeminiAccountLease,
  buildGeminiPayloadAccounts,
  syncGeminiAccountsToSheet,
  type GeminiAccountLease,
} from "../lib/geminiAccountManager";
import { executeGeminiVideoWithAutoSwitchAndRetry } from "../lib/geminiVideoRunner";
import { downloadMediaFile, uploadMediaWithProgress } from "../utils";
import {
  getAllChatSessionsFromIDB,
  saveChatSessionsToIDB,
  deleteChatSessionFromIDB,
} from "../lib/chatIndexedDb";
import { CanvasMarkupModal } from "./canvas/CanvasMarkupModal";
import {
  SessionImageItem,
  getAllSessionImages,
  getAllSessionVideos,
  detectImageRepostRequest,
  detectVideoRepostRequest,
  extractWeavyRepostFromMessage,
  SLASH_COMMANDS,
  SlashCommandPreset,
  expandSlashCommands,
  normalizeWeavyModelName,
  updateWeavyAccountCreditsInStorage,
  pollWeavyTaskStatus,
  extractWeavyActionFromMessage,
} from "./chat/chatUtils";
import { extensionBridge } from "../lib/extensionBridge";
import {
  detectEcommerceProductLinks,
  resolveLinksMetadata,
  formatScrapingContext,
  generateProductAnalysisFallback,
  filterValidImageObjects,
} from "../lib/ecommerceWorker";
import { ChatProductCard } from "./chat/ChatProductCard";

interface ChatViewProps {
  onBack?: () => void;
  onNavigateCanvas?: (promptText?: string, imageUrl?: string) => void;
  onNavigateGenerate?: (promptText?: string) => void;
  onNavigateStudio?: (project?: any) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: (e?: React.MouseEvent) => void;
  activeAccountId?: string;
  onSelectWeavyAccount?: (accountId: string) => void;
  onRefreshCredits?: (account: any) => void;
}

const STORAGE_KEY = "amb_chat_sessions_v1";
const ACTIVE_SESSION_KEY = "amb_active_chat_session_id";

const MODEL_SPEED_BADGES: Record<string, { label: string; color: string }> = {
  "anthropic/claude-sonnet-5": {
    label: "Sedang",
    color: "text-amber-400 bg-amber-500/10",
  },
  "anthropic/claude-opus-5": {
    label: "Deep",
    color: "text-purple-400 bg-purple-500/10",
  },
  "anthropic/claude-haiku-4-5": {
    label: "Cepat",
    color: "text-emerald-400 bg-emerald-500/10",
  },
  "google/gemini-3-pro": {
    label: "Deep",
    color: "text-blue-400 bg-blue-500/10",
  },
  "google/gemini-3.6-flash": {
    label: "Cepat",
    color: "text-cyan-400 bg-cyan-500/10",
  },
  "google/gemini-3.5-flash-lite": {
    label: "Kilat",
    color: "text-emerald-400 bg-emerald-500/10",
  },
  "openai/gpt-5.6-sol": {
    label: "Sedang",
    color: "text-emerald-400 bg-emerald-500/10",
  },
  "openai/gpt-4o": { label: "Cepat", color: "text-teal-400 bg-teal-500/10" },
  "meta-llama/llama-4-maverick": {
    label: "Sedang",
    color: "text-orange-400 bg-orange-500/10",
  },
  "gemini-3.6-flash": {
    label: "New",
    color: "text-emerald-400 bg-emerald-500/10",
  },
  "gemini-3.6-thinking": {
    label: "Thinking",
    color: "text-purple-400 bg-purple-500/10",
  },
  "gemini-3.1-pro": {
    label: "Pro",
    color: "text-blue-400 bg-blue-500/10",
  },
  "gemini-3.8-flash": {
    label: "Kilat",
    color: "text-cyan-400 bg-cyan-500/10",
  },
  "gemini-3.1-pro-preview": {
    label: "Deep",
    color: "text-blue-400 bg-blue-500/10",
  },
  "gemini-3.1-flash-lite": {
    label: "Ultra",
    color: "text-emerald-400 bg-emerald-500/10",
  },
  "gemini-2.5-flash": {
    label: "Cepat",
    color: "text-blue-400 bg-blue-500/10",
  },
  "gemini-2.5-pro": {
    label: "Deep",
    color: "text-purple-400 bg-purple-500/10",
  },
  "gemini-web-direct": {
    label: "Web RPC",
    color: "text-amber-400 bg-amber-500/10",
  },
};

export interface RunningHubVideoModelOption {
  id: string;
  name: string;
  workflowId: string;
  badge: string;
  description: string;
  durations: string[];
  defaultDuration: string;
  aspectRatios: string[];
  resolutions: string[];
  credits: number;
}

export const RUNNINGHUB_VIDEO_MODELS: RunningHubVideoModelOption[] = [
  {
    id: "MiniMax H3 Turbo Video",
    name: "MiniMax H3 Turbo Video",
    workflowId: "2098388825144184833",
    badge: "15s Tercepat",
    description: "Model video tercepat & sinematik (10-15s render) dengan gerak natural & visual fidelity tinggi.",
    durations: ["15s", "10s", "5s"],
    defaultDuration: "15s",
    aspectRatios: ["9:16", "16:9", "1:1", "4:3", "3:4"],
    resolutions: ["768p", "1080p"],
    credits: 15,
  },
  {
    id: "Wan 2.1 Video Pro",
    name: "Wan 2.1 Video Pro",
    workflowId: "2088843516532506626",
    badge: "Cinematic HD",
    description: "Generasi video sinematik dengan visual realistis tinggi dan pergerakan kamera stabil.",
    durations: ["5s", "10s"],
    defaultDuration: "5s",
    aspectRatios: ["9:16", "16:9", "1:1"],
    resolutions: ["720p", "1080p"],
    credits: 20,
  },
  {
    id: "S2 Motion Control",
    name: "S2 Motion Control",
    workflowId: "2091060763809492994",
    badge: "Motion Clone",
    description: "Kloning gerakan tubuh & ekspresi dari video referensi ke gambar karakter.",
    durations: ["5s", "10s"],
    defaultDuration: "5s",
    aspectRatios: ["9:16", "16:9"],
    resolutions: ["720p", "1080p"],
    credits: 25,
  },
];

export const RUNNINGHUB_ASPECT_RATIOS = [
  { label: "9:16", desc: "TikTok, Reels, Shorts", aspect: "9:16" },
  { label: "16:9", desc: "YouTube & Layar Lebar", aspect: "16:9" },
  { label: "1:1", desc: "Feed Instagram / Persegi", aspect: "1:1" },
  { label: "4:3", desc: "TV Klasik / Standar", aspect: "4:3" },
  { label: "3:4", desc: "Potret Vertikal", aspect: "3:4" },
];

export const RUNNINGHUB_DURATIONS = ["15s", "10s", "5s"];

export function getActiveRunningHubApiKey(): string {
  try {
    const directKey = localStorage.getItem("runninghub_api_key");
    if (directKey && directKey.trim()) return directKey.trim();
    const rawAccs = localStorage.getItem("runninghub_accounts");
    if (rawAccs) {
      const parsed = JSON.parse(rawAccs);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Find accounts with key and credits
        const validAccs = parsed.filter((a: any) => {
          const key = (a?.refreshToken || a?.accessToken || a?.idToken || a?.apiKey || '').trim();
          return key.length > 0 && a?.accountStatus !== 'error' && (a?.credits === undefined || a?.credits > 0);
        });

        const activeWithCredits = validAccs.find((a: any) => a.isActive || a.status === "active");
        if (activeWithCredits) {
          const key = (activeWithCredits.refreshToken || activeWithCredits.accessToken || activeWithCredits.idToken || activeWithCredits.apiKey || '').trim();
          if (key) return key;
        }

        if (validAccs.length > 0) {
          const key = (validAccs[0].refreshToken || validAccs[0].accessToken || validAccs[0].idToken || validAccs[0].apiKey || '').trim();
          if (key) return key;
        }

        // Fallback to any configured account
        const fallbackAcc = parsed.find((a: any) => {
          const key = (a?.refreshToken || a?.accessToken || a?.idToken || a?.apiKey || '').trim();
          return key.length > 0;
        });
        if (fallbackAcc) {
          const key = (fallbackAcc.refreshToken || fallbackAcc.accessToken || fallbackAcc.idToken || fallbackAcc.apiKey || '').trim();
          if (key) return key;
        }
      }
    }
  } catch (e) {}
  return "";
}

// Label grup tanggal untuk daftar riwayat di sidebar.
const getSessionGroupLabel = (sess: ChatSession, now: number): string => {
  if (sess.isPinned) return "Disematkan";
  const startOfDay = (d: Date) => new Date(d).setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (startOfDay(new Date(now)) -
      startOfDay(new Date(sess.updatedAt || sess.createdAt || 0))) /
      86400000
  );
  if (diffDays <= 0) return "Hari Ini";
  if (diffDays === 1) return "Kemarin";
  if (diffDays <= 7) return "7 Hari Terakhir";
  if (diffDays <= 30) return "30 Hari Terakhir";
  return "Lebih Lama";
};

// Storyboard terakhir yang sudah disepakati di percakapan ini (dari blok storyboard_project).
const findLatestStoryboardProject = (
  messages: Array<{ role: string; content?: string }>
): any | null => {
  for (let i = (messages?.length || 0) - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || m.role !== "assistant" || !m.content) continue;
    if (!m.content.includes("storyboard_project")) continue;
    try {
      const project = extractStoryboardProjectFromData(m.content, "");
      if (project && Array.isArray(project.scenes) && project.scenes.length > 0) {
        return project;
      }
    } catch {}
  }
  return null;
};

export const ChatView: React.FC<ChatViewProps> = ({
  onBack,
  onNavigateCanvas,
  onNavigateGenerate,
  onNavigateStudio,
  isDarkMode = true,
  onToggleDarkMode,
  activeAccountId,
  onSelectWeavyAccount,
  onRefreshCredits,
}) => {
  // Sessions State
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    const defaultSession: ChatSession = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: "Obrolan Baru",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      model: "google/gemini-3-pro",
      mode: "chat",
    };
    return [defaultSession];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (savedId) return savedId;
    } catch (e) {}
    return "";
  });

  const currentSession = useMemo(() => {
    return (
      sessions.find((s) => s.id === activeSessionId) ||
      sessions[0] || {
        id: `chat_${Date.now()}`,
        title: "Obrolan Baru",
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        model: "google/gemini-3-pro",
        mode: "chat" as const,
      }
    );
  }, [sessions, activeSessionId]);

  // Current inputs state
  const [inputText, setInputText] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [chatMode, setChatMode] = useState<"chat" | "image" | "video" | "cowork">(
    (currentSession?.mode as any) === "image"
      ? "image"
      : (currentSession?.mode as any) === "video"
        ? "video"
        : "chat",
  );
  const [selectedModel, setSelectedModel] = useState<string>(
    currentSession?.model || "google/gemini-3-pro",
  );
  const [selectedImageModel, setSelectedImageModel] = useState<string>(
    "fal-ai/nano-banana-pro/edit",
  );
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>("9:16");
  const [isRatioDropdownOpen, setIsRatioDropdownOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  // Video Mode State (RunningHub / Google Gemini)
  const [selectedVideoModel, setSelectedVideoModel] = useState<string>(() => {
    try {
      const savedProv = localStorage.getItem("amb_chat_selected_provider");
      if (savedProv === "gemini") return "gemini-omni-1.1-flash";
    } catch (e) {}
    return "MiniMax H3 Turbo Video";
  });
  const [selectedVideoAspect, setSelectedVideoAspect] = useState<string>("9:16");
  const [selectedVideoDuration, setSelectedVideoDuration] = useState<string>(() => {
    try {
      const savedProv = localStorage.getItem("amb_chat_selected_provider");
      if (savedProv === "gemini") return "10s";
    } catch (e) {}
    return "15s";
  });
  const [selectedVideoResolution, setSelectedVideoResolution] = useState<string>("768p");
  const [isVideoRatioDropdownOpen, setIsVideoRatioDropdownOpen] = useState(false);
  const [isVideoDurationDropdownOpen, setIsVideoDurationDropdownOpen] = useState(false);
  const [isVideoModelDropdownOpen, setIsVideoModelDropdownOpen] = useState(false);
  const videoRatioDropdownRef = useRef<HTMLDivElement | null>(null);
  const videoDurationDropdownRef = useRef<HTMLDivElement | null>(null);
  const videoModelDropdownRef = useRef<HTMLDivElement | null>(null);

  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);
  const [selectedChatProvider, setSelectedChatProvider] = useState<"weavy" | "gemini">(() => {
    try {
      const saved = localStorage.getItem("amb_chat_selected_provider");
      if (saved === "gemini" || saved === "weavy") return saved;
    } catch (e) {}
    return "weavy";
  });
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const providerDropdownRef = useRef<HTMLDivElement | null>(null);

  const handleSelectProvider = (provId: "weavy" | "gemini") => {
    setSelectedChatProvider(provId);
    setIsProviderDropdownOpen(false);
    try {
      localStorage.setItem("amb_chat_selected_provider", provId);
    } catch (e) {}
    if (provId === "gemini") {
      const isGeminiModel = GEMINI_LLM_MODELS.some((m) => m.id === selectedModel);
      if (!isGeminiModel) {
        setSelectedModel("gemini-3.6-flash");
      }
      setSelectedImageModel("imagen-3.0-generate-002");
      setSelectedVideoModel("gemini-omni-1.1-flash");
      setSelectedVideoDuration("10s");
      try {
        const savedGeminiId = localStorage.getItem("gemini_active_account_id");
        if (savedGeminiId && geminiAccountsList.some((a: any) => a.id === savedGeminiId)) {
          setSelectedAccountId(savedGeminiId);
        } else if (geminiAccountsList.length > 0) {
          const activeG = geminiAccountsList.find((a: any) => a.isActive);
          setSelectedAccountId(activeG ? activeG.id : geminiAccountsList[0].id);
        }
      } catch (e) {}
    } else {
      const isWeavyModel = WEAVY_LLM_MODELS.some((m) => m.id === selectedModel);
      if (!isWeavyModel) {
        setSelectedModel("google/gemini-3-pro");
      }
      setSelectedImageModel("fal-ai/nano-banana-pro/edit");
      setSelectedVideoModel("MiniMax H3 Turbo Video");
      try {
        const savedWeavyId = localStorage.getItem("weavy_active_account_id");
        if (savedWeavyId && weavyAccountsList.some((a: any) => a.id === savedWeavyId)) {
          setSelectedAccountId(savedWeavyId);
        } else if (weavyAccountsList.length > 0) {
          const activeW = weavyAccountsList.find((a: any) => a.isActive);
          setSelectedAccountId(activeW ? activeW.id : weavyAccountsList[0].id);
        }
      } catch (e) {}
    }
  };

  const [isQuickPresetEnabled, setIsQuickPresetEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("chat_quick_preset_enabled");
      return saved !== "false";
    } catch (e) {
      return true;
    }
  });

  // Storyboard Copilot mode - toggle global persisten (parity dgn ekstensi:
  // storage key `weavy_chat_storyboard_copilot_enabled`).
  const [isStoryboardCopilotEnabled, setIsStoryboardCopilotEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem("weavy_chat_storyboard_copilot_enabled") === "true";
    } catch (e) {
      return false;
    }
  });

  const toggleStoryboardCopilot = () => {
    setIsStoryboardCopilotEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("weavy_chat_storyboard_copilot_enabled", String(next));
      } catch (e) {}
      return next;
    });
  };
  // Per-session loading tracking so background requests never leak to new or other sessions
  const [loadingSessionIds, setLoadingSessionIds] = useState<Record<string, boolean>>({});
  const isCurrentSessionLoading = Boolean(
    currentSession?.id && loadingSessionIds[currentSession.id],
  );
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [expandedThinking, setExpandedThinking] = useState<
    Record<string, boolean>
  >({});
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [previewPan, setPreviewPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Reset zoom and pan when preview modal opens or changes
  const handleOpenPreviewModal = useCallback((url: string) => {
    setPreviewImageUrl(url);
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
  }, []);

  const handleClosePreviewModal = useCallback(() => {
    setPreviewImageUrl(null);
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
  }, []);

  const handleZoomIn = useCallback(() => {
    setPreviewZoom((prev) => Math.min(5, Math.round((prev + 0.25) * 100) / 100));
  }, []);

  const handleZoomOut = useCallback(() => {
    setPreviewZoom((prev) => {
      const next = Math.max(0.5, Math.round((prev - 0.25) * 100) / 100);
      if (next <= 1) setPreviewPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
  }, []);

  const handlePreviewWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setPreviewZoom((prev) => {
      const next = Math.max(0.5, Math.min(5, Math.round((prev + delta) * 100) / 100));
      if (next <= 1) setPreviewPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handlePreviewMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX - previewPan.x,
      y: e.clientY - previewPan.y,
    };
  }, [previewPan]);

  const handlePreviewMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPreviewPan({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y,
    });
  }, [isPanning]);

  const handlePreviewMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Collect all existing images in the current session up to this point
  const existingSessionImages = useMemo(() => {
    return getAllSessionImages(currentSession.messages);
  }, [currentSession.messages]);

  // Collect all existing videos in the current session up to this point
  const existingSessionVideos = useMemo(() => {
    return getAllSessionVideos(currentSession.messages);
  }, [currentSession.messages]);

  const totalSessionImagesCount = existingSessionImages.length;

  // Filter all image attachments currently present in input
  const imageAttachments = useMemo(() => {
    return attachments.filter(
      (att) => att.type === "image" || Boolean(att.url?.trim()) || Boolean(att.base64?.trim())
    );
  }, [attachments]);

  // @ Mention State & Matching
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  // Active @mention match based on current inputText
  const mentionMatch = useMemo(() => {
    // 1. Build full catalog of all available image and video references in this session:
    // (A) Existing images from past messages in this session
    const existingItems = existingSessionImages.map((img) => ({
      tag: `@img${img.index}`,
      index: img.index,
      name: img.prompt || img.label || `Gambar ${img.index}`,
      previewUrl: img.url || "",
      isExisting: true,
      isVideo: false,
      source: img.model ? `Hasil: ${img.model}` : `Riwayat Sesi #${img.index}`,
      attachment: undefined as ChatAttachment | undefined,
    }));

    // (B) Existing videos from past messages in this session
    const existingVideoItems = existingSessionVideos.map((vid) => ({
      tag: vid.tag || `@vid${vid.index}`,
      index: vid.index,
      name: vid.title || `Video ${vid.index}`,
      previewUrl: vid.coverUrl || vid.url || "",
      isExisting: true,
      isVideo: true,
      source: `Video Sesi #${vid.index} (${vid.author || "RunningHub / Embed"})`,
      attachment: undefined as ChatAttachment | undefined,
    }));

    // (C) Pending video attachments currently in input bar
    const pendingVideoItems = attachments
      .filter((att) => att.type === "video" || Boolean(att.playbackUrl) || Boolean(att.url?.match(/\.(mp4|webm|mov|mkv)$/i)))
      .map((att, idx) => {
        const assignedIndex = existingSessionVideos.length + idx + 1;
        return {
          tag: `@vid${assignedIndex}`,
          index: assignedIndex,
          name: att.name || `Video ${assignedIndex}`,
          previewUrl: att.coverUrl || att.playbackUrl || att.url || "",
          isExisting: false,
          isVideo: true,
          source: `Lampiran Video Baru (#${assignedIndex})`,
          attachment: att,
        };
      });

    // (D) Pending image attachments currently in input bar
    const pendingItems = imageAttachments.map((att, idx) => {
      const assignedIndex = totalSessionImagesCount + idx + 1;
      return {
        tag: `@img${assignedIndex}`,
        index: assignedIndex,
        name: att.name || `Gambar ${assignedIndex}`,
        previewUrl: (att.url && att.url.trim()) || (att.base64 && att.base64.trim()) || "",
        isExisting: false,
        isVideo: false,
        source: `Lampiran Baru (#${assignedIndex})`,
        attachment: att,
      };
    });

    const allItems = [...existingVideoItems, ...pendingVideoItems, ...existingItems, ...pendingItems];
    if (allItems.length === 0) return null;

    // Check if user is typing an @mention at the end or around current word
    // Matches @ or @query (e.g. @img, @1, @2, @foto, @gambar)
    const match = inputText.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
    if (!match) return null;

    const query = match[1].toLowerCase();
    const atIndex = inputText.length - match[1].length - 1;

    const filtered = allItems.filter((item) => {
      if (!query) return true;
      return (
        item.tag.toLowerCase().includes(`@${query}`) ||
        item.tag.toLowerCase().includes(query) ||
        String(item.index).includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.source.toLowerCase().includes(query)
      );
    });

    return {
      query,
      atIndex,
      filtered,
      totalCount: allItems.length,
    };
  }, [inputText, existingSessionVideos, existingSessionImages, attachments, imageAttachments, totalSessionImagesCount]);

  const showMentionMenu = Boolean(mentionMatch && mentionMatch.filtered.length > 0);

  const applyImageMention = (tag: string) => {
    if (!mentionMatch) return;
    const textBeforeAt = inputText.slice(0, mentionMatch.atIndex);
    const newText = `${textBeforeAt}${tag} `;
    setInputText(newText);
    setSelectedMentionIndex(0);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Slash Command Menu state
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);

  // Filtered slash commands based on current inputText
  const filteredSlashCommands = useMemo(() => {
    const trimmed = inputText.trim();
    if (!trimmed.startsWith("/")) return [];
    const query = trimmed.toLowerCase();
    return SLASH_COMMANDS.filter(
      (cmd) =>
        cmd.command.toLowerCase().includes(query) ||
        cmd.name.toLowerCase().includes(query) ||
        cmd.badge.toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query)
    );
  }, [inputText]);

  const showSlashMenu = Boolean(
    inputText.startsWith("/") &&
    !inputText.includes("\n") &&
    !inputText.includes(" ") &&
    filteredSlashCommands.length > 0
  );

  const applySlashCommand = (preset: SlashCommandPreset) => {
    setInputText(preset.command + " ");
    if (preset.recommendedAspect) {
      setSelectedAspectRatio(preset.recommendedAspect);
    }
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };
  const [markupModal, setMarkupModal] = useState<{
    isOpen: boolean;
    imageUrl: string;
    sourceTitle: string;
    attachmentId?: string;
  }>({
    isOpen: false,
    imageUrl: "",
    sourceTitle: "Obrolan Chat",
  });

  const handleOpenMarkup = useCallback(
    (imageUrl: string, sourceTitle = "Gambar Chat", attachmentId?: string) => {
      setMarkupModal({
        isOpen: true,
        imageUrl,
        sourceTitle,
        attachmentId,
      });
    },
    [],
  );

  const [isHistorySidebarOpen, setIsHistorySidebarOpen] = useState(() => {
    return typeof window !== "undefined" ? window.innerWidth >= 1024 : true;
  });
  const [searchSessionQuery, setSearchSessionQuery] = useState("");

  // Accounts and Credit Management (Adaptive by selectedChatProvider: Weavy or Gemini)
  const [weavyAccountsList, setWeavyAccountsList] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem("weavy_accounts");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [geminiAccountsList, setGeminiAccountsList] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem("gemini_accounts");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    if (activeAccountId) return activeAccountId;
    try {
      const isGemini = (localStorage.getItem("amb_chat_selected_provider") || "weavy") === "gemini";
      const storageKey = isGemini ? "gemini_accounts" : "weavy_accounts";
      const activeKey = isGemini ? "gemini_active_account_id" : "weavy_active_account_id";
      const savedActiveId = localStorage.getItem(activeKey);
      if (savedActiveId) return savedActiveId;
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const active = parsed.find((a: any) => a.isActive);
          return active ? active.id : parsed[0].id;
        }
      }
    } catch (e) {}
    return "";
  });

  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"accounts" | "history">("history");
  const [accountSearchQuery, setAccountSearchQuery] = useState("");

  // Active Weavy Account
  const currentWeavyAccount = useMemo(() => {
    if (selectedAccountId) {
      const found = weavyAccountsList.find(
        (a: any) => a.id === selectedAccountId && (!a.accountStatus || a.accountStatus === 'active')
      );
      if (found) return found;
    }
    try {
      const savedActiveId = localStorage.getItem('weavy_active_account_id');
      if (savedActiveId) {
        const found = weavyAccountsList.find((a: any) => a.id === savedActiveId && (!a.accountStatus || a.accountStatus === 'active'));
        if (found) return found;
      }
    } catch (e) {}
    const active = weavyAccountsList.find((a: any) => a.isActive && (!a.accountStatus || a.accountStatus === 'active'));
    if (active) return active;
    const firstAlive = weavyAccountsList.find((a: any) => !a.accountStatus || a.accountStatus === 'active');
    return firstAlive || weavyAccountsList[0] || null;
  }, [weavyAccountsList, selectedAccountId]);

  // Active Gemini Account
  const currentGeminiAccount = useMemo(() => {
    if (selectedAccountId) {
      const found = geminiAccountsList.find((a: any) => a.id === selectedAccountId && (!a.accountStatus || a.accountStatus === 'active'));
      if (found) return found;
    }
    try {
      const savedActiveId = localStorage.getItem('gemini_active_account_id');
      if (savedActiveId) {
        const found = geminiAccountsList.find((a: any) => a.id === savedActiveId && (!a.accountStatus || a.accountStatus === 'active'));
        if (found) return found;
      }
    } catch (e) {}
    const active = geminiAccountsList.find((a: any) => a.isActive && (!a.accountStatus || a.accountStatus === 'active'));
    if (active) {
      return active;
    }
    const firstAlive = geminiAccountsList.find((a: any) => !a.accountStatus || a.accountStatus === 'active');
    return firstAlive || geminiAccountsList[0] || null;
  }, [geminiAccountsList, selectedAccountId]);

  // Unified Current Active Account based on selected provider
  const currentActiveAccount = useMemo(() => {
    return selectedChatProvider === "gemini" ? currentGeminiAccount : currentWeavyAccount;
  }, [selectedChatProvider, currentGeminiAccount, currentWeavyAccount]);

  // Active accounts list for the current provider
  const activeAccountsList = useMemo(() => {
    return selectedChatProvider === "gemini" ? geminiAccountsList : weavyAccountsList;
  }, [selectedChatProvider, geminiAccountsList, weavyAccountsList]);

  // Total credits across active provider accounts
  const totalAggregatedCredits = useMemo(() => {
    if (selectedChatProvider === "gemini") {
      return geminiAccountsList.reduce((acc, curr) => {
        return acc + (typeof curr.credits === "number" ? curr.credits : 0);
      }, 0);
    }
    return weavyAccountsList.reduce((acc, curr) => {
      return acc + (typeof curr.credits === "number" ? curr.credits : 0);
    }, 0);
  }, [selectedChatProvider, geminiAccountsList, weavyAccountsList]);

  // Filtered Accounts for sidebar based on search query
  const filteredAccounts = useMemo(() => {
    const sourceList = selectedChatProvider === "gemini" ? geminiAccountsList : weavyAccountsList;
    if (!accountSearchQuery.trim()) return sourceList;
    const q = accountSearchQuery.toLowerCase();
    return sourceList.filter((a: any) => {
      const nameMatch = a.name && a.name.toLowerCase().includes(q);
      const emailMatch = a.email && a.email.toLowerCase().includes(q);
      const dispMatch = a.displayName && a.displayName.toLowerCase().includes(q);
      return nameMatch || emailMatch || dispMatch;
    });
  }, [selectedChatProvider, geminiAccountsList, weavyAccountsList, accountSearchQuery]);

  // Keep selectedAccountId synced if activeAccountId prop changes
  useEffect(() => {
    if (activeAccountId) {
      setSelectedAccountId(activeAccountId);
    }
  }, [activeAccountId]);

  // Real-time synchronization across tabs and Canvas
  useEffect(() => {
    const handleAccountsUpdated = () => {
      try {
        const rawW = localStorage.getItem("weavy_accounts");
        if (rawW) {
          const accs = JSON.parse(rawW);
          if (Array.isArray(accs)) {
            setWeavyAccountsList(accs);
          }
        }
        const rawG = localStorage.getItem("gemini_accounts");
        if (rawG) {
          const accsG = JSON.parse(rawG);
          if (Array.isArray(accsG)) {
            setGeminiAccountsList(accsG);
          }
        }
      } catch (e) {}
    };

    window.addEventListener("weavy_accounts_updated", handleAccountsUpdated);
    window.addEventListener("gemini_accounts_updated", handleAccountsUpdated);
    window.addEventListener("accounts-updated", handleAccountsUpdated);
    window.addEventListener("storage", handleAccountsUpdated);
    return () => {
      window.removeEventListener("weavy_accounts_updated", handleAccountsUpdated);
      window.removeEventListener("gemini_accounts_updated", handleAccountsUpdated);
      window.removeEventListener("accounts-updated", handleAccountsUpdated);
      window.removeEventListener("storage", handleAccountsUpdated);
    };
  }, []);

  // Handler: Switch active account for the current provider
  const handleSwitchAccount = useCallback(
    (accId: string) => {
      const isGemini = selectedChatProvider === "gemini";
      const storageKey = isGemini ? "gemini_accounts" : "weavy_accounts";
      const activeKey = isGemini ? "gemini_active_account_id" : "weavy_active_account_id";
      const eventName = isGemini ? "gemini_accounts_updated" : "weavy_accounts_updated";

      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const accounts = JSON.parse(raw);
        if (!Array.isArray(accounts)) return;

        const target = accounts.find((a: any) => a.id === accId);
        if (target && target.accountStatus && target.accountStatus !== 'active') {
          alert(`Akun "${target.displayName || target.name || target.email}" berstatus FAILED / EXPIRED dan tidak dapat diaktifkan.`);
          return;
        }

        const updated = accounts.map((a: any) => ({
          ...a,
          isActive: a.id === accId,
        }));

        localStorage.setItem(storageKey, JSON.stringify(updated));
        localStorage.setItem(activeKey, accId);
        setSelectedAccountId(accId);

        if (isGemini) {
          setGeminiAccountsList(updated);
        } else {
          setWeavyAccountsList(updated);
          if (onSelectWeavyAccount) {
            onSelectWeavyAccount(accId);
          }
        }
        window.dispatchEvent(new Event(eventName));
        window.dispatchEvent(new Event("accounts-updated"));
      } catch (e) {
        console.warn("Error selecting active account:", e);
      }
    },
    [selectedChatProvider, onSelectWeavyAccount],
  );

  // Handler: Sync credits for a specific account via verify/sync-daily endpoint
  const handleSyncAccountCredits = useCallback(
    async (account: any, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      if (!account) return;
      setSyncingAccountId(account.id);
      try {
        if (selectedChatProvider === "gemini") {
          const tokenToSend = (account.token || account.refreshToken || account.apiKey || account.cookies || '').trim();
          const resp = await fetch("/api/gemini/accounts/sync-daily", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: tokenToSend,
              email: account.email,
              id: account.id,
              name: account.displayName || account.name,
              cookies: account.cookies || (tokenToSend.includes('__Secure') || tokenToSend.includes('SID=') ? tokenToSend : undefined),
              apiKey: account.apiKey || (tokenToSend.startsWith('AIza') ? tokenToSend : undefined),
            }),
          });
          const data = await resp.json().catch(() => ({}));
          if (resp.ok && data.success && data.accountStatus !== 'expired') {
            const raw = localStorage.getItem("gemini_accounts");
            if (raw) {
              const accs = JSON.parse(raw);
              if (Array.isArray(accs)) {
                const hasKnownLedger = data.ledgerKnown === true;
                const serverCredits = typeof data.remainingCredits === 'number' ? data.remainingCredits : data.credits;
                const resolvedCredits = hasKnownLedger && typeof serverCredits === 'number'
                  ? Math.min(GEMINI_MAX_CREDITS, Math.max(0, serverCredits))
                  : (typeof account.credits === 'number' ? account.credits : 0);
                const updated = accs.map((a: any) =>
                  a.id === account.id
                    ? {
                        ...a,
                        email: data.email || a.email,
                        name: data.displayName || data.name || a.name,
                        displayName: data.displayName || a.displayName,
                        credits: resolvedCredits,
                        totalCredits: GEMINI_MAX_CREDITS,
                        creditsUsed: hasKnownLedger && typeof data.used === 'number'
                          ? data.used
                          : hasKnownLedger && typeof data.usedTotal === 'number'
                          ? data.usedTotal
                          : hasKnownLedger && typeof data.usedToday === 'number'
                            ? data.usedToday
                            : a.creditsUsed,
                        creditSyncStatus: hasKnownLedger ? 'synced' : 'unknown',
                        accountStatus: 'active',
                        statusMessage: undefined,
                      }
                    : a
                );
                localStorage.setItem("gemini_accounts", JSON.stringify(updated));
                setGeminiAccountsList(updated);
                void syncGeminiAccountsToSheet(updated);
                window.dispatchEvent(new Event("gemini_accounts_updated"));
                window.dispatchEvent(new Event("accounts-updated"));
              }
            }
          } else {
            const raw = localStorage.getItem("gemini_accounts");
            if (raw) {
              const accs = JSON.parse(raw);
              if (Array.isArray(accs)) {
                const updated = accs.map((a: any) =>
                  a.id === account.id
                    ? {
                        ...a,
                        credits: 0,
                        isActive: false,
                        accountStatus: 'expired',
                        statusMessage: 'EXPIRED',
                      }
                    : a
                );
                localStorage.setItem("gemini_accounts", JSON.stringify(updated));
                setGeminiAccountsList(updated);
                void syncGeminiAccountsToSheet(updated);
                window.dispatchEvent(new Event("gemini_accounts_updated"));
                window.dispatchEvent(new Event("accounts-updated"));
              }
            }
          }
        } else {
          if (!account.refreshToken) return;
          const info = await exchangeRefreshTokenAndGetInfo(account.refreshToken, account.email);
          if (typeof info.credits === "number") {
            const updated = updateWeavyAccountCreditsInStorage(
              { id: account.id, email: account.email },
              info.credits,
              {
                totalCredits:
                  typeof info.totalCredits === "number"
                    ? info.totalCredits
                    : account.totalCredits,
                idToken: info.idToken || account.idToken,
                refreshToken: info.refreshToken || account.refreshToken,
              },
            );
            if (updated.length > 0) {
              setWeavyAccountsList(updated);
              if (onRefreshCredits) {
                onRefreshCredits(account);
              }
            }
          }
        }
      } catch (err) {
        console.warn("Error syncing credits for account in Chat:", err);
      } finally {
        setSyncingAccountId(null);
      }
    },
    [selectedChatProvider, onRefreshCredits],
  );

  // Handler: Sync all accounts credits
  const handleSyncAllAccounts = useCallback(async () => {
    setSyncingAccountId("ALL");
    try {
      if (selectedChatProvider === "gemini") {
        const raw = localStorage.getItem("gemini_accounts");
        if (!raw) return;
        const accounts = JSON.parse(raw);
        if (!Array.isArray(accounts)) return;

        const updated = [...accounts];
        for (let i = 0; i < updated.length; i++) {
          const t = (updated[i].refreshToken || updated[i].token || updated[i].apiKey || updated[i].cookies || '').trim();
          if (t) {
            try {
              const resp = await fetch("/api/gemini/accounts/sync-daily", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  token: t,
                  email: updated[i].email,
                  id: updated[i].id,
                  name: updated[i].displayName || updated[i].name,
                  cookies: updated[i].cookies || (t.includes('__Secure') || t.includes('SID=') ? t : undefined),
                  apiKey: updated[i].apiKey || (t.startsWith('AIza') ? t : undefined),
                }),
              });
              const data = await resp.json().catch(() => ({}));
              if (resp.ok && data.success && data.accountStatus !== 'expired') {
                const hasKnownLedger = data.ledgerKnown === true;
                const serverCredits = typeof data.remainingCredits === 'number' ? data.remainingCredits : data.credits;
                const resolvedCredits = hasKnownLedger && typeof serverCredits === 'number'
                  ? Math.min(GEMINI_MAX_CREDITS, Math.max(0, serverCredits))
                  : (typeof updated[i].credits === 'number' ? updated[i].credits : 0);
                updated[i] = {
                  ...updated[i],
                  email: data.email || updated[i].email,
                  name: data.displayName || data.name || updated[i].name,
                  displayName: data.displayName || updated[i].displayName,
                  credits: resolvedCredits,
                  totalCredits: GEMINI_MAX_CREDITS,
                  creditsUsed: hasKnownLedger && typeof data.used === 'number'
                    ? data.used
                    : hasKnownLedger && typeof data.usedTotal === 'number'
                      ? data.usedTotal
                      : updated[i].creditsUsed,
                  creditSyncStatus: hasKnownLedger ? 'synced' : 'unknown',
                  accountStatus: 'active',
                  statusMessage: undefined,
                };
              } else {
                updated[i] = {
                  ...updated[i],
                  credits: 0,
                  isActive: false,
                  accountStatus: 'expired',
                  statusMessage: 'EXPIRED',
                };
              }
            } catch (e) {}
          }
        }
        localStorage.setItem("gemini_accounts", JSON.stringify(updated));
        setGeminiAccountsList(updated);
        window.dispatchEvent(new Event("gemini_accounts_updated"));
        window.dispatchEvent(new Event("accounts-updated"));
      } else {
        const raw = localStorage.getItem("weavy_accounts");
        if (!raw) return;
        const accounts = JSON.parse(raw);
        if (!Array.isArray(accounts)) return;

        const updated = [...accounts];
        for (let i = 0; i < updated.length; i++) {
          if (updated[i].refreshToken) {
            try {
              const info = await exchangeRefreshTokenAndGetInfo(
                updated[i].refreshToken,
                updated[i].email,
              );
              if (typeof info.credits === "number") {
                updated[i] = {
                  ...updated[i],
                  credits: info.credits,
                  totalCredits:
                    typeof info.totalCredits === "number"
                      ? info.totalCredits
                      : updated[i].totalCredits,
                  idToken: info.idToken || updated[i].idToken,
                  refreshToken: info.refreshToken || updated[i].refreshToken,
                };
              }
            } catch (e) {}
          }
        }

        localStorage.setItem("weavy_accounts", JSON.stringify(updated));
        setWeavyAccountsList(updated);
        window.dispatchEvent(new Event("weavy_accounts_updated"));
        window.dispatchEvent(new Event("accounts-updated"));
      }
    } catch (e) {
      console.warn("Error syncing all accounts in Chat:", e);
    } finally {
      setSyncingAccountId(null);
    }
  }, [selectedChatProvider]);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  const filteredSessions = useMemo(() => {
    const list = sessions.filter((s) => {
      if (!searchSessionQuery.trim()) return true;
      const q = searchSessionQuery.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.messages.some((m) => m.content.toLowerCase().includes(q))
      );
    });
    return [...list].sort((a, b) => {
      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
        return a.isPinned ? -1 : 1;
      }
      return (
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime()
      );
    });
  }, [sessions, searchSessionQuery]);

  // Kelompokkan hasil (sudah terurut: sematan dulu, lalu terbaru) per label tanggal
  const groupedSessions = useMemo(() => {
    const now = Date.now();
    const groups: { label: string; items: ChatSession[] }[] = [];
    for (const sess of filteredSessions) {
      const label = getSessionGroupLabel(sess, now);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(sess);
      else groups.push({ label, items: [sess] });
    }
    return groups;
  }, [filteredSessions]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const ratioDropdownRef = useRef<HTMLDivElement | null>(null);
  const presetDropdownRef = useRef<HTMLDivElement | null>(null);

  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const handleChatScroll = useCallback(() => {
    if (!chatScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distanceFromBottom > 120);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior,
      });
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
    setShowScrollBottom(false);
  }, []);

  // Helper to sanitize sessions before saving to localStorage to prevent QuotaExceededError
  const sanitizeSessionsForLocalStorage = (list: ChatSession[]): ChatSession[] => {
    return list.map((s) => ({
      ...s,
      messages: (s.messages || []).map((m) => ({
        ...m,
        attachments: (m.attachments || []).map((att) => ({
          ...att,
          // Strip massive base64 strings so localStorage never exceeds quota
          base64: typeof att.base64 === "string" && att.base64.length > 1024 ? "" : att.base64,
          url: typeof att.url === "string" && att.url.startsWith("data:") && att.url.length > 1024 ? "" : att.url,
        })),
      })),
    }));
  };

  // Hydrate chat sessions from IndexedDB and Server on initial load
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        // 1. Try loading from IndexedDB first (contains full uncompressed history)
        const idbSessions = await getAllChatSessionsFromIDB();
        if (idbSessions && idbSessions.length > 0 && isMounted) {
          setSessions((prev) => {
            if (prev.length === 1 && prev[0].messages.length === 0 && prev[0].title === "Obrolan Baru") {
              return idbSessions;
            }
            const sessionMap = new Map<string, ChatSession>();
            idbSessions.forEach((s) => sessionMap.set(s.id, s));
            prev.forEach((s) => sessionMap.set(s.id, s));
            const merged = Array.from(sessionMap.values());
            merged.sort(
              (a, b) =>
                new Date(b.updatedAt || b.createdAt || 0).getTime() -
                new Date(a.updatedAt || a.createdAt || 0).getTime(),
            );
            return merged;
          });
        }

        // 2. Also fetch from server /api/chat-sessions (backup in case browser storage was cleared or server restarted)
        const srvRes = await fetch("/api/chat-sessions");
        if (srvRes.ok) {
          const data = await srvRes.json();
          if (data.success && Array.isArray(data.sessions) && data.sessions.length > 0 && isMounted) {
            setSessions((prev) => {
              const sessionMap = new Map<string, ChatSession>();
              data.sessions.forEach((s: ChatSession) => sessionMap.set(s.id, s));
              prev.forEach((s: ChatSession) => sessionMap.set(s.id, s));
              const merged = Array.from(sessionMap.values());
              merged.sort(
                (a, b) =>
                  new Date(b.updatedAt || b.createdAt || 0).getTime() -
                  new Date(a.updatedAt || a.createdAt || 0).getTime(),
              );
              return merged;
            });
          }
        }
      } catch (err) {
        console.warn("[ChatView] Hydration error:", err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Always keep activeSessionId pointing to a real session in sessions
  useEffect(() => {
    if (sessions && sessions.length > 0) {
      const exists = sessions.some((s) => s.id === activeSessionId);
      if (!exists) {
        setActiveSessionId(sessions[0].id);
      }
    }
  }, [sessions, activeSessionId]);

  // Sync sessions to localStorage, IndexedDB, and Server
  useEffect(() => {
    if (!sessions || sessions.length === 0) return;

    // 1. LocalStorage (sanitized)
    try {
      const sanitized = sanitizeSessionsForLocalStorage(sessions);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch (e) {
      console.warn("[ChatView] LocalStorage quota reached, safe in IndexedDB & Server:", e);
    }

    // 2. Full-fidelity IndexedDB
    saveChatSessionsToIDB(sessions).catch((e) => console.warn("[ChatView] IDB save error:", e));

    // 3. Debounced server persistence
    const timer = setTimeout(() => {
      fetch("/api/chat-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessions }),
      }).catch(() => {});
    }, 1000);

    return () => clearTimeout(timer);
  }, [sessions]);

  useEffect(() => {
    if (activeSessionId) {
      try {
        localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
      } catch (e) {}
    }
  }, [activeSessionId]);

  // Sync mode when switching session
  useEffect(() => {
    if (currentSession?.mode) {
      setChatMode(currentSession.mode as any);
    }
  }, [activeSessionId]);

  // Scroll to bottom when messages update (unless user is scrolled far up viewing history)
  useEffect(() => {
    if (chatScrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      // Auto-scroll if close to bottom (< 200px) or when active generation begins
      if (distanceFromBottom < 200 || isCurrentSessionLoading) {
        scrollToBottom("smooth");
      }
    } else {
      scrollToBottom("smooth");
    }
  }, [currentSession?.messages, isCurrentSessionLoading, scrollToBottom]);

  // Reset scroll and go to bottom when switching active session
  useEffect(() => {
    setShowScrollBottom(false);
    const timer = setTimeout(() => {
      scrollToBottom("auto");
    }, 40);
    return () => clearTimeout(timer);
  }, [activeSessionId, scrollToBottom]);

  // Close dropdown on outside click (touch and mouse)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsModelDropdownOpen(false);
      }
      if (
        ratioDropdownRef.current &&
        !ratioDropdownRef.current.contains(e.target as Node)
      ) {
        setIsRatioDropdownOpen(false);
      }
      if (
        presetDropdownRef.current &&
        !presetDropdownRef.current.contains(e.target as Node)
      ) {
        setIsPresetMenuOpen(false);
      }
      if (
        providerDropdownRef.current &&
        !providerDropdownRef.current.contains(e.target as Node)
      ) {
        setIsProviderDropdownOpen(false);
      }
      if (
        videoRatioDropdownRef.current &&
        !videoRatioDropdownRef.current.contains(e.target as Node)
      ) {
        setIsVideoRatioDropdownOpen(false);
      }
      if (
        videoDurationDropdownRef.current &&
        !videoDurationDropdownRef.current.contains(e.target as Node)
      ) {
        setIsVideoDurationDropdownOpen(false);
      }
      if (
        videoModelDropdownRef.current &&
        !videoModelDropdownRef.current.contains(e.target as Node)
      ) {
        setIsVideoModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Auto resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
    }
  }, [inputText]);

  const activeProviderObj = useMemo(() => {
    return (
      CHAT_PROVIDERS.find((p) => p.id === selectedChatProvider) || CHAT_PROVIDERS[0]
    );
  }, [selectedChatProvider]);

  const activeModelObj = useMemo(() => {
    if (selectedChatProvider === "gemini") {
      const gFound = GEMINI_LLM_MODELS.find((m) => m.id === selectedModel);
      if (gFound) {
        return {
          id: gFound.id,
          name: gFound.name,
          provider: "Google" as const,
        };
      }
    }
    return (
      WEAVY_LLM_MODELS.find((m) => m.id === selectedModel) || {
        id: selectedModel,
        name: selectedModel.split("/")[1] || selectedModel,
        provider: "Anthropic" as const,
      }
    );
  }, [selectedChatProvider, selectedModel]);

  const activeImgModelObj = useMemo(() => {
    if (selectedChatProvider === "gemini") {
      return (
        GEMINI_IMAGE_MODELS.find(
          (m) =>
            m.id === selectedImageModel ||
            m.name.toLowerCase() === selectedImageModel.toLowerCase() ||
            m.id.toLowerCase().includes(selectedImageModel.toLowerCase()) ||
            selectedImageModel.toLowerCase().includes(m.id.toLowerCase()),
        ) || GEMINI_IMAGE_MODELS[0]
      );
    }
    return (
      WEAVY_IMAGE_MODELS.find(
        (m) =>
          m.id === selectedImageModel ||
          m.name.toLowerCase() === selectedImageModel.toLowerCase() ||
          m.id.toLowerCase().includes(selectedImageModel.toLowerCase()) ||
          selectedImageModel.toLowerCase().includes(m.id.toLowerCase()),
      ) || WEAVY_IMAGE_MODELS[0]
    );
  }, [selectedChatProvider, selectedImageModel]);

  const activeVidModelObj = useMemo(() => {
    if (selectedChatProvider === "gemini") {
      return (
        GEMINI_VIDEO_MODELS.find(
          (m) =>
            m.id === selectedVideoModel ||
            m.name.toLowerCase() === selectedVideoModel.toLowerCase() ||
            m.id.toLowerCase().includes(selectedVideoModel.toLowerCase()),
        ) || GEMINI_VIDEO_MODELS[0]
      );
    }
    return (
      RUNNINGHUB_VIDEO_MODELS.find(
        (m) =>
          m.id === selectedVideoModel ||
          m.name.toLowerCase() === selectedVideoModel.toLowerCase() ||
          m.id.toLowerCase().includes(selectedVideoModel.toLowerCase()),
      ) || RUNNINGHUB_VIDEO_MODELS[0]
    );
  }, [selectedChatProvider, selectedVideoModel]);

  // Allowed durations for currently active video model (Gemini Omni Flash is 10s, Veo 2 is 10s/5s, RunningHub is 15s/10s/5s)
  const allowedDurations = useMemo(() => {
    if (activeVidModelObj.durations && activeVidModelObj.durations.length > 0) {
      return activeVidModelObj.durations;
    }
    return selectedChatProvider === "gemini" ? ["10s"] : RUNNINGHUB_DURATIONS;
  }, [activeVidModelObj, selectedChatProvider]);

  // If selected duration is not allowed for this model (e.g. 15s when using Gemini Omni Flash), auto fallback to model's default
  const effectiveVideoDuration = useMemo(() => {
    if (allowedDurations.includes(selectedVideoDuration)) {
      return selectedVideoDuration;
    }
    return activeVidModelObj.defaultDuration || allowedDurations[0] || (selectedChatProvider === "gemini" ? "10s" : "15s");
  }, [allowedDurations, selectedVideoDuration, activeVidModelObj, selectedChatProvider]);

  // Auto-correct selectedVideoDuration when switching between providers or models with different duration limits
  useEffect(() => {
    if (selectedVideoDuration !== effectiveVideoDuration) {
      setSelectedVideoDuration(effectiveVideoDuration);
    }
  }, [effectiveVideoDuration, selectedVideoDuration]);

  const activeBadge = MODEL_SPEED_BADGES[selectedModel] || {
    label: "Sedang",
    color: "text-stone-300 bg-stone-700/30",
  };

  // Handle New Chat
  const handleCreateNewChat = () => {
    // If the currently active session is already an empty "Obrolan Baru", just reuse it
    if (
      currentSession &&
      currentSession.messages.length === 0 &&
      currentSession.title === "Obrolan Baru"
    ) {
      setInputText("");
      setAttachments([]);
      if (window.innerWidth < 1024) {
        setIsHistorySidebarOpen(false);
      }
      return;
    }

    const uniqueId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newSession: ChatSession = {
      id: uniqueId,
      title: "Obrolan Baru",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      model: selectedModel,
      mode: chatMode,
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(uniqueId);
    setInputText("");
    setAttachments([]);
    if (window.innerWidth < 1024) {
      setIsHistorySidebarOpen(false);
    }
  };

  const handleDeleteSession = (sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Call server to delete session from server disk as well
    fetch(`/api/chat-sessions/${sessionId}`, { method: "DELETE" }).catch(() => {});
    // Also delete from IndexedDB
    deleteChatSessionFromIDB(sessionId).catch(() => {});

    if (sessions.length <= 1) {
      // Clear messages instead of deleting the only session
      const freshId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const freshSession: ChatSession = {
        id: freshId,
        title: "Obrolan Baru",
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        model: selectedModel,
        mode: chatMode,
      };
      setSessions([freshSession]);
      setActiveSessionId(freshId);
      setInputText("");
      setAttachments([]);
      return;
    }
    const filtered = sessions.filter((s) => s.id !== sessionId);
    setSessions(filtered);
    if (activeSessionId === sessionId) {
      setActiveSessionId(filtered[0]?.id || "");
      setInputText("");
      setAttachments([]);
    }
  };

  const handleStartRenameSession = (sess: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(sess.id);
    setEditingSessionTitle(sess.title);
  };

  const handleSaveRenameSession = (sessionId: string, e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.stopPropagation();
    const trimmed = editingSessionTitle.trim();
    if (trimmed) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, title: trimmed, updatedAt: new Date().toISOString() }
            : s
        )
      );
    }
    setEditingSessionId(null);
  };

  const handleCancelRenameSession = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSessionId(null);
  };

  const handleTogglePinSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, isPinned: !s.isPinned } : s
      )
    );
  };

  // Upload attachment to Weavy media endpoint with real-time progress tracking
  const uploadAttachment = useCallback(
    async (attachment: ChatAttachment, fileToUpload?: File) => {
      const file = fileToUpload || attachment.fileObject;
      const isImg = attachment.type === "image" || file?.type.startsWith("image/");
      const isVid =
        attachment.type === "video" ||
        file?.type.startsWith("video/") ||
        Boolean(file?.name.match(/\.(mp4|webm|mov|mkv)$/i));

      // If already a remote CDN / server media-cache URL and no local File, it is already securely uploaded
      const isAlreadyHosted =
        attachment.url &&
        !attachment.url.startsWith("data:") &&
        !attachment.url.startsWith("blob:") &&
        (attachment.url.startsWith("http://") ||
          attachment.url.startsWith("https://") ||
          attachment.url.startsWith("/media-cache/"));

      if (isAlreadyHosted && !file) {
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === attachment.id
              ? { ...a, isUploading: false, uploadProgress: 100, uploadError: undefined }
              : a,
          ),
        );
        return;
      }

      // Mark attachment as actively uploading with 0% progress
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === attachment.id
            ? { ...a, isUploading: true, uploadProgress: 0, uploadError: undefined }
            : a,
        ),
      );

      const activeAccount = currentWeavyAccount || weavyAccountsList[0];
      const allTokens = [
        activeAccount?.refreshToken,
        ...weavyAccountsList
          .filter((a: any) => a.id !== activeAccount?.id && (typeof a.credits !== "number" || a.credits > 0))
          .map((a: any) => a.refreshToken)
      ].filter((t): t is string => typeof t === "string" && Boolean(t.trim()));

      // Provider Gemini: simpan media ke cache server lokal (/api/gemini/upload) seperti menu Generate,
      // BUKAN ke Weavy (yang butuh token Weavy dan gagal bila hanya akun Gemini yang terhubung).
      const isGeminiProvider = selectedChatProvider === "gemini";
      const uploadMime = isGeminiProvider
        ? (file?.type || (isVid ? "video/mp4" : "image/png"))
        : (isVid ? "video/mp4" : isImg ? "image/jpeg" : "application/octet-stream");

      try {
        const result = await uploadMediaWithProgress({
          url: isGeminiProvider ? "/api/gemini/upload" : "/api/upload-media",
          file: file || null,
          base64Data:
            !file && (attachment.base64 || attachment.url?.startsWith("data:"))
              ? attachment.base64 || attachment.url
              : null,
          fileName: attachment.name || (isVid ? "chat_video.mp4" : "chat_image.png"),
          mimeType: uploadMime,
          fields: isGeminiProvider
            ? {
                fileName: attachment.name || (isVid ? "chat_video.mp4" : "chat_image.png"),
                mimeType: uploadMime,
              }
            : {
                refreshToken: activeAccount?.refreshToken || "",
                idToken: activeAccount?.idToken || "",
                allRefreshTokens: allTokens.length > 0 ? JSON.stringify(allTokens) : undefined,
              },
          onProgress: (percent) => {
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === attachment.id
                  ? { ...a, isUploading: true, uploadProgress: percent }
                  : a,
              ),
            );
          },
        });

        if (result.success && result.url) {
          console.log("[Chat Attachment: Upload Success to Weavy]", {
            id: attachment.id,
            name: attachment.name,
            cdnUrl: result.url,
          });
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === attachment.id
                ? {
                    ...a,
                    url: result.url!,
                    playbackUrl: isVid ? result.url! : a.playbackUrl,
                    base64: "", // Clear base64 to save memory
                    isUploading: false,
                    uploadProgress: 100,
                    uploadError: undefined,
                  }
                : a,
            ),
          );
        } else {
          throw new Error(result.error || "Gagal mengunggah media ke Weavy AI.");
        }
      } catch (err: any) {
        console.warn("[Chat Attachment: Upload Failed]", err);
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === attachment.id
              ? {
                  ...a,
                  isUploading: false,
                  uploadError: err.message || "Gagal mengunggah media ke server Weavy AI.",
                }
              : a,
          ),
        );
      }
    },
    [currentWeavyAccount, weavyAccountsList, selectedChatProvider],
  );

  const handleRetryUpload = (attachmentId: string) => {
    const target = attachments.find((a) => a.id === attachmentId);
    if (!target) return;
    uploadAttachment(target);
  };

  const handleSaveMarkup = useCallback(
    (markupDataUrl: string, targetMode: "overwrite" | "newNode") => {
      if (markupModal.attachmentId) {
        setAttachments((prev) =>
          prev.map((att) => {
            if (att.id === markupModal.attachmentId) {
              const updated: ChatAttachment = {
                ...att,
                url: markupDataUrl,
                previewUrl: markupDataUrl,
                base64: markupDataUrl,
                name: `Coretan_${att.name || "Image"}.png`,
                isUploading: true,
                uploadProgress: 0,
                uploadError: undefined,
              };
              uploadAttachment(updated);
              return updated;
            }
            return att;
          }),
        );
      } else {
        const newAtt: ChatAttachment = {
          id: `att_markup_${Date.now()}`,
          name: `Coretan_Visual_${Date.now().toString().slice(-4)}.png`,
          type: "image",
          url: markupDataUrl,
          previewUrl: markupDataUrl,
          base64: markupDataUrl,
          isUploading: true,
          uploadProgress: 0,
        };

        setAttachments((prev) => [...prev, newAtt]);
        uploadAttachment(newAtt);
        setChatMode("image");

        if (!inputText || inputText.trim() === "") {
          setInputText("Tolong ubah/edit bagian yang ditandai merah ini: ");
        }
      }
    },
    [markupModal.attachmentId, inputText, uploadAttachment],
  );

  // Send generated image to prompt input as attachment
  const handleUseImageInPrompt = (imageUrl: string, promptText?: string) => {
    const tempId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const currentPendingImagesCount = attachments.filter(
      (a) => a.type === "image" || Boolean(a.url?.trim()) || Boolean(a.base64?.trim())
    ).length;
    const assignedIndex = totalSessionImagesCount + currentPendingImagesCount + 1;

    console.log("[Image Attachment Event: Use In Prompt]", {
      imageUrl: imageUrl.slice(0, 100),
      assignedIndex: assignedIndex,
      assignedTag: `@img${assignedIndex}`,
      timestamp: new Date().toISOString(),
    });

    const isHosted =
      !imageUrl.startsWith("data:") &&
      !imageUrl.startsWith("blob:") &&
      (imageUrl.startsWith("http://") ||
        imageUrl.startsWith("https://") ||
        imageUrl.startsWith("/media-cache/"));

    const newAttachment: ChatAttachment = {
      id: tempId,
      name: `gambar-referensi-${assignedIndex}.png`,
      url: imageUrl,
      previewUrl: imageUrl,
      base64: isHosted ? "" : imageUrl,
      type: "image",
      size: isHosted ? "Cloud Media" : "AI Generated",
      isUploading: !isHosted,
      uploadProgress: isHosted ? 100 : 0,
    };
    setAttachments((prev) => {
      if (prev.some((a) => a.url === imageUrl)) return prev;
      return [...prev, newAttachment];
    });

    if (!isHosted) {
      uploadAttachment(newAttachment);
    }

    if (promptText) {
      setInputText(promptText);
    }
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  // Send generated video to prompt input as attachment / reference
  const handleUseVideoInPrompt = (videoUrl: string, promptText?: string) => {
    const tempId = `att_vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const currentPendingVideosCount = attachments.filter(
      (a) => a.type === "video" || Boolean(a.playbackUrl) || Boolean(a.url && a.url.includes(".mp4"))
    ).length;
    const assignedIndex = existingSessionVideos.length + currentPendingVideosCount + 1;

    const newAttachment: ChatAttachment = {
      id: tempId,
      name: `video-referensi-${assignedIndex}.mp4`,
      url: videoUrl,
      playbackUrl: videoUrl,
      previewUrl: videoUrl,
      type: "video",
      size: "AI Video",
      videoIndex: assignedIndex,
      isUploading: false,
      uploadProgress: 100,
    };
    setAttachments((prev) => {
      if (prev.some((a) => a.url === videoUrl || a.playbackUrl === videoUrl)) return prev;
      return [...prev, newAttachment];
    });
    if (promptText) {
      setInputText(promptText);
    }
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  // Process and attach files (images, videos, and documents)
  const processFiles = (files: FileList | File[]) => {
    const fileList = Array.from(files);
    fileList.forEach((file, fIdx) => {
      const isImg = file.type.startsWith("image/");
      const isVid = file.type.startsWith("video/") || Boolean(file.name.match(/\.(mp4|webm|mov|mkv)$/i));
      const tempId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${fIdx}`;
      
      let localPreviewUrl = "";
      try {
        localPreviewUrl = URL.createObjectURL(file);
      } catch (e) {
        // Fallback
      }

      const initialAttachment: ChatAttachment = {
        id: tempId,
        name: file.name,
        url: localPreviewUrl,
        previewUrl: localPreviewUrl,
        playbackUrl: isVid ? localPreviewUrl : undefined,
        type: isImg ? "image" : (isVid ? "video" : "file"),
        size: `${Math.round(file.size / 1024)} KB`,
        fileObject: file,
        title: file.name,
        isUploading: isImg || isVid,
        uploadProgress: 0,
      };

      // Calculate dynamic index based on existing session images + currently queued input attachments
      const currentPendingImagesCount = attachments.filter(
        (a) => a.type === "image" || Boolean(a.url?.trim()) || Boolean(a.base64?.trim())
      ).length;
      const assignedIndex = isImg
        ? totalSessionImagesCount + currentPendingImagesCount + fIdx + 1
        : undefined;

      // Validation Logging: Incoming file unique identifier/hash, assigned index, timestamp
      if (isImg && assignedIndex) {
        console.log("[Image Upload Event: Local File Attached]", {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileIdentifier: `${file.name}_${file.size}_${file.lastModified}`,
          assignedIndex: assignedIndex,
          assignedTag: `@img${assignedIndex}`,
          timestamp: new Date().toISOString(),
        });
      }

      setAttachments((prev) => [...prev, initialAttachment]);

      // If file is image or video, immediately upload to Weavy with progress tracking
      if (isImg || isVid) {
        uploadAttachment(initialAttachment, file);
      } else {
        // Documents or other files: load local data URL
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          setAttachments((prev) =>
            prev.map((att) =>
              att.id === tempId ? { ...att, url: result, base64: result } : att
            )
          );
        };
        reader.readAsDataURL(file);
      }
    });
  };

  // Handle Drop Event (Drag & Drop files or images from within the chat/history/web)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    // 1. Check direct files dropped from OS / File Manager
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
      return;
    }

    // 2. Check items if file exists (e.g. some browser drag modes)
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const filesFromItems: File[] = [];
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) filesFromItems.push(file);
        }
      }
      if (filesFromItems.length > 0) {
        processFiles(filesFromItems);
        return;
      }
    }

    // 3. Check dragged internal image URL, uri-list, text, or HTML
    const customUrl = e.dataTransfer.getData("application/x-amb-image-url");
    const uriList = e.dataTransfer.getData("text/uri-list");
    const plainText = e.dataTransfer.getData("text/plain");
    const htmlData = e.dataTransfer.getData("text/html");

    let candidateUrl = customUrl || uriList || "";

    // If candidateUrl is empty or not direct URL, extract from HTML (e.g. <img src="...">)
    if (!candidateUrl && htmlData) {
      const match = htmlData.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (match && match[1]) {
        candidateUrl = match[1];
      }
    }

    if (!candidateUrl && plainText) {
      const trimmed = plainText.trim();
      if (
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("data:image/") ||
        trimmed.startsWith("blob:") ||
        trimmed.startsWith("/")
      ) {
        candidateUrl = trimmed;
      } else if (trimmed.includes("<img")) {
        const match = trimmed.match(/src=["']([^"']+)["']/i);
        if (match && match[1]) {
          candidateUrl = match[1];
        }
      }
    }

    if (candidateUrl && candidateUrl.trim()) {
      handleUseImageInPrompt(candidateUrl.trim());
    }
  };

  // Handle Paste Event (Ctrl+V / Cmd+V images)
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const filesToProcess: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) {
          filesToProcess.push(file);
        }
      }
    }

    if (filesToProcess.length > 0) {
      e.preventDefault();
      processFiles(filesToProcess);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Generate Image via Weavy API
  const handleGenerateImage = async () => {
    if (attachments.some((a) => Boolean(a.isUploading))) {
      return;
    }
    if (attachments.some((a) => Boolean(a.uploadError))) {
      alert("Ada media/gambar yang gagal diunggah. Silakan klik 'Ulangi' atau hapus lampiran tersebut.");
      return;
    }

    const targetSessionId = currentSession.id;
    const trimmed = inputText.trim();
    if ((!trimmed && attachments.length === 0) || loadingSessionIds[targetSessionId]) return;

    const isGemini = selectedChatProvider === "gemini";
    let activeAccount = isGemini
      ? (currentGeminiAccount || geminiAccountsList[0] || null)
      : currentWeavyAccount;

    if (!isGemini && !currentWeavyAccount) {
      alert(
        "Silakan pilih akun Weavy aktif terlebih dahulu di sidebar kiri atau tambahkan akun baru di Pengaturan.",
      );
      return;
    }

    if (isGemini && !activeAccount) {
      alert(
        "Silakan hubungkan akun Google Gemini atau tambahkan Gemini API Key terlebih dahulu di Pengaturan.",
      );
      return;
    }

    const currentCredits =
      !isGemini && typeof currentWeavyAccount?.credits === "number"
        ? currentWeavyAccount.credits
        : null;

    if (!isGemini && currentCredits !== null && currentCredits < activeImgModelObj.credits) {
      alert(
        `Saldo kredit Weavy akun Anda (${currentCredits} kredit) tidak mencukupi untuk model ${activeImgModelObj.name} (membutuhkan ${activeImgModelObj.credits} kredit). Silakan ganti akun atau sinkronkan kredit.`,
      );
      return;
    }

    const userMessage: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      attachments: [...attachments],
      messageType: "text",
    };

    const aiMessageId = `msg_gen_${Date.now()}`;
    const initialAssistantMessage: ChatMessage = {
      id: aiMessageId,
      role: "assistant",
      content: `Menghasilkan gambar dengan model **${activeImgModelObj.name}** (Rasio ${selectedAspectRatio})...`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      model: activeImgModelObj.id,
      modelDisplayName: activeImgModelObj.name,
      messageType: "image_generation",
      generatedImage: {
        prompt: trimmed,
        aspectRatio: selectedAspectRatio,
        modelName: activeImgModelObj.name,
        creditsUsed: activeImgModelObj.credits,
        status: "loading",
      },
    };

    const updatedTitle =
      currentSession.messages.length === 0 && trimmed
        ? `🎨 ${trimmed.length > 25 ? trimmed.substring(0, 25) + "..." : trimmed}`
        : currentSession.title;

    const updatedMessages = [
      ...currentSession.messages,
      userMessage,
      initialAssistantMessage,
    ];

    setSessions((prev) =>
      prev.map((s) =>
        s.id === targetSessionId
          ? {
              ...s,
              title: updatedTitle,
              messages: updatedMessages,
              updatedAt: new Date().toISOString(),
              mode: "image",
            }
          : s,
      ),
    );

    const promptToSend = trimmed;
    const attachedImagesToSend = [...attachments];
    setInputText("");
    setAttachments([]);
    setLoadingSessionIds((prev) => ({ ...prev, [targetSessionId]: true }));

    let geminiLease: GeminiAccountLease | null = null;
    try {
      const attachedImgUrls = attachedImagesToSend
        .filter((a) => a.type === "image" && (a.url || a.base64))
        .map((a) => (a.url || a.base64)!);
      const firstImg = attachedImgUrls[0];

      // Google Gemini Image Generation Flow
      if (isGemini) {
        geminiLease = await acquireGeminiAccountLease(1, activeAccount?.id, {
          onQueued: () => console.info('[Gemini Queue] Chat menunggu akun tersedia.'),
        });
        activeAccount = geminiLease?.account || null;
        if (!activeAccount) {
          throw new Error('Tidak ada akun Gemini dengan kredit cukup dan sesi valid.');
        }

        const payload = {
          prompt: promptToSend,
          aspectRatio: selectedAspectRatio,
          model: activeImgModelObj.id,
          id: activeAccount?.id,
          email: activeAccount?.email,
          name: activeAccount?.displayName || activeAccount?.name || activeAccount?.email,
          token: activeAccount?.token || activeAccount?.apiKey || "",
          apiKey: activeAccount?.apiKey,
          cookies: activeAccount?.cookies || (activeAccount?.token?.includes('__Secure') || activeAccount?.token?.includes('SID=') ? activeAccount.token : undefined),
          referenceImageUrl: firstImg || undefined,
          referenceImageUrls: attachedImgUrls,
          fallbackAccounts: [],
        };

        const resp = await fetch("/api/gemini/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const genData = await resp.json().catch(() => ({}));

        // Handle auto-switched account and exhausted accounts
        if (Array.isArray(genData?.exhaustedAccounts) && genData.exhaustedAccounts.length > 0) {
          try {
            const raw = localStorage.getItem("gemini_accounts");
            const allGem = raw ? JSON.parse(raw) : [];
            const exIds = new Set(genData.exhaustedAccounts.map((e: any) => e.id));
            const exEmails = new Set(genData.exhaustedAccounts.map((e: any) => e.email?.toLowerCase()).filter(Boolean));
            const updated = allGem.map((a: any) => {
              if (exIds.has(a.id) || (a.email && exEmails.has(a.email.toLowerCase()))) {
                return { ...a, credits: 0, totalCredits: GEMINI_MAX_CREDITS };
              }
              return a;
            });
            localStorage.setItem("gemini_accounts", JSON.stringify(updated));
            window.dispatchEvent(new Event("gemini_accounts_updated"));
            window.dispatchEvent(new Event("accounts-updated"));
          } catch (e) {}
        }

        if (!resp.ok || !genData.success) {
          const errText = genData.error || genData.message || "Gagal menghasilkan gambar dari Google Gemini.";
          if (/mencapai kuota/i.test(errText) || /tidak bisa/i.test(errText) || /kuota.*habis/i.test(errText)) {
            try {
              const raw = localStorage.getItem("gemini_accounts");
              const allGem = raw ? JSON.parse(raw) : [];
              const updated = allGem.map((a: any) => {
                if (a.id === activeAccount?.id || (a.email && a.email.toLowerCase() === activeAccount?.email?.toLowerCase())) {
                  return { ...a, credits: 0, totalCredits: GEMINI_MAX_CREDITS };
                }
                return a;
              });
              localStorage.setItem("gemini_accounts", JSON.stringify(updated));
              window.dispatchEvent(new Event("gemini_accounts_updated"));
              window.dispatchEvent(new Event("accounts-updated"));
            } catch (e) {}
          }
          throw new Error(errText);
        }

        if (genData.wasSwitched && genData.usedAccount) {
          try {
            const raw = localStorage.getItem("gemini_accounts");
            const allGem = raw ? JSON.parse(raw) : [];
            const targetId = genData.usedAccount.id;
            const targetEmail = genData.usedAccount.email;
            const updated = allGem.map((a: any) => ({
              ...a,
              isActive: (targetId && a.id === targetId) || (targetEmail && a.email && a.email.toLowerCase() === targetEmail.toLowerCase()),
            }));
            localStorage.setItem("gemini_accounts", JSON.stringify(updated));
            window.dispatchEvent(new Event("gemini_accounts_updated"));
            window.dispatchEvent(new Event("accounts-updated"));
          } catch (e) {}
        }

        const resultUrl = genData.imageUrl;
        setSessions((prev) =>
          prev.map((s) =>
            s.id === targetSessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === aiMessageId
                      ? {
                          ...m,
                          content: `Selesai! Gambar berhasil dibuat dengan model **${genData.model || activeImgModelObj.name}** (Rasio ${selectedAspectRatio}).${genData.wasSwitched ? `\n*(Auto-switched ke akun ${genData.usedAccount?.name || genData.usedAccount?.email || ''})*` : ''}`,
                          generatedImage: {
                            url: resultUrl,
                            status: "completed" as const,
                            prompt: promptToSend,
                            aspectRatio: selectedAspectRatio,
                            modelName: genData.model || activeImgModelObj.name,
                            creditsUsed: 0,
                          },
                        }
                      : m,
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : s,
          ),
        );
        return;
      }

      // Map to friendly name for backend recipe generator
      const friendlyModelName = normalizeWeavyModelName(
        activeImgModelObj.name,
        activeImgModelObj.id,
      );

      const payload = {
        refreshToken: currentWeavyAccount?.refreshToken || "",
        idToken: currentWeavyAccount?.idToken || "",
        prompt: promptToSend,
        mode: "image",
        model: friendlyModelName,
        quality: "high",
        aspect_ratio: selectedAspectRatio,
        resolution: "1080p",
        image_url: firstImg || undefined,
        images: attachedImgUrls.length > 0 ? attachedImgUrls : undefined,
        attached_media: attachedImgUrls.map((url) => ({ url, type: "image" })),
      };

      let genData: any = null;
      if (extensionBridge.getStatus().isConnected) {
        console.log('[ChatView 🎨] Menjalankan generate gambar Weavy langsung via Chrome Extension Bridge (100% Bebas 403)...');
        genData = await extensionBridge.generateWeavy(payload);
      } else {
        const resp = await fetch("/api/generate-weavy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        genData = await resp.json().catch(() => ({}));
      }

      if (!genData || !genData.success) {
        throw new Error(
          genData?.error ||
            genData?.message ||
            "Gagal mengirim permintaan pembuatan gambar ke Weavy AI.",
        );
      }

      const taskId = genData.taskId || genData.batchId;
      const recipeId = genData.recipeId;

      // Optimistic credit deduction
      if (typeof currentWeavyAccount.credits === "number") {
        const nextCredits = Math.max(
          0,
          currentWeavyAccount.credits - activeImgModelObj.credits,
        );
        const updated = updateWeavyAccountCreditsInStorage(
          { id: currentWeavyAccount.id, email: currentWeavyAccount.email },
          nextCredits,
        );
        if (updated.length > 0) setWeavyAccountsList(updated);
      }

      // Reusable polling helper
      const resultUrl = await pollWeavyTaskStatus({
        taskId,
        recipeId,
        refreshToken: currentWeavyAccount?.refreshToken || "",
        idToken: currentWeavyAccount?.idToken || "",
        maxAttempts: 45,
        pollInterval: 2500,
        onCreditUpdate: (returnedCredits) => {
          const updated = updateWeavyAccountCreditsInStorage(
            { id: currentWeavyAccount.id, email: currentWeavyAccount.email },
            returnedCredits,
          );
          if (updated.length > 0) setWeavyAccountsList(updated);
        },
      });

      // Success: update message
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === aiMessageId
                    ? {
                        ...m,
                        content: `Gambar berhasil dibuat dengan model **${activeImgModelObj.name}**!`,
                        generatedImage: {
                          status: "completed",
                          url: resultUrl,
                          prompt: promptToSend,
                          aspectRatio: selectedAspectRatio,
                          modelName: activeImgModelObj.name,
                          creditsUsed: activeImgModelObj.credits,
                        },
                      }
                    : m,
                ),
                updatedAt: new Date().toISOString(),
              }
            : s,
        ),
      );

      // Refresh credits
      if (currentWeavyAccount?.refreshToken) {
        handleSyncAccountCredits(currentWeavyAccount);
      }
    } catch (err: any) {
      console.error("[Image Generation Error]:", err);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === aiMessageId
                    ? {
                        ...m,
                        content: `⚠️ Gagal menghasilkan gambar: ${err.message || "Terjadi kesalahan sistem."}`,
                        isError: true,
                        generatedImage: {
                          status: "failed",
                          errorMessage:
                            err.message || "Terjadi kendala saat memproses gambar.",
                          prompt: promptToSend,
                          aspectRatio: selectedAspectRatio,
                          modelName: activeImgModelObj.name,
                          creditsUsed: activeImgModelObj.credits,
                        },
                      }
                    : m,
                ),
                updatedAt: new Date().toISOString(),
              }
            : s,
        ),
      );
    } finally {
      geminiLease?.release();
      setLoadingSessionIds((prev) => {
        const next = { ...prev };
        delete next[targetSessionId];
        return next;
      });
    }
  };

  // Generate Video via RunningHub API
  const handleGenerateVideo = async () => {
    if (attachments.some((a) => Boolean(a.isUploading))) {
      return;
    }
    if (attachments.some((a) => Boolean(a.uploadError))) {
      alert("Ada media yang gagal diunggah. Silakan klik 'Ulangi' atau hapus lampiran tersebut.");
      return;
    }

    const targetSessionId = currentSession.id;
    const trimmed = inputText.trim();
    if (!trimmed && attachments.length === 0) return;

    // Capture active video generation settings in local constants for this specific task
    const vidAspect = selectedVideoAspect;
    const vidDuration = effectiveVideoDuration;
    const vidModelObj = activeVidModelObj;
    const vidResolution = selectedVideoResolution;

    const isGemini = selectedChatProvider === "gemini";
    let activeAccount: any = null;
    if (isGemini) {
      const validGeminiAccs = geminiAccountsList.filter((a: any) => {
        const token = (a?.token || a?.refreshToken || a?.apiKey || a?.cookies || a?.email || '').trim();
        return token.length > 0;
      });

      // Priority 1: Current active account if it has credits > 0 or undefined
      const current = currentGeminiAccount && (validGeminiAccs.find((a: any) => a.id === currentGeminiAccount.id) || currentGeminiAccount);
      if (current && (typeof current.credits !== 'number' || current.credits > 0)) {
        activeAccount = current;
      } else {
        // Priority 2: Account with credits > 0
        const withCredits = [...validGeminiAccs].reverse().find((a: any) => typeof a.credits !== 'number' || a.credits > 0);
        activeAccount = withCredits || current || validGeminiAccs[0] || currentGeminiAccount || geminiAccountsList[0] || null;
      }

      if (!activeAccount) {
        if (currentGeminiAccount) {
          activeAccount = currentGeminiAccount;
        } else if (geminiAccountsList.length > 0) {
          activeAccount = geminiAccountsList[0];
        } else {
          activeAccount = { id: 'default_gemini', name: 'Google Gemini', email: '', token: '' };
        }
      }
    }

    let rhApiKey = "";
    if (!isGemini) {
      rhApiKey = getActiveRunningHubApiKey();
      if (!rhApiKey) {
        alert(
          "Silakan tambahkan atau aktifkan API Key RunningHub terlebih dahulu di Pengaturan untuk menghasilkan video AI.",
        );
        return;
      }
    }

    // Extract attached image or video references
    const attachedImages = attachments.filter(
      (a) => a.type === "image" || Boolean(a.url && !a.playbackUrl && !a.url.includes(".mp4")),
    );
    const attachedVideos = attachments.filter(
      (a) => a.type === "video" || Boolean(a.playbackUrl) || Boolean(a.url && a.url.includes(".mp4")),
    );

    const refImageUrl = attachedImages.length > 0 ? (attachedImages[0].url || attachedImages[0].base64) : undefined;
    const refVideoUrl = attachedVideos.length > 0 ? (attachedVideos[0].playbackUrl || attachedVideos[0].url) : undefined;

    const userMessage: ChatMessage = {
      id: `msg_user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      attachments: [...attachments],
      messageType: "text",
    };

    const aiMessageId = `msg_gen_vid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const initialAssistantMessage: ChatMessage = {
      id: aiMessageId,
      role: "assistant",
      content: `Menghasilkan video dengan model **${vidModelObj.name}** (Rasio ${vidAspect}, Durasi ${vidDuration})...`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      model: vidModelObj.id,
      modelDisplayName: vidModelObj.name,
      messageType: "video_generation",
      generatedVideo: {
        prompt: trimmed,
        aspectRatio: vidAspect,
        modelName: vidModelObj.name,
        provider: isGemini ? "gemini" : "runninghub",
        duration: vidDuration,
        resolution: vidResolution,
        creditsUsed: vidModelObj.credits,
        status: "loading",
        referenceImageUrl: refImageUrl,
        referenceVideoUrl: refVideoUrl,
      },
    };

    const updatedTitle =
      currentSession.messages.length === 0 && trimmed
        ? `🎬 ${trimmed.length > 25 ? trimmed.substring(0, 25) + "..." : trimmed}`
        : currentSession.title;

    const updatedMessages = [
      ...currentSession.messages,
      userMessage,
      initialAssistantMessage,
    ];

    setSessions((prev) =>
      prev.map((s) =>
        s.id === targetSessionId
          ? {
              ...s,
              title: updatedTitle,
              messages: updatedMessages,
              updatedAt: new Date().toISOString(),
              mode: "video",
            }
          : s,
      ),
    );

    let promptToSend = trimmed;
    const vidHeaderMatch = trimmed.match(/^Generate Video[^\n:]*:\s*([\s\S]*)$/i);
    if (vidHeaderMatch && vidHeaderMatch[1]) {
      promptToSend = vidHeaderMatch[1].trim();
      const ratioMatch = trimmed.match(/Format\s*([0-9]+:[0-9]+)/i);
      if (ratioMatch && ratioMatch[1]) {
        setSelectedVideoAspect(ratioMatch[1]);
      }
      const durMatch = trimmed.match(/durasi\s*([0-9]+)\s*detik/i);
      if (durMatch && durMatch[1]) {
        const parsedDur = `${durMatch[1]}s`;
        if (allowedDurations.includes(parsedDur)) {
          setSelectedVideoDuration(parsedDur);
        }
      }
    }

    // Immediately clear inputs so user can prepare and submit next video prompts without waiting!
    setInputText("");
    setAttachments([]);

    let geminiLease: GeminiAccountLease | null = null;
    try {
      // Google Gemini (Veo) Video Generation Flow
      if (isGemini) {
          geminiLease = await acquireGeminiAccountLease(1, activeAccount?.id, {
            onQueued: () => console.info('[Gemini Queue] Chat video menunggu akun tersedia.'),
          });
          activeAccount = geminiLease?.account || null;
          if (!activeAccount) {
            throw new Error('Tidak ada akun Gemini dengan kredit cukup dan sesi valid.');
          }

          const activeWebCookies =
            activeAccount?.cookies ||
            [activeAccount?.token, activeAccount?.refreshToken].find(
              (value: unknown) =>
                typeof value === "string" &&
                (value.includes("__Secure-1PSID") || value.includes("SID=")),
            );
        const payload = {
          prompt: promptToSend,
          aspectRatio: vidAspect,
          duration: vidDuration,
          model: vidModelObj.id,
          id: activeAccount?.id,
          email: activeAccount?.email,
          name: activeAccount?.displayName || activeAccount?.name || activeAccount?.email,
          token: activeWebCookies || "",
          cookies: activeWebCookies,
          referenceImageUrl: refImageUrl,
          referenceImageUrls: attachedImages
            .map((a) => a.url || a.base64)
            .filter((u): u is string => Boolean(u))
            .slice(0, 5),
          referenceVideoUrl: refVideoUrl,
          fallbackAccounts: [],
        };

        const resp = await fetch("/api/gemini/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const genData = await resp.json().catch(() => ({}));

        if (Array.isArray(genData?.exhaustedAccounts) && genData.exhaustedAccounts.length > 0) {
          try {
            const raw = localStorage.getItem("gemini_accounts");
            const allGem = raw ? JSON.parse(raw) : [];
            const exIds = new Set(genData.exhaustedAccounts.map((e: any) => e.id));
            const exEmails = new Set(genData.exhaustedAccounts.map((e: any) => e.email?.toLowerCase()).filter(Boolean));
            const updated = allGem.map((a: any) => {
              if (exIds.has(a.id) || (a.email && exEmails.has(a.email.toLowerCase()))) {
                return { ...a, credits: 0, totalCredits: GEMINI_MAX_CREDITS };
              }
              return a;
            });
            localStorage.setItem("gemini_accounts", JSON.stringify(updated));
            window.dispatchEvent(new Event("gemini_accounts_updated"));
            window.dispatchEvent(new Event("accounts-updated"));
          } catch (e) {}
        }

        if (!resp.ok || !genData.success || (!genData.videoUrl && !genData.operationName)) {
          const errText =
            genData.error ||
            genData.errorMessage ||
            genData.message ||
            genData.text ||
            "Gemini Omni Flash merespons bukan hasil video generate.";
          
          if (/mencapai kuota/i.test(errText) || /tidak bisa/i.test(errText) || /kuota.*habis/i.test(errText) || /lagi hari ini/i.test(errText)) {
            try {
              const raw = localStorage.getItem("gemini_accounts");
              const allGem = raw ? JSON.parse(raw) : [];
              const updated = allGem.map((a: any) => {
                if (a.id === activeAccount?.id || (a.email && a.email.toLowerCase() === activeAccount?.email?.toLowerCase())) {
                  return { ...a, credits: 0, totalCredits: GEMINI_MAX_CREDITS };
                }
                return a;
              });
              localStorage.setItem("gemini_accounts", JSON.stringify(updated));
              window.dispatchEvent(new Event("gemini_accounts_updated"));
              window.dispatchEvent(new Event("accounts-updated"));
            } catch (e) {}
          }
          throw new Error(errText);
        }

        // Update used account credit immediately (Optimistic Reservation)
        if (genData.usedAccount && typeof genData.remainingCredits === "number") {
          try {
            const raw = localStorage.getItem("gemini_accounts");
            const allGem = raw ? JSON.parse(raw) : [];
            const targetId = genData.usedAccount.id;
            const targetEmail = genData.usedAccount.email;
            const updated = allGem.map((a: any) => {
              const isTarget = (targetId && a.id === targetId) || (targetEmail && a.email && a.email.toLowerCase() === targetEmail.toLowerCase());
              if (isTarget) {
                return {
                  ...a,
                  credits: genData.remainingCredits,
                  totalCredits: GEMINI_MAX_CREDITS,
                  isActive: genData.wasSwitched ? true : a.isActive,
                };
              }
              return genData.wasSwitched ? { ...a, isActive: false } : a;
            });
            localStorage.setItem("gemini_accounts", JSON.stringify(updated));
            window.dispatchEvent(new Event("gemini_accounts_updated"));
            window.dispatchEvent(new Event("accounts-updated"));
          } catch (e) {}
        } else if (genData.wasSwitched && genData.usedAccount) {
          try {
            const raw = localStorage.getItem("gemini_accounts");
            const allGem = raw ? JSON.parse(raw) : [];
            const targetId = genData.usedAccount.id;
            const targetEmail = genData.usedAccount.email;
            const updated = allGem.map((a: any) => ({
              ...a,
              isActive: (targetId && a.id === targetId) || (targetEmail && a.email && a.email.toLowerCase() === targetEmail.toLowerCase()),
            }));
            localStorage.setItem("gemini_accounts", JSON.stringify(updated));
            window.dispatchEvent(new Event("gemini_accounts_updated"));
            window.dispatchEvent(new Event("accounts-updated"));
          } catch (e) {}
        }

        let resultUrl = genData.videoUrl;
        if (!resultUrl && genData.operationName) {
          const effectiveCookies = genData.usedAccount?.cookies || genData.usedAccount?.token || activeAccount?.cookies || activeAccount?.token;
          const effectiveEmail = genData.usedAccount?.email || activeAccount?.email;

          // Keep the account lease through the server's maximum video-task window.
          let pollAttempts = 0;
          const maxPollAttempts = 180;
          while (pollAttempts < maxPollAttempts) {
            await new Promise((r) => setTimeout(r, 3000));
            pollAttempts++;

            try {
              const statusResp = await fetch("/api/gemini/video-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  operationName: genData.operationName,
                  cookies: effectiveCookies,
                  token: effectiveCookies,
                  email: effectiveEmail,
                  fallbackAccounts: [],
                }),
              });

              if (statusResp.ok) {
                const stData = await statusResp.json().catch(() => ({}));
                if (stData.success && stData.status === "completed" && stData.videoUrl) {
                  resultUrl = stData.videoUrl;
                  break;
                }
                if (stData.status === "failed" || (stData.error && stData.done) || (stData.done && !stData.videoUrl) || (stData.status === "completed" && !stData.videoUrl)) {
                  const failMsg = stData.error || stData.errorMessage || stData.text || "Gemini Omni Flash merespons bukan hasil video generate.";
                  const isQuotaHit = Boolean(
                    stData.isQuotaExhausted ||
                    stData.remainingCredits === 0 ||
                    /kuota/i.test(failMsg) ||
                    /tidak bisa membuatkan/i.test(failMsg) ||
                    /lagi hari ini/i.test(failMsg) ||
                    /batas kredit/i.test(failMsg)
                  );
                  const targetCredit = isQuotaHit ? 0 : (typeof stData.remainingCredits === "number" ? stData.remainingCredits : undefined);

                  if (typeof targetCredit === "number") {
                    try {
                      const raw = localStorage.getItem("gemini_accounts");
                      const allGem = raw ? JSON.parse(raw) : [];
                      const targetId = genData.usedAccount?.id || activeAccount?.id;
                      const targetEmail = genData.usedAccount?.email || activeAccount?.email;
                      const updated = allGem.map((a: any) => {
                        const isTarget = (targetId && a.id === targetId) || (targetEmail && a.email && a.email.toLowerCase() === targetEmail.toLowerCase()) || (isQuotaHit && activeAccount?.id && a.id === activeAccount.id);
                        return isTarget ? { ...a, credits: targetCredit, totalCredits: GEMINI_MAX_CREDITS } : a;
                      });
                      localStorage.setItem("gemini_accounts", JSON.stringify(updated));
                      setGeminiAccountsList(updated);
                      window.dispatchEvent(new Event("gemini_accounts_updated"));
                      window.dispatchEvent(new Event("accounts-updated"));
                    } catch (e) {}
                  }
                  const fatalErr = new Error(failMsg);
                  (fatalErr as any).isFatalGenerationFailure = true;
                  throw fatalErr;
                }
              }
            } catch (pollErr: any) {
              if (
                pollErr?.isFatalGenerationFailure ||
                (pollErr?.message && (
                  pollErr.message.includes("traffic") ||
                  pollErr.message.includes("kapasitas") ||
                  pollErr.message.includes("penuh") ||
                  pollErr.message.includes("gagal") ||
                  pollErr.message.includes("batas") ||
                  pollErr.message.includes("kuota") ||
                  pollErr.message.includes("coba lagi") ||
                  pollErr.message.includes("failed") ||
                  pollErr.message.includes("busy")
                ))
              ) {
                throw pollErr;
              }
              console.warn("[Gemini Video Poll Notice]:", pollErr.message);
            }
          }
        }

        if (!resultUrl) {
          throw new Error("Waktu tunggu render video Google Veo habis (timeout) atau video belum siap.");
        }
        setSessions((prev) =>
          prev.map((s) =>
            s.id === targetSessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === aiMessageId
                      ? {
                          ...m,
                          content: `Selesai! Video berhasil dibuat dengan model **${genData.model || vidModelObj.name}** (Rasio ${vidAspect}, Durasi ${vidDuration}).${genData.wasSwitched ? `\n*(Auto-switched ke akun ${genData.usedAccount?.name || genData.usedAccount?.email || ''})*` : ''}`,
                          generatedVideo: {
                            url: resultUrl,
                            status: "completed" as const,
                            prompt: promptToSend,
                            aspectRatio: vidAspect,
                            duration: vidDuration,
                            resolution: vidResolution,
                            modelName: genData.model || vidModelObj.name,
                            provider: "gemini",
                            creditsUsed: 0,
                            referenceImageUrl: refImageUrl,
                            referenceVideoUrl: refVideoUrl,
                          },
                        }
                      : m,
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : s,
          ),
        );
        return;
      }

      // Gather fallback keys from runninghub_accounts (prioritizing accounts with available coins)
      const fallbackKeys: string[] = [];
      try {
        const raw = localStorage.getItem("runninghub_accounts");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const candidateAccs = parsed
              .map((a: any) => ({
                key: (a?.refreshToken || a?.accessToken || a?.idToken || a?.apiKey || '').trim(),
                credits: a?.credits !== undefined ? Number(a.credits) : 600,
                status: a?.accountStatus || 'active',
              }))
              .filter((c) => c.key && c.key !== rhApiKey && c.status !== 'error')
              .sort((a, b) => b.credits - a.credits);

            candidateAccs.forEach((c) => {
              if (!fallbackKeys.includes(c.key)) {
                fallbackKeys.push(c.key);
              }
            });
          }
        }
      } catch (e) {}

      const payload = {
        apiKey: rhApiKey,
        fallbackApiKeys: fallbackKeys,
        prompt: promptToSend,
        image: refImageUrl,
        video: refVideoUrl,
        model: vidModelObj.name,
        workflowId: vidModelObj.workflowId,
        aspectRatio: vidAspect,
        duration: vidDuration,
        resolution: vidResolution,
      };

      const resp = await fetch("/api/runninghub/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const genData = await resp.json().catch(() => ({}));

      // If exhausted accounts were detected, update local state
      if (Array.isArray(genData?.exhaustedApiKeys) && genData.exhaustedApiKeys.length > 0) {
        try {
          const raw = localStorage.getItem("runninghub_accounts");
          if (raw) {
            const accs = JSON.parse(raw);
            if (Array.isArray(accs)) {
              let changed = false;
              const updated = accs.map((a: any) => {
                const key = (a?.refreshToken || a?.accessToken || a?.idToken || a?.apiKey || '').trim();
                if (genData.exhaustedApiKeys.includes(key)) {
                  changed = true;
                  return { ...a, credits: 0, totalCredits: 0, statusMessage: 'Koin habis (0 Coins)', accountStatus: 'error' };
                }
                return a;
              });
              if (changed) {
                localStorage.setItem("runninghub_accounts", JSON.stringify(updated));
                window.dispatchEvent(new Event("runninghub_accounts_updated"));
              }
            }
          }
        } catch (e) {}
      }

      if (!resp.ok || !genData.success) {
        throw new Error(
          genData.error ||
            genData.message ||
            "Gagal mengirim permintaan pembuatan video ke RunningHub AI.",
        );
      }

      const taskId = genData.taskId;
      if (!taskId) {
        throw new Error("Task ID tidak ditemukan dari respon RunningHub.");
      }

      const effectiveApiKey = (genData.usedApiKey || rhApiKey || "").trim();

      // Polling RunningHub task status
      let attempts = 0;
      const maxAttempts = 180; // 180 * 2000ms = 360 seconds (6 minutes)
      let finalVideoUrl = "";
      let finalCoverUrl = "";

      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;

        try {
          const statusResp = await fetch("/api/runninghub/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              apiKey: effectiveApiKey,
              taskId: taskId,
            }),
          });

          if (statusResp.ok) {
            const stData = await statusResp.json();
            const extractedMediaUrl =
              stData?.mediaUrl ||
              stData?.videoUrl ||
              stData?.resultUrl ||
              stData?.outputUrl ||
              stData?.fileUrl ||
              (Array.isArray(stData?.outputs) && stData.outputs.length > 0
                ? stData.outputs[0]?.fileUrl ||
                  stData.outputs[0]?.url ||
                  stData.outputs[0]?.downloadUrl ||
                  (typeof stData.outputs[0] === "string" ? stData.outputs[0] : "")
                : "");

            const isSuccess =
              stData?.status === "completed" ||
              stData?.status === "SUCCESS" ||
              stData?.rawStatus === "SUCCESS" ||
              stData?.rawStatus === "FINISH" ||
              stData?.rawStatus === "FINISHED" ||
              Boolean(extractedMediaUrl && typeof extractedMediaUrl === "string" && extractedMediaUrl.startsWith("http"));

            if (isSuccess && extractedMediaUrl) {
              finalVideoUrl = extractedMediaUrl;
              finalCoverUrl = stData?.coverUrl || "";
              break;
            } else if (
              stData?.status === "failed" ||
              stData?.status === "FAILED" ||
              stData?.rawStatus === "FAILED"
            ) {
              throw new Error(
                stData.error ||
                  stData.rawStatus ||
                  "Task pembuatan video gagal di RunningHub.",
              );
            }
          }
        } catch (pollErr: any) {
          if (pollErr.message && pollErr.message.includes("gagal")) {
            throw pollErr;
          }
          console.warn("[RunningHub Poll Warn]:", pollErr.message);
        }
      }

      if (!finalVideoUrl) {
        throw new Error("Waktu tunggu render video habis (timeout) atau video belum siap.");
      }

      // Success: update message
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === aiMessageId
                    ? {
                        ...m,
                        content: `Video berhasil dibuat dengan model **${vidModelObj.name}**!`,
                        attachments: [
                          {
                            id: `att_vid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                            name: `video-${vidModelObj.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.mp4`,
                            url: finalVideoUrl,
                            playbackUrl: finalVideoUrl,
                            coverUrl: finalCoverUrl,
                            type: "video",
                            size: "AI Video",
                          },
                        ],
                        generatedVideo: {
                          status: "completed",
                          url: finalVideoUrl,
                          coverUrl: finalCoverUrl,
                          prompt: promptToSend,
                          aspectRatio: vidAspect,
                          duration: vidDuration,
                          resolution: vidResolution,
                          modelName: vidModelObj.name,
                          provider: isGemini ? "gemini" : "runninghub",
                          creditsUsed: vidModelObj.credits,
                          referenceImageUrl: refImageUrl,
                          referenceVideoUrl: refVideoUrl,
                        },
                      }
                    : m,
                ),
                updatedAt: new Date().toISOString(),
              }
            : s,
        ),
      );
    } catch (err: any) {
      console.error("[Video Generation Error]:", err);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === aiMessageId
                    ? {
                        ...m,
                        content: `⚠️ Gagal menghasilkan video: ${err.message || "Terjadi kesalahan sistem."}`,
                        isError: true,
                        generatedVideo: {
                          status: "failed",
                          errorMessage:
                            err.message ||
                            `Terjadi kendala saat memproses video di ${isGemini ? "Gemini Omni Flash" : "RunningHub AI"}.`,
                          prompt: promptToSend,
                          aspectRatio: vidAspect,
                          duration: vidDuration,
                          resolution: vidResolution,
                          modelName: vidModelObj.name,
                          provider: isGemini ? "gemini" : "runninghub",
                          creditsUsed: vidModelObj.credits,
                          referenceImageUrl: refImageUrl,
                          referenceVideoUrl: refVideoUrl,
                        },
                      }
                    : m,
                ),
                updatedAt: new Date().toISOString(),
              }
            : s,
        ),
      );
    } finally {
      geminiLease?.release();
    }
  };

  // Agentic Google Gemini Action Executor (Direct Google Imagen 3 Pro / Gemini Image / Veo Video)
  const handleExecuteGeminiAction = async (
    messageId: string,
    actionData: WeavyActionData,
    sessionId?: string,
  ) => {
    const targetSessionId = sessionId || currentSession.id;
    let activeAccount = currentGeminiAccount || geminiAccountsList[0] || null;
    let geminiLease: GeminiAccountLease | null = null;

    // Set message weavyAction status to 'loading'
    setSessions((prev) =>
      prev.map((s) =>
        s.id === targetSessionId
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      weavyAction: {
                        ...(m.weavyAction || actionData),
                        status: "loading" as const,
                        errorMessage: undefined,
                      },
                    }
                  : m,
              ),
              updatedAt: new Date().toISOString(),
            }
          : s,
      ),
    );

    try {
      geminiLease = await acquireGeminiAccountLease(1, activeAccount?.id, {
        onQueued: () => console.info('[Gemini Queue] Agent action menunggu akun tersedia.'),
      });
      activeAccount = geminiLease?.account || null;
      if (!activeAccount) {
        throw new Error('Tidak ada akun Gemini dengan kredit cukup dan sesi valid.');
      }

      const isVideo = actionData.isVideoPrompt || Boolean((actionData as any).isVideo);
      const endpoint = isVideo ? "/api/gemini/generate-video" : "/api/gemini/generate-image";

      const allRefImages: string[] = [];
      if (actionData.useReference) {
        if (Array.isArray(actionData.referenceImageUrls) && actionData.referenceImageUrls.length > 0) {
          allRefImages.push(...actionData.referenceImageUrls.filter(Boolean));
        } else if (actionData.referenceImageUrl) {
          allRefImages.push(actionData.referenceImageUrl);
        }
      }

      const payload = {
        prompt: actionData.prompt,
        aspectRatio: actionData.aspectRatio || (isVideo ? "16:9" : "9:16"),
        model: actionData.model || (isVideo ? "veo-3.1-generate-preview" : "imagen-3.0-generate-002"),
        id: activeAccount?.id,
        email: activeAccount?.email,
        name: activeAccount?.displayName || activeAccount?.name || activeAccount?.email,
        token: activeAccount?.token || activeAccount?.apiKey || "",
        apiKey: activeAccount?.apiKey,
        cookies: activeAccount?.token,
        referenceImageUrl: allRefImages[0] || undefined,
        referenceImageUrls: allRefImages,
      };

      let genData: any;
      let requestOk = true;
      if (isVideo) {
        const { videoUrl, operationName, remainingCredits } =
          await executeGeminiVideoWithAutoSwitchAndRetry({
            prompt: actionData.prompt,
            aspectRatio: actionData.aspectRatio || "16:9",
            duration: String((actionData as any).duration || "10s"),
            resolution: "1080p",
            model: actionData.model || "veo-3.1-generate-preview",
            referenceImageUrls: allRefImages,
            referenceVideoUrls: [],
            attachedMedia: allRefImages.map((url) => ({ type: "image", url })),
            accountPayload: {
              ...buildGeminiPayloadAccounts(activeAccount),
              fallbackAccounts: [],
            },
          });
        genData = {
          success: true,
          videoUrl,
          operationName,
          remainingCredits,
          usedAccount: activeAccount,
        };
      } else {
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        requestOk = resp.ok;
        genData = await resp.json().catch(() => ({}));
      }

      if (!requestOk || !genData.success) {
        // If exhaustedAccounts or refusal or quota is returned, immediately set matching accounts to 0 credits!
        const errText = genData.error || genData.errorMessage || genData.message || '';
        const isQuotaHit = Boolean(
          genData.isQuotaExhausted ||
          (Array.isArray(genData.exhaustedAccounts) && genData.exhaustedAccounts.length > 0) ||
          /mencapai kuota/i.test(errText) ||
          /tidak bisa membuatkan.*video/i.test(errText) ||
          /tidak bisa membuat.*video/i.test(errText) ||
          /kuota.*habis/i.test(errText) ||
          /lagi hari ini/i.test(errText) ||
          /batas kredit/i.test(errText)
        );

        if (isQuotaHit) {
          try {
            const raw = localStorage.getItem('gemini_accounts');
            if (raw) {
              const allGem = JSON.parse(raw);
              if (Array.isArray(allGem)) {
                const exIds = new Set<string>();
                const exEmails = new Set<string>();
                if (Array.isArray(genData.exhaustedAccounts)) {
                  for (const ex of genData.exhaustedAccounts) {
                    if (ex?.id) exIds.add(String(ex.id));
                    if (ex?.email) exEmails.add(String(ex.email).toLowerCase().trim());
                  }
                }
                if (activeAccount?.id) exIds.add(String(activeAccount.id));
                if (activeAccount?.email) exEmails.add(String(activeAccount.email).toLowerCase().trim());

                const updated = allGem.map((a: any) => {
                  const match = (a.id && exIds.has(String(a.id))) || (a.email && exEmails.has(String(a.email).toLowerCase().trim()));
                  return match ? { ...a, credits: 0, totalCredits: GEMINI_MAX_CREDITS } : a;
                });
                localStorage.setItem('gemini_accounts', JSON.stringify(updated));
                setGeminiAccountsList(updated);
                window.dispatchEvent(new Event('gemini_accounts_updated'));
                window.dispatchEvent(new Event('accounts-updated'));
              }
            }
          } catch (e) {}
        }

        // If Gemini has location or model restrictions and user has an active Weavy account, seamlessly fallback:
        const activeWeavy = currentWeavyAccount || weavyAccountsList[0] || null;
        if (activeWeavy && !isVideo) {
          console.log("[ChatView] Gemini Web Image restricted, seamlessly delegating to active Weavy AI account...");
          return handleExecuteWeavyAction(messageId, actionData, targetSessionId);
        }

        throw new Error(
          genData.error ||
          genData.message ||
          "Gagal memproses generasi media dengan Google Gemini.",
        );
      }

      let resultUrl = genData.imageUrl || genData.videoUrl;

      if (!resultUrl) {
        throw new Error(
          genData.error ||
          genData.errorMessage ||
          genData.message ||
          genData.text ||
          "Google Gemini selesai tanpa menghasilkan file media video/gambar."
        );
      }

      // Update remaining credits in localStorage
      if (typeof genData.remainingCredits === 'number') {
        try {
          const raw = localStorage.getItem('gemini_accounts');
          if (raw) {
            const accounts = JSON.parse(raw);
            if (Array.isArray(accounts)) {
              const updated = accounts.map((a: any) => {
                const isTarget =
                  (activeAccount?.id && a.id === activeAccount.id) ||
                  (activeAccount?.email && a.email && a.email.toLowerCase() === activeAccount.email.toLowerCase()) ||
                  a.isActive;
                if (isTarget) {
                  return {
                    ...a,
                    credits: genData.remainingCredits,
                    totalCredits: GEMINI_MAX_CREDITS,
                  };
                }
                return a;
              });
              localStorage.setItem('gemini_accounts', JSON.stringify(updated));
              window.dispatchEvent(new Event('gemini_accounts_updated'));
              window.dispatchEvent(new Event('accounts-updated'));
            }
          }
        } catch (e) {}
      }

      // Success: update message in session
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === messageId
                    ? {
                        ...m,
                        weavyAction: {
                          ...(m.weavyAction || actionData),
                          status: "completed" as const,
                          resultUrl,
                        },
                      }
                    : m,
                ),
                updatedAt: new Date().toISOString(),
              }
            : s,
        ),
      );
    } catch (err: any) {
      console.log("[ChatView Gemini Action notice]:", err.message || err);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === messageId
                    ? {
                        ...m,
                        weavyAction: {
                          ...(m.weavyAction || actionData),
                          status: "failed" as const,
                          errorMessage:
                            err.message ||
                            "Gagal memproses gambar/video dengan akun Google Gemini kamu.",
                        },
                      }
                    : m,
                ),
                updatedAt: new Date().toISOString(),
              }
            : s,
        ),
      );
    } finally {
      geminiLease?.release();
    }
  };

  // Agentic Weavy Action Executor
  const handleExecuteWeavyAction = async (
    messageId: string,
    actionData: WeavyActionData,
    sessionId?: string,
  ) => {
    const targetSessionId = sessionId || currentSession.id;
    const activeAccount = currentWeavyAccount || weavyAccountsList[0] || null;
    if (!activeAccount) {
      alert("Silakan hubungkan atau pilih akun Weavy aktif terlebih dahulu.");
      return;
    }

    // Set message weavyAction status to 'loading'
    setSessions((prev) =>
      prev.map((s) =>
        s.id === targetSessionId
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      weavyAction: {
                        ...(m.weavyAction || actionData),
                        status: "loading" as const,
                        errorMessage: undefined,
                      },
                    }
                  : m,
              ),
              updatedAt: new Date().toISOString(),
            }
          : s,
      ),
    );

    try {
      // Resolve friendly model name
      const friendlyModel = normalizeWeavyModelName(actionData.model);

      // Collect all reference images
      const allRefImages: string[] = [];
      if (actionData.useReference) {
        if (
          Array.isArray(actionData.referenceImageUrls) &&
          actionData.referenceImageUrls.length > 0
        ) {
          allRefImages.push(...actionData.referenceImageUrls.filter(Boolean));
        } else if (actionData.referenceImageUrl) {
          allRefImages.push(actionData.referenceImageUrl);
        }
      }
      const uniqueRefImages = Array.from(new Set(allRefImages));

      const payload = {
        refreshToken: activeAccount.refreshToken || "",
        idToken: activeAccount.idToken || "",
        prompt: actionData.prompt,
        mode: "image",
        model: friendlyModel,
        quality: "high",
        aspect_ratio: actionData.aspectRatio || "9:16",
        resolution: "1080p",
        image_url: uniqueRefImages.length > 0 ? uniqueRefImages[0] : undefined,
        images: uniqueRefImages.length > 0 ? uniqueRefImages : undefined,
        attached_media: uniqueRefImages.map((u) => ({ url: u, type: "image" })),
      };

      // Execute via Extension Bridge or Server Proxy with automatic 403 bypass
      const genData = await extensionBridge.generateWeavy(payload);
      if (!genData || !genData.success) {
        throw new Error(
          genData?.error ||
            "Gagal mengirim tugas generasi gambar ke server Weavy.",
        );
      }

      const taskId = genData.taskId || genData.batchId;
      const recipeId = genData.recipeId;

      // Reusable polling helper with automatic bridge fallback
      const resultUrl = await pollWeavyTaskStatus({
        taskId,
        recipeId,
        refreshToken: activeAccount.refreshToken || "",
        idToken: activeAccount.idToken || "",
        maxAttempts: 50,
        pollInterval: 2500,
        onCreditUpdate: (returnedCredits) => {
          const updated = updateWeavyAccountCreditsInStorage(
            { id: activeAccount.id, email: activeAccount.email },
            returnedCredits,
          );
          if (updated.length > 0) setWeavyAccountsList(updated);
        },
      });

      // Success: update message in session
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === messageId
                    ? {
                        ...m,
                        weavyAction: {
                          ...(m.weavyAction || actionData),
                          status: "completed" as const,
                          resultUrl,
                        },
                      }
                    : m,
                ),
                updatedAt: new Date().toISOString(),
              }
            : s,
        ),
      );

      // Refresh credits
      if (activeAccount.refreshToken) {
        handleSyncAccountCredits(activeAccount);
      }
    } catch (err: any) {
      console.error("[Execute Weavy Action Error]:", err);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === messageId
                    ? {
                        ...m,
                        weavyAction: {
                          ...(m.weavyAction || actionData),
                          status: "failed" as const,
                          errorMessage:
                            err.message ||
                            "Terjadi kendala saat memproses gambar di Weavy.",
                        },
                      }
                    : m,
                ),
                updatedAt: new Date().toISOString(),
              }
            : s,
        ),
      );
    }
  };

  // Send Message
  const handleSendMessage = async () => {
    if (attachments.some((a) => Boolean(a.isUploading))) {
      return;
    }
    if (attachments.some((a) => Boolean(a.uploadError))) {
      alert("Ada media yang gagal diunggah. Silakan klik 'Ulangi' pada lampiran atau hapus lampiran tersebut.");
      return;
    }

    // Route to dedicated generators if mode is video or image (supports both Gemini Veo and Weavy/RunningHub)
    if (chatMode === "video") {
      await handleGenerateVideo();
      return;
    }
    if (chatMode === "image") {
      await handleGenerateImage();
      return;
    }

    const targetSessionId = currentSession.id;
    const trimmed = inputText.trim();
    if ((!trimmed && attachments.length === 0) || loadingSessionIds[targetSessionId]) return;

    const isGemini = selectedChatProvider === "gemini";
    const activeAccount = isGemini
      ? currentGeminiAccount
      : (currentWeavyAccount || weavyAccountsList[0] || null);

    if (isGemini && !activeAccount) {
      alert(
        "Silakan hubungkan akun Google Gemini milikmu (cURL / Cookie Sesi) di menu Pengaturan (Settings) terlebih dahulu agar chat 100% menggunakan akun yang kamu tambahkan.",
      );
      return;
    }

    if (!isGemini && !activeAccount) {
      alert(
        "Silakan hubungkan atau pilih akun Weavy aktif terlebih dahulu di sidebar kiri atau Pengaturan agar model AI Weavy dapat digunakan.",
      );
      return;
    }

    // Intercept /download TikTok slash command (matching ektension-weavy downloader)
    if (trimmed.toLowerCase().startsWith("/download")) {
      const urlMatch = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
      const userMessage: ChatMessage = {
        id: `msg_user_${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        attachments: [...attachments],
      };

      if (!urlMatch) {
        const assistantMessage: ChatMessage = {
          id: `msg_ai_${Date.now()}`,
          role: "assistant",
          content: `📥 **TikTok Video Downloader**\n\nSilakan sertakan tautan (link) video TikTok yang ingin diunduh tanpa watermark.\n\n**Format Penggunaan:**\n\`/download <link_video_tiktok>\`\n\n**Contoh:**\n\`/download https://vt.tiktok.com/ZSbJjLEc9\``,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          modelDisplayName: "TikTok Downloader",
        };

        setSessions((prev) =>
          prev.map((s) =>
            s.id === targetSessionId
              ? {
                  ...s,
                  messages: [...s.messages, userMessage, assistantMessage],
                  updatedAt: new Date().toISOString(),
                }
              : s
          )
        );
        setInputText("");
        setAttachments([]);
        return;
      }

      const targetUrl = urlMatch[0];
      const assistantPlaceholderId = `msg_ai_${Date.now()}`;
      const placeholderAssistant: ChatMessage = {
        id: assistantPlaceholderId,
        role: "assistant",
        content: "⏳ *Sedang mengambil data video TikTok tanpa watermark...*",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        modelDisplayName: "TikTok Downloader",
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: [...s.messages, userMessage, placeholderAssistant],
                updatedAt: new Date().toISOString(),
              }
            : s
        )
      );
      setInputText("");
      setAttachments([]);
      setLoadingSessionIds((prev) => ({ ...prev, [targetSessionId]: true }));

      try {
        const resp = await fetch(`/api/tiktok/info?url=${encodeURIComponent(targetUrl)}`);
        const json = await resp.json();
        if (json.success && json.data) {
          const v = json.data;
          const content = `📥 **TikTok Video Siap Diunduh (Tanpa Watermark)**\n\n👤 **Kreator:** ${v.author?.nickname || "TikTok Creator"} (@${v.author?.unique_id || ""})\n🎬 **Judul:** ${v.title || "TikTok Video"}\n⏱️ **Durasi:** ${v.duration || 0} detik\n👁️ **Statistik:** ${(v.stats?.play_count || 0).toLocaleString()} views • ${(v.stats?.digg_count || 0).toLocaleString()} likes • ${(v.stats?.share_count || 0).toLocaleString()} shares\n\n🔗 **Tautan Langsung:**\n- [🎬 Download Video MP4 (No Watermark)](${v.downloadUrl})\n- [🎵 Download Musik Audio (MP3)](${v.downloadMusicUrl})\n- [🖼️ Download Thumbnail Cover HD](${v.downloadCoverUrl})`;

          const resultAssistant: ChatMessage = {
            id: assistantPlaceholderId,
            role: "assistant",
            content,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            modelDisplayName: "TikTok Downloader",
            generatedVideo: {
              url: v.downloadUrl,
              prompt: v.title,
              aspectRatio: "9:16",
              status: "completed",
            },
          };

          setSessions((prev) =>
            prev.map((s) =>
              s.id === targetSessionId
                ? {
                    ...s,
                    messages: s.messages.map((m) => (m.id === assistantPlaceholderId ? resultAssistant : m)),
                    updatedAt: new Date().toISOString(),
                  }
                : s
            )
          );
        } else {
          throw new Error(json.error || "Gagal mengambil video TikTok.");
        }
      } catch (err: any) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === targetSessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === assistantPlaceholderId
                      ? {
                          ...m,
                          content: `❌ **Gagal Mengunduh Video TikTok**\n\n${err?.message || "Pastikan link TikTok valid dan video bersifat publik."}`,
                        }
                      : m
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : s
          )
        );
      } finally {
        setLoadingSessionIds((prev) => ({ ...prev, [targetSessionId]: false }));
      }
      return;
    }

    // Expand slash command if present (e.g. /ugc or /clean)
    const { expandedText, detectedCommand } = expandSlashCommands(trimmed);

    // If a slash command is used, optionally adapt aspect ratio
    if (detectedCommand && detectedCommand.recommendedAspect) {
      setSelectedAspectRatio(detectedCommand.recommendedAspect);
    }

    // Detect e-commerce and TikTok product links
    const ecomLinks = detectEcommerceProductLinks(trimmed);
    let scrapingContext = "";
    let detectedProducts: any[] = [];
    let initialUserAttachments: ChatAttachment[] = [...attachments];

    const assistantMessageId = `msg_ai_${Date.now()}`;
    const userMessageId = `msg_user_${Date.now()}`;

    // Auto update title if this is the first message
    const updatedTitle =
      currentSession.messages.length === 0 && trimmed
        ? detectedCommand
          ? `${detectedCommand.command} ${detectedCommand.name}`
          : trimmed.length > 28
            ? `${trimmed.substring(0, 28)}...`
            : trimmed
        : currentSession.title;

    const initialUserMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      attachments: [...initialUserAttachments],
    };

    const initialAssistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: ecomLinks && ecomLinks.length > 0 ? "⏳ *AI Worker Aktif: Sedang mengekstrak data produk TikTok & visual...*" : "",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      model: selectedModel,
      modelDisplayName: activeModelObj.name,
      attachments: undefined,
    };

    // Optimistically update UI
    setSessions((prev) =>
      prev.map((s) =>
        s.id === targetSessionId
          ? {
              ...s,
              title: updatedTitle,
              messages: [...s.messages, initialUserMessage, initialAssistantMessage],
              updatedAt: new Date().toISOString(),
              model: selectedModel,
              mode: chatMode,
            }
          : s,
      ),
    );

    // Clear input & attachments
    setInputText("");
    setAttachments([]);
    setLoadingSessionIds((prev) => ({ ...prev, [targetSessionId]: true }));

    // Execute AI Worker extraction if e-commerce / TikTok links are present
    if (ecomLinks && ecomLinks.length > 0) {
      try {
        const enrichedLinks = await resolveLinksMetadata(ecomLinks);
        scrapingContext = formatScrapingContext(enrichedLinks);

        enrichedLinks.forEach((l) => {
          if (l.metadata) {
            detectedProducts.push({
              title: l.metadata.title,
              author_name: l.metadata.author_name,
              author_url: l.metadata.author_url,
              url: l.url,
              platform: l.platform,
              thumbnail_url: l.metadata.thumbnail_url,
              description: l.metadata.description,
              price: l.metadata.price,
              usps: l.metadata.usps || [],
              images: l.metadata.images || [],
            });
          }
        });

        // Auto extract high-res product photos to chat attachments
        const candidateImgs: ChatAttachment[] = [];
        enrichedLinks.forEach((l) => {
          if (l.metadata?.images && l.metadata.images.length > 0) {
            l.metadata.images.forEach((imgObj, i) => {
              const u = typeof imgObj === "string" ? imgObj : imgObj.url;
              if (u && !candidateImgs.some((c) => c.url === u)) {
                candidateImgs.push({
                  id: `prod_att_${Date.now()}_${i}`,
                  name: (typeof imgObj === "object" && imgObj.title) || `Foto Produk ${i + 1}`,
                  url: u,
                  type: "image",
                  referenceRole: "product",
                });
              }
            });
          } else if (l.metadata?.thumbnail_url) {
            candidateImgs.push({
              id: `prod_att_${Date.now()}`,
              name: `Cover Produk (${l.metadata.author_name || "TikTok"})`,
              url: l.metadata.thumbnail_url,
              type: "image",
              referenceRole: "product",
            });
          }
        });

        const validImgs = await filterValidImageObjects(candidateImgs, 3000);
        validImgs.forEach((v) => {
          if (!initialUserAttachments.some((a) => a.url === v.url)) {
            initialUserAttachments.push(v);
          }
        });

        // Update user message with extracted products and images
        setSessions((prev) =>
          prev.map((s) =>
            s.id === targetSessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === userMessageId
                      ? {
                          ...m,
                          attachments: [...initialUserAttachments],
                          extractedProducts: detectedProducts.length > 0 ? detectedProducts : undefined,
                        }
                      : m.id === assistantMessageId
                      ? {
                          ...m,
                          content: "",
                        }
                      : m
                  ),
                }
              : s
          )
        );
      } catch (workerErr) {
        console.warn("[AI Worker Scraper Warn]:", workerErr);
      }
    }

    const finalUserMessage: ChatMessage = {
      ...initialUserMessage,
      attachments: initialUserAttachments,
      extractedProducts: detectedProducts.length > 0 ? detectedProducts : undefined,
    };

    const updatedMessages = [...currentSession.messages, finalUserMessage];

    // Data hasil riset AI Worker (scraping) dikirim sebagai section TERPISAH di
    // system prompt (blok product_card) - JANGAN diduplikasi di user prompt.
    // Parity dengan ekstensi: teks user TIDAK PERNAH diganti template, jadi
    // instruksi asli (mis. "shot 3 produk ini, 20 detik") tetap dihormati.
    const userPromptWithContext = detectedCommand ? expandedText : trimmed;

    // --- Agent V1 (parity dengan ektension-weavy) ---
    //
    // Master Director prompt + kontrak storyboard + Project Memory + pruning
    // riwayat + katalog media disamakan dengan logika Agent V1 di ekstensi agar
    // kualitas keluaran Weavy (terutama blok storyboard_project) tidak degrade.
    //
    // Revisi storyboard: kalau ada storyboard yang sudah disepakati di sesi ini dan
    // user memberi instruksi lanjutan ("shot ...", "tambah adegan ..."), perlakukan
    // sebagai REVISI atas storyboard itu - bukan bikin ulang dari nol.
    const existingStoryboardProject = findLatestStoryboardProject(updatedMessages);

    // Storyboard Copilot mode: toggle persisten per sesi ATAU slash command.
    // Sama seperti ektension (isStoryboardCopilotActive di context-builder).
    const isCopilotSlashCommand = [
      "/customstoryboard",
      "/copilotstoryboard",
      "/storyboardcopilot",
    ].some((cmd) => trimmed.toLowerCase().startsWith(cmd));
    // Ekstensi mengecualikan /harvestpov dari Storyboard Copilot mode.
    const lowerTrimmed = trimmed.toLowerCase();
    const isHarvestPovCommand =
      lowerTrimmed.startsWith("/harvestpov") &&
      (lowerTrimmed.length === 12 || !/[a-z0-9]/i.test(lowerTrimmed[12]));
    const isStoryboardCopilotActive =
      !isHarvestPovCommand && (isStoryboardCopilotEnabled || isCopilotSlashCommand);

    try {
      const currentSessionImages = getAllSessionImages(updatedMessages);      const currentSessionVideos = getAllSessionVideos(updatedMessages);

      let streamBuffer = "";
      let accumulatedText = "";
      let streamGeneratedVideo: any = undefined;
      let streamGeneratedImage: any = undefined;
      let streamAttachments: ChatAttachment[] | undefined = undefined;
      let streamWeavyAction: any = undefined;
      let streamConversationId = currentSession.geminiConversationId;
      let streamResponseId = currentSession.geminiResponseId;
      let streamChoiceId = currentSession.geminiChoiceId;
      let streamTokens: number | undefined = undefined;
      let streamRemainingCredits: number | null = null;

      const isBridgeReady = !isGemini && await extensionBridge.waitForConnection(4000);

      if (!isGemini && !isBridgeReady) {
        throw new Error("Ekstensi Weavy belum terhubung. Aktifkan ekstensi Weavy AI lalu muat ulang halaman sebelum mengirim chat.");
      }

      if (isBridgeReady) {
        // The extension owns prompt expansion, context selection, and Weavy execution.
        const bridgeChatRes = await extensionBridge.executeWeavyChatFromExtension({
          session: {
            ...currentSession,
            messages: updatedMessages,
            metadata: currentSession.metadata || {},
          },
          userMsg: {
            ...finalUserMessage,
            content: trimmed,
          },
          model: selectedModel,
          isStoryboardCopilotActive,
          quickPresetEnabled: isQuickPresetEnabled,
          scrapingContext: scrapingContext || undefined,
          refreshToken: activeAccount?.refreshToken || "",
          idToken: activeAccount?.idToken || "",
        });

        if (!bridgeChatRes || !bridgeChatRes.success) {
          throw new Error(bridgeChatRes?.error || "Gagal memproses chat via Ekstensi Weavy.");
        }

        accumulatedText = bridgeChatRes.text || "";
        if (bridgeChatRes.metadata) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === targetSessionId
                ? {
                    ...s,
                    metadata: {
                      ...(s.metadata || {}),
                      ...bridgeChatRes.metadata,
                      storyboardCopilotEnabled: isStoryboardCopilotEnabled,
                    },
                  }
                : s,
            ),
          );
        }
        if (typeof bridgeChatRes.remainingCredits === "number") {
          streamRemainingCredits = bridgeChatRes.remainingCredits;
        }
      } else {
        // Gemini tetap memakai jalur SSE yang sudah ada. Chat Weavy wajib melalui ekstensi.
        const response = await fetch("/api/chat-stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: selectedChatProvider,
              messages: updatedMessages.map((m, idx) => ({
                    role: m.role,
                    content:
                      idx === updatedMessages.length - 1
                        ? userPromptWithContext
                        : m.content,
                    attachments: m.attachments?.map((a) => ({
                      url: a.url,
                      base64: a.base64,
                      type: a.type,
                      name: a.name,
                      playbackUrl: a.playbackUrl,
                      coverUrl: a.coverUrl,
                      duration: a.duration,
                      sourceUrl: a.sourceUrl,
                      fallbackNote: a.fallbackNote,
                      author: a.author,
                      title: a.title,
                      videoIndex: a.videoIndex,
                    })),
                    generatedImage: m.generatedImage,
                    generatedVideo: m.generatedVideo,
                    weavyAction: m.weavyAction,
                    repostMedia: m.repostMedia,
                  })),
              sessionImages: currentSessionImages,
              sessionVideos: currentSessionVideos,
              images: (finalUserMessage.attachments || [])
                .filter((a) => a.type === "image" && (a.url || a.base64))
                .map((a) => (a.url || a.base64)!),
              model: selectedModel,
              mode: chatMode,
              thinking: false,
              noInjection: true,
              isNewChat: currentSession.messages.length === 0,
              sessionId: targetSessionId,
              geminiConversationId: currentSession.geminiConversationId,
              geminiResponseId: currentSession.geminiResponseId,
              geminiChoiceId: currentSession.geminiChoiceId,
              token: activeAccount?.cookies || activeAccount?.token || activeAccount?.refreshToken || "",
              cookies: activeAccount?.cookies || activeAccount?.token || activeAccount?.refreshToken || "",
              email: activeAccount?.email || "",
              accountId: activeAccount?.id || "",
              accountName: activeAccount?.displayName || activeAccount?.name || activeAccount?.email || "",
              allGeminiAccounts: geminiAccountsList,
              refreshToken: activeAccount?.refreshToken || "",
              idToken: activeAccount?.idToken || "",
              allRefreshTokens: [
                activeAccount?.refreshToken,
                ...weavyAccountsList
                  .filter((a: any) => a.id !== activeAccount?.id && (typeof a.credits !== "number" || a.credits > 0))
                  .map((a: any) => a.refreshToken)
              ].filter((t): t is string => typeof t === "string" && Boolean(t.trim())),
            }),
          });

        if (response && (!response.ok || !response.body)) {
          const errorText = await response.text().catch(() => "");
          let cleanErr = errorText;
          try {
            const parsed = JSON.parse(errorText);
            cleanErr = parsed.error || parsed.message || errorText;
          } catch {}

          throw new Error(cleanErr || `Gagal menghubungi server AI (${response.status})`);
        } else if (response.body) {
          // Read real-time SSE stream directly from Gemini Web
          const reader = response.body.getReader();
          const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split("\n");
        streamBuffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith("data:")) continue;
          const jsonStr = trimmedLine.replace(/^data:\s*/, "");
          if (!jsonStr) continue;

          try {
            const evt = JSON.parse(jsonStr);

            if (evt.type === "chunk") {
              // If we already accumulated meaningful text (> 80 chars), never let a short canned refusal frame overwrite it
              if (accumulatedText.length > 80 && evt.fullText && evt.fullText.length < 120 && /hanya model bahasa|tidak bisa membantu/i.test(evt.fullText)) {
                console.warn("[Chat Stream] Ignored trailing refusal chunk because substantive response was already received.");
              } else {
                accumulatedText = evt.fullText !== undefined ? evt.fullText : (accumulatedText + (evt.text || ""));
                setSessions((prev) =>
                  prev.map((s) =>
                    s.id === targetSessionId
                      ? {
                          ...s,
                          messages: s.messages.map((m) =>
                            m.id === assistantMessageId
                              ? { ...m, content: accumulatedText }
                              : m
                          ),
                        }
                      : s
                  )
                );
              }
            } else if (evt.type === "video" && evt.video) {
              streamGeneratedVideo = evt.video;
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === targetSessionId
                    ? {
                        ...s,
                        messages: s.messages.map((m) =>
                          m.id === assistantMessageId
                            ? {
                                ...m,
                                generatedVideo: evt.video,
                                content: m.content || evt.fullText || "Video berhasil dibuat!",
                              }
                            : m
                        ),
                      }
                    : s
                )
              );
            } else if (evt.type === "status" && !accumulatedText.trim()) {
              setSessions((prev) =>
                prev.map((s) =>
                    s.id === targetSessionId
                      ? {
                          ...s,
                          messages: s.messages.map((m) =>
                            m.id === assistantMessageId
                              ? { ...m, content: `⏳ ${evt.text || "Menunggu respons..."}` }
                              : m
                          ),
                        }
                      : s
                )
              );
            } else if (evt.type === "error") {
              if (accumulatedText && accumulatedText.trim().length > 60) {
                console.warn("Stream error notification received, but preserving already accumulated response:", evt.error);
                break;
              }
              throw new Error(evt.error);
            } else if (evt.type === "done") {
              if (evt.fullText) {
                if (accumulatedText.length > 80 && evt.fullText.length < 120 && /hanya model bahasa|tidak bisa membantu/i.test(evt.fullText)) {
                  console.warn("[Chat Stream] Preserved accumulated text over trailing done refusal.");
                } else {
                  accumulatedText = evt.fullText;
                }
              }
              if (evt.geminiConversationId) streamConversationId = evt.geminiConversationId;
              if (evt.geminiResponseId) streamResponseId = evt.geminiResponseId;
              if (evt.geminiChoiceId) streamChoiceId = evt.geminiChoiceId;
              if (evt.tokens !== undefined) streamTokens = evt.tokens;
              if (evt.remainingCredits !== undefined) streamRemainingCredits = evt.remainingCredits;
              if (evt.attachments) {
                streamAttachments = evt.attachments.map((a: any, i: number) => ({
                  id: a.id || `att_ai_${Date.now()}_${i}`,
                  name: a.name || (a.type === "video" ? `Video Asli #${i + 1}.mp4` : `Foto Produk #${i + 1}`),
                  url: a.url,
                  type: a.type || "image",
                  playbackUrl: a.playbackUrl || (a.type === "video" ? a.url : undefined),
                  coverUrl: a.coverUrl,
                  duration: a.duration,
                  fallbackNote: a.fallbackNote,
                  sourceUrl: a.sourceUrl,
                  author: a.author,
                  title: a.title,
                  videoIndex: a.videoIndex,
                }));
              }
              if (evt.weavyAction) streamWeavyAction = evt.weavyAction;
            }
          } catch (e: any) {
            if (e.message && e.message !== "Unexpected end of JSON input") {
              throw e;
            }
          }
        }
      }
      }
      }

      // If Weavy returned updated credits, sync accounts in localStorage & state
      if (typeof streamRemainingCredits === "number" && activeAccount) {
        const updated = updateWeavyAccountCreditsInStorage(
          { id: activeAccount.id, email: activeAccount.email },
          streamRemainingCredits,
        );
        if (updated.length > 0) setWeavyAccountsList(updated);
      }

      // 1. Extract repostMedia first (if user asked for previous images or AI attached weavy_repost)
      const {
        cleanContent: repostCleanText,
        repostMedia: extractedRepost,
      } = extractWeavyRepostFromMessage(
        accumulatedText || "",
        trimmed,
        currentSessionImages,
      );

      // 2. Extract weavyAction (image generation) only if NOT a media repost
      let finalContent = repostCleanText;
      let finalExtractedAction: WeavyActionData | null = streamWeavyAction || null;
      let finalShouldAutoExecute = false;
      const hasGeneratedImageAttachment = streamAttachments?.some((attachment) => attachment.type === "image");

      if (!extractedRepost && !finalExtractedAction && !hasGeneratedImageAttachment) {
        const actionResult = extractWeavyActionFromMessage(
          repostCleanText,
          trimmed,
          attachments,
          updatedMessages,
        );
        finalContent = actionResult.cleanContent;
        finalExtractedAction = actionResult.action;
        finalShouldAutoExecute = actionResult.shouldAutoExecute;
      }

      // 3. Merge lokal Storyboard Copilot (field-level per scene) - parity dengan
      // applyStoryboardCopilotSceneUpdate di ekstensi. Kalau model mengirim aksi
      // `update_scenes`, patch digabung ke storyboard yang sudah disepakati.
      if (!extractedRepost && !finalExtractedAction) {
        const merged = postProcessWeavyResponse({
          responseText: finalContent,
          existingProject: existingStoryboardProject,
        });
        if (merged.mergedProject) {
          finalContent = merged.content;
        }
      }

      // Check if response is a canned refusal or empty from Gemini when product data was extracted
      const isCannedRefusal = Boolean(
        finalContent &&
        finalContent.length < 150 &&
        (/hanya model bahasa/i.test(finalContent) || /tidak bisa membantu/i.test(finalContent) || /language model/i.test(finalContent))
      );

      if ((isCannedRefusal || !finalContent || finalContent.trim().length === 0) && detectedProducts.length > 0) {
        console.warn("[AI Worker Fallback] Canned refusal or empty response detected. Generating structured product strategy fallback...");
        finalContent = generateProductAnalysisFallback(detectedProducts[0]);
        accumulatedText = finalContent;
      }

      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: s.messages.map((m) => {
                  if (m.id === assistantMessageId) {
                    return {
                      ...m,
                      content: finalContent || accumulatedText || "Respon selesai.",
                      attachments: streamAttachments || m.attachments,
                      generatedVideo: streamGeneratedVideo || m.generatedVideo,
                      generatedImage: streamGeneratedImage || m.generatedImage,
                      tokens: streamTokens || m.tokens,
                      weavyAction: finalExtractedAction || undefined,
                      repostMedia: extractedRepost || undefined,
                    };
                  }
                  if (m.id === userMessageId && (!m.attachments || m.attachments.length === 0) && streamAttachments && streamAttachments.length > 0) {
                    return {
                      ...m,
                      attachments: streamAttachments.filter((att) => att.type === "image"),
                    };
                  }
                  return m;
                }),
                geminiConversationId: streamConversationId || s.geminiConversationId,
                geminiResponseId: streamResponseId || s.geminiResponseId,
                geminiChoiceId: streamChoiceId || s.geminiChoiceId,
                updatedAt: new Date().toISOString(),
              }
            : s,
        ),
      );

      // Auto-trigger Image Generation if requested by user (only for new generation, NOT repost)
      if (finalExtractedAction && finalShouldAutoExecute && !extractedRepost) {
        if (selectedChatProvider === "gemini") {
          handleExecuteGeminiAction(
            assistantMessageId,
            finalExtractedAction,
            targetSessionId,
          );
        } else {
          handleExecuteWeavyAction(
            assistantMessageId,
            finalExtractedAction,
            targetSessionId,
          );
        }
      }
    } catch (err: any) {
      console.error("Chat Error:", err);
      // 100% genuine error from Gemini Web displayed in the assistant message
      const exactErrorText = err.message || "Koneksi terputus saat memproses permintaan.";
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: s.messages.some((m) => m.id === assistantMessageId)
                  ? s.messages.map((m) =>
                      m.id === assistantMessageId
                        ? {
                            ...m,
                            content: m.content && m.content.trim().length > 60 && !m.content.startsWith("❌") ? m.content : `❌ ${exactErrorText}`,
                            isError: !m.content || m.content.trim().length <= 60 || m.content.startsWith("❌"),
                          }
                        : m
                    )
                  : [
                      ...s.messages,
                      {
                        id: `msg_err_${Date.now()}`,
                        role: "assistant" as const,
                        content: `❌ ${exactErrorText}`,
                        timestamp: new Date().toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                        isError: true,
                      },
                    ],
                updatedAt: new Date().toISOString(),
              }
            : s,
        ),
      );
    } finally {
      setLoadingSessionIds((prev) => {
        const next = { ...prev };
        delete next[targetSessionId];
        return next;
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Priority 1: Handle @ Mention autocomplete menu navigation
    if (showMentionMenu && mentionMatch && mentionMatch.filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev + 1) % mentionMatch.filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex(
          (prev) => (prev - 1 + mentionMatch.filtered.length) % mentionMatch.filtered.length
        );
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        const chosen =
          mentionMatch.filtered[selectedMentionIndex] || mentionMatch.filtered[0];
        if (chosen) {
          applyImageMention(chosen.tag);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        const textBeforeAt = inputText.slice(0, mentionMatch.atIndex);
        setInputText(textBeforeAt);
        return;
      }
    }

    // Priority 2: Handle / Slash commands autocomplete menu navigation
    if (showSlashMenu && filteredSlashCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev + 1) % filteredSlashCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev - 1 + filteredSlashCommands.length) % filteredSlashCommands.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        const chosen = filteredSlashCommands[selectedSlashIndex] || filteredSlashCommands[0];
        if (chosen) {
          applySlashCommand(chosen);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setInputText("");
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isAnyAttachmentUploading) {
        return;
      }
      if (isAnyAttachmentError) {
        return;
      }
      handleSendMessage();
    }
  };

  const copyToClipboard = (
    text: string,
    msgId: string,
    clean: boolean = true,
  ) => {
    const textToCopy = clean ? cleanPlainText(text) : text;
    navigator.clipboard.writeText(textToCopy);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const toggleThinking = (msgId: string) => {
    setExpandedThinking((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  // Upload guard & progress status
  const isAnyAttachmentUploading = useMemo(
    () => attachments.some((a) => Boolean(a.isUploading)),
    [attachments]
  );
  const isAnyAttachmentError = useMemo(
    () => attachments.some((a) => Boolean(a.uploadError)),
    [attachments]
  );
  const uploadingAttachments = useMemo(
    () => attachments.filter((a) => Boolean(a.isUploading)),
    [attachments]
  );
  const avgUploadProgress = useMemo(
    () =>
      uploadingAttachments.length > 0
        ? Math.round(
            uploadingAttachments.reduce(
              (acc, a) => acc + (a.uploadProgress || 0),
              0
            ) / uploadingAttachments.length
          )
        : 0,
    [uploadingAttachments]
  );

  const hasContent = inputText.trim().length > 0 || attachments.length > 0;

  return (
    <div className={`chat-root ${isDarkMode ? "" : "chat-light"} w-full h-[100dvh] max-h-[100dvh] bg-[#111114] text-stone-100 flex flex-col overflow-hidden font-sans overscroll-none`}>
      {/* Top Floating / Fixed Navigation Bar (Canvas-Style Elegance, Mobile-Responsive) */}
      <header className="h-14 border-b border-white/10 bg-[#141418] px-2.5 sm:px-5 flex items-center justify-between shrink-0 z-30 select-none">
        {/* Left Controls: Icon Kembali (tanpa teks & border kapsul) + Panel Toggle seamless */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all cursor-pointer shrink-0"
              title="Kembali"
              aria-label="Kembali"
            >
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
          )}

          {/* Toggle Sidebar Button - Seamless Icon Button */}
          <button
            type="button"
            onClick={() => setIsHistorySidebarOpen((prev) => !prev)}
            className={`p-2 rounded-lg transition-all cursor-pointer relative shrink-0 active:scale-95 ${
              isHistorySidebarOpen
                ? "text-amber-400 hover:text-amber-300 hover:bg-white/5"
                : "text-stone-400 hover:text-white hover:bg-white/5"
            }`}
            title={
              isHistorySidebarOpen
                ? "Tutup Panel Menu & Riwayat"
                : "Buka Panel Menu & Riwayat"
            }
            aria-label={
              isHistorySidebarOpen
                ? "Tutup Panel Menu & Riwayat"
                : "Buka Panel Menu & Riwayat"
            }
          >
            <PanelLeft className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Center: Current Chat Session Title */}
        <div className="flex-1 min-w-0 px-2 sm:px-4 text-center sm:text-left flex items-center gap-2">
          <span
            title={currentSession?.title || "AI Chat & Copilot"}
            className="text-xs sm:text-sm font-semibold text-stone-200 truncate max-w-[140px] xs:max-w-[200px] sm:max-w-xs md:max-w-md"
          >
            {currentSession?.title || "AI Chat & Copilot"}
          </span>
          {isCurrentSessionLoading && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" title="AI sedang memproses..." />
          )}
        </div>

        {/* Right Controls: Quick New Chat + Weavy Account & Credit Pill */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Quick New Chat Button — disembunyikan di desktop saat tab Riwayat terbuka agar tidak dobel dengan tombol di sidebar */}
          <button
            type="button"
            onClick={handleCreateNewChat}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-semibold active:scale-95 transition-all cursor-pointer ${
              isHistorySidebarOpen && sidebarTab === "history" ? "md:hidden" : ""
            }`}
            title="Mulai obrolan baru"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Chat Baru</span>
          </button>

          {/* Active Provider Account & Credit Display in Header */}
          {currentActiveAccount && (
            <div className="flex items-stretch rounded-lg border border-white/10 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setIsHistorySidebarOpen(true);
                  setSidebarTab("accounts");
                }}
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-xs text-stone-200 transition-all cursor-pointer"
                title={`Buka daftar akun ${selectedChatProvider === "gemini" ? "Google Gemini" : "Weavy"}`}
              >
                <div
                  className={`w-4 h-4 rounded-full font-bold text-[9px] flex items-center justify-center shrink-0 ${
                    selectedChatProvider === "gemini"
                      ? "bg-blue-500 text-white"
                      : "bg-amber-500 text-stone-950"
                  }`}
                >
                  {(
                    currentActiveAccount.name ||
                    currentActiveAccount.displayName ||
                    currentActiveAccount.email ||
                    (selectedChatProvider === "gemini" ? "G" : "W")
                  )
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <span className="hidden md:inline truncate max-w-[90px] text-xs font-medium">
                  {currentActiveAccount.name ||
                    currentActiveAccount.displayName ||
                    (currentActiveAccount.email
                      ? currentActiveAccount.email.split("@")[0]
                      : selectedChatProvider === "gemini"
                        ? "Gemini"
                        : "Weavy")}
                </span>
                <ChevronDown className="w-3 h-3 text-stone-400" />
              </button>

              <button
                type="button"
                onClick={(e) =>
                  handleSyncAccountCredits(currentActiveAccount, e)
                }
                disabled={syncingAccountId === currentActiveAccount.id}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 border-l border-white/10 text-xs font-semibold transition-all cursor-pointer group select-none ${
                  selectedChatProvider === "gemini"
                    ? "bg-blue-500/10 hover:bg-blue-500/20 text-blue-300"
                    : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300"
                }`}
                title={`Status/Kredit akun aktif (${currentActiveAccount.email || currentActiveAccount.name || "Akun"}). Klik untuk sinkronisasi.`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    selectedChatProvider === "gemini" ? "bg-blue-400" : "bg-amber-500"
                  } ${syncingAccountId === currentActiveAccount.id ? "animate-ping" : "animate-pulse"}`}
                />
                <span className="font-mono text-xs">
                  {selectedChatProvider === "gemini"
                    ? currentActiveAccount.tier || (typeof currentActiveAccount.credits === "number" && currentActiveAccount.credits !== 9999 ? currentActiveAccount.credits : "Aktif")
                    : typeof currentActiveAccount.credits === "number"
                      ? currentActiveAccount.credits
                      : 0}
                </span>
                {selectedChatProvider !== "gemini" && (
                  <span className="hidden sm:inline text-[10px] text-amber-400/80 font-normal">Kr</span>
                )}
                <RefreshCw
                  className={`w-3 h-3 group-hover:rotate-180 transition-transform ${
                    selectedChatProvider === "gemini" ? "text-blue-400" : "text-amber-400"
                  } ${syncingAccountId === currentActiveAccount.id ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          )}

          <span className="hidden sm:block w-px h-5 bg-white/10 mx-0.5" aria-hidden="true" />

          {/* Theme Toggle (Dark / Light) */}
          {onToggleDarkMode && (
            <button
              type="button"
              onClick={(e) => onToggleDarkMode(e)}
              className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all cursor-pointer shrink-0"
              title={isDarkMode ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
              aria-label="Toggle Theme"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400 fill-amber-400/20" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Area: Left Collapsible / Drawer Sidebar + Center Chat Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Backdrop for mobile drawer */}
        {isHistorySidebarOpen && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 md:hidden transition-opacity"
            onClick={() => setIsHistorySidebarOpen(false)}
            aria-label="Tutup panel menu"
          />
        )}

        {/* Left Sidebar: Slide-over Drawer on Mobile, Collapsible Inline on Desktop */}
        <aside
          className={`bg-[#141417] border-r border-white/10 flex flex-col justify-between shrink-0 transition-all duration-300 ease-in-out
            fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[340px] shadow-2xl p-3.5
            md:relative md:inset-auto md:z-20 md:shadow-none md:p-3
            ${
              isHistorySidebarOpen
                ? "translate-x-0 opacity-100 pointer-events-auto md:w-80"
                : "-translate-x-full opacity-0 pointer-events-none md:w-0 md:p-0 md:border-r-0"
            }`}
        >
          <div className="flex flex-col gap-3 min-h-0 flex-1">
            {/* Mobile Drawer Header with Close Button */}
            <div className="flex items-center justify-between pb-2 mb-0.5 border-b border-white/10 md:hidden shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span className="font-semibold text-xs text-white">Menu Chat & Akun</span>
              </div>
              <button
                type="button"
                onClick={() => setIsHistorySidebarOpen(false)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white transition-colors"
                title="Tutup Menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sidebar Navigation Tabs: Akun Weavy vs Riwayat Chat */}
            <div className="flex p-0.5 rounded-xl bg-white/5 border border-white/5 shrink-0">
              <button
                type="button"
                onClick={() => setSidebarTab("accounts")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  sidebarTab === "accounts"
                    ? "bg-amber-500 text-stone-950 shadow-xs"
                    : "text-stone-400 hover:text-stone-200"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Akun</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    sidebarTab === "accounts"
                      ? "bg-black/20 text-stone-950"
                      : "bg-white/10 text-stone-400"
                  }`}
                >
                  {weavyAccountsList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSidebarTab("history")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  sidebarTab === "history"
                    ? "bg-amber-500 text-stone-950 shadow-xs"
                    : "text-stone-400 hover:text-stone-200"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Riwayat</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    sidebarTab === "history"
                      ? "bg-black/20 text-stone-950"
                      : "bg-white/10 text-stone-400"
                  }`}
                >
                  {sessions.length}
                </span>
              </button>
            </div>

            {/* TAB 1: DAFTAR AKUN SESUAI PROVIDER AKTIF (Weavy / Gemini) */}
            {sidebarTab === "accounts" && (
              <div className="flex flex-col gap-3 min-h-0 flex-1">
                {/* Active Account Highlight Card */}
                {currentActiveAccount ? (
                  <div
                    className={`p-3 rounded-2xl border relative overflow-hidden shrink-0 shadow-xs ${
                      selectedChatProvider === "gemini"
                        ? "bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-transparent border-blue-500/25"
                        : "bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/25"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 shadow-xs ${
                            selectedChatProvider === "gemini"
                              ? "bg-blue-500 text-white"
                              : "bg-amber-500 text-stone-950"
                          }`}
                        >
                          {(
                            currentActiveAccount.name ||
                            currentActiveAccount.displayName ||
                            currentActiveAccount.email ||
                            (selectedChatProvider === "gemini" ? "G" : "W")
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {currentActiveAccount.name ||
                              currentActiveAccount.displayName ||
                              (currentActiveAccount.email
                                ? currentActiveAccount.email.split("@")[0]
                                : selectedChatProvider === "gemini"
                                  ? "Akun Google Gemini"
                                  : "Akun Weavy")}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span
                              className={`text-[10px] font-medium ${
                                selectedChatProvider === "gemini" ? "text-blue-300" : "text-amber-300"
                              }`}
                            >
                              {selectedChatProvider === "gemini" ? "Akun Google Aktif" : "Akun Aktif"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) =>
                          handleSyncAccountCredits(currentActiveAccount, e)
                        }
                        disabled={syncingAccountId === currentActiveAccount.id}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          selectedChatProvider === "gemini"
                            ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-300"
                            : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300"
                        }`}
                        title="Perbarui status / kredit akun ini"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${syncingAccountId === currentActiveAccount.id ? "animate-spin" : ""}`}
                        />
                      </button>
                    </div>

                    <div
                      className={`pt-2 border-t flex items-center justify-between ${
                        selectedChatProvider === "gemini"
                          ? "border-blue-500/20"
                          : "border-amber-500/20"
                      }`}
                    >
                      <span className="text-[11px] text-stone-400">
                        {selectedChatProvider === "gemini" ? "Sisa Kuota Harian:" : "Sisa Kredit:"}
                      </span>
                      <span
                        className={`text-xs font-bold font-mono tracking-tight flex items-center gap-1 ${
                          selectedChatProvider === "gemini"
                            ? "text-blue-300"
                            : "text-amber-400 text-sm font-extrabold"
                        }`}
                      >
                        {selectedChatProvider === "gemini" ? (
                          <>
                            <Zap className="w-3.5 h-3.5 text-blue-400" />
                            <span>
                              {typeof currentActiveAccount.credits === "number"
                                ? `${Math.max(0, Math.min(GEMINI_MAX_CREDITS, currentActiveAccount.credits))}/${GEMINI_MAX_CREDITS} Video`
                                : `0/${GEMINI_MAX_CREDITS} Video`}
                            </span>
                          </>
                        ) : (
                          <>
                            <Coins className="w-3.5 h-3.5 text-amber-400" />
                            <span>
                              {typeof currentActiveAccount.credits === "number"
                                ? currentActiveAccount.credits
                                : 0}{" "}
                              Kredit
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center text-xs text-stone-400 shrink-0">
                    {selectedChatProvider === "gemini"
                      ? "Belum ada akun Google Gemini terhubung. Buka Pengaturan untuk menambahkan sesi / API Key Gemini."
                      : "Belum ada akun Weavy terhubung."}
                  </div>
                )}

                {/* Filter and Sync All Controls */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={accountSearchQuery}
                      onChange={(e) => setAccountSearchQuery(e.target.value)}
                      placeholder="Cari akun..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-xs text-stone-200 placeholder-stone-500 outline-none focus:border-white/20 transition-all"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSyncAllAccounts}
                    disabled={
                      syncingAccountId === "ALL" ||
                      activeAccountsList.length === 0
                    }
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-stone-300 hover:text-white border border-white/10 text-[11px] font-medium transition-all cursor-pointer disabled:opacity-50 shrink-0"
                    title={`Sinkronkan semua akun ${selectedChatProvider === "gemini" ? "Gemini" : "Weavy"}`}
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${syncingAccountId === "ALL" ? "animate-spin" : ""}`}
                    />
                    <span className="hidden sm:inline">Sync Semua</span>
                  </button>
                </div>

                {/* Accounts List */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar min-h-0">
                  <div className="px-2 py-0.5 flex items-center justify-between text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                    <span>
                      Daftar Akun {selectedChatProvider === "gemini" ? "Gemini" : "Weavy"} ({filteredAccounts.length})
                    </span>
                    <span>Pilih / Ganti</span>
                  </div>

                  {filteredAccounts.length === 0 ? (
                    <div className="text-center py-8 text-xs text-stone-500">
                      {accountSearchQuery
                        ? "Tidak ada akun yang cocok"
                        : `Tidak ada akun ${selectedChatProvider === "gemini" ? "Gemini" : "Weavy"} tersedia`}
                    </div>
                  ) : (
                    filteredAccounts.map((acc: any) => {
                      const isCurrent = acc.id === currentActiveAccount?.id;
                      const isSyncing =
                        syncingAccountId === acc.id ||
                        syncingAccountId === "ALL";
                      const isGemini = selectedChatProvider === "gemini";
                      return (
                        <div
                          key={acc.id}
                          onClick={() => {
                            handleSwitchAccount(acc.id);
                            if (window.innerWidth < 768) setIsHistorySidebarOpen(false);
                          }}
                          className={`group relative flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition-all ${
                            isCurrent
                              ? isGemini
                                ? "bg-blue-500/15 text-white border border-blue-500/30 shadow-xs font-medium"
                                : "bg-amber-500/15 text-white border border-amber-500/30 shadow-xs font-medium"
                              : "text-stone-400 bg-white/5 hover:bg-white/10 hover:text-stone-200 border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                                isCurrent
                                  ? isGemini
                                    ? "bg-blue-500 text-white shadow-xs"
                                    : "bg-amber-500 text-stone-950 shadow-xs"
                                  : "bg-stone-800 text-stone-300 group-hover:bg-stone-700"
                              }`}
                            >
                              {(acc.name || acc.displayName || acc.email || (isGemini ? "G" : "W"))
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <div className="truncate min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="truncate text-xs font-semibold leading-tight text-stone-200 group-hover:text-white">
                                  {acc.name ||
                                    acc.displayName ||
                                    (acc.email
                                      ? acc.email.split("@")[0]
                                      : isGemini
                                        ? "Akun Google Gemini"
                                        : "Akun Weavy")}
                                </p>
                                {isCurrent && (
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0 ${
                                      isGemini
                                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    }`}
                                  >
                                    Aktif
                                  </span>
                                )}
                              </div>
                              {acc.email && (
                                <p className="text-[10px] text-stone-500 group-hover:text-stone-400 truncate">
                                  {acc.email}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <span
                              className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded-lg border ${
                                isGemini
                                  ? "bg-blue-500/10 border-blue-500/20 text-blue-300"
                                  : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                              }`}
                            >
                              {isGemini
                                ? typeof acc.credits === "number"
                                  ? `${Math.max(0, Math.min(GEMINI_MAX_CREDITS, acc.credits))}/${GEMINI_MAX_CREDITS} Video${acc.creditSyncStatus === 'unknown' ? ' · Belum sinkron' : ''}`
                                  : `0/${GEMINI_MAX_CREDITS} Video · Belum sinkron`
                                : `${typeof acc.credits === "number" ? acc.credits : 0} K`}
                            </span>

                            <button
                              type="button"
                              onClick={(e) => handleSyncAccountCredits(acc, e)}
                              disabled={isSyncing}
                              title="Sinkronkan status/kredit akun ini"
                              className={`p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer ${
                                isGemini
                                  ? "text-stone-500 hover:text-blue-400"
                                  : "text-stone-500 hover:text-amber-400"
                              }`}
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`}
                              />
                            </button>

                            {isCurrent && (
                              <Check
                                className={`w-4 h-4 shrink-0 ${
                                  isGemini ? "text-blue-400" : "text-amber-400"
                                }`}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Account Summary Footer */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-stone-400 shrink-0">
                  <span className="flex items-center gap-1">
                    {selectedChatProvider === "gemini" ? (
                      <Zap className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>{selectedChatProvider === "gemini" ? "Total Akun:" : "Total Sisa:"}</span>
                  </span>
                  <span
                    className={`font-bold font-mono ${
                      selectedChatProvider === "gemini" ? "text-blue-300" : "text-amber-400"
                    }`}
                  >
                    {selectedChatProvider === "gemini"
                      ? `${geminiAccountsList.length} Akun Gemini`
                      : `${totalAggregatedCredits} Kredit`}
                  </span>
                </div>
              </div>
            )}

            {/* TAB 2: RIWAYAT PERCAKAPAN */}
            {sidebarTab === "history" && (
              <div className="flex flex-col gap-3 min-h-0 flex-1">
                {/* New Chat Primary Button */}
                <button
                  type="button"
                  onClick={handleCreateNewChat}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/10 font-semibold text-xs transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Chat Baru</span>
                </button>

                {/* Search Input for Sessions */}
                <div className="relative shrink-0">
                  <Search className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchSessionQuery}
                    onChange={(e) => setSearchSessionQuery(e.target.value)}
                    placeholder="Cari obrolan..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-xs text-stone-200 placeholder-stone-500 outline-none focus:border-white/20 transition-all"
                  />
                </div>

                {/* Sessions List (dikelompokkan per tanggal) */}
                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0">
                  {filteredSessions.length === 0 ? (
                    <div className="text-center py-8 text-xs text-stone-500">
                      {searchSessionQuery.trim()
                        ? "Tidak ada obrolan yang cocok"
                        : "Belum ada riwayat obrolan"}
                    </div>
                  ) : (
                    groupedSessions.map((group) => (
                      <div key={group.label} className="mb-1.5">
                        <div className="px-2 pt-2 pb-1 flex items-center gap-1 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                          {group.label === "Disematkan" && (
                            <Pin className="w-3 h-3 rotate-45" />
                          )}
                          <span>{group.label}</span>
                        </div>
                        <div className="space-y-0.5">
                          {group.items.map((sess) => {
                            const isActive = sess.id === activeSessionId;
                            const isEditing = editingSessionId === sess.id;

                            if (isEditing) {
                              return (
                                <div
                                  key={sess.id}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 border border-amber-500/50 text-xs shadow-inner"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                                  <input
                                    ref={renameInputRef}
                                    type="text"
                                    autoFocus
                                    value={editingSessionTitle}
                                    onChange={(e) => setEditingSessionTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveRenameSession(sess.id);
                                      if (e.key === "Escape") handleCancelRenameSession();
                                    }}
                                    className="flex-1 min-w-0 bg-transparent text-white text-xs px-1 py-0.5 outline-none font-medium border-b border-amber-400/40 focus:border-amber-400"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => handleSaveRenameSession(sess.id, e)}
                                    title="Simpan nama"
                                    className="p-1 hover:text-emerald-400 text-stone-300 hover:bg-white/10 rounded transition-colors cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleCancelRenameSession(e)}
                                    title="Batal"
                                    className="p-1 hover:text-rose-400 text-stone-400 hover:bg-white/10 rounded transition-colors cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={sess.id}
                                title={sess.title}
                                onClick={() => {
                                  setActiveSessionId(sess.id);
                                  if (window.innerWidth < 1024)
                                    setIsHistorySidebarOpen(false);
                                }}
                                className={`group relative flex items-start px-3 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                                  isActive
                                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/25 font-medium shadow-xs"
                                    : "text-stone-400 hover:bg-white/5 hover:text-stone-200 border border-transparent"
                                }`}
                              >
                                <div className="flex items-start gap-2 min-w-0 flex-1 max-sm:pr-[88px]">
                                  {sess.isPinned ? (
                                    <Pin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400 fill-amber-400/50 rotate-45" />
                                  ) : (
                                    <MessageSquare
                                      className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                                        isActive
                                          ? "text-amber-300"
                                          : "text-stone-400 group-hover:text-stone-200"
                                      }`}
                                    />
                                  )}
                                  <span className="line-clamp-2 break-words leading-snug">
                                    {sess.title}
                                  </span>
                                  {loadingSessionIds[sess.id] && (
                                    <span
                                      className="w-1.5 h-1.5 mt-1.5 rounded-full bg-amber-400 animate-pulse shrink-0"
                                      title="Sedang menulis respon..."
                                    />
                                  )}
                                </div>

                                {/* Aksi: pill melayang. Desktop: muncul saat hover/fokus. Mobile: selalu tampil (tidak ada hover). */}
                                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 p-0.5 rounded-lg bg-[#1C1C1F] border border-white/10 shadow-md transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                                  <button
                                    type="button"
                                    onClick={(e) => handleTogglePinSession(sess.id, e)}
                                    title={sess.isPinned ? "Lepas sematan" : "Sematkan chat"}
                                    className={`p-1.5 sm:p-1 rounded transition-colors cursor-pointer ${
                                      sess.isPinned
                                        ? "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                                        : "text-stone-400 hover:text-amber-400 hover:bg-white/10"
                                    }`}
                                  >
                                    <Pin
                                      className={`w-3.5 h-3.5 ${
                                        sess.isPinned ? "fill-amber-400/50 rotate-45 text-amber-400" : ""
                                      }`}
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleStartRenameSession(sess, e)}
                                    title="Ubah nama"
                                    className="p-1.5 sm:p-1 text-stone-400 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteSession(sess.id, e)}
                                    title="Hapus obrolan"
                                    className="p-1.5 sm:p-1 text-stone-400 hover:text-rose-400 hover:bg-white/10 rounded transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick navigation to Studio / Canvas on Mobile */}
          <div className="pt-3 border-t border-white/10 flex items-center gap-2 md:hidden shrink-0">
            {onBack && (
              <button
                type="button"
                onClick={() => {
                  setIsHistorySidebarOpen(false);
                  onBack();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-stone-200 text-xs font-medium border border-white/10 transition-colors cursor-pointer active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
                <span>Studio</span>
              </button>
            )}
            {onNavigateCanvas && (
              <button
                type="button"
                onClick={() => {
                  setIsHistorySidebarOpen(false);
                  onNavigateCanvas();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-stone-200 text-xs font-medium border border-white/10 transition-colors cursor-pointer active:scale-95"
              >
                <Workflow className="w-3.5 h-3.5 text-amber-400" />
                <span>Canvas</span>
              </button>
            )}
          </div>
        </aside>

        {/* Center Main Chat Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#141418] relative h-full overflow-hidden">
          {/* Message Stream */}
          <div
            ref={chatScrollRef}
            onScroll={handleChatScroll}
            className="flex-1 overflow-y-auto px-3 sm:px-6 pt-2 sm:pt-3 pb-4 sm:pb-6 space-y-4 sm:space-y-6 custom-scrollbar overscroll-contain"
          >
            {currentSession?.messages.length === 0 ? (
              <div className="min-h-[50vh] flex flex-col items-center justify-center text-center max-w-2xl mx-auto px-4 py-8 sm:py-12">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 border border-amber-500/20 shadow-xs">
                  <Bot className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-serif-display font-medium text-stone-900 dark:text-white mb-2">
                  Apa yang bisa saya bantu hari ini?
                </h2>
                <p className="text-xs text-stone-400 max-w-md mb-6 leading-relaxed">
                  Pilih salah satu preset di bawah atau ketik <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-amber-300 font-mono text-[11px]">/</kbd> untuk menerapkan formula video AI viral secara instan:
                </p>
                <div className="flex flex-wrap justify-center gap-2 max-w-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setInputText("/kebunimpian ");
                      textareaRef.current?.focus();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-stone-300 hover:text-white transition-all cursor-pointer"
                  >
                    <span>🏡</span>
                    <span>/kebunimpian (50s)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputText("/homeharvest ");
                      textareaRef.current?.focus();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-stone-300 hover:text-white transition-all cursor-pointer"
                  >
                    <span>🍆</span>
                    <span>/homeharvest (29s)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputText("/plantreview ");
                      textareaRef.current?.focus();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-stone-300 hover:text-white transition-all cursor-pointer"
                  >
                    <span>🍇</span>
                    <span>/plantreview (45s)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputText("/buahunggul ");
                      textareaRef.current?.focus();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-stone-300 hover:text-white transition-all cursor-pointer"
                  >
                    <span>🌳</span>
                    <span>/buahunggul (30s)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputText("/onthespot ");
                      textareaRef.current?.focus();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-stone-300 hover:text-white transition-all cursor-pointer"
                  >
                    <span>🔥</span>
                    <span>/onthespot (30s)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputText("/harvestpov ");
                      textareaRef.current?.focus();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-stone-300 hover:text-white transition-all cursor-pointer"
                  >
                    <span>🌾</span>
                    <span>/harvestpov (15s)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputText("/facelessgardenugc ");
                      textareaRef.current?.focus();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-stone-300 hover:text-white transition-all cursor-pointer"
                  >
                    <span>🌱</span>
                    <span>/facelessgardenugc (20s)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputText("/fashion ");
                      textareaRef.current?.focus();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-stone-300 hover:text-white transition-all cursor-pointer"
                  >
                    <span>🎬</span>
                    <span>/fashion (15s)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputText("/download ");
                      textareaRef.current?.focus();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs text-emerald-300 hover:text-emerald-200 transition-all cursor-pointer"
                  >
                    <span>📥</span>
                    <span>/download Video TikTok</span>
                  </button>
                </div>
              </div>
            ) : (
              currentSession.messages.map((msg, idx) => {
                const isUser = msg.role === "user";
                const hasText = Boolean(cleanPlainText(msg.content).trim() || hasStoryboardProject(msg.content));
                const hasMedia = Boolean(
                  msg.generatedImage ||
                  msg.generatedVideo ||
                  (msg.attachments && msg.attachments.length > 0) ||
                  msg.weavyAction ||
                  msg.repostMedia ||
                  msg.thinking
                );
                const isLoadingThisMsg = !isUser && isCurrentSessionLoading && idx === currentSession.messages.length - 1;

                if (!isUser && !hasText && !hasMedia && !msg.isError && !isLoadingThisMsg) {
                  return null;
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 max-w-4xl mx-auto ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`space-y-2 max-w-[92%] sm:max-w-[78%] ${isUser ? "items-end" : "items-start"}`}
                    >
                      {/* Extracted Product Showcase Card by AI Worker */}
                      {msg.extractedProducts && msg.extractedProducts.length > 0 && (
                        <ChatProductCard
                          products={msg.extractedProducts}
                          onUseInPrompt={(p) => {
                            setInputText(p);
                            textareaRef.current?.focus();
                          }}
                          onOpenPreview={handleOpenPreviewModal}
                          onNavigateCanvas={onNavigateCanvas}
                          onNavigateGenerate={onNavigateGenerate}
                          onNavigateStudio={onNavigateStudio}
                        />
                      )}

                      {/* Attached Images preview & swipeable gallery */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <ChatAttachmentCarousel
                          attachments={msg.attachments}
                          isUser={isUser}
                          onOpenPreview={handleOpenPreviewModal}
                          onOpenMarkup={handleOpenMarkup}
                          onUseInPrompt={handleUseImageInPrompt}
                          onSendToGenerateVideo={onNavigateGenerate}
                        />
                      )}

                      {/* Native Embedded Video Player for Playable Video Attachments */}
                      {msg.attachments && msg.attachments.some((a) => a.type === "video") && (
                        <div className="space-y-3 w-full my-1">
                          {msg.attachments
                            .filter((a) => a.type === "video")
                            .map((vidAtt) => (
                              <EmbeddedVideoPlayer
                                key={vidAtt.id || vidAtt.playbackUrl || vidAtt.url}
                                attachment={vidAtt}
                                onAnalyzePrompt={(tag) => {
                                  setInputText((prev) =>
                                    prev ? `${prev} ${tag}` : `Tolong analisis secara mendalam dan buatkan prompt video AI untuk ${tag}`
                                  );
                                  textareaRef.current?.focus();
                                }}
                              />
                            ))}
                        </div>
                      )}

                      {/* Thinking Process Accordion (if AI message with thinking) */}
                      {!isUser && msg.thinking && (
                        <div className="border border-purple-500/20 bg-purple-500/5 rounded-xl overflow-hidden text-xs">
                          <button
                            type="button"
                            onClick={() => toggleThinking(msg.id)}
                            className="w-full px-3 py-1.5 flex items-center justify-between text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 transition-colors"
                          >
                            <span className="flex items-center gap-1.5 font-medium">
                              <BrainCircuit className="w-3.5 h-3.5" />
                              <span>
                                Thinking Process ({activeModelObj.name})
                              </span>
                            </span>
                            <ChevronRight
                              className={`w-3.5 h-3.5 transition-transform ${
                                expandedThinking[msg.id] ? "rotate-90" : ""
                              }`}
                            />
                          </button>
                          {expandedThinking[msg.id] && (
                            <div className="p-3 pt-1 border-t border-purple-500/15 text-stone-600 dark:text-stone-300 text-[11px] font-mono leading-relaxed whitespace-pre-wrap">
                              {msg.thinking}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Message Bubble, Generated Video Card, or Generated Image Card */}
                      {msg.generatedVideo ? (
                        <div className="w-full space-y-3">
                          {/* Loading Video Card */}
                          {msg.generatedVideo.status === "loading" && (
                            <VideoGenerationSpinner
                              aspectRatio={msg.generatedVideo.aspectRatio}
                              modelName={msg.generatedVideo.modelName}
                              provider={msg.generatedVideo.provider}
                              duration={msg.generatedVideo.duration}
                              resolution={msg.generatedVideo.resolution}
                              referenceImageUrl={msg.generatedVideo.referenceImageUrl}
                              referenceVideoUrl={msg.generatedVideo.referenceVideoUrl}
                            />
                          )}

                          {/* Completed Video Card */}
                          {msg.generatedVideo.status === "completed" && (
                            <GeneratedVideoCard
                              video={msg.generatedVideo}
                              url={msg.generatedVideo.url}
                              prompt={msg.generatedVideo.prompt || ""}
                              modelName={msg.generatedVideo.modelName}
                              aspectRatio={msg.generatedVideo.aspectRatio}
                              duration={msg.generatedVideo.duration}
                              resolution={msg.generatedVideo.resolution}
                              onUseInPrompt={(url, prompt) => handleUseVideoInPrompt(url, prompt)}
                              onUseAsReference={(url, prompt) => handleUseVideoInPrompt(url, prompt)}
                              onSendToStudio={(prompt, url) => {
                                if (onNavigateStudio) {
                                  onNavigateStudio({
                                    title: prompt ? `Video: ${prompt.slice(0, 30)}` : "Video Project",
                                    productName: prompt || "Video Project",
                                    scenes: [],
                                  });
                                } else if (onNavigateCanvas) {
                                  onNavigateCanvas(prompt, url);
                                } else {
                                  onNavigateGenerate?.(prompt);
                                }
                              }}
                              onSendToGenerateVideo={onNavigateGenerate}
                              onNavigateCanvas={onNavigateCanvas}
                            />
                          )}

                          {/* Error Video State */}
                          {msg.generatedVideo.status === "failed" && (
                            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-700 dark:text-red-300 text-xs sm:text-sm space-y-2">
                              <div className="flex items-center gap-2 font-medium">
                                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                                <span>Gagal Membuat Video ({resolveVideoProvider(msg.generatedVideo.provider, msg.generatedVideo.modelName).name}{msg.generatedVideo.modelName ? ` · ${msg.generatedVideo.modelName}` : ""})</span>
                              </div>
                              <p className="text-xs text-red-600/90 dark:text-red-300/80">
                                {msg.generatedVideo.errorMessage || "Terjadi kesalahan saat memproses render video."}
                              </p>
                              {msg.generatedVideo.prompt && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInputText(msg.generatedVideo?.prompt || "");
                                    setChatMode("video");
                                    textareaRef.current?.focus();
                                  }}
                                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-700 dark:text-red-200 text-xs font-medium cursor-pointer transition-colors"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span>Coba Lagi dengan Prompt Ini</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ) : msg.generatedImage ? (
                        <div className="w-full space-y-3">
                          {/* Loading Card - Modern Spinner with Percentage */}
                          {msg.generatedImage.status === "loading" && (
                            <ImageGenerationSpinner
                              aspectRatio={msg.generatedImage.aspectRatio}
                            />
                          )}

                          {/* Completed Image Card - Auto Fit with Floating Hover Actions */}
                          {msg.generatedImage.status === "completed" &&
                            msg.generatedImage.url && (
                              <div
                                draggable={true}
                                onDragStart={(e) => {
                                  if (msg.generatedImage?.url) {
                                    e.dataTransfer.setData("application/x-amb-image-url", msg.generatedImage.url);
                                    e.dataTransfer.setData("text/uri-list", msg.generatedImage.url);
                                    e.dataTransfer.setData("text/plain", msg.generatedImage.url);
                                  }
                                }}
                                className="relative inline-block max-w-full rounded-2xl border border-stone-300/80 dark:border-white/10 bg-black/40 overflow-hidden shadow-2xl group select-none cursor-grab active:cursor-grabbing"
                              >
                                {/* Image Display */}
                                <div
                                  className="relative overflow-hidden cursor-pointer flex items-center justify-center"
                                  onClick={() =>
                                    msg.generatedImage?.url &&
                                    handleOpenPreviewModal(msg.generatedImage.url)
                                  }
                                >
                                  <img
                                    src={msg.generatedImage.url}
                                    alt={
                                      msg.generatedImage.prompt ||
                                      "Generated artwork"
                                    }
                                    className="block max-w-full max-h-[75vh] w-auto h-auto object-contain transition-transform duration-300 group-hover:scale-[1.01] cursor-grab active:cursor-grabbing"
                                    draggable={true}
                                    onDragStart={(e) => {
                                      if (msg.generatedImage?.url) {
                                        e.dataTransfer.setData("application/x-amb-image-url", msg.generatedImage.url);
                                        e.dataTransfer.setData("text/uri-list", msg.generatedImage.url);
                                        e.dataTransfer.setData("text/plain", msg.generatedImage.url);
                                      }
                                    }}
                                  />

                                  {/* Aspect Ratio Badge */}
                                  {msg.generatedImage.aspectRatio && (
                                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
                                      <span className="px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md text-[10px] font-mono text-amber-300 border border-white/15 font-bold shadow-md">
                                        {msg.generatedImage.aspectRatio}
                                      </span>
                                    </div>
                                  )}

                                  {/* Floating Action Icons (Gunakan, Perbesar, Unduh) */}
                                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 z-10">
                                    {/* Gunakan di Prompt Button */}
                                    <div className="relative group/btn">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (msg.generatedImage?.url) {
                                            handleUseImageInPrompt(
                                              msg.generatedImage.url,
                                              msg.generatedImage.prompt,
                                            );
                                          }
                                        }}
                                        className="p-2 rounded-xl bg-black/75 hover:bg-black/90 backdrop-blur-md text-amber-400 hover:text-amber-300 border border-white/20 shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                                        title="Gunakan"
                                      >
                                        <Undo2 className="w-4 h-4 text-amber-400" />
                                      </button>
                                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-white text-stone-900 text-[11px] font-medium rounded shadow-md pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap z-30">
                                        Gunakan
                                      </div>
                                    </div>

                                    {/* Coret / Beri Tanda Button */}
                                    <div className="relative group/btn">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (msg.generatedImage?.url) {
                                            handleOpenMarkup(
                                              msg.generatedImage.url,
                                              msg.generatedImage.prompt
                                                ? `Hasil AI: ${msg.generatedImage.prompt.slice(0, 35)}...`
                                                : "Hasil Gambar AI",
                                            );
                                          }
                                        }}
                                        className="p-2 rounded-xl bg-black/75 hover:bg-black/90 backdrop-blur-md text-amber-400 hover:text-amber-300 border border-white/20 shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                                        title="Coret / Beri Tanda Visual"
                                      >
                                        <Pencil className="w-4 h-4 text-amber-400" />
                                      </button>
                                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-white text-stone-900 text-[11px] font-medium rounded shadow-md pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap z-30">
                                        Coret / Tanda Visual
                                      </div>
                                    </div>

                                    {/* Zoom Button */}
                                    <div className="relative group/btn">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (msg.generatedImage?.url) {
                                            handleOpenPreviewModal(
                                              msg.generatedImage.url,
                                            );
                                          }
                                        }}
                                        className="p-2 rounded-xl bg-black/75 hover:bg-black/90 backdrop-blur-md text-white border border-white/20 shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                                        title="Perbesar gambar"
                                      >
                                        <Maximize2 className="w-4 h-4" />
                                      </button>
                                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-white text-stone-900 text-[11px] font-medium rounded shadow-md pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap z-30">
                                        Perbesar
                                      </div>
                                    </div>

                                    {/* Download Button */}
                                    <div className="relative group/btn">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (msg.generatedImage?.url) {
                                            downloadMediaFile(
                                              msg.generatedImage.url,
                                              `weavy_art_${Date.now()}.png`,
                                            );
                                          }
                                        }}
                                        className="p-2 rounded-xl bg-black/75 hover:bg-black/90 backdrop-blur-md text-emerald-400 hover:text-emerald-300 border border-white/20 shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                                        title="Unduh gambar"
                                      >
                                        <Download className="w-4 h-4" />
                                      </button>
                                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-white text-stone-900 text-[11px] font-medium rounded shadow-md pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap z-30">
                                        Unduh
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                          {/* Failed State */}
                          {msg.generatedImage.status === "failed" && (
                            <div className="p-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 text-rose-300 text-xs space-y-2">
                              <div className="font-semibold flex items-center gap-1.5 text-rose-400">
                                <span>⚠️ Gagal Menghasilkan Gambar</span>
                              </div>
                              <p className="text-rose-200/90 leading-relaxed font-mono text-[11px]">
                                {msg.generatedImage.errorMessage ||
                                  "Terjadi kesalahan saat memproses gambar di Weavy AI."}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  if (msg.generatedImage?.prompt) {
                                    setInputText(msg.generatedImage.prompt);
                                    setChatMode("image");
                                    textareaRef.current?.focus();
                                  }
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 text-xs font-semibold cursor-pointer transition-colors"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Coba Lagi dengan Prompt Ini</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        hasText ? (
                          (() => {
                            const isSb = !isUser && hasStoryboardProject(msg.content);
                            return (
                              <div
                                className={`select-text ${
                                  isSb
                                    ? "w-full max-w-full p-0 bg-transparent border-0 shadow-none"
                                    : `p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                                        isUser
                                          ? "bg-amber-50 dark:bg-amber-500/10 text-stone-800 dark:text-stone-100 border border-amber-200/90 dark:border-amber-500/25 rounded-tr-xs shadow-2xs"
                                          : msg.isError
                                            ? "bg-red-500/10 border border-red-500/25 text-red-700 dark:text-red-300 rounded-tl-xs"
                                            : "bg-white dark:bg-[#16161B] text-stone-800 dark:text-stone-100 border border-stone-300/80 dark:border-white/8 rounded-tl-xs shadow-2xs"
                                      }`
                                }`}
                              >
                                <CleanMessageRenderer
                                  content={msg.content}
                                  isUser={isUser}
                                  onSendToGenerateVideo={onNavigateGenerate}
                                  onNavigateStudio={onNavigateStudio}
                                />
                              </div>
                            );
                          })()
                        ) : isLoadingThisMsg ? (
                          <div className="px-4 py-3 rounded-2xl bg-white dark:bg-[#16161B] border border-stone-300/80 dark:border-white/8 text-xs text-stone-500 dark:text-stone-400 flex items-center gap-2 rounded-tl-xs shadow-2xs">
                            <div className="flex space-x-1">
                              <div
                                className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"
                                style={{ animationDelay: "0ms" }}
                              />
                              <div
                                className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"
                                style={{ animationDelay: "150ms" }}
                              />
                              <div
                                className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"
                                style={{ animationDelay: "300ms" }}
                              />
                            </div>
                            <span>
                              {msg.modelDisplayName || activeModelObj.name} sedang berpikir & menulis respon...
                            </span>
                          </div>
                        ) : null
                      )}

                      {/* Direct Weavy or Gemini Action Card (Interactive Bridge from Chat to Image/Video) */}
                      {!isUser && (() => {
                        const cardAction =
                          msg.weavyAction ||
                          (msg.content && (msg.content.includes("weavy_generate") || msg.content.includes("gemini_generate"))
                            ? extractWeavyActionFromMessage(msg.content, "", [], []).action
                            : null);
                        if (!cardAction) return null;
                        return (
                          <WeavyActionCard
                            action={cardAction}
                            onExecute={(action) =>
                              selectedChatProvider === "gemini"
                                ? handleExecuteGeminiAction(msg.id, action)
                                : handleExecuteWeavyAction(msg.id, action)
                            }
                            onSendToGenerateVideo={onNavigateGenerate}
                            onUseImageAsReference={(imgUrl, prompt) => {
                              handleUseImageInPrompt(imgUrl, prompt);
                            }}
                            onUseInPrompt={(prompt, imgUrl) => {
                              if (imgUrl) {
                                handleUseImageInPrompt(imgUrl, prompt);
                              } else {
                                setInputText(prompt);
                                textareaRef.current?.focus();
                              }
                            }}
                            onOpenPreview={(url) => handleOpenPreviewModal(url)}
                            onMarkupImage={(url, prompt) =>
                              handleOpenMarkup(
                                url,
                                prompt
                                  ? `Hasil AI: ${prompt.slice(0, 35)}...`
                                  : "Weavy AI Image",
                              )
                            }
                            onNavigateCanvas={onNavigateCanvas}
                            isExecuting={cardAction.status === "loading"}
                          />
                        );
                      })()}

                      {/* Repost Media Card (File Asli Sesi Ini • 0 Kredit) */}
                      {!isUser && msg.repostMedia && (
                        <RepostMediaCard
                          media={msg.repostMedia}
                          onUseAsReference={(imgUrl, prompt) => {
                            handleUseImageInPrompt(imgUrl, prompt);
                          }}
                          onOpenPreview={(url) => handleOpenPreviewModal(url)}
                        />
                      )}

                      {/* Action Footer for AI messages (only if standard text message with content and not loading) */}
                      {!isUser && !msg.isError && !msg.generatedImage && hasText && !isLoadingThisMsg && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-stone-500 dark:text-stone-400">
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(msg.content, msg.id, true)
                            }
                            title="Salin teks bersih (tanpa simbol markdown)"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-stone-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                          >
                            {copiedMessageId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-500">
                                  Tersalin Bersih
                                </span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Salin</span>
                              </>
                            )}
                          </button>

                          {msg.durationMs && (
                            <span className="text-[10px] text-stone-400 font-mono ml-auto">
                              {(msg.durationMs / 1000).toFixed(1)}s
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className="w-8 h-8 rounded-xl bg-stone-300 dark:bg-white/15 flex items-center justify-center text-stone-700 dark:text-stone-200 shrink-0 mt-0.5">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Loading Indicator - Fallback only if no assistant message is in the messages array */}
            {isCurrentSessionLoading &&
              chatMode !== "image" &&
              chatMode !== "video" &&
              !currentSession?.messages.some((m) => m.role === "assistant") &&
              !currentSession?.messages.some(
                (m) =>
                  m.generatedImage?.status === "loading" ||
                  m.generatedVideo?.status === "loading",
              ) && (
                <div className="flex gap-3 max-w-4xl mx-auto justify-start items-center">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 animate-pulse">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-white dark:bg-[#16161B] border border-stone-300/80 dark:border-white/8 text-xs text-stone-500 dark:text-stone-400 flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div
                        className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <div
                        className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <div
                        className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                    <span>
                      {activeModelObj.name} sedang berpikir & menulis respon...
                    </span>
                  </div>
                </div>
              )}

            <div ref={messagesEndRef} />
          </div>

          {/* Floating / Bottom Chat Input Box - Mobile Responsive & Touch-Friendly */}
          <div className="p-2 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-transparent max-w-4xl w-full mx-auto relative z-20">
            {/* Scroll to Bottom Button - Shows when scrolled up */}
            {showScrollBottom && (
              <button
                type="button"
                onClick={() => scrollToBottom("smooth")}
                title="Scroll ke bawah"
                aria-label="Scroll ke chat terbaru"
                className="absolute -top-12 right-2 sm:right-4 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#202025]/95 hover:bg-[#2e2e36] active:bg-[#141418] border border-white/20 text-white shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer z-30 group backdrop-blur-xs"
              >
                <ArrowDown className="w-4 h-4 sm:w-5 sm:h-5 text-stone-700 group-hover:text-stone-900 dark:text-white/90 dark:group-hover:text-white transition-colors" />
              </button>
            )}

            {/* Main Input Card matching user design */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOver(false);
              }}
              onDrop={handleDrop}
              className={`relative rounded-xl bg-[#1C1C1F] dark:bg-[#18181B] border p-2.5 sm:p-3 transition-all ${
                isDraggingOver
                  ? "border-amber-400/90 ring-2 ring-amber-400/30 bg-[#25252b]"
                  : "border-stone-400/40 dark:border-white/12 focus-within:border-stone-400 dark:focus-within:border-white/25"
              }`}
            >
              {/* Drag over overlay */}
              {isDraggingOver && (
                <div className="absolute inset-0 z-20 rounded-xl bg-amber-500/10 backdrop-blur-xs border-2 border-dashed border-amber-400 flex items-center justify-center pointer-events-none transition-all">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a1f]/95 border border-amber-400/40 text-amber-300 text-xs sm:text-sm font-semibold shadow-xl">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    <span>Lepaskan berkas atau gambar di sini...</span>
                  </div>
                </div>
              )}
              {/* Attached Thumbnails inside card */}
              {attachments.length > 0 && (
                <div className="flex flex-col gap-2 pb-2.5 mb-2 border-b border-white/10">
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((att) => {
                      const isVideo = att.type === "video" || Boolean(att.playbackUrl);
                      const isImage =
                        !isVideo &&
                        (att.type === "image" ||
                          Boolean(att.url?.trim()) ||
                          Boolean(att.previewUrl?.trim()) ||
                          Boolean(att.base64?.trim()));
                      const imgIndex = imageAttachments.findIndex(
                        (a) => a.id === att.id
                      );
                      const assignedIndex =
                        imgIndex !== -1 ? totalSessionImagesCount + imgIndex + 1 : null;
                      const imgTag = assignedIndex ? `@img${assignedIndex}` : null;
                      const vidTag = isVideo
                        ? att.videoIndex
                          ? `@vid${att.videoIndex}`
                          : `@vid${existingSessionVideos.length + 1}`
                        : null;
                      const activeTag = vidTag || imgTag;
                      const labelText = activeTag || att.name;

                      const previewSrc =
                        (att.previewUrl && att.previewUrl.trim()) ||
                        (att.url && att.url.trim()) ||
                        (att.base64 && att.base64.trim()) ||
                        undefined;

                      return (
                        <div
                          key={att.id}
                          className={`relative group flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-md text-xs transition-all overflow-hidden ${
                            att.uploadError
                              ? "bg-rose-500/10 border border-rose-500/40 text-rose-200"
                              : att.isUploading
                              ? "bg-amber-500/10 border border-amber-500/35 text-amber-200"
                              : "bg-white/5 border border-white/10 text-stone-200 hover:border-white/20"
                          }`}
                        >
                          {isVideo ? (
                            <div className="relative w-5 h-5 rounded-md bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                              {att.isUploading ? (
                                <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                              ) : (
                                <Video className="w-3 h-3 text-amber-400" />
                              )}
                            </div>
                          ) : isImage && previewSrc ? (
                            <div className="relative w-5 h-5 rounded-md overflow-hidden bg-stone-900 border border-white/10 shrink-0">
                              <img
                                src={previewSrc}
                                alt={labelText}
                                className={`w-full h-full object-cover ${
                                  att.isUploading ? "opacity-50" : "opacity-100"
                                }`}
                              />
                              {att.isUploading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                  <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="shrink-0">
                              {att.isUploading ? (
                                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                              ) : (
                                <FileText className="w-4 h-4 text-stone-300" />
                              )}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              if (activeTag) {
                                setInputText((prev) =>
                                  prev.trim()
                                    ? `${prev.trim()} ${activeTag} `
                                    : `${activeTag} `
                                );
                                if (textareaRef.current) textareaRef.current.focus();
                              }
                            }}
                            title={
                              activeTag
                                ? `Klik untuk menyisipkan ${activeTag} ke dalam prompt`
                                : att.name
                            }
                            className="font-mono text-xs text-stone-200 hover:text-white transition-colors cursor-pointer select-none flex items-center gap-1.5"
                          >
                            {activeTag && (
                              <span
                                className={`px-1.5 py-0.5 rounded font-semibold text-[10px] border ${
                                  vidTag
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                    : "bg-blue-500/20 text-blue-300 border-blue-500/35"
                                }`}
                              >
                                {activeTag}
                              </span>
                            )}
                            <span className="truncate max-w-[120px]">{att.name || labelText}</span>
                          </button>

                          {/* Upload State Status Pill */}
                          {att.isUploading ? (
                            <span className="px-1.5 py-0.2 rounded font-semibold text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono shrink-0">
                              {att.uploadProgress ?? 0}%
                            </span>
                          ) : att.uploadError ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className="px-1.5 py-0.2 rounded font-semibold text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-0.5"
                                title={att.uploadError}
                              >
                                <AlertCircle className="w-2.5 h-2.5" />
                                Gagal
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRetryUpload(att.id)}
                                className="text-[10px] text-amber-400 hover:text-amber-300 underline font-semibold px-1 py-0.5 cursor-pointer"
                                title="Coba unggah ulang media ini ke Weavy"
                              >
                                Ulangi
                              </button>
                            </div>
                          ) : (
                            <span
                              className="text-[10px] text-emerald-400 flex items-center shrink-0"
                              title="Media aman dan berhasil terunggah ke server Weavy AI"
                            >
                              <Check className="w-3 h-3 stroke-[2.5]" />
                            </span>
                          )}

                          <div className="flex items-center gap-1 ml-1">
                            {isImage && !att.isUploading && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenMarkup(
                                    previewSrc || "",
                                    att.name,
                                    att.id
                                  )
                                }
                                className="text-stone-400 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                                title="Coret / Beri tanda visual pada gambar ini"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(att.id)}
                              className="text-stone-400 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                              title="Hapus lampiran"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Mini Progress Bar when uploading */}
                          {att.isUploading && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 overflow-hidden">
                              <div
                                className="h-full bg-amber-400 transition-all duration-200"
                                style={{ width: `${Math.max(att.uploadProgress ?? 0, 5)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Image @Mention Autocomplete Menu */}
              {showMentionMenu && mentionMatch && mentionMatch.filtered.length > 0 && (
                <div
                  id="image-mention-menu"
                  className="mb-2.5 p-2 rounded-2xl bg-[#141417]/98 border border-white/15 shadow-2xl backdrop-blur-md overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
                >
                  <div className="flex items-center justify-between px-2 py-1 border-b border-white/10 text-[11px] text-stone-400">
                    <span className="flex items-center gap-1.5 font-medium text-stone-200">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Pilih Referensi Media ({mentionMatch.totalCount} Media Tersedia)
                    </span>
                    <span className="text-[10px] text-stone-400">
                      Gunakan <kbd className="px-1 py-0.5 rounded bg-white/10 text-stone-300 font-mono">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-white/10 text-stone-300 font-mono">↓</kbd> dan <kbd className="px-1 py-0.5 rounded bg-white/10 text-stone-300 font-mono">Enter / Tab</kbd>
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 mt-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                    {mentionMatch.filtered.map((item, idx) => {
                      const isSelected = idx === selectedMentionIndex;
                      return (
                        <button
                          key={`${item.tag}_${item.index}_${idx}`}
                          type="button"
                          onMouseEnter={() => setSelectedMentionIndex(idx)}
                          onClick={() => applyImageMention(item.tag)}
                          className={`flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                            isSelected
                              ? "bg-white/15 border border-white/20 text-white shadow-xs"
                              : "hover:bg-white/5 border border-transparent text-stone-300"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Thumbnail preview */}
                            {item.isVideo ? (
                              item.previewUrl ? (
                                <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-amber-500/30 shrink-0 bg-stone-900">
                                  <img
                                    src={item.previewUrl}
                                    alt={item.tag}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    <Video className="w-3.5 h-3.5 text-amber-400" />
                                  </div>
                                </div>
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400 shrink-0 border border-amber-500/30">
                                  <Video className="w-4 h-4 text-amber-400" />
                                </div>
                              )
                            ) : item.previewUrl ? (
                              <img
                                src={item.previewUrl}
                                alt={item.tag}
                                className="w-9 h-9 rounded-lg object-cover border border-white/15 shrink-0 bg-stone-900"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-stone-800 flex items-center justify-center text-stone-400 shrink-0 border border-white/10">
                                <ImageIcon className="w-4 h-4 text-stone-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded font-mono font-semibold text-xs shrink-0 border ${
                                    item.isVideo
                                      ? "bg-amber-500/25 text-amber-300 border-amber-500/50"
                                      : "bg-blue-500/20 text-blue-300 border-blue-500/35"
                                  }`}
                                >
                                  {item.tag}
                                </span>
                                <span className="text-xs text-stone-300 truncate max-w-[180px] sm:max-w-[300px]">
                                  {item.isVideo ? (item.name || `Video #${item.index}`) : `Gambar #${item.index}`}
                                </span>
                              </div>
                              <p className="text-[10px] text-stone-400 truncate mt-0.5">
                                {item.source}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] px-2 py-1 rounded-lg font-mono font-semibold bg-white/5 text-stone-300 group-hover:text-white shrink-0 ml-2">
                            Pilih ({item.tag})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Slash Command Autocomplete Menu */}
              {showSlashMenu && (
                <div
                  id="slash-command-menu"
                  className="mb-2.5 p-1.5 rounded-xl bg-[#141417]/95 border border-white/15 shadow-2xl backdrop-blur-md overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
                >
                  <div className="flex items-center justify-between px-2 py-1 border-b border-white/10 text-[11px] text-stone-400">
                    <span className="flex items-center gap-1.5 font-medium text-stone-300">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Pilihan Skill AI Preset
                    </span>
                    <span className="text-[10px] text-stone-500">
                      Gunakan <kbd className="px-1 py-0.5 rounded bg-white/10 text-stone-300 font-mono">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-white/10 text-stone-300 font-mono">↓</kbd> dan <kbd className="px-1 py-0.5 rounded bg-white/10 text-stone-300 font-mono">Enter</kbd>
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 mt-1 max-h-48 overflow-y-auto custom-scrollbar">
                    {filteredSlashCommands.map((preset, idx) => {
                      const isSelected = idx === selectedSlashIndex;
                      const isDownload = preset.isDownload;
                      return (
                        <button
                          key={preset.command}
                          type="button"
                          onMouseEnter={() => setSelectedSlashIndex(idx)}
                          onClick={() => applySlashCommand(preset)}
                          className={`flex items-center justify-between p-2 rounded-lg text-left transition-all ${
                            isSelected
                              ? isDownload
                                ? "bg-emerald-500/20 border border-emerald-500/40 text-white"
                                : "bg-amber-500/15 border border-amber-500/40 text-white"
                              : "hover:bg-white/5 border border-transparent text-stone-300"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 ${
                                isDownload
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-white/5 text-stone-200"
                              }`}
                            >
                              {preset.icon || "⚡"}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded font-mono font-bold text-xs shrink-0 ${
                                isDownload
                                  ? "bg-emerald-400/20 text-emerald-300"
                                  : "bg-amber-400/20 text-amber-300"
                              }`}
                            >
                              {preset.command}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-xs text-white truncate">
                                  {preset.name}
                                </span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-sans shrink-0 ${
                                    isDownload
                                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                      : preset.badge === "CUSTOM"
                                      ? "bg-purple-500/20 text-purple-300"
                                      : preset.badge === "HARVEST"
                                      ? "bg-emerald-500/20 text-emerald-300"
                                      : preset.badge === "GARDEN"
                                      ? "bg-teal-500/20 text-teal-300"
                                      : "bg-white/10 text-stone-300"
                                  }`}
                                >
                                  {preset.badge}
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-400 truncate max-w-md">
                                {preset.description}
                              </p>
                            </div>
                          </div>
                          <div className="text-[10px] text-stone-400 font-mono shrink-0 pl-2 text-right hidden sm:block">
                            {preset.duration ? `${preset.duration}s • ` : ""}{preset.recommendedAspect}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Native Textarea with Paste listener */}
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={
                  chatMode === "video"
                    ? "Deskripsikan video yang ingin dibuat (Prompt sinematik, gerakan kamera, aksi)..."
                    : chatMode === "image"
                      ? "Deskripsikan gambar yang ingin dibuat (Prompt visual)..."
                      : "Ketik / untuk skill atau paste gambar langsung di sini..."
                }
                rows={1}
                className="w-full bg-transparent text-stone-100 placeholder-stone-500 text-xs sm:text-sm resize-none outline-none border-none p-1 min-h-[36px] max-h-[200px] leading-relaxed font-sans-body"
              />

              {/* Bottom Controls Bar inside the pill */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 pt-1.5 mt-1 select-none min-w-0 w-full">
                {/* Left: Plus upload button and Mode Toggle Pills [Chat] [Create Image] [Create Video] */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 min-w-0">
                  {/* Hidden native file input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) =>
                      e.target.files && processFiles(e.target.files)
                    }
                    multiple
                    accept="image/*,video/*,.pdf,.txt"
                    className="hidden"
                  />
                  {/* Upload Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title={
                      chatMode === "video"
                        ? "Unggah gambar/video referensi (Image-to-Video / Motion)"
                        : chatMode === "image"
                          ? "Unggah gambar referensi (Image-to-Image / Style)"
                          : "Unggah berkas / gambar (atau Paste Ctrl+V)"
                    }
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-stone-300 hover:text-white hover:bg-white/10 active:scale-95 transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  {/* Mode Toggle Pills: [Chat] & [🎨 Image] & [🎬 Video] */}
                  <div className="flex items-center p-0.5 rounded-lg bg-white/5 border border-white/10 shrink-0">
                    <button
                      type="button"
                      onClick={() => setChatMode("chat")}
                      className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        chatMode === "chat"
                          ? "bg-white/15 text-white"
                          : "text-stone-400 hover:text-stone-200"
                      }`}
                      title="Mode Obrolan & Analisis AI Multimodal"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Chat</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatMode("image")}
                      className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        chatMode === "image"
                          ? "bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-bold"
                          : "text-stone-400 hover:text-amber-300"
                      }`}
                      title="Mode Pembuatan Gambar AI (Weavy Image Generator)"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">Image</span>
                      <span className="xs:hidden">Img</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatMode("video")}
                      className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        chatMode === "video"
                          ? "bg-gradient-to-r from-orange-500 to-amber-500 text-stone-950 font-bold"
                          : "text-stone-400 hover:text-orange-400"
                      }`}
                      title="Mode Pembuatan Video AI (RunningHub Video Generator)"
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">Video</span>
                      <span className="xs:hidden">Vid</span>
                    </button>
                  </div>
                </div>

                {/* Right: Mode-Specific Controls */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto min-w-0">
                  {chatMode === "video" ? (
                    <>
                      {/* Video Provider Toggle Button (Gemini / RunningHub) */}
                      <button
                        type="button"
                        onClick={() => handleSelectProvider(selectedChatProvider === "gemini" ? "weavy" : "gemini")}
                        className={`flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                          selectedChatProvider === "gemini"
                            ? "bg-sky-500/15 border-sky-500/30 text-sky-300 hover:bg-sky-500/25"
                            : "bg-orange-500/15 border-orange-500/30 text-orange-300 hover:bg-orange-500/25"
                        }`}
                        title={`Provider Video: ${selectedChatProvider === "gemini" ? "Google Gemini Veo (Klik untuk ganti ke RunningHub)" : "RunningHub (Klik untuk ganti ke Google Gemini)"}`}
                      >
                        {selectedChatProvider === "gemini" ? (
                          <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        ) : (
                          <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        )}
                        <span className="font-semibold text-[11px] sm:text-xs text-stone-100">
                          {selectedChatProvider === "gemini" ? "Gemini" : "RunningHub"}
                        </span>
                      </button>

                      {/* Video Aspect Ratio Selector */}
                      <div className="relative shrink-0" ref={videoRatioDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsVideoRatioDropdownOpen((prev) => !prev)}
                          className="flex items-center gap-1 px-1.5 sm:px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-stone-200 cursor-pointer transition-colors"
                          title="Pilih Rasio Aspek Video"
                        >
                          <Crop className="w-3.5 h-3.5 text-orange-400" />
                          <span className="font-semibold text-orange-300 font-mono text-[11px] sm:text-xs">
                            {selectedVideoAspect}
                          </span>
                          <ChevronDown className="w-3 h-3 text-stone-400" />
                        </button>

                        {/* Video Ratio Dropdown */}
                        {isVideoRatioDropdownOpen && (
                          <div className="absolute bottom-full right-0 mb-2 w-48 sm:w-52 rounded-xl bg-[#1F1F24] border border-white/10 shadow-xl p-2 z-50 max-h-72 overflow-y-auto custom-scrollbar">
                            <div className="px-2 py-1 mb-1 border-b border-white/10 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                                Rasio Video
                              </span>
                              <span className="text-[10px] text-orange-400 font-mono">
                                {selectedVideoAspect}
                              </span>
                            </div>
                            <div className="space-y-0.5">
                              {RUNNINGHUB_ASPECT_RATIOS.filter((r) => !activeVidModelObj.aspectRatios?.length || activeVidModelObj.aspectRatios.includes(r.aspect)).map((r) => {
                                const isSel = selectedVideoAspect === r.aspect;
                                return (
                                  <button
                                    key={r.aspect}
                                    type="button"
                                    onClick={() => {
                                      setSelectedVideoAspect(r.aspect);
                                      setIsVideoRatioDropdownOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer ${
                                      isSel
                                        ? "bg-orange-500/20 text-orange-300 font-semibold border border-orange-500/30"
                                        : "text-stone-300 hover:bg-white/5 hover:text-white"
                                    }`}
                                  >
                                    <div>
                                      <div className="font-medium text-xs text-white">
                                        {r.label}
                                      </div>
                                      <div className="text-[10px] text-stone-400">
                                        {r.desc}
                                      </div>
                                    </div>
                                    {isSel && (
                                      <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Video Duration Selector */}
                      <div className="relative shrink-0" ref={videoDurationDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsVideoDurationDropdownOpen((prev) => !prev)}
                          className="flex items-center gap-1 px-1.5 sm:px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-stone-200 cursor-pointer transition-colors"
                          title="Pilih Durasi Video"
                        >
                          <Play className={`w-3.5 h-3.5 ${selectedChatProvider === "gemini" ? "text-sky-400" : "text-orange-400"}`} />
                          <span className={`font-semibold font-mono text-[11px] sm:text-xs ${selectedChatProvider === "gemini" ? "text-sky-300" : "text-orange-300"}`}>
                            {effectiveVideoDuration}
                          </span>
                          <ChevronDown className="w-3 h-3 text-stone-400" />
                        </button>

                        {/* Duration Dropdown */}
                        {isVideoDurationDropdownOpen && (
                          <div className="absolute bottom-full right-0 mb-2 w-36 rounded-xl bg-[#1F1F24] border border-white/10 shadow-xl p-2 z-50">
                            <div className="px-2 py-1 mb-1 border-b border-white/10 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                                Durasi
                              </span>
                              <span className={`text-[10px] font-mono ${selectedChatProvider === "gemini" ? "text-sky-400" : "text-orange-400"}`}>
                                {effectiveVideoDuration}
                              </span>
                            </div>
                            <div className="space-y-0.5">
                              {(() => {
                                const durList: string[] = allowedDurations;
                                const maxDur = Math.max(...durList.map((d) => parseInt(d, 10) || 0));
                                return durList.map((dur) => ({ dur, isMax: (parseInt(dur, 10) || 0) === maxDur && durList.length > 1 }));
                              })().map(({ dur, isMax }) => {
                                const isSel = effectiveVideoDuration === dur;
                                return (
                                  <button
                                    key={dur}
                                    type="button"
                                    onClick={() => {
                                      setSelectedVideoDuration(dur);
                                      setIsVideoDurationDropdownOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer ${
                                      isSel
                                        ? selectedChatProvider === "gemini"
                                          ? "bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30"
                                          : "bg-orange-500/20 text-orange-300 font-semibold border border-orange-500/30"
                                        : "text-stone-300 hover:bg-white/5 hover:text-white"
                                    }`}
                                  >
                                    <span className="font-medium text-xs text-white">
                                      {dur} {isMax ? "(Maksimal)" : ""}
                                    </span>
                                    {isSel && (
                                      <Check className={`w-3.5 h-3.5 shrink-0 ${selectedChatProvider === "gemini" ? "text-sky-400" : "text-orange-400"}`} />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Video Model Selector (Gemini Omni Flash or RunningHub) - same layout for both providers */}
                      {(() => {
                        const isGeminiVid = selectedChatProvider === "gemini";
                        const vidModels: any[] = isGeminiVid ? GEMINI_VIDEO_MODELS : RUNNINGHUB_VIDEO_MODELS;
                        const providerName = isGeminiVid ? "Gemini" : "RunningHub";
                        const ProviderIcon = isGeminiVid ? Sparkles : Flame;
                        const shortName = isGeminiVid
                          ? activeVidModelObj.name.replace(/^Gemini\s+/, "")
                          : activeVidModelObj.name.replace(" Video", "");
                        const accent = isGeminiVid
                          ? {
                              icon: "text-sky-400",
                              badge: "text-sky-300 bg-sky-500/15 border-sky-500/20",
                              selected: "bg-sky-500/20 text-sky-200 border border-sky-500/30",
                              check: "text-sky-400",
                              label: "text-sky-400",
                            }
                          : {
                              icon: "text-orange-400",
                              badge: "text-orange-300 bg-orange-500/15 border-orange-500/20",
                              selected: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
                              check: "text-orange-400",
                              label: "text-orange-400",
                            };
                        return (
                          <div className="relative shrink-0" ref={videoModelDropdownRef}>
                            <button
                              type="button"
                              onClick={() => setIsVideoModelDropdownOpen((prev) => !prev)}
                              className="flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-stone-200 cursor-pointer transition-colors max-w-[135px] sm:max-w-[190px]"
                              title={`Model Video: ${activeVidModelObj.name} (${providerName})`}
                              aria-haspopup="listbox"
                              aria-expanded={isVideoModelDropdownOpen}
                            >
                              <ProviderIcon className={`w-3.5 h-3.5 shrink-0 ${accent.icon}`} />
                              <span className="font-medium truncate min-w-0 max-w-[70px] xs:max-w-[85px] sm:max-w-[110px]">
                                {shortName}
                              </span>
                              {!isGeminiVid && activeVidModelObj.badge && (
                                <span className={`hidden lg:inline text-[9px] px-1 py-0.5 rounded font-mono border font-bold shrink-0 ${accent.badge}`}>
                                  {activeVidModelObj.badge}
                                </span>
                              )}
                              <ChevronDown
                                className={`w-3 h-3 text-stone-400 shrink-0 transition-transform ${
                                  isVideoModelDropdownOpen ? "rotate-180" : ""
                                }`}
                              />
                            </button>

                            {/* Video Models Dropdown */}
                            {isVideoModelDropdownOpen && (
                              <div className="absolute bottom-full right-0 mb-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-[#1F1F24] border border-white/10 shadow-xl p-2 z-50 max-h-80 overflow-y-auto custom-scrollbar">
                                <div className="p-2 border-b border-white/10 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1 p-0.5 bg-black/40 rounded-lg border border-white/10">
                                    <button
                                      type="button"
                                      onClick={() => handleSelectProvider("gemini")}
                                      className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                        isGeminiVid
                                          ? "bg-sky-500 text-stone-950 font-bold shadow-xs"
                                          : "text-stone-400 hover:text-white"
                                      }`}
                                    >
                                      <Sparkles className="w-3 h-3" />
                                      Gemini
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSelectProvider("weavy")}
                                      className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                        !isGeminiVid
                                          ? "bg-orange-500 text-stone-950 font-bold shadow-xs"
                                          : "text-stone-400 hover:text-white"
                                      }`}
                                    >
                                      <Flame className="w-3 h-3" />
                                      RunningHub
                                    </button>
                                  </div>
                                  <span className={`text-[10px] font-mono font-medium shrink-0 ${accent.label}`}>
                                    {vidModels.length} model
                                  </span>
                                </div>

                                <div className="space-y-1 pt-1.5">
                                  {vidModels.map((m: any) => {
                                    const isSelected = m.id === activeVidModelObj.id;
                                    return (
                                      <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedVideoModel(m.id);
                                          const durs: string[] = m.durations || [];
                                          if (durs.length > 0 && !durs.includes(selectedVideoDuration)) {
                                            setSelectedVideoDuration(m.defaultDuration || durs[0]);
                                          }
                                          const ratios: string[] = m.aspectRatios || [];
                                          if (ratios.length > 0 && !ratios.includes(selectedVideoAspect)) {
                                            setSelectedVideoAspect(ratios[0]);
                                          }
                                          setIsVideoModelDropdownOpen(false);
                                        }}
                                        className={`w-full flex items-start justify-between p-2.5 rounded-md text-left text-xs transition-colors cursor-pointer ${
                                          isSelected
                                            ? accent.selected
                                            : "text-stone-300 hover:bg-white/5 hover:text-white"
                                        }`}
                                      >
                                        <div className="min-w-0 flex-1 pr-2">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-semibold text-xs text-white">{m.name}</span>
                                            {m.badge && (
                                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono border ${accent.badge}`}>
                                                {m.badge}
                                              </span>
                                            )}
                                          </div>
                                          {m.description && (
                                            <p className="text-[10px] text-stone-400 line-clamp-2 mt-0.5 leading-relaxed">
                                              {m.description}
                                            </p>
                                          )}
                                        </div>
                                        <div className="shrink-0 flex flex-col items-end gap-1">
                                          {isSelected && <Check className={`w-3.5 h-3.5 mt-1 ${accent.check}`} />}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Generate Button in Video Mode */}
                      <button
                        type="button"
                        onClick={handleSendMessage}
                        disabled={
                          isAnyAttachmentUploading ||
                          isAnyAttachmentError ||
                          (!inputText.trim() && attachments.length === 0)
                        }
                        title={
                          isAnyAttachmentUploading
                            ? `Harap tunggu, media sedang diunggah (${avgUploadProgress}%)...`
                            : isAnyAttachmentError
                            ? "Ada media yang gagal diunggah. Klik Ulangi atau hapus lampiran."
                            : `Generate Video dengan ${selectedChatProvider === "gemini" ? "Google Gemini" : "RunningHub"} (Enter)`
                        }
                        className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg font-bold flex items-center gap-1.5 text-xs transition-all shrink-0 ${
                          isAnyAttachmentUploading ||
                          isAnyAttachmentError ||
                          (!inputText.trim() && attachments.length === 0)
                            ? "bg-white/10 text-stone-500 cursor-not-allowed opacity-60"
                            : selectedChatProvider === "gemini"
                            ? "bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 active:scale-95 text-white cursor-pointer shadow-md"
                            : "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 active:scale-95 text-stone-950 cursor-pointer shadow-md"
                        }`}
                      >
                        {isAnyAttachmentUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        ) : selectedChatProvider === "gemini" ? (
                          <Sparkles className="w-4 h-4 text-white" />
                        ) : (
                          <Film className="w-4 h-4 text-stone-950" />
                        )}
                        <span className="hidden sm:inline">
                          {isAnyAttachmentUploading
                            ? `Mengunggah ${avgUploadProgress}%`
                            : "Generate"}
                        </span>
                      </button>
                    </>
                  ) : chatMode === "image" ? (
                    <>
                      {/* Aspect Ratio Selector */}
                      <div className="relative shrink-0" ref={ratioDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsRatioDropdownOpen((prev) => !prev)}
                          className="flex items-center gap-1 px-1.5 sm:px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-stone-200 cursor-pointer transition-colors"
                          title="Pilih Rasio Aspek Gambar"
                        >
                          <Crop className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-semibold text-amber-300 font-mono text-[11px] sm:text-xs">
                            {selectedAspectRatio}
                          </span>
                          <ChevronDown className="w-3 h-3 text-stone-400" />
                        </button>

                        {/* Ratio Dropdown */}
                        {isRatioDropdownOpen && (
                          <div className="absolute bottom-full right-0 mb-2 w-48 sm:w-52 rounded-xl bg-[#1F1F24] border border-white/10 shadow-xl p-2 z-50 max-h-72 overflow-y-auto custom-scrollbar">
                            <div className="px-2 py-1 mb-1 border-b border-white/10 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                                Rasio Aspek
                              </span>
                              <span className="text-[10px] text-amber-400 font-mono">
                                {selectedAspectRatio}
                              </span>
                            </div>
                            <div className="space-y-0.5">
                              {[
                                {
                                  ratio: "1:1",
                                  label: "Square (1:1)",
                                  desc: "Feed IG & Profil",
                                },
                                {
                                  ratio: "9:16",
                                  label: "Vertical (9:16)",
                                  desc: "Story / Reels / TikTok",
                                },
                                {
                                  ratio: "16:9",
                                  label: "Landscape (16:9)",
                                  desc: "YouTube / Banner",
                                },
                                {
                                  ratio: "4:5",
                                  label: "Portrait (4:5)",
                                  desc: "Instagram Post",
                                },
                                {
                                  ratio: "3:4",
                                  label: "Portrait (3:4)",
                                  desc: "Standar Vertikal",
                                },
                                {
                                  ratio: "4:3",
                                  label: "Landscape (4:3)",
                                  desc: "Layar Klasik",
                                },
                              ].map((r) => {
                                const isSel = selectedAspectRatio === r.ratio;
                                return (
                                  <button
                                    key={r.ratio}
                                    type="button"
                                    onClick={() => {
                                      setSelectedAspectRatio(r.ratio);
                                      setIsRatioDropdownOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer ${
                                      isSel
                                        ? "bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30"
                                        : "text-stone-300 hover:bg-white/5 hover:text-white"
                                    }`}
                                  >
                                    <div>
                                      <div className="font-medium text-xs text-white">
                                        {r.label}
                                      </div>
                                      <div className="text-[10px] text-stone-400">
                                        {r.desc}
                                      </div>
                                    </div>
                                    {isSel && (
                                      <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Image Model Selector (Weavy or Gemini Auto) */}
                      {selectedChatProvider === "gemini" ? (
                        <div
                          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-medium"
                          title="Model gambar disesuaikan otomatis oleh Gemini Chat"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-[11px]">Gemini Chat Auto</span>
                        </div>
                      ) : (
                        <div className="relative shrink-0" ref={dropdownRef}>
                          <button
                            type="button"
                            onClick={() => setIsModelDropdownOpen((prev) => !prev)}
                            className="flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-stone-200 cursor-pointer transition-colors max-w-[125px] sm:max-w-[170px]"
                            title={`Model Generator: ${activeImgModelObj.name} (~${activeImgModelObj.credits} Kredit)`}
                          >
                            <span className="font-medium truncate max-w-[55px] xs:max-w-[75px] sm:max-w-[100px]">
                              {activeImgModelObj.name}
                            </span>
                            <span className="hidden md:inline text-[9px] px-1 py-0.2 rounded font-mono text-amber-300 bg-amber-500/15 border border-amber-500/20 font-bold shrink-0">
                              ~{activeImgModelObj.credits} Kr
                            </span>
                            <ChevronDown className="w-3 h-3 text-stone-400 shrink-0" />
                          </button>

                          {/* Image Models Dropdown */}
                          {isModelDropdownOpen && (
                            <div className="absolute bottom-full right-0 mb-2 w-[calc(100vw-24px)] max-w-xs sm:max-w-sm rounded-xl bg-[#1F1F24] border border-white/10 shadow-xl p-2 z-50 max-h-80 sm:max-h-96 overflow-y-auto custom-scrollbar">
                              <div className="p-2 border-b border-white/10 flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                                  Model Gambar Weavy
                                </span>
                                <span className="text-[10px] text-amber-400 font-mono font-medium">
                                  {`Saldo: ${typeof currentWeavyAccount?.credits === "number" ? currentWeavyAccount.credits : 0} Kredit`}
                                </span>
                              </div>

                              <div className="space-y-1 pt-1.5">
                                {WEAVY_IMAGE_MODELS.map((m: any) => {
                                  const isSelected = m.id === selectedImageModel;
                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedImageModel(m.id);
                                        setIsModelDropdownOpen(false);
                                      }}
                                      className={`w-full flex items-start justify-between p-2.5 rounded-md text-left text-xs transition-colors cursor-pointer ${
                                        isSelected
                                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                          : "text-stone-300 hover:bg-white/5 hover:text-white"
                                      }`}
                                    >
                                      <div className="min-w-0 flex-1 pr-2">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-semibold text-xs text-white">
                                            {m.name}
                                          </span>
                                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-stone-300 font-mono">
                                            {m.badge}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-stone-400 line-clamp-2 mt-0.5 leading-relaxed">
                                          {m.description}
                                        </p>
                                      </div>
                                      <div className="shrink-0 flex flex-col items-end gap-1">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20">
                                          {m.credits > 0 ? `~${m.credits} Kr` : "Gratis / Pro"}
                                        </span>
                                        {isSelected && (
                                          <Check className="w-3.5 h-3.5 text-amber-400 mt-1" />
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Generate Button in Image Mode */}
                      <button
                        type="button"
                        onClick={handleSendMessage}
                        disabled={
                          isCurrentSessionLoading ||
                          isAnyAttachmentUploading ||
                          isAnyAttachmentError ||
                          (!inputText.trim() && attachments.length === 0)
                        }
                        title={
                          isAnyAttachmentUploading
                            ? `Harap tunggu, media sedang diunggah ke Weavy (${avgUploadProgress}%)...`
                            : isAnyAttachmentError
                            ? "Ada media yang gagal diunggah ke Weavy. Klik Ulangi atau hapus lampiran."
                            : "Generate Gambar (Enter)"
                        }
                        className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg font-bold flex items-center gap-1.5 text-xs transition-all shrink-0 ${
                          isAnyAttachmentUploading ||
                          isAnyAttachmentError ||
                          isCurrentSessionLoading ||
                          (!inputText.trim() && attachments.length === 0)
                            ? "bg-white/10 text-stone-500 cursor-not-allowed opacity-60"
                            : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-stone-950 cursor-pointer shadow-md"
                        }`}
                      >
                        {isCurrentSessionLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-stone-950" />
                        ) : isAnyAttachmentUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-stone-950" />
                        )}
                        <span className="hidden sm:inline">
                          {isCurrentSessionLoading
                            ? "Memproses..."
                            : isAnyAttachmentUploading
                            ? `Mengunggah ${avgUploadProgress}%`
                            : "Generate"}
                        </span>
                      </button>
                    </>
                  ) : (
                    /* Chat Mode Controls */
                    <div
                      className="flex items-center gap-1 sm:gap-1.5 relative shrink-0"
                      ref={dropdownRef}
                    >
                      {/* Storyboard Copilot Toggle (persisten global di localStorage) */}
                      <button
                        type="button"
                        onClick={toggleStoryboardCopilot}
                        className={`flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 rounded-lg border text-xs transition-all cursor-pointer shrink-0 ${
                          isStoryboardCopilotEnabled
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 font-medium"
                            : "bg-white/5 border-white/10 text-stone-400 hover:text-stone-200 hover:bg-white/10"
                        }`}
                        title={
                          isStoryboardCopilotEnabled
                            ? "Matikan Storyboard Copilot (mode storyboard permanen, tersimpan di browser)"
                            : "Aktifkan Storyboard Copilot (mode storyboard permanen, tersimpan di browser)"
                        }
                      >
                        <Film
                          className={`w-3.5 h-3.5 ${
                            isStoryboardCopilotEnabled ? "text-emerald-400" : "text-stone-500"
                          }`}
                        />
                        <span className="hidden xs:inline sm:inline">Copilot</span>
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                            isStoryboardCopilotEnabled
                              ? "bg-emerald-400/25 text-emerald-300 border border-emerald-500/30"
                              : "bg-white/10 text-stone-400"
                          }`}
                        >
                          {isStoryboardCopilotEnabled ? "ON" : "OFF"}
                        </span>
                      </button>

                      {/* Quick Preset Selector & Toggle (Left of Model Selector) */}
                      <div className="relative shrink-0" ref={presetDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsPresetMenuOpen((prev) => !prev)}
                          className={`flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 rounded-lg border text-xs transition-all cursor-pointer ${
                            isQuickPresetEnabled
                              ? "bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25 font-medium"
                              : "bg-white/5 border-white/10 text-stone-400 hover:text-stone-200 hover:bg-white/10"
                          }`}
                          title="Menu Quick Preset AI (Klik untuk memilih preset atau toggle On/Off)"
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${isQuickPresetEnabled ? "text-amber-400" : "text-stone-500"}`} />
                          <span className="hidden xs:inline sm:inline">Preset</span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                              isQuickPresetEnabled
                                ? "bg-amber-400/25 text-amber-300 border border-amber-500/30"
                                : "bg-white/10 text-stone-400"
                            }`}
                          >
                            {isQuickPresetEnabled ? "ON" : "OFF"}
                          </span>
                          <ChevronDown className="w-3 h-3 text-stone-400" />
                        </button>

                        {/* Dropdown / Popover Menu for Quick Presets */}
                        {isPresetMenuOpen && (
                          <div className="absolute bottom-full right-0 sm:right-auto sm:left-0 mb-2 w-[calc(100vw-32px)] max-w-xs sm:max-w-sm rounded-xl bg-[#1F1F24] border border-white/10 shadow-xl p-2.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                            {/* Header with Switch ON/OFF Toggle */}
                            <div className="p-2 border-b border-white/10 flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                                  Quick Preset AI
                                </span>
                              </div>
                              {/* Toggle Switch */}
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-stone-400">
                                  {isQuickPresetEnabled ? "Aktif" : "Nonaktif"}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsQuickPresetEnabled((prev) => {
                                      const next = !prev;
                                      try {
                                        localStorage.setItem("chat_quick_preset_enabled", String(next));
                                      } catch (err) {}
                                      return next;
                                    });
                                  }}
                                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative flex items-center ${
                                    isQuickPresetEnabled ? "bg-amber-500" : "bg-stone-700"
                                  }`}
                                  title={isQuickPresetEnabled ? "Matikan Quick Preset" : "Aktifkan Quick Preset"}
                                >
                                  <div
                                    className={`w-4 h-4 rounded-full bg-stone-950 transition-transform ${
                                      isQuickPresetEnabled ? "translate-x-4" : "translate-x-0"
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>

                            {/* Presets List */}
                            <div className="space-y-1 pt-2 max-h-72 overflow-y-auto custom-scrollbar">
                              <p className="text-[10px] text-stone-400 px-2 pb-1">
                                Klik salah satu preset untuk menggunakannya secara instan:
                              </p>
                              {SLASH_COMMANDS.map((preset) => {
                                const isDownload = preset.isDownload;
                                return (
                                  <button
                                    key={preset.command}
                                    type="button"
                                    onClick={() => {
                                      applySlashCommand(preset);
                                      setIsPresetMenuOpen(false);
                                    }}
                                    className={`w-full flex items-start justify-between p-2 rounded-lg text-left text-xs transition-colors group border border-transparent cursor-pointer ${
                                      isDownload
                                        ? "hover:bg-emerald-500/10 hover:border-emerald-500/20"
                                        : "hover:bg-white/5 hover:border-white/10"
                                    }`}
                                  >
                                    <div className="flex items-start gap-2.5 min-w-0 pr-2">
                                      <span
                                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 mt-0.5 ${
                                          isDownload
                                            ? "bg-emerald-500/20 text-emerald-300"
                                            : "bg-white/5 text-stone-200"
                                        }`}
                                      >
                                        {preset.icon || "⚡"}
                                      </span>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className={`font-semibold text-xs truncate ${
                                              isDownload
                                                ? "text-emerald-300 group-hover:text-emerald-200"
                                                : "text-stone-200 group-hover:text-amber-300"
                                            }`}
                                          >
                                            {preset.name}
                                          </span>
                                          <span
                                            className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold shrink-0 ${
                                              isDownload
                                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                                : preset.badge === "CUSTOM"
                                                ? "bg-purple-500/20 text-purple-300"
                                                : preset.badge === "HARVEST"
                                                ? "bg-emerald-500/20 text-emerald-300"
                                                : preset.badge === "GARDEN"
                                                ? "bg-teal-500/20 text-teal-300"
                                                : "bg-amber-500/15 text-amber-300"
                                            }`}
                                          >
                                            {preset.badge}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-stone-400 line-clamp-2 mt-0.5 leading-relaxed">
                                          {preset.description}
                                        </p>
                                      </div>
                                    </div>
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 mt-0.5 ${
                                        isDownload
                                          ? "bg-emerald-500/20 text-emerald-300 group-hover:bg-emerald-500/30"
                                          : "bg-white/5 text-stone-300 group-hover:bg-amber-500/20 group-hover:text-amber-300"
                                      }`}
                                    >
                                      {preset.command}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Provider Selector (Weavy / Gemini) */}
                      <div className="relative shrink-0" ref={providerDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsProviderDropdownOpen((prev) => !prev)}
                          className={`flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                            selectedChatProvider === "gemini"
                              ? "bg-blue-500/15 border-blue-500/30 text-blue-300 hover:bg-blue-500/25"
                              : "bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25"
                          }`}
                          title={`Provider AI: ${activeProviderObj.name} (${activeProviderObj.badge})`}
                        >
                          <Zap className={`w-3.5 h-3.5 ${selectedChatProvider === "gemini" ? "text-blue-400" : "text-amber-400"}`} />
                          <span className="font-semibold text-xs text-stone-100">
                            {activeProviderObj.name}
                          </span>
                          <ChevronDown className="w-3 h-3 text-stone-400 shrink-0" />
                        </button>

                        {/* Provider Dropdown Menu */}
                        {isProviderDropdownOpen && (
                          <div className="absolute bottom-full right-0 sm:right-auto sm:left-0 mb-2 w-60 sm:w-64 rounded-xl bg-[#1F1F24] border border-white/10 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                            <div className="p-2 border-b border-white/10 flex items-center justify-between">
                              <span className="text-[11px] font-bold text-stone-300 uppercase tracking-wider">
                                Pilih Provider LLM
                              </span>
                            </div>
                            <div className="space-y-1 pt-1.5">
                              {CHAT_PROVIDERS.map((prov) => {
                                const isSelected = selectedChatProvider === prov.id;
                                return (
                                  <button
                                    key={prov.id}
                                    type="button"
                                    onClick={() => handleSelectProvider(prov.id)}
                                    className={`w-full flex items-start justify-between p-2.5 rounded-md text-left text-xs transition-colors cursor-pointer ${
                                      isSelected
                                        ? prov.id === "gemini"
                                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                        : "text-stone-300 hover:bg-white/5 hover:text-white"
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1 pr-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-xs text-white">
                                          {prov.name}
                                        </span>
                                        <span
                                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                                            prov.id === "gemini"
                                              ? "bg-blue-500/20 text-blue-300"
                                              : "bg-amber-500/20 text-amber-300"
                                          }`}
                                        >
                                          {prov.badge}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-stone-400 line-clamp-2 mt-0.5 leading-relaxed">
                                        {prov.description}
                                      </p>
                                    </div>
                                    {isSelected && (
                                      <Check
                                        className={`w-3.5 h-3.5 shrink-0 mt-1 ${
                                          prov.id === "gemini" ? "text-blue-400" : "text-amber-400"
                                        }`}
                                      />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* LLM Model Selector (Filtered by Provider) */}
                      <div className="relative shrink-0" ref={dropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsModelDropdownOpen((prev) => !prev)}
                          className="flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-stone-200 cursor-pointer transition-colors max-w-[125px] sm:max-w-[170px]"
                          title={`Model LLM: ${activeModelObj.name} (${activeBadge.label})`}
                        >
                          <span className="font-medium truncate max-w-[55px] xs:max-w-[75px] sm:max-w-[110px]">
                            {activeModelObj.name}
                          </span>
                          <span
                            className={`hidden lg:inline text-[9px] px-1 py-0.2 rounded font-mono shrink-0 ${activeBadge.color}`}
                          >
                            {activeBadge.label}
                          </span>
                          <ChevronDown className="w-3 h-3 text-stone-400 shrink-0" />
                        </button>

                        {/* Dropdown Menu for Models (Filtered by Selected Provider) */}
                        {isModelDropdownOpen && (
                          <div className="absolute bottom-full right-0 mb-2 w-[calc(100vw-24px)] max-w-xs sm:max-w-sm rounded-xl bg-[#1F1F24] border border-white/10 shadow-2xl p-2 z-50 max-h-80 sm:max-h-96 overflow-y-auto custom-scrollbar">
                            <div className="p-2 border-b border-white/10 flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                                {selectedChatProvider === "gemini" ? "Model LLM Gemini" : "Model LLM Weavy"}
                              </span>
                              <span className="text-[10px] text-stone-500 font-mono">
                                {selectedChatProvider === "gemini"
                                  ? `${GEMINI_LLM_MODELS.length} Model`
                                  : `${WEAVY_LLM_MODELS.length} Model`}
                              </span>
                            </div>

                            {selectedChatProvider === "gemini" ? (
                              <div className="space-y-0.5 pt-1">
                                {GEMINI_LLM_MODELS.map((m) => {
                                  const isSelected = m.id === selectedModel;
                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedModel(m.id);
                                        setIsModelDropdownOpen(false);
                                      }}
                                      className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                                        isSelected
                                          ? "bg-white/10 text-white font-medium"
                                          : "text-stone-300 hover:bg-white/5 hover:text-white"
                                      }`}
                                    >
                                      <div className="w-4 h-4 flex items-center justify-center shrink-0 mt-0.5">
                                        {isSelected && (
                                          <Check className="w-4 h-4 text-white" />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-xs sm:text-[13px] text-white">
                                            {m.name}
                                          </span>
                                          {m.badge === "New" && (
                                            <span className="text-[10px] font-medium px-2 py-0.2 rounded-full bg-[#35363c] text-stone-200">
                                              New
                                            </span>
                                          )}
                                        </div>
                                        {m.description && (
                                          <p className="text-[11px] text-stone-400 mt-0.5 leading-snug">
                                            {m.description}
                                          </p>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              (["Anthropic", "Google", "OpenAI", "Meta"] as const).map((provider) => {
                                const provModels = WEAVY_LLM_MODELS.filter(
                                  (m) => m.provider === provider,
                                );
                                if (provModels.length === 0) return null;

                                return (
                                  <div key={provider} className="pt-2">
                                    <p className="px-2.5 py-1 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                                      {provider}
                                    </p>
                                    <div className="space-y-0.5">
                                      {provModels.map((m) => {
                                        const isSelected = m.id === selectedModel;
                                        const speed = MODEL_SPEED_BADGES[m.id] || {
                                          label: "Standar",
                                          color: "text-stone-300 bg-white/5",
                                        };
                                        return (
                                          <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => {
                                              setSelectedModel(m.id);
                                              setIsModelDropdownOpen(false);
                                            }}
                                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-left text-xs transition-colors cursor-pointer ${
                                              isSelected
                                                ? "bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30"
                                                : "text-stone-300 hover:bg-white/5 hover:text-white"
                                            }`}
                                          >
                                            <div className="min-w-0 flex-1 pr-2">
                                              <div className="flex items-center gap-1.5">
                                                <span className="truncate font-semibold text-white">
                                                  {m.name}
                                                </span>
                                                {m.isDefault && (
                                                  <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-300">
                                                    Default
                                                  </span>
                                                )}
                                              </div>
                                              {m.description && (
                                                <p className="text-[10px] text-stone-500 truncate mt-0.5">
                                                  {m.description}
                                                </p>
                                              )}
                                            </div>
                                            <span
                                              className={`text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 ${speed.color}`}
                                            >
                                              {speed.label}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>

                      {/* Rightmost: Send button */}
                      <button
                        type="button"
                        onClick={handleSendMessage}
                        disabled={
                          !hasContent ||
                          isCurrentSessionLoading ||
                          isAnyAttachmentUploading ||
                          isAnyAttachmentError
                        }
                        title={
                          isAnyAttachmentUploading
                            ? `Menunggu media selesai diunggah ke Weavy (${avgUploadProgress}%)...`
                            : isAnyAttachmentError
                            ? "Ada media yang gagal diunggah. Klik Ulangi pada lampiran."
                            : hasContent
                            ? "Kirim pesan (Enter)"
                            : "Ketik pesan untuk mengirim"
                        }
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                          hasContent &&
                          !isCurrentSessionLoading &&
                          !isAnyAttachmentUploading &&
                          !isAnyAttachmentError
                            ? "bg-[#D95C32] hover:bg-[#C24F27] active:scale-95 text-white cursor-pointer shadow-sm"
                            : isAnyAttachmentUploading
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-wait"
                            : "bg-white/10 text-stone-500 cursor-not-allowed"
                        }`}
                      >
                        {isAnyAttachmentUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        ) : (
                          <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Lightbox Image Preview Modal with Zoom (+/-), Wheel Zoom & Pan Dragging */}
      {previewImageUrl && (
        <div
          onClick={handleClosePreviewModal}
          onMouseMove={handlePreviewMouseMove}
          onMouseUp={handlePreviewMouseUp}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-3 sm:p-4 select-none"
        >
          {/* Top Bar with Zoom & Close Controls */}
          <div
            className="w-full max-w-4xl flex items-center justify-between z-20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Zoom Controls Pill */}
            <div className="flex items-center gap-1 sm:gap-2 px-3 py-1.5 rounded-2xl bg-stone-900/90 border border-white/15 backdrop-blur-md shadow-2xl">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={previewZoom <= 0.5}
                title="Perkecil (Zoom Out)"
                className="p-1.5 rounded-xl text-stone-300 hover:text-white hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                <ZoomOut className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>

              <span className="text-xs sm:text-sm font-mono font-bold text-amber-400 min-w-[50px] sm:min-w-[58px] text-center">
                {Math.round(previewZoom * 100)}%
              </span>

              <button
                type="button"
                onClick={handleZoomIn}
                disabled={previewZoom >= 5}
                title="Perbesar (Zoom In)"
                className="p-1.5 rounded-xl text-stone-300 hover:text-white hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                <ZoomIn className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>

              {previewZoom !== 1 && (
                <button
                  type="button"
                  onClick={handleResetZoom}
                  title="Reset Zoom (100%)"
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-white/10 text-stone-300 hover:text-white hover:bg-white/20 transition-colors ml-1 cursor-pointer font-medium"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Close Button Top Right */}
            <button
              type="button"
              onClick={handleClosePreviewModal}
              className="p-2 rounded-2xl bg-stone-900/90 hover:bg-stone-800 text-stone-300 hover:text-white border border-white/15 shadow-xl transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="Tutup (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Center Stage: Interactive Zoomable & Pannable Image with Wheel Support */}
          <div
            className="relative w-full flex-1 flex items-center justify-center overflow-hidden my-2"
            onWheel={handlePreviewWheel}
            onMouseDown={handlePreviewMouseDown}
            style={{
              cursor: previewZoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
            }}
            onClick={(e) => {
              // Click on backdrop inside stage closes modal only if not dragged
              if (e.target === e.currentTarget && previewZoom === 1) {
                handleClosePreviewModal();
              }
            }}
          >
            <div
              className="relative transition-transform ease-out will-change-transform"
              style={{
                transform: `translate3d(${previewPan.x}px, ${previewPan.y}px, 0px) scale(${previewZoom})`,
                transitionDuration: isPanning ? '0ms' : '150ms',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={previewImageUrl}
                alt="Preview"
                draggable={false}
                className="max-w-[90vw] max-h-[70vh] sm:max-h-[74vh] rounded-2xl object-contain shadow-2xl border border-white/20 select-none pointer-events-none"
              />
            </div>
          </div>

          {/* Bottom Action Buttons Bar */}
          <div
            className="w-full max-w-4xl flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 z-20 pt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                const url = previewImageUrl;
                handleClosePreviewModal();
                handleOpenMarkup(url, "Preview Gambar");
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-lg cursor-pointer transition-transform active:scale-95"
            >
              <Pencil className="w-4 h-4 text-stone-950" />
              <span>Coret & Beri Tanda Visual</span>
            </button>
            <button
              type="button"
              onClick={() => {
                downloadMediaFile(previewImageUrl, `preview_${Date.now()}.png`);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs shadow-lg cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Gambar</span>
            </button>
            <button
              type="button"
              onClick={handleClosePreviewModal}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Canvas Markup / Coretan Modal for Chat */}
      <CanvasMarkupModal
        isOpen={markupModal.isOpen}
        onClose={() => setMarkupModal((prev) => ({ ...prev, isOpen: false }))}
        imageUrl={markupModal.imageUrl}
        sourceNodeTitle={markupModal.sourceTitle}
        onSaveMarkup={handleSaveMarkup}
        isChatMode={true}
      />
    </div>
  );
};
export default ChatView;