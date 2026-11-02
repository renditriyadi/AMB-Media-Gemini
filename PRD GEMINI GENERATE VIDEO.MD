# PRD — Gemini Video: Satu Akun untuk Satu Proses Generate

**Status:** Implementasi server, integrasi, alokasi akun per-node Canvas, dan tampilan operation ID selama render Canvas telah diterapkan
**Tanggal analisis:** 1 November 2026  
**Cakupan:** Node Gemini Omni Flash di Canvas dan semua jalur generate video Gemini di Canvas, Chat, serta menu Generate  
**Perubahan kode:** Implementasi server dan integrasi telah diterapkan. Planner akun Canvas, preview per-node, konflik pilihan manual, assignment untuk Run Selected, serta penayangan operation ID internal `web_...` saat node Canvas merender telah diterapkan. Server tetap menjadi enforcement final untuk bentrok lintas permukaan.

## 1. Ringkasan

Aturan produk tetap: kredit `2` berarti masih ada dua kredit untuk dipakai sepanjang kebijakan kuota, bukan izin menjalankan dua render bersamaan pada akun yang sama. Implementasi awal menambahkan server lock untuk mencegah proses aktif ganda. Uji UI setelah perubahan menunjukkan masih ada gap terpisah: dua node Canvas dalam mode Auto tetap menampilkan akun prioritas yang sama sebelum run.

Aturan produk yang diusulkan:

> **Satu akun Google Gemini hanya boleh mempunyai satu proses generate video yang masih aktif.**

Jika sebuah akun sedang dipakai, scheduler harus memilih akun lain yang bebas. Jika semua akun yang layak sedang dipakai, request menunggu dalam antrean dan baru dimulai ketika akun tersedia. Aturan ini berlaku bersama untuk Canvas, Chat, menu Generate, dan request video Gemini lain yang memakai endpoint yang sama.

Amendemen UI yang diminta: ketika node Gemini Omni Flash Canvas menerima konfirmasi hand-off dan task ID dari server, tampilkan ID task Web Gemini yang diawali `web_` pada node selama video masih dirender. Tujuannya agar pengguna dapat membedakan task yang sudah diterima Google untuk diproses dari request yang baru dikirim atau yang sudah selesai.

## 2. Masalah pengguna

Pengguna dapat memilih beberapa node Gemini Omni Flash lalu menjalankannya sekaligus. Setiap node dapat memakai akun Gemini yang sama, padahal pengguna menghendaki satu proses generate aktif per akun. Contoh: akun A mempunyai 2 kredit; dua request yang berjalan bersamaan tetap dapat memakai A yang sama.

Akibatnya, kredit yang cukup tidak menjamin akun aman untuk dipakai paralel. Hasilnya bisa berupa request bertabrakan, kegagalan dari Google, atau perilaku akun yang berbeda antara Canvas dan permukaan generate lain.

## 3. Analisis baseline dan status implementasi

Bagian 3.1–3.5 mencatat akar masalah yang ditemukan sebelum implementasi awal. Status server/browser yang telah berubah dijelaskan pada bagian masing-masing; gap UI terbaru dijelaskan pada 3.6.

### 3.1 Canvas memang menjalankan node independen secara paralel

`Run Selected` di `src/components/CanvasView.tsx` membentuk wave node berdasarkan dependency graph. Node-node independen dalam satu wave dijalankan bersama melalui `Promise.allSettled`. Jadi beberapa node Gemini Video memang dapat mengirim request pada waktu yang hampir bersamaan.

### 3.2 Ada lease/antrean di sisi browser, tetapi cakupannya bukan jaminan server

`acquireGeminiAccountLease()` di `src/lib/geminiAccountManager.ts` memilih akun ber-kredit cukup yang belum direservasi dalam konteks browser tersebut. Jika semua akun yang tersedia sedang di-lease, pemanggil menunggu FIFO hingga ada lease yang dilepas. Kunci browser `navigator.locks`, jika tersedia, juga membantu mencegah pemakaian bersamaan antar-tab pada origin yang sama.

Node Gemini Video Canvas, jalur generate video Chat, dan menu Generate utama sudah memanggil pengelola lease. Implementasi awal juga menambahkan server lock berbasis file agar endpoint video memeriksa akun aktif terlepas dari lease browser. Lock server menjadi batas akhir; lease browser tetap berguna untuk pemilihan awal/UI, tetapi assignment Canvas tidak dibagikan antar-node.

