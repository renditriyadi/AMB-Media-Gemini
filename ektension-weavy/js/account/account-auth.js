import { callWeavyApi } from '../core/api.js';

export async function fetchUserCreditsFromWeavy({
  idToken,
  accountObj,
  syncCookiesToBrowser,
  WEAVY_API_BASE,
  extractCreditsFromObj,
}) {
  if (!idToken) return 0;

  if (accountObj && accountObj.cookie) {
    await syncCookiesToBrowser(accountObj.cookie);
  }

  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
    try {
      const tabs = await chrome.tabs.query({ url: '*://*.weavy.ai/*' });
      if (tabs && tabs.length > 0) {
        const tabId = (tabs.find((t) => t.active) || tabs[0]).id;
        const tabResult = await chrome.scripting.executeScript({
          target: { tabId },
          args: [idToken],
          func: async (token) => {
            try {
              const res = await fetch('https://api.weavy.ai/api/v1/users', {
                headers: {
                  Accept: 'application/json, text/plain, */*',
                  Authorization: `Bearer ${token}`,
                  'x-weavy-auth-provider': 'firebase',
                  'x-app-version': '4.1.1316',
                },
                credentials: 'include',
              });
              if (res.ok) {
                const data = await res.json();
                return data?.credits ?? data?.activeWorkspace?.credits ?? data?.subscription?.credits ?? null;
              }
              return null;
            } catch (e) {
              return null;
            }
          },
        });
        const tabCredits = tabResult?.[0]?.result;
        if (typeof tabCredits === 'number') {
          return tabCredits;
        }
      }
    } catch (e) {
      // fall through to direct API fetch below
    }
  }

  const endpointsToTry = [
    `${WEAVY_API_BASE}/api/v1/users`,
    `${WEAVY_API_BASE}/api/v1/workspaces`,
    `${WEAVY_API_BASE}/api/v1/users/me`
  ];

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/plain, */*',
    Authorization: `Bearer ${idToken}`,
    'x-weavy-auth-provider': 'firebase',
    'x-app-version': '4.1.1316',
  };
  if (accountObj && accountObj.cookie) {
    headers['x-weavy-cookie'] = accountObj.cookie;
  }

  for (const endpoint of endpointsToTry) {
    try {
      const resp = await callWeavyApi(endpoint, { headers, credentials: 'include' });
      if (resp && resp.ok) {
        const uData = await resp.json();
        const parsed = extractCreditsFromObj(uData);
        if (parsed !== null) return parsed;
      } else if (resp) {
        console.warn(`[Weavy Credit Fetch Status ${resp.status}] on ${endpoint}`);
      }
    } catch (e) {
      console.warn(`[Weavy Credit Fetch Error on ${endpoint}]:`, e);
    }
  }

  // Preserve previous credits if fetch failed rather than wiping to 0
  return typeof accountObj?.credits === 'number' ? accountObj.credits : null;
}

export async function syncCookiesToBrowser(input, chromeApi = typeof chrome !== 'undefined' ? chrome : undefined) {
  let cookieStr = '';
  let targetDomainType = 'auto';

  if (typeof input === 'string') {
    cookieStr = input;
  } else if (input && typeof input === 'object') {
    let raw = input;
    // Unwrap nested objects if wrapped multiple times
    while (raw && typeof raw === 'object') {
      if (raw.chromeApi) chromeApi = raw.chromeApi;
      if (raw.domainType) targetDomainType = raw.domainType;
      raw = raw.cookieStr || raw.cookie;
    }
    if (typeof raw === 'string') {
      cookieStr = raw;
    }
  }

  if (!cookieStr || typeof chromeApi === 'undefined' || !chromeApi.cookies) return;

  const isGoogle = targetDomainType === 'google' ||
    (targetDomainType === 'auto' && (
      /SID=|SAPISID=|__Secure-1PSID|__Secure-3PSID|APISID=|HSID=|SSID=/i.test(cookieStr) && !/weavy/i.test(cookieStr)
    ));

  const isDola = targetDomainType === 'dola' ||
    (targetDomainType === 'auto' && (
      /dola\.com|sessionid=|sid_tt=|uid_tt=|odin_tt=|flow_cur_user_sec_id=/i.test(cookieStr) && !/weavy/i.test(cookieStr) && !/SAPISID=/i.test(cookieStr)
    ));

  if (isGoogle) {
    // 1. PARSE AND NORMALIZE COOKIE MAP FIRST
    const cookieMap = new Map();
    const rawPairs = cookieStr.split(';');
    for (const pair of rawPairs) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx <= 0) continue;
      const name = pair.substring(0, eqIdx).trim();
      const value = pair.substring(eqIdx + 1).trim();
      if (name && value) {
        cookieMap.set(name, value);
      }
    }

    // DERIVE MISSING SIBLING COOKIES SO GOOGLE SECURITY NEVER FLAGS MISMATCH
    // In Google Auth: SID value === __Secure-1PSID value!
    if (cookieMap.has('__Secure-1PSID') && !cookieMap.has('SID')) {
      cookieMap.set('SID', cookieMap.get('__Secure-1PSID'));
    }
    if (cookieMap.has('__Secure-1PAPISID') && !cookieMap.has('APISID')) {
      cookieMap.set('APISID', cookieMap.get('__Secure-1PAPISID'));
    }
    if (cookieMap.has('__Secure-1PSIDTS') && !cookieMap.has('__Secure-3PSIDTS')) {
      cookieMap.set('__Secure-3PSIDTS', cookieMap.get('__Secure-1PSIDTS'));
    }
    if (cookieMap.has('__Secure-1PSIDRTS') && !cookieMap.has('__Secure-3PSIDRTS')) {
      cookieMap.set('__Secure-3PSIDRTS', cookieMap.get('__Secure-1PSIDRTS'));
    }
    if (cookieMap.has('__Secure-1PSIDCC') && !cookieMap.has('__Secure-3PSIDCC')) {
      cookieMap.set('__Secure-3PSIDCC', cookieMap.get('__Secure-1PSIDCC'));
    }

    // 2. CLEAN ONLY FLOW / LABS SPECIFIC SESSION TOKENS
    // Only clean next-auth and OSID tokens to ensure a fresh session handover.
    const sessionUrls = [
      'https://labs.google',
      'https://flow.google.com',
      'https://flow.google'
    ];

    for (const url of sessionUrls) {
      try {
        const existingCookies = await chromeApi.cookies.getAll({ url }).catch(() => []);
        for (const c of existingCookies) {
          if (c.name.includes('next-auth') || c.name.includes('OSID')) {
            await chromeApi.cookies.remove({ url, name: c.name }).catch(() => {});
          }
        }
      } catch (cleanErr) {}
    }

    // 3. SET THE COOKIES ACCORDING TO RFC / CHROME SPEC
    // Note: Chrome Extension chrome.cookies.set REJECTS leading dots in domain! (Must use 'google.com' not '.google.com')
    const promises = [];
    for (const [name, value] of cookieMap.entries()) {
      // Group A: NextAuth session tokens (specifically for flow.google.com / labs.google)
      if (name.includes('next-auth')) {
        const nextAuthUrls = ['https://flow.google.com', 'https://flow.google', 'https://labs.google'];
        for (const targetUrl of nextAuthUrls) {
          promises.push(
            chromeApi.cookies.set({
              url: targetUrl,
              path: '/',
              name,
              value,
              secure: true,
              httpOnly: true,
              sameSite: 'lax',
            }).catch((err) => console.warn(`[NextAuth cookie err ${name} on ${targetUrl}]:`, err?.message || err))
          );
        }
        continue;
      }

      // Group B: __Host- cookies (RFC: MUST NOT specify domain, must have secure: true, path: '/')
      if (name.startsWith('__Host-')) {
        promises.push(
          chromeApi.cookies.set({
            url: 'https://accounts.google.com',
            path: '/',
            name,
            value,
            secure: true,
            httpOnly: true,
          }).catch((err) => console.warn(`[__Host- cookie err ${name}]:`, err?.message || err))
        );
        promises.push(
          chromeApi.cookies.set({
            url: 'https://flow.google.com',
            path: '/',
            name,
            value,
            secure: true,
            httpOnly: true,
          }).catch(() => {})
        );
        promises.push(
          chromeApi.cookies.set({
            url: 'https://labs.google',
            path: '/',
            name,
            value,
            secure: true,
            httpOnly: true,
          }).catch(() => {})
        );
        continue;
      }

      // Group C: OSID / __Secure-OSID (Origin-bound session ID for Flow / Labs)
      if (name === 'OSID' || name === '__Secure-OSID') {
        const osidUrls = ['https://flow.google.com', 'https://flow.google', 'https://labs.google'];
        for (const targetUrl of osidUrls) {
          promises.push(
            chromeApi.cookies.set({
              url: targetUrl,
              path: '/',
              name,
              value,
              secure: true,
              httpOnly: true,
              sameSite: 'lax',
            }).catch((err) => console.warn(`[OSID cookie err ${name} on ${targetUrl}]:`, err?.message || err))
          );
        }
        promises.push(
          chromeApi.cookies.set({
            url: 'https://google.com',
            domain: 'google.com',
            path: '/',
            name,
            value,
            secure: true,
          }).catch(() => {})
        );
        continue;
      }

      // Group D: Plain Unsecure Google Account cookies (SID, APISID)
      if (name === 'SID' || name === 'APISID') {
        const isHttpOnly = name === 'SID';
        // 1. Inject to accounts.google.com (Authority for Google Login)
        promises.push(
          chromeApi.cookies.set({
            url: 'https://accounts.google.com',
            path: '/',
            name,
            value,
            secure: false,
            httpOnly: isHttpOnly,
          }).catch((err) => console.warn(`[Google plain cookie err ${name} on accounts]:`, err?.message || err))
        );
        // 2. Inject domain cookie to google.com
        promises.push(
          chromeApi.cookies.set({
            url: 'https://google.com',
            domain: 'google.com',
            path: '/',
            name,
            value,
            secure: false,
            httpOnly: isHttpOnly,
          }).catch((err) => console.warn(`[Google plain cookie err ${name} on google.com]:`, err?.message || err))
        );
        // 3. Inject to flow.google.com
        promises.push(
          chromeApi.cookies.set({
            url: 'https://flow.google.com',
            path: '/',
            name,
            value,
            secure: false,
            httpOnly: isHttpOnly,
          }).catch(() => {})
        );
        continue;
      }

      // Group E: General Google Account secure cookies (LSID, ACCOUNT_CHOOSER, __Secure-1PSID, __Secure-3PSID, SSID, etc.)
      const isHttpOnlyAuth = ['__Secure-1PSID', '__Secure-3PSID', 'SSID', 'HSID', 'LSID', 'LSOLH'].includes(name);

      // 1. MUST inject to https://accounts.google.com (Where Google Account login and LSID authentication tickets live)
      promises.push(
        chromeApi.cookies.set({
          url: 'https://accounts.google.com',
          path: '/',
          name,
          value,
          secure: true,
          httpOnly: isHttpOnlyAuth,
        }).catch((err) => console.warn(`[Google auth cookie err ${name} on accounts]:`, err?.message || err))
      );

      // 2. Inject as domain cookie to google.com (covers all subdomains)
      promises.push(
        chromeApi.cookies.set({
          url: 'https://google.com',
          domain: 'google.com',
          path: '/',
          name,
          value,
          secure: true,
          httpOnly: isHttpOnlyAuth,
        }).catch((err) => console.warn(`[Google auth cookie err ${name} on google.com]:`, err?.message || err))
      );

      // 3. Inject to flow.google.com
      promises.push(
        chromeApi.cookies.set({
          url: 'https://flow.google.com',
          path: '/',
          name,
          value,
          secure: true,
          httpOnly: isHttpOnlyAuth,
        }).catch(() => {})
      );

      // 4. Inject to labs.google
      promises.push(
        chromeApi.cookies.set({
          url: 'https://labs.google',
          path: '/',
          name,
          value,
          secure: true,
          httpOnly: isHttpOnlyAuth,
        }).catch(() => {})
      );
    }

    await Promise.all(promises);
  } else if (isDola) {
    // Dola (ByteDance) cookies for dola.com
    const pairs = cookieStr.split(';');
    const promises = [];
    for (const pair of pairs) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx <= 0) continue;
      const name = pair.substring(0, eqIdx).trim();
      const value = pair.substring(eqIdx + 1).trim();
      if (!name || !value) continue;

      const isHostCookie = name.startsWith('__Host-');
      const cookieDetail = {
        url: 'https://www.dola.com',
        path: '/',
        name,
        value,
        secure: true,
      };
      if (!isHostCookie) {
        cookieDetail.domain = '.dola.com';
      }
      promises.push(
        chromeApi.cookies.set(cookieDetail).catch((err) => {
          console.warn(`[Dola cookie sync warning for ${name}]:`, err?.message || err);
        })
      );
    }
    await Promise.all(promises);
  } else {
    // Weavy provider cookies
    const pairs = cookieStr.split(';');
    const promises = [];
    const targets = ['https://app.weavy.ai', 'https://api.weavy.ai'];
    for (const pair of pairs) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx <= 0) continue;
      const name = pair.substring(0, eqIdx).trim();
      const value = pair.substring(eqIdx + 1).trim();
      if (!name || !value) continue;

      const isHostCookie = name.startsWith('__Host-') || name.startsWith('__Secure-');
      for (const targetUrl of targets) {
        const cookieDetail = {
          url: targetUrl,
          path: '/',
          name,
          value,
          secure: true,
        };
        if (!isHostCookie) {
          cookieDetail.domain = '.weavy.ai';
        }
        promises.push(
          chromeApi.cookies.set(cookieDetail).catch((err) => {
            console.warn(`[Cookie sync warning for ${name} on ${targetUrl}]:`, err?.message || err);
          })
        );
      }
    }
    await Promise.all(promises);
  }
}

export async function exchangeRefreshToken({
  refreshToken,
  cookieStr,
  FIREBASE_API_KEY,
  syncCookiesToBrowser,
  parseJwt,
  fetchUserCreditsFromWeavy,
  WEAVY_API_BASE,
  extractCreditsFromObj,
}) {
  const cleanToken = (refreshToken || '').trim();
  if (!cleanToken) throw new Error('Token kosong.');

  if (cookieStr) {
    await syncCookiesToBrowser(cookieStr);
  }

  const directUrl = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`;
  const postBody = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: cleanToken,
  });

  let resp;
  try {
    resp = await fetch(directUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postBody,
    });
  } catch (directErr) {
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(directUrl)}`;
    resp = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postBody,
    });
  }

  if (!resp.ok) {
    const errJson = await resp.json().catch(() => ({}));
    throw new Error(errJson.error?.message || 'Gagal menukar Refresh Token dengan Firebase Auth.');
  }

  const data = await resp.json();
  const idToken = data.id_token;
  const newRefreshToken = data.refresh_token || cleanToken;
  const userId = data.user_id;

  const payload = parseJwt(idToken) || {};
  const email = payload.email || `${userId.substring(0, 10)}@weavy.user`;
  const name = payload.name || email.split('@')[0];
  const picture = payload.picture || '';

  const tempAcc = { userId, cookie: cookieStr };
  const credits = await fetchUserCreditsFromWeavy({
    idToken,
    accountObj: tempAcc,
    syncCookiesToBrowser,
    WEAVY_API_BASE,
    extractCreditsFromObj,
  });

  return {
    id: userId || `weavy_${Date.now()}`,
    userId,
    email,
    name,
    picture,
    refreshToken: newRefreshToken,
    idToken,
    cookie: cookieStr || '',
    credits,
    lastVerified: new Date().toISOString(),
    expiresAt: Date.now() + (parseInt(data.expires_in, 10) || 3600) * 1000,
  };
}

export async function getValidIdToken({
  account,
  exchangeRefreshToken,
  saveAccounts,
}) {
  if (!account) return null;

  // Hanya provider Weavy yang menggunakan pertukaran refresh token Firebase
  if ((account.provider && account.provider !== 'weavy') || !account.refreshToken) {
    return account.idToken || null;
  }

  if (account.idToken && account.expiresAt && account.expiresAt - Date.now() > 5 * 60 * 1000) {
    return account.idToken;
  }

  try {
    const updated = await exchangeRefreshToken({
      refreshToken: account.refreshToken,
      cookieStr: account.cookie,
    });
    account.idToken = updated.idToken;
    account.refreshToken = updated.refreshToken;
    account.expiresAt = updated.expiresAt;
    account.credits = typeof updated.credits === 'number' ? updated.credits : account.credits;
    await saveAccounts();
    return account.idToken;
  } catch (e) {
    console.error('[Refresh Token Auto-Renewal Failed]:', e);
    return account.idToken || null;
  }
}

export function getTodayLocalDateStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function fetchUserCreditsFromDola({
  account,
  storage,
  syncCookiesToBrowser,
} = {}) {
  const DEFAULT_DOLA_CREDITS = 4;
  if (!account) return DEFAULT_DOLA_CREDITS;

  const todayStr = getTodayLocalDateStr();

  // 1. Sync cookies ke browser jika tersedia
  if (account.cookie && typeof syncCookiesToBrowser === 'function') {
    try {
      await syncCookiesToBrowser({ cookieStr: account.cookie, domainType: 'dola' });
    } catch (_) {}
  }

  // 2. Cek riwayat generasi lokal dari storage hari ini
  let localGeneratedToday = false;
  try {
    if (storage) {
      const recentGens = (await storage.get('weavy_recent_generations')) || [];
      const hasDolaGenToday = recentGens.some((gen) => {
        if (!gen || !gen.timestamp) return false;
        const genDate = new Date(gen.timestamp);
        const genDateStr = `${genDate.getFullYear()}-${String(genDate.getMonth() + 1).padStart(2, '0')}-${String(genDate.getDate()).padStart(2, '0')}`;
        if (genDateStr !== todayStr) return false;
        const isDola = gen.provider === 'dola' || (gen.model && (String(gen.model).includes('dola') || String(gen.model).includes('seedance')));
        if (account.id && gen.accountId) {
          return isDola && gen.accountId === account.id;
        }
        return isDola;
      });

      if (hasDolaGenToday) {
        localGeneratedToday = true;
      }
    }
  } catch (e) {
    console.warn('[Dola local gen check warning]:', e);
  }

  // 3. Cek flag lastGeneratedDate pada objek akun
  if (account.lastGeneratedDate === todayStr) {
    localGeneratedToday = true;
  }

  // 4. Cek histori obrolan / pembuatan video langsung dari API dola.com
  let onlineGeneratedToday = false;
  let onlineRemainingCredit = null;

  try {
    const pollUrl = 'https://www.dola.com/im/chain/recent_conv?version_code=20800&language=en&device_platform=web&doubao_device_platform=web&aid=495671&real_aid=495671&pkg_type=release_version&region=ID&sys_region=ID&samantha_web=1&web_platform=browser';
    const pollBody = {
      cmd: 3200,
      uplink_body: {
        pull_recent_conv_chain_uplink_body: {
          limit: 10,
          filter: { conversation_type: [], project_filter: 1 },
          message_count_per_conv: 6,
          api_version: 1,
          conv_version: 0,
          direction: 3,
          option: {
            not_need_message: false,
            need_complete_conversation: true,
            need_coco_bot: true,
            need_pc_pin_chain: true,
            pc_pin_query_type: 1,
            exclude_archive: true,
            only_archive: false,
          },
        },
      },
      sequence_id: `seq_${Date.now()}`,
      channel: 2,
      version: '1',
    };

    const resp = await fetch(pollUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json; encoding=utf-8',
        'agw-js-conv': 'str',
        'Accept': '*/*',
      },
      body: JSON.stringify(pollBody),
    });

    if (resp.ok) {
      const data = await resp.json();
      const cells = data?.downlink_body?.pull_recent_conv_chain_downlink_body?.cells || [];
      const startOfTodayMs = new Date(new Date().setHours(0, 0, 0, 0)).getTime();

      for (const c of cells) {
        const conv = c.conversation || {};
        const createTimeSec = conv.create_time || 0;
        const createTimeMs = createTimeSec * 1000;

        for (const m of conv.messages || []) {
          const mTimeMs = (m.create_time || createTimeSec || 0) * 1000;
          if (mTimeMs >= startOfTodayMs) {
            const content = m.content || '';
            if (content.includes('creation_block') || content.includes('video_model') || content.includes('seedance') || content.includes('creation')) {
              onlineGeneratedToday = true;
              const creditMatch = content.match(/"(?:remain_credit|left_credit|credit|quota)"\s*:\s*(\d+)/i);
              if (creditMatch) {
                onlineRemainingCredit = parseInt(creditMatch[1], 10);
              }
              break;
            }
          }
        }
        if (onlineGeneratedToday) break;
      }
    }
  } catch (err) {
    // Network or tab offline fallback
  }

  // Jika sudah ada pembuatan video/konten hari ini:
  // Gunakan remaining credits dari respon Dola jika ada, atau default 0
  if (onlineGeneratedToday || localGeneratedToday) {
    return (typeof onlineRemainingCredit === 'number') ? onlineRemainingCredit : 0;
  }

  // Jika belum ada generate hari ini: Kuota penuh 4 credits
  return DEFAULT_DOLA_CREDITS;
}

