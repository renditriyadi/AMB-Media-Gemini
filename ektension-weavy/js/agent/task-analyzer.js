// task-analyzer.js - Task & Intent Analyzer for Agent V1 Orchestrator
// Analyzes user instructions, detects intent, and determines orchestration requirements

import { isStoryboardPresetCommand } from '../chat/chat-presets.js';

/**
 * Supported internal task types
 */
export const TASK_TYPES = {
  SIMPLE_CHAT: 'simple_chat',
  CREATIVE_GENERATION: 'creative_generation',
  IMAGE_GENERATION: 'image_generation',
  IMAGE_EDITING: 'image_editing',
  VIDEO_GENERATION: 'video_generation',
  STORYBOARD_GENERATION: 'storyboard_generation',
  PROMPT_GENERATION: 'prompt_generation',
  ANALYSIS: 'analysis',
  TRANSFORMATION: 'transformation',
  MULTI_STEP_TASK: 'multi_step_task',
};

/**
 * Analyzes the user query and attachments to produce a structured Task Execution Plan
 * @param {Object} params
 * @param {string} params.text - User input prompt
 * @param {Array} params.attachments - Current attached images/videos
 * @param {Object} params.session - Canonical chat session
 * @param {boolean} params.isStoryboardCopilotActive - Storyboard copilot flag
 * @returns {Object} Task Plan
 */
export function analyzeTask(params = {}) {
  let text = '';
  let attachments = [];
  let session = null;
  let isStoryboardCopilotActive = false;

  if (typeof params === 'string') {
    text = params;
  } else if (params && typeof params === 'object') {
    text = params.text || '';
    attachments = params.attachments || [];
    session = params.session || null;
    isStoryboardCopilotActive = Boolean(params.isStoryboardCopilotActive);
  }

  const cleanText = (text || '').trim();
  const lowerText = cleanText.toLowerCase();
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  const hasVideoAttachment = hasAttachments && attachments.some((a) => a.type === 'video' || (a.name && /\.(mp4|mov|webm)$/i.test(a.name)));

  // 1. Check for Multi-step tasks
  const multiStepMatches = detectMultiStepIntent(cleanText);
  if (multiStepMatches && multiStepMatches.length > 1) {
    return {
      taskType: TASK_TYPES.MULTI_STEP_TASK,
      requiresAgent: true,
      isMultiStep: true,
      steps: multiStepMatches.map((stepDesc, idx) => ({
        stepIndex: idx + 1,
        type: classifySingleStep(stepDesc),
        instruction: stepDesc,
        status: 'queued',
      })),
      contextRequired: true,
      projectMemoryRequired: true,
      assetsRequired: hasAttachments,
      executionMode: 'multi_step',
    };
  }

  // 2. Storyboard Generation / Breakdown
  if (
    isStoryboardCopilotActive ||
    isStoryboardPresetCommand(cleanText) ||
    /^\/(customstoryboard|copilotstoryboard|storyboardcopilot)\b/i.test(cleanText) ||
    /(buat|rancang|susun|generate|bikin|jadikan).*(storyboard|alur adegan|scene breakdown|naskah video iklan)/i.test(lowerText) ||
    /(storyboard.*scene|naskah.*vo|breakdown.*shot)/i.test(lowerText)
  ) {
    return {
      taskType: TASK_TYPES.STORYBOARD_GENERATION,
      requiresAgent: true,
      isMultiStep: false,
      steps: [
        {
          stepIndex: 1,
          type: TASK_TYPES.STORYBOARD_GENERATION,
          instruction: cleanText,
          status: 'queued',
        },
      ],
      contextRequired: true,
      projectMemoryRequired: true,
      assetsRequired: hasAttachments,
      executionMode: 'orchestrated',
    };
  }

  // 3. Prompt Crafting & Image Generation Directives
  if (
    /(prompt|weavy_generate|midjourney|flux|generate gambar|buat gambar|hasilkan foto|desain visual)/i.test(lowerText)
  ) {
    return {
      taskType: TASK_TYPES.PROMPT_GENERATION,
      requiresAgent: true,
      isMultiStep: false,
      steps: [{ stepIndex: 1, type: TASK_TYPES.PROMPT_GENERATION, instruction: cleanText, status: 'queued' }],
      contextRequired: true,
      projectMemoryRequired: true,
      assetsRequired: hasAttachments,
      executionMode: 'orchestrated',
    };
  }

  // 4. Video & Multimodal Deep Analysis
  if (
    hasVideoAttachment ||
    /(analisis|bedah|kenapa viral|bongkar|deep research|evaluasi|review visual|audit)/i.test(lowerText)
  ) {
    return {
      taskType: TASK_TYPES.ANALYSIS,
      requiresAgent: true,
      isMultiStep: false,
      steps: [{ stepIndex: 1, type: TASK_TYPES.ANALYSIS, instruction: cleanText, status: 'queued' }],
      contextRequired: true,
      projectMemoryRequired: false,
      assetsRequired: hasAttachments,
      executionMode: 'orchestrated',
    };
  }

  // 5. Creative Generation (ad concepts, copywriting angles, marketing hooks)
  if (
    /(buat|bikin|ide|konsep|sudut pandang|angle|hook|copywriting|naskah iklan|ide konten|campaign)/i.test(lowerText) &&
    cleanText.length > 20
  ) {
    return {
      taskType: TASK_TYPES.CREATIVE_GENERATION,
      requiresAgent: true,
      isMultiStep: false,
      steps: [{ stepIndex: 1, type: TASK_TYPES.CREATIVE_GENERATION, instruction: cleanText, status: 'queued' }],
      contextRequired: true,
      projectMemoryRequired: true,
      assetsRequired: hasAttachments,
      executionMode: 'orchestrated',
    };
  }

  // 6. Transformation (rewrite, summarize, translate, edit existing concept)
  if (
    /(ubah|ganti|perbaiki|tulis ulang|singkat|panjangkan|format ulang|sesuaikan|revisi)/i.test(lowerText)
  ) {
    return {
      taskType: TASK_TYPES.TRANSFORMATION,
      requiresAgent: true,
      isMultiStep: false,
      steps: [{ stepIndex: 1, type: TASK_TYPES.TRANSFORMATION, instruction: cleanText, status: 'queued' }],
      contextRequired: true,
      projectMemoryRequired: false,
      assetsRequired: hasAttachments,
      executionMode: 'orchestrated',
    };
  }

  // 7. Simple / Direct Chat (e.g. "Halo", "Apa itu storyboard?", "Jelaskan istilah X")
  return {
    taskType: TASK_TYPES.SIMPLE_CHAT,
    requiresAgent: false,
    isMultiStep: false,
    steps: [{ stepIndex: 1, type: TASK_TYPES.SIMPLE_CHAT, instruction: cleanText, status: 'queued' }],
    contextRequired: false,
    projectMemoryRequired: false,
    assetsRequired: hasAttachments,
    executionMode: 'direct',
  };
}

