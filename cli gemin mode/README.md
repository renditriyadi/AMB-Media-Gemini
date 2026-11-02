# CLI Gemini Mode

CLI interaktif untuk mengetes text-to-video Gemini dan mengelola akun melalui server AMB Media. Password AMB Media, token sesi, dan kredensial akun tidak ditulis oleh CLI ke file. Password Google untuk Playwright, bila digunakan, mengikuti penyimpanan terenkripsi server.

## Menjalankan

Terminal pertama, dari root project:

```powershell
npm run dev
```

Terminal kedua, juga dari root project:

```powershell
npm run cli:gemini
```

CLI langsung menggunakan server lokal `http://127.0.0.1:3000` dan menampilkan prompt login. Password dimasukkan tersembunyi. Server tetap harus dijalankan terpisah. Untuk mengganti URL, set environment variable `AMB_MEDIA_SERVER_URL`; alamat loopback saja yang diterima.

## Alur CLI

1. Login ke server dan dapatkan sesi yang ditandatangani server.
2. Tampilkan akun Gemini milik user yang login saja.
3. Pilih dan sinkronkan sesi/kredit lokal akun sebelum generate. Sync memverifikasi sesi dan membaca ledger server; tidak memindai riwayat Gemini. Saldo `0/2` tetap boleh diuji, tetapi ledger harus sudah diketahui dan sesi aktif.
4. Jika belum memilih akun, CLI langsung meminta pengguna memilih akun sebelum melanjutkan. Buat task text-to-video untuk akun yang dipilih, tanpa fallback ke akun lain.
5. CLI otomatis mem-poll status task setelah generate dimulai. Tidak ada menu untuk melanjutkan polling task yang sudah terputus.
6. Logout menghapus sesi dan pilihan akun dari memori proses.

## Settings Gemini

Pilih **4. Settings** pada menu utama untuk:

- Menambah satu akun atau batch akun menggunakan Playwright; password dimasukkan tersembunyi.
- Melakukan relogin pada akun terpilih, dengan password tersembunyi hanya jika kredensial Playwright belum tersimpan.
- Memverifikasi Cookie/cURL dan mengimpor beberapa sesi secara berurutan. Credential tidak ditampilkan di terminal.
- Melihat status/log, mengirim kode 2FA, serta membatalkan sesi atau batch. Session ID dan Batch ID dapat dipakai untuk melanjutkan pemantauan.
- Menyimpan Script Runner Lokal Node.js atau Python ke file baru; file yang sudah ada tidak ditimpa.
- Memuat ulang dan menampilkan akun terbaru dari Google Sheets.

Operasi Settings hanya menggunakan bearer session CLI, mengikat session/batch ke user aktif, memverifikasi email hasil Playwright, dan menyimpan akun ke data provider user tersebut. Relogin mempertahankan ID akun dan kredit yang telah tercatat. Kegagalan membaca Sheets atau menyimpan akun dilaporkan, bukan dialihkan ke cache lama.

Generate dari CLI berjalan dalam mode test: generate tidak memotong kredit internal, tidak mengubah riwayat kegagalan akun, dan tidak mengubah perilaku kredit Canvas, Chat, atau menu Generate. Sesi tetap harus aktif, lock satu proses per akun tetap berlaku, dan kuota/penolakan asli Google tetap berlaku. Generate melalui UI aplikasi tetap memakai ledger kredit normal. Kredensial akun tetap berada di server dan tidak dikirim balik ke CLI.

CLI menggunakan alternate screen buffer agar log dari menu sebelumnya tidak masuk ke scrollback terminal utama. Layar terminal asli dipulihkan saat CLI keluar. Setelah aksi selesai, tekan Enter untuk melihat menu berikutnya.
