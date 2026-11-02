# PRD — Pembacaan dan Perhitungan Kredit Gemini

**Status:** Disetujui; kredit bersumber dari ledger lokal task aplikasi, validasi TypeScript dan helper ledger lulus  
**Tanggal:** 1 November 2026  
**Cakupan:** Perhitungan, pembacaan, sinkronisasi, dan tampilan kredit akun Gemini untuk generate video di Canvas, Chat, dan menu Generate

## 1. Ringkasan

Saat ini batas kredit aplikasi yang benar adalah **2 kredit per akun Gemini**. Satu generate video yang berhasil melalui jalur aplikasi normal memakai satu kredit. Pengecualian: generate CLI yang memakai izin test khusus tidak mengubah ledger kredit internal. Kredit merupakan jatah internal aplikasi per akun yang tidak reset harian; kredit bukan jumlah proses yang boleh berjalan bersamaan. Aturan satu proses aktif per akun diatur terpisah dari perhitungan kredit.

Pengujian membuktikan pemindaian riwayat Gemini dapat menghitung dua representasi aset dari satu video sebagai dua video. Karena itu kredit internal sekarang hanya bersumber dari task generate yang dicatat AMB Media; sync memverifikasi sesi dan membaca ledger lokal, tanpa memindai riwayat Google.

## 2. Masalah

Pembacaan kredit Gemini tersebar antara server, browser, halaman Settings, dan pembaca riwayat Gemini:

- Batas internal di `src/lib/provider.ts` dan `server/providers/gemini.ts` adalah `2`.
- Pada saat audit, pembaca riwayat dan sebagian UI masih memakai batas `3` atau fallback saldo penuh.
- Istilah “daily”/“hari ini” pada kontrak lama berisiko memberi kesan saldo direset setiap hari.
- Pembacaan riwayat dapat salah menghitung aset varian dari satu video dan lambat karena harus memeriksa banyak chat.

Karena itu pemindaian riwayat bukan sumber kebenaran saldo internal.

## 3. Tujuan

1. Memastikan seluruh jalur aplikasi memakai batas **2 kredit per akun Gemini**.
2. Menghitung satu task video yang diterima maksimal satu kali, termasuk setelah polling berulang atau sinkronisasi ulang.
3. Menampilkan sisa kredit yang konsisten di seluruh halaman dan setelah reload.
4. Memisahkan jatah kredit dari status akun aktif, status sesi, status proses, dan lock satu proses aktif per akun.
5. Menghindari pemberian kredit kembali hanya karena pembacaan Google gagal atau riwayat yang terbaca tidak lengkap.
6. Mengidentifikasi serta memigrasikan catatan pemakaian lama tanpa menaikkan kredit secara tidak sengaja.

## 4. Bukan tujuan

- Mengubah aturan satu proses generate aktif per akun; aturan tersebut tetap menjadi bagian terpisah dari lock/lease.
- Menetapkan atau mengubah kuota resmi Google Gemini. Kredit di dokumen ini adalah jatah internal aplikasi, bukan representasi jaminan kuota Google.
- Mengubah kredit untuk provider lain atau produk Gemini selain generate video, kecuali penggunaan helper bersama memang perlu diselaraskan dan telah dikonfirmasi.
- Mengubah format prompt, model, media, akun, atau metode autentikasi.
- Menghapus riwayat generate atau mereset kredit akun yang sudah digunakan.

## 5. Aturan produk yang menjadi patokan

### 5.1 Rumus kredit

- Total jatah internal: `2 kredit per akun`.
- Biaya: `1 kredit untuk setiap task generate video yang diterima untuk diproses`.
- `used` adalah jumlah task yang diperhitungkan, dibatasi antara `0` dan `2`.
- `remaining = max(0, 2 - used)`.
- `totalCredits` selalu `2`.
- Jatah ini **tidak reset berdasarkan pergantian tanggal**.
- Satu kredit tidak berarti satu proses aktif. Proses aktif per akun tetap maksimum satu, sekalipun sisa kredit akun masih `2`.

