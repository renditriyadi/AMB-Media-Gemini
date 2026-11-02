# Arsitektur AMB Media V2

Dokumen ini menjelaskan arsitektur sistem aplikasi **AMB Media V2** secara menyeluruh, mencakup alur kerja ujung ke ujung (end-to-end workflow), deskripsi fungsi setiap direktori, pola perancangan (design patterns), manajemen state & persistensi data, serta integrasi orkestrasi multi-provider AI.

---

## 1. Alur Kerja Aplikasi Secara Menyeluruh (Overall Workflow)

Aplikasi **AMB Media V2** adalah platform studio multimedia generatif AI multimodal tingkat lanjut yang mengorkestrasi pembuatan video, gambar, teks prompt, dan visual node canvas melalui 5 AI Provider eksternal (Weavy AI, RunningHub, RoboNeo, Galleri5, dan Kie.ai).

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT (React SPA)                                |
|  - Tabs: Generate | Batch | Studio | Canvas | Chat | History | Settings | Profile  |
|  - Storage: localStorage (fast state) + IndexedDB (canvas, chat, studio projects) |
|  - Media Tools: HTML5 Canvas In-Browser Markup, Custom Native Video Player       |
+-----------------------------------------------------------------------------------+
                                         |
                                         | REST API calls (JSON & Multipart up to 100MB)
                                         v
+-----------------------------------------------------------------------------------+
|                              BACKEND (Express.js)                                 |
|  - Port: 3000 (bind 0.0.0.0, dev via tsx / prod via dist/server.cjs)             |
|  - Entry Point: server.ts                                                         |
|  - Middleware: CORS, express.json(100mb), express.urlencoded(100mb)               |
|  - Routes: /api/auth, /api/providers, /api/chat-sessions, /api/proxy, /api/upload,|
|            /api/studio                                                            |
+-----------------------------------------------------------------------------------+
       |                    |                    |                   |
       v                    v                    v                   v
+--------------+    +--------------+    +----------------+   +-------------------+
| Auth & Data  |    | Media Engine |    | Provider APIs  |   | Recipe, Studio &  |
| Google Sheets|    | TikWM / Douyin|   | - Weavy AI     |   | Orchestration     |
| Service Acct |    | Proxy & Stream|   | - RunningHub   |   | (Dynamic Recipe   |
| (Users &     |    | /media-cache/ |   | - RoboNeo      |   | Canvas & Story-   |
|  Accounts)   |    | Web Scraper  |    | - Galleri5     |   | board Generator)  |
+--------------+    +--------------+    | - Kie.ai       |   +-------------------+
                                        +----------------+
