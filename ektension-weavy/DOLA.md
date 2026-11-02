# 📖 Dokumentasi Lengkap Dola AI Generator (ByteDance / Doubao)

Dokumen ini adalah referensi teknis dan operasional resmi untuk modul integrasi **Dola AI (`dola-generation.js`)** pada Chrome Extension **Weavy AI Assistant**.

---

## 🌟 1. Ikhtisar & Arsitektur Sistem (Silent Background Stream & Dual Fallback)

Modul Dola AI (`ektension-weavy/js/generator/dola-generation.js`) menyediakan integrasi lengkap dengan platform AI dari ByteDance (**dola.com** / Doubao) yang mendukung:
1. **Generasi Video AI** (Dreamina SeaDance 2.5, SeaDance 2.0 Fast, SeaDance 1.0)
2. **Generasi Gambar AI** (Seedream 5.0 Pro Edit, Seedream 4.5 Fast)
3. **Multimodal Chat & Storyboard Copilot** (Dola Fast & Dola Pro)
4. **Cloud Media Upload Pipeline** (Volcengine veImageX + ByteDance TOS)

### 🛡️ Dual Fallback Architecture:
Sistem menggunakan pola arsitektur **Tab Context Bridge**:
1. **Primary Route (Silent Background Stream API via Tab Bridge)**:
   - Request streaming dikirimkan melalui tab Dola yang berjalan di background (`active: false`).
   - Eksekusi `fetch` berjalan langsung di konteks tab Dola (`content-bridge.js`) dengan opsi `credentials: 'include'`.
   - **100% Lolos Proteksi WAF / Anti-bot ByteDance**: Membawa cookies asli (`sessionid` untuk user login, atau `ttwid` / `tea_uuid` / `s_v_web_id` untuk mode Guest), TLS fingerprint browser asli, dan header autentik tanpa memicu error `710022002` atau `710022004`.
   - **Zero DOM Movement**: Tidak ada kursor melompat, tidak mengetik ke input editor, pengguna bebas multitasking tanpa gangguan.
   - Mengalirkan chunk teks delta realtime (`ReadableStreamDefaultReader` -> `STREAM_CHUNK` -> `onChunk`).

2. **Secondary Route (Smart Tab DOM Automation Fallback)**:
   - Jika endpoint background streaming ditolak, mengalami timeout, atau WAF slider captcha muncul, sistem secara otomatis dan mulus beralih ke jalur cadangan **DOM Automation Fallback** (`executeDolaChatViaTab` / `executeDolaViaTabAutomation`).
   - Mengetik ke dalam editor ProseMirror/TipTap (`div.tiptap.ProseMirror`) dan memantau bubble chat respon.

---

## 🚀 2. Alur Komunikasi Tab Context Bridge

```
[Sidepanel UI]
      │
      │ 1. Kirim payload chat / stream task
      ▼
[background.js (Service Worker)]
      │
      │ 2. Deteksi tab Dola (active: false di background) & ensure bridge
      ▼
[content-bridge.js (In-Tab Context)]
      │
      │ 3. fetch('https://www.dola.com/chat/completion', { credentials: 'include' })
      ▼
[ByteDance Dola API Gateway]
      │
      │ 4. Response SSE Chunk Stream
      ▼
[content-bridge.js]
      │
      │ 5. chrome.runtime.sendMessage({ action: 'STREAM_CHUNK', chunk })
      ▼
[Sidepanel UI (onChunk)] ──> Teks mengalir live secara realtime!
```

---

## 🎬 3. Spesifikasi Model & Fitur Generator

### A. Model Video (SeaDance / Dreamina)
| Nama Model | ID Internal | Resolusi | Opsi Durasi | Aspek Rasio yang Didukung | Keterangan |
|---|---|---|---|---|---|
| **Dreamina Seedance 2.5** | `seedance_v2.5` | 1080p HD | 5s / 10s | 9:16, 16:9, 1:1, 4:3, 3:4, 21:9 | Kualitas sinematik tertinggi, multi-scene motion |
| **Dreamina Seedance 2.0 Fast** | `seedance_v2.0_fast` | 1080p HD | 5s / 10s | 9:16, 16:9, 1:1, 4:3, 3:4, 21:9 | Render cepat dan konsisten |
| **Dreamina Seedance 1.0** | `seedance_v1.0` | 720p / 1080p | 5s / 10s | 9:16, 16:9, 1:1, 4:3, 3:4, 21:9 | Model stabil generasi awal |

#### Fitur Khusus Video:
- **Image-to-Video (Multimodal Reference)**: Mendukung hingga 3 gambar referensi sebagai awalan frame, karakter, atau scene.
- **Unwatermarked 1080p Video Extraction**: Fungsi `extractUnwatermarkedDolaVideoUrl` secara cerdas mengekstrak URL MP4 mentah tanpa watermark ByteDance.
- **Silent Background Creation**: Mengirim pembuatan video secara silent via Tab Bridge dan memantau penyelesaian video via polling `/im/chain/recent_conv`. Jika gagal, beralih ke DOM automation.

---

### B. Model Gambar (Seedream / Dola Image)
| Nama Model | Tier | ID Internal | Skill Bar Dola | Karakteristik |
|---|---|---|---|---|
| **Dola AI (💎 Pro)** | Pro | `pro` / `seedream_v5.0` | **Suppressed (Tanpa Skill)** | Generasi gambar multimodal pro tingkat tinggi (Seedream 5.0 Pro) |
| **Seedream 4.5 (⚡ Fast)** | Fast | `seedream_v4.5` | **Skill 3 (`Create Images`)** | Generasi cepat untuk kebutuhan gambar harian |

