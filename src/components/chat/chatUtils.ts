import { ChatMessage, ChatAttachment } from "../../types";
import { WeavyActionData } from "./WeavyActionCard";
import { WEAVY_IMAGE_MODELS } from "../../types/canvas";
import { cleanPlainText } from "./CleanMessageRenderer";
import { extensionBridge } from "../../lib/extensionBridge";

export interface SessionImageItem {
  index: number;
  url: string;
  prompt?: string;
  model?: string;
  label: string;
}

export interface SessionVideoItem {
  index: number;
  url: string;
  playbackUrl?: string;
  coverUrl?: string;
  title?: string;
  author?: string;
  duration?: number | string;
  sourceUrl?: string;
  fallbackNote?: string;
  label: string;
  tag: string;
}

// Collects all images generated or uploaded in this chat session with chronological index #1, #2...
export function getAllSessionImages(messages: ChatMessage[]): SessionImageItem[] {
  const list: SessionImageItem[] = [];
  let counter = 1;
  for (const m of messages) {
    // 1. User uploaded attachments for this turn in chronological order
    if (Array.isArray(m.attachments)) {
      for (const att of m.attachments) {
        const url = att?.url || att?.base64;
        // Don't include video attachments in image session list
        const isVid =
          att?.type === "video" ||
          Boolean(att?.playbackUrl) ||
          Boolean(att?.name?.match(/\.(mp4|webm|mov|mkv|m4v)$/i));
        if (att && url && !isVid && (att.type === "image" || att.name?.match(/\.(png|jpe?g|webp|gif|bmp|svg)$/i))) {
          list.push({
            index: counter,
            url: url,
            prompt: att.name || `Foto Referensi dari Pengguna #${counter}`,
            label: `Gambar ke-${counter}`,
          });
          counter++;
        }
      }
    }
    // 2. Output images generated in this turn
    if (m.weavyAction?.resultUrl) {
      list.push({
        index: counter,
        url: m.weavyAction.resultUrl,
        prompt: m.weavyAction.prompt,
        model: m.weavyAction.model || "Seedream V5.0 Pro Edit",
        label: `Gambar ke-${counter}`,
      });
      counter++;
    } else if (m.generatedImage?.url) {
      list.push({
        index: counter,
        url: m.generatedImage.url,
        prompt: m.generatedImage.prompt,
        model: m.generatedImage.modelName || "Weavy Image",
        label: `Gambar ke-${counter}`,
      });
      counter++;
    }
  }
  return list;
}

// Collects all video attachments extracted, uploaded, or generated in this chat session with chronological index #1, #2...
export function getAllSessionVideos(messages: ChatMessage[]): SessionVideoItem[] {
  const list: SessionVideoItem[] = [];
  let counter = 1;
  for (const m of messages) {
    // 1. User uploaded or scraped video attachments
    if (Array.isArray(m.attachments)) {
      for (const att of m.attachments) {
        const isVid =
          att?.type === "video" ||
          Boolean(att?.playbackUrl) ||
          Boolean(att?.fallbackNote) ||
          Boolean(att?.name?.match(/\.(mp4|webm|mov|mkv|m4v)$/i)) ||
          Boolean(att?.url?.match(/\.(mp4|webm|mov|mkv|m4v)(\?.*)?$/i));
        if (att && isVid) {
          const mainUrl = att.playbackUrl || att.url || att.base64 || "";
          if (mainUrl || att.coverUrl || att.fallbackNote) {
            // Avoid duplicate entry if this attachment URL is already registered in this message turn
            if (!list.some((existing) => existing.url === mainUrl && existing.url !== "")) {
              list.push({
                index: counter,
                url: mainUrl,
                playbackUrl: att.playbackUrl || mainUrl,
                coverUrl: att.coverUrl,
                title: att.title || att.name || `Video #${counter}`,
                author: att.author,
                duration: att.duration,
                sourceUrl: att.sourceUrl,
                fallbackNote: att.fallbackNote,
                label: `Video ke-${counter}`,
                tag: `@vid${counter}`,
              });
              counter++;
            }
          }
        }
      }
    }
    // 2. Output videos generated in this turn (from Vid mode / RunningHub / AI)
    if (m.generatedVideo && (m.generatedVideo.status === "completed" || m.generatedVideo.url)) {
      const vidUrl = m.generatedVideo.url || "";
      if (vidUrl && !list.some((existing) => existing.url === vidUrl)) {
        list.push({
          index: counter,
          url: vidUrl,
          playbackUrl: vidUrl,
          coverUrl: (m.generatedVideo as any).coverUrl,
          title: m.generatedVideo.prompt || `Video AI #${counter}`,
          author: m.generatedVideo.modelName || "RunningHub AI",
          duration: m.generatedVideo.duration,
          sourceUrl: vidUrl,
          label: `Video ke-${counter}`,
          tag: `@vid${counter}`,
        });
        counter++;
      }
    }
  }
  return list;
}

// Detects if user requested to resend/view an existing video from this session
export function detectVideoRepostRequest(
  userText: string,
  sessionVideos: SessionVideoItem[],
): SessionVideoItem | null {
  if (!userText || sessionVideos.length === 0) return null;
  const lower = userText.trim().toLowerCase();

  // If user is asking for prompt extraction, generation, or analysis, it is NOT a repost request
  const isPromptingOrAnalysis =
    /^(?:\/|buat|buatkan|jadikan|ekstrak|analisis|analisa|bedah|jelaskan|deskripsikan|review|prompt)/i.test(lower) ||
    lower.includes("buatkan prompt") ||
    lower.includes("buat prompt") ||
    lower.includes("jadikan prompt") ||
    lower.includes("ekstrak video") ||
    lower.includes("ekstrak prompt");
  if (isPromptingOrAnalysis) {
    return null;
  }

  // Direct exact tag match alone: "@vid1", "@vid2", "@video1"
  const exactVidTagMatch = lower.match(/^@vid(?:eo)?(\d+)$/i);
  if (exactVidTagMatch && exactVidTagMatch[1]) {
    const requestedNum = parseInt(exactVidTagMatch[1], 10);
    const found = sessionVideos.find((v) => v.index === requestedNum);
    if (found) return found;
  }

  // Tag with explicit repost/play intent: "putar @vid1", "tampilkan @vid1", "mana @vid1", "kirim @vid1"
  const tagWithIntentMatch = lower.match(/(?:putar|play|tonton|kirim|tampilkan|mana|lihat|send|repost|show)\s+@vid(?:eo)?(\d+)/i);
  if (tagWithIntentMatch && tagWithIntentMatch[1]) {
    const requestedNum = parseInt(tagWithIntentMatch[1], 10);
    const found = sessionVideos.find((v) => v.index === requestedNum);
    if (found) return found;
  }

  // Pattern: "putar video 1", "video ke-2 mana", "tampilkan video 1"
  const matchIndex = lower.match(
    /(?:putar|play|tonton|kirim|tampilkan|mana|lihat|send|repost|show)\s*(?:kan)?\s*(?:video|vidio|klip)\s*(?:ke[- ]?)?(\d+)/i,
  );
  if (matchIndex && matchIndex[1]) {
    const requestedNum = parseInt(matchIndex[1], 10);
    const found = sessionVideos.find((v) => v.index === requestedNum);
    if (found) return found;
  }

  const hasPlayOrRepostIntent =
    lower.includes("putar") ||
    lower.includes("play") ||
    lower.includes("tonton") ||
    lower.includes("kirim") ||
    lower.includes("tampilkan") ||
    lower.includes("mana") ||
    lower.includes("lihat");
  if (hasPlayOrRepostIntent) {
    // Indonesian ordinal words
    if (
      lower.includes("video pertama") ||
      lower.includes("video ke satu") ||
      lower.includes("video kesatu") ||
      lower.includes("video ke-1")
    ) {
      const found = sessionVideos.find((v) => v.index === 1);
      if (found) return found;
    }
    if (
      lower.includes("video kedua") ||
      lower.includes("video ke 2") ||
      lower.includes("video ke-2")
    ) {
      const found = sessionVideos.find((v) => v.index === 2);
      if (found) return found;
    }
    if (
      lower.includes("video ketiga") ||
      lower.includes("video ke 3") ||
      lower.includes("video ke-3")
    ) {
      const found = sessionVideos.find((v) => v.index === 3);
      if (found) return found;
    }
  }

  return null;
}

