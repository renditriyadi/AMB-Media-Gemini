# 🔌 STUDIO API ENDPOINTS SPECIFICATION

Dokumen ini merinci endpoint REST API backend yang digunakan untuk mendukung seluruh fungsi menu **Studio**.

---

## 1. 📡 Video Ingestion & Metadata Analysis

### `POST /api/studio/analyze-video`
Mengekstrak informasi video dan menghasilkan analisis mendalam serta rancangan storyboard 4–6 scene.

* **Request Body**:
```json
{
  "videoUrl": "https://vt.tiktok.com/ZSqg9mNDY/",
  "rawPrompt": "Analisis produk benih semangka dan buatkan storyboard 6 scene",
  "language": "id",
  "numScenes": 6,
  "aspectRatio": "9:16",
  "model": "claude-3-7-sonnet"
}
```

* **Response (200 OK)**:
```json
{
  "status": "success",
  "metadata": {
    "title": "REKOMENDASI BUTIR BIJI/BENIH SEMANGKA GAJAH MERAH F1",
    "author": "Nalagarden (@nalarayaofficial)",
    "audio": "suara asli - ibumega - Nalagarden",
    "thumbnail": "https://p16-common-sign.tiktokcdn.com/...",
    "tags": ["#benihsemangka", "#bibitsemangka", "#semangkagajahlonjongf1"]
  },
  "analysis": {
    "hook": "Direct Recommendation produk benih semangka jumbo F1",
    "productName": "Semangka Gajah Merah Lonjong F1",
    "targetAudience": "Petani komersil, penghobi kebun rumahan, urban farmers",
    "coreUSPs": [
      "Potensi bobot buah jumbo 8-12 kg",
      "Daging merah cerah, renyah, dan manis tinggi",
      "Tahan simpan & kulit tebal aman ekspedisi",
      "Masa panen cepat 55-60 HST dan tahan layu fusarium"
    ],
    "appetiteProof": "Belahan buah semangka merah merekah berair",
    "callToAction": "Beli benih di keranjang kuning / etalase toko"
  },
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "The Hook (Buah Jumbo)",
      "durationSec": 3,
      "sceneGoal": "Menarik perhatian dengan semangka raksasa di kebun",
      "visualDescription": "Buah semangka gajah lonjong raksasa bergaris hijau tua di tanah subur dengan pencahayaan pagi hari",
      "cameraAngle": "Low angle dramatic perspective",
      "imagePrompt": "A cinematic vertical 9:16 shot of a massive giant oblong-shaped watermelon lying on lush soil, warm golden sunlight, ultra realistic 8k --ar 9:16"
    },
    {
      "sceneNumber": 2,
      "title": "Product Focus (Biji Benih & Kemasan)",
      "durationSec": 3,
      "sceneGoal": "Memperlihatkan butir biji berkualitas dan kemasan",
      "visualDescription": "Telapak tangan memegang biji semangka bersih dan mengkilap dengan kemasan benih di latar belakang",
      "cameraAngle": "Extreme close-up macro",
      "imagePrompt": "Macro extreme close-up of plump watermelon seeds in open palm with sleek seed packet background --ar 9:16"
    }
  ]
}
```

---

## 2. 🎨 Multi-Scene Image Generation

### `POST /api/studio/generate-scene`
Memicu generasi gambar AI untuk scene tertentu atau serentak menggunakan Weavy GPT Image 2.5.

* **Request Body**:
```json
{
  "sceneId": "scene-1",
  "sceneNumber": 1,
  "prompt": "A cinematic vertical 9:16 shot of a massive giant oblong-shaped watermelon...",
  "aspectRatio": "9:16",
  "provider": "weavy",
  "model": "gpt-image-2.5",
  "weavyAccountId": "acc_weavy_01"
}
```

* **Response (200 OK)**:
```json
{
  "status": "success",
  "jobId": "weavy_job_9921448",
  "imageUrl": "https://storage.googleapis.com/.../scene_1_generated.png",
  "completedAt": "2026-09-17T03:50:00Z"
}
```

---

## 3. 🖼️ Composite Storyboard Stitcher

### `POST /api/studio/stitch-composite`
Menggabungkan seluruh gambar scene menjadi 1 lembar komposit beresolusi tinggi di server (atau dilakukan via Client Canvas).

* **Request Body**:
```json
{
  "projectId": "studio_proj_01",
  "title": "Storyboard Semangka Gajah F1",
  "gridColumns": 3,
  "gridRows": 2,
  "images": [
    { "sceneNumber": 1, "imageUrl": "https://.../img1.png", "badge": "Scene 1: Hook" },
    { "sceneNumber": 2, "imageUrl": "https://.../img2.png", "badge": "Scene 2: Benih" },
    { "sceneNumber": 3, "imageUrl": "https://.../img3.png", "badge": "Scene 3: Kebun" },
    { "sceneNumber": 4, "imageUrl": "https://.../img4.png", "badge": "Scene 4: Panen 8-12kg" },
    { "sceneNumber": 5, "imageUrl": "https://.../img5.png", "badge": "Scene 5: Manis Juicy" },
    { "sceneNumber": 6, "imageUrl": "https://.../img6.png", "badge": "Scene 6: Keranjang Kuning" }
  ],
  "options": {
    "showBadges": true,
    "showTitleBanner": true,
    "borderColor": "#ffffff",
    "borderWidth": 8,
    "outputFormat": "image/png",
    "outputResolution": "3840x2160"
  }
}
```

* **Response (200 OK)**:
```json
{
  "status": "success",
  "compositeUrl": "https://.../composite_storyboard_hd.png",
  "width": 3840,
  "height": 2160,
  "sizeBytes": 4291840
}
```

---

## 4. 📦 Export & Workflow Routing

### `POST /api/studio/export-to-canvas`
Mentransfer semua scene ke dalam Infinite Node Graph di menu **Canvas** untuk pengeditan node visual lebih lanjut.

### `POST /api/studio/export-to-batch`
Mendaftarkan semua gambar scene ke antrean **Batch View** untuk digenerate menjadi video bergerak (*Image-to-Video*) dengan RunningHub / Kling.
