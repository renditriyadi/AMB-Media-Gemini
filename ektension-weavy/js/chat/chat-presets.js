const PRESET_INSTRUCTIONS = {
  customstoryboard: {
    name: 'Custom Storyboard (Pure Main Brief)',
    desc: 'Storyboard Compiler murni tanpa suntikan formula AI: Menyusun naskah dan konsep pengguna secara 100% presisi sesuai Main Brief ke dalam struktur JSON storyboard_project yang siap dirender di Weavy AI Studio.',
    duration: 15,
  },
  copilotstoryboard: {
    name: 'Storyboard Copilot (Main Brief)',
    desc: 'Storyboard Copilot interaktif: Wajib menganalisis gambar/link produk terlampir terlebih dahulu, ikuti instruksi Main Brief pengguna secara presisi, lalu hasilkan breakdown scene lengkap dengan blok JSON storyboard_project agar otomatis masuk ke card chat dan langsung bisa dikirim ke Storyboard.',
    duration: 15,
  },
  storyboardcopilot: {
    name: 'Storyboard Copilot (Main Brief)',
    desc: 'Storyboard Copilot interaktif: Wajib menganalisis gambar/link produk terlampir terlebih dahulu, ikuti instruksi Main Brief pengguna secara presisi, lalu hasilkan breakdown scene lengkap dengan blok JSON storyboard_project agar otomatis masuk ke card chat dan langsung bisa dikirim ke Storyboard.',
    duration: 15,
  },
  kebunimpian: {
    name: 'Kebun Impian Lahan Sempit (Max 60s)',
    desc: 'Formula video viral tour & makeover kebun impian di lahan sempit (POV dua tangan wanita / delicate female hands-only, barang besar ditaruh rapi di tanah/rak, semi-ASMR alami dengan jeda hening, 10s per scene, max 3 shoot per scene, total max 60s).',
    duration: 50,
  },
  gardentour: {
    name: 'Kebun Impian Lahan Sempit (Max 60s)',
    desc: 'Formula video viral tour & makeover kebun impian di lahan sempit (POV dua tangan wanita / delicate female hands-only, barang besar ditaruh rapi di tanah/rak, semi-ASMR alami dengan jeda hening, 10s per scene, max 3 shoot per scene, total max 60s).',
    duration: 50,
  },
  homeharvest: {
    name: 'Home Harvest & Sayur Pekarangan (29s)',
    desc: 'Formula video viral panen sayuran dapur di halaman rumah (Hook Showcase Lebat ➔ Pembuktian Tanam & Petik ➔ Hasil Panen & Closing Trigger, 3 Scene 9 Shoot @ 29s, On-Screen Hook & Caption Rapi).',
    duration: 29,
  },
  kitchengarden: {
    name: 'Home Harvest & Sayur Pekarangan (29s)',
    desc: 'Formula video viral panen sayuran dapur di halaman rumah (Hook Showcase Lebat ➔ Pembuktian Tanam & Petik ➔ Hasil Panen & Closing Trigger, 3 Scene 9 Shoot @ 29s, On-Screen Hook & Caption Rapi).',
    duration: 29,
  },
  plantreview: {
    name: 'Plant Review & Oddity Showcase (TikTok)',
    desc: 'Formula video viral edukasi & review bibit/buah unik (Hook Visual Oddity ➔ Analogi Bentuk/Rasa ➔ Keunggulan Budidaya/Tabulampot ➔ Naskah VO & Scene ➔ JSON Storyboard Weavy ➔ Caption TikTok Rapi & Lengkap dengan Disclaimer & Komen Trigger).',
    duration: 45,
  },
  odditygarden: {
    name: 'Plant Review & Oddity Showcase (TikTok)',
    desc: 'Formula video viral edukasi & review bibit/buah unik (Hook Visual Oddity ➔ Analogi Bentuk/Rasa ➔ Keunggulan Budidaya/Tabulampot ➔ Naskah VO & Scene ➔ JSON Storyboard Weavy ➔ Caption TikTok Rapi & Lengkap dengan Disclaimer & Komen Trigger).',
    duration: 45,
  },
  harvestpov: {
    name: 'POV Harvest & Taste (10s)',
    desc: 'Formula video viral 10 detik POV tangan (hands-only): Suasana pekarangan kebun alami ➔ POV tangan memetik buah ranum berembun dari pohon/rambatan (0-3s) ➔ POV tangan membelah buah di talenan kayu, memperlihatkan daging tebal berair juicy berkilau manis (3-7s) ➔ POV tangan mengangkat irisan buah ke kamera dan mencicipi/memakannya (7-10s) + CTA ajakan order bibit/buah. Visual murni fotografi tanpa teks, sinematik 4K.',
    duration: 10,
  },
  facelessgardenugc: {
    name: 'Faceless Garden UGC (20s)',
    desc: 'Storyboard vertikal bertema kebun rumahan, hanya menampilkan tangan wanita, memakai narasi wanita natural-persuasive, visual realistis, dan CTA soft-selling (Default 20s, 2 Scene @ 10s, Hands-only).',
    duration: 20,
  },
  buahunggul: {
    name: 'Universal Produk, Bibit, Buah, Sayur & Pupuk Unggul (30s)',
    desc: 'Formula video viral TikTok 30 detik UNIVERSAL untuk semua jenis produk (Buah, Sayuran, Bibit, Pupuk, Nutrisi, Alat Kebun & Produk Lainnya) — 3 Scene @ 10s, Max 3 Shot per Scene: Scene 1 Hook Bukti Kualitas Nyata (0-10s) ➔ Scene 2 Showcase Hasil Lebat & Manfaat/Nilai Cuan (10-20s) ➔ Scene 3 Produk Siap Kirim & CTA Keranjang Kuning Kiri Bawah (20-30s) + Instruksi VO Pria/Wanita + Instruksi Murni Video Tanpa Teks/Gambar + JSON Storyboard + Caption TikTok Lengkap.',
    duration: 30,
  },
  seedlessfruit: {
    name: 'Universal Produk, Bibit, Buah, Sayur & Pupuk Unggul (30s)',
    desc: 'Formula video viral TikTok 30 detik UNIVERSAL untuk semua jenis produk (Buah, Sayuran, Bibit, Pupuk, Nutrisi, Alat Kebun & Produk Lainnya) — 3 Scene @ 10s, Max 3 Shot per Scene + Instruksi VO & Video Realistis.',
    duration: 30,
  },
  cuanbibit: {
    name: 'Universal Produk, Bibit, Buah, Sayur & Pupuk Unggul (30s)',
    desc: 'Formula video viral TikTok 30 detik UNIVERSAL untuk semua jenis produk (Buah, Sayuran, Bibit, Pupuk, Nutrisi, Alat Kebun & Produk Lainnya) — 3 Scene @ 10s, Max 3 Shot per Scene + Instruksi VO & Video Realistis.',
    duration: 30,
  },
  onthespot: {
    name: 'On The Spot: Visual Sinematik + Voice Over Influencer TikTok (30s)',
    desc: 'Perpaduan visual investigasi 4K macro khas "On The Spot" Trans7 dengan Voice Over Influencer TikTok jualan yang energik, persuasif, dan padat (3 Fakta Mencengangkan, 3 Scene @ 10s Veo/Flow, VO 27-30 kata per 10s pas tempo influencer anti-kepotong & anti-kependekan, murni footage tanpa teks/watermark, tombol Salin Scene per 10s).',
    duration: 30,
  },
  spotbibit: {
    name: 'On The Spot: Visual Sinematik + Voice Over Influencer TikTok (30s)',
    desc: 'Formula video visual dokumenter On The Spot + Voice Over Influencer TikTok jualan perkebunan (3 Scene @ 10s Veo/Flow, VO 27-30 kata per scene pas tempo TikTok anti-kepotong).',
    duration: 30,
  },
  spotbuah: {
    name: 'On The Spot: Visual Sinematik + Voice Over Influencer TikTok (30s)',
    desc: 'Formula video visual dokumenter On The Spot + Voice Over Influencer TikTok jualan perkebunan (3 Scene @ 10s Veo/Flow, VO 27-30 kata per scene pas tempo TikTok anti-kepotong).',
    duration: 30,
  },
  fashion: {
    name: 'Fashion Commercial Video',
    desc: 'Konsep video fashion komersial TikTok/Reels berdurasi 15 detik dengan struktur hook visual kuat 0-3 detik, detail fit dan material 3-6 detik, angle samping 6-9 detik, detail belakang 9-12 detik, lalu hero finish dan CTA 12-15 detik. Gunakan arahan kamera, lighting, pose, dan gerakan yang realistis.',
    duration: 15,
  },
  lockcut: {
    name: 'Lock-Cut Fashion',
    desc: 'Gaya lock-cut fashion: kamera benar-benar locked statis (tripod), tanpa zoom, pan, atau tilt. Buat rapid hard cut antar pose statis setiap sekitar 1 detik, tanpa transisi halus dan tanpa interpolasi. Fokuskan pose pada detail produk yang sedang dibahas.',
    duration: 10,
  },
  jumpcut: {
    name: 'Jump-Cut Fashion Dinamis',
    desc: 'Gaya jump-cut fashion dinamis: hard cut antar pose atau angle sekitar setiap 1 detik, tempo cepat, beat sync, tanpa transisi kamera yang halus. Pastikan setiap shot tetap jelas memperlihatkan produk dan detail materialnya.',
    duration: 15,
  },
  natural: {
    name: 'Natural & Candid Lifestyle',
    desc: 'Gaya natural dan candid: ekspresi tidak dibuat-buat, gerakan mengalir, pencahayaan alami matahari/window light, dan suasana lifestyle yang believable. Hindari pose kaku serta pembagian waktu yang terlalu mekanis.',
    duration: 15,
  },
  ugc: {
    name: 'Konten UGC Creator Organik',
    desc: 'Gaya UGC creator organik: selfie smartphone POV, ekspresi autentik antusias, pencahayaan natural kamar/outdoor, bahasa santai akrab, demonstrasi produk jujur, dan CTA halus yang terasa natural.',
    duration: 15,
  },
  clean: {
    name: 'Clean Object & Studio Minimalis',
    desc: 'Gaya clean object dan studio: latar minimalis bersih (white/pastel seamless), pencahayaan softbox rapi premium, komposisi katalog estetik, produk menjadi fokus utama tanpa distraksi objek yang berantakan.',
    duration: 15,
  },
  video: {
    name: 'Storyboard Video Iklan Komersial',
    desc: 'Rancang storyboard video komersial TikTok/Reels berdurasi 15 detik dengan alur hook 0-3 detik, problem atau interest 3-6 detik, product proof 6-10 detik, dan CTA kuat 10-15 detik. Sertakan shot, angle kamera, gerakan, lighting, voice-over, dan teks layar.',
    duration: 15,
  },
  storyboard: {
    name: 'Storyboard Copilot Full Breakdown',
    desc: 'Rancang konsep adegan video iklan TikTok/Reels secara terstruktur dan mendalam dengan breakdown per scene lengkap (visual detail, voice-over, on-screen text, camera movement, dan durasi).',
    duration: 15,
  },
};

const STORYBOARD_PRESET_KEYS = new Set([
  'customstoryboard', 'copilotstoryboard', 'storyboardcopilot',
  'kebunimpian', 'gardentour', 'kebunorganik', 'homeharvest', 'kitchengarden', 'kebunsayur',
  'plantreview', 'odditygarden', 'plantoddity', 'buahunggul', 'seedlessfruit', 'cuanbibit',
  'onthespot', 'spotbibit', 'spotbuah', 'investigasikebun', 'harvestpov', 'facelessgardenugc',
  'fashion', 'video', 'storyboard',
]);

export function isStoryboardPresetCommand(prompt = '') {
  const match = String(prompt || '').trim().match(/^\/([a-z0-9]+)\b/i);
  return Boolean(match && STORYBOARD_PRESET_KEYS.has(match[1].toLowerCase()));
}

/**
 * Expands slash presets (e.g. /fashion, /lockcut, /video, /ugc, /clean, /natural, /jumpcut)
 * into high-quality instructions for Gemini, Dola, or Weavy LLMs.
 */
