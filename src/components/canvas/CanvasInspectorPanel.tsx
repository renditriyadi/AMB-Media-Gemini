import React, { useState, useEffect, useRef } from 'react';
import { GEMINI_MAX_CREDITS } from '../../lib/provider';
import {
  X,
  Sparkles,
  ArrowRight,
  Loader2,
  Image as ImageIcon,
  Type,
  Layers,
  ChevronDown,
  Bot,
  SlidersHorizontal,
  Brain,
  Check,
  Video,
  Film,
  User,
  Mic,
  Copy,
  Volume2,
  Zap,
  Settings,
} from 'lucide-react';
import { CHAT_SLASH_PRESETS, getPresetLabel } from '../chat/chatPresets';
import {
  STORYBOARD_TIKTOK_STYLE_OPTIONS,
  STORYBOARD_HOOK_PATTERN_OPTIONS,
} from '../../lib/storyboardDirector';
import {
  CanvasNode,
  WEAVY_IMAGE_MODELS,
  WEAVY_LLM_MODELS,
  PROMPT_ENHANCER_SYSTEM_PRESETS,
  GEMINI_VIDEO_MODELS,
  GEMINI_LLM_MODELS,
  CHAT_PROVIDERS,
} from '../../types/canvas';
import type { CanvasGeminiAccountAssignment } from '../../lib/canvasGeminiAccountPlanner';

const GEMINI_ICON_URL =
  'https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg';
const WEAVY_ICON_URL = 'https://app.weavy.ai/favicon.ico';

// Ikon resmi provider. Weavy jatuh ke ikon Zap kalau favicon gagal dimuat (offline / diblokir).
const GeminiIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <img src={GEMINI_ICON_URL} alt="Gemini" draggable={false} className={`${className} object-contain shrink-0`} />
);

const WeavyIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return <Zap className={`${className} text-amber-400 shrink-0`} />;
  return (
    <img
      src={WEAVY_ICON_URL}
      alt="Weavy"
      draggable={false}
      onError={() => setFailed(true)}
      className={`${className} object-contain rounded-[3px] shrink-0`}
    />
  );
};

interface CanvasInspectorPanelProps {
  selectedNode: CanvasNode | null;
  canvasNodes?: CanvasNode[];
  geminiAccountAssignments?: Map<string, CanvasGeminiAccountAssignment>;
  onClose: () => void;
  onUpdateData: (nodeId: string, newData: any) => void;
  onRunNode?: (nodeId: string) => void;
  onRemoveWatermark?: (nodeId: string) => Promise<void>;
  onDeleteNode?: (nodeId: string) => void;
  isExecuting?: boolean;
  executingProgress?: number;
  credits?: number;
  onOpenFullPreview?: (url: string, title?: string) => void;
  connectedPrompt?: string;
}

type CanvasInspectorContentProps = Omit<CanvasInspectorPanelProps, 'selectedNode'> & {
  selectedNode: CanvasNode;
};

