import express, { Request, Response } from 'express';
import { createRequire } from 'module';
import {
  getProviderAccountsFromSheet,
  invalidateProviderAccountsCache,
  saveProviderAccountsToSheet,
} from '../utils/sheets';
import { AuthenticatedUser, verifyUserSessionToken } from '../utils/userSession';
import { GEMINI_VIDEO_CREDIT_LIMIT } from '../utils/geminiCreditLedger';
import { isCliGeminiTestTask, issueCliGeminiTestPermit } from '../utils/cliGeminiTestMode';

const require = createRequire(import.meta.url);
const router = express.Router();
type GeminiPlaywrightManager = typeof import('../services/geminiPlaywright').geminiPlaywrightManager;

function getGeminiPlaywrightManager(): GeminiPlaywrightManager {
  return require('../services/geminiPlaywright').geminiPlaywrightManager;
}

const allowedAspectRatios = new Set(['16:9', '9:16', '1:1', '4:3', '3:4']);
const allowedDurations = new Set(['5s', '6s', '8s', '10s']);
const allowedResolutions = new Set(['1080p', '720p']);
const playwrightSessions = new Map<string, {
  userId: string;
  expectedEmail: string;
  accountId?: string;
  persisted?: boolean;
}>();
const playwrightBatches = new Map<string, { userId: string; persistedEmails: Set<string> }>();

function getAuthenticatedUser(req: Request): AuthenticatedUser | null {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? verifyUserSessionToken(match[1]) : null;
}

function sendUnauthorized(res: Response) {
  return res.status(401).json({ success: false, error: 'Sesi CLI tidak valid atau kedaluwarsa. Silakan login kembali.' });
}

function getAccountCredential(account: any): string {
  return String(account?.cookies || account?.token || account?.refreshToken || account?.apiKey || '').trim();
}

async function findUserGeminiAccount(userId: string, accountId: string) {
  const accounts = await getProviderAccountsFromSheet(userId, 'gemini', true, true);
  return accounts.find((account: any) =>
    String(account.id || '') === accountId || String(account.email || '').toLowerCase() === accountId.toLowerCase()
  ) || null;
}