Identitas lease browser kini memprioritaskan email sebelum ID akun. Jika email tidak tersedia atau identitas akun tidak konsisten antarregistrasi, pemetaan lintas ID tetap perlu diuji; enforcement server menggunakan identitas akun kanonisnya sendiri.

### 3.3 Reservasi di server mengikuti kredit, bukan aturan satu proses

Endpoint `POST /api/gemini/generate-video` berada di `server/providers/gemini.ts`. Pada baseline sebelum implementasi, server hanya menyimpan jumlah reservasi kredit sementara dalam `geminiVideoCreditReservations`, sehingga akun dengan dua kredit dapat memperoleh dua reservasi bersamaan dan reservasi dilepas setelah request submit selesai.

Implementasi awal menambahkan lock server eksklusif per akun, menyimpan lock task aktif di `data/gemini_video_locks`, mengaitkannya dengan operation ID, dan melepaskannya pada respons status terminal. Jika polling tidak dapat memastikan status, endpoint mempertahankan lock dan mengembalikan status processing yang belum diketahui agar tidak memicu generate duplikat. Credit reservation tetap terpisah dan bersifat sementara; bukan pengganti busy lock.

Lock file mengandalkan filesystem bersama untuk koordinasi antarproses. Deployment multi-host dengan filesystem terpisah memerlukan storage lock bersama. Recovery lock yang status task-nya tidak pernah terminal juga memerlukan prosedur operasional; lock tidak boleh dibersihkan otomatis hanya berdasarkan umur tanpa verifikasi task.

### 3.4 Pemilihan akun di Canvas sudah punya prioritas dan fallback, tetapi belum menjadi sumber kebenaran bersama

Node Canvas mengirim akun pilihan sebagai prioritas ke `acquireGeminiAccountLease()`. Jika akun itu tidak tersedia, pemilih dapat memberikan akun lain yang layak; payload Canvas mengosongkan `fallbackAccounts` agar server tidak melakukan rotasi tersembunyi untuk request node tersebut. Server lock mencegah dua task aktif memakai akun yang sama, tetapi pengalokasian antar-node belum dilakukan sebelum request dikirim.

UI node di `src/components/canvas/CanvasInspectorPanel.tsx` menyediakan opsi Auto-Switch dan akun tertentu, tetapi Auto masih menampilkan akun positif pertama dari daftar global. Implementasi awal memperbaiki penyimpanan akun aktual agar terpisah dari `accountId` pilihan node; mode Auto tidak seharusnya berubah menjadi pilihan manual. Inspector belum membaca assignment node lain, sehingga preview beberapa node Auto dapat tetap sama.

### 3.5 Jalur yang tercakup

- **Canvas:** `handleRunSelectedNodes()` menjalankan node independen paralel; `handleRunGeminiVideoNode()` meminta lease dan menjalankan `executeGeminiVideoWithAutoSwitchAndRetry()`.
- **Chat:** jalur video Gemini meminta lease, memanggil `/api/gemini/generate-video`, lalu mem-poll status.
- **Menu Generate:** jalur Gemini meminta lease dan mempertahankannya selama pemrosesan video serta polling/failover.
- **Server:** endpoint video menerima akun utama dan dapat menerima `fallbackAccounts`; lock eksklusif disimpan sampai task terminal, sedangkan reservasi kredit hanya mencakup request submit.

### 3.6 Temuan tambahan dari uji UI Canvas

Pada uji dua node Gemini Omni Flash, panel kanan kedua node sama-sama menampilkan Auto-Switch dengan prioritas akun `belen8619`. Ini sesuai dengan kode UI sebelum implementasi: `CanvasInspectorPanel.tsx` menghitung `currentSelectedAccount` dari daftar akun Gemini dan memilih akun pertama dengan kredit di atas nol. Perhitungan tersebut tidak membaca node Gemini lain di recipe, tidak mengetahui akun yang sedang diprioritaskan node lain, dan tidak mengalokasikan akun khusus untuk node yang sedang dilihat.

