// storyboardActions.ts - Ekstraksi & merge lokal aksi Storyboard Copilot.
// Port dari ektension-weavy/js/storyboard/storyboard-intent.js (extractStoryboardCopilotAction)
// dan sidepanel.js (applyStoryboardCopilotSceneUpdate) supaya revisi scene
// diterapkan secara field-level di sisi klien (bukan hanya diminta ke model).

export interface StoryboardAction {
  action?: string;
  type?: string;
  reason?: string;
  project?: any;
  scenes?: any[];
  [key: string]: any;
}

export interface ExtractedStoryboardAction {
  cleanText: string;
  action: StoryboardAction | null;
}

const ALLOWED_PATCH_FIELDS = [
  'title',
  'timecode',
  'duration',
  'durationSec',
  'cameraAngle',
  'visualDescription',
  'voiceover',
  'onScreenText',
  'imagePrompt',
  'videoPrompt',
  'shoots',
];

/**
 * Parse JSON yang mungkin rusak (trailing comma, string tak tertutup, kurung kurang).
 */
export function tryParseLooseJson(str: string): any | null {
  if (!str || typeof str !== 'string') return null;
  let trimmed = str.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      return JSON.parse(trimmed.replace(/,\s*([\]}])/g, '$1'));
    } catch {
      try {
        let repaired = trimmed;

        let inString = false;
        let escape = false;
        for (let k = 0; k < repaired.length; k++) {
          const char = repaired[k];
          if (inString) {
            if (escape) escape = true;
            else if (char === '\\') escape = false;
            else if (char === '"') inString = false;
          } else {
            if (char === '"') inString = true;
          }
        }
        if (inString) repaired += '"';

        repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*(?:\]\}\}|\}\}|\]|\}|```|$)/gi, '');
        repaired = repaired.replace(/:\s*(?:\]\}\}|\}\}|\]|\}|```|$)/gi, ':null');
        repaired = repaired.replace(/,\s*([\]}])/g, '$1');
        repaired = repaired.replace(/,\s*$/g, '');

        const openBraces = (repaired.match(/\{/g) || []).length;
        const closeBraces = (repaired.match(/\}/g) || []).length;
        const openBrackets = (repaired.match(/\[/g) || []).length;
        const closeBrackets = (repaired.match(/\]/g) || []).length;
        for (let b = 0; b < openBrackets - closeBrackets; b++) repaired += ']';
        for (let c = 0; c < openBraces - closeBraces; c++) repaired += '}';

        return JSON.parse(repaired);
      } catch {
        try {
          const trimmedStr = trimmed.trim();
          const actionMatch =
            trimmedStr.match(/"action"\s*:\s*"([^"]+)"/i) || trimmedStr.match(/"type"\s*:\s*"([^"]+)"/i);
          if (actionMatch) {
            const reasonMatch = trimmedStr.match(/"reason"\s*:\s*"([^"]+)"/i);
            return {
              action: actionMatch[1],
              type: actionMatch[1],
              reason: reasonMatch ? reasonMatch[1] : 'Aksi storyboard dari Copilot.',
            };
          }
        } catch {
          /* ignore */
        }
        return null;
      }
    }
  }
}

/**
 * Ekstrak aksi JSON (update_scenes / create_storyboard_project / generate_scene)
 * dari teks balasan model, lalu sisihkan blok JSON dari teks bersih.
 */