#### ⚠️ Aturan Khusus Pro Mode vs Skill 3:
Pada platform web Dola AI:
- Mode **Pro** adalah mode multimodal terpadu. **JANGAN mengaktifkan Skill 3 ("Create Images") di Pro Mode**, karena mengaktifkan Skill 3 akan memaksa antarmuka Dola beralih kembali ke Fast Mode!
- Sebaliknya, pada mode **Fast**, Skill 3 diaktifkan agar parameter model Seedream 4.5 dan rasio gambar muncul di toolbar.

---

### C. Multimodal Chat & Storyboard Copilot
- Fungsi `executeDolaChat`:
  - Menggunakan `generateSilent` sebagai rute utama (0 gerakan kursor, 100% background stream).
  - Mendukung mode **Fast** dan **Pro**.
  - Mengalirkan respons secara real-time (`onChunk`).
  - Mendukung lampiran gambar referensi (Base64 atau Data URL).
  - Terintegrasi penuh dengan Copilot Storyboard di `sidepanel.js` untuk menganalisis naskah, menyusun scene, dan memberikan arahan visual.
  - Memiliki fallback otomatis ke `fallbackDomExecution` jika terjadi kendala pada streaming API.

---

## ☁️ 4. Pipeline Upload Media Cloud (veImageX + TOS)

Jika gambar referensi diunggah melalui API background, modul menjalankan 4 tahap handshake ByteDance Cloud:

```
[File Gambar Lokal]
       │
       ▼ (1) POST /alice/resource/prepare_upload (dola.com)
  [Dola API] ─── Mengembalikan STS Auth Token, ServiceId ("uo7y4d541q"), Upload Host
       │
       ▼ (2) GET /?Action=ApplyImageUpload (imagex-ap-southeast-1.bytevcloudapi.com)
             (Tandatangan AWS4-HMAC-SHA256 + Session Token)
[veImageX Gateway] ─── Mengembalikan StoreUri, UploadHosts, Auth JWT, SessionKey
       │
       ▼ (3) PUT binary ke ByteDance TOS (https://tos-mya*-share.vodupload.com/{StoreUri})
   [TOS Bucket] ─── Simpan binary payload & verifikasi Content-CRC32
       │
       ▼ (4) POST /?Action=CommitImageUpload (imagex-ap-southeast-1.bytevcloudapi.com)
[veImageX Gateway] ─── Validasi SessionKey & Daftarkan URI gambar
       │
       ▼ (5) Hasil: StoreUri valid (tos-mya-i-uo7y4d541q/xxxxxx.jpg)
```

---

## 🤖 5. Mekanisme Otomasi Cadangan (`fallbackDomExecution` & `executeDolaViaTabAutomation`)

Ketika terjadi fallback darurat ke tab browser:
1. **Pemeriksaan & Pembukaan Tab**: Memeriksa apakah ada tab Dola (`*://dola.com/*` atau `*://*.dola.com/*`). Jika belum terbuka, otomatis membuka tab baru di background.
2. **Trigger Percakapan Baru**: Mencari tombol *"New Chat"* di sidebar Dola jika diperlukan sesi segar.
3. **Deteksi Editor Teks**: Mencari elemen editor ProseMirror / TipTap (`div.tiptap.ProseMirror`, `[contenteditable="true"]`).
4. **Pengetikan Prompt & Submit**: Menginjeksi prompt ke dalam ProseMirror node dengan event `input`, `compositionend`, dan dispatch klik tombol submit.
5. **Polling Status & Ekstraksi Hasil**: Memantau DOM untuk mendeteksi respon teks assistant atau hasil render media.

---

## 📁 6. Referensi File Terkait

| File Path | Peran & Deskripsi |
|---|---|
| `ektension-weavy/content-bridge.js` | Content Script di tab Dola: mengeksekusi `EXECUTE_PAGE_STREAM_FETCH` dan `EXECUTE_DOM_FALLBACK` |
| `ektension-weavy/background.js` | Service worker background: mengelola tab Dola, routing message, dan declarativeNetRequest |
| `ektension-weavy/js/generator/dola-generation.js` | Modul utama Dola AI (`generateSilent`, `executeDolaChat`, `fallbackDomExecution`, dsb.) |
| `ektension-weavy/js/chat/chat-provider-model.js` | Perutean provider chat & fungsi pembungkus `sendMessageToDola` |
| `ektension-weavy/sidepanel.js` | Orchestrator UI: menghubungkan pilihan model Dola di UI ke generator & chat |

---

## 🛠️ 7. Panduan Troubleshooting & FAQ

1. **Apakah harus login ke Dola AI?**:
   - Ekstensi mendukung akun yang sudah **Login** maupun mode **Guest** tanpa login. Sesi dan cookie browser Dola (`ttwid`, `tea_uuid`) otomatis dibawa oleh Tab Context Bridge.
2. **Bagaimana jika tab Dola belum terbuka?**:
   - Ekstensi akan otomatis membuka tab `https://www.dola.com/chat` secara tersembunyi di background (`active: false`) sehingga Anda tidak akan terganggu saat bekerja.
3. **Apakah kursor mouse akan melompat saat chat berlangsung?**:
   - **TIDAK**. Dengan implementasi Silent Background Stream, proses generasi chat berjalan 100% di background melalui API streaming tanpa menyentuh DOM. Layar pengguna tetap tenang dan bebas gangguan.
