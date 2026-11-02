# AGENTS.md

## Tujuan proyek
Proyek ini adalah Chrome extension side panel untuk Weavy AI Assistant. Struktur kode harus tetap modular, terpisah per fitur, dan mudah di-maintain walaupun fitur terus berkembang.

## Prinsip utama
1. Jangan membebani `sidepanel.js` dengan logic fitur yang spesifik untuk satu menu.
2. `sidepanel.js` hanya bertugas sebagai orchestrator utama: wiring DOM, routing tab, event handler, dan pemanggilan module khusus.
3. Logic tiap menu harus dibuat di folder masing-masing di bawah `js/`.
4. Logic umum yang dipakai banyak menu harus masuk ke `js/core/`.
5. Jika fungsi menambah panjang dan bersifat spesifik ke satu menu, pindahkan ke helper file khusus.

## Struktur folder yang harus diikuti
- `js/account/` untuk login, akun, token, session akun
- `js/chat/` untuk chat, message, media, session chat
- `js/generator/` untuk generate image/video, reference, model catalog, recent generations
- `js/library/` untuk asset library, source picker, role asset
- `js/storyboard/` untuk storyboard, copilot, render, review, intent, dan helper storyboard
- `js/core/` untuk util umum, storage, API, response parsing

## Aturan edit kode
### A. File `sidepanel.js`
Hanya edit `sidepanel.js` jika:
- mengubah wiring DOM
- menambah event listener
- mengubah tab routing
- mengubah state global
- memanggil fungsi module tertentu

Jangan menaruh logic seperti:
- parsing intent
- review storyboard
- helper role asset
- formatter khusus menu
- validate scene
- session logic fitur

Jika logic tersebut cocok untuk menu tertentu, pindah ke file helper di folder menu yang sesuai.

### B. File helper per menu
Setiap fitur harus dibuat dalam file module yang sesuai, contohnya:
- `js/storyboard/storyboard-intent.js` untuk intent parsing dan review lokal
- `js/storyboard/storyboard-copilot.js` untuk chat session dan interaksi Copilot
- `js/library/library-view.js` untuk UI library
- `js/chat/chat-session.js` untuk session chat

Setiap helper harus:
- punya satu concern utama
- export fungsi yang jelas
- bisa dipanggil dari `sidepanel.js` atau modul lain
- tidak menambahkan logic global yang semrawut

### C. File `js/core/`
Gunakan folder ini untuk:
- storage
- API call
- parsing response
- util general
- helper yang dipakai lebih dari satu menu

## Pattern yang disarankan saat menambah fitur baru
1. Tentukan fitur masuk ke menu mana.
2. Buat file helper baru di folder menu terkait jika fitur itu spesifik.
3. Jika fitur dibutuhkan di banyak menu, pindah ke `js/core/`.
4. Import fungsi dari helper ke `sidepanel.js`.
5. `sidepanel.js` hanya memanggil fungsi dan menghubungkan UI.

## Contoh yang benar
Contoh yang benar:
- `sidepanel.js` -> import `buildStoryboardCopilotIntentAction` dari `js/storyboard/storyboard-intent.js`
- `sidepanel.js` -> import `renderLibraryUi` dari `js/library/library-view.js`
- `sidepanel.js` -> import `persistChatSessions` dari `js/chat/chat-session.js`

Contoh yang salah:
- menulis semua fungsi review, routing, parsing, dan validation di `sidepanel.js`
- membuat helper generik yang berisi logic khusus storyboard di file global tanpa folder menu

## Target maintainability
Tujuan utama dari struktur ini adalah agar ketika sesi chat/generasi berubah atau AI lain melanjutkan project, mereka tidak perlu menebak-nebak lagi. Mereka langsung tahu:
- file utama `sidepanel.js` tidak boleh dipenuhi logic fitur
- fitur dipisah sesuai menu
- helper khusus dibuat di folder relevan
- shared logic berada di `js/core/`

## Aturan final untuk AI / contributor
Saat mengubah project, selalu mulai dari pertanyaan ini:
- ini fitur menu apa?
- apakah logic ini spesifik untuk menu itu?
- jika ya, buat helper baru di folder menu itu
- jika tidak, letakkan di `js/core/`
- jangan menambah logika besar ke `sidepanel.js`

Semua perubahan harus menjaga modularitas dan menjaga ukuran `sidepanel.js` tetap terkendali.