Lease akun baru diminta ketika node benar-benar mulai berjalan. Karena itu tampilan Auto di panel adalah preview prioritas global, bukan reservasi atau assignment akun untuk node tersebut. Informasi `currentRunAccountId/currentRunAccountEmail` hanya merekam akun yang dipakai pada run, sehingga tidak menyelesaikan kebutuhan pengguna untuk melihat dan memilih alokasi sebelum run.

**Perilaku yang diminta dan diterapkan:** setiap node Gemini Video di Canvas menampilkan akun yang direncanakan, akun yang dialokasikan kepada node lain, dan status antre/konflik. Auto menghindari akun yang telah dialokasikan pada preview recipe; `Run Selected` merencanakan ulang tiap wave sebelum menjalankan node. Pilihan manual yang bentrok meminta konfirmasi dan tetap terlihat sebagai konflik. Enforcement server tetap wajib karena alokasi UI tidak dapat mencegah request dari permukaan lain atau tab lain.

## 4. Tujuan

1. Tidak pernah ada lebih dari satu proses render video Gemini aktif pada akun Google yang sama.
2. Canvas, Chat, menu Generate, retry, dan failover mengikuti aturan pemilihan akun yang sama.
3. Jika akun prioritas sedang sibuk, proses menggunakan akun lain yang bebas bila tersedia.
4. Jika tidak ada akun bebas, proses masuk antrean, bukan memakai ulang akun sibuk.
5. Kredit tetap mengatur apakah akun mampu memulai generate; status sibuk adalah kondisi terpisah.
6. Menampilkan status menunggu/akun yang dipakai dengan jelas, tanpa menganggap request sukses sebelum server mengonfirmasi task.

## 5. Bukan tujuan

- Mengubah generator gambar Gemini atau provider selain generate video Gemini, kecuali ada pemanggilan bersama yang perlu dilindungi agar tidak mem-bypass penguncian video.
- Mengubah kuota/kebijakan kredit harian atau total akun.
- Mengubah cara autentikasi sesi Gemini Web, format prompt, model, atau konfigurasi media.
- Menjalankan beberapa proses bersamaan pada satu akun hanya karena akun tersebut mempunyai lebih dari satu kredit.

## 6. Perilaku produk yang diusulkan

### 6.1 Aturan pemilihan

1. Akun harus memiliki sesi valid, status aktif, kredit minimum, serta tidak sedang memegang proses video aktif.
2. Akun yang dipilih manual menjadi **prioritas**, bukan izin untuk melanggar aturan satu proses. Jika sibuk, scheduler mencoba akun lain yang bebas dan layak.
3. Mode Auto memilih akun bebas berdasarkan aturan prioritas yang konsisten (misalnya akun prioritas/aktif, lalu kredit tersisa tertinggi). Urutan final dapat mengikuti perilaku pemilih yang ada setelah di-review.
4. Bila semua akun layak sedang sibuk, request mengantre FIFO. Akun tidak boleh dianggap bebas hanya karena endpoint generate sudah mengembalikan operation/task ID.
5. Jika semua akun gagal validasi atau kredit tidak cukup, tampilkan kegagalan yang menjelaskan penyebabnya; jangan membuat request cadangan secara diam-diam.
6. Mode Auto pada node Canvas tetap Auto setelah run dan tidak berubah menjadi akun tertentu tanpa pilihan pengguna.

### 6.2 Siklus eksklusivitas

Penguncian akun dimulai sebelum request generate video dikirim dan berakhir hanya ketika task diketahui terminal:

`queued → reserved → submitted/rendering → completed | failed | cancelled`

- Lock mencakup submit, polling, dan seluruh durasi render.
- Retry/failover hanya boleh dimulai setelah task pada akun sebelumnya dinyatakan terminal atau telah ditangani sebagai task tidak diketahui menurut kebijakan recovery.
- Saat berpindah akun untuk retry, akun baru juga harus memperoleh lock sebelum request dikirim.
- Kegagalan request sebelum task diterima harus melepas lock dan tidak mengurangi kredit.
- Request yang timeout atau kehilangan respons setelah kemungkinan diterima Google tidak boleh langsung melepas akun lalu membuat duplikat. Tandai status sebagai belum diketahui dan lakukan rekonsiliasi/polling sebelum akun dipakai ulang, atau ikuti kebijakan timeout yang disetujui.
- Pembatalan dari pengguna tidak boleh menganggap task Google berhenti jika server tidak dapat mengonfirmasi pembatalannya.

