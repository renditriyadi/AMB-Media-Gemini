import { callWeavyApi, getWeavyClientHeaders } from '../core/api.js';
import { storage } from '../core/storage.js';
import { executeAgentTurn } from '../agent/agent-orchestrator.js';
import { buildLibraryKnowledgePrompt } from '../library/asset-knowledge.js';
import { exchangeWeavyRefreshToken } from '../core/weavy-session.js';
import { buildNativeChatSupplementalContext } from './chat-prompt-context.js';
import { executeWeavyChatRecipe } from './weavy-chat-recipe.js';

async function requestJson(path, options = {}) {
  const response = await callWeavyApi(path, options);
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Respons Weavy bukan JSON yang valid (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || text || `Weavy API gagal (HTTP ${response.status}).`);
  }
  return data;
}

async function getRecipeId(idToken, userId) {
  const storageKey = `weavy_canvas_chat_${userId || 'default'}`;
  const cachedId = await storage.get(storageKey);
  if (cachedId) return cachedId;

  const headers = getWeavyClientHeaders(idToken, userId);
  const list = await requestJson('/api/v1/recipes?limit=15', { headers });
  const recipes = Array.isArray(list) ? list : (list.recipes || []);
  const existing = recipes.find((item) =>
    /chat llm|chat assistant|amb/i.test(item?.name || '')
  );
  let recipeId = existing?.id;

  if (!recipeId) {
    const created = await requestJson('/api/v1/recipes/create', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Chat LLM Assistant',
        description: 'Chat recipe managed by the Weavy extension.',
      }),
    });
    recipeId = created.id || created._id;
  }
  if (!recipeId) throw new Error('Ekstensi gagal menyiapkan Recipe Canvas Chat Weavy.');

  await storage.set(storageKey, recipeId);
  return recipeId;
}

async function uploadChatImage(image, idToken) {
  const source = typeof image === 'string'
    ? image
    : image?.base64 || image?.url || image?.dataUrl;
  if (!source) return null;

  if (/^https?:\/\//i.test(source)) {
    return {
      type: 'image',
      url: source,
      width: image?.width || 1024,
      height: image?.height || 1024,
      thumbnailUrl: image?.thumbnailUrl || source,
      id: image?.id || `img_${Date.now()}`,
      name: image?.name || 'chat_reference.png',
    };
  }

  const response = await fetch(source);
  if (!response.ok) throw new Error(`Ekstensi gagal membaca lampiran gambar (${response.status}).`);
  const blob = await response.blob();
  const form = new FormData();
  const name = image?.name || `chat_reference_${Date.now()}.png`;
  form.append('file', blob, name);

  const uploadResponse = await callWeavyApi('https://api.weavy.ai/api/v1/assets/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'X-Weavy-Auth-Provider': 'firebase',
      'x-app-version': '4.1.1316',
    },
    body: form,
  });
  const uploadText = await uploadResponse.text();
  let uploaded = {};
  try {
    uploaded = uploadText ? JSON.parse(uploadText) : {};
  } catch {
    throw new Error('Ekstensi menerima respons upload gambar Weavy yang tidak valid.');
  }
  if (!uploadResponse.ok || !uploaded.url) {
    throw new Error(uploaded?.error?.message || `Upload gambar Weavy gagal (HTTP ${uploadResponse.status}).`);
  }
  return {
    type: 'image',
    url: uploaded.url,
    width: uploaded.width || 1024,
    height: uploaded.height || 1024,
    thumbnailUrl: uploaded.thumbnailUrl || uploaded.url,
    id: uploaded.id || `img_${Date.now()}`,
    name: uploaded.name || name,
  };
}

