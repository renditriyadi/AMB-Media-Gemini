import '../initPlaywright';
import { resolveLocalPlaywrightExecutable, localBrowsersDir, ensurePlaywrightInstalled } from '../initPlaywright';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { clearGeminiProfileCookiesCache } from '../utils/geminiProfileCookies';

// Playwright is pre-configured via ../initPlaywright to use root .playwright-browsers

// Total kredit per akun Google Gemini (1 generasi = 1 kredit, kuota tidak reset)
const GEMINI_MAX_CREDITS = 2;

function getSapisidHash(cookies: string, origin = 'https://gemini.google.com'): string | null {
  const sapisidMatch = cookies.match(/(?:__Secure-[13]P)?SAPISID=([^;]+)/);
  if (!sapisidMatch) return null;
  const sapisid = sapisidMatch[1].trim();
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1').update(`${timestamp} ${sapisid} ${origin}`).digest('hex');
  return `${timestamp}_${hash}`;
}

function getAuthorizationHeader(cookies: string, origin = 'https://gemini.google.com'): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const sMatch = cookies.match(/SAPISID=([^;]+)/);
  const s1pMatch = cookies.match(/__Secure-1PAPISID=([^;]+)/);
  const s3pMatch = cookies.match(/__Secure-3PAPISID=([^;]+)/);

  const sVal = sMatch ? sMatch[1].trim() : (s1pMatch ? s1pMatch[1].trim() : null);
  if (!sVal) return '';

  const s1pVal = s1pMatch ? s1pMatch[1].trim() : sVal;
  const s3pVal = s3pMatch ? s3pMatch[1].trim() : sVal;

  const hash = crypto.createHash('sha1').update(`${timestamp} ${sVal} ${origin}`).digest('hex');
  const hash1p = crypto.createHash('sha1').update(`${timestamp} ${s1pVal} ${origin}`).digest('hex');
  const hash3p = crypto.createHash('sha1').update(`${timestamp} ${s3pVal} ${origin}`).digest('hex');

  return `SAPISIDHASH ${timestamp}_${hash} SAPISID1PHASH ${timestamp}_${hash1p} SAPISID3PHASH ${timestamp}_${hash3p}`;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function buildCurlCommand(url: string, method: string, headers: Record<string, string>, body?: string | null): string {
  const options = Object.entries(headers)
    .filter(([name]) => !['cookie', 'host', 'content-length', 'connection'].includes(name.toLowerCase()))
    .map(([name, value]) => `-H ${shellQuote(`${name}: ${value}`)}`);
  const cookie = Object.entries(headers).find(([name]) => name.toLowerCase() === 'cookie')?.[1];
  if (cookie) options.push(`-b ${shellQuote(cookie)}`);
  if (body) options.push(`--data-raw ${shellQuote(body)}`);
  else options.unshift(`-X ${shellQuote(method)}`);

  return [
    `curl --url ${shellQuote(url)} \\`,
    ...options.map((option, index) => `  ${option}${index < options.length - 1 ? ' \\' : ''}`),
  ].join('\n');
}

/**
 * Executes GetAsyncData RPC to verify session and extract verified Google identity directly from ogads-pa
 */
