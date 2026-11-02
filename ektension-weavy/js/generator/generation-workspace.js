export function initGenerateWorkspaceV2({
  documentRef = document,
  getCurrentGenRefImages,
  setCurrentGenRefImages,
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
  replaceReferenceImages = false,
}) {
  const promptInput = documentRef.getElementById('genPromptInput');
  const promptCard = documentRef.getElementById('genPromptCard');
  const btnSubmitGenerate = documentRef.getElementById('btnSubmitGenerate');

  if (promptInput) {
    promptInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || !event.ctrlKey || event.isComposing) return;
      event.preventDefault();
      if (!btnSubmitGenerate?.disabled) btnSubmitGenerate.click();
    });

    promptInput.addEventListener('input', () => {
      promptInput.style.height = 'auto';
      promptInput.style.height = Math.min(promptInput.scrollHeight, 220) + 'px';
    });

    promptInput.addEventListener('paste', async (e) => {
      const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
      if (!items) return;
      const files = [];
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        await handleAddGenRefFiles(files);
      }
    });
  }

  if (promptCard) {
    ['dragenter', 'dragover'].forEach((eventName) => {
      promptCard.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        promptCard.style.borderColor = 'var(--accent-primary)';
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      promptCard.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        promptCard.style.borderColor = '';
      });
    });

    promptCard.addEventListener('drop', async (e) => {
      const dt = e.dataTransfer;
      const files = dt?.files;
      if (files && files.length > 0) {
        await handleAddGenRefFiles(files);
      }
    });
  }

  const btnGenAddImage = documentRef.getElementById('btnGenAddImage');
  const btnClearTray = documentRef.getElementById('btnClearTray') || documentRef.getElementById('btnClearAllRefImages');
  const genFileInputEl = documentRef.getElementById('genRefFileInput');

  btnGenAddImage?.addEventListener('click', () => {
    if (openImageSourcePicker) {
      openImageSourcePicker({
        fileInput: genFileInputEl,
        onUploadFiles: handleAddGenRefFiles,
        onLibraryAsset: (asset) => {
          const sourceUrl = asset.url || asset.downloadUrl || asset.thumbnailUrl || '';
          const nextImage = {
            id: `ref_library_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: asset.name || 'Library image',
            url: sourceUrl,
            base64: sourceUrl,
            asset: { ...asset, url: sourceUrl, type: 'image' },
            referenceRole: asset.role || 'custom',
            isUploading: false,
            showCheckmark: false,
            error: null,
          };
          const shouldReplace = typeof replaceReferenceImages === 'function'
            ? replaceReferenceImages()
            : replaceReferenceImages;
          const nextImages = shouldReplace
            ? [nextImage]
            : [...(getCurrentGenRefImages?.() || []), nextImage];
          setCurrentGenRefImages?.(nextImages);
          renderGenRefGallery();
        },
      });
    } else {
      genFileInputEl?.click();
    }
  });

  btnClearTray?.addEventListener('click', () => {
    setCurrentGenRefImages([]);
    renderGenRefGallery();
    if (genFileInputEl) genFileInputEl.value = '';
  });

  const btnOpenSettings = documentRef.getElementById('btnOpenGenSettings');
  const genActiveSubbar = documentRef.getElementById('genActiveSubbar');
  const genSettingsModal = documentRef.getElementById('genSettingsModal');
  const btnCloseGenSettings = documentRef.getElementById('btnCloseGenSettings');
  const genSettingsOverlay = documentRef.getElementById('genSettingsOverlay');

  const openSettings = () => genSettingsModal?.classList.remove('hidden');
  const closeSettings = () => genSettingsModal?.classList.add('hidden');

  btnOpenSettings?.addEventListener('click', openSettings);
  genActiveSubbar?.addEventListener('click', openSettings);
  btnCloseGenSettings?.addEventListener('click', closeSettings);
  genSettingsOverlay?.addEventListener('click', closeSettings);

  const btnModeVideo = documentRef.getElementById('btnModeVideo');
  const btnModeImage = documentRef.getElementById('btnModeImage');

  btnModeVideo?.addEventListener('click', () => setGenerationMode('video'));
  btnModeImage?.addEventListener('click', () => setGenerationMode('image'));

  const rowSelectModel = documentRef.getElementById('rowSelectModel');
  const pickerModelModal = documentRef.getElementById('pickerModelModal');
  const btnCloseModelPicker = documentRef.getElementById('btnCloseModelPicker');

  const openModelPicker = () => {
    renderModelPickerOptions();
    pickerModelModal?.classList.remove('hidden');
  };

  rowSelectModel?.addEventListener('click', openModelPicker);
  rowSelectModel?.addEventListener('pointerdown', openModelPicker);
  rowSelectModel?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModelPicker();
    }
  });
  btnCloseModelPicker?.addEventListener('click', () => pickerModelModal?.classList.add('hidden'));
  pickerModelModal?.addEventListener('click', (e) => {
    if (e.target === pickerModelModal) pickerModelModal.classList.add('hidden');
  });

  const btnViewAll = documentRef.getElementById('btnViewAllGenerations');
  const allHistoryModal = documentRef.getElementById('allRecentGenerationsModal');
  const btnCloseAllHistory = documentRef.getElementById('btnCloseAllHistory');
  const btnClearAllHistory = documentRef.getElementById('btnClearAllHistory');

  btnViewAll?.addEventListener('click', () => {
    renderAllHistoryModal();
    allHistoryModal?.classList.remove('hidden');
  });
  btnCloseAllHistory?.addEventListener('click', () => allHistoryModal?.classList.add('hidden'));
  allHistoryModal?.addEventListener('click', (e) => {
    if (e.target === allHistoryModal) allHistoryModal.classList.add('hidden');
  });

  btnClearAllHistory?.addEventListener('click', async () => {
    if (confirm('Hapus seluruh riwayat hasil generasi?')) {
      const savedRecentGenerations = [];
      await storage.set('weavy_recent_generations', []);
      renderRecentGenerations();
      renderAllHistoryModal();
      showAuthAlert('Riwayat generasi berhasil dikosongkan.', 'info');
    }
  });

  const mediaLightboxModal = documentRef.getElementById('mediaLightboxModal');
  const btnCloseLightbox = documentRef.getElementById('btnCloseLightbox') || documentRef.getElementById('lightboxCloseBtn');
  const lightboxBackdrop = documentRef.getElementById('lightboxBackdrop');

  const closeLightbox = () => {
    mediaLightboxModal?.classList.add('hidden');
    const lightboxVideo = documentRef.getElementById('lightboxVideo');
    if (lightboxVideo) {
      lightboxVideo.pause();
      lightboxVideo.src = '';
    }
  };

  btnCloseLightbox?.addEventListener('click', closeLightbox);
  lightboxBackdrop?.addEventListener('click', closeLightbox);
  mediaLightboxModal?.addEventListener('click', (e) => {
    if (e.target === mediaLightboxModal || e.target === lightboxBackdrop) closeLightbox();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLightbox();
      allHistoryModal?.classList.add('hidden');
      genSettingsModal?.classList.add('hidden');
      pickerModelModal?.classList.add('hidden');
      pickerAspectModal?.classList.add('hidden');
      pickerResolutionModal?.classList.add('hidden');
    }
  });

  setGenerationMode('image');
  applyAspectRatio('9:16');
  applyResolution('1024 x 1024');
}
