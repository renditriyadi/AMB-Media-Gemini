/**
 * =========================================================================================
 * GOOGLE GEMINI PROVIDER ROUTER — PURE cURL BASH / WEB SESSION RPC ENGINE
 * =========================================================================================
 * ⚠️ PERINGATAN KERAS & PETUNJUK ARSITEKTUR UNTUK AI DI SESI CHAT MENDATANG / DEVELOPER:
 * 
 * 1. PROJEK INI TIDAK MENGGUNAKAN GOOGLE API KEY (AIzaSy...) UNTUK GENERASI GEMINI.
 *    Generasi AI Google Gemini (Omni Flash, Google Veo Video, Imagen 3) MURNI dieksekusi 
 *    menggunakan SESI AKUN GOOGLE WEB PENGGUNA yang dimasukkan via cURL bash / session cookies:
 *    - Cookie: `__Secure-1PSID`, `__Secure-1PSIDTS`, `SID`, `SAPISID`, `COMPASS`, `NID`, dll.
 *    - Token XSRF & sesi: `at` parameter (`SNlM0e`), `f.sid`, `bl` build label.
 *
 * 2. MENGAPA TIDAK PAKAI API KEY?
 *    - API Key AI Studio / Developer memiliki kuota harian berbayar & rate-limit ketat (429 RESOURCE_EXHAUSTED).
 *    - Dengan menggunakan cURL bash akun Gemini Web milik user, user dapat memanfaatkan kuota web
 *      langsung dari browser/akun Google mereka secara gratis dan fleksibel.
 *
 * 3. ALUR EKSEKUSI WAJIB (DO NOT BREAK):
 *    - Endpoint `/api/gemini/generate-video` dan `/api/gemini/generate-image` HARUS memprioritaskan
 *      dan mengeksekusi `GeminiWebClient` dari `script-gemini/gemini_chat.cjs`.
 *    - Protokol yang digunakan adalah Google Web RPC:
 *        a. `StreamGenerate` (assistant.lamda.BardFrontendService/StreamGenerate) untuk prompt & stream
 *        b. `batchexecute?rpcids=ESY5D` untuk polling task video generasi Google Veo
 *        c. `Scotty Upload` (upload.html) untuk upload gambar referensi Image-to-Video
 *    - JANGAN PERNAH mengalihkan input cURL user ke API Key developer atau mengubah arsitektur ini
 *      menjadi SDK-only, karena akan merusak integrasi akun user dan memicu error kuota 429.
 * =========================================================================================
 */

import { Router } from 'express';
import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import multer from 'multer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { GoogleGenAI } from '@google/genai';
import { geminiPlaywrightManager } from '../services/geminiPlaywright';
import {
  GEMINI_USAGE_FILE,
  GEMINI_VIDEO_CREDIT_LIMIT,
  addGeminiGenerateFailureTaskId,
  clearGeminiGenerateFailureHistory,
  getGeminiAccountUsageKeys,
  getGeminiCreditSnapshot,
  getGeminiLocalTaskUsage,
  getGeminiGenerateFailureTaskIds,
  prioritizeGeminiAccountsByFailureHistory,
  normalizeGeminiUsed,
  type GeminiCreditUsageRecord,
} from '../utils/geminiCreditLedger';
import {
  consumeCliGeminiTestPermit,
  isCliGeminiTestTask,
  recordCliGeminiTestTask,
} from '../utils/cliGeminiTestMode';

const router = Router();

const mediaCacheDir = path.join(process.cwd(), 'media-cache');
if (!fs.existsSync(mediaCacheDir)) {
  fs.mkdirSync(mediaCacheDir, { recursive: true });
}

// Multer storage for media caching up to 100MB
const uploadDisk = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const tmpDir = os.tmpdir();
      cb(null, tmpDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname) || '';
      cb(null, `gemini-disk-${uniqueSuffix}${ext}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

// In-memory task tracker for background Gemini Web Veo video rendering
const webVideoTaskTracker = new Map<
  string,
  {
    startTime: number;
    convId: string;
    accountKey: string;
    cookies?: string;
    email?: string;
    accountName?: string;
    initialText?: string;
    creditBypassMode?: boolean;
  }
>();
const MAX_GEMINI_VIDEO_TASK_AGE_MS = 8 * 60 * 1000;
const geminiVideoCreditReservations = new Map<string, number>();
const GEMINI_VIDEO_LOCK_DIR = path.join(process.cwd(), 'data', 'gemini_video_locks');

interface GeminiVideoAccountLockRecord {
  lockId: string;
  accountKey: string;
  email?: string;
  operationName?: string;
  creditBypassMode?: boolean;
  state: 'starting' | 'processing';
  createdAt: number;
  updatedAt: number;
}

interface GeminiVideoAccountLock {
  accountKey: string;
  lockId: string;
  refresh: () => void;
  release: () => void;
}

function getGeminiVideoLockPath(accKey: string): string {
  const fileKey = crypto.createHash('sha256').update(accKey).digest('hex');
  return path.join(GEMINI_VIDEO_LOCK_DIR, `${fileKey}.json`);
}

function readGeminiVideoAccountLock(lockPath: string): GeminiVideoAccountLockRecord | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (
      typeof parsed?.lockId === 'string' &&
      typeof parsed?.accountKey === 'string' &&
      typeof parsed?.createdAt === 'number' &&
      typeof parsed?.updatedAt === 'number'
    ) {
      return parsed as GeminiVideoAccountLockRecord;
    }
    return null;
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    console.warn('[Gemini Video Account Lock] Could not read lock record:', error);
    return null;
  }
}

function writeGeminiVideoAccountLock(lockPath: string, record: GeminiVideoAccountLockRecord): void {
  const tempPath = `${lockPath}.${record.lockId}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(record), { encoding: 'utf8', flag: 'w' });
  fs.renameSync(tempPath, lockPath);
}

function tryAcquireGeminiVideoAccountLock(
  accKey: string,
  email?: string
): GeminiVideoAccountLock | null {
  fs.mkdirSync(GEMINI_VIDEO_LOCK_DIR, { recursive: true });
  const lockPath = getGeminiVideoLockPath(accKey);
  const lockId = crypto.randomUUID();
  const now = Date.now();
  const record: GeminiVideoAccountLockRecord = {
    lockId,
    accountKey: accKey,
    email,
    state: 'starting',
    createdAt: now,
    updatedAt: now,
  };

  try {
    const descriptor = fs.openSync(lockPath, 'wx');
    try {
      fs.writeFileSync(descriptor, JSON.stringify(record), 'utf8');
    } finally {
      fs.closeSync(descriptor);
    }
  } catch (error: any) {
    if (error?.code !== 'EEXIST') throw error;

    return null;
  }

  let released = false;
  return {
    accountKey: accKey,
    lockId,
    refresh: () => {
      if (released) return;
      const current = readGeminiVideoAccountLock(lockPath);
      if (current?.lockId !== lockId) return;
      try {
        writeGeminiVideoAccountLock(lockPath, { ...current, updatedAt: Date.now() });
      } catch (error) {
        console.warn('[Gemini Video Account Lock] Could not refresh submission lock:', error);
      }
    },
    release: () => {
      if (released) return;
      released = true;
      const current = readGeminiVideoAccountLock(lockPath);
      if (current?.lockId !== lockId) return;
      try {
        fs.unlinkSync(lockPath);
      } catch (error: any) {
        if (error?.code !== 'ENOENT') {
          released = false;
          console.error('[Gemini Video Account Lock] Could not release lock:', error);
        }
      }
    },
  };
}

function updateGeminiVideoAccountLock(
  lock: GeminiVideoAccountLock,
  updates: Partial<Pick<GeminiVideoAccountLockRecord, 'operationName' | 'creditBypassMode' | 'state' | 'updatedAt'>>
): void {
  const lockPath = getGeminiVideoLockPath(lock.accountKey);
  const current = readGeminiVideoAccountLock(lockPath);
  if (current?.lockId !== lock.lockId) {
    throw new Error('Gemini video account lock ownership was lost.');
  }
  writeGeminiVideoAccountLock(lockPath, { ...current, ...updates, updatedAt: Date.now() });
}

function findGeminiVideoAccountLockByOperation(
  operationName: string
): GeminiVideoAccountLockRecord | null {
  try {
    if (!fs.existsSync(GEMINI_VIDEO_LOCK_DIR)) return null;
    for (const filename of fs.readdirSync(GEMINI_VIDEO_LOCK_DIR)) {
      if (!filename.endsWith('.json')) continue;
      const record = readGeminiVideoAccountLock(path.join(GEMINI_VIDEO_LOCK_DIR, filename));
      if (record?.operationName === operationName) return record;
    }
  } catch (error) {
    console.warn('[Gemini Video Account Lock] Could not restore task lock:', error);
  }
  return null;
}

function releaseGeminiVideoAccountLockByOperation(operationName: string): void {
  const record = findGeminiVideoAccountLockByOperation(operationName);
  if (!record) return;
  const lockPath = getGeminiVideoLockPath(record.accountKey);
  const current = readGeminiVideoAccountLock(lockPath);
  if (current?.lockId !== record.lockId) return;
  try {
    fs.unlinkSync(lockPath);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.error('[Gemini Video Account Lock] Could not release completed task lock:', error);
    }
  }
}

function completeGeminiVideoTask(operationName: string): void {
  webVideoTaskTracker.delete(operationName);
  releaseGeminiVideoAccountLockByOperation(operationName);
}

