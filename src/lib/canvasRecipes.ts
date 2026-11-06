import { dedupeStoryboardScenes } from './storyboardScenes';
import {
  CanvasNode,
  CanvasEdge,
  CanvasRecipe,
  WEAVY_IMAGE_MODELS,
  WEAVY_PROMPT_ENHANCER_MODELS,
  getStoryboardOutputs,
  getAiWorkerPortValue,
} from '../types/canvas';

/**
 * Creates a completely clean, empty canvas recipe (0 nodes, 0 edges).
 */
export function createEmptyCanvasRecipe(title = 'untitled'): CanvasRecipe {
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
export function createNanoBananaPreset(): CanvasRecipe {
  const promptId = `node_prompt_${Date.now()}`;
  const modelId = `node_model_${Date.now() + 1}`;
  const viewerId = `node_viewer_${Date.now() + 2}`;

  const promptNode: CanvasNode = {
    id: promptId,
    type: 'prompt',
    title: 'Text Prompt',
    subtitle: 'Input prompt deskripsi',
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

  const modelNode: CanvasNode = {
    id: modelId,
    type: 'imageModel',
    title: 'Weavy',
    subtitle: 'Weavy AI Engine',
    colorTheme: 'red',
    position: { x: 560, y: 160 },
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

  const viewerNode: CanvasNode = {
    id: viewerId,
    type: 'imageViewer',
    title: 'Nano Banana Pro',
    subtitle: 'Viewer & Download',
    colorTheme: 'purple',
    position: { x: 1000, y: 180 },
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

  const edges: CanvasEdge[] = [
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
    id: `recipe_${Date.now()}`,
    name: 'Nano Banana Pro (Text to Image)',
    description: 'Pipeline generasi gambar photorealistic Google Gemini 3 dengan prompt teks',
    nodes: [promptNode, modelNode, viewerNode],
    edges,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Preset 2: Image-to-Image / Transformation with ByteDance Seedream V5
export function createSeedreamEditPreset(): CanvasRecipe {
  const imageInputId = `node_img_${Date.now()}`;
  const promptId = `node_prompt_${Date.now() + 1}`;
  const modelId = `node_model_${Date.now() + 2}`;
  const viewerId = `node_viewer_${Date.now() + 3}`;

  const imageInputNode: CanvasNode = {
    id: imageInputId,
    type: 'imageInput',
    title: 'Source Image',
    subtitle: 'Upload gambar dasar',
    colorTheme: 'blue',
    position: { x: 120, y: 80 },
    inputs: [],
    outputs: [
      { id: 'output-image', name: 'image', type: 'image', label: 'Source Image' },
    ],
    data: {
      imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
      fileName: 'portrait_sample.jpg',
    },
  };

  const promptNode: CanvasNode = {
    id: promptId,
    type: 'prompt',
    title: 'Edit Instruction',
    subtitle: 'Ubah atau beri sentuhan gaya',
    colorTheme: 'green',
    position: { x: 120, y: 440 },
    inputs: [],
    outputs: [
      { id: 'output-text', name: 'text', type: 'text', label: 'Instruction' },
    ],
    data: {
      prompt: 'transform this woman into a fantasy goddess with glowing celestial ornaments, golden crown, soft ethereal lighting, hyper-detailed fantasy art',
      negativePrompt: 'low quality, blurry, deformed hands',
    },
  };

  const modelNode: CanvasNode = {
    id: modelId,
    type: 'imageModel',
    title: 'Seedream V5.0 Pro',
    subtitle: 'ByteDance Image Edit',
    colorTheme: 'red',
    position: { x: 560, y: 220 },
    inputs: [
      { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
      { id: 'input-image', name: 'image_1', type: 'image', label: 'Source Image', required: true },
    ],
    outputs: [
      { id: 'output-result', name: 'result', type: 'image', label: 'Edited Image' },
    ],
    data: {
      modelId: 'fal-ai/bytedance/seedream/v5/lite/edit',
      modelDisplayName: 'Seedream V5.0 Pro Edit',
      provider: 'weavy',
      resolution: '1080p',
      aspectRatio: '9:16',
      seed: Math.floor(Math.random() * 999999),
      isRandomSeed: true,
      creditsCost: 12,
    },
  };

  const viewerNode: CanvasNode = {
    id: viewerId,
    type: 'imageViewer',
    title: 'Seedream V5.0 Pro Edit',
    subtitle: 'Hasil transformasi',
    colorTheme: 'purple',
    position: { x: 1000, y: 220 },
    inputs: [
      { id: 'input-image', name: 'image', type: 'image', label: 'Result Image', required: true },
    ],
    outputs: [
      { id: 'output-image', name: 'image', type: 'image', label: 'Pass-through' },
    ],
    data: {
      status: 'idle',
      progress: 0,
    },
  };

  const edges: CanvasEdge[] = [
    {
      id: `edge_${imageInputId}_${modelId}`,
      sourceNodeId: imageInputId,
      sourceOutputId: 'output-image',
      targetNodeId: modelId,
      targetInputId: 'input-image',
      color: '#14b8a6',
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
    id: `recipe_${Date.now()}`,
    name: 'Seedream V5 Image Edit (Image to Image)',
    description: 'Transformasi gambar dan editing cerdas menggunakan ByteDance Seedream V5.0 Pro',
    nodes: [imageInputNode, promptNode, modelNode, viewerNode],
    edges,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Preset 3: Grok Imagine
export function createGrokImaginePreset(): CanvasRecipe {
  const promptId = `node_prompt_${Date.now()}`;
  const modelId = `node_model_${Date.now() + 1}`;
  const viewerId = `node_viewer_${Date.now() + 2}`;

  const promptNode: CanvasNode = {
    id: promptId,
    type: 'prompt',
    title: 'Text Prompt',
    subtitle: 'Prompt kreatif Grok',
    colorTheme: 'green',
    position: { x: 120, y: 200 },
    inputs: [],
    outputs: [
      { id: 'output-text', name: 'text', type: 'text', label: 'Text' },
    ],
    data: {
      prompt: 'an epic futuristic concept supercar driving across mars with space colony domes in background, golden sunset, unreal engine 5 render, cinematic lighting',
    },
  };

  const modelNode: CanvasNode = {
    id: modelId,
    type: 'imageModel',
    title: 'Grok Imagine Image',
    subtitle: 'xAI Creative Vision',
    colorTheme: 'red',
    position: { x: 560, y: 180 },
    inputs: [
      { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
    ],
    outputs: [
      { id: 'output-result', name: 'result', type: 'image', label: 'Grok Image' },
    ],
    data: {
      modelId: 'xai/grok-imagine-image',
      modelDisplayName: 'Grok Imagine Image',
      provider: 'weavy',
      resolution: '1024 x 1024',
      aspectRatio: '1:1',
      seed: Math.floor(Math.random() * 999999),
      isRandomSeed: true,
      creditsCost: 4,
    },
  };

  const viewerNode: CanvasNode = {
    id: viewerId,
    type: 'imageViewer',
    title: 'Grok Imagine Image',
    subtitle: 'Hasil kreasi Grok',
    colorTheme: 'purple',
    position: { x: 1000, y: 180 },
    inputs: [
      { id: 'input-image', name: 'image', type: 'image', label: 'Image', required: true },
    ],
    outputs: [],
    data: {
      status: 'idle',
      progress: 0,
    },
  };

  return {
    id: `recipe_${Date.now()}`,
    name: 'Grok Imagine (xAI Quick Image)',
    description: 'Generasi gambar cepat 4 kredit dengan gaya sinematik khas xAI Grok Imagine',
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

// Preset 4: GPT Image 2.5 (Weavy Flare)
export function createGptImage25Preset(): CanvasRecipe {
  const promptId = `node_prompt_${Date.now()}`;
  const modelId = `node_model_${Date.now() + 1}`;
  const viewerId = `node_viewer_${Date.now() + 2}`;

  const promptNode: CanvasNode = {
    id: promptId,
    type: 'prompt',
    title: 'Text Prompt',
    subtitle: 'Prompt kreatif GPT Image 2.5',
    colorTheme: 'green',
    position: { x: 120, y: 180 },
    inputs: [],
    outputs: [
      { id: 'output-text', name: 'text', type: 'text', label: 'Text' },
    ],
    data: {
      prompt: 'A cinematic high-fashion portrait of an elegant character in a neon-lit cyberpunk city, ultra sharp details, photorealistic lighting, 8k resolution',
    },
  };

  const modelNode: CanvasNode = {
    id: modelId,
    type: 'imageModel',
    title: 'GPT Image 2.5',
    subtitle: 'Weavy Flare 2.5',
    colorTheme: 'red',
    position: { x: 560, y: 160 },
    inputs: [
      { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
      { id: 'input-image', name: 'image_1', type: 'image', label: 'Image 1', required: false },
    ],
    outputs: [
      { id: 'output-result', name: 'result', type: 'image', label: 'Generated Image' },
    ],
    data: {
      modelId: 'flare-ai/flare-2.5',
      modelDisplayName: 'GPT Image 2.5',
      provider: 'weavy',
      resolution: '1080p',
      aspectRatio: '9:16',
      seed: Math.floor(Math.random() * 999999),
      isRandomSeed: true,
      creditsCost: 4,
    },
  };

  const viewerNode: CanvasNode = {
    id: viewerId,
    type: 'imageViewer',
    title: 'GPT Image 2.5',
    subtitle: 'Viewer & Download',
    colorTheme: 'purple',
    position: { x: 1000, y: 180 },
    inputs: [
      { id: 'input-image', name: 'image', type: 'image', label: 'Image', required: true },
    ],
    outputs: [],
    data: {
      status: 'idle',
      progress: 0,
    },
  };

  return {
    id: `recipe_${Date.now()}`,
    name: 'GPT Image 2.5 (Weavy Flare)',
    description: 'Generasi gambar sinematik hemat 4 kredit dengan Weavy Flare 2.5',
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

// Convert Weavy Raw Recipe JSON to our Canvas format
export function parseWeavyRecipeToCanvas(rawRecipe: any): CanvasRecipe {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];

  const rawNodes = Array.isArray(rawRecipe?.nodes) ? rawRecipe.nodes : [];
  const rawEdges = Array.isArray(rawRecipe?.edges) ? rawRecipe.edges : [];

  for (const rn of rawNodes) {
    const id = String(rn.id);
    const typeStr = (rn.type || '').toLowerCase();
    const data = rn.data || {};
    const pos = rn.position || { x: 100, y: 100 };

    if (typeStr === 'string' || typeStr === 'text' || (!rn.isModel && data.name === 'Text')) {
      // Prompt / String node
      nodes.push({
        id,
        type: 'prompt',
        title: data.name || 'Text Prompt',
        subtitle: 'Input prompt teks',
        colorTheme: 'green',
        position: { x: pos.x, y: pos.y },
        inputs: [],
        outputs: [
          { id: 'output-text', name: 'text', type: 'text', label: 'Text' },
        ],
        data: {
          prompt: data.value || data.output?.text || data.output?.string || '',
        },
      });
    } else if (typeStr === 'file' || (!rn.isModel && (data.files || data.file))) {
      // File / Image input node
      const firstFile = Array.isArray(data.files) && data.files[0] ? data.files[0] : (data.file || {});
      nodes.push({
        id,
        type: 'imageInput',
        title: data.name || 'Image / File Input',
        subtitle: firstFile.name || 'Media referensi',
        colorTheme: 'blue',
        position: { x: pos.x, y: pos.y },
        inputs: [],
        outputs: [
          { id: 'output-image', name: 'image', type: 'image', label: 'Image Output' },
        ],
        data: {
          imageUrl: firstFile.url || firstFile.fileUrl || '',
          fileName: firstFile.name || 'asset',
        },
      });
    } else if (
      data.kind?.type === 'prompt_enhancer' ||
      rn.originalName === 'Prompt Enhancer' ||
      data.name === 'Prompt Enhancer' ||
      typeStr === 'promptenhancer' ||
      typeStr === 'prompt_enhancer' ||
      data.name === 'Any LLM' ||
      data.menu?.displayName === 'Any LLM' ||
      rn.originalName === 'Any LLM' ||
      typeStr === 'anyllm' ||
      (typeStr === 'custommodelv2' && (
        data.params?.model?.startsWith('google/gemini') ||
        data.params?.model?.startsWith('anthropic/') ||
        data.params?.model?.startsWith('openai/gpt') ||
        data.params?.model?.startsWith('meta-llama/') ||
        data.name?.toLowerCase().includes('llm')
      ))
    ) {
      // LLM Node: Any LLM or Prompt Enhancer
      const isAnyLLM =
        data.name === 'Any LLM' ||
        data.menu?.displayName === 'Any LLM' ||
        typeStr === 'anyllm' ||
        data.name?.toLowerCase().includes('llm') ||
        rn.originalName === 'Any LLM';

      const modelVal = data.params?.model || data.kind?.model?.data?.value || (isAnyLLM ? 'google/gemini-3-pro' : 'openai/gpt-5.6-sol');
      const systemPromptVal =
        data.params?.system_prompt ||
        data.kind?.systemPrompt?.data?.value ||
        (isAnyLLM
          ? 'You are an advanced AI assistant. Analyze the inputs and provide high quality, comprehensive responses.'
          : 'Your job is to write prompts for text-to-image models. Your input will be a general description for the scene, You should write a detailed prompt without any additions, not longer than 3 sentences.');
      
      const enhancedVal =
        data.output?.text?.value ||
        data.output?.enhanced_prompt?.value ||
        (Array.isArray(data.result) && data.result[0]?.value) ||
        data.result?.value ||
        (typeof data.result === 'string' ? data.result : '') ||
        '';

      const matchedLLM = WEAVY_PROMPT_ENHANCER_MODELS.find((m) => m.id === modelVal);
      const displayName = matchedLLM?.name || modelVal.split('/').pop() || (isAnyLLM ? 'Gemini 3 Pro' : 'GPT-5.6 Sol');

      nodes.push({
        id,
        type: isAnyLLM ? 'anyLLM' : 'promptEnhancer',
        title: data.name || (isAnyLLM ? 'Any LLM' : 'Prompt Enhancer'),
        subtitle: displayName,
        colorTheme: 'purple',
        position: { x: pos.x, y: pos.y },
        inputs: [
          { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
          { id: 'input-image', name: 'image', type: 'image', label: 'Image 1', required: false },
        ],
        outputs: [
          { id: 'output-text', name: 'text', type: 'text', label: isAnyLLM ? 'Text' : 'Enhanced Prompt' },
        ],
        data: {
          model: modelVal,
          modelDisplayName: displayName,
          systemPrompt: systemPromptVal,
          temperature: typeof data.params?.temperature === 'number' ? data.params.temperature : 0,
          thinking: Boolean(data.params?.thinking),
          inputPrompt: data.kind?.prompt?.string || '',
          generatedText: enhancedVal,
          enhancedPrompt: enhancedVal,
          status: enhancedVal ? 'completed' : 'idle',
          creditsCost: 1,
        },
      });
    } else if (rn.isModel || typeStr === 'custommodelv2' || typeStr === 'model') {
      // Model node (Image model)
      const modelName = data.model?.name || data.name || 'fal-ai/nano-banana-pro/edit';
      const matchedModel =
        WEAVY_IMAGE_MODELS.find(
          (m) =>
            m.id === modelName ||
            m.name === modelName ||
            (modelName.toLowerCase().includes('flare') && m.id.includes('flare')) ||
            (modelName.toLowerCase().includes('2.5') && m.name.includes('2.5'))
        ) || WEAVY_IMAGE_MODELS[0];

      const params = data.params || {};

      nodes.push({
        id,
        type: 'imageModel',
        title: data.name || matchedModel.name,
        subtitle: data.menu?.displayName || matchedModel.badge,
        colorTheme: 'red',
        position: { x: pos.x, y: pos.y },
        inputs: [
          { id: 'input-prompt', name: 'prompt', type: 'text', label: 'Prompt', required: true },
          { id: 'input-image', name: 'image_1', type: 'image', label: 'Image 1', required: false },
        ],
        outputs: [
          { id: 'output-result', name: 'result', type: 'image', label: 'Generated Image' },
        ],
        data: {
          modelId: modelName,
          modelDisplayName: matchedModel.name,
          provider: 'weavy',
          resolution: params.resolution || matchedModel.defaultResolution,
          aspectRatio: params.aspect_ratio || matchedModel.defaultAspectRatio,
          seed: params.seed?.seed || 123456,
          isRandomSeed: params.seed?.isRandom !== false,
          creditsCost: matchedModel.credits,
          promptOverride: params.prompt || '',
        },
      });
    } else {
      // Generic / Note / Output
      nodes.push({
        id,
        type: 'imageViewer',
        title: data.name || 'Viewer Node',
        subtitle: 'Media Output',
        colorTheme: 'purple',
        position: { x: pos.x, y: pos.y },
        inputs: [
          { id: 'input-image', name: 'image', type: 'image', label: 'Image' },
        ],
        outputs: [
          { id: 'output-image', name: 'image', type: 'image', label: 'Jadikan Gambar Referensi' },
        ],
        data: {
          status: 'idle',
          resultUrl: data.result?.url || data.output?.url || '',
        },
      });
    }
  }

  // Parse Edges
  for (const re of rawEdges) {
    const isTextHandle = re.sourceHandle?.includes('text') || re.targetHandle?.includes('prompt');
    const isImageHandle = re.sourceHandle?.includes('image') || re.targetHandle?.includes('image');
    const edgeCol = isTextHandle ? '#10b981' : isImageHandle ? '#14b8a6' : '#a855f7';

    edges.push({
      id: re.id || `edge_${re.source}_${re.target}`,
      sourceNodeId: String(re.source),
      sourceOutputId: re.sourceHandle ? 'output-' + (re.sourceHandle.split('-').pop() || 'result') : 'output-result',
      targetNodeId: String(re.target),
      targetInputId: re.targetHandle ? 'input-' + (re.targetHandle.split('-').pop() || 'prompt') : 'input-prompt',
      color: edgeCol,
    });
  }

  // If there is no viewer node, add one connected to the model output
  const hasViewer = nodes.some((n) => n.type === 'imageViewer');
  const modelNode = nodes.find((n) => n.type === 'imageModel');
  if (!hasViewer && modelNode) {
    const viewerId = `node_viewer_${Date.now()}`;
    nodes.push({
      id: viewerId,
      type: 'imageViewer',
      title: 'Image Output',
      subtitle: 'Preview & Download',
      colorTheme: 'purple',
      position: { x: modelNode.position.x + 420, y: modelNode.position.y },
      inputs: [
        { id: 'input-image', name: 'image', type: 'image', label: 'Result Image' },
      ],
      outputs: [
        { id: 'output-image', name: 'image', type: 'image', label: 'Jadikan Gambar Referensi' },
      ],
      data: { status: 'idle', progress: 0 },
    });
    edges.push({
      id: `edge_${modelNode.id}_${viewerId}`,
      sourceNodeId: modelNode.id,
      sourceOutputId: 'output-result',
      targetNodeId: viewerId,
      targetInputId: 'input-image',
      color: '#a855f7',
    });
  }

  return {
    id: rawRecipe.id || `recipe_${Date.now()}`,
    name: rawRecipe.name && rawRecipe.name !== 'untitled' ? rawRecipe.name : 'Weavy Imported Recipe',
    description: rawRecipe.description || 'Imported flow from Weavy AI Studio',
    weavyRecipeId: rawRecipe.id,
    nodes,
    edges,
    createdAt: rawRecipe.createdAt || new Date().toISOString(),
    updatedAt: rawRecipe.updatedAt || new Date().toISOString(),
  };
}

// Helper to extract clean prompt text from raw or JSON response
export function extractCleanPromptText(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  let jsonStr = trimmed;
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  if (jsonStr.startsWith('{') && jsonStr.endsWith('}')) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed.prompt === 'string') return parsed.prompt.trim();
      if (typeof parsed.detailed_prompt === 'string') return parsed.detailed_prompt.trim();
      if (typeof parsed.image_prompt === 'string') return parsed.image_prompt.trim();
      if (typeof parsed.description === 'string') return parsed.description.trim();
    } catch {
      // not valid JSON, use string
    }
  }
  return trimmed;
}

// Helper to determine if a media URL represents a video
function isMediaVideoUrl(url: string, nodeType?: string): boolean {
  if (!url) return false;
  if (nodeType === 'geminiVideo') return true;
  return /\.(mp4|mov|webm|avi|m4v)(\?.*)?$/i.test(url);
}

// Helper to build a comprehensive, production-ready video direction prompt for video nodes
export function formatSceneVideoPrompt(scene: any): string {
  if (!scene) return '';

  const sections: string[] = [];

  // 1. Primary Scene Video Prompt / Motion Direction
  const primaryPrompt = (scene.videoPrompt || scene.visualDescription || '').trim();
  if (primaryPrompt) {
    sections.push(primaryPrompt);
  }

  // 2. Camera Direction if not already in primaryPrompt
  if (scene.cameraAngle && !primaryPrompt.toLowerCase().includes(scene.cameraAngle.toLowerCase())) {
    sections.push(`[CAMERA DIRECTION]: ${scene.cameraAngle}`);
  }

  // 3. Sub-Shots Breakdown (Action, Timing & Camera per sub-shot)
  if (Array.isArray(scene.shoots) && scene.shoots.length > 0) {
    const shootLines = scene.shoots.map((shoot: any, idx: number) => {
      const shootNum = idx + 1;
      const timeTag = (shoot.start !== undefined && shoot.end !== undefined)
        ? `(${shoot.start}-${shoot.end}s)`
        : '';
      const items: string[] = [];
      if (shoot.action) items.push(`Action: ${shoot.action}`);
      if (shoot.visualDescription && shoot.visualDescription !== shoot.action) {
        items.push(`Visual: ${shoot.visualDescription}`);
      }
      if (shoot.cameraAngle && shoot.cameraAngle !== scene.cameraAngle) {
        items.push(`Camera: ${shoot.cameraAngle}`);
      }
      if (shoot.continuity) items.push(`Continuity: ${shoot.continuity}`);
      if (shoot.voiceover) items.push(`VO: "${shoot.voiceover.trim()}"`);

      return `• Shoot ${shootNum} ${timeTag}: ${items.join(' | ')}`;
    });

    sections.push(`[SUB-SHOTS BREAKDOWN & CONTINUITY]:\n${shootLines.join('\n')}`);
  }

  // 4. Complete Voiceover Narration Track
  const vo = (scene.voiceover || '').trim();
  if (vo) {
    sections.push(`[VOICEOVER / SPOKEN NARRATION]:\n"${vo}"`);
  }

  return sections.join('\n\n').trim();
}

// Helper to extract specific scene prompt or script from a Storyboard node based on port ID
export function extractStoryboardPortText(sourceNode: CanvasNode, portId?: string): string {
  if (sourceNode.type !== 'storyboard') return '';
  const scenes = dedupeStoryboardScenes(sourceNode.data?.scenes);
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return sourceNode.data?.brief || '';
  }

  const p = (portId || '').toLowerCase();

  // Dynamic regex match for any scene index: scene1, scene-1, scene_1, scene 1, etc.
  const match = p.match(/scene[_\-\s]?(\d+)/i);
  if (match) {
    const sceneIndex = parseInt(match[1], 10) - 1;
    const scene = scenes[sceneIndex];
    if (scene) {
      if (p.includes('video')) return formatSceneVideoPrompt(scene);
      if (p.includes('image')) return scene.imagePrompt || scene.visualDescription || '';
      if (p.includes('voiceover') || p.includes('vo')) return scene.voiceover || '';
      if (p.includes('shoots') || p.includes('shot')) {
        return Array.isArray(scene.shoots)
          ? scene.shoots.map((s: any, idx: number) => `Shoot ${idx + 1}: ${s.visualDescription || s.action || ''}`).join('\n')
          : '';
      }
      return formatSceneVideoPrompt(scene);
    }
  }

  if (p.includes('script') || p.includes('voiceover') || p.includes('vo')) {
    return scenes.map((s: any, idx: number) => `[Scene ${s.sceneNumber || idx + 1}] ${s.voiceover || ''}`).filter(Boolean).join('\n\n');
  }

  // Fallback: Scene 1 prompt (full video prompt)
  return formatSceneVideoPrompt(scenes[0]) || scenes[0]?.imagePrompt || scenes[0]?.visualDescription || '';
}

// Helper to resolve inputs for a specific model or video node based on connected edges
export function resolveModelInputs(
  modelNodeId: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[]
): {
  prompt: string;
  imageUrl?: string;
  imageUrls: string[];
  videoUrl?: string;
  videoUrls: string[];
  voiceover?: string;
  shoots?: any[];
  sceneNumber?: number;
  sceneTitle?: string;
  visualDescription?: string;
  videoPrompt?: string;
} {
  let prompt = '';
  const imageUrls: string[] = [];
  const videoUrls: string[] = [];
  let voiceover: string | undefined = undefined;
  let shoots: any[] | undefined = undefined;
  let sceneNumber: number | undefined = undefined;
  let sceneTitle: string | undefined = undefined;
  let visualDescription: string | undefined = undefined;
  let videoPrompt: string | undefined = undefined;

  const addMediaUrl = (url?: string, nodeType?: string) => {
    if (!url) return;
    const clean = url.trim();
    if (!clean) return;
    if (isMediaVideoUrl(clean, nodeType)) {
      if (!videoUrls.includes(clean)) videoUrls.push(clean);
    } else {
      if (!imageUrls.includes(clean)) imageUrls.push(clean);
    }
  };

  const modelNode = nodes.find((n) => n.id === modelNodeId);
  if (!modelNode) return { prompt: '', imageUrls: [], videoUrls: [] };

  const extractSceneMeta = (sourceNode: CanvasNode, outputPortId?: string) => {
    if (sourceNode.type !== 'storyboard') return;
    const scenes = dedupeStoryboardScenes(sourceNode.data?.scenes);
    if (!Array.isArray(scenes) || scenes.length === 0) return;
    const match = (outputPortId || '').match(/scene[_\-\s]?(\d+)/i);
    const sceneIndex = match ? parseInt(match[1], 10) - 1 : 0;
    const sc = scenes[sceneIndex] || scenes[0];
    if (sc) {
      if (!voiceover && sc.voiceover) voiceover = sc.voiceover;
      if (!shoots && sc.shoots) shoots = sc.shoots;
      if (sceneNumber === undefined && (sc.sceneNumber || sceneIndex + 1)) sceneNumber = sc.sceneNumber || sceneIndex + 1;
      if (!sceneTitle && sc.title) sceneTitle = sc.title;
      if (!visualDescription && sc.visualDescription) visualDescription = sc.visualDescription;
      if (!videoPrompt && sc.videoPrompt) videoPrompt = sc.videoPrompt;
    }
  };

  // 1. Order-aware resolution: iterate through model node's image/media input ports in order
  const imagePorts = modelNode.inputs.filter((p) => p.type === 'image');
  for (const port of imagePorts) {
    const edge = edges.find((e) => e.targetNodeId === modelNodeId && e.targetInputId === port.id);
    if (edge) {
      const sourceNode = nodes.find((n) => n.id === edge.sourceNodeId);
      if (sourceNode) {
        if (sourceNode.type === 'imageInput' && sourceNode.data?.imageUrl) {
          addMediaUrl(sourceNode.data.imageUrl, sourceNode.type);
        } else if (sourceNode.type === 'imageViewer' && sourceNode.data?.resultUrl) {
          addMediaUrl(sourceNode.data.resultUrl, sourceNode.type);
        } else if (sourceNode.type === 'imageModel' && (sourceNode.data?.outputImage || sourceNode.data?.resultUrl)) {
          addMediaUrl(sourceNode.data?.outputImage || sourceNode.data?.resultUrl, sourceNode.type);
        } else if ((sourceNode.type === 'geminiVideo' || sourceNode.type === 'videoStitcher') && (sourceNode.data?.videoUrl || sourceNode.data?.outputVideo || sourceNode.data?.resultUrl)) {
          addMediaUrl(sourceNode.data?.videoUrl || sourceNode.data?.outputVideo || sourceNode.data?.resultUrl, sourceNode.type);
        } else if (sourceNode.type === 'aiWorker') {
          addMediaUrl(getAiWorkerPortValue(sourceNode, edge.sourceOutputId).imageUrl, sourceNode.type);
        }
      }
    }
  }

  // 2. Resolve text/prompt port
  const promptPort = modelNode.inputs.find((p) => p.type === 'text');
  const promptEdge = edges.find(
    (e) => e.targetNodeId === modelNodeId && (!promptPort || e.targetInputId === promptPort.id)
  );
  if (promptEdge) {
    const sourceNode = nodes.find((n) => n.id === promptEdge.sourceNodeId);
    if (sourceNode?.type === 'prompt' && sourceNode.data?.prompt) {
      prompt = sourceNode.data.prompt.trim();
    } else if (sourceNode?.type === 'storyboard') {
      prompt = extractStoryboardPortText(sourceNode, promptEdge.sourceOutputId);
      extractSceneMeta(sourceNode, promptEdge.sourceOutputId);
    } else if (sourceNode?.type === 'promptEnhancer' || sourceNode?.type === 'anyLLM') {
      const raw = sourceNode.data?.generatedText || sourceNode.data?.enhancedPrompt || sourceNode.data?.inputPrompt || '';
      prompt = extractCleanPromptText(raw);
    } else if (sourceNode?.type === 'aiWorker') {
      prompt = getAiWorkerPortValue(sourceNode, promptEdge.sourceOutputId).text || '';
    }
  }

  // 3. Fallback: Check any incoming edges to this model node if ports weren't matched strictly
  const incomingEdges = edges.filter((e) => e.targetNodeId === modelNodeId);
  for (const edge of incomingEdges) {
    const sourceNode = nodes.find((n) => n.id === edge.sourceNodeId);
    if (!sourceNode) continue;

    if (sourceNode.type === 'prompt' && sourceNode.data?.prompt && !prompt) {
      prompt = sourceNode.data.prompt.trim();
    } else if (sourceNode.type === 'storyboard') {
      if (!prompt) {
        prompt = extractStoryboardPortText(sourceNode, edge.sourceOutputId);
      }
      extractSceneMeta(sourceNode, edge.sourceOutputId);
    } else if ((sourceNode.type === 'promptEnhancer' || sourceNode.type === 'anyLLM') && !prompt) {
      const raw = sourceNode.data?.generatedText || sourceNode.data?.enhancedPrompt || sourceNode.data?.inputPrompt || '';
      prompt = extractCleanPromptText(raw);
    } else if (sourceNode.type === 'imageInput' && sourceNode.data?.imageUrl) {
      addMediaUrl(sourceNode.data.imageUrl, sourceNode.type);
    } else if (sourceNode.type === 'imageViewer' && sourceNode.data?.resultUrl) {
      addMediaUrl(sourceNode.data.resultUrl, sourceNode.type);
    } else if (sourceNode.type === 'imageModel' && (sourceNode.data?.outputImage || sourceNode.data?.resultUrl)) {
      addMediaUrl(sourceNode.data?.outputImage || sourceNode.data?.resultUrl, sourceNode.type);
    } else if (sourceNode.type === 'geminiVideo' && (sourceNode.data?.videoUrl || sourceNode.data?.outputVideo || sourceNode.data?.resultUrl)) {
      addMediaUrl(sourceNode.data?.videoUrl || sourceNode.data?.outputVideo || sourceNode.data?.resultUrl, sourceNode.type);
    } else if (sourceNode.type === 'aiWorker') {
      const v = getAiWorkerPortValue(sourceNode, edge.sourceOutputId);
      if (v.text && !prompt) prompt = v.text;
      if (v.imageUrl) addMediaUrl(v.imageUrl, sourceNode.type);
    }
  }

  // 4. Fallback to model node's own manual overrides if not wired
  if (modelNode?.data?.promptOverride && !prompt) {
    prompt = modelNode.data.promptOverride.trim();
  }
  if (modelNode?.data?.inputImageUrl && imageUrls.length === 0) {
    addMediaUrl(modelNode.data.inputImageUrl);
  }

  // 5. Fallback scene metadata from node.data
  if (!voiceover && modelNode?.data?.voiceover) voiceover = modelNode.data.voiceover;
  if (!shoots && modelNode?.data?.shoots) shoots = modelNode.data.shoots;
  if (sceneNumber === undefined && modelNode?.data?.sceneNumber) sceneNumber = modelNode.data.sceneNumber;
  if (!sceneTitle && modelNode?.data?.sceneTitle) sceneTitle = modelNode.data.sceneTitle;
  if (!visualDescription && modelNode?.data?.visualDescription) visualDescription = modelNode.data.visualDescription;
  if (!videoPrompt && modelNode?.data?.videoPrompt) videoPrompt = modelNode.data.videoPrompt;

  return {
    prompt,
    imageUrl: imageUrls[0] || undefined,
    imageUrls,
    videoUrl: videoUrls[0] || undefined,
    videoUrls,
    voiceover,
    shoots,
    sceneNumber,
    sceneTitle,
    visualDescription,
    videoPrompt,
  };
}

/**
 * Helper to resolve connected video URLs for a Video Stitcher node,
 * maintaining the exact order of the input ports (Video 1, Video 2, Video 3, etc.)
 */
export function resolveStitcherInputs(
  stitcherNodeId: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[]
): string[] {
  const stitcherNode = nodes.find((n) => n.id === stitcherNodeId);
  if (!stitcherNode || !Array.isArray(stitcherNode.inputs)) return [];

  const videoUrls: string[] = [];

  // Iterate in exact order of input ports: Video 1, Video 2, Video 3, etc.
  for (const port of stitcherNode.inputs) {
    const edge = edges.find((e) => e.targetNodeId === stitcherNodeId && e.targetInputId === port.id);
    if (!edge) continue;

    const sourceNode = nodes.find((n) => n.id === edge.sourceNodeId);
    if (!sourceNode) continue;

    let url: string | undefined = undefined;
    if (sourceNode.type === 'geminiVideo' || sourceNode.type === 'vidsVideo' || sourceNode.type === 'videoStitcher') {
      url = sourceNode.data?.outputVideo || sourceNode.data?.videoUrl || sourceNode.data?.resultUrl;
    } else if (sourceNode.type === 'imageViewer') {
      url = sourceNode.data?.resultUrl || sourceNode.data?.outputVideo;
    } else if (sourceNode.type === 'imageInput') {
      url = sourceNode.data?.imageUrl;
    }

    if (url && typeof url === 'string' && url.trim().length > 0) {
      videoUrls.push(url.trim());
    }
  }

  return videoUrls;
}

// Helper to resolve inputs for a Prompt Enhancer or Any LLM node
export function resolveEnhancerInputs(
  enhancerNodeId: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[]
): { prompt: string; mainPrompt: string; aiWorkerContext: string; imageUrl?: string; imageUrls: string[] } {
  let prompt = '';
  let mainPrompt = '';
  let aiWorkerContext = '';
  let imageUrl: string | undefined = undefined;
  const imageUrls: string[] = []

  const enhancerNode = nodes.find((n) => n.id === enhancerNodeId);
  if (!enhancerNode) return { prompt: '', mainPrompt: '', aiWorkerContext: '', imageUrls: [] };

  const incomingEdges = edges.filter((e) => e.targetNodeId === enhancerNodeId);
  for (const edge of incomingEdges) {
    const sourceNode = nodes.find((n) => n.id === edge.sourceNodeId);
    if (!sourceNode) continue;

    if (sourceNode.type === 'prompt') {
      const p = (
        sourceNode.data?.prompt ||
        sourceNode.data?.output?.prompt ||
        sourceNode.data?.text ||
        sourceNode.data?.inputPrompt ||
        ''
      ).trim();
      if (p) {
        prompt = p;
        mainPrompt = p;
      }
    } else if (sourceNode.type === 'storyboard') {
      const txt = extractStoryboardPortText(sourceNode, edge.sourceOutputId);
      if (txt) {
        prompt = txt;
        mainPrompt = txt;
      }
    } else if (sourceNode.type === 'anyLLM' || sourceNode.type === 'promptEnhancer') {
      const txt = (
        sourceNode.data?.generatedText ||
        sourceNode.data?.enhancedPrompt ||
        sourceNode.data?.inputPrompt ||
        ''
      ).trim();
      if (txt) {
        prompt = txt;
        mainPrompt = txt;
      }
    } else if (sourceNode.type === 'imageInput') {
      const u = (
        sourceNode.data?.imageUrl ||
        sourceNode.data?.fileUrl ||
        sourceNode.data?.url ||
        sourceNode.data?.output?.file?.url ||
        sourceNode.data?.files?.[0]?.url ||
        sourceNode.data?.result?.url ||
        ''
      ).trim();
      if (u) {
        if (!imageUrl) imageUrl = u;
        if (!imageUrls.includes(u)) imageUrls.push(u);
      }
    } else if (sourceNode.type === 'imageViewer') {
      const u = (sourceNode.data?.resultUrl || sourceNode.data?.imageUrl || '').trim();
      if (u) {
        if (!imageUrl) imageUrl = u;
        if (!imageUrls.includes(u)) imageUrls.push(u);
      }
    } else if (sourceNode.type === 'imageModel') {
      const u = (sourceNode.data?.outputImage || sourceNode.data?.resultUrl || sourceNode.data?.imageUrl || '').trim();
      if (u) {
        if (!imageUrl) imageUrl = u;
        if (!imageUrls.includes(u)) imageUrls.push(u);
      }
    } else if (sourceNode.type === 'aiWorker') {
      const v = getAiWorkerPortValue(sourceNode, edge.sourceOutputId);
      if (v.text) aiWorkerContext = v.text;
      if (v.imageUrl) {
        if (!imageUrl) imageUrl = v.imageUrl;
        if (!imageUrls.includes(v.imageUrl)) imageUrls.push(v.imageUrl);
      }
    }
  }

  // AI Worker Context enriches the primary brief instead of replacing it.
  if (aiWorkerContext) {
    prompt = [mainPrompt.trim(), '[KONTEKS DARI AI WORKER — gunakan sebagai fakta/acuan, jangan mengarang detail yang tidak tersedia]', aiWorkerContext.trim(), '[INSTRUKSI EKSEKUSI] Gabungkan konteks ini dengan Main Brief. Pertahankan tujuan, target audiens, gaya, dan batasan brief; jika ada konflik, prioritaskan instruksi eksplisit pengguna. Buat output spesifik, konsisten, siap produksi, dan hindari klaim produk yang tidak didukung konteks.'].filter(Boolean).join('\n\n');
  }

  if (!prompt && enhancerNode.data?.inputPrompt) {
    prompt = enhancerNode.data.inputPrompt.trim();
    mainPrompt = prompt;
  }
  if (!prompt && enhancerNode.data?.prompt) {
    prompt = enhancerNode.data.prompt.trim();
    mainPrompt = prompt;
  }
  if (!prompt && enhancerNode.data?.generatedText) {
    prompt = enhancerNode.data.generatedText.trim();
    mainPrompt = prompt;
  }
  if (!imageUrl && enhancerNode.data?.inputImageUrl) {
    imageUrl = enhancerNode.data.inputImageUrl.trim();
    if (!imageUrls.includes(imageUrl)) imageUrls.push(imageUrl);
  }
  if (Array.isArray(enhancerNode.data?.inputImageUrls)) {
    for (const u of enhancerNode.data.inputImageUrls) {
      if (typeof u === 'string' && u.trim() && !imageUrls.includes(u.trim())) {
        imageUrls.push(u.trim());
      }
    }
  }

  return { prompt, mainPrompt, aiWorkerContext, imageUrl: imageUrl || imageUrls[0], imageUrls };
}

// Preset 5: Any LLM Multimodal Flow (Import File + Prompt -> Any LLM)
export function createAnyLLMPreset(): CanvasRecipe {
  const fileId = `node_file_${Date.now()}`;
  const promptId = `node_prompt_${Date.now() + 1}`;
  const llmId = `node_llm_${Date.now() + 2}`;

  const fileNode: CanvasNode = {
    id: fileId,
    type: 'imageInput',
    title: 'File',
    subtitle: 'File Input',
    colorTheme: 'blue',
    position: { x: 80, y: 120 },
    inputs: [],
    outputs: [
      { id: 'output-image', name: 'image', type: 'image', label: 'File' },
      { id: 'output-file', name: 'file', type: 'image', label: 'File' },
    ],
    data: {
      imageUrl: 'https://media.weavy.ai/image/upload/v1789176124/uploads/07hrv9DxLvPbL0MrWfNrk73uwsE2/thxxlfkz1mcrb9fycpkn.png',
      fileName: 'canvas_Nano_Banana_Pro_964665.png',
    },
  };

  const promptNode: CanvasNode = {
    id: promptId,
    type: 'prompt',
    title: 'Prompt',
    subtitle: 'Deskripsi / Permintaan',
    colorTheme: 'green',
    position: { x: 80, y: 480 },
    inputs: [],
    outputs: [
      { id: 'output-text', name: 'text', type: 'text', label: 'Prompt' },
    ],
    data: {
      prompt: 'tolong jelaskan dengan dtail gambar inih',
    },
  };

  const llmNode: CanvasNode = {
    id: llmId,
    type: 'anyLLM',
    title: 'Any LLM',
    subtitle: 'Gemini 3 Pro',
    colorTheme: 'purple',
    position: { x: 500, y: 120 },
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
      inputPrompt: 'tolong jelaskan dengan dtail gambar inih',
      generatedText: '',
      enhancedPrompt: '',
      status: 'idle',
      creditsCost: 1,
    },
  };

  const edges: CanvasEdge[] = [
    {
      id: `edge_${fileId}_${llmId}`,
      sourceNodeId: fileId,
      sourceOutputId: 'output-image',
      targetNodeId: llmId,
      targetInputId: 'input-image',
      color: '#14b8a6',
    },
    {
      id: `edge_${promptId}_${llmId}`,
      sourceNodeId: promptId,
      sourceOutputId: 'output-text',
      targetNodeId: llmId,
      targetInputId: 'input-prompt',
      color: '#10b981',
    },
  ];

  return {
    id: `recipe_anyllm_${Date.now()}`,
    name: 'Any LLM Flow',
    description: 'Import File + Prompt -> Any LLM (Gemini 3 Pro)',
    nodes: [fileNode, promptNode, llmNode],
    edges,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Preset 4: Prompt Enhancer + Nano Banana Pro Flow
export function createPromptEnhancerPreset(): CanvasRecipe {
  const promptId = `node_prompt_${Date.now()}`;
  const enhancerId = `node_enhancer_${Date.now() + 1}`;
  const modelId = `node_model_${Date.now() + 2}`;
  const viewerId = `node_viewer_${Date.now() + 3}`;

  const promptNode: CanvasNode = {
    id: promptId,
    type: 'prompt',
    title: 'Text Prompt',
    subtitle: 'Deskripsi ide dasar',
    colorTheme: 'green',
    position: { x: 80, y: 180 },
    inputs: [],
    outputs: [
      { id: 'output-text', name: 'text', type: 'text', label: 'Text Prompt' },
    ],
    data: {
      prompt: 'a futuristic cyberpunk sports car in rainy tokyo',
    },
  };

  const enhancerNode: CanvasNode = {
    id: enhancerId,
    type: 'promptEnhancer',
    title: 'Prompt Enhancer',
    subtitle: 'GPT-5.6 Sol / Gemini 3',
    colorTheme: 'purple',
    position: { x: 440, y: 160 },
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
      inputPrompt: 'a futuristic cyberpunk sports car in rainy tokyo',
      enhancedPrompt: '',
      status: 'idle',
    },
  };

  const modelNode: CanvasNode = {
    id: modelId,
    type: 'imageModel',
    title: 'Weavy',
    subtitle: 'Weavy AI Model',
    colorTheme: 'red',
    position: { x: 860, y: 160 },
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
      aspectRatio: '16:9',
      seed: Math.floor(Math.random() * 999999),
      isRandomSeed: true,
      creditsCost: 11,
    },
  };

  const viewerNode: CanvasNode = {
    id: viewerId,
    type: 'imageViewer',
    title: 'Nano Banana Pro',
    subtitle: 'Viewer & Download',
    colorTheme: 'purple',
    position: { x: 1260, y: 180 },
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

  const edges: CanvasEdge[] = [
    {
      id: `edge_${promptId}_${enhancerId}`,
      sourceNodeId: promptId,
      sourceOutputId: 'output-text',
      targetNodeId: enhancerId,
      targetInputId: 'input-prompt',
      color: '#10b981',
    },
    {
      id: `edge_${enhancerId}_${modelId}`,
      sourceNodeId: enhancerId,
      sourceOutputId: 'output-enhanced_prompt',
      targetNodeId: modelId,
      targetInputId: 'input-prompt',
      color: '#a855f7',
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
    id: `recipe_enhancer_${Date.now()}`,
    name: 'Prompt Enhancer Flow',
    description: 'Prompt -> AI Prompt Enhancer -> Nano Banana Pro -> Media Viewer',
    nodes: [promptNode, enhancerNode, modelNode, viewerNode],
    edges,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Preset 6: Gemini Video Generator Flow (Prompt + Optional Reference -> Gemini Video -> Viewer Output)
export function createGeminiVideoPreset(): CanvasRecipe {
  const promptId = `node_prompt_${Date.now()}`;
  const videoNodeId = `node_geminiVideo_${Date.now() + 1}`;
  const viewerId = `node_viewer_${Date.now() + 2}`;

  const promptNode: CanvasNode = {
    id: promptId,
    type: 'prompt',
    title: 'Text Prompt',
    subtitle: 'Deskripsi Video',
    colorTheme: 'green',
    position: { x: 80, y: 160 },
    inputs: [],
    outputs: [
      { id: 'output-text', name: 'text', type: 'text', label: 'Text Prompt' },
    ],
    data: {
      prompt: 'A cinematic drone shot gliding smoothly through a vibrant futuristic neon city at night, 4k ultra realistic, cinematic lighting, shallow depth of field',
      negativePrompt: '',
    },
  };

  const videoNode: CanvasNode = {
    id: videoNodeId,
    type: 'geminiVideo',
    title: 'Gemini Omni Flash',
    subtitle: 'Gemini Omni Flash',
    colorTheme: 'purple',
    position: { x: 480, y: 140 },
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

  const viewerNode: CanvasNode = {
    id: viewerId,
    type: 'imageViewer',
    title: 'Video Output',
    subtitle: 'Viewer & Download',
    colorTheme: 'purple',
    position: { x: 920, y: 160 },
    inputs: [
      { id: 'input-image', name: 'image', type: 'image', label: 'Input Video', required: true },
    ],
    outputs: [
      { id: 'output-image', name: 'image', type: 'image', label: 'Jadikan Gambar Referensi' },
    ],
    data: {
      status: 'idle',
      progress: 0,
    },
  };

  const edges: CanvasEdge[] = [
    {
      id: `edge_${promptId}_${videoNodeId}`,
      sourceNodeId: promptId,
      sourceOutputId: 'output-text',
      targetNodeId: videoNodeId,
      targetInputId: 'input-prompt',
      color: '#10b981',
    },
    {
      id: `edge_${videoNodeId}_${viewerId}`,
      sourceNodeId: videoNodeId,
      sourceOutputId: 'output-video',
      targetNodeId: viewerId,
      targetInputId: 'input-image',
      color: '#a855f7',
    },
  ];

  return {
    id: `recipe_gemini_video_${Date.now()}`,
    name: 'Gemini Video Flow (Omni Flash)',
    description: 'Prompt -> Gemini Omni Flash Video -> Video Player',
    nodes: [promptNode, videoNode, viewerNode],
    edges,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Preset: Full TikTok Viral Storyboard Workflow (Storyboard Copilot -> Weavy Image & Gemini Video)
export function createStoryboardWorkflowRecipe(): CanvasRecipe {
  const storyboardId = `node_storyboard_${Date.now()}`;
  const imageModel1Id = `node_model_${Date.now() + 1}`;
  const viewer1Id = `node_viewer_${Date.now() + 2}`;
  const videoModel1Id = `node_video_${Date.now() + 3}`;

  const imageModel2Id = `node_model_${Date.now() + 4}`;
  const viewer2Id = `node_viewer_${Date.now() + 5}`;
  const videoModel2Id = `node_video_${Date.now() + 6}`;

  const initialScenes: any[] = [
    {
      id: 'scene-1',
      sceneNumber: 1,
      title: 'Scene 1: Pekarangan & Perawatan Benih',
      durationSec: 10,
      cameraAngle: 'POV Handheld Close-up',
      visualDescription: 'POV handheld tangan merawat bibit tanaman anggur di polybag pekarangan rumah.',
      voiceover: 'Ternyata menanam anggur di pekarangan rumah itu segampang ini lho, bibitnya cepat banget tumbuh subur dan perawatannya sangat simpel!',
      imagePrompt: 'Realistic Indonesian home garden POV handheld shot, delicate hands gently tending lush grape plant in black polybag, sunny backyard, 8k.',
      videoPrompt: 'POV handheld camera with natural micro movement, hands gently tending grape plant in polybag, 4k.',
      shoots: [
        {
          id: 'scene-1-shoot-1',
          start: 0,
          end: 3,
          visualDescription: 'POV handheld suasana kebun pekarangan rumah, tangan merawat bibit anggur di polybag.',
          action: 'Tangan menyentuh tanah polybag',
          cameraAngle: 'POV Close-up Handheld',
          voiceover: 'Ternyata menanam anggur di pekarangan rumah itu segampang ini lho,',
          continuity: 'Pekarangan rumah alami, polybag hitam',
        },
        {
          id: 'scene-1-shoot-2',
          start: 3,
          end: 6,
          visualDescription: 'Tangan memeriksa daun hijau subur dan tunas bibit anggur.',
          action: 'Tangan memeriksa tunas daun',
          cameraAngle: 'POV Handheld Tracking',
          voiceover: 'bibitnya cepat banget tumbuh subur dan perawatannya sangat simpel!',
          continuity: 'Tanaman bibit anggur konsisten',
        },
        {
          id: 'scene-1-shoot-3',
          start: 6,
          end: 10,
          visualDescription: 'Hero shot tanaman bibit anggur yang sehat dan siap tumbuh besar.',
          action: 'Tangan menunjukkan bibit',
          cameraAngle: 'POV Handheld Medium',
          voiceover: '',
          continuity: 'Pencahayaan matahari alami',
        },
      ],
    },
    {
      id: 'scene-2',
      sceneNumber: 2,
      title: 'Scene 2: Hasil Subur & Rekomendasi',
      durationSec: 10,
      cameraAngle: 'POV Handheld Medium Close-up',
      visualDescription: 'POV handheld buah anggur ranum menjuntai di pekarangan rumah.',
      voiceover: 'Hasil panennya terbukti lebat dan manis banget, nggak butuh lahan luas buat mulai berkebun sendiri di rumah sekarang juga!',
      imagePrompt: 'Realistic Indonesian home garden, beautiful fresh grape cluster hanging from vine in home garden, sunny day, 8k.',
      videoPrompt: 'POV handheld camera showing thriving grape vine with ripe fruit clusters in backyard, 4k.',
      shoots: [
        {
          id: 'scene-2-shoot-1',
          start: 10,
          end: 13,
          visualDescription: 'POV handheld buah anggur ranum menjuntai di pekarangan rumah.',
          action: 'Tangan memegang dompolan anggur',
          cameraAngle: 'POV Handheld Close-up',
          voiceover: 'Hasil panennya terbukti lebat dan manis banget,',
          continuity: 'Buah anggur segar pekarangan',
        },
        {
          id: 'scene-2-shoot-2',
          start: 13,
          end: 16,
          visualDescription: 'Pekarangan rumah hijau dengan tanaman anggur berbuah lebat.',
          action: 'Tangan merawat sulur anggur',
          cameraAngle: 'POV Handheld Tracking',
          voiceover: 'nggak butuh lahan luas buat mulai berkebun sendiri di rumah sekarang juga!',
          continuity: 'Suasana kebun konsisten',
        },
        {
          id: 'scene-2-shoot-3',
          start: 16,
          end: 20,
          visualDescription: 'Close-up hero buah anggur segar menggoda di bawah sinar matahari.',
          action: 'Tangan memperlihatkan buah',
          cameraAngle: 'POV Handheld Hero View',
          voiceover: '',
          continuity: 'Konsisten dengan Shoot 2',
        },
      ],
    },
  ];

  const storyboardNode: CanvasNode = {
    id: storyboardId,
    type: 'storyboard',
    title: 'Storyboard Copilot',
    subtitle: 'Universal Buah & Bibit Unggul (20s)',
    colorTheme: 'amber',
    position: { x: 60, y: 120 },
    inputs: [
      { id: 'input-brief', name: 'brief', type: 'text', label: 'Prompt', required: false },
      { id: 'input-ai-worker', name: 'ai_worker_context', type: 'text', label: 'AI Worker', required: false },
      { id: 'input-image', name: 'image', type: 'image', label: 'Image 1', required: false },
    ],
    outputs: getStoryboardOutputs(initialScenes),
    data: {
      presetKey: '/buahunggul',
      brief: '',
      targetDuration: 20,
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      modelDisplayName: '3.6 Flash',
      status: 'completed',
      progress: 100,
      activeTab: 0,
      creditsCost: 0,
      projectTitle: 'Garden UGC: Bibit Tanaman Anggur Import Berbuah Lebat',
      formula: 'faceless_garden_ugc',
      aspectRatio: '9:16',
      scenes: initialScenes,
    },
  };

  // Scene 1 Nodes
  const imageModelNode1: CanvasNode = {
    id: imageModel1Id,
    type: 'imageModel',
    title: 'Weavy Image Engine',
    subtitle: 'Nano Banana Pro (Scene 1 Keyframe)',
    colorTheme: 'red',
    position: { x: 520, y: 60 },
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
      aspectRatio: '9:16',
      seed: Math.floor(Math.random() * 999999),
      isRandomSeed: true,
      creditsCost: 11,
      promptOverride: initialScenes[0].imagePrompt,
    },
  };

  const viewerNode1: CanvasNode = {
    id: viewer1Id,
    type: 'imageViewer',
    title: 'Scene 1 Keyframe Result',
    subtitle: 'Viewer & Download',
    colorTheme: 'purple',
    position: { x: 890, y: 60 },
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

  const videoModelNode1: CanvasNode = {
    id: videoModel1Id,
    type: 'geminiVideo',
    title: 'Gemini Omni Flash',
    subtitle: 'Scene 1 Video Render (10s)',
    colorTheme: 'purple',
    position: { x: 1260, y: 60 },
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
      promptOverride: formatSceneVideoPrompt(initialScenes[0]),
      voiceover: initialScenes[0].voiceover,
      shoots: initialScenes[0].shoots,
      sceneNumber: 1,
      sceneTitle: initialScenes[0].title,
      visualDescription: initialScenes[0].visualDescription,
      videoPrompt: initialScenes[0].videoPrompt,
    },
  };

  // Scene 2 Nodes
  const imageModelNode2: CanvasNode = {
    id: imageModel2Id,
    type: 'imageModel',
    title: 'Weavy Image Engine',
    subtitle: 'Nano Banana Pro (Scene 2 Keyframe)',
    colorTheme: 'red',
    position: { x: 520, y: 520 },
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
      aspectRatio: '9:16',
      seed: Math.floor(Math.random() * 999999),
      isRandomSeed: true,
      creditsCost: 11,
      promptOverride: initialScenes[1].imagePrompt,
      sceneNumber: 2,
      sceneTitle: initialScenes[1].title,
      voiceover: initialScenes[1].voiceover,
      shoots: initialScenes[1].shoots,
    },
  };

  const viewerNode2: CanvasNode = {
    id: viewer2Id,
    type: 'imageViewer',
    title: 'Scene 2 Keyframe Result',
    subtitle: 'Viewer & Download',
    colorTheme: 'purple',
    position: { x: 890, y: 520 },
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

  const videoModelNode2: CanvasNode = {
    id: videoModel2Id,
    type: 'geminiVideo',
    title: 'Gemini Omni Flash',
    subtitle: 'Scene 2 Video Render (10s)',
    colorTheme: 'purple',
    position: { x: 1260, y: 520 },
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
      promptOverride: formatSceneVideoPrompt(initialScenes[1]),
      voiceover: initialScenes[1].voiceover,
      shoots: initialScenes[1].shoots,
      sceneNumber: 2,
      sceneTitle: initialScenes[1].title,
      visualDescription: initialScenes[1].visualDescription,
      videoPrompt: initialScenes[1].videoPrompt,
    },
  };

  const edges: CanvasEdge[] = [
    // Scene 1
    {
      id: `edge_${storyboardId}_${imageModel1Id}`,
      sourceNodeId: storyboardId,
      sourceOutputId: 'scene1_image',
      targetNodeId: imageModel1Id,
      targetInputId: 'input-prompt',
      color: '#f59e0b',
    },
    {
      id: `edge_${imageModel1Id}_${viewer1Id}`,
      sourceNodeId: imageModel1Id,
      sourceOutputId: 'output-result',
      targetNodeId: viewer1Id,
      targetInputId: 'input-image',
      color: '#a855f7',
    },
    {
      id: `edge_${storyboardId}_${videoModel1Id}`,
      sourceNodeId: storyboardId,
      sourceOutputId: 'scene1_video',
      targetNodeId: videoModel1Id,
      targetInputId: 'input-prompt',
      color: '#f59e0b',
    },
    {
      id: `edge_${viewer1Id}_${videoModel1Id}`,
      sourceNodeId: viewer1Id,
      sourceOutputId: 'output-image',
      targetNodeId: videoModel1Id,
      targetInputId: 'input-image',
      color: '#38bdf8',
    },
    // Scene 2
    {
      id: `edge_${storyboardId}_${imageModel2Id}`,
      sourceNodeId: storyboardId,
      sourceOutputId: 'scene2_image',
      targetNodeId: imageModel2Id,
      targetInputId: 'input-prompt',
      color: '#f59e0b',
    },
    {
      id: `edge_${imageModel2Id}_${viewer2Id}`,
      sourceNodeId: imageModel2Id,
      sourceOutputId: 'output-result',
      targetNodeId: viewer2Id,
      targetInputId: 'input-image',
      color: '#a855f7',
    },
    {
      id: `edge_${storyboardId}_${videoModel2Id}`,
      sourceNodeId: storyboardId,
      sourceOutputId: 'scene2_video',
      targetNodeId: videoModel2Id,
      targetInputId: 'input-prompt',
      color: '#f59e0b',
    },
    {
      id: `edge_${viewer2Id}_${videoModel2Id}`,
      sourceNodeId: viewer2Id,
      sourceOutputId: 'output-image',
      targetNodeId: videoModel2Id,
      targetInputId: 'input-image',
      color: '#38bdf8',
    },
  ];

  return {
    id: `recipe_storyboard_${Date.now()}`,
    name: 'TikTok Viral Storyboard (20s)',
    description: 'Pipeline Storyboard 2 Scene lengkap tersambung ke Image Model dan Gemini Video',
    nodes: [
      storyboardNode,
      imageModelNode1,
      viewerNode1,
      videoModelNode1,
      imageModelNode2,
      viewerNode2,
      videoModelNode2,
    ],
    edges,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}