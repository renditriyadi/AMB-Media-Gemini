// agent-orchestrator.js - Agent V1 Orchestrator Core
// Intelligent coordination layer between Canonical Chat and Provider Router

import { analyzeTask, TASK_TYPES } from './task-analyzer.js';
import { WorkingMemory, updateProjectMemory, extractProjectMemoryCandidate } from './memory-manager.js';
import { buildOptimizedContext } from './context-selector.js';
import { normalizeProviderResponse } from './response-normalizer.js';
import { routeAndExecuteProvider } from './provider-router.js';

/**
 * Sanitized internal agent logging (never logs API keys, idTokens, or sensitive headers)
 */
function logAgentEvent(action, details = {}) {
  const safeDetails = { ...details };
  delete safeDetails.apiKey;
  delete safeDetails.idToken;
  delete safeDetails.refreshToken;
  delete safeDetails.cookie;

  console.log(`[Agent V1 Orchestrator] ${action}:`, safeDetails);
}

/**
 * Executes a chat turn orchestrated by Agent V1
 * @param {Object} params
 * @param {Object} params.session - Canonical Chat Session (Source of Truth)
 * @param {Object} params.userMsg - Canonical User Message
 * @param {string} params.provider - Target provider ('gemini' | 'dola' | 'weavy')
 * @param {string} params.model - Target model name
 * @param {string} params.apiKey - Optional Gemini API key
 * @param {string} params.idToken - Weavy ID token
 * @param {string} params.refreshToken - Weavy refresh token
 * @param {Function} params.callWeavyLLMFn - Weavy backend LLM caller
 * @param {boolean} params.isStoryboardCopilotActive - Storyboard copilot flag
 * @param {string} params.scrapingContext - Live scraping metadata
 * @param {string} params.libraryKnowledgePrompt - Knowledge base prompt
 * @param {Function} params.onProgress - Progress callback (pct, msg)
 * @param {Function} params.onChunk - Streaming token chunk callback
 * @param {AbortSignal} params.abortSignal - Abort signal
 * @returns {Promise<Object>} Normalized Canonical Assistant Result
 */
