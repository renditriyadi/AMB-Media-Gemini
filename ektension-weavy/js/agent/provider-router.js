// provider-router.js - Provider Router & Execution Engine for Agent V1
// Manages Capability Matrix, Provider Selection, Availability, Retry, and Fallback Policies

import { executeGeminiAdapter, executeDolaAdapter, executeWeavyAdapter } from '../chat/provider-adapters.js';

/**
 * Provider Capability Matrix based on active codebase implementations
 */
export const PROVIDER_CAPABILITIES = {
  gemini: {
    text: true,
    creativeGeneration: true,
    structuredOutput: true,
    imageGeneration: true,
    imageEditing: true,
    videoGeneration: false,
    multimodalAnalysis: true,
    streaming: true,
  },
  weavy: {
    text: true,
    creativeGeneration: true,
    structuredOutput: true,
    imageGeneration: true,
    imageEditing: true,
    videoGeneration: true,
    multimodalAnalysis: true,
    streaming: false,
  },
  dola: {
    text: true,
    creativeGeneration: true,
    structuredOutput: true,
    imageGeneration: false,
    imageEditing: false,
    videoGeneration: true,
    multimodalAnalysis: true,
    streaming: true,
  },
};

/**
 * Default Fallback Policy across providers
 */
export const DEFAULT_FALLBACK_POLICY = {
  gemini: ['weavy', 'dola'],
  dola: ['weavy', 'gemini'],
  weavy: ['gemini', 'dola'],
};

/**
 * Checks if a specific task or required capability is supported by a provider
 * @param {string} provider - 'gemini' | 'weavy' | 'dola'
 * @param {string|Array<string>} capabilities - Required capability or array of capabilities
 * @returns {boolean}
 */
export function checkProviderCapability(provider, capabilities = []) {
  const provCaps = PROVIDER_CAPABILITIES[provider];
  if (!provCaps) return false;

  const reqCaps = Array.isArray(capabilities) ? capabilities : [capabilities];
  if (reqCaps.length === 0) return true;

  return reqCaps.every((cap) => {
    if (!cap) return true;
    return provCaps[cap] === true;
  });
}

/**
 * Determines required capabilities from task type
 * @param {string} taskType
 * @returns {Array<string>}
 */
export function getRequiredCapabilitiesForTask(taskType) {
  switch (taskType) {
    case 'image_generation':
      return ['imageGeneration'];
    case 'image_editing':
      return ['imageEditing'];
    case 'video_generation':
      return ['videoGeneration'];
    case 'storyboard_generation':
      return ['text', 'structuredOutput'];
    case 'creative_generation':
    case 'prompt_generation':
    case 'analysis':
    case 'transformation':
    case 'simple_chat':
    default:
      return ['text'];
  }
}

/**
 * Resolves the primary provider and valid fallback chain based on task capabilities and credentials
 * @param {Object} params
 * @param {string} params.preferredProvider - Provider requested by user or context
 * @param {string} params.taskType - Task classification type
 * @param {Object} params.credentials - { apiKey, idToken, refreshToken }
 * @returns {Object} { primaryProvider, fallbackChain }
 */
export function resolveProviderRouting({
  preferredProvider = 'weavy',
  taskType = 'simple_chat',
  credentials = {},
}) {
  const reqCaps = getRequiredCapabilitiesForTask(taskType);
  const normalizedPreferred = (preferredProvider || 'weavy').toLowerCase();

  // Determine availability based on credentials / provider requirements
  const isGeminiAvailable = Boolean(credentials.apiKey || true); // Gemini fallback via server proxy exists
  const isWeavyAvailable = Boolean(credentials.idToken || credentials.refreshToken || credentials.callWeavyLLMFn);
  const isDolaAvailable = true; // Guest / web session supported

  const availabilityMap = {
    gemini: isGeminiAvailable,
    weavy: isWeavyAvailable,
    dola: isDolaAvailable,
  };

  // Check if preferred provider is capable and available
  let primaryProvider = normalizedPreferred;
  if (!checkProviderCapability(primaryProvider, reqCaps) || !availabilityMap[primaryProvider]) {
    // Select first capable and available provider
    const candidates = ['gemini', 'weavy', 'dola'];
    const bestFit = candidates.find((p) => checkProviderCapability(p, reqCaps) && availabilityMap[p]);
    if (bestFit) {
      primaryProvider = bestFit;
    }
  }

  // Construct fallback chain
  const potentialFallbacks = DEFAULT_FALLBACK_POLICY[primaryProvider] || ['weavy'];
  const fallbackChain = potentialFallbacks.filter((p) => {
    return p !== primaryProvider && checkProviderCapability(p, reqCaps) && availabilityMap[p];
  });

  return {
    primaryProvider,
    requiredCapabilities: reqCaps,
    fallbackChain,
  };
}

/**
 * Checks if an error is considered retryable (transient) or non-retryable (permanent)
 * @param {Error|string} error
 * @returns {boolean}
 */