### 5.2 Siklus pengenaan kredit

1. Sebelum submit, aplikasi memeriksa sesi akun dan sisa kredit.
2. Sebelum Google menerima task, sistem boleh membuat reservasi sementara untuk mencegah dua request mengambil kredit terakhir secara bersamaan. Reservasi belum menjadi pemakaian permanen.
3. Setelah task diterima/terdaftar oleh Google, kredit dicatat tepat satu kali menggunakan ID task/operation yang stabil.
4. Task sukses tetap dihitung satu kredit.
5. Kegagalan yang dipastikan terjadi sebelum task diterima tidak memakai kredit.
6. Task yang telah diterima lalu gagal karena kesalahan proses non-kuota dapat di-refund satu kali setelah server memastikan task terminal.
7. Penolakan kuota Google tidak menghabiskan kredit internal karena bukan generate sukses melalui AMB Media; task yang sempat direservasi dikembalikan setelah kegagalan terkonfirmasi.
8. Jika status submit/polling tidak diketahui, jangan mengurangi atau mengembalikan kredit berulang kali. Pertahankan status tidak diketahui dan rekonsiliasi task sebelum mengizinkan penggunaan kredit itu kembali.
9. Retry yang membuat task baru merupakan task baru; setiap task baru yang diterima dapat memakai satu kredit. Retry submit yang sama dengan ID task yang sama tidak boleh dihitung dua kali.

### 5.3 Identitas akun

Catatan kredit harus mengacu pada identitas akun Google yang kanonis, bukan hanya ID lokal akun pada browser. Bila satu akun yang sama muncul dengan beberapa ID lokal, email Google yang tervalidasi harus mengarah ke catatan pemakaian yang sama. Token/cookie/API key rahasia tidak boleh ditulis ke log.

## 6. Implementasi saat ini

### 6.1 Batas internal dan ledger server

- `src/lib/provider.ts` menetapkan `GEMINI_MAX_CREDITS = 2`.
- `server/providers/gemini.ts` juga menetapkan batas `2`.
- Server menyimpan pemakaian di `data/gemini_daily_usage.json` untuk kompatibilitas. Saldo tidak direset berdasarkan `date`.
- Record ledger menyimpan `used`, `completedTaskIds`, `chargedTaskIds`, dan `refundedTaskIds`; ID task aktif menentukan pemakaian dan dibatasi ke `0–2`.
- Setelah Google menerima task, kredit dicatat sebagai reservasi lokal menggunakan ID task/operation. Task sukses menandai reservasi selesai; kegagalan terminal mengembalikannya tepat satu kali. Status tidak diketahui tetap menahan reservasi.
- Nilai `externalUsed` legacy diabaikan. Migrasi membangun ulang pemakaian dari ID task aplikasi aktif dan membuat backup `.pre-local-ledger.bak`.

Nama file/fungsi lama serta `usedToday` masih dipertahankan sementara sebagai kontrak kompatibilitas; nilainya tidak me-reset kredit harian. Server juga mengembalikan `used` dan `ledgerKnown`.

### 6.2 Relogin Playwright dan saldo

Bug saldo kembali penuh berasal dari objek Playwright yang membawa nilai awal dan merge Settings yang dapat menimpa kredit akun lama. Kini sesi hasil Playwright disinkronkan ke ledger berdasarkan email Google; saldo lama dipertahankan bila ledger belum terkonfirmasi, ID akun lokal tetap stabil, dan saldo yang tidak diketahui tidak dianggap penuh.

Google Sheets dinormalisasi ke batas `2`. Bila ledger cocok, ledger menjadi sumber nilai; bila tidak cocok, saldo tersimpan dipertahankan dan nilai yang tidak ada menjadi `0`, bukan saldo penuh.

### 6.3 Riwayat Google Gemini (diagnostik saja)

`script-gemini/gemini_chat.cjs` dan skrip Console di `debug-tes-gemini` dapat dipakai untuk investigasi manual, tetapi hasilnya tidak dipakai sinkronisasi atau keputusan saldo:

- satu video dapat muncul sebagai beberapa representasi aset, sehingga jumlah hasil scan bukan bukti jumlah generate;
- sync akun tidak memanggil pemindai chat dan tidak menampilkan hitungan riwayat;
- penggunaan langsung di situs Gemini di luar AMB Media tidak tercermin pada kredit internal;
- kuota Google tetap dapat menolak generate; penolakan dicatat sebagai status/error Google, bukan sebagai pemakaian kredit AMB Media.

Nama kontrak lama seperti `countTodayGenerations`/`usedToday` masih digunakan agar pemanggil lama tetap kompatibel, tetapi hitungannya adalah rekonsiliasi jatah seumur pemakaian, bukan reset harian.

### 6.4 Sinkronisasi akun dan tampilan

- `POST /api/gemini/accounts/sync-daily` (nama route kompatibilitas) memverifikasi sesi Google dan mengembalikan kredit dari ledger lokal; route tidak memindai riwayat Google.
- Generate video ditolak server jika belum ada catatan ledger yang terkonfirmasi; cache UI tidak dapat memberi saldo baru ke server.
- `src/App.tsx` menggunakan respons generate/polling atau endpoint sync untuk memperbarui `credits`, `creditsUsed`, dan `totalCredits` di browser.
- Settings, Chat, Canvas, Sidebar, dan account manager menggunakan batas `2`; fallback kredit yang tidak diketahui tidak lagi ditampilkan sebagai `2`.
- Nilai di `localStorage` merupakan cache tampilan/pemilihan akun, bukan sumber kebenaran untuk memutuskan apakah generate boleh dilakukan.
- Akun yang gagal verifikasi sesi ditandai kedaluwarsa dan kreditnya dapat ditampilkan `0`; status ini harus dibedakan dari akun aktif yang kreditnya memang habis.
- Respons sync membawa `ledgerKnown`; pada relogin atau verifikasi, client hanya menerima saldo server jika status ledger diketahui, selain itu mempertahankan saldo lama atau memakai `0` untuk akun baru.
- Status ledger yang belum diketahui ditampilkan sebagai “Belum sinkron” pada Settings, Chat, dan pemilih akun Canvas.
- Pengecualian khusus CLI test: task yang dibuat melalui route CLI terautentikasi dapat melewati pemakaian kredit internal, tetapi harus tetap menggunakan sesi aktif dan lock akun. Task tersebut tidak boleh mengubah pemakaian maupun riwayat kegagalan akun; generate melalui UI tetap mengikuti ledger normal.

### 6.5 Prioritas akun berdasarkan kegagalan generate

- Server menyimpan ID task/percakapan yang berakhir sebagai kegagalan generate terkonfirmasi pada ledger akun lokal.
- Saat generate video dimulai, akun tanpa kegagalan aktif dicoba lebih dahulu. Akun yang memiliki kegagalan tetap disertakan sebagai fallback bila tidak ada akun bersih yang tersedia.
- Kegagalan dianggap terkonfirmasi jika Gemini membuat percakapan tetapi tidak mengonfirmasi proses video dimulai, atau polling berhasil membaca penolakan/error terminal tanpa video.
- Error jaringan, status polling yang belum diketahui, timeout yang hasilnya belum pasti, dan penolakan kuota/kapasitas sementara tidak menurunkan prioritas akun.
- Setelah satu video sukses dari suatu akun, riwayat kegagalan aktif akun itu dibersihkan. Informasi kegagalan tidak memengaruhi saldo kredit.
- Urutan akun stabil untuk kandidat dengan status kegagalan yang sama; prioritas ini tidak mengubah aturan satu proses aktif per akun maupun pemeriksaan kredit.
- Task CLI dalam mode test tidak menambah atau membersihkan riwayat kegagalan akun.

## 7. Perilaku yang diterapkan

### 7.1 Sumber kebenaran

