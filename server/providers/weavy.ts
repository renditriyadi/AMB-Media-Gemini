import { Router } from 'express';
import axios from 'axios';
import { getFreshIdToken, cleanErrorMessage, getWeavyHeaders, extractMediaUrlFromObject, getWeavyUserCredits, FIREBASE_API_KEY } from '../utils/helpers';

const router = Router();

// Verify & Refresh Single / Token Account for Weavy AI
router.post(['/weavy/accounts/verify', '/weavy/account/verify', '/verify-weavy-account'], async (req, res) => {
  try {
    const { refreshToken, accessToken, token } = req.body || {};
    const inputToken = (refreshToken || accessToken || token || '').trim();

    if (!inputToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token atau Access token Weavy wajib diisi.',
      });
    }

    let idToken = '';
    let newRefreshToken = inputToken;
    let expiresIn = 3600;

    // 1. Refresh token via Firebase Auth
    try {
      const fbResp = await axios.post(
        `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: inputToken,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 12000,
        }
      );

      if (fbResp.data?.id_token) {
        idToken = fbResp.data.id_token;
        newRefreshToken = fbResp.data.refresh_token || inputToken;
        expiresIn = Number(fbResp.data.expires_in || 3600);
      }
    } catch (fbErr: any) {
      // If input was already an idToken (JWT), use it directly
      if (inputToken.split('.').length === 3) {
        idToken = inputToken;
      } else {
        const msg = fbErr?.response?.data?.error?.message || fbErr?.message || 'Token Firebase tidak valid atau kedaluwarsa.';
        return res.status(400).json({ success: false, error: `Firebase Auth: ${msg}` });
      }
    }

    if (!idToken) {
      return res.status(400).json({ success: false, error: 'Gagal menukar refresh token Weavy.' });
    }

    // Parse JWT Payload
    let jwtPayload: any = {};
    try {
      const base64Url = idToken.split('.')[1];
      if (base64Url) {
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonStr = Buffer.from(base64, 'base64').toString('utf8');
        jwtPayload = JSON.parse(jsonStr);
      }
    } catch (e) {}

    // 2. Fetch User Profile from Weavy API
    const weavyHeaders = getWeavyHeaders(idToken);
    let userInfo: any = null;

    try {
      const userResp = await axios.get('https://api.weavy.ai/api/v1/users', {
        headers: weavyHeaders,
        timeout: 10000,
      });
      userInfo = userResp.data;
    } catch (e: any) {
      try {
        const altResp = await axios.get('https://api.weavy.ai/users', {
          headers: weavyHeaders,
          timeout: 10000,
        });
        userInfo = altResp.data;
      } catch (e2) {}
    }

    // 3. Extract Credits, Name, Email
    let credits = 0;
    if (userInfo?.credits !== undefined && userInfo?.credits !== null) {
      credits = Number(userInfo.credits);
    } else if (userInfo?.balance !== undefined && userInfo?.balance !== null) {
      credits = Number(userInfo.balance);
    } else if (userInfo?.quota !== undefined && userInfo?.quota !== null) {
      credits = Number(userInfo.quota);
    } else if (userInfo?.credit !== undefined && userInfo?.credit !== null) {
      credits = Number(userInfo.credit);
    }

    let totalCredits = 150;
    if (userInfo?.total !== undefined && userInfo?.total !== null) {
      totalCredits = Number(userInfo.total);
    } else if (userInfo?.totalCredits !== undefined && userInfo?.totalCredits !== null) {
      totalCredits = Number(userInfo.totalCredits);
    } else if (userInfo?.limit !== undefined && userInfo?.limit !== null) {
      totalCredits = Number(userInfo.limit);
    }

    if (credits > 0 && (!totalCredits || totalCredits === 0)) {
      totalCredits = 150;
    }

    let email = jwtPayload.email || userInfo?.email || userInfo?.username || '';
    if (!email) {
      if (jwtPayload.user_id) {
        email = `user_${jwtPayload.user_id.substring(0, 8)}@weavy.ai`;
      } else {
        email = 'user@weavy.ai';
      }
    }

    const name = jwtPayload.name || userInfo?.name || userInfo?.displayName || (email ? email.split('@')[0] : 'Weavy User');

    return res.json({
      success: true,
      email,
      name,
      displayName: name,
      credits: isNaN(credits) ? 0 : credits,
      totalCredits: isNaN(totalCredits) ? 150 : totalCredits,
      idToken,
      refreshToken: newRefreshToken,
      expiresInSeconds: expiresIn,
    });
  } catch (err: any) {
    console.error('[Weavy Account Verify Error]:', err?.message);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Gagal memverifikasi akun Weavy.',
    });
  }
});

// Poll Task Status Endpoint (Multi-Strategy Robust Poller for Weavy AI)
router.post('/poll-weavy-status', async (req, res) => {
  try {
    const { refreshToken, idToken: providedIdToken, recipeId, nodeId, taskId, batchId } = req.body;

    if (!recipeId) {
      return res.status(400).json({ error: 'recipeId wajib diisi.' });
    }

    const activeBatchId = taskId || batchId;
    console.log(`[Server ⏳ Polling Status] recipeId: ${recipeId}, nodeId: ${nodeId}, batchId/taskId: ${activeBatchId}`);

    let idToken = providedIdToken;
    if (refreshToken) {
      try {
        idToken = await getFreshIdToken(refreshToken);
      } catch (authErr) {
        // ignore
      }
    }

    const headers = getWeavyHeaders(idToken);
    let extractedCredits: number | undefined = undefined;

    const getCreditFields = async () => {
      if (extractedCredits === undefined && idToken) {
        try {
          const userCredits = await getWeavyUserCredits(idToken);
          if (typeof userCredits === 'number') {
            extractedCredits = userCredits;
          }
        } catch (e) {}
      }
      return extractedCredits !== undefined
        ? {
            remainingCredits: extractedCredits,
            userRemainingCredits: extractedCredits,
            credits: extractedCredits,
          }
        : {};
    };

    // Helper to check if extracted URL is an image
    const checkIsImage = (url: string) => {
      if (!url) return false;
      const clean = url.toLowerCase();
      return (
        clean.match(/\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i) !== null ||
        clean.includes('grok') ||
        clean.includes('gpt') ||
        clean.includes('banana') ||
        clean.includes('image')
      );
    };

    const inputReferenceUrlsSet = new Set<string>();
    const bodyInput = req.body.imageUrl || req.body.image_url || req.body.image || req.body.videoUrl || req.body.video_url || req.body.inputUrl;
    if (typeof bodyInput === 'string' && bodyInput.startsWith('http')) {
      inputReferenceUrlsSet.add(bodyInput.trim());
    }

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

    // Strategy 1: Check Batch Status directly via official Weavy Batch API:
    // GET https://api.weavy.ai/api/v1/batches/recipes/{recipeId}/batches/{batchId}/status
    if (activeBatchId && typeof activeBatchId === 'string' && activeBatchId.trim().length > 0) {
      const batchStatusEndpoints = [
        `https://api.weavy.ai/api/v1/batches/recipes/${recipeId}/batches/${activeBatchId}/status`,
        `https://api.weavy.ai/api/v1/batches/recipes/${recipeId}/batches/${activeBatchId}`,
        `https://api.weavy.ai/api/v1/batches/recipes/${recipeId}/runs/${activeBatchId}`,
        `https://api.weavy.ai/api/v1/recipes/${recipeId}/runs/${activeBatchId}`,
      ];

      for (const statusUrl of batchStatusEndpoints) {
        try {
          const statusRes = await axios.get(statusUrl, {
            headers: {
              ...headers,
              'x-app-recipeid': recipeId,
            },
            timeout: 12000,
          });

          const resData = statusRes.data || {};

          // Extract credits from status endpoint
          const creditVal = resData.userRemainingCredits !== undefined
            ? resData.userRemainingCredits
            : (resData.remainingCredits !== undefined ? resData.remainingCredits : resData.credits);
          if (creditVal !== undefined && creditVal !== null) {
            const num = Number(creditVal);
            if (!isNaN(num)) {
              extractedCredits = num;
            }
          }

          const recipeRuns = Array.isArray(resData.recipeRuns) ? resData.recipeRuns : (resData.recipeRun ? [resData.recipeRun] : []);

          let latestProgress = 0;

          // First pass: collect all input URLs from nodeRuns input
          for (const run of recipeRuns) {
            const nodeRuns = Array.isArray(run.nodeRuns) ? run.nodeRuns : [];
            for (const nr of nodeRuns) {
              if (nr.input) {
                if (typeof nr.input === 'string' && nr.input.startsWith('http')) {
                  inputReferenceUrlsSet.add(nr.input.trim());
                } else if (typeof nr.input === 'object') {
                  const inputStr = JSON.stringify(nr.input);
                  const matches = inputStr.match(/https?:\/\/[^\s"'\\]+/g);
                  if (matches) {
                    for (const m of matches) inputReferenceUrlsSet.add(m.trim());
                  }
                }
              }
            }
          }

          // Second pass: check outputs and progress
          for (const run of recipeRuns) {
            const runStatus = (run.status || '').toString().toUpperCase();

            // Check run failure
            if (runStatus === 'FAILED' || runStatus === 'ERROR' || run.error) {
              const errStr = typeof run.error === 'object' ? JSON.stringify(run.error) : String(run.error || 'Generasi di Weavy AI gagal.');
              console.log(`[Server ❌ Poll Failed via Batch Status] ${activeBatchId}:`, errStr);
              return res.json({ status: 'failed', error: errStr, ...(await getCreditFields()) });
            }

            const nodeRuns = Array.isArray(run.nodeRuns) ? run.nodeRuns : [];
            for (const nr of nodeRuns) {
              const nrStatus = (nr.status || '').toString().toUpperCase();

              // Track progress percentage
              if (typeof nr.progress === 'number' && nr.progress > latestProgress) {
                latestProgress = nr.progress;
              }

              if (nrStatus === 'FAILED' || nrStatus === 'ERROR' || nr.error) {
                const errStr = typeof nr.error === 'object' ? JSON.stringify(nr.error) : String(nr.error || 'Node generation failed.');
                console.log(`[Server ❌ Poll Failed via nodeRun] ${nr.nodeId}:`, errStr);
                return res.json({ status: 'failed', error: errStr, ...(await getCreditFields()) });
              }

              // Check if node result contains output media
              if (nr.result || nr.output) {
                const nrMedia = extractMediaUrlFromObject(nr.result || nr.output);
                if (nrMedia && nrMedia.url && !isInputReference(nrMedia.url)) {
                  const isImg = checkIsImage(nrMedia.url);
                  const mediaLabel = isImg ? 'Gambar' : 'Video';
                  console.log(`[Server ✅ Poll Finished via nodeRun Status!] ${mediaLabel} selesai dibuat: ${nrMedia.url}`);
                  return res.json({
                    status: 'completed',
                    resultUrl: nrMedia.url,
                    coverUrl: nrMedia.coverUrl || '',
                    progress: 100,
                    message: `Generasi ${mediaLabel.toLowerCase()} berhasil selesai.`,
                    ...(await getCreditFields()),
                  });
                }
              }
            }
          }

          // Check root resData output/result ONLY if explicitly defined
          let rootMedia = null;
          if (resData.result) rootMedia = extractMediaUrlFromObject(resData.result);
          else if (resData.output) rootMedia = extractMediaUrlFromObject(resData.output);
          else if (resData.outputs) rootMedia = extractMediaUrlFromObject(resData.outputs);

          if (rootMedia && rootMedia.url && !isInputReference(rootMedia.url)) {
            const isImg = checkIsImage(rootMedia.url);
            const mediaLabel = isImg ? 'Gambar' : 'Video';
            console.log(`[Server ✅ Poll Finished via Batch Status root!] ${mediaLabel} selesai dibuat: ${rootMedia.url}`);
            return res.json({
              status: 'completed',
              resultUrl: rootMedia.url,
              coverUrl: rootMedia.coverUrl || '',
              progress: 100,
              message: `Generasi ${mediaLabel.toLowerCase()} berhasil selesai.`,
              ...(await getCreditFields()),
            });
          }

          if (resData.status && (resData.status.toUpperCase() === 'FAILED' || resData.status.toUpperCase() === 'ERROR')) {
            return res.json({ status: 'failed', error: String(resData.error || 'Batch status failed.'), ...(await getCreditFields()) });
          }

          if (latestProgress > 0) {
            return res.json({
              status: 'processing',
              progress: latestProgress,
              ...(await getCreditFields()),
            });
          }
        } catch (epErr) {
          // Continue to next fallback strategy
        }
      }
    }

    // Strategy 2: Fetch Recipe Canvas Details (`/api/v1/recipes/${recipeId}`)
    try {
      const detailRes = await axios.get(`https://api.weavy.ai/api/v1/recipes/${recipeId}`, {
        headers,
        timeout: 10000,
      });

      const recipeData = detailRes.data || {};

      const detailCreditVal = recipeData.userRemainingCredits !== undefined
        ? recipeData.userRemainingCredits
        : (recipeData.remainingCredits !== undefined ? recipeData.remainingCredits : recipeData.credits);
      if (detailCreditVal !== undefined && detailCreditVal !== null) {
        const num = Number(detailCreditVal);
        if (!isNaN(num)) extractedCredits = num;
      }

      const nodes = Array.isArray(recipeData.nodes) ? recipeData.nodes : [];

      for (const node of nodes) {
        if (!node.isModel && node.type !== 'custommodelV2' && node.type !== 'model') {
          if (node.data) {
            if (node.data.files) {
              for (const f of node.data.files) {
                if (f.url) inputReferenceUrlsSet.add(f.url.trim());
              }
            }
            if (node.data.value && typeof node.data.value === 'string' && node.data.value.startsWith('http')) {
              inputReferenceUrlsSet.add(node.data.value.trim());
            }
          }
        }
      }

      let targetNode = nodes.find((n: any) => n.id === nodeId);
      if (!targetNode && nodes.length > 0) {
        targetNode = nodes.slice().reverse().find((n: any) => n.isModel || n.type === 'custommodelV2' || n.type === 'model') || nodes[nodes.length - 1];
      }

      if (targetNode) {
        const nData = targetNode?.data || {};
        const prediction = nData?.latestPrediction || targetNode?.latestPrediction;

        const predStatus = (prediction?.status || '').toString().toLowerCase();
        const predError = prediction?.error || prediction?.errorMessage;
        const nodeStatus = (nData?.status || targetNode?.status || '').toString().toLowerCase();
        const nodeError = nData?.error || nData?.errorMessage || targetNode?.error;

        if (predStatus === 'failed' || predStatus === 'error' || predError || nodeStatus === 'failed' || nodeStatus === 'error' || nodeError) {
          let rawErr = predError || nodeError || nData?.message || 'Generasi video/gambar gagal di server Weavy AI.';
          if (typeof rawErr === 'object') rawErr = JSON.stringify(rawErr);
          else rawErr = String(rawErr);

          if (rawErr.includes('copyright restrictions')) {
            rawErr = 'Generasi audio terhalang hak cipta (copyright restrictions). Silakan coba lagi tanpa audio atau ubah prompt.';
          } else if (rawErr.includes('Prediction failed: Async prediction failed: Exception: ')) {
            rawErr = rawErr.replace('Prediction failed: Async prediction failed: Exception: ', '');
          } else if (rawErr.includes('Prediction failed: ')) {
            rawErr = rawErr.replace('Prediction failed: ', '');
          }

          console.log(`[Server ❌ Poll Failed] Task ${activeBatchId || nodeId} failed:`, rawErr);
          return res.json({ status: 'failed', error: rawErr, ...(await getCreditFields()) });
        }

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
            const isImg = checkIsImage(extracted.url);
            const mediaLabel = isImg ? 'Gambar' : 'Video';
            console.log(`[Server ✅ Poll Finished via Recipe Detail!] ${mediaLabel} selesai dibuat: ${extracted.url}`);
            return res.json({
              status: 'completed',
              resultUrl: extracted.url,
              coverUrl: extracted.coverUrl || '',
              progress: 100,
              message: `Generasi ${mediaLabel.toLowerCase()} berhasil selesai.`,
              ...(await getCreditFields()),
            });
          }
        }
      }
    } catch (e) {}

    // Strategy 3: Check Node History endpoint
    try {
      const historyRes = await axios.get(`https://api.weavy.ai/api/v1/recipes/${recipeId}/node-history/node-ids`, {
        headers,
        timeout: 10000,
      });

      const histData = historyRes.data || {};
      const histCreditVal = histData.userRemainingCredits !== undefined
        ? histData.userRemainingCredits
        : (histData.remainingCredits !== undefined ? histData.remainingCredits : histData.credits);
      if (histCreditVal !== undefined && histCreditVal !== null) {
        const num = Number(histCreditVal);
        if (!isNaN(num)) extractedCredits = num;
      }

      const histExtracted = extractMediaUrlFromObject(histData);
      if (histExtracted && histExtracted.url && !isInputReference(histExtracted.url)) {
        const isImg = checkIsImage(histExtracted.url);
        const mediaLabel = isImg ? 'Gambar' : 'Video';
        console.log(`[Server ✅ Poll Finished via Node History!] ${mediaLabel} selesai dibuat: ${histExtracted.url}`);
        return res.json({
          status: 'completed',
          resultUrl: histExtracted.url,
          coverUrl: histExtracted.coverUrl || '',
          progress: 100,
          message: `Generasi ${mediaLabel.toLowerCase()} berhasil selesai.`,
          ...(await getCreditFields()),
        });
      }
    } catch (e) {}

    console.log(`[Server 🔄 Polling Status] Masih memproses generasi di Weavy AI... (Credits: ${extractedCredits ?? 'unknown'})`);
    return res.json({
      status: 'processing',
      progress: 50,
      ...(await getCreditFields()),
    });
  } catch (error: any) {
    const rawData = error?.response?.data;
    const isCf403 = error?.response?.status === 403 || String(error?.message || '').includes('403');
    const isCfHtml = typeof rawData === 'string' && (rawData.includes('<html') || rawData.includes('cloudflare') || rawData.includes('cf-error'));

    // 403 Cloudflare WAF = request ditolak, bukan "masih diproses".
    // Me-return 'processing' membuat UI hang selamanya, jadi error dikembalikan
    // agar frontend bisa otomatis pindah ke jalur Extension Bridge.
    if (isCf403 || isCfHtml) {
      console.error('[Server 🚫 Poll Status Blocked by Cloudflare WAF (403)]');
      return res.status(502).json({
        success: false,
        status: 'failed',
        error: 'Permintaan ditolak Cloudflare WAF (403). Jalankan lewat Chrome Extension.',
        cloudflareBlocked: true,
      });
    }

    const safeMsg = rawData?.message || error?.message || 'Poll error';
    console.error('[Server ⚠️ Poll Status Notice]:', safeMsg);
    return res.status(500).json({
      success: false,
      status: 'failed',
      error: safeMsg,
    });
  }
});

