# PRD — CLI Gemini Mode

**Status:** Revisi kebutuhan mode Settings/Playwright; implementasi lanjutan belum dimulai  
**Tanggal:** 1 November 2026  
**Folder implementasi:** `cli gemin mode`  
**Tujuan:** Menyediakan tool terminal untuk menguji text-to-video Gemini melalui server AMB Media dan akun Gemini yang tersimpan di Google Sheets.

## 1. Ringkasan

CLI Gemini Mode adalah program interaktif untuk menjalankan pengujian generate video Gemini dari terminal tanpa membuka UI AMB Media. Pengguna tetap login memakai akun user AMB Media melalui server yang sama seperti UI. Berdasarkan user yang berhasil login, CLI mengambil daftar akun Gemini milik user tersebut dari Google Sheets, menampilkan status/kredit, lalu menjalankan text-to-video memakai akun yang dipilih. Server AMB Media tetap harus berjalan di terminal terpisah.

CLI menggunakan endpoint login, pemuatan akun, verifikasi/sinkronisasi, generate video, dan polling status server yang sama. CLI tidak menerima `userId` yang dipilih bebas. Sebagai pengecualian khusus testing, generate CLI yang terautentikasi boleh melewati saldo kredit internal tanpa menulis pemakaian atau riwayat kegagalan ke ledger; sesi aktif dan lock satu generate per akun tetap berlaku. Pengecualian ini tidak berlaku pada UI, Canvas, Chat, atau endpoint generate biasa.

## 2. Analisis sistem dan kebutuhan

### 2.1 Ketergantungan pada server AMB Media

- Server menyediakan health check `GET /api/health` dan berjalan pada port `3000`.
- Server memproses generate video melalui `POST /api/gemini/generate-video`.
- Generate yang mengembalikan `operationName`/`taskId` harus dipantau melalui `POST /api/gemini/video-status` sampai selesai atau gagal.
- Endpoint generate server saat ini membutuhkan kredensial akun Web Gemini; jalur video hanya mendukung sesi Gemini Web, bukan API key AI Studio.
- Server memiliki ledger lokal internal `2 kredit per akun`, mengunci akun selama video aktif, dan menyediakan sinkronisasi sesi/kredit melalui `POST /api/gemini/accounts/sync-daily`. Sync memverifikasi sesi dan membaca ledger lokal, tanpa scan riwayat Gemini. Kredit aplikasi tidak reset harian.
- Jika server berhenti, proses generate dan polling CLI tidak dapat berjalan. CLI harus memberi instruksi yang jelas untuk menyalakan server, bukan diam-diam mencoba jalur lain.

### 2.2 Ketergantungan pada Google Sheets dan identitas user

- UI mengautentikasi user melalui `POST /api/auth/login`; server mencari username di sheet User dan memverifikasi password, lalu mengembalikan objek user yang mencakup `userId`.
- Route akun provider yang tersedia adalah `GET /api/providers/gemini/accounts?userId=...`.
- Route tersebut membaca akun Gemini untuk `userId` tertentu, bukan daftar global tanpa batas. UI menggunakan `userId` dari user yang berhasil login untuk memuat akun provider.
- Record akun dapat mencakup token/cookie yang diperlukan server untuk generate; kredensial tidak boleh dicetak, ditulis ke log, atau disimpan kembali oleh CLI.
- CLI perlu melakukan login user AMB Media melalui endpoint yang sama dengan UI, lalu memakai hanya `userId` dari respons login untuk memuat akun. CLI tidak meminta atau menerima `userId` manual maupun `GEMINI_CLI_USER_ID`.
- Route CLI menggunakan session bearer bertanda tangan server. Semua route Settings/Playwright baru wajib memakai autentikasi ini dan mengikat setiap operasi ke user aktif; jangan menganggap `userId` yang dikirim client saja sebagai bukti autentikasi.
- Sumber saldo utama tetap ledger server. Jika `ledgerKnown` belum terkonfirmasi, saldo harus ditandai “belum sinkron”; CLI tidak boleh menyimpulkan bahwa akun memiliki `2` kredit.

### 2.3 Batas arti “fitur UI”

Untuk pengelolaan akun, CLI harus menyediakan seluruh mode yang tersedia pada Settings Google Gemini UI, bukan hanya Playwright single login. Cakupan yang harus dipetakan ke submenu **Settings**:

- Playwright single account;
- Playwright batch account;
- relogin dari akun yang dipilih;
- challenge/2FA, status, log, dan cancel sesi/batch;
- verifikasi/import sesi melalui Cookie & cURL;
- import akun batch yang tersedia di UI;
- menampilkan atau menyalin Script Runner Lokal Node/Python yang tersedia di UI, tanpa mencetak kredensial sesi atau password ke output.

