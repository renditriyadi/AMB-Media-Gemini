/**
 * Script untuk memeriksa detail akun Google Gemini dan menghitung berapa video yang berhasil di-generate
 * Lokasi: script-gemini/check_account_generations.cjs
 */

const { GeminiWebClient } = require('./gemini_chat.cjs');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Kredensial Cookies TERBARU dari input cURL pengguna
const COOKIES_INPUT = `NID=Cr8CCAES8QEBOxGDSB_YkknLlBjik838NOCn6-Y7-YbG-5vZl2uAfV8OEb1NnV5xI7wKoDnOXhL_37Tv3JPggw73wrnRnddIKoNn9WVRIKtvlMwEqiehWiG0PrNRAYOVEQCZoNoxUsGEFUqzZ7_6MLtxubNoJosywlkApS-ec4ed80je16cVTY0FpbrgGy248z15MIapmIrts3cZoSLqmk8YUftEgR8aYZ1Bh_hiEksoi5qkhH9tfg9p1nN8fk8irw0SikjcOdHP2spf3Vuoy6Xb2R_1GXqdA-oILX2DTJ-R8PyH20mhZt1SohImfhhRVeU_Ja3bImllKAEyRQHSrAfPQIXWl3GNvWfxU-m3sOsoPPBztWK0wPSfUgFP4eAPiK_3aKGlba8dRy_R3k0da23TKUvaBU75juER6ZM727S9BQ; HSID=Arq_UBsgt1VPU3RV1; SSID=AcF2eycTTd3bYs6IV; APISID=_vhc9qL9Y2qJh9WB/AxJ0sciZTImOzS_fM; SAPISID=6wn8s1945h8uBnJy/AfUfUas1wyFBBx25H; __Secure-1PAPISID=6wn8s1945h8uBnJy/AfUfUas1wyFBBx25H; __Secure-3PAPISID=6wn8s1945h8uBnJy/AfUfUas1wyFBBx25H; SID=g.a000DQl15M0SH4c6l3M0VmBE6yZufCHmMiI9P0unxmaJMf9suWmULIPgP1vyxrOfFhYkdlj9KgACgYKAYYSARQSFQHGX2Mi14dOapVDPL4_iGCBxIFeLBoVAUF8yKo5isNhvs-rU9fTglURf-vC0076; __Secure-1PSID=g.a000DQl15M0SH4c6l3M0VmBE6yZufCHmMiI9P0unxmaJMf9suWmUPP6yAfFs6cC7L_DIksorUwACgYKAcwSARQSFQHGX2Mi9pIuLEX4Bi0Wm6n6aJdSLxoVAUF8yKob2lq9MGQ933RD2IpZ1rLC0076; __Secure-3PSID=g.a000DQl15M0SH4c6l3M0VmBE6yZufCHmMiI9P0unxmaJMf9suWmU01jTr4mT4-UdK1P2S8p63QACgYKAV8SARQSFQHGX2MiVc2NEp3axrmeTVJ-zNzu0RoVAUF8yKpFMAFtZQgKzF3CSckTDWmS0076; __Secure-1PSIDTS=sidts-CjcBkldj_zAADk8ZMMr9yKIjJxGwClacNjnsHDl-cS7H4_thOx-VnVVZ7su2gzfhvcJAe4IbuQwtEAA; __Secure-1PSIDRTS=sidts-CjcBkldj_zAADk8ZMMr9yKIjJxGwClacNjnsHDl-cS7H4_thOx-VnVVZ7su2gzfhvcJAe4IbuQwtEAA; __Secure-3PSIDTS=sidts-CjcBkldj_zAADk8ZMMr9yKIjJxGwClacNjnsHDl-cS7H4_thOx-VnVVZ7su2gzfhvcJAe4IbuQwtEAA; __Secure-3PSIDRTS=sidts-CjcBkldj_zAADk8ZMMr9yKIjJxGwClacNjnsHDl-cS7H4_thOx-VnVVZ7su2gzfhvcJAe4IbuQwtEAA; SIDCC=AKEyXzX6r-G6lLfNTBNwmKvT7smthYxDNLmREQzH3zc1MP3Iva3bVOPpj0xurEDLrOfPjlER; __Secure-1PSIDCC=AKEyXzVrEbhUvjK6p3KvW4oM6YgWOKHdnUybxQn3aFCRaoPYG7wcjJyHN_GJcIMLr3OaC7n3aA; __Secure-3PSIDCC=AKEyXzUDa2zUOnan9QZQOMDjbw2lfnakcn_tKWFKsenz2qOr724wsSWuc0zlt4v1V4x_uo37KA`;

