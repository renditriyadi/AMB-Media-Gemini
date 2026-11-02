# 🎨 STUDIO UI/UX DESIGN & INTERACTION FLOW

Dokumen ini mendefinisikan rancangan antarmuka visual, interaksi pengguna, komponen desain, dan alur kerja di dalam menu **Studio**.

---

## 1. 🖥️ Layout & Tampilan Antarmuka Utama

Antarmuka Studio dirancang dengan tata letak modular 4 bagian yang mengalir dari atas ke bawah:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🎬 STUDIO - AI Video-to-Storyboard & Visual Production Pipeline            │
├─────────────────────────────────────────────────────────────────────────────┤
│ 📥 1. VIDEO INGESTION & CONTROLS                                            │
│ [ 🔗 Masukkan URL TikTok/Reels...          ] [ 📁 Upload Video ] [ ANALISIS] │
├─────────────────────────────────────────────────────────────────────────────┤
│ 💡 2. AI STRATEGIC ANALYSIS SUMMARY                                         │
│ ┌───────────────────────────┬────────────────────────────┬────────────────┐ │
│ │ 🎯 Hook: Direct Recom     │ 📦 Produk: Semangka Gajah  │ 💰 USP: Jumbo  │ │
│ └───────────────────────────┴────────────────────────────┴────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🖼️ 3. SCENE STORYBOARD GRID & GENERATION (6 PANELS)                         │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                          │
│ │ [Scene 1]    │ │ [Scene 2]    │ │ [Scene 3]    │  [⚡ Generate All Images] │
│ │ Hook Buah    │ │ Biji & Paket │ │ Kebun Subur  │                          │
│ │ [Preview/Gen]│ │ [Preview/Gen]│ │ [Preview/Gen]│                          │
│ ├──────────────┤ ├──────────────┤ ├──────────────┤                          │
│ │ [Scene 4]    │ │ [Scene 5]    │ │ [Scene 6]    │                          │
│ │ Panen Jumbo  │ │ Belahan Rasa │ │ Etalase CTA  │                          │
│ │ [Preview/Gen]│ │ [Preview/Gen]│ │ [Preview/Gen]│                          │
│ └──────────────┘ └──────────────┘ └──────────────┘                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🚀 4. FINAL COMPOSITE BOARD & EXPORT ACTION BAR                             │
│ [ 🖼️ Preview Composite 1-Sheet ] [ 💾 Download ZIP ] [ 📤 Send to Batch ]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 🧩 Komponen-Komponen Studio

### A. `StudioVideoIngestCard`
* **Input URL**: Kolom pencarian responsif untuk paste tautan TikTok (`vt.tiktok.com`, `tiktok.com/@.../video/...`), Instagram Reels, atau YouTube Shorts.
* **Dropzone Upload**: Area seret & lepas (*drag and drop*) untuk berkas video lokal (format MP4, MOV, WebM).
* **Opsi Parameter**:
  * Jumlah Scene: Pilihan 4, 6 (Rekomendasi Default), atau 8 Scene.
  * Model Generasi Gambar: Pilihan Weavy GPT Image 2.5 (Default), Seedream 5.0, Grok Imagine.
  * Rasio Aspek Gambar: 9:16 (Vertikal TikTok/Reels), 16:9 (Landscape YouTube), atau 1:1 (Square).

### B. `StudioAnalysisCard`
* Kartu informasi yang merangkum hasil analisis LLM:
  * **Pilar Hook**: Mengapa 3 detik pertama memikat audiens.
  * **Value Proposition**: Nilai jual utama produk / topik video.
  * **Proof Strategy**: Mengapa bukti visual (belahan buah / timbangan) penting.
  * **CTA Direction**: Petunjuk aksi konversi penjualan.

### C. `StudioSceneCard` (Kartu Scene Interaktif)
Setiap kartu scene memuat:
* **Badge Nomor Scene**: `Scene 1`, `Scene 2`, dst.
* **Judul & Deskripsi Visual**: Keterangan apa yang terjadi di adegan tersebut.
* **Prompt Editor**: Kolom teks prompt bahasa Inggris yang dapat diedit langsung oleh user sebelum digenerate.
* **Image Canvas Box**:
  * State Kosong: Placeholder dengan tombol **"Generate Scene"**.
  * State Generating: Animasi loading / progress shimmer Weavy AI.
  * State Berhasil: Gambar hasil render berkualitas tinggi dengan kontrol *Zoom Preview*, *Re-generate*, dan *Copy Prompt*.

### D. `StudioCompositeModal`
* Menampilkan pratinjau lembar komposit tunggal (*Single-Sheet 6-Panel Storyboard*) seperti poster iklan komersial.
* Opsi Kustomisasi:
  * Grid: 3 Kolom x 2 Baris (Default) atau 2 Kolom x 3 Baris.
  * Tampilkan Badge Nomor Scene: Toggle ON/OFF.
  * Tampilkan Judul & Tagline: Toggle ON/OFF.
  * Warna Border & Spacing: Slider ketebalan garis pembatas.
* Tombol Aksi:
  * **Download Single Sheet HD** (Resolusi 4K / 2K).
  * **Download All Scene Images (ZIP)**.
  * **Kirim Semua Gambar ke Batch View (Jadikan Video AI)**.
  * **Buka di Canvas Node Graph**.

---

## 3. 🎨 Panduan Visual & Gaya Desain
* **Dark / Light Harmony**: Latar belakang bersih dengan aksen emerald/indigo yang modern dan tidak silau.
* **Mikro-Interaksi**: Animasi fade-in saat scene digenerate dan transisi mulus saat berpindah status.
* **Respon Cepat**: Penyimpanan otomatis ke IndexedDB setiap kali user mengedit prompt atau menghasilkan gambar baru.
