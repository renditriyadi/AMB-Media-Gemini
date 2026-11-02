// contextSelector.ts - Context Selector & Pruner (Agent V1).
// Port dari ektension-weavy/js/agent/context-selector.js.
// Menggabungkan: riwayat relevan + Project Memory + Working Memory + instruksi
// current turn + asset wajib, tanpa overload context.

import { buildSessionMediaCatalog, SessionMediaCatalog } from './mediaCatalog';
import { formatProjectMemoryPrompt, getOrCreateProjectMemory } from './projectMemory';
import { TASK_TYPES, TaskPlan } from './taskAnalyzer';

export interface ContextSessionLike {
  id: string;
  title?: string;
  messages?: any[];
  metadata?: any;
}

export interface ContextUserMsgLike {
  id?: string;
  content?: string;
  attachments?: any[];
}

export interface OptimizedContextInput {
  session: ContextSessionLike;
  userMsg: ContextUserMsgLike;
  taskPlan: TaskPlan;
  provider?: 'gemini' | 'dola' | 'weavy';
  model?: string | null;
  isStoryboardCopilotActive?: boolean;
  scrapingContext?: string | null;
  libraryKnowledgePrompt?: string;
  /** Base system prompt (Master Director + kontrak storyboard). */
  masterSystemPrompt: string;
  /** Kontrak output storyboard_project (hanya aktif di mode storyboard). */
  storyboardContractBlock?: string;
  /** Prompt preset yang sudah diexpand (opsional, override default). */
  expandedPrompt?: string;
  workingMemoryPrompt?: string;
  workingStep?: { current: number; total: number };
}

export interface OptimizedHistoryMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  attachments: any[];
  extractedProducts: any[];
  videoPreviews: any[];
}

export interface OptimizedContext {
  conversationId: string;
  sessionTitle: string;
  systemPrompt: string;
  currentPrompt: string;
  rawUserText: string;
  historyMessages: OptimizedHistoryMessage[];
  mediaCatalog: SessionMediaCatalog;
  referenceAssets: any[];
  taskPlan: TaskPlan;
  metadata: {
    isStoryboardCopilotActive: boolean;
    scrapingContext: string | null;
    provider: string;
    model: string | null;
    taskType: string;
    createdAt?: string;
    prunedMessageCount: number;
    assetCount: number;
  };
}

const VISUAL_FOLLOWUP_RE =
  /(ini|tadi|tersebut|gambar|foto|video|produk|baju|model|talent|warna|adegan|scene)/i;

