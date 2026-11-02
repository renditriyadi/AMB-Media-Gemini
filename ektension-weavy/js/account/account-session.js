export async function syncActiveAccountCookie(account, syncCookiesToBrowser) {
  if (account && account.cookie && typeof syncCookiesToBrowser === 'function') {
    await syncCookiesToBrowser(account.cookie);
  }
}

export async function syncAccountSessionToBrowserTab(input) {
  const normalized = typeof input === 'object' && input !== null && !Array.isArray(input)
    ? input
    : {
        accountOrId: input,
        accounts: [],
      };

  const {
    accountOrId,
    accounts = [],
    saveAccounts,
    exchangeRefreshToken,
    syncCookiesToBrowser,
    showAuthAlert,
    renderHeaderAccount,
    renderAccountsList,
    FIREBASE_API_KEY,
    setActiveAccountId,
  } = normalized;

  const acc = typeof accountOrId === 'object' && accountOrId !== null
    ? accountOrId
    : accounts.find((account) => account.id === accountOrId);

  if (!acc) return false;

  if (typeof setActiveAccountId === 'function' && acc.id) {
    setActiveAccountId(acc.id);
  }

  if (acc.provider === 'flow') {
    // If account has cookie data, sync cookies in background without forcing any tab redirect
    if (acc.cookie && typeof syncCookiesToBrowser === 'function') {
      try {
        await syncCookiesToBrowser({ cookieStr: acc.cookie, domainType: 'google' });
      } catch (e) {
        console.warn('[Sync cookies background warn]:', e);
      }
    }

    const profileLabel = acc.chromeProfile || 'Profile Utama';
    showAuthAlert?.(`✅ Akun Flow aktif: ${acc.email || 'User'} (${profileLabel})`, 'success');
    renderHeaderAccount?.();
    renderAccountsList?.();
    return true;
  }

  if (acc.provider === 'dola') {
    // If account has cookie data, sync cookies in background without forcing tab redirect
    if (acc.cookie && typeof syncCookiesToBrowser === 'function') {
      try {
        await syncCookiesToBrowser({ cookieStr: acc.cookie, domainType: 'dola' });
      } catch (e) {
        console.warn('[Sync Dola cookies background warn]:', e);
      }
    }

    const profileLabel = acc.chromeProfile || 'Profile Utama';
    showAuthAlert?.(`✅ Akun Dola aktif: ${acc.name || acc.email || 'User'} (${profileLabel})`, 'success');
    renderHeaderAccount?.();
    renderAccountsList?.();
    return true;
  }

  if (!acc.refreshToken && !acc.idToken) {
    showAuthAlert?.(`Akun ${acc.email || 'ini'} tidak memiliki kredensial token yang valid.`, 'error');
    return false;
  }

  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) {
    showAuthAlert?.(`Akun ${acc.email || 'ini'} kini aktif!`, 'success');
    return true;
  }

  try {
    let tabs = await chrome.tabs.query({ url: ['*://app.weavy.ai/*', '*://*.weavy.ai/*'] });
    let tabId = null;

    if (!tabs || tabs.length === 0) {
      const newTab = await chrome.tabs.create({ url: 'https://app.weavy.ai' });
      tabId = newTab?.id ?? null;
      if (typeof tabId === 'number') {
        await new Promise((resolve) => setTimeout(resolve, 2200));
      }
    } else {
      const targetTab = tabs.find((tab) => tab.active) || tabs[0];
      tabId = targetTab?.id ?? null;
    }

    if (typeof tabId !== 'number') {
      showAuthAlert?.(`Akun ${acc.email || 'ini'} kini aktif!`, 'success');
      return true;
    }

    let freshIdToken = acc.idToken;
    try {
      if (typeof exchangeRefreshToken === 'function' && acc.refreshToken) {
        const fresh = await exchangeRefreshToken({ refreshToken: acc.refreshToken, cookieStr: acc.cookie });
        if (fresh && fresh.idToken) {
          freshIdToken = fresh.idToken;
          acc.idToken = fresh.idToken;
          acc.expiresAt = fresh.expiresAt;
          if (typeof fresh.credits === 'number') acc.credits = fresh.credits;
          await saveAccounts?.();
        }
      }
    } catch (error) {
      console.warn('[Token refresh warning before injection]:', error);
    }

    if (acc.cookie && typeof syncCookiesToBrowser === 'function') {
      await syncCookiesToBrowser(acc.cookie);
    }

    const injectResult = await chrome.scripting.executeScript({
      target: { tabId },
      args: [{
        uid: acc.userId || acc.id,
        email: acc.email,
        displayName: acc.name || '',
        refreshToken: acc.refreshToken,
        accessToken: freshIdToken || acc.idToken || '',
        expiresAt: acc.expiresAt || (Date.now() + 3600 * 1000),
        weavyApiKey: FIREBASE_API_KEY || 'AIzaSyC-qLy3TFyXMogJPfMkZJ9H_q46hEu1sxI',
      }],
      func: async ({ uid, email, displayName, refreshToken, accessToken, expiresAt, weavyApiKey }) => {
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

                  store.put({
                    fbase_key: localKey,
                    value: authPayload,
                  });

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

          let fetchedCredits = null;
          try {
            const userRes = await fetch('https://api.weavy.ai/api/v1/users', {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'x-weavy-auth-provider': 'firebase',
                'x-app-version': '4.1.1316',
                Accept: 'application/json, text/plain, */*',
              },
              credentials: 'include',
            });
            if (userRes.ok) {
              const uData = await userRes.json();
              fetchedCredits = uData?.credits ?? uData?.activeWorkspace?.credits ?? uData?.subscription?.credits ?? null;
            }
          } catch (error) {}

          window.location.replace('https://app.weavy.ai/');
          return { success: true, credits: fetchedCredits };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
    });

    const tabResult = injectResult?.[0]?.result;
    if (tabResult && typeof tabResult.credits === 'number') {
      acc.credits = tabResult.credits;
      await saveAccounts?.();
      renderHeaderAccount?.();
      renderAccountsList?.();
    }

    setTimeout(async () => {
      try {
        if (typeof exchangeRefreshToken === 'function' && acc.refreshToken) {
          const updated = await exchangeRefreshToken({ refreshToken: acc.refreshToken, cookieStr: acc.cookie });
          if (updated) {
            if (typeof updated.credits === 'number' && updated.credits !== null) {
              acc.credits = updated.credits;
            }
            acc.idToken = updated.idToken || acc.idToken;
            acc.expiresAt = updated.expiresAt || acc.expiresAt;
            await saveAccounts?.();
            renderHeaderAccount?.();
            renderAccountsList?.();
          }
        }
      } catch (error) {
        console.warn('[Auto sync refresh after tab load warning]:', error);
      }
    }, 2500);

    showAuthAlert?.(`✅ Berhasil! Tab browser Weavy dialihkan & login sebagai ${acc.email} (Saldo: ${acc.credits} Koin)`, 'success');
    return true;
  } catch (error) {
    console.warn('[Sync Tab Error]:', error);
    showAuthAlert?.(`Akun ${acc.email || 'ini'} diaktifkan! Buka tab app.weavy.ai untuk melihatnya.`, 'success');
    return false;
  }
}

