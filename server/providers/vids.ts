/**
 * =========================================================================================
 * GOOGLE VIDS PROVIDER ROUTER — NATIVE WORKSPACE AI VIDEO GENERATION ENGINE
 * =========================================================================================
 * Integrates Google Vids (appsgenaiserver-pa.clients6.google.com) using
 * user's Google session cookies, SAPISIDHASH auth headers, and Workspace Flix document context.
 * =========================================================================================
 */

import { Router } from 'express';
import { spawn } from 'child_process';
import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const router = Router();

const mediaCacheDir = path.join(process.cwd(), 'media-cache');
if (!fs.existsSync(mediaCacheDir)) {
  fs.mkdirSync(mediaCacheDir, { recursive: true });
}

const VIDS_SESSIONS_FILE = path.join(process.cwd(), 'data', 'vids_sessions.json');
const VIDS_CONFIG_FALLBACK = path.join(process.cwd(), 'script-vids', 'config.json');

// Default API Key Google Workspace GenAI Server
const VIDS_API_KEY = 'AIzaSyA-njTXslyyMKk1VOogRfVP59F6fNGeNW8';

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
}

// Helper: Membaca cache sesi Google Vids
function readAllVidsSessions(): Record<string, VidsAccountSession> {
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
function saveVidsSessions(data: Record<string, VidsAccountSession>) {
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

  // 3. Ekstraksi Document ID Google Vids (.flix)
  const docMatch = trimmed.match(/["']([a-zA-Z0-9_-]{35,55})["']\s*,\s*["']application\/vnd\.google-apps\.flix["']/);
  if (docMatch) docId = docMatch[1].trim();

  if (!docId) {
    const urlDocMatch = trimmed.match(/docs\.google.com\/videos\/d\/([a-zA-Z0-9_-]{35,55})/i);
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

// Helper: Mengambil kuota akun dari endpoint resmi Google Vids quotaSummary.
// Body: [null,1,[9],389,null,[[null,"1",1189]]]
// Respons: [[null,["60",null,"60",1,null,null,["1796112000"],0],"0",[9],1,17,51]]
//   [0] = limit, [2] = remaining, [6][0] = epoch reset
function fetchQuotaSummary(cookies: string): Promise<{ limit: number; remaining: number; resetEpoch: number | null } | null> {
  return new Promise((resolve) => {
    const auth = generateSapisidHash(cookies);
    if (!auth) return resolve(null);
    const body = JSON.stringify([null, 1, [9], 389, null, [[null, '1', 1189]]]);
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
          'Content-Length': Buffer.byteLength(body),
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

// Helper: Cek nama dan foto profil akun Google via ListAccounts
async function fetchGoogleUserProfile(cookies: string): Promise<{ email?: string; name?: string; photoUrl?: string }> {
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

// Helper: Membangun array payload Protobuf JSON (Opcode 386)
// Nilai WAJIB identik dengan request yang diterima server (diverifikasi 5 Nov 2026):
//   opcode      386 = Vids Video Generation RPC
//   [4][15][4]   1 = 720p landscape, 2 = 720p portrait, 6 = 1080p portrait
//   [2][8][3]    3 level nesting
//   [2][13]    "in" = locale
//   [2][35]    null (tidak boleh berisi "Asia/Jakarta" -> HTTP 400 search_context)
//   [2][41]    string client_root_request_id (angka 0 -> HTTP 400 TYPE_STRING)
function buildProtobufPayload(
  prompt: string,
  duration: number,
  docId: string,
  aspectRatio: '9:16' | '16:9',
  resolution: '720p' | '1080p'
): any[] {
  const aspectRatioCode = 12;
  const resolutionCode = aspectRatio === '16:9' ? 1 : resolution === '1080p' ? 6 : 2;
  const clientReqId = `goog_${Math.floor(Math.random() * 900000000 + 100000000)}`;
  return [
    386, // Opcode Vids Video Generation
    null,
    [
      9, // Vids App ID
      null, null, null,
      clientReqId,
      null,
      "0", // authuser index
      null,
      [
        null, null, null,
        [[[
          null, null, null, null, null, null, null,
          [
            null, null,
            [[
              docId,
              "application/vnd.google-apps.flix",
              null, null, 1
            ]]
          ]
        ]]]
      ],
      null, null,
      [24, 0],
      null,
      "in", // locale
      null, null, null, null, null, 1,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, // [2][35] timezone TIDAK dikirim (menyebabkan HTTP 400 search_context)
      null, null, null, null, null,
      clientReqId // [2][41] client_root_request_id harus string
    ],
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
      [[null, "1", 1189]]
    ],
    1
  ];
}

// Helper: Kirim request generate video ke server Google Vids (Held Connection)
function sendVidsGenerateRequest(
  prompt: string,
  duration: number,
  docId: string,
  cookies: string,
  serverToken: string | undefined,
  aspectRatio: '9:16' | '16:9',
  resolution: '720p' | '1080p'
): Promise<any> {
  return new Promise((resolve, reject) => {
    const authHeader = generateSapisidHash(cookies);
    if (!authHeader) {
      return reject(new Error('Cookie SAPISID tidak valid untuk otentikasi Google Vids.'));
    }

    const payload = JSON.stringify(buildProtobufPayload(prompt, duration, docId, aspectRatio, resolution));
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
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
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
              new Error(`Google Vids AI gagal dengan HTTP ${res.statusCode}: ${data.slice(0, 300)}`)
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

    https.get(
      videoUrl,
      {
        headers: {
          Cookie: cookies,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
          Referer: 'https://docs.google.com/',
        },
      },
      (res) => {
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
    ).on('error', (err) => {
      fileStream.close();
      try { fs.unlinkSync(filePath); } catch (_) {}
      reject(err);
    });
  });
}

// =========================================================================================
// ROUTER ENDPOINTS
// =========================================================================================

// 1. POST /api/vids/accounts/verify — Verifikasi dan simpan akun Google Vids
router.post('/vids/accounts/verify', async (req, res) => {
  try {
    const rawInput = String(req.body.token || req.body.cookies || '').trim();
    const customEmail = String(req.body.email || '').trim().toLowerCase();
    const customLabel = String(req.body.nickname || req.body.name || '').trim();
    const customDocId = String(req.body.docId || '').trim();

    const extracted = extractVidsAuth(rawInput);
    const cookies = normalizeVidsCookies(extracted.cookies || rawInput);
    const serverToken = extracted.serverToken || String(req.body.serverToken || '').trim();
    const docId = extracted.docId || customDocId || '13dGvn8A9gR6OD_NgaUi1Tiik_J1xDv98BcvopPX6iRI';

    if (!cookies) {
      return res.status(400).json({
        success: false,
        error: 'Cookie atau cURL Google Vids wajib disertakan.',
      });
    }

    const profile = await fetchGoogleUserProfile(cookies);
    const resolvedEmail = customEmail || profile.email || 'vids.user@google.com';
    const resolvedName = customLabel || profile.name || 'Google Vids User';

    const sessions = readAllVidsSessions();
    const existing = sessions[resolvedEmail.toLowerCase()];

    const sessionData: VidsAccountSession = {
      email: resolvedEmail,
      name: resolvedName,
      photoUrl: profile.photoUrl || existing?.photoUrl,
      cookies,
      docId: docId || existing?.docId || '',
      serverToken: serverToken || existing?.serverToken || '',
      credits: existing?.credits ?? 60,
      totalCredits: existing?.totalCredits ?? 60,
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
    if (liveQuota) {
      session.credits = liveQuota.remaining;
      session.totalCredits = liveQuota.limit;
      session.lastChecked = new Date().toISOString();
      sessions[session.email.toLowerCase()] = session;
      saveVidsSessions(sessions);
    }

    return res.json({
      success: true,
      email: session.email,
      credits: session.credits,
      totalCredits: session.totalCredits,
      usedCredits: Math.max(0, session.totalCredits - session.credits),
      estVideosRemaining: Math.floor(session.credits / 10),
      quotaLive: liveQuota !== null,
      resetEpoch: liveQuota?.resetEpoch ?? null,
      lastChecked: session.lastChecked,
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
    } = req.body || {};

    const safePrompt = String(prompt || '').trim();
    if (!safePrompt) {
      return res.status(400).json({ success: false, error: 'Prompt video tidak boleh kosong.' });
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
    if (aspectRatio === '16:9' && resolution === '1080p') {
      return res.status(400).json({ success: false, error: 'Google Vids 1080p landscape belum terverifikasi. Pilih 720p atau aspect ratio 9:16.' });
    }

    // Resolusi akun dan sesi
    const sessions = readAllVidsSessions();
    let targetSession: VidsAccountSession | undefined;

    if (requestEmail) {
      targetSession = sessions[String(requestEmail).trim().toLowerCase()];
    }
    if (!targetSession) {
      targetSession = Object.values(sessions)[0];
    }

    const rawCookies = String(requestCookies || targetSession?.cookies || '');
    const cookies = normalizeVidsCookies(rawCookies);
    const docId = requestDocId || flixDocId || targetSession?.docId || '13dGvn8A9gR6OD_NgaUi1Tiik_J1xDv98BcvopPX6iRI';
    const serverToken = requestServerToken || targetSession?.serverToken;

    if (!cookies) {
      return res.status(400).json({
        success: false,
        error: 'Sesi akun Google Vids belum tersedia. Pastikan akun sudah login di antarmuka Settings.',
      });
    }

    console.log(`[Google Vids] 🚀 Memulai generate video untuk prompt: "${safePrompt.slice(0, 50)}..."`);

    // Kirim request ke Google Vids AI server
    const responseData = await sendVidsGenerateRequest(
      safePrompt,
      Number(duration) || 10,
      docId,
      cookies,
      serverToken,
      aspectRatio,
      resolution
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
      duration: Number(duration) || 10,
      resolution: resolution === '1080p' ? '1080x1920' : aspectRatio === '16:9' ? '1280x720' : '720x1280',
      aspectRatio,
      renderTimeSeconds: parseFloat(renderTimeSec),
      fileSize: totalBytes,
      quota: {
        total: quotaInfo.total,
        remaining: quotaInfo.remaining,
        cost: quotaInfo.cost,
      },
      message: 'Video Google Vids berhasil dibuat dan siap diputar!',
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

  if (!/^(?:vids|stitched)_[A-Za-z0-9._-]+(?:_nowm)?\.mp4$/i.test(filename)) {
    return res.status(400).json({ success: false, error: 'File bukan video Google Vids atau hasil Video Stitcher yang didukung.' });
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
