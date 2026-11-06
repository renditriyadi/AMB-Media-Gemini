# PRD — Generate Video Gemini Web: Parity Payload & Header dengan UI

Status: **DRAFT — menunggu ACC sebelum eksekusi perubahan kode aplikasi**
Tanggal: 2026-11-03
Lingkup: `script-gemini/gemini_chat.cjs`, `server/providers/gemini.ts`, `server/utils/geminiProfileCookies.ts`, `server/services/geminiPlaywright.ts`

---

## 1. Ringkasan Eksekutif

**Gejala.** Generate video lewat server (`/api/gemini/generate-video`) sering gagal dengan respons HTTP 200 + conversation ID, tetapi Gemini membalas *"I encountered an error doing what you asked. Could you try again?"* dan **tidak ada** marker `video_generation` di frame respons (log: `video marker=no`). Generate manual lewat browser Gemini Web dengan **akun yang sama** dan **prompt yang sama** berhasil.

**Temuan utama (hasil capture + diff 3 pihak).** Request yang dipakai server **bukan** tiruan request UI yang berhasil. Ada tiga lapis ketidaksamaan:

1. **Body `f.req` memotong `chatContext` jadi 19 elemen**, sedangkan UI mengirim 90–99 elemen. Yang hilang antara lain: *context blob* sesi (protobuf 2–2,6 KB), id sesi, penanda tool `[4,16,19]`, dan UUID klien.
2. **Header `x-goog-ext-*` di-hardcode** — UUID klien, session id, dan daftar feature flag bersifat statis untuk semua akun, sementara UI mengirim nilai baru per sesi.
3. **Jalur video memakai request yang "irit"** (`sendMessage`): tanpa `authorization` (SAPISIDHASH), tanpa `sec-ch-ua*`/`sec-fetch-*`/`accept-language`/`x-client-data`/`x-browser-validation`. Request streaming biasa di file yang sama (`streamMessage`) punya header lengkap.

**Hipotesis utama (H1).** Backend Gemini memutuskan tool yang aktif (termasuk Veo) dari *client context* yang dikirim — isi `chatContext` + `x-goog-ext-*`. Karena konteks itu dipotong dan dipalsukan (nilai statis), backend memperlakukan giliran percakapan sebagai *chat biasa tanpa tool video* → generik error, tanpa marker `video_generation`.

**Hipotesis utama (H2).** Header yang dibuang membuat request ditandai non-browser.

> Perbaikan harus berupa **parity**: request server harus dibangun dari konteks klien yang *dinamis dan valid*, bukan dari konstanta hardcoded.

**Yang tidak jadi penyebab (sudah dibantah).** Tidak ada parameter "model"/"model_version" yang perlu ditambahkan. Capture UI yang sukses **tidak** mengirim field model apa pun — request UI sukses tetap memakai mode **Flash** (3.6 Flash) dan prompt teks biasa. Jadi routing ke Veo diputuskan server-side dari isi prompt + konteks klien, bukan dari field model.

---

## 2. Metodologi & Sumber Bukti

| Sumber | Cara dapat | Status |
|---|---|---|
| A — Request UI **berhasil** | DevTools "Copy as cURL" dari Chrome 156 manual (akun `LiviaAmaraPuspitasari@gemoel.site`), hasil generate video chayote 10s 9:16 | Sukses — video ter-render |
| B — Request UI **gagal** | Capture terprogram Playwright (Chromium 153 headed, profile akun yang sama), prompt identik | Gagal — error internal, `video marker=no` |
| C — Request **server** | `script-gemini/gemini_chat.cjs` jalur `sendMessage` | Gagal — identik dengan gejala di atas |

Artefak capture ada di `debug-tes-gemini/video-probe/` (`manual-success-payload.json`, `stageB-captures.json`, `three-way-diff.txt`, `probe-stage-a/b.cjs`). **Tidak ada cookie/token yang disimpan** di artefak (sudah di-redact).

---

## 3. Diff Rinci

### 3.1 Endpoint & URL — **SAMA** (bukan penyebab)

