function showConfirmModal(message, onConfirm) {
  const modal = document.getElementById('deleteAccountConfirmModal');
  const msgEl = document.getElementById('deleteAccountModalMessage');
  const btnClose = document.getElementById('btnCloseDeleteAccountModal');
  const btnCancel = document.getElementById('btnCancelDeleteAccount');
  const overlay = document.getElementById('deleteAccountOverlay');
  const btnConfirm = document.getElementById('btnConfirmDeleteAccountAction');

  if (!modal || !btnConfirm) {
    try {
      if (typeof window !== 'undefined' && window.confirm(message)) {
        onConfirm();
      }
    } catch {
      onConfirm();
    }
    return;
  }

  if (msgEl) {
    msgEl.textContent = message;
  }
  modal.classList.remove('hidden');

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    modal.classList.add('hidden');
    btnConfirm.removeEventListener('click', handleConfirm);
    btnCancel?.removeEventListener('click', cleanup);
    btnClose?.removeEventListener('click', cleanup);
    overlay?.removeEventListener('click', cleanup);
  };

  const handleConfirm = () => {
    cleanup();
    onConfirm();
  };

  btnConfirm.addEventListener('click', handleConfirm);
  btnCancel?.addEventListener('click', cleanup);
  btnClose?.addEventListener('click', cleanup);
  overlay?.addEventListener('click', cleanup);
}

