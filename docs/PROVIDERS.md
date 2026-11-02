# Dokumentasi Provider, Helper, dan Komponen Pendukung

Dokumen ini mendata seluruh AI Provider, adapter penentu provider aktif, helper backend/frontend penting, serta komponen penunjang utama yang ada di dalam aplikasi **AMB Media V2**.

---

## 1. Daftar AI Provider Eksternal

Aplikasi mendukung 5 AI Provider utama yang dikelola melalui menu pengaturan (`GlobalSettingsView.tsx`), tersinkronisasi ke Google Sheets, dan dirutekan secara otomatis:

### 1. Weavy AI
- **Lokasi File Integrasi**:
  - Backend Server: `server.ts` (`/api/weavy/accounts`, `/api/weavy/accounts/verify`, `/api/weavy/accounts/select`, `/api/weavy/models`, `/api/weavy/nodes`, `/api/weavy-upload`, `/api/generate-weavy`, `/api/poll-weavy-status`, `/api/fetch-weavy-history`, `/api/chat-message`)
  - Backend Provider: `server/providers/weavy.ts`
  - Backend Helpers: `server/utils/helpers.ts` (`getFreshIdToken`, `extractMediaUrlFromObject`)
  - Frontend Lib: `src/lib/weavy.ts`, `src/lib/canvasRecipes.ts`
  - Testing & Analysis CLI: `script-weavy/analyze_recipe.cjs`
- **Mekanisme Otentikasi**:
  - Menggunakan **Refresh Token** Firebase Auth. Server menukar refresh token ke Google Firebase Secure Token API (`https://securetoken.googleapis.com/v1/token?key=...`) untuk menghasilkan `id_token` JWT berumur 1 jam.
- **Pemulihan Sesi**: Refresh di pengaturan dan preflight generasi dapat mencoba Auto-Import dari ekstensi, tetapi hanya menerapkan token jika email sesi aktif sama dengan akun tersimpan. Jika generasi mendapat kegagalan autentikasi eksplisit, aplikasi mencoba Auto-Import dan mengulang generasi satu kali; kegagalan jaringan atau respons 403 yang ambigu tidak memicu retry.
- **Model yang Didukung**:
  - **Image & Edit**: *Nano Banana Pro* (`fal-ai/nano-banana-pro/edit`), *Seedream V5.0 Pro Edit* (`fal-ai/bytedance/seedream/v5/lite/edit`), *Grok Imagine Image* (`xai/grok-imagine-image`), *GPT Image 2.5* (`flare-ai/flare-2.5`), *ChatGPT Images 2.0 Edit* (`gpt_image_1_edit`).
  - **Video**: *SeeDance 2.5*, *SeeDance 2.0 Mini*, *Kling 3.0 Pro Motion Control*.
  - **Multimodal LLM**: *Gemini 3 Pro*, *Gemini 3.1 Pro*, *Claude Opus 5*, *Claude Sonnet 5*, *GPT-5.6 Sol*, *Llama 4 Maverick*, dll.
- **Mekanisme Kerja**: Menggunakan pola Virtual Recipe Canvas: server membuat recipe canvas sementara di Weavy, menyematkan node prompt/gambar, menyimpan node graph, lalu memanggil eksekusi batch.

### 2. RunningHub
- **Lokasi File Integrasi**:
  - Backend Provider: `server/providers/runninghub.ts`
  - Backend Server Endpoint: `server.ts` (`/api/generate-runninghub`)
  - Workflow Graphs: `Minimax H3 Image to Video Tercepat 15 Detik.json`, `LTX2.3.json`, `MiniMax+H3+MAX+I2V+AMB+Media.json`, `workflow_2098349244620308482.json`
- **Mekanisme Otentikasi**: **API Key RunningHub** (`apiKey`).
- **Fitur Utama**:
  - Eksekusi ComfyUI visual node workflow di cloud RunningHub.
  - Video Generation: *MiniMax H3 Turbo Video* (Workflow `2098388825144184833`), *LTX-Video 2.3*, *Motion Control* (Workflow `2088843516532506626`), *S2 Motion Control* (Workflow `2091060763809492994`).
  - Batch Processing (`BatchView.tsx`): Antrean generasi video massal otomatis dengan pemantauan status koin dan polling live.

### 3. RoboNeo
- **Lokasi File Integrasi**:
  - Backend Server: `server.ts` (`/api/roboneo/accounts/verify`, `/api/roboneo/upload`, `/api/generate-roboneo`, `/api/poll-roboneo-status`, `/api/fetch-roboneo-history`)
  - Backend Provider: `server/providers/roboneo.ts`
