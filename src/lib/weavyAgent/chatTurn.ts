// chatTurn.ts - Orkestrasi satu turn chat Weavy (Agent V1).
// Menggabungkan task analyzer, project memory, context selector, dan
// post-processing balasan (merge lokal scene storyboard).
//
// Parity dengan ektension-weavy/js/agent/* : analyzeTask -> memory ->
// buildOptimizedContext -> provider (bridge) -> post-process aksi.

import { analyzeTask, TaskPlan, TASK_TYPES } from './taskAnalyzer';
import { extractProjectMemoryCandidate, updateProjectMemory, WeavyProjectMemory } from './projectMemory';
import { buildOptimizedContext, OptimizedContext } from './contextSelector';
import { buildMasterDirectorSystemPrompt } from './masterPrompt';
import {
  applyStoryboardSceneUpdate,
  extractStoryboardCopilotAction,
  renderStoryboardProjectBlock,
} from './storyboardActions';

export interface ChatTurnInput {
  /** Sesi kanonik (sumber kebenaran). Boleh dimutasi (metadata.projectMemory). */
  session: { id: string; title?: string; messages: any[]; metadata?: any; createdAt?: string };
  /** Pesan user current turn. */
  userMsg: { id?: string; content: string; attachments?: any[] };
  /** Model yang dipilih user. */
  model: string;
  /** Storyboard Copilot mode aktif (toggle persisten atau slash command). */
  isStoryboardCopilotActive: boolean;
  /** Mode storyboard (kontrak storyboard_project aktif). */
  storyboardMode: boolean;
  /** Konteks storyboard aktif (JSON) -> dikirim sebagai context tambahan. */
  storyboardContext?: string;
  /** Prompt preset / instruksi current turn yang sudah di-expand. */
  expandedPrompt?: string;
}

export interface ChatTurnResult {
  taskPlan: TaskPlan;
  optimized: OptimizedContext;
  /** System prompt final siap kirim ke bridge / server. */
  systemPrompt: string;
  /** Project Memory sesi (setelah Possible update). */
  projectMemory: WeavyProjectMemory;
  /** True bila ada memori baru yang diekstrak dari instruksi user. */
  memoryUpdated: boolean;
}

/**
 * Membangun konteks eksekusi untuk satu turn chat.
 * Memperbarui Project Memory sesi bila user memberi direktif proyek eksplisit.
 */
export function prepareChatTurn(input: ChatTurnInput): ChatTurnResult {
  const {
    session,
    userMsg,
    model,
    isStoryboardCopilotActive,
    storyboardMode,
    storyboardContext,
    expandedPrompt,
  } = input;

  // 1. Klasifikasi task (Agent V1)
  const taskPlan = analyzeTask({
    text: userMsg.content,
    attachments: userMsg.attachments,
    session,
    isStoryboardCopilotActive,
  });

  // 2. Lifecycle Project Memory
  const memoryCandidates = extractProjectMemoryCandidate(userMsg.content);
  let memoryUpdated = false;
  if (memoryCandidates) {
    updateProjectMemory(session, memoryCandidates);
    memoryUpdated = true;
  }

  // 3. System prompt (Master Director + kontrak storyboard + katalog media + memory)
  const optimized = buildOptimizedContext({
    session: {
      ...session,
      messages: session.messages,
      metadata: session.metadata,
    },
    userMsg,
    taskPlan,
    provider: 'weavy',
    model,
    isStoryboardCopilotActive,
    masterSystemPrompt: '',
    storyboardContractBlock: '',
    expandedPrompt: expandedPrompt !== undefined ? expandedPrompt : userMsg.content,
  });

  // Master prompt dibangun setelah katalog media tersedia supaya blok katalog
  // (@imgX / @vidX) ikut di system prompt - sama seperti getMasterDirectorSystemPrompt.
  // Kontrak storyboard aktif bila Copilot aktif ATAU task terdeteksi storyboard
  // (parity dengan buildOptimizedContext di ekstensi).
  const isStoryboardActive =
    storyboardMode || taskPlan.taskType === TASK_TYPES.STORYBOARD_GENERATION;
  let systemPrompt = buildMasterDirectorSystemPrompt({
    provider: 'weavy',
    isStoryboardActive,
    sessionMediaCatalog: optimized.mediaCatalog,
  });

  // Project Memory + asset wajib (hasil context selector)
  const memoryPrompt = (optimized.systemPrompt || '').trim();
  if (memoryPrompt) systemPrompt += `\n\n${memoryPrompt}`;

  // Konteks storyboard aktif (revisi storyboard yang sudah ada)
  if (storyboardContext) systemPrompt += `\n\n${storyboardContext}`;

  return {
    taskPlan,
    optimized,
    systemPrompt,
    projectMemory: session.metadata?.projectMemory,
    memoryUpdated,
  };
}

export interface PostProcessInput {
  /** Balasan mentah dari model. */
  responseText: string;
  /** Storyboard project terakhir yang sudah disepakati di sesi ini. */
  existingProject: any | null;
}

export interface PostProcessResult {
  /** Teks final yang ditampilkan ke user. */
  content: string;
  /** Storyboard hasil merge lokal (null bila tidak ada aksi). */
  mergedProject: any | null;
  /** Jumlah scene yang diperbarui. */
  appliedCount: number;
}

/**
 * Post-processing balasan model.
 *
 * Hanya aksi EKSPLISIT yang ditangani di sini:
 *  - `update_scenes`            -> merge field-level ke storyboard yang ada.
 *  - `create_storyboard_project` -> dipakai kalau belum ada storyboard di sesi.
 *
 * Balasan yang memuat blok ```storyboard_project``` utuh TIDAK diubah -
 * model sudah wajib mengembalikan storyboard final lengkap (lama + revisi)
 * sesuai kontrak, jadi biarkan parser UI yang membacanya.
 */
export function postProcessWeavyResponse(input: PostProcessInput): PostProcessResult {
  const { responseText, existingProject } = input;
  const raw = String(responseText || '');
  if (!raw.trim()) return { content: raw, mergedProject: null, appliedCount: 0 };

  const { cleanText, action } = extractStoryboardCopilotAction(raw);
  if (!action) return { content: raw, mergedProject: null, appliedCount: 0 };

  const actionName = String(action.action || action.type || '').trim();

  if (actionName === 'update_scenes') {
    const merge = applyStoryboardSceneUpdate(existingProject, action);
    if (!merge.project || merge.appliedCount === 0) {
      return { content: raw, mergedProject: null, appliedCount: 0 };
    }
    const summary = `\n\n✅ **${merge.appliedCount} Scene berhasil diperbarui** oleh Copilot.`;
    return {
      content: `${cleanText}${summary}${renderStoryboardProjectBlock(merge.project)}`,
      mergedProject: merge.project,
      appliedCount: merge.appliedCount,
    };
  }

  if (actionName === 'create_storyboard_project') {
    const payload = action.project;
    if (!payload || !Array.isArray(payload.scenes) || payload.scenes.length === 0) {
      return { content: raw, mergedProject: null, appliedCount: 0 };
    }
    const project = existingProject ? { ...existingProject, ...payload } : payload;
    return {
      content: `${cleanText}${renderStoryboardProjectBlock(project)}`,
      mergedProject: project,
      appliedCount: payload.scenes.length,
    };
  }

  return { content: raw, mergedProject: null, appliedCount: 0 };
}