### 6.3 Sumber kebenaran dan jangkauan

Lease browser tetap berguna untuk respons UI dan mengurangi request yang menunggu di klien, tetapi enforcement akhir wajib dilakukan di server pada identitas akun Google yang kanonis. Identitas akun harus tetap sama walau ID lokal berbeda, dengan email terverifikasi/session identity sebagai pilihan utama dan fingerprint sesi sebagai fallback yang aman.

Lock harus bekerja lintas Canvas, Chat, menu Generate, tab/browser berbeda, dan jalur request langsung ke endpoint. Jika deployment menjalankan lebih dari satu proses server, penyimpanan lock harus atomik dan dibagi antarproses. Perlu dipastikan pula bagaimana lock/task aktif dipulihkan setelah restart server; lock in-memory saja tidak cukup untuk menjamin satu proses per akun ketika task Google masih berjalan.

Endpoint server tidak boleh memakai fallback account tanpa memperoleh lock untuk akun aktual yang dipakai. Scheduler harus mengembalikan identitas akun terpilih agar UI dapat menampilkan hasil routing dan mempertahankan status yang konsisten.

### 6.4 Antrean dan antarmuka

- Tampilkan state “Menunggu akun Gemini tersedia” pada node/generation yang antre.
- Tampilkan akun yang sedang dipakai setelah akun diberikan dan jangan menampilkan state “running” sebelum ada task yang dikonfirmasi server.
- Saat lease dilepas karena terminal, bangunkan waiter berikutnya.
- Tetap hormati pembatalan antrean bila pengguna membatalkan sebelum task dikirim.
- Berikan alasan eksplisit untuk akun yang tidak layak: sibuk, kredit tidak cukup, sesi invalid, atau status akun tidak aktif.

### 6.5 Alokasi akun Canvas per-node

Pisahkan tiga konsep yang saat ini tercampur/ditampilkan seolah sama:

1. **Pilihan node:** mode Auto atau akun prioritas yang dipilih pengguna dan disimpan dalam data node.
2. **Preview alokasi Canvas:** perkiraan akun berbeda yang dapat dipakai tiap node Gemini Video pada recipe ini, dihitung dari pilihan node dan status akun terbaru. Preview bukan lock server.
3. **Akun proses aktual:** akun yang berhasil memperoleh lock server saat generate dimulai; tampilkan sebagai status run, terpisah dari pilihan node agar mode Auto tidak berubah.

Perilaku UI yang diusulkan:

- Hitung alokasi deterministik untuk node Gemini Video pada Canvas. Untuk mode Auto, node tidak boleh menampilkan kandidat yang sama sebagai akun bebas jika kandidat tersebut sudah dialokasikan ke node lain dalam alokasi Canvas yang sedang ditampilkan/dijalankan dan ada kandidat valid lain.
- Tampilkan nama/email serta label status untuk setiap akun: tersedia, prioritas node ini, dialokasikan ke node lain (dengan nama/ID node), sedang generate, kredit habis, atau sesi tidak valid.
- Dropdown tiap node tetap bisa dibuka untuk memilih akun. Akun yang sudah dialokasikan sebagai pilihan manual oleh node lain ditandai pemiliknya dan tidak dipilih diam-diam oleh Auto. Jika pengguna memilih akun yang sama secara eksplisit, UI harus memberi peringatan bentrok dan meminta konfirmasi/reassignment, bukan menyembunyikan konflik.
- Ketika jumlah node runnable melebihi akun valid yang bebas, pertahankan aturan produk satu proses per akun: alokasikan akun berbeda untuk proses yang bisa berjalan bersamaan; node sisanya masuk antrean dan dapat memakai akun yang sama setelah proses sebelumnya terminal. UI harus memperlihatkan status antrean/urutan tersebut, tidak mengklaim bahwa node sudah mendapat akun eksklusif baru.
- Saat `Run Selected` dimulai, buat rencana alokasi untuk wave node Gemini Video secara atomik sebelum submit. Akun pada wave yang sama harus unik bila ada cukup akun valid; node yang tidak memperoleh akun bebas menunggu scheduler. Akun dari node non-Gemini atau akun yang hanya terlihat pada preview tanpa ikut run tidak boleh dianggap sebagai proses render aktif.
- Pengguna boleh mengganti pilihan node kapan saja sebelum run. Mengubah pilihan harus memperbarui preview dan konflik node lain secara konsisten.
- Akun yang sedang dikunci oleh server karena Chat, menu Generate, tab lain, atau proses server lain tampil sebagai sibuk bila status tersedia dari server. Jika status belum tersedia, keputusan akhir tetap oleh server dan UI harus menangani respons busy/queued secara eksplisit.
- Saat server mengembalikan akun aktual yang berbeda (misalnya akun prioritas menjadi sibuk tepat sebelum submit), tampilkan akun aktual tersebut pada status run dan jangan menimpa pilihan Auto atau pilihan manual node.