- **Mekanisme Otentikasi**:
  - **RoboNeo Access Token** (`__mt_web_access_token__` / `access-token`) yang diparse menggunakan `parseRoboneoAccessToken` untuk mengisolasi UID dan parameter token Meitu.
- **Alur Kerja & Endpoint**:
  1. **Verifikasi Akun (`/api/roboneo/accounts/verify`)**: Mengambil kuota Carrot / membership dan profil pengguna dari Meitu Account API (`api.account.meitu.com/users/show_current`).
  2. **Upload Aset ke Alibaba Cloud OSS (`/api/roboneo/upload`)**:
     - Meminta upload policy dan signature dari Meitu AI Engine Gateway (`ai-engine-gateway-roboneo.meitu.com/roboneo/sync/request/uploadpolicy`).
     - Meminta STS Credentials dari RoboNeo Strategy API (`strategy.app.meitudata.com/upload/policy`).
     - Mengunggah berkas biner ke Alibaba Cloud OSS (`mt-roboneo-private-release` pada endpoint `oss-cn-beijing`) menggunakan SDK `ali-oss` dengan dukungan multipart upload untuk file besar/video dan fallback presigned URL.
  3. **Eksekusi Generasi Kling 2.6 (`/api/generate-roboneo`)**:
     - Membuat / memverifikasi room canvas (`agent-api-roboneo.meitu.com/api/room/create`).
     - Mengirim payload `nodeexecute` dengan tool `video_bonbon_motioncontrol_v26` ke Meitu AI Engine Gateway dengan penanganan retry otomatis saat sistem sibuk (error code 6003).
  4. **Polling Status (`/api/poll-roboneo-status`)**:
     - Melakukan query via `nodeexecutequery` dan fallback penarikan data canvas room (`webapi.roboneo.com/v3/canvas/data/get.json`).
  5. **Riwayat Generasi (`/api/fetch-roboneo-history`)**:
     - Menarik daftar karya selesai dari `agent-api-roboneo.meitu.com/api/history/list`.

### 4. Galleri5
- **Lokasi File Integrasi**:
  - Backend Server: `server.ts` (`/api/galleri5/accounts/verify`, `/api/galleri5/upload`, `/api/galleri5/generate`, `/api/poll-galleri5-status`, `/api/galleri5/history`)
  - Backend Provider: `server/providers/galleri5.ts`
- **Mekanisme Otentikasi**: **API Key / Access Token Galleri5**.
- **Fitur & Model**:
  - Verifikasi kuota dan status langganan akun.
  - Upload file referensi langsung ke storage Galleri5.
  - Generasi video Kling 2.6 Motion Control dan Kling Image-to-Video.
  - Polling status generasi dan penarikan riwayat hasil karya video.

### 5. Kie.ai
- **Lokasi File Integrasi**:
  - Backend Server: `server.ts` (`/api/kie/accounts/verify`, `/api/kie/upload`, `/api/generate-kie`, `/api/poll-kie-status`, `/api/kie/history`)
  - Backend Provider: `server/providers/kie.ts`
- **Mekanisme Otentikasi**: **API Key Kie.ai**.
- **Model yang Didukung**:
  - *SeeDance 2.0 Mini*, *Grok Imagine Image*, *Grok Imagine Video*, *GPT Image 2*, *Seedream 4.0 Edit*.
- **Alur Kerja**:
  - Verifikasi saldo kredit akun.
  - Upload media referensi via `/api/kie/upload`.
  - Trigger generasi video/gambar via `/api/generate-kie`.
  - Polling status berkala hingga selesai via `/api/poll-kie-status` dan penarikan riwayat via `/api/kie/history`.

### 6. Google Gemini (Murni Sesi Web / cURL Bash)
- **Lokasi File Integrasi**:
  - Backend Router: `server/providers/gemini.ts` (`/api/gemini/accounts/verify`, `/api/gemini/generate-video`, `/api/gemini/generate-image`, `/api/gemini/video-status`)
  - Core RPC Engine: `script-gemini/gemini_chat.cjs` (`GeminiWebClient`)
