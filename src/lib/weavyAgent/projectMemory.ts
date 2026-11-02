// projectMemory.ts - Project Memory persisten (Agent V1).
// Port dari ektension-weavy/js/agent/memory-manager.js.
// Disimpan di ChatSession.metadata.projectMemory supaya satu sumber kebenaran.

export interface WeavyProjectMemory {
  product: string;
  audience: string;
  campaign: string;
  visualStyle: string;
  constraints: string[];
  brandRules: string[];
  decisions: string[];
  assets: string[];
  updatedAt: string;
}

export function createEmptyProjectMemory(): WeavyProjectMemory {
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

export function getOrCreateProjectMemory(session: any): WeavyProjectMemory {
  if (!session || typeof session !== 'object') return createEmptyProjectMemory();
  if (!session.metadata) session.metadata = {};
  if (!session.metadata.projectMemory || typeof session.metadata.projectMemory !== 'object') {
    session.metadata.projectMemory = createEmptyProjectMemory();
  }
  return session.metadata.projectMemory;
}

/**
 * Ekstrak direktif proyek yang eksplisit dari teks user (high-confidence saja
 * supaya memori tidak tercemar isi ringan).
 */
export function extractProjectMemoryCandidate(text = ''): Partial<WeavyProjectMemory> | null {
  if (!text || typeof text !== 'string' || text.length < 15) return null;

  const clean = text.trim();
  const extracted: Partial<WeavyProjectMemory> = {};
  let foundAny = false;

  const toneMatch = clean.match(
    /(?:mulai sekarang|selalu gunakan|pastikan gaya|tone brand(?: kita)? (?:adalah|harus))\s+([^,\.\n]{4,80})/i
  );
  if (toneMatch && toneMatch[1]) {
    extracted.brandRules = [toneMatch[1].trim()];
    foundAny = true;
  }

  const constraintMatch = clean.match(/(?:pantangan|batasan|jangan pernah|dilarang)\s*[:\-]?\s*([^,\.\n]{4,80})/i);
  if (constraintMatch && constraintMatch[1]) {
    extracted.constraints = [constraintMatch[1].trim()];
    foundAny = true;
  }

  const productMatch = clean.match(
    /(?:produk(?: kita| ini| baru)? (?:adalah|bernama)|nama produk(?:nya)?[:\s]+)\s*([^,\.\n]{3,60})/i
  );
  if (productMatch && productMatch[1]) {
    extracted.product = productMatch[1].trim();
    foundAny = true;
  }

  const audienceMatch = clean.match(
    /(?:target audiens(?: kita)?|sasaran pasar(?:nya)?)\s*(?:adalah|:)?\s*([^,\.\n]{4,80})/i
  );
  if (audienceMatch && audienceMatch[1]) {
    extracted.audience = audienceMatch[1].trim();
    foundAny = true;
  }

  const visualMatch = clean.match(
    /(?:gaya visual|visual style|estetika visual)\s*(?:adalah|:)?\s*([^,\.\n]{4,60})/i
  );
  if (visualMatch && visualMatch[1]) {
    extracted.visualStyle = visualMatch[1].trim();
    foundAny = true;
  }

  return foundAny ? extracted : null;
}

export function updateProjectMemory(
  session: any,
  updates: Partial<WeavyProjectMemory> = {}
): WeavyProjectMemory {
  const memory = getOrCreateProjectMemory(session);

  if (typeof updates.product === 'string' && updates.product.trim()) memory.product = updates.product.trim();
  if (typeof updates.audience === 'string' && updates.audience.trim()) memory.audience = updates.audience.trim();
  if (typeof updates.campaign === 'string' && updates.campaign.trim()) memory.campaign = updates.campaign.trim();
  if (typeof updates.visualStyle === 'string' && updates.visualStyle.trim())
    memory.visualStyle = updates.visualStyle.trim();

  const pushUnique = (target: string[], incoming: unknown) => {
    if (!Array.isArray(incoming)) return;
    incoming.forEach((item) => {
      const clean = (item || '').toString().trim();
      if (clean && !target.includes(clean)) target.push(clean);
    });
  };

  pushUnique(memory.constraints, updates.constraints);
  pushUnique(memory.brandRules, updates.brandRules);
  pushUnique(memory.decisions, updates.decisions);
  pushUnique(memory.assets, updates.assets);

  memory.updatedAt = new Date().toISOString();
  return memory;
}

export function formatProjectMemoryPrompt(projectMemory: any): string {
  if (!projectMemory || typeof projectMemory !== 'object') return '';

  const parts: string[] = [];
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
 * Working Memory transien untuk eksekusi task (dibuat per-turn, dibuang setelah selesai).
 */
export class WorkingMemory {
  taskId: string;
  taskType: string;
  currentStep = 1;
  totalSteps = 1;
  intermediateOutputs: Array<{ stepIndex: number; output: string; timestamp: string }> = [];
  requiredAssets: any[] = [];
  stepContexts: Record<string, unknown> = {};
  startedAt = new Date().toISOString();
  completedAt: string | null = null;

  constructor(taskId?: string, taskType?: string) {
    this.taskId = taskId || `task_${Date.now()}`;
    this.taskType = taskType || 'general';
  }

  setStep(stepIndex: number, totalSteps = 1) {
    this.currentStep = stepIndex;
    this.totalSteps = totalSteps;
  }

  recordStepOutput(stepIndex: number, output: string) {
    this.intermediateOutputs.push({ stepIndex, output, timestamp: new Date().toISOString() });
  }

  getPreviousOutputs(): string {
    return this.intermediateOutputs.map((o) => `[Step ${o.stepIndex} Result]:\n${o.output}`).join('\n\n');
  }

  addRequiredAsset(asset: any) {
    if (asset && !this.requiredAssets.some((a) => a.url === asset.url || a.id === asset.id)) {
      this.requiredAssets.push(asset);
    }
  }

  complete() {
    this.completedAt = new Date().toISOString();
  }
}
