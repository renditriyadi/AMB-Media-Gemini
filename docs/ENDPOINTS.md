# Dokumentasi Endpoint API (Backend Server)

Dokumen ini mencatat seluruh endpoint REST API aktual yang disediakan oleh server Express (`server.ts` dan folder `server/routes/`).

---

## Ringkasan Modul Endpoint

| Prefix Rute / Endpoint | File Handler Utama | Deskripsi |
| :--- | :--- | :--- |
| `/api/auth/*` | `server/routes/auth.ts` | Autentikasi user (login, register, status user) ke Google Sheets |
| `/api/providers/*` | `server/routes/providerAccounts.ts` | Manajemen API keys & tokens multi-provider per user di Google Sheets |
| `/api/google-accounts/*` & `/api/sheets-config` | `server.ts` | Konfigurasi spreadsheet & manajemen akun Google |
| `/api/weavy/*` & `/api/weavy-upload` | `server.ts` | Manajemen akun Weavy, verifikasi, daftar model/node, dan upload aset |
| `/api/canvas/weavy/*` | `server.ts` | Integrasi recipe Weavy untuk Canvas (my-recipes, recipe-details, execute pipeline) |
| `/api/chat-message` & `/api/enhance-prompt` | `server.ts` | Chat AI multimodal Weavy Any LLM, session media cataloging, & prompt enhancer |
| `/api/studio/analyze-video` | `server/routes/studio.ts` | Analisis video naskah & storyboard breakdown AI (JSON schema) dengan TikWM & Gemini/Weavy LLM |
| `/api/scrape-metadata` & `/api/tiktok-import` | `server.ts` | Web Scraper (Tokopedia, Shopee, TikTok Shop) & TikWM importer ke provider |
| `/api/generate-weavy` & `/api/poll-weavy-status` | `server.ts` | Eksekusi virtual recipe canvas Weavy & multi-strategy status poller |
| `/api/fetch-weavy-history` | `server.ts` | Pengambilan riwayat pembuatan media dari akun Weavy |
| `/api/generate-runninghub` & `/api/poll-runninghub-status` | `server.ts` & `runninghub.ts` | Eksekusi tugas ComfyUI RunningHub (MiniMax H3, Motion Control), polling, & history |
| `/api/roboneo/*`, `/api/generate-roboneo`, `/api/poll-roboneo-status`, `/api/fetch-roboneo-history` | `server.ts` & `roboneo.ts` | Integrasi RoboNeo (verifikasi kuota, upload Alibaba Cloud OSS, Kling 2.6 nodeexecute, polling, & history) |
| `/api/galleri5/*` | `server.ts` & `galleri5.ts` | Integrasi Galleri5 (verifikasi akun, upload aset, generasi Kling 2.6, status polling, & history) |
| `/api/kie/*`, `/api/generate-kie`, `/api/poll-kie-status` | `server.ts` & `kie.ts` | Integrasi Kie.ai (verifikasi akun, upload, generasi SeeDance/Grok/GPT, status polling, & history) |
| `/api/upload-media` | `server/routes/upload.ts` | Pre-upload media disk-stream langsung ke storage Weavy AI (max 100MB) |
| `/api/chat-sessions` | `server/routes/chatSessions.ts` | Sinkronisasi riwayat sesi obrolan (server file `chat_sessions.json`) |
| `/api/proxy-video`, `/api/proxy-image`, `/api/proxy-file`, `/api/proxy-download` | `server/routes/proxy.ts` & `server.ts` | Proxy media, bypass CORS, anti-hotlink referer spoofing, HTTP Range video streaming, & universal file downloader |
| `/media-cache/*` | `server.ts` | Static streaming cache untuk video TikTok/Douyin yang diunduh lokal |

---

## 1. Modul Autentikasi (`server/routes/auth.ts`)

### `POST /api/auth/login`
- **Fungsi**: Memvalidasi kredensial username dan password terhadap baris pada sheet `Users` di Google Sheets.
- **Payload Request**:
  ```json
  {
    "username": "user123",
    "password": "plain_password"
  }
  ```
- **Response Sukses (200)**:
  ```json
  {
    "success": true,
    "user": {
      "userId": "USR-1741761234567",
      "username": "user123",
      "email": "user@example.com",
      "role": "user"
    }
  }
  ```
- **Response Error (401/500)**: `{ "success": false, "error": "Username atau password salah." }`

