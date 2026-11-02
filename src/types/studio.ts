export type StudioAspectRatio = '9:16' | '16:9' | '1:1';

export type StudioImageModel =
  | 'ChatGPT Images 2.0 Edit'
  | 'GPT Image 2.5'
  | 'Seedream V5.0 Pro Edit'
  | 'Nano Banana Pro'
  | 'Grok Imagine Image'
  | 'GPT Image 2.0 Edit';

export type StudioAiModel =
  | 'google/gemini-2.5-flash'
  | 'google/gemini-3.6-flash'
  | 'google/gemini-3-pro'
  | 'google/gemini-3.1-pro'
  | 'google/gemini-3.5-flash-lite'
  | 'google/gemini-2.5-flash-lite'
  | 'anthropic/claude-sonnet-5'
  | 'anthropic/claude-opus-5'
  | 'anthropic/claude-haiku-4-5'
  | 'anthropic/claude-sonnet-4-6'
  | 'openai/gpt-5.6-sol'
  | 'openai/gpt-4o'
  | 'openai/gpt-4.1'
  | 'openai/gpt-5.6-terra'
  | 'openai/gpt-5.6-luna'
  | 'meta-llama/llama-4-maverick'
  | 'meta-llama/llama-4-scout'
  | (string & {});

export interface StudioVideoMetadata {
  url?: string;
  title: string;
  author: string;
  audioName?: string;
  thumbnailUrl?: string;
  duration?: number | string;
  tags?: string[];
  playUrl?: string;
}

export interface FrameAnalysisResult {
  frameIndex: number;
  timestamp: string; // e.g. "00:05"
  timeSec: number;
  subject: string;
  action: string;
  camera: string;
  style: string;
  lighting: string;
  composition: string;
  onScreenText?: string;
  mood?: string;
  rawDescription?: string;
}

export interface StudioPipelineMetadata {
  downloader: 'tikwm' | 'oembed' | 'direct' | 'sample';
  framesExtracted: number;
  framesAnalyzed: number;
  vlmModelUsed: string;
  temporalAggregationCompleted: boolean;
  promptEnhancementApplied: boolean;
  verificationStatus: 'skipped_placeholder' | 'verified';
}

export interface StudioCustomAsset {
  id: string;
  title: string;
  textDescription: string;
  image?: string;
}

export type StudioAtmStyle =
  | 'viral-hook-pain-agitate'
  | 'ugc-honest-review'
  | 'daily-vlog-storytelling'
  | 'hard-sell-fomo'
  | 'extreme-demo-proof'
  | 'educational-unboxing'
  | 'custom';

export interface StudioAtmRemixParams {
  baseAnalysis: StudioAnalysis;
  baseMetadata?: StudioVideoMetadata;
  targetDurationSec: number;
  numScenes?: number;
  numCameraAngles?: number;
  preferredAngles?: string[];
  remixStyle: StudioAtmStyle;
  customStyleNotes?: string;
  characterTalent?: string;
  characterImage?: string;
  productName?: string;
  productDescription?: string;
  productImage?: string;
  backgroundSetting?: string;
  backgroundImage?: string;
  creativeAngle?: string;
  aspectRatio?: StudioAspectRatio;
  imageModel?: StudioImageModel;
  aiModel?: StudioAiModel;
}

export interface StudioAtmRemixResult {
  remixedAnalysis: StudioAnalysis;
  masterProductionSheetPrompt: string;
  scenes: StudioScene[];
  inputImageAnalysis?: {
    productImageAnalysis?: string;
    modelImageAnalysis?: string;
    backgroundImageAnalysis?: string;
  };
  aiModel?: string;
}

export interface StudioBriefInputs {
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
  numCameraAngles?: number;
  preferredAngles?: string[];
  customAssets?: StudioCustomAsset[];
}