function sanitizePlaywrightLog(value: unknown): string {
  return String(value || '')
    .replace(/((?:cookie|token|password|authorization|sid|api[_ -]?key)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
    .replace(/((?:SAPISID|SID|__Secure-[\w-]+)=)[^;\s]+/gi, '$1[redacted]');
}

function sanitizePlaywrightAccount(account: any) {
  if (!account) return undefined;
  return {
    id: String(account.id || ''),
    name: String(account.displayName || account.name || account.email || 'Akun Gemini'),
    displayName: String(account.displayName || account.name || account.email || 'Akun Gemini'),
    email: String(account.email || ''),
    tier: String(account.tier || 'Google Gemini (Web Session)'),
    isActive: account.isActive === true,
  };
}

async function persistVerifiedAccount(userId: string, account: any, expectedEmail: string, req: Request) {
  const email = String(account?.email || '').trim();
  if (!email || (expectedEmail && email.toLowerCase() !== expectedEmail.trim().toLowerCase())) {
    throw new Error('Email hasil verifikasi Google tidak cocok dengan akun yang diminta; akun tidak disimpan.');
  }
  const credential = String(account.token || account.cookies || account.refreshToken || '').trim();
  if (!credential) throw new Error('Sesi akun terverifikasi tidak memiliki kredensial yang dapat disimpan.');

  let accountToSave = account;
  let creditSyncError: string | undefined;
  try {
    const sync = await callInternalApi(req, '/gemini/accounts/sync-daily', {
      token: credential,
      email,
    }, 180_000);
    if (sync.status >= 200 && sync.status < 300 && sync.data.success === true && sync.data.ledgerKnown === true) {
      accountToSave = {
        ...account,
        credits: sync.data.remainingCredits,
        totalCredits: sync.data.totalCredits,
        creditsUsed: sync.data.used ?? sync.data.usedTotal,
        ledgerKnown: true,
        creditSyncStatus: 'synced',
      };
    } else {
      creditSyncError = sync.data.error || sync.data.statusMessage || 'Ledger kredit belum dapat dikonfirmasi.';
    }
  } catch (error: any) {
    creditSyncError = error.message || 'Gagal menyinkronkan ledger kredit akun.';
  }

  invalidateProviderAccountsCache('gemini');
  const existingAccounts = await getProviderAccountsFromSheet(userId, 'gemini', true, true);
  const existingIndex = existingAccounts.findIndex((item: any) =>
    String(item.email || '').trim().toLowerCase() === email.toLowerCase()
  );
  const previous = existingIndex >= 0 ? existingAccounts[existingIndex] : undefined;
  const newAccount = {
    ...previous,
    ...accountToSave,
    id: previous?.id || accountToSave.id || `acc-gemini-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    email,
    name: accountToSave.displayName || accountToSave.name || previous?.name || email,
    displayName: accountToSave.displayName || accountToSave.name || previous?.displayName || email,
    token: credential,
    refreshToken: credential,
    hasRefreshToken: true,
    providerId: 'gemini',
    credits: typeof accountToSave.credits === 'number' ? accountToSave.credits : (previous?.credits ?? 0),
    totalCredits: GEMINI_VIDEO_CREDIT_LIMIT,
    creditsUsed: typeof accountToSave.creditsUsed === 'number' ? accountToSave.creditsUsed : previous?.creditsUsed,
    creditSyncStatus: accountToSave.ledgerKnown === true ? 'synced' : (previous?.creditSyncStatus || 'unknown'),
    isActive: previous ? previous.isActive : !existingAccounts.some((item: any) => item.isActive),
  };
  const merged = existingAccounts.slice();
  if (existingIndex >= 0) merged[existingIndex] = newAccount;
  else merged.push(newAccount);
  await saveProviderAccountsToSheet(userId, 'gemini', merged);
  invalidateProviderAccountsCache('gemini');
  const refreshed = await getProviderAccountsFromSheet(userId, 'gemini', true, true);
  const savedAccount = refreshed.find((item: any) => item.email?.toLowerCase() === email.toLowerCase());
  if (!savedAccount) throw new Error('Akun telah dikirim ke Sheets tetapi tidak ditemukan saat dibaca ulang.');
  return { ...savedAccount, creditSyncError };
}

async function persistBatchResults(req: Request, userId: string, results: any[]) {
  const saved: Array<{ email: string; id: string; creditSyncError?: string }> = [];
  const errors: Array<{ email: string; error: string }> = [];
  for (const result of results) {
    if (!result?.success || !result.account?.email) continue;
    try {
      const account = await persistVerifiedAccount(userId, result.account, String(result.email || result.account.email), req);
      if (account) saved.push({
        email: account.email,
        id: account.id,
        creditSyncError: account.creditSyncError,
      });
    } catch (error: any) {
      errors.push({ email: String(result.email || ''), error: error.message || 'Gagal menyimpan akun terverifikasi.' });
    }
  }
  return { saved, errors };
}

function getOwnedPlaywrightSession(userId: string, sessionId: string) {
  const owner = playwrightSessions.get(sessionId);
  if (!owner || owner.userId !== userId) return null;
  return { owner, session: getGeminiPlaywrightManager().getSession(sessionId) };
}

function retainPlaywrightSession(sessionId: string, owner: { userId: string; expectedEmail: string; accountId?: string }) {
  playwrightSessions.set(sessionId, owner);
  const cleanup = setTimeout(() => playwrightSessions.delete(sessionId), 11 * 60 * 1000);
  cleanup.unref?.();
}

function retainPlaywrightBatch(batchId: string, userId: string) {
  playwrightBatches.set(batchId, { userId, persistedEmails: new Set() });
  const cleanup = setTimeout(() => playwrightBatches.delete(batchId), 60 * 60 * 1000);
  cleanup.unref?.();
}

async function verifyAndSaveCredential(req: Request, userId: string, credential: string, label: string) {
  const result = await callInternalApi(req, '/gemini/accounts/verify', {
    token: credential,
    customLabel: label,
  });
  if (result.status < 200 || result.status >= 300 || result.data.success !== true) {
    throw new Error(result.data.error || `Verifikasi gagal (HTTP ${result.status}).`);
  }
  const account = await persistVerifiedAccount(userId, result.data, String(result.data.email || label), req);
  if (!account) throw new Error('Akun terverifikasi tetapi tidak ditemukan setelah disimpan ke Google Sheets.');
  return account;
}

function getInternalApiBase(req: Request): string {
  const port = req.socket.localPort;
  if (!port) throw new Error('Tidak dapat menentukan port server lokal untuk meneruskan request Gemini.');
  return `http://127.0.0.1:${port}/api`;
}

async function callInternalApi(
  req: Request,
  endpoint: string,
  body: Record<string, unknown>,
  timeoutMs = 120_000,
  additionalHeaders: Record<string, string> = {},
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${getInternalApiBase(req)}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...additionalHeaders },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!data || typeof data !== 'object') {
      throw new Error(`Server Gemini mengembalikan respons tidak valid (HTTP ${response.status}).`);
    }
    return { status: response.status, data: data as Record<string, any> };
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizeAccount(account: any) {
  const credits = typeof account.credits === 'number'
    ? Math.max(0, Math.min(GEMINI_VIDEO_CREDIT_LIMIT, account.credits))
    : 0;
  return {
    id: String(account.id || account.email || ''),
    name: String(account.displayName || account.name || account.email || 'Akun Gemini'),
    email: String(account.email || ''),
    isActive: account.isActive === true,
    accountStatus: account.creditSyncStatus === 'synced' ? 'synced' : 'unchecked',
    credits,
    totalCredits: GEMINI_VIDEO_CREDIT_LIMIT,
    creditsUsed: typeof account.creditsUsed === 'number' ? account.creditsUsed : undefined,
    creditSyncStatus: account.creditSyncStatus === 'synced' ? 'synced' : 'unknown',
  };
}

function sanitizeGenerationResponse(data: Record<string, any>) {
  const allowedFields = [
    'success',
    'status',
    'done',
    'videoUrl',
    'mediaUrl',
    'operationName',
    'taskId',
    'prompt',
    'model',
    'duration',
    'aspectRatio',
    'remainingCredits',
    'totalCredits',
    'wasSwitched',
    'message',
    'error',
    'errorMessage',
    'elapsedSeconds',
    'statusUnknown',
    'refunded',
    'isQuotaExhausted',
    'creditBypassed',
  ];
  const safeData: Record<string, any> = {};
  for (const field of allowedFields) {
    if (data[field] !== undefined) safeData[field] = data[field];
  }
  const usedAccount = data.usedAccount;
  return {
    ...safeData,
    usedAccount: usedAccount
      ? {
          id: usedAccount.id,
          email: usedAccount.email,
          name: usedAccount.name,
        }
      : undefined,
  };
}

router.get('/cli/gemini/accounts', async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return sendUnauthorized(res);

  try {
    const accounts = await getProviderAccountsFromSheet(user.userId, 'gemini', true, true);
    return res.json({
      success: true,
      user: { userName: user.userName },
      accounts: accounts.map(sanitizeAccount),
    });
  } catch (error: any) {
    console.error('[CLI Gemini Accounts Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Gagal memuat akun Gemini user.',
    });
  }
});

