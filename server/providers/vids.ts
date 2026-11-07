/**
 * =========================================================================================
 * GOOGLE VIDS PROVIDER ROUTER — NATIVE WORKSPACE AI VIDEO GENERATION ENGINE
 * =========================================================================================
 * Integrates Google Vids (appsgenaiserver-pa.clients6.google.com) using
 * user's Google session cookies, SAPISIDHASH auth headers, and Workspace Flix document context.
 * =========================================================================================
 */

import { Router } from 'express';
import multer from 'multer';
import { spawn } from 'child_process';
import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const router = Router();

const mediaCacheDir = path.join(process.cwd(), 'media-cache');
if (!fs.existsSync(mediaCacheDir)) {
  fs.mkdirSync(mediaCacheDir, { recursive: true });
}

const cacheImportedVideoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, os.tmpdir()),
    filename: (_req, _file, callback) =>
      callback(null, `canvas-video-${crypto.randomBytes(12).toString('hex')}.tmp`),
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const VIDS_SESSIONS_FILE = path.join(process.cwd(), 'data', 'vids_sessions.json');
const VIDS_CONFIG_FALLBACK = path.join(process.cwd(), 'script-vids', 'config.json');

// Default API Key Google Workspace GenAI Server
const VIDS_API_KEY = 'AIzaSyA-njTXslyyMKk1VOogRfVP59F6fNGeNW8';
const DEFAULT_VIDS_DOC_ID = '1Q7x7neLElTHJhtGL8oDX2xVadKOV0WdQXU_uoMh1DzM';

export interface VidsAccountSession {
  email: string;
  name?: string;
  photoUrl?: string;
  cookies: string;
  docId: string;
  serverToken?: string;
  credits: number;
  totalCredits: number;
  lastChecked?: string;
  accountStatus?: 'active' | 'expired' | 'banned' | 'error';
  statusMessage?: string;
}

// Helper: Membaca cache sesi Google Vids
export function readAllVidsSessions(): Record<string, VidsAccountSession> {
  try {
    if (fs.existsSync(VIDS_SESSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(VIDS_SESSIONS_FILE, 'utf-8')) || {};
    }
  } catch (e) {}

  // Migrate the legacy script config once. Saving it makes this file authoritative,
  // so deleting the migrated account cannot bring it back from the fallback.
  try {
    if (fs.existsSync(VIDS_CONFIG_FALLBACK)) {
      const cfg = JSON.parse(fs.readFileSync(VIDS_CONFIG_FALLBACK, 'utf-8'));
      if (cfg.email && cfg.cookies) {
        const migrated = {
          [cfg.email.toLowerCase().trim()]: {
            email: cfg.email,
            name: 'Google Vids User',
            cookies: cfg.cookies,
            docId: cfg.docId || '',
            serverToken: cfg.serverToken || '',
            credits: 60,
            totalCredits: 60,
            lastChecked: new Date().toISOString(),
          },
        };
        saveVidsSessions(migrated);
        return migrated;
      }
    }
  } catch (e) {}

  return {};
}

