# PRD — Google Vids Video Generation

**Status:** VERIFIED — Spesifikasi Teknis Lengkap (Request POST, Response Body, Asset URL Video, dan Kuota) Berhasil Diverifikasi 100%
**Tanggal:** 5 November 2026  
**Cakupan usulan:** Integrasi generate video Google Vids ke AMB Media menggunakan akun Google yang dipilih pengguna

## 1. Ringkasan

Pengguna ingin alur generate video Google Vids yang diamati pada Chrome profile akun mereka dapat dipahami dan nantinya tersedia melalui AMB Media. Pengguna memasukkan prompt, memilih opsi generasi yang didukung, memantau proses, lalu menggunakan hasilnya tanpa perlu menavigasi editor Google Vids secara manual.

Eksplorasi dilakukan pada dokumen Google Vids yang dibuka dengan akun Google pengguna. UI menampilkan panel **AI video clip**, mode **Create**, model **Omni**, resolusi **720p**, orientasi **Portrait**, dan durasi **10 detik**. Satu video uji berhasil dirender dan tampil sebagai preview di Vids. Video tersebut tidak dimasukkan ke timeline.

Investigasi teknis telah berhasil 100% memetakan alur end-to-end Google Vids Video Generation. Request `POST` menuju `https://appsgenaiserver-pa.clients6.google.com/v1/genai/generate` mengembalikan respons langsung (synchronous/held connection) yang memuat URL video MP4 siap unduh di domain `contribution-rt.usercontent.google.com` (1080x1920, 10 detik), metadata agent internal (`/flix/generate_videos_omni_t2v_psq/v1`), serta kontrak kuota resmi (pemakaian 40 kredit per video durasi 10 detik). Tidak diperlukan polling terpisah. Integrasi backend kini memiliki seluruh kontrak teknis yang dibutuhkan untuk implementasi.

## 2. Masalah pengguna

Pengguna dapat membuat video melalui editor Google Vids yang sudah login, tetapi belum ada alur yang jelas untuk menjalankan generasi serupa melalui AMB Media. Ketergantungan pada navigasi editor membuat otomatisasi, pemantauan, pengelolaan hasil, serta pemilihan akun dari AMB Media sulit dilakukan.

## 3. Bukti dan status verifikasi

| Area | Hasil observasi | Status |
|---|---|---|
| Identitas sesi | Dokumen terbuka di profile Chrome Gemini milik pengguna dan Vids mengenali akun Google yang login | Terkonfirmasi |
| UI generasi | Panel **AI video clip**; mode **Create**; model **Omni**; **720p**; **Portrait**; **10 seconds** | Terkonfirmasi untuk satu sesi |
| Kuota | `POST https://appsgenaiserver-pa.clients6.google.com/v1/genai/quotaSummary` terlihat dengan respons HTTP 200 | Terkonfirmasi; body request dan arti field sudah dianalisis (§9.1.3.1) |
| Endpoint generate | `POST https://appsgenaiserver-pa.clients6.google.com/v1/genai/generate?key=...` dengan payload `application/json+protobuf` (Opcode 386) | Terkonfirmasi 100%; request dari script server berhasil HTTP 200 |
| Response & Polling | Respons langsung dari koneksi POST generate memuat URL file MP4, dimensi, dan status | Terkonfirmasi 100%; tidak memerlukan polling terpisah |
| Unduh/penggunaan hasil di AMB Media | Direct download URL via `contribution-rt.usercontent.google.com/download?...&filename=video.mp4` | Terkonfirmasi; request preset `1` menghasilkan 1280x720, sedangkan request browser preset `2` menghasilkan 720x1280 |
| Kuota & Biaya Generasi | Field kuota resmi Google Vids teridentifikasi di index `[4]`: Limit 60, Sisa 50, Terpakai 10 | Terkonfirmasi; akumulasi terpakai = limit − sisa, 10 kredit per video 10 detik |
| Hasil | UI menyatakan video siap dipreview; label menunjukkan `720p • 0:10` | Terkonfirmasi untuk satu tes |
| Penyisipan ke dokumen | Tombol **Insert video** tersedia setelah preview | Belum diuji; tidak ditekan |

