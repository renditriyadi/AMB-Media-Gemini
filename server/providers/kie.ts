import { Router } from 'express';
import axios from 'axios';
import crypto from 'crypto';

const router = Router();

// Deeply extract credit & total credit from any Kie.ai response structure
function extractKieCredit(resData: any): { credit: number | null; totalCredit: number | null } {
  if (resData === undefined || resData === null) return { credit: null, totalCredit: null };

  if (typeof resData === 'number') {
    return { credit: resData, totalCredit: resData };
  }

  if (typeof resData === 'string') {
    const num = parseFloat(resData.replace(/[^0-9.]/g, ''));
    if (!isNaN(num)) return { credit: num, totalCredit: num };
  }

  if (typeof resData === 'object') {
    const candidates = [
      resData.data,
      resData.result,
      resData.user,
      resData.userInfo,
      resData.user_info,
      resData
    ];

    let foundCredit: number | null = null;
    let foundTotal: number | null = null;

    const creditKeys = [
      'credit', 'credits', 'userCredit', 'user_credit', 'user_credits',
      'remaining_credit', 'remaining_credits', 'remainingCredit', 'remainingCredits',
      'available_credit', 'available_credits', 'availableCredit', 'availableCredits',
      'usable_credit', 'usable_credits', 'usableCredit', 'usableCredits',
      'balance', 'points', 'quota', 'left_credit', 'left_credits'
    ];

    const totalKeys = [
      'totalCredit', 'total_credit', 'totalCredits', 'total_credits',
      'total_quota', 'totalQuota', 'max_credit', 'maxCredit'
    ];

    for (const cand of candidates) {
      if (!cand) continue;
      if (typeof cand === 'number') {
        if (foundCredit === null) foundCredit = cand;
        continue;
      }
      if (typeof cand === 'object') {
        for (const k of creditKeys) {
          if (typeof cand[k] === 'number') {
            foundCredit = cand[k];
            break;
          } else if (typeof cand[k] === 'string') {
            const parsed = parseFloat(cand[k].replace(/[^0-9.]/g, ''));
            if (!isNaN(parsed)) {
              foundCredit = parsed;
              break;
            }
          }
        }
        for (const tk of totalKeys) {
          if (typeof cand[tk] === 'number') {
            foundTotal = cand[tk];
            break;
          } else if (typeof cand[tk] === 'string') {
            const parsed = parseFloat(cand[tk].replace(/[^0-9.]/g, ''));
            if (!isNaN(parsed)) {
              foundTotal = parsed;
              break;
            }
          }
        }
      }
      if (foundCredit !== null) break;
    }

    return { credit: foundCredit, totalCredit: foundTotal };
  }

  return { credit: null, totalCredit: null };
}

// Helper to format a Kie.ai playground record
function formatKieRecord(rec: any) {
  let rJson: any = rec.resultJson;
  if (typeof rJson === 'string') {
    try {
      rJson = JSON.parse(rJson);
    } catch (_) {}
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
    try {
      paramObj = JSON.parse(paramObj);
    } catch (_) {}
  }

  let inputObj: any = paramObj?.input;
  if (typeof inputObj === 'string') {
    try {
      inputObj = JSON.parse(inputObj);
    } catch (_) {}
  }

  const prompt = inputObj?.prompt || paramObj?.prompt || '';
  const aspectRatio = inputObj?.aspect_ratio || inputObj?.aspectRatio || '9:16';
  const resolution = inputObj?.resolution || '720p';
  const duration = inputObj?.duration ? `${inputObj.duration}s` : (rec?.duration ? `${rec.duration}` : '5s');
  const inputImageUrl =
    inputObj?.image_url ||
    inputObj?.input_image ||
    (Array.isArray(inputObj?.reference_image_urls) ? inputObj.reference_image_urls[0] : '') ||
    (Array.isArray(inputObj?.input_urls) ? inputObj.input_urls[0] : '') ||
    (Array.isArray(inputObj?.image_urls) ? inputObj.image_urls[0] : '');

  const inputVideoUrl =
    inputObj?.video_url ||
    inputObj?.input_video ||
    (Array.isArray(inputObj?.reference_video_urls) ? inputObj.reference_video_urls[0] : '') ||
    (Array.isArray(inputObj?.video_urls) ? inputObj.video_urls[0] : '');

  const referenceImageUrls = Array.isArray(inputObj?.reference_image_urls) ? inputObj.reference_image_urls : [];
  const referenceVideoUrls = Array.isArray(inputObj?.reference_video_urls) ? inputObj.reference_video_urls : [];

  const rawModel = rec.model || paramObj?.model || rec.groupPath || '';
  const isVideo =
    rawModel.toLowerCase().includes('video') ||
    rawModel.toLowerCase().includes('grok') ||
    rawModel.toLowerCase().includes('seedance') ||
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
  } else if (rawModel.includes('seedance')) {
    friendlyModelName = 'SeeDance 2.0 Mini';
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

  const creditsConsumed =
    typeof rec.creditsConsumed === 'number'
      ? rec.creditsConsumed
      : typeof rec.consumeCredits === 'number'
      ? rec.consumeCredits
      : typeof rec.creditConsumed === 'number'
      ? rec.creditConsumed
      : 0;

  return {
    taskId: rec.taskId,
    model: friendlyModelName,
    rawModel: rawModel,
    groupPath: rec.groupPath,
    mode,
    state: rec.state,
    status,
    mediaUrl,
    thumbnailUrl: mediaUrl || inputImageUrl,
    prompt,
    aspectRatio,
    resolution,
    duration,
    inputImageUrl,
    inputVideoUrl,
    referenceImageUrls,
    referenceVideoUrls,
    createTime: rec.createTime,
    completeTime: rec.completeTime,
    creditsConsumed,
    consumeCredits: rec.consumeCredits || creditsConsumed,
    remainedCredits: rec.remainedCredits,
    costTime: rec.costTime,
    failCode: rec.failCode,
    failMsg: rec.failMsg,
    rawResultJson: rec.resultJson,
    rawParam: rec.param,
  };
}