// Helper: Menyimpan cache sesi Google Vids
export function saveVidsSessions(data: Record<string, VidsAccountSession>) {
  try {
    const dir = path.dirname(VIDS_SESSIONS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(VIDS_SESSIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Google Vids] Failed to save account sessions:', error);
    throw new Error('Gagal menyimpan data sesi akun Google Vids.');
  }
}

// Helper: Ekstraksi autentikasi dari input (cURL / raw Cookie / JSON)
export function extractVidsAuth(input: string): {
  cookies?: string;
  serverToken?: string;
  docId?: string;
} {
  if (!input || typeof input !== 'string') return {};
  const trimmed = input.trim();
  let cookies = '';
  let serverToken = '';
  let docId = '';

  // 1. Ekstraksi Cookie (-b atau --cookie atau header Cookie)
  const bMatch = trimmed.match(/(?:-b|--cookie)\s+(?:\$'([^']+)'|'([^']+)'|"([^"]+)"|([^\s\r\n\\]+))/i);
  if (bMatch) cookies = bMatch[1] || bMatch[2] || bMatch[3] || bMatch[4] || '';

  if (!cookies) {
    const hMatch = trimmed.match(/-H\s+['"][Cc]ookie:\s*([^'"]+)['"]/i);
    if (hMatch) cookies = hMatch[1];
  }

  // Jika input langsung berupa string cookie key=val
  if (!cookies && trimmed.includes('SAPISID=')) {
    cookies = trimmed;
  }

  // 2. Ekstraksi x-server-token
  const tokenMatch = trimmed.match(/x-server-token:\s*([^\s'"]+)/i);
  if (tokenMatch) serverToken = tokenMatch[1].trim();

  if (!serverToken) {
    const dataTokenMatch = trimmed.match(/["'](CAMS[A-Za-z0-9_-]{20,80}={0,2})["']/);
    if (dataTokenMatch) serverToken = dataTokenMatch[1].trim();
  }

  // 3. Ekstraksi Document ID Google Vids (.flix)
  const docMatch = trimmed.match(/["']([a-zA-Z0-9_-]{35,55})["']\s*,\s*["']application\/vnd\.google-apps\.flix["']/);
  if (docMatch) docId = docMatch[1].trim();

  if (!docId) {
    const urlDocMatch = trimmed.match(/docs\.google\.com\/videos\/(?:d\/|u\/\d+\/d\/)?([a-zA-Z0-9_-]{35,55})/i);
    if (urlDocMatch) docId = urlDocMatch[1].trim();
  }

  return { cookies, serverToken, docId };
}

function normalizeVidsCookies(input: string): string {
  const extractedCookies = extractVidsAuth(input).cookies;
  const cookies = (extractedCookies || input).replace(/[\r\n]/g, '').trim();
  if (/[^\x20-\x7E\x80-\xFF]/.test(cookies)) {
    throw new Error('Cookie Google Vids berisi karakter header yang tidak didukung.');
  }
  return cookies;
}

// Helper: Membuat header SAPISIDHASH Google Web standard
export function generateSapisidHash(cookies: string, origin = 'https://docs.google.com'): string | null {
  const match = cookies.match(/(?:^|;\s*)SAPISID=([^;]+)/);
  if (!match) return null;
  const sapisid = match[1].trim();
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1').update(`${timestamp} ${sapisid} ${origin}`).digest('hex');
  return `SAPISIDHASH ${timestamp}_${hash} SAPISID1PHASH ${timestamp}_${hash} SAPISID3PHASH ${timestamp}_${hash}`;
}

// Helper: Mengambil kuota spesifik per opcode/SKU
function queryQuotaForCode(
  cookies: string,
  code: number
): Promise<{ limit: number; remaining: number; resetEpoch: number | null } | null> {
  return new Promise((resolve) => {
    const auth = generateSapisidHash(cookies);
    if (!auth) return resolve(null);
    const body = JSON.stringify([null, 1, [9], code, null, [[null, '1', 1189]]]);
    const req = https.request(
      {
        hostname: 'appsgenaiserver-pa.clients6.google.com',
        path: `/v1/genai/quotaSummary?key=${VIDS_API_KEY}`,
        method: 'POST',
        headers: {
          'accept': '*/*',
          'authorization': auth,
          'content-type': 'application/json+protobuf',
          'cookie': cookies,
          'origin': 'https://docs.google.com',
          'referer': 'https://docs.google.com/',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
          'x-goog-authuser': '0',
          'Content-Length': String(Buffer.byteLength(body)),
        },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try {
            const q = JSON.parse(d)?.[0]?.[1];
            if (!q) return resolve(null);
            resolve({
              limit: Number(q[0]) || 0,
              remaining: Number(q[2]) || 0,
              resetEpoch: Number(q[6]?.[0]) || null,
            });
          } catch (e) {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(20000, () => {
      req.destroy();
      resolve(null);
    });
    req.write(body);
    req.end();
  });
}

// Helper: Mengambil kuota akun dari endpoint resmi Google Vids quotaSummary.
// Cek Opcode 374 terlebih dahulu (Workspace / SKU 36, kuota 500 kredit),
// lalu fallback ke Opcode 389 (Consumer / SKU 51, kuota 60 kredit).
export async function fetchQuotaSummary(
  cookies: string
): Promise<{ limit: number; remaining: number; resetEpoch: number | null } | null> {
  for (const code of [374, 389]) {
    const quota = await queryQuotaForCode(cookies, code);
    if (quota && quota.limit > 0) return quota;
    if (quota && code === 389) return quota;
  }
  return null;
}

// Helper: Cek nama dan foto profil akun Google via ListAccounts
export async function fetchGoogleUserProfile(cookies: string): Promise<{ email?: string; name?: string; photoUrl?: string }> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'accounts.google.com',
        path: '/ListAccounts?source=ogb&json=standard',
        method: 'GET',
        maxHeaderSize: 1048576,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
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
                const jsonStr = sub.slice(0, endIdx).replace(/\\'/g, "'").replace(/\\\\/g, '\\');
                const parsed = JSON.parse(jsonStr);
                const users = parsed?.[1] || [];
                if (users.length > 0) {
                  const first = users[0];
                  return resolve({
                    email: first[3],
                    name: first[2],
                    photoUrl: first[4],
                  });
                }
              }
            }
          } catch (e) {}

          // Fallback ke OGS Widget jika ListAccounts kosong
          try {
            const auth = generateSapisidHash(cookies, 'https://www.google.com');
            const ogsReq = https.get(
              {
                hostname: 'ogs.google.com',
                path: '/u/0/widget/app',
                headers: {
                  Cookie: cookies,
                  authorization: auth || '',
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
                  Accept: '*/*',
                },
              },
              (ogsRes) => {
                let ogsData = '';
                ogsRes.on('data', (c) => (ogsData += c));
                ogsRes.on('end', () => {
                  const emails = ogsData.match(/[a-zA-Z0-9._%+-]+@(gmail\.com|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);
                  if (emails && emails.length > 0) {
                    return resolve({
                      email: emails[0],
                      name: emails[0].split('@')[0],
                    });
                  }
                  resolve({});
                });
              }
            );
            ogsReq.on('error', () => resolve({}));
            return;
          } catch (_) {}

          resolve({});
        });
      }
    );
    req.on('error', () => resolve({}));
    req.end();
  });
}

// Helper: Upload file gambar ke Google Vids temporaryblob storage
async function uploadImageToTemporaryBlob(
  imageBuffer: Buffer,
  cookies: string,
  docId: string
): Promise<string> {
  const md5Hash = crypto.createHash('md5').update(imageBuffer).digest('hex');

  // Step 1: Start Resumable Upload Session
  const uploadUrl = await new Promise<string>((resolve, reject) => {
    const req = https.request(
      'https://docs.google.com/upload/temporaryblob/videos?authuser=0',
      {
        method: 'POST',
        headers: {
          'cookie': cookies,
          'origin': 'https://docs.google.com',
          'referer': `https://docs.google.com/videos/d/${docId}/edit`,
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
          'x-goog-upload-command': 'start',
          'x-goog-upload-content-length': String(imageBuffer.length),
          'x-goog-upload-file-name': 'temporary_blob',
          'x-goog-upload-protocol': 'resumable',
        },
      },
      (res) => {
        const url = res.headers['x-goog-upload-url'] as string;
        if (res.statusCode === 200 && url) {
          resolve(url);
        } else {
          let errData = '';
          res.on('data', (c) => (errData += c));
          res.on('end', () => {
            reject(new Error(`Gagal inisiasi upload gambar (HTTP ${res.statusCode}): ${errData}`));
          });
        }
      }
    );
    req.on('error', reject);
    req.end();
  });

  // Step 2: Transfer Image Binary Data and Finalize
  const token = await new Promise<string>((resolve, reject) => {
    const req = https.request(
      uploadUrl,
      {
        method: 'PUT',
        headers: {
          'cookie': cookies,
          'origin': 'https://docs.google.com',
          'referer': `https://docs.google.com/videos/d/${docId}/edit`,
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
          'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
          'x-goog-upload-command': 'upload, finalize',
          'x-goog-upload-entity-md5': md5Hash,
          'x-goog-upload-offset': '0',
          'content-length': String(imageBuffer.length),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Gagal transfer data gambar ke Google Vids (HTTP ${res.statusCode}): ${body}`));
          }
          try {
            const parsed = JSON.parse(body);
            if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
              return resolve(parsed[0]);
            }
            if (typeof parsed === 'string') {
              return resolve(parsed);
            }
            const match = body.match(/AYGXpj[a-zA-Z0-9_\-]+/);
            if (match) return resolve(match[0]);
            reject(new Error(`Format token blob tidak dikenali: ${body}`));
          } catch (e: any) {
            const match = body.match(/AYGXpj[a-zA-Z0-9_\-]+/);
            if (match) return resolve(match[0]);
            reject(new Error(`Gagal membaca token respon upload gambar: ${e.message}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(imageBuffer);
    req.end();
  });

  return token;
}

// Helper: Menyelesaikan input gambar menjadi Buffer binary
async function resolveImageBuffer(
  referenceImageData?: string,
  referenceImageUrl?: string,
  image?: string
): Promise<Buffer | null> {
  const candidate = referenceImageData || image || referenceImageUrl;
  if (!candidate || typeof candidate !== 'string') return null;

  // Base64 Data URL
  if (candidate.startsWith('data:')) {
    const base64Data = candidate.includes(';base64,')
      ? candidate.split(';base64,')[1]
      : candidate.replace(/^data:[^;]+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  }

  // Raw base64 string
  if (!candidate.startsWith('http') && !candidate.startsWith('/') && candidate.length > 200) {
    try {
      return Buffer.from(candidate, 'base64');
    } catch (_) {}
  }

  // File cache lokal
  if (candidate.startsWith('/media-cache/') || candidate.includes('media-cache')) {
    const filename = path.basename(candidate);
    const localPath = path.join(mediaCacheDir, filename);
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath);
    }
  }

  // URL remote HTTP / HTTPS
  if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
    try {
      const response = await fetch(candidate);
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (e: any) {
      console.warn(`[Google Vids] Gagal mengunduh referensi gambar dari URL: ${e.message}`);
    }
  }

  // Path file lokal di disk
  if (fs.existsSync(candidate)) {
    try {
      return fs.readFileSync(candidate);
    } catch (_) {}
  }

  return null;
}

// Helper: Membangun array payload Protobuf JSON
// Opcode 374: Versi RPC Google Vids modern (Workspace GenAI / 500 kredit)
// Opcode 386: Versi RPC Google Vids legacy (Consumer GenAI / 60 kredit)
// Opcode 376: Versi RPC Google Vids Image-to-Video multimodal
function buildProtobufPayload(
  prompt: string,
  duration: number,
  docId: string,
  aspectRatio: '9:16' | '16:9',
  resolution: '720p' | '1080p',
  opcode = 374,
  imageBlobToken?: string
): any[] {
  const aspectRatioCode = 12;
  const resolutionCode = resolution === '1080p' ? 6 : (aspectRatio === '16:9' ? 1 : 2);
  const clientReqId = `goog_${Math.floor(Math.random() * 900000000 + 100000000)}`;

  const ctx: any[] = [];
  ctx[0] = 9; // Vids App ID
  ctx[4] = clientReqId;
  ctx[6] = '0'; // authuser index
  ctx[8] = [
    null, null, null,
    [[[
      null, null, null, null, null, null, null,
      [
        null, null,
        [[
          docId,
          'application/vnd.google-apps.flix',
          null, null, 1
        ]]
      ]
    ]]]
  ];
  ctx[11] = [24, 0];
  ctx[13] = 'en';
  ctx[19] = 1;

  // Mode Image-to-Video (Opcode 376)
  if (imageBlobToken) {
    const imageUuid = crypto.randomUUID().toUpperCase();
    ctx[25] = [
      [
        [
          null, null, null, null, null, null, null,
          [
            imageUuid,
            [
              null, null, null, null, null, null, null, null, null, null, null,
              [
                null, null, null, null, null, null, null, null,
                [
                  null, null, null,
                  imageBlobToken,
                  1
                ],
                null, null, null, null,
                'Image1'
              ]
            ]
          ]
        ]
      ]
    ];
    ctx[34] = 'Asia/Jakarta';
    ctx[40] = 0;

    const promptSlot = prompt.trim()
      ? [
          null, null, null,
          [
            [
              [
                null, null, null, null, null, null, null,
                [
                  null,
                  [null, null, 'Image1'],
                  [null, null, null, null, null, null, null, [imageUuid]]
                ]
              ],
              [null, null, ' '],
              [null, null, prompt.trim()]
            ]
          ]
        ]
      : [
          null, null, null,
          [
            [
              [
                null, null, null, null, null, null, null,
                [
                  null,
                  [null, null, 'Image1'],
                  [null, null, null, null, null, null, null, [imageUuid]]
                ]
              ]
            ]
          ]
        ];

    return [
      376,
      null,
      ctx,
      promptSlot,
      [
        null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        [0, aspectRatioCode, null, 0, resolutionCode, null, null, null, duration]
      ],
      [
        1,
        null,
        [[null, '1', 1189]]
      ],
      1
    ];
  }

  // Mode Text-to-Video biasa (Opcode 374 / 386)
  ctx[34] = 'Asia/Jakarta';
  ctx[40] = 0;

  return [
    opcode,
    null,
    ctx,
    [
      null, null, null,
      [[[null, null, prompt]]]
    ],
    [
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      [0, aspectRatioCode, null, 0, resolutionCode, null, null, null, duration]
    ],
    [
      1,
      null,
      [[null, '1', 1189]]
    ],
    1
  ];
}

function executeVidsGenerateRpc(
  prompt: string,
  duration: number,
  docId: string,
  cookies: string,
  serverToken: string | undefined,
  aspectRatio: '9:16' | '16:9',
  resolution: '720p' | '1080p',
  opcode: number,
  authHeader: string,
  imageBlobToken?: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(
      buildProtobufPayload(prompt, duration, docId, aspectRatio, resolution, opcode, imageBlobToken)
    );
    const url = `https://appsgenaiserver-pa.clients6.google.com/v1/genai/generate?key=${VIDS_API_KEY}`;
    const urlObj = new URL(url);

    const headers: Record<string, string> = {
      'accept': '*/*',
      'accept-language': 'en',
      'authorization': authHeader,
      'content-type': 'application/json+protobuf',
      'cookie': cookies,
      'origin': 'https://docs.google.com',
      'referer': 'https://docs.google.com/',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
      'x-goog-authuser': '0',
      'Content-Length': String(Buffer.byteLength(payload)),
    };

    if (serverToken) {
      headers['x-server-token'] = serverToken;
    }

    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers,
        timeout: 180000, // Timeout 3 menit untuk render video
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(
              new Error(`Google Vids AI (Opcode ${opcode}) gagal dengan HTTP ${res.statusCode}: ${data.slice(0, 300)}`)
            );
          }
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e: any) {
            reject(new Error(`Gagal mem-parsing respon JSON Google Vids: ${e.message}`));
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Koneksi timeout (lebih dari 3 menit) saat menunggu render video Google Vids.'));
    });

    req.write(payload);
    req.end();
  });
}

