// Weavy AI Extension Background Service Worker

import { refreshWeavySession, syncAccountSessionToWeavyTab } from './js/core/weavy-session.js';
import { executeWebAppWeavyChat } from './js/chat/webapp-chat.js';

async function setupDynamicRules() {
  if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateDynamicRules) {
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1001, 1002],
        addRules: [
          {
            id: 1001,
            priority: 1,
            action: {
              type: 'modifyHeaders',
              requestHeaders: [
                { header: 'Origin', operation: 'set', value: 'https://app.weavy.ai' },
                { header: 'Referer', operation: 'set', value: 'https://app.weavy.ai/' },
              ],
            },
            condition: {
              urlFilter: 'https://api.weavy.ai/*',
              resourceTypes: ['xmlhttprequest', 'other', 'main_frame', 'sub_frame'],
            },
          },
          {
            id: 1002,
            priority: 1,
            action: {
              type: 'modifyHeaders',
              requestHeaders: [
                { header: 'Origin', operation: 'set', value: 'https://www.dola.com' },
                { header: 'Referer', operation: 'set', value: 'https://www.dola.com/' },
              ],
            },
            condition: {
              urlFilter: 'https://*.dola.com/*',
              resourceTypes: ['xmlhttprequest', 'other', 'main_frame', 'sub_frame'],
            },
          },
        ],
      });
      console.log('[Weavy AI Extension] DeclarativeNetRequest rules initialized successfully.');
    } catch (e) {
      console.warn('[Weavy AI Extension] Error setting declarativeNetRequest rules:', e);
    }
  }
}

// Initialize on script load, install, and startup
setupDynamicRules();

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Weavy AI Extension] Installed.');
  await setupDynamicRules();
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn('[Weavy AI Extension] setPanelBehavior error:', err);
    });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await setupDynamicRules();
});

// Fallback listener for extension icon click to ensure sidepanel opens
chrome.action.onClicked.addListener(async (tab) => {
  if (chrome.sidePanel && chrome.sidePanel.open && tab.windowId) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (e) {
      console.warn('[Weavy AI Extension] sidePanel.open fallback:', e);
    }
  }
});

// Helper: Ensure content script is injected on Dola tab
async function ensureDolaBridgeInjected(tabId) {
  try {
    const ping = await chrome.tabs.sendMessage(tabId, { action: 'DOLA_CHECK_BRIDGE' });
    if (ping && ping.ready) return true;
  } catch (_) {}

  // Inject content-bridge.js manually if not yet loaded
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-bridge.js'],
    });
    return true;
  } catch (err) {
    console.warn('[Background] Failed to inject content-bridge.js into tab:', tabId, err);
    return false;
  }
}