export function isRetryableError(error) {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();

  // Non-retryable: permanent auth failures, explicit bad requests, missing required assets, cancellation
  if (
    msg.includes('unauthorized') ||
    msg.includes('token expired') ||
    msg.includes('api key is required') ||
    msg.includes('invalid api key') ||
    msg.includes('unsupported task') ||
    msg.includes('missing required asset') ||
    msg.includes('asset tidak ditemukan') ||
    msg.includes('dibatalkan oleh pengguna') ||
    msg.includes('aborted')
  ) {
    return false;
  }

  // Retryable: transient network resets, 503/502, timeouts, rate limits
  if (
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('fetch failed') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('rate limit') ||
    msg.includes('temporarily unavailable')
  ) {
    return true;
  }

  return false;
}

/**
 * Provider Router Execution Unit
 * Dispatches normalized context to the designated provider adapter with controlled retry and fallback.
 * @param {Object} params
 * @param {string} params.provider - Primary provider
 * @param {string} params.model - Model ID
 * @param {string} params.taskType - Task type
 * @param {Object} params.normalizedContext - Context payload
 * @param {Object} params.credentials - { apiKey, idToken, refreshToken, callWeavyLLMFn }
 * @param {boolean} params.fallbackAllowed - Whether to allow fallback to other providers
 * @param {Function} params.onProgress - Progress callback
 * @param {Function} params.onChunk - Stream chunk callback
 * @param {AbortSignal} params.abortSignal - Abort signal
 * @param {Function} params.onStateChange - Callback on execution state changes
 * @returns {Promise<Object>} Execution result with state
 */
export async function routeAndExecuteProvider({
  provider = 'weavy',
  model = 'google/gemini-3-pro',
  taskType = 'simple_chat',
  normalizedContext,
  credentials = {},
  fallbackAllowed = true,
  onProgress = () => {},
  onChunk = () => {},
  abortSignal = null,
  onStateChange = () => {},
}) {
  const routing = resolveProviderRouting({
    preferredProvider: provider,
    taskType,
    credentials,
  });

  const executionState = {
    executionId: `exec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    taskType,
    provider: routing.primaryProvider,
    model,
    status: 'queued',
    attempt: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    fallbackTriggered: false,
    fallbackFrom: null,
    error: null,
  };

  const updateState = (newStatus, extra = {}) => {
    executionState.status = newStatus;
    Object.assign(executionState, extra);
    if (newStatus === 'completed' || newStatus === 'failed' || newStatus === 'cancelled') {
      executionState.completedAt = new Date().toISOString();
    }
    onStateChange({ ...executionState });
  };

  updateState('processing', { attempt: 1 });

  const providersToAttempt = [routing.primaryProvider, ...(fallbackAllowed ? routing.fallbackChain : [])];

  let lastError = null;

  for (let pIdx = 0; pIdx < providersToAttempt.length; pIdx++) {
    const currentProvider = providersToAttempt[pIdx];
    const isFallback = pIdx > 0;

    if (isFallback) {
      executionState.fallbackTriggered = true;
      executionState.fallbackFrom = providersToAttempt[0];
      executionState.provider = currentProvider;
      onProgress(50, `Beralih eksekusi ke provider ${currentProvider.toUpperCase()}...`);
    }

    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      if (abortSignal?.aborted) {
        updateState('cancelled');
        throw new Error('Eksekusi dibatalkan oleh pengguna');
      }

      attempts++;
      executionState.attempt = attempts;

      try {
        let result = null;

        if (currentProvider === 'gemini') {
          result = await executeGeminiAdapter({
            normalizedContext,
            model: model.startsWith('gemini/') ? model : 'gemini/gemini-2.5-pro',
            apiKey: credentials.apiKey,
            onProgress,
            onChunk,
            abortSignal,
          });
        } else if (currentProvider === 'dola') {
          result = await executeDolaAdapter({
            normalizedContext,
            model: model.startsWith('dola/') ? model : 'dola/fast',
            onProgress,
            onChunk,
            abortSignal,
          });
        } else {
          result = await executeWeavyAdapter({
            normalizedContext,
            model,
            callWeavyLLMFn: credentials.callWeavyLLMFn,
            idToken: credentials.idToken,
            refreshToken: credentials.refreshToken,
            onProgress,
            abortSignal,
          });
        }

        updateState('completed');
        return {
          ...result,
          executionState,
        };
      } catch (err) {
        lastError = err;
        executionState.error = err.message || String(err);

        // Check retry eligibility
        if (attempts < maxAttempts && isRetryableError(err)) {
          onProgress(40, `Koneksi ${currentProvider} terputus, mencoba kembali (percobaan ${attempts + 1})...`);
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        // If not retryable or max attempts exhausted, break out of inner loop to try fallback provider
        break;
      }
    }
  }

  updateState('failed', { error: lastError?.message || 'Provider execution failed' });
  throw lastError || new Error('All provider execution routes failed');
}
