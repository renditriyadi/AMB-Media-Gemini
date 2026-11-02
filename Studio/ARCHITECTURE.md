# 🏛️ STUDIO ARCHITECTURE & SYSTEM DESIGN

Dokumen ini mendefinisikan arsitektur sistem, alur pemrosesan data, dan integrasi modular untuk menu **Studio** (AI Video-to-Storyboard & Visual Generator).

---

## 1. 🎯 Ikhtisar Sistem (System Overview)

Menu **Studio** adalah modul automasi konten ujung-ke-ujung (*End-to-End Content Pipeline*) yang mengubah video referensi (TikTok, Instagram Reels, YouTube Shorts, atau file video lokal) menjadi:
1. **Analisis Strategi Konten & Hook Breakdown** oleh AI LLM.
2. **Storyboard Visual Terstruktur** (4–6 Scene) lengkap dengan deskripsi aksi, angle kamera, dan prompt gambar bahasa Inggris teroptimasi.
3. **Generasi Gambar Tiap Scene** menggunakan **Weavy AI (GPT Image 2.5 / Seedream 5.0)**.
4. **Sintesis Komposit 1 Lembar Gambar Tunggal Storyboard (Multi-Panel Grid 3x2)** siap ekspor untuk konten carousel atau aset *Image-to-Video*.

```
┌─────────────────┐       ┌────────────────────────┐       ┌───────────────────────┐
│  Input Video    │ ────> │ Scraper & Metadata Ext │ ────> │  AI LLM Video Content │
│ (URL / File Up) │       │ (TikWM / Local Buffer) │       │   Strategic Analysis  │
└─────────────────┘       └────────────────────────┘       └───────────────────────┘
                                                                       │
                                                                       ▼
┌─────────────────────────┐       ┌────────────────────────┐       ┌───────────────────────┐
│ Final 1-Sheet Composite │ <──── │ Weavy GPT Image 2.5    │ <──── │ Structured Scene      │
│ Storyboard Image (3x2)  │       │ Multi-Scene Generation │       │ Breakdown & Prompts   │
└─────────────────────────┘       └────────────────────────┘       └───────────────────────┘
```

---

## 2. 🔄 5-Tahap Pipeline Eksekusi (The 5-Stage Pipeline)

### Tahap 1: Ingestion & Ekstraksi Metadata Video
* **Input**: URL Video TikTok/Reels atau File Video MP4/MOV lokal.
* **Backend Handler**: `/api/studio/ingest-video` & `/api/scrape-metadata`.
* **Proses**:
  * Mengambil metadata lengkap (judul, caption, hashtag, author, durasi, audio/suara asli, thumbnail).
  * Menyiapkan audio stream / thumbnail frame untuk analisis multimodal.

### Tahap 2: AI Multi-Modal & Content Analysis
* **Engine**: Claude 3.7 Sonnet / Gemini 2.5 Flash via Weavy / Server LLM Engine.
* **Output Analisis**:
  * **The 3-Second Hook**: Analisis kekuatan pembuka dan jenis hook (Problem, Shock, Curiosity, Direct Recommendation).
  * **Core Value & Selling Points (USP)**: Bedah fitur produk / pesan utama.
  * **Visual Proof & Appetite Appeal**: Elemen pembuktian visual yang wajib dihadirkan.
  * **Call to Action (CTA)**: Analisis ajakan aksi (keranjang kuning, komentar, follow).

### Tahap 3: Storyboard Decomposition & Prompt Synthesis
* Mengubah analisis konten menjadi format **4–6 Scene Storyboard** standar industri periklanan:
  * **Scene 1 (Hook)**: Visual dramatis penarik perhatian.
  * **Scene 2 (Problem / Product Intro)**: Pengenalan produk/kemasan/manfaat utama.
  * **Scene 3 (Proof / Process)**: Proses tanam, kebun subur, atau demonstrasi penggunaan.
  * **Scene 4 (Harvest / Real Result / Scale)**: Bukti nyata ukuran/hasil (social proof).
  * **Scene 5 (Appetite / Texture / Freshness)**: Visual daging buah merah berair / rasa / kualitas tinggi.
  * **Scene 6 (CTA & Packaging Board)**: Tampilan etalase produk + tombol aksi.
* Setiap scene menghasilkan prompt teks bahasa Inggris terstruktur dengan deskripsi pencahayaan (*lighting*), komposisi (*camera angle*), dan gaya visual (*photorealistic commercial grade*).

### Tahap 4: Multi-Scene Image Generation (Weavy GPT Image 2.5)
* **Engine**: Weavy AI Provider (`/api/generate-weavy` atau `/api/chat-message`).
* **Model**: **GPT Image 2.5** (Default) dengan opsi fallback ke **Seedream 5.0** / **Nano Banana Pro**.
* **Fitur Interaktif**:
  * Generate all scenes sekaligus secara asynchronous dengan concurrency queue (maksimal 2 concurrent request untuk menghindari rate-limit).
  * Tombol re-generate individual per scene jika prompt diubah oleh user.
  * Preview modal beresolusi tinggi dengan fitur crop & refine.

### Tahap 5: Single-Sheet Composite Stitcher (Final Storyboard Sheet)
* **Tujuan**: Menyatukan 6 panel gambar yang sudah digenerate menjadi 1 file gambar tunggal (Grid 3x2 atau 2x3).
* **Fitur Layout**:
  * **Mode A (Canvas HTML5 / Sharp High-Res Stitcher)**: Menggabungkan 6 gambar HD dengan border rapi, badge angka scene, dan teks label/tagline.
  * **Mode B (AI Unified Composite Generation)**: Meminta GPT Image 2.5 / Weavy me-render ulang keseluruhan 6 panel ke dalam satu lembar visual yang padu.
* **Format Ekspor**: PNG / WebP HD, ZIP package (all individual images + 1 composite sheet), atau transfer 1-klik ke **Canvas View** & **Batch View**.

---

## 3. 🧩 Hubungan Komponen & Modul Arsitektur

```
src/
├── components/
│   └── studio/
│       ├── StudioView.tsx                # Halaman Utama Menu Studio
│       ├── StudioVideoIngestCard.tsx     # Form Input Link / File Upload Video
│       ├── StudioAnalysisCard.tsx        # Tampilan Hasil Analisis AI
│       ├── StudioSceneList.tsx           # Grid 6 Kartu Scene Storyboard
│       ├── StudioSceneCard.tsx           # Kartu Individual Scene (Edit, Prompt, Generate)
│       ├── StudioCompositeModal.tsx      # Modal Preview & Konfigurasi Gambar Komposit
│       └── StudioExportBar.tsx           # Bar Aksi Download & Kirim ke Canvas/Batch
├── lib/
│   ├── studioIndexedDb.ts                # Penyimpanan Lokal Proyek Studio di Browser
│   ├── studioPromptBuilder.ts            # Logika Pembuat Prompt AI Storyboard
│   └── studioStitcher.ts                 # Canvas HTML5 Utility Penggabung Multi-Image
└── types/
    └── studio.ts                         # Interface TypeScript Proyek Studio
```

---

## 4. 🔒 Keamanan & Data Persistence

1. **Client-Side Privacy**: Kredensial Weavy dan token tetap terisolasi di server-side proxy (`/server/routes/`).
2. **Tri-Layer Persistence**:
   * **State Aktif**: React State & Context.
   * **Local Storage & IndexedDB**: Riwayat proyek storyboard, cache gambar base64/blob agar tidak hilang saat reload.
   * **Cloud / Sheets Sync**: Sinkronisasi log generasi akun Weavy.
