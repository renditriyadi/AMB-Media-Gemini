import type { StoryboardCopilotScene } from '../components/chat/ChatStoryboardCopilotCard';
import { dedupeStoryboardScenes } from '../lib/storyboardScenes';

export type CanvasNodeType =
  | 'prompt'
  | 'imageInput'
  | 'imageModel'
  | 'geminiVideo'
  | 'videoStitcher'
  | 'imageViewer'
  | 'promptEnhancer'
  | 'anyLLM'
  | 'storyboard'
  | 'aiWorker'
  | 'note';

export type CanvasHandleType = 'text' | 'image' | 'video' | 'any';

export interface CanvasPort {
  id: string;
  name: string;
  type: CanvasHandleType;
  label?: string;
  required?: boolean;
  connected?: boolean;
}

export interface PromptNodeData {
  prompt: string;
  negativePrompt?: string;
  presetStyle?: string;
}

export interface ImageInputNodeData {
  imageUrl?: string;
  fileName?: string;
  aspectRatio?: string;
}

export interface ImageModelNodeData {
  modelId: string; // e.g. 'fal-ai/nano-banana-pro/edit', 'fal-ai/bytedance/seedream/v5/lite/edit', 'xai/grok-imagine-image', 'gpt_image_1_edit'
  modelDisplayName: string;
  provider: string; // 'weavy'
  resolution: '1K' | '2K' | '4K' | '1024 x 1024' | '720p' | '1080p' | string;
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | 'Auto / Default' | string;
  seed: number;
  isRandomSeed: boolean;
  enableWebSearch?: boolean;
  creditsCost: number;
  promptOverride?: string;
  inputImageUrl?: string;
  quality?: string;
  runs?: number;
  outputImage?: string;
  resultUrl?: string;
  status?: 'idle' | 'running' | 'completed' | 'error';
  progress?: number;
  startedAt?: number;
  errorMessage?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  voiceover?: string;
  shoots?: any[];
  sceneNumber?: number;
  sceneTitle?: string;
  visualDescription?: string;
}

export interface ImageViewerNodeData {
  resultUrl?: string;
  coverUrl?: string;
  promptSnippet?: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  progress?: number;
  errorMessage?: string;
  executionTime?: number;
}

export interface NoteNodeData {
  text: string;
}

export interface PromptEnhancerNodeData {
  model: string; // e.g. 'google/gemini-3-pro', 'openai/gpt-5.6-sol'
  systemPrompt: string;
  presetTask?: string;
  inputPrompt?: string;
  inputImageUrl?: string;
  enhancedPrompt?: string;
  status?: 'idle' | 'running' | 'completed' | 'error';
  progress?: number;
  errorMessage?: string;
  generations?: Array<{
    id: string;
    model: string;
    value: string;
    timestamp: string;
  }>;
}

export interface AnyLLMNodeData {
  model: string; // e.g. 'anthropic/claude-opus-5', 'google/gemini-3.1-pro', 'openai/gpt-5.6-sol'
  modelDisplayName?: string;
  systemPrompt?: string;
  presetTask?: string;
  temperature?: number;
  thinking?: boolean;
  inputPrompt?: string;
  inputImageUrl?: string;
  inputImageUrls?: string[];
  enhancedPrompt?: string;
  generatedText?: string;
  status?: 'idle' | 'running' | 'completed' | 'error';
  progress?: number;
  errorMessage?: string;
  runs?: number;
  creditsCost?: number;
  generations?: Array<{
    id: string;
    model: string;
    value: string;
    timestamp: string;
  }>;
}

export interface GeminiVideoNodeData {
  modelId: string; // 'gemini-omni-1.1-flash'
  modelDisplayName: string;
  provider: 'gemini';
  duration: '10s' | string;
  aspectRatio: '16:9' | '9:16' | string;
  resolution?: string;
  creditsCost: number;
  promptOverride?: string;
  inputImageUrl?: string;
  inputPrompt?: string;
  outputVideo?: string;
  resultUrl?: string;
  videoUrl?: string;
  status?: 'idle' | 'running' | 'completed' | 'error';
  progress?: number;
  errorMessage?: string;
  operationName?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  accountId?: string;
  accountEmail?: string;
  voiceover?: string;
  shoots?: any[];
  sceneNumber?: number;
  sceneTitle?: string;
  visualDescription?: string;
  videoPrompt?: string;
}

