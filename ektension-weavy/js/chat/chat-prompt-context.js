export function buildNativeChatSupplementalContext({ mediaCatalog, scrapingContext } = {}) {
  let mediaCatalogSection = '';
  if (Array.isArray(mediaCatalog?.mediaList) && mediaCatalog.mediaList.length > 0) {
    mediaCatalogSection = '\n\n[KATALOG RESMI MEDIA SESI INI (@imgX & @vidX)]\n';
    mediaCatalog.mediaList.forEach((media) => {
      if (media.type === 'video') {
        mediaCatalogSection += `- ${media.key}: Video "${media.name}" (durasi terdeteksi ~${media.duration || 24}s)\n`;
      } else {
        mediaCatalogSection += `- ${media.key}: Foto "${media.name}"\n`;
      }
    });
    mediaCatalogSection += `Aturan Penting Repost: Jika pengguna ingin melihat ulang media lama (misal "mana foto pertama tadi", "tampilkan @img1"), DILARANG menyuruh render ulang dan DILARANG memotong koin. Wajib sertakan tag: [weavy_repost:${mediaCatalog.mediaList[0]?.key || '@img1'}] agar langsung dimunculkan di UI tanpa kredit.\n`;
  }

  let scrapingSection = '';
  if (typeof scrapingContext === 'string' && scrapingContext.trim()) {
    const images = mediaCatalog?.mediaList
      ?.filter((media) => media.type === 'image')
      .slice(0, 6)
      .map((media) => ({ url: media.url, title: media.name })) || [];
    const thumbnailUrl = mediaCatalog?.mediaList?.[0]?.url || '';
    scrapingSection =
      `\n\n[LIVE E-COMMERCE & VIDEO CONTENT METADATA]\n${scrapingContext.trim()}\n` +
      `PENTING & INSTRUKSI MUTLAK ANALISIS LINK DENGAN AI WORKER:\n` +
      `- AI Worker telah mengekstrak naskah asli, judul produk/video, galeri gambar resolusi tinggi, dan data harga aktual secara otomatis.\n` +
      `- Jika terdeteksi tautan produk e-commerce / video, WAJIB sertakan blok JSON product_card di baris paling awal respon Anda agar ekstensi menampilkan Kartu Interaktif AI Worker dengan tombol Storyboard & Generator:\n` +
      `\`\`\`product_card\n` +
      `{\n` +
      `  "title": "Nama Produk Lengkap / Judul Konten",\n` +
      `  "store": "Nama Toko / Kreator",\n` +
      `  "platform": "Tokopedia / TikTok Shop",\n` +
      `  "description": "Rangkuman spesifikasi, fungsi, dan keunggulan utama produk...",\n` +
      `  "price": "Nominal Harga Riil (contoh: Rp 24.500 atau Rp 25.000 - Rp 45.000)",\n` +
      `  "usps": ["Keunggulan 1", "Keunggulan 2", "Keunggulan 3"],\n` +
      `  "thumbnail_url": "${thumbnailUrl}",\n` +
      `  "images": ${JSON.stringify(images)}\n` +
      `}\n` +
      `\`\`\`\n` +
      `- INSTRUKSI KHUSUS HARGA & FOTO:\n` +
      `  1. Pada field "price", WAJIB cantumkan angka harga riil (misal Rp 24.500 atau estimasi Rp 25.000 - Rp 45.000 dari data yang diekstrak). DILARANG menulis "Tertera di platform" atau membiarkannya kosong!\n` +
      `  2. Pada field "images", sertakan array semua foto produk yang terdeteksi dari metadata agar muncul dalam bentuk galeri interaktif.\n` +
      `- JANGAN berhenti atau menanyakan opsi A/B/C atau menyuruh ketik /video!\n` +
      `- LANGSUNG berikan analisis tuntas 5 bagian: (1) Ringkasan & Naskah Asli Lengkap, (2) Bedah Hook & Formula Viral Triggers, (3) Kekuatan Metrik (Save/Share Rate), (4) Rekomendasi Storyboard Adaptasi Tabel Scene-by-Scene lengkap, dan (5) Potensi Monetisasi / Keranjang Kuning TikTok Shop!\n`;
  }

  return { mediaCatalogSection, scrapingSection };
}