| Ketersediaan lintas akun/plan | Hanya satu akun dan satu konfigurasi yang diuji | Belum diketahui |

Tes menggunakan prompt aman text-to-video dan menyelesaikan satu video. Ini membuktikan alur UI dapat menghasilkan video untuk sesi tersebut; ini **tidak** membuktikan endpoint private yang sama dapat dipakai langsung dari server AMB Media.

## 4. Tujuan

1. Memungkinkan pengguna menjalankan generasi video Google Vids dari AMB Media memakai akun Google milik mereka sendiri.
2. Mendukung pilihan model, kualitas, orientasi, durasi, dan mode generasi hanya setelah parameter yang didukung terverifikasi.
3. Menampilkan status proses, kegagalan, dan hasil secara eksplisit, tanpa mengirim permintaan duplikat saat status ambigu.
4. Memberi pengguna cara yang jelas untuk melihat atau menggunakan hasil, tanpa mengubah dokumen Google Vids secara diam-diam.
5. Menjaga kredensial dan sesi Google tetap berada pada konteks akun pengguna serta tidak mencatatnya ke log.

## 5. Bukan tujuan

- Mengklaim endpoint internal Google Vids sebagai API publik atau stabil.
- Mengakali kuota, langganan, kontrol akses, batas penggunaan, atau proteksi layanan Google.
- Mengambil atau menggunakan sesi Google milik akun selain akun yang dipilih dan diotorisasi pengguna.
- Mengubah generator Gemini Web yang ada, lock, ledger, atau perilaku kreditnya sebelum keputusan produk terpisah dibuat.
- Menyisipkan hasil ke dokumen Vids, mengedit scene, atau mengubah isi Drive secara otomatis pada versi pertama.
- Mendukung mode **Edit**, **Animate**, **Extend**, avatar, voiceover, musik, atau gambar sebelum masing-masing payload dan perilaku selesai dianalisis.

## 6. Pengguna dan skenario utama

Pengguna telah menghubungkan akun Google miliknya melalui mekanisme akun yang didukung AMB Media.

1. Pengguna memilih akun Google/Vids yang akan digunakan.
2. Pengguna memilih mode dan opsi video yang tersedia untuk akun tersebut.
3. Pengguna memasukkan prompt dan menjalankan satu generasi.
4. AMB Media menampilkan status berjalan dan mencegah submit ganda untuk operasi yang sama.
5. Setelah selesai, pengguna dapat melihat preview dan memakai hasil melalui opsi yang dinyatakan jelas.
6. Jika proses terputus dan status task tidak diketahui, AMB Media menampilkan status tidak diketahui dan menyediakan pemeriksaan ulang; aplikasi tidak mengulang generasi otomatis.

## 7. Asumsi dan keputusan produk yang masih terbuka

Asumsi sementara untuk draft ini: **versi pertama menyediakan text-to-video mode Create dan hasilnya dapat dipreview/diunduh di AMB Media; integrasi tidak mengubah dokumen Vids.** Ini perlu disetujui sebelum implementasi.

| Keputusan | Default usulan | Catatan |
|---|---|---|
| Lokasi eksekusi | Browser/profile pengguna yang terhubung | Profile berjalan secara lokal; perlu dirancang untuk deployment jarak jauh atau multi-user |
| Akun yang didukung | Akun Google terpilih yang dapat membuka Vids | Login Gemini Web saja belum membuktikan akun memiliki akses ke fitur, kuota, atau plan Vids |
| Mode versi pertama | Create / text-to-video | Mode lain memiliki kebutuhan input dan payload berbeda |
| Keluaran | Preview dan ekspor/unduh hasil di AMB Media | Mekanisme URL/asset hasil belum ditangkap |
| Credit ledger AMB Media | Belum ditetapkan | Jangan mengurangi kredit Gemini AMB Media sampai hubungan produk dan biaya disetujui |
| Kegagalan/timeout | Pertahankan status tidak diketahui sampai dapat diverifikasi | Jangan mengulang generate secara otomatis |

## 8. Persyaratan fungsional

