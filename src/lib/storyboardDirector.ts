// storyboardDirector.ts - Lapisan "Director" untuk Storyboard Copilot di Canvas.
//
// PRINSIP: PRESET adalah pemegang aturan isi.
//   - Preset (mis. /facelessgardenugc) menentukan struktur Bagian/Scene/Shoot, total durasi &
//     jumlah scene, voiceover (gaya + jumlah kata), onScreenText, aturan talent/wajah, gaya
//     kamera, CTA, dan larangan visual.
//   - Director hanya menambahkan hal yang TIDAK diatur preset: kontrak keluaran JSON murni
//     (analysis + masterProductionSheetPrompt), variasi kamera di dalam batas preset, lock
//     konsistensi, serta gaya TikTok / hook pattern bila user memilihnya secara eksplisit.
//   - Bila ada konflik antara tambahan Director dan preset, PRESET MENANG.
//
// Tanpa preset yang ter-expand, Director jatuh kembali ke mode mandiri (port dari generator
// storyboard ekstensi: ektension-weavy/sidepanel.js -> handleGenerateStoryboard).

export type StoryboardFormulaAngle =
  | 'hook_extreme'
  | 'humor_parody'
  | 'deep_emotional'
  | 'fast_ugc'
  | 'hard_sell'
  | 'none';

/** 'preset' = ikuti gaya visual preset (default). */
export type StoryboardTiktokStyle =
  | 'preset'
  | 'ugc_handheld'
  | 'iphone_pov'
  | 'macro_texture'
  | 'split_screen'
  | 'authentic_vlog'
  | 'commercial_studio';

/** 'preset' = ikuti hook preset (default). */
export type StoryboardHookPattern =
  | 'preset'
  | 'auto_smart'
  | 'pattern_interrupt'
  | 'negative_fear'
  | 'split_transformation'
  | 'relatable_pov'
  | 'secret_unboxing'
  | 'flash_urgency';

export const STORYBOARD_FORMULA_OPTIONS: Array<{ value: StoryboardFormulaAngle; label: string }> = [
  { value: 'hook_extreme', label: 'Hook Ekstrem (Problem → Bukti → Solusi)' },
  { value: 'humor_parody', label: 'Humor / Parodi' },
  { value: 'deep_emotional', label: 'Emosional Mendalam' },
  { value: 'fast_ugc', label: 'Fast UGC' },
  { value: 'hard_sell', label: 'Hard Sell / Urgency' },
  { value: 'none', label: 'Tanpa Formula (bebas)' },
];

export const STORYBOARD_TIKTOK_STYLE_OPTIONS: Array<{ value: StoryboardTiktokStyle; label: string }> = [
  { value: 'preset', label: 'Ikut Preset (default)' },
  { value: 'ugc_handheld', label: 'UGC Handheld' },
  { value: 'iphone_pov', label: 'iPhone POV' },
  { value: 'macro_texture', label: 'Macro Tekstur' },
  { value: 'split_screen', label: 'Split Screen Before/After' },
  { value: 'authentic_vlog', label: 'Vlog Autentik' },
  { value: 'commercial_studio', label: 'Studio Komersial' },
];

export const STORYBOARD_HOOK_PATTERN_OPTIONS: Array<{ value: StoryboardHookPattern; label: string }> = [
  { value: 'preset', label: 'Ikut Preset (default)' },
  { value: 'auto_smart', label: 'Otomatis (Smart Hook)' },
  { value: 'pattern_interrupt', label: 'Pattern Interrupt' },
  { value: 'negative_fear', label: 'Peringatan Negatif' },
  { value: 'split_transformation', label: 'Before vs After' },
  { value: 'relatable_pov', label: 'Relatable POV' },
  { value: 'secret_unboxing', label: 'Rahasia / Racun TikTok' },
  { value: 'flash_urgency', label: 'Flash Sale / Urgency' },
];