export interface StoryboardNodeData {
  presetKey?: string;
  generatedPresetKey?: string;
  projectTitle?: string;
  productName?: string;
  productDesc?: string;
  modelTalent?: string;
  bgSetting?: string;
  brief?: string;
  targetDuration?: number;
  aspectRatio?: string;
  formula?: string;
  gender?: 'female' | 'male' | 'neutral';
  provider?: 'gemini' | 'weavy';
  model?: string;
  modelDisplayName?: string;
  systemPrompt?: string;
  scenes?: StoryboardCopilotScene[];
  status?: 'idle' | 'running' | 'completed' | 'error';
  progress?: number;
  errorMessage?: string;
  rawJson?: string;
  activeTab?: number;
  creditsCost?: number;
  accountId?: string;
  accountEmail?: string;
  productAnalysisStatus?: 'running' | 'valid' | 'error';
  /**
   * 'director' = generator storyboard khusus (port dari ekstensi, output JSON murni).
   * 'preset'   = jalur lama (preset chat + blok storyboard_project).
   */
  generatorMode?: 'director' | 'preset';
  formulaAngle?: string;
  tiktokStyle?: string;
  hookPattern?: string;
  lockConsistency?: boolean;
  numScenes?: number;
  analysis?: {
    hookAnalysis?: string;
    productOrTopicName?: string;
    coreUSPs?: string[];
    visualProofStrategy?: string;
    callToActionAnalysis?: string;
  } | null;
  masterProductionSheetPrompt?: string | null;
}

export interface AiWorkerProduct {
  title?: string;
  authorName?: string;
  platform?: string;
  price?: string;
  description?: string;
  usps?: string[];
  thumbnailUrl?: string;
}

export interface AiWorkerNodeData {
  linkText: string;
  note?: string;
  status?: 'idle' | 'running' | 'completed' | 'error';
  progress?: number;
  errorMessage?: string;
  product?: AiWorkerProduct;
  // Penanda per field: true hanya jika data benar-benar hasil ekstraksi (bukan tebakan/estimasi)
  verified?: { title?: boolean; price?: boolean; usps?: boolean };
  contextText?: string;
  galleryUrls?: string[];
  selectedImageUrls?: string[];
  processedLinkText?: string;
  processedNoteText?: string;
  storyboardAnalysis?: string;
  storyboardAnalysisSignature?: string;
  // true jika isi hasil hanyalah contoh tampilan (dummy), bukan hasil ekstraksi
  isSample?: boolean;
}

export interface VideoStitcherNodeData {
  aspectRatio?: '16:9' | '9:16' | '1:1' | string;
  resolution?: '1080p' | '720p' | string;
  transition?: 'none' | 'crossfade' | string;
  status?: 'idle' | 'running' | 'completed' | 'error';
  progress?: number;
  outputVideo?: string;
  resultUrl?: string;
  videoUrl?: string;
  duration?: string;
  errorMessage?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  inputVideos?: string[];
}

export type CanvasNodeData =
  | PromptNodeData
  | ImageInputNodeData
  | ImageModelNodeData
  | GeminiVideoNodeData
  | VideoStitcherNodeData
  | ImageViewerNodeData
  | PromptEnhancerNodeData
  | AnyLLMNodeData
  | StoryboardNodeData
  | AiWorkerNodeData
  | NoteNodeData;

export interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  title: string;
  subtitle?: string;
  colorTheme: 'green' | 'blue' | 'red' | 'purple' | 'amber' | 'stone';
  position: { x: number; y: number };
  inputs: CanvasPort[];
  outputs: CanvasPort[];
  data: any;
  isExecuting?: boolean;
  progress?: number;
  error?: string;
}

export interface CanvasEdge {
  id: string;
  sourceNodeId: string;
  sourceOutputId: string;
  targetNodeId: string;
  targetInputId: string;
  color?: string;
}

export interface CanvasGroup {
  id: string;
  title: string;
  nodeIds: string[];
  color?: string;
}

