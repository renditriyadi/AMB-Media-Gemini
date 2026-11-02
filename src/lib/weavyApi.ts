// weavyApi.ts - Semua permintaan API Weavy (Weavy Cloud) dengan urutan:
// 1. Extension Bridge (Chrome Extension) -> 100% lolos Cloudflare WAF / 403
// 2. Server backend -> hanya sebagai fallback terakhir ketika ekstensi mati / tidak terhubung

import { extensionBridge } from './extensionBridge';

const FIREBASE_API_KEY = 'AIzaSyC-qLy3TFyXMogJPfMkZJ9H_q46hEu1sxI';
const WEAVY_API_BASE = 'https://api.weavy.ai';

export interface WeavyApiCredentials {
  idToken?: string;
  refreshToken?: string;
}

export interface WeavyHistoryItem {
  id: string;
  mode: 'video' | 'image';
  title: string;
  prompt: string;
  createdAt: string;
  timestamp: string;
  aspectRatio: string;
  resolution: string;
  duration?: string;
  model: string;
  mediaUrl: string;
  thumbnailUrl: string;
  status: string;
  isFavorite: boolean;
  recipeId: string;
  progress: number;
  rawTimestamp: number;
}

export interface WeavyAccountVerification {
  success: boolean;
  email: string;
  name: string;
  credits: number;
  totalCredits: number;
  idToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  error?: string;
}

interface BridgeResponse {
  ok: boolean;
  status: number;
  json: any;
  text: string;
}

async function bridgeRequest(
  endpoint: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    idToken?: string;
  } = {}
): Promise<BridgeResponse> {
  const { method = 'GET', headers = {}, body, idToken } = options;

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'x-app-version': '4.1.1316',
    'x-weavy-auth-provider': 'firebase',
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...headers,
  };

  const res = await extensionBridge.executeWeavyTask({
    url: `${WEAVY_API_BASE}${endpoint}`,
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return {
    ok: Boolean(res?.ok),
    status: res?.status ?? 0,
    json: res?.json ?? null,
    text: res?.text || '',
  };
}

async function serverFallback(path: string, body: any): Promise<any> {
  const resp = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    return { success: false, error: text.slice(0, 200) || `HTTP ${resp.status}` };
  }
}

function parseJwtPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return {};
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (_) {
    return {};
  }
}

function pickCredits(userInfo: any): number {
  if (!userInfo) return 0;
  const candidates = [userInfo.credits, userInfo.balance, userInfo.quota, userInfo.credit];
  for (const value of candidates) {
    if (value !== undefined && value !== null && value !== '') {
      const num = Number(value);
      if (!isNaN(num)) return num;
    }
  }
  return 0;
}

/**
 * Verifikasi akun Weavy: tukar refresh token via Firebase Auth (aman, tidak kena WAF)
 * lalu baca profil + kredit lewat Extension Bridge.
 */