function extractCookies(input) {
  if (!input) return '';
  const bMatch = input.match(/(?:-b|--cookie)\s+(?:'([^']+)'|"([^"]+)"|([^\s\r\n\\]+))/i);
  if (bMatch) return bMatch[1] || bMatch[2] || bMatch[3] || input;
  const hMatch = input.match(/-H\s+['"][Cc]ookie:\s*([^'"]+)['"]/i);
  if (hMatch) return hMatch[1];
  return input.trim();
}

async function fetchGoogleUserProfile(cookies) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'accounts.google.com',
        path: '/ListAccounts?source=ogb&json=standard',
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
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
                let encoded = sub.slice(0, endIdx);
                encoded = encoded.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) =>
                  String.fromCharCode(parseInt(hex, 16))
                );
                encoded = encoded.replace(/\\\//g, '/');
                const parsed = JSON.parse(encoded);
                if (Array.isArray(parsed) && Array.isArray(parsed[1]) && parsed[1].length > 0) {
                  const accountItem = parsed[1][0];
                  const displayName = accountItem[2] || '';
                  const email = accountItem[3] || '';
                  const photoUrl = accountItem[4] || '';
                  if (email && email.includes('@')) {
                    return resolve({ email, name: displayName, photoUrl });
                  }
                }
              }
            }

            const emailMatch = data.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            if (emailMatch && !emailMatch[1].includes('example.com') && !emailMatch[1].includes('googlers@google.com')) {
              return resolve({ email: emailMatch[1] });
            }
          } catch (e) {}
          resolve({});
        });
      }
    );
    req.on('error', () => resolve({}));
    req.setTimeout(8000, () => {
      req.destroy();
      resolve({});
    });
    req.end();
  });
}

