import { resolveLocalPlaywrightExecutable } from '../initPlaywright';
import { getProfileDirForEmail } from '../utils/geminiProfileCookies';
import {
  GeminiClientContext,
  readGeminiClientContext,
  writeGeminiClientContext,
  clearGeminiClientContext,
  summarizeGeminiClientContext,
} from '../utils/geminiClientContext';

const HARVEST_TIMEOUT_MS = 90_000;
const PROBE_PROMPT = 'hi';

type Captured = {
  url: string;
  headers: Record<string, string>;
  postData: string;
  cookies: string;
};

const inFlightHarvest = new Map<string, Promise<GeminiClientContext | null>>();

function parseCookieString(cookieStr: string): { name: string; value: string }[] {
  return String(cookieStr || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf('=');
      if (idx <= 0) return null;
      const name = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (!name || !value) return null;
      return { name, value };
    })
    .filter(Boolean) as { name: string; value: string }[];
}

function buildChatContextFromPostData(postData: string): unknown[] | null {
  const bodyParams = new URLSearchParams(postData);
  const fReq = bodyParams.get('f.req');
  if (!fReq) return null;
  try {
    const outer = JSON.parse(fReq);
    const innerRaw = Array.isArray(outer) ? outer[1] : null;
    const chatContext = JSON.parse(typeof innerRaw === 'string' ? innerRaw : JSON.stringify(innerRaw));
    if (!Array.isArray(chatContext) || chatContext.length < 90) return null;
    return chatContext;
  } catch (e) {
    return null;
  }
}

async function harvestWithContext(
  context: any,
  cookiesForFallback: string
): Promise<{ captured: Captured; chatContext: unknown[] } | null> {
  const page = context.pages()[0] || (await context.newPage());

  let resolveCapture: ((c: Captured) => void) | null = null;
  const capturePromise = new Promise<Captured>((resolve) => {
    resolveCapture = resolve;
  });

  await page.route('**/StreamGenerate**', async (route) => {
    const request = route.request();
    try {
      const headers = await request.allHeaders().catch(() => request.headers());
      const captured: Captured = {
        url: request.url(),
        headers,
        postData: request.postData() || '',
        cookies: '',
      };
      if (resolveCapture) {
        const fn = resolveCapture;
        resolveCapture = null;
        fn(captured);
      }
    } catch (e) {}
    // Blokir: request tidak pernah sampai ke server Gemini -> tidak ada generate.
    try {
      await route.abort('blockedbyclient');
    } catch (e) {}
  });

  await page.goto('https://gemini.google.com/app', {
    waitUntil: 'domcontentloaded',
    timeout: HARVEST_TIMEOUT_MS,
  });

  const composer = await page
    .waitForSelector('rich-textarea .ql-editor, textarea[aria-label*="prompt" i], .ql-editor', {
      timeout: 45_000,
    })
    .catch(() => null);

  if (!composer) return null;

  await composer.click();
  await page.keyboard.type(PROBE_PROMPT, { delay: 20 });
  await page.keyboard.press('Enter');

  const captured = await Promise.race([
    capturePromise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 30_000)),
  ]);

  if (!captured) return null;

  const chatContext = buildChatContextFromPostData(captured.postData);
  if (!chatContext) return null;

  try {
    const jar = await context.cookies();
    captured.cookies = jar
      .map((c: any) => `${c.name}=${c.value}`)
      .join('; ');
  } catch (e) {
    captured.cookies = cookiesForFallback;
  }

  return { captured, chatContext };
}

/**
 * Ambil chatContext asli dari UI Gemini dengan memancing ONE request StreamGenerate,
 * lalu memblokir request tersebut di level jaringan supaya Google tidak memprosesnya
 * (tidak ada video/teks yang di-generate).
 *
 * Urutan sumber:
 *  1. Profil Playwright persisten milik akun (sudah terbukti bisa memuat UI Gemini).
 *  2. Injeksi cookie akun (fallback kalau profil tidak tersedia / terkunci).
 */