Aturan resolusi untuk preview/rencana Canvas:

1. Akun manual yang valid mendapat prioritas pada node pemiliknya; konflik manual antar-node terlihat dan perlu diselesaikan atau dikonfirmasi untuk antre.
2. Node Auto dialokasikan secara deterministik berdasarkan urutan node yang stabil (kiri ke kanan, lalu atas ke bawah, lalu ID) dan prioritas/kredit akun yang telah ada.
3. Akun yang sudah dialokasikan kepada node lebih awal tidak dipakai ulang sebagai assignment paralel bagi node Auto berikutnya selama masih ada akun valid lain yang bebas.
4. Jika akun tidak cukup untuk assignment unik, node tambahan menampilkan “menunggu giliran” dan scheduler boleh menggunakan kembali akun setelah lock proses sebelumnya dilepas.
5. Perubahan data akun, kredit, node, pilihan akun, atau status server harus menghitung ulang preview tanpa mengubah pilihan eksplisit pengguna.

### 6.6 Menampilkan task ID Web Gemini saat render Canvas

**Temuan analisis:** server `POST /api/gemini/generate-video` baru mengembalikan `operationName` berbentuk `web_${webConvId}` setelah response StreamGenerate mengonfirmasi generate video telah dimulai dan task didaftarkan ke background polling (`webVideoTaskTracker`). Log `Gemini Video Request ... video generation notice: yes` menunjukkan percakapan dan indikasi generate; log `Gemini Video Instant Hand-Off ... Sesi task web_... berhasil didaftarkan ke Google Veo` adalah penanda hand-off yang lebih tegas. ID `c_...` adalah conversation ID Gemini; `web_c_...` adalah operation/task ID internal AMB Media yang dipakai untuk polling, bukan ID task resmi yang diterbitkan Google.

Di sisi klien sebelumnya, `executeGeminiVideoWithAutoSwitchAndRetry()` baru menyelesaikan promise setelah polling selesai, sedangkan callback progress tidak meneruskan operation ID. Karena itu node menampilkan label model/durasi sepanjang render. Perubahan sekarang menambahkan callback `onTaskAccepted` yang langsung meneruskan operation ID awal atau retry ke `handleRunGeminiVideoNode()`, lalu mempersistensikannya ke data node untuk render, error, dan inspeksi hasil.

**Implementasi:**

1. Runner memanggil `onTaskAccepted(operationName)` saat response generate/retry sukses berisi operation ID, sebelum polling pertama.
2. Canvas menyimpan ID ke `node.data.operationName` dan recipe. Penanda run menjaga callback terlambat agar tidak menimpa run berikutnya.
3. Selama render, baris metadata model/durasi diganti tombol salin `Task ID · web_...`; header node tetap “Gemini Omni Flash”. Sebelum ID tersedia, metadata semula tetap ditampilkan.
4. ID tetap tersimpan pada node saat sukses/gagal; hasil video menampilkan badge copy ketika di-hover dan state gagal menampilkan ID agar mudah ditelusuri.
5. Retry memperbarui ID ke task terbaru yang diterima. Tidak ada ID UI buatan sebagai pengganti operation ID server; task tanpa ID tidak diklaim sudah diterima.

Perubahan ini hanya untuk visibilitas status penerimaan task. Operation ID `web_...` menandakan AMB Media telah mendaftarkan task hand-off untuk background polling; itu bukan ID task resmi Google maupun bukti video selesai. Polling, lock satu akun satu proses, kredit, retry/failover, dan kebijakan status task tetap berjalan seperti sebelumnya.

