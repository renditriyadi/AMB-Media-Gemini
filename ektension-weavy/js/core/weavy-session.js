// weavy-session.js - Sesi & Token Weavy untuk Extension Bridge
// Dipakai oleh background service worker (bridge web app) untuk:
// 1. Memulihkan sesi Weavy saat API membalas 403/401 (reload tab + baca ulang session Firebase)
// 2. Menulis sesi login akun ke tab app.weavy.ai (mode login) atau sekadar membaca kredit (mode refresh)

export const FIREBASE_API_KEY = 'AIzaSyC-qLy3TFyXMogJPfMkZJ9H_q46hEu1sxI';
export const WEAVY_API_BASE = 'https://api.weavy.ai';
export const WEAVY_APP_URL = 'https://app.weavy.ai/';
export const WEAVY_APP_VERSION = '4.1.1316';

/**
 * Fungsi in-page: membaca sesi Firebase dari tab Weavy.
 * WAJIB self-contained (tidak boleh mengacu ke scope modul) karena diserialisasi
 * oleh chrome.scripting.executeScript.
 */
export async function readWeavySessionInPage() {
  try {
    const getDbUser = () =>
      new Promise((resolve) => {
        try {
          const req = indexedDB.open('firebaseLocalStorageDb');
          req.onsuccess = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
              db.close();
              return resolve(null);
            }
            const store = db.transaction('firebaseLocalStorage', 'readonly').objectStore('firebaseLocalStorage');
            const allReq = store.getAll();
            allReq.onsuccess = (ev) => {
              const list = ev.target.result || [];
              db.close();
              for (const item of list) {
                const val = item && item.value ? item.value : item;
                if (val?.stsTokenManager?.refreshToken) return resolve(val);
              }
              resolve(null);
            };
            allReq.onerror = () => {
              db.close();
              resolve(null);
            };
          };
          req.onerror = () => resolve(null);
        } catch (err) {
          resolve(null);
        }
      });

    let authUser = await getDbUser();

    if (!authUser) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('firebase:authUser') || k.includes('authUser'))) {
          try {
            const parsed = JSON.parse(localStorage.getItem(k));
            if (parsed?.stsTokenManager?.refreshToken) {
              authUser = parsed;
              break;
            }
            if (parsed?.refreshToken) {
              authUser = {
                stsTokenManager: { refreshToken: parsed.refreshToken, accessToken: parsed.accessToken || parsed.idToken },
                email: parsed.email,
                uid: parsed.uid || parsed.id,
                displayName: parsed.displayName || parsed.name,
              };
              break;
            }
          } catch (e) {}
        }
      }
    }

    if (!authUser) {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && (k.startsWith('firebase:authUser') || k.includes('authUser'))) {
          try {
            const parsed = JSON.parse(sessionStorage.getItem(k));
            if (parsed?.stsTokenManager?.refreshToken) {
              authUser = parsed;
              break;
            }
          } catch (e) {}
        }
      }
    }

    if (!authUser?.stsTokenManager?.refreshToken) {
      return { success: false, error: 'Sesi login Weavy tidak ditemukan di tab ini.' };
    }

    return {
      success: true,
      refreshToken: authUser.stsTokenManager.refreshToken,
      accessToken: authUser.stsTokenManager.accessToken || '',
      expiresAt: authUser.stsTokenManager.expirationTime || 0,
      email: authUser.email || '',
      uid: authUser.uid || '',
      name: authUser.displayName || '',
      cookie: document.cookie || '',
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Fungsi in-page: menulis sesi Firebase ke tab Weavy (mode login).
 * WAJIB self-contained.
 */
export async function writeWeavySessionInPage(payload) {
  const { uid, email, displayName, refreshToken, accessToken, expiresAt, weavyApiKey } = payload || {};
  try {
    try { sessionStorage.clear(); } catch (error) {}

    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('firebase:') || key.startsWith('weavy') || key.startsWith('persist:') || key.startsWith('user_') || key.startsWith('auth_') || key.startsWith('workspace') || key.startsWith('tanstack') || key.startsWith('apollo'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {}

    const apiKey = weavyApiKey || 'AIzaSyC-qLy3TFyXMogJPfMkZJ9H_q46hEu1sxI';
    const localKey = `firebase:authUser:${apiKey}:[DEFAULT]`;

    const authPayload = {
      uid,
      email,
      displayName: displayName || (email ? email.split('@')[0] : 'Weavy User'),
      emailVerified: true,
      isAnonymous: false,
      providerData: [{
        providerId: 'google.com',
        uid,
        displayName: displayName || (email ? email.split('@')[0] : 'Weavy User'),
        email,
      }],
      stsTokenManager: {
        refreshToken,
        accessToken,
        expirationTime: expiresAt,
        apiKey,
      },
      createdAt: String(Date.now()),
      lastLoginAt: String(Date.now()),
    };

    localStorage.setItem(localKey, JSON.stringify(authPayload));

    await new Promise((resolve) => {
      try {
        const request = indexedDB.open('firebaseLocalStorageDb');
        request.onsuccess = (event) => {
          const db = event.target.result;
          if (db.objectStoreNames.contains('firebaseLocalStorage')) {
            const tx = db.transaction('firebaseLocalStorage', 'readwrite');
            const store = tx.objectStore('firebaseLocalStorage');
            try { store.clear(); } catch (error) {}
            store.put({ fbase_key: localKey, value: authPayload });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
          } else {
            resolve(false);
          }
        };
        request.onerror = () => resolve(false);
      } catch (error) {
        resolve(false);
      }
    });

    window.location.replace('https://app.weavy.ai/');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Fungsi in-page: membaca kredit akun dari dalam tab Weavy (lolos WAF).
 * WAJIB self-contained.
 */
export async function readWeavyCreditsInPage(idToken) {
  try {
    const extractCredits = (obj, depth = 0) => {
      if (!obj || depth > 4) return null;
      if (Array.isArray(obj)) {
        for (const item of obj) {
          const found = extractCredits(item, depth + 1);
          if (found !== null) return found;
        }
        return null;
      }
      if (typeof obj !== 'object') return null;
      const keys = ['credits', 'balance', 'quota', 'credit', 'coins', 'points', 'amount', 'remaining'];
      for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
          const num = Number(obj[k]);
          if (!isNaN(num)) return num;
        }
      }
      const nested = ['data', 'user', 'account', 'result', 'users', 'activeWorkspace', 'subscription'];
      for (const nk of nested) {
        if (obj[nk]) {
          const found = extractCredits(obj[nk], depth + 1);
          if (found !== null) return found;
        }
      }
      return null;
    };

    const headers = {
      Accept: 'application/json, text/plain, */*',
      Authorization: `Bearer ${idToken}`,
      'x-weavy-auth-provider': 'firebase',
      'x-app-version': '4.1.1316',
    };

    const endpoints = [
      'https://api.weavy.ai/api/v1/users',
      'https://api.weavy.ai/api/v1/workspaces',
      'https://api.weavy.ai/api/v1/users/me',
    ];

    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, { headers, credentials: 'include' });
        if (!res.ok) continue;
        const data = await res.json();
        const credits = extractCredits(data);
        if (credits !== null) return { success: true, credits };
      } catch (_) {}
    }

    return { success: false, error: 'Kredit tidak dapat dibaca dari tab Weavy.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/** Mencari tab app.weavy.ai yang terbuka (atau membukanya bila diizinkan). */
export async function findWeavyTab(chromeApi, { createIfMissing = false } = {}) {
  const tabs = await chromeApi.tabs.query({ url: ['*://app.weavy.ai/*', '*://*.weavy.ai/*'] });
  let target = (tabs || []).find((t) => t.active) || (tabs || [])[0] || null;

  if (!target && createIfMissing) {
    const created = await chromeApi.tabs.create({ url: WEAVY_APP_URL, active: false });
    await new Promise((r) => setTimeout(r, 2500));
    target = created;
  }

  return target;
}

/** Reload tab Weavy lalu tunggu sampai selesai load + Firebase Auth siap. */
export async function reloadWeavyTabAndWait(chromeApi, tabId) {
  if (typeof tabId !== 'number') return null;

  try {
    await chromeApi.tabs.reload(tabId);
  } catch (_) {
    // Tab mungkin sudah tertutup, abaikan
  }

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const currentTab = await chromeApi.tabs.get(tabId);
      if (currentTab && currentTab.status === 'complete') {
        await new Promise((r) => setTimeout(r, 1800));
        return tabId;
      }
    } catch (e) {
      break;
    }
  }

  return tabId;
}