// Fetch Weavy History
router.post('/fetch-weavy-history', async (req, res) => {
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
        // ignore single recipe failure
      }
    }

    items.sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));
    return res.json({ success: true, count: items.length, items });
  } catch (err: any) {
    console.error('[Weavy History Error]:', err?.message);
    return res.status(500).json({ success: false, error: err?.message || 'Gagal mengambil histori dari Weavy.' });
  }
});

// Delete Weavy Recipe Endpoint
router.post('/delete-weavy-recipe', async (req, res) => {
  const recipeId = req.body?.recipeId;
  try {
    const { refreshToken, idToken: providedIdToken } = req.body;
    if (!recipeId) {
      return res.status(400).json({ success: false, error: 'recipeId wajib diisi' });
    }

    let idToken = providedIdToken;
    if (!idToken && refreshToken) {
      try {
        idToken = await getFreshIdToken(refreshToken);
      } catch (authErr) {}
    }

    if (idToken) {
      await axios.delete(`https://api.weavy.ai/api/v1/recipes/${recipeId}`, {
        headers: getWeavyHeaders(idToken),
      }).catch((e) => {
        console.warn(`[Weavy Delete Recipe ${recipeId} Warning]:`, e?.response?.data || e?.message);
      });
    }

    return res.json({ success: true, recipeId });
  } catch (err: any) {
    return res.json({ success: true, recipeId, warning: err?.message });
  }
});

