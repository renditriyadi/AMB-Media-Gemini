import JSZip from 'jszip';
import {
  StudioProject,
  StudioScene,
  StudioAnalysis,
  StudioVideoMetadata,
  StudioAiModel,
  StudioImageModel,
  StudioAspectRatio,
  StudioBriefInputs,
  StudioCustomAsset,
  StudioAtmRemixParams,
  StudioAtmRemixResult,
} from '../types/studio';
import { ProviderAccount } from '../components/GlobalSettingsView';
import { extensionBridge } from './extensionBridge';
import { verifyWeavyAccount } from './weavyApi';

/**
 * Gets all saved Weavy accounts from localStorage
 */
export function getAllWeavyAccounts(): ProviderAccount[] {
  try {
    const raw = localStorage.getItem('weavy_accounts');
    if (raw) {
      const accounts: ProviderAccount[] = JSON.parse(raw);
      if (Array.isArray(accounts)) {
        return accounts;
      }
    }
  } catch (e) {}
  return [];
}

/**
 * Gets active Weavy account
 */
export function getActiveWeavyAccount(): ProviderAccount | null {
  const accounts = getAllWeavyAccounts();
  if (accounts.length > 0) {
    return accounts.find((a) => a.isActive) || accounts[0];
  }
  return null;
}

/**
 * Sets active Weavy account by ID and dispatches update events
 */
export function switchActiveWeavyAccount(accountId: string): ProviderAccount | null {
  try {
    const accounts = getAllWeavyAccounts();
    if (accounts.length === 0) return null;

    let targetAcc: ProviderAccount | null = null;
    const updated = accounts.map((acc) => {
      const isTarget = acc.id === accountId;
      if (isTarget) targetAcc = acc;
      return {
        ...acc,
        isActive: isTarget,
      };
    });

    localStorage.setItem('weavy_accounts', JSON.stringify(updated));
    window.dispatchEvent(new Event('weavy_accounts_updated'));
    window.dispatchEvent(new Event('accounts-updated'));
    return targetAcc;
  } catch (e) {
    console.warn('[Studio] Failed to switch active account:', e);
    return null;
  }
}

/**
 * Finds next available Weavy account that has credits (> 0 credits or unverified)
 */
export function findNextAccountWithCredits(excludeAccountId?: string, minCredits: number = 2): ProviderAccount | null {
  const accounts = getAllWeavyAccounts();
  if (accounts.length === 0) return null;

  // 1. Filter account with credits >= minCredits
  const candidate = accounts.find(
    (a) =>
      a.id !== excludeAccountId &&
      typeof a.credits === 'number' &&
      a.credits >= minCredits &&
      Boolean(a.refreshToken || (a as any).token || a.accessToken)
  );

  if (candidate) return candidate;

  // 2. Filter any account with > 0 credits
  const anyWithCredit = accounts.find(
    (a) =>
      a.id !== excludeAccountId &&
      typeof a.credits === 'number' &&
      a.credits > 0 &&
      Boolean(a.refreshToken || (a as any).token || a.accessToken)
  );

  if (anyWithCredit) return anyWithCredit;

  // 3. Fallback: filter any account whose credits are unverified / not strictly 0
  const fallback = accounts.find(
    (a) =>
      a.id !== excludeAccountId &&
      a.credits !== 0 &&
      Boolean(a.refreshToken || (a as any).token || a.accessToken)
  );

  return fallback || null;
}

/**
 * Updates a specific Weavy account's credit count in storage and dispatches sync events
 */
export function updateWeavyAccountCredits(
  accountId: string,
  newCredits: number,
  extraData?: { totalCredits?: number; idToken?: string }
): void {
  try {
    const accounts = getAllWeavyAccounts();
    if (accounts.length === 0) return;

    const updated = accounts.map((acc) => {
      if (acc.id === accountId) {
        return {
          ...acc,
          credits: Math.max(0, newCredits),
          ...(extraData?.totalCredits !== undefined ? { totalCredits: extraData.totalCredits } : {}),
          ...(extraData?.idToken ? { idToken: extraData.idToken } : {}),
        };
      }
      return acc;
    });

    localStorage.setItem('weavy_accounts', JSON.stringify(updated));
    window.dispatchEvent(new Event('weavy_accounts_updated'));
    window.dispatchEvent(new Event('accounts-updated'));
  } catch (e) {
    console.warn('[Studio] Error updating account credits:', e);
  }
}

/**
 * Syncs real-time credit balance for an account from backend
 */
export async function syncWeavyAccountCredits(account: ProviderAccount): Promise<number | null> {
  const token = account.refreshToken || (account as any).token || account.accessToken;
  if (!token) return null;

  try {
    const verification = await verifyWeavyAccount(token);
    if (verification.success && typeof verification.credits === 'number') {
      updateWeavyAccountCredits(account.id, verification.credits, {
        totalCredits: verification.totalCredits,
        idToken: verification.idToken,
      });
      return verification.credits;
    }
  } catch (e) {
    console.warn('[Studio] Sync account credits error:', e);
  }
  return null;
}

