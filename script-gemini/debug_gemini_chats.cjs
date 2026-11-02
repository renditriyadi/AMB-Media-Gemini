const { GeminiWebClient } = require('./gemini_chat.cjs');
const https = require('https');

const COOKIES = `NID=Cr8CCAES8QEBOxGDSB_YkknLlBjik838NOCn6-Y7-YbG-5vZl2uAfV8OEb1NnV5xI7wKoDnOXhL_37Tv3JPggw73wrnRnddIKoNn9WVRIKtvlMwEqiehWiG0PrNRAYOVEQCZoNoxUsGEFUqzZ7_6MLtxubNoJosywlkApS-ec4ed80je16cVTY0FpbrgGy248z15MIapmIrts3cZoSLqmk8YUftEgR8aYZ1Bh_hiEksoi5qkhH9tfg9p1nN8fk8irw0SikjcOdHP2spf3Vuoy6Xb2R_1GXqdA-oILX2DTJ-R8PyH20mhZt1SohImfhhRVeU_Ja3bImllKAEyRQHSrAfPQIXWl3GNvWfxU-m3sOsoPPBztWK0wPSfUgFP4eAPiK_3aKGlba8dRy_R3k0da23TKUvaBU75juER6ZM727S9BQ; HSID=Arq_UBsgt1VPU3RV1; SSID=AcF2eycTTd3bYs6IV; APISID=_vhc9qL9Y2qJh9WB/AxJ0sciZTImOzS_fM; SAPISID=6wn8s1945h8uBnJy/AfUfUas1wyFBBx25H; __Secure-1PAPISID=6wn8s1945h8uBnJy/AfUfUas1wyFBBx25H; __Secure-3PAPISID=6wn8s1945h8uBnJy/AfUfUas1wyFBBx25H; SID=g.a000DQl15M0SH4c6l3M0VmBE6yZufCHmMiI9P0unxmaJMf9suWmULIPgP1vyxrOfFhYkdlj9KgACgYKAYYSARQSFQHGX2Mi14dOapVDPL4_iGCBxIFeLBoVAUF8yKo5isNhvs-rU9fTglURf-vC0076; __Secure-1PSID=g.a000DQl15M0SH4c6l3M0VmBE6yZufCHmMiI9P0unxmaJMf9suWmUPP6yAfFs6cC7L_DIksorUwACgYKAcwSARQSFQHGX2Mi9pIuLEX4Bi0Wm6n6aJdSLxoVAUF8yKob2lq9MGQ933RD2IpZ1rLC0076; __Secure-3PSID=g.a000DQl15M0SH4c6l3M0VmBE6yZufCHmMiI9P0unxmaJMf9suWmU01jTr4mT4-UdK1P2S8p63QACgYKAV8SARQSFQHGX2MiVc2NEp3axrmeTVJ-zNzu0RoVAUF8yKpFMAFtZQgKzF3CSckTDWmS0076; __Secure-1PSIDTS=sidts-CjcBkldj_zAADk8ZMMr9yKIjJxGwClacNjnsHDl-cS7H4_thOx-VnVVZ7su2gzfhvcJAe4IbuQwtEAA; __Secure-1PSIDRTS=sidts-CjcBkldj_zAADk8ZMMr9yKIjJxGwClacNjnsHDl-cS7H4_thOx-VnVVZ7su2gzfhvcJAe4IbuQwtEAA; __Secure-3PSIDTS=sidts-CjcBkldj_zAADk8ZMMr9yKIjJxGwClacNjnsHDl-cS7H4_thOx-VnVVZ7su2gzfhvcJAe4IbuQwtEAA; __Secure-3PSIDRTS=sidts-CjcBkldj_zAADk8ZMMr9yKIjJxGwClacNjnsHDl-cS7H4_thOx-VnVVZ7su2gzfhvcJAe4IbuQwtEAA; SIDCC=AKEyXzX6r-G6lLfNTBNwmKvT7smthYxDNLmREQzH3zc1MP3Iva3bVOPpj0xurEDLrOfPjlER; __Secure-1PSIDCC=AKEyXzVrEbhUvjK6p3KvW4oM6YgWOKHdnUybxQn3aFCRaoPYG7wcjJyHN_GJcIMLr3OaC7n3aA; __Secure-3PSIDCC=AKEyXzUDa2zUOnan9QZQOMDjbw2lfnakcn_tKWFKsenz2qOr724wsSWuc0zlt4v1V4x_uo37KA`;

async function debug() {
  const client = new GeminiWebClient(COOKIES);
  await client.initSession();
  console.log('CSRF:', client.snlm0e ? client.snlm0e.slice(0, 15) : 'None');
  console.log('BL:', client.bl);

  // 1. Check MaZiqc response raw
  const envelope = [[['MaZiqc', JSON.stringify([50, null, []]), null, 'generic']]];
  const bodyParams = new URLSearchParams();
  bodyParams.append('f.req', JSON.stringify(envelope));
  bodyParams.append('at', client.snlm0e);

  const endpoint = `https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=MaZiqc&bl=${encodeURIComponent(client.bl)}&rt=c`;
  const res = await client._request(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'Origin': 'https://gemini.google.com',
      'Referer': 'https://gemini.google.com/app',
      'X-Same-Domain': '1',
    },
    body: bodyParams.toString(),
  });

  console.log('MaZiqc Status:', res.status);
  console.log('MaZiqc Response length:', res.body.length);
  console.log('MaZiqc Response preview (first 1000 chars):');
  console.log(res.body.slice(0, 1000));

  // 2. Also check if there are other RPCs or chat lists in the HTML page
  const htmlRes = await client._request('https://gemini.google.com/app');
  console.log('HTML status:', htmlRes.status, 'length:', htmlRes.body.length);
  
  // Look for conversation list or recent chats in HTML
  const convMatches = htmlRes.body.match(/c_[a-zA-Z0-9_-]+/g);
  console.log('Found conv IDs in HTML:', convMatches ? [...new Set(convMatches)] : 'None');

  // Look for any video / mp4 / generated media in HTML
  const mp4Matches = htmlRes.body.match(/https:\/\/[^"'\s]+\.mp4[^"'\s]*/g);
  console.log('Found mp4 in HTML:', mp4Matches ? mp4Matches.length : 0);
  
  const videoMatches = htmlRes.body.match(/video_generation/g);
  console.log('video_generation count in HTML:', videoMatches ? videoMatches.length : 0);
}

debug().catch(console.error);