router.post('/cli/gemini/settings/playwright/start', async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return sendUnauthorized(res);

  try {
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    if (!email.includes('@') || !password) {
      return res.status(400).json({ success: false, error: 'Email Google dan kata sandi wajib diisi.' });
    }
    const accounts = await getProviderAccountsFromSheet(user.userId, 'gemini', true, true);
    if (accounts.some((account: any) => String(account.email || '').trim().toLowerCase() === email.toLowerCase())) {
      return res.status(409).json({
        success: false,
        error: 'Email ini sudah terdaftar. Gunakan relogin dari akun yang dipilih.',
      });
    }
    const started = await getGeminiPlaywrightManager().startLogin({ email, password });
    retainPlaywrightSession(started.sessionId, { userId: user.userId, expectedEmail: email });
    return res.json({ success: true, ...started });
  } catch (error: any) {
    console.error('[CLI Gemini Playwright Start Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Gagal memulai Playwright Gemini.' });
  }
});

router.post('/cli/gemini/settings/playwright/relogin', async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return sendUnauthorized(res);

  try {
    const accountId = String(req.body?.accountId || '').trim();
    const account = await findUserGeminiAccount(user.userId, accountId);
    if (!account || !account.email || !String(account.email).includes('@')) {
      return res.status(404).json({ success: false, error: 'Akun Gemini tidak ditemukan untuk user yang sedang login.' });
    }
    const suppliedPassword = String(req.body?.password || '');
    const savedCredentials = suppliedPassword
      ? null
      : await getGeminiPlaywrightManager().getSavedCredentials(account.email);
    const password = suppliedPassword || savedCredentials?.password;
    if (!password) {
      return res.status(409).json({
        success: false,
        requiresPassword: true,
        error: 'Password profil Playwright belum tersimpan. Masukkan password Google untuk relogin.',
      });
    }
    const started = await getGeminiPlaywrightManager().startLogin({
      email: account.email,
      password,
      customLabel: account.displayName || account.name,
    });
    retainPlaywrightSession(started.sessionId, {
      userId: user.userId,
      expectedEmail: account.email,
      accountId: account.id,
    });
    return res.json({ success: true, ...started });
  } catch (error: any) {
    console.error('[CLI Gemini Playwright Relogin Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Gagal memulai relogin Gemini.' });
  }
});