| Komponen | UI (sukses) | Server |
|---|---|---|
| Path | `/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate` | identik |
| Query | `bl`, `f.sid`, `hl=en`, `_reqid`, `rt=c` | identik |
| Content-Type | `application/x-www-form-urlencoded;charset=utf-8` | identik |
| Bentuk body | `f.req=[null,"<json string>"]` + `at=<token>` | identik |

### 3.2 `chatContext` — **PALING BESAR SELISIHNYA**

| Index | UI (A & B) | Server (C) | Dampak |
|---|---|---|---|
| 0 | `[prompt,0,null,null,null,null,0]` | sama | — |
| 1 | `["en"]` | sama | — |
| 2 | `null` (chat baru) | `contextConv` (null saat chat baru) | — |
| **3** | **blob protobuf konteks sesi** (`!k5ClkPT…` / `!ubqlut7…`, 2.1–2.6 KB) | **`null`** | konteks sesi hilang |
| **4** | id sesi hex 32 (`a382ce3c…`) | **`null`** | id sesi hilang |
| 6 | `[1]` | `[1]` | — |
| **7** | **`1`** | **`0`** | flag turn berbeda |
| **8, 9** | **`null`** | **`[]`** | bentuk nilai beda |
| 10, 11 | `1`, `0` | `1`, `0` | — |
| **17** | **`[[0]]`** | **`null`** | penanda tool/turn hilang |
| 18 | `0` | `0` | — |
| **30** | **`[4,16,19]`** | **tidak ada** | feature flag tool hilang |
| **59** | **UUID klien** (`8723CEF1-…`) — nilainya sama dengan `x-goog-ext-525005358-jspb` | **tidak ada** | identitas klien hilang |
| 61 | `[]` | tidak ada | |
| 68 | `2` | tidak ada | |
| 79 / 91 / 96 / 98 | `1` / `1` / `0` / `1` | tidak ada | |
| Total | **90 (A, transkripsi curl) / 99 (B, capture terprogram)** | **19** | — |

> Catatan akurasi: angka 90 berasal dari transkripsi manual curl DevTools; angka 99 dari capture terprogram (bisa dipercaya). A dan B **sepakat** pada semua index non-null; selisih panjang hanya pada run `null`berurutan. Kesimpulan yang tidak terpengaruh: **UI 90–99 elemen, server 19 elemen.**

### 3.3 Header — **BANYAK YANG HILANG / DIPALSU**