export async function logoutWeavyTabSession(showAuthAlert) {
  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) return false;

  try {
    const tabs = await chrome.tabs.query({ url: ['*://app.weavy.ai/*', '*://*.weavy.ai/*'] });
    if (!tabs || tabs.length === 0) {
      showAuthAlert?.('Tidak ada tab app.weavy.ai yang terbuka saat ini.', 'error');
      return false;
    }

    const tabId = (tabs.find((tab) => tab.active) || tabs[0]).id;
    if (typeof tabId !== 'number') {
      showAuthAlert?.('Tidak ada tab app.weavy.ai aktif untuk di-logout.', 'error');
      return false;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        try {
          sessionStorage.clear();
          localStorage.clear();

          await new Promise((resolve) => {
            try {
              const request = indexedDB.open('firebaseLocalStorageDb');
              request.onsuccess = (event) => {
                const db = event.target.result;
                if (db.objectStoreNames.contains('firebaseLocalStorage')) {
                  const transaction = db.transaction('firebaseLocalStorage', 'readwrite');
                  const store = transaction.objectStore('firebaseLocalStorage');
                  store.clear();
                  transaction.oncomplete = () => resolve(true);
                  transaction.onerror = () => resolve(false);
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
      },
    });

    showAuthAlert?.('🚪 Tab Weavy berhasil di-logout dan dibersihkan dari sesi lama!', 'success');
    return true;
  } catch (error) {
    showAuthAlert?.(`Gagal logout tab: ${error.message}`, 'error');
    return false;
  }
}