export async function verifyWeavyAccount(
  refreshTokenInput: string,
  providedIdToken?: string
): Promise<WeavyAccountVerification> {
  const cleanRefreshToken = (refreshTokenInput || '').trim();
  if (!cleanRefreshToken && !providedIdToken) {
    return {
      success: false,
      email: '',
      name: '',
      credits: 0,
      totalCredits: 150,
      idToken: '',
      refreshToken: '',
      expiresInSeconds: 3600,
      error: 'Refresh token atau Access token Weavy wajib diisi.',
    };
  }

  let idToken = providedIdToken || '';
  let refreshToken = cleanRefreshToken;
  let expiresInSeconds = 3600;

  if (cleanRefreshToken) {
    try {
      const fbResp = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: cleanRefreshToken,
        }).toString(),
      });

      const fbText = await fbResp.text();
      let fbData: any = {};
      try {
        fbData = JSON.parse(fbText);
      } catch (_) {}

      if (fbResp.ok && fbData?.id_token) {
        idToken = fbData.id_token;
        refreshToken = fbData.refresh_token || cleanRefreshToken;
        expiresInSeconds = Number(fbData.expires_in || 3600);
      } else if (!idToken) {
        const msg = fbData?.error?.message || 'Token Firebase tidak valid atau kedaluwarsa.';
        throw new Error(`Firebase Auth: ${msg}`);
      }
    } catch (err: any) {
      if (!idToken) {
        // Fallback ke server (mis. input berupa idToken langsung)
        const serverData = await serverFallback('/api/weavy/accounts/verify', {
          refreshToken: cleanRefreshToken,
        }).catch(() => null);
        if (serverData?.success) {
          return {
            success: true,
            email: serverData.email || '',
            name: serverData.name || '',
            credits: Number(serverData.credits || 0),
            totalCredits: Number(serverData.totalCredits || 150),
            idToken: serverData.idToken || '',
            refreshToken: serverData.refreshToken || cleanRefreshToken,
            expiresInSeconds: Number(serverData.expiresInSeconds || 3600),
          };
        }
        return {
          success: false,
          email: '',
          name: '',
          credits: 0,
          totalCredits: 150,
          idToken: '',
          refreshToken: cleanRefreshToken,
          expiresInSeconds: 3600,
          error: err?.message || 'Gagal memverifikasi akun Weavy.',
        };
      }
    }
  }

  const payload = parseJwtPayload(idToken);
  const email = payload.email || `user_${(payload.user_id || '').substring(0, 8)}@weavy.ai`;
  const name = payload.name || email.split('@')[0];

  let credits = 0;
  try {
    const usersRes = await bridgeRequest('/api/v1/users', { idToken });
    if (usersRes.ok && usersRes.json) {
      credits = pickCredits(usersRes.json);
    }
  } catch (_) {}

  return {
    success: true,
    email,
    name,
    credits,
    totalCredits: 150,
    idToken,
    refreshToken,
    expiresInSeconds,
  };
}

function extractMediaUrlFromObject(obj: any): string | null {
  if (!obj) return null;
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return null;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = extractMediaUrlFromObject(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof obj === 'object') {
    for (const key of ['resultUrl', 'outputUrl', 'imageUrl', 'videoUrl', 'image', 'video', 'url', 'downloadUrl', 'fileUrl']) {
      if (typeof obj[key] === 'string' && (obj[key].startsWith('http://') || obj[key].startsWith('https://'))) {
        return obj[key].trim();
      }
    }
    for (const key of ['result', 'output', 'outputs', 'file']) {
      if (obj[key]) {
        const found = extractMediaUrlFromObject(obj[key]);
        if (found) return found;
      }
    }
    for (const key of Object.keys(obj)) {
      if (key === 'input' || key === 'params' || key === 'inputs' || key === 'parameters') continue;
      const val = obj[key];
      if (typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'))) {
        return val.trim();
      }
      if (typeof val === 'object' && val !== null) {
        const found = extractMediaUrlFromObject(val);
        if (found) return found;
      }
    }
  }
  return null;
}

/**
 * Mengambil histori generasi Weavy. Semua panggilan API lewat Extension Bridge,
 * server hanya jadi fallback terakhir.
 */
