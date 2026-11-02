import { callWeavyApi } from '../core/api.js';
import { extractTextFromResult } from '../core/response-parsers.js';

function createRecipeGraph({ prompt, model, images = [], temperature = 0.3 }) {
  const promptNodeId = `prompt_${Date.now()}`;
  const modelNodeId = `model_${Date.now()}`;
  const promptNode = {
    id: promptNodeId,
    type: 'promptV3',
    position: { x: 200, y: 200 },
    data: {
      name: 'Prompt',
      color: 'Yambo_Green',
      prompt,
      output: { type: 'text', prompt },
      result: { prompt },
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
        model: { type: 'value', data: { type: 'string', value: model } },
        prompt: { nodeId: promptNodeId, string: prompt, outputId: 'prompt' },
        thinking: { type: 'value', data: { type: 'boolean', value: false } },
        temperature: { type: 'value', data: { type: 'float', value: temperature } },
      },
      params: { model, temperature, prompt, thinking: false },
      input: { prompt },
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

  images.slice(0, 5).forEach((image, index) => {
    const nodeId = `file_${Date.now()}_${index}`;
    const handle = index === 0 ? 'image' : `image_${index + 1}`;
    nodes.push({
      id: nodeId,
      type: 'import',
      position: { x: 200, y: 480 + index * 220 },
      data: {
        name: `File ${index + 1}`,
        color: 'Yambo_Blue',
        files: [image],
        output: { file: image },
        result: image,
        handles: { output: { file: { type: 'any', order: 0 } } },
        version: 3,
      },
    });
    modelNode.data.kind.images ||= [];
    modelNode.data.kind.images.push([handle, { file: image, nodeId, outputId: 'file' }]);
    if (index > 0) modelNode.data.handles.input[handle] = { type: 'image', order: 2 + index, required: false };
    edges.push({
      id: `edge_f_${index}_${Date.now()}`,
      type: 'custom',
      source: nodeId,
      target: modelNodeId,
      sourceHandle: `${nodeId}-output-file`,
      targetHandle: `${modelNodeId}-input-${handle}`,
      data: {
        sourceColor: 'Yambo_Blue',
        targetColor: 'Yambo_Purple',
        sourceHandleType: 'any',
        targetHandleType: 'image',
      },
    });
  });

  return { nodes, edges, promptNodeId, modelNodeId };
}

async function requestJson(path, options = {}) {
  const response = await callWeavyApi(path, options);
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw Object.assign(new Error(`Respons Weavy bukan JSON yang valid (HTTP ${response.status}).`), {
      status: response.status,
    });
  }
  if (!response.ok) {
    throw Object.assign(
      new Error(data?.error?.message || data?.message || text || `Weavy API gagal (HTTP ${response.status}).`),
      { status: response.status },
    );
  }
  return data;
}

async function executeWeavyChatRecipeOnce({
  recipeId,
  headers,
  prompt,
  model = 'google/gemini-3-pro',
  images = [],
  graph: suppliedGraph,
  temperature = 0.3,
  pollAttempts = 60,
  pollInterval = 1400,
  ignoreSaveErrors = false,
}) {
  if (!recipeId) throw new Error('Recipe Chat Weavy tidak tersedia.');
  if (!Array.isArray(images)) throw new Error('Lampiran gambar Chat Weavy tidak valid.');
  const graph = suppliedGraph || createRecipeGraph({ prompt, model, images, temperature });
  const requestHeaders = { ...headers, 'x-app-recipeid': recipeId };

  try {
    await requestJson(`/api/v1/recipes/${recipeId}/save`, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({
        nodes: graph.nodes,
        edges: graph.edges,
        v3: true,
        lastUpdatedAt: new Date().toISOString(),
      }),
    });
  } catch (error) {
    if (!ignoreSaveErrors) throw error;
    console.warn('[Save Canvas Warning]:', error);
  }

  let execution;
  try {
    execution = await requestJson(`/api/v1/batches/recipes/${recipeId}/execute`, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({
        numberOfRuns: 1,
        nodes: graph.nodes,
        edges: graph.edges,
        displayedCost: { credits: 1, perSecondRate: 0, surface: 'drawer' },
      }),
    });
  } catch (error) {
    error.phase = 'execute';
    throw error;
  }
  const batchId = execution.batchId || execution.id;
  if (!batchId) throw new Error('Weavy tidak mengembalikan ID eksekusi batch.');

  for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    let status;
    try {
      status = await requestJson(
        `/api/v1/batches/recipes/${recipeId}/batches/${batchId}/status`,
        { headers: requestHeaders },
      );
    } catch (error) {
      error.phase = 'poll';
      throw error;
    }
    const run = status.recipeRuns?.[0] || status.recipeRun;
    const state = String(run?.status || status.status || '').toUpperCase();
    if (state === 'FAILED' || state === 'ERROR') {
      const error = run?.error?.message || run?.error || status.error || 'Eksekusi model Weavy gagal.';
      throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
    }
    if (state !== 'COMPLETED' && state !== 'SUCCESS') continue;

    const nodeRuns = Array.isArray(run?.nodeRuns) ? run.nodeRuns : [];
    const modelRun = nodeRuns.find((item) => item.nodeId === graph.modelNodeId)
      || nodeRuns.find((item) => item.nodeType === 'custommodelV2' || item.name?.includes('LLM'))
      || nodeRuns[nodeRuns.length - 1];
    let content = modelRun
      ? extractTextFromResult(modelRun.result) || extractTextFromResult(modelRun.output) || extractTextFromResult(modelRun)
      : '';
    if (!content) {
      for (const item of nodeRuns) {
        if (item.nodeId === graph.promptNodeId) continue;
        content = extractTextFromResult(item.result) || extractTextFromResult(item.output);
        if (content) break;
      }
    }
    if (!content) throw new Error('Model Weavy tidak mengembalikan output teks.');
    return {
      content,
      remainingCredits: status.userRemainingCredits ?? status.remainingCredits,
    };
  }

  throw new Error('Waktu tunggu respons Chat Weavy habis.');
}

export async function executeWeavyChatRecipe(options) {
  try {
    return await executeWeavyChatRecipeOnce(options);
  } catch (error) {
    if (
      ![401, 403].includes(error?.status) ||
      error?.phase === 'poll' ||
      typeof options?.onUnauthorized !== 'function'
    ) {
      throw error;
    }
    const refreshed = await options.onUnauthorized(error);
    if (!refreshed?.recipeId || !refreshed?.headers) throw error;
    return executeWeavyChatRecipeOnce({
      ...options,
      ...refreshed,
      onUnauthorized: undefined,
    });
  }
}
