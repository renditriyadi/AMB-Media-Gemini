# Rencana & Dokumentasi Update: Dola AI Silent Background Stream & Dual Fallback

Dokumen ini menjelaskan arsitektur, pembaruan file, serta mekanisme kerja fitur Dola AI yang bekerja **di background tanpa gerakan DOM** (silent execution) mirip provider Weavy, lengkap dengan dual fallback (API -> DOM Automation) dan dukungan mode tamu (guest tanpa login).

---

## 1. Latar Belakang & Masalah
- **Masalah DOM Automation Lama**: 
  - Kursor melompat dan mengetik otomatis pada elemen `div.tiptap.ProseMirror`.
  - Mengganggu fokus pengguna saat membuka tab browser lain.
  - Sering gagal bila elemen UI berubah atau sedang tertutup modal.
- **Masalah Direct Script / Server**:
  - Request API langsung dari luar browser diblokir oleh WAF / bot detector Dola (`HTTP 200` dengan error `710022002: high demand / login invalid`).
- **Solusi**:
  - Memanfaatkan tab Dola yang sudah terbuka di browser Chrome pengguna.
  - Request dijalankan melalui **Tab Context Bridge** menggunakan cookie dan session asli (`ttwid`, `tea_uuid`, `s_v_web_id`).
  - **100% Silent**: Menggunakan streaming fetch (`SSE / Server-Sent Events`) tanpa menyentuh DOM.
  - **Dual Fallback**: Jika endpoint API ditolak atau struktur response berubah, sistem otomatis beralih (*fallback*) ke DOM automation (`DolaDomFallback`).

---

## 2. Daftar File yang Diperbarui

### 1) `ektension-weavy/content-bridge.js`
- **Tugas**: Berjalan di dalam tab Dola (`https://www.dola.com/*`).
- **Pembaruan**:
  - Menangani aksi `EXECUTE_PAGE_STREAM_FETCH`: Memanggil `fetch()` dengan `credentials: 'include'` langsung dari window Dola, membaca chunk stream via `ReadableStreamDefaultReader` dan mengirimkannya via `chrome.runtime.sendMessage` (`STREAM_CHUNK`, `STREAM_DONE`, `STREAM_ERROR`).
  - Menangani aksi `EXECUTE_DOM_FALLBACK`: Menyediakan jalur darurat jika API gagal, mengetikkan prompt ke `div.tiptap.ProseMirror`, mengklik tombol kirim, dan memantau gelembung chat balasan.

### 2) `ektension-weavy/background.js`
- **Tugas**: Service worker ekstensi yang menghubungkan Sidepanel dan tab Dola.
- **Pembaruan**:
  - Menangani `FIND_DOLA_TAB`: Mendeteksi tab `dola.com` yang sedang aktif.
  - Menangani `OPEN_DOLA_TAB`: Membuka atau memfokuskan tab `dola.com/chat`.
  - Menangani `EXECUTE_DOLA_TAB_STREAM_FETCH`: Meneruskan permintaan stream dari Sidepanel ke Content Bridge tab Dola.
  - Menangani `GET_DOLA_COOKIES`: Memeriksa status login (`sessionid` / `sid_tt`) atau status Guest.

### 3) `ektension-weavy/js/generator/dola-generation.js`
- **Tugas**: Engine utama pembuatan video & gambar Dola.
- **Pembaruan**:
  - `generateSilent(prompt, options)`: Mengirim payload completion melalui Tab Stream Bridge.
  - Parsing real-time teks delta / response streaming.
  - **Fallback Otomatis**: Jika request stream ditolak atau tab API error, memanggil `fallbackDomExecution(prompt, options)`.

### 4) `ektension-weavy/js/chat/chat-provider-model.js`
- **Tugas**: Manajemen percakapan dan perutean pesan chat (Weavy vs Dola).
- **Pembaruan**:
  - `sendMessageToDola(prompt, onChunk, onDone, onError)`: Mengirim chat teks via silent background stream.
  - Menerima chunk teks dan memperbarui pesan assistant di UI sidepanel secara live.
  - Fallback ke `EXECUTE_DOM_FALLBACK` bila stream tab API terputus.

### 5) `ektension-weavy/DOLA.md`
- **Tugas**: Dokumentasi arsitektur Dola integration pada ekstensi.
- **Pembaruan**:
  - Memperbarui penjelasan arsitektur: Direct Background Tab API sebagai jalur primer, DOM Automation sebagai jalur sekunder.

---

## 3. Alur Kerja (Workflow)

```
[Sidepanel Weavy]
      │
      ├─► 1. Periksa tab Dola (`FIND_DOLA_TAB`)
      │      └─ Jika belum ada: minta user buka / buka otomatis di latar.
      │
      ├─► 2. Kirim pesan chat / perintah generate
      │      │
      │      ▼ (Jalur Utama: Silent Stream API)
      │      [Content Bridge Tab Dola]
      │      ├─ fetch('/chat/completion', { credentials: 'include' })
      │      ├─ Baca SSE chunks (STREAM_CHUNK)
      │      └─ Kirim update live ke Sidepanel (tanpa menggerakkan kursor)
      │
      └─► 3. Jika API gagal / dibatasi
             │
             ▼ (Jalur Fallback: DOM Automation)
             [Content Bridge Tab Dola]
             ├─ Cari elemen input: div.tiptap.ProseMirror
             ├─ Isi prompt dan simulasi Enter / klik kirim
             └─ Observasi bubble respon balasan
```

---

## 4. Keuntungan bagi Pengguna
1. **Tidak Ada Layar Gerak-Gerak**: Pengguna bisa tetap browsing di tab lain tanpa kursor tergeser atau terganggu.
2. **Support Mode Guest (Tanpa Akun)**: Pengguna yang tidak login tetap bisa ngobrol dan berdiskusi ide prompt langsung.
3. **Respon Cepat**: Teks balasan mengalir seketika (*streaming*) langsung di panel samping.
4. **Tahan Gangguan**: Selalu ada jalur cadangan (DOM automation) jika Dola memperbarui struktur API mereka.
