export function applyAspectRatio(aspect, dependencies = {}) {
  const { valAspect, genAspectSelect } = dependencies;
  if (valAspect) {
    let label = aspect;
    if (aspect === '9:16') label = '9:16 (Vertical)';
    else if (aspect === '16:9') label = '16:9 (Landscape)';
    else if (aspect === '1:1') label = '1:1 (Square)';
    else if (aspect === '4:3') label = '4:3 (Standard Photo)';
    else if (aspect === '3:4') label = '3:4 (Portrait Photo)';
    valAspect.textContent = label;
  }
  if (genAspectSelect && aspect) {
    genAspectSelect.value = aspect;
  }
}

export function applyResolution(resolution, dependencies = {}) {
  const { valResolution, genResolutionSelect } = dependencies;
  if (valResolution) {
    valResolution.textContent = resolution;
  }
  if (genResolutionSelect && resolution) {
    genResolutionSelect.value = resolution;
  }
}

export function syncTierUiState(tier = 'fast') {
  const isFast = tier === 'fast';
  const activeProvider = (typeof window !== 'undefined' ? window.activeProvider : 'weavy');
  
  // Segmented control buttons in settings modal
  const btnTierFast = document.getElementById('btnTierFast');
  const btnTierPro = document.getElementById('btnTierPro');
  if (btnTierFast && btnTierPro) {
    btnTierFast.classList.toggle('active', isFast);
    btnTierPro.classList.toggle('active', !isFast);
  }

  // Quick toggle in prompt action bar
  const btnQuickTierIcon = document.getElementById('btnQuickTierIcon');
  const btnQuickTierLabel = document.getElementById('btnQuickTierLabel');
  if (btnQuickTierIcon) btnQuickTierIcon.textContent = isFast ? '⚡' : '💎';
  if (btnQuickTierLabel) btnQuickTierLabel.textContent = isFast ? 'Fast' : 'Pro';

  // Popover menu items
  const optTierFast = document.getElementById('optTierFast');
  const optTierPro = document.getElementById('optTierPro');
  const checkTierFast = document.getElementById('checkTierFast');
  const checkTierPro = document.getElementById('checkTierPro');

  if (optTierFast && optTierPro) {
    optTierFast.classList.toggle('active', isFast);
    optTierPro.classList.toggle('active', !isFast);
  }
  if (checkTierFast && checkTierPro) {
    checkTierFast.classList.toggle('hidden', !isFast);
    checkTierPro.classList.toggle('hidden', isFast);
  }

  // Target rows in settings modal
  const rowSelectModel = document.getElementById('rowSelectModel');
  const rowSelectAspect = document.getElementById('rowSelectAspect');
  const rowSelectResolution = document.getElementById('rowSelectResolution');
  const rowSelectDuration = document.getElementById('rowSelectDuration');
  const subbarModelName = document.getElementById('subbarModelName');
  const valModelName = document.getElementById('valModelName');
  const bannerEmoji = document.getElementById('bannerEmoji');
  const bannerText = document.getElementById('bannerText');

  // Adapt settings sheet model row for Dola AI
  if (activeProvider === 'dola') {
    // Resolution disembunyikan untuk Dola AI (karena di Dola tidak ada pilihan resolusi)
    rowSelectResolution?.classList.add('hidden');

    if (!isFast) {
      // Pro Mode: Sembunyikan Model, Aspect Ratio, Resolution & Duration agar bersih & rapi
      rowSelectModel?.classList.add('hidden');
      rowSelectAspect?.classList.add('hidden');
      rowSelectDuration?.classList.add('hidden');

      if (valModelName) valModelName.textContent = 'Pro (Unified Auto)';
      if (subbarModelName) {
        subbarModelName.textContent = '💎 Pro (Auto)';
      }
      if (bannerEmoji) bannerEmoji.textContent = '💎';
      if (bannerText) {
        bannerText.innerHTML = '✨ <strong>Dola Pro Mode</strong> &mdash; Menggunakan model flagship ByteDance terpadu secara otomatis dengan kualitas sinematik & detail tertinggi.';
      }
    } else {
      // Fast Mode: Tampilkan kembali Model & Aspect Ratio (dan Duration jika mode video)
      rowSelectModel?.classList.remove('hidden');
      rowSelectAspect?.classList.remove('hidden');
      // Resolution tetap disembunyikan untuk Dola AI
      rowSelectResolution?.classList.add('hidden');

      const isVideo = document.getElementById('btnModeVideo')?.classList.contains('active');
      if (rowSelectDuration) {
        rowSelectDuration.classList.toggle('hidden', !isVideo);
      }

      const optionChevron = rowSelectModel?.querySelector('.option-chevron');
      if (optionChevron) {
        optionChevron.textContent = '>';
      }
      if (subbarModelName && valModelName) {
        subbarModelName.textContent = valModelName.textContent || 'Fast Model';
      }
    }
  } else {
    // Non-Dola providers
    rowSelectModel?.classList.remove('hidden');
    rowSelectAspect?.classList.remove('hidden');
    rowSelectResolution?.classList.remove('hidden');
  }
}