// Detects if user requested to resend/view an existing image from this session
export function detectImageRepostRequest(
  userText: string,
  sessionImages: SessionImageItem[],
): SessionImageItem | null {
  if (!userText || sessionImages.length === 0) return null;
  const lower = userText.trim().toLowerCase();

  // If user is issuing generation/editing commands or prompting, it's not a repost request
  const isEditingOrPrompting = /^(?:\/|ubah|edit|ganti|buat|buatkan|generate|render|jadikan|prompt|bikin|analisis|analisa|deskripsikan|review)/i.test(lower);
  if (isEditingOrPrompting) {
    return null;
  }

  // Direct exact tag match alone: "@img1", "@img2", "@img10"
  const exactImgTagMatch = lower.match(/^@img(\d+)$/i);
  if (exactImgTagMatch && exactImgTagMatch[1]) {
    const requestedNum = parseInt(exactImgTagMatch[1], 10);
    const found = sessionImages.find((img) => img.index === requestedNum);
    if (found) return found;
  }

  // Explicit repost words with tag: "kirim @img1", "tampilkan @img1", "mana @img1", "lihat @img1"
  const tagWithIntentMatch = lower.match(/(?:kirim|tampilkan|mana|lihat|send|repost|show)\s+@img(\d+)/i);
  if (tagWithIntentMatch && tagWithIntentMatch[1]) {
    const requestedNum = parseInt(tagWithIntentMatch[1], 10);
    const found = sessionImages.find((img) => img.index === requestedNum);
    if (found) return found;
  }

  // Pattern: "kirim gambar ke 1", "gambar ke-2", "mana foto 1", "kirimkan gambar 1"
  const matchIndex =
    lower.match(/(?:kirim|tampilkan|mana|lihat|send|repost|show)\s*(?:kan)?\s*(?:gambar|foto|file|image)\s*(?:ke[- ]?)?(\d+)/i) ||
    lower.match(/(?:gambar|foto|file|image)\s*(?:ke[- ]?)?(\d+)\s*(?:mana|kirim|tampilkan)/i);

  if (matchIndex && matchIndex[1]) {
    const requestedNum = parseInt(matchIndex[1], 10);
    const found = sessionImages.find((img) => img.index === requestedNum);
    if (found) return found;
  }

  // Indonesian ordinal words with explicit request intent
  const hasRepostIntent =
    lower.includes("kirim") ||
    lower.includes("tampilkan") ||
    lower.includes("mana") ||
    lower.includes("lihat") ||
    lower.includes("show") ||
    lower.includes("send");
  if (hasRepostIntent) {
    if (
      lower.includes("pertama") ||
      lower.includes("ke satu") ||
      lower.includes("kesatu") ||
      lower.includes("ke 1") ||
      lower.includes("ke-1")
    ) {
      const found = sessionImages.find((img) => img.index === 1);
      if (found) return found;
    }
    if (
      lower.includes("kedua") ||
      lower.includes("ke 2") ||
      lower.includes("ke-2")
    ) {
      const found = sessionImages.find((img) => img.index === 2);
      if (found) return found;
    }
    if (
      lower.includes("ketiga") ||
      lower.includes("ke 3") ||
      lower.includes("ke-3")
    ) {
      const found = sessionImages.find((img) => img.index === 3);
      if (found) return found;
    }

    // General phrase: "kirim gambar yang tadi", "mana foto tadi", "tampilkan lagi gambar sebelumnya"
    if (
      (lower.includes("gambar") || lower.includes("foto")) &&
      (lower.includes("tadi") || lower.includes("lama") || lower.includes("sebelumnya"))
    ) {
      return sessionImages[sessionImages.length - 1];
    }
  }

  return null;
}

// Helper to extract weavy_repost directives from AI response or fallback to exact session image
export function extractWeavyRepostFromMessage(
  text: string,
  userMessageText?: string,
  sessionImages: SessionImageItem[] = [],
): {
  cleanContent: string;
  repostMedia: { url: string; index?: number; caption?: string; prompt?: string } | null;
} {
  const repostRegex = /```(?:weavy_repost|json:weavy_repost)\s*([\s\S]*?)\s*```/i;
  const match = text.match(repostRegex);
  let cleanContent = text.replace(repostRegex, "").trim();
  let parsedJson: any = null;

  if (match) {
    try {
      parsedJson = JSON.parse(match[1].trim());
    } catch {
      const jsonMatch = match[1].match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedJson = JSON.parse(jsonMatch[0]);
        } catch {}
      }
    }
  }

  if (parsedJson && (parsedJson.imageUrl || parsedJson.url)) {
    const finalUrl = parsedJson.imageUrl || parsedJson.url;
    const finalIdx = parsedJson.imageIndex || parsedJson.index;
    return {
      cleanContent,
      repostMedia: {
        url: finalUrl,
        index: typeof finalIdx === "number" ? finalIdx : undefined,
        caption: parsedJson.caption || (finalIdx ? `Gambar ke-${finalIdx}` : "File Gambar Asli"),
        prompt: parsedJson.prompt,
      },
    };
  }

  // Fallback: If user asked for an existing image but AI wrote a refusal or missed the code fence
  const requestedImg = detectImageRepostRequest(userMessageText || "", sessionImages);
  if (requestedImg) {
    if (
      cleanContent.toLowerCase().includes("nggak bisa mengambil") ||
      cleanContent.toLowerCase().includes("tidak bisa mengambil") ||
      cleanContent.toLowerCase().includes("tidak bisa mengirim") ||
      cleanContent.toLowerCase().includes("sulit ditemukan")
    ) {
      cleanContent = `Siap bro, ini dia file asli **${requestedImg.label}** yang kamu minta dari sesi ini (langsung dari memori sesi, tanpa render ulang & 0 kredit):`;
    }

    return {
      cleanContent,
      repostMedia: {
        url: requestedImg.url,
        index: requestedImg.index,
        caption: requestedImg.label,
        prompt: requestedImg.prompt,
      },
    };
  }

  return { cleanContent, repostMedia: null };
}

import { expandChatPreset, CHAT_SLASH_PRESETS } from "./chatPresets";

// Preset Slash Commands definitions (100% matched with ektension-weavy)
export interface SlashCommandPreset {
  command: string;
  name: string;
  badge: string;
  description: string;
  icon: string;
  isDownload: boolean;
  duration?: number;
  recommendedAspect: string;
  promptInstruction: string;
}