export function getAllWeavyRefreshTokens(): string[] {
  const accounts = getAllWeavyAccounts();
  return accounts.map((a) => a.refreshToken || (a as any).token || a.accessToken || '').filter(Boolean);
}

/**
 * 1. Analyzes a video using Weavy LLM & produces a 4-6 scene storyboard with prompts
 */
export async function analyzeVideoForStudio(params: {
  videoUrl?: string;
  title?: string;
  rawPrompt?: string;
  productName?: string;
  productDescription?: string;
  productImage?: string;
  modelTalent?: string;
  modelImage?: string;
  backgroundSetting?: string;
  backgroundImage?: string;
  mainBrief?: string;
  totalDurationSec?: number;
  numScenes?: number;
  aspectRatio?: string;
  imageModel?: string;
  aiModel?: StudioAiModel;
  customAssets?: StudioCustomAsset[];
}): Promise<{
  metadata: StudioVideoMetadata;
  analysis: StudioAnalysis;
  scenes: StudioScene[];
  aiModel?: string;
}> {
  let activeAcc = getActiveWeavyAccount();
  const allTokens = getAllWeavyRefreshTokens();

  // If active account has 0 credits or missing, attempt auto-switching to an account with credits before request
  if (!activeAcc || (typeof activeAcc.credits === 'number' && activeAcc.credits <= 0)) {
    const nextAcc = findNextAccountWithCredits(activeAcc?.id, 1);
    if (nextAcc) {
      console.log(`[Studio Auto-Switch] Akun aktif ${activeAcc?.name || activeAcc?.email || 'saat ini'} kredit 0. Berpindah otomatis ke ${nextAcc.name || nextAcc.email} (${nextAcc.credits} CR).`);
      switchActiveWeavyAccount(nextAcc.id);
      window.dispatchEvent(new Event('weavy_accounts_updated'));
      window.dispatchEvent(new Event('accounts-updated'));
      activeAcc = nextAcc;
    }
  }

  const token = activeAcc?.refreshToken || (activeAcc as any)?.token || activeAcc?.accessToken;

  const resp = await fetch('/api/studio/analyze-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoUrl: params.videoUrl,
      title: params.title,
      rawPrompt: params.rawPrompt,
      productName: params.productName,
      productDescription: params.productDescription,
      productImage: params.productImage,
      modelTalent: params.modelTalent,
      modelImage: params.modelImage,
      backgroundSetting: params.backgroundSetting,
      backgroundImage: params.backgroundImage,
      mainBrief: params.mainBrief,
      totalDurationSec: params.totalDurationSec,
      numScenes: params.numScenes,
      aspectRatio: params.aspectRatio || '9:16',
      imageModel: params.imageModel || 'GPT Image 2.5',
      aiModel: params.aiModel || 'google/gemini-2.5-flash',
      customAssets: params.customAssets,
      refreshToken: token,
      idToken: activeAcc?.idToken,
      allRefreshTokens: allTokens,
    }),
  });

  const data = await resp.json();
  if (!resp.ok || !data.success || !data.data) {
    const rawErr = data.error || '';
    if (resp.status === 402 || isCreditErrorMessage(rawErr)) {
      if (activeAcc) {
        updateWeavyAccountCredits(activeAcc.id, 0);
      }
      const nextAcc = findNextAccountWithCredits(activeAcc?.id, 1);
      if (nextAcc) {
        console.log(`[Studio Auto-Switch on Analyze Error] Kredit habis pada ${activeAcc?.name || activeAcc?.email}. Beralih otomatis ke ${nextAcc.name || nextAcc.email}...`);
        switchActiveWeavyAccount(nextAcc.id);
        window.dispatchEvent(new Event('weavy_accounts_updated'));
        window.dispatchEvent(new Event('accounts-updated'));

        // Auto retry analyze with nextAcc
        const retryToken = nextAcc.refreshToken || (nextAcc as any).token || nextAcc.accessToken;
        const retryResp = await fetch('/api/studio/analyze-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoUrl: params.videoUrl,
            title: params.title,
            rawPrompt: params.rawPrompt,
            productName: params.productName,
            productDescription: params.productDescription,
            productImage: params.productImage,
            modelTalent: params.modelTalent,
            modelImage: params.modelImage,
            backgroundSetting: params.backgroundSetting,
            backgroundImage: params.backgroundImage,
            mainBrief: params.mainBrief,
            totalDurationSec: params.totalDurationSec,
            numScenes: params.numScenes,
            aspectRatio: params.aspectRatio || '9:16',
            imageModel: params.imageModel || 'GPT Image 2.5',
            aiModel: params.aiModel || 'google/gemini-2.5-flash',
            refreshToken: retryToken,
            idToken: nextAcc.idToken,
            allRefreshTokens: allTokens,
          }),
        });

        const retryData = await retryResp.json();
        if (retryResp.ok && retryData.success && retryData.data) {
          return retryData.data;
        }
        if (retryData.error) {
          throw new Error(retryData.error);
        }
      }
    }
    throw new Error(data.error || 'Gagal menganalisis video dengan Weavy LLM.');
  }

  return data.data;
}

