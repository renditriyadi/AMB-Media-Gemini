// gemini-generation.js - Google Gemini (gemini.google.com) Web Automation & Chat Bridge

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assetToBytes(asset) {
  const nestedAsset = asset?.weavyAsset || asset?.asset || asset;
  const src =
    asset?.dataUrl ||
    asset?.base64 ||
    asset?.asset?.dataUrl ||
    nestedAsset?.dataUrl ||
    nestedAsset?.base64 ||
    nestedAsset?.url ||
    nestedAsset?.downloadUrl ||
    nestedAsset?.thumbnailUrl ||
    asset?.url ||
    asset?.thumbnailUrl;
  let filename = asset?.name || asset?.asset?.name || asset?.weavyAsset?.name || 'reference.jpg';
  let mime = 'image/jpeg';
  let ext = '.jpg';

  if (typeof src === 'string' && src.startsWith('data:')) {
    const parts = src.split(',');
    mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    ext = mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg';
    const binary = atob(parts[1]);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { bytes, mime, ext, filename, dataUrl: src };
  }

  if (typeof src === 'string' && src.startsWith('http')) {
    const res = await fetch(src);
    const buf = await res.arrayBuffer();
    mime = res.headers.get('content-type') || 'image/jpeg';
    ext = mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg';
    return { bytes: new Uint8Array(buf), mime, ext, filename, dataUrl: src };
  }

  throw new Error('Format gambar referensi tidak valid.');
}

function ensureImageFilename(name, ext = '.jpg', mime = 'image/jpeg') {
  if (name && /\.(png|jpe?g|webp|gif)$/i.test(name)) return name;
  const base = (name || 'image').replace(/\.[^.]+$/, '');
  const finalExt = ext || (mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg');
  return `${base}${finalExt}`;
}

export async function getOrOpenGeminiTab(userEmail = '') {
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    throw new Error('Eksekusi tab Gemini memerlukan Google Chrome Extension environment.');
  }

  const allTabs = await chrome.tabs.query({});
  let targetTab = null;

  if (userEmail) {
    targetTab = allTabs.find((t) => t.url && /gemini\.google\.com/i.test(t.url) && t.url.includes(encodeURIComponent(userEmail)));
  }

  if (!targetTab) {
    targetTab = allTabs.find((t) => t.active && t.url && /gemini\.google\.com/i.test(t.url))
      || allTabs.find((t) => t.url && /gemini\.google\.com/i.test(t.url));
  }

  if (targetTab?.id) {
    return { tab: targetTab, isNew: false };
  }

  const targetUrl = userEmail 
    ? `https://gemini.google.com/app?authuser=${encodeURIComponent(userEmail)}`
    : 'https://gemini.google.com/app';

  const newTab = await chrome.tabs.create({ url: targetUrl, active: false });
  await waitForGeminiTabReady(newTab.id, 12000);
  return { tab: newTab, isNew: true };
}

async function waitForGeminiTabReady(tabId, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const tabInfo = await chrome.tabs.get(tabId);
      if (tabInfo.status === 'complete') {
        await waitMs(1000);
        return true;
      }
    } catch (_) {}
    await waitMs(400);
  }
  return true;
}

