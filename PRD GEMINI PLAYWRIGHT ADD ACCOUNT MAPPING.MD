# PRD — Pemetaan Akun Gemini saat Add Account Playwright

**Status:** Usulan  
**Tanggal:** 6 November 2026  
**Cakupan:** Penambahan dan relogin akun Gemini melalui Playwright dari Settings, termasuk batch login dan penyimpanan akun ke localStorage/Google Sheets  
**Perubahan kode:** Belum diterapkan; dokumen ini menetapkan perilaku yang diharapkan dan kriteria implementasi.

## 1. Ringkasan

Alur Playwright menerima email yang dimasukkan pengguna, membuka profil browser yang dikaitkan dengan email tersebut, lalu mengambil identitas akun Google dari sesi yang berhasil login. Identitas hasil verifikasi itulah yang seharusnya menentukan akun Gemini yang dibuat atau diperbarui.

Saat ini alur Settings tidak secara eksplisit menolak jika email Google yang berhasil diverifikasi berbeda dari email yang dimasukkan. Akun dapat tersimpan memakai email hasil verifikasi, sedangkan profil browser dan kredensial tersimpan berdasarkan email input. Ini berisiko membuat pemetaan akun, relogin, dan profil browser tidak konsisten.

Aturan utama yang diusulkan:

> **Email Google terverifikasi adalah identitas kanonis akun Gemini Web. Email input hanya menjadi target login dan harus cocok dengan identitas terverifikasi sebelum akun disimpan atau diperbarui.**

Jika keduanya tidak cocok, proses harus gagal dengan pesan yang jelas dan tidak boleh mengubah akun yang sudah tersimpan.

## 2. Masalah pengguna

Pengguna menambahkan atau relogin akun dengan memasukkan alamat email tertentu. Namun, sesi Google yang berhasil dibuka dapat mengidentifikasi alamat email lain. Tanpa validasi konsisten:

- profil Playwright dan kredensial disimpan berdasarkan email input;
- data akun dapat disimpan berdasarkan email hasil ekstraksi;
- akun lokal dapat di-merge berdasarkan beberapa kandidat identitas sekaligus;
- proses relogin berikutnya dapat menggunakan profil yang tidak sesuai dengan akun yang terlihat di Settings.

Pengguna membutuhkan jaminan bahwa akun yang ditampilkan, profil browser, kredensial, dan sesi yang berhasil diverifikasi menunjuk identitas Google yang sama.

## 3. Tujuan

1. Menggunakan email Google terverifikasi sebagai identitas kanonis untuk akun Gemini Web.
2. Mencegah sesi dengan identitas yang berbeda dari email target ditambahkan atau menimpa akun lain.
3. Mempertahankan ID akun lokal yang sudah ada saat relogin untuk identitas yang sama.
4. Menyamakan perilaku single login, relogin, dan batch login.
5. Menghindari perubahan akun yang sudah tersimpan ketika validasi atau penyimpanan gagal.
6. Menampilkan status dan alasan kegagalan tanpa mengekspos password, cookie, token, atau kredensial lain.

## 4. Bukan tujuan

- Mengubah otomasi login Google, penanganan challenge/2FA, atau kebijakan Google.
- Mengubah format dan isi kredensial sesi yang disimpan, selain memastikan keterkaitannya dengan identitas yang benar.
- Mengubah aturan kredit Gemini atau proses sinkronisasi ledger.
- Mengubah perilaku akun provider selain Gemini.
- Mengganti mekanisme penyimpanan Google Sheets atau localStorage; dokumen ini mengatur data dan aturan pemetaannya.
- Menjadikan nama tampilan, label kustom, token, cookie, atau ID lokal sebagai pengganti email Google terverifikasi untuk identitas akun Gemini Web.

## 5. Kondisi sistem saat ini

### 5.1 Penambahan single account

