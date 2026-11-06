import { AIProvider, GenerationSettings, NavTab } from '../types';

export interface ProviderMeta {
  id: AIProvider;
  name: string;
  logoUrl: string;
  defaultQuota: number;
  creditUnit: 'Credits' | 'Coins';
}

// Total kredit per akun Google Gemini (1 generasi = 1 kredit, tidak reset)
export const GEMINI_MAX_CREDITS = 2;

export const PROVIDER_METADATA: Record<AIProvider, ProviderMeta> = {
  runninghub: {
    id: 'runninghub',
    name: 'RunningHub',
    logoUrl: 'https://www.runninghub.ai/favicon.ico?v=1.4',
    defaultQuota: 1000,
    creditUnit: 'Coins',
  },
  kie: {
    id: 'kie',
    name: 'Kie.ai',
    logoUrl: 'https://kie.ai/logo.png',
    defaultQuota: 80,
    creditUnit: 'Credits',
  },
  roboneo: {
    id: 'roboneo',
    name: 'RoboNeo',
    logoUrl: 'https://www.roboneo.com/favicon.ico',
    defaultQuota: 70,
    creditUnit: 'Credits',
  },
  galleri5: {
    id: 'galleri5',
    name: 'Galleri5',
    logoUrl: 'https://aistudio.galleri5.com/assets/Light%20mode-ClfS0paP.png',
    defaultQuota: 200,
    creditUnit: 'Credits',
  },
  weavy: {
    id: 'weavy',
    name: 'Weavy',
    logoUrl: 'https://cdn.prod.website-files.com/681b040781d5b5e278a69989/6829dad31872740b3fb4f912_favicon.svg',
    defaultQuota: 150,
    creditUnit: 'Credits',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    logoUrl: 'https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg',
    defaultQuota: GEMINI_MAX_CREDITS,
    creditUnit: 'Credits',
  },
  flow: {
    id: 'flow',
    name: 'Google Flow',
    logoUrl: 'https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg',
    defaultQuota: 50,
    creditUnit: 'Credits',
  },
  vids: {
    id: 'vids',
    name: 'Google Vids',
    logoUrl: 'https://ssl.gstatic.com/docs/videos/images/favicon-2026-v2.ico',
    defaultQuota: 500,
    creditUnit: 'Credits',
  },
};

export const resolveActiveProviderId = (
  settings?: Partial<GenerationSettings> | null,
  activeTab?: NavTab | null,
  externalProviderId?: string | null
): AIProvider => {
  if (activeTab === 'batch') return 'runninghub';

  if (activeTab === 'settings' && externalProviderId) {
    const p = externalProviderId.toLowerCase() as AIProvider;
    if (PROVIDER_METADATA[p]) return p;
  }

  // 1. Direct explicit provider in settings
  if (settings?.provider) {
    const p = settings.provider.toLowerCase() as AIProvider;
    if (PROVIDER_METADATA[p]) return p;
  }

  const isVideo = settings?.mode !== 'image';
  if (isVideo) {
    const vm = (settings?.videoModel || '') as string;
    const vmLower = vm.toLowerCase();

    if (
      vm === 'Google Vids Omni' ||
      vmLower.includes('vids')
    ) {
      return 'vids';
    }

    if (
      vm === 'Omni Flash' ||
      vm === 'Gemini Omni Flash Video (10s)' ||
      vm === 'Google Veo 2 / Gemini Video' ||
      vm === 'Google Veo 2' ||
      vmLower.includes('omni flash') ||
      vmLower.includes('veo') ||
      vmLower.includes('gemini')
    ) {
      return 'gemini';
    }
    if (
      vm === 'Motion Control' ||
      vm === 'S2 Motion Control' ||
      vm === 'MiniMax H3 Turbo Video' ||
      vm === 'RunningHub Video Studio' ||
      vm === 'Motion Control AmbMedia 1080HD' ||
      vm === 'Motion Control MotionFly 1080HD' ||
      vmLower.includes('minimax') ||
      vmLower.includes('s2 motion') ||
      vmLower.includes('ambmedia') ||
      vmLower.includes('motionfly') ||
      vmLower.includes('runninghub')
    ) {
      return 'runninghub';
    }
    if (vm === 'Kling 2.6 Motion Control') return 'roboneo';
    if (vm === 'Kling 2.6 Motion Control Standar' || vm === 'Galleri5 Video Studio') return 'galleri5';
    if (
      vm === 'Grok Imagine 1.5 Preview' ||
      vm === 'Grok Imagine (Image-to-Video)' ||
      vm === 'grok-imagine/image-to-video'
    ) {
      return 'kie';
    }
    if (vm === 'SeeDance 2.0 Mini') {
      if (settings?.provider === 'kie' || externalProviderId === 'kie') return 'kie';
      return 'weavy';
    }
    if (
      vm === 'Google Flow Video (1)' ||
      vmLower.includes('flow')
    ) {
      return 'flow';
    }
    if (vm === 'SeeDance 2.5' || vm === 'Kling 3.0 Pro Motion Control') return 'weavy';
  } else {
    const im = (settings?.imageModel || '') as string;
    const imLower = im.toLowerCase();
    if (
      im === 'Google Flow Image' ||
      imLower.includes('flow')
    ) {
      return 'flow';
    }
    if (
      im === 'Google Imagen 3 Pro' ||
      im === 'Gemini 3 Pro Image' ||
      imLower.includes('imagen') ||
      imLower.includes('gemini')
    ) {
      return 'gemini';
    }
    if (
      im === 'GPT Image 2 (Image-to-Image)' ||
      im === 'Seedream 4.0 Edit' ||
      im === 'GPT Image 2 (Text-to-Image)'
    ) {
      return 'kie';
    }
  }

  if (externalProviderId) {
    const p = externalProviderId.toLowerCase() as AIProvider;
    if (PROVIDER_METADATA[p]) return p;
  }

  return 'gemini';
};

export const resolveActiveProvider = (
  settings?: Partial<GenerationSettings> | null,
  activeTab?: NavTab | null,
  externalProviderId?: string | null
): ProviderMeta => {
  const id = resolveActiveProviderId(settings, activeTab, externalProviderId);
  return PROVIDER_METADATA[id] || PROVIDER_METADATA.gemini;
};