Fitur generate gambar, Canvas, Chat, pengelolaan prompt/media, serta batch **video generation** tetap di luar lingkup CLI ini. Operasi tambah/refresh sesi akun boleh menyimpan perubahan akun melalui server ke Sheets user yang login, tetapi CLI tidak boleh menyediakan editor Sheet umum atau akses akun lintas user.

## 3. Masalah yang ingin diselesaikan

Pengujian generate video sekarang bergantung pada UI aplikasi. Pengguna ingin menjalankan server dan tester pada dua terminal terpisah, tetap login menggunakan akun user AMB Media, tetapi tidak perlu membuka UI atau menavigasi menu generate. Tester terminal dibutuhkan untuk memuat akun Gemini yang terkait dengan user yang login, memilih akun, mengirim prompt teks, memantau task, dan mengevaluasi hasil tanpa membuat alur akun atau kredit terpisah.

## 4. Tujuan

1. Memungkinkan pengujian text-to-video Gemini dari terminal dengan login user AMB Media, tanpa UI grafis.
2. Menggunakan akun Gemini yang tersimpan di Google Sheets dan terkait dengan user AMB Media yang berhasil login.
3. Menampilkan identitas akun, status autentikasi, kredit terkonfirmasi, dan status sinkronisasi dengan jelas.
4. Memungkinkan pengguna memilih akun tertentu sebelum generate.
5. Menggunakan endpoint dan aturan server yang sudah ada untuk generate, lock akun, ledger kredit, serta polling task.
6. Menyajikan pengalaman terminal yang mudah dipahami, termasuk validasi prompt, progress, durasi, hasil, dan pesan kesalahan.
7. Mencegah kredensial akun dan akses akun Sheets terekspos melalui output terminal, log, atau file konfigurasi CLI.
8. Menyediakan fungsi pengelolaan akun Gemini lewat menu utama **Settings**, dengan cakupan fitur tab Playwright pada Settings Google Gemini di UI.
9. Memastikan akun baru yang telah ditambahkan melalui UI dan tersimpan pada baris Sheets user aktif dapat segera ditemukan CLI setelah daftar akun di-refresh.

## 5. Bukan tujuan

- Mengubah algoritma generate video Gemini, ledger kredit, ataupun aturan satu proses aktif per akun.
- Membypass lock server, status ledger yang belum diketahui, kebijakan kuota, atau penanganan error server. Bypass kredit internal hanya berlaku pada mode test CLI yang sudah disetujui dan terautentikasi.
- Melakukan registrasi user AMB Media atau mengelola user aplikasi.
- Mengubah data akun di Google Sheets secara langsung dari CLI; penyimpanan akun hasil Playwright harus menggunakan jalur server yang sama/ekuivalen dengan UI dan hanya ke akun user yang login.
- Menyediakan generate gambar, image-to-video, video reference, Chat, Canvas, batch generation, atau workflow otomatis pada versi pertama.
- Mengklaim bahwa kredit internal adalah kuota resmi Google.
- Menjalankan server dari proses CLI; server tetap dinyalakan manual di terminal terpisah sesuai permintaan.

## 6. Pengguna dan skenario utama

Pengguna adalah developer/operator yang sedang menguji integrasi text-to-video Gemini dengan akun yang telah dikonfigurasi pada AMB Media.

### Skenario A — Membuka CLI dan memilih akun

1. Pengguna menyalakan server AMB Media pada terminal pertama.
2. Pengguna menjalankan CLI Gemini Mode pada terminal kedua.
3. CLI memeriksa koneksi server melalui health check.
4. CLI meminta username dan password user AMB Media; password dimasukkan secara tersembunyi.
5. CLI mengirim kredensial ke `POST /api/auth/login`, lalu menyimpan identitas user hasil login hanya di memori proses.
6. CLI memuat akun Gemini dengan `userId` dari respons login yang sukses.
7. CLI menampilkan daftar aman, misalnya nomor, nama tampilan, email, status akun, sisa kredit, dan status sync.
8. Pengguna memilih satu akun, melakukan refresh daftar, logout/ganti user, atau keluar.

### Skenario B — Menjalankan text-to-video

1. Jika belum ada akun terpilih, CLI langsung menampilkan daftar akun Gemini agar pengguna memilih akun sebelum melanjutkan.
2. CLI menerima prompt teks dan parameter generate.
3. CLI memvalidasi prompt dan status akun/kredit.
4. CLI mengirim satu request generate ke server dengan akun pilihan sebagai akun utama. CLI tidak boleh mengirim daftar akun cadangan secara diam-diam.
5. Jika task diterima, CLI menampilkan ID task, akun yang dipakai, status, waktu berjalan, dan progress yang tersedia.
6. CLI mem-poll endpoint status hingga task selesai, gagal, atau pengguna memilih berhenti menunggu.
7. Saat selesai, CLI menampilkan status akhir, URL hasil video, waktu proses, dan saldo terbaru jika tersedia.
8. Jika task gagal atau status task tidak diketahui, CLI menampilkan error server apa adanya secara aman dan tidak membuat retry otomatis yang bisa membuat task baru atau memakai kredit tambahan.