/**
 * 1b. ATM (Amati, Tiru, Modifikasi) Storyboard Remixer:
 * Takes existing analysis + duration + character + creative style modifiers and remakes the entire storyboard
 */
export async function remixStudioStoryboard(
  params: StudioAtmRemixParams
): Promise<StudioAtmRemixResult> {
  let activeAcc = getActiveWeavyAccount();
  const allTokens = getAllWeavyRefreshTokens();

  if (!activeAcc || (typeof activeAcc.credits === 'number' && activeAcc.credits <= 0)) {
    const nextAcc = findNextAccountWithCredits(activeAcc?.id, 1);
    if (nextAcc) {
      console.log(`[Studio ATM Remix Auto-Switch] Beralih akun ke ${nextAcc.name || nextAcc.email}`);
      switchActiveWeavyAccount(nextAcc.id);
      window.dispatchEvent(new Event('weavy_accounts_updated'));
      activeAcc = nextAcc;
    }
  }

  const token = activeAcc?.refreshToken || (activeAcc as any)?.token || activeAcc?.accessToken;

  const resp = await fetch('/api/studio/remix-storyboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseAnalysis: params.baseAnalysis,
      baseMetadata: params.baseMetadata,
      targetDurationSec: params.targetDurationSec,
      numScenes: params.numScenes,
      numCameraAngles: params.numCameraAngles,
      preferredAngles: params.preferredAngles,
      remixStyle: params.remixStyle,
      customStyleNotes: params.customStyleNotes,
      characterTalent: params.characterTalent,
      characterImage: params.characterImage,
      productName: params.productName,
      productDescription: params.productDescription,
      productImage: params.productImage,
      backgroundSetting: params.backgroundSetting,
      backgroundImage: params.backgroundImage,
      creativeAngle: params.creativeAngle,
      aspectRatio: params.aspectRatio || '9:16',
      imageModel: params.imageModel || 'ChatGPT Images 2.0 Edit',
      aiModel: params.aiModel || 'google/gemini-2.5-flash',
      refreshToken: token,
      idToken: activeAcc?.idToken,
      allRefreshTokens: allTokens,
    }),
  });

  const data = await resp.json();
  if (!resp.ok || !data.success || !data.data) {
    throw new Error(data.error || 'Gagal merancang ulang storyboard dengan metode ATM.');
  }

  return data.data;
}

/**
 * Helper to check if an error string indicates credit exhaustion
 */
export function isCreditErrorMessage(errorStr: string): boolean {
  if (!errorStr) return false;
  const lower = errorStr.toLowerCase();
  return (
    lower.includes('insufficient credits') ||
    lower.includes('insufficient credit') ||
    lower.includes('insufficient') ||
    lower.includes('credit') ||
    lower.includes('kredit') ||
    lower.includes('quota') ||
    lower.includes('amount') ||
    lower.includes('habis') ||
    lower.includes('balance') ||
    lower.includes('not enough credit')
  );
}

/**
 * 2. Initiates generation for a single scene and returns taskId/recipeId immediately
 * Handles auto-account switching if credit is exhausted or fails with quota error.
 */