/**
 * Reloads the active Weavy tab or creates a new one if not open, then waits for completion.
 */
export async function reloadWeavyTabAndWait(chromeApi = typeof chrome !== 'undefined' ? chrome : undefined) {
  if (!chromeApi || !chromeApi.tabs) return null;
  try {
    const tabs = await chromeApi.tabs.query({ url: ['*://app.weavy.ai/*', '*://*.weavy.ai/*'] });
    let targetTab = tabs.find((t) => t.active) || tabs[0];
    let tabId;

    if (targetTab && targetTab.id) {
      tabId = targetTab.id;
      await chromeApi.tabs.reload(tabId);
    } else {
      const newTab = await chromeApi.tabs.create({ url: 'https://app.weavy.ai/', active: false });
      tabId = newTab.id;
    }

    // Poll until tab status is 'complete'
    for (let i = 0; i < 35; i++) {
      await new Promise((r) => setTimeout(r, 600));
      try {
        const currentTab = await chromeApi.tabs.get(tabId);
        if (currentTab && currentTab.status === 'complete') {
          // Extra wait for Firebase Auth & Weavy scripts on the page to initialize and renew STS session
          await new Promise((r) => setTimeout(r, 1800));
          return tabId;
        }
      } catch (e) {
        break;
      }
    }
    return tabId;
  } catch (err) {
    console.warn('[reloadWeavyTabAndWait Error]:', err);
    return null;
  }
}