// Kie.ai Account Verification Endpoint
router.post('/kie/accounts/verify', async (req, res) => {
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

    const authHeaders = [cleanToken, `Bearer ${cleanToken}`];

    // 1. Check User-Info endpoints
    const userInfoEndpoints = [
      `https://api.kie.ai/client/v1/user/user-info?time=${Date.now()}`,
      `https://api.kie.ai/api/v1/user/user-info?time=${Date.now()}`,
      `https://api.kie.ai/api/v1/user/info?time=${Date.now()}`,
    ];

    for (const endpoint of userInfoEndpoints) {
      for (const authHeader of authHeaders) {
        try {
          const resp = await axios.get(endpoint, {
            headers: { Authorization: authHeader },
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
            const { credit, totalCredit } = extractKieCredit(resp.data);
            if (credit !== null && parsedCredit === null) parsedCredit = credit;
            if (totalCredit !== null && parsedTotalCredit === null) parsedTotalCredit = totalCredit;
            break;
          }
        } catch {}
      }
      if (verified && parsedCredit !== null) break;
    }

    // 2. Check Credit specific endpoints
    const creditEndpoints = [
      'https://api.kie.ai/api/v1/chat/credit',
      'https://api.kie.ai/api/v1/user/credit',
      'https://api.kie.ai/v1/chat/credit',
    ];

    for (const endpoint of creditEndpoints) {
      for (const authHeader of authHeaders) {
        try {
          const resp = await axios.get(endpoint, {
            headers: { Authorization: authHeader },
            validateStatus: () => true,
            timeout: 5000,
          });
          if (
            resp.status === 200 &&
            resp.data &&
            (resp.data.code === 200 ||
              resp.data.code === 0 ||
              resp.data.success ||
              resp.data.credit !== undefined ||
              typeof resp.data.data === 'number' ||
              typeof resp.data.data === 'object')
          ) {
            verified = true;
            const { credit, totalCredit } = extractKieCredit(resp.data);
            if (credit !== null && parsedCredit === null) parsedCredit = credit;
            if (totalCredit !== null && parsedTotalCredit === null) parsedTotalCredit = totalCredit;
            break;
          }
        } catch {}
      }
      if (parsedCredit !== null) break;
    }

    // 3. Fallback verification via playground pageRecordList
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
                'accept-language': 'en-US,en;q=0.9',
                'authorization': authHeader,
                'content-type': 'application/json',
                'origin': 'https://kie.ai',
                'referer': 'https://kie.ai/',
                'uniqueid': uniqueId,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
              },
              validateStatus: () => true,
              timeout: 6000,
            }
          );
          if (pageRes.status === 200 && pageRes.data && (pageRes.data.code === 200 || pageRes.data.code === 0)) {
            verified = true;
            const { credit, totalCredit } = extractKieCredit(pageRes.data);
            if (credit !== null && parsedCredit === null) parsedCredit = credit;
            if (totalCredit !== null && parsedTotalCredit === null) parsedTotalCredit = totalCredit;
            break;
          }
        } catch {}
      }
    }

    if (!verified) {
      return res.status(401).json({ error: 'API Key / Token Kie.ai tidak valid atau Unauthorized.' });
    }

    const finalCredits = parsedCredit !== null ? parsedCredit : 0;
    const defaultKieTotalCredit = 80;
    const finalTotalCredits =
      parsedTotalCredit !== null && parsedTotalCredit > 0 && parsedTotalCredit !== parsedCredit
        ? parsedTotalCredit
        : Math.max(finalCredits, defaultKieTotalCredit);

    const maskedKey = cleanToken.length > 8 ? `${cleanToken.slice(0, 4)}...${cleanToken.slice(-4)}` : cleanToken;
    const finalDisplayName = nickname ? nickname : `Kie.ai (${maskedKey})`;

    return res.json({
      success: true,
      displayName: finalDisplayName,
      nickname: nickname || finalDisplayName,
      email: userEmail || `kie_${maskedKey.replace(/[^a-zA-Z0-9]/g, '')}@kie.ai`,
      credits: finalCredits,
      totalCredits: finalTotalCredits,
      creditsUsed: 0,
      userId: `kie_${maskedKey}`,
      photoUrl: 'https://kie.ai/logo.png',
      cleanToken: cleanToken,
    });
  } catch (err: any) {
    console.error('[Kie.ai Account Verify Error]:', err?.response?.data || err?.message);
    return res
      .status(500)
      .json({ error: err?.response?.data?.msg || err?.message || 'Gagal memverifikasi API Key Kie.ai.' });
  }
});

// Kie.ai History Fetching Endpoint
router.post('/kie/history', async (req, res) => {
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
    const formattedRecords = records.map(formatKieRecord);

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

export default router;