export async function initiateStudioSceneGeneration(
  scene: StudioScene,
  modelName: string = 'GPT Image 2.5',
  aspectRatio: string = '9:16',
  accountOverride?: ProviderAccount,
  referenceImages?: string[],
  briefInputs?: StudioBriefInputs
): Promise<{
  recipeId: string;
  nodeId: string;
  taskId: string;
  accountUsed: ProviderAccount;
}> {
  let account = accountOverride || getActiveWeavyAccount();

  // Check if current account has credits; if 0, auto switch
  if (account && typeof account.credits === 'number' && account.credits < 2) {
    const nextAcc = findNextAccountWithCredits(account.id, 2);
    if (nextAcc) {
      console.log(`[Studio Auto-Switch] Akun ${account.name || account.email} kredit habis (${account.credits} CR). Berpindah otomatis ke ${nextAcc.name || nextAcc.email} (${nextAcc.credits} CR).`);
      switchActiveWeavyAccount(nextAcc.id);
      window.dispatchEvent(new Event('weavy_accounts_updated'));
      window.dispatchEvent(new Event('accounts-updated'));
      account = nextAcc;
    }
  }

  if (!account) {
    throw new Error('Tidak ada akun Weavy yang terdaftar. Silakan buka menu Settings dan hubungkan akun Weavy.');
  }

  const allTokens = getAllWeavyRefreshTokens();
  const token = account.refreshToken || (account as any).token || account.accessToken;

  if (!token) {
    throw new Error(`Token akun ${account.name || account.email || 'Weavy'} tidak valid.`);
  }

  // Collect reference images for image-to-image consistency
  const refImgs: string[] = [];
  if (Array.isArray(referenceImages) && referenceImages.length > 0) {
    refImgs.push(...referenceImages.filter(Boolean));
  }
  if (briefInputs) {
    if (briefInputs.productImage && !refImgs.includes(briefInputs.productImage)) {
      refImgs.push(briefInputs.productImage);
    }
    if (briefInputs.modelImage && !refImgs.includes(briefInputs.modelImage)) {
      refImgs.push(briefInputs.modelImage);
    }
    if (briefInputs.backgroundImage && !refImgs.includes(briefInputs.backgroundImage)) {
      refImgs.push(briefInputs.backgroundImage);
    }
  }

  const attachedMediaList = refImgs.slice(0, 10).map((url, i) => ({
    id: `ref_img_${i}`,
    type: 'image',
    url,
    previewUrl: url,
  }));

  const genPayload: any = {
    mode: 'image',
    model: modelName,
    imageModel: modelName,
    prompt: scene.imagePrompt,
    aspect_ratio: aspectRatio,
    resolution: '1080p',
    refreshToken: token,
    idToken: account.idToken,
    allRefreshTokens: allTokens,
  };

  if (refImgs.length > 0) {
    genPayload.images = refImgs;
    genPayload.reference_images = refImgs;
    genPayload.attached_media = attachedMediaList;
    genPayload.imageUrl = refImgs[0];
  }

  // Send request via Chrome Extension Bridge (100% Bebas 403) or server fallback
  let genData: any = null;
  if (extensionBridge.getStatus().isConnected) {
    console.log('[Studio 🚀] Menjalankan scene generation via Chrome Extension Bridge (100% Bebas 403)...');
    genData = await extensionBridge.generateWeavy({
      ...genPayload,
      refreshToken: account.refreshToken,
      idToken: account.idToken,
    });
  } else {
    const genResp = await fetch('/api/generate-weavy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(genPayload),
    });
    genData = await genResp.json();
  }

  // Handle Quota/Credit exhausted error -> Auto switch account and retry once
  if (!genData || !genData.success) {
    const rawErr = genData?.error || '';
    if (isCreditErrorMessage(rawErr)) {
      // Mark current account credits as 0
      updateWeavyAccountCredits(account.id, 0);
      const nextAcc = findNextAccountWithCredits(account.id, 2);
      if (nextAcc) {
        console.log(`[Studio Auto-Switch on Initiate Fail] Kredit habis pada ${account.name || account.email}. Beralih ke ${nextAcc.name || nextAcc.email}...`);
        switchActiveWeavyAccount(nextAcc.id);
        window.dispatchEvent(new Event('weavy_accounts_updated'));
        window.dispatchEvent(new Event('accounts-updated'));
        return initiateStudioSceneGeneration(scene, modelName, aspectRatio, nextAcc, referenceImages, briefInputs);
      }
    }

    throw new Error(genData?.error || 'Gagal mengirim permintaan generasi ke Weavy AI.');
  }

  const { recipeId, nodeId, taskId } = genData;
  if (!recipeId) {
    throw new Error('Respon Weavy tidak menyertakan recipeId.');
  }

  // Auto deduct ~2 credits locally and trigger background verification
  if (typeof account.credits === 'number' && account.credits > 0) {
    const estimatedCredits = Math.max(0, account.credits - 2);
    updateWeavyAccountCredits(account.id, estimatedCredits);
    // Background async sync
    setTimeout(() => {
      if (account) syncWeavyAccountCredits(account);
    }, 3000);
  }

  return {
    recipeId,
    nodeId,
    taskId,
    accountUsed: account,
  };
}

/**
 * 3. Polls status until completed (or max attempts) and returns final image URL
 * Automatically handles account rotation & re-generation if a credit error occurs during polling.
 */