// =============================================================================
// MESSAGE ROUTER (Weavy, Dola Background Stream, Tab Management)
// =============================================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return false;

  // 1. Open Media In Tab
  if (msg.action === 'openInTab' && msg.url) {
    chrome.tabs.create({ url: msg.url, active: true }).catch((err) => {
      console.warn('[Background] openInTab error:', err);
    });
    return false;
  }

  // 2. FIND_DOLA_TAB: Temukan tab Dola AI yang sedang aktif / terbuka di background
  if (msg.action === 'FIND_DOLA_TAB') {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ url: ['*://*.dola.com/*', '*://dola.com/*'] });
        if (tabs && tabs.length > 0) {
          // Prioritaskan tab /chat jika ada
          const chatTab = tabs.find((t) => t.url && t.url.includes('/chat')) || tabs[0];
          sendResponse({
            found: true,
            tab: {
              id: chatTab.id,
              url: chatTab.url,
              title: chatTab.title,
              active: chatTab.active,
            },
            count: tabs.length,
          });
        } else {
          sendResponse({ found: false, count: 0 });
        }
      } catch (err) {
        sendResponse({ found: false, error: err.message });
      }
    })();
    return true;
  }

  // 3. OPEN_DOLA_TAB: Buka atau fokuskan tab Dola AI (default: di background tanpa merebut fokus)
  if (msg.action === 'OPEN_DOLA_TAB') {
    const { active = false, url = 'https://www.dola.com/chat' } = msg;
    (async () => {
      try {
        // Cek tab existing
        const tabs = await chrome.tabs.query({ url: ['*://*.dola.com/*', '*://dola.com/*'] });
        if (tabs && tabs.length > 0) {
          const chatTab = tabs.find((t) => t.url && t.url.includes('/chat')) || tabs[0];
          await ensureDolaBridgeInjected(chatTab.id);
          sendResponse({
            success: true,
            isNew: false,
            tab: { id: chatTab.id, url: chatTab.url, title: chatTab.title },
          });
          return;
        }

        // Buka tab baru di background (active: false agar user tidak terganggu)
        const newTab = await chrome.tabs.create({ url, active });
        
        // Tunggu hingga tab selesai loading
        const waitForTabComplete = (tabId, timeoutMs = 15000) => {
          return new Promise((resolve) => {
            const start = Date.now();
            const listener = (updatedId, changeInfo) => {
              if (updatedId === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve(true);
              }
            };
            chrome.tabs.onUpdated.addListener(listener);
            setTimeout(() => {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve(false);
            }, timeoutMs);
          });
        };

        await waitForTabComplete(newTab.id);
        await ensureDolaBridgeInjected(newTab.id);

        sendResponse({
          success: true,
          isNew: true,
          tab: { id: newTab.id, url: newTab.url, title: newTab.title },
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 4. GET_DOLA_COOKIES: Dapatkan session / status guest Dola AI
  if (msg.action === 'GET_DOLA_COOKIES') {
    (async () => {
      try {
        if (!chrome.cookies) {
          sendResponse({ success: false, error: 'chrome.cookies permission unavailable' });
          return;
        }
        const cookies = await chrome.cookies.getAll({ domain: 'dola.com' });
        const cookieMap = {};
        for (const c of cookies) {
          cookieMap[c.name] = c.value;
        }

        const isLoggedIn = Boolean(cookieMap['sessionid'] || cookieMap['sid_tt'] || cookieMap['sessionid_ss']);
        const hasGuestInfo = Boolean(cookieMap['ttwid'] || cookieMap['tea_uuid'] || cookieMap['s_v_web_id']);

        sendResponse({
          success: true,
          isLoggedIn,
          isGuest: !isLoggedIn && hasGuestInfo,
          cookieCount: cookies.length,
          cookies: cookieMap,
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 5. EXECUTE_DOLA_TAB_STREAM_FETCH: Jalankan Silent Background Stream via Tab Bridge
  if (msg.action === 'EXECUTE_DOLA_TAB_STREAM_FETCH') {
    const { streamId, url, method = 'POST', headers = {}, body = null } = msg;
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ url: ['*://*.dola.com/*', '*://dola.com/*'] });
        let targetTab = tabs && tabs.length > 0
          ? (tabs.find((t) => t.url && t.url.includes('/chat')) || tabs[0])
          : null;

        if (!targetTab) {
          // Buka di background
          targetTab = await chrome.tabs.create({ url: 'https://www.dola.com/chat', active: false });
          await new Promise((r) => setTimeout(r, 4000));
        }

        await ensureDolaBridgeInjected(targetTab.id);

        chrome.tabs.sendMessage(
          targetTab.id,
          {
            action: 'EXECUTE_PAGE_STREAM_FETCH',
            streamId,
            url,
            method,
            headers,
            body,
          },
          (res) => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              sendResponse({ success: true, streamId, tabId: targetTab.id, ...res });
            }
          }
        );
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 6. Tukang Eksekusi Weavy
  if (msg.action === 'EXECUTE_WEAVY_TASK' && msg.payload) {
    (async () => {
      const { url, method = 'GET', headers = {}, body = null } = msg.payload;

      const runInTab = async (tabId, reqHeaders) => {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          args: [{ url, method, headers: reqHeaders, body }],
          func: async ({ url: reqUrl, method: reqMethod, headers: reqHeaders, body: reqBody }) => {
            try {
              const resp = await fetch(reqUrl, {
                method: reqMethod,
                headers: reqHeaders,
                body: reqBody || undefined,
                credentials: 'include',
              });
              const status = resp.status;
              const ok = resp.ok;
              const text = await resp.text();
              let json = null;
              try {
                json = JSON.parse(text);
              } catch (_) {}
              return { success: true, ok, status, text, json };
            } catch (e) {
              return { success: false, error: e.message };
            }
          },
        });
        return results && results[0] && results[0].result ? results[0].result : null;
      };

      // Prioritas 1: Jika ada tab app.weavy.ai yang terbuka, eksekusi di dalam tab tersebut (100% lolos WAF & bawa session asli)
      let tabResult = null;
      try {
        const tabs = await chrome.tabs.query({ url: ['*://app.weavy.ai/*', '*://*.weavy.ai/*'] });
        if (tabs && tabs.length > 0) {
          const targetTab = tabs.find((t) => t.active) || tabs[0];
          tabResult = await runInTab(targetTab.id, headers);

          // Auto-recovery: 403/401 berarti token sesi kedaluwarsa.
          // Pulihkan sesi lewat tab Weavy (reload + baca ulang session Firebase), lalu ulangi request.
          if (tabResult && (tabResult.status === 401 || tabResult.status === 403)) {
            const refreshed = await refreshWeavySession({ chromeApi: chrome });
            if (refreshed && refreshed.success && refreshed.account && refreshed.account.idToken) {
              const retryHeaders = { ...headers, Authorization: `Bearer ${refreshed.account.idToken}` };
              const retryResult = await runInTab(targetTab.id, retryHeaders);
              if (retryResult) {
                sendResponse({
                  ...retryResult,
                  tokenRefreshed: true,
                  refreshedAccount: {
                    idToken: refreshed.account.idToken,
                    refreshToken: refreshed.account.refreshToken,
                    email: refreshed.account.email,
                    userId: refreshed.account.userId,
                    name: refreshed.account.name,
                    expiresAt: refreshed.account.expiresAt,
                  },
                });
                return;
              }
            }
          }
        }
      } catch (errTab) {
        console.warn('[Background Worker] In-tab execution failed, falling back to background fetch:', errTab);
      }

      if (tabResult) {
        sendResponse(tabResult);
        return;
      }

      // Prioritas 2: Eksekusi langsung dari Background Service Worker ekstensi
      try {
        const fetchHeaders = {
          ...headers,
          Origin: 'https://app.weavy.ai',
          Referer: 'https://app.weavy.ai/',
        };
        const resp = await fetch(url, {
          method,
          headers: fetchHeaders,
          body: body || undefined,
          credentials: 'include',
        });
        const status = resp.status;
        const ok = resp.ok;
        const text = await resp.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch (_) {}
        sendResponse({ success: true, ok, status, text, json });
      } catch (errDirect) {
        sendResponse({ success: false, error: errDirect.message });
      }
    })();

    return true; // Menandakan asynchronous sendResponse
  }

  if (msg.action === 'EXECUTE_WEAVY_CHAT_FROM_APP' && msg.payload) {
    const senderUrl = sender.url || sender.tab?.url || '';
    let appOriginAllowed = false;
    try {
      const appUrl = new URL(senderUrl);
      appOriginAllowed =
        (appUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(appUrl.hostname)) ||
        (appUrl.protocol === 'https:' && appUrl.hostname.endsWith('.run.app'));
    } catch (_) {}

    if (!appOriginAllowed) {
      sendResponse({ success: false, error: 'Origin aplikasi tidak diizinkan untuk menjalankan Chat Weavy.' });
      return false;
    }

    executeWebAppWeavyChat(msg.payload)
      .then(sendResponse)
      .catch((error) => {
        console.error('[Background] App Chat execution failed:', error);
        sendResponse({ success: false, error: error?.message || 'Ekstensi gagal menjalankan Chat Weavy.' });
      });
    return true;
  }

  // 6b. REFRESH_WEAVY_TOKEN: Pulihkan sesi Weavy (reload tab + baca ulang session Firebase)
  if (msg.action === 'REFRESH_WEAVY_TOKEN') {
    (async () => {
      try {
        const result = await refreshWeavySession({ chromeApi: chrome });
        sendResponse(result);
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 6c. SYNC_ACCOUNT_TO_TAB: Sinkronkan sesi akun ke tab app.weavy.ai
  if (msg.action === 'SYNC_ACCOUNT_TO_TAB') {
    const { account = {}, mode = 'refresh' } = msg.payload || {};
    (async () => {
      try {
        const result = await syncAccountSessionToWeavyTab({ account, mode, chromeApi: chrome });
        sendResponse(result);
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 6d. UPLOAD_WEAVY_ASSET: Upload gambar (data URL / URL remote) ke Weavy Asset Store dari dalam tab Weavy
  if (msg.action === 'UPLOAD_WEAVY_ASSET') {
    const { dataUrl, sourceUrl, fileName = 'upload.png', idToken } = msg.payload || {};
    (async () => {
      try {
        if ((!dataUrl && !sourceUrl) || !idToken) {
          sendResponse({ success: false, error: 'dataUrl/sourceUrl dan idToken wajib diisi.' });
          return;
        }

        const tabs = await chrome.tabs.query({ url: ['*://app.weavy.ai/*', '*://*.weavy.ai/*'] });
        if (!tabs || tabs.length === 0) {
          sendResponse({ success: false, error: 'Tab app.weavy.ai tidak ditemukan.' });
          return;
        }

        const targetTab = tabs.find((t) => t.active) || tabs[0];
        const results = await chrome.scripting.executeScript({
          target: { tabId: targetTab.id },
          args: [{ dataUrl, sourceUrl, fileName, idToken }],
          func: async ({ dataUrl: srcDataUrl, sourceUrl: srcUrl, fileName: srcName, idToken: srcToken }) => {
            try {
              const fetchTarget = srcDataUrl || srcUrl;
              const blobRes = await fetch(fetchTarget, srcDataUrl ? {} : { credentials: 'omit' });
              if (!blobRes.ok) {
                return { success: false, status: blobRes.status, error: `Gagal mengambil gambar (HTTP ${blobRes.status}).` };
              }
              const blob = await blobRes.blob();
              const formData = new FormData();
              formData.append('file', blob, srcName);

              const up = await fetch('https://api.weavy.ai/api/v1/assets/upload', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${srcToken}`,
                  'X-Weavy-Auth-Provider': 'firebase',
                  'x-app-version': '4.1.1316',
                },
                body: formData,
                credentials: 'include',
              });

              if (!up.ok) {
                const errText = await up.text().catch(() => '');
                return { success: false, status: up.status, error: errText.slice(0, 200) };
              }

              const json = await up.json();
              return { success: true, data: json };
            } catch (e) {
              return { success: false, error: e.message };
            }
          },
        });

        const result = results?.[0]?.result;
        sendResponse(result || { success: false, error: 'Upload asset Weavy gagal.' });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 7. AUTO_IMPORT_ACTIVE_ACCOUNT: Ambil akun & sesi langsung dari tab browser aktif (Weavy / Flow / Dola / Gemini)
  if (msg.action === 'AUTO_IMPORT_ACTIVE_ACCOUNT') {
    const { provider = 'weavy' } = msg;
    (async () => {
      try {
        if (!chrome.tabs || !chrome.scripting) {
          sendResponse({ success: false, error: 'Permission chrome.tabs/scripting belum aktif.' });
          return;
        }

        const allTabs = await chrome.tabs.query({});
        
        if (provider === 'weavy') {
          const targetTab = allTabs.find((t) => t.active && t.url && /weavy\.ai/i.test(t.url))
            || allTabs.find((t) => t.url && /weavy\.ai/i.test(t.url));

          if (!targetTab) {
            await chrome.tabs.create({ url: 'https://app.weavy.ai', active: true });
            sendResponse({ success: false, error: 'Tab Weavy tidak ditemukan. Membuka https://app.weavy.ai di browser, silakan login lalu coba lagi.' });
            return;
          }

          // Ambil cookies Weavy
          let weavyCookies = [];
          try {
            weavyCookies = await chrome.cookies.getAll({ domain: 'weavy.ai' });
          } catch (_) {}
          const cookieStr = weavyCookies.map((c) => `${c.name}=${c.value}`).join('; ');

          // Eksekusi in-page script di tab Weavy
          const extractAccountFromTab = async () => {
              try {
                // 1. Cek IndexedDB (firebaseLocalStorageDb) - default Firebase v9/v10
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
                            if (val?.stsTokenManager?.refreshToken) {
                              return resolve(val);
                            }
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

                // 2. Fallback: Cek localStorage
                if (!authUser) {
                  for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.startsWith('firebase:authUser') || k.includes('authUser') || k.includes('user'))) {
                      try {
                        const parsed = JSON.parse(localStorage.getItem(k));
                        if (parsed?.stsTokenManager?.refreshToken) {
                          authUser = parsed;
                          break;
                        } else if (parsed?.refreshToken) {
                          authUser = {
                            stsTokenManager: {
                              refreshToken: parsed.refreshToken,
                              accessToken: parsed.accessToken || parsed.idToken,
                            },
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

                // 3. Fallback: Cek sessionStorage
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

                if (!authUser || !authUser.stsTokenManager || !authUser.stsTokenManager.refreshToken) {
                  return {
                    success: false,
                    error: 'Sesi login tidak ditemukan di tab Weavy. Silakan pastikan tab app.weavy.ai sudah terbuka dan status akun sudah Login.',
                  };
                }

                const refreshToken = authUser.stsTokenManager.refreshToken;
                const accessToken = authUser.stsTokenManager.accessToken;
                const email = authUser.email || '';
                const uid = authUser.uid || '';
                const name = authUser.displayName || email.split('@')[0];
                let credits = 0;

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

                try {
                  if (accessToken) {
                    const endpoints = [
                      'https://api.weavy.ai/api/v1/users',
                      'https://api.weavy.ai/api/v1/workspaces',
                      'https://api.weavy.ai/api/v1/users/me',
                    ];
                    for (const ep of endpoints) {
                      try {
                        const apiRes = await fetch(ep, {
                          headers: {
                            Accept: 'application/json, text/plain, */*',
                            Authorization: `Bearer ${accessToken}`,
                            'x-weavy-auth-provider': 'firebase',
                            'x-app-version': '4.1.1316',
                          },
                          credentials: 'include',
                        });
                        if (apiRes.ok) {
                          const uData = await apiRes.json();
                          const parsedCredits = extractCredits(uData);
                          if (parsedCredits !== null) {
                            credits = parsedCredits;
                            break;
                          }
                        }
                      } catch (_) {}
                    }
                  }
                } catch (_) {}

                return {
                  success: true,
                  account: {
                    id: uid || `weavy_${Date.now()}`,
                    userId: uid,
                    email,
                    name,
                    refreshToken,
                    idToken: accessToken,
                    credits,
                    provider: 'weavy',
                    lastVerified: new Date().toISOString(),
                    expiresAt: Date.now() + 3600 * 1000,
                  },
                };
              } catch (err) {
                return { success: false, error: err.message };
              }
          };
          const runAccountExtraction = () => chrome.scripting.executeScript({
            target: { tabId: targetTab.id },
            func: extractAccountFromTab,
          });
          let results;
          let res = null;
          let initialExtractError = null;
          try {
            results = await runAccountExtraction();
            res = results && results[0] ? results[0].result : null;
          } catch (extractError) {
            initialExtractError = extractError;
          }

          if (!res?.success || !res.account) {
            try {
              await chrome.tabs.reload(targetTab.id);
              await new Promise((resolve) => setTimeout(resolve, 750));

              let tabReady = false;
              for (let attempt = 0; attempt < 50; attempt++) {
                const currentTab = await chrome.tabs.get(targetTab.id);
                if (currentTab.status === 'complete') {
                  tabReady = true;
                  break;
                }
                await new Promise((resolve) => setTimeout(resolve, 500));
              }
              if (!tabReady) {
                throw new Error('Tab Weavy belum selesai dimuat setelah reload.');
              }

              // Tunggu Firebase Auth dan aplikasi Weavy memulihkan sesi setelah reload.
              await new Promise((resolve) => setTimeout(resolve, 2000));
              results = await runAccountExtraction();
              res = results && results[0] ? results[0].result : null;
              if (!res?.success || !res.account) {
                res = {
                  ...(res || {}),
                  success: false,
                  error: `${res?.error || 'Sesi Weavy belum terbaca setelah reload otomatis.'} Silakan pastikan tab sudah login lalu coba Auto-Import kembali.`,
                };
              }
            } catch (reloadError) {
              const initialError =
                res?.error ||
                initialExtractError?.message ||
                'Sesi tidak terbaca sebelum reload.';
              throw new Error(`${initialError} Gagal memuat ulang tab Weavy: ${reloadError.message || reloadError}`);
            }
          }

          if (res) {
            if (res.success && res.account) {
              res.account.cookie = cookieStr;
            }
            sendResponse(res);
            return;
          }

          sendResponse({ success: false, error: 'Gagal mengekstrak sesi login dari tab Weavy.' });
          return;
        }

        sendResponse({ success: false, error: `Provider ${provider} belum didukung untuk direct bridge.` });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  return false;
});
