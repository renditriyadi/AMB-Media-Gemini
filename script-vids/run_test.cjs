/**
 * Runner All-in-One: Tes URL Video + Cek Kredit Google Vids
 * Penggunaan: node script-vids/run_test.cjs
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 MEMULAI TES RINGAN GOOGLE VIDS...\n');

try {
  console.log('--- [LANGKAH 1: CEK STATUS KREDIT & KUOTA] ---');
  execSync(`node "${path.join(__dirname, 'check_account_credits.cjs')}"`, { stdio: 'inherit' });

  console.log('--- [LANGKAH 2: VERIFIKASI & DOWNLOAD URL ASSET VIDEO] ---');
  execSync(`node "${path.join(__dirname, 'check_video_url.cjs')}"`, { stdio: 'inherit' });

  console.log('🎉 SEMUA TES RINGAN BERHASIL DIJALANKAN TANPA ERROR!');
} catch (err) {
  console.error('\n❌ Terjadi error saat menjalankan tes:', err.message);
}