function touchGeminiVideoAccountLock(operationName: string): void {
  const record = findGeminiVideoAccountLockByOperation(operationName);
  if (!record) return;
  try {
    writeGeminiVideoAccountLock(getGeminiVideoLockPath(record.accountKey), {
      ...record,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.warn('[Gemini Video Account Lock] Could not refresh active task lock:', error);
  }
}

// Total kredit per akun Google Gemini (1 generasi = 1 kredit, kuota tidak reset)
const GEMINI_MAX_CREDITS = GEMINI_VIDEO_CREDIT_LIMIT;

function reserveGeminiVideoCredit(accKey: string): boolean {
  const usage = getAccountDailyUsage(accKey);
  const reserved = geminiVideoCreditReservations.get(accKey) || 0;
  if (!usage.found || usage.remaining <= reserved) return false;
  geminiVideoCreditReservations.set(accKey, reserved + 1);
  return true;
}

function releaseGeminiVideoCreditReservation(accKey: string): void {
  const reserved = geminiVideoCreditReservations.get(accKey) || 0;
  if (reserved <= 1) {
    geminiVideoCreditReservations.delete(accKey);
  } else {
    geminiVideoCreditReservations.set(accKey, reserved - 1);
  }
}

// Helper to detect progress notice text from Google Gemini Veo
function isProgressNoticeText(txt: string | null | undefined): boolean {
  if (!txt || typeof txt !== 'string') return false;
  const l = txt.toLowerCase();
  return (
    l.includes('sedang membuat video') ||
    l.includes('sedang membuatkan video') ||
    l.includes('proses ini dapat memerlukan waktu') ||
    l.includes('periksa kembali untuk melihat apakah video anda sudah siap') ||
    l.includes('apakah video anda sudah siap') ||
    l.includes('generating your video') ||
    l.includes('creating your video') ||
    l.includes('working on your video') ||
    l.includes('this can take a few minutes') ||
    l.includes('this could take a few minutes') ||
    l.includes('check back to see if your video is ready') ||
    l.includes('video sedang diproses') ||
    l.includes('video anda sedang dibuat') ||
    l.includes('video sedang dibuat') ||
    l.includes('sedang merender video') ||
    l.includes('rendering video')
  );
}

// Helper to detect metadata token / model identifier from Google response
function isModelOrMetaTokenText(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') return true;
  const l = str.trim().toLowerCase();
  return (
    l === '3.6 flash' ||
    l === '3.5 flash' ||
    l === '2.5 flash' ||
    l === '2.0 flash' ||
    l === '1.5 flash' ||
    l === 'flash' ||
    l === 'pro' ||
    l === 'gemini' ||
    l === 'generic' ||
    l === 'model' ||
    l === 'assistant' ||
    l === 'video_generation' ||
    l === 'image_generation' ||
    l === 'generasi video' ||
    l === 'search_grounding' ||
    l.startsWith('boq_') ||
    /^\d+(\.\d+)?\s*(flash|pro|lite|ultra)/i.test(l) ||
    /^(gemini\s*omni[\w\s.-]*)$/i.test(l) ||
    /^(google\s*gemini|gemini-[\w.-]+)$/i.test(l) ||
    str.startsWith('$') ||
    str.startsWith('rc_') ||
    str.startsWith('c_') ||
    str.startsWith('r_') ||
    l.includes('protobuf') ||
    l.startsWith('application/') ||
    l.startsWith('image/') ||
    l.startsWith('video/') ||
    l.startsWith('text/') ||
    (str.length > 35 && !str.includes(' '))
  );
}

// Helper to resolve any reference image or video URL (data-uri, local cache path, or remote URL) to buffer & base64
async function resolveMediaBytes(urlOrBase64: string): Promise<{ mimeType: string; base64: string; buffer?: Buffer } | null> {
  if (!urlOrBase64 || typeof urlOrBase64 !== 'string') return null;

  if (urlOrBase64.startsWith('data:')) {
    const match = urlOrBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const buf = Buffer.from(match[2], 'base64');
      return { mimeType: match[1], base64: match[2], buffer: buf };
    }
  }

  // Raw base64 string
  if (urlOrBase64.length > 200 && !urlOrBase64.includes('/') && !urlOrBase64.includes(':') && /^[A-Za-z0-9+/=]+$/.test(urlOrBase64)) {
    const buf = Buffer.from(urlOrBase64, 'base64');
    return { mimeType: 'image/jpeg', base64: urlOrBase64, buffer: buf };
  }

  // Check local filesystem cache
  let localPath = '';
  if (urlOrBase64.startsWith('/media-cache/')) {
    localPath = path.join(process.cwd(), urlOrBase64.slice(1));
  } else if (urlOrBase64.startsWith('media-cache/')) {
    localPath = path.join(process.cwd(), urlOrBase64);
  } else if (urlOrBase64.startsWith('/tmp/') || urlOrBase64.startsWith('tmp/')) {
    localPath = urlOrBase64.startsWith('/') ? urlOrBase64 : path.join(process.cwd(), urlOrBase64);
  }

  if (localPath && fs.existsSync(localPath)) {
    try {
      const buffer = fs.readFileSync(localPath);
      const ext = path.extname(localPath).toLowerCase().replace('.', '');
      let mime = 'image/jpeg';
      if (ext === 'png') mime = 'image/png';
      else if (ext === 'webp') mime = 'image/webp';
      else if (ext === 'gif') mime = 'image/gif';
      else if (ext === 'mp4') mime = 'video/mp4';
      else if (ext === 'mov') mime = 'video/quicktime';
      else if (ext === 'webm') mime = 'video/webm';
      return { mimeType: mime, base64: buffer.toString('base64'), buffer };
    } catch (e) {}
  }

  // If http/https URL
  if (urlOrBase64.startsWith('http://') || urlOrBase64.startsWith('https://')) {
    try {
      const axios = require('axios');
      const resp = await axios.get(urlOrBase64, { responseType: 'arraybuffer', timeout: 45000 });
      if (resp.data) {
        const isVid = urlOrBase64.match(/\.(mp4|mov|webm|mkv|avi)$/i);
        const mime = resp.headers['content-type'] || (isVid ? 'video/mp4' : 'image/jpeg');
        const buf = Buffer.from(resp.data);
        return { mimeType: mime, base64: buf.toString('base64'), buffer: buf };
      }
    } catch (e) {
      console.warn('[Gemini resolveMediaBytes fetch error]:', e);
    }
  }

  return null;
}

// Helper to extract cookies and/or API keys from curl or raw text
export function extractCookiesOrApiKey(input: string): { cookies?: string; apiKey?: string } {
  const trimmed = input.trim();

  // 1. Check if it's an API Key (starts with AIzaSy... or has x-goog-api-key header)
  const apiKeyMatch = trimmed.match(/(?:x-goog-api-key:\s*|['"\s]|^)(AIza[0-9A-Za-z-_]{35})/);
  if (apiKeyMatch && !trimmed.includes('__Secure') && !trimmed.includes('SID=') && !trimmed.includes('-b ') && !trimmed.includes('--cookie ')) {
    return { apiKey: apiKeyMatch[1] };
  }

  // 2. Extract cookie string from cURL (-b, --cookie, -H 'cookie:...')
  let rawCookie = '';

  // Match -b '...' or -b "..." or --cookie '...' or --cookie "..." (support multiline)
  const bMatch = trimmed.match(/(?:-b|--cookie)\s+(?:'([^']+)'|"([^"]+)"|([^\s\r\n\\]+))/i);
  if (bMatch) {
    rawCookie = bMatch[1] || bMatch[2] || bMatch[3] || '';
  }

  // Match -H 'cookie: ...' or -H "Cookie: ..."
  if (!rawCookie) {
    const hMatch = trimmed.match(/-H\s+['"][Cc]ookie:\s*([^'"]+)['"]/i);
    if (hMatch) {
      rawCookie = hMatch[1];
    }
  }

  // If no flag match, but contains cookie keywords
  if (!rawCookie && (trimmed.includes('__Secure') || trimmed.includes('SID=') || trimmed.includes('SAPISID='))) {
    rawCookie = trimmed;
  }

  if (rawCookie) {
    // Filter down to Google authentication cookies while preserving all required tokens
    const cookiePairs: string[] = [];
    const splitCookies = rawCookie.split(';');
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

    const seen = new Set<string>();
    for (const part of splitCookies) {
      const trimmedPart = part.trim();
      const eqIdx = trimmedPart.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmedPart.slice(0, eqIdx).trim();
        const val = trimmedPart.slice(eqIdx + 1).trim();
        if (val && !seen.has(key)) {
          // If key is essential authentication cookie
          if (
            essentialKeys.includes(key) ||
            key.startsWith('__Secure-') ||
            key.startsWith('COMPASS') ||
            key.startsWith('SEARCH_') ||
            key.startsWith('AEC') ||
            key.startsWith('SOCS') ||
            key.includes('SID') ||
            key.includes('APISID')
          ) {
            seen.add(key);
            cookiePairs.push(`${key}=${val}`);
          }
        }
      }
    }

    if (cookiePairs.length > 0) {
      return { cookies: cookiePairs.join('; ') };
    }
    return { cookies: rawCookie.trim() };
  }

  if (apiKeyMatch) {
    return { apiKey: apiKeyMatch[1] };
  }

  return { cookies: trimmed };
}

// Helper to sanitize Google email / usernames and remove escape artifacts (like hex \x22 quote residue)
function cleanGoogleEmail(rawEmail?: string): string {
  if (!rawEmail || typeof rawEmail !== 'string') return '';
  let cleaned = rawEmail
    .replace(/^(\\x22|x22|\\\"|\"|'|%22)/i, '')
    .replace(/(\\x22|x22|\\\"|\"|'|%22)$/i, '')
    .replace(/^x22([a-zA-Z0-9])/i, '$1')
    .trim();
  return cleaned;
}

function cleanGoogleDisplayName(rawName?: string, email?: string): string {
  if (rawName && typeof rawName === 'string') {
    let cleaned = rawName
      .replace(/^(\\x22|x22|\\\"|\"|'|%22)/i, '')
      .replace(/(\\x22|x22|\\\"|\"|'|%22)$/i, '')
      .replace(/^x22([a-zA-Z0-9])/i, '$1')
      .trim();
    if (cleaned) return cleaned;
  }
  if (email && email.includes('@')) {
    return cleanGoogleEmail(email.split('@')[0]);
  }
  return 'Google Gemini User';
}

// Helper to fetch user's real Google profile info (email, name, photo) using Google's account endpoint
async function fetchGoogleUserProfile(cookies: string, expectedEmail = ''): Promise<{ email?: string; name?: string; photoUrl?: string }> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'accounts.google.com',
        path: '/ListAccounts?source=ogb&json=standard',
        method: 'GET',
        maxHeaderSize: 1048576,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
          Cookie: cookies,
          Origin: 'https://accounts.google.com',
          Accept: '*/*',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          if (data.length < 500000) data += chunk;
        });
        res.on('end', () => {
          try {
            const startMarker = "window.parent.postMessage('";
            const endMarker = "', 'https://accounts.google.com')";
            const startIdx = data.indexOf(startMarker);
            if (startIdx !== -1) {
              const sub = data.slice(startIdx + startMarker.length);
              const endIdx = sub.indexOf(endMarker);
              if (endIdx !== -1) {
                let encoded = sub.slice(0, endIdx);
                encoded = encoded.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) =>
                  String.fromCharCode(parseInt(hex, 16))
                );
                encoded = encoded.replace(/\\\//g, '/');
                const parsed = JSON.parse(encoded);
                if (Array.isArray(parsed) && Array.isArray(parsed[1]) && parsed[1].length > 0) {
                  const accountsList = parsed[1];
                  const normExpected = cleanGoogleEmail(expectedEmail).toLowerCase().trim();

                  let targetItem = accountsList[0];
                  if (normExpected) {
                    const match = accountsList.find(
                      (item: any) =>
                        Array.isArray(item) &&
                        typeof item[3] === 'string' &&
                        cleanGoogleEmail(item[3]).toLowerCase().trim() === normExpected
                    );
                    if (match) targetItem = match;
                  }

                  // ["gaia.l.a", 1, "DisplayName", "email@...", "photoUrl", ...]
                  const displayName = typeof targetItem[2] === 'string' ? cleanGoogleDisplayName(targetItem[2]) : '';
                  const email = typeof targetItem[3] === 'string' ? cleanGoogleEmail(targetItem[3]) : '';
                  const photoUrl = typeof targetItem[4] === 'string' ? targetItem[4].trim() : '';
                  if (email && email.includes('@')) {
                    return resolve({ email, name: displayName, photoUrl });
                  }
                }
              }
            }

            const emailMatch = data.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            if (emailMatch && !emailMatch[1].includes('example.com') && !emailMatch[1].includes('googlers@google.com')) {
              return resolve({ email: cleanGoogleEmail(emailMatch[1]) });
            }
          } catch (e) {
            console.warn('[fetchGoogleUserProfile warn]:', e);
          }
          resolve({});
        });
      }
    );

    req.on('error', (err) => {
      console.warn('[fetchGoogleUserProfile net err]:', err.message);
      resolve({});
    });
    req.setTimeout(8000, () => {
      req.destroy();
      resolve({});
    });
    req.end();
  });
}

// Helper to check Gemini Web Session and extract true Google user identity
async function verifyGeminiWebSession(cookies: string, expectedEmail = ''): Promise<{
  success: boolean;
  email: string;
  name: string;
  photoUrl?: string;
  tier: string;
  isAdvanced: boolean;
  snlm0e?: string;
}> {
  const hasGoogleAuth = cookies.includes('__Secure-1PSID') || cookies.includes('SID=') || cookies.includes('SAPISID=');
  if (!hasGoogleAuth) {
    return {
      success: false,
      email: '',
      name: '',
      tier: 'Invalid Session',
      isAdvanced: false,
    };
  }

  // Fetch real Google user profile and Gemini app page in parallel
  const [profile, webRes] = await Promise.all([
    fetchGoogleUserProfile(cookies, expectedEmail),
    new Promise<{
      statusCode?: number;
      location?: string;
      data: string;
      error?: string;
    }>((resolve) => {
      const req = https.request(
        {
          hostname: 'gemini.google.com',
          path: '/app',
          method: 'GET',
          maxHeaderSize: 1048576, // 1MB header size limit to prevent HPE_HEADER_OVERFLOW
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
            Cookie: cookies,
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            if (data.length < 5000000) {
              data += chunk;
            }
          });

          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              location: res.headers.location || '',
              data,
            });
          });
        }
      );

      req.on('error', (err) => resolve({ data: '', error: err.message }));
      req.setTimeout(8000, () => {
        req.destroy();
        resolve({ data: '', error: 'timeout' });
      });
      req.end();
    }),
  ]);

  if (webRes.statusCode && webRes.statusCode >= 300 && webRes.statusCode < 400 && webRes.location?.toLowerCase().includes('servicelogin')) {
    return {
      success: false,
      email: profile.email || '',
      name: profile.name || '',
      tier: 'Expired Session',
      isAdvanced: false,
    };
  }

  const data = webRes.data || '';

  // Check for login redirects or sign-in prompts in page body
  if (data.includes('accounts.google.com/ServiceLogin') && !data.includes('"SNlM0e"')) {
    return {
      success: false,
      email: profile.email || '',
      name: profile.name || '',
      tier: 'Expired Session',
      isAdvanced: false,
    };
  }

  let snlm0e = '';
  const wizMatch = data.match(/window\.WIZ_global_data\s*=\s*(\{[\s\S]*?\});/);
  if (wizMatch) {
    try {
      const wizData = JSON.parse(wizMatch[1]);
      if (wizData.SNlM0e) {
        snlm0e = wizData.SNlM0e;
      }
    } catch (e) {}
  }

  if (!snlm0e) {
    const snlm0eMatch = data.match(/"SNlM0e":"([^"]+)"/);
    if (snlm0eMatch) snlm0e = snlm0eMatch[1];
  }

  // CRITICAL: In Google Gemini, SNlM0e is the authenticated user session token.
  // uS02ke is ONLY an anonymous visitor token for guest browsing.
  // If SNlM0e is absent, the user is NOT logged in or session has expired!
  if (!snlm0e) {
    return {
      success: false,
      email: profile.email || '',
      name: profile.name || '',
      tier: 'Expired Session',
      isAdvanced: false,
    };
  }

  const isAdvanced =
    data.includes('Gemini Advanced') ||
    data.includes('is_advanced:true') ||
    data.includes('"isAdvanced":true') ||
    data.includes('1M_context');

  // Real Email & Name resolution from Google ListAccounts profile or direct oPEP7c key
  let email = cleanGoogleEmail(profile.email);
  if (!email) {
    const oPEP7cMatch = data.match(/"oPEP7c"\s*:\s*"([^"]+)"/);
    if (oPEP7cMatch && oPEP7cMatch[1]) {
      email = cleanGoogleEmail(oPEP7cMatch[1]);
    }
  }
  if (!email) {
    const emailMatch =
      data.match(/"([^"]+@gmail\.com|[^"]+@google\.com|[^"]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})"/);
    if (emailMatch && !emailMatch[1].includes('example.com') && !emailMatch[1].includes('googlers@google.com')) {
      email = cleanGoogleEmail(emailMatch[1]);
    }
  }

  const normalizedExpectedEmail = cleanGoogleEmail(expectedEmail);

  // If email was resolved and expectedEmail was provided, verify they match!
  if (email && normalizedExpectedEmail && email.toLowerCase() !== normalizedExpectedEmail.toLowerCase()) {
    return {
      success: false,
      email,
      name: profile.name || '',
      tier: 'Account Mismatch',
      isAdvanced: false,
    };
  }

  // A genuine logged-in Google Gemini session MUST have an authenticated Google user email from Google!
  // We NEVER fabricate or fallback to unverified local input if Google did not return a valid logged-in session.
  if (!email || !email.includes('@')) {
    console.warn('[verifyGeminiWebSession] Could not resolve verified Google account email from Gemini response. Session expired or unauthenticated.');
    return {
      success: false,
      email: '',
      name: '',
      tier: 'Expired Session',
      isAdvanced: false,
    };
  }

  // Live RPC Connectivity probe: test that Google actually allows batchexecute RPCs with these cookies
  try {
    const { GeminiWebClient } = require('../../script-gemini/gemini_chat.cjs');
    const client = new GeminiWebClient(cookies);
    await client.initSession();
    // Test listing 1 conversation to ensure RPC authentication works
    await client.listConversations(1);
  } catch (rpcErr: any) {
    const errText = String(rpcErr?.message || '').toLowerCase();
    if (
      errText.includes('401') ||
      errText.includes('403') ||
      errText.includes('csrf') ||
      errText.includes('kadaluwarsa') ||
      errText.includes('cookie') ||
      errText.includes('session')
    ) {
      console.warn(`[verifyGeminiWebSession] Real RPC probe failed for ${email}:`, rpcErr.message);
      return {
        success: false,
        email,
        name: profile.name || '',
        tier: 'Expired Session',
        isAdvanced: false,
      };
    }
  }

  const nameStr = cleanGoogleDisplayName(profile.name, email);
  return {
    success: true,
    email,
    name: nameStr || 'Google Gemini User',
    photoUrl: profile.photoUrl,
    tier: isAdvanced ? 'Gemini Advanced (Paid)' : 'Standard Gemini Free',
    isAdvanced,
    snlm0e,
  };
}