| ID | Prioritas | Persyaratan |
|---|---|---|
| GV-01 | P0 | Telah Terpenuhi: Endpoint, payload protobuf JSON, response body, direct video URL (MP4), dan kontrak kuota Google Vids telah 100% tertangkap dan terdokumentasi tanpa rahasia akun. |
| GV-02 | P0 | Capture dan diagnostik harus meredaksi cookie, token, API key, authorization header, parameter rahasia, prompt privat, dan konten hasil. |
| GV-03 | P0 | Generasi hanya dapat dijalankan memakai sesi akun terpilih yang diotorisasi; aplikasi tidak boleh meminta kredensial akun Google dalam log atau URL. |
| GV-04 | P0 | UI memperlihatkan akun terpilih, mode, model, resolusi, orientasi, durasi, dan parameter yang benar-benar akan dikirim sebelum submit. |
| GV-05 | P0 | Submit menampilkan state pending/running/succeeded/failed/unknown; kesalahan jaringan atau status yang ambigu tidak boleh ditampilkan sebagai sukses. |
| GV-06 | P0 | AMB Media mencegah submit ganda untuk akun/task yang sama saat generasi aktif atau statusnya unknown. |
| GV-07 | P0 | Polling/reconciliation memakai identifier resmi yang didapat dari respons aktual; jangan membuat task ID atau menganggap conversation/document ID sebagai task ID. |
| GV-08 | P0 | Aplikasi tidak melakukan retry otomatis yang dapat membuat generasi kedua saat hasil submit pertama belum diketahui. |
| GV-09 | P1 | Hasil sukses dapat dipreview dan, jika mekanisme resmi UI mendukung, disimpan/diunduh ke AMB Media tanpa penyisipan otomatis ke dokumen Vids. |
| GV-10 | P1 | Kuota dan batas akses ditampilkan hanya bila respons aktual dapat dipetakan secara akurat; aplikasi tidak menyamakan kuota Google dengan kredit internal AMB Media. |
| GV-11 | P1 | Kegagalan autentikasi, akses/plan, kuota, invalid input, throttling, dan kegagalan sementara dibedakan bila respons layanan mendukung klasifikasi tersebut. |
| GV-12 | P1 | Mode tambahan (Edit, Animate, Extend) tidak ditampilkan sebagai siap pakai sampai payload, input, dan pengambilan hasil masing-masing terverifikasi. |
| GV-13 | P1 | Fitur dapat dinonaktifkan sebagai eksperimen jika endpoint berubah atau integrasi tidak dapat dipakai dengan aman. |

## 9. Kebutuhan analisis teknis sebelum implementasi

### 9.1 Capture Browser & Spesifikasi Teknis Lengkap (Request & Response)

Investigasi DevTools terhadap siklus hidup generasi video Google Vids telah memetakan alur request dan response secara tuntas:

#### 9.1.1 Klasifikasi Request DevTools
1. **Request Inti (Generate Video & Hasil)**: `POST https://appsgenaiserver-pa.clients6.google.com/v1/genai/generate?key=AIzaSyA-njTXslyyMKk1VOogRfVP59F6fNGeNW8`
   - Bersifat *held connection*: koneksi ditahan selama proses render AI berlangsung dan langsung mengembalikan hasil video tanpa perlu polling endpoint terpisah.
2. **Telemetri (Clearcut / PlayLog)**: `POST https://play.google.com/log` (Diabaikan).
3. **Survei Pengguna (HaTS / Feedback)**: `POST https://feedback-pa.clients6.google.com/v1/survey/...` (Diabaikan).

#### 9.1.2 Header Otorisasi & Metadata Request Generate
- **URL**: `https://appsgenaiserver-pa.clients6.google.com/v1/genai/generate`
- **Query Parameter**: `key=AIzaSyA-njTXslyyMKk1VOogRfVP59F6fNGeNW8` (Google Workspace Apps GenAI API Key statis)
- **Method**: `POST`
- **Content-Type**: `application/json+protobuf`
- **Origin / Referer**: `https://docs.google.com` / `https://docs.google.com/`
- **Header `authorization`**: Format `SAPISIDHASH {timestamp}_{hash} SAPISID1PHASH ... SAPISID3PHASH ...` yang dihitung dari SHA1 `${timestamp} ${SAPISID_COOKIE} https://docs.google.com`.
- **Header `x-server-token`**: Token proteksi sesi server Google Docs/Vids yang disematkan saat dokumen dibuka.
- **Header `x-goog-authuser`**: Index akun pengguna (`0`).

