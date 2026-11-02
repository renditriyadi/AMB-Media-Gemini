import { escapeHtml } from '../core/utils.js';

export function getModelIconHtml(model, extraClass = '') {
  if (!model) return '';
  if (model.iconUrl) {
    return `<img src="${model.iconUrl}" class="model-custom-icon ${extraClass}" alt="${escapeHtml(model.name)}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline-block';" loading="lazy"><span class="model-emoji-fallback" style="display:none;">${model.emoji || '✨'}</span>`;
  }
  return `<span class="model-emoji-fallback ${extraClass}">${model.emoji || '✨'}</span>`;
}

export const FLOW_MODEL_CATALOG = {
  image: [
    {
      id: 'nano_banana_pro',
      name: 'Nano Banana Pro',
      value: 'nano-banana-pro',
      emoji: '🍌',
      iconUrl: 'https://www.gstatic.com/lamda/images/favicon.svg',
      credits: 0,
      badge: 'FLOW',
      desc: 'Model image generation dan editing utama yang tersedia di Google Flow.',
    },
    {
      id: 'nano_banana_2',
      name: 'Nano Banana 2',
      value: 'nano-banana-2',
      emoji: '🧠',
      iconUrl: 'https://www.gstatic.com/lamda/images/favicon.svg',
      credits: 0,
      badge: 'NEW',
      desc: 'Model image generation generasi terbaru Google Flow dengan akurasi detail tinggi.',
    },
    {
      id: 'nano_banana_2_lite',
      name: 'Nano Banana 2 Lite',
      value: 'nano-banana-2-lite',
      emoji: '⚡',
      iconUrl: 'https://www.gstatic.com/lamda/images/favicon.svg',
      credits: 0,
      badge: 'FAST',
      desc: 'Varian cepat hemat resource Google Flow untuk rendering visual instan.',
    },
  ],
  video: [
    {
      id: 'omni_1_1_flash',
      name: 'Omni 1.1 Flash',
      value: 'google-flow-omni-1-1-flash',
      emoji: '⚡',
      iconUrl: 'https://www.gstatic.com/lamda/images/favicon.svg',
      credits: 0,
      badge: 'AUDIO-NATIVE',
      desc: 'Model video cepat Google Flow untuk eksperimen motion dinamis dan audio-native generation.',
    },
    {
      id: 'veo_3_1_fast',
      name: 'Veo 3.1 - Fast',
      value: 'google-flow-veo-3-1-fast',
      emoji: '🎬',
      iconUrl: 'https://www.gstatic.com/lamda/images/favicon.svg',
      credits: 0,
      badge: 'FAST 720P',
      desc: 'Model video Veo 3.1 rendering cepat Google Flow untuk hasil motion yang responsif.',
    },
    {
      id: 'veo_3_1_quality',
      name: 'Veo 3.1 - Quality',
      value: 'google-flow-veo-3-1-quality',
      emoji: '🎥',
      iconUrl: 'https://www.gstatic.com/lamda/images/favicon.svg',
      credits: 0,
      badge: '1080P CINEMA',
      desc: 'Model video Veo 3.1 kualitas tinggi Google Flow untuk hasil sinematik maksimal.',
    },
    {
      id: 'veo_3_1_lite',
      name: 'Veo 3.1 - Lite',
      value: 'google-flow-veo-3-1-lite',
      emoji: '🎬',
      iconUrl: 'https://www.gstatic.com/lamda/images/favicon.svg',
      credits: 0,
      badge: 'LITE',
      desc: 'Model video ringan Google Flow untuk generasi hemat kuota.',
    },
  ],
};

export const FLOW_IMAGE_MODELS_V2 = FLOW_MODEL_CATALOG.image;
export const FLOW_VIDEO_MODELS_V2 = FLOW_MODEL_CATALOG.video;

export const DOLA_MODEL_CATALOG = {
  video: [
    {
      id: 'dola_seedance_v2_0_fast',
      name: 'Dreamina Seedance 2.0 Fast',
      value: 'seedance_v2.0_fast',
      emoji: '⚡',
      iconUrl: 'https://sf-flow-web-cdn.ciciai.com/obj/ocean-flow-web-sg/dola_web/favicon-dola.png',
      credits: 0,
      badge: 'FAST (DEFAULT)',
      desc: 'High quality for fast results • Model default Dola AI untuk generasi video cepat dan responsif.',
    },
    {
      id: 'dola_seedance_v2_5',
      name: 'Dreamina Seedance 2.5 Pro',
      value: 'seedance_v2.5',
      emoji: '🎬',
      iconUrl: 'https://sf-flow-web-cdn.ciciai.com/obj/ocean-flow-web-sg/dola_web/favicon-dola.png',
      credits: 0,
      badge: 'PRO HD',
      desc: 'Best quality • 5x credit usage (1080p Full HD sinematik, Multi-Image Ref 1-3 foto, unwatermarked).',
    },
    {
      id: 'dola_seedance_v1_0',
      name: 'Dreamina Seedance 1.0',
      value: 'seedance_v1.0',
      emoji: '🎥',
      iconUrl: 'https://sf-flow-web-cdn.ciciai.com/obj/ocean-flow-web-sg/dola_web/favicon-dola.png',
      credits: 0,
      badge: '1.0',
      desc: 'For simple videos • Video standar ringan dan efisien.',
    },
  ],
  image: [
    {
      id: 'dola_seedream_v4_5',
      name: 'Seedream 4.5 (Fast)',
      value: 'seedream_v4.5',
      emoji: '⚡',
      iconUrl: 'https://sf-flow-web-cdn.ciciai.com/obj/ocean-flow-web-sg/dola_web/favicon-dola.png',
      credits: 0,
      badge: 'FAST (DEFAULT)',
      desc: 'Reliable quality for daily use • Default cepat Text-to-Image & Multi-Reference.',
    },
    {
      id: 'dola_seedream_v5_pro',
      name: 'Seedream 5.0 Pro',
      value: 'seedream_v5.0_pro',
      emoji: '🌟',
      iconUrl: 'https://sf-flow-web-cdn.ciciai.com/obj/ocean-flow-web-sg/dola_web/favicon-dola.png',
      credits: 0,
      badge: '5.0 PRO',
      desc: 'Professional use • 4x credit usage (detail resolusi tinggi & fotorealistik).',
    },
  ],
};