### Skenario C — Server belum tersedia

1. CLI gagal menghubungi `http://localhost:3000/api/health`.
2. CLI menjelaskan bahwa server belum aktif dan memberi contoh perintah untuk menyalakan server pada terminal pertama.
3. CLI memberi pilihan coba lagi atau keluar. Tidak ada stack trace panjang untuk kondisi koneksi biasa.

### Skenario D — Mengelola akun melalui menu Settings

1. Pengguna memilih **Settings** dari menu utama CLI.
2. Settings menampilkan daftar akun Gemini terbaru milik user aktif serta pilihan refresh daftar.
3. Pengguna dapat menjalankan seluruh fungsi pada tab Playwright di Settings Google Gemini UI:
   - **Single account:** memasukkan satu email dan password Google untuk memulai sesi login Playwright.
   - **Batch accounts:** memasukkan beberapa email dan satu password bersama, menampilkan progres per akun, serta melewati email yang sudah terdaftar.
   - **Relogin akun terpilih:** memilih akun dari daftar user aktif dan memulai relogin menggunakan kredensial tersimpan di server, tanpa meminta password kecuali server/UI menyatakan kredensial tersimpan tidak tersedia.
   - **Verifikasi 2FA/challenge:** menampilkan tipe dan instruksi challenge yang tersedia, menerima kode atau konfirmasi yang diperlukan, lalu meneruskan sesi.
   - **Status, log, dan cancel:** memantau tahapan Playwright, menampilkan log aman, dan membatalkan sesi atau batch yang sedang berjalan.
4. Setelah single/batch berhasil, CLI memvalidasi identitas email hasil login, menyimpan akun ke data provider milik user aktif melalui server, menyinkronkan ledger lokal, lalu memuat ulang daftar.
5. Setelah relogin berhasil, CLI memperbarui sesi/metadata akun yang dipilih tanpa membuat baris akun duplikat atau mereset saldo ledger.
6. Jika proses gagal, kredensial tidak disimpan ke output/log dan daftar akun yang sudah ada tidak dihapus.

### Skenario E — Akun baru dari Sheets/UI

1. User menambahkan akun Gemini melalui Settings UI dan akun tersimpan pada baris user tersebut di Google Sheets.
2. CLI memilih **Settings → Refresh daftar akun** (atau memuat ulang daftar saat masuk Settings).
3. Server mengambil data terbaru dari Sheets; akun baru muncul pada CLI tanpa harus menunggu cache baca yang lama kedaluwarsa atau restart server.
4. Akun hanya muncul untuk user AMB Media yang memiliki baris tersebut; saldo mengikuti ledger dan status yang belum diketahui tetap ditampilkan sebagai belum sinkron.

### Skenario F — Mengelola sesi lewat mode akun selain Playwright

1. Dari **Settings**, pengguna dapat memilih Cookie & cURL untuk memverifikasi/import cookie sesi Gemini menggunakan alur server yang sama dengan UI.
2. Pengguna dapat memakai alur import batch yang tersedia di UI; CLI memvalidasi format, menampilkan progres per akun, dan memberi hasil masing-masing tanpa membocorkan cookie.
3. Jika Script Runner Lokal tersedia, CLI dapat menampilkan atau menyimpan script Node/Python yang sama dengan UI untuk dijalankan pengguna secara eksplisit; CLI tidak menjalankan script atau mengirim password/cookie sebagai argumen proses.
4. Semua jalur sukses mengaitkan akun ke user aktif, mempertahankan saldo ledger, lalu refresh data Sheets agar akun langsung dapat dipilih.

## 7. Rancangan menu terminal

Menu utama:

1. **Lihat/pilih akun Gemini**.
2. **Sinkronkan akun terpilih**.
3. **Generate text-to-video**.
4. **Settings** — submenu seluruh mode pengelolaan akun di Settings Google Gemini UI: Playwright single/batch, relogin akun terpilih, challenge/2FA, status/log/cancel, Cookie & cURL, import batch, Script Runner Lokal, dan refresh daftar akun. Konfigurasi koneksi server berada di submenu ini bila masih diperlukan.
5. **Logout / ganti user**.
0. **Keluar**.

Settings bukan halaman bebas untuk mengubah `userId` atau membaca akun user lain. Semua operasi harus memakai user AMB Media yang sedang login.

Submenu Settings sekurangnya memuat:

1. Refresh daftar akun Gemini dari Sheets.
2. Tambah satu akun dengan Playwright.
3. Tambah akun batch dengan Playwright.
4. Relogin Playwright untuk akun dari daftar terpilih.
5. Import/verifikasi cookie melalui mode Cookie & cURL.
6. Import batch akun melalui mode import UI.
7. Lihat/salin Script Runner Lokal Node/Python jika tersedia pada UI.
8. Lihat status sesi/batch, submit 2FA/challenge, cancel, dan kembali.

Menu akun menampilkan:

- nomor pilihan;
- display name dan email;
- status sesi (`active`, `expired`, atau status error yang tersedia);
- kredit terkonfirmasi `sisa/2`;
- status ledger (`synced` atau `belum sinkron`);
- indikator akun sedang dipakai bila server dapat menyediakan status lock.

Token, cookie, SID, API key, dan nilai rahasia lain tidak pernah ditampilkan utuh. Jika status lock tidak tersedia melalui API yang aman, CLI tidak boleh menyimpulkan sendiri akun sedang bebas atau sibuk; server tetap memutuskan berdasarkan lock saat request generate.

## 8. Parameter text-to-video

Versi pertama menyediakan parameter yang relevan dengan generator video Gemini di aplikasi:

- Prompt teks (wajib).
- Model default `Omni Flash`, tetap mengikuti pemetaan model server.
- Aspect ratio; default sesuai pilihan yang digunakan aplikasi, dengan nilai yang didukung server.
- Durasi; default `10s`, dengan opsi valid sesuai kemampuan implementasi server.
- Resolusi; default `1080p`, dengan opsi yang sama seperti UI/server.
- Pemilihan akun eksplisit; tidak memilih akun otomatis tanpa persetujuan pengguna.

Daftar nilai aspect ratio, durasi, dan resolusi harus diambil dari sumber konfigurasi yang sudah dipakai UI/server atau didefinisikan bersama saat implementasi. Jangan menerima nilai bebas yang belum didukung backend. CLI versi pertama hanya menerima prompt teks; lampiran gambar/video tidak disediakan.

## 9. Alur integrasi teknis

1. **Konfigurasi lokal**
   - Base URL default: `http://localhost:3000`.
   - Tidak ada konfigurasi `userId` manual. User scope didapat dari respons login server.
   - Username dimasukkan saat login; password diminta secara tersembunyi, dikirim hanya ke endpoint login server, lalu dibuang dari memori sesegera mungkin.
   - Jangan menyimpan username/password atau session credential secara plaintext. Login ulang diperlukan ketika CLI dimulai kembali, kecuali server kelak menyediakan sesi aman yang kompatibel dengan UI.

2. **Pemeriksaan server**
   - Panggil `GET /api/health`.
   - Bedakan server mati, timeout, dan respons server error.

3. **Login user**
   - Minta username dan password akun AMB Media yang sudah terdaftar.
   - Panggil `POST /api/auth/login` dengan kredensial tersebut.
   - Jika login gagal, hentikan alur pemuatan akun; jangan menerima `userId` manual sebagai fallback.
   - Simpan identitas user yang dikembalikan server (terutama `userId`) hanya selama sesi proses CLI.

4. **Memuat akun**
   - Panggil `GET /api/providers/gemini/accounts?userId=<userId hasil login>`.
   - Jangan menampilkan atau menulis field `refreshToken`, cookie, maupun data autentikasi lainnya.
   - Sinkronkan saldo tiap akun melalui endpoint sync yang tersedia dengan email/kredensial hanya di memori proses.
   - Untuk akun yang belum memiliki ledger terkonfirmasi, tampilkan `Belum sinkron`, jangan menganggap akun memiliki kredit penuh.
   - Saat masuk Settings, refresh eksplisit, dan setelah operasi tambah/relogin/import selesai, baca ulang data Sheets terbaru. Cache server untuk sheet provider harus dilewati atau diinvalidasi pada jalur refresh agar akun yang baru ditulis oleh UI/CLI tidak tertahan sampai TTL cache habis.

5. **Settings / Playwright**
   - Buat route CLI terautentikasi untuk memulai, membaca status, submit challenge/2FA, membatalkan, dan menyimpan hasil Playwright. Jangan memanggil route Playwright UI yang tidak mengikat operasi ke user aktif tanpa pembungkus otorisasi.
   - Single account memproses satu email. Batch memproses daftar email, menjaga progres dan hasil per akun, dan mencegah duplikasi berdasar email ternormalisasi pada data user yang sama.
   - Relogin hanya boleh dimulai untuk akun yang ditemukan pada daftar Sheets user aktif. Kredensial tersimpan tetap berada di server; jika tidak tersedia, minta password Google di prompt tersembunyi dan jangan menyimpannya di konfigurasi/log CLI.
   - Tampilkan instruksi challenge dan status sesi yang tersedia, terima kode 2FA bila diminta, dan sediakan cancel untuk sesi/batch aktif.
   - Setelah login berhasil, pastikan email identitas yang diverifikasi Google cocok dengan akun target. Simpan/refresh metadata dan sesi menggunakan jalur server yang sama dengan penyimpanan akun UI; jangan membuat duplikat atau memberi saldo default yang melewati ledger.
   - Setelah penambahan/relogin, invalidasi cache provider yang relevan dan baca ulang akun dari Sheets. Tampilkan hasil sukses/gagal per akun.
   - Cookie & cURL, import batch, dan Script Runner Lokal harus menyediakan parity dengan mode terkait pada Settings UI. Semua operasi simpan menggunakan endpoint server terikat user aktif; file/script tidak boleh menanam password atau cookie.

