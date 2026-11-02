export function reuseRecentGenerationSettings({
  item,
  genPromptInput = null,
  applyAspectRatio = null,
  applyModelSelection = null,
  showAuthAlert = null,
  modalEl = null,
  onAfterApply = null,
} = {}) {
  if (!item) return;

  if (genPromptInput) {
    genPromptInput.value = item.prompt || '';
    genPromptInput.focus();
    genPromptInput.style.height = 'auto';
    genPromptInput.style.height = Math.min(genPromptInput.scrollHeight, 180) + 'px';
  }

  if (item.aspectRatio && applyAspectRatio) applyAspectRatio(item.aspectRatio);
  if (item.model && applyModelSelection) applyModelSelection(item.model);

  if (modalEl) modalEl.classList.add('hidden');

  if (typeof onAfterApply === 'function') {
    onAfterApply(item);
  } else if (showAuthAlert) {
    showAuthAlert('Prompt dan pengaturan berhasil diterapkan ke form!', 'success');
  }
}

export function bindRecentGenerationActions({
  gridEl = null,
  savedRecentGenerations = [],
  showMediaLightbox = null,
  downloadMediaBlob = null,
  genPromptInput = null,
  applyAspectRatio = null,
  applyModelSelection = null,
  showAuthAlert = null,
  navigatorRef = navigator,
  modalEl = null,
  onAfterApply = null,
} = {}) {
  if (!gridEl) return;

  gridEl.querySelectorAll('.recent-gen-thumb-wrap').forEach((wrap) => {
    wrap.addEventListener('click', () => {
      const id = wrap.getAttribute('data-id');
      const url = wrap.getAttribute('data-url');
      const type = wrap.getAttribute('data-type');
      const item = savedRecentGenerations.find((g) => g.id === id) || { url, type };
      if (showMediaLightbox) showMediaLightbox(item);
    });
  });

  gridEl.querySelectorAll('.btn-download-gen-item').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();

      const url = btn.getAttribute('data-url');
      const type = btn.getAttribute('data-type');
      const prompt = btn.getAttribute('data-prompt') || 'artwork';
      if (!url || !downloadMediaBlob) return;

      const ext = type === 'video' ? 'mp4' : 'png';
      const promptSlug = prompt.slice(0, 24).replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `weavy-${promptSlug}-${Date.now()}.${ext}`;
      await downloadMediaBlob(url, filename);
    });
  });

  gridEl.querySelectorAll('.btn-copy-gen-prompt').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = btn.getAttribute('data-prompt');
      if (!p) return;

      if (navigatorRef?.clipboard) {
        navigatorRef.clipboard.writeText(p);
      }

      btn.textContent = '✓';
      setTimeout(() => (btn.textContent = '📋'), 1500);
    });
  });

  gridEl.querySelectorAll('.btn-reuse-gen-settings').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const item = savedRecentGenerations.find((g) => g.id === id);
      if (!item) return;

      reuseRecentGenerationSettings({
        item,
        genPromptInput,
        applyAspectRatio,
        applyModelSelection,
        showAuthAlert,
        modalEl,
        onAfterApply,
      });
    });
  });
}