1. UI Settings memanggil endpoint untuk memulai sesi Playwright dengan email dan password.
2. Server menyimpan kredensial terenkripsi serta menjalankan login menggunakan profil browser yang diturunkan dari email input yang dinormalisasi.
3. Playwright mengekstrak cookie dan identitas Google; email hasil ekstraksi dapat menggantikan email input pada objek hasil.
4. UI melakukan sinkronisasi kredit dan memanggil handler penambahan akun.
5. Handler Settings mencari akun yang cocok berdasarkan ID, email, email relogin, atau kredensial. Jika cocok, handler mempertahankan ID lama; jika tidak, ia membuat entri baru.
6. Daftar akun disimpan ke localStorage dan Google Sheets.

Pada jalur Settings ini, belum ada pemeriksaan eksplisit bahwa email input sama dengan email hasil verifikasi sebelum handler menyimpan akun.

### 5.2 Relogin

Relogin Settings menargetkan email akun yang dipilih, menggunakan profil dan kredensial tersimpan untuk email tersebut, lalu meneruskan hasil ke handler yang sama. Handler berusaha mempertahankan ID akun lama dengan pencocokan email atau kredensial.

### 5.3 Batch

UI melewati email yang sudah ada secara lokal, lalu server memproses daftar email satu per satu. Hasil yang berhasil dipoll dan disimpan ke daftar UI; server juga menyediakan jalur CLI terautentikasi yang memeriksa email hasil verifikasi terhadap email target sebelum menyimpan hasil ke Sheets.

### 5.4 Import cookie/cURL

Import manual memverifikasi token/cookie di server, lalu UI memakai email hasil verifikasi untuk membentuk akun. Jalur ini tidak selalu memiliki email target yang dimasukkan terpisah, sehingga email hasil verifikasi menjadi identitas akun Web. Import API key AI Studio memiliki aturan identitas berbeda dan tidak boleh dipaksakan mengikuti aturan email akun Web.

## 6. Aturan produk yang diusulkan

### 6.1 Identitas kanonis akun Gemini Web

- Email yang diberikan oleh verifikasi identitas Google menjadi email kanonis.
- Normalisasi email untuk perbandingan: trim spasi di awal/akhir dan bandingkan secara case-insensitive.
- Email yang dimasukkan sebelum login merupakan `targetEmail`, bukan bukti identitas.
- Sebelum menyimpan hasil Playwright, `targetEmail` harus cocok dengan email Google terverifikasi.
- Jika identitas Google tidak berhasil dipastikan, jangan menyimpan atau memperbarui akun sebagai akun Gemini Web.
- Jangan menampilkan atau menulis kredensial sesi ke log untuk membantu diagnosis mismatch.

### 6.2 Kunci pencocokan dan merge

- Untuk akun Gemini Web, cari akun existing berdasarkan email kanonis yang telah dinormalisasi.
- Jika email cocok, pertahankan ID akun existing dan perbarui kredensial/sesi, metadata profil, serta status verifikasi yang valid.
- Jika email tidak cocok dengan akun existing mana pun dan lolos validasi target, buat akun baru dengan ID lokal baru.
- ID lokal digunakan untuk mempertahankan referensi internal, bukan untuk menyimpulkan bahwa dua identitas Google berbeda adalah akun yang sama.
- Perubahan/rotasi token tidak boleh membuat akun yang sama menjadi entri baru apabila email terverifikasinya tetap sama.
- Token atau cookie tidak boleh dipakai sebagai identitas utama untuk menggabungkan akun berbeda.
- Jangan mengganti email kanonis existing hanya karena email input, label tampilan, atau token hasil proses berbeda.

### 6.3 Mismatch dan kegagalan

