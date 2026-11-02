// canvas-recipes.js - Presets & Graph Resolvers for Canvas (100% Pola Project Utama)

export function createEmptyCanvasRecipe(title = 'untitled') {
  return {
    id: `recipe_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: title,
    description: '',
    nodes: [],
    edges: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Preset 1: Text to Image with Nano Banana Pro (Google Gemini)
export function createNanoBananaPreset() {
  const promptId = `node_prompt_${Date.now()}`;
  const modelId = `node_model_${Date.now() + 1}`;
  const viewerId = `node_viewer_${Date.now() + 2}`;

  const promptNode = {
    id: promptId,
    type: 'prompt',
    title: 'Text Prompt',
    subtitle: 'Input prompt deskripsi visual',
    colorTheme: 'green',
    position: { x: 120, y: 180 },
    inputs: [],
    outputs: [
      { id: 'output-text', name: 'text', type: 'text', label: 'Text Prompt' },
    ],
    data: {
      prompt: 'a majestic cyberpunk samurai tiger walking through neon rain in neo-tokyo, 8k cinematic masterpiece, ultra-detailed photography, vibrant colors',
      negativePrompt: 'blurry, low quality, distorted, deformed, bad anatomy',
      presetStyle: 'Cinematic',
    },
  };

  const modelNode = {
    id: modelId,
    type: 'imageModel',
    title: 'Weavy',
    subtitle: 'Nano Banana Pro',
    colorTheme: 'red',
    position: { x: 520, y: 160 },
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
      aspectRatio: '1:1',
      seed: Math.floor(Math.random() * 999999),
      isRandomSeed: true,
      enableWebSearch: false,
      creditsCost: 11,
    },
  };

  const viewerNode = {
    id: viewerId,
    type: 'imageViewer',
    title: 'Nano Banana Pro',
    subtitle: 'Viewer & Download',
    colorTheme: 'purple',
    position: { x: 920, y: 180 },
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

  const edges = [
    {
      id: `edge_${promptId}_${modelId}`,
      sourceNodeId: promptId,
      sourceOutputId: 'output-text',
      targetNodeId: modelId,
      targetInputId: 'input-prompt',
      color: '#10b981',
    },
    {
      id: `edge_${modelId}_${viewerId}`,
      sourceNodeId: modelId,
      sourceOutputId: 'output-result',
      targetNodeId: viewerId,
      targetInputId: 'input-image',
      color: '#a855f7',
    },
  ];

  return {
    id: `recipe_nanobanana_${Date.now()}`,
    name: 'Nano Banana Pro (Text to Image)',
    description: 'Generasi visual resolusi tinggi dengan model Google Nano Banana Pro.',
    nodes: [promptNode, modelNode, viewerNode],
    edges,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Preset 2: Seedream V5.0 Pro Edit (ByteDance Multi-Image Reference)
export function createSeedreamEditPreset() {
  const imageInputId = `node_img_${Date.now()}`;
  const promptId = `node_prompt_${Date.now() + 1}`;
  const modelId = `node_model_${Date.now() + 2}`;
  const viewerId = `node_viewer_${Date.now() + 3}`;

  const imageInputNode = {
    id: imageInputId,
    type: 'imageInput',
    title: 'Reference Image',
    subtitle: 'Foto subjek atau pose',
    colorTheme: 'blue',
    position: { x: 100, y: 120 },
    inputs: [],
    outputs: [
      { id: 'output-image', name: 'image', type: 'image', label: 'Image Output' },
    ],
    data: {
      imageUrl: '',
      fileName: 'reference_face.jpg',
      aspectRatio: '1:1',
    },
  };

  const promptNode = {
    id: promptId,
    type: 'prompt',
    title: 'Edit Instructions',
    subtitle: 'Instruksi perubahan visual',
    colorTheme: 'green',
    position: { x: 100, y: 380 },
    inputs: [],
    outputs: [
      { id: 'output-text', name: 'text', type: 'text', label: 'Text Prompt' },
    ],
    data: {
      prompt: 'change clothing into an elegant futuristic silver cyberpunk trench coat, glowing led accents, neon backlighting, high fashion editorial portrait',
      negativePrompt: 'deformed, blurry, bad anatomy',
      presetStyle: 'Photorealistic',
    },
  };

  const modelNode = {
    id: modelId,
    type: 'imageModel',
    title: 'Seedream 5.0 Pro',
    subtitle: 'ByteDance Multi-Ref',
    colorTheme: 'amber',
    position: { x: 500, y: 180 },
    inputs: [
      { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
      { id: 'input-image', name: 'image_1', type: 'image', label: 'Ref Image', required: false },
    ],
    outputs: [
      { id: 'output-result', name: 'result', type: 'image', label: 'Generated Image' },
    ],
    data: {
      modelId: 'fal-ai/bytedance/seedream/v5/lite/edit',
      modelDisplayName: 'Seedream V5.0 Pro Edit',
      provider: 'weavy',
      resolution: '1K',
      aspectRatio: '1:1',
      seed: Math.floor(Math.random() * 999999),
      isRandomSeed: true,
      creditsCost: 12,
    },
  };

  const viewerNode = {
    id: viewerId,
    type: 'imageViewer',
    title: 'Seedream Output',
    subtitle: 'Result View & Export',
    colorTheme: 'purple',
    position: { x: 900, y: 180 },
    inputs: [
      { id: 'input-image', name: 'image', type: 'image', label: 'Input Result', required: true },
    ],
    outputs: [],
    data: { status: 'idle', progress: 0 },
  };

  const edges = [
    {
      id: `edge_${imageInputId}_${modelId}`,
      sourceNodeId: imageInputId,
      sourceOutputId: 'output-image',
      targetNodeId: modelId,
      targetInputId: 'input-image',
      color: '#3b82f6',
    },
    {
      id: `edge_${promptId}_${modelId}`,
      sourceNodeId: promptId,
      sourceOutputId: 'output-text',
      targetNodeId: modelId,
      targetInputId: 'input-prompt',
      color: '#10b981',
    },
    {
      id: `edge_${modelId}_${viewerId}`,
      sourceNodeId: modelId,
      sourceOutputId: 'output-result',
      targetNodeId: viewerId,
      targetInputId: 'input-image',
      color: '#a855f7',
    },
  ];

  return {
    id: `recipe_seedream_${Date.now()}`,
    name: 'Seedream 5.0 Pro Edit (Image to Image)',
    description: 'Transformasi gambar referensi dengan model mutakhir ByteDance Seedream.',
    nodes: [imageInputNode, promptNode, modelNode, viewerNode],
    edges,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Preset 3: Grok Imagine
export function createGrokImaginePreset() {
  const promptId = `node_prompt_${Date.now()}`;
  const modelId = `node_model_${Date.now() + 1}`;
  const viewerId = `node_viewer_${Date.now() + 2}`;

  const promptNode = {
    id: promptId,
    type: 'prompt',
    title: 'Grok Idea',
    subtitle: 'Input prompt kreatif',
    colorTheme: 'green',
    position: { x: 120, y: 180 },
    inputs: [],
    outputs: [
      { id: 'output-text', name: 'text', type: 'text', label: 'Text Prompt' },
    ],
    data: {
      prompt: 'a surreal dreamscape with floating crystal islands in a lavender sky, bioluminescent waterfalls cascading into stars, cosmic fantasy art',
      negativePrompt: '',
    },
  };

  const modelNode = {
    id: modelId,
    type: 'imageModel',
    title: 'xAI Grok',
    subtitle: 'Grok Imagine Image',
    colorTheme: 'blue',
    position: { x: 520, y: 160 },
    inputs: [
      { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
      { id: 'input-image', name: 'image_1', type: 'image', label: 'Ref Image', required: false },
    ],
    outputs: [
      { id: 'output-result', name: 'result', type: 'image', label: 'Generated Image' },
    ],
    data: {
      modelId: 'xai/grok-imagine-image',
      modelDisplayName: 'Grok Imagine Image',
      provider: 'weavy',
      resolution: '1K',
      aspectRatio: '16:9',
      seed: Math.floor(Math.random() * 999999),
      isRandomSeed: true,
      creditsCost: 4,
    },
  };

  const viewerNode = {
    id: viewerId,
    type: 'imageViewer',
    title: 'Grok View',
    subtitle: 'Viewer',
    colorTheme: 'purple',
    position: { x: 920, y: 180 },
    inputs: [
      { id: 'input-image', name: 'image', type: 'image', label: 'Input Result', required: true },
    ],
    outputs: [],
    data: { status: 'idle', progress: 0 },
  };

  return {
    id: `recipe_grok_${Date.now()}`,
    name: 'Grok Imagine Image (xAI Creative)',
    description: 'Generasi visual imajinatif hemat koin dengan xAI Grok.',
    nodes: [promptNode, modelNode, viewerNode],
    edges: [
      {
        id: `edge_${promptId}_${modelId}`,
        sourceNodeId: promptId,
        sourceOutputId: 'output-text',
        targetNodeId: modelId,
        targetInputId: 'input-prompt',
        color: '#10b981',
      },
      {
        id: `edge_${modelId}_${viewerId}`,
        sourceNodeId: modelId,
        sourceOutputId: 'output-result',
        targetNodeId: viewerId,
        targetInputId: 'input-image',
        color: '#a855f7',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Preset 4: ChatGPT 2.5
export function createGptImage25Preset() {
  const promptId = `node_prompt_${Date.now()}`;
  const modelId = `node_model_${Date.now() + 1}`;
  const viewerId = `node_viewer_${Date.now() + 2}`;

  return {
    id: `recipe_gpt_${Date.now()}`,
    name: 'GPT Image 2.5 (Ultra Fast)',
    description: 'Generasi gambar cepat dan hemat koin dengan OpenAI GPT Image 2.5.',
    nodes: [
      {
        id: promptId,
        type: 'prompt',
        title: 'Prompt',
        subtitle: 'Deskripsi gambar',
        colorTheme: 'green',
        position: { x: 120, y: 180 },
        inputs: [],
        outputs: [{ id: 'output-text', name: 'text', type: 'text', label: 'Prompt' }],
        data: {
          prompt: 'minimalist coffee shop interior on a rainy afternoon, warm ambient lighting, wooden aesthetics, cozy vibe, photorealistic 4k',
        },
      },
      {
        id: modelId,
        type: 'imageModel',
        title: 'GPT Image 2.5',
        subtitle: 'Flare / OpenAI',
        colorTheme: 'amber',
        position: { x: 520, y: 160 },
        inputs: [
          { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
          { id: 'input-image', name: 'image_1', type: 'image', label: 'Ref Image', required: false },
        ],
        outputs: [{ id: 'output-result', name: 'result', type: 'image', label: 'Image' }],
        data: {
          modelId: 'flare-ai/flare-2.5',
          modelDisplayName: 'GPT Image 2.5',
          provider: 'weavy',
          resolution: '1K',
          aspectRatio: '9:16',
          seed: Math.floor(Math.random() * 999999),
          isRandomSeed: true,
          creditsCost: 4,
        },
      },
      {
        id: viewerId,
        type: 'imageViewer',
        title: 'Result Viewer',
        subtitle: 'Preview',
        colorTheme: 'purple',
        position: { x: 920, y: 180 },
        inputs: [{ id: 'input-image', name: 'image', type: 'image', label: 'Input' }],
        outputs: [],
        data: { status: 'idle', progress: 0 },
      },
    ],
    edges: [
      {
        id: `edge_${promptId}_${modelId}`,
        sourceNodeId: promptId,
        sourceOutputId: 'output-text',
        targetNodeId: modelId,
        targetInputId: 'input-prompt',
        color: '#10b981',
      },
      {
        id: `edge_${modelId}_${viewerId}`,
        sourceNodeId: modelId,
        sourceOutputId: 'output-result',
        targetNodeId: viewerId,
        targetInputId: 'input-image',
        color: '#a855f7',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Preset 5: Prompt Enhancer Workflow
export function createPromptEnhancerPreset() {
  const promptId = `node_prompt_${Date.now()}`;
  const enhancerId = `node_enh_${Date.now() + 1}`;
  const modelId = `node_model_${Date.now() + 2}`;
  const viewerId = `node_viewer_${Date.now() + 3}`;

  return {
    id: `recipe_enhancer_${Date.now()}`,
    name: 'Prompt Enhancer & Master Generator',
    description: 'Pengembangan prompt otomatis via LLM lalu dirender dengan Nano Banana Pro.',
    nodes: [
      {
        id: promptId,
        type: 'prompt',
        title: 'Rough Idea',
        subtitle: 'Ide kasar pengguna',
        colorTheme: 'green',
        position: { x: 80, y: 180 },
        inputs: [],
        outputs: [{ id: 'output-text', name: 'text', type: 'text', label: 'Draft' }],
        data: { prompt: 'futuristic flying car in cyberpunk city' },
      },
      {
        id: enhancerId,
        type: 'promptEnhancer',
        title: 'Prompt Enhancer',
        subtitle: 'Gemini 2.5 Flash',
        colorTheme: 'blue',
        position: { x: 440, y: 160 },
        inputs: [{ id: 'input-prompt', name: 'prompt', type: 'text', label: 'Draft' }],
        outputs: [{ id: 'output-enhanced', name: 'enhanced', type: 'text', label: 'Expanded Prompt' }],
        data: {
          model: 'google/gemini-2.5-flash',
          systemPrompt: 'You are an elite AI prompt engineer. Expand the following user idea into a visually stunning, photorealistic description with dramatic lighting, 8k resolution, cinematic atmosphere. Keep it under 120 words.',
          presetTask: 'cinematic',
        },
      },
      {
        id: modelId,
        type: 'imageModel',
        title: 'Nano Banana Pro',
        subtitle: 'Renderer',
        colorTheme: 'red',
        position: { x: 820, y: 160 },
        inputs: [
          { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
          { id: 'input-image', name: 'image_1', type: 'image', label: 'Ref Image', required: false },
        ],
        outputs: [{ id: 'output-result', name: 'result', type: 'image', label: 'Image' }],
        data: {
          modelId: 'fal-ai/nano-banana-pro/edit',
          modelDisplayName: 'Nano Banana Pro',
          provider: 'weavy',
          resolution: '1K',
          aspectRatio: '16:9',
          seed: Math.floor(Math.random() * 999999),
          isRandomSeed: true,
          creditsCost: 11,
        },
      },
      {
        id: viewerId,
        type: 'imageViewer',
        title: 'Viewer',
        subtitle: 'Preview',
        colorTheme: 'purple',
        position: { x: 1200, y: 180 },
        inputs: [{ id: 'input-image', name: 'image', type: 'image', label: 'Input' }],
        outputs: [],
        data: { status: 'idle', progress: 0 },
      },
    ],
    edges: [
      {
        id: `e1_${promptId}`,
        sourceNodeId: promptId,
        sourceOutputId: 'output-text',
        targetNodeId: enhancerId,
        targetInputId: 'input-prompt',
        color: '#10b981',
      },
      {
        id: `e2_${enhancerId}`,
        sourceNodeId: enhancerId,
        sourceOutputId: 'output-enhanced',
        targetNodeId: modelId,
        targetInputId: 'input-prompt',
        color: '#3b82f6',
      },
      {
        id: `e3_${modelId}`,
        sourceNodeId: modelId,
        sourceOutputId: 'output-result',
        targetNodeId: viewerId,
        targetInputId: 'input-image',
        color: '#a855f7',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Preset 6: Any LLM Node
export function createAnyLLMPreset() {
  const promptId = `node_prompt_${Date.now()}`;
  const llmId = `node_llm_${Date.now() + 1}`;
  const noteId = `node_note_${Date.now() + 2}`;

  return {
    id: `recipe_llm_${Date.now()}`,
    name: 'Any LLM Multimodal Reasoning',
    description: 'Analisis dan eksplorasi logika visual dengan model LLM canggih.',
    nodes: [
      {
        id: promptId,
        type: 'prompt',
        title: 'User Input',
        subtitle: 'Instruksi',
        colorTheme: 'green',
        position: { x: 100, y: 160 },
        inputs: [],
        outputs: [{ id: 'output-text', name: 'text', type: 'text', label: 'Text' }],
        data: { prompt: 'Jelaskan konsep arsitektur visual untuk kampanye brand streetwear ramah lingkungan.' },
      },
      {
        id: llmId,
        type: 'anyLLM',
        title: 'Any LLM',
        subtitle: 'Gemini 2.5 Flash',
        colorTheme: 'blue',
        position: { x: 480, y: 140 },
        inputs: [{ id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt' }],
        outputs: [{ id: 'output-text', name: 'text', type: 'text', label: 'Result Text' }],
        data: {
          model: 'google/gemini-2.5-flash',
          modelDisplayName: 'Gemini 2.5 Flash',
          systemPrompt: 'You are a creative brand strategist.',
          temperature: 0.7,
        },
      },
      {
        id: noteId,
        type: 'note',
        title: 'Catatan Tim',
        subtitle: 'Dokumentasi',
        colorTheme: 'amber',
        position: { x: 880, y: 160 },
        inputs: [],
        outputs: [],
        data: { text: 'Workflow ini dapat dihubungkan ke Prompt Generator atau Storyboard AI.' },
      },
    ],
    edges: [
      {
        id: `e1_${promptId}`,
        sourceNodeId: promptId,
        sourceOutputId: 'output-text',
        targetNodeId: llmId,
        targetInputId: 'input-prompt',
        color: '#10b981',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Preset 7: Gemini Omni Flash Video
export function createGeminiOmniPreset() {
  const promptId = `node_prompt_${Date.now()}`;
  const imageInputId = `node_img_${Date.now() + 1}`;
  const modelId = `node_model_${Date.now() + 2}`;
  const viewerId = `node_viewer_${Date.now() + 3}`;

  return {
    id: `recipe_omni_${Date.now()}`,
    name: 'Gemini Omni Flash (Image to Video)',
    description: 'Render video dinamis 10 detik dari foto referensi dengan Gemini Omni Flash.',
    nodes: [
      {
        id: imageInputId,
        type: 'imageInput',
        title: 'Start Frame Photo',
        subtitle: 'Foto referensi awal',
        colorTheme: 'blue',
        position: { x: 100, y: 100 },
        inputs: [],
        outputs: [{ id: 'output-image', name: 'image', type: 'image', label: 'Image' }],
        data: { imageUrl: '', fileName: 'hero_character.jpg', aspectRatio: '16:9' },
      },
      {
        id: promptId,
        type: 'prompt',
        title: 'Motion Prompt',
        subtitle: 'Instruksi pergerakan',
        colorTheme: 'green',
        position: { x: 100, y: 360 },
        inputs: [],
        outputs: [{ id: 'output-text', name: 'text', type: 'text', label: 'Text' }],
        data: { prompt: 'cinematic camera slow tracking shot, character looks up and smiles, neon dust drifting in wind, photorealistic 4k 60fps' },
      },
      {
        id: modelId,
        type: 'imageModel',
        title: 'Gemini Omni Flash',
        subtitle: '10s Multimodal Video',
        colorTheme: 'red',
        position: { x: 500, y: 180 },
        inputs: [
          { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
          { id: 'input-image', name: 'image_1', type: 'image', label: 'Ref Image', required: false },
        ],
        outputs: [{ id: 'output-result', name: 'result', type: 'image', label: 'Generated Video' }],
        data: {
          modelId: 'gemini-omni-1.1-flash',
          modelDisplayName: 'Gemini Omni Flash (10s)',
          provider: 'gemini',
          resolution: '720p',
          aspectRatio: '16:9',
          seed: Math.floor(Math.random() * 999999),
          isRandomSeed: true,
          creditsCost: 1,
        },
      },
      {
        id: viewerId,
        type: 'imageViewer',
        title: 'Omni Video Viewer',
        subtitle: 'Preview & Download',
        colorTheme: 'purple',
        position: { x: 920, y: 180 },
        inputs: [{ id: 'input-image', name: 'image', type: 'image', label: 'Input' }],
        outputs: [],
        data: { status: 'idle', progress: 0 },
      },
    ],
    edges: [
      {
        id: `e1_${imageInputId}`,
        sourceNodeId: imageInputId,
        sourceOutputId: 'output-image',
        targetNodeId: modelId,
        targetInputId: 'input-image',
        color: '#3b82f6',
      },
      {
        id: `e2_${promptId}`,
        sourceNodeId: promptId,
        sourceOutputId: 'output-text',
        targetNodeId: modelId,
        targetInputId: 'input-prompt',
        color: '#10b981',
      },
      {
        id: `e3_${modelId}`,
        sourceNodeId: modelId,
        sourceOutputId: 'output-result',
        targetNodeId: viewerId,
        targetInputId: 'input-image',
        color: '#a855f7',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Helpers to resolve node inputs across connected wires
export function resolveModelInputs(modelNode, recipe) {
  let prompt = modelNode.data?.promptOverride || '';
  let inputImageUrl = modelNode.data?.inputImageUrl || '';

  const incomingEdges = (recipe.edges || []).filter((e) => e.targetNodeId === modelNode.id);
  for (const edge of incomingEdges) {
    const sourceNode = (recipe.nodes || []).find((n) => n.id === edge.sourceNodeId);
    if (!sourceNode) continue;

    if (edge.targetInputId === 'input-prompt') {
      if (sourceNode.type === 'prompt') {
        prompt = sourceNode.data?.prompt || prompt;
      } else if (sourceNode.type === 'promptEnhancer') {
        prompt = sourceNode.data?.enhancedPrompt || sourceNode.data?.inputPrompt || prompt;
      } else if (sourceNode.type === 'anyLLM') {
        prompt = sourceNode.data?.generatedText || sourceNode.data?.inputPrompt || prompt;
      }
    }

    if (edge.targetInputId === 'input-image' || edge.targetInputId === 'input-image-1') {
      if (sourceNode.type === 'imageInput') {
        inputImageUrl = sourceNode.data?.imageUrl || inputImageUrl;
      } else if (sourceNode.type === 'imageModel' || sourceNode.type === 'imageViewer') {
        inputImageUrl = sourceNode.data?.resultUrl || sourceNode.data?.outputImage || inputImageUrl;
      }
    }
  }

  return { prompt, inputImageUrl };
}

export function resolveEnhancerInputs(enhancerNode, recipe) {
  let inputPrompt = enhancerNode.data?.inputPrompt || '';
  const incoming = (recipe.edges || []).filter((e) => e.targetNodeId === enhancerNode.id);
  for (const edge of incoming) {
    const source = (recipe.nodes || []).find((n) => n.id === edge.sourceNodeId);
    if (source && source.type === 'prompt') {
      inputPrompt = source.data?.prompt || inputPrompt;
    }
  }
  return { inputPrompt };
}
