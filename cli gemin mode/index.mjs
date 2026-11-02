import readline from 'node:readline';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SERVER_URL = 'http://127.0.0.1:3000';
const POLL_INTERVAL_MS = 5_000;
let serverUrl = DEFAULT_SERVER_URL;
let sessionToken = '';
let currentUser = '';
let selectedAccount = null;
let pendingTask = null;
let alternateScreenActive = false;
let rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(message) {
  return new Promise((resolve) => rl.question(message, (answer) => resolve(answer.trim())));
}

function clearScreen() {
  if (process.stdout.isTTY) process.stdout.write('\u001B[2J\u001B[H');
}

function enterAlternateScreen() {
  if (!process.stdout.isTTY || alternateScreenActive) return;
  process.stdout.write('\u001B[?1049h\u001B[2J\u001B[H');
  alternateScreenActive = true;
}

function leaveAlternateScreen() {
  if (!alternateScreenActive) return;
  process.stdout.write('\u001B[?1049l');
  alternateScreenActive = false;
}

async function waitForEnter() {
  await ask('\nTekan Enter untuk kembali ke menu...');
}

function normalizeLoopbackUrl(value) {
  const parsed = new URL(value);
  const validHost = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (!validHost || !['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Demi keamanan, server URL CLI hanya boleh localhost/127.0.0.1/::1.');
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

async function request(path, { method = 'GET', body, timeoutMs = 30_000, authenticated = true, allowFailure = false } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (authenticated && sessionToken) headers.Authorization = `Bearer ${sessionToken}`;

    const response = await fetch(`${serverUrl}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!data || typeof data !== 'object') {
      throw new Error(`Respons server tidak valid (HTTP ${response.status}).`);
    }
    if (!response.ok || (data.success === false && !allowFailure)) {
      throw new Error(data.error || data.errorMessage || `Request gagal (HTTP ${response.status}).`);
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Request ke server melewati batas waktu.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readHidden(label = 'Password') {
  rl.close();
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    throw new Error('Input rahasia membutuhkan terminal interaktif (TTY).');
  }

  return new Promise((resolve, reject) => {
    let password = '';
    const input = process.stdin;
    const onData = (chunk) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\u0003') {
          cleanup();
          reject(new Error('Login dibatalkan.'));
          return;
        }
        if (char === '\r' || char === '\n') {
          process.stdout.write('\n');
          cleanup();
          resolve(password);
          return;
        }
        if (char === '\u007f' || char === '\b') {
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        if (char >= ' ' && char !== '\u007f') {
          password += char;
          process.stdout.write('*');
        }
      }
    };
    const cleanup = () => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      rl = readline.createInterface({ input, output: process.stdout });
    };
    process.stdout.write(`${label}: `);
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

async function readPassword() {
  return readHidden('Password');
}

async function login() {
  while (!sessionToken) {
    const username = await ask('Username AMB Media: ');
    if (!username) {
      console.log('Username wajib diisi.');
      continue;
    }

    let password = '';
    try {
      password = await readPassword();
      const result = await request('/auth/login', {
        method: 'POST',
        body: { username, password },
        authenticated: false,
      });
      if (!result.sessionToken) throw new Error('Server tidak mengembalikan token sesi CLI.');
      sessionToken = result.sessionToken;
      currentUser = result.user?.userName || username;
      console.log(`\nLogin berhasil sebagai ${currentUser}.`);
    } catch (error) {
      console.log(`\nLogin gagal: ${error.message}`);
    } finally {
      password = '';
    }
  }
}

async function refreshAccounts() {
  const result = await request('/cli/gemini/accounts');
  return Array.isArray(result.accounts) ? result.accounts : [];
}

function printAccounts(accounts) {
  if (!accounts.length) {
    console.log('Belum ada akun Gemini untuk user ini.');
    return;
  }
  console.log('\nAkun Gemini user aktif:');
  accounts.forEach((account, index) => {
    const syncStatus = account.creditSyncStatus === 'synced' ? 'tersinkron' : 'belum sinkron';
    const status = account.isActive ? account.accountStatus : 'nonaktif';
    console.log(
      `${index + 1}. ${account.name || account.email || account.id} | ${account.email || '-'} | ` +
      `${account.credits}/${account.totalCredits} kredit | ${syncStatus} | ${status}`
    );
  });
}

async function chooseAccount(accounts = null) {
  const currentAccounts = accounts || await refreshAccounts();
  printAccounts(currentAccounts);
  if (!currentAccounts.length) return null;

  const answer = await ask('Pilih nomor akun (kosong untuk batal): ');
  if (!answer) return null;
  const index = Number(answer) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= currentAccounts.length) {
    console.log('Nomor akun tidak valid.');
    return null;
  }
  selectedAccount = currentAccounts[index];
  return selectedAccount;
}

async function synchronizeAccount(account = selectedAccount) {
  if (!account) {
    console.log('Pilih akun Gemini terlebih dahulu.');
    return null;
  }
  console.log(`Memeriksa sesi dan kredit ${account.email || account.name}...`);
  const result = await request(`/cli/gemini/accounts/${encodeURIComponent(account.id)}/sync`, {
    method: 'POST',
    body: {},
    timeoutMs: 180_000,
  });
  console.log(
    `Status: ${result.accountStatus || 'unknown'} | Kredit: ${result.remainingCredits ?? 0}/${result.totalCredits ?? 2} | ` +
    `Ledger: ${result.ledgerKnown ? 'tersinkron' : 'belum diketahui'}`
  );
  if (typeof result.localTaskUsage === 'number') {
    console.log(`Generate yang tercatat di AMB Media: ${result.localTaskUsage}/${result.totalCredits ?? 2} kredit.`);
  }
  if (result.error) console.log(`Info: ${result.error}`);
  if (result.statusMessage) console.log(`Info: ${result.statusMessage}`);

  const updatedAccounts = await refreshAccounts();
  selectedAccount = updatedAccounts.find((item) => item.id === account.id) || account;
  return result;
}

async function selectAndSync(account = selectedAccount) {
  const chosenAccount = account || await chooseAccount();
  if (!chosenAccount) return false;
  try {
    const result = await synchronizeAccount(chosenAccount);
    return result?.success === true && result.ledgerKnown === true && result.accountStatus === 'active';
  } catch (error) {
    console.log(`Sinkronisasi gagal: ${error.message}`);
    return false;
  }
}

async function readSelection(label, options) {
  console.log(`\n${label}:`);
  options.forEach((option, index) => console.log(`${index + 1}. ${option.label}`));
  const answer = await ask('Pilih nomor: ');
  const index = Number(answer) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= options.length) {
    throw new Error('Pilihan tidak valid.');
  }
  return options[index].value;
}

async function pollTask(task, { quiet = false } = {}) {
  console.log(`Memantau task ${task.operationName} pada akun ${task.account.email || task.account.name}...`);
  while (true) {
    try {
      const result = await request('/cli/gemini/video-status', {
        method: 'POST',
        body: { accountId: task.account.id, operationName: task.operationName },
        timeoutMs: 180_000,
        allowFailure: true,
      });
      if (result.done === true || result.status === 'completed' || result.status === 'failed') {
        pendingTask = null;
        if (result.status === 'completed' && result.videoUrl) {
          console.log(`\nVideo selesai: ${result.videoUrl}`);
        } else {
          console.log(`\nTask ${result.status || 'selesai'}: ${result.error || result.errorMessage || 'Tidak ada detail.'}`);
        }
        if (result.creditBypassed || task.creditBypassed) {
          console.log('Mode test CLI: kredit internal tidak dipotong.');
        } else if (typeof result.remainingCredits === 'number') {
          console.log(`Sisa kredit server: ${result.remainingCredits}/${result.totalCredits ?? 2}`);
        }
        return result;
      }
      if (!quiet) {
        const elapsed = Number.isFinite(result.elapsedSeconds) ? ` (${result.elapsedSeconds} detik)` : '';
        console.log(`Masih diproses${elapsed}...`);
      }
    } catch (error) {
      console.log(`Polling gagal: ${error.message}`);
      const retry = (await ask('Coba polling task yang sama lagi? [Y/n]: ')).toLowerCase();
      if (retry === 'n') {
        console.log(`Task tetap dapat dilanjutkan nanti dengan operation/task ID: ${task.operationName}`);
        return null;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function generateVideo() {
  if (!selectedAccount) {
    selectedAccount = await chooseAccount();
    if (!selectedAccount) return;
  }
  if (!(await selectAndSync(selectedAccount))) return;
  if (selectedAccount.creditSyncStatus !== 'synced') {
    console.log('Generate diblokir: saldo harus tersinkron sebelum testing.');
    return;
  }

  const prompt = await ask('\nPrompt text-to-video: ');
  if (!prompt) {
    console.log('Prompt wajib diisi.');
    return;
  }
  if (prompt.length > 10_000) {
    console.log('Prompt maksimal 10.000 karakter.');
    return;
  }

  const aspectRatio = await readSelection('Aspect ratio', [
    { label: '9:16 (default)', value: '9:16' },
    { label: '16:9', value: '16:9' },
    { label: '1:1', value: '1:1' },
    { label: '4:3', value: '4:3' },
    { label: '3:4', value: '3:4' },
  ]);
  const duration = await readSelection('Durasi', [
    { label: '10 detik (default)', value: '10s' },
    { label: '5 detik', value: '5s' },
    { label: '6 detik', value: '6s' },
    { label: '8 detik', value: '8s' },
  ]);
  const resolution = await readSelection('Resolusi', [
    { label: '1080p (default)', value: '1080p' },
    { label: '720p', value: '720p' },
  ]);

  const confirm = (await ask(
    `\nMode test CLI: generate dengan akun ${selectedAccount.email || selectedAccount.name} meski saldo internal ${selectedAccount.credits}/2? ` +
    'Kredit internal tidak dipotong, tetapi kuota Google tetap berlaku. [y/N]: '
  )).toLowerCase();
  if (confirm !== 'y' && confirm !== 'yes') {
    console.log('Generate dibatalkan.');
    return;
  }

  try {
    const result = await request('/cli/gemini/generate-video', {
      method: 'POST',
      body: { accountId: selectedAccount.id, prompt, aspectRatio, duration, resolution },
      timeoutMs: 210_000,
    });
    console.log(result.message || 'Task generate diterima server.');
    if (result.creditBypassed) {
      console.log('Mode test CLI aktif: kredit internal tidak dipotong.');
    } else if (typeof result.remainingCredits === 'number') {
      console.log(`Sisa kredit server: ${result.remainingCredits}/${result.totalCredits ?? 2}`);
    }
    const operationName = result.operationName || result.taskId;
    if (result.status === 'processing' && operationName) {
      pendingTask = { operationName, account: selectedAccount, creditBypassed: result.creditBypassed === true };
      await pollTask(pendingTask);
    } else if (result.videoUrl) {
      console.log(`Video: ${result.videoUrl}`);
    } else {
      console.log(`Task ID: ${operationName || 'tidak tersedia'}`);
    }
    const accounts = await refreshAccounts();
    selectedAccount = accounts.find((item) => item.id === selectedAccount.id) || selectedAccount;
  } catch (error) {
    console.log(`Generate gagal: ${error.message}`);
  }
}

async function watchPlaywrightSession(sessionId) {
  let printedLogs = 0;
  while (true) {
    try {
      const state = await request(`/cli/gemini/settings/playwright/session/${encodeURIComponent(sessionId)}`, {
        timeoutMs: 240_000,
      });
      console.log(`\n${state.status}: ${state.currentStep || '-'}`);
      const logs = Array.isArray(state.logs) ? state.logs : [];
      logs.slice(printedLogs).forEach((line) => console.log(line));
      printedLogs = logs.length;

      if (state.status === 'awaiting_2fa') {
        console.log(state.challengePrompt || 'Google membutuhkan verifikasi tambahan.');
        const code = await readHidden('Kode 2FA (Enter cek ulang, c batal, q berhenti memantau)');
        if (code.toLowerCase() === 'c') {
          await request(`/cli/gemini/settings/playwright/session/${encodeURIComponent(sessionId)}/cancel`, {
            method: 'POST',
            body: {},
          });
        } else if (code.toLowerCase() === 'q') {
          console.log(`Sesi tetap berjalan. ID sesi: ${sessionId}`);
          return;
        } else if (code) {
          await request(`/cli/gemini/settings/playwright/session/${encodeURIComponent(sessionId)}/2fa`, {
            method: 'POST',
            body: { code },
          });
        }
        continue;
      }
      if (['success', 'error', 'cancelled'].includes(state.status)) {
        if (state.error) console.log(`Proses gagal: ${state.error}`);
        if (state.accountSaved && state.account) {
          console.log(`Akun tersimpan: ${state.account.email} (${state.account.id}).`);
          if (state.creditSyncError) console.log(`Peringatan sinkronisasi kredit: ${state.creditSyncError}`);
          const accounts = await refreshAccounts();
          selectedAccount = accounts.find((account) => account.id === state.account.id) || selectedAccount;
        }
        return;
      }

      const action = (await ask('[Enter] refresh status/log | c batalkan | q berhenti memantau: ')).toLowerCase();
      if (action === 'c') {
        await request(`/cli/gemini/settings/playwright/session/${encodeURIComponent(sessionId)}/cancel`, {
          method: 'POST',
          body: {},
        });
      } else if (action === 'q') {
        console.log(`Sesi tetap berjalan. ID sesi: ${sessionId}`);
        return;
      }
    } catch (error) {
      console.log(`Status Playwright gagal dibaca: ${error.message}`);
      const retry = (await ask('Coba lagi? [Y/n]: ')).toLowerCase();
      if (retry === 'n') return;
    }
  }
}

async function watchPlaywrightBatch(batchId) {
  let printedLogs = 0;
  while (true) {
    try {
      const state = await request(`/cli/gemini/settings/playwright/batch/${encodeURIComponent(batchId)}`, {
        timeoutMs: 600_000,
      });
      console.log(
        `\nBatch ${state.completed}/${state.total} | berhasil ${state.successful} | gagal ${state.failed} | ` +
        `dilewati ${state.skipped} | status ${state.status}` +
        (state.currentEmail ? ` | proses: ${state.currentEmail}` : '')
      );
      const logs = Array.isArray(state.logs) ? state.logs : [];
      logs.slice(printedLogs).forEach((line) => console.log(line));
      printedLogs = logs.length;
      (state.savedAccounts || []).forEach((account) => {
        console.log(`Akun tersimpan: ${account.email} (${account.id}).`);
        if (account.creditSyncError) console.log(`Peringatan sinkronisasi kredit: ${account.creditSyncError}`);
      });
      (state.saveErrors || []).forEach((item) => console.log(`Gagal menyimpan ${item.email}: ${item.error}`));
      if (state.status !== 'running') {
        const accounts = await refreshAccounts();
        if (selectedAccount) selectedAccount = accounts.find((account) => account.id === selectedAccount.id) || null;
        return;
      }

      const action = (await ask('[Enter] refresh status/log | c batalkan batch | q berhenti memantau: ')).toLowerCase();
      if (action === 'c') {
        await request(`/cli/gemini/settings/playwright/batch/${encodeURIComponent(batchId)}/cancel`, {
          method: 'POST',
          body: {},
        });
      } else if (action === 'q') {
        console.log(`Batch tetap berjalan. ID batch: ${batchId}`);
        return;
      }
    } catch (error) {
      console.log(`Status batch gagal dibaca: ${error.message}`);
      const retry = (await ask('Coba lagi? [Y/n]: ')).toLowerCase();
      if (retry === 'n') return;
    }
  }
}

async function addPlaywrightAccount() {
  const email = await ask('Email Google baru: ');
  if (!email.includes('@')) {
    console.log('Email tidak valid.');
    return;
  }
  const password = await readHidden('Password Google');
  if (!password) {
    console.log('Password wajib diisi.');
    return;
  }
  const started = await request('/cli/gemini/settings/playwright/start', {
    method: 'POST',
    body: { email, password },
  });
  console.log(`Playwright dimulai untuk ${email}. Session ID: ${started.sessionId}`);
  await watchPlaywrightSession(started.sessionId);
}

async function addPlaywrightBatch() {
  const emailText = await ask('Email Google (pisahkan dengan koma): ');
  const emails = [...new Set(emailText.split(/[,\s]+/).map((email) => email.trim()).filter(Boolean))];
  if (!emails.length || emails.some((email) => !email.includes('@'))) {
    console.log('Masukkan minimal satu daftar email yang valid.');
    return;
  }
  const password = await readHidden('Password Google untuk semua akun');
  if (!password) {
    console.log('Password wajib diisi.');
    return;
  }
  const started = await request('/cli/gemini/settings/playwright/batch', {
    method: 'POST',
    body: { emails, password },
  });
  console.log(`Batch dimulai: ${started.total} email, ${started.skippedCount} dilewati. Batch ID: ${started.batchId}`);
  await watchPlaywrightBatch(started.batchId);
}

async function reloginPlaywrightAccount() {
  const account = await chooseAccount();
  if (!account) return;
  let result;
  try {
    result = await request('/cli/gemini/settings/playwright/relogin', {
      method: 'POST',
      body: { accountId: account.id },
    });
  } catch (error) {
    if (!/Password profil Playwright belum tersimpan/i.test(error.message)) throw error;
    console.log(error.message);
    const password = await readHidden('Password Google');
    if (!password) {
      console.log('Password wajib diisi.');
      return;
    }
    result = await request('/cli/gemini/settings/playwright/relogin', {
      method: 'POST',
      body: { accountId: account.id, password },
    });
  }
  console.log(`Relogin dimulai untuk ${account.email}. Session ID: ${result.sessionId}`);
  await watchPlaywrightSession(result.sessionId);
}

async function verifyCookieCredential(credential, label = '') {
  const result = await request('/cli/gemini/settings/cookie/verify', {
    method: 'POST',
    body: { credential, label },
    timeoutMs: 240_000,
  });
  console.log(`${result.message || 'Akun tersimpan'} ${result.account?.email || ''}`);
  if (result.creditSyncError) console.log(`Peringatan sinkronisasi kredit: ${result.creditSyncError}`);
  const accounts = await refreshAccounts();
  if (!selectedAccount && result.account) {
    selectedAccount = accounts.find((account) => account.id === result.account.id) || null;
  }
}

async function addCookieAccount() {
  console.log('Paste cookie sesi Google atau cURL Gemini. Input tidak ditampilkan.');
  const credential = await readHidden('Cookie/cURL');
  if (!credential) {
    console.log('Cookie/cURL wajib diisi.');
    return;
  }
  const label = await ask('Nama kustom (opsional): ');
  await verifyCookieCredential(credential, label);
}

async function importCookieBatch() {
  const count = Number(await ask('Jumlah cookie/cURL yang akan diimpor (1-50): '));
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    console.log('Jumlah harus antara 1 sampai 50.');
    return;
  }
  for (let index = 0; index < count; index++) {
    console.log(`\nAkun ${index + 1}/${count}`);
    const credential = await readHidden('Cookie/cURL');
    if (!credential) {
      console.log('Credential kosong; akun ini dilewati.');
      continue;
    }
    try {
      await verifyCookieCredential(credential);
    } catch (error) {
      console.log(`Import akun ${index + 1} gagal: ${error.message}`);
    }
  }
}

async function saveLocalPlaywrightScript() {
  const choice = await readSelection('Script Runner Lokal', [
    { label: 'Simpan Node.js', value: 'node' },
    { label: 'Simpan Python', value: 'python' },
  ]);
  if (!choice) return;
  const scripts = await request('/cli/gemini/settings/scripts');
  const isNode = choice === 'node';
  const filename = isNode ? 'login-gemini.js' : 'login_gemini.py';
  const script = isNode ? scripts.nodeScript : scripts.pythonScript;
  if (typeof script !== 'string' || !script) throw new Error('Script tidak tersedia dari server.');
  const confirm = (await ask(`Simpan script lokal ke .\\${filename}? File yang sudah ada tidak akan ditimpa. [y/N]: `)).toLowerCase();
  if (confirm !== 'y' && confirm !== 'yes') return;
  await fs.writeFile(path.resolve(process.cwd(), filename), script, { flag: 'wx', mode: 0o600 });
  console.log(`Script tersimpan di ${path.resolve(process.cwd(), filename)}. Script tidak memuat kredensial akun.`);
}

async function settingsMenu() {
  clearScreen();
  console.log('\nSettings — Gemini');
  console.log('1. Tambah akun dengan Playwright (single)');
  console.log('2. Tambah akun dengan Playwright (batch)');
  console.log('3. Relogin akun terpilih');
  console.log('4. Tambah sesi lewat Cookie / cURL');
  console.log('5. Import Cookie / cURL batch');
  console.log('6. Simpan Script Runner Lokal (Node/Python)');
  console.log('7. Lanjutkan status/log sesi Playwright');
  console.log('8. Lanjutkan status/log batch Playwright');
  console.log('9. Refresh dan tampilkan akun Gemini');
  console.log('0. Kembali');
  const choice = await ask('Pilih menu Settings: ');
  try {
    switch (choice) {
      case '1': await addPlaywrightAccount(); break;
      case '2': await addPlaywrightBatch(); break;
      case '3': await reloginPlaywrightAccount(); break;
      case '4': await addCookieAccount(); break;
      case '5': await importCookieBatch(); break;
      case '6': await saveLocalPlaywrightScript(); break;
      case '7': {
        const sessionId = await ask('Masukkan Session ID: ');
        if (sessionId) await watchPlaywrightSession(sessionId);
        break;
      }
      case '8': {
        const batchId = await ask('Masukkan Batch ID: ');
        if (batchId) await watchPlaywrightBatch(batchId);
        break;
      }
      case '9':
        printAccounts(await refreshAccounts());
        break;
      case '0': return;
      default: console.log('Pilihan Settings tidak valid.');
    }
  } catch (error) {
    console.log(`Settings gagal: ${error.message}`);
  }
  await waitForEnter();
}

async function logout() {
  sessionToken = '';
  currentUser = '';
  selectedAccount = null;
  pendingTask = null;
  console.log('Sesi CLI dihapus dari memori. Silakan login dengan user AMB Media lain.');
  await login();
}

async function runMenu() {
  clearScreen();
  console.log(`\nAMB Media — Gemini Video CLI | User: ${currentUser}`);
  console.log('1. Lihat/pilih akun Gemini');
  console.log('2. Sinkronkan akun terpilih');
  console.log('3. Generate text-to-video');
  console.log('4. Settings');
  console.log('5. Logout / ganti user');
  console.log('0. Keluar');

  const choice = await ask('Pilih menu: ');
  let shouldWait = true;
  try {
    switch (choice) {
      case '1':
        await chooseAccount();
        break;
      case '2':
        if (!selectedAccount) selectedAccount = await chooseAccount();
        if (selectedAccount) await synchronizeAccount();
        break;
      case '3':
        await generateVideo();
        break;
      case '4':
        await settingsMenu();
        shouldWait = false;
        break;
      case '5':
        await logout();
        shouldWait = false;
        break;
      case '0':
        sessionToken = '';
        console.log('Sesi CLI dihapus. Sampai jumpa.');
        return false;
      default:
        console.log('Pilihan menu tidak valid.');
    }
  } catch (error) {
    console.log(`Gagal: ${error.message}`);
  }
  if (shouldWait) await waitForEnter();
  return true;
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('CLI Gemini Mode membutuhkan terminal interaktif.');
  }
  enterAlternateScreen();
  serverUrl = normalizeLoopbackUrl(process.env.AMB_MEDIA_SERVER_URL || DEFAULT_SERVER_URL);
  const health = await request('/auth/status', { authenticated: false, timeoutMs: 10_000 });
  if (health.success !== true) throw new Error('Server AMB Media tidak siap.');
  console.log(`Terhubung ke server ${serverUrl}.`);
  await login();

  let running = true;
  while (running) running = await runMenu();
  rl.close();
  leaveAlternateScreen();
}

main().catch((error) => {
  leaveAlternateScreen();
  console.error(`CLI berhenti: ${error.message}`);
  sessionToken = '';
  rl.close();
  process.exitCode = 1;
});
