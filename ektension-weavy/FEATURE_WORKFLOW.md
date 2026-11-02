# Feature Workflow Guide

## Tujuan
Dokumen ini menjelaskan alur yang benar saat menambah fitur baru ke project extension side panel. Tujuannya agar struktur modular tetap terjaga dan `sidepanel.js` tidak berubah menjadi file raksasa.

## Prinsip dasar
Setiap fitur harus masuk ke satu dari tiga kategori berikut:

1. Menu-specific logic
   - logic yang hanya relevan untuk satu menu
   - dibuat di folder menu terkait

2. Shared logic
   - logic yang dipakai lebih dari satu menu
   - dibuat di `js/core/`

3. UI orchestration
   - hanya wiring tombol, tab, state, dan pemanggilan helper
   - dikerjakan di `sidepanel.js`

## Aturan dasar
### 1. Tentukan menu terlebih dahulu
Sebelum menulis kode, jawab pertanyaan ini:
- Fitur ini untuk menu chat?
- menu storyboard?
- menu library?
- menu generator?
- menu account?

Jika jawabannya jelas, maka fitur itu milik folder menu itu.

### 2. Jika fitur spesifik menu, buat helper di folder menu
Contoh:
- storyboard -> `js/storyboard/`
- library -> `js/library/`
- generator -> `js/generator/`
- account -> `js/account/`
- chat -> `js/chat/`

### 3. Jika fitur dipakai banyak menu, pindahkan ke `js/core/`
Contoh:
- API
- storage
- response parse
- util umum
- helper shared

### 4. `sidepanel.js` hanya berisi orchestrator
`sidepanel.js` boleh mengandung:
- event listener
- routing tab
- state global
- memanggil helper fungsi
- menghubungkan UI ke module

`sidepanel.js` tidak boleh mengandung:
- parsing intent yang spesifik menu
- review storyboard
- validation scene
- helper role asset
- logic chat session panjang
- formatter khusus fitur tertentu

## Rekomendasi struktur fitur baru
### A. Untuk menu storyboard
Buat helper jika fitur tergolong:
- review storyboard
- intent parsing
- project draft builder
- scene validation
- copilot command routing

Contoh file yang cocok:
- `js/storyboard/storyboard-intent.js`
- `js/storyboard/storyboard-review.js`
- `js/storyboard/storyboard-copilot.js`
- `js/storyboard/storyboard-render.js`

### B. Untuk menu library
Buat helper jika fitur tergolong:
- asset UI
- role mapping
- asset filters
- image source picker
- upload asset

Contoh file:
- `js/library/library-view.js`
- `js/library/image-source-picker.js`

### C. Untuk menu generator
Buat helper jika fitur tergolong:
- model control
- recent generation
- reference gallery
- prompt builder
- generation workspace

Contoh file:
- `js/generator/model-controls.js`
- `js/generator/recent-generations.js`
- `js/generator/reference-gallery.js`
- `js/generator/dola-generation.js` (Dola AI Video, Image, Chat, & Cloud Upload)
- `js/generator/flow-generation.js` (Google Flow Generation)

### D. Untuk menu chat
Buat helper jika fitur tergolong:
- chat session management
- chat media & rendering
- provider & model catalog/filter

Contoh file:
- `js/chat/chat-session.js`
- `js/chat/chat-media.js`
- `js/chat/chat-render.js`
- `js/chat/chat-provider-model.js` (Provider Weavy/Dola & Model filtering)

### E. Untuk menu account
Buat helper jika fitur tergolong:
- auth flow
- session sync
- account import
- account state

Contoh file:
- `js/account/account-auth.js`
- `js/account/account-manager.js`
- `js/account/account-session.js`

### E. Untuk menu chat
Buat helper jika fitur tergolong:
- sesi chat
- riwayat chat
- message formatting
- media parser

Contoh file:
- `js/chat/chat-session.js`
- `js/chat/chat-media.js`
- `js/chat/chat-render.js`

## Flow checklist saat membuat fitur baru
1. Tentukan menu fitur.
2. Apakah fitur ini spesifik untuk menu itu? Jika ya, buat helper di folder menu.
3. Apakah fitur dipakai di beberapa menu? Jika ya, pindahkan ke `js/core/`.
4. `sidepanel.js` hanya import fungsi dan menghubungkan UI.
5. Jangan menulis logic panjang di `sidepanel.js`.
6. Jika file helper sudah ada, update helper tersebut, bukan menambah logic baru di file utama.

## Contoh yang benar
### Benar
- `sidepanel.js` -> import `renderLibraryUi` dari `js/library/library-view.js`
- `sidepanel.js` -> import `buildStoryboardCopilotIntentAction` dari `js/storyboard/storyboard-intent.js`
- `sidepanel.js` -> import `persistChatSessions` dari `js/chat/chat-session.js`

### Salah
- menulis review storyboard di `sidepanel.js`
- menaruh parsing image role di `sidepanel.js`
- membuat helper generik yang sebenarnya fitur storyboard di file global

## Standar output yang diharapkan
Setiap perubahan fitur harus menghasilkan:
- helper yang punya concern jelas
- fungsi modular dan bisa dipanggil ulang
- code yang mudah dibaca oleh AI atau developer baru
- ukuran `sidepanel.js` tetap terkendali

## Pengingat final
Kalau ragu, gunakan aturan ini:
- menu spesifik -> folder menu
- shared banyak menu -> `js/core/`
- UI wiring + state global -> `sidepanel.js`

Jangan bikin `sidepanel.js` menjadi tempat semua logika proyek.