export async function executeAgentTurn({
  session,
  userMsg,
  provider = 'weavy',
  model = 'google/gemini-3-pro',
  apiKey = null,
  idToken = null,
  refreshToken = null,
  callWeavyLLMFn = null,
  isStoryboardCopilotActive = false,
  scrapingContext = null,
  libraryKnowledgePrompt = '',
  onProgress = () => {},
  onChunk = () => {},
  abortSignal = null,
  fallbackAllowed = true,
}) {
  logAgentEvent('request_received', {
    sessionId: session?.id,
    provider,
    model,
    promptLength: userMsg?.content?.length || 0,
    attachmentsCount: userMsg?.attachments?.length || 0,
  });

  // 1. Task & Intent Analysis
  const taskPlan = analyzeTask({
    text: userMsg?.content || '',
    attachments: userMsg?.attachments || [],
    session,
    isStoryboardCopilotActive,
  });

  logAgentEvent('task_classification', {
    taskType: taskPlan.taskType,
    requiresAgent: taskPlan.requiresAgent,
    executionMode: taskPlan.executionMode,
    isMultiStep: taskPlan.isMultiStep,
  });

  // 2. Project Memory Lifecycle: Extract persistent directives if explicitly stated by user
  const memoryCandidates = extractProjectMemoryCandidate(userMsg?.content || '');
  if (memoryCandidates) {
    updateProjectMemory(session, memoryCandidates);
    logAgentEvent('memory_selection', {
      extractedKeys: Object.keys(memoryCandidates),
    });
  }

  const credentials = {
    apiKey,
    idToken,
    refreshToken,
    callWeavyLLMFn,
  };

  // 3. Direct fast path for simple chat (e.g. greetings, simple Q&A)
  if (!taskPlan.requiresAgent && !taskPlan.isMultiStep) {
    const directContext = buildOptimizedContext({
      session,
      userMsg,
      taskPlan,
      provider,
      model,
      isStoryboardCopilotActive,
      scrapingContext,
      libraryKnowledgePrompt,
    });

    onProgress(30, 'Menghubungi AI...');

    const execResult = await routeAndExecuteProvider({
      provider,
      model,
      taskType: taskPlan.taskType,
      normalizedContext: directContext,
      credentials,
      fallbackAllowed,
      onProgress,
      onChunk,
      abortSignal,
      onStateChange: (state) => {
        logAgentEvent('execution_state_change', { status: state.status, provider: state.provider, attempt: state.attempt });
      },
    });

    return normalizeProviderResponse({
      rawResult: execResult,
      provider: execResult.executionState?.provider || provider,
      model: execResult.executionState?.model || model,
      taskType: taskPlan.taskType,
      metadata: {
        ...directContext.metadata,
        executionState: execResult.executionState,
      },
    });
  }

  // 4. Orchestrated Execution Path (with Working Memory & Multi-Step coordination)
  const workingMemory = new WorkingMemory(session?.id, taskPlan.taskType);
  const steps = taskPlan.steps || [{ stepIndex: 1, type: taskPlan.taskType, instruction: userMsg?.content || '' }];
  workingMemory.setStep(1, steps.length);

  let accumulatedContent = '';
  let lastProviderResult = null;

  for (let i = 0; i < steps.length; i++) {
    if (abortSignal?.aborted) {
      logAgentEvent('execution_cancelled', { step: i + 1 });
      break;
    }

    const currentStep = steps[i];
    workingMemory.setStep(currentStep.stepIndex, steps.length);

    if (steps.length > 1) {
      onProgress(
        Math.round(((i + 1) / steps.length) * 80),
        `Agent Orchestrator: Menjalankan Tahap ${i + 1}/${steps.length} (${currentStep.type})...`
      );
    } else {
      onProgress(35, 'Agent Orchestrator: Mengoptimasi konteks dan memori...');
    }

    // Prepare optimized context for the active step
    const stepMsg = {
      ...userMsg,
      content: currentStep.instruction || userMsg?.content || '',
    };

    const stepContext = buildOptimizedContext({
      session,
      userMsg: stepMsg,
      taskPlan: {
        ...taskPlan,
        taskType: currentStep.type,
      },
      workingMemory,
      provider,
      model,
      isStoryboardCopilotActive: isStoryboardCopilotActive || currentStep.type === TASK_TYPES.STORYBOARD_GENERATION,
      scrapingContext,
      libraryKnowledgePrompt,
    });

    logAgentEvent('execution_started', { step: i + 1, taskType: currentStep.type, provider, model });

    // Execute through Provider Router
    const stepResult = await routeAndExecuteProvider({
      provider,
      model,
      taskType: currentStep.type,
      normalizedContext: stepContext,
      credentials,
      fallbackAllowed,
      onProgress,
      onChunk: (chunk) => {
        if (steps.length === 1) {
          onChunk(chunk);
        }
      },
      abortSignal,
      onStateChange: (state) => {
        logAgentEvent('execution_state_change', {
          step: i + 1,
          status: state.status,
          provider: state.provider,
          attempt: state.attempt,
          fallbackTriggered: state.fallbackTriggered,
        });
      },
    });

    logAgentEvent('execution_completed', { step: i + 1, provider: stepResult.executionState?.provider || provider });

    lastProviderResult = stepResult;
    const stepText = typeof stepResult === 'string' ? stepResult : (stepResult?.content || '');
    workingMemory.recordStepOutput(currentStep.stepIndex, stepText);

    if (steps.length > 1) {
      accumulatedContent += (accumulatedContent ? '\n\n' : '') + stepText;
    } else {
      accumulatedContent = stepText;
    }
  }

  workingMemory.complete();

  // Normalize final result
  const finalProvider = lastProviderResult?.executionState?.provider || provider;
  const finalModel = lastProviderResult?.executionState?.model || model;

  const normalizedOutput = normalizeProviderResponse({
    rawResult: {
      content: accumulatedContent,
      updatedRuntime: lastProviderResult?.updatedRuntime,
      executedAt: new Date().toISOString(),
    },
    provider: finalProvider,
    model: finalModel,
    taskType: taskPlan.taskType,
    metadata: {
      taskPlan,
      isOrchestrated: true,
      totalSteps: steps.length,
      executionState: lastProviderResult?.executionState,
    },
  });

  logAgentEvent('normalization_completed', {
    taskType: taskPlan.taskType,
    outputLength: normalizedOutput.content.length,
    finalProvider,
  });

  return normalizedOutput;
}
