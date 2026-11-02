import { Router } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import FormData from 'form-data';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';

const router = Router();
const RUNNINGHUB_PRIMARY_URL = 'https://www.runninghub.ai';
const RUNNINGHUB_FALLBACK_URL = 'https://www.runninghub.cn';

// Disk-based Multer storage to handle large media files (e.g. 20MB+ videos) without memory bottlenecks
const uploadDisk = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname) || '';
      cb(null, `rh-upload-${uniqueSuffix}${ext}`);
    },
  }),
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB limit
});

const tokenCache = new Map<string, { token: string; userId: string; expiresAt: number }>();

// In-memory media cache to avoid duplicate re-uploads across concurrent or batch jobs
const uploadedMediaCache = new Map<string, string>();

// In-memory cache for API keys with 0 coins/power (TTL: 15 minutes) to prevent redundant failing calls
const exhaustedKeyCache = new Map<string, number>();

function isKeyExhausted(apiKey: string): boolean {
  const clean = apiKey.trim();
  const expiry = exhaustedKeyCache.get(clean);
  if (expiry && expiry > Date.now()) {
    return true;
  }
  if (expiry) {
    exhaustedKeyCache.delete(clean);
  }
  return false;
}

function markKeyExhausted(apiKey: string, ttlMs: number = 15 * 60 * 1000) {
  const clean = apiKey.trim();
  if (clean) {
    exhaustedKeyCache.set(clean, Date.now() + ttlMs);
  }
}

// Fast hash helper for caching media by content/URL
function getMediaCacheKey(apiKey: string, mediaData: string): string {
  const cleanKey = apiKey.trim().slice(0, 10);
  if (mediaData.length > 500) {
    const hash = crypto.createHash('md5').update(mediaData.slice(0, 50000)).digest('hex');
    return `${cleanKey}:${hash}`;
  }
  return `${cleanKey}:${mediaData.trim()}`;
}

// Helper to fetch account status and live coins directly using API Key
async function fetchAccountStatusByApiKey(apiKey: string) {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return null;

  const baseUrls = [RUNNINGHUB_PRIMARY_URL, RUNNINGHUB_FALLBACK_URL];
  for (const base of baseUrls) {
    try {
      const res = await axios.post(
        `${base}/uc/openapi/accountStatus`,
        { apiKey: cleanKey },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          },
          timeout: 8000,
          validateStatus: () => true,
        }
      );
      if (res.data?.code === 0 && res.data?.data) {
        return res.data.data;
      }
    } catch (e) {}
  }
  return null;
}

// Helper to extract session token from RunningHub using API Key or Token
async function getRunningHubSession(apiKeyOrToken: string, knownUserId?: string) {
  const cleanInput = apiKeyOrToken.trim();
  if (!cleanInput) {
    throw new Error('API Key / Token RunningHub tidak boleh kosong.');
  }

  // If input is already an Access Token (Base64 JWT style starting with eyJ)
  if (cleanInput.startsWith('eyJ')) {
    let decodedUserId = '';
    try {
      const decoded = JSON.parse(Buffer.from(cleanInput, 'base64').toString('utf-8'));
      decodedUserId = decoded.userId || '';
    } catch (e) {}
    return { token: cleanInput, userId: knownUserId || decodedUserId || '', apiKey: '' };
  }

  // If cached and valid for this specific key
  const cached = tokenCache.get(cleanInput);
  if (cached && cached.expiresAt > Date.now()) {
    return { token: cached.token, userId: cached.userId || knownUserId || '', apiKey: cleanInput };
  }

  // Pure API Key mode (Never trigger /task/openapi/create here to prevent unintended task runs and credit loss)
  return { token: '', userId: knownUserId || '', apiKey: cleanInput };
}

// Fetch complete user info by token and user ID candidates
async function fetchUserInfoByToken(token: string, preferredUserId?: string) {
  if (!token) return null;

  const baseUrls = [RUNNINGHUB_PRIMARY_URL, RUNNINGHUB_FALLBACK_URL];
  for (const base of baseUrls) {
    const client = axios.create({
      baseURL: base,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Rh-Accesstoken': token,
        'Cookie': `Rh-Accesstoken=${token}; rh_access_token=${token}; token=${token};`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 8000,
      validateStatus: () => true,
    });

    let decodedUserId = '';
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
      decodedUserId = decoded.userId || '';
    } catch (e) {}

    const candidates = [preferredUserId, decodedUserId, ''].filter(
      (v, i, arr) => v !== undefined && v !== '' && arr.indexOf(v) === i
    );
    if (candidates.length === 0) candidates.push('');

    for (const uid of candidates) {
      try {
        const res = await client.post('/uc/getUserInfo', uid ? { userId: uid } : {});
        if (res.data?.code === 0 && res.data?.data) {
          return res.data.data;
        }
      } catch (e) {}
    }
  }

  return null;
}