async function runBrowserHarvest(
  cookies: string,
  email: string | undefined
): Promise<{ captured: Captured; chatContext: unknown[]; source: 'playwright-profile' | 'playwright-injected' } | null> {
  const { chromium } = await import('playwright');
  const executablePath = resolveLocalPlaywrightExecutable();
  // Headless injecting ke UI Gemini sering berakhir di halaman login/denied.
  const headless = process.env.GEMINI_CONTEXT_HEADLESS === '1';

  // 1. Profil Playwright persisten milik akun (sudah login, cookie-nya live).
  const profileDir = email ? getProfileDirForEmail(email) : null;
  if (profileDir) {
    let context: any = null;
    try {
      context = await chromium.launchPersistentContext(profileDir, {
        headless,
        ...(executablePath ? { executablePath } : {}),
        ignoreDefaultArgs: ['--enable-automation'],
        args: ['--disable-blink-features=AutomationControlled', '--no-first-run'],
      });
      const result = await harvestWithContext(context, cookies);
      if (result) return { ...result, source: 'playwright-profile' };
    } catch (e) {
      console.warn('[Gemini Client Context] Harvest via profil gagal:', e?.message || e);
    } finally {
      if (context) await context.close().catch(() => {});
    }
  }

  // 2. Injeksi cookie akun.
  {
    const browser = await chromium.launch({
      headless,
      ...(executablePath ? { executablePath } : {}),
      args: ['--disable-blink-features=AutomationControlled', '--no-first-run'],
    });
    try {
      const context = await browser.newContext({ locale: 'en-US' });
      const parsedCookies = parseCookieString(cookies);
      if (parsedCookies.length > 0) {
        await context.addCookies(
          parsedCookies.map((c) => ({
            name: c.name,
            value: c.value,
            domain: '.google.com',
            path: '/',
            secure: true,
          })),
        );
      }
      const result = await harvestWithContext(context, cookies);
      if (result) return { ...result, source: 'playwright-injected' };
    } catch (e) {
      console.warn('[Gemini Client Context] Harvest via injeksi cookie gagal:', e?.message || e);
    } finally {
      await browser.close().catch(() => {});
    }
  }

  return null;
}

export interface HarvestOptions {
  accountKey: string;
  email?: string;
  cookies: string;
  force?: boolean;
}

/**
 * Ambil client context dari UI. Tidak mengirim prompt sungguhan: request yang dipancing
 * diblokir sebelum sampai ke server, sehingga tidak ada video/text yang di-generate.
 */
export async function harvestGeminiClientContext(
  opts: HarvestOptions
): Promise<GeminiClientContext | null> {
  const { accountKey, email, cookies, force } = opts;
  if (!cookies) return null;

  if (!force) {
    const existing = inFlightHarvest.get(accountKey);
    if (existing) return existing;
  }

  const task = (async (): Promise<GeminiClientContext | null> => {
    const result = await runBrowserHarvest(cookies, email).catch((e) => {
      console.warn('[Gemini Client Context] Harvest browser gagal:', e?.message || e);
      return null;
    });

    if (!result) {
      console.warn('[Gemini Client Context] Tidak berhasil menangkap chatContext dari UI.');
      return null;
    }

    const { captured, chatContext, source } = result;
    const url = new URL(captured.url);
    const bodyParams = new URLSearchParams(captured.postData);
    const atToken = bodyParams.get('at') || '';
    const buildId = url.searchParams.get('bl') || '';
    const fSid = url.searchParams.get('f.sid') || '';

    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(captured.headers || {})) {
      const key = k.toLowerCase();
      if (key === 'cookie' || key === 'host' || key === 'content-length') continue;
      headers[key] = v;
    }

    if (!atToken || !buildId) {
      console.warn('[Gemini Client Context] Token `at` atau build id tidak tertangkap.');
      return null;
    }

    // Cookie harus milik sesi yang sama dengan token `at`; pakai cookie browser kalau ada.
    const resolvedCookies =
      captured.cookies && captured.cookies.includes('__Secure-1PSID')
        ? captured.cookies
        : cookies;

    const ctx: GeminiClientContext = {
      version: 1,
      accountKey,
      capturedAt: Date.now(),
      buildId,
      fSid,
      atToken,
      chatContext,
      headers,
      cookies: resolvedCookies,
      source,
    };

    writeGeminiClientContext(ctx);
    console.log(`[Gemini Client Context] ${summarizeGeminiClientContext(ctx)}`);
    return ctx;
  })();

  inFlightHarvest.set(accountKey, task);
  try {
    return await task;
  } finally {
    if (inFlightHarvest.get(accountKey) === task) inFlightHarvest.delete(accountKey);
  }
}

/**
 * Ambil client context dari cache, atau harvest baru kalau belum ada / kedaluwarsa.
 */
export async function getOrHarvestGeminiClientContext(
  opts: HarvestOptions
): Promise<GeminiClientContext | null> {
  if (!opts.force) {
    const cached = readGeminiClientContext(opts.accountKey);
    if (cached) {
      console.log(`[Gemini Client Context] Pakai cache — ${summarizeGeminiClientContext(cached)}`);
      return cached;
    }
  } else {
    clearGeminiClientContext(opts.accountKey);
  }

  return harvestGeminiClientContext(opts);
}
