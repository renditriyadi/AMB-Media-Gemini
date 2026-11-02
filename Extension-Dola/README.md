# Dola Video Grabber & Downloader (Split Screen Side Panel)

Ekstensi Chrome / Edge / Brave untuk mendeteksi, menampilkan, dan mengunduh video AI hasil generate dari **Dola (dola.com)** langsung dari master CDN ByteDance **100% TANPA WATERMARK (1080p Full HD)** dengan tampilan **Split Screen** (Halaman Dola di sebelah kiri, Panel Downloader di sebelah kanan).

---

## 🔍 Kenapa Sebelumnya Masih Ada Watermark?

Dola AI di web memiliki 2 file berbeda di CDN ByteDance:
1. **File Web Player / Default Download**:
   - File ini sudah di-transcode oleh server Dola dengan logo watermark **"Dola AI"** yang dibakar (burned-in) ke dalam frame video (path contoh: `tos-mya-ve-50851/o0FNDEwO...`). Mengubah parameter URL saja (`lr=unwatermarked`) tidak akan menghilangkan watermark pada file ini karena videonya memang sudah mengandung logo.
2. **File Master CDN Asli (Clean / Unwatermarked)**:
   - File master asli ini tersimpan di dalam objek `video_model -> video_list -> video_1 -> main_url` (Base64 encoded) yang dikirimkan oleh API internal Dola (path contoh: `tos-mya-ve-50851/o4XDFBOZ...`).
   - File ini memiliki resolusi **1080p Full HD** dan **100% BERSIH TANPA WATERMARK**!

**Pembaruan Ekstensi:**
Ekstensi sekarang dilengkapi modul **API Synchronizer & Direct Master Extractor**:
- Begitu halaman Dola atau panel dibuka, ekstensi langsung meminta data percakapan ke API internal Dola (`/im/chain/recent_conv`).
- Mengekstrak link master `main_url` unwatermarked asli dari ByteDance CDN.
- Memberikan badge hijau **✨ 1080p Master (Tanpa Watermark)**.
- Tombol overlay di atas video chat dan tombol di Side Panel akan langsung mengunduh file master bersih ini.

---

## 🌟 Fitur Utama

1. **Split-Screen Side Panel Asli**:
   - Berjalan di bilah samping (Side Panel) Chrome / Edge.
   - Halaman `dola.com/chat` tetap terbuka penuh di sebelah kiri, sementara panel video terbuka di sebelah kanan tanpa saling menutupi.
2. **Direct Master CDN (100% Zero Watermark)**:
   - Mengambil URL master resolusi tertinggi (`1080p`) langsung dari `video_model.video_list.main_url`.
   - Menggunakan protokol aman **HTTPS**.
3. **1-Click Download (MP4)**:
   - Tombol download langsung menyimpan video ke folder `Downloads/Dola_Downloads/` dengan format MP4 resolusi penuh.
4. **Overlay Button di Atas Video Chat**:
   - Di setiap kartu video di chat Dola, ekstensi menyisipkan tombol **⚡ Download No Watermark (1080p)** yang terhubung langsung ke link master CDN.
5. **Tombol Scan & Sync Otomatis**:
   - Tombol **Scan** di Side Panel langsung menyinkronkan daftar percakapan dan mengambil link tanpa watermark untuk semua video yang ada di akunmu.

---

## 🚀 Cara Update / Pasang di Browser (Chrome / Edge / Brave)

1. Buka browser dan buka menu ekstensi:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
2. Pastikan **Developer mode** di pojok kanan atas dalam kondisi **ON**.
3. Jika sudah pernah memasang ekstensi sebelumnya:
   - Cari kartu **Dola Video Grabber & Downloader**.
   - Klik tombol **🔄 Refresh / Reload** pada kartu ekstensi tersebut.
   *(Jika baru pertama kali, klik **Load unpacked** dan pilih folder `Extension-Dola`)*.
4. Kembali ke tab `https://www.dola.com/chat/` lalu **refresh halaman (F5 atau Ctrl+R)** agar script interceptor terbaru aktif.
5. Buka Side Panel (klik icon ekstensi atau tombol melayang di pojok kanan bawah).
6. Klik tombol **Scan** di Side Panel:
   - Semua video akan termuat dengan label hijau **✨ 1080p Master (Tanpa Watermark)**.
   - Klik **Download Clean (MP4)**, video yang diunduh dipastikan 100% bersih tanpa watermark!