## 7. Persyaratan fungsional

| ID | Prioritas | Persyaratan |
|---|---|---|
| FR-01 | P0 | Sistem menolak/menahan generate video baru jika akun kanonis sudah mempunyai proses video aktif, terlepas dari sisa kredit. |
| FR-02 | P0 | Semua permukaan generate video memakai satu kebijakan pemilihan dan eksklusivitas akun. |
| FR-03 | P0 | Akun prioritas yang sibuk dilewati untuk akun bebas; bila tidak ada akun bebas, request menunggu dan tidak mengirim generate ke akun sibuk. |
| FR-04 | P0 | Lock dipertahankan dari sebelum submit sampai status terminal atau recovery status yang eksplisit. |
| FR-05 | P0 | Retry/failover memperoleh lock baru untuk akun tujuan dan tidak membuka celah overlap pada akun yang sama. |
| FR-06 | P0 | Lock server memakai identitas akun kanonis dan berlaku untuk request lintas browser/tab serta request langsung ke endpoint. |
| FR-07 | P1 | UI menunjukkan antrean, akun terpilih, dan alasan kegagalan/penundaan. |
| FR-08 | P1 | Opsi Auto di Canvas tetap tersimpan sebagai Auto setelah eksekusi. |
| FR-09 | P1 | Sistem dapat merekonsiliasi task aktif/berstatus tidak diketahui setelah polling gagal atau server restart; akun tidak segera dianggap bebas secara keliru. |
| FR-10 | P1 | Log operasional mencatat lock acquire/release, account key yang disamarkan, task ID, waktu tunggu, dan alasan failover tanpa mencatat cookie/token rahasia. |
| FR-11 | P0 | Inspector setiap node Gemini Video menampilkan pilihan node, preview akun per-node, dan status assignment/busy secara terpisah. |
| FR-12 | P0 | Auto Canvas memperhitungkan assignment node Gemini Video lain dan tidak menampilkan akun yang telah dialokasikan ke node lain sebagai kandidat bebas bila masih ada akun layak lain. |
| FR-13 | P0 | Pengguna dapat memilih akun per node; konflik assignment manual terlihat jelas dan tidak menyebabkan pergantian akun diam-diam. |
| FR-14 | P0 | `Run Selected` merencanakan alokasi akun untuk wave Gemini Video secara atomik; akun aktual dalam satu wave harus berbeda selama tersedia akun valid yang cukup. |
| FR-15 | P1 | Bila jumlah akun valid lebih sedikit daripada node runnable, node tambahan ditandai antre/menunggu giliran dan baru memakai ulang akun setelah proses sebelumnya selesai. |
| FR-16 | P1 | Preview dan akun aktual saat run tidak mengubah preferensi Auto/manual tersimpan pada node. |
| FR-17 | P1 | Node Gemini Omni Flash Canvas menampilkan operation ID internal AMB Media `web_...` segera setelah hand-off generate dikonfirmasi, selama render belum terminal. |
| FR-18 | P1 | Operation ID tidak dibuat-buat atau salah dilabeli sebagai ID resmi Google; callback task awal maupun retry memperbarui ID aktif dan hasil/error tetap mempertahankan referensi task yang benar. |

## 8. Kriteria penerimaan