// Internal video credits are lifetime credits and do not reset daily.
const USAGE_FILE = GEMINI_USAGE_FILE;

interface GeminiUsageRecord extends GeminiCreditUsageRecord {
  date?: string;
  used: number;
  externalUsed?: number;
  completedTaskIds?: string[];
  chargedTaskIds?: string[];
  refundedTaskIds?: string[];
  failedGenerateTaskIds?: string[];
}

function getTodayString(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function getGeminiAccountIdentifier(cookies?: string, apiKey?: string, email?: string): string {
  if (email && typeof email === 'string' && email.includes('@')) {
    return cleanGoogleEmail(email).toLowerCase().trim();
  }
  if (apiKey && typeof apiKey === 'string' && apiKey.startsWith('AIza')) {
    return `key_${apiKey.slice(-12)}`;
  }
  if (cookies && typeof cookies === 'string') {
    const psidMatch = cookies.match(/__Secure-1PSID=([^;]+)/i) || cookies.match(/(?:^|;\s*)SID=([^;]+)/i);
    if (psidMatch && psidMatch[1]) {
      return crypto.createHash('sha256').update(psidMatch[1].trim()).digest('hex').slice(0, 16);
    }
  }
  const source = cookies || apiKey || 'default_gemini';
  return crypto.createHash('sha256').update(source).digest('hex').slice(0, 16);
}

function readAllGeminiUsage(): Record<string, GeminiUsageRecord> {
  try {
    if (fs.existsSync(USAGE_FILE)) {
      const raw = fs.readFileSync(USAGE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Ledger Gemini harus berupa object.');
      }

      let migrated = false;
      const records = parsed as Record<string, GeminiUsageRecord>;
      for (const [key, record] of Object.entries(records)) {
        if (!record || typeof record !== 'object') continue;
        record.refundedTaskIds = Array.isArray(record.refundedTaskIds)
          ? [...new Set(record.refundedTaskIds.filter((id): id is string => typeof id === 'string'))]
          : [];
        record.chargedTaskIds = Array.isArray(record.chargedTaskIds)
          ? [...new Set(record.chargedTaskIds.filter((id): id is string => typeof id === 'string'))]
          : [];
        record.completedTaskIds = Array.isArray(record.completedTaskIds)
          ? [...new Set(record.completedTaskIds.filter((id): id is string => typeof id === 'string'))]
          : [];
        record.failedGenerateTaskIds = getGeminiGenerateFailureTaskIds(record);
        const localUsed = getGeminiLocalTaskUsage(record);
        if (record.used !== localUsed || record.externalUsed !== 0) migrated = true;
        record.used = localUsed;
        record.externalUsed = 0;
        records[key] = record;
      }

      if (migrated) {
        const backupPath = `${USAGE_FILE}.pre-local-ledger.bak`;
        if (!fs.existsSync(backupPath)) fs.copyFileSync(USAGE_FILE, backupPath);
        const temporaryPath = `${USAGE_FILE}.migration-tmp`;
        fs.writeFileSync(temporaryPath, JSON.stringify(records, null, 2), 'utf-8');
        fs.renameSync(temporaryPath, USAGE_FILE);
        console.info('[Gemini Credit Ledger] Migrated Gemini credits to successful application task usage.');
      }
      return records;
    }
    return {};
  } catch (error) {
    console.error('[Gemini Credit Ledger] Could not read usage ledger; refusing to treat it as empty:', error);
    throw error;
  }
}

function saveGeminiUsage(data: Record<string, GeminiUsageRecord>) {
  try {
    const dir = path.dirname(USAGE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Gemini Credit Ledger] Could not persist usage ledger:', error);
    throw error;
  }
}

function getAccountDailyUsage(
  accKey: string,
  aliases: string[] = []
): { remaining: number; total: number; used: number; date: string; found: boolean } {
  const allUsage = readAllGeminiUsage();
  const today = getTodayString();
  const keys = [accKey, ...aliases];
  const snapshot = getGeminiCreditSnapshot(allUsage, keys);
  const record = keys.map((key) => allUsage[key]).find(Boolean);
  const used = snapshot.used;
  return {
    remaining: Math.max(0, GEMINI_MAX_CREDITS - used),
    total: GEMINI_MAX_CREDITS,
    used,
    date: record?.date || today,
    found: snapshot.found,
  };
}

function initializeGeminiAccountUsage(
  accKey: string,
  aliases: string[] = [],
): ReturnType<typeof getAccountDailyUsage> {
  const allUsage = readAllGeminiUsage();
  const keys = [...new Set([accKey, ...aliases])];
  const records = keys.map((key) => allUsage[key]).filter(Boolean);
  if (!records.length) {
    allUsage[accKey] = { date: getTodayString(), used: 0, externalUsed: 0 };
    saveGeminiUsage(allUsage);
  } else {
    const merged = {
      date: records.find((record) => record.date)?.date || getTodayString(),
      used: 0,
      externalUsed: 0,
      completedTaskIds: [...new Set(records.flatMap((record) => record.completedTaskIds || []))],
      chargedTaskIds: [...new Set(records.flatMap((record) => record.chargedTaskIds || []))],
      refundedTaskIds: [...new Set(records.flatMap((record) => record.refundedTaskIds || []))],
      failedGenerateTaskIds: [...new Set(records.flatMap((record) => getGeminiGenerateFailureTaskIds(record)))],
    };
    merged.used = getGeminiLocalTaskUsage(merged);
    for (const key of keys) allUsage[key] = merged;
    saveGeminiUsage(allUsage);
  }
  return getAccountDailyUsage(accKey, aliases);
}

function incrementAccountDailyUsage(accKey: string, taskId?: string): { success: boolean; remaining: number; total: number; used: number; error?: string } {
  const allUsage = readAllGeminiUsage();
  const today = getTodayString();
  const total = GEMINI_MAX_CREDITS;
  let record = allUsage[accKey];
  if (!record) {
    record = { date: today, used: 0, externalUsed: 0, completedTaskIds: [], chargedTaskIds: [], refundedTaskIds: [] };
  } else {
    record.completedTaskIds = Array.isArray(record.completedTaskIds) ? record.completedTaskIds : [];
    record.chargedTaskIds = Array.isArray(record.chargedTaskIds) ? record.chargedTaskIds : [];
    record.refundedTaskIds = Array.isArray(record.refundedTaskIds) ? record.refundedTaskIds : [];
  }

  record.used = normalizeGeminiUsed(
    getGeminiLocalTaskUsage(record)
  );
  record.externalUsed = 0;

  if (taskId && record.chargedTaskIds.includes(taskId)) {
    return {
      success: true,
      remaining: Math.max(0, total - record.used),
      total,
      used: record.used,
    };
  }

  if (record.used >= total) {
    return {
      success: false,
      remaining: 0,
      total,
      used: record.used,
      error: `Batas kredit tercapai (${GEMINI_MAX_CREDITS}/${GEMINI_MAX_CREDITS} kredit telah digunakan pada akun ini). Gunakan akun Gemini lain atau tambahkan akun baru.`,
    };
  }

  record.used = Math.min(total, record.used + 1);
  record.date = today;
  if (taskId) {
    if (!record.chargedTaskIds.includes(taskId)) record.chargedTaskIds.push(taskId);
  }
  allUsage[accKey] = record;
  saveGeminiUsage(allUsage);

  return {
    success: true,
    remaining: Math.max(0, total - record.used),
    total,
    used: record.used,
  };
}

function refundAccountDailyUsage(accKey: string, taskId?: string): { success: boolean; refunded: boolean; remaining: number; total: number; used: number } {
  const allUsage = readAllGeminiUsage();
  const total = GEMINI_MAX_CREDITS;
  let record = allUsage[accKey];
  if (!record || !taskId) {
    const usage = getAccountDailyUsage(accKey);
    return { success: false, refunded: false, remaining: usage.remaining, total, used: usage.used };
  }

  record.completedTaskIds = Array.isArray(record.completedTaskIds) ? record.completedTaskIds : [];
  record.chargedTaskIds = Array.isArray(record.chargedTaskIds) ? record.chargedTaskIds : [];
  record.refundedTaskIds = Array.isArray(record.refundedTaskIds) ? record.refundedTaskIds : [];
  const wasCharged = record.chargedTaskIds.includes(taskId) || record.completedTaskIds.includes(taskId);
  if (!wasCharged || record.refundedTaskIds.includes(taskId)) {
    const usage = getAccountDailyUsage(accKey);
    return { success: true, refunded: false, remaining: usage.remaining, total, used: usage.used };
  }

  record.used = normalizeGeminiUsed(record.used);
  record.externalUsed = 0;
  record.refundedTaskIds.push(taskId);
  record.used = getGeminiLocalTaskUsage(record);
  allUsage[accKey] = record;
  saveGeminiUsage(allUsage);
  console.log(`[Gemini Credit Auto-Refund 🔄] Akun ${accKey} berhasil di-refund +1 kredit (used: ${record.used}/${GEMINI_MAX_CREDITS}, remaining: ${Math.max(0, total - record.used)}/${GEMINI_MAX_CREDITS}).`);

  return {
    success: true,
    refunded: true,
    remaining: Math.max(0, total - record.used),
    total,
    used: record.used,
  };
}

function logGeminiExternalQuotaRefusal(accKey: string, reason?: string, email?: string) {
  const cleanEmail = email ? cleanGoogleEmail(email).toLowerCase().trim() : '';
  console.warn(
    `[Gemini Google Quota Notice] Account ${accKey} / ${cleanEmail || ''} was refused by Google. ` +
    `This does not change AMB Media local credits. Reason: ${reason || 'quota refusal'}.`
  );
}

function recordFailedGeminiVideoGenerate(accKey: string, taskId: string): void {
  if (!taskId) return;
  const allUsage = readAllGeminiUsage();
  const today = getTodayString();
  const record = allUsage[accKey] || {
    date: today,
    used: 0,
    externalUsed: 0,
    completedTaskIds: [],
    chargedTaskIds: [],
    refundedTaskIds: [],
    failedGenerateTaskIds: [],
  };
  Object.assign(record, addGeminiGenerateFailureTaskId(record, taskId));
  allUsage[accKey] = record;
  saveGeminiUsage(allUsage);
}

function isCompletedVideoTaskRecorded(accKey: string, taskId: string): boolean {
  const record = readAllGeminiUsage()[accKey];
  return Boolean(
    record?.completedTaskIds?.includes(taskId) &&
    !record.refundedTaskIds?.includes(taskId)
  );
}

function markCompletedVideoTask(accKey: string, taskId: string, aliases: string[] = []) {
  const allUsage = readAllGeminiUsage();
  const today = getTodayString();
  let record = allUsage[accKey];
  if (!record) record = { date: today, used: 0, externalUsed: 0, completedTaskIds: [], chargedTaskIds: [], refundedTaskIds: [] };
  if (!Array.isArray(record.completedTaskIds)) record.completedTaskIds = [];
  if (!Array.isArray(record.chargedTaskIds)) record.chargedTaskIds = [];
  if (!Array.isArray(record.refundedTaskIds)) record.refundedTaskIds = [];
  Object.assign(record, clearGeminiGenerateFailureHistory(record));
  record.refundedTaskIds = record.refundedTaskIds.filter((id) => id !== taskId);
  if (!record.completedTaskIds.includes(taskId)) record.completedTaskIds.push(taskId);
  if (!record.chargedTaskIds.includes(taskId)) record.chargedTaskIds.push(taskId);
  record.used = getGeminiLocalTaskUsage(record);
  record.externalUsed = 0;
  record.date = record.date || today;
  allUsage[accKey] = record;
  for (const key of aliases) {
    const aliasRecord = allUsage[key];
    if (aliasRecord) Object.assign(aliasRecord, clearGeminiGenerateFailureHistory(aliasRecord));
  }
  saveGeminiUsage(allUsage);
}

function recordSuccessfulGeminiVideo(accKey: string, taskId: string, aliases: string[] = []) {
  if (isCompletedVideoTaskRecorded(accKey, taskId)) {
    markCompletedVideoTask(accKey, taskId, aliases);
    return getAccountDailyUsage(accKey);
  }
  const record = readAllGeminiUsage()[accKey];
  if (!record?.chargedTaskIds?.includes(taskId)) {
    const incremented = incrementAccountDailyUsage(accKey, taskId);
    if (!incremented.success) {
      throw new Error(incremented.error || 'Kredit Gemini tidak cukup untuk mencatat task sukses.');
    }
  }
  markCompletedVideoTask(accKey, taskId, aliases);
  return getAccountDailyUsage(accKey);
}

function isTemporaryGeminiCapacityText(text?: string | null): boolean {
  if (!text) return false;
  return /traffic.*(tinggi|penuh)|kapasitas.*penuh|luar biasa tinggi|coba lagi nanti|try again later|permintaan.*sedang tinggi|layanan sedang sibuk|high demand|temporarily unavailable|overloaded/i.test(text);
}

// =========================================================================================
// GOOGLE GEMINI PLAYWRIGHT AUTOMATION ENDPOINTS
// =========================================================================================

// POST /api/gemini/playwright/profile/delete
router.post('/gemini/playwright/profile/delete', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    await geminiPlaywrightManager.deleteProfile(email);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Gagal menghapus profil browser Gemini.',
    });
  }
});

