// context-selector.js - Smart Context Selector & Pruner for Agent V1
// Combines: Relevant Conversation + Project Memory + Working Memory + Current Instruction + Required Assets
// Avoids context overload, reduces token cost and latency.

import { buildSessionMediaCatalog } from '../chat/chat-media.js';
import { formatProjectMemoryPrompt, getOrCreateProjectMemory } from './memory-manager.js';
import { expandChatPreset } from '../chat/chat-presets.js';
import { getMasterDirectorSystemPrompt } from '../chat/context-builder.js';

/**
 * Builds an optimized, relevant Context Payload for the target Provider
 * @param {Object} params
 * @param {Object} params.session - Canonical chat session
 * @param {Object} params.userMsg - Current turn user message
 * @param {Object} params.taskPlan - Task plan from TaskAnalyzer
 * @param {Object} params.workingMemory - Active WorkingMemory instance if any
 * @param {string} params.provider - 'gemini' | 'dola' | 'weavy'
 * @param {string} params.model - Specific model ID
 * @param {boolean} params.isStoryboardCopilotActive - Storyboard copilot flag
 * @param {string} params.scrapingContext - Live scraping metadata if any
 * @param {string} params.libraryKnowledgePrompt - Knowledge base prompt if any
 * @returns {Object} Optimized Normalized Context
 */
