#!/usr/bin/env node

/**
 * ============================================================================
 * GOOGLE GEMINI VIDEO GENERATOR (GOOGLE VEO ENGINE)
 * ============================================================================
 * Folder: /script-gemini-tes/
 * 
 * Script ini mengotomatiskan pembuatan dan pengunduhan video Google Veo
 * menggunakan sesi akun Google Gemini pengguna (cURL cookies):
 * 1. Otentikasi sesi otomatis (CSRF token SNlM0e & Build ID)
 * 2. Format prompt optimal agar Google Veo terpicu 100%
 * 3. Polling background rendering task (Google Veo)
 * 4. Unduh file MP4 asli berkualitas tinggi ke direktori /script-gemini-tes/
 * 5. Ekstraksi metadata lengkap ke file JSON
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { GeminiWebClient } = require('../script-gemini/gemini_chat.cjs');

// Cookie sesi Google Gemini dari user cURL terbaru
const DEFAULT_COOKIES = `NID=CtQCCAEShgIBOxGDSAhYiB46BdxKBtbaFLZvSdc7bWSawzN9eu4r96mw7O9Wdz3XG128eVcVDz_yMkOboARgY1vLE4KtKyK211z-C6S0B6RYGi-mup72u9uSrj9n5Mo5KW1j8vFsOyrrf8vvzyUph8yyc2hJBvfwoaAA_xxG4hBZrxXWyy4Mn8_Bwt9GffHV0c_YnDgIvBXO24Fqxn9o6VCn9jo1Lt6pglaIg0UejPTljjA8D96pY2zNmEvzElCw7GgT-bfG7hJRHkIgoqC4C1yFdW2NWZa2UDmUjQ9IVNCoWd46pew7C1wsIMfXdrO10D0iJngdDvdAobZ5anLrQ3HGWBE5JEVNMDUCiRgkKAEyRQHSrAfPbz-Ji_zDqX1ppgBkgaU9hry2WodY_Ln2Dlxo2tWyJcSf6Bd3KIvLScylJZBAp7BA2ndqQFlygHW-Ip61A_99Dg; HSID=AeytgqV6FWBlUtkcS; SSID=ApN_wvugOswp9SLc1; APISID=bWSbpiIhUwKMI0ED/Ab1Df1vYjorjmg9tj; SAPISID=6k6hfaUKsQdLiOoN/AQAZZCoUpNmj0cg1E; __Secure-1PAPISID=6k6hfaUKsQdLiOoN/AQAZZCoUpNmj0cg1E; __Secure-3PAPISID=6k6hfaUKsQdLiOoN/AQAZZCoUpNmj0cg1E; SID=g.a000EAlywh1s6o6KJbJm-xlmi3wJ7aCIhAxRrEX9H_YnKs0jFUABz7P53JSR9MQRwYsrKjXkuwACgYKAeoSARESFQHGX2MiUIa7kM_K2cYGq9xgQoCYXhoVAUF8yKp2o_kynNN2S8eilXCoAaDy0076; __Secure-1PSID=g.a000EAlywh1s6o6KJbJm-xlmi3wJ7aCIhAxRrEX9H_YnKs0jFUABfoBOESoCRIQU0A7OC_pFPAACgYKAVYSARESFQHGX2MiWDSgBSi1xhRKQzAbN-7IqhoVAUF8yKrYsD9ABkMyONhoH17r4_mG0076; __Secure-3PSID=g.a000EAlywh1s6o6KJbJm-xlmi3wJ7aCIhAxRrEX9H_YnKs0jFUABg--rmjfve54jusY4-gNIzQACgYKAfUSARESFQHGX2MilsbP-07hCDqr4FOwKFGjfhoVAUF8yKrfhmW9rrrnXzd2WN4DJWf60076; __Secure-1PSIDTS=sidts-CjYBkldj_3K6gmiihXyPiazuewEp0teVJN3JoQ9A4pnn9-8FBImChFp6u-77Gyulxeo9LUm3v-YQAA; __Secure-1PSIDRTS=sidts-CjYBkldj_3K6gmiihXyPiazuewEp0teVJN3JoQ9A4pnn9-8FBImChFp6u-77Gyulxeo9LUm3v-YQAA; __Secure-3PSIDTS=sidts-CjYBkldj_3K6gmiihXyPiazuewEp0teVJN3JoQ9A4pnn9-8FBImChFp6u-77Gyulxeo9LUm3v-YQAA; __Secure-3PSIDRTS=sidts-CjYBkldj_3K6gmiihXyPiazuewEp0teVJN3JoQ9A4pnn9-8FBImChFp6u-77Gyulxeo9LUm3v-YQAA; SIDCC=APD_SKEeMZX21TE1l4jCxRwEWXkdeCxhKm-RVqmHx2VsqIzaX5OFu3Avhar_TZy2-YVsXzk-50k; __Secure-1PSIDCC=APD_SKGPQeqFnnfsXuETpx3fLd4ygCjGXD5dtQvBicgSiEPeccpp5cN7S7yUgh45EhSUo7_DMQ; __Secure-3PSIDCC=APD_SKFbg2opZ6gqsslNMSWUT0Tu3wozmRbYqtqOsl07x7eEHxInpj9aDfUjrIh1A34irw81g1g`;

// Parsing argumen baris perintah
const args = process.argv.slice(2);
let targetConvId = null;
let rawPrompt = 'A calm cinematic aerial shot of a tropical beach at sunset with turquoise ocean waves and palm trees';
let customCookies = DEFAULT_COOKIES;
let outputDir = __dirname;
let fetchOnly = false;

for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--prompt' || args[i] === '-p') && args[i + 1]) {
    rawPrompt = args[i + 1];
    i++;
  } else if ((args[i] === '--conv' || args[i] === '-c') && args[i + 1]) {
    targetConvId = args[i + 1].replace('https://gemini.google.com/app/', '').trim();
    i++;
  } else if (args[i] === '--fetch-only') {
    fetchOnly = true;
  } else if ((args[i] === '--cookie' || args[i] === '-b') && args[i + 1]) {
    customCookies = args[i + 1];
    i++;
  } else if ((args[i] === '--output' || args[i] === '-o') && args[i + 1]) {
    outputDir = path.resolve(args[i + 1]);
    i++;
  } else if (!args[i].startsWith('-')) {
    rawPrompt = args[i];
  }
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Format prompt agar memicu model Google Veo secara deterministik
 */