```

### Siklus Kerja Utama:

1. **Autentikasi & Penyimpanan Akun Terpusat (Google Sheets Database):**
   - Pengguna masuk menggunakan username/email & password melalui modal atau layar login (`/api/auth/login`).
   - Server memverifikasi data terhadap lembar kerja `Users` pada Google Spreadsheet yang dihubungkan menggunakan kredensial Google Service Account (`google-service-account.json`).
   - Kredensial, API keys, dan token akses 5 provider AI (Weavy, RunningHub, RoboNeo, Galleri5, Kie.ai) disimpan dan disinkronkan secara real-time ke sheet `ProviderAccounts` melalui `/api/providers/accounts`.

2. **Mode Generasi Tunggal (Single Media Generation - Tab `generate`):**
   - Pengguna menentukan prompt teks, memilih jenis media (Video atau Gambar), memilih model target (*MiniMax H3 Turbo*, *SeeDance 2.5*, *Seedream V5.0 Edit*, *Kling 3.0 Pro Motion Control*, *Grok Imagine*, dll.), aspek rasio, durasi, dan melampirkan media referensi opsional.
   - Sistem klien secara dinamis menentukan provider yang sesuai melalui resolver `resolveActiveProviderId` di `src/lib/provider.ts`.
   - Backend memproses generasi sesuai arsitektur spesifik masing-masing provider:
     - **Weavy AI**: Backend merangkai *Virtual Recipe Canvas* (node prompt `promptV3` + node model `custommodelV2` + node media `import`), menyimpan resep via `/api/v1/recipes/:id/save`, dan mengeksekusi batch job `/api/v1/batches/recipes/:id/execute`. Polling status berkala memantau perkembangan node hingga file media siap.
     - **RunningHub**: Mengunggah media ke Cloud Object Storage (COS) RunningHub, memetakan node input workflow ComfyUI (MiniMax H3 15s HD, LTX-Video 2.3, Motion Control), membuat tugas via `/task/openapi/create`, dan melakukan polling `/task/openapi/status`.
     - **RoboNeo**: Meminta upload policy dan STS credentials dari Meitu AI Engine Gateway, mengunggah video motion/gambar ke Alibaba Cloud OSS (`oss-cn-beijing`) via `ali-oss`, mengeksekusi node Kling 2.6 (`nodeexecute`), dan melakukan polling status (`nodeexecutequery`).
     - **Galleri5**: Mengunggah aset ke cloud storage Galleri5, memicu generasi video Kling 2.6, dan memantau status secara asinkron.
     - **Kie.ai**: Mengunggah media via `/api/kie/upload`, memicu tugas SeeDance/Grok/GPT, dan melakukan polling taskId hingga `COMPLETED`.

3. **Mode Antrean Batch (RunningHub Studio - Tab `batch`):**
   - Pengguna dapat memasukkan multi-prompt atau multi-media referensi ke dalam antrean batch pekerjaan.
   - Provider otomatis dikunci ke RunningHub, memproses tugas-tugas ComfyUI secara berurutan atau paralel dengan estimasi biaya koin dan log status detail.

4. **Mode Visual Node Canvas (Tab `canvas`):**
   - Ruang kerja diagram alir visual interaktif tak terbatas (*infinite node-based canvas*) dengan viewport pan & zoom.
   - Pengguna dapat merangkai berbagai jenis node: Prompt Node, Image Model Node, Prompt Enhancer Node, Any LLM Node, Image Viewer Node, dan Note Node yang dihubungkan dengan kabel SVG bezier dinamis (`CanvasWires`).
   - Menyediakan fitur *In-Browser Image Markup* (`CanvasMarkupModal`) untuk menggambar panah, kotak bounding, coretan pena, dan stabilo sebelum gambar dialirkan ke node model.
   - Mendukung import resep langsung dari akun Weavy via `/api/canvas/weavy/my-recipes` atau export/import file JSON lokal.
   - Eksekusi canvas memanggil `/api/canvas/weavy/execute-full-pipeline` atau `/api/canvas/weavy/execute-single-model`.

5. **Mode Obrolan Multimodal AI & Prompt Engineer (Tab `chat`):**
   - Asisten obrolan cerdas bertenaga Weavy Any LLM (Claude Sonnet 3.7 / 3.5, Gemini 2.5 Flash / 3 Pro, GPT-5 / GPT-4o).
   - Memiliki 3 mode terpadu:
     - **Mode Chat**: Tanya-jawab umum, analisis gaya visual, dan bedah prompt.
     - **Mode Video**: Generasi video langsung di dalam obrolan menggunakan RunningHub/RoboNeo/Weavy, ditampilkan dengan `GeneratedVideoCard`, diputar dengan `EmbeddedVideoPlayer`, dan dipantau menggunakan `VideoGenerationSpinner`.
     - **Mode Image**: Generasi gambar langsung di dalam obrolan menggunakan Weavy Image Models, kartu eksekusi `WeavyActionCard`, dan spinner `ImageGenerationSpinner`.
   - **Slash Commands (`/`)**: Shortcut cerdas (`/fashion`, `/natural`, `/ugc`, `/clean`, `/jumpcut`) untuk menyuntikkan arahan sutradara video komersial 15 detik atau narasi organik candid.
   - **Indeksasi Media (`@imgX`, `@vidX`)**: Mengatalogkan seluruh media sesi saat ini secara otomatis sehingga pengguna dapat me-mention aset spesifik sebagai referensi generasi berikutnya.
   - **Studio Anotasi Markup Cepat**: Carousel lampiran (`ChatAttachmentCarousel`) memiliki tombol pensil langsung untuk mencoret/memberi tanda panah pada gambar sebelum dikirim.
   - **Deteksi Link TikTok / Douyin / E-Commerce**: Otomatis mengekstrak stream video tanpa watermark via TikWM API, menyimpannya di `/media-cache/`, dan menyajikan pemutar video native dengan HTTP Range streaming.
   - **Pengiriman Ulang Media (0 Kredit)**: Fitur `weavy_repost` menampilkan kembali gambar lama sesi tanpa memotong kuota kredit via `RepostMediaCard`.

6. **Mode Studio Video-to-Storyboard & Video-to-Prompt Pipeline (Tab `studio`):**
   - Mengimplementasikan pipeline berantai **Video-to-Prompt** terstruktur:
     ```
     TikTok/Douyin Link / Local Video
        ↓
     1. Downloader (TikWM API / Direct Local Stream)
        ↓
     2. Frame Extractor (FFmpeg child process: ekstraksi 6–8 frame terdistribusi seragam @ 720p)
        ↓
     3. VLM Visual Inspector Per-Frame / Segment (Google GenAI Gemini Multi-Model Fallback / Weavy Any LLM)
        ↓
     4. JSON Schema Validator (Subjek, Aksi, Kamera, Lighting, Style, Komposisi, OnScreenText, Mood)
        ↓
     5. Temporal Aggregator & Prompt Enhancer (Sintesis timeline linier, marketing funnel, & scene timecodes)
        ↓
     6. Verification Loop (Modul validasi embedding similarity & auto-revisi prompt)
     ```
   - Alur kerja khusus untuk mengubah video referensi (TikTok/Douyin) menjadi breakdown naskah storyboard komersial multi-scene terstruktur berbasis schema JSON valid (`server/routes/studio.ts`).
   - Ekstraksi otomatis metadata video, audio, dan durasi via TikWM/oEmbed scraper.
   - Analisis mendalam menggunakan Google GenAI SDK (`@google/genai`) atau Weavy Any LLM: hook 3-detik, USP produk, target audiens, strategi visual proof, call-to-action, transkrip narasi, dan partisi timecode adegan berurutan.
   - Pembuatan visual adegan per scene atau serentak menggunakan model gambar Weavy (`GPT Image 2.5`, `Seedream V5.0 Edit`, `Nano Banana Pro`, `Grok Imagine Image`) dengan mekanisme rotasi akun otomatis (*multi-account credit failover*) di `src/lib/studioService.ts`.
   - Penyusunan lembar komposit grid (*one-sheet composite storyboard*) berbasis canvas resolusi tinggi (`StudioCompositeModal`) dan ekspor arsip ZIP utuh (`exportStudioProjectAsZip`).
   - Persistensi proyek persisten pada database lokal browser `IndexedDB` (`amb_media_studio_db`).

---

## 2. Struktur Direktori & Fungsi Modul

### A. Backend (`server/` dan `server.ts`)
- **`server.ts`**: Entry point Express.js, konfigurasi middleware CORS/body-parser (100MB), integrasi endpoint multi-provider, orkestrasi Virtual Recipe Canvas Weavy, Web Scraper TikWM/OpenGraph, TikTok import pipeline, dan static/Vite middleware handler.
- **`server/routes/`**:
  - `auth.ts`: Endpoint registrasi, verifikasi login, dan status user terhadap sheet `Users`.
  - `providerAccounts.ts`: Endpoint CRUD akun dan token multi-provider ke sheet `ProviderAccounts`.
  - `chatSessions.ts`: Endpoint sinkronisasi riwayat sesi percakapan chat ke file `server/data/chat_sessions.json` dengan pemangkasan base64 (>50KB) untuk mencegah bloat.
  - `proxy.ts`: Reverse proxy media (`/api/proxy-image`, `/api/proxy-video`, `/api/proxy-download`, `/api/download`) dengan dukungan HTTP Range (`206 Partial Content`), referer spoofing anti-hotlink, dan download forcing.
  - `studio.ts`: Endpoint analisis video TikTok/Douyin (`/api/studio/analyze-video`), ekstraksi metadata TikWM, dan orkestrasi Google GenAI SDK / Weavy Any LLM untuk pembuatan storyboard breakdown JSON terstruktur.
  - `upload.ts`: Pre-upload media disk-stream ke Weavy AI asset store dengan Multer disk storage (limit 100MB).
- **`server/providers/`**:
  - `runninghub.ts`: Handler integrasi API RunningHub (COS upload, ComfyUI workflow mapping, task creation, queue handling `TASK_QUEUE_MAXED`, dan status polling).
  - `roboneo.ts`: Handler integrasi RoboNeo (Meitu token parsing, Alibaba Cloud OSS STS upload, Kling 2.6 nodeexecute, retry logic saat server busy, dan polling).
  - `galleri5.ts`: Handler integrasi Galleri5 API (verifikasi akun, upload aset, trigger Kling 2.6, polling, dan history).
  - `kie.ts`: Handler integrasi Kie.ai API (verifikasi API key, upload media, trigger SeeDance/Grok/GPT, polling, dan history).
  - `weavy.ts`: Handler integrasi Weavy AI (verifikasi token Firebase, refresh credentials, discovery model & node catalog).
- **`server/utils/`**:
  - `sheets.ts`: Klien Google Sheets v4 API menggunakan JWT service account (`google-service-account.json`).
  - `helpers.ts`: Pertukaran token Firebase Auth (`getFreshIdToken`), pembersih pesan error, dan ekstraksi URL media bertingkat rekursif dari respons batch Weavy.

### B. Frontend (`src/`)
- **`src/main.tsx`**: Entry point React 18 DOM.
- **`src/App.tsx`**: State manager global untuk tab navigasi, active user, dan akun provider.
- **`src/types.ts` & `src/types/canvas.ts` & `src/types/studio.ts`**: Definisi TypeScript interface lengkap (akun, model, batch job, node canvas, edge, port, chat session, message, studio project, scene, composite config).
- **`src/components/`**: Komponen UI fungsional:
  - Layout: `Header.tsx`, `DesktopSidebar.tsx`, `BottomNav.tsx`, `Footer.tsx`, `ThemeSlideOverlay.tsx`.
  - Autentikasi: `AuthScreen.tsx`, `LoginModal.tsx`, `ProfileView.tsx`.
  - Generasi Tunggal: `PromptCard.tsx`, `RecentGenerations.tsx`, `MediaThumbnail.tsx`, `GenerationDetailModal.tsx`, `AddMediaModal.tsx`, `DragDropUploader.tsx`, `SettingsModal.tsx`.
  - Antrean Batch: `BatchView.tsx`, `AddBatchJobModal.tsx`, `BatchJobDetailModal.tsx`.
  - Studio Video-to-Storyboard: `StudioView.tsx` dan folder `src/components/studio/` (`StudioVideoIngestCard.tsx`, `StudioAnalysisCard.tsx`, `StudioSceneCard.tsx`, `StudioCompositeModal.tsx`, `StudioProjectHistoryModal.tsx`).
  - Riwayat & Pengaturan: `HistoryView.tsx`, `GlobalSettingsView.tsx`.
  - Visual Canvas (`src/components/canvas/`): `CanvasView.tsx`, `CanvasDashboard.tsx`, `CanvasNodeCard.tsx`, `CanvasWires.tsx`, `CanvasInspectorPanel.tsx`, `CanvasContextMenu.tsx`, `CanvasGroupCard.tsx`, `CanvasPreviewModal.tsx`, `CanvasMarkupModal.tsx`, `ImportWeavyModal.tsx`.
  - Multimodal Chat (`src/components/chat/`): `ChatView.tsx`, `chatUtils.ts`, `CleanMessageRenderer.tsx`, `ChatAttachmentCarousel.tsx`, `EmbeddedVideoPlayer.tsx`, `GeneratedVideoCard.tsx`, `ImageGenerationSpinner.tsx`, `VideoGenerationSpinner.tsx`, `WeavyActionCard.tsx`, `RepostMediaCard.tsx`.
- **`src/lib/`**:
  - `provider.ts`: Metadata provider dan logika pemilihan provider aktif (`resolveActiveProviderId`).
  - `weavy.ts`: Helper client auth untuk token exchange dan profil Weavy.
  - `canvasRecipes.ts`: Generator preset default recipe canvas dan parser format Weavy ke Canvas.
  - `canvasFileManager.ts`: Logika CRUD file canvas lokal.
  - `canvasIndexedDb.ts` & `chatIndexedDb.ts` & `studioIndexedDb.ts`: Adapter penyimpanan persisten berbasis IndexedDB browser (`amb_media_studio_db` untuk Studio).
  - `studioService.ts`: Orkestrator client analisis video studio, inisiasi render adegan scene, auto-account credit failover, polling status, dan perakitan ekspor ZIP.
- **`src/utils/imageCompressor.ts`**: Kompresi gambar client-side via HTML5 canvas sebelum upload.

### C. Ekstensi & Skrip Pendukung
- **`Extension-Dola/`**: Ekstensi Chrome/Edge Manifest V3 (side panel) untuk intersep network request Dola AI (`inject_network.js`, `content.js`, `sidepanel.js`) dan download video master 1080p unwatermarked ByteDance CDN.
- **`scripts-dola/`**: Kumpulan skrip CLI Node.js & bash untuk reverse engineering, pengujian sesi, dan ekstraksi URL video unwatermarked Dola AI (`get_clean_video.cjs`, `check_chat.cjs`, `send_video_prompt.cjs`, `test_dola.cjs`, `test_dola.sh`).
- **`script-weavy/`**: Tooling CLI Node.js (`analyze_recipe.cjs`) untuk menganalisis skema recipe Weavy AI dan mengeksekusi flow via CLI.
- **Root ComfyUI Workflows**: File JSON workflow ComfyUI untuk RunningHub (`Minimax H3 Image to Video Tercepat 15 Detik.json`, `LTX2.3.json`, `MiniMax+H3+MAX+I2V+AMB+Media.json`, `workflow_2098349244620308482.json`).

---

## 3. Pola & Pattern Arsitektur yang Digunakan

1. **Proxy & Backend Orchestrator Pattern:**
   - Seluruh pemanggilan API pihak ketiga yang membutuhkan kredensial sensitif atau berurusan dengan batasan CORS dan anti-hotlink CDN dilewatkan melalui backend Express.js.

2. **Virtual Recipe Canvas Pattern:**
   - Untuk generasi Weavy AI, backend membuat recipe canvas lengkap secara dinamis pada runtime, merangkai simpul (nodes) prompt, model, dan file input, menyimpannya via API Weavy, lalu mengeksekusi batch run.

3. **Dynamic Provider Resolution Pattern (`provider.ts`):**
   - Pemilihan AI vendor dilakukan secara transparan berdasarkan tab aktif atau model yang dipilih di antarmuka pengguna tanpa membebani logika komponen UI.

4. **Tri-Layer Storage & Persistence Architecture:**
   - **Layer 1 (`localStorage`)**: Data berukuran kecil untuk rendering instan bebas blocking saat aplikasi dimuat.
   - **Layer 2 (`IndexedDB`)**: Penyimpanan lokal berkapasitas besar di browser untuk dokumen resep canvas, riwayat obrolan lengkap beserta blob media, dan arsip proyek studio (`amb_media_studio_db`).
   - **Layer 3 (Google Sheets & Server JSON)**: Sinkronisasi akun/kredensial ke Google Sheets dan sesi obrolan ke `server/data/chat_sessions.json`.

5. **HTTP Range Streaming & Media Proxy Pattern:**
   - Pengaliran video menggunakan header `Range: bytes=...` (`206 Partial Content`) dengan referer spoofing untuk memutar video dari CDN eksternal dengan performa tinggi dan perlindungan dari pemblokiran.

6. **In-Browser Interactive Visual Markup Pattern:**
   - Memungkinkan pengeditan gambar secara langsung di browser via elemen `<canvas>` HTML5 untuk membubuhi panah arah gerakan atau kotak area fokus sebelum gambar diunggah ke model AI.

7. **Multi-Account Credit Failover & Round-Robin Pattern (`studioService.ts`):**
   - Saat mengeksekusi render visual adegan storyboard beruntun (misal 6 scene sekaligus), jika akun Weavy yang sedang aktif kehabisan kuota kredit (< 2 CR) atau mengembalikan error quota, service client secara cerdas mencari akun Weavy alternatif yang memiliki saldo kredit positif dan mengalihkan token eksekusi secara otomatis tanpa menghentikan proses pengguna.

8. **One-Sheet Composite & Client-Side ZIP Packaging Pattern:**
   - Menghasilkan lembar storyboard terpadu langsung di canvas browser dengan tata letak matriks grid dinamis (3x2, 2x3), banner judul, dan badge penomoran scene, serta memaketkan seluruh aset gambar HD dan `storyboard.json` ke dalam file ZIP via JSZip.