export async function fetchWeavyHistory(
  credentials: WeavyApiCredentials
): Promise<{ success: boolean; count: number; items: WeavyHistoryItem[]; error?: string }> {
  const { idToken, refreshToken } = credentials;

  try {
    const listRes = await bridgeRequest('/api/v1/recipes?limit=100', { idToken });
    if (listRes.ok && listRes.json) {
      const recipes = Array.isArray(listRes.json) ? listRes.json : (listRes.json?.recipes || []);
      const items: WeavyHistoryItem[] = [];
      const seenUrls = new Set<string>();

      for (const recipe of recipes.slice(0, 40)) {
        const recipeId = recipe.id || recipe._id;
        if (!recipeId) continue;

        const detailRes = await bridgeRequest(`/api/v1/recipes/${recipeId}`, { idToken });
        if (!detailRes.ok || !detailRes.json) continue;

        const recipeDetail = detailRes.json || {};
        const nodes = Array.isArray(recipeDetail.nodes) ? recipeDetail.nodes : [];

        for (const node of nodes) {
          const nodeData = node.data || {};
          const nodeType = (nodeData.type || node.type || nodeData.category || '').toLowerCase();
          const nodeName = (nodeData.name || node.name || nodeData.menu?.displayName || nodeData.title || '').toLowerCase();

          if (
            nodeType.includes('upload') ||
            nodeType.includes('input') ||
            nodeType.includes('asset') ||
            nodeType.includes('file') ||
            nodeName.includes('upload') ||
            nodeName.includes('reference')
          ) {
            continue;
          }

          const prediction = nodeData.latestPrediction || node.latestPrediction;
          if (prediction?.status === 'failed' || prediction?.error || nodeData?.status === 'failed' || nodeData?.error) {
            continue;
          }

          const candidates: any[] = [];
          if (prediction) {
            if (prediction.output) candidates.push(prediction.output);
            if (prediction.result) candidates.push(prediction.result);
            if (prediction.outputUrl) candidates.push(prediction.outputUrl);
          }

          const isModelNode =
            node.isModel ||
            nodeData.isModel ||
            nodeType === 'model' ||
            nodeType === 'custommodelv2' ||
            Boolean(nodeData.model);

          if (candidates.length === 0 && isModelNode) {
            if (nodeData.result) candidates.push(nodeData.result);
            if (nodeData.output) candidates.push(nodeData.output);
            if (node.result) candidates.push(node.result);
            if (node.output) candidates.push(node.output);
          }

          for (const cand of candidates) {
            const resListRaw = Array.isArray(cand) ? cand : [cand];
            for (const resItem of resListRaw) {
              const extracted = extractMediaUrlFromObject(resItem);
              const url = extracted || (typeof resItem === 'string' && resItem.startsWith('http') ? resItem : null);
              if (!url || seenUrls.has(url.trim())) continue;

              const mediaUrl = url.trim();
              seenUrls.add(mediaUrl);

              const modelName = nodeData.name || nodeData.menu?.displayName || nodeData.model?.name || 'SeeDance 2.0 Mini';
              const isImageItem =
                modelName.toLowerCase().includes('grok') ||
                modelName.toLowerCase().includes('image') ||
                modelName.toLowerCase().includes('gpt') ||
                modelName.toLowerCase().includes('banana') ||
                Boolean(mediaUrl.match(/\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i));

              const itemMode: 'video' | 'image' = isImageItem ? 'image' : 'video';
              const defaultTitle = itemMode === 'image' ? 'Gambar Hasil Weavy AI' : 'Video Hasil Weavy AI';
              const promptText =
                (typeof resItem === 'object' && resItem?.input?.prompt) ||
                nodeData.params?.prompt ||
                nodeData.input?.prompt ||
                defaultTitle;
              const coverUrl =
                extracted ||
                (typeof resItem === 'object' && (resItem?.viewUrl || resItem?.thumbnailUrl || resItem?.coverUrl)) ||
                '';
              const aspectRatio =
                (typeof resItem === 'object' && resItem?.input?.aspect_ratio) ||
                nodeData.params?.aspect_ratio ||
                (itemMode === 'image' ? '1:1' : '9:16');
              const createdAt = recipeDetail.updatedAt || recipeDetail.createdAt || Date.now();

              items.push({
                id:
                  (typeof resItem === 'object' && resItem?.id) ||
                  `weavy_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                mode: itemMode,
                title: promptText.length > 28 ? `${promptText.slice(0, 28)}...` : promptText,
                prompt: promptText,
                createdAt: 'Weavy AI',
                timestamp: new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                aspectRatio,
                resolution: nodeData.params?.resolution || '1080p',
                duration: itemMode === 'video' ? (nodeData.params?.duration ? `00:${String(nodeData.params.duration).padStart(2, '0')}` : '00:15') : undefined,
                model: modelName,
                mediaUrl,
                thumbnailUrl: coverUrl || mediaUrl,
                status: 'completed',
                isFavorite: false,
                recipeId,
                progress: 100,
                rawTimestamp: new Date(createdAt).getTime(),
              });
            }
          }
        }
      }

      items.sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));
      return { success: true, count: items.length, items };
    }
  } catch (err) {
    console.warn('[WeavyApi] History via bridge gagal:', err);
  }

  // Fallback terakhir: server
  const serverData = await serverFallback('/api/fetch-weavy-history', { refreshToken, idToken }).catch(() => null);
  if (serverData?.success) {
    return { success: true, count: serverData.count || 0, items: serverData.items || [] };
  }

  return {
    success: false,
    count: 0,
    items: [],
    error: serverData?.error || 'Gagal mengambil histori dari Weavy.',
  };
}

/** Menghapus recipe di Weavy (bridge dulu, server fallback). */
export async function deleteWeavyRecipe(
  recipeId: string,
  credentials: WeavyApiCredentials
): Promise<{ success: boolean; recipeId: string; warning?: string }> {
  const { idToken, refreshToken } = credentials;

  try {
    const res = await bridgeRequest(`/api/v1/recipes/${recipeId}`, { method: 'DELETE', idToken });
    if (res.ok || res.status === 404) {
      return { success: true, recipeId };
    }
  } catch (err) {
    console.warn('[WeavyApi] Delete recipe via bridge gagal:', err);
  }

  const serverData = await serverFallback('/api/delete-weavy-recipe', { recipeId, refreshToken, idToken }).catch(() => null);
  return {
    success: Boolean(serverData?.success),
    recipeId,
    warning: serverData?.warning || serverData?.error,
  };
}

/** Mengambil detail recipe Weavy untuk diimpor ke Canvas (bridge dulu). */
export async function importWeavyRecipe(
  recipeId: string,
  credentials: WeavyApiCredentials
): Promise<{ success: boolean; recipeId: string; recipe?: any; error?: string }> {
  const { idToken, refreshToken } = credentials;

  try {
    const res = await bridgeRequest(`/api/v1/recipes/${recipeId}`, { idToken });
    if (res.ok && res.json) {
      return { success: true, recipeId, recipe: res.json };
    }
  } catch (err) {
    console.warn('[WeavyApi] Import recipe via bridge gagal:', err);
  }

  const serverData = await serverFallback('/api/canvas/weavy/import', { recipeId, refreshToken, idToken }).catch(() => null);
  return {
    success: Boolean(serverData?.success),
    recipeId,
    recipe: serverData?.recipe,
    error: serverData?.error,
  };
}

/** Daftar recipe milik akun Weavy (bridge dulu). */
export async function listMyWeavyRecipes(
  credentials: WeavyApiCredentials
): Promise<{ success: boolean; count: number; recipes: any[]; error?: string }> {
  const { idToken, refreshToken } = credentials;

  try {
    const res = await bridgeRequest('/api/v1/recipes?limit=50', { idToken });
    if (res.ok && res.json) {
      const recipes = Array.isArray(res.json) ? res.json : (res.json?.recipes || []);
      return { success: true, count: recipes.length, recipes };
    }
  } catch (err) {
    console.warn('[WeavyApi] My recipes via bridge gagal:', err);
  }

  const serverData = await serverFallback('/api/canvas/weavy/my-recipes', { refreshToken, idToken }).catch(() => null);
  return {
    success: Boolean(serverData?.success),
    count: serverData?.count || 0,
    recipes: serverData?.recipes || [],
    error: serverData?.error,
  };
}

export interface WeavyPollResult {
  status: 'processing' | 'completed' | 'failed';
  resultUrl?: string;
  coverUrl?: string;
  error?: string;
  remainingCredits?: number;
}

/**
 * Satu kali pengecekan status generasi Weavy.
 * Urutan: Extension Bridge (lolos WAF) -> server (fallback terakhir).
 */
export async function pollWeavyStatusOnce(params: {
  recipeId: string;
  taskId?: string;
  batchId?: string;
  nodeId?: string;
  idToken?: string;
  refreshToken?: string;
}): Promise<WeavyPollResult> {
  const { recipeId, taskId, batchId, nodeId, idToken, refreshToken } = params;
  const activeBatchId = taskId || batchId;

  const urls = [
    activeBatchId
      ? `${WEAVY_API_BASE}/api/v1/batches/recipes/${recipeId}/batches/${activeBatchId}/status`
      : null,
    `${WEAVY_API_BASE}/api/v1/recipes/${recipeId}`,
  ].filter(Boolean) as string[];

  const headers: Record<string, string> = {
    'x-app-recipeid': recipeId,
  };
  if (nodeId) headers['x-app-nodeid'] = nodeId;

  for (const url of urls) {
    try {
      const res = await bridgeRequest(url.replace(WEAVY_API_BASE, ''), { headers, idToken });
      if (!res.ok || !res.json) continue;

      const data = res.json || {};
      const creditVal = data.userRemainingCredits ?? data.remainingCredits ?? data.credits;
      const remainingCredits =
        typeof creditVal === 'number' && !isNaN(creditVal) ? creditVal : undefined;

      const run = Array.isArray(data.recipeRuns) ? data.recipeRuns[0] : data.recipeRun || data;
      const rawStatus = String(run?.status || data.status || '').toUpperCase();

      if (rawStatus === 'FAILED' || rawStatus === 'ERROR') {
        const errMsg = run?.error?.message || run?.error || data.error || 'Proses rendering Weavy gagal.';
        return {
          status: 'failed',
          error: typeof errMsg === 'object' ? JSON.stringify(errMsg) : String(errMsg),
          remainingCredits,
        };
      }

      const nodeRuns = Array.isArray(run?.nodeRuns) ? run.nodeRuns : [];
      for (const nr of nodeRuns) {
        const mediaUrl = extractMediaUrlFromObject(nr?.result || nr?.output);
        if (mediaUrl) {
          return {
            status: 'completed',
            resultUrl: mediaUrl,
            coverUrl:
              (typeof nr?.result === 'object' && (nr.result?.viewUrl || nr.result?.thumbnailUrl)) ||
              mediaUrl,
            remainingCredits,
          };
        }
      }

      const foundMedia = extractMediaUrlFromObject(run?.result || run?.output || data);
      if (foundMedia) {
        return { status: 'completed', resultUrl: foundMedia, coverUrl: foundMedia, remainingCredits };
      }

      if (rawStatus === 'COMPLETED' || rawStatus === 'SUCCESS' || rawStatus === 'DONE') {
        return { status: 'processing', remainingCredits };
      }

      return { status: 'processing', remainingCredits };
    } catch (err) {
      console.warn('[WeavyApi] Poll via bridge gagal:', err);
    }
  }

  // Fallback terakhir: server
  const serverData = await serverFallback('/api/poll-weavy-status', {
    refreshToken,
    idToken,
    recipeId,
    nodeId,
    taskId: activeBatchId,
    batchId: activeBatchId,
  }).catch(() => null);

  if (serverData?.status) {
    return {
      status: serverData.status === 'completed' ? 'completed' : serverData.status === 'failed' ? 'failed' : 'processing',
      resultUrl: serverData.resultUrl,
      coverUrl: serverData.coverUrl,
      error: serverData.error,
      remainingCredits: serverData.remainingCredits,
    };
  }

  return { status: 'processing' };
}

/** Menyimpan recipe Canvas ke Weavy Cloud (bridge dulu). */
export async function saveWeavyRecipe(
  payload: { recipeId?: string; name?: string; nodes?: any[]; edges?: any[] },
  credentials: WeavyApiCredentials
): Promise<{ success: boolean; recipeId?: string; message?: string; error?: string }> {
  const { idToken, refreshToken } = credentials;
  const { recipeId: inputRecipeId, name, nodes, edges } = payload;

  try {
    let recipeId = inputRecipeId;

    if (!recipeId) {
      const createRes = await bridgeRequest('/api/v1/recipes/create', {
        method: 'POST',
        idToken,
        body: {
          name: name || `AMB Canvas Recipe - ${Date.now()}`,
          description: 'Created with AMB Media Canvas Studio',
        },
      });
      recipeId = createRes.json?.id || createRes.json?._id;
    }

    if (recipeId) {
      await bridgeRequest(`/api/v1/recipes/${recipeId}/save`, {
        method: 'POST',
        idToken,
        headers: { 'x-app-recipeid': recipeId },
        body: {
          nodes: nodes || [],
          edges: edges || [],
          v3: true,
          lastUpdatedAt: new Date().toISOString(),
        },
      });
    }

    if (recipeId) {
      return { success: true, recipeId, message: 'Recipe berhasil disimpan ke Weavy Cloud!' };
    }
  } catch (err) {
    console.warn('[WeavyApi] Save recipe via bridge gagal:', err);
  }

  const serverData = await serverFallback('/api/canvas/weavy/save-recipe', {
    recipeId: inputRecipeId,
    name,
    nodes,
    edges,
    refreshToken,
    idToken,
  }).catch(() => null);

  return {
    success: Boolean(serverData?.success),
    recipeId: serverData?.recipeId,
    message: serverData?.message,
    error: serverData?.error,
  };
}