// Helper: Kirim request generate video ke server Google Vids (Held Connection)
// Jika ada imageBlobToken, langsung gunakan Opcode 376 (Image-to-Video)
// Jika tidak ada gambar, coba Opcode 374 lebih dahulu, lalu fallback ke Opcode 386
async function sendVidsGenerateRequest(
  prompt: string,
  duration: number,
  docId: string,
  cookies: string,
  serverToken: string | undefined,
  aspectRatio: '9:16' | '16:9',
  resolution: '720p' | '1080p',
  imageBlobToken?: string
): Promise<any> {
  const authHeader = generateSapisidHash(cookies);
  if (!authHeader) {
    throw new Error('Cookie SAPISID tidak valid untuk otentikasi Google Vids.');
  }

  // Jika Image-to-Video, gunakan Opcode 376
  if (imageBlobToken) {
    return await executeVidsGenerateRpc(
      prompt,
      duration,
      docId,
      cookies,
      serverToken,
      aspectRatio,
      resolution,
      376,
      authHeader,
      imageBlobToken
    );
  }

  let firstError: Error | null = null;
  let lastError: Error | null = null;
  for (const opcode of [374, 386]) {
    try {
      return await executeVidsGenerateRpc(
        prompt,
        duration,
        docId,
        cookies,
        serverToken,
        aspectRatio,
        resolution,
        opcode,
        authHeader
      );
    } catch (err: any) {
      if (!firstError) firstError = err;
      lastError = err;
      console.warn(`[Google Vids] RPC Opcode ${opcode} gagal: ${err.message}. Mencoba fallback jika ada...`);
    }
  }

  throw firstError || lastError || new Error('Gagal memproses request generate video Google Vids.');
}