export async function executeGeminiChat({
  prompt,
  model = 'gemini-2.5-flash',
  referenceAssets = [],
  conversationId = null,
  userEmail = '',
  onProgress = () => {},
  onChunk = () => {},
}) {
  onProgress(15, 'Mencari tab Google Gemini di browser...');
  const { tab } = await getOrOpenGeminiTab(userEmail);

  if (!tab || !tab.id) {
    throw new Error('Gagal membuka atau menemukan tab Google Gemini.');
  }

  // Pre-process reference files
  const referenceFiles = [];
  const seenKeys = new Set();
  for (const asset of (referenceAssets || []).filter((item) => item?.type !== 'video').slice(0, 3)) {
    try {
      const parsed = await assetToBytes(asset);
      const key = `${parsed.bytes?.length || 0}_${parsed.dataUrl?.slice(0, 40)}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        referenceFiles.push({
          name: ensureImageFilename(parsed.filename, parsed.ext, parsed.mime),
          dataUrl: parsed.dataUrl,
        });
      }
    } catch (err) {
      console.warn('[Gemini-Chat] Gagal memproses gambar referensi:', err);
    }
  }

  onProgress(30, 'Menyiapkan prompt ke editor Google Gemini...');

  const injectionResult = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async (taskPrompt, targetModel, taskRefImages, targetConvId) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));

      function triggerClick(element) {
        if (!element) return;
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evtName) => {
          element.dispatchEvent(new MouseEvent(evtName, { bubbles: true, cancelable: true, view: window }));
        });
      }

      // 1. Cek editor input prompt di Gemini
      const findEditor = () => {
        return (
          document.querySelector('rich-textarea .ql-editor[contenteditable="true"]') ||
          document.querySelector('rich-textarea [contenteditable="true"]') ||
          document.querySelector('div.ql-editor[contenteditable="true"]') ||
          document.querySelector('[contenteditable="true"][aria-label*="prompt" i]') ||
          document.querySelector('[contenteditable="true"][aria-label*="message" i]') ||
          document.querySelector('textarea[aria-label*="prompt" i]') ||
          document.querySelector('textarea')
        );
      };

      let editor = findEditor();
      for (let i = 0; i < 15 && !editor; i++) {
        await wait(500);
        editor = findEditor();
      }

      if (!editor) {
        return { success: false, error: 'Editor input Google Gemini tidak ditemukan. Pastikan halaman sudah selesai memuat.' };
      }

      // 2. Snapshot pesan sebelum kirim
      const preResponses = Array.from(document.querySelectorAll('model-response, .model-response-text, message-content, .response-container'));
      const preCount = preResponses.length;

      // 3. Masukkan teks prompt
      editor.focus();
      if (editor.isContentEditable) {
        editor.innerHTML = `<p>${taskPrompt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`;
      } else {
        editor.value = taskPrompt;
      }
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
      await wait(300);

      // 4. Unggah gambar jika ada referensi
      if (taskRefImages && taskRefImages.length > 0) {
        const dataTransfer = new DataTransfer();
        for (let idx = 0; idx < taskRefImages.length; idx++) {
          const item = taskRefImages[idx];
          const parts = (item.dataUrl || '').split(',');
          if (parts.length !== 2) continue;
          const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
          const binary = atob(parts[1]);
          const bytes = new Uint8Array(binary.length);
          for (let b = 0; b < binary.length; b++) bytes[b] = binary.charCodeAt(b);
          dataTransfer.items.add(new File([bytes], item.name || `image_${idx + 1}.jpg`, { type: mime }));
        }

        if (dataTransfer.files.length > 0) {
          let attached = false;
          const fileInput = document.querySelector('input[type="file"]');
          if (fileInput) {
            try {
              fileInput.files = dataTransfer.files;
              fileInput.dispatchEvent(new Event('input', { bubbles: true }));
              fileInput.dispatchEvent(new Event('change', { bubbles: true }));
              attached = true;
            } catch (_) {}
          }

          if (!attached) {
            try {
              const pasteEvt = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: dataTransfer,
              });
              editor.dispatchEvent(pasteEvt);
            } catch (_) {}
          }

          // Tunggu sebentar untuk thumbnail upload muncul
          await wait(1000);
        }
      }

      // 5. Cari tombol send
      const findSendBtn = () => {
        const direct = document.querySelector('button.send-button') ||
          document.querySelector('button[aria-label*="Send message" i]') ||
          document.querySelector('button[aria-label*="Kirim pesan" i]') ||
          document.querySelector('button[aria-label*="Send prompt" i]') ||
          document.querySelector('button[aria-label*="Kirim" i]') ||
          document.querySelector('button[aria-label*="Send" i]');
        if (direct && !direct.disabled) return direct;

        const allButtons = Array.from(document.querySelectorAll('button'));
        return allButtons.find((btn) => {
          const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
          const cls = (btn.className || '').toLowerCase();
          const isSend = aria.includes('send') || aria.includes('kirim') || cls.includes('send-button');
          return isSend && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true';
        });
      };

      let sendBtn = findSendBtn();
      for (let s = 0; s < 10 && !sendBtn; s++) {
        await wait(200);
        sendBtn = findSendBtn();
      }

      if (sendBtn) {
        triggerClick(sendBtn);
      } else {
        editor.dispatchEvent(new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
        }));
      }

      return {
        success: true,
        preCount,
        sentTimestamp: Date.now(),
      };
    },
    args: [prompt, model, referenceFiles, conversationId],
  });

  const sendRes = injectionResult?.[0]?.result;
  if (!sendRes || !sendRes.success) {
    throw new Error(sendRes?.error || 'Gagal mengirim pesan ke Google Gemini tab.');
  }

  onProgress(50, 'Menunggu respons dari Google Gemini...');
  onChunk('[chat_typing_loader]');

  // Polling stream respons dari Google Gemini
  const startTime = Date.now();
  let lastText = '';
  let stableCount = 0;
  const initialCount = sendRes.preCount || 0;

  while (Date.now() - startTime < 120000) {
    await waitMs(400);

    let pollRes = null;
    try {
      const pollExec = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (preCount) => {
          // Cari tombol Stop response / indikator loading
          const stopBtn = document.querySelector('button[aria-label*="Stop response" i]') ||
            document.querySelector('button[aria-label*="Hentikan" i]') ||
            document.querySelector('button[aria-label*="Stop" i]');
          
          const isGenerating = Boolean(
            stopBtn || 
            document.querySelector('.sparkle-container, .loading, [aria-label*="loading" i], .model-response-loading')
          );

          // Cari elemen respons model
          const responses = Array.from(document.querySelectorAll('model-response, .model-response-text, message-content, .response-container'));
          let targetEl = null;

          if (responses.length > preCount) {
            targetEl = responses[responses.length - 1];
          } else if (responses.length > 0) {
            targetEl = responses[responses.length - 1];
          }

          let responseText = '';
          if (targetEl) {
            // Ambil dari markdown container jika ada
            const markdownEl = targetEl.querySelector('.markdown, [class*="markdown"], .message-content') || targetEl;
            responseText = (markdownEl.innerText || markdownEl.textContent || '').trim();

            // Ekstrak video Veo jika ada
            const vids = Array.from(targetEl.querySelectorAll('video, video-player video, [data-test-id*="video"] video'));
            vids.forEach((v) => {
              const src = v.getAttribute('src') || v.src || v.querySelector('source')?.getAttribute('src') || '';
              if (src) {
                responseText = responseText.replace(/Saya sedang membuat video Anda[^\n]*/gi, '').trim();
                responseText += `\n\n[weavy_repost_video:${src}]\n`;
              }
            });

            // Ekstrak gambar Imagen jika ada
            const imgs = Array.from(targetEl.querySelectorAll('img[src*="googleusercontent.com"], img[src*="blob:"], .generated-image img'));
            imgs.forEach((img) => {
              const src = img.getAttribute('src') || img.src || '';
              if (src && !src.includes('avatar') && !src.includes('favicon')) {
                responseText += `\n\n![Gambar Gemini](${src})\n`;
              }
            });
          }

          return {
            isGenerating,
            responseText,
            responsesCount: responses.length,
          };
        },
        args: [initialCount],
      });
      pollRes = pollExec?.[0]?.result;
    } catch (e) {
      console.warn('[Gemini Poll Error]:', e);
    }

    if (!pollRes) continue;

    const currentText = pollRes.responseText || '';
    const isGenerating = pollRes.isGenerating;

    if (currentText && currentText !== lastText) {
      lastText = currentText;
      stableCount = 0;
      onChunk(currentText);
    } else if (currentText && currentText === lastText) {
      stableCount++;
    }

    // Jika sudah tidak generating dan teks stabil minimal 3 iterasi, atau ada teks dan tombol stop hilang
    if (!isGenerating && currentText && stableCount >= 3) {
      onProgress(100, 'Respons Gemini selesai.');
      return currentText;
    }

    // Fallback jika respons sangat panjang dan stop button hilang
    if (!isGenerating && currentText.length > 50 && stableCount >= 4) {
      onProgress(100, 'Respons Gemini selesai.');
      return currentText;
    }
  }

  if (lastText) {
    return lastText;
  }

  throw new Error('Timeout menunggu jawaban dari Google Gemini (120 detik). Cek tab Gemini browser Anda.');
}
