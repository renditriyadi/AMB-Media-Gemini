// memory-manager.js - Three-Tier Memory Architecture for Agent V1
// 1. Conversation Memory (Canonical Chat - Single Source of Truth)
// 2. Project Memory (Persistent project context, brand rules, visual style)
// 3. Working Memory (Transient task execution context, intermediate states)

/**
 * Creates or retrieves the Project Memory for a session
 * Stored inside canonical session.metadata.projectMemory to prevent separate database duplicates
 * @param {Object} session - Canonical chat session
 * @returns {Object} Project Memory structure
 */
export function getOrCreateProjectMemory(session) {
  if (!session || typeof session !== 'object') {
    return createEmptyProjectMemory();
  }

  if (!session.metadata) {
    session.metadata = {};
  }

  if (!session.metadata.projectMemory || typeof session.metadata.projectMemory !== 'object') {
    session.metadata.projectMemory = createEmptyProjectMemory();
  }

  return session.metadata.projectMemory;
}

/**
 * Creates an empty persistent Project Memory schema
 */
export function createEmptyProjectMemory() {
  return {
    product: '',
    audience: '',
    campaign: '',
    visualStyle: '',
    constraints: [],
    brandRules: [],
    decisions: [],
    assets: [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Extracts explicit persistent project guidelines from user instructions (Memory Lifecycle Extraction)
 * Only extracts high-confidence, project-relevant directives to prevent memory pollution
 * @param {string} text - User prompt text
 * @returns {Object|null} Extracted candidates or null
 */
export function extractProjectMemoryCandidate(text = '') {
  if (!text || typeof text !== 'string' || text.length < 15) return null;

  const clean = text.trim();
  const lower = clean.toLowerCase();
  const extracted = {};
  let foundAny = false;

  // 1. Brand Rules / Tone Directives (e.g. "mulai sekarang gunakan tone premium", "selalu gunakan gaya energik")
  const toneMatch = clean.match(/(?:mulai sekarang|selalu gunakan|pastikan gaya|tone brand(?: kita)? (?:adalah|harus))\s+([^,\.\n]{4,80})/i);
  if (toneMatch && toneMatch[1]) {
    extracted.brandRules = [toneMatch[1].trim()];
    foundAny = true;
  }

  // 2. Constraints / Pantangan (e.g. "pantangan: jangan sebut kompetitor", "jangan pernah gunakan warna merah")
  const constraintMatch = clean.match(/(?:pantangan|batasan|jangan pernah|dilarang)\s*[:\-]?\s*([^,\.\n]{4,80})/i);
  if (constraintMatch && constraintMatch[1]) {
    extracted.constraints = [constraintMatch[1].trim()];
    foundAny = true;
  }

  // 3. Product Definition (e.g. "produk kita adalah Sepatu Lari Sonic", "produk yang dipasarkan:")
  const productMatch = clean.match(/(?:produk(?: kita| ini| baru)? (?:adalah|bernama)|nama produk(?:nya)?[:\s]+)\s*([^,\.\n]{3,60})/i);
  if (productMatch && productMatch[1]) {
    extracted.product = productMatch[1].trim();
    foundAny = true;
  }

  // 4. Target Audience (e.g. "target audiens kita adalah mahasiswa 18-24 tahun")
  const audienceMatch = clean.match(/(?:target audiens(?: kita)?|sasaran pasar(?:nya)?)\s*(?:adalah|:)?\s*([^,\.\n]{4,80})/i);
  if (audienceMatch && audienceMatch[1]) {
    extracted.audience = audienceMatch[1].trim();
    foundAny = true;
  }

  // 5. Visual Style (e.g. "gaya visual: cyberpunk neon", "visual style: minimalis monokrom")
  const visualMatch = clean.match(/(?:gaya visual|visual style|estetika visual)\s*(?:adalah|:)?\s*([^,\.\n]{4,60})/i);
  if (visualMatch && visualMatch[1]) {
    extracted.visualStyle = visualMatch[1].trim();
    foundAny = true;
  }

  return foundAny ? extracted : null;
}

/**
 * Updates Project Memory with key decisions or guidelines
 * @param {Object} session - Canonical session
 * @param {Object} updates - Key-value updates to project memory
 */
export function updateProjectMemory(session, updates = {}) {
  const memory = getOrCreateProjectMemory(session);

  if (typeof updates.product === 'string' && updates.product.trim()) {
    memory.product = updates.product.trim();
  }
  if (typeof updates.audience === 'string' && updates.audience.trim()) {
    memory.audience = updates.audience.trim();
  }
  if (typeof updates.campaign === 'string' && updates.campaign.trim()) {
    memory.campaign = updates.campaign.trim();
  }
  if (typeof updates.visualStyle === 'string' && updates.visualStyle.trim()) {
    memory.visualStyle = updates.visualStyle.trim();
  }

  if (Array.isArray(updates.constraints)) {
    updates.constraints.forEach((c) => {
      const cleanC = (c || '').trim();
      if (cleanC && !memory.constraints.includes(cleanC)) {
        memory.constraints.push(cleanC);
      }
    });
  }

  if (Array.isArray(updates.brandRules)) {
    updates.brandRules.forEach((r) => {
      const cleanR = (r || '').trim();
      if (cleanR && !memory.brandRules.includes(cleanR)) {
        memory.brandRules.push(cleanR);
      }
    });
  }

  if (Array.isArray(updates.decisions)) {
    updates.decisions.forEach((d) => {
      const cleanD = (d || '').trim();
      if (cleanD && !memory.decisions.includes(cleanD)) {
        memory.decisions.push(cleanD);
      }
    });
  }

  memory.updatedAt = new Date().toISOString();
  return memory;
}

/**
 * Formats Project Memory into a compact prompt string for LLM Context
 * Only included if project memory contains substantive guidelines
 */
export function formatProjectMemoryPrompt(projectMemory) {
  if (!projectMemory || typeof projectMemory !== 'object') return '';

  const parts = [];
  if (projectMemory.product) parts.push(`• Produk/Fokus: ${projectMemory.product}`);
  if (projectMemory.audience) parts.push(`• Target Audiens: ${projectMemory.audience}`);
  if (projectMemory.campaign) parts.push(`• Campaign/Tema: ${projectMemory.campaign}`);
  if (projectMemory.visualStyle) parts.push(`• Gaya Visual: ${projectMemory.visualStyle}`);
  if (Array.isArray(projectMemory.brandRules) && projectMemory.brandRules.length > 0) {
    parts.push(`• Aturan Brand: ${projectMemory.brandRules.join('; ')}`);
  }
  if (Array.isArray(projectMemory.constraints) && projectMemory.constraints.length > 0) {
    parts.push(`• Batasan/Pantangan: ${projectMemory.constraints.join('; ')}`);
  }

  if (parts.length === 0) return '';
  return `[PROJECT MEMORY GUIDELINES]\n${parts.join('\n')}`;
}

/**
 * Working Memory Factory for active task execution
 * Kept transient during task processing and cleared once completed.
 */
export class WorkingMemory {
  constructor(taskId, taskType) {
    this.taskId = taskId || `task_${Date.now()}`;
    this.taskType = taskType || 'general';
    this.currentStep = 1;
    this.totalSteps = 1;
    this.intermediateOutputs = [];
    this.requiredAssets = [];
    this.stepContexts = {};
    this.startedAt = new Date().toISOString();
    this.completedAt = null;
  }

  setStep(stepIndex, totalSteps = 1) {
    this.currentStep = stepIndex;
    this.totalSteps = totalSteps;
  }

  recordStepOutput(stepIndex, output) {
    this.intermediateOutputs.push({
      stepIndex,
      output,
      timestamp: new Date().toISOString(),
    });
  }

  getPreviousOutputs() {
    return this.intermediateOutputs.map((o) => `[Step ${o.stepIndex} Result]:\n${o.output}`).join('\n\n');
  }

  addRequiredAsset(asset) {
    if (asset && !this.requiredAssets.some((a) => a.url === asset.url || a.id === asset.id)) {
      this.requiredAssets.push(asset);
    }
  }

  complete() {
    this.completedAt = new Date().toISOString();
  }
}