router.post('/cli/gemini/settings/playwright/batch', async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return sendUnauthorized(res);

  try {
    const emails = Array.isArray(req.body?.emails)
      ? req.body.emails.map((email: unknown) => String(email || '').trim()).filter(Boolean)
      : [];
    const password = String(req.body?.password || '');
    if (!emails.length || emails.some((email: string) => !email.includes('@')) || !password) {
      return res.status(400).json({ success: false, error: 'Daftar email valid dan password batch wajib diisi.' });
    }
    const accounts = await getProviderAccountsFromSheet(user.userId, 'gemini', true, true);
    const started = await getGeminiPlaywrightManager().startBatchLogin({
      emails,
      password,
      existingEmails: accounts.map((account: any) => account.email).filter(Boolean),
    });
    retainPlaywrightBatch(started.batchId, user.userId);
    return res.json({ success: true, ...started });
  } catch (error: any) {
    console.error('[CLI Gemini Playwright Batch Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Gagal memulai batch Playwright Gemini.' });
  }
});

router.get('/cli/gemini/settings/playwright/session/:sessionId', async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return sendUnauthorized(res);

  try {
    const sessionId = String(req.params.sessionId || '');
    const owned = getOwnedPlaywrightSession(user.userId, sessionId);
    if (!owned || !owned.session) {
      return res.status(404).json({ success: false, error: 'Sesi Playwright tidak ditemukan, kedaluwarsa, atau bukan milik user ini.' });
    }
    if (owned.session.status === 'success' && !owned.session.account) {
      return res.status(500).json({ success: false, error: 'Playwright melaporkan sukses tanpa hasil akun yang dapat disimpan.' });
    }
    let savedAccount: any;
    if (owned.session.status === 'success' && owned.session.account && !owned.owner.persisted) {
      savedAccount = await persistVerifiedAccount(user.userId, owned.session.account, owned.owner.expectedEmail, req);
      owned.owner.persisted = true;
    }
    return res.json({
      success: true,
      sessionId,
      email: owned.session.email,
      status: owned.session.status,
      currentStep: owned.session.currentStep,
      challengeType: owned.session.challengeType,
      challengePrompt: owned.session.challengePrompt,
      error: owned.session.error ? sanitizePlaywrightLog(owned.session.error) : undefined,
      logs: owned.session.logs.slice(-100).map(sanitizePlaywrightLog),
      account: sanitizePlaywrightAccount(savedAccount || owned.session.account),
      accountSaved: owned.owner.persisted === true,
      creditSyncError: savedAccount?.creditSyncError,
    });
  } catch (error: any) {
    console.error('[CLI Gemini Playwright Status Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Gagal membaca status Playwright.' });
  }
});