- Jika `targetEmail` berbeda dari email Google terverifikasi, tandai proses gagal dengan status yang dapat ditindaklanjuti pengguna.
- Jangan menambah akun baru, mengubah akun existing, mengubah email akun existing, atau menulis kredensial sesi mismatch ke record akun.
- Jangan menganggap sesi sukses berarti penambahan akun sukses sebelum validasi identitas dan penyimpanan selesai.
- Untuk batch, mismatch pada satu email hanya menggagalkan item itu; akun lain yang berhasil diverifikasi tetap dapat disimpan dan dilaporkan.
- Jika penyimpanan ke Google Sheets gagal, tampilkan kegagalan secara eksplisit dan jangan memberi pesan sukses bahwa akun telah tersimpan.

### 6.4 Relogin

- Relogin dimulai dari akun existing yang dipilih, dengan email kanonis akun tersebut sebagai target.
- Hasil login wajib cocok dengan target email dan email akun existing.
- Pada sukses, perbarui record yang sama dan pertahankan ID akun, status aktif, serta saldo kredit existing jika sinkronisasi ledger belum terkonfirmasi.
- Pada mismatch atau kegagalan verifikasi, record akun existing tidak berubah.
- Perubahan label tampilan tidak mengubah identitas akun atau direktori profil Playwright.

### 6.5 Profil dan kredensial Playwright

- Direktori profil dan berkas kredensial untuk akun Web harus menggunakan email kanonis yang dinormalisasi dengan aturan yang sama.
- Jangan menyimpan kredensial di bawah email input jika identitas hasil login berbeda.
- Login yang gagal atau mismatch tidak boleh membuat kredensial itu dapat dipakai untuk relogin sebagai akun lain.
- Password tetap disimpan terenkripsi sesuai mekanisme yang ada; data login tidak boleh dimasukkan ke log atau respons status.

### 6.6 Batch dan deduplikasi

- Normalisasi serta deduplikasi email target dilakukan sebelum proses batch.
- Email target yang sudah terdaftar dapat dilewati sesuai perilaku UI saat ini.
- Setelah tiap login berhasil, validasi bahwa email hasil verifikasi cocok dengan email target item tersebut sebelum persist.
- Deduplikasi hasil juga menggunakan email hasil verifikasi yang dinormalisasi, bukan hanya ID sesi.
- Hasil batch melaporkan jumlah sukses, gagal, dan dilewati secara terpisah; mismatch dihitung gagal, bukan sukses/skip.
- Kegagalan satu item tidak boleh membatalkan akun valid yang telah tersimpan dari item lain.

### 6.7 Jalur yang memiliki aturan identitas berbeda

- **Cookie/cURL Gemini Web:** email yang berhasil diverifikasi menjadi identitas kanonis karena tidak selalu ada email target terpisah.
- **Google AI Studio API key:** tetap mengikuti mekanisme identitas API key/label yang berlaku; jangan mensyaratkan email login Playwright.
- Aturan email target-versus-hasil verifikasi berlaku untuk Playwright single, relogin, dan setiap item Playwright batch.

## 7. Persyaratan fungsional

1. Sistem harus membawa `targetEmail` secara eksplisit dari awal sesi Playwright hingga pemeriksaan hasil dan penyimpanan.
2. Sistem harus memvalidasi format email target sebelum membuka browser.
3. Sistem harus menormalisasi email target dan email terverifikasi sebelum perbandingan.
4. Sistem harus menolak hasil tanpa email Google terverifikasi untuk alur Playwright Gemini Web.
5. Sistem harus menolak mismatch sebelum merge, persist, atau pengiriman kredensial ke record akun.
6. Sistem harus mengidentifikasi akun existing berdasarkan email kanonis dan mempertahankan ID existing pada relogin.
7. Semua jalur Settings dan CLI yang menyimpan hasil Playwright harus menerapkan aturan identitas yang setara; validasi server yang sudah ada tidak boleh dilemahkan oleh UI.
8. Respons status tidak boleh mengirim password, cookie, token, atau data kredensial dalam log/error.
9. UI harus memperlihatkan email target dan email hasil yang aman ditampilkan jika terjadi mismatch, agar pengguna tahu akun mana yang login tanpa mengekspos rahasia.
10. Batch harus mengembalikan hasil per email, termasuk status `success`, `failed`, atau `skipped`, dengan alasan aman untuk pengguna.
11. Sukses UI hanya boleh ditampilkan setelah akun selesai disimpan melalui jalur persist yang digunakan permukaan tersebut.
12. Sinkronisasi kredit yang belum diketahui tidak boleh mengubah identitas, mengganti ID akun, atau menganggap saldo penuh.

