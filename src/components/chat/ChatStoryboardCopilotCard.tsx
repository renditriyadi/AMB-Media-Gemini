import React, { useState } from 'react';
import { dedupeStoryboardScenes } from '../../lib/storyboardScenes';
import {
  Film,
  Copy,
  Check,
  Code2,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  Clock,
  Camera,
  Lightbulb,
  AlertCircle,
  CheckCircle2,
  Target,
  FileText,
  ChevronDown,
} from 'lucide-react';

export interface StoryboardShoot {
  id?: string;
  shootNumber?: number;
  start?: number;
  end?: number;
  visualDescription?: string;
  action?: string;
  cameraAngle?: string;
  voiceover?: string;
  continuity?: string;
}

export interface StoryboardCopilotScene {
  id?: string;
  sceneNumber: number;
  title: string;
  visualDescription?: string;
  voiceover?: string;
  onScreenText?: string;
  cameraMovement?: string;
  cameraAngle?: string;
  lighting?: string;
  duration?: string;
  durationSec?: number | null;
  imagePrompt?: string;
  videoPrompt?: string;
  voInstruction?: string;
  videoInstruction?: string;
  timecode?: string | null;
  start?: number;
  end?: number;
  shoots?: StoryboardShoot[];
}

export interface StoryboardCopilotProject {
  title?: string;
  productName?: string;
  productDesc?: string;
  modelTalent?: string;
  bgSetting?: string;
  brief?: string;
  duration?: number;
  numScenes?: number;
  aspectRatio?: string;
  targetPlatform?: string;
  formula?: string;
  preset?: string;
  aiModel?: string;
  imageModel?: string;
  references?: Record<string, any>;
  visualStyle?: string;
  voiceoverStyle?: string;
  parts?: any[];
  analysis?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  masterProductionSheetPrompt?: string | null;
  scenes: StoryboardCopilotScene[];
}