// Isi panel. selectedNode dijamin ada (dicek di wrapper di bawah), sehingga semua hook
// di sini selalu dipanggil dengan urutan yang sama di setiap render.
const CanvasInspectorContent: React.FC<CanvasInspectorContentProps> = ({
  selectedNode,
  canvasNodes = [],
  geminiAccountAssignments,
  onClose,
  onUpdateData,
  onRunNode,
  onRemoveWatermark,
  isExecuting = false,
  executingProgress = 0,
  credits = 0,
  connectedPrompt,
}) => {
  const nodeData = selectedNode.data || {};
  const savedVidsDuration = Number(nodeData.duration);
  const vidsDuration = Number.isInteger(savedVidsDuration)
    ? Math.min(15, Math.max(3, savedVidsDuration))
    : 10;
  const [runs, setRuns] = useState<number>(nodeData.runs || 1);
  const [isRemovingWatermark, setIsRemovingWatermark] = useState(false);
  const [watermarkError, setWatermarkError] = useState<string | null>(null);

  useEffect(() => {
    setRuns(selectedNode?.data?.runs || 1);
  }, [selectedNode?.id]);

  // Model-specific calculations
  const isLLMNode = selectedNode.type === 'anyLLM' || selectedNode.type === 'promptEnhancer';
  const isGeminiVideoNode = selectedNode.type === 'geminiVideo';
  const isVidsVideoNode = selectedNode.type === 'vidsVideo';
  const isVideoStitcherNode = selectedNode.type === 'videoStitcher';
  const supportsVidsWatermarkRemoval = isVidsVideoNode || isVideoStitcherNode;
  const isStoryboardNode = selectedNode.type === 'storyboard';

  const [vidsAccounts, setVidsAccounts] = useState<Array<{
    id?: string;
    email?: string;
    name?: string;
    displayName?: string;
    isActive?: boolean;
    credits?: number;
    totalCredits?: number;
  }>>(() => {
    try {
      const raw = localStorage.getItem('vids_accounts');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('[CanvasInspector] Could not read Google Vids accounts:', error);
      return [];
    }
  });

  useEffect(() => {
    const refreshVidsAccounts = () => {
      try {
        const raw = localStorage.getItem('vids_accounts');
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) {
          throw new Error('Daftar akun Google Vids harus berupa array.');
        }
        setVidsAccounts(parsed);
      } catch (error) {
        console.error('[CanvasInspector] Could not refresh Google Vids accounts:', error);
      }
    };

    window.addEventListener('vids_accounts_updated', refreshVidsAccounts);
    window.addEventListener('storage', refreshVidsAccounts);
    return () => {
      window.removeEventListener('vids_accounts_updated', refreshVidsAccounts);
      window.removeEventListener('storage', refreshVidsAccounts);
    };
  }, []);

  const selectedVidsAccount = vidsAccounts.find(
    (account) => account.id === nodeData.accountId || account.email === nodeData.accountId
  ) || vidsAccounts.find((account) => account.isActive) || vidsAccounts[0];

  // Gemini Video calculations & accounts
  const geminiModelDisplayName = 'Gemini Omni Flash';

  const [geminiAccounts, setGeminiAccounts] = useState<Array<{
    id: string;
    name?: string;
    displayName?: string;
    email?: string;
    credits?: number;
    isActive?: boolean;
  }>>(() => {
    try {
      const raw = localStorage.getItem('gemini_accounts');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((a: any) => ({
            ...a,
            name: a.displayName || a.name || a.email || 'Akun Google',
            email: a.email || '',
            credits: typeof a.credits === 'number' ? Math.min(GEMINI_MAX_CREDITS, Math.max(0, a.credits)) : 0,
          }));
        }
      }
    } catch (e) {}
    return [];
  });

  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleAccountsUpdated = () => {
      try {
        const raw = localStorage.getItem('gemini_accounts');
        const parsed = raw ? JSON.parse(raw) : [];
        setGeminiAccounts(
          Array.isArray(parsed)
            ? parsed.map((a: any) => ({
                ...a,
                name: a.displayName || a.name || a.email || 'Akun Google',
                email: a.email || '',
                credits: typeof a.credits === 'number' ? Math.min(GEMINI_MAX_CREDITS, Math.max(0, a.credits)) : 0,
              }))
            : []
        );
      } catch (error) {
        console.error('[CanvasInspector] Could not refresh Gemini accounts:', error);
      }
    };

    window.addEventListener('gemini_accounts_updated', handleAccountsUpdated);
    window.addEventListener('storage', handleAccountsUpdated);
    return () => {
      window.removeEventListener('gemini_accounts_updated', handleAccountsUpdated);
      window.removeEventListener('storage', handleAccountsUpdated);
    };
  }, []);

  useEffect(() => {
    if (!isAccountDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setIsAccountDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isAccountDropdownOpen]);

  const isAutoMode = !nodeData.accountId || nodeData.accountId === 'auto';
  const selectedGeminiAssignment = geminiAccountAssignments?.get(selectedNode.id);

  const currentSelectedAccount = (() => {
    if (!isAutoMode && nodeData.accountId) {
      const found = geminiAccounts.find((a) => a.id === nodeData.accountId);
      if (found) return found;
    }
    const assignment = geminiAccountAssignments?.get(selectedNode.id);
    if (isAutoMode && assignment?.accountId) {
      const plannedAccount = geminiAccounts.find((account) => account.id === assignment.accountId);
      if (plannedAccount) return plannedAccount;
    }
    if (isAutoMode && assignment?.status === 'queued') return null;
    // Jika auto-mode, prioritaskan akun yang memiliki sisa kuota > 0
    const available = geminiAccounts.find((a) => (typeof a.credits === 'number' ? a.credits : 0) > 0);
    if (available) return available;

    try {
      const savedActiveId = localStorage.getItem('gemini_active_account_id');
      if (savedActiveId) {
        const found = geminiAccounts.find((a) => a.id === savedActiveId);
        if (found) return found;
      }
    } catch (e) {}
    const active = geminiAccounts.find((a) => a.isActive);
    if (active) return active;
    return geminiAccounts[0] || null;
  })();

  const handleSelectAccount = (account: any | 'auto') => {
    if (account === 'auto') {
      onUpdateData(selectedNode.id, {
        ...nodeData,
        accountId: 'auto',
        accountEmail: 'Auto-Switch (Multi-Account)',
      });
      setIsAccountDropdownOpen(false);
      return;
    }

    onUpdateData(selectedNode.id, {
      ...nodeData,
      accountId: account.id,
      accountEmail: account.email || account.name,
    });

    setIsAccountDropdownOpen(false);
  };

  const getAccountAssignmentOwner = (accountId: string) => {
    const assignments: CanvasGeminiAccountAssignment[] = geminiAccountAssignments
      ? [...geminiAccountAssignments.values()]
      : [];
    const owner = assignments.find(
      (assignment) =>
        assignment.accountId === accountId &&
        (assignment.status === 'assigned' || assignment.status === 'conflict')
    );
    if (!owner || owner.nodeId === selectedNode.id) return null;
    const ownerNode = canvasNodes.find((node) => node.id === owner.nodeId);
    return { assignment: owner, title: ownerNode?.title || 'Node Gemini lain' };
  };

  const handleGeminiModelChange = (_newModelId: string) => {
    onUpdateData(selectedNode.id, {
      ...nodeData,
      modelId: 'gemini-omni-1.1-flash',
      modelDisplayName: 'Gemini Omni Flash',
      duration: '10s',
      aspectRatio: nodeData.aspectRatio || '9:16',
    });
  };

  const handleDurationChange = (duration: string) => {
    onUpdateData(selectedNode.id, {
      ...nodeData,
      duration,
    });
  };

  // LLM calculations
  const currentLLMModelId = nodeData.model || (selectedNode.type === 'anyLLM' ? 'google/gemini-3-pro' : 'openai/gpt-5.6-sol');
  const matchedLLMModel =
    WEAVY_LLM_MODELS.find((m) => m.id === currentLLMModelId) ||
    WEAVY_LLM_MODELS.find((m) => nodeData.modelDisplayName && m.name.toLowerCase() === nodeData.modelDisplayName.toLowerCase()) ||
    WEAVY_LLM_MODELS[0];

  const llmDisplayName = nodeData.modelDisplayName || matchedLLMModel?.name || 'Any LLM';
  const llmCreditsCost = nodeData.creditsCost ?? 1;
  const llmTotalCost = llmCreditsCost * runs;
  const temperature = typeof nodeData.temperature === 'number' ? nodeData.temperature : 0.7;
  const isThinking = Boolean(nodeData.thinking);

  const handleLLMModelChange = (newModelId: string) => {
    const selected = WEAVY_LLM_MODELS.find((m) => m.id === newModelId);
    if (!selected) return;

    onUpdateData(selectedNode.id, {
      ...nodeData,
      model: selected.id,
      modelDisplayName: selected.name,
      creditsCost: 1,
    });
  };

  // Image Model calculations
  const currentModelId = nodeData.modelId || 'gpt_image_1_edit';
  const matchedModel =
    WEAVY_IMAGE_MODELS.find((m) => m.id === currentModelId) ||
    WEAVY_IMAGE_MODELS.find((m) =>
      nodeData.modelDisplayName && m.name.toLowerCase() === nodeData.modelDisplayName.toLowerCase()
    ) ||
    WEAVY_IMAGE_MODELS[3]; // Default to ChatGPT Images 2.0 Edit

  const modelDisplayName = nodeData.modelDisplayName || matchedModel?.name || selectedNode.title || 'ChatGPT Images 2.0 Edit';
  const creditsCost = nodeData.creditsCost ?? matchedModel?.credits ?? 9;
  const totalCost = creditsCost * runs;

  const handleModelChange = (newModelId: string) => {
    const selected = WEAVY_IMAGE_MODELS.find((m) => m.id === newModelId);
    if (!selected) return;

    onUpdateData(selectedNode.id, {
      ...nodeData,
      modelId: selected.id,
      modelDisplayName: selected.name,
      creditsCost: selected.credits,
      aspectRatio: nodeData.aspectRatio || selected.defaultAspectRatio,
      resolution: nodeData.resolution || selected.defaultResolution,
    });
  };

  const handleQualityChange = (quality: string) => {
    onUpdateData(selectedNode.id, {
      ...nodeData,
      quality,
    });
  };

  const handleResolutionChange = (resolution: string) => {
    onUpdateData(selectedNode.id, {
      ...nodeData,
      resolution,
    });
  };

  const handleAspectRatioChange = (aspectRatio: string) => {
    onUpdateData(selectedNode.id, {
      ...nodeData,
      aspectRatio,
    });
  };

  // Helper for model icon badge
  const renderModelIcon = () => {
    const name = modelDisplayName.toLowerCase();
    if (name.includes('flare') || name.includes('gpt image 2.5') || name.includes('2.5')) {
      return (
        <div className="w-5 h-5 rounded-md bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-xs shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (name.includes('chatgpt') || name.includes('gpt') || name.includes('openai')) {
      return (
        <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (name.includes('banana') || name.includes('gemini') || name.includes('google')) {
      return (
        <div className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (name.includes('seedream') || name.includes('bytedance')) {
      return (
        <div className="w-5 h-5 rounded-md bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (name.includes('grok') || name.includes('xai')) {
      return (
        <div className="w-5 h-5 rounded-md bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      );
    }
    return (
      <div className="w-5 h-5 rounded-md bg-white/10 text-stone-300 flex items-center justify-center font-bold text-xs shrink-0">
        <Sparkles className="w-3.5 h-3.5" />
      </div>
    );
  };

  const renderLLMIcon = () => {
    const provider = (matchedLLMModel?.provider || '').toLowerCase();
    const id = (matchedLLMModel?.id || '').toLowerCase();
    if (provider.includes('anthropic') || id.includes('claude')) {
      return (
        <div className="w-5 h-5 rounded-md bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-xs shrink-0" title="Anthropic Claude">
          <Bot className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (provider.includes('google') || id.includes('gemini')) {
      return (
        <div className="w-5 h-5 rounded-md bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs shrink-0" title="Google Gemini">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (provider.includes('openai') || id.includes('gpt')) {
      return (
        <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0" title="OpenAI GPT">
          <Brain className="w-3.5 h-3.5" />
        </div>
      );
    }
    return (
      <div className="w-5 h-5 rounded-md bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0" title="Meta LLaMA">
        <Bot className="w-3.5 h-3.5" />
      </div>
    );
  };

  return (
    <div
      className="canvas-light-skin fixed md:relative inset-y-0 right-0 z-50 md:z-auto w-[360px] max-w-full h-screen shrink-0 bg-[#18181c] border-l border-white/10 shadow-2xl md:shadow-none flex flex-col overflow-hidden text-stone-200 select-none animate-in fade-in slide-in-from-right-4 duration-200"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* 1. Header */}
      <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
        <div className="flex items-center gap-2.5 overflow-hidden">
          {selectedNode.type === 'imageModel' ? (
            renderModelIcon()
          ) : isStoryboardNode ? (
            <div className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Film className="w-3.5 h-3.5" />
            </div>
          ) : isLLMNode ? (
            renderLLMIcon()
          ) : isGeminiVideoNode ? (
            <div className="w-5 h-5 rounded-md bg-stone-800 border border-white/10 text-stone-200 flex items-center justify-center p-0.5">
              <img
                src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg"
                alt="Gemini Omni Flash"
                className="w-3.5 h-3.5 object-contain"
              />
            </div>
          ) : isVidsVideoNode ? (
            <img
              src="https://ssl.gstatic.com/docs/videos/images/favicon-2026-v2.ico"
              alt="Google Vids"
              className="w-5 h-5 object-contain rounded"
              referrerPolicy="no-referrer"
              onError={(event) => {
                event.currentTarget.src = 'https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_flix_x32.png';
              }}
            />
          ) : isVideoStitcherNode ? (
            <div className="w-5 h-5 rounded-md bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Film className="w-3.5 h-3.5" />
            </div>
          ) : selectedNode.type === 'prompt' ? (
            <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Type className="w-3.5 h-3.5" />
            </div>
          ) : selectedNode.type === 'imageInput' ? (
            <div className="w-5 h-5 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <ImageIcon className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-md bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5" />
            </div>
          )}
          <h3 className="text-xs font-semibold text-white truncate">
            {selectedNode.type === 'imageModel'
              ? modelDisplayName
              : isStoryboardNode
              ? `Storyboard (${selectedNode.data?.presetKey || '/facelessgardenugc'})`
              : isLLMNode
              ? llmDisplayName
              : isGeminiVideoNode
              ? geminiModelDisplayName
              : isVidsVideoNode
              ? 'Vids Omni'
              : isVideoStitcherNode
              ? 'Video Stitcher'
              : selectedNode.title || 'Node Settings'}
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {(selectedNode.type === 'imageModel' || isLLMNode || isStoryboardNode) && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-stone-300 text-[11px] font-semibold">
              <span className="text-amber-400 text-xs">✳</span>
              <span>
                {isStoryboardNode ? ((nodeData.provider || 'weavy') === 'weavy' ? 1 : 0) : isLLMNode ? llmCreditsCost : creditsCost}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
            title="Tutup Inspector"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Content Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 text-xs custom-scrollbar flex flex-col">
        {/* SPECIFIC TO ANY LLM / PROMPT ENHANCER NODE */}
        {isLLMNode && (
          <div className="space-y-3.5">
            {/* Field: Model */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-stone-400 flex items-center justify-between">
                <span>Model</span>
                <span className="text-[10px] text-stone-500">Weavy LLM Engine</span>
              </label>
              <div className="relative">
                <select
                  value={matchedLLMModel.id}
                  onChange={(e) => handleLLMModelChange(e.target.value)}
                  className="w-full bg-[#202026] text-white border border-white/10 rounded-xl px-3 py-2 text-xs appearance-none focus:outline-none focus:border-purple-500/50 cursor-pointer pr-8 font-medium"
                >
                  <optgroup label="Anthropic Claude" className="bg-[#202026] text-stone-300 font-semibold">
                    {WEAVY_LLM_MODELS.filter((m) => m.provider.toLowerCase().includes('anthropic')).map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#202026] text-white py-1">
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Google Gemini" className="bg-[#202026] text-stone-300 font-semibold">
                    {WEAVY_LLM_MODELS.filter((m) => m.provider.toLowerCase().includes('google')).map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#202026] text-white py-1">
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="OpenAI GPT" className="bg-[#202026] text-stone-300 font-semibold">
                    {WEAVY_LLM_MODELS.filter((m) => m.provider.toLowerCase().includes('openai')).map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#202026] text-white py-1">
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Meta LLaMA" className="bg-[#202026] text-stone-300 font-semibold">
                    {WEAVY_LLM_MODELS.filter((m) => m.provider.toLowerCase().includes('meta')).map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#202026] text-white py-1">
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {matchedLLMModel.description && (
                <p className="text-[10px] text-stone-400/90 leading-tight">
                  {matchedLLMModel.description}
                </p>
              )}
            </div>

            {/* Field: System Prompt */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-stone-400">System Prompt</label>
                <span className="text-[10px] text-purple-400 font-mono">Role / Instructions</span>
              </div>

              {/* Preset Buttons */}
              <div className="flex flex-wrap gap-1">
                {PROMPT_ENHANCER_SYSTEM_PRESETS.map((preset) => {
                  const isSelected = (nodeData.systemPrompt || '') === preset.value;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => onUpdateData(selectedNode.id, { ...nodeData, systemPrompt: preset.value })}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer select-none ${
                        isSelected
                          ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 font-medium'
                          : 'bg-white/[0.04] border-white/[0.08] text-stone-400 hover:text-stone-200 hover:bg-white/[0.08]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <textarea
                value={nodeData.systemPrompt ?? 'Your job is to write prompts for text-to-image models. Your input will be a general description for the scene, You should write a detailed prompt without any additions, not longer than 3 sentences.'}
                onChange={(e) =>
                  onUpdateData(selectedNode.id, {
                    ...nodeData,
                    systemPrompt: e.target.value,
                  })
                }
                rows={4}
                placeholder="Instruksi sistem untuk model AI ini..."
                className="w-full bg-[#202026] text-white border border-white/10 rounded-xl p-2.5 text-xs focus:outline-none focus:border-purple-500/50 resize-none font-sans leading-relaxed custom-scrollbar"
              />
            </div>

            {/* Field: Temperature */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-stone-400 flex items-center gap-1">
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>Temperature</span>
                </label>
                <span className="text-[11px] font-mono font-semibold text-stone-300">
                  {temperature.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={temperature}
                onChange={(e) =>
                  onUpdateData(selectedNode.id, {
                    ...nodeData,
                    temperature: parseFloat(e.target.value),
                  })
                }
                className="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex items-center justify-between text-[10px] text-stone-500">
                <span>0.0 (Presisi)</span>
                <span>1.0 (Kreatif)</span>
              </div>
            </div>

            {/* Field: Thinking Mode */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-stone-200">Thinking Mode</span>
                <span className="text-[10px] text-stone-500">Aktifkan penalaran mendalam</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateData(selectedNode.id, {
                    ...nodeData,
                    thinking: !isThinking,
                  })
                }
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                  isThinking ? 'bg-purple-600' : 'bg-stone-700'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    isThinking ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* SPECIFIC TO IMAGE MODEL NODE */}
        {selectedNode.type === 'imageModel' && (
          <>
            {/* Field: Model */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-stone-400 flex items-center justify-between">
                <span>Model</span>
                <span className="text-[10px] text-stone-500">Weavy Engine</span>
              </label>
              <div className="relative">
                <select
                  value={matchedModel.id}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="w-full bg-[#202026] text-white border border-white/10 rounded-xl px-3 py-2 text-xs appearance-none focus:outline-none focus:border-amber-500/50 cursor-pointer pr-8 font-medium"
                >
                  {WEAVY_IMAGE_MODELS.map((model) => (
                    <option key={model.id} value={model.id} className="bg-[#202026] text-white py-1">
                      {model.name} ({model.credits} kredit)
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Field: Quality */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-stone-400">Quality</label>
              <div className="relative">
                <select
                  value={nodeData.quality || 'medium'}
                  onChange={(e) => handleQualityChange(e.target.value)}
                  className="w-full bg-[#202026] text-white border border-white/10 rounded-xl px-3 py-2 text-xs appearance-none focus:outline-none focus:border-amber-500/50 cursor-pointer pr-8 font-medium"
                >
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="standard">standard</option>
                  <option value="ultra">ultra</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Field: Resolution */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-stone-400">Resolution</label>
              <div className="relative">
                <select
                  value={nodeData.resolution || matchedModel.defaultResolution || '1024 x 1024'}
                  onChange={(e) => handleResolutionChange(e.target.value)}
                  className="w-full bg-[#202026] text-white border border-white/10 rounded-xl px-3 py-2 text-xs appearance-none focus:outline-none focus:border-amber-500/50 cursor-pointer pr-8 font-medium"
                >
                  <option value="Auto">Auto</option>
                  <option value="1024 x 1024">1024 x 1024</option>
                  <option value="1K">1K (High Quality)</option>
                  <option value="2K">2K (Crisp Ultra)</option>
                  <option value="4K">4K (Masterpiece)</option>
                  <option value="1080p">1080p Full HD</option>
                  <option value="720p">720p HD</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Field: Aspect Ratio */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-stone-400">Aspect Ratio</label>
              <div className="grid grid-cols-3 gap-1.5">
                {['1:1', '16:9', '9:16', '4:3', '3:4', 'Auto / Default'].map((ratio) => {
                  const isSelected = (nodeData.aspectRatio || '1:1') === ratio;
                  return (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => handleAspectRatioChange(ratio)}
                      className={`py-1.5 px-2 rounded-lg text-center text-[11px] font-medium transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-semibold'
                          : 'bg-[#202026] border-white/5 text-stone-400 hover:text-stone-200 hover:bg-white/5'
                      }`}
                    >
                      {ratio}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* SPECIFIC TO GOOGLE VIDS VIDEO NODE */}
        {isVidsVideoNode && (
          <div className="flex-1 flex flex-col space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-stone-400">Model Video</label>
              <div className="w-full bg-[#202026] text-white border border-white/10 rounded-xl px-3 py-2 text-xs font-medium">
                Vids Omni · {vidsDuration}s
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-stone-400">Aspect Ratio</label>
              <div className="grid grid-cols-2 gap-1.5">
                {['9:16', '16:9'].map((ratio) => {
                  const isSelected = (nodeData.aspectRatio || '9:16') === ratio;
                  return (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() =>
                        onUpdateData(selectedNode.id, {
                          ...nodeData,
                          aspectRatio: ratio,
                        })
                      }
                      className={`py-1.5 px-2 rounded-lg text-center text-[11px] font-medium transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-blue-500/15 border-blue-500/40 text-blue-300 font-semibold'
                          : 'bg-[#202026] border-white/5 text-stone-400 hover:text-stone-200 hover:bg-white/5'
                      }`}
                    >
                      {ratio}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-stone-400">Durasi</label>
                <span className="text-[11px] font-mono font-semibold text-stone-300">{vidsDuration}s</span>
              </div>
              <input
                type="range"
                min={3}
                max={15}
                step={1}
                value={vidsDuration}
                aria-label="Durasi Google Vids"
                aria-valuetext={`${vidsDuration} detik`}
                onChange={(event) =>
                  onUpdateData(selectedNode.id, {
                    ...nodeData,
                    duration: Number(event.target.value),
                  })
                }
                className="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-stone-400">Resolusi</label>
              <div className="grid grid-cols-2 gap-1.5">
                {['720p', '1080p'].map((resolution) => {
                  const isSelected = (nodeData.resolution || '1080p') === resolution;
                  return (
                    <button
                      key={resolution}
                      type="button"
                      onClick={() => onUpdateData(selectedNode.id, { ...nodeData, resolution })}
                      className={`py-1.5 px-2 rounded-lg text-center text-[11px] font-medium transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-blue-500/15 border-blue-500/40 text-blue-300 font-semibold'
                          : 'bg-[#202026] border-white/5 text-stone-400 hover:text-stone-200 hover:bg-white/5 cursor-pointer'
                      }`}
                    >
                      {resolution}
                    </button>
                  );
                })}
              </div>
              {(nodeData.aspectRatio || '9:16') === '16:9' && (
                <p className="text-[10px] text-stone-500">Google Vids landscape saat ini mendukung 720p.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-stone-400">Akun Google Vids</label>
              <select
                value={nodeData.accountId || selectedVidsAccount?.id || selectedVidsAccount?.email || ''}
                onChange={(event) => {
                  const accountId = event.target.value;
                  const account = vidsAccounts.find((item) => (item.id || item.email) === accountId);
                  onUpdateData(selectedNode.id, {
                    ...nodeData,
                    accountId: accountId || undefined,
                    accountEmail: account?.email,
                  });
                }}
                className="w-full bg-[#202026] text-white border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500/50"
              >
                {vidsAccounts.length === 0 ? (
                  <option value="">Tidak ada akun tersimpan</option>
                ) : (
                  vidsAccounts.map((account) => {
                    const value = account.id || account.email || '';
                    return (
                      <option key={value} value={value}>
                        {account.displayName || account.name || account.email || 'Akun Google Vids'}
                        {' · '}
                        {account.credits ?? 0}/{account.totalCredits ?? 500} kredit
                        {account.isActive ? ' (Aktif)' : ''}
                      </option>
                    );
                  })
                )}
              </select>
              {selectedVidsAccount?.email && (
                <p className="text-[10px] text-stone-500 truncate">
                  {selectedVidsAccount.email} · {selectedVidsAccount.credits ?? 0}/{selectedVidsAccount.totalCredits ?? 500} kredit
                </p>
              )}
            </div>

            <div className="flex-1 min-h-[120px] flex flex-col space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-stone-400">Prompt Override</label>
                {connectedPrompt && (
                  <span className="text-[10px] text-blue-400 font-mono bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                    Prompt terhubung
                  </span>
                )}
              </div>
              <textarea
                value={nodeData.promptOverride || ''}
                onChange={(event) => onUpdateData(selectedNode.id, { ...nodeData, promptOverride: event.target.value })}
                placeholder="Prompt dari node Prompt akan digunakan otomatis. Isi di sini jika ingin menimpa."
                className="w-full flex-1 min-h-[110px] bg-[#181820] text-stone-200 border border-white/10 rounded-xl p-2.5 text-xs focus:outline-none focus:border-blue-500/50 resize-none font-mono leading-relaxed custom-scrollbar"
              />
            </div>
          </div>
        )}

        {/* SPECIFIC TO GEMINI VIDEO NODE */}
        {isGeminiVideoNode && (
          <div className="flex-1 flex flex-col space-y-3.5">
            {/* Field: Model */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-stone-400">Model Video</label>
              <div className="w-full bg-[#202026] text-white border border-white/10 rounded-xl px-3 py-2 text-xs font-medium select-none flex items-center gap-2">
                <img
                  src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg"
                  alt="Gemini Omni Flash"
                  className="w-4 h-4 object-contain shrink-0"
                />
                <span>Gemini Omni Flash</span>
              </div>
            </div>

            {/* Field: Durasi */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-stone-400">Durasi Video</label>
              <div className="w-full py-1.5 px-2 rounded-lg text-center text-[11px] font-semibold bg-white/[0.06] border border-white/10 text-stone-200 select-none">
                10s
              </div>
            </div>

            {/* Field: Aspect Ratio */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-stone-400">Aspect Ratio</label>
              <div className="grid grid-cols-3 gap-1.5">
                {['1:1', '16:9', '9:16', '4:3', '3:4'].map((ratio) => {
                  const isSelected = (nodeData.aspectRatio || '9:16') === ratio;
                  return (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => handleAspectRatioChange(ratio)}
                      className={`py-1.5 px-2 rounded-lg text-center text-[11px] font-medium transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-semibold'
                          : 'bg-[#202026] border-white/5 text-stone-400 hover:text-stone-200 hover:bg-white/5'
                      }`}
                    >
                      {ratio}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Field: Pilih Akun Google Gemini */}
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-stone-400">Pilih Akun Gemini</label>
                {isAutoMode ? (
                  <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Auto-Switch Aktif
                  </span>
                ) : (
                  currentSelectedAccount && (
                    <span className="text-[10px] text-amber-400 font-mono font-medium">
                      {currentSelectedAccount.credits ?? 0}/{GEMINI_MAX_CREDITS} Kuota
                    </span>
                  )
                )}
              </div>

              <div className="relative" ref={accountDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsAccountDropdownOpen((prev) => !prev)}
                  className="w-full bg-[#202026] hover:bg-[#25252d] text-white border border-white/10 hover:border-amber-500/30 rounded-xl px-3 py-2 text-xs flex items-center justify-between font-medium transition-all cursor-pointer group select-none shadow-xs"
                >
                  <div className="flex items-center gap-2.5 truncate min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-stone-800 border border-white/10 text-stone-200 flex items-center justify-center text-[11px] font-bold shrink-0">
                      {isAutoMode ? (
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        (currentSelectedAccount?.name || currentSelectedAccount?.email || 'G')[0].toUpperCase()
                      )}
                    </div>
                    <div className="flex flex-col text-left truncate min-w-0">
                      <span className="text-xs text-stone-200 font-semibold truncate leading-tight flex items-center gap-1.5">
                        {isAutoMode ? (
                          <>
                            <span>Auto-Switch Otomatis</span>
                            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                              Rekomendasi
                            </span>
                          </>
                        ) : (
                          currentSelectedAccount?.name || currentSelectedAccount?.email || 'Pilih Akun Gemini'
                        )}
                      </span>
                      <span className="text-[10px] text-stone-400 truncate leading-tight mt-0.5">
                        {isAutoMode
                          ? (selectedGeminiAssignment?.status === 'queued'
                              ? 'Menunggu akun bebas dari node lain'
                              : currentSelectedAccount
                              ? `Prioritas: ${currentSelectedAccount.name || currentSelectedAccount.email} (${currentSelectedAccount.credits ?? 0}/${GEMINI_MAX_CREDITS})`
                              : 'Otomatis rotasi akun saat kuota habis')
                          : currentSelectedAccount?.email || ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-stone-300 font-medium">
                      {isAutoMode ? 'AUTO' : `${currentSelectedAccount?.credits ?? 0}/${GEMINI_MAX_CREDITS}`}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 group-hover:text-stone-200 ${
                        isAccountDropdownOpen ? 'rotate-180 text-white' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Dropdown Menu */}
                {isAccountDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#1c1c22] border border-white/15 rounded-xl shadow-2xl p-1.5 space-y-1 max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150">
                    {/* Opsi 1: Auto-Switch Otomatis */}
                    <button
                      type="button"
                      onClick={() => handleSelectAccount('auto')}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-all cursor-pointer ${
                        isAutoMode
                          ? 'bg-amber-500/15 border border-amber-500/30 text-amber-200'
                          : 'hover:bg-white/[0.06] text-stone-300 hover:text-white border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate min-w-0">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 border ${
                            isAutoMode
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                              : 'bg-white/5 border-white/10 text-stone-400'
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                        <div className="flex flex-col truncate min-w-0">
                          <span className="font-semibold truncate text-[11px] text-amber-300 flex items-center gap-1.5">
                            ⚡ Auto-Switch Otomatis
                            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                              Rekomendasi
                            </span>
                          </span>
                          <span className="text-[9px] text-stone-400 truncate">
                            Otomatis rotasi ke akun yang tersedia kuota saat generate
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {isAutoMode && (
                          <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                      </div>
                    </button>

                    <div className="my-1 border-t border-white/[0.08]" />

                    {geminiAccounts.length === 0 ? (
                      <div className="p-3 text-center text-stone-400 text-xs">
                        <p className="font-medium text-stone-300">Belum ada akun Gemini</p>
                        <p className="text-[10px] text-stone-500 mt-1">Tambahkan akun melalui menu Pengaturan Akun di navigasi atas.</p>
                      </div>
                    ) : (
                      geminiAccounts.map((account) => {
                        const isSelected = !isAutoMode && account.id === currentSelectedAccount?.id;
                        const remaining = typeof account.credits === 'number' ? account.credits : 0;
                        const initial = (account.name || account.email || 'G')[0].toUpperCase();
                        const assignmentOwner = getAccountAssignmentOwner(account.id);

                        return (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => {
                              if (
                                assignmentOwner &&
                                !window.confirm(
                                  `Akun ini sudah dialokasikan ke "${assignmentOwner.title}". Pilih tetap dan tampilkan konflik untuk kedua node?`
                                )
                              ) {
                                return;
                              }
                              handleSelectAccount(account);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/15 border border-amber-500/30 text-amber-200'
                                : 'hover:bg-white/[0.06] text-stone-300 hover:text-white border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate min-w-0">
                              <div
                                className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 border ${
                                  isSelected
                                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                                    : 'bg-white/5 border-white/10 text-stone-400'
                                }`}
                              >
                                {initial}
                              </div>
                              <div className="flex flex-col truncate min-w-0">
                                <span className="font-medium truncate text-[11px]">
                                  {account.name || account.email}
                                </span>
                                {account.email && account.name && account.name !== account.email && (
                                  <span className="text-[9px] text-stone-500 truncate">
                                    {account.email}
                                  </span>
                                )}
                                {assignmentOwner && (
                                  <span className="text-[9px] text-amber-300 truncate">
                                    Dialokasikan ke: {assignmentOwner.title}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                  account.creditSyncStatus === 'unknown'
                                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                                    : remaining > 0
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                                }`}
                              >
                                {account.creditSyncStatus === 'unknown'
                                  ? `${remaining}/${GEMINI_MAX_CREDITS} Belum sinkron`
                                  : remaining > 0 ? `${remaining}/${GEMINI_MAX_CREDITS}` : `0/${GEMINI_MAX_CREDITS} Habis`}
                              </span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {selectedGeminiAssignment?.status === 'assigned' && isAutoMode && currentSelectedAccount && (
                <div className="px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300">
                  Preview akun node ini: <span className="font-medium">{currentSelectedAccount.name || currentSelectedAccount.email}</span>
                </div>
              )}
              {selectedGeminiAssignment?.status === 'queued' && isAutoMode && (
                <div className="px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300">
                  Semua akun berkuota sedang dialokasikan ke node lain. Node ini akan menunggu akun bebas saat dijalankan.
                </div>
              )}
              {selectedGeminiAssignment?.status === 'conflict' && (
                <div className="px-2 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-300">
                  Konflik pilihan manual: akun ini juga dipilih node <span className="font-medium">
                    {canvasNodes.find((node) => node.id === selectedGeminiAssignment.ownerNodeId)?.title || 'lain'}
                  </span>. Generate akan menunggu sampai akun bebas.
                </div>
              )}
              {selectedGeminiAssignment?.status === 'unavailable' && (
                <div className="px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300">
                  Akun pilihan tidak tersedia atau kuotanya habis; sistem akan mencari akun lain saat generate.
                </div>
              )}

              {nodeData.currentRunAccountEmail && (
                <div className="px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[10px] text-stone-400">
                  Akun run terakhir: <span className="text-stone-200">{nodeData.currentRunAccountEmail}</span>
                  {nodeData.status === 'running' && <span className="text-amber-300"> · Sedang generate</span>}
                </div>
              )}

              {/* Notice jika akun terpilih habis kuota tapi ada auto-switch */}
              {!isAutoMode && currentSelectedAccount && (currentSelectedAccount.credits ?? 3) <= 0 && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300/90 flex items-start gap-1.5 mt-1 leading-relaxed">
                  <Zap className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Kuota akun ini habis (0/{GEMINI_MAX_CREDITS}). Tenang, saat tombol Run ditekan, Canvas akan <strong>otomatis beralih (auto-switch)</strong> ke akun cadangan Anda yang masih memiliki kuota!
                  </span>
                </div>
              )}
            </div>

            {/* Field: Prompt Video */}
            <div className="flex-1 flex flex-col space-y-1.5 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-stone-300">
                  Prompt Video
                </label>
                {connectedPrompt && (
                  <span className="text-[10px] text-purple-400 font-mono bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
                    Terhubung
                  </span>
                )}
              </div>
              <textarea
                value={nodeData.promptOverride || connectedPrompt || ''}
                onChange={(e) =>
                  onUpdateData(selectedNode.id, {
                    ...nodeData,
                    promptOverride: e.target.value,
                  })
                }
                placeholder="Prompt video terisi otomatis dari node yang terhubung..."
                className="w-full flex-1 min-h-[160px] bg-[#181820] text-stone-200 border border-white/10 rounded-xl p-2.5 text-xs focus:outline-none focus:border-purple-500/50 resize-none font-mono leading-relaxed custom-scrollbar"
              />
            </div>
          </div>
        )}

        {/* SPECIFIC TO PROMPT NODE */}
        {selectedNode.type === 'prompt' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-stone-400">Prompt Text</label>
              <textarea
                value={nodeData.prompt || ''}
                onChange={(e) =>
                  onUpdateData(selectedNode.id, {
                    ...nodeData,
                    prompt: e.target.value,
                  })
                }
                rows={5}
                placeholder="Tulis deskripsi prompt di sini..."
                className="w-full bg-[#202026] text-white border border-white/10 rounded-xl p-2.5 text-xs focus:outline-none focus:border-emerald-500/50 resize-none font-sans leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-stone-400">Negative Prompt</label>
              <textarea
                value={nodeData.negativePrompt || ''}
                onChange={(e) =>
                  onUpdateData(selectedNode.id, {
                    ...nodeData,
                    negativePrompt: e.target.value,
                  })
                }
                rows={2}
                placeholder="blurry, bad quality, watermark..."
                className="w-full bg-[#202026] text-white border border-white/10 rounded-xl p-2.5 text-xs focus:outline-none focus:border-emerald-500/50 resize-none font-sans leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* SPECIFIC TO VIDEO STITCHER NODE */}
        {isVideoStitcherNode && (
          <div className="flex-1 flex flex-col space-y-3.5">
            {/* Field: Engine */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-stone-400">Engine Penggabung</label>
              <div className="w-full bg-[#202026] text-white border border-white/10 rounded-xl px-3 py-2 text-xs font-medium select-none flex items-center gap-2">
                <Film className="w-4 h-4 text-rose-400 shrink-0" />
                <span>FFmpeg Local Engine (H.264 / AAC)</span>
              </div>
            </div>

            {/* Field: Input Count info */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-stone-400">Slot Input Video</label>
              <div className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-white/[0.06] border border-white/10 text-stone-200 select-none flex items-center justify-between">
                <span>{selectedNode.inputs?.length || 1} Input Terpasang</span>
                <span className="text-[10px] text-stone-400 font-normal">Urutan: Video 1 → 2 → 3</span>
              </div>
            </div>

            {/* Field: Aspect Ratio */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-stone-400">Aspect Ratio Output</label>
              <div className="grid grid-cols-3 gap-1.5">
                {['9:16', '16:9', '1:1'].map((ratio) => {
                  const isSelected = (nodeData.aspectRatio || '9:16') === ratio;
                  return (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => handleAspectRatioChange(ratio)}
                      className={`py-1.5 px-2 rounded-lg text-center text-[11px] font-medium transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 font-semibold'
                          : 'bg-[#202026] border-white/5 text-stone-400 hover:text-stone-200 hover:bg-white/5'
                      }`}
                    >
                      {ratio}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Field: Resolusi */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-stone-400">Resolusi Output</label>
              <div className="grid grid-cols-2 gap-1.5">
                {['1080p', '720p'].map((res) => {
                  const isSelected = (nodeData.resolution || '1080p') === res;
                  return (
                    <button
                      key={res}
                      type="button"
                      onClick={() => onUpdateData(selectedNode.id, { ...nodeData, resolution: res })}
                      className={`py-1.5 px-2 rounded-lg text-center text-[11px] font-medium transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 font-semibold'
                          : 'bg-[#202026] border-white/5 text-stone-400 hover:text-stone-200 hover:bg-white/5'
                      }`}
                    >
                      {res}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SPECIFIC TO IMAGE INPUT NODE */}
        {selectedNode.type === 'imageInput' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-stone-400">Image URL</label>
              <input
                type="text"
                value={nodeData.imageUrl || ''}
                onChange={(e) =>
                  onUpdateData(selectedNode.id, {
                    ...nodeData,
                    imageUrl: e.target.value,
                  })
                }
                placeholder="https://example.com/image.jpg"
                className="w-full bg-[#202026] text-white border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500/50 font-mono"
              />
            </div>
            {nodeData.imageUrl && (
              <div className="w-full aspect-square rounded-xl overflow-hidden border border-white/10 bg-black/40">
                <img
                  src={nodeData.imageUrl}
                  alt="Reference"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        )}
        {/* SPECIFIC TO STORYBOARD NODE */}
        {isStoryboardNode && (
          <div className="space-y-4">
            {/* 1. Preset Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-stone-300 flex items-center justify-between">
                <span>Preset & Formula Video</span>
                <span className="text-[10px] text-amber-400 font-mono">
                  {nodeData.presetKey || '/facelessgardenugc'}
                </span>
              </label>
              <div className="relative">
                <select
                  value={nodeData.presetKey || '/facelessgardenugc'}
                  onChange={(e) => {
                    const selPreset = CHAT_SLASH_PRESETS.find((p) => p.slash === e.target.value);
                    onUpdateData(selectedNode.id, {
                      ...nodeData,
                      presetKey: e.target.value,
                      subtitle: selPreset?.name || 'Storyboard Copilot',
                      targetDuration: selPreset?.duration || 30,
                    });
                  }}
                  className="w-full bg-[#202026] text-white border border-white/10 rounded-xl px-3 py-2 text-xs appearance-none focus:outline-none focus:border-amber-500/50 cursor-pointer pr-8 font-medium"
                >
                  {CHAT_SLASH_PRESETS.filter((p) => !p.isDownload).map((p) => (
                    <option key={p.slash} value={p.slash} className="bg-[#18181c] text-white">
                      {getPresetLabel(p)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-[11px] text-stone-400 leading-relaxed">
                {CHAT_SLASH_PRESETS.find((p) => p.slash === nodeData.presetKey)?.desc ||
                  'Formula video viral TikTok 30 detik (3 Scene @ 10s) dengan hook kuat dan call to action.'}
              </p>
            </div>

            {/* 1.5 Mode Generator + parameter Director (sama seperti tab Storyboard di ekstensi) */}
            <div className="space-y-2.5 rounded-xl border border-white/10 bg-[#1b1b21] p-3">
              <label className="text-[11px] font-semibold text-stone-300 flex items-center justify-between">
                <span>Mode Generator</span>
                <span className="text-[10px] text-amber-400 font-mono">
                  {(nodeData.generatorMode || 'preset') === 'director' ? 'Director (Ekstensi)' : 'Preset Chat'}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['director', 'Director', 'JSON murni + analisis'],
                  ['preset', 'Preset Chat', 'Jalur lama'],
                ] as const).map(([mode, title, hint]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onUpdateData(selectedNode.id, { ...nodeData, generatorMode: mode })}
                    className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                      (nodeData.generatorMode || 'preset') === mode
                        ? 'bg-amber-500/15 border-amber-500/40'
                        : 'bg-[#202026] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="text-xs font-semibold text-stone-100">{title}</div>
                    <div className="text-[10px] text-stone-400">{hint}</div>
                  </button>
                ))}
              </div>

              {(nodeData.generatorMode || 'preset') === 'director' && (
                <div className="space-y-2.5">
                  <input
                    type="text"
                    value={nodeData.productName || ''}
                    onChange={(e) => onUpdateData(selectedNode.id, { ...nodeData, productName: e.target.value })}
                    placeholder="Nama produk (kosong = ditebak dari brief / AI Worker)"
                    className="w-full bg-[#202026] text-white border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50"
                  />
                  <textarea
                    value={nodeData.productDesc || ''}
                    onChange={(e) => onUpdateData(selectedNode.id, { ...nodeData, productDesc: e.target.value })}
                    placeholder="Deskripsi produk singkat"
                    rows={2}
                    className="w-full bg-[#202026] text-white border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50 resize-none"
                  />
                  <input
                    type="text"
                    value={nodeData.modelTalent || ''}
                    onChange={(e) => onUpdateData(selectedNode.id, { ...nodeData, modelTalent: e.target.value })}
                    placeholder="Model / talent (kosong = ikut preset; preset faceless mengabaikan ini)"
                    className="w-full bg-[#202026] text-white border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50"
                  />
                  <input
                    type="text"
                    value={nodeData.bgSetting || ''}
                    onChange={(e) => onUpdateData(selectedNode.id, { ...nodeData, bgSetting: e.target.value })}
                    placeholder="Background / setting (kosong = ikut preset / brief)"
                    className="w-full bg-[#202026] text-white border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50"
                  />
                  <p className="text-[10px] text-amber-300/80 leading-relaxed rounded-lg bg-amber-500/5 border border-amber-500/15 px-2.5 py-2">
                    Struktur, durasi, jumlah scene, voiceover, teks layar, talent, dan CTA mengikuti <b>preset</b>.
                    Pilihan di bawah hanya menimpa gaya visual &amp; hook bila diubah dari &quot;Ikut Preset&quot;.
                  </p>
                  {([
                    ['Hook Pattern', 'hookPattern', 'preset', STORYBOARD_HOOK_PATTERN_OPTIONS],
                    ['Gaya Visual TikTok', 'tiktokStyle', 'preset', STORYBOARD_TIKTOK_STYLE_OPTIONS],
                  ] as const).map(([label, key, def, options]) => (
                    <div key={key} className="space-y-1">
                      <label className="text-[10px] font-medium text-stone-400">{label}</label>
                      <select
                        value={(nodeData as any)[key] || def}
                        onChange={(e) => onUpdateData(selectedNode.id, { ...nodeData, [key]: e.target.value })}
                        className="w-full bg-[#202026] text-white border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50 cursor-pointer"
                      >
                        {options.map((o) => (
                          <option key={o.value} value={o.value} className="bg-[#18181c] text-white">
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-stone-400">Estimasi durasi (detik)</label>
                      <input
                        type="number"
                        min={5}
                        max={90}
                        value={nodeData.targetDuration || 30}
                        onChange={(e) =>
                          onUpdateData(selectedNode.id, { ...nodeData, targetDuration: Number(e.target.value) || 30 })
                        }
                        className="w-full bg-[#202026] text-white border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-stone-400">Jumlah scene</label>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={nodeData.numScenes ?? ''}
                        placeholder="Ikut preset"
                        onChange={(e) =>
                          onUpdateData(selectedNode.id, {
                            ...nodeData,
                            numScenes:
                              e.target.value === ''
                                ? undefined
                                : Math.min(Math.max(Number(e.target.value) || 1, 1), 8),
                          })
                        }
                        className="w-full bg-[#202026] text-white border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-stone-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={nodeData.lockConsistency !== false}
                      onChange={(e) => onUpdateData(selectedNode.id, { ...nodeData, lockConsistency: e.target.checked })}
                      className="accent-amber-500"
                    />
                    Kunci konsistensi produk &amp; talent/tangan antar-scene
                  </label>
                </div>
              )}
            </div>

            {/* 2. Provider AI Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-stone-300 flex items-center justify-between">
                <span>Pilih Provider AI</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  (nodeData.provider || 'weavy') === 'gemini'
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {(nodeData.provider || 'weavy') === 'gemini' ? 'Google AI Direct' : 'Weavy Multi-LLM'}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onUpdateData(selectedNode.id, {
                      ...nodeData,
                      provider: 'gemini',
                      model: 'gemini-3.6-flash',
                      modelDisplayName: '3.6 Flash',
                      creditsCost: 0,
                    });
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                    (nodeData.provider || 'weavy') === 'gemini'
                      ? 'bg-blue-500/15 border-blue-500/40 shadow-sm'
                      : 'bg-[#202026] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-300">
                      <GeminiIcon className="w-4 h-4" />
                      Gemini
                    </span>
                    {(nodeData.provider || 'weavy') === 'gemini' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    )}
                  </div>
                  <span className="text-[10px] text-stone-400 leading-tight">
                    Google Direct (Gratis)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onUpdateData(selectedNode.id, {
                      ...nodeData,
                      provider: 'weavy',
                      model: 'google/gemini-3.6-flash',
                      modelDisplayName: 'Gemini 3.6 Flash',
                      creditsCost: 1,
                    });
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                    nodeData.provider === 'weavy'
                      ? 'bg-amber-500/15 border-amber-500/40 shadow-sm'
                      : 'bg-[#202026] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                      <WeavyIcon className="w-4 h-4" />
                      Weavy
                    </span>
                    {nodeData.provider === 'weavy' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                  </div>
                  <span className="text-[10px] text-stone-400 leading-tight">
                    Multi-LLM Hub (1 Credit)
                  </span>
                </button>
              </div>
            </div>

            {/* 2.1 Gemini Account Selector if Gemini provider */}
            {(nodeData.provider || 'weavy') === 'gemini' && geminiAccounts.length > 0 && (
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-stone-400">Akun Google Gemini</label>
                  {currentSelectedAccount && (
                    <span className="text-[10px] text-blue-400 font-mono font-medium">
                      {currentSelectedAccount.credits ?? 0}/{GEMINI_MAX_CREDITS} Kuota
                    </span>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsAccountDropdownOpen((prev) => !prev)}
                    className="w-full bg-[#202026] hover:bg-[#25252d] text-white border border-white/10 hover:border-blue-500/30 rounded-xl px-3 py-2 text-xs flex items-center justify-between font-medium transition-all cursor-pointer group select-none shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-stone-800 border border-white/10 text-stone-200 flex items-center justify-center text-[11px] font-bold shrink-0">
                        {(currentSelectedAccount?.name || currentSelectedAccount?.email || 'G')[0].toUpperCase()}
                      </div>
                      <div className="flex flex-col text-left truncate min-w-0">
                        <span className="text-xs text-stone-200 font-semibold truncate leading-tight">
                          {currentSelectedAccount?.name || currentSelectedAccount?.email || 'Pilih Akun Gemini'}
                        </span>
                        {currentSelectedAccount?.email && currentSelectedAccount.name && currentSelectedAccount.name !== currentSelectedAccount.email && (
                          <span className="text-[10px] text-stone-400 truncate leading-tight mt-0.5">
                            {currentSelectedAccount.email}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-stone-300 font-medium">
                        {currentSelectedAccount?.credits ?? 0}/{GEMINI_MAX_CREDITS}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 group-hover:text-stone-200 ${
                          isAccountDropdownOpen ? 'rotate-180 text-white' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {/* Dropdown Menu */}
                  {isAccountDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#1c1c22] border border-white/15 rounded-xl shadow-2xl p-1.5 space-y-1 max-h-56 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150">
                      {geminiAccounts.map((account) => {
                        const isSelected = account.id === currentSelectedAccount?.id;
                        const remaining = typeof account.credits === 'number' ? account.credits : 0;
                        const initial = (account.name || account.email || 'G')[0].toUpperCase();

                        return (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => handleSelectAccount(account)}
                            className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-500/15 border border-blue-500/30 text-blue-200'
                                : 'hover:bg-white/[0.06] text-stone-300 hover:text-white border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate min-w-0">
                              <div
                                className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 border ${
                                  isSelected
                                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-200'
                                    : 'bg-white/5 border-white/10 text-stone-400'
                                }`}
                              >
                                {initial}
                              </div>
                              <div className="flex flex-col truncate min-w-0">
                                <span className="font-medium truncate text-[11px]">
                                  {account.name || account.email}
                                </span>
                                {account.email && account.name && account.name !== account.email && (
                                  <span className="text-[9px] text-stone-500 truncate">
                                    {account.email}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                  account.creditSyncStatus === 'unknown'
                                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                                    : remaining > 0
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                                }`}
                              >
                                {account.creditSyncStatus === 'unknown'
                                  ? `${remaining}/${GEMINI_MAX_CREDITS} Belum sinkron`
                                  : `${remaining}/${GEMINI_MAX_CREDITS}`}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. Model LLM Selector based on Provider */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-stone-300 flex items-center justify-between">
                <span>Model AI Scriptwriter</span>
                <span className="text-[10px] text-stone-400">
                  {(nodeData.provider || 'weavy') === 'gemini' ? '0 Credit (Gratis)' : '1 Credit'}
                </span>
              </label>
              <div className="relative">
                {(nodeData.provider || 'weavy') === 'gemini' ? (
                  <select
                    value={nodeData.model || 'gemini-3.6-flash'}
                    onChange={(e) => {
                      const found = GEMINI_LLM_MODELS.find((m) => m.id === e.target.value);
                      onUpdateData(selectedNode.id, {
                        ...nodeData,
                        model: e.target.value,
                        modelDisplayName: found?.name || e.target.value,
                      });
                    }}
                    className="w-full bg-[#202026] text-white border border-blue-500/30 rounded-xl px-3 py-2 text-xs appearance-none focus:outline-none focus:border-blue-500/50 cursor-pointer pr-8 font-medium"
                  >
                    {GEMINI_LLM_MODELS.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#18181c] text-white">
                        {m.name} ({m.badge}) - {m.description}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={nodeData.model || 'google/gemini-3.6-flash'}
                    onChange={(e) => {
                      const found = WEAVY_LLM_MODELS.find((m) => m.id === e.target.value);
                      onUpdateData(selectedNode.id, {
                        ...nodeData,
                        model: e.target.value,
                        modelDisplayName: found?.name || e.target.value,
                      });
                    }}
                    className="w-full bg-[#202026] text-white border border-amber-500/30 rounded-xl px-3 py-2 text-xs appearance-none focus:outline-none focus:border-amber-500/50 cursor-pointer pr-8 font-medium"
                  >
                    <optgroup label="Anthropic Claude" className="bg-[#18181c] text-amber-300 font-semibold">
                      {WEAVY_LLM_MODELS.filter((m) => m.provider.toLowerCase().includes('anthropic')).map((m) => (
                        <option key={m.id} value={m.id} className="bg-[#18181c] text-white font-normal">
                          {m.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Google Gemini" className="bg-[#18181c] text-blue-300 font-semibold">
                      {WEAVY_LLM_MODELS.filter((m) => m.provider.toLowerCase().includes('google')).map((m) => (
                        <option key={m.id} value={m.id} className="bg-[#18181c] text-white font-normal">
                          {m.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="OpenAI" className="bg-[#18181c] text-emerald-300 font-semibold">
                      {WEAVY_LLM_MODELS.filter((m) => m.provider.toLowerCase().includes('openai')).map((m) => (
                        <option key={m.id} value={m.id} className="bg-[#18181c] text-white font-normal">
                          {m.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Meta Llama" className="bg-[#18181c] text-purple-300 font-semibold">
                      {WEAVY_LLM_MODELS.filter((m) => m.provider.toLowerCase().includes('meta')).map((m) => (
                        <option key={m.id} value={m.id} className="bg-[#18181c] text-white font-normal">
                          {m.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-[11px] text-stone-400 leading-relaxed">
                {(nodeData.provider || 'weavy') === 'gemini'
                  ? 'Mengeksekusi langsung dengan akun Google Gemini atau API Key Gemini tanpa biaya kredit Weavy.'
                  : 'Mengeksekusi melalui Akun Weavy multi-model hub dengan kuota kredit Weavy.'}
              </p>
            </div>

            {/* 3. Duration & Scene Info */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
                <span className="flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-amber-400" />
                  Aturan Voiceover Ketat
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  27–30 kata
                </span>
              </div>
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                Target 28–29 kata per scene (toleransi 27–30) supaya pas 10 detik: tidak terpotong dan tidak kurang durasi.
              </p>
            </div>

            {/* 4. Main Brief Editor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-stone-300">
                  Main Brief / Konsep Cerita
                </label>
                {connectedPrompt && (
                  <span className="text-[10px] text-purple-400 font-mono bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                    Terhubung dari Node Prompt
                  </span>
                )}
              </div>
              <textarea
                value={nodeData.brief || connectedPrompt || ''}
                onChange={(e) => onUpdateData(selectedNode.id, { ...nodeData, brief: e.target.value })}
                rows={4}
                placeholder="Tuliskan brief produk / cerita Anda..."
                className={`w-full bg-[#202026] text-white border rounded-xl p-3 text-xs focus:outline-none resize-none font-sans leading-relaxed ${
                  connectedPrompt
                    ? 'border-purple-500/30 focus:border-purple-500/60'
                    : 'border-white/10 focus:border-amber-500/50'
                }`}
              />
              {connectedPrompt && !nodeData.brief && (
                <p className="text-[10.5px] text-purple-300/80 leading-relaxed">
                  ✓ Main brief otomatis disinkronkan dari kabel node Prompt yang terhubung.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Bottom Sticky Section ("Run selected nodes") */}
      {(selectedNode.type === 'imageModel' || isLLMNode || isGeminiVideoNode || isVidsVideoNode || isVideoStitcherNode || isStoryboardNode) && onRunNode && (
        <div className="p-4 border-t border-white/10 bg-[#141418] shrink-0 space-y-3">
          {supportsVidsWatermarkRemoval &&
            onRemoveWatermark &&
            /^(?:\/media-cache\/vids_|\/media-cache\/stitched_)[^/]+\.mp4$/i.test(nodeData.outputVideo || nodeData.videoUrl || nodeData.resultUrl || '') &&
            !/_nowm\.mp4$/i.test(nodeData.outputVideo || nodeData.videoUrl || nodeData.resultUrl || '') && (
              <div className="space-y-2">
                {watermarkError && (
                  <p className="text-[10px] text-rose-400 leading-relaxed">{watermarkError}</p>
                )}
                <button
                  type="button"
                  disabled={isRemovingWatermark}
                  onClick={async () => {
                    setIsRemovingWatermark(true);
                    setWatermarkError(null);
                    try {
                      await onRemoveWatermark(selectedNode.id);
                    } catch (error) {
                      const message = error instanceof Error ? error.message : 'Remove watermark gagal.';
                      setWatermarkError(message);
                    } finally {
                      setIsRemovingWatermark(false);
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/15 text-blue-200 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                >
                  {isRemovingWatermark ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{isRemovingWatermark ? 'Memproses remove watermark...' : 'Remove Watermark'}</span>
                </button>
              </div>
            )}

          <div className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              {isStoryboardNode ? 'Jalankan Storyboard Copilot' : isVideoStitcherNode ? 'Gabungkan Video (FFmpeg)' : isGeminiVideoNode ? 'Jalankan Gemini Video' : isVidsVideoNode ? 'Jalankan Vids Omni' : 'Run selected nodes'}
            </h4>

            {!isGeminiVideoNode && !isVidsVideoNode && !isVideoStitcherNode && (
              <div className="flex items-center justify-between text-xs py-0.5">
                <span className="text-stone-400 font-medium">Runs</span>
                <div className="relative">
                  <select
                    value={runs}
                    onChange={(e) => {
                      const r = parseInt(e.target.value) || 1;
                      setRuns(r);
                      onUpdateData(selectedNode.id, { ...nodeData, runs: r });
                    }}
                    className="bg-[#202026] text-white border border-white/10 rounded-lg px-2.5 py-1 text-xs appearance-none focus:outline-none cursor-pointer pr-6 font-medium"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={4}>4</option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-stone-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs py-0.5">
              <span className="text-stone-400 font-medium">Biaya</span>
              <div className="flex items-center gap-1.5 font-semibold text-white">
                {isGeminiVideoNode || (isStoryboardNode && (nodeData.provider || 'weavy') === 'gemini') ? (
                  <GeminiIcon className="w-3.5 h-3.5" />
                ) : isVidsVideoNode ? (
                  <Video className="w-3.5 h-3.5 text-blue-400" />
                ) : isVideoStitcherNode ? (
                  <Film className="w-3.5 h-3.5 text-rose-400" />
                ) : isStoryboardNode ? (
                  <WeavyIcon className="w-3.5 h-3.5" />
                ) : (
                  <span className="text-amber-400 text-xs">✳</span>
                )}
                <span>
                  {isGeminiVideoNode
                    ? '1 Kuota Gemini'
                    : isVidsVideoNode
                    ? 'Mengikuti kuota akun Vids'
                    : isVideoStitcherNode
                    ? '0 credit (FFmpeg Lokal)'
                    : isStoryboardNode
                    ? ((nodeData.provider || 'weavy') === 'weavy' ? '1 credit' : '0 credit (Google AI Direct)')
                    : `${isLLMNode ? llmTotalCost : totalCost} credits`}
                </span>
              </div>
            </div>
          </div>

          {/* Prominent Action Button: → Run selected */}
          <button
            type="button"
            onClick={() => onRunNode(selectedNode.id)}
            disabled={
              isExecuting ||
              (!isLLMNode &&
                !isGeminiVideoNode &&
                !isVidsVideoNode &&
                !isVideoStitcherNode &&
                (!isStoryboardNode || (nodeData.provider || 'weavy') === 'weavy') &&
                credits < (isStoryboardNode ? 1 : totalCost))
            }
            className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 select-none cursor-pointer shadow-lg active:scale-98 ${
              isExecuting
                ? 'bg-stone-800 text-stone-200 cursor-wait opacity-90'
                : (!isLLMNode &&
                    !isGeminiVideoNode &&
                    !isVidsVideoNode &&
                    !isVideoStitcherNode &&
                    (!isStoryboardNode || (nodeData.provider || 'weavy') === 'weavy') &&
                    credits < (isStoryboardNode ? 1 : totalCost))
                ? 'bg-stone-800 text-stone-500 border border-white/5 cursor-not-allowed'
                : 'bg-white text-stone-950 hover:bg-stone-100 border border-white/20'
            }`}
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                <span>
                  {isStoryboardNode
                    ? 'Menyusun Storyboard...'
                    : isVideoStitcherNode
                    ? 'Menggabungkan Video...'
                    : isGeminiVideoNode
                    ? 'Merender Video...'
                    : isVidsVideoNode
                    ? 'Merender Google Vids...'
                    : isLLMNode
                    ? 'Memproses LLM...'
                    : 'Merender AI...'} {Math.round(executingProgress)}%
                </span>
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4 text-stone-950 stroke-[2.5]" />
                <span>{isStoryboardNode ? 'Generate Storyboard' : isVideoStitcherNode ? 'Stitch Video' : isGeminiVideoNode ? 'Run Model' : isVidsVideoNode ? 'Generate Video' : 'Run selected'}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export const CanvasInspectorPanel: React.FC<CanvasInspectorPanelProps> = (props) => {
  if (!props.selectedNode) return null;
  return <CanvasInspectorContent {...props} selectedNode={props.selectedNode} />;
};
