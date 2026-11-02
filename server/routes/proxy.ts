import { Router } from 'express';
import axios, { AxiosRequestConfig } from 'axios';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import { spawn } from 'child_process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const router = Router();

// Helper to sanitize and unwrap nested proxy URLs
function unwrapUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let current = rawUrl.trim();

  // Recursively unwrap proxy wrappers like /api/proxy-video?url=... or /api/proxy-download?url=...
  for (let i = 0; i < 5; i++) {
    const match = current.match(/proxy-(?:video|download|image)\?url=([^&]+)/i);
    if (match && match[1]) {
      try {
        current = decodeURIComponent(match[1]);
      } catch {
        current = match[1];
      }
    } else {
      break;
    }
  }
  return current.trim();
}

// Helper to extract cookies vs API key from token / query parameter
function parseAuthToken(rawToken?: string): { isApiKey: boolean; cookies?: string; apiKey?: string } {
  if (!rawToken || typeof rawToken !== 'string') {
    // Check DEFAULT_COOKIES from gemini_chat.cjs
    try {
      const { DEFAULT_COOKIES } = require('../../script-gemini/gemini_chat.cjs');
      return { isApiKey: false, cookies: DEFAULT_COOKIES || '' };
    } catch {
      return { isApiKey: false };
    }
  }

  const clean = rawToken.replace('Bearer ', '').trim();
  if (clean.startsWith('AIza') && clean.length >= 30) {
    return { isApiKey: true, apiKey: clean };
  }

  if (clean.includes('__Secure') || clean.includes('SID=') || clean.includes('SAPISID=')) {
    return { isApiKey: false, cookies: clean };
  }

  // Fallback to default cookies if provided string is too short/generic
  try {
    const { DEFAULT_COOKIES } = require('../../script-gemini/gemini_chat.cjs');
    return { isApiKey: false, cookies: DEFAULT_COOKIES || clean };
  } catch {
    return { isApiKey: false, cookies: clean };
  }
}

function getSapisidHash(cookies: string, origin = 'https://gemini.google.com'): string | null {
  try {
    const crypto = require('crypto');
    const sMatch = cookies.match(/SAPISID=([^;]+)/);
    const s1pMatch = cookies.match(/__Secure-1PAPISID=([^;]+)/);
    const s3pMatch = cookies.match(/__Secure-3PAPISID=([^;]+)/);

    const sVal = sMatch ? sMatch[1].trim() : (s1pMatch ? s1pMatch[1].trim() : null);
    if (!sVal) return null;

    const timestamp = Math.floor(Date.now() / 1000);
    const hash = crypto.createHash('sha1').update(`${timestamp} ${sVal} ${origin}`).digest('hex');
    return `${timestamp}_${hash}`;
  } catch (e) {
    return null;
  }
}

function getGoogleAuthorizationHeader(cookies: string, origin = 'https://gemini.google.com'): string | null {
  try {
    const crypto = require('crypto');
    const sMatch = cookies.match(/SAPISID=([^;]+)/);
    const s1pMatch = cookies.match(/__Secure-1PAPISID=([^;]+)/);
    const s3pMatch = cookies.match(/__Secure-3PAPISID=([^;]+)/);

    const sVal = sMatch ? sMatch[1].trim() : (s1pMatch ? s1pMatch[1].trim() : null);
    if (!sVal) return null;

    const s1pVal = s1pMatch ? s1pMatch[1].trim() : sVal;
    const s3pVal = s3pMatch ? s3pMatch[1].trim() : sVal;

    const timestamp = Math.floor(Date.now() / 1000);
    const hash = crypto.createHash('sha1').update(`${timestamp} ${sVal} ${origin}`).digest('hex');
    const hash1p = crypto.createHash('sha1').update(`${timestamp} ${s1pVal} ${origin}`).digest('hex');
    const hash3p = crypto.createHash('sha1').update(`${timestamp} ${s3pVal} ${origin}`).digest('hex');

    return `SAPISIDHASH ${timestamp}_${hash} SAPISID1PHASH ${timestamp}_${hash1p} SAPISID3PHASH ${timestamp}_${hash3p}`;
  } catch (e) {
    return null;
  }
}