/** Tukar refresh token Firebase menjadi id token baru. */
export async function exchangeWeavyRefreshToken(refreshToken) {
  const cleanToken = (refreshToken || '').trim();
  if (!cleanToken) throw new Error('Refresh token Weavy kosong.');

  const resp = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: cleanToken,
    }).toString(),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.id_token) {
    throw new Error(data?.error?.message || 'Gagal menukar refresh token Weavy.');
  }

  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token || cleanToken,
    expiresAt: Date.now() + (Number(data.expires_in || 3600)) * 1000,
    expiresIn: Number(data.expires_in || 3600),
    userId: data.user_id || '',
  };
}

/**
 * Pemulihan sesi Weavy: reload tab app.weavy.ai, baca ulang session Firebase,
 * lalu tukar refresh token -> id token baru.
 */
export async function refreshWeavySession({ chromeApi = typeof chrome !== 'undefined' ? chrome : undefined, reload = true } = {}) {
  if (!chromeApi || !chromeApi.tabs || !chromeApi.scripting) {
    return { success: false, error: 'chrome.tabs/scripting tidak tersedia.' };
  }

  try {
    const tab = await findWeavyTab(chromeApi, { createIfMissing: true });
    if (!tab || typeof tab.id !== 'number') {
      return { success: false, error: 'Tab app.weavy.ai tidak bisa dibuka.' };
    }

    if (reload) {
      await reloadWeavyTabAndWait(chromeApi, tab.id);
    }

    const results = await chromeApi.scripting.executeScript({
      target: { tabId: tab.id },
      func: readWeavySessionInPage,
    });

    const session = results?.[0]?.result;
    if (!session?.success || !session.refreshToken) {
      return { success: false, error: session?.error || 'Sesi Weavy belum terbaca di tab browser.' };
    }

    let idToken = session.accessToken || '';
    let refreshToken = session.refreshToken;
    let expiresAt = session.expiresAt || Date.now() + 3600 * 1000;
    let userId = session.uid || '';

    try {
      const exchanged = await exchangeWeavyRefreshToken(refreshToken);
      idToken = exchanged.idToken || idToken;
      refreshToken = exchanged.refreshToken || refreshToken;
      expiresAt = exchanged.expiresAt;
      userId = exchanged.userId || userId;
    } catch (e) {
      console.warn('[Weavy Session] Tukar token gagal, pakai accessToken dari tab:', e?.message || e);
    }

    return {
      success: true,
      tabId: tab.id,
      account: {
        id: userId || `weavy_${Date.now()}`,
        userId,
        email: session.email || '',
        name: session.name || (session.email || 'Weavy User').split('@')[0],
        refreshToken,
        idToken,
        cookie: session.cookie || '',
        credits: 0,
        provider: 'weavy',
        lastVerified: new Date().toISOString(),
        expiresAt,
      },
    };
  } catch (err) {
    return { success: false, error: err?.message || 'Gagal memulihkan sesi Weavy.' };
  }
}

