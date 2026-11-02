export type GenerationMode = 'video' | 'image';

export type VideoModel = 'Motion Control' | 'S2 Motion Control' | 'MiniMax H3 Turbo Video' | 'Omni Flash' | 'Kling 3.0 Pro Motion Control' | 'Kling 2.6 Motion Control' | 'Kling 2.6 Motion Control Standar' | 'SeeDance 2.5' | 'SeeDance 2.0 Mini' | 'Galleri5 Video Studio' | 'Grok Imagine 1.5 Preview' | 'Grok Imagine (Image-to-Video)' | 'grok-imagine/image-to-video' | (string & {});
export type ImageModel = 'Nano Banana Pro' | 'Seedream V5.0 Pro Edit' | 'ChatGPT Images 2.0 Edit' | 'Google Imagen 3 Pro' | 'Gemini 3 Pro Image' | 'Grok Imagine Image' | 'GPT Image 2.5' | 'GPT Image 2 (Image-to-Image)' | 'Seedream 4.0 Edit' | 'GPT Image 2 (Text-to-Image)' | '-';
export type AIProvider = 'weavy' | 'gemini' | 'flow' | 'roboneo' | 'galleri5' | 'kie' | 'runninghub';

export type VideoAspectRatio = '9:16 (Vertical)' | '16:9 (Landscape)' | '1:1 (Square)' | '4:3' | '3:4' | '21:9' | '3:2' | '2:3' | 'Auto';
export type ImageAspectRatio = '9:16 (Vertical)' | '16:9 (Landscape)' | '1:1 (Square)' | '4:3 (Landscape)' | '3:4 (Portrait)' | 'Auto / Default';

export type VideoDuration = '4 seconds' | '5 seconds' | '6 seconds' | '8 seconds' | '10 seconds' | '15 seconds' | '20 seconds' | '25 seconds' | '30 seconds' | (string & {});
export type VideoResolution = '1080p' | '768p' | '720p' | '480p';
export type ImageResolution = '1024 x 1024';

export interface GenerationSettings {
  mode: GenerationMode;
  provider?: AIProvider;
  videoModel: VideoModel;
  imageModel: ImageModel;
  videoAspectRatio: VideoAspectRatio;
  imageAspectRatio: ImageAspectRatio;
  videoDuration: VideoDuration;
  videoResolution: VideoResolution;
  imageResolution: ImageResolution;
  enableAudio: boolean;
}

export interface AttachedMedia {
  id: string;
  type: 'image' | 'video' | 'file';
  source: 'gallery' | 'camera' | 'device';
  name: string;
  url: string;
  previewUrl?: string;
  size: string;
  durationSeconds?: number;
  fileObject?: File;
  isUploading?: boolean;
  uploadProgress?: number;
  uploadError?: string;
}

export interface GenerationItem {
  id: string;
  mode: GenerationMode;
  title: string;
  prompt: string;
  createdAt: string;
  timestamp: string;
  aspectRatio: string;
  resolution: string;
  duration?: string;
  model: string;
  thumbnailUrl: string;
  mediaUrl: string;
  attachedMedia?: AttachedMedia[];
  isFavorite?: boolean;
  status?: 'completed' | 'processing' | 'failed' | 'queued';
  recipeId?: string;
  nodeId?: string;
  taskId?: string;
  accountKey?: string;
  queuedData?: any;
  progress?: number;
  timerString?: string;
  startedAt?: number;
  createdAtTimestamp?: number;
  errorMessage?: string;
  group?: 'Today' | 'Yesterday' | 'Earlier';
  provider?: string;
  providerName?: string;
}

export type NavTab = 'generate' | 'batch' | 'canvas' | 'chat' | 'studio' | 'history' | 'settings' | 'profile';

export * from './types/studio';