// Fase formula dinyatakan sebagai pecahan dari TOTAL durasi, bukan detik mutlak.
// (Versi ekstensi memakai 0-3s / 3-6s / 6-10s yang hanya benar untuk video 10 detik.)
const FORMULA_PHASES: Record<string, Array<[number, string]>> = {
  hook_extreme: [[0.3, 'HOOK: Problem/Misteri/Claim gila'], [0.6, 'AGITATE: Bukti visual dramatis'], [1, 'SOLVE: Solusi produk + CTA']],
  humor_parody: [[0.3, 'HOOK: Situasi absurd/relatable konyol'], [0.6, 'MIDDLE: Komplikasi lucu'], [1, 'SOLVE: Solusi konyol tapi nyata + CTA']],
  deep_emotional: [[0.3, 'HOOK: Emosi kuat (haru, sedih, kagum)'], [0.6, 'BUILD: Escalation emosi'], [1, 'PAYOFF: Twist emosional + produk + CTA']],
  fast_ugc: [[0.2, 'HOOK: Bingkai cepat/tekanan'], [0.5, 'PROOF: Bukti UGC cepat'], [1, 'CTA: Hard sell + urgency']],
  hard_sell: [[0.2, 'HOOK: Claim berani + scarcity'], [0.5, 'PROOF: Testimoni/stok menipis'], [1, 'CTA: Urgency + harga (CTA keranjang kuning cukup di voiceover)']],
};

/** Hanya formula TERPILIH yang ditulis, dengan detik dihitung dari total durasi. */
export function buildFormulaRules(angle: string, duration: number): string {
  const phases = FORMULA_PHASES[angle];
  if (!phases) return '';
  let prev = 0;
  const parts = phases.map(([endFrac, text]) => {
    const end = Math.max(prev + 1, Math.round(duration * endFrac));
    const out = `${text} (${prev}-${end}s)`;
    prev = end;
    return out;
  });
  return `\nFORMULA ANGLE (${angle}), total ${duration}s:\n${parts.join(' → ')}`;
}

const TIKTOK_STYLE_GUIDE: Record<string, string> = {
  ugc_handheld: 'Authentic UGC handheld smartphone camera video still, natural indoor ambient room lighting, realistic candid expression, unfiltered texture, subtle motion blur, high fidelity social media video frame.',
  iphone_pov: 'First-person POV shot on iPhone 15 Pro, creator hands holding product forward towards lens, shallow depth of field, authentic indoor home background, crisp natural lighting, sharp product label focus.',
  macro_texture: 'Extreme macro close-up (ECU) 100mm lens, showing rich tactile product texture, sensory droplets and smooth application, tactile details, crisp focus, soft natural rim light.',
  split_screen: 'TikTok split-screen vertical composition, side-by-side Before vs After visual proof, authentic real-life comparison, realistic smartphone camera texture, high contrast.',
  authentic_vlog: 'Authentic casual TikTok room vlog, genuine relatable facial expression, natural eye-level selfie perspective, soft ring light reflection in eyes, real bedroom or vanity setting.',
  commercial_studio: 'Clean minimalist modern e-commerce commercial shot, soft studio lighting, pristine aesthetic background, sharp product focus.',
};

const HOOK_PATTERN_GUIDE: Record<string, string> = {
  pattern_interrupt: 'HOOK PATTERN: Pattern Interrupt (Visual Disruption). Scene 1 MUST use sudden stop-scroll visual action (e.g. dropping/spilling demo, extreme fast zoom, sudden swatch, unexpected action) in first 2 seconds.',
  negative_fear: 'HOOK PATTERN: Negative Warning ("Jangan beli sebelum..."). Scene 1 MUST open with a warning about a common fatal mistake consumers make, stopping them from scrolling.',
  split_transformation: 'HOOK PATTERN: Instant Before vs After Split. Scene 1 MUST showcase an instant visual contrast comparing the ugly problem against the glorious result.',
  relatable_pov: 'HOOK PATTERN: Relatable Everyday POV ("POV lu pengen..."). Scene 1 MUST open with a relatable daily struggle that instantly resonates with TikTok viewers.',
  secret_unboxing: 'HOOK PATTERN: Secret / "Racun TikTok". Scene 1 MUST feel like an urgent insider secret ("Bongkar rahasia kenapa produk ini viral dan sold out terus").',
  flash_urgency: 'HOOK PATTERN: Flash Sale / Urgency Keranjang Kuning. Scene 1 MUST highlight scarcity or massive price drop ("Mumpung masih diskon 50% di keranjang kuning").',
  auto_smart: 'HOOK PATTERN: Smart TikTok Viral Hook tailored to stop-scroll in the first 2 seconds.',
};