## 8. Alur yang diharapkan

### 8.1 Add account single

1. Pengguna memasukkan email target dan password.
2. Sistem memulai Playwright dengan profil yang sesuai target.
3. Pengguna menyelesaikan challenge/2FA jika diperlukan.
4. Playwright memverifikasi sesi dan mengambil email Google.
5. Sistem membandingkan email target dan email terverifikasi setelah normalisasi.
6. Jika mismatch/tidak terverifikasi, sesi ditandai gagal dan daftar akun tidak berubah.
7. Jika cocok, sistem mencari akun existing berdasarkan email kanonis.
8. Sistem menambahkan akun baru atau memperbarui akun existing sambil mempertahankan ID existing.
9. Sistem menyimpan akun ke localStorage/Google Sheets sesuai jalur Settings dan mengembalikan hasil persist.
10. UI menampilkan sukses hanya setelah penyimpanan berhasil.

### 8.2 Relogin

1. Pengguna memilih akun existing untuk relogin.
2. Sistem menggunakan email kanonis akun itu sebagai target, beserta profil/kredensial terkait.
3. Setelah autentikasi dan ekstraksi identitas, sistem membandingkan email hasil dengan target.
4. Jika cocok, perbarui sesi/metadata record existing dengan ID tetap.
5. Jika tidak cocok, hentikan tanpa mengubah record atau mengganti emailnya.

### 8.3 Batch

1. Parse, normalisasi, dan deduplikasi daftar email.
2. Tandai email existing sebagai dilewati sesuai aturan yang ditampilkan UI.
3. Proses email baru satu per satu.
4. Validasi identitas setiap hasil secara independen.
5. Simpan hanya item yang valid; laporkan mismatch sebagai kegagalan item.
6. Gabungkan akun sukses berdasarkan email kanonis dan pertahankan ID existing jika ditemukan.
7. Tampilkan ringkasan hasil dan alasan kegagalan tanpa rahasia.

## 9. Pengalaman dan pesan pengguna

- Saat mulai: tampilkan email target yang sedang diproses.
- Saat berhasil: tampilkan email terverifikasi yang ditambahkan/diperbarui dan status penyimpanannya.
- Saat mismatch: jelaskan bahwa akun Google yang login berbeda dari email target dan akun tidak disimpan; jangan otomatis menambahkan email berbeda sebagai akun baru.
- Saat email tidak dapat diverifikasi: beri arahan untuk memastikan login selesai dan mencoba kembali; jangan menyimpan sesi parsial.
- Saat penyimpanan gagal: tampilkan error penyimpanan dan jangan memberi notifikasi sukses.
- Untuk batch: sertakan hasil per item serta jumlah sukses/gagal/dilewati.
- Jangan menampilkan password, cookie, token, atau konten cURL pada pesan UI, log, maupun ringkasan.

## 10. Kebutuhan data dan kompatibilitas

- Record akun Gemini Web tetap menggunakan ID lokal yang stabil, email kanonis, nama tampilan, kredensial, status aktif, dan metadata kredit yang sudah didukung.
- Kecocokan email tidak peka huruf besar/kecil dan mengabaikan spasi di tepi.
- Email alias Google yang berbeda secara tekstual tidak boleh disatukan dengan aturan heuristik tanpa verifikasi identitas yang telah disetujui; versi pertama membandingkan alamat hasil verifikasi secara literal setelah normalisasi.
- Akun yang sudah tersimpan tidak perlu dimigrasikan atau digabung otomatis berdasarkan token.
- Data lama yang memiliki email kosong/ambigu harus dipertahankan, tidak dihapus atau digabung otomatis. Relogin hanya dapat memperbaruinya setelah email kanonis berhasil diverifikasi dan kebijakan pemetaan record lama ditentukan.
- Akun API key AI Studio tidak boleh dianggap sebagai akun Gemini Web hanya karena menggunakan provider yang sama.
- Bentuk respons endpoint yang telah digunakan UI/CLI harus tetap kompatibel atau diubah serentak di semua pemanggil.

