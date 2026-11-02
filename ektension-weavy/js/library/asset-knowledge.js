/**
 * Asset Knowledge Module
 * Membangun visual asset knowledge base dari Library pengguna untuk disuntikkan ke
 * AI System Prompt (Storyboard Copilot & Multimodal Chat) agar AI secara cerdas mengenali
 * talent, produk, dan latar yang sudah disimpan pengguna.
 */

export function buildLibraryKnowledgePrompt(assets = []) {
  if (!Array.isArray(assets) || assets.length === 0) {
    return '';
  }

  // Filter aset yang memiliki identitas atau deskripsi berbobot, atau ambil hingga 12 aset teratas
  const informativeAssets = assets.filter((asset) => {
    return (
      (asset.description && asset.description.trim().length > 0) ||
      (asset.talentNiche && asset.talentNiche.trim().length > 0) ||
      (asset.name && !asset.name.startsWith('Gambar referensi') && !asset.name.startsWith('Library asset') && !asset.name.startsWith('upload_')) ||
      (asset.role && asset.role !== 'custom')
    );
  });

  const targetAssets = informativeAssets.length > 0 ? informativeAssets.slice(0, 15) : assets.slice(0, 8);

  if (!targetAssets.length) {
    return '';
  }

  const roleNames = {
    model: 'TALENT / MODEL',
    product: 'PRODUK',
    background: 'BACKGROUND / LATAR',
    props: 'PROPS / OBJEK',
    custom: 'OTHER / REFERENSI',
  };

  const assetListText = targetAssets.map((asset, index) => {
    const roleTitle = roleNames[asset.role || 'custom'] || 'REFERENSI';
    const name = asset.name || `Aset ${index + 1}`;
    const niche = asset.talentNiche ? ` | Niche: ${asset.talentNiche}` : '';
    const desc = asset.description ? `\n    - Konteks & Karakteristik: ${asset.description}` : '';
    const tags = Array.isArray(asset.tags) && asset.tags.length ? `\n    - Kata Kunci: ${asset.tags.join(', ')}` : '';
    const url = asset.url || asset.thumbnailUrl || '';

    return `  [${roleTitle}] "${name}"${niche}${desc}${tags}
    - URL/Ref: ${url}`;
  }).join('\n\n');

  return `[VISUAL ASSET KNOWLEDGE BASE DARI LIBRARY PENGGUNA]
Pengguna memiliki katalog aset visual referensi yang tersimpan di Library akun mereka:

${assetListText}

[PEDOMAN KECERDASAN AI TERHADAP ASSET LIBRARY]:
1. ANALISIS KECOCOKAN KONTEKS: Jika pengguna meminta storyboard, konsep video, adegan iklan, atau prompt gambar yang temanya sesuai dengan salah satu aset di atas (misalnya produk pertanian/sayur cocok dengan talent "Rudi", atau produk kecantikan cocok dengan aset serum), kamu HARUS secara proaktif merekomendasikan dan menggunakan aset tersebut!
2. SEBUT NAMA ASET DENGAN JELAS: Sapa atau sebutkan nama aset secara spesifik dalam penjelasanmu (contoh: "Untuk talent video bibit sayuran ini, saya gunakan talent Rudi dari Library kamu karena karakternya sangat pas dengan niche pertanian.").
3. KONSISTENSI KARAKTER & PRODUK: Jadikan aset yang cocok sebagai referensi visual utama pada scene yang relevan agar karakter dan kemasan produk konsisten dari awal hingga akhir.
4. UNTUK STORYBOARD COPILOT: Saat merekomendasikan project atau scene draft, prioritaskan menautkan referensi visual ke aset library yang cocok tersebut.`;
}

/**
 * Menemukan aset library yang relevan dengan teks prompt pengguna berdasarkan kata kunci, nama, atau deskripsi.
 */
export function findRelevantLibraryAssets(queryText = '', assets = []) {
  if (!queryText || !Array.isArray(assets) || !assets.length) return [];

  const lowerQuery = queryText.toLowerCase();
  const scored = assets.map((asset) => {
    let score = 0;
    const name = (asset.name || '').toLowerCase();
    const niche = (asset.talentNiche || '').toLowerCase();
    const desc = (asset.description || '').toLowerCase();
    const tags = Array.isArray(asset.tags) ? asset.tags.map((t) => String(t).toLowerCase()) : [];

    if (name && lowerQuery.includes(name)) score += 10;
    if (niche && lowerQuery.includes(niche)) score += 7;
    tags.forEach((tag) => {
      if (tag && lowerQuery.includes(tag)) score += 5;
    });
    if (desc && lowerQuery.includes(desc.slice(0, 30))) score += 4;

    // Check individual words from query
    const words = lowerQuery.split(/\s+/).filter((w) => w.length > 3);
    words.forEach((word) => {
      if (name.includes(word)) score += 3;
      if (niche.includes(word)) score += 2;
      if (tags.some((t) => t.includes(word))) score += 2;
      if (desc.includes(word)) score += 1;
    });

    return { asset, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.asset);
}
