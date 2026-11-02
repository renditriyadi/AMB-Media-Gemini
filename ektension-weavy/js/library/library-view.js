export function renderLibraryUi({
  container = null,
  assets = [],
  escapeHtml = (value) => String(value || ''),
  onPreview = null,
  onUseGenerator = null,
  onRoleChange = null,
  onDelete = null,
  onUpload = null,
  onEditMetadata = null,
} = {}) {
  if (!container) return;

  const roleLabels = {
    product: 'Produk',
    model: 'Talent / Model',
    background: 'Background',
    props: 'Props / Objek',
    custom: 'Other',
  };
  let activeRole = 'all';

  const render = () => {
    const filteredAssets = activeRole === 'all'
      ? assets
      : assets.filter((asset) => (asset.role || 'custom') === activeRole);

    if (!assets.length) {
    container.innerHTML = `
      <section class="library-empty-state">
        <div class="library-empty-icon">▦</div>
        <h2>Library masih kosong</h2>
        <p>Gambar referensi yang kamu gunakan di Generator atau Storyboard akan muncul di sini.</p>
        <label class="library-upload-btn library-empty-upload-btn">
          <span>+ Upload Asset ke Library</span>
          <input type="file" class="library-upload-input sr-only" accept="image/*" multiple>
        </label>
      </section>
    `;
    container.querySelector('.library-upload-input')?.addEventListener('change', async (event) => {
      if (onUpload && event.target.files?.length) await onUpload(event.target.files);
      event.target.value = '';
    });
    return;
  }

  container.innerHTML = `
    <section class="library-header">
      <div>
        <p class="eyebrow-label">WEAVY COLLECTION</p>
        <h1>Library</h1>
        <p class="library-subtitle">Referensi gambar yang sudah tersimpan dan siap dipakai kembali.</p>
      </div>
      <div class="library-header-actions">
        <label class="library-upload-btn" title="Upload gambar ke Weavy dan simpan ke Library">
          <span>+ Tambah Asset</span>
          <input type="file" class="library-upload-input sr-only" accept="image/*" multiple>
        </label>
        <span class="library-count">${filteredAssets.length} dari ${assets.length} gambar</span>
      </div>
    </section>
    <div class="library-role-filters" role="tablist" aria-label="Filter role asset">
      <button type="button" class="library-role-filter ${activeRole === 'all' ? 'active' : ''}" data-role="all">Semua</button>
      ${Object.entries(roleLabels).map(([role, label]) => `
        <button type="button" class="library-role-filter ${activeRole === role ? 'active' : ''}" data-role="${role}">${label}</button>
      `).join('')}
    </div>
    <section class="library-grid">
      ${filteredAssets.length ? filteredAssets.map((asset) => {
        const hasCustomData = Boolean(asset.talentNiche || asset.description || (asset.tags && asset.tags.length));
        return `
        <article class="library-card ${hasCustomData ? 'has-custom-metadata' : ''}" data-asset-id="${escapeHtml(asset.id)}">
          <div class="library-preview-wrap">
            <button type="button" class="library-preview-btn" data-asset-id="${escapeHtml(asset.id)}" title="Lihat gambar">
              <img src="${escapeHtml(asset.thumbnailUrl || asset.url)}" alt="${escapeHtml(asset.name || 'Gambar referensi')}" loading="lazy">
            </button>
            <div class="library-preview-badges">
              <span class="library-role-badge role-${escapeHtml(asset.role || 'custom')}">${escapeHtml(roleLabels[asset.role || 'custom'])}</span>
              ${asset.talentNiche ? `<span class="library-niche-badge" title="${escapeHtml(asset.talentNiche)}">${escapeHtml(asset.talentNiche)}</span>` : ''}
            </div>
            <button type="button" class="library-delete-btn" data-asset-id="${escapeHtml(asset.id)}" title="Hapus dari Library saja" aria-label="Hapus dari Library saja">&times;</button>
          </div>
          <div class="library-card-info">
            <div class="library-card-title-row">
              <strong title="${escapeHtml(asset.name || 'Gambar referensi')}">${escapeHtml(asset.name || 'Gambar referensi')}</strong>
            </div>
            <span class="library-source-dim">${escapeHtml(asset.source || 'Referensi')}</span>
            ${asset.description ? `
              <p class="library-desc-snippet" title="${escapeHtml(asset.description)}">
                <span class="library-ai-sparkle">✦</span> ${escapeHtml(asset.description)}
              </p>
            ` : ''}
          </div>
          <div class="library-card-actions">
            <button type="button" class="library-edit-btn" data-asset-id="${escapeHtml(asset.id)}" title="Edit data & konteks aset" aria-label="Edit data">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                <path d="m15 5 4 4"/>
              </svg>
            </button>
            <button type="button" class="library-use-btn" data-asset-id="${escapeHtml(asset.id)}" title="Gunakan di Generator">
              Gunakan
            </button>
          </div>
        </article>
      `;
      }).join('') : '<div class="library-filter-empty">Belum ada asset pada kategori ini.</div>'}
    </section>
  `;

  container.querySelectorAll('.library-role-filter').forEach((button) => {
    button.addEventListener('click', () => {
      activeRole = button.dataset.role || 'all';
      render();
    });
  });

  container.querySelectorAll('.library-upload-input').forEach((input) => {
    input.addEventListener('change', async () => {
      if (onUpload && input.files?.length) await onUpload(input.files);
      input.value = '';
    });
  });

  container.querySelectorAll('.library-preview-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const asset = assets.find((item) => item.id === button.dataset.assetId);
      if (asset && onPreview) onPreview(asset);
    });
  });

  container.querySelectorAll('.library-delete-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const asset = assets.find((item) => item.id === button.dataset.assetId);
      if (asset && onDelete) onDelete(asset);
    });
  });

  container.querySelectorAll('.library-edit-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const asset = assets.find((item) => item.id === button.dataset.assetId);
      if (asset && onEditMetadata) onEditMetadata(asset);
    });
  });

  container.querySelectorAll('.library-use-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const asset = assets.find((item) => item.id === button.dataset.assetId);
      if (asset && onUseGenerator) onUseGenerator(asset);
    });
  });
  };

  render();
}