export interface StudioAnalysis {
  hookAnalysis: string;
  productOrTopicName: string;
  modelTalent?: string;
  backgroundSetting?: string;
  mainBrief?: string;
  targetAudience: string;
  coreUSPs: string[];
  visualProofStrategy: string;
  callToActionAnalysis: string;
  transcript?: string;
  contentSummary?: string;
  productImageAnalysis?: string;
  modelImageAnalysis?: string;
  backgroundImageAnalysis?: string;
  frameObservations?: FrameAnalysisResult[];
  pipelineMetadata?: StudioPipelineMetadata;
}

export interface StudioScene {
  id: string;
  sceneNumber: number;
  title: string;
  durationSec: number;
  timecode?: string; // e.g. "00:00 - 00:05 (Durasi: 5 detik)"
  startSec?: number;
  endSec?: number;
  sceneGoal?: string;
  visualDescription: string;
  voiceover?: string; // Voiceover (VO) / Script narasi
  onScreenText?: string; // Teks di Layar / Caption
  cameraAngle?: string;
  imagePrompt: string; // Prompt AI Image (9:16)
  videoPrompt?: string; // Prompt AI Video Motion (Minimax/Hailuo/Kling/Wan2.1)
  imageUrl?: string;
  status: 'idle' | 'generating' | 'completed' | 'failed';
  errorMessage?: string;
  generatedAt?: string;
  progress?: number;
}

export interface StudioCompositeConfig {
  gridColumns: number; // default: 3
  gridRows: number;    // default: 2
  showBadges: boolean;
  showTitleBanner: boolean;
  titleText?: string;
  borderColor: string;
  borderWidth: number;
  padding: number;
  aspectRatio: '16:9' | '9:16';
}

export interface StudioMasterProductionSheet {
  imageUrl?: string;
  prompt?: string;
  referenceImages?: string[];
  generatedAt?: string;
  imageModel?: string;
  aspectRatio?: string;
  isUsedAsSceneAnchor?: boolean; // When true, all scene generations inject this master sheet as the primary visual anchor
}

export interface StudioProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  briefInputs?: StudioBriefInputs;
  videoSource?: {
    type: 'url' | 'upload' | 'sample';
    urlOrFilename: string;
    metadata?: StudioVideoMetadata;
  };
  analysis?: StudioAnalysis;
  scenes: StudioScene[];
  aspectRatio: StudioAspectRatio;
  imageModel: StudioImageModel;
  aiModel?: StudioAiModel;
  compositeConfig: StudioCompositeConfig;
  compositeImageUrl?: string;
  masterProductionSheet?: StudioMasterProductionSheet;
  oneSheetGrid?: {
    imageUrl?: string;
    prompt?: string;
    referenceImages?: string[];
    generatedAt?: string;
    imageModel?: string;
    aspectRatio?: string;
  };
}

// ============================================================================
// STUDIO AI TALENT / CHARACTER MODULE TYPES
// ============================================================================

export type TalentGender = 'female' | 'male' | 'any';
export type TalentShotType = 'full-body' | 'half-body' | 'portrait-closeup';
export type TalentAgeRange = 'teen' | 'young-adult' | 'mature-adult' | 'senior';

export type TalentEthnicity =
  | 'indonesian-local'
  | 'east-asian'
  | 'southeast-asian'
  | 'caucasian'
  | 'middle-eastern'
  | 'south-asian'
  | 'african-descent'
  | 'latino-hispanic';

export interface StudioTalentConfig {
  id: string;
  name: string;
  gender: TalentGender;
  ageGroup: TalentAgeRange;
  ethnicity: TalentEthnicity;
  shotType: TalentShotType;
  poseAction: string;
  productInteraction: 'holding-product' | 'wearing-product' | 'pointing-at-product' | 'standing-beside-product' | 'custom';
  expression: string;
  clothingStyle: string;
  environmentSetting: string;
  mainBrief: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  productImages: string[];
  characterRefImages: string[];
  generatedPrompt: string;
  createdTimestamp: number;
}