// Locate local media file if available in cache or filesystem
function findLocalMediaFile(targetUrl: string): string | null {
  if (!targetUrl) return null;

  // 1. Direct path check
  let potentialPaths: string[] = [];

  if (targetUrl.startsWith('/media-cache/') || targetUrl.startsWith('media-cache/')) {
    const rel = targetUrl.startsWith('/') ? targetUrl.slice(1) : targetUrl;
    potentialPaths.push(path.join(process.cwd(), rel.split('?')[0]));
  } else if (targetUrl.includes('/media-cache/') || targetUrl.includes('media-cache/')) {
    const match = targetUrl.match(/media-cache\/([^?#]+)/);
    if (match) {
      potentialPaths.push(path.join(process.cwd(), 'media-cache', match[1]));
    }
  } else if (targetUrl.startsWith('/tmp/') || targetUrl.startsWith('tmp/')) {
    const rel = targetUrl.startsWith('/') ? targetUrl : path.join(process.cwd(), targetUrl);
    potentialPaths.push(rel.split('?')[0]);
  } else if (targetUrl.startsWith('/')) {
    const rel = targetUrl.slice(1).split('?')[0];
    potentialPaths.push(path.join(process.cwd(), rel));
  } else {
    // Check if filename itself exists in media-cache
    const baseName = path.basename(targetUrl.split('?')[0]);
    if (baseName && baseName.length > 3) {
      potentialPaths.push(path.join(process.cwd(), 'media-cache', baseName));
    }
  }

  for (const p of potentialPaths) {
    if (p && fs.existsSync(p)) {
      try {
        if (fs.statSync(p).isFile()) return p;
      } catch {}
    }
  }

  return null;
}

// Serve local file with 206 Partial Content Range support
function serveLocalFile(filePath: string, req: any, res: any, downloadFilename?: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'mp4';
    const mime =
      ext === 'mp4'
        ? 'video/mp4'
        : ext === 'webm'
        ? 'video/webm'
        : ext === 'mov'
        ? 'video/quicktime'
        : ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'webp'
        ? 'image/webp'
        : ext === 'png'
        ? 'image/png'
        : ext === 'gif'
        ? 'image/gif'
        : 'application/octet-stream';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, Content-Disposition');
    res.setHeader('Accept-Ranges', 'bytes');

    if (downloadFilename) {
      const cleanName = downloadFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const finalName = cleanName.toLowerCase().endsWith(`.${ext}`) ? cleanName : `${cleanName}.${ext}`;
      res.setHeader('Content-Disposition', `attachment; filename="${finalName}"; filename*=UTF-8''${encodeURIComponent(finalName)}`);
    }

    const range = req.headers.range;
    if (range && !downloadFilename) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      if (start >= fileSize || end >= fileSize || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).send('Requested Range Not Satisfiable');
        return true;
      }
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunkSize,
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=86400',
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return true;
    }

    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': mime,
      'Cache-Control': downloadFilename ? 'no-cache, no-store, must-revalidate' : 'public, max-age=86400',
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  } catch (err: any) {
    console.warn('[serveLocalFile error]:', err?.message);
    return false;
  }
}