// Helper: Ekstraksi URL Video dari respon Google
function extractVideoDownloadUrl(data: any): string | null {
  try {
    const candidate = data?.[0]?.[0]?.[0]?.[0]?.[0]?.[6]?.[4];
    if (typeof candidate === 'string' && candidate.startsWith('https://')) {
      return candidate;
    }
  } catch (e) {}

  const str = JSON.stringify(data);
  const match = str.match(/https:\/\/contribution-rt\.usercontent\.google\.com\/download\?[^"'\\]+/);
  return match ? match[0] : null;
}

// Helper: Ekstraksi Kuota dari respon Google
function extractQuota(data: any): { total: number; remaining: number; cost: number } {
  try {
    const q = data?.[4]?.[0];
    if (q) {
      const total = parseInt(q[1]?.[0] || '60', 10);
      const remaining = parseInt(q[1]?.[2] || '0', 10);
      const cost = parseInt(q[2] || '60', 10);
      return { total, remaining, cost };
    }
  } catch (e) {}
  return { total: 60, remaining: 0, cost: 60 };
}

// Helper: Download file video MP4 dan simpan ke media-cache lokal
function downloadVideoToMediaCache(videoUrl: string, cookies: string, filename: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const filePath = path.join(mediaCacheDir, filename);
    const fileStream = fs.createWriteStream(filePath);
    let totalBytes = 0;

    // Filter cookie: usercontent.google.com menolak OSID docs.google.com dengan HTTP 403
    const downloadCookies = cookies
      .split(';')
      .map((c) => c.trim())
      .filter((c) => c && !/^(?:__Secure-)?OSID=/i.test(c))
      .join('; ');

    const executeDownload = (targetUrl: string, redirectCount = 0) => {
      if (redirectCount > 5) {
        fileStream.close();
        try { fs.unlinkSync(filePath); } catch (_) {}
        return reject(new Error('Terlalu banyak redirect saat mengunduh video Google Vids.'));
      }

      const req = https.get(
        targetUrl,
        {
          headers: {
            Cookie: downloadCookies,
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
            Referer: 'https://docs.google.com/',
          },
        },
        (res) => {
          if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, targetUrl).toString();
            return executeDownload(redirectUrl, redirectCount + 1);
          }

          if (res.statusCode !== 200) {
            fileStream.close();
            try { fs.unlinkSync(filePath); } catch (_) {}
            return reject(new Error(`Gagal mengunduh file video dari server Google. HTTP Status: ${res.statusCode}`));
          }

          res.on('data', (chunk) => {
            totalBytes += chunk.length;
            fileStream.write(chunk);
          });

          res.on('end', () => {
            fileStream.end();
            resolve(totalBytes);
          });
        }
      );

      req.on('error', (err) => {
        fileStream.close();
        try { fs.unlinkSync(filePath); } catch (_) {}
        reject(err);
      });
    };

    executeDownload(videoUrl);
  });
}