6. **Generate**
   - Panggil `POST /api/gemini/generate-video` dengan prompt, parameter, identitas akun, dan kredensial akun terpilih.
   - Request harus text-to-video tanpa referensi media.
   - Hormati mekanisme lock satu proses aktif per akun dan ledger server.

7. **Polling**
   - Jika server mengembalikan `operationName`/`taskId`, panggil `POST /api/gemini/video-status` berkala sampai status terminal.
   - Tampilkan elapsed time dan status. Jangan mengarang persentase progres bila server tidak menyediakan progres numerik.
   - Jika polling terganggu, sediakan opsi melanjutkan polling menggunakan task ID; jangan otomatis submit ulang generate.

9. **Kredit dan hasil**
   - Setelah selesai/gagal, sinkronkan ulang kredit akun melalui server.
   - Tampilkan URL hasil sesuai respons server dan instruksi bahwa file/URL bergantung pada ketersediaan server/media cache.
   - CLI tidak menulis saldo buatan atau kredensial di luar jalur penyimpanan akun yang sama dengan UI. Ledger server adalah sumber kebenaran kredit; jangan membuat logika kredit CLI terpisah.

## 10. Keamanan dan batas akses

Server saat ini mendengarkan pada `0.0.0.0:3000`. Endpoint login memverifikasi username/password dan mengembalikan `userId`, sementara route akun provider menerima `userId` sebagai scope dan dapat mengembalikan kredensial akun. CLI harus memakai hasil login yang sama dengan UI; akses terminal lokal saja tidak dianggap sebagai autentikasi.

Persyaratan desain sebelum implementasi:

1. Login CLI harus memanggil `POST /api/auth/login`; jangan membuat jalur bypass login atau login lokal terpisah. Password Google hanya boleh diminta secara tersembunyi ketika alur Playwright UI memang memerlukannya dan harus diproses dengan penyimpanan terenkripsi server yang sudah digunakan UI.
2. CLI hanya boleh memakai `userId` yang dikembalikan oleh login sukses. Jangan menerima `userId` dari prompt, argumen, environment, atau file konfigurasi.
3. Route CLI memakai session bearer bertanda tangan server. Route Settings baru wajib memakai autentikasi ini dan mengotorisasi operasi terhadap user aktif. Jangan menganggap `userId` dari client saja sebagai bukti autentikasi.
4. Jangan menambahkan endpoint global yang mengembalikan akun lintas user. Semua pembacaan akun harus terbatas pada user terautentikasi.
5. Batasi endpoint Settings pada operasi Gemini setara UI dan hanya untuk user terautentikasi: daftar/refresh akun, memulai dan memantau Playwright, submit challenge, cancel, verifikasi/import sesi, dan persistensi akun hasil verifikasi. Tidak memberikan akses tulis umum ke Google Sheets.
6. Password user AMB Media tidak boleh ditampilkan atau ditulis ke file/log; minta secara tersembunyi dan kirim hanya ke endpoint login. Password Google untuk Playwright juga tidak boleh ditampilkan/ditulis ke file/log atau argumen proses; gunakan penyimpanan kredensial terenkripsi server yang sama dengan UI atau minta ulang bila penyimpanan tidak tersedia.
7. Masking wajib untuk cookie/token/key pada output, error, debug log, dan laporan task.
8. Jangan menaruh kredensial ke argumen command line yang dapat terlihat pada daftar proses.
9. Dokumentasikan bahwa CLI ditujukan untuk pemakaian terotorisasi dengan akun user AMB Media yang sesuai.

Jika identitas dari login belum dapat diikat dengan aman ke request akun/generate, jangan lanjutkan ke akses akun atau generate. Perbaiki otorisasi server terlebih dahulu dengan tetap menggunakan login user AMB Media yang sama, bukan token CLI terpisah yang melewati proses login itu.

## 11. Persyaratan fungsional

