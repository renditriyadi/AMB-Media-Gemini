// canvas-types.js - Constants & Configuration for Visual Canvas Workflow (100% Pola Project Utama)

export const CANVAS_NODE_THEMES = {
  green: {
    bg: '#064e3b',
    border: '#059669',
    badge: '#10b981',
    glow: 'rgba(16, 185, 129, 0.25)',
  },
  blue: {
    bg: '#1e3a8a',
    border: '#2563eb',
    badge: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.25)',
  },
  red: {
    bg: '#881337',
    border: '#e11d48',
    badge: '#f43f5e',
    glow: 'rgba(244, 63, 94, 0.25)',
  },
  purple: {
    bg: '#581c87',
    border: '#9333ea',
    badge: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.25)',
  },
  amber: {
    bg: '#78350f',
    border: '#d97706',
    badge: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.25)',
  },
  stone: {
    bg: '#292524',
    border: '#57534e',
    badge: '#78716c',
    glow: 'rgba(120, 113, 108, 0.25)',
  },
};

export const WEAVY_IMAGE_MODELS = [
  {
    id: 'fal-ai/nano-banana-pro/edit',
    name: 'Nano Banana Pro',
    credits: 11,
    provider: 'weavy',
    emoji: '🍌',
    badge: 'POPULAR',
    desc: 'Model image generation & editing akurasi tinggi (1K, 2K, 4K resolution)',
  },
  {
    id: 'fal-ai/bytedance/seedream/v5/lite/edit',
    name: 'Seedream V5.0 Pro Edit',
    credits: 12,
    provider: 'weavy',
    emoji: '🌊',
    badge: 'HD EDIT',
    desc: 'Multi-image reference & edit visual fotorealistik ByteDance',
  },
  {
    id: 'flare-ai/flare-2.5',
    name: 'GPT Image 2.5',
    credits: 4,
    provider: 'weavy',
    emoji: '⚡',
    badge: 'HEMAT',
    desc: 'Generasi gambar ultra-cepat & hemat saldo koin Weavy AI',
  },
  {
    id: 'xai/grok-imagine-image',
    name: 'Grok Imagine Image',
    credits: 4,
    provider: 'weavy',
    emoji: '🚀',
    badge: 'xAI',
    desc: 'Model imajinasi visual kreatif & gaya seni unik xAI Grok',
  },
  {
    id: 'gpt_image_1_edit',
    name: 'ChatGPT Images 2.0 Edit',
    credits: 9,
    provider: 'weavy',
    emoji: '🎨',
    badge: 'OPENAI',
    desc: 'Edit gambar referensi dengan instruksi visual OpenAI DALL-E',
  },
  {
    id: 'gpt_image_2',
    name: 'ChatGPT Images 2.0',
    credits: 9,
    provider: 'weavy',
    emoji: '✨',
    badge: 'TEXT2IMG',
    desc: 'Text-to-Image OpenAI Canvas Engine berakurasi tinggi',
  },
  {
    id: 'gemini-omni-1.1-flash',
    name: 'Gemini Omni Flash (10s)',
    credits: 1,
    provider: 'gemini',
    emoji: '⚡',
    badge: 'OMNI FLASH',
    desc: 'Multimodal Video Engine Google Gemini native audio & motion',
  },
  {
    id: 'veo-3.1-generate-preview',
    name: 'Google Veo 3.1 Pro',
    credits: 1,
    provider: 'gemini',
    emoji: '🎬',
    badge: 'VEO CINEMA',
    desc: 'Google Veo 3.1 sinematik Full HD kelas studio',
  },
];

export const PROMPT_ENHANCER_MODELS = [
  { id: 'google/gemini-2.5-flash', name: 'Google Gemini 2.5 Flash' },
  { id: 'google/gemini-3-pro', name: 'Google Gemini 3.0 Pro' },
  { id: 'openai/gpt-5.6-sol', name: 'OpenAI GPT-5.6 Sol' },
  { id: 'anthropic/claude-3-7-sonnet', name: 'Claude 3.7 Sonnet' },
];

export const PROMPT_ENHANCER_PRESETS = {
  general: 'You are an elite AI prompt engineer. Expand the following user idea into a visually stunning, photorealistic description with dramatic lighting, 8k resolution, cinematic atmosphere, and clear subject focus. Keep it under 150 words.',
  cinematic: 'Transform the user idea into a high-budget Hollywood cinema still. Detail anamorphic lens bokeh, 35mm film grain, moody volumetric lighting, color grade, and intricate environmental textures.',
  photorealistic: 'Convert the input prompt into an award-winning National Geographic DSLR photograph. Detail camera model, f-stop, natural golden hour lighting, lens focal length, and hyper-realistic micro-textures.',
  anime: 'Enhance this prompt into a Makoto Shinkai / Studio Ghibli inspired anime masterpiece. Detail lush painted clouds, vibrant color palette, luminous lens flares, and emotional lighting.',
};

export function getNodeWidth(type) {
  if (type === 'imageViewer') return 340;
  if (type === 'imageModel') return 320;
  if (type === 'promptEnhancer' || type === 'anyLLM') return 330;
  if (type === 'imageInput') return 260;
  if (type === 'note') return 240;
  return 300;
}