- **Mekanisme Otentikasi**:
  - **MURNI cURL BASH / COOKIES DARI INPUT USER (BUKAN GOOGLE API KEY)**.
  - Pengguna memasukkan cURL request dari `gemini.google.com` (Chrome Network Tab). Sistem mengekstrak cookie (`__Secure-1PSID`, `__Secure-1PSIDTS`, `SID`, `SAPISID`, `COMPASS`, `NID`) dan token XSRF `at` (`SNlM0e`).
  - Login Playwright menyimpan email dan kata sandi terenkripsi AES-256-GCM di server pada `.playwright-profiles/.credentials/`, dengan kunci lokal `.playwright-profiles/.credentials-key`; data kredensial tidak disimpan di `localStorage` atau Google Sheets. Tombol **Relogin Gemini** pada tiap akun memakai kredensial tersebut melalui `/api/gemini/playwright/relogin` dan tetap mendukung verifikasi 2FA. Akun lama yang belum memiliki kredensial akan meminta kata sandi satu kali.
- **Fitur & Model**:
  - **Text-to-Video & Image-to-Video**: Google Veo (Omni Flash / Veo 2 / Veo 3) dengan polling task `batchexecute?rpcids=ESY5D`.
  - **Image Generation**: Imagen 3 via endpoint `StreamGenerate`.
  - **Upload Gambar Referensi**: Protokol Scotty Upload Google (`upload.html`).
  - **Batas Kuota**: 3 generasi video per hari per akun Google Web yang dipantau secara otomatis di `data/gemini_daily_usage.json`.

---

## 2. Helper Resolusi & State Provider (`src/lib/provider.ts`)

- **`PROVIDER_METADATA`**:
  - Kamus konfigurasi yang memetakan metadata setiap provider: nama tampilan, URL logo/favicon, kuota default (Weavy: 150 Credits, RunningHub: 1000 Coins, Kie: 80 Credits, RoboNeo: 70 Credits, Galleri5: 200 Credits), dan satuan kredit (`Credits` vs `Coins`).
- **`resolveActiveProviderId(settings, activeTab, externalProviderId)`**:
  - Fungsi murni untuk menentukan ID provider mana yang harus aktif secara dinamis berdasarkan tab (jika tab adalah `batch`, otomatis diarahkan ke `runninghub`) atau berdasarkan model terpilih di dropdown (`videoModel` / `imageModel`).
- **`resolveActiveProvider(settings, activeTab, externalProviderId)`**:
  - Mengembalikan objek `ProviderMeta` lengkap berdasarkan hasil dari `resolveActiveProviderId`.

---

## 3. Komponen Khusus & Helper UI Penting

### 1. `ImageGenerationSpinner`
- **Lokasi**: `src/components/chat/ImageGenerationSpinner.tsx`
- **Fungsi**:
  - Indikator pemuatan (loading spinner) visual berbentuk lingkaran SVG beranimasi halus saat asisten chat sedang mengeksekusi generasi gambar.
  - Memiliki kurva interpolasi persentase progres non-linear dari 8% hingga 98% selama estimasi durasi generasi (24 detik), dilengkapi efek glowing amber, cincin rotasi ganda, dan rasio aspek yang fleksibel (`9:16`, `16:9`, `1:1`, `4:3`, `3:4`).

### 2. `VideoGenerationSpinner`
- **Lokasi**: `src/components/chat/VideoGenerationSpinner.tsx`
- **Fungsi**:
  - Indikator pemuatan (loading spinner) visual khusus saat asisten atau sistem sedang menghasilkan video AI (RunningHub, RoboNeo, Kling, Weavy).
  - Dilengkapi animasi lingkaran filmstrip berputar dinamis, kurva simulasi persentase progres non-linear (berjalan dari ~10% ke ~98%), status pesan dinamis kontekstual bertahap ("Rendering frames...", "Synthesizing motion...", "Finalizing video stream..."), badge model aktif, dan rasio aspek yang adaptif.

### 3. `EmbeddedVideoPlayer`
- **Lokasi**: `src/components/chat/EmbeddedVideoPlayer.tsx`
- **Fungsi**:
  - Pemutar video native kustom bertenaga HTML5 `<video>` yang dirancang khusus untuk memutar video hasil generasi dan streaming media eksternal (TikTok, TikWM, Weavy, RunningHub, RoboNeo).
  - Mendukung penuh streaming HTTP Range (`206 Partial Content`) melalui proxy backend (`/api/proxy-video`), tombol play/pause di tengah dan bar navigasi, scrubber waktu yang halus, kontrol suara/mute, penampil durasi waktu (current / duration), tombol fullscreen native, tombol download berkas langsung, serta thumbnail poster dinamis dengan penanganan fallback error.