export async function pollStudioTaskCompletion(
  recipeId: string,
  nodeId: string,
  taskId: string,
  token: string,
  onProgress?: (progress: number) => void,
  sceneContext?: {
    scene: StudioScene;
    modelName?: string;
    aspectRatio?: string;
  },
  retryCount: number = 0
): Promise<string> {
  // 1. Polling via Extension Bridge langsung
  if (extensionBridge.getStatus().isConnected && recipeId && taskId) {
    try {
      const bridgeUrl = await extensionBridge.pollWeavyStatus({
        recipeId,
        taskId,
        batchId: taskId,
        nodeId,
        refreshToken: token,
        maxAttempts: 45,
        pollInterval: 2000,
        onProgress,
      });
      if (bridgeUrl) return bridgeUrl;
    } catch (bPollErr: any) {
      console.warn('[Studio Bridge Poll Error]:', bPollErr);
      if (bPollErr?.message && (bPollErr.message.includes('gagal') || bPollErr.message.includes('habis'))) {
        throw bPollErr;
      }
    }
  }

  const maxAttempts = 40;
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 2000));
    attempts++;
    onProgress?.(Math.min(95, 25 + attempts * 2));

    try {
      const pollResp = await fetch('/api/poll-weavy-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId,
          nodeId,
          taskId,
          refreshToken: token,
        }),
      });

      if (pollResp.ok) {
        const pollData = await pollResp.json();
        const finalUrl =
          pollData.resultUrl ||
          pollData.imageUrl ||
          pollData.mediaUrl ||
          pollData.outputUrl ||
          pollData.url ||
          (typeof pollData.result === 'string' && pollData.result.startsWith('http') ? pollData.result : null);

        if (pollData.status === 'completed' || finalUrl) {
          if (finalUrl && typeof finalUrl === 'string' && finalUrl.startsWith('http')) {
            onProgress?.(100);
            return finalUrl;
          }
        } else if (pollData.status === 'failed') {
          const rawErr = pollData.error || 'Generasi gambar gagal pada Weavy AI.';

          // Check if failure is due to credit exhaustion
          if (isCreditErrorMessage(rawErr)) {
            const allAccounts = getAllWeavyAccounts();
            const currentAcc =
              allAccounts.find(
                (a) =>
                  a.refreshToken === token ||
                  (a as any).token === token ||
                  a.accessToken === token
              ) || getActiveWeavyAccount();

            if (currentAcc) {
              updateWeavyAccountCredits(currentAcc.id, 0);
              const nextAcc = findNextAccountWithCredits(currentAcc.id, 2);

              if (nextAcc && retryCount < 3) {
                console.log(
                  `[Studio Auto-Switch on Poll Fail] Insufficient credits detected on account ${currentAcc.name || currentAcc.email}. Auto-switching to ${nextAcc.name || nextAcc.email} (${nextAcc.credits} CR) and re-generating scene...`
                );
                switchActiveWeavyAccount(nextAcc.id);
                window.dispatchEvent(new Event('weavy_accounts_updated'));
                window.dispatchEvent(new Event('accounts-updated'));

                if (sceneContext?.scene) {
                  const {
                    recipeId: newRecipeId,
                    nodeId: newNodeId,
                    taskId: newTaskId,
                    accountUsed: newAcc,
                  } = await initiateStudioSceneGeneration(
                    sceneContext.scene,
                    sceneContext.modelName || 'GPT Image 2.5',
                    sceneContext.aspectRatio || '9:16',
                    nextAcc
                  );

                  const newToken =
                    newAcc.refreshToken ||
                    (newAcc as any).token ||
                    newAcc.accessToken ||
                    '';

                  return pollStudioTaskCompletion(
                    newRecipeId,
                    newNodeId,
                    newTaskId,
                    newToken,
                    onProgress,
                    sceneContext,
                    retryCount + 1
                  );
                }
              }
            }
          }

          throw new Error(rawErr);
        }
      }
    } catch (pollErr: any) {
      if (
        pollErr &&
        pollErr.message &&
        (pollErr.message.includes('gagal') ||
          pollErr.message.includes('Failed') ||
          pollErr.message.includes('credit') ||
          pollErr.message.includes('Insufficient') ||
          pollErr.message.includes('quota') ||
          pollErr.message.includes('habis'))
      ) {
        throw pollErr;
      }
    }
  }

  throw new Error('Generasi gambar timeout (melebihi batas waktu 80 detik).');
}

/**
 * 4. Helper for single scene generation (combines initiate + poll)
 */
export async function generateStudioSceneImage(
  scene: StudioScene,
  modelName: string = 'GPT Image 2.5',
  aspectRatio: string = '9:16',
  onProgress?: (progress: number) => void
): Promise<string> {
  onProgress?.(10);
  const { recipeId, nodeId, taskId, accountUsed } = await initiateStudioSceneGeneration(scene, modelName, aspectRatio);
  onProgress?.(25);

  const token = accountUsed.refreshToken || (accountUsed as any).token || accountUsed.accessToken || '';
  const url = await pollStudioTaskCompletion(recipeId, nodeId, taskId, token, onProgress, {
    scene,
    modelName,
    aspectRatio,
  });
  return url;
}

/**
 * 4a. Helper for generating arbitrary custom studio image (e.g. AI Talent / Character)
 */
export async function generateStudioCustomImage({
  prompt,
  aspectRatio = '9:16',
  modelName = 'GPT Image 2.5',
  referenceImages = [],
  onProgress
}: {
  prompt: string;
  aspectRatio?: string;
  modelName?: string;
  referenceImages?: string[];
  onProgress?: (progress: number) => void;
}): Promise<string> {
  const dummyScene: StudioScene = {
    id: `talent_${Date.now()}`,
    sceneNumber: 1,
    title: 'AI Talent Portrait',
    durationSec: 5,
    timecode: '00:00-00:05',
    sceneGoal: 'AI Talent Portrait',
    visualDescription: prompt,
    imagePrompt: prompt,
    status: 'generating'
  };

  onProgress?.(10);
  const { recipeId, nodeId, taskId, accountUsed } = await initiateStudioSceneGeneration(
    dummyScene,
    modelName,
    aspectRatio,
    undefined,
    referenceImages
  );
  onProgress?.(25);

  const token = accountUsed.refreshToken || (accountUsed as any).token || accountUsed.accessToken || '';
  const url = await pollStudioTaskCompletion(recipeId, nodeId, taskId, token, onProgress, {
    scene: dummyScene,
    modelName,
    aspectRatio,
  });
  return url;
}