export const DOLA_IMAGE_MODELS_V2 = DOLA_MODEL_CATALOG.image;
export const DOLA_VIDEO_MODELS_V2 = DOLA_MODEL_CATALOG.video;

export const IMAGE_MODELS_V2 = [
  {
    id: 'nano_banana_pro',
    name: 'Nano Banana Pro',
    value: 'fal-ai/nano-banana-pro/edit',
    emoji: '🍌',
    iconUrl: 'https://devicons.io/devicons/icons/nanobanana.svg',
    credits: 11,
    badge: 'POPULAR',
    desc: 'Generasi gambar & edit pose/kamera berakurasi tinggi (1K, 2K, 4K resolution)!',
  },
  {
    id: 'seedream_v5_pro_edit',
    name: 'Seedream V5.0 Pro Edit',
    value: 'fal-ai/bytedance/seedream/v5/lite/edit',
    emoji: '🌊',
    iconUrl: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lapzild-tss/ljhwZthlaukjlkulzlp/favicon_1/favicon.ico',
    credits: 12,
    badge: 'HD EDIT',
    desc: 'Multi-image reference & edit visual fotorealistik mutakhir ByteDance!',
  },
  {
    id: 'gpt_image_2_5',
    name: 'GPT Image 2.5',
    value: 'flare-ai/flare-2.5',
    emoji: '⚡',
    iconUrl: 'https://chatgpt.com/cdn/assets/favicon-l4nq08hd.svg',
    credits: 4,
    badge: 'HEMAT',
    desc: 'Generasi gambar ultra-cepat & hemat saldo koin Weavy AI.',
  },
  {
    id: 'gpt_image_1_edit',
    name: 'ChatGPT Images 2.0 Edit',
    value: 'gpt_image_1_edit',
    emoji: '🎨',
    iconUrl: 'https://chatgpt.com/cdn/assets/favicon-l4nq08hd.svg',
    credits: 9,
    badge: 'OPENAI',
    desc: 'Edit gambar referensi dengan instruksi visual OpenAI DALL-E.',
  },
  {
    id: 'gpt_image_2',
    name: 'ChatGPT Images 2.0',
    value: 'gpt_image_2',
    emoji: '✨',
    iconUrl: 'https://chatgpt.com/cdn/assets/favicon-l4nq08hd.svg',
    credits: 9,
    badge: 'TEXT2IMG',
    desc: 'Text-to-Image OpenAI Canvas Engine berakurasi tinggi.',
  },
  {
    id: 'grok_imagine',
    name: 'Grok Imagine Image',
    value: 'xai/grok-imagine-image',
    emoji: '🚀',
    iconUrl: 'https://grok.com/images/favicon.ico',
    credits: 4,
    badge: 'xAI',
    desc: 'Model imajinasi visual kreatif & gaya seni unik xAI Grok.',
  },
];

export const VIDEO_MODELS_V2 = [
  {
    id: 'wan_2_1',
    name: 'Wan 2.1 Video Pro',
    value: 'wan-video/wan-2.1-t2v-14b',
    emoji: '🎬',
    credits: 15,
    badge: 'CINEMATIC',
    desc: 'Generasi video sinematik 14B resolusi HD & konsistensi visual tinggi!',
  },
  {
    id: 'kling_pro',
    name: 'Kling 1.5 Pro Video',
    value: 'kling/v1.5/pro',
    emoji: '🎥',
    credits: 20,
    badge: 'PRO MOTION',
    desc: 'Gerakan dinamis realistis & pencahayaan kelas profesional.',
  },
  {
    id: 'minimax_hailuo',
    name: 'Minimax Hailuo Video',
    value: 'minimax/hailuo-video-01',
    emoji: '⚡',
    credits: 18,
    badge: 'PROMPT FOLLOWER',
    desc: 'Video dinamis dengan kemampuan mengikuti prompt yang sangat tinggi.',
  },
  {
    id: 'luma_dream',
    name: 'Luma Dream Machine',
    value: 'luma/dream-machine',
    emoji: '🌟',
    credits: 20,
    badge: '3D CAMERA',
    desc: 'Sinematik 3D dan animasi kamera mulus kelas bioskop.',
  },
];