### 4. `GeneratedVideoCard`
- **Lokasi**: `src/components/chat/GeneratedVideoCard.tsx`
- **Fungsi**:
  - Kartu kontainer interaktif untuk menyajikan video hasil generasi AI di dalam bubble percakapan chat.
  - Mengintegrasikan pemutar `EmbeddedVideoPlayer`, badge nama model dan resolusi/durasi, tombol salin prompt satu-klik, tombol unduh file MP4 via download proxy, tombol layar penuh (expand preview), tombol "Jadikan Referensi" untuk langsung menyematkan video tersebut sebagai input motion control pada prompt berikutnya, serta dukungan drag-and-drop URL video.

### 5. `ChatAttachmentCarousel`
- **Lokasi**: `src/components/chat/ChatAttachmentCarousel.tsx`
- **Fungsi**:
  - Carousel horizontal interaktif yang menampilkan thumbnail kumpulan media lampiran (gambar/video) sebelum dikirimkan ke input obrolan chat.
  - Dilengkapi tombol hapus berkas (`X`), badge nomor urut `@imgX` / `@vidX`, tombol geser scroll kiri/kanan, serta tombol pintasan anotasi pensil (`Pencil`) yang langsung membuka `CanvasMarkupModal` untuk memberikan coretan atau tanda panah pada gambar referensi sebelum diunggah.

### 6. `CanvasMarkupModal`
- **Lokasi**: `src/components/canvas/CanvasMarkupModal.tsx`
- **Fungsi**:
  - Studio modal anotasi dan markup visual gambar langsung di browser berbasis `<canvas>` HTML5 dan `useRef`.
  - Menyediakan palet alat lengkap:
    1. **Panah (Arrow)**: Menggambar panah petunjuk arah gerak atau titik fokus visual.
    2. **Persegi (Rectangle)**: Menandai area bounding box pakaian atau objek produk.
    3. **Lingkaran (Circle)**: Melingkari detail wajah atau aksesoris.
    4. **Pena Bebas (Pen)**: Coretan garis bebas.
    5. **Stabilo (Highlighter)**: Garis transparan untuk menyorot bagian tertentu.
    6. **Penghapus (Eraser)**: Menghapus goresan tertentu.
  - Dilengkapi pemilih warna (Merah, Hijau, Biru, Kuning, Putih, Hitam), slider ketebalan garis (stroke width), fitur Undo/Redo tumpukan riwayat gambar, tombol Reset, dan tombol Simpan (Save) yang menghasilkan data URL gambar teranotasi.

### 7. `RepostMediaCard`
- **Lokasi**: `src/components/chat/RepostMediaCard.tsx`
- **Fungsi**:
  - Kartu penampil media (gambar) yang digenerate di dalam percakapan chat.
  - Menyediakan 3 aksi cepat mengambang:
    1. **Gunakan (`Undo2`)**: Mengambil URL gambar tersebut dan langsung memasukkannya kembali ke input prompt sebagai media referensi.
    2. **Perbesar (`Maximize2`)**: Membuka modal preview gambar resolusi penuh.
    3. **Unduh (`Download`)**: Mengunduh file media langsung ke komputer pengguna.

### 8. `WeavyActionCard`
- **Lokasi**: `src/components/chat/WeavyActionCard.tsx`
- **Fungsi**:
  - Komponen kartu interaktif yang dihasilkan saat model asisten AI menyarankan instruksi generasi gambar (`weavy_generate`).
  - Menampilkan badge model terpilih, aspek rasio, tombol eksekusi ("Generate Sekarang"), spinner saat loading (`ImageGenerationSpinner`), serta kartu hasil jadi lengkap dengan tombol unduh dan tombol preview jika berhasil digenerate.

### 9. `CleanMessageRenderer`
- **Lokasi**: `src/components/chat/CleanMessageRenderer.tsx`
- **Fungsi**:
  - Parser teks pesan chat yang memisahkan konten percakapan manusia/asisten dari blok instruksi internal terstruktur (````weavy_generate``` dan ````weavy_repost```).
  - Menyediakan fungsi `cleanPlainText` untuk membersihkan tag markdown saat teks dicopy, serta parser inline styling untuk bold, italic, inline code, dan hyperlink.

### 10. `ThemeSlideOverlay`
- **Lokasi**: `src/components/ThemeSlideOverlay.tsx`
- **Fungsi**:
  - Efek transisi animasi layar meluncur (slide transition) saat pengguna berganti antara tema terang (Light Mode) dan tema gelap (Dark Mode).

### 11. `DragDropUploader`
- **Lokasi**: `src/components/DragDropUploader.tsx`
- **Fungsi**:
  - Area drag-and-drop file upload yang mendukung file gambar dan video dengan preview instan dan validasi tipe berkas.

---

