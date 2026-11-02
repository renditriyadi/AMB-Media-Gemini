// gemini-chat.js - Google Gemini (gemini.google.com) DOM Automation & Chat Execution
// Provides full chat execution, multimodal file/image upload injection, streaming response capture, and new session management

// =========================================================================================
// GEMINI API KEY CONFIGURATION FLAG
// Status: NONAKTIF (false) sesuai preferensi saat ini.
// Di masa mendatang jika ingin mengaktifkan kembali Gemini API Key, ubah nilainya menjadi true.
// =========================================================================================
export const ENABLE_GEMINI_API_KEY = false;

export async function getOrOpenGeminiTab(options = {}) {
  const { openIfMissing = true } = options;
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    throw new Error('Fitur Google Gemini hanya dapat berjalan di dalam ekstensi Chrome.');
  }

  const tabs = await chrome.tabs.query({
    url: ['*://gemini.google.com/*', '*://*.gemini.google.com/*'],
  });

  if (tabs.length > 0) {
    const activeTab = tabs.find((t) => t.active) || tabs[0];
    return { tab: activeTab, isNew: false };
  }

  if (!openIfMissing) {
    return { tab: null, isNew: false };
  }

  const newTab = await chrome.tabs.create({
    url: 'https://gemini.google.com/app',
    active: false,
  });

  // Wait for tab to load
  await waitForGeminiTabReady(newTab.id, 12000);
  return { tab: newTab, isNew: true };
}

export async function waitForGeminiTabReady(tabId, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === 'complete') {
        return true;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

export async function switchGeminiModelInTab(modelId, options = {}) {
  try {
    const { tab } = await getOrOpenGeminiTab({ openIfMissing: false });
    if (!tab) return false;

    // Normalisasi kata kunci model: 3.6 flash, 3.6 thinking, 3.1 pro, 2.5 flash, 2.5 pro
    let targetKeyword = '3.6 flash';
    const mLower = String(modelId || '').toLowerCase();
    if (mLower.includes('thinking')) {
      targetKeyword = '3.6 thinking';
    } else if (mLower.includes('3.1') || mLower.includes('pro')) {
      targetKeyword = '3.1 pro';
    } else if (mLower.includes('3.6') || mLower.includes('flash')) {
      targetKeyword = '3.6 flash';
    } else if (mLower.includes('2.5') && mLower.includes('pro')) {
      targetKeyword = '2.5 pro';
    } else if (mLower.includes('2.5') || mLower.includes('flash')) {
      targetKeyword = '2.5 flash';
    }

    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [{ targetKeyword }],
      func: async ({ targetKeyword }) => {
        const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));
        try {
          // 1. Cari tombol dropdown pemilih model di header kiri atas Gemini (seperti di foto: "Gemini 3.6 Flash v")
          const findModelDropdownBtn = () => {
            return (
              document.querySelector('button[aria-haspopup="menu"]') ||
              document.querySelector('.model-picker-button') ||
              document.querySelector('bard-mode-switcher button') ||
              document.querySelector('mode-switcher button') ||
              Array.from(document.querySelectorAll('button')).find((b) => {
                const txt = (b.innerText || b.textContent || b.getAttribute('aria-label') || '').toLowerCase();
                return txt.includes('gemini') && (txt.includes('flash') || txt.includes('pro') || txt.includes('thinking') || txt.includes('3.6') || txt.includes('3.1'));
              })
            );
          };

          const modelDropdownBtn = findModelDropdownBtn();
          if (!modelDropdownBtn) return false;

          // Cek apakah model yang aktif saat ini sudah sesuai
          const currentBtnText = (modelDropdownBtn.innerText || modelDropdownBtn.textContent || '').toLowerCase();
          if (currentBtnText.includes(targetKeyword)) {
            return true; // Sudah sesuai!
          }

          // Buka dropdown
          modelDropdownBtn.click();
          await waitMs(350);

          // 2. Cari opsi menu model sesuai targetKeyword (3.6 Flash, 3.6 Thinking, 3.1 Pro)
          const menuItems = Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], .mat-mdc-menu-item, button.model-option, div.model-item'));
          const targetItem = menuItems.find((item) => {
            const txt = (item.innerText || item.textContent || item.getAttribute('aria-label') || '').toLowerCase();
            return txt.includes(targetKeyword);
          });

          if (targetItem) {
            targetItem.click();
            await waitMs(300);
            return true;
          }

          // Tutup dropdown jika tidak ketemu
          document.body.click();
          return false;
        } catch (_) {
          return false;
        }
      },
    });

    return res?.[0]?.result || false;
  } catch (err) {
    console.warn('[Gemini Model Switch Tab Warning]:', err);
    return false;
  }
}

export async function createGeminiNewChatSessionInTab(options = {}) {
  try {
    const { tab } = await getOrOpenGeminiTab(options);
    if (!tab) return false;

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        try {
          // Cari tombol "New Chat" atau "Obrolan baru" di Gemini
          const newChatBtn = Array.from(document.querySelectorAll('button, a, [role="button"]')).find((el) => {
            const label = (el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase();
            return (
              label.includes('obrolan baru') ||
              label.includes('new chat') ||
              label.includes('chat baru') ||
              label === '+'
            );
          });
          if (newChatBtn) {
            newChatBtn.click();
            return true;
          }
          // Alternative: direct navigation
          if (!window.location.href.endsWith('/app')) {
            window.location.href = 'https://gemini.google.com/app';
          }
          return true;
        } catch (_) {
          return false;
        }
      },
    });
    return true;
  } catch (err) {
    console.warn('[Gemini Chat] Gagal membuat sesi chat baru:', err);
    return false;
  }
}