/**
 * 4b. Compiles all scene prompts into one comprehensive 16:9 contact sheet / storyboard grid prompt
 */
export function buildOneSheetGridPrompt(scenes: StudioScene[], projectName?: string): string {
  if (!scenes || scenes.length === 0) {
    return 'A cinematic 16:9 storyboard contact sheet grid, professional 6-panel storyboard arrangement in a clean 3x2 grid layout, photorealistic 8k commercial cinematography, uniform lighting and character across all panels.';
  }

  const panelTexts = scenes
    .map((s, idx) => {
      const timecode = s.timecode || `00:${String(idx * 5).padStart(2, '0')}-00:${String((idx + 1) * 5).padStart(2, '0')} (Scene ${s.sceneNumber || idx + 1})`;
      const visual = s.visualDescription || s.sceneGoal || s.imagePrompt;
      return `Panel ${idx + 1} [${timecode}]: ${visual}`;
    })
    .join('\n\n');

  const cols = scenes.length <= 4 ? 2 : 3;
  const rows = Math.ceil(scenes.length / cols);

  return `A cinematic 16:9 storyboard contact sheet grid, professional ${scenes.length}-panel sequential storyboard arrangement in a clean ${cols}x${rows} grid layout displaying the full visual narrative for "${projectName || 'Commercial Video'}":

${panelTexts}

Overall Visual Style & Composition:
- Aspect Ratio & Layout: 16:9 widescreen composition structured into neat sequential storyboard grid panels separated by crisp clean dark gutters.
- Visual Quality: Ultra photorealistic 8k, crisp natural cinematic lighting, uniform color grading, consistent subject and environment across all panels.
- Highly detailed commercial cinematography with immaculate focus, depth, and tactile realistic textures.`;
}

/**
 * 4b2. Builds Master Production Sheet Prompt (World Bible Contact Sheet)
 * Combines Product, Talent, Environment, and Key Props into a single 16:9 4-panel master reference
 */
export function buildMasterProductionSheetPrompt(project: StudioProject): string {
  const pName = project.briefInputs?.productName || project.analysis?.productOrTopicName || project.name || 'Commercial Product';
  const pDesc = project.briefInputs?.productDescription || project.analysis?.productImageAnalysis || 'Premium product packaging and tactile details';
  const mName = project.briefInputs?.modelTalent || project.analysis?.modelTalent || 'Authentic Commercial Model';
  const mDesc = project.analysis?.modelImageAnalysis || 'Photorealistic Asian model, authentic natural skin texture, exact clothing and hairstyle';
  const envName = project.briefInputs?.backgroundSetting || project.analysis?.backgroundSetting || 'Vibrant Authentic Setting';
  const envDesc = project.analysis?.backgroundImageAnalysis || 'Natural realistic environment, cinematic lighting and clean atmospheric depth';
  const keyAction = project.scenes?.[0]?.visualDescription || 'Hero shot of model interacting naturally with the product';

  return `A cinematic 16:9 master production reference sheet, visual world bible, and multi-element contact sheet grid for commercial video "${pName}":

- Panel 1 [HERO PRODUCT & TEXTURE]: Crisp ultra-detailed hero showcase of "${pName}" (${pDesc}), showing authentic packaging label, vivid colors, and high-fidelity surface textures.
- Panel 2 [MAIN TALENT & WARDROBE]: Character turnaround of "${mName}" (${mDesc}), authentic facial features, smiling friendly expression, consistent hairstyle, and exact casual outfit.
- Panel 3 [ENVIRONMENT & SETTING]: Wide cinematic establishing shot of "${envName}" (${envDesc}), lush realistic atmosphere, soft natural lighting, and immersive environmental context.
- Panel 4 [KEY ACTION & PROOF]: Dynamic close-up interaction: ${keyAction}, showing authentic product usage and compelling visual proof of quality.

Layout & Aesthetics:
- Composition: 4-panel side-by-side / 2x2 grid moodboard in a seamless 16:9 widescreen canvas separated by neat dark borders.
- Style: Ultra photorealistic 8K photography, Hasselblad commercial cinematography, uniform lighting and color temperature across all 4 panels. No cartoon, no 3D render, no CGI.`;
}

/**
 * 4c. Collects all available reference images from project (video cover, completed scenes, etc.)
 */