## 11. Kriteria penerimaan

1. Email target `User@example.com` dan email terverifikasi `user@example.com` dianggap cocok.
2. Email target `user@example.com` dan email terverifikasi `other@example.com` ditolak; tidak ada record akun baru atau perubahan pada record existing.
3. Jika hasil Playwright tidak memiliki email terverifikasi, akun tidak disimpan.
4. Relogin dengan email cocok mempertahankan ID akun existing dan memperbarui sesi.
5. Relogin dengan email berbeda tidak mengubah email, ID, kredensial, status, atau kredit akun existing.
6. Rotasi cookie/token dengan email terverifikasi yang sama memperbarui akun yang sama, bukan membuat duplikat.
7. Batch dengan satu mismatch dan satu login valid menyimpan item valid dan melaporkan mismatch sebagai gagal.
8. Dua item batch yang menghasilkan email terverifikasi sama tidak membuat dua akun.
9. Kegagalan Google Sheets tidak ditampilkan sebagai sukses tersimpan.
10. Pesan error, status polling, dan log UI/server tidak mengandung password, cookie, atau token.
11. Import cookie yang emailnya terverifikasi tetap dapat menambahkan akun Web tanpa target email input.
12. Import API key AI Studio tetap mengikuti mekanisme yang berlaku dan tidak terkena validasi email Playwright.

## 12. Skenario uji minimum

- Add baru dengan email cocok (termasuk variasi kapitalisasi dan spasi tepi).
- Add dengan email akun Google berbeda dari input.
- Add tanpa email identitas yang dapat diverifikasi.
- Relogin sukses pada akun existing dengan ID dan saldo kredit dipertahankan sesuai hasil sinkronisasi ledger.
- Relogin ke email Google berbeda dari akun yang dipilih.
- Batch campuran: sukses, mismatch, akun existing yang dilewati, dan hasil duplicate.
- Kegagalan persist local/Sheets setelah verifikasi.
- Import cookie valid dan verifikasi API key AI Studio untuk memastikan jalur non-Playwright tidak berubah.
- Pemeriksaan log/error untuk memastikan data rahasia tersensor.

## 13. Catatan implementasi dan observabilitas

- Aturan pencocokan identitas harus berada pada batas server sebelum penyimpanan; UI boleh memberi validasi tambahan tetapi bukan satu-satunya kontrol.
- Endpoint Settings browser dan route CLI terautentikasi harus menggunakan helper/aturan validasi yang sama atau perilaku yang dibuktikan setara.
- Penyimpanan akun dan sinkronisasi kredit merupakan tanggung jawab berbeda: kegagalan ledger tidak boleh mengubah hasil identitas, dan identitas mismatch tidak boleh diteruskan ke sinkronisasi/persist.
- Log boleh mencatat session ID, status, dan alasan mismatch yang telah disanitasi, tetapi tidak mencatat password, cookie, token, atau kredensial.
- Jika profil/kredensial untuk email target telah dibuat sebelum mismatch diketahui, implementasi harus menentukan kebijakan pembersihan aman tanpa menghapus profil lain atau merusak profil existing. Minimal, kredensial mismatch tidak boleh dipakai untuk relogin.
- Sebelum implementasi, verifikasi apakah Settings persist satu kali melalui callback UI atau endpoint server agar tidak terjadi penulisan ganda yang menghasilkan record tidak konsisten.
