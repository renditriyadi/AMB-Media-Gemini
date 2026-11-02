export function renderGenRefGalleryUi({
  currentGenRefImages = [],
  refGalleryContainer = null,
  refImagesGrid = null,
  btnChooseRefImage = null,
  refImagesCountBadge = null,
  genRefTray = null,
  genRefCountText = null,
  genRefChipsGrid = null,
}) {
  const count = currentGenRefImages.length;

  if (genRefTray && genRefChipsGrid) {
    if (count === 0) {
      genRefTray.classList.add('hidden');
    } else {
      genRefTray.classList.remove('hidden');
      if (genRefCountText) {
        genRefCountText.textContent = `${count} Foto Referensi`;
      }

      genRefChipsGrid.innerHTML = currentGenRefImages
        .map((img, idx) => {
          let statusHtml = '';
          if (img.isUploading) {
            statusHtml = `
              <div class="gen-ref-chip-overlay uploading">
                <span class="gen-ref-spinner"></span>
              </div>
            `;
          } else if (img.showCheckmark) {
            statusHtml = `
              <div class="gen-ref-chip-overlay success-fade">
                <span class="gen-ref-check-icon">✓</span>
              </div>
            `;
          } else if (img.error) {
            statusHtml = `
              <div class="gen-ref-chip-overlay error">
                <span class="gen-ref-chip-error-tag">⚠️ Gagal</span>
              </div>
            `;
          }

          return `
            <div class="gen-ref-chip" data-id="${img.id}">
              <img src="${img.base64 || ''}" alt="Ref ${idx + 1}">
              ${statusHtml}
              <button type="button" class="gen-ref-chip-del" data-id="${img.id}" title="Hapus foto">&times;</button>
            </div>
          `;
        })
        .join('');

      genRefChipsGrid.querySelectorAll('.gen-ref-chip-del').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          const current = Array.isArray(currentGenRefImages) ? currentGenRefImages : [];
          const next = current.filter((item) => item.id !== id);
          if (typeof window !== 'undefined' && window.__weavyUpdateGenRefImages) {
            window.__weavyUpdateGenRefImages(next);
          }
        });
      });
    }
  }

  if (refGalleryContainer && refImagesGrid) {
    if (count === 0) {
      refGalleryContainer.classList.add('hidden');
      btnChooseRefImage?.classList.remove('hidden');
      if (refImagesCountBadge) {
        refImagesCountBadge.classList.add('hidden');
        refImagesCountBadge.textContent = '0 Foto';
      }
      return;
    }

    refGalleryContainer.classList.remove('hidden');
    btnChooseRefImage?.classList.add('hidden');
    if (refImagesCountBadge) {
      refImagesCountBadge.classList.remove('hidden');
      refImagesCountBadge.textContent = `${count} Foto`;
    }

    refImagesGrid.innerHTML = currentGenRefImages
      .map((img, idx) => {
        let badgeHtml = '';
        if (img.isUploading) {
          badgeHtml = '<div class="ref-card-badge"><span class="ref-upload-spinner"></span> Unggah...</div>';
        } else if (img.showCheckmark || img.asset) {
          badgeHtml = '<div class="ref-card-badge upload-success">✓ Siap</div>';
        } else if (img.error) {
          badgeHtml = '<div class="ref-card-badge upload-error">⚠️ Gagal</div>';
        }

        return `
          <div class="ref-card" data-id="${img.id}">
            <span class="ref-card-index">#${idx + 1}</span>
            <img class="ref-card-img" src="${img.base64 || ''}" alt="Ref ${idx + 1}">
            ${badgeHtml}
            <button type="button" class="ref-card-delete" data-id="${img.id}" title="Hapus foto">&times;</button>
          </div>
        `;
      })
      .join('');

    refImagesGrid.querySelectorAll('.ref-card-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const current = Array.isArray(currentGenRefImages) ? currentGenRefImages : [];
        const next = current.filter((item) => item.id !== id);
        if (typeof window !== 'undefined' && window.__weavyUpdateGenRefImages) {
          window.__weavyUpdateGenRefImages(next);
        }
      });
    });
  }
}

export async function handleAddGenRefFiles({
  fileList,
  currentGenRefImages,
  getValidImageFiles,
  getActiveAccount,
  showAuthAlert,
  switchTab,
  getValidIdToken,
  uploadAssetToWeavy,
  renderGenRefGallery,
}) {
  const files = getValidImageFiles(fileList);
  if (files.length === 0) return;

  const acc = getActiveAccount();
  if (!acc) {
    showAuthAlert('Silakan hubungkan akun Weavy terlebih dahulu di tab Akun & Token.', 'error');
    switchTab('settings');
    return;
  }

  const idToken = await getValidIdToken(acc);

  for (const file of files) {
    const reader = new FileReader();
    const item = {
      id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: file.name,
      base64: null,
      asset: null,
      isUploading: true,
      showCheckmark: false,
      error: null,
    };

    currentGenRefImages.push(item);
    renderGenRefGallery();

    reader.onload = async (ev) => {
      item.base64 = ev.target.result;
      renderGenRefGallery();

      try {
        const asset = await uploadAssetToWeavy(item.base64, idToken);
        if (asset && (asset.id || asset.url)) {
          item.asset = asset;
          item.isUploading = false;
          item.showCheckmark = true;
          renderGenRefGallery();

          setTimeout(() => {
            item.showCheckmark = false;
            renderGenRefGallery();
          }, 1800);
        } else {
          throw new Error('Respons asset dari Weavy tidak valid.');
        }
      } catch (err) {
        console.warn('Gagal mengunggah gambar referensi:', err);
        item.error = err.message || 'Gagal unggah';
        item.isUploading = false;
        item.showCheckmark = false;
        renderGenRefGallery();
      }
    };

    reader.readAsDataURL(file);
  }
}
