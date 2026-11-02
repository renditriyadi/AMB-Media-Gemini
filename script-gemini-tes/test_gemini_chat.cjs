const { GeminiWebClient } = require('../script-gemini/gemini_chat.cjs');

async function main() {
  const cookies = process.env.GEMINI_COOKIES;
  if (!cookies?.trim()) {
    throw new Error('GEMINI_COOKIES belum diatur. Masukkan cookie hanya melalui environment lokal.');
  }

  const prompt = process.env.GEMINI_TEST_PROMPT?.trim()
    || 'Balas persis dengan GEMINI_CHAT_TEST_OK. Ini tes teks saja; jangan membuat gambar atau video.';
  const client = new GeminiWebClient(cookies);

  console.log('[Gemini Chat Test] Menginisialisasi sesi web...');
  const result = await client.sendMessage(prompt, true, false);
  const response = typeof result?.text === 'string' ? result.text.trim() : '';

  if (!response) {
    throw new Error('Request selesai tetapi Gemini tidak mengembalikan teks jawaban.');
  }

  console.log('[Gemini Chat Test] Respons diterima.');
  console.log(`Conversation ID: ${result.conversationId || '(tidak ditemukan)'}`);
  console.log(`Jawaban: ${response.slice(0, 1000)}`);
}

main().catch((error) => {
  console.error('[Gemini Chat Test] Gagal:', error.message || error);
  process.exitCode = 1;
});
