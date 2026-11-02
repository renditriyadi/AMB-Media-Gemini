import { escapeHtml } from '../core/utils.js';

// Helper: decode HTML entities in JSON snippets safely and unescape double-escaped strings
export const decodeJsonEntities = (value) => {
  if (!value) return '';
  let s = String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'");

  // If the content contains escaped quotes from stringification (e.g. {\"title\": \"...\"})
  if (s.includes('\\"') && (s.includes('{\\"') || s.includes('{\\n  \\"') || s.includes('{\\r\\n  \\"') || s.includes('\\":') || s.includes('\\",') || s.includes('\\"]'))) {
    s = s.replace(/\\"/g, '"');
  }
  return s;
};

export const repairTruncatedJson = (rawStr) => {
  if (!rawStr || typeof rawStr !== 'string') return null;
  let clean = decodeJsonEntities(rawStr.trim())
    .replace(/^```[a-zA-Z0-9_-]*\r?\n?/i, '')
    .replace(/\r?\n?```$/i, '')
    .trim();

  // 1. Try standard parse
  try {
    return JSON.parse(clean);
  } catch (_) {}

  // 2. Fix unclosed strings and dangling keys/commas
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

export const normalizeSingleScene = (sc, idx) => {
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

    rawImgPrompt = rawImgPrompt.replace(/featuring\s+([^,]+?)(?=(?:\s+with|\s+at|,|\.|$))/gi, (match, subject) => {
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

    // VO-Only Semantic Separation: Never let "keranjang kuning" / "yellow cart" become visual objects
    rawImgPrompt = rawImgPrompt
      .replace(/\b(?:with\s+a\s+|with\s+|holding\s+a\s+|pointing\s+at\s+)?(?:yellow\s+shopping\s+cart|yellow\s+cart|yellow\s+basket|keranjang\s+kuning|shopping\s+cart\s+icon|yellow\s+cta\s+button)\b/gi, '')
      .replace(/,\s*,+/g, ',')
      .trim();
  }

  const cameraMovement = sc.cameraMovement || sc.camera_movement || sc.cameraAngle || sc.camera_angle || sc.camera || sc.angle || sc.shot || sc.shot_type || sc.shotType || sc.framing || sc.movement || '';
  const lighting = sc.lighting || sc.lighting_style || sc.lightingStyle || sc.light || sc.pencahayaan || '';
  const visualDesc = sc.visualDescription || sc.visual_description || sc.visual || sc.visuals || sc.desc || sc.description || sc.action || '';
  let voiceoverText = sc.voiceover || sc.voice_over || sc.vo || sc.narration || sc.script || sc.naskah || sc.dialog || sc.narasi || '';
  const rawDuration = sc.duration || sc.duration_sec || sc.durationSec || sc.timecode || (sc.durationSec ? `${sc.durationSec}s` : '');
  const durationSecNum = Number(sc.durationSec || sc.duration_sec || (typeof sc.duration === 'number' ? sc.duration : parseInt(String(sc.duration || '').replace(/[^\d]/g, ''), 10))) || null;

  // Preserve shoots (sub-shots) if present
  const rawShoots = Array.isArray(sc.shoots) ? sc.shoots : (Array.isArray(sc.microShots) ? sc.microShots : []);
  const normalizedShoots = rawShoots.map((sh, sIdx) => {
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
  }).filter(Boolean);

  // Fallback scene voiceover from shoots ONLY if scene voiceover is completely empty
  if (!voiceoverText && normalizedShoots.length > 0) {
    const shootsVoList = normalizedShoots.map((s) => (s.voiceover || '').trim()).filter(Boolean);
    if (shootsVoList.length > 0) {
      voiceoverText = shootsVoList.join(' ');
    }
  }

  // Verify that the object actually looks like a scene item rather than random JSON
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
    duration: rawDuration || (durationSecNum ? `${durationSecNum}s` : '0-3s'),
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

// Helper to extract and normalize Storyboard Project from any JSON object or array
export const extractStoryboardProjectFromData = (data) => {
  if (!data) return null;
  if (typeof data === 'string') {
    let parsed = repairTruncatedJson(data);
    if (!parsed) {
      let clean = decodeJsonEntities(data).trim()
        .replace(/^```[a-zA-Z0-9_-]*\r?\n?/i, '')
        .replace(/\r?\n?```$/i, '')
        .trim();

      const startObj = clean.indexOf('{');
      const endObj = clean.lastIndexOf('}');
      if (startObj >= 0 && endObj > startObj) {
        parsed = repairTruncatedJson(clean.slice(startObj, endObj + 1));
      }
    }
    if (!parsed) return null;
    data = parsed;
  }

  if (Array.isArray(data)) {
    const validScenes = data.map(normalizeSingleScene).filter(Boolean);
    if (validScenes.length > 0) {
      return {
        title: data[0]?.topic || data[0]?.projectTitle || data[0]?.title || 'Rancangan Storyboard',
        productName: data[0]?.productName || data[0]?.title || 'Produk',
        productDesc: data[0]?.productDesc || data[0]?.description || '',
        modelTalent: data[0]?.modelTalent || '',
        bgSetting: data[0]?.bgSetting || '',
        brief: data[0]?.brief || '',
        scenes: validScenes,
        numScenes: validScenes.length,
        duration: validScenes.length * 4 || 15,
        aspectRatio: data[0]?.aspectRatio || data[0]?.aspect_ratio || '9:16',
        targetPlatform: data[0]?.targetPlatform || data[0]?.target_platform || data[0]?.platform || 'TikTok',
        formula: 'hook_extreme',
      };
    }
    return null;
  }

  if (typeof data === 'object' && data !== null) {
    let root = data;

    // Unpack nested storyboard wrappers if present
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

    let rawScenes = [];
    if (Array.isArray(root.scenes)) rawScenes = root.scenes;
    else if (Array.isArray(root.storyboard)) rawScenes = root.storyboard;
    else if (Array.isArray(root.scene_breakdown)) rawScenes = root.scene_breakdown;
    else if (Array.isArray(root.sceneBreakdown)) rawScenes = root.sceneBreakdown;
    else if (Array.isArray(root.panels)) rawScenes = root.panels;
    else if (Array.isArray(root.shots)) rawScenes = root.shots;
    else if (Array.isArray(data.scenes)) rawScenes = data.scenes;
    else if (Array.isArray(data.storyboard)) rawScenes = data.storyboard;

    if (rawScenes.length > 0) {
      const validScenes = rawScenes.map(normalizeSingleScene).filter(Boolean);
      if (validScenes.length > 0) {
        return {
          title: root.title || root.name || root.productName || data.title || data.productName || 'Rancangan Storyboard',
          productName: root.productName || root.title || root.name || data.productName || data.title || 'Produk',
          productDesc: root.productDesc || root.product_desc || root.description || root.desc || data.productDesc || '',
          modelTalent: root.modelTalent || root.model_talent || root.talent || root.model || data.modelTalent || '',
          bgSetting: root.bgSetting || root.bg_setting || root.setting || root.background || data.bgSetting || '',
          brief: root.brief || root.concept || root.creativeBrief || data.brief || '',
          duration: Number(root.duration || root.duration_sec || root.totalDuration || data.duration) || (validScenes.length * 4) || 15,
          numScenes: Number(root.numScenes || root.num_scenes || data.numScenes) || validScenes.length || 4,
          aspectRatio: root.aspectRatio || root.aspect_ratio || data.aspectRatio || data.aspect_ratio || '9:16',
          targetPlatform: root.targetPlatform || root.target_platform || root.platform || data.targetPlatform || data.target_platform || 'TikTok',
          formula: root.formula || data.formula || 'hook_extreme',
          aiModel: root.aiModel || data.aiModel || 'google/gemini-2.5-flash',
          imageModel: root.imageModel || data.imageModel || 'GPT Image 2.5',
          references: root.references || data.references || {},
          scenes: validScenes,
        };
      }
    }

    // Single scene object check (e.g. user prompt asks for single shot concept)
    if (
      (root.sceneNumber !== undefined || root.scene_number !== undefined) &&
      (root.visualDescription || root.visual || root.voiceover || root.description || root.cameraMovement || root.cameraAngle)
    ) {
      const singleScene = normalizeSingleScene(root, 0);
      if (singleScene) {
        return {
          title: root.title || root.productName || 'Rancangan Storyboard',
          productName: root.productName || 'Produk',
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

// Syntax highlighter helper for readable generic JSON Viewer
export const highlightJsonSyntax = (escapedJsonStr) => {
  if (!escapedJsonStr) return '';
  return escapedJsonStr.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
};

// Helper to render readable Generic JSON Viewer in Chat UI
export const renderGenericJsonViewer = (data, options = {}) => {
  if (!data) return '';
  let obj = data;
  if (typeof obj === 'string') {
    obj = repairTruncatedJson(obj);
    if (!obj || typeof obj !== 'object') {
      try {
        obj = JSON.parse(decodeJsonEntities(data.trim().replace(/^```[a-zA-Z0-9_-]*\r?\n?/i, '').replace(/\r?\n?```$/i, '')));
      } catch (_) {
        return '';
      }
    }
  }

  if (!obj || typeof obj !== 'object') return '';

  const isArray = Array.isArray(obj);
  const itemCount = isArray ? obj.length : Object.keys(obj).length;
  const countLabel = isArray ? `${itemCount} item` : `${itemCount} properti`;
  const prettyJson = JSON.stringify(obj, null, 2);
  const encJson = encodeURIComponent(prettyJson);
  const syntaxHighlighted = highlightJsonSyntax(escapeHtml(prettyJson));

  const html = `
    <div class="chat-generic-json-card">
      <div class="generic-json-header">
        <div class="generic-json-badge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <span class="generic-json-title">Data Terstruktur (JSON)</span>
          <span class="generic-json-count">${countLabel}</span>
        </div>
        <div class="generic-json-actions">
          <button type="button" class="btn-copy-generic-json" data-json="${encJson}" title="Salin data JSON lengkap">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>Salin JSON</span>
          </button>
        </div>
      </div>
      <div class="generic-json-body">
        <pre class="generic-json-pre"><code>${syntaxHighlighted}</code></pre>
      </div>
    </div>
  `;

  if (typeof options?.preserveBlock === 'function') {
    return options.preserveBlock(html);
  }
  return html;
};

// Response Classifier: detectAssistantResponseType
export const detectAssistantResponseType = (content) => {
  if (!content || typeof content !== 'string' || !content.trim()) return 'text';
  const trimmed = content.trim();

  // 1. Storyboard schema detection
  const storyboardProject = extractStoryboardProjectFromData(trimmed);
  if (storyboardProject && Array.isArray(storyboardProject.scenes) && storyboardProject.scenes.length > 0) {
    return 'storyboard';
  }

  // 2. Generic JSON check
  let cleanJsonCandidate = trimmed;
  if (cleanJsonCandidate.startsWith('```json') || cleanJsonCandidate.startsWith('```')) {
    cleanJsonCandidate = cleanJsonCandidate.replace(/^```[a-zA-Z0-9_-]*\r?\n?/i, '').replace(/\r?\n?```$/i, '').trim();
  }
  if (
    (cleanJsonCandidate.startsWith('{') && cleanJsonCandidate.endsWith('}')) ||
    (cleanJsonCandidate.startsWith('[') && cleanJsonCandidate.endsWith(']'))
  ) {
    try {
      const parsed = JSON.parse(decodeJsonEntities(cleanJsonCandidate));
      if (parsed && typeof parsed === 'object') {
        return 'json';
      }
    } catch (_) {}
  }

  // 3. Fenced code block (non-json / other programming language)
  if (/^```[a-zA-Z0-9_-]*\r?\n[\s\S]*\r?\n```$/i.test(trimmed)) {
    return 'code';
  }

  // 4. Markdown detection
  if (
    /(^|\n)#{1,6}\s+/.test(trimmed) ||
    /\*\*([^\*]+)\*\*/.test(trimmed) ||
    /(^|\n)(?:•|\*|-|\d+\.)\s+/.test(trimmed) ||
    /(^|\n)\|[^\n]+\|[^\n]+\|/.test(trimmed) ||
    /(^|\n)&gt;/.test(trimmed) ||
    /\[.+\]\(.+\)/.test(trimmed)
  ) {
    return 'markdown';
  }

  return 'text';
};

// Helper to build high-fidelity formatted plain-text for single scene copy with all icons & fields
export const buildSceneClipboardText = (sc, i = 0) => {
  if (!sc) return '';
  const sceneNum = sc.sceneNumber || (i + 1);
  const rawTitle = (sc.title || `Adegan ${sceneNum}`).trim();
  const cleanTitle = rawTitle.replace(new RegExp(`^Scene\\s*${sceneNum}\\s*[:\\-]?\\s*`, 'i'), '').trim();
  const displayTitle = cleanTitle || rawTitle;
  const lines = [];

  // Scene header
  lines.push(`🎬 Scene ${sceneNum}: ${displayTitle}`);

  // Duration, Camera/Angle, Lighting
  const metaParts = [];
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

  // Visual
  if (sc.visualDescription) {
    lines.push(`🖼️ Visual: ${sc.visualDescription.trim()}`);
  }

  // Sub-Shots (Multi-Shoot Pacing)
  const hasShoots = Array.isArray(sc.shoots) && sc.shoots.length > 0;
  if (hasShoots) {
    lines.push(`🎬 Sub-Shots (${sc.shoots.length} Shoot):`);
    sc.shoots.forEach((sh, sIdx) => {
      const shootNum = sh.shootNumber || (sIdx + 1);
      const timeStr = (sh.start !== undefined && sh.end !== undefined)
        ? `${sh.start}–${sh.end}s`
        : `${sIdx * 3}–${(sIdx + 1) * 3}s`;
      const shootVisual = (sh.visualDescription || sh.action || sh.description || sh.desc || sh.visual || '').trim();
      lines.push(`  • Shoot ${shootNum} (${timeStr}): ${shootVisual}`);
      if (sh.voiceover) {
        lines.push(`    🎙️ "${sh.voiceover.trim()}"`);
      }
    });
  }

  // Motion / Video Prompt
  if (sc.videoPrompt) {
    lines.push(`🎬 Motion: ${sc.videoPrompt.trim()}`);
  }

  // Voiceover (VO) - respect scene VO, only fallback to sub-shots if scene VO is empty
  const shootsVoList = hasShoots ? sc.shoots.map((sh) => (sh.voiceover || '').trim()).filter(Boolean) : [];
  let sceneVo = (sc.voiceover || '').trim();
  if (!sceneVo && shootsVoList.length > 0) {
    sceneVo = shootsVoList.join(' ');
  }
  if (sceneVo) {
    lines.push(`🎙️ VO: "${sceneVo}"`);
  }

  // Instruksi Voice Over
  if (sc.voInstruction) {
    lines.push(`🎙️ Instruksi Voice Over: ${sc.voInstruction.trim()}`);
  }

  // Instruksi Video
  if (sc.videoInstruction) {
    lines.push(`🚫 Instruksi Video: ${sc.videoInstruction.trim()}`);
  }

  // Teks Layar
  if (sc.onScreenText) {
    lines.push(`💬 Teks Layar: ${sc.onScreenText.trim()}`);
  }

  // Prompt Gambar
  if (sc.imagePrompt) {
    lines.push(`🖼️ Prompt Gambar: ${sc.imagePrompt.trim()}`);
  }

  return lines.join('\n');
};

// Helper to render interactive Storyboard Copilot Proposal Card in Chat UI
export const renderChatStoryboardCopilotCard = (projectData = {}, options = {}) => {
  if (!projectData) return null;
  const project = extractStoryboardProjectFromData(projectData);
  if (!project) return null;

  const cardId = 'sb_card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const title = project.title || project.productName || 'Rancangan Storyboard';
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const duration = Number(project.duration) || (scenes.length ? scenes.length * 4 : 15);
  const numScenes = Number(project.numScenes) || scenes.length || 4;
  const aspect = project.aspectRatio || '9:16';
  const targetPlatform = project.targetPlatform || 'TikTok';
  const brief = project.brief || project.productDesc || '';
  const formula = project.formula || 'hook_extreme';
  const prettyJson = JSON.stringify(project, null, 2);
  const encProject = encodeURIComponent(JSON.stringify(project));
  const syntaxHighlightedJson = highlightJsonSyntax(escapeHtml(prettyJson));

  let scenesHtml = '';
  if (scenes.length > 0) {
    scenesHtml = `
      <div class="sb-copilot-scenes-preview">
        ${scenes.map((sc, i) => {
          const hasShoots = Array.isArray(sc.shoots) && sc.shoots.length > 0;
          const shootsVoList = hasShoots ? sc.shoots.map((sh) => (sh.voiceover || '').trim()).filter(Boolean) : [];
          let sceneVo = (sc.voiceover || '').trim();

          // Only fallback to shoots VO if scene VO is completely missing
          if (!sceneVo && shootsVoList.length > 0) {
            sceneVo = shootsVoList.join(' ');
          }

          const sceneClipboardText = buildSceneClipboardText(sc, i);
          const encSceneText = encodeURIComponent(sceneClipboardText);
          const sceneNumberLabel = sc.sceneNumber || (i + 1);
          const rawSceneTitle = (sc.title || `Adegan ${i + 1}`).trim();
          const cleanSceneTitle = rawSceneTitle.replace(new RegExp(`^Scene\\s*${sceneNumberLabel}\\s*[:\\-]?\\s*`, 'i'), '').trim();
          const displaySceneTitle = cleanSceneTitle || rawSceneTitle;

          const voWordCount = sceneVo ? sceneVo.trim().split(/\s+/).filter(Boolean).length : 0;
          const voCharCount = sceneVo ? sceneVo.trim().length : 0;
          // Voiceover requirement: minimal 27 kata, maksimal 30 kata (180–205 karakter, maks 210 karakter per scene 10 detik anti-kepotong)
          const estSec = voWordCount > 0 ? (voWordCount / 2.8).toFixed(1) : '0';
          let voPacingBadge = '';
          if (voWordCount > 0) {
            if (voWordCount < 27 || voCharCount < 175) {
              voPacingBadge = `<span style="font-size:9.5px; color:#fbbf24; background:rgba(251,191,36,0.12); padding:1px 5px; border-radius:3px; border:1px solid rgba(251,191,36,0.25); font-weight:600; margin-left:6px; vertical-align:middle;" title="Durasi narasi kependekan, wajib minimal 27 kata / 180 karakter per scene">⚠️ ${voWordCount} kata / ${voCharCount} kar (~${estSec}s) • Kependekan (< 27 Kata)</span>`;
            } else if (voWordCount <= 30 && voCharCount <= 210) {
              voPacingBadge = `<span style="font-size:9.5px; color:#34d399; background:rgba(52,211,153,0.12); padding:1px 5px; border-radius:3px; border:1px solid rgba(52,211,153,0.25); font-weight:600; margin-left:6px; vertical-align:middle;" title="Durasi narasi ideal 27-30 kata / 180-205 karakter (pas 10 detik & anti-kepotong)">⏱️ ${voWordCount} kata / ${voCharCount} kar (~${estSec}s) • Pas Ideal (27–30 Kata / 180–205 Kar) ✅</span>`;
            } else {
              voPacingBadge = `<span style="font-size:9.5px; color:#f87171; background:rgba(248,113,113,0.12); padding:1px 5px; border-radius:3px; border:1px solid rgba(248,113,113,0.25); font-weight:600; margin-left:6px; vertical-align:middle;" title="Naskah di atas 30 kata atau di atas 210 karakter berisiko kepotong saat render 10 detik!">⚠️ ${voWordCount} kata / ${voCharCount} kar (~${estSec}s) • Kepanjangan (> 30 Kata / > 210 Kar, Berisiko Kepotong)</span>`;
            }
          }

          const shootsHtml = hasShoots ? `
            <div style="margin-top:6px; padding:6px 8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:6px; display:flex; flex-direction:column; gap:4px;">
              <span style="font-size:10px; font-weight:700; color:#34d399; text-transform:uppercase; letter-spacing:0.5px;">🎬 Sub-Shots (${sc.shoots.length} Shoot):</span>
              ${sc.shoots.map((sh, sIdx) => {
                const shootVisual = (sh.visualDescription || sh.action || sh.description || sh.desc || sh.visual || '').trim();
                const shootVo = (sh.voiceover || sh.vo || sh.narration || '').trim();
                return `
                <div style="font-size:10.5px; color:var(--text-secondary); line-height:1.4; border-left:2px solid rgba(52,211,153,0.4); padding-left:6px; margin-top:2px;">
                  <span style="color:#6ee7b7; font-weight:600;">Shoot ${sh.shootNumber || (sIdx + 1)} (${sh.start !== undefined && sh.end !== undefined ? `${sh.start}–${sh.end}s` : `${sIdx * 3}–${(sIdx + 1) * 3}s`}):</span>
                  ${shootVisual ? ` ${escapeHtml(shootVisual)}` : ''}
                  ${shootVo ? `<div style="font-style:italic; color:#e2e8f0; font-size:10px; margin-top:1px;">🎙️ &ldquo;${escapeHtml(shootVo)}&rdquo;</div>` : ''}
                </div>
              `;
              }).join('')}
            </div>
          ` : '';

          return `
          <div class="sb-copilot-scene-item" data-scene-num="${sceneNumberLabel}" data-scene-idx="${i}">
            <span class="sb-copilot-scene-num">Scene ${sceneNumberLabel}</span>
            <div class="sb-copilot-scene-content">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; flex-wrap:wrap;">
                <span class="sb-copilot-scene-title">${escapeHtml(displaySceneTitle)}</span>
                <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                  ${sc.duration ? `<span style="font-size:10px; color:#38bdf8; background:rgba(56,189,248,0.12); padding:1px 5px; border-radius:3px; border:1px solid rgba(56,189,248,0.2);">⏱️ ${escapeHtml(String(sc.duration))}</span>` : ''}
                  ${(sc.cameraMovement || sc.cameraAngle) ? `<span style="font-size:10px; color:#fbbf24; background:rgba(232,162,61,0.12); padding:1px 5px; border-radius:3px; border:1px solid rgba(232,162,61,0.2);">🎥 ${escapeHtml(sc.cameraMovement || sc.cameraAngle)}</span>` : ''}
                  ${sc.lighting ? `<span style="font-size:10px; color:#a78bfa; background:rgba(167,139,250,0.12); padding:1px 5px; border-radius:3px; border:1px solid rgba(167,139,250,0.2);">💡 ${escapeHtml(sc.lighting)}</span>` : ''}
                </div>
              </div>
              ${sc.visualDescription ? `<span class="sb-copilot-scene-desc" style="color:var(--text-primary); margin-top:2px;">🖼️ <strong>Visual:</strong> ${escapeHtml(sc.visualDescription)}</span>` : ''}
              ${shootsHtml}
              ${sc.videoPrompt ? `<span class="sb-copilot-scene-desc" style="color:#34d399; font-size:10.5px; margin-top:3px;">🎬 <strong>Motion:</strong> ${escapeHtml(sc.videoPrompt)}</span>` : ''}
              ${sceneVo ? `<span class="sb-copilot-scene-desc" style="color:var(--text-secondary); font-style:italic;">🎙️ <strong>VO:</strong> &ldquo;${escapeHtml(sceneVo)}&rdquo; ${voPacingBadge}</span>` : ''}
              ${sc.voInstruction ? `<span class="sb-copilot-scene-desc" style="color:#fbbf24; font-size:10.5px; margin-top:2px;">🎙️ <strong>Instruksi Voice Over:</strong> ${escapeHtml(sc.voInstruction)}</span>` : ''}
              ${sc.videoInstruction ? `<span class="sb-copilot-scene-desc" style="color:#f87171; font-size:10.5px; margin-top:2px;">🚫 <strong>Instruksi Video:</strong> ${escapeHtml(sc.videoInstruction)}</span>` : ''}
              ${sc.onScreenText ? `<span class="sb-copilot-scene-desc" style="color:#60a5fa; font-size:10.5px;">💬 <strong>Teks Layar:</strong> ${escapeHtml(sc.onScreenText)}</span>` : ''}
              
              <div class="sb-copilot-scene-actions-row">
                <button type="button" class="btn-copy-scene-item" data-scene-text="${encSceneText}" data-scene-num="${sceneNumberLabel}" data-scene-idx="${i}" title="Salin seluruh isi Scene ${sceneNumberLabel} lengkap dengan ikon dan teks">
                  <svg class="scene-copy-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <span class="btn-copy-label">Salin Scene</span>
                </button>
              </div>
            </div>
          </div>
        `;
        }).join('')}
      </div>
    `;
  }

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
        : (isHarvestPov ? '🌾 ASMR Harvest' : escapeHtml(formula))));
  const badgeStyle = isOnTheSpot
    ? 'style="border-color:rgba(239,68,68,0.4); background:rgba(239,68,68,0.1);"'
    : (isBuahUnggul
      ? 'style="border-color:rgba(249,115,22,0.35);"'
      : (isGardenUgc
        ? 'style="border-color:rgba(16,185,129,0.3);"'
        : (isHarvestPov ? 'style="border-color:rgba(34,197,94,0.3);"' : '')));
  const pulseStyle = isOnTheSpot
    ? 'style="background:#ef4444; box-shadow:0 0 8px rgba(239,68,68,0.6);"'
    : (isBuahUnggul
      ? 'style="background:#f97316;"'
      : (isGardenUgc
        ? 'style="background:#10b981;"'
        : (isHarvestPov ? 'style="background:#22c55e;"' : '')));
  const textStyle = isOnTheSpot
    ? 'style="color:#f87171; font-weight:700;"'
    : (isBuahUnggul
      ? 'style="color:#fb923c;"'
      : (isGardenUgc
        ? 'style="color:#34d399;"'
        : (isHarvestPov ? 'style="color:#4ade80;"' : '')));
  const pillStyle = isOnTheSpot
    ? 'color:#f87171; border-color:rgba(239,68,68,0.4); background:rgba(239,68,68,0.08);'
    : (isBuahUnggul
      ? 'color:#fb923c; border-color:rgba(249,115,22,0.35);'
      : (isGardenUgc
        ? 'color:#34d399; border-color:rgba(16,185,129,0.3);'
        : (isHarvestPov ? 'color:#4ade80; border-color:rgba(34,197,94,0.3);' : 'color:#fbbf24; border-color:rgba(232,162,61,0.3);')));

  const cardHtml = `
    <div class="chat-storyboard-copilot-card" id="${cardId}">
      <div class="sb-copilot-card-header">
        <div class="sb-copilot-card-badge" ${badgeStyle}>
          <span class="sb-copilot-pulse-dot" ${pulseStyle}></span>
          <span class="sb-copilot-badge-text" ${textStyle}>${badgeLabel}</span>
        </div>
        <div class="sb-copilot-meta-pills">
          <span class="sb-copilot-pill">⏱️ ${duration}s</span>
          <span class="sb-copilot-pill">🎞️ ${numScenes} Scene</span>
          <span class="sb-copilot-pill">📐 ${escapeHtml(aspect)}</span>
          <span class="sb-copilot-pill" style="color:#38bdf8; border-color:rgba(56,189,248,0.3);">📱 ${escapeHtml(targetPlatform)}</span>
          <span class="sb-copilot-pill" style="${pillStyle}">⚡ ${formulaLabel}</span>
        </div>
      </div>
      <div class="sb-copilot-card-body">
        <div class="sb-copilot-project-title">${escapeHtml(title)}</div>
        ${brief ? `<div class="sb-copilot-brief-text">${escapeHtml(brief)}</div>` : ''}
        ${scenesHtml}
      </div>
      <div class="sb-copilot-card-footer">
        <button type="button" class="btn-apply-storyboard-from-chat" data-project="${encProject}" title="Kirim rancangan dan buka di editor Storyboard">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          <span>🎬 Kirim ke Storyboard</span>
        </button>
        <button type="button" class="btn-copy-hook-only" data-project="${encProject}" title="Salin naskah kalimat Hook pembuka 0-3 detik">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
          <span>🎯 Salin Hook</span>
        </button>
        <button type="button" class="btn-copy-storyboard-script" data-project="${encProject}" title="Salin seluruh naskah/prompt storyboard">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>Salin Naskah</span>
        </button>
        <button type="button" class="btn-copy-storyboard-json" data-project="${encProject}" title="Salin data JSON lengkap storyboard">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          <span>Salin JSON</span>
        </button>
        <button type="button" class="btn-toggle-storyboard-raw-json" data-target="${cardId}_raw" title="Lihat/Sembunyikan data JSON mentah">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <span>Lihat JSON</span>
        </button>
      </div>
      <div class="sb-copilot-raw-json-panel hidden" id="${cardId}_raw">
        <div class="sb-copilot-raw-json-header">
          <span>📦 Raw Storyboard JSON:</span>
        </div>
        <pre class="sb-copilot-raw-json"><code>${syntaxHighlightedJson}</code></pre>
      </div>
    </div>
  `;

  if (typeof options?.preserveBlock === 'function') {
    return options.preserveBlock(cardHtml);
  }
  return cardHtml;
};

// Helper to strip any echoed outbound system instructions, transcripts, or prompt wrappers
export function stripOutboundPromptEcho(text) {
  if (!text || typeof text !== 'string') return '';
  let s = text.trim();

  // If text starts with [System Instruction: ...]
  if (/^\[System Instruction:/i.test(s)) {
    const userInstMatch = s.search(/\[Instruksi User(?: Saat Ini)?\]:\s*/i);
    if (userInstMatch >= 0) {
      const rest = s.slice(userInstMatch).replace(/^\[Instruksi User(?: Saat Ini)?\]:\s*/i, '').trim();
      const parts = rest.split(/\n\s*\n/);
      if (parts.length > 1) {
        s = parts.slice(1).join('\n\n').trim();
      } else {
        s = '';
      }
    } else {
      s = '';
    }
  }

  // Strip [RIWAYAT LENGKAP PERCAKAPAN SEBELUMNYA]: ... if echoed
  if (/^\[RIWAYAT LENGKAP PERCAKAPAN SEBELUMNYA\]:/i.test(s)) {
    const userInstMatch = s.search(/\[Instruksi User(?: Saat Ini)?\]:\s*/i);
    if (userInstMatch >= 0) {
      const rest = s.slice(userInstMatch).replace(/^\[Instruksi User(?: Saat Ini)?\]:\s*/i, '').trim();
      const parts = rest.split(/\n\s*\n/);
      if (parts.length > 1) {
        s = parts.slice(1).join('\n\n').trim();
      } else {
        s = '';
      }
    } else {
      s = '';
    }
  }

  // Strip [PANDUAN REFERENSI MEDIA]: ... if echoed
  if (/^\[PANDUAN REFERENSI MEDIA\]:/i.test(s)) {
    const userInstMatch = s.search(/\[Instruksi User(?: Saat Ini)?\]:\s*/i);
    if (userInstMatch >= 0) {
      const rest = s.slice(userInstMatch).replace(/^\[Instruksi User(?: Saat Ini)?\]:\s*/i, '').trim();
      const parts = rest.split(/\n\s*\n/);
      if (parts.length > 1) {
        s = parts.slice(1).join('\n\n').trim();
      }
    }
  }

  // Strip leading [INGATAN VISUAL KONTEKSTUAL OTOMATIS]:
  s = s.replace(/^\[INGATAN VISUAL KONTEKSTUAL OTOMATIS\]:[^\n]*\n+/i, '').trim();

  // Strip leading [Instruksi User]:
  s = s.replace(/^\[Instruksi User(?: Saat Ini)?\]:\s*[^\n]*\n+/i, '').trim();

  return s;
}

export function formatMarkdown(text, mediaMap = {}, msgId = '') {
  if (!text || text.trim() === '' || text === '[chat_typing_loader]' || text === '[typing_indicator]') {
    return `<div class="chat-typing-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  }

  let cleanedText = stripOutboundPromptEcho(text);
  if (!cleanedText && text && (text.startsWith('[System Instruction:') || text.startsWith('[RIWAYAT LENGKAP PERCAKAPAN'))) {
    return `<div class="chat-typing-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  }

  let out = (cleanedText || text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  out = escapeHtml(out);

  const preservedBlocks = [];
  function preserveBlock(html) {
    const placeholder = `___WEAVY_PRESERVED_BLOCK_${preservedBlocks.length}___`;
    preservedBlocks.push(html.trim());
    return placeholder;
  }

  function formatInline(str) {
    if (!str) return '';
    let s = String(str);

    // 1. Inline code: `code`
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 2. Bold with triple asterisks: ***bold italic***
    s = s.replace(/\*\*\*([^\*\n]+?)\*\*\*/g, '<strong><em>$1</em></strong>');

    // 3. Bold with double asterisks: **bold** (allow any non-newline text inside)
    s = s.replace(/\*\*([^\*\n]+?)\*\*/g, '<strong>$1</strong>');

    // 4. Italic with single asterisk: *italic*
    s = s.replace(/(?<!\*)\*([^\*\n]+?)\*(?!\*)/g, '<em>$1</em>');

    // 5. Italic with single underscore: _italic_
    s = s.replace(/(^|[\s(])_([^_\n]+?)_([\s).,;:!?]|$)/g, '$1<em>$2</em>$3');

    // 6. Gemini Media / Citation reference chips (e.g. [WEBP + 1], [JPG], [PNG])
    s = s.replace(/\[\s*((?:WEBP|JPG|JPEG|PNG|GIF|MP4|MOV|WEBM)(?:\s*\+\s*\d+)?)\s*\]/gi, (m, chip) => {
      return `<span class="gemini-citation-chip">${escapeHtml(chip.toUpperCase())}</span>`;
    });

    // 7. Media tags (@img1, @vid1, etc.) with preview thumbnail if available
    s = s.replace(/(@(img)(\d+))/gi, (fullMatch) => {
      const tagLower = fullMatch.toLowerCase();
      const mediaItem = mediaMap ? mediaMap[tagLower] : null;
      if (mediaItem && (mediaItem.url || mediaItem.base64)) {
        const imgSrc = escapeHtml(mediaItem.url || mediaItem.base64);
        const imgName = escapeHtml(mediaItem.name || fullMatch);
        return `<span class="media-tag-pill media-tag-img has-preview lightbox-trigger" data-tag="${escapeHtml(fullMatch)}" data-full-src="${imgSrc}" data-type="image" data-title="${imgName}" title="${imgName} (Klik untuk perbesar)"><img src="${imgSrc}" class="media-tag-thumb" alt="${escapeHtml(fullMatch)}" loading="lazy" onerror="this.style.display='none';"><span class="media-tag-text">${escapeHtml(fullMatch)}</span></span>`;
      }
      return `<span class="media-tag-pill media-tag-img" data-tag="${escapeHtml(fullMatch)}" title="Media ${escapeHtml(fullMatch)}">${escapeHtml(fullMatch)}</span>`;
    });

    s = s.replace(/(@(vid)(\d+))/gi, (fullMatch) => {
      const tagLower = fullMatch.toLowerCase();
      const mediaItem = mediaMap ? mediaMap[tagLower] : null;
      if (mediaItem) {
        const thumbSrc = mediaItem.thumbnailUrl ? escapeHtml(mediaItem.thumbnailUrl) : '';
        const vidName = escapeHtml(mediaItem.name || fullMatch);
        const innerIcon = thumbSrc
          ? `<img src="${thumbSrc}" class="media-tag-thumb" alt="${escapeHtml(fullMatch)}" loading="lazy" onerror="this.style.display='none';">`
          : `<span class="media-tag-vid-icon">▶</span>`;
        return `<span class="media-tag-pill media-tag-vid has-preview" data-tag="${escapeHtml(fullMatch)}" title="${vidName}">${innerIcon}<span class="media-tag-text">${escapeHtml(fullMatch)}</span></span>`;
      }
      return `<span class="media-tag-pill media-tag-vid" data-tag="${escapeHtml(fullMatch)}" title="Video ${escapeHtml(fullMatch)}">${escapeHtml(fullMatch)}</span>`;
    });

    // 7. Clean up any leftover orphan asterisks that failed to pair
    s = s.replace(/\*{2,}/g, '');
    s = s.replace(/(?<![a-zA-Z0-9])\*(?![a-zA-Z0-9])/g, '');

    return s;
  }

  // Extract and render Dola AI Thought / Reasoning Accordion Block (Mirip Dola AI)
  out = out.replace(/(?:&lt;thought&gt;|\[thinking\]|\[Thinking\])([\s\S]*?)(?:&lt;\/thought&gt;|\[\/thinking\]|\[\/Thinking\])/gi, (m, rawThought) => {
    const cleanThought = rawThought.trim();
    if (!cleanThought) return '';
    return preserveBlock(`
      <div class="dola-thought-container">
        <details class="dola-thought-details">
          <summary class="dola-thought-summary">
            <div class="dola-thought-header-title">
              <span class="dola-thought-bulb-icon">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/>
                  <path d="M9 21h6"/>
                </svg>
              </span>
              <span>Proses Berpikir</span>
            </div>
            <span class="dola-thought-toggle-indicator">Lihat alur</span>
          </summary>
          <div class="dola-thought-body">
            <div class="dola-thought-text">${formatInline(cleanThought).replace(/\n/g, '<br>')}</div>
          </div>
        </details>
      </div>
    `);
  });

  // Handle typing status placeholders
  out = out.replace(/\[typing_status:([\s\S]*?)\]/gi, (m, st) => {
    return preserveBlock(`
      <div class="chat-typing-status">
        <div class="chat-typing-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
        <span>${formatInline(st.trim())}</span>
      </div>
    `);
  });

  // Extract and render TikTok Downloader Media Card (Backend execution)
  out = out.replace(/\[tiktok_card:([\s\S]*?)\]/gi, (m, rawPayload) => {
    try {
      let clean = (rawPayload || '').trim();
      // Unescape HTML entities that might have been created if escapeHtml ran
      clean = clean
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

      let data = null;
      try {
        data = JSON.parse(decodeURIComponent(clean));
      } catch (e1) {
        try {
          data = JSON.parse(clean);
        } catch (e2) {
          try {
            data = JSON.parse(unescape(clean));
          } catch (e3) {
            console.warn('[ChatRender] Failed all JSON parse attempts for tiktok_card:', e1, e2, e3);
          }
        }
      }

      if (data && typeof data === 'object') {
        return preserveBlock(renderTikTokCardHtml(data));
      }
      return m;
    } catch (e) {
      console.warn('[ChatRender] Failed to parse tiktok_card payload:', e);
      return m;
    }
  });

  out = out.replace(/^(?:&gt;\s*)?(#{1,6})\s*(.+)$/gm, (m, hashes, title) => {
    const level = hashes.length;
    return preserveBlock(`<div class="chat-section-title chat-heading-h${level}">${formatInline(title.trim())}</div>`);
  });

  out = out.replace(/^(?:---+|___+|\*\*\*+)$/gm, () => {
    return preserveBlock('<div class="chat-divider"></div>');
  });

  // Match and normalize Markdown images/videos ![alt](url) to [weavy_repost:url] or [weavy_repost_video:url]
  out = out.replace(/!\[([^\]]*)\]\(((?:https?:\/\/|data:(?:image|video)\/|blob:)[^\)\r\n]+)\)/gi, (m, alt, url) => {
    const trimmed = url.trim();
    return isVideoUrl(trimmed) ? `\n[weavy_repost_video:${trimmed}]\n` : `\n[weavy_repost:${trimmed}]\n`;
  });

  // Match and normalize Markdown video links [Tonton Video](url.mp4)
  out = out.replace(/\[([^\]]*)\]\(((?:https?:\/\/|data:video\/|blob:)[^\)\r\n]+(?:\.mp4|\.webm|\.mov)(?:\?[^\)\r\n]*)?)\)/gi, (m, label, url) => {
    return `\n[weavy_repost_video:${url.trim()}]\n`;
  });

  // Match direct Gemini/Veo/Weavy video helper tags: [gemini_video:url], [veo_video:url], [video_result:url], [weavy_video:url]
  out = out.replace(/\[(?:gemini_video|veo_video|video_result|weavy_video|dola_video):((?:https?:\/\/|data:video\/|blob:)[^\]]+)\]/gi, (m, url) => {
    return `\n[weavy_repost_video:${url.trim()}]\n`;
  });

  // Match HTML <video src="..."> tags emitted by models
  out = out.replace(/<video[^>]*\bsrc=["']((?:https?:\/\/|data:video\/|blob:)[^"']+)["'][^>]*>[\s\S]*?<\/video>/gi, (m, url) => {
    return `\n[weavy_repost_video:${url.trim()}]\n`;
  });

  // Match and normalize standalone video URLs in text to [weavy_repost_video:url]
  out = out.replace(/(?:^|\s)(https?:\/\/[^\s"'<>]+\.(?:mp4|webm|mov)(?:\?[^\s"'<>]*)?)(?:\s|$)/gi, (m, url) => `\n[weavy_repost_video:${url.trim()}]\n`);

  // Match and normalize standalone image URLs (including ByteDance/Dola signed images, rc_gen_image, tplv, etc.)
  out = out.replace(/(?:^|\n)(https?:\/\/[^\s"'<>]*(?:ibyteimg\.com|byteimg\.com|rc_gen_image|flow-image-sign|\.jpe?g|\.png|\.webp|\.gif|\-image\.image)[^\s"'<>]*)(?:\n|$)/gi, (m, url) => {
    return `\n[weavy_repost:${url.trim()}]\n`;
  });

  function isVideoUrl(urlStr = '') {
    if (!urlStr || typeof urlStr !== 'string') return false;
    const lower = urlStr.toLowerCase();
    return (
      lower.includes('data:video/') ||
      lower.includes('.mp4') ||
      lower.includes('.webm') ||
      lower.includes('.mov') ||
      lower.includes('.mkv') ||
      lower.includes('bytevcloud.com') ||
      lower.includes('tiktokcdn.com/obj/tos-') ||
      lower.includes('/video/tos/') ||
      lower.includes('volces.com') ||
      lower.includes('dola.com/video') ||
      lower.includes('doubao.com/video') ||
      lower.includes('googleusercontent.com/video') ||
      lower.includes('generativelanguage.googleapis.com') ||
      (lower.includes('storage.googleapis.com') && (lower.includes('.mp4') || lower.includes('video') || lower.includes('veo')))
    );
  }

  function formatCount(num) {
    if (!num) return '0';
    const n = Number(num);
    if (isNaN(n)) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  function formatDuration(sec) {
    if (!sec) return 'Video';
    const s = Math.round(Number(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  }

  function renderTikTokCardHtml(data) {
    if (!data) return '';
    const title = escapeHtml(data.title || 'Video TikTok');
    const authorName = escapeHtml(data.author?.nickname || 'TikTok Creator');
    const authorHandle = escapeHtml(data.author?.unique_id ? `@${data.author.unique_id}` : '');
    const avatarUrl = data.author?.avatar ? escapeHtml(data.author.avatar) : '';
    const coverUrl = data.cover ? escapeHtml(data.cover) : '';
    const playUrl = data.play ? escapeHtml(data.play) : '';
    const dlVideoUrl = data.downloadUrl ? escapeHtml(data.downloadUrl) : playUrl;
    const dlMusicUrl = data.downloadMusicUrl ? escapeHtml(data.downloadMusicUrl) : (data.music ? escapeHtml(data.music) : '');
    const dlCoverUrl = data.downloadCoverUrl ? escapeHtml(data.downloadCoverUrl) : coverUrl;
    const safeFilename = escapeHtml(data.cleanTitle || 'tiktok_video');
    const durationText = formatDuration(data.duration);
    const stats = data.stats || {};
    const images = Array.isArray(data.images) ? data.images : [];

    let mediaContentHtml = '';
    if (playUrl) {
      mediaContentHtml = `
        <div class="tiktok-media-grid">
          <div class="tiktok-thumb-preview-box">
            <img src="${coverUrl}" class="tiktok-thumb-img native-img-elem" alt="Thumbnail Video" loading="lazy" referrerpolicy="no-referrer" />
            <span class="tiktok-thumb-tag-badge">📷 Thumbnail Cover</span>
            <button type="button" class="btn-preview-lightbox tiktok-thumb-zoom-btn" data-src="${coverUrl}" data-type="image" data-title="Thumbnail: ${title}" title="Perbesar Thumbnail">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
          </div>
          <div class="tiktok-video-wrapper">
            <video 
              src="${playUrl}" 
              poster="${coverUrl}" 
              class="tiktok-video-element native-video-elem" 
              controls 
              playsinline 
              preload="metadata"
              referrerpolicy="no-referrer"
            ></video>
          </div>
        </div>
      `;
    } else if (coverUrl) {
      mediaContentHtml = `
        <div class="tiktok-thumb-preview-box" style="margin-bottom:12px;">
          <img src="${coverUrl}" class="tiktok-thumb-img native-img-elem" alt="Thumbnail Video" loading="lazy" referrerpolicy="no-referrer" />
          <span class="tiktok-thumb-tag-badge">📷 Thumbnail Cover</span>
        </div>
      `;
    }

    let slidesHtml = '';
    if (images.length > 0) {
      slidesHtml = `
        <div class="tiktok-slides-gallery">
          ${images
            .map(
              (img, i) => `
            <div class="tiktok-slide-item">
              <img src="${escapeHtml(img.url)}" class="tiktok-slide-img native-img-elem" loading="lazy" referrerpolicy="no-referrer" alt="Foto ${i + 1}" />
              <a href="${escapeHtml(img.downloadUrl || img.url)}" download="${safeFilename}_${i + 1}.jpg" class="tiktok-slide-dl-btn" title="Download Foto ${i + 1}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V15"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </a>
            </div>
          `
            )
            .join('')}
        </div>
      `;
    }

    return `
      <div class="tiktok-download-card">
        <div class="tiktok-card-header">
          <div class="tiktok-author-row">
            ${avatarUrl ? `<img src="${avatarUrl}" class="tiktok-author-avatar" alt="Avatar" referrerpolicy="no-referrer" onerror="this.style.display='none'" />` : ''}
            <div class="tiktok-author-info">
              <span class="tiktok-author-name">${authorName}</span>
              ${authorHandle ? `<span class="tiktok-author-handle">${authorHandle}</span>` : ''}
            </div>
          </div>
          <div class="tiktok-header-badges">
            <span class="tiktok-badge-brand">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.86 3.48 2.72 1.34-.07 2.56-.94 2.95-2.22.14-.44.17-.91.17-1.37.03-4.93.01-9.87.02-14.8z"/></svg>
              <span>TikTok</span>
            </span>
            <span class="tiktok-badge-duration">${durationText}</span>
          </div>
        </div>
        <div class="tiktok-card-body">
          <p class="tiktok-title-caption">${title}</p>
          ${mediaContentHtml}
          ${slidesHtml}
          <div class="tiktok-stats-bar">
            <span class="tiktok-stat-pill" title="Views">👁️ ${formatCount(stats.play_count)} views</span>
            <span class="tiktok-stat-pill" title="Likes">❤️ ${formatCount(stats.digg_count)} likes</span>
            <span class="tiktok-stat-pill" title="Comments">💬 ${formatCount(stats.comment_count)} komentar</span>
            <span class="tiktok-stat-pill" title="Shares">🔁 ${formatCount(stats.share_count)} shares</span>
          </div>
          <div class="tiktok-attachment-status-bar">
            <span class="tiktok-attached-badge" title="Thumbnail & Video ini otomatis siap digunakan sebagai lampiran tanya Gemini / Dola">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l7.88-7.88"/></svg>
              <span>Thumbnail & Video Otomatis Terlampir di Chat (Siap Tanya Gemini / Dola)</span>
            </span>
          </div>
          <div class="tiktok-actions-row">
            <button type="button" class="tiktok-btn tiktok-btn-attach btn-stage-tiktok-attachment" 
              data-cover="${coverUrl}" 
              data-play="${dlVideoUrl}" 
              data-title="${safeFilename}"
              title="Pasang ulang thumbnail & video ke tray input chat jika terhapus">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l7.88-7.88"/></svg>
              <span>+ Pasang di Chat Tray</span>
            </button>
            ${
              dlVideoUrl
                ? `
              <a href="${dlVideoUrl}" download="${safeFilename}.mp4" class="tiktok-btn tiktok-btn-primary btn-dl-video" title="Download Video Bebas Watermark">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V15"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Download Video (No WM)</span>
              </a>
            `
                : ''
            }
            ${
              dlMusicUrl
                ? `
              <a href="${dlMusicUrl}" download="${safeFilename}_audio.mp3" class="tiktok-btn tiktok-btn-secondary btn-dl-audio" title="Download Musik Audio">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                <span>Download Musik</span>
              </a>
            `
                : ''
            }
            ${
              dlCoverUrl
                ? `
              <a href="${dlCoverUrl}" download="${safeFilename}_thumb.jpg" class="tiktok-btn tiktok-btn-secondary btn-dl-thumb" title="Download Gambar Thumbnail Cover">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Download Thumbnail</span>
              </a>
            `
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  function renderDolaVideoCardHtml(vUrl, title = 'Video Gemini / AI (1080p HD Tanpa Watermark)') {
    const cleanUrl = vUrl
      .replace(/&amp;/g, '&')
      .replace(/lr=[^&]+/g, 'lr=unwatermarked')
      .replace(/[?&]watermark=\d+/g, '')
      .replace(/[?&]logo=\d+/g, '')
      .replace(/[?&]wm=\d+/g, '')
      .replace(/[?&]download=true/g, '');
    const safeUrl = escapeHtml(cleanUrl);
    const safeTitle = escapeHtml(title);
    return `
      <div class="dola-video-container" draggable="true" data-url="${safeUrl}">
        <div class="dola-video-header">
          <div class="dola-video-title-wrap">
            <span class="dola-video-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </span>
            <span class="dola-video-title">🎬 ${safeTitle}</span>
          </div>
          <span class="dola-video-badge" style="background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3);">HD Tanpa Watermark</span>
        </div>
        <div class="dola-video-player-wrap">
          <video 
            src="${safeUrl}" 
            class="dola-video-player native-video-elem" 
            controls 
            playsinline 
            preload="metadata"
            draggable="true"
            crossorigin="anonymous"
          ></video>
          <div class="dola-video-overlay-actions">
            <button type="button" class="btn-preview-lightbox dola-mini-action-btn" data-src="${safeUrl}" data-type="video" data-title="${safeTitle}" title="Perbesar Layar Penuh">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              <span>Perbesar</span>
            </button>
            <button type="button" class="btn-download-media dola-mini-action-btn" data-url="${safeUrl}" data-filename="gemini_video_${Date.now()}.mp4" title="Unduh Video MP4 (Tanpa Watermark)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V15"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Unduh MP4</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Render Dola AI, Gemini Veo & Weavy Video Repost Cards
  out = out.replace(/\[weavy_repost_video:(@(?:vid|img)\d+|https?:\/\/[^\]]+|data:video\/[^\]]+|blob:[^\]]+)\]/gi, (match, rawTarget) => {
    const target = rawTarget.replace(/&amp;/g, '&');
    let mediaItem = mediaMap[target.toLowerCase()];
    if (!mediaItem && (target.startsWith('http') || target.startsWith('data:') || target.startsWith('blob:'))) {
      mediaItem = { url: target, name: 'Video Gemini AI (HD Tanpa Watermark)', key: '@vid', type: 'video' };
    }
    const finalUrl = mediaItem?.url || target;
    return preserveBlock(renderDolaVideoCardHtml(finalUrl, mediaItem?.name || 'Video AI (HD Tanpa Watermark)'));
  });

  // Match consecutive or clustered [weavy_repost:...] tags and group them into a responsive Gallery Grid (or Video Card if video)
  out = out.replace(/((?:\[weavy_repost:(?:@[a-z0-9_]+|https?:\/\/[^\]]+|data:image\/[^\]]+|blob:[^\]]+)\][\s\n]*)+)/gi, (cluster) => {
    const itemMatches = Array.from(cluster.matchAll(/\[weavy_repost:(@(?:img|vid)\d+|https?:\/\/[^\]]+|data:image\/[^\]]+|blob:[^\]]+)\]/gi));
    const items = [];
    for (const m of itemMatches) {
      const rawTarget = m[1];
      const target = rawTarget.replace(/&amp;/g, '&');
      let mediaItem = mediaMap[target.toLowerCase()];
      if (!mediaItem && (target.startsWith('http') || target.startsWith('data:') || target.startsWith('blob:'))) {
        const isVid = isVideoUrl(target);
        mediaItem = { url: target, name: isVid ? 'Video AI' : 'Gambar AI', key: isVid ? '@vid' : '@img', type: isVid ? 'video' : 'image' };
      }
      if (mediaItem && mediaItem.url) {
        items.push({
          url: mediaItem.url,
          name: mediaItem.name || 'Media Sesi',
          target,
          type: mediaItem.type || (isVideoUrl(mediaItem.url) ? 'video' : 'image'),
        });
      }
    }

    if (items.length === 0) return '';

    // If single item and it is a video, render video player
    if (items.length === 1 && (items[0].type === 'video' || isVideoUrl(items[0].url) || items[0].target.toLowerCase().startsWith('@vid'))) {
      return preserveBlock(renderDolaVideoCardHtml(items[0].url, items[0].name));
    }

    // Filter out videos into their own video player blocks if mixed
    const videoItems = items.filter(it => it.type === 'video' || isVideoUrl(it.url) || it.target.toLowerCase().startsWith('@vid'));
    const imageItems = items.filter(it => it.type !== 'video' && !isVideoUrl(it.url) && !it.target.toLowerCase().startsWith('@vid'));

    let combinedHtml = '';
    for (const vIt of videoItems) {
      combinedHtml += renderDolaVideoCardHtml(vIt.url, vIt.name);
    }

    if (imageItems.length === 1) {
      const item = imageItems[0];
      const isExternalUrl = item.target.startsWith('http') || item.target.startsWith('data:') || item.target.startsWith('blob:');
      const mediaLabel = isExternalUrl ? '✨ AI Generated Image' : item.target.toUpperCase();
      const mediaBadge = isExternalUrl ? mediaLabel : `0 Kredit &bull; ${mediaLabel}`;
      combinedHtml += `
        <div class="repost-media-card" draggable="true" data-url="${escapeHtml(item.url)}">
          <div class="repost-media-wrapper">
            <img 
              src="${escapeHtml(item.url)}" 
              alt="${escapeHtml(item.name)}" 
              class="repost-media-img lightbox-trigger cursor-grab active:cursor-grabbing"
              data-full-src="${escapeHtml(item.url)}"
              draggable="true"
            />
            <div class="repost-badge-wrap">
              <span class="repost-badge">${mediaBadge}</span>
            </div>
            <div class="repost-overlay-actions">
              <button type="button" class="btn-add-as-reference repost-action-btn" data-src="${escapeHtml(item.url)}" title="Jadikan referensi obrolan berikutnya">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              </button>
              <button type="button" class="btn-preview-lightbox repost-action-btn" data-src="${escapeHtml(item.url)}" data-type="image" data-title="${escapeHtml(item.target.toUpperCase())}" title="Perbesar Layar Penuh">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              </button>
              <button type="button" class="btn-download-media repost-action-btn" data-url="${escapeHtml(item.url)}" data-filename="dola_image_${Date.now()}.png" title="Unduh gambar HD">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V15"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    } else if (imageItems.length > 1) {
      const count = imageItems.length;
      const gridClass = count === 2 ? 'grid-2' : count === 3 ? 'grid-3' : count === 4 ? 'grid-4' : 'grid-multi';

      combinedHtml += `
        <div class="dola-gallery-container">
          <div class="dola-gallery-header">
            <div class="dola-gallery-title-wrap">
              <span class="dola-gallery-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
              </span>
              <span class="dola-gallery-title">🎨 Hasil Generate Dola AI (${count} Gambar)</span>
            </div>
            <div class="dola-gallery-header-actions">
              <span class="dola-gallery-badge">${count} Variasi HD</span>
            </div>
          </div>
          <div class="dola-gallery-grid ${gridClass}">
            ${imageItems.map((item, idx) => `
              <div class="dola-gallery-card" draggable="true" data-url="${escapeHtml(item.url)}">
                <div class="dola-gallery-img-wrap">
                  <img 
                    src="${escapeHtml(item.url)}" 
                    alt="${escapeHtml(item.name || `Variasi #${idx + 1}`)}" 
                    class="dola-gallery-img lightbox-trigger cursor-grab active:cursor-grabbing"
                    data-full-src="${escapeHtml(item.url)}"
                    data-title="Variasi #${idx + 1} (${escapeHtml(item.name)})"
                    loading="lazy"
                    draggable="true"
                  />
                  <div class="dola-card-index-badge">#${idx + 1}</div>
                  <div class="dola-card-overlay-actions">
                    <button type="button" class="btn-add-as-reference dola-mini-action-btn" data-src="${escapeHtml(item.url)}" title="Jadikan referensi chat">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                    </button>
                    <button type="button" class="btn-preview-lightbox dola-mini-action-btn" data-src="${escapeHtml(item.url)}" data-type="image" data-title="Variasi #${idx + 1}" title="Perbesar Layar Penuh">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                    </button>
                    <button type="button" class="btn-download-media dola-mini-action-btn" data-url="${escapeHtml(item.url)}" data-filename="dola_image_${idx + 1}_${Date.now()}.png" title="Unduh HD">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V15"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return preserveBlock(combinedHtml);
  });

  // Helper to render AI Worker Product Card
  const renderProductCard = (prod) => {
    if (!prod) return null;
    const title = prod.title || 'Produk Teridentifikasi';
    const store = prod.store || prod.author_name || prod.brand || '';
    const platform = prod.platform || 'TikTok Shop';
    const desc = prod.description || '';
    const price = prod.price || '';
    const usps = Array.isArray(prod.usps) ? prod.usps : [];
    const images = Array.isArray(prod.images) ? prod.images : (prod.thumbnail_url ? [prod.thumbnail_url] : []);
    const primaryThumb = prod.thumbnail_url || (images.length > 0 ? (typeof images[0] === 'string' ? images[0] : images[0].url) : '');
    const encTitle = encodeURIComponent(title);
    const encThumb = encodeURIComponent(primaryThumb || '');
    const encDesc = encodeURIComponent(desc || '');
    const encPrice = encodeURIComponent(price || '');
    const encStore = encodeURIComponent(store || '');
    const encUsps = encodeURIComponent(JSON.stringify(usps));
    const encImages = encodeURIComponent(JSON.stringify(images));

    let galleryHtml = '';
    if (images.length > 0) {
      galleryHtml = `
        <div class="ai-worker-product-gallery">
          <div class="ai-worker-gallery-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
            <span>Aset Visual & Foto Produk Terdeteksi (${images.length} foto)</span>
          </div>
          <div class="ai-worker-gallery-grid">
            ${images.map((img, i) => {
              const imgUrl = typeof img === 'string' ? img : img.url;
              const imgTitle = (typeof img === 'object' && img.title) ? img.title : `Foto ${i + 1}`;
              return `
                <div class="ai-worker-img-card">
                  <img 
                    src="${escapeHtml(imgUrl)}" 
                    alt="${escapeHtml(imgTitle)}" 
                    class="ai-worker-thumb-img lightbox-trigger"
                    data-full-src="${escapeHtml(imgUrl)}"
                    data-title="${escapeHtml(title)}"
                    loading="lazy"
                    onerror="this.onerror=null; if(this.parentElement) this.parentElement.style.display='none';"
                  />
                  <div class="ai-worker-img-overlay">
                    <button type="button" class="btn-add-as-reference ai-worker-img-btn" data-src="${escapeHtml(imgUrl)}" title="Gunakan sebagai referensi obrolan">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    let uspsHtml = '';
    if (usps.length > 0) {
      uspsHtml = `
        <div class="ai-worker-usp-list">
          ${usps.map(u => `<span class="ai-worker-usp-pill">✨ ${escapeHtml(u)}</span>`).join('')}
        </div>
      `;
    }

    return preserveBlock(`
      <div class="ai-worker-product-card">
        <div class="ai-worker-card-header">
          <div class="ai-worker-brand-badge">
            <span class="ai-worker-pulse-dot"></span>
            <span class="ai-worker-label">⚡ AI WORKER &bull; PRODUCT EXTRACTOR</span>
          </div>
          <span class="ai-worker-platform-badge">${escapeHtml(platform)}</span>
        </div>

        <div class="ai-worker-card-body">
          <div class="ai-worker-title-row">
            <div class="ai-worker-prod-title">${escapeHtml(title)}</div>
            ${store ? `<div class="ai-worker-store-name">🏪 Toko/Kreator: <strong>${escapeHtml(store)}</strong></div>` : ''}
            ${price ? `<div class="ai-worker-price-tag">${escapeHtml(price)}</div>` : ''}
          </div>

          ${desc ? `<div class="ai-worker-desc-box"><p>${escapeHtml(desc)}</p></div>` : ''}
          ${uspsHtml}
          ${galleryHtml}
        </div>

        <div class="ai-worker-card-footer">
          <div class="ai-worker-actions-group">
            <button type="button" class="btn-send-to-storyboard ai-worker-action-btn btn-primary-worker" 
              data-title="${encTitle}" 
              data-thumbnail="${encThumb}" 
              data-desc="${encDesc}"
              data-price="${encPrice}"
              data-store="${encStore}"
              data-usps="${encUsps}"
              data-images="${encImages}"
              title="Buka Storyboard Copilot dan buat storyboard video komersial">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              <span>🎬 Buat Storyboard Video</span>
            </button>

            <button type="button" class="btn-gen-product-photo ai-worker-action-btn" 
              data-title="${encTitle}" 
              data-thumbnail="${encThumb}" 
              title="Generate foto produk komersial studio di Generator">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
              <span>✨ Generate Foto Studio</span>
            </button>

            <button type="button" class="btn-copy-product-data ai-worker-action-btn btn-ghost-worker" 
              data-title="${encTitle}" 
              data-desc="${encDesc}" 
              title="Salin rincian produk">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Salin Data</span>
            </button>
          </div>
        </div>
      </div>
    `);
  };

  // Helper to render interactive Weavy / Dola Suggested Generation Card
  const renderWeavyGenCard = (config) => {
    if (!config) return null;
    let effectiveConfig = config;
    if (typeof config === 'string') {
      effectiveConfig = {
        prompt: config,
        aspect_ratio: /16:9/.test(config) ? '16:9' : (/1:1/.test(config) ? '1:1' : '9:16'),
        model: 'seedream_v5_pro_edit',
        provider: 'weavy',
      };
    }

    const promptText = (effectiveConfig.prompt || '').trim();
    if (!promptText) return null;

    const encConfig = encodeURIComponent(JSON.stringify(effectiveConfig));
    const encPrompt = encodeURIComponent(promptText);
    const isVideo = effectiveConfig.mode === 'video' || effectiveConfig.type === 'video' || String(effectiveConfig.model || '').toLowerCase().includes('seedance') || String(effectiveConfig.model || '').toLowerCase().includes('video');
    const isDola = effectiveConfig.provider === 'dola' || String(effectiveConfig.model || '').toLowerCase().includes('dola') || String(effectiveConfig.model || '').toLowerCase().includes('doubao') || String(effectiveConfig.model || '').toLowerCase().includes('seedance');
    const modelName = effectiveConfig.model || (isDola ? (isVideo ? 'Seedance 2.5' : 'Doubao Image Pro') : 'Seedream V5.0 Pro Edit');
    const aspect = effectiveConfig.aspect_ratio || effectiveConfig.aspectRatio || (isVideo ? '16:9' : '9:16');
    const cardTitle = isVideo ? (isDola ? 'Dola Seedance Video' : 'AI Video Generation') : (isDola ? 'Dola Visual Studio' : 'Weavy Image Generation');
    const btnLabel = isVideo ? `Generate Video (${escapeHtml(modelName)})` : `Generate Gambar (${escapeHtml(modelName)})`;

    // Reference images chips
    let refsHtml = '';
    const rawRefs = Array.isArray(effectiveConfig.references) ? effectiveConfig.references : (effectiveConfig.reference ? [effectiveConfig.reference] : []);
    if (rawRefs.length > 0) {
      refsHtml = `
        <div class="weavy-gen-references-row">
          <span class="weavy-gen-refs-label">Lampiran Referensi:</span>
          <div class="weavy-gen-refs-list">
            ${rawRefs.map((ref) => {
              const safeRef = String(ref).trim();
              const mItem = mediaMap ? mediaMap[safeRef.toLowerCase()] : null;
              const thumb = mItem?.url || mItem?.base64 || '';
              return `
                <span class="weavy-gen-ref-chip ${thumb ? 'has-thumb' : ''}" data-ref="${escapeHtml(safeRef)}" title="Lihat ${escapeHtml(safeRef)}">
                  ${thumb ? `<img src="${escapeHtml(thumb)}" class="weavy-gen-ref-thumb" alt="${escapeHtml(safeRef)}" />` : ''}
                  <span class="weavy-gen-ref-name">${escapeHtml(safeRef)}</span>
                </span>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    return preserveBlock(`
      <div class="weavy-gen-suggested-card" data-msg-id="${escapeHtml(msgId)}">
        <div class="weavy-gen-card-header">
          <div class="weavy-gen-title-group">
            <span class="weavy-gen-icon-wrap" aria-hidden="true">
              ${isVideo ? `
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              ` : `
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
                </svg>
              `}
            </span>
            <div class="weavy-gen-meta-group">
              <span class="weavy-gen-card-title">${escapeHtml(cardTitle)}</span>
              <span class="weavy-gen-aspect-badge">${escapeHtml(aspect)}</span>
              <span class="weavy-gen-model-badge">${escapeHtml(modelName)}</span>
            </div>
          </div>
          <button type="button" class="btn-copy-prompt-card weavy-gen-copy-btn" data-prompt="${encPrompt}" title="Salin Prompt ke Clipboard">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>Salin</span>
          </button>
        </div>
        <div class="weavy-gen-card-body">
          <div class="weavy-gen-prompt-box">
            <p class="weavy-gen-prompt-text">${escapeHtml(promptText)}</p>
          </div>
          ${refsHtml}
          <div class="weavy-gen-card-footer">
            <div class="weavy-gen-actions-left">
              <button type="button" class="weavy-gen-request-btn" data-config="${encConfig}" data-msg-id="${escapeHtml(msgId)}">
                ${isVideo ? `
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                ` : `
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
                  </svg>
                `}
                <span>${btnLabel}</span>
              </button>
              <button type="button" class="btn-use-in-generator weavy-gen-use-btn" data-prompt="${encPrompt}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                <span>Buka di Generator</span>
              </button>
            </div>
            <div class="weavy-gen-status-indicator">
              <span class="weavy-status-dot"></span>
              <span class="weavy-gen-status-text">Siap dieksekusi 1-klik</span>
            </div>
          </div>
        </div>
      </div>
    `);
  };

  // Helper to render standalone prompt card
  const renderStandaloneDolaPrompt = (config) => {
    if (!config) return null;
    const sbCard = renderChatStoryboardCopilotCard(config);
    if (sbCard) return sbCard;

    if (typeof config.prompt !== 'string' || !config.prompt.trim()) return null;
    const prompt = config.prompt.trim();
    const duration = config.duration ? `${escapeHtml(config.duration)} detik` : '';
    const aspect = config.aspect_ratio || config.aspectRatio || '';
    return preserveBlock(`
      <div class="dedicated-prompt-card dola-json-prompt-card">
        <div class="prompt-card-header">
          <div class="prompt-card-title-group">
            <span class="prompt-card-icon-wrap" aria-hidden="true">✦</span>
            <span class="prompt-card-title">Prompt Video Dola</span>
            ${duration ? `<span class="prompt-card-aspect-badge">${duration}</span>` : ''}
            ${aspect ? `<span class="prompt-card-badge prompt-badge-video">${escapeHtml(aspect)}</span>` : ''}
          </div>
          <button type="button" class="btn-copy-prompt-card" data-prompt="${encodeURIComponent(prompt)}" title="Salin prompt">Salin</button>
        </div>
        <div class="prompt-card-body"><div class="prompt-card-body-box"><p class="prompt-card-body-text">${escapeHtml(prompt)}</p></div></div>
      </div>
    `);
  };

  // =========================================================================
  // FENCED CODE BLOCKS PROCESSING (IN ORDER OF SPECIFICITY)
  // All fenced blocks MUST be extracted and preserved FIRST before standalone JSON!
  // =========================================================================

  // 1. Weavy Image / Video Generation Blocks: ```weavy_generate, ```generate_image, etc.
  out = out.replace(/```(?:weavy_generate|weavy-generate|generate_image|generate-image|weavy_image|image_generate|dola_generate|dola-generate|dola_image|dola_video|generate_video|video_generate)[^\S\r\n]*\r?\n([\s\S]*?)```/gi, (match, jsonStr) => {
    try {
      const rawContent = decodeJsonEntities(jsonStr.trim());
      let config = null;
      try {
        config = JSON.parse(rawContent);
      } catch (_) {
        if (rawContent && rawContent.length > 5) {
          config = {
            prompt: rawContent,
            aspect_ratio: /16:9/.test(rawContent) ? '16:9' : (/1:1/.test(rawContent) ? '1:1' : '9:16'),
            model: 'seedream_v5_pro_edit',
            provider: 'weavy',
          };
        }
      }
      if (config) {
        const card = renderWeavyGenCard(config);
        if (card) return card;
      }
    } catch (_) {}
    return preserveBlock(`<pre><button class="code-copy-btn">Salin</button><code>${escapeHtml(jsonStr.trim())}</code></pre>`);
  });

  // 2. AI Worker Product Card: ```product_card ... ```
  out = out.replace(/```(?:product_card|product-card|ai_worker_product|ai-worker-product)[^\S\r\n]*\r?\n([\s\S]*?)```/gi, (match, jsonStr) => {
    try {
      const rawJson = decodeJsonEntities(jsonStr.trim());
      const prod = JSON.parse(rawJson);
      const card = renderProductCard(prod);
      if (card) return card;
    } catch (_) {}
    return preserveBlock(`<pre><button class="code-copy-btn">Salin</button><code>${escapeHtml(jsonStr.trim())}</code></pre>`);
  });

  // 3. Storyboard definitions: ```storyboard_project, ```storyboard_copilot, etc.
  out = out.replace(/```(?:storyboard_project|storyboard-project|storyboard_copilot|storyboard-copilot|storyboard_draft|storyboard|copilot_storyboard)[^\S\r\n]*(?:\r?\n|\s)([\s\S]*?)```/gi, (match, jsonStr) => {
    try {
      const rawJson = decodeJsonEntities(jsonStr.trim());
      const cardHtml = renderChatStoryboardCopilotCard(rawJson, { preserveBlock });
      if (cardHtml) return cardHtml;
    } catch (_) {}
    return preserveBlock(`<pre><button class="code-copy-btn">Salin</button><code>${escapeHtml(decodeJsonEntities(jsonStr.trim()))}</code></pre>`);
  });

  // 4. Generic ```json blocks: inspect semantic payload
  out = out.replace(/```(?:json|javascript|js)[^\S\r\n]*(?:\r?\n|\s)([\s\S]*?)```/gi, (match, jsonStr) => {
    try {
      const rawJson = decodeJsonEntities(jsonStr.trim());

      // Check if it is a Storyboard first
      const sbCard = renderChatStoryboardCopilotCard(rawJson, { preserveBlock });
      if (sbCard) return sbCard;

      let parsed = null;
      try {
        parsed = JSON.parse(rawJson);
      } catch (_) {
        try {
          parsed = JSON.parse(`[${rawJson.replace(/^,+|,+$/g, '')}]`);
        } catch (_) {}
      }

      if (parsed && typeof parsed === 'object') {
        // A. Is it an image / video generation specification?
        const isGenSpec = parsed.model || parsed.references || parsed.reference ||
          parsed.aspect_ratio || parsed.aspectRatio || parsed.mode === 'image' || parsed.mode === 'video' ||
          parsed.type === 'generate_image' || parsed.type === 'weavy_generate' ||
          (parsed.prompt && (String(parsed.model || '').toLowerCase().includes('seedream') || String(parsed.prompt).includes('Shot on')));
        if (isGenSpec && parsed.prompt) {
          const genCard = renderWeavyGenCard(parsed);
          if (genCard) return genCard;
        }

        // B. Is it an AI worker product card?
        if (parsed.title && (parsed.store || parsed.price || parsed.usps || parsed.thumbnail_url)) {
          const prodCard = renderProductCard(parsed);
          if (prodCard) return prodCard;
        }

        // C. Is it a Dola prompt?
        if (parsed.prompt && (parsed.duration || parsed.type === 'video_prompt')) {
          const dolaPrompt = renderStandaloneDolaPrompt(parsed);
          if (dolaPrompt) return dolaPrompt;
        }

        // D. Generic Structured JSON Viewer
        const jsonViewer = renderGenericJsonViewer(parsed, { preserveBlock });
        if (jsonViewer) return jsonViewer;
      }
    } catch (_) {}

    // Fallback: standard styled code block with copy button
    return preserveBlock(`<pre><button class="code-copy-btn">Salin</button><code>${escapeHtml(decodeJsonEntities(jsonStr.trim()))}</code></pre>`);
  });

  // 5. Prompt blocks or any remaining code fences (including ``` without lang):
  out = out.replace(/```(?:prompt:?([a-zA-Z0-9_-]*)|prompt-([a-zA-Z0-9_-]*)|([a-zA-Z0-9_-]*))[^\S\r\n]*(?:\r?\n|\s)([\s\S]*?)```/gi, (match, p1, p2, clang, rawCode) => {
    const codeType = (p1 || p2 || clang || '').toLowerCase();
    const code = rawCode.trim();
    const rawContent = decodeJsonEntities(code);

    // 1. Check if this block contains Storyboard JSON (even if language was empty or unrecognized!)
    if (
      rawContent.includes('"sceneNumber"') ||
      rawContent.includes('"scenes"') ||
      rawContent.includes('"visualDescription"') ||
      rawContent.includes('"cameraAngle"') ||
      rawContent.includes('"cameraMovement"') ||
      rawContent.includes('storyboard_project') ||
      rawContent.includes('create_storyboard_project')
    ) {
      const sbCard = renderChatStoryboardCopilotCard(rawContent, { preserveBlock });
      if (sbCard) return sbCard;
    }

    // 2. Check if this block is any JSON object/array
    if (rawContent.startsWith('{') || rawContent.startsWith('[')) {
      try {
        const parsed = JSON.parse(rawContent);
        if (parsed && typeof parsed === 'object') {
          const sbCard = renderChatStoryboardCopilotCard(parsed, { preserveBlock });
          if (sbCard) return sbCard;
          if (parsed.prompt && (parsed.aspect_ratio || parsed.aspectRatio || parsed.model || parsed.type === 'generate_image')) {
            const genCard = renderWeavyGenCard(parsed);
            if (genCard) return genCard;
          }
          const jsonViewer = renderGenericJsonViewer(parsed, { preserveBlock });
          if (jsonViewer) return jsonViewer;
        }
      } catch (_) {}
    }

    // 3. Check if dedicated video/image prompt card (ONLY for plain text prompts, NEVER for JSON objects or arrays)
    const isJsonLike = rawContent.startsWith('{') || rawContent.startsWith('[');
    const isPrompt = !isJsonLike && (codeType.includes('prompt') || codeType.includes('video') || codeType.includes('fashion') || codeType.includes('natural') || codeType.includes('image') || code.includes('Shot on ') || code.includes('Camera:') || code.includes('Aspect Ratio:') || code.includes('Ultra-detailed') || code.includes('Seedream'));

    if (isPrompt && !codeType.includes('json') && !codeType.includes('javascript') && !codeType.includes('weavy')) {
      const isVideo = codeType.includes('video') || codeType.includes('fashion') || codeType.includes('lockcut') || codeType.includes('jumpcut');
      const genConfig = {
        prompt: rawContent,
        aspect_ratio: /16:9/.test(rawContent) ? '16:9' : (/1:1/.test(rawContent) ? '1:1' : '9:16'),
        model: isVideo ? 'seedance_v2.5' : 'seedream_v5_pro_edit',
        mode: isVideo ? 'video' : 'image',
        provider: isVideo ? 'dola' : 'weavy',
      };
      const genCard = renderWeavyGenCard(genConfig);
      if (genCard) return genCard;
    }

    return preserveBlock(`<pre><button class="code-copy-btn">Salin</button><code>${escapeHtml(rawContent)}</code></pre>`);
  });

  // =========================================================================
  // 5.5 IN-FLIGHT STREAMING TAIL CODE BLOCK HANDLER
  // Catches unclosed ```json or ```storyboard blocks actively being streamed
  // =========================================================================
  out = out.replace(/```(?:json|storyboard_project|storyboard-project|storyboard_copilot|storyboard|product_card|weavy_generate)?\s*(\{[\s\S]*)$/i, (match, rawTail) => {
    if (!rawTail || !rawTail.trim()) return '';
    const cleanTail = decodeJsonEntities(rawTail.trim());
    const sbCard = renderChatStoryboardCopilotCard(cleanTail, { preserveBlock });
    if (sbCard) return sbCard;
    return preserveBlock(`
      <div class="chat-typing-status" style="margin-top: 6px;">
        <div class="chat-typing-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
        <span>🎬 AI sedang merancang adegan storyboard...</span>
      </div>
    `);
  });

  // =========================================================================
  // 6. STANDALONE UN-FENCED JSON OBJECTS OR ARRAYS
  // This runs ONLY on remaining plain text where code fences do not exist!
  // =========================================================================
  let standaloneJsonOffset = 0;
  while (standaloneJsonOffset < out.length) {
    const startObj = out.indexOf('{', standaloneJsonOffset);
    const startArr = out.indexOf('[', standaloneJsonOffset);
    let start = -1;
    let isArray = false;

    if (startObj >= 0 && startArr >= 0) {
      if (startObj < startArr) {
        start = startObj;
        isArray = false;
      } else {
        start = startArr;
        isArray = true;
      }
    } else if (startObj >= 0) {
      start = startObj;
      isArray = false;
    } else if (startArr >= 0) {
      start = startArr;
      isArray = true;
    } else {
      break;
    }

    const openChar = isArray ? '[' : '{';
    const closeChar = isArray ? ']' : '}';
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;

    for (let index = start; index < out.length; index += 1) {
      const char = out[index];
      const isQuote = char === '"' || out.startsWith('&quot;', index);
      const quoteLen = out.startsWith('&quot;', index) ? 6 : 1;

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (isQuote) {
          inString = false;
          if (quoteLen > 1) index += (quoteLen - 1);
        }
      } else if (isQuote) {
        inString = true;
        if (quoteLen > 1) index += (quoteLen - 1);
      } else if (char === openChar) {
        depth += 1;
      } else if (char === closeChar) {
        depth -= 1;
        if (depth === 0) {
          end = index + 1;
          break;
        }
      }
    }

    if (end < 0) break;
    const candidate = out.slice(start, end);
    try {
      const decodedCandidate = decodeJsonEntities(candidate);

      // Check if storyboard
      const sbCard = renderChatStoryboardCopilotCard(decodedCandidate, { preserveBlock });
      if (sbCard) {
        out = `${out.slice(0, start)}${sbCard}${out.slice(end)}`;
        standaloneJsonOffset = start + sbCard.length;
        continue;
      }

      const config = JSON.parse(decodedCandidate);
      if (config && typeof config === 'object') {
        // Check if image generation
        if (config.prompt && (config.model || config.references || config.reference || config.aspect_ratio || config.aspectRatio)) {
          const genCard = renderWeavyGenCard(config);
          if (genCard) {
            out = `${out.slice(0, start)}${genCard}${out.slice(end)}`;
            standaloneJsonOffset = start + genCard.length;
            continue;
          }
        }

        // Check if Dola prompt
        if (config.prompt && (config.duration || config.type === 'video_prompt')) {
          const promptCard = renderStandaloneDolaPrompt(config);
          if (promptCard) {
            out = `${out.slice(0, start)}${promptCard}${out.slice(end)}`;
            standaloneJsonOffset = start + promptCard.length;
            continue;
          }
        }

        // Generic Structured JSON Viewer
        const jsonViewer = renderGenericJsonViewer(config, { preserveBlock });
        if (jsonViewer) {
          out = `${out.slice(0, start)}${jsonViewer}${out.slice(end)}`;
          standaloneJsonOffset = start + jsonViewer.length;
          continue;
        }
      }
    } catch (_) {
      // Leave non-matching JSON untouched.
    }
    standaloneJsonOffset = end;
  }

  // 6.5 Smart Unfenced Camera / Visual Prompt Detector
  // Catches markdown-styled prompts like **Prompt Gambar:**, **Prompt:**, Prompt:, etc. followed by camera/photographic prompt text
  out = out.replace(/(?:^|\n)(?:\*\*|__|\*|_)?(?:Prompt(?: Gambar| Visual| Foto| Video| Produk)?|Image Prompt|Visual Prompt)(?:\*\*|__|\*|_)?\s*:(?:\*\*|__|\*|_)?\s*\n+([A-Za-z0-9][\s\S]+?)(?=(?:\n\s*\n|\n\s*(?:\*\*|__|\#|\d+\.|\-|\•|🎬|💡|✨|$)))/gi, (match, rawPromptText) => {
    const cleanPrompt = decodeJsonEntities(rawPromptText.trim());
    const isCameraPrompt = cleanPrompt.length >= 25 && (
      cleanPrompt.includes('Shot on') ||
      cleanPrompt.includes('lens') ||
      cleanPrompt.includes('photography') ||
      cleanPrompt.includes('lighting') ||
      cleanPrompt.includes('camera') ||
      cleanPrompt.includes('Sony') ||
      cleanPrompt.includes('Hasselblad') ||
      cleanPrompt.includes('Canon') ||
      cleanPrompt.includes('Seedream') ||
      cleanPrompt.includes('aesthetic') ||
      cleanPrompt.includes('photograph') ||
      cleanPrompt.includes('ultra-detailed') ||
      cleanPrompt.includes('commercial')
    );
    if (isCameraPrompt) {
      const isVideo = /video|motion|cinematic|fps|camera move/i.test(cleanPrompt);
      const card = renderWeavyGenCard({
        prompt: cleanPrompt,
        aspect_ratio: /16:9/.test(cleanPrompt) ? '16:9' : (/1:1/.test(cleanPrompt) ? '1:1' : '9:16'),
        model: isVideo ? 'seedance_v2.5' : 'seedream_v5_pro_edit',
        mode: isVideo ? 'video' : 'image',
        provider: isVideo ? 'dola' : 'weavy',
      });
      if (card) return `\n${card}\n`;
    }
    return match;
  });

  // Markdown Tables
  out = out.replace(/((?:^[ \t]*\|[^\n]+\|[ \t]*(?:\r?\n|$))+)/gm, (tableBlock) => {
    const rawLines = tableBlock.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (rawLines.length < 2) return tableBlock;
    if (!/^[\|\s\-:]+$/.test(rawLines[1])) return tableBlock;

    const parseCells = (rowStr) => {
      const trimmed = rowStr.replace(/^\|/, '').replace(/\|$/, '');
      return trimmed.split('|').map(c => formatInline(c.trim()));
    };

    const headerCells = parseCells(rawLines[0]);
    const headerHtml = `<thead><tr>${headerCells.map(c => `<th>${c}</th>`).join('')}</tr></thead>`;

    const bodyRows = rawLines.slice(2);
    const bodyHtml = `<tbody>${bodyRows.map(row => {
      const cells = parseCells(row);
      return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
    }).join('')}</tbody>`;

    return preserveBlock(`<div class="chat-table-wrapper"><table class="chat-table">${headerHtml}${bodyHtml}</table></div>`);
  });

  // 1. Bersihkan artifak scraping Gemini DOM seperti baris terisolasi "WEBP\n+1" atau "JPG"
  out = out.replace(/(?:^|\n)\s*(WEBP|JPG|JPEG|PNG|GIF|MP4|MOV|WEBM)\s*\n\s*\+\s*(\d+)\s*(?=\n|$)/gi, (m, ext, cnt) => {
    return ` [${ext.toUpperCase()} + ${cnt}] `;
  });
  out = out.replace(/(?:^|\n)\s*(WEBP|JPG|JPEG|PNG|GIF|MP4|MOV|WEBM)\s*(?=\n|$)/gi, (m, ext) => {
    return ` [${ext.toUpperCase()}] `;
  });

  out = out.replace(/^(?:&gt;|>)\s*(.+)$/gm, (m, text) => preserveBlock(`<div class="chat-callout-box">${formatInline(text.trim())}</div>`));

  // 2. Sub-bullets / Indented bullets (spasi/tab diikuti •, -, *, o, ○)
  out = out.replace(/^(\s{2,}|\t+)(?:[•\-\*]|o|○)\s+(.+)$/gm, (m, indent, text) => {
    return preserveBlock(`<div class="chat-bullet-row chat-sub-bullet"><span class="sub-bullet-circle">○</span><div class="bullet-content">${formatInline(text.trim())}</div></div>`);
  });

  // 3. Standalone 'o ' atau '○ ' (karakteristik sub-list khas Google Gemini)
  out = out.replace(/^[o○]\s+(.+)$/gm, (m, text) => {
    return preserveBlock(`<div class="chat-bullet-row chat-sub-bullet"><span class="sub-bullet-circle">○</span><div class="bullet-content">${formatInline(text.trim())}</div></div>`);
  });

  // 4. Top-level bullet items (•, -, *)
  out = out.replace(/^[•\-\*]\s+(.+)$/gm, (m, text) => {
    return preserveBlock(`<div class="chat-bullet-row"><span class="bullet-dot"></span><div class="bullet-content">${formatInline(text.trim())}</div></div>`);
  });

  // 5. Nested sub-numbered list (misal: 1.1 atau indentasi angka)
  out = out.replace(/^(\s{2,}|\t+)(\d+)[\.\)]\s+(.+)$/gm, (m, indent, num, text) => {
    return preserveBlock(`<div class="chat-number-row chat-sub-number"><span class="number-badge sub-number-badge">${num}</span><div class="number-content">${formatInline(text.trim())}</div></div>`);
  });

  // 6. Top-level numbered list: 1. atau 1)
  out = out.replace(/^(\d+)[\.\)]\s+(.+)$/gm, (m, num, text) => {
    return preserveBlock(`<div class="chat-number-row"><span class="number-badge">${num}</span><div class="number-content">${formatInline(text.trim())}</div></div>`);
  });

  out = out.replace(/(?:<strong>)?(?:1\.\s*)?Analisis (?:Konten Gambar|Visual)(?:\s*\((@[a-z0-9_]+)\))?:?(?:<\/strong>)?:?/gi, (match, capturedTag) => {
    const validTag = (typeof capturedTag === 'string' && capturedTag.startsWith('@')) ? capturedTag : '';
    return preserveBlock(`
      <div class="analysis-visual-badge">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/><path d="m16 16-1.9-1.9"/></svg>
        <span class="analysis-visual-title">Analisis Konten Gambar${validTag ? ` (${escapeHtml(validTag)})` : ''}</span>
      </div>
    `);
  });

  out = out.replace(/(?:<strong>)?Catatan Ketidakcocokan:?(?:<\/strong>)?:?/gi, () => {
    return preserveBlock(`
      <div class="mismatch-alert-box">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span class="mismatch-alert-title">Catatan Ketidakcocokan</span>
      </div>
    `);
  });

  // Apply formatInline to the remaining regular paragraph text
  out = formatInline(out);

  // Bersihkan spasi ganda dan rapikan menjadi paragraf semantik (tanpa tumpukan <br> berlebih)
  const rawParagraphs = out.split(/\n{2,}/);
  out = rawParagraphs
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      // Jika satu blok murni merupakan preserved block (div/table/pre/badge), biarkan tanpa tag p
      if (/^___WEAVY_PRESERVED_BLOCK_\d+___$/.test(trimmed)) {
        return trimmed;
      }
      return `<p class="chat-paragraph">${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .filter(Boolean)
    .join('\n');

  out = out.replace(/(?:<br\s*\/?>\s*)+(___WEAVY_PRESERVED_BLOCK_\d+___)/gi, '$1');
  out = out.replace(/(___WEAVY_PRESERVED_BLOCK_\d+___)(?:\s*<br\s*\/?>)+/gi, '$1');

  // Recursively resolve all preserved blocks ensuring none are left unexpanded
  let expandLoops = 0;
  while (out.includes('___WEAVY_PRESERVED_BLOCK_') && expandLoops < 20) {
    expandLoops++;
    for (let i = 0; i < preservedBlocks.length; i++) {
      const placeholder = `___WEAVY_PRESERVED_BLOCK_${i}___`;
      if (out.includes(placeholder)) {
        out = out.replaceAll(placeholder, preservedBlocks[i]);
      }
    }
  }

  // --- OPSI 1: DIRECT STORYBOARD CARD ONLY ---
  // Jika pesan berisi Storyboard Project Card (chat-storyboard-copilot-card),
  // tampilkan HANYA Storyboard Card-nya saja secara bersih, ringkas, dan elegan!
  // Menghilangkan duplikasi teks naskah/shoot markdown panjang, teks intro/basa-basi, dan kartu prompt gambar di atasnya.
  const sbCards = preservedBlocks.filter((b) => typeof b === 'string' && b.includes('chat-storyboard-copilot-card'));
  if (sbCards.length > 0) {
    // Kembalikan kartu storyboard terakhir yang paling mutakhir
    return sbCards[sbCards.length - 1];
  }

  // Jika pesan sedang dalam proses streaming storyboard (belum ada card utuh tapi teks terdeteksi merancang storyboard):
  if (
    !sbCards.length &&
    (text.includes('```storyboard_project') ||
     text.includes('```storyboard') ||
     (text.includes('BAGIAN 1') && text.includes('SCENE 1')) ||
     (text.includes('Scene 1') && text.includes('Shoot 1') && text.includes('Voiceover')))
  ) {
    return `
      <div class="chat-typing-status" style="margin: 8px 0; padding: 12px 14px; border-radius: 8px; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); display: flex; align-items: center; gap: 8px;">
        <div class="chat-typing-dots"><span class="dot" style="background:#f59e0b;"></span><span class="dot" style="background:#f59e0b;"></span><span class="dot" style="background:#f59e0b;"></span></div>
        <span style="font-weight: 600; color: #f59e0b; font-size: 12px;">🎬 Sedang merancang adegan dan naskah Storyboard...</span>
      </div>
    `;
  }

  return out;
}