// Robust fallback streamer using curl to bypass strict CDN anti-bot & Google 403 checks
async function streamWithCurl(
  targetUrl: string,
  req: any,
  res: any,
  cookies?: string,
  downloadFilename?: string
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const sapisidHash = cookies ? getSapisidHash(cookies, 'https://gemini.google.com') : null;
      const args: string[] = ['-s', '-L', '--location-trusted', '--max-time', '60'];

      if (cookies && (targetUrl.includes('google') || targetUrl.includes('usercontent'))) {
        args.push('-b', cookies);
        const authHeader = getGoogleAuthorizationHeader(cookies);
        if (authHeader) {
          args.push('-H', `Authorization: ${authHeader}`);
          args.push('-H', 'X-Goog-AuthUser: 0');
        }
        args.push('-H', 'Referer: https://gemini.google.com/');
        args.push('-H', 'Origin: https://gemini.google.com');
      } else if (targetUrl.includes('tikwm') || targetUrl.includes('tiktok')) {
        args.push('-H', 'Referer: https://www.tikwm.com/');
      }

      if (req.headers.range && !downloadFilename) {
        args.push('-r', req.headers.range.replace('bytes=', ''));
      }

      args.push('-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36');
      args.push(targetUrl);

      const proc = spawn('curl', args, { stdio: ['ignore', 'pipe', 'pipe'] });

      let responded = false;
      let firstChunkReceived = false;
      let headerBuffered = Buffer.alloc(0);
      let isHtmlError = false;

      proc.stdout.on('data', (chunk: Buffer) => {
        if (isHtmlError) return;

        if (!responded) {
          headerBuffered = Buffer.concat([headerBuffered, chunk]);

          // Need at least 64 bytes to inspect magic header
          if (headerBuffered.length < 64) {
            return;
          }

          const headStr = headerBuffered.slice(0, 512).toString('utf-8').toLowerCase();
          if (
            headStr.includes('<!doctype') ||
            headStr.includes('<html') ||
            headStr.includes('<body') ||
            headStr.includes('cookie check') ||
            headStr.includes('service login') ||
            headStr.includes('accounts.google.com')
          ) {
            isHtmlError = true;
            try { proc.kill(); } catch {}
            return;
          }

          responded = true;
          firstChunkReceived = true;
          const isVideo = targetUrl.toLowerCase().includes('.mp4') || targetUrl.includes('video') || targetUrl.includes('=m22') || targetUrl.includes('=m18') || targetUrl.includes('=dv');
          const ext = isVideo ? 'mp4' : 'png';
          const contentType = isVideo ? 'video/mp4' : 'image/png';

          res.setHeader('Content-Type', contentType);
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, Content-Disposition');
          res.setHeader('Accept-Ranges', 'bytes');

          if (downloadFilename) {
            const cleanName = downloadFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
            const finalName = cleanName.toLowerCase().endsWith(`.${ext}`) ? cleanName : `${cleanName}.${ext}`;
            res.setHeader('Content-Disposition', `attachment; filename="${finalName}"; filename*=UTF-8''${encodeURIComponent(finalName)}`);
          }

          if (req.headers.range && !downloadFilename) {
            res.status(206);
          } else {
            res.status(200);
          }

          res.write(headerBuffered);
          return;
        }

        res.write(chunk);
      });

      proc.on('close', (code) => {
        if (isHtmlError) {
          return resolve(false);
        }
        if (responded) {
          res.end();
          return resolve(true);
        }
        resolve(false);
      });

      proc.on('error', () => {
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

// ----------------------------------------------------------------------------
// 1. IMAGE PROXY ENDPOINT
// ----------------------------------------------------------------------------
router.get('/proxy-image', async (req, res) => {
  try {
    const rawTarget = req.query.url as string;
    if (!rawTarget || typeof rawTarget !== 'string') {
      return res.status(400).send('Invalid or missing URL parameter.');
    }

    const targetUrl = unwrapUrl(rawTarget);

    // Check local filesystem
    const localFile = findLocalMediaFile(targetUrl);
    if (localFile && serveLocalFile(localFile, req, res)) {
      return;
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      return res.status(400).send('Invalid URL format.');
    }

    const auth = parseAuthToken(req.query.token as string || req.query.cookies as string);
    const isGoogle = targetUrl.includes('googleusercontent.com') || targetUrl.includes('gemini.google.com') || targetUrl.includes('google.com');

    // Build URL candidates
    const urlCandidates = [targetUrl];
    if (isGoogle && targetUrl.includes('googleusercontent.com') && !targetUrl.includes('=s0') && !targetUrl.includes('=')) {
      urlCandidates.push(`${targetUrl}=s0`);
    }

    let success = false;

    // Strategy 1: Axios with tailored headers
    for (const testUrl of urlCandidates) {
      try {
        const headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        };

        if (isGoogle && auth.cookies) {
          headers['Cookie'] = auth.cookies;
          const authHeader = getGoogleAuthorizationHeader(auth.cookies);
          if (authHeader) {
            headers['Authorization'] = authHeader;
            headers['X-Goog-AuthUser'] = '0';
          }
          headers['Referer'] = 'https://gemini.google.com/';
          headers['Origin'] = 'https://gemini.google.com';
        }

        const resp = await axios.get(testUrl, {
          headers,
          responseType: 'stream',
          validateStatus: (s) => s >= 200 && s < 400,
          timeout: 20000,
        });

        res.status(resp.status);
        const contentType = String(resp.headers['content-type'] || 'image/png');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
        if (resp.headers['content-length']) {
          res.setHeader('Content-Length', String(resp.headers['content-length']));
        }
        resp.data.pipe(res);
        success = true;
        break;
      } catch (err: any) {
        // If 403, continue to clean request or fallback
      }
    }

    if (success) return;

    // Strategy 2: Clean request without Cookies
    try {
      const resp = await axios.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
          Accept: 'image/*,*/*;q=0.8',
        },
        responseType: 'stream',
        validateStatus: (s) => s >= 200 && s < 400,
        timeout: 15000,
      });

      res.status(resp.status);
      res.setHeader('Content-Type', String(resp.headers['content-type'] || 'image/png'));
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      resp.data.pipe(res);
      return;
    } catch {}

    // Strategy 3: Curl spawn fallback
    const curlOk = await streamWithCurl(targetUrl, req, res, auth.cookies);
    if (curlOk) return;

    if (!res.headersSent) {
      res.status(500).send('Failed to proxy image stream.');
    }
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).send('Failed to proxy image stream.');
    }
  }
});