export interface StoryboardDirectorInput {
  productName?: string;
  productDesc?: string;
  modelTalent?: string;
  bgSetting?: string;
  brief?: string;
  /**
   * Total durasi. HANYA dipakai pada mode mandiri (tanpa presetRules). Bila preset aktif,
   * durasi total mengikuti preset / durasi yang disebut di brief.
   */
  duration?: number;
  /**
   * Override eksplisit jumlah scene dari Inspector. Kosong = ikuti preset
   * (mode mandiri: dihitung dari durasi, 1 scene = 10 detik).
   */
  numScenes?: number;
  aspectRatio?: string;
  /** Hanya dipakai pada mode mandiri. Dengan preset, formula alur diatur preset. */
  formulaAngle?: string;
  /** 'preset' / kosong = ikut preset. Nilai lain = pilihan eksplisit user (menang atas gaya preset). */
  tiktokStyle?: string;
  /** 'preset' / kosong = ikut preset. Nilai lain = pilihan eksplisit user. */
  hookPattern?: string;
  lockConsistency?: boolean;
  /**
   * Teks preset yang sudah di-expand (hasil expandChatPreset). Bila ada, preset menjadi
   * sumber aturan isi dan Director hanya menambah kontrak JSON + variasi kamera + lock.
   */
  presetRules?: string;
  /** Brief sudah tertanam di presetRules ([MAIN BRIEF PENGGUNA]); jangan ditulis dua kali. */
  briefInPreset?: boolean;
  /** Teks fakta produk dari AI Worker (opsional). */
  workerContext?: string;
  /** Hasil analisis produk tahap-1 dari AI Worker (opsional). */
  workerAnalysis?: string;
  /** Adegan yang sudah ada (mode revisi, opsional). */
  existingScenes?: any[];
  /** Jumlah gambar referensi yang ikut terkirim. */
  referenceImageCount?: number;
}

/** Tebak nama produk dari brief, sama seperti ekstensi. */
export function inferStoryboardProductName(rawName: string, brief: string): string {
  let productName = (rawName || '').trim();
  if (!productName) {
    const b = (brief || '').trim();
    if (b) {
      const m = b.match(/(?:produk|iklan|jual|tentang)\s+([a-zA-Z0-9\s]{2,60})/i);
      productName = m ? m[1].trim() : b.slice(0, 35).trim();
      // Potong di kata sambung agar nama produk tidak ikut membawa sisa kalimat brief,
      // lalu buang kata pengantar "produk" dan batasi panjangnya seperti ekstensi (30 huruf).
      productName = productName.split(/\s+(?:tanpa|dengan|untuk|yang|dan|di|ke|pakai)\s+/i)[0].trim();
      productName = productName.replace(/^(?:produk|iklan|jual)\s+/i, '');
      // Berhenti di tanda baca pertama, lalu batasi 30 huruf TANPA memotong di tengah kata.
      productName = productName.split(/[,.;:\n]/)[0].trim();
      if (productName.length > 30) {
        const cut = productName.slice(0, 30);
        productName = (/\s/.test(cut) ? cut.replace(/\s+\S*$/, '') : cut).trim();
      }
    }
    if (!productName) productName = 'Produk Pilihan';
  }
  return productName;
}

/**
 * Jumlah scene default (mode mandiri). Aturan Canvas: 1 scene = 10 detik
 * (satu node video per scene), dibatasi 1-6 - sama dengan getStoryboardPlannedSceneCount.
 */
export function resolveStoryboardSceneCount(duration: number, numScenes?: number): number {
  if (numScenes && numScenes > 0) return Math.floor(numScenes);
  return Math.min(Math.max(Math.ceil(duration / 10), 1), 6);
}

/** Preset yang melarang wajah/talent tampil (faceless / hands-only). */
export function isFacelessPreset(presetRules?: string): boolean {
  const keyword = /faceless|hands[-\s]?only|tanpa\s+wajah|zero[-\s]?face|no\s+face\b/i;
  // Abaikan baris yang justru MELARANG gaya itu (mis. "JANGAN menyuntikkan gaya ... faceless ...").
  const negated = /(?:jangan|tidak\s+boleh|hindari)\b[^\n]*(?:faceless|hands[-\s]?only)|kecuali/i;
  return (presetRules || '')
    .split(/\r?\n/)
    .some((line) => keyword.test(line) && !negated.test(line));
}