/**
 * Handles automatic 403 error recovery for Weavy provider:
 * 1. Reloads the Weavy tab (app.weavy.ai) so session/token is renewed.
 * 2. Reads renewed Firebase Auth session / cookies from the tab.
 * 3. Refreshes account token & calls syncSingleAccount / exchangeRefreshToken.
 * 4. Returns the freshly renewed idToken and account object so generation can immediately continue.
 */
export async function recoverWeavySessionOn403({
  account,
  accounts = [],
  syncSingleAccountFn,
  exchangeRefreshTokenFn,
  saveAccountsFn,
  onStatusUpdate,
  chromeApi = typeof chrome !== 'undefined' ? chrome : undefined,
} = {}) {
  if (!account) return null;

  if (onStatusUpdate) {
    onStatusUpdate('Akses ditolak (403). Mereload tab Weavy & menyinkronkan token akun...');
  }

  // 1. Reload Weavy tab and wait for it to be ready
  const tabId = await reloadWeavyTabAndWait(chromeApi);

  // 2. Extract latest session from Weavy tab if possible
  if (tabId && chromeApi && chromeApi.scripting) {
    try {
      const injectionResults = await chromeApi.scripting.executeScript({
        target: { tabId },
        func: async () => {
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
                if (k && k.startsWith('firebase:authUser')) {
                  try {
                    const parsed = JSON.parse(localStorage.getItem(k));
                    if (parsed?.stsTokenManager?.refreshToken) {
                      authUser = parsed;
                      break;
                    }
                  } catch (e) {}
                }
              }
            }

            if (authUser?.stsTokenManager?.refreshToken) {
              return {
                success: true,
                refreshToken: authUser.stsTokenManager.refreshToken,
                accessToken: authUser.stsTokenManager.accessToken,
                cookie: document.cookie || '',
                email: authUser.email || '',
                uid: authUser.uid || '',
                name: authUser.displayName || '',
              };
            }
            return { success: false };
          } catch (e) {
            return { success: false, error: e.message };
          }
        },
      });

      const res = injectionResults?.[0]?.result;
      if (res && res.success && res.refreshToken) {
        account.refreshToken = res.refreshToken;
        if (res.accessToken) account.idToken = res.accessToken;
        if (res.cookie) account.cookie = res.cookie;
      }
    } catch (e) {
      console.warn('[recoverWeavySessionOn403 Tab Read Warning]:', e);
    }
  } else if (typeof window !== 'undefined') {
    // Mode Web UI (run.app): Kirim sinyal ke Extension Bridge untuk ambil sesi segar
    try {
      const bridgeRes = await new Promise((resolve) => {
        const taskId = 'rec403_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const listener = (event) => {
          if (event.source !== window || !event.data || typeof event.data !== 'object') return;
          if (event.data.type === 'AMB_AUTO_IMPORT_RESULT' && event.data.taskId === taskId) {
            window.removeEventListener('message', listener);
            clearTimeout(timer);
            resolve(event.data);
          }
        };
        window.addEventListener('message', listener);
        const timer = setTimeout(() => {
          window.removeEventListener('message', listener);
          resolve(null);
        }, 8000);

        window.postMessage({
          type: 'AMB_AUTO_IMPORT_REQUEST',
          taskId,
          payload: { provider: 'weavy' }
        }, '*');
      });

      if (bridgeRes && bridgeRes.success && bridgeRes.account) {
        account.refreshToken = bridgeRes.account.refreshToken || account.refreshToken;
        account.idToken = bridgeRes.account.idToken || account.idToken;
        if (bridgeRes.account.cookie) account.cookie = bridgeRes.account.cookie;
        if (typeof bridgeRes.account.credits === 'number') account.credits = bridgeRes.account.credits;
        account.lastVerified = new Date().toISOString();
        if (typeof saveAccountsFn === 'function') await saveAccountsFn();
        return account.idToken;
      }
    } catch (bridgeErr) {
      console.warn('[recoverWeavySessionOn403 Web Bridge Warn]:', bridgeErr);
    }
  }

  // 3. Trigger account sync (or exchangeRefreshToken)
  if (typeof syncSingleAccountFn === 'function') {
    try {
      await syncSingleAccountFn(account.id);
    } catch (e) {
      console.warn('[recoverWeavySessionOn403 syncSingleAccount Warning]:', e);
    }
  } else if (typeof exchangeRefreshTokenFn === 'function' && account.refreshToken) {
    try {
      const updated = await exchangeRefreshTokenFn({
        refreshToken: account.refreshToken,
        cookieStr: account.cookie,
      });
      if (updated) {
        account.idToken = updated.idToken || account.idToken;
        account.refreshToken = updated.refreshToken || account.refreshToken;
        account.expiresAt = updated.expiresAt || account.expiresAt;
        account.credits = typeof updated.credits === 'number' ? updated.credits : account.credits;
        account.lastVerified = new Date().toISOString();
        if (typeof saveAccountsFn === 'function') {
          await saveAccountsFn();
        }
      }
    } catch (e) {
      console.warn('[recoverWeavySessionOn403 exchangeRefreshToken Warning]:', e);
    }
  }

  if (onStatusUpdate) {
    onStatusUpdate('Sesi & token Weavy berhasil disinkronkan!');
  }

  return account.idToken;
}