| ID | Prioritas | Persyaratan |
|---|---|---|
| CLI-01 | P0 | CLI berjalan pada terminal terpisah dari server dan memeriksa `GET /api/health` sebelum memuat akun atau generate. |
| CLI-02 | P0 | CLI login melalui `POST /api/auth/login` menggunakan akun user AMB Media; password dimasukkan tersembunyi dan tidak disimpan. |
| CLI-03 | P0 | CLI mengambil `userId` hanya dari respons login sukses, lalu memuat akun Gemini milik user tersebut; tidak ada pemilihan `userId` manual atau daftar akun lintas user. |
| CLI-04 | P0 | Daftar akun menampilkan nama/email, status, sisa kredit terkonfirmasi dari ledger, dan status sync; kredensial dirahasiakan. |
| CLI-05 | P0 | Pengguna dapat memilih akun Gemini eksplisit sebelum generate. |
| CLI-06 | P0 | Generate awal hanya text-to-video; prompt wajib dan media referensi tidak diterima. |
| CLI-07 | P0 | Parameter model, aspect ratio, durasi, dan resolusi mengikuti opsi yang didukung aplikasi/server. |
| CLI-08 | P0 | Generate memakai endpoint server yang sama, mempertahankan lock satu proses aktif per akun, dan hanya route CLI terautentikasi yang dapat mengaktifkan test mode tanpa mengubah ledger kredit. |
| CLI-09 | P0 | Sesi expired dan saldo ledger yang belum diketahui memblokir generate; saldo nol yang sudah tersinkron tetap dapat dipakai melalui test mode CLI dan tidak mengubah ledger. |
| CLI-10 | P0 | Task asynchronous dipantau dengan operation/task ID sampai selesai/gagal; gangguan polling tidak melakukan submit ulang otomatis. |
| CLI-11 | P1 | CLI menampilkan status/progress yang benar-benar tersedia, elapsed time, error yang dapat ditindaklanjuti, URL hasil, dan saldo pasca-task. |
| CLI-12 | P1 | Pengguna dapat memuat ulang daftar akun dan sinkronisasi saldo tanpa mengubah kredensial; perubahan sesi hanya dilakukan melalui alur Settings yang sama dengan UI. |
| CLI-13 | P0 | Server mengikat pemuatan akun dan operasi task ke identitas user yang login, bukan hanya mempercayai `userId` dari request; tidak ada endpoint global pembuka kredensial. |
| CLI-14 | P1 | Base URL server dapat dikonfigurasi; default server adalah `http://localhost:3000`. Identitas user didapat dari login, bukan konfigurasi lokal. |
| CLI-15 | P1 | Perintah dan konfigurasi CLI didokumentasikan, termasuk cara menjalankan server dan CLI pada dua terminal. |
| CLI-16 | P1 | CLI mendukung logout/ganti user; pergantian user menghapus user aktif dan pilihan akun sebelumnya dari memori sebelum memuat akun user berikutnya. |
| CLI-17 | P0 | Menu utama memiliki submenu **Settings** untuk seluruh mode pengelolaan akun yang tersedia di Settings Google Gemini UI: Playwright single/batch, relogin akun terpilih, 2FA/challenge, status/log/cancel, Cookie & cURL, import batch, Script Runner Lokal, dan refresh daftar. |
| CLI-18 | P0 | Semua operasi Settings memakai session user aktif, membatasi akun terhadap Sheets user tersebut, dan menggunakan route server yang mengautentikasi serta mengotorisasi operasi; tidak ada akses global atau `userId` pilihan client. |
| CLI-19 | P0 | Akun yang berhasil ditambahkan/diverifikasi melalui CLI atau UI dipersist ke provider sheet user yang sesuai melalui server, tanpa duplikat email, tanpa reset saldo ledger, dan tanpa mencetak kredensial. |
| CLI-20 | P0 | Refresh daftar Settings mem-bypass/menginvalidasi cache provider agar akun baru dari UI/Sheets terlihat segera tanpa menunggu TTL atau restart server. |
| CLI-21 | P1 | Batch account menampilkan progres dan hasil per email, melewati duplikat pada user yang sama, serta tidak membatalkan akun lain yang sudah sukses jika sebagian batch gagal. |
| CLI-22 | P1 | Relogin hanya dapat dijalankan untuk akun dari daftar user aktif; sesi baru memperbarui kredensial/metadata tanpa membuat akun baru atau mereset kredit. |

## 12. Penanganan error

