# Copilot Instructions

## Arsitektur project
Project ini adalah extension side panel Chrome dengan struktur modular per menu.

### Prinsip utama
- `sidepanel.js` adalah orchestrator, bukan tempat semua logic fitur.
- Fungsi spesifik menu harus dipisah ke helper file di folder masing-masing.
- Shared logic masuk ke `js/core/`.
- Hindari menambah helper besar ke `sidepanel.js`.

### Folder utama
- `js/account/` = akun, auth, session, import
- `js/chat/` = chat, history, media
- `js/generator/` = generate settings, recent generations, model controls
- `js/library/` = asset library, picker, role asset
- `js/storyboard/` = storyboard, copilot, render, review, intent
- `js/core/` = API, storage, utils, response parser

### Aturan edit
Ketika ada perubahan fitur, lakukan ini:
1. Tentukan fitur itu milik menu mana.
2. Cek apakah logic itu spesifik ke menu tersebut.
3. Jika ya, buat atau update helper di folder menu terkait.
4. `sidepanel.js` hanya menyambungkan UI dan memanggil fungsi helper.
5. Jika logic dipakai banyak menu, taruh di `js/core/`.

### Contoh
- storyboarding review logic -> `js/storyboard/storyboard-intent.js`
- session chat -> `js/chat/chat-session.js`
- asset library -> `js/library/library-view.js`
- shared storage/API -> `js/core/`

### Arah maintainability
Jangan membuat `sidepanel.js` menjadi file raksasa. Repository ini harus tetap modular agar AI atau developer berikutnya bisa lanjut tanpa kebingungan saat sesi chat berubah.
