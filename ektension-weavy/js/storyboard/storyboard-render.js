export function displayAnalysisCardUi({
  analysis,
  metadata,
  sbAnalysisCard,
  sbHookAnalysisText,
  sbTargetEmotionText,
  sbVisualProofText,
  sbAnalysisChipsContainer,
  escapeHtml,
}) {
  if (!sbAnalysisCard) return;
  if (sbHookAnalysisText) {
    sbHookAnalysisText.textContent = analysis?.hookAnalysis || 'Hook visual memikat perhatian penonton sejak detik pertama.';
  }
  if (sbTargetEmotionText) {
    sbTargetEmotionText.textContent = analysis?.targetEmotion || 'Penasaran, FOMO, dan terdorong mencoba solusi instan.';
  }
  if (sbVisualProofText) {
    sbVisualProofText.textContent = analysis?.visualProofStrategy || 'Live swatch dan perbandingan tekstur langsung di kulit dengan pencahayaan alami.';
  }
  if (sbAnalysisChipsContainer) {
    const usps = analysis?.coreUSPs || ['Formula Cepat Menyerap', 'Hasil Nyata 7 Hari', 'Dermatologically Tested', 'Harga Terjangkau Promo'];
    sbAnalysisChipsContainer.innerHTML = usps.map((u) => `<span class="sb-chip">${escapeHtml(u)}</span>`).join('');
  }
}

