// chat-provider-model.js - Provider & Model Catalog and Filter for Chat
import { executeDolaChat } from '../generator/dola-generation.js';
import { executeGeminiChat } from './gemini-chat.js';

export const WEAVY_ICON_URL =
  'https://cdn.prod.website-files.com/681b040781d5b5e278a69989/6829dad31872740b3fb4f912_favicon.svg';
export const DOLA_ICON_URL =
  'https://sf-flow-web-cdn.ciciai.com/obj/ocean-flow-web-sg/dola_web/favicon-dola.png';
export const GEMINI_ICON_URL =
  'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg';

export const CHAT_PROVIDERS = [
  {
    id: 'weavy',
    name: 'Weavy',
    label: 'Weavy',
    iconUrl: WEAVY_ICON_URL,
    defaultModel: 'google/gemini-3-pro',
  },
  {
    id: 'dola',
    name: 'Dola AI',
    label: 'Dola',
    iconUrl: DOLA_ICON_URL,
    defaultModel: 'dola/fast',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    label: 'Gemini',
    iconUrl: GEMINI_ICON_URL,
    defaultModel: 'gemini/gemini-2.5-pro',
  },
];

export const WEAVY_CHAT_MODELS = [
  {
    group: 'Google',
    options: [
      { value: 'google/gemini-3-pro', label: 'Gemini 3 Pro' },
      { value: 'google/gemini-3.1-pro', label: 'Gemini 3.1 Pro' },
      { value: 'google/gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
      { value: 'google/gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
      { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
    ],
  },
  {
    group: 'Anthropic',
    options: [
      { value: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5' },
      { value: 'anthropic/claude-opus-5', label: 'Claude Opus 5' },
      { value: 'anthropic/claude-opus-4-7', label: 'Claude Opus 4.7' },
      { value: 'anthropic/claude-opus-4-6', label: 'Claude Opus 4.6' },
      { value: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { value: 'anthropic/claude-haiku-4-5', label: 'Claude Haiku 4.5' },
    ],
  },
  {
    group: 'OpenAI',
    options: [
      { value: 'openai/gpt-5.6-sol', label: 'GPT-5.6 Sol' },
      { value: 'openai/gpt-5.6-terra', label: 'GPT-5.6 Terra' },
      { value: 'openai/gpt-5.6-luna', label: 'GPT-5.6 Luna' },
      { value: 'openai/gpt-4o', label: 'GPT-4o' },
      { value: 'openai/gpt-4.1', label: 'GPT-4.1' },
    ],
  },
  {
    group: 'Meta',
    options: [
      { value: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick' },
      { value: 'meta-llama/llama-4-scout', label: 'Llama 4 Scout' },
    ],
  },
];

export const DOLA_CHAT_MODELS = [
  {
    group: 'Dola AI (ByteDance)',
    options: [
      { value: 'dola/fast', label: '⚡ Dola Fast' },
      { value: 'dola/pro', label: '💎 Dola Pro' },
    ],
  },
];

export const GEMINI_CHAT_MODELS = [
  {
    group: 'Google Gemini (Web & Cloud)',
    options: [
      { value: 'gemini/gemini-3.6-flash', label: '⚡ 3.6 Flash (All-around help)' },
      { value: 'gemini/gemini-3.6-thinking', label: '🧠 3.6 Thinking (Solves complex problems)' },
      { value: 'gemini/gemini-3.1-pro', label: '💎 3.1 Pro (Advanced reasoning)' },
      { value: 'gemini/gemini-2.5-flash', label: '🚀 Gemini 2.5 Flash' },
      { value: 'gemini/gemini-2.5-pro', label: '✨ Gemini 2.5 Pro' },
    ],
  },
];

export function detectChatProvider(modelId) {
  if (typeof modelId === 'string' && modelId.startsWith('dola/')) {
    return 'dola';
  }
  if (typeof modelId === 'string' && modelId.startsWith('gemini/')) {
    return 'gemini';
  }
  return 'weavy';
}

export function getModelsForProvider(providerId) {
  if (providerId === 'dola') {
    return DOLA_CHAT_MODELS;
  }
  if (providerId === 'gemini') {
    return GEMINI_CHAT_MODELS;
  }
  return WEAVY_CHAT_MODELS;
}

export function renderChatModelOptions(selectEl, providerId, selectedModelId = null) {
  if (!selectEl) return;
  const groups = getModelsForProvider(providerId);
  selectEl.innerHTML = '';

  let hasFoundSelected = false;
  let firstOptionValue = null;

  groups.forEach((group) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.group;
    group.options.forEach((opt) => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (!firstOptionValue) firstOptionValue = opt.value;
      if (selectedModelId && opt.value === selectedModelId) {
        option.selected = true;
        hasFoundSelected = true;
      }
      optgroup.appendChild(option);
    });
    selectEl.appendChild(optgroup);
  });

  if (!hasFoundSelected && firstOptionValue) {
    selectEl.value = firstOptionValue;
  }
}

export async function initChatProviderModel({
  providerSelectEl,
  modelSelectEl,
  storage,
  onProviderChange,
  onModelChange,
}) {
  if (!providerSelectEl || !modelSelectEl) return null;

  // Custom UI elements
  const btnChatProviderDropdown = document.getElementById('btnChatProviderDropdown');
  const chatProviderPopover = document.getElementById('chatProviderPopover');
  const chatProviderActiveIcon = document.getElementById('chatProviderActiveIcon');
  const chatProviderActiveName = document.getElementById('chatProviderActiveName');
  const chatStoryboardCopilotToggle = document.getElementById('chatStoryboardCopilotToggle');
  const chatCopilotActiveBadge = document.getElementById('chatCopilotActiveBadge');
  const chatInputText = document.getElementById('chatInputText');
  const providerItemBtns = chatProviderPopover
    ? chatProviderPopover.querySelectorAll('.provider-item-btn')
    : document.querySelectorAll('#chatProviderPopover .provider-item-btn');

  function updateCustomProviderButtonUi(providerId) {
    const provConfig = CHAT_PROVIDERS.find((p) => p.id === providerId) || CHAT_PROVIDERS[0];
    if (chatProviderActiveIcon) {
      chatProviderActiveIcon.src = provConfig.iconUrl;
      chatProviderActiveIcon.alt = provConfig.name;
    }
    if (chatProviderActiveName) {
      chatProviderActiveName.textContent = provConfig.label;
    }

    providerItemBtns.forEach((btn) => {
      const pVal = btn.getAttribute('data-provider-val');
      const isSelected = pVal === providerId;
      btn.classList.toggle('active', isSelected);
      const checkIcon = btn.querySelector('.provider-item-check');
      if (checkIcon) {
        checkIcon.classList.toggle('hidden', !isSelected);
      }
    });
  }

  function updateCopilotToggleUi(enabled) {
    if (chatStoryboardCopilotToggle) {
      chatStoryboardCopilotToggle.checked = Boolean(enabled);
    }
    if (chatCopilotActiveBadge) {
      chatCopilotActiveBadge.classList.toggle('hidden', !enabled);
    }
    if (chatInputText) {
      if (enabled) {
        chatInputText.placeholder = 'Tanya ide, rancang alur video, atau ketik prompt storyboard...';
      } else {
        chatInputText.placeholder = 'Ketik / untuk skill atau paste gambar langsung di sini... (Enter / Ctrl+Enter)';
      }
    }
  }

  // Load saved copilot toggle state
  const savedCopilotEnabled = Boolean(await storage.get('weavy_chat_storyboard_copilot_enabled'));
  updateCopilotToggleUi(savedCopilotEnabled);

  chatStoryboardCopilotToggle?.addEventListener('change', async () => {
    const isEnabled = chatStoryboardCopilotToggle.checked;
    await storage.set('weavy_chat_storyboard_copilot_enabled', isEnabled);
    updateCopilotToggleUi(isEnabled);
    window.__weavyChatStoryboardCopilotEnabled = isEnabled;
  });
  window.__weavyChatStoryboardCopilotEnabled = savedCopilotEnabled;

  // Bind popover open/toggle
  btnChatProviderDropdown?.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close preset popover if open
    const presetMenuPopover = document.getElementById('presetMenuPopover');
    if (presetMenuPopover && !presetMenuPopover.classList.contains('hidden')) {
      presetMenuPopover.classList.add('hidden');
    }
    chatProviderPopover?.classList.toggle('hidden');
  });

  // Bind popover item selection
  providerItemBtns.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const chosen = btn.getAttribute('data-provider-val');
      if (!chosen) return;
      chatProviderPopover?.classList.add('hidden');

      if (providerSelectEl.value !== chosen) {
        providerSelectEl.value = chosen;
        providerSelectEl.dispatchEvent(new Event('change'));
      }
    });
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (
      chatProviderPopover &&
      !chatProviderPopover.contains(e.target) &&
      e.target !== btnChatProviderDropdown &&
      !btnChatProviderDropdown?.contains(e.target)
    ) {
      chatProviderPopover.classList.add('hidden');
    }
  });

  // Render provider options if empty or incomplete
  if (providerSelectEl.options.length < CHAT_PROVIDERS.length) {
    providerSelectEl.innerHTML = '';
    CHAT_PROVIDERS.forEach((prov) => {
      const opt = document.createElement('option');
      opt.value = prov.id;
      opt.textContent = prov.label;
      providerSelectEl.appendChild(opt);
    });
  }

  // Load saved state from storage
  let savedProvider = await storage.get('weavy_chat_provider');
  let savedModel = await storage.get('weavy_chat_model');

  // Fallback / validation
  if (!savedProvider) {
    if (savedModel && savedModel.startsWith('dola/')) {
      savedProvider = 'dola';
    } else if (savedModel && savedModel.startsWith('gemini/')) {
      savedProvider = 'gemini';
    } else {
      savedProvider = 'weavy';
    }
  }

  providerSelectEl.value = savedProvider;
  updateCustomProviderButtonUi(savedProvider);

  // Determine model for this provider
  let modelForProvider = await storage.get(`weavy_chat_model_${savedProvider}`);
  if (!modelForProvider) {
    if (savedModel && detectChatProvider(savedModel) === savedProvider) {
      modelForProvider = savedModel;
    } else {
      modelForProvider = savedProvider === 'dola' ? 'dola/fast' : (savedProvider === 'gemini' ? 'gemini/gemini-2.5-pro' : 'google/gemini-3-pro');
    }
  }

  renderChatModelOptions(modelSelectEl, savedProvider, modelForProvider);

  // Provider change listener
  providerSelectEl.addEventListener('change', async () => {
    const newProvider = providerSelectEl.value;
    updateCustomProviderButtonUi(newProvider);
    await storage.set('weavy_chat_provider', newProvider);

    // Retrieve saved model for this provider
    let targetModel = await storage.get(`weavy_chat_model_${newProvider}`);
    if (!targetModel) {
      targetModel = newProvider === 'dola' ? 'dola/fast' : (newProvider === 'gemini' ? 'gemini/gemini-2.5-pro' : 'google/gemini-3-pro');
    }

    renderChatModelOptions(modelSelectEl, newProvider, targetModel);
    await storage.set('weavy_chat_model', modelSelectEl.value);

    if (typeof onProviderChange === 'function') {
      onProviderChange(newProvider, modelSelectEl.value);
    }
  });

  // Model change listener
  modelSelectEl.addEventListener('change', async () => {
    const currentProvider = providerSelectEl.value;
    const currentModel = modelSelectEl.value;

    await storage.set(`weavy_chat_model_${currentProvider}`, currentModel);
    await storage.set('weavy_chat_model', currentModel);

    if (typeof onModelChange === 'function') {
      onModelChange(currentModel, currentProvider);
    }
  });

  return {
    getProvider: () => providerSelectEl.value,
    getModel: () => modelSelectEl.value,
    setProvider: async (providerId) => {
      if (providerSelectEl.value !== providerId) {
        providerSelectEl.value = providerId;
        updateCustomProviderButtonUi(providerId);
        providerSelectEl.dispatchEvent(new Event('change'));
      }
    },
    setModel: async (modelId) => {
      const neededProvider = detectChatProvider(modelId);
      if (providerSelectEl.value !== neededProvider) {
        providerSelectEl.value = neededProvider;
        updateCustomProviderButtonUi(neededProvider);
        await storage.set('weavy_chat_provider', neededProvider);
      }
      renderChatModelOptions(modelSelectEl, neededProvider, modelId);
      await storage.set(`weavy_chat_model_${neededProvider}`, modelId);
      await storage.set('weavy_chat_model', modelId);
    },
  };
}