// POST /api/gemini/playwright/start
router.post('/gemini/playwright/start', async (req, res) => {
  try {
    const { email, password, recoveryEmail, customLabel } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email dan kata sandi Google wajib diisi untuk otomasi login Playwright.',
      });
    }

    const startRes = await geminiPlaywrightManager.startLogin({
      email: String(email).trim(),
      password: String(password),
      recoveryEmail: recoveryEmail ? String(recoveryEmail).trim() : undefined,
      customLabel: customLabel ? String(customLabel).trim() : undefined,
    });

    return res.json({
      success: true,
      ...startRes,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Gagal memulai otomasi browser Playwright.',
    });
  }
});

// POST /api/gemini/playwright/relogin
router.post('/gemini/playwright/relogin', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Alamat email Google tidak valid.' });
    }

    const credentials = await geminiPlaywrightManager.getSavedCredentials(email);
    if (!credentials) {
      return res.status(404).json({
        success: false,
        error: 'Kredensial untuk profil ini belum tersimpan. Tambahkan akun melalui Playwright terlebih dahulu.',
      });
    }

    const startRes = await geminiPlaywrightManager.startLogin({
      email,
      password: credentials.password,
    });
    return res.json({ success: true, ...startRes });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Gagal memulai relogin Gemini.',
    });
  }
});

// POST /api/gemini/playwright/start-batch
router.post('/gemini/playwright/start-batch', async (req, res) => {
  try {
    const rawEmails = Array.isArray(req.body?.emails)
      ? req.body.emails
      : String(req.body?.emails || req.body?.batchText || '')
          .split(/[\n,]+/)
          .map((value) => value.trim())
          .filter(Boolean);

    const password = String(req.body?.password || '').trim();
    const recoveryEmail = req.body?.recoveryEmail ? String(req.body.recoveryEmail).trim() : undefined;
    const customLabel = req.body?.customLabel ? String(req.body.customLabel).trim() : undefined;

    if (!rawEmails.length) {
      return res.status(400).json({
        success: false,
        error: 'Daftar email batch wajib diisi agar Playwright bisa memproses akun satu per satu.',
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password wajib diisi untuk semua email dalam batch Gemini.',
      });
    }

    const existingEmails = Array.isArray(req.body?.existingEmails)
      ? req.body.existingEmails.map((e: any) => String(e).trim()).filter(Boolean)
      : undefined;

    const batchResult = await geminiPlaywrightManager.startBatchLogin({
      emails: rawEmails,
      password,
      recoveryEmail,
      customLabel,
      existingEmails,
    });

    return res.json({
      success: true,
      ...batchResult,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Gagal memulai batch Playwright Gemini.',
    });
  }
});

// GET /api/gemini/playwright/batch-status/:batchId
router.get('/gemini/playwright/batch-status/:batchId', (req, res) => {
  const batch = geminiPlaywrightManager.getBatch(req.params.batchId);
  if (!batch) {
    return res.status(404).json({ success: false, error: 'Sesi batch Playwright tidak ditemukan atau kedaluwarsa.' });
  }
  return res.json({ success: true, ...batch });
});

// GET /api/gemini/playwright/status/:sessionId
router.get('/gemini/playwright/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = geminiPlaywrightManager.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sesi Playwright tidak ditemukan atau sudah kedaluwarsa.',
      });
    }

    return res.json({
      success: true,
      sessionId: session.id,
      status: session.status,
      currentStep: session.currentStep,
      logs: session.logs,
      challengeType: session.challengeType,
      challengePrompt: session.challengePrompt,
      screenshotBase64: session.screenshotBase64,
      account: session.account,
      error: session.error,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Gagal membaca status sesi Playwright.',
    });
  }
});

// POST /api/gemini/playwright/submit-2fa
router.post('/gemini/playwright/submit-2fa', async (req, res) => {
  try {
    const { sessionId, code, customLabel } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID wajib disertakan.' });
    }

    await geminiPlaywrightManager.submit2FA(sessionId, String(code || '').trim(), customLabel);

    return res.json({
      success: true,
      message: 'Kode 2FA berhasil dikirimkan ke browser Google.',
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Gagal memproses verifikasi 2FA.',
    });
  }
});

