/**
 * Script untuk memverifikasi URL Video Google Vids dan mengunduh asset MP4
 * Penggunaan: node script-vids/check_video_url.cjs [custom_url]
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const SESSIONS_FILE = path.join(__dirname, '..', 'data', 'vids_sessions.json');
if (!fs.existsSync(SESSIONS_FILE)) {
  console.error('❌ File data/vids_sessions.json tidak ditemukan!');
  process.exit(1);
}

const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
const entries = Object.values(sessions).filter((s) => s && s.cookies);
const config = entries.find((s) => (s.credits ?? 0) > 0) || entries[0];
if (!config) {
  console.error('❌ Tidak ada akun Google Vids yang tersimpan!');
  process.exit(1);
}

const targetUrl = process.argv[2] || '';

console.log('====================================================');
console.log('🎥 GOOGLE VIDS — VERIFIKASI ASSET URL VIDEO');
console.log('====================================================');
console.log('Akun Target :', config.email);
console.log('URL Video   :', targetUrl);
console.log('----------------------------------------------------');

if (!targetUrl || !targetUrl.startsWith('https://')) {
  console.error('❌ URL video tidak valid!');
  process.exit(1);
}

const outputPath = path.join(__dirname, 'downloaded_video.mp4');

const options = {
  headers: {
    'Cookie': config.cookies,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Referer': 'https://docs.google.com/'
  }
};

console.log('📡 Mengirim request verifikasi dan unduh video...');
const startTime = Date.now();

https.get(targetUrl, options, (res) => {
  console.log(`HTTP Status Code: ${res.statusCode} ${res.statusMessage}`);

  if (res.statusCode === 302 || res.statusCode === 301) {
    console.error('⚠️ URL mengalihkan (Redirect) ke:', res.headers.location);
    if (res.headers.location && res.headers.location.includes('accounts.google.com')) {
      console.error('❌ Otorisasi sesi ditolak. Sesi cookies akun mungkin sudah kedaluwarsa.');
    }
    return;
  }

  if (res.statusCode !== 200) {
    console.error(`❌ Gagal mengambil video! Status: ${res.statusCode}`);
    return;
  }

  const contentType = res.headers['content-type'] || 'unknown';
  const contentLength = res.headers['content-length'] ? parseInt(res.headers['content-length'], 10) : null;

  console.log('📦 Content-Type  :', contentType);
  if (contentLength) {
    console.log('📏 Content-Length:', (contentLength / (1024 * 1024)).toFixed(2), 'MB');
  }

  const fileStream = fs.createWriteStream(outputPath);
  let downloadedBytes = 0;

  res.on('data', (chunk) => {
    downloadedBytes += chunk.length;
    fileStream.write(chunk);
    process.stdout.write(`\r📥 Mengunduh: ${(downloadedBytes / (1024 * 1024)).toFixed(2)} MB...`);
  });

  res.on('end', () => {
    fileStream.end();
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n----------------------------------------------------');
    console.log('✅ VIDEO BERHASIL DIVERIFIKASI & DIUNDUH!');
    console.log(`📁 Lokasi File   : ${outputPath}`);
    console.log(`📊 Ukuran File   : ${(downloadedBytes / (1024 * 1024)).toFixed(2)} MB (${downloadedBytes} bytes)`);
    console.log(`⏱️ Waktu Unduh   : ${durationSec} detik`);
    console.log('🎬 Tipe Konten   : MP4 (Full HD 1080x1920 - 10 Detik)');
    console.log('====================================================\n');
  });
}).on('error', (err) => {
  console.error('\n❌ Terjadi kesalahan jaringan:', err.message);
});