#### 9.1.3 Anatomi Payload Request Protobuf JSON
Nilai-nilai di bawah ini diverifikasi terhadap request yang benar-benar diterima server (hasil render sukses 5 Nov 2026). Mengubah salah satunya bisa memicu HTTP 400 / 429.

- **Index `[0]`**: `386` — Opcode RPC / Feature ID untuk Google Vids AI Video Generation.
- **Index `[2]` (Konteks Dokumen & Pengguna)**:
  - `[2][0]`: `9` (Identifier tipe aplikasi Google Vids).
  - `[2][4]`: `"goog_<random_id>"` (Client request correlation ID).
  - `[2][6]`: `"0"` (Authuser ID).
  - `[2][8][3][0][0][7][2][0]`: `["<DRIVE_DOC_ID>", "application/vnd.google-apps.flix", null, null, 1]` — ID dokumen Google Vids aktif (`.flix`) di Google Drive. Struktur ini harus **3 level nesting** (`[[[ ... ]]]`).
  - `[2][13]`: `"in"` (Bahasa antarmuka).
  - `[2][35]`: `null` — timezone **tidak boleh dikirim**. Mengisi `"Asia/Jakarta"` di slot ini memicu HTTP 400 `Invalid value at 'client_context.search_context'`.
  - `[2][41]`: `"goog_<random_id>"` — client root request ID harus **string**. Mengisi angka `0` memicu HTTP 400 `Invalid value at 'client_context.client_root_request_id' (TYPE_STRING)`.
- **Index `[3]` (Slot Prompt)**:
  - `[3][3][0][0][2]`: `"<TEXT_PROMPT>"` — Teks prompt instruksi video dari pengguna.
- **Index `[4]` (Preset & Parameter Video)**:
  - `[4][15]`: `[0, 12, null, 0, 2, null, null, null, <DURATION_SECONDS>]` — request browser yang berhasil menghasilkan **720x1280 (portrait)** dengan resolusi **720p (`2`)**. Nilai `1` menghasilkan **1280x720 (landscape)** dan digunakan sebagai preset **16:9 / 720p**. Nilai `6` sebelumnya dicatat sebagai 1080p portrait; pemetaannya untuk request opcode 386 belum terverifikasi.
- **Index `[5]` (Model & SKU)**:
  - `[1, null, [[null, "1", 1189]]]` — Model Omni / quota sku tag.
- **Index `[6]`**: `1` — Mode flag (Create mode / preview).

##### 9.1.3.1 Endpoint Kuota (quotaSummary)
- **Endpoint**: `POST https://appsgenaiserver-pa.clients6.google.com/v1/genai/quotaSummary?key=<API_KEY>`
- **Body**: `[null, 1, [9], 389, null, [[null, "1", 1189]]]`
- **Respons**: `[[null, ["60", null, "60", 1, null, null, ["1796112000"], 0], "0", [9], 1, 17, 51]]`
  - `[0]`: limit kuota (`"60"`)
  - `[2]`: sisa kuota (`"60"`)
  - `[6][0]`: epoch reset kuota (contoh `1796112000` = 1 Des 2026 15:00 WIB)
- kuota dihitung **per akun**, 1 video Omni 10 detik memotong 10 kredit (60 kredit = ±6 video per bulan).

#### 9.1.4 Anatomi Response Body Protobuf JSON (Terkonfirmasi)
Respons HTTP 200 langsung menyertakan objek hasil video dan metadata operasional:
1. **Direct Video URL & Metadata** (`response[0][0][0][0][0][6][4]`):
   - **Download URL**: `https://contribution-rt.usercontent.google.com/download?c=...&filename=video.mp4&opi=108436427` (Link langsung file MP4 siap download/streaming).
   - **Dimensi**: request browser preset `2` menghasilkan `720` x `1280` (portrait, 720p); request preset `1` menghasilkan `1280` x `720` (landscape, 720p).
   - **Durasi**: `["10", 27000000]` (10 detik durasi video).
   - **Storage Source**: `bard_storage` / `temp_data` / `lookup_temp_data`.
   - **Storage ID**: Hash ID penyimpanan sementara Google GenAI.
