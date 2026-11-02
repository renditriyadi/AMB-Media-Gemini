export function showMediaLightboxUi({
  target,
  fallbackType = 'image',
  savedRecentGenerations = [],
  genPromptInput = null,
  applyAspectRatio = null,
  applyModelSelection = null,
  downloadMediaBlob = null,
  showAuthAlert = null,
  documentRef = document,
  navigatorRef = navigator,
}) {
  let item = null;
  if (typeof target === 'object' && target !== null) {
    item = target;
  } else if (typeof target === 'string') {
    item = savedRecentGenerations.find((g) => g.url === target) || {
      url: target,
      type: fallbackType || 'image',
      prompt: '',
      modelLabel: 'AI Artwork',
      aspectRatio: '9:16',
    };
  }

  if (!item || !item.url) return;

  const navigationItems = savedRecentGenerations.filter((generation) => generation?.url);
  let currentIndex = navigationItems.findIndex((generation) => (
    (item.id && generation.id === item.id) || generation.url === item.url
  ));
  if (currentIndex < 0) {
    navigationItems.push(item);
    currentIndex = navigationItems.length - 1;
  }

  let pageLightbox = documentRef.getElementById('weavy-page-lightbox');
  if (!pageLightbox) {
    pageLightbox = documentRef.createElement('div');
    pageLightbox.id = 'weavy-page-lightbox';
    pageLightbox.innerHTML = `
      <div id="weavy-lightbox-backdrop" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.88);backdrop-filter:blur(8px);z-index:999999;display:flex;align-items:center;justify-content:center;">
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;max-width:min(95vw, calc(100vh - 160px));max-height:calc(100vh - 40px);">
          <div style="position:absolute;top:0;right:0;display:flex;gap:8px;z-index:5;">
            <button id="weavy-lightbox-close" style="background:rgba(0,0,0,0.7);border:1px solid rgba(255,255,255,0.15);color:#f3ede6;font-size:20px;width:34px;height:34px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;backdrop-filter:blur(4px);">&times;</button>
          </div>
          <button id="weavy-lightbox-prev" type="button" aria-label="Gambar sebelumnya" style="position:fixed;left:18px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.7);border:1px solid rgba(255,255,255,0.18);color:#fff;font-size:32px;width:42px;height:54px;border-radius:10px;cursor:pointer;z-index:5;line-height:1;">&#8249;</button>
          <img id="weavy-lightbox-img" style="max-width:100%;max-height:calc(100vh - 160px);object-fit:contain;border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,0.8);" alt="Preview">
          <video id="weavy-lightbox-video" style="max-width:100%;max-height:calc(100vh - 160px);border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,0.8);" controls playsinline autoplay loop></video>
          <button id="weavy-lightbox-next" type="button" aria-label="Gambar berikutnya" style="position:fixed;right:18px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.7);border:1px solid rgba(255,255,255,0.18);color:#fff;font-size:32px;width:42px;height:54px;border-radius:10px;cursor:pointer;z-index:5;line-height:1;">&#8250;</button>
          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
            <button id="weavy-lightbox-download" style="background:var(--accent-primary,#e8a23d);color:#fff;border:none;padding:9px 18px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">Unduh</button>
            <button id="weavy-lightbox-copy" style="background:rgba(255,255,255,0.08);color:#f3ede6;border:1px solid rgba(255,255,255,0.15);padding:9px 18px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">Salin</button>
            <button id="weavy-lightbox-reuse" style="background:rgba(255,255,255,0.08);color:#f3ede6;border:1px solid rgba(255,255,255,0.15);padding:9px 18px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">Pakai Prompt</button>
          </div>
        </div>
      </div>
    `;
    documentRef.body.appendChild(pageLightbox);
  }

  const imgEl = documentRef.getElementById('weavy-lightbox-img');
  const vidEl = documentRef.getElementById('weavy-lightbox-video');
  const prevBtn = documentRef.getElementById('weavy-lightbox-prev');
  const nextBtn = documentRef.getElementById('weavy-lightbox-next');

  let isVid = false;
  const renderItem = (nextItem) => {
    item = nextItem;
    isVid = item.type === 'video' || /\.mp4(?:\?|$)|\.webm(?:\?|$)|\.mov(?:\?|$)/i.test(item.url || '');

    if (isVid) {
      imgEl?.classList.add('hidden');
      if (vidEl) {
        vidEl.src = item.url;
        vidEl.classList.remove('hidden');
        vidEl.load();
        void vidEl.play().catch(() => {});
      }
    } else {
      vidEl?.classList.add('hidden');
      if (imgEl) {
        imgEl.src = item.url;
        imgEl.classList.remove('hidden');
      }
    }

    if (prevBtn) {
      prevBtn.disabled = currentIndex <= 0;
      prevBtn.style.opacity = prevBtn.disabled ? '0.35' : '1';
      prevBtn.style.visibility = navigationItems.length > 1 ? 'visible' : 'hidden';
    }
    if (nextBtn) {
      nextBtn.disabled = currentIndex >= navigationItems.length - 1;
      nextBtn.style.opacity = nextBtn.disabled ? '0.35' : '1';
      nextBtn.style.visibility = navigationItems.length > 1 ? 'visible' : 'hidden';
    }
  };

  renderItem(item);

  const closeBtn = documentRef.getElementById('weavy-lightbox-close');
  const closeLightbox = () => {
    pageLightbox.remove();
    documentRef.removeEventListener('keydown', escHandler);
  };
  closeBtn.onclick = closeLightbox;
  prevBtn.onclick = () => {
    if (currentIndex <= 0) return;
    currentIndex -= 1;
    renderItem(navigationItems[currentIndex]);
  };
  nextBtn.onclick = () => {
    if (currentIndex >= navigationItems.length - 1) return;
    currentIndex += 1;
    renderItem(navigationItems[currentIndex]);
  };
  documentRef.getElementById('weavy-lightbox-backdrop').onclick = (e) => {
    if (e.target.id === 'weavy-lightbox-backdrop') closeLightbox();
  };

  documentRef.getElementById('weavy-lightbox-download').onclick = async () => {
    if (!downloadMediaBlob) return;
    const ext = isVid ? 'mp4' : 'png';
    const slug = (item.prompt || 'artwork').slice(0, 24).replace(/[^a-zA-Z0-9]/g, '_');
    await downloadMediaBlob(item.url, `weavy-${slug}-${Date.now()}.${ext}`);
  };

  documentRef.getElementById('weavy-lightbox-copy').onclick = () => {
    const textToCopy = item.prompt ? item.prompt : item.url;
    if (navigatorRef?.clipboard) {
      navigatorRef.clipboard.writeText(textToCopy);
    }
    const btn = documentRef.getElementById('weavy-lightbox-copy');
    btn.textContent = '✓ Tersalin!';
    setTimeout(() => { btn.textContent = 'Salin'; }, 1600);
  };

  documentRef.getElementById('weavy-lightbox-reuse').onclick = () => {
    if (genPromptInput) {
      genPromptInput.value = item.prompt || '';
      genPromptInput.focus();
      genPromptInput.style.height = 'auto';
      genPromptInput.style.height = Math.min(genPromptInput.scrollHeight, 180) + 'px';
    }
    if (item.aspectRatio && applyAspectRatio) applyAspectRatio(item.aspectRatio);
    if (item.model && applyModelSelection) applyModelSelection(item.model);
    closeLightbox();
    if (showAuthAlert) showAuthAlert('Prompt dan pengaturan berhasil diterapkan!', 'success');
  };

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeLightbox();
    } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
      currentIndex -= 1;
      renderItem(navigationItems[currentIndex]);
    } else if (e.key === 'ArrowRight' && currentIndex < navigationItems.length - 1) {
      currentIndex += 1;
      renderItem(navigationItems[currentIndex]);
    }
  };
  documentRef.addEventListener('keydown', escHandler);

  pageLightbox.style.display = 'block';
}

