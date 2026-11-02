# Dokumentasi UI / UX & Komponen Antarmuka

Dokumen ini mendata seluruh komponen antarmuka pengguna (UI) yang ada dalam aplikasi **AMB Media V2** beserta fungsi dan alur interaksi pengguna (UX).

---

## 1. Daftar Komponen UI & Fungsinya

### A. Komponen Layout & Navigasi

| Komponen | File | Fungsi |
| :--- | :--- | :--- |
| `Header` | `src/components/Header.tsx` | Bar navigasi atas yang menampilkan logo AMB Media V2, indikator provider AI aktif beserta sisa saldo kredit/koin secara live, tombol ganti tema (Light/Dark), status akun, dan tombol buka settings. |
| `DesktopSidebar` | `src/components/DesktopSidebar.tsx` | Sidebar navigasi samping kiri untuk tampilan desktop. Berisi daftar tab navigasi (Generate, Batch, Canvas, Chat, History, Settings, Profile), widget kartu provider aktif dengan balance, dan kartu profil user di bagian bawah. |
| `BottomNav` | `src/components/BottomNav.tsx` | Bar navigasi bawah responsif untuk perangkat mobile dengan ikon dan badge status tab aktif. |
| `ThemeSlideOverlay` | `src/components/ThemeSlideOverlay.tsx` | Lapisan transisi halus saat pengguna beralih antara tema gelap dan terang. |
| `Footer` | `src/components/Footer.tsx` | Bagian footer informasi hak cipta dan status sistem. |

---

### B. Komponen Autentikasi & Pengguna

| Komponen | File | Fungsi |
| :--- | :--- | :--- |
| `AuthScreen` | `src/components/AuthScreen.tsx` | Halaman login/register fullscreen yang menyambut user sebelum masuk ke aplikasi jika belum terautentikasi. |
| `LoginModal` | `src/components/LoginModal.tsx` | Modal popup untuk masuk (login) atau pendaftaran (register) user baru yang tersinkronisasi ke Google Sheets. |
| `ProfileView` | `src/components/ProfileView.tsx` | Tampilan profil pengguna untuk melihat nama, email, role, status akun di Google Sheets, serta opsi keluar (Logout). |

---

### C. Komponen Generasi Utama (Tab `generate`)

| Komponen | File | Fungsi |
| :--- | :--- | :--- |
| `PromptCard` | `src/components/PromptCard.tsx` | Kartu utama generator media. Berisi: input textarea prompt deskripsi, tombol AI Enhance Prompt, selector mode (Video vs Image), dropdown pilihan model, rasio aspek, durasi video, resolusi, toggle audio, tombol lampirkan media referensi, dan tombol Generate utama. |
| `RecentGenerations` | `src/components/RecentGenerations.tsx` | Panel daftar kartu hasil generasi terbaru (video / gambar) yang baru saja selesai diproses atau sedang dalam antrean. |
| `MediaThumbnail` | `src/components/MediaThumbnail.tsx` | Kartu thumbnail media interaktif. Dilengkapi tombol play/pause instan untuk video, label badge model, durasi, tombol favorit, dan tombol opsi menu. |
| `GenerationDetailModal` | `src/components/GenerationDetailModal.tsx` | Modal jendela detail media beresolusi tinggi yang menampilkan prompt lengkap, model, aspek rasio, waktu generate, tombol unduh file, tombol jadikan referensi prompt, dan tombol salin prompt. |
| `AddMediaModal` | `src/components/AddMediaModal.tsx` | Modal dialog untuk memilih atau mengunggah media referensi (upload lokal dari komputer atau paste URL media eksternal). |
| `DragDropUploader` | `src/components/DragDropUploader.tsx` | Area drag-and-drop file untuk mengunggah media dengan indikator progress dan preview. |
| `SettingsModal` | `src/components/SettingsModal.tsx` | Modal cepat untuk menyesuaikan pengaturan default generasi (aspect ratio default, resolusi default, kuota limiter). |

---

### D. Komponen Antrean Batch (Tab `batch`)