### `POST /api/auth/register`
- **Fungsi**: Mendaftarkan akun user baru dan menyimpannya ke sheet `Users` di Google Sheets.
- **Payload Request**:
  ```json
  {
    "username": "user123",
    "password": "plain_password",
    "email": "user@example.com"
  }
  ```
- **Response (200)**: `{ "success": true, "user": { "userId": "USR-...", "username": "user123", "email": "user@example.com", "role": "user" } }`

### `GET /api/auth/status`
- **Fungsi**: Pengecekan cepat status publik sheet pengguna (jumlah user terdaftar dan baris header kolom).
- **Response (200)**: `{ "success": true, "userCount": 5, "headers": ["userId", "username", "password", "email", "role", "createdAt"] }`

---

## 2. Modul Akun Multi-Provider (`server/routes/providerAccounts.ts`)

### `GET /api/providers/accounts`
- **Fungsi**: Mengambil seluruh akun AI provider milik user dari sheet `ProviderAccounts`.
- **Query Params**: `?userId=USR-...`
- **Response (200)**:
  ```json
  {
    "success": true,
    "userId": "USR-...",
    "accounts": {
      "weavy": [ ... ],
      "roboneo": [ ... ],
      "galleri5": [ ... ],
      "kie": [ ... ],
      "runninghub": [ ... ]
    }
  }
  ```

### `GET /api/providers/:provider/accounts`
- **Fungsi**: Mengambil akun milik user khusus untuk satu provider tertentu (`weavy`, `runninghub`, `roboneo`, `galleri5`, atau `kie`).
- **Query Params**: `?userId=USR-...`
- **Response (200)**: `{ "success": true, "provider": "weavy", "userId": "USR-...", "accounts": [ ... ] }`

### `POST /api/providers/:provider/accounts`
- **Fungsi**: Menyimpan atau memperbarui data akun dan token untuk provider tertentu ke Google Sheets secara real-time.
- **Payload Request**:
  ```json
  {
    "userId": "USR-...",
    "accounts": [
      {
        "id": "acc_1",
        "name": "Akun Weavy Utama",
        "email": "user@domain.com",
        "token": "AMf-...",
        "credits": 150,
        "isActive": true
      }
    ]
  }
  ```
- **Response (200)**: `{ "success": true, "provider": "weavy", "userId": "USR-...", "count": 1, "message": "Akun berhasil disimpan ke Google Sheets." }`

---

## 3. Modul Konfigurasi Spreadsheet & Akun Google (`server.ts`)

### `GET /api/sheets-config`
- **Fungsi**: Mengembalikan ID spreadsheet aktif dan email client service account.
- **Response (200)**: `{ "spreadsheetId": "1g2p...", "clientEmail": "service-account@...iam.gserviceaccount.com" }`

### `GET /api/google-accounts`
- **Fungsi**: Mengambil daftar akun Google yang tersimpan di sistem.
- **Response (200)**: `{ "success": true, "accounts": [ ... ] }`

### `POST /api/google-accounts`
- **Fungsi**: Menambahkan atau memperbarui akun Google baru.
- **Payload Request**: `{ "email": "...", "credentials": { ... } }`

### `DELETE /api/google-accounts/:email`
- **Fungsi**: Menghapus akun Google berdasarkan parameter email.

### `PUT /api/google-accounts/verify`
- **Fungsi**: Memverifikasi validitas token dan izin akun Google.

---

## 4. Modul Weavy Core & Chat Multimodal (`server.ts`)

### `GET /api/weavy/accounts`
- **Fungsi**: Mengambil daftar akun Weavy lokal/konfigurasi server.

### `POST /api/weavy/accounts/verify`
- **Fungsi**: Memvalidasi refresh token Weavy Firebase, menukarnya ke token JWT `id_token` baru, serta mengambil data profil dan sisa saldo kredit akun Weavy.
- **Payload Request**: `{ "token": "AMf-...", "refreshToken": "AMf-..." }`
- **Response (200)**: `{ "success": true, "email": "user@weavy.ai", "credits": 150, "token": "eyJhbGci..." }`

### `POST /api/weavy/accounts/select`
- **Fungsi**: Mengaktifkan akun Weavy tertentu di sisi server.
- **Payload Request**: `{ "id": "acc_123" }`

### `GET /api/weavy/models`
- **Fungsi**: Mengambil katalog model AI Weavy yang tersedia untuk generasi gambar, video, dan multimodal LLM.

### `GET /api/weavy/nodes`
- **Fungsi**: Mengambil daftar tipe node pemrosesan Weavy untuk penyusunan resep kanvas visual.