/**
 * Sinkronkan sesi akun ke tab Weavy.
 * - mode 'refresh': tukar token & baca kredit dari dalam tab (sesi tab tidak diubah)
 * - mode 'login'  : tulis sesi ke tab lalu tab me-reload diri sendiri
 */
export async function syncAccountSessionToWeavyTab({
  account = {},
  mode = 'refresh',
  chromeApi = typeof chrome !== 'undefined' ? chrome : undefined,
} = {}) {
  if (!chromeApi || !chromeApi.tabs || !chromeApi.scripting) {
    return { success: false, error: 'chrome.tabs/scripting tidak tersedia.' };
  }

  if (!account.refreshToken && !account.idToken) {
    return { success: false, error: 'Akun Weavy tidak memiliki kredensial token.' };
  }

  try {
    const tab = await findWeavyTab(chromeApi, { createIfMissing: true });
    if (!tab || typeof tab.id !== 'number') {
      return { success: false, error: 'Tab app.weavy.ai tidak bisa dibuka.' };
    }
    const tabId = tab.id;

    let idToken = account.idToken || '';
    let refreshToken = account.refreshToken || '';
    let expiresAt = account.expiresAt || Date.now() + 3600 * 1000;

    try {
      if (refreshToken) {
        const exchanged = await exchangeWeavyRefreshToken(refreshToken);
        idToken = exchanged.idToken || idToken;
        refreshToken = exchanged.refreshToken || refreshToken;
        expiresAt = exchanged.expiresAt;
      }
    } catch (e) {
      console.warn('[Weavy Sync] Tukar token gagal:', e?.message || e);
    }

    if (mode === 'login') {
      await chromeApi.scripting.executeScript({
        target: { tabId },
        args: [{
          uid: account.userId || account.id || '',
          email: account.email || '',
          displayName: account.name || account.displayName || '',
          refreshToken,
          accessToken: idToken,
          expiresAt,
          weavyApiKey: FIREBASE_API_KEY,
        }],
        func: writeWeavySessionInPage,
      });

      await new Promise((r) => setTimeout(r, 3000));
    }

    let credits = null;
    if (idToken) {
      const creditResults = await chromeApi.scripting.executeScript({
        target: { tabId },
        args: [idToken],
        func: readWeavyCreditsInPage,
      });
      const creditRes = creditResults?.[0]?.result;
      if (creditRes?.success && typeof creditRes.credits === 'number') {
        credits = creditRes.credits;
      }
    }

    return {
      success: true,
      credits: credits ?? account.credits ?? 0,
      totalCredits: account.totalCredits ?? 150,
      email: account.email || '',
      name: account.name || account.displayName || '',
      idToken,
      refreshToken,
      expiresIn: Math.max(0, Math.round((expiresAt - Date.now()) / 1000)),
      tabId,
      openedTab: true,
    };
  } catch (err) {
    return { success: false, error: err?.message || 'Gagal sinkronisasi sesi ke tab Weavy.' };
  }
}
