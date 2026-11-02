// Gemini Onboarding & Registration Automation - Content Script (Step 2)
// Mendukung "Chat with Gemini", "Use Gemini", "Continue", "Sign in", "Terms & Privacy", dan Aktivasi Sesi

(() => {
  if (window.top !== window) return;
  if (window.__GEMINI_AUTO_ONBOARDING_ACTIVE__) return;
  window.__GEMINI_AUTO_ONBOARDING_ACTIVE__ = true;

  function isExtensionValid() {
    return Boolean(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
  }

  const log = (msg) => {
    console.log(`[Gemini-Extension] ${msg}`);
    if (!isExtensionValid()) return;
    try {
      chrome.runtime.sendMessage({
        type: 'GOOGLE_LOGIN_LOG',
        message: msg
      }).catch(() => {});
    } catch (e) {}
  };

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function isVisible(el) {
    if (!el) return false;
    try {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0'
      );
    } catch (e) {
      return el.offsetParent !== null;
    }
  }

  // Trigger klik nyata dengan pointer & mouse event lengkap
  function triggerRealClick(element) {
    if (!element) return;
    try {
      element.focus();
      element.scrollIntoView({ behavior: 'instant', block: 'center' });

      const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
      for (const ev of events) {
        element.dispatchEvent(
          new MouseEvent(ev, {
            bubbles: true,
            cancelable: true,
            view: window,
            buttons: 1
          })
        );
      }
      element.click();
    } catch (e) {
      try {
        element.click();
      } catch (err) {}
    }
  }

  // Cek apakah ada tombol "Sign in" / "Masuk" yang menandakan belum terotentikasi
  function findSignInButton() {
    const allClickables = Array.from(
      document.querySelectorAll('button, a, div[role="button"], span')
    );

    for (const el of allClickables) {
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      if ((txt === 'sign in' || txt === 'masuk' || txt === 'sign in to save activity') && isVisible(el)) {
        return el.closest('button, a, div[role="button"]') || el;
      }
    }
    return null;
  }

  // =========================================================================
  // CARI DAN KLIK TOMBOL AKSI ONBOARDING GEMINI
  // =========================================================================
  function findAndClickGeminiAction() {
    const allClickables = Array.from(
      document.querySelectorAll('button, a, div[role="button"], span, [tabindex="0"]')
    );

    // 1. PRIORITAS 1: Jika belum login (Ada tombol Sign in), klik Sign in sebagai fallback
    const signInBtn = findSignInButton();
    if (signInBtn && isVisible(signInBtn)) {
      log('👉 [Gemini Fallback] Sesi cookie belum aktif. Mengklik tombol "Sign in" untuk login akun...');
      triggerRealClick(signInBtn);
      return true;
    }

    // 2. PRIORITAS 2: Tombol "Use Gemini" di dialog Terms & Privacy
    for (const el of allClickables) {
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      if ((txt === 'use gemini' || txt === 'gunakan gemini' || txt.includes('use gemini')) && isVisible(el)) {
        const targetBtn = el.closest('button, div[role="button"], a') || el;
        log('👉 [Gemini Onboarding] Menemukan & mengklik tombol "Use Gemini"...');
        triggerRealClick(targetBtn);
        return true;
      }
    }

    // 3. PRIORITAS 3: Tombol "Continue" di dialog Welcome to Gemini
    for (const el of allClickables) {
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      if ((txt === 'continue' || txt === 'lanjutkan' || txt === 'lanjut') && isVisible(el)) {
        const targetBtn = el.closest('button, div[role="button"], a') || el;
        log('👉 [Gemini Onboarding] Menemukan & mengklik tombol "Continue"...');
        triggerRealClick(targetBtn);
        return true;
      }
    }

    // 4. PRIORITAS 4: Dialog Notifikasi ("Block", "Allow", "Dismiss", "Close")
    for (const el of allClickables) {
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      if ((txt === 'block' || txt === 'allow' || txt === 'blokir' || txt === 'izinkan') && isVisible(el)) {
        const targetBtn = el.closest('button, div[role="button"], a') || el;
        log(`👉 [Gemini Onboarding] Mengklik respon notifikasi: "${txt}"...`);
        triggerRealClick(targetBtn);
        return true;
      }
    }

    // 5. PRIORITAS 5: Tombol Persetujuan ("I agree", "Saya setuju", "I understand", "Got it")
    const agreeKeywords = ['i agree', 'saya setuju', 'agree', 'setuju', 'i understand', 'saya mengerti', 'got it', 'paham', 'accept', 'terima'];
    for (const el of allClickables) {
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      if (agreeKeywords.some((k) => txt === k || txt.startsWith(k)) && isVisible(el)) {
        const targetBtn = el.closest('button, div[role="button"], a') || el;
        log(`👉 [Gemini Onboarding] Menemukan & mengklik persetujuan: "${txt}"...`);
        triggerRealClick(targetBtn);
        return true;
      }
    }

    // 6. PRIORITAS 6: Tombol "Chat with Gemini" di Landing Page
    for (const el of allClickables) {
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      if ((txt === 'chat with gemini' || txt.includes('chat with gemini') || txt.includes('coba gemini')) && isVisible(el)) {
        const targetBtn = el.closest('button, div[role="button"], a') || el;
        log('👉 [Gemini Landing] Menemukan & mengklik tombol "Chat with Gemini"...');
        triggerRealClick(targetBtn);
        return true;
      }
    }

    return false;
  }

  // Cek apakah dialog modal sedang terbuka
  function isAnyModalOpen() {
    const dialogs = Array.from(
      document.querySelectorAll('mat-dialog-container, div[role="dialog"], dialog, [class*="dialog"], [class*="modal"]')
    );
    return dialogs.some((d) => isVisible(d));
  }

  // Cek apakah chat interface Gemini sudah BENAR-BENAR login & aktif
  function checkGeminiChatReady() {
    if (isAnyModalOpen()) return false;

    // Jika masih ada tombol Sign in, berarti belum login
    const signInBtn = findSignInButton();
    if (signInBtn) return false;

    // Cek keberadaan user avatar akun Google
    const userProfileEl = document.querySelector('img[alt*="Google Account" i], a[aria-label*="Google Account" i], div[aria-label*="Google Account" i], [data-identifier], [aria-label*="Akun Google" i]');

    const chatSelectors = [
      'rich-textarea',
      'div.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"]',
      'textarea[placeholder*="Ask Gemini" i]',
      'textarea[placeholder*="Tanya Gemini" i]',
      'textarea[aria-label*="prompt" i]'
    ];

    const hasInputBox = chatSelectors.some((sel) => {
      const el = document.querySelector(sel);
      return el && isVisible(el);
    });

    if (hasInputBox && (userProfileEl || window.location.href.includes('/app'))) {
      return true;
    }

    return false;
  }

  // =========================================================================
  // SIKLUS EKSEKUSI UTAMA (STEP 2)
  // =========================================================================
  let isExecuting = false;
  let hasReportedSuccess = false;
  let lastActionTime = 0;

  async function runGeminiCycle(credentials) {
    if (!isExtensionValid() || isExecuting || hasReportedSuccess) return;
    if (Date.now() - lastActionTime < 800) return;
    isExecuting = true;

    try {
      const actionClicked = findAndClickGeminiAction();
      if (actionClicked) {
        lastActionTime = Date.now();
        await delay(1500);
        isExecuting = false;
        return;
      }

      if (checkGeminiChatReady()) {
        log('🎉 REGISTRASI & LOGIN GEMINI BERHASIL 100%! Akun sudah aktif di Gemini.');
        hasReportedSuccess = true;
        if (isExtensionValid()) {
          chrome.runtime.sendMessage({
            type: 'GEMINI_ONBOARDING_SUCCESS',
            email: credentials?.email,
            url: window.location.href
          }).catch(() => {});
        }
        isExecuting = false;
        return;
      }

    } catch (err) {
      log(`⚠️ Error dalam siklus Gemini: ${err.message}`);
    } finally {
      isExecuting = false;
    }
  }

  // Polling interval dengan auto-cleanup jika extension di-reload
  const pollInterval = setInterval(() => {
    if (!isExtensionValid()) {
      clearInterval(pollInterval);
      try { observer.disconnect(); } catch (e) {}
      return;
    }
    try {
      chrome.storage.local.get(['activeGoogleLogin', 'isAutoLoginActive'], (res) => {
        if (!isExtensionValid() || chrome.runtime.lastError) return;
        if (res?.isAutoLoginActive === true && res?.activeGoogleLogin) {
          runGeminiCycle(res.activeGoogleLogin);
        }
      });
    } catch (e) {
      clearInterval(pollInterval);
    }
  }, 400);

  // MutationObserver dengan auto-cleanup
  const observer = new MutationObserver(() => {
    if (!isExtensionValid()) {
      observer.disconnect();
      return;
    }
    try {
      chrome.storage.local.get(['activeGoogleLogin', 'isAutoLoginActive'], (res) => {
        if (!isExtensionValid() || chrome.runtime.lastError) return;
        if (res?.isAutoLoginActive === true && res?.activeGoogleLogin) {
          runGeminiCycle(res.activeGoogleLogin);
        }
      });
    } catch (e) {}
  });

  try {
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  } catch (e) {}

  log('🟢 Skrip otomasi Gemini siap menangani "Sign in", "Use Gemini", & "Continue".');
})();
