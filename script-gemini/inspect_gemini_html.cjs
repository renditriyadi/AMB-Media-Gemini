const { GeminiWebClient } = require('./gemini_chat.cjs');
const fs = require('fs');

const COOKIES = `NID=Cr8CCAES8QEBOxGDSB_YkknLlBjik838NOCn6-Y7-YbG-5vZl2uAfV8OEb1NnV5xI7wKoDnOXhL_37Tv3JPggw73wrnRnddIKoNn9WVRIKtvlMwEqiehWiG0PrNRAYOVEQCZoNoxUsGEFUqzZ7_6MLtxubNoJosywlkApS-ec4ed80je16cVTY0FpbrgGy248z15MIapmIrts3cZoSLqmk8YUftEgR8aYZ1Bh_hiEksoi5qkhH9tfg9p1nN8fk8irw0SikjcOdHP2spf3Vuoy6Xb2R_1GXqdA-oILX2DTJ-R8PyH20mhZt1SohImfhhRVeU_Ja3bImllKAEyRQHSrAfPQIXWl3GNvWfxU-m3sOsoPPBztWK0wPSfUgFP4eAPiK_3aKGlba8dRy_R3k0da23TKUvaBU75juER6ZM727S9BQ; HSID=Arq_UBsgt1VPU3RV1; SSID=AcF2eycTTd3bYs6IV; APISID=_vhc9qL9Y2qJh9WB/AxJ0sciZTImOzS_fM; SAPISID=6wn8s1945h8uBnJy/AfUfUas1wyFBBx25H; __Secure-1PAPISID=6wn8s1945h8uBnJy/AfUfUas1wyFBBx25H; __Secure-3PAPISID=6wn8s1945h8uBnJy/AfUfUas1wyFBBx25H; SID=g.a000DQl15M0SH4c6l3M0VmBE6yZufCHmMiI9P0unxmaJMf9suWmULIPgP1vyxrOfFhYkdlj9KgACgYKAYYSARQSFQHGX2Mi14dOapVDPL4_iGCBxIFeLBoVAUF8yKo5isNhvs-rU9fTglURf-vC0076; __Secure-1PSID=g.a000DQl15M0SH4c6l3M0VmBE6yZufCHmMiI9P0unxmaJMf9suWmUPP6yAfFs6cC7L_DIksorUwACgYKAcwSARQSFQHGX2Mi9pIuLEX4Bi0Wm6n6aJdSLxoVAUF8yKob2lq9MGQ933RD2IpZ1rLC0076; __Secure-3PSID=g.a000DQl15M0SH4c6l3M0VmBE6yZufCHmMiI9P0unxmaJMf9suWmU01jTr4mT4-UdK1P2S8p63QACgYKAV8SARQSFQHGX2MiVc2NEp3axrmeTVJ-zNzu0RoVAUF8yKpFMAFtZQgKzF3CSckTDWmS0076; __Secure-1PSIDTS=sidts-CjcBkldj_zAADk8ZMMr9yKIjJxGwClacNjnsHDl-cS7H4_thOx-VnVVZ7su2gzfhvcJAe4IbuQwtEAA; __Secure-1PSIDRTS=sidts-CjcBkldj_zAADk8ZMMr9yKIjJxGwClacNjnsHDl-cS7H4_thOx-VnVVZ7su2gzfhvcJAe4IbuQwtEAA; __Secure-3PSIDTS=sidts-CjcBkldj_zAADk8ZMMr9yKIjJxGwClacNjnsHDl-cS7H4_thOx-VnVVZ7su2gzfhvcJAe4IbuQwtEAA; __Secure-3PSIDRTS=sidts-CjcBkldj_zAADk8ZMMr9yKIjJxGwClacNjnsHDl-cS7H4_thOx-VnVVZ7su2gzfhvcJAe4IbuQwtEAA; SIDCC=AKEyXzX6r-G6lLfNTBNwmKvT7smthYxDNLmREQzH3zc1MP3Iva3bVOPpj0xurEDLrOfPjlER; __Secure-1PSIDCC=AKEyXzVrEbhUvjK6p3KvW4oM6YgWOKHdnUybxQn3aFCRaoPYG7wcjJyHN_GJcIMLr3OaC7n3aA; __Secure-3PSIDCC=AKEyXzUDa2zUOnan9QZQOMDjbw2lfnakcn_tKWFKsenz2qOr724wsSWuc0zlt4v1V4x_uo37KA`;

async function inspectHtml() {
  const client = new GeminiWebClient(COOKIES);
  const htmlRes = await client._request('https://gemini.google.com/app');
  const body = htmlRes.body;
  fs.writeFileSync('/tmp/gemini_app.html', body);

  console.log('Saved /tmp/gemini_app.html, size:', body.length);

  // Search for AF_initDataCallback
  const callbacks = [];
  const regex = /AF_initDataCallback\s*\(\s*\{([^<]+?)\}\s*\)\s*;/g;
  let match;
  while ((match = regex.exec(body)) !== null) {
    callbacks.push(match[1]);
  }
  console.log('Found AF_initDataCallback count:', callbacks.length);

  for (let i = 0; i < callbacks.length; i++) {
    const cb = callbacks[i];
    const keyMatch = cb.match(/key:\s*'([^']+)'/);
    const key = keyMatch ? keyMatch[1] : 'unknown';
    console.log(`Callback #${i + 1} key: ${key}, length: ${cb.length}`);
    if (cb.includes('video') || cb.includes('mp4') || cb.includes('c_') || cb.includes('Veo') || cb.includes('Scene')) {
      console.log(`  --> Mentions video/mp4/conv! Preview:`, cb.slice(0, 300));
    }
  }

  // Look for any snippet containing 'video_generation'
  const idx = body.indexOf('video_generation');
  if (idx !== -1) {
    console.log('video_generation snippet:', body.slice(Math.max(0, idx - 200), Math.min(body.length, idx + 400)));
  }

  // Search for user's prompt or title "Scene 1: Hook Buah"
  const fruitIdx = body.indexOf('Buah');
  if (fruitIdx !== -1) {
    console.log('Found "Buah" in HTML at index:', fruitIdx);
    console.log('Snippet:', body.slice(Math.max(0, fruitIdx - 150), Math.min(body.length, fruitIdx + 250)));
  } else {
    console.log('"Buah" not found in direct HTML page.');
  }
}

inspectHtml().catch(console.error);