export async function initStoryboardCopilotProviderModel({
  providerSelectEl,
  modelSelectEl,
  storage,
  onProviderChange,
  onModelChange,
}) {
  if (!modelSelectEl) return null;

  const btnProviderDropdown = document.getElementById('btnStoryboardCopilotProviderDropdown');
  const providerPopover = document.getElementById('storyboardCopilotProviderPopover');
  const providerActiveIcon = document.getElementById('sbCopilotProviderActiveIcon');
  const providerActiveName = document.getElementById('sbCopilotProviderActiveName');
  const providerItemBtns = providerPopover
    ? providerPopover.querySelectorAll('.sb-copilot-provider-item-btn, .provider-item-btn')
    : document.querySelectorAll('#storyboardCopilotProviderPopover .provider-item-btn');

  function updateCustomProviderButtonUi(providerId) {
    const provConfig = CHAT_PROVIDERS.find((p) => p.id === providerId) || CHAT_PROVIDERS[0];
    if (providerActiveIcon) {
      providerActiveIcon.src = provConfig.iconUrl;
      providerActiveIcon.alt = provConfig.name;
    }
    if (providerActiveName) {
      providerActiveName.textContent = provConfig.label;
    }

    providerItemBtns.forEach((btn) => {
      const pVal = btn.getAttribute('data-provider-val');
      const isSelected = pVal === providerId;
      btn.classList.toggle('active', isSelected);
      const checkIcon = btn.querySelector('.provider-item-check');
      if (checkIcon) {
        checkIcon.classList.toggle('hidden', !isSelected);
      }
    });
  }

  // Bind popover open/toggle
  btnProviderDropdown?.addEventListener('click', (e) => {
    e.stopPropagation();
    providerPopover?.classList.toggle('hidden');
  });

  // Bind popover item selection
  providerItemBtns.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const chosen = btn.getAttribute('data-provider-val');
      if (!chosen) return;
      providerPopover?.classList.add('hidden');

      if (providerSelectEl && providerSelectEl.value !== chosen) {
        providerSelectEl.value = chosen;
        providerSelectEl.dispatchEvent(new Event('change'));
      } else {
        await switchProvider(chosen);
      }
    });
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (
      providerPopover &&
      !providerPopover.contains(e.target) &&
      e.target !== btnProviderDropdown &&
      !btnProviderDropdown?.contains(e.target)
    ) {
      providerPopover.classList.add('hidden');
    }
  });

  // Render provider options on hidden select if exists
  if (providerSelectEl && providerSelectEl.options.length < CHAT_PROVIDERS.length) {
    providerSelectEl.innerHTML = '';
    CHAT_PROVIDERS.forEach((prov) => {
      const opt = document.createElement('option');
      opt.value = prov.id;
      opt.textContent = prov.label;
      providerSelectEl.appendChild(opt);
    });
  }

  // Load saved state from storage
  let savedProvider = storage?.get ? await storage.get('weavy_sb_copilot_provider') : null;
  let savedModel = storage?.get ? await storage.get('weavy_sb_copilot_model') : null;

  if (!savedProvider) {
    if (savedModel && savedModel.startsWith('dola/')) {
      savedProvider = 'dola';
    } else {
      savedProvider = 'weavy';
    }
  }

  if (providerSelectEl) {
    providerSelectEl.value = savedProvider;
  }
  updateCustomProviderButtonUi(savedProvider);

  let modelForProvider = storage?.get ? await storage.get(`weavy_sb_copilot_model_${savedProvider}`) : null;
  if (!modelForProvider) {
    if (savedModel && detectChatProvider(savedModel) === savedProvider) {
      modelForProvider = savedModel;
    } else {
      modelForProvider = savedProvider === 'dola' ? 'dola/fast' : 'google/gemini-2.5-flash';
    }
  }

  renderChatModelOptions(modelSelectEl, savedProvider, modelForProvider);

  async function switchProvider(newProvider) {
    updateCustomProviderButtonUi(newProvider);
    if (providerSelectEl) providerSelectEl.value = newProvider;
    if (storage?.set) await storage.set('weavy_sb_copilot_provider', newProvider);

    let targetModel = storage?.get ? await storage.get(`weavy_sb_copilot_model_${newProvider}`) : null;
    if (!targetModel) {
      targetModel = newProvider === 'dola' ? 'dola/fast' : (newProvider === 'gemini' ? 'gemini/gemini-2.5-pro' : 'google/gemini-2.5-flash');
    }

    renderChatModelOptions(modelSelectEl, newProvider, targetModel);
    if (storage?.set) await storage.set('weavy_sb_copilot_model', modelSelectEl.value);

    if (typeof onProviderChange === 'function') {
      onProviderChange(newProvider, modelSelectEl.value);
    }
  }

  if (providerSelectEl) {
    providerSelectEl.addEventListener('change', async () => {
      await switchProvider(providerSelectEl.value);
    });
  }

  modelSelectEl.addEventListener('change', async () => {
    const currentProvider = providerSelectEl?.value || (modelSelectEl.value.startsWith('dola/') ? 'dola' : 'weavy');
    const currentModel = modelSelectEl.value;

    if (storage?.set) {
      await storage.set(`weavy_sb_copilot_model_${currentProvider}`, currentModel);
      await storage.set('weavy_sb_copilot_model', currentModel);
    }

    if (typeof onModelChange === 'function') {
      onModelChange(currentModel, currentProvider);
    }
  });

  return {
    getProvider: () => providerSelectEl?.value || (modelSelectEl.value.startsWith('dola/') ? 'dola' : 'weavy'),
    getModel: () => modelSelectEl.value,
    setProvider: switchProvider,
    setModel: async (modelId) => {
      const neededProvider = detectChatProvider(modelId);
      if (providerSelectEl && providerSelectEl.value !== neededProvider) {
        providerSelectEl.value = neededProvider;
      }
      updateCustomProviderButtonUi(neededProvider);
      if (storage?.set) await storage.set('weavy_sb_copilot_provider', neededProvider);
      renderChatModelOptions(modelSelectEl, neededProvider, modelId);
      if (storage?.set) {
        await storage.set(`weavy_sb_copilot_model_${neededProvider}`, modelId);
        await storage.set('weavy_sb_copilot_model', modelId);
      }
    },
  };
}