### `POST /api/weavy-upload`
- **Fungsi**: Mengunggah berkas biner atau data base64 langsung ke asset storage Weavy AI (`https://api.weavy.ai/api/v1/assets/upload`).
- **Payload Request**: Multipart file atau JSON `{ "fileData": "data:image/png;base64,...", "fileName": "img.png", "refreshToken": "..." }`
- **Response (200)**: `{ "success": true, "url": "https://storage.weavy.ai/...", "assetId": "..." }`

### `POST /api/chat-message`
- **Fungsi**: Endpoint percakapan AI multimodal terpadu yang mengorkestrasi eksekusi model Any LLM Weavy (Claude Sonnet 3.7 / 3.5, Gemini 2.5 Flash / 3 Pro, GPT-5 / GPT-4o), penanganan context window percakapan, lampiran media gambar/video, filter thinking tags, auto-scraping link TikTok/e-commerce, serta integrasi slash commands (`/fashion`, `/natural`, `/ugc`, `/clean`, `/jumpcut`).
- **Payload Request**:
  ```json
  {
    "messages": [
      { "role": "user", "content": "/fashion Buatkan variasi pose model streetwear" }
    ],
    "model": "anthropic/claude-sonnet-5",
    "mode": "chat" | "video" | "image",
    "systemPrompt": "System instructions...",
    "thinking": true,
    "temperature": 0.7,
    "refreshToken": "AMf-...",
    "allRefreshTokens": ["AMf-..."],
    "images": ["https://..."],
    "sessionImages": [{ "index": 1, "url": "https://...", "title": "Baju 1" }],
    "sessionVideos": [{ "index": 1, "url": "https://...", "title": "Video 1" }]
  }
  ```
- **Response (200)**:
  ```json
  {
    "success": true,
    "text": "Berikut adalah breakdown storyboard...",
    "model": "anthropic/claude-sonnet-5",
    "mode": "video",
    "durationMs": 2800,
    "tokens": 420,
    "remainingCredits": 140,
    "userEmail": "user@weavy.ai",
    "attachments": [ ... ]
  }
  ```

### `POST /api/enhance-prompt`
- **Fungsi**: Memperluas dan menyempurnakan prompt teks mentah menjadi prompt visual siap pakai dengan arahan pencahayaan, lensa kamera, komposisi, dan negative prompt yang disesuaikan dengan model target.
- **Payload Request**: `{ "prompt": "cyberpunk city", "model": "Nano Banana Pro", "targetType": "image" | "video", "refreshToken": "..." }`
- **Response (200)**: `{ "success": true, "enhancedPrompt": "Hyper-realistic cyberpunk metropolis...", "negativePrompt": "blurry, low quality..." }`

### `POST /api/generate-weavy`
- **Fungsi**: Membuat recipe canvas virtual di Weavy dan mengeksekusi batch pembuatan video atau gambar (SeeDance 2.0 Mini, SeeDance 2.5, Seedream V5.0 Edit, Nano Banana Pro, GPT Image 2.5, Kling Motion Control).
- **Payload Request**:
  ```json
  {
    "prompt": "Cyberpunk girl walking in neon alley",
    "model": "SeeDance 2.0 Mini",
    "aspect_ratio": "9:16",
    "resolution": "720p",
    "duration": 15,
    "generate_audio": true,
    "image_url": "https://...",
    "refreshToken": "AMf-..."
  }
  ```
- **Response (200)**:
  ```json
  {
    "success": true,
    "recipeId": "rec_123456",
    "nodeId": "node_model_1741761234567",
    "taskId": "task_123456",
    "batchId": "batch_123456",
    "activeModelName": "bytedance/seedance-2.0-mini"
  }
  ```

### `POST /api/poll-weavy-status`
- **Fungsi**: Multi-strategy polling untuk memantau status pembuatan media di Weavy. Memeriksa output target node, memeriksa node alternatif di canvas, dan memindai batch execution runs.
- **Payload Request**: `{ "recipeId": "rec_123", "nodeId": "node_123", "taskId": "task_123", "refreshToken": "..." }`
- **Response (200)**: `{ "status": "completed" | "processing" | "failed", "resultUrl": "https://...", "coverUrl": "https://..." }`

### `POST /api/fetch-weavy-history`
- **Fungsi**: Mengambil riwayat hasil generasi media yang pernah dibuat di akun Weavy pengguna.

---

## 5. Modul Studio Video-to-Storyboard (`server/routes/studio.ts`)

