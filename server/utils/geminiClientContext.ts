import fs from 'fs';
import path from 'path';

/**
 * Client Context = kumpulan nilai yang hanya bisa dihasilkan oleh UI Gemini Web sungguhan
 * (blok konteks sesi, id sesi, UUID klien, token CSRF, header browser).
 *
 * Backend Google memakai nilai-nilai ini untuk menentukan tool yang aktif pada satu giliran
 * percakapan. Kalau konteksnya dipotong atau dipalsukan (nilai statis), backend tidak
 * mengaktifkan tool Veo dan membalas error generik tanpa marker `video_generation`.
 *
 * Isi file ini sensitif (memuat cookie sesi + token CSRF) -> wajib di-gitignore.
 */

export interface GeminiClientContext {
  version: 1;
  accountKey: string;
  capturedAt: number;
  /** Build label UI (parameter `bl`). */
  buildId: string;
  /** Session id UI (parameter `f.sid`). */
  fSid: string;
  /** Token CSRF `at` yang dipakai pada body request. */
  atToken: string;
  /** Template chatContext dari UI (>= 90 elemen). Elemen 0 diganti prompt saat dipakai. */
  chatContext: unknown[];
  /** Header asli dari request UI (tanpa cookie/host/content-length). */
  headers: Record<string, string>;
  /** Cookie yang dipakai saat capture (harus dipasangkan dengan `atToken`). */
  cookies: string;
  source: 'playwright-profile' | 'playwright-injected';
}

const CLIENT_CONTEXT_DIR = path.join(process.cwd(), 'data', 'gemini_client_context');

/** Umur maksimum client context sebelum harus di-capture ulang. */
export const GEMINI_CLIENT_CONTEXT_TTL_MS = 8 * 60 * 1000;

/**
 * Panjang minimum chatContext yang dianggap valid. Build UI yang sedang dipakai mengirim
 * 90-99 elemen; payload lama server hanya 19 elemen dan tidak pernah mengaktifkan tool video.
 */
export const GEMINI_CLIENT_CONTEXT_MIN_CHAT_CONTEXT_LENGTH = 90;

function ensureDir(): void {
  try {
    fs.mkdirSync(CLIENT_CONTEXT_DIR, { recursive: true });
  } catch (e) {}
}

function contextFileName(accountKey: string): string {
  const safe = String(accountKey || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safe}.json`;
}

export function getGeminiClientContextPath(accountKey: string): string {
  return path.join(CLIENT_CONTEXT_DIR, contextFileName(accountKey));
}

export function isGeminiClientContextUsable(ctx: GeminiClientContext | null | undefined): ctx is GeminiClientContext {
  if (!ctx) return false;
  if (ctx.version !== 1) return false;
  if (!Array.isArray(ctx.chatContext) || ctx.chatContext.length < GEMINI_CLIENT_CONTEXT_MIN_CHAT_CONTEXT_LENGTH) {
    return false;
  }
  if (!ctx.atToken || !ctx.buildId) return false;
  if (Date.now() - ctx.capturedAt > GEMINI_CLIENT_CONTEXT_TTL_MS) return false;
  return true;
}

export function readGeminiClientContext(accountKey: string): GeminiClientContext | null {
  try {
    const filePath = getGeminiClientContextPath(accountKey);
    if (!fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as GeminiClientContext;
    if (!isGeminiClientContextUsable(parsed)) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

export function writeGeminiClientContext(ctx: GeminiClientContext): GeminiClientContext {
  ensureDir();
  const filePath = getGeminiClientContextPath(ctx.accountKey);
  fs.writeFileSync(filePath, JSON.stringify(ctx, null, 2), 'utf8');
  try {
    fs.chmodSync(filePath, 0o600);
  } catch (e) {}
  return ctx;
}

export function clearGeminiClientContext(accountKey: string): void {
  try {
    const filePath = getGeminiClientContextPath(accountKey);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {}
}

/**
 * Ringkasan aman untuk log: hanya bentuk, tanpa token/cookie.
 */
export function summarizeGeminiClientContext(ctx: GeminiClientContext | null | undefined): string {
  if (!ctx) return 'client context: tidak ada';
  const headers = Object.keys(ctx.headers || {});
  return (
    `client context: chatContext=${ctx.chatContext?.length ?? 0} el, ` +
    `headers=${headers.length}, build=${ctx.buildId}, source=${ctx.source}, ` +
    `umur=${Math.round((Date.now() - ctx.capturedAt) / 1000)}s`
  );
}
