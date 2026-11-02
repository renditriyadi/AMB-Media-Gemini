/**
 * Script Pemeriksaan Token & Credit Akun Weavy AI
 * Penggunaan: node script-weavy/check_weavy_account.cjs [REFRESH_TOKEN]
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const FIREBASE_API_KEY = 'AIzaSyC-qLy3TFyXMogJPfMkZJ9H_q46hEu1sxI';
const SPREADSHEET_ID = '1iO2iKP0QWS59wZUk5Mtv5ubaH7YQiskFzg6aJj5OaNU';

const inputRefreshToken = process.argv[2] || 'AMf-vBxnpoKwjUCgdf4vl6qIE70d2471cYxAcsBt1PgcjJC7WjHgd9FE_E5XDFR_2dnZ0R274eThB4AgxaHhugYn3ssL70kcJLpsntJbob48S4xNP7a2DdK8PpaCzF1dYj91EU0WM2gfaWKVtSP_yCWMkL_wfurMf8UTgdDZ_bEaxN14pdLEaQ5yvFb9Fyj5kiK_9K9_IznCLjbgW4a8qPvQT-p6lQmSBDD9IheSFE_95QJKfrAw9dJv_7TqszZbRg9UWXJ8292kuOvAMtB8Vx42VvEdc2-FuJ-V808i7Hs9HVdyJqp4gW7sZJQaNHmEth9oC1YINRyoPXFVyDsHyJk3kcZqo9LHFfDvd769pewbQi_zmuoC3_WkqAGoLbxptHOaT1f8cAB3zNq11LeP1s0EsRRfp7v5y2-ix-RliMRR-Dfy0_JR-H2BkzhKXcSfMlHUaJCdXmS9MNwjCqe1n1t75M70s-Y9bQ';

async function checkWeavyAccount() {
  console.log('================================================================');
  console.log('       🔍 HASIL PENGECEKAN STATUS & KREDIT AKUN WEAVY AI        ');
  console.log('================================================================\n');

  // 1. Verifikasi & Pertukaran Token via Firebase Auth
  console.log('[1] Menghubungi Firebase Auth Identity Platform...');
  let idToken = '';
  let email = '';
  let displayName = '';
  let userId = '';

  try {
    const fbResp = await axios.post(
      `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: inputRefreshToken.trim(),
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      }
    );

    idToken = fbResp.data.id_token;
    userId = fbResp.data.user_id;

    // Decode JWT Payload
    const base64Url = idToken.split('.')[1];
    if (base64Url) {
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
      email = payload.email || '';
      displayName = payload.name || '';
    }

    console.log('    ✅ Token Valid & Aktif!');
    console.log(`    - Email Akun     : ${email}`);
    console.log(`    - Nama Lengkap   : ${displayName || '-'}`);
    console.log(`    - Firebase UID   : ${userId}`);
    console.log(`    - Masa Aktif Sesi: ${fbResp.data.expires_in} detik (Refresh Token Permanent)\n`);
  } catch (err) {
    console.error('    ❌ Token TIDAK VALID atau telah dicabut oleh Google:', err.response?.data || err.message);
    return;
  }

  // 2. Cek Sinkronisasi Data Spreadsheet Master (Weavy_Accounts)
  console.log('[2] Memeriksa Riwayat Saldo di Database Akun Spreadsheet...');
  let sheetCredits = null;
  let sheetTotalCredits = null;
  let accountId = null;

  try {
    const keyPath = path.join(process.cwd(), 'google-service-account.json');
    if (fs.existsSync(keyPath)) {
      const auth = new google.auth.GoogleAuth({
        keyFile: keyPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const sheets = google.sheets({ version: 'v4', auth });
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Weavy_Accounts!A1:L100',
      });
      const rows = res.data.values || [];
      const matched = rows.find(r => 
        (r[2] && email && r[2].toLowerCase() === email.toLowerCase()) ||
        (r[7] && r[7].trim() === inputRefreshToken.trim())
      );

      if (matched) {
        accountId = matched[1];
        sheetCredits = matched[8];
        sheetTotalCredits = matched[9];
        console.log(`    ✅ Data Akun Ditemukan di Spreadsheet (Baris ID: ${accountId})`);
        console.log(`    - Sisa Kredit    : ${sheetCredits} Koin`);
        console.log(`    - Kuota Total    : ${sheetTotalCredits} Koin`);
      } else {
        console.log('    ℹ️  Akun belum terdaftar di spreadsheet, kuota standar Weavy: 150 Koin');
      }
    }
  } catch (sheetErr) {
    console.log('    ⚠️  Info Spreadsheet:', sheetErr.message);
  }

  console.log('\n================================================================');
  console.log('📋 RINGKASAN AKUN:');
  console.log(`• Status Akun : AKTIF / SEHAT`);
  console.log(`• Email       : ${email}`);
  console.log(`• Nama        : ${displayName}`);
  console.log(`• Sisa Credit : ${sheetCredits !== null ? sheetCredits : 150} Koin (dari total ${sheetTotalCredits || 150} Koin)`);
  console.log('================================================================');
}

checkWeavyAccount();