- Server tidak hidup/port salah: tampilkan URL yang dicoba dan instruksi menjalankan server.
- Login gagal: tampilkan pesan server yang aman, jangan memuat akun dan jangan meminta `userId` sebagai fallback.
- Login berhasil tetapi identitas user tidak lengkap: hentikan alur dan tampilkan error; jangan memuat akun atau menggunakan identitas tersimpan.
- Sheet tidak dapat dibaca: tampilkan error Google Sheets yang aman; jangan memakai cache kosong sebagai daftar akun baru.
- Tidak ada akun Gemini: tampilkan petunjuk bahwa akun harus ditambahkan terlebih dahulu melalui aplikasi/Sheets.
- Ledger belum diketahui: tandai belum sinkron dan blok generate sampai sinkronisasi/lookup berhasil.
- Akun expired: tawarkan relogin lewat Settings CLI untuk akun terpilih; jika kredensial tersimpan tidak ada, minta input tersembunyi sesuai alur UI.
- Akun baru dari UI belum muncul: sediakan refresh yang membaca Sheets secara langsung setelah cache diinvalidasi; jika pembacaan gagal, tampilkan error dan jangan menyajikan cache kosong seolah-olah data terbaru.
- Playwright/2FA/batch gagal atau timeout: pertahankan status per sesi, izinkan melanjutkan polling/cancel jika sesi masih tersedia, dan jangan menyatakan akun berhasil tersimpan sebelum identitas serta persistensi dikonfirmasi.
- Akun sedang digunakan atau lock gagal: tampilkan respons server; jangan mencoba membypass lock.
- Google menolak karena kuota: tampilkan error; kredit internal tidak dihitung sebagai generate sukses dan reservasi dikembalikan setelah kegagalan terkonfirmasi.
- Task gagal: tampilkan error final dan saldo terbaru bila tersedia.
- Polling gagal/timeout: pertahankan task ID, tawarkan lanjut polling atau keluar; jangan submit ulang diam-diam.
- Respons server tidak valid: tampilkan error kontrak yang aman dan hentikan proses; jangan mengasumsikan task sukses.

## 13. Kriteria penerimaan

1. Dengan server mati, CLI memberikan pesan yang jelas dan tidak melakukan request generate.
2. Dengan server hidup dan login user sukses, daftar yang tampil hanya akun Gemini milik user tersebut.
3. Login gagal tidak memuat daftar akun dan tidak menerima `userId` dari input lain.
4. Akun dengan sesi expired atau ledger belum diketahui tidak dapat dipakai untuk generate; saldo `0/2` yang telah tersinkron tetap dapat dipakai dalam mode test CLI.
5. Akun `0/2`, `1/2`, atau `2/2` yang valid dapat dipilih; setelah generate/poll, pemakaian kredit internal dan riwayat kegagalan akun tidak berubah.
6. Dua request untuk akun yang sama tidak dapat melanggar lock server; CLI melaporkan akun sibuk atau menunggu hanya jika perilaku tunggu memang didukung backend.
7. Prompt kosong ditolak sebelum request dikirim.
8. Request text-to-video tidak mengirim referensi gambar/video atau akun cadangan otomatis.
9. Parameter yang tidak didukung ditolak sebelum dikirim; nilai default sejalan dengan aplikasi.
10. Task asynchronous terus dipantau sampai status terminal dan output menampilkan task ID serta hasil/error yang benar.
11. CLI otomatis mem-poll task setelah generate dimulai; tidak tersedia menu untuk melanjutkan polling task yang terputus.
12. Task CLI test tidak mengurangi atau mengembalikan kredit ledger selama generate dan polling otomatis.
13. Generate dari UI biasa tetap memakai pemeriksaan dan pencatatan kredit server yang normal.
14. Password AMB Media, cookie, token, API key, atau kredensial lain tidak muncul dalam output/log. Password Google hanya dimasukkan tersembunyi dan mengikuti penyimpanan terenkripsi server yang sama dengan UI; password AMB tidak disimpan.
15. Settings CLI dapat menambahkan atau memperbarui hanya akun Gemini milik user aktif melalui jalur server setara UI; tidak ada akses Sheet umum, hapus massal, atau perubahan akun user lain.
16. Logout/ganti user menghapus pilihan akun dan user aktif; akun dari user sebelumnya tidak muncul setelah user baru login.
17. Seluruh pengujian dapat dijalankan dengan server pada terminal pertama dan CLI pada terminal kedua.
18. Playwright single account sukses membuat akun satu kali di Sheets user aktif, kemudian akun tampil pada daftar CLI dan UI setelah refresh.
19. Playwright batch melaporkan tiap akun, melewati akun duplikat, dan hanya menyimpan akun yang email Google terverifikasi.
20. Relogin dari akun terpilih memperbarui sesi tanpa menggandakan baris, mengubah saldo ledger, atau mengubah user pemilik.
21. Cookie & cURL, import batch, Script Runner Lokal, 2FA, status/log, serta cancel berperilaku setara dengan mode terkait di Settings UI dan tidak mengekspos rahasia.
22. Setelah akun baru ditambahkan di UI, refresh Settings CLI menampilkannya segera meski cache server sebelumnya masih dalam TTL.