export interface CanvasRecipe {
  id: string;
  name: string;
  description?: string;
  weavyRecipeId?: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  groups?: CanvasGroup[];
  createdAt: string;
  updatedAt: string;
}

export interface CanvasFile {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  recipe: CanvasRecipe;
  isTrash?: boolean;
}

export interface WeavyModelOption {
  id: string;
  name: string;
  badge: string;
  credits: number;
  description: string;
  defaultAspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | 'Auto / Default';
  defaultResolution: '1K' | '2K' | '4K' | '1024 x 1024' | '720p' | '1080p';
  supportsImageInput: boolean;
}

export const WEAVY_IMAGE_MODELS: WeavyModelOption[] = [
  {
    id: 'fal-ai/nano-banana-pro/edit',
    name: 'Nano Banana Pro',
    badge: 'Google AI',
    credits: 11,
    description: "Google's state-of-the-art image generation and editing model with photorealistic accuracy",
    defaultAspectRatio: '1:1',
    defaultResolution: '1K',
    supportsImageInput: true,
  },
  {
    id: 'fal-ai/bytedance/seedream/v5/lite/edit',
    name: 'Seedream V5.0 Pro Edit',
    badge: 'ByteDance',
    credits: 12,
    description: 'Ultra sharp next-gen image generation and editing model with aesthetic Asian & western styling',
    defaultAspectRatio: '9:16',
    defaultResolution: '1080p',
    supportsImageInput: true,
  },
  {
    id: 'xai/grok-imagine-image',
    name: 'Grok Imagine Image',
    badge: 'xAI',
    credits: 4,
    description: 'Fast and imaginative AI image generation by xAI Grok with cinematic creative lighting',
    defaultAspectRatio: '1:1',
    defaultResolution: '1024 x 1024',
    supportsImageInput: false,
  },
  {
    id: 'flare-ai/flare-2.5',
    name: 'GPT Image 2.5',
    badge: 'Weavy Flare',
    credits: 4,
    description: 'High-quality generation with cinematic styling powered by Weavy Flare (GPT Image 2.5) for only 4 credits',
    defaultAspectRatio: '9:16',
    defaultResolution: '1080p',
    supportsImageInput: true,
  },
  {
    id: 'gpt_image_1_edit',
    name: 'ChatGPT Images 2.0 Edit',
    badge: 'OpenAI',
    credits: 9,
    description: 'Intelligent prompt adherence image generation and object replacement powered by OpenAI',
    defaultAspectRatio: '1:1',
    defaultResolution: '1024 x 1024',
    supportsImageInput: true,
  },
  {
    id: 'gpt_image_2',
    name: 'ChatGPT Images 2.0',
    badge: 'OpenAI',
    credits: 9,
    description: "Direct high-fidelity text-to-image synthesis powered by OpenAI's GPT Image 2",
    defaultAspectRatio: '1:1',
    defaultResolution: '1024 x 1024',
    supportsImageInput: false,
  },
];

export interface WeavyLLMModel {
  id: string;
  name: string;
  provider: 'Google' | 'OpenAI' | 'Anthropic' | 'Meta';
  description?: string;
  isDefault?: boolean;
}