// Fallback direct server-side Gemini API (using @google/genai)
export async function executeGeminiApiFallback({ prompt, history = [], referenceAssets = [], onChunk = () => {} }) {
  const resp = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      history,
      referenceAssets,
    }),
  });

  if (!resp.ok) {
    const errJson = await resp.json().catch(() => ({}));
    throw new Error(errJson.error || `Gemini API error: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  const text = data.text || '';
  if (typeof onChunk === 'function') {
    onChunk(text);
  }
  return text;
}

export function sanitizeGeminiContents(history = [], currentParts = []) {
  const rawItems = [];
  if (Array.isArray(history)) {
    for (const msg of history) {
      if (!msg.content && (!msg.attachments || msg.attachments.length === 0)) continue;
      const role = msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user';
      const text = String(msg.content || '').trim();
      if (text) {
        rawItems.push({ role, text });
      }
    }
  }

  const contents = [];
  for (const item of rawItems) {
    if (contents.length > 0 && contents[contents.length - 1].role === item.role) {
      contents[contents.length - 1].parts[0].text += `\n${item.text}`;
    } else {
      contents.push({
        role: item.role,
        parts: [{ text: item.text }],
      });
    }
  }

  // Append current user turn
  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
    contents[contents.length - 1].parts.push(...currentParts);
  } else {
    contents.push({
      role: 'user',
      parts: currentParts,
    });
  }

  // Ensure conversation starts with user turn
  while (contents.length > 0 && contents[0].role !== 'user') {
    contents.shift();
  }

  return contents;
}

// 100% SILENT DIRECT GEMINI API EXECUTION (SEPERTI WEAVY TANPA BUKA TAB)
export async function executeGeminiDirectApi({
  apiKey,
  modelId = 'gemini-2.5-flash',
  prompt,
  history = [],
  referenceAssets = [],
  onProgress = () => {},
  onChunk = () => {},
}) {
  // Fitur Gemini API Key dinonaktifkan sementara (ENABLE_GEMINI_API_KEY = false).
  // Aktifkan kembali di baris atas file ini jika ingin menggunakan API Key.
  if (!ENABLE_GEMINI_API_KEY) {
    throw new Error('Fitur Google Gemini Direct API Key saat ini dinonaktifkan (ENABLE_GEMINI_API_KEY = false).');
  }

  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('API Key Google Gemini belum diatur pada akun yang dipilih.');
  }

  const cleanKey = apiKey.trim();
  onProgress(20, 'Menghubungkan ke Google Gemini API secara silent...');

  // Siapkan lampiran gambar (multimodal)
  const currentParts = [];
  if (Array.isArray(referenceAssets)) {
    for (const asset of referenceAssets) {
      let rawSrc = asset.dataUrl || asset.base64 || asset.url || asset.thumbnailUrl || '';
      let base64Data = '';
      let mimeType = asset.type || 'image/jpeg';

      if (typeof rawSrc === 'string' && rawSrc.startsWith('data:')) {
        const match = rawSrc.match(/^data:([^;]+);base64,(.*)$/s);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        }
      } else if (typeof rawSrc === 'string' && /^[A-Za-z0-9+/=]{50,}$/.test(rawSrc.trim())) {
        base64Data = rawSrc.trim();
      } else if (typeof rawSrc === 'string' && rawSrc.startsWith('http')) {
        try {
          const res = await fetch(rawSrc).catch(() => null);
          if (res && res.ok) {
            const blob = await res.blob();
            mimeType = blob.type || mimeType;
            const dataUrl = await new Promise((resolve) => {
              const r = new FileReader();
              r.onload = () => resolve(r.result);
              r.onerror = () => resolve('');
              r.readAsDataURL(blob);
            });
            const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
            if (match) {
              base64Data = match[2];
            }
          }
        } catch (e) {
          console.warn('[Gemini Direct API] Gagal download aset gambar:', e);
        }
      }

      if (base64Data) {
        currentParts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });
      }
    }
  }

  if (prompt) {
    currentParts.push({ text: String(prompt) });
  }

  // Format riwayat percakapan dengan multiturn alternating turns
  const contents = sanitizeGeminiContents(history, currentParts);

  onProgress(45, 'Menghasilkan respon dari Gemini (Silent Mode)...');

  // Petakan model pilihan user ke model Google GenAI yang valid
  let primaryModel = 'gemini-2.5-flash';
  if (typeof modelId === 'string' && modelId) {
    const raw = modelId.replace(/^gemini\//, '').trim();
    if (raw.includes('pro') || raw.includes('advanced')) primaryModel = 'gemini-2.5-pro';
    else if (raw.includes('lite') || raw.includes('flash-lite')) primaryModel = 'gemini-2.0-flash-lite';
    else if (raw.includes('2.5')) primaryModel = 'gemini-2.5-flash';
    else if (raw.includes('2.0')) primaryModel = 'gemini-2.0-flash';
    else if (raw.includes('1.5')) primaryModel = 'gemini-1.5-flash';
    else primaryModel = 'gemini-2.5-flash';
  }

  const modelsToTry = [primaryModel, 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  const uniqueModels = [...new Set(modelsToTry)];

  let lastError = null;

  for (const model of uniqueModels) {
    try {
      // 1. Coba streaming SSE langsung untuk respon real-time
      const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${cleanKey}&alt=sse`;
      const streamResp = await fetch(streamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      });

      if (streamResp.ok && streamResp.body) {
        const reader = streamResp.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullText = '';
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.replace(/^data:\s*/, '');
              try {
                const parsed = JSON.parse(dataStr);
                const chunkText = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (chunkText) {
                  fullText += chunkText;
                  if (typeof onChunk === 'function') onChunk(fullText);
                }
              } catch (_) {}
            }
          }
        }

        if (fullText.trim()) {
          return fullText.trim();
        }
      } else if (!streamResp.ok) {
        const errJson = await streamResp.json().catch(() => ({}));
        const msg = errJson.error?.message || `HTTP ${streamResp.status}`;

        // Jika error adalah API key invalid/ditolak, langsung hentikan dan laporkan ke user
        if (streamResp.status === 400 && (msg.toLowerCase().includes('api key') || errJson.error?.status === 'INVALID_ARGUMENT')) {
          throw new Error(`API Key Google Gemini tidak valid: "${msg}". Silakan salin API Key asli dari Google AI Studio (dimulai dengan AQ. atau AIza).`);
        }
        if (streamResp.status === 403) {
          if (msg.toLowerCase().includes('denied access')) {
            throw new Error(`Google menolak akses project ('Your project has been denied access'). Project Google Cloud yang terhubung dengan API Key ini dibatasi atau memerlukan verifikasi. Solusi: Buka https://aistudio.google.com/apikey lalu buat API Key baru dengan opsi 'Create API key in new project'.`);
          }
          throw new Error(`Akses Google Gemini ditolak (403): "${msg}". Periksa kuota atau izin API Key Anda.`);
        }
        if (streamResp.status === 401) {
          throw new Error(`Akses Google Gemini ditolak (${streamResp.status}): "${msg}". Periksa keabsahan API Key Anda.`);
        }
        lastError = new Error(`Google API (${model}): ${msg}`);
      }

      // 2. Jika streaming tidak menghasilkan teks, coba generateContent standar
      const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const genResp = await fetch(genUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      });

      if (genResp.ok) {
        const data = await genResp.json();
        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text || '';
        if (text) {
          if (typeof onChunk === 'function') onChunk(text);
          return text;
        }
      } else {
        const errJson = await genResp.json().catch(() => ({}));
        const msg = errJson.error?.message || `HTTP ${genResp.status}`;
        if (genResp.status === 400 && (msg.toLowerCase().includes('api key') || errJson.error?.status === 'INVALID_ARGUMENT')) {
          throw new Error(`API Key Google Gemini tidak valid: "${msg}". Silakan salin API Key asli dari Google AI Studio (dimulai dengan AQ. atau AIza).`);
        }
        if (genResp.status === 403) {
          if (msg.toLowerCase().includes('denied access')) {
            throw new Error(`Google menolak akses project ('Your project has been denied access'). Project Google Cloud yang terhubung dengan API Key ini dibatasi atau memerlukan verifikasi. Solusi: Buka https://aistudio.google.com/apikey lalu buat API Key baru dengan opsi 'Create API key in new project'.`);
          }
          throw new Error(`Akses Google Gemini ditolak (403): "${msg}". Periksa kuota atau izin API Key Anda.`);
        }
        if (genResp.status === 401) {
          throw new Error(`Akses Google Gemini ditolak (${genResp.status}): "${msg}". Periksa kuota atau izin API Key Anda.`);
        }
        lastError = new Error(`Google API (${model}): ${msg}`);
      }
    } catch (e) {
      if (e.message && (e.message.includes('API Key Google Gemini tidak valid') || e.message.includes('Akses Google Gemini ditolak') || e.message.includes('Google menolak akses project'))) {
        throw e;
      }
      lastError = e;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('Gagal mendapatkan respon dari Google Gemini API. Periksa koneksi internet atau coba kembali beberapa saat lagi.');
}