router.post('/cli/gemini/settings/playwright/session/:sessionId/2fa', async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return sendUnauthorized(res);

  try {
    const sessionId = String(req.params.sessionId || '');
    const owned = getOwnedPlaywrightSession(user.userId, sessionId);
    const code = String(req.body?.code || '').trim();
    if (!owned || !owned.session) {
      return res.status(404).json({ success: false, error: 'Sesi Playwright tidak ditemukan atau bukan milik user ini.' });
    }
    if (!code) return res.status(400).json({ success: false, error: 'Kode verifikasi wajib diisi.' });
    await getGeminiPlaywrightManager().submit2FA(sessionId, code);
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[CLI Gemini Playwright 2FA Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Gagal mengirim kode verifikasi.' });
  }
});

router.post('/cli/gemini/settings/playwright/session/:sessionId/cancel', async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return sendUnauthorized(res);
  const sessionId = String(req.params.sessionId || '');
  const owned = getOwnedPlaywrightSession(user.userId, sessionId);
  if (!owned?.session) return res.status(404).json({ success: false, error: 'Sesi tidak ditemukan atau bukan milik user ini.' });
  try {
    await getGeminiPlaywrightManager().cancelSession(sessionId);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Gagal membatalkan sesi.' });
  }
});

router.get('/cli/gemini/settings/playwright/batch/:batchId', async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return sendUnauthorized(res);

  try {
    const batchId = String(req.params.batchId || '');
    const owner = playwrightBatches.get(batchId);
    const batch = owner?.userId === user.userId ? getGeminiPlaywrightManager().getBatch(batchId) : undefined;
    if (!owner || !batch) {
      return res.status(404).json({ success: false, error: 'Batch tidak ditemukan, kedaluwarsa, atau bukan milik user ini.' });
    }
    const unpersisted = batch.results.filter((result: any) =>
      result.success && result.account?.email && !owner.persistedEmails.has(String(result.account.email).toLowerCase())
    );
    const persistence = await persistBatchResults(req, user.userId, unpersisted);
    persistence.saved.forEach((item) => owner.persistedEmails.add(item.email.toLowerCase()));
    return res.json({
      success: true,
      batchId,
      total: batch.total,
      completed: batch.completed,
      successful: batch.successful,
      failed: batch.failed,
      skipped: batch.skipped,
      currentEmail: batch.currentEmail,
      status: batch.status,
      savedAccounts: persistence.saved,
      saveErrors: persistence.errors,
      results: batch.results.map((result: any) => ({
        email: result.email,
        success: result.success,
        status: result.status,
        error: result.error ? sanitizePlaywrightLog(result.error) : undefined,
        account: sanitizePlaywrightAccount(result.account),
      })),
      logs: batch.logs.slice(-150).map(sanitizePlaywrightLog),
    });
  } catch (error: any) {
    console.error('[CLI Gemini Playwright Batch Status Error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Gagal membaca status batch.' });
  }
});

router.post('/cli/gemini/settings/playwright/batch/:batchId/cancel', async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return sendUnauthorized(res);
  const batchId = String(req.params.batchId || '');
  const owner = playwrightBatches.get(batchId);
  if (!owner || owner.userId !== user.userId) {
    return res.status(404).json({ success: false, error: 'Batch tidak ditemukan atau bukan milik user ini.' });
  }
  try {
    await getGeminiPlaywrightManager().cancelBatch(batchId);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Gagal membatalkan batch.' });
  }
});

router.post('/cli/gemini/settings/cookie/verify', async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return sendUnauthorized(res);
  try {
    const credential = String(req.body?.credential || '').trim();
    const label = String(req.body?.label || '').trim();
    if (!credential) return res.status(400).json({ success: false, error: 'Cookie atau cURL Gemini wajib diisi.' });
    const account = await verifyAndSaveCredential(req, user.userId, credential, label);
    return res.json({
    success: true,
    account: sanitizeAccount(account),
    creditSyncError: account.creditSyncError,
    message: 'Akun Gemini berhasil diverifikasi dan disimpan.',
    });
  } catch (error: any) {
    console.error('[CLI Gemini Cookie Verify Error]:', error);
    return res.status(400).json({ success: false, error: error.message || 'Gagal memverifikasi sesi Gemini.' });
  }
});