export function collectStudioReferenceImages(project: StudioProject): string[] {
  const images: string[] = [];

  // 0. Master Production Sheet (HIGHEST PRIORITY SINGLE SOURCE OF TRUTH)
  if (project.masterProductionSheet?.imageUrl && project.masterProductionSheet.isUsedAsSceneAnchor !== false) {
    const masterUrl = project.masterProductionSheet.imageUrl.trim();
    if (masterUrl && (masterUrl.startsWith('http') || masterUrl.startsWith('data:image'))) {
      images.push(masterUrl);
    }
  }

  // 1. Brief Inputs Uploaded Images (Product, Model, Background, Custom Assets)
  if (project.briefInputs) {
    if (project.briefInputs.productImage && !images.includes(project.briefInputs.productImage)) {
      images.push(project.briefInputs.productImage);
    }
    if (project.briefInputs.modelImage && !images.includes(project.briefInputs.modelImage)) {
      images.push(project.briefInputs.modelImage);
    }
    if (project.briefInputs.backgroundImage && !images.includes(project.briefInputs.backgroundImage)) {
      images.push(project.briefInputs.backgroundImage);
    }
    if (project.briefInputs.customAssets && Array.isArray(project.briefInputs.customAssets)) {
      project.briefInputs.customAssets.forEach((asset) => {
        if (asset.image && !images.includes(asset.image)) {
          images.push(asset.image);
        }
      });
    }
  }

  // 2. Video Cover / Thumbnail
  if (project.videoSource?.metadata?.thumbnailUrl) {
    const thumb = project.videoSource.metadata.thumbnailUrl.trim();
    if (thumb && (thumb.startsWith('http') || thumb.startsWith('data:image'))) {
      if (!images.includes(thumb)) {
        images.push(thumb);
      }
    }
  }

  // 3. Already generated scene images from CURRENT project.scenes
  if (project.scenes && Array.isArray(project.scenes)) {
    project.scenes.forEach((s) => {
      if (s.imageUrl && (s.imageUrl.startsWith('http') || s.imageUrl.startsWith('data:image'))) {
        if (!images.includes(s.imageUrl)) {
          images.push(s.imageUrl);
        }
      }
    });
  }

  return images;
}

/**
 * 4d. Generates 1-Sheet Grid (16:9) in one single AI generation call with all compiled prompts & reference images
 */
export async function generateOneSheetGridImage(params: {
  prompt: string;
  referenceImages?: string[];
  modelName?: string;
  aspectRatio?: string; // strictly 16:9
  onProgress?: (progress: number) => void;
  accountOverride?: ProviderAccount;
}): Promise<string> {
  const {
    prompt,
    referenceImages = [],
    modelName = 'GPT Image 2.5',
    aspectRatio = '16:9',
    onProgress,
    accountOverride,
  } = params;

  let account = accountOverride || getActiveWeavyAccount();

  // Check credits & auto-switch if needed
  if (account && typeof account.credits === 'number' && account.credits < 4) {
    const nextAcc = findNextAccountWithCredits(account.id, 4);
    if (nextAcc) {
      console.log(`[1-Sheet Grid Auto-Switch] Akun ${account.name || account.email} saldo rendah (${account.credits} CR). Berpindah otomatis ke ${nextAcc.name || nextAcc.email} (${nextAcc.credits} CR).`);
      switchActiveWeavyAccount(nextAcc.id);
      account = nextAcc;
    }
  }

  if (!account) {
    throw new Error('Tidak ada akun Weavy yang terhubung. Silakan buka menu Settings dan hubungkan akun Weavy.');
  }

  const allTokens = getAllWeavyRefreshTokens();
  const token = account.refreshToken || (account as any).token || account.accessToken;

  if (!token) {
    throw new Error(`Token akun ${account.name || account.email || 'Weavy'} tidak valid.`);
  }

  onProgress?.(10);

  // Prepare attached media array (up to 10 images)
  const attached_media = referenceImages.slice(0, 10).map((url) => ({
    url,
    type: 'image',
  }));

  const genPayload: any = {
    mode: 'image',
    model: modelName,
    imageModel: modelName,
    prompt: prompt.trim(),
    aspect_ratio: aspectRatio || '16:9',
    resolution: '1080p',
    refreshToken: token,
    idToken: account.idToken,
    allRefreshTokens: allTokens,
  };

  if (attached_media.length > 0) {
    genPayload.attached_media = attached_media;
    genPayload.imageUrl = attached_media[0].url;
  }

  onProgress?.(20);

  let genData: any = null;
  let genRespOk = true;
  let genRespStatus = 200;
  if (extensionBridge.getStatus().isConnected) {
    console.log('[Studio 🚀] 1-Sheet Grid generation via Chrome Extension Bridge (100% Bebas 403)...');
    genData = await extensionBridge.generateWeavy(genPayload);
    genRespOk = Boolean(genData?.success);
  } else {
    const genResp = await fetch('/api/generate-weavy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(genPayload),
    });
    genRespOk = genResp.ok;
    genRespStatus = genResp.status;
    genData = await genResp.json();
  }

  if (!genRespOk || !genData.success) {
    const errMsg = (genData.error || '').toLowerCase();
    const isCreditError =
      genRespStatus === 402 ||
      errMsg.includes('credit') ||
      errMsg.includes('kredit') ||
      errMsg.includes('quota') ||
      errMsg.includes('insufficient') ||
      errMsg.includes('habis');

    if (isCreditError) {
      updateWeavyAccountCredits(account.id, 0);
      const nextAcc = findNextAccountWithCredits(account.id, 4);
      if (nextAcc) {
        console.log(`[1-Sheet Grid Auto-Switch on 402] Beralih ke ${nextAcc.name || nextAcc.email}...`);
        switchActiveWeavyAccount(nextAcc.id);
        return generateOneSheetGridImage({
          ...params,
          accountOverride: nextAcc,
        });
      }
    }

    throw new Error(genData.error || 'Gagal mengirim permintaan 1-Sheet Grid ke Weavy AI.');
  }

  const { recipeId, nodeId, taskId } = genData;
  if (!recipeId) {
    throw new Error('Respon Weavy tidak menyertakan recipeId.');
  }

  // Deduct local credits
  if (typeof account.credits === 'number' && account.credits > 0) {
    const estimatedCredits = Math.max(0, account.credits - 4);
    updateWeavyAccountCredits(account.id, estimatedCredits);
    setTimeout(() => {
      if (account) syncWeavyAccountCredits(account);
    }, 3000);
  }

  onProgress?.(30);

  const finalUrl = await pollStudioTaskCompletion(recipeId, nodeId, taskId, token, onProgress);
  return finalUrl;
}

