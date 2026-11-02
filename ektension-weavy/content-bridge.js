// AMB Media V.3 - Extension Content Bridge
// Menjembatani komunikasi antara Web UI (Localhost / AI Studio), Tab Dola AI (ByteDance), dan Ekstensi Chrome

const isDolaPage = typeof window !== 'undefined' && /dola\.com$/i.test(window.location.hostname);
console.log(`[AMB Extension Bridge] Content script loaded on: ${window.location.href} (isDola: ${isDolaPage})`);

// =============================================================================
// 1. DOLA AI IN-TAB BRIDGE (EXECUTE STREAM FETCH & DOM FALLBACK)
// =============================================================================
if (isDolaPage) {
  // Listener untuk pesan dari Extension Background / Sidepanel
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const { action } = request || {};

    // 1. Check Bridge Status
    if (action === 'DOLA_CHECK_BRIDGE') {
      sendResponse({
        ready: true,
        href: window.location.href,
        isChat: window.location.pathname.includes('/chat'),
        readyState: document.readyState,
      });
      return false;
    }

    // 2. Silent Stream Fetch via Dola Page Context (100% Background, Membawa Cookie & Token Asli)
    if (action === 'EXECUTE_PAGE_STREAM_FETCH') {
      const { streamId, url, method = 'POST', headers = {}, body = null } = request;
      if (!streamId || !url) {
        sendResponse({ success: false, error: 'Missing streamId or url' });
        return false;
      }

      // Berikan ack bahwa streaming telah dimulai
      sendResponse({ accepted: true, streamId });

      (async () => {
        try {
          const fetchHeaders = {
            'Accept': '*/*',
            'Content-Type': 'application/json',
            'agw-js-conv': 'str, str',
            ...headers,
          };

          const response = await fetch(url, {
            method,
            headers: fetchHeaders,
            body: typeof body === 'object' && body !== null ? JSON.stringify(body) : body,
            credentials: 'include',
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => '');
            chrome.runtime.sendMessage({
              action: 'STREAM_ERROR',
              streamId,
              status: response.status,
              error: `HTTP ${response.status}: ${errText.slice(0, 200)}`,
            }).catch(() => {});
            return;
          }

          if (!response.body) {
            chrome.runtime.sendMessage({
              action: 'STREAM_ERROR',
              streamId,
              error: 'Response body is empty or not readable',
            }).catch(() => {});
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              chrome.runtime.sendMessage({
                action: 'STREAM_DONE',
                streamId,
                status: response.status,
              }).catch(() => {});
              break;
            }

            const chunkText = decoder.decode(value, { stream: true });
            if (chunkText) {
              chrome.runtime.sendMessage({
                action: 'STREAM_CHUNK',
                streamId,
                chunk: chunkText,
              }).catch(() => {});
            }
          }
        } catch (err) {
          console.error('[AMB Bridge] Stream fetch error:', err);
          chrome.runtime.sendMessage({
            action: 'STREAM_ERROR',
            streamId,
            error: err.message || 'Stream fetch network error',
          }).catch(() => {});
        }
      })();

      return true; // async
    }

    // 3. Normal Silent Fetch via Page Context (misal untuk upload image atau polling status)
    if (action === 'EXECUTE_PAGE_FETCH') {
      const { url, method = 'GET', headers = {}, body = null } = request;
      (async () => {
        try {
          const response = await fetch(url, {
            method,
            headers: {
              'Accept': '*/*',
              ...headers,
            },
            body: typeof body === 'object' && body !== null && !(body instanceof FormData) ? JSON.stringify(body) : body,
            credentials: 'include',
          });

          const status = response.status;
          const ok = response.ok;
          const text = await response.text();
          let json = null;
          try {
            json = JSON.parse(text);
          } catch (_) {}

          sendResponse({ success: true, ok, status, text, json });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    // 4. DOM Automation Fallback (Jalur Darurat Jika Stream API Ditolak / Berubah Struktur)
    if (action === 'EXECUTE_DOM_FALLBACK') {
      const { prompt, isPro = false } = request;
      (async () => {
        try {
          const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));

          // Cari elemen input
          const input = document.querySelector(
            'div.tiptap.ProseMirror, #input-engine-container [contenteditable="true"], [data-chat-input], textarea, [contenteditable="true"]'
          );

          if (!input) {
            sendResponse({ success: false, error: 'Elemen input chat Dola tidak ditemukan pada halaman.' });
            return;
          }

          // Isi teks ke dalam input editor
          input.focus();
          input.innerHTML = `<p>${(prompt || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          await waitMs(300);

          // Cari tombol kirim
          const sendBtn =
            document.querySelector('[data-testid="send-button"]') ||
            document.querySelector('[data-valid-btn="send-button"]') ||
            document.querySelector('button[type="submit"]') ||
            Array.from(document.querySelectorAll('button')).find((b) => {
              const aria = (b.getAttribute('aria-label') || b.getAttribute('title') || '').toLowerCase();
              return aria.includes('send') || aria.includes('kirim');
            });

          if (sendBtn && !sendBtn.disabled) {
            sendBtn.click();
          } else {
            // Simulasi penekanan tombol Enter
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          }

          // Monitor bubble assistant terbaru
          const startTime = Date.now();
          let latestText = '';
          let stableCount = 0;

          while (Date.now() - startTime < 60000) {
            await waitMs(1000);
            const assistantBubbles = Array.from(
              document.querySelectorAll(
                '[data-message-role="assistant"], .chat-message-assistant, [data-testid="chat-message-assistant"], .message-assistant'
              )
            );

            const lastBubble = assistantBubbles[assistantBubbles.length - 1];
            if (lastBubble) {
              const currentText = (lastBubble.innerText || lastBubble.textContent || '').trim();
              if (currentText && currentText === latestText) {
                stableCount += 1;
                if (stableCount >= 2) {
                  // Respon sudah selesai mengalir
                  break;
                }
              } else {
                latestText = currentText;
                stableCount = 0;
              }
            }
          }

          sendResponse({ success: true, text: latestText });
        } catch (domErr) {
          sendResponse({ success: false, error: domErr.message });
        }
      })();
      return true;
    }
  });
}

// =============================================================================
// 2. WEB UI / AI STUDIO BRIDGE (LOCALHOST / RUN.APP)
// =============================================================================
if (!isDolaPage) {
  const BRIDGE_VERSION = '3.1.0';

  function notifyBridgeReady() {
    window.postMessage(
      {
        type: 'AMB_EXTENSION_BRIDGE_READY',
        version: BRIDGE_VERSION,
        timestamp: Date.now(),
      },
      '*'
    );
  }

  notifyBridgeReady();
  setInterval(notifyBridgeReady, 3000);

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || typeof event.data !== 'object') {
      return;
    }

    const { type, taskId, payload } = event.data;

    // Handshake Ping-Pong
    if (type === 'AMB_PING_EXTENSION') {
      window.postMessage(
        {
          type: 'AMB_PONG_EXTENSION',
          status: 'ready',
          version: BRIDGE_VERSION,
        },
        '*'
      );
      return;
    }

    // Eksekusi Panggilan API Weavy
    if (type === 'AMB_EXECUTE_TASK' && taskId && payload) {
      chrome.runtime.sendMessage(
        {
          action: 'EXECUTE_WEAVY_TASK',
          taskId,
          payload,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            window.postMessage(
              {
                type: 'AMB_TASK_RESULT',
                taskId,
                success: false,
                error: chrome.runtime.lastError.message,
              },
              '*'
            );
          } else {
            window.postMessage(
              {
                type: 'AMB_TASK_RESULT',
                taskId,
                ...response,
              },
              '*'
            );
          }
        }
      );
    }

    if (type === 'AMB_EXECUTE_WEAVY_CHAT' && taskId && payload) {
      const requestId = taskId;
      chrome.runtime.sendMessage(
        {
          action: 'EXECUTE_WEAVY_CHAT_FROM_APP',
          payload,
        },
        (response) => {
          const error = chrome.runtime.lastError;
          window.postMessage(
            {
              type: 'AMB_TASK_RESULT',
              taskId: requestId,
              ...(error
                ? { success: false, error: error.message }
                : response || { success: false, error: 'Ekstensi tidak mengembalikan hasil Chat.' }),
            },
            '*'
          );
        }
      );
    }

    // Auto-Import Request from Web UI to Extension
    if (type === 'AMB_AUTO_IMPORT_REQUEST' && taskId) {
      chrome.runtime.sendMessage(
        {
          action: 'AUTO_IMPORT_ACTIVE_ACCOUNT',
          taskId,
          provider: payload?.provider || 'weavy',
        },
        (response) => {
          if (chrome.runtime.lastError) {
            window.postMessage(
              {
                type: 'AMB_AUTO_IMPORT_RESULT',
                taskId,
                success: false,
                error: chrome.runtime.lastError.message,
              },
              '*'
            );
          } else {
            window.postMessage(
              {
                type: 'AMB_AUTO_IMPORT_RESULT',
                taskId,
                ...response,
              },
              '*'
            );
          }
        }
      );
    }

    // Refresh token Weavy via Extension (reload tab app.weavy.ai + baca ulang session Firebase)
    if (type === 'AMB_REFRESH_WEAVY_TOKEN' && taskId) {
      chrome.runtime.sendMessage(
        {
          action: 'REFRESH_WEAVY_TOKEN',
          taskId,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            window.postMessage(
              {
                type: 'AMB_TOKEN_REFRESHED',
                taskId,
                success: false,
                error: chrome.runtime.lastError.message,
              },
              '*'
            );
          } else {
            window.postMessage(
              {
                type: 'AMB_TOKEN_REFRESHED',
                taskId,
                ...response,
              },
              '*'
            );
          }
        }
      );
    }

    // Sinkronisasi sesi akun ke tab app.weavy.ai
    if (type === 'AMB_SYNC_ACCOUNT_TO_TAB' && taskId) {
      chrome.runtime.sendMessage(
        {
          action: 'SYNC_ACCOUNT_TO_TAB',
          taskId,
          payload: {
            account: payload?.account || {},
            mode: payload?.mode || 'refresh',
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            window.postMessage(
              {
                type: 'AMB_SYNC_ACCOUNT_RESULT',
                taskId,
                success: false,
                error: chrome.runtime.lastError.message,
              },
              '*'
            );
          } else {
            window.postMessage(
              {
                type: 'AMB_SYNC_ACCOUNT_RESULT',
                taskId,
                ...response,
              },
              '*'
            );
          }
        }
      );
    }

    // Upload asset Weavy (gambar) dari dalam tab app.weavy.ai
    if (type === 'AMB_UPLOAD_WEAVY_ASSET' && taskId) {
      chrome.runtime.sendMessage(
        {
          action: 'UPLOAD_WEAVY_ASSET',
          taskId,
          payload: {
            dataUrl: payload?.dataUrl,
            sourceUrl: payload?.sourceUrl,
            fileName: payload?.fileName,
            idToken: payload?.idToken,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            window.postMessage(
              {
                type: 'AMB_ASSET_UPLOADED',
                taskId,
                success: false,
                error: chrome.runtime.lastError.message,
              },
              '*'
            );
          } else {
            window.postMessage(
              {
                type: 'AMB_ASSET_UPLOADED',
                taskId,
                ...response,
              },
              '*'
            );
          }
        }
      );
    }
  });
}
