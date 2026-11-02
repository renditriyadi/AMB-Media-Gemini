// Google Session Auto-Login - Content Script
// 100% Mengikuti Urutan & Selector Resmi dari Playwright AMB MEDIA + Auto-Retry & Account Switcher

(() => {
  if (window.top !== window) return;
  if (window.__GOOGLE_AUTO_LOGIN_ACTIVE__) return;
  window.__GOOGLE_AUTO_LOGIN_ACTIVE__ = true;

  function isExtensionValid() {
    return Boolean(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
  }

  const log = (msg) => {
    console.log(`[Google-Extension] ${msg}`);
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
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  // Set value native untuk input Google (Bypass Framework Internal & Dispatch Lengkap)
  function fillNativeInput(inputElement, text) {
    if (!inputElement) return false;
    inputElement.focus();
    inputElement.click();
    inputElement.value = '';
    
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(inputElement, text);
    } else {
      inputElement.value = text;
    }

    inputElement.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    inputElement.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: text, inputType: 'insertText' }));
    return inputElement.value === text;
  }

  // ==========================================
  // DETEKSI ERROR "SOMETHING WENT WRONG" & AUTO-RETRY
  // ==========================================
  let isRetrying = false;
  async function checkAndHandleWrongOrErrorScreen() {
    if (isRetrying || !isExtensionValid()) return false;
    const url = window.location.href.toLowerCase();
    const bodyText = (document.body.innerText || '').toLowerCase();

    const isWrong = url.includes('unknownerror') ||
                    url.includes('signin/rejected') ||
                    bodyText.includes('something went wrong') ||
                    bodyText.includes('terjadi kesalahan') ||
                    bodyText.includes('ada yang salah') ||
                    bodyText.includes('sorry, something went wrong there') ||
                    bodyText.includes('maaf, terjadi kesalahan');

    if (!isWrong) return false;

    isRetrying = true;
    log('⚠️ [Auto-Recovery] Terdeteksi layar "Something went wrong"! Mengulangi pendaftaran Google...');

    const allButtons = Array.from(document.querySelectorAll('button, div[role="button"]'));
    const retryPatterns = ['next', 'berikutnya', 'try again', 'coba lagi', 'ulang'];

    for (const b of allButtons) {
      const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
      if (retryPatterns.some(p => txt === p || txt.includes(p)) && isVisible(b)) {
        b.click();
        break;
      }
    }

    await delay(1200);

    hasFilledEmail = false;
    hasFilledPassword = false;

    if (isExtensionValid()) {
      chrome.runtime.sendMessage({
        type: 'RETRY_GOOGLE_LOGIN',
        reason: 'something_went_wrong'
      }).catch(() => {});
    }

    await delay(2000);
    isRetrying = false;
    return true;
  }

  // ==========================================
  // STEP 1: FORMULIR EMAIL (IDENTIFIER)
  // ==========================================
  function getEmailInputElement() {
    const selectors = [
      '#identifierId',
      'input[name="identifier"]',
      'input[type="email"]',
      'input[autocomplete="username"]'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && isVisible(el) && !el.disabled && !el.readOnly) {
        return el;
      }
    }
    return null;
  }

  function getEmailNextButton() {
    const direct = document.querySelector('#identifierNext button, #identifierNext');
    if (direct && isVisible(direct)) return direct;

    const allButtons = Array.from(document.querySelectorAll('button'));
    for (const b of allButtons) {
      const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
      if ((txt === 'next' || txt === 'berikutnya' || txt === 'selanjutnya') && isVisible(b)) {
        return b;
      }
    }
    return null;
  }

  // ==========================================
  // STEP 2: FORMULIR PASSWORD (CHALLENGE/PWD)
  // ==========================================
  function getPasswordInputElement() {
    const selectors = [
      'input[name="Passwd"]',
      'input[name="password"]',
      'input[type="password"]',
      'input[autocomplete="current-password"]',
      'input[aria-label*="password" i]',
      'input[aria-label*="sandi" i]'
    ];

    for (const sel of selectors) {
      const elements = document.querySelectorAll(sel);
      for (const el of elements) {
        if (isVisible(el) && !el.disabled && !el.readOnly && el.getAttribute('aria-hidden') !== 'true') {
          return el;
        }
      }
    }
    return null;
  }

  function getPasswordNextButton() {
    const direct = document.querySelector('#passwordNext button, #passwordNext, #confirmidentifierNext button, #confirmidentifierNext');
    if (direct && isVisible(direct)) return direct;

    const allButtons = Array.from(document.querySelectorAll('button, div[role="button"]'));
    for (const b of allButtons) {
      const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
      if ((txt === 'next' || txt === 'berikutnya' || txt === 'selanjutnya' || txt === 'masuk') && isVisible(b)) {
        return b;
      }
    }
    return null;
  }

  // ==========================================
  // STEP 3: "VERIFY IT'S YOU" (CONFIRM IDENTIFIER)
  // ==========================================
  let isHandlingVerify = false;
  async function checkAndHandleVerifyItsYouScreen() {
    if (isHandlingVerify || !isExtensionValid()) return false;
    const url = window.location.href.toLowerCase();
    const bodyText = (document.body.innerText || '').toLowerCase();

    const isVerifyScreen = url.includes('confirmidentifier') ||
                           url.includes('challenge/reauth') ||
                           bodyText.includes("verify it's you") ||
                           bodyText.includes("verifikasi bahwa ini memang anda") ||
                           bodyText.includes("verifikasi diri anda") ||
                           bodyText.includes("to help keep your account secure") ||
                           bodyText.includes("untuk membantu menjaga keamanan akun anda");

    if (!isVerifyScreen) return false;

    const allButtons = Array.from(document.querySelectorAll('button, div[role="button"]'));
    const nextPatterns = ['next', 'berikutnya', 'selanjutnya', 'lanjutkan', 'continue'];

    for (const b of allButtons) {
      const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
      if (nextPatterns.some((p) => txt === p || txt.startsWith(p)) && isVisible(b)) {
        isHandlingVerify = true;
        log(`🛡️ [Verify It's You] Terdeteksi konfirmasi identitas! Mengklik tombol "${txt}" untuk menuju input password...`);
        b.click();
        await delay(1200);
        hasFilledPassword = false;
        isHandlingVerify = false;
        return true;
      }
    }

    return false;
  }

  // ==========================================
  // STEP 4: TERMS OF SERVICE / WELCOME SCREEN
  // ==========================================
  async function checkAndHandleTermsScreen() {
    const url = window.location.href.toLowerCase();
    const bodyText = (document.body.innerText || '').toLowerCase();

    const isTerms = url.includes('speedbump') ||
                    url.includes('workspacetermsofservice') ||
                    url.includes('consent') ||
                    bodyText.includes('welcome to your new account') ||
                    bodyText.includes('selamat datang di akun baru') ||
                    bodyText.includes('terms of service') ||
                    bodyText.includes('persyaratan layanan') ||
                    bodyText.includes('i agree') ||
                    bodyText.includes('saya setuju') ||
                    bodyText.includes('i understand') ||
                    bodyText.includes('saya mengerti');

    if (!isTerms) return false;

    log('📜 [Langkah Terms] Layar Terms of Service / Welcome terdeteksi! Mengonfirmasi persetujuan...');

    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
    document.documentElement.scrollTop = document.documentElement.scrollHeight;
    await delay(600);

    const buttons = Array.from(document.querySelectorAll('button'));
    const agreePatterns = ['i understand', 'saya mengerti', 'i agree', 'saya setuju', 'accept', 'terima', 'continue', 'lanjutkan', 'next', 'berikutnya'];

    for (const b of buttons) {
      const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
      if (agreePatterns.some(p => txt === p || txt.includes(p)) && isVisible(b)) {
        b.scrollIntoView();
        b.click();
        log(`✅ Berhasil klik persetujuan Terms: "${txt}"`);
        return true;
      }
    }
    return false;
  }

  // ==========================================
  // STEP 5: ACCOUNT CHOOSER (PILIH AKUN / GANTI AKUN)
  // ==========================================
  function checkAndHandleAccountPicker(targetEmail) {
    if (!targetEmail) return false;
    const url = window.location.href.toLowerCase();
    const bodyText = (document.body.innerText || '').toLowerCase();

    const isPicker = url.includes('accountchooser') ||
                     url.includes('chooseaccount') ||
                     url.includes('signinchooser') ||
                     bodyText.includes('choose an account') ||
                     bodyText.includes('pilih akun');

    if (!isPicker) return false;

    log(`👥 [Account Chooser] Memilih akun ${targetEmail}...`);

    const targetLower = targetEmail.toLowerCase().trim();
    const dataId = document.querySelector(`[data-identifier="${targetEmail}"]`);
    if (dataId && isVisible(dataId)) {
      dataId.click();
      return true;
    }

    const items = Array.from(document.querySelectorAll('li, div[role="button"], button'));
    for (const el of items) {
      const txt = (el.innerText || el.textContent || '').toLowerCase();
      if (txt.includes(targetLower) && isVisible(el)) {
        el.click();
        return true;
      }
    }

    for (const el of items) {
      const txt = (el.innerText || el.textContent || '').toLowerCase();
      if ((txt.includes('use another account') || txt.includes('gunakan akun lain') || txt.includes('tambahkan akun')) && isVisible(el)) {
        el.click();
        return true;
      }
    }
    return false;
  }

  // ==========================================
  // STEP 6: DETEKSI LOGIN SUKSES YANG VALID
  // ==========================================
  function checkLoginSuccess() {
    const url = window.location.href.toLowerCase();

    const isSuccess = url.includes('myaccount.google.com') ||
                      url.includes('accounts.google.com/manageaccount') ||
                      url.includes('accounts.google.com/b/');

    if (isSuccess && !url.includes('confirmidentifier') && !url.includes('challenge/pwd')) {
      log('🎉 LOGIN GOOGLE BERHASIL TERVERIFIKASI!');
      if (isExtensionValid()) {
        chrome.runtime.sendMessage({
          type: 'GOOGLE_LOGIN_SUCCESS',
          url: window.location.href
        }).catch(() => {});
      }
      return true;
    }
    return false;
  }

  // ==========================================
  // PIPELINE EKSEKUSI UTAMA (STATE MACHINE)
  // ==========================================
  let isStepRunning = false;
  let hasFilledEmail = false;
  let hasFilledPassword = false;

  async function runAutomationStep(credentials) {
    if (!isExtensionValid() || isStepRunning || !credentials || !credentials.email) return;
    isStepRunning = true;

    try {
      // 1. Cek Layar "Verify it's you" (Prioritas Tinggi)
      if (await checkAndHandleVerifyItsYouScreen()) {
        await delay(1200);
        isStepRunning = false;
        return;
      }

      // 2. Cek Login Selesai
      if (checkLoginSuccess()) {
        isStepRunning = false;
        return;
      }

      // 3. Cek Error / Something Went Wrong
      if (await checkAndHandleWrongOrErrorScreen()) {
        isStepRunning = false;
        return;
      }

      // 4. Cek Terms
      if (await checkAndHandleTermsScreen()) {
        await delay(2000);
        isStepRunning = false;
        return;
      }

      // 5. Cek Account Chooser
      if (checkAndHandleAccountPicker(credentials.email)) {
        await delay(2000);
        isStepRunning = false;
        return;
      }

      const passInput = getPasswordInputElement();
      const emailInput = getEmailInputElement();
      const targetLower = credentials.email.toLowerCase().trim();
      const bodyText = (document.body.innerText || '').toLowerCase();

      // Cek jika akun lama tersangkut
      if (passInput && !bodyText.includes(targetLower) && !window.location.href.includes('confirmidentifier')) {
        const switchButtons = Array.from(document.querySelectorAll('button, div[role="button"], a, div[aria-label]'));
        for (const btn of switchButtons) {
          const txt = (btn.innerText || btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
          if ((txt.includes('not you') || txt.includes('bukan anda') || txt.includes('switch account') || txt.includes('ganti akun') || txt.includes('use another account') || txt.includes('gunakan akun lain')) && isVisible(btn)) {
            log('🔄 Terdeteksi akun lama tersangkut! Mengklik tombol ganti akun...');
            btn.click();
            await delay(1500);
            isStepRunning = false;
            return;
          }
        }
      }

      // 6. Tahap Pengisian Password (Dengan Pengecekan Kondisi Real & Fallback Master Password)
      if (passInput) {
        let passwordToUse = credentials.password;
        if (!passwordToUse) {
          const st = await new Promise((r) => chrome.storage.local.get(['masterGooglePassword'], r));
          if (st?.masterGooglePassword) {
            passwordToUse = st.masterGooglePassword;
          }
        }

        if (!passwordToUse) {
          log(`⚠️ Layar password terdeteksi untuk ${credentials.email}, tetapi kata sandi belum terisi di data sesi. Silakan masukkan di kotak Master Password di Side Panel.`);
          isStepRunning = false;
          return;
        }

        // Auto-recovery jika muncul pesan error "Enter a password" atau input masih kosong
        if (passInput.value.length === 0 || bodyText.includes('enter a password') || bodyText.includes('masukkan sandi')) {
          hasFilledPassword = false;
        }

        if (!hasFilledPassword) {
          log(`⏳ [Tahap Password] Menunggu animasi stabil...`);
          await delay(800);

          // Focus & Click ke input password
          passInput.focus();
          passInput.click();
          await delay(250);

          log(`🔑 [Tahap Password] Mengisi kata sandi ke input password...`);
          fillNativeInput(passInput, passwordToUse);
          await delay(400);

          // Cek REAL CONDITION: Apakah password benar-benar sudah ada di value?
          let isPasswordFilled = passInput.value && passInput.value.length > 0;
          
          if (!isPasswordFilled) {
            log('🔄 Mencoba metode insertText langsung untuk mengisi kata sandi...');
            try {
              document.execCommand('insertText', false, passwordToUse);
            } catch (e) {}
            await delay(300);
            isPasswordFilled = passInput.value && passInput.value.length > 0;
          }

          // HANYA KLIK NEXT JIKA REAL VALUE PASSWORD SUDAH TERISI
          if (isPasswordFilled) {
            log(`✅ Password terverifikasi terisi (${passInput.value.length} karakter). Mengklik Next...`);
            const passBtn = getPasswordNextButton();
            if (passBtn) {
              passBtn.click();
            } else {
              passInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
            }

            hasFilledPassword = true;
            await delay(2500);
          } else {
            log('⚠️ Gagal mengisi nilai password ke elemen input! Akan dicoba ulang di siklus berikutnya.');
          }
        }
        isStepRunning = false;
        return;
      }

      // 7. Tahap Pengisian Email
      if (emailInput && !passInput && credentials.email) {
        if (!hasFilledEmail) {
          await delay(400);
          emailInput.focus();
          log(`📧 [Tahap Email] Mengisi email: ${credentials.email}...`);
          fillNativeInput(emailInput, credentials.email);
          await delay(400);

          if (emailInput.value && emailInput.value.length > 0) {
            const emailBtn = getEmailNextButton();
            if (emailBtn) {
              log(`🖱️ Mengklik tombol Next email...`);
              emailBtn.click();
            } else {
              log(`🔄 Menekan tombol Enter untuk submit email...`);
              emailInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
            }

            hasFilledEmail = true;
            await delay(2000);
          }
        }
        isStepRunning = false;
        return;
      }

    } catch (err) {
      log(`⚠️ Error otomatisasi: ${err.message}`);
    } finally {
      isStepRunning = false;
    }
  }

  // Poller interval dengan auto-cleanup dan proteksi ketat
  const pollerId = setInterval(() => {
    if (!isExtensionValid()) {
      clearInterval(pollerId);
      return;
    }
    try {
      chrome.storage.local.get(['activeGoogleLogin', 'isAutoLoginActive'], (res) => {
        if (!isExtensionValid() || chrome.runtime.lastError) return;
        if (res?.isAutoLoginActive === true && res?.activeGoogleLogin && res?.activeGoogleLogin?.email) {
          runAutomationStep(res.activeGoogleLogin);
        }
      });
    } catch (e) {
      clearInterval(pollerId);
    }
  }, 500);

  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.type === 'START_GOOGLE_LOGIN_STEP') {
      hasFilledEmail = false;
      hasFilledPassword = false;
      runAutomationStep(req.credentials);
      sendResponse({ status: 'started' });
    }
    return true;
  });

  log('🟢 Extension Content Script siap memproses login Google & konfirmasi akun.');
})();