// =========================================================================================
// ROUTER ENDPOINTS
// =========================================================================================

// 0. GET /api/vids/accounts — Mengambil seluruh sesi & status akun Google Vids dari server
router.get('/vids/accounts', (_req, res) => {
  try {
    const sessions = readAllVidsSessions();
    return res.json({
      success: true,
      sessions,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 1. POST /api/vids/accounts/verify — Verifikasi dan simpan akun Google Vids
router.post('/vids/accounts/verify', async (req, res) => {
  try {
    const rawInput = String(req.body.token || req.body.cookies || '').trim();
    const customEmail = String(req.body.email || '').trim().toLowerCase();
    const customLabel = String(req.body.nickname || req.body.name || '').trim();
    const customDocId = String(req.body.docId || '').trim();

    const sessions = readAllVidsSessions();
    const existing = customEmail ? sessions[customEmail] : undefined;

    const extracted = extractVidsAuth(rawInput);
    let cookies = normalizeVidsCookies(extracted.cookies || rawInput);
    if (!cookies && existing?.cookies) {
      cookies = normalizeVidsCookies(existing.cookies);
    }
    const serverToken = extracted.serverToken || String(req.body.serverToken || '').trim() || existing?.serverToken || '';
    const docId = extracted.docId || customDocId || existing?.docId || DEFAULT_VIDS_DOC_ID;

    if (!cookies) {
      return res.status(400).json({
        success: false,
        error: 'Cookie atau cURL Google Vids wajib disertakan.',
      });
    }

    const profile = await fetchGoogleUserProfile(cookies);
    const resolvedEmail = customEmail || profile.email || 'vids.user@google.com';
    const resolvedName = customLabel || profile.name || 'Google Vids User';

    // Ambil kuota live langsung dari Google Vids server (mendukung 500 kredit / 60 kredit)
    const liveQuota = await fetchQuotaSummary(cookies);

    if (!liveQuota || typeof liveQuota.remaining !== 'number') {
      const emailKey = (customEmail || resolvedEmail).toLowerCase();
      const updatedAccount: VidsAccountSession = existing ? { ...existing } : {
        email: customEmail || resolvedEmail,
        name: customLabel || resolvedName,
        cookies,
        docId: docId || '',
        serverToken: serverToken || '',
        credits: 0,
        totalCredits: 500,
        accountStatus: 'expired',
      };
      updatedAccount.credits = 0;
      updatedAccount.accountStatus = 'expired';
      updatedAccount.statusMessage = 'Sesi Google Vids kedaluwarsa atau ditolak server Google (kuota tidak terbaca).';
      updatedAccount.lastChecked = new Date().toISOString();
      sessions[emailKey] = updatedAccount;
      saveVidsSessions(sessions);

      return res.status(401).json({
        success: false,
        accountStatus: 'expired',
        statusMessage: 'Sesi Kedaluwarsa / Kuota Tidak Terbaca (Perlu Relogin)',
        credits: 0,
        totalCredits: 500,
        error: 'Sesi Google Vids kedaluwarsa atau ditolak server Google (kuota tidak terbaca). Silakan lakukan Relogin akun ini.',
      });
    }

    const sessionData: VidsAccountSession = {
      email: resolvedEmail,
      name: resolvedName,
      photoUrl: profile.photoUrl || existing?.photoUrl,
      cookies,
      docId: docId || existing?.docId || '',
      serverToken: serverToken || existing?.serverToken || '',
      credits: liveQuota.remaining,
      totalCredits: liveQuota.limit,
      accountStatus: 'active',
      lastChecked: new Date().toISOString(),
    };

    sessions[resolvedEmail.toLowerCase()] = sessionData;
    saveVidsSessions(sessions);

    return res.json({
      success: true,
      accountStatus: 'active',
      email: resolvedEmail,
      name: resolvedName,
      photoUrl: sessionData.photoUrl,
      cookies: sessionData.cookies,
      docId: sessionData.docId,
      serverToken: sessionData.serverToken,
      credits: sessionData.credits,
      totalCredits: sessionData.totalCredits,
      message: 'Akun Google Vids berhasil diverifikasi dan terhubung!',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Gagal memverifikasi akun Google Vids.',
    });
  }
});

// Remove a Google Vids session from the server-side account store.
router.post('/vids/accounts/delete', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'Email akun Google Vids tidak valid.' });
  }

  const sessions = readAllVidsSessions();
  const deleted = Object.prototype.hasOwnProperty.call(sessions, email);
  if (deleted) {
    delete sessions[email];
    saveVidsSessions(sessions);
  }

  return res.json({ success: true, deleted, email });
});

// =========================================================================================
// GOOGLE VIDS PLAYWRIGHT AUTOMATION ENDPOINTS
// =========================================================================================

type VidsPlaywrightManager = typeof import('../services/vidsPlaywright').vidsPlaywrightManager;
let vidsPlaywrightManagerInstance: VidsPlaywrightManager | null = null;
function getVidsPlaywrightManager(): VidsPlaywrightManager {
  if (!vidsPlaywrightManagerInstance) {
    vidsPlaywrightManagerInstance = require('../services/vidsPlaywright').vidsPlaywrightManager;
  }
  return vidsPlaywrightManagerInstance!;
}

// POST /api/vids/playwright/profile/delete
router.post('/vids/playwright/profile/delete', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    await getVidsPlaywrightManager().deleteProfile(email);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Gagal menghapus profil browser Google Vids.',
    });
  }
});