1. Ledger server menjadi sumber kebenaran untuk pemakaian task yang dibuat melalui aplikasi.
2. Ledger mengikat pemakaian ke identitas akun kanonis dan ID task; setiap perubahan pemakaian harus idempoten.
3. Riwayat Google tidak digunakan untuk menghitung kredit internal.
4. Penggunaan langsung di Gemini di luar aplikasi tidak mengubah ledger AMB Media.
5. Status Google yang menolak atau belum dapat memastikan task tidak mengubah ledger; reservasi task yang belum pasti tetap ditahan sampai status terminal diketahui.
6. Cache browser hanya menampilkan nilai terakhir yang diterima dari server. Cache tidak boleh meningkatkan kredit akun dengan sendirinya.
7. Relogin/reauth hanya memperbarui sesi, token/cookie, dan metadata autentikasi. Saldo setelah relogin harus dibaca dari ledger server memakai identitas akun kanonis dan tidak boleh diinisialisasi ke `2` hanya karena autentikasi berhasil.
8. Jika relogin sukses tetapi ledger belum dapat ditemukan/dibaca, saldo lama akun harus dipertahankan dan hasil rekonsiliasi ditandai belum diketahui. Jangan menggunakan saldo penuh sebagai fallback untuk akun yang sudah terdaftar.
9. Jika identitas email/akun berubah atau tidak tervalidasi, jangan membuat akun baru dengan saldo penuh secara diam-diam. Cocokkan melalui identitas kanonis yang aman; jika belum dapat dipastikan, minta rekonsiliasi eksplisit tanpa menghapus saldo lama.
10. Server menolak generate video sebelum ledger akun diketahui. Pengguna harus menyinkronkan akun terlebih dahulu; nilai cache/browser tidak boleh dipakai untuk menginisialisasi ledger.

### 7.2 Format dan kompatibilitas data

- Data baru memakai semantik yang tidak menyiratkan reset harian, misalnya `used`, `totalCredits`, `remainingCredits`, `taskIds`, dan status rekonsiliasi.
- Selama masa transisi, server boleh mengembalikan `usedToday`/`usedTotal` sebagai alias kompatibilitas, tetapi nilainya harus mengikuti rumus jatah dua kredit yang sama dan dokumentasinya tidak boleh mengklaim reset harian.
- Bila field lama dipertahankan, client baru harus memprioritaskan `used`/`remainingCredits` yang bermakna jelas.
- Nilai kredit yang diterima UI selalu dinormalisasi ke rentang `0–2`.
- Nilai `totalCredits` yang hilang pada data lama dinormalisasi menjadi `2`.

### 7.3 Migrasi catatan lama

- Migrasi tidak mereset pemakaian yang sudah tercatat.
- `used` lama dihitung ulang dari union ID task aplikasi aktif, dikurangi ID task yang sudah di-refund, dan dibatasi ke rentang `0–2`.
- Nilai legacy `externalUsed` maupun angka `used` tanpa ID task aplikasi tidak menjadi pemakaian; ini menghapus salah hitung riwayat eksternal.
- ID task yang sudah ada dipertahankan dan dideduplikasi.
- Record tidak boleh digabung hanya berdasarkan nama tampilan. Gunakan email tervalidasi/identitas kanonis; konflik identitas yang tidak dapat dipastikan harus dicatat untuk rekonsiliasi, bukan menggabungkan dua akun secara otomatis.
- Migrasi harus aman dijalankan lebih dari sekali.
- Sebelum mengubah bentuk file ledger, sediakan backup/rollback dan pastikan file lama tetap dapat dibaca selama proses deployment bertahap.

### 7.4 Relogin dan penyimpanan akun

