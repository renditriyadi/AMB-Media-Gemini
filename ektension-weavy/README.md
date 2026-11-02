# Weavy AI Assistant & Multimodal Chat - Chrome Extension

Ekstensi Chrome SidePanel untuk berinteraksi langsung dengan **Weavy AI** menggunakan browser client-side environment (bypassing Cloudflare blocks):

## ✨ Fitur Utama
1. **💬 Multimodal Chat & Prompt Enhancer**:
   - Model AI: **Gemini 3 Pro**, **Gemini 3.1 Pro**, **Claude Sonnet 5**, **Claude Opus 5**, **GPT-5.6 Sol**, **Llama 4**.
   - Multimodal: Unggah atau paste gambar langsung dari clipboard.
   - Slash Command Presets: `/fashion`, `/natural`, `/ugc`, `/clean`, `/video`.
   - Markdown formatting dengan 1-click salin kode prompt.

2. **⚙️ Manajemen Akun & Token Weavy**:
   - Hubungkan akun Weavy menggunakan **Refresh Token (`AMf-...`)**.
   - Otomatis menukar token dengan Firebase Auth (`securetoken.googleapis.com`).
   - Tampilan live saldo koin kredit akun Weavy.
   - Multi-akun: Simpan banyak akun dan beralih akun kapan saja.

3. **🎨 Quick Generate Gambar & Video**:
   - Generator gambar langsung ke Weavy API: **Nano Banana Pro (Google AI)**, **Seedream V5.0 Pro Edit (ByteDance)**, **GPT Image 2.5**, **ChatGPT Images 2.0 Edit**, **Grok Imagine**.
   - Pengaturan aspek rasio (9:16, 16:9, 1:1, 4:3, 3:4), resolusi, dan gambar referensi.

4. **🍌 Google Flow & 🐬 Dola AI (ByteDance) Generator**:
   - **Dola AI Video**: **Dreamina Seedance 2.5**, **Seedance 2.0 Fast**, **Seedance 1.0** (1080p HD, durasi 5s/10s, rasio 9:16, 16:9, dll., ekstraksi video unwatermarked MP4).
   - **Dola AI Image**: **Dola AI (💎 Pro / Seedream 5.0 Pro)** & **Seedream 4.5 (⚡ Fast)**.
   - **Dual-Engine Architecture**: Background Direct API + Smart Tab UI Automation Fallback (melewati proteksi WAF Shark Admin & Slider Captcha ByteDance).
   - **Multimodal Chat & Storyboard Copilot**: Asistensi naskah, breakdown scene, dan integrasi visual.
   - Dokumentasi teknis & arsitektur lengkap tersedia di [`DOLA.md`](./DOLA.md).

## Web App Chat Bridge

Chat Weavy dari web app mengirim sesi dan pesan mentah ke ekstensi. Ekstensi menjalankan Agent V1, pemilihan konteks, preset, serta request Weavy; app tetap mengelola input/sesi, metadata tautan dan lampiran, UI, serta pemrosesan hasil untuk tampilan. Preset yang menghasilkan storyboard diklasifikasikan sebagai tugas storyboard oleh Agent. Aturan katalog media dan analisis tautan serta alur simpan/jalankan/poll Recipe dipakai bersama oleh Chat native dan Chat app. Jika ekstensi tidak aktif atau eksekusi gagal, Chat Weavy menampilkan error dan tidak beralih ke server. Bridge tersedia untuk `localhost`, `127.0.0.1`, dan domain `*.run.app` yang tercantum di manifest.

---

## 🚀 Cara Memasang di Google Chrome / Microsoft Edge

1. Buka browser **Google Chrome** atau **Edge**.
2. Masuk ke halaman ekstensi:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. Aktifkan **Developer mode** (Mode pengembang) di pojok kanan atas.
4. Klik tombol **Load unpacked** (Muat yang belum dibongkar).
5. Pilih folder `/Extension-Weavy` pada direktori proyek ini.
6. Klik ikon ekstensi di toolbar browser atau buka **Side Panel** untuk mulai menggunakan!

---

## 🔑 Cara Mengambil Refresh Token dari Weavy AI

1. Buka **https://app.weavy.ai** di browser dan pastikan akunmu sudah login.
2. Tekan **F12** untuk membuka Developer Tools.
3. Masuk ke tab **Application** &rarr; **IndexedDB** &rarr; cari Firebase database, atau cek tab **Network** &rarr; filter `securetoken` / `token`.
4. Salin string `refreshToken` (yang berawalan `AMf-...`).
5. Buka ekstensi Weavy di Side Panel &rarr; pilih tab **Akun & Token** &rarr; tempelkan token & klik **Verifikasi & Simpan Akun**.
