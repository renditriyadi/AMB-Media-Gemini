const { GeminiWebClient } = require('./gemini_chat.cjs');

const USER_COOKIES = `HSID=A7EHL-d9emEwo481G; SSID=AaytPT-VvpBFEiF0l; APISID=JA2FpDtBh2eKr1t6/AzVyISfLBwPXk4vhP; SAPISID=PeCO-OPP3SlfS12O/Au5YZJftCWsZ0p8c1; __Secure-1PAPISID=PeCO-OPP3SlfS12O/Au5YZJftCWsZ0p8c1; __Secure-3PAPISID=PeCO-OPP3SlfS12O/Au5YZJftCWsZ0p8c1; SID=g.a000DAleuwv80KUPcbIrfvWi8pqKjD4MijJa8dxu-2zJAvJXlS863mIc7Hiw4Up8BWp7TlpLlwACgYKAZcSARQSFQHGX2MixgKufDGubWdSQ3_vU07mqBoVAUF8yKrZS8A8L_zOY8hH0JuCncC00076; __Secure-1PSID=g.a000DAleuwv80KUPcbIrfvWi8pqKjD4MijJa8dxu-2zJAvJXlS86nvVg72XvRk_8B-7VBaUlpwACgYKAR0SARQSFQHGX2MijVY_C5KdJ2eWusT8uobcRRoVAUF8yKoVs4ogmSXYnjkkeNFyHkv80076; __Secure-3PSID=g.a000DAleuwv80KUPcbIrfvWi8pqKjD4MijJa8dxu-2zJAvJXlS86WsQPea7bETo69iVePM6Q6AACgYKASsSARQSFQHGX2Mi44Rt-tUErGrZInBkcoROTBoVAUF8yKrTIlDat36nvt734pHj_Vuj0076; NID=CrsCCAES7QEBOxGDSBkZ7kLw3gFc8CeYkv9eWBykPdZ3lglTQLcKt5ah2qjD0Jnew8rYo8RuVw6nKU_qCh0lQTDX5f2b2l3loUQG2IwHlH2FSHCE__EKBQ8GuvZtMRHc1ReGujCdYRFVXsX4f0IKJ9OiWeBFqqJYOx2KXNNpD9_80fZaHVtzJW6tOYvr8Sr-u5KgJsRlYYqmafCP0prMFRupeWqKwAHTzqzFb8Gxqs9LWx_09y203pxL_w9lLkzlEDZT0ildeS1-dGgtuJBwD5WZjjoiyGAI_QIdSukTcAXFpBjYXpnpbmtRQkW4U3AUgP7aVSooATJFAdKsB89OhhIzErKY60CVletQHThHtdhIsI82-_PcVf3ELweLrlYw__jgflNiAgSsDYWbZa68oXO2i2nMtNbpWYBkQN8L; __Secure-1PSIDTS=sidts-CjcBkldj_4877_r33o5XDR8chb35Gszo9lwSQwwfTYx5FRfM0DGLzt09BQQlyOpeG_YL1GNR1hJOEAA; __Secure-1PSIDRTS=sidts-CjcBkldj_4877_r33o5XDR8chb35Gszo9lwSQwwfTYx5FRfM0DGLzt09BQQlyOpeG_YL1GNR1hJOEAA; __Secure-3PSIDTS=sidts-CjcBkldj_4877_r33o5XDR8chb35Gszo9lwSQwwfTYx5FRfM0DGLzt09BQQlyOpeG_YL1GNR1hJOEAA; __Secure-3PSIDRTS=sidts-CjcBkldj_4877_r33o5XDR8chb35Gszo9lwSQwwfTYx5FRfM0DGLzt09BQQlyOpeG_YL1GNR1hJOEAA; SIDCC=AKEyXzWFwWzcfxvYULeKsiZHi-B6QDbzkxL8BYLiFMRK5CDrSAyBXsjxWTqhm4DEy_BvAqVWKQ; __Secure-1PSIDCC=AKEyXzUHBPpJxQNLMz40OdINvkYhsnDL9dvSYrzdVoMaz6kBHoYeI0ExEWQgsP3YpvIhB6XrRew; __Secure-3PSIDCC=AKEyXzXC4dnBhQ-aQ5ZVObr5dosTQYTsDAA02voEEdDzpWqi6zmxQyzys8pn4TmBVFkkXo0fWw`;

async function run() {
  console.log('--- Memulai Pengujian Chat Google Gemini Web dengan Akun Anda ---');
  try {
    const client = new GeminiWebClient(USER_COOKIES);
    console.log('[1] Menginisialisasi sesi & mengekstrak token SNlM0e dari gemini.google.com...');
    await client.initSession();

    console.log(`[2] Sesi Aktif! Token SNlM0e: ${client.snlm0e ? client.snlm0e.slice(0, 15) + '...' : 'None'}`);

    const promptText = process.argv[2] || 'Ceritakan secara singkat keindahan pemandangan alam di Kota Bandung.';
    console.log(`[3] Mengirim prompt ke Gemini:\n"${promptText}"\n`);

    const result = await client.sendMessage(promptText, true);

    console.log('--- RESPON DARI GOOGLE GEMINI ---');
    console.log(result.text || '(Tidak ada teks balasan)');
    if (result.images && result.images.length > 0) {
      console.log('Gambar terdeteksi:', result.images);
    }
    if (result.videos && result.videos.length > 0) {
      console.log('Video terdeteksi:', result.videos);
    }
    console.log('---------------------------------');
  } catch (err) {
    console.error('❌ Error saat menghubungi Gemini:', err.message);
  }
}

run();