## 14. Rencana pengujian

- Unit test parsing konfigurasi, prompt, parameter valid, dan masking rahasia.
- Uji integrasi health check: server mati, server hidup, timeout, serta base URL kustom.
- Uji login berhasil/gagal, password tersembunyi, dan tidak ada penyimpanan password.
- Uji dua user berbeda yang masing-masing memiliki akun Gemini: setelah login user A/B, CLI hanya menampilkan dan menggunakan akun user yang sedang aktif.
- Uji bahwa request dengan userId yang tidak terikat pada login/session ditolak server.
- Uji akun kosong, cache stale, dan kegagalan Google Sheets tanpa fallback ke akun user lain.
- Uji status kredit `0`, `1`, `2`, dan `ledgerKnown=false`; saldo `0` boleh untuk CLI test, sedangkan ledger unknown tetap diblokir.
- Uji verifikasi sesi expired serta sinkronisasi kredit yang gagal.
- Uji generate text-to-video sukses langsung dan task asynchronous.
- Uji polling otomatis sukses, gagal, timeout, dan koneksi terputus.
- Uji pemilihan akun eksplisit, akun terkunci oleh proses lain, serta tidak ada auto-fallback diam-diam.
- Uji bahwa tidak ada request media reference, perubahan Sheet di luar operasi akun user-scope yang disetujui, retry submit tak disengaja, atau output rahasia.
- Uji kompatibilitas dengan model/aspect ratio/durasi/resolusi yang benar-benar diterima server.
- Uji setiap mode Settings yang diparitas dengan UI: Playwright single/batch/relogin, challenge/2FA, status/log/cancel, Cookie & cURL, import batch, dan Script Runner Lokal.
- Uji isolasi user pada semua route Settings, verifikasi email Google, duplikat email, kegagalan parsial batch, persistensi akun ke Sheets, dan saldo ledger saat relogin.
- Uji cache provider: tambah akun lewat UI, lalu refresh CLI sebelum TTL cache habis; akun baru harus muncul, sedangkan kegagalan Sheets harus dilaporkan eksplisit.
- Dokumentasikan pengujian manual dua terminal dengan akun uji yang diotorisasi.

## 15. Komponen rencana implementasi

Implementasi mencakup entry point `cli gemin mode/index.mjs`, script `npm run cli:gemini`, sesi bearer bertanda tangan dari server, route CLI untuk daftar/sinkronisasi/generate/poll, dan submenu Settings untuk Playwright single/batch, relogin, 2FA, status/log/cancel, Cookie & cURL, import batch, Script Runner Lokal, dan refresh akun terbaru dari Sheets. Route Settings mengikat session/batch ke user aktif, memverifikasi email hasil Playwright, menyimpan akun lewat service server, dan tidak mengirim kredensial akun ke CLI. Refresh CLI melewati cache baca; kegagalan Sheets dilaporkan.

`npm run lint` dan pemeriksaan sintaks `node --check "cli gemin mode\\index.mjs"` lulus setelah implementasi. Sebelum rilis, jalankan pengujian manual dengan akun uji terotorisasi untuk login, isolasi dua user, tiap mode Settings, sinkronisasi kredit, generate, polling otomatis, dan kegagalan sesi.

## 16. Keputusan dan asumsi PRD

- CLI melakukan login user AMB Media lewat server, sama seperti UI, tetapi seluruh interaksi setelah login dilakukan melalui terminal.
- `userId` hanya diambil dari respons autentikasi server dan hanya digunakan untuk memuat akun Gemini user tersebut; tidak dibaca dari environment, argumen, atau konfigurasi lokal.
- Data akun Gemini mengikuti user yang sedang login. Logout/ganti user memuat ulang daftar dan pilihan akun dari user baru.
- Login endpoint mengeluarkan token sesi bertanda tangan dengan masa berlaku 8 jam; server restart membatalkan token dan CLI perlu login ulang.
- CLI ditujukan untuk pengujian lokal pada server yang dijalankan pengguna. Request ke server jarak jauh tidak menjadi default.
- CLI memanfaatkan verifikasi sesi dan lock server yang sudah ada, tetapi memakai izin test satu-kali yang hanya diterbitkan route CLI terautentikasi untuk melewati ledger kredit internal. Task test ditandai terpisah agar polling otomatis tidak mencatat kredit; generate biasa tetap mengikuti ledger lifetime dua kredit.
- Tidak ada fallback akun diam-diam. Akun yang diuji harus jelas agar hasil dan pemakaian kredit dapat ditelusuri.
- CLI hanya menulis task generate dan operasi akun Gemini terbatas yang didefinisikan di Settings melalui endpoint server terautentikasi; tidak ada write umum ke Sheets.
- URL server CLI dibatasi ke loopback; password dan token sesi hanya berada di memori proses.
