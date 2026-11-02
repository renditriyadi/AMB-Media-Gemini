// provider-adapters.js - Provider Adapters for Multi-Engine Chat (CHAT V2)
// Adapts normalized conversation context for Gemini, Dola, and Weavy
// Rule: Provider is an execution engine, NOT the conversation owner.

import { executeGeminiChat } from './gemini-chat.js';
import { executeDolaChat } from '../generator/dola-generation.js';
import { buildHistoryTranscript } from './context-builder.js';
import { stripOutboundPromptEcho } from './chat-render.js';

/**
 * Gemini Provider Adapter
 */
export async function executeGeminiAdapter({
  normalizedContext,
  model = 'gemini/gemini-2.5-pro',
  apiKey = null,
  onProgress = () => {},
  onChunk = () => {},
  abortSignal = null,
}) {
  const { systemPrompt, currentPrompt, historyMessages, referenceAssets } = normalizedContext;

  // Combine system prompt and user prompt with complete canonical history transcript
  let fullPrompt = `${systemPrompt}\n\n[Instruksi User]:\n${currentPrompt}`;
  const transcript = buildHistoryTranscript(historyMessages);
  if (transcript && transcript.trim()) {
    fullPrompt = `${systemPrompt}\n\n[RIWAYAT LENGKAP PERCAKAPAN SEBELUMNYA]:\n${transcript}\n\n[Instruksi User Saat Ini]:\n${currentPrompt}`;
  }

  // Format history messages into standard Gemini turn format (role: user/model)
  const geminiHistory = (historyMessages || []).map((m) => ({
    role: (m.role === 'assistant' || m.role === 'model') ? 'model' : 'user',
    content: m.content || '',
    attachments: m.attachments || [],
  }));

  const resultText = await executeGeminiChat({
    apiKey,
    model,
    prompt: fullPrompt,
    history: geminiHistory,
    referenceAssets: referenceAssets || [],
    onProgress,
    onChunk: (chunk) => {
      if (!abortSignal?.aborted && typeof onChunk === 'function') {
        const cleanedChunk = stripOutboundPromptEcho(chunk);
        onChunk(cleanedChunk || chunk);
      }
    },
  });

  const rawContent = typeof resultText === 'string' ? resultText : String(resultText || '');
  const cleanedContent = stripOutboundPromptEcho(rawContent) || rawContent;

  return {
    content: cleanedContent,
    provider: 'gemini',
    model,
    executedAt: new Date().toISOString(),
  };
}

/**
 * Dola Provider Adapter
 */
export async function executeDolaAdapter({
  normalizedContext,
  model = 'dola/fast',
  onProgress = () => {},
  onChunk = () => {},
  abortSignal = null,
}) {
  const { systemPrompt, currentPrompt, historyMessages, referenceAssets, providerRuntime } = normalizedContext;
  const isPro = String(model || '').toLowerCase().includes('pro');

  // Combine system prompt and current user prompt
  let fullDolaPrompt = `${systemPrompt}\n\n[Instruksi User]:\n${currentPrompt}`;

  // If there is prior conversation history from ANY provider (Gemini, Weavy, or prior Dola),
  // format the complete transcript so Dola has 100% full context of the entire conversation.
  const transcript = buildHistoryTranscript(historyMessages);
  if (transcript && transcript.trim()) {
    fullDolaPrompt = `${systemPrompt}\n\n[RIWAYAT LENGKAP PERCAKAPAN SEBELUMNYA]:\n${transcript}\n\n[Instruksi User Saat Ini]:\n${currentPrompt}`;
  }

  // Retrieve existing Dola native runtime state if available
  const dolaRuntime = providerRuntime?.dola || {};

  const result = await executeDolaChat({
    prompt: fullDolaPrompt,
    isPro,
    history: historyMessages,
    referenceAssets: referenceAssets || [],
    conversationId: dolaRuntime.convId || null,
    lastSectionId: dolaRuntime.sectionId || null,
    lastMessageIndex: dolaRuntime.messageIndex || null,
    onProgress,
    onChunk: (chunk) => {
      if (!abortSignal?.aborted && typeof onChunk === 'function') {
        const cleanedChunk = stripOutboundPromptEcho(chunk);
        onChunk(cleanedChunk || chunk);
      }
    },
  });

  let finalText = '';
  let updatedRuntime = { ...dolaRuntime };

  if (result && typeof result === 'object') {
    if (result.convId) updatedRuntime.convId = result.convId;
    if (result.sectionId) updatedRuntime.sectionId = result.sectionId;
    if (typeof result.msgIndex === 'number') {
      updatedRuntime.messageIndex = result.msgIndex + 2;
    }
    finalText = result.text || String(result);
  } else {
    finalText = String(result || '');
  }

  const cleanedFinalText = stripOutboundPromptEcho(finalText) || finalText;

  return {
    content: cleanedFinalText,
    provider: 'dola',
    model,
    updatedRuntime: {
      dola: updatedRuntime,
    },
    executedAt: new Date().toISOString(),
  };
}

/**
 * Weavy Provider Adapter
 */
export async function executeWeavyAdapter({
  normalizedContext,
  model = 'google/gemini-3-pro',
  callWeavyLLMFn,
  idToken,
  refreshToken,
  onProgress = () => {},
  abortSignal = null,
}) {
  if (typeof callWeavyLLMFn !== 'function') {
    throw new Error('Weavy LLM function is required for Weavy Adapter');
  }

  const { systemPrompt, currentPrompt, historyMessages, referenceAssets, mediaCatalog, metadata } = normalizedContext;

  onProgress(20, 'Mengirim percakapan ke Weavy Cloud...');

  const resultText = await callWeavyLLMFn({
    prompt: currentPrompt,
    systemPrompt: systemPrompt,
    model,
    idToken,
    refreshToken,
    history: historyMessages,
    images: referenceAssets,
    mediaCatalog,
    scrapingContext: metadata?.scrapingContext || null,
  });

  const rawContent = typeof resultText === 'string' ? resultText : String(resultText || '');
  const cleanedContent = stripOutboundPromptEcho(rawContent) || rawContent;

  return {
    content: cleanedContent,
    provider: 'weavy',
    model,
    executedAt: new Date().toISOString(),
  };
}

/**
 * Central Conversation Turn Dispatcher
 * Routes normalized context to the designated execution adapter.
 */
export async function executeConversationTurn({
  provider = 'weavy',
  model = 'google/gemini-3-pro',
  normalizedContext,
  apiKey = null,
  idToken = null,
  refreshToken = null,
  callWeavyLLMFn = null,
  onProgress = () => {},
  onChunk = () => {},
  abortSignal = null,
}) {
  const targetProvider = provider === 'gemini' || String(model).startsWith('gemini/')
    ? 'gemini'
    : (provider === 'dola' || String(model).startsWith('dola/') ? 'dola' : 'weavy');

  if (targetProvider === 'gemini') {
    return await executeGeminiAdapter({
      normalizedContext,
      model,
      apiKey,
      onProgress,
      onChunk,
      abortSignal,
    });
  }

  if (targetProvider === 'dola') {
    return await executeDolaAdapter({
      normalizedContext,
      model,
      onProgress,
      onChunk,
      abortSignal,
    });
  }

  return await executeWeavyAdapter({
    normalizedContext,
    model,
    callWeavyLLMFn,
    idToken,
    refreshToken,
    onProgress,
    abortSignal,
  });
}