| Komponen | File | Fungsi |
| :--- | :--- | :--- |
| `BatchView` | `src/components/BatchView.tsx` | Dashboard pengelolaan tugas batch untuk RunningHub Studio. Menampilkan daftar antrean, filter status (Semua, Menunggu, Berjalan, Berhasil, Gagal), statistik koin terpakai, dan tombol kontrol eksekusi massal. |
| `AddBatchJobModal` | `src/components/AddBatchJobModal.tsx` | Modal pembuatan job batch baru: input multi-prompt atau multi-media referensi yang akan dijalankan secara serial/paralel. |
| `BatchJobDetailModal` | `src/components/BatchJobDetailModal.tsx` | Modal inspeksi detail pekerjaan batch: log status node RunningHub, parameter eksekusi, pesan error jika gagal, dan tombol download hasil akhir. |

---

### E. Komponen Visual Node Canvas (Tab `canvas`)

| Komponen | File | Fungsi |
| :--- | :--- | :--- |
| `CanvasView` | `src/components/CanvasView.tsx` | Komponen viewport kanvas utama tak terbatas (infinite canvas) dengan fitur pan (geser), zoom (perbesar/perkecil), drag node, penarikan kabel (wire connecting), dan toolbar kontrol. |
| `CanvasDashboard` | `src/components/canvas/CanvasDashboard.tsx` | Dashboard manajemen berkas kanvas (Recent Recipes, Semua Berkas, Tong Sampah, New Canvas, Import Recipe dari Weavy, Duplikasi, Ubah Nama, dan Hapus). |
| `CanvasNodeCard` | `src/components/canvas/CanvasNodeCard.tsx` | Komponen kartu node kanvas yang merepresentasikan unit pemrosesan: port input di sebelah kiri, port output di sebelah kanan, status eksekusi (idle, running, completed, error), progress bar, preview thumbnail gambar, dan tombol run individual. |
| `CanvasWires` | `src/components/canvas/CanvasWires.tsx` | Layer SVG berkinerja tinggi yang menggambar garis kurva bezier mulus yang menghubungkan port output sebuah node ke port input node lainnya, lengkap dengan efek warna kabel dan flow animasi saat eksekusi. |
| `CanvasInspectorPanel` | `src/components/canvas/CanvasInspectorPanel.tsx` | Panel samping kanan untuk mengedit parameter node terpilih secara mendalam (seed, aspect ratio, model dropdown, resolution, runs, prompt overrides). |
| `CanvasContextMenu` | `src/components/canvas/CanvasContextMenu.tsx` | Menu klik kanan pada area kanvas untuk menambahkan node baru (Prompt, Image Model, LLM, Viewer, Note), menduplikasi node, atau mengelompokkan node. |
| `CanvasGroupCard` | `src/components/canvas/CanvasGroupCard.tsx` | Kartu kontainer transparan untuk mengelompokkan sekumpulan node terkait dalam sebuah grup dengan warna dan judul khusus. |
| `CanvasPreviewModal` | `src/components/canvas/CanvasPreviewModal.tsx` | Modal preview media beresolusi tinggi untuk node Image Viewer. |
| `CanvasMarkupModal` | `src/components/canvas/CanvasMarkupModal.tsx` | Modal studio anotasi dan markup visual gambar langsung di browser berbasis `<canvas>` HTML5. Menyediakan alat panah (Arrow), persegi (Rectangle), lingkaran (Circle), pena bebas (Pen), stabilo transparan (Highlighter), dan penghapus (Eraser) dengan pemilih palet warna, pengatur ukuran goresan garis, fitur Undo/Redo, serta tombol simpan gambar teranotasi. |
| `ImportWeavyModal` | `src/components/canvas/ImportWeavyModal.tsx` | Modal dialog untuk menarik resep dari akun Weavy pengguna via API atau mem-paste raw JSON Weavy recipe untuk dikonversi menjadi node kanvas visual. |

---

### F. Komponen Asisten Chat (Tab `chat`)