router.post('/cli/gemini/settings/cookie/import-batch', async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return sendUnauthorized(res);
  const credentials = Array.isArray(req.body?.credentials) ? req.body.credentials : [];
  if (!credentials.length || credentials.length > 50) {
    return res.status(400).json({ success: false, error: 'Import batch membutuhkan 1 sampai 50 cookie/cURL.' });
  }
  const imported: any[] = [];
  const failures: Array<{ index: number; error: string }> = [];
  for (let index = 0; index < credentials.length; index++) {
    try {
      const item = typeof credentials[index] === 'string' ? { credential: credentials[index] } : credentials[index];
      const account = await verifyAndSaveCredential(
        req,
        user.userId,
        String(item.credential || '').trim(),
        String(item.label || '').trim(),
      );
      imported.push({
        ...sanitizeAccount(account),
        creditSyncError: account.creditSyncError,
      });
    } catch (error: any) {
      failures.push({ index: index + 1, error: error.message || 'Verifikasi akun gagal.' });
    }
  }
  return res.json({ success: failures.length === 0, imported, failures });
});

router.get('/cli/gemini/settings/scripts', async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return sendUnauthorized(res);
  try {
    return res.json({ success: true, ...getGeminiPlaywrightManager().getLocalPlaywrightScripts() });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Gagal mengambil Script Runner Lokal.' });
  }
});

router.post('/cli/gemini/accounts/:accountId/sync', async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return sendUnauthorized(res);

  try {
    const account = await findUserGeminiAccount(user.userId, String(req.params.accountId));
    if (!account) {
      return res.status(404).json({ success: false, error: 'Akun Gemini tidak ditemukan untuk user yang sedang login.' });
    }

    const result = await callInternalApi(req, '/gemini/accounts/sync-daily', {
      token: getAccountCredential(account),
      email: account.email,
    });
    const data = result.data;
    return res.status(result.status).json({
      success: data.success === true,
      accountStatus: data.accountStatus || 'error',
      accountId: account.id,
      email: data.email || account.email,
      credits: data.remainingCredits ?? data.credits ?? 0,
      remainingCredits: data.remainingCredits ?? data.credits ?? 0,
      totalCredits: data.totalCredits ?? GEMINI_VIDEO_CREDIT_LIMIT,
      creditsUsed: data.used ?? data.usedTotal ?? data.usedToday,
      ledgerKnown: data.ledgerKnown === true,
      creditSyncStatus: data.ledgerKnown === true ? 'synced' : 'unknown',
      localTaskUsage: data.localTaskUsage,
      error: data.error,
      statusMessage: data.statusMessage,
    });
  } catch (error: any) {
    console.error('[CLI Gemini Account Sync Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Gagal memeriksa sesi dan kredit akun Gemini.',
    });
  }
});