// ----------------------------------------------------------------------------
// 2. VIDEO PROXY ENDPOINT
// ----------------------------------------------------------------------------
router.get('/proxy-video', async (req, res) => {
  try {
    const rawTarget = req.query.url as string;
    if (!rawTarget || typeof rawTarget !== 'string') {
      return res.status(400).send('Invalid or missing URL parameter.');
    }

    const targetUrl = unwrapUrl(rawTarget);

    // 1. Check local filesystem / media-cache first
    const localFile = findLocalMediaFile(targetUrl);
    if (localFile && serveLocalFile(localFile, req, res)) {
      return;
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      return res.status(400).send('Invalid URL format.');
    }

    const auth = parseAuthToken(req.query.token as string || req.query.cookies as string);
    const isGoogle = targetUrl.includes('googleusercontent.com') || targetUrl.includes('gemini.google.com') || targetUrl.includes('contribution.usercontent.google.com') || targetUrl.includes('googleapis.com');
    const isGoogleApi = targetUrl.includes('generativelanguage.googleapis.com');

    // Build URL candidates (e.g. =m22, =dv, =m18, rawBase)
    const urlCandidates: string[] = [];

    if (isGoogle && targetUrl.includes('googleusercontent.com') && !targetUrl.includes('contribution.usercontent')) {
      const rawBase = targetUrl.includes('=') ? targetUrl.replace(/=[a-zA-Z0-9_-]+$/, '') : targetUrl;
      if (!targetUrl.includes('=m22') && !targetUrl.includes('=dv') && !targetUrl.includes('=m18')) {
        urlCandidates.push(`${rawBase}=m22`);
        urlCandidates.push(`${rawBase}=dv`);
        urlCandidates.push(`${rawBase}=m18`);
      }
      urlCandidates.push(targetUrl);
      if (!urlCandidates.includes(rawBase)) urlCandidates.push(rawBase);
    } else {
      urlCandidates.push(targetUrl);
    }

    // Try each candidate URL with Axios
    let streamedSuccess = false;

    for (const testUrl of urlCandidates) {
      const headerConfigs: Record<string, string>[] = [];

      // A. If Google GenAI API endpoint
      if (isGoogleApi) {
        const apiKey = auth.apiKey || process.env.GEMINI_API_KEY || '';
        headerConfigs.push({
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
          'x-goog-api-key': apiKey,
          Accept: 'video/mp4,video/*,*/*;q=0.8',
        });
      } else if (isGoogle) {
        // B1. Google with Cookie + SAPISIDHASH (if cookies available)
        if (auth.cookies) {
          const authHeaders: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
            Accept: 'video/mp4,video/*,*/*;q=0.8',
            Cookie: auth.cookies,
            Referer: 'https://gemini.google.com/',
            Origin: 'https://gemini.google.com',
          };
          const authHeader = getGoogleAuthorizationHeader(auth.cookies);
          if (authHeader) {
            authHeaders['Authorization'] = authHeader;
            authHeaders['X-Goog-AuthUser'] = '0';
          }
          headerConfigs.push(authHeaders);
        }

        // B2. Google clean request (no cookie/auth header)
        headerConfigs.push({
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
          Accept: 'video/mp4,video/*,*/*;q=0.8',
        });
      } else {
        // C. Standard external CDNs (TikTok, Weavy, Roboneo, RunningHub, Fal, etc.)
        const stdHeaders: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
          Accept: 'video/mp4,video/*,*/*;q=0.8',
        };
        if (testUrl.includes('tikwm.com') || testUrl.includes('tiktokcdn') || testUrl.includes('tiktok.com')) {
          stdHeaders['Referer'] = 'https://www.tikwm.com/';
        }
        headerConfigs.push(stdHeaders);
      }

      for (const hdrs of headerConfigs) {
        try {
          if (req.headers.range) {
            hdrs['Range'] = req.headers.range;
          }

          const response = await axios.get(testUrl, {
            headers: hdrs,
            responseType: 'stream',
            validateStatus: (status) => status >= 200 && status < 400,
            timeout: 30000,
            maxRedirects: 5,
          });

          res.status(response.status);
          const contentType = String(response.headers['content-type'] || 'video/mp4');
          res.setHeader('Content-Type', contentType.startsWith('video') ? contentType : 'video/mp4');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Cache-Control', 'public, max-age=86400, immutable');

          if (response.headers['content-length']) {
            res.setHeader('Content-Length', String(response.headers['content-length']));
          }
          if (response.headers['content-range']) {
            res.setHeader('Content-Range', String(response.headers['content-range']));
          }

          response.data.pipe(res);
          streamedSuccess = true;
          break;
        } catch (axiosErr: any) {
          // Attempt next header config or next candidate URL
        }
      }

      if (streamedSuccess) break;
    }

    if (streamedSuccess) return;

    // Last line of defense: curl spawn
    const curlSuccess = await streamWithCurl(targetUrl, req, res, auth.cookies);
    if (curlSuccess) return;

    if (!res.headersSent) {
      res.status(500).send('Failed to proxy video stream.');
    }
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).send('Failed to proxy video stream.');
    }
  }
});