// POST /api/vids/playwright/profile/open
router.post('/vids/playwright/profile/open', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    await getVidsPlaywrightManager().openBrowserProfile(email);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Gagal membuka profil browser Google Vids.',
    });
  }
});

// POST /api/vids/playwright/start
router.post('/vids/playwright/start', async (req, res) => {
  try {
    const { email, password, recoveryEmail, customLabel } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email dan kata sandi Google wajib diisi untuk otomasi login Playwright.',
      });
    }

    const startRes = await getVidsPlaywrightManager().startLogin({
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
      error: err.message || 'Gagal memulai otomasi browser Playwright Google Vids.',
    });
  }
});

// POST /api/vids/playwright/relogin
router.post('/vids/playwright/relogin', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Alamat email Google tidak valid.' });
    }

    const credentials = await getVidsPlaywrightManager().getSavedCredentials(email);
    if (!credentials) {
      return res.status(404).json({
        success: false,
        error: 'Kredensial untuk profil ini belum tersimpan. Tambahkan akun melalui Playwright terlebih dahulu.',
      });
    }

    const startRes = await getVidsPlaywrightManager().startLogin({
      email,
      password: credentials.password,
    });
    return res.json({ success: true, ...startRes });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Gagal memulai relogin Google Vids.',
    });
  }
});

// POST /api/vids/playwright/start-batch
router.post('/vids/playwright/start-batch', async (req, res) => {
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
        error: 'Password wajib diisi untuk semua email dalam batch Google Vids.',
      });
    }

    const existingEmails = Array.isArray(req.body?.existingEmails)
      ? req.body.existingEmails.map((e: any) => String(e).trim()).filter(Boolean)
      : undefined;

    const batchResult = await getVidsPlaywrightManager().startBatchLogin({
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
      error: err.message || 'Gagal memulai batch Playwright Google Vids.',
    });
  }
});

// GET /api/vids/playwright/batch-status/:batchId
router.get('/vids/playwright/batch-status/:batchId', (req, res) => {
  const batch = getVidsPlaywrightManager().getBatch(req.params.batchId);
  if (!batch) {
    return res.status(404).json({ success: false, error: 'Sesi batch Playwright tidak ditemukan atau kedaluwarsa.' });
  }
  return res.json({ success: true, ...batch });
});

