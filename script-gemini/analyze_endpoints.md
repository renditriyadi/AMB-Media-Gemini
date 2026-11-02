# Analisis Endpoint Google Gemini Web & Reverse Engineering

Dokumen ini menjelaskan struktur endpoint, sistem autentikasi, serta payload yang digunakan oleh Google Gemini (Web interface di `https://gemini.google.com`).

---

## 1. Analisis cURL yang Anda Kirimkan

Endpoint yang Anda berikan:
```bash
https://ogads-pa.clients6.google.com/$rpc/google.internal.onegoogle.asyncdata.v1.AsyncDataService/GetAsyncData
```

### Karakteristik Endpoint:
1. **Fungsi**: Endpoint ini adalah **OneGoogle Async Data Service** (`google.internal.onegoogle.asyncdata.v1`), yang dipakai oleh Google Web Bar / Waffle menu untuk memuat avatar, notifikasi, status langganan akun (Google One / Workspace), serta konfigurasi UI akun.
2. **Autentikasi SAPISIDHASH**:
   - Google menggunakan skema `SAPISIDHASH <timestamp>_<sha1>` untuk otorisasi endpoint Google internal:
   ```javascript
   const timestamp = Math.floor(Date.now() / 1000);
   const hash = crypto.createHash('sha1').update(`${timestamp} ${SAPISID} ${origin}`).digest('hex');
   // Header: authorization: SAPISIDHASH ${timestamp}_${hash}
   ```
3. **Cookie Kunci**:
   - `SID`, `__Secure-1PSID`, `__Secure-3PSID`: Token sesi Google utama.
   - `__Secure-1PSIDTS`, `__Secure-3PSIDTS`: Token timestamp rotasi sesi Google terbaru.
   - `SAPISID`, `__Secure-1PAPISID`, `__Secure-3PAPISID`: Digunakan untuk hashing `SAPISIDHASH`.

---

## 2. Endpoint Utama untuk Chat Gemini Web

Untuk berinteraksi langsung (kirim chat dan terima balasan AI dari Gemini Web), Google menggunakan endpoint internal **BardFrontendService / StreamGenerate**:

### URL Endpoint:
```http
POST https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl={BUILD_LABEL}&_reqid={REQ_ID}&rt=c
```

### Parameter URL:
- `bl`: Build label versi frontend web Gemini (didapat dari variabel `cfb2h` di HTML `gemini.google.com/app`, contoh: `boq_assistant-bard-web-server_20260928.08_p0`).
- `_reqid`: Integer acak bertambah untuk melacak urutan request (contoh: `145620`).
- `rt=c`: Format response streaming chunking (RPC format).

### Request Headers:
```http
Content-Type: application/x-www-form-urlencoded;charset=UTF-8
Origin: https://gemini.google.com
Referer: https://gemini.google.com/
X-Same-Domain: 1
Cookie: <Kumpulan Cookie Akun Google Anda>
```

### Request Body (Form Data):
1. **`at`**: CSRF Security Token (`SNlM0e`) yang diekstrak dari halaman awal `https://gemini.google.com/app` dalam objek `WIZ_global_data`.
2. **`f.req`**: JSON string bersarang (Nested JSON Array):
```json
[
  null,
  "[[[\"Pertanyaan user disini\", 0, null, null, null, null, 0], [\"en\"], null, null, null, null, [1], 0, [], [], 1, 0, null, null, null, null, null, null, 0]]"
]
```

Untuk chat baru, slot konteks percakapan bernilai `null`. Untuk percakapan lanjutan,
slot tersebut berisi `[conversation_id, response_id, choice_id, null, null, []]`.
Capture browser terbaru masih memakai endpoint `StreamGenerate` dan Build ID yang sama,
tetapi payload/metadata tambahannya dapat berubah antar versi web. Jangan menyalin token
sesi atau nilai metadata yang dibuat per sesi secara statis.

---

## 3. Format Response & Cara Parsing

Response dikembalikan dalam format Google RPC Batch Chunk stream:
```
)]}'
1520
[["wrb.fr",null,"[[\"c_821ce612b8c75cb0\",\"r_aedd85eff443d2d4\"],null,null,null,[[\"rc_a883417cb241628b\",[\"Teks balasan dari Gemini AI...\"]]]]\n"]]
```

### Ekstraksi Data:
1. `inner[1][0]` -> **Conversation ID** (`c_...`) untuk melanjutkan sesi chat berikutnya (multi-turn).
2. `inner[1][1]` -> **Response ID** (`r_...`).
3. `inner[4][0][0]` -> **Choice ID** (`rc_...`).
4. `inner[4][0][1][0]` -> **Teks Jawaban Lengkap dari Gemini**.

---

## 4. Cara Menjalankan Script Chat Gemini

Di dalam folder `/script-gemini/`:

1. **Jalankan Chat Multi-Turn**:
```bash
node --max-http-header-size=1048576 script-gemini/gemini_chat.cjs
```

2. **Gunakan sebagai Module di Node.js**:
```javascript
const { GeminiWebClient } = require('./script-gemini/gemini_chat.cjs');

async function run() {
  const gemini = new GeminiWebClient();
  await gemini.initSession();

  const response1 = await gemini.sendMessage("Halo, sebutkan 3 tips produktivitas!");
  console.log("Gemini:", response1.text);

  // Chat berlanjut dengan konteks yang sama (Conversation ID otomatis tersimpan)
  const response2 = await gemini.sendMessage("Jelaskan nomor 1 lebih detail.");
  console.log("Gemini:", response2.text);
}
run();
```