// ----------------------------------------------------------------------------
// 3. UNIVERSAL PROXY DOWNLOAD ENDPOINT
// ----------------------------------------------------------------------------
const handleProxyDownload = async (req: any, res: any) => {
  try {
    const rawTarget = (req.query.url as string) || '';
    const customFilename = (req.query.filename as string) || '';

    if (!rawTarget || typeof rawTarget !== 'string') {
      return res.status(400).json({ error: 'Parameter URL wajib disertakan.' });
    }

    const targetUrl = unwrapUrl(rawTarget);

    // 1. Support Base64 Data URLs
    if (targetUrl.startsWith('data:')) {
      const match = targetUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return res.status(400).json({ error: 'Format data URI tidak valid.' });
      }
      const mimeType = match[1];
      const buffer = Buffer.from(match[2], 'base64');
      const ext = mimeType.split('/')[1] || 'png';
      const cleanName = (customFilename || `media_${Date.now()}.${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Content-Disposition', `attachment; filename="${cleanName}"; filename*=UTF-8''${encodeURIComponent(cleanName)}`);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');
      return res.send(buffer);
    }

    // 2. Check local filesystem / media-cache
    const localFile = findLocalMediaFile(targetUrl);
    if (localFile && serveLocalFile(localFile, req, res, customFilename || path.basename(localFile))) {
      return;
    }

    // 3. Remote URL validation
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'URL tidak valid atau file lokal tidak ditemukan di server.' });
    }

    const auth = parseAuthToken(req.query.token as string || req.query.cookies as string);
    const isGoogle = targetUrl.includes('googleusercontent.com') || targetUrl.includes('gemini.google.com') || targetUrl.includes('contribution.usercontent.google.com') || targetUrl.includes('googleapis.com');
    const isGoogleApi = targetUrl.includes('generativelanguage.googleapis.com');

    // Build URL candidates
    const urlCandidates: string[] = [];
    if (isGoogle && targetUrl.includes('googleusercontent.com') && !targetUrl.includes('contribution.usercontent')) {
      const rawBase = targetUrl.includes('=') ? targetUrl.replace(/=[a-zA-Z0-9_-]+$/, '') : targetUrl;
      if (!targetUrl.includes('=m22') && !targetUrl.includes('=dv') && !targetUrl.includes('=m18')) {
        urlCandidates.push(`${rawBase}=m22`);
        urlCandidates.push(`${rawBase}=dv`);
      }
      urlCandidates.push(targetUrl);
      if (!urlCandidates.includes(rawBase)) urlCandidates.push(rawBase);
    } else {
      urlCandidates.push(targetUrl);
    }

    let downloadSuccess = false;

    for (const testUrl of urlCandidates) {
      const headerConfigs: Record<string, string>[] = [];

      if (isGoogleApi) {
        const apiKey = auth.apiKey || process.env.GEMINI_API_KEY || '';
        headerConfigs.push({
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
          'x-goog-api-key': apiKey,
          Accept: 'image/avif,image/webp,image/*,video/*,*/*;q=0.8',
        });
      } else if (isGoogle) {
        if (auth.cookies) {
          const authHeaders: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
            Accept: 'image/avif,image/webp,image/*,video/*,*/*;q=0.8',
            Cookie: auth.cookies,
            Referer: 'https://gemini.google.com/',
            Origin: 'https://gemini.google.com',
          };
          const authHeader = getGoogleAuthorizationHeader(auth.cookies);
          if (authHeader) {
            authHeaders['Authorization'] = authHeader;
            authHeaders['X-Goog-AuthUser'] = '0';
          }
          headerConfigs.push(authHeaders);
        }
        headerConfigs.push({
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/*,video/*,*/*;q=0.8',
        });
      } else {
        const stdHeaders: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/*,video/*,*/*;q=0.8',
        };
        if (testUrl.includes('tikwm.com') || testUrl.includes('tiktokcdn') || testUrl.includes('tiktok.com')) {
          stdHeaders['Referer'] = 'https://www.tikwm.com/';
        }
        headerConfigs.push(stdHeaders);
      }

      for (const hdrs of headerConfigs) {
        try {
          const response = await axios.get(testUrl, {
            headers: hdrs,
            responseType: 'arraybuffer',
            validateStatus: (status) => status >= 200 && status < 300,
            timeout: 45000,
            maxRedirects: 5,
          });

          const rawContentType = String(response.headers['content-type'] || 'application/octet-stream');
          const contentType = rawContentType.split(';')[0].trim().toLowerCase();

          // Reject HTML, text, or json error / cookie-check responses
          if (contentType.includes('text/html') || contentType.includes('application/json') || contentType.includes('text/plain')) {
            continue;
          }

          const buf = Buffer.from(response.data);
          if (buf.length < 64) {
            continue;
          }

          const headStr = buf.slice(0, 512).toString('utf-8').toLowerCase();
          if (
            headStr.includes('<!doctype') ||
            headStr.includes('<html') ||
            headStr.includes('<body') ||
            headStr.includes('cookie check') ||
            headStr.includes('service login') ||
            headStr.includes('accounts.google.com')
          ) {
            continue;
          }

          const mimeToExt: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'image/gif': 'gif',
            'image/svg+xml': 'svg',
            'video/mp4': 'mp4',
            'video/webm': 'webm',
            'video/quicktime': 'mov',
            'video/x-matroska': 'mkv',
          };

          const detectedExt = mimeToExt[contentType] || (contentType.startsWith('video') ? 'mp4' : 'png');
          let finalFilename = customFilename ? customFilename.replace(/[^a-zA-Z0-9._-]/g, '_') : '';
          if (!finalFilename) {
            finalFilename = `media_${Date.now()}.${detectedExt}`;
          } else if (!finalFilename.includes('.')) {
            finalFilename = `${finalFilename}.${detectedExt}`;
          }

          res.status(response.status || 200);
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"; filename*=UTF-8''${encodeURIComponent(finalFilename)}`);
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Content-Length', buf.length);

          res.send(buf);
          downloadSuccess = true;
          break;
        } catch (axiosErr: any) {
          // Attempt next strategy
        }
      }

      if (downloadSuccess) break;
    }

    if (downloadSuccess) return;

    // Curl fallback for download with binary safety inspection
    const curlSuccess = await streamWithCurl(targetUrl, req, res, auth.cookies, customFilename || `media_${Date.now()}.mp4`);
    if (curlSuccess) return;

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Gagal mendownload media dari server tujuan. Silakan coba lagi atau unduh langsung dari tautan sumber.',
      });
    }
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({
        error: `Gagal mendownload media dari server (${err?.message || 'Network error'})`,
      });
    }
  }
};