async function runWeavyChat({ prompt, systemPrompt, model, idToken, refreshToken, images, mediaCatalog, scrapingContext, history }) {
  let activeIdToken = idToken;
  let tokenExpiresAt = 0;
  try {
    const payload = activeIdToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    tokenExpiresAt = Number(JSON.parse(atob(payload)).exp || 0) * 1000;
  } catch {
    tokenExpiresAt = 0;
  }
  if (refreshToken && (!activeIdToken || tokenExpiresAt < Date.now() + 60000)) {
    const refreshed = await exchangeWeavyRefreshToken(refreshToken);
    activeIdToken = refreshed.idToken;
  }
  if (!activeIdToken) throw new Error('Sesi Weavy tidak memiliki ID token. Sinkronkan akun di ekstensi lalu coba lagi.');

  const userId = (() => {
    try {
      const payload = activeIdToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const claims = JSON.parse(atob(payload));
      return claims.user_id || claims.sub;
    } catch {
      return null;
    }
  })();
  const recipeId = await getRecipeId(activeIdToken, userId);
  const headers = {
    ...getWeavyClientHeaders(activeIdToken, userId, recipeId),
    'x-app-recipeid': recipeId,
  };

  const uploadedImages = [];
  for (const image of (images || []).filter((item) => item?.type !== 'video').slice(0, 5)) {
    const uploaded = await uploadChatImage(image, activeIdToken);
    if (uploaded) uploadedImages.push(uploaded);
  }

  const transcript = (history || [])
    .filter((message) => message.content && message.content !== prompt)
    .map((message) => `${message.role === 'assistant' || message.role === 'model' ? 'Assistant' : 'User'}: ${message.content}`)
    .join('\n');
  const { mediaCatalogSection, scrapingSection } = buildNativeChatSupplementalContext({
    mediaCatalog,
    scrapingContext,
  });
  const fullPrompt = [
    systemPrompt || '',
    mediaCatalogSection,
    scrapingSection,
    transcript ? `[Conversation History]\n${transcript}` : '',
    `User: ${prompt || (uploadedImages.length ? 'Analisis gambar yang saya lampirkan.' : 'Halo!')}`,
    'Assistant:',
  ].filter(Boolean).join('\n\n');

  const promptNodeId = `prompt_${Date.now()}`;
  const modelNodeId = `model_${Date.now()}`;
  const targetModel = model || 'google/gemini-3-pro';
  const promptNode = {
    id: promptNodeId,
    type: 'promptV3',
    position: { x: 200, y: 200 },
    data: {
      name: 'Prompt',
      color: 'Yambo_Green',
      prompt: fullPrompt,
      output: { type: 'text', prompt: fullPrompt },
      result: { prompt: fullPrompt },
      handles: { output: { prompt: { type: 'text', order: 0 } } },
      version: 3,
    },
  };
  const modelNode = {
    id: modelNodeId,
    isModel: true,
    type: 'custommodelV2',
    position: { x: 650, y: 200 },
    data: {
      name: 'Any LLM',
      color: 'Yambo_Purple',
      model: { name: 'any_llm' },
      kind: {
        type: 'any_llm',
        model: { type: 'value', data: { type: 'string', value: targetModel } },
        prompt: { nodeId: promptNodeId, string: fullPrompt, outputId: 'prompt' },
        thinking: { type: 'value', data: { type: 'boolean', value: false } },
        temperature: { type: 'value', data: { type: 'float', value: 0.3 } },
      },
      params: { model: targetModel, temperature: 0.3, prompt: fullPrompt, thinking: false },
      input: { prompt: fullPrompt },
      handles: {
        input: {
          prompt: { type: 'text', order: 0, required: true },
          system_prompt: { type: 'text', order: 1, required: false },
          image: { type: 'image', order: 2, required: false },
        },
        output: { text: { type: 'text', order: 0 } },
      },
      version: 3,
    },
  };

  const nodes = [promptNode, modelNode];
  const edges = [{
    id: `edge_p_${Date.now()}`,
    type: 'custom',
    source: promptNodeId,
    target: modelNodeId,
    sourceHandle: `${promptNodeId}-output-prompt`,
    targetHandle: `${modelNodeId}-input-prompt`,
    data: {
      sourceColor: 'Yambo_Green',
      targetColor: 'Yambo_Purple',
      sourceHandleType: 'text',
      targetHandleType: 'text',
    },
  }];

  uploadedImages.forEach((asset, index) => {
    const nodeId = `file_${Date.now()}_${index}`;
    const handle = index === 0 ? 'image' : `image_${index + 1}`;
    nodes.push({
      id: nodeId,
      type: 'import',
      position: { x: 200, y: 480 + index * 220 },
      data: {
        name: `File ${index + 1}`,
        color: 'Yambo_Blue',
        files: [asset],
        output: { file: asset },
        result: asset,
        handles: { output: { file: { type: 'any', order: 0 } } },
        version: 3,
      },
    });
    modelNode.data.kind.images ||= [];
    modelNode.data.kind.images.push([handle, { file: asset, nodeId, outputId: 'file' }]);
    if (index > 0) modelNode.data.handles.input[handle] = { type: 'image', order: 2 + index, required: false };
    edges.push({
      id: `edge_f_${index}_${Date.now()}`,
      type: 'custom',
      source: nodeId,
      target: modelNodeId,
      sourceHandle: `${nodeId}-output-file`,
      targetHandle: `${modelNodeId}-input-${handle}`,
      data: { sourceColor: 'Yambo_Blue', targetColor: 'Yambo_Purple', sourceHandleType: 'any', targetHandleType: 'image' },
    });
  });

  return executeWeavyChatRecipe({
    recipeId,
    headers,
    model: targetModel,
    graph: { nodes, edges, promptNodeId, modelNodeId },
    pollAttempts: 60,
    pollInterval: 1400,
  });
}

