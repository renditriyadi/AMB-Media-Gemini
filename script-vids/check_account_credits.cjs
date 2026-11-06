/**
 * Script untuk memeriksa status sesi Google dan sisa kredit / kuota Google Vids
 * Penggunaan: node script-vids/check_account_credits.cjs [email]
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SESSIONS_FILE = path.join(__dirname, '..', 'data', 'vids_sessions.json');
const API_KEY = 'AIzaSyA-njTXslyyMKk1VOogRfVP59F6fNGeNW8';

if (!fs.existsSync(SESSIONS_FILE)) {
  console.error('❌ File data/vids_sessions.json tidak ditemukan!');
  process.exit(1);
}

const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
const requestedEmail = process.argv[2];
const targets = requestedEmail
  ? Object.values(sessions).filter((s) => s.email.toLowerCase() === requestedEmail.toLowerCase())
  : Object.values(sessions);

if (targets.length === 0) {
  console.error(`❌ Akun "${requestedEmail}" tidak ditemukan di data/vids_sessions.json`);
  process.exit(1);
}

console.log('====================================================');
console.log('💳 GOOGLE VIDS — CEK SISA KREDIT & STATUS AKUN');
console.log('====================================================');
console.log('Akun diperiksa:', targets.length);
console.log('----------------------------------------------------');

function generateSapisidHash(cookies, origin = 'https://docs.google.com') {
  const match = cookies.match(/(?:^|;\s*)SAPISID=([^;]+)/);
  if (!match) return null;
  const sapisid = match[1].trim();
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1').update(`${timestamp} ${sapisid} ${origin}`).digest('hex');
  return `SAPISIDHASH ${timestamp}_${hash} SAPISID1PHASH ${timestamp}_${hash} SAPISID3PHASH ${timestamp}_${hash}`;
}

// Status sesi ditentukan dari responsiveness endpoint quotaSummary resmi,
// bukan dari halaman login google.com (cookie Vids tidak berlaku di domain itu).
function fetchQuotaSummary(cookies, apiKey) {
  return new Promise((resolve) => {
    const auth = generateSapisidHash(cookies);
    if (!auth) return resolve(null);
    const body = JSON.stringify([null, 1, [9], 389, null, [[null, '1', 1189]]]);
    const req = https.request({
      hostname: 'appsgenaiserver-pa.clients6.google.com',
      path: `/v1/genai/quotaSummary?key=${apiKey}`,
      method: 'POST',
      headers: {
        'accept': '*/*',
        'authorization': auth,
        'content-type': 'application/json+protobuf',
        'cookie': cookies,
        'origin': 'https://docs.google.com',
        'referer': 'https://docs.google.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
        'x-goog-authuser': '0',
        'Content-Length': Buffer.byteLength(body),
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const q = JSON.parse(d)?.[0]?.[1];
          if (!q) return resolve(null);
          resolve({
            limit: Number(q[0]),
            remaining: Number(q[2]),
            resetEpoch: Number(q[6]?.[0]) || null,
          });
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(20000, () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

async function checkOne(target) {
  const sapisidAuth = generateSapisidHash(target.cookies);
  console.log(sapisidAuth
    ? '🔐 SAPISID Auth Hash     : Valid & Tergenerate ✅'
    : '❌ SAPISID Auth Hash     : SAPISID Cookie Tidak Ditemukan!');

  const quota = await fetchQuotaSummary(target.cookies, API_KEY);
  if (!quota || !quota.limit) {
    console.log('🔍 Status Sesi          : ❌ TIDAK AKTIF (server menolak sesi / kuota tidak terbaca)\n');
    return;
  }
  console.log('🔍 Status Sesi          : ✅ AKTIF (server menerima sesi)\n');

  const totalQuota = quota.limit;
  const remainingQuota = quota.remaining;
  const usedQuota = totalQuota - remainingQuota;
  const resetDate = quota.resetEpoch
    ? new Date(quota.resetEpoch * 1000).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        dateStyle: 'full',
        timeStyle: 'long',
      })
    : 'tidak diketahui';

  console.log('\n📊 RINCIAN KUOTA GOOGLE VIDS:');
  console.log('----------------------------------------------------');
  console.log(`📦 Kuota Maksimal        : ${totalQuota} kredit`);
  console.log(`💰 Sisa Kuota Tersedia   : ${remainingQuota} kredit`);
  console.log(`📉 Terpakai Generate     : ${usedQuota} kredit`);
  console.log(`🎬 Estimasi Sisa Video   : ~${Math.floor(remainingQuota / 10)} Video 10 detik lagi`);
  console.log(`🔄 Jadwal Reset Kuota    : ${resetDate}`);

  const percentage = Math.round((remainingQuota / totalQuota) * 100);
  const barLength = 25;
  const filledLength = Math.round((percentage / 100) * barLength);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

  console.log('\n📈 PROGRESS KUOTA:');
  console.log(`[${bar}] ${percentage}% (${remainingQuota}/${totalQuota})`);
  console.log('----------------------------------------------------\n');
}

(async () => {
  for (const target of targets) {
    console.log(`\n🔎 AKUN: ${target.email}`);
    await checkOne(target);
  }
  console.log('====================================================\n');
})();