| Komponen | File | Fungsi |
| :--- | :--- | :--- |
| `ChatView` | `src/components/ChatView.tsx` | Antarmuka obrolan asisten AI multimodal terpadu dengan 3 mode (`chat`, `video`, `image`), integrasi multi-model (Weavy Any LLM, Weavy Image Models, dan RunningHub ComfyUI Video), multi-account Weavy switcher dengan sinkronisasi kredit live, drag & drop universal file/media antar pesan, keyboard navigation mention `@imgX` & slash command `/`, pemutar video native beresolusi tinggi, scraping URL TikTok/e-commerce real-time, dan tri-layer persistence (LocalStorage, IndexedDB, dan server JSON). |
| `chatUtils` | `src/components/chat/chatUtils.ts` | Pusat logika bisnis obrolan: katalogisasi media sesi (`getAllSessionImages`, `getAllSessionVideos`), deteksi repost natural language / `@img` (`detectImageRepostRequest`), parser slash commands (`SLASH_COMMANDS`, `expandSlashCommands`), ekstraksi blok JSON (`extractWeavyActionFromMessage`, `extractWeavyRepostFromMessage`), helper polling Weavy (`pollWeavyTaskStatus`), dan helper sinkronisasi kredit akun Weavy. |
| `CleanMessageRenderer` | `src/components/chat/CleanMessageRenderer.tsx` | Parser pesan Markdown cerdas: membersihkan divider mentah (`---`) dan hashtag Markdown (#, ##), memisahkan teks percakapan natural dari blok terstruktur (`weavy_generate`, `weavy_repost`, `prompt:video`), menyediakan tombol salin prompt satu-klik, serta merender tag `@imgX` dan `@vidX` menjadi badge interaktif. |
| `ChatAttachmentCarousel` | `src/components/chat/ChatAttachmentCarousel.tsx` | Komponen carousel horizontal interaktif untuk pratinjau thumbnail kumpulan media lampiran (gambar/video) sebelum dikirimkan ke obrolan. Dilengkapi nomor indeks badge `@imgX` / `@vidX`, tombol hapus lampiran (`X`), navigasi gulir halus (kiri/kanan), dan tombol pintasan Markup (`Pencil`) yang langsung membuka `CanvasMarkupModal` untuk mencoret atau memberi tanda panah pada gambar. |
| `EmbeddedVideoPlayer` | `src/components/chat/EmbeddedVideoPlayer.tsx` | Pemutar video native kustom bertenaga HTML5 `<video>` dengan dukungan penuh streaming HTTP Range (`206 Partial Content`) via endpoint proxy backend (`/api/proxy-video`), tombol play/pause di tengah dan kontrol bar, scrubber pencarian waktu yang halus, kontrol mute/volume, indikator durasi real-time, tombol fullscreen terintegrasi, tombol unduh file MP4 langsung, serta thumbnail poster dinamis. |
| `GeneratedVideoCard` | `src/components/chat/GeneratedVideoCard.tsx` | Kartu penampil video hasil generasi AI di dalam bubble chat. Dilengkapi pemutar video terintegrasi (`EmbeddedVideoPlayer`), badge informasi model dan durasi video, tombol salin prompt satu-klik, tombol unduh berkas MP4 langsung, tombol layar penuh (expand), tombol aksi "Jadikan Referensi" untuk menyematkan kembali video sebagai input motion control pada prompt berikutnya, serta dukungan drag-and-drop URL video. |
| `ImageGenerationSpinner` | `src/components/chat/ImageGenerationSpinner.tsx` | Indikator visual progresif saat asisten sedang menghasilkan gambar di dalam chat dengan animasi rotasi melingkar, cincin rotasi ganda, kurva interpolasi persentase non-linear (8% hingga 98%), dan estimasi waktu pemrosesan adaptif sesuai rasio aspek. |
| `VideoGenerationSpinner` | `src/components/chat/VideoGenerationSpinner.tsx` | Indikator visual progresif khusus saat asisten atau alur kerja sedang memproses pembuatan video AI di dalam chat. Dilengkapi efek animasi filmstrip/lingkaran berputar, kurva simulasi persentase progres non-linear dinamis, status teks kontekstual bertahap ("Rendering frames...", "Synthesizing motion...", "Finalizing video stream..."), badge model video, dan rasio aspek responsif. |
| `WeavyActionCard` | `src/components/chat/WeavyActionCard.tsx` | Kartu aksi generasi gambar AI Weavy di dalam chat. Menyajikan prompt usulan, badge model, rasio aspek, tombol "Generate Sekarang" (1-klik eksekusi), indikator loading/error menggunakan `ImageGenerationSpinner`, dan thumbnail hasil jadi yang mendukung drag-and-drop ke input prompt chat berikutnya. |
| `RepostMediaCard` | `src/components/chat/RepostMediaCard.tsx` | Kartu penampil pengiriman ulang media lama sesi (0 Kredit). Dilengkapi label indeks gambar/video, tombol zoom/preview modal, tombol unduh file, tombol "Jadikan Referensi", dan dukungan drag-and-drop langsung ke textarea input. |

#### Fitur & Kemampuan Mutakhir Menu Chat (`ChatView`):

1. **3 Mode Operasional Terpadu (Unified Modes):**
   - **Mode Obrolan / Teks (`chat`)**: Percakapan asisten cerdas, tanya-jawab, analisis naskah, bedah prompt video/gambar, serta kolaborasi co-worker.
   - **Mode Buat Video (`video`)**: Antarmuka generasi video langsung di chat bertenaga RunningHub ComfyUI workflow (MiniMax H3 Turbo, MiniMax H3 15s HD, Kling Motion Control, SeeDance Mini 2.0, SeeDance 2.5) dengan konfigurasi Rasio Aspek (16:9, 9:16, 1:1, 4:3), Durasi (5s, 10s, 15s, 30s), dan Resolusi (720p, 1080p). Menghasilkan video interaktif yang ditampilkan melalui `GeneratedVideoCard`.
   - **Mode Buat Gambar (`image`)**: Antarmuka generasi gambar langsung di chat bertenaga Weavy Image Models (Nano Banana Pro, Seedream V5.0 Pro Edit, GPT Image 2.5, ChatGPT Images 2.0 Edit, Grok Imagine Image) dengan konfigurasi Rasio Aspek (9:16, 16:9, 1:1, 4:3, 3:4) dan auto-upload media referensi ke Weavy Assets.

2. **Carousel Lampiran Interaktif & Studio Markup Gambar (`ChatAttachmentCarousel` & `CanvasMarkupModal`):**
   - Saat pengguna mengunggah beberapa gambar atau video ke obrolan, `ChatAttachmentCarousel` menampilkan kartu carousel ringkas dengan thumbnail yang dapat digeser.
   - Tombol anotasi pensil pada setiap thumbnail gambar langsung membuka `CanvasMarkupModal`, memungkinkan pengguna menggambar panah arahan gerak, melingkari bagian pakaian/produk yang perlu diedit, atau menambahkan coretan stabilo sebelum gambar dikirimkan ke model AI.
   - Gambar yang telah diberi markup dapat langsung disimpan dan menggantikan attachment referensi di carousel secara otomatis.

3. **Mesin Slash Commands (`/`) & Preset Sutradara Kreatif:**
   - Mengetik `/` di textarea menampilkan popup autocomplete yang dapat dinavigasi dengan panah atas/bawah, Tab, dan Enter:
     - `/fashion` atau `/video`: **15-Second Commercial TikTok Fashion & Product Director Preset**. Merestrukturisasi produk fashion/katalog menjadi storyboard video TikTok berdurasi 15 detik dengan ritme tinggi (0–3s Fast Texture Hook, 3–6s Fit/Width & Drape, 6–9s Controlled Side View, 9–12s Rear Fit, 12–15s Return Hero Finish), spesifikasi kamera iPhone 16 Pro (24mm/48mm), penguncian warna/pola kain, pencegahan aksesoris palsu, serta negative prompts anti-halusinasi.
     - `/natural`: **Organic Non-Rigid Video Director Preset / Candid Narrative Flow**. Menyusun prompt video naratif mengalir tanpa partisi detik kaku (Opening candid moment → Natural mid-movement transition → Organic detail glimpse → Relaxed closing beat), gesture manusia spontan, kamera dinamis sesuai mood (santai, editorial magazine, dokumenter jalanan, golden hour), dan penguncian konsistensi produk.
     - `/ugc`: **User Generated Content Lifestyle Style**. Mengubah adegan menjadi konten influencer otentik dengan kamera smartphone natural (iPhone front-facing 24mm, natural room light, zero artificial gloss).
     - `/clean`: **Clutter Cleanup & Object Removal**. Membersihkan kabel, kekacauan, atau objek yang tidak diinginkan dari foto ruangan/produk dengan tetap mempertahankan arsitektur asli.
     - `/jumpcut`: Preset pemotongan dinamis untuk video TikTok ritmis.

4. **Sistem Indeksasi Media & Mention (@img1, @vid1):**
   - Setiap gambar (hasil upload pengguna, scraping web URL, atau hasil generasi AI) otomatis dikatalogkan dengan nomor urut permanen `@img1`, `@img2`, `@img3`, dst. Mengetik `@` memicu dropdown mention interaktif untuk merujuk gambar sebelumnya secara instan.
   - Setiap video (hasil upload atau ekstraksi URL) dikatalogkan dengan tag `@vid1`, `@vid2`, dst.

5. **Pemutar Video Native Tersemat (`EmbeddedVideoPlayer` & `GeneratedVideoCard`):**
   - Setiap video yang dikirimkan ke obrolan atau dihasilkan oleh model AI disajikan menggunakan `EmbeddedVideoPlayer` dan dibungkus dalam `GeneratedVideoCard`.
   - Dilengkapi kontrol pemutaran (Play/Pause), bilah waktu (scrubber), pengatur volume/mute, mode layar penuh (Full Screen), serta tombol unduh MP4 langsung tanpa keluar dari aplikasi.
   - Video dari TikTok otomatis di-cache ke folder backend `/media-cache/` untuk pemutaran secepat kilat dengan dukungan HTTP Range streaming.

6. **Web Browsing Real-Time & Ekstraktor URL E-Commerce / TikTok:**
   - Pengguna cukup menempelkan link produk (Tokopedia, Shopee, TikTok Shop) atau link video TikTok/Douyin ke dalam obrolan.
   - Server otomatis mengekstrak foto produk HD, video tanpa watermark via TikWM, judul barang, nama toko, kisaran harga, dan rating ulasan.
   - Media hasil scraping otomatis disematkan hanya pada turn percakapan saat link dikirimkan dan siap dijadikan referensi generasi.

7. **Analisis Konten Gambar Pra-Prompt & Validasi Konsistensi (Pre-Prompt Validation):**
   - Sebelum menyusun prompt storyboard video panjang, AI wajib melakukan audit visual eksplisit (keberadaan model manusia, tipe bidikan flat-lay vs on-model, produk utama).
   - Jika terdapat ketidakcocokan konteks (misal pengguna meminta "fokus ke celana yang dipakai model", tetapi gambar adalah foto katalog flat-lay tanpa orang), AI otomatis berhenti (halt) dan meminta konfirmasi terlebih dahulu dalam bahasa Indonesia sebelum membuat prompt.

8. **Pemisahan Intent Video (Intent Type A vs Intent Type B):**
   - **Intent Type A (Slash Command `/fashion` / `/video`)**: Menerapkan format komersial TikTok 15 detik.
   - **Intent Type B (Ekstraksi Durasi Asli / Generic Video-to-Prompt)**: Jika pengguna meminta prompt dari video tanpa mengetik slash command, AI mendeteksi durasi asli video referensi (misal 25 detik atau 40 detik), menyatakan durasi tersebut di awal respon, dan membedah adegan dari 0 detik hingga akhir durasi sesungguhnya tanpa memotong di detik ke-15.

9. **Fitur Pengiriman Ulang Media (Repost Media - 0 Kredit):**
   - Jika pengguna meminta menampilkan kembali gambar lama dalam sesi (misalnya: "mana gambar pertama tadi", "kirim ulang foto ke-2"), AI langsung mengembalikan file gambar asli menggunakan blok `weavy_repost` tanpa melakukan generate ulang dan tanpa memotong kredit pengguna via `RepostMediaCard`.

10. **Multi-Akun Weavy & Live Credit Tracker:**
    - Sidebar chat menampilkan daftar akun Weavy yang terhubung, sisa kredit masing-masing, tombol switch akun aktif, serta tombol sinkronisasi kuota real-time.

11. **Penyimpanan Tri-Level (Tri-Layer Persistence):**
    - Sinkronisasi instan ke `localStorage` (untuk UI responsif), `IndexedDB` (untuk penyimpanan objek biner dan pesan obrolan tanpa batas kuota), serta debounced backup ke file server `/api/chat-sessions`.

---

### G. Komponen Studio Video-to-Storyboard (Tab `studio`)

| Komponen | File | Fungsi |
| :--- | :--- | :--- |
| `StudioView` | `src/components/StudioView.tsx` | Komponen viewport studio video-to-storyboard utama. Mengorkestrasikan analisis video TikTok/Douyin, ekstraksi naskah, breakdown adegan berurutan (*scene breakdown*), eksekusi pembuatan visual storyboard multi-scene per batch atau per scene secara independen dengan auto-switching akun Weavy, perakitan composite grid, dan ekspor storyboard ZIP / JSON. |
| `StudioVideoIngestCard` | `src/components/studio/StudioVideoIngestCard.tsx` | Kartu form input video & konfigurasi AI. Menyediakan: input URL video TikTok/Douyin atau tombol sample preset, input judul/topik produk, input instruksi tambahan sutradara (raw prompt), pemilih jumlah adegan (4, 6, 8, 10 scene), pemilih aspek rasio visual (`9:16`, `16:9`, `1:1`), pemilih model gambar AI (`GPT Image 2.5`, `Seedream V5.0 Pro Edit`, `Nano Banana Pro`, `Grok Imagine Image`), pemilih model AI analisis (`Gemini 2.5 Flash`, `Gemini 3 Pro`, `Claude Sonnet 5`, `GPT-5.6 Sol`, dll.), serta tombol **Mulai Analisis Video** dengan animasi loading. |
| `StudioAnalysisCard` | `src/components/studio/StudioAnalysisCard.tsx` | Kartu ringkasan analisis pemasaran & hook sutradara komersial: menampilkan hook visual 3 detik pertama, nama produk/topik inti, profil target audiens, daftar poin nilai jual utama (*Core USPs*), strategi pembuktian visual (*Visual Proof*), strategi ajakan bertindak (*Call to Action*), transkrip narasi utuh, ringkasan isi video, serta tombol salin cepat ke clipboard untuk tiap bagian analisis. |
| `StudioSceneCard` | `src/components/studio/StudioSceneCard.tsx` | Kartu adegan individual untuk tiap scene storyboard: menampilkan nomor scene, judul adegan, badge timecode & durasi detik, tujuan adegan (*sceneGoal*), arahan visual sinematik bahasa Indonesia (*visualDescription*), naskah voiceover / narasi VO (*voiceover*), teks grafis di layar (*onScreenText*), sudut & pergerakan kamera (*cameraAngle*), prompt AI Image photorealistic bahasa Inggris yang dapat diedit langsung (*imagePrompt*), prompt AI Video motion (*videoPrompt*), tombol eksekusi **Generate Gambar Scene** dengan indikator progress rotasi akun, pratinjau gambar hasil render, tombol zoom perbesar gambar fullscreen, tombol unduh gambar, dan tombol regenerasi. |
| `StudioCompositeModal` | `src/components/studio/StudioCompositeModal.tsx` | Modal perakit lembar komposit storyboard (*Composite Grid Sheet*): menyatukan seluruh adegan yang telah selesai di-render menjadi 1 gambar grid terpadu (misal format 3 kolom x 2 baris atau 2 kolom x 3 baris) berbasis canvas HTML5 beresolusi tinggi, lengkap dengan konfigurasi border warna/ketebalan, padding, banner judul proyek, badge penomoran scene, dan tombol unduh lembar komposit resolusi tinggi (PNG/JPG). |
| `StudioProjectHistoryModal` | `src/components/studio/StudioProjectHistoryModal.tsx` | Modal pengelola riwayat proyek studio yang tersimpan di `IndexedDB` (`amb_media_studio_db`). Memungkinkan pengguna memuat proyek lama, menduplikasi proyek, mencari berdasarkan nama, dan menghapus proyek yang tidak terpakai. |

---

### H. Komponen Riwayat & Pengaturan

| Komponen | File | Fungsi |
| :--- | :--- | :--- |
| `HistoryView` | `src/components/HistoryView.tsx` | Tampilan riwayat seluruh generasi media. Menyediakan filter tab (Semua, Video, Gambar, Favorit), kotak pencarian prompt, layout toggle (Grid vs List), dan aksi hapus/unduh batch. |
| `GlobalSettingsView` | `src/components/GlobalSettingsView.tsx` | Panel manajemen akun dan API keys untuk 5 AI Provider (Weavy, RoboNeo, Galleri5, Kie.ai, RunningHub). Dilengkapi tombol sinkronisasi ke Google Sheets, tombol cek saldo kuota, dan toggle aktif/nonaktif akun. |

---

## 2. Alur Interaksi Pengguna (User Interaction Flow)

### Alur 1: Autentikasi & Masuk Akun
1. Pengguna membuka web app. Jika belum ada session di `localStorage`, aplikasi menampilkan `AuthScreen`.
2. Pengguna memasukkan email/username dan password.
3. Backend memvalidasi data terhadap Google Sheets (`/api/auth/login`).
4. Begitu berhasil, data user dan daftar akun provider pengguna langsung disinkronkan dari sheet `ProviderAccounts` ke browser. Pengguna diarahkan ke antarmuka studio utama.

### Alur 2: Single Media Generation (Tab `generate`)
1. Pengguna memilih tipe media: **Video** atau **Image**.
2. Pengguna mengetikkan prompt pada `PromptCard`.
3. *(Opsional)* Pengguna mengklik tombol **Enhance Prompt** untuk memperkaya prompt dengan AI.
4. *(Opsional)* Pengguna melampirkan media referensi via `AddMediaModal` atau drag-and-drop.
5. Pengguna memilih model AI (misal: *MiniMax H3 Turbo Video* atau *SeeDance 2.5*). Sistem otomatis mencocokkan provider aktif di Header (`resolveActiveProviderId`).
6. Pengguna menekan tombol **Generate**.
7. Kartu placeholder proses muncul di `RecentGenerations`. Server memanggil endpoint provider terkait (atau membuat Virtual Weavy Recipe) dan melakukan polling sampai selesai.
8. Media jadi tampil di daftar dan dapat diklik untuk membuka `GenerationDetailModal`.

### Alur 3: Batch Video Generation (Tab `batch`)
1. Pengguna berpindah ke tab **Batch**. Provider aktif otomatis dikunci ke **RunningHub**.
2. Pengguna mengklik **Buat Tugas Batch Baru** (`AddBatchJobModal`).
3. Pengguna mengunggah daftar gambar/video dan menuliskan prompt.
4. Pekerjaan masuk ke antrean `BatchView`. RunningHub memproses workflow ComfyUI di cloud secara asinkron.
5. Pengguna memantau status secara live dan dapat mengunduh seluruh video hasil jadi sekaligus.

### Alur 4: Studio Node Canvas (Tab `canvas`)
1. Pengguna membuka tab **Canvas**. Dashboard berkas menampilkan resep kanvas yang tersimpan.
2. Pengguna dapat memilih preset siap pakai (Nano Banana Pro, Seedream, Grok, Any LLM) atau mengklik **Resep Baru**.
3. Di dalam editor kanvas, pengguna:
   - Menambahkan node melalui klik kanan (`CanvasContextMenu`).
   - Menghubungkan output teks dari Node Prompt ke input prompt Node Model via port handle.
   - Menghubungkan output gambar dari Node Image Input ke input gambar Node Model.
   - Memberikan anotasi atau tanda panah pada gambar input melalui modal markup (`CanvasMarkupModal`).
   - Menghubungkan output hasil Node Model ke Node Image Viewer.
4. Pengguna mengklik tombol **Jalankan Model** pada node tertentu atau mengeksekusi seluruh pipeline.
5. Backend membuat recipe sementara di Weavy, menyematkan koneksi, dan mengembalikan hasil gambar/video ke node Viewer di kanvas.

### Alur 5: Percakapan Asisten AI Multimodal (Tab `chat`)
1. Pengguna berpindah ke tab **Chat**.
2. Pengguna memilih mode operasional di header obrolan:
   - **Mode Obrolan (Teks)**: Tanya-jawab umum, analisis gaya visual, rekomendasi prompt, atau kolaborasi Co-Worker.
   - **Mode Buat Video**: Memunculkan kontrol rasio aspek, durasi (5s–30s), resolusi (720p/1080p), dan model RunningHub (MiniMax H3 Turbo, Kling Motion Control, SeeDance) untuk merender video langsung dari prompt chat.
   - **Mode Buat Gambar**: Memunculkan kontrol rasio aspek dan model Weavy (Nano Banana Pro, Seedream V5.0, GPT Image 2.5) untuk merender gambar langsung dari prompt chat.
3. Pengguna dapat mengetikkan pesan teks biasa, melampirkan file foto/video secara lokal, atau menempelkan link produk TikTok / Tokopedia / Shopee.
4. Jika beberapa file dilampirkan, `ChatAttachmentCarousel` menampilkan daftar thumbnail media lampiran. Pengguna dapat mengeklik ikon pensil untuk memberi anotasi tanda panah/coretan visual via `CanvasMarkupModal` sebelum mengirim pesan.
5. *(Opsi Slash Command)*: Pengguna mengetik `/` untuk memilih preset cerdas (`/fashion`, `/natural`, `/ugc`, `/clean`, `/jumpcut`). Sistem otomatis menyelaraskan model gambar dan aspek rasio optimal.
6. Jika link video TikTok dikirimkan, sistem backend secara asinkron mengekstrak stream tanpa watermark via TikWM, menyimpannya ke cache lokal, dan menyematkan pemutar video native HTML5 (`EmbeddedVideoPlayer`) di bubble chat.
7. Asisten AI membalas dengan respon terstruktur:
   - Menjalankan audit visual pra-prompt jika ada gambar referensi.
   - Menyajikan breakdown naskah storyboard video siap salin (`prompt:video`).
   - Menampilkan spinner progresif `ImageGenerationSpinner` untuk pembuatan gambar atau `VideoGenerationSpinner` untuk pembuatan video.
   - Menyematkan kartu aksi `WeavyActionCard` untuk rekomendasi gambar yang dapat digenerate dengan 1-klik.
   - Menyematkan kartu hasil video `GeneratedVideoCard` lengkap dengan pemutar `EmbeddedVideoPlayer` dan tombol aksi cepat.
   - Mengembalikan file lama via `RepostMediaCard` (0 Kredit) jika pengguna meminta melihat kembali media terdahulu.
8. Seluruh riwayat obrolan dan media tersimpan otomatis secara berlapis di LocalStorage, IndexedDB, serta tersinkronisasi ke server.

### Alur 6: Studio Video-to-Storyboard (Tab `studio`)
1. Pengguna membuka tab **Studio** melalui sidebar desktop atau navigasi aplikasi.
2. Di panel **StudioVideoIngestCard**:
   - Pengguna menempelkan URL video TikTok/Douyin (misal: `https://vt.tiktok.com/...`), memasukkan judul produk/topik, serta memilih jumlah scene yang diinginkan (default: 6 scenes).
   - Pengguna memilih rasio aspek visual target (`9:16`, `16:9`, `1:1`), model gambar AI target (`GPT Image 2.5`, `Seedream V5.0 Pro Edit`, `Nano Banana Pro`, `Grok Imagine Image`), dan model analisis AI (`Google Gemini 2.5 Flash`, `Gemini 3 Pro`, `Claude Sonnet 5`, `GPT-5.6 Sol`).
3. Pengguna mengklik tombol **Analisis Video**:
   - Server mengekstrak metadata video via TikWM / oEmbed (`server/routes/studio.ts`).
   - Model AI sutradara membedah konten menjadi analisis hook, USP, strategi visual proof, narasi lengkap, serta membagi adegan berurutan dengan timecode presisi.
4. Hasil analisis langsung ditampilkan:
   - Panel **StudioAnalysisCard** menyajikan ringkasan marketing, target audiens, dan transkrip.
   - Panel daftar adegan merender deretan komponen **StudioSceneCard** (Scene 1 s/d N) lengkap dengan deskripsi visual bahasa Indonesia, naskah VO, teks layar, prompt gambar sinematik bahasa Inggris, dan prompt motion video.
5. Pembuatan Gambar Visual Adegan:
   - Pengguna dapat mengklik **Generate Gambar** pada kartu scene tertentu secara terpisah, atau menekan tombol **Generate Semua Scene Sekaligus**.
   - Sistem memanggil endpoint pembuatan gambar Weavy AI (`/api/generate-weavy`) menggunakan `src/lib/studioService.ts`. Jika akun Weavy aktif kehabisan kuota kredit, sistem secara otomatis merotasi token ke akun Weavy lain yang memiliki saldo kredit positif (*seamless auto-failover*).
   - Progress bar dan indikator loading ditampilkan secara real-time pada masing-masing kartu scene.
6. Hasil gambar adegan yang selesai di-render langsung tampil di kartu scene, lengkap dengan opsi zoom resolusi tinggi, salin prompt, atau regenerasi prompt visual yang telah disunting.
7. Penyusunan Komposit & Ekspor:
   - Pengguna dapat membuka modal **StudioCompositeModal** untuk menggabungkan seluruh gambar scene menjadi 1 lembar grid storyboard (*one-sheet composite*) beresolusi tinggi dengan title banner dan badge nomor scene.
   - Pengguna dapat mengekspor seluruh proyek menjadi satu arsip berkas **ZIP** (*Export Project as ZIP*) yang berisi seluruh file gambar HD, lembar komposit, dan file naskah `storyboard.json`.
8. Seluruh status proyek studio tersimpan secara otomatis dan persisten di basis data browser `IndexedDB` (`amb_media_studio_db`) dan dapat diakses kembali sewaktu-waktu melalui modal **StudioProjectHistoryModal**.