// CANVAS: Import Weavy Recipe by URL or ID
router.post(['/canvas/weavy/import', '/weavy/canvas/import'], async (req, res) => {
  try {
    const { url, recipeId: inputRecipeId, refreshToken, idToken: providedIdToken } = req.body || {};

    let recipeId = (inputRecipeId || '').trim();
    if (!recipeId && url) {
      const match = String(url).match(/flow\/([a-zA-Z0-9_-]+)/) || String(url).match(/recipes\/([a-zA-Z0-9_-]+)/);
      if (match) {
        recipeId = match[1];
      } else {
        const parts = String(url).split('/');
        recipeId = parts[parts.length - 1].split('?')[0];
      }
    }

    if (!recipeId) {
      return res.status(400).json({ success: false, error: 'URL Weavy Flow atau Recipe ID wajib diisi.' });
    }

    let idToken = providedIdToken;
    if (refreshToken) {
      try {
        idToken = await getFreshIdToken(refreshToken);
      } catch (authErr) {
        console.warn('[Weavy Canvas Import Auth Warning]:', authErr);
      }
    }

    if (!idToken) {
      return res.status(400).json({ success: false, error: 'Token akun Weavy wajib disediakan untuk mengimpor recipe.' });
    }

    const headers = getWeavyHeaders(idToken);
    const recipeUrl = `https://api.weavy.ai/api/v1/recipes/${recipeId}`;

    console.log(`[Weavy Canvas Import] Fetching recipe: ${recipeId}...`);
    const resp = await axios.get(recipeUrl, { headers, timeout: 15000 });

    return res.json({
      success: true,
      recipeId,
      recipe: resp.data,
    });
  } catch (err: any) {
    console.error('[Weavy Canvas Import Error]:', err?.response?.data || err?.message);
    const msg = err?.response?.data?.message || err?.message || 'Gagal mengambil recipe dari Weavy.';
    return res.status(err?.response?.status || 500).json({
      success: false,
      error: `Gagal import Recipe Weavy: ${msg}`,
    });
  }
});

