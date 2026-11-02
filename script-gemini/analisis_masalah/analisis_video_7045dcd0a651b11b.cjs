const { GeminiWebClient } = require('../gemini_chat.cjs');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

const FRESH_COOKIES = `OTZ=8810359_28_28__28_; NID=Cr8CCAES8QEBOxGDSLQnxsR2TNJ3m_ReS6srE_dJ1Fcfp-r2ztm2ciuIMi5FJZqu592w2n4XJtx7JU_a2jJwoVA0r8JrMtHhfGNrXiUqgxu1JLztd--pDE0VmuVd9ZuD__UcOeqISMYBr2Gg_sqQYn-lUNjRfvTx_A9MlQutU7RIZeBKZndQHRO-GqNWvyMSapxbWt_mmBXGGGWrcalSgJfhYkR1vaJPPOalHuyXOg6i8lprwBSM2HyUSxQgQlAoYa40ImiQ2oEspKX3TQpgWLG6yal7tdirg3HVV881DB1Mpp9-f3Lz9AnSyoCt9o8nM5UVJSuMC0vaKAEyRQHSrAfPBxemNS6qkmMdgB1hPeESdqGM705Qr3euU0YjPLdhrTIYR2aUmX1CZTSv22Q0gzwxNFLnZuL_eoDgM3_i3BcMBg; HSID=AVWfs6zTo0PjHT2DX; SSID=Aq9Mc9eQnnC_-hImi; APISID=4VV5V4p5HMURWOma/AOlH0I4VuGSt-Gsx1; SAPISID=UcWgoeD5X_2y4NK_/A1S6BASl-n4SWB_V3; __Secure-1PAPISID=UcWgoeD5X_2y4NK_/A1S6BASl-n4SWB_V3; __Secure-3PAPISID=UcWgoeD5X_2y4NK_/A1S6BASl-n4SWB_V3; ACCOUNT_CHOOSER=AFx_qI4IKnJyVjxpCPW60TZIkzMKP_3MFdFS1wboBc_yWnihT3M82gsimvzuaWGRSSkcg3MxcZ8PZWr1OASjNMLSWw5eBZ6BCrGzzO9CnwjQ_gHnzOHoNl18T4ne4q2MfcmDJvgs3pP9FuFtAH1431iLkDC3zyCEMFtvxFGYPYA2e3CPBNVakl0; __Host-GAPS=1:pixZQsNqydFwVajS4HYH-Dh5AQOJrY6z93nioDUoEuxVbVdcunzHB5cR_Z1R64Dow7DGtM_US5AoaxrY7r3iT-_0LIYcVQ:dH54tzliY9S_UbwI; LSID=o.myaccount.google.com|s.ID|s.youtube:g.a000DQmZ1Qxftp3_fEBXcKVYhya2qpiqgC8qhpOrPYIYtjPdxg80ZYBxhAzbmigwIgDi-Zbz2gACgYKATgSARISFQHGX2MiaVy8Z0Ke6Ijr_dW6nY46mxoVAUF8yKq56Xa98S5unz6MlfHOsMN_0076; __Host-1PLSID=o.myaccount.google.com|s.ID|s.youtube:g.a000DQmZ1Qxftp3_fEBXcKVYhya2qpiqgC8qhpOrPYIYtjPdxg80QrJs5xDauLv30GtND6m-DAACgYKAYgSARISFQHGX2Mi3P5vVGwriaB0KmUxNxdlxhoVAUF8yKo7K0BVu2urn85U6TArE1TR0076; __Host-3PLSID=o.myaccount.google.com|s.ID|s.youtube:g.a000DQmZ1Qxftp3_fEBXcKVYhya2qpiqgC8qhpOrPYIYtjPdxg802MbhTEMADcuti-M-yw6WZwACgYKASUSARISFQHGX2MiWV6T40qIH8w4SRwOOfzTpRoVAUF8yKqydUQcaQI5oe7oikQIL7Hx0076; OSID=g.a000DQmZ1b7Ng53TMTGIRhL2-Pe425cCpC3OA402HDtlc73a8cHzpU63SGNePsAKgRH4JRl8JwACgYKAVoSARISFQHGX2MiwaJILqFAXpZqBGvtqS7WGBoVAUF8yKqYOIuQU7A_w0MwP186DWu60076; __Secure-OSID=g.a000DQmZ1b7Ng53TMTGIRhL2-Pe425cCpC3OA402HDtlc73a8cHz2W5KNiicxBzSF3QM0MxEwgACgYKAeMSARISFQHGX2Mi3564tG0A7Vlt-oRD43-PVBoVAUF8yKpnoRy1OYLHokJJYK5oiucY0076; SID=g.a000DQmZ1QjkHO7hWnLF-99we3YLancjr2bWXmurdDPzISVG3ZcP2MoGMNnBT9UmaYmMQeHj0AACgYKAW4SARISFQHGX2MiPCyvhJFk859Tn7osMHjpChoVAUF8yKqcgnjvl1IlbhImmZ124PIb0076; __Secure-1PSID=g.a000DQmZ1QjkHO7hWnLF-99we3YLancjr2bWXmurdDPzISVG3ZcPsRznFc_LsJ_hU1mB4rvXwwACgYKAQsSARISFQHGX2Mi4PAzI56-mrhqCh0UYKHSdRoVAUF8yKoES9v6F4xd5MNupJCmxOiT0076; __Secure-3PSID=g.a000DQmZ1QjkHO7hWnLF-99we3YLancjr2bWXmurdDPzISVG3ZcP5jXlFSJCAtsyuIqIVIYtHgACgYKAbkSARISFQHGX2MiydBQuFDO_tb1OjA3aFlw-BoVAUF8yKozFGKbrAdCyDyFtbglgKd-0076; __Secure-1PSIDTS=sidts-CjUBkldj_1x6BJbG9Bn6rieLyJ8vlaU7lqU-qnDXBu3qxx5-ugewYQqcwwodSJQ3bkmigUN-6BAA; __Secure-1PSIDRTS=sidts-CjUBkldj_1x6BJbG9Bn6rieLyJ8vlaU7lqU-qnDXBu3qxx5-ugewYQqcwwodSJQ3bkmigUN-6BAA; __Secure-3PSIDTS=sidts-CjUBkldj_1x6BJbG9Bn6rieLyJ8vlaU7lqU-qnDXBu3qxx5-ugewYQqcwwodSJQ3bkmigUN-6BAA; __Secure-3PSIDRTS=sidts-CjUBkldj_1x6BJbG9Bn6rieLyJ8vlaU7lqU-qnDXBu3qxx5-ugewYQqcwwodSJQ3bkmigUN-6BAA; OTZ=8810359_28_28__28_; OTZ=8810359_28_28__28_; COMPASS=gemini-pd=CjwACWuJV93jFYb_b6k1ZbZc5AVi75OXfwVJx6huPFdJgLZgT-iphNSBtyIyTho-2Gurv4U86El7hPmdVFUQ09iC1gYaZwAJa4lXUJcMwSWR969DyeRN8IPWZmRV1au5xDqoq03XPhq5VPBPDBdFId18o_XkLKYuDKobPoX6-PY6VSA5pVXiu--exfvniE2oBUCnoXoPWm_qul51O3i_cbxrx4pO7hP9_oSgZ-QgATAB; OTZ=8810359_28_28__28_; _gcl_au=1.1.1823112455.1790925539; _ga=GA1.1.1130557740.1790925540; _ga_WC57KJ50ZZ=GS2.1.s1790925539$o1$g1$t1790925551$j48$l0$h0; _ga_BF8Q35BMLM=GS2.1.s1790925540$o1$g1$t1790925551$j49$l0$h0; SIDCC=AKEyXzWAI9Qwu97YgezhS9SFktqUC62xg8kDQItIIOjyXHMetbE8YUreoWmjAzpfwarFBeUu; __Secure-1PSIDCC=AKEyXzW3mKmMQce5_mzgmSjSuqEhbvvMgH7E2VOtLhpPi9rAMUDzkqHRWR2-80OB-Ow8i-Cp; __Secure-3PSIDCC=AKEyXzW6caLjveV-NrvScXjmeeQCkfevOp3KnQHlNyGdK9DzhwIOHAcvZcyxnaJkVFHHnBz7MQ`;