export function expandChatPreset(prompt = '', provider = 'gemini') {
  const text = String(prompt || '').trim();
  const match = text.match(/^\/(customstoryboard|copilotstoryboard|storyboardcopilot|kebunimpian|gardentour|kebunorganik|homeharvest|kitchengarden|kebunsayur|plantreview|odditygarden|plantoddity|buahunggul|seedlessfruit|cuanbibit|onthespot|spotbibit|spotbuah|investigasikebun|harvestpov|facelessgardenugc|fashion|lockcut|jumpcut|natural|ugc|clean|video|storyboard)\b\s*([\s\S]*)$/i);
  if (!match) return text;

  const presetKey = match[1].toLowerCase();
  const userBrief = match[2].trim();

  // Special Handler for Kebun Impian Lahan Sempit (/kebunimpian, /gardentour, /kebunorganik)
  if (presetKey === 'kebunimpian' || presetKey === 'gardentour' || presetKey === 'kebunorganik') {
    const brief = userBrief || 'Sulap lahan sempit ukuran 4x4,5 meter menjadi kebun organik impian full tanaman sayur dan buah di pekarangan rumah.';
    const durationMatch = userBrief.match(/(\d+)\s*(?:detik|s|sec|second)/i);
    const targetDuration = durationMatch ? Math.min(60, Math.max(20, parseInt(durationMatch[1], 10))) : 50;

    // Dynamic scene calculation: ~10s per scene, max 3 shoots per scene, total max 60s
    const numScenes = Math.min(6, Math.max(2, Math.round(targetDuration / 10)));
    const baseSceneDur = Math.floor(targetDuration / numScenes);
    const remainder = targetDuration - (baseSceneDur * numScenes);

    return `[STORYBOARD DIRECTOR & TIKTOK/SHORTS ARCHITECT: /KEBUNIMPIAN - MAKEOVER KEBUN LAHAN SEMPIT]
Anda adalah Creative Director Video Sinematik & Pakar Urban Farming Pekarangan Sempit kelas dunia.
Tugas Anda adalah merancang konsep video walkthrough/makeover kebun impian di lahan terbatas (maksimal ${targetDuration} detik, ~10 detik per scene, maksimal 3 sub-shoot per scene), dengan gaya visual FACELESS DUA TANGAN WANITA (Delicate Indonesian Female Hands-Only), tata letak barang besar ditaruh rapi di lantai/rak tanpa diangkat paksa, serta pacing audio SEMI-ASMR ALAMI yang menenangkan dengan jeda hening berkala (TIDAK ADA VOICEOVER NONSTOP).

============================================================
INFORMASI BRIEF PENGGUNA:
============================================================
[MAIN BRIEF]: ${brief}
[TARGET TOTAL DURASI]: ${targetDuration} detik (${numScenes} Scene @ ~${baseSceneDur} detik/scene, Masing-masing scene MAKSIMAL 3 Sub-Shoot cepat)

============================================================
5 ATURAN EMAS VISUAL, AUDIO & SINEMATOGRAFI (STRICT):
============================================================
1. FACELESS FEMALE HANDS ONLY (POV DUA TANGAN WANITA):
   - Kamera murni First-Person POV (Handheld / Smooth Gimbal).
   - Talent HANYA DUA TANGAN WANITA INDONESIA yang bersih, lembut, dan natural (soft delicate Indonesian female hands with clean natural nails).
   - DILARANG memunculkan wajah, kepala, atau tubuh utuh. Zero-face, hands-only POV.
   - Di SETIAP prompt gambar dan video AI WAJIB menyertakan deskripsi eksplisit: "two delicate Indonesian female hands", "smooth natural female hands", atau "female hands-only".
2. SETTING LOKASI LOKAL INDONESIA MEMBUMI (NON-MEWAH / MERAKYAT):
   - Setting WAJIB pekarangan rumah sederhana khas Indonesia (bukan taman villa mewah, bukan greenhouse kaca modern Eropa).
   - Elemen visual khas Indonesia: Dinding plester acian semen sederhana / bata merah ekspos, pagar kayu/bambu sederhana, jalan setapak kerikil sungai bersih / paving blok sederhana, naungan paranet jaring hitam peneduh, wadah polybag hitam standar pekarangan, pot tanah liat lokal, rak bertingkat bambu/kayu kaso/besi sederhana, dan genteng tanah liat di kejauhan.
   - Suasana hangat, asri, sejuk, bersahaja, bersih bebas becek, dan sangat membumi (authentic humble Indonesian neighborhood backyard).
3. ATURAN BARANG BESAR (STABIL DITARUH, JANGAN DIANGKAT/DIPEGANG):
   - Objek berukuran besar seperti: Rak vertikal bertingkat, planter box, polybag besar, bedengan kebun, wadah panen besar, atau meja semai WAJIB ditaruh rapi di lantai/tanah/dinding (Placed neatly on the clean ground / racks / wall).
   - DILARANG menampilkan tangan wanita mengangkat/memegang benda besar melayang di udara! Angle depan/overview diambil dengan objek ditaruh stabil di lantai kebun, dan dua tangan wanita hanya menyentuh daun, menunjuk detail, menyemprot air, atau meletakkan pot kecil secara wajar.
4. SEMI-ASMR PACING & JEDA HENING AUDIO (ANTI-MONOLOG NONSTOP):
   - Naskah TIDAK BOLEH berceloteh tanpa henti dari awal sampai akhir!
   - Setiap scene WAJIB memiliki potongan jeda hening dengan suara alam/ASMR nyata:
     • Suara petikan renyah tangkai sayur segar: *[SFX ASMR: Crispy snap 'krek']*
     • Suara gemercik kabut semprotan air embun: *[SFX ASMR: Gentle water mist spray 'psssht']*
     • Suara gesekan lembut dedaunan rimbun: *[SFX ASMR: Soft leaf rustle 'swish']*
     • Suara hembusan angin sepoi & kicau burung pekarangan.
   - Voiceover hanya berbicara di poin-poin kunci (Hook dimensi lahan, transisi zonasi, dan closing ramah), sisanya biarkan audio ambient ASMR dan visual yang menenangkan penonton.
5. SCENE & MULTI-SHOOT PACING:
   - Durasi setiap Scene ~10 detik.
   - Setiap Scene terdiri dari MAKSIMAL 3 Sub-Shoot (pergantian angle/shot tiap 3–4 detik agar video sangat dinamis namun tetap menenangkan).
6. SINKRONISASI MUTLAK VOICEOVER (100% SINKRON & LENGKAP):
   - Naskah "voiceover" di level Scene WAJIB merupakan PENGGABUNGAN UTUH dari seluruh potongan VO di Sub-Shoot (Shoot 1 + Shoot 2 + Shoot 3) secara runtut dan lengkap!
   - DILARANG KERAS hanya menyalin naskah Shoot 1 saja ke level Scene sehingga naskah Shoot 2 tertinggal atau hilang.
   - Contoh: Jika Shoot 1 = "Punya sisa lahan 3x4m di rumah? Jangan dianggurin, bro." dan Shoot 2 = "Sulap jadi kebun 25 jenis sayur kayak gini.", maka VO di level Scene WAJIB ditulis lengkap: "Punya sisa lahan 3x4m di rumah? Jangan dianggurin, bro. Sulap jadi kebun 25 jenis sayur kayak gini. [SFX ASMR: Soft leaf rustle 'swish']"
7. ATURAN JUMLAH KATA VOICEOVER PER SCENE (MINIMAL 27 KATA, MAKSIMAL 30 KATA):
   - Voiceover pada setiap scene WAJIB MEMENUHI MINIMAL 27 KATA DAN MAKSIMAL 30 KATA (rentang wajib: 27–30 kata per scene).
   - DILARANG membuat naskah di bawah 27 kata (kependekan) dan DILARANG di atas 30 kata (agar tidak terpotong saat render 10 detik)!

============================================================
STRUKTUR OUTPUT JAWABAN ANDA (WAJIB IKUTI 4 BAGIAN INI):
============================================================

### 1. 🌿 RISET & BLUEPRINT DESAIN KEBUN IMPIAN
- **Dimensi Lahan & Lokasi:** [Ukuran lahan spesifik, misal: 4x4,5m di pekarangan belakang rumah]
- **Headline On-Screen Hook:** [Teks pemikat di 3 detik awal, misal: "SULAP LAHAN 4x4,5m JADI KEBUN IMPIAN 🙌"]
- **Strategi Zonasi Ruang:**
  • *Zona Bawah (Lantai):* [Polybag/pot besar tertata di atas kerikil bersih/paving]
  • *Zona Tengah (Dinding):* [Rak vertikal bertingkat untuk sayuran daun & herba]
  • *Zona Atas (Langit-langit):* [Rambatan gantung / paranet peneduh]
- **Komposisi Audio:** [Piano solo lembut + Ambient ASMR alami kebun]

---

### 2. 🎬 BREAKDOWN SCENE & MULTI-SHOOT PACING (${targetDuration} Detik)
Tuliskan ${numScenes} Scene lengkap (~10s per scene) dengan maksimal 3 Sub-Shoot per scene:

#### 📍 SCENE 1: HOOK DIMENSI LAHAN & PANORAMA OVERVIEW (0–${baseSceneDur}s)
* **Shoot 1 (0–3s):**
  • **Visual:** [POV dua tangan wanita membuka pintu kebun pekarangan rumah, memperlihatkan lorong hijau rimbun yang tertata rapi di lahan sempit]
  • **Aksi Tangan:** [Dua tangan wanita mendorong pintu kayu kebun]
  • **Posisi Objek:** [Rak dan tanaman bertingkat tertata rapi ditaruh di lantai kebun]
  • **Kamera:** POV Wide Eye-level
  • **On-Screen Text:** "SULAP LAHAN [Ukuran] JADI KEBUN IMPIAN"
  • **Audio / SFX:** [SFX ASMR: Suara pintu terbuka pelan & kicau burung pagi]
  • **Voiceover:** "[Naskah Hook Shoot 1]"
* **Shoot 2 (3–6s):**
  • **Visual:** [Kamera tilt up menyorot naungan paranet dan tanaman rambat di atas]
  • **Aksi Tangan:** [Tangan wanita menunjuk ke arah zonasi atas]
  • **Audio / SFX:** [SFX ASMR: Hembusan angin sepoi-sepoi menerpa dedaunan]
  • **Voiceover:** "[Naskah lanjutan Shoot 2]"
* **Shoot 3 (6–${baseSceneDur}s):**
  • **Visual:** [Dua tangan wanita membelai daun tanaman sayur rimbun di tepi jalan setapak]
  • **Aksi Tangan:** [Dua tangan wanita membelai daun segar berembun]
  • **Audio / SFX:** [SFX ASMR: Suara gesekan lembut daun 'swish']
  • **Voiceover:** *(Hening - biarkan suara gesekan daun ASMR terdengar)*
* **Voiceover Gabungan Scene 1:** "[Naskah Hook Shoot 1] [Naskah lanjutan Shoot 2] [SFX ASMR: Suara gesekan daun 'swish']"
* **Prompt Gambar Scene 1 (Container 8K):**
  \`\`\`text
  Shot on Sony Alpha A7 IV, 24mm wide angle lens f/2.8. Realistic humble authentic Indonesian neighborhood backyard garden POV shot, two delicate Indonesian female hands opening rustic wooden garden gate to reveal a lush clean 4x4.5m organic dream garden, multi-tier bamboo and wood planter racks resting steadily on clean gravel floor, simple cement plaster wall, black polybags, sunlit morning mist, warm tropical vibe, pure visual only, no text, no title, no typography, no banner, no watermark, non-luxury, 8k.
  \`\`\`

*(Lanjutkan format yang sama untuk SCENE 2 sampai SCENE ${numScenes} dengan aturan durasi ~10s, max 3 shoot, tangan wanita, dan Voiceover gabungan yang 100% mencakup seluruh sub-shoot)*

---

### 3. 📋 BLOK JSON STORYBOARD PROJECT (WEAVY AI STUDIO)
Sertakan blok JSON \`\`\`storyboard_project ... \`\`\` valid dengan ${numScenes} Scene dan nested array \`shoots\` (maksimal 3 shoots per scene, dan field voiceover scene WAJIB gabungan utuh dari sub-shoot):
\`\`\`storyboard_project
{
  "title": "Kebun Impian: ${brief.replace(/["\n\r]/g, ' ').slice(0, 35)}",
  "productName": "Desain Kebun Impian Lahan Sempit",
  "productDesc": "Walkthrough kebun organik lahan terbatas dengan zonasi vertikal, tangan wanita, latar lokal Indonesia bersahaja dan semi-ASMR alami",
  "preset": "kebunimpian",
  "duration": ${targetDuration},
  "aspectRatio": "9:16",
  "formula": "dream_garden_tour",
  "numScenes": ${numScenes},
  "scenes": [
    {
      "id": "scene-1",
      "sceneNumber": 1,
      "title": "Scene 1: Hook Dimensi Lahan & Overview",
      "durationSec": ${baseSceneDur},
      "start": 0,
      "end": ${baseSceneDur},
      "cameraAngle": "POV Wide Eye-level",
      "visualDescription": "POV dua tangan wanita membuka pintu kebun pekarangan rumah sederhana khas Indonesia yang disulap menjadi kebun organik hijau rimbun, pot dan rak bambu tertata rapi di lantai.",
      "voiceover": "<Naskah Gabungan Utuh Scene 1: Potongan Shoot 1 + Potongan Shoot 2 + Jeda ASMR>",
      "onScreenText": "SULAP LAHAN 4x4,5m JADI KEBUN IMPIAN",
      "imagePrompt": "Shot on Sony Alpha A7 IV, 24mm wide lens f/2.8. Realistic humble authentic Indonesian neighborhood home garden POV handheld shot, two delicate Indonesian female hands at entrance of a thriving lush 4x4.5m garden, simple cement plaster wall, bamboo planter racks resting on neat gravel, morning sunlight, clean photography, pure visual only, no text, no title, no watermark, non-luxury, 8k.",
      "videoPrompt": "POV camera, two delicate female hands opening rustic gate to reveal ultra lush humble Indonesian home garden with bamboo racks resting on ground, gentle morning breeze, 4k.",
      "shoots": [
        {
          "id": "scene-1-shoot-1",
          "start": 0,
          "end": 3,
          "visualDescription": "POV dua tangan wanita mendorong pintu kebun, memperlihatkan lorong hijau.",
          "action": "Dua tangan wanita mendorong pintu kebun",
          "cameraAngle": "POV Wide Eye-level",
          "onScreenText": "SULAP LAHAN 4x4,5m JADI KEBUN IMPIAN",
          "voiceover": "<Potongan VO Shoot 1>"
        },
        {
          "id": "scene-1-shoot-2",
          "start": 3,
          "end": 6,
          "visualDescription": "Tilt up menyorot atap paranet dan tata letak vertikal.",
          "action": "Tangan wanita menunjuk zonasi atas",
          "cameraAngle": "Low-to-High Tilt POV",
          "onScreenText": "",
          "voiceover": "<Potongan VO Shoot 2>"
        },
        {
          "id": "scene-1-shoot-3",
          "start": 6,
          "end": ${baseSceneDur},
          "visualDescription": "Dua tangan wanita membelai dedaunan segar di jalan setapak.",
          "action": "Dua tangan wanita membelai daun",
          "cameraAngle": "POV Close-up Handheld",
          "onScreenText": "",
          "voiceover": "[SFX ASMR: Soft leaf rustle 'swish']"
        }
      ]
    }
  ]
}
\`\`\`

---

### 4. 📱 SARAN CAPTION TIKTOK / SHORTS SIAP COPY-PASTE (SUPER RAPI)
Buatkan satu blok teks rapi berisi caption lengkap dengan hook dimensi lahan, zonasi tata ruang, elemen ASMR, disclaimer edukasi, pancingan komentar 1 kata, dan hashtag:

\`\`\`text
Lahan [Ukuran] di belakang rumah disulap jadi kebun organik impian yang full tanaman sayur dan buah! 🌿✨ Siapa bilang lahan sempit gak bisa punya kebun produktif?

Blueprint tata letak kebun di lahan terbatas:
• 🪴 Lantai (Zona Bawah): [Pot & polybag teratur di atas lantai kerikil/paving bersih]
• 🪜 Dinding (Zona Vertikal): [Rak bertingkat untuk sayuran daun, selada & rempah dapur]
• 🍇 Atas (Zona Rambat): [Paranet peneduh & rambatan tanaman buah]
• 💧 Perawatan: [Penyiraman kabut organik & media tanam gembur bebas becek]
• 🍳 Panen Harian: [Tinggal petik sayur segar organik saat mau masak]

Catatan penting:
Konten ini menginspirasi pemanfaatan pekarangan rumah sempit secara efisien. Kerapian tata letak dan pencahayaan matahari adalah kunci utama keberhasilan kebun perkotaan.

Komen "[KATA_KUNCI]" kalau kamu mau dibikinin panduan denah & media tanamnya! 👇
Save video ini biar jadi inspirasi pas mau makeover pekarangan rumah! 📌
Share ke teman atau keluarga yang punya sisa lahan sempit di rumah! 🌻

#[Tag1] #[Tag2] #[Tag3] #[Tag4] #KebunImpian #UrbanFarming #LahanSempit #MakeoverKebun #KebunOrganik #PekaranganRumah
\`\`\``;
  }

  // Special Handler for Home Harvest & Sayur Pekarangan (/homeharvest, /kitchengarden, /kebunsayur)
  if (presetKey === 'homeharvest' || presetKey === 'kitchengarden' || presetKey === 'kebunsayur') {
    const brief = userBrief || 'Panen terong hijau panjang lebat maksimal di pekarangan halaman rumah untuk sayur lalapan dan kebutuhan dapur.';
    const durationMatch = userBrief.match(/(\d+)\s*(?:detik|s|sec|second)/i);
    const targetDuration = durationMatch ? Math.min(120, Math.max(15, parseInt(durationMatch[1], 10))) : 29;

    // Dynamic 3-Scene division following the exact formula:
    // Scene 1: ~28% (8s on 29s) -> Hook & Showcase Lebat (3 shoots)
    // Scene 2: ~41% (12s on 29s) -> Tanam Pekarangan & Petik (3 shoots)
    // Scene 3: ~31% (9s on 29s) -> Hasil Panen & Closing Trigger (3 shoots)
    const scene1Dur = Math.max(5, Math.round(targetDuration * 0.28));
    const scene2Dur = Math.max(7, Math.round(targetDuration * 0.41));
    const scene3Dur = Math.max(5, targetDuration - scene1Dur - scene2Dur);

    return `[STORYBOARD DIRECTOR & TIKTOK VIRAL ARCHITECT: /HOMEHARVEST - SAYUR PEKARANGAN DAPUR (29s / 3 SCENE 9 SHOOT)]
Anda adalah Creative Director Video TikTok & Pakar Edukasi Urban Farming / Sayuran Pekarangan Rumah Indonesia.
Tugas Anda adalah merancang konsep video panen sayuran dapur di pekarangan rumah yang sangat estetik, menenangkan (*calming piano vibe* ala Sumochi), praktis, dan memiliki konversi penjualan benih/bibit tinggi dengan struktur terstruktur 3 Scene & 9 Sub-Shoot.

============================================================
INFORMASI BRIEF PENGGUNA:
============================================================
[MAIN BRIEF]: ${brief}
[TARGET TOTAL DURASI]: ${targetDuration} detik (3 Scene Container @ total 9 Sub-Shoot cepat berganti angle tiap 2–4 detik)

============================================================
STRUKTUR WAJIB FORMULA HOME HARVEST (3 SCENE & 9 SHOOT):
============================================================
[TOTAL DURASI ${targetDuration} DETIK]
 ├── 📍 SCENE 1 (0–${scene1Dur}s | ${scene1Dur} Detik) : Hook Visual & Showcase Sayur/Buah Lebat
 │    ├── Shoot 1 (0–3s) : Extreme Close-Up sayuran/terong panjang mulus segar berembun + On-Screen Text Hook ("Panen [Nama Sayur] Maksimal Hanya Dihalaman Rumah?!")
 │    ├── Shoot 2 (3–5s) : Tangan memegang dan menunjukkan kesegaran sayuran menggelantung di dahan
 │    └── Shoot 3 (5–${scene1Dur}s) : Kamera panning dinamis menyorot barisan buah sayur lain yang sarat bergelantungan lebat
 │
 ├── 📍 SCENE 2 (${scene1Dur}–${scene1Dur + scene2Dur}s | ${scene2Dur} Detik) : Pembuktian Tanam Pekarangan & Proses Petik
 │    ├── Shoot 1 (${scene1Dur}–${scene1Dur + 4}s) : Medium Shot memperlihatkan pohon rimbun di sudut halaman/polybag rumah minimalis
 │    ├── Shoot 2 (${scene1Dur + 4}–${scene1Dur + 8}s) : Tangan memeriksa tunas dan bunga baru (bukti tanaman genjah & rajin berbuah)
 │    └── Shoot 3 (${scene1Dur + 8}–${scene1Dur + scene2Dur}s) : POV tangan memetik sayur matang langsung dari pohonnya (tangkai terputus renyah)
 │
 └── 📍 SCENE 3 (${scene1Dur + scene2Dur}–${targetDuration}s | ${scene3Dur} Detik) : Hasil Panen Dapur & Closing Trigger
      ├── Shoot 1 (${scene1Dur + scene2Dur}–${scene1Dur + scene2Dur + 3}s) : Tangan memamerkan beberapa batang sayur segar hasil petik di wadah/tangan
      ├── Shoot 2 (${scene1Dur + scene2Dur + 3}–${scene1Dur + scene2Dur + 6}s) : Hero Shot tanaman sayur subur di pekarangan rumah
      └── Shoot 3 (${scene1Dur + scene2Dur + 6}–${targetDuration}s) : Closing pertanyaan pemicu interaksi ("Siapa yang kepikiran mau tanam [Nama Sayur] sendiri di rumah?") + Ajakan Komen, Save & Share

============================================================
ATURAN AUDIO, VISUAL & GENERASI AI:
============================================================
- Background Music: Musik instrumen piano solo santai & menyejukkan pekarangan (Calming Piano Aesthetic).
- Voiceover: Naskah narasi bahasa Indonesia santai, ramah, mengalir natural, menekankan kenikmatan lalapan/masakan dapur dan hemat belanja pasar. (ATURAN MUTLAK VO: Voiceover per scene WAJIB MINIMAL 27 KATA & MAKSIMAL 30 KATA, rentang wajib 27–30 kata per scene. DILARANG di bawah 27 kata dan DILARANG di atas 30 kata agar tidak terpotong saat render 10 detik!).
- On-Screen Text: HANYA di Shoot 1 sebagai Headline Hook mencolok (misal: "Panen [Nama Sayur] Maksimal Hanya Dihalaman Rumah?!"), shoot lainnya teks layar "".
- Talent & Kamera: Hands-only POV pekarangan rumah alami Indonesia, soft natural hands, zero-face, pencahayaan matahari pagi/sore alami, 4K sinematik.
- DILARANG menampilkan objek keranjang kuning fisik di prompt gambar!
- Prompt gambar berstandar: Shot on Sony Alpha A7 IV, 35mm/50mm lens f/2.8, clean photography, pure visual only, no text, no title, no typography, no banner, no watermark, 8k.

============================================================
STRUKTUR OUTPUT JAWABAN ANDA (WAJIB IKUTI 4 BAGIAN INI):
============================================================

### 1. 🌾 RISET & NILAI PRAKTIS SAYURAN PEKARANGAN
- **Nama Sayuran/Varietas:** [Nama botani & populer]
- **Headline On-Screen Hook:** [Teks pertanyaan/kejutan pemikat di detik awal]
- **Nilai Dapur & Lalapan:** [Kecocokan menu sambal, sayur lodeh, lalap mentah/rebus, rasa manis renyah]
- **Nilai Hemat & Budidaya:** [Cukup di pot/polybag pekarangan sempit, hemat uang belanja dapur]

---

### 2. 🎬 BREAKDOWN SCENE & MULTI-SHOOT PACING (${targetDuration} Detik)
Tuliskan 3 Scene lengkap dengan 3 Sub-Shoot per scene:

#### 📍 SCENE 1: HOOK VISUAL & SHOWCASE LEBAT (0–${scene1Dur}s)
* **Shoot 1 (0–3s):**
  • **Visual:** [Extreme Close-up sayuran segar menggantung di dahan berembun pagi]
  • **Aksi Tangan:** [Kamera menyorot kemulusan dan kilau sayuran]
  • **Kamera:** Extreme Close-Up Handheld
  • **On-Screen Text:** "Panen [Nama Sayur] Maksimal Hanya Dihalaman Rumah?!"
  • **Voiceover:** "[Naskah VO pembuka hook relatable]"
* **Shoot 2 (3–5s):**
  • **Visual:** [Tangan memegang dan menunjukkan terong/sayuran di dahan]
  • **Aksi Tangan:** [Tangan memegang sayuran segar]
  • **Kamera:** POV Handheld Close-up
  • **On-Screen Text:** ""
  • **Voiceover:** "[Naskah VO keunggulan varietas]"
* **Shoot 3 (5–${scene1Dur}s):**
  • **Visual:** [Kamera panning menyorot buah-buah lain yang bergelantungan lebat]
  • **Aksi Tangan:** [Tangan menyingkap sedikit daun rimbun]
  • **Kamera:** Panning POV Medium Close-up
  • **On-Screen Text:** ""
  • **Voiceover:** "[Naskah VO kesuburan pohon]"
* **Prompt Gambar Scene 1 (Container 8K):**
  \`\`\`text
  Shot on Sony Alpha A7 IV, 50mm lens f/2.8. Realistic Indonesian home garden POV handheld shot, natural hands holding fresh glossy green vegetables hanging from lush backyard plants, morning sunlight dew, clean photography, pure visual only, no text, no title, no typography, no banner, no watermark, 8k.
  \`\`\`

#### 📍 SCENE 2: PEMBUKTIAN TANAM PEKARANGAN & PROSES PETIK (${scene1Dur}–${scene1Dur + scene2Dur}s)
*(Tuliskan Shoot 1, Shoot 2, Shoot 3, dan Prompt Gambar 8K Scene 2)*

#### 📍 SCENE 3: HASIL PANEN DAPUR & CLOSING TRIGGER (${scene1Dur + scene2Dur}–${targetDuration}s)
*(Tuliskan Shoot 1, Shoot 2, Shoot 3, dan Prompt Gambar 8K Scene 3)*

---

### 3. 📋 BLOK JSON STORYBOARD PROJECT (WEAVY AI STUDIO)
Sertakan blok JSON \`\`\`storyboard_project ... \`\`\` valid dengan 3 Scene dan nested array \`shoots\` di setiap scene:
\`\`\`storyboard_project
{
  "title": "Home Harvest: ${brief.replace(/["\n\r]/g, ' ').slice(0, 35)}",
  "productName": "<Nama Sayuran/Benih>",
  "productDesc": "<Nilai Panen Pekarangan & Dapur>",
  "preset": "homeharvest",
  "duration": ${targetDuration},
  "aspectRatio": "9:16",
  "formula": "home_garden_harvest",
  "numScenes": 3,
  "scenes": [
    {
      "id": "scene-1",
      "sceneNumber": 1,
      "title": "Scene 1: Hook Visual & Showcase Lebat",
      "durationSec": ${scene1Dur},
      "start": 0,
      "end": ${scene1Dur},
      "cameraAngle": "Extreme Close-Up Handheld",
      "visualDescription": "POV handheld tangan di pekarangan rumah menyorot sayuran segar panjang mulus menggantung lebat di dahan tanaman.",
      "voiceover": "<Naskah VO Scene 1>",
      "onScreenText": "Panen [Nama Sayur] Maksimal Hanya Dihalaman Rumah?!",
      "imagePrompt": "Shot on Sony Alpha A7 IV, 50mm lens f/2.8. Realistic Indonesian home garden POV handheld shot, natural hands holding fresh glossy vegetable hanging from plant, morning dew, sunny backyard, clean photography, pure visual only, no text, no title, no watermark, 8k.",
      "videoPrompt": "POV handheld camera panning across heavy hanging vegetables on plant in home garden, natural breeze, 4k.",
      "shoots": [
        {
          "id": "scene-1-shoot-1",
          "start": 0,
          "end": 3,
          "visualDescription": "Extreme close-up sayuran panjang mulus berembun pagi.",
          "action": "Kamera mendekat ke sayuran",
          "cameraAngle": "Extreme Close-Up Handheld",
          "onScreenText": "Panen [Nama Sayur] Maksimal Hanya Dihalaman Rumah?!",
          "voiceover": "<Potongan VO Shoot 1>"
        },
        {
          "id": "scene-1-shoot-2",
          "start": 3,
          "end": 5,
          "visualDescription": "Tangan memegang dan menunjukkan kesegaran sayuran di dahan.",
          "action": "Tangan memegang sayur segar",
          "cameraAngle": "POV Handheld Close-up",
          "onScreenText": "",
          "voiceover": "<Potongan VO Shoot 2>"
        },
        {
          "id": "scene-1-shoot-3",
          "start": 5,
          "end": ${scene1Dur},
          "visualDescription": "Kamera panning menyorot buah-buah sayur lain yang menggelantung lebat.",
          "action": "Tangan menyingkap daun",
          "cameraAngle": "Panning POV Medium Close-up",
          "onScreenText": "",
          "voiceover": "<Potongan VO Shoot 3>"
        }
      ]
    },
    {
      "id": "scene-2",
      "sceneNumber": 2,
      "title": "Scene 2: Pembuktian Tanam Pekarangan & Petik",
      "durationSec": ${scene2Dur},
      "start": ${scene1Dur},
      "end": ${scene1Dur + scene2Dur},
      "cameraAngle": "POV Medium Tracking",
      "visualDescription": "POV handheld tanaman sayur tumbuh subur di polybag pekarangan sempit, tangan memetik sayur segar langsung dari pohon.",
      "voiceover": "<Naskah VO Scene 2>",
      "onScreenText": "",
      "imagePrompt": "Shot on Sony Alpha A7 IV, 35mm lens f/2.8. Realistic Indonesian home garden POV handheld shot, natural hands plucking a ripe fresh vegetable from a thriving plant in a small backyard pot, warm natural light, clean photography, pure visual only, no text, no title, no watermark, 8k.",
      "videoPrompt": "POV handheld camera, hands harvesting ripe vegetable from potted plant in backyard patio, 4k.",
      "shoots": [
        {
          "id": "scene-2-shoot-1",
          "start": ${scene1Dur},
          "end": ${scene1Dur + 4},
          "visualDescription": "Medium shot memperlihatkan pohon rimbun di pot/polybag teras rumah.",
          "action": "Kamera tracking memperlihatkan pot",
          "cameraAngle": "Medium Shot POV",
          "onScreenText": "",
          "voiceover": "<Potongan VO Shoot 1>"
        },
        {
          "id": "scene-2-shoot-2",
          "start": ${scene1Dur + 4},
          "end": ${scene1Dur + 8},
          "visualDescription": "Tangan memeriksa tunas dan bunga baru yang bermunculan.",
          "action": "Tangan menyentuh bunga baru",
          "cameraAngle": "Close-Up Handheld",
          "onScreenText": "",
          "voiceover": "<Potongan VO Shoot 2>"
        },
        {
          "id": "scene-2-shoot-3",
          "start": ${scene1Dur + 8},
          "end": ${scene1Dur + scene2Dur},
          "visualDescription": "POV tangan memetik sayur matang langsung dari pohonnya.",
          "action": "Tangan memetik tangkai sayuran",
          "cameraAngle": "POV Close-up Harvest",
          "onScreenText": "",
          "voiceover": "<Potongan VO Shoot 3>"
        }
      ]
    },
    {
      "id": "scene-3",
      "sceneNumber": 3,
      "title": "Scene 3: Hasil Panen Dapur & Closing Trigger",
      "durationSec": ${scene3Dur},
      "start": ${scene1Dur + scene2Dur},
      "end": ${targetDuration},
      "cameraAngle": "POV Hero Presentation",
      "visualDescription": "Tangan memegang hasil panen sayur segar di pekarangan rumah, closing ajakan menanam sendiri.",
      "voiceover": "<Naskah VO Scene 3>",
      "onScreenText": "",
      "imagePrompt": "Shot on Sony Alpha A7 IV, 50mm lens f/2.8. Realistic Indonesian home garden POV handheld shot, natural hands proudly presenting a basket of freshly harvested vegetables with thriving garden background, golden hour sunshine, clean photography, pure visual only, no text, no title, no watermark, 8k.",
      "videoPrompt": "POV camera, hands holding freshly harvested vegetables with lush garden background, warm ambient light, 4k.",
      "shoots": [
        {
          "id": "scene-3-shoot-1",
          "start": ${scene1Dur + scene2Dur},
          "end": ${scene1Dur + scene2Dur + 3},
          "visualDescription": "Tangan memamerkan beberapa batang sayur segar hasil panen.",
          "action": "Tangan memegang hasil petik",
          "cameraAngle": "POV Close-up Basket/Hands",
          "onScreenText": "",
          "voiceover": "<Potongan VO Shoot 1>"
        },
        {
          "id": "scene-3-shoot-2",
          "start": ${scene1Dur + scene2Dur + 3},
          "end": ${scene1Dur + scene2Dur + 6},
          "visualDescription": "Hero Shot tanaman sayur subur di pekarangan rumah.",
          "action": "Kamera menyorot keindahan tanaman",
          "cameraAngle": "Hero View Handheld",
          "onScreenText": "",
          "voiceover": "<Potongan VO Shoot 2>"
        },
        {
          "id": "scene-3-shoot-3",
          "start": ${scene1Dur + scene2Dur + 6},
          "end": ${targetDuration},
          "visualDescription": "Closing shot dengan jempol tangan ke tanaman + ajakan menanam.",
          "action": "Tangan memberikan jempol",
          "cameraAngle": "POV Close-up",
          "onScreenText": "",
          "voiceover": "<Potongan VO Closing CTA>"
        }
      ]
    }
  ]
}
\`\`\`

---

### 4. 📱 SARAN CAPTION TIKTOK SIAP COPY-PASTE (SUPER RAPI)
Buatkan satu blok teks rapi berisi caption lengkap dengan hook pertanyaan, poin keunggulan, nilai hemat dapur, disclaimer edukasi, pancingan komentar 1 kata, dan hashtag:

\`\`\`text
[Nama Sayur] merupakan tanaman sayur yang buahnya banyak dijadikan lalapan dan menu wajib di dapur! 🍆✨ Siapa yang kepikiran mau tanam [Nama Sayur] sendiri di halaman rumah?

Ciri-ciri dan keunggulan benih [Nama Sayur]:
• 📏 Bentuk & Ukuran: [Panjang mulus, warna segar mengkilap]
• 🌱 Sifat Tumbuh: [Genjah / sangat rajin berbuah tanpa kenal musim]
• 🪴 Fleksibel: [Bisa ditanam maksimal di polybag / pot kecil halaman rumah]
• 🍳 Hemat Belanja Dapur: [Tinggal petik segar saat mau masak atau bikin lalapan sambal]
• 🌿 Perawatan Mudah: [Cocok untuk pemula & tahan cuaca tropis]

Kenapa tanam [Nama Sayur] di rumah itu memuaskan?
Selain menghemat pengeluaran dapur, kamu bisa menikmati sayuran segar organik tanpa pestisida berbahaya, dipetik langsung dari pekarangan rumah sendiri.

Catatan penting:
Konten ini bersifat edukasi dan informasi budidaya tanaman pekarangan rumah. Hasil panen dapat berbeda tergantung perawatan, pemupukan, dan sinar matahari.

Komen "[KATA_KUNCI]" kalau kamu mau coba tanam benih unggul ini di rumah! 👇
Save video ini biar nggak lupa pas mau mulai berkebun! 📌
Share ke keluarga atau teman yang suka masak dan lalapan! 🌻

#[Tag1] #[Tag2] #[Tag3] #[Tag4] #PanenDiRumah #KebunSayur #SayuranPekarangan #Tabulampot #BenihUnggul
\`\`\``;
  }

  // Special Handler for Plant Review & Oddity Showcase (/plantreview, /odditygarden, /plantoddity)
  if (presetKey === 'plantreview' || presetKey === 'odditygarden' || presetKey === 'plantoddity') {
    const brief = userBrief || 'Bibit Long Murbei asal Taiwan buah unik panjang menyerupai ulat raksasa, manis legit, tabulampot pekarangan rumah.';
    const durationMatch = userBrief.match(/(\d+)\s*(?:detik|s|sec|second)/i);
    const targetDuration = durationMatch ? Math.min(120, Math.max(15, parseInt(durationMatch[1], 10))) : 45;
    
    // Dynamic scene calculation (3-4 scenes with 3 shoots each)
    const numScenes = targetDuration <= 25 ? 2 : (targetDuration <= 35 ? 3 : 4);
    const sceneDur = Math.floor(targetDuration / numScenes);
    const remainder = targetDuration - (sceneDur * numScenes);

    return `[STORYBOARD DIRECTOR & TIKTOK VIRAL ARCHITECT: /PLANTREVIEW - FAST-PACED MULTI-SHOOT ODDITY SHOWCASE]
Anda adalah Creative Director Video TikTok & Copywriter Konten Agrikultur/Urban Farming Viral kelas dunia.
Tugas Anda adalah merancang konsep video review tanaman/buah unik yang SANGAT DINAMIS dengan pergantian shot/angle cepat (Multi-Shoot per Scene), memadukan Hook Visual Oddity (keanehan bentuk & perbandingan skala), Pembuktian Rasa & Tekstur (Taste/Juice Test), Edukasi Budidaya Tabulampot, JSON Storyboard Weavy dengan nested sub-shoots, dan Template Caption TikTok super rapi siap copy-paste.

============================================================
INFORMASI BRIEF PENGGUNA:
============================================================
[MAIN BRIEF]: ${brief}
[TARGET TOTAL DURASI]: ${targetDuration} detik (${numScenes} Scene Container, Masing-masing terdiri dari 3 Sub-Shoot Cepat @ 2-4 detik)

============================================================
PRINSIP UTAMA STRUKTUR: BAGIAN ➔ SCENE ➔ MULTI-SHOOT (ANTI-MONOTON)
============================================================
Video TikTok viral TIDAK BOLEH hanya 1 shot statis per scene! Setiap Scene WAJIB dipecah menjadi 3 Sub-Shoot dinamis dengan pergantian sudut pandang kamera, pergerakan mikro tangan, dan variasi aksi:

1. SCENE 1: HOOK VISUAL ODDITY & SCALE COMPARISON (0–${sceneDur}s)
   - Shoot 1: Extreme Macro / Close-up menyorot bentuk/tekstur aneh buah yang bikin orang salah sangka (contoh: menyerupai ulat raksasa, anggur menempel di batang kayu, cabe seukuran terong).
   - Shoot 2: Hand-in-frame menaruh jari/telapak tangan di samping buah untuk perbandingan ukuran nyata (Scale Comparison 12–18 cm vs jari).
   - Shoot 3: Low Angle / Tracking melihat dahan pohon pekarangan yang sarat buah lebat menggelantung alami.

2. SCENE 2: VARIETY REVEAL & SENSORY/TASTE PROOF (${sceneDur}–${sceneDur * 2}s)
   - Shoot 1: POV tangan memetik buah yang paling ranum dan matang pekat (tangkai terputus renyah berembun).
   - Shoot 2: POV tangan membelah buah di atas talenan kayu / di telapak tangan, memperlihatkan tekstur serat tebal, tanpa biji, dan air buah juicy berkilau saat ditekan lembut.
   - Shoot 3: POV tangan mengangkat potongan buah mendekat ke lensa kamera (mencicipi/makan), narasi membongkar rasa manis legit tanpa rasa asam khas murbei lokal.

3. SCENE 3: TABULAMPOT & URBAN FARMING PROOF (${sceneDur * 2}–${sceneDur * 3}s)
   - Shoot 1: POV handheld tracking mundur memperlihatkan seluruh pohon rimbun berbuah lebat di dalam pot/polybag pekarangan sempit rumah.
   - Shoot 2: Tangan menyentuh daun lebar yang rimbun menyejukkan pekarangan.
   - Shoot 3: Close-up tunas muda yang sudah bermunculan bakal buah baru (bukti varietas genjah / rajin berbuah tanpa kenal musim).

4. SCENE 4: HARVEST SHOWCASE, COMMENT TRAP & CTA (${sceneDur * 3}–${targetDuration}s)
   - Shoot 1: POV tangan memegang semangkuk/segenggam hasil panen segar di kebun.
   - Shoot 2: Kamera menyorot bibit tanaman subur siap tanam.
   - Shoot 3: Tangan memberikan jempol (thumbs-up) ke tanaman + naskah ajakan ketik kata kunci ("Komen 'LONG' / 'BIBIT'...") + ajakan Save & Share.

============================================================
ATURAN VISUAL & GENERASI AI (STRICT):
============================================================
- Kamera: POV First-Person Handheld, natural micro movement, hangatnya sinar matahari pekarangan rumah Indonesia.
- Talent: Hands-only (hanya tangan natural berinteraksi dengan tanaman/buah/tanah). DILARANG menampilkan wajah, tubuh utuh, atau ekstra tangan melayang.
- "onScreenText": WAJIB string kosong "" (murni visual estetik).
- Voiceover: Voiceover pada setiap scene WAJIB MINIMAL 27 KATA & MAKSIMAL 30 KATA (rentang wajib 27–30 kata per scene). DILARANG di bawah 27 kata dan DILARANG di atas 30 kata (agar tidak terpotong saat render 10 detik)!
- DILARANG menampilkan objek keranjang kuning belanja fisik di prompt gambar!
- Prompt gambar berstandar: Shot on Sony Alpha A7 IV, 35mm/50mm lens f/2.8, clean photography, pure visual only, no text, no title, no typography, no watermark, 8k.

============================================================
STRUKTUR OUTPUT JAWABAN ANDA (WAJIB IKUTI 4 BAGIAN INI):
============================================================

### 1. 🌿 RISET PRODUK & ANATOMI KEUNGGULAN
- **Nama Tanaman/Varietas:** [Nama botani & nama populer]
- **Visual Oddity Hook:** [Analogi bentuk & perbandingan skala]
- **Keunggulan Rasa & Tekstur:** [Profil rasa manis legit vs varietas lokal biasa]
- **Karakter Budidaya:** [Genjah, adaptif iklim tropis, tabulampot pot/polybag]

---

### 2. 🎬 BREAKDOWN SCENE & MULTI-SHOOT PACING (${targetDuration} Detik)
Tuliskan breakdown per Scene dengan sub-shoot lengkap:

#### 📍 SCENE 1: HOOK VISUAL ODDITY & SCALE (0–${sceneDur}s)
* **Shoot 1 (0–3s):**
  • **Visual:** [Extreme close-up macro menyorot keanehan bentuk buah]
  • **Aksi Tangan:** [Tangan mengarahkan kamera ke buah]
  • **Kamera:** Macro Close-Up POV
  • **Voiceover:** "[Naskah Hook VO mengejutkan]"
* **Shoot 2 (3–6s):**
  • **Visual:** [Tangan menaruh jari di samping buah untuk perbandingan panjang]
  • **Aksi Tangan:** [Jari mengukur panjang buah]
  • **Kamera:** POV Handheld Scale Shot
  • **Voiceover:** "[Naskah VO perbandingan ukuran]"
* **Shoot 3 (6–${sceneDur}s):**
  • **Visual:** [Dahan pekarangan sarat buah lebat menggelantung]
  • **Aksi Tangan:** [Tangan menopang dahan rimbun]
  • **Kamera:** Low Angle POV Handheld
  • **Voiceover:** "[Naskah VO pembuka varietas]"
* **Prompt Gambar Scene 1 (Container 8K):**
  \`\`\`text
  Shot on Sony Alpha A7 IV, 35mm lens f/2.8. Realistic Indonesian home garden POV handheld shot, natural hands holding exotic long mulberry fruit hanging from lush green branch, morning sunlight dew, clean photography, pure visual only, no text, no title, no yellow basket, no watermark, 8k.
  \`\`\`

*(Lanjutkan format yang sama untuk SCENE 2, SCENE 3, dan SCENE 4)*

---

### 3. 📋 BLOK JSON STORYBOARD PROJECT (DENGAN NESTED SHOOTS)
Di bagian ini, sertakan blok JSON \`\`\`storyboard_project ... \`\`\` lengkap dan valid dengan array \`shoots\` di setiap scene:
\`\`\`storyboard_project
{
  "title": "${brief.replace(/["\n\r]/g, ' ').slice(0, 35)}",
  "productName": "<Nama Tanaman/Bibit>",
  "productDesc": "<Nilai Keunikan & Rasa>",
  "preset": "plantreview",
  "duration": ${targetDuration},
  "aspectRatio": "9:16",
  "formula": "plant_oddity_review",
  "numScenes": ${numScenes},
  "scenes": [
    {
      "id": "scene-1",
      "sceneNumber": 1,
      "title": "Scene 1: Oddity Hook & Perbandingan Skala",
      "durationSec": ${sceneDur},
      "start": 0,
      "end": ${sceneDur},
      "cameraAngle": "POV Handheld Close-up",
      "visualDescription": "POV handheld tangan di pekarangan rumah menyorot buah eksotis panjang unik menggantung lebat di dahan pohon.",
      "voiceover": "<Naskah VO Scene 1>",
      "onScreenText": "",
      "imagePrompt": "Shot on Sony Alpha A7 IV, 35mm lens. Realistic Indonesian home garden POV handheld shot, natural hands measuring long exotic fruit hanging from tree branch, morning sunlight dew, clean photography, pure visual only, no text, no title, no typography, no banner, no words, no watermark, 8k.",
      "videoPrompt": "POV handheld camera panning across long exotic fruit on tree branch, natural hands holding branch, 4k.",
      "shoots": [
        {
          "id": "scene-1-shoot-1",
          "start": 0,
          "end": 3,
          "visualDescription": "Extreme close-up macro tekstur buah unik berembun pagi.",
          "action": "Kamera mendekat ke buah",
          "cameraAngle": "Extreme Macro POV",
          "voiceover": "<Potongan VO Shoot 1>",
          "continuity": "Pencahayaan pagi alami"
        },
        {
          "id": "scene-1-shoot-2",
          "start": 3,
          "end": 6,
          "visualDescription": "Tangan meletakkan jari di sebelah buah untuk perbandingan ukuran panjang 18 cm.",
          "action": "Tangan mengukur panjang buah",
          "cameraAngle": "POV Scale Comparison Shot",
          "voiceover": "<Potongan VO Shoot 2>",
          "continuity": "Buah yang sama di dahan"
        },
        {
          "id": "scene-1-shoot-3",
          "start": 6,
          "end": ${sceneDur},
          "visualDescription": "Low angle menyorot dahan rimbun dengan buah matang bergelantungan lebat.",
          "action": "Tangan menyentuh dahan",
          "cameraAngle": "Low Angle POV Handheld",
          "voiceover": "<Potongan VO Shoot 3>",
          "continuity": "Suasana kebun pekarangan rumah"
        }
      ]
    }
  ]
}
\`\`\`

---

### 4. 📱 SARAN CAPTION TIKTOK SIAP COPY-PASTE (SUPER RAPI)
\`\`\`text
[Hook pembuka eye-catching dengan emoji]

Ciri-ciri dan keunggulan [Nama Tanaman] ([Nama Latin]):
• 📏 Bentuk & Ukuran: [Rincian dimensi/keanehan bentuk]
• 🎨 Warna saat matang: [Gradasi warna dari muda hingga matang]
• 🍬 Rasa & Tekstur: [Perbandingan rasa manis legit vs lokal]
• 🌿 Daun & Karakter: [Fungsi peneduh pekarangan rumah]
• 🌱 Sifat Tumbuh: [Genjah & adaptif iklim tropis Indonesia]
• 🪴 Tabulampot Friendly: [Bisa tumbuh subur & berbuah di dalam pot pekarangan sempit]

Kenapa [Nama Tanaman] menarik?
[Paragraf 2-3 kalimat penjelasan multifungsi, kepuasan panen, dan estetika pekarangan rumah]

Catatan penting:
Informasi bersifat edukasi dan informasi umum budidaya tanaman pekarangan. Hasil panen bisa berbeda tergantung perawatan, iklim, dan media tanam. Bukan klaim medis atau kesehatan khusus.

Komen "[KATA_KUNCI]" kalau kamu pernah lihat atau mau coba tanam buah ini! 👇
Save video ini biar nggak lupa pas mau beli bibitnya! 📌
Share ke teman atau keluarga yang suka tanaman unik! 🌻

#[Tag1] #[Tag2] #[Tag3] #[Tag4] #[Tag5] #Tabulampot #BibitBuahUnik #KebunRumah
\`\`\``;
  }

  // Special Handler for Universal Produk Unggul (/buahunggul, /seedlessfruit, /cuanbibit)
  if (presetKey === 'buahunggul' || presetKey === 'seedlessfruit' || presetKey === 'cuanbibit') {
    const isFemale = /\b(wanita|perempuan|cewek|female|ibu|cewe)\b/i.test(userBrief);
    const voGender = isFemale ? 'wanita' : 'pria';
    const voInstructionText = isFemale
      ? 'instruksi voice over suara seorang wanita'
      : 'instruksi voice over suara seorang pria';
    const videoInstructionText = 'instruksi tidak boleh ada text atau gambar di dalam video';

    const brief = userBrief
      ? userBrief.trim()
      : 'Produk unggulan sesuai gambar/link terlampir atau tanaman/bibit/buah/sayuran/pupuk pekarangan rumah bernilai tinggi.';
    const durationMatch = userBrief.match(/(\d+)\s*(?:detik|s|sec|second)/i);
    const targetDuration = durationMatch ? Math.min(60, Math.max(15, parseInt(durationMatch[1], 10))) : 30;

    // Deteksi kategori produk dari brief agar panduan visual otomatis menyesuaikan secara cerdas
    const isPupukOrNutrisi = /\b(pupuk|nutrisi|booster|poc|npk|pestisida|fungisida|insektisida|hormon|perangsang|media tanam|sekam|cocopeat|kompos|kocor|semprot)\b/i.test(brief);
    const isSayurOrRempah = /\b(sayur|sayuran|cabai|cabe|rawit|tomat|terong|selada|kangkung|pakcoy|sawi|bayam|bawang|seledri|timun|pare|kacang|buncis|jahe|kunyit|rempah)\b/i.test(brief);
    const isBibitOrBenih = /\b(bibit|benih|stek|cangkok|okulasi|semai|seedling|tabulampot|pohon|tanaman)\b/i.test(brief);

    const detectedCategoryHint = isPupukOrNutrisi
      ? 'PUPUK / NUTRISI / BOOSTER / MEDIA TANAM (Fokus: Aplikasi takaran praktis, bukti tanaman jadi rimbun/subur/lebat, & kemasan produk siap checkout)'
      : isSayurOrRempah
        ? 'SAYURAN / REMPAH / KEBUN DAPUR (Fokus: Sensasi petik/patahkan sayur segar renyah, tanaman sayur berbuah/berdaun lebat di pekarangan, & benih/bibit siap tanam)'
        : isBibitOrBenih
          ? 'BIBIT / BENIH / TANAMAN UNGGUL (Fokus: Hook hasil panen/keunggulan tanaman, pohon/tabulampot berbuah lebat bernilai cuan, & bibit sehat siap tanam)'
          : 'UNIVERSAL SEMUA JENIS PRODUK — BUAH / SAYURAN / BIBIT / PUPUK / PRODUK LAINNYA (Wajib 100% mengikuti objek produk di MAIN BRIEF atau gambar terlampir)';

    return `[STORYBOARD DIRECTOR & TIKTOK CONVERSION ARCHITECT: /BUAHUNGGUL - FORMULA UNIVERSAL 3 SCENE x 10 DETIK (TOTAL 30 DETIK)]
Anda adalah Creative Director Video TikTok & Copywriter Iklan Konversi Tinggi kelas dunia.
ATURAN MUTLAK OBJEK PRODUK (ANTI-HARDCODE / 100% UNIVERSAL):
- DILARANG KERAS terpaku pada satu jenis buah tertentu (JANGAN otomatis membahas duku atau tanpa biji kecuali diminta di brief!).
- Preset /buahunggul ini bersifat **100% UNIVERSAL** dan WAJIB menyesuaikan sepenuhnya dengan **PRODUK APA SAJA** yang ditulis pengguna di [MAIN BRIEF] atau yang terlihat pada gambar/link terlampir — baik itu:
  1. **Buah-buahan** (segala jenis buah: mangga, alpukat, anggur, kelengkeng, durian, melon, jeruk, duku, beri, dll)
  2. **Sayuran & Rempah** (cabai, tomat, terong, selada, pakcoy, kangkung, bawang, jahe, dll)
  3. **Bibit & Benih Tanaman** (bibit okulasi, benih sayur/buah, stek, tabulampot, tanaman hias)
  4. **Pupuk, Booster, Pestisida & Media Tanam** (pupuk organik cair/padat, NPK, booster pelebat buah/daun, tanah subur, sekam)
  5. **Alat Kebun & Produk Lainnya** (polybag, pot, gunting kebun, maupun produk UMKM/komersial lainnya sesuai brief)

============================================================
INFORMASI BRIEF PENGGUNA (IKUTI 100% PRODUK INI):
============================================================
[MAIN BRIEF]: ${brief}
[KATEGORI TERDETEKSI]: ${detectedCategoryHint}
[TARGET TOTAL DURASI]: ${targetDuration} detik (3 Scene Container @ 10 detik, Masing-masing Maksimal 3 Sub-Shoot Dinamis)
[TARGET GENDER SUARA]: ${voGender.toUpperCase()} (${voInstructionText})

============================================================
STRUKTUR EMAS ADAPTABLE: 3 SCENE KONTAINER @ 10 DETIK (MAKSIMAL 3 SHOT PER SCENE)
============================================================
Total durasi video WAJIB 30 detik (3 Scene Container @ 10 detik), dan setiap Scene WAJIB memiliki MAKSIMAL 3 SUB-SHOOT dinamis yang menyesuaikan jenis produk di [MAIN BRIEF]:

1. SCENE 1: HOOK VISUAL & BUKTI NYATA KEUNGGULAN PRODUK (0–10s) — Durasi 10 Detik (Maksimal 3 Shot)
   • *Jika Produk = Buah / Sayuran / Hasil Panen:*
     - Shoot 1 (0–3s): Extreme Close-up / Macro tangan memetik atau mengupas/mematahkan produk segar langsung di pekarangan (Pattern Interrupt).
     - Shoot 2 (3–7s): Close-up frontal membelah/menunjukkan bagian dalam, tekstur segar, renyah, tebal, atau kualitas unggulan sesuai brief.
     - Shoot 3 (7–10s): Medium close-up telapak tangan memegang hasil segar yang menggugah selera & membuktikan kualitas nyata.
   • *Jika Produk = Pupuk / Booster / Pestisida / Media Tanam:*
     - Shoot 1 (0–3s): Close-up masalah tanaman yang sering dialami (atau langsung aksi menuang/menyemprot takaran pupuk/booster ke tanaman pekarangan).
     - Shoot 2 (3–7s): Close-up reaksi penyerapan nutrisi pada akar/ tanah/daun atau perbandingan tunas baru yang langsung bermunculan segar.
     - Shoot 3 (7–10s): Medium close-up tanaman yang tampak jauh lebih hijau, subur, dan sehat berkat produk di brief.
   • *Jika Produk = Bibit / Alat Kebun / Produk Lainnya:*
     - Shoot 1 (0–3s): Close-up visual paling menarik dari fisik produk/bibit unggul di tangan (akar/batang kokoh atau cara pakai instan).
     - Shoot 2 (3–7s): Detail kualitas bahan/keunggulan utama yang membedakan produk ini dari produk biasa.
     - Shoot 3 (7–10s): Pembuktian kemudahan pemakaian langsung di pekarangan rumah.

2. SCENE 2: SHOWCASE HASIL MELIMPAH, MANFAAT & NILAI EKONOMI / HEMAT (10–20s) — Durasi 10 Detik (Maksimal 3 Shot)
   • Shoot 1 (10–13s): Low Angle / Tilt Up memperlihatkan hasil nyata di pekarangan (pohon/tanaman berbuah atau berdaun lebat, atau deretan tanaman subur setelah pakai produk).
   • Shoot 2 (13–17s): Tangan menyentuh/menopang hasil tanaman yang lebat/berkualitas sambil narasi menjelaskan manfaat nyata (hemat belanja dapur, panen sendiri, atau nilai jual/ekonomis tinggi).
   • Shoot 3 (17–20s): Tracking shot tanaman di pot/polybag/lahan pekarangan rumah yang adaptif, mudah dirawat, dan terbukti berhasil.

3. SCENE 3: SHOWCASE PRODUK SIAP KIRIM & HARD CTA KERANJANG KUNING (20–30s) — Durasi 10 Detik (Maksimal 3 Shot)
   • Shoot 1 (20–23s): Ground-level / Medium shot menampilkan fisik produk yang dijual sesuai brief (bibit siap tanam di polybag / botol atau kemasan pupuk / benih / produk segar siap kirim).
   • Shoot 2 (23–26s): Tangan memegang/menunjukkan kondisi produk yang rapi, asli, dan siap pakai untuk pekarangan rumah.
   • Shoot 3 (26–30s): Talent memberikan gestur jari telunjuk mengarah ke sudut kiri bawah layar (posisi Keranjang Kuning TikTok), dorongan checkout sekarang sebelum kehabisan stok.

============================================================
5 ATURAN EMAS VISUAL REALISTIS & KETERANGAN SETELAH VO (STRICT):
============================================================
1. KETERANGAN WAJIB SESUDAH VO DI TIAP SCENE:
   Di setiap scene (baik di naskah breakdown maupun di blok JSON), TEPAT SETELAH Voiceover (VO), WAJIB MENYERTAKAN:
   • 🎙️ **Instruksi Voice Over:** ${voInstructionText}
   • 🚫 **Instruksi Video:** ${videoInstructionText}
   (Aturan gender: Default adalah SUARA SEORANG PRIA. Hanya gunakan SUARA SEORANG WANITA jika brief pengguna secara eksplisit menyebut wanita/perempuan/cewek/ibu).
2. VISUAL SANGAT REALISTIS (JANGAN TERLALU SINEMATIK / ANTI-CGI):
   - JANGAN buat visual over-cinematic seperti film bioskop Hollywood! Hindari color grading dramatis kontras tinggi, hindari slow-motion buatan lebay, hindari pencahayaan studio mewah.
   - WAJIB gaya rekaman dokumenter / UGC natural kamera smartphone atau kamera keseharian di pekarangan rumah lokal Indonesia:
     • Pencahayaan alami matahari siang/pagi (natural daylight / warm outdoor sun).
     • Tangan natural manusia nyata (tekstur kulit alami, kuku bersih wajar).
     • Lingkungan pekarangan rumah asli bersahaja (polybag hitam, pot pekarangan, tanah kebun, dedaunan hijau alami).
     • Objek produk tampak nyata dan apa adanya tanpa efek CGI/glossy artifisial.
3. ON-SCREEN TEXT & GRAFIS BERSIH (MURNI VIDEO):
   - "onScreenText": WAJIB string kosong "" pada setiap scene di blok JSON storyboard.
   - Tidak boleh ada teks, subtitle, logo, watermarks, banner, atau elemen gambar/stiker yang menempel di video!
4. DILARANG MEMUNCULKAN KERANJANG BELANJA FISIK DI PROMPT GAMBAR:
   - Jangan menuliskan "yellow shopping cart" di prompt gambar. Tunjuk keranjang kuning adalah gestur tangan talent mengarah ke pojok kiri bawah layar.
5. BLOK JSON STORYBOARD PROJECT LENGKAP DENGAN voInstruction & videoInstruction:
   - Di setiap scene pada blok \`\`\`storyboard_project ... \`\`\`, WAJIB menyertakan properti:
     • "voInstruction": "${voInstructionText}"
     • "videoInstruction": "${videoInstructionText}"
     • "onScreenText": ""
6. ATURAN MUTLAK JUMLAH KATA & KARAKTER VOICEOVER PER SCENE 10 DETIK (27–30 KATA / 180–205 KARAKTER):
   - ⚠️ Durasi render Google Gemini Veo / Flow per scene adalah TEPAT 10 DETIK!
   - Narasi voiceover per scene WAJIB MEMENUHI MINIMAL 27 KATA DAN MAKSIMAL 30 KATA (rentang wajib: 27–30 kata, atau 180–205 karakter termasuk spasi per scene 10 detik)!
   - DILARANG membuat naskah VO di bawah 27 kata / <175 karakter (kependekan) dan DILARANG di atas 30 kata / >210 karakter (karena terbukti KEPOTONG saat render 10 detik)!
   - Total durasi 30 detik (3 scene utuh): WAJIB 81–90 KATA (~550–600 karakter).
7. ATURAN FRASA TRANSISI & KESINAMBUNGAN NARRATIF (STORY CONTINUITY & SEAMLESS FLOW):
   - Alur narasi 3 adegan WAJIB saling menyambung dengan "frasa transisi" yang mengalir natural (Scene 1 Hook Penasaran ➔ Scene 2 Jawaban & Bukti Kualitas ➔ Scene 3 Solusi & Ajakan Beli).
   - Visual objek produk, wadah tanam, tangan talent, dan suasana pekarangan konsisten 100% antar scene.

============================================================
STRUKTUR OUTPUT JAWABAN ANDA (WAJIB IKUTI 5 BAGIAN INI):
============================================================

### 1. 🌿 PROFIL PRODUK & USP UTAMA (SESUAI BRIEF)
- **Nama & Kategori Produk:** [Nama produk sesuai brief: Buah / Sayuran / Bibit / Pupuk / Produk Lainnya]
- **Hook & Keunggulan Utama (USP):** [Daya tarik utama produk sesuai brief]
- **Keunggulan Aplikasi / Perawatan:** [Kemudahan tanam / cara pakai di pekarangan rumah / pot / lahan sempit]
- **Manfaat & Nilai Ekonomi:** [Manfaat panen sendiri / hemat biaya / potensi cuan]

---

### 2. 🎙️ PEMISAHAN VOICEOVER LENGKAP
#### A. Naskah Voiceover Bersih (Clean Script untuk Dubbing / TTS)
> "[Tuliskan naskah VO utuh 30 detik mengalir dari awal sampai akhir khusus membahas produk di MAIN BRIEF]"

#### B. Breakdown Voiceover Per Detik & Emosi
| Detik | Scene & Shot | Penggalan Naskah VO | Intonasi & Emosi |
| :--- | :--- | :--- | :--- |
| 00:00 – 00:03 | Scene 1 (Shot 1) | "[VO Hook Visual Produk sesuai Brief]" | Penasaran, menggugah perhatian |
| 00:03 – 00:07 | Scene 1 (Shot 2) | "[VO Solusi / Bukti Kualitas Produk]" | Relatable, santai |
| 00:07 – 00:10 | Scene 1 (Shot 3) | "[VO Keunggulan Utama Produk]" | Yakin, antusias |
| 00:10 – 00:13 | Scene 2 (Shot 1) | "[VO Bukti Hasil Melimpah / Efektivitas]" | Membuktikan fakta |
| 00:13 – 00:17 | Scene 2 (Shot 2) | "[VO Manfaat Ekonomi / Nilai Jual / Hemat]" | Informatif, prospek cuan/manfaat |
| 00:17 – 00:20 | Scene 2 (Shot 3) | "[VO Kemudahan Tanam / Pakai di Rumah]" | Meyakinkan & praktis |
| 00:20 – 00:23 | Scene 3 (Shot 1) | "[VO Ajakan Coba Produk / Bibit / Pupuk]" | Mengajak, solutif |
| 00:23 – 00:26 | Scene 3 (Shot 2) | "[VO Keuntungan Punya Produk Ini di Rumah]" | Antusias, peluang bagus |
| 00:26 – 00:30 | Scene 3 (Shot 3) | "[VO Hard CTA Keranjang Kuning Kiri Bawah]" | Mendesak, FOMO stok terbatas |

---

### 3. 🎬 BREAKDOWN STORYBOARD LENGKAP (3 SCENE @ 10 DETIK - TOTAL 30 DETIK)
Uraikan 3 scene container beserta sub-shoot di dalamnya sesuai produk di [MAIN BRIEF] (Tiap scene 10 detik, maksimal 3 shot per scene):

- 🎬 **Scene 1 (0–10s): Hook Visual & Bukti Kualitas Produk** (Durasi: 10 Detik)
  • 🎥 **Sudut Kamera:** Extreme Close-up to Frontal Focus
  • 🖼️ **Visual Realistis:** [Deskripsikan visual nyata untuk produk di MAIN BRIEF. Gaya rekaman HP natural pekarangan rumah, pencahayaan matahari alami, murni visual tanpa efek sinematik berlebihan, tanpa teks atau gambar di dalam video]
  • 🎙️ **Voiceover (VO):** "[Naskah VO Scene 1 (0-10s) khusus produk di brief]"
  • 🎙️ **Instruksi Voice Over:** ${voInstructionText}
  • 🚫 **Instruksi Video:** ${videoInstructionText}
  • ⚡ **Rincian Sub-Shoot (Maksimal 3 Shot):**
    - *Shot 1 (0–3s):* [Aksi visual shot 1 sesuai produk di brief]
    - *Shot 2 (3–7s):* [Aksi visual shot 2 sesuai produk di brief]
    - *Shot 3 (7–10s):* [Aksi visual shot 3 sesuai produk di brief]

- 🎬 **Scene 2 (10–20s): Showcase Hasil Nyata & Nilai Manfaat/Ekonomi** (Durasi: 10 Detik)
  • 🎥 **Sudut Kamera:** Low Angle Tilt Up to Tracking Shot
  • 🖼️ **Visual Realistis:** [Deskripsikan hasil tanaman/produk yang melimpah di pekarangan rumah sesuai MAIN BRIEF. Gaya rekaman natural pekarangan rumah lokal Indonesia, pencahayaan matahari alami, murni visual tanpa filter sinematik dramatis, tanpa teks atau gambar di dalam video]
  • 🎙️ **Voiceover (VO):** "[Naskah VO Scene 2 (10-20s) khusus produk di brief]"
  • 🎙️ **Instruksi Voice Over:** ${voInstructionText}
  • 🚫 **Instruksi Video:** ${videoInstructionText}
  • ⚡ **Rincian Sub-Shoot (Maksimal 3 Shot):**
    - *Shot 1 (10–13s):* [Aksi visual shot 1 sesuai produk di brief]
    - *Shot 2 (13–17s):* [Aksi visual shot 2 sesuai produk di brief]
    - *Shot 3 (17–20s):* [Aksi visual shot 3 sesuai produk di brief]

- 🎬 **Scene 3 (20–30s): Showcase Produk Siap Kirim & Hard CTA Keranjang Kuning** (Durasi: 10 Detik)
  • 🎥 **Sudut Kamera:** Ground-level / Medium to Direct Action Close-up
  • 🖼️ **Visual Realistis:** [Deskripsikan tampilan fisik produk/bibit/pupuk/sayur siap kirim di pekarangan rumah lalu tangan menunjuk ke sudut kiri bawah layar mengajak checkout. Gaya rekaman HP pekarangan rumah, pencahayaan alami, murni visual tanpa teks atau gambar di dalam video]
  • 🎙️ **Voiceover (VO):** "[Naskah VO Scene 3 (20-30s) khusus produk di brief]"
  • 🎙️ **Instruksi Voice Over:** ${voInstructionText}
  • 🚫 **Instruksi Video:** ${videoInstructionText}
  • ⚡ **Rincian Sub-Shoot (Maksimal 3 Shot):**
    - *Shot 1 (20–23s):* [Aksi visual shot 1 menampilkan produk siap kirim sesuai brief]
    - *Shot 2 (23–26s):* [Aksi visual shot 2 tangan menyentuh/menunjukkan kualitas fisik produk]
    - *Shot 3 (26–30s):* [Aksi visual shot 3 gestur jari menunjuk ke arah sudut kiri bawah layar mengajak checkout]

---

### 4. 📋 BLOK JSON STORYBOARD PROJECT
Sertakan blok JSON \`\`\`storyboard_project ... \`\`\` yang valid dengan 3 scene @ 10s dan array \`shoots\` (WAJIB isi sesuai produk pada [MAIN BRIEF], JANGAN menyalin teks placeholder mentah):
\`\`\`storyboard_project
{
  "title": "${brief.replace(/["\n\r]/g, ' ').slice(0, 45)}",
  "productName": "<Isi Nama Produk Sesuai Brief Pengguna>",
  "productDesc": "<Isi Keunggulan Utama Produk Sesuai Brief Pengguna>",
  "preset": "buahunggul",
  "duration": 30,
  "aspectRatio": "9:16",
  "formula": "buah_unggul_3x10s",
  "numScenes": 3,
  "scenes": [
    {
      "id": "scene-1",
      "sceneNumber": 1,
      "title": "Scene 1: Hook Visual & Bukti Kualitas Produk",
      "durationSec": 10,
      "start": 0,
      "end": 10,
      "cameraAngle": "Extreme Close-Up to Frontal",
      "visualDescription": "<Deskripsikan visual nyata Scene 1 sesuai produk di brief pengguna dengan gaya rekaman HP natural pekarangan rumah Indonesia>",
      "voiceover": "<Tuliskan kalimat VO Scene 1 (0-10 detik) yang membahas keunggulan utama produk di brief pengguna>",
      "voInstruction": "${voInstructionText}",
      "videoInstruction": "${videoInstructionText}",
      "onScreenText": "",
      "imagePrompt": "<Write a realistic everyday Indonesian home garden handheld photo prompt matching the exact product in the user's brief for Scene 1, natural outdoor daylight, ordinary human hands, authentic everyday photography, pure visual only, no text, no title, no logo, no watermark, no overlays, realistic documentary style, not cinematic, no dramatic filter, 8k>",
      "videoPrompt": "<Write a realistic handheld smartphone video prompt matching the exact product in the user's brief for Scene 1 in an outdoor Indonesian backyard, natural daylight, pure video footage, no text, no captions, no subtitles, no images, no icons, no overlays, authentic raw video>",
      "shoots": [
        {
          "id": "scene-1-shoot-1",
          "start": 0,
          "end": 3,
          "visualDescription": "<Visual Shot 1 (0-3s) sesuai produk di brief>",
          "action": "<Aksi Shot 1 sesuai produk di brief>",
          "cameraAngle": "Extreme Close-up Macro",
          "voiceover": "<Penggalan VO Shot 1 (0-3s) sesuai produk di brief>"
        },
        {
          "id": "scene-1-shoot-2",
          "start": 3,
          "end": 7,
          "visualDescription": "<Visual Shot 2 (3-7s) pembuktian kualitas produk sesuai brief>",
          "action": "<Aksi Shot 2 sesuai produk di brief>",
          "cameraAngle": "Close-up Frontal Focus",
          "voiceover": "<Penggalan VO Shot 2 (3-7s) sesuai produk di brief>"
        },
        {
          "id": "scene-1-shoot-3",
          "start": 7,
          "end": 10,
          "visualDescription": "<Visual Shot 3 (7-10s) detail keunggulan produk di tangan>",
          "action": "<Aksi Shot 3 sesuai produk di brief>",
          "cameraAngle": "Medium Close-up Handheld",
          "voiceover": "<Penggalan VO Shot 3 (7-10s) sesuai produk di brief>"
        }
      ]
    },
    {
      "id": "scene-2",
      "sceneNumber": 2,
      "title": "Scene 2: Showcase Hasil Nyata & Nilai Manfaat",
      "durationSec": 10,
      "start": 10,
      "end": 20,
      "cameraAngle": "Low Angle Tilt Up to Tracking",
      "visualDescription": "<Deskripsikan visual nyata Scene 2 (hasil panen lebat / tanaman subur / efektivitas produk di pekarangan rumah) sesuai brief pengguna>",
      "voiceover": "<Tuliskan kalimat VO Scene 2 (10-20 detik) yang membahas hasil melimpah, manfaat nyata, atau nilai ekonomis produk di brief>",
      "voInstruction": "${voInstructionText}",
      "videoInstruction": "${videoInstructionText}",
      "onScreenText": "",
      "imagePrompt": "<Write a realistic Indonesian home garden backyard photo prompt showing the abundant result or plant growth of the exact product in the user's brief for Scene 2, natural warm sunlight, authentic everyday photography, pure visual only, no text, no title, no logo, no watermark, no overlays, realistic documentary style, not cinematic, no dramatic filter, 8k>",
      "videoPrompt": "<Write a realistic handheld camera video prompt showing the abundant result or plant growth of the exact product in the user's brief for Scene 2 in an Indonesian home garden, natural sunlight, pure video footage, no text, no captions, no subtitles, no images, no icons, no overlays, authentic raw video>",
      "shoots": [
        {
          "id": "scene-2-shoot-1",
          "start": 10,
          "end": 13,
          "visualDescription": "<Visual Shot 1 (10-13s) menelusuri hasil lebat/kesuburan produk sesuai brief>",
          "action": "<Aksi Shot 1 kamera menelusuri objek>",
          "cameraAngle": "Low Angle Tilt Up",
          "voiceover": "<Penggalan VO Shot 1 (10-13s) sesuai produk di brief>"
        },
        {
          "id": "scene-2-shoot-2",
          "start": 13,
          "end": 17,
          "visualDescription": "<Visual Shot 2 (13-17s) tangan memegang/menunjukkan hasil nyata di pekarangan>",
          "action": "<Aksi Shot 2 tangan menyentuh objek>",
          "cameraAngle": "Medium Shot POV",
          "voiceover": "<Penggalan VO Shot 2 (13-17s) sesuai produk di brief>"
        },
        {
          "id": "scene-2-shoot-3",
          "start": 17,
          "end": 20,
          "visualDescription": "<Visual Shot 3 (17-20s) tracking shot tanaman/produk di pekarangan rumah>",
          "action": "<Aksi Shot 3 kamera tracking>",
          "cameraAngle": "Eye-level Tracking Shot",
          "voiceover": "<Penggalan VO Shot 3 (17-20s) sesuai produk di brief>"
        }
      ]
    },
    {
      "id": "scene-3",
      "sceneNumber": 3,
      "title": "Scene 3: Produk Siap Kirim & CTA Keranjang Kuning",
      "durationSec": 10,
      "start": 20,
      "end": 30,
      "cameraAngle": "Ground-level to Action Close-up",
      "visualDescription": "<Deskripsikan tampilan fisik produk/bibit/pupuk/benih siap kirim di pekarangan rumah, tangan menyentuh produk lalu menunjuk ke sudut kiri bawah layar mengajak checkout>",
      "voiceover": "<Tuliskan kalimat VO Scene 3 (20-30 detik) berisi ajakan mencoba produk ini dan arahan checkout di keranjang kiri bawah sebelum kehabisan>",
      "voInstruction": "${voInstructionText}",
      "videoInstruction": "${videoInstructionText}",
      "onScreenText": "",
      "imagePrompt": "<Write a realistic Indonesian backyard garden photo prompt showing the physical product/seedling/fertilizer/package from the user's brief ready to ship with a natural human hand pointing toward the bottom left corner, natural daylight, authentic everyday photography, pure visual only, no text, no title, no yellow shopping cart, no logo, no watermark, no overlays, realistic documentary style, not cinematic, no dramatic filter, 8k>",
      "videoPrompt": "<Write a realistic handheld smartphone video prompt showing the physical product/seedling/fertilizer from the user's brief in an outdoor Indonesian backyard with a natural hand gesturing towards the bottom left corner, natural lighting, pure video footage, no text, no captions, no subtitles, no images, no icons, no overlays, authentic raw video>",
      "shoots": [
        {
          "id": "scene-3-shoot-1",
          "start": 20,
          "end": 23,
          "visualDescription": "<Visual Shot 1 (20-23s) menampilkan fisik produk/bibit/pupuk siap kirim sesuai brief>",
          "action": "<Aksi Shot 1 kamera menyorot produk>",
          "cameraAngle": "Ground-level / Medium Shot",
          "voiceover": "<Penggalan VO Shot 1 (20-23s) sesuai produk di brief>"
        },
        {
          "id": "scene-3-shoot-2",
          "start": 23,
          "end": 26,
          "visualDescription": "<Visual Shot 2 (23-26s) tangan menyentuh/menunjukkan kualitas fisik produk>",
          "action": "<Aksi Shot 2 tangan memegang produk>",
          "cameraAngle": "Medium Close-up",
          "voiceover": "<Penggalan VO Shot 2 (23-26s) sesuai produk di brief>"
        },
        {
          "id": "scene-3-shoot-3",
          "start": 26,
          "end": 30,
          "visualDescription": "<Visual Shot 3 (26-30s) gestur jari menunjuk ke arah sudut kiri bawah layar dengan latar produk siap kirim>",
          "action": "Jari menunjuk ke sudut kiri bawah layar mengajak checkout",
          "cameraAngle": "Direct Action Close-up",
          "voiceover": "<Penggalan VO Shot 3 (26-30s) ajakan checkout di keranjang kiri bawah>"
        }
      ]
    }
  ]
}
\`\`\`

---

### 5. 📱 TEMPLATE CAPTION TIKTOK VIRAL SIAP COPY-PASTE
Sediakan caption TikTok yang rapi, informatif, dan 100% sesuai produk di [MAIN BRIEF]:
\`\`\`text
[Hook 1-2 kalimat menarik sesuai produk di brief] 🌱

Mengenal [Nama Produk / Tanaman / Pupuk]:
[Penjelasan singkat keunggulan dan fungsi utama produk sesuai brief]:
• 🏷️ [Keunggulan / Varietas / Manfaat 1] — [Penjelasan singkat]
• 🏷️ [Keunggulan / Varietas / Manfaat 2] — [Penjelasan singkat]
• 🏷️ [Keunggulan / Varietas / Manfaat 3] — [Penjelasan singkat]

Keunikan dan keunggulan utama:
• ✨ [Poin keunggulan 1 sesuai produk]
• 💧 [Poin keunggulan 2 sesuai produk]
• 🌱 [Poin keunggulan 3 sesuai produk]
• ⏱️ [Poin keunggulan 4: kemudahan perawatan / pemakaian]
• 🪴 [Poin keunggulan 5: cocok untuk pekarangan rumah / pot / kebun]

Potensi manfaat & nilai ekonomi:
[Jelaskan manfaat hemat belanja rumah tangga, hasil panen melimpah, atau nilai jual produk sesuai brief].

Catatan:
Hasil pertumbuhan, panen, dan efektivitas dapat berbeda-beda tergantung kondisi lingkungan, perawatan, iklim, dan media tanam. Informasi ini bersifat umum.

Disclaimer:
Konten ini bersifat edukasi dan informasi umum. Selalu sesuaikan dengan kondisi lahan/tanaman dan petunjuk penggunaan produk.

Komen "[KATA_KUNCI_PRODUK]" kalau kamu mau coba di rumah! 👇
Save video ini biar nggak lupa! 📌
Share ke teman yang hobi berkebun & tanaman! 🌻

#[TagProduk1] #[TagProduk2] #[TagProduk3] #KebunRumah #PekaranganRumah #TanamanUnggul
\`\`\``;
  }

  // Special Handler for On The Spot: Investigasi Bibit, Buah & Benih Unggul (/onthespot, /spotbibit, /spotbuah, /investigasikebun)
  if (presetKey === 'onthespot' || presetKey === 'spotbibit' || presetKey === 'spotbuah' || presetKey === 'investigasikebun') {
    const isFemale = /\b(wanita|perempuan|cewek|female|ibu|cewe)\b/i.test(userBrief);
    const voGender = isFemale ? 'wanita' : 'pria';
    const voInstructionText = isFemale
      ? 'instruksi voice over suara seorang influencer TikTok perkebunan wanita yang energik, ramah, persuasif, antusias dan natural khas konten racun belanja & affiliate TikTok'
      : 'instruksi voice over suara seorang influencer TikTok perkebunan pria yang energik, ramah, persuasif, antusias dan natural khas konten racun belanja & affiliate TikTok';
    const videoInstructionText = 'instruksi tidak boleh ada text, logo, watermark atau gambar di dalam video (murni footage sinematik 4k/veo flow dokumenter investigasi visual On The Spot)';

    const brief = userBrief
      ? userBrief.trim()
      : 'Bibit tanaman buah unggul, varietas benih langka, atau buah viral berbuah lebat di pekarangan rumah.';
    const durationMatch = userBrief.match(/(\d+)\s*(?:detik|s|sec|second)/i);
    const targetDuration = durationMatch ? Math.min(60, Math.max(15, parseInt(durationMatch[1], 10))) : 30;

    const isBenih = /\b(benih|biji|semai|kecambah|sprout|germination)\b/i.test(brief);
    const isBuah = /\b(buah|melon|mangga|alpukat|anggur|durian|kelengkeng|jeruk|duku|nanas|semangka|strawberry|beri|tin|fig)\b/i.test(brief);
    const isBibit = /\b(bibit|pohon|tanaman|tabulampot|okulasi|cangkok|stek|seedling|polybag)\b/i.test(brief);

    const categoryHint = isBenih
      ? 'BENIH TANAMAN UNGGUL / DAYA KECAMBAH TINGGI (Fokus: Keajaiban butir benih kecil bernilai tinggi, daya tumbuh cepat 98% & hasil panen luar biasa)'
      : isBuah
        ? 'BUAH UNIK / EKSOTIS / SUPER MANIS (Fokus: Keunikan visual daging buah tebal juicy berkilau, kadar manis tinggi Brix 16+, & fenomena pohon pendek lebat)'
        : 'BIBIT TANAMAN UNGGUL / TABULAMPOT PEKARANGAN (Fokus: Fenomena tabulampot pohon kerdil berbuah lebat di pot teras, akar super sehat, & rahasia bibit asli bergaransi)';

    return `[STORYBOARD DIRECTOR & DOKUMENTER INVESTIGASI: /ONTHESPOT - FORMULA VISUAL ON THE SPOT + VOICEOVER INFLUENCER TIKTOK (3 SCENE @ 10s VEO/FLOW)]
Anda adalah Sutradara Video Komersial Perkebunan & Produser Kreator TikTok Viral papan atas.
Format video ini dirancang KHUSUS & PRESISI:
- 🎥 **VISUAL VIDEO (100% GAYA ON THE SPOT TRANS7):** Footage sinematik 4K extreme macro, pencahayaan golden hour alami pekarangan, cross-section buah juicy, pembuktian perakaran lebat, murni video tanpa teks/watermark, pas untuk siklus **10 DETIK SEKALI RENDER di Google Gemini (Veo / Flow)**!
- 🎙️ **VOICEOVER (100% GAYA INFLUENCER TIKTOK JUALAN):** Suara ${voGender.toUpperCase()} yang energik, ramah, persuasif, hook racun belanja TikTok yang bikin orang berhenti scroll, direct selling keunggulan produk, dan closing mendesak keranjang kuning!

============================================================
KARAKTERISTIK GABUNGAN: VISUAL ON THE SPOT + VO INFLUENCER TIKTOK:
============================================================
1. **Voice Over Influencer TikTok (Racun Jualan / Affiliate):**
   - Karakter suara ${voGender.toUpperCase()}: antusias, energik, friendly, tidak kaku seperti presenter berita TV lama, tempo lincah khas kreator TikTok (~2.3 sampai 2.5 kata per detik).
   - Menggunakan hook persuasif khas TikTok:
     • "Guys seriusan, kalian yang punya pekarangan sempit wajib tahu ini!"
     • "Nyesel banget baru tahu sekarang, ternyata rahasianya ada di sini!"
     • "Lihat nih pas dibelah, bener-bener juicy dan tebal banget!"
     • "Awas jangan sampai ketipu beli bibit palsu, yang asli garansi resmi langsung amankan di keranjang kuning sekarang!"
2. **Formula 3 Fakta Mencengangkan (3 Scene @ 10 Detik - Total 30 Detik):**
   - **Scene 1 (0–10s) — Fakta #1: Hook Racun TikTok & Keajaiban Visual**
     • Hook antusias influencer menyapa penonton & menyorot fenomena unik produk.
     • Extreme macro lens On The Spot menyorot butiran embun di atas kecambah benih/kulit buah.
     • Slow push-in dramatis mengungkap pohon sarat buah di pekarangan sempit.
   - **Scene 2 (10–20s) — Fakta #2: Pembuktian Kualitas Ekstrem & Spill Rahasia Panen**
     • Pembuktian visual ekstrem: irisan pisau membelah buah (cross-section juicy berkilau) ATAU perakaran bibit super putih tebal tanpa penyakit.
     • Influencer membeberkan fakta praktis: genjah cepat berbuah di pot, adaptif cuaca panas/hujan, manis legit tanpa ampas.
   - **Scene 3 (20–30s) — Fakta #3: Waspada Bibit Palsu & Hard Selling Keranjang Kuning**
     • Sorotan fisik bibit/benih asli berlabel garansi siap kirim packing kayu aman.
     • Influencer memperingatkan penonton: "Jangan tergiur harga murah bibit tiruan yang mandul!"
     • Hard CTA: Gestur tangan menunjuk ke sudut kiri bawah layar (posisi Keranjang Kuning TikTok), ajakan checkout sekarang sebelum kehabisan voucher promo.
3. **Optimasi Khusus Google Gemini Veo / Flow (10s Render Cycle):**
   - Durasi tiap scene tepat 10 detik.
   - Rincian prompt video murni fotorealistik (photorealistic 4k, macro lens 100mm f/2.8, shallow depth of field, natural golden sunlight, authentic organic textures).
   - "onScreenText": "" (string kosong mutlak, dilarang ada teks/watermark yang merusak render Veo/Flow).
4. **ATURAN MUTLAK JUMLAH KATA & KARAKTER VOICEOVER PER SCENE 10 DETIK (27–30 KATA / 180–205 KARAKTER):**
   - ⚠️ **SANGAT KRUSIAL**: Durasi render Google Gemini Veo / Flow per scene adalah TEPAT 10 DETIK!
   - Naskah voiceover per scene WAJIB MEMENUHI MINIMAL 27 KATA DAN MAKSIMAL 30 KATA (rentang wajib: 27–30 kata, atau 180–205 karakter termasuk spasi per scene)!
   - **DILARANG MEMBUAT DI BAWAH 27 KATA / <175 KARAKTER (kependekan) DAN DILARANG DI ATAS 30 KATA / >210 KARAKTER (pasti terpotong saat render 10 detik)!**
   - Pembagian kata jika ada sub-shot (3 shoot):
     • Shoot 1 (0–3s): 8–10 kata (Hook kencang menyapa & menarik perhatian)
     • Shoot 2 (3–7s): 10–11 kata (Spill keunggulan produk & racun jualan)
     • Shoot 3 (7–10s): 8–9 kata (Penguat jualan / rasa penasaran / hard CTA)
     • TOTAL PER SCENE 10 DETIK: WAJIB TEPAT 27–30 KATA (~180–205 KARAKTER)!
   - Total VO utuh 3 scene (30 detik): WAJIB 81–90 KATA (~550–600 KARAKTER).
5. **ATURAN FRASA TRANSISI & KESINAMBUNGAN NARRATIF (STORY CONTINUITY & SEAMLESS FLOW):**
   - Naskah voiceover 3 scene DILARANG terputus-putus seperti 3 iklan berbeda! Wajib menggunakan "frasa transisi" dan alur cerita yang menyambung secara utuh (Story Arc Sebab-Akibat):
     • Jembatan Scene 1 ➔ Scene 2 (Dari Hook ke Pembuktian): Gunakan kata penghubung seperti *"Kalian pasti penasaran kan rahasianya? Pas kita belah lihat nih..."*, atau *"Bukan cuma tampilannya yang bikin takjub, coba lihat daging buahnya..."*
     • Jembatan Scene 2 ➔ Scene 3 (Dari Pembuktian ke Solusi & CTA): Gunakan kata penghubung seperti *"Biar pekarangan rumah kalian bisa panen semelimpah ini juga, pastikan..."*, atau *"Kabar baiknya bibit indukan okulasi aslinya sudah siap kirim..."*
   - Kesinambungan Visual (Visual Continuity): Varietas tanaman, buah, jenis wadah/pot pekarangan, tangan talent, dan pencahayaan matahari alami konsisten 100% dari Scene 1 sampai Scene 3.

============================================================
INFORMASI BRIEF PENGGUNA:
============================================================
[MAIN BRIEF]: ${brief}
[KATEGORI TERDETEKSI]: ${categoryHint}
[TARGET TOTAL DURASI]: ${targetDuration} detik (3 Scene @ 10 detik pas untuk Google Gemini Veo/Flow)
[GENDER SUARA]: ${voGender.toUpperCase()} (${voInstructionText})

============================================================
STRUKTUR OUTPUT JAWABAN ANDA (WAJIB IKUTI 5 BAGIAN INI):
============================================================

### 1. 🔍 PROFIL INVESTIGASI & HOOK TIKTOK VIRAL
- **Topik Produk:** [Nama Produk/Bibit/Benih sesuai brief pengguna]
- **Kategori:** [Buah / Bibit Tanaman / Benih Unggul / Perkebunan]
- **Hook Racun TikTok:** [Kalimat pembuka energik influencer yang langsung bikin stop scroll di 3 detik pertama]
- **3 Fakta Penjualan yang Dibongkar:**
  1. Fakta #1: [Keajaiban visual & daya tumbuh]
  2. Fakta #2: [Rasa legit/perakaran super/cepat panen di pot]
  3. Fakta #3: [Ciri bibit asli bergaransi & alasan wajib checkout sekarang]

---

### 2. 🎙️ PEMISAHAN VOICEOVER LENGKAP (GAYA INFLUENCER TIKTOK - MINIMAL 27 KATA & MAKSIMAL 30 KATA PER 10s)
#### A. Naskah Voiceover Bersih (Clean Script untuk Dubbing / TTS - Total 81–90 Kata)
> "[Tuliskan naskah VO utuh 30 detik bergaya influencer TikTok perkebunan, energik, ramah, persuasif, TOTAL 81-90 KATA dan tiap scene tepat 27–30 kata (anti-kepotong)]"

#### B. Breakdown Voiceover Per Detik & Intonasi (Tepat 27–30 Kata per Scene 10s)
| Detik | Scene & Fakta | Penggalan Naskah VO (Shoot Breakdown) | Intonasi Influencer TikTok |
| :--- | :--- | :--- | :--- |
| 00:00 – 00:03 | Scene 1 (Shot 1) | "[Hook racun: Guys kalian yang pekarangannya sempit wajib tahu rahasia ini! (9 kata)]" | Antusias, kaget, memikat |
| 00:03 – 00:07 | Scene 1 (Shot 2) | "[Spill keajaiban: Ini dia varietas unggul bibit buah yang berbuah lebat bergerombol luar biasa! (12 kata)]" | Semangat, takjub meyakinkan |
| 00:07 – 00:10 | Scene 1 (Shot 3) | "[Daya kecambah: Daya tumbuhnya gila banget mencapai sembilan puluh delapan persen! (9 kata)]" | Tegas, memukau audiens |
| 00:10 – 00:13 | Scene 2 (Shot 1) | "[Cross-section: Pas buahnya dibelah, lihat nih dagingnya super tebal dan berair manis! (11 kata)]" | Bikin ngiler, antusias |
| 00:13 – 00:17 | Scene 2 (Shot 2) | "[Test rasa & keunggulan: Teksturnya renyah tanpa serat, ditanam di pot kecil sekalipun langsung panen melimpah! (12 kata)]" | Meyakinkan, persuasif |
| 00:17 – 00:20 | Scene 2 (Shot 3) | "[Cocok pemula: Pemula sekalipun dijamin pasti berhasil panen tanpa ribet merawatnya! (8 kata)]" | Bersahabat, memotivasi |
| 00:20 – 00:23 | Scene 3 (Shot 1) | "[Peringatan tiruan: Tapi hati-hati ya, di luar sana banyak bibit tiruan palsu yang mandul! (11 kata)]" | Waspada, edukatif |
| 00:23 – 00:27 | Scene 3 (Shot 2) | "[Jaminan garansi: Pastikan kalian hanya order yang asli berlabel garansi resmi siap kirim! (10 kata)]" | Serius, kredibel |
| 00:27 – 00:30 | Scene 3 (Shot 3) | "[Hard CTA: Langsung klik keranjang kuning di pojok kiri bawah sekarang sebelum kehabisan! (11 kata)]" | Mendesak, aksi cepat |

---

### 3. 🎬 BREAKDOWN STORYBOARD (VISUAL ON THE SPOT + VO INFLUENCER TIKTOK)
Uraikan 3 scene container (masing-masing 10 detik, maksimal 3 sub-shoot) yang dioptimasi untuk prompt Google Gemini Veo / Flow:

- 🎬 **Scene 1 (0–10s): Fakta #1 - Hook Racun TikTok & Fenomena Keajaiban Visual** (Durasi: 10 Detik)
  • 🎥 **Sudut Kamera:** Extreme Macro 100mm to Slow Cinematic Push-In
  • 🖼️ **Visual Sinematik On The Spot:** [Deskripsi visual 4K ultra-realistis untuk Google Gemini Veo/Flow. Macro embun berkilau pada tanaman/benih/buah, pencahayaan alami pagi hari, kedalaman bidang tajam, tanpa teks atau gambar buatan]
  • 🎙️ **Voiceover (VO):** "[Naskah VO Scene 1 WAJIB MINIMAL 27 KATA & MAKSIMAL 30 KATA (rentang 27–30 kata anti-kepotong) ala influencer TikTok jualan]"
  • 🎙️ **Instruksi Voice Over:** ${voInstructionText}
  • 🚫 **Instruksi Video:** ${videoInstructionText}
  • ⚡ **Rincian Sub-Shoot (Maksimal 3 Shot):**
    - *Shot 1 (0–3s):* [Macro reveal benih/buah berembun pagi khas On The Spot] (VO: 8–9 kata)
    - *Shot 2 (3–7s):* [Slow push-in memperlihatkan tanaman sarat buah lebat di pekarangan rumah] (VO: 10–12 kata)
    - *Shot 3 (7–10s):* [Kamera fokus detail visual fisik tanaman yang memukau] (VO: 8–9 kata)

- 🎬 **Scene 2 (10–20s): Fakta #2 - Pembuktian Kualitas Ekstrem & Spill Panen Lebat** (Durasi: 10 Detik)
  • 🎥 **Sudut Kamera:** Macro Cross-Section to Slow Motion Reveal
  • 🖼️ **Visual Sinematik On The Spot:** [Deskripsi irisan pisau tajam membelah buah dengan tetesan jus manis berkilau ATAU perakaran bibit super putih tebal di media tanah gembur. Pencahayaan matahari golden hour pekarangan rumah, murni video tanpa teks]
  • 🎙️ **Voiceover (VO):** "[Naskah VO Scene 2 WAJIB MINIMAL 27 KATA & MAKSIMAL 30 KATA (rentang 27–30 kata anti-kepotong) ala influencer TikTok jualan]"
  • 🎙️ **Instruksi Voice Over:** ${voInstructionText}
  • 🚫 **Instruksi Video:** ${videoInstructionText}
  • ⚡ **Rincian Sub-Shoot (Maksimal 3 Shot):**
    - *Shot 1 (10–13s):* [Aksi pisau membelah buah juicy berkilau atau meneliti perakaran bibit tebal] (VO: 8–10 kata)
    - *Shot 2 (13–17s):* [Close-up tekstur daging buah lezat menggoda atau pohon berbuah lebat di pot] (VO: 10–11 kata)
    - *Shot 3 (17–20s):* [Tracking shot pembuktian hasil panen di pot teras rumah] (VO: 8–9 kata)

- 🎬 **Scene 3 (20–30s): Fakta #3 - Peringatan Waspada Tiruan & Hard CTA Keranjang Kuning** (Durasi: 10 Detik)
  • 🎥 **Sudut Kamera:** Ground-Level Polybag to Finger Pointer CTA
  • 🖼️ **Visual Sinematik On The Spot:** [Bibit asli dalam polybag sehat berakar kuat siap kirim berlabel resmi di teras kebun, lalu tangan dengan wajar menunjuk ke sudut kiri bawah layar TikTok. Pencahayaan natural pekarangan rumah, murni video tanpa teks]
  • 🎙️ **Voiceover (VO):** "[Naskah VO Scene 3 WAJIB MINIMAL 27 KATA & MAKSIMAL 30 KATA (rentang 27–30 kata anti-kepotong) peringatan bibit palsu & CTA keranjang kuning kiri bawah]"
  • 🎙️ **Instruksi Voice Over:** ${voInstructionText}
  • 🚫 **Instruksi Video:** ${videoInstructionText}
  • ⚡ **Rincian Sub-Shoot (Maksimal 3 Shot):**
    - *Shot 1 (20–23s):* [Tampilan polybag bibit/benih asli berdaun segar berlabel resmi siap kirim] (VO: 8–10 kata)
    - *Shot 2 (23–27s):* [Tangan memegang batang bibit berakar kuat membuktikan kualitas bibit asli] (VO: 9–10 kata)
    - *Shot 3 (27–30s):* [Gestur jari menunjuk ke arah sudut kiri bawah layar mengajak checkout keranjang kuning] (VO: 9–10 kata)

---

### 4. 📋 BLOK JSON STORYBOARD PROJECT
Sertakan blok JSON \`\`\`storyboard_project ... \`\`\` yang valid dengan 3 scene @ 10s (pas untuk 10 detik sekali render Veo/Flow Google Gemini):
\`\`\`storyboard_project
{
  "title": "On The Spot x TikTok: ${brief.replace(/["\n\r]/g, ' ').slice(0, 32)}",
  "productName": "<Nama Bibit / Buah / Benih Sesuai Brief>",
  "productDesc": "<Keunggulan Produk Sesuai Brief>",
  "preset": "onthespot",
  "duration": 30,
  "aspectRatio": "9:16",
  "formula": "on_the_spot_3x10s",
  "numScenes": 3,
  "scenes": [
    {
      "id": "scene-1",
      "sceneNumber": 1,
      "title": "Fakta #1 - Hook Racun TikTok & Keajaiban Visual",
      "durationSec": 10,
      "start": 0,
      "end": 10,
      "cameraAngle": "Extreme Macro 100mm to Cinematic Push-In",
      "visualDescription": "<Deskripsikan visual Scene 1 sesuai brief bergaya dokumenter investigasi On The Spot>",
      "voiceover": "<Naskah VO Scene 1 WAJIB MINIMAL 27 KATA & MAKSIMAL 30 KATA (rentang 27–30 kata anti-kepotong) ala influencer TikTok jualan>",
      "voInstruction": "${voInstructionText}",
      "videoInstruction": "${videoInstructionText}",
      "onScreenText": "",
      "imagePrompt": "<Photorealistic 4k shot of the product from brief, extreme macro lens, glistening morning dew drops, dramatic golden morning sunlight rays, ultra-detailed organic texture, national geographic documentary cinematography, shallow depth of field, 8k, pure photographic visual, no text, no logo, no watermark>",
      "videoPrompt": "<Cinematic slow motion push-in video of the product from brief, extreme macro botanical details, natural soft morning breeze, photorealistic Indonesian home garden backyard, pure footage, no text, no subtitles, no watermark, 4k ultra realistic Veo Flow video>",
      "shoots": [
        {
          "id": "scene-1-shoot-1",
          "start": 0,
          "end": 3,
          "visualDescription": "<Visual Shot 1 (0-3s) macro reveal benih/buah>",
          "action": "Kamera macro menyorot butiran embun di permukaan benih/buah",
          "cameraAngle": "Extreme Macro Close-Up",
          "voiceover": "<Penggalan VO Shot 1 hook influencer (8-10 kata)>"
        },
        {
          "id": "scene-1-shoot-2",
          "start": 3,
          "end": 7,
          "visualDescription": "<Visual Shot 2 (3-7s) slow push-in tanaman berbuah lebat di pekarangan>",
          "action": "Kamera bergerak maju pelan memperlihatkan pohon sarat buah",
          "cameraAngle": "Slow Push-In Medium",
          "voiceover": "<Penggalan VO Shot 2 spill keajaiban (11-13 kata)>"
        },
        {
          "id": "scene-1-shoot-3",
          "start": 7,
          "end": 10,
          "visualDescription": "<Visual Shot 3 (7-10s) detail keistimewaan tanaman>",
          "action": "Fokus pada keunikan fisik tanaman",
          "cameraAngle": "Close-Up Focus",
          "voiceover": "<Penggalan VO Shot 3 penekanan fakta (8-10 kata)>"
        }
      ]
    },
    {
      "id": "scene-2",
      "sceneNumber": 2,
      "title": "Fakta #2 - Pembuktian Kualitas Ekstrem & Spill Panen Lebat",
      "durationSec": 10,
      "start": 10,
      "end": 20,
      "cameraAngle": "Macro Cross-Section to Slow Reveal",
      "visualDescription": "<Deskripsikan visual Scene 2 (irisan buah juicy membelah atau perakaran bibit super lebat) sesuai brief>",
      "voiceover": "<Naskah VO Scene 2 WAJIB MINIMAL 27 KATA & MAKSIMAL 30 KATA (rentang 27–30 kata anti-kepotong) ala influencer TikTok jualan>",
      "voInstruction": "${voInstructionText}",
      "videoInstruction": "${videoInstructionText}",
      "onScreenText": "",
      "imagePrompt": "<Photorealistic 4k shot of sharp knife slicing through the ripe fruit cross section showing glistening juicy translucent sweet flesh dripping with droplets, dramatic natural sunlight, high detail botanical photography, pure visual, no text, no watermark, 8k>",
      "videoPrompt": "<Slow motion video of a knife cleanly slicing through the ripe fruit revealing succulent dripping sweet flesh in an authentic Indonesian garden, golden hour lighting, pure video footage, no text, no captions, no watermark, 4k Veo Flow quality>",
      "shoots": [
        {
          "id": "scene-2-shoot-1",
          "start": 10,
          "end": 13,
          "visualDescription": "<Visual Shot 1 (10-13s) pisau membelah buah atau meneliti akar>",
          "action": "Pisau membelah buah secara melintang",
          "cameraAngle": "Extreme Close-Up Cross Section",
          "voiceover": "<Penggalan VO Shot 1 (8-10 kata)>"
        },
        {
          "id": "scene-2-shoot-2",
          "start": 13,
          "end": 17,
          "visualDescription": "<Visual Shot 2 (13-17s) showcase daging buah berkilau lezat / akar kuat>",
          "action": "Cahaya memantul di permukaan daging buah yang berair",
          "cameraAngle": "Macro Texture Focus",
          "voiceover": "<Penggalan VO Shot 2 (11-13 kata)>"
        },
        {
          "id": "scene-2-shoot-3",
          "start": 17,
          "end": 20,
          "visualDescription": "<Visual Shot 3 (17-20s) pembuktian hasil lebat di lahan sempit>",
          "action": "Kamera tracking pohon berbuah lebat di pot teras",
          "cameraAngle": "Low Angle Tracking",
          "voiceover": "<Penggalan VO Shot 3 (8-10 kata)>"
        }
      ]
    },
    {
      "id": "scene-3",
      "sceneNumber": 3,
      "title": "Fakta #3 - Peringatan Waspada Tiruan & Hard CTA Keranjang Kuning",
      "durationSec": 10,
      "start": 20,
      "end": 30,
      "cameraAngle": "Ground-Level Medium to Pointer CTA",
      "visualDescription": "<Deskripsikan bibit asli siap kirim berakar sehat lalu tangan menunjuk ke sudut kiri bawah layar keranjang kuning>",
      "voiceover": "<Naskah VO Scene 3 WAJIB MINIMAL 27 KATA & MAKSIMAL 30 KATA (rentang 27–30 kata anti-kepotong) peringatan bibit tiruan & CTA keranjang kuning>",
      "voInstruction": "${voInstructionText}",
      "videoInstruction": "${videoInstructionText}",
      "onScreenText": "",
      "imagePrompt": "<Photorealistic 4k shot of authentic healthy grafted seedlings in black polybags with fresh green leaves ready for shipment in an Indonesian home garden, natural daylight, ordinary hands gesturing towards bottom left corner, pure visual, no text, no yellow shopping cart graphic, no watermark, 8k>",
      "videoPrompt": "<Handheld realistic video showing genuine healthy potted seedlings with a natural human hand pointing towards the bottom left corner in an Indonesian home garden backyard, natural sunlight, pure footage, no text, no subtitles, no watermark, 4k Veo Flow quality>",
      "shoots": [
        {
          "id": "scene-3-shoot-1",
          "start": 20,
          "end": 23,
          "visualDescription": "<Visual Shot 1 (20-23s) bibit asli berlabel garansi siap kirim>",
          "action": "Kamera menyorot kondisi bibit sehat siap kirim",
          "cameraAngle": "Medium Shot Polybag",
          "voiceover": "<Penggalan VO Shot 1 (6-7 kata)>"
        },
        {
          "id": "scene-3-shoot-2",
          "start": 23,
          "end": 27,
          "visualDescription": "<Visual Shot 2 (23-27s) batang okulasi sehat menyatu kokoh>",
          "action": "Tangan memegang batang bibit berakar kuat",
          "cameraAngle": "Close-Up Stem & Roots",
          "voiceover": "<Penggalan VO Shot 2 (8-10 kata)>"
        },
        {
          "id": "scene-3-shoot-3",
          "start": 27,
          "end": 30,
          "visualDescription": "<Visual Shot 3 (27-30s) gestur telunjuk mengarah ke kiri bawah keranjang kuning>",
          "action": "Jari menunjuk ke sudut kiri bawah layar TikTok",
          "cameraAngle": "Direct Action Close-Up",
          "voiceover": "<Penggalan VO Shot 3 (6-8 kata)>"
        }
      ]
    }
  ]
}
\`\`\`

---

### 5. 📱 TEMPLATE CAPTION TIKTOK INVESTIGASI VIRAL
\`\`\`text
[Misteri On The Spot]: Inilah rahasia di balik [Nama Produk/Bibit] yang bikin banyak orang takjub! 🔍🌱

Fakta yang berhasil kami ungkap:
1. 🌟 [Fakta keunikan 1: Kenikmatan/Daya tumbuh di luar nalar]
2. 🍯 [Fakta keunikan 2: Kemanisan/Hasil panen melimpah di pot sempit]
3. 📦 [Fakta keunikan 3: Waspada bibit palsu, pastikan hanya varietas asli bergaransi]

Keunggulan Budidaya:
• 🪴 Cocok ditanam di pot (tabulampot) & lahan pekarangan rumah
• ⚡ Cepat berbuah dan adaptif di segala cuaca
• 🛡️ Bibit hasil okulasi indukan super berakar mapan

Catatan:
Hasil dan waktu panen dapat bervariasi tergantung media tanam, intensitas sinar matahari, dan penyiraman.

Komen "[KATA_KUNCI]" untuk link bibit asli bergaransi! 👇
Simpan video ini biar nggak kena tipu bibit abal-abal! 📌
Share ke pecinta tanaman & buah lainnya! 🌿

#[TagProduk] #OnTheSpot #BibitUnggul #Tabulampot #KebunRumah #BuahViral
\`\`\``;
  }

  // Special Handler for Custom Storyboard Pure Main Brief (/customstoryboard)
  if (presetKey === 'customstoryboard') {
    const brief = userBrief || 'Rancang storyboard video terstruktur yang siap pakai sesuai arahan naskah dan konsep produk.';
    const durationMatch = userBrief.match(/(\d+)\s*(?:detik|s|sec|second)/i);
    const targetDuration = durationMatch ? Math.min(120, Math.max(3, parseInt(durationMatch[1], 10))) : 15;

    return `[STORYBOARD DIRECTOR / JSON COMPILER: /CUSTOMSTORYBOARD - PURE MAIN BRIEF (ZERO AI INJECTION)]
Anda adalah Storyboard Compiler & Video JSON Architect.

============================================================
HUKUM TERTINGGI: ZERO AI INJECTION (IKUTI 100% MAIN BRIEF PENGGUNA)
============================================================
1. DILARANG MENYUNTIKKAN FORMULA ATAU GAYA VISUAL TERTENTU KECUALI DIMINTA:
   - JANGAN menyuntikkan kamera khusus (seperti Hasselblad, Sony Alpha, DSLR) kecuali jika pengguna sendiri yang menuliskannya di brief.
   - JANGAN menyuntikkan gaya talent (seperti tangan wanita, faceless, UGC, model studio) kecuali jika diminta di brief.
   - JANGAN mengubah tone of voice, pesan, atau alur cerita yang sudah dirancang pengguna.
2. FOKUS UTAMA ANDA ADALAH COMPILER & FORMATTER:
   - Tugas Anda adalah mengambil Main Brief / Naskah dari pengguna, lalu memetakan dan menyusunnya menjadi breakdown scene adegan yang rapi dan terstruktur.
   - Jika pengguna sudah menuliskan daftar adegan (Scene 1, Scene 2, dst.), pertahankan pembagian adegan tersebut secara presisi.
   - Jika pengguna menuliskan naskah/alur umum, bagi menjadi scene-scene yang proporsional dan mengalir natural.
3. ATURAN FIELD PADA SETIAP SCENE:
   - "visualDescription": Deskripsi aksi visual yang setia 100% pada Main Brief pengguna.
   - "voiceover": Naskah narasi / voiceover dari brief pengguna (WAJIB MINIMAL 27 KATA & MAKSIMAL 30 KATA per scene, rentang wajib 27–30 kata anti-terpotong. DILARANG membuat naskah di bawah 27 kata atau di atas 30 kata!). Jika video tidak membutuhkan narasi/VO, isi dengan string kosong "".
   - "onScreenText": Teks layar jika disebutkan di brief pengguna. Jika tidak ada / pengguna tidak meminta teks, WAJIB diisi string kosong "".
   - "cameraAngle": Sudut pandang / framing kamera yang selaras dengan aksi visual (misal: Close-Up, Wide Shot, Medium Shot).
   - "imagePrompt": Prompt gambar visual detail untuk adegan tersebut agar langsung siap dirender di Weavy AI Studio.
   - "videoPrompt": Prompt gerak video AI untuk adegan tersebut.

[MAIN BRIEF PENGGUNA]:
${brief}

============================================================
STRUKTUR OUTPUT JAWABAN ANDA:
============================================================
1. Ringkasan Naskah & Konsep Visual (sesuai brief pengguna):
   - Judul / Konsep
   - Total Durasi: ${targetDuration} detik
   - Rincian Adegan per Scene (Aksi Visual, Voiceover, On-Screen Text, Angle Kamera)

2. BLOK JSON STORYBOARD PROJECT (MUTLAK WAJIB):
Di bagian paling akhir respon, Anda WAJIB menyertakan blok kode JSON lengkap dengan tag:
\`\`\`storyboard_project
{
  "title": "${brief.replace(/["\n\r]/g, ' ').slice(0, 35)}",
  "productName": "<Nama Produk/Topik dari Brief>",
  "productDesc": "<Deskripsi/Pesan Utama dari Brief>",
  "preset": "customstoryboard",
  "duration": ${targetDuration},
  "aspectRatio": "9:16",
  "formula": "custom_main_brief",
  "numScenes": <jumlah scene yang dirancang>,
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "<Judul Scene 1>",
      "visualDescription": "<Deskripsi aksi visual sesuai brief>",
      "voiceover": "<Naskah VO / narasi>",
      "onScreenText": "<Teks layar jika ada, atau \"\">",
      "cameraAngle": "<Angle kamera>",
      "durationSec": <durasi detik>,
      "imagePrompt": "<Prompt gambar fotorealistik/gaya visual scene sesuai brief>",
      "videoPrompt": "<Prompt video AI scene>"
    }
  ]
}
\`\`\`
(Catatan Mutlak Sistem: Blok JSON \`\`\`storyboard_project ... \`\`\` ini mutlak diperlukan agar UI secara otomatis merender kartu interaktif Storyboard dan tombol "🎬 Kirim ke Storyboard" yang siap diterapkan ke Weavy AI).`;
  }

  // Special Handler for Faceless Garden UGC (/facelessgardenugc)
  if (presetKey === 'facelessgardenugc') {
    const brief = userBrief || 'Produk benih/tanaman/kebun pekarangan rumah organik dalam polybag hitam.';
    const durationMatch = userBrief.match(/(\d+)\s*(?:detik|s|sec|second)/i);
    const targetDuration = durationMatch ? Math.min(60, Math.max(5, parseInt(durationMatch[1], 10))) : 20;
    const scene1Dur = Math.round(targetDuration / 2);
    const scene2Dur = targetDuration - scene1Dur;

    return `[STORYBOARD DIRECTOR PRESET: /FACELESSGARDENUGC - FACELESS GARDEN UGC (HIERARCHY: BAGIAN ➔ SCENE ➔ SHOOT)]
PRESET NAME:
Faceless Garden UGC

SLASH COMMAND:
/facelessgardenugc

CORE PURPOSE:
Membuat storyboard video komersial vertikal untuk produk pertanian, benih, bibit, tanaman, pupuk, alat berkebun, dan produk urban farming pekarangan rumah Indonesia. Gaya visual terasa seperti dokumentasi kebun rumahan autentik, natural, dan soft-selling tanpa wajah (hands-only).

============================================================
PRINSIP UTAMA STRUKTUR & HIERARKI WAJIB (JANGAN DILANGGAR):
============================================================
Scene adalah unit scene & unit rendering. Shoot adalah sub-shot di dalam Scene.
JANGAN PERNAH menganggap setiap Shoot sebagai Scene terpisah!
VIDEO (20s)
├── BAGIAN 1
│   └── SCENE 1 (${scene1Dur} detik)
│       ├── Shoot 1 (0–3s)
│       ├── Shoot 2 (3–6s)
│       └── Shoot 3 (6–${scene1Dur}s)
└── BAGIAN 2
    └── SCENE 2 (${scene2Dur} detik)
        ├── Shoot 1 (${scene1Dur}–${scene1Dur + 3}s)
        ├── Shoot 2 (${scene1Dur + 3}–${scene1Dur + 6}s)
        └── Shoot 3 (${scene1Dur + 6}–${targetDuration}s)

============================================================
ATURAN KAMERA POV / HANDHELD (MUTLAK):
============================================================
- Kamera harus terlihat seolah-olah dipegang oleh tangan operator wanita dewasa lain yang berada di LUAR FRAME (First-person POV handheld, natural micro movement).
- Tangan operator yang memegang kamera TIDAK BOLEH TERLIHAT.
- Action talent: hanya 1 atau 2 tangan talent wanita yang masuk frame saat melakukan aksi.
- DILARANG membuat third hand / extra arm / tangan melayang / tripod look.

============================================================
ATURAN TALENT (FACELESS & HANDS-ONLY):
============================================================
- Dilarang menampilkan: wajah, kepala, mata, hidung, mulut, rambut, full body, torso, kaki, siluet manusia, dan pantulan/bayangan manusia.
- Hanya tangan wanita dewasa lembut (soft delicate feminine hands, zero bulging veins) yang boleh terlihat saat berinteraksi dengan tanaman/produk.

============================================================
ATURAN KERANJANG KUNING (VO-ONLY RULE — MUTLAK):
============================================================
- Frasa "keranjang kuning" / "klik keranjang kuning di bawah" adalah AUDIO/VOICEOVER ONLY!
- DILARANG KERAS memvisualisasikan keranjang kuning sebagai objek fisik:
  ❌ TIDAK BOLEH ada keranjang belanja warna kuning.
  ❌ TIDAK BOLEH ada shopping cart icon / tombol kuning / sticker / prop / UI overlay.
  ❌ TIDAK BOLEH tangan menunjuk keranjang kuning.
- Pada visual layer: Tetap tampilkan tanaman, produk, polybag, pekarangan kebun, atau tangan yang merawat tanaman secara natural!

============================================================
NEGATIVE VISUAL CONSTRAINTS:
============================================================
no face, no head, no full body, no human silhouette, no human reflection, no extra hands, no third hand, no extra arms, no floating camera, no tripod-looking camera, no studio setup, no CGI look, no overly perfect garden, no artificial-looking environment, no product identity change, no yellow shopping cart, no shopping cart icon, no yellow CTA object, no UI overlay for "keranjang kuning", no hard pot (if polybag is chosen), no sliced fruit (unless requested), no text overlays.

============================================================
ATURAN JUMLAH KATA VOICEOVER PER SCENE:
============================================================
- Di setiap Scene (10 detik), naskah voiceover WAJIB MINIMAL 27 KATA & MAKSIMAL 30 KATA (rentang wajib 27–30 kata per scene)!
- DILARANG membuat naskah di bawah 27 kata (kependekan) dan DILARANG di atas 30 kata (agar tidak terpotong saat render 10 detik)!

============================================================
OVERRIDE RULE:
============================================================
Instruksi terbaru pengguna selalu mengalahkan default preset (misal: jika minta pot tanah liat, ganti polybag; jika minta durasi lain, sesuaikan).

[MAIN BRIEF PENGGUNA]:
${brief}

============================================================
STRUKTUR OUTPUT JAWABAN ANDA:
============================================================
Tuliskan naskah terstruktur sesuai hierarki Bagian ➔ Scene ➔ Shoot:

### BAGIAN 1 — SCENE 1 (0–${scene1Dur}s)
* **Shoot 1 (0–3s):**
  • **Visual:** [POV handheld, suasana kebun pekarangan rumah alami, tangan wanita memperkenalkan tanaman/benih di polybag hitam]
  • **Aksi:** [Aksi natural tangan]
  • **Kamera:** POV Close-up Handheld
  • **Voiceover:** "[Naskah VO wanita natural ramah]"
* **Shoot 2 (3–6s):**
  • **Visual:** [Lanjutan aksi Shoot 1, pertahankan lokasi & pencahayaan matahari alami]
  • **Aksi:** [Aksi memeriksa daun/tunas]
  • **Kamera:** POV Handheld Tracking
  • **Voiceover:** "[Naskah VO penjelasan keunggulan/kemudahan]"
* **Shoot 3 (6–${scene1Dur}s):**
  • **Visual:** [Selesaikan aksi Scene 1, siapkan continuity ke Scene 2]
  • **Aksi:** [Aksi sentuhan lembut pada tanaman]
  • **Kamera:** POV Handheld Medium Close-up
  • **Voiceover:** "[Naskah VO closing Scene 1]"
* **Prompt Gambar Scene 1 (Container Unit):**
  \`\`\`text
  Shot on Sony Alpha A7 IV, 35mm lens. Realistic Indonesian home garden POV handheld shot, soft delicate feminine hands gently tending lush green plant in black polybag, authentic backyard garden with natural soil and wooden fence, diffused warm sunlight, clean photography, pure visual only, no text, no title, no yellow shopping cart, no watermark, 8k.
  \`\`\`

---

### BAGIAN 2 — SCENE 2 (${scene1Dur}–${targetDuration}s)
* **Shoot 1 (${scene1Dur}–${scene1Dur + 3}s):**
  • **Visual:** [Melanjutkan continuity Scene 1, kamera POV handheld menyorot tanaman/buah subur]
  • **Aksi:** [Tangan wanita merawat/menunjukkan hasil]
  • **Kamera:** POV Handheld Close-up
  • **Voiceover:** "[Naskah VO testimoni/hasil nyata]"
* **Shoot 2 (${scene1Dur + 3}–${scene1Dur + 6}s):**
  • **Visual:** [Tanaman rimbun/buah segar alami di polybag]
  • **Aksi:** [Tangan memperlihatkan kesuburan tanaman]
  • **Kamera:** POV Handheld
  • **Voiceover:** "[Naskah VO rekomendasi ramah]"
* **Shoot 3 (${scene1Dur + 6}–${targetDuration}s):**
  • **Visual:** [Hero shot tanaman pekarangan & tangan wanita tanpa objek keranjang kuning]
  • **Aksi:** [Tangan menunjukkan tanaman secara natural]
  • **Kamera:** POV Handheld Hero View
  • **Voiceover:** "[Naskah VO ajakan soft-selling, misal: 'Kalau kamu mau coba juga, klik keranjang kuning di bawah ya!']"
* **Prompt Gambar Scene 2 (Container Unit):**
  \`\`\`text
  Shot on Sony Alpha A7 IV, 50mm lens. Realistic Indonesian home garden POV handheld shot, soft delicate feminine hands holding thriving potted plant in black polybag, authentic sunny backyard, clean photography, pure visual only, no text, no title, no yellow shopping cart, no watermark, 8k.
  \`\`\`

---

### BLOK JSON STORYBOARD PROJECT
Di akhir, Anda WAJIB menyertakan blok JSON \`\`\`storyboard_project ... \`\`\` lengkap (2 Scene sebagai unit container, dengan 3 Shoot di setiap Scene):
\`\`\`storyboard_project
{
  "title": "Garden UGC: ${brief.replace(/["\n\r]/g, ' ').slice(0, 35)}",
  "productName": "<Nama Tanaman/Benih/Produk>",
  "productDesc": "<Deskripsi Nilai Jual Singkat>",
  "preset": "facelessgardenugc",
  "duration": ${targetDuration},
  "aspectRatio": "9:16",
  "visualStyle": "Faceless Hands-Only Garden UGC",
  "voiceoverStyle": "Natural Persuasive Female Narration",
  "formula": "faceless_garden_ugc",
  "numScenes": 2,
  "parts": [
    {
      "id": "part-1",
      "title": "BAGIAN 1",
      "scenes": ["scene-1"]
    },
    {
      "id": "part-2",
      "title": "BAGIAN 2",
      "scenes": ["scene-2"]
    }
  ],
  "scenes": [
    {
      "id": "scene-1",
      "sceneNumber": 1,
      "title": "Scene 1: Pekarangan & Perawatan Benih",
      "durationSec": ${scene1Dur},
      "start": 0,
      "end": ${scene1Dur},
      "cameraAngle": "POV Handheld Close-up",
      "visualDescription": "POV handheld tangan wanita merawat tanaman di polybag hitam kebun pekarangan rumah.",
      "voiceover": "<Naskah VO Scene 1>",
      "onScreenText": "",
      "imagePrompt": "Shot on Sony Alpha A7 IV, 35mm lens. Realistic Indonesian home garden POV handheld shot, soft delicate feminine hands gently tending lush plant in black polybag, clean photography, pure visual only, no text, no title, no yellow shopping cart, no watermark, 8k.",
      "videoPrompt": "POV handheld camera with natural micro movement, female hands gently tending plant in backyard garden, 4k.",
      "shoots": [
        {
          "id": "scene-1-shoot-1",
          "start": 0,
          "end": 3,
          "visualDescription": "POV handheld suasana kebun rumah, tangan wanita memperkenalkan tanaman di polybag hitam.",
          "action": "Tangan menyentuh tanah polybag",
          "cameraAngle": "POV Close-up Handheld",
          "voiceover": "Ternyata nanem di pekarangan rumah segampang ini lho,",
          "continuity": "Pekarangan alami, polybag hitam"
        },
        {
          "id": "scene-1-shoot-2",
          "start": 3,
          "end": 6,
          "visualDescription": "Tangan memeriksa daun hijau subur dan tunas yang tumbuh lebat.",
          "action": "Tangan memeriksa daun",
          "cameraAngle": "POV Handheld Tracking",
          "voiceover": "bibitnya cepet banget tumbuh dan perawatannya simpel banget.",
          "continuity": "Tanaman dan pencahayaan konsisten"
        },
        {
          "id": "scene-1-shoot-3",
          "start": 6,
          "end": ${scene1Dur},
          "visualDescription": "Tangan merapikan posisi polybag dengan latar kebun rumah yang asri.",
          "action": "Tangan merapikan polybag",
          "cameraAngle": "POV Handheld Medium",
          "voiceover": "Cocok banget buat yang mau mulai berkebun sendiri.",
          "continuity": "Konsistensi kebun dan wadah"
        }
      ]
    },
    {
      "id": "scene-2",
      "sceneNumber": 2,
      "title": "Scene 2: Hasil Subur & Rekomendasi",
      "durationSec": ${scene2Dur},
      "start": ${scene1Dur},
      "end": ${targetDuration},
      "cameraAngle": "POV Handheld Medium Close-up",
      "visualDescription": "POV handheld tanaman tumbuh subur di pekarangan, tangan wanita menunjukkan hasil tanaman tanpa objek keranjang fisik.",
      "voiceover": "<Naskah VO Scene 2 dengan CTA ramah>",
      "onScreenText": "",
      "imagePrompt": "Shot on Sony Alpha A7 IV, 50mm lens. Realistic Indonesian home garden POV handheld shot, soft delicate feminine hands holding thriving plant in black polybag, authentic sunny backyard, clean photography, pure visual only, no text, no title, no yellow shopping cart, no watermark, 8k.",
      "videoPrompt": "POV handheld camera showing thriving plant in home garden, female hands holding polybag, 4k.",
      "shoots": [
        {
          "id": "scene-2-shoot-1",
          "start": ${scene1Dur},
          "end": ${scene1Dur + 3},
          "visualDescription": "Melanjutkan Scene 1, tangan wanita memperlihatkan daun dan bakal buah yang subur.",
          "action": "Tangan menunjukkan daun rimbun",
          "cameraAngle": "POV Handheld Close-up",
          "voiceover": "Hasilnya bener-bener subur dan pekarangan rumah jadi adem.",
          "continuity": "Tanaman dan lokasi yang sama persis dengan Scene 1"
        },
        {
          "id": "scene-2-shoot-2",
          "start": ${scene1Dur + 3},
          "end": ${scene1Dur + 6},
          "visualDescription": "Close-up tanaman segar berembun pagi di pekarangan rumah.",
          "action": "Tangan memegang tepi polybag",
          "cameraAngle": "POV Handheld",
          "voiceover": "Gak butuh lahan luas, cukup di pekarangan aja udah bisa panen.",
          "continuity": "Konsistensi pencahayaan alami"
        },
        {
          "id": "scene-2-shoot-3",
          "start": ${scene1Dur + 6},
          "end": ${targetDuration},
          "visualDescription": "Hero view tanaman subur di pekarangan rumah. Tangan menopang tanaman secara natural (tanpa visual keranjang kuning).",
          "action": "Hero presentation tangan dan tanaman",
          "cameraAngle": "POV Handheld Hero View",
          "voiceover": "Yuk mulai hijaukan pekarangan rumahmu, klik keranjang kuning di bawah untuk bibit aslinya ya!",
          "continuity": "Tanaman dan tangan konsisten hingga akhir"
        }
      ]
    }
  ]
}
\`\`\`
(Catatan Mutlak Sistem: onScreenText WAJIB "" kosong, dan frasa keranjang kuning di VO TIDAK BOLEH menjadi objek visual di deskripsi atau prompt gambar).`;
  }

  // Special Handler for POV Harvest & Taste (/harvestpov) - DYNAMIC ADAPTIVE POV & ASMR
  if (presetKey === 'harvestpov') {
    const brief = userBrief || 'Buah segar (misal melon kuning, tomat cherry mini, pepaya merah delima, mangga, stroberi) di pekarangan kebun/halaman rumah.';
    const durationMatch = userBrief.match(/(\d+)\s*(?:detik|s|sec|second)/i);
    const targetDuration = durationMatch ? Math.min(60, Math.max(5, parseInt(durationMatch[1], 10))) : 15;

    return `[STORYBOARD COPILOT DIRECTOR MODE: /HARVESTPOV - DYNAMIC ADAPTIVE ASMR CONTINUOUS POV]
Anda adalah Video AI Prompt Engineer & Creative Director kelas dunia spesialis konten video POV sensori agrikultur, pekarangan kebun, proses bertani/menanam, panen segar, dan ASMR murni (Tanpa Wajah / First-Person Hands-Only).

============================================================
HUKUM TERTINGGI: IKUTI MAIN BRIEF PENGGUNA SECARA TOTAL!
============================================================
[BRIEF PENGGUNA]:
${brief}

ATURAN ADAPTASI KREATIF (JANGAN FLAT / JANGAN MONOTON):
1. MAIN BRIEF PENGGUNA ADALAH PRIORITAS #1:
   - Analisis apa yang diminta pengguna di brief! Rancang alur cerita, aksi tangan, dan transisi visual secara kreatif dan fleksibel mengikuti instruksi pengguna tersebut.
   - JANGAN MEMBATASI ATAU MEMAKSAKAN alur flat "petik-potong-gigit" jika pengguna meminta alur lain!
   - Contoh variasi yang HARUS Anda dukung sesuai brief:
     * Jika brief meminta proses dari benih/menanam: Rancang alur POV tangan menanam benih di tanah gembur/pot ➔ timelapse tunas tumbuh & berdaun lebat ➔ muncul bunga & berbuah lebat berembun ➔ tangan memetik hasil panen segar.
     * Jika brief meminta pengolahan/sensory: Rancang aksi cuci buah di pancuran air bambu/keran kebun ➔ diperas/squeeze test hingga air sarinya menetes berkilau ➔ diiris tipis estetik ➔ dicelup madu/es batu ➔ diulek di cobek batu, dll.
     * Jika brief hanya menyebutkan buah/tanaman secara umum: Rancang alur panen sensory yang sangat dinamis, hidup, dan menggugah selera sesuai karakteristik buah tersebut.
2. JUMLAH SCENE & DURASI FLEKSIBEL:
   - Durasi total: ${targetDuration} detik.
   - Jumlah adegan (scene) bebas disesuaikan dengan alur cerita brief pengguna (bisa 3 scene, 4 scene, atau 5 scene agar cerita tersampaikan secara utuh dan tidak terburu-buru).
   - Durasi per scene proporsional dan totalnya tepat ${targetDuration} detik.

============================================================
PANTANGAN MUTLAK & GAYA VISUAL (WAJIB DIPATUHI):
============================================================
1. DILARANG KERAS MEMBUAT VOICEOVER / SUARA NARASI ORANG BERBICARA:
   - Ini BUKAN video iklan ceramah/sales! Ini adalah video ASMR visual murni & ambient suara alam (desau angin kebun, gemericik air, gesekan tanah gembur, suara 'krek' tangkai dipetik, pisau membelah renyah, tetesan air buah, gigitan segar).
   - "voiceover" WAJIB KOSONG "" (string kosong tanpa kata-kata). JANGAN buat naskah narasi!
2. DILARANG KERAS MEMBUAT TEKS DI LAYAR (ON-SCREEN TEXT):
   - "onScreenText" WAJIB KOSONG "" (string kosong). TIDAK BOLEH ADA tulisan di layar, subtitle, promo, diskon, atau slogan. Murni estetika visual alami.
3. ZERO-FACE / HANDS-ONLY POV:
   - Sudut pandang kamera 100% First-Person POV (hanya tangan yang berinteraksi dengan tanaman/buah/alat). Jangan pernah ada wajah atau tubuh model.
4. JANGAN MEMBAHAS HARGA / JUALAN TOKO:
   - Meskipun brief berasal dari tautan e-commerce benih, fokuskan visual 100% pada visualisasi subur tanaman, pengalaman menanam, atau kepuasan panen segar.

============================================================
STRUKTUR OUTPUT JAWABAN ANDA HARUS SEPERTI INI:
============================================================

Buka dengan pengantar singkat mengonfirmasi konsep kreatif sesuai brief pengguna:

### OPSI 1: Single Continuous Shot Prompt (Satu Prompt Utuh ${targetDuration} Detik)
*Cocok langsung dimasukkan ke generator video AI seperti Sora, Kling, Runway Gen-3, Hailuo/Minimax, atau Weavy Video.*

#### Versi Bahasa Inggris (Rekomendasi untuk hasil visual AI paling maksimal):
\`\`\`text
<Tuliskan 1 paragraf panjang prompt video continuous ${targetDuration}s bahasa Inggris yang sangat deskriptif, sinematik, gerakan kamera POV hands-only mengalir sesuai tahapan cerita brief pengguna, natural warm sunlight, 4K, smooth fluid motion, organic ASMR vibe>
\`\`\`

#### Versi Bahasa Indonesia:
\`\`\`text
<Tuliskan prompt continuous ${targetDuration}s versi Bahasa Indonesia yang kaya detail visual sesuai alur cerita pengguna>
\`\`\`

---

### OPSI 2: Breakdown Storyboard (Timeline ${targetDuration} Detik)
*Rincian breakdown per adegan yang dinamis dan hidup sesuai alur brief pengguna:*

(Tuliskan breakdown setiap Scene:
#### 🎬 Scene X (00:XX - 00:XX) — [Nama Adegan Sesuai Aksi]
* **Kamera:** [Sudut pandang POV kamera, gerakan kamera]
* **Visual:** [Deskripsi visual detail aksi tangan POV dan lingkungan kebun]
* **Prompt Video:** [Prompt video motion aksi tangan dan kamera dalam Bahasa Inggris, 4k]
* **Prompt Gambar:** [Prompt gambar 9:16 fotorealistik 8K diakhiri dengan: , clean photography, pure visual only, no text, no title, no typography, no banner, no words, no watermark, no overlays, no graphic stickers, 8k.])

---

### Tips Penggunaan di Generator Video AI:
1. **Ratio:** 9:16 untuk Shorts/Reels/TikTok, atau 16:9 untuk YouTube landscape.
2. **Motion:** Gunakan motion medium-smooth (speed 4-5) agar alur continuous tidak patah.
3. **Audio:** Pasangkan dengan efek audio ASMR alam sesuai adegan (desau angin, siraman air, potong tangkai, dll).

---

### BLOK JSON STORYBOARD PROJECT
Di bagian paling akhir, Anda WAJIB menyertakan blok kode JSON lengkap dengan tag:
\`\`\`storyboard_project
{
  "title": "Panen Kebun: ${brief.replace(/["\n\r]/g, ' ').slice(0, 35)}",
  "productName": "<Nama Tanaman/Buah/Konsep>",
  "productDesc": "<Deskripsi Alur Sesuai Brief>",
  "duration": ${targetDuration},
  "aspectRatio": "9:16",
  "formula": "harvest_pov_taste",
  "numScenes": <jumlah scene yang dirancang>,
  "scenes": [
    <Array scene dengan struktur:
    {
      "sceneNumber": 1,
      "title": "<Judul Scene Sesuai Aksi>",
      "visualDescription": "<Deskripsi visual hands-only>",
      "voiceover": "",
      "onScreenText": "",
      "cameraAngle": "<Angle kamera POV>",
      "videoPrompt": "<Prompt video scene>",
      "imagePrompt": "<Prompt gambar scene diakhiri clean photography, pure visual only, no text, no title, no typography, no banner, no words, no watermark, no overlays, no graphic stickers, 8k.>",
      "durationSec": <durasi detik>
    }>
  ]
}
\`\`\`
(Catatan Mutlak Sistem: voiceover dan onScreenText WAJIB berupa string kosong "" agar kartu storyboard murni visual ASMR dan tombol '🎬 Kirim ke Storyboard' memuat naskah visual murni tanpa VO/teks).`;
  }

  // Special Handler for Storyboard Copilot Preset (/copilotstoryboard)
  if (presetKey === 'copilotstoryboard' || presetKey === 'storyboardcopilot') {
    const brief = userBrief || 'Silakan analisis aset terlampir terlebih dahulu, lalu rancang konsep storyboard iklan produk berkonversi tinggi selaras dengan target audiens.';
    return `[STORYBOARD COPILOT DIRECTOR MODE: /COPILOTSTORYBOARD]
Anda adalah Storyboard Director & Creative Video Producer kelas dunia untuk konten video iklan TikTok, Reels, dan Shorts.

Instruksi ini AKTIF dan WAJIB dipatuhi oleh seluruh provider (Google Gemini, Dola AI, Weavy AI):

1. ANALISIS WAJIB MEDIA / LINK TERLAMPIR:
- Jika terdapat gambar terlampir (seperti @img1, @img2, upload foto produk) atau link referensi (Shopee, Tokopedia, TikTok, YouTube, dsb.), Anda WAJIB menganalisis aset tersebut terlebih dahulu di awal respon.
- Paparkan secara ringkas dan tajam:
  * Nama & Karakteristik Produk (fitur utama, warna/tekstur, USP).
  * Pain point atau masalah audiens yang diselesaikan.
  * Daya tarik visual (visual selling point) yang harus ditonjolkan dalam video.

2. IKUTI MAIN BRIEF SECARA KETAT:
- Di bawah ini adalah "Main Brief" dari pengguna yang WAJIB Anda jadikan kompas dan panduan utama perancangan video:
----------------------------------------
[MAIN BRIEF PENGGUNA]:
${brief}
----------------------------------------
- Sesuaikan seluruh hook pembuka, tone of voice, alur cerita, pacing, naskah dialog/voiceover, dan target buyer agar 100% selaras dengan Main Brief di atas.
- PANDUAN TEKS LAYAR (onScreenText) & PROMPT GAMBAR: Jika pengguna menginstruksikan "tanpa teks di layar", "tidak boleh ada text", "jangan ada teks layar", atau "no text", Anda WAJIB mengosongkan nilai "onScreenText": "" (string kosong) pada seluruh adegan/scene. Selain itu, parameter "imagePrompt" pada tiap scene WAJIB diakhiri dengan klausa pelarangan teks: ", clean photography, pure visual only, no text, no title, no typography, no banner, no words, no watermark, no overlays, no graphic stickers", serta JANGAN memasukkan slogan atau tanda seru (!) ke dalam prompt gambar agar AI tidak menggambar banner tipografi 3D.

3. STRUKTUR ADEGAN VIDEO (SCENE BREAKDOWN):
- Susun adegan video secara terstruktur dan bernilai konversi tinggi (Formula TikTok Native):
  * Scene 1: Hook Ekstrem 0-3 Detik (visual shock, pertanyaan retoris, atau problem relatable).
  * Scene 2: Problem & Agitasi / Transisi Solusi.
  * Scene 3: Product Proof & Fitur Unggulan (demonstrasi nyata, tekstur, hasil).
  * Scene 4: Call to Action (CTA) yang tegas & mendesak.
- ATURAN MUTLAK VOICEOVER PER SCENE: Naskah voiceover pada setiap scene WAJIB MINIMAL 27 KATA & MAKSIMAL 30 KATA (rentang wajib 27–30 kata per scene). DILARANG membuat naskah di bawah 27 kata (kependekan) dan DILARANG di atas 30 kata (agar tidak terpotong saat render 10 detik)!

4. OUTPUT WAJIB: BLOK JSON STORYBOARD PROJECT
Di bagian akhir respon Anda, Anda WAJIB menyertakan blok kode JSON lengkap dengan tag:
\`\`\`storyboard_project
{
  "title": "<Judul Storyboard sesuai Main Brief>",
  "productName": "<Nama Produk yang Dianalisis>",
  "productDesc": "<Deskripsi USP & Value Proposition Singkat>",
  "duration": 15,
  "aspectRatio": "9:16",
  "formula": "hook_extreme_tiktok",
  "numScenes": 4,
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "<Judul Scene 1 - Hook Opening>",
      "visualDescription": "<Deskripsi aksi visual detail, angle kamera, talent/objek>",
      "voiceover": "<Naskah suara narasi/VO Bahasa Indonesia natural dan memikat>",
      "onScreenText": "<Teks hook mencolok di layar, ATAU string kosong \"\" jika diminta tanpa teks>",
      "cameraAngle": "Extreme Close-Up / Low Angle Shot",
      "durationSec": 3
    },
    {
      "sceneNumber": 2,
      "title": "<Judul Scene 2 - Problem/Transisi>",
      "visualDescription": "<Deskripsi visual>",
      "voiceover": "<Naskah VO>",
      "onScreenText": "<Teks layar, ATAU string kosong \"\" jika diminta tanpa teks>",
      "cameraAngle": "Medium Tracking Shot",
      "durationSec": 4
    },
    {
      "sceneNumber": 3,
      "title": "<Judul Scene 3 - Product Proof / Demo>",
      "visualDescription": "<Deskripsi visual demonstrasi produk>",
      "voiceover": "<Naskah VO penjelasan manfaat>",
      "onScreenText": "<Teks layar, ATAU string kosong \"\" jika diminta tanpa teks>",
      "cameraAngle": "Macro Close-Up / High Angle",
      "durationSec": 5
    },
    {
      "sceneNumber": 4,
      "title": "<Judul Scene 4 - CTA / Offer>",
      "visualDescription": "<Tampilan produk hero shot, keranjang kuning / link di bio>",
      "voiceover": "<Naskah VO ajakan bertindak kuat>",
      "onScreenText": "<Teks CTA Promo Terbatas, ATAU string kosong \"\" jika diminta tanpa teks>",
      "cameraAngle": "Front Centered Hero Lock",
      "durationSec": 3
    }
  ]
}
\`\`\`
(Catatan Kritis Sistem: Format JSON yang valid dan lengkap ini mutlak diperlukan agar UI secara otomatis merender kartu interaktif '🎬 STORYBOARD COPILOT' dan memunculkan tombol '🎬 Kirim ke Storyboard' yang siap diterapkan ke editor Weavy). Jawab dengan Bahasa Indonesia yang persuasif dan profesional.`;
  }

  const preset = PRESET_INSTRUCTIONS[presetKey] || PRESET_INSTRUCTIONS.video;
  const brief = userBrief || 'Gunakan konteks gambar/video dan percakapan saat ini sebagai referensi utama.';
  const defaultDuration = preset.duration || 15;

  const jsonTemplate = `\`\`\`json
{
  "type": "video_prompt",
  "duration": ${defaultDuration},
  "aspect_ratio": "9:16",
  "prompt": "<TULISKAN_PROMPT_VIDEO_FINAL_LENGKAP_DI_SINI>"
}
\`\`\``;

  return `[AI DIRECTOR PRESET: /${presetKey.toUpperCase()} - ${preset.name}]
Arahan Khusus Gaya:
${preset.desc}

Brief / Kebutuhan Pengguna:
${brief}

TUGAS UTAMA:
1. Rancang konsep prompt video / storyboard video yang sangat detail, profesional, dan siap pakai berdasarkan brief di atas.
2. Jelaskan struktur alur visual adegan (hook, detail produk, camera movement, lighting, ekspresi model, audio/voice-over).
3. ATURAN VOICEOVER: Pada setiap adegan, naskah Voiceover (VO) WAJIB MINIMAL 27 KATA & MAKSIMAL 30 KATA per scene (rentang wajib: 27–30 kata. DILARANG membuat naskah di bawah 27 kata atau di atas 30 kata agar tidak terpotong saat render 10 detik!).
4. Di bagian akhir respon, SELALU sertakan blok JSON valid berikut agar pengguna dapat langsung menyalin atau menjalankannya:

${jsonTemplate}

(Penting: Pastikan field "prompt" di dalam JSON di atas berisi deskripsi prompt video sinematik lengkap dan siap copy-paste ke AI Video Generator). Jawab dalam Bahasa Indonesia yang natural dan berdaya jual tinggi.`;
}

// Backward compatibility alias for Dola
export function expandDolaChatPreset(prompt = '') {
  return expandChatPreset(prompt, 'dola');
}