export function renderAllHistoryModalUi({
  allGrid,
  savedRecentGenerations = [],
  escapeHtml,
  showMediaLightbox,
  downloadMediaBlob,
  genPromptInput,
  applyAspectRatio,
  applyModelSelection,
  showAuthAlert,
}) {
  if (!allGrid) return;

  if (!savedRecentGenerations || savedRecentGenerations.length === 0) {
    allGrid.innerHTML = `<div class="recent-gen-empty" style="grid-column:1/-1;">Belum ada riwayat hasil generasi.</div>`;
    return;
  }

  allGrid.innerHTML = savedRecentGenerations
    .map((item) => {
      const isVid = item.type === 'video' || item.url.includes('.mp4') || item.url.includes('.webm');
      const isFlowVideoThumbnail = isVid && /flow-content\.google\/image\//i.test(item.url || '');
      const mediaTag = isVid && !isFlowVideoThumbnail
        ? `<video src="${item.url}" class="recent-gen-thumb" muted preload="metadata" playsinline></video>`
        : `<img src="${item.url}" alt="Hasil Generasi" class="recent-gen-thumb" loading="lazy" referrerpolicy="no-referrer" crossorigin="anonymous">`;

      const chatIdTag = item.chatId
        ? `<span class="recent-gen-chat-tag" title="Chat ID: ${escapeHtml(String(item.chatId))}">💬 #${escapeHtml(String(item.chatId).slice(-6))}</span>`
        : '';

      return `
        <div class="recent-gen-card" data-id="${item.id}" data-chat-id="${escapeHtml(String(item.chatId || ''))}" data-account-id="${escapeHtml(String(item.accountId || ''))}">
          <div class="recent-gen-thumb-wrap" data-id="${item.id}" data-url="${item.url}" data-type="${isVid ? 'video' : 'image'}">
            ${mediaTag}
            <span class="recent-gen-type-tag">${isVid ? 'VIDEO' : 'IMAGE'}</span>
            <span class="recent-gen-aspect-tag">${item.aspectRatio || '9:16'}</span>
            ${chatIdTag}
          </div>
          <div class="recent-gen-info">
            <div class="recent-gen-prompt-snippet" title="${escapeHtml(item.prompt)}">${escapeHtml(item.prompt)}</div>
            <div class="recent-gen-footer-row">
              <span class="recent-gen-model-label" title="${escapeHtml(item.modelLabel || item.model || 'AI Model')}">${escapeHtml(item.modelLabel || item.model || 'AI Model')}</span>
              <div class="recent-gen-actions">
                <button type="button" class="btn-icon-mini btn-copy-gen-prompt no-underline" data-prompt="${escapeHtml(item.prompt)}" title="Salin Prompt">📋</button>
                <button type="button" class="btn-icon-mini btn-reuse-gen-settings no-underline" data-id="${item.id}" title="Gunakan Ulang Pengaturan Prompt">↻</button>
                <button type="button" class="btn-icon-mini btn-download-gen-item no-underline" data-url="${item.url}" data-type="${isVid ? 'video' : 'image'}" data-prompt="${escapeHtml(item.prompt || 'weavy')}" title="Unduh">⬇</button>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  allGrid.querySelectorAll('.recent-gen-thumb-wrap').forEach((wrap) => {
    wrap.addEventListener('click', () => {
      const id = wrap.getAttribute('data-id');
      const url = wrap.getAttribute('data-url');
      const type = wrap.getAttribute('data-type');
      const item = savedRecentGenerations.find((g) => g.id === id) || { url, type };
      showMediaLightbox({
        target: item,
        savedRecentGenerations,
        genPromptInput,
        applyAspectRatio,
        applyModelSelection,
        downloadMediaBlob,
        showAuthAlert,
      });
    });
  });

  allGrid.querySelectorAll('.btn-download-gen-item').forEach((btn) => {
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

  allGrid.querySelectorAll('.btn-copy-gen-prompt').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = btn.getAttribute('data-prompt');
      if (p) {
        navigator.clipboard.writeText(p);
        btn.textContent = '✓';
        setTimeout(() => (btn.textContent = '📋'), 1500);
      }
    });
  });

  allGrid.querySelectorAll('.btn-reuse-gen-settings').forEach((btn) => {
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
        if (item.aspectRatio && applyAspectRatio) applyAspectRatio(item.aspectRatio);
        if (item.model && applyModelSelection) applyModelSelection(item.model);
        document.getElementById('allRecentGenerationsModal')?.classList.add('hidden');
        if (showAuthAlert) showAuthAlert('Prompt dan pengaturan berhasil diterapkan ke form!', 'success');
      }
    });
  });
}