export interface ChatAttachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video' | 'file';
  size?: string;
  base64?: string;
  fileObject?: File;
  previewUrl?: string;
  isUploading?: boolean;
  uploadProgress?: number;
  uploadError?: string;
  // Video-specific playback and metadata fields
  coverUrl?: string;
  playbackUrl?: string;
  duration?: number | string;
  sourceUrl?: string;
  fallbackNote?: string;
  author?: string;
  title?: string;
  videoIndex?: number; // e.g. 1 for Video #1 (@vid1)
  /** Peran aset saat dikirim ke model (product/model/background/tagged_context/session_memory). */
  referenceRole?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  modelDisplayName?: string;
  attachments?: ChatAttachment[];
  thinking?: string;
  tokens?: number;
  durationMs?: number;
  isError?: boolean;
  // Visual generation metadata (when in Create Image or Create Video mode)
  messageType?: 'text' | 'image_generation' | 'video_generation';
  generatedImage?: {
    url?: string;
    prompt: string;
    aspectRatio?: string;
    modelName?: string;
    creditsUsed?: number;
    status?: 'loading' | 'completed' | 'failed';
    errorMessage?: string;
    referenceImageUrl?: string;
    referenceImageUrls?: string[];
  };
  generatedVideo?: {
    url?: string;
    prompt: string;
    aspectRatio?: string;
    duration?: string;
    resolution?: string;
    modelName?: string;
    provider?: string;
    creditsUsed?: number;
    status?: 'loading' | 'completed' | 'failed';
    errorMessage?: string;
    referenceImageUrl?: string;
    referenceImageUrls?: string[];
    referenceVideoUrl?: string;
    taskId?: string;
    progress?: number;
    timerString?: string;
  };
  weavyAction?: {
    prompt: string;
    model: string;
    aspectRatio: string;
    useReference?: boolean;
    referenceImageUrl?: string;
    reason?: string;
    status: 'suggested' | 'loading' | 'completed' | 'failed';
    resultUrl?: string;
    errorMessage?: string;
    creditsUsed?: number;
  };
  repostMedia?: {
    url: string;
    index?: number;
    caption?: string;
    prompt?: string;
  };
  extractedProducts?: Array<{
    title: string;
    author_name?: string;
    author_url?: string;
    url: string;
    platform?: string;
    thumbnail_url?: string;
    description?: string;
    price?: string;
    usps?: string[];
    images?: Array<{ url: string; title?: string; role?: string }>;
  }>;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  model: string;
  mode: 'chat' | 'cowork' | 'image' | 'video';
  systemPrompt?: string;
  isPinned?: boolean;
  geminiConversationId?: string;
  geminiResponseId?: string;
  geminiChoiceId?: string;
  /** Metadata persisten sesi (Project Memory, status Copilot, dll). */
  metadata?: {
    /** Project Memory Agent V1 - brand rules, produk, audiens, gaya visual. */
    projectMemory?: import('./lib/weavyAgent/projectMemory').WeavyProjectMemory;
    /** Storyboard Copilot mode aktif di sesi ini. */
    storyboardCopilotEnabled?: boolean;
    [key: string]: any;
  };
}

export type BatchJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface BatchJobItem {
  id: string;
  order: number;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  mediaName?: string;
  imageFile?: File;
  imageDataUrl?: string;
  referenceImageUrl?: string; // Gambar referensi (pose / karakter / style)
  referenceImageName?: string;
  referenceImageFile?: File;
  referenceImageDataUrl?: string;
  uploadedReferenceImageFileName?: string;
  motionVideoUrl?: string; // Video referensi gerak jika Motion Control
  motionVideoName?: string;
  motionVideoFile?: File;
  motionVideoDataUrl?: string;
  uploadedImageFileName?: string;
  uploadedVideoFileName?: string;
  prompt?: string;
  status: BatchJobStatus;
  account?: string;
  accountApiKey?: string;
  taskId?: string;
  progress?: number;
  duration?: string;
  elapsedSeconds?: number;
  createdAt: string;
  timeAgo?: string;
  resultUrl?: string;
  errorMessage?: string;
  aspectRatio?: string;
  model?: string;
}

export interface BatchSettings {
  provider: AIProvider;
  model: string;
  aspectRatio: string;
  duration: string;
  resolution: string;
}

export interface RoboneoAccount {
  id: string;
  accessToken: string;
  paramToken: string;
  accountName?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'ERROR';
  remainingCredits: number | string;
  totalCredits?: number | string;
  expireTime?: string;
  isActive: boolean;
  lastChecked: string;
}

export interface AppUser {
  userId: string;
  userName: string;
  firstName: string;
  email: string;
}

