function getFlowTabs() {
  if (typeof chrome === 'undefined' || !chrome.tabs) return [];
  return chrome.tabs.query({ url: ['*://flow.google.com/*', '*://*.flow.google.com/*'] });
}

async function executeInFlowTab(tabId, func, args = [], world = 'ISOLATED') {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await chrome.scripting.executeScript({
        target: { tabId },
        func,
        args,
        world,
      });
    } catch (error) {
      const message = String(error?.message || error);
      const transientFrameError = /Frame with ID \d+ was removed|Cannot access contents of the page/i.test(message);
      if (!transientFrameError || attempt === 1) throw error;
      console.warn('[weavy-flow] frame berubah saat Flow reload, retry executeScript:', message);
      await wait(500);
    }
  }

  throw new Error('Flow script gagal dijalankan setelah retry.');
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function readFlowReferenceFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => file?.type?.startsWith('image/'));
  return Promise.all(files.map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: `flow_ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      base64: reader.result,
      asset: {
        name: file.name,
        dataUrl: reader.result,
      },
      isUploading: false,
      showCheckmark: true,
      error: null,
    });
    reader.onerror = () => reject(new Error(`File reference ${file.name} gagal dibaca.`));
    reader.readAsDataURL(file);
  })));
}

async function assetToDataUrl(asset) {
  const source = asset?.dataUrl || asset?.base64 || asset?.thumbnailUrl || asset?.url;
  if (!source) return null;
  if (source.startsWith('data:')) return source;

  const response = await fetch(source);
  if (!response.ok) throw new Error(`Reference image gagal diambil (${response.status}).`);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Reference image gagal dibaca.'));
    reader.readAsDataURL(blob);
  });
}

async function waitForFlowProject(tabId, timeout = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || !/flow\.google\.com\/project\//i.test(tab.url)) {
      await wait(250);
      continue;
    }

    const editorReady = await executeInFlowTab(tabId, () => {
      const editorSelector = '[contenteditable="true"].ProseMirror, [contenteditable="true"], .tiptap, textarea, div[role="textbox"], [data-slate-editor="true"]';
      return Boolean(document.querySelector(editorSelector));
    }, [], 'MAIN');
    if (editorReady?.[0]?.result) return tab;

    if (Date.now() - startedAt > 25000) {
      console.warn('[weavy-flow][project] URL project sudah aktif tetapi editor belum siap:', tab.url);
    }
    await wait(250);
  }
  throw new Error('Editor project Google Flow belum siap.');
}

async function ensureFlowProject(tabId) {
  const currentTab = await chrome.tabs.get(tabId);
  if (currentTab.url && /flow\.google\.com\/project\//i.test(currentTab.url)) {
    return waitForFlowProject(tabId);
  }

  const navigationResult = await executeInFlowTab(tabId, async () => {
    const startedAt = Date.now();
    const timeout = 30000;
    const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

    while (Date.now() - startedAt < timeout) {
      const projectLinks = [...document.querySelectorAll('a[href^="/project/"]')]
        .filter((link) => /^\/project\/[^/?#]+/.test(new URL(link.href, location.href).pathname));
      const newProjectButton = [...document.querySelectorAll('button')]
        .find((button) => /new project|create project|proyek baru/i.test((button.innerText || '').trim()));

      console.log('[weavy-flow][project] cek halaman home:', {
        projectCount: projectLinks.length,
        hasNewProjectButton: Boolean(newProjectButton),
      });

      if (projectLinks[0]) {
        const projectUrl = projectLinks[0].href;
        console.log('[weavy-flow][project] klik project existing dari home:', projectUrl);
        projectLinks[0].dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        }));
        return { action: 'existing', projectUrl };
      }

      if (newProjectButton) {
        console.log('[weavy-flow][project] klik New project');
        newProjectButton.click();
        return { action: 'new' };
      }

      await sleep(250);
    }

    return { action: null };
  }, [], 'MAIN');

  const navigation = navigationResult?.[0]?.result;
  if (!navigation?.action) {
    console.error('[weavy-flow][project] project atau tombol New project tidak ditemukan setelah 30 detik');
    throw new Error('Tombol New project atau daftar project Google Flow tidak ditemukan.');
  }

  console.log('[weavy-flow][project] navigasi dimulai:', navigation);
  return waitForFlowProject(tabId);
}

async function clickFlowStartGeneration(tabId) {
  const buttonResult = await executeInFlowTab(tabId, () => {
    const button = document.querySelector('button.generate-icon-button')
      || document.querySelector('flow-generate-icon-button button')
      || document.querySelector('button[aria-label="Mulai pembuatan"]')
      || document.querySelector('button[aria-label="Start generation"]')
      || document.querySelector('button[type="submit"]')
      || document.querySelector('button[aria-label*="generation" i]')
      || document.querySelector('button[aria-label*="Generate" i]')
      || document.querySelector('button[aria-label*="buat" i]')
      || [...document.querySelectorAll('button')].find((element) => /start generation|mulai pembuatan|generate|create|buat/i.test(`${element.getAttribute('aria-label') || ''} ${element.innerText || ''}`));
    if (!button) return null;
    if (button.disabled) {
      button.disabled = false;
      button.removeAttribute('disabled');
      button.classList.remove('mat-mdc-button-disabled');
    }
    const rect = button.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, [], 'MAIN');
  const point = buttonResult?.[0]?.result;

  // Coba gunakan Chrome Debugger API untuk click presisi level OS
  let debuggerSucceeded = false;
  if (point) {
    const debuggerTarget = { tabId };
    try {
      await chrome.debugger.attach(debuggerTarget, '1.3');
      try {
        await chrome.debugger.sendCommand(debuggerTarget, 'Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: point.x,
          y: point.y,
        });
        await chrome.debugger.sendCommand(debuggerTarget, 'Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: point.x,
          y: point.y,
          button: 'left',
          clickCount: 1,
        });
        await chrome.debugger.sendCommand(debuggerTarget, 'Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: point.x,
          y: point.y,
          button: 'left',
          clickCount: 1,
        });
        debuggerSucceeded = true;
      } finally {
        await chrome.debugger.detach(debuggerTarget).catch(() => {});
      }
    } catch (dbgErr) {
      console.warn('[weavy-flow] Debugger click warning (falling back to DOM synthetic click):', dbgErr);
    }
  }

  // Fallback ke synthetic DOM click + pointer events + Enter keypress jika debugger tidak berjalan
  await executeInFlowTab(tabId, () => {
    const button = document.querySelector('button.generate-icon-button')
      || document.querySelector('flow-generate-icon-button button')
      || document.querySelector('button[aria-label="Mulai pembuatan"]')
      || document.querySelector('button[aria-label="Start generation"]')
      || document.querySelector('button[type="submit"]')
      || document.querySelector('button[aria-label*="generation" i]')
      || document.querySelector('button[aria-label*="Generate" i]')
      || document.querySelector('button[aria-label*="buat" i]')
      || [...document.querySelectorAll('button')].find((element) => /start generation|mulai pembuatan|generate|create|buat/i.test(`${element.getAttribute('aria-label') || ''} ${element.innerText || ''}`));
    const editor = document.querySelector('[contenteditable="true"].ProseMirror, [contenteditable="true"]');

    if (button) {
      button.disabled = false;
      button.removeAttribute('disabled');
      button.classList.remove('mat-mdc-button-disabled');
      button.focus();
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      button.click();
      button.closest('form')?.requestSubmit?.();
    }

    if (editor) {
      editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
      editor.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
      editor.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    }
  }, [], 'MAIN');
}

async function executeFlowGeneration({
  prompt,
  model,
  aspectRatio = '1:1',
  resolution = '1K',
  mode = 'image',
  videoType = 'Ingredients',
  videoDuration = '8s',
  referenceAssets = [],
  onProgress,
} = {}) {
  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) {
    throw new Error('Flow hanya bisa digunakan dari Chrome extension runtime.');
  }

  let tabs = await getFlowTabs();
  if (!tabs.length) {
    const newTab = await chrome.tabs.create({ url: 'https://flow.google.com/', active: false });
    if (typeof newTab.id !== 'number') {
      throw new Error('Tab Google Flow gagal dibuka.');
    }
    tabs = [newTab];
  }

  const targetTab = tabs.find((tab) => tab.active) || tabs[0];
  if (typeof targetTab.id !== 'number') {
    throw new Error('Tab Google Flow tidak memiliki target yang valid.');
  }

  await ensureFlowProject(targetTab.id);
  onProgress?.(10, `Menyiapkan pengaturan ${mode === 'video' ? 'video' : 'gambar'} Google Flow...`);

  const referenceDataUrls = [];
  for (const [index, asset] of referenceAssets.entries()) {
    const dataUrl = await assetToDataUrl(asset);
    if (dataUrl) {
      referenceDataUrls.push({
        dataUrl,
        fileName: `weavy-flow-${Date.now()}-${index}-${asset?.name || 'reference.png'}`,
        originalName: asset?.name || 'reference.png',
      });
    }
  }

  const setupResult = await executeInFlowTab(targetTab.id, async ({ modelName, ratio, references, generationMode, outputResolution, duration, videoType }) => {
    const waitFor = async (predicate, timeout = 10000) => {
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeout) {
        const result = predicate();
        if (result) return result;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      return null;
    };

    const findExactControl = (label) => {
      const raw = String(label || '').toLowerCase().trim();
      let aliases = [raw];
      if (raw === 'image' || raw === 'gambar') {
        aliases = ['image', 'gambar'];
      } else if (raw === 'video') {
        aliases = ['video'];
      } else if (raw === 'ingredients' || raw === 'ingredient' || raw === 'bahan') {
        aliases = ['ingredients', 'ingredient', 'bahan', 'tambahkan bahan'];
      } else if (raw === 'frames' || raw === 'frame' || raw === 'bingkai') {
        aliases = ['frames', 'frame', 'bingkai'];
      } else if (raw === '16:9') {
        aliases = ['16:9', '16 : 9', 'landscape', 'lanskap', 'horizontal'];
      } else if (raw === '9:16') {
        aliases = ['9:16', '9 : 16', 'portrait', 'potret', 'vertikal'];
      } else if (raw === '1:1') {
        aliases = ['1:1', '1 : 1', 'square', 'persegi'];
      } else if (raw === '4:3') {
        aliases = ['4:3', '4 : 3'];
      } else if (raw === '3:4') {
        aliases = ['3:4', '3 : 4'];
      } else if (raw === '21:9') {
        aliases = ['21:9', '21 : 9'];
      } else if (raw === '4s' || raw === '4 s' || raw === '4 dtk') {
        aliases = ['4s', '4 s', '4 dtk', '4 detik', '4dtk'];
      } else if (raw === '6s' || raw === '6 s' || raw === '6 dtk') {
        aliases = ['6s', '6 s', '6 dtk', '6 detik', '6dtk'];
      } else if (raw === '8s' || raw === '8 s' || raw === '8 dtk') {
        aliases = ['8s', '8 s', '8 dtk', '8 detik', '8dtk'];
      } else if (raw === '10s' || raw === '10 s' || raw === '10 dtk') {
        aliases = ['10s', '10 s', '10 dtk', '10 detik', '10dtk'];
      } else if (raw === '720p') {
        aliases = ['720p', '720 p', '720'];
      } else if (raw === '360p') {
        aliases = ['360p', '360 p', '360'];
      } else if (raw === '1k') {
        aliases = ['1k', '1 k', '1080p'];
      }

      const elements = [...document.querySelectorAll('mat-button-toggle, [role="radio"], button, [role="button"], [role="tab"]')];
      return elements.find((element) => {
        if (element.offsetParent === null) return false;
        const ariaLabel = (element.getAttribute('aria-label') || '').trim().toLowerCase();
        const text = (element.innerText || '').trim().toLowerCase();
        const toggleText = (element.querySelector('.toggle-text')?.innerText || '').trim().toLowerCase();
        const textLines = text.split(/\n/).map((line) => line.trim().toLowerCase()).filter(Boolean);
        return aliases.some((value) =>
          ariaLabel === value ||
          ariaLabel.includes(value) ||
          toggleText === value ||
          text === value ||
          textLines.includes(value) ||
          (value.includes(':') && text.includes(value))
        );
      });
    };

    const isControlActive = (element) => {
      if (!element) return false;
      const toggle = element.closest('mat-button-toggle') || element;
      const button = element.matches('button') ? element : element.querySelector('button') || element;
      return button.getAttribute('aria-checked') === 'true'
        || toggle.classList.contains('mat-button-toggle-checked')
        || button.getAttribute('aria-pressed') === 'true'
        || element.classList.contains('active')
        || element.classList.contains('selected');
    };

    const activateControl = (element) => {
      if (!element || isControlActive(element)) return;
      const target = element.querySelector('button') || element;
      target.focus?.();
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      target.click();
    };

    const composer = await waitFor(() => document.querySelector('[contenteditable="true"].ProseMirror, [contenteditable="true"]'));
    if (!composer) return { success: false, error: 'Editor project Google Flow belum siap.' };

    const findSettingsTrigger = () => {
      const exact = document.querySelector('button.settings-trigger-button')
        || document.querySelector('button[aria-label="Pemicu setelan"]')
        || document.querySelector('button[aria-label="Settings trigger"]')
        || document.querySelector('button[aria-label*="Setting" i]')
        || document.querySelector('button[aria-label*="Pengaturan" i]')
        || document.querySelector('button[aria-label*="Setelan" i]');
      if (exact && exact.offsetParent !== null) return exact;
      return [...document.querySelectorAll('button, [role="button"]')].find((element) => {
        if (element.offsetParent === null) return false;
        const label = `${element.getAttribute('aria-label') || ''} ${element.getAttribute('data-testid') || ''} ${element.innerText || ''}`
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
        return /(^|\s)(settings|setting|pengaturan|setelan|pemicu setelan)(\s|$)/i.test(label)
          || label.includes('generation settings')
          || label.includes('open settings')
          || label.includes('setelan pembuatan')
          || label.includes('pengaturan pembuatan')
          || /nano banana|imagen|veo/i.test(label);
      });
    };

    const settingsPanelReady = () => {
      const panel = document.querySelector('flow-prompt-box-settings, .settings-content-overlay, .settings-content');
      if (panel && panel.offsetParent !== null) return true;
      const elements = [...document.querySelectorAll('mat-button-toggle, [role="radio"], [role="tab"], button, [role="button"]')];
      return elements.some((element) => {
        if (element.offsetParent === null) return false;
        const ariaLabel = (element.getAttribute('aria-label') || '').trim().toLowerCase();
        const text = (element.innerText || '').trim().toLowerCase();
        const textLines = text.split(/\n/).map((l) => l.trim().toLowerCase());
        const matchRatio = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'].some((r) => ariaLabel.includes(r) || text.includes(r));
        const matchMode = ['image', 'gambar', 'video'].some((m) => ariaLabel === m || textLines.includes(m));
        return matchRatio || (matchMode && (ariaLabel.length < 25 || text.length < 25));
      });
    };

    const ensureSettingsPanel = async () => {
      if (settingsPanelReady()) return true;
      const currentSettingsTrigger = findSettingsTrigger();
      if (currentSettingsTrigger) {
        currentSettingsTrigger.click();
        await waitFor(settingsPanelReady, 3000);
      }
      return settingsPanelReady();
    };

    // 1. ATUR MODE & SETTING TERLEBIH DAHULU SEBELUM PROMPT/INGREDIENTS
    if (!settingsPanelReady()) {
      const settingsTrigger = findSettingsTrigger();
      if (settingsTrigger) {
        settingsTrigger.click();
        await waitFor(settingsPanelReady, 4000);
      }
    }

    const targetMode = generationMode === 'video' ? 'Video' : 'Image';
    const modeControl = await waitFor(() => findExactControl(targetMode), 4000);
    if (modeControl) {
      activateControl(modeControl);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    await ensureSettingsPanel();

    if (generationMode === 'video') {
      const targetVideoType = videoType === 'Frames' ? 'Frames' : 'Ingredients';
      const videoTypeControl = await waitFor(() => findExactControl(targetVideoType), 3000);
      if (videoTypeControl) {
        activateControl(videoTypeControl);
        console.log('[weavy-flow][video] tipe video dipilih:', targetVideoType);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    const ratioButton = await waitFor(() => findExactControl(ratio), 4000);
    if (ratioButton) {
      activateControl(ratioButton);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    await ensureSettingsPanel();
    const modelTrigger = await waitFor(() => document.querySelector('button[aria-label="Select model family"]')
      || document.querySelector('button[aria-label="Pilih rangkaian model"]')
      || document.querySelector('button:has(.model-select-trigger-content)')
      || document.querySelector('button[aria-label*="model" i]')
      || [...document.querySelectorAll('button')].find((element) => /select model family|pilih rangkaian model|model family|pilih model/i.test(`${element.getAttribute('aria-label') || ''} ${element.innerText || ''}`)), 3000);
    if (modelTrigger) {
      modelTrigger.click();
      const normalizedModelName = modelName.trim().toLowerCase();
      const modelOption = await waitFor(() => [...document.querySelectorAll('[role="menuitem"], [role="option"], button')]
        .find((element) => {
          const label = (element.getAttribute('aria-label') || element.innerText || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase()
            .replace(/^volume_up\s*/, '');
          return label === normalizedModelName || label.includes(normalizedModelName);
        }), 3000);
      if (modelOption) {
        console.log('[weavy-flow][model] model dipilih:', modelOption.innerText.trim());
        modelOption.click();
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    if (generationMode === 'video') {
      if (await ensureSettingsPanel()) {
        const resolutionControl = await waitFor(() => findExactControl(outputResolution), 2000);
        if (resolutionControl) {
          activateControl(resolutionControl);
        }

        const durationControl = await waitFor(() => findExactControl(duration), 2000);
        if (durationControl) {
          activateControl(durationControl);
        }
        console.log('[weavy-flow][video] resolution dan durasi disesuaikan:', {
          resolution: outputResolution,
          duration,
        });
      }
    }

    // Tutup panel pengaturan jika masih terbuka
    if (settingsPanelReady()) {
      findSettingsTrigger()?.click();
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // 2. BERSIHKAN PROMPT & INGREDIENT LAMA
    const clearPrompt = document.querySelector('button[aria-label="Clear prompt"]');
    if (clearPrompt) {
      clearPrompt.click();
      await waitFor(() => {
        const currentEditor = document.querySelector('[contenteditable="true"].ProseMirror, [contenteditable="true"]');
        return currentEditor && !(currentEditor.innerText || '').trim();
      }, 3000);
    }

    // Hapus ingredient lama (best effort; tidak menghentikan proses kalau tersisa).
    for (let clearAttempt = 0; clearAttempt < 10; clearAttempt += 1) {
      const oldIngredient = document.querySelector('button[aria-label="Ingredient"], button[aria-label*="Ingredient" i], button[aria-label*="Bahan" i]');
      if (!oldIngredient) break;
      oldIngredient.click();
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    console.log('[weavy-flow] ingredient tersisa setelah clear:', document.querySelectorAll('button[aria-label="Ingredient"]').length);

    for (const reference of references) {
      console.log('[weavy-flow][upload] mulai reference:', {
        fileName: reference.fileName,
        originalName: reference.originalName,
      });
      const addIngredients = document.querySelector('button.add-menu-trigger')
        || document.querySelector('button[aria-label="Tambahkan bahan ke kotak perintah"]')
        || document.querySelector('button[aria-label="Add ingredients to the prompt box"]')
        || [...document.querySelectorAll('button')].find((element) => /add ingredients|tambahkan bahan/i.test(`${element.getAttribute('aria-label') || ''} ${element.innerText || ''}`));
      if (!addIngredients) {
        console.error('[weavy-flow][upload] add ingredients button tidak ditemukan');
        return { success: false, error: 'Menu ingredient Google Flow belum ditemukan.' };
      }
      if (addIngredients.getAttribute('aria-expanded') !== 'true') addIngredients.click();

      const uploadButton = await waitFor(() => [...document.querySelectorAll('button')]
        .find((element) => /upload media|unggah media|upload gambar|unggah gambar/i.test(element.innerText.trim())));
      if (!uploadButton) {
        console.error('[weavy-flow][upload] upload media button tidak ditemukan');
        return { success: false, error: 'Tombol Upload media Google Flow belum ditemukan.' };
      }
      const normalizeOptionText = (text) => (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const optionText = (el) => [
        el.innerText,
        el.getAttribute('aria-label'),
        ...[...el.querySelectorAll('img')].map((image) => image.alt),
      ].join(' ').toLowerCase();
      const optionKey = (el) => el.querySelector('img')?.dataset?.mediaId
        || el.id
        || el.getAttribute('aria-label')
        || normalizeOptionText(el.innerText);
      const existingOptionElements = new Set(document.querySelectorAll('[role="option"]'));
      const existingKeyCounts = new Map();
      for (const option of document.querySelectorAll('[role="option"]')) {
        const key = optionKey(option);
        if (key) existingKeyCounts.set(key, (existingKeyCounts.get(key) || 0) + 1);
      }
      console.log('[weavy-flow][upload] state sebelum upload:', {
        optionCount: existingOptionElements.size,
        options: [...document.querySelectorAll('[role="option"]')].map((option) => optionText(option)).slice(0, 10),
      });
      const uniqueName = reference.fileName.toLowerCase();
      const originalName = normalizeOptionText(reference.originalName || reference.fileName);
      let capturedFileInput = null;
      const existingFileInputs = new Set([...document.querySelectorAll('input[type="file"]')]);
      const nativeInputClick = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function captureFlowFileInput() {
        if (this.type === 'file') {
          capturedFileInput = this;
          return;
        }
        return nativeInputClick.call(this);
      };

      let fileInput;
      try {
        uploadButton.click();
        fileInput = await waitFor(() => capturedFileInput || [...document.querySelectorAll('input[type="file"]')]
          .find((input) => !existingFileInputs.has(input)) || [...document.querySelectorAll('input[type="file"]')].at(-1));
      } finally {
        HTMLInputElement.prototype.click = nativeInputClick;
      }
      if (!fileInput) {
        console.error('[weavy-flow][upload] file input tidak tertangkap');
        return { success: false, error: 'Input upload Google Flow belum siap.' };
      }
      console.log('[weavy-flow][upload] file input tertangkap:', fileInput);

      const [header, encoded] = reference.dataUrl.split(',', 2);
      const mimeType = header.match(/data:(.*?);/)?.[1] || 'image/png';
      const binary = atob(encoded || '');
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      const file = new File([bytes], reference.fileName, { type: mimeType });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      fileInput.files = transfer.files;
      fileInput.dispatchEvent(new Event('input', { bubbles: true }));
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('[weavy-flow][upload] event file dikirim:', {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      // Ekstrak prefix timestamp dari nama file weavy-flow- (format: weavy-flow-{timestamp}-{index}-{name}).
      // Flow UI menampilkan nama terpotong, jadi cocokkan berdasarkan prefix ini.
      const weavyMatch = uniqueName.match(/^weavy-flow-(\d{13})/);
      const weavyTimestampPrefix = weavyMatch ? `weavy-flow-${weavyMatch[1]}` : null;

      // Helper: cek apakah option cocok dengan file yang baru diupload berdasarkan:
      // 1. Nama lengkap (jika cocok, prioritas tertinggi)
      // 2. Prefix timestamp weavy-flow-
      // 3. Nama asli file pada option baru
      const matchesUpload = (option) => {
        const text = optionText(option);
        if (text.includes(uniqueName)) return 2; // prioritas tertinggi: nama lengkap cocok
        if (weavyTimestampPrefix && text.includes(weavyTimestampPrefix)) return 1; // prefix cocok
        if (text.includes(originalName)) return 1;
        return 0;
      };

      const getNewOptions = (options) => {
        const knownOptions = options.filter((option) => existingOptionElements.has(option));
        if (knownOptions.length) return options.filter((option) => !existingOptionElements.has(option));

        const seenKeyCounts = new Map();
        const addedKeys = new Set();
        for (const option of options) {
          const key = optionKey(option);
          if (!key) continue;
          const seenCount = (seenKeyCounts.get(key) || 0) + 1;
          seenKeyCounts.set(key, seenCount);
          if (seenCount > (existingKeyCounts.get(key) || 0)) addedKeys.add(key);
        }

        const firstAddedOptionByKey = new Set();
        return options.filter((option) => {
          const key = optionKey(option);
          if (!addedKeys.has(key) || firstAddedOptionByKey.has(key)) return false;
          firstAddedOptionByKey.add(key);
          return true;
        });
      };

      const isUploadPending = (option) => /\b(uploading|processing)\b/i.test(optionText(option));
      const findUploadedOption = () => {
        const options = [...document.querySelectorAll('[role="option"]')];
        const newOptions = getNewOptions(options).filter((option) => !isUploadPending(option));
        const exactMatch = newOptions.find((option) => matchesUpload(option) === 2);
        if (exactMatch) return { option: exactMatch, strategy: 'exact' };
        const namedMatch = newOptions.find((option) => matchesUpload(option) === 1);
        if (namedMatch) return { option: namedMatch, strategy: 'name' };
        return newOptions.length === 1
          ? { option: newOptions[0], strategy: 'new-option' }
          : null;
      };

      const uploadedOptionResult = await waitFor(findUploadedOption, 20000);
      const uploadedOption = uploadedOptionResult?.option;
      const matchStrategy = uploadedOptionResult?.strategy;
      console.log('[weavy-flow][upload] hasil pencarian option:', {
        strategy: matchStrategy,
        option: uploadedOption ? optionText(uploadedOption) : null,
        options: [...document.querySelectorAll('[role="option"]')].map((option) => optionText(option)).slice(0, 10),
      });
      if (!uploadedOption) {
        console.warn('[weavy-flow] opsi hasil upload tidak ditemukan. Opsi saat ini:',
          [...document.querySelectorAll('[role="option"]')].slice(0, 5).map((o) => o.outerHTML.slice(0, 300)));
        return { success: false, error: `Asset ${reference.fileName} belum muncul di daftar asset Google Flow.` };
      }
      console.log(`[weavy-flow] opsi upload dipilih (strategy=${matchStrategy}):`, uploadedOption.outerHTML.slice(0, 300));
      if (matchStrategy === 'new-option') {
        console.warn(`[weavy-flow] Nama asset tidak cocok, tetapi hanya ada satu option baru. uniqueName="${uniqueName}", originalName="${originalName}"`);
      }

      // Option yang sudah tidak berstatus Uploading/Processing adalah sinyal selesai.
      // Tidak menunggu GA4 beacon karena beacon bisa sudah terkirim sebelum interceptor aktif.
      // RE-DETECT option pada DOM terkini setelah upload selesai.
      const currentOptionResult = findUploadedOption();
      const currentOption = currentOptionResult?.option;
      console.log('[weavy-flow][upload] option setelah upload selesai:', {
        strategy: currentOptionResult?.strategy,
        option: currentOption ? optionText(currentOption) : null,
      });
      if (!currentOption) {
        console.warn('[weavy-flow] ⚠️ opsi tidak ditemukan setelah upload selesai. Opsi saat ini:',
          [...document.querySelectorAll('[role="option"]')].slice(0, 5).map((o) => o.outerHTML.slice(0, 300)));
        return { success: false, error: `Asset ${reference.fileName} tidak ditemukan setelah upload selesai.` };
      }
      console.log('[weavy-flow] option ditemukan:', currentOption.outerHTML.slice(0, 200));

      // Hitung chip ingredient sebelum interaksi.
      const chipCount = () => document.querySelectorAll(
        'button[aria-label="Ingredient"], button[aria-label*="Ingredient" i], button[aria-label*="Bahan" i], [data-testid*="ingredient" i], .ingredient-chip'
      ).length;
      const countBefore = chipCount();
      const getPreviewSignature = () => {
        const preview = document.querySelector('img[alt^="Preview of "], img[alt*="Preview" i], img[alt*="Pratinjau" i], div[role="dialog"] img, .preview img');
        return preview ? `${preview.getAttribute('alt') || ''}|${preview.currentSrc || preview.src || ''}` : '';
      };
      const previousPreviewSignature = getPreviewSignature();
      console.log('[weavy-flow][upload] sebelum klik option:', {
        option: optionText(currentOption),
        preview: previousPreviewSignature,
        active: currentOption.matches('[aria-selected="true"], [data-state="selected"], .selected, .active'),
      });

      // Satu native click saja. Dispatch beberapa event dapat membuat picker berpindah
      // selection dan preview yang aktif kembali ke asset sebelumnya.
      currentOption.click();
      console.log('[weavy-flow][upload] option diklik');

      // TUNGGU overlay / tombol "Add to prompt" ("Tambahkan ke perintah") muncul di area preview gambar.
      const findAddToPromptInDoc = () => {
        const exact = document.querySelector('button.detail-add-to-prompt-btn')
          || document.querySelector('.detail-add-to-prompt-btn');
        if (exact && exact.offsetParent !== null) return exact;
        const candidates = [...document.querySelectorAll('button, [role="button"], [role="menuitem"]')];
        return candidates.find((element) => {
          const text = (element.innerText || element.getAttribute('aria-label') || '').trim();
          return /add to prompt|tambahkan ke perintah|tambahkan ke prompt|tambah ke prompt|add to instruction|tambahkan/i.test(text)
            && text.length < 50
            && element.offsetParent !== null;
        });
      };
      const isSelectedOption = () => currentOption.matches(
        '[aria-selected="true"], [data-state="selected"], .selected, .active',
      );
      const isCurrentPreviewReady = () => {
        const previewSignature = getPreviewSignature();
        return Boolean(previewSignature)
          || isSelectedOption()
          || Boolean(findAddToPromptInDoc());
      };

      console.log('[weavy-flow] menunggu overlay Add to prompt / Tambahkan ke perintah...');
      const addStep = await waitFor(() => {
        // Chip sudah bertambah tanpa klik manual
        if (chipCount() > countBefore) return 'auto';
        const addButton = findAddToPromptInDoc();
        return addButton ? addButton : null;
      }, 20000);
      console.log('[weavy-flow][upload] hasil tunggu Add to prompt:', {
        found: Boolean(addStep),
        autoAdded: addStep === 'auto',
        preview: getPreviewSignature(),
        optionActive: isSelectedOption(),
        addButtons: [...document.querySelectorAll('button, [role="button"], [role="menuitem"]')]
          .filter((element) => /add to prompt|tambahkan ke|tambah/i.test(element.innerText || element.getAttribute('aria-label') || ''))
          .map((element) => ({ text: element.innerText, visible: element.offsetParent !== null })),
      });

      if (!addStep) {
        console.warn('[weavy-flow] overlay Add to prompt tidak ditemukan setelah 20 detik, mencoba fallback hover...');
        currentOption.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
        await new Promise((resolve) => setTimeout(resolve, 500));
        const retryBtn = findAddToPromptInDoc();
        if (retryBtn) {
          console.log('[weavy-flow] overlay ditemukan setelah hover, klik...');
          retryBtn.focus?.();
          retryBtn.click();
          const addedAfterRetry = await waitFor(() => chipCount() > countBefore, 5000);
          if (addedAfterRetry) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            return;
          }
        }
        return { success: false, error: 'Tombol "Tambahkan ke perintah" (Add to prompt) Google Flow tidak ditemukan.' };
      }
      if (addStep !== 'auto') {
        console.log('[weavy-flow] klik overlay Add to prompt / Tambahkan ke perintah');
        addStep.focus?.();
        addStep.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        addStep.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        addStep.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
        addStep.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        addStep.click();
        console.log('[weavy-flow][upload] Add to prompt diklik');
      }

      // Sukses kalau chip bertambah.
      const ingredientAdded = await waitFor(() => chipCount() > countBefore, 30000);
      if (!ingredientAdded) {
        console.error('[weavy-flow][upload] ingredient tidak bertambah setelah Add to prompt');
        return { success: false, error: `Asset ${reference.fileName} belum masuk ke card prompt Google Flow.` };
      }
      console.log('[weavy-flow][upload] berhasil masuk prompt card:', optionText(currentOption));
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return { success: true };
  }, [{
    modelName: mode === 'video'
      ? (model?.name || 'Veo 3.1 - Fast')
      : (model?.name || 'Nano Banana Pro'),
    ratio: mode === 'video'
      ? (['16:9', '9:16'].includes(aspectRatio) ? aspectRatio : '16:9')
      : (['16:9', '4:3', '1:1', '3:4', '9:16'].includes(aspectRatio) ? aspectRatio : '1:1'),
    generationMode: mode,
    videoType: mode === 'video' && videoType === 'Frames' ? 'Frames' : 'Ingredients',
    outputResolution: mode === 'video'
      ? (['360p', '720p'].includes(resolution) ? resolution : '720p')
      : resolution,
    duration: ['4s', '6s', '8s', '10s'].includes(videoDuration) ? videoDuration : '8s',
    references: referenceDataUrls,
  }], 'MAIN');

  const setup = setupResult?.[0]?.result;
  if (!setup?.success) throw new Error(setup?.error || 'Pengaturan Google Flow gagal diterapkan.');

  onProgress?.(25, `Mengirim prompt ${mode === 'video' ? 'video' : 'gambar'} ke Google Flow...`);

  const submitResult = await executeInFlowTab(targetTab.id, async (promptText) => {
    const waitFor = async (predicate, timeout = 5000) => {
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeout) {
        const result = predicate();
        if (result) return result;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      return null;
    };

    const editor = document.querySelector('[contenteditable="true"].ProseMirror, [contenteditable="true"]');
    if (!editor) {
      return { success: false, error: 'Kolom prompt Google Flow belum ditemukan.' };
    }

    editor.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);

    const beforeInput = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: promptText,
    });
    editor.dispatchEvent(beforeInput);
    if (!beforeInput.defaultPrevented) {
      document.execCommand('insertText', false, promptText);
    }

    const currentPrompt = (editor.innerText || editor.textContent || '').trim();
    if (currentPrompt !== promptText) {
      editor.replaceChildren(document.createElement('p'));
      editor.firstElementChild.textContent = promptText;
    }
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: promptText }));
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
    editor.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }));

    const existingMediaIds = new Set(
      [...document.querySelectorAll('img[alt="Tile displaying a user\'s image"][data-media-id]')]
        .map((image) => image.dataset.mediaId)
        .filter(Boolean),
    );
    const existingTileSignatures = [...document.querySelectorAll('flow-grid-tile-container')]
      .map((tile) => tile.outerHTML);
    const existingFailureSignatures = [...document.querySelectorAll('.error-message')]
      .map((errorMessage) => errorMessage.innerText.replace(/\s+/g, ' ').trim());
    const existingImageUrls = new Set(
      [...document.images]
        .map((image) => image.currentSrc || image.src)
        .filter(Boolean),
    );
    [...document.querySelectorAll('video')]
      .map((video) => video.currentSrc || video.src || video.querySelector('source')?.src)
      .filter(Boolean)
      .forEach((src) => existingImageUrls.add(src));

    const startButton = await waitFor(() => {
      const button = document.querySelector('button.generate-icon-button')
        || document.querySelector('flow-generate-icon-button button')
        || document.querySelector('button[aria-label="Mulai pembuatan"]')
        || document.querySelector('button[aria-label="Start generation"]')
        || document.querySelector('button[type="submit"]')
        || [...document.querySelectorAll('button')].find((element) => /start generation|mulai pembuatan/i.test(`${element.getAttribute('aria-label') || ''} ${element.innerText || ''}`));
      const text = (editor.innerText || editor.textContent || '').trim();
      if (button && text) {
        if (button.disabled) {
          button.disabled = false;
          button.removeAttribute('disabled');
          button.classList.remove('mat-mdc-button-disabled');
        }
        return button;
      }
      return null;
    }, 15000);
    if (!startButton) {
      console.error('[weavy-flow][submit] prompt atau tombol Start generation belum siap:', {
        promptLength: (editor.innerText || editor.textContent || '').trim().length,
        buttonDisabled: (document.querySelector('button.generate-icon-button')
          || document.querySelector('flow-generate-icon-button button')
          || document.querySelector('button[aria-label="Mulai pembuatan"]')
          || document.querySelector('button[aria-label="Start generation"]'))?.disabled,
      });
      return { success: false, error: 'Tombol Start generation Google Flow belum siap.' };
    }

    return {
      success: true,
      existingMediaIds: [...existingMediaIds],
      existingImageUrls: [...existingImageUrls],
      existingTileSignatures,
      existingFailureSignatures,
      existingFailureCount: existingFailureSignatures.length,
    };
  }, [prompt], 'MAIN');

  const submission = submitResult?.[0]?.result;
  if (!submission?.success) {
    throw new Error(submission?.error || 'Prompt gagal dikirim ke Google Flow.');
  }

  await clickFlowStartGeneration(targetTab.id);
  const submitAcceptedResult = await executeInFlowTab(targetTab.id, async () => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 6000) {
      const button = document.querySelector('button.generate-icon-button')
        || document.querySelector('button[aria-label="Mulai pembuatan"]')
        || document.querySelector('button[aria-label="Start generation"]')
        || document.querySelector('button[type="submit"]')
        || [...document.querySelectorAll('button')].find((element) => /start generation|mulai pembuatan/i.test(`${element.getAttribute('aria-label') || ''} ${element.innerText || ''}`));
      const editor = document.querySelector('[contenteditable="true"].ProseMirror, [contenteditable="true"]');
      const currentText = (editor?.innerText || editor?.textContent || '').trim();
      if (button?.disabled || !currentText) return true;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return true;
  }, [], 'MAIN');
  if (!submitAcceptedResult?.[0]?.result) {
    throw new Error('Google Flow tidak menerima klik Start generation.');
  }

  onProgress?.(35, `Google Flow sedang membuat ${mode === 'video' ? 'video' : 'gambar'}...`);
  const existingMediaIds = new Set(submission.existingMediaIds || []);
  const existingImageUrls = new Set(submission.existingImageUrls || []);
  const existingTileSignatures = submission.existingTileSignatures || [];
  const existingFailureSignatures = submission.existingFailureSignatures || [];
  const existingFailureCount = Number(submission.existingFailureCount || 0);
  const referenceNames = referenceDataUrls.map((reference) => reference.fileName.toLowerCase());
  const maxAttempts = mode === 'video' ? 300 : 150;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const mediaResult = await executeInFlowTab(targetTab.id, (knownMediaIds, knownUrls, knownReferenceNames, knownTileSignatures, knownFailureSignatures, knownFailureTotal, generationMode, requestedPrompt) => {
      const normalizeText = (value) => (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const promptText = normalizeText(requestedPrompt);
      const promptWords = new Set(promptText.split(/[^a-z0-9]+/).filter((word) => word.length >= 4));
      const promptMatches = (label) => {
        const normalizedLabel = normalizeText(label);
        if (!normalizedLabel || !promptText) return false;
        if (normalizedLabel.includes(promptText.slice(0, 40))
          || promptText.includes(normalizedLabel.slice(0, 40))) return true;
        const labelWords = normalizedLabel.split(/[^a-z0-9]+/).filter((word) => word.length >= 4);
        return labelWords.filter((word) => promptWords.has(word)).length >= 2;
      };

      const failureMessages = [...document.querySelectorAll('.error-message')]
        .map((errorMessage) => ({
          text: errorMessage.innerText.replace(/\s+/g, ' ').trim(),
          title: errorMessage.querySelector('.error-title')?.innerText.trim() || '',
        }))
        .filter(({ title, text }) => /^failed$/i.test(title) && text);
      const knownFailureSignatureSet = new Set(knownFailureSignatures);
      const newFailure = failureMessages.length > knownFailureTotal
        ? failureMessages.at(-1)
        : failureMessages.find(({ text }) => !knownFailureSignatureSet.has(text));
      if (newFailure) {
        return {
          progress: 100,
          media: null,
          error: newFailure.text,
        };
      }

      const allTiles = [...document.querySelectorAll('flow-grid-tile-container')];
      const knownTileSignatureSet = new Set(knownTileSignatures);
      const candidateTiles = allTiles.filter((tile) => !knownTileSignatureSet.has(tile.outerHTML));
      const failedTile = candidateTiles.find((tile) => {
        const text = (tile.innerText || '').replace(/\s+/g, ' ').trim();
        return /\bfailed\b|unusual activity|might violate our policies|please try a different prompt|generation failed/i.test(text)
          && text.length > 0;
      });
      if (failedTile) {
        return {
          progress: 100,
          media: null,
          error: (failedTile.innerText || 'Google Flow gagal membuat media.').replace(/\s+/g, ' ').trim(),
        };
      }

      const tileEntries = allTiles
        .map((tile) => {
          const label = (tile.getAttribute('aria-label') || tile.innerText || '').replace(/\s+/g, ' ').trim();
          const text = (tile.innerText || '').replace(/\s+/g, ' ').trim();
          const image = tile.querySelector('img[alt="Tile displaying a user\'s image"], img');
          const video = tile.querySelector('video');
          const thumbnail = tile.querySelector('img[alt="Generated video thumbnail"]') || tile.querySelector('img[alt*="video"]');
          const videoSrc = (video?.currentSrc || video?.src || video?.querySelector('source')?.src || '').trim();
          const imageSrc = (image?.currentSrc || image?.src || '').trim();
          const thumbnailSrc = (thumbnail?.currentSrc || thumbnail?.src || '').trim();
          const mediaSrc = videoSrc || imageSrc || thumbnailSrc;
          const width = Number(image?.naturalWidth || image?.width || image?.clientWidth || video?.videoWidth || video?.clientWidth || thumbnail?.naturalWidth || thumbnail?.width || 0);
          const height = Number(image?.naturalHeight || image?.height || image?.clientHeight || video?.videoHeight || video?.clientHeight || thumbnail?.naturalHeight || thumbnail?.height || 0);
          const mediaId = image?.dataset?.mediaId || null;
          return {
            tile,
            label,
            text,
            image,
            video,
            thumbnail,
            mediaSrc,
            mediaId,
            videoSrc,
            thumbnailSrc,
            width,
            height,
          };
        })
        .filter((entry) => entry.mediaSrc && entry.width >= 160 && entry.height >= 160);

      const progress = tileEntries
        .filter(({ label, text }) => promptMatches(label || text))
        .map(({ text }) => (text || '').match(/(?:^|\s)(\d{1,3})%(?:\s|$)/)?.[1])
        .map(Number)
        .find((value) => Number.isFinite(value) && value >= 0 && value <= 100);

      const freshGeneratedMedia = tileEntries
        .filter(({ label, mediaId, mediaSrc, videoSrc, text }) => {
          const referenceName = (label || text).toLowerCase();
          const isReference = knownReferenceNames.some((name) => referenceName === name || referenceName.includes(name));
          const isKnownMedia = knownMediaIds.includes(mediaId) || knownUrls.includes(mediaSrc);
          return !isReference
            && !isKnownMedia
            && Boolean(mediaSrc)
            && (generationMode !== 'video' || Boolean(videoSrc))
            && !/failed|error|try a different prompt/i.test(text || '');
        })
        .map(({ label, mediaSrc, mediaId, width, height, thumbnailSrc, videoSrc }) => {
          const baseMedia = {
            src: mediaSrc,
            width,
            height,
            mediaId,
            label,
          };
          if (videoSrc) {
            return {
              ...baseMedia,
              isVideo: true,
              src: videoSrc,
            };
          }
          if (thumbnailSrc && generationMode === 'video') {
            return {
              ...baseMedia,
              isThumbnail: true,
              src: thumbnailSrc,
            };
          }
          return baseMedia;
        });

      if (generationMode === 'video') {
        const matchingVideos = freshGeneratedMedia.filter((video) => promptMatches(video.label));
        const selectedVideo = (matchingVideos.length ? matchingVideos : freshGeneratedMedia).at(-1);
        if (selectedVideo) return { progress: 100, media: selectedVideo };

        return { progress: Number.isFinite(progress) ? progress : null, media: null };
      }

      const matchingImages = freshGeneratedMedia.filter((image) => promptMatches(image.label));
      const selectedImage = (matchingImages.length ? matchingImages : freshGeneratedMedia).at(-1);
      if (selectedImage) {
        return { progress: 100, media: selectedImage };
      }

      return { progress: Number.isFinite(progress) ? progress : null, media: null };
    }, [[...existingMediaIds], [...existingImageUrls], referenceNames, existingTileSignatures, existingFailureSignatures, existingFailureCount, mode, prompt]);

    const result = mediaResult?.[0]?.result;
    if (result?.error) {
      throw new Error(`Google Flow gagal: ${result.error}`);
    }
    if (Number.isFinite(result?.progress)) {
      onProgress?.(result.progress, `Google Flow sedang merender ${mode === 'video' ? 'video' : 'gambar'}...`);
    }
    if (result?.media?.src) {
      onProgress?.(100, `${mode === 'video' ? 'Video' : 'Gambar'} Google Flow selesai dibuat.`);

      // Blob URL dari Flow tidak bisa diakses setelah tab berubah atau blob di-GC.
      // Konversi ke data URL (base64) SELAMA masih di konteks Flow tab.
      const mediaSrc = result.media.src;
      const imageDataUrl = await executeInFlowTab(targetTab.id, async (src) => {
        try {
          if (src.startsWith('blob:')) {
            const response = await fetch(src);
            if (!response.ok) return src;
            const blob = await response.blob();
            const reader = new FileReaderSync ? new FileReaderSync() : null;
            if (reader) {
              return reader.readAsDataURL(blob);
            }
          }
          if (src.startsWith('data:')) return src;
          const response = await fetch(src);
          if (!response.ok) return src;
          const blob = await response.blob();
          return new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.onerror = () => reject(new Error('blob->base64 gagal'));
            fr.readAsDataURL(blob);
          });
        } catch {
          return src;
        }
      }, [mediaSrc]);
      return imageDataUrl?.[0]?.result || mediaSrc;
    }

    if (!Number.isFinite(result?.progress)) {
      onProgress?.(35 + Math.min(60, Math.round(((attempt + 1) / maxAttempts) * 60)), `Google Flow sedang merender ${mode === 'video' ? 'video' : 'gambar'}...`);
    }
  }

  throw new Error(`Waktu tunggu video/gambar Google Flow habis. Cek tab Flow untuk melihat status generasi.`);
}

export function executeFlowImageGeneration(options = {}) {
  return executeFlowGeneration({ ...options, mode: 'image' });
}

export function executeFlowVideoGeneration(options = {}) {
  return executeFlowGeneration({ ...options, mode: 'video' });
}