// GET /api/vids/playwright/status/:sessionId
router.get('/vids/playwright/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = getVidsPlaywrightManager().getSession(sessionId);

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

// POST /api/vids/playwright/submit-2fa
router.post('/vids/playwright/submit-2fa', async (req, res) => {
  try {
    const { sessionId, code, customLabel } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID wajib disertakan.' });
    }

    await getVidsPlaywrightManager().submit2FA(sessionId, String(code || '').trim(), customLabel);

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

// POST /api/vids/playwright/cancel
router.post('/vids/playwright/cancel', async (req, res) => {
  try {
    const { sessionId, batchId } = req.body || {};
    if (batchId) {
      await getVidsPlaywrightManager().cancelBatch(batchId);
    }
    if (sessionId) {
      await getVidsPlaywrightManager().cancelSession(sessionId);
    }
    return res.json({ success: true, message: 'Sesi Playwright telah dibatalkan.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/vids/playwright/cancel-batch
router.post('/vids/playwright/cancel-batch', async (req, res) => {
  try {
    const { batchId } = req.body || {};
    if (batchId) {
      await getVidsPlaywrightManager().cancelBatch(batchId);
    }
    return res.json({ success: true, message: 'Batch Playwright Google Vids telah dibatalkan.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/vids/playwright/scripts
router.get('/vids/playwright/scripts', async (_req, res) => {
  try {
    const scripts = getVidsPlaywrightManager().getLocalPlaywrightScripts();
    return res.json({ success: true, ...scripts });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. GET /api/vids/quota — Cek status sisa kredit akun
router.get('/vids/quota', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    const sessions = readAllVidsSessions();
    const session = email ? sessions[email] : Object.values(sessions)[0];

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Akun Google Vids belum tersedia. Tambahkan akun terlebih dahulu.',
      });
    }

    const liveQuota = await fetchQuotaSummary(session.cookies);
    if (!liveQuota || typeof liveQuota.remaining !== 'number') {
      session.credits = 0;
      session.accountStatus = 'expired';
      session.statusMessage = 'Sesi Google Vids kedaluwarsa atau ditolak server Google (kuota tidak terbaca).';
      session.lastChecked = new Date().toISOString();
      sessions[session.email.toLowerCase()] = session;
      saveVidsSessions(sessions);

      return res.status(401).json({
        success: false,
        email: session.email,
        credits: 0,
        totalCredits: session.totalCredits || 500,
        usedCredits: session.totalCredits || 500,
        estVideosRemaining: 0,
        quotaLive: false,
        accountStatus: 'expired',
        statusMessage: 'Sesi Kedaluwarsa / Kuota Tidak Terbaca (Perlu Relogin)',
        error: 'Sesi Google Vids kedaluwarsa atau ditolak server Google (kuota tidak terbaca). Silakan lakukan Relogin.',
      });
    }

    session.credits = liveQuota.remaining;
    session.totalCredits = liveQuota.limit;
    session.accountStatus = 'active';
    session.lastChecked = new Date().toISOString();
    sessions[session.email.toLowerCase()] = session;
    saveVidsSessions(sessions);

    return res.json({
      success: true,
      email: session.email,
      credits: session.credits,
      totalCredits: session.totalCredits,
      usedCredits: Math.max(0, session.totalCredits - session.credits),
      estVideosRemaining: Math.floor(session.credits / 10),
      quotaLive: true,
      accountStatus: 'active',
      resetEpoch: liveQuota?.resetEpoch ?? null,
      lastChecked: session.lastChecked,
      cookies: session.cookies,
      docId: session.docId,
      serverToken: session.serverToken,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. POST /api/vids/generate-video — Endpoint Utama Generate Video
router.post('/vids/generate-video', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      prompt,
      duration = 10,
      email: requestEmail,
      cookies: requestCookies,
      serverToken: requestServerToken,
      docId: requestDocId,
      flixDocId,
      aspectRatio: requestAspectRatio = '9:16 (Vertical)',
      resolution: requestResolution = '720p',
      referenceImageData,
      referenceImageUrl,
      image,
    } = req.body || {};

    const safePrompt = String(prompt || '').trim();
    const imageBuffer = await resolveImageBuffer(referenceImageData, referenceImageUrl, image);

    if (!safePrompt && !imageBuffer) {
      return res.status(400).json({ success: false, error: 'Prompt video atau gambar referensi tidak boleh kosong.' });
    }
    const durationSeconds = Number(duration);
    if (!Number.isInteger(durationSeconds) || durationSeconds < 3 || durationSeconds > 15) {
      return res.status(400).json({ success: false, error: 'Durasi Google Vids harus antara 3 dan 15 detik.' });
    }
    if (!['9:16', '9:16 (Vertical)', '16:9', '16:9 (Landscape)'].includes(requestAspectRatio)) {
      return res.status(400).json({ success: false, error: 'Google Vids saat ini hanya mendukung aspect ratio 9:16 dan 16:9.' });
    }
    if (requestResolution !== '720p' && requestResolution !== '1080p') {
      return res.status(400).json({ success: false, error: 'Resolusi Google Vids harus 720p atau 1080p.' });
    }
    const aspectRatio: '9:16' | '16:9' =
      requestAspectRatio === '16:9' || requestAspectRatio === '16:9 (Landscape)' ? '16:9' : '9:16';
    const resolution: '720p' | '1080p' = requestResolution;

    // Resolusi akun dan sesi
    const sessions = readAllVidsSessions();
    let targetSession: VidsAccountSession | undefined;

    if (requestEmail) {
      targetSession = sessions[String(requestEmail).trim().toLowerCase()];
    }
    if (!targetSession) {
      targetSession = Object.values(sessions)[0];
    }

    // Prioritaskan cookie tersimpan di data/vids_sessions.json jika valid dan memiliki SAPISID
    let rawCookies = '';
    if (targetSession?.cookies && generateSapisidHash(targetSession.cookies)) {
      rawCookies = targetSession.cookies;
    } else if (requestCookies && generateSapisidHash(String(requestCookies))) {
      rawCookies = String(requestCookies);
    } else {
      rawCookies = String(targetSession?.cookies || requestCookies || '');
    }

    const cookies = normalizeVidsCookies(rawCookies);
    const docId = targetSession?.docId || requestDocId || flixDocId || DEFAULT_VIDS_DOC_ID;
    const serverToken = targetSession?.serverToken || requestServerToken;

    if (!cookies) {
      return res.status(400).json({
        success: false,
        error: 'Sesi akun Google Vids belum tersedia. Pastikan akun sudah login di antarmuka Settings.',
      });
    }

    let imageBlobToken: string | undefined;
    if (imageBuffer) {
      console.log(`[Google Vids] 🖼️ Mengunggah referensi gambar (${(imageBuffer.length / 1024).toFixed(1)} KB) ke temporaryblob...`);
      imageBlobToken = await uploadImageToTemporaryBlob(imageBuffer, cookies, docId);
      console.log(`[Google Vids] ✅ Token blob gambar berhasil didapat: ${imageBlobToken.slice(0, 25)}...`);
    }

    console.log(
      `[Google Vids] 🚀 Memulai generate video (${imageBlobToken ? 'Image-to-Video' : 'Text-to-Video'}) untuk prompt: "${safePrompt.slice(0, 50)}..."`
    );

    // Kirim request ke Google Vids AI server
    const responseData = await sendVidsGenerateRequest(
      safePrompt,
      durationSeconds,
      docId,
      cookies,
      serverToken,
      aspectRatio,
      resolution,
      imageBlobToken
    );

    // Ambil direct video URL
    const remoteVideoUrl = extractVideoDownloadUrl(responseData);
    if (!remoteVideoUrl) {
      return res.status(502).json({
        success: false,
        error: 'Google Vids tidak mengembalikan URL video yang valid.',
        raw: responseData,
      });
    }

    // Ambil info kuota terbaru
    const quotaInfo = extractQuota(responseData);

    // Simpan video ke media-cache lokal
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `vids_${timestampStr}_${crypto.randomBytes(3).toString('hex')}.mp4`;

    console.log(`[Google Vids] 📥 Mengunduh hasil render ke media-cache/${filename}...`);
    const totalBytes = await downloadVideoToMediaCache(remoteVideoUrl, cookies, filename);
    const localVideoUrl = `/media-cache/${filename}`;

    // Update sisa kredit di sesi akun
    if (targetSession) {
      targetSession.credits = quotaInfo.remaining;
      targetSession.totalCredits = quotaInfo.total;
      targetSession.lastChecked = new Date().toISOString();
      sessions[targetSession.email.toLowerCase()] = targetSession;
      saveVidsSessions(sessions);
    }

    const renderTimeSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Google Vids] ✅ Selesai dalam ${renderTimeSec}s! Ukuran: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);

    return res.json({
      success: true,
      videoUrl: localVideoUrl,
      remoteUrl: remoteVideoUrl,
      filename,
      duration: durationSeconds,
      resolution:
        resolution === '1080p'
          ? aspectRatio === '16:9'
            ? '1920x1080'
            : '1080x1920'
          : aspectRatio === '16:9'
          ? '1280x720'
          : '720x1280',
      aspectRatio,
      renderTimeSeconds: parseFloat(renderTimeSec),
      fileSize: totalBytes,
      isImageToVideo: !!imageBlobToken,
      quota: {
        total: quotaInfo.total,
        remaining: quotaInfo.remaining,
        cost: quotaInfo.cost,
      },
      message: imageBlobToken
        ? 'Video Google Vids (Image-to-Video) berhasil dibuat dan siap diputar!'
        : 'Video Google Vids berhasil dibuat dan siap diputar!',
    });
  } catch (err: any) {
    const errorTimeSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[Google Vids Error] (${errorTimeSec}s):`, err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Terjadi kesalahan saat memproses video Google Vids.',
    });
  }
});

router.post(
  '/vids/cache-imported-video',
  (req, res, next) => {
    cacheImportedVideoUpload.single('file')(req, res, (error) => {
      if (error) {
        return res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : 'Gagal menerima file video.',
        });
      }
      next();
    });
  },
  (req, res) => {
    const uploadedFile = req.file;
    if (!uploadedFile) {
      return res.status(400).json({ success: false, error: 'File video tidak ditemukan.' });
    }

    const isVideo =
      uploadedFile.mimetype.startsWith('video/') ||
      /\.(mp4|mov|avi|webm|mkv|m4v)$/i.test(uploadedFile.originalname);
    if (!isVideo) {
      fs.rmSync(uploadedFile.path, { force: true });
      return res.status(400).json({ success: false, error: 'File yang diterima bukan video.' });
    }

    const filename = `canvas_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.mp4`;
    const destination = path.join(mediaCacheDir, filename);
    try {
      fs.copyFileSync(uploadedFile.path, destination);
      return res.json({ success: true, videoUrl: `/media-cache/${filename}` });
    } catch (error) {
      console.error('[Canvas Video Cache] Gagal menyimpan video lokal:', error);
      return res.status(500).json({ success: false, error: 'Gagal menyimpan video sementara untuk diproses.' });
    } finally {
      fs.rmSync(uploadedFile.path, { force: true });
    }
  }
);

router.post('/vids/remove-watermark', (req, res) => {
  const videoUrl = String(req.body?.videoUrl || '');
  const mediaPrefix = '/media-cache/';
  if (!videoUrl.startsWith(mediaPrefix)) {
    return res.status(400).json({ success: false, error: 'Video harus berasal dari media-cache lokal.' });
  }

  let filename: string;
  try {
    filename = decodeURIComponent(videoUrl.slice(mediaPrefix.length));
  } catch {
    return res.status(400).json({ success: false, error: 'Nama file video tidak valid.' });
  }

  if (!/^(?:vids|stitched|canvas)_[A-Za-z0-9._-]+(?:_nowm)?\.mp4$/i.test(filename)) {
    return res.status(400).json({ success: false, error: 'File bukan video Google Vids, Video Stitcher, atau video impor canvas yang didukung.' });
  }

  const inputFilename = filename.replace(/_nowm\.mp4$/i, '.mp4');
  const inputPath = path.resolve(mediaCacheDir, inputFilename);
  const outputFilename = `${path.parse(inputFilename).name}_nowm.mp4`;
  const outputPath = path.resolve(mediaCacheDir, outputFilename);
  const stagingOutputPath = path.join(mediaCacheDir, `.vidswm-${crypto.randomBytes(8).toString('hex')}.mp4`);
  const scriptPath = path.join(process.cwd(), 'script-vids', 'remove_watermark.cjs');

  if (!inputPath.startsWith(`${mediaCacheDir}${path.sep}`) || !fs.existsSync(inputPath)) {
    return res.status(404).json({ success: false, error: 'File video tidak ditemukan di media-cache.' });
  }
  if (!fs.statSync(inputPath).isFile()) {
    return res.status(400).json({ success: false, error: 'File video tidak valid.' });
  }
  if (!fs.existsSync(scriptPath)) {
    return res.status(500).json({ success: false, error: 'Skrip remove watermark tidak ditemukan.' });
  }

  res.status(200).type('application/x-ndjson');
  const send = (payload: Record<string, string>) => {
    if (!res.destroyed) res.write(`${JSON.stringify(payload)}\n`);
  };

  send({ type: 'log', message: 'Menjalankan proses remove watermark...' });
  const child = spawn(process.execPath, [scriptPath, inputPath, stagingOutputPath, '--google-vids'], {
    cwd: process.cwd(),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let pendingLog = '';
  let processError = '';
  const flushLog = () => {
    if (!pendingLog) return;
    send({ type: 'log', message: pendingLog });
    pendingLog = '';
  };
  const logInterval = setInterval(flushLog, 250);
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => { pendingLog += chunk; });
  child.stderr.on('data', (chunk: string) => { pendingLog += chunk; });
  child.on('error', (error) => { processError = error.message; });
  res.on('close', () => {
    if (!res.writableEnded) child.kill();
  });
  child.on('close', (code) => {
    clearInterval(logInterval);
    flushLog();
    try {
      if (code === 0 && fs.existsSync(stagingOutputPath) && fs.statSync(stagingOutputPath).size > 0) {
        fs.copyFileSync(stagingOutputPath, outputPath);
        send({ type: 'complete', videoUrl: `${mediaPrefix}${outputFilename}` });
      } else {
        const message = processError || `Proses remove watermark gagal (exit code ${code ?? 'tidak tersedia'}).`;
        console.error('[Google Vids Remove Watermark]', message);
        send({ type: 'error', message });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan video hasil.';
      console.error('[Google Vids Remove Watermark]', message);
      send({ type: 'error', message });
    } finally {
      try {
        fs.rmSync(stagingOutputPath, { force: true });
      } catch (error) {
        console.error('[Google Vids Remove Watermark] Gagal membersihkan file sementara:', error);
      }
      res.end();
    }
  });
});

export default router;
