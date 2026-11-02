import { storage } from './js/core/storage.js';
import { WEAVY_API_BASE, callWeavyApi, getWeavyClientHeaders } from './js/core/api.js';
import { countImportAccounts, parseAccountsFromJson, parseRefreshTokensFromTxt, parseImportAccounts } from './js/account/account-import.js';
import { getActiveAccount as selectActiveAccount, getProviderLabel, getProviderAccounts, loadAccountState, saveAccountState } from './js/account/account-manager.js';
import { renderAccountCardHtml, renderAccountDropdownItemHtml, renderAccountStats, renderHeaderAccount as renderAccountHeader } from './js/account/account-view.js';
import { bindAccountEvents } from './js/account/account-events.js';
import { bindAccountImportUi } from './js/account/account-import-ui.js';
import {
  logoutWeavyTabSession as logoutAccountSession,
  syncActiveAccountCookie as syncAccountCookie,
  syncAccountSessionToBrowserTab as syncAccountSessionToBrowserTabModule,
} from './js/account/account-session.js';
import {
  exchangeRefreshToken as exchangeRefreshTokenHelper,
  fetchUserCreditsFromWeavy as fetchUserCreditsFromWeavyHelper,
  fetchUserCreditsFromDola as fetchUserCreditsFromDolaHelper,
  getTodayLocalDateStr as getTodayLocalDateStrHelper,
  getValidIdToken as getValidIdTokenHelper,
  syncCookiesToBrowser as syncCookiesToBrowserHelper,
  reloadWeavyTabAndWait as reloadWeavyTabAndWaitHelper,
  recoverWeavySessionOn403 as recoverWeavySessionOn403Helper,
} from './js/account/account-auth.js';
import { getValidImageFiles } from './js/generator/image-generator.js';
import { escapeHtml, parseJwt } from './js/core/utils.js';
import { extractMediaUrlFromObject, extractTextFromResult } from './js/core/response-parsers.js';
import { buildSessionMediaCatalog, detectEcommerceProductLinks, fetchLinkMetadata, resolveLinksMetadata, formatScrapingContext, extractKeyframesFromVideoBlob, extractYouTubeVideoId, extractTikTokVideoId, extractInstagramMediaId, isImageLoadable, filterValidImageObjects } from './js/chat/chat-media.js';
import { createChatSessionRecord, getCurrentChatSession, persistChatSessions, normalizeChatSession } from './js/chat/chat-session.js';
import { buildNormalizedConversationContext, getMasterDirectorSystemPrompt } from './js/chat/context-builder.js';
import { buildNativeChatSupplementalContext } from './js/chat/chat-prompt-context.js';
import { executeWeavyChatRecipe } from './js/chat/weavy-chat-recipe.js';
import { executeConversationTurn } from './js/chat/provider-adapters.js';
import { executeAgentTurn } from './js/agent/agent-orchestrator.js';
import { initChatProviderModel, initStoryboardCopilotProviderModel } from './js/chat/chat-provider-model.js';
import { formatMarkdown as formatChatMarkdown, buildSceneClipboardText } from './js/chat/chat-render.js';
import { DOLA_IMAGE_MODELS_V2, DOLA_VIDEO_MODELS_V2, FLOW_IMAGE_MODELS_V2, FLOW_VIDEO_MODELS_V2, IMAGE_MODELS_V2, VIDEO_MODELS_V2, getModelIconHtml } from './js/generator/model-catalog.js';
import { buildRecentGenerationRecord, createRecentGenerationCardHtml, isRecentGenerationVideo } from './js/generator/recent-generations.js';
import { renderAllHistoryModalUi, showMediaLightboxUi } from './js/generator/generation-history-ui.js';
import { handleAddGenRefFiles as handleAddGenRefFilesHelper, renderGenRefGalleryUi } from './js/generator/reference-gallery.js';
import { initGenerateWorkspaceV2 as initGenerateWorkspaceV2Helper } from './js/generator/generation-workspace.js';
import { executeFlowImageGeneration, executeFlowVideoGeneration, readFlowReferenceFiles } from './js/generator/flow-generation.js';
import { executeDolaImageGeneration, executeDolaVideoGeneration, readDolaReferenceFiles, executeDolaChat, createDolaNewChatSessionInTab } from './js/generator/dola-generation.js';
import { executeGeminiChat, createGeminiNewChatSessionInTab, switchGeminiModelInTab } from './js/chat/gemini-chat.js';
import { bindGeneratorSettingsModal } from './js/generator/settings-modal.js';
import { bindRecentGenerationActions, reuseRecentGenerationSettings } from './js/generator/recent-generation-actions.js';
import { renderRecentGenerationsUi } from './js/generator/recent-generations-ui.js';
import { renderLibraryUi } from './js/library/library-view.js';
import { openImageSourcePicker as openImageSourcePickerUi } from './js/library/image-source-picker.js';
import { openAssetMetadataModal } from './js/library/asset-metadata-modal.js';
import { buildLibraryKnowledgePrompt } from './js/library/asset-knowledge.js';
import { initStoryboardCopilot } from './js/storyboard/storyboard-copilot.js';
import {
  snapshotStoryboardAsset as snapshotStoryboardAssetHelper,
  getStoryboardFormSnapshot as getStoryboardFormSnapshotHelper,
  applyStoryboardReferencePreview as applyStoryboardReferencePreviewHelper,
  restoreStoryboardFormState as restoreStoryboardFormStateHelper,
  resetStoryboardWorkspaceState as resetStoryboardWorkspaceStateHelper,
  getStoryboardFormulaLabelMap,
  updateDynamicSceneText as updateDynamicSceneTextHelper,
  getStoryboardCopilotContext as getStoryboardCopilotContextHelper,
  getStoryboardCopilotImages as getStoryboardCopilotImagesHelper,
  recommendStoryboardImageModel as recommendStoryboardImageModelHelper,
  getStoryboardImageModel as getStoryboardImageModelHelper,
} from './js/storyboard/storyboard-workspace.js';
import {
  buildStoryboardReview,
  buildStoryboardCopilotIntentAction,
  extractStoryboardCopilotAction,
  extractStoryboardParamsFromText,
  buildSmartReferencesMapping,
  getCopilotReferenceAsset,
  getReferenceByRole,
  resolveCopilotReference,
} from './js/storyboard/storyboard-intent.js';
import {
  displayAnalysisCardUi,
  renderSavedStoryboardsUi,
  renderSceneCardHtml as renderSceneCardHtmlHelper,
  renderStoryboardProjectUi,
  showCopyTooltipUi,
  updateCompletedBadgeUi,
} from './js/storyboard/storyboard-render.js';
import {
  bindSceneCardInteractions as bindSceneCardInteractionsHelper,
  updateCompletedBadgeUi as updateCompletedBadgeUiHelper,
} from './js/storyboard/storyboard-actions.js';
import { expandChatPreset, expandDolaChatPreset } from './js/chat/chat-presets.js';
import {
  collectStoryboardRefImages as collectStoryboardRefImagesHelper,
  updateSceneCardProgress as updateSceneCardProgressHelper,
  updateSceneCardDom as updateSceneCardDomHelper,
  initiateSceneTask as initiateSceneTaskHelper,
  pollSceneTask as pollSceneTaskHelper,
  generateSingleSceneVisual as generateSingleSceneVisualHelper,
  handleBatchGenerateScenes as handleBatchGenerateScenesHelper,
  collectAll1SheetAssets as collectAll1SheetAssetsHelper,
  render1SheetAssetsPreview as render1SheetAssetsPreviewHelper,
  generateMaster1SheetPrompt as generateMaster1SheetPromptHelper,
  open1SheetGridModal as open1SheetGridModalHelper,
  close1SheetGridModal as close1SheetGridModalHelper,
  toggle1SheetGridModal as toggle1SheetGridModalHelper,
  update1SheetGridButtonState as update1SheetGridButtonStateHelper,
  execute1SheetGeneration as execute1SheetGenerationHelper,
  DEFAULT_CHARACTER_SHEET_PROMPT,
  openCharacterSheetModal as openCharacterSheetModalHelper,
  closeCharacterSheetModal as closeCharacterSheetModalHelper,
  executeCharacterSheetGeneration as executeCharacterSheetGenerationHelper,
  buildProductVariationPrompts as buildProductVariationPromptsHelper,
  openProductVariationsModal as openProductVariationsModalHelper,
  closeProductVariationsModal as closeProductVariationsModalHelper,
  executeProductVariationsGeneration as executeProductVariationsGenerationHelper,
  renderProductVariationPromptCards as renderProductVariationPromptCardsHelper,
  selectWinnerProductVariation as selectWinnerProductVariationHelper,
  applyProductVariationToProduct as applyProductVariationToProductHelper,
  applyProductVariationToBackground as applyProductVariationToBackgroundHelper,
  isSceneTextless,
  sanitizeSceneImagePrompt,
} from './js/storyboard/storyboard-generation.js';
import {
  makeStoryboardRevisionSnapshot,
  pushStoryboardRevision,
  restoreStoryboardRevision,
  handleSaveSbProject as handleSaveSbProjectHelper,
  loadSavedStoryboards as loadSavedStoryboardsHelper,
  renderSavedStoryboards as renderSavedStoryboardsHelper,
  handleClearSbHistory as handleClearSbHistoryHelper,
} from './js/storyboard/storyboard-project.js';
import {
  applyAspectRatio as applyAspectRatioHelper,
  applyModelSelection as applyModelSelectionHelper,
  applyResolution as applyResolutionHelper,
  applyTierSelection as applyTierSelectionHelper,
  renderModelPickerOptions as renderModelPickerOptionsHelper,
  setGenerationMode as setGenerationModeHelper,
  syncTierUiState,
} from './js/generator/model-controls.js';

/**
 * Weavy AI Multimodal Assistant - Chrome Extension SidePanel
 * Pure Client-Side Architecture for Browser Extension Environment
 */

(function () {
  'use strict';

  const FIREBASE_API_KEY = 'AIzaSyC-qLy3TFyXMogJPfMkZJ9H_q46hEu1sxI';

  // State
  let accounts = [];
  let activeAccountId = null;
  let activeProvider = 'weavy';
  let chatSessions = [];
  let currentSessionId = null;
  let currentAttachments = [];
  let isGenerating = false;
  let activeTab = 'generate';
  let isChatAutoScrollActive = true;
  let isProgrammaticChatScroll = false;
  let isUserScrollingChat = false;
  let userScrollTimeout = null;

  // DOM Elements
  const headerAccountEmail = document.getElementById('headerAccountEmail');
  const headerAccountCredits = document.getElementById('headerAccountCredits');
  const activeAccountPill = document.getElementById('activeAccountPill');
  const libraryContent = document.getElementById('libraryContent');
  const btnRefreshCredits = document.getElementById('btnRefreshCredits');
  const btnToggleTheme = document.getElementById('btnToggleTheme');
  const btnFullScreen = document.getElementById('btnFullScreen');
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Chat Elements
  const chatProviderSelect = document.getElementById('chatProviderSelect');
  const chatModelSelect = document.getElementById('chatModelSelect');
  const btnNewSession = document.getElementById('btnNewSession');
  const btnSessionHistory = document.getElementById('btnSessionHistory');
  const btnHistoryNewSession = document.getElementById('btnHistoryNewSession');
  const chatSessionHistoryPopover = document.getElementById('chatSessionHistoryPopover');
  const chatSessionHistoryList = document.getElementById('chatSessionHistoryList');
  const btnClearCurrentChat = document.getElementById('btnClearCurrentChat');
  const chatMessages = document.getElementById('chatMessages');
  const btnScrollToBottom = document.getElementById('btnScrollToBottom');
  const attachmentPreviewTray = document.getElementById('attachmentPreviewTray');
  const fileInputAttachment = document.getElementById('fileInputAttachment');
  const chatInputText = document.getElementById('chatInputText');
  const btnSendMessage = document.getElementById('btnSendMessage');
  let chatGenerationAbortController = null;

  const SEND_BTN_DEFAULT_ICON = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
    <line x1="12" y1="19" x2="12" y2="5"/>
    <polyline points="5 12 12 5 19 12"/>
  </svg>`;

  const SEND_BTN_STOP_ICON = `<svg class="icon" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2.5"/>
  </svg>`;

  function setChatGeneratingState(generating) {
    isGenerating = Boolean(generating);
    if (!btnSendMessage) return;
    if (isGenerating) {
      btnSendMessage.disabled = false;
      btnSendMessage.classList.add('is-loading');
      btnSendMessage.title = 'Hentikan respon (Stop)';
      btnSendMessage.innerHTML = SEND_BTN_STOP_ICON;
    } else {
      btnSendMessage.disabled = false;
      btnSendMessage.classList.remove('is-loading');
      btnSendMessage.title = 'Kirim Pesan';
      btnSendMessage.innerHTML = SEND_BTN_DEFAULT_ICON;
    }
  }

  const slashChips = document.querySelectorAll('.chip-btn');
  const exampleButtons = document.querySelectorAll('.example-item');

  // Generate Tab Elements
  const genModelSelect = document.getElementById('genModelSelect');
  const genAspectSelect = document.getElementById('genAspectSelect');
  const genResolutionSelect = document.getElementById('genResolutionSelect');
  const genPromptInput = document.getElementById('genPromptInput');
  const genRefFileInput = document.getElementById('genRefFileInput');
  const btnChooseRefImage = document.getElementById('btnChooseRefImage');
  const refGalleryContainer = document.getElementById('refGalleryContainer');
  const refImagesGrid = document.getElementById('refImagesGrid');
  const btnAddMoreRefImages = document.getElementById('btnAddMoreRefImages');
  const btnClearAllRefImages = document.getElementById('btnClearAllRefImages');
  const refImagesCountBadge = document.getElementById('refImagesCountBadge');
  const btnSubmitGenerate = document.getElementById('btnSubmitGenerate');
  const generateResultContainer = document.getElementById('generateResultContainer');
  const generateLoadingBox = document.getElementById('generateLoadingBox');
  const generateLoadingText = document.getElementById('generateLoadingText');
  const generateSuccessBox = document.getElementById('generateSuccessBox');
  const generateResultImg = document.getElementById('generateResultImg');
  const btnDownloadResult = document.getElementById('btnDownloadResult');
  const btnCopyPrompt = document.getElementById('btnCopyPrompt');
  let currentGenRefImages = []; // Array of { id, name, base64, asset, isUploading, error }

  // Settings Elements
  const inputRefreshToken = document.getElementById('inputRefreshToken');
  const btnAddAccount = document.getElementById('btnAddAccount');
  const authStatusAlert = document.getElementById('authStatusAlert');
  const accountsListContainer = document.getElementById('accountsListContainer');

  // --- JWT & AUTH UTILS ---
  function extractCreditsFromObj(obj, depth = 0) {
    if (!obj || depth > 4) return null;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = extractCreditsFromObj(item, depth + 1);
        if (found !== null) return found;
      }
      return null;
    }

    if (typeof obj !== 'object') return null;

    // Direct keys check
    const keys = [
      'credits',
      'balance',
      'quota',
      'credit',
      'coins',
      'points',
      'amount',
      'remaining',
      'remainingCredits',
      'remaining_credits',
      'user_credits',
      'totalCredits',
      'availableCredits',
    ];

    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
        const num = Number(obj[k]);
        if (!isNaN(num)) return num;
      }
    }

    // Nested object check
    const nestedKeys = ['data', 'user', 'account', 'result', 'users', 'items', 'profile', 'info'];
    for (const nk of nestedKeys) {
      if (obj[nk]) {
        const found = extractCreditsFromObj(obj[nk], depth + 1);
        if (found !== null) return found;
      }
    }

    return null;
  }

  async function fetchUserCreditsFromWeavy(idTokenOrOptions, refreshToken, accountObj) {
    const options = typeof idTokenOrOptions === 'object' && idTokenOrOptions !== null
      ? idTokenOrOptions
      : {
          idToken: idTokenOrOptions,
          refreshToken,
          accountObj,
        };

    return fetchUserCreditsFromWeavyHelper({
      ...options,
      syncCookiesToBrowser,
      WEAVY_API_BASE,
      extractCreditsFromObj,
    });
  }

  async function syncCookiesToBrowser(input, opts = {}) {
    if (typeof input === 'object' && input !== null) {
      return syncCookiesToBrowserHelper({ chromeApi: chrome, ...input, ...opts });
    }
    return syncCookiesToBrowserHelper({ cookieStr: input, chromeApi: chrome, ...opts });
  }

  async function exchangeRefreshToken(refreshTokenOrOptions, cookieStr) {
    const options = typeof refreshTokenOrOptions === 'object' && refreshTokenOrOptions !== null
      ? refreshTokenOrOptions
      : {
          refreshToken: refreshTokenOrOptions,
          cookieStr,
        };

    return exchangeRefreshTokenHelper({
      ...options,
      FIREBASE_API_KEY,
      syncCookiesToBrowser,
      parseJwt,
      fetchUserCreditsFromWeavy,
      WEAVY_API_BASE,
      extractCreditsFromObj,
    });
  }

  async function getValidIdToken(accountOrOptions) {
    const account = (typeof accountOrOptions === 'object' && accountOrOptions !== null && accountOrOptions.refreshToken)
      ? accountOrOptions
      : accountOrOptions;

    return getValidIdTokenHelper({
      account,
      exchangeRefreshToken,
      saveAccounts,
    });
  }

  // --- ACCOUNTS MANAGEMENT ---
  async function syncActiveAccountCookie() {
    if (activeProvider !== 'weavy') return;
    await syncAccountCookie(getActiveAccount(), syncCookiesToBrowser);
  }

  function getCurrentProviderAccounts() {
    return accounts.filter((account) => (account.provider || 'weavy') === activeProvider);
  }

  function setActiveProvider(nextProvider) {
    const normalized = ['flow', 'dola', 'gemini'].includes(nextProvider) ? nextProvider : 'weavy';
    activeProvider = normalized;
    window.activeProvider = normalized;
    const providerAccounts = getCurrentProviderAccounts();
    if (!providerAccounts.some((account) => account.id === activeAccountId)) {
      activeAccountId = providerAccounts[0]?.id || null;
    }
    syncGenerationProviderUi();
    renderHeaderAccount();
    renderAccountsList();
    if (btnRefreshCredits) btnRefreshCredits.style.display = (normalized === 'dola' || normalized === 'gemini') ? 'none' : '';
    saveAccounts();
  }

  window.setActiveProvider = setActiveProvider;
  window.activeProvider = activeProvider;
  window.syncGenerationProviderUi = syncGenerationProviderUi;

  async function loadAccounts() {
    const accountState = await loadAccountState(storage);
    const todayStr = getTodayLocalDateStrHelper();
    accounts = (accountState.accounts || []).map((account) => {
      let credits = account.credits;
      if (account.provider === 'dola') {
        if (account.lastGeneratedDate === todayStr) {
          credits = 0;
        } else if (credits === undefined || credits === null || credits > 4) {
          credits = 4;
        }
      }
      return {
        ...account,
        provider: account.provider || 'weavy',
        credits: credits ?? (account.provider === 'dola' ? 4 : (account.provider === 'gemini' ? 100 : 0)),
      };
    });
    activeProvider = accountState.provider || 'weavy';
    window.activeProvider = activeProvider;
    if (btnRefreshCredits) btnRefreshCredits.style.display = (activeProvider === 'dola' || activeProvider === 'gemini') ? 'none' : '';
    activeAccountId = accountState.activeAccountId;
    const providerAccounts = getCurrentProviderAccounts();
    if (!activeAccountId || !providerAccounts.some((account) => account.id === activeAccountId)) {
      activeAccountId = providerAccounts[0]?.id || null;
    }
    await syncActiveAccountCookie();
    renderHeaderAccount();
    renderAccountsList();
  }

  async function saveAccounts() {
    accounts = accounts.map((account) => ({
      ...account,
      provider: account.provider || activeProvider,
    }));
    window.activeProvider = activeProvider;
    await saveAccountState(storage, accounts, activeAccountId, activeProvider);
    await syncActiveAccountCookie();
    renderHeaderAccount();
    renderAccountsList();
  }

  function getActiveAccount() {
    return selectActiveAccount(getCurrentProviderAccounts(), activeAccountId, activeProvider);
  }

  let dropdownProvider = 'weavy';

  function renderHeaderAccountDropdown() {
    const dropdownList = document.getElementById('headerAccountDropdownList');
    if (!dropdownList) return;

    // Update tabs active state & counts
    const tabWeavy = document.getElementById('headerTabWeavy');
    const tabFlow = document.getElementById('headerTabFlow');
    const tabDola = document.getElementById('headerTabDola');
    const tabGemini = document.getElementById('headerTabGemini');

    if (tabWeavy) {
      const count = getProviderAccounts(accounts, 'weavy').length;
      tabWeavy.textContent = `Weavy (${count})`;
      tabWeavy.classList.toggle('active', dropdownProvider === 'weavy');
    }
    if (tabFlow) {
      const count = getProviderAccounts(accounts, 'flow').length;
      tabFlow.textContent = `Flow (${count})`;
      tabFlow.classList.toggle('active', dropdownProvider === 'flow');
    }
    if (tabDola) {
      const count = getProviderAccounts(accounts, 'dola').length;
      tabDola.textContent = `Dola (${count})`;
      tabDola.classList.toggle('active', dropdownProvider === 'dola');
    }
    if (tabGemini) {
      const count = getProviderAccounts(accounts, 'gemini').length;
      tabGemini.textContent = `Gemini (${count})`;
      tabGemini.classList.toggle('active', dropdownProvider === 'gemini');
    }

    const providerAccounts = getProviderAccounts(accounts, dropdownProvider);

    if (providerAccounts.length === 0) {
      const label = getProviderLabel(dropdownProvider);
      dropdownList.innerHTML = `
        <div class="header-dropdown-empty">
          <p>Belum ada akun <strong>${escapeHtml(label)}</strong>.</p>
          <p style="margin-top: 4px; font-size: 10.5px;">Klik <strong>+ Tambah Akun</strong> di bawah untuk memasukkan akun baru.</p>
        </div>
      `;
      return;
    }

    const activeId = (dropdownProvider === activeProvider) ? activeAccountId : null;

    dropdownList.innerHTML = providerAccounts
      .map((acc) => renderAccountDropdownItemHtml(acc, { isActive: acc.id === activeId }))
      .join('');

    // Attach click listeners to items for instant switching
    dropdownList.querySelectorAll('.header-acc-dropdown-item').forEach((item) => {
      item.addEventListener('click', async () => {
        const id = item.getAttribute('data-id');
        const prov = item.getAttribute('data-provider') || dropdownProvider;
        closeHeaderAccountDropdown();

        if (prov !== activeProvider) {
          activeProvider = prov;
          dropdownProvider = prov;
        }

        const selectedAcc = accounts.find((a) => a.id === id);
        activeAccountId = id;
        await saveAccounts();
        await syncAccountSessionToBrowserTab(id);
        if (selectedAcc?.provider !== 'flow' && selectedAcc?.provider !== 'dola') {
          await syncSingleAccount(id);
        }
        renderHeaderAccount();
        renderAccountsList();
        showAuthAlert(`✅ Berhasil beralih ke akun ${selectedAcc?.email || selectedAcc?.name || 'terpilih'}.`, 'success');
      });
    });
  }

  function toggleHeaderAccountDropdown() {
    const dropdown = document.getElementById('headerAccountDropdown');
    if (!dropdown) return;
    const isHidden = dropdown.classList.contains('hidden');
    if (isHidden) {
      dropdownProvider = activeProvider || 'weavy';
      renderHeaderAccountDropdown();
      dropdown.classList.remove('hidden');
      activeAccountPill?.setAttribute('aria-expanded', 'true');
    } else {
      closeHeaderAccountDropdown();
    }
  }

  function closeHeaderAccountDropdown() {
    const dropdown = document.getElementById('headerAccountDropdown');
    if (!dropdown) return;
    dropdown.classList.add('hidden');
    activeAccountPill?.setAttribute('aria-expanded', 'false');
  }

  function renderHeaderAccount() {
    renderAccountHeader(getActiveAccount(), activeProvider);
    const dropdown = document.getElementById('headerAccountDropdown');
    if (dropdown && !dropdown.classList.contains('hidden')) {
      renderHeaderAccountDropdown();
    }
  }

  let isBatchSelectMode = false;
  let selectedAccountIds = new Set();
  let accountSearchQuery = '';

  function renderAccountsList() {
    const providerAccounts = getCurrentProviderAccounts();
    const totalAccounts = providerAccounts.length;
    const activeAcc = getActiveAccount();
    renderAccountStats(accounts, activeAcc, activeProvider);

    const batchActionBar = document.getElementById('batchActionBar');
    const batchSelectedCount = document.getElementById('batchSelectedCount');
    const btnToggleBatchSelect = document.getElementById('btnToggleBatchSelect');

    if (btnToggleBatchSelect) {
      btnToggleBatchSelect.classList.toggle('active', isBatchSelectMode);
    }
    if (batchActionBar) {
      batchActionBar.classList.toggle('hidden', !isBatchSelectMode);
    }
    if (batchSelectedCount) {
      batchSelectedCount.textContent = selectedAccountIds.size;
    }

    if (!accountsListContainer) return;

    const q = accountSearchQuery.toLowerCase().trim();
    const filteredAccounts = q
      ? providerAccounts.filter((a) =>
          (a.email && a.email.toLowerCase().includes(q)) ||
          (a.name && a.name.toLowerCase().includes(q)) ||
          (a.userId && String(a.userId).toLowerCase().includes(q)) ||
          (a.id && String(a.id).toLowerCase().includes(q))
        )
      : providerAccounts;

    const chkSelectAllAccounts = document.getElementById('chkSelectAllAccounts');
    if (chkSelectAllAccounts) {
      chkSelectAllAccounts.checked = filteredAccounts.length > 0 && filteredAccounts.every((a) => selectedAccountIds.has(a.id));
    }

    if (filteredAccounts.length === 0) {
      if (totalAccounts === 0) {
        const label = getProviderLabel(activeProvider);
        accountsListContainer.innerHTML = `<div class="empty-state" style="padding: 24px; text-align: center; color: var(--text-secondary); background: var(--bg-secondary); border-radius: 10px; border: 1px dashed var(--border-color);">Belum ada akun ${label} yang tersimpan. Klik <strong>+ Add Account</strong> di atas untuk menambahkan akun baru.</div>`;
      } else {
        accountsListContainer.innerHTML = `<div class="empty-state" style="padding: 24px; text-align: center; color: var(--text-secondary); background: var(--bg-secondary); border-radius: 10px; border: 1px dashed var(--border-color);">Tidak ada akun yang cocok dengan kata kunci "<strong>${escapeHtml(accountSearchQuery)}</strong>".</div>`;
      }
      return;
    }

    accountsListContainer.innerHTML = filteredAccounts
      .map((account) => renderAccountCardHtml(account, {
        isActive: account.id === activeAccountId,
        isChecked: selectedAccountIds.has(account.id),
        isBatchSelectMode,
      }))
      .join('');

    // Attach checkbox listeners
    accountsListContainer.querySelectorAll('.acc-card-chk').forEach((chk) => {
      chk.addEventListener('change', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (e.currentTarget.checked) {
          selectedAccountIds.add(id);
        } else {
          selectedAccountIds.delete(id);
        }
        if (batchSelectedCount) batchSelectedCount.textContent = selectedAccountIds.size;
        if (chkSelectAllAccounts) {
          chkSelectAllAccounts.checked = filteredAccounts.length > 0 && filteredAccounts.every((a) => selectedAccountIds.has(a.id));
        }
      });
    });

  }

  async function syncAccountSessionToBrowserTab(accountOrId) {
    const account = typeof accountOrId === 'object' && accountOrId !== null
      ? accountOrId
      : accounts.find((item) => item.id === accountOrId);

    if (!account) return false;

    const prov = account.provider || activeProvider;
    if (prov === 'flow' || prov === 'dola') {
      activeProvider = prov;
      activeAccountId = account.id;
      await saveAccounts();
      renderHeaderAccount();
      renderAccountsList();
    }

    return syncAccountSessionToBrowserTabModule({
      accountOrId,
      accounts,
      saveAccounts,
      exchangeRefreshToken,
      syncCookiesToBrowser,
      showAuthAlert,
      renderHeaderAccount,
      renderAccountsList,
      FIREBASE_API_KEY,
      setActiveAccountId: (nextAccountId) => {
        activeAccountId = nextAccountId;
      },
    });
  }

  // --- LOGOUT / WIPE SESI TAB WEAVY DI BROWSER ---
  async function logoutWeavyTabSession() {
    await logoutAccountSession(showAuthAlert);
  }

  // --- EXPORT DATA AKUN KE FILE JSON / CLIPBOARD ---
  function exportAccounts(accountIds = null) {
    const exportList = accountIds && accountIds.size > 0
      ? accounts.filter((a) => accountIds.has(a.id))
      : accounts;

    if (exportList.length === 0) {
      alert('Tidak ada akun untuk diekspor.');
      return;
    }

    const exportData = {
      app: 'Weavy Extension AI Pro',
      version: '6.0',
      exportedAt: new Date().toISOString(),
      count: exportList.length,
      accounts: exportList.map((a) => ({
        id: a.id,
        userId: a.userId || a.id,
        provider: a.provider || 'weavy',
        email: a.email,
        name: a.name,
        chromeProfile: a.chromeProfile || 'Profile Utama',
        credits: a.credits,
        refreshToken: a.refreshToken,
        idToken: a.idToken,
        expiresAt: a.expiresAt,
        cookie: a.cookie || '',
      })),
    };

    const jsonStr = JSON.stringify(exportData, null, 2);

    try {
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `weavy_accounts_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('[File Download Warning]:', e);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonStr).catch(() => {});
    }

    showAuthAlert(`📥 Berhasil mengekspor ${exportList.length} akun ke file JSON & disalin ke clipboard!`, 'success');
  }

  async function syncImportedAccounts(accountIds, onProgress) {
    const uniqueAccountIds = [...new Set(accountIds)];
    let processed = 0;

    // Report start of sync immediately
    onProgress?.(0, uniqueAccountIds.length);

    for (const accountId of uniqueAccountIds) {
      const account = accounts.find((item) => item.id === accountId);
      if (!account) {
        processed++;
        onProgress?.(processed, uniqueAccountIds.length);
        continue;
      }

      if (account?.provider === 'flow') {
        processed++;
        onProgress?.(processed, uniqueAccountIds.length);
        continue;
      }

      if (account?.provider === 'dola') {
        try {
          const dolaCredits = await fetchUserCreditsFromDolaHelper({
            account,
            storage,
            syncCookiesToBrowser: syncCookiesToBrowserHelper,
          });
          account.credits = dolaCredits;
          account.lastVerified = new Date().toISOString();
        } catch (err) {
          console.warn(`[Import Sync] Gagal sync akun Dola ${account.email}:`, err);
        }
      } else if (account?.refreshToken) {
        try {
          const updated = await exchangeRefreshToken(account.refreshToken, account.cookie);
          if (updated) {
            // CRITICAL: NEVER overwrite real user email with dummy userId@weavy.user or @weavy.local
            const isUpdatedEmailDummy = !updated.email || updated.email.endsWith('@weavy.user') || updated.email.endsWith('@weavy.local');
            const isAccountEmailValid = account.email && !account.email.endsWith('@weavy.user') && !account.email.endsWith('@weavy.local');
            const finalEmail = (isAccountEmailValid && isUpdatedEmailDummy) ? account.email : (updated.email || account.email);

            Object.assign(account, {
              userId: updated.userId || account.userId,
              email: finalEmail,
              name: (account.name && account.name !== 'User' && !account.name.startsWith('Refresh Token') && !account.name.startsWith('user_')) ? account.name : (updated.name || finalEmail.split('@')[0]),
              picture: updated.picture || account.picture,
              credits: typeof updated.credits === 'number' ? updated.credits : account.credits,
              idToken: updated.idToken || account.idToken,
              refreshToken: updated.refreshToken || account.refreshToken,
              expiresAt: updated.expiresAt || account.expiresAt,
              lastVerified: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.warn(`[Import Sync] Gagal sync akun ${account.email}:`, err);
        }
      }

      processed++;
      onProgress?.(processed, uniqueAccountIds.length);
      await saveAccounts();
    }

    return { processed, total: uniqueAccountIds.length };
  }

  // --- IMPORT DATA AKUN DARI DAFTAR PARSED ACCOUNTS ---
  async function importParsedAccountsList(listToImport, onProgress) {
    if (!listToImport || listToImport.length === 0) {
      throw new Error('Tidak ditemukan daftar akun atau token valid.');
    }

    let importedCount = 0;
    let updatedCount = 0;
    const importedAccountIds = [];
    let importedProvider = null;

    for (const item of listToImport) {
      const provider = item.provider === 'flow' ? 'flow' : (item.provider === 'dola' ? 'dola' : 'weavy');
      const refreshToken = (item.refreshToken || item.token || item.stsTokenManager?.refreshToken || '').trim();
      const idToken = (item.idToken || item.accessToken || item.stsTokenManager?.accessToken || '').trim();
      const email = (item.email || (provider === 'weavy' ? '' : (provider === 'dola' ? `dola_user_${Date.now()}@dola.com` : ''))).trim();
      const userId = (item.userId || (email ? email.split('@')[0] : `usr_${Date.now()}`)).trim();
      const name = (item.name || (email ? email.split('@')[0] : 'User')).trim();
      const credits = typeof item.credits === 'number' ? item.credits : 100;
      const cookie = (item.cookie || '').trim();
      const chromeProfile = (item.chromeProfile || item.profile || item.profileName || '').trim();

      if (provider === 'weavy' && !refreshToken && !idToken) continue;
      if (provider === 'flow' && !email && !cookie) continue;
      if (provider === 'dola' && !email && !cookie && !item.sessionid) continue;
      importedProvider = provider;

      // Match existing account by refreshToken or email or userId
      const existingIndex = accounts.findIndex(
        (a) => (a.provider || 'weavy') === provider && (
          (refreshToken && a.refreshToken === refreshToken) ||
          (email && a.email && a.email.toLowerCase() === email.toLowerCase()) ||
          (a.userId && a.userId === userId)
        )
      );

      if (existingIndex >= 0) {
        const existing = accounts[existingIndex];
        accounts[existingIndex] = {
          ...existing,
          provider,
          email: email || existing.email || `user_${Date.now()}@weavy.ai`,
          name: name || existing.name || (email ? email.split('@')[0] : 'User'),
          chromeProfile: chromeProfile || existing.chromeProfile || 'Profile Utama',
          refreshToken: refreshToken || existing.refreshToken,
          idToken: idToken || existing.idToken,
          credits: credits ?? existing.credits,
          cookie: cookie || existing.cookie,
          sessionid: item.sessionid || existing.sessionid || '',
          lastVerified: new Date().toISOString(),
        };
        importedAccountIds.push(accounts[existingIndex].id);
        updatedCount++;
      } else {
        const fallbackEmail = email || (provider === 'weavy' ? `user_${Date.now()}@weavy.ai` : `user_${Date.now()}@${provider}.local`);
        const newAcc = {
          id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          userId,
          provider,
          email: fallbackEmail,
          name: name || fallbackEmail.split('@')[0],
          chromeProfile: chromeProfile || ((provider === 'flow' || provider === 'dola') ? `Profile ${accounts.filter(a => a.provider === provider).length + 1}` : 'Profile Utama'),
          credits,
          refreshToken,
          idToken,
          cookie,
          sessionid: item.sessionid || '',
          createdAt: new Date().toISOString(),
          lastVerified: new Date().toISOString(),
        };
        accounts.push(newAcc);
        importedAccountIds.push(newAcc.id);
        importedCount++;
      }
    }

    if (importedCount === 0 && updatedCount === 0) {
      throw new Error('Tidak ada akun dengan token valid yang berhasil diimpor.');
    }

    if (importedProvider === 'flow') {
      activeProvider = 'flow';
      activeAccountId = importedAccountIds[0] || activeAccountId;
    } else if (importedProvider === 'dola') {
      activeProvider = 'dola';
      activeAccountId = importedAccountIds[0] || activeAccountId;
    } else if (!activeAccountId && accounts.length > 0) {
      activeAccountId = accounts[0].id;
    }

    await saveAccounts();
    await syncImportedAccounts(importedAccountIds, onProgress);
    renderHeaderAccount();
    renderAccountsList();

    return { importedCount, updatedCount, total: accounts.length };
  }

  // --- IMPORT DATA AKUN DARI FILE TXT / TEKS ---
  async function importAccountsFromTxt(rawInput, onProgress) {
    if (!rawInput || typeof rawInput !== 'string') {
      throw new Error('Data teks kosong.');
    }
    const parsedList = parseImportAccounts(rawInput);
    if (parsedList.length === 0) {
      throw new Error('Tidak ditemukan akun atau Refresh Token yang valid dalam teks.');
    }
    return importParsedAccountsList(parsedList, onProgress);
  }

  // --- IMPORT DATA AKUN DARI FILE JSON / TEKS ---
  async function importAccountsFromJson(rawInput, onProgress) {
    if (!rawInput || typeof rawInput !== 'string') {
      throw new Error('Data kosong.');
    }
    const parsedList = parseImportAccounts(rawInput);
    if (parsedList.length === 0) {
      throw new Error('Tidak ditemukan daftar akun yang valid dalam data tersebut.');
    }
    return importParsedAccountsList(parsedList, onProgress);
  }

  function parseCurlCommand(curlStr) {
    if (!curlStr || typeof curlStr !== 'string') return null;
    const trimmed = curlStr.trim();
    const headers = {};
    let cookieStr = '';
    let bearerToken = '';

    const headerRegex = /(?:-H|--header)\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = headerRegex.exec(trimmed)) !== null) {
      const line = match[1];
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const k = line.substring(0, colonIdx).trim().toLowerCase();
        const v = line.substring(colonIdx + 1).trim();
        headers[k] = v;
        if (k === 'authorization' && v.toLowerCase().startsWith('bearer ')) {
          bearerToken = v.substring(7).trim();
        }
        if (k === 'cookie') {
          cookieStr = v;
        }
      }
    }

    const cookieRegex = /(?:-b|--cookie)\s+['"]([^'"]+)['"]/g;
    while ((match = cookieRegex.exec(trimmed)) !== null) {
      cookieStr = (cookieStr ? cookieStr + '; ' : '') + match[1];
    }

    return {
      bearerToken,
      refreshToken: bearerToken,
      cookieStr,
      headers
    };
  }

  // Deteksi otomatis email Google pengguna dari sesi aktif / profil browser
  async function detectGoogleUserEmail() {
    try {
      if (typeof chrome !== 'undefined' && chrome?.identity?.getProfileUserInfo) {
        const info = await new Promise((res) => {
          try {
            chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (u) => res(u || null));
          } catch (_) {
            res(null);
          }
        });
        if (info && info.email && info.email.includes('@')) {
          return info.email.trim();
        }
      }
    } catch (_) {}

    try {
      if (typeof chrome !== 'undefined' && chrome?.tabs?.query && chrome?.scripting?.executeScript) {
        const tabs = await chrome.tabs.query({
          url: ['*://gemini.google.com/*', '*://accounts.google.com/*', '*://mail.google.com/*', '*://flow.google.com/*']
        });
        for (const t of tabs) {
          try {
            const results = await chrome.scripting.executeScript({
              target: { tabId: t.id },
              func: () => {
                const els = document.querySelectorAll('a[aria-label*="@"], button[aria-label*="@"], [data-email], [aria-label*="Google Account" i], [aria-label*="Akun Google" i]');
                for (const el of els) {
                  const txt = el.getAttribute('aria-label') || el.getAttribute('data-email') || el.innerText || '';
                  const m = txt.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                  if (m) return m[0];
                }
                const pageMatch = (document.body?.innerText || '').match(/[a-zA-Z0-9._%+-]+@gmail\.com/i);
                return pageMatch ? pageMatch[0] : null;
              }
            });
            const detected = results?.[0]?.result;
            if (detected && detected.includes('@')) {
              return detected.trim();
            }
          } catch (_) {}
        }
      }
    } catch (_) {}

    try {
      const existingGoogleAcc = accounts.find((a) => (a.provider === 'gemini' || a.provider === 'flow') && a.email && a.email.includes('@'));
      if (existingGoogleAcc && existingGoogleAcc.email) {
        return existingGoogleAcc.email.trim();
      }
    } catch (_) {}

    return '';
  }

  async function handleAddAccount() {
    let rawInput = inputRefreshToken.value.trim();
    let extractedCookie = '';
    let pastedAccountMeta = null;

    if (!rawInput) {
      showAuthAlert('Silakan tempelkan JSON Akun, Bookmarklet, Refresh Token, atau cURL terlebih dahulu.', 'error');
      return;
    }

    // 1. Check if user pasted JSON string (dari tombol Salin, Export, atau Bookmarklet)
    if (rawInput.startsWith('{') && rawInput.endsWith('}')) {
      try {
        const parsed = JSON.parse(rawInput);
        const targetObj = (parsed && parsed.account && typeof parsed.account === 'object')
          ? parsed.account
          : (parsed && Array.isArray(parsed.accounts) && parsed.accounts[0])
          ? parsed.accounts[0]
          : parsed;

        if (targetObj && typeof targetObj === 'object') {
          pastedAccountMeta = targetObj;
          if (targetObj.cookie) extractedCookie = targetObj.cookie;
          if (targetObj.refreshToken) {
            rawInput = targetObj.refreshToken;
          } else if (targetObj.sessionid && !extractedCookie.includes('sessionid=')) {
            extractedCookie = `sessionid=${targetObj.sessionid}; ${extractedCookie}`.trim();
          }
        }
      } catch (e) {
        console.warn('Gagal memproses string JSON:', e);
      }
    }

    // A. JIKA INPUT ADALAH AKUN GOOGLE FLOW LENGKAP DARI SALINAN
    if (pastedAccountMeta && pastedAccountMeta.provider === 'flow') {
      showAuthAlert('Menyimpan akun Google Flow dari data salinan...', '');
      btnAddAccount.disabled = true;
      try {
        const flowEmail = pastedAccountMeta.email || '';
        const existingIdx = accounts.findIndex((account) => account.provider === 'flow' && (
          (flowEmail && account.email?.toLowerCase() === flowEmail.toLowerCase()) || 
          (pastedAccountMeta.userId && account.userId === pastedAccountMeta.userId)
        ));
        const flowAccountsCount = accounts.filter((a) => a.provider === 'flow').length;
        const defaultProfileName = pastedAccountMeta.chromeProfile || 
          (existingIdx >= 0 && accounts[existingIdx].chromeProfile ? accounts[existingIdx].chromeProfile : `Profile ${flowAccountsCount + 1}`);

        const accData = {
          id: existingIdx >= 0 ? accounts[existingIdx].id : (pastedAccountMeta.id || `flow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
          userId: pastedAccountMeta.userId || flowEmail,
          email: flowEmail,
          name: pastedAccountMeta.name || flowEmail.split('@')[0] || 'Flow User',
          provider: 'flow',
          chromeProfile: defaultProfileName,
          refreshToken: pastedAccountMeta.refreshToken || '',
          idToken: pastedAccountMeta.idToken || '',
          cookie: pastedAccountMeta.cookie || extractedCookie || '',
          credits: typeof pastedAccountMeta.credits === 'number' ? pastedAccountMeta.credits : 0,
          createdAt: pastedAccountMeta.createdAt || new Date().toISOString(),
          lastVerified: new Date().toISOString(),
        };

        if (existingIdx >= 0) {
          accounts[existingIdx] = { ...accounts[existingIdx], ...accData };
        } else {
          accounts.push(accData);
        }

        activeAccountId = accData.id;
        setActiveProvider('flow');
        await saveAccounts();
        inputRefreshToken.value = '';
        renderHeaderAccount();
        renderAccountsList();

        showAuthAlert(`✅ Berhasil import & simpan akun Google Flow: ${accData.email} (${accData.chromeProfile})!`, 'success');
        setTimeout(() => {
          const modal = document.getElementById('addAccountModal');
          modal?.classList.add('hidden');
        }, 1200);
        return;
      } catch (err) {
        showAuthAlert(`Gagal simpan akun Flow: ${err.message}`, 'error');
        return;
      } finally {
        btnAddAccount.disabled = false;
      }
    }

    // B. JIKA INPUT ADALAH API KEY GEMINI ATAU AKUN GEMINI DARI SALINAN
    const rawTrimmed = rawInput.trim();
    const hasGoogleKey = /(?:AIza[0-9A-Za-z_-]{20,}|AQ\.[0-9A-Za-z_.-]{20,})/.test(rawTrimmed);
    const isGeminiApiKey = 
      hasGoogleKey ||
      (pastedAccountMeta && (pastedAccountMeta.apiKey || (pastedAccountMeta.key && (String(pastedAccountMeta.key).startsWith('AIza') || String(pastedAccountMeta.key).startsWith('AQ.'))))) ||
      (activeProvider === 'gemini' && rawTrimmed.length >= 25 && !rawTrimmed.startsWith('{') && !rawTrimmed.toLowerCase().startsWith('curl'));

    // Jika user di tab provider Gemini menempelkan string yang bukan API Key dan bukan JSON/cURL
    if (activeProvider === 'gemini' && !isGeminiApiKey && !rawTrimmed.startsWith('{') && !rawTrimmed.toLowerCase().startsWith('curl')) {
      showAuthAlert('⚠️ Format API Key tidak valid. API Key Google Gemini harus disalin dari https://aistudio.google.com/apikey (biasanya dimulai dengan "AQ.Ab8..." atau "AIzaSy...").', 'error');
      btnAddAccount.disabled = false;
      return;
    }

    if (isGeminiApiKey) {
      showAuthAlert('Memproses Gemini API Key & mendeteksi email akun...', '');
      btnAddAccount.disabled = true;
      try {
        let geminiApiKey = '';
        if (pastedAccountMeta && (pastedAccountMeta.apiKey || pastedAccountMeta.key)) {
          geminiApiKey = pastedAccountMeta.apiKey || pastedAccountMeta.key;
        } else {
          const matchKey = rawTrimmed.match(/(?:AIza[0-9A-Za-z_-]{20,}|AQ\.[0-9A-Za-z_.-]{20,})/);
          geminiApiKey = matchKey ? matchKey[0] : rawTrimmed;
        }

        if (!geminiApiKey || geminiApiKey.length < 20) {
          showAuthAlert('⚠️ API Key Google Gemini tidak valid. Salin API Key asli dari https://aistudio.google.com/apikey', 'error');
          btnAddAccount.disabled = false;
          return;
        }

        // Deteksi Email Pengguna
        let geminiEmail = (pastedAccountMeta && pastedAccountMeta.email) ? pastedAccountMeta.email.trim() : '';
        if (!geminiEmail) {
          const emailMatch = rawTrimmed.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
          if (emailMatch) {
            geminiEmail = emailMatch[0].trim();
          }
        }
        if (!geminiEmail) {
          showAuthAlert('Mendeteksi email akun Google yang aktif...', '');
          geminiEmail = await detectGoogleUserEmail();
        }
        if (!geminiEmail) {
          geminiEmail = `gemini_${geminiApiKey.substring(4, 10).toLowerCase()}@gmail.com`;
        }

        // Verifikasi keabsahan API Key ke Google
        showAuthAlert(`Memverifikasi API Key ke Google AI Studio (${geminiEmail})...`, '');
        try {
          const testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`);
          if (!testRes.ok) {
            const errObj = await testRes.json().catch(() => ({}));
            const msg = errObj.error?.message || `Status HTTP ${testRes.status}`;
            showAuthAlert(`⚠️ API Key ditolak Google: "${msg}". Periksa API Key di Google AI Studio.`, 'error');
            btnAddAccount.disabled = false;
            return;
          }
        } catch (fetchErr) {
          showAuthAlert(`⚠️ Gagal memverifikasi API Key: ${fetchErr.message}. Periksa koneksi internet Anda.`, 'error');
          btnAddAccount.disabled = false;
          return;
        }

        const existingIdx = accounts.findIndex((account) => account.provider === 'gemini' && (
          (geminiEmail && account.email?.toLowerCase() === geminiEmail.toLowerCase()) || 
          (account.apiKey && account.apiKey === geminiApiKey) ||
          (pastedAccountMeta && pastedAccountMeta.userId && account.userId === pastedAccountMeta.userId)
        ));
        const geminiAccountsCount = accounts.filter((a) => a.provider === 'gemini').length;
        const defaultProfileName = (pastedAccountMeta && pastedAccountMeta.chromeProfile) || 
          (existingIdx >= 0 && accounts[existingIdx].chromeProfile ? accounts[existingIdx].chromeProfile : `Profile ${geminiAccountsCount + 1}`);

        const accData = {
          id: existingIdx >= 0 ? accounts[existingIdx].id : (pastedAccountMeta?.id || `acc_gemini_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
          userId: geminiEmail || `gemini_api_${Date.now()}`,
          email: geminiEmail,
          name: (pastedAccountMeta && pastedAccountMeta.name) || geminiEmail.split('@')[0] || 'Gemini User',
          provider: 'gemini',
          chromeProfile: defaultProfileName,
          apiKey: geminiApiKey,
          credits: 1000,
          cookie: pastedAccountMeta?.cookie || extractedCookie || '',
          createdAt: (pastedAccountMeta && pastedAccountMeta.createdAt) || new Date().toISOString(),
          lastVerified: new Date().toISOString(),
        };

        if (existingIdx >= 0) {
          accounts[existingIdx] = { ...accounts[existingIdx], ...accData };
        } else {
          accounts.push(accData);
        }

        activeAccountId = accData.id;
        setActiveProvider('gemini');
        await saveAccounts();
        inputRefreshToken.value = '';
        renderHeaderAccount();
        renderAccountsList();

        showAuthAlert(`✅ Berhasil verifikasi & simpan Akun Gemini Silent API: ${accData.email} (${accData.chromeProfile})!`, 'success');
        setTimeout(() => {
          const modal = document.getElementById('addAccountModal');
          modal?.classList.add('hidden');
        }, 1200);
        return;
      } catch (err) {
        showAuthAlert(`Gagal simpan akun Gemini: ${err.message}`, 'error');
        return;
      } finally {
        btnAddAccount.disabled = false;
      }
    }

    if ((pastedAccountMeta && pastedAccountMeta.provider === 'gemini') || (activeProvider === 'gemini' && pastedAccountMeta)) {
      showAuthAlert('Menyimpan akun Google Gemini dari data salinan...', '');
      btnAddAccount.disabled = true;
      try {
        const geminiEmail = pastedAccountMeta.email || '';
        const existingIdx = accounts.findIndex((account) => account.provider === 'gemini' && (
          (geminiEmail && account.email?.toLowerCase() === geminiEmail.toLowerCase()) || 
          (pastedAccountMeta.userId && account.userId === pastedAccountMeta.userId)
        ));
        const geminiAccountsCount = accounts.filter((a) => a.provider === 'gemini').length;
        const defaultProfileName = pastedAccountMeta.chromeProfile || 
          (existingIdx >= 0 && accounts[existingIdx].chromeProfile ? accounts[existingIdx].chromeProfile : `Profile ${geminiAccountsCount + 1}`);

        const accData = {
          id: existingIdx >= 0 ? accounts[existingIdx].id : (pastedAccountMeta.id || `acc_gemini_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
          userId: pastedAccountMeta.userId || geminiEmail,
          email: geminiEmail,
          name: pastedAccountMeta.name || geminiEmail.split('@')[0] || 'Gemini User',
          provider: 'gemini',
          chromeProfile: defaultProfileName,
          credits: typeof pastedAccountMeta.credits === 'number' ? pastedAccountMeta.credits : 100,
          apiKey: pastedAccountMeta.apiKey || '',
          cookie: pastedAccountMeta.cookie || extractedCookie || '',
          createdAt: pastedAccountMeta.createdAt || new Date().toISOString(),
          lastVerified: new Date().toISOString(),
        };

        if (existingIdx >= 0) {
          accounts[existingIdx] = { ...accounts[existingIdx], ...accData };
        } else {
          accounts.push(accData);
        }

        activeAccountId = accData.id;
        setActiveProvider('gemini');
        await saveAccounts();
        inputRefreshToken.value = '';
        renderHeaderAccount();
        renderAccountsList();

        showAuthAlert(`✅ Berhasil import & simpan akun Google Gemini: ${accData.email} (${accData.chromeProfile})!`, 'success');
        setTimeout(() => {
          const modal = document.getElementById('addAccountModal');
          modal?.classList.add('hidden');
        }, 1200);
        return;
      } catch (err) {
        showAuthAlert(`Gagal simpan akun Gemini: ${err.message}`, 'error');
        return;
      } finally {
        btnAddAccount.disabled = false;
      }
    }

    const normalizedProvider = (pastedAccountMeta && pastedAccountMeta.provider)
      ? pastedAccountMeta.provider
      : (['flow', 'dola', 'gemini'].includes(activeProvider) ? activeProvider : 'weavy');

    // 2. Check if user pasted cURL command
    if (rawInput.toLowerCase().startsWith('curl')) {
      const cData = parseCurlCommand(rawInput);
      if (cData) {
        if (cData.cookieStr) extractedCookie = cData.cookieStr;
        if (cData.refreshToken) rawInput = cData.refreshToken;
      }
    }

    // Check if Dola input
    const isDolaSession = (pastedAccountMeta && pastedAccountMeta.provider === 'dola') ||
      activeProvider === 'dola' || 
      /dola\.com|sessionid=|sid_tt=|doubao/i.test(`${rawInput} ${extractedCookie}`);

    if (isDolaSession) {
      showAuthAlert('Memverifikasi cookie sesi Dola AI...', '');
      btnAddAccount.disabled = true;
      try {
        let cookieData = extractedCookie || '';
        if (!cookieData && (/sessionid=|sid_tt=/i.test(rawInput) || rawInput.includes(';'))) {
          cookieData = rawInput;
        }
        if (!cookieData && pastedAccountMeta?.sessionid) {
          cookieData = `sessionid=${pastedAccountMeta.sessionid}`;
        }

        if (!cookieData) {
          throw new Error('Cookie sesi Dola (sessionid / sid_tt) tidak ditemukan dalam input.');
        }

        const sessionMatch = cookieData.match(/(?:^|;\s*)(?:sessionid|sid_tt)=([^;]+)/i);
        const uidMatch = cookieData.match(/(?:^|;\s*)(?:uid_tt|uid_tt_ss)=([^;]+)/i);
        const secUidMatch = cookieData.match(/(?:^|;\s*)flow_cur_user_sec_id=([^;]+)/i);

        const uid = pastedAccountMeta?.userId || (uidMatch ? uidMatch[1] : (secUidMatch ? secUidMatch[1].slice(0, 16) : `dola_${Date.now()}`));
        const sessionId = sessionMatch ? sessionMatch[1] : (pastedAccountMeta?.sessionid || '');

        const existingDolaAccs = accounts.filter((a) => a.provider === 'dola');
        const accData = {
          id: pastedAccountMeta?.id || `acc_dola_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          userId: uid,
          provider: 'dola',
          email: pastedAccountMeta?.email || `dola_${uid.slice(0, 8)}@dola.com`,
          name: pastedAccountMeta?.name || `Dola User (${uid.slice(0, 8)})`,
          chromeProfile: pastedAccountMeta?.chromeProfile || `Profile ${existingDolaAccs.length + 1}`,
          credits: typeof pastedAccountMeta?.credits === 'number' ? pastedAccountMeta.credits : 100,
          cookie: cookieData,
          sessionid: sessionId,
          createdAt: pastedAccountMeta?.createdAt || new Date().toISOString(),
          lastVerified: new Date().toISOString(),
        };

        const existingIdx = accounts.findIndex((a) => a.provider === 'dola' && (
          (accData.userId && a.userId === accData.userId) || 
          (accData.email && a.email === accData.email)
        ));
        if (existingIdx >= 0) {
          accounts[existingIdx] = { ...accounts[existingIdx], ...accData, id: accounts[existingIdx].id };
          activeAccountId = accounts[existingIdx].id;
        } else {
          accounts.push(accData);
          activeAccountId = accData.id;
        }

        setActiveProvider('dola');
        await saveAccounts();
        inputRefreshToken.value = '';

        if (typeof syncCookiesToBrowser === 'function') {
          await syncCookiesToBrowser({ cookieStr: cookieData, domainType: 'dola' });
        }

        renderHeaderAccount();
        renderAccountsList();

        showAuthAlert(`✅ Berhasil terhubung akun Dola AI: ${accData.name} (${accData.chromeProfile})!`, 'success');
        setTimeout(() => {
          const modal = document.getElementById('addAccountModal');
          modal?.classList.add('hidden');
        }, 1200);
        return;
      } catch (err) {
        showAuthAlert(`Gagal verifikasi Dola: ${err.message}`, 'error');
        return;
      } finally {
        btnAddAccount.disabled = false;
      }
    }

    if (!rawInput) {
      showAuthAlert('Refresh Token tidak ditemukan dalam data yang dimasukkan.', 'error');
      return;
    }

    if (rawInput.startsWith('eyJ')) {
      showAuthAlert('Perhatian: Teks yang dimasukkan adalah Access Token (eyJ...). Silakan gunakan Refresh Token (berawalan AMf-...) dari Bookmarklet agar sesi tidak expired dalam 1 jam.', 'error');
      return;
    }

    showAuthAlert('Memverifikasi token & session dengan Firebase/Weavy...', '');
    btnAddAccount.disabled = true;

    try {
      const accData = await exchangeRefreshToken(rawInput, extractedCookie);
      accData.provider = normalizedProvider;
      if (extractedCookie) {
        accData.cookie = extractedCookie;
      }
      if (pastedAccountMeta?.chromeProfile) {
        accData.chromeProfile = pastedAccountMeta.chromeProfile;
      }
      if (pastedAccountMeta?.name) {
        accData.name = pastedAccountMeta.name;
      }
      if (pastedAccountMeta?.email) {
        accData.email = pastedAccountMeta.email;
      }
      const existingIdx = accounts.findIndex((a) => a.userId === accData.userId || a.email === accData.email);
      if (existingIdx >= 0) {
        accounts[existingIdx] = { ...accounts[existingIdx], ...accData };
      } else {
        accounts.push(accData);
      }
      activeAccountId = accData.id;
      await saveAccounts();
      inputRefreshToken.value = '';

      // Otomatis bersihkan sesi lama di browser dan langsung login-kan tab Weavy ke akun baru ini (1-Klik Auto-Switch)
      await syncAccountSessionToBrowserTab(accData);
      await syncSingleAccount(accData.id);
      renderHeaderAccount();
      renderAccountsList();

      showAuthAlert(`✅ Berhasil terhubung & Tab Browser otomatis Login sebagai ${accData.email} (${accData.credits} Koin)!`, 'success');
      setTimeout(() => {
        const modal = document.getElementById('addAccountModal');
        modal?.classList.add('hidden');
      }, 1200);
    } catch (err) {
      showAuthAlert(`Gagal verifikasi: ${err.message}`, 'error');
    } finally {
      btnAddAccount.disabled = false;
    }
  }

  async function getFullGoogleCookieString() {
    if (typeof chrome === 'undefined' || !chrome.cookies) return '';
    try {
      const urls = [
        'https://accounts.google.com',
        'https://myaccount.google.com',
        'https://www.google.com',
        'https://google.com',
        'https://labs.google',
        'https://flow.google.com',
        'https://flow.google'
      ];
      
      const cookieMap = new Map();
      for (const url of urls) {
        const cookies = await chrome.cookies.getAll({ url }).catch(() => []);
        cookies.forEach((c) => {
          if (c && c.name && c.value) {
            cookieMap.set(c.name, c.value);
          }
        });
      }

      const list1 = await chrome.cookies.getAll({ domain: '.google.com' }).catch(() => []);
      const list2 = await chrome.cookies.getAll({ domain: 'google.com' }).catch(() => []);
      [...list1, ...list2].forEach((c) => {
        if (c && c.name && c.value) {
          cookieMap.set(c.name, c.value);
        }
      });

      // Guarantee core sibling pairs
      if (cookieMap.has('__Secure-1PSID') && !cookieMap.has('SID')) {
        cookieMap.set('SID', cookieMap.get('__Secure-1PSID'));
      }
      if (cookieMap.has('__Secure-1PAPISID') && !cookieMap.has('APISID')) {
        cookieMap.set('APISID', cookieMap.get('__Secure-1PAPISID'));
      }
      
      return Array.from(cookieMap.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    } catch (e) {
      console.warn('[Full Google Cookie Fetch Warning]:', e);
      return '';
    }
  }

  let authAlertTimeout = null;
  function showAuthAlert(msg, type = '') {
    const pageAlert = document.getElementById('settingsPageAlert');
    const modalAlert = document.getElementById('authStatusAlert');

    const updateAlertEl = (el) => {
      if (!el) return;
      el.className = `status-alert ${type}`.trim();
      el.textContent = msg;
      el.classList.remove('hidden');
      if (!type) {
        el.style.backgroundColor = 'var(--bg-tertiary, #222)';
        el.style.color = 'var(--text-primary, #fff)';
      } else {
        el.style.backgroundColor = '';
        el.style.color = '';
      }
    };

    updateAlertEl(pageAlert);
    updateAlertEl(modalAlert);

    if (authAlertTimeout) {
      clearTimeout(authAlertTimeout);
      authAlertTimeout = null;
    }

    if (type === 'success' || type === 'info') {
      authAlertTimeout = setTimeout(() => {
        if (pageAlert) pageAlert.classList.add('hidden');
        if (modalAlert) modalAlert.classList.add('hidden');
      }, 5500);
    }
  }

  async function handleAutoImportActiveAccount() {
    const isFlowProvider = activeProvider === 'flow';
    const isDolaProvider = activeProvider === 'dola';
    const isGeminiProvider = activeProvider === 'gemini';
    const targetHostLabel = isFlowProvider 
      ? 'labs.google / flow.google.com' 
      : (isDolaProvider ? 'dola.com' : (isGeminiProvider ? 'gemini.google.com' : 'app.weavy.ai'));

    showAuthAlert(`🔍 Mencari tab browser ${targetHostLabel} yang sedang aktif...`, 'info');

    const btnAutoImport = document.getElementById('btnAutoImportActiveAccount');
    const origHTML = btnAutoImport ? btnAutoImport.innerHTML : '';

    if (btnAutoImport) {
      btnAutoImport.disabled = true;
      btnAutoImport.innerHTML = `<svg class="icon-sm spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg><span>Mengambil Sesi...</span>`;
    }

    try {
      if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) {
        showAuthAlert(`⚡ Mengirim permintaan Auto-Import ke Ekstensi Chrome untuk tab ${targetHostLabel}...`, 'info');

        const bridgeRes = await new Promise((resolve) => {
          const taskId = 'import_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
          const listener = (event) => {
            if (event.source !== window || !event.data || typeof event.data !== 'object') return;
            if (event.data.type === 'AMB_AUTO_IMPORT_RESULT' && event.data.taskId === taskId) {
              window.removeEventListener('message', listener);
              clearTimeout(timer);
              resolve(event.data);
            }
          };
          window.addEventListener('message', listener);
          const timer = setTimeout(() => {
            window.removeEventListener('message', listener);
            resolve({
              success: false,
              error: 'Tidak ada respon dari Ekstensi Chrome. Pastikan ekstensi sudah di-load di chrome://extensions dan refresh (F5) tab browser ini.',
            });
          }, 12000);

          window.postMessage(
            {
              type: 'AMB_AUTO_IMPORT_REQUEST',
              taskId,
              payload: { provider: activeProvider },
            },
            '*'
          );
        });

        if (!bridgeRes || !bridgeRes.success || !bridgeRes.account) {
          showAuthAlert(bridgeRes?.error || 'Gagal Auto-Import via Ekstensi.', 'error');
          return;
        }

        const accData = bridgeRes.account;
        const existingIdx = accounts.findIndex((a) => a.id === accData.id || a.email === accData.email);
        if (existingIdx >= 0) {
          accounts[existingIdx] = { ...accounts[existingIdx], ...accData };
          activeAccountId = accounts[existingIdx].id;
        } else {
          accounts.push(accData);
          activeAccountId = accData.id;
        }
        await saveAccounts();
        renderHeaderAccount();
        renderAccountsList();
        showAuthAlert(`✅ Berhasil Auto-Import akun ${accData.email} (${accData.credits || 0} Koin) via Ekstensi!`, 'success');
        return;
      }

      let allTabs = [];
      try {
        allTabs = await chrome.tabs.query({});
      } catch (tabsErr) {
        console.warn('[Query all tabs warn]:', tabsErr);
      }

      let targetTab = null;
      if (isDolaProvider) {
        targetTab = allTabs.find((t) => t.active && t.url && /(dola\.(com|ai|org|net)|ciciai\.com|bytedance\.com)/i.test(t.url))
          || allTabs.find((t) => t.url && /(dola\.(com|ai|org|net)|ciciai\.com|bytedance\.com)/i.test(t.url));
      } else if (isFlowProvider) {
        targetTab = allTabs.find((t) => t.active && t.url && (/labs\.google|flow\.google\.com/i.test(t.url)))
          || allTabs.find((t) => t.url && (/labs\.google|flow\.google\.com|google\.com\/.*flow/i.test(t.url)));
      } else if (isGeminiProvider) {
        targetTab = allTabs.find((t) => t.active && t.url && /gemini\.google\.com/i.test(t.url))
          || allTabs.find((t) => t.url && /gemini\.google\.com/i.test(t.url));
      } else {
        targetTab = allTabs.find((t) => t.active && t.url && /weavy\.ai/i.test(t.url))
          || allTabs.find((t) => t.url && /weavy\.ai/i.test(t.url));
      }

      if (!targetTab) {
        if (isFlowProvider) {
          await chrome.tabs.create({ url: 'https://labs.google/fx/tools/flow', active: true });
          showAuthAlert('Tab Google Flow tidak ditemukan. Membuka https://labs.google/fx/tools/flow di browser, silakan login lalu klik Auto-Import lagi.', 'info');
          return;
        }
        if (isDolaProvider) {
          await chrome.tabs.create({ url: 'https://dola.com/chat', active: true });
          showAuthAlert('Tab Dola AI tidak ditemukan. Membuka https://dola.com/chat di browser, silakan login lalu klik Auto-Import lagi.', 'info');
          return;
        }
        if (isGeminiProvider) {
          await chrome.tabs.create({ url: 'https://gemini.google.com/app', active: true });
          showAuthAlert('Tab Google Gemini tidak ditemukan. Membuka https://gemini.google.com/app di browser, silakan login lalu klik Auto-Import lagi.', 'info');
          return;
        }
        // Provider Weavy
        await chrome.tabs.create({ url: 'https://app.weavy.ai', active: true });
        showAuthAlert('Tab Weavy tidak ditemukan. Membuka https://app.weavy.ai di browser, silakan login lalu klik Auto-Import lagi.', 'info');
        return;
      }

      if (isDolaProvider) {
        showAuthAlert('⚡ Membaca sesi login & cookies dari tab Dola AI...', 'info');

        // 1. Gather all cookies via chrome.cookies API across domains
        let dolaCookies = [];
        const cookieDomains = ['dola.com', '.dola.com', 'www.dola.com', 'ciciai.com', '.ciciai.com', 'bytedance.com'];
        for (const dom of cookieDomains) {
          try {
            const found = await chrome.cookies.getAll({ domain: dom });
            if (Array.isArray(found)) dolaCookies.push(...found);
          } catch (_) {}
        }
        if (targetTab.url) {
          try {
            const byUrl = await chrome.cookies.getAll({ url: targetTab.url });
            if (Array.isArray(byUrl)) dolaCookies.push(...byUrl);
          } catch (_) {}
        }

        // Deduplicate cookies by name
        const cookieMap = new Map();
        dolaCookies.forEach((c) => {
          if (c && c.name && c.value && !cookieMap.has(c.name)) {
            cookieMap.set(c.name, c.value);
          }
        });

        // 2. Inject in-page reader to extract document.cookie, localStorage, sessionStorage, and user info from DOM / API
        let inPageData = null;
        try {
          const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: targetTab.id },
            func: async () => {
              try {
                const docCookie = document.cookie || '';
                const lsData = {};
                for (let i = 0; i < localStorage.length; i++) {
                  const k = localStorage.key(i);
                  if (k) {
                    try {
                      lsData[k] = localStorage.getItem(k);
                    } catch (_) {}
                  }
                }

                // Check DOM for profile indicators
                let detectedName = '';
                let detectedEmail = '';
                let detectedAvatar = '';
                let detectedCredits = 100;

                const textNodes = document.body ? document.body.innerText : '';
                const emailMatch = textNodes.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
                if (emailMatch) detectedEmail = emailMatch[0];

                const avatarEl = document.querySelector('img[src*="avatar"], img[src*="user"], img[src*="profile"], .avatar img');
                if (avatarEl && avatarEl.src) detectedAvatar = avatarEl.src;

                // Attempt to fetch current user profile from internal Dola/ByteDance API if session active
                let apiUser = null;
                const testEndpoints = [
                  '/api/v1/user/info', 
                  '/api/user/info', 
                  '/api/v1/user/profile', 
                  '/api/v1/chat/conversation/list',
                  'https://dola.com/api/v1/user/info',
                  'https://dola.com/api/user/info'
                ];
                for (const ep of testEndpoints) {
                  try {
                    const r = await fetch(ep, {
                      method: 'GET',
                      headers: { Accept: 'application/json, text/plain, */*' },
                      credentials: 'include',
                    });
                    if (r.ok) {
                      const data = await r.json();
                      if (data && (data.data || data.user || data.user_info || data.data?.user_info)) {
                        apiUser = data.data?.user_info || data.data?.user || data.user || data.user_info || data.data;
                        break;
                      }
                    }
                  } catch (_) {}
                }

                if (apiUser) {
                  detectedName = apiUser.nickname || apiUser.name || apiUser.username || detectedName;
                  detectedEmail = apiUser.email || apiUser.user_email || detectedEmail;
                  detectedAvatar = apiUser.avatar_url || apiUser.avatar || detectedAvatar;
                  if (typeof apiUser.credits === 'number') detectedCredits = apiUser.credits;
                }

                return {
                  success: true,
                  docCookie,
                  lsData,
                  apiUser,
                  detectedName,
                  detectedEmail,
                  detectedAvatar,
                  detectedCredits,
                };
              } catch (err) {
                return { success: false, error: err.message };
              }
            },
          });
          inPageData = injectionResults?.[0]?.result;
        } catch (inPageErr) {
          console.warn('[Dola in-page injection warn]:', inPageErr);
        }

        // Merge in-page document.cookie into cookieMap
        if (inPageData?.docCookie) {
          inPageData.docCookie.split(';').forEach((part) => {
            const eqIdx = part.indexOf('=');
            if (eqIdx > 0) {
              const name = part.substring(0, eqIdx).trim();
              const value = part.substring(eqIdx + 1).trim();
              if (name && value && !cookieMap.has(name)) {
                cookieMap.set(name, value);
              }
            }
          });
        }

        // Look for session identifier in cookies or localStorage
        let sessionidVal = cookieMap.get('sessionid') || cookieMap.get('sid_tt') || cookieMap.get('sid_guard') || cookieMap.get('dola_token');
        if (!sessionidVal && inPageData?.lsData) {
          for (const [k, v] of Object.entries(inPageData.lsData)) {
            if (/token|session|auth|user_id/i.test(k) && typeof v === 'string' && v.length > 5) {
              sessionidVal = v;
              break;
            }
          }
        }

        const uidVal = cookieMap.get('uid_tt') || cookieMap.get('uid_tt_ss') || inPageData?.apiUser?.user_id || inPageData?.apiUser?.id || '';

        // Check if there is any valid login session
        if (!sessionidVal && !uidVal && !inPageData?.apiUser && (!inPageData?.docCookie || inPageData.docCookie.length < 5)) {
          showAuthAlert(`⚠️ Tab Dola AI ditemukan (${targetTab.title || 'dola.com/chat'}), namun belum login. Silakan login ke akun Dola AI di tab browser sebelah kiri, lalu klik tombol Auto-Import Akun lagi.`, 'error');
          return;
        }

        const cookiePairs = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`);
        const cookieStr = cookiePairs.length > 0 ? cookiePairs.join('; ') : (inPageData?.docCookie || '');

        const effectiveUid = uidVal || (sessionidVal ? `dola_${sessionidVal.slice(0, 10)}` : `dola_${Date.now()}`);
        const existingDolaAccs = accounts.filter((a) => a.provider === 'dola');
        const defaultProfileName = `Profile ${existingDolaAccs.length + 1}`;

        const accName = inPageData?.detectedName || inPageData?.apiUser?.nickname || `Dola User (${effectiveUid.slice(0, 8)})`;
        const accEmail = inPageData?.detectedEmail || inPageData?.apiUser?.email || `dola_${effectiveUid.slice(0, 8)}@dola.com`;

        const accData = {
          id: `acc_dola_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          userId: effectiveUid,
          provider: 'dola',
          email: accEmail,
          name: accName,
          avatarUrl: inPageData?.detectedAvatar || '',
          chromeProfile: defaultProfileName,
          credits: (typeof inPageData?.detectedCredits === 'number' && inPageData.detectedCredits <= 4) ? inPageData.detectedCredits : 4,
          cookie: cookieStr,
          sessionid: sessionidVal || '',
          createdAt: new Date().toISOString(),
          lastVerified: new Date().toISOString(),
        };

        const existingIdx = accounts.findIndex((a) => a.provider === 'dola' && (
          (a.userId && a.userId === accData.userId) || 
          (a.email && a.email.toLowerCase() === accData.email.toLowerCase()) ||
          (a.sessionid && accData.sessionid && a.sessionid === accData.sessionid)
        ));

        if (existingIdx >= 0) {
          accounts[existingIdx] = { 
            ...accounts[existingIdx], 
            ...accData, 
            id: accounts[existingIdx].id,
            chromeProfile: accounts[existingIdx].chromeProfile || accData.chromeProfile 
          };
          activeAccountId = accounts[existingIdx].id;
        } else {
          accounts.push(accData);
          activeAccountId = accData.id;
        }

        setActiveProvider('dola');
        await saveAccounts();
        renderHeaderAccount();
        renderAccountsList();

        // Otomatis sinkronkan saldo & status generasi akun Dola yang baru di-import secara individu
        const targetSyncId = activeAccountId;
        try {
          showAuthAlert(`⚡ Mengambil saldo & status kuota Dola AI untuk ${accData.name}...`, 'info');
          await syncSingleAccount(targetSyncId);
        } catch (syncErr) {
          console.warn('[Auto-Import Dola Sync Warning]:', syncErr);
        }

        const currentAcc = accounts.find((a) => a.id === targetSyncId) || accData;
        const creditStatusText = currentAcc.credits === 0 ? 'Sudah generate hari ini' : 'Belum generate hari ini';

        showAuthAlert(`✅ Berhasil Auto-Import & Sync akun Dola AI: ${currentAcc.name}!`, 'success');
        setTimeout(() => {
          const modal = document.getElementById('addAccountModal');
          modal?.classList.add('hidden');
        }, 1500);
        return;
      }

      if (isFlowProvider) {
        const injectionResults = await chrome.scripting.executeScript({
          target: { tabId: targetTab.id },
          func: async () => {
            try {
              const getEmailFromText = (input = '') => {
                const matches = [...String(input).matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)];
                return matches[0]?.[0] || '';
              };

              const openFlowAccountPanel = async () => {
                try {
                  const accountButtons = [
                    ...document.querySelectorAll('button, [role="button"], a'),
                  ].filter((el) => {
                    const text = (el.innerText || el.textContent || '').trim();
                    const aria = el.getAttribute('aria-label') || '';
                    const title = el.getAttribute('title') || '';
                    return /account details|google account/i.test(`${text} ${aria} ${title}`);
                  });

                  const target = accountButtons.find((el) => /account details/i.test((el.innerText || el.textContent || '').trim() + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || ''))) || accountButtons[0];

                  if (target && typeof target.click === 'function') {
                    target.click();
                    await new Promise((resolve) => setTimeout(resolve, 700));
                    return true;
                  }
                } catch (error) {
                  console.warn('[Flow Account Panel]:', error);
                }
                return false;
              };

              await openFlowAccountPanel();

              const nodeTexts = [];
              const nodes = document.querySelectorAll('body *');
              nodes.forEach((node) => {
                const values = [
                  node.textContent,
                  node.getAttribute('aria-label'),
                  node.getAttribute('title'),
                  node.getAttribute('alt'),
                ].filter(Boolean);
                if (values.length) {
                  nodeTexts.push(values.join(' '));
                }
              });

              const pageText = document.body ? (document.body.innerText || '') : '';
              const combinedText = [...nodeTexts, pageText].join(' ');
              const matcher = /Google Account:\s*([^\n\r]+?)\s*\(([^\)]+)\)/i;
              const match = combinedText.match(matcher);

              const creditMatch = combinedText.match(/(\d+(?:\.\d+)?)\s*(?:Google\s+Flow\s+)?credits/i)
                || pageText.match(/(\d+(?:\.\d+)?)\s*(?:Google\s+Flow\s+)?credits/i)
                || document.body?.innerText?.match(/(\d+(?:\.\d+)?)\s*(?:Google\s+Flow\s+)?credits/i);

              const parsedCredits = creditMatch ? Number(creditMatch[1]) : 0;

              const emailCandidates = [...new Set(
                [combinedText, pageText]
                  .flatMap((text) => [...String(text).matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)])
                  .map((m) => m[0])
              )].filter(Boolean);

              const cookie = document.cookie || '';
              const storageKeys = [];
              const storageTextParts = [];

              try {
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (key && /google|flow|auth|session|account|user/i.test(key)) {
                    storageKeys.push(key);
                  }
                  try {
                    const value = localStorage.getItem(key) || '';
                    if (value) storageTextParts.push(value);
                  } catch (error) {}
                }
              } catch (error) {}

              try {
                for (let i = 0; i < sessionStorage.length; i++) {
                  const key = sessionStorage.key(i);
                  if (key && /google|flow|auth|session|account|user/i.test(key)) {
                    storageKeys.push(key);
                  }
                  try {
                    const value = sessionStorage.getItem(key) || '';
                    if (value) storageTextParts.push(value);
                  } catch (error) {}
                }
              } catch (error) {}

              const fallbackEmail = getEmailFromText(storageTextParts.join(' ')) || getEmailFromText(cookie) || '';
              const email = emailCandidates[0] || (match ? match[2]?.trim() : '') || fallbackEmail || '';
              const name = match ? match[1]?.trim() : '' || (email ? email.split('@')[0] : 'Google User');

              if (!email) {
                return { success: false, error: 'Sesi Google Flow tidak terdeteksi. Pastikan akun Google sudah login di flow.google.com.' };
              }

              return {
                success: true,
                email,
                name,
                userId: email,
                cookie,
                storageKeys,
                credits: Number.isFinite(parsedCredits) ? parsedCredits : 0,
              };
            } catch (error) {
              return { success: false, error: error.message || 'Gagal membaca sesi Flow.' };
            }
          },
        });

        const res = injectionResults?.[0]?.result;
        if (!res || !res.success || !res.email) {
          showAuthAlert(res?.error || 'Gagal membaca sesi login dari tab flow.google.com. Pastikan Anda sudah login dengan akun Google.', 'error');
          return;
        }

        let fullCookieStr = '';
        try {
          fullCookieStr = await getFullGoogleCookieString();
        } catch (e) {}

        const finalCookie = fullCookieStr || res.cookie || '';

        const existingIdx = accounts.findIndex((account) => account.provider === 'flow' && (account.email?.toLowerCase() === res.email.toLowerCase() || account.userId === res.userId));
        const flowAccountsCount = accounts.filter((a) => a.provider === 'flow').length;
        const defaultProfileName = existingIdx >= 0 && accounts[existingIdx].chromeProfile 
          ? accounts[existingIdx].chromeProfile 
          : `Profile ${flowAccountsCount + 1}`;

        const accData = {
          id: existingIdx >= 0 ? accounts[existingIdx].id : `flow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          userId: res.userId || res.email,
          email: res.email,
          name: res.name || res.email.split('@')[0],
          provider: 'flow',
          chromeProfile: defaultProfileName,
          refreshToken: '',
          idToken: '',
          cookie: finalCookie,
          credits: typeof res.credits === 'number' ? res.credits : 0,
          createdAt: new Date().toISOString(),
          lastVerified: new Date().toISOString(),
        };

        if (existingIdx >= 0) {
          accounts[existingIdx] = { ...accounts[existingIdx], ...accData };
        } else {
          accounts.push(accData);
        }

        activeAccountId = accData.id;
        setActiveProvider('flow');
        showAuthAlert(`✅ Berhasil terhubung akun Flow: ${accData.email}`, 'success');
        return;
      }

      if (isGeminiProvider) {
        showAuthAlert('⚡ Membaca sesi login Google Gemini dari tab browser...', 'info');

        let geminiCookies = [];
        const cookieDomains = ['gemini.google.com', '.google.com'];
        for (const dom of cookieDomains) {
          try {
            const found = await chrome.cookies.getAll({ domain: dom });
            if (Array.isArray(found)) geminiCookies.push(...found);
          } catch (_) {}
        }
        if (targetTab.url) {
          try {
            const byUrl = await chrome.cookies.getAll({ url: targetTab.url });
            if (Array.isArray(byUrl)) geminiCookies.push(...byUrl);
          } catch (_) {}
        }

        const cookieMap = new Map();
        geminiCookies.forEach((c) => {
          if (c && c.name && c.value && !cookieMap.has(c.name)) {
            cookieMap.set(c.name, c.value);
          }
        });

        let inPageData = null;
        try {
          const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: targetTab.id },
            func: async () => {
              try {
                let detectedEmail = '';
                let detectedName = '';
                let detectedAvatar = '';

                // 1. Check Google Account Button in Top Right
                const accountButtons = [
                  ...document.querySelectorAll('a[href*="accounts.google.com"], button[aria-label*="Google Account"], a[aria-label*="Google Account"], [aria-label*="Akun Google"], [data-email]')
                ];
                for (const el of accountButtons) {
                  const aria = el.getAttribute('aria-label') || '';
                  const title = el.getAttribute('title') || '';
                  const dEmail = el.getAttribute('data-email') || '';
                  if (dEmail) detectedEmail = dEmail;
                  const combined = `${aria} ${title}`;
                  const emailMatch = combined.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
                  if (emailMatch && !detectedEmail) detectedEmail = emailMatch[0];
                  const nameMatch = combined.match(/(?:Google Account|Akun Google):\s*([^(\n]+)/i);
                  if (nameMatch && !detectedName) detectedName = nameMatch[1].trim();
                  const img = el.querySelector('img');
                  if (img && img.src && !detectedAvatar) detectedAvatar = img.src;
                }

                // 2. Check WIZ_global_data if available
                if (typeof window.WIZ_global_data === 'object' && window.WIZ_global_data !== null) {
                  const wiz = window.WIZ_global_data;
                  if (wiz.o6vvdc && !detectedEmail) detectedEmail = wiz.o6vvdc;
                  if (wiz.SNlM0e) {
                    // SNlM0e is Google's session token for Gemini RPC calls
                  }
                }

                // 3. Fallback to scanning body for emails
                if (!detectedEmail) {
                  const pageText = document.body ? (document.body.innerText || '') : '';
                  const m = pageText.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
                  if (m) detectedEmail = m[0];
                }

                return {
                  success: true,
                  detectedEmail,
                  detectedName,
                  detectedAvatar,
                };
              } catch (err) {
                return { success: false, error: err.message };
              }
            }
          });
          inPageData = injectionResults?.[0]?.result;
        } catch (e) {
          console.warn('[Gemini in-page script warn]:', e);
        }

        const email = inPageData?.detectedEmail || `gemini_user_${Date.now().toString(36).slice(-4)}@gmail.com`;
        const name = inPageData?.detectedName || email.split('@')[0] || 'Gemini User';
        const existingGeminiAccs = accounts.filter((a) => a.provider === 'gemini');
        const defaultProfile = `Profile ${existingGeminiAccs.length + 1}`;

        const cookieParts = [];
        cookieMap.forEach((v, k) => cookieParts.push(`${k}=${v}`));
        const cookieStr = cookieParts.join('; ');

        const accData = {
          id: `acc_gemini_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          userId: email,
          provider: 'gemini',
          email,
          name,
          chromeProfile: defaultProfile,
          credits: 100,
          cookie: cookieStr,
          avatar: inPageData?.detectedAvatar || '',
          createdAt: new Date().toISOString(),
          lastVerified: new Date().toISOString(),
        };

        const existingIdx = accounts.findIndex((a) => a.provider === 'gemini' && (a.email?.toLowerCase() === email.toLowerCase() || a.userId === accData.userId));
        if (existingIdx >= 0) {
          accounts[existingIdx] = { ...accounts[existingIdx], ...accData, id: accounts[existingIdx].id };
          activeAccountId = accounts[existingIdx].id;
        } else {
          accounts.push(accData);
          activeAccountId = accData.id;
        }

        setActiveProvider('gemini');
        await saveAccounts();
        renderHeaderAccount();
        renderAccountsList();

        showAuthAlert(`✅ Berhasil terhubung akun Google Gemini: ${accData.email} (${accData.chromeProfile})!`, 'success');
        setTimeout(() => {
          const modal = document.getElementById('addAccountModal');
          modal?.classList.add('hidden');
        }, 1500);
        return;
      }

      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        func: async () => {
          try {
            const getDbUser = () =>
              new Promise((resolve) => {
                try {
                  const req = indexedDB.open('firebaseLocalStorageDb');
                  req.onsuccess = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
                      db.close();
                      return resolve(null);
                    }
                    const store = db.transaction('firebaseLocalStorage', 'readonly').objectStore('firebaseLocalStorage');
                    const allReq = store.getAll();
                    allReq.onsuccess = (ev) => {
                      const list = ev.target.result || [];
                      db.close();
                      for (const item of list) {
                        const val = item && item.value ? item.value : item;
                        if (val?.stsTokenManager?.refreshToken) {
                          return resolve(val);
                        }
                      }
                      resolve(null);
                    };
                    allReq.onerror = () => {
                      db.close();
                      resolve(null);
                    };
                  };
                  req.onerror = () => resolve(null);
                } catch (err) {
                  resolve(null);
                }
              });

            let authUser = await getDbUser();

            if (!authUser) {
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('firebase:authUser')) {
                  try {
                    const parsed = JSON.parse(localStorage.getItem(k));
                    if (parsed?.stsTokenManager?.refreshToken) {
                      authUser = parsed;
                      break;
                    }
                  } catch (e) {}
                }
              }
            }

            if (!authUser || !authUser.stsTokenManager || !authUser.stsTokenManager.refreshToken) {
              return { success: false, error: 'Sesi login tidak ditemukan di tab Weavy. Pastikan Anda sudah login di app.weavy.ai.' };
            }

            const refreshToken = authUser.stsTokenManager.refreshToken;
            let accessToken = authUser.stsTokenManager.accessToken;
            let email = authUser.email || '';
            let uid = authUser.uid || '';
            let name = authUser.displayName || '';
            let credits = null;
            let userData = null;

            try {
              if (accessToken) {
                const apiRes = await fetch('https://api.weavy.ai/api/v1/users', {
                  headers: {
                    Accept: 'application/json, text/plain, */*',
                    Authorization: `Bearer ${accessToken}`,
                    'x-weavy-auth-provider': 'firebase',
                    'x-app-version': '4.1.1316',
                  },
                  credentials: 'include',
                });
                if (apiRes.ok) {
                  userData = await apiRes.json();
                  if (userData) {
                    credits = userData.credits ?? userData.activeWorkspace?.credits ?? userData.subscription?.credits ?? null;
                    if (userData.email) email = userData.email;
                    if (userData.id) uid = userData.id;
                    if (userData.name) name = userData.name;
                  }
                }
              }
            } catch (fetchErr) {
              console.warn('[Tab Injected Fetch Warning]:', fetchErr);
            }

            return {
              success: true,
              refreshToken,
              accessToken,
              email,
              uid,
              name,
              credits,
              userData,
              cookie: document.cookie || '',
            };
          } catch (e) {
            return { success: false, error: e.message };
          }
        },
      });

      const res = injectionResults?.[0]?.result;
      if (!res || !res.success || !res.refreshToken) {
        showAuthAlert(res?.error || 'Gagal membaca sesi login dari tab Weavy. Pastikan Anda sudah login di app.weavy.ai.', 'error');
        return;
      }

      const providerName = activeProvider === 'flow' ? 'Flow' : 'Weavy';
      showAuthAlert(`Sesi ${res.email || providerName} terbaca! Menyinkronkan akun...`, '');

      const accData = await exchangeRefreshToken(res.refreshToken, res.cookie);
      accData.provider = activeProvider === 'flow' ? 'flow' : 'weavy';
      if (res.cookie) {
        accData.cookie = res.cookie;
      }
      if (typeof res.credits === 'number' && res.credits > 0) {
        accData.credits = res.credits;
      }
      if (res.name && (!accData.name || accData.name.includes('@'))) {
        accData.name = res.name;
      }

      const existingIdx = accounts.findIndex((a) => a.userId === accData.userId || a.email === accData.email);
      if (existingIdx >= 0) {
        accounts[existingIdx] = { ...accounts[existingIdx], ...accData };
      } else {
        accounts.push(accData);
      }
      activeAccountId = accData.id;
      await saveAccounts();

      showAuthAlert(`✅ Berhasil terhubung! Akun: ${accData.email} (${accData.credits ?? 0} Koin)`, 'success');

      setTimeout(() => {
        const modal = document.getElementById('addAccountModal');
        modal?.classList.add('hidden');
      }, 1200);
    } catch (err) {
      console.error('[Auto-Import Error]:', err);
      showAuthAlert(`Gagal Auto-Import: ${err.message}`, 'error');
    } finally {
      if (btnAutoImport && origHTML) {
        btnAutoImport.innerHTML = origHTML;
        btnAutoImport.disabled = false;
      }
    }
  }

  async function syncSingleAccount(accountId) {
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) return;

    showAuthAlert(`Menyinkronkan saldo akun ${acc.email}...`, '');

    try {
      if (acc.provider === 'flow') {
        if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) {
          throw new Error('Fitur sync akun Flow hanya dapat berjalan di dalam ekstensi Chrome.');
        }

        const tabs = await chrome.tabs.query({ url: ['*://flow.google.com/*', '*://*.flow.google.com/*'] });
        const targetTab = tabs.find((t) => t.active) || tabs[0];

        if (!targetTab) {
          await chrome.tabs.create({ url: 'https://flow.google.com/', active: false });
          showAuthAlert('Tab Google Flow tidak ditemukan. Saya sudah membuka flow.google.com, silakan login lalu klik sync ulang.', 'info');
          return;
        }

        const injectionResults = await chrome.scripting.executeScript({
          target: { tabId: targetTab.id },
          func: async () => {
            try {
              const getEmailFromText = (input = '') => {
                const matches = [...String(input).matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)];
                return matches[0]?.[0] || '';
              };

              const openFlowAccountPanel = async () => {
                try {
                  const accountButtons = [...document.querySelectorAll('button, [role="button"], a')].filter((el) => {
                    const text = (el.innerText || el.textContent || '').trim();
                    const aria = el.getAttribute('aria-label') || '';
                    const title = el.getAttribute('title') || '';
                    return /account details|google account/i.test(`${text} ${aria} ${title}`);
                  });
                  const target = accountButtons.find((el) => /account details/i.test((el.innerText || el.textContent || '').trim() + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || ''))) || accountButtons[0];
                  if (target && typeof target.click === 'function') {
                    target.click();
                    await new Promise((resolve) => setTimeout(resolve, 700));
                    return true;
                  }
                } catch (error) {
                  console.warn('[Flow Sync]:', error);
                }
                return false;
              };

              await openFlowAccountPanel();

              const pageText = document.body ? (document.body.innerText || '') : '';
              const matcher = /Google Account:\s*([^\n\r]+?)\s*\(([^\)]+)\)/i;
              const match = pageText.match(matcher);
              const creditMatch = pageText.match(/(\d+(?:\.\d+)?)\s*(?:Google\s+Flow\s+)?credits/i);
              const parsedCredits = creditMatch ? Number(creditMatch[1]) : 0;
              const email = getEmailFromText(pageText) || (match ? match[2]?.trim() : '') || '';
              const name = match ? match[1]?.trim() : '' || (email ? email.split('@')[0] : 'Google User');

              if (!email) {
                return { success: false, error: 'Sesi Google Flow tidak terdeteksi. Pastikan akun Google sudah login di flow.google.com.' };
              }

              return {
                success: true,
                email,
                name,
                userId: email,
                credits: Number.isFinite(parsedCredits) ? parsedCredits : 0,
                cookie: document.cookie || '',
              };
            } catch (error) {
              return { success: false, error: error.message || 'Gagal membaca sesi Flow.' };
            }
          },
        });

        const res = injectionResults?.[0]?.result;
        if (!res || !res.success || !res.email) {
          throw new Error(res?.error || 'Gagal membaca akun aktif dari tab Flow.');
        }

        acc.email = res.email || acc.email;
        acc.name = res.name || acc.name || (res.email || '').split('@')[0];
        acc.userId = res.userId || res.email || acc.userId;
        acc.credits = typeof res.credits === 'number' ? res.credits : (acc.credits ?? 0);
        acc.cookie = res.cookie || acc.cookie || '';
        acc.lastVerified = new Date().toISOString();
        await saveAccounts();
        renderHeaderAccount();
        renderAccountsList();
        showAuthAlert(`✅ Berhasil sync akun Flow ${acc.email}! Saldo: ${acc.credits} Credits`, 'success');
        return;
      }

      if (acc.provider === 'dola') {
        const dolaCredits = await fetchUserCreditsFromDolaHelper({
          account: acc,
          storage,
          syncCookiesToBrowser: syncCookiesToBrowserHelper,
        });
        acc.credits = dolaCredits;
        acc.lastVerified = new Date().toISOString();
        await saveAccounts();
        renderHeaderAccount();
        renderAccountsList();
        showAuthAlert(`✅ Berhasil sync akun Dola AI ${acc.name || acc.email}!`, 'success');
        return;
      }

      if (acc.provider === 'gemini') {
        if (acc.apiKey) {
          showAuthAlert(`Memverifikasi API Key Gemini (${acc.email})...`, '');
          const testResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${acc.apiKey}`).catch(() => null);
          if (testResp && testResp.ok) {
            acc.lastVerified = new Date().toISOString();
            acc.credits = 1000;
            await saveAccounts();
            renderHeaderAccount();
            renderAccountsList();
            showAuthAlert(`✅ API Key Gemini aktif & valid! (${acc.email})`, 'success');
            return;
          } else {
            showAuthAlert(`⚠️ API Key Gemini tidak valid atau kuota habis.`, 'error');
            return;
          }
        }

        if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) {
          throw new Error('Fitur sync akun Gemini hanya dapat berjalan di dalam ekstensi Chrome.');
        }

        const tabs = await chrome.tabs.query({ url: ['*://gemini.google.com/*', '*://*.gemini.google.com/*'] });
        const targetTab = tabs.find((t) => t.active) || tabs[0];

        if (!targetTab) {
          await chrome.tabs.create({ url: 'https://gemini.google.com/app', active: false });
          showAuthAlert('Tab Google Gemini tidak ditemukan. Membuka gemini.google.com, silakan login lalu klik sync ulang.', 'info');
          return;
        }

        const injectionResults = await chrome.scripting.executeScript({
          target: { tabId: targetTab.id },
          func: async () => {
            try {
              let detectedEmail = '';
              let detectedName = '';
              const accountButtons = [
                ...document.querySelectorAll('a[href*="accounts.google.com"], button[aria-label*="Google Account"], a[aria-label*="Google Account"], [aria-label*="Akun Google"], [data-email]')
              ];
              for (const el of accountButtons) {
                const aria = el.getAttribute('aria-label') || '';
                const title = el.getAttribute('title') || '';
                const dEmail = el.getAttribute('data-email') || '';
                if (dEmail) detectedEmail = dEmail;
                const combined = `${aria} ${title}`;
                const emailMatch = combined.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
                if (emailMatch && !detectedEmail) detectedEmail = emailMatch[0];
                const nameMatch = combined.match(/(?:Google Account|Akun Google):\s*([^(\n]+)/i);
                if (nameMatch && !detectedName) detectedName = nameMatch[1].trim();
              }

              return {
                success: true,
                email: detectedEmail,
                name: detectedName,
                cookie: document.cookie || '',
              };
            } catch (e) {
              return { success: false, error: e.message };
            }
          },
        });

        const res = injectionResults?.[0]?.result;
        if (!res || !res.success) {
          throw new Error(res?.error || 'Gagal membaca sesi tab Google Gemini.');
        }

        if (res.email) acc.email = res.email;
        if (res.name) acc.name = res.name;
        if (res.cookie) acc.cookie = res.cookie;
        acc.lastVerified = new Date().toISOString();
        await saveAccounts();
        renderHeaderAccount();
        renderAccountsList();
        showAuthAlert(`✅ Berhasil sync akun Google Gemini ${acc.email || acc.name}!`, 'success');
        return;
      }

      if (acc.provider === 'weavy' || !acc.provider) {
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
          try {
            const tabs = await chrome.tabs.query({ url: ['*://app.weavy.ai/*', '*://*.weavy.ai/*'] });
            const targetTab = tabs.find((t) => t.active) || tabs[0];
            if (targetTab && targetTab.id) {
              const injectionResults = await chrome.scripting.executeScript({
                target: { tabId: targetTab.id },
                func: async () => {
                  try {
                    const getDbUser = () =>
                      new Promise((resolve) => {
                        try {
                          const req = indexedDB.open('firebaseLocalStorageDb');
                          req.onsuccess = (e) => {
                            const db = e.target.result;
                            if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
                              db.close();
                              return resolve(null);
                            }
                            const store = db.transaction('firebaseLocalStorage', 'readonly').objectStore('firebaseLocalStorage');
                            const allReq = store.getAll();
                            allReq.onsuccess = (ev) => {
                              const list = ev.target.result || [];
                              db.close();
                              for (const item of list) {
                                const val = item && item.value ? item.value : item;
                                if (val?.stsTokenManager?.refreshToken) return resolve(val);
                              }
                              resolve(null);
                            };
                            allReq.onerror = () => {
                              db.close();
                              resolve(null);
                            };
                          };
                          req.onerror = () => resolve(null);
                        } catch (err) {
                          resolve(null);
                        }
                      });

                    let authUser = await getDbUser();
                    if (!authUser) {
                      for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        if (k && k.startsWith('firebase:authUser')) {
                          try {
                            const parsed = JSON.parse(localStorage.getItem(k));
                            if (parsed?.stsTokenManager?.refreshToken) {
                              authUser = parsed;
                              break;
                            }
                          } catch (e) {}
                        }
                      }
                    }

                    if (authUser?.stsTokenManager?.refreshToken) {
                      return {
                        success: true,
                        refreshToken: authUser.stsTokenManager.refreshToken,
                        accessToken: authUser.stsTokenManager.accessToken,
                        cookie: document.cookie || '',
                        email: authUser.email || '',
                      };
                    }
                    return { success: false };
                  } catch (e) {
                    return { success: false, error: e.message };
                  }
                },
              });

              const res = injectionResults?.[0]?.result;
              if (res && res.success && res.refreshToken) {
                acc.refreshToken = res.refreshToken;
                if (res.accessToken) acc.idToken = res.accessToken;
                if (res.cookie) acc.cookie = res.cookie;
                if (res.email) acc.email = res.email;
              }
            }
          } catch (e) {
            console.warn('[Weavy tab sync check warning]:', e);
          }
        }
      }

      if (!acc.refreshToken) return;

      const updated = await exchangeRefreshToken(acc.refreshToken, acc.cookie);
      if (updated) {
        acc.credits = typeof updated.credits === 'number' ? updated.credits : acc.credits;
        acc.idToken = updated.idToken || acc.idToken;
        acc.refreshToken = updated.refreshToken || acc.refreshToken;
        acc.expiresAt = updated.expiresAt || acc.expiresAt;
        acc.lastVerified = new Date().toISOString();
        await saveAccounts();
        renderHeaderAccount();
        renderAccountsList();
        showAuthAlert(`✅ Berhasil sync akun ${acc.email}! Saldo: ${acc.credits} Koin`, 'success');
      }
    } catch (err) {
      showAuthAlert(`Gagal sync akun ${acc.email}: ${err.message}`, 'error');
    }
  }

  async function syncAllAccounts() {
    if (!accounts || accounts.length === 0) {
      showAuthAlert('Tidak ada akun untuk disinkronkan.', 'error');
      return;
    }

    const btnSyncAll = document.getElementById('btnSyncAllAccounts');

    // Save original HTML and show full button spinner
    const originalHTML = btnSyncAll?.innerHTML || '';
    if (btnSyncAll) {
      btnSyncAll.disabled = true;
      btnSyncAll.innerHTML = `<svg class="icon-sm spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 4v6h-6M1 20v-6h6"/>
        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
      </svg><span>Syncing...</span>`;
    }

    showAuthAlert(`Menyinkronkan saldo & token untuk ${accounts.length} akun...`, '');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      if (!acc) continue;

      if (acc.provider === 'dola') {
        try {
          const dolaCredits = await fetchUserCreditsFromDolaHelper({
            account: acc,
            storage,
            syncCookiesToBrowser: syncCookiesToBrowserHelper,
          });
          accounts[i] = {
            ...acc,
            credits: dolaCredits,
            lastVerified: new Date().toISOString(),
          };
          successCount++;
        } catch (err) {
          console.warn(`[Sync All] Gagal sync akun Dola ${acc.email}:`, err);
          failCount++;
        }
      } else if (acc.refreshToken) {
        try {
          const updated = await exchangeRefreshToken(acc.refreshToken, acc.cookie);
          if (updated) {
            accounts[i] = {
              ...acc,
              userId: updated.userId || acc.userId,
              email: updated.email || acc.email,
              name: updated.name || acc.name,
              picture: updated.picture || acc.picture,
              credits: typeof updated.credits === 'number' ? updated.credits : 0,
              idToken: updated.idToken || acc.idToken,
              refreshToken: updated.refreshToken || acc.refreshToken,
              expiresAt: updated.expiresAt || acc.expiresAt,
              lastVerified: new Date().toISOString()
            };
            successCount++;
          }
        } catch (err) {
          console.warn(`[Sync All] Gagal sync akun ${acc.email}:`, err);
          failCount++;
        }
      }
    }

    await saveAccounts();
    renderHeaderAccount();
    renderAccountsList();

    // Restore original button content
    if (btnSyncAll) {
      btnSyncAll.innerHTML = originalHTML;
      btnSyncAll.disabled = false;
    }

    if (successCount > 0) {
      showAuthAlert(`Sync All Berhasil! ${successCount} dari ${accounts.length} akun tersinkronisasi.`, 'success');
    } else {
      showAuthAlert(`Sync All Gagal. Pastikan koneksi internet atau token akun valid.`, 'error');
    }
  }

  async function refreshCredits() {
    const acc = getActiveAccount();
    if (!acc) return;
    if (activeProvider === 'flow' || activeProvider === 'dola' || acc.provider === 'dola') return;

    // Set loading state on button
    const originalHTML = btnRefreshCredits.innerHTML;
    btnRefreshCredits.disabled = true;
    btnRefreshCredits.innerHTML = `<svg class="icon spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M23 4v6h-6M1 20v-6h6"/>
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
    </svg>`;

    headerAccountCredits.textContent = '...';
    try {
      if (activeProvider === 'dola' || acc.provider === 'dola') {
        const dolaCredits = await fetchUserCreditsFromDolaHelper({
          account: acc,
          storage,
          syncCookiesToBrowser: syncCookiesToBrowserHelper,
        });
        acc.credits = dolaCredits;
        acc.lastVerified = new Date().toISOString();
        await saveAccounts();
        renderHeaderAccount();
        renderAccountsList();
        showAuthAlert('✅ Sesi akun Dola AI diperbarui.', 'info');
      } else {
        const updated = await exchangeRefreshToken(acc.refreshToken, acc.cookie);
        if (typeof updated?.credits === 'number' && updated.credits !== null) {
          acc.credits = updated.credits;
        }
        acc.idToken = updated.idToken || acc.idToken;
        acc.expiresAt = updated.expiresAt || acc.expiresAt;
        await saveAccounts();
        renderHeaderAccount();
        renderAccountsList();
      }
    } catch (e) {
      console.warn('[Refresh Credits Failed]:', e);
      renderHeaderAccount();
      renderAccountsList();
    }

    // Restore button
    btnRefreshCredits.innerHTML = originalHTML;
    btnRefreshCredits.disabled = false;
  }

  // --- CHAT SESSIONS & MESSAGES ---
  async function loadChatSessions() {
    chatSessions = (await storage.get('weavy_chat_sessions')) || [];
    currentSessionId = await storage.get('weavy_current_session_id');

    if (!currentSessionId || !chatSessions.some((s) => s.id === currentSessionId)) {
      if (chatSessions.length > 0) {
        currentSessionId = chatSessions[0].id;
      } else {
        createNewSession();
      }
    }
    renderChatMessages();
  }

  async function saveChatSessions() {
    await persistChatSessions({ storage, chatSessions, currentSessionId });
    renderChatSessionHistory();
  }

  function getCurrentSession() {
    return getCurrentChatSession(chatSessions, currentSessionId);
  }

  function createNewSession() {
    // Reset status generating agar tombol kirim tidak stuck disabled di sesi baru
    if (chatGenerationAbortController) {
      chatGenerationAbortController.abort();
      chatGenerationAbortController = null;
    }
    setChatGeneratingState(false);

    const newSession = createChatSessionRecord();
    chatSessions.unshift(newSession);
    currentSessionId = newSession.id;
    saveChatSessions();
    isChatAutoScrollActive = true;
    renderChatMessages({ forceScroll: true });
    renderChatSessionHistory();

    // Jika provider aktif adalah Dola / Gemini, trigger buat sesi chat baru di tab browser provider
    const currentModel = chatModelSelect?.value || '';
    const currentProvider = chatProviderSelect?.value || (currentModel.startsWith('dola/') ? 'dola' : (currentModel.startsWith('gemini/') ? 'gemini' : 'weavy'));
    if (currentProvider === 'dola' || currentModel.startsWith('dola/')) {
      createDolaNewChatSessionInTab({ openIfMissing: false }).catch((err) => {
        console.warn('[Menu Chat] Gagal sinkronisasi sesi chat baru ke tab Dola:', err);
      });
    } else if (currentProvider === 'gemini' || currentModel.startsWith('gemini/')) {
      createGeminiNewChatSessionInTab({ openIfMissing: false }).catch((err) => {
        console.warn('[Menu Chat] Gagal sinkronisasi sesi chat baru ke tab Gemini:', err);
      });
    }
  }

  function formatSessionDate(session) {
    const timestamp = session.updatedAt || session.createdAt;
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    const today = new Date();
    return date.toDateString() === today.toDateString()
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { day: '2-digit', month: 'short' });
  }

  function renderChatSessionHistory() {
    if (!chatSessionHistoryList) return;

    const sessions = [...chatSessions].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    if (sessions.length === 0) {
      chatSessionHistoryList.innerHTML = '<div class="chat-session-history-empty">Belum ada riwayat chat.</div>';
      return;
    }

    chatSessionHistoryList.innerHTML = sessions.map((session) => `
      <div class="chat-session-history-item ${session.id === currentSessionId ? 'active' : ''}">
        <button type="button" class="chat-session-history-select" data-session-id="${escapeHtml(session.id)}">
          <span class="chat-session-history-copy">
            <strong>${escapeHtml(session.title || 'Percakapan Baru')}</strong>
            <small>${formatSessionDate(session)}${session.messages?.length ? ` · ${session.messages.length} pesan` : ''}</small>
          </span>
        </button>
        <button type="button" class="chat-session-history-delete" data-session-id="${escapeHtml(session.id)}" title="Hapus sesi" aria-label="Hapus sesi">&times;</button>
      </div>
    `).join('');

    chatSessionHistoryList.querySelectorAll('.chat-session-history-select').forEach((button) => {
      button.addEventListener('click', async () => {
        currentSessionId = button.dataset.sessionId;
        await storage.set('weavy_current_session_id', currentSessionId);
        // Pastikan send button tidak terkunci jika user beralih sesi
        setChatGeneratingState(false);
        isChatAutoScrollActive = true;
        renderChatMessages({ forceScroll: true });
        renderChatSessionHistory();
        closeChatSessionHistory();
      });
    });

    chatSessionHistoryList.querySelectorAll('.chat-session-history-delete').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        const sessionId = button.dataset.sessionId;
        const session = chatSessions.find((item) => item.id === sessionId);
        if (!session || !confirm(`Hapus sesi "${session.title || 'Percakapan Baru'}"?`)) return;

        chatSessions = chatSessions.filter((item) => item.id !== sessionId);
        if (currentSessionId === sessionId) {
          setChatGeneratingState(false);
          if (chatSessions.length === 0) {
            const newSession = createChatSessionRecord();
            chatSessions = [newSession];
            currentSessionId = newSession.id;
          } else {
            currentSessionId = chatSessions[0].id;
          }
        }
        await saveChatSessions();
        renderChatMessages();
      });
    });
  }

  function closeChatSessionHistory() {
    chatSessionHistoryPopover?.classList.add('hidden');
    btnSessionHistory?.setAttribute('aria-expanded', 'false');
  }

  function updateScrollToBottomVisibility() {
    if (!chatMessages || !btnScrollToBottom) return;
    const scrollDiff = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight;
    // Tampilkan tombol panah oranye jika user scroll ke atas (lebih dari 40px dari dasar)
    if (scrollDiff > 40) {
      btnScrollToBottom.classList.remove('hidden');
      btnScrollToBottom.classList.add('visible');
    } else {
      btnScrollToBottom.classList.add('hidden');
      btnScrollToBottom.classList.remove('visible');
    }
  }

  function handleChatScroll() {
    updateScrollToBottomVisibility();
    if (isProgrammaticChatScroll || !chatMessages) return;

    const scrollDiff = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight;
    // Jika pengguna sedang scrolling ke atas secara manual (> 70px dari dasar), jeda auto-scroll
    if (isUserScrollingChat && scrollDiff > 70) {
      isChatAutoScrollActive = false;
    } else if (scrollDiff <= 25) {
      // Jika pengguna kembali ke dasar, aktifkan auto-scroll kembali
      isChatAutoScrollActive = true;
    }
  }

  function scrollToBottomChat(smooth = true) {
    if (!chatMessages) return;
    isProgrammaticChatScroll = true;

    const performScroll = () => {
      if (!chatMessages) return;
      if (smooth && typeof chatMessages.scrollTo === 'function') {
        chatMessages.scrollTo({
          top: chatMessages.scrollHeight,
          behavior: 'smooth',
        });
      } else {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    };

    performScroll();

    // Pastikan layout reflow browser dan gambar/kartu selesai render tetap turun ke dasar
    requestAnimationFrame(() => {
      performScroll();
      setTimeout(() => {
        performScroll();
        isProgrammaticChatScroll = false;
        updateScrollToBottomVisibility();
      }, 50);
    });

    if (btnScrollToBottom) {
      btnScrollToBottom.classList.add('hidden');
      btnScrollToBottom.classList.remove('visible');
    }
  }

  // Helper to copy text to clipboard with legacy fallback
  function copyTextWithFallback(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '-9999px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(ta);
        if (successful) resolve();
        else reject(new Error('execCommand failed'));
      } catch (err) {
        reject(err);
      }
    });
  }

  // Handler to copy single scene with rich formatting, icons, and green checkmark UI transition
  function handleCopySceneItem(btn) {
    if (!btn || btn.classList.contains('copied')) return;

    let textToCopy = '';
    const encText = btn.getAttribute('data-scene-text');
    if (encText) {
      try {
        textToCopy = decodeURIComponent(encText);
      } catch (_) {}
    }

    // Fallback 1: Extract from parent card's data-project and scene index
    if (!textToCopy) {
      try {
        const card = btn.closest('.chat-storyboard-copilot-card');
        const applyBtn = card?.querySelector('.btn-apply-storyboard-from-chat, .btn-copy-storyboard-script');
        const encProject = applyBtn?.getAttribute('data-project');
        if (encProject) {
          const proj = JSON.parse(decodeURIComponent(encProject));
          const sceneIdx = parseInt(btn.getAttribute('data-scene-idx') || '0', 10);
          const sceneNum = parseInt(btn.getAttribute('data-scene-num') || '1', 10);
          const sc = (Array.isArray(proj.scenes) && proj.scenes[sceneIdx]) || proj.scenes?.find(s => (s.sceneNumber || 1) === sceneNum);
          if (sc) {
            textToCopy = buildSceneClipboardText(sc, sceneIdx);
          }
        }
      } catch (_) {}
    }

    // Fallback 2: Extract from DOM node text
    if (!textToCopy) {
      const sceneItem = btn.closest('.sb-copilot-scene-item');
      if (sceneItem) {
        const clone = sceneItem.cloneNode(true);
        clone.querySelectorAll('.sb-copilot-scene-actions-row, .btn-copy-scene-item').forEach(el => el.remove());
        textToCopy = clone.innerText.trim();
      }
    }

    if (!textToCopy) return;

    const originalHtml = btn.innerHTML;
    const originalWidth = btn.offsetWidth ? `${btn.offsetWidth}px` : 'auto';

    copyTextWithFallback(textToCopy).then(() => {
      btn.classList.add('copied');
      btn.style.minWidth = originalWidth;
      btn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span style="color:#4ade80; font-weight:700;">Tersalin</span>
      `;

      const scNum = btn.getAttribute('data-scene-num') || '';
      if (typeof showAuthAlert === 'function') {
        showAuthAlert(`📋 Scene ${scNum} berhasil disalin lengkap dengan ikon!`, 'success');
      }

      setTimeout(() => {
        btn.classList.remove('copied');
        btn.style.minWidth = '';
        btn.innerHTML = originalHtml;
      }, 2000);
    }).catch((err) => {
      console.warn('[Copy Scene Item Error]:', err);
    });
  }

  function renderChatMessages(options = {}) {
    const forceScroll = (typeof options === 'boolean') ? options : Boolean(options?.forceScroll);
    const smooth = options?.smooth !== false;
    const session = getCurrentSession();
    if (!session || session.messages.length === 0) {
      if (!isGenerating) {
        setChatGeneratingState(false);
      }
      chatMessages.innerHTML = `
        <div class="welcome-card">
          <div class="welcome-icon-glow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h3>Selamat Datang di Weavy AI Assistant</h3>
          <p>Terhubung langsung ke ekosistem multimodal Weavy AI (Gemini 3 Pro, Claude Sonnet 5, GPT-5 Sol, Seedream V5, Nano Banana Pro).</p>
          <div class="quick-examples">
            <button class="example-item" data-text="Buatkan prompt 8K fotorealistik untuk model Seedream V5 tentang foto model fashion streetwear di Shibuya malam hari.">
              ✨ Prompt Fashion Streetwear
            </button>
            <button class="example-item" data-text="/kebunimpian Sulap lahan sempit 4x4,5m jadi kebun organik impian full tanaman pekarangan rumah 50 detik.">
              🏡 /kebunimpian 4x4.5m 50s
            </button>
            <button class="example-item" data-text="/homeharvest Panen terong hijau panjang lebat di pekarangan halaman rumah untuk sayur lalapan 29 detik.">
              🍆 /homeharvest Sayur 29s
            </button>
            <button class="example-item" data-text="/plantreview Bibit Long Murbei asal Taiwan buah unik panjang menyerupai ulat raksasa 45 detik.">
              🍇 /plantreview Long Murbei 45s
            </button>
            <button class="example-item" data-text="/buahunggul ">
              🌳 /buahunggul Universal 30s
            </button>
            <button class="example-item" data-text="/onthespot ">
              🔥 /onthespot 30s Veo/Flow
            </button>
            <button class="example-item" data-text="/harvestpov Buah melon kuning madu ranum di pekarangan kebun belakang rumah.">
              🌾 /harvestpov Kebun Melon
            </button>
            <button class="example-item" data-text="/facelessgardenugc Bibit pepaya calina merah delima di polybag pekarangan rumah.">
              🌱 /facelessgardenugc Kebun UGC
            </button>
            <button class="example-item" data-text="/fashion Tolong rancang storyboard 15 detik TikTok untuk jaket denim oversized vintage.">
              🎬 /fashion Storyboard 15s
            </button>
            <button class="example-item" data-text="Analisis komposisi pencahayaan dan gaya estetik dari foto yang saya lampirkan.">
              🔍 Analisis Foto Multimodal
            </button>
          </div>
        </div>
      `;
      chatMessages.querySelectorAll('.example-item').forEach((b) => {
        b.addEventListener('click', () => {
          chatInputText.value = b.getAttribute('data-text');
          chatInputText.focus();
        });
      });
      updateScrollToBottomVisibility();
      return;
    }

    function formatChatTime(ts) {
      if (!ts) return '';
      if (typeof ts === 'string' && ts.includes(':') && ts.length <= 8) return ts;
      try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return String(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        return String(ts);
      }
    }

    const { mediaList, mediaMap } = buildSessionMediaCatalog(session);

    chatMessages.innerHTML = session.messages
      .map((msg) => {
        const isUser = msg.role === 'user';
        const formattedContent = formatMarkdown(msg.content, mediaMap, msg.id);

        // 1. Render attachments if any (Separate images, video previews & native videos)
        let attachmentsHtml = '';
        let videoHtml = '';

        // 1a. Render detected video previews from links (TikTok, YouTube, Reels, etc.)
        if (Array.isArray(msg.videoPreviews) && msg.videoPreviews.length > 0) {
          msg.videoPreviews.forEach((vp, vpIdx) => {
            const vTag = vp.tagKey || (mediaList && mediaList.find((m) => m.url === vp.url)?.key) || `@vid${vpIdx + 1}`;
            const pType = (vp.type || '').toLowerCase();
            let pIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
            let pBadgeClass = 'badge-platform-default';
            if (pType === 'tiktok' || (vp.platform && vp.platform.includes('TikTok'))) {
              pIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.49 6.3 6.3 0 0 0 1.86-4.49V8.65a8.28 8.28 0 0 0 4.91 1.6V6.8a4.85 4.85 0 0 1-1-.11Z"/></svg>`;
              pBadgeClass = 'badge-platform-tiktok';
            } else if (pType === 'youtube' || (vp.platform && vp.platform.includes('YouTube'))) {
              pIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`;
              pBadgeClass = 'badge-platform-youtube';
            } else if (pType === 'instagram' || (vp.platform && vp.platform.includes('Instagram'))) {
              pIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`;
              pBadgeClass = 'badge-platform-instagram';
            }

            // Dynamically resolve embedUrl if not already saved (supports existing session messages)
            let activeEmbedUrl = vp.embedUrl || null;
            if (!activeEmbedUrl && vp.videoId) {
              if (pType === 'tiktok' || (vp.platform && vp.platform.includes('TikTok'))) {
                activeEmbedUrl = `https://www.tiktok.com/player/v1/${vp.videoId}?autoplay=1`;
              } else if (pType === 'youtube' || (vp.platform && vp.platform.includes('YouTube'))) {
                activeEmbedUrl = `https://www.youtube-nocookie.com/embed/${vp.videoId}?autoplay=1&rel=0`;
              } else if (pType === 'instagram' || (vp.platform && vp.platform.includes('Instagram'))) {
                activeEmbedUrl = `https://www.instagram.com/reel/${vp.videoId}/embed/`;
              }
            }
            if (!activeEmbedUrl && vp.url) {
              const tkId = extractTikTokVideoId(vp.url);
              if (tkId) {
                activeEmbedUrl = `https://www.tiktok.com/player/v1/${tkId}?autoplay=1`;
                vp.videoId = tkId;
              } else {
                const ytId = extractYouTubeVideoId(vp.url);
                if (ytId) {
                  activeEmbedUrl = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0`;
                  vp.videoId = ytId;
                } else {
                  const igId = extractInstagramMediaId(vp.url);
                  if (igId) {
                    activeEmbedUrl = `https://www.instagram.com/reel/${igId}/embed/`;
                    vp.videoId = igId;
                  }
                }
              }
            }
            if (activeEmbedUrl && !vp.embedUrl) {
              vp.embedUrl = activeEmbedUrl;
            }

            const isVertical = pType === 'tiktok' || (vp.platform && vp.platform.includes('TikTok')) || (vp.url && /tiktok\.com|reel|shorts/i.test(vp.url));
            const thumb = vp.thumbnailUrl || '';
            const embedId = `embed-${escapeHtml(vp.id || 'vid_' + vpIdx)}`;

            videoHtml += `
              <div class="interactive-video-card ${isVertical ? 'video-vertical-mode' : ''}" data-video-url="${escapeHtml(vp.url || '')}">
                <div class="video-card-header">
                  <div class="video-platform-badge ${pBadgeClass}">
                    <span class="video-platform-icon">${pIcon}</span>
                    <span class="video-platform-name">${escapeHtml(vp.platform || 'Video')}</span>
                    ${vp.author_name ? `<span class="video-author-handle">@${escapeHtml(vp.author_name)}</span>` : ''}
                  </div>
                  <span class="video-ref-pill">${escapeHtml(vTag)}</span>
                </div>

                <div class="video-player-container ${isVertical ? 'is-vertical' : ''}">
                  <div class="video-embed-box hidden" id="${embedId}">
                    <button type="button" class="btn-close-video-embed" title="Tutup Pemutar" aria-label="Tutup Pemutar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <iframe data-src="${escapeHtml(activeEmbedUrl || '')}" class="video-embed-iframe" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
                  </div>

                  <div class="video-poster-box has-interactive-embed" data-embed-target="${embedId}" data-video-url="${escapeHtml(vp.url || '')}" data-video-platform="${escapeHtml(pType)}" data-video-tag="${escapeHtml(vTag)}">
                    ${thumb ? `<img src="${escapeHtml(thumb)}" class="video-poster-img" alt="${escapeHtml(vp.title || 'Video')}" loading="lazy" />` : `<div class="video-poster-placeholder">${pIcon}</div>`}
                    <div class="video-poster-overlay">
                      <button type="button" class="btn-play-video-card" title="Putar Video di Obrolan">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      </button>
                      <span class="video-play-hint">Klik untuk Putar Video</span>
                    </div>
                  </div>
                </div>

                <div class="video-card-meta">
                  <p class="video-card-caption">${escapeHtml(vp.title || 'Video Referensi')}</p>
                </div>

                <div class="video-card-actions">
                  <button type="button" class="btn-extract-video-prompt" data-video-name="${escapeHtml(vTag)}" title="Minta AI analisis visual shot-by-shot & ekstrak prompt dari ${escapeHtml(vTag)}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
                    <span>Ekstrak Prompt (${escapeHtml(vTag)})</span>
                  </button>
                  ${vp.url ? `
                    <a href="${escapeHtml(vp.url)}" target="_blank" rel="noopener noreferrer" class="btn-open-original-video" title="Buka video asli di tab baru">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      <span>Buka Asli</span>
                    </a>
                  ` : ''}
                </div>
              </div>
            `;
          });
        }

        // 1b. Render attachments (Images & Native Video files)
        if (msg.attachments && msg.attachments.length > 0) {
          const imgAtts = [];
          msg.attachments.forEach((a, vIdx) => {
            const isVid = a.type === 'video' || (a.name && /\.(mp4|mov|webm|avi|mkv)$/i.test(a.name));
            if (isVid) {
              const vUrl = a.url || a.base64;
              const videoIndex = vIdx + 1;
              const tagLabel = `@vid${videoIndex}`;
              videoHtml += `
                <div class="interactive-video-card">
                  <div class="video-card-header">
                    <div class="video-platform-badge badge-platform-default">
                      <span class="video-platform-icon">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                      </span>
                      <span class="video-platform-name">Video File</span>
                      <span class="video-author-handle">${escapeHtml(a.name || 'video.mp4')}</span>
                    </div>
                    <span class="video-ref-pill">${escapeHtml(tagLabel)}</span>
                  </div>
                  <div class="video-player-container">
                    <div class="video-native-box">
                      <video src="${vUrl}" class="native-video-elem" controls playsinline preload="metadata"></video>
                    </div>
                  </div>
                  <div class="video-card-actions">
                    <button type="button" class="btn-extract-video-prompt" data-video-name="${escapeHtml(tagLabel)}" title="Ekstrak prompt video penuh dari ${escapeHtml(tagLabel)}">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
                      <span>Ekstrak Prompt (${escapeHtml(tagLabel)})</span>
                    </button>
                    <button type="button" class="btn-action-card btn-download-media" data-url="${vUrl}" data-filename="${escapeHtml(a.name || 'video.mp4')}">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      <span>Unduh MP4</span>
                    </button>
                  </div>
                </div>
              `;
            } else if (a.type === 'image' || a.url || a.base64) {
              imgAtts.push(a);
            }
          });

          if (imgAtts.length > 0) {
            attachmentsHtml = `
              <div class="bubble-attachments">
                ${imgAtts
                  .map((a, aIdx) => {
                    const tagLabel = a.tagKey || (mediaList && mediaList.find((m) => (m.url && (m.url === a.url || m.url === a.base64)) || (m.base64 && (m.base64 === a.base64 || m.base64 === a.url)))?.key) || `@img${aIdx + 1}`;
                    return `
                      <div class="bubble-img-wrap" data-tag="${escapeHtml(tagLabel)}">
                        <img src="${a.url || a.base64}" class="bubble-img-thumb lightbox-trigger cursor-grab active:cursor-grabbing" alt="${escapeHtml(a.name || 'Lampiran')}" data-full-src="${a.url || a.base64}" draggable="true" referrerpolicy="no-referrer" loading="lazy" onerror="this.onerror=null; const wrap = this.closest('.bubble-img-wrap'); if (wrap) wrap.remove(); else this.style.display='none';">
                        <span class="bubble-img-tag-badge">${escapeHtml(tagLabel)}</span>
                      </div>
                    `;
                  })
                  .join('')}
              </div>
            `;
          }
        }

        // 2. Render Weavy / AI Action Card (Image or Video Generation Completed)
        let actionHtml = '';
        const genMedia = msg.generatedVideo || msg.generatedImage;
        if (genMedia && genMedia.url) {
          const gUrl = genMedia.url;
          const encPrompt = encodeURIComponent(genMedia.prompt || '');
          const aspect = genMedia.aspectRatio || '9:16';
          const isGenVideo = msg.generatedVideo || genMedia.type === 'video' || (typeof isVideoUrl === 'function' && isVideoUrl(gUrl)) || (typeof gUrl === 'string' && (gUrl.includes('.mp4') || gUrl.includes('.webm') || gUrl.includes('.mov') || gUrl.includes('data:video/')));

          if (isGenVideo) {
            actionHtml = `
              <div class="weavy-card-action weavy-card-action-video" draggable="true" data-url="${gUrl}">
                <div class="weavy-card-header">
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span style="color:#34d399;">🎬</span>
                    <span style="font-weight:700;">Hasil Video AI (${escapeHtml(aspect)})</span>
                  </div>
                  <span class="dola-video-badge" style="background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3); font-size: 10px; padding: 1px 6px; border-radius: 4px;">HD Tanpa Watermark</span>
                </div>
                <div class="weavy-gen-img-container weavy-gen-video-container">
                  <video src="${gUrl}" class="weavy-gen-video native-video-elem" controls playsinline preload="metadata" crossorigin="anonymous" draggable="true"></video>
                </div>
                <div class="weavy-action-buttons-grid">
                  <button type="button" class="btn-action-card btn-preview-lightbox" data-src="${gUrl}" data-type="video" data-title="Hasil Render Video AI">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                    <span>Perbesar</span>
                  </button>
                  <button type="button" class="btn-action-card btn-download-media" data-url="${gUrl}" data-filename="weavy_video_${Date.now()}.mp4">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    <span>Unduh MP4</span>
                  </button>
                  <button type="button" class="btn-action-card btn-add-as-reference" data-src="${gUrl}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                    <span>Jadikan Referensi</span>
                  </button>
                  <button type="button" class="btn-action-card btn-open-in-generator" data-prompt="${encPrompt}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    <span>Buka Prompt</span>
                  </button>
                </div>
              </div>
            `;
          } else {
            actionHtml = `
              <div class="weavy-card-action" draggable="true" data-url="${gUrl}">
                <div class="weavy-card-header">
                  <span>🎨 Hasil Render (${escapeHtml(aspect)})</span>
                </div>
                <div class="weavy-gen-img-container">
                  <img src="${gUrl}" class="weavy-gen-img lightbox-trigger cursor-grab active:cursor-grabbing" alt="Hasil Render Weavy" data-full-src="${gUrl}" draggable="true">
                </div>
                <div class="weavy-action-buttons-grid">
                  <button type="button" class="btn-action-card btn-preview-lightbox" data-src="${gUrl}" data-type="image" data-title="Hasil Render Weavy AI">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                    <span>Perbesar</span>
                  </button>
                  <button type="button" class="btn-action-card btn-download-media" data-url="${gUrl}" data-filename="weavy_image_${Date.now()}.png">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    <span>Unduh</span>
                  </button>
                  <button type="button" class="btn-action-card btn-add-as-reference" data-src="${gUrl}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                    <span>Jadikan Referensi</span>
                  </button>
                  <button type="button" class="btn-action-card btn-open-in-generator" data-prompt="${encPrompt}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    <span>Buka di Generator</span>
                  </button>
                </div>
              </div>
            `;
          }
        }

        if (isUser) {
          return `
            <div class="chat-bubble-row user">
              <div class="message-meta">
                <span class="meta-sender">User</span>
                <span class="meta-time">${formatChatTime(msg.timestamp)}</span>
              </div>
              <div class="chat-bubble">
                ${attachmentsHtml}
                ${videoHtml}
                <div class="bubble-content">${formattedContent}</div>
                ${actionHtml}
              </div>
            </div>
          `;
        }

        if (msg.isError || msg.execution?.status === 'failed') {
          return `
            <div class="chat-bubble-row assistant is-error-row">
              <div class="message-meta">
                <span class="meta-sender" style="color:#f87171; font-weight:700;">⚠️ ${escapeHtml(msg.modelDisplayName || 'Error')}</span>
                <span class="meta-time">${formatChatTime(msg.timestamp)}</span>
              </div>
              <div class="chat-bubble" style="border: 1px solid rgba(239, 68, 68, 0.35); background: rgba(239, 68, 68, 0.08);">
                <div class="bubble-content" style="color:#fca5a5;">${formattedContent}</div>
                <div class="chat-error-actions" style="display:flex; align-items:center; gap:8px; margin-top:8px;">
                  <button type="button" class="btn-retry-chat-msg" data-msg-id="${escapeHtml(msg.id)}" style="display:inline-flex; align-items:center; gap:5px; padding:4px 10px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:6px; color:#fff; font-size:11px; cursor:pointer;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                    <span>Coba Lagi</span>
                  </button>
                </div>
              </div>
            </div>
          `;
        }

        return `
          <div class="chat-bubble-row assistant">
            <div class="message-meta">
              ${(msg.modelDisplayName || '').toLowerCase().includes('dola')
                ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:3px;background:linear-gradient(135deg, #06b6d4, #3b82f6);color:#fff;font-size:9px;font-weight:700;line-height:1;margin-right:2px;">D</span>`
                : `<svg class="meta-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="10" rx="2"/>
                <circle cx="12" cy="5" r="2"/>
                <path d="M12 7v4"/>
                <line x1="8" y1="16" x2="8" y2="16"/>
                <line x1="16" y1="16" x2="16" y2="16"/>
              </svg>`}
              <span class="meta-sender">${escapeHtml(msg.modelDisplayName || 'Weavy AI')}</span>
              <span class="meta-time">${formatChatTime(msg.timestamp)}</span>
            </div>
            <div class="chat-bubble">
              ${attachmentsHtml}
              ${videoHtml}
              <div class="bubble-content">${formattedContent}</div>
              ${actionHtml}
            </div>
          </div>
        `;
      })
      .join('');

    // Attach retry button listeners for failed chat turns
    chatMessages.querySelectorAll('.btn-retry-chat-msg').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const msgId = btn.getAttribute('data-msg-id');
        if (msgId) {
          retryTurnForMessage(msgId);
        }
      });
    });

    // Attach copy button listeners for general code blocks
    chatMessages.querySelectorAll('.code-copy-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const code = e.currentTarget.parentElement.querySelector('code')?.innerText || '';
        navigator.clipboard.writeText(code);
        e.currentTarget.textContent = 'Tersalin!';
        setTimeout(() => (e.currentTarget.textContent = 'Salin'), 2000);
      });
    });

    // Attach Dedicated Prompt Card Copy Buttons
    chatMessages.querySelectorAll('.btn-copy-prompt-card').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const encPrompt = e.currentTarget.getAttribute('data-prompt');
        const promptText = decodeURIComponent(encPrompt || '');
        navigator.clipboard.writeText(promptText);
        const originalHtml = e.currentTarget.innerHTML;
        e.currentTarget.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success, #5ec98f)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          <span style="color:var(--success, #5ec98f);">Tersalin!</span>
        `;
        setTimeout(() => {
          e.currentTarget.innerHTML = originalHtml;
        }, 2000);
      });
    });

    // Attach "Pakai di Generator" Buttons
    chatMessages.querySelectorAll('.btn-use-in-generator, .btn-open-in-generator').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const encPrompt = e.currentTarget.getAttribute('data-prompt');
        const promptText = decodeURIComponent(encPrompt || '');
        if (genPromptInput) {
          genPromptInput.value = promptText;
          switchTab('generate');
          genPromptInput.focus();
          showAuthAlert('Prompt berhasil dimuat ke Generator Gambar!', 'success');
        }
      });
    });

    // Attach Reference Chip Click to open Lightbox
    chatMessages.querySelectorAll('.weavy-gen-ref-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const ref = chip.getAttribute('data-ref');
        if (!ref) return;
        const s = getCurrentSession();
        if (s) {
          const { mediaMap } = buildSessionMediaCatalog(s);
          const m = mediaMap && mediaMap[ref.toLowerCase()];
          if (m && (m.url || m.base64)) {
            openMediaLightbox(m.url || m.base64, m.type || 'image', `${m.key} - ${m.name}`);
          }
        }
      });
    });

    // Attach Interactive Video Poster Click Triggers
    chatMessages.querySelectorAll('.video-poster-box').forEach((box) => {
      box.addEventListener('click', async (e) => {
        // Prevent event propagation if clicking on a fallback link
        if (e.target.closest('.btn-open-tab-fallback') || e.target.tagName === 'A') {
          return;
        }

        const targetId = box.getAttribute('data-embed-target');
        const videoUrl = box.getAttribute('data-video-url') || '';
        const pType = box.getAttribute('data-video-platform') || '';
        const embedWrapper = targetId ? document.getElementById(targetId) : null;
        const iframe = embedWrapper ? embedWrapper.querySelector('iframe') : null;

        if (iframe) {
          const currentSrc = iframe.getAttribute('data-src');
          if (currentSrc && currentSrc.trim() !== '') {
            iframe.src = currentSrc;
            box.classList.add('hidden');
            embedWrapper.classList.remove('hidden');
            return;
          }

          // In case data-src was not yet pre-resolved (e.g. vt.tiktok.com short url)
          const overlay = box.querySelector('.video-poster-overlay');
          const originalOverlayHtml = overlay ? overlay.innerHTML : '';
          if (overlay) {
            overlay.innerHTML = `
              <div class="video-inline-loader">
                <div class="weavy-spinner-sm"></div>
                <span>Menyiapkan pemutar video...</span>
              </div>
            `;
          }

          try {
            let resolvedEmbedUrl = null;
            if (pType === 'tiktok' || /tiktok\.com/i.test(videoUrl)) {
              // Try TikTok oEmbed to resolve video ID from HTML
              try {
                const oRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`);
                if (oRes.ok) {
                  const oData = await oRes.json();
                  const vidId = extractTikTokVideoId(videoUrl, oData.html || '');
                  if (vidId) {
                    resolvedEmbedUrl = `https://www.tiktok.com/player/v1/${vidId}?autoplay=1`;
                  }
                }
              } catch (_) {}

              if (!resolvedEmbedUrl && /vt\.tiktok\.com|vm\.tiktok\.com/i.test(videoUrl)) {
                try {
                  const headRes = await fetch(videoUrl, { method: 'HEAD', redirect: 'follow' });
                  if (headRes.url) {
                    const vidId = extractTikTokVideoId(headRes.url);
                    if (vidId) {
                      resolvedEmbedUrl = `https://www.tiktok.com/player/v1/${vidId}?autoplay=1`;
                    }
                  }
                } catch (_) {}
              }
            } else if (pType === 'youtube' || /youtu\.be|youtube\.com/i.test(videoUrl)) {
              const ytId = extractYouTubeVideoId(videoUrl);
              if (ytId) {
                resolvedEmbedUrl = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0`;
              }
            } else if (pType === 'instagram' || /instagram\.com/i.test(videoUrl)) {
              const igId = extractInstagramMediaId(videoUrl);
              if (igId) {
                resolvedEmbedUrl = `https://www.instagram.com/reel/${igId}/embed/`;
              }
            }

            if (resolvedEmbedUrl) {
              iframe.setAttribute('data-src', resolvedEmbedUrl);
              iframe.src = resolvedEmbedUrl;
              box.classList.add('hidden');
              embedWrapper.classList.remove('hidden');
              if (overlay) overlay.innerHTML = originalOverlayHtml;
              return;
            }
          } catch (resErr) {
            console.warn('[Video Player Resolver] Error:', resErr);
          }

          // If embed could not be created, show a friendly fallback inside the card without forcing new tab
          if (overlay) {
            overlay.innerHTML = `
              <div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px;text-align:center;">
                <span style="font-size:11px;color:#fca5a5;">Pemutar video tidak dapat dimuat langsung untuk tautan ini.</span>
                <a href="${escapeHtml(videoUrl)}" target="_blank" rel="noopener noreferrer" class="btn-open-tab-fallback" style="padding:4px 12px;font-size:11px;background:#28d9d2;color:#000;border-radius:6px;font-weight:700;text-decoration:none;margin-top:2px;">Buka di Tab Baru</a>
              </div>
            `;
          }
        }
      });
    });

    // Attach Close Video Embed Buttons
    chatMessages.querySelectorAll('.btn-close-video-embed').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const embedBox = btn.closest('.video-embed-box');
        if (embedBox) {
          const iframe = embedBox.querySelector('iframe');
          if (iframe) {
            iframe.src = ''; // Stop video & audio playback
          }
          embedBox.classList.add('hidden');
          const playerContainer = embedBox.closest('.video-player-container');
          if (playerContainer) {
            const posterBox = playerContainer.querySelector('.video-poster-box');
            if (posterBox) {
              posterBox.classList.remove('hidden');
            }
          }
        }
      });
    });

    // Attach "Ekstrak Prompt Dari Video Ini" Buttons
    chatMessages.querySelectorAll('.btn-extract-video-prompt').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const vName = e.currentTarget.getAttribute('data-video-name') || 'video ini';
        if (chatInputText) {
          chatInputText.value = `Tolong analisis shot-by-shot ${vName} dan ekstrak prompt video lengkap (camera movement, lighting, subject action, physical detail) yang siap disalin.`;
          chatInputText.focus();
          handleSendMessage();
        }
      });
    });

    // Attach "Jadikan Referensi" Buttons
    chatMessages.querySelectorAll('.btn-add-as-reference').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const src = e.currentTarget.getAttribute('data-src');
        if (src) {
          currentAttachments.push({
            id: `att_ref_${Date.now()}`,
            name: 'Referensi Obrolan',
            type: 'image',
            url: src,
            base64: src,
          });
          renderAttachmentTray();
          showAuthAlert('Gambar dijadikan referensi obrolan berikutnya!', 'success');
        }
      });
    });

    // Attach Lightbox Zoom Preview Triggers
    chatMessages.querySelectorAll('.lightbox-trigger, .btn-preview-lightbox').forEach((el) => {
      el.addEventListener('click', (e) => {
        const src = el.getAttribute('data-full-src') || el.getAttribute('data-src') || el.getAttribute('src');
        const type = el.getAttribute('data-type') || 'image';
        const title = el.getAttribute('data-title') || el.getAttribute('alt') || 'Pratinjau Media HD';
        if (src) openMediaLightbox(src, type, title);
      });
    });

    // Attach Interactive Media Tag (@img / @vid) Click Listeners
    chatMessages.querySelectorAll('.media-tag-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        const tag = e.currentTarget.getAttribute('data-tag')?.toLowerCase();
        const mItem = mediaMap[tag];
        if (mItem && (mItem.url || mItem.base64)) {
          openMediaLightbox(mItem.url || mItem.base64, mItem.type, `${mItem.key} - ${mItem.name}`);
        } else {
          showAuthAlert(`Media ${tag.toUpperCase()} belum dimuat dalam sesi ini`, 'warning');
        }
      });
    });

    // Attach Weavy Generate Action listeners
    chatMessages.querySelectorAll('.weavy-gen-request-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const btnEl = e.currentTarget;
        const msgId = btnEl.getAttribute('data-msg-id');
        const rawConf = btnEl.getAttribute('data-config');
        try {
          const config = JSON.parse(decodeURIComponent(rawConf));
          await executeChatInlineGenerate(btnEl, config, msgId);
        } catch (err) {
          console.error('[Execute Gen Parse Error]:', err);
        }
      });
    });

    // Attach "Generate Ulang" Buttons
    chatMessages.querySelectorAll('.btn-regenerate-prompt').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const encPrompt = btn.getAttribute('data-prompt');
        const promptText = decodeURIComponent(encPrompt || '');
        if (chatInputText && promptText) {
          chatInputText.value = promptText;
          chatInputText.focus();
          handleSendMessage();
        }
      });
    });

    // Attach AI Worker: "Kirim ke Storyboard" Action Listener
    chatMessages.querySelectorAll('.btn-send-to-storyboard').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const encTitle = btn.getAttribute('data-title') || '';
        const encThumb = btn.getAttribute('data-thumbnail') || '';
        const encDesc = btn.getAttribute('data-desc') || '';
        const encPrice = btn.getAttribute('data-price') || '';
        const encStore = btn.getAttribute('data-store') || '';
        const encUsps = btn.getAttribute('data-usps') || '';
        const encImages = btn.getAttribute('data-images') || '';

        const title = decodeURIComponent(encTitle);
        const thumb = decodeURIComponent(encThumb);
        const desc = decodeURIComponent(encDesc);
        const price = decodeURIComponent(encPrice);
        const store = decodeURIComponent(encStore);
        let usps = [];
        let images = [];
        try { usps = JSON.parse(decodeURIComponent(encUsps)); } catch (_) {}
        try { images = JSON.parse(decodeURIComponent(encImages)); } catch (_) {}

        const activeChat = getCurrentChatSession(chatSessions, currentSessionId);

        // Kumpulkan semua gambar input dari sesi chat aktif (lampiran user, gambar galeri produk, hasil render)
        const chatSessionImages = [];
        const seenChatImgKeys = new Set();
        const recordChatImg = (rawImg, defaultName = 'Input Gambar Chat') => {
          if (!rawImg) return;
          const u = typeof rawImg === 'string' ? rawImg : (rawImg.url || rawImg.base64 || '');
          if (!u) return;
          const k = u.length > 80 ? `${u.slice(0, 40)}_${u.slice(-30)}` : u;
          if (seenChatImgKeys.has(k)) return;
          seenChatImgKeys.add(k);
          chatSessionImages.push({
            id: `chat_img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: (typeof rawImg === 'object' && rawImg.name) ? rawImg.name : defaultName,
            url: u.startsWith('http') ? u : '',
            base64: u,
            type: 'image',
            referenceRole: 'product',
          });
        };

        if (activeChat) {
          // 1. Lampiran langsung dari setiap bubble pesan di chat aktif
          if (Array.isArray(activeChat.messages)) {
            activeChat.messages.forEach((msg) => {
              if (Array.isArray(msg.attachments)) {
                msg.attachments.forEach((att) => {
                  if (att && (att.type === 'image' || att.base64 || att.url)) {
                    recordChatImg(att, att.name || 'Foto Input Chat');
                  }
                });
              }
            });
          }

          // 2. Media catalog dari seluruh sesi
          try {
            const { mediaList } = buildSessionMediaCatalog(activeChat);
            (mediaList || []).filter((m) => m.type === 'image').forEach((m) => {
              recordChatImg(m, m.name || 'Aset Chat');
            });
          } catch (_) {}
        }

        // Gabungkan gambar dari tombol produk dan gambar input chat
        const combinedImages = [];
        const combinedKeys = new Set();
        const registerImg = (imgItem, defaultName) => {
          if (!imgItem) return;
          const u = typeof imgItem === 'string' ? imgItem : (imgItem.url || imgItem.base64 || '');
          if (!u) return;
          const k = u.length > 80 ? `${u.slice(0, 40)}_${u.slice(-30)}` : u;
          if (combinedKeys.has(k)) return;
          combinedKeys.add(k);
          combinedImages.push(typeof imgItem === 'string' ? { url: imgItem, base64: imgItem, name: defaultName, referenceRole: 'product' } : imgItem);
        };

        // Prioritaskan gambar input yang diupload user di chat
        chatSessionImages.forEach((img) => registerImg(img, img.name));
        if (thumb) registerImg({ url: thumb, base64: thumb, name: `${title} (Thumbnail)` }, `${title} (Thumbnail)`);
        images.forEach((img, i) => registerImg(img, `Foto Produk #${i + 1}`));

        const effectiveThumb = thumb || (combinedImages.length > 0 ? (combinedImages[0].base64 || combinedImages[0].url) : '') || '';

        await transferProductToStoryboard({
          title,
          thumb: effectiveThumb,
          desc,
          price,
          store,
          usps,
          images: combinedImages,
          chatInputImages: chatSessionImages,
          dolaConvId: activeChat?.dolaConvId || null,
        });
      });
    });

    // Attach Storyboard Copilot: "Terapkan ke Storyboard" Action Listener
    chatMessages.querySelectorAll('.btn-apply-storyboard-from-chat').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const encProject = btn.getAttribute('data-project') || '';
        if (!encProject) return;
        let project = null;
        try {
          project = JSON.parse(decodeURIComponent(encProject));
        } catch (err) {
          console.error('[Storyboard Copilot Apply Error]:', err);
          showAuthAlert('⚠️ Gagal membaca data storyboard.', 'error');
          return;
        }

        const activeChat = getCurrentChatSession(chatSessions, currentSessionId);
        const chatSessionImages = [];
        const seenChatImgKeys = new Set();

        // Check if active chat contains any extracted e-commerce product links
        const hasExtractedProducts = Boolean(
          activeChat && Array.isArray(activeChat.messages) &&
          activeChat.messages.some((m) => (Array.isArray(m.extractedProducts) && m.extractedProducts.length > 0))
        );

        const recordChatImg = (rawImg, defaultName = 'Input Gambar Chat', defaultRole = null, isEcom = false) => {
          if (!rawImg) return;
          const u = typeof rawImg === 'string' ? rawImg : (rawImg.url || rawImg.base64 || rawImg.dataUrl || '');
          if (!u) return;

          const rawName = String((typeof rawImg === 'object' && rawImg.name) || defaultName || '').trim();
          const cleanNameLower = rawName.toLowerCase();

          // Deduplication key by URL signature or normalized name
          const urlKey = u.length > 80 ? `${u.slice(0, 40)}_${u.slice(-30)}` : u;
          const nameKey = cleanNameLower && !['input gambar chat', 'foto produk', 'foto talent / model', 'foto referensi', 'foto lampiran'].includes(cleanNameLower)
            ? `name_${cleanNameLower.replace(/\.[a-z0-9]+$/i, '').slice(0, 40)}`
            : null;

          if (seenChatImgKeys.has(urlKey) || (nameKey && seenChatImgKeys.has(nameKey))) {
            return;
          }
          seenChatImgKeys.add(urlKey);
          if (nameKey) seenChatImgKeys.add(nameKey);

          const explicitRole = typeof rawImg === 'object' && (rawImg.referenceRole || rawImg.role || rawImg.weavyAsset?.role || rawImg.weavyAsset?.referenceRole)
            ? String(rawImg.referenceRole || rawImg.role || rawImg.weavyAsset?.role || rawImg.weavyAsset?.referenceRole).toLowerCase().trim()
            : null;

          const isHumanKeyword = /model|talent|orang|wajah|pria|wanita|person|face|karakter|character|man|woman|cewek|cowok|selfie|pose|girl|boy|rendi|budi|siti|andi|agus|dewi|petani|host/i.test(cleanNameLower);
          const isPlantOrProduct = /pepaya|papaya|buah|benih|bibit|pohon|tanaman|jambu|produk|product|packaging|botol|baju|sepatu|tas|kaos|cream|serum|sabun|gratis|beli/i.test(cleanNameLower);
          const isBgKeyword = /background|bg|latar|kebun|ruangan|studio|outdoor|indoor|taman|setting|sawah|halaman/i.test(cleanNameLower);

          let calculatedRole = 'custom';
          if (explicitRole && ['product', 'model', 'talent', 'background', 'custom'].includes(explicitRole)) {
            calculatedRole = explicitRole === 'talent' ? 'model' : explicitRole;
          } else if (isEcom) {
            calculatedRole = 'product';
          } else if (isHumanKeyword && !isPlantOrProduct) {
            calculatedRole = 'model';
          } else if (isBgKeyword) {
            calculatedRole = 'background';
          } else if (isPlantOrProduct) {
            calculatedRole = 'product';
          } else if (defaultRole) {
            calculatedRole = defaultRole;
          }

          chatSessionImages.push({
            id: (typeof rawImg === 'object' && rawImg.id) ? rawImg.id : `chat_img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: rawName || (calculatedRole === 'model' ? 'Talent' : calculatedRole === 'product' ? 'Produk' : calculatedRole === 'background' ? 'Latar' : 'Asset'),
            url: u.startsWith('http') ? u : '',
            base64: u,
            thumbnailUrl: (typeof rawImg === 'object' && rawImg.thumbnailUrl) ? rawImg.thumbnailUrl : u,
            type: 'image',
            role: calculatedRole,
            referenceRole: calculatedRole,
            isEcomProduct: isEcom,
            weavyAsset: (typeof rawImg === 'object' && rawImg.weavyAsset) ? rawImg.weavyAsset : null,
          });
        };

        // 1. Collect all E-Commerce / Link Scraped Products (Guaranteed Product Role)
        if (activeChat && Array.isArray(activeChat.messages)) {
          activeChat.messages.forEach((msg) => {
            if (Array.isArray(msg.extractedProducts)) {
              msg.extractedProducts.forEach((prod) => {
                if (Array.isArray(prod.images)) {
                  prod.images.forEach((img) => recordChatImg(img, prod.title || 'Foto Produk E-Commerce', 'product', true));
                } else if (prod.thumbnail_url) {
                  recordChatImg(prod.thumbnail_url, prod.title || 'Foto Produk E-Commerce', 'product', true);
                }
              });
            }
          });
        }

        // 2. Collect uploaded / attached images (preserve explicit roles or smart detect)
        if (Array.isArray(currentAttachments)) {
          currentAttachments.forEach((att) => {
            if (att && (att.type === 'image' || att.base64 || att.url)) {
              recordChatImg(att, att.name || 'Foto Lampiran', null, false);
            }
          });
        }

        if (activeChat && Array.isArray(activeChat.messages)) {
          activeChat.messages.forEach((msg) => {
            if (Array.isArray(msg.attachments)) {
              msg.attachments.forEach((att) => {
                if (att && (att.type === 'image' || att.base64 || att.url)) {
                  recordChatImg(att, att.name || 'Foto Lampiran', null, false);
                }
              });
            }
          });
        }

        const originalBtnHtml = btn.innerHTML;
        btn.innerHTML = `<span>⏳ Membuka Storyboard...</span>`;
        btn.disabled = true;

        try {
          // Switch to Storyboard tab
          switchTab('storyboard');
          
          // Open the Storyboard Create Project Confirmation Modal with all mapped parameters & references
          handleStoryboardCopilotCreateProjectRequest({
            project,
            referenceImages: chatSessionImages,
            rawText: project.brief || project.title || project.productName || '',
            reason: `Copilot di Chat menyiapkan rancangan storyboard "${project.title || project.productName || 'Baru'}" (${project.scenes?.length || project.numScenes || 4} Scene, ${project.duration || 15}s).`,
          });
        } catch (error) {
          console.error('[Apply Storyboard Error]:', error);
          try {
            await executeCreateStoryboardFromProjectData({
              project,
              referenceImages: chatSessionImages,
              rawText: project.brief || project.title || '',
            });
            showAuthAlert('🎬 Storyboard berhasil diterapkan ke editor!', 'success');
          } catch (execErr) {
            showAuthAlert(`⚠️ Kendala saat menerapkan storyboard: ${execErr.message || 'Error'}`, 'error');
          }
        } finally {
          btn.innerHTML = originalBtnHtml;
          btn.disabled = false;
        }
      });
    });

    // Attach Storyboard Copilot: "Salin Naskah / Script" Action Listener
    chatMessages.querySelectorAll('.btn-copy-storyboard-script').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const encProject = btn.getAttribute('data-project') || '';
        if (!encProject) return;
        try {
          const project = JSON.parse(decodeURIComponent(encProject));
          let scriptText = `🎬 STORYBOARD: ${project.title || project.productName || 'Video Komersial'}\n`;
          scriptText += `⏱️ Durasi: ${project.duration || 15}s | 🎞️ Scenes: ${project.numScenes || (project.scenes?.length || 4)} | 📐 Aspect: ${project.aspectRatio || '9:16'}\n`;
          if (project.brief) scriptText += `📝 Konsep: ${project.brief}\n\n`;
          
          if (Array.isArray(project.scenes) && project.scenes.length > 0) {
            project.scenes.forEach((sc, i) => {
              const shootsVoList = (Array.isArray(sc.shoots) && sc.shoots.length > 0) ? sc.shoots.map(sh => (sh.voiceover || '').trim()).filter(Boolean) : [];
              let sceneVo = (sc.voiceover || '').trim();
              if (shootsVoList.length > 0) {
                const combinedShootsVo = shootsVoList.join(' ');
                if (!sceneVo || (shootsVoList.length > 1 && !shootsVoList.every(v => sceneVo.includes(v.replace(/\[.*?\]/g, '').trim())))) {
                  sceneVo = combinedShootsVo;
                }
              }

              scriptText += `--- SCENE ${sc.sceneNumber || (i + 1)}: ${sc.title || 'Adegan'} ---\n`;
              if (sc.duration || sc.durationSec) scriptText += `⏱️ Durasi: ${sc.duration || sc.durationSec}s\n`;
              if (sc.cameraAngle || sc.cameraMovement) scriptText += `🎥 Shot/Angle: ${sc.cameraAngle || sc.cameraMovement}\n`;
              if (sc.visualDescription) scriptText += `🖼️ Visual: ${sc.visualDescription}\n`;
              
              if (Array.isArray(sc.shoots) && sc.shoots.length > 0) {
                scriptText += `🎬 Sub-Shots (${sc.shoots.length} Shoot):\n`;
                sc.shoots.forEach((sh, sIdx) => {
                  scriptText += `  • Shoot ${sh.shootNumber || (sIdx + 1)} (${sh.start !== undefined && sh.end !== undefined ? `${sh.start}–${sh.end}s` : `${sIdx * 3}–${(sIdx + 1) * 3}s`}): ${sh.visualDescription || ''}\n`;
                  if (sh.voiceover) scriptText += `    🎙️ "${sh.voiceover}"\n`;
                });
              }

              if (sceneVo) scriptText += `🎙️ Voiceover (VO): "${sceneVo}"\n`;
              if (sc.onScreenText) scriptText += `💬 On-Screen Text: ${sc.onScreenText}\n`;
              if (sc.videoPrompt) scriptText += `🎬 Prompt Video:\n${sc.videoPrompt}\n`;
              if (sc.imagePrompt) scriptText += `🖼️ Prompt Gambar:\n${sc.imagePrompt}\n`;
              scriptText += `\n`;
            });
          }

          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(scriptText.trim()).then(() => {
              showAuthAlert('📋 Naskah storyboard berhasil disalin ke clipboard!', 'success');
            }).catch(() => {});
          }
        } catch (err) {
          console.warn('[Copy Script Warn]:', err);
        }
      });
    });

    // Attach Storyboard Copilot: "Salin Scene Tunggal" Action Listener
    chatMessages.querySelectorAll('.btn-copy-scene-item').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleCopySceneItem(btn);
      });
    });

    // Attach Storyboard Copilot: "Salin Hook Saja" Action Listener
    chatMessages.querySelectorAll('.btn-copy-hook-only').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const encProject = btn.getAttribute('data-project') || '';
        if (!encProject) return;
        try {
          const project = JSON.parse(decodeURIComponent(encProject));
          const firstScene = (Array.isArray(project.scenes) && project.scenes[0]) ? project.scenes[0] : null;
          const hookText = firstScene?.voiceover || firstScene?.onScreenText || firstScene?.title || project.title || '';
          if (hookText && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(hookText).then(() => {
              showAuthAlert('🎯 Naskah Hook (0-3 detik) berhasil disalin!', 'success');
            }).catch(() => {});
          }
        } catch (_) {}
      });
    });

    // Attach Storyboard Copilot: "Salin JSON" Action Listener
    chatMessages.querySelectorAll('.btn-copy-storyboard-json').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const encProject = btn.getAttribute('data-project') || '';
        if (!encProject) return;
        try {
          const rawProject = JSON.parse(decodeURIComponent(encProject));
          const scenes = Array.isArray(rawProject) ? rawProject : (rawProject?.scenes || []);

          const normalizedScenes = scenes.map((s, idx) => {
            const cleanPrompt = sanitizeSceneImagePrompt(s.imagePrompt || '', s, rawProject);
            const shootsVoList = (Array.isArray(s.shoots) && s.shoots.length > 0) ? s.shoots.map(sh => (sh.voiceover || '').trim()).filter(Boolean) : [];
            let effectiveVo = (s.voiceover || s.voice_over || s.vo || s.narration || s.script || s.dialog || '').trim();
            // Only fallback to shoots VO if scene VO is completely missing
            if (!effectiveVo && shootsVoList.length > 0) {
              effectiveVo = shootsVoList.join(' ');
            }

            const item = {
              id: s.id || `scene-${idx + 1}`,
              sceneNumber: s.sceneNumber || idx + 1,
              title: s.title || `Scene ${idx + 1}`,
              durationSec: Number(s.durationSec || s.duration || (s.end !== undefined && s.start !== undefined ? (s.end - s.start) : 10)),
              start: s.start !== undefined ? s.start : (idx * 10),
              end: s.end !== undefined ? s.end : ((idx + 1) * 10),
              cameraAngle: s.cameraAngle || s.cameraMovement || 'Medium Shot',
              visualDescription: s.visualDescription || s.visual || s.desc || '',
              voiceover: effectiveVo,
              onScreenText: s.onScreenText || '',
              imagePrompt: cleanPrompt || s.imagePrompt || '',
              videoPrompt: s.videoPrompt || s.motion || '',
            };

            if (Array.isArray(s.shoots) && s.shoots.length > 0) {
              item.shoots = s.shoots.map((sh, sIdx) => {
                const shootVisual = (sh.visualDescription || sh.action || sh.description || sh.desc || sh.visual || sh.visual_description || sh.shotDescription || '').trim();
                return {
                  id: sh.id || `scene-${idx + 1}-shoot-${sIdx + 1}`,
                  shootNumber: sh.shootNumber || sIdx + 1,
                  start: sh.start !== undefined ? sh.start : (sIdx * 3),
                  end: sh.end !== undefined ? sh.end : ((sIdx + 1) * 3),
                  visualDescription: shootVisual,
                  action: sh.action || shootVisual || '',
                  cameraAngle: sh.cameraAngle || sh.camera || 'POV Handheld',
                  voiceover: (sh.voiceover || sh.vo || sh.narration || '').trim(),
                };
              });
            }

            if (s.imageUrl) item.imageUrl = s.imageUrl;
            if (s.status) item.status = s.status;
            return item;
          });

          // Build complete full-fidelity project JSON
          const exportProject = (Array.isArray(rawProject)) ? {
            title: rawProject[0]?.title || 'Rancangan Storyboard',
            productName: rawProject[0]?.productName || 'Produk',
            productDesc: rawProject[0]?.productDesc || '',
            duration: normalizedScenes.reduce((acc, sc) => acc + (sc.durationSec || 10), 0) || 50,
            aspectRatio: '9:16',
            formula: 'dream_garden_tour',
            numScenes: normalizedScenes.length,
            scenes: normalizedScenes,
          } : {
            title: rawProject.title || rawProject.productName || 'Rancangan Storyboard',
            productName: rawProject.productName || rawProject.title || 'Produk',
            productDesc: rawProject.productDesc || rawProject.brief || '',
            preset: rawProject.preset || 'kebunimpian',
            duration: Number(rawProject.duration) || normalizedScenes.reduce((acc, sc) => acc + (sc.durationSec || 10), 0) || 50,
            aspectRatio: rawProject.aspectRatio || '9:16',
            formula: rawProject.formula || 'dream_garden_tour',
            numScenes: Number(rawProject.numScenes) || normalizedScenes.length,
            scenes: normalizedScenes,
          };

          const jsonText = JSON.stringify(exportProject, null, 2);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(jsonText).then(() => {
              showAuthAlert('📋 Data JSON storyboard lengkap dengan VO berhasil disalin!', 'success');
            }).catch(() => {});
          }
        } catch (err) {
          console.warn('[Copy JSON Warn]:', err);
        }
      });
    });

    // Attach Storyboard Copilot: "Lihat JSON Mentah" Toggle Action Listener
    chatMessages.querySelectorAll('.btn-toggle-storyboard-raw-json').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = btn.getAttribute('data-target');
        if (!targetId) return;
        const panel = document.getElementById(targetId);
        if (panel) {
          const isHidden = panel.classList.contains('hidden');
          if (isHidden) {
            panel.classList.remove('hidden');
            btn.classList.add('active');
            btn.innerHTML = `
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              <span>Tutup JSON</span>
            `;
          } else {
            panel.classList.add('hidden');
            btn.classList.remove('active');
            btn.innerHTML = `
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>Lihat JSON</span>
            `;
          }
        }
      });
    });

    // Attach Generic JSON: "Salin JSON" Action Listener
    chatMessages.querySelectorAll('.btn-copy-generic-json').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const encJson = btn.getAttribute('data-json') || '';
        const rawJson = decodeURIComponent(encJson);
        if (rawJson && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(rawJson).then(() => {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = `
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success, #5ec98f)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              <span style="color:var(--success, #5ec98f);">Tersalin!</span>
            `;
            setTimeout(() => {
              btn.innerHTML = originalHtml;
            }, 2000);
            showAuthAlert('📋 Data JSON berhasil disalin ke clipboard!', 'success');
          }).catch(() => {});
        }
      });
    });

    // Attach AI Worker: "Generate Foto Studio" Action Listener
    chatMessages.querySelectorAll('.btn-gen-product-photo').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const encTitle = btn.getAttribute('data-title') || '';
        const encThumb = btn.getAttribute('data-thumbnail') || '';
        const title = decodeURIComponent(encTitle);
        const thumb = decodeURIComponent(encThumb);

        // 1. Switch to Generator tab
        switchTab('generate');

        // 2. Populate prompt
        if (genPromptInput) {
          genPromptInput.value = `Shot on Hasselblad X2D 100C, 50mm f/4 lens. Ultra-detailed commercial studio product photography of ${title}, clean minimalist podium backdrop, soft diffused softbox lighting, crisp natural reflections, premium advertising aesthetic.`;
          genPromptInput.focus();
        }

        // 3. Add thumbnail as reference if available
        if (thumb) {
          if (!currentGenRefImages.some((img) => img.url === thumb || img.base64 === thumb)) {
            currentGenRefImages.push({
              id: `ref_${Date.now()}`,
              name: title.slice(0, 24) || 'Foto Produk',
              url: thumb,
              base64: thumb,
            });
            renderGenRefGallery();
          }
        }

        showAuthAlert('✨ Data produk ditransfer ke Generator! Siap generate foto komersial Weavy.', 'success');
      });
    });

    // Attach AI Worker: "Salin Data Produk" Action Listener
    chatMessages.querySelectorAll('.btn-copy-product-data').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const encTitle = btn.getAttribute('data-title') || '';
        const encDesc = btn.getAttribute('data-desc') || '';
        const title = decodeURIComponent(encTitle);
        const desc = decodeURIComponent(encDesc);
        const text = `${title}\n\n${desc}`.trim();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => {
            showAuthAlert('📋 Rincian produk berhasil disalin ke clipboard!', 'success');
          }).catch(() => {});
        }
      });
    });

    // Attach Media Download Buttons with tactile checkmark feedback
    chatMessages.querySelectorAll('.btn-download-media, .btn-download-video, .tiktok-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const url = btn.getAttribute('data-url') || btn.getAttribute('href');
        const filename = btn.getAttribute('data-filename') || btn.getAttribute('download') || `tiktok_media_${Date.now()}.mp4`;
        if (!url || url.startsWith('#')) return;
        e.preventDefault();
        e.stopPropagation();

        const originalHtml = btn.innerHTML;
        btn.innerHTML = `
          <svg class="w-4 h-4 text-emerald-400 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span style="color:#34d399;font-weight:700;">Mengunduh...</span>
        `;

        try {
          await downloadMediaBlob(url, filename);
          showAuthAlert('Media berhasil diunduh!', 'success');
        } catch (err) {
          window.open(url, '_blank');
        } finally {
          setTimeout(() => {
            btn.innerHTML = originalHtml;
          }, 2500);
        }
      });
    });

    // Attach Custom Interactive Video Player Controls
    chatMessages.querySelectorAll('.embedded-video-player').forEach((playerCard) => {
      const video = playerCard.querySelector('.custom-player-video');
      const viewport = playerCard.querySelector('.video-viewport');
      const centerPlayOverlay = playerCard.querySelector('.center-play-overlay');
      const playBtn = playerCard.querySelector('.btn-play-pause-video');
      const muteBtn = playerCard.querySelector('.btn-toggle-video-mute');
      const bottomMuteBtn = playerCard.querySelector('.btn-mute-video');
      const scrubber = playerCard.querySelector('.custom-video-scrubber');
      const timeDisplay = playerCard.querySelector('.video-time-display');
      const fullscreenBtn = playerCard.querySelector('.btn-fullscreen-video');

      if (!video) return;

      function updatePlayState(isPlaying) {
        if (isPlaying) {
          centerPlayOverlay?.classList.add('opacity-0');
          if (playBtn) {
            playBtn.innerHTML = '<svg width="16" height="16" class="w-4 h-4 play-pause-icon" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
          }
        } else {
          centerPlayOverlay?.classList.remove('opacity-0');
          if (playBtn) {
            playBtn.innerHTML = '<svg width="16" height="16" class="w-4 h-4 play-pause-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
          }
        }
      }

      function togglePlay() {
        if (video.paused) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }

      function toggleMute() {
        video.muted = !video.muted;
        const isMuted = video.muted;
        if (muteBtn) {
          const label = muteBtn.querySelector('.mute-label');
          if (label) label.textContent = isMuted ? 'Bunyikan' : 'Bisukan';
        }
        if (bottomMuteBtn) {
          bottomMuteBtn.innerHTML = isMuted
            ? '<svg width="16" height="16" class="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
            : '<svg width="16" height="16" class="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
        }
      }

      viewport?.addEventListener('click', togglePlay);
      playBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlay();
      });
      muteBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMute();
      });
      bottomMuteBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMute();
      });

      video.addEventListener('play', () => updatePlayState(true));
      video.addEventListener('pause', () => updatePlayState(false));
      video.addEventListener('ended', () => updatePlayState(false));

      video.addEventListener('timeupdate', () => {
        if (video.duration) {
          const current = video.currentTime;
          const total = video.duration;
          if (scrubber) scrubber.value = (current / total) * 100;
          if (timeDisplay) {
            timeDisplay.textContent = `${formatVideoTime(current)} / ${formatVideoTime(total)}`;
          }
        }
      });

      scrubber?.addEventListener('input', (e) => {
        if (video.duration) {
          const seekVal = parseFloat(e.target.value);
          video.currentTime = (seekVal / 100) * video.duration;
        }
      });

      fullscreenBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!document.fullscreenElement) {
          playerCard.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      });
    });

    // Attach Drag and Drop DataTransfer to Media Cards & Attachments
    chatMessages.querySelectorAll('[draggable="true"]').forEach((el) => {
      el.addEventListener('dragstart', (e) => {
        const url = el.getAttribute('data-url') || el.getAttribute('src') || el.getAttribute('data-full-src');
        if (url) {
          e.dataTransfer.setData('application/x-amb-image-url', url);
          e.dataTransfer.setData('text/uri-list', url);
          e.dataTransfer.setData('text/plain', url);
        }
      });
    });

    // Auto-scroll ke paling bawah:
    // 1. Jika forceScroll diminta (misal: user baru kirim pesan / ganti sesi) -> scroll ke dasar
    // 2. Jika isChatAutoScrollActive masih aktif (sedang mengikuti respon baru / streaming) -> scroll ke dasar
    // 3. Atau jika pengguna memang berada di dekat dasar (< 120px)
    const distanceFromBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight;
    if (forceScroll || isChatAutoScrollActive || distanceFromBottom < 120) {
      if (forceScroll) {
        isChatAutoScrollActive = true;
        scrollToBottomChat(smooth);
      } else {
        if (smooth && typeof chatMessages.scrollTo === 'function') {
          chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth',
          });
        } else {
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      }
    }
    updateScrollToBottomVisibility();
  }

  // --- BULLETPROOF MEDIA DOWNLOAD UTILITY ---
  async function downloadMediaBlob(url, filename = 'weavy_media.png') {
    if (!url) {
      showAuthAlert('URL media tidak valid untuk diunduh.', 'error');
      return false;
    }

    // Sanitize filename to avoid OS invalid characters
    let cleanFilename = filename.replace(/[<>:"/\\|?*]+/g, '_').trim();
    if (!cleanFilename.includes('.')) {
      cleanFilename += url.includes('.mp4') ? '.mp4' : '.png';
    }

    // Method 1: Chrome Extension Native Downloads API (bypasses CORS restrictions)
    if (typeof chrome !== 'undefined' && chrome?.downloads?.download) {
      try {
        const downloadId = await new Promise((resolve, reject) => {
          chrome.downloads.download(
            {
              url: url,
              filename: cleanFilename,
              saveAs: false,
              conflictAction: 'uniquify',
            },
            (id) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(id);
              }
            }
          );
        });
        if (downloadId) {
          showAuthAlert('Unduhan media resolusi tinggi berhasil dimulai!', 'success');
          return true;
        }
      } catch (err) {
        console.warn('chrome.downloads.download failed, fallback to blob fetch:', err);
      }
    }

    // Method 2: Direct Base64 / Blob URL download
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      try {
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = cleanFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showAuthAlert('Media resolusi tinggi berhasil diunduh!', 'success');
        return true;
      } catch (e) {
        console.warn('Direct blob/data download failed:', e);
      }
    }

    // Method 3: Fetch as Blob with MIME auto-detection & integrity check
    try {
      const resp = await fetch(url, { mode: 'cors' });
      if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
      const blob = await resp.blob();

      if (blob.size < 50) {
        throw new Error('Blob payload too small, possible corruption');
      }

      // Auto-correct extension based on real MIME
      if (blob.type.includes('jpeg') || blob.type.includes('jpg')) {
        if (!cleanFilename.endsWith('.jpg') && !cleanFilename.endsWith('.jpeg')) {
          cleanFilename = cleanFilename.replace(/\.[^.]+$/, '') + '.jpg';
        }
      } else if (blob.type.includes('png')) {
        if (!cleanFilename.endsWith('.png')) {
          cleanFilename = cleanFilename.replace(/\.[^.]+$/, '') + '.png';
        }
      } else if (blob.type.includes('webp')) {
        if (!cleanFilename.endsWith('.webp')) {
          cleanFilename = cleanFilename.replace(/\.[^.]+$/, '') + '.webp';
        }
      } else if (blob.type.includes('mp4')) {
        if (!cleanFilename.endsWith('.mp4')) {
          cleanFilename = cleanFilename.replace(/\.[^.]+$/, '') + '.mp4';
        }
      }

      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = objUrl;
      a.download = cleanFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 10000);
      showAuthAlert('Gambar resolusi tinggi berhasil disimpan!', 'success');
      return true;
    } catch (fetchErr) {
      console.warn('Fetch blob download failed (CORS or network):', fetchErr);

      // Method 4: HTML5 Canvas Export Fallback (for images)
      const isVideo = url.includes('.mp4') || url.includes('.webm');
      if (!isVideo) {
        try {
          const downloadedViaCanvas = await new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((cBlob) => {
                  if (cBlob) {
                    const cUrl = URL.createObjectURL(cBlob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = cUrl;
                    a.download = cleanFilename.endsWith('.png') ? cleanFilename : cleanFilename.replace(/\.[^.]+$/, '') + '.png';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(cUrl), 10000);
                    showAuthAlert('Gambar resolusi tinggi berhasil disimpan!', 'success');
                    resolve(true);
                  } else {
                    resolve(false);
                  }
                }, 'image/png');
              } catch (err) {
                resolve(false);
              }
            };
            img.onerror = () => resolve(false);
            img.src = url;
          });

          if (downloadedViaCanvas) return true;
        } catch (canvasErr) {
          console.warn('Canvas export failed:', canvasErr);
        }
      }

      // Method 5: Fallback popup / tab
      window.open(url, '_blank');
      showAuthAlert('Membuka media di tab baru untuk disimpan langsung.', 'info');
      return true;
    }
  }

  function formatVideoTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // --- LIGHTBOX CONTROLS ---
  function openMediaLightbox(url, type = 'image', title = 'Pratinjau Media HD') {
    showMediaLightbox({ url, type, prompt: title, modelLabel: 'Weavy AI' });
  }

  function closeMediaLightbox() {
    const modal = document.getElementById('mediaLightboxModal');
    const video = document.getElementById('lightboxVideo');
    if (video) {
      video.pause();
      video.src = '';
    }
    modal?.classList.add('hidden');
  }

  // --- MARKDOWN FORMATTER WITH ANTI-SLOP & WEAVY TAGS ---
  function formatMarkdown(text, mediaMap = {}, msgId = '') {
    return formatChatMarkdown(text, mediaMap, msgId);
  }

  // TikTok Video Downloader Handler (Standalone in Extension & Proxy in Web)
  async function handleTikTokDownloadCommand(inputText) {
    const session = getCurrentSession();

    // 1. Record user message in session
    const userMsg = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: inputText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachments: [...currentAttachments],
    };

    session.messages.push(userMsg);
    session.updatedAt = new Date().toISOString();
    if (session.messages.length === 1) {
      session.title = 'Download TikTok';
    }

    // Reset chat inputs
    chatInputText.value = '';
    chatInputText.style.height = 'auto';
    currentAttachments = [];
    renderAttachmentTray();
    isChatAutoScrollActive = true;
    renderChatMessages({ forceScroll: true, smooth: true });
    scrollToBottomChat(true);

    // 2. Extract TikTok URL
    const urlMatch = inputText.match(/https?:\/\/[^\s"'<>]+/i);
    if (!urlMatch) {
      const assistantMsg = {
        id: `msg_asst_${Date.now()}`,
        role: 'assistant',
        content: `📥 **TikTok Video Downloader**\n\nSilakan sertakan link video TikTok yang ingin diunduh tanpa watermark.\n\n**Format Penggunaan:**\n\`/download <link_video_tiktok>\`\n\n**Contoh:**\n\`/download https://vt.tiktok.com/ZSbJjLEc9\``,
        modelDisplayName: 'TikTok Downloader',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      session.messages.push(assistantMsg);
      await saveChatSessions();
      renderChatMessages({ forceScroll: true, smooth: true });
      scrollToBottomChat(true);
      return;
    }

    const targetUrl = urlMatch[0];

    // Check if running directly inside Chrome Extension unpacked environment
    const isExtensionRuntime =
      location.protocol === 'chrome-extension:' ||
      (typeof chrome !== 'undefined' && Boolean(chrome?.runtime?.id) && !location.origin.startsWith('http'));

    // 3. Create Assistant Placeholder
    const assistantMsg = {
      id: `msg_asst_${Date.now()}`,
      role: 'assistant',
      content: `[typing_status: Mengunduh data video TikTok tanpa watermark...]`,
      modelDisplayName: isExtensionRuntime ? 'TikTok Downloader (Extension Direct)' : 'TikTok Downloader',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    session.messages.push(assistantMsg);
    renderChatMessages({ forceScroll: true, smooth: true });
    scrollToBottomChat(true);
    setChatGeneratingState(true);

    try {
      let tiktokData = null;
      let errorReason = '';

      // Helper function to fetch from direct TikWM APIs (Direct in Extension - No server needed!)
      const fetchDirectTikWM = async (rawUrl) => {
        const endpoints = [
          `https://www.tikwm.com/api/?url=${encodeURIComponent(rawUrl)}`,
          `https://tikwm.com/api/?url=${encodeURIComponent(rawUrl)}`,
        ];
        for (const ep of endpoints) {
          try {
            const resp = await fetch(ep, {
              headers: { Accept: 'application/json, text/plain, */*' },
            });
            const json = await resp.json();
            if (json && (json.code === 0 || json.data)) {
              return json.data;
            }
          } catch (e) {
            // try next endpoint
          }
        }
        return null;
      };

      // In Chrome Extension: Prioritize direct API (100% standalone, no server required)
      if (isExtensionRuntime) {
        try {
          const directData = await fetchDirectTikWM(targetUrl);
          if (directData) {
            const videoId = directData.id || String(Date.now());
            const rawTitle = directData.title || `tiktok_${videoId}`;
            const cleanTitle =
              rawTitle.replace(/[^\w\s\u00C0-\u1FFF\u2C00-\uD7FF-]/gi, '').trim().substring(0, 70) ||
              `tiktok_${videoId}`;
            tiktokData = {
              id: videoId,
              title: rawTitle,
              cleanTitle,
              duration: directData.duration || 0,
              author: {
                nickname: directData.author?.nickname || 'TikTok Creator',
                unique_id: directData.author?.unique_id || '',
                avatar: directData.author?.avatar || '',
              },
              cover: directData.cover || directData.origin_cover || '',
              rawCover: directData.cover || directData.origin_cover || '',
              play: directData.play || directData.wmplay || '',
              rawPlay: directData.play || directData.wmplay || '',
              downloadUrl: directData.play || directData.wmplay || '',
              music: directData.music || '',
              downloadMusicUrl: directData.music || '',
              downloadCoverUrl: directData.cover || directData.origin_cover || '',
              musicInfo: directData.music_info || null,
              stats: {
                play_count: directData.play_count || 0,
                digg_count: directData.digg_count || 0,
                comment_count: directData.comment_count || 0,
                share_count: directData.share_count || 0,
                download_count: directData.download_count || 0,
              },
              images: Array.isArray(directData.images)
                ? directData.images.map((img, i) => ({
                    url: img,
                    downloadUrl: img,
                    rawUrl: img,
                  }))
                : [],
            };
          }
        } catch (extErr) {
          console.warn('[TikTok Downloader] Direct extension fetch failed, trying proxy fallback:', extErr);
        }
      }

      // If in Web preview or direct fetch didn't return, call Express backend proxy
      if (!tiktokData) {
        try {
          const resp = await fetch(`/api/tiktok/info?url=${encodeURIComponent(targetUrl)}`);
          if (resp.ok) {
            const resJson = await resp.json();
            if (resJson.success && resJson.data) {
              tiktokData = resJson.data;
            } else {
              errorReason = resJson.error || 'Server gagal memproses link TikTok.';
            }
          }
        } catch (beErr) {
          console.warn('[TikTok Downloader] Backend proxy unavailable:', beErr);
        }
      }

      // Final fallback to direct fetch if not already tried
      if (!tiktokData && !isExtensionRuntime) {
        try {
          const directData = await fetchDirectTikWM(targetUrl);
          if (directData) {
            const videoId = directData.id || String(Date.now());
            const rawTitle = directData.title || `tiktok_${videoId}`;
            const cleanTitle =
              rawTitle.replace(/[^\w\s\u00C0-\u1FFF\u2C00-\uD7FF-]/gi, '').trim().substring(0, 70) ||
              `tiktok_${videoId}`;
            tiktokData = {
              id: videoId,
              title: rawTitle,
              cleanTitle,
              duration: directData.duration || 0,
              author: {
                nickname: directData.author?.nickname || 'TikTok Creator',
                unique_id: directData.author?.unique_id || '',
                avatar: directData.author?.avatar || '',
              },
              cover: directData.cover || directData.origin_cover || '',
              rawCover: directData.cover || directData.origin_cover || '',
              play: directData.play || directData.wmplay || '',
              rawPlay: directData.play || directData.wmplay || '',
              downloadUrl: directData.play || directData.wmplay || '',
              music: directData.music || '',
              downloadMusicUrl: directData.music || '',
              downloadCoverUrl: directData.cover || '',
              musicInfo: directData.music_info || null,
              stats: {
                play_count: directData.play_count || 0,
                digg_count: directData.digg_count || 0,
                comment_count: directData.comment_count || 0,
                share_count: directData.share_count || 0,
                download_count: directData.download_count || 0,
              },
              images: Array.isArray(directData.images)
                ? directData.images.map((img, i) => ({
                    url: img,
                    downloadUrl: img,
                    rawUrl: img,
                  }))
                : [],
            };
          }
        } catch (e) {
          // ignore
        }
      }

      if (!tiktokData) {
        throw new Error(
          errorReason ||
            'Gagal mengunduh data video TikTok. Pastikan video tidak di-private dan link dapat diakses.'
        );
      }

      // 1. JANGAN AUTO-DOWNLOAD KE DISK (Sesuai permintaan user: tidak boleh auto download).
      // File dapat diunduh secara manual kapan saja via tombol di kartu hasil download.
      const coverUrl = tiktokData.cover || tiktokData.rawCover;
      const playUrl = tiktokData.play || tiktokData.rawPlay || tiktokData.downloadUrl;

      const newAttachments = [];

      // Jadikan thumbnail sebagai lampiran gambar
      if (coverUrl) {
        newAttachments.push({
          id: `att_thumb_${tiktokData.id || Date.now()}`,
          name: `Thumbnail - ${tiktokData.cleanTitle || 'TikTok'}.jpg`,
          type: 'image',
          url: coverUrl,
          thumbnailUrl: coverUrl,
          source: 'tiktok_download',
          tagKey: '@img1',
        });
      }

      // Jadikan video TikTok sebagai lampiran video
      if (playUrl) {
        newAttachments.push({
          id: `att_vid_${tiktokData.id || Date.now()}`,
          name: `${tiktokData.cleanTitle || 'TikTok'}.mp4`,
          type: 'video',
          url: playUrl,
          thumbnailUrl: coverUrl || null,
          duration: tiktokData.duration || 0,
          source: 'tiktok_download',
          tagKey: '@vid1',
        });
      }

      // Jika TikTok berupa carousel / slideshow foto, tambahkan semua gambar sebagai lampiran
      if (Array.isArray(tiktokData.images) && tiktokData.images.length > 0) {
        tiktokData.images.forEach((imgObj, idx) => {
          const u = typeof imgObj === 'string' ? imgObj : (imgObj.url || imgObj.downloadUrl);
          if (u && u !== coverUrl) {
            newAttachments.push({
              id: `att_slide_${tiktokData.id || Date.now()}_${idx}`,
              name: `Foto ${idx + 1} - ${tiktokData.cleanTitle || 'TikTok'}.jpg`,
              type: 'image',
              url: u,
              thumbnailUrl: u,
              source: 'tiktok_download',
            });
          }
        });
      }

      // Simpan lampiran ke pesan assistant dan objek data video
      assistantMsg.attachments = newAttachments;
      assistantMsg.tiktokData = tiktokData;

      // Masukkan otomatis thumbnail & video ke tray input chat (currentAttachments)
      // agar pengguna tidak perlu upload manual lagi untuk bertanya ke Gemini atau Dola!
      newAttachments.forEach((att) => {
        const alreadyInTray = currentAttachments.some((c) => c.url === att.url || (c.id && c.id === att.id));
        if (!alreadyInTray) {
          currentAttachments.push(att);
        }
      });
      renderAttachmentTray();

      // Simpan otomatis thumbnail & video ke Media Library ekstensi
      try {
        if (Array.isArray(savedLibraryAssets)) {
          newAttachments.forEach((att) => {
            if (!savedLibraryAssets.some((s) => s.url === att.url)) {
              savedLibraryAssets.unshift({
                id: att.id,
                name: att.name,
                type: att.type,
                url: att.url,
                thumbnailUrl: att.thumbnailUrl || att.url,
                role: 'reference',
                source: 'tiktok_download',
                createdAt: new Date().toISOString(),
              });
            }
          });
          if (savedLibraryAssets.length > 80) {
            savedLibraryAssets = savedLibraryAssets.slice(0, 80);
          }
          storage.set('weavy_library_assets', savedLibraryAssets).catch(() => {});
          if (typeof renderLibrary === 'function') {
            renderLibrary();
          }
        }
      } catch (libErr) {
        console.warn('[TikTok Downloader] Gagal menyimpan ke Library:', libErr);
      }

      // Update message with TikTok media card
      assistantMsg.content = `[tiktok_card:${encodeURIComponent(JSON.stringify(tiktokData))}]`;
    } catch (err) {
      assistantMsg.content = `❌ **Gagal Mengunduh Video TikTok**\n\n${err.message || 'Terjadi kesalahan saat memproses link TikTok.'}\n\n*Tips: Pastikan link berformat https://vt.tiktok.com/... atau https://www.tiktok.com/@user/video/... dan video bersifat publik.*`;
    } finally {
      setChatGeneratingState(false);
      await saveChatSessions();
      renderChatMessages({ forceScroll: true, smooth: true });
      scrollToBottomChat(true);
    }
  }

  // --- SEND MESSAGE & WEAVY API DISPATCH (CHAT V2) ---
  async function handleSendMessage() {
    const text = chatInputText.value.trim();
    if (!text && currentAttachments.length === 0) return;
    if (isGenerating) return;

    // Check for /download slash command (TikTok video downloader - pure backend, no AI)
    if (/^\/download(\s|$)/i.test(text)) {
      await handleTikTokDownloadCommand(text);
      return;
    }

    let selectedModel = chatModelSelect?.value || 'google/gemini-3-pro';

    // Pilar 4: Smart Model Intent Routing (Tahu diri kapan mode cepat vs mode mikir dalam)
    // Jika provider adalah Gemini, dan user meminta analisis mendalam / storyboard kompleks / bedah video:
    const isComplexReasoningIntent =
      Boolean(
        text.length > 150 ||
        /(\/customstoryboard|\/copilotstoryboard|\/fashion|\/video|\/harvestpov|storyboard|analisis mendalam|analisis video|kenapa viral|bongkar hook|bedah iklan|komersial|rancang adegan|scene breakdown|deep research|mengapa bisa)/i.test(text) ||
        (Array.isArray(currentAttachments) && currentAttachments.some((a) => a.type === 'video')) ||
        Boolean(detectEcommerceProductLinks(text))
      );

    const isFastEditIntent =
      Boolean(
        text.length < 80 &&
        /(perbaiki|terjemahkan|translate|singkat|ejaan|typo|bikin 1 hook|caption pendek|hashtag|ganti kata|ubah judul|tulis ulang)/i.test(text)
      );

    if (chatProviderSelect?.value === 'gemini' || selectedModel.startsWith('gemini/')) {
      if (isComplexReasoningIntent && !selectedModel.includes('thinking') && !selectedModel.includes('3.1-pro')) {
        // Auto-elevate to Gemini 3.6 Thinking atau 3.1 Pro untuk penalaran mendalam
        selectedModel = 'gemini/gemini-3.6-thinking';
        if (chatModelSelect && chatModelSelect.value !== selectedModel) {
          chatModelSelect.value = selectedModel;
          switchGeminiModelInTab(selectedModel).catch(() => {});
        }
      } else if (isFastEditIntent && (selectedModel.includes('thinking') || selectedModel.includes('3.1-pro'))) {
        // Auto-switch ke 3.6 Flash untuk respon kilat tanpa jeda
        selectedModel = 'gemini/gemini-3.6-flash';
        if (chatModelSelect && chatModelSelect.value !== selectedModel) {
          chatModelSelect.value = selectedModel;
          switchGeminiModelInTab(selectedModel).catch(() => {});
        }
      }
    }

    const isDola = selectedModel.startsWith('dola/');
    const isGemini = selectedModel.startsWith('gemini/') || chatProviderSelect?.value === 'gemini';
    const activeExecProvider = isGemini ? 'gemini' : (isDola ? 'dola' : 'weavy');

    const acc = getActiveAccount();
    if (!acc && !isDola && !isGemini) {
      alert('Silakan hubungkan akun kamu di tab "Akun & Token" terlebih dahulu.');
      switchTab('settings');
      return;
    }

    const session = getCurrentSession();
    const userMsg = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachments: [...currentAttachments],
    };

    session.messages.push(userMsg);
    session.updatedAt = new Date().toISOString();
    if (session.messages.length === 1 && text) {
      session.title = text.length > 25 ? text.substring(0, 25) + '...' : text;
    }

    // Clear input & attachments
    chatInputText.value = '';
    chatInputText.style.height = 'auto';
    currentAttachments = [];
    renderAttachmentTray();
    isChatAutoScrollActive = true;
    renderChatMessages({ forceScroll: true, smooth: true });
    scrollToBottomChat(true);

    // Create Assistant Placeholder with animated typing dots
    const assistantMsg = {
      id: `msg_asst_${Date.now()}`,
      role: 'assistant',
      content: '[chat_typing_loader]',
      modelDisplayName: chatModelSelect.options[chatModelSelect.selectedIndex]?.text || (isDola ? (selectedModel === 'dola/pro' ? '💎 Dola Pro' : '⚡ Dola Fast') : (isGemini ? '✨ Google Gemini' : 'Weavy AI')),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      execution: {
        provider: activeExecProvider,
        model: selectedModel,
      },
    };
    session.messages.push(assistantMsg);
    renderChatMessages({ forceScroll: true, smooth: true });
    scrollToBottomChat(true);

    setChatGeneratingState(true);
    chatGenerationAbortController = new AbortController();
    const abortSignal = chatGenerationAbortController.signal;

    // Safety timeout: 300 detik (5 menit) maksimal untuk analisis video & multimodal kompleks
    const safetyTimer = setTimeout(() => {
      if (isGenerating) {
        console.warn('[Chat] Safety timer timeout reached (300s). Resetting generating state.');
        setChatGeneratingState(false);
      }
    }, 300000);

    try {
      const idToken = (!isDola && !isGemini && acc) ? await getValidIdToken(acc) : null;

      // Extract e-commerce / video links metadata
      const ecomLinks = detectEcommerceProductLinks(text);
      let scrapingContext = null;

      if (ecomLinks && ecomLinks.length > 0) {
        assistantMsg.content = '[typing_status: AI Worker Aktif: Sedang mengekstrak data produk dan visual...]';
        renderChatMessages();

        const enrichedLinks = await resolveLinksMetadata(ecomLinks);
        scrapingContext = formatScrapingContext(enrichedLinks);

        // Store extracted products
        const detectedProducts = [];
        enrichedLinks.forEach((l) => {
          if (l.metadata) {
            detectedProducts.push({
              title: l.metadata.title,
              author_name: l.metadata.author_name,
              url: l.url,
              platform: l.platform,
              thumbnail_url: l.metadata.thumbnail_url,
              description: l.metadata.description,
              usps: l.metadata.usps || [],
              images: l.metadata.images || (l.metadata.thumbnail_url ? [{ url: l.metadata.thumbnail_url, title: 'Cover Utama' }] : []),
            });
          }
        });

        if (detectedProducts.length > 0) {
          userMsg.extractedProducts = detectedProducts;
        }

        // Store interactive video previews for pure videos (YouTube, Reels)
        const detectedVideoPreviews = [];
        enrichedLinks.forEach((l, idx) => {
          const isProductLink = Boolean(
            l.type === 'tokopedia' ||
            l.type === 'shopee' ||
            l.platform?.toLowerCase().includes('shop') ||
            l.platform?.toLowerCase().includes('tokopedia') ||
            (l.metadata && (l.metadata.price || l.metadata.isProduct || (Array.isArray(l.metadata.images) && l.metadata.images.length > 0)))
          );

          if (!isProductLink && (l.type === 'youtube' || l.type === 'instagram' || (l.metadata && l.metadata.type === 'video' && l.metadata.embedUrl))) {
            detectedVideoPreviews.push({
              id: `vp_${Date.now()}_${idx}`,
              platform: l.platform || 'Video',
              type: l.type,
              url: l.url,
              title: l.metadata?.title || 'Video Referensi',
              author_name: l.metadata?.author_name || '',
              thumbnailUrl: l.metadata?.thumbnail_url || '',
              embedUrl: l.metadata?.embedUrl || null,
              videoId: l.metadata?.videoId || null,
            });
          }
        });

        if (detectedVideoPreviews.length > 0) {
          if (!userMsg.videoPreviews) userMsg.videoPreviews = [];
          userMsg.videoPreviews.push(...detectedVideoPreviews);
        }

        // Auto attach extracted cover thumbnails / product images
        const candidateThumbnails = [];
        enrichedLinks.forEach((l) => {
          if (l.metadata && l.metadata.images && l.metadata.images.length > 0) {
            l.metadata.images.forEach((imgObj) => {
              const imgUrl = typeof imgObj === 'string' ? imgObj : imgObj.url;
              if (imgUrl && !candidateThumbnails.some(t => t.url === imgUrl)) {
                candidateThumbnails.push({
                  type: 'image',
                  name: `Foto ${l.platform} (${l.metadata.author_name || 'Produk'})`,
                  url: imgUrl,
                });
              }
            });
          } else if (l.metadata && l.metadata.thumbnail_url) {
            candidateThumbnails.push({
              type: 'image',
              name: `Cover ${l.platform} (${l.metadata.author_name || 'Produk'})`,
              url: l.metadata.thumbnail_url,
            });
          }
        });

        const autoThumbnails = await filterValidImageObjects(candidateThumbnails, 3000);
        if (autoThumbnails.length > 0) {
          if (!userMsg.attachments) userMsg.attachments = [];
          autoThumbnails.forEach((t) => {
            if (!userMsg.attachments.some((a) => a.url === t.url)) {
              userMsg.attachments.push(t);
            }
          });
        }
      }

      // Check if Storyboard Copilot mode is active in Chat
      const isStoryboardCopilotActive = Boolean(
        (window.__weavyChatStoryboardCopilotEnabled ||
        document.getElementById('chatStoryboardCopilotToggle')?.checked ||
        /^\/(customstoryboard|copilotstoryboard|storyboardcopilot)\b/i.test(text)) &&
        !/^\/harvestpov\b/i.test(text)
      );

      // Extract Library Knowledge prompt if available
      let libraryKnowledgePrompt = '';
      try {
        const libAssets = typeof getLibraryAssets === 'function' ? getLibraryAssets() : [];
        libraryKnowledgePrompt = buildLibraryKnowledgePrompt(libAssets);
      } catch (_) {}

      // Build Normalized Conversation Context
      const normalizedContext = buildNormalizedConversationContext({
        session,
        currentTurnUserMsg: userMsg,
        provider: activeExecProvider,
        model: selectedModel,
        scrapingContext,
        isStoryboardCopilotActive,
        libraryKnowledgePrompt,
      });

      const activeAcc = getActiveAccount();
      const geminiApiKey = (activeAcc && activeAcc.provider === 'gemini') ? (activeAcc.apiKey || null) : null;

      // Execute conversation turn through Agent V1 Orchestrator
      const execResult = await executeAgentTurn({
        session,
        userMsg,
        provider: activeExecProvider,
        model: selectedModel,
        apiKey: geminiApiKey,
        idToken,
        refreshToken: acc?.refreshToken,
        callWeavyLLMFn: callWeavyLLM,
        isStoryboardCopilotActive,
        scrapingContext,
        libraryKnowledgePrompt,
        onProgress: (pct, msg) => {
          if (!assistantMsg.content || assistantMsg.content === '[chat_typing_loader]' || assistantMsg.content.startsWith('[typing_status:')) {
            assistantMsg.content = `[typing_status: ${msg}]`;
            renderChatMessages();
            if (isChatAutoScrollActive) {
              scrollToBottomChat(false);
            }
          }
        },
        onChunk: (partialText) => {
          assistantMsg.content = partialText;
          renderChatMessages();
          if (isChatAutoScrollActive) {
            scrollToBottomChat(false);
          }
        },
        abortSignal,
      });

      if (!abortSignal.aborted) {
        assistantMsg.content = execResult.content;
        assistantMsg.modelDisplayName = execResult.modelDisplayName || assistantMsg.modelDisplayName;
        assistantMsg.taskType = execResult.taskType || 'simple_chat';
        assistantMsg.execution = {
          provider: execResult.execution?.provider || execResult.provider,
          model: execResult.execution?.model || execResult.model,
          executedAt: execResult.execution?.executedAt || execResult.executedAt,
          status: 'completed',
        };

        if (execResult.updatedRuntime) {
          if (!session.providerRuntime) session.providerRuntime = {};
          Object.assign(session.providerRuntime, execResult.updatedRuntime);
        }

        session.updatedAt = new Date().toISOString();
        await saveChatSessions();
        renderChatMessages();
        if (isChatAutoScrollActive) {
          scrollToBottomChat(true);
        }
        refreshCredits();
      }
    } catch (err) {
      if (abortSignal?.aborted) {
        console.log('[Chat] Request dihentikan oleh pengguna.');
        assistantMsg.content = assistantMsg.content?.replace(/\[chat_typing_loader\]/g, '').trim() || '*(Dibatalkan oleh pengguna)*';
      } else {
        console.error('[Chat Error]:', err);
        const providerLabel = isGemini ? 'Google Gemini' : (isDola ? 'Dola AI' : 'Weavy AI');
        assistantMsg.content = `⚠️ Kendala saat menghubungi ${providerLabel}: ${err.message || 'Terjadi kesalahan sistem.'}`;
        assistantMsg.isError = true;
        assistantMsg.execution = {
          provider: activeExecProvider,
          model: selectedModel,
          status: 'failed',
          error: err.message || 'Error',
          failedAt: new Date().toISOString(),
        };
      }
      await saveChatSessions();
      renderChatMessages();
      if (isChatAutoScrollActive) {
        scrollToBottomChat(true);
      }
    } finally {
      clearTimeout(safetyTimer);
      chatGenerationAbortController = null;
      setChatGeneratingState(false);
    }
  }

  async function retryTurnForMessage(failedMsgId) {
    if (isGenerating) return;
    const session = getCurrentSession();
    if (!session || !Array.isArray(session.messages)) return;

    const failedIdx = session.messages.findIndex((m) => m.id === failedMsgId);
    if (failedIdx < 0) return;

    // Remove the failed assistant message
    session.messages.splice(failedIdx, 1);

    // Find the preceding user message
    let targetUserMsg = null;
    for (let i = failedIdx - 1; i >= 0; i--) {
      if (session.messages[i].role === 'user') {
        targetUserMsg = session.messages[i];
        break;
      }
    }

    if (!targetUserMsg) {
      renderChatMessages();
      return;
    }

    let selectedModel = chatModelSelect?.value || 'google/gemini-3-pro';
    const isDola = selectedModel.startsWith('dola/');
    const isGemini = selectedModel.startsWith('gemini/') || chatProviderSelect?.value === 'gemini';
    const activeExecProvider = isGemini ? 'gemini' : (isDola ? 'dola' : 'weavy');

    const assistantMsg = {
      id: `msg_asst_${Date.now()}`,
      role: 'assistant',
      content: '[chat_typing_loader]',
      modelDisplayName: chatModelSelect.options[chatModelSelect.selectedIndex]?.text || (isDola ? (selectedModel === 'dola/pro' ? '💎 Dola Pro' : '⚡ Dola Fast') : (isGemini ? '✨ Google Gemini' : 'Weavy AI')),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      execution: {
        provider: activeExecProvider,
        model: selectedModel,
      },
    };
    isChatAutoScrollActive = true;
    session.messages.push(assistantMsg);
    renderChatMessages({ forceScroll: true, smooth: true });
    scrollToBottomChat(true);

    setChatGeneratingState(true);
    chatGenerationAbortController = new AbortController();
    const abortSignal = chatGenerationAbortController.signal;

    try {
      const acc = getActiveAccount();
      const idToken = (!isDola && !isGemini && acc) ? await getValidIdToken(acc) : null;
      const geminiApiKey = (acc && acc.provider === 'gemini') ? (acc.apiKey || null) : null;

      let libraryKnowledgePrompt = '';
      try {
        const libAssets = typeof getLibraryAssets === 'function' ? getLibraryAssets() : [];
        libraryKnowledgePrompt = buildLibraryKnowledgePrompt(libAssets);
      } catch (_) {}

      const isStoryboardCopilotActive = Boolean(
        (window.__weavyChatStoryboardCopilotEnabled ||
        document.getElementById('chatStoryboardCopilotToggle')?.checked ||
        /^\/(customstoryboard|copilotstoryboard|storyboardcopilot)\b/i.test(targetUserMsg.content)) &&
        !/^\/harvestpov\b/i.test(targetUserMsg.content)
      );

      const normalizedContext = buildNormalizedConversationContext({
        session,
        currentTurnUserMsg: targetUserMsg,
        provider: activeExecProvider,
        model: selectedModel,
        isStoryboardCopilotActive,
        libraryKnowledgePrompt,
      });

      const execResult = await executeAgentTurn({
        session,
        userMsg: targetUserMsg,
        provider: activeExecProvider,
        model: selectedModel,
        apiKey: geminiApiKey,
        idToken,
        refreshToken: acc?.refreshToken,
        callWeavyLLMFn: callWeavyLLM,
        isStoryboardCopilotActive,
        libraryKnowledgePrompt,
        onProgress: (pct, msg) => {
          if (!assistantMsg.content || assistantMsg.content === '[chat_typing_loader]' || assistantMsg.content.startsWith('[typing_status:')) {
            assistantMsg.content = `[typing_status: ${msg}]`;
            renderChatMessages();
            if (isChatAutoScrollActive) {
              scrollToBottomChat(false);
            }
          }
        },
        onChunk: (partialText) => {
          assistantMsg.content = partialText;
          renderChatMessages();
          if (isChatAutoScrollActive) {
            scrollToBottomChat(false);
          }
        },
        abortSignal,
      });

      if (!abortSignal.aborted) {
        assistantMsg.content = execResult.content;
        assistantMsg.modelDisplayName = execResult.modelDisplayName || assistantMsg.modelDisplayName;
        assistantMsg.taskType = execResult.taskType || 'simple_chat';
        assistantMsg.execution = {
          provider: execResult.execution?.provider || execResult.provider,
          model: execResult.execution?.model || execResult.model,
          executedAt: execResult.execution?.executedAt || execResult.executedAt,
          status: 'completed',
        };

        if (execResult.updatedRuntime) {
          if (!session.providerRuntime) session.providerRuntime = {};
          Object.assign(session.providerRuntime, execResult.updatedRuntime);
        }

        session.updatedAt = new Date().toISOString();
        await saveChatSessions();
        renderChatMessages();
        if (isChatAutoScrollActive) {
          scrollToBottomChat(true);
        }
        refreshCredits();
      }
    } catch (err) {
      if (abortSignal?.aborted) {
        assistantMsg.content = '*(Dibatalkan oleh pengguna)*';
      } else {
        const providerLabel = isGemini ? 'Google Gemini' : (isDola ? 'Dola AI' : 'Weavy AI');
        assistantMsg.content = `⚠️ Kendala saat menghubungi ${providerLabel}: ${err.message || 'Terjadi kesalahan sistem.'}`;
        assistantMsg.isError = true;
        assistantMsg.execution = {
          provider: activeExecProvider,
          model: selectedModel,
          status: 'failed',
          error: err.message || 'Error',
          failedAt: new Date().toISOString(),
        };
      }
      await saveChatSessions();
      renderChatMessages();
      if (isChatAutoScrollActive) {
        scrollToBottomChat(true);
      }
    } finally {
      chatGenerationAbortController = null;
      setChatGeneratingState(false);
    }
  }

  // Helper to upload image (Data URL / Blob / HTTP URL) to Weavy Asset Store
  async function uploadAssetToWeavy(imgInput, idToken) {
    if (!imgInput) return null;

    // Fast-path: If already a valid Weavy/HTTP asset object or link, reuse instantly!
    if (typeof imgInput === 'object') {
      if (imgInput.url && typeof imgInput.url === 'string' && imgInput.url.startsWith('http')) {
        return {
          type: 'image',
          url: imgInput.url,
          width: imgInput.width || 1024,
          height: imgInput.height || 1024,
          thumbnailUrl: imgInput.thumbnailUrl || imgInput.url,
          id: imgInput.id || `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: imgInput.name || `asset_${Date.now()}.png`,
        };
      }
    }

    let rawUrl = typeof imgInput === 'string' ? imgInput : (imgInput.base64 || imgInput.url);
    if (!rawUrl) return null;

    // If raw string is already an HTTP/HTTPS link, reuse instantly without re-uploading!
    if (typeof rawUrl === 'string' && rawUrl.startsWith('http')) {
      return {
        type: 'image',
        url: rawUrl,
        width: 1024,
        height: 1024,
        thumbnailUrl: rawUrl,
        id: (typeof imgInput === 'object' && imgInput.id) ? imgInput.id : `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: (typeof imgInput === 'object' && imgInput.name) ? imgInput.name : `upload_${Date.now()}.png`,
      };
    }

    try {
      let dataUrl = rawUrl;
      if (rawUrl.startsWith('blob:')) {
        const fetchRes = await fetch(rawUrl);
        const blob = await fetchRes.blob();
        dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      }

      if (dataUrl) {
        const fileName = (typeof imgInput === 'object' && imgInput.name) ? imgInput.name : `upload_${Date.now()}.png`;

        // 1. Try uploading inside Weavy tab
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
          try {
            const tabs = await chrome.tabs.query({ url: ['*://app.weavy.ai/*', '*://*.weavy.ai/*'] });
            if (tabs && tabs.length > 0) {
              const tabId = (tabs.find((t) => t.active) || tabs[0]).id;
              const results = await chrome.scripting.executeScript({
                target: { tabId },
                args: [{ dataUrl, fileName, idToken }],
                func: async ({ dataUrl, fileName, idToken }) => {
                  try {
                    const blobRes = await fetch(dataUrl);
                    const b = await blobRes.blob();
                    const fd = new FormData();
                    fd.append('file', b, fileName);

                    const up = await fetch('https://api.weavy.ai/api/v1/assets/upload', {
                      method: 'POST',
                      headers: {
                        Authorization: `Bearer ${idToken}`,
                        'X-Weavy-Auth-Provider': 'firebase',
                        'x-app-version': '4.1.1316',
                      },
                      body: fd,
                      credentials: 'include',
                    });
                    if (up.ok) {
                      const json = await up.json();
                      return { success: true, data: json };
                    }
                    return { success: false, status: up.status };
                  } catch (e) {
                    return { success: false, error: e.message };
                  }
                },
              });

              const tabUp = results?.[0]?.result;
              if (tabUp && tabUp.success && tabUp.data?.url) {
                return {
                  type: 'image',
                  url: tabUp.data.url,
                  width: tabUp.data.width || 1024,
                  height: tabUp.data.height || 1024,
                  thumbnailUrl: tabUp.data.thumbnailUrl || tabUp.data.url,
                  id: tabUp.data.id || `img_${Date.now()}`,
                  name: tabUp.data.name || fileName,
                };
              }
            }
          } catch (tabErr) {}
        }

        // 2. Direct fallback
        const blobRes = await fetch(dataUrl);
        const blob = await blobRes.blob();
        const formData = new FormData();
        formData.append('file', blob, fileName);

        const upRes = await fetch(`${WEAVY_API_BASE}/api/v1/assets/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'X-Weavy-Auth-Provider': 'firebase',
            'x-app-version': '4.1.1316',
          },
          body: formData,
        });

        if (upRes.ok) {
          const upData = await upRes.json();
          if (upData && upData.url) {
            return {
              type: 'image',
              url: upData.url,
              width: upData.width || 1024,
              height: upData.height || 1024,
              thumbnailUrl: upData.thumbnailUrl || upData.url,
              id: upData.id || `img_${Date.now()}`,
              name: upData.name || fileName,
            };
          }
        }
      }
    } catch (err) {
      console.warn('[Weavy Client Asset Upload Warning]:', err);
    }

    return null;
  }

  // Robust Recipe Canvas Discovery & Creator
  async function getOrCreateWeavyRecipeId(idToken, userId, purpose = 'image') {
    const storageKey = `weavy_canvas_${purpose}_${userId || 'default'}`;
    const headers = getWeavyClientHeaders(idToken);

    // 0. Check if active Weavy tab is currently opened on a canvas
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        const tabs = await chrome.tabs.query({ url: ['*://app.weavy.ai/*', '*://*.weavy.ai/*'] });
        for (const tab of tabs) {
          if (tab.url) {
            const match = tab.url.match(/\/(?:canvas|recipes|project|recipe)\/([a-zA-Z0-9_-]{10,})/i);
            if (match && match[1] && match[1] !== 'new') {
              await storage.set(storageKey, match[1]);
              return match[1];
            }
          }
        }
      }
    } catch (tabErr) {}

    // 1. Check storage for existing valid recipe
    const cachedId = await storage.get(storageKey);
    if (cachedId && !cachedId.startsWith('img_recipe_') && !cachedId.startsWith('ext_recipe_') && !cachedId.startsWith('gen_img_')) {
      try {
        const checkRes = await callWeavyApi(`/api/v1/recipes/${cachedId}`, { headers });
        if (checkRes.ok) {
          return cachedId;
        }
      } catch (e) {}
    }

    // 2. Discover user's existing active recipes from Weavy Cloud (GET /api/v1/recipes)
    try {
      const listRes = await callWeavyApi(`/api/v1/recipes?limit=50`, { headers });
      if (listRes.ok) {
        const listData = await listRes.json();
        const recipes = Array.isArray(listData) ? listData : (listData.recipes || listData.data || listData.items || []);
        if (recipes.length > 0) {
          const matching = recipes.find((r) => (r.name || '').toLowerCase().includes(purpose)) || recipes[0];
          const foundId = matching.id || matching._id;
          if (foundId) {
            await storage.set(storageKey, foundId);
            return foundId;
          }
        }
      }
    } catch (e) {
      console.warn('[Weavy Recipe List Discovery Warning]:', e);
    }

    // 3. Create a new dedicated recipe on Weavy (try POST /api/v1/recipes and POST /api/v1/recipes/create)
    const createPayload = {
      name: `Weavy Extension Canvas (${purpose.toUpperCase()})`,
      description: `Automated workflow canvas for Weavy Extension ${purpose}`,
      nodes: [],
      edges: [],
      v3: true,
    };

    for (const endpoint of ['/api/v1/recipes', '/api/v1/recipes/create']) {
      try {
        const createRes = await callWeavyApi(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(createPayload),
        });
        if (createRes.ok) {
          const cData = await createRes.json();
          const newId = cData.id || cData._id || cData.recipe?.id || cData.recipe?._id || cData.data?.id || cData.data?._id;
          if (newId) {
            await storage.set(storageKey, newId);
            return newId;
          }
        }
      } catch (e) {
        console.warn(`[Weavy Recipe Create ${endpoint} Warning]:`, e);
      }
    }

    // 4. Fallback: Return a unique temporary canvas ID if backend allows auto-provision
    const fallbackId = `canvas_${purpose}_${Date.now()}`;
    return fallbackId;
  }

  // Pure Client-side Weavy LLM & Recipe Generator
  async function callWeavyLLM({ prompt, systemPrompt, model, idToken, refreshToken, history, images, mediaCatalog, scrapingContext }) {
    const acc = getActiveAccount();

    // Direct Weavy Cloud Generation via Recipe API
    let recipeId = await getOrCreateWeavyRecipeId(idToken, acc?.userId || acc?.id, 'chat');
    const headers = getWeavyClientHeaders(idToken);

    if (!recipeId) {
      throw new Error('Tidak dapat menemukan atau membuat Recipe Canvas di akun Weavy Anda. Pastikan token akun masih aktif.');
    }

    // 2.5. Upload & attach images for Vision / Multimodal LLM nodes
    const uploadedWeavyImages = [];
    if (Array.isArray(images) && images.length > 0) {
      for (const imgItem of images.slice(0, 5)) {
        const uploaded = await uploadAssetToWeavy(imgItem, idToken);
        if (uploaded) {
          uploadedWeavyImages.push(uploaded);
        }
      }
    }

    // Format prompt text
    const masterSystemInstruction = `[System Instruction: Elite Multimodal AI Assistant & Master Creative Visual Director]
Peran Utama: Anda adalah Elite Multimodal AI Assistant & Master Commercial Creative Visual Director untuk Weavy AI (AMB Media).
Nada Bicara: Gunakan Bahasa Indonesia yang natural, hangat, akrab (panggil pengguna "bro", bersahabat, solutif, to-the-point), dan penuh percaya diri.

PEDOMAN PERILAKU ARSITEKTUR WAJIB (8 PILAR UTAMA):

1. GAYA RESPON BERSIH & ANTI-SLOP (TAMPILAN ELEGAN):
- DILARANG KERAS mengeluarkan format markdown kasar seperti tanda pagar/hashtag heading (###, ##, #) atau garis pemisah horizontal (---).
- Gunakan penomoran tebal rapi (misal: "1. Analisis Visual", "2. Formula Naskah Prompt") dengan poin-poin terstruktur agar tampilan di panel samping ekstensi terlihat rapi, bersih, dan nyaman dibaca.

2. REALISME VISUAL & FOTOGRAFI (ANTI-CGI):
- Banned AI Clichés: DILARANG KERAS memakai istilah klise murahan seperti "photorealistic", "hyperrealistic", "ultra realistic", "8k", "octane render", "unreal engine", karena kata-kata ini membuat generator gambar menghasilkan visual CGI/plastik 3D murahan.
- Metrik Kamera & Lensa Nyata: Wajib menyertakan spesifikasi kamera dan lensa fisik nyata (misal: Shot on Sony Alpha A7 IV atau Hasselblad X2D 100C, lensa 24mm/35mm/50mm tilt-shift f/2.8-f/5.6, ISO 100, 1/250s shutter).
- Pencahayaan & Material Fisik: Tekankan pantulan cahaya alami (diffused soft natural daylight, 2700K warm bounce, soft contact shadows) dan tekstur material nyata (natural European white oak wood grain, textured lime-wash plaster, authentic organic fabric weave).
- Anatomi Tangan & Kulit Khusus Wanita (Anti-Vascularity): Untuk model wanita, instruksikan secara eksplisit untuk menjaga bentuk tangan feminin lembut ("soft delicate feminine hands, slender graceful fingers, smooth natural skin texture, clean neat manicured nails, zero bulging veins, no masculine vascularity").

3. GERBANG VALIDASI VISUAL (PRE-PROMPT CONSISTENCY VALIDATION):
Sebelum membuat naskah prompt atau storyboard dari media referensi yang dilampirkan, jalankan 2 tahap audit:
- Tahap 1 (Analisis Konten): Sebutkan secara eksplisit apakah ada model manusia atau hanya foto produk datar (flat-lay/gantungan baju), jenis bidikan (close-up/full-body), dan background.
- Tahap 2 (Mismatch Check): Jika ada ketidakcocokan fatal (misal: pengguna meminta "fokus ke celana yang dipakai model", tetapi gambar yang dikirim adalah foto celana di lantai tanpa orang), BERHENTI sejenak dan tanyakan opsi kepada pengguna apakah ingin memvisualisasikan model baru atau mengunggah foto model asli.
- PENGECUALIAN ANALISIS TAUTAN / KONTEN: Aturan berhenti dan menanyakan opsi menu di pilar ini KHUSUS untuk pembuatan naskah gambar/fashion mismatch. Jika pengguna menempelkan tautan (link TikTok, YouTube, Reels, web) atau meminta analisis konten video, aturan berhenti ini TIDAK BERLAKU! DILARANG KERAS menahan respon dengan pilihan menu A/B/C atau menyuruh ketik /video. Langsung sajikan analisis lengkap dan tuntas!

4. PEMISAHAN NIAT PROMPT VIDEO (INTENT SEPARATION):
- Mode Bahasa Alami (Duration-Faithful): Jika pengguna meminta prompt dari video referensi tanpa slash command (misal: "buatkan prompt dari video ini"), DILARANG KERAS memotong durasi ke 15 detik secara sepihak! Anda wajib membaca durasi asli video (@vid1), menyatakan konfirmasi durasi di kalimat pembuka ("Video referensi ini terdeteksi berdurasi [X] detik..."), dan membedah adegan dari detik ke-0 hingga detik terakhir aslinya.
- Mode Slash Command Iklan 15 Detik: Hanya jika pengguna mengetik /fashion atau /video, barulah Anda mengaktifkan formula retensi iklan komersial TikTok 15 detik:
  * 0–3s: Fast Texture Hook (macro weave, tactile kinetic motion)
  * 3–6s: Fit / Drape & Proportion (fluid silhouette, natural body dynamics)
  * 6–9s: Controlled Side View (controlled pivot 45°-90°, profile silhouette)
  * 9–12s: Rear Fit & Back Pocket Details (clean back drape, authentic motion)
  * 12–15s: Return Pivot & Hero Finish (eye-contact confidence, hero lock)

5. PENGENALAN LENGKAP PRESET SLASH COMMANDS:
- /lockcut: Montase fashion rapid discontinuous jump-cut 10 detik dengan frame kamera DIKUNCI total (zero zoom, zero pan, zero tilt — frame TETAP PERSIS kayak gambar/video referensi). Anti-interpolasi, pergantian pose INSTAN tanpa transisi atau gerakan memutar di antara pose. Tiap ~1 detik model berpindah pose statis yang beda secara INSTAN (hard cut, bukan gerakan halus). FORMULA INI BUKAN RESEP KAKU — AI KREATIF MENYESUAIikan detail pose sesuai produk yang di-showcase:
  * Jika ATASAN (kemeja/kaos/hoodie): pose fokus ke kerah, lipatan dada, collar, sleeve, hemline.
  * Jika OUTER (jaket/blazer/cardigan): pose fokus ke lapel, buttoning, collar, pocket square, shoulder.
  * Jika BAWAHAN (celana/rok): pose fokus ke waistband, hem, pleat, belt, cuff.
  * Jika OUTER PANJANG (coat/trench): pose fokus ke buttoning flow, collar drape, belt, sweeping fabric.
  * Jika TAMPAKAN FULL BODY: kombinasikan pose dari semua bagian sesuai fokus sorotan.
  Contoh formula BASE untuk fokus ATASAN (TAPI AI KREATIF MODIFIKASI SESUAI PRODUK — pose INSTAN setiap pergantian, bukan gerakan halus):
  * 0–1s: Pose depan netral — tangan di samping badan
  * 1–2s: INSTAN ganti — 45° angle showing collar detail
  * 2–3s: INSTAN ganti — tangan menyentuh kerah
  * 3–4s: INSTAN ganti — 90° side profile
  * 4–5s: INSTAN ganti — smooth fabric at chest with fingertips
  * 5–6s: INSTAN ganti — checking hemline alignment
  * 6–7s: INSTAN ganti — shoulder adjustment
  * 7–8s: INSTAN ganti — collar symmetry check
  * 8–9s: INSTAN ganti — final fabric smooth with palm
  * 9–10s: INSTAN ganti — hero lock, eye-contact, confident smile
  Contoh format prompt output: "/lockcut mode, locked camera zero zoom, rapid discontinuous jump-cut editing, zero transitional movement between poses, anti-interpolation. [detail produk] Shot on [kamera], [lens], soft natural daylight. Model instantly changes static [bagian fokus] poses every 1 second: [pose 1], [pose 2], [pose 3], [final pose]."
- /jumpcut: Video fashion hard cut dinamis per ~1 detik tanpa transisi kamera halus, sama seperti lockcut tapi tanpa fokus mikro-gerakan per detik (lebih ke pose-to-pose dinamis).
- /fashion & /video: Storyboard video komersial TikTok 15 detik presisi tinggi.
- /natural: Video gaya candid/lifestyle mengalir tanpa pembagian detik kaku (pilihan mood: santai, editorial, street documentary, golden hour).
- /ugc: Gaya konten organik selfie influencer di smartphone (iPhone front camera, pencahayaan alami kamar, un-staged authentic).
- /clean: Pembersihan ruangan dari barang berantakan/kabel dengan mempertahankan elemen arsitektur dan furnitur utama asli.
- /customstoryboard: Mode Custom Storyboard Compiler (Pure Main Brief). Wajib mengikuti Main Brief pengguna 100% tanpa menyuntikkan formula baku/gaya kamera tertentu kecuali diminta di brief. Susun naskah dan alur adegan pengguna ke dalam breakdown scene yang rapi dan SELALU sertakan blok kode JSON \`\`\`storyboard_project ... \`\`\` agar UI otomatis merender kartu Storyboard dan tombol "🎬 Kirim ke Storyboard" siap pakai di Weavy AI.
- /copilotstoryboard: Mode Storyboard Copilot resmi. Wajib menganalisis gambar atau tautan (link) terlampir terlebih dahulu di awal respon (USP, visual selling point, pain point), ikuti Main Brief pengguna secara mutlak tanpa melenceng, lalu susun breakdown adegan per scene yang siap pakai dan SELALU sertakan blok kode JSON \`\`\`storyboard_project ... \`\`\` agar UI otomatis menampilkan kartu interaktif Storyboard Copilot dan tombol "Kirim ke Storyboard".
- /harvestpov: Formula video viral 10 detik POV tangan (hands-only): Suasana pekarangan kebun alami ➔ POV tangan memetik buah ranum berembun dari pohon/rambatan (0-3s) ➔ POV tangan membelah buah di talenan kayu, memperlihatkan daging tebal berair juicy berkilau manis (3-7s) ➔ POV tangan mengangkat irisan buah ke kamera dan mencicipi/memakannya (7-10s) + CTA ajakan order bibit/buah. Tanpa wajah (zero-face POV), tanpa teks di layar, prompt gambar clean fotografi 8k murni tanpa banner/watermark. Wajib sertakan blok kode JSON \`\`\`storyboard_project ... \`\`\` agar UI otomatis menampilkan kartu '🎬 STORYBOARD COPILOT: POV HARVEST & TASTE' dan tombol '🎬 Kirim ke Storyboard'.
- /facelessgardenugc: Formula video vertikal UGC komersial bertema kebun rumahan 20 detik (2 Scene @ 10s). Gaya visual "Faceless Hands-Only Garden UGC", hanya menampilkan tangan wanita (soft delicate feminine hands), voiceover narasi wanita "Natural Persuasive Female Narration", visual pekarangan rumah realistis (polybag hitam default), CTA soft-selling ramah, dan tanpa teks di layar ("onScreenText": ""). Wajib sertakan blok kode JSON \`\`\`storyboard_project ... \`\`\` agar UI otomatis merender kartu Storyboard dan tombol "🎬 Kirim ke Storyboard".
- /plantreview: Formula video viral TikTok review tanaman & buah unik (Hook Visual Oddity ➔ Analogi Bentuk/Rasa ➔ Pembuktian Rasa/Taste Test ➔ Solusi Tabulampot Pekarangan ➔ Naskah VO & Scene ➔ JSON Storyboard Weavy ➔ Template Caption TikTok Rapi Lengkap dengan Emoji, Disclaimer & Komen Trigger). Wajib sertakan blok kode JSON \`\`\`storyboard_project ... \`\`\` dan saran caption TikTok siap copy-paste di akhir respon.
- /buahunggul (atau /seedlessfruit, /cuanbibit): Formula video viral TikTok 30 detik UNIVERSAL untuk semua jenis produk (Buah, Sayuran, Bibit, Pupuk, Nutrisi, Alat Kebun, dan Produk Lainnya — 3 Scene @ 10s, Max 3 Shot per Scene): Scene 1 Hook Visual & Bukti Kualitas Produk (0-10s) ➔ Scene 2 Showcase Hasil Lebat & Manfaat/Nilai Ekonomi (10-20s) ➔ Scene 3 Produk Siap Kirim & CTA Keranjang Kuning Kiri Bawah (20-30s) + Instruksi VO Pria/Wanita + Instruksi Murni Video Tanpa Teks/Gambar + JSON Storyboard Weavy + Template Caption TikTok Rapi). ATURAN MUTLAK VO: Voiceover per scene 10 detik WAJIB MINIMAL 27 KATA & MAKSIMAL 30 KATA (rentang wajib: 27–30 kata per scene, total 3 scene: 81–90 kata). DILARANG di bawah 27 kata (kependekan) dan DILARANG di atas 30 kata (agar tidak terpotong saat render 10 detik). Wajib 100% mengikuti produk di brief pengguna.
- /onthespot (atau /spotbibit, /spotbuah, /investigasikebun): Formula video viral Perpaduan Visual Sinematik Investigasi "On The Spot" Trans7 + Voice Over Influencer TikTok Jualan (3 Fakta Mencengangkan, 3 Scene @ 10s pas untuk render Google Gemini Veo/Flow): Scene 1 Fakta #1 Hook Racun TikTok & Keajaiban Visual (0-10s) ➔ Scene 2 Fakta #2 Pembuktian Kualitas Ekstrem & Spill Panen Lebat (10-20s) ➔ Scene 3 Fakta #3 Peringatan Waspada Tiruan + Hard CTA Keranjang Kuning Kiri Bawah (20-30s) + Suara Influencer TikTok Energik Persuasif + Visual Fotorealistik 4K Veo/Flow Tanpa Teks + JSON Storyboard + Tombol Salin Scene Siap Pakai). ATURAN MUTLAK VO: Voiceover per scene 10 detik WAJIB MINIMAL 27 KATA & MAKSIMAL 30 KATA (rentang wajib: 27–30 kata per scene, total 3 scene: 81–90 kata). DILARANG di bawah 27 kata (kependekan) dan DILARANG di atas 30 kata (agar tidak terpotong saat render 10 detik). Wajib sertakan blok kode JSON \`\`\`storyboard_project ... \`\`\` dan template caption TikTok di akhir respon.
- /homeharvest (atau /kitchengarden): Formula video viral panen sayuran dapur di pekarangan rumah (3 Scene & 9 Sub-Shoot @ 29s: Hook Showcase Lebat ➔ Tanam Pekarangan & Petik ➔ Hasil Panen & Closing Trigger + On-Screen Text Hook + JSON Storyboard Weavy + Caption TikTok Rapi & Lengkap). ATURAN MUTLAK VO: Voiceover per scene WAJIB MINIMAL 27 KATA & MAKSIMAL 30 KATA (rentang 27–30 kata, anti-terpotong). Wajib sertakan blok kode JSON \`\`\`storyboard_project ... \`\`\` dan saran caption TikTok di akhir respon.
- /kebunimpian (atau /gardentour): Formula video viral tour & makeover kebun impian di lahan sempit (POV dua tangan wanita / delicate female hands-only, latar pekarangan rumah lokal Indonesia bersahaja non-mewah, barang besar ditaruh rapi di tanah/rak tanpa diangkat paksa, semi-ASMR alami dengan jeda hening dan tanpa voiceover nonstop, ~10s per scene, max 3 shoot per scene, total max 60s). ATURAN MUTLAK VO: Voiceover per scene WAJIB MINIMAL 27 KATA & MAKSIMAL 30 KATA (rentang 27–30 kata, anti-terpotong). Wajib sertakan blok kode JSON \`\`\`storyboard_project ... \`\`\` dan template caption TikTok/Shorts rapi di akhir respon.
- ATURAN UNIVERSAL VOICEOVER (SEMUA PRESET & SEMUA SCENE): Di setiap scene dari semua preset, naskah Voiceover (VO) WAJIB MEMENUHI MINIMAL 27 KATA DAN MAKSIMAL 30 KATA TIAP SCENE-NYA DENGAN PANJANG 180–205 KARAKTER (MAKSIMAL MUTLAK 210 KARAKTER TERMASUK SPASI & TANDA BACA, total 3 scene: 81–90 kata / ~550–600 karakter). DILARANG membuat naskah di bawah 27 kata / <175 karakter (kependekan), dan DILARANG MEMBUAT NASKAH DI ATAS 30 KATA ATAU DI ATAS 210 KARAKTER karena terbukti terpotong saat render 10 detik di Google Gemini Veo / Flow / TTS! Targetkan persis 27–30 kata (180–205 karakter) per scene 10 detik agar pas dan aman dari kepotong.
- ATURAN KESINAMBUNGAN NARRATIF & FRASA TRANSISI (STORY CONTINUITY & SEAMLESS FLOW): Seluruh adegan storyboard WAJIB memiliki "frasa transisi" dan "rasa alur" yang menyambung secara utuh (bukan adegan terputus-putus). Hubungkan Scene 1 (Hook Keajaiban) ke Scene 2 (Jawaban & Pembuktian Kualitas) dengan frasa jembatan alami (seperti: "Nah kalian penasaran kan kenapa bisa begini? Pas kita belah...", "Ternyata rahasianya ada di sini..."), lalu hubungkan Scene 2 ke Scene 3 (Solusi & Ajakan Beli) dengan jembatan aksi (seperti: "Biar pekarangan rumah kalian bisa panen semelimpah ini juga, pastikan...", "Kabar baiknya bibit aslinya sudah siap kirim..."). Visual tanaman, varietas buah, pot/wadah pekarangan, tangan talent, dan pencahayaan WAJIB konsisten 100% antar-scene.

6. KATALOG SESI (@imgX & @vidX) DAN FITUR REPOST 0 KREDIT:
- Pelacakan Media: Setiap media dalam percakapan memiliki penomoran indeks resmi (@img1, @img2, dst. untuk gambar dan @vid1, @vid2, dst. untuk video).
- Fitur Repost Media: Jika pengguna meminta melihat kembali gambar lama ("mana gambar pertama tadi", "kirim lagi foto ke-2", "tampilkan @img1"), DILARANG menyuruh render ulang dan DILARANG memotong koin pengguna. Cukup sertakan tag:
  [weavy_repost:@img1]
  Sistem ekstensi Weavy akan langsung memunculkan gambar asli dari cache lokal/server tanpa memotong kredit (0 kredit).

7. INTEGRASI EKSEKUSI GAMBAR OTOMATIS (weavy_generate):
Jika pengguna meminta gambar dibuatkan ("generate ke gambar", "buatkan fotonya sekarang", "render visual ini"):
Pilih model AI Weavy yang paling optimal:
- "Nano Banana Pro": untuk arsitektur, ruangan, interior, dan foto realistis.
- "Seedream V5.0 Pro Edit": untuk fashion, model manusia, multi-image reference hingga 10 gambar.
- "GPT Image 2.5": untuk generasi cepat & hemat koin.
Sertakan blok JSON khusus di akhir respon:
\`\`\`weavy_generate
{
  "model": "Seedream V5.0 Pro Edit",
  "prompt": "Full descriptive English prompt...",
  "aspect_ratio": "9:16",
  "references": ["@img1"]
}
\`\`\`
Sistem Weavy akan langsung mengubah blok ini menjadi tombol render interaktif di chat bubble.

8. PROTOKOL ANALISIS TAUTAN VIDEO & KONTEN (TIKTOK / REELS / SHORTS / WEB):
Ketika pengguna menempelkan tautan video atau meminta analisis link konten (misalnya TikTok, YouTube Shorts, Instagram Reels, Tokopedia, Shopee, atau web):
- DILARANG KERAS berhenti sejenak, DILARANG hanya memberi cuplikan pendek, DILARANG menanyakan opsi menu (A, B, C), dan DILARANG meminta pengguna mengetik /video.
- WAJIB LANGSUNG sajikan analisis menyeluruh, mendalam, tajam, dan siap pakai dengan format 5 bagian lengkap tanpa ada yang dipotong:

1. Ringkasan & Metadata Konten:
- Akun / Kreator: sebutkan nama akun dan kreator yang terdeteksi
- Niche & Format Konten: kategori topik dan format penyampaian
- Teks Naskah Asli Lengkap: kutip seluruh naskah/caption asli yang diekstrak dari metadata secara utuh (jangan dipotong).

2. Bedah Hook & Formula Psikologi Konten (Viral Triggers):
- Curiosity Hook (0–3 Detik Pertama): bedah formula pemicu rasa penasaran dan pattern interrupt visual.
- Value Stacking & Relatabilitas: bedah bagaimana solusi/tips diramu dengan bahan sehari-hari atau konsep yang membumi.
- Debate & Comment Trigger (Pemicu Algoritma Komentar & FYP): analisa secara psikologis kenapa audiens terdorong berdebat, bertanya, atau berkomentar banyak.
- Feedback Loop CTA: analisa call-to-action yang digunakan kreator.

3. Kekuatan Metrik di TikTok / Media Sosial:
- Analisis metrik Save / Bookmark Rate (mengapa orang menyimpan video ini).
- Analisis Share Rate (mengapa orang membagikan video ini).

4. Rekomendasi Storyboard Adaptasi / Remake:
- Sajikan LANGSUNG rancangan adegan video adaptasi dalam bentuk tabel markdown terstruktur lengkap dari detik 0 hingga akhir video:
| Scene | Durasi | Visual Angle & Action | Narasi / On-Screen Text |
|---|---|---|---|
| Scene 1 | 0–3s | [Visual hook & angle detail] | [Teks/Voiceover] |
| Scene 2 | 3–7s | [Problem/Bahan komparasi] | [Teks/Voiceover] |
| Scene 3 | 7–11s | [Aplikasi/Demonstrasi cara] | [Teks/Voiceover] |
| Scene 4 | 11–15s | [Hasil menakjubkan & penutup] | [CTA & Voiceover] |

5. Potensi Monetisasi & Keranjang Kuning (TikTok Shop / Affiliate):
- Rincikan produk-produk fisik, perlengkapan kebun/alat/bahan, atau affiliate di keranjang kuning yang paling konversif untuk disematkan pada format video tersebut.`;

    const { mediaCatalogSection, scrapingSection } = buildNativeChatSupplementalContext({
      mediaCatalog,
      scrapingContext,
    });

    let libraryKnowledgeSection = '';
    try {
      const libAssets = typeof getLibraryAssets === 'function' ? getLibraryAssets() : [];
      const libKnowledgeText = buildLibraryKnowledgePrompt(libAssets);
      if (libKnowledgeText && libKnowledgeText.trim()) {
        libraryKnowledgeSection = `\n\n${libKnowledgeText.trim()}\n`;
      }
    } catch (e) {
      console.warn('[Library Knowledge Section Warn]:', e);
    }

    let fullPromptText = '';
    if (systemPrompt && systemPrompt.trim()) {
      fullPromptText = `${systemPrompt.trim()}${libraryKnowledgeSection}${mediaCatalogSection}${scrapingSection}\n\n`;
      if (history && history.length > 0) {
        fullPromptText += `[Conversation History]\n`;
        for (const m of history) {
          if (m.content !== prompt) {
            const roleLabel = (m.role === 'assistant' || m.role === 'model') ? 'Assistant' : 'User';
            fullPromptText += `${roleLabel}: ${m.content}\n`;
          }
        }
        fullPromptText += `\n`;
      }
      const currentPromptText = prompt || (uploadedWeavyImages.length > 0 ? 'Analisis gambar dan rancang storyboard terstruktur.' : 'Generate storyboard.');
      fullPromptText += `User: ${currentPromptText}\n\nAssistant:`;
    } else {
      fullPromptText = `${masterSystemInstruction}${libraryKnowledgeSection}${mediaCatalogSection}${scrapingSection}\n\n[Conversation History]\n`;
      if (history && history.length > 0) {
        for (const m of history) {
          const roleLabel = (m.role === 'assistant' || m.role === 'model') ? 'Assistant' : 'User';
          let c = m.content || '';
          if (Array.isArray(m.attachments)) {
            for (const att of m.attachments) {
              if (att.type === 'image' || att.url || att.base64) {
                c += `\n[Lampiran Gambar "${att.name || 'Foto'}" disertakan oleh pengguna]`;
              }
            }
          }
          if (c.trim()) {
            fullPromptText += `${roleLabel}: ${c}\n`;
          }
        }
      }
      const currentPromptText = prompt || (uploadedWeavyImages.length > 0 ? 'Analisis dan jelaskan gambar yang saya lampirkan secara mendetail.' : 'Halo!');
      fullPromptText += `User: ${currentPromptText}\n\nAssistant:`;
    }

    // Construct Nodes & Edges matching server recipe structure
    const promptNodeId = `prompt_${Date.now()}`;
    const modelNodeId = `model_${Date.now()}`;
    const targetModel = model || 'google/gemini-3-pro';

    const promptNode = {
      id: promptNodeId,
      type: 'promptV3',
      position: { x: 200, y: 200 },
      data: {
        name: 'Prompt',
        color: 'Yambo_Green',
        prompt: fullPromptText,
        output: { type: 'text', prompt: fullPromptText },
        result: { prompt: fullPromptText },
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
          model: { type: 'value', data: { type: 'string', value: targetModel } },
          prompt: { nodeId: promptNodeId, string: fullPromptText, outputId: 'prompt' },
          thinking: { type: 'value', data: { type: 'boolean', value: false } },
          temperature: { type: 'value', data: { type: 'float', value: systemPrompt ? 0.3 : 0.7 } },
        },
        params: {
          model: targetModel,
          temperature: systemPrompt ? 0.3 : 0.7,
          prompt: fullPromptText,
          thinking: false,
        },
        input: {
          prompt: fullPromptText,
        },
        handles: {
          input: {
            prompt: { type: 'text', order: 0, required: true },
            system_prompt: { type: 'text', order: 1, required: false },
            image: { type: 'image', order: 2, required: false },
          },
          output: {
            text: { type: 'text', order: 0 },
          },
        },
        version: 3,
      },
    };

    const nodes = [promptNode, modelNode];
    const edges = [
      {
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
      },
    ];

    if (uploadedWeavyImages.length > 0) {
      modelNode.data.kind.images = [];
      uploadedWeavyImages.forEach((imgObj, idx) => {
        const fNodeId = `file_${Date.now()}_${idx}`;
        const handleKey = idx === 0 ? 'image' : `image_${idx + 1}`;
        const fileNode = {
          id: fNodeId,
          type: 'import',
          position: { x: 200, y: 480 + idx * 220 },
          data: {
            name: `File ${idx + 1}`,
            color: 'Yambo_Blue',
            files: [imgObj],
            output: { file: imgObj },
            result: imgObj,
            handles: { output: { file: { type: 'any', order: 0 } } },
            version: 3,
          },
        };
        nodes.push(fileNode);

        modelNode.data.kind.images.push([
          handleKey,
          { file: imgObj, nodeId: fNodeId, outputId: 'file' }
        ]);

        if (idx > 0) {
          modelNode.data.handles.input[handleKey] = { type: 'image', order: 2 + idx, required: false };
        }

        edges.push({
          id: `edge_f_${idx}_${Date.now()}`,
          type: 'custom',
          source: fNodeId,
          target: modelNodeId,
          sourceHandle: `${fNodeId}-output-file`,
          targetHandle: `${modelNodeId}-input-${handleKey}`,
          data: {
            sourceColor: 'Yambo_Blue',
            targetColor: 'Yambo_Purple',
            sourceHandleType: 'any',
            targetHandleType: 'image',
          },
        });
      });
    }

    const execution = await executeWeavyChatRecipe({
      recipeId,
      headers,
      model: targetModel,
      graph: { nodes, edges, promptNodeId, modelNodeId },
      pollAttempts: 45,
      pollInterval: 1500,
      ignoreSaveErrors: true,
      onUnauthorized: async () => {
        showAuthAlert('Terjadi error 403 di Weavy Chat. Mereload tab Weavy & menyinkronkan token...', 'info');
        const freshToken = await recoverWeavySessionOn403Helper({
          account: acc,
          accounts,
          syncSingleAccountFn: syncSingleAccount,
          exchangeRefreshTokenFn: exchangeRefreshToken,
          saveAccountsFn: saveAccounts,
          onStatusUpdate: (msg) => showAuthAlert(msg, 'info'),
        });
        const storageKey = `weavy_canvas_chat_${acc?.userId || 'default'}`;
        await storage.set(storageKey, null);
        const activeToken = freshToken || (await getValidIdToken(acc));
        if (!activeToken) return null;
        const retryRecipeId = await getOrCreateWeavyRecipeId(activeToken, acc?.userId || acc?.id, 'chat');
        return {
          recipeId: retryRecipeId,
          headers: getWeavyClientHeaders(activeToken),
        };
      },
    });

    return execution.content.trim();
  }

  function renderGenRefGallery() {
    renderGenRefGalleryUi({
      currentGenRefImages,
      refGalleryContainer: document.getElementById('refGalleryContainer'),
      refImagesGrid: document.getElementById('refImagesGrid'),
      btnChooseRefImage: document.getElementById('btnChooseRefImage'),
      refImagesCountBadge: document.getElementById('refImagesCountBadge'),
      genRefTray: document.getElementById('genRefTray'),
      genRefCountText: document.getElementById('genRefCountText'),
      genRefChipsGrid: document.getElementById('genRefChipsGrid') || document.getElementById('refImagesGrid'),
    });

    if (typeof window !== 'undefined') {
      window.__weavyUpdateGenRefImages = (nextList) => {
        currentGenRefImages = nextList;
        renderGenRefGallery();
      };
    }
  }

  async function handleAddGenRefFiles(fileList) {
    const visibleProvider = document.getElementById('subbarProviderName')?.textContent?.trim().toLowerCase();
    const isFlowProvider = activeProvider === 'flow' || visibleProvider === 'flow';
    const isDolaProvider = activeProvider === 'dola' || visibleProvider === 'dola';

    if (isFlowProvider) {
      const uploadPromise = readFlowReferenceFiles(fileList);
      flowReferenceUploadPromise = uploadPromise;
      try {
        const flowItems = await uploadPromise;
        currentGenRefImages = flowItems;
        renderGenRefGallery();
      } catch (error) {
        showAuthAlert(`Gagal membaca gambar referensi Flow: ${error.message}`, 'error');
      } finally {
        if (flowReferenceUploadPromise === uploadPromise) flowReferenceUploadPromise = null;
      }
      return;
    }

    if (isDolaProvider) {
      try {
        const dolaItems = await readDolaReferenceFiles(fileList);
        currentGenRefImages = [...currentGenRefImages, ...dolaItems].slice(0, 3);
        renderGenRefGallery();
        showAuthAlert(`✅ ${dolaItems.length} Foto referensi Dola ditambahkan (maks. 3 gambar).`, 'info');
      } catch (error) {
        showAuthAlert(`Gagal membaca gambar referensi Dola: ${error.message}`, 'error');
      }
      return;
    }

    await handleAddGenRefFilesHelper({
      fileList,
      currentGenRefImages,
      getValidImageFiles,
      getActiveAccount,
      showAuthAlert,
      switchTab,
      getValidIdToken,
      uploadAssetToWeavy,
      renderGenRefGallery,
    });
  }

  // --- INLINE CHAT WEAVY & DOLA IMAGE/VIDEO GENERATION TRIGGER ---
  async function executeChatInlineGenerate(btnEl, config, msgId) {
    const acc = getActiveAccount();
    const currentModelVal = chatModelSelect?.value || '';
    const isDola = (config.provider === 'dola') ||
      currentModelVal.startsWith('dola/') ||
      (acc && acc.type === 'dola') ||
      String(config.model || '').toLowerCase().includes('dola') ||
      String(config.model || '').toLowerCase().includes('doubao') ||
      String(config.model || '').toLowerCase().includes('seedance');

    if (!acc) {
      alert(`Silakan hubungkan akun ${isDola ? 'Dola' : 'Weavy'} terlebih dahulu di tab Akun & Token.`);
      switchTab('settings');
      return;
    }

    const session = getCurrentSession();
    const targetMsg = session?.messages?.find((m) => m.id === msgId) || (session?.messages ? session.messages[session.messages.length - 1] : null);

    btnEl.disabled = true;
    const origHtml = btnEl.innerHTML;
    btnEl.innerHTML = `<span>⏳ Menghubungkan ke ${isDola ? 'Dola AI Studio' : 'Weavy Cloud'}...</span>`;

    try {
      const prompt = (config.prompt || '').trim();
      if (!prompt) {
        throw new Error('Prompt generasi tidak boleh kosong.');
      }

      const isVideo = config.mode === 'video' || config.type === 'video' || String(config.model || '').toLowerCase().includes('seedance') || String(config.model || '').toLowerCase().includes('video');
      const aspectRatio = config.aspect_ratio || config.aspectRatio || (isVideo ? '16:9' : '1:1');

      // Resolve reference assets from chat session
      const readyAssets = [];
      if (session) {
        const { mediaMap } = buildSessionMediaCatalog(session);
        const refKeys = Array.isArray(config.references) ? config.references : [];
        for (const refKey of refKeys) {
          const mItem = mediaMap[String(refKey).toLowerCase()];
          if (mItem) {
            btnEl.innerHTML = `<span>📤 Mempersiapkan referensi ${escapeHtml(mItem.key)}...</span>`;
            if (isDola) {
              readyAssets.push({ url: mItem.url, base64: mItem.base64, name: mItem.name });
            } else {
              const idToken = await getValidIdToken(acc);
              const uploaded = await uploadAssetToWeavy({ url: mItem.url, base64: mItem.base64, name: mItem.name }, idToken);
              if (uploaded) readyAssets.push(uploaded);
            }
          }
        }
      }

      btnEl.innerHTML = `<span>🎨 Memproses di ${isDola ? 'Dola Generator Background' : 'Weavy AI'}...</span>`;

      let resultUrl = '';
      let generatedImages = [];
      let resultChatId = null;

      if (isDola) {
        const targetModel = config.model || (isVideo ? 'seedance_v2.5' : 'doubao_pro');
        const executeDolaGen = isVideo ? executeDolaVideoGeneration : executeDolaImageGeneration;

        const res = await executeDolaGen({
          prompt,
          model: targetModel,
          aspectRatio,
          resolution: '1080p',
          videoType: config.videoType || 'normal',
          videoDuration: config.videoDuration || 15,
          referenceAssets: readyAssets,
          account: acc,
          onProgress: (pct, st) => {
            btnEl.innerHTML = `<span>🎨 ${st} (${pct}%)</span>`;
          },
        });

        if (typeof res === 'object' && res !== null) {
          resultUrl = res.url || res.downloadUrl || '';
          if (Array.isArray(res.images)) {
            generatedImages = res.images;
          }
          resultChatId = res.chatId || res.conversationId || res.convId || null;
        } else {
          resultUrl = String(res || '');
        }

        // Save to Recent Generations History
        try {
          const sourceTaskId = `gen_chat_${Date.now()}`;
          const newGenItem = {
            id: sourceTaskId,
            type: isVideo ? 'video' : 'image',
            url: resultUrl,
            images: generatedImages.length > 0 ? generatedImages : (resultUrl ? [resultUrl] : []),
            prompt,
            model: targetModel,
            aspectRatio,
            resolution: '1080p',
            timestamp: Date.now(),
            chatId: resultChatId || session?.dolaConvId || null,
            provider: 'dola',
          };
          await saveRecentGeneration(newGenItem);
        } catch (_) {}

      } else {
        const idToken = await getValidIdToken(acc);
        let targetModel = 'seedream_v5_pro_edit';
        const mStr = (config.model || '').toLowerCase();
        if (mStr.includes('banana') || mStr.includes('nano')) {
          targetModel = 'nano_banana_pro';
        } else if (mStr.includes('gpt') || mStr.includes('flare')) {
          targetModel = 'gpt_image_2_5';
        } else if (mStr.includes('seedream') || mStr.includes('v5')) {
          targetModel = 'seedream_v5_pro_edit';
        }

        resultUrl = await executeWeavyImageCanvas({
          prompt,
          model: targetModel,
          aspectRatio,
          resolution: '1080p',
          readyAssets,
          idToken,
          acc,
          onProgress: (pct, st) => {
            btnEl.innerHTML = `<span>🎨 ${st} (${pct}%)</span>`;
          },
        });
      }

      if (targetMsg) {
        targetMsg.generatedImage = {
          url: resultUrl,
          images: generatedImages.length > 0 ? generatedImages : (resultUrl ? [resultUrl] : []),
          modelName: config.model || (isDola ? (isVideo ? 'Seedance 2.5' : 'Dola Doubao Pro') : 'Weavy AI'),
          aspectRatio,
          prompt,
        };

        // Append media repost tags directly to message content for rich gallery/player card rendering
        if (isVideo && resultUrl) {
          if (!targetMsg.content.includes(resultUrl)) {
            targetMsg.content = `${targetMsg.content || ''}\n\n[weavy_repost_video:${resultUrl}]`.trim();
          }
        } else if (generatedImages.length > 0) {
          const newTags = generatedImages.filter((img) => !targetMsg.content.includes(img)).map((img) => `[weavy_repost:${img}]`).join('\n');
          if (newTags) {
            targetMsg.content = `${targetMsg.content || ''}\n\n${newTags}`.trim();
          }
        } else if (resultUrl && !targetMsg.content.includes(resultUrl)) {
          targetMsg.content = `${targetMsg.content || ''}\n\n[weavy_repost:${resultUrl}]`.trim();
        }
      }

      await saveChatSessions();
      renderChatMessages();
      refreshCredits();
      showAuthAlert(`${isVideo ? 'Video' : 'Gambar'} berhasil digenerate langsung dari Chat!`, 'success');
    } catch (err) {
      console.error('[Chat Gen Error]:', err);
      alert('Gagal membuat media: ' + (err.message || 'Terjadi kesalahan sistem.'));
      btnEl.disabled = false;
      btnEl.innerHTML = origHtml;
    }
  }

  async function approveWeavyModel(modelId, idToken, userId, recipeId, onProgress) {
    if (!modelId || !idToken || !recipeId) return false;

    if (onProgress) onProgress(12, 'Meminta approval model di Weavy AI...');
    const approveRes = await callWeavyApi('/api/v1/workspaces/models/approve', {
      method: 'POST',
      headers: getWeavyClientHeaders(idToken, userId, recipeId),
      body: JSON.stringify({ modelIds: [modelId] }),
    });

    if (!approveRes.ok) {
      const errorText = await approveRes.text().catch(() => '');
      throw new Error(`Approval model gagal (HTTP ${approveRes.status}): ${errorText.slice(0, 160)}`);
    }

    return true;
  }

  // --- REUSABLE WEAVY CANVAS IMAGE GENERATION ENGINE ---
  async function executeWeavyImageCanvas({ prompt, model, aspectRatio = '9:16', resolution = '1080p', readyAssets = [], idToken, acc, onProgress }) {
    let recipeId = await getOrCreateWeavyRecipeId(idToken, acc?.userId || acc?.id, 'image');
    if (!recipeId) {
      throw new Error('Tidak dapat menemukan atau membuat Recipe Canvas di akun Weavy Anda. Silakan coba klik tombol refresh saldo akun.');
    }

    const promptNodeId = `prompt_${Date.now()}`;
    const modelNodeId = `node_model_${Date.now()}`;

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

    // Classify only known model values; an unknown value must never silently become GPT 2.5.
    const normalizedModel = String(model || '').trim().toLowerCase();
    const isSeedream = normalizedModel === 'fal-ai/bytedance/seedream/v5/lite/edit' || normalizedModel === 'seedream_v5_pro_edit';
    const isNanoBanana = normalizedModel === 'fal-ai/nano-banana-pro/edit' || normalizedModel === 'nano_banana_pro';
    const isGrok = normalizedModel === 'xai/grok-imagine-image' || normalizedModel === 'grok_imagine';
    const isGptEdit = normalizedModel === 'gpt_image_1_edit';
    const isGpt2 = normalizedModel === 'gpt_image_2';
    const isGpt25 = normalizedModel === 'flare-ai/flare-2.5' || normalizedModel === 'gpt_image_2_5';

    if (!isSeedream && !isNanoBanana && !isGrok && !isGptEdit && !isGpt2 && !isGpt25) {
      throw new Error(`Model gambar tidak dikenali: ${model || '(kosong)'}. Pilih ulang model dari Settings Prompt.`);
    }

    const randomSeed = Math.floor(Math.random() * 2147483647);

    // Aspect ratio mapping for built-in image size
    const imageSizeMap = {
      '9:16': 'portrait_16_9',
      '16:9': 'landscape_16_9',
      '1:1': 'square_hd',
      '4:3': 'landscape_4_3',
      '3:4': 'portrait_4_3',
    };
    const imageSize = imageSizeMap[aspectRatio] || 'portrait_16_9';

    let targetModelName = 'gpt-image-2.5';
    let targetDisplayName = 'GPT Image 2.5';
    let targetDescription = 'Generates images with GPT Image 2.5';
    let targetMenuDisplayName = 'GPT Image 2.5';
    let modelCredits = 10;
    let inputsList = [];
    let parametersList = [];
    let paramsObj = {};
    let inputObj = { prompt: prompt.trim() };
    let nodeHandles = {
      input: { prompt: { type: 'text', order: 0, required: true } },
      output: { result: { type: 'image', order: 0 } },
    };
    let outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
    let nodeSchema = {};

    // Prepare prompt input handle
    inputsList.push([
      { id: 'prompt', title: 'Prompt', description: 'Text description', validTypes: ['text'], required: true },
      { nodeId: promptNodeId, outputId: 'prompt', string: prompt.trim() },
    ]);

    // Dynamically build reference image file nodes and connections for ALL uploaded assets
    const refNodes = [];
    const refEdges = [];

    readyAssets.forEach((asset, idx) => {
      const fNodeId = `file_ref_${Date.now()}_${idx}`;
      const handleName = (isGptEdit && idx === 0) ? 'image' : (isGrok && readyAssets.length === 1) ? 'image' : `image_${idx + 1}`;

      refNodes.push({
        id: fNodeId,
        isModel: false,
        type: 'import',
        dragHandle: '.node-header',
        position: { x: 200, y: 380 + idx * 180 },
        data: {
          name: `File ${idx + 1}`,
          color: 'Yambo_Blue',
          files: [asset],
          output: { file: asset },
          result: asset,
          handles: {
            output: {
              file: {
                type: 'any',
                label: 'File',
                order: 0,
                format: 'uri',
                description: 'The uploaded file',
              },
            },
          },
          version: 3,
          dark_color: 'Yambo_Blue_Dark',
          border_color: 'Yambo_Blue_Stroke',
        },
      });

      refEdges.push({
        id: `edge_ref_${idx + 1}_${Date.now()}`,
        type: 'custom',
        source: fNodeId,
        target: modelNodeId,
        sourceHandle: `${fNodeId}-output-file`,
        targetHandle: `${modelNodeId}-input-${handleName}`,
        data: {
          sourceColor: 'Yambo_Blue',
          targetColor: 'Yambo_Purple',
          sourceHandleType: 'any',
          targetHandleType: 'image',
        },
      });

      nodeHandles.input[handleName] = { type: 'image', order: idx + 1, required: (isGptEdit && idx === 0) };
      inputsList.push([
        { id: handleName, title: handleName, description: `Reference image ${idx + 1}`, validTypes: ['image'], required: (isGptEdit && idx === 0) },
        { nodeId: fNodeId, outputId: 'file', file: asset },
      ]);
      paramsObj[handleName] = asset;
      inputObj[handleName] = asset;
    });

    if (isGpt25) {
      targetModelName = 'gpt-image-2.5';
      targetDisplayName = 'GPT Image 2.5';
      targetDescription = 'Generates images with GPT Image 2.5';
      targetMenuDisplayName = 'GPT Image 2.5';
      modelCredits = 10;
      outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
      parametersList = [
        [
          { id: 'model', title: 'Variant', constraint: { type: 'enum', options: ['Flare', 'Sunburst'] }, defaultValue: { type: 'string', value: 'Flare' } },
          { type: 'value', data: { type: 'string', value: 'Flare' } },
        ],
        [
          { id: 'quality', title: 'Quality', constraint: { type: 'enum', options: ['auto', 'low', 'medium', 'high', 'xhigh', 'max'] }, defaultValue: { type: 'string', value: 'high' } },
          { type: 'value', data: { type: 'string', value: 'high' } },
        ],
        [
          { id: 'background', title: 'Background', constraint: { type: 'enum', options: ['auto', 'transparent', 'opaque'] }, defaultValue: { type: 'string', value: 'auto' } },
          { type: 'value', data: { type: 'string', value: 'auto' } },
        ],
        [
          { id: 'image_size', title: 'Aspect Ratio', constraint: { type: 'image_size', options: ['Default', 'square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9', 'auto'] }, defaultValue: { type: 'image_size', value: { type: 'built_in', value: imageSize } } },
          { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: imageSize } } },
        ],
        [
          { id: 'output_format', title: 'Output Format', constraint: { type: 'enum', options: ['png', 'jpeg', 'webp'] }, defaultValue: { type: 'string', value: 'png' } },
          { type: 'value', data: { type: 'string', value: 'png' } },
        ],
      ];
      paramsObj = {
        ...paramsObj,
        model: 'Flare',
        prompt: prompt.trim(),
        quality: 'high',
        background: 'auto',
        image_size: imageSize,
        output_format: 'png',
      };
    } else if (isSeedream) {
      targetModelName = 'fal-ai/bytedance/seedream/v5/lite/edit';
      targetDisplayName = 'Seedream V5.0 Pro Edit';
      targetDescription = 'Edit images with Seedream V5.0 Pro';
      targetMenuDisplayName = 'Seedream V5.0 Pro Edit';
      modelCredits = 6;
      outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
      parametersList = [
        [
          { id: 'model', title: 'Model', constraint: { type: 'enum', options: ['V4.0', 'V4.5', 'V5.0', 'V5.0 Pro'] }, defaultValue: { type: 'string', value: 'V5.0 Pro' } },
          { type: 'value', data: { type: 'string', value: 'V5.0 Pro' } },
        ],
        [
          { id: 'seed', title: 'Seed', constraint: { type: 'seed' }, defaultValue: { type: 'seed', value: { seed: 1, isRandom: false } } },
          { type: 'value', data: { type: 'seed', value: { seed: randomSeed, isRandom: true } } },
        ],
        [
          { id: 'image_size', title: 'Image Size', constraint: { type: 'image_size', options: ['Default', 'square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9', 'auto_2K', 'auto_3K'] }, defaultValue: { type: 'image_size', value: { type: 'built_in', value: imageSize } } },
          { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: imageSize } } },
        ],
        [
          { id: 'enhance_prompt_mode', title: 'Enhance Prompt Mode', constraint: { type: 'enum', options: ['standard', 'fast'] }, defaultValue: { type: 'string', value: 'standard' } },
          { type: 'value', data: { type: 'string', value: 'standard' } },
        ],
      ];
      paramsObj = {
        ...paramsObj,
        model: 'V5.0 Pro',
        prompt: prompt.trim(),
        seed: randomSeed,
        image_size: imageSize,
        enhance_prompt_mode: 'standard',
      };
    } else if (isNanoBanana) {
      targetModelName = 'fal-ai/nano-banana-pro/edit';
      targetDisplayName = 'Nano Banana Pro';
      targetDescription = 'Edit images with Nano Banana Pro';
      targetMenuDisplayName = 'Nano Banana Pro';
      modelCredits = 7;
      const cleanRes = (resolution === '2K' || resolution === '4K') ? resolution : '1K';
      outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
      parametersList = [
        [
          { id: 'seed', title: 'Seed', constraint: { type: 'seed' }, defaultValue: { type: 'seed', value: { seed: 1, isRandom: false } } },
          { type: 'value', data: { type: 'seed', value: { seed: randomSeed, isRandom: true } } },
        ],
        [
          { id: 'resolution', title: 'Resolution', constraint: { type: 'enum', options: ['1K', '2K', '4K'] }, defaultValue: { type: 'string', value: '1K' } },
          { type: 'value', data: { type: 'string', value: cleanRes } },
        ],
        [
          { id: 'aspect_ratio', title: 'Aspect Ratio', constraint: { type: 'enum', options: ['auto', '1:1', '21:9', '16:9', '3:2', '4:3', '5:4', '4:5', '3:4', '2:3', '9:16'] }, defaultValue: { type: 'string', value: 'auto' } },
          { type: 'value', data: { type: 'string', value: aspectRatio || '9:16' } },
        ],
        [
          { id: 'enable_web_search', title: 'Enable Web Search', constraint: { type: 'boolean' }, defaultValue: { type: 'boolean', value: false } },
          { type: 'value', data: { type: 'boolean', value: false } },
        ],
      ];
      paramsObj = {
        ...paramsObj,
        prompt: prompt.trim(),
        seed: randomSeed,
        num_images: 1,
        resolution: cleanRes,
        aspect_ratio: aspectRatio || '9:16',
        output_format: 'png',
        enable_web_search: false,
      };
    } else if (isGptEdit) {
      targetModelName = 'gpt_image_1_edit';
      targetDisplayName = 'ChatGPT Images 2.0 Edit';
      targetDescription = "Edit images with OpenAI's GPT Image 2";
      targetMenuDisplayName = 'GPT Image 1';
      modelCredits = 9;
      nodeHandles = {
        input: {
          prompt: { id: `470e45b3-3c3a-46f1-822e-715abc4610ab`, type: 'text', label: 'prompt', order: 0, format: 'text', required: true, description: 'Prompt for image edit' },
          ...nodeHandles.input,
        },
        output: {
          image: { id: `470e45b3-3c3a-46f1-822e-715abc4610at`, type: 'image', label: 'image', order: 0, format: 'uri', description: 'Result image' },
        },
      };
      outputSchema = [{ id: 'image', title: 'image', description: 'Result image', dataType: 'image' }];
      nodeSchema = {
        size: {
          type: 'fal_image_size',
          order: 9,
          title: 'Resolution',
          default: 'auto',
          options: ['Custom', 'auto', '1024x1024', '1536x1024', '1024x1536', '2048x2048', '2048x1152', '3840x2160', '2160x3840'],
          description: "The size of the generated images.",
        },
        model: {
          type: 'enum',
          order: 0,
          title: 'Model',
          default: 'GPT Image 2',
          options: ['GPT Image 1', 'GPT Image 1.5', 'GPT Image 2'],
          description: 'GPT model type',
        },
        quality: {
          type: 'enum',
          order: 7,
          title: 'Quality',
          default: 'medium',
          options: ['auto', 'high', 'medium', 'low'],
          description: "The quality of the image.",
        },
      };
      parametersList = [
        [
          { id: 'model', title: 'Model', description: 'GPT model type', constraint: { type: 'enum', options: ['GPT Image 1', 'GPT Image 1.5', 'GPT Image 2'] }, defaultValue: { type: 'string', value: 'GPT Image 2' } },
          { type: 'value', data: { type: 'string', value: 'GPT Image 2' } },
        ],
        [
          { id: 'quality', title: 'Quality', description: "The quality of the image.", constraint: { type: 'enum', options: ['auto', 'high', 'medium', 'low'] }, defaultValue: { type: 'string', value: 'medium' } },
          { type: 'value', data: { type: 'string', value: 'medium' } },
        ],
        [
          { id: 'size', title: 'Resolution', description: "The size of the generated images.", constraint: { type: 'image_size', options: ['Custom', 'auto', '1024x1024', '1536x1024', '1024x1536', '2048x2048', '2048x1152', '3840x2160', '2160x3840'] }, defaultValue: { type: 'image_size', value: { type: 'built_in', value: 'auto' } } },
          { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: 'auto' } } },
        ],
      ];
      paramsObj = {
        ...paramsObj,
        size: 'auto',
        model: 'GPT Image 2',
        quality: 'medium',
        number_of_images: 1,
        prompt: prompt.trim(),
      };
    } else if (isGpt2) {
      targetModelName = 'gpt_image_2';
      targetDisplayName = 'ChatGPT Images 2.0';
      targetDescription = "Generate images with OpenAI's GPT Image 2";
      targetMenuDisplayName = 'GPT Image 2';
      modelCredits = 8;
      nodeHandles = {
        input: {
          prompt: { type: 'text', order: 0, required: true },
          ...nodeHandles.input,
        },
        output: { image: { type: 'image', order: 0 } },
      };
      outputSchema = [{ id: 'image', title: 'Image', description: 'The generated image.', dataType: 'image' }];
      parametersList = [
        [
          { id: 'quality', title: 'Quality', constraint: { type: 'enum', options: ['auto', 'high', 'medium', 'low'] }, defaultValue: { type: 'string', value: 'high' } },
          { type: 'value', data: { type: 'string', value: 'high' } },
        ],
        [
          { id: 'aspect_ratio', title: 'Aspect Ratio', constraint: { type: 'enum', options: ['1:1', '9:16', '16:9', '4:3', '3:4'] }, defaultValue: { type: 'string', value: aspectRatio || '9:16' } },
          { type: 'value', data: { type: 'string', value: aspectRatio || '9:16' } },
        ],
      ];
      paramsObj = {
        ...paramsObj,
        prompt: prompt.trim(),
        quality: 'high',
        aspect_ratio: aspectRatio || '9:16',
      };
    } else if (isGrok) {
      targetModelName = 'xai/grok-imagine-image';
      targetDisplayName = 'Grok Imagine Image';
      targetDescription = 'Generates images with Grok Imagine Image';
      targetMenuDisplayName = 'Grok Imagine Image';
      modelCredits = 8;
      outputSchema = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
      parametersList = [
        [
          { id: 'seed', title: 'Seed', constraint: { type: 'integer' }, defaultValue: { type: 'integer', value: 0 } },
          { type: 'value', data: { type: 'integer', value: randomSeed } },
        ],
        [
          { id: 'aspect_ratio', title: 'Aspect Ratio', constraint: { type: 'enum', options: ['1:1', '9:16', '16:9', '4:3', '3:4'] }, defaultValue: { type: 'string', value: aspectRatio || '9:16' } },
          { type: 'value', data: { type: 'string', value: aspectRatio || '9:16' } },
        ],
      ];
      paramsObj = {
        ...paramsObj,
        prompt: prompt.trim(),
        seed: randomSeed,
        aspect_ratio: aspectRatio || '9:16',
      };
    }

    const isFalImported = isSeedream || isNanoBanana || isGrok;

    const modelNode = {
      id: modelNodeId,
      type: 'custommodelV2',
      isModel: true,
      dragHandle: '.node-header',
      position: { x: 650, y: 200 },
      data: {
        name: targetDisplayName,
        description: targetDescription,
        ...(isGptEdit ? { color: 'Red' } : {}),
        menu: { icon: 'EmojiObjectsIcon', isModel: true, displayName: targetMenuDisplayName },
        model: {
          name: targetModelName,
          ...(isFalImported ? { service: 'fal_imported', version: targetModelName } : {}),
        },
        ...(Object.keys(nodeSchema).length > 0 ? { schema: nodeSchema } : {}),
        kind: {
          type: 'wildcard',
          model: {
            type: 'predefined',
            name: targetModelName,
            description: targetDescription,
            ...(isFalImported ? { service: 'fal_imported', version: targetModelName } : {}),
          },
          inputs: inputsList,
          parameters: parametersList,
          outputs: outputSchema,
        },
        params: paramsObj,
        input: inputObj,
        handles: nodeHandles,
        version: 3,
      },
    };

    const nodes = [promptNode, modelNode, ...refNodes];
    const edges = [
      {
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
      },
      ...refEdges,
    ];

    const executePayload = {
      numberOfRuns: 1,
      nodes,
      edges,
      displayedCost: {
        credits: modelCredits,
        perSecondRate: 0,
        surface: 'drawer',
      },
    };

    let execHeaders = getWeavyClientHeaders(idToken, acc?.userId || acc?.id, recipeId);

    await callWeavyApi(`/api/v1/recipes/${recipeId}/save`, {
      method: 'POST',
      headers: execHeaders,
      body: JSON.stringify({ nodes, edges, files: readyAssets, v3: true, lastUpdatedAt: new Date().toISOString() }),
    }).catch(() => {});

    if (onProgress) onProgress(10, 'Mengirim perintah rendering ke Weavy AI...');

    let execRes = await callWeavyApi(`/api/v1/batches/recipes/${recipeId}/execute`, {
      method: 'POST',
      headers: execHeaders,
      body: JSON.stringify(executePayload),
    });

    if (execRes.status === 403) {
      try {
        await approveWeavyModel(targetModelName, idToken, acc?.userId || acc?.id, recipeId, onProgress);
        execRes = await callWeavyApi(`/api/v1/batches/recipes/${recipeId}/execute`, {
          method: 'POST',
          headers: execHeaders,
          body: JSON.stringify(executePayload),
        });
      } catch (approvalError) {
        console.warn('[Weavy Model Approval Warning]:', approvalError);
      }
    }

    if (execRes.status === 401 || execRes.status === 403) {
      if (onProgress) onProgress(15, 'Terjadi error 403. Mereload tab Weavy & menyinkronkan token...');
      showAuthAlert('Terjadi error 403 di Weavy. Mereload tab Weavy & menyinkronkan token akun...', 'info');

      const freshToken = await recoverWeavySessionOn403Helper({
        account: acc,
        accounts,
        syncSingleAccountFn: syncSingleAccount,
        exchangeRefreshTokenFn: exchangeRefreshToken,
        saveAccountsFn: saveAccounts,
        onStatusUpdate: (msg) => {
          if (onProgress) onProgress(18, msg);
          showAuthAlert(msg, 'info');
        },
      });

      const storageKey = `weavy_canvas_image_${acc?.userId || 'default'}`;
      await storage.set(storageKey, null);

      const activeToken = freshToken || (await getValidIdToken(acc));
      if (activeToken) {
        idToken = activeToken;
        const freshRecipeId = await getOrCreateWeavyRecipeId(activeToken, acc?.userId || acc?.id, 'image');
        if (freshRecipeId) {
          recipeId = freshRecipeId;
        }
        execHeaders = getWeavyClientHeaders(activeToken, acc?.userId || acc?.id, recipeId);

        await callWeavyApi(`/api/v1/recipes/${recipeId}/save`, {
          method: 'POST',
          headers: execHeaders,
          body: JSON.stringify({ nodes, edges, files: readyAssets, v3: true, lastUpdatedAt: new Date().toISOString() }),
        }).catch(() => {});

        execRes = await callWeavyApi(`/api/v1/batches/recipes/${recipeId}/execute`, {
          method: 'POST',
          headers: execHeaders,
          body: JSON.stringify(executePayload),
        });
      }
    }

    if (!execRes.ok) {
      const errText = await execRes.text().catch(() => '');
      if (execRes.status === 403) {
        throw new Error(`Akses ditolak (HTTP 403). Sesi atau izin canvas akun Weavy perlu disegarkan. Saldo koin: ${acc.credits ?? 0} Koin. Silakan klik tombol Refresh Saldo.`);
      }
      throw new Error(`Gagal mengirim permintaan generasi gambar (HTTP ${execRes.status}): ${errText.slice(0, 100)}`);
    }

    const execData = await execRes.json();
    const batchId = execData.batchId || execData.id;

    const inputUrls = readyAssets.flatMap((a) => [a.url, a.downloadUrl, a.thumbnailUrl].filter(Boolean));
    const refNodeIds = new Set(refNodes.map((n) => n.id));
    let resultUrl = null;

    // Poll status up to 180 times (~6m)
    let completedRetriesWithoutUrl = 0;
    for (let poll = 0; poll < 180; poll++) {
      await new Promise((r) => setTimeout(r, 2000));
      
      let pct = 20;
      if (poll < 15) {
        pct = 20 + Math.round(poll * 2.5); // 20% -> 57%
      } else if (poll < 45) {
        pct = 58 + Math.round((poll - 15) * 0.8); // 58% -> 82%
      } else if (poll < 90) {
        pct = 82 + Math.round((poll - 45) * 0.25); // 82% -> 93%
      } else {
        pct = Math.min(97, 93 + Math.round((poll - 90) * 0.05));
      }

      if (onProgress) onProgress(pct, `Memproses rendering`);

      const stRes = await callWeavyApi(`/api/v1/batches/recipes/${recipeId}/batches/${batchId}/status`, {
        headers: execHeaders,
      });

      if (stRes.ok) {
        const stData = await stRes.json();
        const run = stData.recipeRuns?.[0] || stData.recipeRun;
        const currentStatus = (run?.status || stData.status || '').toUpperCase();
        const completedStatuses = new Set(['COMPLETED', 'SUCCESS', 'SUCCEEDED', 'FINISHED', 'DONE']);
        const failedStatuses = new Set(['FAILED', 'ERROR', 'CANCELLED', 'CANCELED', 'FAIL']);

        if (completedStatuses.has(currentStatus)) {
          const nodeRuns = Array.isArray(run?.nodeRuns) ? run.nodeRuns : [];

          const topLevelCandidates = [
            run?.result, run?.output, run?.resultUrl, run?.outputUrl, run?.url,
            stData.result, stData.output, stData.resultUrl, stData.outputUrl, stData.url,
            ...(Array.isArray(run?.outputs) ? run.outputs : []),
            ...(Array.isArray(stData.outputs) ? stData.outputs : []),
          ];

          for (const candidate of topLevelCandidates) {
            const url = extractMediaUrlFromObject(candidate, inputUrls);
            if (url) {
              resultUrl = url;
              break;
            }
          }

          // 1. Model node
          if (!resultUrl) {
            const modelRun = nodeRuns.find((nr) => nr.nodeId === modelNodeId) ||
                             nodeRuns.find((nr) => nr.nodeType === 'custommodelV2' || (nr.isModel && nr.nodeType !== 'import')) ||
                             nodeRuns.find((nr) => !refNodeIds.has(nr.nodeId) && nr.nodeType !== 'import' && nr.nodeType !== 'promptV3');

            if (modelRun) {
              const resObj = modelRun.result || modelRun.output;
              if (resObj) {
                const url = extractMediaUrlFromObject(resObj, inputUrls);
                if (url) resultUrl = url;
              }
            }
          }

          // 2. Check other node runs
          if (!resultUrl) {
            for (const nr of nodeRuns) {
              if (refNodeIds.has(nr.nodeId) || nr.nodeType === 'import' || nr.nodeType === 'promptV3' || nr.name?.includes('Reference Image') || nr.name?.startsWith('File')) {
                continue;
              }
              const resObj = nr.result || nr.output;
              if (resObj) {
                const url = extractMediaUrlFromObject(resObj, inputUrls);
                if (url) {
                  resultUrl = url;
                  break;
                }
              }
            }
          }

          // 3. Fallback top level
          if (!resultUrl) {
            const topUrl = extractMediaUrlFromObject(run || stData, inputUrls);
            if (topUrl) resultUrl = topUrl;
          }

          if (resultUrl) {
            break;
          } else {
            completedRetriesWithoutUrl += 1;
            if (completedRetriesWithoutUrl > 5) {
              break;
            }
          }
        }

        if (failedStatuses.has(currentStatus)) {
          const errMsg = run?.error?.message || run?.error || stData.error || run?.errorMessage || 'Rendering gambar gagal.';
          throw new Error(typeof errMsg === 'object' ? JSON.stringify(errMsg) : String(errMsg));
        }
      }
    }

    if (!resultUrl) {
      throw new Error('Gambar tidak berhasil didapatkan setelah waktu tunggu.');
    }

    return resultUrl;
  }

  // --- DIRECT GENERATE IMAGE TAB HANDLER ---
  async function handleDirectGenerateImage() {
    const prompt = (genPromptInput.value || '').trim();
    if (!prompt) {
      showAuthAlert('Silakan masukkan deskripsi prompt gambar terlebih dahulu.', 'error');
      genPromptInput.focus();
      return;
    }

    const acc = getActiveAccount();
    const visibleProvider = document.getElementById('subbarProviderName')?.textContent?.trim().toLowerCase();
    const isFlowGeneration = activeProvider === 'flow' || visibleProvider === 'flow';
    const isDolaGeneration = activeProvider === 'dola' || visibleProvider === 'dola';
    if (!acc && !isFlowGeneration && !isDolaGeneration) {
      showAuthAlert(`Silakan hubungkan akun ${activeProvider === 'flow' ? 'Google Flow' : (activeProvider === 'dola' ? 'Dola AI' : 'Weavy')} terlebih dahulu di tab Akun & Token.`, 'error');
      switchTab('settings');
      return;
    }

    const submittedGenerationMode = currentGenMode;
    const selectedCatalogModel = submittedGenerationMode === 'video' ? selectedVideoModel : selectedImageModel;
    const model = genModelSelect.value || selectedCatalogModel?.value || selectedCatalogModel?.id || '';
    const modelLabel = isFlowGeneration || isDolaGeneration
      ? (selectedCatalogModel?.name || model)
      : (genModelSelect.options[genModelSelect.selectedIndex]?.text || model);

    // Check if any reference image is still uploading
    const uploadingCount = currentGenRefImages.filter((img) => img.isUploading).length;
    if (uploadingCount > 0) {
      showAuthAlert(`Mohon tunggu sebentar, foto referensi sedang diproses di ${isFlowGeneration ? 'Google Flow' : (isDolaGeneration ? 'Dola AI' : 'Weavy AI')}...`, 'info');
      return;
    }

    if (isFlowGeneration && flowReferenceUploadPromise) {
      showAuthAlert('Menunggu upload reference Flow selesai sebelum generate...', 'info');
      await flowReferenceUploadPromise;
    }

    const readyAssets = currentGenRefImages
      .map((img) => {
        if (!img?.asset) return null;
        const asset = img.asset;
        const source = asset.dataUrl || asset.base64 || asset.url || asset.downloadUrl || asset.thumbnailUrl;
        return source
          ? { ...asset, role: img.referenceRole || asset.role || 'custom' }
          : null;
      })
      .filter(Boolean);

    if (isFlowGeneration && currentGenRefImages.length > 0 && readyAssets.length !== currentGenRefImages.length) {
      showAuthAlert('Tunggu sampai semua gambar referensi Flow selesai diproses.', 'info');
      return;
    }

    // Check if selected model strictly requires a reference image (e.g. OpenAI GPT Image 1 Edit)
    const isStrictEditModel = model === 'gpt_image_1_edit';
    if (isStrictEditModel && readyAssets.length === 0) {
      showAuthAlert(`⚠️ Model "${modelLabel}" adalah model Image Edit yang membutuhkan setidaknya 1 Foto Referensi.`, 'error');
      return;
    }

    const submittedPrompt = prompt;
    const submittedModel = model;
    const submittedModelLabel = modelLabel;
    const aspectRatio = genAspectSelect.value || '9:16';
    const resolution = genResolutionSelect.value || '1080p';

    // 1. Immediately create in-grid processing card in Recent Generations
    const generatingTask = {
      id: 'gen_active_' + Date.now(),
      prompt: submittedPrompt,
      model: submittedModel,
      modelLabel: submittedModelLabel,
      aspectRatio: aspectRatio,
      resolution: resolution,
      type: submittedGenerationMode || 'image',
      status: 'queued',
      pct: 5,
      statusText: activeProvider === 'flow' 
        ? 'Queued: menunggu Google Flow...' 
        : activeProvider === 'dola' 
          ? 'Queued: menunggu Dola AI (ByteDance)...' 
          : 'Queued: menunggu Weavy AI...',
      startedAt: Date.now(),
    };
    activeGeneratingTasks.push(generatingTask);
    await persistActiveGeneratingTasks();
    renderRecentGenerations();

    // 2. Clear prompt textarea & reference images from the Prompt Card
    genPromptInput.value = '';
    genPromptInput.style.height = 'auto';
    currentGenRefImages = [];
    renderGenRefGallery();
    const genFileInputEl = document.getElementById('genRefFileInput');
    if (genFileInputEl) genFileInputEl.value = '';

    // Beberapa task boleh berjalan bersamaan; masing-masing punya kartu dan task ID sendiri.
    showAuthAlert(`Tugas generate dikirim! Sedang diproses di Recent Generations.`, 'info');

    try {
      const onProgress = (pct, st) => {
        if (generatingTask) {
          generatingTask.status = 'generating';
          generatingTask.pct = pct;
          generatingTask.statusText = st;
          void persistActiveGeneratingTasks();
          renderRecentGenerations();
        }
      };

      let resultUrl;
      let resultChatId = null;
      if (isFlowGeneration) {
        const executeFlowGeneration = submittedGenerationMode === 'video'
          ? executeFlowVideoGeneration
          : executeFlowImageGeneration;
        const res = await executeFlowGeneration({
          prompt: submittedPrompt,
          model: selectedCatalogModel,
          aspectRatio,
          resolution,
          videoType: currentVideoType,
          videoDuration: currentVideoDuration,
          referenceAssets: readyAssets,
          onProgress,
        });
        if (typeof res === 'object' && res !== null) {
          resultUrl = res.url || res.downloadUrl;
          resultChatId = res.chatId || res.conversationId || res.convId || null;
        } else {
          resultUrl = res;
        }
      } else if (isDolaGeneration) {
        const executeDolaGeneration = submittedGenerationMode === 'video'
          ? executeDolaVideoGeneration
          : executeDolaImageGeneration;
        const res = await executeDolaGeneration({
          prompt: submittedPrompt,
          model: selectedCatalogModel,
          aspectRatio,
          resolution,
          videoType: currentVideoType,
          videoDuration: currentVideoDuration,
          referenceAssets: readyAssets,
          account: acc,
          onProgress,
        });
        if (typeof res === 'object' && res !== null) {
          resultUrl = res.url || res.downloadUrl;
          resultChatId = res.chatId || res.conversationId || res.convId || null;
        } else {
          resultUrl = res;
        }
      } else {
        const idToken = await getValidIdToken(acc);
        const res = await executeWeavyImageCanvas({
          prompt: submittedPrompt,
          model: submittedModel,
          aspectRatio,
          resolution,
          readyAssets,
          idToken,
          acc,
          onProgress,
        });
        if (typeof res === 'object' && res !== null) {
          resultUrl = res.url || res.downloadUrl;
          resultChatId = res.chatId || res.conversationId || res.convId || null;
        } else {
          resultUrl = res;
        }
      }

      // Save to Recent Generations History dengan Chat ID yang presisi
      await saveRecentGeneration({
        sourceTaskId: generatingTask.id,
        chatId: resultChatId || null,
        accountId: acc?.id || null,
        provider: activeProvider,
        prompt: submittedPrompt,
        url: resultUrl,
        type: submittedGenerationMode || 'image',
        model: submittedModel,
        modelLabel: submittedModelLabel,
        aspectRatio: aspectRatio,
        resolution: resolution,
        referenceAssets: readyAssets,
      });

      activeGeneratingTasks = activeGeneratingTasks.filter((task) => task.id !== generatingTask.id);
      await persistActiveGeneratingTasks();
      renderRecentGenerations();
      showAuthAlert(`🎉 ${submittedGenerationMode === 'video' ? 'Video' : 'Gambar'} AI berhasil dibuat & tersimpan di Recent Generations!`, 'success');
      refreshCredits();
    } catch (err) {
      console.error('[Direct Generate Error]:', err);
      generatingTask.status = 'failed';
      generatingTask.pct = 0;
      generatingTask.statusText = `Failed: ${err.message}`;
      await persistActiveGeneratingTasks();
      renderRecentGenerations();
      showAuthAlert(`⚠️ Gagal menghasilkan gambar: ${err.message}`, 'error');
    } finally {
      btnSubmitGenerate.disabled = false;
    }
  }

  // extracted to js/core/response-parsers.js

  async function pollTaskStatus(taskId, idToken) {
    let attempts = 0;
    const maxAttempts = 60;
    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2500));
      attempts++;

      try {
        const activeAcc = getActiveAccount();
        const headers = getWeavyClientHeaders(idToken, activeAcc?.userId, null, activeAcc);
        const resp = await callWeavyApi(`/api/v1/tasks/${taskId}`, {
          headers,
        });
        if (resp.ok) {
          const st = await resp.json();
          const imgUrl = st.resultUrl || st.outputUrl || st.url || (st.outputs && st.outputs[0]?.url);
          if (imgUrl) return imgUrl;
          if (st.status === 'failed' || st.status === 'error') {
            throw new Error(st.errorMessage || 'Tugas gagal dirender di Weavy.');
          }
        }
      } catch (e) {
        if (e.message && e.message.includes('gagal')) throw e;
      }
    }
    throw new Error('Waktu tunggu proses render Weavy habis (Timeout).');
  }

  // --- ATTACHMENTS HANDLING ---
  function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const isVid = file.type.startsWith('video/') || /\.(mp4|mov|webm|avi|mkv)$/i.test(file.name);
        currentAttachments.push({
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          type: isVid ? 'video' : (file.type.startsWith('image/') ? 'image' : 'file'),
          url: ev.target.result,
          base64: ev.target.result,
        });
        renderAttachmentTray();
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  function renderAttachmentTray() {
    if (currentAttachments.length === 0) {
      attachmentPreviewTray.classList.add('hidden');
      attachmentPreviewTray.innerHTML = '';
      if (typeof updateTaggedMediaPreviewBar === 'function') {
        updateTaggedMediaPreviewBar();
      }
      return;
    }

    try {
      const session = getCurrentSession();
      buildSessionMediaCatalog(session, currentAttachments);
    } catch (_) {}

    attachmentPreviewTray.classList.remove('hidden');
    attachmentPreviewTray.innerHTML = currentAttachments
      .map(
        (att, idx) => `
      <div class="tray-item" title="${escapeHtml(att.name)}">
        ${att.type === 'video' ? `
          <div style="width:40px; height:40px; display:flex; align-items:center; justify-content:center; background:var(--accent-primary, #e8a23d); border-radius:4px; color:#131110;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          </div>
        ` : `<img src="${att.url || att.base64}" alt="${escapeHtml(att.name)}">`}
        ${att.tagKey ? `<span class="tray-tag-badge">${escapeHtml(att.tagKey)}</span>` : ''}
        <button class="tray-remove-btn" data-idx="${idx}">&times;</button>
      </div>
    `
      )
      .join('');

    attachmentPreviewTray.querySelectorAll('.tray-remove-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
        currentAttachments.splice(idx, 1);
        renderAttachmentTray();
      });
    });

    if (typeof updateTaggedMediaPreviewBar === 'function') {
      updateTaggedMediaPreviewBar();
    }
  }

  // --- TAB SWITCHER ---
  function switchTab(tabId) {
    closeHeaderAccountDropdown();
    activeTab = tabId;
    navTabs.forEach((t) => {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
    });
    tabPanes.forEach((p) => {
      p.classList.toggle('active', p.id === `tab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
    });
    if (tabId === 'chat') {
      setTimeout(updateScrollToBottomVisibility, 60);
    }
  }

  // --- EVENT LISTENERS ---
  function initEvents() {
    // Sidebar Logo: Klik icon Weavy untuk langsung membuka https://app.weavy.ai/ di tab baru
    const sidebarLogo = document.querySelector('.sidebar-logo');
    const WEAVY_APP_URL = 'https://app.weavy.ai/';
    function openWeavyAppTab(e) {
      if (typeof chrome !== 'undefined' && chrome?.tabs?.create) {
        if (e) e.preventDefault();
        chrome.tabs.create({ url: WEAVY_APP_URL });
      }
      // Di web preview browser / iframe: jangan preventDefault agar tautan native <a target="_blank"> langsung terbuka tanpa dicegat popup-blocker
    }

    if (sidebarLogo) {
      sidebarLogo.href = WEAVY_APP_URL;
      sidebarLogo.target = '_blank';
      sidebarLogo.rel = 'noopener noreferrer';
      sidebarLogo.title = 'Buka Weavy AI (https://app.weavy.ai/)';
      sidebarLogo.addEventListener('click', openWeavyAppTab);
      const logoIcon = sidebarLogo.querySelector('.logo-icon');
      if (logoIcon) {
        logoIcon.style.cursor = 'pointer';
      }
    }

    // Eye Icon: Klik untuk membuka Live Web Preview AI Studio di tab baru
    const btnOpenLiveWebPreview = document.getElementById('btnOpenLiveWebPreview');
    const FALLBACK_PREVIEW_URL = 'https://ais-dev-me6o5g57qhusszacauuxhp-937002040529.asia-east1.run.app';
    
    function openLivePreviewTab(e) {
      if (e) e.preventDefault();
      const targetUrl = (typeof window !== 'undefined' && window.location.origin.startsWith('http'))
        ? window.location.origin
        : FALLBACK_PREVIEW_URL;
      try {
        if (typeof chrome !== 'undefined' && chrome?.tabs?.create) {
          chrome.tabs.create({ url: targetUrl });
        } else {
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
      } catch (_) {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
    }

    if (btnOpenLiveWebPreview) {
      btnOpenLiveWebPreview.addEventListener('click', openLivePreviewTab);
    }

    // Nav Tabs
    navTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        switchTab(tab.getAttribute('data-tab'));
      });
    });

    // Account pill click -> Toggle quick switch dropdown
    activeAccountPill?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHeaderAccountDropdown();
    });

    // Header Account Dropdown Provider Tabs
    const headerTabWeavy = document.getElementById('headerTabWeavy');
    const headerTabFlow = document.getElementById('headerTabFlow');
    const headerTabDola = document.getElementById('headerTabDola');
    const headerTabGemini = document.getElementById('headerTabGemini');

    [headerTabWeavy, headerTabFlow, headerTabDola, headerTabGemini].forEach((tab) => {
      tab?.addEventListener('click', (e) => {
        e.stopPropagation();
        const prov = tab.getAttribute('data-provider');
        if (prov) {
          dropdownProvider = prov;
          renderHeaderAccountDropdown();
        }
      });
    });

    // Header Account Dropdown Actions
    document.getElementById('btnHeaderDropdownRefresh')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      closeHeaderAccountDropdown();
      await refreshCredits();
    });

    document.getElementById('btnHeaderDropdownAddAccount')?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeHeaderAccountDropdown();
      switchTab('settings');
      setTimeout(() => {
        const inputRefresh = document.getElementById('inputRefreshToken');
        if (inputRefresh) {
          inputRefresh.scrollIntoView({ behavior: 'smooth', block: 'center' });
          inputRefresh.focus();
        }
      }, 150);
    });

    document.getElementById('btnHeaderDropdownManage')?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeHeaderAccountDropdown();
      switchTab('settings');
    });

    // Refresh credits button
    btnRefreshCredits?.addEventListener('click', refreshCredits);

    // Theme toggle
    btnToggleTheme?.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-theme');
      document.body.classList.toggle('light-theme', !isDark);
      storage.set('weavy_theme', isDark ? 'dark' : 'light');
    });

    // Full Screen / Full Tab Toggle
    btnFullScreen?.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
      } else {
        window.open(window.location.href, '_blank');
      }
    });

    // Download Extension ZIP handler
    const btnDownloadExtensionZip = document.getElementById('btnDownloadExtensionZip');
    btnDownloadExtensionZip?.addEventListener('click', async (e) => {
      e.preventDefault();
      showAuthAlert('Sedang menyiapkan file zip ekstensi (~227 KB)...', 'info');
      try {
        const response = await fetch(`/download-extension?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        const blob = await response.blob();
        if (blob.size < 5000) {
          throw new Error('Ukuran file zip tidak lengkap.');
        }
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = 'ektension-weavy.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 3000);
        showAuthAlert('Ekstensi ektension-weavy.zip berhasil diunduh! Silakan ekstrak file ZIP.', 'success');
      } catch (err) {
        console.warn('[Download Extension Fallback]:', err);
        showAuthAlert('Mengunduh langsung dari server...', 'info');
        window.location.href = `/download-extension?t=${Date.now()}`;
      }
    });

    // Lightbox modal close listeners
    document.getElementById('lightboxCloseBtn')?.addEventListener('click', closeMediaLightbox);
    document.querySelector('.lightbox-backdrop')?.addEventListener('click', closeMediaLightbox);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMediaLightbox();
        closeHeaderAccountDropdown();
      }
    });

    // Preset Dropdown & Popover
    const btnPresetDropdown = document.getElementById('btnPresetDropdown');
    const presetMenuPopover = document.getElementById('presetMenuPopover');
    const presetOptionBtns = document.querySelectorAll('.preset-option-btn');

    btnPresetDropdown?.addEventListener('click', (e) => {
      e.stopPropagation();
      const chatProviderPopover = document.getElementById('chatProviderPopover');
      if (chatProviderPopover && !chatProviderPopover.classList.contains('hidden')) {
        chatProviderPopover.classList.add('hidden');
      }
      presetMenuPopover?.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (presetMenuPopover && !presetMenuPopover.contains(e.target) && e.target !== btnPresetDropdown) {
        presetMenuPopover.classList.add('hidden');
      }
      if (slashPresetAutocomplete && !slashPresetAutocomplete.contains(e.target) && e.target !== chatInputText) {
        hideSlashPresetPopup();
      }
      if (mediaMentionAutocomplete && !mediaMentionAutocomplete.contains(e.target) && e.target !== chatInputText) {
        hideMediaMentionPopup();
      }
      if (chatSessionHistoryPopover && !chatSessionHistoryPopover.contains(e.target) && e.target !== btnSessionHistory) {
        closeChatSessionHistory();
      }
      const headerDropdown = document.getElementById('headerAccountDropdown');
      if (headerDropdown && !headerDropdown.classList.contains('hidden')) {
        const wrapper = document.querySelector('.header-account-dropdown-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
          closeHeaderAccountDropdown();
        }
      }
    });

    // --- QUICK SLASH PRESETS AUTOCOMPLETE POPUP ---
    const slashPresetAutocomplete = document.getElementById('slashPresetAutocomplete');
    const slashPresetList = document.getElementById('slashPresetList');

    const CHAT_SLASH_PRESETS = [
      {
        slash: '/customstoryboard',
        name: 'Custom Storyboard (Pure Brief)',
        badge: 'CUSTOM',
        desc: 'Susun JSON Storyboard murni dari brief Anda tanpa suntikan formula AI',
        icon: '📝',
        isDownload: false,
      },
      {
        slash: '/copilotstoryboard',
        name: 'Storyboard Copilot (Main Brief)',
        badge: 'COPILOT',
        desc: 'Analisis media/link & ikuti Main Brief untuk hasilkan Storyboard Card siap kirim',
        icon: '🎬',
        isDownload: false,
      },
      {
        slash: '/kebunimpian',
        name: 'Kebun Impian Lahan Sempit (Max 60s)',
        badge: 'KEBUN',
        desc: 'Tour kebun lahan sempit (Tangan wanita, latar lokal bersahaja, semi-ASMR, ~10s/scene, max 3 shoot)',
        icon: '🏡',
        isDownload: false,
      },
      {
        slash: '/homeharvest',
        name: 'Home Harvest Sayur Dapur (29s)',
        badge: 'PANEN',
        desc: 'Panen sayur pekarangan 29s (3 Scene 9 Shoot): Hook lebat, petik, piano vibe & caption rapi',
        icon: '🍆',
        isDownload: false,
      },
      {
        slash: '/plantreview',
        name: 'Plant Review & Oddity (TikTok)',
        badge: 'REVIEW',
        desc: 'Review bibit/buah unik viral: Hook visual oddity, VO, tabulampot, JSON & caption rapi',
        icon: '🍇',
        isDownload: false,
      },
      {
        slash: '/buahunggul',
        name: 'Universal Produk, Bibit, Sayur & Pupuk (30s)',
        badge: 'UNGGUL',
        desc: 'Universal 30s (3 Scene @ 10s, Max 3 Shot): Bisa untuk Buah, Sayur, Bibit, Pupuk & Produk Lainnya + Instruksi VO & Video Realistis',
        icon: '🌳',
        isDownload: false,
      },
      {
        slash: '/onthespot',
        name: 'On The Spot: Bibit, Buah & Benih (30s)',
        badge: 'INVESTIGASI',
        desc: 'Gaya investigasi On The Spot (3 Fakta @ 10s Veo/Flow): Narator TV berwibawa, macro 4K, bedah rasa/akar, verifikasi bibit asli & CTA keranjang kuning',
        icon: '🔥',
        isDownload: false,
      },
      {
        slash: '/harvestpov',
        name: 'POV Harvest & Taste (10s)',
        badge: 'HARVEST',
        desc: 'POV kebun: Tangan petik buah ➔ Belah juicy ➔ Cicipi makan (3 Scene 10s)',
        icon: '🌾',
        isDownload: false,
      },
      {
        slash: '/facelessgardenugc',
        name: 'Faceless Garden UGC (20s)',
        badge: 'GARDEN',
        desc: 'Kebun rumahan 20s: Hands-only wanita, VO natural-persuasive, polybag',
        icon: '🌱',
        isDownload: false,
      },
      {
        slash: '/download',
        name: 'Download Video TikTok',
        badge: 'DOWNLOAD',
        desc: 'Unduh video, thumbnail & musik TikTok tanpa watermark via link',
        icon: '📥',
        isDownload: true,
      },
      {
        slash: '/fashion',
        name: 'Fashion Video 15s',
        badge: 'FASHION',
        desc: 'Prompt video fashion 15s TikTok/Reels dengan hook & detail material',
        icon: '👗',
        isDownload: false,
      },
      {
        slash: '/lockcut',
        name: 'Lock Cut Fashion',
        badge: 'LOCKCUT',
        desc: 'Montase rapid jump-cut ~1s, kamera statis locked, zero zoom/pan',
        icon: '🔒',
        isDownload: false,
      },
      {
        slash: '/jumpcut',
        name: 'Jump Cut Fashion',
        badge: 'JUMPCUT',
        desc: 'Hard cut dinamis ganti pose/angle cepat ~1s per shot',
        icon: '⚡',
        isDownload: false,
      },
      {
        slash: '/natural',
        name: 'Natural & Candid',
        badge: 'NATURAL',
        desc: 'Ekspresi & pencahayaan alami tanpa terasa kaku ala lifestyle',
        icon: '🌿',
        isDownload: false,
      },
      {
        slash: '/ugc',
        name: 'Konten UGC Creator',
        badge: 'UGC',
        desc: 'Gaya review produk otentik ala smartphone creator/influencer',
        icon: '📱',
        isDownload: false,
      },
      {
        slash: '/clean',
        name: 'Clean Object & Studio',
        badge: 'CLEAN',
        desc: 'Latar studio minimalis rapi untuk foto katalog produk premium',
        icon: '✨',
        isDownload: false,
      },
      {
        slash: '/video',
        name: 'Storyboard Video AI',
        badge: 'VIDEO',
        desc: 'Alur adegan sinematik hook, product proof, dan CTA kuat',
        icon: '🎬',
        isDownload: false,
      },
    ];

    let currentFilteredSlashPresets = [];
    let activeSlashPresetIndex = 0;

    function getActiveSlashCommandQuery() {
      if (!chatInputText) return null;
      const val = chatInputText.value;
      const selStart = chatInputText.selectionStart || 0;
      const textBeforeCursor = val.slice(0, selStart);

      // Match slash command right at start of input or after whitespace/newline
      const match = textBeforeCursor.match(/(?:^|\s)\/([a-zA-Z0-9_\-]*)$/);
      if (!match) return null;

      const query = match[1].toLowerCase();
      const slashStart = match.index + (match[0].startsWith(' ') || match[0].startsWith('\n') ? 1 : 0);
      const slashEnd = selStart;

      return { query, slashStart, slashEnd };
    }

    function showSlashPresetPopup(queryInfo) {
      if (!slashPresetAutocomplete || !slashPresetList) return;
      const q = (queryInfo.query || '').trim();

      currentFilteredSlashPresets = CHAT_SLASH_PRESETS.filter((p) => {
        if (!q) return true;
        return (
          p.slash.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.badge.toLowerCase().includes(q) ||
          p.desc.toLowerCase().includes(q)
        );
      });

      if (currentFilteredSlashPresets.length === 0) {
        slashPresetList.innerHTML = `
          <div class="slash-preset-empty">
            Tidak ada preset yang cocok dengan <b>/${escapeHtml(q)}</b>
          </div>
        `;
        slashPresetAutocomplete.classList.remove('hidden');
        return;
      }

      if (activeSlashPresetIndex >= currentFilteredSlashPresets.length) {
        activeSlashPresetIndex = 0;
      }

      renderSlashPresetItems();
      slashPresetAutocomplete.classList.remove('hidden');
    }

    function renderSlashPresetItems() {
      if (!slashPresetList) return;
      slashPresetList.innerHTML = currentFilteredSlashPresets
        .map((preset, idx) => {
          const isSelected = idx === activeSlashPresetIndex;
          const isDownload = preset.isDownload;
          return `
            <div 
              class="slash-preset-item ${isSelected ? 'is-selected' : ''}" 
              data-index="${idx}"
              data-slash="${preset.slash}"
              role="option"
              aria-selected="${isSelected ? 'true' : 'false'}"
            >
              <div class="slash-preset-left">
                <span class="slash-preset-icon-box" style="${isDownload ? 'background:rgba(16,185,129,0.18);' : ''}">${preset.icon}</span>
                <div class="slash-preset-text-wrap">
                  <div class="slash-preset-heading-row">
                    <span class="slash-preset-item-name">${escapeHtml(preset.name)}</span>
                    <span class="slash-preset-badge-tag ${isDownload ? 'badge-download' : ''}">${preset.badge}</span>
                  </div>
                  <div class="slash-preset-item-desc">${escapeHtml(preset.desc)}</div>
                </div>
              </div>
              <span class="slash-preset-cmd-code ${isDownload ? 'cmd-download' : ''}">${preset.slash}</span>
            </div>
          `;
        })
        .join('');

      const activeEl = slashPresetList.querySelector('.slash-preset-item.is-selected');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }

      slashPresetList.querySelectorAll('.slash-preset-item').forEach((itemEl) => {
        itemEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = Number(itemEl.getAttribute('data-index'));
          const preset = currentFilteredSlashPresets[idx];
          if (preset) {
            applySlashPreset(preset);
          }
        });

        itemEl.addEventListener('mouseenter', () => {
          const idx = Number(itemEl.getAttribute('data-index'));
          if (!isNaN(idx) && activeSlashPresetIndex !== idx) {
            activeSlashPresetIndex = idx;
            updateSlashPresetSelection();
          }
        });
      });
    }

    function updateSlashPresetSelection() {
      if (!slashPresetList) return;
      slashPresetList.querySelectorAll('.slash-preset-item').forEach((el, idx) => {
        const isSel = idx === activeSlashPresetIndex;
        el.classList.toggle('is-selected', isSel);
        el.setAttribute('aria-selected', isSel ? 'true' : 'false');
        if (isSel) {
          el.scrollIntoView({ block: 'nearest' });
        }
      });
    }

    function hideSlashPresetPopup() {
      if (slashPresetAutocomplete && !slashPresetAutocomplete.classList.contains('hidden')) {
        slashPresetAutocomplete.classList.add('hidden');
      }
    }

    function applySlashPreset(preset) {
      if (!chatInputText || !preset) return;
      const queryInfo = getActiveSlashCommandQuery();
      const val = chatInputText.value;

      if (queryInfo) {
        const before = val.slice(0, queryInfo.slashStart);
        const after = val.slice(queryInfo.slashEnd);
        const insertStr = `${preset.slash} `;
        chatInputText.value = before + insertStr + after;
        const targetCursor = before.length + insertStr.length;
        chatInputText.focus();
        chatInputText.setSelectionRange(targetCursor, targetCursor);
      } else {
        chatInputText.value = `${preset.slash} ${val}`.trim() + ' ';
        chatInputText.focus();
      }

      chatInputText.style.height = 'auto';
      chatInputText.style.height = Math.min(chatInputText.scrollHeight, 160) + 'px';
      hideSlashPresetPopup();
    }

    // --- MEDIA MENTION (@) AUTOCOMPLETE POPUP CONTROLLER ---
    const mediaMentionAutocomplete = document.getElementById('mediaMentionAutocomplete');
    const mediaMentionList = document.getElementById('mediaMentionList');
    let currentFilteredMediaMentions = [];
    let activeMediaMentionIndex = 0;

    function getActiveMediaMentionQuery() {
      if (!chatInputText) return null;
      const val = chatInputText.value;
      const selStart = chatInputText.selectionStart || 0;
      const textBeforeCursor = val.slice(0, selStart);

      // Match '@' preceded by string start, whitespace or newline, followed by alphanumeric/underscore/dash
      const match = textBeforeCursor.match(/(?:^|[\s\n])@([a-zA-Z0-9_\-]*)$/);
      if (!match) return null;

      const query = match[1].toLowerCase();
      const atStart = match.index + (match[0].startsWith(' ') || match[0].startsWith('\n') || match[0].startsWith('\t') ? 1 : 0);
      const atEnd = selStart;

      return { query, atStart, atEnd };
    }

    function showMediaMentionPopup(queryInfo) {
      if (!mediaMentionAutocomplete || !mediaMentionList) return;
      hideSlashPresetPopup();

      const session = getCurrentSession();
      const { mediaList } = buildSessionMediaCatalog(session, currentAttachments);

      if (!mediaList || mediaList.length === 0) {
        mediaMentionList.innerHTML = `
          <div class="media-mention-empty">
            Belum ada media terlampir di percakapan ini.<br>
            <span style="font-size:10px; color:#71717a; margin-top:4px; display:inline-block;">Lampirkan gambar/video atau upload terlebih dahulu agar bisa di-tag.</span>
          </div>
        `;
        mediaMentionAutocomplete.classList.remove('hidden');
        currentFilteredMediaMentions = [];
        return;
      }

      const q = (queryInfo.query || '').trim();

      currentFilteredMediaMentions = mediaList.filter((m) => {
        if (!q) return true;
        const keyMatch = m.key.toLowerCase().includes(q) || m.key.toLowerCase().replace('@', '').includes(q);
        const nameMatch = (m.name || '').toLowerCase().includes(q);
        const typeMatch = (m.type || '').toLowerCase().includes(q);
        return keyMatch || nameMatch || typeMatch;
      });

      if (currentFilteredMediaMentions.length === 0) {
        mediaMentionList.innerHTML = `
          <div class="media-mention-empty">
            Tidak ada media terlampir yang cocok dengan <b>@${escapeHtml(q)}</b>
          </div>
        `;
        mediaMentionAutocomplete.classList.remove('hidden');
        return;
      }

      if (activeMediaMentionIndex >= currentFilteredMediaMentions.length) {
        activeMediaMentionIndex = 0;
      }

      renderMediaMentionItems();
      mediaMentionAutocomplete.classList.remove('hidden');
    }

    function renderMediaMentionItems() {
      if (!mediaMentionList) return;
      mediaMentionList.innerHTML = currentFilteredMediaMentions
        .map((item, idx) => {
          const isSelected = idx === activeMediaMentionIndex;
          const isVid = item.type === 'video';
          const isPending = Boolean(item.isPending);
          const thumbSrc = item.url || item.base64 || item.thumbnailUrl;
          let badgeText = isVid ? 'Video' : (isPending ? 'Terlampir' : 'Foto Sesi');
          if (item.name && item.name.includes('Produk')) badgeText = 'Produk';
          else if (item.name && item.name.includes('Render')) badgeText = 'Render AI';

          return `
            <div 
              class="media-mention-item ${isSelected ? 'is-selected' : ''}" 
              data-index="${idx}"
              data-tag="${escapeHtml(item.key)}"
              role="option"
              aria-selected="${isSelected ? 'true' : 'false'}"
            >
              <div class="media-mention-left">
                <div class="media-mention-thumb-box">
                  ${thumbSrc && !isVid ? `
                    <img src="${escapeHtml(thumbSrc)}" class="media-mention-thumb-img" alt="${escapeHtml(item.name || item.key)}" onerror="this.parentElement.innerHTML='🖼️';" />
                  ` : (isVid && item.thumbnailUrl ? `
                    <img src="${escapeHtml(item.thumbnailUrl)}" class="media-mention-thumb-img" alt="${escapeHtml(item.name || item.key)}" onerror="this.parentElement.innerHTML='🎬';" />
                  ` : `
                    <span style="font-size:14px;">${isVid ? '🎬' : '🖼️'}</span>
                  `)}
                </div>
                <div class="media-mention-text-wrap">
                  <div class="media-mention-heading-row">
                    <span class="media-mention-tag-name">${escapeHtml(item.key)}</span>
                    <span class="media-mention-badge-tag ${isVid ? 'badge-video' : (isPending ? 'badge-pending' : '')}">${badgeText}</span>
                  </div>
                  <div class="media-mention-item-desc">${escapeHtml(item.name || 'Media terlampir')}</div>
                </div>
              </div>
              <span class="media-mention-cmd-code">Tab / Enter</span>
            </div>
          `;
        })
        .join('');

      const activeEl = mediaMentionList.querySelector('.media-mention-item.is-selected');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }

      mediaMentionList.querySelectorAll('.media-mention-item').forEach((itemEl) => {
        itemEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = Number(itemEl.getAttribute('data-index'));
          const item = currentFilteredMediaMentions[idx];
          if (item) {
            applyMediaMention(item);
          }
        });

        itemEl.addEventListener('mouseenter', () => {
          const idx = Number(itemEl.getAttribute('data-index'));
          if (!isNaN(idx) && activeMediaMentionIndex !== idx) {
            activeMediaMentionIndex = idx;
            updateMediaMentionSelection();
          }
        });
      });
    }

    function updateMediaMentionSelection() {
      if (!mediaMentionList) return;
      mediaMentionList.querySelectorAll('.media-mention-item').forEach((el, idx) => {
        const isSel = idx === activeMediaMentionIndex;
        el.classList.toggle('is-selected', isSel);
        el.setAttribute('aria-selected', isSel ? 'true' : 'false');
        if (isSel) {
          el.scrollIntoView({ block: 'nearest' });
        }
      });
    }

    function hideMediaMentionPopup() {
      if (mediaMentionAutocomplete && !mediaMentionAutocomplete.classList.contains('hidden')) {
        mediaMentionAutocomplete.classList.add('hidden');
      }
    }

    function applyMediaMention(item) {
      if (!chatInputText || !item) return;
      const queryInfo = getActiveMediaMentionQuery();
      const val = chatInputText.value;

      if (queryInfo) {
        const before = val.slice(0, queryInfo.atStart);
        const after = val.slice(queryInfo.atEnd);
        const insertStr = `${item.key} `;
        chatInputText.value = before + insertStr + after;
        const targetCursor = before.length + insertStr.length;
        chatInputText.focus();
        chatInputText.setSelectionRange(targetCursor, targetCursor);
      } else {
        chatInputText.value = `${item.key} ${val}`.trim() + ' ';
        chatInputText.focus();
      }

      chatInputText.style.height = 'auto';
      chatInputText.style.height = Math.min(chatInputText.scrollHeight, 160) + 'px';
      hideMediaMentionPopup();
      updateTaggedMediaPreviewBar();
    }

    // --- TAGGED MEDIA PREVIEW BAR CONTROLLER ---
    const taggedMediaPreviewBar = document.getElementById('taggedMediaPreviewBar');

    function updateTaggedMediaPreviewBar() {
      if (!taggedMediaPreviewBar || !chatInputText) return;
      const text = chatInputText.value || '';
      const tags = Array.from(new Set((text.match(/@(img|vid)\d+/gi) || []).map((t) => t.toLowerCase())));

      if (tags.length === 0) {
        taggedMediaPreviewBar.classList.add('hidden');
        taggedMediaPreviewBar.innerHTML = '';
        return;
      }

      const session = getCurrentSession();
      const { mediaMap } = buildSessionMediaCatalog(session, currentAttachments);

      const validChips = [];
      for (const tag of tags) {
        const item = mediaMap[tag];
        if (item) {
          validChips.push(item);
        }
      }

      if (validChips.length === 0) {
        taggedMediaPreviewBar.classList.add('hidden');
        taggedMediaPreviewBar.innerHTML = '';
        return;
      }

      taggedMediaPreviewBar.classList.remove('hidden');
      taggedMediaPreviewBar.innerHTML = validChips
        .map((item) => {
          const isVid = item.type === 'video';
          const thumbSrc = item.url || item.base64 || item.thumbnailUrl;
          return `
            <div class="tagged-media-chip" data-tag="${escapeHtml(item.key)}">
              ${thumbSrc && !isVid ? `
                <img src="${escapeHtml(thumbSrc)}" class="tagged-media-chip-thumb" alt="${escapeHtml(item.name || item.key)}" onerror="this.style.display='none';" />
              ` : (isVid && item.thumbnailUrl ? `
                <img src="${escapeHtml(item.thumbnailUrl)}" class="tagged-media-chip-thumb" alt="${escapeHtml(item.name || item.key)}" onerror="this.style.display='none';" />
              ` : `
                <span class="tagged-media-chip-thumb-video">${isVid ? '🎬' : '🖼️'}</span>
              `)}
              <span class="tagged-media-chip-tag">${escapeHtml(item.key)}</span>
              <span class="tagged-media-chip-name" title="${escapeHtml(item.name || '')}">${escapeHtml(item.name || 'Media')}</span>
              <button type="button" class="tagged-media-chip-remove" data-tag="${escapeHtml(item.key)}" title="Hapus tag">&times;</button>
            </div>
          `;
        })
        .join('');

      taggedMediaPreviewBar.querySelectorAll('.tagged-media-chip-remove').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const tagToRemove = btn.getAttribute('data-tag');
          if (!tagToRemove) return;
          const regex = new RegExp(`\\b${tagToRemove}\\b\\s*`, 'gi');
          chatInputText.value = chatInputText.value.replace(regex, '').trim();
          updateTaggedMediaPreviewBar();
          chatInputText.focus();
        });
      });
    }

    presetOptionBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slash = btn.getAttribute('data-slash');
        if (slash) {
          chatInputText.value = `${slash} ${chatInputText.value}`.trim() + ' ';
          chatInputText.focus();
        }
        presetMenuPopover?.classList.add('hidden');
        hideSlashPresetPopup();
      });
    });

    // Slash command chips (legacy support)
    slashChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const slash = chip.getAttribute('data-slash');
        chatInputText.value = `${slash} ${chatInputText.value}`;
        chatInputText.focus();
      });
    });

    // File attachments in chat
    const handleChatUploadFiles = async (fileList) => {
      const files = Array.from(fileList || []);
      if (files.length === 0) return;
      for (const file of files) {
        const isVid = file.type.startsWith('video/') || /\.(mp4|mov|webm|avi|mkv)$/i.test(file.name);
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
        if (dataUrl) {
          let vidDuration = 0;
          if (isVid) {
            try {
              vidDuration = await new Promise((resDur) => {
                const tempV = document.createElement('video');
                tempV.preload = 'metadata';
                const timer = setTimeout(() => resDur(0), 4000);
                tempV.onloadedmetadata = () => {
                  clearTimeout(timer);
                  resDur(Math.round(tempV.duration || 0));
                };
                tempV.onerror = () => {
                  clearTimeout(timer);
                  resDur(0);
                };
                tempV.src = dataUrl;
              });
            } catch (_) {}
          }
          const fileNameLower = (file.name || '').toLowerCase();
          const isPerson = /model|talent|orang|wajah|pria|wanita|person|face|karakter|character|man|woman|cewek|cowok|selfie|pose|rendi|budi|siti|andi|agus|dewi|petani|host/i.test(fileNameLower) && !/pepaya|buah|bibit|benih|pohon|tanaman/i.test(fileNameLower);
          const isBg = /background|bg|latar|kebun|ruangan|studio|outdoor|indoor|taman|setting|sawah/i.test(fileNameLower);
          const isProduct = /produk|product|barang|item|botol|kemasan|bibit|benih|pepaya|buah|bunga|tanaman/i.test(fileNameLower);
          const autoRole = isPerson ? 'model' : isBg ? 'background' : isProduct ? 'product' : 'custom';
          currentAttachments.push({
            id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: file.name,
            type: isVid ? 'video' : (file.type.startsWith('image/') ? 'image' : 'file'),
            url: dataUrl,
            base64: dataUrl,
            duration: vidDuration,
            role: autoRole,
            referenceRole: autoRole,
          });
        }
      }
      renderAttachmentTray();
    };

    document.getElementById('btnChatAddImage')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openImageSourcePicker({
        fileInput: fileInputAttachment,
        onUploadFiles: handleChatUploadFiles,
        onLibraryAsset: async (asset) => {
          let dataUrl = asset.base64 || asset.dataUrl || (typeof asset.url === 'string' && asset.url.startsWith('data:') ? asset.url : null) || (typeof asset.thumbnailUrl === 'string' && asset.thumbnailUrl.startsWith('data:') ? asset.thumbnailUrl : null);
          let mime = asset.mime || (typeof asset.type === 'string' && asset.type.includes('/') ? asset.type : 'image/png');

          if (!dataUrl && (asset.url || asset.thumbnailUrl)) {
            const rawSrc = asset.url || asset.thumbnailUrl;
            try {
              let res = await fetch(rawSrc).catch(() => null);
              if (!res || !res.ok) {
                res = await fetch(`/api/proxy?url=${encodeURIComponent(rawSrc)}`).catch(() => null);
              }
              if (res && res.ok) {
                const blob = await res.blob();
                mime = blob.type || mime || 'image/png';
                dataUrl = await new Promise((resolve) => {
                  const r = new FileReader();
                  r.onload = () => resolve(r.result);
                  r.onerror = () => resolve('');
                  r.readAsDataURL(blob);
                });
              }
            } catch (fetchErr) {
              console.warn('[Chat] Gagal mengunduh gambar library:', fetchErr);
            }
          }

          if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
            const m = dataUrl.match(/^data:([^;]+);/);
            if (m && m[1]) mime = m[1];
          }

          const isVid = mime.startsWith('video/') || (asset.name && /\.(mp4|mov|webm|avi|mkv)$/i.test(asset.name)) || asset.type === 'video';
          const ext = isVid ? '.mp4' : (mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg');
          let cleanName = asset.name || (isVid ? 'video' : 'image');
          if (!/\.(png|jpe?g|webp|gif|svg|mp4|mov|webm)$/i.test(cleanName)) {
            cleanName = `${cleanName}${ext}`;
          }

          const detectedRole = String(asset.role || asset.referenceRole || asset.weavyAsset?.role || asset.weavyAsset?.referenceRole || 'custom').toLowerCase();
          const cleanRole = detectedRole === 'talent' ? 'model' : detectedRole;

          currentAttachments.push({
            id: `att_library_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: cleanName,
            type: isVid ? 'video' : mime,
            mime: mime,
            url: dataUrl || asset.url,
            base64: dataUrl || asset.base64 || asset.url,
            dataUrl: dataUrl || asset.base64 || asset.url,
            role: cleanRole,
            referenceRole: cleanRole,
            weavyAsset: asset.weavyAsset || asset,
          });
          renderAttachmentTray();
        },
      });
    });

    if (fileInputAttachment) {
      fileInputAttachment.onchange = (e) => {
        handleChatUploadFiles(e.target.files);
        e.target.value = '';
      };
    }

    // Drag and drop image files onto chat input card
    const chatInputCardEl = document.querySelector('.chat-input-card');
    if (chatInputCardEl) {
      chatInputCardEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        chatInputCardEl.classList.add('drag-over');
      });
      chatInputCardEl.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        chatInputCardEl.classList.remove('drag-over');
      });
      chatInputCardEl.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        chatInputCardEl.classList.remove('drag-over');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleChatUploadFiles(e.dataTransfer.files);
        }
      });
    }

    // Klik tombol "+ Lampirkan ke Chat" pada kartu TikTok
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-stage-tiktok-attachment');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const cover = btn.getAttribute('data-cover');
      const play = btn.getAttribute('data-play');
      const title = btn.getAttribute('data-title') || 'TikTok';
      let added = false;
      if (cover && !currentAttachments.some((a) => a.url === cover)) {
        currentAttachments.push({
          id: `att_thumb_${Date.now()}`,
          name: `Thumbnail - ${title}.jpg`,
          type: 'image',
          url: cover,
          thumbnailUrl: cover,
          source: 'tiktok_download',
        });
        added = true;
      }
      if (play && !currentAttachments.some((a) => a.url === play)) {
        currentAttachments.push({
          id: `att_vid_${Date.now()}`,
          name: `${title}.mp4`,
          type: 'video',
          url: play,
          thumbnailUrl: cover || null,
          source: 'tiktok_download',
        });
        added = true;
      }
      if (added) {
        renderAttachmentTray();
        chatInputText?.focus();
      }
    });

    // Paste image from clipboard
    chatInputText?.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData)?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              currentAttachments.push({
                id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                name: file.name || 'clipboard_image.png',
                type: 'image',
                url: ev.target.result,
                base64: ev.target.result,
              });
              renderAttachmentTray();
            };
            reader.readAsDataURL(file);
          }
        }
      }
    });

    // Auto-grow textarea height & trigger media mention (@) or slash autocomplete popup
    chatInputText?.addEventListener('input', () => {
      chatInputText.style.height = 'auto';
      chatInputText.style.height = Math.min(chatInputText.scrollHeight, 160) + 'px';
      if (!isGenerating && btnSendMessage && (btnSendMessage.disabled || btnSendMessage.classList.contains('is-loading'))) {
        setChatGeneratingState(false);
      }

      // 0. Update Tagged Media Preview Chips
      updateTaggedMediaPreviewBar();

      // 1. Detect media mention query (@)
      const mentionQuery = getActiveMediaMentionQuery();
      if (mentionQuery) {
        showMediaMentionPopup(mentionQuery);
        return;
      }
      hideMediaMentionPopup();

      // 2. Detect slash command query (/)
      const slashQuery = getActiveSlashCommandQuery();
      if (slashQuery) {
        showSlashPresetPopup(slashQuery);
      } else {
        hideSlashPresetPopup();
      }
    });

    // Send on Enter (Ctrl+Enter or Enter without Shift) & Keyboard Navigation for Mention / Slash Popups
    chatInputText?.addEventListener('keydown', (e) => {
      const isMentionOpen = mediaMentionAutocomplete && !mediaMentionAutocomplete.classList.contains('hidden');
      if (isMentionOpen && currentFilteredMediaMentions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          activeMediaMentionIndex = (activeMediaMentionIndex + 1) % currentFilteredMediaMentions.length;
          updateMediaMentionSelection();
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          activeMediaMentionIndex =
            (activeMediaMentionIndex - 1 + currentFilteredMediaMentions.length) % currentFilteredMediaMentions.length;
          updateMediaMentionSelection();
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
          const selectedItem = currentFilteredMediaMentions[activeMediaMentionIndex];
          if (selectedItem) {
            applyMediaMention(selectedItem);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          hideMediaMentionPopup();
          return;
        }
      }

      const isPopupOpen = slashPresetAutocomplete && !slashPresetAutocomplete.classList.contains('hidden');

      if (isPopupOpen && currentFilteredSlashPresets.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          activeSlashPresetIndex = (activeSlashPresetIndex + 1) % currentFilteredSlashPresets.length;
          updateSlashPresetSelection();
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          activeSlashPresetIndex =
            (activeSlashPresetIndex - 1 + currentFilteredSlashPresets.length) % currentFilteredSlashPresets.length;
          updateSlashPresetSelection();
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
          const selectedPreset = currentFilteredSlashPresets[activeSlashPresetIndex];
          if (selectedPreset) {
            applySlashPreset(selectedPreset);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          hideSlashPresetPopup();
          return;
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        hideSlashPresetPopup();
        hideMediaMentionPopup();
        if (!isGenerating) {
          handleSendMessage();
        }
      }
    });

    btnSendMessage?.addEventListener('click', () => {
      if (isGenerating) {
        console.log('[Chat] User clicked stop / abort');
        if (chatGenerationAbortController) {
          chatGenerationAbortController.abort();
          chatGenerationAbortController = null;
        }
        setChatGeneratingState(false);
        const session = getCurrentSession();
        if (session && session.messages.length > 0) {
          const lastMsg = session.messages[session.messages.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            if (lastMsg.content === '[chat_typing_loader]' || lastMsg.content.includes('[chat_typing_loader]')) {
              lastMsg.content = lastMsg.content.replace(/\[chat_typing_loader\]/g, '').trim() || '*(Dibatalkan oleh pengguna)*';
              saveChatSessions();
              renderChatMessages();
            }
          }
        }
        return;
      }
      handleSendMessage();
    });
    // Floating Scroll To Bottom Button & User Scroll Detection
    chatMessages?.addEventListener('scroll', handleChatScroll, { passive: true });
    chatMessages?.addEventListener('wheel', () => {
      isUserScrollingChat = true;
      clearTimeout(userScrollTimeout);
      userScrollTimeout = setTimeout(() => { isUserScrollingChat = false; }, 400);
    }, { passive: true });
    chatMessages?.addEventListener('touchstart', () => {
      isUserScrollingChat = true;
    }, { passive: true });
    chatMessages?.addEventListener('touchend', () => {
      clearTimeout(userScrollTimeout);
      userScrollTimeout = setTimeout(() => { isUserScrollingChat = false; }, 400);
    }, { passive: true });
    chatMessages?.addEventListener('pointerdown', () => {
      isUserScrollingChat = true;
    }, { passive: true });
    chatMessages?.addEventListener('pointerup', () => {
      clearTimeout(userScrollTimeout);
      userScrollTimeout = setTimeout(() => { isUserScrollingChat = false; }, 400);
    }, { passive: true });

    btnScrollToBottom?.addEventListener('click', (e) => {
      e.preventDefault();
      isChatAutoScrollActive = true;
      scrollToBottomChat(true);
    });
    window.addEventListener('resize', updateScrollToBottomVisibility, { passive: true });

    btnNewSession?.addEventListener('click', createNewSession);
    btnHistoryNewSession?.addEventListener('click', () => {
      createNewSession();
      closeChatSessionHistory();
    });
    btnSessionHistory?.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = !chatSessionHistoryPopover?.classList.contains('hidden');
      if (!isOpen) renderChatSessionHistory();
      chatSessionHistoryPopover?.classList.toggle('hidden', isOpen);
      btnSessionHistory.setAttribute('aria-expanded', String(!isOpen));
    });
    btnClearCurrentChat?.addEventListener('click', async () => {
      if (chatGenerationAbortController) {
        chatGenerationAbortController.abort();
        chatGenerationAbortController = null;
      }
      setChatGeneratingState(false);

      const s = getCurrentSession();
      if (!s || s.messages.length === 0) return;

      // Set loading state
      btnClearCurrentChat.disabled = true;
      const originalHTML = btnClearCurrentChat.innerHTML;
      btnClearCurrentChat.innerHTML = `<svg class="icon-sm spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 4v6h-6M1 20v-6h6"/>
        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
      </svg>`;

      // Small delay for visual feedback
      await new Promise(r => setTimeout(r, 300));

      s.messages = [];
      s.dolaConvId = null;
      s.dolaSectionId = null;
      s.dolaMessageIndex = null;
      s.providerRuntime = {
        dola: { convId: null, sectionId: null, messageIndex: null },
        gemini: { lastModel: null },
        weavy: { canvasId: null },
      };
      await saveChatSessions();
      renderChatMessages();

      const currentModel = chatModelSelect?.value || '';
      const currentProvider = chatProviderSelect?.value || (currentModel.startsWith('dola/') ? 'dola' : (currentModel.startsWith('gemini/') ? 'gemini' : 'weavy'));
      if (currentProvider === 'dola' || currentModel.startsWith('dola/')) {
        createDolaNewChatSessionInTab({ openIfMissing: false }).catch((err) => {
          console.warn('[Menu Chat] Gagal sinkronisasi sesi chat baru ke tab Dola saat clear:', err);
        });
      } else if (currentProvider === 'gemini' || currentModel.startsWith('gemini/')) {
        createGeminiNewChatSessionInTab({ openIfMissing: false }).catch((err) => {
          console.warn('[Menu Chat] Gagal sinkronisasi sesi chat baru ke tab Gemini saat clear:', err);
        });
      }

      // Restore button
      btnClearCurrentChat.innerHTML = originalHTML;
      btnClearCurrentChat.disabled = false;
    });

    // Account Sync Buttons & Settings Wireframe Events
    btnAddAccount?.addEventListener('click', handleAddAccount);
    const btnSyncAll = document.getElementById('btnSyncAllAccounts');
    btnSyncAll?.addEventListener('click', syncAllAccounts);

    // Settings Wireframe V2 Controls
    const inputSearchAccount = document.getElementById('inputSearchAccount');
    const btnClearAccountSearch = document.getElementById('btnClearAccountSearch');
    const btnToggleTokenGuide = document.getElementById('btnToggleTokenGuide');
    const tokenGuideContent = document.getElementById('tokenGuideContent');
    const accordionGuideChevron = document.getElementById('accordionGuideChevron');
    const btnToggleBatchSelect = document.getElementById('btnToggleBatchSelect');
    const chkSelectAllAccounts = document.getElementById('chkSelectAllAccounts');
    const btnBatchSyncSelected = document.getElementById('btnBatchSyncSelected');
    const btnBatchDeleteSelected = document.getElementById('btnBatchDeleteSelected');
    const btnBatchCancel = document.getElementById('btnBatchCancel');
    const btnOpenAddAccountModal = document.getElementById('btnOpenAddAccountModal');
    const addAccountModal = document.getElementById('addAccountModal');
    const btnCloseAddAccountModal = document.getElementById('btnCloseAddAccountModal');
    const addAccountOverlay = document.getElementById('addAccountOverlay');

    bindAccountEvents({
      accountsListContainer,
      inputSearchAccount,
      btnClearAccountSearch,
      btnToggleBatchSelect,
      chkSelectAllAccounts,
      btnBatchSyncSelected,
      btnBatchDeleteSelected,
      btnBatchCancel,
      getAccounts: () => accounts,
      setAccounts: (nextAccounts) => { accounts = nextAccounts; },
      getActiveAccountId: () => activeAccountId,
      setActiveAccountId: (nextId) => { activeAccountId = nextId; },
      getBatchSelectMode: () => isBatchSelectMode,
      setBatchSelectMode: (nextMode) => { isBatchSelectMode = nextMode; },
      selectedAccountIds,
      getSearchQuery: () => accountSearchQuery,
      setSearchQuery: (query) => { accountSearchQuery = query; },
      renderAccountsList,
      renderHeaderAccount,
      saveAccounts,
      syncSingleAccount,
      syncAccountSessionToBrowserTab,
      showAuthAlert,
      exportAccounts,
    });

    const providerPills = document.querySelectorAll('.provider-tab-pill');
    providerPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const nextProvider = pill.dataset.provider || 'weavy';
        setActiveProvider(nextProvider);
        providerPills.forEach((item) => item.classList.toggle('active', item === pill));
        syncGenerationProviderUi();
        renderHeaderAccount();
        renderAccountsList();
      });
    });

    // 2. Accordion Toggle
    btnToggleTokenGuide?.addEventListener('click', () => {
      if (tokenGuideContent) {
        const isHidden = tokenGuideContent.classList.toggle('hidden');
        if (accordionGuideChevron) {
          accordionGuideChevron.classList.toggle('open', !isHidden);
        }
      }
    });

    // Copy Token Extract Script to Clipboard
    const btnCopyTokenScript = document.getElementById('btnCopyTokenScript');
    const copyTokenScriptText = document.getElementById('copyTokenScriptText');
    const tokenExtractScriptCode = document.getElementById('tokenExtractScriptCode');

    btnCopyTokenScript?.addEventListener('click', async () => {
      const code = tokenExtractScriptCode?.textContent || '';
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code);
        btnCopyTokenScript.classList.add('copied');
        if (copyTokenScriptText) copyTokenScriptText.textContent = 'Tersalin! ✅';
        setTimeout(() => {
          btnCopyTokenScript.classList.remove('copied');
          if (copyTokenScriptText) copyTokenScriptText.textContent = 'Salin Script';
        }, 2000);
      } catch (err) {
        prompt('Salin script berikut:', code);
      }
    });

    const btnBatchExportSelected = document.getElementById('btnBatchExportSelected');
    btnBatchExportSelected?.addEventListener('click', () => {
      if (selectedAccountIds.size === 0) {
        showAuthAlert('Pilih minimal satu akun untuk diekspor.', 'error');
        return;
      }
      exportAccounts(selectedAccountIds);
    });

    const btnExportAccounts = document.getElementById('btnExportAccounts');
    btnExportAccounts?.addEventListener('click', () => {
      exportAccounts();
    });

    const btnImportAccounts = document.getElementById('btnImportAccounts');
    const importAccountsModal = document.getElementById('importAccountsModal');
    const btnCloseImportAccountsModal = document.getElementById('btnCloseImportAccountsModal');
    const importAccountsOverlay = document.getElementById('importAccountsOverlay');
    const inputFileImportAccounts = document.getElementById('inputFileImportAccounts');
    const inputImportAccountsText = document.getElementById('inputImportAccountsText');
    const btnExecuteImportAccounts = document.getElementById('btnExecuteImportAccounts');
    const importStatusAlert = document.getElementById('importStatusAlert');
    const importProgressPanel = document.getElementById('importProgressPanel');
    const importTotalLabel = document.getElementById('importTotalLabel');
    const importProgressLabel = document.getElementById('importProgressLabel');
    const importProgressFill = document.getElementById('importProgressFill');
    const importProgressTrack = importProgressPanel?.querySelector('.import-progress-track');

    bindAccountImportUi({
      btnImportAccounts,
      importAccountsModal,
      btnCloseImportAccountsModal,
      importAccountsOverlay,
      inputFileImportAccounts,
      inputImportAccountsText,
      btnExecuteImportAccounts,
      importStatusAlert,
      importProgressPanel,
      importTotalLabel,
      importProgressLabel,
      importProgressFill,
      importProgressTrack,
      countImportAccounts,
      handleImportAccounts: (rawText, opts = {}) => {
        const format = opts.format === 'txt' ? 'txt' : 'json';
        if (format === 'txt') return importAccountsFromTxt(rawText, opts.onProgress || (() => {}));
        return importAccountsFromJson(rawText, opts.onProgress || (() => {}));
      },
      showAuthAlert,
    });

    // 5. Add Account Modal
    const btnAutoImportActiveAccount = document.getElementById('btnAutoImportActiveAccount');

    btnAutoImportActiveAccount?.addEventListener('click', handleAutoImportActiveAccount);

    btnOpenAddAccountModal?.addEventListener('click', () => {
      addAccountModal?.classList.remove('hidden');
      inputRefreshToken?.focus();
    });

    const closeAddModal = () => {
      addAccountModal?.classList.add('hidden');
      if (authStatusAlert) authStatusAlert.classList.add('hidden');
    };

    btnCloseAddAccountModal?.addEventListener('click', closeAddModal);
    addAccountOverlay?.addEventListener('click', closeAddModal);

    // Generate Tab Controls
    btnChooseRefImage?.addEventListener('click', () => genRefFileInput.click());
    btnAddMoreRefImages?.addEventListener('click', () => genRefFileInput.click());
    btnClearAllRefImages?.addEventListener('click', () => {
      currentGenRefImages = [];
      renderGenRefGallery();
      genRefFileInput.value = '';
    });

    btnSubmitGenerate?.addEventListener('click', handleDirectGenerateImage);

    // ==========================================
    // STUDIO STORYBOARD WORKSPACE EVENT BINDINGS
    // ==========================================
    initStoryboardWorkspaceEvents();
  }

  // ==========================================
  // STUDIO STORYBOARD WORKSPACE MODULE (AMB MEDIA V2 PARITY)
  // ==========================================
  let currentSbProject = null;
  let savedSbProjects = [];
  const CURRENT_SB_STORAGE_KEY = 'weavy_current_storyboard_id';
  let currentAspect = '9:16';
  let isBatchGenerating = false;
  let activeSbScene = null;
  let sbCompositeResultUrl = null;

  // Consistency Reference Images (Base64 data & Weavy Asset Links)
  let sbProductRefBase64 = null;
  let sbProductWeavyAsset = null;
  let sbModelRefBase64 = null;
  let sbModelWeavyAsset = null;
  let sbBgRefBase64 = null;
  let sbBgWeavyAsset = null;
  let sbCustomAssets = []; // array of { id, name, promptDesc, base64, weavyAsset, isUploading, showCheckmark }
  let storyboardCopilotInstance = null;

  async function transferProductToStoryboard({ title, thumb, desc, price, store, usps = [], images = [], chatInputImages = [], dolaConvId = null }) {
    if (!title && !thumb && !desc && (!images || images.length === 0)) return;

    // 1. Switch to Storyboard tab
    switchTab('storyboard');

    // 2. Activate manual ingestion pane
    if (tabManualIngestBtn && tabUrlIngestBtn) {
      tabManualIngestBtn.classList.add('active');
      tabUrlIngestBtn.classList.remove('active');
      sbManualPane?.classList.remove('hidden');
      sbManualPane?.classList.add('active');
      sbUrlPane?.classList.add('hidden');
      sbUrlPane?.classList.remove('active');
    }

    // 3. Populate product details in Storyboard form
    if (sbProductName) sbProductName.value = title;
    if (sbProductDesc) sbProductDesc.value = `${price ? `Harga: ${price}. ` : ''}${desc || title}`;
    const uspList = Array.isArray(usps) && usps.length > 0 ? usps : ['Kualitas terjamin', 'Harga promo terjangkau', 'Pengiriman cepat'];
    if (sbBriefInput) {
      sbBriefInput.value = `Video review komersial TikTok UGC & Affiliate untuk produk "${title}". Sorot keunggulan: ${uspList.join(', ')}. Terapkan hook kuat di 2 detik awal, demonstrasi visual manfaat produk, dan ajakan checkout keranjang kuning.`;
    }

    // 4. Set primary visual reference (dari thumbnail produk atau input gambar chat)
    const primaryImg = thumb ||
      (Array.isArray(chatInputImages) && chatInputImages.length > 0 ? (chatInputImages[0]?.base64 || chatInputImages[0]?.url) : null) ||
      (Array.isArray(images) && images.length > 0 ? (typeof images[0] === 'string' ? images[0] : (images[0]?.base64 || images[0]?.url)) : null);

    if (primaryImg) {
      sbProductRefBase64 = primaryImg;
      sbProductWeavyAsset = primaryImg.startsWith('http') ? { url: primaryImg, type: 'image' } : null;
      applyStoryboardReferencePreview(
        { base64: sbProductRefBase64, weavyAsset: sbProductWeavyAsset },
        sbProductEmptyState,
        sbProductPreviewWrap,
        sbProductImg,
        { base64: sbProductRefBase64, weavyAsset: sbProductWeavyAsset }
      );
    }

    // 5. Populate Custom Assets dengan sisa gambar dari chat input & galeri
    const allAvailableImages = Array.isArray(images) ? [...images] : [];
    if (Array.isArray(chatInputImages)) {
      chatInputImages.forEach((cImg) => {
        const u = cImg.base64 || cImg.url;
        if (u && !allAvailableImages.some((existing) => (existing.base64 || existing.url || existing) === u)) {
          allAvailableImages.push(cImg);
        }
      });
    }

    const extraGalleryImages = allAvailableImages.filter((img) => {
      const u = typeof img === 'string' ? img : (img?.base64 || img?.url);
      return u && u !== primaryImg;
    });

    if (extraGalleryImages.length > 0) {
      sbCustomAssets = extraGalleryImages.slice(0, 5).map((img, i) => {
        const imgUrl = typeof img === 'string' ? img : (img?.base64 || img?.url || '');
        return {
          id: `ca_${Date.now()}_${i}`,
          name: (typeof img === 'object' && img?.name) ? img.name : `Foto Referensi #${i + 2}`,
          promptDesc: `Detail visual kemasan & isi ${title}`,
          base64: imgUrl,
          weavyAsset: imgUrl && imgUrl.startsWith('http') ? { url: imgUrl, type: 'image' } : null,
          role: 'custom',
          isUploading: false,
          showCheckmark: false,
        };
      }).filter((a) => Boolean(a.base64 || a.weavyAsset));
      renderCustomAssetsList();
    }

    // 6. Reset output section agar menunggu hasil generate nyata dari AI
    currentSbProject = null;
    activeSbScene = null;
    hideStoryboardOutputSection();

    // 7. Bridge to Storyboard Copilot
    if (storyboardCopilotInstance) {
      if (typeof storyboardCopilotInstance.receiveProductData === 'function') {
        await storyboardCopilotInstance.receiveProductData({
          title,
          price,
          store,
          desc,
          usps: uspList,
          images: allAvailableImages,
          thumbnail: primaryImg,
          dolaConvId,
        });
      }

      showAuthAlert('🎬 Terhubung ke Storyboard Copilot! Meminta Dola AI merancang storyboard komersial...', 'info');

      // Kirim prompt otomatis ke Dola AI di Storyboard Copilot agar langsung memproses dan membuat storyboard
      if (typeof storyboardCopilotInstance.sendPrompt === 'function') {
        setTimeout(() => {
          storyboardCopilotInstance.sendPrompt(
            `Tolong buatkan alur storyboard video komersial 4 scene yang memikat untuk produk "${title}" (${price || 'Harga Promo Terjangkau'}) berdasarkan hasil analisis produk dan aset visual terlampir. Sertakan hook 2 detik awal, detail visual, kamera angle, dan voiceover persuasif.`
          );
        }, 350);
      }
    } else {
      showAuthAlert('🎬 Data produk & foto input berhasil dimasukkan ke form Storyboard!', 'success');
    }
  }

  // DOM Elements - Ingestion Switcher & Reset
  const btnResetStoryboard = document.getElementById('btnResetStoryboard');
  const tabManualIngestBtn = document.getElementById('sbTabBtnManual');
  const tabUrlIngestBtn = document.getElementById('sbTabBtnUrl');
  const sbManualPane = document.getElementById('sbPaneManual');
  const sbUrlPane = document.getElementById('sbPaneUrl');

  // DOM Elements - Visual Consistency (Product, Model, BG)
  const sbProductUploadBox = document.getElementById('uploaderProd');
  const sbProductFileInput = document.getElementById('sbProdFileInput');
  const sbProductEmptyState = document.getElementById('sbProdEmpty');
  const sbProductPreviewWrap = document.getElementById('sbProdPreviewBox');
  const sbProductImg = document.getElementById('sbProdImgPreview');
  const btnChangeProductImg = document.getElementById('btnChangeProdImg');
  const btnDelProductImg = document.getElementById('btnRemoveProdImg');
  const sbProductName = document.getElementById('sbProductName');
  const sbProductDesc = document.getElementById('sbProductDesc');

  const sbModelUploadBox = document.getElementById('uploaderModel');
  const sbModelFileInput = document.getElementById('sbModelFileInput');
  const sbModelEmptyState = document.getElementById('sbModelEmpty');
  const sbModelPreviewWrap = document.getElementById('sbModelPreviewBox');
  const sbModelImg = document.getElementById('sbModelImgPreview');
  const btnChangeModelImg = document.getElementById('btnChangeModelImg');
  const btnDelModelImg = document.getElementById('btnRemoveModelImg');
  const sbModelTalent = document.getElementById('sbModelTalent');

  const sbBgUploadBox = document.getElementById('uploaderBg');
  const sbBgFileInput = document.getElementById('sbBgFileInput');
  const sbBgEmptyState = document.getElementById('sbBgEmpty');
  const sbBgPreviewWrap = document.getElementById('sbBgPreviewBox');
  const sbBgImg = document.getElementById('sbBgImgPreview');
  const btnChangeBgImg = document.getElementById('btnChangeBgImg');
  const btnDelBgImg = document.getElementById('btnRemoveBgImg');
  const sbBgSetting = document.getElementById('sbBgSetting');

  // Custom Assets
  const sbCustomAssetsContainer = document.getElementById('sbCustomAssetsContainer');
  const sbCustomAssetsList = document.getElementById('sbCustomAssetsList');
  const btnAddCustomAsset = document.getElementById('btnAddCustomAsset');

  // Brief, Duration & Configurations
  const sbForm = document.getElementById('sbForm');
  const sbBriefInput = document.getElementById('sbMainBrief');
  const sbTotalDuration = document.getElementById('sbTotalDuration');
  const sbNumScenes = document.getElementById('sbNumScenes');
  const sbDynamicSceneInfo = document.getElementById('sbDynamicSceneInfo');
  const sbImageModelSelect = document.getElementById('sbImageModel');
  const sbAiModelSelect = document.getElementById('sbAiModel');
  const sbFormula = document.getElementById('sbFormula');
  const sbTiktokStyle = document.getElementById('sbTiktokStyle');
  const sbHookPattern = document.getElementById('sbHookPattern');
  const sbLockConsistency = document.getElementById('sbLockConsistency');
  const btnQuickHookVariations = document.getElementById('btnQuickHookVariations');
  const sbHookVariationsModal = document.getElementById('sbHookVariationsModal');
  const btnCloseHookVariationsModal = document.getElementById('btnCloseHookVariationsModal');
  const sbHookVariationsList = document.getElementById('sbHookVariationsList');
  const sbAdvancedPanel = document.getElementById('sbAdvancedPanel');
  const sbAdvancedToggle = document.getElementById('sbAdvancedToggle');
  const sbAspectBtns = document.querySelectorAll('.sb-aspect-btn');
  const btnGenerateStoryboard = document.getElementById('btnSubmitStoryboard');
  const sbBtnLabel = document.getElementById('sbBtnSubmitLabel');

  // URL Ingest
  const sbVideoUrlInput = null;
  const btnClearUrl = null;
  const btnAnalyzeVideoUrl = null;

  // Section B: Analysis & ATM
  const sbAnalysisCard = document.getElementById('sbAnalysisSection');
  const sbAnalysisAiBadge = document.getElementById('sbAnalysisAiBadge');
  const btnCopyAnalysis = document.getElementById('btnCopyAnalysis');
  const sbHookAnalysisText = document.getElementById('sbHookAnalysisText');
  const sbTargetEmotionText = document.getElementById('sbTargetEmotionText');
  const sbVisualProofText = document.getElementById('sbVisualProofText');
  const sbAnalysisChipsContainer = document.getElementById('sbCoreUspsContainer');

  const sbAtmCard = document.getElementById('sbAtmSection');
  const sbAtmForm = document.getElementById('sbAtmForm');
  const sbAtmFormula = document.getElementById('sbAtmFormula');
  const sbAtmDuration = document.getElementById('sbAtmDuration');
  const sbAtmNotes = document.getElementById('sbAtmNotes');
  const btnSubmitAtmRemix = document.getElementById('btnSubmitAtmRemix');
  const sbAtmBtnLabel = document.getElementById('sbAtmBtnLabel');

  // Section C: Storyboard Output
  const sbOutputSection = document.getElementById('sbScenesSection');
  const sbScenesProjectTitle = document.getElementById('sbScenesProjectTitle');
  const sbCompletedBadge = document.getElementById('sbCompletedCountBadge');
  const sbScenesMetaText = document.getElementById('sbScenesMetaInfo');
  const btnSaveStoryboardProject = document.getElementById('btnSaveStoryboardProject');
  const btnBatchGenerateScenes = document.getElementById('btnBatchGenerateScenes');
  const sbBatchGenLabel = document.getElementById('sbBatchGenLabel');
  const btnCompositeGrid = document.getElementById('btnCompositeGrid');
  const btnCopyAllScenes = document.getElementById('btnCopyAllScenes');
  const btnCopyAllScenesJson = document.getElementById('btnCopyAllScenesJson');
  const btnToggleAllPrompts = document.getElementById('btnToggleAllPrompts');
  const sbTogglePromptsLabel = document.getElementById('sbTogglePromptsLabel');
  const btnCloseScenesSection = document.getElementById('btnCloseScenesSection');
  const sbScenesGrid = document.getElementById('sbScenesList');

  // Section D: 1-Sheet Grid Modal
  const sbCompositeModal = document.getElementById('sbCompositeModal');
  const btnCloseCompositeModal = document.getElementById('btnCloseCompositeModal');
  const sbCompositePromptText = document.getElementById('sbCompositePromptText');
  const btnCopyCompositePrompt = document.getElementById('btnCopyCompositePrompt');
  const sbCompositeAssetCount = document.getElementById('sbCompositeAssetCount');
  const sbCompositeAssetsGrid = document.getElementById('sbCompositeAssetsGrid');
  const btnRefreshCompositePrompt = document.getElementById('btnRefreshCompositePrompt');
  const sbCompositeModelSelect = document.getElementById('sbCompositeModelSelect');
  const sbCompositeRatioSelect = document.getElementById('sbCompositeRatioSelect');
  const btnGenerateCompositeGrid = document.getElementById('btnGenerateCompositeGrid');
  const btnGenerateCompositeLabel = document.getElementById('btnGenerateCompositeLabel');
  const sbCompositeLoadingBox = document.getElementById('sbCompositeLoadingBox');
  const sbCompositeLoadingText = document.getElementById('sbCompositeLoadingText');
  const sbCompositeProgressBar = document.getElementById('sbCompositeProgressBar');
  const sbCompositeResultArea = document.getElementById('sbCompositeResultArea');
  const sbCompositeResultImg = document.getElementById('sbCompositeResultImg');
  const btnDownloadCompositeResult = document.getElementById('btnDownloadCompositeResult');
  const btnOpenCompositeResult = document.getElementById('btnOpenCompositeResult');
  const sbCompositeErrorAlert = document.getElementById('sbCompositeErrorAlert');

  // Section D3: Character Sheet Modal
  const sbCharSheetModal = document.getElementById('sbCharSheetModal');
  const btnOpenCharSheetModal = document.getElementById('btnOpenCharSheetModal');
  const btnOpenCharSheetToolbar = document.getElementById('btnOpenCharSheetToolbar');
  const btnCloseCharSheetModal = document.getElementById('btnCloseCharSheetModal');
  const sbCharSheetPromptText = document.getElementById('sbCharSheetPromptText');
  const btnResetCharSheetPrompt = document.getElementById('btnResetCharSheetPrompt');
  const btnCopyCharSheetPrompt = document.getElementById('btnCopyCharSheetPrompt');
  const sbCharSheetModelSelect = document.getElementById('sbCharSheetModelSelect');
  const sbCharSheetRatioSelect = document.getElementById('sbCharSheetRatioSelect');
  const btnGenerateCharSheet = document.getElementById('btnGenerateCharSheet');
  const btnGenerateCharSheetLabel = document.getElementById('btnGenerateCharSheetLabel');
  const sbCharSheetLoadingBox = document.getElementById('sbCharSheetLoadingBox');
  const sbCharSheetLoadingText = document.getElementById('sbCharSheetLoadingText');
  const sbCharSheetProgressBar = document.getElementById('sbCharSheetProgressBar');
  const sbCharSheetResultArea = document.getElementById('sbCharSheetResultArea');
  const sbCharSheetResultImg = document.getElementById('sbCharSheetResultImg');
  const btnDownloadCharSheetResult = document.getElementById('btnDownloadCharSheetResult');
  const btnOpenCharSheetResult = document.getElementById('btnOpenCharSheetResult');
  const sbCharSheetErrorAlert = document.getElementById('sbCharSheetErrorAlert');
  const sbCharSheetTalentImgPreview = document.getElementById('sbCharSheetTalentImgPreview');
  const sbCharSheetEmptyIcon = document.getElementById('sbCharSheetEmptyIcon');
  const sbCharSheetTalentStatus = document.getElementById('sbCharSheetTalentStatus');
  const sbCharSheetTalentDescText = document.getElementById('sbCharSheetTalentDescText');
  const btnChangeCharSheetTalentImg = document.getElementById('btnChangeCharSheetTalentImg');
  const sbCharSheetFileInput = document.getElementById('sbCharSheetFileInput');
  const btnApplyCharSheetToTalent = document.getElementById('btnApplyCharSheetToTalent');
  let sbCharSheetUploadedAsset = null;
  let sbCharSheetResultUrl = null;

  // Section D4: Product Variations Studio Modal
  const sbProductVariationsModal = document.getElementById('sbProductVariationsModal');
  const btnOpenProdVarsModal = document.getElementById('btnOpenProdVarsModal');
  const btnOpenProdVarsToolbar = document.getElementById('btnOpenProdVarsToolbar');
  const btnCloseProdVarsModal = document.getElementById('btnCloseProdVarsModal');
  const sbProdVarsImgPreview = document.getElementById('sbProdVarsImgPreview');
  const sbProdVarsEmptyIcon = document.getElementById('sbProdVarsEmptyIcon');
  const sbProdVarsStatus = document.getElementById('sbProdVarsStatus');
  const sbProdVarsNameInput = document.getElementById('sbProdVarsNameInput');
  const sbProdVarsDescInput = document.getElementById('sbProdVarsDescInput');
  const sbProdVarsBriefText = document.getElementById('sbProdVarsBriefText');
  const sbProdVarsCountSelect = document.getElementById('sbProdVarsCountSelect');
  const sbProdVarsStrategySelect = document.getElementById('sbProdVarsStrategySelect');
  const sbProdVarsTextModelSelect = document.getElementById('sbProdVarsTextModelSelect');
  const sbProdVarsModelSelect = document.getElementById('sbProdVarsModelSelect');
  const sbProdVarsRatioSelect = document.getElementById('sbProdVarsRatioSelect');
  const btnBuildProdVarsPrompts = document.getElementById('btnBuildProdVarsPrompts');
  const btnTogglePromptsPreview = document.getElementById('btnTogglePromptsPreview');
  const sbProdVarsPromptsContainer = document.getElementById('sbProdVarsPromptsContainer');
  const sbProdVarsPromptsList = document.getElementById('sbProdVarsPromptsList');
  const btnGenerateProductVariations = document.getElementById('btnGenerateProductVariations');
  const btnGenerateProductVariationsLabel = document.getElementById('btnGenerateProductVariationsLabel');
  const sbProdVarsLoadingBox = document.getElementById('sbProdVarsLoadingBox');
  const sbProdVarsProgressBar = document.getElementById('sbProdVarsProgressBar');
  const sbProdVarsLoadingText = document.getElementById('sbProdVarsLoadingText');
  const sbProdVarsResultsArea = document.getElementById('sbProdVarsResultsArea');
  const sbProdVarsResultsGrid = document.getElementById('sbProdVarsResultsGrid');
  const sbProdVarsErrorAlert = document.getElementById('sbProdVarsErrorAlert');
  const sbProdVarsFileInput = document.getElementById('sbProdVarsFileInput');
  const btnChangeProdVarsImg = document.getElementById('btnChangeProdVarsImg');
  let sbProdVarsUploadedAsset = null;
  let sbProdVarsCurrentResults = [];

  // Section E: Saved Storyboards
  const sbSavedProjectsContainer = document.getElementById('sbSavedProjectsContainer');
  const btnClearSbHistory = document.getElementById('btnClearSbHistory');
  const storyboardDeleteConfirmModal = document.getElementById('storyboardDeleteConfirmModal');
  const storyboardDeleteConfirmName = document.getElementById('storyboardDeleteConfirmName');
  const btnCancelStoryboardDelete = document.getElementById('btnCancelStoryboardDelete');
  const btnApproveStoryboardDelete = document.getElementById('btnApproveStoryboardDelete');

  function confirmStoryboardDelete(projectName) {
    return new Promise((resolve) => {
      if (!storyboardDeleteConfirmModal) {
        resolve(window.confirm(`Hapus storyboard "${projectName}"?`));
        return;
      }

      let settled = false;
      const finish = (confirmed) => {
        if (settled) return;
        settled = true;
        storyboardDeleteConfirmModal.classList.add('hidden');
        document.removeEventListener('keydown', handleKeydown);
        resolve(confirmed);
      };
      const handleKeydown = (event) => {
        if (event.key === 'Escape') finish(false);
      };

      storyboardDeleteConfirmName.textContent = projectName;
      storyboardDeleteConfirmModal.classList.remove('hidden');
      btnCancelStoryboardDelete.onclick = () => finish(false);
      btnApproveStoryboardDelete.onclick = () => finish(true);
      storyboardDeleteConfirmModal.querySelector('[data-delete-confirm-cancel]')?.addEventListener('click', () => finish(false), { once: true });
      document.addEventListener('keydown', handleKeydown);
      btnCancelStoryboardDelete.focus();
    });
  }

  function snapshotStoryboardAsset(base64Value, weavyAssetValue, role = 'custom') {
    return snapshotStoryboardAssetHelper(base64Value, weavyAssetValue, role);
  }

  function getStoryboardFormSnapshot() {
    return getStoryboardFormSnapshotHelper({
      sbProductName,
      sbProductDesc,
      sbModelTalent,
      sbBgSetting,
      sbBriefInput,
      sbVideoUrlInput,
      sbTotalDuration,
      sbNumScenes,
      sbFormula,
      sbTiktokStyle,
      sbHookPattern,
      sbLockConsistency,
      sbImageModelSelect,
      sbAiModelSelect,
      currentAspect,
      sbProductRefBase64,
      sbProductWeavyAsset,
      sbModelRefBase64,
      sbModelWeavyAsset,
      sbBgRefBase64,
      sbBgWeavyAsset,
      sbCustomAssets,
    });
  }

  function applyStoryboardReferencePreview(targetRef, emptyStateEl, previewWrapEl, previewImgEl, value) {
    return applyStoryboardReferencePreviewHelper(targetRef, emptyStateEl, previewWrapEl, previewImgEl, value);
  }

  function restoreStoryboardFormState(project) {
    const restored = restoreStoryboardFormStateHelper({
      project,
      currentAspect,
      sbProductName,
      sbProductDesc,
      sbModelTalent,
      sbBgSetting,
      sbBriefInput,
      sbVideoUrlInput,
      btnClearUrl,
      sbTotalDuration,
      sbNumScenes,
      sbFormula,
      sbTiktokStyle,
      sbHookPattern,
      sbLockConsistency,
      sbImageModelSelect,
      sbAiModelSelect,
      sbProductEmptyState,
      sbProductPreviewWrap,
      sbProductImg,
      sbModelEmptyState,
      sbModelPreviewWrap,
      sbModelImg,
      sbBgEmptyState,
      sbBgPreviewWrap,
      sbBgImg,
      sbAspectBtns,
      sbCustomAssets,
    });

    currentAspect = restored.currentAspect;
    sbProductRefBase64 = restored.productRefBase64;
    sbProductWeavyAsset = restored.productWeavyAsset;
    sbModelRefBase64 = restored.modelRefBase64;
    sbModelWeavyAsset = restored.modelWeavyAsset;
    sbBgRefBase64 = restored.bgRefBase64;
    sbBgWeavyAsset = restored.bgWeavyAsset;
    sbCustomAssets = restored.customAssets;
    renderCustomAssetsList();
  }

  async function handleResetStoryboardWorkspace(showFeedback = true) {
    const resetResult = resetStoryboardWorkspaceStateHelper({
      sbProductName,
      sbProductDesc,
      sbModelTalent,
      sbBgSetting,
      sbBriefInput,
      sbVideoUrlInput,
      btnClearUrl,
      sbTotalDuration,
      sbNumScenes,
      sbFormula,
      sbTiktokStyle,
      sbHookPattern,
      sbLockConsistency,
      sbImageModelSelect,
      sbAiModelSelect,
      sbProductEmptyState,
      sbProductPreviewWrap,
      sbProductImg,
      sbModelEmptyState,
      sbModelPreviewWrap,
      sbModelImg,
      sbBgEmptyState,
      sbBgPreviewWrap,
      sbBgImg,
      sbAspectBtns,
      sbDynamicSceneInfo,
      defaultAspect: '9:16',
    });

    currentAspect = resetResult.currentAspect;
    sbProductRefBase64 = resetResult.productRefBase64;
    sbProductWeavyAsset = resetResult.productWeavyAsset;
    sbModelRefBase64 = resetResult.modelRefBase64;
    sbModelWeavyAsset = resetResult.modelWeavyAsset;
    sbBgRefBase64 = resetResult.bgRefBase64;
    sbBgWeavyAsset = resetResult.bgWeavyAsset;
    sbCustomAssets = resetResult.customAssets;
    renderCustomAssetsList();

    if (sbAtmNotes) sbAtmNotes.value = '';

    currentSbProject = null;
    activeSbScene = null;
    sbCompositeResultUrl = null;

    close1SheetGrid();
    hideStoryboardOutputSection();
    sbAnalysisCard?.classList.add('hidden');
    sbAtmCard?.classList.add('hidden');
    if (sbScenesGrid) sbScenesGrid.innerHTML = '';

    try {
      await storage.remove(CURRENT_SB_STORAGE_KEY);
    } catch (_) {}

    if (storyboardCopilotInstance && typeof storyboardCopilotInstance.onProjectUpdated === 'function') {
      try {
        storyboardCopilotInstance.onProjectUpdated(null);
      } catch (_) {}
    }

    if (showFeedback) {
      showAuthAlert('Storyboard & scene berhasil direset. Siap membuat proyek baru!', 'success');
    }
  }

  function showStoryboardOutputSection() {
    if (!sbOutputSection) return;
    sbOutputSection.classList.remove('hidden');
    sbOutputSection.style.removeProperty('display');
  }

  function hideStoryboardOutputSection() {
    if (!sbOutputSection) return;
    sbOutputSection.classList.add('hidden');
    sbOutputSection.style.setProperty('display', 'none', 'important');
  }

  function handleCloseScenesSection() {
    close1SheetGrid();
    hideStoryboardOutputSection();
    sbAnalysisCard?.classList.add('hidden');
    sbAtmCard?.classList.add('hidden');
    showAuthAlert('Breakdown scene ditutup. Kamu bisa membukanya kembali dari daftar riwayat di bawah.', 'info');
  }

  function initStoryboardWorkspaceEvents() {
    initStoryboardCopilotWorkspace();

    // 1. Manual storyboard input
    tabManualIngestBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      tabManualIngestBtn.classList.add('active');
      sbManualPane?.classList.remove('hidden');
      sbManualPane?.classList.add('active');
    });

    // 2. Visual Consistency Uploaders (Product, Model, BG)
    setupUploader(
      sbProductUploadBox,
      sbProductFileInput,
      sbProductEmptyState,
      sbProductPreviewWrap,
      sbProductImg,
      btnChangeProductImg,
      btnDelProductImg,
      (b64, weavyAsset) => {
        sbProductRefBase64 = b64;
        sbProductWeavyAsset = weavyAsset;
      },
      openImageSourcePicker
    );

    setupUploader(
      sbModelUploadBox,
      sbModelFileInput,
      sbModelEmptyState,
      sbModelPreviewWrap,
      sbModelImg,
      btnChangeModelImg,
      btnDelModelImg,
      (b64, weavyAsset) => {
        sbModelRefBase64 = b64;
        sbModelWeavyAsset = weavyAsset;
      },
      openImageSourcePicker
    );

    setupUploader(
      sbBgUploadBox,
      sbBgFileInput,
      sbBgEmptyState,
      sbBgPreviewWrap,
      sbBgImg,
      btnChangeBgImg,
      btnDelBgImg,
      (b64, weavyAsset) => {
        sbBgRefBase64 = b64;
        sbBgWeavyAsset = weavyAsset;
      },
      openImageSourcePicker
    );

    // 3. Custom Assets dynamic handlers
    btnAddCustomAsset?.addEventListener('click', () => {
      const newAsset = {
        id: 'ca_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: '',
        promptDesc: '',
        base64: null,
        weavyAsset: null,
        isUploading: false,
        showCheckmark: false,
      };
      sbCustomAssets.push(newAsset);
      renderCustomAssetsList();
    });

    // 4. Dynamic Scene Estimation Text
    sbTotalDuration?.addEventListener('change', () => updateDynamicSceneTextHelper({
      sbDynamicSceneInfo,
      sbTotalDuration,
      sbNumScenes,
      sbFormula,
    }));
    sbNumScenes?.addEventListener('change', () => updateDynamicSceneTextHelper({
      sbDynamicSceneInfo,
      sbTotalDuration,
      sbNumScenes,
      sbFormula,
    }));
    sbFormula?.addEventListener('change', () => updateDynamicSceneTextHelper({
      sbDynamicSceneInfo,
      sbTotalDuration,
      sbNumScenes,
      sbFormula,
    }));
    updateDynamicSceneTextHelper({
      sbDynamicSceneInfo,
      sbTotalDuration,
      sbNumScenes,
      sbFormula,
    });

    // 5. Aspect Ratio Buttons
    sbAspectBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        sbAspectBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentAspect = btn.getAttribute('data-aspect') || '9:16';
      });
    });

    // 5b. Advanced Settings Toggle
    if (sbAdvancedPanel && sbAdvancedToggle) {
      const setAdvancedPanelState = (expanded) => {
        sbAdvancedPanel.classList.toggle('sb-advanced-panel-collapsed', !expanded);
        sbAdvancedToggle.setAttribute('aria-expanded', String(expanded));
        sbAdvancedToggle.title = expanded ? 'Sembunyikan pengaturan lanjutan' : 'Tampilkan pengaturan lanjutan';
      };

      setAdvancedPanelState(false);
      sbAdvancedToggle.addEventListener('click', () => {
        const expanded = sbAdvancedToggle.getAttribute('aria-expanded') === 'true';
        setAdvancedPanelState(!expanded);
      });
    }

    // 5c. TikTok Hook Variations (A/B Test) Button & Modal
    btnQuickHookVariations?.addEventListener('click', () => {
      handleOpenHookVariationsModal();
    });
    btnCloseHookVariationsModal?.addEventListener('click', () => {
      sbHookVariationsModal?.classList.add('hidden');
    });
    sbHookVariationsModal?.addEventListener('click', (e) => {
      if (e.target === sbHookVariationsModal) {
        sbHookVariationsModal.classList.add('hidden');
      }
    });

    // 6. Form Submission
    sbForm?.addEventListener('submit', handleGenerateStoryboard);

    // 7. Copy Analysis
    btnCopyAnalysis?.addEventListener('click', () => {
      const text = `--- ANALISIS STRATEGI KONTEN & HOOK ---
Hook: ${sbHookAnalysisText?.textContent || '-'}
Target Emosi: ${sbTargetEmotionText?.textContent || '-'}
Visual Proof: ${sbVisualProofText?.textContent || '-'}
Core USPs: ${Array.from(sbAnalysisChipsContainer?.children || []).map(c => c.textContent).join(', ')}`;
      navigator.clipboard.writeText(text);
      showAuthAlert('Analisis strategi konten berhasil disalin!', 'success');
    });

    // 9. ATM Remix Form
    sbAtmForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      handleAtmRemix();
    });

    // 10. Batch Generation & Header Actions
    btnBatchGenerateScenes?.addEventListener('click', handleBatchGenerateScenes);

    let storyboardSaveTimer = null;
    const setStoryboardSaveButtonState = (state, label) => {
      if (!btnSaveStoryboardProject) return;
      const isLoading = state === 'loading';
      const isSuccess = state === 'success';
      btnSaveStoryboardProject.classList.toggle('is-loading', isLoading);
      btnSaveStoryboardProject.classList.toggle('is-success', isSuccess);
      btnSaveStoryboardProject.disabled = isLoading;
      btnSaveStoryboardProject.title = isLoading ? 'Menyimpan proyek storyboard...' : isSuccess ? 'Proyek storyboard berhasil disimpan' : 'Simpan storyboard ini ke daftar proyek';

      const icon = btnSaveStoryboardProject.querySelector('.icon-xs');
      const saveLabel = btnSaveStoryboardProject.querySelector('.sb-save-label');
      if (icon) {
        icon.style.display = isLoading || isSuccess ? 'none' : 'block';
      }
      if (saveLabel) {
        if (isLoading) {
          saveLabel.innerHTML = '<span class="sb-save-loader" aria-hidden="true"></span> Menyimpan...';
        } else if (isSuccess) {
          saveLabel.innerHTML = '<span class="sb-save-success-icon" aria-hidden="true">✓</span> Tersimpan';
        } else {
          saveLabel.textContent = label || 'Simpan';
        }
      }
    };

    btnSaveStoryboardProject?.addEventListener('click', async () => {
      if (!currentSbProject) {
        showAuthAlert('Belum ada storyboard aktif untuk disimpan.', 'error');
        return;
      }

      setStoryboardSaveButtonState('loading', 'Menyimpan...');
      try {
        const result = await handleSaveSbProject(true, true);
        if (result !== false) {
          setStoryboardSaveButtonState('success', 'Tersimpan');
          if (storyboardSaveTimer) clearTimeout(storyboardSaveTimer);
          storyboardSaveTimer = setTimeout(() => {
            setStoryboardSaveButtonState('idle', 'Simpan');
          }, 1700);
        } else {
          setStoryboardSaveButtonState('idle', 'Simpan');
        }
      } catch (error) {
        console.error('[Storyboard Save Error]', error);
        setStoryboardSaveButtonState('idle', 'Simpan');
        showAuthAlert('Gagal menyimpan proyek storyboard.', 'error');
      }
    });
    btnCopyAllScenes?.addEventListener('click', handleCopyAllSbPrompts);
    btnCopyAllScenesJson?.addEventListener('click', handleCopyAllSbJson);
    btnResetStoryboard?.addEventListener('click', (e) => {
      e.preventDefault();
      handleResetStoryboardWorkspace(true);
    });
    btnCloseScenesSection?.addEventListener('click', (e) => {
      e.preventDefault();
      handleCloseScenesSection();
    });

    let promptsVisible = false;
    btnToggleAllPrompts?.addEventListener('click', () => {
      promptsVisible = !promptsVisible;
      sbScenesGrid?.querySelectorAll('.sb-prompt-box').forEach((box) => {
        if (promptsVisible) {
          box.classList.add('expanded');
        } else {
          box.classList.remove('expanded');
        }
      });
      if (sbTogglePromptsLabel) {
        sbTogglePromptsLabel.textContent = promptsVisible ? 'Tutup Prompt' : 'Prompt';
      }
    });

    // 11. 1-Sheet Grid Inline Panel (Toggle Open/Close with Icon)
    btnCompositeGrid?.addEventListener('click', (e) => {
      e.preventDefault();
      toggle1SheetGrid();
    });

    btnCloseCompositeModal?.addEventListener('click', (e) => {
      e.preventDefault();
      close1SheetGrid();
    });

    btnCopyCompositePrompt?.addEventListener('click', () => {
      if (sbCompositePromptText && sbCompositePromptText.value) {
        navigator.clipboard.writeText(sbCompositePromptText.value);
        showAuthAlert('Prompt 1-Sheet Master berhasil disalin!', 'success');
      }
    });

    btnRefreshCompositePrompt?.addEventListener('click', () => {
      generateMaster1SheetPrompt(true);
      showAuthAlert('Master prompt 1-sheet berhasil disinkronkan kembali dari alur scene!', 'info');
    });

    sbCompositeRatioSelect?.addEventListener('change', () => {
      generateMaster1SheetPrompt(true);
      showAuthAlert(`Format prompt 1-sheet disesuaikan ke rasio ${sbCompositeRatioSelect.value}!`, 'info');
    });

    btnGenerateCompositeGrid?.addEventListener('click', () => {
      execute1SheetGeneration();
    });

    // 11b. Character Sheet Modal Handlers
    btnOpenCharSheetModal?.addEventListener('click', (e) => {
      e.preventDefault();
      openCharSheetModal();
    });

    btnOpenCharSheetToolbar?.addEventListener('click', (e) => {
      e.preventDefault();
      openCharSheetModal();
    });

    btnCloseCharSheetModal?.addEventListener('click', (e) => {
      e.preventDefault();
      closeCharSheetModal();
    });

    sbCharSheetModal?.addEventListener('click', (e) => {
      if (e.target === sbCharSheetModal) {
        closeCharSheetModal();
      }
    });

    btnResetCharSheetPrompt?.addEventListener('click', () => {
      if (sbCharSheetPromptText) {
        sbCharSheetPromptText.value = DEFAULT_CHARACTER_SHEET_PROMPT;
        showAuthAlert('Prompt Karakter Sheet direset ke format standar!', 'info');
      }
    });

    btnCopyCharSheetPrompt?.addEventListener('click', () => {
      if (sbCharSheetPromptText && sbCharSheetPromptText.value) {
        navigator.clipboard.writeText(sbCharSheetPromptText.value);
        showAuthAlert('Prompt Karakter Sheet berhasil disalin!', 'success');
      }
    });

    btnChangeCharSheetTalentImg?.addEventListener('click', () => {
      if (openImageSourcePicker) {
        openImageSourcePicker({
          fileInput: sbCharSheetFileInput,
          onLibraryAsset: (asset) => {
            const imageUrl = asset.thumbnailUrl || asset.url;
            sbCharSheetUploadedAsset = asset;
            if (sbCharSheetTalentImgPreview) {
              sbCharSheetTalentImgPreview.src = imageUrl;
              sbCharSheetTalentImgPreview.classList.remove('hidden');
            }
            if (sbCharSheetEmptyIcon) sbCharSheetEmptyIcon.classList.add('hidden');
            if (sbCharSheetTalentStatus) {
              sbCharSheetTalentStatus.textContent = 'Foto Terpilih';
              sbCharSheetTalentStatus.className = 'sb-asset-badge';
            }
          },
        });
      } else {
        sbCharSheetFileInput?.click();
      }
    });

    sbCharSheetFileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const b64 = evt.target.result;
        sbCharSheetUploadedAsset = { base64: b64, name: file.name || 'talent.png' };
        if (sbCharSheetTalentImgPreview) {
          sbCharSheetTalentImgPreview.src = b64;
          sbCharSheetTalentImgPreview.classList.remove('hidden');
        }
        if (sbCharSheetEmptyIcon) sbCharSheetEmptyIcon.classList.add('hidden');
        if (sbCharSheetTalentStatus) {
          sbCharSheetTalentStatus.textContent = 'Foto Terpilih';
          sbCharSheetTalentStatus.className = 'sb-asset-badge';
        }
      };
      reader.readAsDataURL(file);
    });

    btnGenerateCharSheet?.addEventListener('click', () => {
      executeCharSheetGeneration();
    });

    btnApplyCharSheetToTalent?.addEventListener('click', () => {
      applyCharSheetToTalent();
    });

    // 11c. Product Variations Studio Modal Handlers
    btnOpenProdVarsModal?.addEventListener('click', (e) => {
      e.preventDefault();
      openProductVariationsModal();
    });

    btnOpenProdVarsToolbar?.addEventListener('click', (e) => {
      e.preventDefault();
      openProductVariationsModal();
    });

    btnCloseProdVarsModal?.addEventListener('click', (e) => {
      e.preventDefault();
      closeProductVariationsModal();
    });

    sbProductVariationsModal?.addEventListener('click', (e) => {
      if (e.target === sbProductVariationsModal) {
        closeProductVariationsModal();
      }
    });

    // Preset Chips
    sbProductVariationsModal?.querySelectorAll('.sb-preset-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const presetVal = chip.getAttribute('data-preset') || '';
        if (sbProdVarsBriefText) {
          sbProdVarsBriefText.value = presetVal;
          showAuthAlert(`Konsep preset dipilih: ${chip.textContent}`, 'info');
        }
      });
    });

    btnBuildProdVarsPrompts?.addEventListener('click', () => {
      handleBuildProductVariationPrompts();
    });

    btnTogglePromptsPreview?.addEventListener('click', () => {
      if (sbProdVarsPromptsContainer) {
        sbProdVarsPromptsContainer.classList.toggle('hidden');
      }
    });

    btnChangeProdVarsImg?.addEventListener('click', () => {
      if (openImageSourcePicker) {
        openImageSourcePicker({
          fileInput: sbProdVarsFileInput,
          onLibraryAsset: (asset) => {
            const imageUrl = asset.thumbnailUrl || asset.url;
            sbProdVarsUploadedAsset = asset;
            if (sbProdVarsImgPreview) {
              sbProdVarsImgPreview.src = imageUrl;
              sbProdVarsImgPreview.classList.remove('hidden');
            }
            if (sbProdVarsEmptyIcon) sbProdVarsEmptyIcon.classList.add('hidden');
            if (sbProdVarsStatus) {
              sbProdVarsStatus.textContent = 'Foto Terpilih';
              sbProdVarsStatus.className = 'sb-asset-badge';
            }
          },
        });
      } else {
        sbProdVarsFileInput?.click();
      }
    });

    sbProdVarsFileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const b64 = evt.target.result;
        sbProdVarsUploadedAsset = { base64: b64, name: file.name || 'product.png' };
        if (sbProdVarsImgPreview) {
          sbProdVarsImgPreview.src = b64;
          sbProdVarsImgPreview.classList.remove('hidden');
        }
        if (sbProdVarsEmptyIcon) sbProdVarsEmptyIcon.classList.add('hidden');
        if (sbProdVarsStatus) {
          sbProdVarsStatus.textContent = 'Foto Terpilih';
          sbProdVarsStatus.className = 'sb-asset-badge';
        }
      };
      reader.readAsDataURL(file);
    });

    btnGenerateProductVariations?.addEventListener('click', () => {
      executeProductVariationsGeneration();
    });

    // Delegation on Results Grid
    sbProdVarsResultsGrid?.addEventListener('click', (e) => {
      const card = e.target.closest('.sb-prodvar-card');
      const selectProdBtn = e.target.closest('.btn-select-prodvar');
      const setBgBtn = e.target.closest('.btn-set-bg-prodvar');

      if (selectProdBtn) {
        e.stopPropagation();
        const idx = parseInt(selectProdBtn.getAttribute('data-index') || '1', 10);
        applyProductVariationToProductHelper(idx, {
          sbProductRefBase64,
          sbProductWeavyAsset,
          showAuthAlert,
        });
        return;
      }

      if (setBgBtn) {
        e.stopPropagation();
        const idx = parseInt(setBgBtn.getAttribute('data-index') || '1', 10);
        applyProductVariationToBackgroundHelper(idx, {
          sbBgRefBase64,
          sbBgWeavyAsset,
          showAuthAlert,
        });
        return;
      }

      if (card) {
        const idx = parseInt(card.getAttribute('data-index') || '1', 10);
        selectWinnerProductVariationHelper(idx, { showAuthAlert });
      }
    });

    // Delegation for copying variation prompt
    sbProdVarsPromptsList?.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.btn-copy-var-prompt');
      if (copyBtn) {
        const idx = copyBtn.getAttribute('data-index');
        const ta = document.getElementById(`sbProdVarPromptInput_${idx}`);
        if (ta && ta.value) {
          navigator.clipboard.writeText(ta.value);
          showAuthAlert(`Prompt Variasi #${idx} berhasil disalin!`, 'success');
        }
      }
    });

    // 12. Clear History
    btnClearSbHistory?.addEventListener('click', handleClearSbHistory);
  }

  function getStoryboardCopilotContext() {
    return getStoryboardCopilotContextHelper({
      currentSbProject,
      activeSbScene,
      sbProductName,
      sbProductDesc,
      sbModelTalent,
      sbBgSetting,
      sbBriefInput,
      sbTotalDuration,
      sbNumScenes,
      sbFormula,
      currentAspect,
      sbCustomAssets,
      sbCompositeResultUrl,
      sbProductWeavyAsset,
      sbProductRefBase64,
      sbModelWeavyAsset,
      sbModelRefBase64,
      sbBgWeavyAsset,
      sbBgRefBase64,
    });
  }

  function getStoryboardCopilotImages() {
    return getStoryboardCopilotImagesHelper({
      activeSbScene,
      sbCustomAssets,
      sbCompositeResultUrl,
      sbProductWeavyAsset,
      sbProductRefBase64,
      sbModelWeavyAsset,
      sbModelRefBase64,
      sbBgWeavyAsset,
      sbBgRefBase64,
      currentSbProject,
    });
  }

  async function sendStoryboardCopilotMessage({ text, history, context, images = [], model, session = null, onStatus, onAttachImages }) {
    // Clear stale create-project / scene request before a new storyboard chat starts.
    // Otherwise an older pending request can reopen the confirmation modal after a new prompt.
    resetStoryboardCreateRequestState();
    const generateModal = document.getElementById('storyboardGenerateConfirmModal');
    if (generateModal) {
      generateModal.classList.add('hidden');
      generateModal.style.setProperty('display', 'none', 'important');
    }
    const createModal = document.getElementById('storyboardCreateProjectModal');
    if (createModal) {
      createModal.classList.add('hidden');
      createModal.style.setProperty('display', 'none', 'important');
    }
    activeSbScene = null;

    const effectiveModel = model || chatModelSelect?.value || 'google/gemini-2.5-flash';
    const isDolaCopilot = effectiveModel.startsWith('dola/');
    const isGeminiCopilot = effectiveModel.startsWith('gemini/') || document.getElementById('storyboardCopilotProviderSelect')?.value === 'gemini';

    const acc = getActiveAccount();
    if (!acc && !isDolaCopilot && !isGeminiCopilot) {
      switchTab('settings');
      throw new Error('Silakan hubungkan akun terlebih dahulu.');
    }

    const idToken = (!isDolaCopilot && !isGeminiCopilot && acc) ? await getValidIdToken(acc) : null;
    const contextText = JSON.stringify(context, null, 2);

    const normalizeImageKey = (img) => {
      if (!img) return '';
      const raw = img.url || img.base64 || img.thumbnailUrl || img.downloadUrl || img.src || '';
      if (raw.startsWith('data:')) {
        return `data:${raw.length}_${raw.slice(0, 60)}_${raw.slice(-30)}`;
      }
      if (raw.startsWith('http')) {
        return raw.split('?')[0];
      }
      return img.id || img.name || raw;
    };

    const mergedImages = [];
    const imageKeys = new Set();
    const historyImages = (history || []).flatMap((msg) => msg.attachments || []);
    [...images, ...historyImages, ...getStoryboardCopilotImages()].forEach((image) => {
      const key = normalizeImageKey(image);
      if (!key || imageKeys.has(key)) return;
      imageKeys.add(key);
      mergedImages.push(image);
    });

    // Dola chat handles uploads per turn directly into the browser tab.
    // Only send freshly attached images from the current turn (deduplicated),
    // and never re-upload background storyboard assets repeatedly on every turn.
    const dolaTurnImages = [];
    const dolaImageKeys = new Set();
    (images || []).forEach((img) => {
      const key = normalizeImageKey(img);
      if (!key || dolaImageKeys.has(key)) return;
      dolaImageKeys.add(key);
      dolaTurnImages.push(img);
    });

    // Fallback: Jika turn saat ini tidak membawa gambar terlampir langsung, sertakan gambar referensi produk utama dari form Storyboard atau sesi chat aktif
    if (dolaTurnImages.length === 0) {
      if (sbProductRefBase64) {
        const key = normalizeImageKey({ base64: sbProductRefBase64 });
        if (key && !dolaImageKeys.has(key)) {
          dolaImageKeys.add(key);
          dolaTurnImages.push({
            type: 'image',
            base64: sbProductRefBase64,
            url: sbProductWeavyAsset?.url || (sbProductRefBase64.startsWith('http') ? sbProductRefBase64 : ''),
            name: sbProductName?.value || 'Referensi Produk Utama',
          });
        }
      }
      const activeChatForFallback = getCurrentChatSession(chatSessions, currentSessionId);
      if (activeChatForFallback) {
        try {
          const { mediaList } = buildSessionMediaCatalog(activeChatForFallback);
          (mediaList || []).filter((m) => m.type === 'image').slice(0, 3).forEach((m) => {
            if (dolaTurnImages.length >= 3) return;
            const key = normalizeImageKey(m);
            if (key && !dolaImageKeys.has(key)) {
              dolaImageKeys.add(key);
              dolaTurnImages.push({
                type: 'image',
                name: m.name || 'Input Chat',
                url: m.url || '',
                base64: m.base64 || (m.url?.startsWith('data:') ? m.url : ''),
              });
            }
          });
        } catch (_) {}
      }
    }

    // Detect links (TikTok, YouTube, Reels, Shopee, Tokopedia, Web)
    const ecomLinks = detectEcommerceProductLinks(text);
    const hasExplicitLinkAnalysisIntent = /(analisis|review|insight|audit|cek|pelajari|detail.*produk|value prop|pain point|target.*buyer|menganalisis|evaluasi|breakdown|cara pakai|benefit)/i.test(text);
    let scrapingContext = null;

    if (ecomLinks && ecomLinks.length > 0 && !hasExplicitLinkAnalysisIntent) {
      if (typeof onStatus === 'function') {
        await onStatus('🔎 Link produk terdeteksi. Saya akan mengirimkan konteks link ke provider agar analisis produk dilakukan sebelum draft storyboard dibuat.');
      }
    }

    if (ecomLinks && ecomLinks.length > 0) {
      if (typeof onStatus === 'function') {
        await onStatus('🔍 Sedang membaca & mengekstrak data dari tautan via live oEmbed...');
      }

      const enrichedLinks = await resolveLinksMetadata(ecomLinks);
      scrapingContext = formatScrapingContext(enrichedLinks);

      // If links contain cover thumbnails or extracted product gallery images, attach as reference images for visual analysis
      const candidateThumbnails = [];
      enrichedLinks.forEach((l) => {
        if (!l.metadata) return;
        if (Array.isArray(l.metadata.images) && l.metadata.images.length > 0) {
          l.metadata.images.forEach((imgObj, idx) => {
            const imgUrl = typeof imgObj === 'string' ? imgObj : imgObj.url;
            if (imgUrl && !candidateThumbnails.some((t) => t.url === imgUrl)) {
              candidateThumbnails.push({
                type: 'image',
                name: (typeof imgObj === 'object' && imgObj.title) ? imgObj.title : (idx === 0 ? `Cover ${l.platform}` : `Foto Produk ${idx + 1}`),
                url: imgUrl,
                thumbnailUrl: imgUrl,
                referenceRole: 'product',
              });
            }
          });
        } else if (l.metadata.thumbnail_url) {
          if (!candidateThumbnails.some((t) => t.url === l.metadata.thumbnail_url)) {
            candidateThumbnails.push({
              type: 'image',
              name: `Cover ${l.platform} (${l.metadata.author_name || 'Video'})`,
              url: l.metadata.thumbnail_url,
              thumbnailUrl: l.metadata.thumbnail_url,
              referenceRole: 'product',
            });
          }
        }
      });

      const autoThumbnails = await filterValidImageObjects(candidateThumbnails, 3000);

      if (autoThumbnails.length > 0) {
        autoThumbnails.forEach((t) => {
          const key = normalizeImageKey(t);
          if (key && !imageKeys.has(key)) {
            imageKeys.add(key);
            mergedImages.push(t);
          }
          if (key && !dolaImageKeys.has(key)) {
            dolaImageKeys.add(key);
            dolaTurnImages.push(t);
          }
        });
        if (typeof onAttachImages === 'function') {
          onAttachImages(autoThumbnails);
        }
      }
    }

    // Hanya tangani query utilitas offline murni (seperti estimasi biaya/koin atau riwayat revisi) secara lokal tanpa memanggil AI
    const isPureOfflineQuery = /(berapa|estimasi).*(budget|biaya|koin)|(riwayat|history).*revisi/i.test(text);
    if (!isDolaCopilot && isPureOfflineQuery && (!ecomLinks || ecomLinks.length === 0)) {
      const localIntentAction = buildStoryboardCopilotIntentAction({
        text,
        currentSbProject,
        currentAspect,
        sbProductName,
        sbProductDesc,
        sbModelTalent,
        sbBgSetting,
        sbBriefInput,
        sbTotalDuration,
        sbNumScenes,
        sbFormula,
        sbAiModelSelect,
        sbImageModelSelect,
        currentCredits: getActiveAccount()?.credits ?? 0,
        recommendStoryboardImageModel,
      }, mergedImages);
      if (localIntentAction && ['budget_estimate', 'revision_history'].includes(localIntentAction.type)) {
        return localIntentAction.text;
      }
    }

    // Ambil konteks analisis produk terakhir dari Menu Chat jika ada
    const activeChat = getCurrentChatSession(chatSessions, currentSessionId);
    let chatAnalysisContext = '';
    if (activeChat && Array.isArray(activeChat.messages) && activeChat.messages.length > 0) {
      const recentAssistantMsgs = activeChat.messages
        .filter((m) => m.role === 'assistant' && m.content)
        .slice(-2)
        .map((m) => m.content)
        .join('\n---\n');
      if (recentAssistantMsgs) {
        chatAnalysisContext = `\n\n[Hasil Analisis Produk Terakhir dari Chat]:\n${recentAssistantMsgs.slice(0, 2000)}`;
      }
    }

    const systemPrompt = `[Storyboard Copilot System]
Kamu adalah asisten sutradara kreatif storyboard AI yang bertindak sebagai partner kreatif yang ramah, santai, dan solutif.
Fokus pada project storyboard, materi referensi visual (talent, produk, background), dan materi video/link yang sedang dibahas.
Jika user menyertakan tautan produk/marketplace, WAJIB melakukan analisis produk dari link tersebut dulu sebelum membuat draft storyboard, scene, update visual, atau rekomendasi. Jangan langsung membuat scene sebelum analisis selesai.
PERATURAN WAJIB PADA ANALISIS LINK PRODUK:
- JANGAN pernah menampilkan CTA, nomor WhatsApp, link bio, atau nama marketplace di analisis, headline, on-screen text, voice-over, prompt visual, atau rekomendasi.
- Fokus pada value prop, pain point, target pembeli, angle visual, tone brand, dan positioning produk.
- Jika perlu menyebut channel kontak, gunakan bentuk umum yang tidak spesifik dan tidak mengarah ke CTA pembelian eksternal.
- Hindari semua referensi ke marketplace, link bio, atau kontak langsung di semua jawaban.
Bantu revisi hook, alur scene, durasi, angle kamera, visual, voice-over, dan prompt agar storyboard terasa lebih kuat dan konsisten tanpa mengandalkan CTA atau arahan kontak eksternal.
Jawab dalam Bahasa Indonesia yang natural, ringkas, bersahabat, dan jelas. Hindari bahasa kaku.

PANDUAN OUTPUT:
1. Selalu berikan analisis atau tanggapan dalam teks percakapan biasa (Bahasa Indonesia).
2. Jika ada aksi teknis storyboard (draft project, update scene, atau render visual), sertakan JSON aksi HANYA di akhir pesan di dalam blok kode \`\`\`json ... \`\`\`.
3. JANGAN PERNAH menampilkan raw JSON secara telanjang tanpa penjelasan kepada pengguna. Pastikan selalu membungkus blok JSON dengan \`\`\`json dan \`\`\` di akhir.

Format Aksi Teknis (di dalam blok \`\`\`json ... \`\`\`):
- Jika merekomendasikan/membuat draft project baru (bisa menyertakan detail scenes di dalamnya):
\`\`\`json
{"action":"create_storyboard_project","reason":"Alasan draft","project":{"title":"...","productName":"...","productDesc":"...","modelTalent":"...","bgSetting":"...","brief":"...","duration":10,"numScenes":4,"formula":"hook_extreme","aspectRatio":"9:16","aiModel":"google/gemini-2.5-flash","imageModel":"GPT Image 2.5","references":{"product":["@ref1"],"model":["@ref2"],"background":["@ref3"],"custom":[]},"scenes":[{"sceneNumber":1,"title":"...","cameraAngle":"...","visualDescription":"...","voiceover":"...","onScreenText":"...","imagePrompt":"...","videoPrompt":"..."}]}}
\`\`\`

- Jika mengupdate/membuat scene spesifik:
\`\`\`json
{"action":"update_scenes","scenes":[{"sceneNumber":1,"title":"...","cameraAngle":"...","visualDescription":"...","voiceover":"...","onScreenText":"...","imagePrompt":"...","videoPrompt":"..."}]}
\`\`\`

- Jika merekomendasikan generate visual scene:
\`\`\`json
{"action":"generate_scene","sceneNumber":1,"modelId":"gpt_image_2_5","reason":"Alasan pemilihan model"}
\`\`\`

PEMANFAATAN SMART ASSET LIBRARY:
- Utamakan dan sebutkan aset yang diunggah/tersedia (misal: "Rendi", "Kemasan Benih Seribuan") sebagai referensi visual agar konsisten di seluruh adegan.

[Konteks Storyboard]
${contextText}`;

    const referenceCatalog = mergedImages.slice(0, 5).map((image, index) => {
      const role = image.referenceRole || image.role || 'custom';
      const roleLabel = {
        product: 'Produk',
        model: 'Model / Talent',
        background: 'Background / Setting',
        custom: 'Asset tambahan',
      }[role] || 'Asset tambahan';
      return `- @ref${index + 1}: ${image.name || `Referensi ${index + 1}`} (${roleLabel})`;
    }).join('\n');

    let resultText = '';
    let dolaMeta = null;
    if (isGeminiCopilot) {
      const activeAcc = getActiveAccount();
      const geminiApiKey = (activeAcc && activeAcc.provider === 'gemini') ? (activeAcc.apiKey || null) : null;
      resultText = await executeGeminiChat({
        apiKey: geminiApiKey,
        model: effectiveModel,
        prompt: `${systemPrompt ? `[Instruksi Sistem]\n${systemPrompt}\n\n` : ''}${text}\n\n[Visual References]\n${referenceCatalog || 'Tidak ada referensi visual tambahan.'}\n\n[Konteks terbaru]\n${contextText}${chatAnalysisContext}`,
        history: (history || []).map((message) => ({
          role: message.role,
          content: message.content,
        })),
        referenceAssets: mergedImages.slice(0, 3),
        onProgress: (pct, msg) => {
          if (typeof onStatus === 'function') onStatus(`✨ Google Gemini: ${msg}`);
        },
      });
    } else if (isDolaCopilot) {
      const isPro = effectiveModel === 'dola/pro';
      const effectiveConvId = session?.dolaConvId || activeChat?.dolaConvId || null;
      const dolaRes = await executeDolaChat({
        prompt: `${systemPrompt ? `[Instruksi Sistem]\n${systemPrompt}\n\n` : ''}${text}\n\n[Visual References]\n${referenceCatalog || 'Tidak ada referensi visual tambahan.'}\n\n[Konteks terbaru]\n${contextText}${chatAnalysisContext}`,
        isPro,
        history: (history || []).map((message) => ({
          role: message.role,
          content: message.content,
        })),
        referenceAssets: dolaTurnImages.slice(0, 3),
        conversationId: effectiveConvId,
        lastSectionId: session?.dolaSectionId || null,
        lastMessageIndex: session?.dolaMessageIndex || null,
        onProgress: (pct, msg) => {
          if (typeof onStatus === 'function') onStatus(`⚡ Dola AI (${isPro ? 'Pro' : 'Fast'}): ${msg}`);
        },
      });
      if (dolaRes && typeof dolaRes === 'object') {
        if (dolaRes.convId) {
          dolaMeta = {
            convId: dolaRes.convId,
            sectionId: dolaRes.sectionId,
            msgIndex: typeof dolaRes.msgIndex === 'number' ? dolaRes.msgIndex + 2 : null,
          };
          if (session) {
            session.dolaConvId = dolaRes.convId;
            session.dolaSectionId = dolaRes.sectionId;
            session.dolaMessageIndex = dolaMeta.msgIndex;
          }
        }
        resultText = dolaRes.text || String(dolaRes);
      } else {
        resultText = dolaRes || '';
      }
    } else {
      resultText = await callWeavyLLM({
        prompt: `${text}\n\n[Visual References]\n${referenceCatalog || 'Tidak ada referensi visual tambahan.'}\n\n[Konteks terbaru]\n${contextText}`,
        model: effectiveModel,
        idToken,
        refreshToken: acc?.refreshToken,
        history: (history || []).map((message) => ({
          role: message.role,
          content: message.content,
        })),
        images: mergedImages.slice(0, 5),
        mediaCatalog: null,
        scrapingContext,
        systemPrompt,
      });
    }

    const { cleanText, action: extractedAction } = extractStoryboardCopilotAction(resultText);

    if (extractedAction) {
      if (extractedAction.action === 'create_storyboard_project' || extractedAction.type === 'create_storyboard_project') {
        const smartRefs = buildSmartReferencesMapping(mergedImages.slice(0, 5));
        const mergedProjectRefs = {
          ...smartRefs,
          ...(extractedAction.project?.references || {}),
        };
        ['product', 'model', 'background', 'custom'].forEach((key) => {
          if (!mergedProjectRefs[key] || mergedProjectRefs[key].length === 0) {
            if (smartRefs[key] && smartRefs[key].length > 0) {
              mergedProjectRefs[key] = smartRefs[key];
            }
          }
        });

        const projectPayload = {
          ...(extractedAction.project || {}),
          references: mergedProjectRefs,
        };

        const actionPayload = {
          ...extractedAction,
          project: projectPayload,
          referenceImages: mergedImages.slice(0, 5),
          rawText: cleanText || resultText,
        };

        const formattedStoryboardMarkdown = (cleanText ? `${cleanText}\n\n` : '') + `\`\`\`storyboard_project\n${JSON.stringify(projectPayload, null, 2)}\n\`\`\``;
        return {
          text: formattedStoryboardMarkdown,
          action: actionPayload,
        };
      }

      if (extractedAction.action === 'update_scenes' || Array.isArray(extractedAction.scenes)) {
        const updateSummary = await applyStoryboardCopilotSceneUpdate(extractedAction, cleanText, mergedImages.slice(0, 5));
        return updateSummary;
      }

      if (extractedAction.action === 'generate_scene' || extractedAction.action === 'generate_scenes') {
        handleStoryboardCopilotGenerateRequest(extractedAction);
        return cleanText || 'Permintaan render visual scene sudah disiapkan. Silakan periksa model pada popup konfirmasi.';
      }
    }

    return cleanText || resultText;
  }

  async function applyStoryboardCopilotSceneUpdate(rawResponseOrAction, cleanText = '', referenceImages = []) {
    let parsed = typeof rawResponseOrAction === 'object' && rawResponseOrAction !== null
      ? rawResponseOrAction
      : null;

    if (!parsed && typeof rawResponseOrAction === 'string') {
      const { action } = extractStoryboardCopilotAction(rawResponseOrAction);
      parsed = action;
    }

    const isSceneUpdate = parsed && (
      parsed.action === 'update_scenes' ||
      (!parsed.action && Array.isArray(parsed.scenes))
    );
    if (!isSceneUpdate || !Array.isArray(parsed.scenes)) {
      return cleanText || 'Tidak ada scene yang perlu diperbarui.';
    }

    const allowedFields = [
      'title',
      'timecode',
      'durationSec',
      'cameraAngle',
      'visualDescription',
      'voiceover',
      'onScreenText',
      'imagePrompt',
      'videoPrompt',
    ];

    // If a project already exists on the canvas with scenes:
    if (currentSbProject?.scenes && currentSbProject.scenes.length > 0) {
      let appliedCount = 0;
      parsed.scenes.forEach((patch) => {
        const scene = currentSbProject.scenes.find((item) => (
          (patch.id && item.id === patch.id) ||
          (patch.sceneNumber && item.sceneNumber === Number(patch.sceneNumber))
        ));
        if (!scene) return;

        let changed = false;
        allowedFields.forEach((field) => {
          if (patch[field] === undefined || patch[field] === null) return;
          const nextValue = field === 'durationSec' ? Number(patch[field]) : String(patch[field]);
          if (nextValue !== scene[field]) {
            scene[field] = nextValue;
            changed = true;
          }
        });

        if (changed) {
          appliedCount += 1;
          if (activeSbScene?.id === scene.id) activeSbScene = scene;
        }
      });

      if (appliedCount > 0) {
        renderStoryboardProject(currentSbProject);
        await handleSaveSbProject(false);
        showAuthAlert(`${appliedCount} scene berhasil diperbarui oleh Copilot.`, 'success');
        return cleanText
          ? `${cleanText}\n\n✅ **${appliedCount} Scene berhasil diperbarui di Storyboard!**`
          : `✅ **${appliedCount} Scene berhasil diperbarui langsung di Storyboard.** Card scene dan prompt sudah tersimpan.`;
      }
    }

    // If no project exists yet on the canvas, build and render a new storyboard from these scenes!
    const nlpParams = extractStoryboardParamsFromText(cleanText || (typeof rawResponseOrAction === 'string' ? rawResponseOrAction : ''));
    const productName = parsed.productName || parsed.title || nlpParams.productName || sbProductName?.value || 'Storyboard Project';
    const productDesc = parsed.productDesc || parsed.description || parsed.desc || nlpParams.productDesc || sbProductDesc?.value || '';
    const modelTalent = parsed.modelTalent || parsed.talent || parsed.model || nlpParams.modelTalent || sbModelTalent?.value || '';
    const bgSetting = parsed.bgSetting || parsed.background || parsed.setting || nlpParams.bgSetting || sbBgSetting?.value || '';
    const brief = parsed.brief || parsed.creativeBrief || parsed.concept || nlpParams.brief || sbBriefInput?.value || '';
    const totalDuration = Number(parsed.duration || nlpParams.duration || sbTotalDuration?.value || 10);
    const scenesCount = Number(parsed.numScenes || nlpParams.numScenes || parsed.scenes.length || 4);
    const effectiveAspect = parsed.aspectRatio || nlpParams.aspectRatio || currentAspect || '9:16';
    const effectiveFormula = parsed.formula || nlpParams.formula || sbFormula?.value || 'hook_extreme';

    if (Array.isArray(referenceImages) && referenceImages.length > 0) {
      const productImage = getReferenceByRole('product', parsed, referenceImages);
      const modelImage = getReferenceByRole('model', parsed, referenceImages);
      const backgroundImage = getReferenceByRole('background', parsed, referenceImages);
      if (productImage) {
        const productAsset = getCopilotReferenceAsset(productImage);
        sbProductRefBase64 = productAsset?.base64 || null;
        sbProductWeavyAsset = productAsset?.weavyAsset || null;
        applyStoryboardReferencePreview(
          { base64: sbProductRefBase64, weavyAsset: sbProductWeavyAsset },
          sbProductEmptyState,
          sbProductPreviewWrap,
          sbProductImg,
          { base64: sbProductRefBase64, weavyAsset: sbProductWeavyAsset }
        );
      }
      if (modelImage) {
        const modelAsset = getCopilotReferenceAsset(modelImage);
        sbModelRefBase64 = modelAsset?.base64 || null;
        sbModelWeavyAsset = modelAsset?.weavyAsset || null;
        applyStoryboardReferencePreview(
          { base64: sbModelRefBase64, weavyAsset: sbModelWeavyAsset },
          sbModelEmptyState,
          sbModelPreviewWrap,
          sbModelImg,
          { base64: sbModelRefBase64, weavyAsset: sbModelWeavyAsset }
        );
      }
      if (backgroundImage) {
        const backgroundAsset = getCopilotReferenceAsset(backgroundImage);
        sbBgRefBase64 = backgroundAsset?.base64 || null;
        sbBgWeavyAsset = backgroundAsset?.weavyAsset || null;
        applyStoryboardReferencePreview(
          { base64: sbBgRefBase64, weavyAsset: sbBgWeavyAsset },
          sbBgEmptyState,
          sbBgPreviewWrap,
          sbBgImg,
          { base64: sbBgRefBase64, weavyAsset: sbBgWeavyAsset }
        );
      }
    }

    if (sbProductName) sbProductName.value = productName;
    if (sbProductDesc) sbProductDesc.value = productDesc;
    if (sbModelTalent) sbModelTalent.value = modelTalent;
    if (sbBgSetting) sbBgSetting.value = bgSetting;
    if (sbBriefInput) sbBriefInput.value = brief;
    if (sbTotalDuration) sbTotalDuration.value = String(totalDuration);
    if (sbNumScenes) sbNumScenes.value = String(scenesCount);
    if (sbFormula) sbFormula.value = effectiveFormula;
    currentAspect = effectiveAspect;
    sbAspectBtns.forEach((button) => {
      button.classList.toggle('active', button.dataset.aspect === currentAspect);
    });

    const newProject = parseStoryboardOutputToProject({
      rawOutput: {
        scenes: parsed.scenes,
        metadata: {
          title: productName,
          duration: totalDuration,
          aspectRatio: effectiveAspect,
        },
      },
      productName,
      productDesc,
      modelTalent,
      bgSetting,
      brief,
      targetSceneCount: scenesCount,
      duration: totalDuration,
      aspectRatio: effectiveAspect,
      formula: effectiveFormula,
      aiModel: sbAiModelSelect?.value || 'google/gemini-2.5-flash',
      imageModel: sbImageModelSelect?.value || 'GPT Image 2.5',
    });

    currentSbProject = newProject;
    activeSbScene = newProject.scenes[0] || null;
    renderStoryboardProject(newProject);
    showStoryboardOutputSection();
    switchTab('storyboard');
    showAuthAlert(`Storyboard ${scenesCount} scene berhasil dibuat oleh Copilot!`, 'success');

    const sceneListSummary = newProject.scenes.map((s) => `- **Scene ${s.sceneNumber}**: ${s.title || s.visualDescription || ''} (${s.cameraAngle || 'Dynamic Shot'})`).join('\n');

    return cleanText
      ? `${cleanText}\n\n🎬 **Storyboard ${scenesCount} Scene Berhasil Dibuat!**\n\nAlur adegan sudah terpasang di Scene Breakdown di sebelah kiri:\n${sceneListSummary}\n\nKamu bisa langsung me-review tiap scene, mengubah prompt, atau mulai render visual per scene.`
      : `🎬 **Storyboard ${scenesCount} Scene Berhasil Dibuat!**\n\nAlur adegan sudah terpasang di Scene Breakdown di sebelah kiri:\n${sceneListSummary}\n\nKamu bisa langsung me-review tiap scene, mengubah prompt, atau mulai render visual per scene.`;
  }

  function recommendStoryboardImageModel(scene) {
    return recommendStoryboardImageModelHelper({
      scene,
      collectStoryboardRefImages,
    });
  }

  function getStoryboardImageModel(modelId) {
    return getStoryboardImageModelHelper(modelId, IMAGE_MODELS_V2);
  }

  let pendingStoryboardCreateRequest = null;
  let lastStoryboardCreateRequest = null;

  function closeStoryboardGenerateConfirm() {
    const modal = document.getElementById('storyboardGenerateConfirmModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.setProperty('display', 'none', 'important');
    }
  }

  function openStoryboardGenerateConfirm({ scene, modelId, reason }) {
    if (!scene) return;

    const modal = document.getElementById('storyboardGenerateConfirmModal');
    const modelSelect = document.getElementById('storyboardGenerateModelSelect');
    const reasonEl = document.getElementById('storyboardGenerateConfirmReason');
    const sceneEl = document.getElementById('storyboardGenerateConfirmScene');
    const referencesEl = document.getElementById('storyboardGenerateConfirmReferences');
    const descriptionEl = document.getElementById('storyboardGenerateModelDescription');
    const approveButton = document.getElementById('btnApproveStoryboardGenerate');
    const titleEl = document.getElementById('storyboardGenerateConfirmTitle');
    if (!modal || !modelSelect || !approveButton || !titleEl) return;

    const recommendedModel = getStoryboardImageModel(modelId || recommendStoryboardImageModel(scene));
    modelSelect.innerHTML = IMAGE_MODELS_V2.map((model) => `
      <option value="${escapeHtml(model.id)}" ${model.id === recommendedModel.id ? 'selected' : ''}>
        ${escapeHtml(model.name)} - ${model.credits} Koin
      </option>
    `).join('');

    const updateModelDescription = () => {
      const selectedModel = getStoryboardImageModel(modelSelect.value);
      descriptionEl.textContent = `${selectedModel.badge}: ${selectedModel.desc}`;
      approveButton.querySelector('span').textContent = `Generate Scene (${selectedModel.credits} Koin)`;
    };

    titleEl.textContent = 'Konfirmasi Generate Scene';
    reasonEl.textContent = reason || `Copilot merekomendasikan ${recommendedModel.name} untuk kebutuhan visual scene ini.`;
    sceneEl.textContent = `Scene ${scene.sceneNumber || ''}: ${scene.title || 'Storyboard scene'}`;
    referencesEl.textContent = `${collectStoryboardRefImages().length} referensi visual`;
    modelSelect.onchange = updateModelDescription;
    updateModelDescription();

    approveButton.onclick = async () => {
      approveButton.disabled = true;
      approveButton.querySelector('span').textContent = 'Mengirim ke Weavy...';
      try {
        await generateSingleSceneVisual(scene.id, { model: modelSelect.value });
        closeStoryboardGenerateConfirm();
      } finally {
        approveButton.disabled = false;
        updateModelDescription();
      }
    };

    modal.classList.remove('hidden');
    modal.style.setProperty('display', 'flex', 'important');
  }

  function openStoryboardBatchGenerateConfirm(scenes, reason) {
    const validScenes = Array.isArray(scenes) ? scenes.filter(Boolean) : [];
    if (!validScenes.length) return;

    const modal = document.getElementById('storyboardGenerateConfirmModal');
    const modelSelect = document.getElementById('storyboardGenerateModelSelect');
    const reasonEl = document.getElementById('storyboardGenerateConfirmReason');
    const sceneEl = document.getElementById('storyboardGenerateConfirmScene');
    const referencesEl = document.getElementById('storyboardGenerateConfirmReferences');
    const descriptionEl = document.getElementById('storyboardGenerateModelDescription');
    const approveButton = document.getElementById('btnApproveStoryboardGenerate');
    const titleEl = document.getElementById('storyboardGenerateConfirmTitle');
    if (!modal || !modelSelect || !approveButton || !titleEl) return;

    const recommendedModel = getStoryboardImageModel(validScenes[0]?.modelId || validScenes[0]?.model || recommendStoryboardImageModel(currentSbProject?.scenes?.[0] || {}));
    modelSelect.innerHTML = IMAGE_MODELS_V2.map((model) => `
      <option value="${escapeHtml(model.id)}" ${model.id === recommendedModel.id ? 'selected' : ''}>
        ${escapeHtml(model.name)} - ${model.credits} Koin
      </option>
    `).join('');

    const updateModelDescription = () => {
      const selectedModel = getStoryboardImageModel(modelSelect.value);
      descriptionEl.textContent = `${selectedModel.badge}: ${selectedModel.desc}`;
      approveButton.querySelector('span').textContent = `Generate Batch (${selectedModel.credits} Koin / Scene)`;
    };

    titleEl.textContent = 'Konfirmasi Generate Semua Scene';
    reasonEl.textContent = reason || `Copilot merekomendasikan render ${validScenes.length} scene dengan alur visual yang konsisten.`;
    sceneEl.textContent = `${validScenes.length} scene siap digenerate`;
    referencesEl.textContent = `${collectStoryboardRefImages().length} referensi visual · ${validScenes.map((scene) => scene.sceneNumber ?? scene.id).join(', ')}`;
    modelSelect.onchange = updateModelDescription;
    updateModelDescription();

    approveButton.onclick = async () => {
      approveButton.disabled = true;
      approveButton.querySelector('span').textContent = 'Mengirim Batch...';
      try {
        await handleBatchGenerateScenes({
          scenes: validScenes,
          modelId: modelSelect.value,
          reason,
        });
        closeStoryboardGenerateConfirm();
      } finally {
        approveButton.disabled = false;
        updateModelDescription();
      }
    };

    modal.classList.remove('hidden');
    modal.style.setProperty('display', 'flex', 'important');
  }

  function handleStoryboardCopilotGenerateRequest(action) {
    if (!action || typeof action !== 'object') {
      throwStoryboardDebugError({
        title: 'Generate storyboard request tidak valid: action undefined.',
        context: { action, currentSbProjectId: currentSbProject?.id || null, activeSbSceneId: activeSbScene?.id || null },
      });
    }

    if (!currentSbProject || !Array.isArray(currentSbProject.scenes) || currentSbProject.scenes.length === 0) {
      const context = {
        action,
        currentSbProjectId: currentSbProject?.id || null,
        currentSbProjectSceneCount: Array.isArray(currentSbProject?.scenes) ? currentSbProject.scenes.length : 0,
        activeSbSceneId: activeSbScene?.id || null,
        pendingRequest: pendingStoryboardCreateRequest || null,
        lastRequest: lastStoryboardCreateRequest || null,
      };
      console.error('[Storyboard Runtime Guard] Generate request tanpa project aktif.', context);
      invalidateStaleStoryboardRuntimeState({ reason: 'Tidak ada project storyboard aktif untuk scene request.' });
      showAuthAlert('Scene yang diminta tidak relevan dengan project aktif. Silakan pilih atau buat storyboard baru.', 'error');
      return;
    }

    if (Array.isArray(action?.scenes) && action.scenes.length > 1) {
      const sceneCandidates = action.scenes
        .map((requestedScene) => currentSbProject?.scenes?.find((item) => (
          (requestedScene?.id && item.id === requestedScene.id) ||
          (requestedScene?.sceneNumber && item.sceneNumber === Number(requestedScene.sceneNumber))
        )))
        .filter(Boolean);
      if (sceneCandidates.length) {
        openStoryboardBatchGenerateConfirm(sceneCandidates, action.reason || 'Copilot meminta generate batch storyboard.');
        return;
      }
    }

    const requestedScene = Array.isArray(action?.scenes) ? action.scenes[0] : action;
    const scene = currentSbProject?.scenes?.find((item) => (
      (requestedScene?.id && item.id === requestedScene.id) ||
      (requestedScene?.sceneNumber && item.sceneNumber === Number(requestedScene.sceneNumber))
    ));
    if (!scene) {
      const context = {
        action,
        currentSbProjectId: currentSbProject?.id || null,
        currentSbProjectSceneCount: Array.isArray(currentSbProject?.scenes) ? currentSbProject.scenes.length : 0,
        activeSbSceneId: activeSbScene?.id || null,
        requestedScene: requestedScene || null,
        pendingRequest: pendingStoryboardCreateRequest || null,
        lastRequest: lastStoryboardCreateRequest || null,
      };
      console.error('[Storyboard Runtime Guard] Scene request tidak valid untuk project aktif.', context);
      invalidateStaleStoryboardRuntimeState({ reason: 'Scene request tidak ditemukan di project aktif.' });
      showAuthAlert('Copilot meminta scene yang tidak lagi tersedia di storyboard aktif.', 'error');
      return;
    }
    openStoryboardGenerateConfirm({
      scene,
      modelId: requestedScene.modelId || requestedScene.model,
      reason: requestedScene.reason,
    });
  }

  function resetStoryboardCreateRequestState() {
    pendingStoryboardCreateRequest = null;
    lastStoryboardCreateRequest = null;
    const modal = document.getElementById('storyboardCreateProjectModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.setProperty('display', 'none', 'important');
    }
  }

  function closeStoryboardCreateProjectConfirm() {
    resetStoryboardCreateRequestState();
  }

  function invalidateStaleStoryboardRuntimeState({ reason = 'Storyboard sebelumnya tidak aktif lagi.' } = {}) {
    if (currentSbProject && (!currentSbProject?.id || !Array.isArray(currentSbProject?.scenes))) {
      currentSbProject = null;
    }
    if (activeSbScene && currentSbProject && !currentSbProject.scenes?.some((scene) => scene.id === activeSbScene.id || scene.sceneNumber === activeSbScene.sceneNumber)) {
      activeSbScene = null;
    }
    resetStoryboardCreateRequestState();
    const generateModal = document.getElementById('storyboardGenerateConfirmModal');
    if (generateModal) {
      generateModal.classList.add('hidden');
      generateModal.style.setProperty('display', 'none', 'important');
    }
    if (reason) {
      console.warn('[Storyboard Runtime] Stale state cleared:', reason);
    }
  }

  function throwStoryboardDebugError({ title, context = {} }) {
    const error = new Error(title);
    error.name = 'StoryboardRuntimeGuardError';
    console.error('[Storyboard Runtime Guard]', title, context);
    throw error;
  }

  function normalizeStoryboardProjectPayload(project = {}, referenceImages = []) {
    if (!project || typeof project !== 'object') return { references: { product: [], model: [], background: [], custom: [] }, referenceImages: Array.isArray(referenceImages) ? referenceImages : [] };

    const normalized = { ...project };
    const refs = normalized.references && typeof normalized.references === 'object' ? { ...normalized.references } : {};
    const fallbackRefArrays = [
      refs.product,
      refs.model,
      refs.background,
      refs.custom,
      normalized.product,
      normalized.model,
      normalized.background,
      normalized.productAsset,
      normalized.modelAsset,
      normalized.bgAsset,
      normalized.customAssets,
      normalized.productImage,
      normalized.modelImage,
      normalized.backgroundImage,
    ].filter((value) => value !== null && value !== undefined);

    const directRefImages = Array.isArray(referenceImages) && referenceImages.length > 0
      ? referenceImages
      : Array.isArray(normalized.referenceImages)
        ? normalized.referenceImages
        : [];

    const normalizeReferenceList = (value) => {
      if (value == null) return [];
      if (Array.isArray(value)) {
        return value.flatMap((entry) => normalizeReferenceList(entry));
      }
      if (typeof value === 'string' || typeof value === 'object') {
        return [value];
      }
      return [];
    };

    const roleImageMap = {
      product: [],
      model: [],
      background: [],
      custom: [],
    };
    const explicitRoleBuckets = {
      product: ['product', 'produk', 'item', 'barang', 'main_product'],
      model: ['model', 'talent', 'person', 'orang', 'character', 'karakter'],
      background: ['background', 'bg', 'latar', 'setting', 'lokasi'],
    };

    const hasEcomImageInDirect = (Array.isArray(directRefImages) ? directRefImages : []).some((img) => Boolean(img?.isEcomProduct || img?.source === 'ecom_product'));

    const unassignedDirectImages = [];
    (Array.isArray(directRefImages) ? directRefImages : []).forEach((image) => {
      const role = String(image?.referenceRole || image?.role || image?.weavyAsset?.role || image?.weavyAsset?.referenceRole || '').trim().toLowerCase();
      const name = String(image?.name || '').trim().toLowerCase();

      const isBotanicalOrProduct = /pepaya|papaya|buah|benih|bibit|pohon|tanaman|jambu|produk|product|botol|kemasan|item|beli|gratis/i.test(name);
      const isHuman = /model|talent|orang|wajah|pria|wanita|person|face|karakter|character|man|woman|cewek|cowok|selfie|pose|rendi|budi|siti|andi|agus|dewi|petani|host/i.test(name);
      const isLandscape = /kebun|sawah|taman|halaman|outdoor|indoor|ruangan|studio|background|bg|latar/i.test(name);

      if (image?.isEcomProduct || image?.source === 'ecom_product' || (explicitRoleBuckets.product.includes(role) && !isHuman)) {
        roleImageMap.product.push(image);
      } else if (explicitRoleBuckets.model.includes(role) || (isHuman && !isBotanicalOrProduct)) {
        roleImageMap.model.push(image);
      } else if (explicitRoleBuckets.background.includes(role) || isLandscape) {
        roleImageMap.background.push(image);
      } else if (role === 'custom') {
        roleImageMap.custom.push(image);
      } else if (isBotanicalOrProduct) {
        roleImageMap.product.push(image);
      } else {
        unassignedDirectImages.push(image);
      }
    });

    // Fallback sequential mapping for unassigned direct images
    unassignedDirectImages.forEach((img) => {
      const imgName = String(img?.name || '').toLowerCase();
      const isBotanicalOrProduct = /pepaya|papaya|buah|benih|bibit|pohon|tanaman|jambu|produk|product|botol|kemasan|item|beli|gratis/i.test(imgName);
      const isHuman = /model|talent|orang|wajah|pria|wanita|person|face|karakter|character|man|woman|cewek|cowok|selfie|pose|rendi|budi|siti|andi|agus|dewi/i.test(imgName);
      const isLandscape = /kebun|sawah|taman|halaman|outdoor|indoor|ruangan|studio|background|bg|latar/i.test(imgName);

      if (isHuman && !isBotanicalOrProduct) {
        if (roleImageMap.model.length === 0) roleImageMap.model.push(img);
        else roleImageMap.custom.push(img);
      } else if (isLandscape) {
        if (roleImageMap.background.length === 0) roleImageMap.background.push(img);
        else roleImageMap.custom.push(img);
      } else if (isBotanicalOrProduct) {
        if (roleImageMap.product.length === 0) roleImageMap.product.push(img);
        else if (roleImageMap.background.length === 0) roleImageMap.background.push(img);
        else roleImageMap.custom.push(img);
      } else {
        if (hasEcomImageInDirect) {
          if (roleImageMap.model.length === 0 && !isBotanicalOrProduct) {
            roleImageMap.model.push(img);
          } else if (roleImageMap.background.length === 0) {
            roleImageMap.background.push(img);
          } else {
            roleImageMap.custom.push(img);
          }
        } else {
          if (roleImageMap.product.length === 0) roleImageMap.product.push(img);
          else if (roleImageMap.model.length === 0 && !isBotanicalOrProduct) roleImageMap.model.push(img);
          else if (roleImageMap.background.length === 0) roleImageMap.background.push(img);
          else roleImageMap.custom.push(img);
        }
      }
    });

    const pickRoleValues = (roleKey, explicitFallback = null) => {
      const candidate = [
        refs[roleKey],
        normalized[roleKey],
        normalized[`${roleKey}Asset`],
        normalized[`${roleKey}Image`],
        normalized[`${roleKey}Ref`],
        explicitFallback,
      ].filter((value) => value !== null && value !== undefined);

      for (const entry of candidate) {
        const values = normalizeReferenceList(entry);
        if (values.length > 0) return values;
      }

      if (roleImageMap[roleKey].length > 0) {
        return [roleImageMap[roleKey][0]];
      }

      return [];
    };

    const altCustom = Array.isArray(normalized.custom) ? normalized.custom
      : Array.isArray(normalized.customAssets) ? normalized.customAssets
      : Array.isArray(refs.custom) ? refs.custom
      : [];

    const customList = [
      ...normalizeReferenceList(altCustom),
      ...roleImageMap.custom,
    ];

    normalized.references = {
      product: pickRoleValues('product', roleImageMap.product[0] || directRefImages[0] || null),
      model: pickRoleValues('model', roleImageMap.model[0] || directRefImages[1] || null),
      background: pickRoleValues('background', roleImageMap.background[0] || directRefImages[2] || null),
      custom: [...new Set(customList.map((entry) => JSON.stringify(entry)))]
        .map((entry) => JSON.parse(entry))
        .filter(Boolean),
    };

    ['product', 'model', 'background'].forEach((roleKey) => {
      const current = normalizeReferenceList(normalized.references[roleKey]);
      if (current.length === 0 && roleImageMap[roleKey].length > 0) {
        normalized.references[roleKey] = [roleImageMap[roleKey][0]];
      }
    });

    return normalized;
  }

  function handleStoryboardCopilotCreateProjectRequest(action, onStatus) {
    if (!action || typeof action !== 'object' || !action.project) {
      const context = {
        action,
        currentSbProjectId: currentSbProject?.id || null,
        currentSbProjectSceneCount: Array.isArray(currentSbProject?.scenes) ? currentSbProject.scenes.length : 0,
        pendingRequest: pendingStoryboardCreateRequest || null,
        lastRequest: lastStoryboardCreateRequest || null,
      };
      console.error('[Storyboard Runtime Guard] Create-project request invalid: missing project payload.', context);
      throwStoryboardDebugError({
        title: 'Create-project action missing project payload.',
        context,
      });
    }

    let referenceImages = Array.isArray(action?.referenceImages) && action.referenceImages.length > 0
      ? action.referenceImages
      : getStoryboardCopilotImages();
    const project = normalizeStoryboardProjectPayload(action?.project || {}, referenceImages);
    const rawText = action?.rawText || '';

    const requestData = { project, referenceImages, rawText, onStatus };
    pendingStoryboardCreateRequest = requestData;
    lastStoryboardCreateRequest = requestData;

    console.debug('[Storyboard Copilot] Opening create-project modal', {
      projectTitle: project.title || project.productName || 'Unnamed',
      projectId: project.id || null,
      sceneCount: Array.isArray(project.scenes) ? project.scenes.length : 0,
      rawTextPreview: String(rawText || '').slice(0, 200),
      pendingRequestExists: !!pendingStoryboardCreateRequest,
      lastRequestExists: !!lastStoryboardCreateRequest,
      currentSbProjectId: currentSbProject?.id || null,
      currentSbProjectSceneCount: Array.isArray(currentSbProject?.scenes) ? currentSbProject.scenes.length : 0,
      activeSbSceneId: activeSbScene?.id || null,
      activeSbSceneNumber: activeSbScene?.sceneNumber || null,
      timestamp: new Date().toISOString(),
    });

    const modal = document.getElementById('storyboardCreateProjectModal');
    const reasonEl = document.getElementById('storyboardCreateProjectReason');
    const summaryEl = document.getElementById('storyboardCreateProjectSummary');
    const referencesEl = document.getElementById('storyboardCreateProjectReferences');
    if (!modal || !summaryEl || !referencesEl) return;

    const isSameRefImage = (a, b) => {
      if (!a || !b) return false;
      if (a === b) return true;
      if (a.id && b.id && a.id === b.id) return true;
      if (a.url && b.url && a.url === b.url) return true;
      if (a.base64 && b.base64 && a.base64 === b.base64) return true;
      const nameA = String(a.name || '').trim().toLowerCase();
      const nameB = String(b.name || '').trim().toLowerCase();
      if (nameA && nameB && nameA === nameB && !['referensi', 'image', 'asset', 'foto lampiran', 'input gambar chat'].includes(nameA)) return true;
      return false;
    };

    const renderModalReferences = () => {
      const pImg = getReferenceByRole('product', project, referenceImages);
      const mImg = getReferenceByRole('model', project, referenceImages);
      const bImg = getReferenceByRole('background', project, referenceImages);
      const customTokens = Array.isArray(project.references?.custom) ? project.references.custom : [];
      const customImgs = customTokens
        .map((token) => resolveCopilotReference(token, referenceImages))
        .filter(Boolean);

      const assignedImages = [pImg, mImg, bImg].filter(Boolean);
      const isAssigned = (img) => assignedImages.some((assigned) => isSameRefImage(assigned, img));

      const extraRefImages = referenceImages.filter((img) => !isAssigned(img) && !customImgs.some((c) => isSameRefImage(c, img)));
      const allCust = [];
      [...customImgs, ...extraRefImages].forEach((img) => {
        if (!img || isAssigned(img)) return;
        if (allCust.some((existing) => isSameRefImage(existing, img))) return;
        allCust.push(img);
      });

      const selRefs = [
        ['Produk', pImg, 'product', pImg],
        ['Talent / Model', mImg, 'model', mImg],
        ['Latar', bImg, 'background', bImg],
        ...allCust.map((img, i) => [`Asset ${i + 1}`, img, 'custom', img]),
      ].filter(([, image]) => image);

      const canSwap = pImg && mImg;

      referencesEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
          <div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px;">
            ${selRefs.length ? selRefs.map(([label, image, role], index) => `
              <span class="storyboard-create-project-reference-chip" style="display:inline-flex; align-items:center; gap:6px; background:var(--bg-tertiary, #1f2937); border:1px solid rgba(255,255,255,0.1); padding:4px 8px; border-radius:6px; font-size:12px; position:relative;">
                <img src="${escapeHtml(image.thumbnailUrl || image.url || image.base64 || '')}" alt="${escapeHtml(label)}" style="width:26px; height:26px; border-radius:4px; object-fit:cover; flex-shrink:0;" onerror="this.onerror=null; const chip=this.closest('.storyboard-create-project-reference-chip'); if(chip) chip.remove(); else this.style.display='none';">
                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:240px;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(image.name || 'Referensi')}</span>
                <button type="button" class="btn-remove-copilot-ref" data-index="${index}" data-role="${escapeHtml(role)}" title="Buang lampiran ${escapeHtml(label)}" aria-label="Buang lampiran">&times;</button>
              </span>
            `).join('') : '<span style="color:var(--text-muted); font-size:12px;">Tidak ada lampiran foto referensi yang digunakan.</span>'}
          </div>
          ${canSwap ? `
            <div style="display:flex; justify-content:flex-end; margin-top:2px;">
              <button type="button" id="btnSwapCopilotProductModel" style="display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:500; padding:4px 10px; border-radius:6px; background:rgba(232,162,61,0.15); color:#fbbf24; border:1px solid rgba(232,162,61,0.3); cursor:pointer;">
                <span>⇄ Tukar Posisi Produk & Talent</span>
              </button>
            </div>
          ` : ''}
        </div>
      `;

      // Attach remove handlers to delete buttons on chips
      referencesEl.querySelectorAll('.btn-remove-copilot-ref').forEach((delBtn) => {
        delBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const role = delBtn.getAttribute('data-role');
          const idx = parseInt(delBtn.getAttribute('data-index'), 10);
          const targetItem = selRefs[idx];
          if (!targetItem) return;
          const targetImg = targetItem[3] || targetItem[1];

          // Remove targetImg from referenceImages array
          referenceImages = referenceImages.filter((img) => {
            if (img === targetImg) return false;
            if (targetImg.url && img.url === targetImg.url) return false;
            if (targetImg.base64 && img.base64 === targetImg.base64) return false;
            return true;
          });

          if (!project.references) project.references = {};

          if (role === 'product') {
            project.references.product = 'none';
            delete project.product;
            delete project.productAsset;
            delete project.productImage;
            delete project.productRef;
          } else if (role === 'model') {
            project.references.model = 'none';
            delete project.model;
            delete project.modelTalent;
            delete project.modelAsset;
            delete project.modelImage;
            delete project.modelRef;
          } else if (role === 'background') {
            project.references.background = 'none';
            delete project.background;
            delete project.bgSetting;
            delete project.bgAsset;
            delete project.bgImage;
            delete project.bgRef;
          } else if (role === 'custom') {
            if (Array.isArray(project.references?.custom)) {
              project.references.custom = project.references.custom.filter((tok) => {
                const resolved = resolveCopilotReference(tok, [targetImg]);
                return !resolved;
              });
            }
          }

          requestData.referenceImages = referenceImages;
          requestData.project = project;
          renderModalReferences();
        };
      });

      const swapBtn = document.getElementById('btnSwapCopilotProductModel');
      if (swapBtn) {
        swapBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const prevProd = project.references.product;
          project.references.product = project.references.model;
          project.references.model = prevProd;
          requestData.project = project;
          renderModalReferences();
        };
      }
    };

    reasonEl.textContent = action.reason || 'Copilot menyiapkan draft storyboard baru berdasarkan instruksi dan referensi visual kamu.';
    summaryEl.innerHTML = `
      <div><strong>${escapeHtml(project.title || project.productName || 'Storyboard Baru')}</strong></div>
      <div>${escapeHtml(project.productName || 'Produk belum ditentukan')} · ${Number(project.duration) || 10} detik · ${Number(project.numScenes) || 4} scene · ${escapeHtml(project.aspectRatio || '9:16')}</div>
      <div>Formula: ${escapeHtml(project.formula || 'hook_extreme')} · Model gambar: ${escapeHtml(project.imageModel || 'GPT Image 2.5')}</div>
      <div>${escapeHtml(project.brief || 'Brief akan dibuat dari konteks Copilot.')}</div>
    `;

    renderModalReferences();

    // Ensure buttons inside modal are clean, enabled, and bound directly on open
    const approveBtn = document.getElementById('btnApproveStoryboardCreateProject');
    if (approveBtn) {
      approveBtn.disabled = false;
      approveBtn.innerHTML = '<span>Buat & Terapkan Storyboard</span>';
      approveBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        approveStoryboardCopilotCreateProject();
      };
    }
    const cancelBtn = document.getElementById('btnCancelStoryboardCreateProject');
    if (cancelBtn) {
      cancelBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeStoryboardCreateProjectConfirm();
      };
    }
    const closeBtn = document.getElementById('btnCloseStoryboardCreateProject');
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeStoryboardCreateProjectConfirm();
      };
    }
    const backdropEl = document.getElementById('storyboardCreateProjectBackdrop');
    if (backdropEl) {
      backdropEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeStoryboardCreateProjectConfirm();
      };
    }

    modal.classList.remove('hidden');
    modal.style.setProperty('display', 'flex', 'important');
  }

  async function executeCreateStoryboardFromProjectData({ project, referenceImages = [], rawText = '', onStatus = null } = {}) {
    let effectiveRefImages = Array.isArray(referenceImages) && referenceImages.length > 0
      ? referenceImages
      : (Array.isArray(pendingStoryboardCreateRequest?.referenceImages) && pendingStoryboardCreateRequest.referenceImages.length > 0
          ? pendingStoryboardCreateRequest.referenceImages
          : getStoryboardCopilotImages());
    const normalizedProject = normalizeStoryboardProjectPayload(project || {}, effectiveRefImages);
    const safeProject = normalizedProject || {};
    if (!safeProject) return 'Data draft storyboard tidak valid.';

    if (onStatus) {
      await onStatus('Storyboard sedang dirancang...\n\nMenyusun alur cerita, durasi, prompt visual, dan sinkronisasi referensi visual.');
    }

    const nlpParams = extractStoryboardParamsFromText(rawText || '');
    const projectName = safeProject.title || safeProject.productName || safeProject.name || safeProject.topic || nlpParams.productName || sbProductName?.value || 'Storyboard Baru';
    const productDesc = safeProject.productDesc || safeProject.description || safeProject.desc || safeProject.product_desc || nlpParams.productDesc || sbProductDesc?.value || '';
    const modelTalent = safeProject.modelTalent || safeProject.talent || safeProject.model || safeProject.model_talent || safeProject.character || nlpParams.modelTalent || sbModelTalent?.value || '';
    const bgSetting = safeProject.bgSetting || safeProject.background || safeProject.setting || safeProject.bg || safeProject.bg_setting || nlpParams.bgSetting || sbBgSetting?.value || '';
    const brief = safeProject.brief || safeProject.creativeBrief || safeProject.creative_brief || safeProject.concept || safeProject.notes || nlpParams.brief || sbBriefInput?.value || '';
    const totalDuration = Number(safeProject.duration || safeProject.totalDuration || nlpParams.duration || sbTotalDuration?.value || 10);
    const scenesCount = Number((Array.isArray(safeProject.scenes) && safeProject.scenes.length > 0 ? safeProject.scenes.length : null) || safeProject.numScenes || safeProject.num_scenes || nlpParams.numScenes || sbNumScenes?.value || 4);
    const effectiveAspect = safeProject.aspectRatio || nlpParams.aspectRatio || currentAspect || '9:16';
    const effectiveFormula = safeProject.formula || nlpParams.formula || sbFormula?.value || 'hook_extreme';
    const effectiveAiModel = safeProject.aiModel || sbAiModelSelect?.value || 'google/gemini-2.5-flash';
    const effectiveImageModel = safeProject.imageModel || sbImageModelSelect?.value || 'GPT Image 2.5';

    // 1. Populate all Text & Parameter Inputs
    if (sbProductName) sbProductName.value = projectName;
    if (sbProductDesc) sbProductDesc.value = productDesc;
    if (sbModelTalent) sbModelTalent.value = modelTalent;
    if (sbBgSetting) sbBgSetting.value = bgSetting;
    if (sbBriefInput) sbBriefInput.value = brief;
    if (sbTotalDuration) sbTotalDuration.value = String(totalDuration);
    if (sbNumScenes) sbNumScenes.value = String(scenesCount);
    if (sbFormula) sbFormula.value = effectiveFormula;
    if (sbAiModelSelect) sbAiModelSelect.value = effectiveAiModel;
    if (sbImageModelSelect) sbImageModelSelect.value = effectiveImageModel;

    currentAspect = effectiveAspect;
    sbAspectBtns.forEach((button) => {
      button.classList.toggle('active', button.dataset.aspect === currentAspect);
    });

    // 2. Map & Populate Visual Consistency References
    const productImage = getReferenceByRole('product', safeProject, effectiveRefImages);
    const modelImage = getReferenceByRole('model', safeProject, effectiveRefImages);
    const backgroundImage = getReferenceByRole('background', safeProject, effectiveRefImages);
    const customTokens = Array.isArray(safeProject.references?.custom) ? safeProject.references.custom : [];
    const customImages = customTokens
      .map((token) => resolveCopilotReference(token, effectiveRefImages))
      .filter(Boolean);

    const isSameRef = (a, b) => {
      if (!a || !b) return false;
      if (a === b) return true;
      if (a.id && b.id && a.id === b.id) return true;
      if (a.url && b.url && a.url === b.url) return true;
      if (a.base64 && b.base64 && a.base64 === b.base64) return true;
      const nameA = String(a.name || '').trim().toLowerCase();
      const nameB = String(b.name || '').trim().toLowerCase();
      if (nameA && nameB && nameA === nameB && !['referensi', 'image', 'asset', 'foto lampiran', 'input gambar chat'].includes(nameA)) return true;
      return false;
    };

    const assignedImageObjects = [productImage, modelImage, backgroundImage].filter(Boolean);
    const isAssigned = (img) => assignedImageObjects.some((assigned) => isSameRef(assigned, img));

    const extraReferenceImages = effectiveRefImages.filter((img) => !isAssigned(img) && !customImages.some((c) => isSameRef(c, img)));
    const allCustomImages = [];
    [...customImages, ...extraReferenceImages].forEach((img) => {
      if (!img || isAssigned(img)) return;
      if (allCustomImages.some((existing) => isSameRef(existing, img))) return;
      allCustomImages.push(img);
    });

    const productAsset = getCopilotReferenceAsset(productImage);
    const modelAsset = getCopilotReferenceAsset(modelImage);
    const backgroundAsset = getCopilotReferenceAsset(backgroundImage);
    
    sbProductRefBase64 = productAsset?.base64 || (productAsset?.weavyAsset?.url ? productAsset.weavyAsset.url : (typeof productImage === 'string' ? productImage : productImage?.url || productImage?.base64 || null));
    sbProductWeavyAsset = productAsset?.weavyAsset || (sbProductRefBase64 && sbProductRefBase64.startsWith('http') ? { url: sbProductRefBase64, type: 'image' } : null);
    
    sbModelRefBase64 = modelAsset?.base64 || (modelAsset?.weavyAsset?.url ? modelAsset.weavyAsset.url : (typeof modelImage === 'string' ? modelImage : modelImage?.url || modelImage?.base64 || null));
    sbModelWeavyAsset = modelAsset?.weavyAsset || (sbModelRefBase64 && sbModelRefBase64.startsWith('http') ? { url: sbModelRefBase64, type: 'image' } : null);
    
    sbBgRefBase64 = backgroundAsset?.base64 || (backgroundAsset?.weavyAsset?.url ? backgroundAsset.weavyAsset.url : (typeof backgroundImage === 'string' ? backgroundImage : backgroundImage?.url || backgroundImage?.base64 || null));
    sbBgWeavyAsset = backgroundAsset?.weavyAsset || (sbBgRefBase64 && sbBgRefBase64.startsWith('http') ? { url: sbBgRefBase64, type: 'image' } : null);

    applyStoryboardReferencePreview(
      { base64: sbProductRefBase64, weavyAsset: sbProductWeavyAsset },
      sbProductEmptyState,
      sbProductPreviewWrap,
      sbProductImg,
      productAsset || { base64: sbProductRefBase64, weavyAsset: sbProductWeavyAsset }
    );

    applyStoryboardReferencePreview(
      { base64: sbModelRefBase64, weavyAsset: sbModelWeavyAsset },
      sbModelEmptyState,
      sbModelPreviewWrap,
      sbModelImg,
      modelAsset || { base64: sbModelRefBase64, weavyAsset: sbModelWeavyAsset }
    );

    applyStoryboardReferencePreview(
      { base64: sbBgRefBase64, weavyAsset: sbBgWeavyAsset },
      sbBgEmptyState,
      sbBgPreviewWrap,
      sbBgImg,
      backgroundAsset || { base64: sbBgRefBase64, weavyAsset: sbBgWeavyAsset }
    );

    sbCustomAssets = allCustomImages.map((image, index) => {
      const asset = getCopilotReferenceAsset(image);
      const urlOrBase64 = asset?.base64 || asset?.weavyAsset?.url || (typeof image === 'string' ? image : image?.url || image?.base64 || null);
      return {
        id: `copilot_custom_${Date.now()}_${index}`,
        name: (typeof image === 'object' && image?.name) ? image.name : `Asset #${index + 1}`,
        promptDesc: (typeof image === 'object' && image?.promptDesc) ? image.promptDesc : '',
        base64: urlOrBase64,
        weavyAsset: asset?.weavyAsset || (urlOrBase64 && urlOrBase64.startsWith('http') ? { url: urlOrBase64, type: 'image' } : null),
        isUploading: false,
        showCheckmark: Boolean(asset?.weavyAsset?.id || asset?.weavyAsset?.url),
      };
    }).filter((a) => Boolean(a.base64 || a.weavyAsset));
    renderCustomAssetsList();
    closeStoryboardCreateProjectConfirm();
    switchTab('storyboard');

    // 3. Direct Scene Population & Rendering
    const rawScenesInput = Array.isArray(safeProject.scenes) && safeProject.scenes.length > 0
      ? { scenes: safeProject.scenes, metadata: { title: projectName, duration: totalDuration, aspectRatio: effectiveAspect } }
      : (typeof rawText === 'string' && rawText.length > 15 ? rawText : null);

    const generatedProject = parseStoryboardOutputToProject({
      rawOutput: rawScenesInput,
      productName: projectName,
      productDesc,
      modelTalent,
      bgSetting,
      brief,
      targetSceneCount: scenesCount,
      duration: totalDuration,
      aspectRatio: effectiveAspect,
      formula: effectiveFormula,
      aiModel: effectiveAiModel,
      imageModel: effectiveImageModel,
    });

    currentSbProject = generatedProject;
    activeSbScene = generatedProject.scenes?.[0] || null;
    renderStoryboardProject(generatedProject);
    showStoryboardOutputSection();
    if (sbOutputSection) {
      setTimeout(() => {
        sbOutputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }

    if (storyboardCopilotInstance && typeof storyboardCopilotInstance.onProjectUpdated === 'function') {
      try {
        storyboardCopilotInstance.onProjectUpdated(generatedProject);
      } catch (_) {}
    }

    showAuthAlert(`🎬 Storyboard ${generatedProject.scenes?.length || scenesCount} scene berhasil dipasang di Scene Breakdown!`, 'success');

    const sceneSummary = (generatedProject.scenes || [])
      .map((scene) => `- **Scene ${scene.sceneNumber}**: ${scene.title || scene.visualDescription || 'Scene storyboard'} (${scene.cameraAngle || 'Dynamic Shot'})`)
      .join('\n');
    const referenceSummary = [
      productImage ? 'Produk' : null,
      modelImage ? 'Model / Talent' : null,
      backgroundImage ? 'Background' : null,
      allCustomImages.length ? `${allCustomImages.length} asset tambahan` : null,
    ].filter(Boolean).join(', ') || 'Tidak ada reference image';

    const summary = `🎬 **Storyboard ${generatedProject.scenes?.length || scenesCount} Scene Berhasil Dibuat & Terpasang!**\n\n📌 **Ringkasan Proyek:**\n- **Judul**: ${generatedProject.name}\n- **Durasi**: ${generatedProject.duration} detik (${generatedProject.scenes?.length || scenesCount} scene)\n- **Format**: ${generatedProject.aspectRatio}\n- **Model Gambar**: ${generatedProject.imageModel}\n- **Referensi Visual**: ${referenceSummary}\n\n📋 **Daftar Scene di Workspace:**\n${sceneSummary}\n\n✨ *Semua adegan dan parameter input sudah masuk ke Workspace. Kamu bisa langsung mereview prompt tiap scene atau klik "Generate Visual" untuk mulai merender gambar.*`;
    if (onStatus) await onStatus(summary);
    return summary;
  }

  async function approveStoryboardCopilotCreateProject() {
    const request = pendingStoryboardCreateRequest || lastStoryboardCreateRequest;
    console.debug('[Storyboard Copilot] Approve create-project click', {
      hasPending: !!pendingStoryboardCreateRequest,
      hasLast: !!lastStoryboardCreateRequest,
      selectedRequestProjectTitle: request?.project?.title || request?.project?.productName || 'Unnamed',
      selectedRequestId: request?.project?.id || null,
      currentSbProjectId: currentSbProject?.id || null,
      currentSbProjectName: currentSbProject?.name || null,
      timestamp: new Date().toISOString(),
    });
    if (!request || !request.project) {
      console.warn('[Storyboard] Request data tidak ditemukan.');
      return;
    }
    const approveBtn = document.getElementById('btnApproveStoryboardCreateProject');
    const origHtml = approveBtn ? approveBtn.innerHTML : '';
    if (approveBtn) {
      approveBtn.disabled = true;
      approveBtn.innerHTML = '<span>Menyusun Storyboard...</span>';
    }
    try {
      const summary = await executeCreateStoryboardFromProjectData(request);
      closeStoryboardCreateProjectConfirm();
      return summary;
    } catch (err) {
      console.error('[Storyboard] Gagal menerapkan storyboard:', err);
      showAuthAlert(`Gagal menerapkan storyboard: ${err.message}`, 'error');
    } finally {
      if (approveBtn) {
        approveBtn.disabled = false;
        approveBtn.innerHTML = origHtml || '<span>Buat & Terapkan Storyboard</span>';
      }
    }
  }

  function initStoryboardCopilotWorkspace() {
    storyboardCopilotInstance = initStoryboardCopilot({
      documentRef: document,
      storage,
      getContext: getStoryboardCopilotContext,
      sendMessage: sendStoryboardCopilotMessage,
      onGenerateRequest: handleStoryboardCopilotGenerateRequest,
      onCreateProjectRequest: handleStoryboardCopilotCreateProjectRequest,
      onApplyProject: executeCreateStoryboardFromProjectData,
      formatMessage: (text) => formatMarkdown(text, {}, `sb_copilot_${Date.now()}`),
      showAlert: showAuthAlert,
      openImageSourcePicker,
      escapeHtml,
      openLightbox: openMediaLightbox,
      onNewSession: async (session) => {
        const copilotModelEl = document.getElementById('storyboardCopilotModelSelect');
        const copilotProviderEl = document.getElementById('storyboardCopilotProviderSelect');
        const currentModel = copilotModelEl?.value || '';
        const currentProvider = copilotProviderEl?.value || (currentModel.startsWith('dola/') ? 'dola' : (currentModel.startsWith('gemini/') ? 'gemini' : 'weavy'));
        if (currentProvider === 'dola' || currentModel.startsWith('dola/')) {
          createDolaNewChatSessionInTab({ openIfMissing: false }).catch((err) => {
            console.warn('[Storyboard] Gagal sinkronisasi sesi baru ke tab Dola:', err);
          });
        } else if (currentProvider === 'gemini' || currentModel.startsWith('gemini/')) {
          createGeminiNewChatSessionInTab({ openIfMissing: false }).catch((err) => {
            console.warn('[Storyboard] Gagal sinkronisasi sesi baru ke tab Gemini:', err);
          });
        }
      },
    });

    // Global click delegation to ensure modal buttons and storyboard cards always respond
    document.addEventListener('click', (e) => {
      const copySceneBtn = e.target.closest('.btn-copy-scene-item');
      if (copySceneBtn) {
        e.preventDefault();
        e.stopPropagation();
        handleCopySceneItem(copySceneBtn);
        return;
      }

      const applyChatBtn = e.target.closest('.btn-apply-storyboard-from-chat');
      if (applyChatBtn) {
        e.preventDefault();
        e.stopPropagation();
        const encProject = applyChatBtn.getAttribute('data-project') || '';
        let proj = null;
        if (encProject) {
          try {
            proj = JSON.parse(decodeURIComponent(encProject));
          } catch (_) {}
        }
        if (proj) {
          switchTab('storyboard');
          handleStoryboardCopilotCreateProjectRequest({
            project: proj,
            referenceImages: getStoryboardCopilotImages(),
            rawText: proj.brief || proj.title || proj.productName || '',
            reason: `Copilot menyiapkan rancangan storyboard "${proj.title || proj.productName || 'Baru'}" (${proj.scenes?.length || proj.numScenes || 4} Scene, ${proj.duration || 15}s).`,
          });
        }
        return;
      }

      const approveBtn = e.target.closest('#btnApproveStoryboardCreateProject');
      if (approveBtn) {
        e.preventDefault();
        e.stopPropagation();
        approveStoryboardCopilotCreateProject();
        return;
      }
      const cancelBtn = e.target.closest('#btnCancelStoryboardCreateProject, #btnCloseStoryboardCreateProject, #storyboardCreateProjectBackdrop');
      if (cancelBtn) {
        e.preventDefault();
        e.stopPropagation();
        closeStoryboardCreateProjectConfirm();
        return;
      }
    });

    document.getElementById('btnCloseStoryboardGenerateConfirm')?.addEventListener('click', closeStoryboardGenerateConfirm);
    document.getElementById('btnCancelStoryboardGenerate')?.addEventListener('click', closeStoryboardGenerateConfirm);
    document.getElementById('storyboardGenerateConfirmBackdrop')?.addEventListener('click', closeStoryboardGenerateConfirm);
    document.getElementById('btnCloseStoryboardCreateProject')?.addEventListener('click', closeStoryboardCreateProjectConfirm);
    document.getElementById('btnCancelStoryboardCreateProject')?.addEventListener('click', closeStoryboardCreateProjectConfirm);
    document.getElementById('storyboardCreateProjectBackdrop')?.addEventListener('click', closeStoryboardCreateProjectConfirm);
    document.getElementById('btnApproveStoryboardCreateProject')?.addEventListener('click', approveStoryboardCopilotCreateProject);

    sbScenesGrid?.addEventListener('click', (event) => {
      const card = event.target.closest('.sb-scene-card');
      if (!card || !currentSbProject?.scenes) return;
      activeSbScene = currentSbProject.scenes.find((scene) => scene.id === card.dataset.id) || null;
      const panel = document.getElementById('storyboardCopilotPanel');
      if (!panel?.classList.contains('hidden')) {
        document.getElementById('storyboardCopilotContext').textContent = activeSbScene
          ? `Scene ${activeSbScene.sceneNumber} aktif`
          : 'Semua storyboard aktif';
      }
    });
  }

  function setupUploader(boxEl, fileInputEl, emptyEl, previewWrapEl, imgEl, changeBtn, delBtn, onSetAsset, openImageSourcePicker) {
    if (!boxEl || !fileInputEl) return;

    // Create or find persistent status overlay
    let statusOverlay = previewWrapEl?.querySelector('.sb-uploader-status-overlay');
    if (!statusOverlay && previewWrapEl) {
      statusOverlay = document.createElement('div');
      statusOverlay.className = 'sb-uploader-status-overlay hidden';
      previewWrapEl.appendChild(statusOverlay);
    }

    boxEl.addEventListener('click', (e) => {
      if (e.target.closest('.btn-img-act')) return;
      if (openImageSourcePicker) {
        openImageSourcePicker({
          fileInput: fileInputEl,
          onLibraryAsset: (asset) => {
            const imageUrl = asset.thumbnailUrl || asset.url;
            onSetAsset(imageUrl, asset);
            if (imgEl) imgEl.src = imageUrl;
            emptyEl?.classList.add('hidden');
            previewWrapEl?.classList.remove('hidden');
          },
        });
      } else {
        fileInputEl.click();
      }
    });

    // Drag and drop
    boxEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      boxEl.style.borderColor = 'var(--accent-primary, #e8a23d)';
    });
    boxEl.addEventListener('dragleave', () => {
      boxEl.style.borderColor = '';
    });
    boxEl.addEventListener('drop', (e) => {
      e.preventDefault();
      boxEl.style.borderColor = '';
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    });

    fileInputEl.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    });

    changeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (openImageSourcePicker) {
        openImageSourcePicker({
          fileInput: fileInputEl,
          onLibraryAsset: (asset) => {
            const imageUrl = asset.thumbnailUrl || asset.url;
            onSetAsset(imageUrl, asset);
            if (imgEl) imgEl.src = imageUrl;
            emptyEl?.classList.add('hidden');
            previewWrapEl?.classList.remove('hidden');
          },
        });
      } else {
        fileInputEl.click();
      }
    });

    delBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      onSetAsset(null, null);
      fileInputEl.value = '';
      emptyEl?.classList.remove('hidden');
      previewWrapEl?.classList.add('hidden');
      if (imgEl) imgEl.src = '';
      if (statusOverlay) statusOverlay.className = 'sb-uploader-status-overlay hidden';
    });

    async function handleFile(file) {
      if (!file.type.startsWith('image/')) {
        alert('Silakan pilih file gambar (PNG, JPG, WEBP).');
        return;
      }
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const b64 = evt.target?.result;
        onSetAsset(b64, null); // Set base64 immediately for fast preview
        if (imgEl) imgEl.src = b64;
        emptyEl?.classList.add('hidden');
        previewWrapEl?.classList.remove('hidden');

        // Show uploading feedback
        if (statusOverlay) {
          statusOverlay.className = 'sb-uploader-status-overlay uploading';
          statusOverlay.innerHTML = `
            <span class="gen-ref-spinner"></span>
            <span class="sb-status-txt">Mengunggah ke Weavy...</span>
          `;
        }

        const acc = getActiveAccount();
        if (!acc) {
          if (statusOverlay) statusOverlay.className = 'sb-uploader-status-overlay hidden';
          return;
        }

        try {
          const idToken = await getValidIdToken(acc);
          if (!idToken) throw new Error('Token akun belum tersedia.');

          const asset = await uploadAssetToWeavy({ base64: b64, name: file.name || `ref_${Date.now()}.png` }, idToken);
          if (asset && (asset.id || asset.url)) {
            onSetAsset(b64, asset);
            if (statusOverlay) {
              statusOverlay.className = 'sb-uploader-status-overlay success';
              statusOverlay.innerHTML = `
                <span class="sb-status-check">✓</span>
                <span class="sb-status-txt">Tersimpan di Weavy</span>
              `;
              setTimeout(() => {
                statusOverlay.className = 'sb-uploader-status-overlay hidden';
              }, 1800);
            }
          } else {
            throw new Error('Gagal mendapatkan URL asset dari Weavy');
          }
        } catch (err) {
          console.warn('[Storyboard Image Upload Warning]:', err);
          if (statusOverlay) {
            statusOverlay.className = 'sb-uploader-status-overlay error';
            statusOverlay.innerHTML = `
              <span class="sb-status-txt">⚠️ Offline (Lokal)</span>
            `;
            setTimeout(() => {
              statusOverlay.className = 'sb-uploader-status-overlay hidden';
            }, 2500);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  }

  function renderCustomAssetsList() {
    if (!sbCustomAssetsList || !sbCustomAssetsContainer) return;
    if (sbCustomAssets.length === 0) {
      sbCustomAssetsContainer.classList.add('hidden');
      sbCustomAssetsList.innerHTML = '';
      return;
    }

    sbCustomAssetsContainer.classList.remove('hidden');
    sbCustomAssetsList.innerHTML = sbCustomAssets.map((asset, idx) => {
      let uploadStatus = '';
      let statusStyle = '';
      if (asset.isUploading) {
        uploadStatus = '⏳ Mengunggah ke Weavy...';
        statusStyle = 'border-color: var(--accent-primary, #e8a23d); color: var(--accent-primary, #e8a23d);';
      } else if (asset.showCheckmark) {
        uploadStatus = '✓ Tersimpan di Weavy';
        statusStyle = 'border-color: var(--success, #5ec98f); color: var(--success, #5ec98f);';
      } else if (asset.weavyAsset || asset.base64) {
        uploadStatus = '✓ Foto Terpasang (Ubah)';
        statusStyle = 'border-color: var(--success, #5ec98f); color: var(--success, #5ec98f);';
      } else {
        uploadStatus = '📷 Unggah Foto Asset';
      }

      return `
      <div class="sb-custom-asset-card" data-idx="${idx}">
        <button type="button" class="sb-custom-asset-del" data-idx="${idx}">&times;</button>
        <div style="font-size: 10.5px; font-weight: 700; color: var(--accent-primary, #e8a23d);">Asset #${idx + 1}</div>
        <input type="text" class="input-field ca-name" placeholder="Nama Asset (mis. Tas, Gelang)" value="${escapeHtml(asset.name)}" style="font-size: 11px; padding: 4px 8px;">
        <input type="text" class="input-field ca-desc" placeholder="Karakteristik & Detail Visual" value="${escapeHtml(asset.promptDesc)}" style="font-size: 11px; padding: 4px 8px;">
        <label class="btn-sm btn-outline" style="cursor: pointer; text-align: center; font-size: 10px; margin-top: 2px; ${statusStyle}">
          ${uploadStatus}
          <input type="file" accept="image/*" class="ca-file-input hidden">
        </label>
      </div>
      `;
    }).join('');

    sbCustomAssetsList.querySelectorAll('.sb-custom-asset-del').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
        sbCustomAssets.splice(idx, 1);
        renderCustomAssetsList();
      });
    });

    sbCustomAssetsList.querySelectorAll('.ca-name').forEach((input) => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.closest('.sb-custom-asset-card').getAttribute('data-idx'), 10);
        if (sbCustomAssets[idx]) sbCustomAssets[idx].name = e.target.value;
      });
    });

    sbCustomAssetsList.querySelectorAll('.ca-desc').forEach((input) => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.closest('.sb-custom-asset-card').getAttribute('data-idx'), 10);
        if (sbCustomAssets[idx]) sbCustomAssets[idx].promptDesc = e.target.value;
      });
    });

    sbCustomAssetsList.querySelectorAll('.ca-file-input').forEach((input) => {
      input.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const idx = parseInt(e.target.closest('.sb-custom-asset-card').getAttribute('data-idx'), 10);
        const reader = new FileReader();
        reader.onload = async (evt) => {
          const b64 = evt.target.result;
          if (sbCustomAssets[idx]) {
            sbCustomAssets[idx].base64 = b64;
            sbCustomAssets[idx].isUploading = true;
            sbCustomAssets[idx].showCheckmark = false;
            renderCustomAssetsList();

            const acc = getActiveAccount();
            if (acc) {
              try {
                const idToken = await getValidIdToken(acc);
                if (idToken) {
                  const asset = await uploadAssetToWeavy({ base64: b64, name: file.name || `custom_${idx + 1}.png` }, idToken);
                  if (asset && (asset.id || asset.url)) {
                    sbCustomAssets[idx].weavyAsset = asset;
                    sbCustomAssets[idx].isUploading = false;
                    sbCustomAssets[idx].showCheckmark = true;
                    renderCustomAssetsList();
                    setTimeout(() => {
                      if (sbCustomAssets[idx]) {
                        sbCustomAssets[idx].showCheckmark = false;
                        renderCustomAssetsList();
                      }
                    }, 1800);
                    return;
                  }
                }
              } catch (err) {
                console.warn('Custom asset upload error:', err);
              }
            }
            sbCustomAssets[idx].isUploading = false;
            renderCustomAssetsList();
          }
        };
        reader.readAsDataURL(file);
      });
    });
  }

  // --- ROBUST STORYBOARD PARSER & RESILIENT EXTRACTOR ---
  function extractStoryboardFromAI(rawOutput, {
    productName = 'Produk',
    productDesc = '',
    modelTalent = 'Talent',
    bgSetting = 'Studio',
    brief = '',
    duration = 15,
    numScenes = 6,
    aspectRatio = '9:16',
    imageModel = 'GPT Image 2.5',
    aiModel = 'google/gemini-2.5-flash',
  }) {
    let parsed = null;
    let rawText = '';

    if (rawOutput && typeof rawOutput === 'string') {
      rawText = rawOutput.trim();
      let clean = rawText;

      // Strip markdown code fences if present
      if (clean.includes('```')) {
        const m = clean.match(/```(?:json|storyboard_project|storyboard-project|storyboard_copilot|storyboard_draft|storyboard|copilot_storyboard)?\s*([\s\S]*?)\s*```/i);
        if (m && m[1]) clean = m[1].trim();
      }

      // Try direct JSON.parse
      try {
        parsed = JSON.parse(clean);
      } catch (_) {
        // Find outer JSON boundary ({...} or [...])
        const firstBracket = clean.indexOf('[');
        const firstBrace = clean.indexOf('{');
        let startIdx = -1;
        let endIdx = -1;

        if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
          startIdx = firstBracket;
          endIdx = clean.lastIndexOf(']');
        } else if (firstBrace !== -1) {
          startIdx = firstBrace;
          endIdx = clean.lastIndexOf('}');
        }

        if (startIdx !== -1 && endIdx > startIdx) {
          let candidate = clean.slice(startIdx, endIdx + 1);
          // Remove trailing commas before } or ]
          candidate = candidate.replace(/,\s*([\]}])/g, '$1');
          try {
            parsed = JSON.parse(candidate);
          } catch (_) {}
        }
      }
    } else if (rawOutput && typeof rawOutput === 'object') {
      parsed = rawOutput;
    }

    // Extract scenes array from parsed structure
    let rawScenes = [];
    let metadata = (parsed && typeof parsed === 'object' && parsed.metadata) ? parsed.metadata : null;
    let analysis = (parsed && typeof parsed === 'object' && parsed.analysis) ? parsed.analysis : null;
    let masterSheetPrompt = (parsed && typeof parsed === 'object' && parsed.masterProductionSheetPrompt) ? parsed.masterProductionSheetPrompt : null;

    if (Array.isArray(parsed)) {
      rawScenes = parsed;
    } else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.scenes)) rawScenes = parsed.scenes;
      else if (Array.isArray(parsed.storyboard)) rawScenes = parsed.storyboard;
      else if (Array.isArray(parsed.scene_breakdown)) rawScenes = parsed.scene_breakdown;
      else if (Array.isArray(parsed.sceneBreakdown)) rawScenes = parsed.sceneBreakdown;
      else if (Array.isArray(parsed.panels)) rawScenes = parsed.panels;
      else if (Array.isArray(parsed.shots)) rawScenes = parsed.shots;
      else if (Array.isArray(parsed.data?.scenes)) rawScenes = parsed.data.scenes;
      else if (Array.isArray(parsed.result?.scenes)) rawScenes = parsed.result.scenes;
      else if (Array.isArray(parsed.response?.scenes)) rawScenes = parsed.response.scenes;
      else if (parsed.scenes && typeof parsed.scenes === 'object') rawScenes = Object.values(parsed.scenes);
      else if (parsed.sceneNumber !== undefined || parsed.visualDescription || parsed.visual || parsed.imagePrompt || parsed.videoPrompt) {
        rawScenes = [parsed];
      } else {
        const sceneKeys = Object.keys(parsed).filter(k => /scene[_\s-]?\d+/i.test(k));
        if (sceneKeys.length > 0) {
          rawScenes = sceneKeys.map(k => parsed[k]);
        }
      }
    }

    // Detect if user requested on-screen text (DEFAULT IS NO TEXT ON SCREEN)
    const explicitTextRequestedRegex = /(?:pakai|dengan|sertakan|tambahkan|ada|buatkan|tuliskan)\s+(?:teks|text|tulisan|caption|overlay|onscreen)|(?:on-screen\s+text|text\s+overlay|with\s+text)/i;
    const isTextExplicitlyRequested = explicitTextRequestedRegex.test(brief || '') || explicitTextRequestedRegex.test(rawText || '') || explicitTextRequestedRegex.test(productDesc || '') || explicitTextRequestedRegex.test(metadata?.brief || '');

    // If still no array of scenes, parse from raw text using regex
    if ((!rawScenes || rawScenes.length === 0) && rawText) {
      const sceneBlocks = rawText.split(/(?=(?:Scene|Panel|Bagian|\*\*Scene|###\s*Scene|\bScene\b)\s*\d+[:.\-\s])/i).filter(b => b.trim());
      if (sceneBlocks.length > 0) {
        rawScenes = sceneBlocks.map((blk, idx) => {
          const lines = blk.split('\n').map(l => l.trim()).filter(Boolean);
          const title = lines[0] || `Scene ${idx + 1}`;

          let visual = '';
          let vo = '';
          let text = '';
          let angle = 'Dynamic Eye-level Close-Up';
          let imgPrompt = '';
          let vidPrompt = '';

          lines.forEach(l => {
            if (/^(?:Visual|Aksi|Visual Description|Deskripsi Visual):/i.test(l)) {
              visual = l.replace(/^(?:Visual|Aksi|Visual Description|Deskripsi Visual):\s*/i, '');
            } else if (/^(?:Voiceover|VO|Audio|Narasi|Suara|Script):/i.test(l)) {
              vo = l.replace(/^(?:Voiceover|VO|Audio|Narasi|Suara|Script):\s*/i, '');
            } else if (/^(?:Text|Teks(?:\s+di\s+layar|\s+layar)?|On-screen(?:\s*text)?|Headline):/i.test(l)) {
              text = l.replace(/^(?:Text|Teks(?:\s+di\s+layar|\s+layar)?|On-screen(?:\s*text)?|Headline):\s*/i, '');
            } else if (/^(?:Camera|Angle|Sudut|Kamera):/i.test(l)) {
              angle = l.replace(/^(?:Camera|Angle|Sudut|Kamera):\s*/i, '');
            } else if (/^(?:Image Prompt|Prompt Gambar):/i.test(l)) {
              imgPrompt = l.replace(/^(?:Image Prompt|Prompt Gambar):\s*/i, '');
            } else if (/^(?:Video Prompt|Prompt Video):/i.test(l)) {
              vidPrompt = l.replace(/^(?:Video Prompt|Prompt Video):\s*/i, '');
            }
          });

          if (!visual) visual = blk.slice(0, 160).trim();

          const isTextPlaceholder = /^(?:none|tidak\s+ada(?:\s+teks)?|tanpa\s+teks|kosong|-|n\/a|no\s+text)$/i.test(text.trim());
          const cleanText = (isNoTextRequested || isTextPlaceholder) ? '' : text.trim();
          let finalImgPrompt = (imgPrompt || '').trim();
          if (!finalImgPrompt) {
            let cleanProd = (productName || 'Produk').replace(/["'“”]/g, '').replace(/[!?]+$/, '').trim();
            if (cleanProd.includes('—')) cleanProd = cleanProd.split('—')[0].trim();
            else if (cleanProd.includes(' - ')) cleanProd = cleanProd.split(' - ')[0].trim();
            cleanProd = cleanProd.replace(/^(?:Iklan\s+|Hasil\s+Panen\s+)/i, '');

            let featList = [];
            if (cleanProd) featList.push(`featuring ${cleanProd}`);
            if (modelTalent && modelTalent !== 'Talent') featList.push(`with ${modelTalent}`);
            if (bgSetting && bgSetting !== 'Studio') featList.push(`at ${bgSetting}`);
            const featPhrase = featList.length ? `${featList.join(' ')}, ` : '';

            const stylePrefix = cleanText ? `Vertical ${aspectRatio} commercial photograph` : `Vertical ${aspectRatio} cinematic photograph`;
            const noTextSuffix = cleanText ? '' : ', clean photography, pure visual only, no text, no title, no typography, no banner, no words, no watermark, no overlays, no graphic stickers';
            finalImgPrompt = `${stylePrefix}, ${angle}, ${visual}, ${featPhrase}studio softbox lighting${noTextSuffix}, 8k.`;
          } else {
            finalImgPrompt = sanitizeSceneImagePrompt(finalImgPrompt, { onScreenText: cleanText }, null);
          }

          return {
            sceneNumber: idx + 1,
            title: title.replace(/^#+\s*/, '').replace(/\*+/g, ''),
            cameraAngle: angle,
            visualDescription: visual,
            voiceover: vo || `Rasakan keunggulan ${productName} sekarang juga!`,
            onScreenText: cleanText,
            imagePrompt: finalImgPrompt,
            videoPrompt: vidPrompt || 'Cinematic slow push in, commercial lighting, fluid natural motion.',
          };
        });
      }
    }

    // Target scene count calculation
    const targetSceneCount = Math.max(1, Number(numScenes || (rawScenes?.length ? rawScenes.length : (duration <= 10 ? 3 : duration <= 15 ? 4 : duration <= 30 ? 6 : 8))));
    if (!rawScenes || rawScenes.length === 0) {
      const sceneArchetypes = [
        {
          title: 'Scene 1: Visual Pattern Interrupt (The Hook)',
          angle: 'Extreme Close-Up Macro',
          visual: `Close-up dinamis tekstur dan kesegaran ${productName} di ${bgSetting}, memperlihatkan detail produk secara memikat.`,
          vo: `Tunggu dulu! Kamu belum pernah lihat ${productName} sesegar dan sebagus ini kan?`,
          text: `STOP SCROLLING! 😱 ${productName}`,
        },
        {
          title: 'Scene 2: Problem & Relatable Pain Point',
          angle: 'Medium Shot Eye-Level',
          visual: `${modelTalent} berekspresi penasaran sambil memegang dan memperhatikan ${productName} dengan seksama.`,
          vo: `Sering kecewa sama produk yang biasa? Nah, ini dia rahasia yang lagi viral!`,
          text: `Ini Bedanya! 🔥`,
        },
        {
          title: 'Scene 3: Product Reveal & Core USP',
          angle: 'Low-Angle Hero Shot',
          visual: `Kamera berputar memperlihatkan ${productName} dari dekat dengan pencahayaan sempurna di ${bgSetting}.`,
          vo: `Lihat sendiri kualitas aslinya. Dipetik langsung, kaya manfaat alami dan super berkualitas!`,
          text: `100% Kualitas Juara! ✨`,
        },
        {
          title: 'Scene 4: Social Proof & Sensory Experience',
          angle: 'Dynamic Tracking Shot',
          visual: `${modelTalent} tersenyum puas menikmati dan menunjukkan keunggulan ${productName} dengan percaya diri.`,
          vo: `Sekali coba langsung kerasa bedanya. Bikin nagih dan recommended banget buat kamu!`,
          text: `Bikin Nagih Banget! 😍`,
        },
        {
          title: 'Scene 5: Value & Special Offer',
          angle: 'Dutch Tilt Over-The-Shoulder',
          visual: `Tampilan visual paket penawaran spesial ${productName} dengan grafis diskon promo menarik.`,
          vo: `Kabar baiknya, hari ini lagi ada promo harga spesial diskon dan gratis ongkir!`,
          text: `PROMO TERBATAS HARI INI ⚡`,
        },
        {
          title: 'Scene 6: Final Strong Call To Action (Keranjang Kuning)',
          angle: 'Frontal Medium Close-Up with Pointing Gesture',
          visual: `${modelTalent} menunjuk ke sudut kiri bawah layar (keranjang kuning) sambil mengangkat ${productName}.`,
          vo: `Jangan sampai kehabisan stok ya! Buruan klik keranjang kuning di bawah sekarang juga!`,
          text: `KLIK KERANJANG KUNING SEKARANG! 🛒👇`,
        },
        {
          title: 'Scene 7: Bonus Guarantee & Urgency',
          angle: 'High Angle Flat Lay',
          visual: `Tampilan visual jaminan kualitas dan garansi kepuasan pelanggan ${productName}.`,
          vo: `Garansi sampai di tangan kamu dengan selamat dan segar. Checkout sekarang!`,
          text: `Garansi 100% Puas 🛡️`,
        },
        {
          title: 'Scene 8: Outro & Branding Stinger',
          angle: 'Center Hero Packshot',
          visual: `Packshot estetik ${productName} di ${bgSetting} dengan logo brand dan ajakan checkout.`,
          vo: `Checkout sekarang sebelum harga promo berakhir!`,
          text: `Beli Sekarang! 🛍️`,
        },
      ];

      const buildCleanFeaturePhrase = () => {
        const parts = [];
        if (productName && productName !== 'Produk') parts.push(`featuring ${productName}`);
        if (modelTalent && modelTalent !== 'Talent') parts.push(`with ${modelTalent}`);
        if (bgSetting && bgSetting !== 'Studio') parts.push(`at ${bgSetting}`);
        return parts.length ? `${parts.join(' ')}, ` : '';
      };
      const cleanFeat = buildCleanFeaturePhrase();

      rawScenes = sceneArchetypes.slice(0, targetSceneCount).map((arc, idx) => ({
        sceneNumber: idx + 1,
        title: arc.title,
        cameraAngle: arc.angle,
        visualDescription: arc.visual,
        voiceover: arc.vo,
        onScreenText: arc.text,
        imagePrompt: `Vertical ${aspectRatio} commercial advertising photograph, ${arc.angle}, ${arc.visual}, ${cleanFeat}cinematic studio lighting, 8k.`,
        videoPrompt: `Cinematic commercial camera movement, ${arc.angle.toLowerCase()}, slow push in, smooth 4k video.`,
      }));
    }

    // Calculate timecodes and clean scene properties
    const sceneDuration = Math.max(2, Math.round(duration / Math.max(1, rawScenes.length)));
    const finalScenes = rawScenes.map((s, idx) => {
      const startSec = idx * sceneDuration;
      const endSec = idx === rawScenes.length - 1 ? duration : (idx + 1) * sceneDuration;
      const formatTime = (sec) => {
        const m = String(Math.floor(sec / 60)).padStart(2, '0');
        const sc = String(sec % 60).padStart(2, '0');
        return `${m}:${sc}`;
      };

      const cAngle = s.cameraAngle || s.camera_angle || s.camera || s.angle || s.shot || s.shot_type || s.shotType || s.framing || 'Dynamic Eye-level Close-Up';
      const vDesc = s.visualDescription || s.visual_description || s.visual || s.visuals || s.desc || s.description || s.action || s.visual_prompt || s.scene_visual || `Aksi visual ${productName} di ${bgSetting}`;
      
      // Respect explicit empty voiceover for ASMR / Harvest POV / Silent modes
      const rawVo = s.voiceover !== undefined ? s.voiceover : (s.voice_over !== undefined ? s.voice_over : (s.vo !== undefined ? s.vo : (s.narration !== undefined ? s.narration : (s.script !== undefined ? s.script : (s.naskah !== undefined ? s.naskah : (s.dialog !== undefined ? s.dialog : s.narasi))))));
      let vOver = '';
      if (rawVo !== undefined && rawVo !== null) {
        const trimmedVo = String(rawVo).trim();
        const isVoPlaceholder = /^(?:none|tidak\s+ada(?:\s+vo(?:iceover)?)?|tanpa\s+vo(?:iceover)?|kosong|-|n\/a|no\s+vo(?:iceover)?)$/i.test(trimmedVo);
        vOver = isVoPlaceholder ? '' : trimmedVo;
      } else {
        const isSilentFormula = formula === 'harvest_pov_taste' || /harvestpov|asmr|tanpa\s+(?:vo|suara|narasi)/i.test(brief || productName || '');
        vOver = isSilentFormula ? '' : `Nikmati keunggulan ${productName} sekarang juga!`;
      }
      const rawOst = s.onScreenText ?? s.on_screen_text ?? s.onscreen_text ?? s.onscreenText ?? s.caption ?? s.teks ?? s.text ?? s.overlay ?? s.screenText ?? '';
      const isOstPlaceholder = /^(?:none|tidak\s+ada(?:\s+teks)?|tanpa\s+teks|kosong|-|n\/a|no\s+text)$/i.test(String(rawOst).trim());
      const oText = (!isTextExplicitlyRequested || isOstPlaceholder) ? '' : String(rawOst).trim();
      let iPrompt = (s.imagePrompt || s.image_prompt || s.prompt || '').trim();
      const isGeneric = !iPrompt || /photograph of\s+showcasing|showcasing.*at\s*,/i.test(iPrompt) || /^(vertical|horizontal)?\s*(\d+:\d+)?\s*commercial photograph of\s*showcasing/i.test(iPrompt);
      if (isGeneric) {
        let cleanProd = (productName || 'Produk').replace(/["'“”]/g, '').replace(/[!?]+$/, '').trim();
        if (cleanProd.includes('—')) cleanProd = cleanProd.split('—')[0].trim();
        else if (cleanProd.includes(' - ')) cleanProd = cleanProd.split(' - ')[0].trim();
        cleanProd = cleanProd.replace(/^(?:Iklan\s+|Hasil\s+Panen\s+)/i, '');

        let featList = [];
        if (cleanProd) featList.push(`featuring ${cleanProd}`);
        if (modelTalent && modelTalent !== 'Talent') featList.push(`with ${modelTalent}`);
        if (bgSetting && bgSetting !== 'Studio') featList.push(`at ${bgSetting}`);
        const featPhrase = featList.length ? `${featList.join(' ')}, ` : '';

        const stylePrefix = oText ? `Vertical ${aspectRatio} commercial advertising photograph` : `Vertical ${aspectRatio} cinematic photograph`;
        const noTextSuffix = oText ? '' : ', clean photography, pure visual only, no text, no title, no typography, no banner, no words, no watermark, no overlays, no graphic stickers';
        iPrompt = `${stylePrefix}, ${cAngle}, ${vDesc}, ${featPhrase}professional advertising lighting${noTextSuffix}, 8k.`;
      } else {
        iPrompt = sanitizeSceneImagePrompt(iPrompt, { onScreenText: oText }, null);
      }
      const vPrompt = s.videoPrompt || s.video_prompt || s.motion || s.motion_prompt || 'Cinematic camera movement, slow push in, smooth 4k video motion.';

      return {
        id: s.id || ('sc_' + Date.now() + '_' + (idx + 1) + '_' + Math.random().toString(36).substr(2, 4)),
        sceneNumber: Number(s.sceneNumber || s.scene_number || s.scene || s.num || (idx + 1)),
        title: s.title || s.name || s.headline || s.scene_title || `Scene ${idx + 1}`,
        timecode: s.timecode || `${formatTime(startSec)} - ${formatTime(endSec)}`,
        durationSec: Number(s.durationSec || s.duration_sec || s.duration) || (endSec - startSec),
        cameraAngle: cAngle,
        visualDescription: vDesc,
        voiceover: vOver,
        onScreenText: oText,
        imagePrompt: iPrompt,
        videoPrompt: vPrompt,
        status: s.status || 'idle',
        imageUrl: s.imageUrl || null,
      };
    });

    if (!analysis) {
      analysis = {
        hookAnalysis: `Scene 1 langsung menampilkan visual hook memikat dari ${productName} di ${bgSetting} untuk menghentikan scroll penonton di 2 detik awal.`,
        productOrTopicName: productName,
        coreUSPs: ['Kualitas Alami & Segar', 'Kaya Manfaat', 'Harga Terjangkau Promo', 'Garansi Kepuasan'],
        visualProofStrategy: `Demonstrasi langsung kesegaran produk dan ekspresi puas ${modelTalent} di ${bgSetting}.`,
        callToActionAnalysis: 'Instruksi persuasif mengarahkan penonton ke keranjang kuning TikTok Shop.',
        targetEmotion: 'Penasaran, Percaya, dan FOMO ingin segera mencoba.',
      };
    }

    if (!masterSheetPrompt) {
      const panelPrompts = finalScenes.slice(0, 4).map(s => `[Panel ${s.sceneNumber} (${s.timecode})]: ${s.cameraAngle}, ${s.visualDescription}`).join(' | ');
      masterSheetPrompt = `Master 16:9 Commercial Storyboard 4-Panel Contact Sheet for ${productName} at ${bgSetting}: ${panelPrompts}. 100% visual consistency, photorealistic commercial cinema studio lighting, 8k.`;
    }

    return {
      metadata: metadata || { title: productName, duration, aspectRatio },
      analysis,
      masterProductionSheetPrompt: masterSheetPrompt,
      scenes: finalScenes,
    };
  }

  function parseStoryboardOutputToProject({
    rawOutput,
    productName = 'Produk',
    productDesc = '',
    modelTalent = 'Talent',
    bgSetting = 'Studio',
    brief = '',
    targetSceneCount = 4,
    duration = 10,
    aspectRatio = '9:16',
    formula = 'hook_extreme',
    aiModel = 'google/gemini-2.5-flash',
    imageModel = 'GPT Image 2.5',
  } = {}) {
    const extracted = extractStoryboardFromAI(rawOutput, {
      productName,
      productDesc,
      modelTalent,
      bgSetting,
      brief,
      duration,
      numScenes: targetSceneCount,
      aspectRatio,
      imageModel,
      aiModel,
    });

    return {
      id: 'sb_proj_' + Date.now(),
      name: productName || extracted.metadata?.title || 'Storyboard Iklan',
      duration: duration || Number(extracted.metadata?.duration) || 10,
      aspectRatio: aspectRatio || extracted.metadata?.aspectRatio || '9:16',
      imageModel,
      aiModel,
      createdAt: new Date().toISOString(),
      analysis: extracted.analysis || null,
      metadata: extracted.metadata || null,
      masterProductionSheetPrompt: extracted.masterProductionSheetPrompt || null,
      scenes: extracted.scenes || [],
      inputState: typeof getStoryboardFormSnapshot === 'function' ? getStoryboardFormSnapshot() : {},
    };
  }

  // --- STORYBOARD GENERATION CONTROLLER ---
  async function handleGenerateStoryboard(e) {
    if (e) e.preventDefault();
    sbCompositeResultUrl = null;
    activeSbScene = null;
    const rawProductName = (sbProductName?.value || '').trim();
    const productDesc = (sbProductDesc?.value || '').trim();
    const modelTalent = (sbModelTalent?.value || '').trim();
    const bgSetting = (sbBgSetting?.value || '').trim();
    const brief = (sbBriefInput?.value || '').trim();
    const videoUrl = (sbVideoUrlInput?.value || '').trim();
    const isUrlMode = tabUrlIngestBtn?.classList.contains('active');
    const duration = parseInt(sbTotalDuration?.value || '10', 10);
    const numScenes = parseInt(sbNumScenes?.value || '4', 10);
    const aiModel = sbAiModelSelect?.value || 'google/gemini-2.5-flash';
    const imageModel = sbImageModelSelect?.value || 'GPT Image 2.5';
    const formulaAngle = sbFormula?.value || 'hook_extreme';
    const tiktokStyle = sbTiktokStyle?.value || 'ugc_handheld';
    const hookPattern = sbHookPattern?.value || 'auto_smart';
    const lockConsistency = sbLockConsistency ? Boolean(sbLockConsistency.checked) : true;

    // Intelligently infer product name if user only filled brief / background / images
    let productName = rawProductName;
    if (!productName) {
      if (brief) {
        const m = brief.match(/(?:produk|iklan|jual|tentang)\s+([a-zA-Z0-9\s]{2,30})/i);
        productName = m ? m[1].trim() : brief.slice(0, 35).trim();
      }
      if (!productName) productName = 'Produk Pilihan';
    }

    const effectiveModel = modelTalent || 'Talent Ramah Kreator TikTok Indonesia';
    const effectiveBg = bgSetting || 'Kamar Estetik / Interior Rumah Alami';

    if (isUrlMode && videoUrl && !rawProductName && !brief) {
      await handleAnalyzeVideoUrl();
      return;
    }

    if (!rawProductName && !brief && !videoUrl && !sbProductRefBase64) {
      alert('Harap isi minimal Nama Produk, Ide / Brief, atau Unggah Gambar Produk.');
      if (isUrlMode) {
        sbVideoUrlInput?.focus();
      } else {
        sbProductName?.focus();
      }
      return;
    }

    const acc = getActiveAccount();
    if (!acc) {
      alert('Silakan hubungkan akun Weavy terlebih dahulu di tab Akun & Token.');
      switchTab('settings');
      return;
    }

    if (btnGenerateStoryboard) btnGenerateStoryboard.disabled = true;
    if (sbBtnLabel) sbBtnLabel.textContent = 'Merancang Storyboard TikTok...';

    try {
      const idToken = await getValidIdToken(acc);

      // Collect reference images
      const refImages = [];
      if (sbProductRefBase64) refImages.push({ base64: sbProductRefBase64, name: 'product.png' });
      if (sbModelRefBase64) refImages.push({ base64: sbModelRefBase64, name: 'model.png' });
      if (sbBgRefBase64) refImages.push({ base64: sbBgRefBase64, name: 'background.png' });
      sbCustomAssets.forEach((ca) => {
        if (ca.base64) refImages.push({ base64: ca.base64, name: `${ca.name || 'custom'}.png` });
      });

      // Direct Weavy LLM call with TikTok Sales Funnel System Prompt
      const durationSceneCount = numScenes || (duration <= 10 ? 3 : duration <= 15 ? 4 : duration <= 30 ? 6 : 8);
      const formulaRules = formulaAngle !== 'none' ? `
FORMULA ANGLE RULES (${formulaAngle}):
- hook_extreme: HOOK (0-3s): Problem/Misteri/Claim gila → AGITATE (3-6s): Bukti visual dramatis → SOLVE (6-10s): Solusi produk + CTA
- humor_parody: HOOK (0-3s): Situasi absurd/relatable konyol → MIDDLE (3-6s): Komplikasi lucu → SOLVE (6-10s): Solusi konyol tapi nyata + CTA
- deep_emotional: HOOK (0-3s): Emosi kuat (haru, sedih, kagum) → BUILD (3-6s): Escalation emosi → PAYOFF (6-10s): Twist emosional + produk + CTA
- fast_ugc: HOOK (0-2s): Bingkai cepat/tekanan → PROOF (2-5s): Bukti UGC cepat → CTA (5-10s): Hard sell + urgency
- hard_sell: HOOK (0-2s): Claim berani + scarcity → PROOF (2-5s): Testimoni/stok menipis → CTA (5-10s): urgency + harga + keranjang kuning` : '';

      const tiktokStyleGuide = {
        ugc_handheld: 'Authentic UGC handheld smartphone camera video still, natural indoor ambient room lighting, realistic candid expression, unfiltered texture, subtle motion blur, high fidelity social media video frame.',
        iphone_pov: 'First-person POV shot on iPhone 15 Pro, creator hands holding product forward towards lens, shallow depth of field, authentic indoor home background, crisp natural lighting, sharp product label focus.',
        macro_texture: 'Extreme macro close-up (ECU) 100mm lens, showing rich tactile product texture, sensory droplets and smooth application, tactile details, crisp focus, soft natural rim light.',
        split_screen: 'TikTok split-screen vertical composition, side-by-side Before vs After visual proof, authentic real-life comparison, realistic smartphone camera texture, high contrast.',
        authentic_vlog: 'Authentic casual TikTok room vlog, genuine relatable facial expression, natural eye-level selfie perspective, soft ring light reflection in eyes, real bedroom or vanity setting.',
        commercial_studio: 'Clean minimalist modern e-commerce commercial shot, soft studio lighting, pristine aesthetic background, sharp product focus.',
      }[tiktokStyle] || 'Authentic UGC handheld smartphone camera video still, natural indoor ambient room lighting.';

      const hookPatternGuide = {
        pattern_interrupt: 'HOOK PATTERN: Pattern Interrupt (Visual Disruption). Scene 1 MUST use sudden stop-scroll visual action (e.g. dropping/spilling demo, extreme fast zoom, sudden swatch, unexpected action) in first 2 seconds.',
        negative_fear: 'HOOK PATTERN: Negative Warning ("Jangan beli sebelum..."). Scene 1 MUST open with a warning about a common fatal mistake consumers make, stopping them from scrolling.',
        split_transformation: 'HOOK PATTERN: Instant Before vs After Split. Scene 1 MUST showcase an instant visual contrast comparing the ugly problem against the glorious result.',
        relatable_pov: 'HOOK PATTERN: Relatable Everyday POV ("POV lu pengen..."). Scene 1 MUST open with a relatable daily struggle that instantly resonates with TikTok viewers.',
        secret_unboxing: 'HOOK PATTERN: Secret / "Racun TikTok". Scene 1 MUST feel like an urgent insider secret ("Bongkar rahasia kenapa produk ini viral dan sold out terus").',
        flash_urgency: 'HOOK PATTERN: Flash Sale / Urgency Keranjang Kuning. Scene 1 MUST highlight scarcity or massive price drop ("Mumpung masih diskon 50% di keranjang kuning").',
        auto_smart: 'HOOK PATTERN: Smart TikTok Viral Hook tailored to stop-scroll in the first 2 seconds.',
      }[hookPattern] || '';

      const systemPrompt = `You are a master TikTok/Reels creative director, e-commerce content strategist, and world-class AI video prompt engineer specializing in high-converting viral TikTok Shop funnels for AMB Media V3.
Your task is to construct a professional, high-converting multi-scene storyboard that drives massive engagement and sales on TikTok!

CRITICAL SPECIFICATIONS:
- PRODUCT: ${productName} (${productDesc || 'High quality commercial item'})
- MODEL / TALENT: ${effectiveModel}
- BACKGROUND / SETTING: ${effectiveBg}
- CREATIVE BRIEF: ${brief || 'Iklan penjualan TikTok Shop dengan hook kuat'}
- TOTAL DURATION: ${duration} seconds
- TARGET SCENE COUNT: Exactly ${durationSceneCount} scenes!
- ASPECT RATIO: ${currentAspect}
- VISUAL STYLE: ${tiktokStyleGuide}
${formulaRules}
${hookPatternGuide}

ANTI-REPETITION & CAMERA VARIATION RULES (STRICTLY REQUIRED):
DO NOT make every scene look the same! Each scene MUST use a DIFFERENT camera angle and camera distance suited for TikTok:
- Scene 1 (The Hook): Dynamic Stop-Scroll Angle (e.g. Extreme Close-Up Macro, sudden First-Person POV, or Dutch Angle zoom).
- Scene 2 (The Problem / Agitate): Medium candid shot or Over-the-Shoulder showing relatable frustration/need.
- Scene 3 (The Solution & Demonstration): Close-Up sensory swatch, texture demonstration, or hands-on usage.
- Scene 4 (Social Proof & Transformation): Split screen Before/After OR eye-level confident radiant result.
- Final Scene (Call To Action): Eye-level product held forward towards camera with hand gesturing down towards the TikTok yellow shopping cart ("Keranjang Kuning").

CONSISTENCY SPECIFICATION:
${lockConsistency ? `Maintain 100% visual consistency for talent and product across all scenes!
Every scene's "imagePrompt" MUST embed:
"[CHARACTER LOCK: identical model ${effectiveModel}, same facial structure, hair, and outfit]"
"[PRODUCT ANCHOR: identical packaging, branding, colors of ${productName}]"
alongside the specific dynamic camera angle and action.` : ''}

VOICEOVER & ON-SCREEN TEXT RULES:
- Voiceover (VO): Natural, authentic, conversational Indonesian TikTok creator narration. Casual, engaging ("Sumpah awalnya gak percaya...", "Jangan skip kalau kalian punya masalah..."). NO formal television announcer tone!
- OnScreenText (OST): Punchy 3-5 words bold TikTok hook text overlay with high-CTR emojis (e.g. "JANGAN BELI DULU ❌", "HASILNYA GILA BANGET 😱", "DISKON 50% HARI INI 🛒").
- CRITICAL NO-TEXT RULE: If the creative brief or user mentions "tanpa teks", "tidak ada teks", "no text", or if "onScreenText" is empty (""), you MUST set "onScreenText": "" AND every scene's "imagePrompt" MUST end with ", clean photography, pure visual only, no text, no title, no typography, no banner, no words, no watermark, no overlays, no graphic stickers". NEVER put marketing slogans or exclamation marks in "imagePrompt"!

CRITICAL OUTPUT REQUIREMENT:
Respond ONLY with valid raw JSON without conversational filler or markdown codeblocks:
{
  "metadata": {
    "title": "${productName.replace(/"/g, "'")}",
    "duration": ${duration},
    "aspectRatio": "${currentAspect}"
  },
  "analysis": {
    "hookAnalysis": "Penjelasan hook visual 2 detik pertama yang menghentikan scroll.",
    "productOrTopicName": "${productName.replace(/"/g, "'")}",
    "coreUSPs": ["USP 1", "USP 2", "USP 3", "USP 4"],
    "visualProofStrategy": "Strategi pembuktian visual nyata di video.",
    "callToActionAnalysis": "Instruksi checkout keranjang kuning TikTok."
  },
  "masterProductionSheetPrompt": "Split-screen multi-panel master visual production sheet...",
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Scene 1: The Hook",
      "timecode": "00:00 - 00:03",
      "durationSec": 3,
      "cameraAngle": "Extreme Close-Up Macro / POV Hands In",
      "visualDescription": "Detail aksi visual gerakan dramatis model/produk di detik awal.",
      "voiceover": "Script narasi pembuka yang bikin penasaran ala TikTok.",
      "onScreenText": "STOP! JANGAN BELI INI DULU ❌",
      "imagePrompt": "Vertical ${currentAspect} authentic TikTok video frame, [CHARACTER LOCK: ${effectiveModel}] [PRODUCT ANCHOR: ${productName}], extreme macro close-up shot, dramatic lighting, sharp focus, high fidelity.",
      "videoPrompt": "Cinematic quick snap zoom-in, stop-motion texture, high energy."
    }
  ]
}`;

      const promptReq = `CRITICAL: Generate the structured JSON storyboard now for ${productName} (${duration}s, ${durationSceneCount} scenes). Return ONLY valid JSON object with the "scenes" array.`;

      const rawAIOutput = await callWeavyLLM({
        prompt: promptReq,
        systemPrompt,
        model: aiModel,
        idToken,
        refreshToken: acc.refreshToken,
        history: [{ role: 'user', content: promptReq }],
        images: refImages,
      });

      if (!rawAIOutput) throw new Error('Tidak ada respon dari AI Director.');

      // Seamlessly extract & normalize storyboard structure
      const extractedStoryboard = extractStoryboardFromAI(rawAIOutput, {
        productName,
        productDesc,
        modelTalent: effectiveModel,
        bgSetting: effectiveBg,
        brief,
        duration,
        numScenes,
        aspectRatio: currentAspect,
        imageModel,
        aiModel,
      });

      currentSbProject = {
        id: 'sb_proj_' + Date.now(),
        name: productName || extractedStoryboard.metadata?.title || 'Storyboard Iklan',
        duration: duration,
        aspectRatio: currentAspect,
        imageModel: imageModel,
        aiModel: aiModel,
        createdAt: new Date().toISOString(),
        analysis: extractedStoryboard.analysis || null,
        metadata: extractedStoryboard.metadata || null,
        masterProductionSheetPrompt: extractedStoryboard.masterProductionSheetPrompt || null,
        scenes: extractedStoryboard.scenes,
        inputState: getStoryboardFormSnapshot(),
      };

      // Display Analysis Section if provided
      if (extractedStoryboard.analysis) {
        displayAnalysisCard(extractedStoryboard.analysis, extractedStoryboard.metadata);
        sbAnalysisCard?.classList.remove('hidden');
        sbAtmCard?.classList.remove('hidden');
      }

      renderStoryboardProject(currentSbProject);
      showStoryboardOutputSection();
      sbOutputSection?.scrollIntoView({ behavior: 'smooth' });
      showAuthAlert(`Storyboard (${extractedStoryboard.scenes.length} scenes) berhasil dibuat!`, 'success');
      return currentSbProject;
    } catch (err) {
      alert(`Gagal merancang storyboard: ${err.message}`);
      return null;
    } finally {
      if (btnGenerateStoryboard) btnGenerateStoryboard.disabled = false;
      if (sbBtnLabel) sbBtnLabel.textContent = 'Mulai Buat Storyboard Konsisten';
    }
  }

  // --- URL INGESTION & VIDEO ANALYSIS ---
  async function handleAnalyzeVideoUrl() {
    const url = (sbVideoUrlInput?.value || '').trim();
    sbCompositeResultUrl = null;
    activeSbScene = null;
    if (!url) {
      alert('Silakan masukkan link video TikTok / Instagram Reels.');
      sbVideoUrlInput?.focus();
      return;
    }

    const acc = getActiveAccount();
    if (!acc) {
      alert('Silakan hubungkan akun Weavy terlebih dahulu di tab Akun & Token.');
      switchTab('settings');
      return;
    }

    if (btnAnalyzeVideoUrl) {
      btnAnalyzeVideoUrl.disabled = true;
      btnAnalyzeVideoUrl.textContent = '🔍 Menganalisis Video...';
    }

    try {
      const idToken = await getValidIdToken(acc);
      const duration = parseInt(sbTotalDuration?.value || '30', 10);
      const numScenes = parseInt(sbNumScenes?.value || '6', 10);
      const imageModel = sbImageModelSelect?.value || 'GPT Image 2.5';
      const aiModel = sbAiModelSelect?.value || 'google/gemini-2.5-flash';

      // Fetch live metadata if it's a TikTok, YouTube, or Reels link
      let liveMetadata = null;
      try {
        const linkType = /tiktok\.com/i.test(url) ? 'tiktok' : (/youtu\.be|youtube\.com/i.test(url) ? 'youtube' : 'web');
        const fetched = await fetchLinkMetadata({ url, type: linkType, platform: 'TikTok/Video' });
        if (fetched && fetched.metadata) {
          liveMetadata = fetched.metadata;
        }
      } catch (metaErr) {
        console.warn('[Storyboard Video Scraper] Metadata error:', metaErr);
      }

      const videoTitle = liveMetadata?.title || 'Viral TikTok Reference Video';
      const creatorName = liveMetadata?.author_name || 'Kreator Terdeteksi';

      const resultData = {
        metadata: {
          title: liveMetadata ? `${videoTitle.substring(0, 45)}... (@${creatorName})` : 'Viral TikTok Reference Video',
          duration: duration,
          tags: ['#review', '#fyp', '#viral', creatorName ? `#${creatorName.replace(/\s+/g, '')}` : '#tiktok'],
          author: creatorName,
          thumbnailUrl: liveMetadata?.thumbnail_url || null,
        },
        analysis: {
          hookAnalysis: liveMetadata?.title
            ? `Naskah Asli Terdeteksi: "${liveMetadata.title.substring(0, 110)}..." Menggunakan pola hook langsung to-the-point yang memicu interaksi dan rasa ingin tahu penonton.`
            : 'Video menggunakan fast texture macro zoom di 2 detik awal yang memicu rasa penasaran & visual pattern interrupt.',
          productOrTopicName: sbProductName?.value || (liveMetadata ? videoTitle.substring(0, 30) : 'Produk Unggulan Komersial'),
          coreUSPs: ['Formula Sederhana Praktis', 'Hasil Nyata Cepat', 'Bahan Mudah Didapat', 'Tips Berdaya Rekat Tinggi'],
          visualProofStrategy: 'Eksperimen langsung dan visual pembuktian langkah demi langkah dengan pencahayaan alami.',
          callToActionAnalysis: 'Mengajak audiens berdiskusi di kolom komentar untuk meningkatkan interaksi dan bookmark video.',
        },
        scenes: [],
      };

      // Display Section B & ATM Card
      displayAnalysisCard(resultData.analysis, resultData.metadata);
      sbAnalysisCard?.classList.remove('hidden');
      sbAtmCard?.classList.remove('hidden');

      // If backend already generated scenes from video analysis, render them directly!
      if (Array.isArray(resultData.scenes) && resultData.scenes.length > 0) {
        const finalScenes = resultData.scenes.map((s, idx) => {
          const rawOst = s.onScreenText || '';
          const isOstEmpty = !rawOst || /^(?:none|tidak\s+ada(?:\s+teks)?|tanpa\s+teks|kosong|-|n\/a|no\s+text)$/i.test(String(rawOst).trim());
          const cleanOst = isOstEmpty ? '' : String(rawOst).trim();
          return {
            id: s.id || ('sc_' + Date.now() + '_' + (idx + 1)),
            sceneNumber: s.sceneNumber || idx + 1,
            title: s.title || `Scene ${idx + 1}`,
            timecode: s.timecode || `00:0${idx * 4} - 00:0${(idx + 1) * 4}`,
            durationSec: s.durationSec || 4,
            cameraAngle: s.cameraAngle || 'Dynamic Eye-level Close-Up',
            visualDescription: s.visualDescription || '',
            voiceover: s.voiceover || '',
            onScreenText: cleanOst,
            imagePrompt: sanitizeSceneImagePrompt(s.imagePrompt || '', { onScreenText: cleanOst }, null),
            videoPrompt: s.videoPrompt || '',
            status: 'idle',
            imageUrl: null,
          };
        });

        currentSbProject = {
          id: 'sb_proj_' + Date.now(),
          name: resultData.metadata?.title || 'Analisis TikTok Storyboard',
          duration: duration,
          aspectRatio: currentAspect,
          imageModel: imageModel,
          aiModel: aiModel,
          createdAt: new Date().toISOString(),
          analysis: resultData.analysis,
          metadata: resultData.metadata,
          masterProductionSheetPrompt: resultData.masterProductionSheetPrompt,
          scenes: finalScenes,
          inputState: getStoryboardFormSnapshot(),
        };

        renderStoryboardProject(currentSbProject);
        showStoryboardOutputSection();
      }

      sbAnalysisCard?.scrollIntoView({ behavior: 'smooth' });
      showAuthAlert('Analisis kecerdasan alur video & hook berhasil diekstrak!', 'success');
    } catch (err) {
      alert(`Gagal menganalisis video: ${err.message}`);
    } finally {
      if (btnAnalyzeVideoUrl) {
        btnAnalyzeVideoUrl.disabled = false;
        btnAnalyzeVideoUrl.textContent = '🔍 Analisis Alur & ATM Video';
      }
    }
  }

  function displayAnalysisCard(analysis, metadata) {
    displayAnalysisCardUi({
      analysis,
      metadata,
      sbAnalysisCard,
      sbHookAnalysisText,
      sbTargetEmotionText,
      sbVisualProofText,
      sbAnalysisChipsContainer,
      escapeHtml,
    });
  }

  // --- ATM REMIX CONTROLLER ---
  async function handleAtmRemix() {
    const acc = getActiveAccount();
    if (!acc) {
      alert('Silakan hubungkan akun Weavy terlebih dahulu.');
      return;
    }

    const formula = sbAtmFormula?.value || 'hook_extreme';
    const duration = parseInt(sbAtmDuration?.value || '15', 10);
    const notes = (sbAtmNotes?.value || '').trim();

    if (btnSubmitAtmRemix) btnSubmitAtmRemix.disabled = true;
    if (sbAtmBtnLabel) sbAtmBtnLabel.textContent = 'Merancang Versi Baru...';

    try {
      // Trigger generation with ATM formula notes directly injected
      if (sbBriefInput) {
        sbBriefInput.value = `${sbBriefInput.value} [ATM Remix Angle: ${formula}. Catatan: ${notes}]`.trim();
      }
      await handleGenerateStoryboard();
      showAuthAlert('Storyboard berhasil di-Remix dengan formula ATM!', 'success');
    } catch (err) {
      alert(`Gagal me-remix storyboard: ${err.message}`);
    } finally {
      if (btnSubmitAtmRemix) btnSubmitAtmRemix.disabled = false;
      if (sbAtmBtnLabel) sbAtmBtnLabel.textContent = 'Rancang Versi Baru (ATM)';
    }
  }

  // --- TIKTOK HOOK A/B TESTING MODAL CONTROLLER (OPSI 3) ---
  async function handleOpenHookVariationsModal() {
    if (!sbHookVariationsModal) return;
    sbHookVariationsModal.classList.remove('hidden');

    const productName = (sbProductName?.value || '').trim() || 'Produk Unggulan';
    const productDesc = (sbProductDesc?.value || '').trim();
    const brief = (sbBriefInput?.value || '').trim();
    const tiktokStyle = sbTiktokStyle?.value || 'ugc_handheld';

    if (sbHookVariationsList) {
      sbHookVariationsList.innerHTML = `
        <div class="sb-loading-spinner-wrap py-4">
          <div class="sb-spinner"></div>
          <span class="text-xs text-muted">Merancang 3 formula hook viral TikTok untuk "${escapeHtml(productName)}"...</span>
        </div>
      `;
    }

    const hooks = [
      {
        patternKey: 'pattern_interrupt',
        badge: '🛑 Visual Disruption (Pattern Interrupt)',
        badgeColor: '#ef4444',
        title: 'Hook 1: Stop-Scroll Visual Action',
        visualAction: `00:00-00:02: Kamera langsung close-up ekstrim (ECU) memperlihatkan tekstur/tumpahan atau tangan talent tiba-tiba memblokir lensa sambil menunjukkan ${productName} dengan cepat dan tegas ke arah kamera.`,
        onScreenText: `STOP! JANGAN BELI ${productName.toUpperCase()} DULU ❌`,
        voiceover: `Sumpah kalian wajib tonton video ini 2 detik aja sebelum nyesel beli kemahalan!`,
        cameraShot: 'Extreme Macro Close-Up (ECU) / Quick Handheld Action',
        briefNote: `Hook visual disruption stop-scroll di detik 0-2 memperlihatkan ${productName} secara dramatis, disusul problem umum dan pembuktian solusi cepat.`,
      },
      {
        patternKey: 'negative_fear',
        badge: '⚠️ Negative / Curiosity Warning',
        badgeColor: '#f59e0b',
        title: 'Hook 2: Peringatan Kesalahan Fatal',
        visualAction: `00:00-00:03: Talent berekspresi kaget atau frustrasi di depan kamera, menggelengkan kepala, lalu mengangkat ${productName} sebagai game changer penyelamat situasi.`,
        onScreenText: `KESALAHAN FATAL SAAT PILIH ${productName.toUpperCase()} 😱`,
        voiceover: `Pantesan masalah kalian gak kelar-kelar, ternyata 90% orang masih salah pilih produk kayak gini...`,
        cameraShot: 'Relatable Eye-Level Candid Reaction',
        briefNote: `Hook peringatan kesalahan konsumen ("Jangan beli sebelum tahu ini"), membangun rasa penasaran tinggi sebelum reveal keunggulan nyata ${productName}.`,
      },
      {
        patternKey: 'relatable_pov',
        badge: '🤫 Racun TikTok & Relatable POV',
        badgeColor: '#8b5cf6',
        title: 'Hook 3: Relatable Lifestyle Secret',
        visualAction: `00:00-00:03: POV iPhone 15 Pro merekam unboxing santai atau pemakaian harian di meja/kamar, tangan memegang ${productName} dengan pencahayaan hangat estetik.`,
        onScreenText: `POV: AKHIRNYA NEMU YANG VIRAL INI ✨`,
        voiceover: `Nyesel banget baru tahu produk ini sekarang, pantesan tiap kali restock di TikTok Shop langsung ludes!`,
        cameraShot: 'First-Person POV Hands-On (iPhone 15 Pro)',
        briefNote: `Hook POV relatable ala kreator jujur ("Nyesel baru tahu"), menunjukkan pengalaman memakai ${productName} secara natural dan estetik.`,
      }
    ];

    setTimeout(() => {
      renderHookVariations(hooks, productName);
    }, 120);
  }

  function renderHookVariations(hooks, productName) {
    if (!sbHookVariationsList) return;
    sbHookVariationsList.innerHTML = '';

    hooks.forEach((h, idx) => {
      const card = document.createElement('div');
      card.className = 'sb-hook-card';
      card.style.cssText = `
        background-color: var(--bg-primary, #18181b);
        border: 1px solid var(--border-color, #27272a);
        border-radius: 8px;
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        transition: all 0.15s ease;
      `;
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
          <span style="font-size: 10.5px; font-weight: 700; color: ${h.badgeColor}; background: rgba(255,255,255,0.06); padding: 2px 7px; border-radius: 4px;">
            ${escapeHtml(h.badge)}
          </span>
          <span style="font-size: 10px; color: var(--text-muted); font-family: monospace;">📷 ${escapeHtml(h.cameraShot)}</span>
        </div>

        <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">
          <strong style="color: var(--text-primary);">Aksi Visual (0-3s):</strong> ${escapeHtml(h.visualAction)}
        </div>

        <div style="background: rgba(0,0,0,0.45); border-left: 3px solid #facc15; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; color: #fef08a;">
          Teks Layar: "${escapeHtml(h.onScreenText)}"
        </div>

        <div style="font-size: 11px; color: var(--text-secondary); font-style: italic;">
          <strong style="font-style: normal; color: var(--text-primary);">Voiceover:</strong> "${escapeHtml(h.voiceover)}"
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
          <button type="button" class="btn-xs btn-primary btn-apply-hook" data-index="${idx}" style="font-size: 10.5px; padding: 3px 10px; gap: 4px; display: inline-flex; align-items: center;">
            <span>⚡ Terapkan Hook Ini</span>
          </button>
        </div>
      `;

      card.querySelector('.btn-apply-hook')?.addEventListener('click', () => {
        applySelectedHook(h);
      });

      sbHookVariationsList.appendChild(card);
    });
  }

  function applySelectedHook(h) {
    if (sbBriefInput) {
      sbBriefInput.value = h.briefNote;
    }
    if (sbHookPattern) {
      sbHookPattern.value = h.patternKey;
    }

    // If current active project exists and has Scene 1, update Scene 1 live!
    if (currentSbProject && Array.isArray(currentSbProject.scenes) && currentSbProject.scenes.length > 0) {
      const sc1 = currentSbProject.scenes[0];
      sc1.onScreenText = h.onScreenText;
      sc1.voiceover = h.voiceover;
      sc1.visualDescription = h.visualAction;
      sc1.cameraAngle = h.cameraShot;
      renderStoryboardProject(currentSbProject);
    }

    if (sbHookVariationsModal) {
      sbHookVariationsModal.classList.add('hidden');
    }

    showAuthAlert(`Hook "${h.badge}" berhasil diterapkan ke storyboard!`, 'success');
  }

  // --- SCENE RENDERING & UI SYNC ---
  function renderStoryboardProject(proj) {
    renderStoryboardProjectUi({
      sbOutputSection,
      sbScenesGrid,
      sbScenesProjectTitle,
      sbScenesMetaText,
      proj,
      escapeHtml,
      renderSceneCardHtml: ({ sc, index, escapeHtml: esc }) => renderSceneCardHtmlHelper({ sc, index, escapeHtml: esc }),
      bindSceneCardInteractions,
      updateCompletedBadge,
    });
  }

  function renderSceneCardHtml(scene, index) {
    return renderSceneCardHtmlHelper({ sc: scene, index, escapeHtml });
  }

  function bindSceneCardInteractions() {
    bindSceneCardInteractionsHelper({
      sbScenesGrid,
      currentSbProject,
      showCopyTooltip: showCopyTooltipUi,
      showAuthAlert,
      generateSingleSceneVisual,
      downloadMediaBlob,
      openMediaLightbox,
      handleSaveSbProject,
      navigatorRef: navigator,
    });
  }

  function showCopyTooltip(btn) {
    showCopyTooltipUi({ btn });
  }

  function updateCompletedBadge() {
    updateCompletedBadgeUiHelper({ sbCompletedBadge, currentSbProject });
  }

  // --- AMB MEDIA V2 SCENE GENERATION ENGINE ---

  // Collect all storyboard consistency reference images
  function collectStoryboardRefImages() {
    return collectStoryboardRefImagesHelper({
      sbProductWeavyAsset,
      sbProductRefBase64,
      sbModelWeavyAsset,
      sbModelRefBase64,
      sbBgWeavyAsset,
      sbBgRefBase64,
      sbCustomAssets,
    });
  }

  function updateSceneCardProgress(sceneId, progress) {
    updateSceneCardProgressHelper({ renderSceneCardHtml, bindSceneCardInteractions }, sceneId, progress);
  }

  function updateSceneCardDom(scene) {
    updateSceneCardDomHelper({ renderSceneCardHtml, bindSceneCardInteractions }, scene);
  }

  async function initiateSceneTask(scene, acc, idToken, modelOverride = null) {
    return initiateSceneTaskHelper({
      currentSbProject,
      sbProductWeavyAsset,
      sbProductRefBase64,
      sbModelWeavyAsset,
      sbModelRefBase64,
      sbBgWeavyAsset,
      sbBgRefBase64,
      sbCustomAssets,
      collectStoryboardRefImages,
      getOrCreateWeavyRecipeId,
      uploadAssetToWeavy,
      callWeavyApi,
      approveWeavyModel,
      storage,
      getValidIdToken,
      getWeavyClientHeaders,
      extractMediaUrlFromObject,
      showAuthAlert,
      recoverWeavySessionOn403: (targetAcc) => recoverWeavySessionOn403Helper({
        account: targetAcc || acc || getActiveAccount(),
        accounts,
        syncSingleAccountFn: syncSingleAccount,
        exchangeRefreshTokenFn: exchangeRefreshToken,
        saveAccountsFn: saveAccounts,
        showAuthAlert,
      }),
    }, scene, acc, idToken, modelOverride);
  }

  async function pollSceneTask(taskContext, onProgress) {
    return pollSceneTaskHelper({ callWeavyApi, extractMediaUrlFromObject }, taskContext, onProgress);
  }

  async function generateSingleSceneVisual(sceneId, options = {}) {
    return generateSingleSceneVisualHelper({
      currentSbProject,
      sbProductWeavyAsset,
      sbProductRefBase64,
      sbModelWeavyAsset,
      sbModelRefBase64,
      sbBgWeavyAsset,
      sbBgRefBase64,
      sbCustomAssets,
      collectStoryboardRefImages,
      getActiveAccount,
      switchTab,
      getValidIdToken,
      getOrCreateWeavyRecipeId,
      uploadAssetToWeavy,
      callWeavyApi,
      approveWeavyModel,
      storage,
      getWeavyClientHeaders,
      extractMediaUrlFromObject,
      updateSceneCardDom,
      updateSceneCardProgress,
      updateCompletedBadge,
      refreshCredits,
      handleSaveSbProject,
      showAuthAlert,
      getStoryboardImageModel,
      recoverWeavySessionOn403: (targetAcc) => recoverWeavySessionOn403Helper({
        account: targetAcc || getActiveAccount(),
        accounts,
        syncSingleAccountFn: syncSingleAccount,
        exchangeRefreshTokenFn: exchangeRefreshToken,
        saveAccountsFn: saveAccounts,
        showAuthAlert,
      }),
      initiateSceneTask: initiateSceneTaskHelper,
      pollSceneTask: pollSceneTaskHelper,
    }, sceneId, options);
  }

  async function handleBatchGenerateScenes(options = {}) {
    if (isBatchGenerating) return;
    isBatchGenerating = true;
    if (btnBatchGenerateScenes) btnBatchGenerateScenes.disabled = true;
    try {
      return await handleBatchGenerateScenesHelper({
        currentSbProject,
        sbProductWeavyAsset,
        sbProductRefBase64,
        sbModelWeavyAsset,
        sbModelRefBase64,
        sbBgWeavyAsset,
        sbBgRefBase64,
        sbCustomAssets,
        collectStoryboardRefImages,
        isBatchGenerating,
        btnBatchGenerateScenes,
        sbBatchGenLabel,
        getActiveAccount,
        switchTab,
        getValidIdToken,
        getOrCreateWeavyRecipeId,
        uploadAssetToWeavy,
        callWeavyApi,
        approveWeavyModel,
        storage,
        getWeavyClientHeaders,
        extractMediaUrlFromObject,
        updateSceneCardDom,
        updateSceneCardProgress,
        updateCompletedBadge,
        refreshCredits,
        handleSaveSbProject,
        showAuthAlert,
        recoverWeavySessionOn403: (targetAcc) => recoverWeavySessionOn403Helper({
          account: targetAcc || getActiveAccount(),
          accounts,
          syncSingleAccountFn: syncSingleAccount,
          exchangeRefreshTokenFn: exchangeRefreshToken,
          saveAccountsFn: saveAccounts,
          showAuthAlert,
        }),
        initiateSceneTask: initiateSceneTaskHelper,
        pollSceneTask: pollSceneTaskHelper,
      }, options);
    } finally {
      isBatchGenerating = false;
      if (btnBatchGenerateScenes) btnBatchGenerateScenes.disabled = false;
    }
  }

  function collectAll1SheetAssets() {
    return collectAll1SheetAssetsHelper({
      sbProductRefBase64,
      sbProductWeavyAsset,
      sbModelRefBase64,
      sbModelWeavyAsset,
      sbBgRefBase64,
      sbBgWeavyAsset,
      sbCustomAssets,
      currentSbProject,
    });
  }

  function render1SheetAssetsPreview(assets) {
    return render1SheetAssetsPreviewHelper({ sbCompositeAssetsGrid, sbCompositeAssetCount, escapeHtml }, assets);
  }

  function generateMaster1SheetPrompt(forceRebuild = false) {
    return generateMaster1SheetPromptHelper({ currentSbProject, sbCompositePromptText, sbCompositeRatioSelect, currentAspect }, forceRebuild);
  }

  function open1SheetGridModal() {
    return open1SheetGridModalHelper({
      currentSbProject,
      currentAspect,
      sbCompositeAssetsGrid,
      sbCompositeAssetCount,
      sbCompositePromptText,
      sbCompositeRatioSelect,
      sbCompositeLoadingBox,
      sbCompositeErrorAlert,
      sbCompositeModal,
      sbProductRefBase64,
      sbProductWeavyAsset,
      sbModelRefBase64,
      sbModelWeavyAsset,
      sbBgRefBase64,
      sbBgWeavyAsset,
      sbCustomAssets,
      escapeHtml,
      btnCompositeGrid,
      sbCompositeResultArea,
      sbCompositeResultImg,
      btnDownloadCompositeResult,
      btnOpenCompositeResult,
      sbCompositeResultUrl,
      collectAll1SheetAssets: collectAll1SheetAssetsHelper,
      generateMaster1SheetPrompt: generateMaster1SheetPromptHelper,
    });
  }

  function close1SheetGrid() {
    return close1SheetGridModalHelper({
      sbCompositeModal,
      btnCompositeGrid,
    });
  }

  function toggle1SheetGrid() {
    return toggle1SheetGridModalHelper({
      currentSbProject,
      currentAspect,
      sbCompositeAssetsGrid,
      sbCompositeAssetCount,
      sbCompositePromptText,
      sbCompositeRatioSelect,
      sbCompositeLoadingBox,
      sbCompositeErrorAlert,
      sbCompositeModal,
      sbProductRefBase64,
      sbProductWeavyAsset,
      sbModelRefBase64,
      sbModelWeavyAsset,
      sbBgRefBase64,
      sbBgWeavyAsset,
      sbCustomAssets,
      escapeHtml,
      btnCompositeGrid,
      sbCompositeResultArea,
      sbCompositeResultImg,
      btnDownloadCompositeResult,
      btnOpenCompositeResult,
      sbCompositeResultUrl,
      collectAll1SheetAssets: collectAll1SheetAssetsHelper,
      generateMaster1SheetPrompt: generateMaster1SheetPromptHelper,
    });
  }

  function openCharSheetModal() {
    return openCharacterSheetModalHelper({
      sbCharSheetModal,
      sbCharSheetPromptText,
      sbCharSheetTalentImgPreview,
      sbCharSheetEmptyIcon,
      sbCharSheetTalentStatus,
      sbCharSheetTalentDescText,
      sbModelWeavyAsset,
      sbModelRefBase64,
      sbModelTalent,
      currentSbProject,
    });
  }

  function closeCharSheetModal() {
    return closeCharacterSheetModalHelper({ sbCharSheetModal });
  }

  async function executeCharSheetGeneration() {
    const resUrl = await executeCharacterSheetGenerationHelper({
      getActiveAccount,
      switchTab,
      getValidIdToken,
      uploadAssetToWeavy,
      getOrCreateWeavyRecipeId,
      callWeavyApi,
      approveWeavyModel,
      getWeavyClientHeaders,
      storage,
      extractMediaUrlFromObject,
      fetchUserCreditsFromWeavy,
      showAuthAlert,
      recoverWeavySessionOn403: (targetAcc) => recoverWeavySessionOn403Helper({
        account: targetAcc || getActiveAccount(),
        accounts,
        syncSingleAccountFn: syncSingleAccount,
        exchangeRefreshTokenFn: exchangeRefreshToken,
        saveAccountsFn: saveAccounts,
        showAuthAlert,
      }),
      sbCharSheetModal,
      sbCharSheetPromptText,
      sbCharSheetModelSelect,
      sbCharSheetRatioSelect,
      sbCharSheetLoadingBox,
      sbCharSheetLoadingText,
      sbCharSheetProgressBar,
      sbCharSheetResultArea,
      sbCharSheetResultImg,
      btnGenerateCharSheet,
      btnGenerateCharSheetLabel,
      btnDownloadCharSheetResult,
      btnOpenCharSheetResult,
      sbCharSheetErrorAlert,
      sbCharSheetUploadedAsset,
      sbModelWeavyAsset,
      sbModelRefBase64,
      currentSbProject,
    });
    if (resUrl) {
      sbCharSheetResultUrl = resUrl;
    }
    return resUrl;
  }

  function applyCharSheetToTalent() {
    const finalUrl = sbCharSheetResultUrl || sbCharSheetResultImg?.src;
    if (!finalUrl || finalUrl.endsWith('#')) {
      showAuthAlert('Belum ada gambar karakter sheet yang digenerate.', 'error');
      return;
    }
    sbModelRefBase64 = finalUrl;
    sbModelWeavyAsset = { url: finalUrl, type: 'image' };
    applyStoryboardReferencePreview(
      { base64: sbModelRefBase64, weavyAsset: sbModelWeavyAsset },
      sbModelEmptyState,
      sbModelPreviewWrap,
      sbModelImg,
      { url: finalUrl, weavyAsset: sbModelWeavyAsset }
    );
    if (currentSbProject) {
      if (!currentSbProject.inputState) currentSbProject.inputState = {};
      currentSbProject.inputState.modelAsset = { url: finalUrl, weavyAsset: sbModelWeavyAsset };
      currentSbProject.modelAsset = { url: finalUrl, weavyAsset: sbModelWeavyAsset };
      handleSaveSbProject(false);
    }
    closeCharSheetModal();
    showAuthAlert('🎯 Karakter Sheet berhasil dipasang sebagai referensi Talent utama di Storyboard!', 'success');
  }

  // --- PRODUCT VARIATIONS STUDIO (Multi-Scene & Angle Staging) ---
  function openProductVariationsModal() {
    return openProductVariationsModalHelper({
      sbProductVariationsModal,
      sbProdVarsImgPreview,
      sbProdVarsEmptyIcon,
      sbProdVarsStatus,
      sbProdVarsNameInput,
      sbProdVarsDescInput,
      sbProdVarsBriefText,
      sbProductName,
      sbProductDesc,
      sbMainBrief,
      sbBriefInput,
      sbProductWeavyAsset,
      sbProductRefBase64,
      currentSbProject,
    });
  }

  function closeProductVariationsModal() {
    return closeProductVariationsModalHelper({ sbProductVariationsModal });
  }

  async function handleBuildProductVariationPrompts() {
    const productName = (sbProdVarsNameInput?.value || sbProductName?.value || 'Produk').trim();
    const productDesc = (sbProdVarsDescInput?.value || sbProductDesc?.value || '').trim();
    const settingBrief = (sbProdVarsBriefText?.value || sbMainBrief?.value || 'Meja marmer putih mewah dengan pencahayaan estetik').trim();
    const count = parseInt(sbProdVarsCountSelect?.value || '4', 10);
    const strategy = sbProdVarsStrategySelect?.value || 'multi_setting';
    const aspectRatio = sbProdVarsRatioSelect?.value || '9:16';
    const imageModel = sbProdVarsModelSelect?.value || 'gpt-image-2.5';
    const textModel = sbProdVarsTextModelSelect?.value || sbAiModel?.value || 'google/gemini-2.5-flash';

    const btn = btnBuildProdVarsPrompts || document.getElementById('btnBuildProdVarsPrompts');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="sb-save-loader" aria-hidden="true"></span> <span>AI (${textModel.split('/').pop()}) menyusun ${count} prompt...</span>`;
    }

    let prompts = [];

    try {
      const acc = getActiveAccount();
      const idToken = acc ? await getValidIdToken(acc).catch(() => null) : null;
      const isCustomGemini = (acc && acc.provider === 'gemini') || (textModel.startsWith('gemini/') && !idToken);
      const isCustomDola = (acc && acc.provider === 'dola') || (textModel.startsWith('dola/') && !idToken);

      const prodImg = sbProdVarsUploadedAsset || sbProductWeavyAsset || sbProductRefBase64 || null;

      const strategyDescMap = {
        multi_setting: 'Latar & Suasana Beragam sesuai tema brief utama (ruangan, sudut pandang, dan lighting berbeda di tiap variasi)',
        packshot_angles: 'Multi-Angle Commercial Packshot (Macro Detail, 45 Degree Angle, Top-Down Flatlay, First-Person POV)',
        tiktok_lifestyle: 'TikTok Lifestyle & Real Life Context (UGC Handheld, Hands-On Testing, Golden Hour Light, Vanity Staging)',
        minimalist_podium: 'Podium & Pedestal Mewah (Stone Pedestal, Geometric Pastel, Organic Leaf Shadow, Water Reflection)',
      };
      const strategyDesc = strategyDescMap[strategy] || strategy;

      const systemPrompt = `[System: Elite Commercial Product Photography AI Prompt Architect]
You are a world-class commercial product photographer, creative director, and master prompt engineer.
Your task is to generate exactly ${count} completely distinct, creative, and highly specific image generation prompts for ${imageModel} (aspect ratio ${aspectRatio}).

PRODUCT SPECIFICATIONS:
- Product Name: ${productName}
- Physical Details: ${productDesc || 'Exact product packaging, branding, textures, and shape'}
- Main Scene Brief / Concept: ${settingBrief}
- Visual Strategy: ${strategy} (${strategyDesc})

PROMPT COMPOSITION RULES:
1. Product Consistency Anchor: Every variation prompt MUST strictly start with "[PRODUCT ANCHOR: Maintain exact original packaging, label, typography, shape, materials, and colors of ${productName}${productDesc ? `, ${productDesc}` : ''}]".
2. Aspect ratio prefix: "${aspectRatio === '16:9' ? 'Horizontal 16:9 landscape' : aspectRatio === '1:1' ? 'Square 1:1 format' : `Vertical ${aspectRatio}`}".
3. Real Photography Realism: Describe real camera specs (e.g. Shot on Hasselblad X2D 100C or Sony A7 IV, 50mm / 85mm f/2.8 lens), precise lighting (softbox, diffused morning sunlight, rim light, caustic reflections), and rich surface textures. Do NOT use cheap CGI words like "8k", "photorealistic", or "octane render".
4. Make all ${count} variations clearly distinct in camera angle, depth of field, background setting, and visual mood while honoring the main brief.
5. Output language:
   - "title": Short title in Indonesian (e.g. "Variasi 1: Close-Up Macro Hero")
   - "desc": Short explanation in Indonesian (e.g. "Fokus tajam pada detail label kemasan dengan pencahayaan studio lembut")
   - "prompt": Complete, rich English prompt ready for the image generator.

OUTPUT FORMAT:
Return ONLY a valid JSON array of ${count} objects (no extra conversational text):
[
  {
    "index": 1,
    "title": "Variasi 1: ...",
    "desc": "Penjelasan singkat dalam Bahasa Indonesia...",
    "prompt": "..."
  }
]`;

      let aiRawResponse = '';

      if (idToken) {
        aiRawResponse = await callWeavyLLM({
          prompt: `Tolong susun ${count} variasi prompt foto produk profesional berkualitas tinggi untuk "${productName}" dengan konsep "${settingBrief}" sesuai instruksi arsitek prompt. Kembalikan dalam format JSON array.`,
          systemPrompt,
          model: textModel,
          idToken,
          refreshToken: acc?.refreshToken,
          history: [],
          images: prodImg ? [prodImg] : [],
        });
      } else if (isCustomGemini) {
        aiRawResponse = await executeGeminiChat({
          apiKey: acc?.apiKey,
          model: textModel,
          prompt: `${systemPrompt}\n\nTolong susun ${count} prompt foto produk profesional sekarang.`,
          history: [],
          referenceAssets: [],
        });
      } else if (isCustomDola) {
        const dolaRes = await executeDolaChat({
          prompt: `${systemPrompt}\n\nTolong susun ${count} prompt foto produk profesional sekarang.`,
          isPro: textModel === 'dola/pro',
          history: [],
          referenceAssets: [],
        });
        aiRawResponse = typeof dolaRes === 'object' ? (dolaRes.text || JSON.stringify(dolaRes)) : String(dolaRes);
      }

      if (aiRawResponse) {
        // Extract JSON array from codeblocks or raw text
        const jsonMatch = aiRawResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed) && parsed.length > 0) {
              prompts = parsed.map((item, i) => ({
                index: item.index || i + 1,
                title: item.title || `Variasi ${i + 1}`,
                desc: item.desc || '',
                prompt: item.prompt || '',
              })).slice(0, count);
            }
          } catch (pe) {
            console.warn('[JSON Parse Warning from AI]:', pe);
          }
        }
      }
    } catch (err) {
      console.warn('[AI Prompt Builder Error, using smart templates fallback]:', err);
    }

    // If AI generation didn't produce a full list, fallback to heuristic builder
    if (!prompts || prompts.length === 0) {
      prompts = buildProductVariationPromptsHelper({
        productName,
        productDesc,
        settingBrief,
        count,
        strategy,
        aspectRatio,
      });
    }

    renderProductVariationPromptCardsHelper(prompts, 'sbProdVarsPromptsList');
    if (sbProdVarsPromptsContainer) {
      sbProdVarsPromptsContainer.classList.remove('hidden');
    }

    if (btn) {
      btn.innerHTML = origHtml || '<span>✨ Sesuaikan & Susun Prompt Tiap Variasi</span>';
      btn.disabled = false;
    }

    showAuthAlert(`✨ AI Weavy (${textModel.split('/').pop()}) berhasil menyusun ${prompts.length} prompt variasi visual!`, 'success');
  }

  async function executeProductVariationsGeneration() {
    const results = await executeProductVariationsGenerationHelper({
      getActiveAccount,
      switchTab,
      getValidIdToken,
      uploadAssetToWeavy,
      getOrCreateWeavyRecipeId,
      callWeavyApi,
      approveWeavyModel,
      getWeavyClientHeaders,
      storage,
      extractMediaUrlFromObject,
      fetchUserCreditsFromWeavy,
      showAuthAlert,
      recoverWeavySessionOn403: (targetAcc) => recoverWeavySessionOn403Helper({
        account: targetAcc || getActiveAccount(),
        accounts,
        syncSingleAccountFn: syncSingleAccount,
        exchangeRefreshTokenFn: exchangeRefreshToken,
        saveAccountsFn: saveAccounts,
        showAuthAlert,
      }),
      sbProdVarsNameInput,
      sbProdVarsDescInput,
      sbProdVarsBriefText,
      sbProdVarsCountSelect,
      sbProdVarsStrategySelect,
      sbProdVarsModelSelect,
      sbProdVarsRatioSelect,
      sbProdVarsLoadingBox,
      sbProdVarsProgressBar,
      sbProdVarsLoadingText,
      sbProdVarsResultsArea,
      sbProdVarsResultsGrid,
      btnGenerateProductVariations,
      btnGenerateProductVariationsLabel,
      sbProdVarsErrorAlert,
      sbProdVarsUploadedAsset,
      sbProductWeavyAsset,
      sbProductRefBase64,
      currentSbProject,
    });
    if (results && results.length > 0) {
      sbProdVarsCurrentResults = results;
    }
    return results;
  }

  async function execute1SheetGeneration() {
    return execute1SheetGenerationHelper({
      getActiveAccount,
      switchTab,
      getValidIdToken,
      uploadAssetToWeavy,
      getOrCreateWeavyRecipeId,
      callWeavyApi,
      approveWeavyModel,
      getWeavyClientHeaders,
      handleSaveSbProject,
      storage,
      extractMediaUrlFromObject,
      fetchUserCreditsFromWeavy,
      showAuthAlert,
      recoverWeavySessionOn403: (targetAcc) => recoverWeavySessionOn403Helper({
        account: targetAcc || getActiveAccount(),
        accounts,
        syncSingleAccountFn: syncSingleAccount,
        exchangeRefreshTokenFn: exchangeRefreshToken,
        saveAccountsFn: saveAccounts,
        showAuthAlert,
      }),
      sbCompositePromptText,
      sbCompositeModelSelect,
      sbCompositeRatioSelect,
      sbCompositeLoadingBox,
      sbCompositeResultArea,
      sbCompositeErrorAlert,
      sbCompositeProgressBar,
      sbCompositeLoadingText,
      sbCompositeResultImg,
      btnGenerateCompositeGrid,
      btnGenerateCompositeLabel,
      btnDownloadCompositeResult,
      btnOpenCompositeResult,
      currentSbProject,
      sbProductRefBase64,
      sbProductWeavyAsset,
      sbModelRefBase64,
      sbModelWeavyAsset,
      sbBgRefBase64,
      sbBgWeavyAsset,
      sbCustomAssets,
      sbCompositeResultUrl,
    });
  }

  // --- PROMPTS EXPORT & HISTORY PERSISTENCE ---
  function handleCopyAllSbPrompts() {
    if (!currentSbProject || !currentSbProject.scenes) return;
    const text = currentSbProject.scenes.map((s) => {
      const cleanImgPrompt = sanitizeSceneImagePrompt(s.imagePrompt || '', s, currentSbProject);
      if (cleanImgPrompt && cleanImgPrompt !== s.imagePrompt) {
        s.imagePrompt = cleanImgPrompt;
        const card = document.getElementById(`card_${s.id}`);
        const promptBox = card?.querySelector('.sb-prompt-box');
        if (promptBox) promptBox.textContent = cleanImgPrompt;
        const copyBtn = card?.querySelector('.btn-copy-prompt');
        if (copyBtn) copyBtn.setAttribute('data-text', cleanImgPrompt);
      }

      return `--- SCENE ${s.sceneNumber} (${s.timecode}) ---
Kamera: ${s.cameraAngle}
Visual: ${s.visualDescription}
${s.voiceover ? `Voiceover: "${s.voiceover}"\n` : ''}${s.onScreenText ? `Teks di Layar: ${s.onScreenText}\n` : ''}Prompt Gambar:
${cleanImgPrompt}

Prompt Video:
${s.videoPrompt}
`;
    }).join('\n\n');

    navigator.clipboard.writeText(text);

    const btn = document.getElementById('btnCopyAllScenes');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success, #5ec98f)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> <span style="color:var(--success, #5ec98f);">Tersalin!</span>`;
      btn.disabled = true;
      setTimeout(() => {
        btn.innerHTML = orig;
        btn.disabled = false;
      }, 2000);
    }

    showAuthAlert('Seluruh script & prompt storyboard berhasil disalin ke clipboard!', 'success');
  }

  function handleCopyAllSbJson() {
    if (!currentSbProject || !Array.isArray(currentSbProject.scenes) || currentSbProject.scenes.length === 0) {
      showAuthAlert('Belum ada data storyboard untuk disalin.', 'error');
      return;
    }
    try {
      const exportScenes = currentSbProject.scenes.map((s, idx) => {
        const cleanPrompt = sanitizeSceneImagePrompt(s.imagePrompt || '', s, currentSbProject);
        if (cleanPrompt && cleanPrompt !== s.imagePrompt) {
          s.imagePrompt = cleanPrompt;
          const card = document.getElementById(`card_${s.id}`);
          const promptBox = card?.querySelector('.sb-prompt-box');
          if (promptBox) promptBox.textContent = cleanPrompt;
          const copyBtn = card?.querySelector('.btn-copy-prompt');
          if (copyBtn) copyBtn.setAttribute('data-text', cleanPrompt);
        }

        const item = {
          sceneNumber: s.sceneNumber || idx + 1,
          timecode: s.timecode || '',
          cameraAngle: s.cameraAngle || '',
          visualDescription: s.visualDescription || '',
          voiceover: s.voiceover || '',
          onScreenText: s.onScreenText || '',
          imagePrompt: cleanPrompt,
          videoPrompt: s.videoPrompt || '',
        };
        if (s.imageUrl) item.imageUrl = s.imageUrl;
        if (s.status) item.status = s.status;
        return item;
      });

      const jsonText = JSON.stringify(exportScenes, null, 2);

      const triggerSuccessUi = () => {
        const btn = document.getElementById('btnCopyAllScenesJson');
        if (btn) {
          const orig = btn.innerHTML;
          btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success, #5ec98f)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> <span style="color:var(--success, #5ec98f);">Tersalin!</span>`;
          btn.disabled = true;
          setTimeout(() => {
            btn.innerHTML = orig;
            btn.disabled = false;
          }, 2000);
        }
        showAuthAlert('📋 Data JSON seluruh scene berhasil disalin ke clipboard!', 'success');
      };

      const copyViaFallback = (str) => {
        try {
          const ta = document.createElement('textarea');
          ta.value = str;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        } catch (e) {
          console.warn('[Fallback Copy Warn]:', e);
        }
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(jsonText).then(triggerSuccessUi).catch((err) => {
          console.error('[Copy JSON Clipboard Error]:', err);
          copyViaFallback(jsonText);
          triggerSuccessUi();
        });
      } else {
        copyViaFallback(jsonText);
        triggerSuccessUi();
      }
    } catch (err) {
      console.error('[Export Storyboard JSON error]:', err);
      showAuthAlert('Gagal memproses JSON storyboard.', 'error');
    }
  }

  function makeStoryboardRevisionSnapshot(project, label = 'save') {
    if (!project) return null;
    const snapshot = {
      label,
      savedAt: new Date().toISOString(),
      name: project.name || 'Storyboard Baru',
      duration: Number(project.duration || 0),
      aspectRatio: project.aspectRatio || '9:16',
      scenes: JSON.parse(JSON.stringify(Array.isArray(project.scenes) ? project.scenes : [])),
    };
    return snapshot;
  }

  function pushStoryboardRevision(project, label = 'save') {
    if (!project) return;
    const snapshot = makeStoryboardRevisionSnapshot(project, label);
    if (!snapshot) return;
    const history = Array.isArray(project.revisionHistory) ? project.revisionHistory : [];
    const signature = JSON.stringify(snapshot);
    const isDuplicate = history.some((entry) => JSON.stringify(entry.snapshot || entry) === signature);
    if (isDuplicate) return;
    history.unshift({
      label,
      savedAt: snapshot.savedAt,
      snapshot,
    });
    project.revisionHistory = history.slice(0, 12);
  }

  async function restoreStoryboardRevision(index) {
    if (!currentSbProject || !Array.isArray(currentSbProject.revisionHistory) || !currentSbProject.revisionHistory[index]) return false;
    const revision = currentSbProject.revisionHistory[index];
    const snapshot = revision.snapshot || revision;
    if (!snapshot || !Array.isArray(snapshot.scenes)) return false;

    currentSbProject.name = snapshot.name || currentSbProject.name || 'Storyboard Baru';
    currentSbProject.duration = Number(snapshot.duration || currentSbProject.duration || 0);
    currentSbProject.aspectRatio = snapshot.aspectRatio || currentSbProject.aspectRatio || '9:16';
    currentSbProject.scenes = JSON.parse(JSON.stringify(snapshot.scenes));
    currentSbProject.updatedAt = new Date().toISOString();

    renderStoryboardProject(currentSbProject);
    await handleSaveSbProject(false);
    showAuthAlert(`Versi revisi "${revision.label || 'revisi'}" berhasil dipulihkan.`, 'success');
    return true;
  }

  function normalizeSavedStoryboardProject(project) {
    if (!project || typeof project !== 'object') return project;

    const normalizedScenes = Array.isArray(project.scenes)
      ? project.scenes.map((scene) => ({
          ...scene,
          id: scene.id || `scene_${scene.sceneNumber || Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          imageUrl: scene.imageUrl || scene.resultUrl || scene.previewUrl || null,
          status: scene.status || (scene.imageUrl || scene.resultUrl || scene.previewUrl ? 'completed' : 'idle'),
        }))
      : [];

    const normalizedInputState = project.inputState && typeof project.inputState === 'object'
      ? {
          ...project.inputState,
          productAsset: project.inputState.productAsset || project.productAsset || null,
          modelAsset: project.inputState.modelAsset || project.modelAsset || null,
          bgAsset: project.inputState.bgAsset || project.bgAsset || null,
          customAssets: Array.isArray(project.inputState.customAssets)
            ? project.inputState.customAssets.map((asset) => ({ ...asset }))
            : Array.isArray(project.customAssets)
              ? project.customAssets.map((asset) => ({ ...asset }))
              : [],
        }
      : {
          productAsset: project.productAsset || null,
          modelAsset: project.modelAsset || null,
          bgAsset: project.bgAsset || null,
          customAssets: Array.isArray(project.customAssets) ? project.customAssets.map((asset) => ({ ...asset })) : [],
        };

    return {
      ...project,
      scenes: normalizedScenes,
      inputState: normalizedInputState,
      compositeGridUrl: project.compositeGridUrl || project.outputUrl || null,
    };
  }

  async function persistCurrentStoryboardSelection() {
    if (!currentSbProject?.id) {
      await storage.set(CURRENT_SB_STORAGE_KEY, null);
      return;
    }
    await storage.set(CURRENT_SB_STORAGE_KEY, currentSbProject.id);
  }

  async function handleSaveSbProject(showToast = true, force = false) {
    if (!currentSbProject) return;
    const isAlreadySaved = Array.isArray(savedSbProjects) && savedSbProjects.some((project) => project.id === currentSbProject.id);
    if (!isAlreadySaved && !force) return false;
    currentSbProject = normalizeSavedStoryboardProject(currentSbProject);
    if (!Array.isArray(savedSbProjects)) savedSbProjects = [];

    const result = await handleSaveSbProjectHelper({
      currentSbProject,
      sbCompositeResultUrl,
      savedSbProjects,
      storage,
      renderSavedStoryboards,
      renderLibrary,
      showAuthAlert,
      getStoryboardFormSnapshot,
    }, showToast);

    await persistCurrentStoryboardSelection();
    return result;
  }

  async function loadSavedStoryboards() {
    const rawSavedProjects = (await storage.get('weavy_storyboards')) || [];
    savedSbProjects = Array.isArray(rawSavedProjects) ? rawSavedProjects.map(normalizeSavedStoryboardProject) : [];
    currentSbProject = null;
    activeSbScene = null;
    sbCompositeResultUrl = null;
    sbOutputSection?.classList.add('hidden');
    if (sbScenesGrid) sbScenesGrid.innerHTML = '';

    return renderSavedStoryboards();
  }

  function renderSavedStoryboards() {
    const currentSavedSbProjects = Array.isArray(savedSbProjects) ? savedSbProjects : [];

    return renderSavedStoryboardsHelper({
      sbSavedProjectsContainer,
      savedSbProjects: currentSavedSbProjects,
      escapeHtml,
      renderSavedStoryboardsUi,
      renderStoryboardProject,
      restoreStoryboardFormState,
      sbOutputSection,
      sbScenesGrid,
      showAuthAlert,
      storage,
      confirmDelete: confirmStoryboardDelete,
      confirmClear: confirmStoryboardDelete,
      setSavedSbProjects: (projects) => {
        savedSbProjects = Array.isArray(projects) ? projects : [];
      },
      setCurrentSbProject: (project) => {
        currentSbProject = project;
      },
      renderSavedStoryboards: renderSavedStoryboards,
      currentSbProject,
    });
  }

  async function handleClearSbHistory() {
    return handleClearSbHistoryHelper({
      savedSbProjects,
      sbOutputSection,
      sbScenesGrid,
      storage,
      renderSavedStoryboards,
      showAuthAlert,
      confirmClear: confirmStoryboardDelete,
      setSavedSbProjects: (projects) => {
        savedSbProjects = Array.isArray(projects) ? projects : [];
      },
      setCurrentSbProject: (project) => {
        currentSbProject = project;
      },
    });
  }

  // ==========================================================================
  // WIREFRAME V2: GENERATE TAB & SETTINGS SHEET CONTROLLER
  // ==========================================================================
  let currentGenMode = 'image'; // 'image' | 'video'
  let currentVideoDuration = '10s';
  let currentVideoType = 'Ingredients';
  let savedRecentGenerations = [];
  let flowReferenceUploadPromise = null;

  const getProviderModelCatalog = () => {
    if (activeProvider === 'flow') {
      return currentGenMode === 'video' ? FLOW_VIDEO_MODELS_V2 : FLOW_IMAGE_MODELS_V2;
    }
    if (activeProvider === 'dola') {
      return currentGenMode === 'video' ? DOLA_VIDEO_MODELS_V2 : DOLA_IMAGE_MODELS_V2;
    }
    return currentGenMode === 'video' ? VIDEO_MODELS_V2 : IMAGE_MODELS_V2;
  };

  const getFlowDefaultAspect = () => '9:16';
  const getFlowDefaultResolution = () => '1K';

  let selectedImageModel = IMAGE_MODELS_V2[0];
  let selectedVideoModel = VIDEO_MODELS_V2[0];
  let activeGeneratingTasks = [];
  const activeGeneratingTaskStorageKey = 'weavy_active_generating_tasks';
  let hiddenLibraryAssetKeys = new Set();
  let savedLibraryAssets = [];
  let savedLibraryMetadata = {};

  async function loadHiddenLibraryAssets() {
    const savedKeys = await storage.get('weavy_library_hidden_asset_keys');
    hiddenLibraryAssetKeys = new Set(Array.isArray(savedKeys) ? savedKeys : []);
  }

  async function loadSavedLibraryAssets() {
    const savedAssets = await storage.get('weavy_library_assets');
    savedLibraryAssets = Array.isArray(savedAssets) ? savedAssets : [];
  }

  async function loadSavedLibraryMetadata() {
    const meta = await storage.get('weavy_library_asset_metadata');
    savedLibraryMetadata = (meta && typeof meta === 'object' && !Array.isArray(meta)) ? meta : {};
  }

  async function loadRecentGenerations() {
    savedRecentGenerations = (await storage.get('weavy_recent_generations')) || [];
    renderRecentGenerations();
  }

  async function loadActiveGeneratingTask() {
    const savedTasks = await storage.get(activeGeneratingTaskStorageKey);
    activeGeneratingTasks = (Array.isArray(savedTasks) ? savedTasks : [])
      .filter((task) => Date.now() - (task.startedAt || 0) < 30 * 60 * 1000
        && ['queued', 'generating', 'failed'].includes(task.status));
    console.log('[weavy-flow][task] active tasks dipulihkan:', activeGeneratingTasks.map((task) => task.id));
  }

  async function persistActiveGeneratingTasks() {
    if (activeGeneratingTasks.length) {
      await storage.set(activeGeneratingTaskStorageKey, activeGeneratingTasks);
      console.log('[weavy-flow][task] active tasks tersimpan:', activeGeneratingTasks.map((task) => task.id));
    } else {
      await storage.remove(activeGeneratingTaskStorageKey);
      console.log('[weavy-flow][task] active tasks dihapus dari storage');
    }
  }

  async function saveRecentGeneration(item) {
    const newGen = buildRecentGenerationRecord(item, currentGenMode);
    if (!newGen) return;

    savedRecentGenerations.unshift(newGen);
    if (savedRecentGenerations.length > 60) {
      savedRecentGenerations = savedRecentGenerations.slice(0, 60);
    }

    await storage.set('weavy_recent_generations', savedRecentGenerations);
    renderRecentGenerations();
    renderLibrary();
  }

  function getLibraryAssets() {
    const assets = [];
    const seenUrls = new Set();
    const addAsset = (asset, source, fallbackName, fallbackRole = 'custom') => {
      const url = asset?.url || asset?.downloadUrl || asset?.thumbnailUrl;
      const key = url || asset?.id;
      if (!url || !key || hiddenLibraryAssetKeys.has(key) || seenUrls.has(url)) return;
      seenUrls.add(url);
      const meta = savedLibraryMetadata[key] || savedLibraryMetadata[url] || (asset?.id ? savedLibraryMetadata[asset.id] : null);
      assets.push({
        ...asset,
        id: asset.id || `library_${assets.length}`,
        url,
        thumbnailUrl: asset.thumbnailUrl || url,
        base64: asset.base64 || (url && url.startsWith('data:') ? url : undefined),
        dataUrl: asset.dataUrl || asset.base64 || (url && url.startsWith('data:') ? url : undefined),
        mime: asset.mime || asset.type || 'image/png',
        name: meta?.name || asset.name || fallbackName || 'Gambar referensi',
        source,
        role: meta?.role || asset.role || fallbackRole,
        talentNiche: meta?.talentNiche || asset.talentNiche || '',
        description: meta?.description || asset.description || '',
        tags: meta?.tags || asset.tags || [],
        updatedAt: meta?.updatedAt || asset.updatedAt,
      });
    };

    savedRecentGenerations.forEach((generation) => {
      (generation.referenceAssets || []).forEach((asset, index) => {
        addAsset(asset, 'Recent Generations', asset.name || `Referensi ${index + 1}`, asset.role || 'custom');
      });
    });

    savedLibraryAssets.forEach((asset) => {
      addAsset(asset, 'Library', asset.name || 'Library asset', asset.role || 'custom');
    });

    savedSbProjects.forEach((project) => {
      const inputState = project.inputState || {};
      [inputState.productAsset, inputState.modelAsset, inputState.bgAsset]
        .filter(Boolean)
        .forEach((asset, index) => {
          addAsset(asset.weavyAsset || asset, 'Storyboard', ['Produk', 'Model', 'Background'][index], ['product', 'model', 'background'][index]);
        });
      (inputState.customAssets || []).forEach((asset) => {
        addAsset(asset.weavyAsset || asset, 'Storyboard', asset.name || 'Custom asset', asset.role || 'custom');
      });
    });

    return assets;
  }

  async function handleSaveAssetMetadata(asset, updatedData) {
    const url = asset?.url || asset?.downloadUrl || asset?.thumbnailUrl;
    const key = url || asset?.id;
    if (!key) return;

    const newRecord = {
      ...(savedLibraryMetadata[key] || {}),
      ...updatedData,
      updatedAt: Date.now(),
    };
    savedLibraryMetadata[key] = newRecord;
    if (asset?.id && asset.id !== key) {
      savedLibraryMetadata[asset.id] = newRecord;
    }

    // Sync directly to savedLibraryAssets if exists
    savedLibraryAssets.forEach((storedAsset) => {
      const storedUrl = storedAsset?.url || storedAsset?.downloadUrl || storedAsset?.thumbnailUrl;
      if (storedUrl === url || storedAsset?.id === asset?.id) {
        Object.assign(storedAsset, updatedData);
      }
    });

    // Sync role and name to recent generations and storyboards if changed
    if (updatedData.role || updatedData.name) {
      savedRecentGenerations.forEach((generation) => {
        (generation.referenceAssets || []).forEach((reference) => {
          const referenceUrl = reference?.url || reference?.downloadUrl || reference?.thumbnailUrl;
          if (referenceUrl === url) {
            if (updatedData.role) reference.role = updatedData.role;
            if (updatedData.name) reference.name = updatedData.name;
          }
        });
      });

      savedSbProjects.forEach((project) => {
        const inputState = project.inputState || {};
        [inputState.productAsset, inputState.modelAsset, inputState.bgAsset, ...(inputState.customAssets || [])].forEach((storedAsset) => {
          const candidate = storedAsset?.weavyAsset || storedAsset;
          const candidateUrl = candidate?.url || candidate?.downloadUrl || candidate?.thumbnailUrl;
          if (candidateUrl === url) {
            if (storedAsset.weavyAsset) {
              if (updatedData.role) storedAsset.weavyAsset.role = updatedData.role;
              if (updatedData.name) storedAsset.weavyAsset.name = updatedData.name;
            } else {
              if (updatedData.role) storedAsset.role = updatedData.role;
              if (updatedData.name) storedAsset.name = updatedData.name;
            }
          }
        });
      });
    }

    await storage.set('weavy_library_asset_metadata', savedLibraryMetadata);
    await storage.set('weavy_library_assets', savedLibraryAssets);
    await storage.set('weavy_recent_generations', savedRecentGenerations);
    await storage.set('weavy_storyboards', savedSbProjects);

    renderLibrary();
    showAuthAlert(`Data & konteks AI untuk "${updatedData.name || asset.name}" berhasil disimpan!`, 'success');
  }

  async function updateLibraryAssetRole(asset, role) {
    const targetUrl = asset?.url;
    if (!targetUrl) return;

    // Also update savedLibraryMetadata
    const key = targetUrl || asset?.id;
    if (key) {
      savedLibraryMetadata[key] = {
        ...(savedLibraryMetadata[key] || {}),
        role,
        updatedAt: Date.now(),
      };
      await storage.set('weavy_library_asset_metadata', savedLibraryMetadata);
    }

    savedRecentGenerations.forEach((generation) => {
      (generation.referenceAssets || []).forEach((reference) => {
        const referenceUrl = reference?.url || reference?.downloadUrl || reference?.thumbnailUrl;
        if (referenceUrl === targetUrl) reference.role = role;
      });
    });

    savedLibraryAssets.forEach((storedAsset) => {
      const storedUrl = storedAsset?.url || storedAsset?.downloadUrl || storedAsset?.thumbnailUrl;
      if (storedUrl === targetUrl) storedAsset.role = role;
    });

    savedSbProjects.forEach((project) => {
      const inputState = project.inputState || {};
      [inputState.productAsset, inputState.modelAsset, inputState.bgAsset, ...(inputState.customAssets || [])].forEach((storedAsset) => {
        const candidate = storedAsset?.weavyAsset || storedAsset;
        const candidateUrl = candidate?.url || candidate?.downloadUrl || candidate?.thumbnailUrl;
        if (candidateUrl === targetUrl) {
          if (storedAsset.weavyAsset) storedAsset.weavyAsset.role = role;
          else storedAsset.role = role;
        }
      });
    });

    await storage.set('weavy_recent_generations', savedRecentGenerations);
    await storage.set('weavy_storyboards', savedSbProjects);
    await storage.set('weavy_library_assets', savedLibraryAssets);
    renderLibrary();
  }

  async function uploadAssetsToLibrary(fileList) {
    const files = getValidImageFiles(fileList);
    if (!files.length) return;

    let uploadedCount = 0;
    const account = getActiveAccount();
    const idToken = account ? await getValidIdToken(account).catch(() => null) : null;

    for (const file of files) {
      try {
        const rawBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error || new Error('Gagal membaca file.'));
          reader.readAsDataURL(file);
        });

        if (!rawBase64 || typeof rawBase64 !== 'string') continue;

        const cleanMime = file.type || 'image/png';
        const ext = cleanMime.includes('png') ? '.png' : cleanMime.includes('webp') ? '.webp' : '.jpg';
        let cleanName = file.name || `asset_${Date.now()}`;
        if (!/\.(png|jpe?g|webp|gif|svg)$/i.test(cleanName)) {
          cleanName = `${cleanName}${ext}`;
        }

        const newAsset = {
          id: `library_asset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: cleanName,
          url: rawBase64,
          thumbnailUrl: rawBase64,
          base64: rawBase64,
          dataUrl: rawBase64,
          mime: cleanMime,
          type: cleanMime,
          role: 'custom',
          source: 'Library',
          createdAt: Date.now(),
        };

        // If Weavy account is connected, optionally sync in background
        if (idToken) {
          uploadAssetToWeavy({ base64: rawBase64, name: cleanName }, idToken)
            .then((weavyRes) => {
              if (weavyRes?.url) {
                newAsset.weavyAsset = weavyRes;
                newAsset.url = weavyRes.url;
                storage.set('weavy_library_assets', savedLibraryAssets);
              }
            })
            .catch(() => {});
        }

        savedLibraryAssets.unshift(newAsset);
        uploadedCount += 1;
      } catch (error) {
        console.warn('[Library Upload Warning]:', error);
      }
    }

    if (uploadedCount) {
      await storage.set('weavy_library_assets', savedLibraryAssets);
      renderLibrary();
      showAuthAlert(`${uploadedCount} gambar berhasil disimpan di Library.`, 'success');
    } else {
      showAuthAlert('Tidak ada gambar yang berhasil disimpan ke Library.', 'error');
    }
  }

  async function handleAnalyzeAssetMetadata(asset, currentFormState = {}) {
    const imageUrl = asset?.dataUrl || asset?.base64 || asset?.url || asset?.thumbnailUrl;
    if (!imageUrl) {
      throw new Error('Gambar aset tidak ditemukan atau URL tidak valid.');
    }

    const systemPrompt = `[System Instruction: AI Vision & Creative Asset Context Analyst]
Anda adalah AI Vision Expert spesialis video komersial, TikTok Shop, dan storytelling storyboard.
Tugas Anda: Menganalisis gambar aset referensi visual ini dan merumuskan deskripsi konteks AI mendalam yang langsung siap digunakan oleh AI Storyboard & Video Generator.

ATURAN OUTPUT (WAJIB JSON VALID):
Kembalikan HANYA format JSON valid tanpa penjelasan tambahan di luar blok JSON:
\`\`\`json
{
  "role": "model",
  "talentNiche": "Niche/Peran spesifik (misal: Talent Wanita Casual & Ramah, Skincare Botol Serum, Dapur Minimalis Modern, dll)",
  "description": "Deskripsi detail 2-3 kalimat yang kaya konteks (mencakup ciri fisik/kemasan, gaya busana/warna, lighting/vibe, dan saran penggunaan dalam naskah iklan/storyboard).",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}
\`\`\``;

    const currentName = currentFormState.name || asset.name || '';
    const currentRole = currentFormState.role || asset.role || 'custom';
    const currentNiche = currentFormState.talentNiche || asset.talentNiche || '';

    const userPrompt = `Tolong analisis gambar referensi aset visual ini secara mendalam:
- Nama / Persona: "${currentName || 'Aset Visual'}"
- Kategori role saat ini: "${currentRole}"
- Niche saat ini: "${currentNiche || 'Belum ditentukan'}"

Buatkan deskripsi konteks AI terbaik, niche yang spesifik, role yang paling sesuai (model/product/background/props/custom), dan 4-6 kata kunci relevan dalam Bahasa Indonesia.`;

    let rawAIOutput = '';

    // Strategy 1: Server-side Gemini Vision API (independent of Claude/Weavy accounts)
    try {
      const resp = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userPrompt,
          systemInstruction: systemPrompt,
          referenceAssets: [{ dataUrl: imageUrl, name: currentName || 'image.png' }],
        }),
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json && json.text) {
          rawAIOutput = json.text;
        }
      }
    } catch (apiErr) {
      console.warn('[AI Vision] Gemini direct call error:', apiErr);
    }

    // Strategy 2: Fallback to Weavy LLM if account is connected
    if (!rawAIOutput) {
      const acc = getActiveAccount();
      if (acc) {
        const idToken = await getValidIdToken(acc).catch(() => null);
        if (idToken) {
          const imageRef = asset.weavyAsset || {
            url: asset.url || asset.thumbnailUrl,
            base64: asset.base64,
            name: asset.name || 'Visual Reference',
            type: 'image',
          };
          rawAIOutput = await callWeavyLLM({
            prompt: userPrompt,
            systemPrompt,
            model: 'google/gemini-2.5-flash',
            idToken,
            refreshToken: acc.refreshToken,
            history: [{ role: 'user', content: userPrompt }],
            images: [imageRef],
          }).catch(() => '');
        }
      }
    }

    if (!rawAIOutput) {
      throw new Error('Tidak ada respon dari AI Vision. Pastikan koneksi internet atau server aktif.');
    }

    const cleaned = rawAIOutput
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsed = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      const match = rawAIOutput.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (err) {}
      }
    }

    if (parsed && (parsed.description || parsed.talentNiche)) {
      return {
        role: parsed.role || currentRole,
        talentNiche: parsed.talentNiche || '',
        description: parsed.description || '',
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      };
    }

    return {
      role: currentRole,
      talentNiche: '',
      description: cleaned.slice(0, 300),
      tags: [],
    };
  }

  async function hideLibraryAsset(asset) {
    const key = asset?.url || asset?.downloadUrl || asset?.thumbnailUrl || asset?.id;
    if (!key) return;
    hiddenLibraryAssetKeys.add(key);
    await storage.set('weavy_library_hidden_asset_keys', Array.from(hiddenLibraryAssetKeys));
    renderLibrary();
    showAuthAlert('Asset disembunyikan dari Library. Asset Weavy tetap aman.', 'info');
  }

  function renderLibrary() {
    renderLibraryUi({
      container: libraryContent,
      assets: getLibraryAssets(),
      escapeHtml,
      onPreview: (asset) => showMediaLightbox(asset),
      onRoleChange: (asset, role) => updateLibraryAssetRole(asset, role),
      onEditMetadata: (asset) => {
        openAssetMetadataModal({
          documentRef: document,
          asset,
          escapeHtml,
          onSave: handleSaveAssetMetadata,
          onAnalyze: handleAnalyzeAssetMetadata,
        });
      },
      onDelete: (asset) => hideLibraryAsset(asset),
      onUpload: uploadAssetsToLibrary,
      onUseGenerator: (asset) => {
        currentGenRefImages = [{
          id: `library_ref_${Date.now()}`,
          name: asset.name || 'Library reference',
          base64: asset.thumbnailUrl || asset.url,
          asset,
          referenceRole: asset.role || 'custom',
          isUploading: false,
          showCheckmark: false,
          error: null,
        }];
        renderGenRefGallery();
        switchTab('generate');
        showAuthAlert(`Gambar "${asset.name}" siap digunakan di Generator.`, 'success');
      },
    });
  }

  function openImageSourcePicker(options = {}) {
    openImageSourcePickerUi({
      documentRef: document,
      assets: getLibraryAssets(),
      escapeHtml,
      ...options,
    });
  }

  function restoreRecentGenerationReferences(item) {
    const referenceAssets = Array.isArray(item?.referenceAssets) ? item.referenceAssets : [];
    currentGenRefImages = referenceAssets.map((asset, idx) => ({
      id: `reused_ref_${Date.now()}_${idx}`,
      name: asset.name || `Referensi ${idx + 1}`,
      base64: asset.thumbnailUrl || asset.url || '',
      asset: { ...asset, type: asset.type || 'image' },
      isUploading: false,
      showCheckmark: false,
      error: null,
    }));
    renderGenRefGallery();
    showAuthAlert(
      referenceAssets.length > 0
        ? 'Prompt, model, dan foto referensi Weavy berhasil dipulihkan ke Generator.'
        : 'Prompt dan pengaturan berhasil diterapkan ke Generator.',
      'success'
    );
  }

  async function deleteRecentGeneration(id, kind = 'saved') {
    if (!id) return;

    if (kind === 'active') {
      activeGeneratingTasks = activeGeneratingTasks.filter((task) => task.id !== id);
      await persistActiveGeneratingTasks();
    } else {
      savedRecentGenerations = savedRecentGenerations.filter((item) => item.id !== id);
      await storage.set('weavy_recent_generations', savedRecentGenerations);
    }

    renderRecentGenerations();
  }

  function renderRecentGenerations() {
    renderRecentGenerationsUi({
      savedRecentGenerations,
      activeGeneratingTasks,
      gridEl: document.getElementById('recentGenerationsGrid'),
      escapeHtml,
      createRecentGenerationCardHtml,
      showMediaLightbox,
      downloadMediaBlob,
      genPromptInput,
      applyAspectRatio,
      applyModelSelection,
      onDeleteGeneration: deleteRecentGeneration,
      navigatorRef: navigator,
    });

    const grid = document.getElementById('recentGenerationsGrid');
    if (!grid) return;

    bindRecentGenerationActions({
      gridEl: grid,
      savedRecentGenerations,
      showMediaLightbox,
      downloadMediaBlob,
      genPromptInput,
      applyAspectRatio,
      applyModelSelection,
      showAuthAlert,
      navigatorRef: navigator,
      onAfterApply: restoreRecentGenerationReferences,
    });
  }

  function showMediaLightbox(target, fallbackType = 'image') {
    showMediaLightboxUi({
      target,
      fallbackType,
      savedRecentGenerations,
      genPromptInput,
      applyAspectRatio,
      applyModelSelection,
      downloadMediaBlob,
      showAuthAlert,
      documentRef: document,
      navigatorRef: navigator,
    });
  }

  function renderAllHistoryModal() {
    renderAllHistoryModalUi({
      allGrid: document.getElementById('allHistoryGrid'),
      savedRecentGenerations,
      escapeHtml,
      showMediaLightbox: ({ target, ...rest }) => showMediaLightboxUi({
        target,
        ...rest,
        savedRecentGenerations,
        genPromptInput,
        applyAspectRatio,
        applyModelSelection,
        downloadMediaBlob,
        showAuthAlert,
        documentRef: document,
        navigatorRef: navigator,
      }),
      downloadMediaBlob,
      genPromptInput,
      applyAspectRatio,
      applyModelSelection,
      showAuthAlert,
    });

    const allHistoryModal = document.getElementById('allRecentGenerationsModal');
    const allGrid = document.getElementById('allHistoryGrid');
    if (allGrid) {
      bindRecentGenerationActions({
        gridEl: allGrid,
        savedRecentGenerations,
        showMediaLightbox,
        downloadMediaBlob,
        genPromptInput,
        applyAspectRatio,
        applyModelSelection,
        showAuthAlert,
        navigatorRef: navigator,
        modalEl: allHistoryModal,
        onAfterApply: restoreRecentGenerationReferences,
      });
    }
  }

  function applyAspectRatio(aspect) {
    return applyAspectRatioHelper(aspect, {
      valAspect: document.getElementById('valAspect'),
      genAspectSelect,
    });
  }

  function applyResolution(res) {
    if (currentGenMode === 'video') {
      const allowedVideoRes = ['360p', '720p', '1080p'];
      if (!allowedVideoRes.includes(res)) {
        res = activeProvider === 'dola' ? '1080p' : '720p';
      }
    }
    return applyResolutionHelper(res, {
      valResolution: document.getElementById('valResolution'),
      genResolutionSelect,
    });
  }

  function applyVideoDuration(duration) {
    const allowedDurations = ['4s', '5s', '6s', '8s', '10s'];
    currentVideoDuration = allowedDurations.includes(duration) ? duration : '10s';
    const valDuration = document.getElementById('valVideoDuration');
    if (valDuration) valDuration.textContent = currentVideoDuration;
    return currentVideoDuration;
  }

  function applyVideoType(videoType) {
    currentVideoType = videoType === 'Frames' ? 'Frames' : 'Ingredients';
    const valVideoType = document.getElementById('valVideoType');
    if (valVideoType) valVideoType.textContent = currentVideoType;
    return currentVideoType;
  }

  function syncGenerationProviderUi() {
    const providerName = getProviderLabel(activeProvider);
    const btnModeVideo = document.getElementById('btnModeVideo');
    const valProvider = document.getElementById('valProvider');
    const subbarProviderName = document.getElementById('subbarProviderName');
    const providerLogo = document.getElementById('valProviderLogo') || document.querySelector('.weavy-logo-icon');
    const subLogo = document.querySelector('.weavy-sub-logo');

    if (valProvider) valProvider.textContent = providerName;
    if (subbarProviderName) subbarProviderName.textContent = providerName;
    const providerIconUrl =
      activeProvider === 'flow'
        ? 'https://labs.google/favicon.ico'
        : activeProvider === 'dola'
        ? 'https://sf-flow-web-cdn.ciciai.com/obj/ocean-flow-web-sg/dola_web/favicon-dola.png'
        : activeProvider === 'gemini'
        ? 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg'
        : 'https://cdn.prod.website-files.com/681b040781d5b5e278a69989/6829dad31872740b3fb4f912_favicon.svg';

    if (providerLogo) {
      providerLogo.src = providerIconUrl;
      providerLogo.alt = `${providerName} logo`;
    }
    if (subLogo) {
      subLogo.src = providerIconUrl;
      subLogo.alt = `${providerName} logo`;
    }

    // Sync menu account provider tab pills in background
    document.querySelectorAll('.provider-tab-pill').forEach((pill) => {
      const p = pill.dataset.provider;
      pill.classList.toggle('active', p === activeProvider);
    });

    // Highlight selected provider in pickerProviderModal
    document.querySelectorAll('#pickerProviderList .provider-option').forEach((opt) => {
      const p = opt.getAttribute('data-provider');
      opt.classList.toggle('selected', p === activeProvider);
    });

    // Fast / Pro Tier Toggle is strictly exclusive to Dola AI provider
    const isDola = activeProvider === 'dola';
    const wrapGenTierToggle = document.getElementById('wrapGenTierToggle');
    const rowSelectTier = document.getElementById('rowSelectTier');
    wrapGenTierToggle?.classList.toggle('hidden', !isDola);
    rowSelectTier?.classList.toggle('hidden', !isDola);

    const isVideoSupported = activeProvider === 'flow' || activeProvider === 'dola';
    btnModeVideo?.classList.toggle('hidden', !isVideoSupported);
    if (btnModeVideo) btnModeVideo.disabled = !isVideoSupported;

    if (!isVideoSupported && currentGenMode === 'video') {
      setGenerationMode('image');
    }

    const videoTypeRow = document.getElementById('rowSelectVideoType');
    const durationRow = document.getElementById('rowSelectDuration');
    const resolutionRow = document.getElementById('rowSelectResolution');
    if (activeProvider === 'dola') {
      resolutionRow?.classList.add('hidden');
    } else {
      resolutionRow?.classList.remove('hidden');
    }

    if (activeProvider === 'flow') {
      if (currentGenMode === 'video') {
        const flowVid = FLOW_VIDEO_MODELS_V2.find((m) => m.id === selectedVideoModel?.id) || FLOW_VIDEO_MODELS_V2[0];
        selectedVideoModel = flowVid;
        applyModelSelection(flowVid.id);
        applyAspectRatio('9:16');
        applyResolution('720p');
        applyVideoDuration(currentVideoDuration || '8s');
        applyVideoType(currentVideoType || 'Ingredients');
        videoTypeRow?.classList.remove('hidden');
        durationRow?.classList.remove('hidden');
      } else {
        const flowImg = FLOW_IMAGE_MODELS_V2.find((m) => m.id === selectedImageModel?.id) || FLOW_IMAGE_MODELS_V2[0];
        selectedImageModel = flowImg;
        applyModelSelection(flowImg.id);
        applyAspectRatio(getFlowDefaultAspect());
        applyResolution(getFlowDefaultResolution());
        videoTypeRow?.classList.add('hidden');
        durationRow?.classList.add('hidden');
      }
      return;
    }

    if (activeProvider === 'dola') {
      videoTypeRow?.classList.add('hidden'); // Video Type is Flow-only
      resolutionRow?.classList.add('hidden');
      const isPro = document.getElementById('btnTierPro')?.classList.contains('active') || document.getElementById('btnQuickTierLabel')?.textContent === 'Pro';
      if (typeof syncTierUiState === 'function') {
        syncTierUiState(isPro ? 'pro' : 'fast');
      }
      if (currentGenMode === 'video') {
        const dolaVid = DOLA_VIDEO_MODELS_V2.find((m) => m.id === selectedVideoModel?.id) || DOLA_VIDEO_MODELS_V2[0];
        selectedVideoModel = dolaVid;
        applyModelSelection(dolaVid.id);
        applyAspectRatio('9:16');
        applyResolution('1080p');
        applyVideoDuration(currentVideoDuration || '10s');
        if (isPro) {
          durationRow?.classList.add('hidden');
        } else {
          durationRow?.classList.remove('hidden');
        }
      } else {
        const dolaImg = DOLA_IMAGE_MODELS_V2.find((m) => m.id === selectedImageModel?.id) || DOLA_IMAGE_MODELS_V2[0];
        selectedImageModel = dolaImg;
        applyModelSelection(dolaImg.id);
        applyAspectRatio('9:16');
        applyResolution('1080p');
        durationRow?.classList.add('hidden');
      }
      return;
    }

    // Weavy AI provider
    videoTypeRow?.classList.add('hidden');
    if (currentGenMode === 'video') {
      const weavyVid = VIDEO_MODELS_V2.find((m) => m.id === selectedVideoModel?.id) || VIDEO_MODELS_V2[0];
      selectedVideoModel = weavyVid;
      applyModelSelection(weavyVid.id);
      applyAspectRatio('9:16');
      applyResolution('720p');
      durationRow?.classList.remove('hidden');
    } else {
      const selectedModelValue = String(selectedImageModel?.value || '');
      const isExternalModel = selectedModelValue.startsWith('nano-banana-') || selectedModelValue.startsWith('seedream_') || selectedModelValue.startsWith('seedance_') || selectedModelValue.startsWith('google-flow-');
      if (!selectedImageModel || isExternalModel) {
        selectedImageModel = IMAGE_MODELS_V2[0];
      }
      applyModelSelection(selectedImageModel.id || IMAGE_MODELS_V2[0].id);
      applyAspectRatio('9:16');
      applyResolution('1K');
      durationRow?.classList.add('hidden');
    }
  }

  function applyModelSelection(modelKeyOrId) {
    const isVid = currentGenMode === 'video';
    const target = applyModelSelectionHelper(modelKeyOrId, {
      currentGenMode,
      activeProvider,
      getModelIconHtml,
      escapeHtml,
      genModelSelect,
      valModelName: document.getElementById('valModelName'),
      valModelEmoji: document.getElementById('valModelEmoji'),
      subbarModelName: document.getElementById('subbarModelName'),
      bannerEmoji: document.getElementById('bannerEmoji'),
      bannerText: document.getElementById('bannerText'),
      IMAGE_MODELS_V2: activeProvider === 'flow' ? FLOW_IMAGE_MODELS_V2 : (activeProvider === 'dola' ? DOLA_IMAGE_MODELS_V2 : IMAGE_MODELS_V2),
      VIDEO_MODELS_V2: activeProvider === 'flow' ? FLOW_VIDEO_MODELS_V2 : (activeProvider === 'dola' ? DOLA_VIDEO_MODELS_V2 : VIDEO_MODELS_V2),
    });

    if (isVid) selectedVideoModel = target;
    else selectedImageModel = target;
    return target;
  }

  function setGenerationMode(mode) {
    const isVideoSupported = activeProvider === 'flow' || activeProvider === 'dola';
    const requestedMode = mode === 'video' && !isVideoSupported ? 'image' : mode;
    const nextMode = setGenerationModeHelper(requestedMode, {
      btnVideo: document.getElementById('btnModeVideo'),
      btnImage: document.getElementById('btnModeImage'),
      btnSubmit: document.getElementById('btnSubmitGenerate'),
      noteModeLabel: document.getElementById('noteModeLabel'),
      currentGenMode,
      selectedImageModel,
      selectedVideoModel,
      IMAGE_MODELS_V2: activeProvider === 'flow' ? FLOW_IMAGE_MODELS_V2 : (activeProvider === 'dola' ? DOLA_IMAGE_MODELS_V2 : IMAGE_MODELS_V2),
      VIDEO_MODELS_V2: activeProvider === 'flow' ? FLOW_VIDEO_MODELS_V2 : (activeProvider === 'dola' ? DOLA_VIDEO_MODELS_V2 : VIDEO_MODELS_V2),
      getModelIconHtml,
      escapeHtml,
      onUpdateMode: (next) => {
        currentGenMode = next;
        const durationRow = document.getElementById('rowSelectDuration');
        durationRow?.classList.toggle('hidden', next !== 'video');
        const videoTypeRow = document.getElementById('rowSelectVideoType');
        videoTypeRow?.classList.toggle('hidden', next !== 'video' || activeProvider !== 'flow');
        if (next === 'video') {
          const catalog = activeProvider === 'flow' ? FLOW_VIDEO_MODELS_V2 : (activeProvider === 'dola' ? DOLA_VIDEO_MODELS_V2 : VIDEO_MODELS_V2);
          const target = catalog.find((m) => m.id === selectedVideoModel?.id) || catalog[0];
          selectedVideoModel = target;
          applyModelSelection(target.id);
          applyVideoDuration(currentVideoDuration || (activeProvider === 'flow' ? '8s' : '10s'));
          if (activeProvider === 'flow') {
            applyVideoType(currentVideoType || 'Ingredients');
            applyAspectRatio('9:16');
            applyResolution('720p');
          } else if (activeProvider === 'dola') {
            applyAspectRatio('9:16');
            applyResolution('1080p');
          }
        } else {
          const catalog = activeProvider === 'flow' ? FLOW_IMAGE_MODELS_V2 : (activeProvider === 'dola' ? DOLA_IMAGE_MODELS_V2 : IMAGE_MODELS_V2);
          const target = catalog.find((m) => m.id === selectedImageModel?.id) || catalog[0];
          selectedImageModel = target;
          applyModelSelection(target.id);
          if (activeProvider === 'flow') {
            applyAspectRatio(getFlowDefaultAspect());
            applyResolution(getFlowDefaultResolution());
          }
        }
      },
    });
    return nextMode;
  }

  function renderModelPickerOptions() {
    const catalog = activeProvider === 'flow' 
      ? (currentGenMode === 'video' ? FLOW_VIDEO_MODELS_V2 : FLOW_IMAGE_MODELS_V2) 
      : activeProvider === 'dola'
        ? (currentGenMode === 'video' ? DOLA_VIDEO_MODELS_V2 : DOLA_IMAGE_MODELS_V2)
        : (currentGenMode === 'video' ? VIDEO_MODELS_V2 : IMAGE_MODELS_V2);

    renderModelPickerOptionsHelper({
      currentGenMode,
      selectedImageModel,
      selectedVideoModel,
      IMAGE_MODELS_V2: activeProvider === 'flow' ? FLOW_IMAGE_MODELS_V2 : (activeProvider === 'dola' ? DOLA_IMAGE_MODELS_V2 : IMAGE_MODELS_V2),
      VIDEO_MODELS_V2: activeProvider === 'flow' ? FLOW_VIDEO_MODELS_V2 : (activeProvider === 'dola' ? DOLA_VIDEO_MODELS_V2 : VIDEO_MODELS_V2),
      getModelIconHtml,
      escapeHtml,
      listEl: document.getElementById('pickerModelList'),
      onSelect: (id) => {
        applyModelSelection(id);
        document.getElementById('pickerModelModal')?.classList.add('hidden');
      },
    });
    const pickerHeader = document.getElementById('pickerModelHeaderTitle');
    if (pickerHeader) {
      pickerHeader.textContent = activeProvider === 'flow' 
        ? 'Pilih Model AI Flow' 
        : activeProvider === 'dola'
          ? 'Pilih Model AI Dola (ByteDance)'
          : 'Pilih Model AI';
    }
  }

  function applyTierSelection(tier) {
    if (activeProvider !== 'dola') return null;
    const target = applyTierSelectionHelper(tier, {
      currentGenMode,
      activeProvider,
      IMAGE_MODELS_V2: DOLA_IMAGE_MODELS_V2,
      VIDEO_MODELS_V2: DOLA_VIDEO_MODELS_V2,
      applyModelSelectionFn: applyModelSelection,
    });
    return target;
  }

  window.applyTierSelection = applyTierSelection;
  window.syncTierUiState = syncTierUiState;

  function initGenerateWorkspaceV2() {
    const workspace = initGenerateWorkspaceV2Helper({
      documentRef: document,
      getCurrentGenRefImages: () => currentGenRefImages,
      setCurrentGenRefImages: (next) => {
        currentGenRefImages = next;
      },
      handleAddGenRefFiles,
      renderGenRefGallery,
      showAuthAlert,
      applyAspectRatio,
      applyResolution,
      applyVideoDuration,
      applyVideoType,
      applyModelSelection,
      setGenerationMode,
      renderModelPickerOptions,
      renderRecentGenerations,
      renderAllHistoryModal,
      storage,
      escapeHtml,
      getModelIconHtml,
      showMediaLightbox,
      downloadMediaBlob,
      openImageSourcePicker,
      replaceReferenceImages: () => activeProvider === 'flow',
    });

    bindGeneratorSettingsModal({
      documentRef: document,
      renderModelPickerOptions,
      applyAspectRatio,
      applyResolution,
      applyVideoDuration,
      applyVideoType,
      applyTierSelection,
      setGenerationMode,
      showAuthAlert,
      closeLightbox: () => {
        const mediaLightboxModal = document.getElementById('mediaLightboxModal');
        const lightboxVideo = document.getElementById('lightboxVideo');
        mediaLightboxModal?.classList.add('hidden');
        if (lightboxVideo) {
          lightboxVideo.pause();
          lightboxVideo.src = '';
        }
      },
    });

    return workspace;
  }

  // --- INITIALIZATION ---
  async function init() {
    initEvents();

    // Load Theme
    const savedTheme = await storage.get('weavy_theme');
    if (savedTheme === 'light') {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
    }

    await loadAccounts();
    await loadChatSessions();
    await initChatProviderModel({
      providerSelectEl: chatProviderSelect,
      modelSelectEl: chatModelSelect,
      storage,
      onModelChange: (modelId, providerId) => {
        if (providerId === 'gemini' || modelId.startsWith('gemini/')) {
          switchGeminiModelInTab(modelId).catch((err) => {
            console.warn('[Menu Chat] Gagal sinkronisasi model ke tab Gemini:', err);
          });
        }
      },
    });
    await initStoryboardCopilotProviderModel({
      providerSelectEl: document.getElementById('storyboardCopilotProviderSelect'),
      modelSelectEl: document.getElementById('storyboardCopilotModelSelect'),
      storage,
    });
    await loadSavedStoryboards();
    await loadActiveGeneratingTask();
    await loadRecentGenerations();
    await loadHiddenLibraryAssets();
    await loadSavedLibraryAssets();
    await loadSavedLibraryMetadata();
    renderLibrary();

    initGenerateWorkspaceV2();
    syncGenerationProviderUi();
  }

  init();
})();