export function renderSceneCardHtml(optionsOrSc, maybeIndex, maybeEscapeHtml) {
  let sc = optionsOrSc;
  let index = maybeIndex || 0;
  let escapeHtmlFn = maybeEscapeHtml;

  if (optionsOrSc && typeof optionsOrSc === 'object' && ('sc' in optionsOrSc || 'scene' in optionsOrSc)) {
    sc = optionsOrSc.sc || optionsOrSc.scene;
    index = optionsOrSc.index !== undefined ? optionsOrSc.index : 0;
    escapeHtmlFn = optionsOrSc.escapeHtml;
  }

  const escapeHtml = typeof escapeHtmlFn === 'function' ? escapeHtmlFn : ((str) => {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  });

  if (!sc) return '';

  const isGenerating = sc.status === 'generating';
  const isCompleted = sc.status === 'completed' && Boolean(sc.imageUrl);
  const isError = sc.status === 'error';
  const sceneNum = sc.sceneNumber || (index + 1);
  const durationSec = sc.durationSec || 3;
  const timecodeDisplay = sc.timecode
    ? escapeHtml(sc.timecode)
    : `${index * durationSec}s - ${(index + 1) * durationSec}s`;

  return `
    <div class="sb-scene-card ${isGenerating ? 'generating' : ''} ${isCompleted ? 'completed' : ''}" id="card_${sc.id}" data-id="${sc.id}">
      <div class="sb-scene-visual-col">
        <div class="sb-scene-visual-box" id="visual_box_${sc.id}">
          ${isCompleted ? `
            <img src="${sc.imageUrl}" alt="Visual Scene ${sceneNum}" class="sb-scene-img" style="cursor: zoom-in;" title="Klik untuk melihat pratinjau resolusi tinggi">
            <div class="sb-scene-img-actions">
              <button type="button" class="btn-scene-action btn-download-scene" data-url="${sc.imageUrl}" data-filename="scene_${sceneNum}.png" title="Download Gambar Resolusi Tinggi">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
              <button type="button" class="btn-scene-action btn-re-render" data-id="${sc.id}" title="Re-Generate Gambar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </button>
            </div>
          ` : isGenerating ? `
            <div class="sb-generating-overlay">
              <div class="sb-generating-text">Merender (${sc.progress || 25}%)</div>
              <div class="sb-progress-bar-wrap">
                <div class="sb-progress-bar-fill" style="width: ${sc.progress || 25}%;"></div>
              </div>
            </div>
          ` : isError ? `
            <div class="sb-scene-placeholder sb-scene-error">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span class="text-error" style="font-size: 10px; max-width: 160px; line-height: 1.3; text-align: center;">${escapeHtml(sc.errorMessage || 'Gagal')}</span>
              <button type="button" class="btn-sm btn-outline btn-re-render mt-1" data-id="${sc.id}" style="font-size: 10px; padding: 2px 8px; gap: 4px;">
                <span>🔄 Coba Lagi</span>
              </button>
            </div>
          ` : `
            <div class="sb-scene-placeholder">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              <span>Belum Di-Generate</span>
            </div>
          `}
        </div>
      </div>

      <div class="sb-scene-details-col">
        <div class="sb-scene-header">
          <div class="sb-scene-title-badge">
            <span class="sb-scene-num">Scene ${sceneNum}</span>
            <span class="sb-scene-time">${timecodeDisplay} (${durationSec}s)</span>
          </div>
          <div class="sb-scene-badges-right">
            ${sc.cameraAngle ? `<span class="sb-scene-angle">${escapeHtml(sc.cameraAngle)}</span>` : ''}
            <span class="sb-scene-status-pill ${sc.status}">
              ${isCompleted ? '✓ Selesai' : isGenerating ? '⏳ Render...' : isError ? '⚠️ Gagal' : 'Draft'}
            </span>
          </div>
        </div>

        <div class="sb-scene-body">
          <div class="sb-detail-item">
            <div class="sb-detail-label">Aksi Visual:</div>
            <p class="sb-detail-text">${escapeHtml(sc.visualDescription || '(Tidak ada deskripsi visual)')}</p>
          </div>

          ${sc.voiceover ? `
            <div class="sb-detail-item">
              <div class="sb-detail-header">
                <span class="sb-detail-label">VO (Voiceover):</span>
                <button type="button" class="btn-copy-inline btn-copy-vo" data-text="${escapeHtml(sc.voiceover)}">Salin</button>
              </div>
              <p class="sb-detail-text">"${escapeHtml(sc.voiceover)}"</p>
            </div>
          ` : ''}

          ${sc.voInstruction ? `
            <div class="sb-detail-item" style="margin-top: 4px;">
              <div class="sb-detail-label" style="color: #fbbf24; font-size: 11px;">🎙️ Instruksi Voice Over:</div>
              <p class="sb-detail-text" style="color: #fef08a; font-size: 11.5px;">${escapeHtml(sc.voInstruction)}</p>
            </div>
          ` : ''}

          ${sc.videoInstruction ? `
            <div class="sb-detail-item" style="margin-top: 4px;">
              <div class="sb-detail-label" style="color: #f87171; font-size: 11px;">🚫 Instruksi Video:</div>
              <p class="sb-detail-text" style="color: #fca5a5; font-size: 11.5px;">${escapeHtml(sc.videoInstruction)}</p>
            </div>
          ` : ''}

          ${sc.onScreenText && !/^(?:none|tidak\s+ada(?:\s+teks)?|tanpa\s+teks|kosong|-|n\/a|no\s+text)$/i.test(sc.onScreenText.trim()) ? `
            <div class="sb-detail-item">
              <div class="sb-detail-header">
                <span class="sb-detail-label">Teks Layar (TikTok Overlay):</span>
                <button type="button" class="btn-copy-inline btn-copy-ost" data-text="${escapeHtml(sc.onScreenText)}">Salin</button>
              </div>
              <div style="background: rgba(0,0,0,0.4); border-left: 3px solid #facc15; padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; color: #fef08a; display: inline-block;">
                ${escapeHtml(sc.onScreenText)}
              </div>
            </div>
          ` : ''}

          ${sc.videoPrompt ? `
            <div class="sb-detail-item">
              <div class="sb-detail-header">
                <span class="sb-detail-label" style="color: #34d399;">Prompt Video (Motion):</span>
                <button type="button" class="btn-copy-inline btn-copy-video-prompt" data-text="${escapeHtml(sc.videoPrompt)}">Salin</button>
              </div>
              <div class="sb-prompt-box" style="border-color: rgba(52, 211, 153, 0.25); background: rgba(52, 211, 153, 0.06); color: #a7f3d0; font-size: 11px;">${escapeHtml(sc.videoPrompt)}</div>
            </div>
          ` : ''}

          <div class="sb-detail-item">
            <div class="sb-detail-header">
              <span class="sb-detail-label">Prompt Gambar:</span>
              <div style="display: flex; gap: 4px;">
                <button type="button" class="btn-copy-inline btn-edit-prompt" data-id="${sc.id}" title="Edit teks prompt gambar adegan ini">✏️ Edit</button>
                <button type="button" class="btn-copy-inline btn-copy-prompt" data-text="${escapeHtml(sc.imagePrompt)}">Salin</button>
              </div>
            </div>
            <div class="sb-prompt-box" id="prompt_box_${sc.id}" data-id="${sc.id}" title="Klik untuk membuka / menutup seluruh teks prompt">${escapeHtml(sc.imagePrompt)}</div>
            <textarea class="form-textarea text-xs sb-prompt-edit-textarea hidden" id="prompt_edit_${sc.id}" data-id="${sc.id}" rows="3" style="width: 100%; margin-top: 5px; border-color: var(--accent-primary); font-family: monospace;" placeholder="Edit prompt visual adegan...">${escapeHtml(sc.imagePrompt)}</textarea>
          </div>
        </div>

        <div class="sb-scene-footer-actions">
          <button type="button" class="btn-sm btn-outline btn-copy-full-scene" data-id="${sc.id}" title="Salin naskah, sudut kamera, visual & voiceover adegan ini">
            📋 Salin Naskah
          </button>
          <button type="button" class="btn-gen-single-scene" data-id="${sc.id}" ${isGenerating ? 'disabled' : ''}>
            ${isCompleted ? '🎨 Re-Gen' : isGenerating ? '⏳ Merender...' : isError ? '🔄 Coba Lagi' : '🎨 Generate'}
          </button>
        </div>
      </div>
    </div>
  `;
}

