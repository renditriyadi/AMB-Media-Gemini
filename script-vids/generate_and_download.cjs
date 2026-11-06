/**
 * Script Lengkap: Generate Video AI Google Vids -> Download Hasil Otomatis
 * Penggunaan: node script-vids/generate_and_download.cjs "Prompt video kamu disini" [email]
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const VIDS_API_KEY = 'AIzaSyA-njTXslyyMKk1VOogRfVP59F6fNGeNW8';
const SESSIONS_FILE = path.join(__dirname, '..', 'data', 'vids_sessions.json');

// Sumber akun: data/vids_sessions.json (dipakai server juga).
// Credit cache bisa basi, jadi validasi session + cek kuota live sebelum memilih.
async function resolveConfig(requestedEmail) {
  const sessions = fs.existsSync(SESSIONS_FILE)
    ? JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'))
    : {};

  const entries = Object.values(sessions).filter((s) => s && s.cookies);
  if (requestedEmail) {
    const found = entries.find((s) => s.email.toLowerCase() === requestedEmail.toLowerCase());
    if (!found) throw new Error(`Akun "${requestedEmail}" tidak ditemukan di ${SESSIONS_FILE}`);
    return { ...found, apiKey: VIDS_API_KEY };
  }

  const candidates = entries.filter((s) => (s.credits ?? 0) > 0);
  if (candidates.length === 0) throw new Error('Tidak ada akun dengan sisa kuota di data/vids_sessions.json');

  for (const candidate of candidates) {
    const quota = await fetchQuotaSummary(candidate.cookies);
    if (quota && quota.limit && quota.remaining > 0) {
      candidate.credits = quota.remaining;
      candidate.totalCredits = quota.limit;
      candidate.lastChecked = new Date().toISOString();
      sessions[candidate.email.toLowerCase()] = candidate;
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
      return { ...candidate, apiKey: VIDS_API_KEY };
    }
  }

  throw new Error('Semua akun dengan sisa kuota ternyata sudah tidak valid. Jalankan check_account_credits.cjs untuk detail.');
}

let config;

// Prompt default jika pengguna tidak memasukkan via argument CLI
const promptText = process.argv[2] || 'pemandangan indah sunset di pantai dengan ombak tenang sinematik';
const durationSeconds = 10; // Preset 10 detik

function printHeader() {
  console.log('====================================================');
  console.log('🎬 GOOGLE VIDS — GENERATE VIDEO & AUTO-DOWNLOAD');
  console.log('====================================================');
  console.log('Akun Target   :', config.email);
  console.log('Doc Vids ID   :', config.docId);
  console.log('Prompt        :', `"${promptText}"`);
  console.log('Durasi Preset :', `${durationSeconds} Detik (720p / 1280x720)`);
  console.log('----------------------------------------------------');
}

function generateAuthHeaders(cookies, origin = 'https://docs.google.com') {
  const match = cookies.match(/(?:^|;\s*)SAPISID=([^;]+)/);
  if (!match) throw new Error('Cookie SAPISID tidak ditemukan dalam konfigurasi.');
  const sapisid = match[1].trim();
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1').update(`${timestamp} ${sapisid} ${origin}`).digest('hex');
  return `SAPISIDHASH ${timestamp}_${hash} SAPISID1PHASH ${timestamp}_${hash} SAPISID3PHASH ${timestamp}_${hash}`;
}

// Kuota live dari endpoint resmi quotaSummary.
// Body: [null,1,[9],389,null,[[null,"1",1189]]]
function fetchQuotaSummary(cookies) {
  return new Promise((resolve) => {
    let authHeader;
    try {
      authHeader = generateAuthHeaders(cookies);
    } catch (e) {
      return resolve(null);
    }
    const body = JSON.stringify([null, 1, [9], 389, null, [[null, '1', 1189]]]);
    const req = https.request({
      hostname: 'appsgenaiserver-pa.clients6.google.com',
      path: `/v1/genai/quotaSummary?key=${VIDS_API_KEY}`,
      method: 'POST',
      headers: {
        'accept': '*/*',
        'authorization': authHeader,
        'content-type': 'application/json+protobuf',
        'cookie': cookies,
        'origin': 'https://docs.google.com',
        'referer': 'https://docs.google.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
        'x-goog-authuser': '0',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 20000,
    }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try {
          const q = JSON.parse(d)?.[0]?.[1];
          if (!q) return resolve(null);
          resolve({ limit: Number(q[0]) || 0, remaining: Number(q[2]) || 0 });
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

// Field ini WAJIB identik dengan request yang diterima server (diverifikasi 5 Nov 2026):
//   opcode         386  = Vids Video Generation RPC
//   [4][15][4]     1    = resolusi 720p (nilai 6 = 1080p -> kuota SKU 1080p = 0, HTTP 429)
//   [2][8][3]      3 level nesting
//   [2][13]        "in" = locale
//   [2][35]        null  (tidak boleh berisi "Asia/Jakarta" -> 400 search_context)
//   [2][41]        string client_root_request_id (angka 0 -> 400 TYPE_STRING)
function buildProtobufPayload(prompt, duration, docId) {
  const clientReqId = `goog_${Math.floor(Math.random() * 900000000 + 100000000)}`;
  return [
    386, // Opcode Vids Video Generation
    null,
    [
      9, // Vids App ID
      null, null, null,
      clientReqId,
      null,
      "0", // authuser
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
      null, // [2][35] timezone TIDAK dikirim (menyebabkan 400 search_context)
      null, null, null, null, null,
      clientReqId // [2][41] client_root_request_id harus string
    ],
    [
      null, null, null,
      [[[null, null, prompt]]]
    ],
    [
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      [0, 12, null, 0, 1, null, null, null, duration] // 12=Portrait, 1=720p, duration in seconds
    ],
    [
      1,
      null,
      [[null, "1", 1189]]
    ],
    1
  ];
}

function sendGenerateRequest(prompt, duration) {
  return new Promise((resolve, reject) => {
    const authHeader = generateAuthHeaders(config.cookies);
    const payload = JSON.stringify(buildProtobufPayload(prompt, duration, config.docId));
    const url = `https://appsgenaiserver-pa.clients6.google.com/v1/genai/generate?key=${config.apiKey}`;
    const urlObj = new URL(url);

    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'accept': '*/*',
        'accept-language': 'en',
        'authorization': authHeader,
        'content-type': 'application/json+protobuf',
        'cookie': config.cookies,
        'origin': 'https://docs.google.com',
        'referer': 'https://docs.google.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
        'x-goog-authuser': '0',
        'x-server-token': config.serverToken,
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 180000 // Timeout 3 menit untuk proses render video AI
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Generate gagal dengan HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
        }
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error(`Gagal mem-parsing respons JSON dari server: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Koneksi timeout (lebih dari 3 menit) saat menunggu render video.'));
    });

    req.write(payload);
    req.end();
  });
}

function extractVideoUrl(data) {
  // Coba path standar array protobuf
  try {
    const candidate = data?.[0]?.[0]?.[0]?.[0]?.[0]?.[6]?.[4];
    if (typeof candidate === 'string' && candidate.startsWith('https://')) {
      return candidate;
    }
  } catch (e) {}

  // Fallback regex search URL contribution-rt
  const str = JSON.stringify(data);
  const match = str.match(/https:\/\/contribution-rt\.usercontent\.google\.com\/download\?[^"'\\]+/);
  return match ? match[0] : null;
}

function extractQuotaInfo(data) {
  try {
    const q = data?.[4]?.[0];
    if (q) {
      return {
        total: q[1]?.[0] || '60',
        remaining: q[1]?.[2] || '0',
        cost: q[2] || '60'
      };
    }
  } catch (e) {}
  return null;
}

function downloadVideo(videoUrl, destinationPath) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(destinationPath);
    let downloaded = 0;

    https.get(videoUrl, {
      headers: {
        'Cookie': config.cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
        'Referer': 'https://docs.google.com/'
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        fileStream.close();
        return reject(new Error(`Gagal unduh file video! HTTP Code: ${res.statusCode}`));
      }

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        fileStream.write(chunk);
        process.stdout.write(`\r📥 Mengunduh Video: ${(downloaded / (1024 * 1024)).toFixed(2)} MB...`);
      });

      res.on('end', () => {
        fileStream.end();
        resolve(downloaded);
      });
    }).on('error', (err) => {
      fileStream.close();
      reject(err);
    });
  });
}

async function main() {
  try {
    config = await resolveConfig(process.argv[3]);
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }
  printHeader();

  const startTime = Date.now();
  console.log('🚀 Mengirim instruksi generate video ke AI server...');
  console.log('⏳ Menunggu AI me-render video (biasanya memakan waktu 40 - 90 detik)...');

  // Interval timer visual agar pengguna tahu proses sedang berjalan
  const timer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    process.stdout.write(`\r⏳ Sedang me-render video... [${elapsed} detik berlalu]`);
  }, 1000);

  try {
    const response = await sendGenerateRequest(promptText, durationSeconds);
    clearInterval(timer);
    const renderTimeSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✨ Render selesai dalam ${renderTimeSec} detik!`);

    // 1. Ambil URL video
    const videoUrl = extractVideoUrl(response);
    if (!videoUrl) {
      console.error('❌ Tidak dapat menemukan URL unduhan video di respons!');
      console.log('Respons Server:', JSON.stringify(response).slice(0, 500));
      return;
    }

    console.log('🔗 URL Video Diterima:', videoUrl.slice(0, 80) + '...');

    // 2. Ambil info kuota
    const quota = extractQuotaInfo(response);
    if (quota) {
      console.log(`💳 Update Kuota: Sisa ${quota.remaining} dari ${quota.total} Kredit (Total terpakai ${quota.cost})`);
      try {
        const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
        const key = String(config.email).toLowerCase();
        if (sessions[key]) {
          sessions[key].credits = Number(quota.remaining) || 0;
          sessions[key].totalCredits = Number(quota.total) || 0;
          sessions[key].lastChecked = new Date().toISOString();
          fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
        }
      } catch (e) {}
    }

    // 3. Download file MP4 otomatis
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `vids_${timestampStr}.mp4`;
    const outputPath = path.join(__dirname, filename);

    console.log(`\n💾 Memulai download otomatis ke: ${filename}`);
    const downloadStart = Date.now();
    const totalBytes = await downloadVideo(videoUrl, outputPath);
    const downloadTimeSec = ((Date.now() - downloadStart) / 1000).toFixed(1);

    console.log('\n----------------------------------------------------');
    console.log('🎉 SELESAI! VIDEO BERHASIL DIGENERATE & DISIMPAN');
    console.log(`📁 File Lokasi    : ${outputPath}`);
    console.log(`📊 Ukuran File    : ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`⏱️ Waktu Render   : ${renderTimeSec} detik`);
    console.log(`⏱️ Waktu Download : ${downloadTimeSec} detik`);
    console.log('====================================================\n');

  } catch (error) {
    clearInterval(timer);
    console.error('\n\n❌ Terjadi Kesalahan:', error.message);
  }
}

main();