Modul backend khusus untuk menganalisis video (TikTok, Douyin, atau URL eksternal) dan menghasilkan breakdown storyboard terstruktur multi-scene berbasis schema JSON valid menggunakan orkestrasi Google Gemini dan Weavy Any LLM.

### `POST /api/studio/analyze-video`
- **File Handler**: `server/routes/studio.ts` (router di-mount di `/api` pada `server.ts`)
- **Fungsi**:
  1. Melakukan web scraping metadata video TikTok/Douyin secara otomatis via TikWM API (atau TikTok oEmbed fallback) untuk mengekstrak judul, author, durasi asli, audio/music name, cover thumbnail, dan video stream tanpa watermark.
  2. Menerapkan prompt sutradara kreatif komersial untuk menganalisis hook 3-detik, produk/topik inti, target audiens, core USPs, strategi visual proof, call-to-action (CTA), transkrip narasi lengkap, dan ringkasan alur promosi.
  3. Membagi durasi video asli menjadi sejumlah adegan (*scenes*) berurutan (misal 6 scene @ 5 detik untuk video 30 detik) lengkap dengan timecode presisi (`00:00 - 00:05`), tujuan adegan (*sceneGoal*), arahan visual bahasa Indonesia (*visualDescription*), naskah voiceover (*voiceover*), teks di layar (*onScreenText*), sudut kamera (*cameraAngle*), prompt AI Image photorealistic komersial bahasa Inggris (*imagePrompt*), dan prompt AI Video motion (*videoPrompt*).
  4. Menerapkan strategi pemanggilan berjenjang: memanggil Google GenAI SDK (`@google/genai`) langsung jika model Google dipilih dan `GEMINI_API_KEY` tersedia, dengan fallback otomatis ke endpoint Weavy Any LLM (`/api/enhance-prompt`) atau Gemini 2.5 Flash.
  5. Melakukan pembersihan string JSON (membersihkan markdown fences ````json```, trailing comma, dan invalid control characters) serta melengkapi UUID dan default status (`idle`) pada tiap scene.
- **Payload Request**:
  ```json
  {
    "videoUrl": "https://vt.tiktok.com/ZSqg9mNDY/",
    "title": "Semangka Raksasa Lonjong Panen Kebun",
    "productName": "Bibit Semangka Raksasa",
    "rawPrompt": "Analisis video ini dan buatkan pembagian scene presisi",
    "numScenes": 6,
    "aspectRatio": "9:16",
    "imageModel": "GPT Image 2.5",
    "aiModel": "google/gemini-2.5-flash",
    "refreshToken": "AMf-...",
    "idToken": "eyJhbGci...",
    "allRefreshTokens": ["AMf-..."]
  }
  ```
- **Response Sukses (200)**:
  ```json
  {
    "success": true,
    "data": {
      "metadata": {
        "title": "Semangka Raksasa Lonjong Panen Kebun",
        "author": "Viral Agri Creator (@agriviral)",
        "audio": "Original Sound",
        "duration": 30,
        "thumbnailUrl": "https://p16-sign-va.tiktokcdn.com/...",
        "tags": ["semangka", "panen", "viral", "fyp"],
        "playUrl": "https://cdn.tikwm.com/.../video.mp4",
        "rawUrl": "https://vt.tiktok.com/ZSqg9mNDY/"
      },
      "analysis": {
        "hookAnalysis": "Menampilkan semangka raksasa berbentuk lonjong menyerupai peluru kendali dengan sayatan pertama pisau yang memicu rasa penasaran visual tinggi dalam 3 detik pertama.",
        "productOrTopicName": "Semangka Raksasa Lonjong / Bibit Semangka Super",
        "targetAudience": "Pecinta buah segar, petani hortikultura, pehobi tanaman kebun, dan penonton konten viral kuliner alami",
        "coreUSPs": [
          "Ukuran masif ekstrem dengan bobot puluhan kilogram per butir",
          "Kulit renyah dengan pola lurik hijau tua kontras",
          "Daging buah merah delima merona padat tanpa rongga, manis legit dan berlimpah air",
          "Bibit unggul adaptif dengan potensi panen melimpah"
        ],
        "visualProofStrategy": "Menunjukkan pemotongan langsung di lahan pertanian, suara renyah saat dibelah, tampilan irisan merah juicy berkilau di bawah sinar matahari, dan perbandingan langsung ukuran buah terhadap tubuh manusia.",
        "callToActionAnalysis": "Mengarahkan penonton untuk segera memesan bibit unggul atau buah siap panen melalui tautan keranjang kuning sebelum kehabisan stok promo.",
        "transcript": "Ini semangka apa peluru kendali? Gedenya beneran gak masuk akal! Dengerin suara renyahnya pas dibelah...",
        "contentSummary": "Video edukasi dan hiburan agrikultur yang mendemonstrasikan proses panen dan pemotongan semangka raksasa lonjong dengan visual memikat.",
        "frameObservations": [
          {
            "frameIndex": 1,
            "timestamp": "00:00",
            "timeSec": 0,
            "subject": "An oblong watermelon in a field with a person holding a knife ready to cut it",
            "action": "Person is about to cut open a large, elongated watermelon",
            "camera": "Close-up, high angle shot",
            "lighting": "Direct sunlight outdoors",
            "style": "Photorealistic commercial",
            "composition": "Centered watermelon taking up the lower half of the frame",
            "onScreenText": "",
            "mood": "Curious & viral",
            "summary": "An oblong watermelon in a field Person is about to cut open a large watermelon"
          }
        ],
        "pipelineMetadata": {
          "downloader": "direct",
          "framesExtracted": 6,
          "framesAnalyzed": 5,
          "vlmModelUsed": "google/gemini-2.5-flash",
          "temporalAggregationCompleted": true,
          "promptEnhancementApplied": true,
          "verificationStatus": "skipped_placeholder"
        }
      },
      "scenes": [
        {
          "id": "scene_1741761234567_1_a8b9",
          "sceneNumber": 1,
          "title": "Scene 1: The Giant Hook",
          "timecode": "00:00 - 00:05 (Durasi: 5 detik)",
          "durationSec": 5,
          "startSec": 0,
          "endSec": 5,
          "sceneGoal": "Stop scrolling instantly with high contrast hook",
          "visualDescription": "Close-up di lahan pertanian tanah gembur. Tangan seorang petani memegang pisau kecil menyayat garis pertama pada kulit semangka raksasa...",
          "voiceover": "Ini semangka apa peluru kendali? Gedenya beneran gak masuk akal!",
          "onScreenText": "SEMANGKA APA PELURU KENDALI?! 🍉🚀",
          "cameraAngle": "Close-up dramatic eye-level",
          "imagePrompt": "Vertical 9:16, close-up shot, a colossal elongated watermelon lying on rich organic farm soil surrounded by lush green vines, a farmer's weathered hand gently scoring the glossy rind with a utility blade, direct crisp sunlight, photorealistic, 8k resolution, cinematic depth of field, tactile rind texture.",
          "videoPrompt": "Slow tilt down focusing on the giant watermelon, hand gently traces a line on the rind, lush vines swaying softly in the breeze, realistic cinematic camera motion, 4k.",
          "status": "idle"
        }
      ],
      "aiModel": "google/gemini-2.5-flash"
    }
  }
  ```
- **Response Error (500)**: `{ "success": false, "error": "Gagal menganalisis video dengan AI model." }`

*Catatan Alur Generasi Visual Scene*: Eksekusi render gambar untuk tiap scene adegan dilakukan oleh frontend client service (`src/lib/studioService.ts` -> `initiateStudioSceneGeneration`) yang memanggil `/api/generate-weavy` dengan prompt visual scene terkait (`imagePrompt`), dilengkapi fitur rotasi otomatis token akun Weavy (*auto-account switching*) jika kuota kredit akun aktif habis.

---

## 6. Modul Canvas & Recipe Weavy (`server.ts`)

### `POST /api/canvas/weavy/my-recipes`
- **Fungsi**: Mengambil seluruh resep kanvas yang tersimpan di akun Weavy pengguna (`/api/v1/recipes`).
- **Payload Request**: `{ "refreshToken": "AMf-...", "idToken": "..." }`
- **Response (200)**: `{ "success": true, "recipes": [ { "id": "rec_1", "name": "Flow 1", "updatedAt": "..." } ] }`

### `POST /api/canvas/weavy/recipe-details`
- **Fungsi**: Mengambil detail graph node & edge dari sebuah resep Weavy untuk diimpor ke editor kanvas lokal.
- **Payload Request**: `{ "recipeId": "rec_123", "refreshToken": "AMf-..." }`
- **Response (200)**: `{ "success": true, "recipe": { "id": "rec_123", "nodes": [...], "edges": [...] } }`

### `POST /api/canvas/weavy/execute-full-pipeline`
- **Fungsi**: Mengunggah seluruh canvas graph lokal ke Weavy sebagai recipe baru dan mengeksekusi seluruh pipeline batch secara otomatis.
- **Payload Request**: `{ "nodes": [...], "edges": [...], "name": "Canvas Pipeline", "refreshToken": "AMf-..." }`
- **Response (200)**: `{ "success": true, "recipeId": "rec_new", "batchId": "batch_new", "status": "processing" }`

### `POST /api/canvas/weavy/execute-single-model`
- **Fungsi**: Mengeksekusi satu model node tertentu pada canvas dengan menghubungkan dependensi node input (prompt & image) secara dinamis.
- **Payload Request**: `{ "nodeId": "node_123", "model": "Nano Banana Pro", "prompt": "...", "imageUrl": "...", "refreshToken": "AMf-..." }`
- **Response (200)**: `{ "success": true, "recipeId": "...", "nodeId": "...", "taskId": "..." }`

---

## 7. Modul RunningHub (`server.ts` & `server/providers/runninghub.ts`)

### `POST /api/generate-runninghub`
- **Fungsi**: Mengeksekusi workflow ComfyUI RunningHub (MiniMax H3 Image to Video 15 Detik, Kling Motion Control, LTX-Video 2.3) dengan upload media referensi ke COS RunningHub dan pembuatan tugas `/task/openapi/create`. Menangani antrean penuh (`TASK_QUEUE_MAXED`) dengan retry fallback.
- **Payload Request**:
  ```json
  {
    "apiKey": "rh_key_xxx",
    "workflowId": "2098388825144184833",
    "prompt": "Smooth motion walking",
    "imageUrl": "https://...",
    "aspectRatio": "9:16",
    "duration": 15
  }
  ```
- **Response (200)**: `{ "success": true, "taskId": "task_rh_123", "status": "processing" }`

### `POST /api/poll-runninghub-status`
- **Fungsi**: Mengecek status eksekusi task di RunningHub (`/task/openapi/status`), mengekstrak URL output video MP4 / gambar secara cerdas dari berbagai format node output ComfyUI.
- **Payload Request**: `{ "apiKey": "rh_key_xxx", "taskId": "task_rh_123" }`
- **Response (200)**: `{ "status": "completed" | "processing" | "failed", "resultUrl": "https://...", "coverUrl": "https://..." }`

### `POST /api/fetch-runninghub-history`
- **Fungsi**: Mengambil riwayat pembuatan media dari akun RunningHub.

### `GET /api/runninghub/workflow-templates`
- **Fungsi**: Mengembalikan daftar template workflow ComfyUI yang siap digunakan di aplikasi.

---

## 8. Modul RoboNeo (`server.ts` & `server/providers/roboneo.ts`)

### `POST /api/roboneo/accounts/verify`
- **Fungsi**: Memverifikasi access token RoboNeo ke Meitu Account API (`api.account.meitu.com`), mengembalikan UID, membership, dan sisa saldo koin Carrot.
- **Payload Request**: `{ "token": "...", "accessToken": "..." }`
- **Response (200)**: `{ "success": true, "uid": "1289198712", "credits": 70, "username": "NeoUser" }`

### `POST /api/roboneo/upload`
- **Fungsi**: Mengunggah media (gambar / video) ke Alibaba Cloud OSS RoboNeo:
  1. Meminta upload policy & signature dari Meitu AI Engine Gateway (`/roboneo/sync/request/uploadpolicy`).
  2. Mengambil STS Credentials dari RoboNeo Strategy API (`strategy.app.meitudata.com/upload/policy`).
  3. Mengunggah file biner ke bucket `mt-roboneo-private-release` (`oss-cn-beijing`) via `ali-oss` (multipart upload untuk file >5MB atau MP4).
- **Form/Body**: Multipart `file` atau JSON `{ "fileData": "base64...", "fileName": "motion.mp4", "accessToken": "..." }`
- **Response (200)**: `{ "success": true, "url": "https://roboneo-private.meitudata.com/...", "key": "..." }`

### `POST /api/generate-roboneo`
- **Fungsi**: Memicu pembuatan video Kling 2.6 Motion Control pada workspace room Meitu (`nodeexecute` tool `video_bonbon_motioncontrol_v26`) dengan retry otomatis saat server busy (kode 6003).
- **Payload Request**:
  ```json
  {
    "accessToken": "...",
    "imageUrl": "https://roboneo-private.meitudata.com/...image.jpg",
    "motionVideoUrl": "https://roboneo-private.meitudata.com/...motion.mp4",
    "prompt": "Refer to the movements and facial expressions..."
  }
  ```
- **Response (200)**: `{ "success": true, "status": "processing", "recipeId": "...", "taskId": "...", "nodeId": "..." }`

### `POST /api/poll-roboneo-status`
- **Fungsi**: Polling status tugas generasi RoboNeo via `nodeexecutequery` dengan fallback ekstraksi URL video dari canvas room data (`webapi.roboneo.com/v3/canvas/data/get.json`).
- **Payload Request**: `{ "accessToken": "...", "taskId": "...", "recipeId": "..." }`
- **Response (200)**: `{ "status": "completed" | "processing" | "failed", "resultUrl": "https://...", "coverUrl": "https://..." }`

### `POST /api/fetch-roboneo-history`
- **Fungsi**: Mengambil daftar riwayat video yang telah selesai digenerate di RoboNeo (`agent-api-roboneo.meitu.com/api/history/list`).

---

## 9. Modul Galleri5 (`server.ts` & `server/providers/galleri5.ts`)

### `POST /api/galleri5/accounts/verify`
- **Fungsi**: Memverifikasi API key / access token akun Galleri5 dan saldo kredit aktif.

### `POST /api/galleri5/upload`
- **Fungsi**: Mengunggah media referensi (gambar/video) ke penyimpanan cloud Galleri5.

### `POST /api/galleri5/generate`
- **Fungsi**: Memicu pembuatan video Kling 2.6 Motion Control / Image-to-Video di Galleri5.

### `POST /api/poll-galleri5-status`
- **Fungsi**: Memeriksa status proses pembuatan video di Galleri5 hingga menghasilkan URL MP4 akhir.

### `POST /api/galleri5/history`
- **Fungsi**: Mengambil daftar karya video yang pernah dibuat di akun Galleri5.

---

## 10. Modul Kie.ai (`server.ts` & `server/providers/kie.ts`)

### `POST /api/kie/accounts/verify`
- **Fungsi**: Memverifikasi API key Kie.ai dan mengambil kuota kredit yang tersedia.

### `POST /api/kie/upload`
- **Fungsi**: Mengunggah file media referensi ke server Kie.ai.

### `POST /api/generate-kie`
- **Fungsi**: Memicu pembuatan media visual di Kie.ai (SeeDance 2.0 Mini, Grok Imagine Image, Grok Imagine Video, GPT Image 2, Seedream 4.0 Edit).
- **Payload Request**: `{ "apiKey": "kie_xxx", "model": "...", "prompt": "...", "imageUrl": "..." }`
- **Response (200)**: `{ "success": true, "taskId": "kie_task_123", "status": "PENDING" }`

### `POST /api/poll-kie-status`
- **Fungsi**: Mengecek status eksekusi tugas di Kie.ai hingga berstatus `COMPLETED`.

### `POST /api/kie/history`
- **Fungsi**: Mengambil riwayat pembuatan media dari Kie.ai.

---

## 11. Modul Web Scraper, TikWM, & TikTok Importer (`server.ts`)

### `POST /api/scrape-metadata`
- **Fungsi**: Mengekstrak informasi produk e-commerce (Tokopedia, Shopee, TikTok Shop) atau mengunduh video TikTok / Douyin tanpa watermark menggunakan TikWM API (`https://www.tikwm.com/api/?url=...&hd=1`).
- **Alur Kerja**:
  - Untuk link video TikTok: Mengunduh binary video HD ke direktori cache lokal `/media-cache/` server, mengekstrak cover thumbnail, judul, dan profil kreator.
  - Untuk link e-commerce: Mengambil foto produk resolusi tinggi, nama barang, kisaran harga, dan rating ulasan.
- **Payload Request**: `{ "url": "https://vt.tiktok.com/..." }`
- **Response (200)**:
  ```json
  {
    "success": true,
    "type": "tiktok",
    "title": "Outfit Ideas Streetwear",
    "author": "CreatorName",
    "coverUrl": "https://...",
    "videoUrl": "/media-cache/tiktok_1741761234567.mp4",
    "originalUrl": "https://..."
  }
  ```

### `POST /api/tiktok-import`
- **Fungsi**: Mengunduh video TikTok tanpa watermark via TikWM API dan secara langsung mengunggahnya ke storage provider yang dituju (RoboNeo OSS, Galleri5, RunningHub, Kie.ai, atau Weavy) agar langsung siap dipakai sebagai referensi motion control / video input.
- **Payload Request**:
  ```json
  {
    "url": "https://vt.tiktok.com/...",
    "targetProvider": "roboneo" | "galleri5" | "runninghub" | "kie" | "weavy",
    "token": "...",
    "apiKey": "..."
  }
  ```
- **Response (200)**:
  ```json
  {
    "success": true,
    "provider": "roboneo",
    "uploadedUrl": "https://roboneo-private.meitudata.com/...",
    "localCacheUrl": "/media-cache/tiktok_1741761234567.mp4",
    "title": "...",
    "author": "..."
  }
  ```

---

## 12. Modul Sesi Chat AI (`server/routes/chatSessions.ts`)

Penyimpanan sesi chat menggunakan strategi tri-layer: `localStorage` (UI instan), `IndexedDB` (kuota browser besar), dan REST API backend yang menyimpan ke `server/data/chat_sessions.json` untuk persistensi server.

### `GET /api/chat-sessions`
- **Fungsi**: Mengambil seluruh daftar sesi percakapan chat yang tersimpan di disk server.
- **Response (200)**: `{ "success": true, "count": 2, "sessions": [ ... ] }`

### `POST /api/chat-sessions`
- **Fungsi**: Menyimpan atau memperbarui seluruh array sesi obrolan. Secara otomatis menyaring (sanitasi) string base64 yang berukuran lebih dari 50KB agar berkas JSON server tidak mengalami *bloat*.
- **Payload Request**: `{ "sessions": [ ... ] }`
- **Response (200)**: `{ "success": true, "count": 2 }`

### `DELETE /api/chat-sessions/:id`
- **Fungsi**: Menghapus satu sesi chat tertentu berdasarkan ID sesi dari berkas `chat_sessions.json`.
- **Response (200)**: `{ "success": true }`

---

## 13. Modul Pre-Upload Media Disk-Stream (`server/routes/upload.ts`)

### `POST /api/upload-media`
- **Fungsi**: Menerima upload berkas media (gambar / video) berukuran hingga 100MB melalui stream disk temporary (`/tmp`) Multer, lalu mengalirkannya langsung ke Weavy AI asset store (`https://api.weavy.ai/api/v1/assets/upload`) menggunakan token autentikasi. Menghindari pemborosan memori RAM Node.js.
- **Content-Type**: `multipart/form-data` (form field: `file`) atau `application/json` (base64 `fileData`)
- **Body**: `{ "refreshToken": "AMf-...", "allRefreshTokens": [...] }`
- **Response (200)**: `{ "success": true, "url": "https://storage.weavy.ai/...", "thumbnailUrl": "..." }`

---

## 14. Modul Proxy Media & Streaming (`server/routes/proxy.ts` & `server.ts`)

### `GET /api/proxy-video`
- **Fungsi**: Streaming reverse-proxy video dengan dukungan penuh HTTP Range (`206 Partial Content`), forwarder header `Referer: https://www.tikwm.com/` untuk menghindari blokade anti-hotlink CDN TikTok/TikWM, serta header cache 24 jam (`Cache-Control: public, max-age=86400, immutable`).
- **Query Params**: `?url=https://cdn.tikwm.com/.../video.mp4`
- **Headers Support**: `Range: bytes=0-`
- **Response**: Binary video stream `video/mp4` dengan header `Accept-Ranges: bytes`.

### `GET /api/proxy-image`
- **Fungsi**: Bypass CORS, proteksi anti-hotlink, dan mixed-content (HTTP/HTTPS) untuk gambar eksternal di canvas dan chat.
- **Query Params**: `?url=https://.../photo.jpg`
- **Response**: Binary image stream dengan header `Access-Control-Allow-Origin: *` dan cache 24 jam.

### `GET /api/proxy-file`
- **Fungsi**: Proxy umum untuk mengalirkan file media dari URL eksternal dengan header CORS terbuka.
- **Query Params**: `?url=...`

### `GET /api/proxy-download` (alias `/api/download`)
- **Fungsi**: Universal download proxy yang memaksa browser mengunduh file media sebagai attachment (`Content-Disposition: attachment; filename="..."`), menangani URL base64, URL nested proxy, file lokal `media-cache/`, serta remote media.
- **Query Params**: `?url=...&filename=custom_name.mp4`
- **Response**: Binary stream dengan header `Content-Disposition: attachment`.

### `GET /media-cache/:filename`
- **Fungsi**: Menyajikan file video TikTok/Douyin yang telah diunduh dan disimpan di direktori lokal `media-cache/` server untuk streaming instan tanpa latency.