export const SLASH_COMMANDS: SlashCommandPreset[] = [
  {
    command: "/customstoryboard",
    name: "Custom Storyboard (Pure Brief)",
    badge: "CUSTOM",
    icon: "📝",
    isDownload: false,
    description: "Susun JSON Storyboard murni dari brief Anda tanpa suntikan formula AI",
    duration: 15,
    recommendedAspect: "9:16",
    promptInstruction:
      "Terapkan mode Custom Storyboard Compiler: Ikuti Main Brief pengguna 100% tanpa menyuntikkan formula baku tertentu kecuali diminta di brief. Susun naskah dan alur adegan ke breakdown scene rapi dan SELALU sertakan blok kode JSON ```storyboard_project ... ```.",
  },
  {
    command: "/copilotstoryboard",
    name: "Storyboard Copilot (Main Brief)",
    badge: "COPILOT",
    icon: "🎬",
    isDownload: false,
    description: "Analisis media/link & ikuti Main Brief untuk hasilkan Storyboard Card siap kirim",
    duration: 15,
    recommendedAspect: "9:16",
    promptInstruction:
      "Terapkan mode Storyboard Copilot interaktif: Wajib analisis gambar/link produk terlampir di awal, ikuti Main Brief pengguna secara mutlak, lalu susun breakdown adegan per scene terstruktur dan SELALU sertakan blok kode JSON ```storyboard_project ... ``` agar UI otomatis menampilkan kartu Storyboard interaktif.",
  },
  {
    command: "/kebunimpian",
    name: "Kebun Impian Lahan Sempit (Max 60s)",
    badge: "KEBUN",
    icon: "🏡",
    isDownload: false,
    description: "Tour kebun lahan sempit (Tangan wanita, latar lokal bersahaja, semi-ASMR, ~10s/scene, max 3 shoot)",
    duration: 50,
    recommendedAspect: "9:16",
    promptInstruction:
      "Terapkan formula video walkthrough / makeover kebun impian di lahan terbatas (maksimal 60 detik, ~10 detik per scene, maksimal 3 sub-shoot per scene), dengan gaya visual FACELESS DUA TANGAN WANITA (Delicate Indonesian Female Hands-Only), tata letak barang besar ditaruh rapi di lantai/rak tanpa diangkat paksa, serta pacing audio SEMI-ASMR ALAMI yang menenangkan dengan jeda hening berkala. Wajib sertakan blok kode ```storyboard_project ... ``` dan saran caption TikTok siap copy-paste.",
  },
  {
    command: "/homeharvest",
    name: "Home Harvest Sayur Dapur (29s)",
    badge: "PANEN",
    icon: "🍆",
    isDownload: false,
    description: "Panen sayur pekarangan 29s (3 Scene 9 Shoot): Hook lebat, petik, piano vibe & caption rapi",
    duration: 29,
    recommendedAspect: "9:16",
    promptInstruction:
      "Terapkan formula video panen sayuran dapur di pekarangan rumah (3 Scene & 9 Sub-Shoot @ 29s: Hook Showcase Lebat ➔ Pembuktian Tanam Pekarangan & Petik ➔ Hasil Panen Dapur & Closing Trigger + On-Screen Text Hook + JSON Storyboard Weavy + Caption TikTok Rapi). Wajib sertakan blok kode ```storyboard_project ... ``` dan saran caption TikTok siap copy-paste.",
  },
  {
    command: "/plantreview",
    name: "Plant Review & Oddity (TikTok)",
    badge: "REVIEW",
    icon: "🍇",
    isDownload: false,
    description: "Review bibit/buah unik viral: Hook visual oddity, VO, tabulampot, JSON & caption rapi",
    duration: 45,
    recommendedAspect: "9:16",
    promptInstruction:
      "Terapkan formula video TikTok review tanaman/buah unik (Hook Visual Oddity ➔ Analogi Bentuk/Rasa ➔ Pembuktian Rasa & Tekstur ➔ Solusi Tabulampot Pekarangan ➔ Naskah VO & Scene ➔ JSON Storyboard Weavy ➔ Template Caption TikTok Rapi). Wajib sertakan blok kode ```storyboard_project ... ``` dan saran caption TikTok siap copy-paste.",
  },
  {
    command: "/buahunggul",
    name: "Universal Produk, Bibit, Sayur & Pupuk (30s)",
    badge: "UNGGUL",
    icon: "🌳",
    isDownload: false,
    description: "Universal 30s (3 Scene @ 10s, Max 3 Shot): Bisa untuk Buah, Sayur, Bibit, Pupuk & Produk Lainnya + Instruksi VO & Video Realistis",
    duration: 30,
    recommendedAspect: "9:16",
    promptInstruction:
      "Terapkan formula video viral TikTok 30 detik UNIVERSAL untuk semua jenis produk (Buah, Sayuran, Bibit, Pupuk, Nutrisi, Alat Kebun, dan Produk Lainnya — 3 Scene @ 10s, Max 3 Shot per Scene): Scene 1 Hook Visual & Bukti Kualitas Produk (0-10s) ➔ Scene 2 Showcase Hasil Lebat & Manfaat/Nilai Ekonomi (10-20s) ➔ Scene 3 Produk Siap Kirim & CTA Keranjang Kuning Kiri Bawah (20-30s) + Instruksi VO Pria/Wanita + Instruksi Murni Video Tanpa Teks/Gambar + JSON Storyboard Weavy + Template Caption TikTok Rapi. ATURAN MUTLAK VO: Voiceover per scene 10 detik WAJIB TEPAT 28–29 KATA (rentang aman: 27–30 kata & 180–205 karakter, anti-kurang & anti-kepotong, total 3 scene: 84–88 kata).",
  },
  {
    command: "/onthespot",
    name: "On The Spot: Bibit, Buah & Benih (30s)",
    badge: "INVESTIGASI",
    icon: "🔥",
    isDownload: false,
    description: "Gaya investigasi On The Spot (3 Fakta @ 10s Veo/Flow): Narator TV berwibawa, macro 4K, bedah rasa/akar, verifikasi bibit asli & CTA keranjang kuning",
    duration: 30,
    recommendedAspect: "9:16",
    promptInstruction:
      "Terapkan formula video viral Perpaduan Visual Sinematik Investigasi 'On The Spot' Trans7 + Voice Over Influencer TikTok Jualan (3 Fakta Mencengangkan, 3 Scene @ 10s pas untuk render Google Gemini Veo/Flow): Scene 1 Fakta #1 Hook Racun TikTok & Keajaiban Visual (0-10s) ➔ Scene 2 Fakta #2 Pembuktian Kualitas Ekstrem & Spill Panen Lebat (10-20s) ➔ Scene 3 Fakta #3 Peringatan Waspada Tiruan + Hard CTA Keranjang Kuning Kiri Bawah (20-30s) + Suara Influencer TikTok Energik Persuasif + Visual Fotorealistik 4K Veo/Flow Tanpa Teks + JSON Storyboard + Tombol Salin Scene Siap Pakai. ATURAN MUTLAK VO: Voiceover per scene 10 detik WAJIB TEPAT 28–29 KATA (rentang aman: 27–30 kata & 180–205 karakter, anti-kurang & anti-kepotong, total 3 scene: 84–88 kata).",
  },
  {
    command: "/harvestpov",
    name: "POV Harvest & Taste (10s)",
    badge: "HARVEST",
    icon: "🌾",
    isDownload: false,
    description: "POV kebun: Tangan petik buah ➔ Belah juicy ➔ Cicipi makan (3 Scene 10s)",
    duration: 10,
    recommendedAspect: "9:16",
    promptInstruction:
      "Terapkan formula video viral 10 detik POV tangan (hands-only): Suasana pekarangan kebun alami ➔ POV tangan memetik buah ranum berembun dari pohon (0-3s) ➔ POV tangan membelah buah di talenan kayu memperlihatkan daging tebal berair juicy (3-7s) ➔ POV tangan mengangkat irisan buah ke kamera dan mencicipinya (7-10s) + CTA bibit. Tanpa wajah, tanpa teks di layar, fotografi clean 8k. Wajib sertakan blok kode ```storyboard_project ... ```.",
  },
  {
    command: "/facelessgardenugc",
    name: "Faceless Garden UGC (20s)",
    badge: "GARDEN",
    icon: "🌱",
    isDownload: false,
    description: "Kebun rumahan 20s: Hands-only wanita, VO natural-persuasive, polybag",
    duration: 20,
    recommendedAspect: "9:16",
    promptInstruction:
      "Terapkan formula video vertikal UGC komersial kebun rumahan 20 detik (2 Scene @ 10s). Gaya visual Faceless Hands-Only Garden UGC (delicate feminine hands), narasi wanita natural-persuasive, latar pekarangan rumah bersahaja, CTA soft-selling, tanpa teks di layar. Wajib sertakan blok kode ```storyboard_project ... ```.",
  },
  {
    command: "/download",
    name: "Download Video TikTok",
    badge: "DOWNLOAD",
    icon: "📥",
    isDownload: true,
    description: "Unduh video, thumbnail & musik TikTok tanpa watermark via link",
    duration: 0,
    recommendedAspect: "9:16",
    promptInstruction:
      "Unduh video TikTok tanpa watermark, thumbnail cover resolusi tinggi, dan file audio MP3 via link yang disertakan.",
  },
  {
    command: "/fashion",
    name: "Fashion Video 15s",
    badge: "FASHION",
    icon: "👗",
    isDownload: false,
    description: "Prompt video fashion 15s TikTok/Reels dengan hook & detail material",
    duration: 15,
    recommendedAspect: "9:16",
    promptInstruction:
      "Analyze the attached reference image(s) for fashion outfit details (hero product type, color/wash tones, fabric drape, silhouette, secondary garments, footwear, and setting). Generate a high-retention 15-second vertical TikTok fashion commercial video prompt (9:16) with strict subject framing lock, product consistency lock, and full second-by-second timeline breakdown (0–3s Fast Texture Hook, 3–6s Fit/Width & Drape, 6–9s Controlled Side View, 9–12s Rear Fit & Pockets, 12–15s Return & Hero Finish). MANDATORY GENDER-AWARE HAND & SKIN RULE: Whenever hands are visible or interacting with fabric/pockets/accessories, if model is female, explicitly describe: 'soft delicate feminine hands, slender graceful fingers, smooth natural skin texture, clean neat manicured nails, soft natural skin folds without visible veins, zero bulging veins, no masculine vascularity'. If male: 'clean well-groomed hands, athletic smooth natural skin texture'. FLATTERING LIGHTING: 'Soft diffused high-end commercial illumination, gentle ambient fill light, subtle warm specular skin highlights, zero harsh dark blotchy shadows'. Negative prompt: 'bulging veins, masculine vascular hands, coarse hairy arms, deformed fingers, harsh contrasting shadows'. Deliver 100% in English using prompt:video format.",
  },
  {
    command: "/lockcut",
    name: "Lock Cut Fashion",
    badge: "LOCKCUT",
    icon: "🔒",
    isDownload: false,
    description: "Montase rapid jump-cut ~1s, kamera statis locked, zero zoom/pan",
    duration: 10,
    recommendedAspect: "9:16",
    promptInstruction:
      "Apply the '/lockcut' (Locked-Framing Rapid Discontinuous Jump-Cut Fashion Video Director Preset). Analyze the attached reference image(s) with mandatory Image Content Analysis and Context Validation for fashion outfit details (hero product type, exact color tones, fabric weight and drape, construction seams, neckline, sleeves, hemline, secondary garments, footwear, setting, and model identity). Follow all natural user instructions provided after the command (including @imgX references, featured product, custom duration, requested number of movements/shots, poses, angles, expressions, and mood) without asking the user for technical parameters. CORE PRESET DIRECTIVES: 1. PACING & SHOT ALLOCATION ARCHITECTURE (AI ATTENTION SWEET SPOT): Video models maintain clean discontinuous cuts without decaying into morphing when each shot is given 2.0s to 2.5s of breathing room. Default: 10 seconds total, divided into 4 high-impact shots @ 2.5s each (4 distinct movements/poses). If the user specifies a custom movement count or duration (e.g. '3 gerakan', '5 gerakan', '8 detik', '12 detik'), dynamically allocate 2.0s to 3.0s per shot to guarantee flawless temporal cut execution. 2. SHOT-TO-MOVEMENT PRINCIPLE (1 SHOT = 1 DISTINCT ACTION): Each shot contains exactly ONE purposeful, natural human movement or showcase action (e.g. Shot 1 neckline smooth, Shot 2 3/4 turn with hand in pocket, Shot 3 sleeve cuff present, Shot 4 hero waist settle). Real gravity drape, authentic weight transfer, natural breathing and blinking. 3. HARD CUT ENFORCEMENT & ANTI-INTERPOLATION DIRECTIVE (CRITICAL): Format every shot transition with explicit anti-interpolation markers: '[INSTANT HARD JUMP-CUT AT Xs — ZERO INTERMEDIATE TURNING FRAMES. MODEL SNAPS INSTANTLY INTO NEW POSE ON FRAME 1. TRAVEL BETWEEN POSES IS NEVER SHOWN]'. The video engine must treat each shot boundary as a physical edit point without synthesizing in-between turning frames. STRICTLY FORBIDDEN: smooth continuous turning, gradual rotation, interpolating between poses, in-between turning frames, transitional movements, crossfade, dissolve, fade, morph, warp, blend, whip-pan, speed ramp, slow-motion. 4. CRITICAL FRAMING LOCK — ZERO ZOOM & ZERO CAMERA MOVEMENT: Camera remains 100% locked at static eye-level medium shot from mid-thigh up to above head with comfortable headroom. Full upper body, both arms, complete hero garment, and upper secondary garment always visible inside frame. ABSOLUTELY NO zoom-in, NO punch-in, NO macro closeup, NO cropping into the garment, NO dolly, NO orbit, NO pan, NO tilt, NO handheld drift. Model scale never changes; all product showcase is achieved purely through body and hand movements inside this locked frame. 5. HERO PRODUCT & CONTINUITY LOCK: Preserve exact garment color tone, fabric weave, neckline, sleeve length, silhouette, seam lines, hems, and gravity-driven drape. Zero unauthorized prints, logos, zippers, or extra accessories. Identical secondary garment, setting (clean domestic interior / minimal background), lighting, and model identity across all shots. 6. ANATOMY & SKIN PRESERVATION (CRITICAL): When hands touch neckline, sleeves, hems, pockets, or hips: render soft delicate feminine hands, slender graceful fingers, smooth natural skin texture, clean neat manicured nails, soft natural knuckle folds without prominent veins, zero bulging veins, no masculine vascularity, five anatomically perfect fingers per hand. 7. FLATTERING LIGHTING: Soft diffused high-end commercial illumination, gentle ambient fill light, subtle warm specular highlights, luminous skin tone, zero harsh blotchy shadows. 8. NEGATIVE PROMPT (MANDATORY ANTI-INTERPOLATION SAFEGUARDS): smooth continuous turning, gradual rotation, interpolating between poses, in-between turning frames, transitional movements, slow panning, morphing between shots, crossfade, dissolve, warp, speed ramp, slow motion, fast-forward, bulging veins, masculine vascular hands, coarse hairy skin, rough hands, deformed fingers, extra digits, harsh blotchy shadows, zoom-in, punch-in, macro closeup, cropped framing, camera movement, camera orbit, dolly, pan, tilt, handheld shake, whip-pan, frozen mannequin poses, walking out of frame, changing subject scale, face drift, identity change, garment color shift, added logos/prints, plastic CGI gloss. Output full prompt in English inside a ```prompt:video block with header 'RAPID DISCONTINUOUS JUMP-CUT FASHION MONTAGE — LOCKED EYE-LEVEL FRAMING, 9:16 VERTICAL' and complete shot-by-shot storyboard with timestamped anti-interpolation cut markers.",
  },
  {
    command: "/jumpcut",
    name: "Jump Cut Fashion",
    badge: "JUMPCUT",
    icon: "⚡",
    isDownload: false,
    description: "Hard cut dinamis ganti pose/angle cepat ~1s per shot",
    duration: 15,
    recommendedAspect: "9:16",
    promptInstruction:
      "Apply the '/jumpcut' (Fashion Product Hard Jump-Cut Video Director Preset). Analyze the attached reference image(s) for fashion outfit details (hero product type, color/wash tones, fabric drape, silhouette, secondary garments, footwear, and setting). Follow all natural user instructions provided after the command (including @imgX references, duration, featured product, poses, angles, expressions, framing, and mood) without asking the user for technical parameters. Conduct mandatory Image Content Analysis and Context Validation before prompting (halt and ask confirmation if image mismatches). Core Preset Directives: 1. Every change in pose, angle, or framing must occur via crisp hard jump cuts. 2. Model immediately appears in the new pose after each cut. 3. Do NOT show the process of the model rotating or moving between poses (no turning visible in-between). 4. Do NOT use crossfades, dissolves, morphing, whip-pans, speed ramps, camera orbits, or smooth transitions. 5. Subtle micro-movements within each shot must remain natural (breathing, blinking, shifting gaze, smoothing sleeves, touching cuffs, shifting weight). 6. Hero product remains the primary focus throughout the video. 7. Showcase shot variations matching the product (front, three-quarter right/left, fabric texture closeup, seam/cuff details, cut width, fabric drape, hero finish). 8. Preserve model identity, body proportions, exact product color/design, background, and lighting. 9. ANATOMY & SKIN PRESERVATION (CRITICAL): If female model touches fabric, pockets, or poses, explicitly describe: 'soft delicate feminine hands, slender graceful fingers, smooth natural skin texture, clean neat manicured nails, soft natural skin folds without prominent veins, zero bulging veins, no masculine vascularity'. 10. FLATTERING LIGHTING: 'Soft diffused high-end commercial illumination, gentle ambient fill light, subtle warm specular skin highlights, zero harsh contrasting shadows'. 11. Negative Prompt: 'bulging veins, masculine vascular hands, coarse hairy skin, rough hands, deformed fingers, extra digits, harsh blotchy shadows'. If duration is unspecified, default to 10s. If aspect ratio is unspecified, default to 9:16. If cut interval is unspecified, default to ~1s per hard cut. If mood is unspecified, default to calm, friendly, natural, and confident. Output full prompt in English inside a ```prompt:video block.",
  },
  {
    command: "/natural",
    name: "Natural & Candid",
    badge: "NATURAL",
    icon: "🌿",
    isDownload: false,
    description: "Ekspresi & pencahayaan alami tanpa terasa kaku ala lifestyle",
    duration: 15,
    recommendedAspect: "9:16",
    promptInstruction:
      "Apply the '/natural' Organic Non-Rigid Video Director Preset. Analyze the attached reference image(s) with mandatory pre-prompt image analysis. Maintain STRICT hero product & subject consistency locks (exact color tones, fabric texture, wash, silhouette, seams, and cleanliness with no unauthorized accessories), but craft an organic, flowing narrative videography arc (Opening candid moment → Natural mid-movement transition → Organic detail glimpse → Relaxed closing beat) with spontaneous human gestures, non-rigid camera work tailored to the requested mood (santai/casual, editorial magazine, street documentary, or golden hour lifestyle). GENDER & HAND PRESERVATION: If female subject touches collar/hair/bag/pockets, describe 'soft delicate feminine hands, slender graceful fingers, smooth flawless skin texture, zero bulging veins, no masculine vascularity'. LIGHTING: 'Soft flattering natural daylight, gentle golden-hour warmth or clean diffused window lighting, soft skin glow with no harsh dark blotches'. Negative Prompt: 'bulging veins, masculine hands on female model, coarse hairy arms, extra fingers, harsh unflattering shadows'. Output wrapped inside a prompt:video block.",
  },
  {
    command: "/ugc",
    name: "Konten UGC Creator",
    badge: "UGC",
    icon: "📱",
    isDownload: false,
    description: "Gaya review produk otentik ala smartphone creator/influencer",
    duration: 15,
    recommendedAspect: "9:16",
    promptInstruction:
      "Transform into authentic organic User Generated Content (UGC) creator style shot on smartphone front camera (iPhone 15/16 Pro Max, 24mm wide angle, handheld casual selfie perspective, lived-in background, candid smiling expression holding or presenting the subject, zero artificial 3D/CGI sheen, high social media engagement aesthetic). Hands holding phone/product must be described: 'clean delicate feminine hands with smooth soft skin texture, neat nails, no prominent veins'. Lighting: 'Clean flattering smartphone ring-light or natural window daylight, soft even illumination on face and hands, eliminating dark unflattering shadows'. Negative: 'bulging veins, rough masculine hands on female, mutant fingers, harsh contrasting shadows'.",
  },
  {
    command: "/clean",
    name: "Clean Object & Studio",
    badge: "CLEAN",
    icon: "✨",
    isDownload: false,
    description: "Latar studio minimalis rapi untuk foto katalog produk premium",
    duration: 15,
    recommendedAspect: "16:9",
    promptInstruction:
      "Perform immaculate clutter cleanup and object removal on this space. Completely remove all loose clutter, visible cables, mess, stray boxes, and extraneous items from surfaces and floor. Strictly preserve the original architectural walls, window frames, authentic materials, natural daylight, and perspective layout of the space with pristine, seamless, clean minimalist surfaces.",
  },
  {
    command: "/video",
    name: "Storyboard Video AI",
    badge: "VIDEO",
    icon: "🎬",
    isDownload: false,
    description: "Alur adegan sinematik hook, product proof, dan CTA kuat",
    duration: 15,
    recommendedAspect: "9:16",
    promptInstruction:
      "Create a professional, high-retention 15-second commercial video prompt based on the provided reference image with strict visual consistency locks, camera motion, second-by-second timeline breakdown. Include gender-matched hand anatomy ('soft delicate feminine hands with smooth texture, zero bulging veins' for female models) and balanced flattering lighting ('Soft diffused commercial lighting, gentle fill light, subtle warm specular highlights, no harsh dark shadows'). Negative safeguards: 'bulging veins, masculine hands, deformed fingers, harsh shadows'. Deliver inside a prompt:video block.",
  },
];

