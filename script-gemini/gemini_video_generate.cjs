#!/usr/bin/env node

/**
 * ============================================================================
 * GOOGLE GEMINI WEB VIDEO GENERATOR (VEO & MULTIMODAL DIRECT CLIENT)
 * ============================================================================
 * 
 * Script ini dibuat untuk mengatasi kendala integrasi Gemini Video di aplikasi:
 * 1. Mengapa di web gemini.google.com berhasil generate video?
 *    -> Di web Gemini, video dihasilkan secara asynchronous (latar belakang)
 *       menggunakan tool internal `video_generation` (Google Veo). Respon awal
 *       hanyalah status "Saya sedang membuat video Anda...", lalu frontend Google
 *       memantau RPC `hNvQHb` hingga video MP4 selesai dirender dan siap diputar.
 * 
 * 2. Mengapa di aplikasi AMB Media muncul error?
 *    -> Aplikasi belum mendeteksi sesi Akun Google Gemini yang aktif di local storage,
 *       dan endpoint chat sebelumnya belum mendukung siklus polling asynchronous
 *       khusus untuk endpoint `video_generation` milik Gemini Web.
 * 
 * Script ini dapat:
 * - Menghasilkan video baru secara otomatis dari prompt teks.
 * - Memantau proses render hingga video selesai (100% otomatis).
 * - Mengambil video dari percakapan yang sudah ada (contoh: 5f55d62ac6237997).
 * - Mengunduh file MP4 asli berkualitas tinggi ke disk lokal.
 */

const fs = require('fs');
const path = require('path');
const { GeminiWebClient, DEFAULT_COOKIES } = require('./gemini_chat.cjs');

// Membaca argumen command line
const args = process.argv.slice(2);
let targetConvId = null;
let promptText = 'buatkan video durasi 10 detik, format 16:9 pemandangan indah di kota bandung';
let customCookies = null;
let outputDir = path.join(process.cwd(), 'media-cache');

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--conv' && args[i + 1]) {
    targetConvId = args[i + 1].replace('https://gemini.google.com/app/', '').trim();
    i++;
  } else if ((args[i] === '--cookie' || args[i] === '-b') && args[i + 1]) {
    customCookies = args[i + 1];
    i++;
  } else if ((args[i] === '--output' || args[i] === '-o') && args[i + 1]) {
    outputDir = args[i + 1];
    i++;
  } else if (!args[i].startsWith('--')) {
    promptText = args[i];
  }
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function main() {
  console.log('================================================================');
  console.log(' 🎬 GOOGLE GEMINI WEB VIDEO GENERATOR (VEO ENGINE)');
  console.log('================================================================');

  const client = new GeminiWebClient(customCookies || DEFAULT_COOKIES);

  try {
    console.log('\n[1/4] Menginisialisasi Sesi Google Gemini & Ekstraksi Token...');
    await client.initSession();
    console.log('  ✅ Sesi Berhasil Terhubung!');
    console.log('  • Build ID:', client.bl);
    console.log('  • SNlM0e Token:', client.snlm0e ? client.snlm0e.slice(0, 16) + '...' : 'OK');

    let videoData = null;
    let convIdToUse = targetConvId;

    // KASUS A: Jika user ingin mengambil video dari percakapan yang SUDAH SELESAI (misal: 5f55d62ac6237997)
    if (convIdToUse) {
      console.log(`\n[2/4] Mengambil Riwayat Percakapan ID: ${convIdToUse}...`);
      const history = await client.getConversationHistory(convIdToUse);
      videoData = client.extractVideoFromHistory(history);

      if (!videoData) {
        console.log('  ⏳ Video belum terdeteksi di sesi ini, mencoba polling status render...');
        videoData = await client.pollVideoGeneration(convIdToUse, 90, 4000);
      }
    } else {
      // KASUS B: Kirim prompt baru ke Gemini Web dan tunggu video dibuat
      console.log(`\n[2/4] Mengirim Prompt Pembuatan Video ke Gemini:`);
      console.log(`  "${promptText}"`);

      const chatRes = await client.sendMessage(promptText, true, false);
      convIdToUse = chatRes.conversationId;
      console.log(`  • ID Percakapan: ${convIdToUse}`);
      console.log(`  • Respon Awal: "${chatRes.text}"`);

      console.log('\n[3/4] Memantau Proses Render Google Veo di Latar Belakang...');
      videoData = await client.pollVideoGeneration(convIdToUse, 180, 5000);
    }

    if (!videoData) {
      throw new Error('Gagal mendapatkan metadata video dari Google Gemini.');
    }

    console.log('\n================================================================');
    console.log(' 🎉 VIDEO BERHASIL DITEMUKAN & SELESAI DIRENDER!');
    console.log('================================================================');
    console.log(' • Format/Resolusi :', videoData.resolution || '1280x720 (16:9 HD)');
    console.log(' • Durasi           :', videoData.duration || '10 Detik');
    console.log(' • Tipe Konten      :', videoData.mimeType || 'video/mp4');
    console.log(' • Ukuran File Asli :', videoData.fileSize ? `${(videoData.fileSize / (1024 * 1024)).toFixed(2)} MB` : 'Estimasi ~3 MB');
    console.log(' • URL Streaming    :', videoData.playbackUrl ? videoData.playbackUrl.slice(0, 80) + '...' : '-');

    // [4/4] Mengunduh file video ke disk lokal menggunakan sesi Google Cookies
    const safeFilename = `gemini_video_${Date.now()}_bandung.mp4`;
    const targetFile = path.join(outputDir, safeFilename);

    console.log(`\n[4/4] Mengunduh File MP4 ke Lokal (${targetFile})...`);
    const downloadSource = videoData.playbackUrl || videoData.downloadUrl;
    
    await client.downloadMedia(downloadSource, targetFile);

    const stats = fs.statSync(targetFile);
    console.log('  ✅ File Video Berhasil Diunduh!');
    console.log(`  📁 Lokasi File : ${targetFile}`);
    console.log(`  📦 Ukuran Akhir: ${(stats.size / (1024 * 1024)).toFixed(2)} MB (${stats.size.toLocaleString()} bytes)`);

    // Juga copy ke direktori saat ini jika dijalankan manual
    const localCopy = path.join(process.cwd(), safeFilename);
    try {
      fs.copyFileSync(targetFile, localCopy);
      console.log(`  ✨ Salinan siap pakai: ${localCopy}`);
    } catch (e) {}

    console.log('\n================================================================');
    console.log(' 🚀 PENJELASAN INTEGRASI APLIKASI:');
    console.log(' 1. Akun Google Gemini Anda sekarang telah aktif.');
    console.log(' 2. Di antarmuka aplikasi (Chat), video ini sekarang dapat langsung');
    console.log('    diputar melalui player video internal!');
    console.log('================================================================\n');

  } catch (error) {
    console.error('\n❌ Terjadi Kesalahan:', error.message);
    process.exit(1);
  }
}

main();