// Helper to execute upload to RunningHub OpenAPI with multi-gateway retry & high timeout
async function postToRunningHubUpload(
  apiKey: string,
  filePathOrBuffer: string | Buffer,
  filename: string,
  contentType: string,
  fileSize?: number
): Promise<string> {
  const baseUrls = [RUNNINGHUB_PRIMARY_URL, RUNNINGHUB_FALLBACK_URL];
  let lastError: any = null;

  for (const baseUrl of baseUrls) {
    try {
      console.log(`[RunningHub 📤 OpenAPI Upload] Mengirim file ${filename} (${contentType}, size: ${fileSize ? (fileSize / (1024 * 1024)).toFixed(2) + ' MB' : 'stream'}) ke ${baseUrl}/task/openapi/upload...`);

      const form = new FormData();
      form.append('apiKey', apiKey.trim());
      form.append('fileType', 'input');

      // Create fresh stream if string path given, to safely allow multi-gateway retry
      const fileData = typeof filePathOrBuffer === 'string' ? fs.createReadStream(filePathOrBuffer) : filePathOrBuffer;

      form.append('file', fileData, {
        filename: filename || 'upload_file',
        contentType: contentType || 'application/octet-stream',
        knownLength: fileSize,
      });

      const uploadRes = await axios.post(`${baseUrl}/task/openapi/upload`, form, {
        headers: {
          ...form.getHeaders(),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        timeout: 300000, // 5 minutes timeout for large video uploads
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: () => true,
      });

      if (uploadRes.data?.code === 0 && uploadRes.data?.data?.fileName) {
        console.log(`[RunningHub ✅ Upload Success via ${baseUrl}]: ${uploadRes.data.data.fileName}`);
        return uploadRes.data.data.fileName;
      }

      const errMsg = uploadRes.data?.msg || uploadRes.data?.message || JSON.stringify(uploadRes.data);
      console.warn(`[RunningHub ⚠️ Upload Attempt Warning on ${baseUrl}]: ${errMsg}`);
      lastError = new Error(errMsg);
    } catch (err: any) {
      console.warn(`[RunningHub ⚠️ Upload Network Warning on ${baseUrl}]: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error('Gagal mengunggah file ke RunningHub OpenAPI setelah mencoba semua gateway.');
}

// Helper to upload a base64 or URL file to RunningHub OpenAPI
async function uploadFileToRunningHub(apiKey: string, fileData: string, filename: string, isVideo: boolean = false): Promise<string> {
  const cleanData = fileData.trim();
  if (!cleanData) {
    throw new Error('Data file untuk RunningHub tidak boleh kosong.');
  }

  // If already an uploaded RunningHub fileName path (e.g. openapi/xxxx.jpg or api/xxxx.jpg)
  if (cleanData.startsWith('openapi/') || cleanData.startsWith('api/') || cleanData.startsWith('input/')) {
    return cleanData;
  }

  // Check cache to avoid re-uploading the exact same video or image
  const cacheKey = getMediaCacheKey(apiKey, cleanData);
  if (uploadedMediaCache.has(cacheKey)) {
    const cachedName = uploadedMediaCache.get(cacheKey)!;
    console.log(`[RunningHub ⚡ Cache Hit] Menggunakan upload media yang sudah ada: ${cachedName}`);
    return cachedName;
  }

  let uploadedFileName = '';

  if (cleanData.startsWith('data:')) {
    const base64Content = cleanData.split(',')[1];
    const mimeMatch = cleanData.match(/^data:([^;]+);/);
    const contentType = mimeMatch ? mimeMatch[1] : (isVideo ? 'video/mp4' : 'image/jpeg');
    const buffer = Buffer.from(base64Content, 'base64');
    uploadedFileName = await postToRunningHubUpload(
      apiKey,
      buffer,
      filename || (isVideo ? 'input_video.mp4' : 'input_image.jpg'),
      contentType,
      buffer.length
    );
  } else if (cleanData.startsWith('http://') || cleanData.startsWith('https://')) {
    console.log(`[RunningHub 🌐 Download Media URL] Mengunduh media dari ${cleanData.slice(0, 80)}...`);
    const response = await axios.get(cleanData, { responseType: 'arraybuffer', timeout: 90000 });
    const contentType = (response.headers['content-type'] as string) || (isVideo ? 'video/mp4' : 'image/jpeg');
    const buffer = Buffer.from(response.data);
    uploadedFileName = await postToRunningHubUpload(
      apiKey,
      buffer,
      filename || (isVideo ? 'input_video.mp4' : 'input_image.jpg'),
      contentType,
      buffer.length
    );
  } else {
    // Treat as already an uploaded RunningHub fileName path
    uploadedFileName = cleanData;
  }

  if (uploadedFileName) {
    uploadedMediaCache.set(cacheKey, uploadedFileName);
  }

  return uploadedFileName;
}

// POST /api/runninghub/account/verify
// Verifies API key / Token and fetches user profile info & live RH coins
router.post('/runninghub/account/verify', async (req, res) => {
  try {
    const { apiKey, token: rawToken, userId: rawUserId, customLabel, label, name: rawName, email: rawEmail } = req.body || {};
    const inputVal = ((apiKey || rawToken || '') as string).trim();

    if (!inputVal) {
      return res.status(400).json({
        success: false,
        error: 'API Key RunningHub wajib diisi.',
      });
    }

    let cleanKey = inputVal;
    let explicitUserId = (rawUserId || '').trim();

    // Check if input is a JSON string containing apiKey/token
    if (inputVal.startsWith('{') && inputVal.endsWith('}')) {
      try {
        const parsed = JSON.parse(inputVal);
        if (parsed.apiKey) cleanKey = parsed.apiKey.trim();
        else if (parsed.token) cleanKey = parsed.token.trim();
        else if (parsed.accessToken) cleanKey = parsed.accessToken.trim();
        if (parsed.userId || parsed.id) explicitUserId = (parsed.userId || parsed.id).trim();
      } catch (e) {}
    }

    // 1. Fetch live account status & coins directly using API Key (Fastest OpenAPI method)
    const openApiStatus = await fetchAccountStatusByApiKey(cleanKey);

    // 2. Get Session Token & User ID for detailed profile if available
    const sess = await getRunningHubSession(cleanKey, explicitUserId);
    const sessionToken = sess.token;
    const targetUserId = sess.userId || explicitUserId;

    // 3. Fetch User Profile & RH Coins if session token exists
    let userInfo: any = null;
    if (sessionToken) {
      userInfo = await fetchUserInfoByToken(sessionToken, targetUserId);
    }

    // 4. Validation: check if either OpenAPI status or userInfo is valid
    if (!openApiStatus && !userInfo) {
      const checkRes = await axios.post(
        `${RUNNINGHUB_PRIMARY_URL}/task/openapi/status`,
        {
          apiKey: cleanKey,
          taskId: '0',
        },
        { validateStatus: () => true, timeout: 6000 }
      );

      const isInvalid =
        checkRes.data?.code === 403 ||
        checkRes.data?.msg?.includes('KEY_INVALID') ||
        checkRes.data?.msg?.includes('TOKEN_MISSION') ||
        checkRes.data?.msg?.includes('APIKEY_INVALID');

      if (isInvalid) {
        return res.status(400).json({
          success: false,
          error: 'API Key RunningHub tidak valid.',
        });
      }
    }

    // Calculate credits & details
    let totalCoins = 0;
    if (openApiStatus && openApiStatus.remainCoins !== undefined && openApiStatus.remainCoins !== null) {
      totalCoins = parseInt(openApiStatus.remainCoins, 10) || 0;
    } else if (userInfo) {
      totalCoins = parseInt(userInfo.totalCoin || userInfo.virtualCoin || '0', 10) || 0;
    }

    let email = '';
    let nickname = '';
    let avatar = '';
    let resolvedUserId = targetUserId;

    if (userInfo) {
      email = userInfo.email || '';
      nickname = userInfo.nickName || '';
      avatar = userInfo.headIcon || '';
      resolvedUserId = userInfo.id || resolvedUserId;
    }

    const userInputLabel = (customLabel || label || rawName || '').trim();
    const userInputEmail = (rawEmail || (userInputLabel.includes('@') ? userInputLabel : '')).trim();

    const shortKey = cleanKey.length >= 8 ? `${cleanKey.slice(0, 4)}...${cleanKey.slice(-4)}` : cleanKey;
    const defaultEmail = userInputEmail || email || `rh_${cleanKey.slice(0, 8)}@runninghub.ai`;
    const displayName = userInputLabel || (nickname
      ? (email ? `${nickname} (${email})` : nickname)
      : (email || `RunningHub (${shortKey})`));

    return res.json({
      success: true,
      apiKey: cleanKey,
      email: defaultEmail,
      displayName: displayName,
      name: userInputLabel || nickname || displayName,
      nickname: userInputLabel || nickname,
      credits: totalCoins,
      photoUrl: avatar,
      account: {
        id: resolvedUserId || `acc-runninghub-${cleanKey.slice(0, 8)}`,
        email: defaultEmail,
        name: userInputLabel || nickname || displayName,
        displayName: displayName,
        photoUrl: avatar,
        isActive: true,
        hasRefreshToken: true,
        refreshToken: cleanKey, // Stores API Key as persistent credential
        credits: totalCoins,
        status: 'ACTIVE',
        lastChecked: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[RunningHub Verify Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Gagal memverifikasi API Key RunningHub.',
    });
  }
});

// POST /api/runninghub/account/balance
// Refreshes balance / RH coin for an existing RunningHub account
router.post('/runninghub/account/balance', async (req, res) => {
  try {
    const { apiKey, accountId, userId, currentEmail, currentName } = req.body || {};
    const cleanKey = ((apiKey || '') as string).trim();

    if (!cleanKey) {
      return res.status(400).json({
        success: false,
        error: 'API Key RunningHub wajib diisi.',
      });
    }

    // 1. Fetch live account status & coins directly using API Key
    const openApiStatus = await fetchAccountStatusByApiKey(cleanKey);

    const sess = await getRunningHubSession(cleanKey, userId || accountId);
    let userInfo: any = null;

    if (sess.token) {
      userInfo = await fetchUserInfoByToken(sess.token, userId || accountId || sess.userId);
    }

    let totalCoins = 0;
    if (openApiStatus && openApiStatus.remainCoins !== undefined && openApiStatus.remainCoins !== null) {
      totalCoins = parseInt(openApiStatus.remainCoins, 10) || 0;
    } else if (userInfo) {
      totalCoins = parseInt(userInfo.totalCoin || userInfo.virtualCoin || '0', 10) || 0;
    }

    let email = '';
    let nickname = '';
    let avatar = '';

    if (userInfo) {
      email = userInfo.email || '';
      nickname = userInfo.nickName || '';
      avatar = userInfo.headIcon || '';
    }

    const shortKey = cleanKey.length >= 8 ? `${cleanKey.slice(0, 4)}...${cleanKey.slice(-4)}` : cleanKey;
    const passedEmail = (currentEmail || '').trim();
    const passedName = (currentName || '').trim();

    const defaultEmail = email || (passedEmail && !passedEmail.startsWith('rh_') ? passedEmail : `rh_${cleanKey.slice(0, 8)}@runninghub.ai`);
    const displayName = passedName || (nickname
      ? (email ? `${nickname} (${email})` : nickname)
      : (passedEmail && !passedEmail.startsWith('rh_') ? passedEmail : (email || `RunningHub (${shortKey})`)));

    return res.json({
      success: true,
      credits: totalCoins,
      email: defaultEmail,
      name: passedName || nickname || displayName,
      displayName: displayName,
      photoUrl: avatar,
      lastChecked: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[RunningHub Balance Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Gagal memeriksa saldo akun RunningHub.',
    });
  }
});

// POST /api/runninghub/upload
// Uploads image/video file to RunningHub OpenAPI with Disk-Stream and Base64 support
router.post(
  '/runninghub/upload',
  (req, res, next) => {
    uploadDisk.single('file')(req as any, res as any, (err) => {
      next();
    });
  },
  async (req, res) => {
    let filePathToCleanup: string | null = null;
    try {
      const apiKey = (req.body?.apiKey || (typeof req.headers['authorization'] === 'string' ? req.headers['authorization'].replace(/^bearer /i, '') : '') || '').trim();
      if (!apiKey) {
        return res.status(400).json({ success: false, error: 'apiKey RunningHub wajib disertakan.' });
      }

      console.log(`[RunningHub 📤 /upload API] Request masuk: apiKey=${apiKey.slice(0, 6)}..., file=${req.file?.originalname || req.body?.fileName || 'raw'}`);
      let uploadedFileName = '';

      if (req.file) {
        filePathToCleanup = req.file.path;
        uploadedFileName = await postToRunningHubUpload(
          apiKey,
          req.file.path,
          req.file.originalname || 'upload_file',
          req.file.mimetype || 'application/octet-stream',
          req.file.size
        );
      } else if (req.body?.fileData) {
        const { fileData, fileName, mimeType } = req.body;
        const isVideo = mimeType?.includes('video') || fileName?.endsWith('.mp4') || fileName?.endsWith('.mov');
        uploadedFileName = await uploadFileToRunningHub(apiKey, fileData, fileName || 'upload_file', isVideo);
      } else if (req.body?.url) {
        const { url, fileName, isVideo } = req.body;
        uploadedFileName = await uploadFileToRunningHub(
          apiKey,
          url,
          fileName || (isVideo ? 'input_video.mp4' : 'input_image.jpg'),
          Boolean(isVideo || (fileName && fileName.endsWith('.mp4')))
        );
      } else {
        return res.status(400).json({ success: false, error: 'File atau data file tidak ditemukan.' });
      }

      console.log(`[RunningHub ✅ /upload Success] Media berhasil disimpan di RunningHub: ${uploadedFileName}`);
      return res.json({
        success: true,
        url: uploadedFileName,
        fileName: uploadedFileName,
      });
    } catch (error: any) {
      console.error('[RunningHub ❌ /upload Error]:', error?.message || error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Gagal mengunggah media ke RunningHub.',
      });
    } finally {
      if (filePathToCleanup) {
        try {
          if (fs.existsSync(filePathToCleanup)) {
            fs.unlinkSync(filePathToCleanup);
          }
        } catch (e) {}
      }
    }
  }
);

interface WorkflowNodeMapping {
  imageNode?: { nodeId: string; fieldName: string };
  videoNode?: { nodeId: string; fieldName: string };
  positiveTextNode?: { nodeId: string; fieldName: string };
  negativeTextNode?: { nodeId: string; fieldName: string };
  aspectRatioNode?: { nodeId: string; fieldName: string };
  megapixelsNode?: { nodeId: string; fieldName: string };
  durationNode?: { nodeId: string; fieldName: string };
}

const workflowMappingCache = new Map<string, WorkflowNodeMapping>();

// Preload verified known workflows
workflowMappingCache.set('2088843516532506626', {
  imageNode: { nodeId: '30', fieldName: 'image' },
  videoNode: { nodeId: '33', fieldName: 'video' },
  positiveTextNode: { nodeId: '3', fieldName: 'text' },
  negativeTextNode: { nodeId: '4', fieldName: 'text' },
});

// S2 Motion Control (Amb Media)
workflowMappingCache.set('2091060763809492994', {
  imageNode: { nodeId: '391', fieldName: 'image' },
  videoNode: { nodeId: '392', fieldName: 'video' },
  positiveTextNode: { nodeId: '336', fieldName: 'positive_prompt' },
  negativeTextNode: { nodeId: '336', fieldName: 'negative_prompt' },
});

// MiniMax H3 Turbo Video (Workflow 2098388825144184833)
workflowMappingCache.set('2098388825144184833', {
  imageNode: { nodeId: '293', fieldName: 'image' },
  positiveTextNode: { nodeId: '294', fieldName: 'prompt' },
  aspectRatioNode: { nodeId: '296', fieldName: 'aspect_ratio' },
  megapixelsNode: { nodeId: '296', fieldName: 'megapixels' },
  durationNode: { nodeId: '297', fieldName: 'value' },
});
// Legacy mapping compatibility
workflowMappingCache.set('2100116399125848066', {
  imageNode: { nodeId: '293', fieldName: 'image' },
  positiveTextNode: { nodeId: '294', fieldName: 'prompt' },
  aspectRatioNode: { nodeId: '296', fieldName: 'aspect_ratio' },
  megapixelsNode: { nodeId: '296', fieldName: 'megapixels' },
  durationNode: { nodeId: '297', fieldName: 'value' },
});

function parseWorkflowGraph(graph: any): WorkflowNodeMapping {
  const mapping: WorkflowNodeMapping = {};
  if (!graph) return mapping;

  // Handle format: { "1": { class_type, inputs }, "2": ... }
  if (typeof graph === 'object' && !Array.isArray(graph) && !graph.nodes) {
    for (const [nodeId, node] of Object.entries(graph)) {
      if (!node || typeof node !== 'object') continue;
      const classType = String((node as any).class_type || (node as any).type || '');
      const inputs = ((node as any).inputs && typeof (node as any).inputs === 'object') ? (node as any).inputs : {};

      // Check Image node
      if (!mapping.imageNode) {
        if (
          classType === 'LoadImage' ||
          classType.includes('LoadImage') ||
          ('image' in inputs && typeof inputs.image === 'string' && !Array.isArray(inputs.image))
        ) {
          mapping.imageNode = { nodeId: String(nodeId), fieldName: 'image' };
        }
      }

      // Check Video node
      if (!mapping.videoNode) {
        if (
          classType === 'VHS_LoadVideo' ||
          classType === 'LoadVideo' ||
          classType.includes('LoadVideo') ||
          ('video' in inputs && typeof inputs.video === 'string' && !Array.isArray(inputs.video))
        ) {
          const fieldName = 'video' in inputs ? 'video' : 'video_path' in inputs ? 'video_path' : 'file_path' in inputs ? 'file_path' : 'video';
          mapping.videoNode = { nodeId: String(nodeId), fieldName };
        }
      }

      // Check Text / Prompt nodes
      if (classType === 'MiniMaxH3ImageToVideo') {
        mapping.positiveTextNode = { nodeId: String(nodeId), fieldName: 'prompt' };
      } else if (classType === 'WanVideoTextEncodeCached') {
        const posField = 'positive_prompt' in inputs ? 'positive_prompt' : 'positive';
        const negField = 'negative_prompt' in inputs ? 'negative_prompt' : 'negative';
        mapping.positiveTextNode = { nodeId: String(nodeId), fieldName: posField };
        mapping.negativeTextNode = { nodeId: String(nodeId), fieldName: negField };
      } else if (classType === 'CLIPTextEncode' || classType.includes('TextEncode')) {
        if (!mapping.positiveTextNode) {
          mapping.positiveTextNode = { nodeId: String(nodeId), fieldName: 'text' };
        } else if (!mapping.negativeTextNode) {
          mapping.negativeTextNode = { nodeId: String(nodeId), fieldName: 'text' };
        }
      }

      // Check ResolutionSelector and Duration
      if (classType === 'ResolutionSelector' || (inputs && 'aspect_ratio' in inputs && 'megapixels' in inputs)) {
        mapping.aspectRatioNode = { nodeId: String(nodeId), fieldName: 'aspect_ratio' };
        mapping.megapixelsNode = { nodeId: String(nodeId), fieldName: 'megapixels' };
      }
      if (classType === 'PrimitiveFloat' && (inputs && 'value' in inputs)) {
        mapping.durationNode = { nodeId: String(nodeId), fieldName: 'value' };
      }
    }
  }

  // Handle format: { nodes: [ { id, type, title, ... } ] }
  if (graph && Array.isArray(graph.nodes)) {
    for (const node of graph.nodes) {
      if (!node || typeof node !== 'object') continue;
      const nodeId = String(node.id || node.nodeId || '');
      const classType = String(node.type || node.class_type || '');

      if (!mapping.imageNode) {
        if (classType === 'LoadImage' || classType.includes('LoadImage') || classType.includes('Image')) {
          mapping.imageNode = { nodeId, fieldName: 'image' };
        }
      }

      if (!mapping.videoNode) {
        if (classType === 'VHS_LoadVideo' || classType === 'LoadVideo' || classType.includes('LoadVideo') || classType.includes('Video')) {
          mapping.videoNode = { nodeId, fieldName: 'video' };
        }
      }

      if (classType === 'MiniMaxH3ImageToVideo') {
        mapping.positiveTextNode = { nodeId, fieldName: 'prompt' };
      } else if (classType === 'WanVideoTextEncodeCached') {
        const hasPosPrompt = Array.isArray(node.inputs) && node.inputs.some((i: any) => i.name === 'positive_prompt');
        mapping.positiveTextNode = { nodeId, fieldName: hasPosPrompt ? 'positive_prompt' : 'positive' };
        mapping.negativeTextNode = { nodeId, fieldName: hasPosPrompt ? 'negative_prompt' : 'negative' };
      } else if (!mapping.positiveTextNode && (classType === 'CLIPTextEncode' || classType.includes('TextEncode') || classType.includes('Prompt'))) {
        mapping.positiveTextNode = { nodeId, fieldName: 'text' };
      }

      if (classType === 'ResolutionSelector') {
        mapping.aspectRatioNode = { nodeId, fieldName: 'aspect_ratio' };
        mapping.megapixelsNode = { nodeId, fieldName: 'megapixels' };
      }
      if (classType === 'PrimitiveFloat' && (String(node.title || '').toLowerCase().includes('duration') || nodeId === '297' || nodeId === '328')) {
        mapping.durationNode = { nodeId, fieldName: 'value' };
      }
    }
  }

  return mapping;
}

async function getWorkflowNodeMapping(apiKey: string, workflowId: string): Promise<WorkflowNodeMapping> {
  const cached = workflowMappingCache.get(workflowId);
  if (cached && cached.imageNode && (cached.videoNode || cached.positiveTextNode || workflowId === '2100116399125848066' || workflowId === '2098388825144184833')) {
    console.log(`[RunningHub ⚙️ Workflow Schema] Using cached mapping for ${workflowId}: Image Node=${cached.imageNode.nodeId}, Video Node=${cached.videoNode?.nodeId || '(none)'}`);
    return cached;
  }

  // If MiniMax H3 Turbo Video, immediately use predefined mapping
  if (workflowId === '2100116399125848066' || workflowId === '2098388825144184833') {
    const miniMaxMapping: WorkflowNodeMapping = {
      imageNode: { nodeId: '293', fieldName: 'image' },
      positiveTextNode: { nodeId: '294', fieldName: 'prompt' },
      aspectRatioNode: { nodeId: '296', fieldName: 'aspect_ratio' },
      megapixelsNode: { nodeId: '296', fieldName: 'megapixels' },
      durationNode: { nodeId: '297', fieldName: 'value' },
    };
    workflowMappingCache.set(workflowId, miniMaxMapping);
    return miniMaxMapping;
  }

  // Attempt to fetch workflow JSON dynamically from RunningHub API
  const cleanKey = (apiKey || '').trim();
  const baseUrls = [RUNNINGHUB_PRIMARY_URL, RUNNINGHUB_FALLBACK_URL];
  for (const base of baseUrls) {
    const endpoints = [
      `${base}/task/openapi/getJsonApiFormat`,
      `${base}/api/openapi/getJsonApiFormat`,
    ];
    for (const endpoint of endpoints) {
      try {
        console.log(`[RunningHub 🔍 Workflow Inspect] Querying workflow schema from ${endpoint} for workflow ${workflowId}...`);
        const res = await axios.post(
          endpoint,
          { apiKey: cleanKey, workflowId: workflowId.trim() },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000,
            validateStatus: () => true,
          }
        );
        console.log(`[RunningHub 🔍 Workflow Inspect Response code]:`, res.data?.code, res.data?.msg);
        const wfData = res.data?.data;
        let graph: any = null;
        if (wfData) {
          if (typeof wfData === 'string') {
            try { graph = JSON.parse(wfData); } catch (e) {}
          } else if (typeof wfData === 'object') {
            graph = wfData.prompt || wfData.workflow || wfData.nodes || wfData;
          }
        }
        if (graph) {
          console.log(`[RunningHub 🔍 Workflow JSON Graph Keys]:`, typeof graph === 'object' ? Object.keys(graph).slice(0, 10) : 'not object');
          const parsed = parseWorkflowGraph(graph);
          console.log(`[RunningHub 🔍 Workflow Parsed Nodes]:`, JSON.stringify(parsed));
          if (parsed.imageNode && (parsed.videoNode || parsed.positiveTextNode)) {
            workflowMappingCache.set(workflowId, parsed);
            return parsed;
          }
        }
      } catch (e: any) {
        console.warn(`[RunningHub 🔍 Workflow Inspect Warn]:`, e.message);
      }
    }
  }

  // Fallback defaults
  console.log(`[RunningHub ⚠️ Workflow Default Fallback] Using default nodes (30/33) for workflow ${workflowId}`);
  const fallback: WorkflowNodeMapping = {
    imageNode: { nodeId: '30', fieldName: 'image' },
    videoNode: { nodeId: '33', fieldName: 'video' },
    positiveTextNode: { nodeId: '3', fieldName: 'text' },
    negativeTextNode: { nodeId: '4', fieldName: 'text' },
  };
  return fallback;
}

function buildNodeInfoList(
  mapping: WorkflowNodeMapping,
  imageFileName: string,
  videoFileName?: string,
  positiveText?: string,
  negativeText?: string,
  extraParams?: {
    aspectRatio?: string;
    duration?: string;
    resolution?: string;
  }
) {
  const list: Array<{ nodeId: string; fieldName: string; fieldValue: string }> = [];

  if (mapping.imageNode && imageFileName) {
    list.push({
      nodeId: mapping.imageNode.nodeId,
      fieldName: mapping.imageNode.fieldName,
      fieldValue: imageFileName,
    });
  }

  if (mapping.videoNode && videoFileName) {
    list.push({
      nodeId: mapping.videoNode.nodeId,
      fieldName: mapping.videoNode.fieldName,
      fieldValue: videoFileName,
    });
  }

  if (mapping.positiveTextNode && positiveText !== undefined) {
    list.push({
      nodeId: mapping.positiveTextNode.nodeId,
      fieldName: mapping.positiveTextNode.fieldName,
      fieldValue: positiveText,
    });
  }

  if (mapping.negativeTextNode && negativeText !== undefined) {
    list.push({
      nodeId: mapping.negativeTextNode.nodeId,
      fieldName: mapping.negativeTextNode.fieldName,
      fieldValue: negativeText,
    });
  }

  // Handle aspect_ratio, megapixels, and duration for MiniMax H3 / resolution selector
  if (extraParams) {
    if (mapping.aspectRatioNode && extraParams.aspectRatio) {
      let arValue = extraParams.aspectRatio.trim();
      // Format to ComfyUI ResolutionSelector values:
      // ['1:1 (Square)', '2:3 (Portrait Photo)', '3:2 (Photo)', '3:4 (Portrait Standard)', '4:3 (Standard)', '9:16 (Portrait Widescreen)', '16:9 (Widescreen)', '21:9 (Ultrawide)']
      if (arValue.startsWith('9:16')) {
        arValue = '9:16 (Portrait Widescreen)';
      } else if (arValue.startsWith('16:9')) {
        arValue = '16:9 (Widescreen)';
      } else if (arValue.startsWith('1:1')) {
        arValue = '1:1 (Square)';
      } else if (arValue.startsWith('4:3')) {
        arValue = '4:3 (Standard)';
      } else if (arValue.startsWith('3:4')) {
        arValue = '3:4 (Portrait Standard)';
      } else if (arValue.startsWith('2:3')) {
        arValue = '2:3 (Portrait Photo)';
      } else if (arValue.startsWith('3:2')) {
        arValue = '3:2 (Photo)';
      } else if (arValue.startsWith('21:9')) {
        arValue = '21:9 (Ultrawide)';
      }
      list.push({
        nodeId: mapping.aspectRatioNode.nodeId,
        fieldName: mapping.aspectRatioNode.fieldName,
        fieldValue: arValue,
      });
    }

    const durStr = extraParams.duration ? String(extraParams.duration).replace(/[^0-9.]/g, '') : '10';
    const durNum = parseFloat(durStr) || 10;

    if (mapping.megapixelsNode && extraParams.resolution) {
      const res = extraParams.resolution.toLowerCase().trim();
      // Safe VRAM ceiling for standard 24GB RunningHub GPUs:
      // Sending 2.0 megapixels (1920x1088) triggers torch.OutOfMemoryError (VRAM OOM Alert) at Node 288.
      // Workflow 2098388825144184833 native default is 0.9 megapixels (1280x736) for 10s, and 0.8 for 15s.
      let mp = durNum >= 15 ? '0.8' : '0.9';
      if (res.includes('720')) {
        mp = durNum >= 15 ? '0.7' : '0.8';
      } else if (res.includes('768') || res.includes('1080')) {
        mp = durNum >= 15 ? '0.8' : '0.9';
      }
      list.push({
        nodeId: mapping.megapixelsNode.nodeId,
        fieldName: mapping.megapixelsNode.fieldName,
        fieldValue: mp,
      });
    }

    if (mapping.durationNode && extraParams.duration) {
      list.push({
        nodeId: mapping.durationNode.nodeId,
        fieldName: mapping.durationNode.fieldName,
        fieldValue: String(durNum),
      });
    }
  }

  return list;
}

// POST /api/runninghub/generate
// Submits a video task for RunningHub workflows (Workflow 2088843516532506626, S2 2091060763809492994, or MiniMax H3 2098388825144184833)
router.post('/runninghub/generate', async (req, res) => {
  try {
    const {
      apiKey,
      fallbackApiKeys = [],
      image,
      video,
      prompt,
      negativePrompt,
      model,
      workflowId: explicitWorkflowId,
      aspectRatio,
      duration,
      resolution,
    } = req.body || {};

    let targetWorkflowId = explicitWorkflowId;
    if (!targetWorkflowId) {
      if (model === 'MiniMax H3 Turbo Video' || model === '2098388825144184833' || model === '2100116399125848066') {
        targetWorkflowId = '2098388825144184833';
      } else if (model === 'S2 Motion Control' || model === '2091060763809492994') {
        targetWorkflowId = '2091060763809492994';
      } else {
        targetWorkflowId = '2088843516532506626';
      }
    }

    const workflowId = targetWorkflowId;
    const isMiniMax = model === 'MiniMax H3 Turbo Video' || workflowId === '2098388825144184833' || workflowId === '2100116399125848066';

    const cleanKey = ((apiKey || '') as string).trim();
    if (!cleanKey) {
      return res.status(400).json({
        success: false,
        error: 'API Key RunningHub wajib disertakan.',
      });
    }

    if (!image && !isMiniMax) {
      return res.status(400).json({
        success: false,
        error: 'Gambar input (Image) wajib disertakan.',
      });
    }

    if (isMiniMax && !image && !prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt teks wajib disertakan untuk Text-to-Video MiniMax H3.',
      });
    }

    if (!isMiniMax && !video) {
      return res.status(400).json({
        success: false,
        error: 'Video gerak (Video) wajib disertakan untuk RunningHub Motion Control.',
      });
    }

    console.log(`[RunningHub Generate] Model: ${model || 'Motion Control'} | Workflow ID: ${workflowId} | Processing files for apiKey ${cleanKey.slice(0, 6)}...`);

    // 1. Upload Image (if provided)
    let uploadedImageFileName = '';
    if (image) {
      uploadedImageFileName = image;
      if (typeof image === 'string' && (image.startsWith('data:') || image.startsWith('http://') || image.startsWith('https://'))) {
        uploadedImageFileName = await uploadFileToRunningHub(cleanKey, image, 'input_image.jpg', false);
      }
    }

    // 2. Upload Video (if provided / required)
    let uploadedVideoFileName = '';
    if (video) {
      if (typeof video === 'string' && (video.startsWith('data:') || video.startsWith('http://') || video.startsWith('https://'))) {
        uploadedVideoFileName = await uploadFileToRunningHub(cleanKey, video, 'input_video.mp4', true);
      } else {
        uploadedVideoFileName = video;
      }
    }

    console.log(`[RunningHub Generate] Files uploaded -> Image: ${uploadedImageFileName || '(none - Text-to-Video)'}, Video: ${uploadedVideoFileName || '(none)'}`);

    // 3. Resolve dynamic workflow node mapping
    const positiveText = (prompt || '').trim() || (isMiniMax ? 'High quality cinematic video, realistic motion, ultra-detailed, 4k' : 'best quality, high quality, 1080p, ultra-detailed, realistic motion');
    const negativeText = (negativePrompt || '').trim() || 'low quality, worst quality, deformed, blurry, bad anatomy';

    const mapping = await getWorkflowNodeMapping(cleanKey, workflowId);
    let nodeInfoList = buildNodeInfoList(
      mapping,
      uploadedImageFileName,
      uploadedVideoFileName,
      positiveText,
      negativeText,
      {
        aspectRatio: aspectRatio || '16:9 (Widescreen)',
        duration: duration || '10s',
        resolution: resolution || '768p',
      }
    );

    console.log(`[RunningHub Generate] Using nodeInfoList for workflow ${workflowId}:`, JSON.stringify(nodeInfoList));

    // 4. Create Task with multi-account fallback (Prioritizing active keys with available power)
    const rawKeysToTry = [
      cleanKey,
      ...((Array.isArray(fallbackApiKeys) ? fallbackApiKeys : []) as string[])
        .map((k) => (k || '').trim())
        .filter((k) => k && k !== cleanKey),
    ];

    // Sort keys so non-exhausted accounts are attempted first
    const allKeysToTry = [
      ...rawKeysToTry.filter((k) => !isKeyExhausted(k)),
      ...rawKeysToTry.filter((k) => isKeyExhausted(k)),
    ];

    let createRes: any = null;
    let successfulApiKey = cleanKey;
    const exhaustedApiKeys: string[] = [];

    for (let keyIdx = 0; keyIdx < allKeysToTry.length; keyIdx++) {
      const currentTryKey = allKeysToTry[keyIdx];
      const maxQueueRetries = keyIdx === 0 && allKeysToTry.length > 1 ? 1 : 2;

      for (let attempt = 0; attempt <= maxQueueRetries; attempt++) {
        try {
          // Send official exact schema to RunningHub OpenAPI
          createRes = await axios.post(
            `${RUNNINGHUB_PRIMARY_URL}/task/openapi/create`,
            {
              apiKey: currentTryKey,
              workflowId: workflowId,
              nodeInfoList: nodeInfoList,
            },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 35000,
              validateStatus: () => true,
            }
          );
        } catch (netErr) {
          // If primary URL experienced network connection failure, try fallback domain
          try {
            createRes = await axios.post(
              `${RUNNINGHUB_FALLBACK_URL}/task/openapi/create`,
              {
                apiKey: currentTryKey,
                workflowId: workflowId,
                nodeInfoList: nodeInfoList,
              },
              {
                headers: { 'Content-Type': 'application/json' },
                timeout: 35000,
                validateStatus: () => true,
              }
            );
          } catch (e) {}
        }

        // If NODE_INFO_MISMATCH occurred, automatically switch to alternate candidate layout and retry immediately
        if (createRes?.data?.code === 803 || String(createRes?.data?.msg || '').includes('NODE_INFO_MISMATCH')) {
          console.log(`[RunningHub 🔄 Node Mismatch Auto-Fix] Detected mismatch on workflow ${workflowId}. Attempting alternate node schema...`);
          if (isMiniMax) {
            // Alternate between (293, 294, 296, 297) and (324, 325, 327, 328)
            if (nodeInfoList.some((n) => n.nodeId === '293')) {
              nodeInfoList = buildNodeInfoList(
                {
                  imageNode: { nodeId: '324', fieldName: 'image' },
                  positiveTextNode: { nodeId: '325', fieldName: 'prompt' },
                  aspectRatioNode: { nodeId: '327', fieldName: 'aspect_ratio' },
                  megapixelsNode: { nodeId: '327', fieldName: 'megapixels' },
                  durationNode: { nodeId: '328', fieldName: 'value' },
                },
                uploadedImageFileName,
                uploadedVideoFileName,
                positiveText,
                negativeText,
                { aspectRatio, duration, resolution }
              );
            } else {
              nodeInfoList = buildNodeInfoList(
                {
                  imageNode: { nodeId: '293', fieldName: 'image' },
                  positiveTextNode: { nodeId: '294', fieldName: 'prompt' },
                  aspectRatioNode: { nodeId: '296', fieldName: 'aspect_ratio' },
                  megapixelsNode: { nodeId: '296', fieldName: 'megapixels' },
                  durationNode: { nodeId: '297', fieldName: 'value' },
                },
                uploadedImageFileName,
                uploadedVideoFileName,
                positiveText,
                negativeText,
                { aspectRatio, duration, resolution }
              );
            }
          } else if (nodeInfoList.some((n) => n.nodeId === '30')) {
            // Toggle between standard (30,33) and S2 (4,5,13)
            nodeInfoList = buildNodeInfoList(
              {
                imageNode: { nodeId: '4', fieldName: 'image' },
                videoNode: { nodeId: '5', fieldName: 'video' },
                positiveTextNode: { nodeId: '13', fieldName: 'positive' },
                negativeTextNode: { nodeId: '13', fieldName: 'negative' },
              },
              uploadedImageFileName,
              uploadedVideoFileName,
              positiveText,
              negativeText
            );
          } else {
            nodeInfoList = buildNodeInfoList(
              {
                imageNode: { nodeId: '30', fieldName: 'image' },
                videoNode: { nodeId: '33', fieldName: 'video' },
                positiveTextNode: { nodeId: '3', fieldName: 'text' },
                negativeTextNode: { nodeId: '4', fieldName: 'text' },
              },
              uploadedImageFileName,
              uploadedVideoFileName,
              positiveText,
              negativeText
            );
          }

          try {
            createRes = await axios.post(
              `${RUNNINGHUB_PRIMARY_URL}/task/openapi/create`,
              {
                apiKey: currentTryKey,
                workflowId: workflowId,
                nodeInfoList: nodeInfoList,
              },
              {
                headers: { 'Content-Type': 'application/json' },
                timeout: 35000,
                validateStatus: () => true,
              }
            );
          } catch (e) {}
        }

        if (createRes?.data?.code === 0 && createRes.data?.data?.taskId) {
          successfulApiKey = currentTryKey;
          console.log(`[RunningHub ✅ Task Created] Task ID: ${createRes.data.data.taskId} pada akun ${currentTryKey.slice(0, 6)}...`);
          break;
        }

        const resCode = createRes?.data?.code;
        const msg = String(createRes?.data?.msg || createRes?.data?.message || '');
        const isQueueMaxed = msg.includes('TASK_QUEUE_MAXED') || msg.toLowerCase().includes('queue') || msg.toLowerCase().includes('max');
        const isOutOfCoins = resCode === 414 || msg.includes('NOT_ENOUGH_POWER') || msg.toLowerCase().includes('power') || msg.toLowerCase().includes('coin');

        if (isOutOfCoins) {
          markKeyExhausted(currentTryKey);
          if (!exhaustedApiKeys.includes(currentTryKey)) {
            exhaustedApiKeys.push(currentTryKey);
          }
          console.warn(`[RunningHub ⚡ Account Fallback] Akun ${currentTryKey.slice(0, 6)}... koin/power habis (${msg}). Mencoba akun berikutnya (${keyIdx + 1}/${allKeysToTry.length})...`);
          break; // Stop retrying this empty account and switch to the next account immediately!
        }

        if (isQueueMaxed) {
          if (keyIdx < allKeysToTry.length - 1) {
            console.log(`[RunningHub ⚡ Account Fallback] Akun ${currentTryKey.slice(0, 6)}... antrian penuh (${msg}). Mencoba fallback ke akun cadangan (${keyIdx + 1}/${allKeysToTry.length})...`);
            break; // Try next account immediately
          } else if (attempt < maxQueueRetries) {
            console.log(`[RunningHub ⏳ Queue Busy] Antrian RunningHub penuh (${msg}), menunggu 3 detik (Percobaan ${attempt + 1}/${maxQueueRetries})...`);
            await new Promise((r) => setTimeout(r, 3000));
          }
        } else {
          // Any other error, try next account if available
          if (keyIdx < allKeysToTry.length - 1) {
            console.log(`[RunningHub ⚡ Account Fallback] Akun ${currentTryKey.slice(0, 6)}... respon (${resCode}: ${msg}). Mencoba akun cadangan berikutnya...`);
          }
          break;
        }
      }

      if (createRes?.data?.code === 0 && createRes.data?.data?.taskId) {
        break;
      }
    }

    if (createRes?.data?.code === 0 && createRes.data?.data?.taskId) {
      const taskId = createRes.data.data.taskId;
      console.log(`[RunningHub 🚀 Task Ready] Task ID: ${taskId} berhasil diinisialisasi.`);
      return res.json({
        success: true,
        taskId: taskId,
        clientId: createRes.data.data.clientId,
        usedApiKey: successfulApiKey,
        exhaustedApiKeys: exhaustedApiKeys,
        msg: 'Task berhasil dibuat di RunningHub',
      });
    }

    if (createRes?.data?.code !== 0) {
      console.warn(`[RunningHub ⚠️ Task Creation Note]: ${createRes?.data?.msg || createRes?.data?.message || 'Menunggu respons server'}`);
    }

    const rawErrorMsg = createRes?.data?.msg || createRes?.data?.message || 'Gagal membuat task RunningHub';
    const isQueueMaxed = rawErrorMsg.includes('TASK_QUEUE_MAXED') || rawErrorMsg.toLowerCase().includes('queue');
    const isFinalOutOfCoins =
      createRes?.data?.code === 414 ||
      rawErrorMsg.includes('NOT_ENOUGH_POWER') ||
      rawErrorMsg.toLowerCase().includes('power') ||
      rawErrorMsg.toLowerCase().includes('coin');

    if (isQueueMaxed) {
      // Return a non-fatal queued payload so frontend can queue and continuously auto-retry in background
      return res.json({
        success: true,
        queued: true,
        isQueueMaxed: true,
        exhaustedApiKeys: exhaustedApiKeys,
        uploadedImage: uploadedImageFileName,
        uploadedVideo: uploadedVideoFileName,
        workflowId: workflowId,
        nodeInfoList: nodeInfoList,
        msg: 'TASK_QUEUE_MAXED: Semua akun RunningHub sedang sibuk atau antrean penuh.',
      });
    }

    if (isFinalOutOfCoins) {
      return res.status(400).json({
        success: false,
        isOutOfCoins: true,
        exhaustedApiKeys: exhaustedApiKeys,
        error: 'Semua akun RunningHub telah kehabisan koin/power (0 Coins). Silakan tambahkan akun baru atau isi ulang koin di Pengaturan.',
        code: 414,
      });
    }

    return res.status(400).json({
      success: false,
      exhaustedApiKeys: exhaustedApiKeys,
      error: rawErrorMsg,
      code: createRes?.data?.code,
    });
  } catch (error: any) {
    console.error('[RunningHub Generate Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Gagal memulai proses generate video di RunningHub.',
    });
  }
});

// POST /api/runninghub/status & /api/runninghub/task-status
// Polls task status and retrieves final output video URLs
const handleRunningHubStatusCheck = async (req: any, res: any) => {
  try {
    const { apiKey, taskId } = req.body || {};
    const cleanKey = ((apiKey || '') as string).trim();

    if (!cleanKey || !taskId) {
      return res.status(400).json({
        success: false,
        error: 'apiKey dan taskId wajib disertakan.',
      });
    }

    const baseHosts = [RUNNINGHUB_PRIMARY_URL, RUNNINGHUB_FALLBACK_URL];
    let rawStatus = 'RUNNING';
    let outputs: any[] = [];
    let statusResponseData: any = null;
    let failedErrorMessage = '';

    // Helper to extract clean URL from any output structure
    const extractUrl = (item: any): string => {
      if (!item) return '';
      if (typeof item === 'string') return item.trim();
      return (
        item.fileUrl ||
        item.file_url ||
        item.url ||
        item.downloadUrl ||
        item.download_url ||
        item.ossUrl ||
        item.oss_url ||
        item.videoUrl ||
        item.video_url ||
        item.outputUrl ||
        item.output_url ||
        item.resultUrl ||
        item.result_url ||
        item.previewUrl ||
        item.preview_url ||
        item.coverUrl ||
        item.cover_url ||
        item.src ||
        item.path ||
        item.target_url ||
        item.mediaUrl ||
        ''
      );
    };

    // Helper to collect all outputs from any nested object/array
    const collectOutputs = (data: any) => {
      if (!data) return;
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item) outputs.push(item);
        }
      } else if (typeof data === 'object') {
        if (Array.isArray(data.outputs)) {
          collectOutputs(data.outputs);
        } else if (Array.isArray(data.results)) {
          collectOutputs(data.results);
        } else if (Array.isArray(data.outputList)) {
          collectOutputs(data.outputList);
        } else if (Array.isArray(data.fileUrlList)) {
          collectOutputs(data.fileUrlList);
        } else if (data.fileUrl || data.url || data.downloadUrl || data.ossUrl || data.videoUrl) {
          outputs.push(data);
        }
      } else if (typeof data === 'string' && data.startsWith('http')) {
        outputs.push(data);
      }
    };

    // 1. Try checking status and output endpoints across base hosts
    for (const host of baseHosts) {
      // Check status endpoint
      try {
        const sRes = await axios.post(
          `${host}/task/openapi/status`,
          {
            apiKey: cleanKey,
            taskId: taskId.toString(),
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${cleanKey}`,
            },
            timeout: 10000,
            validateStatus: () => true,
          }
        );

        if (sRes.data) {
          statusResponseData = sRes.data;
          const code = sRes.data.code;
          const d = sRes.data.data;
          
          if (code === 0 && d !== undefined && d !== null) {
            if (typeof d === 'string') {
              rawStatus = d;
            } else if (typeof d === 'object') {
              rawStatus = d.taskStatus || d.status || d.state || rawStatus;
              collectOutputs(d);
            }
          }
        }
      } catch (e) {}

      // Check outputs endpoint
      try {
        const oRes = await axios.post(
          `${host}/task/openapi/outputs`,
          {
            apiKey: cleanKey,
            taskId: taskId.toString(),
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${cleanKey}`,
            },
            timeout: 10000,
            validateStatus: () => true,
          }
        );

        if (oRes.data?.code === 0 && oRes.data?.data) {
          collectOutputs(oRes.data.data);
          rawStatus = 'SUCCESS';
        } else if (oRes.data?.data?.failedReason?.exception_message) {
          failedErrorMessage = String(oRes.data.data.failedReason.exception_message).trim();
          rawStatus = 'FAILED';
        }
      } catch (e) {}

      // Check outputs/v2 endpoint as fallback
      if (outputs.length === 0) {
        try {
          const oV2Res = await axios.post(
            `${host}/task/openapi/outputs/v2`,
            {
              apiKey: cleanKey,
              taskId: taskId.toString(),
            },
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${cleanKey}`,
              },
              timeout: 10000,
              validateStatus: () => true,
            }
          );

          if (oV2Res.data?.code === 0 && oV2Res.data?.data) {
            collectOutputs(oV2Res.data.data);
            rawStatus = 'SUCCESS';
          }
        } catch (e) {}
      }

      if (outputs.length > 0) break;
    }

    let videoUrl = '';
    let coverUrl = '';

    if (outputs.length > 0) {
      // Search for video output first
      const vidItem = outputs.find((o: any) => {
        const u = extractUrl(o).toLowerCase();
        return (
          u.endsWith('.mp4') ||
          u.endsWith('.webm') ||
          u.endsWith('.mov') ||
          u.includes('.mp4?') ||
          u.includes('.webm?') ||
          o?.fileType === 'video' ||
          o?.type === 'video'
        );
      });

      if (vidItem) {
        videoUrl = extractUrl(vidItem);
      } else {
        // Fallback to first non-empty url output
        for (const item of outputs) {
          const candidate = extractUrl(item);
          if (candidate) {
            videoUrl = candidate;
            break;
          }
        }
      }

      // Look for image/cover
      const imgItem = outputs.find((o: any) => {
        const u = extractUrl(o).toLowerCase();
        return (
          u.endsWith('.jpg') ||
          u.endsWith('.jpeg') ||
          u.endsWith('.png') ||
          u.endsWith('.webp') ||
          o?.fileType === 'image' ||
          o?.type === 'image'
        );
      });
      if (imgItem) {
        coverUrl = extractUrl(imgItem);
      }
    }

    const isSuccess =
      rawStatus.toUpperCase() === 'SUCCESS' ||
      rawStatus.toUpperCase() === 'COMPLETED' ||
      rawStatus.toUpperCase() === 'FINISH' ||
      rawStatus.toUpperCase() === 'FINISHED' ||
      (outputs.length > 0 && !!videoUrl);

    const isFailed =
      rawStatus.toUpperCase() === 'FAILED' ||
      rawStatus.toUpperCase() === 'FAIL' ||
      rawStatus.toUpperCase() === 'ERROR';

    const normalizedStatus = isSuccess ? 'completed' : (isFailed ? 'failed' : 'processing');

    console.log(
      `[RunningHub Poll] Task: ${taskId} | RawStatus: ${rawStatus} | Status: ${normalizedStatus} | MediaUrl: ${videoUrl ? 'FOUND' : 'NONE'}${failedErrorMessage ? ` | Reason: ${failedErrorMessage.split('\n')[0]}` : ''}`
    );

    return res.json({
      success: true,
      status: normalizedStatus,
      rawStatus: rawStatus,
      outputs: outputs,
      videoUrl: videoUrl,
      mediaUrl: videoUrl,
      outputUrl: videoUrl,
      resultUrl: videoUrl,
      fileUrl: videoUrl,
      coverUrl: coverUrl,
      error: isFailed ? (failedErrorMessage || 'Proses generate gagal di server RunningHub.') : undefined,
      errorMessage: isFailed ? (failedErrorMessage || 'Proses generate gagal di server RunningHub.') : undefined,
      raw: statusResponseData,
    });
  } catch (error: any) {
    console.error('[RunningHub Status Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Gagal memeriksa status task di RunningHub.',
    });
  }
};

router.post('/runninghub/status', handleRunningHubStatusCheck);
router.post('/runninghub/task-status', handleRunningHubStatusCheck);

export default router;