async function runCheck() {
  console.log('===============================================================');
  console.log('🔍 MEMERIKSA STATUS GENERASI VIDEO AKUN GOOGLE GEMINI...');
  console.log('===============================================================\n');

  try {
    const rawInput = process.argv[2] || COOKIES_INPUT;
    const cookies = extractCookies(rawInput);
    const client = new GeminiWebClient(cookies);

    console.log('[1/4] Menginisialisasi sesi Web Gemini...');
    await client.initSession();
    console.log('  -> Status Sesi: AKTIF & VALID');
    console.log('  -> SNlM0e (Token CSRF):', client.snlm0e ? client.snlm0e.slice(0, 20) + '...' : 'None');
    console.log('  -> Build Version      :', client.bl);

    console.log('\n[2/4] Mengidentifikasi profil pengguna Google...');
    const userProfile = await fetchGoogleUserProfile(cookies);
    const email = userProfile.email || 'Email terenkripsi / Sesi Google valid';
    const name = userProfile.name || 'Pengguna Gemini';
    console.log('  -> Nama Akun :', name);
    console.log('  -> Email Akun:', email);

    // Hitung hash identifier akun
    const accKey = email.includes('@')
      ? email.toLowerCase().trim()
      : crypto.createHash('sha256').update(cookies).digest('hex').slice(0, 16);
    console.log('  -> Account Key Identifier:', accKey);

    // Baca histori lokal server untuk akun ini
    const usageFile = path.join(__dirname, '..', 'data', 'gemini_daily_usage.json');
    let localUsageRecord = null;
    if (fs.existsSync(usageFile)) {
      try {
        const allUsage = JSON.parse(fs.readFileSync(usageFile, 'utf-8'));
        localUsageRecord = allUsage[accKey] || allUsage[email] || null;
      } catch (e) {}
    }

    console.log('\n[3/4] Mengambil daftar riwayat percakapan dari server Google Gemini...');
    let conversations = [];
    try {
      conversations = await client.listConversations(100);
    } catch (e) {
      console.warn('  -> Notice listConversations:', e.message);
    }
    console.log(`  -> Total Percakapan di Temukan: ${conversations.length} percakapan`);

    // Batas hari ini (WIB / Asia/Jakarta)
    const now = new Date();
    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const datePart = (type) => dateParts.find((part) => part.type === type)?.value || '';
    const todayStr = `${datePart('year')}-${datePart('month')}-${datePart('day')}`;
    const startOfDay = Date.UTC(
      Number(datePart('year')),
      Number(datePart('month')) - 1,
      Number(datePart('day'))
    ) / 1000 - (7 * 60 * 60);
    const endOfDay = startOfDay + (24 * 60 * 60);

    console.log(`  -> Tanggal Server Hari Ini (WIB): ${todayStr}`);

    console.log('\n[4/4] Memindai riwayat untuk mendeteksi video (.mp4) yang BERHASIL di-generate...');

    let totalVideosAllTime = 0;
    let totalVideosToday = 0;
    const videosList = [];

    for (let i = 0; i < conversations.length; i++) {
      const conv = conversations[i];
      const isToday = conv.timeSec >= startOfDay && conv.timeSec < endOfDay;

      try {
        const history = await client.getConversationHistory(conv.id);
        const seenInConv = new Set();
        let convVideoCount = 0;
        const convVideos = [];

        const scanObj = (obj) => {
          if (!obj) return;
          if (Array.isArray(obj)) {
            if (
              obj.length >= 8 &&
              (obj[2] === 'video.mp4' || (typeof obj[2] === 'string' && obj[2].toLowerCase().endsWith('.mp4'))) &&
              Array.isArray(obj[7]) &&
              obj[7].length > 0
            ) {
              const urlKey = obj[7][0] || JSON.stringify(obj[7]);
              if (!seenInConv.has(urlKey)) {
                seenInConv.add(urlKey);
                convVideoCount++;
                const dlUrl = obj[7][0] || null;
                const cover = (obj[7].length > 1 ? obj[7][1] : null) || null;
                convVideos.push({
                  filename: obj[2],
                  downloadUrl: dlUrl,
                  coverUrl: cover,
                });
              }
            }
            for (const item of obj) scanObj(item);
          } else if (typeof obj === 'object') {
            for (const k of Object.keys(obj)) scanObj(obj[k]);
          }
        };

        scanObj(history);

        if (convVideoCount > 0) {
          totalVideosAllTime += convVideoCount;
          if (isToday) totalVideosToday += convVideoCount;

          const dateStr = conv.timestamp ? new Date(conv.timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : 'Unknown';
          videosList.push({
            chatId: conv.id,
            title: conv.title,
            date: dateStr,
            isToday,
            count: convVideoCount,
            videos: convVideos,
          });
        }
      } catch (err) {}
    }

    // Periksa juga task video yang berhasil dicatat di server lokal data/gemini_daily_usage.json
    let localCompletedVideos = [];
    if (localUsageRecord && Array.isArray(localUsageRecord.completedTaskIds)) {
      localCompletedVideos = localUsageRecord.completedTaskIds;
    }

    const recordedTotalCount = Math.max(totalVideosAllTime, totalVideosToday, localCompletedVideos.length, localUsageRecord?.used || 0);

    console.log('===============================================================');
    console.log('📊 HASIL ANALISIS KREDIT & GENERASI VIDEO (SERVER GOOGLE GEMINI)');
    console.log('===============================================================');
    console.log(`👤 Profil Akun                                    : ${name} (${email})`);
    console.log(`🎬 Video Berhasil Di-generate Total Akun          : ${recordedTotalCount} video`);
    console.log(`🎬 Rincian Video Sukses Server                    : ${localCompletedVideos.length} video selesai tercatat di cache`);
    
    const quotaTotal = 3;
    const remainingCredits = Math.max(0, quotaTotal - recordedTotalCount);
    console.log(`💳 Kuota Maksimal Akun (Non-Resetting)             : ${quotaTotal} video`);
    console.log(`💳 Nilai Kredit Terpakai (1 video = 1)            : ${recordedTotalCount} kredit`);
    console.log(`💳 Sisa Kredit Tersedia                           : ${remainingCredits} / ${quotaTotal} kredit`);
    console.log('===============================================================\n');

    if (localCompletedVideos.length > 0) {
      console.log('📋 DAFTAR FILE VIDEO BERHASIL PADA AKUN INI:');
      localCompletedVideos.forEach((v, idx) => {
        console.log(`  ${idx + 1}. ${v}`);
      });
      console.log('');
    }

    if (videosList.length > 0) {
      console.log('📋 DAFTAR PERCAKAPAN GEMINI DENGAN VIDEO:');
      videosList.forEach((item, idx) => {
        const badge = item.isToday ? ' [HARI INI]' : ' [SEBELUMNYA]';
        console.log(`\n  ${idx + 1}. Judul: "${item.title}"${badge}`);
        console.log(`     Waktu: ${item.date}`);
        console.log(`     Jumlah Video: ${item.count}`);
        item.videos.forEach((v, vIdx) => {
          console.log(`     - Video #${vIdx + 1}: ${v.downloadUrl ? v.downloadUrl.slice(0, 85) + '...' : v.filename}`);
        });
      });
    }

    console.log('===============================================================');
    console.log('✅ PEMERIKSAAN SELESAI');
    console.log('===============================================================');

  } catch (err) {
    console.error('\n❌ Terjadi kesalahan saat memeriksa akun:', err.message || err);
  }
}

runCheck();
