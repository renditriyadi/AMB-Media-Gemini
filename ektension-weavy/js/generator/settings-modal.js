export function bindGeneratorSettingsModal({
  documentRef = document,
  renderModelPickerOptions = null,
  applyAspectRatio = null,
  applyResolution = null,
  applyVideoDuration = null,
  applyVideoType = null,
  applyTierSelection = null,
  setGenerationMode = null,
  showAuthAlert = null,
  closeLightbox = null,
}) {
  const btnOpenSettings = documentRef.getElementById('btnOpenGenSettings');
  const genActiveSubbar = documentRef.getElementById('genActiveSubbar');
  const genSettingsModal = documentRef.getElementById('genSettingsModal');
  const btnCloseGenSettings = documentRef.getElementById('btnCloseGenSettings');
  const genSettingsOverlay = documentRef.getElementById('genSettingsOverlay');

  const openSettings = () => {
    const currentProv = (window.activeProvider || documentRef.getElementById('valProvider')?.textContent?.trim()?.toLowerCase() || 'weavy');
    const isDola = currentProv === 'dola';
    documentRef.getElementById('rowSelectTier')?.classList.toggle('hidden', !isDola);
    if (isDola) {
      documentRef.getElementById('rowSelectResolution')?.classList.add('hidden');
      const isPro = btnTierPro?.classList.contains('active') || documentRef.getElementById('btnQuickTierLabel')?.textContent === 'Pro';
      if (typeof window !== 'undefined' && typeof window.syncTierUiState === 'function') {
        window.syncTierUiState(isPro ? 'pro' : 'fast');
      }
    } else {
      documentRef.getElementById('rowSelectResolution')?.classList.remove('hidden');
    }
    genSettingsModal?.classList.remove('hidden');
  };
  const closeSettings = () => genSettingsModal?.classList.add('hidden');

  btnOpenSettings?.addEventListener('click', openSettings);
  genActiveSubbar?.addEventListener('click', openSettings);
  btnCloseGenSettings?.addEventListener('click', closeSettings);
  genSettingsOverlay?.addEventListener('click', closeSettings);

  // Quick Tier Mode Toggle in Action Bar (Strictly Dola AI only)
  const btnQuickTierToggle = documentRef.getElementById('btnQuickTierToggle');
  const genTierMenuPopover = documentRef.getElementById('genTierMenuPopover');
  const optTierFast = documentRef.getElementById('optTierFast');
  const optTierPro = documentRef.getElementById('optTierPro');
  const btnTierFast = documentRef.getElementById('btnTierFast');
  const btnTierPro = documentRef.getElementById('btnTierPro');

  const handleSelectTier = (tier) => {
    const currentProv = (window.activeProvider || documentRef.getElementById('valProvider')?.textContent?.trim()?.toLowerCase() || 'weavy');
    if (currentProv !== 'dola') return;
    if (typeof applyTierSelection === 'function') {
      applyTierSelection(tier);
    } else if (typeof window !== 'undefined' && typeof window.applyTierSelection === 'function') {
      window.applyTierSelection(tier);
    }
    genTierMenuPopover?.classList.add('hidden');
  };

  btnQuickTierToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    const currentProv = (window.activeProvider || documentRef.getElementById('valProvider')?.textContent?.trim()?.toLowerCase() || 'weavy');
    if (currentProv !== 'dola') return;
    genTierMenuPopover?.classList.toggle('hidden');
  });

  optTierFast?.addEventListener('click', (e) => {
    e.stopPropagation();
    handleSelectTier('fast');
  });

  optTierPro?.addEventListener('click', (e) => {
    e.stopPropagation();
    handleSelectTier('pro');
  });

  btnTierFast?.addEventListener('click', (e) => {
    e.stopPropagation();
    handleSelectTier('fast');
  });

  btnTierPro?.addEventListener('click', (e) => {
    e.stopPropagation();
    handleSelectTier('pro');
  });

  // Close popover when clicking anywhere outside
  documentRef.addEventListener('click', (e) => {
    if (genTierMenuPopover && !genTierMenuPopover.classList.contains('hidden')) {
      if (!e.target.closest('#wrapGenTierToggle')) {
        genTierMenuPopover.classList.add('hidden');
      }
    }
  });

  const btnModeVideo = documentRef.getElementById('btnModeVideo');
  const btnModeImage = documentRef.getElementById('btnModeImage');

  btnModeVideo?.addEventListener('click', () => setGenerationMode?.('video'));
  btnModeImage?.addEventListener('click', () => setGenerationMode?.('image'));

  const rowSelectModel = documentRef.getElementById('rowSelectModel');
  const pickerModelModal = documentRef.getElementById('pickerModelModal');
  const btnCloseModelPicker = documentRef.getElementById('btnCloseModelPicker');

  const openModelPicker = () => {
    renderModelPickerOptions?.();
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

  // Aspect Ratio Picker
  const rowSelectAspect = documentRef.getElementById('rowSelectAspect');
  const pickerAspectModal = documentRef.getElementById('pickerAspectModal');
  const btnCloseAspectPicker = documentRef.getElementById('btnCloseAspectPicker');

  const openAspectPicker = () => {
    const currentVal = documentRef.getElementById('valAspect')?.textContent?.trim() || '';
    documentRef.querySelectorAll('#pickerAspectList .subpicker-item').forEach((item) => {
      const asp = item.getAttribute('data-aspect') || '';
      item.classList.toggle('selected', currentVal.startsWith(asp) || currentVal.includes(asp));
    });
    pickerAspectModal?.classList.remove('hidden');
  };

  rowSelectAspect?.addEventListener('click', openAspectPicker);
  rowSelectAspect?.addEventListener('pointerdown', openAspectPicker);
  btnCloseAspectPicker?.addEventListener('click', () => pickerAspectModal?.classList.add('hidden'));
  pickerAspectModal?.addEventListener('click', (e) => {
    if (e.target === pickerAspectModal) pickerAspectModal.classList.add('hidden');
  });

  const pickerAspectList = documentRef.getElementById('pickerAspectList');
  pickerAspectList?.addEventListener('click', (e) => {
    const btn = e.target.closest('.subpicker-item');
    if (!btn) return;
    const aspect = btn.getAttribute('data-aspect');
    if (aspect && applyAspectRatio) applyAspectRatio(aspect);
    pickerAspectModal?.classList.add('hidden');
  });

  documentRef.querySelectorAll('#pickerAspectList .subpicker-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const aspect = btn.getAttribute('data-aspect');
      if (aspect && applyAspectRatio) applyAspectRatio(aspect);
      pickerAspectModal?.classList.add('hidden');
    });
  });

  // Resolution Picker
  const rowSelectResolution = documentRef.getElementById('rowSelectResolution');
  const pickerResolutionModal = documentRef.getElementById('pickerResolutionModal');
  const btnCloseResolutionPicker = documentRef.getElementById('btnCloseResolutionPicker');

  const syncResolutionPickerOptions = () => {
    const isVideo = btnModeVideo?.classList.contains('active');
    const currentProv = window.activeProvider || documentRef.getElementById('valProvider')?.textContent?.trim()?.toLowerCase() || 'weavy';
    const currentVal = documentRef.getElementById('valResolution')?.textContent?.trim() || '';

    documentRef.querySelectorAll('#pickerResolutionList .subpicker-item').forEach((item) => {
      const itemMode = item.getAttribute('data-mode');
      const itemRes = item.getAttribute('data-res');

      if (isVideo) {
        if (itemMode !== 'video') {
          item.classList.add('hidden');
        } else {
          if (currentProv === 'dola' && itemRes === '360p') {
            item.classList.add('hidden');
          } else {
            item.classList.remove('hidden');
          }
        }
      } else {
        if (itemMode !== 'image') {
          item.classList.add('hidden');
        } else {
          item.classList.remove('hidden');
        }
      }

      item.classList.toggle('selected', itemRes === currentVal || currentVal.includes(itemRes));
    });
  };

  const openResolutionPicker = () => {
    syncResolutionPickerOptions();
    pickerResolutionModal?.classList.remove('hidden');
  };

  rowSelectResolution?.addEventListener('click', openResolutionPicker);
  rowSelectResolution?.addEventListener('pointerdown', openResolutionPicker);
  btnCloseResolutionPicker?.addEventListener('click', () => pickerResolutionModal?.classList.add('hidden'));
  pickerResolutionModal?.addEventListener('click', (e) => {
    if (e.target === pickerResolutionModal) pickerResolutionModal.classList.add('hidden');
  });

  const pickerResolutionList = documentRef.getElementById('pickerResolutionList');
  pickerResolutionList?.addEventListener('click', (e) => {
    const btn = e.target.closest('.subpicker-item');
    if (!btn) return;
    const res = btn.getAttribute('data-res');
    if (res && applyResolution) applyResolution(res);
    pickerResolutionModal?.classList.add('hidden');
  });

  documentRef.querySelectorAll('#pickerResolutionList .subpicker-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const res = btn.getAttribute('data-res');
      if (res && applyResolution) applyResolution(res);
      pickerResolutionModal?.classList.add('hidden');
    });
  });

  // Video Duration Picker
  const rowSelectDuration = documentRef.getElementById('rowSelectDuration');
  const pickerDurationModal = documentRef.getElementById('pickerDurationModal');
  const btnCloseDurationPicker = documentRef.getElementById('btnCloseDurationPicker');

  const openDurationPicker = () => {
    const currentProv = window.activeProvider || documentRef.getElementById('valProvider')?.textContent?.trim()?.toLowerCase() || 'weavy';
    const currentVal = documentRef.getElementById('valVideoDuration')?.textContent?.trim() || '';

    documentRef.querySelectorAll('#pickerDurationList .subpicker-item').forEach((item) => {
      const dur = item.getAttribute('data-duration');
      if (currentProv === 'dola') {
        item.classList.toggle('hidden', !['5s', '10s'].includes(dur));
      } else {
        item.classList.toggle('hidden', dur === '5s');
      }
      item.classList.toggle('selected', dur === currentVal);
    });
    pickerDurationModal?.classList.remove('hidden');
  };

  rowSelectDuration?.addEventListener('click', openDurationPicker);
  rowSelectDuration?.addEventListener('pointerdown', openDurationPicker);
  btnCloseDurationPicker?.addEventListener('click', () => pickerDurationModal?.classList.add('hidden'));
  pickerDurationModal?.addEventListener('click', (e) => {
    if (e.target === pickerDurationModal) pickerDurationModal.classList.add('hidden');
  });

  const pickerDurationList = documentRef.getElementById('pickerDurationList');
  pickerDurationList?.addEventListener('click', (e) => {
    const btn = e.target.closest('.subpicker-item');
    if (!btn) return;
    const dur = btn.getAttribute('data-duration');
    if (dur && applyVideoDuration) applyVideoDuration(dur);
    pickerDurationModal?.classList.add('hidden');
  });

  documentRef.querySelectorAll('#pickerDurationList .subpicker-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dur = btn.getAttribute('data-duration');
      if (dur && applyVideoDuration) applyVideoDuration(dur);
      pickerDurationModal?.classList.add('hidden');
    });
  });

  // Video Type Picker (Flow only)
  const rowSelectVideoType = documentRef.getElementById('rowSelectVideoType');
  const pickerVideoTypeModal = documentRef.getElementById('pickerVideoTypeModal');
  const btnCloseVideoTypePicker = documentRef.getElementById('btnCloseVideoTypePicker');

  const openVideoTypePicker = () => {
    const currentVal = documentRef.getElementById('valVideoType')?.textContent?.trim() || 'Ingredients';
    documentRef.querySelectorAll('#pickerVideoTypeList .subpicker-item').forEach((item) => {
      const vt = item.getAttribute('data-video-type');
      item.classList.toggle('selected', vt === currentVal);
    });
    pickerVideoTypeModal?.classList.remove('hidden');
  };

  rowSelectVideoType?.addEventListener('click', openVideoTypePicker);
  rowSelectVideoType?.addEventListener('pointerdown', openVideoTypePicker);
  btnCloseVideoTypePicker?.addEventListener('click', () => pickerVideoTypeModal?.classList.add('hidden'));
  pickerVideoTypeModal?.addEventListener('click', (e) => {
    if (e.target === pickerVideoTypeModal) pickerVideoTypeModal.classList.add('hidden');
  });

  const pickerVideoTypeList = documentRef.getElementById('pickerVideoTypeList');
  pickerVideoTypeList?.addEventListener('click', (e) => {
    const btn = e.target.closest('.subpicker-item');
    if (!btn) return;
    const vt = btn.getAttribute('data-video-type');
    if (vt && applyVideoType) applyVideoType(vt);
    pickerVideoTypeModal?.classList.add('hidden');
  });

  documentRef.querySelectorAll('#pickerVideoTypeList .subpicker-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const vt = btn.getAttribute('data-video-type');
      if (vt && applyVideoType) applyVideoType(vt);
      pickerVideoTypeModal?.classList.add('hidden');
    });
  });

  // Provider Selector Picker
  const rowSelectProvider = documentRef.getElementById('rowSelectProvider');
  const pickerProviderModal = documentRef.getElementById('pickerProviderModal');
  const btnCloseProviderPicker = documentRef.getElementById('btnCloseProviderPicker');
  const pickerProviderList = documentRef.getElementById('pickerProviderList');

  const openProviderPicker = () => {
    // Highlight currently active provider
    const currentProv = window.activeProvider || documentRef.getElementById('valProvider')?.textContent?.trim()?.toLowerCase() || 'weavy';
    documentRef.querySelectorAll('#pickerProviderList .provider-option').forEach((opt) => {
      const p = opt.getAttribute('data-provider');
      opt.classList.toggle('selected', currentProv.includes(p) || p === currentProv);
    });
    pickerProviderModal?.classList.remove('hidden');
  };

  rowSelectProvider?.addEventListener('click', openProviderPicker);
  rowSelectProvider?.addEventListener('pointerdown', openProviderPicker);
  rowSelectProvider?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openProviderPicker();
    }
  });

  btnCloseProviderPicker?.addEventListener('click', () => pickerProviderModal?.classList.add('hidden'));
  pickerProviderModal?.addEventListener('click', (e) => {
    if (e.target === pickerProviderModal) pickerProviderModal.classList.add('hidden');
  });

  const handleProviderSelect = (targetEl) => {
    const btn = targetEl?.closest ? targetEl.closest('.provider-option') : targetEl;
    if (!btn) return;
    const nextProvider = btn.getAttribute('data-provider');
    if (['weavy', 'flow', 'dola'].includes(nextProvider)) {
      if (typeof window !== 'undefined' && typeof window.setActiveProvider === 'function') {
        window.setActiveProvider(nextProvider);
      }
    }
    pickerProviderModal?.classList.add('hidden');
  };

  pickerProviderList?.addEventListener('click', (e) => {
    handleProviderSelect(e.target);
  });

  documentRef.querySelectorAll('#pickerProviderList .provider-option').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleProviderSelect(btn);
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLightbox?.();
      genSettingsModal?.classList.add('hidden');
      pickerModelModal?.classList.add('hidden');
      pickerAspectModal?.classList.add('hidden');
      pickerResolutionModal?.classList.add('hidden');
      pickerProviderModal?.classList.add('hidden');
      genTierMenuPopover?.classList.add('hidden');
      documentRef.getElementById('pickerDurationModal')?.classList.add('hidden');
      documentRef.getElementById('pickerVideoTypeModal')?.classList.add('hidden');
    }
  });

  return {
    openSettings,
    closeSettings,
    openModelPicker,
  };
}