/**
 * Helper to detect multi-step commands connected by sequential conjunctions
 */
function detectMultiStepIntent(text = '') {
  if (!text || text.length < 30) return null;

  // Check for conjunction patterns: "lalu", "kemudian", "setelah itu", "step 1... step 2"
  const stepSplitters = /(?:\r?\n\s*(?:langkah|\d+[\.\)]|step\s*\d+)\s*|\s+(?:lalu|kemudian|setelah itu|lanjutkan dengan)\s+)/i;

  if (stepSplitters.test(text)) {
    const rawParts = text.split(stepSplitters).map((p) => p.trim()).filter((p) => p.length > 5);
    if (rawParts.length >= 2) {
      return rawParts;
    }
  }

  return null;
}

/**
 * Classifies an individual sub-step within a multi-step task
 */
function classifySingleStep(stepText = '') {
  const lower = (stepText || '').toLowerCase();
  if (/(storyboard|scene|adegan|naskah|shot list)/i.test(lower)) {
    return TASK_TYPES.STORYBOARD_GENERATION;
  }
  if (/(gambar|visual|prompt|foto|desain)/i.test(lower)) {
    return TASK_TYPES.PROMPT_GENERATION;
  }
  if (/(konsep|ide|hook|copywriting|naskah)/i.test(lower)) {
    return TASK_TYPES.CREATIVE_GENERATION;
  }
  if (/(analisis|bedah|review)/i.test(lower)) {
    return TASK_TYPES.ANALYSIS;
  }
  return TASK_TYPES.TRANSFORMATION;
}
