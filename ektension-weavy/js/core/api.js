export const IS_CHROME_EXTENSION =
  typeof chrome !== 'undefined' &&
  !!chrome.runtime &&
  !!chrome.runtime.id &&
  !!chrome.tabs &&
  !!chrome.scripting;

export const WEAVY_API_BASE = IS_CHROME_EXTENSION
  ? 'https://api.weavy.ai'
  : '/api/weavy';

// Web UI <-> Extension Bridge State (Ketika UI berjalan di localhost/web dan ekstensi bertindak sebagai eksekutor)
export let isExtensionBridgeConnected = false;
const pendingBridgeTasks = new Map();

if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || typeof event.data !== 'object') return;
    const { type, taskId, ...rest } = event.data;

    if (type === 'AMB_EXTENSION_BRIDGE_READY' || type === 'AMB_PONG_EXTENSION') {
      isExtensionBridgeConnected = true;
      console.log('[AMB Bridge] Ekstensi Chrome terhubung sebagai tukang eksekusi!');
    }

    if (type === 'AMB_TASK_RESULT' && taskId && pendingBridgeTasks.has(taskId)) {
      const { resolve, timeoutId } = pendingBridgeTasks.get(taskId);
      clearTimeout(timeoutId);
      pendingBridgeTasks.delete(taskId);
      resolve(rest);
    }
  });

  // Ping ekstensi secara berkala
  const pingInterval = setInterval(() => {
    window.postMessage({ type: 'AMB_PING_EXTENSION' }, '*');
    if (isExtensionBridgeConnected) {
      clearInterval(pingInterval);
    }
  }, 1000);
}

export function getWeavyClientHeaders(idToken, userId, recipeId, accountData) {
  const sessionId = (accountData && accountData.sessionId) || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ses_${Date.now()}`);
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/plain, */*',
    Authorization: `Bearer ${idToken}`,
    'x-weavy-auth-provider': 'firebase',
    'x-app-version': '4.1.1316',
    baggage: (accountData && accountData.baggage) || `session.id=${sessionId}`,
  };

  if (accountData && accountData.cookie) {
    headers['x-weavy-cookie'] = accountData.cookie;
  }

  if (recipeId) {
    headers['x-app-recipeid'] = recipeId;
  }
  return headers;
}

// Route API calls through local Node.js proxy when in web mode, or an open Weavy tab when in extension mode.
export async function callWeavyApi(endpoint, fetchOptions = {}) {
  let url = endpoint;
  if (!IS_CHROME_EXTENSION) {
    if (endpoint.startsWith('https://api.weavy.ai')) {
      url = endpoint.replace('https://api.weavy.ai', '/api/weavy');
    } else if (!endpoint.startsWith('http')) {
      url = endpoint.startsWith('/api/weavy') ? endpoint : `/api/weavy${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    }
  } else {
    url = endpoint.startsWith('http') ? endpoint : `${WEAVY_API_BASE}${endpoint}`;
  }

  const method = fetchOptions.method || 'GET';
  const headers = fetchOptions.headers || {};
  const body = fetchOptions.body || null;

  let plainHeaders = {};
  if (headers instanceof Headers) {
    headers.forEach((value, key) => { plainHeaders[key] = value; });
  } else if (typeof headers === 'object' && headers !== null) {
    plainHeaders = { ...headers };
  }

  // 1. Jika di Web UI dan Ekstensi terhubung, oper tugas ke ekstensi sebagai TUKANG EKSEKUSI
  if (!IS_CHROME_EXTENSION && isExtensionBridgeConnected) {
    try {
      const realWeavyUrl = endpoint.startsWith('http')
        ? (endpoint.includes('/api/weavy') ? endpoint.replace('/api/weavy', 'https://api.weavy.ai') : endpoint)
        : `https://api.weavy.ai${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

      const bridgeResult = await new Promise((resolve) => {
        const taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const timeoutId = setTimeout(() => {
          pendingBridgeTasks.delete(taskId);
          console.warn('[AMB Bridge] Timeout menunggu respon ekstensi, fallback ke server...');
          resolve(null);
        }, 15000);

        pendingBridgeTasks.set(taskId, { resolve, timeoutId });

        window.postMessage(
          {
            type: 'AMB_EXECUTE_TASK',
            taskId,
            payload: {
              url: realWeavyUrl,
              method,
              headers: plainHeaders,
              body: typeof body === 'string' ? body : (body ? JSON.stringify(body) : null),
            },
          },
          '*'
        );
      });

      if (bridgeResult && bridgeResult.success) {
        return {
          ok: bridgeResult.ok,
          status: bridgeResult.status,
          text: async () => bridgeResult.text,
          json: async () => (bridgeResult.json !== null ? bridgeResult.json : JSON.parse(bridgeResult.text || '{}')),
        };
      }
    } catch (bridgeErr) {
      console.warn('[AMB Bridge Error]:', bridgeErr);
    }
  }

  // 2. Jika di dalam Ekstensi Chrome langsung
  if (IS_CHROME_EXTENSION && chrome.tabs && chrome.scripting) {
    try {
      const tabs = await chrome.tabs.query({ url: ['*://app.weavy.ai/*', '*://*.weavy.ai/*'] });
      if (tabs && tabs.length > 0) {
        const targetTab = tabs.find((tab) => tab.active) || tabs[0];
        const results = await chrome.scripting.executeScript({
          target: { tabId: targetTab.id },
          args: [{ url, method, headers: plainHeaders, body: typeof body === 'string' ? body : (body ? JSON.stringify(body) : null) }],
          func: async ({ url: requestUrl, method: requestMethod, headers: requestHeaders, body: requestBody }) => {
            try {
              const response = await fetch(requestUrl, {
                method: requestMethod,
                headers: requestHeaders,
                body: requestBody || undefined,
                credentials: 'include',
              });
              const status = response.status;
              const ok = response.ok;
              const text = await response.text();
              let json = null;
              try {
                json = JSON.parse(text);
              } catch (error) {}
              return { success: true, ok, status, text, json };
            } catch (error) {
              return { success: false, error: error.message };
            }
          },
        });

        const tabResponse = results?.[0]?.result;
        if (tabResponse && tabResponse.success) {
          return {
            ok: tabResponse.ok,
            status: tabResponse.status,
            text: async () => tabResponse.text,
            json: async () => (tabResponse.json !== null ? tabResponse.json : JSON.parse(tabResponse.text)),
          };
        }
      }
    } catch (error) {
      console.warn('[callWeavyApi Tab Execution Warning]:', error);
    }
  }

  return fetch(url, {
    method,
    headers: plainHeaders,
    body,
    credentials: 'include',
  });
}