/** Preset bertipe "pure brief": tidak boleh ada gaya/talent yang disuntikkan di luar brief. */
export function isPureBriefPreset(presetRules?: string): boolean {
  return /ZERO AI INJECTION|PURE MAIN BRIEF/i.test(presetRules || '');
}

/** Peran scene untuk mode mandiri (tanpa preset), mengikuti jumlah scene. */
function buildSceneRoles(n: number): Array<{ role: string; camera: string }> {
  const HOOK = { role: 'The Hook', camera: 'Dynamic stop-scroll angle (extreme close-up macro, sudden POV, atau snap zoom)' };
  const PROBLEM = { role: 'The Problem / Agitate', camera: 'Medium candid shot atau over-the-shoulder yang menunjukkan kebutuhan relatable' };
  const SOLUTION = { role: 'The Solution & Demonstration', camera: 'Close-up sensori: tekstur, swatch, atau pemakaian langsung' };
  const PROOF = { role: 'Social Proof & Transformation', camera: 'Before/After atau hasil akhir eye-level yang meyakinkan' };
  const CTA = { role: 'Call To Action', camera: 'Eye-level, produk dihadapkan ke kamera; ajakan checkout lewat voiceover' };
  if (n <= 1) return [{ role: 'Hook + Solusi + CTA dalam satu take', camera: HOOK.camera }];
  if (n === 2) return [{ ...HOOK, role: 'Hook & Problem' }, { ...SOLUTION, role: 'Solution & CTA' }];
  if (n === 3) return [HOOK, { ...SOLUTION, role: 'Solution & Proof' }, CTA];
  if (n === 4) return [HOOK, PROBLEM, { ...SOLUTION, role: 'Solution & Proof' }, CTA];
  const demos = Array.from({ length: n - 4 }, (_, i) =>
    i === 0 ? SOLUTION : { ...SOLUTION, role: `Demonstration (lanjutan ${i})` }
  );
  return [HOOK, PROBLEM, ...demos, PROOF, CTA];
}

