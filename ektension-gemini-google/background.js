// Google Session & Gemini Auto-Register - Background Service Worker
// Ultra-Deep Session Cleaning, Single Tab Reuse, Auto-Skip Registered Accounts, No Background Ghosts

let activeTabId = null;
let currentCredentials = null;
let isLoginInProgress = false;
let isGoogleOnlyLogin = false;

// Batch queue tracking
let batchQueue = [];
let currentBatchIndex = 0;
let isBatchRunning = false;

// Buka otomatis Side Panel saat klik icon ekstensi
try {
  if (chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === 'function') {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.log('[Google-Bg] sidePanel setPanelBehavior error:', err);
    });
  }
} catch (e) {}

// Reset status otomatis saat service worker aktif / reload agar tidak ada proses tersangkut (GHOST LOGIN)
chrome.storage.local.set({
  isAutoLoginActive: false,
  activeGoogleLogin: null,
  loginStatus: 'idle',
  currentStep: 0
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    isAutoLoginActive: false,
    activeGoogleLogin: null,
    loginStatus: 'idle',
    currentStep: 0
  });
});

// Helper: Logging with safe storage and messaging
function log(msg, data = null) {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const entry = `[${timeStr}] ${msg}`;
  console.log(`[Google-Bg] ${entry}`, data || '');

  try {
    chrome.storage.local.get(['sessionLogs'], (res) => {
      if (chrome.runtime.lastError) return;
      let logs = res?.sessionLogs || [];
      logs.push(entry);
      if (logs.length > 200) logs = logs.slice(logs.length - 200);
      chrome.storage.local.set({ sessionLogs: logs });
    });
  } catch (e) {}

  try {
    chrome.runtime.sendMessage({
      type: 'BG_LOG_UPDATE',
      log: entry,
      data
    }).catch(() => {});
  } catch (e) {}
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// =========================================================================
// HELPER: SINGLE TAB REUSE (TETAP MENGGUNAKAN 1 TAB YANG SAMA)
// =========================================================================
async function navigateActiveTab(url) {
  try {
    if (activeTabId) {
      const tabExists = await new Promise((res) => {
        chrome.tabs.get(activeTabId, (tab) => {
          if (chrome.runtime.lastError || !tab) res(false);
          else res(true);
        });
      });

      if (tabExists) {
        await new Promise((res) => {
          chrome.tabs.update(activeTabId, { url, active: true }, () => {
            if (chrome.runtime.lastError) {}
            res();
          });
        });
        return activeTabId;
      }
    }

    const tabs = await new Promise((res) => chrome.tabs.query({ active: true, currentWindow: true }, res));
    if (tabs && tabs[0]) {
      activeTabId = tabs[0].id;
      await new Promise((res) => {
        chrome.tabs.update(activeTabId, { url, active: true }, () => {
          if (chrome.runtime.lastError) {}
          res();
        });
      });
      return activeTabId;
    }

    const newTab = await new Promise((res) => chrome.tabs.create({ url, active: true }, res));
    if (newTab) activeTabId = newTab.id;
    return activeTabId;
  } catch (err) {
    console.log('[Google-Bg] Safe navigation handler caught:', err);
    return null;
  }
}

// Cek apakah akun sudah tersimpan / terdaftar di sesi
async function isAccountAlreadyRegistered(email) {
  if (!email) return false;
  return new Promise((resolve) => {
    chrome.storage.local.get(['savedGoogleSessions'], (res) => {
      const sessions = res?.savedGoogleSessions || {};
      const sess = sessions[email.toLowerCase().trim()];
      if (sess && sess.hasAuth && sess.cookiesCount > 0) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

// =========================================================================
// 1. ULTRA-DEEP CLEAR SESSION & DATA (PEMBERSIHAN TOTAL BEBAS BENTROK)
// =========================================================================
async function clearGoogleAndGeminiData() {
  log('🧹 [Clear Session] Menghapus 100% total cookie, storage, indexedDB & cache Google + Gemini...');

  try {
    // 1. Hapus browsing data komprehensif dari epoch 0
    await new Promise((resolve) => {
      chrome.browsingData.remove(
        { since: 0 },
        {
          appcache: true,
          cache: true,
          cacheStorage: true,
          cookies: true,
          fileSystems: true,
          formData: true,
          indexedDB: true,
          localStorage: true,
          serverBoundCertificates: true,
          serviceWorkers: true,
          webSQL: true
        },
        resolve
      );
    });

    // 2. Loop semua cookie stores (termasuk private/incognito jika ada)
    const stores = await new Promise((res) => {
      if (chrome.cookies.getAllCookieStores) {
        chrome.cookies.getAllCookieStores((s) => res(s || [{ id: '0' }]));
      } else {
        res([{ id: '0' }]);
      }
    });

    const googleKeywords = ['google', 'gstatic', 'youtube', 'gemini', 'bard', 'googleapis', '1e100', 'gmail', 'gserviceprovider', 'googleusercontent'];
    let removedCookieCount = 0;

    for (const store of stores) {
      const allCookies = await new Promise((res) => chrome.cookies.getAll({ storeId: store.id }, res));
      if (allCookies && allCookies.length > 0) {
        for (const c of allCookies) {
          const d = (c.domain || '').toLowerCase();
          if (googleKeywords.some((k) => d.includes(k))) {
            const cleanDomain = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
            const path = c.path || '/';

            const urlList = [
              `https://${cleanDomain}${path}`,
              `https://.${cleanDomain}${path}`,
              `https://www.${cleanDomain}${path}`,
              `https://accounts.google.com${path}`,
              `https://gemini.google.com${path}`,
              `https://myaccount.google.com${path}`,
              `http://${cleanDomain}${path}`
            ];

            for (const u of urlList) {
              try {
                const removeParams = { url: u, name: c.name, storeId: store.id };
                if (c.partitionKey) {
                  removeParams.partitionKey = c.partitionKey;
                }
                await new Promise((r) => chrome.cookies.remove(removeParams, r));
                removedCookieCount++;
              } catch (e) {}
            }
          }
        }
      }
    }

    // 3. Bersihkan DOM localStorage & sessionStorage di tab aktif jika ada
    if (activeTabId) {
      try {
        if (chrome.scripting && chrome.scripting.executeScript) {
          await chrome.scripting.executeScript({
            target: { tabId: activeTabId },
            func: () => {
              try { localStorage.clear(); } catch (e) {}
              try { sessionStorage.clear(); } catch (e) {}
            }
          }).catch(() => {});
        }
      } catch (e) {}
    }

    log(`✨ [Clear Session] Selesai 100%! (${removedCookieCount} cookie & storage dibersihkan total).`);
    return true;
  } catch (err) {
    log(`⚠️ Peringatan saat clear data: ${err.message}`);
    return false;
  }
}

// =========================================================================
// 2. EKSTRAK SEMUA COOKIES GOOGLE & GEMINI LENGKAP BESERTA KREDENSIAL
// =========================================================================
async function extractAllSessionCookies(email, step = 1) {
  try {
    log(`🍪 Mengekstrak seluruh cookie sesi (${step === 2 ? 'Google + Gemini' : 'Google'}) untuk: ${email}...`);

    const allBrowserCookies = await new Promise((resolve) => {
      chrome.cookies.getAll({}, (c) => resolve(c || []));
    });

    const targetKeywords = ['google.com', 'gemini.google.com', 'accounts.google.com', 'myaccount.google.com'];
    const cookiesList = [];
    const uniqueMap = new Map();

    for (const c of allBrowserCookies) {
      const d = (c.domain || '').toLowerCase();
      if (targetKeywords.some((k) => d.includes(k))) {
        const key = `${c.domain}__${c.path}__${c.name}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, c.value);
          cookiesList.push({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path || '/',
            secure: c.secure !== undefined ? c.secure : true,
            httpOnly: c.httpOnly !== undefined ? c.httpOnly : false,
            sameSite: c.sameSite,
            expirationDate: c.expirationDate
          });
        }
      }
    }

    const cookiePairs = [];
    for (const c of cookiesList) {
      cookiePairs.push(`${c.name}=${c.value}`);
    }

    const cookieString = cookiePairs.join('; ');
    const hasAuthCookie = cookiesList.some((c) => ['SID', 'SAPISID', '__Secure-1PSID', '__Secure-3PSID', 'SSID'].includes(c.name));

    const savedPassword = currentCredentials?.password || '';

    const sessionData = {
      email,
      password: savedPassword,
      cookieString,
      cookiesList,
      cookiesCount: cookiesList.length,
      hasAuth: hasAuthCookie,
      geminiRegistered: step === 2,
      savedAt: new Date().toISOString(),
      timestamp: Date.now()
    };

    if (hasAuthCookie) {
      log(`💾 Berhasil menyimpan ${cookiesList.length} cookie sesi (AUTH VALID) untuk ${email}!`);
      
      await new Promise((resolve) => {
        chrome.storage.local.get(['savedGoogleSessions'], (res) => {
          const sessions = res?.savedGoogleSessions || {};
          if (!sessionData.password && sessions[email.toLowerCase()]?.password) {
            sessionData.password = sessions[email.toLowerCase()].password;
          }
          sessions[email.toLowerCase()] = sessionData;
          chrome.storage.local.set(
            {
              savedGoogleSessions: sessions,
              lastActiveSession: sessionData
            },
            resolve
          );
        });
      });
    }

    return sessionData;
  } catch (err) {
    log(`❌ Gagal ekstrak cookie: ${err.message}`);
    return null;
  }
}

// =========================================================================
// 3. LOGIN BERSIH GOOGLE LALU MASUK GEMINI (TAB YANG SAMA)
// =========================================================================
async function reLoginGoogleClean(sessionData) {
  if (!sessionData || !sessionData.email) return false;
  isGoogleOnlyLogin = false;
  isBatchRunning = false;

  log(`🔑 [Login Akun] Memulai login Google akun ${sessionData.email} lalu langsung membuka Gemini...`);

  await clearGoogleAndGeminiData();
  await delay(600);

  let password = sessionData.password;
  if (!password) {
    const st = await new Promise((r) => chrome.storage.local.get(['masterGooglePassword'], r));
    password = st?.masterGooglePassword || '';
  }

  currentCredentials = {
    email: sessionData.email,
    password: password
  };

  await new Promise((resolve) => {
    chrome.storage.local.set(
      {
        activeGoogleLogin: currentCredentials,
        isAutoLoginActive: true,
        currentStep: 1,
        loginStatus: 'step1_google'
      },
      resolve
    );
  });

  const targetUrl = 'https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin';
  await navigateActiveTab(targetUrl);
  return true;
}

// =========================================================================
// 4. INJEKSI COOKIE GEMINI (UNTUK LANGSUNG MASUK KE GEMINI PADA TAB YANG SAMA)
// =========================================================================
async function injectAndOpenGemini(sessionData) {
  if (!sessionData) return false;
  log(`✨ [Buka Gemini] Menginjeksi cookie sesi & membuka Gemini untuk: ${sessionData.email}...`);

  try {
    await clearGoogleAndGeminiData();
    await delay(500);

    let password = sessionData.password;
    if (!password) {
      const st = await new Promise((r) => chrome.storage.local.get(['masterGooglePassword'], r));
      password = st?.masterGooglePassword || '';
    }

    currentCredentials = {
      email: sessionData.email,
      password: password
    };
    isGoogleOnlyLogin = false;

    await chrome.storage.local.set({
      activeGoogleLogin: currentCredentials,
      isAutoLoginActive: true,
      currentStep: 2,
      loginStatus: 'step2_gemini'
    });

    let successCount = 0;
    const futureExp = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;

    if (sessionData.cookiesList && sessionData.cookiesList.length > 0) {
      for (const c of sessionData.cookiesList) {
        try {
          const isHostCookie = c.name.startsWith('__Host-');
          const isSecureCookie = c.name.startsWith('__Secure-');
          const cleanDomain = c.domain?.startsWith('.') ? c.domain.slice(1) : (c.domain || 'google.com');
          const url = `https://${cleanDomain}${c.path || '/'}`;

          const cookieObj = {
            url,
            name: c.name,
            value: c.value,
            path: c.path || '/',
            secure: isHostCookie || isSecureCookie || Boolean(c.secure),
            httpOnly: Boolean(c.httpOnly),
            expirationDate: (c.expirationDate && c.expirationDate > Date.now() / 1000) ? c.expirationDate : futureExp
          };

          if (!isHostCookie && c.domain) {
            cookieObj.domain = c.domain;
          }

          if (c.sameSite === 'no_restriction' || c.sameSite === 'lax' || c.sameSite === 'strict') {
            cookieObj.sameSite = c.sameSite;
          }

          await new Promise((res) => chrome.cookies.set(cookieObj, res));
          successCount++;
        } catch (err) {}
      }
    }

    log(`✅ Berhasil menginjeksi ${successCount} cookie sesi ke browser!`);
    log(`🚀 Membuka Gemini AI (https://gemini.google.com/app)...`);

    const geminiUrl = 'https://gemini.google.com/app';
    await navigateActiveTab(geminiUrl);
    return true;
  } catch (err) {
    log(`❌ Gagal injeksi Gemini: ${err.message}`);
    return false;
  }
}

// =========================================================================
// 5. OTOMASI SATUAN & BATCH MULTI-AKUN DENGAN AUTO-SKIP
// =========================================================================
async function startSingleAccountAutomation(credentials) {
  currentCredentials = credentials;
  isLoginInProgress = true;
  isGoogleOnlyLogin = false;

  const alreadyRegistered = await isAccountAlreadyRegistered(credentials.email);
  if (alreadyRegistered) {
    log(`ℹ️ Akun ${credentials.email} sudah ada di Sesi Simpanan. Memperbarui sesi...`);
  }

  log(`🚀 [Langkah 1/2] Memulai login Google untuk: ${credentials.email}`);

  await new Promise((resolve) => {
    chrome.storage.local.set(
      {
        activeGoogleLogin: credentials,
        isAutoLoginActive: true,
        currentStep: 1,
        loginStatus: 'step1_google'
      },
      resolve
    );
  });

  const targetUrl = 'https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin';
  await navigateActiveTab(targetUrl);
}

// Jalankan Batch Akun dengan Auto-Skip
async function startBatchProcess(accounts) {
  if (!accounts || accounts.length === 0) return;
  batchQueue = accounts;
  currentBatchIndex = 0;
  isBatchRunning = true;
  isGoogleOnlyLogin = false;

  log(`⚡ [BATCH MULAI] Memproses total ${batchQueue.length} akun...`);
  await processCurrentBatchAccount();
}

async function processCurrentBatchAccount() {
  if (!isBatchRunning) return;

  if (currentBatchIndex >= batchQueue.length) {
    log(`🏆 [BATCH TUNTAS] Semua ${batchQueue.length} akun selesai diproses dan disimpan!`);
    isBatchRunning = false;
    isLoginInProgress = false;
    await chrome.storage.local.set({ loginStatus: 'success', isAutoLoginActive: false, currentStep: 0, activeGoogleLogin: null });
    return;
  }

  const account = batchQueue[currentBatchIndex];
  log(`🔍 [Batch ${currentBatchIndex + 1}/${batchQueue.length}] Memeriksa akun: ${account.email}...`);

  const alreadySaved = await isAccountAlreadyRegistered(account.email);
  if (alreadySaved) {
    log(`⏭️ [SKIP] Akun ${account.email} sudah terdaftar & sesi tersimpan! Melewati ke akun berikutnya...`);
    currentBatchIndex++;
    await delay(600);
    await processCurrentBatchAccount();
    return;
  }

  log(`🚀 [Batch ${currentBatchIndex + 1}/${batchQueue.length}] Memulai proses: ${account.email}`);
  await clearGoogleAndGeminiData();
  await delay(1000);

  await startSingleAccountAutomation(account);
}

// Lanjut ke Step 2 (Gemini Registration) pada Tab yang Sama
async function proceedToStep2Gemini() {
  log(`🤖 [Langkah 2/2] Membuka Gemini (https://gemini.google.com/app) untuk registrasi & aktivasi...`);

  await chrome.storage.local.set({
    currentStep: 2,
    loginStatus: 'step2_gemini'
  });

  const geminiUrl = 'https://gemini.google.com/app';
  await navigateActiveTab(geminiUrl);
}

// =========================================================================
// 6. MESSAGE DISPATCHER & EVENT HANDLERS
// =========================================================================
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (!req || !req.type) return;

  // Single Start
  if (req.type === 'START_LOGIN') {
    isBatchRunning = false;
    batchQueue = [];
    currentBatchIndex = 0;
    startSingleAccountAutomation(req.credentials);
    sendResponse({ success: true, message: 'Otomatisasi login dimulai.' });
    return true;
  }

  // Batch Start
  if (req.type === 'START_BATCH_LOGIN') {
    startBatchProcess(req.accounts);
    sendResponse({ success: true, message: `Batch ${req.accounts.length} akun dimulai.` });
    return true;
  }

  // Stop Automation
  if (req.type === 'STOP_LOGIN') {
    isLoginInProgress = false;
    isBatchRunning = false;
    isGoogleOnlyLogin = false;
    batchQueue = [];
    currentCredentials = null;
    chrome.storage.local.set({ isAutoLoginActive: false, activeGoogleLogin: null, loginStatus: 'stopped', currentStep: 0 });
    log('🛑 Proses login/registrasi dihentikan oleh pengguna.');
    sendResponse({ success: true });
    return true;
  }

  // Clear Browsing Data Request (Clear Session)
  if (req.type === 'CLEAR_BROWSER_DATA') {
    isLoginInProgress = false;
    isBatchRunning = false;
    isGoogleOnlyLogin = false;
    currentCredentials = null;
    batchQueue = [];
    currentBatchIndex = 0;

    chrome.storage.local.set({
      isAutoLoginActive: false,
      activeGoogleLogin: null,
      loginStatus: 'idle',
      currentStep: 0
    });

    clearGoogleAndGeminiData().then(async (ok) => {
      await navigateActiveTab('https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin');
      sendResponse({ success: ok });
    });
    return true;
  }

  // Login Ulang Google
  if (req.type === 'LOGIN_GOOGLE_SESSION') {
    reLoginGoogleClean(req.session).then((ok) => {
      sendResponse({ success: ok });
    });
    return true;
  }

  // Buka Gemini dengan Cookie
  if (req.type === 'LOGIN_GEMINI_SESSION') {
    injectAndOpenGemini(req.session).then((ok) => {
      sendResponse({ success: ok });
    });
    return true;
  }

  if (req.type === 'LOGIN_SAVED_SESSION') {
    injectAndOpenGemini(req.session).then((ok) => {
      sendResponse({ success: ok });
    });
    return true;
  }

  // Retry on Google Error ("Something went wrong")
  if (req.type === 'RETRY_GOOGLE_LOGIN') {
    log('🔄 [Auto-Retry] Mengulang kembali form pendaftaran Google...');
    chrome.storage.local.set({
      currentStep: 1,
      loginStatus: 'retrying',
      isAutoLoginActive: true
    });

    const targetUrl = 'https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin';
    navigateActiveTab(targetUrl).then(() => {
      setTimeout(() => {
        if (activeTabId && currentCredentials) {
          chrome.tabs.sendMessage(activeTabId, {
            type: 'START_GOOGLE_LOGIN_STEP',
            credentials: currentCredentials
          }).catch(() => {});
        }
      }, 1200);
    });
    sendResponse({ received: true });
    return true;
  }

  if (req.type === 'GOOGLE_LOGIN_LOG') {
    log(req.message, req.data);
    sendResponse({ received: true });
    return true;
  }

  // STEP 1 SELESAI: Pindah ke STEP 2 (Gemini) atau Berhenti jika Mode Google Only
  if (req.type === 'GOOGLE_LOGIN_SUCCESS') {
    if (currentCredentials?.email) {
      extractAllSessionCookies(currentCredentials.email, 1).then((session) => {
        if (session && session.hasAuth) {
          log(`✅ Login Google Berhasil untuk: ${currentCredentials.email}!`);
          
          if (isGoogleOnlyLogin) {
            log(`🎉 Akun Google ${currentCredentials.email} aktif dan siap digunakan.`);
            chrome.storage.local.set({ loginStatus: 'success', isAutoLoginActive: false, currentStep: 1, activeGoogleLogin: null });
          } else {
            setTimeout(() => {
              proceedToStep2Gemini();
            }, 1000);
          }
        }
      });
    }
    sendResponse({ received: true });
    return true;
  }

  // STEP 2 SELESAI: Registrasi Gemini Tuntas 100%
  if (req.type === 'GEMINI_ONBOARDING_SUCCESS') {
    log(`🎉 SEMUA LANGKAH TUNTAS! Akun ${currentCredentials?.email} sudah terdaftar di Google & Gemini.`);

    if (currentCredentials?.email) {
      extractAllSessionCookies(currentCredentials.email, 2).then(async (session) => {
        try {
          chrome.runtime.sendMessage({
            type: 'LOGIN_FINISH_NOTIFY',
            success: true,
            email: currentCredentials.email,
            session
          }).catch(() => {});
        } catch (e) {}

        if (isBatchRunning) {
          currentBatchIndex++;
          await delay(1500);
          await processCurrentBatchAccount();
        } else {
          isLoginInProgress = false;
          chrome.storage.local.set({ loginStatus: 'success', isAutoLoginActive: false, currentStep: 2, activeGoogleLogin: null });
        }
      });
    }

    sendResponse({ received: true });
    return true;
  }

  return true;
});

// Listener saat tab selesai loading - HANYA jika status aktif
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab?.url?.includes('accounts.google.com')) {
    chrome.storage.local.get(['isAutoLoginActive', 'activeGoogleLogin', 'currentStep'], (res) => {
      if (res?.isAutoLoginActive && res?.activeGoogleLogin?.email && res?.currentStep === 1) {
        chrome.tabs.sendMessage(tabId, {
          type: 'START_GOOGLE_LOGIN_STEP',
          credentials: res.activeGoogleLogin
        }).catch(() => {});
      }
    });
  }
});