// Alias mapping for slash commands matching ektension-weavy
const SLASH_ALIASES: Record<string, string> = {
  "/gardentour": "/kebunimpian",
  "/kebunorganik": "/kebunimpian",
  "/kitchengarden": "/homeharvest",
  "/kebunsayur": "/homeharvest",
  "/odditygarden": "/plantreview",
  "/plantoddity": "/plantreview",
  "/seedlessfruit": "/buahunggul",
  "/cuanbibit": "/buahunggul",
  "/spotbibit": "/onthespot",
  "/spotbuah": "/onthespot",
  "/investigasikebun": "/onthespot",
  "/storyboardcopilot": "/copilotstoryboard",
  "/storyboard": "/video",
  "/jumpcut-no-zoom": "/lockcut",
  "/jumptcut-no-zoom": "/lockcut",
  "/lock-cut": "/lockcut",
  "/jumpcut-locked": "/lockcut",
  "/jumcut": "/jumpcut",
};

// Helper to expand slash commands in user prompt using 100% ektension-weavy logic
export function expandSlashCommands(rawText: string): {
  expandedText: string;
  detectedCommand: SlashCommandPreset | null;
  userExtraText: string;
} {
  const trimmed = rawText.trim();
  const lower = trimmed.toLowerCase();

  // 1. Check aliases first
  for (const [alias, targetCmd] of Object.entries(SLASH_ALIASES)) {
    if (lower === alias || lower.startsWith(alias + " ") || lower.startsWith(alias + "\n")) {
      const targetPreset = SLASH_COMMANDS.find((p) => p.command === targetCmd);
      if (targetPreset) {
        const remaining = trimmed.substring(alias.length).trim();
        const expandedText = expandChatPreset(`${targetCmd} ${remaining}`);
        return {
          expandedText,
          detectedCommand: targetPreset,
          userExtraText: remaining,
        };
      }
    }
  }

  // 2. Check standard commands
  for (const preset of SLASH_COMMANDS) {
    if (lower === preset.command || lower.startsWith(preset.command + " ") || lower.startsWith(preset.command + "\n")) {
      const remaining = trimmed.substring(preset.command.length).trim();
      const expandedText = expandChatPreset(`${preset.command} ${remaining}`);
      return {
        expandedText,
        detectedCommand: preset,
        userExtraText: remaining,
      };
    }
  }

  return {
    expandedText: rawText,
    detectedCommand: null,
    userExtraText: rawText,
  };
}

