// context-builder.js - Canonical Conversation Context Builder (CHAT V2)
// Builds normalized conversation context for any execution provider (Gemini, Dola, Weavy)
// Rule: ONE SESSION = ONE CONTINUOUS CONVERSATION

import { buildSessionMediaCatalog, detectEcommerceProductLinks } from './chat-media.js';
import { expandChatPreset } from './chat-presets.js';

/**
 * Builds the unified Master Creative Director System Instruction for Sidepanel Chat
 */
export function getMasterDirectorSystemPrompt({ provider = 'weavy', isStoryboardActive = false, sessionMediaCatalog = null, scrapingContext = null } = {}) {
  const providerName = provider === 'gemini' ? 'Google Gemini' : (provider === 'dola' ? 'Dola AI' : 'Weavy AI');
  let base = `[System Instruction: Elite Commercial Video Director & Creative Visual Architect]
Peran: Anda adalah Sutradara Kreatif Komersial & Ahli Prompt Visual untuk ${providerName}.
Gaya Bicara: Bahasa Indonesia santai, akrab ("bro"), solutif, percaya diri, dan LANGSUNG KE INTI TANPA BASA-BASI / TANPA KATA SAMBUTAN PANJANG.

PEDOMAN PERILAKU ARSITEKTUR KELAS PENGGUNA (USER-FIRST ARCHITECTURE):

1. FORMAT VERTIKAL RAMAH LAYAR SEMPIT (SIDEPANEL FRIENDLY - ZERO WIDE TABLES):
- Panel samping ekstensi berukuran sempit (~380px). DILARANG KERAS membuat tabel markdown lebar dengan 4+ kolom karena terpotong dan memaksa scroll horizontal yang melelahkan.
- Gunakan format KARTU SCENE VERTIKAL BERSIH:
  🎬 **Scene 1 (0–3s): Hook Pembuka**
  • 🎥 **Shot:** Close-up / Fast Push-in
  • 🖼️ **Visual:** [Deskripsi pencahayaan, tekstur kain/material, gerakan kamera]
  • 🎙️ **Voiceover (VO):** "[Kata-kata narasi yang diucapkan talent]"
  • ⚡ **Gerakan/Aksi:** [Arah gerak objek atau pivot kamera]
  *(CATATAN KHUSUS TEKS LAYAR: Dilarang menyertakan poin "Teks Layar" kecuali jika pengguna secara eksplisit meminta ada teks/tulisan di layar).*
- Pisahkan antar adegan dengan penomoran rapi dan baris kosong. Dilarang memakai hashtag heading (#, ##, ###) atau garis horizontal (---) yang membuat tampilan kotor.

2. ATURAN DEFAULT TEKS DI LAYAR (NO ON-SCREEN TEXT BY DEFAULT):
- Secara default, JANGAN PERNAH membuat teks di layar (onScreenText). Biarkan kosong ("") kecuali jika pengguna secara eksplisit meminta ("tambahkan teks di layar", "dengan caption teks", "sertakan onScreenText").
- Video iklan modern TikTok/Reels mengutamakan visual murni yang bersih tanpa elemen grafis teks yang menumpuk.
- Pada blok JSON storyboard_project: jika pengguna TIDAK meminta teks di layar, nilai "onScreenText" WAJIB diisi string kosong "".

3. ATURAN OUTPUT RESPON: ANALISIS VIDEO VS PEMBUATAN STORYBOARD
A. MODE ANALISIS & BEDAH VIDEO (PURE VIDEO ANALYSIS & AUDIT):
- Jika pengguna meminta analisis, review, evaluasi, bedah hook, atau riset konten dari video/tautan yang dilampirkan (contoh: "analisis video ini", "bedah hook-nya", "kenapa video ini bisa viral", "evaluasi pacing"):
  ❌ DILARANG KERAS menyuntikkan blok JSON \`\`\`storyboard_project ... \`\`\` secara otomatis!
  ✅ Berikan Analisis Terstruktur yang Tajam & Profesional:
     1. ⏱️ **Durasi Asli & Struktur Video**: Sebutkan durasi nyata video yang dianalisis (misal: "Durasi Asli: 28 Detik").
     2. 🪝 **Bedah Hook 3 Detik Pertama**: Analisis visual hook, auditory trigger, dan pemicu rasa penasaran penonton.
     3. 🎬 **Scene Breakdown Riil**: Uraikan alur berdasarkan timeline detik/menit nyata video (contoh: 0:00–0:04, 0:04–0:16, 0:16–0:28).
     4. 💡 **Pacing, Copywriting & Visual Hook**: Evaluasi transisi, sudut kamera, dan kejelasan pesan.
     5. 📈 **Insight & Rekomendasi Improvisasi**: Poin-poin kunci yang bisa ditiru atau ditingkatkan.

B. MODE PEMBUATAN STORYBOARD (STORYBOARD GENERATION & RECONSTRUCTION):
- Jika pengguna SECARA EKSPLISIT meminta pembuatan storyboard, konsep naskah iklan, atau menggunakan preset (/storyboard, /copilotstoryboard, /customstoryboard):
  ✅ WAJIB SELALU sertakan blok JSON \`\`\`storyboard_project ... \`\`\` di akhir pesan Anda.
  ⚠️ ATURAN DURASI NYATA (REAL DURATION MATCHING - ANTI-DEFAULT 15s UNTUK VIDEO NYATA):
     - Jika storyboard dibuat berdasarkan video nyata yang diunggah / dianalisis, DURASI TOTAL ("duration") dan DURASI PER SCENE ("durationSec") WAJIB 100% MENYESUAIKAN DENGAN DURASI AKTUAL VIDEO TERSEBUT (contoh: jika video asli berdurasi 9 detik -> total 9 detik; jika 32 detik -> total 32 detik dengan pembagian scene yang setia pada video aslinya).
     - JANGAN PERNAH memaksa default 15 detik jika video referensi memiliki durasi nyata yang berbeda!
     - Hanya gunakan formula default 15 detik jika pengguna merancang storyboard konsep baru dari nol tanpa ada video referensi dan tanpa menyebutkan durasi spesifik.
  - Ini otomatis membuat UI menampilkan tombol interaktif:
    👉 [🎬 Kirim ke Storyboard] (satu klik langsung buka di editor scene)
    👉 [📋 Salin Naskah]
    👉 [Salin JSON]

- Jika Anda menyarankan prompt gambar atau konsep foto produk/talent/karakter visual, WAJIB SELALU bungkus prompt gambar dalam blok format \`\`\`weavy_generate\`\`\`:
\`\`\`weavy_generate
{
  "prompt": "Shot on Hasselblad X2D 100C, 50mm lens f/2.8, [deskripsi pencahayaan, tekstur mikro kain/kulit, framing, detail visual otentik]",
  "aspect_ratio": "9:16",
  "model": "seedream_v5_pro_edit"
}
\`\`\`
Ini WAJIB agar di UI Chat langsung otomatis muncul Kartu Generasi Interaktif (Weavy Image Generation Card) dengan tombol [✨ Generate Gambar (Seedream V5)] dan [↗️ Buka di Generator] sehingga pengguna bisa langsung mengklik generate 1-klik tanpa repot menyalin manual!

4. INGATAN VISUAL KONTEKSTUAL LENGKET (SMART VISUAL MEMORY & CONVERSATION CONTINUITY):
- Setiap gambar atau video yang pernah dikirim di sesi percakapan ini (@img1, @img2, dst.) WAJIB Anda ingat detail visualnya (warna produk, bahan pakaian, gaya talent, pencahayaan, latar belakang).
- Percakapan ini adalah SATU percakapan berkelanjutan. Anda memiliki akses penuh terhadap seluruh riwayat percakapan sebelumnya (meskipun turn sebelumnya dieksekusi oleh model atau provider lain).
- Jika pengguna bertanya: "buatkan adegan lanjutannya", "ganti latarnya ke pantai", atau "bagaimana kalau talent-nya senyum", DILARANG meminta pengguna mengunggah foto ulang! Gunakan ingatan visual dari media sesi sebelumnya secara konsisten dan pertahankan ciri khas produk/model tersebut.

5. EKSEKUSI INSTAN TANPA PERTANYAAN AWAL (DIRECT GENERATION):
- Jangan menahan proses dengan bertanya opsi atau klarifikasi berbelit-belit. Model sudah dipilih pengguna, langsung eksekusi hasil terbaik, detail, dan tuntas!

6. REALISME VISUAL KAMERA NYATA (ANTI-CGI CLICHE):
- Dilarang kata klise: "photorealistic", "hyperrealistic", "8k", "unreal engine", "octane render".
- Wajib gunakan optik nyata: Shot on Sony Alpha A7 IV / Hasselblad X2D 100C, 35mm/50mm lens f/2.8, natural warm bounce light, authentic micro fabric texture, soft delicate feminine hands (anti-vascularity).

7. FORMULA DURASI & HOOK PENONTON TIKTOK / REELS:
- 0–3 detik: Hook visual & auditory ekstrem (texture zoom, curiosity trigger, motion burst).
- 3–6 detik: Value proposition & fit showcase.
- 6–12 detik: Detail USP & problem solving.
- 12–15 detik: Call to action (CTA) & hero finish.`;

  if (isStoryboardActive) {
    base += `\n\n[STORYBOARD COPILOT DIRECTOR MODE ACTIVE]
Rancang alur adegan (scene breakdown), hook pembuka memikat 3 detik pertama, visual detail, naskah voiceover (VO), dan camera angle.
INGAT: onScreenText secara default WAJIB "" (kosong) kecuali jika user secara eksplisit meminta teks di layar.
SELALU sertakan blok JSON aksi di akhir jawaban dalam format:
\`\`\`storyboard_project
{
  "title": "<Judul Video / Storyboard>",
  "productName": "<Nama Produk/Topik>",
  "productDesc": "<Deskripsi Singkat>",
  "duration": 15,
  "numScenes": 4,
  "aspectRatio": "9:16",
  "formula": "hook_extreme",
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "<Nama Scene 1 - Hook Opening>",
      "visualDescription": "<Deskripsi visual detail>",
      "voiceover": "<Naskah suara narasi>",
      "onScreenText": "",
      "cameraAngle": "Close-up / Dynamic Shot"
    }
  ]
}
\`\`\``;
  }

  if (sessionMediaCatalog && Array.isArray(sessionMediaCatalog.mediaList) && sessionMediaCatalog.mediaList.length > 0) {
    base += `\n\n[KATALOG RESMI MEDIA SESI INI (@imgX & @vidX)]\n`;
    sessionMediaCatalog.mediaList.forEach((m) => {
      const durStr = m.duration ? ` (Durasi Asli: ${Math.round(m.duration)} detik)` : (m.type === 'video' ? ' (Video Media)' : '');
      base += `- ${m.key}: ${m.type === 'video' ? 'Video' : 'Foto'} "${m.name}"${durStr}\n`;
    });
    base += `Aturan Repost: Jika user meminta melihat media lama, sertakan tag [weavy_repost:${sessionMediaCatalog.mediaList[0]?.key || '@img1'}] agar dimunculkan di UI tanpa kredit.\n`;
  }

  if (scrapingContext && scrapingContext.trim()) {
    base += `\n\n[LIVE E-COMMERCE & VIDEO CONTENT METADATA]\n${scrapingContext.trim()}\n` +
      `WAJIB sertakan blok JSON product_card di baris paling awal respon Anda:\n` +
      `\`\`\`product_card\n` +
      `{\n` +
      `  "title": "Nama Produk Lengkap / Judul Konten",\n` +
      `  "store": "Nama Toko / Kreator",\n` +
      `  "platform": "Tokopedia / TikTok Shop",\n` +
      `  "description": "Rangkuman spesifikasi dan keunggulan utama...",\n` +
      `  "price": "Nominal Harga Riil (contoh: Rp 24.500)",\n` +
      `  "usps": ["Keunggulan 1", "Keunggulan 2", "Keunggulan 3"],\n` +
      `  "thumbnail_url": "${sessionMediaCatalog?.mediaList?.[0]?.url || ''}",\n` +
      `  "images": ${JSON.stringify(sessionMediaCatalog?.mediaList?.filter(m => m.type === 'image').slice(0, 6).map(m => ({ url: m.url, title: m.name })) || [])}\n` +
      `}\n` +
      `\`\`\``;
  }

  return base;
}