export function detectModelTier(model) {
  if (!model) return 'fast';
  const name = (model.name || '').toLowerCase();
  const id = (model.id || '').toLowerCase();
  const val = (model.value || '').toLowerCase();
  const badge = (model.badge || '').toLowerCase();

  if (
    name.includes('pro') ||
    name.includes('quality') ||
    name.includes('5.0') ||
    name.includes('2.5') ||
    id.includes('pro') ||
    id.includes('quality') ||
    id.includes('2_5') ||
    id.includes('v5') ||
    val.includes('pro') ||
    badge.includes('pro') ||
    badge.includes('1080p')
  ) {
    return 'pro';
  }
  return 'fast';
}

export function applyModelSelection(modelKeyOrId, dependencies = {}) {
  const {
    currentGenMode,
    activeProvider = (typeof window !== 'undefined' ? window.activeProvider : 'weavy'),
    selectedImageModel,
    selectedVideoModel,
    IMAGE_MODELS_V2 = [],
    VIDEO_MODELS_V2 = [],
    getModelIconHtml,
    escapeHtml,
    genModelSelect,
    valModelName,
    valModelEmoji,
    subbarModelName,
    bannerEmoji,
    bannerText,
  } = dependencies;

  const catalog = currentGenMode === 'video' ? VIDEO_MODELS_V2 : IMAGE_MODELS_V2;
  let target = (catalog && catalog.length > 0) ? catalog.find((model) =>
    model.id === modelKeyOrId ||
    model.value === modelKeyOrId ||
    (model.name && model.name.toLowerCase() === String(modelKeyOrId).toLowerCase()) ||
    (model.name && model.name.toLowerCase().includes(String(modelKeyOrId).toLowerCase()))
  ) : null;

  if (!target && catalog && catalog.length > 0) {
    target = catalog[0];
  }

  if (target) {
    if (valModelName) valModelName.textContent = target.name;
    if (valModelEmoji && getModelIconHtml) valModelEmoji.innerHTML = getModelIconHtml(target, 'model-val-icon');
    if (subbarModelName) subbarModelName.textContent = target.name;
    if (bannerEmoji && getModelIconHtml) bannerEmoji.innerHTML = getModelIconHtml(target, 'banner-val-icon');
    if (bannerText && escapeHtml) {
      const creditLabel = typeof target.credits === 'number' && target.credits > 0 ? ` (${target.credits} Koin)` : '';
      bannerText.innerHTML = `<strong>${escapeHtml(target.name)}</strong>${creditLabel} &mdash; ${escapeHtml(target.desc || '')}`;
    }
    if (genModelSelect) {
      genModelSelect.value = target.value || target.id;
    }

    if (activeProvider === 'dola') {
      const tier = detectModelTier(target);
      syncTierUiState(tier);
    }
  }

  return target;
}

export function applyTierSelection(tier, dependencies = {}) {
  const {
    currentGenMode,
    activeProvider = 'dola',
    IMAGE_MODELS_V2 = [],
    VIDEO_MODELS_V2 = [],
    applyModelSelectionFn = applyModelSelection,
  } = dependencies;

  if (activeProvider !== 'dola') return null;

  const catalog = currentGenMode === 'video' ? VIDEO_MODELS_V2 : IMAGE_MODELS_V2;
  if (!catalog || catalog.length === 0) return null;

  const isFast = tier === 'fast';
  let targetModel = null;

  if (currentGenMode === 'video') {
    targetModel = isFast 
      ? catalog.find(m => m.id === 'dola_seedance_v2_0_fast' || m.id.includes('fast'))
      : catalog.find(m => m.id === 'dola_seedance_v2_5' || m.id.includes('2_5') || m.id.includes('pro'));
  } else {
    targetModel = isFast
      ? catalog.find(m => m.id === 'dola_seedream_v4_5' || m.id.includes('4_5') || m.id.includes('fast'))
      : catalog.find(m => m.id === 'dola_seedream_v5_pro' || m.id.includes('pro') || m.id.includes('5'));
  }

  if (!targetModel && catalog.length > 0) {
    targetModel = isFast ? catalog[0] : (catalog[1] || catalog[0]);
  }

  if (targetModel && typeof applyModelSelectionFn === 'function') {
    applyModelSelectionFn(targetModel.id);
  }

  syncTierUiState(isFast ? 'fast' : 'pro');
  return targetModel;
}