export async function executeWebAppWeavyChat({
  session,
  userMsg,
  model,
  idToken,
  refreshToken,
  isStoryboardCopilotActive = false,
  quickPresetEnabled = false,
  scrapingContext = null,
}) {
  if (!session || !userMsg?.content) throw new Error('Sesi dan pesan chat wajib diisi.');
  if (!idToken && !refreshToken) throw new Error('Akun Weavy tidak memiliki token aktif. Hubungkan ulang akun di aplikasi.');

  const messages = Array.isArray(session.messages) ? session.messages : [];
  const turnSession = {
    ...session,
    messages: messages.some((message) => message.id === userMsg.id) ? messages : [...messages, userMsg],
  };
  const libraryAssets = await storage.get('weavy_library_assets');
  const libraryKnowledgePrompt = [
    buildLibraryKnowledgePrompt(Array.isArray(libraryAssets) ? libraryAssets : []),
    quickPresetEnabled
      ? '[DIRECTOR QUICK ENHANCEMENT ACTIVE]\nTingkatkan permintaan kreatif menjadi arahan yang konkret dan sinematik; gunakan kamera/lensa nyata, pencahayaan alami, detail material, dan timeline yang jelas. Hindari klise visual AI. Tetap utamakan brief pengguna.'
      : '',
  ].filter(Boolean).join('\n\n');

  let remainingCredits;
  const callWeavyLLMFn = async (options) => {
    const result = await runWeavyChat(options);
    remainingCredits = result.remainingCredits;
    return result.content;
  };

  const result = await executeAgentTurn({
    session: turnSession,
    userMsg,
    provider: 'weavy',
    model,
    idToken,
    refreshToken,
    callWeavyLLMFn,
    isStoryboardCopilotActive,
    scrapingContext,
    libraryKnowledgePrompt,
    fallbackAllowed: false,
  });

  return {
    success: true,
    text: result.content,
    provider: result.execution?.provider || 'weavy',
    model: result.execution?.model || model,
    modelDisplayName: result.modelDisplayName,
    taskType: result.taskType,
    metadata: turnSession.metadata || {},
    remainingCredits,
  };
}