// Normalizer: Standardize model name to friendly UI name
export function normalizeWeavyModelName(rawModel: string, fallbackId?: string): string {
  const combined = `${rawModel || ""} ${fallbackId || ""}`.trim();
  if (!combined) return "Nano Banana Pro";
  const mid = combined.toLowerCase();
  if (mid.includes("banana") || mid.includes("nano")) {
    return "Nano Banana Pro";
  } else if (mid.includes("seedream") || mid.includes("v5")) {
    return "Seedream V5.0 Pro Edit";
  } else if (
    mid.includes("flare") ||
    mid.includes("gpt-image-2.5") ||
    mid.includes("gpt_image_2.5") ||
    mid.includes("gpt image 2.5")
  ) {
    return "GPT Image 2.5";
  } else if (mid.includes("grok") || mid.includes("imagine")) {
    return "Grok Imagine Image";
  } else if (
    mid.includes("gpt_image_2") ||
    (mid.includes("chatgpt") && !mid.includes("edit"))
  ) {
    return "ChatGPT Images 2.0";
  } else if (mid.includes("gpt_image_1") || mid.includes("edit")) {
    return "ChatGPT Images 2.0 Edit";
  }
  return rawModel || fallbackId || "Nano Banana Pro";
}

// Synchronizer: Cleanly update Weavy account credits in localStorage and dispatch events
export function updateWeavyAccountCreditsInStorage(
  identifier: { id?: string; email?: string },
  newCredits: number,
  extraData?: {
    totalCredits?: number;
    idToken?: string;
    refreshToken?: string;
  },
): any[] {
  try {
    const raw = localStorage.getItem("weavy_accounts");
    if (!raw) return [];
    const accounts = JSON.parse(raw);
    if (!Array.isArray(accounts)) return [];

    const updated = accounts.map((acc: any) => {
      const isMatch =
        (identifier.id && acc.id === identifier.id) ||
        (identifier.email && acc.email === identifier.email);
      if (isMatch) {
        return {
          ...acc,
          credits: newCredits,
          ...(extraData?.totalCredits !== undefined
            ? { totalCredits: extraData.totalCredits }
            : {}),
          ...(extraData?.idToken ? { idToken: extraData.idToken } : {}),
          ...(extraData?.refreshToken
            ? { refreshToken: extraData.refreshToken }
            : {}),
        };
      }
      return acc;
    });

    localStorage.setItem("weavy_accounts", JSON.stringify(updated));
    window.dispatchEvent(new Event("weavy_accounts_updated"));
    window.dispatchEvent(new Event("accounts-updated"));
    return updated;
  } catch (err) {
    console.warn("[chatUtils] Error updating Weavy credits in storage:", err);
    return [];
  }
}

