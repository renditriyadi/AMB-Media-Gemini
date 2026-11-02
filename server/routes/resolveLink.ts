import express from 'express';
import axios from 'axios';

const router = express.Router();

function parseCurrencyNumber(numStr: any): string {
  if (!numStr) return '';
  const clean = String(numStr).replace(/[^\d]/g, '');
  if (!clean || clean.length < 3) return '';
  const num = parseInt(clean, 10);
  if (isNaN(num) || num <= 0) return '';
  return `Rp ${num.toLocaleString('id-ID')}`;
}

// Extract TikTok Video ID from URL or HTML
function extractTikTokId(url: string, html: string = ''): string | null {
  if (html) {
    const htmlMatch =
      html.match(/data-video-id=["']?(\d+)["']?/i) ||
      html.match(/\/video\/(\d+)/i) ||
      html.match(/\/v\/(\d+)/i) ||
      html.match(/"id":\s*"?(\d{15,22})"?/i) ||
      html.match(/"itemId":\s*"?(\d{15,22})"?/i) ||
      html.match(/modal_id=(\d+)/i);
    if (htmlMatch) return htmlMatch[1];
  }
  if (!url) return null;
  const match =
    url.match(/\/video\/(\d+)/i) ||
    url.match(/\/v\/(\d+)/i) ||
    url.match(/modal_id=(\d+)/i) ||
    url.match(/\/item\/(\d+)/i) ||
    url.match(/item_id=(\d+)/i);
  return match ? match[1] : null;
}

// GET /api/resolve-link?url=...
router.get('/resolve-link', async (req, res) => {
  try {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl) {
      return res.status(400).json({ success: false, error: 'URL tidak boleh kosong.' });
    }

    const result: {
      success: boolean;
      resolvedUrl: string;
      platform: string;
      type: string;
      title: string;
      author_name: string;
      author_url: string;
      price: string;
      description: string;
      usps: string[];
      thumbnail_url: string;
      images: Array<{ url: string; title: string; role: string }>;
      videoId: string | null;
      embedUrl: string | null;
      isProduct: boolean;
      // Penanda: true hanya jika nilainya benar-benar hasil scrape (bukan tebakan/estimasi/teks isian)
      verified?: { title: boolean; price: boolean; usps: boolean; description: boolean };
      rawTikData?: any;
    } = {
      success: true,
      resolvedUrl: rawUrl,
      platform: 'TikTok Shop / Tokopedia',
      type: 'product',
      title: '',
      author_name: '',
      author_url: '',
      price: '',
      description: '',
      usps: [],
      thumbnail_url: '',
      images: [],
      videoId: null,
      embedUrl: null,
      isProduct: true,
    };

    let resolvedUrl = rawUrl;
    let preloadedHtml = '';

    // 1. Follow HTTP 302 redirect directly with maxRedirects: 0 to catch the location query parameters
    try {
      const headRes = await axios.get(rawUrl, {
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
        timeout: 10000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        },
      });

      if (headRes.headers?.location) {
        resolvedUrl = headRes.headers.location;
      }
      if (typeof headRes.data === 'string') {
        preloadedHtml = headRes.data;
      }
    } catch (e: any) {
      if (e.response?.headers?.location) {
        resolvedUrl = e.response.headers.location;
      }
    }

    result.resolvedUrl = resolvedUrl;

    // 2. Instant URL Query & og_info payload extraction (Tokopedia / TikTok Shop encoded share links)
    const scanUrls = [resolvedUrl, rawUrl];
    for (const targetToScan of scanUrls) {
      if (!targetToScan) continue;
      let rawQuery = targetToScan;
      if (targetToScan.includes('?')) {
        rawQuery = targetToScan.split('?')[1];
      }
      const params = new URLSearchParams(rawQuery);

      const ogInfo = params.get('og_info');
      if (ogInfo) {
        try {
          const og = JSON.parse(decodeURIComponent(ogInfo));
          if (og.title && (!result.title || result.title === 'Produk TikTok Showcase')) {
            result.title = decodeURIComponent(og.title).replace(/\+/g, ' ').trim();
          }
          if (og.image) {
            let cleanImg = decodeURIComponent(og.image);
            cleanImg = cleanImg.replace(/resize-webp:260:260\.webp/, 'resize-webp:720:720.webp');
            if (!result.thumbnail_url) result.thumbnail_url = cleanImg;
            if (!result.images.some((m) => m.url === cleanImg)) {
              result.images.unshift({
                url: cleanImg,
                title: 'Foto Produk Utama',
                role: 'main_product',
              });
            }
          }
        } catch (_) {}
      }

      const queryTitle =
        params.get('title') ||
        params.get('og_title') ||
        params.get('product_name') ||
        params.get('share_text');
      if (queryTitle && (!result.title || result.title === 'Produk TikTok Showcase')) {
        result.title = decodeURIComponent(queryTitle).replace(/\+/g, ' ').trim();
      }

      const queryImg =
        params.get('image') ||
        params.get('og_image') ||
        params.get('cover') ||
        params.get('thumbnail') ||
        params.get('share_image');
      if (queryImg) {
        let decodedImg = decodeURIComponent(queryImg);
        decodedImg = decodedImg.replace(/resize-webp:260:260\.webp/, 'resize-webp:720:720.webp');
        if (decodedImg.startsWith('http') && !result.images.some((m) => m.url === decodedImg)) {
          result.images.unshift({
            url: decodedImg,
            title: 'Foto Produk Utama',
            role: 'main_product',
          });
          if (!result.thumbnail_url) result.thumbnail_url = decodedImg;
        }
      }

      const queryAuthor =
        params.get('unique_id') ||
        params.get('author') ||
        params.get('shop') ||
        params.get('seller');
      if (queryAuthor && !result.author_name) {
        result.author_name = decodeURIComponent(queryAuthor).trim();
      }

      const queryPrice = params.get('price') || params.get('amount');
      if (queryPrice && !result.price) {
        result.price = parseCurrencyNumber(queryPrice) || queryPrice;
      }
    }

    const isTikTok =
      /tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com|douyin\.com|vt\.tokopedia\.com/i.test(rawUrl) ||
      /tiktok\.com/i.test(resolvedUrl);

    if (isTikTok) {
      result.platform = 'TikTok Shop / Tokopedia';
      result.type = 'tiktok';
      result.videoId = extractTikTokId(resolvedUrl, preloadedHtml) || extractTikTokId(rawUrl);

      // A. Call TikWM API (High-res extractor for video, slideshow photos, title, author)
      try {
        const tikRes = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(rawUrl)}&hd=1`, {
          timeout: 10000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });

        if (tikRes.data && tikRes.data.code === 0 && tikRes.data.data) {
          const v = tikRes.data.data;
          result.rawTikData = v;
          if (v.title && !result.title) result.title = v.title;
          if (v.author?.nickname && !result.author_name) {
            result.author_name = `${v.author.nickname} (@${v.author.unique_id || ''})`.trim();
          }
          if (v.author?.unique_id && !result.author_url) {
            result.author_url = `https://www.tiktok.com/@${v.author.unique_id}`;
          }

          // Main cover
          const cover = v.cover || v.origin_cover;
          if (cover) {
            result.thumbnail_url = cover;
            result.images.push({
              url: cover,
              title: 'Foto Produk Utama / Cover',
              role: 'main_product',
            });
          }

          // Photo slideshow images (TikTok photo posts / product carousel)
          if (Array.isArray(v.images) && v.images.length > 0) {
            v.images.forEach((imgUrl: string, idx: number) => {
              if (imgUrl && !result.images.some((m) => m.url === imgUrl)) {
                result.images.push({
                  url: imgUrl,
                  title: `Slide Foto Produk ${idx + 1}`,
                  role: idx === 0 && !result.thumbnail_url ? 'main_product' : 'gallery',
                });
              }
            });
          }

          if (v.title) {
            const hashtags = v.title.match(/#[\w\u0590-\u05ff]+/g) || [];
            if (hashtags.length > 0) {
              result.usps = hashtags.slice(0, 5).map((h: string) => h.replace('#', ''));
            }
            if (!result.description) {
              result.description = v.title.replace(/#[\w\u0590-\u05ff]+/g, '').trim();
            }
          }
        }
      } catch (tikErr: any) {
        // TikWM is expected to fail gracefully on shop product URLs
      }

      // B. TikTok oEmbed API (Fallback & Creator info)
      if (!result.title || !result.thumbnail_url) {
        try {
          const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(resolvedUrl || rawUrl)}`;
          const oRes = await axios.get(oembedUrl, { timeout: 6000 });
          if (oRes.data) {
            const od = oRes.data;
            if (od.title && !result.title) result.title = od.title;
            if (od.author_name && !result.author_name) result.author_name = od.author_name;
            if (od.author_url && !result.author_url) result.author_url = od.author_url;
            if (od.thumbnail_url && !result.thumbnail_url) {
              result.thumbnail_url = od.thumbnail_url;
              if (!result.images.some((m) => m.url === od.thumbnail_url)) {
                result.images.unshift({
                  url: od.thumbnail_url,
                  title: 'Cover & Foto Produk TikTok',
                  role: 'main_product',
                });
              }
            }
          }
        } catch (_) {}
      }
    }

    // Catat data mana yang benar-benar berasal dari sumber SEBELUM langkah estimasi/isian di bawah.
    // Catatan: usps dari scrape hanyalah hashtag konten, bukan klaim keunggulan produk.
    const verified = {
      title: Boolean(result.title) && result.title !== 'Produk TikTok Showcase',
      price: Boolean(result.price),
      usps: result.usps.length > 0,
      description: Boolean(result.description),
    };

    // 3. Smart Estimates for Price & Description if not detected
    if (!result.price && result.title) {
      if (/200\s*(?:biji|benih|bibit)/i.test(result.title)) {
        result.price = 'Rp 10.000 - Rp 25.000 (Estimasi Benih Unggul)';
      } else if (/25\s*(?:jenis|pcs|sayur|pack)/i.test(result.title)) {
        result.price = 'Rp 25.000 - Rp 45.000 (Estimasi Bundling Benih)';
      } else if (/100\s*(?:biji|benih|pcs)/i.test(result.title)) {
        result.price = 'Rp 8.000 - Rp 15.000';
      } else {
        result.price = 'Lihat di Listing Toko';
      }
    }

    // 4. Smart USPs tailored to product category
    if (result.usps.length === 0 && result.title) {
      if (/benih|seledri|sayur|bibit|tanaman/i.test(result.title)) {
        result.usps = [
          'Benih Import F1 Kualitas Unggul',
          'Daya Tumbuh Cepat & Tahan Hama',
          'Cocok untuk Hidroponik, Polybag, & Urban Farming',
          'Siap Panen Segar & Aroma Kuat',
        ];
      } else if (/fashion|baju|kaos|celana|jaket|dress/i.test(result.title)) {
        result.usps = ['Bahan Adem & Lembut', 'Jahitan Rapi Presisi', 'Desain Kekinian Viral TikTok'];
      } else if (/serum|cream|skincare|sabun|lotion|sunscreen/i.test(result.title)) {
        result.usps = ['Formula Ringan Cepat Meresap', 'BPOM & Aman Kulit Sensitif', 'Hasil Cerah Glowing Nyata'];
      } else {
        result.usps = ['Produk Viral TikTok', 'Kualitas Terverifikasi', 'Siap Dikirim Cepat'];
      }
    }

    if (!result.description && result.title) {
      result.description = `${result.title}. Produk terverifikasi dari ${result.author_name || 'penjual terpercaya'} di TikTok Shop / Tokopedia.`;
    }

    if (!result.title) {
      result.title = 'Produk TikTok Showcase';
    }

    result.verified = verified;

    return res.json(result);
  } catch (err: any) {
    console.error('[Resolve Link Error]:', err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || 'Gagal memproses tautan.' });
  }
});

export default router;