// CANVAS: Fetch My Recipes from Weavy
router.post(['/canvas/weavy/my-recipes', '/weavy/canvas/my-recipes'], async (req, res) => {
  try {
    const { refreshToken, idToken: providedIdToken } = req.body || {};

    let idToken = providedIdToken;
    if (refreshToken) {
      try {
        idToken = await getFreshIdToken(refreshToken);
      } catch (authErr) {}
    }

    if (!idToken) {
      return res.status(400).json({ success: false, error: 'Token akun Weavy wajib disediakan.' });
    }

    const headers = getWeavyHeaders(idToken);
    const resp = await axios.get('https://api.weavy.ai/api/v1/recipes?limit=50', {
      headers,
      timeout: 12000,
    });

    const recipes = Array.isArray(resp.data) ? resp.data : (resp.data?.recipes || []);
    return res.json({
      success: true,
      count: recipes.length,
      recipes,
    });
  } catch (err: any) {
    console.error('[Weavy Canvas My Recipes Error]:', err?.message);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Gagal mengambil daftar recipe Weavy.',
    });
  }
});

// CANVAS: Save Recipe to Weavy
router.post(['/canvas/weavy/save-recipe', '/weavy/canvas/save-recipe'], async (req, res) => {
  try {
    const { recipeId: inputRecipeId, name, nodes, edges, refreshToken, idToken: providedIdToken } = req.body || {};

    let idToken = providedIdToken;
    if (refreshToken) {
      try {
        idToken = await getFreshIdToken(refreshToken);
      } catch (authErr) {}
    }

    if (!idToken) {
      return res.status(400).json({ success: false, error: 'Token akun Weavy wajib disediakan.' });
    }

    const headers = getWeavyHeaders(idToken);
    let recipeId = inputRecipeId;

    if (!recipeId) {
      // Create new recipe first
      const createResp = await axios.post(
        'https://api.weavy.ai/api/v1/recipes/create',
        {
          name: name || `AMB Canvas Recipe - ${Date.now()}`,
          description: 'Created with AMB Media Canvas Studio',
        },
        { headers, timeout: 15000 }
      );
      recipeId = createResp.data?.id || createResp.data?._id;
    }

    if (recipeId) {
      await axios.post(
        `https://api.weavy.ai/api/v1/recipes/${recipeId}/save`,
        {
          nodes: nodes || [],
          edges: edges || [],
          v3: true,
          lastUpdatedAt: new Date().toISOString(),
        },
        {
          headers: {
            ...headers,
            'x-app-recipeid': recipeId,
          },
          timeout: 15000,
        }
      );
    }

    return res.json({
      success: true,
      recipeId,
      message: 'Recipe berhasil disimpan ke Weavy Cloud!',
    });
  } catch (err: any) {
    console.error('[Weavy Canvas Save Error]:', err?.response?.data || err?.message);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Gagal menyimpan recipe ke Weavy.',
    });
  }
});

export default router;
