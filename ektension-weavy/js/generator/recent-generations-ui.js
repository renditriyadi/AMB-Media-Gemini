export function renderRecentGenerationsUi({
  savedRecentGenerations = [],
  activeGeneratingTasks = [],
  gridEl = null,
  escapeHtml,
  createRecentGenerationCardHtml,
  showMediaLightbox,
  downloadMediaBlob,
  genPromptInput = null,
  applyAspectRatio,
  applyModelSelection,
  onDeleteGeneration = null,
  navigatorRef = navigator,
}) {
  if (!gridEl) return;

  if ((!savedRecentGenerations || savedRecentGenerations.length === 0) && activeGeneratingTasks.length === 0) {
    gridEl.innerHTML = `
      <div class="recent-gen-empty">
        <p>Belum ada hasil generasi.</p>
        <span style="font-size:11px; opacity:0.75;">Ketik prompt di atas lalu tekan "Generate Image" untuk mulai berkreasi!</span>
      </div>
    `;
    return;
  }

  const matchedResultByTask = new Map();
  activeGeneratingTasks.forEach((task) => {
    const matched = savedRecentGenerations.find((item) => item.sourceTaskId === task.id);
    if (matched) matchedResultByTask.set(task.id, matched);
  });

  const generatingCardHtml = activeGeneratingTasks.map((task) => {
    const taskStatus = task.status || 'generating';
    const statusLabel = taskStatus === 'failed' ? 'FAILED' : taskStatus === 'queued' ? 'QUEUED' : 'GENERATING';
    const statusClass = taskStatus === 'failed' ? 'failed' : taskStatus === 'queued' ? 'queued' : 'generating';
    const finishedResult = matchedResultByTask.get(task.id);
    const fullStatusText = task.statusText || 'Memproses di AI...';
    const shortStatusText = fullStatusText.length > 58
      ? `${fullStatusText.slice(0, 58).trimEnd()}...`
      : fullStatusText;

    if (finishedResult) {
      return createRecentGenerationCardHtml(finishedResult, escapeHtml).replace(
        /<div class="recent-gen-card"/,
        `<div class="recent-gen-card ${statusClass}" id="activeGeneratingCard-${task.id}"`
      );
    }

    return `
      <div class="recent-gen-card ${statusClass}" id="activeGeneratingCard-${task.id}">
        <div class="recent-gen-thumb-wrap">
          <div class="gen-placeholder-anim ${statusClass}">
            ${taskStatus === 'failed'
              ? '<div class="gen-failed-state">FAILED</div>'
              : `<div class="gen-spinner-ring"></div><span class="gen-pct-text">${task.pct || 5}%</span>`}
          </div>
          <span class="recent-gen-generating-tag">${statusLabel}</span>
          <span class="recent-gen-aspect-tag">${task.aspectRatio || '9:16'}</span>
          <button type="button" class="btn-icon-mini btn-delete-gen-item" data-id="${task.id}" data-generation-kind="active" title="Hapus">×</button>
        </div>
        <div class="recent-gen-info">
          <div class="recent-gen-prompt-snippet" title="${escapeHtml(task.prompt)}">${escapeHtml(task.prompt)}</div>
          <div class="recent-gen-footer-row">
            <span class="recent-gen-status-text" title="${escapeHtml(fullStatusText)}">
              ${escapeHtml(shortStatusText)}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const finishedTaskIds = new Set(matchedResultByTask.keys());
  const maxItems = activeGeneratingTasks.length > 0 ? 3 : 4;
  const displayList = savedRecentGenerations
    .filter((item) => !finishedTaskIds.has(item.sourceTaskId))
    .slice(0, maxItems);
  const itemsHtml = displayList.map((item) => createRecentGenerationCardHtml(item, escapeHtml)).join('');

  gridEl.innerHTML = generatingCardHtml + itemsHtml;

  gridEl.querySelectorAll('.recent-gen-thumb-wrap').forEach((wrap) => {
    wrap.addEventListener('click', () => {
      const id = wrap.getAttribute('data-id');
      const url = wrap.getAttribute('data-url');
      const type = wrap.getAttribute('data-type');
      const item = savedRecentGenerations.find((g) => g.id === id) || { url, type };
      showMediaLightbox(item);
    });
  });

  gridEl.querySelectorAll('.btn-download-gen-item').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const url = btn.getAttribute('data-url');
      const type = btn.getAttribute('data-type');
      const prompt = btn.getAttribute('data-prompt') || 'artwork';
      const ext = type === 'video' ? 'mp4' : 'png';
      const promptSlug = prompt.slice(0, 24).replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `weavy-${promptSlug}-${Date.now()}.${ext}`;
      await downloadMediaBlob(url, filename);
    });
  });

  gridEl.querySelectorAll('.btn-delete-gen-item').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      event.stopPropagation();
      event.preventDefault();
      if (!onDeleteGeneration || btn.disabled) return;

      btn.disabled = true;
      btn.innerHTML = '<span class="gen-delete-spinner" aria-label="Menghapus"></span>';
      await onDeleteGeneration(btn.getAttribute('data-id'), btn.getAttribute('data-generation-kind') || 'saved');
    });
  });

  gridEl.querySelectorAll('.btn-copy-gen-prompt').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = btn.getAttribute('data-prompt');
      if (p) {
        navigatorRef.clipboard.writeText(p);
        btn.textContent = '✓';
        setTimeout(() => (btn.textContent = '📋'), 1500);
      }
    });
  });

  gridEl.querySelectorAll('.btn-reuse-gen-settings').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const item = savedRecentGenerations.find((g) => g.id === id);
      if (item) {
        if (genPromptInput) {
          genPromptInput.value = item.prompt;
          genPromptInput.focus();
          genPromptInput.style.height = 'auto';
          genPromptInput.style.height = Math.min(genPromptInput.scrollHeight, 180) + 'px';
        }
        if (item.aspectRatio) applyAspectRatio(item.aspectRatio);
        if (item.model) applyModelSelection(item.model);
      }
    });
  });
}
