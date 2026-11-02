export function buildRecentGenerationRecord(item, currentGenMode = 'image') {
  if (!item || !item.url) return null;

  return {
    id: `gen_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sourceTaskId: item.sourceTaskId || null,
    chatId: item.chatId || item.conversationId || item.convId || null,
    accountId: item.accountId || null,
    provider: item.provider || null,
    prompt: item.prompt || '',
    url: item.url,
    type: item.type || currentGenMode || 'image',
    model: item.model || 'nano_banana_pro',
    modelLabel: item.modelLabel || 'Nano Banana Pro',
    aspectRatio: item.aspectRatio || '9:16',
    resolution: item.resolution || '1024x1024',
    referenceAssets: Array.isArray(item.referenceAssets)
      ? item.referenceAssets.map((asset) => {
        const assetUrl = asset?.url || asset?.downloadUrl || asset?.thumbnailUrl;
        if (!asset || !assetUrl) return null;
        return {
          ...asset,
          type: asset.type || 'image',
          url: assetUrl,
          thumbnailUrl: asset.thumbnailUrl || assetUrl,
        };
      }).filter(Boolean)
      : [],
    createdAt: Date.now(),
  };
}

export function isRecentGenerationVideo(itemOrUrl) {
  if (!itemOrUrl) return false;

  const url = typeof itemOrUrl === 'string' ? itemOrUrl : itemOrUrl.url || '';
  return itemOrUrl.type === 'video' || /\.mp4(?:\?|$)|\.webm(?:\?|$)|\.mov(?:\?|$)/i.test(url);
}

export function createRecentGenerationCardHtml(item, escapeHtml) {
  const isVid = isRecentGenerationVideo(item);
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
            <button type="button" class="btn-icon-mini btn-download-gen-item no-underline" data-url="${item.url}" data-type="${isVid ? 'video' : 'image'}" data-prompt="${escapeHtml(item.prompt || 'weavy')}" title="Unduh Resolusi Asli">⬇</button>
            <button type="button" class="btn-icon-mini btn-delete-gen-item no-underline" data-id="${item.id}" title="Hapus">×</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