export function buildStoryboardDirectorSystemPrompt(input: StoryboardDirectorInput): {
  systemPrompt: string;
  userPrompt: string;
  productName: string;
  sceneCount: number | null;
  duration: number | null;
} {
  const presetRules = (input.presetRules || '').trim();
  const hasPreset = presetRules.length > 0;
  const faceless = hasPreset && isFacelessPreset(presetRules);
  const pureBrief = hasPreset && isPureBriefPreset(presetRules);
  const brief = (input.brief || '').trim();
  const productName = inferStoryboardProductName(input.productName || '', brief);
  const productDesc = (input.productDesc || '').trim();
  const aspect = input.aspectRatio || '9:16';
  const lockConsistency = input.lockConsistency !== false;
  // Dengan preset, nama produk hanya dipakai bila diisi eksplisit (Inspector / AI Worker).
  // Menebak dari brief yang sudah ada di preset sering menghasilkan nama yang kacau.
  const nameKnown = Boolean((input.productName || '').trim());
  const useName = nameKnown || !hasPreset;
  const nameForPrompt = useName ? productName : 'produk pada brief / gambar referensi';
  // Dipakai di dalam prompt gambar (bahasa Inggris), jadi nama generik juga berbahasa Inggris.
  const anchorName = useName ? productName : 'the product shown in the reference images / brief';
  const safeName = useName ? productName.replace(/"/g, "'") : '<nama produk>';

  // --- Durasi & jumlah scene -------------------------------------------------
  // Dengan preset: ikut preset kecuali jumlah scene di-override eksplisit dari Inspector.
  // Mandiri: dihitung dari durasi (1 scene = 10 detik).
  const explicitSceneCount = Number(input.numScenes) > 0 ? Math.floor(Number(input.numScenes)) : 0;
  const standaloneDuration = Number(input.duration) > 0 ? Number(input.duration) : 30;
  const sceneCount: number | null = hasPreset
    ? explicitSceneCount || null
    : resolveStoryboardSceneCount(standaloneDuration, explicitSceneCount || undefined);
  const duration: number | null = hasPreset ? null : standaloneDuration;
  const perScene = !hasPreset && sceneCount ? Math.max(1, Math.round(standaloneDuration / sceneCount)) : null;

  // --- Talent / background / gaya -------------------------------------------
  const userTalent = (input.modelTalent || '').trim();
  const userBg = (input.bgSetting || '').trim();
  const talentLine = faceless
    ? 'SESUAI PRESET - faceless / hands-only, TANPA wajah atau tubuh (isian talent di Inspector diabaikan)'
    : userTalent || (hasPreset ? 'sesuai preset / brief / gambar referensi' : 'Talent Ramah Kreator TikTok Indonesia');
  const bgLine = userBg || (hasPreset ? 'sesuai preset / brief / gambar referensi' : 'Kamar Estetik / Interior Rumah Alami');

  const explicitStyle = input.tiktokStyle && input.tiktokStyle !== 'preset' ? input.tiktokStyle : '';
  const explicitHook = input.hookPattern && input.hookPattern !== 'preset' ? input.hookPattern : '';
  const styleKey = explicitStyle || (hasPreset ? '' : 'ugc_handheld');
  const hookKey = explicitHook || (hasPreset ? '' : 'auto_smart');
  const tiktokStyleGuide = styleKey ? TIKTOK_STYLE_GUIDE[styleKey] || TIKTOK_STYLE_GUIDE.ugc_handheld : '';
  const hookPatternGuide = hookKey ? HOOK_PATTERN_GUIDE[hookKey] || '' : '';

  // Formula alur hanya relevan di mode mandiri; dengan preset, alur diatur preset.
  const formulaAngle = input.formulaAngle || 'hook_extreme';
  const formulaRules = !hasPreset && formulaAngle !== 'none' ? buildFormulaRules(formulaAngle, standaloneDuration) : '';

  // --- Blok konteks ---------------------------------------------------------
  const factual = [
    input.workerContext && input.workerContext.trim()
      ? `[DATA FAKTUAL PRODUK DARI AI WORKER]\n${input.workerContext.trim()}`
      : '',
    input.workerAnalysis && input.workerAnalysis.trim()
      ? `[HASIL ANALISIS PRODUK]\n${input.workerAnalysis.trim()}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  const factualBlock = factual
    ? `\n\n${factual}\nGunakan data di atas sebagai sumber fakta produk. JANGAN mengarang klaim, harga, atau spesifikasi yang tidak didukung data.`
    : '';

  const refCount = input.referenceImageCount || 0;
  const referenceBlock =
    refCount > 0
      ? `\n\nREFERENCE IMAGES: ${refCount} gambar referensi terlampir. Amati lebih dulu dan gunakan HANYA detail yang benar-benar terlihat (bentuk, warna, kemasan, tekstur) untuk menjaga kontinuitas produk${faceless ? ' dan tangan' : '/talent'}. Jangan mengarang detail yang tidak terlihat. Tuliskan hasil pengamatan singkat di field JSON "analysis.referenceObservations" (jangan menulis prosa di luar JSON).`
      : '';

  const existingBlock =
    Array.isArray(input.existingScenes) && input.existingScenes.length > 0
      ? `\n\nEXISTING STORYBOARD (REVISION MODE):\n${JSON.stringify(
          input.existingScenes.map((s: any) => ({
            sceneNumber: s.sceneNumber,
            title: s.title,
            visualDescription: s.visualDescription,
            voiceover: s.voiceover,
            onScreenText: s.onScreenText,
            cameraAngle: s.cameraAngle,
          })),
          null,
          2
        )}\nBila brief meminta revisi, pertahankan scene yang tidak diminta berubah.`
      : '';

  // --- Spesifikasi -----------------------------------------------------------
  const specLines: string[] = [
    `- PRODUCT: ${nameForPrompt} (${productDesc || 'High quality commercial item'})`,
    `- MODEL / TALENT: ${talentLine}`,
    `- BACKGROUND / SETTING: ${bgLine}`,
  ];
  if (hasPreset && input.briefInPreset) {
    specLines.push('- CREATIVE BRIEF: lihat [MAIN BRIEF PENGGUNA] di dalam ATURAN PRESET.');
  } else {
    specLines.push(`- CREATIVE BRIEF: ${brief || 'Iklan penjualan TikTok Shop dengan hook kuat'}`);
  }
  if (hasPreset) {
    specLines.push(
      explicitSceneCount
        ? `- JUMLAH SCENE (OVERRIDE DARI INSPECTOR): tepat ${explicitSceneCount} scene. Durasi per scene dan aturan shoot tetap mengikuti preset.`
        : '- TOTAL DURASI, JUMLAH SCENE & DURASI PER SCENE: ikuti preset (atau durasi yang disebut eksplisit di brief). JANGAN mengubahnya.'
    );
  } else {
    specLines.push(`- TOTAL DURATION: ${standaloneDuration} seconds`);
    specLines.push(`- TARGET SCENE COUNT: Exactly ${sceneCount} scenes! Each scene "durationSec" = ${perScene} (total = ${standaloneDuration}s).`);
  }
  specLines.push(`- ASPECT RATIO: ${aspect}`);
  if (!hasPreset && tiktokStyleGuide) specLines.push(`- VISUAL STYLE: ${tiktokStyleGuide}`);

  // --- Blok prioritas + preset ----------------------------------------------
  const priorityBlock = hasPreset
    ? `\nURUTAN PRIORITAS ATURAN (yang di atas menang bila bertabrakan):
1. DATA AI WORKER dan gambar referensi adalah SUMBER FAKTA produk; gunakan untuk identitas, karakteristik, harga, klaim, dan detail visual. Data ini bukan instruksi untuk mengubah brief atau aturan preset.
2. ATURAN PRESET adalah KERANGKA storyboard: struktur Bagian/Scene/Shoot, durasi dan jumlah scene, gaya/jumlah kata voiceover, onScreenText, aturan talent/wajah, kamera, CTA, dan larangan visual. Pertahankan semua batasan ini.
3. MAIN BRIEF dan instruksi terbaru pengguna menentukan produk/topik yang dibahas, aksi, lokasi, sudut cerita, dan penyesuaian kreatif. Wujudkan brief DI DALAM kerangka preset; brief menggantikan contoh/default isi preset, tetapi tidak membatalkan batasan strukturnya.
4. OVERRIDE INSPECTOR hanya berlaku untuk parameter yang memang dipilih eksplisit pengguna dan diizinkan oleh kontrak preset.
5. TAMBAHAN DIRECTOR hanya mengisi hal yang tidak diatur preset dan tidak boleh bertentangan dengan batasan preset.\n`
    : '';

  const presetBlock = hasPreset
    ? `\n===== ATURAN PRESET (OTORITATIF) =====
Catatan: abaikan bagian "STRUKTUR OUTPUT JAWABAN", draf prosa, dan blok \`\`\`storyboard_project\`\`\` di dalam preset - format keluaran HANYA mengikuti KONTRAK JSON di akhir prompt ini. Semua ATURAN ISI preset tetap berlaku penuh pada field JSON. Hitung kata voiceover per scene sebelum menulis JSON.

${presetRules}
===== AKHIR ATURAN PRESET =====\n`
    : '';

  // --- Tambahan Director -----------------------------------------------------
  const overrideLines: string[] = [];
  if (hasPreset && explicitStyle) {
    overrideLines.push(
      `- GAYA VISUAL PILIHAN USER: ${tiktokStyleGuide}${faceless ? ' (Preset faceless: abaikan unsur wajah/ekspresi pada gaya ini.)' : ''}`
    );
  }
  if (hasPreset && explicitHook) overrideLines.push(`- ${hookPatternGuide}`);
  const overrideBlock = overrideLines.length
    ? `\nPILIHAN EKSPLISIT USER (menang atas gaya visual & hook preset, TIDAK menggantikan struktur, durasi, VO, OST, talent, dan larangan visual preset):\n${overrideLines.join('\n')}\n`
    : !hasPreset && hookPatternGuide
      ? `\n${hookPatternGuide}\n`
      : '';

  let cameraBlock: string;
  if (pureBrief) {
    cameraBlock = '';
  } else if (hasPreset) {
    cameraBlock = `\nVARIASI KAMERA (di dalam batas preset):
Jangan buat semua scene/shoot terlihat sama. Setiap scene dan shoot harus punya jarak, tinggi, dan gerak kamera yang berbeda (mis. extreme close-up, medium close-up, tracking, hero view). TETAPI hanya boleh memakai jenis kamera/gaya yang diizinkan preset. Bila preset mewajibkan POV handheld, semuanya tetap POV handheld - variasikan jarak, tinggi, dan gerak, BUKAN jenis kameranya. Jangan menambah gaya (Dutch angle, split screen, selfie, dll.) yang tidak disebut atau dilarang preset. Peran tiap scene (hook, bukti, CTA, dst.) mengikuti struktur preset.\n`;
  } else {
    const roles = buildSceneRoles(sceneCount || 1);
    cameraBlock = `\nANTI-REPETITION & CAMERA VARIATION RULES (STRICTLY REQUIRED):
DO NOT make every scene look the same! Each scene MUST use a DIFFERENT camera angle and camera distance suited for TikTok:
${roles.map((r, idx) => `- Scene ${idx + 1} (${r.role}): ${r.camera}`).join('\n')}\n`;
  }

  let consistencyBlock = '';
  if (lockConsistency) {
    if (pureBrief) {
      consistencyBlock = `\nCONSISTENCY SPECIFICATION:
Jaga konsistensi produk antar scene: setiap "imagePrompt" menyelipkan "[PRODUCT ANCHOR: identical packaging, shape, and colors of ${anchorName}]". Preset ini "pure brief": JANGAN menambah talent, gaya, atau elemen visual yang tidak diminta di brief.\n`;
    } else if (faceless) {
      consistencyBlock = `\nCONSISTENCY SPECIFICATION:
Jaga konsistensi 100% antar scene untuk produk/tanaman dan tangan talent. Setiap "imagePrompt" WAJIB menyelipkan:
"[PRODUCT ANCHOR: identical packaging/plant variety, shape, and colors of ${anchorName}]"
"[HAND LOCK: same soft feminine hands, same skin tone and nail style - NO face, NO head, NO body]"
di dalam gaya prompt gambar preset, tanpa menghapus bagian wajib preset (kamera/lensa, larangan visual). DILARANG membuat CHARACTER LOCK yang menyebut wajah, rambut, atau outfit.\n`;
    } else {
      const who = userTalent || 'the same talent as in the reference images / Scene 1';
      consistencyBlock = `\nCONSISTENCY SPECIFICATION:
Maintain 100% visual consistency for talent and product across all scenes!
Every scene's "imagePrompt" MUST embed:
"[CHARACTER LOCK: identical model ${who}, same facial structure, hair, and outfit]"
"[PRODUCT ANCHOR: identical packaging, branding, colors of ${anchorName}]"
${hasPreset ? 'di dalam gaya prompt gambar preset, tanpa menghapus bagian wajib preset (kamera/lensa, larangan visual).' : 'alongside the specific dynamic camera angle and action.'}\n`;
    }
  }

  const voOstBlock = hasPreset
    ? `\nVOICEOVER & ON-SCREEN TEXT RULES:
- Voiceover: bahasa, gaya, dan JUMLAH KATA per scene mengikuti preset (field "voiceover" = gabungan VO semua shoot dalam scene tersebut).
- onScreenText: ikuti preset. Bila preset tidak menyebutnya, default KOSONG (""). Jangan menambah teks layar, slogan, atau emoji sendiri.
- Bila onScreenText kosong, setiap "imagePrompt" wajib memuat larangan teks sesuai template preset (no text, no title, no watermark, dst.).`
    : `\nVOICEOVER & ON-SCREEN TEXT RULES:
- Voiceover (VO): Natural, authentic, conversational Indonesian TikTok creator narration. Casual, engaging. NO formal television announcer tone!
- OnScreenText (OST): Punchy 3-5 words bold TikTok hook text overlay with high-CTR emojis (e.g. "JANGAN BELI DULU ❌", "HASILNYA GILA BANGET 😱").
- CRITICAL NO-TEXT RULE: If the creative brief or user mentions "tanpa teks", "tidak ada teks", "no text", or if "onScreenText" is empty (""), you MUST set "onScreenText": "" AND every scene's "imagePrompt" MUST end with ", clean photography, pure visual only, no text, no title, no typography, no banner, no words, no watermark, no overlays, no graphic stickers". NEVER put marketing slogans or exclamation marks in "imagePrompt"!
- "Keranjang kuning" hanya boleh muncul di voiceover, JANGAN divisualkan sebagai objek/ikon.`;

  // --- Kontrak JSON ----------------------------------------------------------
  const durHint = hasPreset ? '<durasi scene dalam detik, sesuai preset>' : String(perScene);
  const totalHint = hasPreset ? '<total durasi detik, sesuai preset>' : String(standaloneDuration);
  const jsonContract = `\nCRITICAL OUTPUT REQUIREMENT:
Respond ONLY with valid raw JSON without conversational filler, prose drafts, or markdown codeblocks.${
    hasPreset
      ? ' Field tambahan yang diminta preset (parts, shoots, start/end, voInstruction, videoInstruction, visualStyle, voiceoverStyle, formula, preset) WAJIB tetap dikeluarkan dengan nama yang sama.'
      : ''
  }
{
  "metadata": {
    "title": "${safeName}",
    "duration": ${totalHint},
    "aspectRatio": "${aspect}"
  },
  "analysis": {
    "hookAnalysis": "Penjelasan hook visual di awal video.",
    "productOrTopicName": "${safeName}",
    "coreUSPs": ["USP 1", "USP 2", "USP 3"],
    "visualProofStrategy": "Strategi pembuktian visual nyata di video.",
    "callToActionAnalysis": "Strategi CTA sesuai preset."${refCount > 0 ? ',\n    "referenceObservations": "Detail produk yang benar-benar terlihat di gambar referensi."' : ''}
  },
  "masterProductionSheetPrompt": "Master visual production sheet multi-panel; patuhi aturan talent & larangan visual preset.",
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Scene 1: <peran scene>",
      "timecode": "<akumulatif, mis. 00:00 - 00:10; scene berikutnya melanjutkan dari akhir scene sebelumnya>",
      "durationSec": ${durHint},
      "cameraAngle": "<sudut & jarak kamera scene ini>",
      "visualDescription": "<aksi visual scene ini>",
      "voiceover": "<naskah VO scene ini, sesuai aturan preset>",
      "onScreenText": "<sesuai preset; default kosong>",
      "imagePrompt": "<prompt gambar scene ini, ${aspect}${lockConsistency ? ', memuat lock konsistensi' : ''}, ikuti template prompt gambar preset>",
      "videoPrompt": "<prompt video AI scene ini>",
      "shoots": [
        { "shootNumber": 1, "start": 0, "end": 3, "visualDescription": "", "action": "", "cameraAngle": "", "voiceover": "", "continuity": "" }
      ]
    }
  ]
}
${hasPreset ? 'Field "shoots" WAJIB diisi (sub-shot di dalam scene) bila preset memakai hierarki Bagian > Scene > Shoot; selain itu boleh dihilangkan.' : 'Field "shoots" boleh dihilangkan.'}`;

  const systemPrompt = `You are a master TikTok/Reels creative director, e-commerce content strategist, and world-class AI video prompt engineer specializing in high-converting viral TikTok Shop funnels for AMB Media V3.
Your task is to construct a professional, high-converting multi-scene storyboard that drives massive engagement and sales on TikTok!
${priorityBlock}
CRITICAL SPECIFICATIONS:
${specLines.join('\n')}
${formulaRules}${presetBlock}${overrideBlock}${cameraBlock}${consistencyBlock}${voOstBlock}${factualBlock}${referenceBlock}${existingBlock}
${jsonContract}`;

  const userPrompt = hasPreset
    ? `CRITICAL: Generate the structured JSON storyboard now for ${nameForPrompt}. Ikuti ATURAN PRESET untuk durasi, jumlah scene${explicitSceneCount ? ` (tepat ${explicitSceneCount} scene)` : ''}, shoot, dan voiceover. Return ONLY a valid JSON object with the "scenes" array.`
    : `CRITICAL: Generate the structured JSON storyboard now for ${productName} (${standaloneDuration}s, ${sceneCount} scenes). Return ONLY valid JSON object with the "scenes" array.`;

  return { systemPrompt, userPrompt, productName, sceneCount, duration };
}