1. **Satu akun, dua kredit, dua node Canvas independen:** hanya satu request video pada akun itu yang aktif. Request kedua tetap antre sampai task pertama terminal; setelah itu ia dapat memakai akun yang sama jika kredit masih tersedia.
2. **Dua akun bebas, dua node Canvas independen:** scheduler boleh menjalankan keduanya paralel, tetapi masing-masing memakai akun yang berbeda.
3. **Akun prioritas sibuk, akun lain bebas:** request memakai akun bebas yang lain dan menampilkan akun aktualnya.
4. **Semua akun sibuk:** tidak ada request generate yang dikirim ulang ke akun sibuk; request mengantre dan mulai setelah lock tersedia.
5. **Lintas permukaan:** jika Chat memakai akun A, Canvas dan menu Generate tidak dapat memulai render lain pada A sampai task Chat terminal.
6. **Lintas tab/browser/server worker:** request bersamaan untuk identitas akun Google yang sama tidak memperoleh lock ganda.
7. **Retry:** retry pada akun baru hanya berjalan setelah akun tujuan memperoleh lock; status task lama tetap direkonsiliasi.
8. **Failure sebelum task diterima:** lock dilepas dan kredit tidak terpotong.
9. **Timeout/status tidak diketahui:** akun tidak dilepas secara prematur dan UI menjelaskan status yang belum dapat dipastikan.
10. **Auto Canvas:** setelah node selesai, pilihan akun node masih menunjukkan Auto; akun yang dipakai untuk run dicatat sebagai informasi aktual terpisah bila diperlukan.
11. Tidak ada token/cookie sesi dalam log, pesan UI, atau metadata task yang dapat dilihat pengguna lain.
12. **Dua node Canvas sama-sama Auto:** panel node pertama dan kedua tidak sama-sama menampilkan `belen8619` sebagai akun bebas jika ada akun valid kedua; kandidat node kedua berbeda dan labelnya menjelaskan alokasi node lain.
13. **Pilihan manual bentrok:** jika dua node memilih akun yang sama, kedua inspector mengidentifikasi node pemilik assignment; Run memberi peringatan atau mengantrekan sesuai konfirmasi, tanpa mengirim dua render bersamaan ke akun itu.
14. **Akun lebih sedikit daripada node:** bila dua node runnable hanya memiliki satu akun valid, satu node berjalan dan lainnya jelas berstatus antre; akun yang sama baru dipakai oleh node kedua setelah task pertama terminal.
15. **Perubahan pilihan node:** memilih akun berbeda pada node kanan memperbarui assignment/preview kedua node dan tidak mengubah preferensi tersimpan node kiri.
16. **Aktivitas lintas permukaan:** jika akun prioritas sedang dikunci oleh Chat/menu Generate, UI menandainya sibuk bila diketahui, dan hasil aktual dari server tetap ditampilkan tanpa mengganti mode Auto.
17. **Task Canvas sudah diterima:** setelah server mengembalikan `operationName: web_c_...` dengan status processing, node yang masih running menampilkan `Task ID · web_c_...` di baris metadata sekunder; header tetap “Gemini Omni Flash”. ID dikenali sebagai operation ID internal AMB Media, bukan task ID resmi Google.
18. **Belum ada task ID:** sebelum server mengonfirmasi task, node tetap menampilkan indikator “Membuat Video...” dan tidak menampilkan ID buatan atau conversation ID saja.
19. **Polling dan terminal:** ID terlihat segera, tetap lengkap untuk copy/tooltip, dan tidak menghambat polling. Saat selesai preview menampilkan video; ID tersimpan untuk inspeksi. Jika gagal setelah hand-off, ID tetap tersedia pada detail node.
20. **Retry:** jika task pertama gagal dan runner memulai task baru pada akun lain, ID aktif node berubah ke ID server task baru; ID task lama tidak keliru ditampilkan sebagai task yang sedang berjalan.

## 9. Skenario uji minimum

- Dua node Gemini Video yang tidak saling bergantung pada Run Selected dengan hanya satu akun ber-kredit 2.
- Dua node independen dengan dua akun valid dan kredit cukup.
- Satu akun dipakai dari Chat sementara generate Canvas dimulai; ulangi dalam urutan sebaliknya.
- Dua tab/browser meminta akun yang sama pada waktu hampir bersamaan.
- Akun prioritas sedang dipakai dan opsi akun lain tersedia / tidak tersedia.
- Respons submit gagal sebelum task dibuat, respons hilang setelah submit, polling gagal sementara, polling terminal sukses/gagal, failover, dan pembatalan saat antre.
- Satu Google account yang tercatat dengan ID lokal berbeda, untuk memastikan tidak memperoleh lock ganda.
- Restart server saat ada render aktif, untuk menguji recovery dan pencegahan duplikat.
- Dua node Canvas Auto dengan beberapa akun valid: buka inspector bergantian dan pastikan preview setiap node konsisten serta tidak keduanya mengklaim akun yang sama sebagai bebas.
- Pilihan akun manual pada dua node, termasuk konflik ID akun lokal berbeda namun identitas Google sama.
- Perubahan assignment ketika node ditambah/dihapus, pilihan node diganti, akun ditambah/dihapus, kredit berubah, dan run dibatalkan saat antre.
- Dua atau lebih node Auto dengan akun valid lebih sedikit daripada node; verifikasi label giliran dan reuse akun hanya setelah task sebelumnya terminal.
- Canvas submit yang menerima response processing dengan `operationName: web_...`; verifikasi ID muncul pada node sebelum polling mencapai status terminal.
- Response generate belum memiliki task ID, generate selesai langsung dengan video URL, task gagal setelah hand-off, serta retry yang menerima task ID baru.
- Reload recipe ketika task sedang berjalan setelah ID diterima; pastikan ID task tetap tersedia dan tidak menggantikan pilihan akun atau kredensial.

