export function bindAccountImportUi({
  btnImportAccounts,
  importAccountsModal,
  btnCloseImportAccountsModal,
  importAccountsOverlay,
  inputFileImportAccounts,
  inputImportAccountsText,
  btnExecuteImportAccounts,
  importStatusAlert,
  importProgressPanel,
  importTotalLabel,
  importProgressLabel,
  importProgressFill,
  importProgressTrack,
  countImportAccounts,
  handleImportAccounts,
  showAuthAlert,
}) {
  let selectedImportFormat = 'auto';

  const updateImportProgress = (total, current = 0, state = 'active') => {
    if (!importProgressPanel || !importProgressLabel || !importProgressFill) return;
    if (!total || total <= 0) {
      importProgressPanel.classList.add('hidden');
      if (importTotalLabel) importTotalLabel.textContent = 'Total akun: 0';
      if (importProgressLabel) importProgressLabel.textContent = 'Proses: 0/0';
      importProgressFill.style.width = '0%';
      return;
    }

    const safeCurrent = Math.min(Math.max(current, 0), total);
    const percentage = Math.round((safeCurrent / total) * 100);
    importProgressPanel.classList.remove('hidden', 'complete', 'error');
    if (state === 'complete' || state === 'error') {
      importProgressPanel.classList.add(state);
    }
    if (importTotalLabel) importTotalLabel.textContent = `Total akun: ${total}`;
    importProgressLabel.textContent = `Proses: ${safeCurrent}/${total}`;
    importProgressFill.style.width = `${percentage}%`;
    if (importProgressTrack) {
      importProgressTrack.setAttribute('aria-valuemax', String(total));
      importProgressTrack.setAttribute('aria-valuenow', String(safeCurrent));
    }
  };

  const updateImportPreview = () => {
    const rawText = inputImportAccountsText?.value?.trim() || '';
    const total = typeof countImportAccounts === 'function' ? countImportAccounts(rawText) : 0;
    if (total > 0) {
      updateImportProgress(total, 0, 'active');
      if (importStatusAlert) importStatusAlert.classList.add('hidden');
    } else {
      updateImportProgress(0, 0);
    }
  };

  const showImportAlert = (msg, type) => {
    if (!importStatusAlert) return;
    importStatusAlert.className = `status-alert ${type}`;
    importStatusAlert.textContent = msg;
    importStatusAlert.classList.remove('hidden');
  };

  btnImportAccounts?.addEventListener('click', () => {
    importAccountsModal?.classList.remove('hidden');
    if (inputImportAccountsText) inputImportAccountsText.value = '';
    if (inputFileImportAccounts) inputFileImportAccounts.value = '';
    selectedImportFormat = 'auto';
    if (importStatusAlert) importStatusAlert.classList.add('hidden');
    updateImportProgress(0);
  });

  const closeImportModal = () => {
    importAccountsModal?.classList.add('hidden');
    if (importStatusAlert) importStatusAlert.classList.add('hidden');
  };

  btnCloseImportAccountsModal?.addEventListener('click', closeImportModal);
  importAccountsOverlay?.addEventListener('click', closeImportModal);

  inputFileImportAccounts?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    selectedImportFormat = file.name.toLowerCase().endsWith('.txt') ? 'txt' : (file.name.toLowerCase().endsWith('.json') ? 'json' : 'auto');
    const reader = new FileReader();
    reader.onload = (re) => {
      if (inputImportAccountsText) {
        inputImportAccountsText.value = re.target.result;
      }
      updateImportPreview();
    };
    reader.readAsText(file);
  });

  inputImportAccountsText?.addEventListener('input', updateImportPreview);

  btnExecuteImportAccounts?.addEventListener('click', async () => {
    const rawText = inputImportAccountsText?.value?.trim();
    if (!rawText) {
      showImportAlert('Silakan pilih file JSON/TXT atau tempelkan data akun terlebih dahulu.', 'error');
      updateImportProgress(0);
      return;
    }

    const totalToProcess = typeof countImportAccounts === 'function' ? countImportAccounts(rawText) : 0;
    if (!totalToProcess) {
      showImportAlert('Tidak ditemukan akun atau token yang valid dalam data tersebut. Pastikan format teks berisi Email dan Refresh Token, atau file JSON akun.', 'error');
      updateImportProgress(0);
      return;
    }

    const origBtn = btnExecuteImportAccounts.innerHTML;
    btnExecuteImportAccounts.disabled = true;
    btnExecuteImportAccounts.innerHTML = `<span>Memproses Impor (0/${totalToProcess})...</span>`;
    updateImportProgress(totalToProcess, 0, 'active');

    try {
      const result = await handleImportAccounts(rawText, {
        format: selectedImportFormat,
        onProgress: (current, total, state) => {
          updateImportProgress(total, current, state);
          btnExecuteImportAccounts.innerHTML = `<span>Memproses Impor (${current}/${total})...</span>`;
        },
      });
      updateImportProgress(result?.total || totalToProcess, result?.total || totalToProcess, 'complete');
      showImportAlert(`✅ Berhasil impor ${result?.importedCount || 0} akun baru dan ${result?.updatedCount || 0} akun diperbarui.`, 'success');
      setTimeout(() => closeImportModal(), 1200);
    } catch (err) {
      showImportAlert(`❌ ${err.message || 'Gagal impor akun.'}`, 'error');
      updateImportProgress(totalToProcess, 0, 'error');
    } finally {
      btnExecuteImportAccounts.disabled = false;
      btnExecuteImportAccounts.innerHTML = origBtn;
    }
  });

  return {
    updateImportProgress,
    showImportAlert,
    closeImportModal,
  };
}