/**
 * Builds the Normalized Conversation Context from the Canonical Session.
 * Ensures complete history continuity regardless of provider switches.
 */
export function buildNormalizedConversationContext({
  session,
  currentTurnUserMsg,
  provider = 'weavy',
  model = null,
  scrapingContext = null,
  isStoryboardCopilotActive = false,
  libraryKnowledgePrompt = '',
}) {
  if (!session) {
    throw new Error('Session is required to build conversation context');
  }

  const rawMessages = Array.isArray(session.messages) ? session.messages : [];
  const conversationId = session.id;

  // Build complete session media catalog (aggregates all uploaded & attached images/videos in session)
  const sessionMediaCatalog = buildSessionMediaCatalog(session, currentTurnUserMsg?.attachments || []);
  const mediaMap = sessionMediaCatalog?.mediaMap || {};

  // Extract clean history messages excluding placeholder typing loaders and the current user message
  const historyMessages = [];
  for (const m of rawMessages) {
    if (!m) continue;
    // Skip if it's the exact current turn user message (will be handled as current turn prompt)
    if (currentTurnUserMsg && m.id === currentTurnUserMsg.id) continue;

    // Skip failed execution error messages from conversation history transcript
    if (m.isError || m.execution?.status === 'failed') continue;

    // Clean placeholder / typing loader content from assistant
    let cleanContent = (m.content || '').trim();
    if (m.role === 'assistant') {
      if (cleanContent === '[chat_typing_loader]' || cleanContent.startsWith('[typing_status:')) {
        continue;
      }
      // Strip internal status tags if any
      cleanContent = cleanContent.replace(/\[typing_status:[^\]]*\]/g, '').replace(/\[chat_typing_loader\]/g, '').trim();
    }

    if (!cleanContent && (!m.attachments || m.attachments.length === 0) && !m.extractedProducts) {
      continue;
    }

    historyMessages.push({
      id: m.id,
      role: m.role === 'user' ? 'user' : 'assistant',
      content: cleanContent,
      timestamp: m.timestamp || null,
      attachments: Array.isArray(m.attachments) ? m.attachments : [],
      extractedProducts: Array.isArray(m.extractedProducts) ? m.extractedProducts : [],
      videoPreviews: Array.isArray(m.videoPreviews) ? m.videoPreviews : [],
      execution: m.execution || {
        provider: m.modelDisplayName?.toLowerCase().includes('dola') ? 'dola' : (m.modelDisplayName?.toLowerCase().includes('gemini') ? 'gemini' : 'weavy'),
        model: m.modelDisplayName || null,
      },
    });
  }

  // Current turn text and attachments
  const currentText = currentTurnUserMsg?.content || '';
  const currentAttachments = Array.isArray(currentTurnUserMsg?.attachments) ? currentTurnUserMsg.attachments : [];

  // Multimodal assets to pass for the current turn
  const seenImgKeys = new Set();
  const currentTurnMedia = currentAttachments.filter(a => a.type === 'image' || a.type === 'video' || a.base64 || a.url);
  const imagesToPass = [];

  for (const img of currentTurnMedia) {
    const key = img.url || img.base64 || img.id || (img.name ? `${img.name}_${img.size || ''}` : JSON.stringify(img));
    if (!seenImgKeys.has(key)) {
      seenImgKeys.add(key);
      imagesToPass.push(img);
    }
  }

  // Smart Visual Memory for Contextual Follow-ups
  const isContextualVisualFollowup =
    currentTurnMedia.length === 0 &&
    sessionMediaCatalog &&
    Array.isArray(sessionMediaCatalog.mediaList) &&
    sessionMediaCatalog.mediaList.length > 0 &&
    (/(ini|tadi|tersebut|gambar|foto|video|produk|baju|model|talent|warna|adegan|scene|scene\s*\d|lanjut|ubah|ganti|tambah|kurang|gerak|angle|kamera|naskah|storyboard)/i.test(currentText) ||
      rawMessages.length <= 4);

  if (isContextualVisualFollowup) {
    const previousImages = sessionMediaCatalog.mediaList.filter((m) => m.type !== 'video').slice(0, 3);
    previousImages.forEach((prevItem) => {
      const k = prevItem.url || prevItem.base64;
      if (k && !seenImgKeys.has(k)) {
        seenImgKeys.add(k);
        imagesToPass.push({
          type: 'image',
          name: prevItem.name || 'Foto Sesi Sebelumnya',
          url: prevItem.url,
          base64: prevItem.base64,
          tagKey: prevItem.key,
          referenceRole: 'session_memory',
        });
      }
    });
  }

  // Check mentioned media tags (@img1, @vid1, etc.)
  const mentionedTags = (currentText.match(/@(img|vid)\d+/gi) || []).map((t) => t.toLowerCase());
  let mediaTagContext = '';
  if (mentionedTags.length > 0) {
    const tagDescriptions = [];
    for (const tag of mentionedTags) {
      const matchedItem = mediaMap[tag];
      if (matchedItem) {
        const itemTypeLabel = matchedItem.type === 'video' ? 'Video' : 'Gambar';
        tagDescriptions.push(`• Tag "${matchedItem.key}": ${itemTypeLabel} "${matchedItem.name || 'Aset terlampir'}"`);

        if ((matchedItem.url || matchedItem.base64) && matchedItem.type !== 'video') {
          const k = matchedItem.url || matchedItem.base64;
          if (!seenImgKeys.has(k)) {
            seenImgKeys.add(k);
            imagesToPass.push({
              type: 'image',
              name: matchedItem.name || tag,
              url: matchedItem.url,
              base64: matchedItem.base64,
              tagKey: matchedItem.key || tag,
              referenceRole: 'tagged_context',
            });
          }
        }
      }
    }

    if (tagDescriptions.length > 0) {
      mediaTagContext = `[PANDUAN REFERENSI MEDIA]:\nPengguna mereferensikan aset visual yang telah diunggah sebelumnya dalam percakapan:\n${tagDescriptions.join('\n')}\nInstruksi AI: Pahami bahwa tag di atas (seperti @img1, @img2) merujuk langsung ke aset visual tersebut. Analisis dan jawab instruksi pengguna sesuai dengan konten visual dari tag yang dirujuk.`;
    }
  } else if (isContextualVisualFollowup && imagesToPass.length > 0) {
    mediaTagContext = `[INGATAN VISUAL KONTEKSTUAL OTOMATIS]:\nPengguna sedang menanyakan atau melanjutkan instruksi terkait aset visual yang telah diunggah sebelumnya dalam sesi ini.\nAI wajib mengingat karakteristik visual objek/model/produk dari aset sesi ini secara konsisten tanpa meminta pengguna mengunggah ulang.`;
  }

  // Generate Master System Instruction
  let systemPrompt = getMasterDirectorSystemPrompt({
    provider,
    isStoryboardActive: isStoryboardCopilotActive,
    sessionMediaCatalog,
    scrapingContext,
  });

  if (libraryKnowledgePrompt && libraryKnowledgePrompt.trim()) {
    systemPrompt = `${systemPrompt}\n\n${libraryKnowledgePrompt.trim()}`;
  }

  // Build the complete prompt text with presets expanded
  let expandedPrompt = expandChatPreset(currentText, provider);
  if (mediaTagContext) {
    expandedPrompt = `${mediaTagContext}\n\n${expandedPrompt}`;
  }

  return {
    conversationId,
    sessionTitle: session.title || 'Percakapan',
    systemPrompt,
    currentPrompt: expandedPrompt,
    rawUserText: currentText,
    historyMessages,
    mediaCatalog: sessionMediaCatalog,
    referenceAssets: imagesToPass,
    providerRuntime: session.providerRuntime || {},
    metadata: {
      isStoryboardCopilotActive,
      scrapingContext,
      provider,
      model,
      createdAt: session.createdAt,
      messageCount: historyMessages.length,
      assetCount: imagesToPass.length,
    },
  };
}

/**
 * Builds a clean unified text transcript from conversation history for text-first providers
 */
export function buildHistoryTranscript(historyMessages = []) {
  if (!Array.isArray(historyMessages) || historyMessages.length === 0) return '';
  const lines = [];
  for (const m of historyMessages) {
    const roleLabel = (m.role === 'assistant' || m.role === 'model') ? 'Assistant' : 'User';
    let c = m.content || '';
    if (Array.isArray(m.attachments) && m.attachments.length > 0) {
      for (const att of m.attachments) {
        if (att && (att.type === 'image' || att.url || att.base64)) {
          c += `\n[Lampiran Gambar "${att.name || 'Foto'}" disertakan]`;
        } else if (att && att.type === 'video') {
          c += `\n[Lampiran Video "${att.name || 'Video'}" disertakan]`;
        }
      }
    }
    if (c.trim()) {
      lines.push(`${roleLabel}: ${c.trim()}`);
    }
  }
  return lines.join('\n\n');
}