export function buildOptimizedContext(input: OptimizedContextInput): OptimizedContext {
  const {
    session,
    userMsg,
    taskPlan,
    provider = 'weavy',
    model = null,
    isStoryboardCopilotActive = false,
    scrapingContext = null,
    libraryKnowledgePrompt = '',
    masterSystemPrompt,
    storyboardContractBlock = '',
    expandedPrompt,
    workingMemoryPrompt = '',
    workingStep,
  } = input;

  if (!session) throw new Error('Session is required to build optimized context');

  const rawMessages = Array.isArray(session.messages) ? session.messages : [];
  const currentText = userMsg?.content || '';
  const currentAttachments = Array.isArray(userMsg?.attachments) ? userMsg.attachments : [];

  // 1. Katalog media sesi
  const sessionMediaCatalog = buildSessionMediaCatalog(session as any, currentAttachments);
  const mediaMap = sessionMediaCatalog?.mediaMap || {};

  // 2. Filter + prune riwayat
  const isSimple = taskPlan?.taskType === TASK_TYPES.SIMPLE_CHAT;
  const historyLimit = isSimple ? 4 : taskPlan?.isMultiStep ? 14 : 10;

  const cleanHistory: OptimizedHistoryMessage[] = [];
  for (const m of rawMessages) {
    if (!m) continue;
    if (userMsg && m.id && m.id === userMsg.id) continue;
    if (m.isError || m.execution?.status === 'failed') continue;

    let content = (m.content || '').trim();
    if (m.role === 'assistant') {
      if (content === '[chat_typing_loader]' || content.startsWith('[typing_status:')) continue;
      content = content.replace(/\[typing_status:[^\]]*\]/g, '').replace(/\[chat_typing_loader\]/g, '').trim();
    }

    if (!content && (!m.attachments || m.attachments.length === 0) && !m.extractedProducts) continue;

    cleanHistory.push({
      id: m.id,
      role: m.role === 'user' ? 'user' : 'assistant',
      content,
      attachments: Array.isArray(m.attachments) ? m.attachments : [],
      extractedProducts: Array.isArray(m.extractedProducts) ? m.extractedProducts : [],
      videoPreviews: Array.isArray(m.videoPreviews) ? m.videoPreviews : [],
    });
  }

  const prunedHistory = cleanHistory.slice(-historyLimit);

  // 3. Asset wajib (current attachments + tag media + session memory)
  const seenKeys = new Set<string>();
  const requiredAssets: any[] = [];

  for (const att of currentAttachments) {
    const k = att.url || att.base64 || att.id;
    if (k && !seenKeys.has(k)) {
      seenKeys.add(k);
      requiredAssets.push(att);
    }
  }

  const mentionedTags = (currentText.match(/@(img|vid)\d+/gi) || []).map((t) => t.toLowerCase());
  let mediaTagContext = '';
  if (mentionedTags.length > 0) {
    const tagDescriptions: string[] = [];
    for (const tag of mentionedTags) {
      const item = (mediaMap as any)[tag];
      if (!item) continue;
      tagDescriptions.push(
        `• Tag "${item.key}": ${item.type === 'video' ? 'Video' : 'Gambar'} "${item.name || 'Aset'}"`
      );
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
    if (tagDescriptions.length > 0) {
      mediaTagContext = `[PANDUAN REFERENSI MEDIA]:\n${tagDescriptions.join(
        '\n'
      )}\nPahami bahwa tag di atas merujuk langsung ke aset visual tersebut.`;
    }
  } else if (requiredAssets.length === 0 && sessionMediaCatalog?.mediaList?.length > 0) {
    const isVisualFollowup = VISUAL_FOLLOWUP_RE.test(currentText);
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

  // 4. Project Memory
  const projectMemory = getOrCreateProjectMemory(session);
  const projectMemoryPrompt = formatProjectMemoryPrompt(projectMemory);

  // 5. System prompt
  let systemPrompt = masterSystemPrompt;
  if (storyboardContractBlock) systemPrompt += `\n\n${storyboardContractBlock}`;
  if (projectMemoryPrompt) systemPrompt += `\n\n${projectMemoryPrompt}`;
  if (libraryKnowledgePrompt && libraryKnowledgePrompt.trim()) {
    systemPrompt += `\n\n${libraryKnowledgePrompt.trim()}`;
  }

  // 6. Instruksi current turn
  let prompt = expandedPrompt !== undefined ? expandedPrompt : currentText;
  if (mediaTagContext) prompt = `${mediaTagContext}\n\n${prompt}`;
  if (workingMemoryPrompt) {
    prompt = `${workingMemoryPrompt}\n\n[Instruksi Langkah Saat Ini (${workingStep?.current ?? 1}/${
      workingStep?.total ?? 1
    })]:\n${prompt}`;
  }

  return {
    conversationId: session.id,
    sessionTitle: session.title || 'Percakapan',
    systemPrompt,
    currentPrompt: prompt,
    rawUserText: currentText,
    historyMessages: prunedHistory,
    mediaCatalog: sessionMediaCatalog,
    referenceAssets: requiredAssets,
    taskPlan,
    metadata: {
      isStoryboardCopilotActive,
      scrapingContext,
      provider,
      model,
      taskType: taskPlan?.taskType || TASK_TYPES.SIMPLE_CHAT,
      createdAt: (session as any).createdAt,
      prunedMessageCount: prunedHistory.length,
      assetCount: requiredAssets.length,
    },
  };
}
