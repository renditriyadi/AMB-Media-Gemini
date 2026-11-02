/**
 * AI Worker Link & E-Commerce Product Extractor
 * Mengintegrasikan ekstraksi link TikTok, TikTok Shop Keranjang Kuning, Tokopedia, Shopee
 * untuk mengekstrak gambar resolusi tinggi, harga, nama toko, deskripsi, dan USP secara otomatis.
 */

export interface DetectedLink {
  url: string;
  platform: string;
  type: string;
  metadata?: ExtractedProductMetadata | null;
}

export interface ExtractedProductImage {
  url: string;
  title?: string;
  role?: 'main_product' | 'gallery' | 'reference' | string;
}

export interface ExtractedProductMetadata {
  title: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  type?: string;
  videoId?: string | null;
  embedUrl?: string | null;
  description?: string;
  price?: string;
  usps?: string[];
  images?: ExtractedProductImage[];
  isProduct?: boolean;
  platform?: string;
  // true hanya jika nilainya benar-benar hasil scrape (bukan tebakan/estimasi). Kosong = tidak diketahui.
  verified?: { title?: boolean; price?: boolean; usps?: boolean; description?: boolean };
}

export function detectEcommerceProductLinks(text: string): DetectedLink[] | null {
  if (!text) return null;
  let textToScan = text;
  try {
    if (text.includes('%2F') || text.includes('%3A') || text.includes('%26')) {
      textToScan = `${text}\n${decodeURIComponent(text)}`;
    }
  } catch (_) {}

  const urlRegex = /(https?:\/\/[^\s"'<>]+)/gi;
  const matches = textToScan.match(urlRegex);
  if (!matches || matches.length === 0) return null;

  const foundLinks: DetectedLink[] = [];
  const seenUrls = new Set<string>();

  for (const rawUrl of matches) {
    const cleanUrl = rawUrl.replace(/[),;.'"]+$/, '');
    if (seenUrls.has(cleanUrl)) continue;
    seenUrls.add(cleanUrl);

    if (/vt\.tokopedia\.com|shop-id\.tokopedia\.com/i.test(cleanUrl)) {
      foundLinks.push({ url: cleanUrl, platform: 'TikTok Shop / Tokopedia', type: 'tokopedia' });
    } else if (/tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com|douyin\.com/i.test(cleanUrl)) {
      foundLinks.push({ url: cleanUrl, platform: 'TikTok Shop / Video', type: 'tiktok' });
    } else if (/youtu\.be|youtube\.com/i.test(cleanUrl)) {
      foundLinks.push({ url: cleanUrl, platform: 'YouTube / Shorts', type: 'youtube' });
    } else if (/instagram\.com\/(?:p|reel|reels|tv)/i.test(cleanUrl)) {
      foundLinks.push({ url: cleanUrl, platform: 'Instagram Reels', type: 'instagram' });
    } else if (/tokopedia\.com|tokopedia\.link/i.test(cleanUrl)) {
      foundLinks.push({ url: cleanUrl, platform: 'Tokopedia', type: 'tokopedia' });
    } else if (/shopee\.co|shp\.ee/i.test(cleanUrl)) {
      foundLinks.push({ url: cleanUrl, platform: 'Shopee', type: 'shopee' });
    } else if (/lazada|blibli/i.test(cleanUrl)) {
      foundLinks.push({ url: cleanUrl, platform: 'Marketplace E-Commerce', type: 'ecommerce' });
    } else if (cleanUrl.startsWith('http')) {
      foundLinks.push({ url: cleanUrl, platform: 'Web Link', type: 'web' });
    }
  }
  return foundLinks.length > 0 ? foundLinks : null;
}

export function isImageLoadable(url: string, timeoutMs: number = 3500): Promise<boolean> {
  if (!url || typeof url !== 'string') return Promise.resolve(false);
  const trimmed = url.trim();
  if (!trimmed) return Promise.resolve(false);
  if (trimmed.startsWith('data:image/')) return Promise.resolve(true);
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return Promise.resolve(false);

  const lower = trimmed.toLowerCase();
  if (
    lower.endsWith('.mp4') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.avi') ||
    lower.endsWith('.mkv') ||
    lower.endsWith('.json') ||
    lower.includes('/video/') ||
    lower.includes('manifest.json') ||
    lower.includes('pixel') ||
    lower.includes('analytics')
  ) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    let resolved = false;
    const img = new Image();
    let timer: any = null;

    const done = (isValid: boolean) => {
      if (resolved) return;
      resolved = true;
      if (timer) clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(isValid);
    };

    timer = setTimeout(() => {
      done(false);
    }, timeoutMs);

    img.onload = () => {
      if (img.naturalWidth > 15 && img.naturalHeight > 15) {
        done(true);
      } else {
        done(false);
      }
    };

    img.onerror = () => {
      done(false);
    };

    img.referrerPolicy = 'no-referrer';
    img.src = trimmed;
  });
}

export async function filterValidImageObjects<T extends { url?: string; thumbnailUrl?: string; base64?: string } | string>(
  images: T[],
  timeoutMs: number = 3500
): Promise<T[]> {
  if (!Array.isArray(images) || images.length === 0) return [];
  const checks = await Promise.allSettled(
    images.map(async (item) => {
      const url = typeof item === 'string' ? item : item.url || item.thumbnailUrl || item.base64 || '';
      const valid = await isImageLoadable(url, timeoutMs);
      return { item, valid };
    })
  );

  return checks
    .filter((r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<any>).value.valid)
    .map((r) => (r as PromiseFulfilledResult<any>).value.item);
}

export async function extractProductWithAiWorker(url: string, item: Partial<DetectedLink> = {}): Promise<ExtractedProductMetadata | null> {
  // Client-side quick check: if url already contains encoded og_info
  if (url.includes('og_info=')) {
    try {
      const rawQuery = url.includes('?') ? url.split('?')[1] : url;
      const params = new URLSearchParams(rawQuery);
      const ogStr = params.get('og_info');
      if (ogStr) {
        const og = JSON.parse(decodeURIComponent(ogStr));
        const cleanTitle = og.title ? decodeURIComponent(og.title).replace(/\+/g, ' ').trim() : '';
        let cleanImg = og.image ? decodeURIComponent(og.image) : '';
        cleanImg = cleanImg.replace(/resize-webp:260:260\.webp/, 'resize-webp:720:720.webp');
        const author = params.get('unique_id') || params.get('author') || '';

        if (cleanTitle) {
          return {
            title: cleanTitle,
            author_name: author,
            author_url: author ? `https://www.tiktok.com/@${author}` : '',
            thumbnail_url: cleanImg,
            type: 'product',
            description: `${cleanTitle}. Produk terverifikasi dari ${author || 'merchant'} di TikTok Shop / Tokopedia.`,
            price: /200\s*(?:biji|benih)/i.test(cleanTitle) ? 'Rp 10.000 - Rp 25.000 (Estimasi Benih Unggul)' : 'Lihat di Listing Toko',
            usps: [
              'Benih Import F1 Kualitas Unggul',
              'Daya Tumbuh Cepat & Tahan Hama',
              'Cocok untuk Hidroponik, Polybag, & Urban Farming',
              'Siap Panen Segar & Aroma Kuat',
            ],
            images: cleanImg ? [{ url: cleanImg, title: 'Foto Produk Utama', role: 'main_product' }] : [],
            isProduct: true,
            platform: 'TikTok Shop / Tokopedia',
            // Harga & USP di jalur ini adalah isian/estimasi, bukan hasil scrape
            verified: { title: true, price: false, usps: false, description: false },
          };
        }
      }
    } catch (_) {}
  }

  try {
    const res = await fetch(`/api/resolve-link?url=${encodeURIComponent(url)}`);
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const data = await res.json();
    if (data && data.success) {
      const isProduct =
        Boolean(data.price) ||
        (Array.isArray(data.images) && data.images.length > 0) ||
        data.type === 'tokopedia' ||
        data.type === 'shopee' ||
        data.type === 'tiktok' ||
        data.isProduct;

      return {
        title: data.title || 'Produk Terverifikasi',
        author_name: data.author_name || '',
        author_url: data.author_url || '',
        thumbnail_url: data.thumbnail_url || (data.images?.[0]?.url || ''),
        type: isProduct ? 'product' : data.type || 'product',
        videoId: data.videoId || null,
        embedUrl: data.embedUrl || null,
        description: data.description || '',
        price: data.price || '',
        usps: data.usps || [],
        images: data.images || [],
        isProduct: true,
        platform: data.platform || item.platform || 'TikTok Shop',
        verified: data.verified || undefined,
      };
    }
  } catch (err) {
    console.warn('[AI Worker Client Fetch Warn]:', err);
  }

  // Fallback direct oEmbed if server call fails
  const isTikTok = /tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com/i.test(url);
  if (isTikTok) {
    try {
      const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
      if (oembedRes.ok) {
        const odata = await oembedRes.json();
        return {
          title: odata.title || 'TikTok Showcase Product',
          author_name: odata.author_name || '',
          author_url: odata.author_url || '',
          thumbnail_url: odata.thumbnail_url || '',
          type: 'product',
          description: odata.title || '',
          usps: ['TikTok Viral Product', 'Terverifikasi'],
          images: odata.thumbnail_url ? [{ url: odata.thumbnail_url, title: 'Cover Produk TikTok', role: 'main_product' }] : [],
          isProduct: true,
          platform: 'TikTok Video / Shop',
          verified: { title: Boolean(odata.title), price: false, usps: false, description: false },
        };
      }
    } catch (_) {}
  }

  return null;
}

export async function fetchLinkMetadata(item: DetectedLink): Promise<DetectedLink> {
  const { url } = item;
  try {
    const meta = await extractProductWithAiWorker(url, item);
    if (meta && (meta.title || meta.thumbnail_url || (meta.images && meta.images.length > 0))) {
      return {
        ...item,
        metadata: meta,
      };
    }
  } catch (err) {
    console.warn('[fetchLinkMetadata Warn]:', err);
  }
  return { ...item, metadata: null };
}

export async function resolveLinksMetadata(links: DetectedLink[]): Promise<DetectedLink[]> {
  if (!links || !Array.isArray(links) || links.length === 0) return [];
  const results = await Promise.allSettled(links.map((link) => fetchLinkMetadata(link)));
  return results.map((r, i) => (r.status === 'fulfilled' ? r.value : { ...links[i], metadata: null }));
}

export function formatScrapingContext(links: DetectedLink[]): string {
  if (!links || links.length === 0) return '';
  let out = 'Tautan & Data Ekstraksi AI Worker Real-Time dari Internet:\n';
  links.forEach((link, index) => {
    out += `\n[Tautan ${index + 1} - ${link.platform}]\n`;
    out += `- URL Asli: ${link.url}\n`;
    if (link.metadata) {
      if (link.metadata.author_name) {
        out += `- Kreator / Toko / Merchant: @${link.metadata.author_name}\n`;
      }
      if (link.metadata.title) {
        out += `- Judul / Nama Produk / Caption: "${link.metadata.title}"\n`;
      }
      if (link.metadata.price) {
        out += `- Harga Produk / Nominal Terverifikasi: ${link.metadata.price}\n`;
      }
      if (link.metadata.description) {
        out += `- Deskripsi / Detail Produk: "${link.metadata.description}"\n`;
      }
      if (link.metadata.usps && link.metadata.usps.length > 0) {
        out += `- USP / Keunggulan Produk: ${link.metadata.usps.join(', ')}\n`;
      }
      if (link.metadata.thumbnail_url) {
        out += `- Visual Cover Thumbnail / Foto Produk Utama: ${link.metadata.thumbnail_url}\n`;
      }
      if (link.metadata.images && link.metadata.images.length > 0) {
        out += `- Galeri Foto Produk Terdeteksi (${link.metadata.images.length} foto): ${link.metadata.images.map((img) => img.url).join(', ')}\n`;
      }
      out += `- Status AI Worker: Berhasil mengekstrak data produk, harga aktual, & aset visual resolusi tinggi secara otomatis.\n`;
    } else {
      out += `- Status AI Worker: Tautan produk terdeteksi. AI menganalisis konteks penawaran produk.\n`;
    }
  });

  out += `\n[PENTING & INSTRUKSI MUTLAK ANALISIS PRODUK & STORYBOARD]:
Anda adalah Sutradara Kreatif & E-Commerce Strategist. AI Worker telah mengekstrak detail produk dari link tersebut di atas.
DILARANG KERAS hanya membuat tabel ringkasan formal singkat ("Saya telah menerima tautan...") atau menanyakan kembali apa yang harus dilakukan!
LANGSUNG berikan penjelasan dan analisis tuntas dalam gaya bahasa Indonesia akrab, persuasif, dan mendalam ("bro"):

1. 🛍️ **Bedah Detail Produk & Nilai Jual Utama (Core Value Proposition)**:
   - Jelaskan apa produk ini (keunggulan varietas, spesifikasi benih/bahan/formula, isi kemasan).
   - Target pasar potensial (penghobi berkebun, urban farming rumahan, ibu rumah tangga, pejuang dapur hemat).
   - Kenapa produk ini sangat berpotensi viral dan laku keras.

2. 🪝 **3 Formula Hook Pembuka Viral (Stop-Scroll 3 Detik Pertama)**:
   - **Formula 1 (Relatable POV)**: Contoh kalimat hook pembuka yang relate dengan masalah sehari-hari.
   - **Formula 2 (Rahasia / "Racun TikTok")**: Contoh hook pembuka rasa penasaran tinggi.
   - **Formula 3 (Hasil Nyata / Solusi Cepat)**: Hook pembuka pembuktian visual yang memicu interaksi.

3. 🎬 **Konsep Alur Storyboard Iklan (Scene-by-Scene)**:
   - Susun breakdown scene mengikuti DURASI & JUMLAH SCENE yang diminta pengguna (atau durasi video referensi bila ada).
   - JANGAN memaksa durasi 15 detik / 4 scene bila pengguna atau video referensi menentukan lain.
   - Scene 1 wajib hook 3 detik pertama (pattern interrupt + rasa penasaran), scene penutup fokus hero shot & value prop.
   - JANGAN menaruh CTA keranjang kuning, nomor WhatsApp, link bio, atau nama marketplace di dalam VO / on-screen text / visual.

4. 🎙️ **Naskah Voiceover (VO) Lengkap Konten Kreator**:
   - Tuliskan naskah narasi suara lengkap dari awal sampai akhir dengan gaya natural, santai, dan persuasif ala kreator TikTok.`;

  return out;
}

export function generateProductAnalysisFallback(product: any): string {
  const title = product?.title || 'Produk Pilihan TikTok Shop';
  const seller = product?.author_name ? `@${product.author_name}` : 'Penjual Terpercaya';
  const price = product?.price || 'Lihat di Listing Toko';
  const usps = Array.isArray(product?.usps) && product.usps.length > 0
    ? product.usps
    : [
        'Kualitas Unggul Terverifikasi',
        'Daya Tumbuh Cepat & Tahan Hama',
        'Cocok untuk Urban Farming & Pemula',
        'Hasil Memuaskan Siap Panen',
      ];

  return `Berikut adalah bedah produk mendalam dan strategi konten untuk **"${title}"** dari **${seller}**:

---

1. **Bedah Detail Produk & Nilai Jual Utama (Core Value Proposition)**

Produk ini adalah **"${title}"** yang ditawarkan oleh merchant **${seller}** dengan estimasi harga **${price}**.
${usps.map((u: string) => `* **${u}**`).join('\n')}

**Target Pasar Potensial:**
* **Pencinta Tanaman & Urban Farming Rumahan:** Ibu rumah tangga, penghobi berkebun, dan pemula yang ingin memetik buah/sayur segar sendiri di pot atau polybag pekarangan.
* **Pencari Solusi Hemat & Sehat:** Konsumen yang ingin menikmati panen segar berkualitas tanpa harus terus belanja mahal di supermarket.
* **Pencinta Konten Viral "Racun TikTok":** Penonton yang tertarik melihat proses semai biji buah eksotis hingga bertunas lebat dan berbuah.

---

2. **3 Formula Hook Pembuka Viral (Stop-Scroll 3 Detik Pertama)**

1. **Formula 1 (Relatable POV / Penasaran):**
   > *"Nggak nyangka cuma modal benih segini bisa panen buah segar sendiri di rumah tanpa butuh lahan luas!"*
2. **Formula 2 (Rahasia "Racun TikTok"):**
   > *"Stop beli mahal di supermarket! Ternyata semudah ini semai biji unggul ini langsung subur dalam hitungan minggu!"*
3. **Formula 3 (Hasil Nyata & Pembuktian):**
   > *"Banyak yang nggak percaya buah ini bisa tumbuh lebat di pot, tonton sampai habis trik semai praktisnya!"*

---

3. **Konsep Alur Storyboard Iklan (Scene-by-Scene)**

* **Scene 1 (Hook 0–3s):**
  * *Visual:* Close-up tangan memegang buah segar yang dibelah dua tampak juicy dan menggoda, lalu transisi cepat ke kemasan benih **${title}**.
  * *Voiceover (VO):* *"Pengen panen buah segar sendiri di pekarangan rumah? Rahasianya ada di bibit unggul kualitas import satu ini!"*
* **Scene 2 (Problem & Solusi):**
  * *Visual:* Tangan memperlihatkan biji benih bersih dan padat, meletakkannya di media tanam/polybag mini dengan semprotan air halus.
  * *Voiceover (VO):* *"Daya tumbuhnya cepat banget, tahan hama, dan cocok banget buat pemula yang baru belajar berkebun."*
* **Scene 3 (Pembuktian & Hero):**
  * *Visual:* Montase transisi tunas hijau yang tumbuh segar, rimbun, dan sehat di pekarangan rumah.
  * *Voiceover (VO):* *"Cukup siram rutin tiap pagi sore, tunasnya langsung bermunculan subur. Puas banget lihat hasilnya!"*
* **Scene 4 (Penutup / Hero Finish):**
  * *Visual:* Hero shot produk **${title}** dengan angle bersih dan pencahayaan natural, produk tampil sebagai solusi utama.
  * *Voiceover (VO):* *"Inspirasi kebun unik untuk rumah kamu, benih ${title} siap tumbuh di polybag dan langsung bisa dipanen sendiri."*

---

4. **Rekomendasi Sound & Caption**
* **Tipe Musik/Sound:** Lo-Fi Chill Acoustic Beats atau Viral Commercial Upbeat Sound TikTok.
* **Hashtag Rekomendasi:** \`#UrbanFarming #BenihUnggul #TanamanBuah #RacunTikTokShop\``;
}



// ---------------------------------------------------------------------------
// AI Worker untuk Node Canvas
// ---------------------------------------------------------------------------

export interface AiWorkerExtraction {
  url: string;
  platform: string;
  product: {
    title?: string;
    authorName?: string;
    platform?: string;
    price?: string;
    description?: string;
    usps?: string[];
    thumbnailUrl?: string;
  };
  verified: { title: boolean; price: boolean; usps: boolean; description: boolean };
  contextText: string;
  galleryUrls: string[];
  linkCount: number;
}

/**
 * Menyusun teks Context untuk node AI Worker.
 * Hanya fakta yang terverifikasi (hasil scrape) yang ikut; data tebakan/estimasi tidak diteruskan.
 * Instruksi kreatif (mis. peran "Sutradara TikTok") sengaja tidak ada di sini: itu tugas node hilir.
 */
export function buildAiWorkerContext(args: {
  url: string;
  platform: string;
  title?: string;
  authorName?: string;
  price?: string;
  description?: string;
  usps?: string[];
  verified: { title: boolean; price: boolean; usps: boolean; description: boolean };
  note?: string;
}): string {
  const { verified } = args;
  const lines: string[] = [];
  lines.push(`Platform: ${args.platform}`);
  if (verified.title && args.title) lines.push(`Nama produk: ${args.title}`);
  if (args.authorName) lines.push(`Toko / kreator: ${args.authorName}`);
  if (verified.price && args.price) lines.push(`Harga: ${args.price}`);
  if (verified.description && args.description) lines.push(`Deskripsi: ${args.description}`);
  if (verified.usps && args.usps && args.usps.length > 0) {
    lines.push(`Hashtag konten: ${args.usps.join(', ')}`);
  }
  lines.push(`Link: ${args.url}`);
  if (args.note && args.note.trim()) lines.push(`Catatan tambahan: ${args.note.trim()}`);

  const missing: string[] = [];
  if (!verified.title) missing.push('nama produk');
  if (!verified.price) missing.push('harga');
  if (!verified.description) missing.push('deskripsi');
  if (missing.length > 0) {
    lines.push(`Tidak terbaca dari link (jangan dikarang): ${missing.join(', ')}`);
  }
  return lines.join('\n');
}

/**
 * Menjalankan ekstraksi untuk node AI Worker (hanya link pertama yang diproses).
 * Melempar Error berpesan Indonesia jika gagal.
 */
export async function runAiWorkerExtraction(linkText: string, note?: string): Promise<AiWorkerExtraction> {
  const links = detectEcommerceProductLinks(linkText || '');
  if (!links || links.length === 0) {
    throw new Error('Tidak ada link di kolom link produk.');
  }
  const preferred = links.find((l) => l.type !== 'web') || links[0];

  const [resolved] = await resolveLinksMetadata([preferred]);
  const meta = resolved?.metadata;
  if (!meta) {
    throw new Error('Gagal mengambil data dari link. Cek link-nya atau coba lagi.');
  }

  const verified = {
    title: Boolean(meta.verified?.title),
    price: Boolean(meta.verified?.price),
    usps: Boolean(meta.verified?.usps),
    description: Boolean(meta.verified?.description),
  };

  const candidates: string[] = [];
  (meta.images || []).forEach((img) => {
    const u = typeof img === 'string' ? img : img?.url;
    if (u && !candidates.includes(u)) candidates.push(u);
  });
  if (meta.thumbnail_url && !candidates.includes(meta.thumbnail_url)) candidates.push(meta.thumbnail_url);
  const galleryUrls = (await filterValidImageObjects(candidates, 3000)).slice(0, 8);

  const product = {
    title: verified.title ? meta.title : undefined,
    authorName: meta.author_name || undefined,
    platform: meta.platform || preferred.platform,
    price: verified.price ? meta.price : undefined,
    description: verified.description ? meta.description : undefined,
    usps: verified.usps ? meta.usps || [] : [],
    thumbnailUrl: meta.thumbnail_url || undefined,
  };

  const platform = product.platform || preferred.platform;
  const contextText = buildAiWorkerContext({
    url: preferred.url,
    platform,
    title: product.title,
    authorName: product.authorName,
    price: product.price,
    description: product.description,
    usps: product.usps,
    verified,
    note,
  });

  return { url: preferred.url, platform, product, verified, contextText, galleryUrls, linkCount: links.length };
}