/**
 * Mengirim pesan ke Dola AI menggunakan Silent Background Stream
 * Mendukung streaming live realtime dan fallback otomatis ke DOM execution
 */
export async function sendMessageToDola(prompt, {
  isPro = false,
  history = [],
  referenceAssets = [],
  conversationId = null,
  lastSectionId = null,
  lastMessageIndex = null,
  onProgress = () => {},
  onChunk = () => {},
  onDone = () => {},
  onError = () => {},
} = {}) {
  try {
    const result = await executeDolaChat({
      prompt,
      isPro,
      history,
      referenceAssets,
      conversationId,
      lastSectionId,
      lastMessageIndex,
      onProgress,
      onChunk,
    });
    const finalText = result && typeof result === 'object' ? (result.text || String(result)) : String(result);
    if (typeof onDone === 'function') {
      onDone(finalText, result);
    }
    return result;
  } catch (err) {
    if (typeof onError === 'function') {
      onError(err);
    }
    throw err;
  }
}

/**
 * Mengirim pesan ke Google Gemini (gemini.google.com)
 */
export async function sendMessageToGemini(prompt, {
  history = [],
  referenceAssets = [],
  onProgress = () => {},
  onChunk = () => {},
  onDone = () => {},
  onError = () => {},
} = {}) {
  try {
    const result = await executeGeminiChat({
      prompt,
      history,
      referenceAssets,
      onProgress,
      onChunk,
    });
    if (typeof onDone === 'function') {
      onDone(result);
    }
    return result;
  } catch (err) {
    if (typeof onError === 'function') {
      onError(err);
    }
    throw err;
  }
}

