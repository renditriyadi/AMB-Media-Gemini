// response-normalizer.js - Response Normalizer for Multi-Provider Outputs
// Adapts Gemini, Weavy, and Dola outputs into standard Canonical Message format

import { stripOutboundPromptEcho } from '../chat/chat-render.js';

/**
 * Normalizes any provider response into a clean, canonical assistant message structure
 * @param {Object} params
 * @param {string|Object} params.rawResult - Result returned by provider adapter
 * @param {string} params.provider - 'gemini' | 'dola' | 'weavy'
 * @param {string} params.model - Model name
 * @param {string} params.taskType - Task classification type
 * @param {Object} params.metadata - Extra context metadata
 * @returns {Object} Canonical Assistant Message
 */
export function normalizeProviderResponse({
  rawResult,
  provider = 'weavy',
  model = null,
  taskType = 'simple_chat',
  metadata = {},
}) {
  let content = '';
  let updatedRuntime = null;
  let executedAt = new Date().toISOString();

  if (typeof rawResult === 'string') {
    content = rawResult;
  } else if (rawResult && typeof rawResult === 'object') {
    content = rawResult.content || rawResult.text || '';
    if (rawResult.updatedRuntime) {
      updatedRuntime = rawResult.updatedRuntime;
    }
    if (rawResult.executedAt) {
      executedAt = rawResult.executedAt;
    }
  }

  // Strip prompt echos if provider echoed back the input
  let cleanContent = stripOutboundPromptEcho(content) || content;

  // Strip residual typing loaders / status tags
  cleanContent = cleanContent
    .replace(/\[chat_typing_loader\]/g, '')
    .replace(/\[typing_status:[^\]]*\]/g, '')
    .trim();

  // Determine model display name
  const modelDisplayName = getModelDisplayName(provider, model);

  return {
    id: `msg_asst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    role: 'assistant',
    content: cleanContent,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    modelDisplayName,
    taskType,
    attachments: [],
    metadata: {
      ...metadata,
      normalizedAt: executedAt,
    },
    execution: {
      provider,
      model: model || provider,
      status: 'completed',
      executedAt,
    },
    updatedRuntime,
  };
}

/**
 * Helper to get clean human-readable model display label
 */
function getModelDisplayName(provider, model) {
  if (provider === 'gemini') {
    if (String(model).includes('thinking')) return '✨ Gemini 3.6 (Thinking)';
    if (String(model).includes('flash')) return '⚡ Gemini 3.6 (Flash)';
    if (String(model).includes('3.1-pro')) return '🧠 Gemini 3.1 Pro';
    return '✨ Google Gemini';
  }
  if (provider === 'dola') {
    if (String(model).includes('pro')) return '💎 Dola Pro';
    return '⚡ Dola Fast';
  }
  return 'Weavy AI';
}