## 10. Catatan implementasi

Implementasi memisahkan:

- **pilihan node:** preferensi Auto atau manual yang persisten;
- **preview/assignment Canvas:** perencanaan akun per node sebelum submit;
- **kredit/kuota:** hak akun untuk memulai generate berikutnya; dan
- **busy lease:** eksklusivitas satu proses video yang sedang berlangsung; serta
- **operation ID node:** referensi task server yang diterima saat render berjalan, terpisah dari status/progress tampilan dan dari conversation ID.

Jangan menjadikan pengurangan kredit atau preview UI sebagai pengganti lock server. Validasi endpoint server tetap menjadi batas akhir. Preview diperbarui saat recipe/node/pilihan berubah dan saat event pembaruan akun/kredit diterima. Preview belum merupakan feed status busy server untuk proses yang dimulai dari Chat, menu Generate, atau host lain; lock browser/server tetap memutuskan akun aktual jika terjadi race.

## 12. Implementasi amendemen UI

1. **Selesai:** helper planner murni mengalokasikan akun layak secara deterministik, menghormati pilihan manual, menandai konflik, dan mengidentifikasi node antre.
2. **Selesai:** inspector menggunakan planner untuk preview Auto, menampilkan pemilik assignment/status, serta meminta konfirmasi saat pilihan manual menimpa alokasi node lain.
3. **Selesai:** pilihan `accountId` tetap terpisah dari akun run aktual; pilihan node tidak mengubah akun aktif global.
4. **Selesai:** `Run Selected` memakai assignment planner yang sama untuk node terpilih pada setiap wave dan mengirim akun rencana sebagai preferred account kepada lease runner. Lease browser dan lock server tetap menangani race dan antrean.
5. **Selesai:** planner diperbarui saat node/pilihan berubah dan pada event pembaruan daftar akun.
6. **Validasi:** `npm run lint` memeriksa tipe TypeScript. Uji otomatis khusus planner/interaksi UI belum tersedia.
7. **Selesai:** runner mengirim callback saat operation ID awal/retry tersedia; Canvas mempersistensikan ID hanya untuk run yang sesuai; node menampilkan ID yang dapat disalin selama render dan menyimpannya pada hasil/error.

## 11. Referensi kode yang dianalisis

- `src/components/CanvasView.tsx` — `handleRunSelectedNodes()`, `handleRunGeminiVideoNode()`
- `src/components/canvas/CanvasInspectorPanel.tsx` — pilihan akun dan Auto-Switch node
- `src/lib/canvasGeminiAccountPlanner.ts` — helper alokasi akun per-node, konflik manual, dan status antre
- `src/lib/geminiAccountManager.ts` — `acquireGeminiAccountLease()`, antrean dan lock browser
- `src/lib/geminiVideoRunner.ts` — submit, polling, dan retry generate video Gemini
- `src/components/canvas/CanvasNodeCard.tsx` — area preview node Gemini Omni Flash yang saat ini menampilkan status running dan metadata model/durasi/aspect ratio
- `src/components/ChatView.tsx` — generate video Gemini dan polling Chat
- `src/App.tsx` — generate utama serta failover Gemini
- `server/providers/gemini.ts` — `/gemini/generate-video`, `/gemini/video-status`, `geminiVideoCreditReservations`, `webVideoTaskTracker`
- `src/components/canvas/CanvasInspectorPanel.tsx` — preview Auto, pemilik akun, pemilihan manual, konflik, dan antre
- `src/components/CanvasView.tsx` — planner preview Canvas, alokasi wave Run Selected, dan pengiriman preferred account ke lease runner