export interface ProviderAccount {
  id: string;
  email: string;
  name?: string;
  displayName?: string;
  isActive: boolean;
  hasRefreshToken?: boolean;
  refreshToken?: string;
  accessToken?: string;
  idToken?: string;
  token?: string;
  cookies?: string;
  apiKey?: string;
  authHeader?: string;
  atToken?: string;
  fSid?: string;
  providerId?: string;
  tier?: string;
  snlm0e?: string;
  organizationId?: string;
  credits?: number;
  totalCredits?: number;
  creditsUsed?: number;
  creditSyncStatus?: 'synced' | 'unknown';
  userId?: string;
  photoUrl?: string;
  status?: string;
  accountStatus?: 'active' | 'banned' | 'expired' | 'error';
  statusMessage?: string;
  lastChecked?: string;
}

export function getCleanPrompt(prompt?: string, model?: string): string {
  if (!prompt) return '';
  const p = prompt.trim();
  if (!p) return '';
  
  const pLower = p.toLowerCase();
  if (pLower === 'generasi kie.ai' || pLower === 'generasi tanpa prompt' || pLower === 'untitled generation' || pLower === 'kling motion control') return '';
  if (pLower.includes('refer to the movements and facial expressions')) return '';
  if (model && pLower === model.toLowerCase()) return '';
  
  if (pLower.includes('motion control')) return '';
  if (pLower.startsWith('kling') || pLower.startsWith('seedance') || pLower.startsWith('grok') || pLower.startsWith('chatgpt') || pLower.startsWith('nano') || pLower.startsWith('gemini')) return '';
  
  return p;
}

export function getShortPrompt(prompt?: string, model?: string, maxWords: number = 5): string {
  const clean = getCleanPrompt(prompt, model);
  if (!clean) return '';
  const words = clean.trim().split(/\s+/);
  if (words.length <= maxWords) return clean;
  return words.slice(0, maxWords).join(' ') + '...';
}

export function getAspectRatioLabel(item: GenerationItem): string {
  const raw = item.aspectRatio || '';
  if (raw.includes('9:16')) return '9:16';
  if (raw.includes('16:9')) return '16:9';
  if (raw.includes('1:1')) return '1:1';
  if (raw.includes('3:4')) return '3:4';
  if (raw.includes('4:3')) return '4:3';
  if (raw.includes('2:3')) return '2:3';
  if (raw.includes('3:2')) return '3:2';
  if (raw.includes('21:9')) return '21:9';

  const first = raw.split(' ')[0];
  if (first && first.includes(':')) {
    return first;
  }
  return '9:16';
}

export interface Greeting {
  id: string;
  language: string;
  flag: string;
  template: string;
  defaultTarget: string;
  subtitle: string;
  pronunciation: string;
}

export function getCleanModelName(model?: string): string {
  if (!model) return '';
  const m = model.trim();
  if (
    m === 'Motion Control AmbMedia 1080HD' ||
    m === 'Motion Control MotionFly 1080HD' ||
    m.toLowerCase().includes('ambmedia') ||
    m.toLowerCase().includes('motionfly')
  ) {
    return 'Motion Control';
  }
  if (
    m === 'Google Veo 2 / Gemini Video' ||
    m === 'Google Veo 2' ||
    m.toLowerCase().includes('veo 2')
  ) {
    return 'Google Veo 2';
  }
  if (
    m === 'Gemini Omni Flash Video (10s)' ||
    m === 'Omni Flash' ||
    m.toLowerCase().includes('omni flash')
  ) {
    return 'Omni Flash';
  }
  if (m.toLowerCase().includes('nano-banana') || m.toLowerCase().includes('banana') || m === 'Gemini Edit' || m.includes('Nano Banana')) {
    return 'Nano Banana Pro';
  }
  if (m.toLowerCase().includes('seedream/v5') || m.toLowerCase().includes('seedream v5')) {
    return 'Seedream V5.0 Pro Edit';
  }
  if (m.toLowerCase().includes('flare') || m.toLowerCase().includes('gpt image 2.5') || m.toLowerCase().includes('gpt-image-2.5')) {
    return 'GPT Image 2.5';
  }
  if (m.toLowerCase().includes('gpt_image') || m.toLowerCase().includes('chatgpt')) {
    return 'ChatGPT Images 2.0 Edit';
  }
  if (m.toLowerCase().includes('grok-imagine') || m.toLowerCase().includes('grok imagine')) {
    return 'Grok Imagine Image';
  }
  return m;
}