export async function executeGeminiChat({
  apiKey = null,
  model = null,
  prompt,
  history = [],
  referenceAssets = [],
  onProgress = () => {},
  onChunk = () => {},
}) {
  // 1. JIKA MEMILIKI API KEY: JALANKAN 100% SECARA SILENT DI BACKGROUND (SEPERTI WEAVY TANPA BUKA TAB!)
  if (apiKey && typeof apiKey === 'string' && apiKey.trim()) {
    return await executeGeminiDirectApi({
      apiKey: apiKey.trim(),
      modelId: model,
      prompt,
      history,
      referenceAssets,
      onProgress,
      onChunk,
    });
  }

  // If not running in Chrome Extension environment, seamlessly use backend Gemini API
  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) {
    onProgress(30, 'Mengirim ke Google Gemini API...');
    return await executeGeminiApiFallback({ prompt, history, referenceAssets, onChunk });
  }

  try {
    onProgress(15, 'Mempersiapkan tab Google Gemini...');
    const { tab } = await getOrOpenGeminiTab({ openIfMissing: true });
    if (!tab) {
      return await executeGeminiApiFallback({ prompt, history, referenceAssets, onChunk });
    }

    onProgress(25, 'Menghubungkan ke sesi Google Gemini...');
    await waitForGeminiTabReady(tab.id, 8000).catch(() => {});

    // Pre-process reference assets to base64 Data URLs so they can pass cleanly into executeScript
    onProgress(35, 'Menyiapkan lampiran media untuk dipaste ke Gemini...');
    const serializableAssets = await Promise.all(
      (referenceAssets || []).map(async (asset, idx) => {
        let rawSrc = asset.dataUrl || asset.base64 || asset.url || asset.thumbnailUrl || '';
        let dataUrl = '';

        if (typeof rawSrc === 'string' && rawSrc.startsWith('data:')) {
          dataUrl = rawSrc;
        } else if (typeof rawSrc === 'string' && /^[A-Za-z0-9+/=]+$/.test(rawSrc.slice(0, 100))) {
          // Raw base64 string without data: header
          const inferredMime = asset.type || asset.mime || 'image/png';
          dataUrl = `data:${inferredMime};base64,${rawSrc}`;
        } else if (typeof rawSrc === 'string' && rawSrc.startsWith('blob:')) {
          try {
            const res = await fetch(rawSrc).catch(() => null);
            if (res && res.ok) {
              const blob = await res.blob();
              dataUrl = await new Promise((resolve) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.onerror = () => resolve('');
                r.readAsDataURL(blob);
              });
            }
          } catch (e) {
            console.warn('[Gemini Chat] Gagal membaca blob media:', e);
          }
        } else if (typeof rawSrc === 'string' && rawSrc.startsWith('http')) {
          try {
            let res = await fetch(rawSrc).catch(() => null);
            if (!res || !res.ok) {
              res = await fetch(`/api/proxy?url=${encodeURIComponent(rawSrc)}`).catch(() => null);
            }
            if (res && res.ok) {
              const blob = await res.blob();
              dataUrl = await new Promise((resolve) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.onerror = () => resolve('');
                r.readAsDataURL(blob);
              });
            }
          } catch (e) {
            console.warn('[Gemini Chat] Gagal mengonversi link gambar ke Data URL:', e);
          }
        }

        let type = asset.type || asset.mime || 'image/png';
        if (type === 'image' || !type.includes('/')) type = 'image/png';
        if (type === 'video') type = 'video/mp4';
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
          const mimeMatch = dataUrl.match(/^data:([^;]+);/);
          if (mimeMatch && mimeMatch[1]) type = mimeMatch[1];
        }

        const isVid = type.startsWith('video/') || (asset.name && /\.(mp4|mov|webm|avi|mkv)$/i.test(asset.name)) || asset.type === 'video';
        const defaultExt = isVid ? 'mp4' : (type.includes('jpeg') || type.includes('jpg') ? 'jpg' : (type.includes('webp') ? 'webp' : 'png'));
        let name = asset.name || (isVid ? `video_${idx + 1}.${defaultExt}` : `image_${idx + 1}.${defaultExt}`);
        if (!name.includes('.')) {
          name = `${name}.${defaultExt}`;
        }
        if (isVid && !type.startsWith('video/')) {
          type = 'video/mp4';
        }
        return { dataUrl, name, type };
      })
    );

    const validAssets = serializableAssets.filter((a) => a.dataUrl && a.dataUrl.startsWith('data:'));

    onProgress(50, validAssets.length > 0 ? `Mengunggah ${validAssets.length} file media ke Gemini...` : 'Mengirim prompt ke Google Gemini...');

  const injectionResults = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [{ prompt, assets: validAssets }],
    func: async ({ prompt, assets }) => {
      const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));

      try {
        // Otomatis klik tombol "Agree" / "Setuju" / "Lanjutkan" / "Saya Mengerti" jika muncul popup modal consent
        const autoClickConsentOrAgreeButtons = () => {
          try {
            const dialogContainers = Array.from(document.querySelectorAll(
              'mat-dialog-container, [role="dialog"], [role="alertdialog"], dialog, .cdk-overlay-pane, .modal-dialog, gemini-terms-dialog, .terms-dialog, .upload-consent-dialog, .consent-dialog'
            ));

            const isPositiveButton = (btn) => {
              if (!btn || btn.disabled || btn.offsetParent === null) return false;
              const text = (btn.innerText || btn.textContent || btn.getAttribute('aria-label') || '').trim().toLowerCase();
              if (!text) return false;

              const isCancel = text.includes('cancel') || text.includes('batal') || text.includes('jangan') || text.includes('tolak') || text.includes('decline') || text.includes('close') || text.includes('tutup');
              if (isCancel) return false;

              return (
                text.includes('agree') ||
                text.includes('setuju') ||
                text.includes('i agree') ||
                text.includes('saya setuju') ||
                text.includes('lanjutkan') ||
                text.includes('continue') ||
                text.includes('allow') ||
                text.includes('izinkan') ||
                text.includes('got it') ||
                text.includes('mengerti') ||
                text.includes('saya mengerti') ||
                text.includes('accept') ||
                text.includes('terima') ||
                text.includes('aktifkan') ||
                text.includes('enable') ||
                text.includes('konfirmasi') ||
                text.includes('confirm') ||
                text === 'ok' ||
                text === 'oke' ||
                text === 'yes' ||
                text === 'ya'
              );
            };

            for (const container of dialogContainers) {
              const buttons = Array.from(container.querySelectorAll('button, [role="button"], a.btn'));
              for (const btn of buttons) {
                if (isPositiveButton(btn)) {
                  btn.click();
                  return true;
                }
              }
            }

            // Fallback: tombol agree pada overlay umum
            const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
            for (const btn of allButtons) {
              if (isPositiveButton(btn)) {
                btn.click();
                return true;
              }
            }
          } catch (e) {
            console.warn('[Gemini Agree Dialog Error]:', e);
          }
          return false;
        };

        // Cek dialog persetujuan di awal
        autoClickConsentOrAgreeButtons();

        // 1. Cari elemen editor input prompt Gemini
        const findEditor = () => {
          return (
            document.querySelector('rich-textarea .ql-editor') ||
            document.querySelector('div.ql-editor[contenteditable="true"]') ||
            document.querySelector('div[contenteditable="true"]') ||
            document.querySelector('textarea[aria-label*="prompt" i]') ||
            document.querySelector('textarea[placeholder*="tanya" i]') ||
            document.querySelector('textarea[placeholder*="Ask" i]') ||
            document.querySelector('textarea[placeholder*="Minta" i]') ||
            document.querySelector('div[role="textbox"]')
          );
        };

        let editor = findEditor();
        let retryCount = 0;
        while (!editor && retryCount < 12) {
          autoClickConsentOrAgreeButtons();
          await waitMs(500);
          editor = findEditor();
          retryCount++;
        }

        if (!editor) {
          return {
            success: false,
            error: 'Kotak input chat Google Gemini tidak ditemukan. Pastikan kamu sudah login di gemini.google.com.',
          };
        }

        // 2. METODE UPLOAD FILE MEDIA (Primary Method via File Input & Uploader)
        if (Array.isArray(assets) && assets.length > 0) {
          const fileObjects = [];
          for (const item of assets) {
            try {
              if (item.dataUrl && item.dataUrl.startsWith('data:')) {
                const parts = item.dataUrl.split(',');
                if (parts.length === 2) {
                  const mime = parts[0].match(/:(.*?);/)?.[1] || item.type || 'image/png';
                  const binary = atob(parts[1]);
                  const bytes = new Uint8Array(binary.length);
                  for (let b = 0; b < binary.length; b++) bytes[b] = binary.charCodeAt(b);
                  const file = new File([bytes], item.name || 'upload.png', {
                    type: mime,
                    lastModified: Date.now(),
                  });
                  fileObjects.push(file);
                }
              }
            } catch (err) {
              console.warn('[Gemini DOM] Gagal konversi aset ke File:', err);
            }
          }

          if (fileObjects.length > 0) {
            const hasUploadedThumbnails = () => {
              return !!document.querySelector(
                'uploader-file-card, .file-preview-card, .attachment-chip, .image-preview, .uploaded-image, img.preview-image, button[aria-label*="Hapus" i], button[aria-label*="Remove" i], [data-test-id*="image-preview"], [aria-label*="file" i], .preview-card, uploader-card'
              );
            };

            const dt = new DataTransfer();
            fileObjects.forEach((f) => dt.items.add(f));

            let uploaded = false;

            // Step A: Cari atau buka pemilih file via tombol Add (+) / Upload
            let fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
            if (fileInputs.length === 0) {
              const addBtn = (
                document.querySelector('button[aria-label*="Tambahkan" i]') ||
                document.querySelector('button[aria-label*="Add" i]') ||
                document.querySelector('button[aria-label*="Upload" i]') ||
                document.querySelector('button[aria-label*="Buka pemilih" i]') ||
                document.querySelector('button[aria-label*="Lampirkan" i]') ||
                document.querySelector('button[aria-label*="File" i]') ||
                document.querySelector('button.add-button') ||
                document.querySelector('button[mattooltip*="Tambahkan" i]') ||
                document.querySelector('button[mattooltip*="Upload" i]') ||
                document.querySelector('button[mattooltip*="Add" i]') ||
                document.querySelector('.uploader-container button') ||
                document.querySelector('button.upload-button')
              );
              if (addBtn) {
                addBtn.click();
                await waitMs(400);

                // Cek jika muncul menu popup "Unggah file" / "Upload files"
                const menuItems = Array.from(document.querySelectorAll('[role="menuitem"], .mat-mdc-menu-item, button.menu-item, mat-list-item, [role="button"]'));
                const uploadItem = menuItems.find((el) => {
                  const txt = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').toLowerCase();
                  return (txt.includes('unggah') || txt.includes('upload') || txt.includes('komputer') || txt.includes('computer') || txt.includes('file')) && !txt.includes('drive');
                });

                if (uploadItem) {
                  uploadItem.click();
                  await waitMs(400);
                }

                fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
              }
            }

            // Step B: Suntikkan file ke elemen input[type="file"]
            if (fileInputs.length > 0) {
              try {
                const hasVideoFile = fileObjects.some((f) => f.type?.startsWith('video/'));
                const targetInput =
                  fileInputs.find((inp) =>
                    hasVideoFile
                      ? (inp.accept?.includes('video') || inp.accept?.includes('*') || inp.hasAttribute('multiple'))
                      : (inp.accept?.includes('image') || inp.hasAttribute('multiple'))
                  ) || fileInputs[fileInputs.length - 1];

                targetInput.files = dt.files;
                targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                targetInput.dispatchEvent(new Event('change', { bubbles: true }));
                await waitMs(800);
                if (hasUploadedThumbnails()) {
                  uploaded = true;
                }
              } catch (inpErr) {
                console.warn('[Gemini DOM] File input assignment warning:', inpErr);
              }
            }

            // Step C: Fallback Drag & Drop langsung ke area editor jika input file belum merespon
            if (!uploaded && !hasUploadedThumbnails()) {
              try {
                const dropTarget = document.querySelector('rich-textarea') || editor || document.body;
                const dropEvt = new DragEvent('drop', { bubbles: true, cancelable: true, composed: true });
                Object.defineProperty(dropEvt, 'dataTransfer', {
                  value: dt,
                  writable: false,
                  enumerable: true,
                  configurable: true,
                });
                dropTarget.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
                dropTarget.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
                dropTarget.dispatchEvent(dropEvt);
                await waitMs(800);
                if (hasUploadedThumbnails()) {
                  uploaded = true;
                }
              } catch (dropErr) {
                console.warn('[Gemini DOM] Drop fallback warning:', dropErr);
              }
            }

            // Step D: Tunggu kartu thumbnail lampiran muncul & handle auto-agree modal
            let waitChip = 0;
            while (waitChip < 16) {
              autoClickConsentOrAgreeButtons();
              if (hasUploadedThumbnails()) break;
              await waitMs(250);
              waitChip++;
            }

            // Step E: Tunggu jika ada progress bar upload file selesai
            let uploadWaitCount = 0;
            while (uploadWaitCount < 25) {
              autoClickConsentOrAgreeButtons();
              const uploading = document.querySelector('mat-progress-bar, [role="progressbar"], .upload-progress, .loading-spinner, .uploading');
              if (!uploading) break;
              await waitMs(350);
              uploadWaitCount++;
            }
          }
        } else {
          // Bersihkan attachment lama yang mungkin tersisa jika turn ini tidak ada media
          try {
            const staleRemoveBtns = document.querySelectorAll(
              'uploader-file-card button[aria-label*="Hapus" i], uploader-file-card button[aria-label*="Remove" i], .attachment-chip button[aria-label*="Hapus" i], .attachment-chip button[aria-label*="Remove" i]'
            );
            staleRemoveBtns.forEach((btn) => btn.click());
          } catch (_) {}
        }

        // Cek dialog sekali lagi sebelum mengetik prompt
        autoClickConsentOrAgreeButtons();

        // 3. Isi text prompt ke editor
        editor.focus();
        try {
          if (document.execCommand) {
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, prompt);
          }
        } catch (_) {}

        if (editor.isContentEditable) {
          editor.innerHTML = `<p>${prompt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`;
          try {
            editor.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: prompt }));
            editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
          } catch (_) {
            editor.dispatchEvent(new Event('input', { bubbles: true }));
          }
          editor.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          editor.value = prompt;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          editor.dispatchEvent(new Event('change', { bubbles: true }));
        }

        await waitMs(600);

        // 4. Cari tombol send/kirim
        autoClickConsentOrAgreeButtons();
        const findSendBtn = () => {
          return (
            document.querySelector('button[aria-label*="Kirim" i]') ||
            document.querySelector('button[aria-label*="Send" i]') ||
            document.querySelector('button[aria-label*="Submit" i]') ||
            document.querySelector('button.send-button') ||
            document.querySelector('.send-button-container button') ||
            document.querySelector('button[mattooltip*="Send" i]') ||
            document.querySelector('button[mattooltip*="Kirim" i]')
          );
        };

        let sendBtn = findSendBtn();
        if (!sendBtn || sendBtn.disabled) {
          autoClickConsentOrAgreeButtons();
          await waitMs(300);
          sendBtn = findSendBtn();
        }

        if (sendBtn && !sendBtn.disabled) {
          sendBtn.click();
        } else {
          // Fallback tekan Enter
          editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        }

        return { success: true, started: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  });

  const initRes = injectionResults?.[0]?.result;
  if (!initRes || !initRes.success) {
    throw new Error(initRes?.error || 'Gagal mengirim instruksi ke tab Google Gemini.');
  }

  onProgress(65, 'Menunggu tanggapan dari Google Gemini...');

  // 5. Polling & Streaming respon Gemini dari DOM (termasuk teks, gambar Imagen, dan video Veo)
  const maxWaitMs = 600000; // 10 menit maksimal untuk render video Veo / analisis video panjang
  const startWait = Date.now();
  let lastText = '';
  let stableCount = 0;
  let videoGenerationNoticed = false;

  while (Date.now() - startWait < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 750));

    const pollResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        try {
          // Helper: periksa apakah elemen berada di dalam kotak input / bubble pesan user
          const isInsideUserQuery = (el) => {
            if (!el) return false;
            return !!(
              el.closest('user-query, .user-query, [role="user"], rich-textarea, .input-area, form, .ql-editor, .query-container, .user-turn, .user-message')
            );
          };

          // Cari response bubbles / model-response container di Gemini yang murni berasal dari Model (BUKAN query user)
          let responseNodes = Array.from(
            document.querySelectorAll(
              'model-response, .model-response, [role="model"], .model-response-text, .response-container-content, message-content'
            )
          ).filter((node) => !isInsideUserQuery(node));

          if (responseNodes.length === 0) {
            responseNodes = Array.from(document.querySelectorAll('.markdown')).filter((node) => !isInsideUserQuery(node));
          }

          let latestNode = null;
          let rawText = '';

          if (responseNodes.length > 0) {
            latestNode = responseNodes[responseNodes.length - 1];

            // Ambil elemen markdown pesan Gemini yang sebenarnya
            const markdownContainer =
              latestNode.querySelector('.markdown') ||
              (latestNode.classList?.contains('markdown') ? latestNode : null) ||
              latestNode;

            // Clone container agar aman dimodifikasi di memori tanpa merusak tampilan tab Gemini
            const clone = markdownContainer.cloneNode(true);

            // Bersihkan elemen UI, action buttons, feedback thumbs, copy buttons, svg
            clone.querySelectorAll(
              'citation-carousel, sources-carousel, .sources-carousel, .citation-container, .response-feedback, .response-actions, thumbs-up-down, button, svg, mat-icon'
            ).forEach((el) => el.remove());

            // Ubah file-chip / attachment-chip (misal: "WEBP + 1", "JPG") menjadi inline citation badge token "[WEBP + 1]"
            clone.querySelectorAll('file-chip, attachment-chip, .attachment-chip, .file-chip, citation-annotation, [data-test-id*="citation"]').forEach((chip) => {
              const chipText = (chip.innerText || chip.textContent || '').replace(/\s+/g, ' ').trim();
              if (chipText) {
                const textNode = document.createTextNode(` [${chipText}] `);
                chip.replaceWith(textNode);
              } else {
                chip.remove();
              }
            });

            // Parser rekursif DOM Gemini ke Markdown yang rapi & terstruktur
            function convertNodeToMarkdown(node, depth = 0) {
              if (!node) return '';
              if (node.nodeType === Node.TEXT_NODE) {
                return node.nodeValue || '';
              }
              if (node.nodeType !== Node.ELEMENT_NODE) {
                return '';
              }

              const tag = node.tagName.toLowerCase();

              // Abaikan elemen non-konten
              if (['script', 'style', 'button', 'svg', 'noscript', 'meta'].includes(tag)) {
                return '';
              }

              // Code block
              if (tag === 'pre') {
                const codeEl = node.querySelector('code') || node;
                const lang = codeEl.getAttribute('class')?.match(/lang(?:uage)?-([\w-]+)/i)?.[1] || '';
                return `\n\`\`\`${lang}\n${codeEl.textContent.trim()}\n\`\`\`\n\n`;
              }
              if (tag === 'code') {
                return `\`${node.textContent}\``;
              }

              // Headers: h1-h6
              if (/^h[1-6]$/.test(tag)) {
                const level = parseInt(tag[1], 10);
                const prefix = '#'.repeat(level);
                const text = Array.from(node.childNodes).map((c) => convertNodeToMarkdown(c, depth)).join('').trim();
                return `\n\n${prefix} ${text}\n\n`;
              }

              // Bold / Strong
              if (tag === 'strong' || tag === 'b') {
                const text = Array.from(node.childNodes).map((c) => convertNodeToMarkdown(c, depth)).join('').trim();
                return text ? `**${text}**` : '';
              }

              // Italic / Em
              if (tag === 'em' || tag === 'i') {
                const text = Array.from(node.childNodes).map((c) => convertNodeToMarkdown(c, depth)).join('').trim();
                return text ? `*${text}*` : '';
              }

              // Paragraph
              if (tag === 'p') {
                const text = Array.from(node.childNodes).map((c) => convertNodeToMarkdown(c, depth)).join('').trim();
                return text ? `\n\n${text}\n\n` : '';
              }

              // Blockquote
              if (tag === 'blockquote') {
                const text = Array.from(node.childNodes).map((c) => convertNodeToMarkdown(c, depth)).join('').trim();
                return `\n\n> ${text.replace(/\n/g, '\n> ')}\n\n`;
              }

              // Unordered list
              if (tag === 'ul') {
                const items = Array.from(node.children).filter((c) => c.tagName.toLowerCase() === 'li');
                const bulletChar = depth > 0 ? 'o' : '•';
                const indent = '  '.repeat(depth);
                const content = items
                  .map((li) => {
                    const liText = Array.from(li.childNodes).map((c) => convertNodeToMarkdown(c, depth + 1)).join('').trim();
                    return `${indent}${bulletChar} ${liText}`;
                  })
                  .join('\n');
                return `\n${content}\n`;
              }

              // Ordered list
              if (tag === 'ol') {
                const items = Array.from(node.children).filter((c) => c.tagName.toLowerCase() === 'li');
                const indent = '  '.repeat(depth);
                const content = items
                  .map((li, idx) => {
                    const liText = Array.from(li.childNodes).map((c) => convertNodeToMarkdown(c, depth + 1)).join('').trim();
                    return `${indent}${idx + 1}. ${liText}`;
                  })
                  .join('\n');
                return `\n${content}\n`;
              }

              // Standalone list item
              if (tag === 'li') {
                const indent = '  '.repeat(depth);
                const liText = Array.from(node.childNodes).map((c) => convertNodeToMarkdown(c, depth)).join('').trim();
                return `${indent}• ${liText}\n`;
              }

              // Table parsing
              if (tag === 'table') {
                const rows = Array.from(node.querySelectorAll('tr'));
                if (rows.length === 0) return '';
                const tableMd = [];
                let hasHeader = false;

                rows.forEach((row, rIdx) => {
                  const cells = Array.from(row.querySelectorAll('th, td'));
                  const rowContent = cells.map((cell) => convertNodeToMarkdown(cell, 0).replace(/\n/g, ' ').trim()).join(' | ');
                  tableMd.push(`| ${rowContent} |`);

                  if (rIdx === 0 && row.querySelector('th')) {
                    hasHeader = true;
                    const sep = cells.map(() => '---').join(' | ');
                    tableMd.push(`| ${sep} |`);
                  }
                });

                if (!hasHeader && tableMd.length > 1) {
                  const firstCells = Array.from(rows[0].querySelectorAll('th, td'));
                  const sep = firstCells.map(() => '---').join(' | ');
                  tableMd.splice(1, 0, `| ${sep} |`);
                }

                return `\n\n${tableMd.join('\n')}\n\n`;
              }

              // Line break
              if (tag === 'br') {
                return '\n';
              }

              // Fallback: general child concatenation
              return Array.from(node.childNodes).map((c) => convertNodeToMarkdown(c, depth)).join('');
            }

            try {
              rawText = convertNodeToMarkdown(clone).trim();
            } catch (err) {
              console.warn('[Gemini Markdown Extractor Warn]:', err);
            }

            // Fallback jika konversi DOM kosong
            if (!rawText) {
              rawText = (clone.innerText || clone.textContent || latestNode.innerText || '').trim();
            }

            // Bersihkan baris kosong ganda berlebih
            rawText = rawText.replace(/\n{3,}/g, '\n\n');
          } else {
            const pNodes = Array.from(document.querySelectorAll('model-response p, .model-response p, .model-response-text p')).filter(node => !isInsideUserQuery(node));
            if (pNodes.length > 0) {
              rawText = pNodes.map((p) => p.innerText || p.textContent).join('\n\n').trim();
              latestNode = document.querySelector('model-response, .model-response');
            }
          }

          // Filter out outbound system instruction leaks if accidentally captured
          if (rawText && (/^\[System Instruction:/i.test(rawText) || /^\[RIWAYAT LENGKAP PERCAKAPAN/i.test(rawText) || /^\[PANDUAN REFERENSI MEDIA\]/i.test(rawText))) {
            const userMarkerIdx = rawText.search(/\[Instruksi User(?: Saat Ini)?\]:\s*/i);
            if (userMarkerIdx >= 0) {
              const afterPrompt = rawText.slice(userMarkerIdx).replace(/^\[Instruksi User(?: Saat Ini)?\]:\s*[^\n]*\n*/i, '').trim();
              const parts = afterPrompt.split(/\n\s*\n/);
              if (parts.length > 1) {
                rawText = parts.slice(1).join('\n\n').trim();
              } else {
                rawText = '';
              }
            } else {
              rawText = '';
            }
          }

          if (rawText) {
            rawText = rawText.replace(/^\[Instruksi User(?: Saat Ini)?\]:\s*[^\n]*\n+/i, '').trim();
          }

          if (!latestNode && !rawText) {
            return { text: '', isDone: false, isStillGenerating: true };
          }

          const searchContainer = latestNode?.closest('model-response') || latestNode?.parentElement || latestNode || document;

          // 1. Ekstrak Video Hasil Render AI (Veo / Gemini Video Player)
          const videoElements = Array.from(
            searchContainer.querySelectorAll(
              'video, video-player video, .generated-video video, [data-test-id*="video"] video, .video-container video, .player-container video'
            )
          );

          const videoUrls = [];
          let isVideoFullyReady = false;

          for (const vid of videoElements) {
            let vSrc = vid.getAttribute('src') || vid.src || '';
            if (!vSrc) {
              const sourceEl = vid.querySelector('source');
              if (sourceEl) {
                vSrc = sourceEl.getAttribute('src') || sourceEl.src || '';
              }
            }
            if (!vSrc) continue;

            // Pastikan video sudah memiliki data (bukan sekadar placeholder kosong saat loading)
            const hasVideoLoaded = (vid.readyState >= 2) || (vid.duration > 0 && !isNaN(vid.duration)) || (vid.videoWidth > 0);

            // Jika URL berupa blob: di tab Gemini, fetch dan konversi ke Data URL MP4 murni (HD tanpa watermark)
            if (vSrc.startsWith('blob:')) {
              try {
                const blobRes = await fetch(vSrc);
                if (blobRes.ok) {
                  const blobData = await blobRes.blob();
                  // Video MP4 Veo yang sudah selesai minimal berukuran > 50KB
                  if (blobData && blobData.size > 40000) {
                    const dataUrl = await new Promise((resolve) => {
                      const fr = new FileReader();
                      fr.onload = () => resolve(fr.result);
                      fr.onerror = () => resolve('');
                      fr.readAsDataURL(blobData);
                    });

                    if (dataUrl && dataUrl.startsWith('data:video/')) {
                      videoUrls.push(dataUrl);
                      isVideoFullyReady = true;
                    }
                  }
                }
              } catch (_) {}
            } else if (vSrc.startsWith('http')) {
              videoUrls.push(vSrc);
              if (hasVideoLoaded) isVideoFullyReady = true;
            }
          }

          // Fallback ekstraksi link download video MP4 direct jika video tag belum selesai
          if (videoUrls.length === 0) {
            const downloadLinks = Array.from(
              searchContainer.querySelectorAll(
                'a[href*=".mp4"], a[href*="googleusercontent.com/video"], a[download*=".mp4"], a[aria-label*="download" i][href*="video"]'
              )
            );
            for (const dl of downloadLinks) {
              const href = dl.getAttribute('href') || dl.href;
              if (href && !videoUrls.includes(href)) {
                videoUrls.push(href);
                isVideoFullyReady = true;
              }
            }
          }

          // 2. Ekstrak Gambar yang Dihasilkan AI (Imagen)
          const imgElements = Array.from(
            searchContainer.querySelectorAll(
              'img[src*="googleusercontent.com"], img[src*="blob:"], img[src*="data:"], .generated-image img, picture img, image-viewer img, .image-container img, img.image, img.generated-image'
            )
          ).filter((img) => {
            const src = img.getAttribute('src') || img.src || '';
            if (!src || src.includes('favicon') || src.includes('sparkle') || src.includes('avatar') || src.includes('icon') || src.includes('gstatic.com/lamda')) {
              return false;
            }
            const width = img.naturalWidth || img.width || parseInt(img.getAttribute('width') || '0', 10);
            const height = img.naturalHeight || img.height || parseInt(img.getAttribute('height') || '0', 10);
            if ((width > 0 && width < 80) || (height > 0 && height < 80)) {
              return false;
            }
            return true;
          });

          const imageUrls = [];
          for (const img of imgElements) {
            let src = img.getAttribute('src') || img.src;
            if (!src) continue;

            if (src.startsWith('blob:')) {
              try {
                const blobRes = await fetch(src);
                const blobData = await blobRes.blob();
                src = await new Promise((resolve) => {
                  const fr = new FileReader();
                  fr.onload = () => resolve(fr.result);
                  fr.onerror = () => resolve(src);
                  fr.readAsDataURL(blobData);
                });
              } catch (_) {}
            }
            if (src && !imageUrls.includes(src)) {
              imageUrls.push(src);
            }
          }

          // Cek status generating & streaming: tombol stop, progress bar, atau typing indicator
          const isStillGeneratingText = !!(
            document.querySelector('button[aria-label*="Hentikan" i]') ||
            document.querySelector('button[aria-label*="Stop" i]') ||
            document.querySelector('button[aria-label*="Jeda" i]') ||
            document.querySelector('button.stop-button') ||
            document.querySelector('button[data-test-id*="stop"]') ||
            document.querySelector('button[mattooltip*="Stop" i]') ||
            document.querySelector('button[mattooltip*="Hentikan" i]') ||
            document.querySelector('.is-streaming') ||
            document.querySelector('.typing-cursor') ||
            document.querySelector('.streaming-indicator') ||
            document.querySelector('mat-progress-bar') ||
            document.querySelector('.sparkle.animating')
          );

          const lowerText = rawText.toLowerCase();
          const isVideoNotice = (
            lowerText.includes("i'm generating your video") ||
            lowerText.includes('generating your video') ||
            lowerText.includes('generating video') ||
            lowerText.includes('membuat video') ||
            lowerText.includes('video anda') ||
            lowerText.includes('creating your video') ||
            lowerText.includes('proses ini dapat memerlukan waktu') ||
            lowerText.includes('this could take a few minutes') ||
            lowerText.includes('video sedang diproses')
          );

          // Video loader dianggap masih berjalan jika ada notice video tetapi video belum siap / belum ada URL valid
          const isGeneratingVideoLoader = (isVideoNotice && (!isVideoFullyReady || videoUrls.length === 0)) || !!searchContainer.querySelector(
            'video-player.loading, .video-placeholder, .video-generating, [aria-label*="generating video" i], [data-test-id*="video-loading"]'
          );

          const isGeneratingImageLoader = !!searchContainer.querySelector(
            'mat-progress-bar, [role="progressbar"], .loading, .generating, .shimmer, .loading-spinner, .image-placeholder'
          ) || ((lowerText.includes('membuat gambar') || lowerText.includes('creating your image')) && imageUrls.length === 0);

          let combinedText = rawText;

          // Format hasil video
          if (videoUrls.length > 0 && isVideoFullyReady) {
            combinedText = combinedText
              .replace(/I'm generating your video[^\n]*/gi, '')
              .replace(/Generating your video[^\n]*/gi, '')
              .replace(/Saya sedang membuat video Anda[^\n]*/gi, '')
              .replace(/Proses ini dapat memerlukan waktu beberapa menit[^\n]*/gi, '')
              .replace(/This could take a few minutes[^\n]*/gi, '')
              .replace(/jadi periksa kembali untuk melihat apakah video Anda sudah siap\.?/gi, '')
              .replace(/\b\d+:\d+\s*\/\s*\d+:\d+\b/gi, '')
              .trim();

            const videoMarkdown = videoUrls.map((url) => `\n\n[weavy_repost_video:${url}]\n`).join('');
            combinedText = combinedText ? `${combinedText}\n${videoMarkdown}` : videoMarkdown.trim();
          }

          // Format hasil gambar
          if (imageUrls.length > 0) {
            if (combinedText.toLowerCase().includes('membuat gambar anda') || combinedText.toLowerCase().includes('creating your image')) {
              combinedText = combinedText.replace(/membuat gambar anda[^\n]*/i, '').replace(/creating your image[^\n]*/i, '').trim();
            }

            const imageMarkdown = imageUrls.map((url) => `\n\n![Gambar Gemini](${url})\n`).join('');
            combinedText = combinedText ? `${combinedText}\n${imageMarkdown}` : imageMarkdown.trim();
          }

          const isStillGenerating = isStillGeneratingText || isGeneratingImageLoader || isGeneratingVideoLoader;
          const isDone = !isStillGenerating && (combinedText.length > 0 || videoUrls.length > 0 || imageUrls.length > 0);

          return {
            text: combinedText,
            isDone,
            isStillGenerating,
            isGeneratingVideo: isGeneratingVideoLoader,
            hasVideos: videoUrls.length > 0,
            hasImages: imageUrls.length > 0,
          };
        } catch (e) {
          return { text: '', isDone: false, error: e.message };
        }
      },
    });

    const poll = pollResults?.[0]?.result;
    if (poll) {
      if (poll.isGeneratingVideo && !videoGenerationNoticed) {
        videoGenerationNoticed = true;
        onProgress(75, 'Google Gemini sedang merender video Anda (proses Veo membutuhkan 1-2 menit)...');
      }

      if (poll.text) {
        if (poll.text !== lastText) {
          lastText = poll.text;
          stableCount = 0;
          onChunk(poll.text);
        } else {
          stableCount++;
        }

        // Jangan berhenti polling jika video atau gambar masih dalam proses render
        if (poll.isDone && !poll.isStillGenerating && stableCount >= 4) {
          break;
        }
      }
    }
  }

  if (!lastText) {
    onProgress(80, 'Mencoba fallback ke Google Gemini API...');
    return await executeGeminiApiFallback({ prompt, history, referenceAssets, onChunk });
  }

  return lastText;
} catch (err) {
  console.warn('[Gemini Chat Tab Error]:', err?.message, 'Mencoba fallback Gemini API...');
  return await executeGeminiApiFallback({ prompt, history, referenceAssets, onChunk });
}
}