- Jalur relogin tidak boleh menyetel `credits` atau `creditsUsed` berdasarkan nilai default dari hasil Playwright.
- Setelah Playwright mengembalikan sesi baru, server/UI harus melakukan sync ledger untuk identitas akun tersebut dan menggabungkan metadata baru dengan saldo kanonis hasil sync.
- Penggabungan akun lama dan hasil relogin harus mempertahankan `id` lokal akun yang sudah ada, kecuali ada migrasi ID yang disengaja.
- Bila sync ledger gagal, pertahankan `credits`, `creditsUsed`, dan `totalCredits` lama; jangan menggantinya dengan default.
- Alur tambah akun baru boleh memulai dari `2/2` hanya setelah memastikan akun belum memiliki ledger/pemakaian sebelumnya. Akun yang dikenali sebagai akun lama tidak dianggap baru hanya karena token/cookie atau ID lokal berubah.
- Penyimpanan Google Sheets tidak boleh menjadi jalur yang mereset saldo: default Gemini `2`, dan jika ledger account usage tidak ditemukan maka gunakan nilai yang telah diverifikasi/tersimpan atau tandai belum diketahui; jangan mengarang `2` untuk akun lama.
- Semua jalur relogin, add account, import, refresh, load, dan save harus memakai aturan identitas serta normalisasi kredit yang sama.

## 8. Persyaratan fungsional

| ID | Prioritas | Persyaratan |
|---|---|---|
| CR-01 | P0 | Semua jalur generate video Gemini memakai total internal `2` dan biaya `1` per task yang diterima. |
| CR-02 | P0 | Tidak ada aturan `>= 3`, fallback total `3`, atau label kredit harian yang memengaruhi keputusan penggunaan kredit. |
| CR-03 | P0 | Task yang sama dihitung maksimal satu kali berdasarkan ID task/operation yang stabil. |
| CR-04 | P0 | Kegagalan sebelum task diterima tidak memotong kredit; setiap kegagalan terminal yang terkonfirmasi setelah reservasi mengembalikan kredit maksimal sekali. |
| CR-05 | P0 | Status task yang tidak diketahui tidak menyebabkan kredit dikembalikan, dipotong berulang, atau akun dianggap punya kredit lebih dari ledger. |
| CR-06 | P0 | Pemakaian disimpan dan dibaca berdasarkan identitas akun kanonis yang konsisten antara verifikasi, generate, polling, dan sync. |
| CR-07 | P0 | Sinkronisasi kredit tidak memindai riwayat Google dan hanya membaca ledger lokal task aplikasi. |
| CR-08 | P1 | Semua UI menampilkan `sisa / 2`, pemakaian, dan status akun secara konsisten; kredit habis dibedakan dari sesi kedaluwarsa. |
| CR-09 | P1 | Nama field/label yang dipertahankan untuk kompatibilitas dijelaskan dan tidak disalahartikan sebagai reset harian. |
| CR-10 | P1 | Migrasi menghitung pemakaian dari ID task lokal, mengabaikan angka eksternal legacy, membuat backup, dan aman dijalankan berulang kali. |
| CR-11 | P1 | Pengurangan, refund, rekonsiliasi, dan kegagalan sync tercatat dengan log aman tanpa kredensial. |
| CR-12 | P1 | Kebijakan kredit video tidak secara tidak sengaja mengubah atau mengklaim kuota untuk generate gambar/API key Gemini yang memakai billing Google tersendiri. |
| CR-13 | P0 | Relogin Playwright memperbarui sesi tanpa mengembalikan kredit akun lama ke `2`; saldo mengikuti ledger server. |
| CR-14 | P0 | Akun yang sudah terdaftar tidak menggunakan default saldo penuh jika sync/lookup ledger gagal atau identitas akun belum dapat dipastikan. |
| CR-15 | P0 | Jalur Google Sheets tidak memiliki default Gemini `3` atau kalkulasi saldo `3 - used`; kegagalan pencocokan ledger tidak menaikkan saldo. |
| CR-16 | P1 | Akun yang benar-benar baru dibedakan dari akun lama yang token/cookie/ID lokalnya berubah, dan riwayat pemakaian akun tetap dipertahankan. |
| CR-17 | P0 | Server tidak mengizinkan generate video saat ledger akun belum diketahui; Settings/UI menampilkan status belum sinkron. |
| CR-18 | P1 | Generate video mendahulukan akun tanpa riwayat kegagalan terkonfirmasi yang masih aktif, tetapi tetap mencoba akun bertanda gagal sebagai fallback. |
| CR-19 | P1 | Error jaringan/status unknown dan penolakan kuota/kapasitas sementara tidak dicatat sebagai kegagalan akun; keberhasilan video menghapus tanda gagal akun tersebut. |