export function renderModelPickerOptions({
  currentGenMode = 'image',
  selectedImageModel,
  selectedVideoModel,
  IMAGE_MODELS_V2 = [],
  VIDEO_MODELS_V2 = [],
  getModelIconHtml,
  escapeHtml,
  listEl,
  onSelect,
} = {}) {
  if (!listEl) return;

  const activeProvider = (typeof window !== 'undefined' ? window.activeProvider : 'weavy');
  const isVid = currentGenMode === 'video';
  const catalog = isVid ? VIDEO_MODELS_V2 : IMAGE_MODELS_V2;
  const currentActive = isVid ? selectedVideoModel : selectedImageModel;

  if (!catalog || catalog.length === 0) {
    listEl.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-secondary); font-size: 13px;">Tidak ada model ${isVid ? 'video' : 'gambar'} yang tersedia untuk provider ini.</div>`;
    return;
  }

  let bannerNoticeHtml = '';
  if (activeProvider === 'dola') {
    const isPro = detectModelTier(currentActive) === 'pro';
    if (isPro) {
      bannerNoticeHtml = `
        <div style="margin-bottom: 10px; padding: 9px 12px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 8px; font-size: 11px; color: #93c5fd; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 14px;">💎</span>
          <span>Mode <strong>Pro</strong> menggunakan model flagship terpadu Dola AI secara otomatis.</span>
        </div>
      `;
    } else {
      bannerNoticeHtml = `
        <div style="margin-bottom: 10px; padding: 9px 12px; background: rgba(232, 162, 61, 0.1); border: 1px solid rgba(232, 162, 61, 0.25); border-radius: 8px; font-size: 11px; color: #fcd34d; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 14px;">⚡</span>
          <span>Mode <strong>Fast</strong>: Pilih model cepat sesuai kebutuhan.</span>
        </div>
      `;
    }
  }

  const itemsHtml = catalog
    .map((m) => {
      const isSelected = currentActive && (m.id === currentActive.id || m.value === currentActive.value);
      const creditBadge = typeof m.credits === 'number' && m.credits > 0
        ? `<span class="subpicker-item-badge" style="background: rgba(232, 162, 61, 0.15); color: var(--accent-primary, #e8a23d);">${m.credits} KOIN</span>`
        : '';
      const badgeText = m.badge || (isVid ? 'VIDEO' : 'IMAGE');
      return `
      <button type="button" class="subpicker-item ${isSelected ? 'selected' : ''}" data-model-id="${m.id}" title="${escapeHtml(m.name)}">
        <div class="subpicker-item-main-row">
          <div class="subpicker-model-title-wrap">
            ${getModelIconHtml ? getModelIconHtml(m, 'subpicker-model-icon') : ''}
            <span class="subpicker-item-main">${escapeHtml(m.name)}</span>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            ${creditBadge}
            <span class="subpicker-item-badge">${badgeText}</span>
          </div>
        </div>
        <span class="subpicker-item-sub">${escapeHtml(m.desc || '')}</span>
      </button>
    `;
    })
    .join('');

  listEl.innerHTML = bannerNoticeHtml + itemsHtml;

  listEl.querySelectorAll('.subpicker-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-model-id');
      if (id && typeof onSelect === 'function') {
        onSelect(id);
      }
    });
  });
}

export function setGenerationMode(mode, dependencies = {}) {
  const {
    btnVideo,
    btnImage,
    btnSubmit,
    noteModeLabel,
    currentGenMode,
    selectedImageModel,
    selectedVideoModel,
    IMAGE_MODELS_V2,
    VIDEO_MODELS_V2,
    getModelIconHtml,
    escapeHtml,
    onUpdateMode,
  } = dependencies;

  const nextMode = mode === 'video' ? 'video' : 'image';
  if (nextMode === 'video') {
    btnVideo?.classList.add('active');
    btnImage?.classList.remove('active');
    if (btnSubmit) {
      btnSubmit.innerHTML = `
        <svg class="icon-sparkle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <span id="btnSubmitGenerateLabel">Generate Video</span>
      `;
    }
    if (noteModeLabel) noteModeLabel.textContent = 'Video';
  } else {
    btnImage?.classList.add('active');
    btnVideo?.classList.remove('active');
    if (btnSubmit) {
      btnSubmit.innerHTML = `
        <svg class="icon-sparkle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <span id="btnSubmitGenerateLabel">Generate Image</span>
      `;
    }
    if (noteModeLabel) noteModeLabel.textContent = 'Image';
  }

  if (typeof onUpdateMode === 'function') {
    onUpdateMode(nextMode);
  }

  return nextMode;
}