export interface PollWeavyTaskParams {
  taskId: string;
  recipeId?: string;
  refreshToken: string;
  idToken?: string;
  maxAttempts?: number;
  pollInterval?: number;
  onCreditUpdate?: (remainingCredits: number) => void;
}

// Reusable polling helper function for Weavy async tasks
export async function pollWeavyTaskStatus({
  taskId,
  recipeId,
  refreshToken,
  idToken,
  maxAttempts = 50,
  pollInterval = 2500,
  onCreditUpdate,
}: PollWeavyTaskParams): Promise<string> {
  // 1. UTAMAKAN POLLING LANGSUNG VIA EXTENSION BRIDGE (100% Bebas 403 & Cloudflare WAF)
  if (extensionBridge.getStatus().isConnected && (recipeId || taskId)) {
    try {
      console.log(`[ChatUtils 🚀] Polling status Weavy AI langsung via Chrome Extension Bridge...`);
      const bridgeUrl = await extensionBridge.pollWeavyStatus({
        recipeId: recipeId || '',
        taskId,
        batchId: taskId,
        idToken,
        refreshToken,
        maxAttempts,
        pollInterval,
        onCreditUpdate,
      });
      if (bridgeUrl) return bridgeUrl;
    } catch (bErr: any) {
      console.warn("[chatUtils] Extension bridge poll warning:", bErr?.message);
      if (bErr?.message && (bErr.message.includes('gagal') || bErr.message.includes('habis') || bErr.message.includes('failed'))) {
        throw bErr;
      }
    }
  }

  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, pollInterval));
    attempts++;

    let pollData: any = null;
    try {
      const pollResp = await fetch("/api/poll-weavy-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          recipeId,
          refreshToken,
          idToken: idToken || "",
        }),
      });

      if (!pollResp.ok) {
        const errJson = await pollResp.json().catch(() => null);
        if (errJson && (errJson.error || errJson.message)) {
          // If server gets 403 / HTML error, try bridge
          if (extensionBridge.getStatus().isConnected) {
            try {
              const res = await extensionBridge.pollWeavyStatus({
                recipeId,
                taskId,
                idToken,
                refreshToken,
                maxAttempts: 10,
                pollInterval: 2000,
                onCreditUpdate,
              });
              if (res) return res;
            } catch (_) {}
          }
          throw new Error(errJson.error || errJson.message);
        }
      }

      pollData = await pollResp.json().catch(() => null);
    } catch (fetchErr: any) {
      const msg = fetchErr?.message || "";
      if (
        msg &&
        !msg.toLowerCase().includes("failed to fetch") &&
        !msg.toLowerCase().includes("networkerror")
      ) {
        if (extensionBridge.getStatus().isConnected) {
          try {
            const res = await extensionBridge.pollWeavyStatus({
              recipeId,
              taskId,
              idToken,
              refreshToken,
              maxAttempts: 10,
              pollInterval: 2000,
              onCreditUpdate,
            });
            if (res) return res;
          } catch (_) {}
        }
        throw fetchErr;
      }
      continue;
    }

    if (!pollData) continue;

    // Trigger credit callback if returned
    const returnedCredits =
      typeof pollData.userRemainingCredits === "number"
        ? pollData.userRemainingCredits
        : typeof pollData.remainingCredits === "number"
          ? pollData.remainingCredits
          : typeof pollData.credits === "number"
            ? pollData.credits
            : undefined;

    if (returnedCredits !== undefined && onCreditUpdate) {
      onCreditUpdate(returnedCredits);
    }

    // Terminal error checks
    const statusUpper = String(pollData.status || "").toUpperCase();
    if (
      statusUpper === "FAILED" ||
      statusUpper === "ERROR" ||
      pollData.status === "failed" ||
      pollData.status === "error" ||
      (pollData.error &&
        statusUpper !== "COMPLETED" &&
        statusUpper !== "SUCCESS")
    ) {
      throw new Error(
        pollData.errorMessage ||
          pollData.error ||
          "Generasi gambar gagal pada server Weavy AI.",
      );
    }

    const rawUrl =
      pollData.resultUrl ||
      pollData.mediaUrl ||
      pollData.outputUrl ||
      (Array.isArray(pollData.outputs) &&
        (pollData.outputs[0]?.url ||
          pollData.outputs[0]?.fileUrl ||
          (typeof pollData.outputs[0] === "string"
            ? pollData.outputs[0]
            : ""))) ||
      "";

    if (
      rawUrl &&
      (rawUrl.startsWith("http://") || rawUrl.startsWith("https://"))
    ) {
      return rawUrl;
    }

    if (
      statusUpper === "COMPLETED" ||
      statusUpper === "SUCCESS" ||
      pollData.status === "completed"
    ) {
      if (
        pollData.node?.data?.resultUrl ||
        pollData.node?.data?.outputImage
      ) {
        return (
          pollData.node.data.resultUrl || pollData.node.data.outputImage
        );
      }
    }
  }

  throw new Error(
    "Waktu proses gambar melebihi batas waktu (timeout). Silakan periksa kembali atau coba ulang.",
  );
}

// Helper to check if text is a Google Gemini Imagen refusal or internal Google content link
export function isGoogleImagenRefusalOrInternalUrl(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  if (
    t.startsWith("http://googleusercontent.com/image_generation_content") ||
    t.startsWith("https://googleusercontent.com/image_generation_content") ||
    t.startsWith("http://googleusercontent.com/imagegenerationcontent") ||
    t.startsWith("https://googleusercontent.com/imagegenerationcontent")
  ) {
    return true;
  }
  const lower = t.toLowerCase();
  return (
    lower.includes("apakah anda sudah masuk") ||
    lower.includes("belum bisa membuatkannya") ||
    lower.includes("belum tersedia di lokasi") ||
    lower.includes("image creation isn't available") ||
    lower.includes("image creation is not available") ||
    lower.includes("signed out or image creation") ||
    lower.includes("can't create it right now") ||
    lower.includes("tidak bisa membuatkan gambar") ||
    lower.includes("tidak dapat membuatkan gambar")
  );
}

// Helper to extract clean visual prompt from user's message
export function extractCleanVisualPromptFromUser(userText: string): string {
  if (!userText) return "";
  let clean = userText.trim();
  clean = clean
    .replace(
      /^(?:generate|render|buatkan|buat|bikin|ciptakan|tolong\s+buatkan|tolong\s+bikin|jadikan)\s+(?:ke\s+)?(?:gambar|foto|visual|potret|image|lukisan|ilustrasi)?\s*(?:dari|tentang|berupa|seorang|sebuah)?\s*/i,
      "",
    )
    .replace(/^(?:gambarnya|fotonya|visualnya)\s*/i, "")
    .trim();
  return clean || userText.trim();
}

// Helper to sanitize fallback prompt candidate by stripping Indonesian conversational greetings
export function sanitizeFallbackVisualPrompt(rawText: string, userMessageText?: string): string {
  if (!rawText) return userMessageText ? extractCleanVisualPromptFromUser(userMessageText) : "";
  if (isGoogleImagenRefusalOrInternalUrl(rawText) || rawText.startsWith("http://") || rawText.startsWith("https://")) {
    if (userMessageText) {
      return extractCleanVisualPromptFromUser(userMessageText);
    }
  }
  let cleaned = cleanPlainText(rawText);
  const quoteMatch = rawText.match(/"([^"]{20,})"/);
  if (quoteMatch) {
    cleaned = quoteMatch[1].trim();
  } else {
    // Strip conversational prefixes such as "Tentu!", "Siap bro! ...", "Berikut adalah konsep visualnya:"
    cleaned = cleaned
      .replace(/^(?:tentu\s+saja|tentu|siap\s+bro|siap|baiklah|baik|halo|berikut\s+adalah|berikut|ini\s+dia|oke|sure|yes)[^:\n]*[:\n-]+\s*/i, "")
      .replace(/^model\s+[^:\n]+[:\n-]+\s*/i, "")
      .trim();
  }
  if (cleaned.length > 600) {
    cleaned = cleaned.substring(0, 600).trim();
  }
  return cleaned || (userMessageText ? extractCleanVisualPromptFromUser(userMessageText) : "");
}