export const WEAVY_PROMPT_ENHANCER_MODELS: WeavyLLMModel[] = [
  // Google
  { id: 'google/gemini-3-pro', name: 'Gemini 3 Pro', provider: 'Google', isDefault: true, description: 'Google flagship multimodal model (default Weavy)' },
  { id: 'google/gemini-3.1-pro', name: 'Gemini 3.1 Pro', provider: 'Google', description: 'Advanced reasoning and visual synthesis' },
  { id: 'google/gemini-3.6-flash', name: 'Gemini 3.6 Flash', provider: 'Google', description: 'Ultra-fast multimodal prompt generator' },
  { id: 'google/gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', provider: 'Google', description: 'Lightweight ultra-fast inference' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', description: 'Fast general multimodal generation' },
  { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'Google', description: 'Efficient low-latency model' },
  // OpenAI
  { id: 'openai/gpt-5.6-sol', name: 'GPT-5.6 Sol', provider: 'OpenAI', description: 'Next-gen OpenAI model for rich detail prompts' },
  { id: 'openai/gpt-5.6-terra', name: 'GPT-5.6 Terra', provider: 'OpenAI', description: 'Grounded scene description and prompt design' },
  { id: 'openai/gpt-5.6-luna', name: 'GPT-5.6 Luna', provider: 'OpenAI', description: 'Creative and stylistic lighting enhancer' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', description: 'Omni visual and prompt comprehension' },
  { id: 'openai/gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', description: 'Enhanced instruction following' },
  // Anthropic
  { id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', provider: 'Anthropic', description: 'Top-tier creative descriptive writing' },
  { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'Anthropic', description: 'Balanced precision and rich visual vocabulary' },
  { id: 'anthropic/claude-opus-4-7', name: 'Claude Opus 4.7', provider: 'Anthropic', description: 'Nuanced descriptive depth' },
  { id: 'anthropic/claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'Anthropic', description: 'Deep descriptive composition' },
  { id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', description: 'Fast high-quality prompt phrasing' },
  { id: 'anthropic/claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'Anthropic', description: 'Lightning-fast prompt expansion' },
  // Meta
  { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', provider: 'Meta', description: 'Open-weights frontier reasoning' },
  { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout', provider: 'Meta', description: 'Nimble and expressive scene prompt builder' },
];

export const PROMPT_ENHANCER_SYSTEM_PRESETS = [
  {
    label: 'Standard Photorealistic',
    value: 'Your job is to write prompts for text-to-image models. Your input will be a general description for the scene, You should write a detailed prompt without any additions, not longer than 3 sentences.',
  },
  {
    label: 'Extract Image to JSON Prompt',
    value: 'Your job is to analyze the input image and extract the visual details into a valid JSON containing a detailed photorealistic prompt with lighting, attire, pose, and background.',
  },
  {
    label: 'Gaming Assets (Weavy Default)',
    value: 'Your job is to write prompts for text-to-image models. Specifically for gaming assets. Your input will be a general description for the scene, You should write a prompt without any additions',
  },
  {
    label: 'Cinematic Masterpiece',
    value: 'You are an elite prompt engineer. Expand the user description into an 8K cinematic photorealistic masterpiece specifying volumetric lighting, depth of field, camera model, and lens.',
  },
];

export const WEAVY_LLM_MODELS = WEAVY_PROMPT_ENHANCER_MODELS;

export interface ChatProviderOption {
  id: 'weavy' | 'gemini';
  name: string;
  badge: string;
  iconType?: string;
  description: string;
}

export const CHAT_PROVIDERS: ChatProviderOption[] = [
  {
    id: 'weavy',
    name: 'Weavy',
    badge: 'Multi-LLM Hub',
    description: 'Akses Claude 3.5/Opus, GPT-5/4o, Llama 4 via Akun Weavy',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    badge: 'Google AI Direct',
    description: 'Gemini 2.5 Flash, 2.5 Pro & Direct Google AI Engine',
  },
];

export interface GeminiLLMModel {
  id: string;
  name: string;
  provider: 'Google';
  badge: string;
  isDefault?: boolean;
  description: string;
}

export const GEMINI_LLM_MODELS: GeminiLLMModel[] = [
  {
    id: 'gemini-3.6-flash',
    name: '3.6 Flash',
    provider: 'Google',
    badge: 'New',
    isDefault: true,
    description: 'All-around help',
  },
  {
    id: 'gemini-3.6-thinking',
    name: '3.6 Thinking',
    provider: 'Google',
    badge: 'Thinking',
    description: 'Solves complex problems',
  },
  {
    id: 'gemini-3.1-pro',
    name: '3.1 Pro',
    provider: 'Google',
    badge: 'Pro',
    description: 'Advanced reasoning',
  },
];

export interface GeminiImageModel {
  id: string;
  name: string;
  badge: string;
  isDefault?: boolean;
  description: string;
  credits: number;
}

export const GEMINI_IMAGE_MODELS: GeminiImageModel[] = [
  {
    id: 'imagen-3.0-generate-002',
    name: 'Google Imagen 3 Pro',
    badge: 'Photorealistic HD',
    isDefault: true,
    credits: 0,
    description: 'Model gambar terbaik Google DeepMind dengan detail fotorealistik, tipografi akurat, dan pencahayaan fisik nyata.',
  },
  {
    id: 'gemini-3.1-flash-image',
    name: 'Gemini 3.1 Flash Image',
    badge: 'Ultra Fast',
    credits: 0,
    description: 'Generasi visual kilat multimodal dengan latensi sangat rendah dan komposisi prompt presisi.',
  },
  {
    id: 'gemini-3-pro-image',
    name: 'Gemini 3 Pro Image',
    badge: 'Pro Reasoning',
    credits: 0,
    description: 'Model gambar tingkat enterprise dengan konsistensi komposisi tingkat tinggi dan rendering 4K.',
  },
  {
    id: 'gemini-web-imagen',
    name: 'Gemini Web Direct (Akun Google)',
    badge: 'Google Session',
    credits: 0,
    description: 'Generate gambar langsung melalui sesi akun Google Gemini kamu di gemini.google.com.',
  },
];

export interface GeminiVideoModel {
  id: string;
  name: string;
  badge: string;
  description: string;
  durations: string[];
  defaultDuration: string;
  aspectRatios: string[];
  resolutions: string[];
  credits: number;
}

export const GEMINI_VIDEO_MODELS: GeminiVideoModel[] = [
  {
    id: 'gemini-omni-1.1-flash',
    name: 'Gemini Omni Flash',
    badge: '10s',
    description: 'Model multimodal Google Gemini Omni Flash dengan integrasi video Veo hingga 10 detik.',
    durations: ['10s'],
    defaultDuration: '10s',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    resolutions: [],
    credits: 0,
  },
  {
    id: 'google-veo-2',
    name: 'Google Veo 2',
    badge: 'Veo 2',
    description: 'Model generasi video mutakhir dari Google DeepMind dengan detail fotorealistik dan gerakan dinamis.',
    durations: ['10s', '5s'],
    defaultDuration: '10s',
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    resolutions: [],
    credits: 0,
  },
];

export const getNodeWidth = (
  node?: CanvasNode | null,
  inferredRatio?: string
): number => {
  if (!node) return 340;
  if (node.type === 'note') return 260;
  if (node.type === 'prompt') return 320;
  if (node.type === 'storyboard') return 410;
  if (node.type === 'aiWorker') return 360;
  if (node.type === 'promptEnhancer' || node.type === 'anyLLM') return 340;
  if (node.type === 'imageModel') return 340;
  if (node.type === 'geminiVideo') return 340;
  if (node.type === 'videoStitcher') return 340;
  if (node.type !== 'imageViewer' && node.type !== 'imageInput') return 340;
  if (node.data?.cardWidth && typeof node.data.cardWidth === 'number') {
    return node.data.cardWidth;
  }
  const ratio = node.data?.aspectRatio || inferredRatio || '1:1';
  switch (ratio) {
    case '16:9':
      return 380;
    case '4:3':
      return 360;
    case '1:1':
      return 340;
    case '3:4':
      return 330;
    case '9:16':
      return 320;
    default: {
      if (node.data?.naturalWidth && node.data?.naturalHeight) {
        const aspect = node.data.naturalWidth / node.data.naturalHeight;
        if (aspect >= 1.5) return 380;
        if (aspect >= 1.2) return 360;
        if (aspect >= 0.9) return 340;
        if (aspect >= 0.7) return 330;
        return 320;
      }
      return 340;
    }
  }
};

/**
 * Jumlah scene yang diharapkan untuk node Storyboard Copilot.
 * - Sudah ada scene hasil generate: pakai jumlah scene sebenarnya.
 * - Belum generate: dihitung dari durasi preset (1 scene = 10 detik), mis. 20s = 2 scene, 30s = 3 scene.
 *   Durasi kosong/0 (preset custom) memakai default 30s = 3 scene. Dibatasi 1..6.
 */
export function getStoryboardPlannedSceneCount(data?: any): number {
  const real = dedupeStoryboardScenes(data?.scenes).length;
  if (real > 0) return real;
  const duration = Number(data?.targetDuration);
  const seconds = Number.isFinite(duration) && duration > 0 ? duration : 30;
  return Math.min(Math.max(Math.ceil(seconds / 10), 1), 6);
}

/**
 * Port output dinamis node Storyboard dari data node (konektor sudah tampil sebelum generate).
 */
export function getStoryboardNodeOutputs(data?: any): CanvasPort[] {
  return getStoryboardOutputs(data?.scenes, getStoryboardPlannedSceneCount(data));
}

/**
 * Generates dynamic output ports for a Storyboard Copilot node.
 * - Scenes sudah ada (N item): Scene 1..N Image & Video + Full Script.
 * - Scenes belum ada: jika plannedSceneCount > 0, port Scene 1..N dibuat dari jumlah rencana
 *   (berdasarkan preset) agar kabel bisa dipasang sebelum generate; jika 0 -> [].
 */
export function getStoryboardOutputs(rawScenes?: any[], plannedSceneCount: number = 0): CanvasPort[] {
  const realScenes = dedupeStoryboardScenes(rawScenes);
  const scenes: any[] =
    realScenes.length > 0
      ? realScenes
      : Array.from({ length: Math.max(0, Math.floor(plannedSceneCount)) }, (_, i) => ({ sceneNumber: i + 1 }));
  if (scenes.length === 0) {
    return [];
  }
  const ports: CanvasPort[] = [];
  scenes.forEach((scene: any, idx: number) => {
    const sceneNum = scene.sceneNumber || idx + 1;
    ports.push({
      id: `scene${sceneNum}_image`,
      name: `scene${sceneNum}_image`,
      type: 'text',
      label: `Scene ${sceneNum} Image`,
    });
    ports.push({
      id: `scene${sceneNum}_video`,
      name: `scene${sceneNum}_video`,
      type: 'text',
      label: `Scene ${sceneNum} Video`,
    });
  });
  ports.push({
    id: 'output-script',
    name: 'script',
    type: 'text',
    label: 'Full Script',
  });
  return ports;
}

/**
 * Port output dinamis untuk node AI Worker.
 * - Selalu ada: Context (teks) dan Foto utama (gambar)
 * - Setiap foto tambahan yang dipilih menambah satu port gambar (Foto 2, Foto 3, ... maks 6)
 */
export function getAiWorkerOutputs(data?: any): CanvasPort[] {
  const picked: string[] = Array.isArray(data?.selectedImageUrls)
    ? data.selectedImageUrls
    : Array.isArray(data?.galleryUrls)
    ? data.galleryUrls
    : [];
  const imageCount = Math.min(Math.max(picked.length, 1), 6);
  const ports: CanvasPort[] = [
    { id: 'output-context', name: 'context', type: 'text', label: 'Context' },
    { id: 'output-image', name: 'image', type: 'image', label: 'Foto utama' },
  ];
  for (let n = 2; n <= imageCount; n++) {
    ports.push({ id: `output-image_${n}`, name: `image_${n}`, type: 'image', label: `Foto ${n}` });
  }
  return ports;
}

/**
 * Nilai yang keluar dari sebuah port output node AI Worker.
 * - output-context -> teks Context
 * - output-image / output-image_N -> URL foto ke-N dari foto yang dipilih
 * Data contoh (dummy) tidak pernah diteruskan ke node lain.
 */
export function getAiWorkerPortValue(node: CanvasNode, outputId?: string): { text?: string; imageUrl?: string } {
  const d = node?.data || {};
  if (d.isSample) return {};
  const id = outputId || 'output-image';
  if (id.includes('context')) {
    const t = typeof d.contextText === 'string' ? d.contextText.trim() : '';
    return t ? { text: t } : {};
  }
  const picked: string[] = (Array.isArray(d.selectedImageUrls) ? d.selectedImageUrls : Array.isArray(d.galleryUrls) ? d.galleryUrls : [])
    .filter((u: any) => typeof u === 'string' && u && !u.startsWith('sample:'));
  const m = id.match(/output-image_(\d+)/);
  const index = m ? parseInt(m[1], 10) - 1 : 0;
  const url = picked[index];
  return url ? { imageUrl: url } : {};
}

/**
 * Returns the exact top pixel offset of a port container inside a CanvasNodeCard.
 * For imageModel, geminiVideo, and LLM nodes, spacing is 40px starting at 62px.
 * For storyboard nodes, spacing is 36px starting at 62px.
 * For standard nodes, spacing is 36px starting at 62px.
 */
export const getPortOffsetTop = (nodeType: string, portIndex: number): number => {
  if (nodeType === 'imageModel' || nodeType === 'geminiVideo' || nodeType === 'videoStitcher' || nodeType === 'promptEnhancer' || nodeType === 'anyLLM') {
    return 62 + portIndex * 40;
  }
  if (nodeType === 'storyboard') {
    return 62 + portIndex * 36;
  }
  return 62 + portIndex * 36;
};

/**
 * Accurately calculates the (x, y) coordinates of a port handle center in canvas coordinates.
 * Each port container is 32px high (h-8), so the vertical center is topOffset + 16px.
 * Input port is centered on the left edge (x = node.position.x).
 * Output port is centered on the right edge (x = node.position.x + nodeWidth).
 */
export const getPortCoordinate = (
  node: CanvasNode,
  portId: string | undefined,
  isInput: boolean,
  inferredRatio?: string
): { x: number; y: number } => {
  const nodeWidth = getNodeWidth(node, inferredRatio);
  let portIndex = 0;

  if (isInput) {
    if (portId && node.inputs && node.inputs.length > 0) {
      portIndex = node.inputs.findIndex((p) => p.id === portId);
      if (portIndex < 0) {
        // Fallback match by name or type heuristics
        portIndex = node.inputs.findIndex(
          (p) =>
            p.name === portId ||
            (portId.includes('prompt') && (p.id.includes('prompt') || p.type === 'text')) ||
            (portId.includes('brief') && (p.id.includes('brief') || p.type === 'text')) ||
            (portId.includes('image') && (p.id.includes('image') || p.type === 'image'))
        );
      }
    }
    if (portIndex < 0) portIndex = 0;

    const top = getPortOffsetTop(node.type, portIndex);
    return {
      x: node.position.x,
      y: node.position.y + top + 16,
    };
  } else {
    const outputs =
      node.type === 'storyboard'
        ? getStoryboardNodeOutputs(node.data)
        : node.type === 'aiWorker'
        ? getAiWorkerOutputs(node.data)
        : node.outputs && node.outputs.length > 0
        ? node.outputs
        : node.type === 'imageViewer' || node.type === 'imageModel'
        ? [
            {
              id: node.type === 'imageModel' ? 'output-result' : 'output-image',
              name: 'image',
              type: 'image' as const,
              label: 'Image',
            },
          ]
        : node.type === 'geminiVideo' || node.type === 'videoStitcher'
        ? [
            {
              id: 'output-video',
              name: 'video',
              type: 'video' as const,
              label: node.type === 'videoStitcher' ? 'Stitched Video' : 'Video',
            },
          ]
        : [];

    if (portId && outputs.length > 0) {
      portIndex = outputs.findIndex((p) => p.id === portId);
      if (portIndex < 0) {
        const match = portId.match(/scene[_\-\s]?(\d+)/i);
        if (match) {
          const num = match[1];
          const isVideo = portId.toLowerCase().includes('video');
          portIndex = outputs.findIndex(
            (p) => p.id.includes(`scene${num}`) && (isVideo ? p.id.includes('video') : p.id.includes('image'))
          );
        }
      }
      if (portIndex < 0) {
        portIndex = outputs.findIndex(
          (p) =>
            p.name === portId ||
            p.id === portId ||
            (portId.includes('video') && (p.id.includes('video') || p.name === 'video' || p.type === 'video' || p.type === 'any')) ||
            (portId.includes('text') && (p.id.includes('text') || p.type === 'text')) ||
            (portId.includes('result') && (p.id.includes('result') || p.type === 'image')) ||
            (portId.includes('image') && (p.id.includes('image') || p.type === 'image'))
        );
      }
    }
    if (portIndex < 0) portIndex = 0;

    const top = getPortOffsetTop(node.type, portIndex);
    return {
      x: node.position.x + nodeWidth,
      y: node.position.y + top + 16,
    };
  }
};