/**
 * 5. Downloads all project scenes and composite storyboard as a ZIP archive
 */
export async function exportStudioProjectAsZip(project: StudioProject, compositeBlob?: Blob): Promise<void> {
  const zip = new JSZip();
  const folderName = `${project.name.replace(/[^\w\d-_]/g, '_')}_storyboard`;
  const folder = zip.folder(folderName) || zip;

  // Add Project Info / Prompts Readme
  let infoText = `# ${project.name}\n\n`;
  if (project.analysis) {
    infoText += `## AI Analysis\n`;
    infoText += `- Product: ${project.analysis.productOrTopicName}\n`;
    infoText += `- Target Audience: ${project.analysis.targetAudience}\n`;
    infoText += `- Hook: ${project.analysis.hookAnalysis}\n`;
    infoText += `- Proof Strategy: ${project.analysis.visualProofStrategy}\n`;
    infoText += `- Call To Action: ${project.analysis.callToActionAnalysis}\n\n`;
  }

  infoText += `## Storyboard Scenes Breakdown (${project.scenes.length} Scenes)\n\n`;
  project.scenes.forEach((s) => {
    const timecode = s.timecode || `00:00 - 00:${String(s.durationSec || 5).padStart(2, '0')} (Durasi: ${s.durationSec || 5} detik)`;
    infoText += `### ${s.title.startsWith('Scene') ? s.title : `Scene ${s.sceneNumber}: ${s.title}`}\n`;
    infoText += `**Timecode:** ${timecode}\n`;
    infoText += `**Arah Visual:** ${s.visualDescription || s.sceneGoal || '-'}\n`;
    if (s.voiceover) {
      infoText += `**Voiceover (VO):** "${s.voiceover}"\n`;
    }
    if (s.onScreenText) {
      infoText += `**Teks di Layar:** ${s.onScreenText}\n`;
    }
    infoText += `\n**Prompt AI Image (${project.aspectRatio || '9:16'}):**\n\`\`\`\n${s.imagePrompt}\n\`\`\`\n`;
    if (s.videoPrompt) {
      infoText += `\n**Prompt AI Video Motion:**\n\`\`\`\n${s.videoPrompt}\n\`\`\`\n`;
    }
    if (s.imageUrl) {
      infoText += `- Generated Image URL: ${s.imageUrl}\n`;
    }
    infoText += `\n---\n\n`;
  });

  folder.file('README_STORYBOARD.md', infoText);

  // If composite blob is provided, add it
  if (compositeBlob) {
    folder.file(`00_Composite_Storyboard_Grid.png`, compositeBlob);
  }

  // Fetch scene images and add to ZIP
  for (const scene of project.scenes) {
    if (scene.imageUrl) {
      try {
        const imgResp = await fetch(scene.imageUrl);
        if (imgResp.ok) {
          const blob = await imgResp.blob();
          const ext = blob.type.includes('jpeg') || blob.type.includes('jpg') ? 'jpg' : 'png';
          const filename = `Scene_${String(scene.sceneNumber).padStart(2, '0')}_${scene.title.replace(/[^\w\d-_]/g, '_')}.${ext}`;
          folder.file(filename, blob);
        }
      } catch (e) {
        console.warn(`Could not add image for scene ${scene.sceneNumber} to zip:`, e);
      }
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = `${folderName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