## 9. Kriteria penerimaan

1. Akun baru mendapat ledger lokal `2/2` setelah sesi berhasil diverifikasi.
2. Satu task video yang diterima menampilkan `1/2`; dua task berbeda yang diterima menampilkan `0/2`.
3. Polling task yang sama berulang kali tidak menurunkan kredit lebih dari satu kali.
4. Dua request yang bersaing untuk kredit terakhir tidak dapat membuat ledger menjadi negatif atau memberikan pemakaian ganda yang tidak terikat ke task.
5. Kegagalan sebelum Google menerima task berakhir dengan kredit tidak berubah.
6. Task yang diterima lalu gagal secara terminal mengembalikan satu kredit; polling/refund berulang tidak menambah kredit di atas `2`.
7. Task dengan status tidak diketahui mempertahankan catatan dan tidak memperoleh refund otomatis.
8. Sync akun tidak membaca daftar chat/riwayat video Google, dan mengembalikan sisa kredit lokal tanpa delay scan.
9. Riwayat Google yang menunjukkan dua aset untuk satu video tidak mengubah kredit internal.
10. Data legacy dimigrasikan berdasarkan ID task aplikasi aktif; `externalUsed` dan `used` tanpa ID task tidak menghabiskan kredit.
11. Canvas, Chat, menu Generate, dan Settings menampilkan angka yang sama setelah sinkronisasi dan reload.
12. Mengganti tanggal tidak mengembalikan kredit internal; generate manual di situs Gemini tidak dihitung sebagai penggunaan AMB Media.
13. Status lock proses aktif tidak mengubah jumlah kredit; akun dengan `2/2` tetap hanya boleh menjalankan satu proses aktif pada satu waktu.
14. Akun lama dengan `0/2` melakukan relogin Playwright sukses: autentikasi menjadi aktif, tetapi saldo tetap `0/2`.
15. Akun lama dengan `1/2` melakukan relogin Playwright sukses: saldo tetap `1/2`; token/cookie baru tersimpan dan ID lokal akun tetap stabil.
16. Jika ledger tidak tersedia saat relogin akun lama, kredit lama tidak berubah menjadi `2`; UI menunjukkan saldo terakhir atau status belum tersinkron.
17. Akun baru yang belum pernah terdaftar atau digunakan mendapat `2/2` setelah verifikasi, bukan karena jalur relogin atau load Sheets mengasumsikan saldo penuh.
18. Menyimpan dan memuat ulang daftar akun Gemini dari Google Sheets tidak mengubah `0/2` atau `1/2` menjadi saldo yang lebih tinggi.
19. Akun dengan ledger yang belum diketahui tidak dapat memulai generate video sampai sync berhasil; UI membedakannya dari akun yang terkonfirmasi habis kredit.

## 10. Pengujian dan status validasi

- Uji unit rumus normalize, increment, idempotensi task, refund, batas nilai, dan migrasi.
- Uji migrasi legacy dengan `externalUsed`, `used` tanpa task ID, ID task duplikat, dan ID task yang di-refund.
- Uji endpoint sync untuk sesi Web, API key, akun kedaluwarsa, dan ledger lokal tanpa memanggil scanner riwayat.
- Uji integrasi generate → polling → selesai/gagal/refund agar seluruh permukaan menghasilkan sisa kredit identik.
- Uji relogin Playwright untuk akun lama bersaldo `0`, `1`, dan `2`; pastikan token/sesi diperbarui tanpa mengubah saldo ledger.
- Uji relogin dengan lookup ledger gagal, email berubah, cookie baru, dan ID lokal akun baru; pastikan tidak ada reset saldo maupun penggabungan akun yang tidak aman.
- Uji load/save Google Sheets dengan ledger ditemukan, tidak ditemukan, nilai legacy `3`, saldo `0`, dan saldo `1`.
- Uji regresi Canvas, Chat, menu Generate, Settings, pemilihan akun, lease/lock, dan akun dengan kredit nol.
- Uji prioritas: akun bersih mendahului akun bertanda gagal; bila semua akun gagal sebelumnya, urutan tetap stabil dan akun tetap dicoba.
- Uji bahwa no-start dan error terminal tanpa video menandai akun; status polling unknown, timeout, kuota, dan kapasitas sementara tidak menandainya; keberhasilan menghapus tanda gagal.
- Pastikan tanggal/waktu Jakarta tidak memicu reset, karena kebijakan ini bukan kuota harian.
- Audit semua literal batas `3` yang terkait Gemini untuk memastikan tidak ada aturan bisnis aktif yang tertinggal; literal yang tidak terkait kredit video harus diberi alasan dan tidak diubah tanpa kebutuhan.