export function bindAccountEvents({
  accountsListContainer,
  inputSearchAccount,
  btnClearAccountSearch,
  btnToggleBatchSelect,
  chkSelectAllAccounts,
  btnBatchSyncSelected,
  btnBatchDeleteSelected,
  btnBatchCancel,
  getAccounts,
  setAccounts,
  getActiveAccountId,
  setActiveAccountId,
  getBatchSelectMode,
  setBatchSelectMode,
  selectedAccountIds,
  getSearchQuery,
  setSearchQuery,
  renderAccountsList,
  renderHeaderAccount,
  saveAccounts,
  syncSingleAccount,
  syncAccountSessionToBrowserTab,
  showAuthAlert,
}) {
  inputSearchAccount?.addEventListener('input', (event) => {
    setSearchQuery(event.target.value);
    btnClearAccountSearch?.classList.toggle('hidden', !getSearchQuery());
    renderAccountsList();
  });

  btnClearAccountSearch?.addEventListener('click', () => {
    if (inputSearchAccount) inputSearchAccount.value = '';
    setSearchQuery('');
    btnClearAccountSearch?.classList.add('hidden');
    renderAccountsList();
  });

  btnToggleBatchSelect?.addEventListener('click', () => {
    const nextMode = !getBatchSelectMode();
    setBatchSelectMode(nextMode);
    if (!nextMode) selectedAccountIds.clear();
    renderAccountsList();
  });

  chkSelectAllAccounts?.addEventListener('change', (event) => {
    const query = getSearchQuery().toLowerCase().trim();
    const accounts = getAccounts();
    const filteredAccounts = query
      ? accounts.filter((account) =>
          (account.email && account.email.toLowerCase().includes(query)) ||
          (account.name && account.name.toLowerCase().includes(query)) ||
          (account.userId && String(account.userId).toLowerCase().includes(query)) ||
          (account.id && String(account.id).toLowerCase().includes(query))
        )
      : accounts;

    if (event.target.checked) {
      filteredAccounts.forEach((account) => selectedAccountIds.add(account.id));
    } else {
      selectedAccountIds.clear();
    }
    renderAccountsList();
  });

  btnBatchCancel?.addEventListener('click', () => {
    setBatchSelectMode(false);
    selectedAccountIds.clear();
    renderAccountsList();
  });

  btnBatchSyncSelected?.addEventListener('click', async () => {
    if (selectedAccountIds.size === 0) {
      showAuthAlert('Pilih minimal satu akun untuk disinkronkan.', 'error');
      return;
    }

    const count = selectedAccountIds.size;
    showAuthAlert(`Menyinkronkan ${count} akun terpilih...`, '');
    for (const id of Array.from(selectedAccountIds)) {
      await syncSingleAccount(id);
    }
    showAuthAlert(`Sinkronisasi ${count} akun selesai!`, 'success');
    renderAccountsList();
  });

  btnBatchDeleteSelected?.addEventListener('click', () => {
    if (selectedAccountIds.size === 0) {
      showAuthAlert('Pilih minimal satu akun untuk dihapus.', 'error');
      return;
    }

    const count = selectedAccountIds.size;
    showConfirmModal(`Hapus ${count} akun yang dipilih dari daftar?`, async () => {
      const remainingAccounts = getAccounts().filter((account) => !selectedAccountIds.has(account.id));
      setAccounts(remainingAccounts);
      if (selectedAccountIds.has(getActiveAccountId())) {
        setActiveAccountId(remainingAccounts.length > 0 ? remainingAccounts[0].id : null);
      }
      selectedAccountIds.clear();
      setBatchSelectMode(false);
      await saveAccounts();
      renderAccountsList();
      renderHeaderAccount();
      showAuthAlert(`✅ ${count} akun terpilih berhasil dihapus.`, 'success');
    });
  });

  accountsListContainer?.addEventListener('click', async (event) => {
    const editProfileBtn = event.target.closest('.btn-edit-profile');
    if (editProfileBtn) {
      const id = editProfileBtn.getAttribute('data-id');
      const targetAccount = getAccounts().find((a) => a.id === id);
      if (!targetAccount) return;

      const currentProfile = targetAccount.chromeProfile || 'Profile Utama';
      const newProfile = prompt(`Ubah Nama / Nomor Profil Chrome untuk akun ${targetAccount.email || ''}:\n(Contoh: Profile 1, Profile 2, Akun Utama, dll.)`, currentProfile);
      if (newProfile !== null && newProfile.trim()) {
        targetAccount.chromeProfile = newProfile.trim();
        await saveAccounts();
        renderAccountsList();
        showAuthAlert(`✅ Label profil akun diubah menjadi "${targetAccount.chromeProfile}".`, 'success');
      }
      return;
    }

    const openFlowBtn = event.target.closest('.btn-open-flow');
    if (openFlowBtn) {
      const email = openFlowBtn.getAttribute('data-email') || '';
      const emailParam = email ? `?authuser=${encodeURIComponent(email)}` : '';
      const targetUrl = `https://labs.google/fx/tools/flow${emailParam}`;
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({ url: targetUrl, active: true });
      } else {
        window.open(targetUrl, '_blank');
      }
      showAuthAlert(`🌐 Membuka Google Flow di tab baru untuk ${email || 'akun ini'}...`, 'info');
      return;
    }

    const openDolaBtn = event.target.closest('.btn-open-dola');
    if (openDolaBtn) {
      const targetUrl = 'https://www.dola.com/';
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({ url: targetUrl, active: true });
      } else {
        window.open(targetUrl, '_blank');
      }
      showAuthAlert('🌐 Membuka Dola AI (dola.com) di tab baru...', 'info');
      return;
    }

    const openGeminiBtn = event.target.closest('.btn-open-gemini');
    if (openGeminiBtn) {
      const email = openGeminiBtn.getAttribute('data-email') || '';
      const emailParam = email ? `?authuser=${encodeURIComponent(email)}` : '';
      const targetUrl = `https://gemini.google.com/app${emailParam}`;
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({ url: targetUrl, active: true });
      } else {
        window.open(targetUrl, '_blank');
      }
      showAuthAlert(`🌐 Membuka Google Gemini di tab baru untuk ${email || 'akun ini'}...`, 'info');
      return;
    }

    const copyButton = event.target.closest('.btn-copy-account');
    if (copyButton) {
      const id = copyButton.getAttribute('data-id');
      const targetAccount = getAccounts().find((account) => account.id === id);
      if (!targetAccount) return;

      const exportObj = {
        app: 'Weavy Extension AI Pro',
        version: '6.0',
        exportedAt: new Date().toISOString(),
        account: {
          id: targetAccount.id,
          userId: targetAccount.userId || targetAccount.id,
          provider: targetAccount.provider || 'weavy',
          email: targetAccount.email || '',
          name: targetAccount.name || '',
          chromeProfile: targetAccount.chromeProfile || 'Profile Utama',
          credits: targetAccount.credits ?? 100,
          refreshToken: targetAccount.refreshToken || '',
          idToken: targetAccount.idToken || '',
          expiresAt: targetAccount.expiresAt || null,
          cookie: targetAccount.cookie || '',
          sessionid: targetAccount.sessionid || '',
          apiKey: targetAccount.apiKey || '',
        },
      };

      const copyText = JSON.stringify(exportObj, null, 2);
      try {
        await navigator.clipboard.writeText(copyText);
        const originalHtml = copyButton.innerHTML;
        copyButton.innerHTML = `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
        showAuthAlert(`📋 Data akun "${targetAccount.email || targetAccount.name || ''}" berhasil disalin! Anda dapat menempelkannya di menu "+ Manual" atau "Import".`, 'success');
        setTimeout(() => {
          copyButton.innerHTML = originalHtml;
        }, 2000);
      } catch (err) {
        prompt('Salin data JSON akun berikut:', copyText);
      }
      return;
    }

    const syncButton = event.target.closest('.btn-sync-account');
    if (syncButton) {
      const id = syncButton.getAttribute('data-id');
      const originalHtml = syncButton.innerHTML;
      syncButton.disabled = true;
      syncButton.innerHTML = '<span>...</span>';
      await syncSingleAccount(id);
      syncButton.innerHTML = originalHtml;
      syncButton.disabled = false;
      return;
    }

    const selectButton = event.target.closest('.btn-set-active');
    if (selectButton) {
      const id = selectButton.getAttribute('data-id');
      const selectedAccount = getAccounts().find((account) => account.id === id);
      selectButton.disabled = true;
      selectButton.innerHTML = '<span>Menyambungkan...</span>';
      await syncAccountSessionToBrowserTab(id);
      if (selectedAccount?.provider !== 'flow' && selectedAccount?.provider !== 'dola') {
        await syncSingleAccount(id);
      }
      renderHeaderAccount();
      renderAccountsList();
      return;
    }

    const deleteButton = event.target.closest('.btn-del-account');
    if (deleteButton) {
      const id = deleteButton.getAttribute('data-id');
      const targetAccount = getAccounts().find((account) => account.id === id);
      const label = targetAccount ? (targetAccount.email || targetAccount.name || targetAccount.userId || 'ini') : 'ini';

      showConfirmModal(`Hapus akun "${label}" dari daftar?`, async () => {
        const remainingAccounts = getAccounts().filter((account) => account.id !== id);
        setAccounts(remainingAccounts);
        selectedAccountIds.delete(id);
        if (getActiveAccountId() === id) {
          setActiveAccountId(remainingAccounts.length > 0 ? remainingAccounts[0].id : null);
        }
        await saveAccounts();
        renderAccountsList();
        renderHeaderAccount();
        showAuthAlert(`✅ Akun ${label} berhasil dihapus.`, 'success');
      });
      return;
    }
  });
}
