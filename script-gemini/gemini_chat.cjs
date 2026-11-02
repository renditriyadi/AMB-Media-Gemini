/**
 * =========================================================================================
 * GEMINI WEB CLIENT (cURL BASH / WEB SESSION RPC ENGINE)
 * =========================================================================================
 * ⚠️ CATATAN ARSITEKTUR & INTEGRASI PENTING:
 * Modul ini adalah core engine untuk seluruh generasi Google Gemini di project ini:
 * - TIDAK MENGGUNAKAN API KEY GOOGLE (AIzaSy...).
 * - MURNI MENGEKSEKUSI RPC GOOGLE GEMINI WEB (StreamGenerate, batchexecute, Scotty Upload)
 *   menggunakan kredensial sesi browser/cURL bash dari input user (`__Secure-1PSID`, `SAPISID`, `SID`, `COMPASS`, `SNlM0e`, dll.).
 * - Memungkinkan generasi Text-to-Video & Image-to-Video (Google Veo) serta Image Generation (Imagen 3)
 *   langsung dengan kuota web akun pengguna tanpa batasan API Key developer.
 * =========================================================================================
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// Default active Google session cookies from user (empty by default, supplied dynamically per user/account)
const DEFAULT_COOKIES = '';
const VIDEO_HANDOFF_TIMEOUT_MS = 120000;

function sanitizeGeminiPrompt(prompt) {
  return String(prompt || '')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}\uFE0F\uFE0E\u200D\u20E3\u{E0020}-\u{E007F}]/gu, '')
    .replace(/(?:[:;=]-?[)(/\\DPp]|<3)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

// Helper to detect if a text from Gemini is specifically a daily quota / limit exhaustion
function isQuotaExhaustedText(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  // Substantial content (marketing strategy, product breakdown, scripts) is NEVER a quota error
  if (trimmed.length > 300 || trimmed.includes('#') || trimmed.includes('* **') || trimmed.includes('\n- ') || trimmed.includes('\n* ')) {
    return false;
  }
  const lower = trimmed.toLowerCase();
  const quotaPatterns = [
    /tidak bisa membuatkan Anda video lagi hari ini/i,
    /tidak bisa membuatkan.*video.*lagi hari ini/i,
    /tidak bisa membuat.*video.*lagi hari ini/i,
    /tidak bisa membuatkan.*video.*hari ini/i,
    /tidak bisa membuat.*video.*hari ini/i,
    /mencapai batas.*(harian|video|generasi|kuota)/i,
    /batas harian.*(tercapai|habis|maksimal)/i,
    /batas.*pembuatan video.*(?:habis|tercapai)/i,
    /kuota.*(?:video|generasi).*(?:habis|tercapai|penuh|terlampaui)/i,
    /kuota pembuatan video/i,
    /quota.*(exceeded|reached|exhausted|limit)/i,
    /daily limit.*(reached|exceeded|exhausted)/i,
    /reached.*(your|the)?\s*(daily)?\s*(limit|quota)/i,
    /cannot create any more videos/i,
    /can't create any more videos/i,
    /unable to create any more videos/i,
    /unable to generate more videos/i,
    /coba lagi besok.*video/i,
    /try again tomorrow.*video/i,
  ];
  return quotaPatterns.some((pattern) => pattern.test(lower));
}

// Helper to detect if a text from Gemini is an explicit refusal, quota limit, policy error, high traffic/capacity overload, or inability to create video
function isRefusalOrErrorText(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  // Any detailed content (> 300 chars, or containing markdown structures like headings or bullet points) is genuine generated content, NEVER a short system refusal error!
  if (trimmed.length > 300 || trimmed.includes('#') || trimmed.includes('* **') || trimmed.includes('\n- ') || trimmed.includes('\n* ')) {
    return false;
  }
  const lower = trimmed.toLowerCase();
  
  const refusalPatterns = [
    // Video Generation Traffic & Capacity Failures
    /traffic pembuatan video.*(?:tinggi|penuh|padat)/i,
    /traffic.*saat ini sedang luar biasa tinggi.*kapasitas/i,
    /kapasitas pembuatan video.*penuh/i,
    /kapasitas.*penuh.*coba lagi/i,
    /kapasitas saya penuh/i,
    /kapasitas sedang penuh/i,
    /server pembuatan video sedang sibuk/i,
    /high traffic.*video/i,
    /video.*high traffic/i,
    /video.*over capacity/i,
    /capacity is full/i,

    // Inability / Refusal Patterns for Video
    /saya hanya model bahasa dan tidak (?:dapat|bisa) membuat video/i,
    /saya hanya sebuah model bahasa.*tidak (?:dapat|bisa) membuat video/i,
    /i am only a language model.*cannot (?:generate|create|make) video/i,
    /tidak bisa membuatkan.*video/i,
    /tidak bisa membuat.*video/i,
    /tidak dapat membuatkan.*video/i,
    /tidak dapat membuat.*video/i,
    /tidak bisa menghasilkan.*video/i,
    /tidak bisa buatkan.*video/i,
    /tidak mampu membuat video/i,
    /cannot generate.*video/i,
    /cannot make.*video/i,
    /can't make.*video/i,
    /can't generate.*video/i,
    /unable to generate.*video/i,
    /cannot create any more videos/i,
    /not able to create.*video/i,
    /saya tidak memiliki kemampuan untuk membuat video/i,
    /can't create.*available in your location/i,
    /belum bisa membuatkannya.*belum tersedia di lokasi/i,
    /batas harian.*video/i,
    /kuota.*video.*habis/i,
    /daily limit.*video/i,
    /reached (?:your|the) (?:daily )?limit (?:for|to create) video/i,

    // Google Gemini Web Internal Errors & Glitches
    /i encountered an error doing what you asked/i,
    /i encountered an error/i,
    /something went wrong.*try again/i,
    /an error occurred while processing/i,
    /terjadi kesalahan.*coba lagi/i,
  ];

  return refusalPatterns.some((pattern) => pattern.test(lower));
}

class GeminiWebClient {
  constructor(cookies = DEFAULT_COOKIES) {
    let rawInput = typeof cookies === 'string' && cookies.trim().length > 0 ? cookies.trim() : DEFAULT_COOKIES;
    let cleanCookies = rawInput;
    
    // Extract cookies from -b or --cookie or -H 'cookie:...'
    const bMatch = rawInput.match(/(?:-b|--cookie)\s+(?:'([^']+)'|"([^"]+)"|([^\s\r\n\\]+))/i);
    if (bMatch) {
      cleanCookies = bMatch[1] || bMatch[2] || bMatch[3] || cleanCookies;
    }
    const hMatch = rawInput.match(/-H\s+['"][Cc]ookie:\s*([^'"]+)['"]/i);
    if (hMatch) {
      cleanCookies = hMatch[1];
    }
    this.cookies = cleanCookies;
    this.snlm0e = null;
    this.bl = 'boq_assistant-bard-web-server_20261001.00_p1';
    this.fdrfje = null;
    this.conversationId = null;
    this.responseId = null;
    this.choiceId = null;
    this.reqId = Math.floor(Math.random() * 90000) + 10000;

    // Extract bl, f.sid, and at (SNlM0e) from cURL if present
    const blMatch = rawInput.match(/[?&]bl=([^&'"]+)/);
    if (blMatch) {
      try { this.bl = decodeURIComponent(blMatch[1]); } catch { this.bl = blMatch[1]; }
    }
    const sidMatch = rawInput.match(/[?&]f\.sid=([^&'"]+)/);
    if (sidMatch) {
      try { this.fdrfje = decodeURIComponent(sidMatch[1]); } catch { this.fdrfje = sidMatch[1]; }
    }
    const atMatch = rawInput.match(/[?&]at=([^&'"]+)/) || rawInput.match(/at=([A-Za-z0-9_-]+:[0-9]+)/);
    if (atMatch) {
      try { this.snlm0e = decodeURIComponent(atMatch[1]); } catch { this.snlm0e = atMatch[1]; }
    }
  }

  setContext({ conversationId, responseId, choiceId } = {}) {
    if (conversationId) this.conversationId = conversationId;
    if (responseId) this.responseId = responseId;
    if (choiceId) this.choiceId = choiceId;
  }

  getSapisidHash(origin = 'https://gemini.google.com') {
    const sapisidMatch = this.cookies.match(/(?:__Secure-[13]P)?SAPISID=([^;]+)/);
    if (!sapisidMatch) return null;
    const sapisid = sapisidMatch[1].trim();
    const timestamp = Math.floor(Date.now() / 1000);
    const hash = crypto.createHash('sha1').update(`${timestamp} ${sapisid} ${origin}`).digest('hex');
    return `${timestamp}_${hash}`;
  }

  getAuthorizationHeader(origin = 'https://gemini.google.com') {
    const timestamp = Math.floor(Date.now() / 1000);
    const sMatch = this.cookies.match(/SAPISID=([^;]+)/);
    const s1pMatch = this.cookies.match(/__Secure-1PAPISID=([^;]+)/);
    const s3pMatch = this.cookies.match(/__Secure-3PAPISID=([^;]+)/);

    const sVal = sMatch ? sMatch[1].trim() : (s1pMatch ? s1pMatch[1].trim() : null);
    if (!sVal) return null;

    const s1pVal = s1pMatch ? s1pMatch[1].trim() : sVal;
    const s3pVal = s3pMatch ? s3pMatch[1].trim() : sVal;

    const hash = crypto.createHash('sha1').update(`${timestamp} ${sVal} ${origin}`).digest('hex');
    const hash1p = crypto.createHash('sha1').update(`${timestamp} ${s1pVal} ${origin}`).digest('hex');
    const hash3p = crypto.createHash('sha1').update(`${timestamp} ${s3pVal} ${origin}`).digest('hex');

    return `SAPISIDHASH ${timestamp}_${hash} SAPISID1PHASH ${timestamp}_${hash1p} SAPISID3PHASH ${timestamp}_${hash3p}`;
  }

  _updateCookies(setCookieHeader) {
    if (!setCookieHeader) return;
    const cookiesArray = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    const currentCookies = new Map();
    this.cookies.split(';').forEach(c => {
      const parts = c.trim().split('=');
      if (parts[0]) currentCookies.set(parts[0], parts.slice(1).join('='));
    });
    for (const cookieStr of cookiesArray) {
      const firstPart = cookieStr.split(';')[0];
      const parts = firstPart.trim().split('=');
      if (parts[0]) {
        currentCookies.set(parts[0], parts.slice(1).join('='));
      }
    }
    this.cookies = Array.from(currentCookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  _cleanGoogleError(errBody, statusCode) {
    if (!errBody) return `Gemini Web mengembalikan status HTTP ${statusCode || 400}.`;
    let clean = String(errBody).replace(/^\)\]\}'\s*/, '').trim();
    try {
      const lines = clean.split('\n');
      for (const l of lines) {
        if (l.startsWith('[[')) {
          const parsed = JSON.parse(l);
          for (const item of parsed) {
            if (item && item[0] === 'er') {
              return `Gemini Web menolak permintaan (Kode RPC ${item[5] || statusCode}). Sesi obrolan di-reset otomatis.`;
            }
          }
        }
      }
      const parsed = JSON.parse(clean);
      if (parsed?.error?.message) return parsed.error.message;
      if (parsed?.message) return parsed.message;
    } catch (e) {
      const titleMatch = clean.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) return titleMatch[1].trim();
    }
    return clean.length > 200 ? clean.slice(0, 200) + '...' : clean;
  }

  async _request(url, options = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        maxHeaderSize: 1048576, // 1MB buffer to prevent HPE_HEADER_OVERFLOW
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
          'Cookie': this.cookies,
          ...(options.headers || {})
        }
      };
      const requestStartedAt = Date.now();
      if (options.logLifecycle) {
        console.log(
          `[${options.logLifecycle}] Sending ${reqOptions.method} ${parsedUrl.pathname}` +
          `${options.body ? ` (${Buffer.byteLength(options.body)} body bytes)` : ''}.`,
        );
      }

      const req = https.request(reqOptions, (res) => {
        if (res.headers && res.headers['set-cookie']) {
          this._updateCookies(res.headers['set-cookie']);
        }
        let data = '';
        let responseBytes = 0;
        let firstByteLogged = false;
        if (options.logLifecycle) {
          console.log(
            `[${options.logLifecycle}] HTTP response headers received after ${Date.now() - requestStartedAt}ms: ` +
            `status=${res.statusCode ?? 'unknown'}.`,
          );
        }
        res.on('data', chunk => {
          responseBytes += chunk.length;
          if (!firstByteLogged && options.logLifecycle) {
            firstByteLogged = true;
            console.log(
              `[${options.logLifecycle}] First response data received after ${Date.now() - requestStartedAt}ms.`,
            );
          }
          data += chunk;
        });
        res.on('end', () => {
          if (options.logLifecycle) {
            console.log(
              `[${options.logLifecycle}] Response completed ${Date.now() - requestStartedAt}ms after request start ` +
              `(${responseBytes} bytes).`,
            );
          }
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        });
      });
      const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 60000;
      req.setTimeout(timeoutMs, () => {
        const error = new Error(`Koneksi request ke Gemini Web timeout setelah ${Math.round(timeoutMs / 1000)} detik.`);
        if (options.logLifecycle) {
          console.warn(`[${options.logLifecycle}] Request timed out after ${Math.round(timeoutMs / 1000)}s.`);
        }
        req.destroy(error);
      });
      req.on('finish', () => {
        if (options.logLifecycle) {
          console.log(`[${options.logLifecycle}] Request body handed to the network stack.`);
        }
      });
      req.on('error', error => {
        if (options.logLifecycle) {
          console.warn(`[${options.logLifecycle}] Request failed: ${error.message || error}.`);
        }
        reject(error);
      });
      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  async initSession(forceRefresh = false) {
    if (! GeminiWebClient._sessionCache) {
      GeminiWebClient._sessionCache = new Map();
    }
    const cacheKey = crypto.createHash('sha1').update(this.cookies || '').digest('hex');
    const cached = GeminiWebClient._sessionCache.get(cacheKey);
    if (!forceRefresh && cached && Date.now() - cached.ts < 10 * 60 * 1000 && cached.snlm0e) {
      this.snlm0e = cached.snlm0e;
      if (cached.bl) this.bl = cached.bl;
      if (cached.fdrfje) this.fdrfje = cached.fdrfje;
      return this;
    }

    console.log('[Gemini] Fetching https://gemini.google.com/app for CSRF token (uS02ke / SNlM0e)...');
    const res = await this._request('https://gemini.google.com/app');
    
    // Parse WIZ_global_data if available (SNlM0e is authenticated user token, uS02ke is guest token)
    const wizMatch = res.body.match(/window\.WIZ_global_data\s*=\s*(\{[\s\S]*?\});/);
    if (wizMatch) {
      try {
        const wizData = JSON.parse(wizMatch[1]);
        if (wizData.SNlM0e) this.snlm0e = wizData.SNlM0e;
        else if (wizData.uS02ke) this.snlm0e = wizData.uS02ke;
        if (wizData.cfb2h) this.bl = wizData.cfb2h;
        if (wizData.FdrFJe) this.fdrfje = wizData.FdrFJe;
      } catch (e) {}
    }

    if (!this.snlm0e) {
      const snlm0eMatch = res.body.match(/"SNlM0e":"([^"]+)"/);
      const usMatch = res.body.match(/"uS02ke":"([^"]+)"/);
      if (snlm0eMatch) this.snlm0e = snlm0eMatch[1];
      else if (usMatch) this.snlm0e = usMatch[1];
    }

    const blMatch = res.body.match(/"cfb2h":"([^"]+)"/);
    const fdrMatch = res.body.match(/"FdrFJe":"([^"]+)"/);

    if (blMatch && !this.bl) this.bl = blMatch[1];
    if (fdrMatch && !this.fdrfje) this.fdrfje = fdrMatch[1];

    if (!this.snlm0e) {
      throw new Error('Gagal mengekstrak token CSRF (uS02ke / SNlM0e). Cookie Google mungkin sudah kadaluwarsa atau perlu diperbarui.');
    }

    GeminiWebClient._sessionCache.set(cacheKey, {
      snlm0e: this.snlm0e,
      bl: this.bl,
      fdrfje: this.fdrfje,
      ts: Date.now(),
    });

    console.log('[Gemini] Session initialized successfully.');
    console.log('  -> CSRF Token:', this.snlm0e.slice(0, 16) + '...');
    console.log('  -> Build ID:', this.bl);
    return this;
  }

  /**
   * Fetches conversation history using Google Bard/Gemini RPC hNvQHb
   */
  async getConversationHistory(convId, timeoutMs = 60000) {
    if (!this.snlm0e) {
      await this.initSession();
    }
    const cleanConvId = convId.startsWith('c_') ? convId : `c_${convId}`;
    const envelope = [[['hNvQHb', JSON.stringify([cleanConvId, 50, null, 1]), null, 'generic']]];
    const bodyParams = new URLSearchParams();
    bodyParams.append('f.req', JSON.stringify(envelope));
    bodyParams.append('at', this.snlm0e);

    const endpoint = `https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=hNvQHb&bl=${encodeURIComponent(this.bl)}&rt=c`;
    const res = await this._request(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Origin': 'https://gemini.google.com',
        'Referer': `https://gemini.google.com/app/${cleanConvId.replace('c_', '')}`,
        'X-Same-Domain': '1'
      },
      body: bodyParams.toString(),
      timeoutMs,
    });

    if (res.status !== 200) {
      throw new Error(`Failed to fetch conversation history (HTTP ${res.status})`);
    }

    let parsedData = null;
    let rpcError = null;
    const lines = res.body.split('\n');
    for (const line of lines) {
      if (!line.startsWith('[[')) continue;
      try {
        const outer = JSON.parse(line);
        for (const item of outer) {
          if (item[0] === 'er') {
            const errorInfo = item[2] || item[1] || JSON.stringify(item);
            rpcError = typeof errorInfo === 'object' ? JSON.stringify(errorInfo) : String(errorInfo);
          }
          if (item[0] === 'wrb.fr' && item[1] === 'hNvQHb' && typeof item[2] === 'string') {
            parsedData = JSON.parse(item[2]);
            break;
          }
        }
      } catch (e) {}
    }

    if (rpcError) {
      throw new Error(`Gemini Web RPC Error: ${rpcError}`);
    }
    if (parsedData === null) {
      throw new Error('Gemini conversation-history response did not contain the expected RPC payload.');
    }

    return parsedData;
  }

  /**
   * Fetches recent conversation list from Google Gemini RPC MaZiqc
   */
  async listConversations(limit = 50) {
    if (!this.snlm0e) {
      await this.initSession();
    }
    const envelope = [[['MaZiqc', JSON.stringify([limit, null, []]), null, 'generic']]];
    const bodyParams = new URLSearchParams();
    bodyParams.append('f.req', JSON.stringify(envelope));
    bodyParams.append('at', this.snlm0e);

    const endpoint = `https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=MaZiqc&bl=${encodeURIComponent(this.bl)}&rt=c`;
    const res = await this._request(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Origin': 'https://gemini.google.com',
        'Referer': 'https://gemini.google.com/app',
        'X-Same-Domain': '1',
      },
      body: bodyParams.toString(),
    });

    if (res.status !== 200) {
      throw new Error(`Gagal membaca daftar percakapan Gemini (HTTP ${res.status})`);
    }

    let chatList = [];
    const lines = res.body.split('\n');
    for (const line of lines) {
      if (!line.startsWith('[[')) continue;
      try {
        const outer = JSON.parse(line);
        for (const item of outer) {
          if (item[0] === 'wrb.fr' && item[1] === 'MaZiqc' && typeof item[2] === 'string') {
            const inner = JSON.parse(item[2]);
            if (Array.isArray(inner) && Array.isArray(inner[2])) {
              chatList = inner[2];
            }
            break;
          }
        }
      } catch (e) {}
    }

    return chatList.map((c) => {
      let rawTime = Array.isArray(c[5]) ? c[5][0] : (typeof c[5] === 'number' ? c[5] : 0);
      if (rawTime > 1000000000000000) {
        rawTime = Math.floor(rawTime / 1000000); // Microseconds to seconds
      } else if (rawTime > 1000000000000) {
        rawTime = Math.floor(rawTime / 1000); // Milliseconds to seconds
      }
      return {
        id: c[0],
        title: c[1] || 'Obrolan Gemini',
        timeSec: rawTime,
        timestamp: new Date(rawTime * 1000),
      };
    });
  }

  /**
   * Counts generated video assets in Gemini conversation histories and detects quota exhaustion.
   * The internal account credit limit is two videos and does not reset.
   */
  async countTodayGenerations() {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const todayStr = formatter.format(now); // e.g. "2026-10-18"

      const chats = await this.listConversations(100);
      const targetChats = Array.isArray(chats) ? chats : [];
      const uniqueChats = [];
      const seenChatIds = new Set();
      for (const chat of targetChats) {
        const chatId = typeof chat?.id === 'string' ? chat.id.trim() : '';
        if (!chatId || seenChatIds.has(chatId)) continue;
        seenChatIds.add(chatId);
        uniqueChats.push({ ...chat, id: chatId });
      }
      let hasQuotaRefusal = false;
      let totalVideos = 0;
      const results = [];
      const concurrency = 5;
      let historyErrors = 0;

      // Scan recent conversation histories; Gemini can keep multiple video turns in one chat.
      const chatsToCheck = uniqueChats.slice(0, 100);
      const conversationListComplete = targetChats.length < 100;

      for (let i = 0; i < chatsToCheck.length; i += concurrency) {
        const batch = chatsToCheck.slice(i, i + concurrency);
        const batchResults = await Promise.all(
          batch.map(async (c) => {
            try {
              const hist = await this.getConversationHistory(c.id);
              let chatQuotaRefusal = false;

              const videos = this.extractVideosFromHistory(hist);
              const videoCount = videos.length;
              const ref = this.extractRefusalFromHistory ? this.extractRefusalFromHistory(hist) : null;
              if (ref && isQuotaExhaustedText(ref)) {
                chatQuotaRefusal = true;
                hasQuotaRefusal = true;
              }

              return {
                chatId: c.id,
                videoCount,
                videoIds: videos.map((video) => video.assetId).filter(Boolean),
                chatQuotaRefusal,
              };
            } catch (err) {
              historyErrors++;
              console.warn(`[countTodayGenerations] Gagal membaca riwayat chat ${c.id}:`, err.message || err);
              return {
                chatId: c.id,
                videoCount: 0,
                videoIds: [],
                chatQuotaRefusal: false,
                error: true,
              };
            }
          })
        );

        results.push(...batchResults);

      }

      totalVideos = results.reduce((acc, r) => acc + r.videoCount, 0);
      const isQuotaExhausted = hasQuotaRefusal || totalVideos >= 2;
      const usedTotal = isQuotaExhausted ? 2 : Math.min(2, Math.max(0, totalVideos));
      const totalCredits = 2;
      const remainingCredits = isQuotaExhausted ? 0 : Math.max(0, totalCredits - usedTotal);
      const complete = conversationListComplete && historyErrors === 0;

      return {
        success: complete || isQuotaExhausted,
        complete,
        ...(historyErrors > 0 ? { error: `Tidak dapat memeriksa ${historyErrors} dari ${chatsToCheck.length} riwayat percakapan Gemini.` } : {}),
        ...(!conversationListComplete ? { error: 'Pemindaian dibatasi 100 percakapan; hasil di bawah dua video belum lengkap.' } : {}),
        date: todayStr,
        totalCredits,
        usedTotal,
        usedToday: usedTotal,
        observedVideoCount: totalVideos,
        remainingCredits,
        isQuotaExhausted,
        chatQuotaRefusal: hasQuotaRefusal,
        totalConversationsChecked: results.length,
        failedConversations: historyErrors,
        scannedChatIds: results.map((result) => result.chatId),
        chatVideoDetails: results,
      };
    } catch (e) {
      console.warn('[countTodayGenerations error]:', e.message || e);
      return {
        success: false,
        error: e.message || 'Gagal memeriksa percakapan Gemini',
        totalCredits: 2,
        usedToday: 0,
        usedTotal: 0,
        observedVideoCount: 0,
        remainingCredits: 2,
        isQuotaExhausted: false,
        complete: false,
        totalConversationsChecked: 0,
        failedConversations: 0,
        scannedChatIds: [],
        chatVideoDetails: [],
      };
    }
  }

  /**
   * Extracts video details from conversation history data
   */
  getAssistantPayloads(historyData) {
    if (!Array.isArray(historyData) || !Array.isArray(historyData[0])) return [];
    const turns = historyData[0];
    const payloads = [];
    for (let i = turns.length - 1; i >= 0; i--) {
      const turn = turns[i];
      if (!Array.isArray(turn) || turn.length < 4 || !Array.isArray(turn[3])) continue;
      if (Array.isArray(turn[3][0])) payloads.push(turn[3]);
    }
    return payloads;
  }

  getLatestAssistantPayload(historyData) {
    return this.getAssistantPayloads(historyData)[0] || null;
  }

  extractVideoFromHistory(historyData) {
    if (!historyData) return null;
    const assistantPayload = this.getLatestAssistantPayload(historyData);
    return this.extractVideosFromPayload(assistantPayload)[0] || null;
  }

  getVideoUrlIdentities(urls) {
    const volatileParams = new Set([
      'authuser',
      'expire',
      'keepalive',
      'range',
      'rn',
      'rbuf',
      'signature',
      'sig',
      'source',
      'token',
      'itag',
    ]);
    const identities = new Set();

    for (const rawUrl of urls) {
      if (typeof rawUrl !== 'string' || !rawUrl) continue;
      try {
        const parsed = new URL(rawUrl);
        const stableParams = [...parsed.searchParams.entries()]
          .filter(([key]) => !volatileParams.has(key.toLowerCase()))
          .sort(([keyA, valueA], [keyB, valueB]) =>
            keyA.localeCompare(keyB) || valueA.localeCompare(valueB)
          );
        for (const [key, value] of stableParams) {
          if (['id', 'video_id', 'videoid', 'file_id', 'fileid', 'resource_id', 'docid'].includes(key.toLowerCase())) {
            identities.add(`asset:${key.toLowerCase()}=${value}`);
          }
        }
        const genericVideoPath = /\/videoplayback\/?$/i.test(parsed.pathname);
        const base = `${parsed.origin}${parsed.pathname.replace(/=(?:m\d+|s\d+)$/i, '')}`;

        if (stableParams.length > 0) {
          const query = new URLSearchParams(stableParams).toString();
          identities.add(`${base}?${query}`);
        } else if (!genericVideoPath) {
          identities.add(base);
        } else {
          parsed.hash = '';
          identities.add(parsed.toString());
        }
      } catch {
        identities.add(rawUrl.replace(/=(?:m\d+|s\d+)$/i, ''));
      }
    }

    return identities;
  }

  extractVideosFromHistory(historyData) {
    if (!historyData) return [];
    const videos = [];
    const seen = new Set();

    for (const payload of this.getAssistantPayloads(historyData)) {
      for (const video of this.extractVideosFromPayload(payload)) {
        const identities = this.getVideoUrlIdentities(video.allUrls || [video.rawBaseUrl]);
        if (identities.size > 0 && [...identities].some((identity) => seen.has(identity))) continue;
        for (const identity of identities) seen.add(identity);
        videos.push(video);
      }
    }
    return videos;
  }

  extractVideosFromPayload(assistantPayload) {
    if (!assistantPayload) return [];
    const videos = [];
    const seen = new Set();

    const scan = (obj) => {
      if (!obj) return;
      if (Array.isArray(obj)) {
        const isVideoFilename = typeof obj[2] === 'string' && (obj[2] === 'video.mp4' || /\.(mp4|mov|webm)$/i.test(obj[2]));
        const hasDirectVideoUrls = Array.isArray(obj[7]) && obj[7].length > 0 && obj[7].some(u => typeof u === 'string' && (u.includes('contribution.usercontent.google.com') || u.includes('=m22') || u.includes('googlevideo.com') || /\.(mp4|mov|webm)/i.test(u)));

        if (obj.length >= 8 && (isVideoFilename || hasDirectVideoUrls) && Array.isArray(obj[7]) && obj[7].length > 0) {
          const directUrls = obj[7];
          const rawBaseUrl = (directUrls[0] || '').split('=')[0];
          const identities = this.getVideoUrlIdentities(directUrls);
          const isDuplicate = identities.size > 0 && [...identities].some((identity) => seen.has(identity));
          if (!isDuplicate) {
            for (const identity of identities) seen.add(identity);
            const assetIdentity = [...identities].sort()[0] || JSON.stringify(directUrls);
            const posterUrl = rawBaseUrl ? `${rawBaseUrl}=s0` : (directUrls[0] || '');
            const streamUrl = rawBaseUrl ? `${rawBaseUrl}=m22` : directUrls[0];
            const downloadUrl = directUrls.find(u => u && u.includes('contribution.usercontent.google.com')) || streamUrl;

            videos.push({
              assetId: crypto.createHash('sha256').update(assetIdentity).digest('hex').slice(0, 12),
              fileName: obj[2] || 'video.mp4',
              mimeType: obj[11] || 'video/mp4',
              fileSize: obj[26] || 0,
              duration: obj[18]?.[0]?.[0] ? `${Math.round(obj[18][0][0])}s` : '10s',
              resolution: obj[18]?.[1] && obj[18]?.[2] ? `${obj[18][1]}x${obj[18][2]}` : '1280x720 (16:9)',
              rawBaseUrl,
              playbackUrl: streamUrl,
              coverUrl: posterUrl,
              downloadUrl,
              allUrls: directUrls
            });
          }
        }
        for (const item of obj) scan(item);
      } else if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) scan(obj[key]);
      }
    };

    scan(assistantPayload);
    return videos;
  }

  /**
   * Extracts refusal or limit explanation text from conversation history if no video was created
   */
  extractRefusalFromHistory(historyData) {
    if (!historyData) return null;
    const assistantPayload = this.getLatestAssistantPayload(historyData);
    if (!assistantPayload) return null;
    let refusalText = null;

    const scan = (obj) => {
      if (!obj || refusalText) return;
      if (typeof obj === 'string') {
        if (isRefusalOrErrorText(obj)) {
          refusalText = obj;
          return;
        }
      } else if (Array.isArray(obj)) {
        for (const item of obj) scan(item);
      } else if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) scan(obj[key]);
      }
    };

    scan(assistantPayload);
    return refusalText;
  }

  /**
   * Helper to check if a text is a progress notification from Google Gemini Veo
   */
  isProgressNoticeText(text) {
    if (!text || typeof text !== 'string') return false;
    const l = text.toLowerCase();
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

  /**
   * Checks if video generation tool is actively rendering in the background
   */
  isVideoGeneratingActive(historyData) {
    if (!historyData) return false;
    const assistantPayload = this.getLatestAssistantPayload(historyData);
    if (!assistantPayload) return false;
    let isActivelyGenerating = false;
    const scan = (obj) => {
      if (!obj || isActivelyGenerating) return;
      if (typeof obj === 'string') {
        // Jika teks adalah pesan error/penolakan (seperti traffic penuh/kapasitas), ini BUKAN proses aktif!
        if (isRefusalOrErrorText(obj)) {
          return;
        }
        if (this.isProgressNoticeText(obj)) {
          isActivelyGenerating = true;
          return;
        }
      } else if (Array.isArray(obj)) {
        if (
          obj.length >= 1 &&
          (obj[0] === 'video_generation' ||
           (typeof obj[0] === 'string' && (obj[0].includes('video_generation') || obj[0].includes('generasi video'))))
        ) {
          isActivelyGenerating = true;
          return;
        }
        for (const item of obj) scan(item);
      } else if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) scan(obj[key]);
      }
    };
    scan(assistantPayload);
    return isActivelyGenerating;
  }

  /**
   * Extracts latest response text from assistant in history
   */
  extractLatestAssistantText(historyData) {
    if (!historyData) return null;
    const assistantPayload = this.getLatestAssistantPayload(historyData);
    if (!assistantPayload) return null;

    const isModelOrMetaToken = (str) => {
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
    };

    // 1. Structured Turn Extraction (Targeting turn[3] which is the Assistant Candidate block)
    if (assistantPayload) {
      const candidates = assistantPayload[0];
      for (const cand of candidates) {
        if (Array.isArray(cand) && Array.isArray(cand[1])) {
          for (const seg of cand[1]) {
            if (typeof seg === 'string') {
              const trimmed = seg.trim();
              if (trimmed.length > 0 && !isModelOrMetaToken(trimmed)) {
                return trimmed;
              }
            }
          }
        }
      }
      return null;
    }

    return null;
  }

  /**
   * Extracts fatal server errors, RPC failure frames, or USD frame write errors from conversation history
   */
  extractErrorFromHistory(historyData) {
    if (!historyData) return null;
    const assistantPayload = this.getLatestAssistantPayload(historyData);
    if (!assistantPayload) return null;
    let foundError = null;

    const scan = (obj) => {
      if (!obj || foundError) return;
      if (Array.isArray(obj)) {
        // Check for fatal Google RPC failure frame, but ignore transient / shedding warnings if it's SHEDDABLE or during generation
        if (
          obj.length >= 3 &&
          typeof obj[0] === 'number' &&
          typeof obj[2] === 'string' &&
          (obj[2].includes('RPC failed') || obj[2].includes('Failed to write video frame')) &&
          !obj[2].includes('SHEDDABLE')
        ) {
          foundError = `Google Gemini Backend Error: ${obj[2]}`;
          return;
        }

        for (const item of obj) scan(item);
      } else if (typeof obj === 'string') {
        if (isRefusalOrErrorText(obj)) {
          foundError = obj;
          return;
        }
        if (
          (obj.includes('RPC failed') || obj.includes('Failed to write video frame')) &&
          !obj.includes('SHEDDABLE')
        ) {
          foundError = `Google Gemini Error: ${obj}`;
          return;
        }
      } else if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) scan(obj[key]);
      }
    };

    scan(assistantPayload);
    return foundError;
  }

  /**
   * Polls a video generation task until finished
   */
  async pollVideoGeneration(convId, maxWaitSeconds = 120, intervalMs = 4000) {
    const cleanConvId = convId.startsWith('c_') ? convId : `c_${convId}`;
    const startTime = Date.now();
    const maxTime = startTime + (maxWaitSeconds * 1000);

    console.log(`[Gemini Video] Menunggu proses rendering video Veo di background untuk sesi ${cleanConvId}...`);
    while (Date.now() < maxTime) {
      await new Promise(r => setTimeout(r, intervalMs));
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      try {
        const history = await this.getConversationHistory(cleanConvId);
        const video = this.extractVideoFromHistory(history);
        if (video) {
          console.log(`[Gemini Video] ✅ Video BERHASIL dibuat setelah ${elapsed} detik!`);
          return video;
        }

        const serverError = this.extractErrorFromHistory(history);
        if (serverError) {
          console.warn(`[Gemini Video] ❌ Terdeteksi error server di sesi ${cleanConvId}: ${serverError}`);
          throw new Error(serverError);
        }

        const refusal = this.extractRefusalFromHistory(history);
        if (refusal) {
          console.warn(`[Gemini Video] ❌ Penolakan terdeteksi di sesi ${cleanConvId}: ${refusal}`);
          throw new Error(refusal);
        }

        process.stdout.write(`  ⏳ Merender video... (${elapsed}s)\r`);
      } catch (e) {
        if (e.message && (e.message.includes('Error') || e.message.includes('gagal') || e.message.includes('RPC') || isRefusalOrErrorText(e.message))) {
          throw e;
        }
        // Retrying on transient network fetch glitch
      }
    }

    throw new Error(`Video generation timeout setelah ${maxWaitSeconds} detik.`);
  }

  /**
   * Download media (image/video) with session authentication & candidate fallback
   */
  async downloadMedia(mediaInput, outputPath) {
    const candidateUrls = [];
    if (typeof mediaInput === 'string') {
      const trimmed = mediaInput.trim();
      candidateUrls.push(trimmed);
      if (trimmed.includes('googleusercontent.com')) {
        const rawBase = trimmed.split('=')[0];
        if (rawBase && !candidateUrls.includes(`${rawBase}=m22`)) candidateUrls.push(`${rawBase}=m22`);
        if (rawBase && !candidateUrls.includes(`${rawBase}=dv`)) candidateUrls.push(`${rawBase}=dv`);
        if (rawBase && !candidateUrls.includes(`${rawBase}=m18`)) candidateUrls.push(`${rawBase}=m18`);
      }
    } else if (mediaInput && typeof mediaInput === 'object') {
      const rawBase = mediaInput.rawBaseUrl || (mediaInput.playbackUrl ? mediaInput.playbackUrl.split('=')[0] : '');
      if (rawBase) {
        candidateUrls.push(`${rawBase}=m22`);
        candidateUrls.push(`${rawBase}=dv`);
        candidateUrls.push(`${rawBase}=m18`);
      }
      if (mediaInput.downloadUrl && !candidateUrls.includes(mediaInput.downloadUrl)) {
        candidateUrls.push(mediaInput.downloadUrl);
      }
      if (mediaInput.playbackUrl && !candidateUrls.includes(mediaInput.playbackUrl)) {
        candidateUrls.push(mediaInput.playbackUrl);
      }
      if (Array.isArray(mediaInput.allUrls)) {
        for (const u of mediaInput.allUrls) {
          if (typeof u === 'string' && u.startsWith('http') && !candidateUrls.includes(u)) {
            candidateUrls.push(u);
          }
        }
      }
    }

    if (candidateUrls.length === 0) {
      throw new Error('Tidak ada URL media yang valid untuk diunduh.');
    }

    const { spawn } = require('child_process');

    const origin = 'https://gemini.google.com';
    const authHeader = this.getAuthorizationHeader(origin) || (this.getSapisidHash(origin) ? `SAPISIDHASH ${this.getSapisidHash(origin)}` : '');

    const tryDownloadSingleUrl = async (targetUrl) => {
      return new Promise((resolve, reject) => {
        // Use spawn with array arguments to avoid any bash interpolation or quotation mangling
        const args = [
          '-s',
          '-L',
          '--location-trusted',
          '--max-time', '90',
          '-b', this.cookies,
          '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
          '-H', `Authorization: ${authHeader}`,
          '-H', 'X-Goog-AuthUser: 0',
          '-H', 'Referer: https://gemini.google.com/',
          '-H', 'Origin: https://gemini.google.com',
          '-H', 'Accept: video/mp4,video/*,*/*',
          targetUrl,
          '-o', outputPath
        ];

        const proc = spawn('curl', args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        proc.stderr?.on('data', (d) => { stderr += d.toString(); });

        proc.on('close', (code) => {
          if (code !== 0) {
            return reject(new Error(`curl exited with code ${code}: ${stderr}`));
          }
          if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            // Minimum size for valid video (at least 20KB)
            if (stats.size > 20000) {
              try {
                const fd = fs.openSync(outputPath, 'r');
                const headerBuf = Buffer.alloc(16);
                fs.readSync(fd, headerBuf, 0, 16, 0);
                fs.closeSync(fd);

                // If it starts with JPEG magic (\xFF\xD8\xFF), it's a poster image, not video
                if (headerBuf[0] === 0xff && headerBuf[1] === 0xd8 && headerBuf[2] === 0xff) {
                  return reject(new Error('Unduhan terdeteksi gambar JPEG poster, bukan stream MP4.'));
                }
                // If it starts with HTML (<!DOCTYPE or <html), it's an error page
                const headStr = headerBuf.toString('utf-8').toLowerCase();
                if (headStr.includes('<!doc') || headStr.includes('<html')) {
                  return reject(new Error('Unduhan terdeteksi halaman HTML/Error dari Google.'));
                }

                return resolve(outputPath);
              } catch (e) {
                return resolve(outputPath);
              }
            }
          }
          reject(new Error(`File yang diunduh terlalu kecil atau kosong (${fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0} bytes)`));
        });

        proc.on('error', reject);
      });
    };

    let lastError = null;
    for (const url of candidateUrls) {
      try {
        await tryDownloadSingleUrl(url);
        return outputPath;
      } catch (err) {
        lastError = err;
        try {
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (e) {}
      }
    }

    throw lastError || new Error('Gagal mengunduh file video dari seluruh URL kandidat Google Gemini.');
  }

  async uploadImage(imageBuffer, filename = 'image.png', mimeType = 'image/png') {
    if (!this.snlm0e) {
      await this.initSession();
    }
    const fileSize = imageBuffer.length;
    const isVid = mimeType?.startsWith('video/') || filename?.match(/\.(mp4|mov|webm|mkv|avi)$/i);
    console.log(`[Gemini Web Client ${isVid ? '🎬' : '🖼️'}] Mengunggah ${isVid ? 'video' : 'gambar'} referensi "${filename}" (${(fileSize / 1024).toFixed(1)} KB) ke Google Scotty...`);

    // Step 1: Start Scotty Resumable Upload
    const uploadUrl = await new Promise((resolve, reject) => {
      const initReq = https.request('https://push.clients6.google.com/upload/', {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'origin': 'https://gemini.google.com',
          'referer': 'https://gemini.google.com/',
          'push-id': 'feeds/mcudyrk2a4khkz',
          'x-goog-upload-command': 'start',
          'x-goog-upload-header-content-length': String(fileSize),
          'x-goog-upload-protocol': 'resumable',
          'x-tenant-id': 'bard-storage',
          'cookie': this.cookies || ''
        }
      }, (res) => {
        const uUrl = res.headers['x-goog-upload-url'];
        if (!uUrl) {
          return reject(new Error(`Gagal inisiasi Scotty upload: status ${res.statusCode}, tidak ada x-goog-upload-url`));
        }
        resolve(uUrl);
      });
      initReq.on('error', reject);
      initReq.write(`File name: ${filename}`);
      initReq.end();
    });

    // Step 2: Upload bytes & finalize
    const remotePath = await new Promise((resolve, reject) => {
      const urlObj = new URL(uploadUrl);
      const putReq = https.request(urlObj, {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'content-type': mimeType || 'application/x-www-form-urlencoded;charset=UTF-8',
          'origin': 'https://gemini.google.com',
          'referer': 'https://gemini.google.com/',
          'x-goog-upload-command': 'upload, finalize',
          'x-goog-upload-offset': '0',
          'content-length': String(fileSize)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300 && data.trim()) {
            resolve(data.trim());
          } else {
            reject(new Error(`Upload binary gagal (status ${res.statusCode}): ${data}`));
          }
        });
      });
      putReq.on('error', reject);
      putReq.write(imageBuffer);
      putReq.end();
    });

    console.log(`[Gemini Web Client ${isVid ? '🎬' : '🖼️'}] Upload berhasil! Remote blob path: ${remotePath}`);
    return remotePath;
  }

  async uploadMedia(mediaBuffer, filename = 'media.png', mimeType = 'image/png') {
    return this.uploadImage(mediaBuffer, filename, mimeType);
  }

  async streamMessage(promptText, onEvent, isNewChat = false, attempt = 1, imageAttachment = null, autoPollVideo = false, returnOnVideoStart = false, timeoutMs = 120000, returnOnConversationId = false) {
    promptText = sanitizeGeminiPrompt(promptText);
    if (!this.snlm0e) {
      await this.initSession();
    }

    if (isNewChat) {
      this.conversationId = null;
      this.responseId = null;
      this.choiceId = null;
      console.log('[Gemini Web Stream] Reset session for NEW CHAT');
    }

    this.reqId = Math.floor(100000 + Math.random() * 899999);
    console.log(`\n[User Stream]: ${promptText}`);

    const contextConv = this.conversationId
      ? [this.conversationId, this.responseId || "", this.choiceId || "", null, null, []]
      : null;

    let imageArr = null;
    if (imageAttachment) {
      if (Array.isArray(imageAttachment)) {
        imageArr = imageAttachment
          .map((att) => {
            const remotePath = typeof att === 'string' ? att : att?.path;
            const fileName = (typeof att === 'object' && att?.name) || (att?.type === 'video' ? 'reference_video.mp4' : 'reference_image.png');
            return remotePath ? [[remotePath, 1], fileName] : null;
          })
          .filter(Boolean);
        if (imageArr.length === 0) imageArr = null;
      } else {
        const remotePath = typeof imageAttachment === 'string' ? imageAttachment : imageAttachment.path;
        const fileName = (typeof imageAttachment === 'object' && imageAttachment.name) || 'image.png';
        if (remotePath) {
          imageArr = [[[remotePath, 1], fileName]];
        }
      }
    }

    const isVideoReq = /video|vidio|veo|klip|animasi/i.test(promptText);
    const promptEntry = [promptText, 0, null, imageArr, null, null, 0];

    const chatContext = [
      promptEntry,
      ["en"],
      contextConv,
      null, null, null,
      [1],
      0,
      [],
      [],
      1,
      0,
      null, null, null, null, null, null,
      0
    ];

    const reqData = [null, JSON.stringify(chatContext)];
    const bodyParams = new URLSearchParams();
    bodyParams.append('f.req', JSON.stringify(reqData));
    bodyParams.append('at', this.snlm0e);

    const requestBody = bodyParams.toString();
    const sidParam = this.fdrfje ? `&f.sid=${encodeURIComponent(this.fdrfje)}` : '';
    const endpoint = `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=${encodeURIComponent(this.bl)}${sidParam}&hl=en&_reqid=${this.reqId}&rt=c`;

    const parsedUrl = new URL(endpoint);
    let fullAnswerText = '';
    let lastEmittedLength = 0;
    let isVideoGenerating = false;
    let videoToolMessage = '';
    const extractedImageUrls = [];
    const extractedVideoUrls = [];

    // Helper to find real image and video URLs
    const scanForMediaUrls = (obj) => {
      if (!obj) return;
      if (typeof obj === 'string') {
        if (obj.startsWith('http')) {
          if (
            /\.svg(\?.*)?$/i.test(obj) ||
            obj.includes('fonts.gstatic.com') ||
            obj.includes('googlesymbols') ||
            obj.includes('/s/i/') ||
            obj.includes('gstatic.com') ||
            obj.includes('/branding/') ||
            obj.includes('/icons/')
          ) {
            return;
          }

          if (
            /\.(mp4|webm|mov|mkv)(\?.*)?$/i.test(obj) ||
            obj.includes('googlevideo.com') ||
            obj.includes('youtube.com/watch') ||
            obj.includes('youtu.be/')
          ) {
            if (!extractedVideoUrls.includes(obj)) {
              extractedVideoUrls.push(obj);
            }
          } else if (
            /\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(obj) ||
            (obj.includes('googleusercontent.com') && !obj.includes('favicon') && !obj.includes('logo'))
          ) {
            if (!extractedImageUrls.includes(obj)) {
              extractedImageUrls.push(obj);
            }
          }
        }
        return;
      }
      if (Array.isArray(obj)) {
        for (const el of obj) scanForMediaUrls(el);
      } else if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) scanForMediaUrls(obj[key]);
      }
    };

    const origin = 'https://gemini.google.com';
    const authHeader = this.getAuthorizationHeader(origin) || (this.getSapisidHash(origin) ? `SAPISIDHASH ${this.getSapisidHash(origin)}` : '');
    const requestedTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120000;
    const streamTimeoutMs = isVideoReq && returnOnConversationId
      ? Math.max(requestedTimeoutMs, VIDEO_HANDOFF_TIMEOUT_MS)
      : requestedTimeoutMs;

    if (!authHeader) {
      throw new Error('Cookie sesi Gemini tidak memiliki SAPISID / PAPISID untuk membuat authorization header. Login ulang dan tambahkan sesi Google yang lengkap.');
    }

    return new Promise((resolve, reject) => {
      let isSettled = false;
      let reqInstance = null;
      let responseBytes = 0;
      let parsedFrames = 0;
      let conversationIdReceived = false;
      let rpcError = null;
      let hardTimeout;
      let diagnosticInterval;
      const requestStartedAt = Date.now();
      let firstResponseByteAt = 0;

      const clearStreamTimers = () => {
        if (hardTimeout) clearTimeout(hardTimeout);
        if (diagnosticInterval) clearInterval(diagnosticInterval);
      };

      const safeResolve = (val) => {
        if (!isSettled) {
          isSettled = true;
          clearStreamTimers();
          if (reqInstance) {
            try { reqInstance.setTimeout(0); } catch (e) {}
          }
          resolve(val);
        }
      };

      const returnVideoTaskEarly = (text) => {
        if (!returnOnVideoStart || !this.conversationId || isSettled) return false;
        safeResolve({
          text,
          conversationId: this.conversationId,
          responseId: this.responseId,
          choiceId: this.choiceId,
          isVideoGenerating: true,
        });
        if (reqInstance) reqInstance.destroy();
        return true;
      };

      const safeReject = (err) => {
        if (!isSettled) {
          isSettled = true;
          clearStreamTimers();
          if (reqInstance) {
            try { reqInstance.setTimeout(0); } catch (e) {}
          }
          reject(err);
        }
      };

      const req = https.request({
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        maxHeaderSize: 1048576,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'Origin': origin,
          'Referer': 'https://gemini.google.com/',
          'X-Same-Domain': '1',
          'Cookie': this.cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
          'authorization': authHeader,
          'sec-ch-ua': '"Chromium";v="154", "Google Chrome";v="154", "Not A(Brand";v="99"',
          'sec-ch-ua-arch': '"x86"',
          'sec-ch-ua-bitness': '"64"',
          'sec-ch-ua-form-factors': '"Desktop"',
          'sec-ch-ua-full-version': '"154.0.8037.97"',
          'sec-ch-ua-full-version-list': '"Chromium";v="154.0.8037.97", "Google Chrome";v="154.0.8037.97", "Not A(Brand";v="99.0.0.0"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-model': '""',
          'sec-ch-ua-platform': '"Windows"',
          'sec-ch-ua-platform-version': '"19.0.0"',
          'sec-ch-ua-wow64': '?0',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'x-browser-channel': 'stable',
          'x-browser-copyright': 'Copyright 2026 Google LLC. All Rights Reserved.',
          'x-browser-year': '2026',
          'x-goog-authuser': '0',
          'x-goog-ext-525001261-jspb': '[1,null,null,null,"56fdd199312815e2",null,null,0,[4,5,6,8,16,4,5,6,8,16],null,null,2,null,null,1,null,"E690D403-FF65-4D0C-B6AD-49D1F76E55B4",null,null,[[null,554099999],[1790843616,178000000]]]',
          'x-goog-ext-525005358-jspb': '["25030126-4BD9-4DC2-B022-C67A98A520AE",1]',
          'x-goog-ext-73010989-jspb': '[0]',
          'x-goog-ext-73010990-jspb': '[0,0,0]'
        }
      }, (res) => {
        reqInstance = req;
        try { req.setTimeout(streamTimeoutMs); } catch (e) {}
        console.log(`[Gemini Web Stream] HTTP ${res.statusCode} (${res.headers['content-type'] || 'unknown content type'})`);
        diagnosticInterval = setInterval(() => {
          const elapsedSeconds = Math.round((Date.now() - requestStartedAt) / 1000);
          const firstByteDelay = firstResponseByteAt
            ? `${Math.round((firstResponseByteAt - requestStartedAt) / 1000)}s`
            : 'none';
          console.log(
            `[Gemini Web Stream] Still waiting after ${elapsedSeconds}s (first data: ${firstByteDelay}, ${responseBytes} bytes, ${parsedFrames} frames, conversation ID: ${conversationIdReceived ? 'yes' : 'no'}, ${fullAnswerText.length} text chars).`,
          );
        }, 15000);
        if (onEvent && res.statusCode === 200) {
          onEvent({ type: 'status', text: 'Gemini Web merespons. Menunggu hasil...' });
        }

        if (res.headers && res.headers['set-cookie']) {
          this._updateCookies(res.headers['set-cookie']);
        }

        if (res.statusCode !== 200) {
          let errBody = '';
          res.on('data', chunk => errBody += chunk.toString());
          res.on('end', async () => {
            try { req.setTimeout(0); } catch (e) {}
            console.warn(`[Gemini Web Stream] Server responded with HTTP ${res.statusCode}.`);
            if (attempt === 1 && (res.statusCode === 400 || res.statusCode === 401 || res.statusCode === 403)) {
              console.log('[Gemini Web Stream] Auto-recovering session and retrying request...');
              try {
                this.conversationId = null;
                this.responseId = null;
                this.choiceId = null;
                await this.initSession();
                const retryRes = await this.streamMessage(promptText, onEvent, true, attempt + 1, imageAttachment, autoPollVideo, returnOnVideoStart, timeoutMs, returnOnConversationId);
                return safeResolve(retryRes);
              } catch (retryErr) {
                // fall through
              }
            }

            const cleanErrorMsg = this._cleanGoogleError(errBody, res.statusCode);
            if (onEvent) {
              onEvent({ type: 'error', error: cleanErrorMsg, statusCode: res.statusCode });
            }
            return safeReject(new Error(cleanErrorMsg));
          });
          return;
        }

        let buffer = '';
        const parseLine = (line) => {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith('[[')) return;
          parsedFrames++;
          try {
            const parsedOuter = JSON.parse(trimmedLine);
            for (const item of parsedOuter) {
              if (item && item[0] === 'er') {
                const errInfo = item[2] || item[1] || JSON.stringify(item);
                const errorMsg = `Gemini Web RPC Error: ${typeof errInfo === 'object' ? JSON.stringify(errInfo) : errInfo}`;
                rpcError = rpcError || errorMsg;
                if (onEvent) onEvent({ type: 'error', error: errorMsg, raw: item });
              }

              if (item && item[0] === 'wrb.fr' && typeof item[2] === 'string') {
                const inner = JSON.parse(item[2]);
                if (inner && inner[1]) {
                  this.conversationId = inner[1][0] || this.conversationId;
                  this.responseId = inner[1][1] || this.responseId;
                  conversationIdReceived = Boolean(this.conversationId);
                }
                if (inner && inner[2] && inner[2]['7']) {
                  const toolInfo = inner[2]['7'];
                  if (Array.isArray(toolInfo) && typeof toolInfo[0] === 'string') {
                    const toolMessage = toolInfo[0];
                    const hasVideoGenerationMarker = JSON.stringify(toolInfo[1] || []).includes('video_generation');
                    const hasVideoProgressMessage =
                      !isRefusalOrErrorText(toolMessage) &&
                      (this.isProgressNoticeText(toolMessage) ||
                        /\b(?:generating|creating|rendering)\s+(?:your\s+)?video\b|\bvideo\s+(?:is\s+)?being\s+(?:generated|created|rendered)\b/i.test(toolMessage));
                    const isVideoTool =
                      hasVideoGenerationMarker || hasVideoProgressMessage;
                    if (isVideoTool) {
                      videoToolMessage = toolMessage;
                      isVideoGenerating = true;
                      if (!fullAnswerText && onEvent) {
                        onEvent({ type: 'status', text: toolMessage, isVideoGenerating: true });
                      }
                      if (returnVideoTaskEarly(videoToolMessage)) return;
                    }
                  }
                }

                if (inner && inner[4] && Array.isArray(inner[4])) {
                  const firstChoice = inner[4][0];
                  if (firstChoice) {
                    this.choiceId = firstChoice[0] || this.choiceId;
                    const contentParts = firstChoice[1];
                    if (Array.isArray(contentParts) && typeof contentParts[0] === 'string') {
                      const currentText = contentParts[0];
                      if (!(fullAnswerText.length > 80 && currentText.length < 120 && /hanya model bahasa|tidak bisa membantu/i.test(currentText))) {
                        fullAnswerText = currentText;
                        if (currentText.length > lastEmittedLength) {
                          const delta = currentText.slice(lastEmittedLength);
                          lastEmittedLength = currentText.length;
                          if (onEvent) onEvent({ type: 'chunk', text: delta, fullText: currentText });
                        }
                        if (
                          isVideoReq &&
                          this.isProgressNoticeText(currentText) &&
                          !isRefusalOrErrorText(currentText) &&
                          returnVideoTaskEarly(currentText)
                        ) {
                          return;
                        }
                      } else {
                        console.warn('[Gemini Web Stream] Ignored trailing refusal frame because substantive response was already received.');
                      }
                    }
                    if (firstChoice[4] && Array.isArray(firstChoice[4])) {
                      scanForMediaUrls(firstChoice[4]);
                    }
                  }

                  if (
                    returnOnConversationId &&
                    isVideoGenerating &&
                    this.conversationId &&
                    returnVideoTaskEarly(videoToolMessage || fullAnswerText || 'Gemini confirmed video generation.')
                  ) {
                    return;
                  }
                }
              }
            }
          } catch (parseError) {
            console.warn('[Gemini Web Stream] Failed to parse a response frame:', parseError.message || parseError);
          }
        };

        res.on('data', (chunk) => {
          try { req.setTimeout(streamTimeoutMs); } catch (e) {}
          if (!firstResponseByteAt) {
            firstResponseByteAt = Date.now();
            console.log(`[Gemini Web Stream] First response data received after ${Math.round((firstResponseByteAt - requestStartedAt) / 1000)}s.`);
          }
          responseBytes += chunk.length;
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) parseLine(line);
        });

        res.on('end', async () => {
          try { req.setTimeout(0); } catch (e) {}
          if (buffer.trim()) parseLine(buffer);
          console.log(`[Gemini Web Stream] Response ended (${responseBytes} bytes, ${parsedFrames} RPC frames, ${fullAnswerText.length} text characters).`);
          const textImageUrls = fullAnswerText.match(
            /https?:\/\/(?:[a-z0-9-]+\.)*googleusercontent\.com\/image_generation_content\/[^\s"'<>]+/gi
          ) || [];
          for (const imageUrl of textImageUrls) {
            const normalizedUrl = imageUrl.replace(/^http:/i, 'https:').replace(/[),.;]+$/, '');
            if (!extractedImageUrls.includes(normalizedUrl)) extractedImageUrls.push(normalizedUrl);
          }

          let finalVideoData = null;
          // Refusal check ONLY applies when video rendering was explicitly requested with auto-poll enabled AND isRefusalOrErrorText matches a genuine refusal
          const isRefusal = Boolean(autoPollVideo && isVideoReq && isRefusalOrErrorText(fullAnswerText));
          const isVideoWork = !isRefusal && (isVideoGenerating || (isVideoReq && this.conversationId) || /membuat video|generating video|sedang membuat video|merender video/i.test(fullAnswerText));

          if (isRefusal) {
            console.warn(`[Gemini Web Stream] Penolakan/Limit terdeteksi dari Gemini: "${fullAnswerText}"`);
            if (onEvent) {
              onEvent({ type: 'error', error: fullAnswerText, fullText: fullAnswerText });
            }
            return safeReject(new Error(fullAnswerText));
          }

          // If video generation was initiated or requested in this session AND autoPollVideo is enabled
          if (!isSettled && autoPollVideo && isVideoWork && this.conversationId) {
            const initialMsg = videoToolMessage || fullAnswerText || 'Saya sedang membuat video Anda. Proses rendering Google Veo sedang berlangsung...';
            if (onEvent) {
              onEvent({ type: 'status', text: 'Memantau render video Google Veo di latar belakang...', isVideoGenerating: true });
            }

            try {
              finalVideoData = await this.pollVideoGeneration(this.conversationId, 120, 4000);
              const doneText = `Video Anda sudah siap! Format ${finalVideoData.resolution || '16:9'} durasi ${finalVideoData.duration || '10s'}.`;
              if (onEvent) {
                onEvent({
                  type: 'video',
                  video: finalVideoData,
                  fullText: doneText,
                });
                onEvent({
                  type: 'done',
                  fullText: doneText,
                  video: finalVideoData,
                  conversationId: this.conversationId,
                  responseId: this.responseId,
                });
              }
              return safeResolve({
                text: doneText,
                video: finalVideoData,
                conversationId: this.conversationId,
                responseId: this.responseId,
                images: extractedImageUrls,
                videos: [finalVideoData.playbackUrl],
              });
            } catch (pollErr) {
              console.warn('[Gemini Video Poll Notice]:', pollErr.message);
            }
          }

          if (!isSettled && fullAnswerText) {
            console.log(`[Gemini Web Stream] Respon teks diterima (${fullAnswerText.length} karakter).`);
            if (onEvent) {
              onEvent({
                type: 'done',
                fullText: fullAnswerText,
                conversationId: this.conversationId,
                responseId: this.responseId,
                choiceId: this.choiceId,
                images: extractedImageUrls,
              });
            }
            return safeResolve({
              text: fullAnswerText,
              conversationId: this.conversationId,
              responseId: this.responseId,
              choiceId: this.choiceId,
              images: extractedImageUrls,
              videos: extractedVideoUrls,
            });
          }

          if (isSettled) return;
          if (rpcError) {
            return safeReject(new Error(rpcError));
          }
          return safeReject(new Error(
            responseBytes === 0
              ? 'Gemini Web menutup stream tanpa mengirim data.'
              : `Gemini Web mengirim ${responseBytes} byte tetapi tidak ada teks yang dapat dibaca (${parsedFrames} frame RPC).`,
          ));
        });

        res.on('aborted', () => {
          safeReject(new Error('Koneksi respons Gemini Web terputus sebelum selesai.'));
        });
        res.on('error', (err) => safeReject(err));
      });

      reqInstance = req;
      hardTimeout = setTimeout(() => {
        safeReject(new Error(`Gemini Web tidak menyelesaikan respons dalam ${Math.ceil(streamTimeoutMs / 1000)} detik.`));
        try { req.destroy(); } catch (e) {}
      }, streamTimeoutMs);
      req.setTimeout(streamTimeoutMs, () => {
        safeReject(new Error(`Koneksi request streaming ke Gemini Web timeout setelah ${Math.ceil(streamTimeoutMs / 1000)} detik.`));
        try { req.destroy(); } catch (e) {}
      });
      req.on('error', (err) => safeReject(err));
      req.write(requestBody);
      req.end();
    });
  }

  async sendMessage(promptText, isNewChat = false, autoPollVideo = true, attempt = 1, imageAttachment = null) {
    promptText = sanitizeGeminiPrompt(promptText);
    if (!this.snlm0e) {
      await this.initSession();
    }

    if (isNewChat) {
      this.conversationId = null;
      this.responseId = null;
      this.choiceId = null;
      console.log('[Gemini Web Client] Reset session for NEW CHAT');
    }

    this.reqId = Math.floor(100000 + Math.random() * 899999);
    console.log(`\n[User]: ${promptText}`);

    const contextConv = this.conversationId
      ? [this.conversationId, this.responseId || "", this.choiceId || "", null, null, []]
      : null;

    let imageArr = null;
    if (imageAttachment) {
      if (Array.isArray(imageAttachment)) {
        imageArr = imageAttachment
          .map((att) => {
            const remotePath = typeof att === 'string' ? att : att?.path;
            const fileName = (typeof att === 'object' && att?.name) || (att?.type === 'video' ? 'reference_video.mp4' : 'reference_image.png');
            return remotePath ? [[remotePath, 1], fileName] : null;
          })
          .filter(Boolean);
        if (imageArr.length === 0) imageArr = null;
      } else {
        const remotePath = typeof imageAttachment === 'string' ? imageAttachment : imageAttachment.path;
        const fileName = (typeof imageAttachment === 'object' && imageAttachment.name) || 'image.png';
        if (remotePath) {
          imageArr = [[[remotePath, 1], fileName]];
        }
      }
    }

    const isVideoReq = /video|vidio|veo|klip|animasi/i.test(promptText);
    const promptEntry = [promptText, 0, null, imageArr, null, null, 0];

    // Google Gemini StreamGenerate Payload format
    const chatContext = [
      promptEntry,
      ["en"],
      contextConv,
      null, null, null,
      [1],
      0,
      [],
      [],
      1,
      0,
      null, null, null, null, null, null,
      0
    ];

    const reqData = [null, JSON.stringify(chatContext)];
    const bodyParams = new URLSearchParams();
    bodyParams.append('f.req', JSON.stringify(reqData));
    bodyParams.append('at', this.snlm0e);

    const requestBody = bodyParams.toString();
    const sidParam = this.fdrfje ? `&f.sid=${encodeURIComponent(this.fdrfje)}` : '';
    const endpoint = `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=${encodeURIComponent(this.bl)}${sidParam}&hl=en&_reqid=${this.reqId}&rt=c`;

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'Origin': 'https://gemini.google.com',
      'Referer': 'https://gemini.google.com/',
      'X-Same-Domain': '1',
      'Cookie': this.cookies,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'x-goog-ext-525001261-jspb': '[1,null,null,null,"56fdd199312815e2",null,null,0,[4,5,6,8,16,4,5,6,8,16],null,null,2,null,null,1,null,"E690D403-FF65-4D0C-B6AD-49D1F76E55B4",null,null,[[null,554099999],[1790843616,178000000]]]',
      'x-goog-ext-525005358-jspb': '["25030126-4BD9-4DC2-B022-C67A98A520AE",1]',
      'x-goog-ext-73010989-jspb': '[0]',
      'x-goog-ext-73010990-jspb': '[0,0,0]'
    };

    const res = await this._request(endpoint, {
      method: 'POST',
      headers,
      body: requestBody,
      timeoutMs: 120000,
      logLifecycle: `Gemini StreamGenerate #${this.reqId}`,
    });

    if (res.status !== 200) {
      if (attempt === 1 && (res.status === 400 || res.status === 401 || res.status === 403)) {
        console.log(`[Gemini Web Client] Auto-recovering session on HTTP ${res.status}...`);
        this.conversationId = null;
        this.responseId = null;
        this.choiceId = null;
        try {
          await this.initSession();
          return await this.sendMessage(promptText, true, autoPollVideo, attempt + 1);
        } catch (retryErr) {
          // fall through
        }
      }
      const cleanError = this._cleanGoogleError(res.body, res.status);
      throw new Error(cleanError);
    }

    // Parse RPC responses
    const lines = res.body.split('\n');
    let answerText = '';
    let isVideoGenerating = false;
    let images = [];
    let parsedFrameCount = 0;
    let recognizedRpcCount = 0;
    let parseErrorCount = 0;
    const extractedImageUrls = [];
    const extractedVideoUrls = [];

    // Helper to find real image and video URLs
    const scanForMediaUrls = (obj) => {
      if (!obj) return;
      if (typeof obj === 'string') {
        if (obj.startsWith('http')) {
          if (
            /\.svg(\?.*)?$/i.test(obj) ||
            obj.includes('fonts.gstatic.com') ||
            obj.includes('googlesymbols') ||
            obj.includes('/s/i/') ||
            obj.includes('gstatic.com') ||
            obj.includes('/branding/') ||
            obj.includes('/icons/')
          ) {
            return;
          }

          if (
            /\.(mp4|webm|mov|mkv)(\?.*)?$/i.test(obj) ||
            obj.includes('googlevideo.com') ||
            obj.includes('youtube.com/watch') ||
            obj.includes('youtu.be/')
          ) {
            if (!extractedVideoUrls.includes(obj)) {
              extractedVideoUrls.push(obj);
            }
          } else if (
            /\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(obj) ||
            (obj.includes('googleusercontent.com') && !obj.includes('favicon') && !obj.includes('logo'))
          ) {
            if (!extractedImageUrls.includes(obj)) {
              extractedImageUrls.push(obj);
            }
          }
        }
        return;
      }
      if (Array.isArray(obj)) {
        for (const el of obj) scanForMediaUrls(el);
      } else if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) scanForMediaUrls(obj[key]);
      }
    };

    for (const line of lines) {
      if (!line.startsWith('[[')) continue;
      try {
        const parsedOuter = JSON.parse(line);
        parsedFrameCount += 1;
        for (const item of parsedOuter) {
          if (item && item[0] === 'wrb.fr' && typeof item[2] === 'string') {
            recognizedRpcCount += 1;
            const inner = JSON.parse(item[2]);
            if (inner && inner[1]) {
              this.conversationId = inner[1][0] || this.conversationId;
              this.responseId = inner[1][1] || this.responseId;
            }

            // Check if inner[2] has async video_generation task notice:
            // inner[2]["7"] = ["Saya sedang membuat video Anda...", ["video_generation", ...]]
            if (inner && inner[2] && inner[2]['7']) {
              const toolInfo = inner[2]['7'];
              if (Array.isArray(toolInfo) && typeof toolInfo[0] === 'string') {
                answerText = toolInfo[0];
                if (toolInfo[1] && (JSON.stringify(toolInfo[1]).includes('video_generation') || toolInfo[0].includes('video'))) {
                  isVideoGenerating = true;
                }
              }
            }

            // Normal text choices in inner[4] (takes absolute precedence over tool status messages)
            if (inner && inner[4] && Array.isArray(inner[4])) {
              const firstChoice = inner[4][0];
              if (firstChoice) {
                this.choiceId = firstChoice[0] || this.choiceId;
                const contentParts = firstChoice[1];
                if (Array.isArray(contentParts) && typeof contentParts[0] === 'string' && contentParts[0].trim()) {
                  answerText = contentParts[0];
                  // If Gemini Web explicitly answered with text (e.g. refusal, explanation, chat), cancel background video wait!
                  isVideoGenerating = false;
                }
                if (firstChoice[4] && Array.isArray(firstChoice[4])) {
                  images = firstChoice[4];
                  scanForMediaUrls(firstChoice[4]);
                }
              }
            }
          }
        }
      } catch (error) {
        parseErrorCount += 1;
      }
    }
    console.log(
      `[Gemini StreamGenerate #${this.reqId}] Parsed response: ` +
      `conversation ID=${this.conversationId ? 'yes' : 'no'}, ` +
      `text=${answerText.length} chars, video marker=${isVideoGenerating ? 'yes' : 'no'}, ` +
      `parsed frames=${parsedFrameCount}, recognized RPCs=${recognizedRpcCount}, ` +
      `parse errors=${parseErrorCount}.`,
    );

    // Detect explicit Gemini internal error / glitch messages
    const trimmedAnswer = typeof answerText === 'string' ? answerText.trim() : '';
    const isExplicitGeminiError = Boolean(
      trimmedAnswer &&
      trimmedAnswer.length < 300 &&
      !trimmedAnswer.includes('#') &&
      !trimmedAnswer.includes('* **') &&
      !trimmedAnswer.includes('```') &&
      /i encountered an error|something went wrong|an error occurred|terjadi kesalahan|tidak dapat memproses|saya mengalami masalah/i.test(trimmedAnswer)
    );

    if (isExplicitGeminiError) {
      if (attempt === 1) {
        console.log(`[Gemini Web Client] Gemini Web mengembalikan kendala internal ("${trimmedAnswer}"). Auto-recovering sesi & retry otomatis (attempt 2)...`);
        this.conversationId = null;
        this.responseId = null;
        this.choiceId = null;
        try {
          await this.initSession();
          return await this.sendMessage(promptText, true, autoPollVideo, attempt + 1, imageAttachment);
        } catch (retryErr) {
          console.warn('[Gemini Web Client] Auto-retry gagal:', retryErr.message);
        }
      }
      throw new Error(`Google Gemini Web error: "${trimmedAnswer}"`);
    }

    // Auto-poll video if video generation was initiated in this session
    let generatedVideoData = null;
    const isVideoWork = isVideoGenerating || isVideoReq || /membuat video|generating video|sedang membuat video|merender video/i.test(answerText);
    if (autoPollVideo && this.conversationId && isVideoWork) {
      console.log(`[Gemini Web Client] Deteksi tugas video Veo! Memantau proses render di latar belakang...`);
      try {
        generatedVideoData = await this.pollVideoGeneration(this.conversationId, 120, 4000);
        if (generatedVideoData?.playbackUrl && !extractedVideoUrls.includes(generatedVideoData.playbackUrl)) {
          extractedVideoUrls.push(generatedVideoData.playbackUrl);
        }
        answerText = `Video Anda sudah siap! Dihasilkan dengan format ${generatedVideoData.resolution || '16:9'} durasi ${generatedVideoData.duration || '10s'}.`;
      } catch (pollErr) {
        console.warn('[Gemini Video Poll Notice]:', pollErr.message);
        if (!answerText) {
          answerText = 'Proses render video sedang berjalan di latar belakang server Google Veo.';
        }
      }
    }

    return {
      text: answerText,
      conversationId: this.conversationId,
      responseId: this.responseId,
      choiceId: this.choiceId,
      isVideoGenerating,
      video: generatedVideoData,
      images: extractedImageUrls,
      videos: extractedVideoUrls,
      rawImages: images
    };
  }
}

module.exports = {
  GeminiWebClient,
  DEFAULT_COOKIES,
  isRefusalOrErrorText,
  isQuotaExhaustedText,
  sanitizeGeminiPrompt,
};