function formatVeoPrompt(prompt) {
  let cleaned = prompt.trim();
  // Jika prompt sudah mengandung pola 'create a ... video', pertahankan
  if (/^create\s+a\s+\d+s\s+video/i.test(cleaned)) {
    return cleaned;
  }
  // Hapus kata pembuka Indonesia jika ada
  cleaned = cleaned.replace(/^(buatkan|bikin|generate)\s+video[^\:]*:\s*/i, '').trim();
  return `Create a 5s video in 16:9 format: ${cleaned}`;
}

async function main() {
  console.log('================================================================');
  console.log(' 🎬 GOOGLE GEMINI VIDEO GENERATOR (GOOGLE VEO ENGINE)');
  console.log('================================================================');
  console.log(' • Prompt Input   :', rawPrompt);
  console.log(' • Target Percakapan:', targetConvId ? targetConvId : '(Chat Baru)');
  console.log(' • Folder Output  :', outputDir);
  console.log('================================================================\n');

  const client = new GeminiWebClient(customCookies);

  // [1/4] Inisialisasi Sesi
  console.log('[1/4] Inisialisasi Sesi Google Gemini & Ekstraksi Token...');
  await client.initSession(true);
  console.log('  ✅ Sesi Berhasil Terhubung!');
  console.log('  • Build ID    :', client.bl);
  console.log('  • SNlM0e Token:', client.snlm0e ? client.snlm0e.slice(0, 16) + '...' : 'OK');

  let videoData = null;
  let activeConvId = targetConvId;

  // KASUS A: Jika mengambil video dari percakapan yang sudah ada
  if (activeConvId) {
    console.log(`\n[2/4] Memeriksa Percakapan ID: ${activeConvId}...`);
    const history = await client.getConversationHistory(activeConvId);
    videoData = client.extractVideoFromHistory(history);

    if (!videoData) {
      if (fetchOnly) {
        console.log('  ℹ️ Tidak ada video selesai di percakapan ini.');
        process.exit(0);
      }
      console.log('  ⏳ Video belum selesai di percakapan ini, mencoba polling status render...');
      videoData = await client.pollVideoGeneration(activeConvId, 180, 5000);
    }
  } else {
    // KASUS B: Kirim prompt baru ke Google Veo dan tunggu hasilnya
    const finalPrompt = formatVeoPrompt(rawPrompt);
    console.log(`\n[2/4] Mengirim Perintah Pembuatan Video ke Google Veo:`);
    console.log(`  "${finalPrompt}"`);

    const chatRes = await client.sendMessage(finalPrompt, true, false, 1, null, { timeout: 180000 });
    activeConvId = chatRes.conversationId || client.conversationId;
    console.log(`  • ID Percakapan Google : ${activeConvId}`);
    console.log(`  • Respon Awal Google   : "${chatRes.text || 'Memproses video...'}"`);

    console.log('\n[3/4] Memantau Proses Render Google Veo di Background...');
    videoData = await client.pollVideoGeneration(activeConvId, 180, 5000);
  }

  if (!videoData) {
    throw new Error('Gagal mendapatkan metadata video dari Google Veo.');
  }

  console.log('\n================================================================');
  console.log(' 🎉 VIDEO BERHASIL DITEMUKAN & SELESAI DIRENDER OLEH GOOGLE VEO!');
  console.log('================================================================');
  console.log(' • Format/Resolusi :', videoData.resolution || '1280x720 (16:9 HD)');
  console.log(' • Durasi           :', videoData.duration || '5-10 Detik');
  console.log(' • Tipe Konten      :', videoData.mimeType || 'video/mp4');
  console.log(' • URL Streaming    :', videoData.playbackUrl ? videoData.playbackUrl.slice(0, 80) + '...' : '-');
  console.log(' • URL Download     :', videoData.downloadUrl ? videoData.downloadUrl.slice(0, 80) + '...' : '-');

  // [4/4] Mengunduh File Video MP4 ke Folder script-gemini-tes
  const timestamp = Date.now();
  const safeFilename = `gemini_veo_${timestamp}.mp4`;
  const targetFilePath = path.join(outputDir, safeFilename);

  console.log(`\n[4/4] Mengunduh File Video MP4 ke Folder script-gemini-tes...`);
  await client.downloadMedia(videoData, targetFilePath);

  const fileStats = fs.statSync(targetFilePath);
  const sizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
  console.log('  ✅ File Video Berhasil Diunduh!');
  console.log(`  📁 Lokasi File   : ${targetFilePath}`);
  console.log(`  📦 Ukuran File   : ${sizeMB} MB (${fileStats.size.toLocaleString()} bytes)`);

  // Simpan Metadata JSON
  const metaFilename = `gemini_veo_${timestamp}.json`;
  const metaFilePath = path.join(outputDir, metaFilename);
  const metadata = {
    timestamp: new Date().toISOString(),
    prompt: rawPrompt,
    conversationId: activeConvId,
    conversationUrl: `https://gemini.google.com/app/${activeConvId ? activeConvId.replace('c_', '') : ''}`,
    videoFile: safeFilename,
    fileSizeMB: Number(sizeMB),
    fileSizeBytes: fileStats.size,
    resolution: videoData.resolution,
    duration: videoData.duration,
    mimeType: videoData.mimeType,
    playbackUrl: videoData.playbackUrl,
    downloadUrl: videoData.downloadUrl,
    allUrls: videoData.allUrls
  };
  fs.writeFileSync(metaFilePath, JSON.stringify(metadata, null, 2), 'utf-8');
  console.log(`  📄 Metadata JSON : ${metaFilePath}`);

  console.log('\n================================================================');
  console.log(' 🏆 SELESAI DENGAN SUKSES!');
  console.log(` Video siap diputar di: ${targetFilePath}`);
  console.log('================================================================\n');

  return { targetFilePath, metaFilePath, metadata };
}

main().catch((err) => {
  console.error('\n❌ Terjadi Kesalahan:', err.message);
  process.exit(1);
});