export async function fetchOneGoogleAsyncData(cookies: string): Promise<{
  success: boolean;
  email?: string;
  displayName?: string;
  photoUrl?: string;
  gaiaId?: string;
  requestCurl?: string;
}> {
  return new Promise((resolve) => {
    const origin = 'https://gemini.google.com';
    const authHeader = getAuthorizationHeader(cookies, origin) || (getSapisidHash(cookies, origin) ? `SAPISIDHASH ${getSapisidHash(cookies, origin)}` : '');

    const postData = JSON.stringify([
      658,
      'https://gemini.google.com/app',
      658,
      'en',
      'co.id',
      1,
      null,
      0,
      0,
      '',
      '',
      1,
      0,
      null,
      103135050,
      [[1, 9, 13], 0, 1, 0],
      [1],
      null,
      0,
      1,
      null,
      { '1001': 1 },
    ]);

    const reqHeaders: Record<string, string> = {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/json+protobuf',
      'origin': origin,
      'referer': 'https://gemini.google.com/',
      'x-goog-api-key': 'AIzaSyCbsbvGCe7C9mCtdaTycZB2eUFuzsYKG_E',
      'x-goog-authuser': '0',
      'x-user-agent': 'grpc-web-javascript/0.1',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
      'Cookie': cookies,
    };

    if (authHeader) {
      reqHeaders['authorization'] = authHeader;
    }

    const requestUrl = 'https://ogads-pa.clients6.google.com/$rpc/google.internal.onegoogle.asyncdata.v1.AsyncDataService/GetAsyncData';
    const requestCurl = [
      `curl --url ${shellQuote(requestUrl)} \\`,
      ...Object.entries(reqHeaders)
        .filter(([name]) => name.toLowerCase() !== 'cookie')
        .map(([name, value], index, entries) => `  -H ${shellQuote(`${name}: ${value}`)}${index < entries.length - 1 || cookies ? ' \\' : ''}`),
      `  -b ${shellQuote(cookies)} \\`,
      `  --data-raw ${shellQuote(postData)}`,
    ].join('\n');

    const req = https.request(
      requestUrl,
      {
        method: 'POST',
        headers: reqHeaders,
        timeout: 12000,
        maxHeaderSize: 1048576,
      },
      (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => {
          if (data.length < 500000) data += chunk.toString();
        });
        res.on('end', () => {
          try {
            if (res.statusCode === 200 && data.trim()) {
              const parsed = JSON.parse(data);
              let email = '';
              let displayName = '';
              let photoUrl = '';
              let gaiaId = '';

              const scan = (obj: any) => {
                if (!obj) return;
                if (Array.isArray(obj)) {
                  if (obj.length >= 4 && typeof obj[3] === 'string' && obj[3].includes('@') && !email) {
                    email = obj[3].trim();
                    if (typeof obj[2] === 'string') displayName = obj[2].trim();
                    if (typeof obj[4] === 'string' && obj[4].startsWith('http')) photoUrl = obj[4].trim();
                    if (typeof obj[0] === 'string') gaiaId = obj[0].trim();
                  }
                  for (const el of obj) scan(el);
                } else if (typeof obj === 'object') {
                  for (const k of Object.keys(obj)) scan(obj[k]);
                }
              };

              scan(parsed);

              if (email || displayName || photoUrl) {
                return resolve({
                  success: true,
                  email,
                  displayName,
                  photoUrl,
                  gaiaId,
                  requestCurl,
                });
              }
            }
          } catch (_) {}
          resolve({ success: false, requestCurl });
        });
      }
    );

    req.on('error', () => resolve({ success: false }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Searches for the chrome / chrome.exe binary directly inside the project root .playwright-browsers folder
 */
export function findLocalChromiumExecutable(): string | undefined {
  return resolveLocalPlaywrightExecutable();
}

export interface PlaywrightSession {
  id: string;
  email: string;
  status:
    | 'idle'
    | 'starting'
    | 'navigating_login'
    | 'filling_credentials'
    | 'awaiting_2fa'
    | 'navigating_gemini'
    | 'accepting_terms'
    | 'extracting_session'
    | 'success'
    | 'error'
    | 'cancelled';
  currentStep: string;
  logs: string[];
  challengeType?: 'totp' | 'sms' | 'phone_prompt' | 'recovery_email' | 'none';
  challengePrompt?: string;
  screenshotBase64?: string;
  account?: {
    id: string;
    name: string;
    displayName: string;
    email: string;
    token: string;
    providerId: 'gemini';
    tier: string;
    credits: number;
    totalCredits: number;
    isActive: boolean;
    photoUrl?: string;
    snlm0e?: string;
  };
  error?: string;
  createdAt: number;
  lastActivity: number;
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  getAsyncDataCurl?: string;
}

class GeminiPlaywrightManager {
  private sessions: Map<string, PlaywrightSession> = new Map();
  private batches = new Map<string, {
    id: string;
    total: number;
    completed: number;
    success: number;
    failed: number;
    skipped?: number;
    currentEmail?: string;
    sessionIds: string[];
    results: Array<{
      email: string;
      sessionId?: string;
      success: boolean;
      status: string;
      account?: PlaywrightSession['account'];
      error?: string;
    }>;
    status: 'running' | 'success' | 'error';
    cancelled: boolean;
    createdAt: number;
  }>();

  private profileDirForEmail(email: string): string {
    const profileId = crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
    return path.join(process.cwd(), '.playwright-profiles', profileId);
  }

  private async credentialEncryptionKey(): Promise<Buffer> {
    const profilesRoot = path.resolve(process.cwd(), '.playwright-profiles');
    const keyPath = path.join(profilesRoot, '.credentials-key');
    await fs.promises.mkdir(profilesRoot, { recursive: true });

    try {
      return await fs.promises.readFile(keyPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }

    const key = crypto.randomBytes(32);
    try {
      await fs.promises.writeFile(keyPath, key, { flag: 'wx', mode: 0o600 });
      return key;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      return fs.promises.readFile(keyPath);
    }
  }

  private credentialsPathForEmail(email: string): string {
    const profileId = path.basename(this.profileDirForEmail(email));
    return path.join(process.cwd(), '.playwright-profiles', '.credentials', `${profileId}.enc`);
  }

  private async saveCredentials(email: string, password: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const key = await this.credentialEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify({ email: normalizedEmail, password }), 'utf8'),
      cipher.final(),
    ]);
    const credentialsPath = this.credentialsPathForEmail(normalizedEmail);
    await fs.promises.mkdir(path.dirname(credentialsPath), { recursive: true, mode: 0o700 });
    await fs.promises.writeFile(
      credentialsPath,
      JSON.stringify({
        version: 2,
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        data: encrypted.toString('base64'),
      }),
      { mode: 0o600 }
    );
  }

  public async getSavedCredentials(email: string): Promise<{ password: string } | null> {
    const credentialsPath = this.credentialsPathForEmail(email);
    let stored: { version?: number; iv?: string; tag?: string; data?: string };
    try {
      stored = JSON.parse(await fs.promises.readFile(credentialsPath, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }

    if (stored.version !== 2 || !stored.iv || !stored.tag || !stored.data) {
      throw new Error('Data kredensial profil Gemini rusak atau tidak didukung.');
    }

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      await this.credentialEncryptionKey(),
      Buffer.from(stored.iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(stored.tag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(stored.data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    const credentials = JSON.parse(decrypted) as { email?: string; password?: string };
    if (
      credentials.email !== email.trim().toLowerCase() ||
      typeof credentials.password !== 'string' ||
      !credentials.password
    ) {
      throw new Error('Kredensial profil Gemini tidak sesuai atau tidak lengkap.');
    }
    return { password: credentials.password };
  }

  constructor() {
    // Periodic session cleanup for stale sessions (>10 mins)
    setInterval(() => {
      const now = Date.now();
      for (const [id, sess] of this.sessions.entries()) {
        if (now - sess.lastActivity > 10 * 60 * 1000) {
          this.cleanupSession(id);
        }
      }
    }, 60000);
  }

  private addLog(session: PlaywrightSession, message: string) {
    const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
    const logLine = `[${time}] ${message}`;
    session.logs.push(logLine);
    session.lastActivity = Date.now();
    console.log(`[Playwright Gemini ${session.id.slice(0, 6)}]:`, message);
  }

  private async clickVisibleGoogleAction(page: Page, labels: string[]): Promise<boolean> {
    return page.evaluate((actionLabels) => {
      const normalizedLabels = actionLabels.map((label) => label.toLowerCase());
      const candidates = Array.from(document.querySelectorAll('button, [role="button"]')) as HTMLElement[];
      const target = candidates.find((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden') {
          return false;
        }
        const text = (element.innerText || element.textContent || '').trim().toLowerCase();
        return normalizedLabels.some((label) => text === label || text.includes(label));
      });

      if (!target) return false;
      target.scrollIntoView({ block: 'center' });
      target.click();
      return true;
    }, labels).catch(() => false);
  }

  private async hasGoogleAuthCookie(context: BrowserContext): Promise<boolean> {
    const cookies = await context.cookies([
      'https://accounts.google.com',
      'https://google.com',
      'https://gemini.google.com',
    ]);
    return cookies.some(
      (cookie) =>
        ['SAPISID', '__Secure-1PAPISID', '__Secure-3PAPISID'].includes(cookie.name) && Boolean(cookie.value)
    );
  }

  private async waitForGoogleAuthentication(session: PlaywrightSession, timeoutMs = 60000): Promise<boolean> {
    if (!session.page || !session.context) return false;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const currentUrl = session.page.url().toLowerCase();
      const isChallenge =
        currentUrl.includes('challenge') ||
        currentUrl.includes('signinoptions') ||
        currentUrl.includes('two-step-verification');
      const reachedSuccessUrl =
        currentUrl.includes('myaccount.google.com') ||
        currentUrl.includes('accounts.google.com/manageaccount') ||
        currentUrl.includes('accounts.google.com/b/');
      if (!isChallenge && (reachedSuccessUrl || (await this.hasGoogleAuthCookie(session.context)))) return true;
      await session.page.waitForTimeout(1000);
    }

    return false;
  }

  private async captureScreenshot(page: Page): Promise<string> {
    try {
      const buffer = await page.screenshot({ type: 'jpeg', quality: 60 });
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch (e) {
      return '';
    }
  }

  public getSession(id: string): PlaywrightSession | undefined {
    return this.sessions.get(id);
  }

  public async cleanupSession(id: string) {
    const sess = this.sessions.get(id);
    if (!sess) return;
    try {
      if (sess.page && !sess.page.isClosed()) await sess.page.close().catch(() => {});
      if (sess.context) await sess.context.close().catch(() => {});
      if (sess.browser) await sess.browser.close().catch(() => {});
    } catch (e) {}

    // Release heavy browser instances
    sess.page = undefined;
    sess.context = undefined;
    sess.browser = undefined;

    // Retain session result & logs for 10 minutes so frontend polling can retrieve the complete status
    setTimeout(() => {
      this.sessions.delete(id);
    }, 10 * 60 * 1000);
  }

  public async cancelSession(id: string) {
    const sess = this.sessions.get(id);
    if (!sess) return;
    sess.status = 'cancelled';
    this.addLog(sess, 'Proses login dibatalkan oleh pengguna.');
    await this.cleanupSession(id);
  }

  public async deleteProfile(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('Alamat email Gemini tidak valid untuk menghapus profil browser.');
    }

    const matchingSessions = [...this.sessions.values()].filter(
      (session) => session.email.trim().toLowerCase() === normalizedEmail
    );
    for (const session of matchingSessions) {
      session.status = 'cancelled';
      await this.cleanupSession(session.id);
    }

    const profilesRoot = path.resolve(process.cwd(), '.playwright-profiles');
    const profileDirs = new Set([this.profileDirForEmail(normalizedEmail)]);

    try {
      const entries = await fs.promises.readdir(profilesRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const profileDir = path.resolve(profilesRoot, entry.name);
        const preferencesPath = path.join(profileDir, 'Default', 'Preferences');
        try {
          const preferences = await fs.promises.readFile(preferencesPath, 'utf8');
          if (preferences.toLowerCase().includes(normalizedEmail)) {
            profileDirs.add(profileDir);
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }

    for (const profileDir of profileDirs) {
      if (path.dirname(profileDir) !== profilesRoot) continue;
      await fs.promises.rm(profileDir, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 250,
      });
    }
    await fs.promises.rm(this.credentialsPathForEmail(normalizedEmail), { force: true });
    clearGeminiProfileCookiesCache(normalizedEmail);
  }

  /**
   * Start Google Login & Gemini Onboarding flow using Playwright
   */
  public async startLogin(params: {
    email: string;
    password: string;
    recoveryEmail?: string;
    customLabel?: string;
  }): Promise<{ sessionId: string; status: string; step: string }> {
    const email = params.email.trim();
    if (!email || !email.includes('@') || !params.password) {
      throw new Error('Alamat email dan kata sandi Google wajib diisi.');
    }
    await this.saveCredentials(email, params.password);

    const sessionId = crypto.randomUUID();
    const session: PlaywrightSession = {
      id: sessionId,
      email,
      status: 'starting',
      currentStep: 'Inisialisasi browser headless Playwright...',
      logs: [],
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.sessions.set(sessionId, session);
    this.addLog(session, `Memulai login otomatis untuk Google Gemini (${email})...`);

    // Run async in background and update session state
    this.executeLogin(session, params).catch(async (err) => {
      if (session.status !== 'cancelled') {
        session.status = 'error';
        session.error = err.message || 'Terjadi kesalahan pada otomasi browser Playwright.';
        this.addLog(session, `ERROR: ${session.error}`);
      }
      await this.cleanupSession(sessionId);
    });

    return {
      sessionId,
      status: session.status,
      step: session.currentStep,
    };
  }

  public async startBatchLogin(params: {
    emails: string[];
    password: string;
    recoveryEmail?: string;
    customLabel?: string;
    existingEmails?: string[];
  }): Promise<{ batchId: string; total: number; skippedCount: number; status: 'running' }> {
    const existingSet = new Set(
      (params.existingEmails || [])
        .map((email) => String(email || '').trim().toLowerCase())
        .filter(Boolean)
    );

    const normalized = [...new Set(
      (params.emails || [])
        .map((email) => String(email || '').trim())
        .filter((email) => email.length > 0 && email.includes('@'))
        .map((email) => email.toLowerCase())
    )];

    if (!normalized.length) {
      throw new Error('Daftar email batch Gemini wajib diisi minimal 1 akun.');
    }

    if (!params.password || !String(params.password).trim()) {
      throw new Error('Password wajib diisi untuk semua akun batch Playwright Gemini.');
    }

    const skippedInitial = normalized.filter((email) => existingSet.has(email));

    const batchId = crypto.randomUUID();
    const batch = {
      id: batchId,
      total: normalized.length,
      completed: 0,
      success: 0,
      failed: 0,
      skipped: skippedInitial.length,
      currentEmail: undefined as string | undefined,
      sessionIds: [] as string[],
      results: [] as Array<{
        email: string;
        sessionId?: string;
        success: boolean;
        status: string;
        account?: PlaywrightSession['account'];
        error?: string;
      }>,
      status: 'running' as 'running' | 'success' | 'error',
      cancelled: false,
      createdAt: Date.now(),
    };
    this.batches.set(batchId, batch);
    const password = String(params.password);

    void (async () => {
      for (let index = 0; index < normalized.length; index++) {
        if (batch.cancelled) break;
        const email = normalized[index];
        batch.currentEmail = email;

        // Cek apakah akun ini sudah terdaftar sebelumnya: jika ya, lewati (skip) agar tidak di-grab 2x
        if (existingSet.has(email)) {
          const skippedSessionId = crypto.randomUUID();
          const skippedSession: PlaywrightSession = {
            id: skippedSessionId,
            email,
            status: 'success',
            currentStep: `Dilewati (Skip): Email ${email} sudah terdaftar sebelumnya.`,
            logs: [
              `[${new Date().toLocaleTimeString('id-ID', { hour12: false })}] ⏭️ [SKIP] Email ${email} sudah terdaftar di sistem. Melewatkan grab browser agar tidak diproses dua kali.`,
            ],
            createdAt: Date.now(),
            lastActivity: Date.now(),
          };
          this.sessions.set(skippedSessionId, skippedSession);
          batch.sessionIds.push(skippedSessionId);
          batch.results.push({
            email,
            sessionId: skippedSessionId,
            success: true,
            status: 'skipped',
            error: 'Dilewati: Email sudah terdaftar sebelumnya.',
          });
          batch.completed++;
          batch.success++;
          console.log(`[Playwright Gemini Batch ${batchId.slice(0, 6)}]: ⏭️ Email ${email} dilewati (sudah terdaftar).`);
          continue;
        }

        const sessionId = crypto.randomUUID();
        batch.sessionIds.push(sessionId);
        const session: PlaywrightSession = {
          id: sessionId,
          email,
          status: 'starting',
          currentStep: `Batch akun ${index + 1}/${normalized.length}: Inisialisasi profile browser...`,
          logs: [],
          createdAt: Date.now(),
          lastActivity: Date.now(),
        };

        this.sessions.set(sessionId, session);
        this.addLog(session, `🔄 [BATCH ${index + 1}/${normalized.length}] Memulai login otomatis untuk: ${email}`);

        try {
          await this.saveCredentials(email, password);
          await this.executeLogin(session, {
            email,
            password,
            recoveryEmail: params.recoveryEmail,
            customLabel: params.customLabel,
          });

          const success = session.status === 'success' && Boolean(session.account);
          batch.results.push({
            email,
            sessionId,
            success,
            status: session.status,
            ...(session.account ? { account: session.account } : {}),
            ...(session.error ? { error: session.error } : {}),
          });
          if (success) batch.success++;
          else batch.failed++;
        } catch (err: any) {
          if (session.status !== 'cancelled') {
            session.status = 'error';
            session.error = err.message || 'Batch login Playwright gagal.';
            this.addLog(session, `❌ ${session.error}`);
          }
          batch.results.push({
            email,
            sessionId,
            success: false,
            status: session.status,
            error: session.error,
          });
          batch.failed++;
        } finally {
          batch.completed++;
          await this.cleanupSession(sessionId).catch(() => {});
        }
      }
      batch.currentEmail = undefined;
      batch.status = batch.cancelled || batch.failed === batch.total ? 'error' : 'success';
    })().catch((err: any) => {
      batch.currentEmail = undefined;
      batch.status = 'error';
      console.error(`[Playwright Gemini Batch ${batchId.slice(0, 6)}]`, err);
    });

    return {
      batchId,
      total: normalized.length,
      skippedCount: skippedInitial.length,
      status: 'running',
    };
  }

  public getBatch(id: string) {
    const batch = this.batches.get(id);
    if (!batch) return undefined;
    const logs = batch.sessionIds.flatMap((sessionId) => {
      const session = this.sessions.get(sessionId);
      return session?.logs || [];
    });
    return {
      batchId: batch.id,
      total: batch.total,
      completed: batch.completed,
      successful: batch.success,
      failed: batch.failed,
      skipped: batch.skipped || 0,
      currentEmail: batch.currentEmail,
      status: batch.status,
      results: batch.results,
      logs,
    };
  }

  public async cancelBatch(id: string): Promise<void> {
    const batch = this.batches.get(id);
    if (!batch) throw new Error('Sesi batch Playwright tidak ditemukan atau sudah kedaluwarsa.');
    batch.cancelled = true;
    const sessions = batch.sessionIds
      .map((sessionId) => this.sessions.get(sessionId))
      .filter((session): session is PlaywrightSession =>
        Boolean(session && ['starting', 'navigating_login', 'filling_credentials', 'awaiting_2fa', 'navigating_gemini', 'accepting_terms', 'extracting_session'].includes(session.status))
      );
    await Promise.all(sessions.map((session) => this.cancelSession(session.id)));
    if (batch.status === 'running') batch.status = 'error';
    batch.currentEmail = undefined;
  }

  private async executeLogin(
    session: PlaywrightSession,
    params: {
      email: string;
      password: string;
      recoveryEmail?: string;
      customLabel?: string;
    }
  ) {
    let localExe = findLocalChromiumExecutable();
    if (!localExe) {
      this.addLog(session, '⚠️ Binary Playwright Chromium belum terpasang di container ini. Menjalankan auto-install otomatis...');
      localExe = await ensurePlaywrightInstalled((msg) => this.addLog(session, msg));
    }

    let executablePath = localExe || process.env.PLAYWRIGHT_CHROMIUM_PATH;
    if (!executablePath) {
      const cacheDir = process.env.HOME ? path.join(process.env.HOME, '.cache', 'ms-playwright') : '/root/.cache/ms-playwright';
      if (fs.existsSync(cacheDir)) {
        try {
          const dirs = fs.readdirSync(cacheDir).filter((d) => d.startsWith('chromium-')).sort().reverse();
          for (const d of dirs) {
            const p = path.join(cacheDir, d, process.platform === 'win32' ? 'chrome-win/chrome.exe' : 'chrome-linux64/chrome');
            if (fs.existsSync(p)) {
              executablePath = p;
              break;
            }
          }
        } catch (_) {}
      }
    }

    if (localExe) {
      this.addLog(session, `📦 Menggunakan binary Chromium lokal (.playwright-browsers): ${localExe}`);
    }

    session.status = 'starting';
    session.currentStep = 'Membuka Google Chrome & mempersiapkan environment...';
    this.addLog(session, 'Meluncurkan browser dengan opsi stealth anti-bot...');

    const profileDir = this.profileDirForEmail(params.email);
    const context = await chromium.launchPersistentContext(profileDir, {
      headless: true,
      executablePath: executablePath && fs.existsSync(executablePath) ? executablePath : undefined,
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1280,800',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
      ],
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'id-ID,id,en-US,en',
      timezoneId: 'Asia/Jakarta',
    });
    session.context = context;
    const browser = context.browser();
    if (browser) session.browser = browser;

    // Inject stealth hooks matching extension environment
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // @ts-ignore
      window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['id-ID', 'id', 'en-US', 'en'] });
    });

    const page = context.pages()[0] || await context.newPage();
    session.page = page;
    page.setDefaultTimeout(35000);
    page.on('request', (request) => {
      if (!request.url().includes('AsyncDataService/GetAsyncData')) return;
      void request.allHeaders().then((headers) => {
        const cookieHeader = headers.cookie || headers.Cookie || '';
        if (!cookieHeader.includes('SAPISID=')) return;
        session.getAsyncDataCurl = buildCurlCommand(
          request.url(),
          request.method(),
          headers,
          request.postData(),
        );
      }).catch(() => {});
    });

    if (await this.hasGoogleAuthCookie(context)) {
      this.addLog(session, '🔁 Sesi Google dari profil persisten ditemukan. Memeriksa sesi Gemini yang tersimpan...');
      try {
        await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1800);
        const isGoogleLoginPage = page.url().toLowerCase().includes('accounts.google.com');
        const hasSignInPrompt = await page.evaluate(() => {
          const candidates = Array.from(document.querySelectorAll('button, a, div[role="button"], span'));
          return candidates.some((element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden') {
              return false;
            }
            const text = (element.textContent || '').trim().toLowerCase();
            return text === 'sign in' || text === 'masuk' || text === 'sign in to save activity';
          });
        }).catch(() => true);

        if (!isGoogleLoginPage && !hasSignInPrompt) {
          this.addLog(session, '✅ Sesi Google masih aktif. Melanjutkan ke pemeriksaan onboarding Gemini tanpa login ulang.');
          await this.completeGeminiOnboarding(session, params.customLabel);
          return;
        }

        this.addLog(session, 'ℹ️ Sesi profil tidak aktif di Gemini. Melanjutkan login Google biasa...');
      } catch (err: any) {
        this.addLog(session, `ℹ️ Tidak dapat memakai sesi tersimpan (${err.message}); mencoba login Google biasa...`);
      }
    }

    // Step 1: Navigating to GlifWebSignIn (100% matching background.js in ektension-gemini-google)
    session.status = 'navigating_login';
    session.currentStep = 'Membuka halaman Google Sign In...';
    this.addLog(session, 'Mengarahkan ke Google Accounts GlifWebSignIn (Langkah 1/2: Google Login)...');

    const googleLoginUrl =
      'https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin';

    try {
      await page.goto(googleLoginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e: any) {
      this.addLog(session, `Navigasi utama lambat (${e.message}), melanjutkan deteksi...`);
    }
    await page.waitForTimeout(1500);

    // In-page native fill helper function matching content.js in ektension-gemini-google
    const fillNativeInputInPage = async (selector: string, text: string) => {
      return page.evaluate(({ sel, val }) => {
        const el = document.querySelector(sel) as HTMLInputElement | null;
        if (!el) return false;
        el.focus();
        el.click();
        el.value = '';

        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (setter) {
          setter.call(el, val);
        } else {
          el.value = val;
        }

        el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: val, inputType: 'insertText' }));
        return el.value === val;
      }, { sel: selector, val: text }).catch(() => false);
    };

    // Check for Google consent / privacy prompt dialogs
    const consentSelectors = [
      'button:has-text("Saya setuju")',
      'button:has-text("Setuju")',
      'button:has-text("I agree")',
      'button:has-text("Accept all")',
      'button:has-text("Terima semua")',
      'button:has-text("Accept")',
    ];
    for (const cSel of consentSelectors) {
      try {
        const cBtn = await page.$(cSel);
        if (cBtn && (await cBtn.isVisible())) {
          this.addLog(session, 'Menyetujui dialog persetujuan Google...');
          await cBtn.click();
          await page.waitForTimeout(1500);
          break;
        }
      } catch (_) {}
    }

    // Step 2: Email input (Matching content.js STEP 1: FORMULIR EMAIL)
    session.status = 'filling_credentials';
    session.currentStep = 'Mengisi alamat email Google...';
    this.addLog(session, `📧 [Tahap Email] Memasukkan email: ${params.email}...`);

    const emailSelectors = [
      '#identifierId',
      'input[name="identifier"]',
      'input[type="email"]',
      'input[autocomplete="username"]',
      'input[id="Email"]',
      'input[type="text"][name="Email"]',
    ];

    let emailFoundSelector = '';
    let hasFilledEmail = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      for (const sel of emailSelectors) {
        const el = await page.$(sel);
        if (el && (await el.isVisible())) {
          emailFoundSelector = sel;
          break;
        }
      }
      if (emailFoundSelector) break;
      await page.waitForTimeout(800);
    }

    if (!emailFoundSelector) {
      session.screenshotBase64 = await this.captureScreenshot(page);
      const bodyText = await page.innerText('body').catch(() => '');
      const pageTitle = await page.title().catch(() => '');

      if (
        bodyText.includes('tidak aman') ||
        bodyText.includes('not secure') ||
        bodyText.includes("Couldn't sign you in") ||
        bodyText.includes('browser or app may not be secure')
      ) {
        session.status = 'error';
        session.error =
          'Google memblokir login otomatis di server ("This browser or app may not be secure"). Gunakan tab "Cookie & cURL Sesi" atau salin "Script Runner Lokal" untuk login langsung dari browser komputer Anda.';
        this.addLog(session, session.error);
        await this.cleanupSession(session.id);
        return;
      }

      if (bodyText.includes('CAPTCHA') || bodyText.includes('captcha')) {
        session.status = 'error';
        session.error =
          'Google meminta verifikasi CAPTCHA visual. Silakan gunakan tab "Cookie & cURL Sesi" atau "Script Runner Lokal".';
        this.addLog(session, session.error);
        await this.cleanupSession(session.id);
        return;
      }

      session.status = 'error';
      session.error = `Halaman login Google tidak memuat kolom email (Judul: "${pageTitle}"). Silakan gunakan tab "Cookie & cURL Sesi" untuk import akun.`;
      this.addLog(session, session.error);
      await this.cleanupSession(session.id);
      return;
    }

    await page.click(emailFoundSelector);
    await page.waitForTimeout(250);
    await fillNativeInputInPage(emailFoundSelector, params.email);
    await page.fill(emailFoundSelector, params.email);
    await page.waitForTimeout(300);

    this.addLog(session, '🖱️ Mengklik tombol Berikutnya (Email)...');
    const nextEmailBtn =
      '#identifierNext button, #identifierNext, button:has-text("Next"), button:has-text("Berikutnya"), button:has-text("Selanjutnya"), button:has-text("Lanjut")';
    const nextBtnEl = await page.$(nextEmailBtn);
    if (nextBtnEl && (await nextBtnEl.isVisible())) {
      await nextBtnEl.click();
    } else {
      await page.keyboard.press('Enter');
    }
    hasFilledEmail = true;

    // Wait for Password field, Challenge, or Error message
    await page.waitForTimeout(2000);

    // Check if Google showed an email error
    const emailErrorEl = await page
      .$('[aria-live="assertive"], #headingSubtext, [jsname="B14ebf"], div[role="alert"]')
      .catch(() => null);
    if (emailErrorEl) {
      const errText = await emailErrorEl.innerText().catch(() => '');
      if (
        errText.toLowerCase().includes('tidak dapat menemukan') ||
        errText.toLowerCase().includes("couldn't find") ||
        errText.toLowerCase().includes('invalid') ||
        errText.toLowerCase().includes('tidak valid') ||
        errText.toLowerCase().includes('salah')
      ) {
        session.status = 'error';
        session.error = `Google: ${errText.trim() || 'Email Google tidak ditemukan atau salah.'}`;
        this.addLog(session, `Gagal: ${session.error}`);
        session.screenshotBase64 = await this.captureScreenshot(page);
        await this.cleanupSession(session.id);
        return;
      }
    }

    // Step 3: Dynamic State Machine (100% matching content.js in ektension-gemini-google)
    session.currentStep = 'Mendeteksi form kata sandi & verifikasi identitas Google...';
    this.addLog(session, 'Menunggu form password & menangani verifikasi perantara...');

    const passSelectors = [
      'input[name="Passwd"]',
      'input[name="password"]',
      'input[type="password"]',
      'input[autocomplete="current-password"]',
      'input[aria-label*="password" i]',
      'input[aria-label*="sandi" i]',
    ];

    let passFound = false;
    let passFoundSelector = '';
    let hasFilledPassword = false;
    let googleLoginVerified = false;
    let googleChallengeDetected = false;
    const maxPassWaitSeconds = 30;
    const passStartTime = Date.now();

    while (Date.now() - passStartTime < maxPassWaitSeconds * 1000) {
      const currentUrl = page.url().toLowerCase();
      const bodyText = (await page.innerText('body').catch(() => '')).toLowerCase();

      // 1. STEP 3 in content.js: Check "Verify it's you" (confirmidentifier / challenge/reauth)
      const isVerifyScreen =
        currentUrl.includes('confirmidentifier') ||
        currentUrl.includes('challenge/reauth') ||
        bodyText.includes("verify it's you") ||
        bodyText.includes('verifikasi bahwa ini memang anda') ||
        bodyText.includes('verifikasi diri anda') ||
        bodyText.includes('to help keep your account secure') ||
        bodyText.includes('untuk membantu menjaga keamanan akun anda');

      if (isVerifyScreen) {
        this.addLog(session, '🛡️ [Verify It\'s You] Terdeteksi konfirmasi identitas! Mengklik tombol Berikutnya...');
        const verifyBtnSelectors = [
          '#confirmidentifierNext button',
          '#confirmidentifierNext',
          'button:has-text("Berikutnya")',
          'button:has-text("Next")',
          'button:has-text("Lanjutkan")',
          'button:has-text("Continue")',
          'button:has-text("Selanjutnya")',
        ];
        for (const vSel of verifyBtnSelectors) {
          try {
            const vBtn = await page.$(vSel);
            if (vBtn && (await vBtn.isVisible())) {
              await vBtn.click();
              await page.waitForTimeout(2000);
              break;
            }
          } catch (_) {}
        }
      }

      // 2. STEP in content.js: Check "Something went wrong" / unknownerror / signin/rejected & Auto-Recovery
      const isWrong =
        currentUrl.includes('unknownerror') ||
        currentUrl.includes('signin/rejected') ||
        bodyText.includes('something went wrong') ||
        bodyText.includes('terjadi kesalahan') ||
        bodyText.includes('ada yang salah') ||
        bodyText.includes('sorry, something went wrong there') ||
        bodyText.includes('maaf, terjadi kesalahan');

      if (isWrong) {
        this.addLog(session, '⚠️ [Auto-Recovery] Terdeteksi layar "Something went wrong"! Mengklik Coba Lagi...');
        const retryBtn = await page.$(
          'button:has-text("Berikutnya"), button:has-text("Next"), button:has-text("Try again"), button:has-text("Coba lagi"), button:has-text("Ulang")'
        );
        if (retryBtn && (await retryBtn.isVisible())) {
          await retryBtn.click();
          await page.waitForTimeout(2000);
        }
      }

      // 3. STEP 4 in content.js: Check Terms of Service / Welcome Screen / Speedbump
      const isTerms =
        currentUrl.includes('speedbump') ||
        currentUrl.includes('workspacetermsofservice') ||
        currentUrl.includes('consent') ||
        bodyText.includes('welcome to your new account') ||
        bodyText.includes('selamat datang di akun baru') ||
        bodyText.includes('terms of service') ||
        bodyText.includes('persyaratan layanan') ||
        bodyText.includes('i agree') ||
        bodyText.includes('saya setuju') ||
        bodyText.includes('i understand') ||
        bodyText.includes('saya mengerti');

      if (isTerms) {
        this.addLog(session, '📜 [Langkah Terms] Layar Terms of Service / Welcome terdeteksi! Mengonfirmasi persetujuan...');
        await page.evaluate(() => {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
          document.documentElement.scrollTop = document.documentElement.scrollHeight;
        }).catch(() => {});
        await page.waitForTimeout(600);

        const agreeBtn = await page.$(
          'button:has-text("I understand"), button:has-text("Saya mengerti"), button:has-text("I agree"), button:has-text("Saya setuju"), button:has-text("Accept"), button:has-text("Terima"), button:has-text("Continue"), button:has-text("Lanjutkan"), button:has-text("Berikutnya"), button:has-text("Next")'
        );
        if (agreeBtn && (await agreeBtn.isVisible())) {
          await agreeBtn.click();
          await page.waitForTimeout(2000);
        }
      }

      // 4. STEP 5 in content.js: Check Account Chooser (Pilih Akun / Ganti Akun)
      const isPicker =
        currentUrl.includes('accountchooser') ||
        currentUrl.includes('chooseaccount') ||
        currentUrl.includes('signinchooser') ||
        bodyText.includes('choose an account') ||
        bodyText.includes('pilih akun');

      if (isPicker) {
        this.addLog(session, `👥 [Account Chooser] Memilih akun ${params.email}...`);
        const matchingEl = await page.$(
          `[data-identifier="${params.email}"], div:has-text("${params.email}"), li:has-text("${params.email}")`
        );
        if (matchingEl && (await matchingEl.isVisible())) {
          await matchingEl.click();
          await page.waitForTimeout(2000);
        } else {
          const useAnother = await page.$(
            'button:has-text("Gunakan akun lain"), button:has-text("Use another account"), button:has-text("Tambahkan akun")'
          );
          if (useAnother && (await useAnother.isVisible())) {
            await useAnother.click();
            await page.waitForTimeout(2000);
          }
        }
      }

      // 5. Check if password input is present and visible (STEP 2 in content.js)
      for (const sel of passSelectors) {
        const passEl = await page.$(sel);
        if (passEl && (await passEl.isVisible())) {
          passFound = true;
          passFoundSelector = sel;
          break;
        }
      }

      if (passFound) break;

      // Check if already reached login success (STEP 6 in content.js)
      if (
        currentUrl.includes('myaccount.google.com') ||
        currentUrl.includes('accounts.google.com/manageaccount') ||
        currentUrl.includes('accounts.google.com/b/')
      ) {
        this.addLog(session, '🎉 LOGIN GOOGLE BERHASIL TERVERIFIKASI!');
        googleLoginVerified = true;
        break;
      }

      await page.waitForTimeout(1000);
    }

    // Fill password if found
    if (passFound && passFoundSelector) {
      session.currentStep = 'Memasukkan kata sandi ke formulir Google...';
      this.addLog(session, `🔑 [Tahap Password] Mengisi kata sandi ke input password untuk: ${params.email}...`);

      await page.click(passFoundSelector);
      await page.waitForTimeout(300);
      await fillNativeInputInPage(passFoundSelector, params.password);
      await page.fill(passFoundSelector, params.password);
      await page.waitForTimeout(400);

      // Verify real filled value
      let filledLen = await page.$eval(passFoundSelector, (el: any) => (el.value ? el.value.length : 0)).catch(() => 0);
      if (filledLen === 0) {
        this.addLog(session, '🔄 Mencoba metode insertText langsung untuk mengisi kata sandi...');
        await page.evaluate((val) => {
          try {
            document.execCommand('insertText', false, val);
          } catch (e) {}
        }, params.password).catch(() => {});
        await page.waitForTimeout(300);
        filledLen = await page.$eval(passFoundSelector, (el: any) => (el.value ? el.value.length : 0)).catch(() => 0);
      }

      if (filledLen > 0) {
        this.addLog(session, `✅ Password terverifikasi terisi (${filledLen} karakter). Mengklik Next...`);
        const nextPassBtn =
          '#passwordNext button, #passwordNext, #confirmidentifierNext button, #confirmidentifierNext, button:has-text("Next"), button:has-text("Berikutnya"), button:has-text("Selanjutnya"), button:has-text("Masuk")';
        const nextPassEl = await page.$(nextPassBtn);
        if (nextPassEl && (await nextPassEl.isVisible())) {
          await nextPassEl.click();
        } else {
          await page.keyboard.press('Enter');
        }
        hasFilledPassword = true;
      } else {
        this.addLog(session, '⚠️ Gagal mengisi nilai password. Mengirimkan submit tombol Enter...');
        await page.keyboard.press('Enter');
      }

    }

    // Follow the extension flow: do not open Gemini until Google confirms the login.
    if (!googleLoginVerified) {
      session.currentStep = 'Menunggu Google mengonfirmasi login atau meminta verifikasi...';
      this.addLog(session, 'Menunggu konfirmasi autentikasi Google (status sesi / 2FA)...');
      const loginWaitDeadline = Date.now() + 60000;

      while (Date.now() < loginWaitDeadline) {
        try {
          const currentUrl = page.url().toLowerCase();
          const bodyText = (await page.innerText('body').catch(() => '')).toLowerCase();

          const isVerifyScreen =
            currentUrl.includes('confirmidentifier') ||
            currentUrl.includes('challenge/reauth') ||
            bodyText.includes("verify it's you") ||
            bodyText.includes('verifikasi bahwa ini memang anda') ||
            bodyText.includes('verifikasi diri anda') ||
            bodyText.includes('to help keep your account secure') ||
            bodyText.includes('untuk membantu menjaga keamanan akun anda');
          if (isVerifyScreen) {
            const verifyButton = await page.$(
              '#confirmidentifierNext button, #confirmidentifierNext, button:has-text("Next"), button:has-text("Berikutnya"), button:has-text("Continue"), button:has-text("Lanjutkan"), button:has-text("Selanjutnya")'
            );
            if (verifyButton && (await verifyButton.isVisible())) {
              this.addLog(session, '🛡️ [Verify It\'s You] Mengikuti konfirmasi identitas Google...');
              await verifyButton.click();
              hasFilledPassword = false;
              await page.waitForTimeout(1200);
              continue;
            }
          }

          const reachedSuccessUrl =
            currentUrl.includes('myaccount.google.com') ||
            currentUrl.includes('accounts.google.com/manageaccount') ||
            currentUrl.includes('accounts.google.com/b/');
          if (reachedSuccessUrl) {
            googleLoginVerified = true;
            this.addLog(session, '🎉 LOGIN GOOGLE BERHASIL TERVERIFIKASI!');
            break;
          }

          const isWrongScreen =
            currentUrl.includes('unknownerror') ||
            currentUrl.includes('signin/rejected') ||
            bodyText.includes('something went wrong') ||
            bodyText.includes('terjadi kesalahan') ||
            bodyText.includes('ada yang salah') ||
            bodyText.includes('sorry, something went wrong there') ||
            bodyText.includes('maaf, terjadi kesalahan');
          if (isWrongScreen) {
            const retryButton = await page.$(
              'button:has-text("Next"), button:has-text("Berikutnya"), button:has-text("Try again"), button:has-text("Coba lagi"), button:has-text("Ulang")'
            );
            if (retryButton && (await retryButton.isVisible())) {
              this.addLog(session, '⚠️ Google meminta retry. Mengulang halaman login seperti ekstensi...');
              await retryButton.click();
            }
            await page.goto(googleLoginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
            hasFilledEmail = false;
            hasFilledPassword = false;
            continue;
          }

          const isTermsScreen =
            currentUrl.includes('speedbump') ||
            currentUrl.includes('workspacetermsofservice') ||
            currentUrl.includes('consent') ||
            bodyText.includes('welcome to your new account') ||
            bodyText.includes('selamat datang di akun baru') ||
            bodyText.includes('terms of service') ||
            bodyText.includes('persyaratan layanan') ||
            bodyText.includes('i agree') ||
            bodyText.includes('saya setuju') ||
            bodyText.includes('i understand') ||
            bodyText.includes('saya mengerti');
          if (isTermsScreen) {
            await page.evaluate(() => {
              window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
              document.documentElement.scrollTop = document.documentElement.scrollHeight;
            }).catch(() => {});
            const clicked = await this.clickVisibleGoogleAction(page, [
              'i understand',
              'saya mengerti',
              'i agree',
              'saya setuju',
              'accept',
              'terima',
              'continue',
              'lanjutkan',
              'next',
              'berikutnya',
            ]);
            if (clicked) {
              this.addLog(session, '📜 [Terms] Mengonfirmasi persetujuan Google...');
              await page.waitForTimeout(1200);
              continue;
            }
          }

          const isAccountPicker =
            currentUrl.includes('accountchooser') ||
            currentUrl.includes('chooseaccount') ||
            currentUrl.includes('signinchooser') ||
            bodyText.includes('choose an account') ||
            bodyText.includes('pilih akun');
          if (isAccountPicker) {
            const targetAccount = await page.$(`[data-identifier="${params.email}"]`);
            const useAnotherAccount = await page.$(
              'button:has-text("Use another account"), button:has-text("Gunakan akun lain"), button:has-text("Tambahkan akun")'
            );
            const pickerOption = targetAccount || useAnotherAccount;
            if (pickerOption && (await pickerOption.isVisible())) {
              this.addLog(session, `👥 [Account Chooser] Memilih akun ${params.email}...`);
              await pickerOption.click();
              await page.waitForTimeout(1200);
              continue;
            }
          }

          const passInput = await page.$(
            'input[name="Passwd"], input[name="password"], input[type="password"], input[autocomplete="current-password"], input[aria-label*="password" i], input[aria-label*="sandi" i]'
          );
          if (passInput && (await passInput.isVisible())) {
            if (!bodyText.includes(params.email.toLowerCase()) && !currentUrl.includes('confirmidentifier')) {
              const switchAccount = await page.$(
                'button:has-text("Not you"), button:has-text("Bukan Anda"), button:has-text("Switch account"), button:has-text("Ganti akun"), button:has-text("Use another account"), button:has-text("Gunakan akun lain")'
              );
              if (switchAccount && (await switchAccount.isVisible())) {
                await switchAccount.click();
                await page.waitForTimeout(1200);
                continue;
              }
            }

            if (!hasFilledPassword) {
              await fillNativeInputInPage('input[name="Passwd"], input[name="password"], input[type="password"], input[autocomplete="current-password"], input[aria-label*="password" i], input[aria-label*="sandi" i]', params.password);
              const passwordValue = await passInput.inputValue().catch(() => '');
              if (passwordValue) {
                const nextButton = await page.$(
                  '#passwordNext button, #passwordNext, #confirmidentifierNext button, #confirmidentifierNext, button:has-text("Next"), button:has-text("Berikutnya"), button:has-text("Selanjutnya"), button:has-text("Masuk")'
                );
                if (nextButton && (await nextButton.isVisible())) await nextButton.click();
                else await page.keyboard.press('Enter');
                hasFilledPassword = true;
                await page.waitForTimeout(2500);
              }
              continue;
            }
          }

          const emailInput = await page.$(
            '#identifierId, input[name="identifier"], input[type="email"], input[autocomplete="username"]'
          );
          if (emailInput && (await emailInput.isVisible()) && !hasFilledEmail) {
            await fillNativeInputInPage('#identifierId, input[name="identifier"], input[type="email"], input[autocomplete="username"]', params.email);
            const emailValue = await emailInput.inputValue().catch(() => '');
            if (emailValue) {
              const nextButton = await page.$(
                '#identifierNext button, #identifierNext, button:has-text("Next"), button:has-text("Berikutnya"), button:has-text("Selanjutnya")'
              );
              if (nextButton && (await nextButton.isVisible())) await nextButton.click();
              else await page.keyboard.press('Enter');
              hasFilledEmail = true;
            }
          }

          const isChallengePage =
            currentUrl.includes('challenge') ||
            currentUrl.includes('signinoptions') ||
            currentUrl.includes('two-step-verification');
          const hasCodeInput = await page.$(
            '#idvPin, input[name="totpPin"], input[name="pin"], input[autocomplete="one-time-code"]'
          );
          const hasTelephoneInput = await page.$('input[type="tel"]');
          const asksForVerificationCode =
            bodyText.includes('verification code') ||
            bodyText.includes('enter the code') ||
            bodyText.includes('6-digit') ||
            bodyText.includes('kode verifikasi') ||
            bodyText.includes('masukkan kode') ||
            bodyText.includes('kode 6 digit');
          const phonePromptPattern =
            /tap yes|ketuk ya|check your phone|periksa ponsel|sent a notification|notifikasi.*ponsel|konfirmasi.*ponsel/i;
          const hasPhonePrompt = isChallengePage && phonePromptPattern.test(bodyText);

          if (
            isChallengePage &&
            (hasCodeInput || (hasTelephoneInput && asksForVerificationCode) || hasPhonePrompt)
          ) {
            googleChallengeDetected = true;
            break;
          }

          if (await this.hasGoogleAuthCookie(context)) {
            googleLoginVerified = true;
            this.addLog(session, '🎉 LOGIN GOOGLE BERHASIL TERVERIFIKASI! Cookie sesi autentikasi ditemukan.');
            break;
          }

          await page.waitForTimeout(500);
        } catch (err: any) {
          const message = String(err?.message || err).toLowerCase();
          if (
            message.includes('execution context was destroyed') ||
            message.includes('frame was detached') ||
            message.includes('most likely because of a navigation')
          ) {
            await page.waitForTimeout(500).catch(() => {});
            continue;
          }
          throw err;
        }
      }
    }

    if (!googleLoginVerified && !googleChallengeDetected) {
      session.status = 'error';
      session.currentStep = 'Login Google belum terkonfirmasi.';
      session.error =
        'Google belum mengonfirmasi login setelah menunggu 60 detik. Proses tidak dilanjutkan ke Gemini; periksa halaman login atau coba lagi.';
      session.screenshotBase64 = await this.captureScreenshot(page);
      this.addLog(session, `❌ ${session.error}`);
      await this.cleanupSession(session.id);
      return;
    }

    // Step 4: Check for 2FA / Verification Challenge
    session.currentStep = 'Mengecek verifikasi keamanan Google & 2FA...';
    this.addLog(session, 'Memeriksa respons otentikasi Google...');
    await page.waitForTimeout(1000);

    // Check if recovery email is requested
    const recoveryEmailInput = await page
      .$('[name="knowledgePreregisteredEmailResponse"], input[type="email"]')
      .catch(() => null);
    if (recoveryEmailInput && params.recoveryEmail) {
      this.addLog(session, 'Google meminta konfirmasi email pemulihan. Mengisi email pemulihan...');
      await recoveryEmailInput.fill(params.recoveryEmail);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    }

    // Detect 2FA / Challenge
    const currentUrl = page.url();
    if (googleChallengeDetected) {
      this.addLog(session, 'Verifikasi 2 Langkah / Keamanan (2FA) terdeteksi dari Google!');
      session.screenshotBase64 = await this.captureScreenshot(page);

      // Check for PIN / OTP input
      const pinSelector = '#idvPin, input[name="totpPin"], input[id="idvPin"], input[name="pin"], input[autocomplete="one-time-code"]';
      let hasPinInput = await page.$(pinSelector);
      if (!hasPinInput) {
        const telephoneInput = await page.$('input[type="tel"]');
        const challengeText = (await page.innerText('body').catch(() => '')).toLowerCase();
        const asksForVerificationCode =
          challengeText.includes('verification code') ||
          challengeText.includes('enter the code') ||
          challengeText.includes('6-digit') ||
          challengeText.includes('kode verifikasi') ||
          challengeText.includes('masukkan kode') ||
          challengeText.includes('kode 6 digit');
        if (telephoneInput && asksForVerificationCode) hasPinInput = telephoneInput;
      }

      if (hasPinInput) {
        session.status = 'awaiting_2fa';
        session.challengeType = 'totp';
        session.challengePrompt =
          'Google meminta Kode Verifikasi 2FA (SMS / Google Authenticator). Masukkan 6 digit kode verifikasi pada form di bawah lalu klik "Kirim Kode 2FA".';
        session.currentStep = 'Menunggu input kode 2FA dari Anda...';
        this.addLog(session, session.challengePrompt);
        return; // Pause execution, waiting for submit2FA
      }

      // Check for phone prompt / tap notification
      const challengeText = (await page.innerText('body').catch(() => '')).toLowerCase();
      const hasPhonePrompt =
        /tap yes|ketuk ya|check your phone|periksa ponsel|sent a notification|notifikasi.*ponsel|konfirmasi.*ponsel/i.test(
          challengeText
        );
      if (hasPhonePrompt) {
        let promptMsg =
          'Google mengirimkan notifikasi konfirmasi ke ponsel Anda. Buka HP Anda dan ketuk "Ya" / konfirmasi nomor verifikasi.';
        if (challengeText.includes('ketuk ya') || challengeText.includes('tap yes') || challengeText.includes('youtube')) {
          promptMsg = 'Buka ponsel atau aplikasi Google/YouTube Anda, lalu ketuk "Ya" untuk mengizinkan login.';
        }

        session.status = 'awaiting_2fa';
        session.challengeType = 'phone_prompt';
        session.challengePrompt = promptMsg;
        session.currentStep = 'Menunggu konfirmasi di ponsel Anda...';
        this.addLog(session, promptMsg);

        // Start background poller waiting for user to tap "Yes" on their phone
        this.pollForPhoneApproval(session, params.customLabel);
        return;
      }

      const authenticated = await this.waitForGoogleAuthentication(session, 10000);
      if (authenticated) {
        await this.completeGeminiOnboarding(session, params.customLabel);
        return;
      }

      session.status = 'error';
      session.error = 'Halaman Google masih berada di verifikasi, tetapi tidak ditemukan input kode atau instruksi konfirmasi ponsel yang dikenali.';
      session.currentStep = 'Verifikasi Google tidak dikenali.';
      this.addLog(session, `❌ ${session.error}`);
      await this.cleanupSession(session.id);
      return;
    }

    // Proceed to Step 2: Gemini Onboarding & Registration (100% matching ektension-gemini-google pipeline)
    await this.completeGeminiOnboarding(session, params.customLabel);
  }

  /**
   * Submit 2FA code entered by user
   */
  public async submit2FA(sessionId: string, code: string, customLabel?: string) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page || session.status !== 'awaiting_2fa') {
      throw new Error('Sesi tidak valid atau tidak sedang menunggu verifikasi 2FA.');
    }

    const page = session.page;
    this.addLog(session, `Memasukkan kode 2FA: ${code.slice(0, 2)}****`);
    session.currentStep = 'Memasukkan kode 2FA ke formulir Google...';

    const pinSelector = 'input[type="tel"], #idvPin, input[name="totpPin"], input[id="idvPin"], input[name="pin"]';
    const pinInput = await page.$(pinSelector);

    if (pinInput) {
      await pinInput.fill('');
      await pinInput.type(code.trim(), { delay: 35 });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    } else {
      // User tapped confirm on phone
      this.addLog(session, 'Memeriksa status persetujuan login Google...');
      await page.waitForTimeout(2000);
    }

    // Check if challenge succeeded
    const url = page.url();
    if (url.includes('challenge')) {
      const errEl = await page.$('[aria-live="assertive"]');
      if (errEl) {
        const errText = await errEl.innerText().catch(() => '');
        if (errText.includes('salah') || errText.includes('wrong') || errText.includes('invalid')) {
          session.screenshotBase64 = await this.captureScreenshot(page);
          throw new Error(`Google: Kode 2FA salah atau kedaluwarsa (${errText}).`);
        }
      }
    }

    if (!(await this.waitForGoogleAuthentication(session))) {
      const error = 'Google belum mengonfirmasi login setelah verifikasi 2FA. Proses tidak dilanjutkan ke Gemini.';
      session.status = 'error';
      session.error = error;
      session.screenshotBase64 = await this.captureScreenshot(page);
      this.addLog(session, `❌ ${error}`);
      await this.cleanupSession(session.id);
      throw new Error(error);
    }

    // Proceed to Gemini
    await this.completeGeminiOnboarding(session, customLabel);
  }

  private async pollForPhoneApproval(session: PlaywrightSession, customLabel?: string) {
    if (!session.page) return;
    const page = session.page;
    let attempts = 0;
    const maxAttempts = 30; // 30 * 2.5s = 75 seconds

    const interval = setInterval(async () => {
      attempts++;
      if (session.status !== 'awaiting_2fa' || !session.page || session.page.isClosed()) {
        clearInterval(interval);
        return;
      }

      try {
        const url = page.url();
        if (url.includes('gemini.google.com') || !url.includes('challenge')) {
          clearInterval(interval);
          this.addLog(session, 'Persetujuan di ponsel terdeteksi. Menunggu Google mengaktifkan sesi...');
          if (await this.waitForGoogleAuthentication(session)) {
            this.addLog(session, 'Login Google terverifikasi. Membuka Gemini...');
            await this.completeGeminiOnboarding(session, customLabel);
          } else {
            session.status = 'error';
            session.error = 'Google belum mengonfirmasi sesi setelah persetujuan di ponsel.';
            this.addLog(session, `❌ ${session.error}`);
            await this.cleanupSession(session.id);
          }
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          session.status = 'error';
          session.error = 'Waktu konfirmasi di ponsel habis (timeout). Silakan coba lagi.';
          this.addLog(session, session.error);
          await this.cleanupSession(session.id);
        }
      } catch (e) {
        clearInterval(interval);
      }
    }, 2500);
  }

  /**
   * Navigate through Gemini Onboarding & Terms, extract cookies & account details
   */
  private async completeGeminiOnboarding(session: PlaywrightSession, customLabel?: string) {
    if (!session.page || !session.context) return;
    const page = session.page;
    const context = session.context;

    session.status = 'navigating_gemini';
    session.currentStep = 'Membuka portal Google Gemini (gemini.google.com)...';
    this.addLog(session, 'Mengarahkan browser ke https://gemini.google.com/app...');

    try {
      if (!page.url().includes('gemini.google.com/app')) {
        await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 35000 });
      }
      await page.waitForTimeout(2500);
    } catch (e: any) {
      this.addLog(session, `Peringatan navigasi: ${e.message}. Mencoba melanjutkan...`);
    }

    // Step 5: Handling Gemini Terms & First-time Onboarding Dialogs (100% matching gemini_content.js in ektension-gemini-google)
    session.status = 'accepting_terms';
    session.currentStep = 'Memeriksa & mengaktivasi portal Google Gemini...';
    this.addLog(session, 'Mengecek syarat, notifikasi, & dialog aktivasi Gemini...');

    // Function matching findAndClickGeminiAction in gemini_content.js
    const triggerInPageClick = async (selector: string) => {
      return page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) return false;
        el.focus();
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
        for (const ev of events) {
          el.dispatchEvent(
            new MouseEvent(ev, {
              bubbles: true,
              cancelable: true,
              view: window,
              buttons: 1,
            })
          );
        }
        el.click();
        return true;
      }, selector).catch(() => false);
    };

    const maxCycles = 8;
    for (let cycle = 0; cycle < maxCycles; cycle++) {
      let actionFound = false;

      // 1. PRIORITAS 1 in gemini_content.js: Fallback "Sign in" / "Masuk" jika belum login
      const signInSelectors = [
        'button:has-text("Sign in")',
        'a:has-text("Sign in")',
        'button:has-text("Masuk")',
        'a:has-text("Masuk")',
        'button:has-text("Sign in to save activity")',
      ];
      for (const sel of signInSelectors) {
        try {
          const el = await page.$(sel);
          if (el && (await el.isVisible())) {
            this.addLog(session, '👉 [Gemini Fallback] Sesi belum aktif. Mengklik tombol "Sign in"...');
            await el.click();
            await page.waitForTimeout(2000);
            actionFound = true;
            break;
          }
        } catch (_) {}
      }

      // 2. PRIORITAS 2 in gemini_content.js: "Use Gemini" di dialog Terms & Privacy
      if (!actionFound) {
        const useGeminiSelectors = [
          'button:has-text("Use Gemini")',
          'button:has-text("Gunakan Gemini")',
          'button:has-text("Coba Gemini")',
          'button:has-text("Try Gemini")',
          '[aria-label*="Use Gemini" i]',
          '[aria-label*="Gunakan Gemini" i]',
        ];
        for (const sel of useGeminiSelectors) {
          try {
            const el = await page.$(sel);
            if (el && (await el.isVisible())) {
              this.addLog(session, '👉 [Gemini Onboarding] Menemukan & mengklik tombol "Use Gemini"...');
              await el.click();
              await page.waitForTimeout(2000);
              actionFound = true;
              break;
            }
          } catch (_) {}
        }
      }

      // 3. PRIORITAS 3 in gemini_content.js: "Continue" di dialog Welcome
      if (!actionFound) {
        const continueSelectors = [
          'button:has-text("Continue")',
          'button:has-text("Lanjutkan")',
          'button:has-text("Lanjut")',
          'button:has-text("Mulai")',
          'button:has-text("Get started")',
        ];
        for (const sel of continueSelectors) {
          try {
            const el = await page.$(sel);
            if (el && (await el.isVisible())) {
              this.addLog(session, '👉 [Gemini Onboarding] Menemukan & mengklik tombol "Continue"...');
              await el.click();
              await page.waitForTimeout(2000);
              actionFound = true;
              break;
            }
          } catch (_) {}
        }
      }

      // 4. PRIORITAS 4 in gemini_content.js: Dialog Notifikasi ("Block", "Allow", "Dismiss", "Close")
      if (!actionFound) {
        const notifSelectors = [
          'button:has-text("Dismiss")',
          'button:has-text("Close")',
          'button:has-text("Tutup")',
          'button:has-text("Block")',
          'button:has-text("Allow")',
          'button:has-text("Blokir")',
          'button:has-text("Izinkan")',
        ];
        for (const sel of notifSelectors) {
          try {
            const el = await page.$(sel);
            if (el && (await el.isVisible())) {
              this.addLog(session, `👉 [Gemini Onboarding] Mengklik respon notifikasi: "${sel}"...`);
              await el.click();
              await page.waitForTimeout(1500);
              actionFound = true;
              break;
            }
          } catch (_) {}
        }
      }

      // 5. PRIORITAS 5 in gemini_content.js: Persetujuan ("I agree", "Saya setuju", "I understand", "Got it", "Accept")
      if (!actionFound) {
        const agreeSelectors = [
          'button:has-text("I agree")',
          'button:has-text("Saya setuju")',
          'button:has-text("Agree")',
          'button:has-text("Setuju")',
          'button:has-text("I understand")',
          'button:has-text("Saya mengerti")',
          'button:has-text("Got it")',
          'button:has-text("Paham")',
          'button:has-text("Accept")',
          'button:has-text("Terima")',
          'button[aria-label="Saya setuju"]',
          'button[aria-label="I agree"]',
        ];
        for (const sel of agreeSelectors) {
          try {
            const el = await page.$(sel);
            if (el && (await el.isVisible())) {
              this.addLog(session, `👉 [Gemini Onboarding] Menemukan & mengklik persetujuan: "${sel}"...`);
              await el.click();
              await page.waitForTimeout(2000);
              actionFound = true;
              break;
            }
          } catch (_) {}
        }
      }

      // 6. PRIORITAS 6 in gemini_content.js: "Chat with Gemini" di Landing Page
      if (!actionFound) {
        const landingSelectors = [
          'button:has-text("Chat with Gemini")',
          'a:has-text("Chat with Gemini")',
          'button:has-text("Coba Gemini")',
        ];
        for (const sel of landingSelectors) {
          try {
            const el = await page.$(sel);
            if (el && (await el.isVisible())) {
              this.addLog(session, '👉 [Gemini Landing] Menemukan & mengklik tombol "Chat with Gemini"...');
              await el.click();
              await page.waitForTimeout(2000);
              actionFound = true;
              break;
            }
          } catch (_) {}
        }
      }

      // Check chat readiness (matching checkGeminiChatReady in gemini_content.js)
      const isChatReady = await page.evaluate(() => {
        const chatSelectors = [
          'rich-textarea',
          'div.ql-editor[contenteditable="true"]',
          'div[contenteditable="true"]',
          'textarea[placeholder*="Ask Gemini" i]',
          'textarea[placeholder*="Tanya Gemini" i]',
          'textarea[aria-label*="prompt" i]',
        ];
        return chatSelectors.some((s) => {
          const el = document.querySelector(s);
          return el !== null;
        });
      }).catch(() => false);

      if (isChatReady && !actionFound) {
        this.addLog(session, '✨ Antarmuka chat Gemini aktif dan siap digunakan!');
        break;
      }

      await page.waitForTimeout(1000);
    }

    // Step 6: Extract Session Cookies & Account Identity
    session.status = 'extracting_session';
    session.currentStep = 'Mengekstrak cookies sesi otentikasi Google Gemini...';
    this.addLog(session, 'Mengambil cookies sesi Google (__Secure-1PSID, SID, SAPISID)...');

    // Extract all cookies across the entire context
    const allCookies = await context.cookies(['https://gemini.google.com']);
    const docCookieStr = await page.evaluate(() => document.cookie).catch(() => '');

    const essentialKeys = [
      'SEARCH_SAMESITE',
      'AEC',
      'HSID',
      'SSID',
      'APISID',
      'SAPISID',
      '__Secure-1PAPISID',
      '__Secure-3PAPISID',
      'SID',
      '__Secure-1PSID',
      '__Secure-3PSID',
      'NID',
      '__Secure-1PSIDTS',
      '__Secure-1PSIDRTS',
      '__Secure-3PSIDTS',
      '__Secure-3PSIDRTS',
      'SIDCC',
      '__Secure-1PSIDCC',
      '__Secure-3PSIDCC',
      'OSID',
      '__Secure-OSID',
      'SOCS',
      'COMPASS',
      '1P_JAR',
      'OTZ',
    ];

    const cookiePairs: string[] = [];
    const seen = new Set<string>();

    for (const c of allCookies) {
      if (!seen.has(c.name) && c.value) {
        seen.add(c.name);
        cookiePairs.push(`${c.name}=${c.value}`);
      }
    }

    if (docCookieStr) {
      const parts = docCookieStr.split(';');
      for (const p of parts) {
        const trimmed = p.trim();
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const k = trimmed.slice(0, eqIdx).trim();
          const v = trimmed.slice(eqIdx + 1).trim();
          if (k && v && !seen.has(k)) {
            seen.add(k);
            cookiePairs.push(`${k}=${v}`);
          }
        }
      }
    }

    if (cookiePairs.length === 0) {
      session.screenshotBase64 = await this.captureScreenshot(page);
      throw new Error(
        'Tidak berhasil mengekstrak cookie sesi Google Gemini. Pastikan akun berhasil login tanpa terblokir.'
      );
    }

    const cookieString = cookiePairs.join('; ');
    this.addLog(session, `Berhasil mengekstrak ${cookiePairs.length} token otentikasi sesi Google.`);

    if (!getAuthorizationHeader(cookieString)) {
      session.status = 'error';
      session.currentStep = 'Validasi cookie sesi Google gagal.';
      session.error =
        'Login Google/Gemini belum menghasilkan cookie SAPISID yang dibutuhkan untuk generate. Akun tidak disimpan; coba login ulang dan pastikan sesi Google benar-benar aktif.';
      session.screenshotBase64 = await this.captureScreenshot(page);
      this.addLog(session, `❌ ${session.error}`);
      await this.cleanupSession(session.id);
      return;
    }

    // Extract user profile and SNlM0e from page DOM / WIZ_global_data
    let displayName = customLabel || '';
    let email = session.email;
    let photoUrl = '';
    let snlm0e = '';

    try {
      const extractedInfo = await page.evaluate(() => {
        let name = '';
        let photo = '';
        let snlm = '';
        let em = '';

        // @ts-ignore
        if (window.WIZ_global_data) {
          // @ts-ignore
          const w = window.WIZ_global_data;
          if (w.SNlM0e) snlm = w.SNlM0e;
          else if (w.uS02ke) snlm = w.uS02ke;
          if (w.oPEP7c) em = w.oPEP7c;
        }

        // Check avatar elements
        const img = document.querySelector('img[src*="googleusercontent.com"]');
        if (img && img.getAttribute('src')) {
          photo = img.getAttribute('src') || '';
        }

        return { name, photo, snlm, em };
      });

      if (extractedInfo.snlm) snlm0e = extractedInfo.snlm;
      if (extractedInfo.photo) photoUrl = extractedInfo.photo;
      if (!displayName && extractedInfo.name) displayName = extractedInfo.name;
    } catch (e) {}

    // STEP 7: Fetch and verify data directly from OneGoogle AsyncDataService endpoint
    this.addLog(session, '📡 [GetAsyncData] Mengekstrak data akun dari https://ogads-pa.clients6.google.com/$rpc/google.internal.onegoogle.asyncdata.v1.AsyncDataService/GetAsyncData...');
    let getAsyncDataCurl = '';
    try {
      const asyncRes = await fetchOneGoogleAsyncData(cookieString);
      getAsyncDataCurl = session.getAsyncDataCurl || asyncRes.requestCurl || '';
      if (session.getAsyncDataCurl) {
        this.addLog(session, '📄 cURL GetAsyncData aktual dari browser siap disimpan bersama akun.');
      } else if (asyncRes.requestCurl) {
        this.addLog(session, '📄 cURL GetAsyncData backend siap disimpan bersama akun.');
      }
      if (asyncRes.success) {
        if (asyncRes.displayName) displayName = asyncRes.displayName;
        if (asyncRes.email) email = asyncRes.email;
        if (asyncRes.photoUrl) photoUrl = asyncRes.photoUrl;
        this.addLog(session, `✨ [OneGoogle AsyncData Valid] Terverifikasi: ${email} (${displayName})`);
      }
    } catch (asyncErr: any) {
      console.warn('[GetAsyncData warning]:', asyncErr.message);
    }

    if (!displayName) {
      displayName = email.split('@')[0];
    }

    const shortId = Math.random().toString(36).slice(2, 6);
    const newAccount = {
      id: `acc-gemini-${Date.now()}-${shortId}`,
      name: displayName,
      displayName,
      email,
      token: getAsyncDataCurl || cookieString,
      providerId: 'gemini' as const,
      tier: 'Google Gemini (Web Session)',
      credits: GEMINI_MAX_CREDITS,
      totalCredits: GEMINI_MAX_CREDITS,
      isActive: true,
      photoUrl,
      snlm0e,
    };

    session.account = newAccount;
    session.status = 'success';
    session.currentStep = 'Akun Google Gemini berhasil didaftarkan dan terhubung!';
    this.addLog(session, '🎉 REGISTRASI & LOGIN GEMINI BERHASIL 100%! Akun sudah aktif di Gemini.');
    this.addLog(session, `💾 Berhasil menyimpan ${cookiePairs.length} cookie sesi (AUTH VALID) untuk ${email}!`);

    // Clean up browser instance
    await this.cleanupSession(session.id);
  }

  /**
   * Generates standalone Playwright scripts for users who prefer running locally
   */
  public getLocalPlaywrightScripts() {
    const nodeScript = `/**
 * ====================================================================
 * STANDALONE PLAYWRIGHT GOOGLE GEMINI LOGIN RUNNER (LOCAL PC)
 * ====================================================================
 * Jalankan script ini di PC Anda untuk login Google dengan browser Chrome
 * asli (mendukung Passkey, WebAuthn, biometric, dan bebas bot detection).
 * 
 * CARA MENGGUNAKAN:
 * 1. Simpan file ini sebagai: login-gemini.js
 * 2. Install Playwright:
 *      npm install playwright
 * 3. Jalankan:
 *      node login-gemini.js
 * 4. Browser Chrome akan terbuka. Login ke akun Google Anda.
 * 5. Saat masuk ke gemini.google.com, cookie sesi akan otomatis dicopy!
 * ====================================================================
 */

const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Membuka Chrome untuk Login Google Gemini...');
  const browser = await chromium.launch({
    headless: false, // Menampilkan browser asli di layar Anda
    args: ['--disable-blink-features=AutomationControlled', '--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null
  });

  const page = await context.newPage();
  console.log('🌐 Membuka https://gemini.google.com/app ...');
  await page.goto('https://gemini.google.com/app');

  console.log('👉 Silakan login akun Google Anda di jendela Chrome yang terbuka.');
  console.log('⏳ Menunggu Anda selesai login dan masuk ke portal Gemini...');

  // Tunggu hingga pengguna berhasil masuk ke gemini.google.com
  await page.waitForURL(/gemini\\.google\\.com\\/app/, { timeout: 300000 });
  await page.waitForTimeout(3000);

  // Ambil semua cookie sesi
  const cookies = await context.cookies(['https://google.com', 'https://gemini.google.com']);
  const essentialKeys = ['__Secure-1PSID', '__Secure-1PSIDTS', 'SID', 'HSID', 'SSID', 'APISID', 'SAPISID'];
  const cookiePairs = [];

  for (const c of cookies) {
    if (essentialKeys.includes(c.name) || c.name.startsWith('__Secure-')) {
      cookiePairs.push(\`\${c.name}=\${c.value}\`);
    }
  }

  const cookieString = cookiePairs.join('; ');
  console.log('\\n================== COOKIE SESI GEMINI ==================');
  console.log(cookieString);
  console.log('========================================================\\n');
  console.log('✅ Salin teks cookie di atas dan paste di form Tambah Akun Gemini!');

  await browser.close();
})();
`;

    const pythonScript = `"""
====================================================================
STANDALONE PLAYWRIGHT GOOGLE GEMINI LOGIN RUNNER (PYTHON)
====================================================================
Jalankan script ini di PC Anda untuk login Google Gemini lokal.

CARA MENGGUNAKAN:
1. Simpan file ini sebagai: login_gemini.py
2. Install Playwright:
     pip install playwright
     playwright install chromium
3. Jalankan:
     python login_gemini.py
4. Browser Chrome akan terbuka. Login ke akun Google Anda.
5. Cookie sesi akan tercetak di terminal.
====================================================================
"""

import asyncio
from playwright.async_api import async_playwright

async def main():
    print("🚀 Membuka Chrome untuk Login Google Gemini...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            args=["--disable-blink-features=AutomationControlled", "--start-maximized"]
        )
        context = await browser.new_context(no_viewport=True)
        page = await context.new_page()

        print("🌐 Membuka https://gemini.google.com/app ...")
        await page.goto("https://gemini.google.com/app")

        print("👉 Silakan login akun Google Anda di jendela Chrome.")
        print("⏳ Menunggu Anda masuk ke portal Gemini...")

        await page.wait_for_url("**/gemini.google.com/app**", timeout=300000)
        await asyncio.sleep(3)

        cookies = await context.cookies(["https://google.com", "https://gemini.google.com"])
        essential = {"__Secure-1PSID", "__Secure-1PSIDTS", "SID", "HSID", "SSID", "APISID", "SAPISID"}
        pairs = []
        for c in cookies:
            if c["name"] in essential or c["name"].startswith("__Secure-"):
                pairs.append(f"{c['name']}={c['value']}")

        cookie_str = "; ".join(pairs)
        print("\\n================== COOKIE SESI GEMINI ==================")
        print(cookie_str)
        print("========================================================\\n")
        print("✅ Salin teks cookie di atas dan paste di form Tambah Akun Gemini!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
`;

    return { nodeScript, pythonScript };
  }
}

export const geminiPlaywrightManager = new GeminiPlaywrightManager();
