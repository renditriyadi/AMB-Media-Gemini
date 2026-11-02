// Google & Gemini Auto-Flow - Side Panel Controller
// Full Step-by-Step Pipeline & Two-Step Session Authentication

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const statusBadge = document.getElementById('statusBadge');
  const step1Node = document.getElementById('step1Node');
  const step2Node = document.getElementById('step2Node');
  const btnGlobalClearData = document.getElementById('btnGlobalClearData');

  // Tabs
  const tabSingleBtn = document.getElementById('tabSingleBtn');
  const tabBatchBtn = document.getElementById('tabBatchBtn');
  const tabSessionsBtn = document.getElementById('tabSessionsBtn');
  const tabLogsBtn = document.getElementById('tabLogsBtn');

  const tabSingle = document.getElementById('tabSingle');
  const tabBatch = document.getElementById('tabBatch');
  const tabSessions = document.getElementById('tabSessions');
  const tabLogs = document.getElementById('tabLogs');

  // Single Tab
  const singleEmail = document.getElementById('singleEmail');
  const singlePassword = document.getElementById('singlePassword');
  const togglePassBtn = document.getElementById('togglePassBtn');
  const btnStartSingle = document.getElementById('btnStartSingle');
  const btnStopLogin = document.getElementById('btnStopLogin');

  // Batch Tab
  const batchInput = document.getElementById('batchInput');
  const batchPassword = document.getElementById('batchPassword');
  const toggleBatchPassBtn = document.getElementById('toggleBatchPassBtn');
  const btnStartBatch = document.getElementById('btnStartBatch');
  const btnStopBatch = document.getElementById('btnStopBatch');

  // Saved Accounts / Sessions Tab
  const sessionMasterPassword = document.getElementById('sessionMasterPassword');
  const toggleSessionMasterPassBtn = document.getElementById('toggleSessionMasterPassBtn');
  const sessionsList = document.getElementById('sessionsList');
  const accountCountBadge = document.getElementById('accountCountBadge');
  const accountSearchInput = document.getElementById('accountSearchInput');
  const selectionToolbar = document.getElementById('selectionToolbar');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const selectAllLabel = document.getElementById('selectAllLabel');
  const selectedCountText = document.getElementById('selectedCountText');
  const btnDeleteSelected = document.getElementById('btnDeleteSelected');
  const btnExportSessions = document.getElementById('btnExportSessions');
  const btnImportSessions = document.getElementById('btnImportSessions');
  const importFileInput = document.getElementById('importFileInput');

  // Logs Tab
  const logConsole = document.getElementById('logConsole');
  const btnCopyLogs = document.getElementById('btnCopyLogs');
  const btnClearLogs = document.getElementById('btnClearLogs');
  const miniLogText = document.getElementById('miniLogText');
  const miniLogTime = document.getElementById('miniLogTime');
  const toast = document.getElementById('toast');

  // Local state for search and selection
  let currentSearchQuery = '';
  let selectedAccountEmails = new Set();
  let latestSessionsMap = {};

  // =========================================================================
  // TAB NAVIGATION
  // =========================================================================
  function switchTab(tab) {
    [tabSingleBtn, tabBatchBtn, tabSessionsBtn, tabLogsBtn].forEach((b) => b.classList.remove('active'));
    [tabSingle, tabBatch, tabSessions, tabLogs].forEach((t) => (t.style.display = 'none'));

    if (tab === 'single') {
      tabSingleBtn.classList.add('active');
      tabSingle.style.display = 'block';
    } else if (tab === 'batch') {
      tabBatchBtn.classList.add('active');
      tabBatch.style.display = 'block';
    } else if (tab === 'sessions') {
      tabSessionsBtn.classList.add('active');
      tabSessions.style.display = 'block';
      loadSavedSessions();
    } else if (tab === 'logs') {
      tabLogsBtn.classList.add('active');
      tabLogs.style.display = 'block';
    }
  }

  tabSingleBtn.addEventListener('click', () => switchTab('single'));
  tabBatchBtn.addEventListener('click', () => switchTab('batch'));
  tabSessionsBtn.addEventListener('click', () => switchTab('sessions'));
  tabLogsBtn.addEventListener('click', () => switchTab('logs'));

  // Toggle Password Single
  togglePassBtn.addEventListener('click', () => {
    if (singlePassword.type === 'password') {
      singlePassword.type = 'text';
      togglePassBtn.innerText = '🙈';
    } else {
      singlePassword.type = 'password';
      togglePassBtn.innerText = '👁️';
    }
  });

  // Toggle Password Batch
  toggleBatchPassBtn.addEventListener('click', () => {
    if (batchPassword.type === 'password') {
      batchPassword.type = 'text';
      toggleBatchPassBtn.innerText = '🙈';
    } else {
      batchPassword.type = 'password';
      toggleBatchPassBtn.innerText = '👁️';
    }
  });

  // Toggle Password Master
  if (toggleSessionMasterPassBtn && sessionMasterPassword) {
    toggleSessionMasterPassBtn.addEventListener('click', () => {
      if (sessionMasterPassword.type === 'password') {
        sessionMasterPassword.type = 'text';
        toggleSessionMasterPassBtn.innerText = '🙈';
      } else {
        sessionMasterPassword.type = 'password';
        toggleSessionMasterPassBtn.innerText = '👁️';
      }
    });

    sessionMasterPassword.addEventListener('input', () => {
      const val = sessionMasterPassword.value.trim();
      chrome.storage.local.set({ masterGooglePassword: val });
    });
  }

  // Load Saved Master Password
  chrome.storage.local.get(['masterGooglePassword'], (res) => {
    if (res?.masterGooglePassword && sessionMasterPassword) {
      sessionMasterPassword.value = res.masterGooglePassword;
    }
  });

  // Append Log
  function appendLog(text) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerText = text;
    logConsole.appendChild(entry);
    logConsole.scrollTop = logConsole.scrollHeight;

    miniLogText.innerText = text;
    const now = new Date();
    miniLogTime.innerText = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  }

  // Update Status & Pipeline Badge
  function updateStatus(status, step = 0) {
    statusBadge.className = 'badge';
    step1Node.className = 'step-node pending';
    step2Node.className = 'step-node pending';

    if (status === 'idle') {
      statusBadge.classList.add('badge-idle');
      statusBadge.innerText = 'Standby';
      btnStartSingle.style.display = 'block';
      btnStopLogin.style.display = 'none';
      btnStartBatch.style.display = 'block';
      btnStopBatch.style.display = 'none';
    } else if (status === 'step1_google' || (status === 'running' && step === 1)) {
      statusBadge.classList.add('badge-step1');
      statusBadge.innerText = '1. LOGIN GOOGLE...';
      step1Node.className = 'step-node active';
      btnStartSingle.style.display = 'none';
      btnStopLogin.style.display = 'block';
      btnStartBatch.style.display = 'none';
      btnStopBatch.style.display = 'block';
    } else if (status === 'step2_gemini' || (status === 'running' && step === 2)) {
      statusBadge.classList.add('badge-step2');
      statusBadge.innerText = '2. DAFTAR GEMINI...';
      step1Node.className = 'step-node done';
      step2Node.className = 'step-node active';
      btnStartSingle.style.display = 'none';
      btnStopLogin.style.display = 'block';
      btnStartBatch.style.display = 'none';
      btnStopBatch.style.display = 'block';
    } else if (status === 'success') {
      statusBadge.classList.add('badge-success');
      statusBadge.innerText = 'SUKSES TUNTAS';
      step1Node.className = 'step-node done';
      step2Node.className = 'step-node done';
      btnStartSingle.style.display = 'block';
      btnStopLogin.style.display = 'none';
      btnStartBatch.style.display = 'block';
      btnStopBatch.style.display = 'none';
    } else if (status === 'stopped') {
      statusBadge.classList.add('badge-warning');
      statusBadge.innerText = 'DIHENTIKAN';
      btnStartSingle.style.display = 'block';
      btnStopLogin.style.display = 'none';
      btnStartBatch.style.display = 'block';
      btnStopBatch.style.display = 'none';
    }
  }

  function showToast(msg) {
    toast.innerText = msg;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 2800);
  }

  // Clear Session Action
  btnGlobalClearData.addEventListener('click', () => {
    appendLog('🧹 Menjalankan Clear Session (menghapus cookie & cache browser)...');
    showToast('Membersihkan sesi browser...');
    chrome.runtime.sendMessage({ type: 'CLEAR_BROWSER_DATA' }, (res) => {
      if (res?.success) {
        showToast('Sesi browser dibersihkan total!');
        appendLog('✅ Clear Session berhasil dilakukan.');
      }
    });
  });

  // Start Single Login
  btnStartSingle.addEventListener('click', () => {
    const email = singleEmail.value.trim();
    const password = singlePassword.value.trim();

    if (!email || !password) {
      showToast('Harap masukkan email dan kata sandi.');
      return;
    }

    if (sessionMasterPassword) {
      sessionMasterPassword.value = password;
      chrome.storage.local.set({ masterGooglePassword: password });
    }

    updateStatus('step1_google', 1);
    appendLog(`Memulai Auto-Flow untuk ${email}...`);
    showToast(`Memulai login untuk ${email}`);

    chrome.runtime.sendMessage({
      type: 'START_LOGIN',
      credentials: { email, password }
    });
  });

  btnStopLogin.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_LOGIN' });
    updateStatus('stopped', 0);
  });

  // Start Batch Login
  btnStartBatch.addEventListener('click', () => {
    const lines = batchInput.value.split('\n').map((l) => l.trim()).filter((l) => l.includes('@'));
    const password = batchPassword.value.trim();

    if (lines.length === 0) {
      showToast('Masukkan minimal 1 alamat email di daftar.');
      return;
    }
    if (!password) {
      showToast('Masukkan kata sandi untuk akun-akun batch.');
      return;
    }

    if (sessionMasterPassword) {
      sessionMasterPassword.value = password;
      chrome.storage.local.set({ masterGooglePassword: password });
    }

    const accounts = lines.map((email) => ({ email, password }));

    updateStatus('step1_google', 1);
    appendLog(`Memulai BATCH Auto-Flow untuk ${accounts.length} akun...`);
    showToast(`Memulai ${accounts.length} akun batch...`);

    chrome.runtime.sendMessage({
      type: 'START_BATCH_LOGIN',
      accounts
    });
  });

  btnStopBatch.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_LOGIN' });
    updateStatus('stopped', 0);
  });

  // =========================================================================
  // LOAD & MANAGE SAVED ACCOUNTS (With Search, Select All, Delete Selected)
  // =========================================================================
  let currentActiveEmail = '';

  function renderAccountsList() {
    const allEmails = Object.keys(latestSessionsMap);
    const totalCount = allEmails.length;

    if (accountCountBadge) {
      accountCountBadge.innerText = `Total: ${totalCount} Akun`;
    }

    const filteredEmails = allEmails.filter((em) =>
      em.toLowerCase().includes(currentSearchQuery.toLowerCase().trim())
    );

    if (totalCount === 0) {
      if (selectionToolbar) selectionToolbar.style.display = 'none';
      sessionsList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); font-size: 11px; padding: 16px;">
          Belum ada akun yang tersimpan.
        </div>
      `;
      return;
    }

    if (selectionToolbar) {
      selectionToolbar.style.display = 'flex';
    }

    if (filteredEmails.length === 0) {
      sessionsList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); font-size: 11px; padding: 16px;">
          Tidak ada akun yang cocok dengan kata kunci pencarian.
        </div>
      `;
      return;
    }

    // Update Select All Checkbox state
    const isAllFilteredSelected =
      filteredEmails.length > 0 &&
      filteredEmails.every((em) => selectedAccountEmails.has(em.toLowerCase()));
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = isAllFilteredSelected;
    }
    if (selectAllLabel) {
      selectAllLabel.innerText = `Pilih Semua (${filteredEmails.length})`;
    }
    if (selectedCountText) {
      selectedCountText.innerText = `${selectedAccountEmails.size} dipilih`;
    }

    sessionsList.innerHTML = '';
    filteredEmails.forEach((email) => {
      const item = latestSessionsMap[email];
      const timeStr = item.savedAt ? new Date(item.savedAt).toLocaleDateString('id-ID') : '-';
      const isCurrentlyActive = Boolean(currentActiveEmail && currentActiveEmail.toLowerCase() === email.toLowerCase());

      const geminiStatusBadge = isCurrentlyActive
        ? '<span style="color: #38bdf8; font-weight: bold; margin-left: 4px; background: rgba(6, 182, 212, 0.18); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(6, 182, 212, 0.4); font-size: 9px; display: inline-flex; align-items: center; gap: 4px;"><span style="width: 5px; height: 5px; border-radius: 50%; background: #10b981; display: inline-block;"></span>✨ Gemini Aktif</span>'
        : '<span style="color: #94a3b8; background: rgba(148, 163, 184, 0.1); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(148, 163, 184, 0.2); font-size: 9px; margin-left: 4px; display: inline-flex; align-items: center; gap: 4px;"><span style="width: 5px; height: 5px; border-radius: 50%; background: #64748b; display: inline-block;"></span>Tidak Aktif</span>';

      const isSelected = selectedAccountEmails.has(email.toLowerCase());

      const el = document.createElement('div');
      el.className = `session-item ${isSelected ? 'selected' : ''}`;
      el.innerHTML = `
        <input type="checkbox" class="item-checkbox" data-email="${email}" ${isSelected ? 'checked' : ''} style="cursor: pointer;" />
        <div style="min-width: 0; flex: 1;">
          <div class="session-email">${item.email} ${isCurrentlyActive ? '<span style="display:inline-block; width:6px; height:6px; background:#10b981; border-radius:50%; margin-left:3px;" title="Sedang Aktif"></span>' : ''}</div>
          <div class="session-meta">Cookies: ${item.cookiesCount} | ${timeStr} | ${geminiStatusBadge}</div>
        </div>
        <div class="session-actions" style="display: flex; gap: 4px; flex-wrap: wrap;">
          <button class="btn-icon btn-icon-login btn-login-google" data-email="${email}" title="Buka dan aktifkan sesi akun ini">🔑 Buka</button>
          <button class="btn-icon btn-copy-cookie" data-email="${email}" title="Salin Cookie String">📋</button>
          <button class="btn-icon btn-del-session" data-email="${email}" style="color: var(--danger);" title="Hapus dari Penyimpanan">🗑️</button>
        </div>
      `;
      sessionsList.appendChild(el);
    });

    // Bind individual checkboxes
    document.querySelectorAll('.item-checkbox').forEach((chk) => {
      chk.addEventListener('change', (e) => {
        const target = e.target.getAttribute('data-email').toLowerCase();
        if (e.target.checked) {
          selectedAccountEmails.add(target);
        } else {
          selectedAccountEmails.delete(target);
        }
        renderAccountsList();
      });
    });

    // Helper to retrieve and ensure password is set
    const getActivePasswordForSession = (target) => {
      const currentMaster = (sessionMasterPassword?.value || singlePassword?.value || batchPassword?.value || '').trim();
      let pass = latestSessionsMap[target]?.password || currentMaster;
      if (!latestSessionsMap[target]?.password && currentMaster) {
        latestSessionsMap[target].password = currentMaster;
        chrome.storage.local.set({ savedGoogleSessions: latestSessionsMap, masterGooglePassword: currentMaster });
      }
      return pass;
    };

    // Bind Login Google ➔ Gemini button
    document.querySelectorAll('.btn-login-google').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-email');
        const sess = latestSessionsMap[target];
        if (sess) {
          sess.password = getActivePasswordForSession(target);
          appendLog(`🔑 Memulai login bersih akun ${target} & membuka Gemini...`);
          showToast(`Login Google ➔ Gemini untuk ${target}...`);
          chrome.runtime.sendMessage(
            {
              type: 'LOGIN_GOOGLE_SESSION',
              session: sess
            },
            (res) => {
              if (res?.success) {
                showToast(`Proses login ${target} dimulai!`);
                appendLog(`🚀 Mengarahkan ke Google Login lalu otomatis masuk ke Gemini (${target})...`);
              }
            }
          );
        }
      });
    });

    // Bind copy buttons
    document.querySelectorAll('.btn-copy-cookie').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-email');
        const sess = latestSessionsMap[target];
        if (sess && sess.cookieString) {
          navigator.clipboard.writeText(sess.cookieString).then(() => {
            showToast(`Cookie ${target} disalin!`);
            appendLog(`📋 Cookie untuk ${target} disalin ke clipboard.`);
          });
        }
      });
    });

    // Bind delete buttons
    document.querySelectorAll('.btn-del-session').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-email');
        chrome.storage.local.get(['savedGoogleSessions'], (r) => {
          const current = r.savedGoogleSessions || {};
          delete current[target];
          selectedAccountEmails.delete(target.toLowerCase());
          chrome.storage.local.set({ savedGoogleSessions: current }, () => {
            loadSavedSessions();
            showToast(`Sesi ${target} dihapus.`);
            appendLog(`🗑️ Sesi ${target} telah dihapus dari daftar.`);
          });
        });
      });
    });
  }

  function loadSavedSessions() {
    chrome.storage.local.get(['savedGoogleSessions', 'lastActiveSession', 'activeGoogleLogin'], (res) => {
      latestSessionsMap = res.savedGoogleSessions || {};
      currentActiveEmail = res.lastActiveSession?.email || res.activeGoogleLogin?.email || '';
      renderAccountsList();
    });
  }

  // Search input handler
  if (accountSearchInput) {
    accountSearchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value;
      renderAccountsList();
    });
  }

  // Select All checkbox handler
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      const allFiltered = Object.keys(latestSessionsMap).filter((em) =>
        em.toLowerCase().includes(currentSearchQuery.toLowerCase().trim())
      );
      if (e.target.checked) {
        allFiltered.forEach((em) => selectedAccountEmails.add(em.toLowerCase()));
      } else {
        allFiltered.forEach((em) => selectedAccountEmails.delete(em.toLowerCase()));
      }
      renderAccountsList();
    });
  }

  // Delete Selected handler
  if (btnDeleteSelected) {
    btnDeleteSelected.addEventListener('click', () => {
      if (selectedAccountEmails.size === 0) return;
      const count = selectedAccountEmails.size;
      chrome.storage.local.get(['savedGoogleSessions'], (r) => {
        const current = r.savedGoogleSessions || {};
        selectedAccountEmails.forEach((em) => {
          delete current[em];
          delete current[em.toLowerCase()];
        });
        selectedAccountEmails.clear();
        chrome.storage.local.set({ savedGoogleSessions: current }, () => {
          loadSavedSessions();
          showToast(`${count} akun terpilih berhasil dihapus.`);
          appendLog(`🗑️ ${count} akun terpilih telah dihapus.`);
        });
      });
    });
  }

  // Export / Import
  btnExportSessions.addEventListener('click', () => {
    chrome.storage.local.get(['savedGoogleSessions'], (res) => {
      const sessions = res.savedGoogleSessions || {};
      const count = Object.keys(sessions).length;
      if (count === 0) {
        showToast('Tidak ada akun yang bisa di-export.');
        return;
      }
      const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `google_gemini_all_accounts_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Berhasil export ${count} akun ke JSON!`);
    });
  });

  btnImportSessions.addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (typeof imported !== 'object' || imported === null) {
          throw new Error('Format JSON tidak valid.');
        }

        chrome.storage.local.get(['savedGoogleSessions'], (res) => {
          const current = res.savedGoogleSessions || {};
          const merged = { ...current, ...imported };
          chrome.storage.local.set({ savedGoogleSessions: merged }, () => {
            loadSavedSessions();
            showToast(`Berhasil import ${Object.keys(imported).length} akun!`);
            appendLog(`📥 Berhasil import ${Object.keys(imported).length} akun dari file JSON.`);
          });
        });
      } catch (err) {
        showToast(`Gagal import: ${err.message}`);
      }
    };
    reader.readAsText(file);
    importFileInput.value = '';
  });

  // Copy Logs to Clipboard
  if (btnCopyLogs) {
    btnCopyLogs.addEventListener('click', () => {
      const entries = Array.from(logConsole.querySelectorAll('.log-entry'))
        .map((e) => e.innerText.trim())
        .filter(Boolean)
        .join('\n');

      if (!entries) {
        showToast('Tidak ada log untuk disalin.');
        return;
      }

      navigator.clipboard.writeText(entries).then(() => {
        const originalHtml = btnCopyLogs.innerHTML;
        btnCopyLogs.innerHTML = '✅ Tersalin!';
        btnCopyLogs.style.color = '#10b981';
        btnCopyLogs.style.borderColor = '#10b981';
        showToast('Seluruh log berhasil disalin!');

        setTimeout(() => {
          btnCopyLogs.innerHTML = originalHtml;
          btnCopyLogs.style.color = '';
          btnCopyLogs.style.borderColor = '';
        }, 2000);
      });
    });
  }

  // Clear Logs
  btnClearLogs.addEventListener('click', () => {
    logConsole.innerHTML = '<div class="log-entry">Log dibersihkan.</div>';
    chrome.storage.local.set({ sessionLogs: [] });
    showToast('Log dibersihkan.');
  });

  // Listen for Background Updates
  chrome.runtime.onMessage.addListener((req) => {
    if (req.type === 'BG_LOG_UPDATE') {
      appendLog(req.log);
      chrome.storage.local.get(['loginStatus', 'currentStep'], (r) => {
        updateStatus(r.loginStatus || 'idle', r.currentStep || 0);
      });
    }
    if (req.type === 'LOGIN_FINISH_NOTIFY') {
      if (req.success) {
        updateStatus('success', 2);
        showToast(`🎉 Sukses! Sesi ${req.email} tersimpan.`);
        loadSavedSessions();
      }
    }
  });

  // Initial State Check
  chrome.storage.local.get(['sessionLogs', 'isAutoLoginActive', 'loginStatus', 'currentStep'], (res) => {
    if (res.sessionLogs && res.sessionLogs.length > 0) {
      logConsole.innerHTML = '';
      res.sessionLogs.forEach((l) => {
        const el = document.createElement('div');
        el.className = 'log-entry';
        el.innerText = l;
        logConsole.appendChild(el);
      });
      logConsole.scrollTop = logConsole.scrollHeight;
      miniLogText.innerText = res.sessionLogs[res.sessionLogs.length - 1];
    }

    updateStatus(res.loginStatus || 'idle', res.currentStep || 0);
  });
});
