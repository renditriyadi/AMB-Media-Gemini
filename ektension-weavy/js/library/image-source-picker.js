export function openImageSourcePicker({
  documentRef = document,
  assets = [],
  fileInput = null,
  onLibraryAsset = null,
  onUploadFiles = null,
  escapeHtml = (value) => String(value || ''),
} = {}) {
  const modal = documentRef.getElementById('imageSourcePickerModal');
  const body = documentRef.getElementById('imageSourcePickerBody');
  const title = documentRef.getElementById('imageSourcePickerTitle');
  const closeButton = documentRef.getElementById('btnCloseImageSourcePicker');
  if (!modal || !body) return;

  const close = () => modal.classList.add('hidden');
  const renderHome = () => {
    title.textContent = 'Add Image';
    body.innerHTML = `
      <div class="image-source-options">
        <button type="button" class="image-source-option" data-source="upload">
          <span class="image-source-option-icon">▧</span>
          <span class="image-source-option-copy"><strong>Upload</strong><small>Upload an image</small></span>
          <span class="image-source-chevron">›</span>
        </button>
        <button type="button" class="image-source-option" data-source="library">
          <span class="image-source-option-icon">▦</span>
          <span class="image-source-option-copy"><strong>Library</strong><small>Choose a saved image</small></span>
          <span class="image-source-chevron">›</span>
        </button>
      </div>
    `;

    body.querySelector('[data-source="upload"]')?.addEventListener('click', () => {
      close();
      if (fileInput) {
        const previousOnChange = fileInput.onchange;
        fileInput.onchange = async (event) => {
          try {
            if (typeof onUploadFiles === 'function') {
              await onUploadFiles(fileInput.files);
            } else if (typeof previousOnChange === 'function') {
              await previousOnChange(event || { target: fileInput });
            }
          } finally {
            fileInput.value = '';
            fileInput.onchange = previousOnChange || null;
          }
        };
        fileInput.click();
      }
    });
    body.querySelector('[data-source="library"]')?.addEventListener('click', renderLibrary);
  };

  const renderLibrary = () => {
    title.textContent = 'Library';
    body.innerHTML = assets.length
      ? `<div class="image-source-library-grid">${assets.map((asset) => `
          <button type="button" class="image-source-library-item" data-asset-id="${escapeHtml(asset.id)}">
            <img src="${escapeHtml(asset.thumbnailUrl || asset.url)}" alt="${escapeHtml(asset.name || 'Library image')}">
            <span>${escapeHtml(asset.name || 'Image')}</span>
          </button>
        `).join('')}</div>`
      : '<div class="image-source-empty">Belum ada gambar di Library.</div>';

    body.querySelectorAll('.image-source-library-item').forEach((button) => {
      button.addEventListener('click', () => {
        const asset = assets.find((item) => item.id === button.dataset.assetId);
        if (asset && onLibraryAsset) onLibraryAsset(asset);
        close();
      });
    });
  };

  closeButton.onclick = close;
  modal.onclick = (event) => {
    if (event.target === modal) close();
  };
  renderHome();
  modal.classList.remove('hidden');
}