// Decode HTML entities
export const decodeJsonEntities = (value: string): string => {
  if (!value) return '';
  let s = String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'");

  if (s.includes('\\"') && (s.includes('{\\"') || s.includes('\\":') || s.includes('\\",') || s.includes('\\"]'))) {
    s = s.replace(/\\"/g, '"');
  }
  return s;
};

// Robust repair of truncated JSON (identical to ektension-weavy)
export const repairTruncatedJson = (rawStr: string): any => {
  if (!rawStr || typeof rawStr !== 'string') return null;
  let clean = decodeJsonEntities(rawStr.trim())
    .replace(/^```[a-zA-Z0-9_-]*\r?\n?/i, '')
    .replace(/\r?\n?```$/i, '')
    .trim();

  try {
    return JSON.parse(clean);
  } catch (_) {}

  try {
    let repaired = clean;
    let inString = false;
    let escape = false;
    for (let k = 0; k < repaired.length; k++) {
      const char = repaired[k];
      if (inString) {
        if (escape) escape = false;
        else if (char === '\\') escape = true;
        else if (char === '"') inString = false;
      } else {
        if (char === '"') inString = true;
      }
    }
    if (inString) repaired += '"';

    repaired = repaired
      .replace(/,\s*"[^"]*"\s*:\s*$/g, '')
      .replace(/:\s*$/g, ': null')
      .replace(/,\s*([\]}])/g, '$1')
      .replace(/,\s*$/g, '');

    const openBraces = (repaired.match(/\{/g) || []).length - (repaired.match(/\}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length;

    for (let b = 0; b < Math.max(0, openBrackets); b++) repaired += ']';
    for (let c = 0; c < Math.max(0, openBraces); c++) repaired += '}';

    return JSON.parse(repaired);
  } catch (_) {}

  return null;
};

// Normalize single scene (identical to ektension-weavy)
export const normalizeSingleScene = (sc: any, idx: number): StoryboardCopilotScene | null => {
  if (!sc || typeof sc !== 'object') return null;
  const rawOst = sc.onScreenText || sc.on_screen_text || sc.onscreen_text || sc.onscreenText || sc.text || sc.teks || sc.caption || sc.overlay || sc.screenText || '';
  const cleanOst = /^(?:none|tidak\s+ada(?:\s+teks)?|tanpa\s+teks|kosong|-|n\/a|no\s+text)$/i.test(String(rawOst).trim()) ? '' : String(rawOst).trim();
  let rawImgPrompt = (sc.imagePrompt || sc.image_prompt || sc.prompt || '').trim();

  if (rawImgPrompt) {
    rawImgPrompt = rawImgPrompt
      .replace(/\bwith\s+at\s*,?/gi, '')
      .replace(/\bwith\s+at\b/gi, '')
      .replace(/\bat\s*,/gi, '')
      .replace(/\bwith\s*,/gi, '')
      .replace(/,\s*,+/g, ',')
      .replace(/\s+,/g, ',')
      .trim();

    rawImgPrompt = rawImgPrompt.replace(/featuring\s+([^,]+?)(?=(?:\s+with|\s+at|,|\.|$))/gi, (_match, subject) => {
      let cleanSubject = subject.trim();
      cleanSubject = cleanSubject.replace(/["'“”]/g, '').replace(/[!?]+$/, '').trim();
      if (cleanSubject.includes('—')) cleanSubject = cleanSubject.split('—')[0].trim();
      else if (cleanSubject.includes(' - ')) cleanSubject = cleanSubject.split(' - ')[0].trim();
      cleanSubject = cleanSubject.replace(/^(?:Iklan\s+|Hasil\s+Panen\s+)/i, '');
      return `featuring ${cleanSubject}`;
    });

    if (!cleanOst) {
      rawImgPrompt = rawImgPrompt.replace(/\bcommercial advertising photograph\b/gi, 'cinematic commercial photograph');
      if (!/no\s+(?:text|title|typography|words|banner|stickers|overlay)/i.test(rawImgPrompt)) {
        rawImgPrompt = rawImgPrompt.replace(/\s*,\s*8k\.?$/i, '').replace(/\.*$/, '');
        rawImgPrompt = `${rawImgPrompt}, clean photography, pure visual only, no text, no title, no typography, no banner, no words, no watermark, no overlays, no graphic stickers, 8k.`;
      }
    }

    // Hapus visualisasi keranjang kuning dari klausa positif, TAPI jangan menyentuh klausa larangan
    // ("no yellow shopping cart", "without ..."): larangan itu bagian dari aturan preset dan
    // kalau dihapus hasilnya menjadi "no ," sehingga larangannya hilang dari prompt gambar.
    const cartPhrase = /\b(?:with\s+a\s+|with\s+|holding\s+a\s+|pointing\s+at\s+)?(?:yellow\s+shopping\s+cart|yellow\s+cart|yellow\s+basket|keranjang\s+kuning|shopping\s+cart\s+icon|yellow\s+cta\s+button)\b/gi;
    rawImgPrompt = rawImgPrompt
      .split(',')
      .map((clause) => (/^\s*(?:no|without)\b/i.test(clause) ? clause : clause.replace(cartPhrase, '')))
      .join(',')
      .replace(/,\s*,+/g, ',')
      .trim();
  }

  const cameraMovement = sc.cameraMovement || sc.camera_movement || sc.cameraAngle || sc.camera_angle || sc.camera || sc.angle || sc.shot || sc.shot_type || sc.shotType || sc.framing || sc.movement || '';
  const lighting = sc.lighting || sc.lighting_style || sc.lightingStyle || sc.light || sc.pencahayaan || '';
  const visualDesc = sc.visualDescription || sc.visual_description || sc.visual || sc.visuals || sc.desc || sc.description || sc.action || '';
  let voiceoverText = sc.voiceover || sc.voice_over || sc.vo || sc.narration || sc.script || sc.naskah || sc.dialog || sc.narasi || '';
  const rawDuration = sc.duration || sc.duration_sec || sc.durationSec || sc.timecode || (sc.durationSec ? `${sc.durationSec}s` : '');
  const durationSecNum = Number(sc.durationSec || sc.duration_sec || (typeof sc.duration === 'number' ? sc.duration : parseInt(String(sc.duration || '').replace(/[^\d]/g, ''), 10))) || null;

  const rawShoots = Array.isArray(sc.shoots) ? sc.shoots : (Array.isArray(sc.microShots) ? sc.microShots : []);
  const normalizedShoots: StoryboardShoot[] = rawShoots.map((sh: any, sIdx: number) => {
    if (!sh || typeof sh !== 'object') return null;
    const shootVisual = (sh.visualDescription || sh.action || sh.description || sh.desc || sh.visual || sh.visual_description || sh.shotDescription || sh.prompt || '').trim();
    return {
      id: sh.id || `shoot_${idx + 1}_${sIdx + 1}`,
      shootNumber: sh.shootNumber || sIdx + 1,
      start: sh.start !== undefined ? sh.start : (sIdx * 3),
      end: sh.end !== undefined ? sh.end : ((sIdx + 1) * 3),
      visualDescription: shootVisual,
      action: sh.action || shootVisual || '',
      cameraAngle: sh.cameraAngle || sh.camera || sh.angle || '',
      voiceover: (sh.voiceover || sh.vo || sh.narration || sh.script || sh.dialog || '').trim(),
      continuity: sh.continuity || sh.continuityNotes || '',
    };
  }).filter(Boolean) as StoryboardShoot[];

  if (!voiceoverText && normalizedShoots.length > 0) {
    const shootsVoList = normalizedShoots.map((s) => (s.voiceover || '').trim()).filter(Boolean);
    if (shootsVoList.length > 0) {
      voiceoverText = shootsVoList.join(' ');
    }
  }

  const hasSceneContent = Boolean(
    visualDesc ||
    voiceoverText ||
    rawImgPrompt ||
    sc.videoPrompt ||
    sc.video_prompt ||
    cleanOst ||
    cameraMovement ||
    lighting ||
    sc.title ||
    sc.name ||
    sc.sceneNumber !== undefined ||
    sc.scene_number !== undefined ||
    normalizedShoots.length > 0
  );

  if (!hasSceneContent) return null;

  return {
    id: sc.id || ('sc_' + Date.now() + '_' + (idx + 1) + '_' + Math.random().toString(36).substr(2, 4)),
    sceneNumber: Number(sc.sceneNumber || sc.scene_number || sc.scene || sc.num || sc.no || (idx + 1)),
    title: sc.title || sc.name || sc.headline || sc.scene_title || sc.sceneTitle || `Scene ${idx + 1}`,
    visualDescription: visualDesc,
    voiceover: voiceoverText,
    onScreenText: cleanOst,
    cameraMovement: cameraMovement || 'Medium Shot',
    cameraAngle: cameraMovement || 'Medium Shot',
    lighting: lighting,
    duration: rawDuration || (durationSecNum ? `${durationSecNum}s` : '0-10s'),
    durationSec: durationSecNum,
    imagePrompt: rawImgPrompt,
    videoPrompt: sc.videoPrompt || sc.video_prompt || sc.motion || sc.motion_prompt || '',
    voInstruction: sc.voInstruction || sc.vo_instruction || sc.voiceoverInstruction || sc.instruksiVO || sc.instruksi_vo || '',
    videoInstruction: sc.videoInstruction || sc.video_instruction || sc.instruksiVideo || sc.instruksi_video || '',
    timecode: sc.timecode || null,
    start: sc.start !== undefined ? sc.start : (idx * (durationSecNum || 10)),
    end: sc.end !== undefined ? sc.end : ((idx + 1) * (durationSecNum || 10)),
    shoots: normalizedShoots.length > 0 ? normalizedShoots : undefined,
  };
};

// Normalize parsed object or array into StoryboardCopilotProject
export const normalizeStoryboardProjectObject = (
  data: any,
  fallbackBrief = ''
): StoryboardCopilotProject | null => {
  if (!data) return null;

  if (Array.isArray(data)) {
    const validScenes = dedupeStoryboardScenes(data.map(normalizeSingleScene).filter(Boolean) as StoryboardCopilotScene[]);
    if (validScenes.length > 0) {
      return {
        title: data[0]?.topic || data[0]?.projectTitle || data[0]?.title || (fallbackBrief ? `Garden UGC: ${fallbackBrief.slice(0, 35)}` : 'Rancangan Storyboard'),
        productName: data[0]?.productName || data[0]?.title || fallbackBrief || 'Produk',
        productDesc: data[0]?.productDesc || data[0]?.description || '',
        modelTalent: data[0]?.modelTalent || '',
        bgSetting: data[0]?.bgSetting || '',
        brief: data[0]?.brief || fallbackBrief || '',
        scenes: validScenes,
        numScenes: validScenes.length,
        duration: validScenes.length * 10 || 30,
        aspectRatio: data[0]?.aspectRatio || data[0]?.aspect_ratio || '9:16',
        targetPlatform: data[0]?.targetPlatform || data[0]?.target_platform || data[0]?.platform || 'TikTok',
        formula: 'hook_extreme',
      };
    }
    return null;
  }

  if (typeof data === 'object' && data !== null) {
    let root = data;

    if (root.storyboard_project && typeof root.storyboard_project === 'object') {
      root = root.storyboard_project;
    } else if (root.storyboardProject && typeof root.storyboardProject === 'object') {
      root = root.storyboardProject;
    } else if (root.storyboard_draft && typeof root.storyboard_draft === 'object') {
      root = root.storyboard_draft;
    } else if (root.action === 'create_storyboard_project' && root.project && typeof root.project === 'object') {
      root = root.project;
    } else if (root.type === 'create_storyboard_project' && root.project && typeof root.project === 'object') {
      root = root.project;
    } else if (root.project && typeof root.project === 'object') {
      root = root.project;
    }

    let rawScenes: any[] = [];
    if (Array.isArray(root.scenes)) rawScenes = root.scenes;
    else if (Array.isArray(root.storyboard)) rawScenes = root.storyboard;
    else if (Array.isArray(root.scene_breakdown)) rawScenes = root.scene_breakdown;
    else if (Array.isArray(root.sceneBreakdown)) rawScenes = root.sceneBreakdown;
    else if (Array.isArray(root.panels)) rawScenes = root.panels;
    else if (Array.isArray(root.shots)) rawScenes = root.shots;
    else if (Array.isArray(data.scenes)) rawScenes = data.scenes;
    else if (Array.isArray(data.storyboard)) rawScenes = data.storyboard;

    if (rawScenes.length > 0) {
      const validScenes = dedupeStoryboardScenes(rawScenes.map(normalizeSingleScene).filter(Boolean) as StoryboardCopilotScene[]);
      if (validScenes.length > 0) {
        return {
          title: root.title || root.name || root.metadata?.title || root.productName || data.title || data.productName || (fallbackBrief ? `Garden UGC: ${fallbackBrief.slice(0, 35)}` : 'Rancangan Storyboard'),
          productName: root.productName || root.analysis?.productOrTopicName || root.metadata?.title || root.title || root.name || data.productName || data.title || fallbackBrief || 'Produk',
          productDesc: root.productDesc || root.product_desc || root.description || root.desc || data.productDesc || '',
          modelTalent: root.modelTalent || root.model_talent || root.talent || root.model || data.modelTalent || '',
          bgSetting: root.bgSetting || root.bg_setting || root.setting || root.background || data.bgSetting || '',
          brief: root.brief || root.concept || root.creativeBrief || data.brief || fallbackBrief || '',
          duration: Number(root.duration || root.duration_sec || root.totalDuration || root.metadata?.duration || data.duration) || (validScenes.length * 10) || 30,
          numScenes: validScenes.length,
          aspectRatio: root.aspectRatio || root.aspect_ratio || root.metadata?.aspectRatio || data.aspectRatio || data.aspect_ratio || '9:16',
          targetPlatform: root.targetPlatform || root.target_platform || root.platform || data.targetPlatform || data.target_platform || 'TikTok',
          formula: root.formula || data.formula || 'hook_extreme',
          preset: root.preset || data.preset || '',
          aiModel: root.aiModel || data.aiModel || 'google/gemini-2.5-flash',
          imageModel: root.imageModel || data.imageModel || 'GPT Image 2.5',
          references: root.references || data.references || {},
          parts: Array.isArray(root.parts) ? root.parts : undefined,
          analysis: root.analysis && typeof root.analysis === 'object' ? root.analysis : (data.analysis || null),
          metadata: root.metadata && typeof root.metadata === 'object' ? root.metadata : (data.metadata || null),
          masterProductionSheetPrompt: root.masterProductionSheetPrompt || data.masterProductionSheetPrompt || null,
          scenes: validScenes,
        };
      }
    }

    if (
      (root.sceneNumber !== undefined || root.scene_number !== undefined) &&
      (root.visualDescription || root.visual || root.voiceover || root.description || root.cameraMovement || root.cameraAngle)
    ) {
      const singleScene = normalizeSingleScene(root, 0);
      if (singleScene) {
        return {
          title: root.title || root.productName || (fallbackBrief ? `Garden UGC: ${fallbackBrief.slice(0, 35)}` : 'Rancangan Storyboard'),
          productName: root.productName || fallbackBrief || 'Produk',
          productDesc: root.productDesc || '',
          scenes: [singleScene],
          numScenes: 1,
          duration: Number(root.duration) || 10,
          aspectRatio: root.aspectRatio || root.aspect_ratio || '9:16',
          targetPlatform: root.targetPlatform || root.target_platform || 'TikTok',
          formula: root.formula || 'hook_extreme',
        };
      }
    }
  }
  return null;
};

// Parse structured markdown naskah (Hierarki Bagian ➔ Scene ➔ Shoot) directly into StoryboardCopilotProject
export const parseMarkdownStoryboardHierarchy = (
  text: string,
  defaultBrief = ''
): StoryboardCopilotProject | null => {
  if (!text || typeof text !== 'string') return null;

  const hasSceneMarker = /(?:###\s*(?:BAGIAN|SCENE|Adegan)|(?:Scene|Adegan)\s*\d+)/i.test(text);
  if (!hasSceneMarker) return null;

  const scenes: StoryboardCopilotScene[] = [];
  const sceneSections = text.split(/(?=###?\s*(?:BAGIAN\s*\d+\s*[—–-]\s*)?SCENE\s*\d+|###?\s*Adegan\s*\d+)/i);

  let currentSceneIdx = 0;
  for (const section of sceneSections) {
    const sceneMatch = section.match(/###?\s*(?:BAGIAN\s*\d+\s*[—–-]\s*)?(?:SCENE|Adegan)\s*(\d+)(?:\s*\(([^)]+)\))?/i);
    if (!sceneMatch) continue;

    currentSceneIdx++;
    const sceneNum = parseInt(sceneMatch[1], 10) || currentSceneIdx;
    const durStr = sceneMatch[2] || '';

    let startSec = (sceneNum - 1) * 10;
    let endSec = sceneNum * 10;
    let durationSec = 10;
    if (durStr) {
      const rangeMatch = durStr.match(/(\d+)\s*[—–-]\s*(\d+)\s*s?/i);
      if (rangeMatch) {
        startSec = parseInt(rangeMatch[1], 10);
        endSec = parseInt(rangeMatch[2], 10);
        durationSec = Math.max(1, endSec - startSec);
      } else {
        const singleDur = durStr.match(/(\d+)\s*s?/i);
        if (singleDur) {
          durationSec = parseInt(singleDur[1], 10);
          endSec = startSec + durationSec;
        }
      }
    }

    const titleLine = section.split('\n')[0].replace(/^#+\s*/, '').replace(/[*_#]/g, '').trim();
    const title = titleLine || `Scene ${sceneNum}`;

    const shoots: any[] = [];
    const shootBlocks = section.split(/(?=\*\s*\*\*Shoot\s*\d+|\bShoot\s*\d+\s*\()/i);
    for (const sBlock of shootBlocks) {
      const shootMatch = sBlock.match(/(?:\*\s*\*\*)?Shoot\s*(\d+)(?:\s*\(([^)]+)\))?/i);
      if (!shootMatch) continue;

      const shootNum = parseInt(shootMatch[1], 10);
      const sDurStr = shootMatch[2] || '';
      let sStart = startSec;
      let sEnd = startSec + 3;
      if (sDurStr) {
        const sRange = sDurStr.match(/(\d+)\s*[—–-]\s*(\d+)/);
        if (sRange) {
          sStart = parseInt(sRange[1], 10);
          sEnd = parseInt(sRange[2], 10);
        }
      }

      const visualM = sBlock.match(/[•\*\-]?\s*(?:\*\*)?Visual(?:\*\*)?:\s*([^\n\r]+)/i);
      const visualDesc = visualM ? visualM[1].replace(/[*_\[\]]/g, '').trim() : '';

      const aksiM = sBlock.match(/[•\*\-]?\s*(?:\*\*)?Aksi(?:\*\*)?:\s*([^\n\r]+)/i);
      const action = aksiM ? aksiM[1].replace(/[*_\[\]]/g, '').trim() : '';

      const camM = sBlock.match(/[•\*\-]?\s*(?:\*\*)?Kamera(?:\*\*)?:\s*([^\n\r]+)/i);
      const cameraAngle = camM ? camM[1].replace(/[*_\[\]]/g, '').trim() : 'POV Close-up Handheld';

      const voM = sBlock.match(/[•\*\-]?\s*(?:\*\*)?Voiceover(?:\*\*)?:\s*["“]?([^"”\n\r]+)["”]?/i);
      const vo = voM ? voM[1].replace(/^[\["*_]+|[\]"*_]+$/g, '').trim() : '';

      shoots.push({
        id: `scene-${sceneNum}-shoot-${shootNum}`,
        start: sStart,
        end: sEnd,
        visualDescription: visualDesc || `Shoot ${shootNum} Scene ${sceneNum}`,
        action: action,
        cameraAngle: cameraAngle,
        voiceover: vo,
        continuity: 'Konsisten lokasi dan pencahayaan',
      });
    }

    let combinedVO = '';
    const combVoM = section.match(/Voiceover\s+Gabungan[^\n:]*:\*{0,2}\s*["“]?([^"”\n\r]+)["”]?/i);
    if (combVoM) {
      combinedVO = combVoM[1]
        .replace(/->\s*Total[^\n]*/i, '')
        .replace(/[*_\[\]"“”]/g, '')
        .trim();
    }
    if (!combinedVO && shoots.length > 0) {
      combinedVO = shoots.map((s) => s.voiceover).filter(Boolean).join(' ');
    }

    let imagePrompt = '';
    const imgPromptCodeM = section.match(/Prompt\s+Gambar[^\n]*\s*```(?:text)?\s*([\s\S]*?)\s*```/i);
    if (imgPromptCodeM) {
      imagePrompt = imgPromptCodeM[1].trim();
    } else {
      const imgPromptLineM = section.match(/Prompt\s+Gambar[^\n:]*:\*{0,2}\s*([^\n\r]+)/i);
      if (imgPromptLineM) imagePrompt = imgPromptLineM[1].replace(/[`"*_]/g, '').trim();
    }

    const visualDesc = shoots[0]?.visualDescription || `POV handheld Scene ${sceneNum}`;
    const mainCamera = shoots[0]?.cameraAngle || 'POV Handheld Close-up';
    const videoPrompt = `POV handheld camera with natural micro movement, ${visualDesc.replace(/POV handheld\s*,?/i, '').trim()}, 4k, cinematic realism.`;

    scenes.push({
      id: `scene-${sceneNum}`,
      sceneNumber: sceneNum,
      title: title,
      durationSec: durationSec,
      start: startSec,
      end: endSec,
      cameraAngle: mainCamera,
      visualDescription: visualDesc,
      voiceover: combinedVO,
      onScreenText: '',
      imagePrompt: imagePrompt || `Shot on Sony Alpha A7 IV, 35mm lens. Realistic Indonesian home garden POV handheld shot, ${visualDesc}, clean photography, pure visual only, no text, no title, 8k.`,
      videoPrompt: videoPrompt,
      shoots: shoots.length > 0 ? shoots : undefined,
    });
  }

  const uniqueScenes = dedupeStoryboardScenes(scenes);
  if (uniqueScenes.length === 0) return null;

  return {
    title: defaultBrief ? `Garden UGC: ${defaultBrief.slice(0, 35)}` : 'Garden UGC Storyboard',
    productName: defaultBrief || 'Bibit Tanaman',
    productDesc: 'Bibit tanaman unggul pekarangan rumah',
    preset: 'facelessgardenugc',
    duration: uniqueScenes.reduce((acc, s) => acc + (s.durationSec || 10), 0),
    aspectRatio: '9:16',
    visualStyle: 'Faceless Hands-Only Garden UGC',
    voiceoverStyle: 'Natural Persuasive Female Narration',
    formula: 'faceless_garden_ugc',
    numScenes: uniqueScenes.length,
    scenes: uniqueScenes,
  };
};

// Robust, multi-tier extraction of Storyboard Project from any string or object
export const extractStoryboardProjectFromData = (
  data: any,
  fallbackBrief = ''
): StoryboardCopilotProject | null => {
  if (!data) return null;

  // 1. Direct object / array normalization
  if (typeof data === 'object' && data !== null) {
    return normalizeStoryboardProjectObject(data, fallbackBrief);
  }

  if (typeof data !== 'string') return null;

  // 2. Direct string JSON parse (clean)
  const directParsed = repairTruncatedJson(data);
  if (directParsed) {
    const proj = normalizeStoryboardProjectObject(directParsed, fallbackBrief);
    if (proj && Array.isArray(proj.scenes) && proj.scenes.length > 0) return proj;
  }

  // 2b. PRIORITAS: blok ```storyboard_project``` eksplisit = hasil final.
  // Bila AI menulis lebih dari satu blok (draft lalu revisi), pakai yang TERAKHIR yang valid.
  {
    const finalBlockRegex = /```(?:storyboard_project|storyboard-project|storyboard_copilot|copilot_storyboard)\s*([\s\S]*?)```/gi;
    const finalBlocks: string[] = [];
    let fb: RegExpExecArray | null;
    while ((fb = finalBlockRegex.exec(data)) !== null) finalBlocks.push(fb[1].trim());
    for (let i = finalBlocks.length - 1; i >= 0; i--) {
      const parsedFinal = repairTruncatedJson(finalBlocks[i]);
      if (parsedFinal) {
        const proj = normalizeStoryboardProjectObject(parsedFinal, fallbackBrief);
        if (proj && Array.isArray(proj.scenes) && proj.scenes.length > 0) return proj;
      }
    }
  }

  // 3. Scan explicit code blocks (```storyboard_project ... ``` or ```json ... ```)
  const codeBlockRegex = /```(?:storyboard_project|storyboard-project|storyboard_copilot|storyboard_draft|storyboard|copilot_storyboard|json)?\s*([\s\S]*?)```/gi;
  let codeMatch: RegExpExecArray | null;
  while ((codeMatch = codeBlockRegex.exec(data)) !== null) {
    const blockContent = codeMatch[1].trim();
    if (blockContent.includes('{')) {
      const parsedBlock = repairTruncatedJson(blockContent);
      if (parsedBlock) {
        const proj = normalizeStoryboardProjectObject(parsedBlock, fallbackBrief);
        if (proj && Array.isArray(proj.scenes) && proj.scenes.length > 0) return proj;
      }
    }
  }

  // 4. Scan for balanced JSON object containing "scenes" or "storyboard" or "title"
  let searchIdx = 0;
  while (searchIdx < data.length) {
    const startIdx = data.indexOf('{', searchIdx);
    if (startIdx === -1) break;

    let depth = 0;
    let inString = false;
    let escape = false;
    let endIdx = -1;

    for (let i = startIdx; i < data.length; i++) {
      const c = data[i];
      if (inString) {
        if (escape) escape = false;
        else if (c === '\\') escape = true;
        else if (c === '"') inString = false;
      } else {
        if (c === '"') inString = true;
        else if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }
    }

    if (endIdx !== -1) {
      const candidateStr = data.slice(startIdx, endIdx + 1);
      if (candidateStr.includes('"scenes"') || candidateStr.includes('"storyboard"') || candidateStr.includes('"title"')) {
        const parsedCandidate = repairTruncatedJson(candidateStr);
        if (parsedCandidate) {
          const proj = normalizeStoryboardProjectObject(parsedCandidate, fallbackBrief);
          if (proj && Array.isArray(proj.scenes) && proj.scenes.length > 0) return proj;
        }
      }
      searchIdx = startIdx + 1;
    } else {
      // Incomplete/truncated JSON up to end of string
      const remainder = data.slice(startIdx);
      if (remainder.includes('"scenes"') || remainder.includes('"title"')) {
        const parsedRemainder = repairTruncatedJson(remainder);
        if (parsedRemainder) {
          const proj = normalizeStoryboardProjectObject(parsedRemainder, fallbackBrief);
          if (proj && Array.isArray(proj.scenes) && proj.scenes.length > 0) return proj;
        }
      }
      break;
    }
  }

  // 5. Fallback: Parse structured markdown script hierarchy directly
  const mdProject = parseMarkdownStoryboardHierarchy(data, fallbackBrief);
  if (mdProject && Array.isArray(mdProject.scenes) && mdProject.scenes.length > 0) {
    return mdProject;
  }

  return null;
};

// Format single scene clipboard text with emojis
export const buildSceneClipboardText = (sc: StoryboardCopilotScene, i = 0): string => {
  if (!sc) return '';
  const sceneNum = sc.sceneNumber || (i + 1);
  const rawTitle = (sc.title || `Adegan ${sceneNum}`).trim();
  const cleanTitle = rawTitle.replace(new RegExp(`^Scene\\s*${sceneNum}\\s*[:\\-]?\\s*`, 'i'), '').trim();
  const displayTitle = cleanTitle || rawTitle;
  const lines: string[] = [];

  lines.push(`🎬 Scene ${sceneNum}: ${displayTitle}`);

  const metaParts: string[] = [];
  if (sc.duration) {
    metaParts.push(`⏱️ Durasi: ${String(sc.duration).trim()}`);
  } else if (sc.durationSec) {
    metaParts.push(`⏱️ Durasi: ${sc.durationSec}s`);
  }
  if (sc.cameraMovement || sc.cameraAngle) {
    metaParts.push(`🎥 Shot/Angle: ${String(sc.cameraMovement || sc.cameraAngle).trim()}`);
  }
  if (sc.lighting) {
    metaParts.push(`💡 Lighting: ${String(sc.lighting).trim()}`);
  }
  if (metaParts.length > 0) {
    lines.push(metaParts.join(' | '));
  }

  if (sc.visualDescription) {
    lines.push(`🖼️ Visual: ${sc.visualDescription.trim()}`);
  }

  const hasShoots = Array.isArray(sc.shoots) && sc.shoots.length > 0;
  if (hasShoots && sc.shoots) {
    lines.push(`🎬 Sub-Shots (${sc.shoots.length} Shoot):`);
    sc.shoots.forEach((sh, sIdx) => {
      const shootNum = sh.shootNumber || (sIdx + 1);
      const timeStr = (sh.start !== undefined && sh.end !== undefined)
        ? `${sh.start}–${sh.end}s`
        : `${sIdx * 3}–${(sIdx + 1) * 3}s`;
      const shootVisual = (sh.visualDescription || sh.action || '').trim();
      lines.push(`  • Shoot ${shootNum} (${timeStr}): ${shootVisual}`);
      if (sh.voiceover) {
        lines.push(`    🎙️ "${sh.voiceover.trim()}"`);
      }
    });
  }

  if (sc.videoPrompt) {
    lines.push(`🎬 Motion: ${sc.videoPrompt.trim()}`);
  }

  const shootsVoList = (hasShoots && sc.shoots) ? sc.shoots.map((sh) => (sh.voiceover || '').trim()).filter(Boolean) : [];
  let sceneVo = (sc.voiceover || '').trim();
  if (!sceneVo && shootsVoList.length > 0) {
    sceneVo = shootsVoList.join(' ');
  }
  if (sceneVo) {
    lines.push(`🎙️ VO: "${sceneVo}"`);
  }

  if (sc.voInstruction) {
    lines.push(`🎙️ Instruksi Voice Over: ${sc.voInstruction.trim()}`);
  }
  if (sc.videoInstruction) {
    lines.push(`🚫 Instruksi Video: ${sc.videoInstruction.trim()}`);
  }
  if (sc.onScreenText) {
    lines.push(`💬 Teks Layar: ${sc.onScreenText.trim()}`);
  }
  if (sc.imagePrompt) {
    lines.push(`🖼️ Prompt Gambar: ${sc.imagePrompt.trim()}`);
  }

  return lines.join('\n');
};

// Format full script clipboard text
export const buildFullScriptText = (project: StoryboardCopilotProject): string => {
  let scriptText = `🎬 STORYBOARD: ${project.title || project.productName || 'Video Komersial'}\n`;
  scriptText += `⏱️ Durasi: ${project.duration || 30}s | 🎞️ Scenes: ${project.numScenes || project.scenes.length} | 📐 Aspect: ${project.aspectRatio || '9:16'}\n`;
  if (project.brief) scriptText += `📝 Konsep: ${project.brief}\n\n`;

  if (Array.isArray(project.scenes) && project.scenes.length > 0) {
    project.scenes.forEach((sc, i) => {
      scriptText += `--- SCENE ${sc.sceneNumber || (i + 1)}: ${sc.title || 'Adegan'} ---\n`;
      if (sc.duration || sc.durationSec) scriptText += `⏱️ Durasi: ${sc.duration || `${sc.durationSec}s`}\n`;
      if (sc.cameraAngle || sc.cameraMovement) scriptText += `🎥 Shot/Angle: ${sc.cameraAngle || sc.cameraMovement}\n`;
      if (sc.lighting) scriptText += `💡 Lighting: ${sc.lighting}\n`;
      if (sc.visualDescription) scriptText += `🖼️ Visual: ${sc.visualDescription}\n`;

      if (Array.isArray(sc.shoots) && sc.shoots.length > 0) {
        scriptText += `🎬 Sub-Shots (${sc.shoots.length} Shoot):\n`;
        sc.shoots.forEach((sh, sIdx) => {
          scriptText += `  • Shoot ${sh.shootNumber || (sIdx + 1)} (${sh.start !== undefined && sh.end !== undefined ? `${sh.start}–${sh.end}s` : `${sIdx * 3}–${(sIdx + 1) * 3}s`}): ${sh.visualDescription || ''}\n`;
          if (sh.voiceover) scriptText += `    🎙️ "${sh.voiceover}"\n`;
        });
      }

      if (sc.voiceover) scriptText += `🎙️ Voiceover (VO): "${sc.voiceover}"\n`;
      if (sc.voInstruction) scriptText += `🎙️ Instruksi VO: ${sc.voInstruction}\n`;
      if (sc.videoInstruction) scriptText += `🚫 Instruksi Video: ${sc.videoInstruction}\n`;
      if (sc.onScreenText) scriptText += `💬 On-Screen Text: ${sc.onScreenText}\n`;
      if (sc.videoPrompt) scriptText += `🎬 Prompt Video:\n${sc.videoPrompt}\n`;
      if (sc.imagePrompt) scriptText += `🖼️ Prompt Gambar:\n${sc.imagePrompt}\n`;
      scriptText += `\n`;
    });
  }
  return scriptText.trim();
};

interface ChatStoryboardCopilotCardProps {
  project: StoryboardCopilotProject;
  onApplyStoryboard?: (project: StoryboardCopilotProject) => void;
  onSendToGenerateVideo?: (prompt: string) => void;
}

export const ChatStoryboardCopilotCard: React.FC<ChatStoryboardCopilotCardProps> = ({
  project,
  onApplyStoryboard,
}) => {
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedHook, setCopiedHook] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [copiedSceneIndex, setCopiedSceneIndex] = useState<number | null>(null);
  // Accordion: scene pertama terbuka secara default, sisanya diciutkan
  const [openScenes, setOpenScenes] = useState<Set<number>>(() => new Set([0]));
  const toggleScene = (idx: number) =>
    setOpenScenes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });

  const title = project.title || project.productName || 'Rancangan Storyboard';
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const duration = Number(project.duration) || (scenes.length ? scenes.length * 10 : 30);
  const numScenes = Number(project.numScenes) || scenes.length || 3;
  const aspect = project.aspectRatio || '9:16';
  const targetPlatform = project.targetPlatform || 'TikTok';
  const brief = project.brief || project.productDesc || '';
  const formula = project.formula || 'hook_extreme';

  // Formula badge determination (identical to ektension-weavy)
  const isHarvestPov = formula === 'harvest_pov_taste';
  const isGardenUgc = formula === 'faceless_garden_ugc' || project.preset === 'facelessgardenugc';
  const isBuahUnggul = formula === 'buah_unggul_3x10s' || project.preset === 'buahunggul' || project.preset === 'seedlessfruit' || project.preset === 'cuanbibit';
  const isOnTheSpot = formula === 'on_the_spot_3x10s' || project.preset === 'onthespot' || project.preset === 'spotbibit' || project.preset === 'spotbuah' || project.preset === 'investigasikebun';

  const badgeLabel = isOnTheSpot
    ? '🔥 ON THE SPOT INVESTIGASI (30s)'
    : (isBuahUnggul
      ? '🌟 PRODUK & TANAMAN UNGGUL (30s)'
      : (isGardenUgc
        ? '🌱 FACELESS GARDEN UGC (20s)'
        : (isHarvestPov ? '🌾 POV HARVEST & TASTE (ASMR)' : '🎬 STORYBOARD COPILOT')));

  const formulaLabel = isOnTheSpot
    ? '🔍 On The Spot 3x10s'
    : (isBuahUnggul
      ? '🌟 Universal Unggul 3x10s'
      : (isGardenUgc
        ? '🌱 Garden UGC'
        : (isHarvestPov ? '🌾 ASMR Harvest' : formula)));

  const badgeColors = isOnTheSpot
    ? {
        border: 'border-rose-500/40 bg-rose-500/10 text-rose-400',
        dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]',
        pill: 'text-rose-400 border-rose-500/35 bg-rose-500/10',
      }
    : (isBuahUnggul
      ? {
          border: 'border-orange-500/40 bg-orange-500/10 text-orange-400',
          dot: 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.7)]',
          pill: 'text-orange-400 border-orange-500/35 bg-orange-500/10',
        }
      : (isGardenUgc
        ? {
            border: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
            dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]',
            pill: 'text-emerald-400 border-emerald-500/35 bg-emerald-500/10',
          }
        : (isHarvestPov
          ? {
              border: 'border-green-500/40 bg-green-500/10 text-green-400',
              dot: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.7)]',
              pill: 'text-green-400 border-green-500/35 bg-green-500/10',
            }
          : {
              border: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
              dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]',
              pill: 'text-amber-400 border-amber-500/35 bg-amber-500/10',
            })));

  // Handlers
  const handleCopyScene = (sc: StoryboardCopilotScene, idx: number) => {
    const text = buildSceneClipboardText(sc, idx);
    navigator.clipboard.writeText(text);
    setCopiedSceneIndex(idx);
    setTimeout(() => setCopiedSceneIndex(null), 2000);
  };

  const handleCopyHook = () => {
    const firstScene = scenes[0];
    const hook = firstScene?.voiceover || firstScene?.onScreenText || firstScene?.title || title;
    navigator.clipboard.writeText(hook);
    setCopiedHook(true);
    setTimeout(() => setCopiedHook(false), 2000);
  };

  const handleCopyScript = () => {
    const script = buildFullScriptText(project);
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(project, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="sb-card my-3 rounded-2xl overflow-hidden border border-amber-500/35 bg-gradient-to-b from-amber-500/8 via-[#181615] to-[#121110] shadow-[0_4px_24px_rgba(0,0,0,0.5),0_0_0_1px_rgba(232,162,61,0.12)] transition-all select-none">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-amber-500/12 border-b border-amber-500/20">
        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border font-extrabold text-[11px] tracking-wide uppercase ${badgeColors.border}`}>
          <span className={`w-2 h-2 rounded-full animate-ping shrink-0 ${badgeColors.dot}`} />
          <span>{badgeLabel}</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/40 text-stone-300 border border-white/10 font-mono">
            ⏱️ {duration}s
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/40 text-stone-300 border border-white/10">
            🎞️ {numScenes} Scene
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/40 text-stone-300 border border-white/10 font-mono">
            📐 {aspect}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/30">
            📱 {targetPlatform}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badgeColors.pill}`}>
            ⚡ {formulaLabel}
          </span>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-3.5 space-y-3">
        {/* Project Title */}
        <div className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug">
          {title}
        </div>

        {/* Concept Brief */}
        {brief && (
          <div className="text-xs text-stone-300 bg-black/35 px-3 py-2 rounded-xl border-l-[3px] border-amber-500/80 leading-relaxed">
            {brief}
          </div>
        )}

        {/* Scene List Preview */}
        {scenes.length > 1 && (
          <div className="flex justify-end -mb-1">
            <button
              type="button"
              onClick={() =>
                setOpenScenes((prev) =>
                  prev.size >= scenes.length ? new Set() : new Set(scenes.map((_, i) => i))
                )
              }
              className="text-[11px] font-semibold text-stone-400 hover:text-amber-300 transition-colors cursor-pointer"
            >
              {openScenes.size >= scenes.length ? 'Ciutkan semua' : 'Buka semua'}
            </button>
          </div>
        )}
        <div className="space-y-2.5 pt-1">
          {scenes.map((sc, idx) => {
            const hasShoots = Array.isArray(sc.shoots) && sc.shoots.length > 0;
            const shootsVoList = hasShoots && sc.shoots ? sc.shoots.map((sh) => (sh.voiceover || '').trim()).filter(Boolean) : [];
            let sceneVo = (sc.voiceover || '').trim();
            if (!sceneVo && shootsVoList.length > 0) {
              sceneVo = shootsVoList.join(' ');
            }

            const rawSceneTitle = (sc.title || `Adegan ${idx + 1}`).trim();
            const cleanSceneTitle = rawSceneTitle.replace(new RegExp(`^Scene\\s*${sc.sceneNumber || idx + 1}\\s*[:\\-]?\\s*`, 'i'), '').trim();
            const displaySceneTitle = cleanSceneTitle || rawSceneTitle;

            const voWordCount = sceneVo ? sceneVo.trim().split(/\s+/).filter(Boolean).length : 0;
            const voCharCount = sceneVo ? sceneVo.trim().length : 0;
            const estSec = voWordCount > 0 ? (voWordCount / 2.8).toFixed(1) : '0';
            const isOpen = openScenes.has(idx);

            return (
              <div
                key={idx}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/6 hover:border-amber-500/30 transition-colors space-y-2"
              >
                {/* Scene Header */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  onClick={() => toggleScene(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleScene(idx);
                    }
                  }}
                  className="flex flex-wrap items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-stone-400 shrink-0 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                    />
                    <span className="px-2 py-0.5 rounded text-[11px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Scene {sc.sceneNumber || idx + 1}
                    </span>
                    <span className="text-xs font-bold text-white tracking-tight">
                      {displaySceneTitle}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {sc.duration && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25 flex items-center gap-1">
                        ⏱️ {sc.duration}
                      </span>
                    )}
                    {(sc.cameraMovement || sc.cameraAngle) && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 flex items-center gap-1">
                        🎥 {sc.cameraMovement || sc.cameraAngle}
                      </span>
                    )}
                    {sc.lighting && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/25 flex items-center gap-1">
                        💡 {sc.lighting}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ringkasan satu baris saat diciutkan */}
                {!isOpen && sc.visualDescription && (
                  <div className="text-[11px] text-stone-400 truncate pl-5">{sc.visualDescription}</div>
                )}

                {isOpen && (
                  <div className="space-y-2">
                {/* Visual Description */}
                {sc.visualDescription && (
                  <div className="text-xs text-stone-200 leading-relaxed">
                    <span className="font-semibold text-stone-400">🖼️ Visual:</span>{' '}
                    <span>{sc.visualDescription}</span>
                  </div>
                )}

                {/* Sub-Shots List */}
                {hasShoots && sc.shoots && (
                  <div className="mt-1.5 p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20 space-y-1.5">
                    <div className="text-[10px] font-extrabold uppercase text-emerald-400 tracking-wider flex items-center gap-1">
                      <span>🎬 Sub-Shots ({sc.shoots.length} Shoot):</span>
                    </div>
                    <div className="space-y-1.5 pl-1 border-l-2 border-emerald-500/40">
                      {sc.shoots.map((sh, sIdx) => {
                        const shootVisual = (sh.visualDescription || sh.action || '').trim();
                        return (
                          <div key={sIdx} className="text-[11px] text-stone-300 leading-snug pl-2">
                            <span className="font-bold text-emerald-300">
                              Shoot {sh.shootNumber || sIdx + 1} (
                              {sh.start !== undefined && sh.end !== undefined
                                ? `${sh.start}–${sh.end}s`
                                : `${sIdx * 3}–${(sIdx + 1) * 3}s`}
                              ):
                            </span>{' '}
                            <span>{shootVisual}</span>
                            {sh.voiceover && (
                              <div className="italic text-stone-300 mt-0.5 text-[10.5px]">
                                🎙️ &ldquo;{sh.voiceover}&rdquo;
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Motion / Video Prompt */}
                {sc.videoPrompt && (
                  <div className="text-[11px] text-emerald-400 leading-relaxed font-mono">
                    <span className="font-bold">🎬 Motion:</span> {sc.videoPrompt}
                  </div>
                )}

                {/* Voiceover */}
                {sceneVo && (
                  <div className="text-xs text-stone-200 leading-relaxed italic bg-white/[0.02] p-2 rounded-lg border-l-2 border-amber-400/50">
                    <span className="font-bold not-italic text-stone-400">🎙️ VO:</span> &ldquo;
                    {sceneVo}&rdquo;
                    {/* Pacing Badge */}
                    {voWordCount > 0 && (
                      <span className="ml-2 inline-flex items-center not-italic">
                        {voWordCount < 27 || voCharCount < 175 ? (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/35"
                            title="Durasi narasi kependekan, wajib minimal 27 kata / 180 karakter per scene 10s"
                          >
                            ⚠️ {voWordCount} kata / {voCharCount} kar (~{estSec}s) • Kependekan (&lt; 27 Kata)
                          </span>
                        ) : voWordCount <= 30 && voCharCount <= 210 ? (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/35"
                            title="Durasi narasi ideal 27-30 kata / 180-205 karakter (pas 10 detik & anti-kepotong)"
                          >
                            ⏱️ {voWordCount} kata / {voCharCount} kar (~{estSec}s) • Pas Ideal (27–30 Kata) ✅
                          </span>
                        ) : (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/35"
                            title="Naskah di atas 30 kata atau di atas 210 karakter berisiko terpotong saat render 10 detik!"
                          >
                            ⚠️ {voWordCount} kata / {voCharCount} kar (~{estSec}s) • Kepanjangan (&gt; 30 Kata, Berisiko Kepotong)
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                )}

                {/* Instructions */}
                {sc.voInstruction && (
                  <div className="text-[11px] text-amber-300/90 leading-snug">
                    <span className="font-bold">🎙️ Instruksi VO:</span> {sc.voInstruction}
                  </div>
                )}

                {sc.videoInstruction && (
                  <div className="text-[11px] text-rose-300/90 leading-snug">
                    <span className="font-bold">🚫 Instruksi Video:</span> {sc.videoInstruction}
                  </div>
                )}

                {sc.onScreenText && (
                  <div className="text-[11px] text-sky-300 leading-snug">
                    <span className="font-bold">💬 Teks Layar:</span> {sc.onScreenText}
                  </div>
                )}

                {/* Scene Action Row */}
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => handleCopyScene(sc, idx)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      copiedSceneIndex === idx
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                        : 'bg-white/5 hover:bg-amber-500/20 text-stone-300 hover:text-amber-300 border border-white/10 hover:border-amber-500/40'
                    }`}
                    title="Salin seluruh rincian Scene ini lengkap dengan ikon format pesan"
                  >
                    {copiedSceneIndex === idx ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400 stroke-[2.5]" />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 stroke-[2]" />
                        <span>Salin Scene</span>
                      </>
                    )}
                  </button>
                </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Action Buttons */}
      <div className="p-3 bg-black/40 border-t border-white/8 flex flex-wrap items-center justify-between gap-2">
        {/* Primary CTA: Kirim ke Storyboard */}
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem('amb_studio_pending_project', JSON.stringify(project));
              window.dispatchEvent(new CustomEvent('amb_load_studio_project', { detail: project }));
            } catch (e) {}
            if (onApplyStoryboard) {
              onApplyStoryboard(project);
            }
          }}
          className="flex-1 min-w-[170px] flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-stone-950 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/35 hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer"
          title="Buka dan terapkan rancangan ini di menu Studio Storyboard"
        >
          <Film className="w-4 h-4" />
          <span>🎬 Kirim ke Storyboard</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        {/* Secondary Actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Salin Hook */}
          <button
            type="button"
            onClick={handleCopyHook}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              copiedHook
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}
            title="Salin naskah kalimat Hook pembuka 0-3 detik"
          >
            {copiedHook ? <Check className="w-3 h-3 text-emerald-400" /> : <Target className="w-3 h-3" />}
            <span>{copiedHook ? 'Tersalin' : '🎯 Hook'}</span>
          </button>

          {/* Salin Naskah */}
          <button
            type="button"
            onClick={handleCopyScript}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              copiedScript
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white border-white/10'
            }`}
            title="Salin seluruh naskah dan alur adegan video"
          >
            {copiedScript ? <Check className="w-3 h-3 text-emerald-400" /> : <FileText className="w-3 h-3" />}
            <span>{copiedScript ? 'Tersalin' : 'Naskah'}</span>
          </button>

          {/* Salin JSON */}
          <button
            type="button"
            onClick={handleCopyJson}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              copiedJson
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white border-white/10'
            }`}
            title="Salin data JSON lengkap storyboard"
          >
            {copiedJson ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedJson ? 'Tersalin' : 'JSON'}</span>
          </button>

          {/* Toggle Raw JSON */}
          <button
            type="button"
            onClick={() => setShowRawJson(!showRawJson)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              showRawJson
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white border-white/10'
            }`}
            title="Lihat / Sembunyikan data JSON mentah"
          >
            {showRawJson ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            <span>{showRawJson ? 'Tutup JSON' : 'Lihat JSON'}</span>
          </button>
        </div>
      </div>

      {/* Raw JSON Panel */}
      {showRawJson && (
        <div className="p-3 bg-black/60 border-t border-dashed border-white/10 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-stone-400 tracking-wider">
            <span>📦 Raw Storyboard JSON:</span>
            <span className="font-mono text-stone-500">{scenes.length} Scenes</span>
          </div>
          <pre className="p-3 rounded-xl bg-black/80 border border-white/8 text-[11px] font-mono text-emerald-400 leading-relaxed overflow-x-auto max-h-60 custom-scrollbar whitespace-pre-wrap break-words">
            <code>{JSON.stringify(project, null, 2)}</code>
          </pre>
        </div>
      )}
    </div>
  );
};