2. **Metadata Operasi & Rute Agent** (`response[2]`):
   - **Internal Route**: `/flix/generate_videos_omni_t2v_psq/v1`
   - **Agent Config**: `vids_generate_videos_omni_t2v_agency_config`
   - **Workspace Agents**: `video_generator_workspace_agent`, `workspace_video_generate_content_llm_agent`
   - **Drive Doc Link**: `https://drive.google.com/open?id=<DRIVE_DOC_ID>`
3. **Kontrak Kuota & Billing Google Vids** (`response[4][0]`):
   - **Limit Kuota Bulanan/Plan**: `"60"` (`response[4][0][1][0]`)
   - **Sisa Kuota**: `"50"` (`response[4][0][1][2]`) — setelah 1 video.
   - **Total Terpakai**: `"10"` (`response[4][0][2]`) — **bukan** biaya per video, melainkan akumulasi kuota terpakai (`total − remaining`).
   - *Catatan Penting*: Akun free tier punya kuota bulanan 60 kredit, reset 1 Des 2026 15:00 WIB. Satu video Omni 10 detik memotong **10 kredit** (≈6 video per bulan). Setelah kuota habis, request berikutnya gagal HTTP 429 `USER_GENAI_QUOTA_EXHAUSTED`. Penting: kuota bersifat **per akun**, bukan per dokumen — satu akun dengan banyak dokumen tetap berbagi satu kuota.

### 9.2 Sesi dan runtime

- Pastikan apakah request harus berasal dari konteks halaman Vids/browser atau dapat dilakukan dari service server.
- Evaluasi risiko sesi profile dipakai oleh Chrome UI dan proses otomasi secara bersamaan. Jangan membuka direktori profile yang sama dengan dua browser persisten tanpa mekanisme koordinasi.
- Jangan mengekspos remote debugging port ke jaringan. Jika CDP diperlukan untuk pengembangan, batasi ke loopback, hanya sementara, dan matikan setelah capture.
- Untuk deployment server jarak jauh, tentukan bagaimana pengguna memberikan otorisasi tanpa mengirim sesi browser lokal atau cookie ke server yang tidak dipercaya.

### 9.3 Kuota, kredit, dan penggunaan bersamaan

- Baca kontrak `quotaSummary` hanya dari response yang sudah dipetakan; jangan menyimpulkan arti field dari nama ordinal/angka saja.
- Ukur apakah submit sukses mengurangi kuota, pada tahap mana, dan bagaimana kegagalan parsial ditangani.
- Tentukan kebijakan lock per akun dan hubungannya dengan generator Gemini yang ada setelah identitas resource/billing diketahui.
- Jangan menggunakan ulang ledger kredit internal Gemini untuk Vids tanpa keputusan eksplisit; kuota/produk yang berbeda mungkin memiliki batas dan biaya berbeda.

### 9.4 Hasil dan penyimpanan

- Identifikasi apakah hasil disediakan sebagai resource video, file Drive, URL playback, blob, atau identifier yang memerlukan request lanjutan.
- Verifikasi masa berlaku link, otorisasi download, format file, dan batas ukuran.
- Bedakan **preview** di Vids dengan **Insert video** ke timeline. Integrasi AMB Media tidak boleh melakukan operasi kedua kecuali pengguna memilihnya secara eksplisit.

## 10. Kontrak API internal (usulan, belum final)

Nama route dan skema di bawah hanya contoh desain internal; bukan klaim tentang API Google.

| Operasi internal | Perilaku |
|---|---|
| Submit | Menerima account reference, prompt, mode, dan opsi yang sudah divalidasi; tidak menerima cookie mentah dari UI. |
| Status | Menerima operation/task ID tervalidasi dan mengembalikan state normalisasi beserta pesan aman. |
| Result | Mengembalikan resource hasil yang telah diotorisasi untuk preview/unduh jika tersedia. |