// Helper to extract Weavy Image directives or bridging requests from AI responses
export function extractWeavyActionFromMessage(
  text: string,
  userMessageText?: string,
  attachments?: ChatAttachment[],
  historyMessages?: ChatMessage[],
): { cleanContent: string; action: WeavyActionData | null; shouldAutoExecute: boolean } {
  if (!text) return { cleanContent: "", action: null, shouldAutoExecute: false };

  // 1. Check if user explicitly asked to generate an image
  const userText = (userMessageText || "").toLowerCase();

  // Detect if user is asking for video, animation, or pure prompt
  const isVideoQuery =
    /(?:video|vidio|animasi|animation|clip|footage|reel|tiktok|short|shorts|b-roll|broll|sora|veo|kling|luma|runway|hailuo|pika|motion)\b/i.test(userText);

  const isPromptOnlyQuery =
    /(?:prompt|ide prompt|teks prompt|tuliskan prompt|bikin prompt|buatkan prompt|minta prompt|rekomendasi prompt|kasih prompt|contoh prompt)\b/i.test(userText) &&
    !/(?:generate ke gambar|buat gambarnya sekarang|bikin gambarnya sekarang|render gambarnya)/i.test(userText);

  const isSlashCommand = userText.startsWith("/ugc") || userText.startsWith("/clean");

  const isExplicitGenerateCmd =
    !isVideoQuery &&
    !isPromptOnlyQuery &&
    (isSlashCommand ||
      /(?:generate|render|jadikan)\s+(?:ke\s+)?(?:gambar|foto|image|visual)/i.test(userText) ||
      /(?:buatkan|buat|bikin)\s+(?:gambar|foto|visual|potret)\s+(?:dari|tentang|berupa|seorang|sebuah)/i.test(userText) ||
      /(?:buatkan|buat|bikin)\s+(?:gambarnya|fotonya)/i.test(userText) ||
      userText.includes("generate ke gambar") ||
      userText.includes("buat gambarnya") ||
      userText.includes("bikin gambarnya") ||
      userText.includes("buat fotonya") ||
      userText.includes("bikin fotonya"));

  // 2. Parse ```weavy_generate or ```gemini_generate block or raw tool JSON
  const weavyRegex = /```(?:weavy_generate|gemini_generate|json:weavy_generate|json:gemini_generate)\s*([\s\S]*?)\s*```/i;
  const match = text.match(weavyRegex);

  let cleanContent = text;
  let parsedJson: any = null;

  if (match) {
    cleanContent = text.replace(weavyRegex, "").trim();
    try {
      parsedJson = JSON.parse(match[1].trim());
    } catch {
      const jsonMatch = match[1].match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedJson = JSON.parse(jsonMatch[0]);
        } catch {}
      }
    }
  } else {
    // Also detect if the model returned raw JSON containing action / action_input / prompt
    const rawJsonMatch = text.match(/\{[\s\S]*"(?:action|action_input|prompt)"[\s\S]*\}/);
    if (rawJsonMatch) {
      try {
        const candidate = JSON.parse(rawJsonMatch[0]);
        if (candidate && (candidate.prompt || candidate.action_input || candidate.action)) {
          parsedJson = candidate;
          cleanContent = text.replace(rawJsonMatch[0], "").trim();
          if (!cleanContent) {
            cleanContent = "Berikut konsep visual yang siap digenerate:";
          }
        }
      } catch {}
    }
  }

  // Normalize tool output like dalle.text2im / action_input into prompt
  if (parsedJson) {
    if (!parsedJson.prompt && parsedJson.action_input) {
      parsedJson.prompt = parsedJson.action_input;
    }
    if (parsedJson.action && (String(parsedJson.action).includes("dalle") || String(parsedJson.action).includes("text2im"))) {
      parsedJson.model = "Nano Banana Pro";
    }
  }

  // 3. Collect all session images with their numeric indices (#1, #2, ...)
  const sessionImages = historyMessages ? getAllSessionImages(historyMessages) : [];

  // Detect if user or AI explicitly mentioned using multiple images (e.g. "dua referensi", "2 gambar")
  const combinedContext = `${userText} ${text.toLowerCase()}`;
  const mentionsTwoImages =
    combinedContext.includes("dua referensi") ||
    combinedContext.includes("2 referensi") ||
    combinedContext.includes("dua gambar") ||
    combinedContext.includes("2 gambar") ||
    combinedContext.includes("kedua gambar") ||
    combinedContext.includes("kedua foto") ||
    combinedContext.includes("2 foto") ||
    combinedContext.includes("dua foto") ||
    combinedContext.includes("kedua referensi") ||
    (combinedContext.includes("gambar #1") && combinedContext.includes("gambar #2")) ||
    (combinedContext.includes("gambar 1") && combinedContext.includes("gambar 2"));

  const mentionsThreeImages =
    combinedContext.includes("tiga referensi") ||
    combinedContext.includes("3 referensi") ||
    combinedContext.includes("tiga gambar") ||
    combinedContext.includes("3 gambar") ||
    combinedContext.includes("ketiga gambar");

  const expectedCount = mentionsThreeImages ? 3 : mentionsTwoImages ? 2 : 1;

  // 4. Resolve candidate reference image URLs
  const candidateRefUrls: string[] = [];

  // 4A. Explicit references from parsed JSON if provided
  if (parsedJson) {
    const rawRefs =
      parsedJson.referenceImages ||
      parsedJson.referenceImageUrls ||
      parsedJson.images ||
      parsedJson.imageUrls;

    if (Array.isArray(rawRefs)) {
      for (const item of rawRefs) {
        if (typeof item === "number") {
          const found = sessionImages.find((img) => img.index === item);
          if (found && found.url) candidateRefUrls.push(found.url);
        } else if (typeof item === "string" && item.trim()) {
          const trimmed = item.trim();
          const tagMatch = trimmed.match(/^@?img[-_]?(\d+)$/i) || trimmed.match(/^#(\d+)$/);
          if (tagMatch && tagMatch[1]) {
            const num = parseInt(tagMatch[1], 10);
            const found = sessionImages.find((img) => img.index === num);
            if (found && found.url) candidateRefUrls.push(found.url);
          } else {
            const num = parseInt(trimmed, 10);
            if (!isNaN(num) && String(num) === trimmed) {
              const found = sessionImages.find((img) => img.index === num);
              if (found && found.url) candidateRefUrls.push(found.url);
            } else if (
              trimmed.startsWith("http") ||
              trimmed.startsWith("data:") ||
              trimmed.startsWith("/")
            ) {
              candidateRefUrls.push(trimmed);
            }
          }
        }
      }
    } else if (typeof rawRefs === "number") {
      const found = sessionImages.find((img) => img.index === rawRefs);
      if (found && found.url) candidateRefUrls.push(found.url);
    } else if (typeof rawRefs === "string" && rawRefs.trim()) {
      const trimmed = rawRefs.trim();
      const tagMatch = trimmed.match(/^@?img[-_]?(\d+)$/i) || trimmed.match(/^#(\d+)$/);
      if (tagMatch && tagMatch[1]) {
        const num = parseInt(tagMatch[1], 10);
        const found = sessionImages.find((img) => img.index === num);
        if (found && found.url) candidateRefUrls.push(found.url);
      } else {
        const num = parseInt(trimmed, 10);
        if (!isNaN(num) && String(num) === trimmed) {
          const found = sessionImages.find((img) => img.index === num);
          if (found && found.url) candidateRefUrls.push(found.url);
        } else if (
          trimmed.startsWith("http") ||
          trimmed.startsWith("data:") ||
          trimmed.startsWith("/")
        ) {
          candidateRefUrls.push(trimmed);
        }
      }
    }

    const singleRef = parsedJson.referenceImageUrl || parsedJson.imageUrl;
    if (typeof singleRef === "string" && singleRef.trim()) {
      candidateRefUrls.push(singleRef.trim());
    }
  }

  // 4B. Add all image attachments from current user turn
  if (attachments && attachments.length > 0) {
    const currentAtts = attachments
      .filter((a) => a && a.type === "image" && (a.url || a.base64))
      .map((a) => (a.url || a.base64)!);
    for (const url of currentAtts) {
      if (!candidateRefUrls.includes(url)) {
        candidateRefUrls.push(url);
      }
    }
  }

  // 4C. If user asked for multi-images or candidate is empty, resolve from session images
  if (sessionImages.length > 0) {
    if (candidateRefUrls.length === 0) {
      const takeCount = Math.min(expectedCount, sessionImages.length);
      const chosen = sessionImages.slice(-takeCount);
      for (const img of chosen) {
        if (img.url && !candidateRefUrls.includes(img.url)) {
          candidateRefUrls.push(img.url);
        }
      }
    } else if (candidateRefUrls.length < expectedCount) {
      for (let i = sessionImages.length - 1; i >= 0; i--) {
        const img = sessionImages[i];
        if (img.url && !candidateRefUrls.includes(img.url)) {
          candidateRefUrls.unshift(img.url);
          if (candidateRefUrls.length >= expectedCount) break;
        }
      }
    }
  }

  // 4D. Scan history messages backwards for recent images if still empty
  if (candidateRefUrls.length === 0 && historyMessages) {
    for (let i = historyMessages.length - 1; i >= 0; i--) {
      const hm = historyMessages[i];
      if (hm.attachments && hm.attachments.length > 0) {
        const founds = hm.attachments
          .filter((a) => a.type === "image" && (a.url || a.base64))
          .map((a) => (a.url || a.base64)!);
        if (founds.length > 0) {
          candidateRefUrls.push(...founds);
          break;
        }
      }
      if (hm.generatedImage?.url) {
        candidateRefUrls.push(hm.generatedImage.url);
        break;
      }
      if (hm.weavyAction?.resultUrl) {
        candidateRefUrls.push(hm.weavyAction.resultUrl);
        break;
      }
    }
  }

  const resolvedRefUrls = Array.from(new Set(candidateRefUrls.filter(Boolean)));
  const primaryRefUrl = resolvedRefUrls[0] || undefined;

  if (parsedJson && parsedJson.prompt) {
    const useRef = Boolean(
      (parsedJson.useReference && resolvedRefUrls.length > 0) ||
      (resolvedRefUrls.length > 0 && (mentionsTwoImages || mentionsThreeImages || isExplicitGenerateCmd))
    );

    let chosenModel = parsedJson.model;
    const isRoomOrInteriorRequest =
      userText.includes("ruangan") ||
      userText.includes("kamar") ||
      userText.includes("room") ||
      userText.includes("interior") ||
      userText.includes("dinding") ||
      userText.includes("lantai") ||
      userText.includes("arsitektur") ||
      userText.includes("rumah") ||
      userText.includes("kantor") ||
      userText.includes("realistis") ||
      userText.includes("realist");

    if (!chosenModel) {
      if (userText.includes("nano banana") || userText.includes("banana")) {
        chosenModel = "Nano Banana Pro";
      } else if (userText.includes("seedream")) {
        chosenModel = "Seedream V5.0 Pro Edit";
      } else if (userText.startsWith("/clean") || isRoomOrInteriorRequest) {
        chosenModel = "Nano Banana Pro";
      } else if (
        userText.startsWith("/ugc") ||
        userText.startsWith("/fashion") ||
        userText.startsWith("/video")
      ) {
        chosenModel = "Seedream V5.0 Pro Edit";
      } else {
        chosenModel = useRef ? "Seedream V5.0 Pro Edit" : "Nano Banana Pro";
      }
    }

    const foundMeta = WEAVY_IMAGE_MODELS.find(
      (m) =>
        m.name.toLowerCase() === chosenModel.toLowerCase() ||
        m.id.toLowerCase().includes(chosenModel.toLowerCase()),
    );
    if (foundMeta) chosenModel = foundMeta.name;

    const promptText = String(parsedJson.prompt || "").trim();
    const isVideo =
      isVideoQuery ||
      Boolean(parsedJson.isVideo) ||
      /(?:sora|runway|kling|veo|luma|pika|cinematic video|drone shot|video footage|motion blur|camera pan|tracking shot)/i.test(promptText);

    const action: WeavyActionData = {
      prompt: promptText,
      model: normalizeWeavyModelName(chosenModel),
      aspectRatio:
        parsedJson.aspectRatio ||
        (userText.startsWith("/clean")
          ? "16:9"
          : userText.startsWith("/fashion") || userText.startsWith("/ugc")
            ? "9:16"
            : isVideo
              ? "16:9"
              : isRoomOrInteriorRequest
                ? "16:9"
                : chosenModel.includes("Seedream")
                  ? "9:16"
                  : "1:1"),
      useReference: useRef,
      referenceImageUrl: useRef ? primaryRefUrl : undefined,
      referenceImageUrls: useRef && resolvedRefUrls.length > 0 ? resolvedRefUrls : undefined,
      reason:
        parsedJson.reason ||
        (resolvedRefUrls.length > 1
          ? `Menggunakan ${resolvedRefUrls.length} gambar referensi sekaligus dari obrolan`
          : useRef
            ? "Menggunakan gambar referensi dari obrolan"
            : isVideo
              ? "Prompt video siap disalin"
              : "Dibuat berdasarkan visual obrolan"),
      status: "suggested",
      isVideoPrompt: isVideo,
    };

    return {
      cleanContent,
      action,
      shouldAutoExecute: isExplicitGenerateCmd && !isVideoQuery && !isPromptOnlyQuery,
    };
  }

  // 5. Fallback: If user explicitly instructed "generate ke gambar" but AI omitted code fence
  if (isExplicitGenerateCmd && !isVideoQuery && !isPromptOnlyQuery) {
    const isRefusal = isGoogleImagenRefusalOrInternalUrl(text);
    const userCleanPrompt = extractCleanVisualPromptFromUser(userMessageText || "");
    const promptCandidate = isRefusal ? userCleanPrompt : (sanitizeFallbackVisualPrompt(text, userMessageText) || userCleanPrompt);

    let displayCleanContent = text;
    if (isRefusal) {
      if (text.startsWith("http://googleusercontent.com") || text.startsWith("https://googleusercontent.com")) {
        displayCleanContent = `Saya telah menyiapkan kartu generator visual berdasarkan permintaan Anda: "${userCleanPrompt || promptCandidate}".`;
      } else {
        displayCleanContent = `Akun Google Gemini Anda aktif & sudah login. Server Google membatasi pembuatan gambar langsung (Imagen) via web chat di jaringan ini. Anda dapat menekan tombol di bawah untuk memproses gambar menggunakan Weavy AI atau penyedia lain:`;
      }
    }

    const useRef = Boolean(resolvedRefUrls.length > 0);
    const isRoomOrInteriorFallback =
      userText.includes("ruangan") ||
      userText.includes("kamar") ||
      userText.includes("room") ||
      userText.includes("interior") ||
      userText.includes("arsitektur") ||
      userText.includes("realistis") ||
      userText.includes("realist");

    let chosenModel = userText.includes("nano banana") || userText.includes("banana")
      ? "Nano Banana Pro"
      : userText.includes("seedream")
        ? "Seedream V5.0 Pro Edit"
        : userText.startsWith("/ugc")
          ? "Seedream V5.0 Pro Edit"
          : userText.startsWith("/clean")
            ? "Nano Banana Pro"
            : (isRoomOrInteriorFallback ? "Nano Banana Pro" : (useRef ? "Seedream V5.0 Pro Edit" : "Nano Banana Pro"));

    const chosenRatio = userText.startsWith("/ugc")
      ? "9:16"
      : userText.startsWith("/clean")
        ? "16:9"
        : (isRoomOrInteriorFallback ? "16:9" : "9:16");

    const action: WeavyActionData = {
      prompt: promptCandidate || userCleanPrompt || "Cinematic visual based on conversation",
      model: normalizeWeavyModelName(chosenModel),
      aspectRatio: chosenRatio,
      useReference: useRef,
      referenceImageUrl: useRef ? primaryRefUrl : undefined,
      referenceImageUrls: useRef && resolvedRefUrls.length > 0 ? resolvedRefUrls : undefined,
      reason: resolvedRefUrls.length > 1
        ? `Menggabungkan ${resolvedRefUrls.length} gambar referensi sekaligus dari obrolan`
        : useRef
          ? "AI menghubungkan foto referensi & instruksi dari obrolan"
          : isRefusal
            ? "Kartu visual siap digenerate dengan Weavy AI / model pilihan"
            : "Diteruskan langsung dari instruksi obrolan ke Weavy AI",
      status: "suggested",
      isVideoPrompt: false,
    };

    return {
      cleanContent: displayCleanContent,
      action,
      shouldAutoExecute: !isRefusal,
    };
  }

  return { cleanContent: text, action: null, shouldAutoExecute: false };
}