## 4. Helper Pengelola Data & Storage

### 1. `canvasFileManager.ts`
- **Lokasi**: `src/lib/canvasFileManager.ts`
- **Fungsi**:
  - Modul CRUD untuk resep canvas visual (`CanvasFile`).
  - Mengelola pembuatan file baru (`createNewCanvasFile`), penyimpanan (`saveAllCanvasFiles`), duplikasi file (`duplicateCanvasFile`), penghapusan ke tong sampah / permanen (`deleteCanvasFile`), pemulihan (`restoreCanvasFile`), serta sinkronisasi otomatis antara memory, `localStorage`, dan `IndexedDB`.

### 2. `canvasRecipes.ts`
- **Lokasi**: `src/lib/canvasRecipes.ts`
- **Fungsi**:
  - Menyediakan kumpulan generator template/preset canvas:
    - `createNanoBananaPreset()` (Text-to-Image Google Gemini)
    - `createSeedreamEditPreset()` (Image-to-Image ByteDance Seedream)
    - `createGrokImaginePreset()` (xAI Grok Imagine)
    - `createGptImage25Preset()` (Weavy Flare GPT Image 2.5)
    - `createAnyLLMPreset()` (Multimodal reasoning / Any LLM)
    - `createPromptEnhancerPreset()` (Prompt expansion)
  - `parseWeavyRecipeToCanvas(rawRecipe)`: Mengonversi skema raw JSON dari Weavy AI menjadi objek `CanvasRecipe` yang kompatibel dengan antarmuka Canvas visual lokal.

### 3. `canvasIndexedDb.ts`, `chatIndexedDb.ts` & `studioIndexedDb.ts`
- **Lokasi**: `src/lib/canvasIndexedDb.ts`, `src/lib/chatIndexedDb.ts`, `src/lib/studioIndexedDb.ts`
- **Fungsi**:
  - Adapter IndexedDB browser (`amb_media_canvas_db`, `amb_media_chat_db`, dan `amb_media_studio_db`).
  - Mengatasi keterbatasan kuota 5MB `localStorage` dengan menyimpan dokumen resep canvas, riwayat percakapan chat, serta proyek storyboard studio (lengkap dengan metadata adegan, gambar hasil render, transkrip, dan analisis) secara persisten di penyimpanan IndexedDB browser.

### 4. `studioService.ts`
- **Lokasi**: `src/lib/studioService.ts`
- **Fungsi**:
  - Service pengorkestrasi client untuk Studio Video-to-Storyboard.
  - `analyzeVideoForStoryboard`: Memanggil API backend `/api/studio/analyze-video` untuk mengekstrak naskah dan scene breakdown.
  - `generateSceneImageWithFailover`: Memanggil pembuatan gambar Weavy AI (`/api/generate-weavy`) dengan mekanisme rotasi akun otomatis (*seamless account switching*) jika saldo kredit akun aktif tidak mencukupi atau habis saat merender adegan.
  - `generateAllSceneImages`: Mengorkestrasikan render paralel/berurutan untuk seluruh adegan dalam satu proyek storyboard.
  - `exportStudioProjectAsZip`: Mengompresi seluruh gambar scene HD, lembar komposit grid, dan file `storyboard.json` menjadi satu file ZIP siap unduh menggunakan `JSZip`.

### 5. `sheets.ts`
- **Lokasi**: `server/utils/sheets.ts`
- **Fungsi**:
  - Klien Google Sheets API berbasis service account Google (`google-service-account.json`).
  - Mengelola sheet `Users` (registrasi, verifikasi login, status) dan sheet `ProviderAccounts` (menyimpan dan membaca akun multi-provider pengguna secara tersinkronisasi).

### 6. `helpers.ts`
- **Lokasi**: `server/utils/helpers.ts`
- **Fungsi**:
  - `getFreshIdToken(refreshToken)`: Menukar Firebase Auth refresh token menjadi access token aktif.
  - `extractMediaUrlFromObject(obj)`: Fungsi traversal rekursif untuk mencari URL media gambar/video yang tertanam jauh di dalam response bertingkat Weavy batch execution.
  - `cleanErrorMessage(err)`: Pembersih pesan error dari response Axios / API eksternal.

### 7. `imageCompressor.ts`
- **Lokasi**: `src/utils/imageCompressor.ts`
- **Fungsi**:
  - Utilitas kompresi gambar berbasis elemen `<canvas>` HTML5 di browser. Mengurangi resolusi dan ukuran file sebelum dikirimkan ke server guna mempercepat proses upload dan mencegah request timeout.
