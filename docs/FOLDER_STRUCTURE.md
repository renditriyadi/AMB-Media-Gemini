# Struktur Direktori & File Project

Dokumen ini memuat pohon direktori (tree structure) lengkap dari seluruh file dan folder pada project **AMB Media V2** beserta penjelasan fungsi tiap berkas.

---

## Pohon Direktori Lengkap (Project Tree)

```
.
├── .env.example                                      # Panduan variabel lingkungan (environment variables)
├── .gitignore                                        # Daftar berkas/folder yang diabaikan oleh Git
├── CLAUDE.md                                         # Ringkasan panduan AI & pointer dokumentasi
├── Extension-Dola/                                   # Chrome/Edge Extension untuk Dola AI Video Grabber
│   ├── README.md                                     # Panduan instalasi dan penjelasan teknis ekstensi
│   ├── background.js                                 # Service worker ekstensi Chrome MV3
│   ├── content.css                                   # Styling tombol overlay di halaman Dola chat
│   ├── content.js                                    # Content script penginjeksi tombol unduh pada chat Dola
│   ├── icons/                                        # Aset ikon ekstensi (16px, 48px, 128px)
│   │   ├── icon16.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   ├── inject_network.js                             # Interceptor network request internal Dola
│   ├── manifest.json                                 # Manifest Chrome Extension (V3, sidePanel API)
│   ├── sidepanel.css                                 # Styling antarmuka Side Panel browser
│   ├── sidepanel.html                                # Markup HTML antarmuka Side Panel
│   └── sidepanel.js                                  # Logika Side Panel (sinkronisasi & download 1080p unwatermarked)
├── LTX2.3.json                                       # Skema graph workflow ComfyUI untuk model LTX-Video 2.3
├── MiniMax+H3+MAX+I2V+AMB+Media.json                 # Skema graph ComfyUI MiniMax H3 MAX Image-to-Video
├── Minimax H3 Image to Video Tercepat 15 Detik.json  # Workflow node ComfyUI RunningHub (MiniMax H3 15s)
├── Minimax H3 Image to Video Tercepat 15 Detik.original_dual.json # Versi workflow alternatif dual model
├── README.md                                         # Berkas README utama repository
├── Studio/                                           # Dokumen arsitektur dan spesifikasi modul studio
│   ├── ARCHITECTURE.md                               # Dokumen arsitektur modul studio
│   ├── DATA_SCHEMA.md                                # Skema data resep dan workflow studio
│   ├── ENDPOINTS.md                                  # Dokumentasi endpoint spesifik studio
│   ├── PIPELINE.md                                   # Spesifikasi pipeline generasi multimedia
│   └── UI_UX.md                                      # Pedoman desain antarmuka studio
├── assets/                                           # Aset statis & konfigurasi workspace
│   └── .aistudio/
│       └── .gitignore
├── bun.lock                                          # Lockfile dependensi Bun package manager
├── docs/                                             # Dokumentasi arsitektur dan teknis aplikasi utama
│   ├── ARCHITECTURE.md                               # Arsitektur sistem, alur kerja, dan pattern
│   ├── ENDPOINTS.md                                  # Dokumentasi seluruh REST API endpoint backend
│   ├── FOLDER_STRUCTURE.md                           # Struktur pohon folder dan deskripsi berkas ini
│   ├── PROVIDERS.md                                  # Dokumentasi AI Provider, helper, dan resolver
│   └── UI_UX.md                                      # Komponen antarmuka pengguna dan alur UX
├── google-service-account.json                       # Kredensial akun layanan Google Cloud (Sheets API)
├── index.html                                        # Entry point berkas HTML untuk Vite
├── media-cache/                                      # Direktori penyimpanan cache video TikTok/Douyin lokal
├── metadata.json                                     # Metadata identitas aplikasi AI Studio
├── package.json                                      # Konfigurasi dependensi npm dan skrip runtime
├── public/                                           # Berkas publik statis yang disajikan Vite
│   ├── workflow_minimax_single_16x9_768p_15s.json    # Skema workflow MiniMax 16:9 untuk client
│   └── workflow_minimax_single_9x16_768p_15s.json     # Skema workflow MiniMax 9:16 untuk client
├── recipe_IxxqgP64iafI4puFhfGxj9.json                # Ekspor JSON skema recipe Weavy AI (contoh 1)
├── script-weavy/                                     # Tooling CLI untuk analisis & eksekusi Weavy Flow
│   ├── analyze_recipe.cjs                            # Script Node.js untuk analisis node dan running recipe
│   └── recipe_6sRRBUf2tRNMJCN1kmL3OS.json            # Berkas backup resep Weavy Flow 6sRRBUf2tRNMJCN1kmL3OS
├── scripts-dola/                                     # Skrip automasi & reverse-engineering Dola AI
│   ├── analyze_recipe.cjs                            # Skrip analisis skema Dola/Weavy
│   ├── check_chat.cjs                                # Skrip pengecekan sesi dan riwayat chat Dola
│   ├── get_clean_video.cjs                           # Skrip ekstraksi URL CDN unwatermarked ByteDance
│   ├── send_video_account2.cjs                       # Skrip pengiriman prompt video menggunakan akun kedua
│   ├── send_video_prompt.cjs                         # Skrip pengiriman prompt video ke chat Dola
│   ├── test_dola.cjs                                 # Skrip pengujian koneksi sesi dan cookie Dola
│   └── test_dola.sh                                  # Skrip bash curl untuk pengujian cepat API Dola
├── server.ts                                         # Entry point server Express & orkestrator multi-provider
├── server/                                           # Direktori logika backend modular
│   ├── data/                                         # Direktori database/file storage JSON server
│   │   └── chat_sessions.json                        # Persistensi berkas riwayat sesi percakapan chat AI
│   ├── providers/                                    # Handler integrasi spesifik vendor AI
│   │   ├── galleri5.ts                               # Integrasi Galleri5 API (upload, generate Kling 2.6, polling, history)
│   │   ├── kie.ts                                    # Integrasi Kie.ai API (upload, generate SeeDance/Grok/GPT, polling, history)
│   │   ├── roboneo.ts                                # Integrasi RoboNeo API (Meitu AI Gateway & Kling 2.6 Motion Control)
│   │   ├── runninghub.ts                             # Integrasi RunningHub ComfyUI workflow & polling
│   │   └── weavy.ts                                  # Integrasi Weavy AI (account verification, recipes & nodes)
│   ├── routes/                                       # Router endpoint REST API Express
│   │   ├── auth.ts                                   # Rute autentikasi user ke Google Sheets (login, register, status)
│   │   ├── chatSessions.ts                           # Rute sinkronisasi riwayat sesi chat AI (JSON server persistence)
│   │   ├── providerAccounts.ts                       # Rute CRUD akun multi-provider ke Google Sheets
│   │   ├── proxy.ts                                  # Rute proxy media (proxy-image, proxy-video, proxy-download)
│   │   ├── studio.ts                                 # Rute analisis naskah video TikTok & pembuatan storyboard AI (Weavy LLM & Gemini)
│   │   └── upload.ts                                 # Rute pre-upload media disk stream ke Weavy AI asset store (max 100MB)
│   └── utils/                                        # Utilitas backend
│       ├── helpers.ts                                # Token exchange Firebase & traversal extractor URL
│       └── sheets.ts                                 # Utilitas Google Sheets v4 API
├── src/                                              # Kode sumber aplikasi frontend React (SPA)
│   ├── App.tsx                                       # Komponen root aplikasi & pengelola state tab
│   ├── components/                                   # Komponen-komponen antarmuka pengguna (UI)
│   │   ├── AddBatchJobModal.tsx                      # Modal input tugas baru pada antrean batch
│   │   ├── AddMediaModal.tsx                         # Modal pemilihan & upload media referensi
│   │   ├── AppreciationButton.tsx                    # Komponen tombol apresiasi interaktif
│   │   ├── AuthScreen.tsx                            # Layar login/registrasi fullscreen
│   │   ├── BatchJobDetailModal.tsx                   # Modal inspeksi detail log tugas batch RunningHub
│   │   ├── BatchView.tsx                             # Tampilan dashboard antrean batch RunningHub
│   │   ├── BottomNav.tsx                             # Bar navigasi bawah responsif mobile
│   │   ├── CanvasView.tsx                            # Tampilan viewport visual node canvas
│   │   ├── ChatView.tsx                              # Tampilan asisten AI chat multimodal
│   │   ├── DesktopSidebar.tsx                        # Sidebar navigasi desktop dan kartu kuota
│   │   ├── DragDropUploader.tsx                      # Utilitas drag-and-drop file uploader
│   │   ├── Footer.tsx                                # Komponen footer informasi aplikasi
│   │   ├── GenerationDetailModal.tsx                 # Modal preview detail media beresolusi tinggi
│   │   ├── GlobalSettingsView.tsx                    # Tampilan manajemen akun & API keys 5 provider
│   │   ├── GreetingDisplay.tsx                       # Banner sapaan multibahasa
│   │   ├── Header.tsx                                # Header bar atas dengan live credit indicator
│   │   ├── HistoryView.tsx                           # Tampilan riwayat seluruh generasi media
│   │   ├── InfoCard.tsx                              # Kartu informasi ringkas
│   │   ├── InfoModal.tsx                             # Modal panduan dan informasi aplikasi
│   │   ├── LanguageSelector.tsx                      # Komponen pemilih bahasa/lokal
│   │   ├── LoginModal.tsx                            # Modal dialog login/register
│   │   ├── MediaThumbnail.tsx                        # Kartu thumbnail media interaktif dengan play/pause
│   │   ├── NameInput.tsx                             # Komponen input nama pengguna
│   │   ├── ProfileView.tsx                           # Tampilan profil pengguna dan tombol keluar
│   │   ├── PromptCard.tsx                            # Kartu form generator teks/video/gambar utama
│   │   ├── RecentGenerations.tsx                     # Panel daftar hasil generasi terkini
│   │   ├── SettingsModal.tsx                         # Modal pengaturan preferensi generasi
│   │   ├── StudioView.tsx                            # Tampilan workspace video-to-storyboard studio breakdown multi-scene
│   │   ├── ThemeSlideOverlay.tsx                     # Efek transisi meluncur saat toggle dark mode
│   │   ├── canvas/                                   # Sub-komponen khusus editor Visual Canvas
│   │   │   ├── CanvasContextMenu.tsx                 # Menu konteks klik-kanan kanvas
│   │   │   ├── CanvasDashboard.tsx                   # Pengelola file dan dashboard resep kanvas
│   │   │   ├── CanvasGroupCard.tsx                   # Kontainer pengelompokan node visual
│   │   │   ├── CanvasInspectorPanel.tsx              # Panel samping editor parameter node
│   │   │   ├── CanvasMarkupModal.tsx                 # Modal studio anotasi dan markup visual gambar (arrow, rect, pen, highlight)
│   │   │   ├── CanvasNodeCard.tsx                    # Kartu node unit pemrosesan dengan ports
│   │   │   ├── CanvasPreviewModal.tsx                # Modal perbesar output node gambar/video
│   │   │   ├── CanvasWires.tsx                       # Garis kabel koneksi SVG antar port node
│   │   │   └── ImportWeavyModal.tsx                  # Modal import resep dari Weavy AI / JSON
│   │   ├── chat/                                     # Sub-komponen khusus asisten chat
│   │   │   ├── ChatAttachmentCarousel.tsx            # Carousel interaktif thumbnail lampiran chat dengan tombol markup anotasi
│   │   │   ├── CleanMessageRenderer.tsx              # Parser pesan Markdown dan pembersih blok kode
│   │   │   ├── EmbeddedVideoPlayer.tsx               # Pemutar video native HTML5 dengan kontrol lengkap & range streaming
│   │   │   ├── GeneratedVideoCard.tsx                # Kartu video hasil generasi di chat dengan tombol aksi download & copy
│   │   │   ├── ImageGenerationSpinner.tsx            # Animasi spinner progresif saat generate gambar
│   │   │   ├── RepostMediaCard.tsx                   # Kartu penampil media chat dengan tombol gunakan
│   │   │   ├── VideoGenerationSpinner.tsx            # Animasi spinner progresif saat generate video dengan simulasi persentase
│   │   │   ├── WeavyActionCard.tsx                   # Kartu eksekusi saran pembuatan gambar dari AI
│   │   │   └── chatUtils.ts                          # Utilitas chat, preset prompts (SLASH_COMMANDS), parser & system prompt generator
│   │   └── studio/                                   # Sub-komponen khusus modul video-to-storyboard Studio
│   │       ├── StudioAnalysisCard.tsx                # Kartu ringkasan analisis hook, audiens, USP, dan strategi visual
│   │       ├── StudioCompositeModal.tsx              # Modal penyusun composite grid / storyboard sheet ekspor
│   │       ├── StudioProjectHistoryModal.tsx         # Modal pengelola arsip riwayat proyek studio (IndexedDB)
│   │       ├── StudioSceneCard.tsx                   # Kartu adegan scene dengan prompt gambar/video, narasi VO, teks layar, dan render status
│   │       └── StudioVideoIngestCard.tsx             # Kartu form input video URL TikTok, ekstraksi metadata, dan konfigurasi model AI
│   ├── data/
│   │   └── mockData.ts                               # Data statis awal untuk riwayat demo
│   ├── index.css                                     # Konfigurasi Tailwind CSS dan global styles
│   ├── lib/                                          # Pustaka logika frontend
│   │   ├── canvasFileManager.ts                      # Logika CRUD file canvas lokal
│   │   ├── canvasIndexedDb.ts                        # Adapter IndexedDB untuk berkas kanvas
│   │   ├── canvasRecipes.ts                          # Preset template resep & parser Weavy ke Canvas
│   │   ├── chatIndexedDb.ts                          # Adapter IndexedDB untuk sesi chat
│   │   ├── provider.ts                               # Metadata dan resolver provider AI aktif
│   │   ├── studioIndexedDb.ts                        # Adapter IndexedDB untuk proyek studio (amb_media_studio_db)
│   │   ├── studioService.ts                          # Orkestrator client analisis studio, render scene, failover akun Weavy, & ZIP export
│   │   └── weavy.ts                                  # Utilitas pertukaran token Firebase & profil Weavy
│   ├── main.tsx                                      # Entry point React DOM render
│   ├── types.ts                                      # Definisi interface TypeScript global
│   ├── types/
│   │   ├── canvas.ts                                 # Definisi interface TypeScript khusus Canvas
│   │   └── studio.ts                                 # Definisi interface TypeScript khusus Studio & Storyboard
│   ├── utils.ts                                      # Utilitas frontend (safeFetchJson, uploadWithProgress)
│   └── utils/
│       └── imageCompressor.ts                        # Utilitas kompresi gambar HTML5 Canvas di browser
├── tsconfig.json                                     # Konfigurasi TypeScript aplikasi
├── vite.config.ts                                    # Konfigurasi bundler Vite
├── weavy_flow_OmnzH8ClUOPqsTdIh7Mlry.json            # Cadangan JSON recipe Weavy
├── workflow_2098349244620308482.json                 # Skema graph workflow ComfyUI RunningHub
├── workflow_minimax_single_16x9_768p_15s.json         # Skema graph MiniMax 16:9 di root
└── workflow_minimax_single_9x16_768p_15s.json          # Skema graph MiniMax 9:16 di root
```
