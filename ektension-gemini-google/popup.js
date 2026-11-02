// Google Session Auto-Login - Popup Logic

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const statusBadge = document.getElementById('statusBadge');
  const miniLogText = document.getElementById('miniLogText');
  const miniLogTime = document.getElementById('miniLogTime');
  const logConsole = document.getElementById('logConsole');
  const toastEl = document.getElementById('toast');

  // Tabs
  const tabSingleBtn = document.getElementById('tabSingleBtn');
  const tabBatchBtn = document.getElementById('tabBatchBtn');
  const tabSessionsBtn = document.getElementById('tabSessionsBtn');
  const tabLogsBtn = document.getElementById('tabLogsBtn');

  const tabSingle = document.getElementById('tabSingle');
  const tabBatch = document.getElementById('tabBatch');
  const tabSessions = document.getElementById('tabSessions');
  const tabLogs = document.getElementById('tabLogs');

  // Single Login
  const singleEmail = document.getElementById('singleEmail');
  const singlePassword = document.getElementById('singlePassword');
  const togglePassBtn = document.getElementById('togglePassBtn');
  const btnStartSingle = document.getElementById('btnStartSingle');
  const btnStopLogin = document.getElementById('btnStopLogin');

  // Batch
  const batchInput = document.getElementById('batchInput');
  const btnStartBatch = document.getElementById('btnStartBatch');

  // Sessions
  const sessionsList = document.getElementById('sessionsList');
  const btnExportSessions = document.getElementById('btnExportSessions');
  const btnClearLogs = document.getElementById('btnClearLogs');

  let activeTabName = 'single';

  // Helper: Toast
  function showToast(msg) {
    toastEl.innerText = msg;
    toastEl.style.display = 'block';
    setTimeout(() => {
      toastEl.style.display = 'none';
    }, 3000);
  }

  // Switch Tabs
  function switchTab(tab) {
    activeTabName = tab;
    [tabSingleBtn, tabBatchBtn, tabSessionsBtn, tabLogsBtn].forEach(b => b.classList.remove('active'));
    [tabSingle, tabBatch, tabSessions, tabLogs].forEach(t => t.style.display = 'none');

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

  // Toggle Password
  togglePassBtn.addEventListener('click', () => {
    if (singlePassword.type === 'password') {
      singlePassword.type = 'text';
      togglePassBtn.innerText = '🙈';
    } else {
      singlePassword.type = 'password';
      togglePassBtn.innerText = '👁️';
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
    miniLogTime.innerText = new Date().toLocaleTimeString('id-ID');
  }

  // Update Status Badge
  function updateStatus(status) {
    statusBadge.className = 'badge';
    if (status === 'running') {
      statusBadge.classList.add('badge-running');
      statusBadge.innerText = 'PROSES LOGIN...';
      btnStartSingle.style.display = 'none';
      btnStopLogin.style.display = 'flex';
    } else if (status === 'success') {
      statusBadge.classList.add('badge-success');
      statusBadge.innerText = 'SUKSES';
      btnStartSingle.style.display = 'flex';
      btnStopLogin.style.display = 'none';
    } else if (status === '2fa_required') {
      statusBadge.classList.add('badge-warning');
      statusBadge.innerText = '2FA / PROMPT HP';
      btnStartSingle.style.display = 'none';
      btnStopLogin.style.display = 'flex';
    } else if (status === 'captcha_detected' || status === 'security_blocked') {
      statusBadge.classList.add('badge-warning');
      statusBadge.innerText = 'RINTANGAN DETEKSI';
      btnStartSingle.style.display = 'flex';
      btnStopLogin.style.display = 'none';
    } else {
      statusBadge.classList.add('badge-idle');
      statusBadge.innerText = 'STANDBY';
      btnStartSingle.style.display = 'flex';
      btnStopLogin.style.display = 'none';
    }
  }

  // Load Saved Sessions
  function loadSavedSessions() {
    chrome.storage.local.get(['savedGoogleSessions'], (res) => {
      const sessions = res.savedGoogleSessions || {};
      const emails = Object.keys(sessions);

      if (emails.length === 0) {
        sessionsList.innerHTML = `
          <div style="text-align: center; color: var(--text-muted); font-size: 11px; padding: 12px;">
            Belum ada sesi Google yang tersimpan.
          </div>
        `;
        return;
      }

      sessionsList.innerHTML = '';
      emails.forEach((email) => {
        const item = sessions[email];
        const timeStr = item.savedAt ? new Date(item.savedAt).toLocaleDateString('id-ID') : '-';
        
        const el = document.createElement('div');
        el.className = 'session-item';
        el.innerHTML = `
          <div>
            <div class="session-email">${item.email}</div>
            <div class="session-meta">Cookies: ${item.cookiesCount} | ${timeStr}</div>
          </div>
          <div class="session-actions">
            <button class="btn-icon btn-copy-cookie" data-email="${email}">📋 Salin Cookie</button>
            <button class="btn-icon btn-del-session" data-email="${email}" style="color: var(--danger);">🗑️</button>
          </div>
        `;
        sessionsList.appendChild(el);
      });

      // Bind copy buttons
      document.querySelectorAll('.btn-copy-cookie').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const target = e.target.getAttribute('data-email');
          const sess = sessions[target];
          if (sess?.cookieString) {
            navigator.clipboard.writeText(sess.cookieString);
            showToast(`Cookie untuk ${target} disalin!`);
          }
        });
      });

      // Bind delete buttons
      document.querySelectorAll('.btn-del-session').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const target = e.target.getAttribute('data-email');
          delete sessions[target];
          chrome.storage.local.set({ savedGoogleSessions: sessions }, () => {
            loadSavedSessions();
            showToast(`Sesi ${target} dihapus.`);
          });
        });
      });
    });
  }

  // Start Single Login
  btnStartSingle.addEventListener('click', () => {
    const email = singleEmail.value.trim();
    const password = singlePassword.value.trim();

    if (!email || !password) {
      showToast('Harap isi email dan password terlebih dahulu!');
      return;
    }

    appendLog(`Memulai otomatisasi login untuk ${email}...`);
    updateStatus('running');

    chrome.runtime.sendMessage({
      type: 'START_LOGIN',
      credentials: { email, password }
    }, (res) => {
      if (res?.success) {
        showToast('Proses login Google sedang berjalan!');
      }
    });
  });

  // Stop Login
  btnStopLogin.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_LOGIN' }, () => {
      updateStatus('idle');
      appendLog('Proses login dihentikan.');
      showToast('Login dihentikan.');
    });
  });

  // Start Batch Login
  btnStartBatch.addEventListener('click', () => {
    const raw = batchInput.value.trim();
    if (!raw) {
      showToast('Masukkan daftar akun terlebih dahulu!');
      return;
    }

    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const accounts = [];
    for (const line of lines) {
      if (line.includes(':')) {
        const [em, pw] = line.split(':');
        accounts.push({ email: em.trim(), password: pw.trim() });
      } else if (line.includes(',')) {
        const [em, pw] = line.split(',');
        accounts.push({ email: em.trim(), password: pw.trim() });
      }
    }

    if (accounts.length === 0) {
      showToast('Format tidak valid. Gunakan format email:password');
      return;
    }

    showToast(`Memulai login akun pertama dari ${accounts.length} akun...`);
    const first = accounts[0];
    singleEmail.value = first.email;
    singlePassword.value = first.password;
    switchTab('single');
    btnStartSingle.click();
  });

  // Export Sessions
  btnExportSessions.addEventListener('click', () => {
    chrome.storage.local.get(['savedGoogleSessions'], (res) => {
      const sessions = res.savedGoogleSessions || {};
      const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `google_sessions_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('File JSON sesi berhasil di-download!');
    });
  });

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
    }
    if (req.type === 'LOGIN_FINISH_NOTIFY') {
      if (req.success) {
        updateStatus('success');
        showToast(`🎉 Login berhasil untuk ${req.email}! Sesi tersimpan.`);
        loadSavedSessions();
      }
    }
  });

  // Initial State Check
  chrome.storage.local.get(['sessionLogs', 'isAutoLoginActive', 'loginStatus'], (res) => {
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

    if (res.isAutoLoginActive) {
      updateStatus('running');
    } else {
      updateStatus(res.loginStatus || 'idle');
    }
  });

});