router.post('/cli/gemini/generate-video', async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return sendUnauthorized(res);

  try {
    const accountId = String(req.body?.accountId || '').trim();
    const prompt = String(req.body?.prompt || '').trim();
    const aspectRatio = String(req.body?.aspectRatio || '9:16');
    const duration = String(req.body?.duration || '10s');
    const resolution = String(req.body?.resolution || '1080p');

    if (!accountId) return res.status(400).json({ success: false, error: 'Pilih akun Gemini terlebih dahulu.' });
    if (!prompt) return res.status(400).json({ success: false, error: 'Prompt text-to-video wajib diisi.' });
    if (prompt.length > 10_000) return res.status(400).json({ success: false, error: 'Prompt maksimal 10.000 karakter.' });
    if (!allowedAspectRatios.has(aspectRatio)) return res.status(400).json({ success: false, error: 'Aspect ratio tidak didukung.' });
    if (!allowedDurations.has(duration)) return res.status(400).json({ success: false, error: 'Durasi tidak didukung.' });
    if (!allowedResolutions.has(resolution)) return res.status(400).json({ success: false, error: 'Resolusi tidak didukung.' });

    const account = await findUserGeminiAccount(user.userId, accountId);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Akun Gemini tidak ditemukan untuk user yang sedang login.' });
    }
    const credential = getAccountCredential(account);
    if (!credential) {
      return res.status(409).json({ success: false, error: 'Kredensial sesi akun tidak tersedia. Perbarui akun melalui Settings.' });
    }

    // Uji sesi tidak valid: tujuannya melihat kegagalan SESUNGGUHNYA di jalur generator,
    // jadi pre-check hanya mendiagnosis — request tetap diteruskan ke
    // /gemini/generate-video (dulu jalur ini selalu return di awal dan generator tidak pernah jalan).
    let invalidSessionPreflight: {
      status: number;
      accountStatus?: string;
      error?: string;
    } | null = null;

    if (req.body?.allowInvalidSessionTest === true) {
      const sessionCheck = await callInternalApi(req, '/gemini/accounts/sync-daily', {
        token: credential,
        email: account.email,
      }, 180_000);
      invalidSessionPreflight = {
        status: sessionCheck.status,
        accountStatus: sessionCheck.data?.accountStatus,
        error: sessionCheck.data?.error,
      };

      if (sessionCheck.data?.success === true && sessionCheck.data?.accountStatus === 'active') {
        return res.status(409).json({
          success: false,
          error: 'Sesi akun masih aktif. Percobaan khusus sesi invalid dibatalkan; gunakan generate test normal.',
        });
      }

      console.warn(
        `[CLI Gemini Invalid Session Test] Pre-check: status=${sessionCheck.status} accountStatus=${sessionCheck.data?.accountStatus}. ` +
        'Melanjutkan ke generator untuk melihat kegagalan yang sebenarnya.'
      );
    }

    if (!invalidSessionPreflight && (account.creditSyncStatus !== 'synced' || typeof account.credits !== 'number')) {
      return res.status(409).json({ success: false, error: 'Saldo akun belum tersinkron. Sinkronkan akun sebelum generate.' });
    }

    const testPermit = issueCliGeminiTestPermit(account.id, account.email || '');
    const result = await callInternalApi(req, '/gemini/generate-video', {
      prompt,
      aspectRatio,
      duration,
      resolution,
      model: 'Omni Flash',
      id: account.id,
      accountId: account.id,
      email: account.email,
      name: account.displayName || account.name || account.email,
      token: credential,
      cookies: credential,
      fallbackAccounts: [],
    }, 180_000, { 'x-amb-cli-gemini-test-token': testPermit });
    return res.status(result.status).json({
      ...sanitizeGenerationResponse(result.data),
      creditBypassed: result.data.creditBypassed === true,
      ...(invalidSessionPreflight
        ? {
            failureSource: result.data?.failureSource || 'invalid_session_test',
            sessionPrecheck: invalidSessionPreflight,
          }
        : {}),
    });
  } catch (error: any) {
    console.error('[CLI Gemini Generate Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Gagal memulai generate video Gemini.',
    });
  }
});

router.post('/cli/gemini/video-status', async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return sendUnauthorized(res);

  try {
    const accountId = String(req.body?.accountId || '').trim();
    const operationName = String(req.body?.operationName || req.body?.taskId || '').trim();
    if (!accountId || !operationName) {
      return res.status(400).json({ success: false, error: 'accountId dan operationName/taskId wajib disertakan.' });
    }

    const account = await findUserGeminiAccount(user.userId, accountId);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Akun Gemini tidak ditemukan untuk user yang sedang login.' });
    }

    const result = await callInternalApi(req, '/gemini/video-status', {
      operationName,
      taskId: operationName,
      token: getAccountCredential(account),
      cookies: getAccountCredential(account),
      email: account.email,
      id: account.id,
    }, 180_000);
    return res.status(result.status).json({
      ...sanitizeGenerationResponse(result.data),
      creditBypassed: isCliGeminiTestTask(operationName, account.id, account.email || ''),
    });
  } catch (error: any) {
    console.error('[CLI Gemini Poll Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Gagal memeriksa status task Gemini.',
    });
  }
});

export default router;