export function buildOptimizedContext({
  session,
  userMsg,
  taskPlan,
  workingMemory = null,
  provider = 'weavy',
  model = null,
  isStoryboardCopilotActive = false,
  scrapingContext = null,
  libraryKnowledgePrompt = '',
}) {
  if (!session) {
    throw new Error('Session is required to build optimized context');
  }

  const rawMessages = Array.isArray(session.messages) ? session.messages : [];
  const currentText = userMsg?.content || '';
  const currentAttachments = Array.isArray(userMsg?.attachments) ? userMsg.attachments : [];

  // 1. Build session media catalog
  const sessionMediaCatalog = buildSessionMediaCatalog(session, currentAttachments);
  const mediaMap = sessionMediaCatalog?.mediaMap || {};

  // 2. Filter Relevant History Turns (Context Pruning)
  const isSimple = taskPlan?.taskType === 'simple_chat';
  const historyLimit = isSimple ? 4 : (taskPlan?.isMultiStep ? 14 : 10);

  const cleanHistory = [];
  for (const m of rawMessages) {
    if (!m) continue;
    if (userMsg && m.id === userMsg.id) continue;
    if (m.isError || m.execution?.status === 'failed') continue;

    let content = (m.content || '').trim();
    if (m.role === 'assistant') {
      if (content === '[chat_typing_loader]' || content.startsWith('[typing_status:')) {
        continue;
      }
      content = content.replace(/\[typing_status:[^\]]*\]/g, '').replace(/\[chat_typing_loader\]/g, '').trim();
    }

    if (!content && (!m.attachments || m.attachments.length === 0) && !m.extractedProducts) {
      continue;
    }

    cleanHistory.push({
      id: m.id,
      role: m.role === 'user' ? 'user' : 'assistant',
      content,
      timestamp: m.timestamp || null,
      attachments: Array.isArray(m.attachments) ? m.attachments : [],
      extractedProducts: Array.isArray(m.extractedProducts) ? m.extractedProducts : [],
      videoPreviews: Array.isArray(m.videoPreviews) ? m.videoPreviews : [],
      execution: m.execution || null,
    });
  }

  // Prune history to limit to prevent context blowup
  const prunedHistory = cleanHistory.slice(-historyLimit);

  // 3. Asset Selection (Strictly required assets)
  const seenKeys = new Set();
  const requiredAssets = [];

  // Always include current attachments
  for (const att of currentAttachments) {
    const k = att.url || att.base64 || att.id;
    if (k && !seenKeys.has(k)) {
      seenKeys.add(k);
      requiredAssets.push(att);
    }
  }

  // Check mentioned media tags (@img1, @vid1, etc.)
  const mentionedTags = (currentText.match(/@(img|vid)\d+/gi) || []).map((t) => t.toLowerCase());
  let mediaTagContext = '';
  if (mentionedTags.length > 0) {
    const tagDescriptions = [];
    for (const tag of mentionedTags) {
      const item = mediaMap[tag];
      if (item) {
        tagDescriptions.push(`• Tag "${item.key}": ${item.type === 'video' ? 'Video' : 'Gambar'} "${item.name || 'Aset'}"`);
        const k = item.url || item.base64;
        if (k && !seenKeys.has(k) && item.type !== 'video') {
          seenKeys.add(k);
          requiredAssets.push({
            type: 'image',
            name: item.name || tag,
            url: item.url,
            base64: item.base64,
            tagKey: item.key || tag,
            referenceRole: 'tagged_context',
          });
        }
      }
    }
    if (tagDescriptions.length > 0) {
      mediaTagContext = `[PANDUAN REFERENSI MEDIA]:\n${tagDescriptions.join('\n')}\nPahami bahwa tag di atas merujuk langsung ke aset visual tersebut.`;
    }
  } else if (requiredAssets.length === 0 && sessionMediaCatalog?.mediaList?.length > 0) {
    // Contextual visual follow-up check
    const isVisualFollowup = /(ini|tadi|tersebut|gambar|foto|video|produk|baju|model|talent|warna|adegan|scene)/i.test(currentText);
    if (isVisualFollowup) {
      const recentImg = sessionMediaCatalog.mediaList.find((m) => m.type !== 'video');
      if (recentImg && (recentImg.url || recentImg.base64)) {
        const k = recentImg.url || recentImg.base64;
        if (!seenKeys.has(k)) {
          seenKeys.add(k);
          requiredAssets.push({
            type: 'image',
            name: recentImg.name || 'Foto Sesi Sebelumnya',
            url: recentImg.url,
            base64: recentImg.base64,
            tagKey: recentImg.key,
            referenceRole: 'session_memory',
          });
        }
      }
    }
  }

  // 4. Project Memory Context
  const projectMemory = getOrCreateProjectMemory(session);
  const projectMemoryPrompt = formatProjectMemoryPrompt(projectMemory);

  // 5. Working Memory Context (for multi-step tasks)
  let workingMemoryPrompt = '';
  if (workingMemory && workingMemory.intermediateOutputs?.length > 0) {
    workingMemoryPrompt = `[LANGKAH EKSEKUSI SEBELUMNYA]:\n${workingMemory.getPreviousOutputs()}`;
  }

  // 6. Assemble Master System Prompt
  let systemPrompt = getMasterDirectorSystemPrompt({
    provider,
    isStoryboardActive: isStoryboardCopilotActive || taskPlan?.taskType === 'storyboard_generation',
    sessionMediaCatalog,
    scrapingContext,
  });

  if (projectMemoryPrompt) {
    systemPrompt += `\n\n${projectMemoryPrompt}`;
  }

  if (libraryKnowledgePrompt && libraryKnowledgePrompt.trim()) {
    systemPrompt += `\n\n${libraryKnowledgePrompt.trim()}`;
  }

  // 7. Assemble Current Turn Instruction
  let expandedPrompt = expandChatPreset(currentText, provider);
  if (mediaTagContext) {
    expandedPrompt = `${mediaTagContext}\n\n${expandedPrompt}`;
  }
  if (workingMemoryPrompt) {
    expandedPrompt = `${workingMemoryPrompt}\n\n[Instruksi Langkah Saat Ini (${workingMemory.currentStep}/${workingMemory.totalSteps})]:\n${expandedPrompt}`;
  }

  return {
    conversationId: session.id,
    sessionTitle: session.title || 'Percakapan',
    systemPrompt,
    currentPrompt: expandedPrompt,
    rawUserText: currentText,
    historyMessages: prunedHistory,
    mediaCatalog: sessionMediaCatalog,
    referenceAssets: requiredAssets,
    providerRuntime: session.providerRuntime || {},
    taskPlan,
    metadata: {
      isStoryboardCopilotActive,
      scrapingContext,
      provider,
      model,
      taskType: taskPlan?.taskType || 'simple_chat',
      createdAt: session.createdAt,
      prunedMessageCount: prunedHistory.length,
      assetCount: requiredAssets.length,
    },
  };
}
