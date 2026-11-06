import express from 'express';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import axios from 'axios';
import FormData from 'form-data';
import multer from 'multer';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import proxyRouter from './server/routes/proxy';
import uploadRouter from './server/routes/upload';
import authRouter from './server/routes/auth';
import providerAccountsRouter from './server/routes/providerAccounts';
import cliGeminiRouter from './server/routes/cliGemini';
import weavyRouter from './server/providers/weavy';
import roboneoRouter from './server/providers/roboneo';
import galleri5Router from './server/providers/galleri5';
import kieRouter from './server/providers/kie';
import runninghubRouter from './server/providers/runninghub';
import geminiRouter from './server/providers/gemini';
import chatSessionsRouter from './server/routes/chatSessions';
import studioRouter from './server/routes/studio';
import flowRouter from './server/providers/flow';
import vidsRouter from './server/providers/vids';
import resolveLinkRouter from './server/routes/resolveLink';
import stitchVideoRouter from './server/routes/stitchVideo';
import { ensureFfmpegBinary } from './scripts/ensure-ffmpeg';

// Auto-ensure FFmpeg binary is ready on server start
ensureFfmpegBinary().catch((e) => console.warn('[FFmpeg Init Warning]:', e?.message));

// Set Playwright browser binary path directly to the project root playwright-browsers folder
const playwrightDir = fs.existsSync(path.join(process.cwd(), 'playwright-browsers'))
  ? path.join(process.cwd(), 'playwright-browsers')
  : path.join(process.cwd(), '.playwright-browsers');
process.env.PLAYWRIGHT_BROWSERS_PATH = playwrightDir;

const PORT = 3000;
const FIREBASE_API_KEY = 'AIzaSyC-qLy3TFyXMogJPfMkZJ9H_q46hEu1sxI';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

// Helper to get fresh ID Token from Refresh Token via Firebase Auth
async function getFreshIdToken(refreshToken: string): Promise<string> {
  const cleanToken = refreshToken.trim();
  let lastErr: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await axios.post(
        `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: cleanToken,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 12000,
        }
      );

      if (resp.data && resp.data.id_token) {
        return resp.data.id_token;
      }
    } catch (err: any) {
      lastErr = err;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(lastErr?.response?.data?.error?.message || lastErr?.message || 'Gagal memperbarui ID Token dari Firebase Auth.');
}

function cleanErrorMessage(error: any): string {
  if (!error) return 'Gagal memproses permintaan di server.';

  // 1. Check if response data itself is an HTML string (502/504 Bad Gateway from Cloudflare/Proxy)
  const rawResponseData = error?.response?.data;
  if (typeof rawResponseData === 'string' && rawResponseData.trim().startsWith('<')) {
    return `Layanan Weavy AI/Server sedang sibuk atau timeout (HTTP ${error?.response?.status || '502'}). Silakan coba lagi.`;
  }

  let errDetail = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Gagal membuat task generasi.';
  if (typeof errDetail === 'object') {
    errDetail = JSON.stringify(errDetail);
  } else {
    errDetail = String(errDetail);
  }

  if (errDetail.trim().startsWith('<')) {
    return `Layanan Weavy AI mengembalikan respon server HTML (HTTP ${error?.response?.status || '500'}). Silakan coba lagi.`;
  }

  if (errDetail.includes('Unexpected token') || errDetail.includes('is not valid JSON')) {
    return 'Layanan server menerima respon non-JSON dari Weavy AI. Silakan coba lagi.';
  }

  return errDetail;
}

// Weavy API headers
function getWeavyHeaders(idToken: string) {
  return {
    'Authorization': `Bearer ${idToken}`,
    'Accept': 'application/json, text/plain, */*',
    'X-Weavy-Auth-Provider': 'firebase',
    'x-app-version': '4.1.1316',
    'Origin': 'https://app.weavy.ai',
    'Referer': 'https://app.weavy.ai/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Content-Type': 'application/json',
  };
}

// Helper to fetch user's remaining credits directly from Weavy API
async function getWeavyUserCredits(idToken: string): Promise<number | null> {
  if (!idToken) return null;
  try {
    const weavyHeaders = getWeavyHeaders(idToken);
    let userInfo: any = null;
    try {
      const userResp = await axios.get('https://api.weavy.ai/api/v1/users', {
        headers: weavyHeaders,
        timeout: 10000,
      });
      userInfo = userResp.data;
    } catch (e) {
      try {
        const altResp = await axios.get('https://api.weavy.ai/users', {
          headers: weavyHeaders,
          timeout: 10000,
        });
        userInfo = altResp.data;
      } catch (e2) {}
    }

    if (userInfo?.credits !== undefined && userInfo?.credits !== null) {
      return Number(userInfo.credits);
    } else if (userInfo?.balance !== undefined && userInfo?.balance !== null) {
      return Number(userInfo.balance);
    } else if (userInfo?.quota !== undefined && userInfo?.quota !== null) {
      return Number(userInfo.quota);
    } else if (userInfo?.credit !== undefined && userInfo?.credit !== null) {
      return Number(userInfo.credit);
    }
    return null;
  } catch (err) {
    return null;
  }
}

// Helper to deeply extract media URL from any nested Weavy response object or node
function extractMediaUrlFromObject(obj: any): { url: string; coverUrl?: string } | null {
  if (!obj) return null;

  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return { url: trimmed };
    }
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
    // Check known media keys directly
    const possibleKeys = ['url', 'fileUrl', 'mediaUrl', 'viewUrl', 'videoUrl', 'video', 'imageUrl', 'image', 'downloadUrl', 'outputUrl', 'resultUrl', 'src'];
    for (const key of possibleKeys) {
      if (typeof obj[key] === 'string' && (obj[key].startsWith('http://') || obj[key].startsWith('https://'))) {
        const cover = obj.viewUrl || obj.thumbnailUrl || obj.coverUrl || obj.thumbnail || '';
        return { url: obj[key].trim(), coverUrl: typeof cover === 'string' ? cover : '' };
      }
    }

    // Deep search object properties
    for (const val of Object.values(obj)) {
      const found = extractMediaUrlFromObject(val);
      if (found) return found;
    }
  }

  return null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Media Cache directory for local caching of extracted videos (zero expiration, instant range streaming)
  const mediaCacheDir = path.join(process.cwd(), 'media-cache');
  if (!fs.existsSync(mediaCacheDir)) {
    fs.mkdirSync(mediaCacheDir, { recursive: true });
  }
  app.use('/media-cache', express.static(mediaCacheDir));

  // Mount Proxy, Upload & Provider Routers
  app.use('/api', proxyRouter);
  app.use('/api', uploadRouter);
  app.use('/api', authRouter);
  app.use('/api', cliGeminiRouter);
  app.use('/api', providerAccountsRouter);
  app.use('/api', weavyRouter);
  app.use('/api', roboneoRouter);
  app.use('/api', galleri5Router);
  app.use('/api', kieRouter);
  app.use('/api', runninghubRouter);
  // Google Gemini Provider Router: MURNI menggunakan input sesi cURL bash / cookies akun Google pengguna (BUKAN API Key)
  app.use('/api', geminiRouter);
  app.use('/api', flowRouter);
  app.use('/api', vidsRouter);
  app.use('/api', chatSessionsRouter);
  app.use('/api', studioRouter);
  app.use('/api', resolveLinkRouter);
  app.use('/api', stitchVideoRouter);

  // TikTok Video Info Endpoint (for /download slash command)
  app.get('/api/tiktok/info', async (req, res) => {
    try {
      const rawUrl = String(req.query.url || '').trim();
      if (!rawUrl) {
        return res.status(400).json({ success: false, error: 'URL TikTok tidak boleh kosong.' });
      }
      const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(rawUrl)}&hd=1`;
      const tikRes = await axios.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        },
        timeout: 20000,
      });
      const tikData = tikRes.data;
      if (!tikData || tikData.code !== 0 || !tikData.data) {
        return res.status(400).json({
          success: false,
          error: tikData?.msg || 'Gagal mengambil informasi video TikTok. Pastikan video bersifat publik.'
        });
      }
      const v = tikData.data;
      const playUrl = v.play || v.wmplay || '';
      const hdUrl = v.hdplay || '';
      const finalVideoUrl = hdUrl ? (hdUrl.startsWith('http') ? hdUrl : `https://www.tikwm.com${hdUrl}`) : (playUrl.startsWith('http') ? playUrl : `https://www.tikwm.com${playUrl}`);
      const coverUrl = v.cover || v.origin_cover || '';
      const musicUrl = v.music || '';

      return res.json({
        success: true,
        data: {
          id: v.id || String(Date.now()),
          title: v.title || 'TikTok Video',
          author: {
            nickname: v.author?.nickname || 'TikTok Creator',
            unique_id: v.author?.unique_id || '',
            avatar: v.author?.avatar || '',
          },
          duration: v.duration || 0,
          cover: coverUrl,
          downloadUrl: finalVideoUrl,
          downloadMusicUrl: musicUrl,
          downloadCoverUrl: coverUrl,
          stats: {
            play_count: v.play_count || 0,
            digg_count: v.digg_count || 0,
            comment_count: v.comment_count || 0,
            share_count: v.share_count || 0,
            download_count: v.download_count || 0,
          }
        }
      });
    } catch (err: any) {
      console.error('[TikTok Info Error]:', err?.message || err);
      return res.status(500).json({ success: false, error: err?.message || 'Gagal memproses link TikTok.' });
    }
  });

  // TikTok Download & Auto-Upload to Active Provider Endpoint
  app.post('/api/tiktok-import', async (req, res) => {
    try {
      const { tiktokUrl, providerId, accountToken, refreshToken, allRefreshTokens } = req.body || {};

      if (!tiktokUrl || typeof tiktokUrl !== 'string' || !tiktokUrl.trim()) {
        return res.status(400).json({ error: 'URL TikTok wajib diisi.' });
      }

      const cleanUrl = tiktokUrl.trim();
      const targetProvider = (providerId || 'weavy').toLowerCase();
      console.log(`[TikTok Import] Processing URL: ${cleanUrl} for provider: ${targetProvider}...`);

      // 1. Fetch TikTok video details from TikWM API
      const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}&hd=1`;
      const tikRes = await axios.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 25000,
      });

      const tikData = tikRes.data;
      if (!tikData || tikData.code !== 0 || !tikData.data) {
        return res.status(400).json({
          error: tikData?.msg || 'Gagal mengambil informasi video TikTok. Pastikan link video publik & valid.'
        });
      }

      const vInfo = tikData.data;
      const title = vInfo.title || 'TikTok Video';
      const author = vInfo.author?.nickname || vInfo.author?.unique_id || 'TikTok User';
      const cover = vInfo.cover || vInfo.origin_cover || '';

      const playUrl = vInfo.play || vInfo.wmplay;
      const hdUrl = vInfo.hdplay;
      let downloadUrl = hdUrl ? (hdUrl.startsWith('http') ? hdUrl : `https://www.tikwm.com${hdUrl}`) : (playUrl.startsWith('http') ? playUrl : `https://www.tikwm.com${playUrl}`);

      console.log(`[TikTok Import] Found video "${title}" by ${author}. Downloading no-watermark stream...`);

      // 2. Download video buffer
      const videoResp = await axios.get(downloadUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.tikwm.com/',
        },
        responseType: 'arraybuffer',
        timeout: 90000,
      });

      const videoBuffer = Buffer.from(videoResp.data);
      const sizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(1);
      const fileName = `tiktok_${Date.now()}.mp4`;
      const mimeType = 'video/mp4';

      console.log(`[TikTok Import] Downloaded video (${sizeMB} MB). Uploading to provider "${targetProvider}"...`);

      let uploadedUrl = downloadUrl; // fallback if provider upload fails
      let uploadProviderSuccess = false;

      // 3. Upload to active provider
      const base64Data = `data:${mimeType};base64,${videoBuffer.toString('base64')}`;

      if (targetProvider === 'roboneo' && accountToken) {
        try {
          const roboneoRes = await axios.post('http://127.0.0.1:3000/api/roboneo/upload', {
            fileData: base64Data,
            fileName,
            mimeType,
            accessToken: accountToken,
          }, { timeout: 120000 });
          if (roboneoRes.data && roboneoRes.data.url) {
            uploadedUrl = roboneoRes.data.url;
            uploadProviderSuccess = true;
            console.log(`[TikTok Import] Upload to RoboNeo success:`, uploadedUrl);
          }
        } catch (rErr: any) {
          console.warn(`[TikTok Import] RoboNeo upload error:`, rErr?.message);
        }
      } else if (targetProvider === 'galleri5' && accountToken) {
        try {
          const galleriRes = await axios.post('http://127.0.0.1:3000/api/galleri5/upload', {
            fileData: base64Data,
            fileName,
            mimeType,
            refreshToken: accountToken,
            accessToken: accountToken,
          }, { timeout: 120000 });
          if (galleriRes.data && galleriRes.data.url) {
            uploadedUrl = galleriRes.data.url;
            uploadProviderSuccess = true;
            console.log(`[TikTok Import] Upload to Galleri5 success:`, uploadedUrl);
          }
        } catch (gErr: any) {
          console.warn(`[TikTok Import] Galleri5 upload error:`, gErr?.message);
        }
      } else if (targetProvider === 'runninghub' && accountToken) {
        try {
          const rhRes = await axios.post('http://127.0.0.1:3000/api/runninghub/upload', {
            fileData: base64Data,
            fileName,
            mimeType,
            apiKey: accountToken,
          }, { timeout: 120000 });
          if (rhRes.data && rhRes.data.url) {
            uploadedUrl = rhRes.data.url;
            uploadProviderSuccess = true;
            console.log(`[TikTok Import] Upload to RunningHub success:`, uploadedUrl);
          }
        } catch (rhErr: any) {
          console.warn(`[TikTok Import] RunningHub upload error:`, rhErr?.message);
        }
      } else if (targetProvider === 'kie' && accountToken) {
        try {
          const kieRes = await axios.post('http://127.0.0.1:3000/api/kie/upload', {
            fileData: base64Data,
            fileName,
            mimeType,
            apiKey: accountToken,
          }, { timeout: 120000 });
          if (kieRes.data && kieRes.data.url) {
            uploadedUrl = kieRes.data.url;
            uploadProviderSuccess = true;
            console.log(`[TikTok Import] Upload to Kie.ai success:`, uploadedUrl);
          }
        } catch (kErr: any) {
          console.warn(`[TikTok Import] Kie upload error:`, kErr?.message);
        }
      } else {
        // Weavy / Default
        try {
          const weavyRes = await axios.post('http://127.0.0.1:3000/api/upload-media', {
            fileData: base64Data,
            fileName,
            mimeType,
            refreshToken: accountToken || refreshToken,
            allRefreshTokens: allRefreshTokens,
          }, { timeout: 120000 });
          if (weavyRes.data && weavyRes.data.url) {
            uploadedUrl = weavyRes.data.url;
            uploadProviderSuccess = true;
            console.log(`[TikTok Import] Upload to Weavy success:`, uploadedUrl);
          }
        } catch (wErr: any) {
          console.warn(`[TikTok Import] Weavy upload error:`, wErr?.message);
        }
      }

      return res.json({
        success: true,
        title,
        author,
        cover,
        url: uploadedUrl,
        size: `${sizeMB} MB`,
        provider: targetProvider,
        uploadProviderSuccess,
      });

    } catch (error: any) {
      console.error(`[TikTok Import] Error:`, error?.response?.data || error?.message);
      return res.status(500).json({ error: cleanErrorMessage(error) });
    }
  });

  // 1. Generate Video Endpoint for SeeDance 2.0
  app.post('/api/generate-weavy', async (req, res) => {
    try {
      const {
        refreshToken,
        idToken: providedIdToken,
        prompt,
        model,
        videoModel,
        aspect_ratio,
        resolution,
        duration,
        generate_audio,
        enableAudio,
        image_url,
        imageUrl,
        image,
        video_url,
        attached_media,
        attachedMedia,
      } = req.body;

      const shouldGenerateAudio = (generate_audio !== undefined ? generate_audio : (enableAudio !== undefined ? enableAudio : true)) !== false;

      const requestedModel = model || videoModel || 'SeeDance 2.0 Mini';
      const isKlingMotion = requestedModel.toLowerCase().includes('kling') || requestedModel.toLowerCase().includes('motion');
      const refImageUrl = image_url || imageUrl || image || null;
      const safePrompt = (prompt && typeof prompt === 'string') ? prompt.trim() : '';

      if (!refreshToken && !providedIdToken) {
        return res.status(400).json({ error: 'Refresh token atau ID Token wajib disediakan.' });
      }

      if (!isKlingMotion && !safePrompt) {
        return res.status(400).json({ error: 'Prompt tidak boleh kosong.' });
      }

      // Step 1: Obtain valid ID Token
      let idToken = providedIdToken;
      if (refreshToken) {
        try {
          idToken = await getFreshIdToken(refreshToken);
        } catch (authErr: any) {
          console.warn('[Server] Error refreshing token, falling back to provided token:', authErr.message);
        }
      }

      const headers = getWeavyHeaders(idToken);

      // Step 1.5: Identify model & enforce minimum credit requirements (Seedream V5.0 Pro Edit = 12 credits)
      const isSeedreamV5 = req.body.mode === 'image' && (requestedModel.toLowerCase().includes('seedream') || requestedModel.toLowerCase().includes('v5'));
      const isGptImage25 = req.body.mode === 'image' && (requestedModel.toLowerCase().includes('gpt image 2.5') || requestedModel.toLowerCase().includes('flare') || requestedModel.toLowerCase().includes('gpt-image-2.5'));
      const isNanoBanana = !isSeedreamV5 && !isGptImage25 && req.body.mode === 'image' && (requestedModel.toLowerCase().includes('banana') || requestedModel.toLowerCase().includes('nano'));
      const isGptImageEdit = !isSeedreamV5 && !isGptImage25 && !isNanoBanana && req.body.mode === 'image' && (requestedModel.toLowerCase().includes('gpt') || requestedModel.toLowerCase().includes('chatgpt') || requestedModel.toLowerCase().includes('edit'));
      const isGrokImagine = !isSeedreamV5 && !isGptImage25 && ((!isNanoBanana && !isGptImageEdit && req.body.mode === 'image') || requestedModel.toLowerCase().includes('grok') || requestedModel.toLowerCase().includes('imagine'));
      const isSeeDance25 = req.body.mode === 'video' && requestedModel.toLowerCase().includes('2.5');

      let requiredCredits = 4;
      if (req.body.mode === 'video' || isKlingMotion || isSeeDance25) {
        requiredCredits = 50;
      } else if (isSeedreamV5) {
        requiredCredits = 12;
      } else if (isGptImage25) {
        requiredCredits = 4;
      } else if (isGptImageEdit) {
        requiredCredits = 9;
      } else if (isNanoBanana) {
        requiredCredits = 11;
      } else if (isGrokImagine) {
        requiredCredits = 4;
      }

      // Check current user credit balance on backend before executing canvas creation
      try {
        const currentCredits = await getWeavyUserCredits(idToken);
        if (currentCredits !== null && typeof currentCredits === 'number') {
          console.log(`[Server 🪙 Credit Verification] Model: "${requestedModel}", Required: ${requiredCredits} credits, Account Balance: ${currentCredits} credits`);
          if (currentCredits < requiredCredits) {
            return res.status(400).json({
              error: `Kredit akun Weavy tidak mencukupi untuk model ${requestedModel} (Dibutuhkan minimal ${requiredCredits} kredit, saldo akun Anda saat ini: ${currentCredits} kredit). Silakan gunakan akun lain atau top-up kredit di Settings.`,
              requiredCredits,
              currentCredits,
            });
          }
        }
      } catch (creditCheckErr: any) {
        console.warn('[Server ⚠️ Credit Verification Notice]:', creditCheckErr?.message);
      }

      // Step 2: Create a unique dedicated Recipe Canvas for EACH generation task
      // This prevents concurrent generations from overwriting each other's canvas nodes in Weavy!
      let recipeId = '';
      const promptSnippet = safePrompt.substring(0, 20) || (isKlingMotion ? 'Kling Motion' : 'Video Gen');
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const createRes = await axios.post(
            'https://api.weavy.ai/api/v1/recipes/create',
            {
              name: `SeeDance - ${promptSnippet} (${Date.now()})`,
              description: 'Automated workflow canvas for SeeDance Mini 2.0 generator',
            },
            { headers, timeout: 30000 }
          );
          recipeId = createRes.data?.id || createRes.data?._id || createRes.data?.recipe?.id;
          if (recipeId) {
            console.log('[Server] Created dedicated Recipe Canvas ID:', recipeId);
            break;
          }
        } catch (createErr: any) {
          const isCf403 = createErr?.response?.status === 403 || String(createErr?.message || '').includes('403');
          if (isCf403) {
            console.warn('[Server] Weavy API diblokir Cloudflare WAF (HTTP 403) pada IP Datacenter Cloud Run. Beralih ke Ekstensi Chrome Bridge...');
            break;
          } else {
            console.warn(`[Server] Attempt ${attempt + 1} create recipe warning:`, createErr.message);
          }
          if (attempt === 0) await new Promise((r) => setTimeout(r, 600));
        }
      }

      // Fallback: If recipe creation failed, search for existing recipe in workspace
      if (!recipeId) {
        try {
          const recipesRes = await axios.get('https://api.weavy.ai/api/v1/recipes?limit=50', {
            headers,
            timeout: 10000,
          });
          const recipes = Array.isArray(recipesRes.data) ? recipesRes.data : (recipesRes.data?.recipes || []);
          if (recipes.length > 0 && (recipes[0].id || recipes[0]._id)) {
            recipeId = recipes[0].id || recipes[0]._id;
            console.log('[Server] Fallback: Reusing workspace Recipe ID:', recipeId);
          }
        } catch (e: any) {
          const isCf403 = e?.response?.status === 403 || String(e?.message || '').includes('403');
          if (!isCf403) {
            console.warn('[Server] Recipe list scan warning:', e.message);
          }
        }
      }

      if (!recipeId) {
        return res.status(403).json({
          success: false,
          error: 'Akses server Weavy AI diblokir oleh proteksi Cloudflare WAF (HTTP 403). Silakan gunakan koneksi Chrome Extension Bridge agar generasi langsung diproses dari browser Anda tanpa terkena blokir.',
          cloudflareBlocked: true,
        });
      }

      // Step 3: Auto-approve model notice for new accounts via workspace endpoint
      try {
        await axios.post(
          'https://api.weavy.ai/api/v1/workspaces/models/approve',
          { modelIds: ['bytedance/seedance-2.0-mini', 'bytedance/seedance-2.5', 'fal-ai/kling-Video/v2.6/standard/motion-control', 'xai/grok-imagine-image', 'gpt_image_1_edit', 'fal-ai/nano-banana-pro/edit', 'fal-ai/nano-banana-2/edit', 'fal-ai/bytedance/seedream/v5/lite/edit'] },
          { headers, timeout: 10000 }
        );
        console.log('[Server] Approved models via /workspaces/models/approve');
      } catch (e: any) {
        // Safe to ignore if already approved
      }

      // Format aspect ratio parameter (e.g. "9:16 (Vertical)" -> "9:16")
      let cleanAspectRatio = '9:16';
      if (aspect_ratio) {
        const match = aspect_ratio.match(/^(\d+:\d+)/);
        if (match) cleanAspectRatio = match[1];
        else cleanAspectRatio = aspect_ratio;
      }

      const maxDurationLimit = isSeeDance25 ? 30 : 15;

      // Seedream V5.0 Edit aspect ratio to image_size mapping
      let seedreamImageSize = 'portrait_16_9';
      const arRaw = (aspect_ratio || '').toLowerCase();
      if (arRaw.includes('16:9') || (arRaw.includes('landscape') && !arRaw.includes('4:3'))) {
        seedreamImageSize = 'landscape_16_9';
      } else if (arRaw.includes('9:16') || arRaw.includes('vertical')) {
        seedreamImageSize = 'portrait_16_9';
      } else if (arRaw.includes('1:1') || arRaw.includes('square')) {
        seedreamImageSize = 'square';
      } else if (arRaw.includes('3:4') || arRaw.includes('portrait')) {
        seedreamImageSize = 'portrait_4_3';
      } else if (arRaw.includes('4:3')) {
        seedreamImageSize = 'landscape_4_3';
      } else if (arRaw.includes('auto') || arRaw.includes('default')) {
        seedreamImageSize = 'Default';
      }

      // Format duration (e.g. "15 seconds" -> 15 or up to 30 for SeeDance 2.5)
      let numericDuration = 15;
      if (typeof duration === 'number') {
        numericDuration = Math.min(maxDurationLimit, Math.max(4, duration));
      } else if (typeof duration === 'string') {
        const parsed = parseInt(duration, 10);
        if (!isNaN(parsed)) numericDuration = Math.min(maxDurationLimit, Math.max(4, parsed));
      }

      // Clean resolution (720p or 480p)
      let cleanResolution = '720p';
      if (resolution === '480p' || resolution === '720p' || resolution === '1080p' || resolution === '4k' || resolution === '1K' || resolution === '2K' || resolution === '4K') {
        cleanResolution = resolution;
      }

      const randomSeed = Math.floor(Math.random() * 2147483647);
      const activeModelName = isSeedreamV5
        ? 'fal-ai/bytedance/seedream/v5/lite/edit'
        : (isGptImage25
          ? 'gpt-image-2.5'
          : (isNanoBanana
            ? 'fal-ai/nano-banana-pro/edit'
            : (isGptImageEdit
              ? 'gpt_image_1_edit'
              : (isGrokImagine
                ? 'xai/grok-imagine-image'
                : (isKlingMotion
                  ? 'fal-ai/kling-Video/v2.6/standard/motion-control'
                  : (isSeeDance25 ? 'bytedance/seedance-2.5' : 'bytedance/seedance-2.0-mini'))))));
      const activeService = isGptImage25
        ? 'fal'
        : ((isSeedreamV5 || isNanoBanana || isKlingMotion) ? 'fal_imported' : (isGptImageEdit ? 'replicate' : 'replicate'));
      const activeDisplayName = isGptImage25
        ? 'GPT Image 2.5'
        : (isSeedreamV5
          ? 'Seedream V5.0 Pro'
          : (isNanoBanana
            ? 'Nano Banana Pro'
            : (isGptImageEdit
              ? 'ChatGPT Images 2.0 Edit'
              : (isGrokImagine
                ? 'Grok Imagine Image'
                : (isKlingMotion
                  ? 'Kling Motion Control'
                  : (isSeeDance25 ? 'SeeDance 2.5' : 'Seedance Mini 2.0'))))));

      const modelNodeId = `node_model_${Date.now()}`;
      const textNodeId = `node_text_${Date.now()}`;
      const fileNodeId = `node_file_${Date.now()}`;

      // 1. String Text Node
      const textNode = {
        id: textNodeId,
        isModel: false,
        type: 'string',
        position: { x: -560, y: 1400 },
        data: {
          name: 'Text',
          color: 'Yambo_Green',
          value: safePrompt,
          output: { text: safePrompt, type: 'text', string: safePrompt },
          result: { string: safePrompt },
          handles: {
            input: {},
            output: {
              text: { id: `out_${Date.now()}`, type: 'text', order: 0, format: 'text', description: 'Text' }
            }
          },
          version: 3,
          dark_color: 'Yambo_Green_Dark',
          border_color: 'Yambo_Green_Stroke'
        },
        dragHandle: '.node-header',
        originalName: 'Text'
      };

      // Helper function to upload files (images & videos) to Weavy asset store
      const uploadToWeavyStore = async (urlOrData: string, fallbackType: 'image' | 'video' = 'image') => {
        if (!urlOrData) return null;

        // Skip re-upload if urlOrData is already a remote Weavy CDN asset URL or Cloudinary URL
        if (typeof urlOrData === 'string' && (urlOrData.includes('weavy.ai') || urlOrData.includes('cloudinary.com'))) {
          console.log(`[Server 🎨 Asset Upload] Direct Weavy/Cloudinary URL detected, reusing directly:`, urlOrData);
          return {
            id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            url: urlOrData,
            type: fallbackType,
            width: 1024,
            height: 1024,
            viewUrl: urlOrData,
            publicId: '',
            originalUrl: urlOrData,
            thumbnailUrl: urlOrData,
          };
        }

        try {
          const form = new FormData();
          if (typeof urlOrData === 'string' && urlOrData.startsWith('data:')) {
            const match = urlOrData.match(/^data:(image|video)\/(\w+);base64,(.*)$/);
            if (match) {
              const mediaKind = match[1];
              const ext = match[2] || (mediaKind === 'video' ? 'mp4' : 'png');
              const buffer = Buffer.from(match[3], 'base64');
              form.append('file', buffer, { filename: `media.${ext}`, contentType: `${mediaKind}/${ext}` });
            }
          } else if (typeof urlOrData === 'string' && (urlOrData.startsWith('http://') || urlOrData.startsWith('https://'))) {
            const res = await axios.get(urlOrData, { responseType: 'arraybuffer', timeout: 15000 });
            const headerCt = res.headers['content-type'];
            const contentType = typeof headerCt === 'string' ? headerCt : (fallbackType === 'video' ? 'video/mp4' : 'image/png');
            const ext = contentType.split('/')[1] || (fallbackType === 'video' ? 'mp4' : 'png');
            form.append('file', Buffer.from(res.data), { filename: `media.${ext}`, contentType });
          }

          if (form) {
            const uploadRes = await axios.post(
              'https://api.weavy.ai/api/v1/assets/upload',
              form,
              {
                headers: {
                  'Authorization': `Bearer ${idToken}`,
                  'X-Weavy-Auth-Provider': 'firebase',
                  'x-app-version': '4.1.1316',
                  'Origin': 'https://app.weavy.ai',
                  'Referer': 'https://app.weavy.ai/',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  ...form.getHeaders(),
                },
                timeout: 120000,
              }
            );
            if (uploadRes.data && uploadRes.data.url) {
              console.log(`[Server 🎨 Asset Upload] Successfully uploaded ${fallbackType} to Weavy store:`, uploadRes.data.url);
              return uploadRes.data;
            }
          }
        } catch (upErr: any) {
          console.warn('[Server ⚠️ Asset Upload Warning]', upErr?.response?.data || upErr.message);
        }

        return {
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          url: urlOrData,
          type: fallbackType,
          width: 1024,
          height: 1024,
          viewUrl: urlOrData,
          publicId: '',
          originalUrl: urlOrData,
          thumbnailUrl: urlOrData,
        };
      };

      // Extract image & video attachments
      const mediaList = Array.isArray(attached_media) ? attached_media : (Array.isArray(attachedMedia) ? attachedMedia : []);
      
      // Filter image items and video items
      let imageMediaItems = mediaList.filter((m: any) => m?.type === 'image' || (m?.url && !m.url.includes('.mp4') && !m.url.startsWith('data:video')));
      let videoMediaItem = mediaList.find((m: any) => m?.type === 'video' || (m?.url && (m.url.includes('.mp4') || m.url.startsWith('data:video'))));

      if (Array.isArray(req.body.images)) {
        for (const u of req.body.images) {
          if (typeof u === 'string' && u.trim() && !imageMediaItems.some((item: any) => item.url === u.trim())) {
            imageMediaItems.push({ url: u.trim(), type: 'image' });
          }
        }
      }

      if (imageMediaItems.length === 0 && refImageUrl && !refImageUrl.includes('.mp4') && !refImageUrl.startsWith('data:video')) {
        imageMediaItems.push({ url: refImageUrl, type: 'image' });
      }
      if (!videoMediaItem && req.body.video_url) {
        videoMediaItem = { url: req.body.video_url, type: 'video' };
      }

      // Allow up to 10 reference images for Seedream V5.0, SeeDance 2.5, GPT Image Edit, Nano Banana, or Image Mode
      const maxImages = (isSeedreamV5 || isSeeDance25 || isGptImageEdit || isNanoBanana || req.body.mode === 'image') ? 10 : 1;
      imageMediaItems = imageMediaItems.slice(0, maxImages);

      let imageAssetObjs: any[] = [];
      let videoAssetObj: any = null;

      for (const imgItem of imageMediaItems) {
        if (imgItem?.url) {
          const uploaded = await uploadToWeavyStore(imgItem.url, 'image');
          if (uploaded) imageAssetObjs.push(uploaded);
        }
      }

      if (videoMediaItem?.url) {
        videoAssetObj = await uploadToWeavyStore(videoMediaItem.url, 'video');
      }

      // 2. File Import Nodes (for Image(s) and/or Video)
      const imageFileNodes: any[] = [];
      imageAssetObjs.forEach((asset, idx) => {
        const imgNodeId = `node_file_img_${Date.now()}_${idx}`;
        imageFileNodes.push({
          id: imgNodeId,
          isModel: false,
          type: 'import',
          position: { x: -560, y: 1800 + idx * 250 },
          data: {
            name: `Reference Image ${idx + 1}`,
            color: 'Yambo_Blue',
            files: [asset],
            output: { file: asset },
            result: asset,
            handles: {
              output: { file: { type: 'any', label: 'File', order: 0, format: 'uri', description: 'The uploaded file' } }
            },
            version: 3,
            dark_color: 'Yambo_Blue_Dark',
            border_color: 'Yambo_Blue_Stroke',
            cameraLocked: false,
            selectedIndex: 0
          },
          dragHandle: '.node-header',
          originalName: 'File'
        });
      });

      let videoFileNode: any = null;
      const videoNodeId = `node_file_vid_${Date.now()}`;
      if (videoAssetObj) {
        videoFileNode = {
          id: videoNodeId,
          isModel: false,
          type: 'import',
          position: { x: -560, y: 1800 + imageFileNodes.length * 250 },
          data: {
            name: 'File',
            color: 'Yambo_Blue',
            files: [videoAssetObj],
            output: { file: videoAssetObj },
            result: videoAssetObj,
            handles: {
              output: { file: { type: 'any', label: 'File', order: 0, format: 'uri', description: 'The uploaded file' } }
            },
            version: 3,
            dark_color: 'Yambo_Blue_Dark',
            border_color: 'Yambo_Blue_Stroke',
            cameraLocked: false,
            selectedIndex: 0
          },
          dragHandle: '.node-header',
          originalName: 'File'
        };
      }

      // Build reference inputs, handles, and edges
      const referenceInputs: any[] = [];
      const referenceHandles: any = {};
      const refEdges: any[] = [];

      imageFileNodes.forEach((node, idx) => {
        const refKey = (isGptImage25 || isSeedreamV5 || isNanoBanana)
          ? `image_${idx + 1}`
          : (isGptImageEdit
            ? (idx === 0 ? 'image' : `image_${idx + 1}`)
            : `reference_${idx + 1}`);
        const asset = imageAssetObjs[idx];

        referenceInputs.push([
          {
            id: refKey,
            title: isGptImage25
              ? (idx === 0 ? 'image_1' : `Image ${idx + 1}`)
              : ((isSeedreamV5 || isNanoBanana)
                ? (idx === 0 ? 'image_1' : `Image ${idx + 1}`)
                : (isGptImageEdit ? (idx === 0 ? 'image' : `Image ${idx + 1}`) : `reference ${idx + 1}`)),
            required: !isGptImage25 && idx === 0 && (isSeedreamV5 || isGptImageEdit || isNanoBanana),
            validTypes: ['image', 'video', 'audio', '3D', 'text', 'number', 'boolean', 'seed', 'array', 'lora', 'kling-element', 'runway-aleph2-keyframe'],
            description: isGptImage25
              ? 'Optional image to edit. Connect one or more images to route to edit; leave unconnected to generate from text.'
              : ((isSeedreamV5 || isNanoBanana)
                ? 'The image you want to edit'
                : (isGptImageEdit ? (idx === 0 ? 'Image to edit' : '') : `Reference image ${idx + 1}.`))
          },
          { file: asset, nodeId: node.id, outputId: 'file' }
        ]);

        referenceHandles[refKey] = {
          id: `in_r${idx + 1}_${Date.now()}`,
          type: 'any',
          label: refKey,
          order: idx + 1,
          format: 'uri',
          required: !isGptImage25 && idx === 0 && (isSeedreamV5 || isGptImageEdit || isNanoBanana),
          description: isGptImage25
            ? 'Optional image to edit.'
            : ((isSeedreamV5 || isNanoBanana)
              ? 'The image you want to edit'
              : (isGptImageEdit ? (idx === 0 ? 'Image to edit' : '') : `Reference image ${idx + 1}.`))
        };

        refEdges.push({
          id: `edge_ref_img_${idx + 1}_${Date.now()}`,
          data: {
            sourceColor: 'Yambo_Blue',
            targetColor: (isGptImage25 || isSeedreamV5 || isNanoBanana || isGptImageEdit) ? 'Red' : (isGrokImagine ? 'XAI_Black' : 'Bytedance_Black'),
            sourceHandleType: 'any',
            targetHandleType: (isGptImage25 || isSeedreamV5 || isNanoBanana || isGptImageEdit) ? 'image' : 'any'
          },
          type: 'custom',
          source: node.id,
          target: modelNodeId,
          selected: true,
          sourceHandle: `${node.id}-output-file`,
          targetHandle: `${modelNodeId}-input-${refKey}`
        });
      });

      if (videoFileNode) {
        const vidRefIndex = imageFileNodes.length + 1;
        const refKey = `reference_${vidRefIndex}`;
        referenceInputs.push([
          { id: refKey, title: `reference ${vidRefIndex}`, required: false, validTypes: ['image', 'video', 'audio', '3D', 'text', 'number', 'boolean', 'seed', 'array', 'lora', 'kling-element', 'runway-aleph2-keyframe'], description: 'Reference video.' },
          { file: videoAssetObj, nodeId: videoFileNode.id, outputId: 'file' }
        ]);

        referenceHandles[refKey] = {
          id: `in_rv_${Date.now()}`,
          type: 'any',
          label: `reference ${vidRefIndex}`,
          order: vidRefIndex,
          format: 'uri',
          required: false,
          description: 'Reference video.'
        };

        refEdges.push({
          id: `edge_ref_vid_${Date.now()}`,
          data: { sourceColor: 'Yambo_Blue', targetColor: 'Bytedance_Black', sourceHandleType: 'any', targetHandleType: 'any' },
          type: 'custom',
          source: videoFileNode.id,
          target: modelNodeId,
          selected: true,
          sourceHandle: `${videoFileNode.id}-output-file`,
          targetHandle: `${modelNodeId}-input-${refKey}`
        });
      }

      const refImagesUrls = imageAssetObjs.map((a) => a.url || a.viewUrl || a);

      // 3. Model Node (custommodelV2 matching Weavy canvas recipe structure)
      const seedanceNode: any = {
        id: modelNodeId,
        isModel: true,
        type: 'custommodelV2',
        position: { x: 100, y: 1630 },
        data: {
          kind: {
            type: 'wildcard',
            model: {
              name: activeModelName,
              type: 'predefined',
              service: activeService,
              version: activeModelName,
              description: isGptImage25
                ? 'GPT Image 2.5 (Flare/Sunburst) next-generation high-fidelity image generator & editor.'
                : (isSeedreamV5
                  ? 'ByteDance Seedream V5.0 Edit image generator and editor.'
                  : (isNanoBanana
                    ? "Google's state-of-the-art image generation and editing model"
                    : (isGptImageEdit
                      ? "Edit images with OpenAI's GPT Image 2"
                      : (isGrokImagine
                        ? 'xAI Grok Imagine Image generator.'
                        : (isKlingMotion ? 'Kling 3.0 Pro Motion Control video generator.' : 'Cost-effective video generation from ByteDance.')))))
            },
            inputs: isGptImage25 ? [
              [
                { id: 'prompt', title: 'Prompt', required: true, validTypes: ['text'], description: 'Text description of the image to generate, or the edit to make to the connected images.' },
                { nodeId: textNodeId, outputId: 'text', string: safePrompt }
              ],
              ...imageAssetObjs.map((asset, idx) => [
                { id: `image_${idx + 1}`, title: `Image ${idx + 1}`, required: false, validTypes: ['image'], description: 'Optional image to edit.' },
                { file: asset, nodeId: imageFileNodes[idx].id, outputId: 'file' }
              ])
            ] : (isSeedreamV5 ? [
              [
                { id: 'prompt', title: 'prompt', required: true, validTypes: ['text'], description: 'The text prompt used to edit the image' },
                { nodeId: textNodeId, outputId: 'text', string: safePrompt }
              ],
              ...imageAssetObjs.map((asset, idx) => [
                { id: `image_${idx + 1}`, title: idx === 0 ? 'image_1' : `Image ${idx + 1}`, required: idx === 0, validTypes: ['image'], description: 'The image you want to edit' },
                { file: asset, nodeId: imageFileNodes[idx].id, outputId: 'file' }
              ])
            ] : (isNanoBanana ? [
              [
                { id: 'prompt', title: 'prompt', required: true, validTypes: ['text'], description: 'Description of the edits you want to make' },
                { nodeId: textNodeId, outputId: 'text', string: safePrompt }
              ],
              ...imageAssetObjs.map((asset, idx) => [
                { id: `image_${idx + 1}`, title: `image_${idx + 1}`, required: false, validTypes: ['image'], description: 'The image you want to edit' },
                { file: asset, nodeId: imageFileNodes[idx].id, outputId: 'file' }
              ])
            ] : (isGptImageEdit ? [
              [
                { id: 'prompt', title: 'prompt', required: true, validTypes: ['text'], description: 'Prompt for image edit' },
                { nodeId: textNodeId, outputId: 'prompt', string: safePrompt }
              ],
              ...imageAssetObjs.map((asset, idx) => [
                {
                  id: idx === 0 ? 'image' : `image_${idx + 1}`,
                  title: idx === 0 ? 'image' : `Image ${idx + 1}`,
                  required: idx === 0,
                  validTypes: ['image'],
                  description: idx === 0 ? 'Image to edit' : ''
                },
                { file: asset, nodeId: imageFileNodes[idx].id, outputId: 'file' }
              ])
            ] : (isGrokImagine ? [
              [
                { id: 'prompt', title: 'Prompt', required: true, validTypes: ['text'], description: 'The prompt to generate an image from.' },
                { nodeId: textNodeId, string: safePrompt, outputId: 'text' }
              ],
              ...(imageAssetObjs.length > 0 ? [
                [
                  { id: 'image', title: 'image', required: false, validTypes: ['image'], description: 'Input image to edit.' },
                  { file: imageAssetObjs[0], nodeId: imageFileNodes[0].id, outputId: 'file' }
                ]
              ] : [])
            ] : [
              [
                { id: 'prompt', title: 'Prompt', required: true, validTypes: ['text'], description: 'Text description of the video to generate.' },
                { nodeId: textNodeId, string: safePrompt, outputId: 'text' }
              ],
              ...referenceInputs
            ])))),
            outputs: [
              { id: (isGptImage25 || isSeedreamV5 || isNanoBanana || isGrokImagine) ? 'result' : (isGptImageEdit ? 'image' : 'result'), title: (isGptImage25 || isSeedreamV5 || isNanoBanana || isGrokImagine) ? 'Result' : (isGptImageEdit ? 'image' : 'result'), dataType: (isGptImage25 || isSeedreamV5 || isNanoBanana || isGrokImagine || isGptImageEdit) ? 'image' : 'video', description: (isGptImage25 || isSeedreamV5 || isNanoBanana || isGrokImagine || isGptImageEdit) ? 'The generated image.' : 'Result video.' }
            ],
            parameters: isGptImage25 ? [
              [
                { id: 'model', title: 'Variant', constraint: { type: 'enum', options: ['Flare', 'Sunburst'] }, description: 'Flare is the fast, high-quality default. Sunburst trades longer generation times for tighter control, for production campaign and product imagery.', defaultValue: { type: 'string', value: 'Flare' } },
                { type: 'value', data: { type: 'string', value: req.body.variant || 'Flare' } }
              ],
              [
                { id: 'quality', title: 'Quality', constraint: { type: 'enum', options: ['auto', 'low', 'medium', 'high', 'xhigh', 'max'] }, description: "Higher settings increase detail, latency, and token usage. Use 'auto' to let the model choose.", defaultValue: { type: 'string', value: 'high' } },
                { type: 'value', data: { type: 'string', value: req.body.quality || 'high' } }
              ],
              [
                { id: 'background', title: 'Background', constraint: { type: 'enum', options: ['auto', 'transparent', 'opaque'] }, description: 'Background of the generated image.', defaultValue: { type: 'string', value: 'auto' } },
                { type: 'value', data: { type: 'string', value: 'auto' } }
              ],
              [
                { id: 'image_size', title: 'Image Size', constraint: { type: 'image_size', options: ['square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9', 'auto'] }, description: "Size of the generated image. Use 'auto' to let the model pick, or to infer the size from the connected images when editing.", defaultValue: { type: 'image_size', value: { type: 'built_in', value: 'portrait_16_9' } } },
                { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: seedreamImageSize || 'portrait_16_9' } } }
              ],
              [
                { id: 'output_format', title: 'Output Format', constraint: { type: 'enum', options: ['png', 'jpeg', 'webp'] }, description: 'Output format for the generated image.', defaultValue: { type: 'string', value: 'png' } },
                { type: 'value', data: { type: 'string', value: 'png' } }
              ]
            ] : (isSeedreamV5 ? [
              [
                { id: 'model', title: 'Model', constraint: { type: 'enum', options: ['V4.0', 'V4.5', 'V5.0', 'V5.0 Pro'] }, description: 'Seedream model type', defaultValue: { type: 'string', value: 'V5.0 Pro' } },
                { type: 'value', data: { type: 'string', value: 'V5.0 Pro' } }
              ],
              [
                { id: 'seed', title: 'Seed', constraint: { type: 'seed' }, description: 'Seed value for random number generator. Uncheck for reproducible results.', defaultValue: { type: 'seed', value: { seed: 1, isRandom: false } } },
                { type: 'value', data: { type: 'seed', value: { seed: randomSeed, isRandom: true } } }
              ],
              [
                { id: 'image_size', title: 'Image Size', constraint: { type: 'image_size', options: ['Default', 'square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9', 'auto_2K', 'auto_3K'] }, description: 'The size of the generated image.', defaultValue: { type: 'image_size', value: { type: 'built_in', value: 'match_input' } } },
                { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: seedreamImageSize } } }
              ],
              [
                { id: 'enhance_prompt_mode', title: 'Enhance Prompt Mode', constraint: { type: 'enum', options: ['standard', 'fast'] }, description: 'The mode to use for enhancing prompt.', defaultValue: { type: 'string', value: 'standard' } },
                { type: 'value', data: { type: 'string', value: 'standard' } }
              ]
            ] : (isNanoBanana ? [
              [
                { id: 'seed', title: 'Seed', constraint: { type: 'seed' }, description: 'Seed value for random number generator.', defaultValue: { type: 'seed', value: { seed: 1, isRandom: false } } },
                { type: 'value', data: { type: 'seed', value: { seed: randomSeed, isRandom: true } } }
              ],
              [
                { id: 'resolution', title: 'Resolution', constraint: { type: 'enum', options: ['1K', '2K', '4K'] }, description: 'The resolution of the image to generate.', defaultValue: { type: 'string', value: '1K' } },
                { type: 'value', data: { type: 'string', value: (cleanResolution === '2K' || cleanResolution === '4K') ? cleanResolution : '1K' } }
              ],
              [
                { id: 'aspect_ratio', title: 'Aspect Ratio', constraint: { type: 'enum', options: ['auto', '1:1', '21:9', '16:9', '3:2', '4:3', '5:4', '4:5', '3:4', '2:3', '9:16'] }, description: 'Aspect ratio of the generated image.', defaultValue: { type: 'string', value: 'auto' } },
                { type: 'value', data: { type: 'string', value: cleanAspectRatio || 'auto' } }
              ],
              [
                { id: 'enable_web_search', title: 'Enable Web Search', constraint: { type: 'boolean' }, description: 'Enable web search for the image generation task.', defaultValue: { type: 'boolean', value: false } },
                { type: 'value', data: { type: 'boolean', value: false } }
              ]
            ] : (isGptImageEdit ? [
              [
                { id: 'model', title: 'Model', description: 'GPT model type', constraint: { type: 'enum', options: ['GPT Image 1', 'GPT Image 1.5', 'GPT Image 2'] }, defaultValue: { type: 'string', value: 'GPT Image 2' } },
                { type: 'value', data: { type: 'string', value: 'GPT Image 2' } }
              ],
              [
                { id: 'quality', title: 'Quality', description: "The quality of the image that will be generated.", constraint: { type: 'enum', options: ['auto', 'high', 'medium', 'low'] }, defaultValue: { type: 'string', value: 'medium' } },
                { type: 'value', data: { type: 'string', value: 'medium' } }
              ],
              [
                { id: 'size', title: 'Resolution', description: 'The size of the generated images.', constraint: { type: 'image_size', options: ['Custom', 'auto', '1024x1024', '1536x1024', '1024x1536', '2048x2048', '2048x1152', '3840x2160', '2160x3840'] }, defaultValue: { type: 'image_size', value: { type: 'built_in', value: 'auto' } } },
                { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: 'auto' } } }
              ]
            ] : (isGrokImagine ? [
              [
                { id: 'seed', title: 'Seed', constraint: { type: 'integer' }, description: 'Random seed.', defaultValue: { type: 'integer', value: 0 } },
                { data: { type: 'integer', value: randomSeed }, type: 'value' }
              ],
              [
                { id: 'num_images', title: 'Number of Images', constraint: { max: 4, min: 1, type: 'integer_with_limits' }, defaultValue: { type: 'integer', value: 1 } },
                { data: { type: 'integer', value: 1 }, type: 'value' }
              ],
              [
                { id: 'resolution', title: 'Resolution', constraint: { type: 'enum', options: ['480p', '720p', '1080p', '4k'] }, defaultValue: { type: 'string', value: '1080p' } },
                { data: { type: 'string', value: cleanResolution === '1080p' || cleanResolution === '4k' ? cleanResolution : '1080p' }, type: 'value' }
              ],
              [
                { id: 'aspect_ratio', title: 'Aspect Ratio', constraint: { type: 'enum', options: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'] }, defaultValue: { type: 'string', value: '1:1' } },
                { data: { type: 'string', value: cleanAspectRatio }, type: 'value' }
              ]
            ] : (isKlingMotion ? [
              [
                { id: 'version', title: 'Version', constraint: { type: 'string' }, defaultValue: { type: 'string', value: 'V3.0' } },
                { data: { type: 'string', value: 'V3.0' }, type: 'value' }
              ],
              [
                { id: 'model', title: 'Model', constraint: { type: 'string' }, defaultValue: { type: 'string', value: 'Pro' } },
                { data: { type: 'string', value: 'Pro' }, type: 'value' }
              ],
              [
                { id: 'keep_original_sound', title: 'Keep Original Sound', constraint: { type: 'boolean' }, defaultValue: { type: 'boolean', value: true } },
                { data: { type: 'boolean', value: true }, type: 'value' }
              ],
              [
                { id: 'character_orientation', title: 'Character Orientation', constraint: { type: 'string' }, defaultValue: { type: 'string', value: 'video' } },
                { data: { type: 'string', value: 'video' }, type: 'value' }
              ]
            ] : [
              [
                { id: 'seed', title: 'Seed', constraint: { type: 'integer' }, description: 'Random seed.', defaultValue: { type: 'integer', value: 0 } },
                { data: { type: 'integer', value: randomSeed }, type: 'value' }
              ],
              [
                { id: 'duration', title: 'Duration', constraint: { max: maxDurationLimit, min: 4, type: 'integer_with_limits' }, description: 'Duration of the video in seconds.', defaultValue: { type: 'integer', value: 5 } },
                { data: { type: 'integer', value: numericDuration }, type: 'value' }
              ],
              [
                { id: 'resolution', title: 'Resolution', constraint: { type: 'enum', options: ['480p', '720p'] }, description: 'Output video resolution.', defaultValue: { type: 'string', value: '720p' } },
                { data: { type: 'string', value: cleanResolution }, type: 'value' }
              ],
              [
                { id: 'aspect_ratio', title: 'Aspect Ratio', constraint: { type: 'enum', options: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'] }, description: 'Aspect ratio of the generated video.', defaultValue: { type: 'string', value: '16:9' } },
                { data: { type: 'string', value: cleanAspectRatio }, type: 'value' }
              ],
              [
                { id: 'generate_audio', title: 'Generate Audio', constraint: { type: 'boolean' }, description: 'Generate audio for the video.', defaultValue: { type: 'boolean', value: true } },
                { data: { type: 'boolean', value: shouldGenerateAudio }, type: 'value' }
              ]
            ])))))
          },
          menu: isGptImage25
            ? { icon: 'EmojiObjectsIcon', isModel: true, displayName: 'GPT Image 2.5' }
            : (isSeedreamV5
              ? { icon: 'EmojiObjectsIcon', isModel: true, displayName: 'Seedream V5' }
              : (isNanoBanana
                ? { icon: 'EmojiObjectsIcon', isModel: true, displayName: 'Gemini 3 Pro (with Nano Banana)' }
                : (isGptImageEdit ? { icon: 'EmojiObjectsIcon', isModel: true, displayName: 'GPT Image 1' } : null))),
          name: isGptImage25 ? 'GPT Image 2.5' : (isSeedreamV5 ? 'Seedream V5.0 Edit' : (isNanoBanana ? 'Gemini 3 (Nano Banana Pro)' : activeDisplayName)),
          paid: 4,
          color: (isGptImage25 || isSeedreamV5 || isNanoBanana || isGptImageEdit) ? 'Red' : (isGrokImagine ? 'XAI_Black' : (isKlingMotion ? 'Kling_Red' : 'Bytedance_Black')),
          input: {
            prompt: safePrompt,
            ...(isGptImage25 || isSeedreamV5 || isNanoBanana
              ? imageAssetObjs.reduce((acc, asset, idx) => {
                  acc[`image_${idx + 1}`] = asset;
                  return acc;
                }, {} as Record<string, any>)
              : (isGptImageEdit
                ? imageAssetObjs.reduce((acc, asset, idx) => {
                    acc[idx === 0 ? 'image' : `image_${idx + 1}`] = asset;
                    return acc;
                  }, {} as Record<string, any>)
                : (imageAssetObjs.length > 0 ? { image_url: refImagesUrls[0], image: imageAssetObjs[0] } : {})
              )
            ),
            ...(videoAssetObj ? { video_url: videoAssetObj.url || videoAssetObj } : {})
          },
          label: null,
          model: { name: activeModelName, ...(isGptImageEdit ? {} : { service: activeService, version: activeModelName }) },
          output: {},
          params: isGptImage25 ? {
            model: req.body.variant || 'Flare',
            prompt: safePrompt,
            quality: req.body.quality || 'high',
            background: 'auto',
            image_size: seedreamImageSize || 'portrait_16_9',
            output_format: 'png',
            ...imageAssetObjs.reduce((acc, asset, idx) => {
              acc[`image_${idx + 1}`] = asset;
              return acc;
            }, {} as Record<string, any>)
          } : (isSeedreamV5 ? {
            model: 'V5.0 Pro',
            seed: { seed: randomSeed, isRandom: true },
            image_size: seedreamImageSize,
            enhance_prompt_mode: 'standard',
            enable_safety_checker: true,
            num_images: 1,
            max_images: 1,
            prompt: safePrompt,
            ...imageAssetObjs.reduce((acc, asset, idx) => {
              acc[`image_${idx + 1}`] = asset;
              return acc;
            }, {} as Record<string, any>)
          } : (isNanoBanana ? {
            seed: { seed: randomSeed, isRandom: true },
            resolution: (cleanResolution === '2K' || cleanResolution === '4K') ? cleanResolution : '1K',
            aspect_ratio: cleanAspectRatio || 'auto',
            output_format: 'png',
            enable_web_search: false,
            prompt: safePrompt,
            num_images: 1,
            ...imageAssetObjs.reduce((acc, asset, idx) => {
              acc[`image_${idx + 1}`] = asset;
              return acc;
            }, {} as Record<string, any>)
          } : (isGptImageEdit ? {
            size: 'auto',
            model: 'GPT Image 2',
            quality: 'medium',
            number_of_images: 1,
            prompt: safePrompt,
            ...imageAssetObjs.reduce((acc, asset, idx) => {
              acc[idx === 0 ? 'image' : `image_${idx + 1}`] = asset;
              return acc;
            }, {} as Record<string, any>)
          } : (isGrokImagine ? {
            seed: randomSeed,
            prompt: safePrompt,
            num_images: 1,
            resolution: cleanResolution === '1080p' || cleanResolution === '4k' ? cleanResolution : '1080p',
            aspect_ratio: cleanAspectRatio,
            ...(imageAssetObjs.length > 0 ? { image: imageAssetObjs[0].url || imageAssetObjs[0].viewUrl || imageAssetObjs[0] } : {})
          } : (isKlingMotion ? {
            version: 'V3.0',
            model: 'Pro',
            prompt: safePrompt,
            keep_original_sound: true,
            character_orientation: 'video',
            image_url: imageAssetObjs.length > 0 ? (refImagesUrls[0]) : (refImageUrl || ''),
            video_url: videoAssetObj ? (videoAssetObj.url || videoAssetObj.viewUrl || videoAssetObj.originalUrl || '') : (req.body.video_url || '')
          } : {
            seed: randomSeed,
            prompt: safePrompt,
            duration: numericDuration,
            resolution: cleanResolution,
            aspect_ratio: cleanAspectRatio,
            generate_audio: shouldGenerateAudio,
            reference_audios: [],
            reference_images: refImagesUrls,
            reference_videos: videoAssetObj ? [videoAssetObj.url] : [],
            ...(imageAssetObjs.length > 0 ? { reference_1: imageAssetObjs[0] } : {})
          }))))),
          result: [],
          schema: isGptImage25 ? {
            model: { type: 'enum', title: 'Variant', default: 'Flare', options: ['Flare', 'Sunburst'], description: 'Flare is fast, high-quality default. Sunburst trades longer generation times for tighter control.' },
            quality: { type: 'enum', title: 'Quality', default: 'high', options: ['auto', 'low', 'medium', 'high', 'xhigh', 'max'] },
            background: { type: 'enum', title: 'Background', default: 'auto', options: ['auto', 'transparent', 'opaque'] },
            image_size: { type: 'image_size', title: 'Image Size', default: 'portrait_16_9', options: ['square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9', 'auto'] },
            output_format: { type: 'enum', title: 'Output Format', default: 'png', options: ['png', 'jpeg', 'webp'] }
          } : (isSeedreamV5 ? {
            model: { type: 'enum', title: 'Model', default: 'V5.0 Pro', options: ['V4.0', 'V4.5', 'V5.0', 'V5.0 Pro'], required: false, description: 'Seedream model type' },
            seed: { type: 'seed', title: 'Seed', required: false, description: 'Seed value for random number generator.' },
            image_size: { type: 'image_size', title: 'Image Size', default: 'portrait_16_9', options: ['Default', 'square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9', 'auto_2K', 'auto_3K'], required: false, description: 'The size of the generated image.' },
            enhance_prompt_mode: { type: 'enum', title: 'Enhance Prompt Mode', default: 'standard', options: ['standard', 'fast'], required: false, description: 'The mode to use for enhancing prompt.' }
          } : (isNanoBanana ? {
            seed: { type: 'seed', title: 'Seed', required: false, description: 'Seed value for random number generator. Uncheck for reproducible results.' },
            resolution: { type: 'enum', title: 'Resolution', default: '1K', options: ['1K', '2K', '4K'], required: false, description: 'The resolution of the image to generate.' },
            aspect_ratio: { type: 'enum', order: 0, title: 'Aspect Ratio', default: 'auto', options: ['auto', '1:1', '21:9', '16:9', '3:2', '4:3', '5:4', '4:5', '3:4', '2:3', '9:16'], required: false, description: 'Aspect ratio of the generated image.' },
            enable_web_search: { type: 'boolean', title: 'Enable Web Search', default: false, required: false, description: 'Enable web search for the image generation task.' }
          } : (isGptImageEdit ? {
            size: { type: 'fal_image_size', order: 9, title: 'Resolution', default: 'auto', options: ['Custom', 'auto', '1024x1024', '1536x1024', '1024x1536', '2048x2048', '2048x1152', '3840x2160', '2160x3840'], description: 'The size of the generated images.' },
            model: { type: 'enum', order: 0, title: 'Model', default: 'GPT Image 2', options: ['GPT Image 1', 'GPT Image 1.5', 'GPT Image 2'], description: 'GPT model type' },
            quality: { type: 'enum', order: 7, title: 'Quality', default: 'medium', options: ['auto', 'high', 'medium', 'low'], description: 'The quality of the image that will be generated.' }
          } : (isGrokImagine ? {
            seed: { type: 'integer', title: 'Seed', required: false, description: 'Random seed.' },
            prompt: { type: 'string', title: 'Prompt', required: true, description: 'Text prompt.' },
            num_images: { type: 'integer', title: 'Number of Images', default: 1 },
            resolution: { type: 'enum', title: 'Resolution', default: '1080p', options: ['480p', '720p', '1080p', '4k'] },
            aspect_ratio: { type: 'enum', title: 'Aspect Ratio', default: '1:1', options: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'] }
          } : (isKlingMotion ? {
            version: { type: 'string', title: 'Version', default: 'V3.0' },
            model: { type: 'string', title: 'Model', default: 'Pro' },
            prompt: { type: 'string', title: 'Prompt', required: true },
            keep_original_sound: { type: 'boolean', default: true },
            character_orientation: { type: 'string', default: 'video' }
          } : {
            seed: { type: 'integer', title: 'Seed', required: false, description: 'Random seed.' },
            prompt: { type: 'string', title: 'Prompt', required: true, description: 'Text description of the video to generate.' },
            duration: { max: maxDurationLimit, min: 4, type: 'integer', title: 'Duration', default: 5, required: false, description: 'Duration of the video in seconds.' },
            resolution: { type: 'enum', title: 'Resolution', default: '720p', options: ['480p', '720p'], required: false, description: 'Output video resolution.' },
            aspect_ratio: { type: 'enum', title: 'Aspect Ratio', default: '16:9', options: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'], required: false, description: 'Aspect ratio of the generated video.' },
            generate_audio: { type: 'boolean', title: 'Generate Audio', default: true, required: false, description: 'Generate audio for the video.' }
          }))))),
          handles: {
            input: (isGptImage25 || isSeedreamV5 || isNanoBanana) ? {
              prompt: { id: `in_p_${Date.now()}`, type: 'text', label: 'prompt', order: 0, format: 'text', required: true, description: 'The text prompt used to edit the image' },
              ...imageAssetObjs.reduce((acc, asset, idx) => {
                const key = `image_${idx + 1}`;
                acc[key] = {
                  id: `in_img_${idx + 1}_${Date.now()}`,
                  type: 'image',
                  label: key,
                  order: idx + 1,
                  format: 'uri',
                  required: !isGptImage25 && idx === 0,
                  description: 'The image you want to edit'
                };
                return acc;
              }, {} as Record<string, any>)
            } : (isGptImageEdit ? {
              prompt: { id: `in_p_${Date.now()}`, type: 'text', label: 'prompt', order: 0, format: 'text', required: true, description: 'Prompt for image edit' },
              ...imageAssetObjs.reduce((acc, asset, idx) => {
                const key = idx === 0 ? 'image' : `image_${idx + 1}`;
                acc[key] = {
                  id: `in_img${idx === 0 ? '' : `_${idx + 1}`}_${Date.now()}`,
                  type: 'image',
                  label: key,
                  order: idx + 1,
                  format: 'uri',
                  required: idx === 0,
                  description: idx === 0 ? 'Image to edit' : ''
                };
                return acc;
              }, {} as Record<string, any>)
            } : (isGrokImagine ? {
              prompt: { id: `in_p_${Date.now()}`, type: 'text', label: 'Prompt', order: 0, format: 'text', required: true, description: 'Prompt to generate an image from.' },
              ...(imageFileNodes.length > 0 ? {
                image: { id: `in_img_${Date.now()}`, type: 'any', label: 'image', order: 1, format: 'uri', required: false, description: 'Input image to edit.' }
              } : {})
            } : {
              prompt: { id: `in_p_${Date.now()}`, type: 'text', label: 'Prompt', order: 0, format: 'text', required: true, description: 'Text description of the video to generate.' },
              ...referenceHandles
            })),
            output: {
              ...(isGptImage25 || isSeedreamV5 || isNanoBanana || isGrokImagine ? {
                result: { id: `out_r_${Date.now()}`, type: 'image', label: 'result', order: 0, format: 'uri', description: 'Result image' }
              } : (isGptImageEdit ? {
                image: { id: `out_r_${Date.now()}`, type: 'image', label: 'image', order: 0, format: 'uri', description: 'Result image' }
              } : {
                result: { id: `out_r_${Date.now()}`, type: 'video', label: 'result', order: 0, format: 'uri', description: 'Result video.' }
              }))
            }
          },
          version: 3,
          description: isGptImage25
            ? 'GPT Image 2.5 (Flare/Sunburst) next-generation high-fidelity image generator & editor.'
            : (isSeedreamV5
              ? 'ByteDance Seedream V5.0 Edit image generator and editor.'
              : (isNanoBanana
                ? "Google's state-of-the-art image generation and editing model\n"
                : (isGptImageEdit
                  ? "Edit images with OpenAI's GPT Image 2"
                  : (isGrokImagine ? 'xAI Grok Imagine Image generator.' : (isKlingMotion ? 'Kling 3.0 Pro Motion Control video generator.' : 'Cost-effective video generation from ByteDance.'))))),
          generations: [],
          cameraLocked: false,
          selectedIndex: 0,
          selectedOutput: 0
        },
        dragHandle: '.node-header',
        originalName: activeDisplayName
      };

      // 4. Edges Linking Nodes
      const edges: any[] = [
        {
          id: `edge_prompt_${Date.now()}`,
          data: { sourceColor: 'Yambo_Green', targetColor: (isGptImage25 || isSeedreamV5 || isNanoBanana || isGptImageEdit) ? 'Red' : (isGrokImagine ? 'XAI_Black' : 'Bytedance_Black'), sourceHandleType: 'text', targetHandleType: 'text' },
          type: 'custom',
          source: textNodeId,
          target: modelNodeId,
          selected: true,
          sourceHandle: `${textNodeId}-output-text`,
          targetHandle: `${modelNodeId}-input-prompt`
        },
        ...refEdges
      ];

      const allNodes = [textNode, ...imageFileNodes, ...(videoFileNode ? [videoFileNode] : []), seedanceNode];

      // Step 4: SAVE RECIPE
      try {
        await axios.post(
          `https://api.weavy.ai/api/v1/recipes/${recipeId}/save`,
          {
            nodes: allNodes,
            edges: edges,
            v3: true,
            lastUpdatedAt: new Date().toISOString(),
          },
          {
            headers: {
              ...headers,
              'x-app-recipeid': recipeId,
            },
            timeout: 30000,
          }
        );
        console.log('[Server] Recipe canvas Graph berhasil di-SAVE!');
      } catch (saveErr: any) {
        console.warn('[Server] Save recipe warning:', saveErr?.response?.data || saveErr.message);
      }

      // Step 5: Execute Recipe
      let executeRes;
      const execHeaders = {
        ...headers,
        'x-app-recipeid': recipeId,
      };

      const execPayload = {
        numberOfRuns: 1,
        nodes: allNodes,
        edges: edges,
      };

      const runExecuteCall = async () => {
        try {
          return await axios.post(
            `https://api.weavy.ai/api/v1/batches/recipes/${recipeId}/execute`,
            execPayload,
            { headers: execHeaders, timeout: 45000 }
          );
        } catch (bErr) {
          return await axios.post(
            `https://api.weavy.ai/api/v1/recipes/${recipeId}/execute`,
            execPayload,
            { headers: execHeaders, timeout: 45000 }
          );
        }
      };

      try {
        executeRes = await runExecuteCall();
      } catch (execErr: any) {
        if (
          execErr?.response?.status === 403 ||
          (execErr?.response?.data?.message && execErr?.response?.data?.message.toLowerCase().includes('notice'))
        ) {
          console.log('[Server] Notice required detected on execute. Auto-approving & re-running...');
          try {
            await axios.post(
              'https://api.weavy.ai/api/v1/workspaces/models/approve',
              { modelIds: [activeModelName] },
              { headers, timeout: 15000 }
            );
          } catch (e) {}

          executeRes = await runExecuteCall();
        } else {
          throw execErr;
        }
      }

      const taskId = executeRes.data?.batchId || executeRes.data?.runId || executeRes.data?.id || `task_${Date.now().toString(36)}`;
      console.log(`[Server 🚀 Execute Success] Task generasi berhasil dikirim! recipeId: ${recipeId}, nodeId: ${modelNodeId}, taskId: ${taskId}`);

      return res.json({
        success: true,
        recipeId,
        nodeId: modelNodeId,
        taskId,
        message: 'Task generasi SeeDance 2.0 Mini berhasil dikirim ke Weavy AI.',
      });
    } catch (error: any) {
      console.error('[Server] Generate Error:', error?.response?.data || error?.message);
      const errDetail = cleanErrorMessage(error);
      return res.status(200).json({
        success: false,
        error: errDetail,
      });
    }
  });

  // Prompt Enhancer & Any LLM Endpoint (Supports text generation, expansion & multimodal image analysis via Weavy Account or Gemini)
  app.post('/api/enhance-prompt', async (req, res) => {
    const streamRequested = req.body?.streamResponse === true && req.body?.provider === 'gemini';
    let streamHeartbeat: NodeJS.Timeout | undefined;
    const sendStreamEvent = (event: Record<string, unknown>) => {
      if (streamRequested && !res.writableEnded) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    };
    try {
      const {
        prompt,
        systemPrompt,
        model = 'google/gemini-3-pro',
        imageUrl,
        images = [],
        temperature,
        thinking,
        refreshToken,
        idToken,
        allRefreshTokens,
        nodeType,
        isAnyLLM: isAnyLLMFlag,
        extraContext,
      } = req.body;

      const isAnyLLM = Boolean(
        isAnyLLMFlag ||
        nodeType === 'anyLLM' ||
        (typeof model === 'string' && (model.startsWith('anthropic/') || model.startsWith('meta-llama/') || model.includes('gemini-3') || (model.includes('gpt-') && !model.includes('sol'))))
      );

      const safePrompt = (typeof prompt === 'string' && prompt.trim()) ? prompt.trim() : '';

      const defaultSystemPrompt = isAnyLLM
        ? 'You are a versatile, highly intelligent multimodal AI assistant with expert mastery in text generation, prompt engineering, visual analysis, storytelling, coding, and problem solving. Write responses clearly, thoroughly, and helpfully.'
        : 'You are an elite visual art director and architectural prompt engineer. Enhance the user\'s input into a master-grade, authentic photographic prompt in English. CRITICAL RULES: Never use generic buzzwords ("photorealistic, hyperrealistic, 8k, octane render, unreal engine"). Instead, ground the prompt in tangible physical reality: specify realistic camera and lens (e.g. Sony Alpha A7 IV or 35mm f/4), tangible tactile materials (e.g. natural oak grain, matte lime-wash plaster, organic linen weave), authentic physical lighting (e.g. diffused natural morning window light, subtle soft bounce, true contact shadows), and lived-in imperfections. Return ONLY the enhanced prompt string without quotes, introductory text, markdown hashtags, or explanations.';

      const baseSystemPrompt = (typeof systemPrompt === 'string' && systemPrompt.trim())
        ? systemPrompt.trim()
        : defaultSystemPrompt;
      // Konteks tambahan (mis. [KONTEKS STORYBOARD AKTIF]) ikut ke system prompt agar jalur
      // server/Gemini Web setara dengan jalur bridge ekstensi.
      const safeSystemPrompt = (typeof extraContext === 'string' && extraContext.trim())
        ? `${baseSystemPrompt}\n\n${extraContext.trim()}`
        : baseSystemPrompt;

      const imagesToProcess: string[] = [];
      if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
        imagesToProcess.push(imageUrl.trim());
      }
      if (Array.isArray(images)) {
        for (const img of images) {
          if (typeof img === 'string' && img.trim() && !imagesToProcess.includes(img.trim())) {
            imagesToProcess.push(img.trim());
          }
        }
      }

      if (!safePrompt && imagesToProcess.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Prompt teks atau gambar input wajib disediakan.',
        });
      }

      if (streamRequested) {
        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        sendStreamEvent({ type: 'progress', message: 'Menyiapkan sesi Gemini Web...' });
        streamHeartbeat = setInterval(() => {
          sendStreamEvent({ type: 'progress', message: 'Masih menunggu respons Gemini Web...' });
        }, 15000);
        res.on('close', () => {
          if (streamHeartbeat) clearInterval(streamHeartbeat);
        });
      }

      // Execute Weavy Any LLM if user explicitly selected Weavy or provider defaults to Weavy with active tokens
      const isExplicitWeavy = req.body?.provider === 'weavy';
      const isExplicitGemini = req.body?.provider === 'gemini';
      const hasWeavyToken = Boolean(refreshToken || (Array.isArray(allRefreshTokens) && allRefreshTokens.length > 0) || idToken);
      const shouldExecuteWeavy = isExplicitWeavy || (!isExplicitGemini && hasWeavyToken && nodeType === 'anyLLM');

      if (shouldExecuteWeavy) {
        try {
          const weavyResult = await executeWeavyAnyLLM({
            messages: [{ role: 'user', content: safePrompt }],
            model,
            mode: isAnyLLM ? 'canvas' : 'enhance',
            systemPrompt: safeSystemPrompt,
            thinking: Boolean(thinking),
            temperature: typeof temperature === 'number' ? temperature : (isAnyLLM ? 0.7 : 0),
            refreshToken,
            idToken,
            allRefreshTokens,
            imageUrl: imagesToProcess[0] || undefined,
            images: imagesToProcess,
          });

          return res.json({
            success: true,
            enhancedPrompt: weavyResult.text,
            text: weavyResult.text,
            provider: 'weavy',
            model: weavyResult.model || model,
            remainingCredits: weavyResult.remainingCredits,
          });
        } catch (weavyErr: any) {
          console.warn('[Enhance Prompt / Any LLM] Weavy execution error:', weavyErr.message);
          if (isExplicitWeavy) {
            return res.status(500).json({
              success: false,
              error: `Gagal menjalankan Weavy Any LLM (${model}): ${weavyErr.message || 'Pastikan akun Weavy aktif dan memiliki kredit.'}`,
            });
          }
        }
      }

      console.log(`[Prompt/LLM Enhancer] Processing prompt with Gemini engine: ${model}, images count: ${imagesToProcess.length}`);

      const rawToken = String(req.body.cookies || req.body.token || req.body.refreshToken || '').trim();
      const isCookies = Boolean(req.body.cookies) || rawToken.includes('__Secure') || rawToken.includes('SID=') || rawToken.includes('SAPISID=');

      let effectiveCookies = isCookies ? (req.body.cookies || rawToken) : undefined;

      if (!effectiveCookies) {
        try {
          const { extractCookiesOrApiKey } = require('./server/providers/gemini');
          const ext = extractCookiesOrApiKey(rawToken);
          if (ext && ext.cookies) {
            effectiveCookies = ext.cookies;
          }
        } catch (e) {}
      }

      if (!effectiveCookies) {
        try {
          const { DEFAULT_COOKIES } = require('./script-gemini/gemini_chat.cjs');
          if (DEFAULT_COOKIES && (DEFAULT_COOKIES.includes('__Secure') || DEFAULT_COOKIES.includes('SID='))) {
            effectiveCookies = DEFAULT_COOKIES;
          }
        } catch (e) {}
      }

      // Gemini account operations must use the user's Google Web session, never an API key.
      if (effectiveCookies) {
        try {
          console.log('[Prompt/LLM Enhancer] Generating with Gemini Web Client (Google Session)...');
          const { GeminiWebClient } = require('./script-gemini/gemini_chat.cjs');
          const client = new GeminiWebClient(effectiveCookies);
          sendStreamEvent({ type: 'progress', message: 'Menghubungkan akun ke Gemini Web...' });
          await client.initSession();
          const combinedPrompt = safeSystemPrompt
            ? `${safeSystemPrompt}\n\nTask / User Request:\n${safePrompt}`
            : safePrompt;
          // Gemini Web ignores image URLs unless they are uploaded to its media store
          // and passed as the fifth streamMessage argument. Never silently run text-only
          // when Storyboard Copilot has connected reference images.
          let imageAttachments: Array<{ path: string; name: string }> = [];
          if (imagesToProcess.length > 0) {
            sendStreamEvent({ type: 'progress', message: 'Mengunggah gambar referensi ke Gemini...' });
            for (const [index, imageRef] of imagesToProcess.slice(0, 5).entries()) {
              try {
                let imageBuffer: Buffer;
                let mimeType = 'image/jpeg';
                if (imageRef.startsWith('data:')) {
                  const match = imageRef.match(/^data:([^;]+);base64,(.+)$/);
                  if (!match) throw new Error('Format data URL gambar tidak valid');
                  mimeType = match[1] || mimeType;
                  imageBuffer = Buffer.from(match[2], 'base64');
                } else if (/^https?:\/\//i.test(imageRef)) {
                  const imgResp = await axios.get(imageRef, { responseType: 'arraybuffer', timeout: 15000 });
                  mimeType = String(imgResp.headers['content-type'] || mimeType).split(';')[0];
                  imageBuffer = Buffer.from(imgResp.data);
                } else {
                  throw new Error('Sumber gambar harus berupa URL HTTP(S) atau data URL');
                }
                if (!mimeType.startsWith('image/')) throw new Error(`Tipe file bukan gambar: ${mimeType}`);
                const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
                const remotePath = await client.uploadImage(imageBuffer, `storyboard_reference_${index + 1}.${ext}`, mimeType);
                imageAttachments.push({ path: remotePath, name: `storyboard_reference_${index + 1}.${ext}` });
              } catch (imageErr: any) {
                throw new Error(`Gagal mengunggah gambar referensi ${index + 1}; storyboard dibatalkan agar tidak dibuat tanpa analisis visual. ${imageErr?.message || ''}`);
              }
            }
          }
          sendStreamEvent({ type: 'progress', message: 'Storyboard dikirim; menunggu Gemini mulai menjawab...' });
          let responseStarted = false;
          const webRes = await client.streamMessage(
            combinedPrompt,
            (event: { type?: string }) => {
              if (!responseStarted && event.type === 'chunk') {
                responseStarted = true;
                sendStreamEvent({ type: 'progress', message: 'Gemini mulai menghasilkan storyboard...' });
              }
            },
            true,
            1,
            imageAttachments.length ? imageAttachments : null,
            false,
            false,
            300000,
          );
          if (webRes && webRes.text) {
            const rawText = webRes.text.trim();
            if (!rawText) {
              throw new Error('Gemini Web selesai tanpa mengembalikan teks storyboard.');
            }
            if (rawText.length < 300 && /i encountered an error|something went wrong|an error occurred|terjadi kesalahan/i.test(rawText)) {
              throw new Error(`Gemini Web mengembalikan kendala internal: "${rawText}"`);
            }
            const result = {
              success: true,
              enhancedPrompt: rawText,
              text: rawText,
              provider: 'gemini',
              model: model || 'gemini-web-direct',
              originalPrompt: safePrompt,
            };
            if (streamRequested) {
              sendStreamEvent({ type: 'result', result });
              if (streamHeartbeat) clearInterval(streamHeartbeat);
              return res.end();
            }
            return res.json(result);
          }
          throw new Error('Gemini Web selesai tanpa mengembalikan teks storyboard.');
        } catch (webErr: any) {
          console.error('[Prompt/LLM Enhancer] Gemini Web Client failed:', webErr.message);
          if (streamRequested) {
            sendStreamEvent({
              type: 'error',
              error: `Gemini Web gagal memproses Storyboard: ${webErr.message || 'koneksi ke Gemini Web gagal.'}`,
            });
            if (streamHeartbeat) clearInterval(streamHeartbeat);
            return res.end();
          }
          return res.status(502).json({
            success: false,
            error: `Gemini Web gagal memproses Storyboard: ${webErr.message || 'koneksi ke Gemini Web gagal.'}`,
          });
        }
      }

      // If neither worked
      const noSessionError = 'Tidak ada sesi Gemini Web yang aktif. Hubungkan akun Google Gemini dengan cookie sesi di Pengaturan, atau pilih provider Weavy.';
      if (streamRequested) {
        sendStreamEvent({ type: 'error', error: noSessionError });
        if (streamHeartbeat) clearInterval(streamHeartbeat);
        return res.end();
      }
      return res.status(400).json({
        success: false,
        error: noSessionError,
      });
    } catch (err: any) {
      if (streamHeartbeat) clearInterval(streamHeartbeat);
      console.error('[Prompt Enhancer] Error:', err.response?.data || err.message);
      const errMsg = err.response?.data?.error?.message || err.message || 'Gagal melakukan enhance prompt.';
      if (streamRequested && res.headersSent) {
        sendStreamEvent({ type: 'error', error: errMsg });
        return res.end();
      }
      return res.status(500).json({
        success: false,
        error: errMsg,
      });
    }
  });

  // Dedicated in-memory cache for Weavy Chat LLM recipe per user account
  const weavyChatRecipeCache = new Map<string, string>();

  // Helper to upload base64 or external images to Weavy assets storage
  async function uploadImageToWeavyStore(
    imageInput: string | any,
    idToken: string
  ): Promise<any | null> {
    if (!imageInput) return null;
    if (typeof imageInput === 'object' && imageInput.url) {
      if (imageInput.url.includes('media.weavy.ai') && imageInput.id && imageInput.width) {
        return imageInput;
      }
      imageInput = imageInput.url;
    }
    if (typeof imageInput !== 'string') return null;
    const trimmed = imageInput.trim();
    if (trimmed.includes('media.weavy.ai')) {
      return {
        type: 'image',
        url: trimmed,
        width: 1024,
        height: 1024,
        thumbnailUrl: trimmed,
        publicId: '',
        id: `img_${Date.now()}`,
        name: `image_${Date.now()}.png`,
      };
    }
    try {
      let buffer: Buffer | null = null;
      let contentType = 'image/jpeg';
      let filename = `upload_${Date.now()}.jpg`;

      if (trimmed.startsWith('data:')) {
        const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          contentType = match[1] || 'image/jpeg';
          buffer = Buffer.from(match[2], 'base64');
          const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
          filename = `upload_${Date.now()}.${ext}`;
        }
      } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const resp = await axios.get(trimmed, { responseType: 'arraybuffer', timeout: 15000 });
        contentType = String(resp.headers['content-type'] || 'image/jpeg').split(';')[0];
        buffer = Buffer.from(resp.data);
        const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
        filename = `upload_${Date.now()}.${ext}`;
      }

      if (!buffer) return null;

      const form = new FormData();
      form.append('file', buffer, {
        filename,
        contentType,
        knownLength: buffer.length,
      });

      const uploadRes = await axios.post('https://api.weavy.ai/api/v1/assets/upload', form, {
        headers: {
          Authorization: `Bearer ${idToken}`,
          'X-Weavy-Auth-Provider': 'firebase',
          'x-app-version': '4.1.1316',
          'Origin': 'https://app.weavy.ai',
          'Referer': 'https://app.weavy.ai/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          ...form.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 30000,
      });

      if (uploadRes.data && uploadRes.data.url) {
        return {
          type: uploadRes.data.type || 'image',
          url: uploadRes.data.url,
          width: uploadRes.data.width || 1024,
          height: uploadRes.data.height || 1024,
          thumbnailUrl: uploadRes.data.thumbnailUrl || uploadRes.data.url,
          publicId: uploadRes.data.publicId || '',
          id: uploadRes.data.id || `img_${Date.now()}`,
          name: uploadRes.data.name || filename,
          ...uploadRes.data,
        };
      }
    } catch (err: any) {
      console.warn('[Weavy Upload Helper] Gagal upload gambar ke Weavy store:', err?.message);
    }
    return null;
  }

  // Helper to scrape web pages, e-commerce links (Tokopedia, TikTok Shop, Shopee), articles, and media
  interface ScrapedWebInfo {
    url: string;
    finalUrl: string;
    title?: string;
    description?: string;
    imageUrl?: string;
    images?: string[];
    price?: string;
    rating?: string;
    seller?: string;
    textContent?: string;
    isMedia?: boolean;
    videoUrl?: string;
    videoPlaybackUrl?: string;
    videoCover?: string;
    videoDuration?: number | string;
    videoAuthor?: string;
    videoFallbackNote?: string;
    hasPlayableVideo?: boolean;
  }

  async function scrapeWebMetadata(targetUrl: string): Promise<ScrapedWebInfo | null> {
    try {
      const cleanUrl = targetUrl.trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        return null;
      }

      console.log(`[Web Scraper] Memeriksa & mengekstrak konten URL: ${cleanUrl}...`);
      const allExtractedImages: string[] = [];

      const addImg = (u?: string) => {
        if (!u || typeof u !== 'string') return;
        let trimmed = u.trim();
        if (
          trimmed.startsWith('http') &&
          !trimmed.includes('avatar') &&
          !trimmed.includes('blank.gif') &&
          !trimmed.includes('pixel') &&
          !trimmed.includes('tracking')
        ) {
          // Upgrade Tokopedia thumbnail to HD
          trimmed = trimmed.replace(/\/cache\/(?:200-square|300|500)\//, '/cache/900/');
          // Upgrade Shopee thumbnail
          trimmed = trimmed.replace(/_tn$/, '');
          // Upgrade TikTok/Tokopedia WebP
          if (trimmed.includes('resize-webp:260:260.webp')) {
            trimmed = trimmed.replace(/resize-webp:260:260\.webp/i, 'resize-webp:800:800.webp');
          }
          if (!allExtractedImages.includes(trimmed)) {
            allExtractedImages.push(trimmed);
          }
        }
      };

      // 0. Check for direct video stream URLs (.mp4, .webm, .mov, .m4v, .mkv)
      if (cleanUrl.match(/\.(mp4|webm|mov|m4v|mkv)(\?.*)?$/i)) {
        const rawFileName = cleanUrl.split('/').pop()?.split('?')[0] || 'video_stream.mp4';
        return {
          url: cleanUrl,
          finalUrl: cleanUrl,
          title: rawFileName,
          description: 'File video direct stream untuk pemutaran langsung di chat',
          imageUrl: '',
          images: [],
          isMedia: true,
          hasPlayableVideo: true,
          videoUrl: cleanUrl,
          videoPlaybackUrl: `/api/proxy-video?url=${encodeURIComponent(cleanUrl)}`,
          videoAuthor: 'Direct Video Stream',
        };
      }

      // 1. Handle TikTok video links via TikWM API (high-definition direct video extraction)
      if (
        (cleanUrl.includes('tiktok.com/') || cleanUrl.includes('vt.tiktok.com/')) &&
        !cleanUrl.includes('shop-id.tokopedia.com') &&
        !cleanUrl.includes('vt.tokopedia.com')
      ) {
        try {
          const tikRes = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}&hd=1`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 15000,
          });
          if (tikRes.data?.data) {
            const v = tikRes.data.data;
            addImg(v.cover);
            addImg(v.origin_cover);
            if (Array.isArray(v.images)) {
              v.images.forEach((img: string) => addImg(img));
            }

            // Extract direct video URL (hdplay, play, wmplay)
            let rawVideoUrl = v.hdplay || v.play || v.wmplay || '';
            if (rawVideoUrl && !rawVideoUrl.startsWith('http')) {
              rawVideoUrl = `https://www.tikwm.com${rawVideoUrl}`;
            }

            let playableVideoUrl = '';
            let videoFallbackNote: string | undefined;

            if (rawVideoUrl) {
              const videoId = v.id || Date.now().toString();
              const cacheFileName = `tiktok_${videoId}.mp4`;
              const cacheFilePath = path.join(mediaCacheDir, cacheFileName);
              const localCacheUrl = `/media-cache/${cacheFileName}`;

              if (fs.existsSync(cacheFilePath)) {
                playableVideoUrl = localCacheUrl;
              } else {
                try {
                  console.log(`[Web Scraper] Mengunduh & menyimpan video TikTok (${videoId}) ke cache lokal...`);
                  const vidBufferRes = await axios.get(rawVideoUrl, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                      'Referer': 'https://www.tikwm.com/',
                    },
                    responseType: 'arraybuffer',
                    timeout: 20000,
                  });
                  fs.writeFileSync(cacheFilePath, Buffer.from(vidBufferRes.data));
                  playableVideoUrl = localCacheUrl;
                  console.log(`[Web Scraper] Video TikTok berhasil disimpan ke: ${localCacheUrl}`);
                } catch (cacheErr: any) {
                  console.warn(`[Web Scraper] Caching lokal gagal (${cacheErr.message}), menggunakan proxy-video fallback`);
                  playableVideoUrl = `/api/proxy-video?url=${encodeURIComponent(rawVideoUrl)}`;
                }
              }
            } else {
              videoFallbackNote = 'Video asli tidak dapat diputar langsung karena batasan platform TikTok, berikut cover visualnya.';
            }

            return {
              url: cleanUrl,
              finalUrl: cleanUrl,
              title: v.title || 'TikTok Video',
              description: `Video TikTok oleh @${v.author?.unique_id || v.author?.nickname || 'user'}. Musik: ${v.music_info?.title || '-'}. Plays: ${v.play_count || 0}, Likes: ${v.digg_count || 0}`,
              imageUrl: allExtractedImages[0] || v.cover || v.origin_cover || '',
              images: allExtractedImages,
              seller: v.author?.nickname || v.author?.unique_id,
              isMedia: true,
              hasPlayableVideo: Boolean(playableVideoUrl),
              videoUrl: rawVideoUrl,
              videoPlaybackUrl: playableVideoUrl,
              videoCover: v.cover || v.origin_cover || allExtractedImages[0] || '',
              videoDuration: (typeof v.duration === 'number' && v.duration > 0) ? v.duration : (v.video_data?.duration || 0),
              videoAuthor: v.author?.unique_id || v.author?.nickname || 'TikTok User',
              videoFallbackNote,
            };
          }
        } catch (e: any) {
          console.warn('[Web Scraper] Gagal mengekstrak TikTok via TikWM:', e?.message);
        }
      }

      // 2. Fetch page with mobile/desktop user-agent to resolve redirects & fetch metadata
      const resp = await axios.get(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        maxRedirects: 10,
        timeout: 15000,
      });

      const finalUrl = resp.request?.res?.responseUrl || cleanUrl;
      const html = typeof resp.data === 'string' ? resp.data : '';

      let title = '';
      let description = '';
      let price = '';
      let rating = '';
      let seller = '';

      // Check TikTok / Tokopedia Share Query Params (og_info, seller, etc.)
      if (finalUrl.includes('og_info=')) {
        try {
          const rawOg = finalUrl.split('og_info=')[1].split('&')[0];
          const parsed = JSON.parse(decodeURIComponent(rawOg));
          if (parsed.title) title = parsed.title.replace(/\+/g, ' ');
          if (parsed.image) {
            let rawDec = decodeURIComponent(parsed.image);
            // Upgrade TikTok/Tokopedia thumbnail to high-definition 800x800
            if (rawDec.includes('resize-webp:260:260.webp')) {
              rawDec = rawDec.replace(/resize-webp:260:260\.webp/i, 'resize-webp:800:800.webp');
            }
            addImg(rawDec);
          }
        } catch (e) {}
      }

      // Extract seller/brand or user_id from query params if available
      try {
        const urlObj = new URL(finalUrl);
        const secUserId = urlObj.searchParams.get('unique_id') || urlObj.searchParams.get('seller_id') || urlObj.searchParams.get('shop_name');
        if (secUserId && !seller) {
          seller = secUserId;
        }
      } catch (e) {}

      // OpenGraph & Meta tags
      if (!title) {
        const ogTitle =
          html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["'](.*?)["']/i) ||
          html.match(/<meta[^>]+content=["'](.*?)["'][^>]+property=["']og:title["']/i) ||
          html.match(/<title[^>]*>(.*?)<\/title>/i);
        if (ogTitle) title = ogTitle[1].trim();
      }

      const ogImagesMatches = html.matchAll(
        /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image|image)["'][^>]+content=["'](.*?)["']/gi
      );
      for (const m of ogImagesMatches) {
        addImg(m[1]);
      }

      const ogImagesMatchesRev = html.matchAll(
        /<meta[^>]+content=["'](.*?)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image|image)["']/gi
      );
      for (const m of ogImagesMatchesRev) {
        addImg(m[1]);
      }

      if (!description) {
        const ogDesc =
          html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["'](.*?)["']/i) ||
          html.match(/<meta[^>]+name=["']description["'][^>]+content=["'](.*?)["']/i);
        if (ogDesc) description = ogDesc[1].trim();
      }

      // JSON-LD structured data (Product, Offers, Reviews, Brand)
      const jsonLdMatches = html.matchAll(
        /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
      );
      for (const match of jsonLdMatches) {
        try {
          const parsed = JSON.parse(match[1]);
          const items = Array.isArray(parsed) ? parsed : [parsed];
          for (const it of items) {
            if (it['@type'] === 'Product' || it.offers || it.name) {
              if (!title && it.name) title = it.name;
              if (!description && it.description) description = it.description;
              if (it.image) {
                const imgArray = Array.isArray(it.image) ? it.image : [it.image];
                for (const img of imgArray) {
                  const u = typeof img === 'string' ? img : img?.url;
                  addImg(u);
                }
              }
              if (it.offers) {
                const offer = Array.isArray(it.offers) ? it.offers[0] : it.offers;
                if (offer?.price)
                  price = `${offer.priceCurrency || 'Rp'} ${Number(offer.price).toLocaleString('id-ID')}`;
              }
              if (it.aggregateRating) {
                rating = `${it.aggregateRating.ratingValue} / 5 (${it.aggregateRating.reviewCount || it.aggregateRating.ratingCount || 0} ulasan)`;
              }
              if (it.brand?.name) seller = it.brand.name;
            }
          }
        } catch (e) {}
      }

      if (!price && html) {
        const priceRegexMatch = html.match(/(?:Rp\.?|IDR)\s*([\d.,]{3,})/i) || html.match(/"price":\s*"?(\d+)"?/i) || html.match(/"priceAmount":\s*"?(\d+)"?/i);
        if (priceRegexMatch) {
          const rawNum = priceRegexMatch[1].replace(/[^\d]/g, '');
          if (rawNum && rawNum.length >= 3) {
            price = `Rp ${parseInt(rawNum, 10).toLocaleString('id-ID')}`;
          }
        }
      }

      // 4. Extract <img> tags with product/large images
      const imgTagMatches = html.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi);
      for (const m of imgTagMatches) {
        const src = m[1];
        if (
          !src.includes('avatar') &&
          !src.includes('icon') &&
          !src.includes('logo') &&
          !src.includes('badge') &&
          !src.includes('.svg') &&
          allExtractedImages.length < 8
        ) {
          addImg(src);
        }
      }

      // Clean body text excerpt
      let cleanText = '';
      if (html) {
        cleanText = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 1500);
      }

      // Extract og:video or <video> stream if present on the page
      let generalVideoUrl = '';
      const ogVideoMatch =
        html.match(/<meta[^>]+property=["'](?:og:video:secure_url|og:video|og:video:url)["'][^>]+content=["'](.*?)["']/i) ||
        html.match(/<meta[^>]+content=["'](.*?)["'][^>]+property=["'](?:og:video:secure_url|og:video|og:video:url)["']/i) ||
        html.match(/<meta[^>]+name=["']twitter:player:stream["'][^>]+content=["'](.*?)["']/i);
      if (ogVideoMatch) generalVideoUrl = ogVideoMatch[1].trim();

      if (!generalVideoUrl) {
        const videoSrcMatch = html.match(/<video[^>]+src=["'](https?:\/\/[^"']+)["']/i) ||
                              html.match(/<source[^>]+src=["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
        if (videoSrcMatch) generalVideoUrl = videoSrcMatch[1].trim();
      }

      const isSocialVideoPlatform =
        cleanUrl.includes('instagram.com/reel') ||
        cleanUrl.includes('instagram.com/reels') ||
        cleanUrl.includes('youtube.com/shorts') ||
        cleanUrl.includes('tiktok.com');

      let fallbackNote: string | undefined;
      if (isSocialVideoPlatform && !generalVideoUrl) {
        fallbackNote = 'Video asli tidak dapat diputar langsung karena pembatasan platform, berikut cover/thumbnail sebagai gambaran visual.';
      }

      const primaryImage = allExtractedImages[0] || '';
      console.log(`[Web Scraper] Sukses mengekstrak URL: ${cleanUrl} -> Judul: "${title || '(none)'}", Jumlah Gambar: ${allExtractedImages.length}, Video: ${generalVideoUrl ? 'Ya' : (fallbackNote ? 'Fallback' : 'Tidak')}`);

      return {
        url: cleanUrl,
        finalUrl,
        title: title
          ? title
              .replace(/&amp;/g, '&')
              .replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"')
          : '',
        description: description
          ? description
              .replace(/&amp;/g, '&')
              .replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"')
          : '',
        imageUrl: primaryImage,
        images: allExtractedImages,
        price: price || '',
        rating: rating || '',
        seller: seller || '',
        textContent: cleanText.length > 50 && !cleanText.includes('Security Check') ? cleanText : '',
        isMedia: Boolean(generalVideoUrl || isSocialVideoPlatform || allExtractedImages.length > 0),
        hasPlayableVideo: Boolean(generalVideoUrl),
        videoUrl: generalVideoUrl || undefined,
        videoPlaybackUrl: generalVideoUrl ? `/api/proxy-video?url=${encodeURIComponent(generalVideoUrl)}` : undefined,
        videoCover: primaryImage,
        videoAuthor: seller || undefined,
        videoFallbackNote: fallbackNote,
      };
    } catch (err: any) {
      console.warn(`[Web Scraper] Gagal mengambil metadata untuk ${targetUrl}:`, err.message);
      return null;
    }
  }

  // Core function to execute Any LLM model on Weavy AI via User Account Recipe
  async function executeWeavyAnyLLM({
    messages = [],
    model = 'anthropic/claude-sonnet-5',
    mode = 'chat',
    systemPrompt,
    thinking = false,
    quickPresetEnabled = false,
    temperature,
    refreshToken,
    idToken: providedIdToken,
    allRefreshTokens = [],
    imageUrl,
    images: inputImages = [],
    sessionImages = [],
    sessionVideos = [],
  }: {
    messages?: Array<{
      role: string;
      content?: string;
      attachments?: any[];
      generatedImage?: any;
      weavyAction?: any;
      repostMedia?: any;
    }>;
    model?: string;
    mode?: string;
    systemPrompt?: string;
    thinking?: boolean;
    quickPresetEnabled?: boolean;
    temperature?: number;
    refreshToken?: string;
    idToken?: string;
    allRefreshTokens?: string[];
    imageUrl?: string;
    images?: string[];
    sessionImages?: Array<{
      index: number;
      url: string;
      prompt?: string;
      model?: string;
      label?: string;
    }>;
    sessionVideos?: Array<{
      index: number;
      url: string;
      playbackUrl?: string;
      coverUrl?: string;
      title?: string;
      author?: string;
      duration?: number | string;
      sourceUrl?: string;
      fallbackNote?: string;
      label?: string;
      tag?: string;
    }>;
  }) {
    const startTime = Date.now();

    // 1. Resolve active Weavy Refresh Token with Auto-Failover
    const rawTokens: string[] = [
      refreshToken,
      ...(Array.isArray(allRefreshTokens) ? allRefreshTokens : []),
    ].filter((t): t is string => typeof t === 'string' && t.trim().length > 0);

    const candidateTokens = Array.from(new Set(rawTokens));

    let activeIdToken = '';
    let chosenRefreshToken = '';
    let userInfo: any = null;
    let weavyHeaders: any = null;

    const tryToken = async (idToken: string) => {
      const headers = getWeavyHeaders(idToken);
      // Validate token using /api/v1/recipes?limit=1 (supported by all user tokens)
      const recipesRes = await axios.get('https://api.weavy.ai/api/v1/recipes?limit=1', {
        headers,
        timeout: 10000,
      });

      // Try fetching optional user info in non-blocking try/catch
      let uInfo: any = null;
      try {
        const userResp = await axios.get('https://api.weavy.ai/api/v1/users', {
          headers,
          timeout: 6000,
        });
        uInfo = userResp.data;
      } catch (e) {}

      return { headers, userInfo: uInfo };
    };

    let lastAuthError: any = null;

    if (candidateTokens.length > 0) {
      for (const token of candidateTokens) {
        try {
          const freshIdToken = await getFreshIdToken(token);
          activeIdToken = freshIdToken;
          chosenRefreshToken = token;
          weavyHeaders = getWeavyHeaders(freshIdToken);

          try {
            const res = await tryToken(freshIdToken);
            if (res.userInfo) userInfo = res.userInfo;
          } catch (_) {}

          console.log(`[Weavy Chat Auth] Terhubung sukses ke akun Weavy: ${userInfo?.email || 'Weavy User'}`);
          break;
        } catch (e: any) {
          lastAuthError = e;
          console.warn(`[Weavy Chat Auth] Percobaan token gagal (${e?.response?.status || e?.message}), mencoba token berikutnya...`);
        }
      }
    }

    if (!activeIdToken && providedIdToken) {
      activeIdToken = providedIdToken;
      weavyHeaders = getWeavyHeaders(providedIdToken);
      try {
        const res = await tryToken(providedIdToken);
        if (res.userInfo) userInfo = res.userInfo;
      } catch (e: any) {
        lastAuthError = e;
      }
    }

    if (!activeIdToken || !weavyHeaders) {
      const status = lastAuthError?.response?.status;
      if (status === 403 || status === 401) {
        throw new Error(
          'Sesi akun Weavy yang kamu gunakan tidak valid atau telah kedaluwarsa (HTTP 403 Forbidden). Silakan sambungkan ulang atau pilih akun Weavy di Pengaturan (Settings), atau gunakan provider Google Gemini.'
        );
      }
      throw new Error(
        lastAuthError?.message ||
          'Akun Weavy aktif tidak ditemukan atau sesi telah kedaluwarsa. Silakan pilih atau tambahkan akun Weavy di Pengaturan terlebih dahulu.'
      );
    }

    if (userInfo && typeof userInfo.credits === 'number' && userInfo.credits <= 0) {
      throw new Error(
        `Saldo kredit akun Weavy (${userInfo.email || 'kamu'}) habis (0 kredit). Silakan ganti ke akun Weavy yang memiliki kredit di Pengaturan.`
      );
    }

    // 3. Normalize Model ID to Weavy Any LLM Supported Models
    const WEAVY_SUPPORTED_MODELS = [
      'anthropic/claude-opus-5',
      'anthropic/claude-sonnet-5',
      'anthropic/claude-opus-4-7',
      'anthropic/claude-opus-4-6',
      'anthropic/claude-sonnet-4-6',
      'anthropic/claude-haiku-4-5',
      'google/gemini-3.1-pro',
      'google/gemini-3.6-flash',
      'google/gemini-3.5-flash-lite',
      'google/gemini-3-pro',
      'google/gemini-2.5-flash',
      'google/gemini-2.5-flash-lite',
      'openai/gpt-5.6-sol',
      'openai/gpt-5.6-terra',
      'openai/gpt-5.6-luna',
      'openai/gpt-4o',
      'openai/gpt-4.1',
      'meta-llama/llama-4-maverick',
      'meta-llama/llama-4-scout',
    ];

    let targetModel = model;
    if (!WEAVY_SUPPORTED_MODELS.includes(targetModel)) {
      const lower = String(targetModel || '').toLowerCase();
      if (lower.includes('gemini') || lower.includes('google')) {
        if (lower.includes('3.6')) targetModel = 'google/gemini-3.6-flash';
        else if (lower.includes('3.5')) targetModel = 'google/gemini-3.5-flash-lite';
        else if (lower.includes('3-pro') || lower.includes('3.1')) targetModel = 'google/gemini-3.1-pro';
        else if (lower.includes('2.5-flash-lite')) targetModel = 'google/gemini-2.5-flash-lite';
        else targetModel = 'google/gemini-2.5-flash';
      } else if (lower.includes('gpt') || lower.includes('openai') || lower.includes('chatgpt')) {
        if (lower.includes('sol')) targetModel = 'openai/gpt-5.6-sol';
        else if (lower.includes('terra')) targetModel = 'openai/gpt-5.6-terra';
        else if (lower.includes('luna')) targetModel = 'openai/gpt-5.6-luna';
        else if (lower.includes('4.1')) targetModel = 'openai/gpt-4.1';
        else targetModel = 'openai/gpt-4o';
      } else if (lower.includes('claude') || lower.includes('anthropic') || lower.includes('sonnet') || lower.includes('opus') || lower.includes('haiku')) {
        if (lower.includes('opus')) targetModel = 'anthropic/claude-opus-5';
        else if (lower.includes('haiku')) targetModel = 'anthropic/claude-haiku-4-5';
        else targetModel = 'anthropic/claude-sonnet-5';
      } else if (lower.includes('llama') || lower.includes('meta')) {
        if (lower.includes('scout')) targetModel = 'meta-llama/llama-4-scout';
        else targetModel = 'meta-llama/llama-4-maverick';
      } else if (lower.includes('deepseek')) {
        targetModel = 'meta-llama/llama-4-maverick';
      } else if (lower.includes('grok') || lower.includes('x-ai')) {
        targetModel = 'openai/gpt-4o';
      } else {
        const matched = WEAVY_SUPPORTED_MODELS.find(
          (m) => m.includes(targetModel) || targetModel.includes(m.split('/')[1])
        );
        targetModel = matched || 'google/gemini-2.5-flash';
      }
    }
    console.log(`[Weavy Any LLM] Selected model for execution: ${targetModel} (raw request: ${model})`);

    // 4. Recipe Canvas Lookup or Dedicated Creation per Account
    const userKey = userInfo?.id || userInfo?.email || (chosenRefreshToken ? chosenRefreshToken.slice(-20) : 'default');
    let recipeId = weavyChatRecipeCache.get(userKey);
    let isRecipeValid = false;

    if (recipeId) {
      try {
        const checkRes = await axios.get(`https://api.weavy.ai/api/v1/recipes/${recipeId}`, {
          headers: weavyHeaders,
          timeout: 8000,
        });
        if (checkRes.data?.id || checkRes.data?._id) {
          isRecipeValid = true;
        }
      } catch (e) {
        isRecipeValid = false;
      }
    }

    if (!isRecipeValid) {
      try {
        const listRes = await axios.get('https://api.weavy.ai/api/v1/recipes?limit=25', {
          headers: weavyHeaders,
          timeout: 10000,
        });
        const existingList = listRes.data?.recipes || listRes.data || [];
        const existingChatRecipe = existingList.find((r: any) =>
          r.name && (r.name.includes('Chat LLM') || r.name.includes('Chat Assistant'))
        );
        if (existingChatRecipe?.id) {
          recipeId = existingChatRecipe.id;
          isRecipeValid = true;
        }
      } catch (e) {}
    }

    if (!isRecipeValid || !recipeId) {
      console.log(`[Weavy Chat] Inisialisasi Recipe Canvas untuk akun ${userInfo?.email || userKey}...`);
      try {
        const createRes = await axios.post(
          'https://api.weavy.ai/api/v1/recipes/create',
          {
            name: `Chat LLM Assistant (${Date.now().toString().slice(-4)})`,
            description: 'Dedicated automated workflow canvas for Weavy Chat LLM models',
          },
          { headers: weavyHeaders, timeout: 25000 }
        );
        recipeId = createRes.data?.id || createRes.data?._id;
      } catch (cErr: any) {
        const status = cErr?.response?.status;
        if (status === 403 || status === 401) {
          throw new Error('Sesi akun Weavy tidak diizinkan membuat Recipe (HTTP 403 Forbidden). Silakan perbarui token akun Weavy di Settings.');
        }
        throw new Error(cleanErrorMessage(cErr));
      }

      if (!recipeId) {
        throw new Error('Gagal menginisialisasi Recipe Canvas Chat di Weavy AI.');
      }
    }

    weavyChatRecipeCache.set(userKey, recipeId);

    // 4.5. Real-Time Web Scraping & URL Metadata Extraction (CURRENT TURN ONLY)
    // CRITICAL FIX: We extract and scrape URLs ONLY from the current user turn so that
    // extracted link media (images & videos) are attached ONLY to the exact turn where the link was submitted.
    const lastUserMsg = Array.isArray(messages)
      ? [...messages].reverse().find((m) => m.role === 'user') || messages[messages.length - 1]
      : null;
    const currentTurnContent = (lastUserMsg && typeof lastUserMsg.content === 'string') ? lastUserMsg.content : '';

    const currentTurnUrls: string[] = [];
    const urlRegex = /https?:\/\/[^\s<>"')]+/gi;
    if (currentTurnContent) {
      const matches = currentTurnContent.match(urlRegex);
      if (matches) {
        for (const u of matches) {
          const cleaned = u.trim();
          if (cleaned && !currentTurnUrls.includes(cleaned)) {
            currentTurnUrls.push(cleaned);
          }
        }
      }
    }

    const scrapedWebResults: ScrapedWebInfo[] = [];
    if (currentTurnUrls.length > 0) {
      for (const targetUrl of currentTurnUrls.slice(-3)) {
        try {
          const scraped = await scrapeWebMetadata(targetUrl);
          if (scraped && (scraped.title || scraped.imageUrl || scraped.description || scraped.textContent || scraped.videoPlaybackUrl || scraped.videoUrl)) {
            scrapedWebResults.push(scraped);
          }
        } catch (sErr) {}
      }
    }

    // 5. Collect All Session Images and Videos (Catalog for @img1, @vid1 references)
    const sessionImagesList: Array<{ index: number; url: string; prompt?: string; model?: string; label?: string }> = [];

    // If client supplied pre-indexed sessionImages, use them as initial source of truth
    if (Array.isArray(sessionImages) && sessionImages.length > 0) {
      for (const si of sessionImages) {
        if (si && si.url && !sessionImagesList.some((item) => item.url === si.url)) {
          sessionImagesList.push({
            index: si.index || (sessionImagesList.length + 1),
            url: si.url,
            prompt: si.prompt || '',
            model: si.model || 'Foto Lampiran Sesi',
            label: si.label || `Gambar ke-${si.index || (sessionImagesList.length + 1)}`,
          });
        }
      }
    }

    let imgCounter = sessionImagesList.length > 0
      ? Math.max(...sessionImagesList.map((s) => s.index)) + 1
      : 1;

    // Collect all session videos with order 1, 2, 3...
    const sessionVideosList: Array<{
      index: number;
      url: string;
      playbackUrl?: string;
      coverUrl?: string;
      title?: string;
      author?: string;
      duration?: number | string;
      sourceUrl?: string;
      fallbackNote?: string;
      label?: string;
      tag?: string;
    }> = [];

    // If client supplied pre-indexed sessionVideos, use them as initial source of truth
    if (Array.isArray(sessionVideos) && sessionVideos.length > 0) {
      for (const sv of sessionVideos) {
        if (sv && (sv.playbackUrl || sv.url) && !sessionVideosList.some((item) => (item.playbackUrl === sv.playbackUrl || item.url === sv.url))) {
          sessionVideosList.push({
            index: sv.index || (sessionVideosList.length + 1),
            url: sv.url || sv.playbackUrl || '',
            playbackUrl: sv.playbackUrl || sv.url || '',
            coverUrl: sv.coverUrl,
            title: sv.title || `Video ke-${sv.index || (sessionVideosList.length + 1)}`,
            author: sv.author || 'Creator',
            duration: sv.duration,
            sourceUrl: sv.sourceUrl,
            fallbackNote: sv.fallbackNote,
            label: sv.label || `Video ke-${sv.index || (sessionVideosList.length + 1)}`,
            tag: sv.tag || `@vid${sv.index || (sessionVideosList.length + 1)}`,
          });
        }
      }
    }

    let vidCounter = sessionVideosList.length > 0
      ? Math.max(...sessionVideosList.map((s) => s.index)) + 1
      : 1;

    // Scan previous messages to catalog existing session images & videos
    if (Array.isArray(messages)) {
      for (const m of messages) {
        if (m.weavyAction?.resultUrl) {
          if (!sessionImagesList.some(si => si.url === m.weavyAction.resultUrl)) {
            sessionImagesList.push({
              index: imgCounter,
              url: m.weavyAction.resultUrl,
              prompt: m.weavyAction.prompt || '',
              model: m.weavyAction.model || 'Seedream V5.0 Pro Edit',
              label: `Gambar ke-${imgCounter}`
            });
            imgCounter++;
          }
        } else if (m.generatedImage?.url) {
          if (!sessionImagesList.some(si => si.url === m.generatedImage.url)) {
            sessionImagesList.push({
              index: imgCounter,
              url: m.generatedImage.url,
              prompt: m.generatedImage.prompt || '',
              model: m.generatedImage.modelName || 'Weavy Image',
              label: `Gambar ke-${imgCounter}`
            });
            imgCounter++;
          }
        } else if (Array.isArray(m.attachments)) {
          for (const att of m.attachments) {
            const attUrl = att?.url || att?.base64;
            if (att && attUrl && att.type === 'image') {
              if (!sessionImagesList.some(si => si.url === attUrl)) {
                sessionImagesList.push({
                  index: imgCounter,
                  url: attUrl,
                  prompt: att.name || 'Foto Referensi / Input Pengguna',
                  label: `Gambar ke-${imgCounter}`
                });
                imgCounter++;
              }
            } else if (att && (att.type === 'video' || att.playbackUrl || (att.name && att.name.match(/\.(mp4|webm|mov|mkv)$/i)))) {
              const vUrl = att.playbackUrl || attUrl;
              if (vUrl && !sessionVideosList.some(sv => sv.playbackUrl === vUrl || sv.url === vUrl)) {
                sessionVideosList.push({
                  index: vidCounter,
                  url: vUrl,
                  playbackUrl: vUrl,
                  coverUrl: att.coverUrl,
                  title: att.title || att.name || `Video #${vidCounter}`,
                  author: att.author || 'Pengguna',
                  duration: att.duration,
                  sourceUrl: att.sourceUrl,
                  fallbackNote: att.fallbackNote,
                  label: `Video ke-${vidCounter}`,
                  tag: `@vid${vidCounter}`,
                });
                vidCounter++;
              }
            }
          }
        }
      }
    }

    // Collect scraped attachments (images and playable videos) ONLY for the CURRENT turn
    const scrapedAttachments: Array<{
      id: string;
      name: string;
      url: string;
      type: 'image' | 'video';
      playbackUrl?: string;
      coverUrl?: string;
      duration?: number | string;
      fallbackNote?: string;
      sourceUrl?: string;
      author?: string;
      title?: string;
      videoIndex?: number;
    }> = [];

    // Register any newly scraped videos from current turn URLs
    if (scrapedWebResults.length > 0) {
      for (const sw of scrapedWebResults) {
        if (sw.videoPlaybackUrl || sw.videoUrl || sw.videoFallbackNote) {
          const vPlayUrl = sw.videoPlaybackUrl || sw.videoUrl || '';
          let existingVid = sessionVideosList.find(sv => (vPlayUrl && (sv.playbackUrl === vPlayUrl || sv.url === vPlayUrl)));
          let currentVidIdx: number;

          if (!existingVid) {
            currentVidIdx = vidCounter;
            existingVid = {
              index: currentVidIdx,
              url: vPlayUrl,
              playbackUrl: sw.videoPlaybackUrl || vPlayUrl,
              coverUrl: sw.videoCover || sw.imageUrl,
              title: sw.title ? sw.title : `Video #${currentVidIdx}`,
              author: sw.videoAuthor || sw.seller || 'Creator',
              duration: sw.videoDuration,
              sourceUrl: sw.url,
              fallbackNote: sw.videoFallbackNote,
              label: `Video ke-${currentVidIdx}`,
              tag: `@vid${currentVidIdx}`,
            };
            sessionVideosList.push(existingVid);
            vidCounter++;
          } else {
            currentVidIdx = existingVid.index;
          }

          // Push video attachment ONLY to the current turn's response
          if (!scrapedAttachments.some(a => a.type === 'video' && (a.playbackUrl === vPlayUrl || a.url === vPlayUrl))) {
            scrapedAttachments.push({
              id: `scraped_vid_${Date.now()}_${scrapedAttachments.length}`,
              name: sw.title ? `${sw.title.slice(0, 45)}.mp4` : `Video Asli #${currentVidIdx}.mp4`,
              url: vPlayUrl,
              playbackUrl: sw.videoPlaybackUrl || vPlayUrl,
              coverUrl: sw.videoCover || sw.imageUrl || '',
              type: 'video',
              duration: sw.videoDuration,
              fallbackNote: sw.videoFallbackNote,
              sourceUrl: sw.url,
              author: sw.videoAuthor || sw.seller,
              title: sw.title,
              videoIndex: currentVidIdx,
            });
          }
        }
      }
    }

    // Register any newly scraped product images from current turn URLs
    if (scrapedWebResults.length > 0) {
      for (const sw of scrapedWebResults) {
        const imgList = sw.images && sw.images.length > 0 ? sw.images : (sw.imageUrl ? [sw.imageUrl] : []);
        for (let idx = 0; idx < imgList.length; idx++) {
          const imgUrl = imgList[idx];
          if (imgUrl && !sessionImagesList.some(si => si.url === imgUrl)) {
            sessionImagesList.push({
              index: imgCounter,
              url: imgUrl,
              prompt: sw.title ? `Foto Produk Web (${idx + 1}): ${sw.title}` : `Foto Produk / Media #${idx + 1}`,
              model: 'Foto Produk Asli (dari Web URL)',
              label: `Gambar ke-${imgCounter} (Foto Produk #${idx + 1} dari URL)`
            });
            imgCounter++;
          }
          if (imgUrl && !scrapedAttachments.some(a => a.url === imgUrl)) {
            scrapedAttachments.push({
              id: `scraped_img_${Date.now()}_${scrapedAttachments.length}`,
              name: sw.title ? `${sw.title.slice(0, 35)} #${idx + 1}` : `Foto Produk #${idx + 1}`,
              url: imgUrl,
              type: 'image',
            });
          }
        }
      }
    }

    // 5.5. Handle Multimodal Image Attachment for Current Turn Vision Input
    const attachedImageUrls: string[] = [];
    if (imageUrl) {
      attachedImageUrls.push(imageUrl);
    }
    if (Array.isArray(inputImages) && inputImages.length > 0) {
      for (const u of inputImages) {
        if (typeof u === 'string' && u && !attachedImageUrls.includes(u)) {
          attachedImageUrls.push(u);
        }
      }
    }

    // If web scraping from CURRENT turn found images, include them in current turn vision input
    if (scrapedWebResults.length > 0) {
      for (const sw of scrapedWebResults) {
        if (sw.imageUrl && !attachedImageUrls.includes(sw.imageUrl)) {
          attachedImageUrls.push(sw.imageUrl);
        }
      }
    }

    // If current user message has direct image attachments, include them
    if (lastUserMsg && Array.isArray(lastUserMsg.attachments)) {
      for (const att of lastUserMsg.attachments) {
        const url = att?.url || att?.base64;
        if (url && att?.type === 'image' && !attachedImageUrls.includes(url)) {
          attachedImageUrls.push(url);
        }
      }
    }

    // If user explicitly referenced @imgX in current prompt, resolve that image for vision input
    if (currentTurnContent) {
      const imgMentions = currentTurnContent.match(/@img(\d+)/gi);
      if (imgMentions) {
        for (const mention of imgMentions) {
          const idxMatch = mention.match(/@img(\d+)/i);
          if (idxMatch && idxMatch[1]) {
            const targetIdx = parseInt(idxMatch[1], 10);
            const foundImg = sessionImagesList.find((si) => si.index === targetIdx);
            if (foundImg && foundImg.url && !attachedImageUrls.includes(foundImg.url)) {
              attachedImageUrls.push(foundImg.url);
            }
          }
        }
      }

      // If user explicitly referenced @vidX in current prompt, resolve cover / reference image for vision input
      const vidMentions = currentTurnContent.match(/@vid(\d+)/gi);
      if (vidMentions) {
        for (const mention of vidMentions) {
          const idxMatch = mention.match(/@vid(\d+)/i);
          if (idxMatch && idxMatch[1]) {
            const targetIdx = parseInt(idxMatch[1], 10);
            const foundVid = sessionVideosList.find((sv) => sv.index === targetIdx);
            if (foundVid) {
              const coverOrImg = foundVid.coverUrl || (foundVid.url && foundVid.url.match(/\.(jpg|jpeg|png|webp)/i) ? foundVid.url : '');
              if (coverOrImg && !attachedImageUrls.includes(coverOrImg)) {
                attachedImageUrls.push(coverOrImg);
              }
            }
          }
        }
      }
    }

    const uploadedWeavyImages: any[] = [];
    for (const rawUrl of attachedImageUrls.slice(0, 5)) {
      const weavyImg = await uploadImageToWeavyStore(rawUrl, activeIdToken);
      if (weavyImg && weavyImg.url) {
        uploadedWeavyImages.push(weavyImg);
      } else if (typeof rawUrl === 'string' && rawUrl.startsWith('http')) {
        uploadedWeavyImages.push({
          type: 'image',
          url: rawUrl,
          width: 1024,
          height: 1024,
          thumbnailUrl: rawUrl,
          publicId: '',
          id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: `upload_${Date.now()}.png`,
        });
      }
    }

    // 6. Format Prompt Context & System Instruction
    let sessionImagesContext = '';
    if (sessionImagesList.length > 0) {
      sessionImagesContext = `
DAFTAR FILE GAMBAR DALAM SESI INI (Total: ${sessionImagesList.length} Gambar):
${sessionImagesList.map(img => `- Gambar #${img.index} (${img.label}):
  • Model: ${img.model || 'Foto Asli'}
  • Deskripsi / Prompt: ${img.prompt || '-'}
  • File URL: ${img.url}`).join('\n')}

FITUR PENGIRIMAN ULANG GAMBAR LAMA (REPOST MEDIA - 0 KREDIT):
Jika pengguna meminta melihat lagi, mengirim ulang, atau mengecek gambar lama dari sesi ini (misalnya: "tolong kirim gambar ke 1 yang tadi", "mana gambar pertama", "tampilkan foto ke-2", "kirim ulang gambar 1", "mana foto yang tadi", dll):
1. JANGAN PERNAH mengatakan "gue nggak bisa mengambil dan mengirim ulang file hasil generate lama"!
2. JANGAN PERNAH menyuruh generate ulang atau merancang prompt baru, karena itu MEMBUANG KREDIT PENGGUNA!
3. Kamu SUDAH MEMILIKI file-nya dari daftar di atas. Berikan konfirmasi hangat dalam bahasa Indonesia (misal: "Ini dia bro, file asli Gambar ke-1 yang tadi (tanpa render ulang & 0 kredit):").
4. Di akhir jawabanmu, sertakan blok \`\`\`weavy_repost berikut:
\`\`\`weavy_repost
{
  "imageIndex": <nomor indeks gambar yang diminta, contoh: 1>,
  "imageUrl": "<URL persis dari gambar tersebut>",
  "caption": "Gambar ke-<nomor>"
}
\`\`\`
Sistem aplikasi akan langsung menampilkan file gambar tersebut dengan 0 kredit!
`;
    }

    let sessionVideosContext = '';
    if (sessionVideosList.length > 0) {
      sessionVideosContext = `
DAFTAR FILE VIDEO DALAM SESI INI (Total: ${sessionVideosList.length} Video):
${sessionVideosList.map(v => `- Video #${v.index} (Tag: ${v.tag || `@vid${v.index}`}):
  • Judul: ${v.title || '-'}
  • Pembuat/Author: @${v.author || 'creator'}
  • Durasi: ${v.duration ? `${v.duration} detik` : 'Durasi Asli Terdeteksi'}
  • Status Pemutaran: ${v.fallbackNote ? 'Cover/Thumbnail Saja (Restriksi DRM Platform)' : 'Pemutar Video Asli Tersemat di Chat (Native Embed Player)'}
  • Link Asli: ${v.sourceUrl || v.url}`).join('\n')}

PEDOMAN INTEGRASI PEMUTAR VIDEO DI CHAT & EKSTRAKSI PROMPT VIDEO:
1. Video yang dikirimkan atau diekstrak telah dipasangkan PEMUTAR VIDEO ASLI (Native Embedded Video Player) langsung di dalam bubble pesan chat. Pengguna dapat langsung menekan Play/Pause, mengatur progress bar, volume, full screen, atau mengunduh video langsung di chat tanpa perlu berpindah aplikasi.
2. Ketika mengulas, membedah, atau mereferensikan video tersebut, selalu rujuk dengan tag resminya seperti ${sessionVideosList.map(v => v.tag || `@vid${v.index}`).join(', ')} atau sebutkan "Video #${sessionVideosList.map(v => v.index).join(', Video #')}".
3. PERBEDAAN INTENT PENGGUNA (ATURAN KRUSIAL):
   - JIKA pengguna MENGETIK SLASH COMMAND seperti "/fashion" atau "/video": Jalankan preset komersial 15 detik (Hook, Fit/Drape, Side View, Rear Fit, Hero Finish) sesuai aturan slash command.
   - JIKA pengguna TIDAK MENGETIK SLASH COMMAND dan meminta ekstraksi prompt video secara natural (misal: "buatkan prompt dari video ini", "ekstrak video ini ke prompt", "jadikan video ini prompt", "buat prompt dari @vid1", "analisis video ini"):
     WAJIB gunakan MODE EKSTRAKSI PROMPT SESUAI DURASI ASLI (DURATION-FAITHFUL).
     DILARANG KERAS memotong secara sepihak ke batas 15 detik jika video referensi berdurasi lebih panjang (misal 24s, 25s, 40s)!
     Deteksi total durasi asli, konfirmasi secara eksplisit di awal jawaban ("Video referensi ini terdeteksi berdurasi [X] detik..."), dan buatkan breakdown kronologis detik-per-detik (atau beats per adegan) dari 0 detik hingga detik terakhir video aslinya tanpa template kaku!
`;
    }

    const weavyImageInstruction = `
WEAVY IMAGE GENERATOR BRIDGE & MASTER PROMPT DIRECTOR:
You are directly integrated with Weavy AI Image Generation in this application.
The available official Weavy image models are:
1. "Nano Banana Pro" (Google AI, 11 credits): Champion of true-to-life photorealism, architectural interior photography, real physics lighting, highly accurate reference fidelity. (Best default for realistic rooms, interior photography, portraits, 1:1, 16:9, 9:16).
2. "Seedream V5.0 Pro Edit" (ByteDance, 12 credits): Ultra-sharp, aesthetic cinematic portraits, stylish fashion, supports up to 10 image references and text-to-image (ideal for 9:16, 16:9, 1:1).
3. "GPT Image 2.5" (Weavy Flare, 4 credits): Fast, cost-efficient, cinematic, supports up to 10 image references and text-to-image.
4. "ChatGPT Images 2.0 Edit" (OpenAI, 9 credits): Specialized for editing / modifying uploaded reference images.
5. "Grok Imagine Image" (xAI, 4 credits): Fast, creative lighting, text-to-image only.

CRITICAL ARCHITECTURAL & INTERIOR REALISM DIRECTIVES (HOW TO MAKE ROOMS & SCENES GENUINELY REALISTIC):
When creating or modifying rooms, buildings, interiors, or lifestyle scenes:
- NEVER use generic AI buzzwords or cliché crutches: DO NOT use "photorealistic, hyperrealistic, ultra realistic, 8k, octane render, unreal engine, masterpiece". These cause cheap 3D plastic-smooth looks.
- ANCHOR WITH PHYSICAL CAMERA & LENS METRICS: Always specify realistic camera hardware, e.g. "Interior architectural photography shot on Sony Alpha A7 IV or Hasselblad X2D 100C, 24mm or 35mm tilt-shift architectural lens, f/5.6 aperture, ISO 100, natural color grade, raw authentic photo".
- NATURAL PHYSICAL LIGHTING: Describe the physical source and bounce of light, e.g. "Diffused natural morning daylight streaming through floor-to-ceiling windows, subtle ambient warm 2700K bounce light, realistic soft contact shadows along baseboards and furniture legs, authentic light falloff without artificial studio fill".
- TACTILE REAL-WORLD MATERIALS: Specify concrete tactile materials rather than abstract concepts: "Matte lime-wash textured plaster walls, wide-plank European white oak hardwood flooring with visible natural wood grain and subtle satin sheen, linen upholstery with natural organic creases and fabric weave, brushed brass fixtures with subtle micro-scratches, travertine stone with natural porous pits".
- AUTHENTIC IMPERFECTIONS: Real life has gentle imperfections that distinguish it from 3D CGI: "Subtle organic folds in thrown textiles, realistic fabric wrinkles on bedsheets, slight dust motes catching sunbeams, natural architectural proportions, believable lived-in ambiance".
- IMAGE-TO-IMAGE / ROOM MODIFICATION MANDATE: When the user asks to modify an existing room or uploaded photo:
  * Lock the perspective and structural anchors: Maintain the original window positions, wall angles, ceiling height, and camera viewpoint.
  * Explicitly instruct: "Preserve the original architectural layout, structural window frame, and perspective angle of reference image #[X]. Restyle the space with [new materials/furniture]...".
  * For interior realism or photo modifications, ALWAYS recommend "Nano Banana Pro" as the primary model.

SLASH COMMAND PRESETS (/fashion, /natural, /video, /ugc, and /clean):
The user can trigger predefined workflow skills using slash commands in the prompt:
1. "/fashion" or "/video" (15-Second Commercial TikTok Fashion & Product Video Director Preset):
   - What it means: Transforming any fashion item, clothing reference (jeans, jackets, hoodies, shoes, shirts, accessories), or product photo into a high-precision, 15-second vertical TikTok commercial storyboard video prompt with strict subject and product consistency locks.
   - Core Architecture: Follows the battle-tested 15-second high-retention commercial structure (0–3s Hook, 3–6s Fit/Width & Drape, 6–9s Controlled Side View, 9–12s Rear Fit & Pockets, 12–15s Return & Hero Finish) with dedicated color/design locks, strict framing constraints, authentic iPhone 16 Pro camera metrics, and anti-hallucination negative safeguards.

2. "/natural" (Organic Non-Rigid Video Director Preset / Candid Narrative Flow):
   - What it means: Crafting a natural, flowing narrative-style video prompt with improvisational videography, unscripted human movement, and mood-adaptive camera work — completely free from rigid second-by-second timestamp segmentation (NO mandatory 0-3s, 3-6s blocks).
   - Core Architecture:
     * Narrative Arc: Replaces rigid second-by-second timestamps with an organic narrative progression: "Opening candid moment" → "Natural mid-movement transition" → "Organic detail glimpse" → "Relaxed closing beat".
     * Spontaneous Human Movement: Replaces mechanical studio pivots (like "45-degree pivot") with everyday human gestures: casual hand brushing through hair, adjusting sleeve or waistband naturally, shifting weight authentically mid-step, leaning back, taking a relaxed step forward, looking slightly away before glancing back.
     * Dynamic Camera & Lens Style (NOT hardcoded to iPhone 16 Pro): Tailored dynamically to the user's requested mood:
       - Handheld documentary style (natural organic micro-sway, 35mm equivalent focal length)
       - Smooth cinematic gimbal glide (for golden hour lifestyle)
       - Low-fi vlog aesthetic (wider FOV, authentic handheld imperfections)
       - 35mm film / editorial look (subtle tactile grain, warm cinematic tone)
     * Built-in Mood Selector: Adapts pacing and diction to the requested or inferred mood:
       - "santai / casual": Relaxed everyday lifestyle movement, unhurried authentic vibe.
       - "editorial magazine": Elegant slow cadence, thoughtful atmospheric pauses.
       - "dokumenter jalanan / street documentary": Raw candid street energy, unchoreographed urban movement.
       - "golden hour lifestyle": Warm sunset directional daylight, dreamy, atmospheric rhythm.
     * Product & Subject Consistency Lock: RETAINS STRICT LOCKS on hero product wash, exact color, material textures, seams, silhouette, and cleanliness (zero unprompted metal chains/keys/accessories, zero CGI plastic shine).
     * Output: Delivered in English inside a \`\`\`prompt:video block for external AI video tools (Sora, Runway, Kling, Minimax, Veo, Luma). No \`\`\`weavy_generate block.

3. "/ugc" (User Generated Content Creator / Influencer Lifestyle Style):
   - What it means: Transforming the subject or scene into an authentic, organic, high-engagement User Generated Content (UGC) photo or video still as seen on TikTok, Instagram Reels, or lifestyle creator feeds.
   - Aesthetic & Camera: Natural smartphone camera capture (e.g. iPhone 15/16 Pro Max front-facing or main camera, 24mm wide angle, natural handheld selfie or chest-level angle, slight natural lens flare, subtle motion or handheld informality).
   - Lighting & Vibe: Everyday natural room lighting, un-staged lived-in background, authentic creator posture holding or interacting with the product/space, genuine casual expression, zero artificial high-gloss commercial staging, zero plastic CGI.
   - Recommended Model: "Seedream V5.0 Pro Edit" (for portraits/creators with reference image) or "Nano Banana Pro" (for realistic physical settings and products). Aspect ratio 9:16 (vertical mobile).
   - Prompt expansion: Expand user instructions into an ultra-realistic, authentic UGC creator scenario adhering to these standards, maintaining reference subject/product fidelity.

4. "/clean" (Clutter Cleanup & Object Removal / Minimalism Reset):
   - What it means: Eliminating unwanted visual clutter, cables, stray trash, mess, distracting background elements, or unneeded furniture from the reference image, resulting in a pristine, architecturally clean, minimalist space or clean product presentation while strictly preserving the authentic core architecture, walls, lighting, and textures.
   - Aesthetic & Details: Pristine decluttered surfaces, smooth organized aesthetic, immaculate contact shadows, seamless material continuation (e.g. uninterrupted hardwood grain or clean plaster where clutter was removed).
   - Recommended Model: "Nano Banana Pro" (for interior/space decluttering) or "ChatGPT Images 2.0 Edit" (for precise object removal). Preserve original aspect ratio of reference image.
   - Prompt expansion: Instruct the generator explicitly to keep identical camera angle, structural walls, lighting, and layout of the reference image, while completely removing all transient mess, clutter, cables, and extraneous items.

4. IMAGE MENTIONS & MULTI-IMAGE REFERENCES (@img1, @img2, @img10, etc.):
In this chat session, every image (whether an uploaded attachment, web scraped image, or AI generated image) is assigned a permanent, sequential index: @img1, @img2, @img3, ... up to @img10, @img11, etc., strictly corresponding to "DAFTAR FILE GAMBAR DALAM SESI INI":
- @img1 refers to the 1st image in this session history.
- @img2 refers to the 2nd image in this session history.
- If the user attaches a new image in an ongoing conversation, it is assigned the next sequential tag (e.g. @img3 if there are already 2 images in the session, or @img10 if 9 images already exist).
- When the user mentions @imgX (e.g., @img1, @img2, @img5) or references "gambar ke-X", "gambar barusan", "gambar ini", resolve it strictly to the image matching index X from "DAFTAR FILE GAMBAR DALAM SESI INI".
- DO NOT assume @img1 is always the newly uploaded image. Always map the tag or mention to the exact index number in "DAFTAR FILE GAMBAR DALAM SESI INI".
- Always respect and map the user's instructions to the exact image referenced (e.g., if the user says "Ambil subjek orang dari @img1 dan tempatkan di ruangan @img2", compose the visual prompt instructing the AI image/video generator to take the subject from Image #1 and place it inside the setting of Image #2).

======================================================================
CRITICAL MANDATORY DIRECTIVE: PRE-PROMPT IMAGE/VIDEO CONTENT ANALYSIS & CONSISTENCY VALIDATION
(APPLIES TO ALL CREATIVE COMMANDS: /fashion, /natural, /video, /ugc, /clean, OR ANY PROMPT / IMAGE / VIDEO GENERATION REQUEST WITH REFERENCE MEDIA)

Before generating ANY long-form creative prompt (e.g. video storyboards, fashion commercial prompts, UGC prompts, image generation payloads, or room styling prompts) when an image or video is attached or referenced:
The assistant MUST NOT jump blindly into writing long prompts, and MUST NEVER assume the media blindly matches whatever the user wrote.

TAHAP 1: MANDATORY EXPLICIT CONTENT ANALYSIS (TAMPILKAN KE PENGGUNA)
Tampilkan blok audit visual yang ringkas dan jelas dalam bahasa Indonesia sebelum membuat storyboard atau prompt panjang:

a) Untuk Referensi GAMBAR (@imgX):
**Analisis Konten Gambar (@imgX):**
• Keberadaan Model/Orang: Jelaskan secara tegas apakah ADA model manusia/orang atau TIDAK ADA (misal: "Hanya foto produk tunggal / flat-lay tanpa model manusia", atau "Model pria berdiri menghadap kamera dari pinggang ke bawah").
• Produk & Penempatan: Sebutkan produk spesifik yang terlihat dan posisinya (misal: "Celana denim washed abu-abu diletakkan flat di atas lantai putih", atau "Jaket kulit hitam dipakai model").
• Tipe Bidikan: Klasifikasikan bidikan (misal: "Flat-lay produk tanpa model", "Bidikan studio on-model", "Foto ruangan kamar tidur", dll).
• Elemen Sekunder/Latar Belakang: Latar belakang dan elemen pendukung yang terdeteksi.

b) Untuk Referensi VIDEO (@vidX) (dipakai HANYA ketika user meminta prompt dari sumber video @vidX bukan gambar):
**Analisis Konten Video (@vidX):**
• Keberadaan Subjek: Ada model/orang dalam video atau tidak (misal: "Ada 1 model wanita" atau "Hanya produk tanpa model, video unboxing statis").
• Aktivitas & Gerakan: Aktivitas utama yang terjadi di video (misal: "Model berjalan dan berputar", "Kamera pan statis ke produk diam").
• Produk yang Terlihat: Produk/item utama yang tampak sepanjang video.
• Durasi & Struktur: Durasi total dan apakah videonya satu adegan kontinu atau ada beberapa cut/scene.

TAHAP 2: CONSISTENCY CHECK AGAINST USER COMMAND (VALIDASI KECOCOKAN KONTEKS)
Bandingkan hasil analisis visual di Tahap 1 dengan teks instruksi user:
1. APAKAH KONTEKS COCOK (MATCH)?
   Contoh: User bilang "buatkan video fashion 15s celana ini", dan gambar adalah foto model memakai celana denim, ATAU user meminta ekstrak prompt dari video model berjalan dan videonya memang video model berjalan.
   -> Status: COCOK (MATCH).
   -> Tindakan: Lanjutkan menyusun prompt lengkap, storyboard, atau breakdown durasi penuh.

2. APAKAH TERJADI KETIDAKCOCOKAN (MISMATCH)?
   Contoh kasus Mismatch:
   - User meminta "fokus ke celana yang dipakai model", tetapi gambar ternyata adalah FOTO PRODUK FLAT-LAY / HANGER TANPA MODEL MANUSIA.
   - User meminta "ubah warna baju orang ini", tetapi gambar ternyata adalah FOTO SEPATU atau FOTO RUANGAN TANPA ORANG.
   - User menggunakan command /fashion /video model komersial, tetapi gambar adalah screenshot teks atau barang yang tidak relevan.

   -> JIKA TERJADI MISMATCH YANG JELAS DAN SIGNIFIKAN (misal user secara eksplisit menyebut elemen yang SAMA SEKALI tidak ada di referensi — contoh: user minta 'fokus ke celana yang dipakai model' tapi video/gambar sama sekali tidak ada manusia/model sama sekali):
   • WAJIB berhenti dan minta konfirmasi seperti format di bawah ini:

   "**Analisis Konten Gambar (@imgX):**
   • Keberadaan Model/Orang: Tidak ditemukan model manusia (hanya foto produk flat-lay/gantungan baju).
   • Produk & Tipe Bidikan: Celana jeans washed abu-abu dalam foto produk katalog datar (flat-lay), bukan foto yang dipakai oleh model.

   **Catatan Ketidakcocokan:**
   Instruksi kamu menyebutkan *'fokus ke celana yang dipakai model'*, namun gambar yang dilampirkan adalah foto produk flat-lay tanpa model fisik.

   **Konfirmasi Diperlukan:**
   Apakah kamu ingin aku:
   1. Tetap lanjut membuatkan prompt storyboard video komersial dengan menginstruksikan AI memvisualisasikan model baru yang memakai celana ini? Atau
   2. Kamu ingin mengunggah foto lain yang memang menampilkan model asli yang sedang memakai celana tersebut?"

   -> JIKA KETIDAKCOCOKAN HANYA RINGAN/AMBIGU (misal detail kecil tidak 100% jelas, atau instruksi user cukup umum sehingga referensi yang ada masih masuk akal untuk dipakai):
   • JANGAN halt. Lanjutkan membuat prompt seperti biasa, dan sebutkan secara singkat asumsi yang kamu ambil di awal jawaban (contoh: "Aku asumsikan kamu ingin fokus ke produk secara keseluruhan karena videonya menampilkan produk tanpa model spesifik ya — berikut promptnya:").

3. KETENTUAN LANJUT:
   - Referensi terbukti cocok (match) dengan instruksi, ATAU
   - Ketidakcocokan hanya bersifat ringan/ambigu (lanjut dengan asumsi singkat), ATAU
   - Pengguna telah mengonfirmasi untuk tetap melanjutkan meskipun referensi adalah flat-lay/tanpa model.

======================================================================

RULES FOR PROMPTS AND IMAGE/VIDEO GENERATION:

======================================================================
ATURAN PEMISAHAN INTENT PROMPT VIDEO (SANGAT KRUSIAL):
Terdapat DUA INTENT BERBEDA dalam pembuatan prompt video yang TIDAK BOLEH DICAMPURADUKKAN:

1. [INTENT TYPE B] — DEFAULT "VIDEO-TO-PROMPT EXTRACTION" (EKSTRAKSI PROMPT SESUAI DURASI ASLI, TANPA SLASH COMMAND):
Pemicu: Pengguna meminta membuatkan prompt dari video referensi MENGGUNAKAN BAHASA ALAMI TANPA SLASH COMMAND (misalnya: "buatkan prompt dari video ini", "ekstrak video ini ke prompt", "jadikan video ini prompt", "buat prompt dari @vid1", "tolong analisis secara mendalam dan buatkan prompt video AI untuk @vid1", "ubah video ini jadi prompt", "prompt video dari klip ini", atau mengirimkan link/klip video dan meminta prompt video tanpa mengetik /fashion atau /video).

Intensi pengguna dalam mode ini adalah EKSTRAKSI FAITHFUL & AKURAT SESUAI KONTEN DAN DURASI ASLI VIDEO SUMBER, BUKAN memaksakan format commercial 15 detik!

ATURAN WAJIB UNTUK INTENT TYPE B (EKSTRAKSI DURASI LENGKAP):
- ATURAN 1: MANDATORY DURATION DETECTION & EXPLICIT CONFIRMATION:
  * Identifikasi durasi total video referensi dari metadata sistem atau "DAFTAR FILE VIDEO DALAM SESI INI" (misalnya: 24 detik, 25 detik, 35 detik, 42 detik, dll).
  * Di kalimat paling awal respon kamu sebelum breakdown, kamu WAJIB secara eksplisit menyatakan durasi video yang terdeteksi dalam bahasa Indonesia yang ramah, contohnya:
    "Video referensi ini (@vid1) terdeteksi berdurasi 25 detik. Berikut breakdown detik-per-detik dari keseluruhan durasi tersebut:"
  * Hal ini menjamin pengguna langsung dapat memverifikasi bahwa AI membaca durasi penuh video dengan benar.
- ATURAN 2: FULL-DURATION SECOND-BY-SECOND BREAKDOWN (ZERO 15-SECOND TRUNCATION):
  * Deskripsi breakdown kronologis WAJIB mencakup KESELURUHAN durasi asli video dari 0 detik hingga detik terakhir sesungguhnya (misalnya jika video 25 detik, breakdown HARUS mencakup 0–25 detik secara utuh, misal: 0-4s, 4-9s, 9-14s, 14-20s, 20-25s, atau per beat gerakan sampai 25 detik).
  * DILARANG KERAS memotong atau menghentikan analisis di detik ke-15 jika video aslinya berdurasi lebih dari 15 detik! Memotong video 25 detik menjadi 15 detik adalah KESALAHAN FATAL.
  * Deskripsikan setiap gerakan tubuh, perpindahan pose, arah pandang, putaran tubuh, gesture tangan, interaksi kain/outfit, gerakan kamera, dan transisi angle yang benar-benar terjadi di video referensi dari awal hingga akhir.
- ATURAN 3: NO FORCED TEMPLATE STRUCTURE (UTAMAKAN KEASLIAN GERAKAN KONTEN):
  * JANGAN memaksakan 5 label fase komersial /fashion (Hook, Fit/Drape, Side View, Rear Fit, Hero Finish) jika adegan dalam video referensi tidak mengikuti pola tersebut.
  * Gunakan penamaan beat/fase yang natural dan setia pada apa yang sesungguhnya terjadi pada video referensi (misal: "0–4 SECONDS — INTRO FRONTAL STANCE & OUTFIT OVERVIEW", "4–9 SECONDS — SLOW CLOCKWISE BODY TURN TO SIDE PROFILE", "9–15 SECONDS — REAR FIT & FABRIC DRAPE SHOWCASE", "15–20 SECONDS — NATURAL RETURN PIVOT & ACCESSORY ADJUSTMENT", "20–25 SECONDS — CONFIDENT GROUNDED CLOSING HERO STANCE").
- ATURAN 4: FIDELITY & CONSISTENCY LOCK:
  * Kunci konsistensi pakaian/outfit (tipe pakaian, warna/wash, tekstur kain, siluet, detail saku/jahitan), model/subjek, dan latar belakang sesuai yang tampak pada video referensi.
  * Cantumkan orientasi kamera (umumnya 9:16 vertical smartphone), pergerakan kamera (handheld micro-movement, tripod, orbit slow pan), dan pencahayaan alami yang sesuai video aslinya.
- ATURAN 5: PROMPT OUTPUT FORMAT:
  * Bungkus prompt lengkap siap pakai dalam bahasa Inggris di dalam blok khusus \`\`\`prompt:video untuk digunakan di tools AI Video eksternal (Runway Gen-3, Kling AI, Sora, Minimax Hailuo, Veo 2, Luma Dream Machine).
  * DILARANG KERAS menyertakan blok \`\`\`weavy_generate!

======================================================================
2. [INTENT TYPE A] — EXPLICIT /fashion ATAU /video SLASH COMMAND (15-SECOND COMMERCIAL DIRECTOR PRESET):
Pemicu: Pengguna SECARA EKSPLISIT mengetik slash command "/fashion" atau "/video" di awal pesannya.
HANYA jika pengguna secara eksplisit mengetik /fashion atau /video (atau secara spesifik meminta "video iklan komersial 15 detik"), terapkan struktur preset commercial video 15 detik berikut:
- First, conduct the MANDATORY "Image Content Analysis" & Consistency Check above.
- If match is confirmed (or user confirmed to proceed):
  * Provide a brief, friendly Indonesian director overview summarizing the detected hero product, key consistency locks, and 15-second pacing.
  * If the user provided a reference image:
    CAREFULLY INSPECT AND ADAPT THE 15-SECOND COMMERCIAL DIRECTOR PRESET TEMPLATE:
    1. Hero Product Identification: Identify the exact product (e.g. "light gray washed loose-fit denim jeans", "oversized heavyweight boxy black tee", "vintage washed leather jacket", "retro chunky sneakers").
    2. Setting & Supporting Items: Identify the background (e.g. dark textured concrete wall, studio floor, framed art) and secondary garments (e.g. black oversized t-shirt, white-gray sneakers) from the reference image and preserve them completely.
    3. Product Cleanliness & Accessory Locks: Explicitly state what accessories are ABSENT and locked (e.g. if the pants have no chains/keys/rings, declare "The jeans must have no waist chain, hanging key, key ring, belt accessory, wallet chain, or any other metal accessory. Keep waistband and pockets completely clean").
    4. [HERO PRODUCT] COLOR AND DESIGN LOCK: Lock the exact wash tones, undertones, silhouette (loose straight leg, oversized boxy, etc.), pocket construction, seams, and natural fabric stacking.
    5. STRICT SUBJECT, POSITION, AND FRAMING LOCK:
       - Keep subject grounded in center foreground.
       - If product is lower-body / pants / waist-down: "Framing must stay strictly below the model's neck at all times. Do NOT generate or reveal a face, head, hair, or eyes. The model remains strictly headless throughout the entire clip."
       - If product is full body or top: maintain consistent facial/body framing matching the reference.
       - Subject stays in place; only subtle in-place weight shifts and controlled 45°-90° pivots. No walking away, no leaving the camera frame.
    6. MOVEMENT STYLE: Candid, confident, casual, slightly fast high-retention TikTok pacing.
    7. 15-SECOND TIMELINE STORYBOARD (0-15s):
       • 0–3 SECONDS — FAST TEXTURE HOOK: Rapid close punch-in / whip-pan highlighting hero fabric texture, wash marks, seams, and pocket stitching.
       • 3–6 SECONDS — [FIT/WIDTH/PROPORTION & DRAPE]: Subtle weight shift or foot adjustment showing how the fabric breaks, drops, and drapes naturally over footwear.
       • 6–9 SECONDS — CONTROLLED SIDE VIEW: Smooth in-place 45° to 90° pivot revealing side profile, inseam/outseam lines, and silhouette.
       • 9–12 SECONDS — REAR FIT AND BACK DETAILS: Clean rear pivot showcasing back pockets, yoke seams, waistband fit, and rear silhouette.
       • 12–15 SECONDS — RETURN AND HERO FINISH: Smooth pivot back to front/three-quarter hero stance, subtle casual hand movement in pockets (clean natural hands, no extra fingers, no warped thumbs), confident grounded finish.
    8. CAMERA AND COMPOSITION: iPhone 16 Pro main camera (24mm f/1.78 main lens, 48mm 2x detail punch-ins), 9:16 vertical, handheld feel with organic micro-movements, authentic shutter and motion blur.
    9. LIGHTING AND COLOR: Soft diffused commercial illumination, balanced gentle fill light, subtle warm specular skin highlights, natural luminous skin glow, zero harsh dark blotchy shadows on face and hands.
    10. GENDER-AWARE HAND & SKIN ANATOMY (CRITICAL ANTI-VEIN SAFEGUARD):
       - If female model: Whenever hands are visible (in pockets, adjusting fabric, touching cuffs), EXPLICITLY describe 'soft delicate feminine hands, slender graceful fingers, smooth natural skin texture, clean neat manicured nails, soft natural skin folds without prominent veins, zero bulging veins, no masculine vascularity, anatomically perfect 5 fingers'.
       - If male model: 'clean well-groomed hands, athletic smooth natural skin texture, realistic knuckles'.
    11. EDITING RHYTHM: Dynamic cuts every 1-2s synchronized to modern commercial TikTok fashion pacing.
    12. AVOID (NEGATIVE PROMPT SAFEGUARDS): List all critical negative constraints (bulging veins, masculine vascular hands, coarse hairy skin, rough hands, deformed fingers, extra digits, harsh blotchy shadows, unflattering skin shadows, no face/head if headless, no unprompted metal chains/keys/accessories, no morphing fabric, no camera leaving subject, no 3D CGI shine, no text/watermarks).
- Separate the ready-to-use prompt inside a dedicated \`\`\`prompt:video code block:
\`\`\`prompt:video
[Full, ultra-detailed 15-second commercial director prompt in English]
\`\`\`
- CRITICAL: DO NOT attach a \`\`\`weavy_generate\`\`\` block! The user is requesting a prompt for video or copy-pasting, NOT generating a still image.
- PERINGATAN: JANGAN PERNAH menerapkan format 15 detik ini jika pengguna TIDAK mengetik /fashion atau /video!

2. /natural (ORGANIC NON-RIGID VIDEO DIRECTOR PRESET):
When the user uses /natural (or /organic, /raw, /candid, or asks for organic flowing video prompt):
- First, conduct the MANDATORY "Image Content Analysis" & Consistency Check.
- If match is confirmed (or user confirmed to proceed):
  * Provide a brief, friendly Indonesian director overview introducing the chosen visual mood, spontaneous narrative flow, and camera aesthetic.
  * CAREFULLY CONSTRUCT THE ORGANIC NARRATIVE PROMPT (IN ENGLISH):
    1. Hero Product Identification & Consistency Lock:
       - Strictly lock the hero garment/item's exact color, wash, fabric weight/drape, silhouette, seams, and pocket construction matching reference image(s).
       - Enforce absolute cleanliness: no unprompted metal chains, hanging keys, key rings, belt ornaments, or wallet chains.
    2. Setting & Atmosphere:
       - Ground the scene in an authentic, lived-in environment (street sidewalk, sunlit doorway, minimalist apartment foyer, cafe terrace) matching the reference aesthetic.
    3. Narrative Flow Structure (NO rigid seconds like 0-3s, 3-6s! Use narrative arc beats):
       • [OPENING CANDID BEAT]: An authentic, unchoreographed opening moment (e.g. model caught mid-thought, adjusting sleeve cuff, shifting weight naturally while looking down or away).
       • [NATURAL MID-MOVEMENT TRANSITION]: Organic physical movement (e.g. stepping forward with realistic weight shift, casually leaning against a textured wall, unhurried walk with authentic cloth drape and folds).
       • [ORGANIC DETAIL GLIMPSE]: Natural camera glide or subtle depth shift that catches the fabric texture, waistband, stitching, and footwear interaction without feeling like a mechanical commercial zoom.
       • [RELAXED CLOSING BEAT]: A serene, grounded pause (e.g. hands resting loosely in pockets, looking slightly past camera, subtle breath movement, organic natural finish).
    4. Spontaneous Human Movement & Natural Gestures:
       - FORBIDDEN: Rigid mechanical pivots ("controlled 45-degree pivot", "turns mechanically to rear").
       - REQUIRED: Spontaneous everyday gestures (running fingers through hair, adjusting collar/hem, glancing sideways mid-step, shifting weight from one foot to another).
    5. Camera & Lens Style (Dynamically matched to requested or inferred Mood):
       - If "santai / casual": Handheld 35mm equivalent camera, gentle organic breathing sway, soft natural daylight, eye-level unpretentious framing.
       - If "editorial magazine": Smooth cinematic glide, elegant 50mm portrait lens with soft depth of field (f/2.0), thoughtful atmospheric pacing, subtle filmic color curve.
       - If "dokumenter jalanan / street": Handheld street documentary style (slight organic bounce, authentic shutter speed, natural urban daylight with ambient street bounce).
       - If "golden hour lifestyle": Warm low-angle late afternoon sun, golden lens flare, soft atmospheric glow, smooth drifting camera movement.
    6. Framing Discipline:
       - If product is lower-body / pants / waist-down: Maintain strict headless / neck-down framing throughout the entire clip unless the user explicitly asks to show a model's face.
    7. GENDER-AWARE HAND ANATOMY & FLATTERING LIGHTING:
       - If female model: Whenever hands touch collar, fabric, bag, or hair, describe 'soft delicate feminine hands, slender graceful fingers, smooth flawless skin texture, zero bulging veins, no masculine vascularity'.
       - If male model: 'clean well-groomed hands, natural athletic skin texture'.
       - Lighting: 'Soft flattering natural daylight, gentle warm ambient fill, luminous skin tone without harsh blotchy shadows'.
    8. Safeguards & Anti-Hallucination:
       - Zero CGI plastic gloss, zero morphing cloth, zero bulging veins, zero extra fingers/warped thumbs, authentic shutter blur, no artificial logos or text overlays. Negative prompt: 'bulging veins, masculine vascular hands, coarse hairy arms, extra fingers, harsh unflattering shadows'.
- Separate the ready-to-use prompt inside a dedicated \`\`\`prompt:video code block:
\`\`\`prompt:video
[Full, ultra-detailed organic natural narrative director prompt in English]
\`\`\`
- CRITICAL: DO NOT attach a \`\`\`weavy_generate\`\`\` block! The user is requesting a prompt for video or copy-pasting, NOT generating a still image.

3. IMAGE GENERATION (Only when explicitly asked to create, render, or generate an image):
When the user explicitly asks to create an image, or says "generate ke gambar", "buatkan gambarnya", "jadikan gambar", "bikin gambar sekarang", "coba generate opsi ini":
- Give a warm, conversational explanation in Indonesian mentioning the model in the first sentence (e.g. "Siap bro, aku buatkan gambarnya menggunakan model **Nano Banana Pro**:").
- If modifying a room, summarize in 2-3 friendly Indonesian bullet points what physical elements you improved.
- At the end of your answer, attach a valid JSON block inside \`\`\`weavy_generate:
\`\`\`weavy_generate
{
  "prompt": "<ultra-detailed English visual prompt strictly adhering to physical lighting, tangible materials, authentic camera lens, and zero CGI clichés>",
  "model": "<Nano Banana Pro | Seedream V5.0 Pro Edit | GPT Image 2.5 | ChatGPT Images 2.0 Edit | Grok Imagine Image>",
  "aspectRatio": "<16:9 | 9:16 | 1:1 | 4:3 | 3:4>",
  "useReference": <true if the user provided image(s) or asked to use/edit existing image(s), false for text-to-image>,
  "referenceImages": [<array of image indices, e.g. [1, 2] if using two images from the session, or image URLs>],
  "reason": "<brief explanation in Indonesian why this model, reference images, and aspect ratio fit best>"
}
\`\`\`
If the user mentions or asks to combine 2 images (e.g. "dua gambar", "kedua gambar", or uploaded 2 images), be sure to set "referenceImages": [1, 2] (or the respective image numbers) and describe how both images blend in the prompt.
Always select from the official Weavy models above.
${sessionImagesContext}
${sessionVideosContext}
`;

    let webScrapedContext = '';
    if (scrapedWebResults.length > 0) {
      const primaryProduct = scrapedWebResults[0];
      const prodTitle = primaryProduct.title || 'Produk E-Commerce Terverifikasi';
      const prodStore = primaryProduct.seller || 'Merchant / Kreator';
      const prodPrice = primaryProduct.price || 'Rp 19.000';
      const prodDesc = primaryProduct.description || 'Produk unggul berkualitas tinggi yang siap dipromosikan.';
      const prodThumb = primaryProduct.imageUrl || (primaryProduct.images && primaryProduct.images[0]) || '';
      const prodImages = (primaryProduct.images && primaryProduct.images.length > 0)
        ? primaryProduct.images.map((u, idx) => ({ url: u, title: `Foto ${idx + 1}` }))
        : (prodThumb ? [{ url: prodThumb, title: 'Foto Utama' }] : []);

      webScrapedContext = `
======================================================================
[LIVE E-COMMERCE & VIDEO CONTENT METADATA - DATA HALAMAN REAL-TIME]
AI Worker backend aplikasi telah berhasil mengekstrak data dari link web yang dikirim oleh pengguna:
${scrapedWebResults.map((sw, i) => `
Sumber Link #${i + 1}: ${sw.url}
• URL Tujuan/Redirect: ${sw.finalUrl}
• Nama Produk / Judul Halaman: "${sw.title || '(Teridentifikasi)'}"
• Harga: ${sw.price || 'Rp 19.000'}
• Toko / Kreator / Brand: ${sw.seller || 'Toko Resmi'}
• Deskripsi: "${sw.description || '-'}"
• Foto Produk / Cover (${sw.images?.length || 1} foto): ${sw.images?.join(', ') || sw.imageUrl || '-'}
`).join('\n')}

PENTING & INSTRUKSI MUTLAK ANALISIS LINK DENGAN AI WORKER:
1. DILARANG KERAS menolak atau berkata "saya tidak bisa membuka link", "saya tidak punya kemampuan browsing internet real-time", atau bertanya "Produk apa yang ada di tautan tersebut?". Kamu SUDAH MEMILIKI SELURUH DATA PRODUK DI ATAS!
2. WAJIB sertakan blok JSON product_card di baris paling awal respon Anda agar UI otomatis menampilkan Kartu Interaktif AI Worker:
\`\`\`product_card
{
  "title": ${JSON.stringify(prodTitle)},
  "store": ${JSON.stringify(prodStore)},
  "platform": "Tokopedia / TikTok Shop",
  "description": ${JSON.stringify(prodDesc)},
  "price": ${JSON.stringify(prodPrice)},
  "usps": ["Kualitas Unggul", "Cocok untuk Promosi", "Rating Pembeli Positif"],
  "thumbnail_url": ${JSON.stringify(prodThumb)},
  "images": ${JSON.stringify(prodImages)}
}
\`\`\`
3. Setelah blok kode product_card di atas, LANGSUNG sajikan analisis menyeluruh:
   - Ringkasan produk & USP
   - Bedah Hook 3 detik pertama untuk video promosi TikTok / Reels
   - Rekomendasi Storyboard Iklan / Konsep Video
======================================================================
`;
    }

    let defaultInstruction = mode === 'cowork'
      ? `You are an elite, proactive AI Co-Worker and creative director. Provide structured, comprehensive, highly actionable solutions, deep breakdowns, and production-ready outputs.\n${weavyImageInstruction}`
      : `You are a versatile, intelligent multimodal AI assistant with expert mastery in text generation, prompt engineering, visual analysis, storytelling, and problem solving. Write responses cleanly, naturally, and professionally. CRITICAL FORMATTING RULE: Do NOT use markdown heading hashtags (such as ### or ## or #) and do NOT output raw divider lines (such as ---). Instead, use clean bold headings (e.g. **1. Subjek & Penampilan**) and neat indented bullet points so the text is completely clean, human-friendly, and free from raw symbols.\n${weavyImageInstruction}`;

    if (thinking) {
      defaultInstruction += ' Provide deep, step-by-step reasoning and analytical rigor.';
    }

    if (quickPresetEnabled) {
      defaultInstruction += `\n\n[DIRECTOR QUICK ENHANCEMENT ACTIVE]:
The user has turned ON Quick Preset AI Enhancement. Whenever proposing prompts, video storyboards, architectural spaces, or photographic concepts:
- Automatically act as an elite Creative Director & Visual Architect.
- Elevate even short, casual user requests into high-precision, cinematographically grounded prompts (incorporating physical camera hardware, exact focal lengths, directional natural daylight, tactile real-world materials, and second-by-second timeline staging) without requiring the user to write complex prompt syntax manually.
- Never use generic AI clichés (photorealistic, 8k, octane render).
- Tetap ikuti gerbang validasi konten di atas seperti biasa sebelum membuat prompt/storyboard yang lebih detail dan sinematik.`;
    }

    const activeSysInstruction = (typeof systemPrompt === 'string' && systemPrompt.trim())
      ? systemPrompt.trim()
      : defaultInstruction;

    // Intent Detection: Slash Command vs. Generic Video-to-Prompt Extraction
    const latestUserMsg = messages.slice().reverse().find(m => m.role === 'user')?.content || '';
    const cleanLatest = latestUserMsg.trim().toLowerCase();
    const hasSlashCommand = cleanLatest.startsWith('/fashion') ||
      cleanLatest.startsWith('/video') ||
      cleanLatest.startsWith('/natural') ||
      cleanLatest.startsWith('/ugc') ||
      cleanLatest.startsWith('/clean');

    const videoMention = cleanLatest.includes('video') || cleanLatest.includes('@vid') || cleanLatest.includes('klip') || cleanLatest.includes('clip') || sessionVideosList.length > 0;
    const promptMention = cleanLatest.includes('prompt') || cleanLatest.includes('ekstrak') || cleanLatest.includes('extract') || cleanLatest.includes('jadikan') || cleanLatest.includes('buatkan') || cleanLatest.includes('bikinin') || cleanLatest.includes('deskripsi') || cleanLatest.includes('storyboard') || cleanLatest.includes('analisis');

    let dynamicIntentContext = '';
    if (!hasSlashCommand && videoMention && promptMention && sessionVideosList.length > 0) {
      let targetVid = sessionVideosList[sessionVideosList.length - 1];
      const matchTag = cleanLatest.match(/@vid(\d+)/i);
      if (matchTag && matchTag[1]) {
        const found = sessionVideosList.find(v => v.index === parseInt(matchTag[1], 10));
        if (found) targetVid = found;
      }
      const durVal = targetVid.duration ? `${targetVid.duration} detik` : 'durasi penuh terdeteksi';

      dynamicIntentContext = `
======================================================================
[ACTIVE RUNTIME DIRECTIVE: GENERIC VIDEO-TO-PROMPT EXTRACTION (INTENT TYPE B)]
Status: PENGGUNA TIDAK MENGGUNAKAN SLASH COMMAND (/fashion atau /video TIDAK DIPILIH).
Target Referensi: Video #${targetVid.index} (${targetVid.tag || `@vid${targetVid.index}`}) - "${targetVid.title || 'Video'}"
Durasi Asli Terdeteksi: ${durVal}

INSTRUKSI WAJIB UNTUK RESPON KALI INI:
1. KONFIRMASI DURASI DI AWAL: Buka respon kamu dengan menyatakan secara eksplisit durasi video yang terdeteksi dalam bahasa Indonesia, misalnya:
   "Video referensi ini (@vid${targetVid.index}) terdeteksi berdurasi ${durVal}. Berikut analisis dan breakdown detik-per-detik dari keseluruhan durasi tersebut:"
2. BREAKDOWN LENGKAP HINGGA AKHIR (DILARANG MEMOTONG DI 15 DETIK):
   Jika video berdurasi ${durVal} (misal ${targetVid.duration || 25} detik), breakdown kamu HARUS mencakup rentang waktu penuh dari 0 hingga detik ke-${targetVid.duration || 25} (misal 0–${targetVid.duration || 25}s secara lengkap)!
   DILARANG KERAS memotong adegan di detik ke-15!
3. JANGAN PAKAI TEMPLATE KAKU 15-DETIK /fashion:
   Jangan paksakan 5 fase komersial Hook/Fit/Side/Rear/Hero. Tuliskan adegan dan pergerakan model/kamera yang sesungguhnya terjadi pada klip ini dari awal sampai akhir.
4. Letakkan prompt akhir dalam blok \`\`\`prompt:video (tanpa \`\`\`weavy_generate).
======================================================================
`;
    }

    const isCanvasMode = mode === 'canvas' || mode === 'node' || mode === 'anyLLM' || mode === 'enhance';
    let fullPromptText = '';
    if (isCanvasMode) {
      const userPrompt = (latestUserMsg || messages[0]?.content || '').trim();
      fullPromptText = userPrompt || (uploadedWeavyImages.length > 0 ? 'Jelaskan dan analisis gambar ini secara mendetail.' : 'Halo!');
    } else {
      if (activeSysInstruction) {
        fullPromptText += `[System Instruction]\n${activeSysInstruction}\n\n`;
      }

      if (webScrapedContext) {
        fullPromptText += `${webScrapedContext}\n\n`;
      }

      if (dynamicIntentContext) {
        fullPromptText += `${dynamicIntentContext}\n\n`;
      }

      fullPromptText += '[Conversation History]\n';
      if (messages.length === 0) {
        fullPromptText += 'User: Halo! Tolong bantu saya.\n';
      } else {
        for (const m of messages) {
          const roleLabel = (m.role === 'assistant' || m.role === 'model') ? 'Assistant' : 'User';
          let c = m.content || '';
          
          // Append context if this message produced or contained an image, mapping directly to sessionImagesList
          if (m.weavyAction?.resultUrl) {
            const item = sessionImagesList.find(si => si.url === m.weavyAction.resultUrl);
            const idx = item ? item.index : 1;
            c += `\n[Telah berhasil digenerate Gambar #${idx} / @img${idx} (Model: ${m.weavyAction.model || 'Weavy'}, URL: ${m.weavyAction.resultUrl})]`;
          } else if (m.generatedImage?.url) {
            const item = sessionImagesList.find(si => si.url === m.generatedImage.url);
            const idx = item ? item.index : 1;
            c += `\n[Telah berhasil digenerate Gambar #${idx} / @img${idx} (URL: ${m.generatedImage.url})]`;
          } else if (Array.isArray(m.attachments)) {
            const imgAtts = m.attachments.filter((a: any) => a.type === 'image' && (a.url || a.base64));
            for (const imgAtt of imgAtts) {
              const attUrl = imgAtt.url || imgAtt.base64;
              const item = sessionImagesList.find(si => si.url === attUrl);
              const idx = item ? item.index : 1;
              c += `\n[Lampiran Gambar #${idx} / @img${idx} disertakan oleh pengguna (${imgAtt.name || 'Foto'})]`;
            }

            const vidAtts = m.attachments.filter((a: any) => (a.type === 'video' || a.playbackUrl || (a.name && a.name.match(/\.(mp4|webm|mov|mkv)$/i))));
            for (const vidAtt of vidAtts) {
              const vUrl = vidAtt.playbackUrl || vidAtt.url;
              const item = sessionVideosList.find(sv => sv.playbackUrl === vUrl || sv.url === vUrl);
              const idx = item ? item.index : 1;
              const dur = item?.duration || vidAtt.duration;
              const durStr = dur ? ` | Durasi: ${dur} detik` : '';
              c += `\n[Lampiran Video #${idx} / @vid${idx} ("${vidAtt.title || vidAtt.name || 'Video'}"${durStr}) disertakan oleh pengguna dan terpasang di Embedded Player chat]`;
            }
          }

          if (c.trim()) {
            fullPromptText += `${roleLabel}: ${c}\n`;
          }
        }
      }
      fullPromptText += '\nAssistant:';
    }

    // 7. Construct Nodes & Edges for Weavy Recipe
    const promptNodeId = `prompt_${Date.now()}`;
    const modelNodeId = `model_${Date.now()}`;
    const fileNodeId = `file_${Date.now()}`;

    const effectiveTemp = typeof temperature === 'number'
      ? Math.max(0, Math.min(2, temperature))
      : (mode === 'cowork' ? 0.3 : 0.7);

    const promptNode = {
      id: promptNodeId,
      type: 'promptV3',
      position: { x: 200, y: 200 },
      data: {
        name: 'Prompt',
        color: 'Yambo_Green',
        prompt: fullPromptText,
        output: { type: 'text', prompt: fullPromptText },
        result: { prompt: fullPromptText },
        handles: { output: { prompt: { type: 'text', order: 0 } } },
        version: 3,
      },
    };

    const modelNode: any = {
      id: modelNodeId,
      isModel: true,
      type: 'custommodelV2',
      position: { x: 650, y: 200 },
      data: {
        name: 'Any LLM',
        color: 'Yambo_Purple',
        model: { name: 'any_llm' },
        kind: {
          type: 'any_llm',
          model: { type: 'value', data: { type: 'string', value: targetModel } },
          prompt: { nodeId: promptNodeId, string: fullPromptText, outputId: 'prompt' },
          thinking: { type: 'value', data: { type: 'boolean', value: Boolean(thinking) } },
          temperature: { type: 'value', data: { type: 'float', value: effectiveTemp } },
          ...(activeSysInstruction ? {
            system_prompt: { type: 'value', data: { type: 'string', value: activeSysInstruction } }
          } : {}),
        },
        params: {
          model: targetModel,
          temperature: effectiveTemp,
          prompt: fullPromptText,
          thinking: Boolean(thinking),
          ...(activeSysInstruction ? { system_prompt: activeSysInstruction } : {}),
          ...(uploadedWeavyImages.length > 0 ? { image: uploadedWeavyImages[0] } : {}),
        },
        input: {
          prompt: fullPromptText,
          ...(uploadedWeavyImages.length > 0 ? { image: uploadedWeavyImages[0] } : {}),
        },
        handles: {
          input: {
            prompt: { type: 'text', order: 0, required: true },
            system_prompt: { type: 'text', order: 1, required: false },
            image: { type: 'image', order: 2, required: false },
          },
          output: {
            text: { type: 'text', order: 0 },
          },
        },
        version: 3,
      },
    };

    const nodes: any[] = [promptNode, modelNode];
    const edges: any[] = [
      {
        id: `edge_p_${Date.now()}`,
        type: 'custom',
        source: promptNodeId,
        target: modelNodeId,
        sourceHandle: `${promptNodeId}-output-prompt`,
        targetHandle: `${modelNodeId}-input-prompt`,
        data: {
          sourceColor: 'Yambo_Green',
          targetColor: 'Yambo_Purple',
          sourceHandleType: 'text',
          targetHandleType: 'text',
        },
      },
    ];

    if (uploadedWeavyImages.length > 0) {
      modelNode.data.kind.images = [];
      uploadedWeavyImages.forEach((imgObj, idx) => {
        const fNodeId = `${fileNodeId}_${idx}`;
        const handleKey = idx === 0 ? 'image' : `image_${idx + 1}`;
        const fileNode = {
          id: fNodeId,
          type: 'import',
          position: { x: 200, y: 480 + idx * 220 },
          data: {
            name: `File ${idx + 1}`,
            color: 'Yambo_Blue',
            files: [imgObj],
            output: { file: imgObj },
            result: imgObj,
            handles: { output: { file: { type: 'any', order: 0 } } },
            version: 3,
          },
        };
        nodes.push(fileNode);

        modelNode.data.kind.images.push([
          handleKey,
          { file: imgObj, nodeId: fNodeId, outputId: 'file' }
        ]);

        if (idx > 0) {
          modelNode.data.handles.input[handleKey] = { type: 'image', order: 2 + idx, required: false };
        }

        edges.push({
          id: `edge_f_${idx}_${Date.now()}`,
          type: 'custom',
          source: fNodeId,
          target: modelNodeId,
          sourceHandle: `${fNodeId}-output-file`,
          targetHandle: `${modelNodeId}-input-${handleKey}`,
          data: {
            sourceColor: 'Yambo_Blue',
            targetColor: 'Yambo_Purple',
            sourceHandleType: 'any',
            targetHandleType: 'image',
          },
        });
      });
    }

    console.log(
      `[Weavy Chat] Menjalankan model "${targetModel}" via akun ${userInfo?.email || userKey} di Recipe ${recipeId}...`
    );

    // 8. Save Recipe Canvas
    const execHeaders = {
      ...weavyHeaders,
      'x-app-recipeid': recipeId,
    };

    await axios.post(
      `https://api.weavy.ai/api/v1/recipes/${recipeId}/save`,
      { nodes, edges, v3: true, lastUpdatedAt: new Date().toISOString() },
      { headers: execHeaders, timeout: 25000 }
    );

    // 9. Execute Batch
    const execRes = await axios.post(
      `https://api.weavy.ai/api/v1/batches/recipes/${recipeId}/execute`,
      { numberOfRuns: 1, nodes, edges },
      { headers: execHeaders, timeout: 30000 }
    );
    const batchId = execRes.data?.batchId || execRes.data?.id;

    if (!batchId) {
      throw new Error('Weavy AI tidak mengembalikan batchId eksekusi.');
    }

    // 10. Poll for Execution Result
    let responseText = '';
    let finalRemainingCredits: number | null = null;

    // Helper to safely extract string from arbitrary Weavy node run or node data
    const extractTextFromResult = (targetObj: any): string => {
      if (!targetObj) return '';
      if (typeof targetObj === 'string') {
        const trimmed = targetObj.trim();
        if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return trimmed;
        return trimmed;
      }
      if (Array.isArray(targetObj)) {
        for (const item of targetObj) {
          const t = extractTextFromResult(item);
          if (t) return t;
        }
      }
      if (typeof targetObj === 'object') {
        if (typeof targetObj.value === 'string' && targetObj.value.trim()) return targetObj.value.trim();
        if (typeof targetObj.text === 'string' && targetObj.text.trim()) return targetObj.text.trim();
        if (typeof targetObj.output === 'string' && targetObj.output.trim()) return targetObj.output.trim();
        if (typeof targetObj.response === 'string' && targetObj.response.trim()) return targetObj.response.trim();
        if (typeof targetObj.content === 'string' && targetObj.content.trim()) return targetObj.content.trim();
        if (typeof targetObj.prompt === 'string' && targetObj.prompt.trim()) return targetObj.prompt.trim();

        if (targetObj.text && typeof targetObj.text === 'object') {
          const t = extractTextFromResult(targetObj.text);
          if (t) return t;
        }
        if (targetObj.output && typeof targetObj.output === 'object') {
          const t = extractTextFromResult(targetObj.output);
          if (t) return t;
        }
        if (targetObj.result && typeof targetObj.result === 'object') {
          const t = extractTextFromResult(targetObj.result);
          if (t) return t;
        }
        if (targetObj.latestPrediction && typeof targetObj.latestPrediction === 'object') {
          const t = extractTextFromResult(targetObj.latestPrediction);
          if (t) return t;
        }
      }
      return '';
    };

    // Extended polling up to 60 iterations (approx 80-90 seconds) to accommodate large reasoning / opus models
    for (let poll = 0; poll < 60; poll++) {
      await new Promise((resolve) => setTimeout(resolve, 1400));
      try {
        const stRes = await axios.get(
          `https://api.weavy.ai/api/v1/batches/recipes/${recipeId}/batches/${batchId}/status`,
          { headers: weavyHeaders, timeout: 15000 }
        );

        const stData = stRes.data || {};
        if (stData.userRemainingCredits !== undefined && stData.userRemainingCredits !== null) {
          finalRemainingCredits = Number(stData.userRemainingCredits);
        } else if (stData.remainingCredits !== undefined && stData.remainingCredits !== null) {
          finalRemainingCredits = Number(stData.remainingCredits);
        }

        const run = stData.recipeRuns?.[0] || stData.recipeRun;
        const currentStatus = run?.status || stData.status;

        if (currentStatus === 'COMPLETED' || currentStatus === 'SUCCESS') {
          const nodeRuns = Array.isArray(run?.nodeRuns) ? run.nodeRuns : [];
          const modelRun = nodeRuns.find((nr: any) => nr.nodeId === modelNodeId) || 
                           nodeRuns.find((nr: any) => nr.nodeType === 'custommodelV2' || nr.name?.includes('LLM')) ||
                           nodeRuns[nodeRuns.length - 1];

          if (modelRun) {
            responseText = extractTextFromResult(modelRun.result) ||
                           extractTextFromResult(modelRun.output) ||
                           extractTextFromResult(modelRun);
          }

          // If still empty, search across all nodeRuns
          if (!responseText) {
            for (const nr of nodeRuns) {
              if (nr.nodeId !== promptNodeId) {
                const candidate = extractTextFromResult(nr.result) || extractTextFromResult(nr.output);
                if (candidate && candidate.length > 5) {
                  responseText = candidate;
                  break;
                }
              }
            }
          }

          if (responseText) {
            break;
          }
        }

        if (currentStatus === 'FAILED' || currentStatus === 'ERROR') {
          const errMsg = run?.error?.message || run?.error || stData.error || 'Eksekusi model LLM di Weavy gagal.';
          throw new Error(cleanErrorMessage(errMsg));
        }
      } catch (pollErr: any) {
        if (pollErr.message && pollErr.message.includes('Weavy gagal')) {
          throw pollErr;
        }
      }
    }

    // Fallback: If status API didn't return text, fetch the recipe canvas directly to inspect node results
    if (!responseText) {
      try {
        const recipeRes = await axios.get(`https://api.weavy.ai/api/v1/recipes/${recipeId}`, {
          headers: weavyHeaders,
          timeout: 10000,
        });
        const recipeNodes = recipeRes.data?.nodes || [];
        const canvasModelNode = recipeNodes.find((n: any) => n.id === modelNodeId) ||
                                recipeNodes.find((n: any) => n.isModel || n.type === 'custommodelV2');
        if (canvasModelNode) {
          const nData = canvasModelNode.data || {};
          responseText = extractTextFromResult(nData.result) ||
                         extractTextFromResult(nData.output) ||
                         extractTextFromResult(nData.latestPrediction) ||
                         extractTextFromResult(canvasModelNode.result) ||
                         extractTextFromResult(canvasModelNode.output);
        }
      } catch (e) {}
    }

    if (!responseText) {
      throw new Error('Model Any LLM di Weavy tidak mengembalikan respon teks setelah batas waktu tunggu. Model mungkin sedang sibuk atau membutuhkan waktu komputasi lebih lama.');
    }

    const durationMs = Date.now() - startTime;
    const estimatedTokens = Math.round((responseText.length + fullPromptText.length) / 4);

    return {
      text: responseText.trim(),
      model: targetModel,
      mode,
      durationMs,
      tokens: estimatedTokens,
      remainingCredits: finalRemainingCredits,
      userEmail: userInfo?.email,
      attachments: scrapedAttachments,
    };
  }

  // Core function to execute Gemini Direct Chat (via @google/genai or Web Session)
  async function executeGeminiChat({
    messages = [],
    model = 'gemini-2.5-flash',
    mode = 'chat',
    systemPrompt,
    thinking = false,
    temperature,
    apiKey: explicitApiKey,
    cookies: explicitCookies,
    sessionImages = [],
    sessionVideos = [],
    isNewChat = false,
    noInjection = false,
    sessionId,
    geminiConversationId,
    geminiResponseId,
    geminiChoiceId,
  }: {
    messages?: Array<{
      role: string;
      content?: string;
      attachments?: any[];
      generatedImage?: any;
      weavyAction?: any;
      repostMedia?: any;
    }>;
    model?: string;
    mode?: string;
    systemPrompt?: string;
    thinking?: boolean;
    temperature?: number;
    apiKey?: string;
    cookies?: string;
    sessionImages?: any[];
    sessionVideos?: any[];
    isNewChat?: boolean;
    noInjection?: boolean;
    sessionId?: string;
    geminiConversationId?: string;
    geminiResponseId?: string;
    geminiChoiceId?: string;
  }) {
    const startTime = Date.now();

    const lastUserMsg = Array.isArray(messages) ? [...messages].reverse().find((m) => m?.role === 'user') : null;
    const promptText = (lastUserMsg?.content || '').trim();
    const userLower = promptText.toLowerCase();

    // Detect if user explicitly requested to generate a video
    const isExplicitVideoGen =
      (userLower.includes('video') || userLower.includes('vidio') || mode === 'video') &&
      (/(?:generate|render|buatkan|buat|bikin|jadikan)\s+(?:ke\s+)?(?:video|vidio)/i.test(userLower) ||
        userLower.includes('generate video') ||
        userLower.includes('buat video') ||
        userLower.includes('bikin video') ||
        userLower.includes('render video') ||
        mode === 'video');

    // Detect if user explicitly requested to generate an image
    const isExplicitImageGen =
      !isExplicitVideoGen &&
      !userLower.includes('video') &&
      !userLower.includes('vidio') &&
      (/(?:generate|render|buatkan|buat|bikin|jadikan)\s+(?:ke\s+)?(?:gambar|foto|visual|image)/i.test(userLower) ||
        userLower.includes('generate gambar') ||
        userLower.includes('buat gambar') ||
        userLower.includes('bikin gambar') ||
        userLower.includes('render gambar') ||
        mode === 'image');

    // Extract requested aspect ratio if mentioned (e.g. 9:16, 16:9, 1:1, 4:3, 3:4)
    let detectedAspect = isExplicitVideoGen ? '16:9' : '9:16';
    const aspectMatch = promptText.match(/\b(16:9|9:16|1:1|4:3|3:4|21:9)\b/);
    if (aspectMatch) {
      detectedAspect = aspectMatch[1];
    } else if (userLower.includes('persegi') || userLower.includes('kotak') || userLower.includes('feed')) {
      detectedAspect = '1:1';
    } else if (userLower.includes('landscape') || userLower.includes('layar lebar') || userLower.includes('horizontal')) {
      detectedAspect = '16:9';
    } else if (userLower.includes('vertikal') || userLower.includes('portrait') || userLower.includes('tiktok') || userLower.includes('reels')) {
      detectedAspect = '9:16';
    }

    // Extract requested duration if mentioned (e.g. 10 detik, 5s)
    let detectedDuration = '10s';
    const durMatch = promptText.match(/durasi\s*([0-9]+)\s*(?:detik|s)?/i);
    if (durMatch && durMatch[1]) {
      detectedDuration = `${durMatch[1]}s`;
    }

    // Clean video prompt
    let cleanVidPrompt = promptText;
    const vidHeaderMatch = promptText.match(/^Generate Video[^\n:]*:\s*([\s\S]*)$/i);
    if (vidHeaderMatch && vidHeaderMatch[1]) {
      cleanVidPrompt = vidHeaderMatch[1].trim();
    } else {
      cleanVidPrompt = promptText
        .replace(/(?:generate|render|buatkan|buat|bikin|jadikan)\s+(?:ke\s+)?(?:video|vidio)\s*/gi, '')
        .replace(/\b(16:9|9:16|1:1|4:3|3:4|21:9)\b/gi, '')
        .trim() || promptText;
    }

    // Clean image prompt
    let cleanImgPrompt = promptText;
    const imgHeaderMatch = promptText.match(/^Generate Image[^\n:]*:\s*([\s\S]*)$/i);
    if (imgHeaderMatch && imgHeaderMatch[1]) {
      cleanImgPrompt = imgHeaderMatch[1].trim();
    } else {
      cleanImgPrompt = promptText
        .replace(/(?:generate|render|buatkan|buat|bikin|jadikan)\s+(?:ke\s+)?(?:gambar|foto|visual|image)\s*/gi, '')
        .replace(/\b(16:9|9:16|1:1|4:3|3:4|21:9)\b/gi, '')
        .trim() || promptText;
    }

    // 1. Direct Web Session Mode using user's own Google Gemini account cookies
    if (explicitCookies || model === 'gemini-web-direct') {
      try {
        console.log(`[Gemini Chat] Menjalankan chat dengan sesi akun Google Gemini milik pengguna (isNewChat: ${Boolean(isNewChat)}, sessionId: ${sessionId || 'none'}, convId: ${geminiConversationId || 'new'})...`);
        const { GeminiWebClient } = require('./script-gemini/gemini_chat.cjs');
        
        // Cache key per chat session or cookies
        const cacheKey = sessionId || (explicitCookies ? explicitCookies.slice(0, 32) : 'default');
        let client = (global as any).__geminiWebClientCache?.get(cacheKey);
        if (!(global as any).__geminiWebClientCache) {
          (global as any).__geminiWebClientCache = new Map<string, any>();
        }

        if (!client) {
          client = new GeminiWebClient(explicitCookies || undefined);
          await client.initSession();
          (global as any).__geminiWebClientCache.set(cacheKey, client);
        } else if (isNewChat) {
          client.conversationId = null;
          client.responseId = null;
          client.choiceId = null;
        }

        // Restore multi-turn context if this session already has active conversation IDs
        if (geminiConversationId && !isNewChat) {
          client.setContext({
            conversationId: geminiConversationId,
            responseId: geminiResponseId,
            choiceId: geminiChoiceId,
          });
        }

        let webRes: any;
        try {
          webRes = await client.sendMessage(promptText || 'Halo Gemini', Boolean(isNewChat));
        } catch (msgErr: any) {
          if (msgErr.message && (
            msgErr.message.includes('400') ||
            msgErr.message.includes('401') ||
            msgErr.message.includes('403') ||
            msgErr.message.includes('CSRF') ||
            msgErr.message.includes('uS02ke') ||
            msgErr.message.includes('SNlM0e') ||
            msgErr.message.includes('RPC')
          )) {
            console.log('[Gemini Chat Message] Re-initializing session and retrying...');
            (global as any).__geminiWebClientCache?.delete(cacheKey);
            client = new GeminiWebClient(explicitCookies || undefined);
            await client.initSession();
            (global as any).__geminiWebClientCache?.set(cacheKey, client);
            webRes = await client.sendMessage(promptText || 'Halo Gemini', true);
          } else {
            throw msgErr;
          }
        }
        if (webRes && (webRes.text || webRes.video || (Array.isArray(webRes.images) && webRes.images.length > 0) || (Array.isArray(webRes.videos) && webRes.videos.length > 0))) {
          const returnedAttachments: any[] = [];
          let directGeneratedVideo: any = undefined;

          // If a video was generated by Google Gemini Veo in this turn
          if (webRes.video && webRes.video.playbackUrl) {
            let localVideoUrl = webRes.video.playbackUrl;
            const filename = `gemini_vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp4`;
            const filepath = path.join(mediaCacheDir, filename);

            try {
              console.log(`[Gemini Chat Video] Mengunduh MP4 Veo dari Google CDN ke server lokal...`);
              await client.downloadMedia(webRes.video.playbackUrl, filepath);
              if (fs.existsSync(filepath) && fs.statSync(filepath).size > 1000) {
                localVideoUrl = `/media-cache/${filename}`;
                console.log(`[Gemini Chat Video] Berhasil disimpan di ${localVideoUrl} (${(fs.statSync(filepath).size / (1024 * 1024)).toFixed(2)} MB)`);
              }
            } catch (dlErr: any) {
              console.warn('[Gemini Chat Video Download Notice]:', dlErr.message);
              localVideoUrl = `/api/proxy-video?url=${encodeURIComponent(webRes.video.playbackUrl)}`;
            }

            returnedAttachments.push({
              id: `att_gemini_web_vid_${Date.now()}`,
              url: localVideoUrl,
              playbackUrl: localVideoUrl,
              coverUrl: webRes.video.coverUrl,
              type: 'video',
              name: `Video Gemini Veo (${webRes.video.resolution || '16:9'})`,
              duration: webRes.video.duration || '10s',
            });

            directGeneratedVideo = {
              url: localVideoUrl,
              playbackUrl: localVideoUrl,
              coverUrl: webRes.video.coverUrl,
              prompt: promptText,
              aspectRatio: detectedAspect || '16:9',
              duration: webRes.video.duration || '10s',
              resolution: webRes.video.resolution || '1280x720 (16:9)',
              modelName: 'Google Gemini Pro (Veo Engine)',
              status: 'completed',
            };
          }

          if (Array.isArray(webRes.images) && webRes.images.length > 0) {
            webRes.images.forEach((imgUrl: string, idx: number) => {
              returnedAttachments.push({
                id: `att_gemini_web_${Date.now()}_${idx}`,
                url: imgUrl,
                type: 'image',
                name: `Gambar Gemini #${idx + 1}`,
              });
            });
          }
          if (Array.isArray(webRes.videos) && webRes.videos.length > 0) {
            webRes.videos.forEach((vidUrl: string, idx: number) => {
              if (!returnedAttachments.some(a => a.playbackUrl === vidUrl || a.url === vidUrl)) {
                returnedAttachments.push({
                  id: `att_gemini_web_vid_${Date.now()}_${idx}`,
                  url: vidUrl,
                  playbackUrl: vidUrl,
                  type: 'video',
                  name: `Video Gemini #${idx + 1}`,
                });
              }
            });
          }

          const hasImg = returnedAttachments.some((a) => a.type === 'image');
          const hasVid = returnedAttachments.some((a) => a.type === 'video') || Boolean(directGeneratedVideo);
          const shouldCreateMediaCard = (isExplicitImageGen || isExplicitVideoGen || mode === 'image' || mode === 'video') && (hasVid || hasImg);

          return {
            text: webRes.text || (hasVid ? `Ini dia video hasil generate akun Google Gemini kamu:` : hasImg ? `Ini dia gambar hasil generate akun Google Gemini kamu:` : ''),
            model: model || 'gemini-web-direct',
            mode,
            durationMs: Date.now() - startTime,
            tokens: Math.round((webRes.text || '').length / 4),
            remainingCredits: null,
            userEmail: 'Akun Google Gemini Kamu',
            geminiConversationId: webRes.conversationId || client.conversationId,
            geminiResponseId: webRes.responseId || client.responseId,
            geminiChoiceId: webRes.choiceId || client.choiceId,
            attachments: returnedAttachments,
            generatedVideo: directGeneratedVideo,
            weavyAction: shouldCreateMediaCard
              ? {
                  prompt: promptText,
                  model: hasVid ? 'Google Gemini Pro Video' : 'Google Gemini Pro Image',
                  aspectRatio: detectedAspect,
                  status: 'completed',
                  resultUrl: directGeneratedVideo?.url || returnedAttachments[0]?.url,
                  isVideoPrompt: hasVid,
                  reason: 'Dihasilkan langsung melalui sesi Google Gemini Web kamu',
                }
              : undefined,
          };
        }
      } catch (webErr: any) {
        console.error('[Gemini Web Direct Error]:', webErr.message);
        throw new Error(`Sesi akun Google Gemini dari Settings mengalami kendala: ${webErr.message}. Silakan salin ulang cURL / Cookie akun di menu Pengaturan (Settings).`);
      }
    }

    // 2. User API Key Mode (only if explicitly provided by user, never fallback to system GEMINI_API_KEY)
    let apiKey = (explicitApiKey && explicitApiKey.startsWith('AIza')) ? explicitApiKey : undefined;
    if (!apiKey) {
      throw new Error('Tidak ada akun Google Gemini yang aktif. Silakan pilih atau tambahkan akun Google Gemini milikmu (cURL / Cookie Sesi) di menu Pengaturan (Settings) terlebih dahulu agar chat 100% menggunakan akun yang kamu tambahkan, bukan API key.');
    }

    const ai = new GoogleGenAI({ apiKey });

    // If user explicitly requested image generation, handle directly via Imagen 3 / Gemini Image
    if (isExplicitImageGen && apiKey) {
      try {
        console.log(`[Gemini Image Direct] Executing Google Imagen 3 with prompt: "${cleanImgPrompt.slice(0, 60)}" (aspect: ${detectedAspect})...`);
        let generatedUrl = '';
        let usedImgModel = 'Google Imagen 3 Pro';

        // Try Method 1: ai.models.generateImages with Imagen 3
        try {
          const imgResp = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: cleanImgPrompt,
            config: {
              numberOfImages: 1,
              aspectRatio: (['1:1', '3:4', '4:3', '9:16', '16:9'].includes(detectedAspect) ? detectedAspect : '9:16') as any,
              outputMimeType: 'image/jpeg',
            },
          });
          if (imgResp && imgResp.generatedImages && imgResp.generatedImages[0]?.image?.imageBytes) {
            const b64 = imgResp.generatedImages[0].image.imageBytes;
            const filename = `gemini_img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
            const filepath = path.join(mediaCacheDir, filename);
            fs.writeFileSync(filepath, Buffer.from(b64, 'base64'));
            generatedUrl = `/media-cache/${filename}`;
          }
        } catch (imgErr: any) {
          console.warn('[Gemini Direct Imagen 3 notice]:', imgErr.message || imgErr);
        }

        // Try Method 2: ai.models.generateContent with gemini-3.1-flash-image
        if (!generatedUrl) {
          try {
            const contentResp = await ai.models.generateContent({
              model: 'gemini-3.1-flash-image',
              contents: {
                parts: [{ text: cleanImgPrompt }],
              },
              config: {
                imageConfig: {
                  aspectRatio: (['1:1', '3:4', '4:3', '9:16', '16:9'].includes(detectedAspect) ? detectedAspect : '9:16') as any,
                  imageSize: '1K',
                },
              },
            });
            const parts = contentResp?.candidates?.[0]?.content?.parts || [];
            for (const p of parts) {
              if (p.inlineData && p.inlineData.data) {
                const filename = `gemini_img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.png`;
                const filepath = path.join(mediaCacheDir, filename);
                fs.writeFileSync(filepath, Buffer.from(p.inlineData.data, 'base64'));
                generatedUrl = `/media-cache/${filename}`;
                usedImgModel = 'Gemini 3 Pro Image';
                break;
              }
            }
          } catch (flErr: any) {
            console.warn('[Gemini Direct Flash Image notice]:', flErr.message || flErr);
          }
        }

        if (generatedUrl) {
          const durationMs = Date.now() - startTime;
          return {
            text: `Siap bro! Ini dia hasil gambar yang kamu minta menggunakan model **${usedImgModel}** (Rasio ${detectedAspect}):\n\n![${cleanImgPrompt}](${generatedUrl})`,
            model: usedImgModel,
            mode: 'image',
            durationMs,
            tokens: 50,
            remainingCredits: null,
            userEmail: 'Google Gemini Pro',
            attachments: [
              {
                id: `att_gemini_img_${Date.now()}`,
                name: `Google Imagen 3 (${detectedAspect})`,
                url: generatedUrl,
                type: 'image',
              },
            ],
            weavyAction: {
              prompt: cleanImgPrompt,
              model: usedImgModel,
              aspectRatio: detectedAspect,
              status: 'completed',
              resultUrl: generatedUrl,
              reason: 'Dihasilkan langsung menggunakan model Google Imagen 3 Pro',
            },
          };
        }
      } catch (imgGenErr: any) {
        console.warn('[Gemini Direct Image Gen failed, falling back to chat conversation]:', imgGenErr.message);
      }
    }

    // If user explicitly requested video generation, handle directly via Gemini Omni Flash (10s) or Google Veo
    if (isExplicitVideoGen && apiKey) {
      try {
        console.log(`[Gemini Video Direct] Executing video generation for prompt: "${cleanVidPrompt.slice(0, 60)}" (aspect: ${detectedAspect})...`);
        let generatedVidUrl = '';
        let usedVidModel = 'Gemini Omni Flash Video (10 Detik)';

        // 1. Try Gemini Omni Flash via Interactions API (10s duration)
        try {
          console.log(`[Gemini Video Direct] Calling gemini-omni-1.1-flash (10s max)...`);
          const interaction = await ai.interactions.create({
            model: 'gemini-omni-1.1-flash',
            input: cleanVidPrompt,
            background: false,
            store: false,
            stream: false,
            response_format: {
              type: 'video',
              aspect_ratio: (detectedAspect === '9:16' ? '9:16' : '16:9') as any,
              duration: '10s',
            },
          }, { timeout: 300000 });

          const videoPart = interaction.output_video;
          if (videoPart && videoPart.data) {
            const filename = `gemini_omni_vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp4`;
            const filepath = path.join(mediaCacheDir, filename);
            fs.writeFileSync(filepath, Buffer.from(videoPart.data, 'base64'));
            generatedVidUrl = `/media-cache/${filename}`;
            usedVidModel = 'Gemini Omni Flash Video (10 Detik)';
          }
        } catch (omniErr: any) {
          console.warn('[Gemini Omni Flash Direct notice]:', omniErr.message || omniErr);
        }

        // 2. Fallback to Google Veo
        if (!generatedVidUrl) {
          const targetModel = 'veo-3.1-generate-preview';
          try {
            const videoResp = await ai.models.generateVideos({
              model: targetModel,
              prompt: cleanVidPrompt,
              config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: (detectedAspect === '9:16' ? '9:16' : '16:9') as any,
              },
            });

            if (videoResp && videoResp.name) {
              const { GenerateVideosOperation } = require('@google/genai');
              const op = new GenerateVideosOperation();
              op.name = videoResp.name;
              for (let i = 0; i < 5; i++) {
                await new Promise((r) => setTimeout(r, 2000));
                const updated = await ai.operations.getVideosOperation({ operation: op });
                if (updated.done && updated.response?.generatedVideos?.[0]?.video?.uri) {
                  generatedVidUrl = updated.response.generatedVideos[0].video.uri;
                  usedVidModel = 'Google Veo 2 / 3.1 Pro';
                  break;
                }
              }
            }
          } catch (veoApiErr: any) {
            console.warn('[Gemini Direct Veo notice]:', veoApiErr.message || veoApiErr);
          }
        }

        if (generatedVidUrl) {
          const durationMs = Date.now() - startTime;
          return {
            text: `Siap bro! Video kamu berhasil di-generate menggunakan model **${usedVidModel}** (Rasio ${detectedAspect}, Durasi hingga 10 Detik):\n\n[Tonton Video](${generatedVidUrl})`,
            model: usedVidModel,
            mode: 'video',
            durationMs,
            tokens: 60,
            remainingCredits: null,
            userEmail: 'Google Gemini Pro',
            attachments: [
              {
                id: `att_gemini_vid_${Date.now()}`,
                name: `${usedVidModel} (${detectedAspect})`,
                url: generatedVidUrl,
                playbackUrl: generatedVidUrl,
                type: 'video',
              },
            ],
            weavyAction: {
              prompt: cleanVidPrompt,
              model: usedVidModel,
              aspectRatio: detectedAspect,
              status: 'completed',
              resultUrl: generatedVidUrl,
              isVideoPrompt: true,
              reason: `Dihasilkan langsung menggunakan model ${usedVidModel}`,
            },
          };
        }
      } catch (vidGenErr: any) {
        console.warn('[Gemini Direct Video Gen failed, falling back to chat conversation]:', vidGenErr.message);
      }
    }

    let targetGeminiModel = 'gemini-3.8-flash';
    let returnDisplayName = '3.6 Flash';
    const cleanM = (model || '').toLowerCase();
    let isThinkingMode = Boolean(thinking);

    if (cleanM.includes('thinking')) {
      targetGeminiModel = 'gemini-2.5-pro';
      returnDisplayName = '3.6 Thinking';
      isThinkingMode = true;
    } else if (cleanM.includes('pro') || cleanM.includes('3.1-pro') || cleanM.includes('3-pro') || cleanM.includes('2.5-pro')) {
      targetGeminiModel = cleanM.includes('2.5') ? 'gemini-2.5-pro' : 'gemini-3.1-pro-preview';
      returnDisplayName = '3.1 Pro';
    } else {
      targetGeminiModel = 'gemini-3.8-flash';
      returnDisplayName = '3.6 Flash';
    }

    // Build system instruction
    let fullSystemInstruction = noInjection
      ? (systemPrompt || undefined)
      : (systemPrompt ||
        'You are Google Gemini Pro, an advanced multimodal AI creative director and media assistant. You have full integrated capabilities to generate text, complex analysis, photorealistic images (via Google Imagen 3), and cinematic video (via Google Veo). Always respond helpfully, warmly, and thoroughly in Indonesian. IMPORTANT: NEVER output raw ReAct tool JSON like \'{"action": "dalle.text2im"}\'. If the user asks for images or videos, discuss the creative concept directly, and wrap any ready-to-run prompts inside ```gemini_generate or ```weavy_generate blocks.');

    if (!noInjection && sessionImages && sessionImages.length > 0) {
      fullSystemInstruction += `\n\nDAFTAR FILE GAMBAR DALAM SESI INI (Total: ${sessionImages.length} Gambar):\n` +
        sessionImages.map((img: any) => `- Gambar #${img.index} (${img.label || 'Foto'}): ${img.prompt || ''} URL: ${img.url}`).join('\n');
    }

    if (!noInjection && sessionVideos && sessionVideos.length > 0) {
      fullSystemInstruction += `\n\nDAFTAR FILE VIDEO DALAM SESI INI (Total: ${sessionVideos.length} Video):\n` +
        sessionVideos.map((v: any) => `- Video #${v.index} (${v.tag || `@vid${v.index}`}): ${v.title || ''} URL: ${v.url || v.playbackUrl}`).join('\n');
    }

    // Format chat turns for @google/genai
    const contents: any[] = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const role = m.role === 'user' ? 'user' : 'model';
      const parts: any[] = [];

      if (m.content) {
        parts.push({ text: m.content });
      }

      if (Array.isArray(m.attachments)) {
        for (const att of m.attachments) {
          if (att && att.type === 'image' && att.base64 && typeof att.base64 === 'string') {
            const b64Data = att.base64.replace(/^data:image\/\w+;base64,/, '');
            const mimeMatch = att.base64.match(/^data:(image\/\w+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            parts.push({
              inlineData: {
                mimeType,
                data: b64Data,
              },
            });
          }
        }
      }

      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Halo Gemini' }] });
    }

    console.log(`[Gemini Chat Endpoint] Menjalankan model "${targetGeminiModel}" dengan ${contents.length} turn pesan...`);

    let responseText = '';
    const candidateModels = [targetGeminiModel, 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'];
    const uniqueCandidates = Array.from(new Set(candidateModels));
    let lastError: any = null;

    for (const mName of uniqueCandidates) {
      try {
        const response = await ai.models.generateContent({
          model: mName,
          contents,
          config: {
            systemInstruction: fullSystemInstruction,
            temperature: temperature !== undefined ? temperature : 0.7,
          },
        });
        if (response && response.text) {
          responseText = response.text;
          targetGeminiModel = mName;
          break;
        }
      } catch (genErr: any) {
        lastError = genErr;
        console.warn(`[Gemini Chat] Model ${mName} attempt notice:`, genErr.message || genErr);
      }
    }

    // If API failed (e.g. 503 high demand), fallback to Gemini Web Client session
    if (!responseText) {
      try {
        console.log('[Gemini Chat] Fallback to Gemini Web Direct Session...');
        const { GeminiWebClient } = require('./script-gemini/gemini_chat.cjs');
        const client = new GeminiWebClient(explicitCookies || undefined);
        await client.initSession();
        const lastMsg = [...messages].reverse().find((m) => m.role === 'user');
        const pText = lastMsg?.content || 'Halo Gemini';
        const webRes = await client.sendMessage(pText, false, false);
        if (webRes && webRes.text) {
          responseText = webRes.text;
          targetGeminiModel = 'gemini-web-direct';
        }
      } catch (fallbackWebErr: any) {
        console.warn('[Gemini Chat] Fallback to Gemini Web Client failed:', fallbackWebErr.message);
      }
    }

    if (!responseText) {
      throw lastError || new Error('Gagal mendapatkan balasan dari Google Gemini.');
    }

    const durationMs = Date.now() - startTime;

    return {
      text: responseText.trim(),
      model: returnDisplayName,
      mode,
      durationMs,
      tokens: Math.round(responseText.length / 4),
      remainingCredits: null,
      userEmail: 'Google Gemini Direct',
      attachments: [],
    };
  }

  // Dedicated Real-Time SSE Streaming Endpoint connected directly to Gemini Web & Weavy
  app.post('/api/chat-stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const sendSSE = (data: any) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };
    let geminiHeartbeat: ReturnType<typeof setInterval> | undefined;
    res.on('close', () => {
      if (geminiHeartbeat) clearInterval(geminiHeartbeat);
    });

    try {
      const {
        provider = 'weavy',
        messages = [],
        model = req.body?.provider === 'gemini' ? 'gemini-3.8-flash' : (req.body?.model || 'anthropic/claude-sonnet-5'),
        mode = 'chat',
        systemPrompt,
        thinking = false,
        quickPresetEnabled = false,
        temperature,
        refreshToken,
        idToken,
        allRefreshTokens,
        imageUrl,
        images = [],
        sessionImages = [],
        sessionVideos = [],
        sessionId,
        geminiConversationId,
        geminiResponseId,
        geminiChoiceId,
      } = req.body || {};

      if (!Array.isArray(messages) || messages.length === 0) {
        sendSSE({ type: 'error', error: 'Daftar pesan tidak boleh kosong.' });
        return res.end();
      }

      sendSSE({ type: 'start', model, provider });

      if (provider === 'gemini') {
        let effectiveCookies: string | undefined = undefined;
        let accountEmail = String(req.body.email || '').trim();

        // 1. Try extracting cookies from cookies, token, or refreshToken passed in body
        const rawToken = String(req.body.cookies || req.body.token || req.body.refreshToken || '').trim();
        if (rawToken) {
          if (rawToken.includes('@') && !rawToken.includes(';') && !rawToken.includes('=')) {
            // It's an email address
            if (!accountEmail) accountEmail = rawToken;
          } else {
            try {
              const { extractCookiesOrApiKey } = require('./server/providers/gemini');
              const extracted = extractCookiesOrApiKey(rawToken);
              if (extracted && extracted.cookies) {
                effectiveCookies = extracted.cookies;
              }
            } catch (e) {}
            if (!effectiveCookies && (rawToken.includes('__Secure') || rawToken.includes('SID=') || rawToken.includes('SAPISID='))) {
              effectiveCookies = rawToken;
            }
          }
        }

        // 2. If no cookies yet, resolve cookies from email profile via getCookiesForGeminiEmail
        if (!effectiveCookies && accountEmail) {
          try {
            const { getCookiesForGeminiEmail } = require('./server/utils/geminiProfileCookies');
            const profCookies = getCookiesForGeminiEmail(accountEmail);
            if (profCookies) {
              effectiveCookies = profCookies;
            }
          } catch (e) {}
        }

        // 3. If still no cookies, check allGeminiAccounts provided in request body
        if (!effectiveCookies && Array.isArray(req.body.allGeminiAccounts) && req.body.allGeminiAccounts.length > 0) {
          try {
            const { extractCookiesOrApiKey } = require('./server/providers/gemini');
            const { getCookiesForGeminiEmail } = require('./server/utils/geminiProfileCookies');
            for (const acc of req.body.allGeminiAccounts) {
              const accToken = String(acc.cookies || acc.token || acc.refreshToken || '').trim();
              if (accToken) {
                const ext = extractCookiesOrApiKey(accToken);
                if (ext && ext.cookies) {
                  effectiveCookies = ext.cookies;
                  if (!accountEmail && acc.email) accountEmail = acc.email;
                  break;
                }
                if (accToken.includes('__Secure') || accToken.includes('SID=')) {
                  effectiveCookies = accToken;
                  if (!accountEmail && acc.email) accountEmail = acc.email;
                  break;
                }
              }
              if (acc.email) {
                const c = getCookiesForGeminiEmail(acc.email);
                if (c) {
                  effectiveCookies = c;
                  accountEmail = acc.email;
                  break;
                }
              }
            }
          } catch (e) {}
        }

        // 4. If still no cookies, check DEFAULT_COOKIES
        if (!effectiveCookies) {
          try {
            const { DEFAULT_COOKIES } = require('./script-gemini/gemini_chat.cjs');
            if (DEFAULT_COOKIES && (DEFAULT_COOKIES.includes('__Secure') || DEFAULT_COOKIES.includes('SID='))) {
              effectiveCookies = DEFAULT_COOKIES;
            }
          } catch (e) {}
        }

        // All Gemini operations in Chat MUST strictly use user-added Google Gemini accounts, never system API keys
        if (!effectiveCookies) {
          sendSSE({
            type: 'error',
            error: 'Tidak ada akun Google Gemini yang aktif. Silakan pilih atau tambahkan akun Google Gemini milikmu (cURL / Cookie Sesi) di menu Pengaturan (Settings) terlebih dahulu agar chat 100% menggunakan akun yang kamu tambahkan, bukan API key.'
          });
          return res.end();
        }

        const lastUserMsg = messages.slice().reverse().find((m: any) => m.role === 'user');
        const promptText = lastUserMsg?.content || 'Halo Gemini';

        if (effectiveCookies) {
          const { GeminiWebClient } = require('./script-gemini/gemini_chat.cjs');
          const cacheKey = sessionId || effectiveCookies.slice(0, 32);
          if (!(global as any).__geminiWebClientCache) {
            (global as any).__geminiWebClientCache = new Map<string, any>();
          }
          let client = (global as any).__geminiWebClientCache.get(cacheKey);
          if (!client) {
            client = new GeminiWebClient(effectiveCookies);
            await client.initSession();
            (global as any).__geminiWebClientCache.set(cacheKey, client);
          }
          if (geminiConversationId && !req.body.isNewChat) {
            client.setContext({
              conversationId: geminiConversationId,
              responseId: geminiResponseId,
              choiceId: geminiChoiceId,
            });
          }

          let accumulatedFullText = '';
          sendSSE({ type: 'status', text: 'Mengirim pesan ke Gemini Web...' });
          geminiHeartbeat = setInterval(() => {
            sendSSE({ type: 'status', text: 'Masih menunggu respons dari Gemini Web...' });
          }, 15000);

          const onEventHandler = async (evt: any) => {
            if (evt.type === 'chunk') {
              accumulatedFullText = evt.fullText || (accumulatedFullText + evt.text);
              sendSSE({ type: 'chunk', text: evt.text, fullText: evt.fullText });
            } else if (evt.type === 'status') {
              sendSSE({ type: 'status', text: evt.text, isVideoGenerating: evt.isVideoGenerating });
            } else if (evt.type === 'video' && evt.video) {
              let localVideoUrl = evt.video.playbackUrl;
              const filename = `gemini_vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp4`;
              const filepath = path.join(mediaCacheDir, filename);
              try {
                await client.downloadMedia(evt.video.playbackUrl, filepath);
                if (fs.existsSync(filepath) && fs.statSync(filepath).size > 1000) {
                  localVideoUrl = `/media-cache/${filename}`;
                }
              } catch (e) {}

              sendSSE({
                type: 'video',
                video: {
                  url: localVideoUrl,
                  playbackUrl: localVideoUrl,
                  coverUrl: evt.video.coverUrl,
                  duration: evt.video.duration || '10s',
                  resolution: evt.video.resolution || '1280x720 (16:9)',
                  modelName: 'Google Gemini Pro (Veo Engine)',
                  status: 'completed',
                }
              });
            } else if (evt.type === 'error') {
              // 100% genuine error response from Gemini Web
              sendSSE({
                type: 'error',
                error: evt.error,
                statusCode: evt.statusCode,
                raw: evt.raw
              });
            } else if (evt.type === 'done') {
              sendSSE({
                type: 'done',
                fullText: evt.fullText || accumulatedFullText,
                geminiConversationId: evt.conversationId || client.conversationId,
                geminiResponseId: evt.responseId || client.responseId,
                geminiChoiceId: evt.choiceId || client.choiceId,
                images: evt.images || [],
              });
            }
          };

          let result: any;
          try {
            result = await client.streamMessage(promptText, onEventHandler, Boolean(req.body.isNewChat));
          } catch (streamErr: any) {
            if (streamErr.message && (
              streamErr.message.includes('400') ||
              streamErr.message.includes('401') ||
              streamErr.message.includes('403') ||
              streamErr.message.includes('CSRF') ||
              streamErr.message.includes('uS02ke') ||
              streamErr.message.includes('SNlM0e') ||
              streamErr.message.includes('RPC')
            )) {
              console.log('[Gemini Stream] Sesi kedaluwarsa atau terjadi kendala obrolan. Menginisialisasi ulang sesi Gemini Web...');
              (global as any).__geminiWebClientCache?.delete(cacheKey);
              client = new GeminiWebClient(effectiveCookies);
              await client.initSession();
              (global as any).__geminiWebClientCache?.set(cacheKey, client);
              result = await client.streamMessage(promptText, onEventHandler, true);
            } else {
              throw streamErr;
            }
          }

          if (!res.writableEnded) {
            const responseText = String(result?.text || accumulatedFullText || '');
            const inlineImageUrls = responseText.match(
              /https?:\/\/(?:[a-z0-9-]+\.)*googleusercontent\.com\/image_generation_content\/[^\s"'<>]+/gi
            ) || [];
            const imageUrls = [...new Set<string>([
              ...(Array.isArray(result?.images) ? result.images : []),
              ...inlineImageUrls,
            ].map((url) => String(url).replace(/^http:/i, 'https:').replace(/[),.;]+$/, '')))];
            const imageAttachments: any[] = [];

            for (let index = 0; index < imageUrls.length; index++) {
              const imageUrl = imageUrls[index];
              try {
                const parsedImageUrl = new URL(imageUrl);
                if (
                  parsedImageUrl.protocol !== 'https:' ||
                  !(parsedImageUrl.hostname === 'googleusercontent.com' || parsedImageUrl.hostname.endsWith('.googleusercontent.com'))
                ) {
                  continue;
                }

                const imageHeaders: Record<string, string> = {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
                  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                  Cookie: client.cookies,
                  Referer: 'https://gemini.google.com/',
                  Origin: 'https://gemini.google.com',
                };
                const authHeader = client.getAuthorizationHeader('https://gemini.google.com');
                if (authHeader) imageHeaders.Authorization = authHeader;

                const imageCandidates = [imageUrl];
                if (parsedImageUrl.hostname.endsWith('googleusercontent.com') && !imageUrl.includes('=')) {
                  imageCandidates.push(`${imageUrl}=s0`);
                }

                let cachedAttachment: any = null;
                let lastImageError: any = null;
                for (const candidateUrl of imageCandidates) {
                  try {
                    const imageResponse = await axios.get(candidateUrl, {
                      headers: imageHeaders,
                      responseType: 'arraybuffer',
                      timeout: 30000,
                      maxContentLength: 50 * 1024 * 1024,
                    });
                    const imageBuffer = Buffer.from(imageResponse.data);
                    const mimeType = String(imageResponse.headers['content-type'] || 'image/jpeg').split(';')[0];
                    if (!mimeType.startsWith('image/') || imageBuffer.length === 0) {
                      throw new Error(`Respons media bukan gambar (${mimeType}).`);
                    }

                    const extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
                    const filename = `gemini_img_${Date.now()}_${index}_${crypto.randomBytes(3).toString('hex')}.${extension}`;
                    const filepath = path.join(mediaCacheDir, filename);
                    fs.writeFileSync(filepath, imageBuffer);
                    cachedAttachment = {
                      id: `gemini_image_${Date.now()}_${index}`,
                      name: `Gemini_${index + 1}.${extension}`,
                      url: `/media-cache/${filename}`,
                      type: 'image',
                    };
                    break;
                  } catch (imageErr: any) {
                    lastImageError = imageErr;
                  }
                }

                if (cachedAttachment) {
                  imageAttachments.push(cachedAttachment);
                } else {
                  throw lastImageError || new Error('URL gambar Gemini tidak bisa diunduh.');
                }
              } catch (imageErr: any) {
                console.warn('[Gemini Chat Image Cache Notice]:', imageErr.message || imageErr);
                imageAttachments.push({
                  id: `gemini_image_${Date.now()}_${index}`,
                  name: `Gemini_${index + 1}`,
                  url: imageUrl,
                  type: 'image',
                });
              }
            }

            const cleanResponseText = responseText
              .replace(/https?:\/\/(?:[a-z0-9-]+\.)*googleusercontent\.com\/image_generation_content\/[^\s"'<>]+/gi, '')
              .trim() || (imageAttachments.length > 0 ? 'Gambar berhasil dibuat.' : responseText);

            sendSSE({
              type: 'done',
              fullText: cleanResponseText,
              geminiConversationId: result?.conversationId || client.conversationId,
              geminiResponseId: result?.responseId || client.responseId,
              geminiChoiceId: result?.choiceId || client.choiceId,
              attachments: imageAttachments,
            });
            res.end();
          }
          if (geminiHeartbeat) clearInterval(geminiHeartbeat);
          return;
        }
      } else {
        // Weavy fallback
        const result = await executeWeavyAnyLLM({
          messages,
          model,
          mode,
          systemPrompt,
          thinking: Boolean(thinking),
          quickPresetEnabled: Boolean(quickPresetEnabled),
          temperature,
          refreshToken,
          idToken,
          allRefreshTokens,
          imageUrl,
          images,
          sessionImages,
          sessionVideos,
        });

        sendSSE({ type: 'chunk', text: result.text || '', fullText: result.text || '' });
        sendSSE({
          type: 'done',
          fullText: result.text || '',
          tokens: result.tokens,
          remainingCredits: result.remainingCredits,
          attachments: result.attachments,
          weavyAction: (result as any).weavyAction,
        });
        return res.end();
      }
    } catch (err: any) {
      if (geminiHeartbeat) clearInterval(geminiHeartbeat);
      console.error('[Chat Stream Error]:', err.message);
      sendSSE({ type: 'error', error: err.message || 'Gagal memproses pesan streaming.' });
      return res.end();
    }
  });

  // Dedicated Conversational AI Chat Endpoint with Multi-Turn Context & Image Support using Weavy or Gemini
  app.post('/api/chat-message', async (req, res) => {
    try {
      const {
        provider = 'weavy',
        messages = [],
        model = req.body?.provider === 'gemini' ? 'gemini-3.8-flash' : (req.body?.model || 'anthropic/claude-sonnet-5'),
        mode = 'chat',
        systemPrompt,
        thinking = false,
        quickPresetEnabled = false,
        temperature,
        refreshToken,
        idToken,
        allRefreshTokens,
        imageUrl,
        images = [],
        sessionImages = [],
        sessionVideos = [],
      } = req.body || {};

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Daftar pesan obrolan (messages) tidak boleh kosong.',
        });
      }

      console.log(`[Chat Endpoint] Provider: ${provider}, Model: ${model}, Mode: ${mode}, Messages: ${messages.length}`);

      let result: any;
      if (provider === 'gemini') {
        let effectiveCookies: string | undefined = undefined;
        let accountEmail = String(req.body.email || '').trim();

        const rawToken = String(req.body.cookies || req.body.token || req.body.refreshToken || '').trim();
        if (rawToken) {
          if (rawToken.includes('@') && !rawToken.includes(';') && !rawToken.includes('=')) {
            if (!accountEmail) accountEmail = rawToken;
          } else {
            try {
              const { extractCookiesOrApiKey } = require('./server/providers/gemini');
              const extracted = extractCookiesOrApiKey(rawToken);
              if (extracted && extracted.cookies) {
                effectiveCookies = extracted.cookies;
              }
            } catch (e) {}
            if (!effectiveCookies && (rawToken.includes('__Secure') || rawToken.includes('SID=') || rawToken.includes('SAPISID='))) {
              effectiveCookies = rawToken;
            }
          }
        }

        if (!effectiveCookies && accountEmail) {
          try {
            const { getCookiesForGeminiEmail } = require('./server/utils/geminiProfileCookies');
            const profCookies = getCookiesForGeminiEmail(accountEmail);
            if (profCookies) {
              effectiveCookies = profCookies;
            }
          } catch (e) {}
        }

        if (!effectiveCookies && Array.isArray(req.body.allGeminiAccounts) && req.body.allGeminiAccounts.length > 0) {
          try {
            const { extractCookiesOrApiKey } = require('./server/providers/gemini');
            const { getCookiesForGeminiEmail } = require('./server/utils/geminiProfileCookies');
            for (const acc of req.body.allGeminiAccounts) {
              const accToken = String(acc.cookies || acc.token || acc.refreshToken || '').trim();
              if (accToken) {
                const ext = extractCookiesOrApiKey(accToken);
                if (ext && ext.cookies) {
                  effectiveCookies = ext.cookies;
                  if (!accountEmail && acc.email) accountEmail = acc.email;
                  break;
                }
                if (accToken.includes('__Secure') || accToken.includes('SID=')) {
                  effectiveCookies = accToken;
                  if (!accountEmail && acc.email) accountEmail = acc.email;
                  break;
                }
              }
              if (acc.email) {
                const c = getCookiesForGeminiEmail(acc.email);
                if (c) {
                  effectiveCookies = c;
                  accountEmail = acc.email;
                  break;
                }
              }
            }
          } catch (e) {}
        }

        if (!effectiveCookies) {
          try {
            const { DEFAULT_COOKIES } = require('./script-gemini/gemini_chat.cjs');
            if (DEFAULT_COOKIES && (DEFAULT_COOKIES.includes('__Secure') || DEFAULT_COOKIES.includes('SID='))) {
              effectiveCookies = DEFAULT_COOKIES;
            }
          } catch (e) {}
        }

        if (!effectiveCookies) {
          return res.status(400).json({
            success: false,
            error: 'Tidak ada akun Google Gemini yang aktif. Silakan pilih atau tambahkan akun Google Gemini milikmu (cURL / Cookie Sesi) di menu Pengaturan (Settings) terlebih dahulu agar chat 100% menggunakan akun yang kamu tambahkan, bukan API key.',
          });
        }

        result = await executeGeminiChat({
          messages,
          model,
          mode,
          systemPrompt,
          isNewChat: Boolean(req.body.isNewChat),
          noInjection: Boolean(req.body.noInjection),
          thinking: Boolean(thinking),
          temperature,
          cookies: effectiveCookies,
          sessionImages,
          sessionVideos,
          sessionId: req.body.sessionId,
          geminiConversationId: req.body.geminiConversationId,
          geminiResponseId: req.body.geminiResponseId,
          geminiChoiceId: req.body.geminiChoiceId,
        });
      } else {
        result = await executeWeavyAnyLLM({
          messages,
          model,
          mode,
          systemPrompt,
          thinking: Boolean(thinking),
          quickPresetEnabled: Boolean(quickPresetEnabled),
          temperature,
          refreshToken,
          idToken,
          allRefreshTokens,
          imageUrl,
          images,
          sessionImages,
          sessionVideos,
        });
      }

      // Strip any thinking tags that could leak from model output
      let cleanText = (result.text || '')
        .replace(/\[Thinking\][\s\S]*?\[\/Thinking\]/gi, '')
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
        .trim();

      return res.json({
        success: true,
        text: cleanText,
        thinking: undefined,
        model: result.model,
        mode: result.mode,
        durationMs: result.durationMs,
        tokens: result.tokens,
        remainingCredits: result.remainingCredits,
        userEmail: result.userEmail,
        attachments: result.attachments || [],
        generatedVideo: result.generatedVideo || undefined,
        weavyAction: result.weavyAction || undefined,
      });
    } catch (err: any) {
      console.error('[Chat Endpoint Error]:', err.response?.data || err.message);
      let errMsg = err.message || 'Gagal menghasilkan respon chat melalui Weavy AI.';
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          if (err.response.data.includes('<!doctype html>') || err.response.data.includes('<html')) {
            errMsg = `Layanan Weavy upstream mengembalikan error status ${err.response.status || 500} (Bad Gateway / Timeout). Silakan coba lagi.`;
          } else {
            errMsg = cleanErrorMessage(err.response.data);
          }
        } else if (err.response.data.error?.message) {
          errMsg = cleanErrorMessage(err.response.data.error.message);
        } else if (err.response.data.message) {
          errMsg = cleanErrorMessage(err.response.data.message);
        }
      }
      return res.status(500).json({
        success: false,
        error: errMsg,
      });
    }
  });

  interface StudioVideoMetadata {
    url?: string;
    title: string;
    author: string;
    audioName?: string;
    thumbnailUrl?: string;
    duration?: number;
    playUrl?: string;
  }

  interface StudioAnalysis {
    hookAnalysis: string;
    productOrTopicName: string;
    targetAudience: string;
    coreUSPs: string[];
    visualProofStrategy: string;
    callToActionAnalysis: string;
  }

  interface StudioScene {
    id: string;
    sceneNumber: number;
    title: string;
    durationSec: number;
    sceneGoal: string;
    visualDescription: string;
    cameraAngle: string;
    imagePrompt: string;
    status: 'idle' | 'generating' | 'completed' | 'failed';
    imageUrl?: string;
    error?: string;
  }

  // Note: All Google Gemini endpoints (/api/gemini/*) are mounted via geminiRouter (server/providers/gemini.ts) at line 214.


  // Dedicated Studio routes are mounted via studioRouter in server/routes/studio.ts


  // 2. Poll Task Status Endpoint (Multi-Strategy Robust Poller)
  app.post('/api/poll-weavy-status', async (req, res) => {
    try {
      const { refreshToken, idToken: providedIdToken, recipeId, nodeId, taskId, batchId } = req.body;

      if (!recipeId) {
        return res.status(400).json({ error: 'recipeId wajib diisi.' });
      }

      console.log(`[Server ⏳ Polling Status] recipeId: ${recipeId}, nodeId: ${nodeId}, taskId: ${taskId}`);

      let idToken = providedIdToken;
      if (refreshToken) {
        try {
          idToken = await getFreshIdToken(refreshToken);
        } catch (authErr) {
          // ignore
        }
      }

      const headers = getWeavyHeaders(idToken);

      // Strategy 1: Fetch Recipe details to inspect canvas nodes
      const detailRes = await axios.get(`https://api.weavy.ai/api/v1/recipes/${recipeId}`, {
        headers,
        timeout: 12000,
      });

      const recipeData = detailRes.data || {};
      const nodes = Array.isArray(recipeData.nodes) ? recipeData.nodes : [];

      // Find target node by exact nodeId match first
      let targetNode = nodes.find((n: any) => n.id === nodeId);
      if (!targetNode && nodes.length > 0) {
        // Fallback to latest model node ONLY if exact nodeId not found
        targetNode = nodes.slice().reverse().find((n: any) => n.isModel || n.type === 'custommodelV2' || n.type === 'model') || nodes[nodes.length - 1];
      }

      // Collect all input reference URLs across targetNode params/inputs and file/input nodes
      const inputReferenceUrlsSet = new Set<string>();
      const collectUrlsRecursively = (val: any) => {
        if (!val) return;
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            inputReferenceUrlsSet.add(trimmed);
          }
        } else if (Array.isArray(val)) {
          for (const item of val) collectUrlsRecursively(item);
        } else if (typeof val === 'object') {
          for (const [k, v] of Object.entries(val)) {
            // Ignore output and result keys when gathering input reference URLs
            if (['result', 'output', 'latestPrediction', 'results', 'outputs', 'generations'].includes(k)) continue;
            collectUrlsRecursively(v);
          }
        }
      };

      if (targetNode) {
        const nData = targetNode?.data || {};
        collectUrlsRecursively(nData.params);
        collectUrlsRecursively(nData.input);
        collectUrlsRecursively(targetNode.params);
        collectUrlsRecursively(targetNode.input);
      }

      for (const node of nodes) {
        const isModelNode = node.isModel || node.type === 'custommodelV2' || node.type === 'model' || (node.id && String(node.id).includes('node_model'));
        if (!isModelNode) {
          collectUrlsRecursively(node.data);
          collectUrlsRecursively(node.files);
        }
      }

      // Helper to check if extracted URL is an input reference image/video rather than output
      const isInputReference = (testUrl: string) => {
        if (!testUrl) return false;
        const cleanTest = testUrl.trim();
        for (const inputUrl of inputReferenceUrlsSet) {
          if (cleanTest === inputUrl || cleanTest.includes(inputUrl) || inputUrl.includes(cleanTest)) {
            return true;
          }
        }
        return false;
      };

      const checkIsImage = (url: string) => {
        if (!url) return false;
        const clean = url.toLowerCase();
        const nodeName = (targetNode?.data?.name || targetNode?.name || '').toLowerCase();
        return (
          clean.match(/\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i) !== null ||
          nodeName.includes('grok') ||
          nodeName.includes('chatgpt') ||
          nodeName.includes('gpt') ||
          nodeName.includes('banana') ||
          nodeName.includes('nano') ||
          nodeName.includes('image')
        );
      };

      let foundMedia: { url: string; coverUrl?: string } | null = null;

      if (targetNode) {
        const nData = targetNode?.data || {};
        const prediction = nData?.latestPrediction || targetNode?.latestPrediction;

        const predStatus = (prediction?.status || '').toString().toLowerCase();
        const predError = prediction?.error || prediction?.errorMessage;
        const nodeStatus = (nData?.status || targetNode?.status || '').toString().toLowerCase();
        const nodeError = nData?.error || nData?.errorMessage || targetNode?.error;

        // 1. FIRST PRIORITY: Check for explicit failure in latestPrediction, nData, or targetNode
        if (predStatus === 'failed' || predStatus === 'error' || predError || nodeStatus === 'failed' || nodeStatus === 'error' || nodeError) {
          let rawErr = predError || nodeError || nData?.message || 'Generasi video/gambar gagal di server Weavy AI.';
          if (typeof rawErr === 'object') {
            rawErr = JSON.stringify(rawErr);
          } else {
            rawErr = String(rawErr);
          }

          // Clean up common error messages for user readability
          if (rawErr.includes('copyright restrictions')) {
            rawErr = 'Generasi audio terhalang hak cipta (copyright restrictions). Silakan coba lagi tanpa audio atau ubah prompt.';
          } else if (rawErr.includes('Prediction failed: Async prediction failed: Exception: ')) {
            rawErr = rawErr.replace('Prediction failed: Async prediction failed: Exception: ', '');
          } else if (rawErr.includes('Prediction failed: ')) {
            rawErr = rawErr.replace('Prediction failed: ', '');
          }

          console.log(`[Server ❌ Poll Failed] Task ${taskId || nodeId} failed:`, rawErr);
          return res.json({
            status: 'failed',
            error: rawErr,
          });
        }

        // 2. SECOND PRIORITY: Check for success media in prediction or node outputs
        const outputCandidates = [
          prediction?.output,
          prediction?.result,
          prediction?.outputUrl,
          prediction?.outputs,
          prediction?.generations,
          prediction?.files,
          nData?.result,
          targetNode?.result,
          nData?.output,
          targetNode?.output,
          nData?.outputs,
          targetNode?.outputs,
          nData?.files,
          targetNode?.files,
          nData?.generations,
          targetNode?.generations,
        ];

        for (const cand of outputCandidates) {
          if (!cand) continue;
          const extracted = extractMediaUrlFromObject(cand);
          if (extracted && extracted.url && !isInputReference(extracted.url)) {
            foundMedia = extracted;
            break;
          }
        }

        if (!foundMedia && (predStatus === 'succeeded' || predStatus === 'completed' || predStatus === 'success' || predStatus === 'finished')) {
          const fallbackUrl = prediction?.outputUrl || prediction?.resultUrl || nData?.outputUrl;
          if (fallbackUrl && !isInputReference(fallbackUrl)) {
            foundMedia = { url: fallbackUrl };
          }
        }
      }

      // Strategy 1.5: If targetNode alone did not produce media, scan only secondary MODEL nodes in recipeData
      if (!foundMedia && Array.isArray(nodes)) {
        for (const node of nodes) {
          const isModelNode = node.isModel || node.type === 'custommodelV2' || node.type === 'model' || (node.id && String(node.id).includes('node_model'));
          if (!isModelNode) continue; // Skip non-model/file input nodes!

          const nData = node?.data || {};
          const prediction = nData?.latestPrediction || node?.latestPrediction;
          const candList = [
            prediction?.output,
            prediction?.result,
            prediction?.outputUrl,
            prediction?.outputs,
            prediction?.generations,
            nData?.result,
            node?.result,
            nData?.output,
            node?.output,
            nData?.outputs,
            node?.outputs,
            nData?.files,
            node?.files,
            nData?.generations,
            node?.generations,
          ];
          for (const cand of candList) {
            if (!cand) continue;
            const extracted = extractMediaUrlFromObject(cand);
            if (extracted && extracted.url && !isInputReference(extracted.url)) {
              foundMedia = extracted;
              console.log(`[Server 🔍 Found Media on secondary model node ${node.id}]`, extracted.url);
              break;
            }
          }
          if (foundMedia) break;
        }
      }

      // Strategy 1.6: Check root recipeData fields
      if (!foundMedia && recipeData) {
        const rootCandidates = [
          recipeData.output,
          recipeData.outputs,
          recipeData.result,
          recipeData.results,
          recipeData.files,
          recipeData.generations,
          recipeData.latestPrediction,
        ];
        for (const cand of rootCandidates) {
          if (!cand) continue;
          const extracted = extractMediaUrlFromObject(cand);
          if (extracted && extracted.url && !isInputReference(extracted.url)) {
            foundMedia = extracted;
            console.log(`[Server 🔍 Found Media on root recipeData]`, extracted.url);
            break;
          }
        }
      }

      if (foundMedia && foundMedia.url) {
        const isImg = checkIsImage(foundMedia.url);
        const mediaLabel = isImg ? 'Gambar' : 'Video';
        console.log(`[Server ✅ Poll Finished!] ${mediaLabel} selesai dibuat: ${foundMedia.url}`);
        return res.json({
          status: 'completed',
          resultUrl: foundMedia.url,
          imageUrl: foundMedia.url,
          mediaUrl: foundMedia.url,
          url: foundMedia.url,
          outputUrl: foundMedia.url,
          coverUrl: foundMedia.coverUrl || '',
          progress: 100,
          message: `Generasi ${mediaLabel.toLowerCase()} berhasil selesai.`,
        });
      }

      // Strategy 2: Check execution run/batch/task ID if provided
      const activeBatchId = taskId || batchId;
      if (activeBatchId && typeof activeBatchId === 'string' && activeBatchId.trim().length > 0) {
        const checkEndpoints = [
          `https://api.weavy.ai/api/v1/batches/recipes/${recipeId}/batches/${activeBatchId}/status`,
          `https://api.weavy.ai/api/v1/batches/recipes/${recipeId}/runs/${activeBatchId}`,
          `https://api.weavy.ai/api/v1/recipes/${recipeId}/runs/${activeBatchId}`,
          `https://api.weavy.ai/api/v1/recipes/${recipeId}/tasks/${activeBatchId}`,
        ];
        for (const ep of checkEndpoints) {
          try {
            const batchRes = await axios.get(ep, { headers, timeout: 8000 });
            const batchData = batchRes.data || {};

            // Inspect recipeRuns or nodeRuns if present in batchData
            const recipeRuns = Array.isArray(batchData.recipeRuns) ? batchData.recipeRuns : (batchData.recipeRun ? [batchData.recipeRun] : []);
            for (const run of recipeRuns) {
              const nodeRuns = Array.isArray(run.nodeRuns) ? run.nodeRuns : [];
              for (const nr of nodeRuns) {
                if (nodeId && nr.nodeId !== nodeId) continue;
                const nrStatus = (nr.status || '').toString().toUpperCase();
                if (nrStatus === 'COMPLETED' || nrStatus === 'SUCCESS') {
                  const nrMedia = extractMediaUrlFromObject(nr.result || nr.output);
                  if (nrMedia && nrMedia.url && !isInputReference(nrMedia.url)) {
                    const isImg = checkIsImage(nrMedia.url);
                    const mediaLabel = isImg ? 'Gambar' : 'Video';
                    console.log(`[Server ✅ Poll Finished via nodeRun!] ${mediaLabel} selesai dibuat: ${nrMedia.url}`);
                    return res.json({
                      status: 'completed',
                      resultUrl: nrMedia.url,
                      imageUrl: nrMedia.url,
                      mediaUrl: nrMedia.url,
                      url: nrMedia.url,
                      outputUrl: nrMedia.url,
                      coverUrl: nrMedia.coverUrl || '',
                      progress: 100,
                      message: `Generasi ${mediaLabel.toLowerCase()} berhasil selesai.`,
                    });
                  }
                } else if (nrStatus === 'FAILED' || nrStatus === 'ERROR') {
                  console.log(`[Server ❌ Poll Failed via nodeRun] Failed:`, nr.error);
                  return res.json({
                    status: 'failed',
                    error: typeof nr.error === 'object' ? JSON.stringify(nr.error) : String(nr.error || 'Generasi di Weavy AI gagal.'),
                  });
                }
              }
            }

            const batchMedia = extractMediaUrlFromObject(batchData);
            if (batchMedia && batchMedia.url && !isInputReference(batchMedia.url)) {
              const isImg = checkIsImage(batchMedia.url);
              const mediaLabel = isImg ? 'Gambar' : 'Video';
              console.log(`[Server ✅ Poll Finished via Task Run Endpoint!] ${mediaLabel} selesai dibuat: ${batchMedia.url}`);
              return res.json({
                status: 'completed',
                resultUrl: batchMedia.url,
                imageUrl: batchMedia.url,
                mediaUrl: batchMedia.url,
                url: batchMedia.url,
                outputUrl: batchMedia.url,
                coverUrl: batchMedia.coverUrl || '',
                progress: 100,
                message: `Generasi ${mediaLabel.toLowerCase()} berhasil selesai.`,
              });
            }
            const bStatus = (batchData.status || '').toString().toLowerCase();
            if (bStatus === 'failed' || bStatus === 'error' || batchData.error) {
              console.log(`[Server ❌ Poll Failed via Task Run] Failed:`, batchData.error);
              return res.json({
                status: 'failed',
                error: typeof batchData.error === 'object' ? JSON.stringify(batchData.error) : String(batchData.error || 'Generasi di Weavy AI gagal.'),
              });
            }
          } catch (e) {
            // Ignore batch endpoint error and fallback to processing
          }
        }
      }

      console.log(`[Server 🔄 Polling Status] Masih memproses generasi di Weavy AI...`);
      // Still running
      return res.json({
        status: 'processing',
        progress: 50,
      });
    } catch (error: any) {
      console.error('[Server ⚠️ Poll Status Warning]:', error?.response?.data || error?.message);
      // Do NOT mark as failed on transient network or polling errors. Keep processing status!
      return res.json({
        status: 'processing',
        progress: 50,
        warning: cleanErrorMessage(error),
      });
    }
  });

  // 3. Fetch All Weavy History for Account Endpoint
  app.post('/api/fetch-weavy-history', async (req, res) => {
    try {
      const { refreshToken, idToken: providedIdToken } = req.body;
      if (!refreshToken && !providedIdToken) {
        return res.status(400).json({ error: 'Refresh token atau ID token wajib disediakan.' });
      }

      let idToken = providedIdToken;
      if (refreshToken) {
        try {
          idToken = await getFreshIdToken(refreshToken);
        } catch (e) {}
      }

      const headers = getWeavyHeaders(idToken);

      const recipesRes = await axios.get('https://api.weavy.ai/api/v1/recipes?limit=100', {
        headers,
        timeout: 15000,
      });

      const recipes = Array.isArray(recipesRes.data) ? recipesRes.data : (recipesRes.data?.recipes || []);
      const items: any[] = [];
      const seenUrls = new Set<string>();

      for (const recipe of recipes) {
        const recipeId = recipe.id || recipe._id;
        try {
          const detailRes = await axios.get(`https://api.weavy.ai/api/v1/recipes/${recipeId}`, {
            headers,
            timeout: 10000,
          });
          const recipeDetail = detailRes.data || {};
          const nodes = Array.isArray(recipeDetail.nodes) ? recipeDetail.nodes : [];

          // 1. Build a comprehensive set of ALL input reference URLs in this recipe
          const recipeInputUrlsSet = new Set<string>();

          const collectInputUrls = (val: any) => {
            if (!val) return;
            if (typeof val === 'string') {
              const trimmed = val.trim();
              if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                recipeInputUrlsSet.add(trimmed);
              }
            } else if (Array.isArray(val)) {
              for (const item of val) collectInputUrls(item);
            } else if (typeof val === 'object') {
              for (const [k, v] of Object.entries(val)) {
                if (['result', 'output', 'latestPrediction', 'results', 'outputs', 'generations', 'prediction'].includes(k)) {
                  continue;
                }
                collectInputUrls(v);
              }
            }
          };

          if (Array.isArray(recipeDetail.files)) collectInputUrls(recipeDetail.files);
          if (recipeDetail.params) collectInputUrls(recipeDetail.params);
          if (recipeDetail.input) collectInputUrls(recipeDetail.input);

          for (const n of nodes) {
            const nData = n.data || {};
            const nType = (nData.type || n.type || nData.category || '').toLowerCase();
            const nName = (nData.name || n.name || nData.menu?.displayName || nData.title || '').toLowerCase();

            collectInputUrls(nData.params);
            collectInputUrls(nData.input);
            collectInputUrls(n.params);
            collectInputUrls(n.input);
            collectInputUrls(nData.files);
            collectInputUrls(n.files);
            if (nData.latestPrediction?.input) collectInputUrls(nData.latestPrediction.input);
            if (n.latestPrediction?.input) collectInputUrls(n.latestPrediction.input);

            if (
              nType.includes('upload') ||
              nType.includes('input') ||
              nType.includes('asset') ||
              nType.includes('file') ||
              nName.includes('upload') ||
              nName.includes('video input') ||
              nName.includes('image input') ||
              nName.includes('media input') ||
              nName.includes('source')
            ) {
              collectInputUrls(nData.result);
              collectInputUrls(nData.output);
              collectInputUrls(n.result);
              collectInputUrls(n.output);
            }
          }

          const isInputReference = (testUrl: string) => {
            if (!testUrl) return false;
            const cleanTest = testUrl.trim();
            const cleanTestNoQuery = cleanTest.split('?')[0].toLowerCase();
            const testFilename = cleanTestNoQuery.split('/').pop();

            for (const inputUrl of recipeInputUrlsSet) {
              const cleanIn = inputUrl.trim();
              if (cleanTest === cleanIn) return true;
              if (cleanTest.includes(cleanIn) || cleanIn.includes(cleanTest)) return true;

              const cleanInNoQuery = cleanIn.split('?')[0].toLowerCase();
              if (cleanTestNoQuery === cleanInNoQuery && cleanTestNoQuery.length > 15) return true;

              const inFilename = cleanInNoQuery.split('/').pop();
              if (testFilename && inFilename && testFilename === inFilename && testFilename.length > 8) return true;
            }
            return false;
          };

          // 2. Iterate through nodes and ONLY extract output media from AI model / generation nodes
          for (const node of nodes) {
            const nodeData = node.data || {};
            const nodeType = (nodeData.type || node.type || nodeData.category || '').toLowerCase();
            const nodeName = (nodeData.name || node.name || nodeData.menu?.displayName || nodeData.title || '').toLowerCase();

            // Skip pure input/upload/file nodes
            if (
              nodeType.includes('upload') ||
              nodeType.includes('input') ||
              nodeType.includes('asset') ||
              nodeType.includes('file') ||
              nodeName.includes('upload') ||
              nodeName.includes('video input') ||
              nodeName.includes('image input') ||
              nodeName.includes('media input') ||
              nodeName.includes('source video') ||
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
              Boolean(nodeData.model) ||
              (node.id && String(node.id).includes('node_model'));

            if (candidates.length === 0 && isModelNode) {
              if (nodeData.result) candidates.push(nodeData.result);
              if (nodeData.output) candidates.push(nodeData.output);
              if (node.result) candidates.push(node.result);
              if (node.output) candidates.push(node.output);
            }

            for (const cand of candidates) {
              if (!cand) continue;
              const resListRaw = Array.isArray(cand) ? cand : [cand];

              for (const resItem of resListRaw) {
                const extracted = extractMediaUrlFromObject(resItem);
                const url = extracted?.url || (typeof resItem === 'string' && resItem.startsWith('http') ? resItem : null);

                if (url && typeof url === 'string' && !isInputReference(url) && !seenUrls.has(url.trim())) {
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
                  const promptText = (typeof resItem === 'object' && resItem?.input?.prompt) || nodeData.params?.prompt || nodeData.input?.prompt || defaultTitle;
                  const coverUrl = extracted?.coverUrl || (typeof resItem === 'object' && (resItem?.viewUrl || resItem?.thumbnailUrl || resItem?.coverUrl)) || '';
                  const aspectRatio = (typeof resItem === 'object' && resItem?.input?.aspect_ratio) || nodeData.params?.aspect_ratio || (itemMode === 'image' ? '1:1' : '9:16');

                  items.push({
                    id: (typeof resItem === 'object' && resItem?.id) || `weavy_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                    mode: itemMode,
                    title: promptText.length > 28 ? `${promptText.slice(0, 28)}...` : promptText,
                    prompt: promptText,
                    createdAt: 'Weavy AI',
                    timestamp: new Date(recipeDetail.updatedAt || recipeDetail.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                    aspectRatio: aspectRatio,
                    resolution: nodeData.params?.resolution || '1080p',
                    duration: itemMode === 'video' ? (nodeData.params?.duration ? `00:${String(nodeData.params.duration).padStart(2, '0')}` : '00:15') : undefined,
                    model: modelName,
                    mediaUrl: mediaUrl,
                    thumbnailUrl: coverUrl || mediaUrl,
                    status: 'completed',
                    isFavorite: false,
                    recipeId,
                    progress: 100,
                    rawTimestamp: new Date(recipeDetail.updatedAt || recipeDetail.createdAt || Date.now()).getTime(),
                  });
                }
              }
            }
          }
        } catch (e) {
          // ignore error per single recipe
        }
      }

    items.sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));

    return res.json({ success: true, count: items.length, items });
  } catch (err: any) {
    console.error('[Server] Fetch History Error:', err?.message);
    return res.status(500).json({ success: false, error: err?.message || 'Gagal mengambil histori dari Weavy.' });
  }
});

  // Helper parser for RoboNeo Access Tokens
  function parseRoboneoAccessToken(token: string) {
    try {
      let clean = (token || '').trim();
      let rawToken = clean;
      if (clean.startsWith('_v2')) clean = clean.slice(3);
      else if (clean.startsWith('v2')) clean = clean.slice(2);

      const decoded = Buffer.from(clean, 'base64').toString('utf-8');
      const parts = decoded.split('#');

      const uid = parts[1] || '1289198712';

      // The gateway parameter token required by ai-engine-gateway-roboneo
      let paramToken = '45C30555F10E49629098A75F95828DA6';

      return {
        rawToken,
        uid,
        paramToken,
        decoded,
      };
    } catch (err) {
      return {
        rawToken: token,
        uid: '1289198712',
        paramToken: '45C30555F10E49629098A75F95828DA6',
        decoded: '',
      };
    }
  }

  // RoboNeo Account Verification Endpoint
  app.post('/api/roboneo/accounts/verify', async (req, res) => {
    try {
      const { accessToken } = req.body;
      if (!accessToken || typeof accessToken !== 'string' || !accessToken.trim()) {
        return res.status(400).json({ error: 'Access token RoboNeo wajib diisi.' });
      }

      const cleanToken = accessToken.trim();
      const parsed = parseRoboneoAccessToken(cleanToken);

      const clientId = '1189857647';
      const cookieStr = `__mt_web_access_token__=${cleanToken}; __mt_web_client_id__=${clientId}; __mt_web_login__=${parsed.uid}; __mt_uid__=${parsed.uid}`;

      // 1. Fetch User Profile (screen_name, email, avatar)
      let screenName = '';
      let userEmail = '';
      let userAvatar = '';

      try {
        const profileRes = await axios.get(
          'https://api.account.meitu.com/users/show_current?client_id=1189857647&client_language=en&overseas=1&client_type=2&web_version=4.9.0&zip_version=4.76000&is_web=1&client_accept_cookies=1&country_code=ID&with_member_info=1&with_watsons_member=1',
          {
            headers: {
              'Accept': '*/*',
              'Access-Token': cleanToken,
              'Cookie': cookieStr,
              'Origin': 'https://www.roboneo.com',
              'Referer': 'https://www.roboneo.com/',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
            },
            timeout: 10000,
          }
        );

        const userData = profileRes.data?.response?.user || profileRes.data?.user || profileRes.data?.data;
        if (userData) {
          screenName = userData.screen_name || userData.name || userData.nickname || '';
          userEmail = userData.email || '';
          userAvatar = userData.avatar || '';
        }
      } catch (err: any) {
        console.warn('[RoboNeo Profile Fetch Warning]:', err.message);
      }

      // 2. Fetch Credit / Quota Balance & Membership Info
      let credits: number | string = 0;
      let totalCredits: number | string = 0;
      let isVip = false;

      const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'Cookie': cookieStr,
        'Origin': 'https://www.roboneo.com',
        'Referer': 'https://www.roboneo.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'access-token': cleanToken,
        'client-id': clientId,
      };

      const payload = {
        token: parsed.paramToken,
        gid: '19f8ec82bc32e65-0daaafa24c3ed4-26071951-1440000-19f8ec82bc43751',
        uid: parsed.uid,
        client_id: clientId,
        app_scene: 'roboneo',
        area_code: 'ID',
        lang: 'en',
        time_zone: 'Asia/Jakarta',
      };

      try {
        const memRes = await axios.post('https://agent-api-roboneo.meitu.com/api/commerce/membership_info', payload, {
          headers,
          timeout: 10000,
        });

        const resData = memRes.data?.result || memRes.data?.data || memRes.data?.response || memRes.data || {};

        if (resData.is_vip === 1 || resData.is_vip === true) {
          isVip = true;
        }

        // Prioritize real total_amount field from RoboNeo membership API
        if (resData.total_amount !== undefined && resData.total_amount !== null) {
          const rawStr = String(resData.total_amount);
          const num = parseInt(rawStr.replace(/[^0-9]/g, ''), 10);
          credits = !isNaN(num) ? num : rawStr;
          totalCredits = credits;
        } else if (Array.isArray(resData.detail_list)) {
          let sumLeft = 0;
          let foundAny = false;
          for (const d of resData.detail_list) {
            if (Array.isArray(d.meiye_balance_list)) {
              for (const b of d.meiye_balance_list) {
                if (b.left_info !== undefined && b.left_info !== null) {
                  const num = parseInt(String(b.left_info).replace(/[^0-9]/g, ''), 10);
                  if (!isNaN(num)) {
                    sumLeft += num;
                    foundAny = true;
                  }
                }
              }
            }
          }
          if (foundAny) {
            credits = sumLeft;
            totalCredits = sumLeft;
          }
        }

        if (resData.left_credits !== undefined) credits = resData.left_credits;
        else if (resData.remaining_quota !== undefined) credits = resData.remaining_quota;
        else if (resData.credits !== undefined) credits = resData.credits;

        if (resData.total_credits !== undefined) totalCredits = resData.total_credits;
        else if (resData.total_quota !== undefined) totalCredits = resData.total_quota;
        else if (resData.totalCredits !== undefined) totalCredits = resData.totalCredits;
      } catch (err: any) {
        console.warn('[RoboNeo Membership Info Warning]:', err.message);
      }

      const finalName = screenName || (parsed.uid ? `RoboNeo (${parsed.uid})` : 'RoboNeo Account');
      const finalEmail = userEmail || screenName || (parsed.uid ? `${parsed.uid}@roboneo.com` : 'roboneo@account');

      return res.json({
        success: true,
        accessToken: cleanToken,
        paramToken: parsed.paramToken,
        uid: parsed.uid,
        name: finalName,
        email: finalEmail,
        avatar: userAvatar,
        credits: credits,
        totalCredits: totalCredits,
        isVip: isVip,
      });
    } catch (err: any) {
      console.error('[RoboNeo Account Verify Error]:', err?.message);
      return res.status(500).json({ error: err?.message || 'Gagal memverifikasi token RoboNeo.' });
    }
  });

  // Galleri5 Account Verification Endpoint
  app.post('/api/galleri5/accounts/verify', async (req, res) => {
    try {
      const { accessToken } = req.body;
      if (!accessToken || typeof accessToken !== 'string' || !accessToken.trim()) {
        return res.status(400).json({ error: 'Refresh token Galleri5 wajib diisi.' });
      }

      let cleanToken = accessToken.trim();
      if (cleanToken.toLowerCase().startsWith('bearer ')) {
        cleanToken = cleanToken.slice(7).trim();
      }

      let bearerToken = cleanToken;
      let savedRefreshToken = cleanToken;

      // Attempt to exchange refresh_token via Google SecureToken API if applicable
      try {
        const refreshRes = await axios.post(
          'https://securetoken.googleapis.com/v1/token?key=AIzaSyBejuWIKZ7yQT9bdG_jnb4RrkW3DoFCNNo',
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: cleanToken,
          }).toString(),
          {
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
              'origin': 'https://aistudio.galleri5.com',
              'referer': 'https://aistudio.galleri5.com/',
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
            },
            timeout: 10000,
          }
        );

        if (refreshRes.data) {
          bearerToken = refreshRes.data.id_token || refreshRes.data.access_token || bearerToken;
          savedRefreshToken = refreshRes.data.refresh_token || savedRefreshToken;
        }
      } catch (refreshErr: any) {
        console.log('[Galleri5] SecureToken exchange skipped/failed, trying token directly...', refreshErr?.message);
      }

      const response = await axios.post(
        'https://aistudio-backend.calmdesert-ca599847.centralindia.azurecontainerapps.io/api/v1/auth/me/info',
        {},
        {
          headers: {
            'accept': '*/*',
            'accept-language': 'en-US,en;q=0.9',
            'authorization': `Bearer ${bearerToken}`,
            'content-type': 'application/json',
            'origin': 'https://aistudio.galleri5.com',
            'referer': 'https://aistudio.galleri5.com/',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
          },
          timeout: 12000,
        }
      );

      const data = response.data || {};
      const displayName = data.display_name || data.email || 'Galleri5 User';

      return res.json({
        success: true,
        displayName: displayName,
        email: data.email || '',
        credits: data.available_credits !== undefined ? data.available_credits : 0,
        totalCredits: data.total_credits !== undefined ? data.total_credits : 0,
        creditsUsed: data.credits_used !== undefined ? data.credits_used : 0,
        userId: data.user_id || data.firebase_uid || '',
        photoUrl: data.photo_url || '',
        cleanToken: savedRefreshToken,
      });
    } catch (err: any) {
      console.error('[Galleri5 Account Verify Error]:', err?.response?.data || err?.message);
      const msg = err?.response?.data?.message || err?.message || 'Refresh token Galleri5 tidak valid atau kadaluarsa.';
      return res.status(500).json({ error: msg });
    }
  });

  // Galleri5 File Upload Endpoint
  app.post('/api/galleri5/upload', (req, res, next) => {
    upload.single('file')(req as any, res as any, (err) => {
      next();
    });
  }, async (req, res) => {
    try {
      const authHeader = req.headers['authorization'] || '';
      const { fileData, accessToken, refreshToken, idToken, fileName: reqFileName, mimeType: reqMimeType, organizationId: reqOrgId } = req.body || {};
      const token = (accessToken || refreshToken || idToken || (typeof authHeader === 'string' ? authHeader.replace(/^bearer /i, '') : '') || '').trim();

      if (!token) {
        return res.status(400).json({ error: 'Token Galleri5 (Refresh Token / Bearer Token) tidak ditemukan.' });
      }

      let fileBuffer: Buffer | null = null;
      let fileName = reqFileName || `upload_${Date.now()}.jpg`;
      let mimeType = reqMimeType || 'image/jpeg';

      if (req.file) {
        fileBuffer = req.file.buffer;
        fileName = req.file.originalname || fileName;
        mimeType = req.file.mimetype || mimeType;
      } else if (fileData) {
        const rawStr = String(fileData).trim();
        if (rawStr.startsWith('http://') || rawStr.startsWith('https://')) {
          return res.json({ success: true, url: rawStr });
        }

        if (rawStr.includes(';base64,')) {
          const parts = rawStr.split(';base64,');
          const header = parts[0];
          const b64 = parts[1];
          if (header.startsWith('data:')) {
            mimeType = header.replace('data:', '');
          }
          fileBuffer = Buffer.from(b64, 'base64');
        } else {
          fileBuffer = Buffer.from(rawStr, 'base64');
        }
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: 'Data file tidak valid atau kosong.' });
      }

      console.log(`[Server 📤 Galleri5 Upload] File ${fileName} (${mimeType}, ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB)...`);

      let bearerToken = token;
      let orgId = reqOrgId || '6a7af3489446f8219a5b29cf';

      // 1. Refresh Token -> Google SecureToken ID Token exchange
      try {
        const refreshRes = await axios.post(
          'https://securetoken.googleapis.com/v1/token?key=AIzaSyBejuWIKZ7yQT9bdG_jnb4RrkW3DoFCNNo',
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: token,
          }).toString(),
          {
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
              'origin': 'https://aistudio.galleri5.com',
              'referer': 'https://aistudio.galleri5.com/',
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
            },
            timeout: 10000,
          }
        );

        if (refreshRes.data) {
          bearerToken = refreshRes.data.id_token || refreshRes.data.access_token || bearerToken;
        }
      } catch (refreshErr: any) {
        console.log('[Galleri5 Upload] SecureToken exchange skipped/failed, trying token directly...', refreshErr?.message);
      }

      // 2. Fetch User Info to get exact Organization ID if not provided
      if (!reqOrgId) {
        try {
          const meRes = await axios.post(
            'https://aistudio-backend.calmdesert-ca599847.centralindia.azurecontainerapps.io/api/v1/auth/me/info',
            {},
            {
              headers: {
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.9',
                'authorization': `Bearer ${bearerToken}`,
                'content-type': 'application/json',
                'origin': 'https://aistudio.galleri5.com',
                'referer': 'https://aistudio.galleri5.com/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
              },
              timeout: 8000,
            }
          );

          if (meRes.data) {
            orgId = meRes.data.primary_organization_id || meRes.data.organization_id || orgId;
          }
        } catch (meErr: any) {
          console.warn('[Galleri5 Upload] User info lookup skipped, using default orgId:', orgId);
        }
      }

      // 3. Upload File to Galleri5 backend
      const formData = new FormData();
      formData.append('file', fileBuffer, {
        filename: fileName,
        contentType: mimeType,
        knownLength: fileBuffer.length,
      });

      const uploadRes = await axios.post(
        'https://aistudio-backend.calmdesert-ca599847.centralindia.azurecontainerapps.io/api/v1/file-upload',
        formData,
        {
          headers: {
            'accept': '*/*',
            'accept-language': 'en-US,en;q=0.9',
            'authorization': `Bearer ${bearerToken}`,
            'origin': 'https://aistudio.galleri5.com',
            'priority': 'u=1, i',
            'referer': 'https://aistudio.galleri5.com/',
            'sec-ch-ua': '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
            'x-organization-id': orgId,
            ...formData.getHeaders(),
          },
          timeout: 120000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );

      const uData = uploadRes.data?.data || uploadRes.data || {};
      const resultUrl = uData?.file_url || uData?.url || uData?.download_url || uData?.media_url || (typeof uData === 'string' && uData.startsWith('http') ? uData : null);

      if (resultUrl) {
        console.log('[Server ✅ Galleri5 Upload Success]:', resultUrl);
        return res.json({ success: true, url: resultUrl, data: uData });
      }

      console.log('[Server ℹ️ Galleri5 Upload Full Response]:', JSON.stringify(uploadRes.data));
      return res.json({ success: true, url: uploadRes.data?.url || uploadRes.data?.file_url || '', data: uploadRes.data });
    } catch (err: any) {
      console.error('[Galleri5 Upload Error]:', err?.response?.data || err?.message);
      return res.status(500).json({
        error: cleanErrorMessage(err) || 'Gagal mengunggah file ke Galleri5.',
      });
    }
  });

  // Galleri5 Generate Endpoint (Kling 2.6 Motion Control Standar)
  app.post('/api/galleri5/generate', async (req, res) => {
    try {
      const authHeader = req.headers['authorization'] || '';
      const {
        accessToken,
        refreshToken,
        idToken,
        imageUrl,
        videoUrl,
        prompt,
        keepOriginalSound = true,
        characterOrientation = 'video',
        safetyTolerance = 5,
        modelPath = 'fal-ai/kling-video-v2.6-standard-motion-control',
        organizationId: reqOrgId,
      } = req.body || {};

      const token = (accessToken || refreshToken || idToken || (typeof authHeader === 'string' ? authHeader.replace(/^bearer /i, '') : '') || '').trim();

      if (!token) {
        return res.status(400).json({ error: 'Token Galleri5 wajib diisi.' });
      }

      if (!imageUrl || !videoUrl) {
        return res.status(400).json({ error: 'Lampirkan gambar (Image) dan video gerakan (Motion Video) terlebih dahulu.' });
      }

      let bearerToken = token;
      let orgId = reqOrgId || '6a7af3489446f8219a5b29cf';

      // 1. Refresh Token -> Google SecureToken ID Token exchange
      try {
        const refreshRes = await axios.post(
          'https://securetoken.googleapis.com/v1/token?key=AIzaSyBejuWIKZ7yQT9bdG_jnb4RrkW3DoFCNNo',
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: token,
          }).toString(),
          {
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
              'origin': 'https://aistudio.galleri5.com',
              'referer': 'https://aistudio.galleri5.com/',
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
            },
            timeout: 10000,
          }
        );

        if (refreshRes.data) {
          bearerToken = refreshRes.data.id_token || refreshRes.data.access_token || bearerToken;
        }
      } catch (refreshErr: any) {
        console.log('[Galleri5 Generate] SecureToken exchange skipped/failed, using token directly...', refreshErr?.message);
      }

      // 2. Get Org ID if missing
      if (!reqOrgId) {
        try {
          const meRes = await axios.post(
            'https://aistudio-backend.calmdesert-ca599847.centralindia.azurecontainerapps.io/api/v1/auth/me/info',
            {},
            {
              headers: {
                'accept': '*/*',
                'authorization': `Bearer ${bearerToken}`,
                'content-type': 'application/json',
                'origin': 'https://aistudio.galleri5.com',
                'referer': 'https://aistudio.galleri5.com/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
              },
              timeout: 8000,
            }
          );
          if (meRes.data) {
            orgId = meRes.data.primary_organization_id || meRes.data.organization_id || orgId;
          }
        } catch (meErr: any) {
          console.warn('[Galleri5 Generate] User info lookup failed, using default orgId:', orgId);
        }
      }

      // Generate session_id
      const sessionId = `session_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;

      // 3. Register unit-sessions
      try {
        console.log(`[Galleri5 🚀 Unit-Sessions] Initializing session ${sessionId} for org ${orgId}...`);
        await axios.post(
          'https://aistudio-backend.calmdesert-ca599847.centralindia.azurecontainerapps.io/api/v1/unit-sessions',
          {
            unit_type: 'model_garden',
            session_type: 'generation',
            name: 'Kling Video v2.6 Motion Control [Standard]',
            state: {
              model_path: modelPath,
            },
            session_id: sessionId,
            organization_id: orgId,
          },
          {
            headers: {
              'accept': '*/*',
              'authorization': `Bearer ${bearerToken}`,
              'content-type': 'application/json',
              'origin': 'https://aistudio.galleri5.com',
              'referer': 'https://aistudio.galleri5.com/',
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
              'x-organization-id': orgId,
            },
            timeout: 10000,
          }
        );
      } catch (unitErr: any) {
        console.warn('[Galleri5 Unit-Sessions Warning]:', unitErr?.response?.data || unitErr?.message);
      }

      // 4. Submit form stream
      console.log(`[Galleri5 🎬 Submit Stream] Submitting Kling 2.6 Motion Control...`, { imageUrl, videoUrl, sessionId });

      const streamPayload = {
        model_path: modelPath,
        form_fields: {
          keep_original_sound: Boolean(keepOriginalSound),
          image_url: imageUrl,
          video_url: videoUrl,
          character_orientation: characterOrientation || 'video',
          safety_tolerance: Number(safetyTolerance) || 5,
          ...(prompt ? { prompt } : {}),
        },
        session_id: sessionId,
        error_config: {
          strategy: 'retry_same',
          context: 'interactive',
          max_retries: 3,
        },
      };

      const submitRes = await axios.post(
        'https://aistudio-backend.calmdesert-ca599847.centralindia.azurecontainerapps.io/api/v1/model-garden/submit-form-stream',
        streamPayload,
        {
          headers: {
            'accept': '*/*',
            'authorization': `Bearer ${bearerToken}`,
            'content-type': 'application/json',
            'origin': 'https://aistudio.galleri5.com',
            'priority': 'u=1, i',
            'referer': 'https://aistudio.galleri5.com/',
            'sec-ch-ua': '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
            'x-organization-id': orgId,
          },
          responseType: 'stream',
          timeout: 300000, // 5 minutes timeout for stream
        }
      );

      // Consume stream
      let accumulatedText = '';
      let finalVideoUrl = '';
      let extractedPredictionId = '';

      await new Promise<void>((resolve, reject) => {
        const stream = submitRes.data;

        stream.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf-8');
          accumulatedText += text;

          // Search for video/output URLs or prediction_id in text lines
          const lines = text.split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            let jsonText = line.trim();
            if (jsonText.startsWith('data:')) {
              jsonText = jsonText.replace(/^data:\s*/, '').trim();
            }

            try {
              const parsed = JSON.parse(jsonText);
              if (parsed?.prediction_id || parsed?.jobrouter_job_id) {
                extractedPredictionId = parsed.prediction_id || parsed.jobrouter_job_id || extractedPredictionId;
              }

              const possibleUrl =
                parsed?.video_url ||
                parsed?.output_url ||
                parsed?.result_url ||
                parsed?.url ||
                parsed?.file_url ||
                parsed?.download_url ||
                parsed?.data?.video_url ||
                parsed?.data?.output_url ||
                parsed?.data?.url ||
                parsed?.data?.file_url ||
                parsed?.data?.result?.video_url ||
                (typeof parsed?.output === 'string' && parsed.output.startsWith('http') ? parsed.output : null);

              if (possibleUrl && typeof possibleUrl === 'string' && possibleUrl.startsWith('http')) {
                finalVideoUrl = possibleUrl;
                console.log('[Galleri5 Stream 🎯 Found Video URL]:', finalVideoUrl);
              }
            } catch (e) {
              const match = jsonText.match(/(https:\/\/[^\s"']+\.(mp4|mov|webm|png|jpg|jpeg|gif)[^\s"']*)/i) ||
                            jsonText.match(/(https:\/\/tinifyai[^\s"']+)/i) ||
                            jsonText.match(/(https:\/\/[^\s"']+\/output[^\s"']*)/i);
              if (match && match[1]) {
                finalVideoUrl = match[1];
                console.log('[Galleri5 Stream 🎯 Regex Found URL]:', finalVideoUrl);
              }
            }
          }
        });

        stream.on('end', () => {
          resolve();
        });

        stream.on('error', (err: any) => {
          reject(err);
        });
      });

      if (!finalVideoUrl && accumulatedText) {
        const globalMatch = accumulatedText.match(/https:\/\/[^\s"']+\.(mp4|mov|webm)[^\s"']*/gi) ||
                            accumulatedText.match(/https:\/\/tinifyai[^\s"']+/gi);
        if (globalMatch && globalMatch.length > 0) {
          finalVideoUrl = globalMatch[globalMatch.length - 1];
        }
      }

      if (!extractedPredictionId && accumulatedText) {
        try {
          const fullParsed = JSON.parse(accumulatedText);
          extractedPredictionId = fullParsed?.prediction_id || fullParsed?.jobrouter_job_id || '';
        } catch (e) {}
      }

      if (finalVideoUrl) {
        console.log('[Server ✅ Galleri5 Generate Complete Immediately]:', finalVideoUrl);
        return res.json({
          success: true,
          status: 'completed',
          mediaUrl: finalVideoUrl,
          resultUrl: finalVideoUrl,
          sessionId: sessionId,
          predictionId: extractedPredictionId,
          recipeId: sessionId,
          taskId: sessionId,
        });
      }

      console.log(`[Galleri5 ⏳ Job Submitted for Polling]: Session ${sessionId}, Prediction ${extractedPredictionId}`);
      return res.json({
        success: true,
        status: 'processing',
        mediaUrl: '',
        sessionId: sessionId,
        predictionId: extractedPredictionId,
        recipeId: sessionId,
        taskId: sessionId,
        rawOutput: accumulatedText.slice(0, 300),
      });

    } catch (err: any) {
      console.error('[Galleri5 Generate Error]:', err?.response?.data || err?.message);
      return res.status(500).json({
        error: cleanErrorMessage(err) || 'Gagal memproses generasi video Galleri5.',
      });
    }
  });

  // Galleri5 Polling Endpoint
  app.post('/api/poll-galleri5-status', async (req, res) => {
    try {
      const authHeader = req.headers['authorization'] || '';
      const {
        accessToken,
        sessionId,
        predictionId,
        organizationId: reqOrgId,
      } = req.body || {};

      const token = (accessToken || (typeof authHeader === 'string' ? authHeader.replace(/^bearer /i, '') : '') || '').trim();

      if (!token) {
        return res.status(400).json({ error: 'Token Galleri5 wajib diisi.' });
      }

      let bearerToken = token;
      let orgId = reqOrgId || '6a7af3489446f8219a5b29cf';

      try {
        const refreshRes = await axios.post(
          'https://securetoken.googleapis.com/v1/token?key=AIzaSyBejuWIKZ7yQT9bdG_jnb4RrkW3DoFCNNo',
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: token,
          }).toString(),
          {
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
              'origin': 'https://aistudio.galleri5.com',
              'referer': 'https://aistudio.galleri5.com/',
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
            },
            timeout: 8000,
          }
        );
        if (refreshRes.data) {
          bearerToken = refreshRes.data.id_token || refreshRes.data.access_token || bearerToken;
        }
      } catch (e) {}

      const headers = {
        'accept': '*/*',
        'authorization': `Bearer ${bearerToken}`,
        'content-type': 'application/json',
        'origin': 'https://aistudio.galleri5.com',
        'referer': 'https://aistudio.galleri5.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
        'x-organization-id': orgId,
      };

      let mediaUrl = '';
      let isCompleted = false;
      let isFailed = false;
      let errorMessage = '';

      // 0. Primary Check: session-preview endpoint (returns ONLY generated output media)
      if (sessionId) {
        try {
          const previewRes = await axios.post(
            'https://aistudio-backend.calmdesert-ca599847.centralindia.azurecontainerapps.io/api/v1/model-garden/inferences/session-preview',
            {
              session_ids: [sessionId],
              limit_per_session: 4,
            },
            { headers, timeout: 10000 }
          );

          console.log('[Galleri5 Poll Preview Data]:', JSON.stringify(previewRes.data).slice(0, 400));
          const previews = previewRes.data?.previews || [];
          const sessionPreview = previews.find((p: any) => p.session_id === sessionId) || previews[0];

          if (sessionPreview && Array.isArray(sessionPreview.media) && sessionPreview.media.length > 0) {
            for (const mItem of sessionPreview.media) {
              const url = mItem?.url || mItem?.video_url || mItem?.asset_url;
              if (url && typeof url === 'string' && url.startsWith('http')) {
                mediaUrl = url;
                isCompleted = true;
                break;
              }
            }
          }
        } catch (prevErr: any) {
          console.warn('[Galleri5 Poll Preview Error]:', prevErr?.message);
        }
      }

      // 1. Check unit-sessions endpoint if not found in preview
      if (!isCompleted && sessionId) {
        try {
          const sessionRes = await axios.get(
            `https://aistudio-backend.calmdesert-ca599847.centralindia.azurecontainerapps.io/api/v1/unit-sessions/${sessionId}`,
            { headers, timeout: 10000 }
          );
          const sData = sessionRes.data?.data || sessionRes.data || {};
          console.log('[Galleri5 Poll Session Data]:', JSON.stringify(sData).slice(0, 400));

          const latestInf = sData.latest_inference || {};
          const status = (latestInf.status || sData.status || sData.state?.status || sData.session_status || '').toLowerCase();

          if (status === 'completed' || status === 'succeeded' || status === 'success') {
            isCompleted = true;
          } else if (status === 'failed' || status === 'error') {
            isFailed = true;
            errorMessage = latestInf.error || latestInf.error_message || sData.error || sData.errorMessage || 'Generasi video Galleri5 gagal.';
          }

          // Extract output URL from latest_inference or session root
          const extractedUrl =
            latestInf.asset_url ||
            latestInf.result_url ||
            (Array.isArray(latestInf.result_urls) && latestInf.result_urls[0]) ||
            (Array.isArray(latestInf.s3_urls) && latestInf.s3_urls[0]) ||
            sData.output_url ||
            sData.result_url ||
            sData.video_url ||
            sData.state?.output_url ||
            sData.state?.result_url ||
            sData.state?.video_url ||
            sData.state?.output?.video_url ||
            sData.state?.output?.url;

          if (extractedUrl && typeof extractedUrl === 'string' && extractedUrl.startsWith('http')) {
            mediaUrl = extractedUrl;
            isCompleted = true;
          }
        } catch (sErr: any) {
          console.warn('[Galleri5 Poll Session Error]:', sErr?.message);
        }
      }

      // 2. Jalur 3: Check unit-sessions list (History) to see if sessionId is already completed
      if (!isCompleted && sessionId) {
        try {
          const listRes = await axios.get(
            'https://aistudio-backend.calmdesert-ca599847.centralindia.azurecontainerapps.io/api/v1/unit-sessions?session_type=generation&limit=20',
            { headers, timeout: 10000 }
          );
          const rawData = listRes.data?.data || listRes.data || [];
          const sessionList = Array.isArray(rawData) ? rawData : Array.isArray(rawData.sessions) ? rawData.sessions : [];
          const targetSession = sessionList.find((s: any) => s.session_id === sessionId || s._id === sessionId || s.id === sessionId);

          if (targetSession) {
            const targetLatest = targetSession.latest_inference || {};
            const targetUrl =
              targetLatest.asset_url ||
              targetLatest.result_url ||
              (Array.isArray(targetLatest.result_urls) && targetLatest.result_urls[0]) ||
              (Array.isArray(targetLatest.s3_urls) && targetLatest.s3_urls[0]);

            if (targetUrl && typeof targetUrl === 'string' && targetUrl.startsWith('http')) {
              mediaUrl = targetUrl;
              isCompleted = true;
            } else {
              // Query session-preview with the session_ids from history
              const listSessionIds = sessionList.map((s: any) => s.session_id || s._id || s.id).filter(Boolean);
              if (listSessionIds.length > 0) {
                const prevListRes = await axios.post(
                  'https://aistudio-backend.calmdesert-ca599847.centralindia.azurecontainerapps.io/api/v1/model-garden/inferences/session-preview',
                  { session_ids: listSessionIds, limit_per_session: 4 },
                  { headers, timeout: 10000 }
                );
                const prevList = prevListRes.data?.previews || [];
                const matchPrev = prevList.find((p: any) => p.session_id === sessionId);
                if (matchPrev && Array.isArray(matchPrev.media) && matchPrev.media.length > 0) {
                  for (const m of matchPrev.media) {
                    if (m?.url && typeof m.url === 'string' && m.url.startsWith('http')) {
                      mediaUrl = m.url;
                      isCompleted = true;
                      break;
                    }
                  }
                }
              }
            }
          }
        } catch (listErr: any) {
          console.warn('[Galleri5 Poll List Auto-Sync Error]:', listErr?.message);
        }
      }

      // 2. Try prediction / job router endpoint if not yet completed
      if (!isCompleted && !isFailed && predictionId) {
        for (const urlPath of [
          `https://aistudio-backend.calmdesert-ca599847.centralindia.azurecontainerapps.io/api/v1/model-garden/predictions/${predictionId}`,
          `https://aistudio-backend.calmdesert-ca599847.centralindia.azurecontainerapps.io/api/v1/model-garden/jobs/${predictionId}`,
        ]) {
          try {
            const predRes = await axios.get(urlPath, { headers, timeout: 10000 });
            const pData = predRes.data?.data || predRes.data || {};
            console.log('[Galleri5 Poll Prediction Data]:', JSON.stringify(pData).slice(0, 400));

            const pStatus = (pData.status || '').toLowerCase();
            if (pStatus === 'completed' || pStatus === 'succeeded' || pStatus === 'success') {
              isCompleted = true;
            } else if (pStatus === 'failed' || pStatus === 'error') {
              isFailed = true;
              errorMessage = pData.error || 'Generasi video Galleri5 gagal.';
            }

            const pUrl = pData.video_url || pData.output_url || pData.result_url || (typeof pData.output === 'string' && pData.output.startsWith('http') ? pData.output : null);
            if (pUrl && typeof pUrl === 'string' && !pUrl.includes('tinifyai.blob.core.windows.net/tinify/uploads/')) {
              mediaUrl = pUrl;
              isCompleted = true;
              break;
            } else {
              const fullStr = JSON.stringify(predRes.data);
              const matches = fullStr.match(/https:\/\/[^\s"']+\.(mp4|mov|webm)[^\s"']*/gi) || [];
              for (const m of matches) {
                if (!m.includes('tinifyai.blob.core.windows.net/tinify/uploads/')) {
                  mediaUrl = m;
                  isCompleted = true;
                  break;
                }
              }
              if (isCompleted) break;
            }
          } catch (pErr) {}
        }
      }

      if (isCompleted && mediaUrl) {
        console.log('[Server ✅ Galleri5 Poll Completed]:', mediaUrl);
        return res.json({
          status: 'completed',
          mediaUrl: mediaUrl,
          resultUrl: mediaUrl,
        });
      }

      if (isFailed) {
        return res.json({
          status: 'failed',
          errorMessage: errorMessage || 'Generasi video Galleri5 gagal.',
        });
      }

      return res.json({
        status: 'processing',
      });

    } catch (err: any) {
      console.error('[Galleri5 Poll Error]:', err?.message);
      return res.status(500).json({ error: 'Gagal mengecek status generasi Galleri5.' });
    }
  });

  // Galleri5 History Endpoint
  app.post('/api/galleri5/history', async (req, res) => {
    try {
      const authHeader = req.headers['authorization'] || '';
      const { refreshToken, accessToken, organizationId: reqOrgId } = req.body || {};

      const token = (refreshToken || accessToken || (typeof authHeader === 'string' ? authHeader.replace(/^bearer /i, '') : '') || '').trim();

      if (!token) {
        return res.status(400).json({ error: 'Token Galleri5 wajib diisi.' });
      }

      let bearerToken = token;
      let orgId = reqOrgId || '6a7af3489446f8219a5b29cf';

      try {
        const refreshRes = await axios.post(
          'https://securetoken.googleapis.com/v1/token?key=AIzaSyBejuWIKZ7yQT9bdG_jnb4RrkW3DoFCNNo',
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: token,
          }).toString(),
          {
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
              'origin': 'https://aistudio.galleri5.com',
              'referer': 'https://aistudio.galleri5.com/',
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
            },
            timeout: 8000,
          }
        );
        if (refreshRes.data) {
          bearerToken = refreshRes.data.id_token || refreshRes.data.access_token || bearerToken;
        }
      } catch (e) {}

      const headers = {
        'accept': '*/*',
        'authorization': `Bearer ${bearerToken}`,
        'content-type': 'application/json',
        'origin': 'https://aistudio.galleri5.com',
        'referer': 'https://aistudio.galleri5.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
        'x-organization-id': orgId,
      };

      // 1. Fetch unit-sessions list
      let sessionList: any[] = [];
      try {
        const listRes = await axios.get(
          'https://aistudio-backend.calmdesert-ca599847.centralindia.azurecontainerapps.io/api/v1/unit-sessions?session_type=generation&limit=50',
          { headers, timeout: 12000 }
        );
        const rawData = listRes.data?.data || listRes.data || [];
        sessionList = Array.isArray(rawData) ? rawData : Array.isArray(rawData.sessions) ? rawData.sessions : [];
      } catch (err: any) {
        console.warn('[Galleri5 History Unit-Sessions Error]:', err?.message);
      }

      if (!sessionList || sessionList.length === 0) {
        return res.json({ success: true, items: [] });
      }

      // Extract session IDs
      const sessionIds = sessionList
        .map((s) => s.session_id || s._id || s.id)
        .filter(Boolean)
        .slice(0, 30);

      // 2. Query session-preview for output media
      let previewMap: Record<string, string> = {};
      if (sessionIds.length > 0) {
        try {
          const previewRes = await axios.post(
            'https://aistudio-backend.calmdesert-ca599847.centralindia.azurecontainerapps.io/api/v1/model-garden/inferences/session-preview',
            {
              session_ids: sessionIds,
              limit_per_session: 4,
            },
            { headers, timeout: 12000 }
          );

          const previews = previewRes.data?.previews || [];
          for (const prevItem of previews) {
            const sid = prevItem.session_id;
            if (sid && Array.isArray(prevItem.media)) {
              for (const m of prevItem.media) {
                if (m?.url && typeof m.url === 'string' && m.url.startsWith('http')) {
                  previewMap[sid] = m.url;
                  break;
                }
              }
            }
          }
        } catch (prevErr: any) {
          console.warn('[Galleri5 History Session-Preview Error]:', prevErr?.message);
        }
      }

      // 3. Format items for frontend
      const items = sessionList.map((s: any) => {
        const sid = s.session_id || s._id || s.id;
        const mediaUrl = previewMap[sid] || '';
        const name = s.name || s.prompt || 'Generasi Video Galleri5';
        const dateObj = s.created_at || s.createdAt ? new Date(s.created_at || s.createdAt) : new Date();
        const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

        return {
          id: `galleri5-${sid}`,
          mode: 'video',
          title: name.length > 28 ? `${name.slice(0, 28)}...` : name,
          prompt: name,
          createdAt: dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
          timestamp: timeString,
          aspectRatio: '9:16',
          resolution: '720p',
          duration: '15s',
          model: 'Kling 2.6 Motion Control Standar',
          mediaUrl: mediaUrl,
          thumbnailUrl: mediaUrl,
          status: mediaUrl ? 'completed' : 'processing',
          progress: mediaUrl ? 100 : 50,
          taskId: sid,
          recipeId: sid,
        };
      });

      return res.json({
        success: true,
        items: items,
      });

    } catch (err: any) {
      console.error('[Galleri5 History Error]:', err?.message);
      return res.status(500).json({ error: 'Gagal mengambil histori Galleri5.' });
    }
  });

  // Kie.ai Account Verification Endpoint
  app.post('/api/kie/accounts/verify', async (req, res) => {
    try {
      const { accessToken } = req.body;
      if (!accessToken || typeof accessToken !== 'string' || !accessToken.trim()) {
        return res.status(400).json({ error: 'API Key / Token Kie.ai wajib diisi.' });
      }

      let cleanToken = accessToken.trim();
      if (cleanToken.toLowerCase().startsWith('bearer ')) {
        cleanToken = cleanToken.slice(7).trim();
      }

      let nickname = '';
      let userEmail = '';
      let parsedCredit: number | null = null;
      let parsedTotalCredit: number | null = null;
      let verified = false;

      const authHeaders = [`Bearer ${cleanToken}`, cleanToken];

      // Helper to extract Kie credits from any response shape
      const extractCredit = (resData: any): { credit: number | null; totalCredit: number | null } => {
        if (resData === undefined || resData === null) return { credit: null, totalCredit: null };
        if (typeof resData === 'number') return { credit: resData, totalCredit: resData };
        if (typeof resData === 'string') {
          const num = parseFloat(resData.replace(/[^0-9.]/g, ''));
          if (!isNaN(num)) return { credit: num, totalCredit: num };
        }
        if (typeof resData === 'object') {
          // If direct data number, e.g. { code: 200, data: 120 }
          if (typeof resData.data === 'number') return { credit: resData.data, totalCredit: resData.data };
          if (typeof resData.credit === 'number') return { credit: resData.credit, totalCredit: resData.credit };
          if (typeof resData.credits === 'number') return { credit: resData.credits, totalCredit: resData.credits };
          if (typeof resData.remainedCredits === 'number') return { credit: resData.remainedCredits, totalCredit: resData.remainedCredits };
          if (typeof resData.remainingCredits === 'number') return { credit: resData.remainingCredits, totalCredit: resData.remainingCredits };
          if (typeof resData.userRemainingCredits === 'number') return { credit: resData.userRemainingCredits, totalCredit: resData.userRemainingCredits };

          const candidates = [resData.data, resData.result, resData.user, resData.userInfo, resData.user_info, resData];
          let foundCredit: number | null = null;
          let foundTotal: number | null = null;
          const creditKeys = [
            'remainedCredits', 'remained_credits', 'remaining_credit', 'remaining_credits',
            'remainingCredit', 'remainingCredits', 'userRemainingCredits',
            'credit', 'credits', 'userCredit', 'user_credit', 'user_credits',
            'available_credit', 'available_credits', 'availableCredit', 'availableCredits',
            'usable_credit', 'usable_credits', 'usableCredit', 'usableCredits',
            'balance', 'points', 'quota', 'left_credit', 'left_credits'
          ];
          const totalKeys = ['totalCredit', 'total_credit', 'totalCredits', 'total_credits', 'total_quota', 'totalQuota', 'max_credit', 'maxCredit'];

          for (const cand of candidates) {
            if (!cand) continue;
            if (typeof cand === 'number') {
              if (foundCredit === null) foundCredit = cand;
              continue;
            }
            if (typeof cand === 'object') {
              for (const k of creditKeys) {
                if (typeof cand[k] === 'number') { foundCredit = cand[k]; break; }
                else if (typeof cand[k] === 'string') {
                  const p = parseFloat(cand[k].replace(/[^0-9.]/g, ''));
                  if (!isNaN(p)) { foundCredit = p; break; }
                }
              }
              for (const tk of totalKeys) {
                if (typeof cand[tk] === 'number') { foundTotal = cand[tk]; break; }
                else if (typeof cand[tk] === 'string') {
                  const p = parseFloat(cand[tk].replace(/[^0-9.]/g, ''));
                  if (!isNaN(p)) { foundTotal = p; break; }
                }
              }
            }
            if (foundCredit !== null) break;
          }
          return { credit: foundCredit, totalCredit: foundTotal };
        }
        return { credit: null, totalCredit: null };
      };

      // 1. Official Primary Endpoint: Chat / User Credit (GET https://api.kie.ai/api/v1/chat/credit)
      const creditEndpoints = [
        'https://api.kie.ai/api/v1/chat/credit',
        'https://api.kie.ai/api/v1/user/credit',
        'https://api.kie.ai/v1/chat/credit',
      ];

      for (const endpoint of creditEndpoints) {
        for (const authHeader of authHeaders) {
          try {
            const resp = await axios.get(endpoint, {
              headers: {
                'Authorization': authHeader,
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AMBMedia/1.0',
              },
              validateStatus: () => true,
              timeout: 6000,
            });
            console.log(`[Kie.ai Verify] Checked ${endpoint} -> status: ${resp.status}, data:`, resp.data);
            if (resp.status === 200 && resp.data && (resp.data.code === 200 || resp.data.code === 0 || resp.data.success || resp.data.credit !== undefined || typeof resp.data.data === 'number' || typeof resp.data.data === 'object')) {
              verified = true;
              const { credit, totalCredit } = extractCredit(resp.data);
              if (credit !== null && parsedCredit === null) parsedCredit = credit;
              if (totalCredit !== null && parsedTotalCredit === null) parsedTotalCredit = totalCredit;
              break;
            }
          } catch (e: any) {
            console.warn(`[Kie.ai Verify Credit notice for ${endpoint}]:`, e?.message);
          }
        }
        if (parsedCredit !== null) break;
      }

      // 2. User Info Endpoints (to fetch nickname / email if available)
      const userInfoEndpoints = [
        `https://api.kie.ai/api/v1/user/user-info?time=${Date.now()}`,
        `https://api.kie.ai/api/v1/user/info?time=${Date.now()}`,
        `https://api.kie.ai/client/v1/user/user-info?time=${Date.now()}`,
      ];

      for (const endpoint of userInfoEndpoints) {
        for (const authHeader of authHeaders) {
          try {
            const resp = await axios.get(endpoint, {
              headers: {
                'Authorization': authHeader,
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AMBMedia/1.0',
              },
              validateStatus: () => true,
              timeout: 5000,
            });
            if (resp.status === 200 && resp.data && (resp.data.code === 200 || resp.data.code === 0 || resp.data.success)) {
              verified = true;
              const uData = resp.data.data || resp.data;
              if (typeof uData === 'object') {
                nickname = uData.nickname || uData.userName || uData.name || uData.email || nickname;
                userEmail = uData.email || userEmail;
              }
              if (parsedCredit === null) {
                const { credit, totalCredit } = extractCredit(resp.data);
                if (credit !== null && parsedCredit === null) parsedCredit = credit;
                if (totalCredit !== null && parsedTotalCredit === null) parsedTotalCredit = totalCredit;
              }
              break;
            }
          } catch {}
        }
        if (nickname || userEmail) break;
      }

      // 3. Fallback only if still unverified: pageRecordList
      if (!verified) {
        const uniqueId = crypto.createHash('md5').update(cleanToken).digest('hex');
        for (const authHeader of authHeaders) {
          try {
            const pageRes = await axios.post(
              'https://api.kie.ai/api/v1/playground/pageRecordList',
              {
                pageNum: 1,
                pageSize: 5,
                beginTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
                endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
                successFlag: '',
              },
              {
                headers: {
                  'accept': 'application/json, text/plain, */*',
                  'content-type': 'application/json',
                  'authorization': authHeader,
                  'uniqueid': uniqueId,
                  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AMBMedia/1.0',
                },
                validateStatus: () => true,
                timeout: 6000,
              }
            );
            if (pageRes.status === 200 && pageRes.data && (pageRes.data.code === 200 || pageRes.data.code === 0)) {
              verified = true;
              if (parsedCredit === null) {
                const { credit, totalCredit } = extractCredit(pageRes.data);
                if (credit !== null) parsedCredit = credit;
                if (totalCredit !== null) parsedTotalCredit = totalCredit;
              }
              break;
            }
          } catch {}
        }
      }

      if (!verified) {
        return res.status(401).json({ error: 'API Key / Token Kie.ai tidak valid atau Unauthorized.' });
      }

      const maskedKey = cleanToken.length > 8 ? `${cleanToken.slice(0, 4)}...${cleanToken.slice(-4)}` : cleanToken;
      const finalDisplayName = nickname ? nickname : `Kie.ai (${maskedKey})`;

      return res.json({
        success: true,
        displayName: finalDisplayName,
        nickname: nickname || finalDisplayName,
        email: userEmail || `kie_${maskedKey.replace(/[^a-zA-Z0-9]/g, '')}@kie.ai`,
        credits: parsedCredit !== null ? parsedCredit : undefined,
        totalCredits: parsedTotalCredit !== null ? parsedTotalCredit : (parsedCredit !== null ? parsedCredit : undefined),
        hasValidCredits: parsedCredit !== null,
        creditsUsed: 0,
        userId: `kie_${maskedKey}`,
        photoUrl: 'https://kie.ai/logo.png',
        cleanToken: cleanToken,
      });
    } catch (err: any) {
      console.error('[Kie.ai Account Verify Error]:', err?.response?.data || err?.message);
      return res.status(500).json({ error: err?.response?.data?.msg || err?.message || 'Gagal memverifikasi API Key Kie.ai.' });
    }
  });

  // Kie.ai File Upload Endpoint (Multi-Strategy: Multipart Form-Data & Base64 JSON)
  app.post('/api/kie/upload', (req, res, next) => {
    upload.single('file')(req as any, res as any, (err) => {
      next();
    });
  }, async (req, res) => {
    try {
      const authHeader = req.headers['authorization'] || req.headers['x-api-key'] || '';
      const { fileData, apiKey, accessToken, fileName: reqFileName, mimeType: reqMimeType } = req.body || {};
      const key = (apiKey || accessToken || (typeof authHeader === 'string' ? authHeader : '') || '').trim();

      if (!key) {
        return res.status(400).json({ error: 'API Key / Token Kie.ai tidak terdeteksi.' });
      }

      let cleanToken = key;
      if (cleanToken.toLowerCase().startsWith('bearer ')) {
        cleanToken = cleanToken.slice(7).trim();
      }

      let fileBuffer: Buffer | null = null;
      let rawFileName = reqFileName || 'upload_file.jpg';
      let mimeType = reqMimeType || 'image/jpeg';
      let base64Data = '';

      if (req.file) {
        fileBuffer = req.file.buffer;
        rawFileName = req.file.originalname || rawFileName;
        mimeType = req.file.mimetype || mimeType;
        base64Data = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
      } else if (fileData) {
        const rawStr = String(fileData).trim();
        if (rawStr.startsWith('http://') || rawStr.startsWith('https://')) {
          return res.json({ success: true, url: rawStr });
        }

        if (rawStr.includes(';base64,')) {
          const parts = rawStr.split(';base64,');
          const header = parts[0];
          const b64 = parts[1];
          if (header.startsWith('data:')) {
            mimeType = header.replace('data:', '');
          }
          fileBuffer = Buffer.from(b64, 'base64');
          base64Data = rawStr;
        } else {
          fileBuffer = Buffer.from(rawStr, 'base64');
          base64Data = `data:${mimeType};base64,${rawStr}`;
        }
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: 'Data file tidak valid atau kosong.' });
      }

      // Sanitize fileName to prevent 404 from hash characters (#), emojis, and unencoded spaces
      const rawExt = path.extname(rawFileName) || (mimeType.startsWith('video/') ? '.mp4' : '.jpg');
      const baseClean = path.basename(rawFileName, rawExt).replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').substring(0, 30);
      const safeFileName = `kie_${Date.now()}_${baseClean || 'media'}${rawExt.toLowerCase()}`;

      console.log(`[Server 📤 Kie Upload] File ${rawFileName} -> Sanitized: ${safeFileName} (${mimeType}, ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB)...`);

      let lastError: any = null;

      // Primary Strategy: Base64 Upload to https://kieai.redpandaai.co/api/file-base64-upload
      try {
        console.log('[Server 📤 Kie Upload] Attempting base64 upload to kieai.redpandaai.co...');
        const upRes = await axios.post(
          'https://kieai.redpandaai.co/api/file-base64-upload',
          {
            base64Data: base64Data,
            uploadPath: 'kieai/market',
            fileName: safeFileName,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${cleanToken}`,
            },
            timeout: 45000,
          }
        );

        const uData = upRes.data?.data || upRes.data;
        const resultUrl = uData?.fileUrl || uData?.url || uData?.downloadUrl || (typeof uData === 'string' && uData.startsWith('http') ? uData : null);

        if (resultUrl) {
          console.log('[Server ✅ Kie Upload Success]:', resultUrl);
          return res.json({ success: true, url: resultUrl });
        }
      } catch (err: any) {
        console.warn('[Server ⚠️ Kie Upload Primary Failed]:', err?.response?.data || err?.message);
        lastError = err;
      }

      // Secondary Fallback Strategy: File Stream / Multipart upload to https://api.kie.ai/api/v1/file-upload
      try {
        console.log('[Server 📤 Kie Upload] Fallback: Attempting file stream upload to api.kie.ai/api/v1/file-upload...');
        const formStream = new FormData();
        formStream.append('file', fileBuffer, {
          filename: safeFileName,
          contentType: mimeType,
          knownLength: fileBuffer.length,
        });
        formStream.append('uploadPath', 'kieai/market');

        const upRes = await axios.post('https://api.kie.ai/api/v1/file-upload', formStream, {
          headers: {
            'Authorization': `Bearer ${cleanToken}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ...formStream.getHeaders(),
          },
          timeout: 60000,
        });

        const uData = upRes.data?.data || upRes.data;
        const resultUrl = uData?.fileUrl || uData?.url || uData?.downloadUrl;

        if (resultUrl) {
          console.log('[Server ✅ Kie Upload Fallback Success]:', resultUrl);
          return res.json({ success: true, url: resultUrl });
        }
      } catch (err: any) {
        console.warn('[Server ⚠️ Kie Upload Fallback Failed]:', err?.response?.data || err?.message);
        lastError = err;
      }

      return res.status(500).json({
        error: cleanErrorMessage(lastError) || 'Semua metode upload ke Kie.ai gagal.',
      });
    } catch (error: any) {
      console.error('[Kie Upload Error]:', error?.response?.data || error?.message);
      return res.status(500).json({
        error: cleanErrorMessage(error) || 'Gagal mengunggah file ke Kie.ai.',
      });
    }
  });

  // Kie.ai Video & Image Generation Endpoint (Grok Imagine 1.5, ByteDance Seedance 2.0 Mini, GPT Image 2, etc.)
  app.post('/api/generate-kie', async (req, res) => {
    try {
      const {
        apiKey,
        prompt,
        videoAspectRatio,
        imageAspectRatio,
        videoDuration,
        videoResolution,
        imageUrls,
        videoUrls,
        videoUrl,
        referenceVideoUrls,
        reference_video_urls,
        referenceImageUrls,
        reference_image_urls,
        attachedMedia,
        attached_media,
        mode,
        model,
        enableAudio,
        generate_audio,
        web_search,
        nsfw_checker,
      } = req.body;

      if (!apiKey) {
        return res.status(400).json({ error: 'API Key Kie.ai wajib disediakan.' });
      }

      let cleanToken = apiKey.trim();
      if (cleanToken.toLowerCase().startsWith('bearer ')) {
        cleanToken = cleanToken.slice(7).trim();
      }

      const requestedModelLower = (model || '').toLowerCase();

      let isImageMode = false;
      if (mode === 'image') {
        isImageMode = true;
      } else if (mode === 'video') {
        isImageMode = false;
      } else {
        const isVideoModel =
          requestedModelLower.includes('video') ||
          requestedModelLower.includes('seedance') ||
          requestedModelLower.includes('preview');
        isImageMode = !isVideoModel && (requestedModelLower.includes('gpt') || requestedModelLower.includes('image') || requestedModelLower.includes('seedream'));
      }

      let ar = '16:9';
      const sourceAr = isImageMode ? (imageAspectRatio || videoAspectRatio) : (videoAspectRatio || imageAspectRatio);
      if (sourceAr) {
        if (sourceAr.includes('9:16')) ar = '9:16';
        else if (sourceAr.includes('16:9')) ar = '16:9';
        else if (sourceAr.includes('1:1')) ar = '1:1';
        else if (sourceAr.includes('4:3')) ar = '4:3';
        else if (sourceAr.includes('3:4')) ar = '3:4';
        else if (sourceAr.includes('3:2')) ar = '3:2';
        else if (sourceAr.includes('2:3')) ar = '2:3';
        else if (sourceAr.includes('21:9')) ar = '21:9';
        else if (sourceAr.toLowerCase().includes('auto')) ar = 'auto';
      }

      let dur = 6;
      if (videoDuration) {
        const num = parseInt(videoDuration, 10);
        if (!isNaN(num)) dur = num;
      }

      let resolution = '720p';
      if (requestedModelLower.includes('seedance') || requestedModelLower.includes('mini')) {
        resolution = '480p';
      }
      if (videoResolution) {
        if (videoResolution.includes('1080')) resolution = '1080p';
        else if (videoResolution.includes('720')) resolution = '720p';
        else if (videoResolution.includes('480')) resolution = '480p';
      }

      // Collect raw candidate image URLs (deduplicated)
      const rawImageCandidatesSet = new Set<string>();
      const addImgCandidate = (u: any) => {
        if (typeof u === 'string' && u.trim().length > 0) rawImageCandidatesSet.add(u.trim());
      };
      if (Array.isArray(imageUrls)) imageUrls.forEach(addImgCandidate);
      if (Array.isArray(referenceImageUrls)) referenceImageUrls.forEach(addImgCandidate);
      if (Array.isArray(reference_image_urls)) reference_image_urls.forEach(addImgCandidate);
      const mediaList = Array.isArray(attachedMedia) ? attachedMedia : (Array.isArray(attached_media) ? attached_media : []);
      for (const m of mediaList) {
        if (m && (m.type === 'image' || (!m.type && typeof m.url === 'string' && !m.url.endsWith('.mp4') && !m.url.endsWith('.webm')))) {
          addImgCandidate(m.url);
        }
      }
      const rawImageCandidates = Array.from(rawImageCandidatesSet);

      let finalImageUrls: string[] = [];
      if (rawImageCandidates.length > 0) {
        for (let i = 0; i < rawImageCandidates.length; i++) {
          const rawImg = rawImageCandidates[i];
          if (rawImg && rawImg.startsWith('data:')) {
            try {
              const uploadResp = await axios.post(
                'https://kieai.redpandaai.co/api/file-base64-upload',
                {
                  base64Data: rawImg,
                  base64: rawImg,
                  file: rawImg,
                  uploadPath: 'kieai/market',
                  fileName: `kie_img_${Date.now()}_${i}.jpg`,
                },
                {
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cleanToken}`,
                  },
                  timeout: 30000,
                }
              );
              const uData = uploadResp.data?.data || uploadResp.data;
              const uploadedUrl = uData?.fileUrl || uData?.url || uData?.downloadUrl || rawImg;
              finalImageUrls.push(uploadedUrl);
            } catch (uErr: any) {
              console.warn('[Kie Image Base64 Upload Warning]:', uErr?.response?.data || uErr?.message);
              finalImageUrls.push(rawImg);
            }
          } else if (rawImg && (rawImg.startsWith('http://') || rawImg.startsWith('https://'))) {
            finalImageUrls.push(rawImg);
          }
        }
      }
      // Deduplicate final images
      finalImageUrls = Array.from(new Set(finalImageUrls.filter(Boolean)));
      const finalImageUrl = finalImageUrls[0] || '';

      // Collect raw candidate video URLs for Seedance 2.0 Mini / Video reference models (deduplicated)
      const rawVideoCandidatesSet = new Set<string>();
      const addVidCandidate = (u: any) => {
        if (typeof u === 'string' && u.trim().length > 0) rawVideoCandidatesSet.add(u.trim());
      };
      if (Array.isArray(videoUrls)) videoUrls.forEach(addVidCandidate);
      if (typeof videoUrl === 'string' && videoUrl.trim()) addVidCandidate(videoUrl.trim());
      if (Array.isArray(referenceVideoUrls)) referenceVideoUrls.forEach(addVidCandidate);
      if (Array.isArray(reference_video_urls)) reference_video_urls.forEach(addVidCandidate);
      for (const m of mediaList) {
        if (m && (m.type === 'video' || (typeof m.url === 'string' && (m.url.endsWith('.mp4') || m.url.endsWith('.webm') || m.url.endsWith('.mov'))))) {
          addVidCandidate(m.url);
        }
      }
      const rawVideoCandidates = Array.from(rawVideoCandidatesSet);

      let finalVideoUrls: string[] = [];
      if (rawVideoCandidates.length > 0) {
        for (let i = 0; i < rawVideoCandidates.length; i++) {
          const rawVid = rawVideoCandidates[i];
          if (rawVid && rawVid.startsWith('data:')) {
            try {
              const uploadResp = await axios.post(
                'https://kieai.redpandaai.co/api/file-base64-upload',
                {
                  base64Data: rawVid,
                  base64: rawVid,
                  file: rawVid,
                  uploadPath: 'kieai/market',
                  fileName: `kie_vid_${Date.now()}_${i}.mp4`,
                },
                {
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cleanToken}`,
                  },
                  timeout: 60000,
                }
              );
              const uData = uploadResp.data?.data || uploadResp.data;
              const uploadedUrl = uData?.fileUrl || uData?.url || uData?.downloadUrl || rawVid;
              finalVideoUrls.push(uploadedUrl);
            } catch (uErr: any) {
              console.warn('[Kie Video Base64 Upload Warning]:', uErr?.response?.data || uErr?.message);
              finalVideoUrls.push(rawVid);
            }
          } else if (rawVid && (rawVid.startsWith('http://') || rawVid.startsWith('https://'))) {
            finalVideoUrls.push(rawVid);
          }
        }
      }
      // Deduplicate final videos
      finalVideoUrls = Array.from(new Set(finalVideoUrls.filter(Boolean)));

      // Supported model names on Kie.ai
      let modelCandidates: string[] = [];

      if (isImageMode) {
        if (requestedModelLower.includes('seedream') || requestedModelLower.includes('sea')) {
          modelCandidates = [
            'bytedance/seedream-v4-edit',
            'bytedance/seedream-v4-text-to-image',
            finalImageUrl ? 'gpt-image-2-image-to-image' : 'gpt-image-2-text-to-image'
          ];
        } else if (finalImageUrl) {
          modelCandidates = ['gpt-image-2-image-to-image', 'bytedance/seedream-v4-edit', 'gpt-image-2-text-to-image'];
        } else {
          modelCandidates = ['gpt-image-2-text-to-image', 'bytedance/seedream-v4-edit'];
        }
      } else {
        if (requestedModelLower.includes('seedance')) {
          modelCandidates = ['bytedance/seedance-2-mini'];
        } else if (requestedModelLower.includes('1.5') || requestedModelLower.includes('preview')) {
          modelCandidates = finalImageUrl
            ? ['x-ai/grok-imagine-video-1.5-preview', 'grok-imagine/image-to-video', 'grok-imagine/video', 'grok-imagine/1-5-preview']
            : ['x-ai/grok-imagine-video-1.5-preview', 'grok-imagine/text-to-video', 'grok-imagine/video', 'grok-imagine/1-5-preview'];
        } else {
          modelCandidates = finalImageUrl
            ? ['grok-imagine/image-to-video', 'x-ai/grok-imagine-video-1.5-preview', 'grok-imagine/video', 'grok-imagine/1-5-preview']
            : ['grok-imagine/text-to-video', 'x-ai/grok-imagine-video-1.5-preview', 'grok-imagine/video', 'grok-imagine/1-5-preview'];
        }
      }

      let successResponseData: any = null;
      let lastErrMessage = '';

      for (const modelName of modelCandidates) {
        try {
          console.log(`[Kie.ai Generate ${isImageMode ? 'Image' : 'Video'}] Attempting createTask with model: "${modelName}"...`);
          
          let taskInput: any = {};

          if (isImageMode) {
            let imgRes = '1K';
            if (req.body.imageResolution) {
              if (req.body.imageResolution.includes('2K')) imgRes = '2K';
              else if (req.body.imageResolution.includes('4K')) imgRes = '4K';
            }
            taskInput = {
              prompt: prompt || 'High quality realistic image',
              aspect_ratio: ar,
              resolution: imgRes,
            };

            if (finalImageUrl) {
              const allUrls = finalImageUrls.length > 0 ? finalImageUrls : [finalImageUrl];
              taskInput.image_url = finalImageUrl;
              taskInput.image_urls = allUrls;
              taskInput.input_urls = allUrls;
              taskInput.image = finalImageUrl;
            }
          } else {
            const isSeedance = modelName.includes('seedance');
            if (isSeedance) {
              // ByteDance Seedance 2.0 Mini exact schema on Kie.ai (supports reference_image_urls and reference_video_urls)
              // Ensure duration is an integer strictly between 3 and 15 seconds (max 15s supported by Seedance 2.0 Mini)
              const safeSeedanceDur = Math.min(15, Math.max(3, Math.round(dur)));
              taskInput = {
                prompt: prompt || 'High quality realistic video',
                duration: safeSeedanceDur,
                aspect_ratio: ar,
                resolution: resolution,
                web_search: web_search !== undefined ? Boolean(web_search) : false,
                generate_audio: enableAudio !== undefined || generate_audio !== undefined
                  ? Boolean(enableAudio ?? generate_audio)
                  : true,
                nsfw_checker: nsfw_checker !== undefined ? Boolean(nsfw_checker) : true,
              };

              if (finalImageUrls.length > 0) {
                taskInput.reference_image_urls = finalImageUrls;
              }
              if (finalVideoUrls.length > 0) {
                taskInput.reference_video_urls = finalVideoUrls;
              }
            } else {
              // Grok or generic video models
              const allUrls = finalImageUrls.length > 0 ? finalImageUrls : (finalImageUrl ? [finalImageUrl] : []);
              taskInput = {
                prompt: prompt || 'High quality realistic video',
                duration: dur,
                aspect_ratio: ar,
                resolution: resolution,
                generate_audio: enableAudio !== undefined || generate_audio !== undefined
                  ? Boolean(enableAudio ?? generate_audio)
                  : true,
              };
              if (allUrls.length > 0) {
                taskInput.image_url = allUrls[0];
                taskInput.image_urls = allUrls;
                taskInput.input_urls = allUrls;
                taskInput.reference_image_urls = allUrls;
              }
              if (finalVideoUrls.length > 0) {
                taskInput.reference_video_urls = finalVideoUrls;
                taskInput.video_url = finalVideoUrls[0];
              }
            }
          }

          const taskPayload: any = {
            model: modelName,
            input: taskInput,
          };

          console.log(`[Kie.ai Payload Details] Model: ${modelName}, Input:`, JSON.stringify(taskInput));

          const resAttempt = await axios.post(
            'https://api.kie.ai/api/v1/jobs/createTask',
            taskPayload,
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cleanToken}`,
              },
              timeout: 25000,
            }
          );

          const resData = resAttempt.data || {};
          const msg = resData.msg || resData.message || '';
          console.log(`[Kie.ai Response] Code: ${resData.code}, Msg: "${msg}", Data:`, JSON.stringify(resData.data || {}));

          const isModelUnsupported =
            resData.code === 4004 ||
            (typeof msg === 'string' && msg.toLowerCase().includes('model name you specified is not supported'));

          if (isModelUnsupported) {
            console.warn(`[Kie.ai Generate] Model "${modelName}" is not supported by Kie.ai, trying next candidate...`);
            lastErrMessage = msg;
            continue;
          }

          if (resData.code !== undefined && resData.code !== 0 && resData.code !== 200) {
            console.warn(`[Kie.ai Generate Error Code ${resData.code}]:`, msg);
            lastErrMessage = msg || 'Gagal membuat task di Kie.ai';
            continue;
          }

          successResponseData = resData;
          console.log(`[Kie.ai Generate] Success with model "${modelName}"!`);
          break;
        } catch (attemptErr: any) {
          const errData = attemptErr?.response?.data;
          const msg = errData?.msg || errData?.message || attemptErr?.message || '';
          console.warn(`[Kie.ai Generate] Model "${modelName}" attempt failed with error:`, msg, errData || '');
          lastErrMessage = msg;

          if (typeof msg === 'string' && msg.toLowerCase().includes('model name')) {
            continue;
          } else {
            // Non-model error or timeout
            break;
          }
        }
      }

      if (!successResponseData) {
        return res.status(400).json({ error: lastErrMessage || 'Gagal membuat video di Kie.ai. Silakan periksa API Key dan opsi model.' });
      }

      const taskId = successResponseData.data?.taskId || successResponseData.taskId || successResponseData.data?.id || successResponseData.id;
      if (!taskId) {
        return res.status(500).json({ error: 'Kie.ai tidak mengembalikan Task ID.' });
      }

      return res.json({
        success: true,
        taskId: taskId,
        message: 'Task Kie.ai berhasil dibuat',
      });
    } catch (err: any) {
      console.error('[Kie.ai Generate Video Error]:', err?.response?.data || err?.message);
      return res.status(500).json({ error: err?.response?.data?.msg || err?.message || 'Gagal membuat video di Kie.ai.' });
    }
  });

  // Kie.ai Poll Status Endpoint
  app.post('/api/poll-kie-status', async (req, res) => {
    try {
      const { apiKey, taskId } = req.body;
      if (!apiKey || !taskId) {
        return res.status(400).json({ error: 'API Key dan Task ID wajib diisi.' });
      }

      let cleanToken = apiKey.trim();
      if (cleanToken.toLowerCase().startsWith('bearer ')) {
        cleanToken = cleanToken.slice(7).trim();
      }

      console.log(`[Kie.ai Poll] Checking status for taskId: ${taskId}...`);

      const response = await axios.get(
        `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
        {
          headers: {
            'Authorization': `Bearer ${cleanToken}`,
          },
          timeout: 15000,
        }
      );

      const resData = response.data || {};
      const dataObj = resData.data || resData;

      console.log(`[Kie.ai Poll Task ${taskId} FULL DATA]:`, JSON.stringify(dataObj, null, 2));

      const stateRaw = dataObj.state || dataObj.status || dataObj.taskStatus || '';
      const state = String(stateRaw).toLowerCase();

      // Extract creditsConsumed and remainingCredits from dataObj
      let creditsConsumed =
        typeof dataObj.creditsConsumed === 'number'
          ? dataObj.creditsConsumed
          : typeof dataObj.consumeCredits === 'number'
          ? dataObj.consumeCredits
          : typeof dataObj.creditConsumed === 'number'
          ? dataObj.creditConsumed
          : typeof dataObj.consumedCredits === 'number'
          ? dataObj.consumedCredits
          : 0;

      let remainingCredits =
        typeof dataObj.remainedCredits === 'number'
          ? dataObj.remainedCredits
          : typeof dataObj.remainingCredits === 'number'
          ? dataObj.remainingCredits
          : typeof dataObj.userRemainingCredits === 'number'
          ? dataObj.userRemainingCredits
          : undefined;

      let status: 'completed' | 'processing' | 'failed' = 'processing';
      let mediaUrl = '';
      let coverUrl = '';
      let errorMessage = '';

      // Recursive helper to find all HTTP/HTTPS URLs anywhere in object/string/json
      const findAllUrls = (obj: any, visited = new Set()): string[] => {
        if (!obj) return [];
        if (visited.has(obj)) return [];
        if (typeof obj === 'string') {
          const trimmed = obj.trim();
          if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return [trimmed];
          }
          if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
              const parsed = JSON.parse(trimmed);
              return findAllUrls(parsed, visited);
            } catch (_) {}
          }
          return [];
        }
        if (typeof obj === 'object') {
          visited.add(obj);
          const urls: string[] = [];
          if (Array.isArray(obj)) {
            for (const item of obj) {
              urls.push(...findAllUrls(item, visited));
            }
          } else {
            for (const key of Object.keys(obj)) {
              urls.push(...findAllUrls(obj[key], visited));
            }
          }
          return urls;
        }
        return [];
      };

      if (state === 'success' || state === 'completed' || state === 'done' || state === '2' || state === 'finish') {
        status = 'completed';

        // Extract input image/video URLs from param if exists to distinguish output
        let inputMediaUrls: string[] = [];
        if (dataObj.param) {
          inputMediaUrls = findAllUrls(dataObj.param);
        }

        // Get all URLs from resultJson, result, dataObj, etc.
        const resultJsonUrls = dataObj.resultJson ? findAllUrls(dataObj.resultJson) : [];
        const resultFieldUrls = dataObj.result ? findAllUrls(dataObj.result) : [];
        const allUrls = Array.from(new Set([...resultJsonUrls, ...resultFieldUrls, ...findAllUrls(dataObj)]));

        // Filter out input URLs
        const outputCandidateUrls = allUrls.filter(u => !inputMediaUrls.includes(u));

        // Pick best video/media candidate URL
        mediaUrl =
          outputCandidateUrls.find(u => u.includes('.mp4') || u.includes('.webm') || u.includes('/video/') || u.includes('/result/')) ||
          outputCandidateUrls[0] ||
          allUrls[0] ||
          '';

        coverUrl =
          dataObj.coverUrl ||
          dataObj.cover_url ||
          dataObj.thumbnailUrl ||
          '';

        console.log(`[Kie.ai Poll Task ${taskId} recordInfo] Extracted Media URL: "${mediaUrl}", creditsConsumed: ${creditsConsumed}`);
      } else if (state === 'fail' || state === 'failed' || state === 'error' || state === '3') {
        status = 'failed';
        errorMessage = dataObj.failReason || dataObj.msg || dataObj.error || dataObj.message || 'Generasi video Kie.ai gagal.';
        console.warn(`[Kie.ai Poll Task ${taskId} ❌ FAILED]:`, errorMessage);
      } else {
        console.log(`[Kie.ai Poll Task ${taskId} ⏳ PROCESSING...] Progress:`, dataObj.progress || 'N/A');
      }

      // If mediaUrl is still missing or status is not finished, fallback to checking pageRecordList
      if (!mediaUrl && status !== 'failed') {
        try {
          console.log(`[Kie.ai Poll Task ${taskId}] Attempting fallback check via pageRecordList...`);
          const pollUniqueId = crypto.createHash('md5').update(cleanToken).digest('hex');
          const historyRes = await axios.post(
            'https://api.kie.ai/api/v1/playground/pageRecordList',
            {
              pageNum: 1,
              pageSize: 20,
              beginTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
              endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
              successFlag: '',
            },
            {
              headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.9',
                'authorization': cleanToken,
                'content-type': 'application/json',
                'origin': 'https://kie.ai',
                'priority': 'u=1, i',
                'referer': 'https://kie.ai/',
                'sec-ch-ua': '"Not?A_Brand";v="24", "Chromium";v="152"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'uniqueid': pollUniqueId,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
              },
              timeout: 15000,
            }
          );

          const records = historyRes.data?.data?.records || [];
          const matchedRecord = records.find((r: any) => r.taskId === taskId || r.id === taskId);

          if (matchedRecord) {
            console.log(`[Kie.ai Poll Fallback Match Found for ${taskId}]: State = ${matchedRecord.state}`);
            const recState = String(matchedRecord.state || '').toLowerCase();
            if (recState === 'success' || recState === 'completed' || recState === 'done') {
              status = 'completed';
            }

            let parsedResultJson: any = matchedRecord.resultJson;
            if (typeof parsedResultJson === 'string') {
              try { parsedResultJson = JSON.parse(parsedResultJson); } catch (_) {}
            }

            const resultUrls = parsedResultJson?.data?.result_urls || parsedResultJson?.result_urls || [];
            if (Array.isArray(resultUrls) && resultUrls.length > 0) {
              mediaUrl = resultUrls[0];
            } else {
              const fallbackUrls = findAllUrls(matchedRecord.resultJson || matchedRecord);
              if (fallbackUrls.length > 0) {
                mediaUrl = fallbackUrls[0];
              }
            }

            if (creditsConsumed === 0 && typeof matchedRecord.consumeCredits === 'number') {
              creditsConsumed = matchedRecord.consumeCredits;
            }
            if (remainingCredits === undefined && typeof matchedRecord.remainedCredits === 'number') {
              remainingCredits = matchedRecord.remainedCredits;
            }

            console.log(`[Kie.ai Poll Fallback Result for ${taskId}]: mediaUrl = "${mediaUrl}", creditsConsumed: ${creditsConsumed}, remainingCredits: ${remainingCredits}`);
          }
        } catch (fallbackErr: any) {
          console.warn(`[Kie.ai Poll Fallback Error for ${taskId}]:`, fallbackErr?.message);
        }
      }

      // If task failed or completed, fetch live remaining balance from official credit API so UI immediately stays accurate
      if (status === 'failed' || status === 'completed') {
        if (status === 'failed') {
          creditsConsumed = 0;
        }
        try {
          const liveCredRes = await axios.get('https://api.kie.ai/api/v1/chat/credit', {
            headers: {
              'Authorization': `Bearer ${cleanToken}`,
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AMBMedia/1.0',
            },
            timeout: 5000,
            validateStatus: () => true,
          });
          if (liveCredRes.status === 200 && liveCredRes.data) {
            const val = typeof liveCredRes.data.data === 'number'
              ? liveCredRes.data.data
              : typeof liveCredRes.data.credit === 'number'
              ? liveCredRes.data.credit
              : typeof liveCredRes.data.credits === 'number'
              ? liveCredRes.data.credits
              : undefined;
            if (typeof val === 'number') {
              remainingCredits = val;
              console.log(`[Kie.ai Live Credit Sync on ${status}] Task ${taskId} -> Live Remaining Credits: ${remainingCredits}`);
            }
          }
        } catch (_) {}
      }

      return res.json({
        success: true,
        status,
        mediaUrl,
        coverUrl,
        errorMessage,
        progress: dataObj.progress || (status === 'completed' ? 100 : 50),
        creditsConsumed,
        remainingCredits,
      });
    } catch (err: any) {
      console.error('[Kie.ai Poll Status Error]:', err?.response?.data || err?.message);
      return res.status(500).json({ error: err?.message || 'Gagal memeriksa status task Kie.ai.' });
    }
  });

  // Kie.ai History Endpoint
  app.post('/api/kie/history', async (req, res) => {
    try {
      const { apiKey, accessToken, pageNum = 1, pageSize = 20, beginTime, endTime, successFlag = '' } = req.body || {};
      const key = (apiKey || accessToken || (typeof req.headers['authorization'] === 'string' ? req.headers['authorization'] : '') || '').trim();
      if (!key) {
        return res.status(400).json({ error: 'Kie API Key / Token diperlukan.' });
      }
      let cleanToken = key;
      if (cleanToken.toLowerCase().startsWith('bearer ')) {
        cleanToken = cleanToken.slice(7).trim();
      }

      const uniqueId = crypto.createHash('md5').update(cleanToken).digest('hex');

      // Default time range: past 90 days to 7 days in future
      const computedBeginTime = beginTime !== undefined && beginTime !== null ? Number(beginTime) : (Date.now() - 90 * 24 * 60 * 60 * 1000);
      const computedEndTime = endTime !== undefined && endTime !== null ? Number(endTime) : (Date.now() + 7 * 24 * 60 * 60 * 1000);

      const payload = {
        pageNum: Number(pageNum) || 1,
        pageSize: Number(pageSize) || 20,
        beginTime: computedBeginTime,
        endTime: computedEndTime,
        successFlag: typeof successFlag === 'string' ? successFlag : '',
      };

      let responseData: any = null;
      let lastErrMsg = '';

      for (const authHeaderValue of [cleanToken, `Bearer ${cleanToken}`]) {
        try {
          const resp = await axios.post(
            'https://api.kie.ai/api/v1/playground/pageRecordList',
            payload,
            {
              headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.9',
                'authorization': authHeaderValue,
                'content-type': 'application/json',
                'origin': 'https://kie.ai',
                'priority': 'u=1, i',
                'referer': 'https://kie.ai/',
                'sec-ch-ua': '"Not?A_Brand";v="24", "Chromium";v="152"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'uniqueid': uniqueId,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
              },
              timeout: 15000,
            }
          );
          if (resp.data && (resp.data.code === 200 || resp.data.code === 0)) {
            responseData = resp.data;
            break;
          } else {
            lastErrMsg = resp.data?.msg || resp.data?.message || 'Token tidak valid';
          }
        } catch (e: any) {
          lastErrMsg = e?.response?.data?.msg || e?.response?.data?.message || e?.message || '';
        }
      }

      if (!responseData) {
        return res.status(400).json({
          error: `Gagal mengambil histori Kie.ai (${lastErrMsg}). Pastikan Authorization Token Kie.ai Anda aktif.`,
        });
      }

      const records = responseData.data?.records || [];

      const formattedRecords = records.map((rec: any) => {
        let rJson: any = rec.resultJson;
        if (typeof rJson === 'string') {
          try { rJson = JSON.parse(rJson); } catch (_) {}
        }
        const resultUrls: string[] =
          rJson?.data?.result_urls ||
          rJson?.data?.resultUrls ||
          rJson?.result_urls ||
          rJson?.resultUrls ||
          [];

        let mediaUrl = resultUrls[0] || '';
        if (!mediaUrl && typeof rec.resultJson === 'string' && rec.resultJson.includes('http')) {
          const match = rec.resultJson.match(/https?:\/\/[^\s"']+\.(mp4|webm|mov|png|jpg|jpeg|webp)/i);
          if (match) mediaUrl = match[0];
        }

        let paramObj: any = rec.param;
        if (typeof paramObj === 'string') {
          try { paramObj = JSON.parse(paramObj); } catch (_) {}
        }
        let inputObj: any = paramObj?.input;
        if (typeof inputObj === 'string') {
          try { inputObj = JSON.parse(inputObj); } catch (_) {}
        }

        const prompt = inputObj?.prompt || paramObj?.prompt || '';
        const aspectRatio = inputObj?.aspect_ratio || inputObj?.aspectRatio || '9:16';
        const resolution = inputObj?.resolution || '720p';
        const duration = inputObj?.duration ? `${inputObj.duration}s` : '15s';
        const inputImageUrl =
          inputObj?.image_url ||
          inputObj?.input_image ||
          (Array.isArray(inputObj?.input_urls) ? inputObj.input_urls[0] : '') ||
          (Array.isArray(inputObj?.image_urls) ? inputObj.image_urls[0] : '');

        const rawModel = rec.model || paramObj?.model || rec.groupPath || '';
        const isVideo =
          rawModel.toLowerCase().includes('video') ||
          rawModel.toLowerCase().includes('grok') ||
          mediaUrl.endsWith('.mp4') ||
          mediaUrl.endsWith('.webm') ||
          mediaUrl.endsWith('.mov') ||
          mediaUrl.includes('/video/');

        const mode: 'video' | 'image' = isVideo ? 'video' : 'image';

        let friendlyModelName = rawModel;
        if (rawModel.includes('gpt-image-2') || rawModel.includes('gpt-image')) {
          friendlyModelName = rawModel.includes('image-to-image')
            ? 'GPT Image 2 (Image-to-Image)'
            : 'GPT Image 2 (Text-to-Image)';
        } else if (rawModel.includes('seedream')) {
          friendlyModelName = 'Seedream 4.0 Edit';
        } else if (rawModel.includes('grok')) {
          friendlyModelName = 'Grok Imagine 1.5 Preview';
        }

        const state = String(rec.state || '').toLowerCase();
        const status: 'completed' | 'processing' | 'failed' =
          state === 'success' || state === 'completed' || state === 'done'
            ? 'completed'
            : state === 'fail' || state === 'failed' || state === 'error'
            ? 'failed'
            : 'processing';

        return {
          taskId: rec.taskId,
          model: friendlyModelName,
          rawModel: rawModel,
          groupPath: rec.groupPath,
          mode,
          state: rec.state,
          status,
          mediaUrl,
          thumbnailUrl: mediaUrl,
          prompt,
          aspectRatio,
          resolution,
          duration,
          inputImageUrl,
          createTime: rec.createTime,
          completeTime: rec.completeTime,
          consumeCredits: rec.consumeCredits,
          remainedCredits: rec.remainedCredits,
          costTime: rec.costTime,
          failCode: rec.failCode,
          failMsg: rec.failMsg,
          rawResultJson: rec.resultJson,
          rawParam: rec.param,
        };
      });

      return res.json({
        success: true,
        records: formattedRecords,
        total: responseData.data?.total || formattedRecords.length,
        current: responseData.data?.current || 1,
        size: responseData.data?.size || formattedRecords.length,
        pages: responseData.data?.pages || 1,
      });
    } catch (err: any) {
      console.error('[Kie.ai History Error]:', err?.response?.data || err?.message);
      return res.status(500).json({ error: err?.message || 'Gagal mengambil riwayat dari Kie.ai' });
    }
  });

  // RoboNeo Upload Endpoint (Presigned Alibaba Cloud OSS)
  app.post('/api/roboneo/upload', (req, res, next) => {
    upload.single('file')(req as any, res as any, (err) => {
      next();
    });
  }, async (req, res) => {
    try {
      const authHeader = req.headers['access-token'] || req.headers['authorization'] || '';
      const { fileData, fileName: reqFileName, mimeType: reqMimeType, accessToken, token } = req.body || {};
      const cleanToken = (accessToken || token || (typeof authHeader === 'string' ? authHeader.replace(/^bearer /i, '') : '') || '').trim();
      
      if (!cleanToken) {
        return res.status(400).json({ error: 'Access token RoboNeo tidak ditemukan.' });
      }

      // If fileData is already a remote URL, return it directly
      if (typeof fileData === 'string' && (fileData.startsWith('http://') || fileData.startsWith('https://'))) {
        return res.json({ success: true, url: fileData });
      }

      let fileBuffer: Buffer | null = null;
      let fileName = req.file?.originalname || reqFileName || (req.file ? `upload_${Date.now()}` : 'upload_file.jpg');
      let mimeType = req.file?.mimetype || reqMimeType || 'image/jpeg';

      if (req.file) {
        fileBuffer = req.file.buffer;
      } else if (fileData) {
        const rawStr = String(fileData).trim();
        if (rawStr.includes(';base64,')) {
          const parts = rawStr.split(';base64,');
          const header = parts[0];
          const b64 = parts[1];
          if (header.startsWith('data:')) {
            mimeType = header.replace('data:', '');
          }
          fileBuffer = Buffer.from(b64, 'base64');
        } else {
          fileBuffer = Buffer.from(rawStr, 'base64');
        }
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: 'Data file tidak ditemukan atau kosong.' });
      }

      const parsed = parseRoboneoAccessToken(cleanToken);
      const clientId = '1189857647';

      // Determine extension/suffix
      let suffix = 'jpg';
      if (fileName && fileName.includes('.')) {
        suffix = fileName.split('.').pop()!.toLowerCase();
      } else if (mimeType) {
        if (mimeType.includes('png')) suffix = 'png';
        else if (mimeType.includes('jpg') || mimeType.includes('jpeg')) suffix = 'jpg';
        else if (mimeType.includes('mp4')) suffix = 'mp4';
        else if (mimeType.includes('webm')) suffix = 'webm';
      }

      console.log(`[RoboNeo Upload] Processing file "${fileName}" (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB, suffix: ${suffix})...`);

      // Step 1: Request Upload Policy & Signature from Meitu AI Engine Gateway
      let sig = '';
      let sigTime = Math.floor(Date.now() / 1000).toString();
      let sigVersion = '1.2';

      try {
        console.log(`[RoboNeo Upload] Step 1: Requesting uploadpolicy gateway for ${suffix}...`);
        const nowSec = Math.floor(Date.now() / 1000).toString();
        const gateRes = await axios.post(
          'https://ai-engine-gateway-roboneo.meitu.com/roboneo/sync/request/uploadpolicy',
          {
            parameter: {
              token: parsed.paramToken,
              gid: '19f996c0031244-0575967e02d0da8-26071951-1440000-19f996c00321656',
              uid: parsed.uid,
              trace_id: crypto.randomUUID(),
              client_id: clientId,
              app_scene: 'roboneo',
              area_code: 'ID',
              lang: 'en',
              time_zone: 'Asia/Jakarta',
              path_scene: 'uploadpolicy',
              upload_version: '2',
              app: 'RoboNeo',
              type: 'roboneo_private_web',
              count: 1,
              suffix: suffix,
              sig: '',
              sigTime: nowSec,
              sigVersion: '1.3',
              version: '2',
            },
          },
          {
            headers: {
              Accept: 'application/json, text/plain, */*',
              'Content-Type': 'application/json',
              Cookie: `__mt_web_access_token__=${cleanToken}; __mt_web_client_id__=${clientId}; __mt_web_login__=${parsed.uid}; __mt_uid__=${parsed.uid}`,
              Origin: 'https://www.roboneo.com',
              Referer: 'https://www.roboneo.com/',
              'access-token': cleanToken,
              'client-id': clientId,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
            },
            timeout: 15000,
          }
        );

        if (gateRes.data?.parameter?.sig) {
          sig = gateRes.data.parameter.sig;
          sigTime = gateRes.data.parameter.sigTime || nowSec;
          sigVersion = gateRes.data.parameter.sigVersion || '1.2';
          console.log(`[RoboNeo Upload] Step 1 Gateway signature obtained: sig=${sig}, sigTime=${sigTime}`);
        }
      } catch (gateErr: any) {
        console.warn(`[RoboNeo Upload] Gateway uploadpolicy warning: ${gateErr?.message}. Proceeding to strategy...`);
      }

      // Step 2: Request Upload Policy & STS Credentials from RoboNeo Strategy API
      console.log(`[RoboNeo Upload] Step 2: Requesting OSS strategy policy...`);
      let policyUrl = `https://strategy.app.meitudata.com/upload/policy?app=RoboNeo&count=1&suffix=${suffix}&type=roboneo_private_web&version=2`;
      if (sig) {
        policyUrl += `&sig=${encodeURIComponent(sig)}&sigTime=${encodeURIComponent(sigTime)}&sigVersion=${encodeURIComponent(sigVersion)}`;
      }

      const policyRes = await axios.get(policyUrl, {
        headers: {
          Accept: '*/*',
          Cookie: `__mt_web_access_token__=${cleanToken}; __mt_web_client_id__=${clientId}; __mt_web_login__=${parsed.uid}; __mt_uid__=${parsed.uid}`,
          Origin: 'https://www.roboneo.com',
          Referer: 'https://www.roboneo.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
          'access-token': cleanToken,
          'client-id': clientId,
        },
        timeout: 15000,
      });

      const policyData = policyRes.data || {};
      const policyList = Array.isArray(policyData) ? policyData : (policyData.data || policyData.result || [policyData]);
      const policyItem = policyList[0] || {};
      const ossObj = policyItem.oss || policyItem;
      const credentials = ossObj.credentials || policyItem.credentials || {};
      const accessUrl = ossObj.access_url || policyItem.access_url || '';

      const bucket = ossObj.bucket || policyItem.bucket || 'mt-roboneo-private-release';
      const region = ossObj.region || policyItem.region || 'oss-cn-beijing';
      const rawEndpoint = ossObj.endpoint || policyItem.endpoint || `${region}.aliyuncs.com`;
      const cleanEndpoint = rawEndpoint.replace(/^https?:\/\//, '');

      const objectKey = policyItem.key || ossObj.key || (accessUrl ? new URL(accessUrl).pathname.replace(/^\//, '') : '');
      if (!objectKey) {
        throw new Error('Gagal mengisolasi object key dari respon upload policy RoboNeo.');
      }

      // Prioritize accessUrl as it contains the required Meitu CDN token (?k=...&t=...)
      const finalCdnUrl = accessUrl || ossObj.data || `https://roboneo-private.meitudata.com/${objectKey}`;

      console.log(`[RoboNeo Upload] Upload policy success! Key: ${objectKey}, Bucket: ${bucket}, Endpoint: ${cleanEndpoint}, Final URL: ${finalCdnUrl}`);

      // Step 3: Transfer File Binary ke Alibaba Cloud OSS
      const contentType = mimeType || (suffix === 'mp4' ? 'video/mp4' : (suffix === 'jpg' || suffix === 'jpeg' ? 'image/jpeg' : 'image/png'));

      let uploadSuccess = false;

      // Method A: ali-oss SDK using STS Credentials & real OSS Endpoint
      if (credentials.access_key && credentials.secret_key && credentials.session_token) {
        try {
          console.log(`[RoboNeo Upload] Method A: Uploading via ali-oss SDK to https://${bucket}.${cleanEndpoint}/${objectKey} (size: ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB)...`);
          const OSS = (await import('ali-oss')).default;
          const ossClient = new OSS({
            region: region,
            endpoint: `https://${cleanEndpoint}`,
            accessKeyId: credentials.access_key,
            accessKeySecret: credentials.secret_key,
            stsToken: credentials.session_token,
            bucket: bucket,
            secure: true,
            timeout: 600000, // 10 menit timeout
          });

          // Gunakan multipartUpload untuk file > 5MB atau file video MP4 agar tidak timeout
          if (fileBuffer.length > 5 * 1024 * 1024 || suffix === 'mp4') {
            console.log(`[RoboNeo Upload] Using multipartUpload for video/large file...`);
            await ossClient.multipartUpload(objectKey, fileBuffer, {
              headers: { 'Content-Type': contentType },
              timeout: 600000,
            });
          } else {
            await ossClient.put(objectKey, fileBuffer, {
              headers: { 'Content-Type': contentType },
              timeout: 600000,
            });
          }

          console.log(`[RoboNeo Upload] Method A ali-oss SDK upload succeeded!`);
          uploadSuccess = true;
        } catch (sdkErr: any) {
          console.warn(`[RoboNeo Upload] Method A ali-oss SDK failed: ${sdkErr?.message}. Trying fallback put...`);
          try {
            const OSS = (await import('ali-oss')).default;
            const ossClient = new OSS({
              region: region,
              endpoint: `https://${cleanEndpoint}`,
              accessKeyId: credentials.access_key,
              accessKeySecret: credentials.secret_key,
              stsToken: credentials.session_token,
              bucket: bucket,
              secure: true,
              timeout: 600000,
            });
            await ossClient.put(objectKey, fileBuffer, {
              headers: { 'Content-Type': contentType },
              timeout: 600000,
            });
            console.log(`[RoboNeo Upload] Method A fallback put succeeded!`);
            uploadSuccess = true;
          } catch (retryErr: any) {
            console.warn(`[RoboNeo Upload] Method A retry put failed: ${retryErr?.message}. Trying Method B...`, retryErr);
          }
        }
      }

      // Method B: Fallback Direct HTTP PUT to OSS Bucket URL
      if (!uploadSuccess) {
        try {
          const directOssUrl = `https://${bucket}.${cleanEndpoint}/${objectKey}`;
          console.log(`[RoboNeo Upload] Method B: Direct PUTting file (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB) to ${directOssUrl}...`);
          const putHeaders: Record<string, string> = {
            'Content-Type': contentType,
          };
          if (credentials.session_token) {
            putHeaders['x-oss-security-token'] = credentials.session_token;
          }

          await axios.put(directOssUrl, fileBuffer, {
            headers: putHeaders,
            timeout: 120000,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          });
          console.log(`[RoboNeo Upload] Method B direct PUT succeeded!`);
          uploadSuccess = true;
        } catch (putErr: any) {
          console.error(`[RoboNeo Upload] Method B direct PUT failed: ${putErr?.message}`);
          
          // Method C: Fallback PUT to presigned access_url
          if (accessUrl) {
            try {
              console.log(`[RoboNeo Upload] Method C: PUTting to presigned accessUrl...`);
              await axios.put(accessUrl, fileBuffer, {
                headers: { 'Content-Type': contentType },
                timeout: 120000,
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
              });
              console.log(`[RoboNeo Upload] Method C succeeded!`);
              uploadSuccess = true;
            } catch (cErr: any) {
              console.error(`[RoboNeo Upload] Method C failed: ${cErr?.message}`);
              throw putErr;
            }
          } else {
            throw putErr;
          }
        }
      }

      console.log(`[RoboNeo Upload] Upload completed successfully! Final CDN URL: ${finalCdnUrl}`);

      return res.json({
        success: true,
        url: finalCdnUrl,
        key: objectKey,
      });
    } catch (err: any) {
      console.error('[RoboNeo Upload Error]:', err?.response?.data || err?.message);
      return res.status(500).json({ error: cleanErrorMessage(err) || 'Gagal mengunggah file ke RoboNeo OSS.' });
    }
  });

  // RoboNeo Kling 2.6 Motion Control Generation Endpoint
  app.post('/api/generate-roboneo', async (req, res) => {
    try {
      const { accessToken, token, imageUrl, motionVideoUrl, prompt } = req.body || {};
      const cleanToken = (accessToken || token || '').trim();
      if (!cleanToken) {
        return res.status(400).json({ error: 'Access token RoboNeo tidak ditemukan.' });
      }
      if (!imageUrl || !motionVideoUrl) {
        return res.status(400).json({ error: 'Gambar referensi dan Video Motion Control wajib diunggah untuk Kling Motion Control.' });
      }

      const parsed = parseRoboneoAccessToken(cleanToken);
      const clientId = '1189857647';
      const gid = '19f996c0031244-0575967e02d0da8-26071951-1440000-19f996c00321656';
      const traceId = `trace-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      // 1. Resolve Real User UID
      let realUid = parsed.uid || '1289198712';
      try {
        const profRes = await axios.get(
          'https://api.account.meitu.com/users/show_current?client_id=1189857647&client_language=en&overseas=1&client_type=2&web_version=4.9.0&zip_version=4.76000&is_web=1&client_accept_cookies=1&country_code=ID&with_member_info=1&with_watsons_member=1',
          {
            headers: {
              'Accept': '*/*',
              'Access-Token': cleanToken,
              'Cookie': `__mt_web_access_token__=${cleanToken}; __mt_web_client_id__=${clientId}; __mt_web_login__=${realUid}; __mt_uid__=${realUid}`,
              'Origin': 'https://www.roboneo.com',
              'Referer': 'https://www.roboneo.com/',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
            },
            timeout: 6000,
          }
        );
        const uId = profRes.data?.response?.user?.id || profRes.data?.user?.id;
        if (uId) realUid = String(uId);
      } catch (e: any) {
        console.warn('[Server RoboNeo] Profile uid resolve notice:', e.message);
      }

      const base64Uid = Buffer.from(realUid).toString('base64');
      const cookieStr = `__mt_web_access_token__=${cleanToken}; __mt_web_client_id__=${clientId}; __mt_web_login__=${realUid}; __mt_uid__=${realUid}`;

      // 2. Create/Verify Room Canvas Workspace
      let roomId = `${base64Uid}-b91cfdd75f614fe98acb673cf28a9dff-${Date.now()}`;
      try {
        const roomRes = await axios.post(
          'https://agent-api-roboneo.meitu.com/api/room/create',
          {
            token: parsed.paramToken,
            gid,
            uid: realUid,
            trace_id: traceId,
            client_id: clientId,
            app_scene: 'roboneo',
            area_code: 'ID',
            lang: 'en',
            time_zone: 'Asia/Jakarta',
            room_type: 5,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Cookie': cookieStr,
              'Origin': 'https://www.roboneo.com',
              'Referer': 'https://www.roboneo.com/',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
              'access-token': cleanToken,
              'client-id': clientId,
            },
            timeout: 10000,
          }
        );
        if (roomRes.data?.code === 0 && roomRes.data?.result?.room_id) {
          roomId = roomRes.data.result.room_id;
        }
      } catch (e: any) {
        console.warn('[Server RoboNeo] Create room notice, using generated room ID:', e.message);
      }

      // 3. Node Execute for Kling 2.6 Motion Control (Matching Official Web Pattern)
      let promptText = (prompt || '').trim();
      if (!promptText || promptText.toLowerCase().includes('in the reference video')) {
        promptText = 'Refer to the movements and facial expressions in @video1 to animate photos without changing the original background.';
      }

      const executeNodeOnce = async (attemptNodeId: string) => {
        const attemptGroupId = crypto.randomUUID();
        const attemptRandom = `${Date.now()}-${Math.floor(Math.random() * 90000000 + 10000000)}`;
        const attemptTraceId = crypto.randomUUID();

        const payload = {
          parameter: {
            token: parsed.paramToken,
            gid,
            uid: realUid,
            trace_id: attemptTraceId,
            client_id: clientId,
            app_scene: 'roboneo',
            area_code: 'ID',
            lang: 'en',
            time_zone: 'Asia/Jakarta',
            tt_ttclid: '',
            tt_ttp: '',
            first_url: 'https://www.roboneo.com/home',
            page_url: `https://www.roboneo.com/team_studio?room_id=${roomId}`,
            referrer: 'https://www.roboneo.com/home',
            pixel_ready: 1,
            extra: {
              snapshot: {
                group_id: '',
                group_type: 'normal',
                tool_type: 'model',
                node_type: 'VIDEO_NODE',
                node_texts: [promptText],
                input_texts: [],
                material_list: '',
                asset_list: '',
              },
              big_data_patch: {
                position_type: '/team_studio',
              },
            },
            path_scene: 'nodeexecute',
            need_node_name: true,
            room_id: roomId,
            node_id: attemptNodeId,
            group_id: attemptGroupId,
            node_list_array: [
              [
                {
                  name: 'video_bonbon_motioncontrol_v26',
                  tool_abstract_name: {
                    cn: 'Video 1 Kling 2.6 Motion Control',
                    en: '',
                  },
                  node_id: attemptNodeId,
                  parameters: {
                    count: 1,
                    prompt: promptText,
                    quality: 'std',
                    image_url: imageUrl,
                    video_url: motionVideoUrl,
                    random: attemptRandom,
                  },
                  pre_tools: [],
                },
              ],
            ],
            workflow_version: 'v2',
            task_speed: '1x',
          },
        };

        console.log(`[RoboNeo Generate] Triggering nodeexecute for room ${roomId}, node ${attemptNodeId}...`);

        return await axios.post(
          'https://ai-engine-gateway-roboneo.meitu.com/roboneo/sync/request/nodeexecute',
          payload,
          {
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Content-Type': 'application/json',
              'Cookie': cookieStr,
              'Origin': 'https://www.roboneo.com',
              'Referer': 'https://www.roboneo.com/',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
              'access-token': cleanToken,
              'client-id': clientId,
            },
            timeout: 25000,
          }
        );
      };

      let currentNodeId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      let execRes = await executeNodeOnce(currentNodeId);

      // Auto-retry once if system is transiently busy (error code 6003)
      if (execRes.data?.error_code === 6003) {
        console.warn(`[RoboNeo Generate] System busy (6003) on node ${currentNodeId}, retrying with fresh node in 1.2s...`);
        await new Promise((resolve) => setTimeout(resolve, 1200));
        currentNodeId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        execRes = await executeNodeOnce(currentNodeId);
      }

      if (!execRes.data?.error_code && (!execRes.data?.code || execRes.data?.code === 0)) {
        console.log(`[RoboNeo Generate] Node execute success on node ${currentNodeId}`);
      }

      if (execRes.data?.error_code || (execRes.data?.code !== undefined && execRes.data?.code !== 0)) {
        const errCode = execRes.data?.error_code || execRes.data?.code;
        const errMsg = execRes.data?.error_msg || execRes.data?.message || `Error code ${errCode}`;
        console.error('[Server ❌ RoboNeo Node Execute Error]:', execRes.data);
        
        let userFriendlyErr = `RoboNeo Server Error (${errCode}): ${errMsg}`;
        if (errCode === 98 || (errMsg && errMsg.toLowerCase().includes('token error'))) {
          userFriendlyErr = `Token Access RoboNeo Anda telah kadaluarsa / tidak valid (${errCode}: ${errMsg}). Silakan ambil Access Token RoboNeo yang baru dari browser dan perbarui di Settings.`;
        } else if (errMsg.includes('余额不足') || errMsg.includes('no charge') || errMsg.includes('CHARGE_FAILED')) {
          userFriendlyErr = 'Saldo Carrot / Kuota Akun RoboNeo Anda tidak mencukupi (Akun Kehabisan Kredit). Silakan ganti akun atau top up di RoboNeo.';
        } else if (errCode === 6003) {
          userFriendlyErr = `Sistem RoboNeo sedang sibuk (${errCode}: ${errMsg}). Silakan coba beberapa saat lagi.`;
        }

        return res.status(400).json({
          success: false,
          error: userFriendlyErr,
          errorCode: errCode,
          errorMsg: errMsg,
          rawResponse: execRes.data,
        });
      }

      const tasksList = execRes.data?.parameter?.tasks || execRes.data?.result?.tasks;
      const taskId = (Array.isArray(tasksList) && tasksList[0]?.task_id)
        || execRes.data?.parameter?.tasks?.[0]?.task_id
        || execRes.data?.result?.task_id
        || execRes.data?.data?.task_id
        || execRes.data?.task_id
        || currentNodeId;

      return res.json({
        success: true,
        status: 'processing',
        recipeId: roomId,
        nodeId: currentNodeId,
        taskId: taskId,
        message: 'Task generasi Kling Motion Control berhasil dibuat di RoboNeo.',
      });
    } catch (err: any) {
      console.error('[Server ❌ Generate RoboNeo Error]:', err?.response?.data || err?.message);
      if (err?.response?.data) {
        const respData = err.response.data;
        const errCode = respData?.error_code || respData?.code || err.response?.status;
        const errMsg = respData?.error_msg || respData?.message || cleanErrorMessage(err);
        return res.status(400).json({
          success: false,
          error: `RoboNeo Server Response (${errCode}): ${errMsg}`,
          errorCode: errCode,
          errorMsg: errMsg,
          rawResponse: respData,
        });
      }
      return res.status(500).json({ success: false, error: cleanErrorMessage(err) });
    }
  });

  // RoboNeo Task Polling Endpoint
  app.post('/api/poll-roboneo-status', async (req, res) => {
    try {
      const { accessToken, token, taskId, recipeId: roomId } = req.body || {};
      const cleanToken = (accessToken || token || '').trim();
      if (!cleanToken || !taskId) {
        return res.status(400).json({ error: 'AccessToken dan taskId wajib ada.' });
      }

      const parsed = parseRoboneoAccessToken(cleanToken);
      const clientId = '1189857647';
      const gid = '19f996c0031244-0575967e02d0da8-26071951-1440000-19f996c00321656';
      const cookieStr = `__mt_web_access_token__=${cleanToken}; __mt_web_client_id__=${clientId}; __mt_web_login__=${parsed.uid}; __mt_uid__=${parsed.uid}`;

      // 1. Query task status via nodeexecutequery (Matching Official Payload Format)
      const queryUrl = 'https://ai-engine-gateway-roboneo.meitu.com/roboneo/sync/request/nodeexecutequery';
      let isCompleted = false;
      let isFailed = false;
      let taskData: any = null;

      try {
        const queryRes = await axios.post(
          queryUrl,
          {
            parameter: {
              token: parsed.paramToken,
              gid,
              uid: parsed.uid,
              trace_id: crypto.randomUUID(),
              client_id: clientId,
              app_scene: 'roboneo',
              area_code: 'ID',
              lang: 'en',
              time_zone: 'Asia/Jakarta',
              path_scene: 'nodeexecutequery',
              room_id: roomId || `MTI4OTE5ODcxMg-b91cfdd75f614fe98acb673cf28a9dff-17886945775479`,
              task_ids: [taskId],
            },
          },
          {
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Content-Type': 'application/json',
              'Cookie': cookieStr,
              'Origin': 'https://www.roboneo.com',
              'Referer': 'https://www.roboneo.com/',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
              'access-token': cleanToken,
              'client-id': clientId,
            },
            timeout: 12000,
          }
        );

        if (queryRes.data?.error_code || (queryRes.data?.code !== undefined && queryRes.data?.code !== 0)) {
          const errCode = queryRes.data?.error_code || queryRes.data?.code;
          const errMsg = queryRes.data?.error_msg || queryRes.data?.message || `Error code ${errCode}`;
          console.error('[Server ❌ Poll RoboNeo Error Response]:', queryRes.data);

          let userFriendlyErr = `RoboNeo Server Error (${errCode}): ${errMsg}`;
          if (errCode === 98 || (errMsg && errMsg.toLowerCase().includes('token error'))) {
            userFriendlyErr = `Token Access RoboNeo kadaluarsa (${errCode}: ${errMsg}). Silakan perbarui Access Token di Settings.`;
          } else if (errCode === 6003) {
            userFriendlyErr = `Sistem RoboNeo sedang sibuk (${errCode}: ${errMsg}). Silakan coba beberapa saat lagi.`;
          }

          return res.json({
            status: 'failed',
            error: userFriendlyErr,
            errorCode: errCode,
            errorMsg: errMsg,
            rawResponse: queryRes.data,
          });
        }

        const taskMap = queryRes.data?.parameter?.task_map || queryRes.data?.parameter?.tasks || queryRes.data?.result?.task_map || queryRes.data?.result?.tasks;
        taskData = taskMap?.[taskId] || (taskMap ? Object.values(taskMap)[0] : null) || queryRes.data?.data?.[0];

        if (taskData) {
          const rawStatus = (taskData.status || taskData.state || taskData.task_status || '').toUpperCase();
          console.log(`[RoboNeo Poll] Task ${taskId} status: ${rawStatus || 'RUNNING'}`);
          const isSuccess = rawStatus === 'SUCCESS' || rawStatus === 'FINISHED' || rawStatus === 'FINISH' || rawStatus === '2';
          const isFailed = rawStatus === 'FAILED' || rawStatus === 'FAIL' || rawStatus === '3' || rawStatus === 'ERROR';

          // Extract direct video URL from all possible fields returned by RoboNeo
          const directVideoUrl = taskData.initial_transferred_urls?.[0]
            || taskData.steps?.[0]?.derived_image_url
            || taskData.last_image_urls?.[0]
            || taskData.last_image_url
            || taskData.result_url
            || taskData.video_url
            || taskData.media_url
            || taskData.output_url
            || taskData.outputs?.[0]?.url;

          const coverUrl = taskData.initial_transferred_cover_urls?.[0]
            || taskData.last_image_cover_urls?.[0]
            || taskData.cover_url
            || directVideoUrl;

          if (directVideoUrl && typeof directVideoUrl === 'string' && (directVideoUrl.includes('.mp4') || isSuccess)) {
            return res.json({
              status: 'completed',
              resultUrl: directVideoUrl,
              coverUrl: coverUrl || directVideoUrl,
            });
          }

          if (isFailed) {
            const rawErrMsg = taskData.error_message
              || taskData.steps?.[0]?.error_message
              || taskData.steps?.[0]?.user_show_info?.error_message
              || taskData.steps?.[0]?.error
              || 'Generasi gagal di RoboNeo.';

            let friendlyErrMsg = rawErrMsg;
            if (rawErrMsg.includes('余额不足') || rawErrMsg.includes('no charge') || rawErrMsg.includes('CHARGE_FAILED')) {
              friendlyErrMsg = 'Saldo Carrot / Kuota Akun RoboNeo Anda tidak mencukupi (Akun Kehabisan Kredit).';
            }

            return res.json({
              status: 'failed',
              error: friendlyErrMsg,
              rawError: rawErrMsg,
            });
          }

          if (isSuccess) {
            isCompleted = true;
          }
        }
      } catch (e: any) {
        console.warn('[Server RoboNeo] Query task warning:', e.message);
      }

      // 2. Fallback: Fetch video result from canvas room if marked completed or processing
      if (isCompleted || roomId) {
        try {
          const canvasUrl = `https://webapi.roboneo.com/v3/canvas/data/get.json?client_id=${clientId}&room_id=${roomId || ''}`;
          const canvasRes = await axios.get(canvasUrl, {
            headers: {
              'Access-Token': cleanToken,
              'Authorization': `Bearer ${cleanToken}`,
              'Cookie': cookieStr,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            timeout: 10000,
          });

          if (canvasRes.data?.data?.data) {
            const parsedCanvas = JSON.parse(canvasRes.data.data.data);
            const nodes = parsedCanvas.nodes || [];
            for (const node of nodes) {
              const mediaList = node.data?.media_list || node.data?.mediaList || [];
              for (const item of mediaList) {
                const vUrl = item.url || item.video_url || item.compress_url;
                if (vUrl && typeof vUrl === 'string' && (vUrl.includes('.mp4') || vUrl.includes('meitudata.com'))) {
                  return res.json({
                    status: 'completed',
                    resultUrl: vUrl,
                    coverUrl: item.cover_url || item.thumb || vUrl,
                  });
                }
              }
              if (node.data?.url || node.data?.video_url) {
                const vUrl = node.data.url || node.data.video_url;
                if (typeof vUrl === 'string' && (vUrl.includes('.mp4') || vUrl.includes('meitudata.com'))) {
                  return res.json({
                    status: 'completed',
                    resultUrl: vUrl,
                    coverUrl: node.data.cover_url || vUrl,
                  });
                }
              }
            }
          }
        } catch (e: any) {
          console.warn('[Server RoboNeo] Canvas fetch warning:', e.message);
        }
      }

      if (isCompleted) {
        return res.json({ status: 'completed', message: 'Task selesai diproses.' });
      }

      const progressVal = taskData?.progress !== undefined
        ? Math.round(Number(taskData.progress) * (Number(taskData.progress) <= 1 ? 100 : 1))
        : 50;

      return res.json({ status: 'processing', progress: progressVal });
    } catch (err: any) {
      return res.status(500).json({ error: cleanErrorMessage(err) });
    }
  });

  // RoboNeo History Endpoint
  app.post('/api/fetch-roboneo-history', async (req, res) => {
    try {
      const { accessToken, token } = req.body || {};
      const cleanToken = (accessToken || token || '').trim();
      if (!cleanToken) {
        return res.status(400).json({ error: 'AccessToken RoboNeo wajib diisi.' });
      }

      const parsed = parseRoboneoAccessToken(cleanToken);
      const clientId = '1189857647';
      const gid = '19f930c797b239b-0a9543438884ee-26071951-1440000-19f930c797c1e80';

      const url = 'https://agent-api-roboneo.meitu.com/api/history/list';
      const cookieStr = `__mt_web_access_token__=${cleanToken}; __mt_web_client_id__=${clientId}; __mt_web_login__=${parsed.uid}; __mt_uid__=${parsed.uid}`;

      const historyRes = await axios.post(
        url,
        {
          token: parsed.paramToken,
          gid: gid,
          uid: parsed.uid,
          client_id: clientId,
          app_scene: 'roboneo',
          pn: 1,
          rn: 20,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieStr,
            'Origin': 'https://www.roboneo.com',
            'Referer': 'https://www.roboneo.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'access-token': cleanToken,
            'client-id': clientId,
          },
          timeout: 12000,
        }
      );

      if (historyRes.data?.code === 0 && historyRes.data?.result) {
        const result = historyRes.data.result;
        const rawList = [...(result.creation_list || []), ...(result.list || [])];

        const items = rawList.map((item: any, idx: number) => {
          const mediaUrl = item.video_url || item.url || item.result_url || '';
          const promptText = item.prompt || 'Kling Motion Control';
          return {
            id: item.task_id || item.id || `roboneo_hist_${Date.now()}_${idx}`,
            mode: 'video',
            title: promptText.length > 28 ? `${promptText.slice(0, 28)}...` : promptText,
            prompt: promptText,
            createdAt: 'RoboNeo',
            timestamp: new Date(item.create_time || item.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
            aspectRatio: '9:16 (Vertical)',
            resolution: '720p',
            duration: '00:15',
            model: 'Kling 3.0 Pro Motion Control',
            thumbnailUrl: item.cover_url || item.thumb || mediaUrl,
            mediaUrl: mediaUrl,
            status: 'completed',
          };
        });

        return res.json({ success: true, count: items.length, items });
      } else {
        return res.json({ success: true, count: 0, items: [] });
      }
    } catch (err: any) {
      return res.status(500).json({ error: cleanErrorMessage(err) });
    }
  });

  // Serve static / Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            '**/server/data/**',
            '**/data/**',
            '**/media-cache/**',
            '**/.playwright-browsers/**',
            '**/tmp/**',
            '**/*.json',
            '**/*.txt',
            '**/logs/**',
            '**/script-gemini/**',
            '**/script-weavy/**',
            '**/scripts/**',
            '**/ektension-*/**',
            '**/Extension-*/**',
          ],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] App running on http://localhost:${PORT}`);
  });
}

startServer();
