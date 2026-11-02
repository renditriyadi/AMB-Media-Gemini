const { GeminiWebClient } = require('./gemini_chat.cjs');

const COOKIES = `NID=Cr8CCAES8QEBOxGDSB_YkknLlBjik838NOCn6-Y7-YbG-5vZl2uAfV8OEb1NnV5xI7wKoDnOXhL_37Tv3JPggw73wrnRnddIKoNn9WVRIKtvlMwEqiehWiG0PrNRAYOVEQCZoNoxUsGEFUqzZ7_6MLtxubNoJosywlkApS-ec4ed80je16cVTY0FpbrgGy248z15MIapmIrts3cZoSLqmk8YUftEgR8aYZ1Bh_hiEksoi5qkhH9tfg9p1nN8fk8irw0SikjcOdHP2spf3Vuoy6Xb2R_1GXqdA-oILX2DTJ-R8PyH20mhZt1SohImfhhRVeU_Ja3bImllKAEyRQHSrAfPQIXWl3GNvWfxU-m3sOsoPPBztWK0wPSfUgFP4eAPiK_3aKGlba8dRy_R3k0da23TKUvaBU75juER6ZM727S9BQ; HSID=Arq_UBsgt1VPU3RV1; SSID=AcF2eycTTd3bYs6IV; APISID=_vhc9qL9Y2qJh9WB/AxJ0sciZTImOzS_fM; SAPISID=6wn8s1945h8uBnJy/AfUfUas1wyFBBx25H; __Secure-1PAPISID=6wn8s1945h8uBnJy/AfUfUas1wyFBBx25H; __Secure-3PAPISID=6wn8s1945h8uBnJy/AfUfUas1wyFBBx25H; SID=g.a000DQl15M0SH4c6l3M0VmBE6yZufCHmMiI9P0unxmaJMf9suWmULIPgP1vyxrOfFhYkdlj9KgACgYKAYYSARQSFQHGX2Mi14dOapVDPL4_iGCBxIFeLBoVAUF8yKo5isNhvs-rU9fTglURf-vC0076; __Secure-1PSID=g.a000DQl15M0SH4c6l3M0VmBE6yZufCHmMiI9P0unxmaJMf9suWmUPP6yAfFs6cC7L_DIksorUwACgYKAcwSARQSFQHGX2Mi9pIuLEX4Bi0Wm6n6aJdSLxoVAUF8yKob2lq9MGQ933RD2IpZ1rLC0076; __Secure-3PSID=g.a000DQl15M0SH4c6l3M0VmBE6yZufCHmMiI9P0unxmaJMf9suWmU01jTr4mT4-UdK1P2S8p63QACgYKAV8SARQSFQHGX2MiVc2NEp3axrmeTVJ-zNzu0RoVAUF8yKpFMAFtZQgKzF3CSckTDWmS0076; __Secure-1PSIDTS=sidts-CjcBkldj_zAADk8ZMMr9yKIjJxGwClacNjnsHDl-cS7H4_thOx-VnVVZ7su2gzfhvcJAe4IbuQwtEAA; __Secure-1PSIDRTS=sidts-CjcBkldj_zAADk8ZMMr9yKIjJxGwClacNjnsHDl-cS7H4_thOx-VnVVZ7su2gzfhvcJAe4IbuQwtEAA; __Secure-3PSIDTS=sidts-CjcBkldj_zAADk8ZMMr9yKIjJxGwClacNjnsHDl-cS7H4_thOx-VnVVZ7su2gzfhvcJAe4IbuQwtEAA; __Secure-3PSIDRTS=sidts-CjcBkldj_zAADk8ZMMr9yKIjJxGwClacNjnsHDl-cS7H4_thOx-VnVVZ7su2gzfhvcJAe4IbuQwtEAA; SIDCC=AKEyXzX6r-G6lLfNTBNwmKvT7smthYxDNLmREQzH3zc1MP3Iva3bVOPpj0xurEDLrOfPjlER; __Secure-1PSIDCC=AKEyXzVrEbhUvjK6p3KvW4oM6YgWOKHdnUybxQn3aFCRaoPYG7wcjJyHN_GJcIMLr3OaC7n3aA; __Secure-3PSIDCC=AKEyXzUDa2zUOnan9QZQOMDjbw2lfnakcn_tKWFKsenz2qOr724wsSWuc0zlt4v1V4x_uo37KA`;

async function testConv() {
  const client = new GeminiWebClient(COOKIES);
  await client.initSession();

  console.log('Testing getConversationHistory for c_5aa5b6b77489a8ff...');
  const hist = await client.getConversationHistory('c_5aa5b6b77489a8ff').catch(e => e.message);
  console.log('Result type:', typeof hist);
  if (typeof hist === 'object') {
    const video = client.extractVideoFromHistory(hist);
    console.log('Video extracted:', video);
  } else {
    console.log('Error:', hist);
  }
}

testConv().catch(console.error);