function addDirectoryToZipSync(zip: JSZip, folderPath: string, baseFolderPath: string) {
  if (!fs.existsSync(folderPath)) return;
  const items = fs.readdirSync(folderPath);

  for (const item of items) {
    if (item.startsWith('.') && item !== '.github') continue;
    if (item === 'node_modules') continue;

    const fullPath = path.join(folderPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      addDirectoryToZipSync(zip, fullPath, baseFolderPath);
    } else {
      const relativePath = path.relative(baseFolderPath, fullPath).replace(/\\/g, '/');
      const fileData = fs.readFileSync(fullPath);
      zip.file(relativePath, fileData);
    }
  }
}

// Endpoint to download extension ZIP dynamically with accurate headers and fresh files
export const handleExtensionDownload = async (req: any, res: any) => {
  try {
    const rawType = (req.params?.type || req.query?.type || 'weavy').toString().toLowerCase();
    const rootDir = process.cwd();

    let targetDirName = 'ektension-weavy';
    let defaultFilename = 'ektension-weavy.zip';

    if (rawType.includes('gemini')) {
      targetDirName = 'ektension-gemini-google';
      defaultFilename = 'ektension-gemini-google.zip';
    } else if (rawType.includes('dola')) {
      targetDirName = 'Extension-Dola';
      defaultFilename = 'Extension-Dola.zip';
    }

    const folderPath = path.join(rootDir, targetDirName);
    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: `Folder ekstensi "${targetDirName}" tidak ditemukan di server.` });
    }

    const zip = new JSZip();
    addDirectoryToZipSync(zip, folderPath, folderPath);

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    // Also persist to public and root folder so direct file links also work
    try {
      const publicPath = path.join(rootDir, 'public', defaultFilename);
      const rootPath = path.join(rootDir, defaultFilename);
      fs.writeFileSync(publicPath, buffer);
      fs.writeFileSync(rootPath, buffer);
    } catch (writeErr) {
      console.warn('[Extension Download] Could not cache zip to disk:', writeErr);
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${defaultFilename}"; filename*=UTF-8''${encodeURIComponent(defaultFilename)}`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');

    return res.send(buffer);
  } catch (err: any) {
    console.error('[Extension Download Error]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: `Gagal membuat paket ZIP ekstensi: ${err?.message || 'Internal server error'}` });
    }
  }
};

router.get('/extension/download', handleExtensionDownload);
router.get('/extension/download/:type', handleExtensionDownload);
router.get('/extension-download', handleExtensionDownload);
router.get('/download-extension', handleExtensionDownload);

router.get('/proxy-download', handleProxyDownload);
router.get('/download', handleProxyDownload);

export default router;
