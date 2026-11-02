import axios from 'axios';

export const FIREBASE_API_KEY = 'AIzaSyC-qLy3TFyXMogJPfMkZJ9H_q46hEu1sxI';

// Helper to get fresh ID Token from Refresh Token via Firebase Auth
export async function getFreshIdToken(refreshToken: string): Promise<string> {
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
  throw new Error(
    lastErr?.response?.data?.error?.message ||
      lastErr?.message ||
      'Gagal memperbarui ID Token dari Firebase Auth.'
  );
}

export function cleanErrorMessage(error: any): string {
  if (!error) return 'Gagal memproses permintaan di server.';

  // 1. Check if response data itself is an HTML string (502/504 Bad Gateway from Cloudflare/Proxy)
  const rawResponseData = error?.response?.data;
  if (typeof rawResponseData === 'string' && rawResponseData.trim().startsWith('<')) {
    return `Layanan AI/Server sedang sibuk atau timeout (HTTP ${error?.response?.status || '502'}). Silakan coba lagi.`;
  }

  let errDetail =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    'Gagal membuat task generasi.';

  if (typeof errDetail === 'object') {
    errDetail = JSON.stringify(errDetail);
  } else {
    errDetail = String(errDetail);
  }

  if (errDetail.trim().startsWith('<')) {
    return `Layanan AI mengembalikan respon server HTML (HTTP ${error?.response?.status || '500'}). Silakan coba lagi.`;
  }

  if (errDetail.includes('Unexpected token') || errDetail.includes('is not valid JSON')) {
    return 'Layanan server menerima respon non-JSON dari AI Provider. Silakan coba lagi.';
  }

  return errDetail;
}

// Weavy API headers
export function getWeavyHeaders(idToken: string) {
  return {
    Authorization: `Bearer ${idToken}`,
    Accept: 'application/json, text/plain, */*',
    'X-Weavy-Auth-Provider': 'firebase',
    'x-app-version': '4.1.1316',
    'Origin': 'https://app.weavy.ai',
    'Referer': 'https://app.weavy.ai/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Content-Type': 'application/json',
  };
}

// Helper to fetch user's remaining credits directly from Weavy API
export async function getWeavyUserCredits(idToken: string): Promise<number | null> {
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

// Helper to deeply extract media URL from any nested response object or node
export function extractMediaUrlFromObject(
  obj: any
): { url: string; coverUrl?: string } | null {
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
    // Ignore input/parameter/schema keys to avoid returning input image/video references
    const ignoredKeys = [
      'input',
      'inputs',
      'param',
      'params',
      'parameter',
      'parameters',
      'schema',
      'config',
      'arguments',
      'inputIndex',
      'recipeRuns',
      'nodeRuns',
      'nodes',
    ];

    const possibleKeys = [
      'url',
      'fileUrl',
      'mediaUrl',
      'viewUrl',
      'videoUrl',
      'video',
      'imageUrl',
      'image',
      'downloadUrl',
      'outputUrl',
      'resultUrl',
      'src',
    ];
    for (const key of possibleKeys) {
      if (
        typeof obj[key] === 'string' &&
        (obj[key].startsWith('http://') || obj[key].startsWith('https://'))
      ) {
        const cover =
          obj.viewUrl ||
          obj.thumbnailUrl ||
          obj.coverUrl ||
          obj.thumbnail ||
          '';
        return {
          url: obj[key].trim(),
          coverUrl: typeof cover === 'string' ? cover : '',
        };
      }
    }

    for (const [key, val] of Object.entries(obj)) {
      if (ignoredKeys.includes(key)) continue;
      const found = extractMediaUrlFromObject(val);
      if (found) return found;
    }
  }

  return null;
}