// POST /api/gemini/playwright/cancel
router.post('/gemini/playwright/cancel', async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    if (sessionId) {
      await geminiPlaywrightManager.cancelSession(sessionId);
    }
    return res.json({ success: true, message: 'Sesi Playwright telah dibatalkan.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/gemini/playwright/scripts
router.get('/gemini/playwright/scripts', async (_req, res) => {
  try {
    const scripts = geminiPlaywrightManager.getLocalPlaywrightScripts();
    return res.json({ success: true, ...scripts });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/gemini/accounts/sync-daily - Legacy route name; synchronizes lifetime video credits.
router.post('/gemini/accounts/sync-daily', async (req, res) => {
  try {
    const rawInput = String(req.body.token || req.body.apiKey || req.body.cookies || '').trim();
    const email = String(req.body.email || '').trim();
    let extracted = extractCookiesOrApiKey(rawInput);

    if (!extracted.cookies && !extracted.apiKey && email) {
      try {
        const { getCookiesForGeminiEmail } = require('../utils/geminiProfileCookies');
        const profileCookies = getCookiesForGeminiEmail(email);
        if (profileCookies) {
          extracted.cookies = profileCookies;
        }
      } catch (e) {}
    }

    let accKey = getGeminiAccountIdentifier(extracted.cookies || rawInput, extracted.apiKey, email);

    if (extracted.cookies) {
      // 1. Verifikasi status sesi akun langsung ke Google (cek apakah cookie masih hidup atau sudah logout/expired)
      const verifyResult = await verifyGeminiWebSession(extracted.cookies, email);
      if (!verifyResult.success) {
        return res.status(401).json({
          success: false,
          error: 'Sesi Google Gemini kedaluwarsa atau cookie login tidak valid (SESSION_COOKIE_INVALID / Logged Out).',
          accountStatus: 'expired',
          statusMessage: 'EXPIRED',
          credits: 0,
          remainingCredits: 0,
          totalCredits: GEMINI_MAX_CREDITS,
        });
      }

      const verifiedEmail = verifyResult.email || email;
      accKey = getGeminiAccountIdentifier(extracted.cookies, undefined, verifiedEmail);

      // Only local app tasks affect AMB Media credits; Google history is not scanned.
      const usage = initializeGeminiAccountUsage(
        accKey,
        getGeminiAccountUsageKeys(verifiedEmail, extracted.cookies)
      );

      return res.json({
        success: true,
        accountStatus: 'active',
        credits: usage.remaining,
        remainingCredits: usage.remaining,
        totalCredits: usage.total,
        usedToday: usage.used,
        usedTotal: usage.used,
        used: usage.used,
        localTaskUsage: usage.used,
        isQuotaExhausted: usage.remaining <= 0,
        ledgerKnown: true,
        creditSyncStatus: 'synced',
        date: usage.date,
        email: verifiedEmail,
        displayName: verifyResult.name,
        photoUrl: verifyResult.photoUrl,
        tier: verifyResult.tier,
        isAdvanced: verifyResult.isAdvanced,
        cookies: extracted.cookies,
        token: extracted.cookies,
        source: 'local_ledger',
      });
    }

    if (extracted.apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey: extracted.apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
        // Verifikasi keaktifan riil model dengan API Key ke Google
        await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: 'ping',
        });
        const usage = initializeGeminiAccountUsage(accKey, getGeminiAccountUsageKeys(undefined, extracted.apiKey));
        return res.json({
          success: true,
          accountStatus: 'active',
          credits: usage.remaining,
          remainingCredits: usage.remaining,
          totalCredits: usage.total,
          usedToday: usage.used,
          used: usage.used,
          ledgerKnown: usage.found,
          creditSyncStatus: usage.found ? 'synced' : 'unknown',
          date: usage.date,
        });
      } catch (err: any) {
        return res.status(401).json({
          success: false,
          error: 'API Key Gemini tidak valid atau ditolak oleh Google: ' + (err.message || 'Unauthorized'),
          accountStatus: 'expired',
          statusMessage: 'EXPIRED',
          credits: 0,
          remainingCredits: 0,
          totalCredits: GEMINI_MAX_CREDITS,
        });
      }
    }

    return res.status(400).json({
      success: false,
      error: 'Token / Cookie sesi Gemini tidak ditemukan.',
      accountStatus: 'expired',
      credits: 0,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Gagal sinkronisasi status akun Gemini.',
      accountStatus: 'error',
    });
  }
});

// POST /api/gemini/accounts/verify
router.post('/gemini/accounts/verify', async (req, res) => {
  try {
    const rawInput = String(req.body.token || req.body.apiKey || req.body.cookies || '').trim();
    const customLabel = String(req.body.customLabel || '').trim();
    const expectedEmail = String(req.body.email || '').trim();

    if (!rawInput) {
      return res.status(400).json({ success: false, error: 'Token / Cookie / cURL / API Key Gemini wajib diisi.' });
    }

    const extracted = extractCookiesOrApiKey(rawInput);

    // 1. Check if it's an API Key (starts with AIza...)
    if (extracted.apiKey) {
      const apiKey = extracted.apiKey;
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
        await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: 'ping',
        });

        const shortKey = `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
        const accKey = getGeminiAccountIdentifier(undefined, apiKey);
        const usage = initializeGeminiAccountUsage(accKey, getGeminiAccountUsageKeys(undefined, apiKey));

        return res.json({
          success: true,
          type: 'api_key',
          email: customLabel || 'Google AI Studio API Key',
          name: customLabel || `Gemini API (${shortKey})`,
          displayName: customLabel || `Gemini API (${shortKey})`,
          tier: 'Google AI Studio API',
          credits: usage.remaining,
          totalCredits: GEMINI_MAX_CREDITS,
          creditsUsed: usage.used,
          used: usage.used,
          ledgerKnown: usage.found,
          creditSyncStatus: usage.found ? 'synced' : 'unknown',
          token: apiKey,
        });
      } catch (apiErr: any) {
        return res.status(400).json({
          success: false,
          error: `API Key Google Gemini tidak valid: ${apiErr.message}`,
        });
      }
    }

    // 2. Treat as Cookie string or cURL
    const cookies = extracted.cookies || rawInput;
    if (!cookies.includes('__Secure') && !cookies.includes('SID=') && !cookies.includes('SAPISID=')) {
      return res.status(400).json({
        success: false,
        error:
          'Format tidak dikenali. Masukkan cURL bash mentah, Cookie Google (__Secure-1PSID, SID), atau API Key AI Studio (AIzaSy...).',
      });
    }

    const webCheck = await verifyGeminiWebSession(cookies, expectedEmail);
    if (!webCheck.success) {
      return res.status(400).json({
        success: false,
        error:
          'Sesi cookie Gemini tidak valid atau sudah kadaluwarsa. Pastikan Anda menyalin seluruh cookie terbaru dari gemini.google.com.',
      });
    }

    const shortId = cookies.slice(0, 6);
    let emailToUse = webCheck.email;
    let nameToUse = webCheck.name;

    if (customLabel) {
      nameToUse = customLabel.includes('@') ? customLabel.split('@')[0] : customLabel;
    }

    if (!nameToUse) {
      nameToUse = emailToUse ? emailToUse.split('@')[0] : `Gemini (${shortId})`;
    }

    const accKey = getGeminiAccountIdentifier(cookies, undefined, emailToUse);
    let remainingCredits = GEMINI_MAX_CREDITS;
    let usedToday = 0;

    const usage = initializeGeminiAccountUsage(accKey, getGeminiAccountUsageKeys(emailToUse, cookies));
    remainingCredits = usage.remaining;
    usedToday = usage.used;

    return res.json({
      success: true,
      type: 'web_session',
      email: emailToUse,
      name: nameToUse,
      displayName: nameToUse,
      photoUrl: webCheck.photoUrl,
      tier: webCheck.tier,
      isAdvanced: webCheck.isAdvanced,
      credits: remainingCredits,
      totalCredits: GEMINI_MAX_CREDITS,
      creditsUsed: usage.used,
      creditSyncStatus: 'synced',
      ledgerKnown: true,
      usedToday,
      token: cookies,
    });
  } catch (err: any) {
    console.error('[Gemini Verify Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Gagal memverifikasi akun Google Gemini.',
    });
  }
});

// POST /api/gemini/upload - Local disk & multipart media caching for Google Gemini prompts & references
router.post(
  '/gemini/upload',
  (req, res, next) => {
    uploadDisk.single('file')(req as any, res as any, () => {
      next();
    });
  },
  (req, res) => {
    try {
      let buf: Buffer | null = null;
      let originalName = 'upload_media';
      let mimeType = 'image/png';

      if (req.file) {
        originalName = req.file.originalname;
        mimeType = req.file.mimetype;
        buf = fs.readFileSync(req.file.path);
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {}
      } else {
        const { fileName = 'image.png', fileData, base64, mimeType: bodyMime = 'image/png' } = req.body || {};
        const rawData = fileData || base64;
        if (!rawData) {
          return res.status(400).json({ success: false, error: 'Tidak ada data file yang dikirim.' });
        }
        originalName = fileName;
        mimeType = bodyMime;

        if (typeof rawData === 'string' && rawData.includes(';base64,')) {
          const parts = rawData.split(';base64,');
          if (parts[0].startsWith('data:')) {
            mimeType = parts[0].replace('data:', '');
          }
          buf = Buffer.from(parts[1], 'base64');
        } else {
          buf = Buffer.from(rawData, 'base64');
        }
      }

      if (!buf) {
        return res.status(400).json({ success: false, error: 'Gagal membaca isi data media.' });
      }

      const isVideo = mimeType.startsWith('video/') || originalName.match(/\.(mp4|mov|webm|mkv|avi)$/i);
      let ext = mimeType.split('/')[1] || path.extname(originalName).replace('.', '') || (isVideo ? 'mp4' : 'png');
      if (ext === 'quicktime') ext = 'mov';

      const uniqueFilename = `gemini_upload_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const targetPath = path.join(mediaCacheDir, uniqueFilename);
      fs.writeFileSync(targetPath, buf);

      const publicUrl = `/media-cache/${uniqueFilename}`;
      const dataUrl = `data:${mimeType};base64,${buf.toString('base64')}`;

      console.log(`[Gemini 📂 Media Upload Success] File ${originalName} (${isVideo ? 'Video' : 'Image'}) disimpan ke ${publicUrl} (${(buf.length / 1024).toFixed(1)} KB)`);
      return res.json({
        success: true,
        url: publicUrl,
        mediaUrl: publicUrl,
        previewUrl: publicUrl,
        dataUrl,
        type: isVideo ? 'video' : 'image',
        name: originalName,
      });
    } catch (err: any) {
      console.error('[Gemini Upload Error]:', err);
      return res.status(500).json({ success: false, error: err.message || 'Gagal menyimpan media untuk Gemini.' });
    }
  }
);

// POST /api/gemini/generate-image
router.post('/gemini/generate-image', async (req, res) => {
  try {
    const {
      prompt,
      aspectRatio = '9:16',
      model = 'imagen-3.0-generate-002',
      token,
      apiKey: customApiKey,
      cookies: customCookies,
      referenceImageUrl,
      referenceImageUrls = [],
      fallbackAccounts = [],
    } = req.body || {};

    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) {
      return res.status(400).json({ success: false, error: 'Prompt gambar wajib diisi.' });
    }

    // Supported aspect ratios in Google Imagen 3: '1:1', '3:4', '4:3', '9:16', '16:9'
    let cleanAspect = '9:16';
    if (['1:1', '3:4', '4:3', '9:16', '16:9'].includes(aspectRatio)) {
      cleanAspect = aspectRatio;
    }

    // Build ordered list of candidate accounts to try (Primary account first, then fallback accounts with available credits)
    const candidateAccounts: any[] = [];
    const primaryToken = String(token || '').trim();
    const primaryApiKey = customApiKey || (primaryToken.startsWith('AIza') && primaryToken.length >= 30 ? primaryToken : undefined);
    const primaryCookies = customCookies || (primaryToken.includes('__Secure') || primaryToken.includes('SID=') || primaryToken.includes('SAPISID=') ? primaryToken : undefined);

    if (primaryToken || primaryApiKey || primaryCookies) {
      candidateAccounts.push({
        id: req.body.id || req.body.accountId || 'primary',
        email: req.body.email,
        name: req.body.name || req.body.displayName || req.body.email || 'Akun Aktif',
        token: primaryToken,
        apiKey: primaryApiKey,
        cookies: primaryCookies,
      });
    }

    if (Array.isArray(fallbackAccounts)) {
      for (const fb of fallbackAccounts) {
        if (!fb) continue;
        const fbToken = String(fb.token || fb.refreshToken || fb.apiKey || fb.cookies || '').trim();
        const fbApiKey = fb.apiKey || (fbToken.startsWith('AIza') && fbToken.length >= 30 ? fbToken : undefined);
        const fbCookies = fb.cookies || (fbToken.includes('__Secure') || fbToken.includes('SID=') || fbToken.includes('SAPISID=') ? fbToken : undefined);
        if (fbToken || fbApiKey || fbCookies) {
          const isDupe = candidateAccounts.some(
            (c) => (fb.id && c.id === fb.id) || (fb.email && c.email && c.email.toLowerCase() === fb.email.toLowerCase())
          );
          if (!isDupe) {
            candidateAccounts.push({
              id: fb.id || `acc_${Math.random().toString(36).substring(2, 8)}`,
              email: fb.email,
              name: fb.name || fb.displayName || fb.email || 'Akun Cadangan',
              token: fbToken,
              apiKey: fbApiKey,
              cookies: fbCookies,
            });
          }
        }
      }
    }

    if (candidateAccounts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tidak ada akun Google Gemini yang terhubung. Silakan hubungkan akun Google Gemini di menu Settings.',
      });
    }

    const exhaustedAccounts: { id: string; email?: string; name?: string; reason: string; isQuotaExhausted?: boolean }[] = [];
    const primaryAccountId = candidateAccounts[0]?.id;
    let finalSuccessData: any = null;
    let lastCandidateErrorMessage = '';

    // Coba seluruh akun kandidat yang tersedia tanpa blokir prematur dari cache lokal.
    const accountsToTry = candidateAccounts;

    for (let accIdx = 0; accIdx < accountsToTry.length; accIdx++) {
      const candidate = accountsToTry[accIdx];
      const curToken = String(candidate.token || '').trim();
      const curIsApiKey = candidate.apiKey || (curToken.startsWith('AIza') && curToken.length >= 30 ? curToken : undefined);
      const curApiKey = curIsApiKey || process.env.GEMINI_API_KEY;
      let curCookies = candidate.cookies || (curToken.includes('__Secure') || curToken.includes('SID=') || curToken.includes('SAPISID=') ? curToken : undefined);
      if (!curCookies && !curIsApiKey && candidate.email) {
        try {
          const { getCookiesForGeminiEmail } = require('../utils/geminiProfileCookies');
          curCookies = getCookiesForGeminiEmail(candidate.email) || undefined;
        } catch (e) {}
      }

      const accKey = getGeminiAccountIdentifier(curCookies, curIsApiKey, candidate.email);
      let dailyCheck = getAccountDailyUsage(accKey);

      console.log(`[Gemini Image Multi-Account] 🎨 Mencoba Akun #${accIdx + 1} (${candidate.name || candidate.email || candidate.id}) | Model: "${model}" | Quota: ${dailyCheck.remaining}/${GEMINI_MAX_CREDITS}`);

      let generatedImageUrl = '';
      let usedModel = model || 'Google Imagen 3 Pro';

      // 1. PRIMARY PATH FOR GEMINI WEB ACCOUNTS: Gemini Web Session
      if (curCookies) {
        try {
          const { GeminiWebClient, isRefusalOrErrorText, isQuotaExhaustedText } = require('../../script-gemini/gemini_chat.cjs');
          const client = new GeminiWebClient(curCookies);
          await client.initSession();
          const webPrompt = `Generate a photorealistic high-resolution image with ${cleanAspect} aspect ratio: ${cleanPrompt}`;
          const webRes = await client.sendMessage(webPrompt);
          
          if (webRes && Array.isArray(webRes.images) && webRes.images.length > 0) {
            generatedImageUrl = webRes.images[0];
            usedModel = 'Gemini Web Direct (Akun Google Pro)';
          } else if (webRes && webRes.text) {
            if (isQuotaExhaustedText(webRes.text)) {
              logGeminiExternalQuotaRefusal(accKey, webRes.text, candidate.email);
              exhaustedAccounts.push({
                id: candidate.id,
                email: candidate.email,
                name: candidate.name,
                reason: webRes.text,
                isQuotaExhausted: true,
              });
              lastCandidateErrorMessage = `Akun "${candidate.name || candidate.email}" mencapai batas kuota harian: ${webRes.text}`;
              continue; // Auto switch to next account!
            }
            // Check for image URL inside text
            const match = webRes.text.match(/https?:\/\/[^\s<>"')]+(?:\.jpg|\.jpeg|\.png|\.webp|googleusercontent\.com[^\s<>"')]*)/i);
            if (match && !match[0].includes('image_generation_content')) {
              generatedImageUrl = match[0];
              usedModel = 'Gemini Web Direct (Akun Google Pro)';
            }
          }
        } catch (webErr: any) {
          lastCandidateErrorMessage = webErr.message || String(webErr);
          console.warn(`[Gemini Image Web notice for ${candidate.name || candidate.id}]:`, lastCandidateErrorMessage);
        }
      }

      // 2. SECONDARY PATH: Google GenAI SDK (if API Key provided)
      if (!generatedImageUrl && curIsApiKey) {
        try {
          const ai = new GoogleGenAI({
            apiKey: curIsApiKey,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });

          // Method A: ai.models.generateImages with Imagen 3
          try {
            const imgResp = await ai.models.generateImages({
              model: 'imagen-3.0-generate-002',
              prompt: cleanPrompt,
              config: {
                numberOfImages: 1,
                aspectRatio: cleanAspect as any,
                outputMimeType: 'image/jpeg',
              },
            });

            if (imgResp && imgResp.generatedImages && imgResp.generatedImages[0]?.image?.imageBytes) {
              const b64 = imgResp.generatedImages[0].image.imageBytes;
              const filename = `gemini_img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
              const filepath = path.join(mediaCacheDir, filename);
              fs.writeFileSync(filepath, Buffer.from(b64, 'base64'));
              generatedImageUrl = `/media-cache/${filename}`;
              usedModel = 'Google Imagen 3 Pro';
            }
          } catch (imgErr: any) {}

          // Method B: ai.models.generateContent with gemini-3.1-flash-image
          if (!generatedImageUrl) {
            try {
              const contentResp = await ai.models.generateContent({
                model: 'gemini-3.1-flash-image',
                contents: { parts: [{ text: cleanPrompt }] },
                config: { imageConfig: { aspectRatio: cleanAspect as any, imageSize: '1K' } },
              });

              const parts = contentResp?.candidates?.[0]?.content?.parts || [];
              for (const p of parts) {
                if (p.inlineData && p.inlineData.data) {
                  const filename = `gemini_img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.png`;
                  const filepath = path.join(mediaCacheDir, filename);
                  fs.writeFileSync(filepath, Buffer.from(p.inlineData.data, 'base64'));
                  generatedImageUrl = `/media-cache/${filename}`;
                  usedModel = 'Gemini 3 Pro Image';
                  break;
                }
              }
            } catch (sdkErr: any) {}
          }
        } catch (sdkInitErr: any) {}
      }

      // 3. Fallback: If still empty, do not bypass to system API key; only use user-added accounts

      if (generatedImageUrl) {
        const usageAfter = getAccountDailyUsage(accKey);
        const wasSwitched = candidate.id !== primaryAccountId;
        finalSuccessData = {
          success: true,
          imageUrl: generatedImageUrl,
          prompt: cleanPrompt,
          model: usedModel,
          aspectRatio: cleanAspect,
          remainingCredits: usageAfter.remaining,
          totalCredits: GEMINI_MAX_CREDITS,
          wasSwitched,
          usedAccount: {
            id: candidate.id,
            email: candidate.email,
            name: candidate.name,
            token: candidate.token,
            apiKey: candidate.apiKey,
            cookies: candidate.cookies,
          },
          exhaustedAccounts,
          message: wasSwitched
            ? `Otomatis beralih ke akun "${candidate.name || candidate.email}". Gambar berhasil dibuat!`
            : `Gambar berhasil dibuat menggunakan model ${usedModel}! (Sisa kuota hari ini: ${usageAfter.remaining}/${GEMINI_MAX_CREDITS})`,
        };
        break;
      } else {
        exhaustedAccounts.push({
          id: candidate.id,
          email: candidate.email,
          name: candidate.name,
          reason: lastCandidateErrorMessage || 'Gagal menghasilkan gambar dengan akun ini.',
        });
      }
    }

    if (finalSuccessData) {
      return res.json(finalSuccessData);
    }

    return res.status(200).json({
      success: false,
      isLocationRestricted: true,
      canFallbackWeavy: true,
      exhaustedAccounts,
      error: 'Akun Google Gemini Anda aktif, namun Google membatasi pembuatan gambar (Imagen) via web chat pada akun-akun ini di koneksi/wilayah ini. Silakan gunakan Weavy AI (Nano Banana Pro / Seedream) atau hubungkan Google AI Studio API Key di menu Settings.',
      message: 'Akun Google Gemini Anda aktif, namun Google membatasi pembuatan gambar (Imagen) via web chat pada akun-akun ini di koneksi/wilayah ini. Silakan gunakan Weavy AI (Nano Banana Pro / Seedream) atau hubungkan Google AI Studio API Key di menu Settings.',
    });
  } catch (err: any) {
    console.log('[Gemini Generate Image notice]:', err.message || err);
    return res.status(200).json({
      success: false,
      canFallbackWeavy: true,
      error: err.message || 'Gagal menghasilkan gambar dengan Google Gemini.',
    });
  }
});



// POST /api/gemini/generate-video
router.post('/gemini/generate-video', async (req, res) => {
  try {
    const requestBody = req.body || {};
    const cliTestToken = String(req.get('x-amb-cli-gemini-test-token') || '');
    const cliTestMode = consumeCliGeminiTestPermit(
      cliTestToken,
      String(requestBody.id || requestBody.accountId || ''),
      String(requestBody.email || ''),
    );
    if (cliTestToken && !cliTestMode) {
      return res.status(403).json({
        success: false,
        error: 'Izin test CLI Gemini tidak valid atau kedaluwarsa. Ulangi generate dari CLI.',
      });
    }
    const {
      prompt,
      aspectRatio = '16:9',
      duration = '10s',
      resolution = '1080p',
      model = 'Omni Flash',
      token,
      cookies: customCookies,
      referenceImageUrl,
      referenceImageUrls = [],
      referenceVideoUrl,
      referenceVideoUrls = [],
      imageUrl,
      imageUrls = [],
      videoUrl,
      videoUrls = [],
      attachedMedia = [],
      fallbackAccounts = [],
    } = req.body || {};
    const modelLogName = /omni.*flash|gemini-omni/i.test(String(model))
      ? 'Omni Flash'
      : String(model || 'Omni Flash');

    // Collect all candidate reference images (up to 5 max)
    const rawRefImages: string[] = [];
    if (Array.isArray(referenceImageUrls)) rawRefImages.push(...referenceImageUrls);
    if (Array.isArray(imageUrls)) rawRefImages.push(...imageUrls);
    if (referenceImageUrl && !rawRefImages.includes(referenceImageUrl)) rawRefImages.push(referenceImageUrl);
    if (imageUrl && !rawRefImages.includes(imageUrl)) rawRefImages.push(imageUrl);
    if (Array.isArray(attachedMedia)) {
      attachedMedia
        .filter((m: any) => m && (m.type === 'image' || (!m.type && !m.url?.match(/\.(mp4|mov|webm)$/i))) && (m.url || m.mediaUrl || m.previewUrl))
        .forEach((m: any) => {
          const u = m.url || m.mediaUrl || m.previewUrl;
          if (u && !rawRefImages.includes(u)) rawRefImages.push(u);
        });
    }
    const targetRefImages = rawRefImages.filter(Boolean).slice(0, 5);

    // Collect candidate reference video (max 1)
    let targetRefVideo: string | null =
      referenceVideoUrl ||
      videoUrl ||
      (Array.isArray(referenceVideoUrls) && referenceVideoUrls.length > 0 ? referenceVideoUrls[0] : null) ||
      (Array.isArray(videoUrls) && videoUrls.length > 0 ? videoUrls[0] : null) ||
      null;

    if (!targetRefVideo && Array.isArray(attachedMedia)) {
      const vidMed = attachedMedia.find(
        (m: any) => m && (m.type === 'video' || (m.url && m.url.match(/\.(mp4|mov|webm)$/i))) && (m.url || m.mediaUrl || m.previewUrl)
      );
      if (vidMed) {
        targetRefVideo = vidMed.url || vidMed.mediaUrl || vidMed.previewUrl;
      }
    }

    const hasReferences = targetRefImages.length > 0 || !!targetRefVideo;

    let cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt && !hasReferences) {
      return res.status(400).json({ success: false, error: 'Prompt video atau media referensi (maks. 5 gambar & 1 video) wajib diisi.' });
    }

    if (!cleanPrompt && hasReferences) {
      cleanPrompt = 'Animate and generate a cinematic video based on the provided reference visual materials with natural motion and lively depth.';
    }

    // Standardize ratio
    let cleanAspect = '16:9';
    if (aspectRatio.includes('9:16') || aspectRatio === '9:16') cleanAspect = '9:16';
    else if (aspectRatio.includes('1:1') || aspectRatio === '1:1') cleanAspect = '1:1';
    else if (aspectRatio.includes('4:3') || aspectRatio === '4:3') cleanAspect = '4:3';
    else if (aspectRatio.includes('3:4') || aspectRatio === '3:4') cleanAspect = '3:4';
    else cleanAspect = '16:9';

    // Standardize duration string
    const cleanDuration = duration.toString().includes('s') ? duration.toString() : `${duration}s`;

    // Is reference mode
    const isImageToVideo = targetRefImages.length > 0;
    const isVideoRef = !!targetRefVideo;

    // Build ordered list of candidate accounts to try (Primary account first, then fallback accounts)
    const candidateAccounts: any[] = [];
    const primaryToken = String(token || '').trim();
    const primaryCookies = customCookies || (primaryToken.includes('__Secure') || primaryToken.includes('SID=') || primaryToken.includes('SAPISID=') ? primaryToken : undefined);

    if (primaryToken || primaryCookies || req.body.email) {
      candidateAccounts.push({
        id: req.body.id || req.body.accountId || 'primary',
        email: req.body.email,
        name: req.body.name || req.body.displayName || req.body.email || 'Akun Aktif',
        token: primaryToken,
        cookies: primaryCookies,
      });
    }

    if (Array.isArray(fallbackAccounts)) {
      for (const fb of fallbackAccounts) {
        if (!fb) continue;
        const fbToken = String(fb.token || fb.refreshToken || fb.cookies || '').trim();
        const fbCookies = fb.cookies || (fbToken.includes('__Secure') || fbToken.includes('SID=') || fbToken.includes('SAPISID=') ? fbToken : undefined);
        if (fbToken || fbCookies || fb.email) {
          const isDupe = candidateAccounts.some(
            (c) => (fb.id && c.id === fb.id) || (fb.email && c.email && c.email.toLowerCase() === fb.email.toLowerCase())
          );
          if (!isDupe) {
            candidateAccounts.push({
              id: fb.id || `acc_${Math.random().toString(36).substring(2, 8)}`,
              email: fb.email,
              name: fb.name || fb.displayName || fb.email || 'Akun Cadangan',
              token: fbToken,
              cookies: fbCookies,
            });
          }
        }
      }
    }

    // Server-side fallback: check cookies from logged-in Gemini Web profiles.
    if (candidateAccounts.length === 0) {
      try {
        const baseDir = path.join(process.cwd(), '.playwright-profiles');
        if (fs.existsSync(baseDir)) {
          const dirs = fs.readdirSync(baseDir);
          for (const d of dirs) {
            const fullDir = path.join(baseDir, d);
            const prefPath = path.join(fullDir, 'Default', 'Preferences');
            if (fs.existsSync(prefPath)) {
              try {
                const prefData = fs.readFileSync(prefPath, 'utf8');
                const emailMatch = prefData.match(/[a-zA-Z0-9._%+-]+@(?:gmail\.com|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                if (emailMatch && emailMatch[0]) {
                  const em = emailMatch[0];
                  const { getCookiesForGeminiEmail } = require('../utils/geminiProfileCookies');
                  const cks = getCookiesForGeminiEmail(em);
                  if (cks) {
                    candidateAccounts.push({
                      id: `profile_${d}`,
                      email: em,
                      name: em,
                      cookies: cks,
                      token: cks,
                    });
                  }
                }
              } catch (e) {}
            }
          }
        }
      } catch (e) {}
    }

    if (candidateAccounts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tidak ada akun Google Gemini yang terhubung. Silakan hubungkan akun Google Gemini di menu Settings.',
      });
    }

    const exhaustedAccounts: { id: string; email?: string; name?: string; reason: string; isQuotaExhausted?: boolean }[] = [];
    const primaryAccountId = candidateAccounts[0]?.id;
    let finalSuccessData: any = null;
    let lastCandidateErrorMessage = '';
    let accountsSkippedForBusy = 0;
    const loggedBusyAccountKeys = new Set<string>();

    // Smart Multi-Account Rotation for Video:
    // Coba seluruh akun kandidat yang tersedia tanpa blokir prematur dari cache lokal.
    // Akun hanya akan ditandai habis kuota jika Google memberikan respons penolakan kuota eksplisit (isQuotaExhaustedText).
    const accountsToTry = prioritizeGeminiAccountsByFailureHistory(
      candidateAccounts,
      readAllGeminiUsage(),
      (candidate) => getGeminiAccountUsageKeys(candidate.email, candidate.cookies || candidate.token),
    );

    let retryBusyAccounts = true;
    while (!finalSuccessData && retryBusyAccounts && !req.aborted && !res.destroyed) {
      retryBusyAccounts = false;
      accountsSkippedForBusy = 0;
      for (let accIdx = 0; accIdx < accountsToTry.length; accIdx++) {
      const candidate = accountsToTry[accIdx];
      const curToken = String(candidate.token || '').trim();
      let curCookies = candidate.cookies || (curToken.includes('__Secure') || curToken.includes('SID=') || curToken.includes('SAPISID=') ? curToken : undefined);
      if (!curCookies && candidate.email) {
        try {
          const { getCookiesForGeminiEmail } = require('../utils/geminiProfileCookies');
          curCookies = getCookiesForGeminiEmail(candidate.email) || undefined;
        } catch (e) {}
      }

      const accKey = getGeminiAccountIdentifier(curCookies, undefined, candidate.email);

      if (!curCookies) {
        lastCandidateErrorMessage = `Akun "${candidate.name || candidate.email || candidate.id}" tidak memiliki cookie sesi Gemini Web yang valid. Generasi video hanya mendukung sesi Gemini Web.`;
        exhaustedAccounts.push({
          id: candidate.id,
          email: candidate.email,
          name: candidate.name,
          reason: lastCandidateErrorMessage,
        });
        continue;
      }

      const accountLock = tryAcquireGeminiVideoAccountLock(accKey, candidate.email);
      if (!accountLock) {
        accountsSkippedForBusy++;
        lastCandidateErrorMessage = `Akun "${candidate.name || candidate.email || candidate.id}" sedang menjalankan proses video Gemini lain.`;
        if (!loggedBusyAccountKeys.has(accKey)) {
          loggedBusyAccountKeys.add(accKey);
          console.log(`[Gemini Video Account Lock] ⏭️ Menunggu akun ${candidate.name || candidate.email || candidate.id} menyelesaikan proses video aktif.`);
        }
        continue;
      }

      if (!cliTestMode && !reserveGeminiVideoCredit(accKey)) {
        accountLock.release();
        const usage = getAccountDailyUsage(accKey);
        const reason = usage.found
          ? 'Kredit akun Gemini tidak cukup untuk generate video.'
          : 'Saldo akun Gemini belum dapat diverifikasi. Sinkronkan akun di Settings sebelum generate.';
        exhaustedAccounts.push({
          id: candidate.id,
          email: candidate.email,
          name: candidate.name,
          reason,
        });
        lastCandidateErrorMessage = `Akun "${candidate.name || candidate.email || candidate.id}": ${reason}`;
        continue;
      }

      const creditReservationHeld = !cliTestMode;
      let retainAccountLock = false;
      const accountLockHeartbeat = setInterval(() => accountLock.refresh(), 30_000);
      try {
      console.log(
        `[Gemini Video Multi-Account] 🎬 Mencoba Akun #${accIdx + 1} (${candidate.name || candidate.email || candidate.id}) | Mode: ${
          targetRefImages.length > 0 || targetRefVideo
            ? `Ref (${targetRefImages.length} Foto, ${targetRefVideo ? '1' : '0'} Video) ➔ 🎬 Video`
            : '📝 ➔ 🎬 Text to Video'
        } | Model: "${modelLogName}"`
      );

      let videoResultUrl = '';
      let operationName = '';
      let usedModel = model || 'Omni Flash';

      // 1. PRIMARY PATH: Native Google Gemini Web Client
      if (curCookies) {
        try {
          const { GeminiWebClient, isRefusalOrErrorText, isQuotaExhaustedText } = require('../../script-gemini/gemini_chat.cjs');
          const client = new GeminiWebClient(curCookies);
          await client.initSession();

          // Upload reference images (up to 5) and reference video (up to 1) to Google Scotty
          const mediaAttachments: { path: string; name: string; type: 'image' | 'video' }[] = [];

          for (let i = 0; i < targetRefImages.length; i++) {
            const imgRef = targetRefImages[i];
            const resolved = await resolveMediaBytes(imgRef);
            if (resolved?.buffer) {
              const ext = resolved.mimeType.includes('png') ? 'png' : 'jpg';
              const imgName = `reference_photo_${i + 1}.${ext}`;
              try {
                const rPath = await client.uploadImage(resolved.buffer, imgName, resolved.mimeType || 'image/png');
                if (rPath) {
                  mediaAttachments.push({ path: rPath, name: imgName, type: 'image' });
                }
              } catch (uploadErr: any) {
                console.warn(`[Gemini Scotty Image #${i + 1} Upload Warning]:`, uploadErr.message || uploadErr);
              }
            }
          }

          if (targetRefVideo) {
            const resolvedVid = await resolveMediaBytes(targetRefVideo);
            if (resolvedVid?.buffer) {
              const ext = resolvedVid.mimeType.includes('quicktime') ? 'mov' : 'mp4';
              const vidName = `reference_video.${ext}`;
              try {
                const rPath = await client.uploadImage(resolvedVid.buffer, vidName, resolvedVid.mimeType || 'video/mp4');
                if (rPath) {
                  mediaAttachments.push({ path: rPath, name: vidName, type: 'video' });
                }
              } catch (uploadErr: any) {
                console.warn('[Gemini Scotty Video Upload Warning]:', uploadErr.message || uploadErr);
              }
            }
          }

          const uploadedImagesCount = mediaAttachments.filter((m) => m.type === 'image').length;
          const uploadedVideoCount = mediaAttachments.filter((m) => m.type === 'video').length;

          // Match the prompt structure used by the working standalone generator.
          let rawUserPrompt = cleanPrompt
            .replace(/^\(?(?:Create|Generate)\s+video[^\)\n]*\)?[\s:\n]*/i, '')
            .replace(/\s*\(?(?:Create|Generate)\s+video[^\)\n]*\)?$/i, '')
            .trim();
          const videoPrompt = `Create a ${cleanDuration} video in ${cleanAspect} format: ${rawUserPrompt}`;

          let webConvId = '';
          let initialRespText = '';
          let streamError = '';
          let videoGenerationStarted = false;

          try {
            const finalRes = await client.sendMessage(
              videoPrompt,
              true,
              false,
              1,
              mediaAttachments.length > 0 ? mediaAttachments : null
            );

            if (finalRes?.isVideoGenerating) {
              videoGenerationStarted = true;
            }
            if (finalRes?.video) {
              videoGenerationStarted = true;
              let directUrl = finalRes.video.playbackUrl || finalRes.video.downloadUrl;
              const filename = `gemini_veo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp4`;
              const filepath = path.join(mediaCacheDir, filename);
              try {
                await client.downloadMedia(finalRes.video, filepath);
                videoResultUrl = `/media-cache/${filename}`;
              } catch (dlErr: any) {
                videoResultUrl = directUrl;
              }
              usedModel = isImageToVideo ? 'Google Veo (Image to Video Web)' : 'Google Veo 2 (Gemini Web Direct)';
            } else if (finalRes?.conversationId) {
              webConvId = finalRes.conversationId;
            } else if (client.conversationId) {
              webConvId = client.conversationId;
            }

            if (finalRes?.text) {
              initialRespText = finalRes.text;
            }
            if (isProgressNoticeText(initialRespText)) {
              videoGenerationStarted = true;
            }
            console.log(
              `[Gemini Video Request] ${webConvId ? `Conversation ${webConvId} created` : 'Google returned no conversation ID'}; ` +
              `video generation notice: ${videoGenerationStarted ? 'yes' : 'no'}.`
            );
          } catch (e: any) {
            streamError = e.message || String(e);
            if (client.conversationId) {
              webConvId = client.conversationId;
            }
          }

          // 1. Cek apakah ini penolakan kuota harian ("maaf saya tidak bisa membuat video lagi hari ini", limit reached, dll)
          const isQuota = isQuotaExhaustedText(initialRespText);
          if (isQuota) {
            logGeminiExternalQuotaRefusal(accKey, initialRespText, candidate.email);
            exhaustedAccounts.push({
              id: candidate.id,
              email: candidate.email,
              name: candidate.name,
              isQuotaExhausted: true,
              reason: initialRespText,
            });
            lastCandidateErrorMessage = `Akun "${candidate.name || candidate.email}" mencapai kuota harian: ${initialRespText}`;
            console.warn(`[Gemini Video Quota Exhausted for ${candidate.name || candidate.email || candidate.id}]:`, initialRespText);
            continue; // Otomatis beralih ke akun berikutnya jika tersedia!
          }

          // 2. Deteksi penolakan kapasitas sesaat (concurrency / high traffic server Google)
          const isCapacityRefusal = (txt?: string) => {
            if (!txt || typeof txt !== 'string') return false;
            return (
              /traffic.*tinggi/i.test(txt) ||
              /traffic.*penuh/i.test(txt) ||
              /kapasitas.*penuh/i.test(txt) ||
              /kapasitas saya penuh/i.test(txt) ||
              /luar biasa tinggi/i.test(txt) ||
              /coba lagi nanti/i.test(txt) ||
              /try again later/i.test(txt) ||
              /traffic pembuatan video/i.test(txt) ||
              /permintaan.*sedang tinggi/i.test(txt) ||
              /layanan sedang sibuk/i.test(txt)
            );
          };

          if (isCapacityRefusal(initialRespText) || isCapacityRefusal(streamError)) {
            console.log(`[Gemini Video Concurrency] ⚠️ Server Google kapasitas penuh sesaat. Menjalankan auto-retry sesi obrolan baru dalam 2.5 detik untuk akun ${candidate.name || candidate.id}...`);
            await new Promise((r) => setTimeout(r, 2500));
            initialRespText = '';
            streamError = '';
            webConvId = '';
            videoGenerationStarted = false;
            try {
              await client.initSession(true);
              const retryRes = await client.sendMessage(
                videoPrompt,
                true,
                false,
                1,
                mediaAttachments.length > 0 ? mediaAttachments : null
              );
              if (retryRes?.isVideoGenerating) {
                videoGenerationStarted = true;
              }
              if (retryRes?.video) {
                videoGenerationStarted = true;
                let directUrl = retryRes.video.playbackUrl || retryRes.video.downloadUrl;
                const filename = `gemini_veo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp4`;
                const filepath = path.join(mediaCacheDir, filename);
                try {
                  await client.downloadMedia(retryRes.video, filepath);
                  videoResultUrl = `/media-cache/${filename}`;
                } catch (dlErr: any) {
                  videoResultUrl = directUrl;
                }
                usedModel = isImageToVideo ? 'Google Veo (Image to Video Web)' : 'Google Veo 2 (Gemini Web Direct)';
              } else if (retryRes?.conversationId) {
                webConvId = retryRes.conversationId;
              } else if (client.conversationId) {
                webConvId = client.conversationId;
              }
              if (retryRes?.text) {
                initialRespText = retryRes.text;
              }
              if (isProgressNoticeText(initialRespText)) {
                videoGenerationStarted = true;
              }
            } catch (retryErr: any) {
              streamError = retryErr.message || String(retryErr);
              if (client.conversationId) {
                webConvId = client.conversationId;
              }
            }
          }

          // 3. Jika setelah retry masih kuota habis:
          if (isQuotaExhaustedText(initialRespText)) {
            logGeminiExternalQuotaRefusal(accKey, initialRespText, candidate.email);
            exhaustedAccounts.push({
              id: candidate.id,
              email: candidate.email,
              name: candidate.name,
              isQuotaExhausted: true,
              reason: initialRespText,
            });
            lastCandidateErrorMessage = `Akun "${candidate.name || candidate.email}" mencapai kuota harian: ${initialRespText}`;
            continue;
          }

          // 4. Jika Google menolak prompt secara eksplisit (kebijakan konten / bukan traffic):
          if (initialRespText && isRefusalOrErrorText(initialRespText) && !isCapacityRefusal(initialRespText)) {
            if (!cliTestMode) {
              recordFailedGeminiVideoGenerate(
                accKey,
                webConvId || `attempt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
              );
            }
            lastCandidateErrorMessage = initialRespText;
            exhaustedAccounts.push({
              id: candidate.id,
              email: candidate.email,
              name: candidate.name,
              reason: initialRespText,
            });
            console.warn(`[Gemini Video Account Failed for ${candidate.name || candidate.id}]:`, initialRespText);
            continue;
          }

          if (streamError && isRefusalOrErrorText(streamError) && !isCapacityRefusal(streamError)) {
            lastCandidateErrorMessage = streamError;
            exhaustedAccounts.push({
              id: candidate.id,
              email: candidate.email,
              name: candidate.name,
              reason: streamError,
            });
            console.warn(`[Gemini Video Account Failed for ${candidate.name || candidate.id}]:`, streamError);
            continue;
          }

          if (streamError && !videoResultUrl && !webConvId) {
            lastCandidateErrorMessage = streamError;
            console.warn(`[Gemini Video Stream Error for ${candidate.name || candidate.id}]:`, streamError);
            continue;
          }

          if (webConvId && !videoResultUrl && !videoGenerationStarted) {
            const failureMessage =
              `Gemini membuat percakapan ${webConvId}, tetapi tidak mengonfirmasi proses generate video dimulai. ` +
              'Task dihentikan tanpa polling render.';
            if (!cliTestMode) recordFailedGeminiVideoGenerate(accKey, webConvId);
            lastCandidateErrorMessage = failureMessage;
            console.warn(`[Gemini Video Not Started for ${candidate.name || candidate.id}]:`, failureMessage);
            exhaustedAccounts.push({
              id: candidate.id,
              email: candidate.email,
              name: candidate.name,
              reason: failureMessage,
            });
            continue;
          }

          // Hand off as soon as the stream confirms generation. The status endpoint
          // performs subsequent history checks so this request does not wait for render.
          if (webConvId && !videoResultUrl) {
            operationName = `web_${webConvId}`;
            updateGeminiVideoAccountLock(accountLock, {
              operationName,
              creditBypassMode: cliTestMode,
              state: 'processing',
            });
            retainAccountLock = true;
            webVideoTaskTracker.set(operationName, {
              startTime: Date.now(),
              convId: webConvId,
              accountKey: accKey,
              cookies: curCookies,
              email: candidate.email,
              accountName: candidate.name,
              initialText: initialRespText,
              creditBypassMode: cliTestMode,
            });
            usedModel = isImageToVideo ? 'Google Veo (Image to Video Web)' : 'Google Veo 2 (Gemini Web Direct)';
            console.log(`[Gemini Video Instant Hand-Off 🚀] Sesi task ${operationName} berhasil didaftarkan ke Google Veo. Segera diserahkan ke background polling.`);
          }
        } catch (webErr: any) {
          lastCandidateErrorMessage = webErr.message || String(webErr);
          console.warn(`[Gemini Video Web Error for ${candidate.name || candidate.id}]:`, lastCandidateErrorMessage);
        }
      }

      if (!videoResultUrl && !operationName) {
        lastCandidateErrorMessage = lastCandidateErrorMessage || 'Google Gemini Web tidak menerima permintaan video dari akun ini.';
        exhaustedAccounts.push({
          id: candidate.id,
          email: candidate.email,
          name: candidate.name,
          reason: lastCandidateErrorMessage,
        });
        continue;
      }

      if (cliTestMode && operationName) {
        try {
          recordCliGeminiTestTask(operationName, String(candidate.id), String(candidate.email || ''));
        } catch (error) {
          console.error('[CLI Gemini Test Mode] Accepted task could not be persisted in the test-task registry:', error);
        }
      }

      // CLI test tasks keep the normal account lock but do not reserve or consume app credits.
      const usageAfter = cliTestMode
        ? getAccountDailyUsage(accKey)
        : incrementAccountDailyUsage(accKey, operationName || videoResultUrl);
      if (videoResultUrl && !cliTestMode) {
        markCompletedVideoTask(
          accKey,
          operationName || videoResultUrl,
          getGeminiAccountUsageKeys(candidate.email, curCookies || candidate.token),
        );
      }
      const isStillProcessing = Boolean(operationName && !videoResultUrl);
      if (isStillProcessing) {
        updateGeminiVideoAccountLock(accountLock, {
          operationName,
          state: 'processing',
        });
        retainAccountLock = true;
      }
      const wasSwitched = candidate.id !== primaryAccountId;

      finalSuccessData = {
        success: true,
        status: isStillProcessing ? 'processing' : 'completed',
        videoUrl: videoResultUrl || undefined,
        operationName,
        taskId: operationName,
        prompt: cleanPrompt,
        model: usedModel,
        duration: cleanDuration,
        aspectRatio: cleanAspect,
        referenceImageUrl: targetRefImages[0] || undefined,
        referenceImageUrls: targetRefImages,
        referenceVideoUrl: targetRefVideo || undefined,
        isImageToVideo,
        isVideoReference: isVideoRef,
        remainingCredits: usageAfter.remaining,
        totalCredits: GEMINI_MAX_CREDITS,
        creditBypassed: cliTestMode,
        wasSwitched,
        usedAccount: {
          id: candidate.id,
          email: candidate.email,
          name: candidate.name,
          token: candidate.token,
          cookies: candidate.cookies,
        },
        exhaustedAccounts,
        message: cliTestMode
          ? 'Task generate CLI test diterima Google. Kredit internal AMB Media tidak dipotong; kuota Google tetap berlaku.'
          : wasSwitched
          ? `Otomatis beralih ke akun "${candidate.name || candidate.email}". Kredit telah direservasi (Sisa kuota: ${usageAfter.remaining}/${GEMINI_MAX_CREDITS}). Video sedang diproses!`
          : isStillProcessing
          ? `Video diterima Google dan sedang dirender. Kredit telah direservasi (Sisa kuota: ${usageAfter.remaining}/${GEMINI_MAX_CREDITS}).`
          : `Video Google Gemini (${isImageToVideo ? 'Image to Video' : 'Text to Video'}) berhasil di-generate! (Sisa kredit video: ${usageAfter.remaining}/${GEMINI_MAX_CREDITS})`,
      };
      break;
      } finally {
        clearInterval(accountLockHeartbeat);
        if (creditReservationHeld) releaseGeminiVideoCreditReservation(accKey);
        if (!retainAccountLock) accountLock.release();
      }
      }

      if (!finalSuccessData && accountsSkippedForBusy > 0 && !req.aborted && !res.destroyed) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        retryBusyAccounts = true;
      }
    }

    if (finalSuccessData) {
      return res.json(finalSuccessData);
    }

    // All candidate accounts failed or had 0 credits
    const allCandidatesFailed = exhaustedAccounts.length > 0 && exhaustedAccounts.length >= candidateAccounts.length;
    const allQuotaExhausted =
      allCandidatesFailed && exhaustedAccounts.every((account) => account.isQuotaExhausted);
    const finalErrorMessage =
      accountsSkippedForBusy > 0 && exhaustedAccounts.length === 0
        ? `Tidak ada akun Gemini yang bebas saat ini. Semua akun yang memenuhi syarat sedang menjalankan proses video lain.`
        : allCandidatesFailed
        ? `Semua akun Google Gemini gagal memulai generasi video. ${lastCandidateErrorMessage || 'Periksa sesi/cookie dan status akun di Settings.'}`
        : lastCandidateErrorMessage || 'Batas kredit video Gemini telah tercapai pada akun tersimpan.';

    return res.status(allQuotaExhausted ? 429 : 400).json({
      success: false,
      isQuotaExhausted: allQuotaExhausted,
      canFallbackWeavy: true,
      canFallbackRunningHub: true,
      error: finalErrorMessage,
      errorMessage: finalErrorMessage,
      exhaustedAccounts: exhaustedAccounts.filter((account) => account.isQuotaExhausted),
    });
  } catch (err: any) {
    console.error('[Gemini Generate Video Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Gagal menghasilkan video dengan Google Gemini.',
      errorMessage: err.message || 'Gagal menghasilkan video dengan Google Gemini.',
    });
  }
});

// POST /api/gemini/video-status
router.post('/gemini/video-status', async (req, res) => {
  try {
    const { operationName, taskId, token, cookies: customCookies, email, startedAt } = req.body || {};
    const targetOp = operationName || taskId;
    const accountId = String(req.body?.id || req.body?.accountId || '');

    if (!targetOp) {
      return res.status(400).json({ success: false, error: 'operationName atau taskId wajib disertakan.' });
    }

    let tracked = webVideoTaskTracker.get(targetOp);
    if (!tracked) {
      const persistedLock = findGeminiVideoAccountLockByOperation(targetOp);
      if (persistedLock) {
        tracked = {
          startTime: persistedLock.createdAt,
          convId: targetOp.startsWith('web_') ? targetOp.slice(4) : targetOp,
          accountKey: persistedLock.accountKey,
          email: persistedLock.email,
          creditBypassMode: persistedLock.creditBypassMode === true,
        };
        webVideoTaskTracker.set(targetOp, tracked);
      }
    }
    const rawToken = String(token || '').trim();
    let cookies = tracked?.cookies || customCookies || (rawToken.includes('__Secure') || rawToken.includes('SID=') || rawToken.includes('SAPISID=') ? rawToken : undefined);
    const emailToUse = tracked?.email || email;
    if (!cookies && emailToUse) {
      try {
        const { getCookiesForGeminiEmail } = require('../utils/geminiProfileCookies');
        cookies = getCookiesForGeminiEmail(emailToUse) || undefined;
      } catch (e) {}
    }
    const accKey = tracked?.accountKey || getGeminiAccountIdentifier(cookies, undefined, emailToUse);
    const cliTestMode = tracked?.creditBypassMode === true ||
      isCliGeminiTestTask(targetOp, accountId, String(emailToUse || ''));
    const usage = getAccountDailyUsage(accKey);

    // If it's a web conversation task
    if (targetOp.startsWith('web_')) {
      const convId = targetOp.replace('web_', '');
      try {
        const { GeminiWebClient, isQuotaExhaustedText } = require('../../script-gemini/gemini_chat.cjs');
        const client = new GeminiWebClient(cookies);
        await client.initSession();
        if (tracked && client.cookies) tracked.cookies = client.cookies;
        let history = await client.getConversationHistory(convId, 20000);

        // IF HISTORY IS NULL (Google returned Error Code [7] PERMISSION_DENIED / Session Not Found):
        if (!history) {
          completeGeminiVideoTask(targetOp);
          const refundedUsage = refundAccountDailyUsage(accKey, targetOp);
          console.warn(`[Gemini Video Status] ❌ Sesi ${convId} tidak ditemukan / izin ditolak di Google Gemini (RPC Code [7]). Kuota dikembalikan.`);
          return res.json({
            success: false,
            status: 'failed',
            done: true,
            refunded: true,
            error: 'Sesi pembuatan video tidak ditemukan di akun Google Gemini (Google RPC Code 7 / Permission Denied). Kuota telah dikembalikan.',
            errorMessage: 'Sesi pembuatan video tidak ditemukan di akun Google Gemini (Google RPC Code 7 / Permission Denied). Kuota telah dikembalikan.',
            remainingCredits: refundedUsage.remaining,
            userRemainingCredits: refundedUsage.remaining,
            totalCredits: GEMINI_MAX_CREDITS,
          });
        }
        const video = client.extractVideoFromHistory(history);

        if (video) {
          completeGeminiVideoTask(targetOp);
          const filename = `gemini_veo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp4`;
          const filepath = path.join(mediaCacheDir, filename);
          let finalUrl = video.playbackUrl || video.downloadUrl;
          try {
            await client.downloadMedia(video, filepath);
            finalUrl = `/media-cache/${filename}`;
          } catch (dlErr: any) {
            console.warn('[Gemini Video Status Download Notice]:', dlErr.message || dlErr);
          }
          const completedUsage = cliTestMode
            ? getAccountDailyUsage(accKey)
            : recordSuccessfulGeminiVideo(
                accKey,
                targetOp,
                getGeminiAccountUsageKeys(emailToUse, cookies),
              );
          const elapsedSeconds = tracked?.startTime
            ? Math.round((Date.now() - tracked.startTime) / 1000)
            : undefined;
          console.log(
            `[Gemini Video Status] ✅ Video selesai untuk akun ${emailToUse || 'unknown'} ` +
            `(sesi ${convId}${elapsedSeconds !== undefined ? `, ${elapsedSeconds}s` : ''}). ` +
            `Sisa kredit: ${completedUsage.remaining}/${completedUsage.total}.`
          );
          return res.json({
            success: true,
            status: 'completed',
            done: true,
            videoUrl: finalUrl,
            mediaUrl: finalUrl,
            coverUrl: video.coverUrl,
            remainingCredits: completedUsage.remaining,
            userRemainingCredits: completedUsage.remaining,
            totalCredits: GEMINI_MAX_CREDITS,
          });
        }

        const serverError = client.extractErrorFromHistory ? client.extractErrorFromHistory(history) : null;
        if (serverError) {
          completeGeminiVideoTask(targetOp);
          if (!cliTestMode && !isQuotaExhaustedText(serverError) && !isTemporaryGeminiCapacityText(serverError)) {
            recordFailedGeminiVideoGenerate(accKey, targetOp);
          }
          const refundedUsage = refundAccountDailyUsage(accKey, targetOp);
          return res.json({
            success: false,
            status: 'failed',
            done: true,
            refunded: true,
            error: serverError,
            errorMessage: serverError,
            remainingCredits: refundedUsage.remaining,
            userRemainingCredits: refundedUsage.remaining,
            totalCredits: GEMINI_MAX_CREDITS,
          });
        }

        const refusal = client.extractRefusalFromHistory ? client.extractRefusalFromHistory(history) : null;
        if (refusal) {
          completeGeminiVideoTask(targetOp);
          const isQuota = isQuotaExhaustedText(refusal);
          if (!cliTestMode && !isQuota && !isTemporaryGeminiCapacityText(refusal)) {
            recordFailedGeminiVideoGenerate(accKey, targetOp);
          }
          if (isQuota) {
            logGeminiExternalQuotaRefusal(accKey, refusal, email);
          }
          const refundedUsage = refundAccountDailyUsage(accKey, targetOp);
          const curUsage = getAccountDailyUsage(accKey);
          return res.json({
            success: false,
            status: 'failed',
            done: true,
            refunded: refundedUsage.refunded,
            isQuotaExhausted: isQuota,
            error: refusal,
            errorMessage: refusal,
            remainingCredits: curUsage.remaining,
            userRemainingCredits: curUsage.remaining,
            totalCredits: GEMINI_MAX_CREDITS,
            exhaustedAccounts: isQuota ? [{ id: req.body.id, email: email, reason: refusal, isQuotaExhausted: true }] : [],
          });
        }

        const { isRefusalOrErrorText: checkRefusalOrError } = require('../../script-gemini/gemini_chat.cjs');
        const assistantText = client.extractLatestAssistantText ? client.extractLatestAssistantText(history) : null;

        // Cek langsung jika respons asisten menyatakan kegagalan (traffic tinggi, kapasitas penuh, penolakan, batas kuota, dll.)
        if (assistantText && checkRefusalOrError(assistantText)) {
          completeGeminiVideoTask(targetOp);
          const isQuota = isQuotaExhaustedText(assistantText);
          if (!cliTestMode && !isQuota && !isTemporaryGeminiCapacityText(assistantText)) {
            recordFailedGeminiVideoGenerate(accKey, targetOp);
          }
          if (isQuota) {
            logGeminiExternalQuotaRefusal(accKey, assistantText, email);
          }
          const refundedUsage = refundAccountDailyUsage(accKey, targetOp);
          const curUsage = getAccountDailyUsage(accKey);
          console.warn(`[Gemini Video] ❌ Terdeteksi kegagalan pada teks asisten (${targetOp}): ${assistantText}`);
          return res.json({
            success: false,
            status: 'failed',
            done: true,
            refunded: refundedUsage.refunded,
            isQuotaExhausted: isQuota,
            error: assistantText,
            errorMessage: assistantText,
            remainingCredits: curUsage.remaining,
            userRemainingCredits: curUsage.remaining,
            totalCredits: GEMINI_MAX_CREDITS,
            exhaustedAccounts: isQuota ? [{ id: req.body.id, email: email, reason: assistantText, isQuotaExhausted: true }] : [],
          });
        }

        // Lacak waktu berlangsungnya task video
        let taskInfo = webVideoTaskTracker.get(targetOp);
        if (!taskInfo) {
          const requestedStartTime = Number(startedAt);
          taskInfo = {
            startTime:
              Number.isFinite(requestedStartTime) &&
              requestedStartTime > 0 &&
              requestedStartTime <= Date.now()
                ? requestedStartTime
                : Date.now(),
            convId,
            accountKey: accKey,
            cookies,
            email: emailToUse,
          };
          webVideoTaskTracker.set(targetOp, taskInfo);
        }
        touchGeminiVideoAccountLock(targetOp);
        const elapsedSeconds = Math.round((Date.now() - taskInfo.startTime) / 1000);

        const isStillActive = client.isVideoGeneratingActive ? client.isVideoGeneratingActive(history) : false;
        const isProgressText = isProgressNoticeText(assistantText) || (client.isProgressNoticeText ? client.isProgressNoticeText(assistantText) : false);
        const isMetaOnly = isModelOrMetaTokenText(assistantText);
        const hasRefusalOrError = checkRefusalOrError(assistantText || '');
        const isPlainChatText = Boolean(assistantText && !isMetaOnly && !isProgressText);

        if (isPlainChatText) {
          console.warn(
            `[Gemini Video Status] ❌ Respons assistant bukan status render untuk ${targetOp}: ${assistantText.slice(0, 200)}`,
          );
        }

        // Keep polling only when Gemini explicitly reports an active video task.
        const isActivelyRendering =
          elapsedSeconds * 1000 < MAX_GEMINI_VIDEO_TASK_AGE_MS &&
          !hasRefusalOrError &&
          !isPlainChatText &&
          (isStillActive || isProgressText);

        if (isActivelyRendering) {
          if (elapsedSeconds % 10 === 0 || elapsedSeconds <= 12) {
            console.log(`[Gemini Video Status] ⏳ Video masih dirender di background sesi ${convId} (${elapsedSeconds}s)...`);
          }
          return res.json({
            success: true,
            status: 'processing',
            done: false,
            elapsedSeconds,
            remainingCredits: usage.remaining,
            userRemainingCredits: usage.remaining,
            totalCredits: GEMINI_MAX_CREDITS,
          });
        }

        // JIKA TIDAK ADA PROSES RENDER VIDEO YANG AKTIF DAN TIDAK ADA FILE VIDEO:
        // (Berarti Google Gemini selesai tetapi merespons teks biasa atau penolakan, bukan video)
        completeGeminiVideoTask(targetOp);
        const isQuota = isQuotaExhaustedText(assistantText);
        if (isQuota) {
          logGeminiExternalQuotaRefusal(accKey, assistantText, emailToUse);
        }
        const refundedUsage = refundAccountDailyUsage(accKey, targetOp);
        const curUsage = getAccountDailyUsage(accKey);
        const failMsg = !assistantText
          ? 'Gemini tidak memberikan respons atau sinyal bahwa generasi video dimulai. Task dihentikan tanpa melanjutkan polling render.'
          : assistantText && !isMetaOnly && !isProgressText
          ? (isQuota ? assistantText : `Google Gemini merespons teks biasa, bukan hasil video generate: "${assistantText.slice(0, 160)}"`)
          : (elapsedSeconds * 1000 >= MAX_GEMINI_VIDEO_TASK_AGE_MS
              ? 'Waktu pembuatan video Google Veo melebihi batas waktu 8 menit. Silakan coba lagi.'
              : 'Google Gemini merespons bukan hasil video generate (selesai tanpa file video).');
        if (
          !cliTestMode &&
          assistantText &&
          !isQuota &&
          !isTemporaryGeminiCapacityText(assistantText) &&
          elapsedSeconds * 1000 < MAX_GEMINI_VIDEO_TASK_AGE_MS
        ) {
          recordFailedGeminiVideoGenerate(accKey, targetOp);
        }
        console.warn(`[Gemini Video Status] ❌ Gagal: ${failMsg}`);
        return res.json({
          success: false,
          status: 'failed',
          done: true,
          refunded: refundedUsage.refunded,
          failureSource: 'generation_not_confirmed',
          isQuotaExhausted: isQuota,
          error: failMsg,
          errorMessage: failMsg,
          remainingCredits: curUsage.remaining,
          userRemainingCredits: curUsage.remaining,
          totalCredits: GEMINI_MAX_CREDITS,
        });
      } catch (err: any) {
        const errorMessage = err.message || 'Gagal memantau status video Gemini Web.';
        console.warn(`[Gemini Video Status] ⚠️ Poll belum dapat memastikan status ${targetOp}; lock akun tetap aktif: ${errorMessage}`);
        touchGeminiVideoAccountLock(targetOp);
        return res.json({
          success: true,
          status: 'processing',
          done: false,
          statusUnknown: true,
          error: 'Status video belum dapat dipastikan. Task tetap dipantau dan akun masih dikunci.',
          errorMessage,
          remainingCredits: usage.remaining,
          userRemainingCredits: usage.remaining,
          totalCredits: GEMINI_MAX_CREDITS,
        });
      }
    }

    return res.json({
      success: false,
      status: 'failed',
      done: true,
      error: 'Target operasi tidak valid.',
      remainingCredits: usage.remaining,
      userRemainingCredits: usage.remaining,
      totalCredits: GEMINI_MAX_CREDITS,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message, errorMessage: err.message });
  }
});

// POST /api/gemini/accounts/refund - Manual / client error refund fallback endpoint
router.post('/gemini/accounts/refund', async (req, res) => {
  try {
    const { token, apiKey: customApiKey, cookies: customCookies, email, taskId } = req.body || {};
    const rawToken = String(token || '').trim();
    const isApiKey = (customApiKey || (rawToken.startsWith('AIza') && rawToken.length >= 30)) ? (customApiKey || rawToken) : undefined;
    const cookies = customCookies || (rawToken.includes('__Secure') || rawToken.includes('SID=') || rawToken.includes('SAPISID=') ? rawToken : undefined);
    const accKey = getGeminiAccountIdentifier(cookies, isApiKey, email);
    const result = refundAccountDailyUsage(accKey, taskId);
    return res.json({
      success: true,
      remainingCredits: result.remaining,
      totalCredits: result.total,
      usedToday: result.used,
      message: 'Kredit akun berhasil dikembalikan (refund).',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
