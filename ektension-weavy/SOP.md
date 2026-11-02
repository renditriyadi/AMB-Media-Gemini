# SOP Pengembangan Feature & Maintenance Proyek

## 1. Tujuan SOP
Dokumen ini berfungsi sebagai standar kerja untuk semua pengembangan, refactor, dan maintenance proyek extension side panel Weavy AI Assistant. Tujuan utamanya adalah menjaga struktur modular, mencegah sidepanel.js membesar, dan memastikan AI atau developer berikutnya bisa melanjutkan proyek tanpa kebingungan.

## 2. Prinsip utama
1. `sidepanel.js` adalah orchestrator, bukan file tempat semua logic fitur.
2. Setiap menu punya folder sendiri di bawah `js/`.
3. Logic umum yang dipakai banyak menu masuk ke `js/core/`.
4. Fitur yang spesifik ke satu menu harus dibuat di helper file di folder menu tersebut.
5. Jika fitur menambah kompleksitas, pindahkan ke file helper atau module baru.
6. Hindari menulis logic bisnis besar di `sidepanel.js`.

## 3. Struktur folder yang wajib dipatuhi
- `js/account/` = akun, auth, session, import akun
- `js/chat/` = chat, media, history, session chat
- `js/generator/` = generate, model, recent generation, reference
- `js/library/` = asset library, picker, role asset, library UI
- `js/storyboard/` = storyboard, review, copilot, intent, render
- `js/core/` = API, storage, parser, util, helper shared

## 4. Aturan kerja saat menambah atau mengubah fitur
### 4.1 Langkah awal
Sebelum edit, tentukan:
- fitur ini masuk ke menu mana?
- spesifik ke menu itu atau shared?
- apakah butuh file helper baru?

### 4.2 Jika fitur spesifik menu
Jika fitur relevan untuk satu menu saja, buat atau perbarui helper di folder menu tersebut.

Contoh:
- storyboard review -> `js/storyboard/storyboard-intent.js`
- chat session -> `js/chat/chat-session.js`
- library asset UI -> `js/library/library-view.js`

### 4.3 Jika fitur dipakai banyak menu
Jika logic dipakai lebih dari satu menu, simpan di `js/core/`.

Contoh:
- API calls
- storage
- parsing response
- utils umum

### 4.4 `sidepanel.js` hanya untuk
- wiring DOM
- routing tab
- event listener
- state global
- memanggil helper/module tertentu

### 4.5 `sidepanel.js` tidak boleh dipakai untuk
- parsing feature spesifik menu
- review storyboard
- formatter khusus menu
- logic validation scene
- logic session fitur
- helper role asset

## 5. Pattern yang wajib diterapkan
### 5.1 Pattern umum
1. Identifikasi menu.
2. Pilih file helper yang sesuai.
3. Tambah atau edit helper tersebut.
4. Jika logic reusable, pindahkan ke `js/core/`.
5. `sidepanel.js` hanya menyambungkan helper ke UI.

### 5.2 Pattern penamaan file
Gunakan nama yang menjelaskan concern utama.

Contoh:
- `storyboard-intent.js`
- `storyboard-copilot.js`
- `library-view.js`
- `chat-session.js`

### 5.3 Pattern import
Import dari module helper ke `sidepanel.js` atau module lain, bukan menulis ulang logic di beberapa tempat.

## 6. Kriteria kode yang diterima
Sebelum commit atau lanjut ke fitur berikutnya, kode harus memenuhi kriteria berikut:
- tidak ada logic fitur besar di `sidepanel.js`
- file helper punya tujuan jelas
- fungsi terbagi sesuai concern
- tidak ada duplikasi logic yang signifikan
- shared logic masuk ke `js/core/`
- nama file dan fungsi mudah dipahami oleh AI atau developer baru

## 7. Checklist sebelum menutup task
- [ ] Fitur ini masuk ke menu mana?
- [ ] Logic ini spesifik menu atau shared?
- [ ] Kalau spesifik, helper sudah dibuat/diupdate di folder menu?
- [ ] Kalau shared, helper sudah ada di `js/core/`?
- [ ] `sidepanel.js` tidak berisi logic fitur yang panjang?
- [ ] Nama file dan fungsi jelas?
- [ ] Refactor aman dan tidak mengganggu flow lainnya?

## 8. Pedoman untuk AI / developer berikutnya
Saat melanjutkan project, selalu mulai dari pertanyaan ini:
- ini fitur menu apa?
- ini spesifik untuk menu itu?
- kalau iya, buat helper di folder menu terkait
- kalau tidak, letakkan di `js/core/`
- jangan menambah logika besar ke `sidepanel.js`

## 9. Target maintainability
Tujuan utama SOP ini adalah agar project tetap modular, rapi, dan mudah dilanjutkan. Ketika sesi chat berubah atau AI lain mengambil alih project, mereka harus langsung tahu:
- `sidepanel.js` bukan tempat semua fitur
- modul dibagi berdasarkan menu
- shared logic ada di `js/core/`
- maintenance dan pengembangan berikutnya lebih aman dan cepat

## 10. Kesimpulan
Semua fitur baru harus dibangun dengan prinsip modular. Jika mengikuti SOP ini, project akan tetap scalable dan tidak menumpuk logic di satu file besar.