export function extractStoryboardCopilotAction(rawText: string): ExtractedStoryboardAction {
  if (!rawText || typeof rawText !== 'string') {
    return { cleanText: String(rawText || ''), action: null };
  }

  let text = String(rawText);
  const foundActions: StoryboardAction[] = [];
  const segmentsToRemove: Array<{ start: number; end: number }> = [];

  const codeBlockRegex =
    /```(?:json|storyboard_project|storyboard-project|storyboard_copilot|storyboard-copilot|storyboard_draft|storyboard)?\s*([\s\S]*?)\s*```/gi;
  let cbMatch: RegExpExecArray | null;
  while ((cbMatch = codeBlockRegex.exec(text)) !== null) {
    const parsed = tryParseLooseJson(cbMatch[1]);
    if (!parsed) continue;
    if (parsed.action || Array.isArray(parsed.scenes) || parsed.project) {
      foundActions.push(parsed);
      segmentsToRemove.push({ start: cbMatch.index, end: cbMatch.index + cbMatch[0].length });
    }
  }

  // Scan kurung kurawal seimbang untuk JSON yang tidak dibungkus code block.
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '{') {
      i += 1;
      continue;
    }
    let depth = 0;
    let inString = false;
    let escape = false;
    const start = i;
    let end = -1;

    for (let j = start; j < text.length; j += 1) {
      const char = text[j];
      if (inString) {
        if (escape) escape = true;
        else if (char === '\\') escape = false;
        else if (char === '"') inString = false;
      } else {
        if (char === '"') inString = true;
        else if (char === '{') depth += 1;
        else if (char === '}') {
          depth -= 1;
          if (depth === 0) {
            end = j + 1;
            break;
          }
        }
      }
    }

    if (end === -1) break;

    const alreadyCaptured = segmentsToRemove.some((seg) => start >= seg.start && end <= seg.end);
    if (!alreadyCaptured) {
      const parsed = tryParseLooseJson(text.slice(start, end));
      if (parsed && (parsed.action || Array.isArray(parsed.scenes) || parsed.project)) {
        foundActions.push(parsed);
        segmentsToRemove.push({ start, end });
      }
    }
    i = end;
  }

  if (foundActions.length === 0) {
    return { cleanText: text.trim(), action: null };
  }

  // Bersihkan blok yang sudah diekstrak dari teks.
  const sorted = [...segmentsToRemove].sort((a, b) => b.start - a.start);
  let cleanText = text;
  for (const seg of sorted) {
    cleanText = cleanText.slice(0, seg.start) + cleanText.slice(seg.end);
  }
  cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();

  return { cleanText, action: foundActions[foundActions.length - 1] };
}

export interface SceneMergeResult {
  project: any | null;
  appliedCount: number;
  changedFields: string[];
}

/**
 * Merge lokal patch scene ke storyboard yang sudah ada (field-level, per sceneNumber).
 * Mengembalikan storyboard baru (tidak mutasi input).
 */
export function applyStoryboardSceneUpdate(
  currentProject: any | null,
  action: StoryboardAction | null
): SceneMergeResult {
  if (!action) return { project: currentProject, appliedCount: 0, changedFields: [] };

  const patches: any[] = Array.isArray(action.scenes)
    ? action.scenes
    : Array.isArray(action.project?.scenes)
    ? action.project.scenes
    : [];

  if (patches.length === 0) return { project: currentProject, appliedCount: 0, changedFields: [] };

  if (!currentProject || !Array.isArray(currentProject.scenes) || currentProject.scenes.length === 0) {
    // Belum ada storyboard -> aksi create_storyboard_project yang menyertakan payload project.
    const projectPayload = action.project;
    if (!projectPayload || !Array.isArray(projectPayload.scenes)) {
      return { project: currentProject, appliedCount: 0, changedFields: [] };
    }
    return { project: { ...currentProject, ...projectPayload }, appliedCount: projectPayload.scenes.length, changedFields: ['project'] };
  }

  const scenes = currentProject.scenes.map((scene: any) => ({ ...scene }));
  let appliedCount = 0;
  const changedFields: string[] = [];

  patches.forEach((patch: any) => {
    if (!patch) return;
    const idx = scenes.findIndex(
      (item: any) =>
        (patch.id && item.id === patch.id) ||
        (patch.sceneNumber !== undefined && item.sceneNumber === Number(patch.sceneNumber))
    );
    if (idx === -1) return;

    const target = scenes[idx];
    ALLOWED_PATCH_FIELDS.forEach((field) => {
      if (patch[field] === undefined || patch[field] === null) return;
      const nextValue =
        field === 'durationSec' || field === 'duration'
          ? Number(patch[field])
          : field === 'shoots' && Array.isArray(patch[field])
          ? patch[field].map((s: any) => ({ ...s }))
          : String(patch[field]);
      if (nextValue !== target[field]) {
        target[field] = nextValue;
        changedFields.push(`${idx + 1}.${field}`);
      }
    });
    if (changedFields.some((f) => f.startsWith(`${idx + 1}.`))) appliedCount += 1;
  });

  if (appliedCount === 0) {
    return { project: currentProject, appliedCount: 0, changedFields: [] };
  }

  return {
    project: { ...currentProject, scenes },
    appliedCount,
    changedFields,
  };
}

/**
 * Format ulang blok ```storyboard_project``` pada balasan model supaya
 * menampilkan hasil merge lokal (bukan versi lama dari model).
 */
export function renderStoryboardProjectBlock(project: any): string {
  if (!project) return '';
  const payload = {
    title: project.title,
    brief: project.brief,
    duration: project.duration,
    numScenes: project.numScenes,
    aspectRatio: project.aspectRatio,
    preset: project.preset,
    formula: project.formula,
    scenes: project.scenes,
  };
  return `\n\n\`\`\`storyboard_project\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
}