export function showCopyTooltipUi({ btn }) {
  const orig = btn.textContent;
  btn.textContent = '✓ Tersalin!';
  btn.style.color = 'var(--success, #5ec98f)';
  setTimeout(() => {
    btn.textContent = orig;
    btn.style.color = '';
  }, 1800);
}

export function updateCompletedBadgeUi({ sbCompletedBadge, currentSbProject }) {
  if (!sbCompletedBadge || !currentSbProject || !currentSbProject.scenes) return;
  const completedCount = currentSbProject.scenes.filter((s) => s.status === 'completed' && s.imageUrl).length;
  sbCompletedBadge.textContent = `${completedCount} / ${currentSbProject.scenes.length} Selesai`;
}

export function renderStoryboardProjectUi({
  sbOutputSection,
  sbScenesGrid,
  sbScenesProjectTitle,
  sbScenesMetaText,
  proj,
  escapeHtml,
  renderSceneCardHtml,
  bindSceneCardInteractions,
  updateCompletedBadge,
}) {
  if (!sbOutputSection || !sbScenesGrid) return;

  sbOutputSection.classList.remove('hidden');
  if (sbScenesProjectTitle) {
    sbScenesProjectTitle.textContent = proj.name || 'Storyboard Scenes Breakdown';
  }
  updateCompletedBadge();

  if (sbScenesMetaText) {
    sbScenesMetaText.innerHTML = `Model Gambar: <strong class="text-amber">${escapeHtml(proj.imageModel || 'GPT Image 2.5')}</strong> (Aspek ${proj.aspectRatio || '9:16'}) &bull; Format Prompt Weavy AI`;
  }

  sbScenesGrid.innerHTML = proj.scenes.map((sc, index) => renderSceneCardHtml({ sc, index, escapeHtml })).join('');
  bindSceneCardInteractions();
}

export function renderSavedStoryboardsUi({
  sbSavedProjectsContainer,
  savedSbProjects,
  escapeHtml,
  onLoad,
  onDelete,
}) {
  if (!sbSavedProjectsContainer) return;
  if (!savedSbProjects || savedSbProjects.length === 0) {
    sbSavedProjectsContainer.innerHTML = '<div class="empty-state">Belum ada proyek storyboard tersimpan.</div>';
    return;
  }

  sbSavedProjectsContainer.innerHTML = savedSbProjects.map((p) => `
    <div class="sb-saved-item">
      <div class="sb-saved-info">
        <div class="sb-saved-title">${escapeHtml(p.name)}</div>
        <div class="sb-saved-meta">${p.scenes ? p.scenes.length : 0} Scenes &bull; ${p.duration || '15'}s (${p.aspectRatio || '9:16'}) &bull; ${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ''}</div>
      </div>
      <div class="sb-saved-actions">
        <button type="button" class="btn-sm btn-outline btn-load-sb" data-id="${p.id}">Buka</button>
        <button type="button" class="btn-sm btn-icon-only btn-del-sb" data-id="${p.id}" title="Hapus Proyek">
          <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  sbSavedProjectsContainer.querySelectorAll('.btn-load-sb').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      onLoad(id);
    });
  });

  sbSavedProjectsContainer.querySelectorAll('.btn-del-sb').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      if (btn.disabled) return;
      btn.disabled = true;
      const id = e.currentTarget.getAttribute('data-id');
      try {
        await onDelete(id);
      } finally {
        btn.disabled = false;
      }
    });
  });
}
