# ⚙️ STUDIO PIPELINE & PROMPT ENGINEERING ENGINE

Dokumen ini menjelaskan alur kerja matematis, prompt engineering, dan pemetaan model Weavy GPT Image 2.5 untuk menghasilkan visual berkualitas tinggi dan konsisten.

---

## 1. 🧬 Formula Prompt Engineering Storyboard

Agar setiap gambar yang dihasilkan memiliki gaya visual (*style*) dan pencahayaan (*lighting*) yang serasi, generator prompt menggunakan template terstruktur:

```text
[Subject & Core Action] + [Camera Composition & Angle] + [Environment & Setting] + [Lighting & Atmosphere] + [Quality & Render Tags] + [Aspect Ratio Tag]
```

### Template Prompt Standar (Commercial Agriculture & Product):
```text
A cinematic [Aspect Ratio] shot of [Subject/Scene Details], [Composition details, e.g. low angle, macro close-up], [Environment setting, e.g. sunny modern plantation, rustic wooden table], warm golden hour natural daylight with soft lens flare, high contrast, vivid natural colors, ultra realistic, highly detailed 8k photography, commercial advertisement grade, shallow depth of field --ar [AR]
```

---

## 2. ⚡ Alur Eksekusi Antrean Generasi (Concurrency Queue)

Ketika user menekan tombol **"Generate All Scenes (6 Images)"**:

```
[User Click "Generate All"]
          │
          ├──> Queue Worker Inisialisasi (Batch Size: 6)
          │
          ├──> Batch 1: Generate Scene 1 & Scene 2 (Parallel Slot 1 & 2)
          │    └── Selesai -> Update UI & Simpan ke IndexedDB
          │
          ├──> Batch 2: Generate Scene 3 & Scene 4 (Parallel Slot 1 & 2)
          │    └── Selesai -> Update UI & Simpan ke IndexedDB
          │
          ├──> Batch 3: Generate Scene 5 & Scene 6 (Parallel Slot 1 & 2)
          │    └── Selesai -> Update UI & Simpan ke IndexedDB
          │
          └──> Auto-Trigger Composite Canvas Generator
```

* **Manajemen Concurrency**: Maksimal 2 request paralel dikirim ke Weavy GPT Image 2.5 guna mencegah *rate limiting* dan menjaga stabilitas koneksi.
* **Auto-Retry**: Jika salah satu scene mengalami error jaringan, sistem akan mencoba ulang (retry) hingga 2 kali sebelum menandai scene tersebut *failed* dan menyediakan tombol manual *Retry*.

---

## 3. 🖼️ Logika Composite Stitcher (Client-Side Canvas HTML5)

Proses penggabungan 6 gambar menjadi 1 lembar komposit dilakukan menggunakan **HTML5 Canvas 2D Context** di browser (tanpa membebani server):

1. **Inisialisasi Canvas HD**:
   * Lebar: 3840px, Tinggi: 2160px (Rasio 16:9 4K) atau 2160px x 3840px (Rasio 9:16).
2. **Kalkulasi Grid (3 Kolom x 2 Baris)**:
   * Lebar Panel: `(CanvasWidth - (Padding * 4)) / 3`
   * Tinggi Panel: `(CanvasHeight - (Padding * 3)) / 2`
3. **Pemuatan Gambar & Asynchronous Drawing**:
   * Setiap gambar dimuat via `Image()` objek (dengan fallback proxy jika URL eksternal memiliki pembatasan CORS).
   * Melakukan *center-crop* atau *aspect-fit* ke dalam masing-masing koordinat panel `(x, y, w, h)`.
4. **Rendering Overlay & Badge**:
   * Menggambar *rounded pill badge* nomor scene (`Scene 1`, `Scene 2`, dst.).
   * Menggambar border pemisah antar panel dengan warna aksen yang dipilih.
5. **Ekspor File**:
   * Menghasilkan file output berformat `image/png` dengan kualitas 100% siap unduh.
