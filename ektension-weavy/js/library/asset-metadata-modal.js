/**
 * Asset Metadata Modal Module
 * Mengelola popup dialog edit data aset visual library (Nama, Role, Niche, Deskripsi Konteks AI, Tags).
 */

export function openAssetMetadataModal({
  documentRef = document,
  asset = null,
  escapeHtml = (value) => String(value || ''),
  onSave = null,
  onAnalyze = null,
} = {}) {
  if (!asset) return;

  const existingModal = documentRef.getElementById('assetMetadataModal');
  if (existingModal) existingModal.remove();

  const roleOptions = [
    { value: 'model', label: 'Talent / Model' },
    { value: 'product', label: 'Produk' },
    { value: 'background', label: 'Background / Latar' },
    { value: 'props', label: 'Props / Objek Pendukung' },
    { value: 'custom', label: 'Other / Lainnya' },
  ];

  const currentRole = asset.role || 'custom';
  const currentName = asset.name && asset.name !== 'Gambar referensi' && asset.name !== 'Library asset' ? asset.name : '';
  const currentNiche = asset.talentNiche || asset.niche || '';
  const currentDesc = asset.description || '';
  const currentTags = Array.isArray(asset.tags) ? asset.tags.join(', ') : (asset.tags || '');
  const imageUrl = asset.thumbnailUrl || asset.url || '';

  const modalHtml = `
    <div id="assetMetadataModal" class="asset-meta-backdrop">
      <div class="asset-meta-sheet" role="dialog" aria-labelledby="assetMetaModalTitle" aria-modal="true">
        <div class="asset-meta-header">
          <div class="asset-meta-header-copy">
            <h3 id="assetMetaModalTitle" class="asset-meta-title">Edit Data & Konteks Aset</h3>
            <p class="asset-meta-subtitle">Beri identitas agar AI (Storyboard & Chat) mengenali talent, produk, atau latar ini secara otomatis.</p>
          </div>
          <button type="button" id="btnCloseAssetMetaModal" class="asset-meta-close-btn" title="Tutup" aria-label="Tutup">✕</button>
        </div>

        <form id="assetMetaForm" class="asset-meta-body">
          <!-- Preview Section -->
          <div class="asset-meta-preview-card">
            <div class="asset-meta-thumb-wrap">
              <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(currentName || 'Preview Aset')}" class="asset-meta-thumb" />
            </div>
            <div class="asset-meta-preview-info">
              <span class="asset-meta-source-pill">${escapeHtml(asset.source || 'Library')}</span>
              <span class="asset-meta-url-dim">${escapeHtml(asset.id || 'Aset')}</span>
              <p class="asset-meta-hint">Data ini akan menjadi basis pengetahuan AI saat membuat storyboard dan prompt.</p>
            </div>
          </div>

          <!-- Fields -->
          <div class="asset-meta-field-group">
            <label for="assetMetaNameInput" class="asset-meta-label">
              Nama Aset / Persona <span class="text-req">*</span>
            </label>
            <input 
              type="text" 
              id="assetMetaNameInput" 
              class="asset-meta-input" 
              placeholder="Contoh: Rudi, Serum Brightening, Dapur Skandinavia" 
              value="${escapeHtml(currentName)}" 
              required
            />
          </div>

          <div class="asset-meta-grid-2">
            <div class="asset-meta-field-group">
              <label for="assetMetaRoleSelect" class="asset-meta-label">Role / Kategori Aset</label>
              <select id="assetMetaRoleSelect" class="asset-meta-select">
                ${roleOptions.map((opt) => `
                  <option value="${opt.value}" ${currentRole === opt.value ? 'selected' : ''}>${opt.label}</option>
                `).join('')}
              </select>
            </div>

            <div class="asset-meta-field-group">
              <label for="assetMetaNicheInput" class="asset-meta-label">Peran / Niche Khusus</label>
              <input 
                type="text" 
                id="assetMetaNicheInput" 
                class="asset-meta-input" 
                placeholder="Contoh: Talent Pertanian, Skincare Botol Pipet" 
                value="${escapeHtml(currentNiche)}" 
              />
            </div>
          </div>

          <div class="asset-meta-field-group">
            <div class="asset-meta-label-wrap">
              <label for="assetMetaDescTextarea" class="asset-meta-label">Deskripsi & Konteks AI (Sangat Direkomendasikan)</label>
              <button 
                type="button" 
                id="btnAiContextAnalyze" 
                class="asset-meta-badge-smart" 
                title="Klik untuk analisis gambar otomatis dan buat deskripsi konteks AI"
                aria-label="Buat deskripsi otomatis dengan AI Context"
              >
                <span class="ai-context-icon">✨</span>
                <span id="aiContextBadgeText">AI Context</span>
              </button>
            </div>
            <textarea 
              id="assetMetaDescTextarea" 
              class="asset-meta-textarea" 
              rows="3" 
              placeholder="Jelaskan detail untuk AI. Contoh: Rudi adalah talent pria lokal usia 35 tahun berwajah ramah, cocok untuk produk pertanian, bibit sayur hidroponik, perkakas, dan pupuk."
            >${escapeHtml(currentDesc)}</textarea>
            <small class="asset-meta-help">AI Copilot & Chat akan membaca deskripsi ini untuk mencocokkan talent/produk dengan konsep video kamu.</small>
          </div>

          <div class="asset-meta-field-group">
            <label for="assetMetaTagsInput" class="asset-meta-label">Kata Kunci / Tags (Pisahkan dengan koma)</label>
            <input 
              type="text" 
              id="assetMetaTagsInput" 
              class="asset-meta-input" 
              placeholder="Contoh: pertanian, bibit sayuran, petani, pria ramah" 
              value="${escapeHtml(currentTags)}" 
            />
          </div>

          <div class="asset-meta-actions">
            <button type="button" id="btnCancelAssetMeta" class="btn-sm btn-outline">Batal</button>
            <button type="submit" id="btnSaveAssetMeta" class="btn-sm btn-primary">Simpan Data Aset</button>
          </div>
        </form>
      </div>
    </div>
  `;

  documentRef.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = documentRef.getElementById('assetMetadataModal');
  const closeBtn = documentRef.getElementById('btnCloseAssetMetaModal');
  const cancelBtn = documentRef.getElementById('btnCancelAssetMeta');
  const formEl = documentRef.getElementById('assetMetaForm');
  const nameInput = documentRef.getElementById('assetMetaNameInput');
  const roleSelect = documentRef.getElementById('assetMetaRoleSelect');
  const nicheInput = documentRef.getElementById('assetMetaNicheInput');
  const descTextarea = documentRef.getElementById('assetMetaDescTextarea');
  const tagsInput = documentRef.getElementById('assetMetaTagsInput');
  const aiContextBtn = documentRef.getElementById('btnAiContextAnalyze');
  const aiContextText = documentRef.getElementById('aiContextBadgeText');

  const closeModal = () => {
    modalEl?.classList.add('closing');
    setTimeout(() => modalEl?.remove(), 160);
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);

  modalEl?.addEventListener('click', (e) => {
    if (e.target === modalEl) closeModal();
  });

  // Handle AI Context click
  let isAnalyzing = false;
  aiContextBtn?.addEventListener('click', async () => {
    if (isAnalyzing) return;
    if (typeof onAnalyze !== 'function') {
      alert('Fitur AI Analysis belum tersedia.');
      return;
    }

    isAnalyzing = true;
    aiContextBtn.classList.add('loading');
    if (aiContextText) aiContextText.textContent = 'Menganalisis...';
    descTextarea?.classList.add('asset-meta-textarea-analyzing');

    const originalPlaceholder = descTextarea?.placeholder;
    if (descTextarea) {
      descTextarea.placeholder = 'Sedang menganalisis visual aset dengan AI Vision...';
    }

    try {
      const currentFormValues = {
        name: nameInput?.value.trim() || '',
        role: roleSelect?.value || 'custom',
        talentNiche: nicheInput?.value.trim() || '',
        tags: tagsInput?.value.trim() || '',
      };

      const result = await onAnalyze(asset, currentFormValues);

      if (result) {
        if (result.description && descTextarea) {
          descTextarea.value = result.description;
        }
        if (result.talentNiche && nicheInput && !nicheInput.value.trim()) {
          nicheInput.value = result.talentNiche;
        }
        if (result.role && roleSelect && (roleSelect.value === 'custom' || !roleSelect.value)) {
          roleSelect.value = result.role;
        }
        if (result.tags && tagsInput && !tagsInput.value.trim()) {
          tagsInput.value = Array.isArray(result.tags) ? result.tags.join(', ') : result.tags;
        }
        if (result.name && nameInput && !nameInput.value.trim()) {
          nameInput.value = result.name;
        }

        // Highlight flash effect
        descTextarea?.classList.add('asset-meta-textarea-glow');
        setTimeout(() => {
          descTextarea?.classList.remove('asset-meta-textarea-glow');
        }, 1200);

        if (aiContextText) aiContextText.textContent = '✨ Selesai!';
        setTimeout(() => {
          if (aiContextText) aiContextText.textContent = 'AI Context';
        }, 2000);
      }
    } catch (err) {
      console.error('[AI Context Analysis Error]:', err);
      alert(err.message || 'Gagal menganalisis aset dengan AI. Silakan coba lagi.');
      if (aiContextText) aiContextText.textContent = 'AI Context';
    } finally {
      isAnalyzing = false;
      aiContextBtn?.classList.remove('loading');
      descTextarea?.classList.remove('asset-meta-textarea-analyzing');
      if (descTextarea && originalPlaceholder) {
        descTextarea.placeholder = originalPlaceholder;
      }
    }
  });

  formEl?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawTags = (tagsInput?.value || '').split(',').map((t) => t.trim()).filter(Boolean);
    const updatedData = {
      name: nameInput?.value.trim() || asset.name || 'Gambar referensi',
      role: roleSelect?.value || 'custom',
      talentNiche: nicheInput?.value.trim() || '',
      description: descTextarea?.value.trim() || '',
      tags: rawTags,
      updatedAt: Date.now(),
    };

    if (typeof onSave === 'function') {
      await onSave(asset, updatedData);
    }
    closeModal();
  });

  // Focus on name input
  setTimeout(() => nameInput?.focus(), 50);
}