const TARGET_CONV_ID = 'c_7045dcd0a651b11b';

async function runAnalysis() {
  console.log('================================================================');
  console.log('🔍 ANALISIS MASALAH & RESOLUSI VIDEO GOOGLE GEMINI');
  console.log('================================================================');
  console.log('• Target Conversation ID:', TARGET_CONV_ID);

  const client = new GeminiWebClient(FRESH_COOKIES);
  await client.initSession();

  console.log('✅ Session initialized successfully.');
  console.log('• User Email/Account:', client.userEmail || 'Checked');

  // 1. Fetch raw conversation history
  console.log(`\n[1/3] Mengambil data riwayat percakapan dari Google Gemini...`);
  const history = await client.getConversationHistory(TARGET_CONV_ID);
  
  // Save raw history to file for detailed debugging
  const debugHistoryPath = path.join(__dirname, 'raw_history_7045dcd0a651b11b.json');
  fs.writeFileSync(debugHistoryPath, JSON.stringify(history, null, 2), 'utf-8');
  console.log(`  • Raw history disimpan ke: ${debugHistoryPath}`);

  // 2. Extract video objects
  console.log(`\n[2/3] Memindai objek video di dalam riwayat...`);
  const videoObj = client.extractVideoFromHistory(history);
  console.log('  • Video Object:', JSON.stringify(videoObj, null, 2));

  // Find all candidate URLs
  const candidateUrls = [];
  const scanForUrls = (obj) => {
    if (!obj) return;
    if (typeof obj === 'string') {
      if (obj.startsWith('http') && (obj.includes('googleusercontent') || obj.includes('usercontent.google') || obj.includes('video.mp4'))) {
        candidateUrls.push(obj);
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) scanForUrls(item);
    } else if (typeof obj === 'object') {
      for (const k of Object.keys(obj)) scanForUrls(obj[k]);
    }
  };
  scanForUrls(history);
  console.log(`  • Ditemukan ${candidateUrls.length} kandidat URL:`, candidateUrls);

  // 3. Test direct downloads & Stream extraction
  console.log(`\n[3/3] Menguji download video ke disk lokal (/media-cache/)...`);
  const mediaCacheDir = path.join(process.cwd(), 'media-cache');
  if (!fs.existsSync(mediaCacheDir)) fs.mkdirSync(mediaCacheDir, { recursive: true });

  const finalVideoFile = path.join(mediaCacheDir, `gemini_veo_${TARGET_CONV_ID}.mp4`);

  if (videoObj) {
    try {
      await client.downloadMedia(videoObj, finalVideoFile);
      const stat = fs.statSync(finalVideoFile);
      console.log(`  🎉 SUCCESS! Video berhasil diunduh ke storage server!`);
      console.log(`  • Path File  : ${finalVideoFile}`);
      console.log(`  • Ukuran File: ${(stat.size / (1024 * 1024)).toFixed(2)} MB (${stat.size} bytes)`);
      console.log(`  • URL Player : /media-cache/gemini_veo_${TARGET_CONV_ID}.mp4`);
    } catch (dlErr) {
      console.warn(`  ❌ downloadMedia error:`, dlErr.message);
    }
  }

  return { videoObj, candidateUrls };
}

runAnalysis().catch((err) => {
  console.error('Fatal Error:', err);
});