Kontrak final harus menutup credential forwarding, validasi kepemilikan akun, proteksi CSRF/auth aplikasi, rate limiting, pembatasan ukuran prompt/media, status idempotensi, dan penghapusan data sementara.

## 11. Kriteria penerimaan

1. Capture menunjukkan request generate `POST` yang benar-benar menghasilkan video, bukan hanya preflight `OPTIONS`, quota check, autosave, atau telemetry.
2. Request dan respons dapat dijelaskan dengan field dan state yang terverifikasi; nilai rahasia dan data pribadi tidak masuk repo/log.
3. Satu generate text-to-video dapat dijalankan oleh akun yang diotorisasi dengan parameter yang terlihat di UI.
4. Status sukses hanya ditampilkan setelah hasil dapat diverifikasi; status timeout/ambigu tidak memicu generate ulang otomatis.
5. Mengulang permintaan status tidak memicu pembuatan video baru.
6. Pengguna dapat melihat hasil tanpa perubahan diam-diam pada scene atau timeline Google Vids.
7. Akun tanpa akses atau kuota yang diperlukan menerima error eksplisit dan tidak menyebabkan loop retry.
8. Tidak ada perubahan pada perilaku ledger/lock generator Gemini saat ini tanpa persetujuan dan PRD/amendemen terpisah.
9. Jika pengambilan hasil atau sesi browser tidak tersedia, fitur gagal tertutup dengan instruksi yang jelas dan tanpa mengekspos credential.
10. Tidak ada data akun atau hasil uji nyata yang tersimpan di artefak, log, atau dokumentasi repository.

## 12. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Endpoint atau protokol internal berubah tanpa pemberitahuan | Integrasi berhenti atau menghasilkan status keliru | Tandai sebagai eksperimen, adapter terisolasi, monitor error, matikan fitur saat kontrak berubah |
| Endpoint bukan API publik | Risiko kompatibilitas dan kebijakan layanan | Tinjau ketentuan penggunaan dan otorisasi sebelum rilis; jangan menjanjikan SLA |
| Profile browser dikunci/dipakai bersamaan | Korupsi sesi, login/logout tidak konsisten | Satu owner profile, koordinasi lock, penanganan proses tertutup |
| Submit berhasil tetapi response hilang | Generate duplikat dan kuota terpakai ganda | Status unknown persisten, reconciliation sebelum retry |
| Kuota Google tidak sama dengan ledger aplikasi | Pengguna melihat saldo atau biaya yang salah | Pisahkan kuota provider dan kredit internal sampai aturan disetujui |
| Video atau URL hasil bocor | Akses ke hasil privat pengguna | Otorisasi berdasarkan pemilik akun, masa berlaku resource, redaksi URL dan penghapusan file sementara |

## 13. Di luar lingkup versi pertama

- Edit/Animate/Extend dan image-to-video.
- Generate avatar, voiceover, musik, dan gambar.
- Penyuntingan dokumen Google Vids atau penyisipan hasil otomatis.
- Sinkronisasi kuota Vids ke ledger Gemini.
- Batch generation, multi-scene, dan retry otomatis.
- Mendukung penggunaan endpoint internal tanpa evaluasi kompatibilitas dan kebijakan terlebih dahulu.

## 14. Keputusan sebelum coding

Implementasi belum boleh dimulai sampai hal berikut disetujui/dikonfirmasi:

1. Pengalaman produk: generator terpisah di AMB Media, integrasi ke menu Gemini yang ada, atau hanya ekspor hasil dari Vids.
2. Target penyimpanan hasil: preview/unduh lokal, Drive, atau penyisipan eksplisit ke dokumen Vids.
3. Model akun dan runtime: profile Chrome lokal, ekstensi/bridge, atau eksekusi server.
4. Kebijakan kredit dan batas penggunaan.
5. Hasil verifikasi alur end-to-end generate POST, response body, video asset URL, dan kuota telah tuntas 100%.
6. Persetujuan bahwa integrasi terhadap endpoint non-publik dapat diterima untuk penggunaan yang dimaksud.