| Header | UI (sukses) | `sendMessage` (server) | `streamMessage` (server, jalur lain) |
|---|---|---|---|
| `authorization` (SAPISIDHASH) | — (pakai cookie) | ❌ **tidak ada** | ✅ ada |
| `accept-language` | `en-US,en;q=0.9` | ❌ | ✅ |
| `sec-ch-ua*` (8 header) | Chrome 156 | ❌ | ✅ (Chrome 154) |
| `sec-fetch-dest/mode/site` | `empty`/`cors`/`same-origin` | ❌ | ✅ |
| `x-client-data` | ada | ❌ | ❌ |
| `x-browser-validation` | ada | ❌ | ❌ |
| `x-sec-ch-ua-not-a-border` | ada | ❌ | ❌ |
| `priority` | `u=1, i` | ❌ | ❌ |
| `user-agent` | Chrome/**156** | Chrome/**154** | Chrome/**154** |
| `x-goog-ext-525001261-jspb` | locale `"en"`, flag `[4,33,5,6,8,16,19,20]`, build label `["boq_gemini-web-uiserver_20261102.01_p1"]`, timezone | locale `null`, flag `[4,5,6,8,16,4,5,6,8,16]`, build `null`, timezone `null`, UUID `E690D403-…` **hardcoded** | sama hardcoded |
| `x-goog-ext-525005358-jspb` | `["8723CEF1-…",1]` — **UUID baru per sesi** | `["25030126-4BD9-4DC2-B022-C67A98A520AE",1]` — **hardcoded, sama untuk semua akun** | sama hardcoded |
| `x-goog-ext-73010989/73010990-jspb` | `[0]` / `[0,0,0]` | ✅ sama | ✅ sama |
| `f.sid` | `7926914077756252439` (positif, sesi nyata) | dari scraping `/app` (`FdrFJe`) — observasi browser: `-3`, `-36`, `-6814979990237397162` (negatif) | idem |

---

## 4. Akar Masalah & Eksperimen Penentu

Hipotesis berurutan dari paling mungkin:

| # | Hipotesis | Cara membuktikan |
|---|---|---|
| **H1** | Konteks klien yang dipotong/palsu (`chatContext` 19 elemen + `x-goog-ext` statis) menyebabkan backend tidak mengaktifkan tool Veo | Replay: body 90–99 elemen + `x-goog-ext` dinamis, header server → harus **berhasil** |
| **H2** | Header yang hilang (`authorization`, `sec-ch-ua*`, `sec-fetch-*`, `x-client-data`, `x-browser-validation`) membuat request ditandai non-browser | Replay: body server (19 elemen) + header lengkap → kalau gagal, H1 dominates |
| **H3** | `f.sid` negatif/expired membuat sesi tidak recognized | Bandingkan `f.sid` dari `/app` vs `f.sid` yang dipakai browser saat sesi aktif |
| **H4** | Kegagalan bersifat transien (kapasitas Veo) — UI pun kadang gagal | Replay identik 3×; hitung tingkat kegagalan |

**Eksperimen penentu yang harus dijalankan pertama (biaya: 1 credit video per percobaan sukses):**

```
E1: body=UI(90–99) + header=UI          → HARUS SUKSES (baseline, kontrol)
E2: body=UI(90–99) + header=server      → sukses?  → H1 wins / H2 wins
E3: body=server(19)  + header=UI        → sukses?  → H2 wins / H1 wins
E4: body=server(19)  + header=server     → gagal (reproduksi gejala saat ini)
```

Aturan: H1 wins bila E2 sukses & E3 gagal. H2 wins bila E3 sukses & E2 gagal. Keduanya wins bila E2 & E3 sukses (dua-duanya perlu). Bila E1 gagal → H4 (transien) naik peringkat dan strategi berubah ke **menjalankan generate lewat browser sungguhan**.

> Catatan: eksperimen harus memakai cookie akun yang valid dan `at` token yang segar (< 5 menit), diambil saat itu juga dari `/app`.

---

## 5. Requirement Fungsional

### Klaim: parity, bukan menebak
- **FR-1** — Sistem **tidak boleh** mengirim nilai `x-goog-ext-*` berupa konstanta hardcode. Semua field yang bersifat per-sesi (UUID klien, session id, locale, build label, timezone, feature flag) wajib diambil dari sumber dinamis.
- **FR-2** — `chatContext` yang dikirim harus memiliki **bentuk dan panjang yang sama** dengan yang dikirim UI (≥ 90 elemen), dengan urutan index yang persis.
- **FR-3** — Index 59 (`UUID klien`) **wajib sama persis** dengan UUID pada header `x-goog-ext-525005358-jspb`. Ketidakcocokan = sinyal bot.
- **FR-4** — Feature flag pada `x-goog-ext-525001261-jspb` dan `chatContext[30]` harus konsisten satu sama lain dan berasal dari build UI yang sedang dipakai (bukan daftar lama).

### Klaim: sumber konteks yang benar
- **FR-5** — Sistem harus meng-*harvest* **Client Context** dari UI nyata (bukan ditebak), berisi: `chatContext` aktual, `x-goog-ext-*` aktual, `at` token, `f.sid`, `bl`, dan header browser. Sumber: (a) Playwright capture dari browser sungguhan, atau (b) parsing `/app` + `WIZ_global_data`.
- **FR-6** — Context harus **di-refresh per sesi** (batas umur ≤ 10 menit) dan **di-refresh otomatis** saat respons 400/401/403.
- **FR-7** — Jika context tidak bisa diperoleh, sistem **gagal cepat dengan pesan jelas** ("client context tidak tersedia"), bukan diam-diam mengirim payload 19 elemen.

### Klaim: request parity
- **FR-8** — Request generate video harus membawa header lengkap yang sama dengan UI: `authorization` (SAPISIDHASH), `accept-language`, `sec-ch-ua*`, `sec-fetch-*`, `x-client-data`, `x-browser-validation`, `x-sec-ch-ua-not-a-border`, `priority`, `x-browser-*`, dan `x-goog-ext-*` yang valid.
- **FR-9** — `User-Agent` dan `sec-ch-ua*` harus **konsisten satu sama lain** dan mencerminkan versi Chrome yang benar-benar dipakai (UI saat ini 156; jangan lagi 154).
- **FR-10** — `f.sid` yang dipakai harus berasal dari sesi yang aktif; jika yang tersedia hanya nilai negatif (sesi belum ter-mint), sistem harus memintakan sesi aktif sebelum mengirim.

### Klaim: jangan sampai perubahan Google tidak ketahuan
- **FR-11** — Sistem harus punya **parity check**: sebelum mengirim, bandingkan request yang akan dikirim dengan template UI yang tersimpan (jumlah elemen `chatContext`, presence header wajib, kecocokan UUID). Jika tidak parity → **fail fast**, jangan kirim request setengah jadi.
- **FR-12** — Setiap kegagalan "no video marker" harus **mencatat diff ringkas** (index mana yang menyimpang) ke log, supaya regresi Google bisa dideteksi dalam 1 menit.

### Klaim: guardrail yang tidak boleh dilanggar
- **FR-13** — Semua overhaul ini **tetap berada di bawah** aturan satu-akun-satu-render: `tryAcquireGeminiVideoAccountLock` ([server/providers/gemini.ts:287](server/providers/gemini.ts#L287)) tetap jadi enforcement final, dan kredit tidak boleh di-refund dua kali.
- **FR-14** — Percobaan parity (E1–E4) harus memakai akun uji yang jelas ditandai, dan **tidak boleh** lewat jalur yang membebaskan lock/kredit secara liar.
- **FR-15** — Halaman "uji sesi tidak valid" (`cli gemin mode/index.mjs:290`, `server/routes/cliGemini.ts:631`) **tidak boleh** dipakai untuk uji parity, karena jalur itu memang tidak pernah memanggil generator (bug terpisah, lihat §8).

---

## 6. Desain Solusi

### 6.1 Arsitektur

```
┌─ GeminiClientContextStore (baru) ───────────────────────────────┐
│  per-account, TTL 10 menit:                                     │
│   chatContextTemplate (99 el)  │ xGoogExt525001261 │ xGoogExt…  │
│   clientUUID │ sessionId │ atToken │ fSid │ bl │ browserHeaders │
└───────────────┬─────────────────────────────────────────────────┘
                │
     ┌──────────┴───────────┐
     ▼                      ▼
sendMessage (video)   streamMessage (chat)
  → pakai context       → pakai context + parity header
```

### 6.2 Sumber Client Context (harvest)

**Opsi A — Capture Playwright (rekomendasi, paling akurat).**
Butuh 1 kali run headed: buka `/app`, biarkan app JS membangun konteks, baca dari DOM/`window` + intercept header, simpan **redacted** ke `data/gemini_client_context/<accountKey>.json`.
- ✅ persis sama dengan yang UI kirim
- ⚠️ butuh browser hidup → sudah ada (`server/services/geminiPlaywright.ts`), tinggal dipakai headful-sekali-per-konteks

**Opsi B — Parsing `/app`.**
Tangkap `WIZ_global_data` (sudah dilakukan di `initSession` [gemini_chat.cjs:327](script-gemini/gemini_chat.cjs#L327)) + bootstrap JS bundle untuk `chatContext` template.
- ✅ tanpa browser
- ⚠️ rapuh: Google sering obfuscate/ubah; harus ada fallback

**Opsi C — Replay capture tersimpan per build.**
Simpan satu template request yang sudah *proven* berhasil (hasil E1), ganti hanya nilai per-sesi (`at`, `f.sid`, UUID, `chatContext[3]`, `chatContext[4]`).
- ✅ cepat, deterministik
- ⚠️ ada kemungkinan kedaluwarsa → harus ada deteksi (mis. `chatContext[3]` ikut di-refresh)

### 6.3 Pemisahan jalur request
Satu-satunya request builder dipakai bersama oleh `sendMessage` dan `streamMessage`, dengan flag `mode: 'chat' | 'video'`. Perbedaan saat ini (header irit vs lengkap) dihapus.

### 6.4 Strategi gagal & retry
| Gejala | Aksi |
|---|---|
| HTTP 400/401/403 | refresh client context → retry 1× (sudah ada, tapi harus refresh context, bukan hanya token) |
| 200 + `video marker=no` + teks error generik | **jangan** langsung retry dengan payload sama. Refresh context (fresh `at`, fresh UUID, fresh blob) → retry 1×. Jika tetap gagal → tandai `failureSource='parity_mismatch'` + simpan diff. |
| 200 + teks "kapasitas penuh / traffic tinggi" | retry sesi baru seperti sekarang, dengan backoff |
| 200 + teks kuota habis | pindah akun (perilaku sekarang) |

Retry maksimum tetap dibatasi (mis. 2× refresh context + 1× pindah akun) supaya tidak membakar kuota.

### 6.5 Fallback ke browser (jika H1–H3 모두 gagal)
Butuh langkah lebih besar, **tidak** termasuk scope v1:
- jalankan generate lewat Playwright (UI sungguhan) memakai profile akun yang sudah ada, lalu unduh hasil dari DOM.
- Ini jalur yang "sering berhasil" menurut user's observation, tapi hanya bisa dipakai serial per akun (cocok dengan aturan satu-akun-satu-render).

---

## 7. Dampak per File (rencana, **belum dieksekusi**)

> Status: **SUDAH DIJALANKAN** pada 2026-11-03 (lihat Bagian 13).

| File | Perubahan |
|---|---|
| `script-gemini/gemini_chat.cjs` | Tambah `GeminiClientContext`;(refactor) `sendMessage` & `streamMessage` agar pakai context + header parity; `initSession` menambah pengambilan `clientUUID`/`sessionId`/feature flag; hapus konstanta hardcode `x-goog-ext-*` |
| `server/providers/gemini.ts` | Klasifikasi kegagalan baru (`parity_mismatch`); retry berbasis refresh context; parity check sebelum kirim; logging diff index |
| `server/utils/geminiProfileCookies.ts` | **Bug terpisah**: membaca `Default/Cookies` [baris 80](server/utils/geminiProfileCookies.ts#L80), sedangkan Chromium 153 menyimpan cookie DB di `Default/Network/Cookies` → ekstraksi cookie profil diam-diam gagal |
| `server/services/geminiPlaywright.ts` | `headless: true` hardcode [baris 805](server/services/geminiPlaywright.ts#L805) → perlu mode harvest one-shot headed; `initPlaywright.ts` mencari `chrome-win/` padahal binary ada di `chrome-win64/` |
| `server/initPlaywright.ts` | Perbaiki resolusi path binary Chromium (`chrome-win64`) |
| `server/routes/cliGemini.ts` | Perbaiki bug "uji sesi tidak valid" yang tidak pernah memanggil generator [baris 631](server/routes/cliGemini.ts#L631) |
| `data/gemini_client_context/` (baru) | Store context per akun; **wajib di-gitignore** |

---

## 8. Temuan Sampingan (di luar scope utama, dicatat)

1. **`Default/Cookies` vs `Default/Network/Cookies`** — jalur ekstraksi cookie profil salah path → account dianggap tidak punya sesi.
2. **`python3` di [server/utils/geminiProfileCookies.ts:87](server/utils/geminiProfileCookies.ts#L87)** — di Windows `python3` tidak ada; harus `python` atau fallback Node.
3. **Spin-wait tanpa batas** — [server/providers/gemini.ts:2279](server/providers/gemini.ts#L2279) menunggu akun busy dalam loop 500ms tanpa FIFO/timeout → antrean tidak adil dan bisa menggantung.
4. **Deteksi session-invalid false positive** — `validateGeminiWebSessionForVideoPoll()` bisa salah menandai sesi mati → refund/refail beruntun.
5. **Mode picker UI tidak punya Veo** — opsi model di Gemini Web sekarang hanya 3.6 Flash / 3.8 Thinking / 3.1 Pro. Artinya: **tidak ada "pilih model Veo" di UI**; video tetap dipicu dari prompt. Ini menguatkan H1 (bukan soal parameter model).
6. **`video marker=no` + HTTP 200** adalah penanda kegagalan yang salah baca sebagai sukses di beberapa tempat (percakapan tetap dibuat).

---

## 9. Acceptance Criteria

| # | Kriteria | Cara uji |
|---|---|---|
| AC-1 | Request server secara struktural identik dengan request UI yang sukses: `chatContext` ≥ 90 elemen, `chatContext[59]` = UUID di `x-goog-ext-525005358-jspb`, seluruh header wajib ada | Unit test perbandingan dengan fixture capture UI |
| AC-2 | Konstanta UUID/session-id hardcode tidak lagi dipakai saat client context tersedia (header dari UI menimpanya). Nilai lama hanya jadi fallback jalur legacy tanpa context | Log `[Gemini Payload Parity] mode: parity-UI` → konstanta lama ter-override |
| AC-3 | Generate video lewat server menghasilkan marker `video_generation` pada ≥ 80% percobaan (dari baseline ~0%) | 10 percobaan pada akun uji, log marker per percobaan |
| AC-4 | Kegagalan tidak lagi menghasilkan "percakapan dibuat tapi video tidak jalan" tanpa penjelasan | Setiap kegagalan punya `failureSource` yang jelas |
| AC-5 | Retry tidak melampaui batas (tidak ada loop tak terbatas) | Test dengan akun busy semua → keluar dalam ≤ 60 detik dengan pesan antre |
| AC-6 | Aturan satu-akun-satu-render tetap berlaku di semua jalur (termasuk jalur parity) | Verifikasi lock file tetap ada selama render; tidak ada duplikasi lock |
| AC-7 | Tidak ada cookie/token yang bocor ke log atau artefak repo | Grep artefak & log untuk `SAPISID\|__Secure-1PSID\|at=AIa` → kosong |

---

## 10. Tahapan Pelaksanaan (setelah ACC)

| Tahap | Isi | Estimasi |
|---|---|---|
| T0 | Eksperimen penentu E1–E4 (parity harness, standalone script di `debug-tes-gemini/`) | 1–2 jam |
| T1 | Terapkan hasil E1–E4 ke `gemini_chat.cjs` (context store + parity header + payload 99 el) | 1 hari |
| T2 | Integrasi ke `server/providers/gemini.ts`: parity check, klasifikasi kegagalan, retry berbasis refresh | 0,5 hari |
| T3 | Perbaikan sampingan: path cookie, path Chromium, `python3`, spin-wait, false-positive session | 0,5 hari |
| T4 | Regression test + 10 percobaan real (AC-3) | 0,5 hari |
| T5 | (Opsional, kalau T1–T2 gagal) Fallback generate via Playwright | 1–2 hari |

---

## 11. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Google mengubah format lagi | `chatContext` template disimpan per build + parity check_versionsera mendeteksi perubahan dalam 1 percobaan |
| Harvest butuh browser headful (bermasalah di server tanpa display) | Opsi B (parsing `/app`) + fallback; di Windows lokal headful aman |
| Percobaan parity membakar kuota video | Maksimal 4 percobaan E1–E4; gunakan akun uji yang ditandai; catat credit sebelum/sesudah |
| Perbaikan parity justru memicu deteksi bot (karena "terlalu sempurna" tapi tetap bukan browser asli) | Header `sec-ch-ua`/UA harus konsisten dengan versi browser yang dipakai; ticket yang dipakai harus hasil capture nyata, bukan Hardcode |
| `client context` bocor (blob sesi = data sesi akun) | Simpan di `data/` (gitignore), redact saat log, TTL pendek |

---

## 12. Pertanyaan yang Perlu Dijawab Pengguna (before ACC)

1. **Apakah eksperimen parity E1–E4 boleh dijalankan sekarang** (memakai ~1 credit video per percobaan sukses)? Ini prasyarat supaya T1 tidak dibangun di atas asumsi.
2. **Akun uji mana** yang boleh dipakai? Yang manual tadi — `LiviaAmaraPuspitasari@gemoel.site` — atau akun lain?
3. **Fallback browser (T5)** mau diprioritaskan, atau cukup sampai parity HTTP?
4. Apakahartifact capture (`debug-tes-gemini/video-probe/`) boleh disimpan di repo, atau cukup lokal?

---

## 13. Status Implementasi (2026-11-03)

Implementasi T1–T3 sudah masuk ke kode. **Belum ada percobaan generate yang dijalankan oleh assistant** — pengujian dilakukan manual oleh pengguna.

### 13.1 File baru

| File | Isi |
|---|---|
| `server/utils/geminiClientContext.ts` | Tipe `GeminiClientContext`, TTL 8 menit, store di `data/gemini_client_context/<accountKey>.json` (sudah di-gitignore), helper `summarizeGeminiClientContext()` yang aman untuk log |
| `server/services/geminiContextHarvester.ts` | Playwright harvest: buka UI Gemini, pancing **satu** request `StreamGenerate`, **abort request tersebut** di level jaringan (jadi tidak ada yang di-generate), lalu simpan `chatContext` + header + token `at` + `bl` + `f.sid`. Sumber: profil persisten akun (utama) → injeksi cookie (fallback) |

### 13.2 File yang diubah

| File | Perubahan |
|---|---|
| `script-gemini/gemini_chat.cjs` | Tambah `setClientContext()`, `setContextRefreshHandler()`, `_buildChatContext()`, `_buildParityHeaders()`. `sendMessage` & `streamMessage` memakai template `chatContext` 90+ elemen dari UI (index 0 = prompt, index 2 = contextConv) dan header asli UI. `initSession` tidak lagi menimpa token/build dari client context. Retry 400/401/403 dan retry "internal error" sekarang capture ulang context dulu |
| `server/providers/gemini.ts` | Jalur video: ambil client context sebelum kirim, pasang ke client, daftarkan handler refresh. Failure "percakapan dibuat tapi video tidak jalan" kini punya `failureSource` = `parity_mismatch` / `missing_client_context`. Spin-wait akun busy diberi batas 10 menit |
| `server/utils/geminiProfileCookies.ts` | Path cookie DB: coba `Default/Network/Cookies` lalu `Default/Cookies`. Binary Python: `python` di Windows, `python3` di Linux/macOS |
| `server/initPlaywright.ts` | Resolusi binary Chromium: coba `chrome-win64` lalu `chrome-win` (Windows), `chrome-linux64` lalu `chrome-linux` (Linux) |
| `server/routes/cliGemini.ts` | Bug "uji sesi tidak valid":cabut return awal yang membuat generator tidak pernah dipanggil. Sekarang pre-check hanya mendiagnosis lalu request diteruskan ke `/gemini/generate-video` |
| `.gitignore` | Tambah `data/gemini_client_context/` |

### 13.3 Cara kerja di runtime

1. Request video masuk → server ambil lock akun (tetap satu-akun-satu-render).
2. `getOrHarvestGeminiClientContext()`: pakai cache kalau masih dalam TTL 8 menit, kalau tidak harvest dari UI.
3. Payload dikirim memakai `chatContext` UI + header UI + token `at` UI.
4. Kalau Google membalas 400/401/403 atau "internal error" → capture ulang context → retry sekali.
5. Kalau percakapan terbentuk tapi video tidak jalan → error menyebut `parity_mismatch` (context dipakai) atau `missing_client_context` (context gagal diambil).

### 13.4 Yang belum dilakukan (menunggu pengujian pengguna)

- AC-1 s.d. AC-7 belum diverifikasi — butuh percobaan generate nyata.
- Eksperimen E1–E4 (Bagian 4) tidak dijalankan; implementasi H1 (parity payload) langsung masuk ke kode.
- Fallback T5 (generate lewat Playwright) belum dibuat; hanya jadi opsi kalau parity tetap gagal.
- `data/gemini_client_context/` mengSUBMIT file berisi cookie sesi + token CSRF — sudah di-gitignore, tapi jangan pernah di-commit paksa.

### 13.5 Catatan risiko yang perlu dipantau saat pengujian

- Log server akan memunculkan `[Gemini Client Context] chatContext=N el` dan `[Gemini Payload Parity] chatContext=N elemen`. Kalau `N` masih 19 → harvest gagal, cek `[Gemini Client Context] Gagal ...`.
- Harvest membuka browser (headful secara default di Windows lokal). Kalau environment tanpa display, set `GEMINI_CONTEXT_HEADLESS=1`.
- Dua request generate paralel untuk akun yang sama tetap ditolak lock — parity tidak mengubah aturan itu.