Validasi implementasi yang dijalankan:

- `npm run lint` — lulus (`tsc --noEmit`).
- Uji helper ledger — lulus: `externalUsed` legacy diabaikan, ID task aktif dihitung sekali, dan task yang di-refund dikecualikan.
- `node --check` — lulus untuk CLI Gemini, client Gemini Web, dan skrip diagnostik Console.

Build produksi serta pengujian end-to-end live terhadap Google/Playwright dan skenario polling/refund belum dijalankan; lakukan uji manual dengan akun uji sebelum deployment.

## 11. Area kode implementasi

- `src/lib/provider.ts` — konstanta batas kredit UI.
- `server/providers/gemini.ts` — ledger, identitas akun, reservasi, increment, refund, sync, dan respons endpoint.
- `script-gemini/gemini_chat.cjs` — generate video dan pembacaan riwayat untuk diagnostik manual (bukan sumber kredit).
- `src/App.tsx` — sinkronisasi kredit dari generate dan polling.
- `src/components/GlobalSettingsView.tsx` — verifikasi/sync akun, merge saldo relogin, dan tampilan kredit.
- `src/components/gemini/GeminiPlaywrightAddAccount.tsx` — polling relogin, sinkronisasi ledger, dan callback akun.
- `server/services/geminiPlaywright.ts` — metadata akun Playwright; saldo kanonis dipastikan melalui endpoint ledger.
- `server/utils/sheets.ts` — normalisasi/round-trip saldo akun dengan prioritas ledger.
- `src/lib/geminiAccountManager.ts` — normalisasi cache dan kelayakan akun untuk generate.
- `src/components/CanvasView.tsx`, `src/components/canvas/CanvasInspectorPanel.tsx`, `src/components/ChatView.tsx`, `src/components/DesktopSidebar.tsx`, dan `src/App.tsx` — tampilan, pemilihan akun, serta sinkronisasi saldo.
- Jalur penyimpanan akun server/Google Sheets — kompatibilitas field `credits`, `creditsUsed`, dan `totalCredits`.

## 12. Keputusan produk yang sudah disetujui

1. **Sumber kredit:** hanya ledger task generate AMB Media; generate manual di Gemini tidak dihitung.
2. **Penolakan kuota Google:** tidak menghabiskan kredit internal; reservasi task dikembalikan bila task dipastikan gagal.
3. **API key:** kebijakan dua kredit internal berlaku jika ada jalur generate video melalui API key. Pada arsitektur sekarang, generate video menggunakan sesi Gemini Web; aturan ini tidak mengubah generate gambar atau billing/kuota umum Google.
4. **Prioritas kegagalan:** hanya kegagalan generate video yang terkonfirmasi menurunkan prioritas akun, dan tanda tersebut bertahan sampai generate sukses berikutnya dari akun yang sama. Kuota/kendala kapasitas sementara dan status yang belum diketahui tidak dihitung sebagai riwayat gagal.

Saldo adalah lifetime/non-resetting dan aturan satu proses aktif per akun tetap dipisahkan dari ledger kredit.

Jika keputusan produk berbeda, revisi bagian terkait sebelum implementasi agar perilaku kredit tidak ambigu.
