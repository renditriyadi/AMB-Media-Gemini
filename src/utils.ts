export function formatTo24h(timeStr?: string): string {
  if (!timeStr) return '';
  const match = timeStr.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
  if (!match) return timeStr;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = match[3];
  if (ampm) {
    const isPM = ampm.toUpperCase() === 'PM';
    if (isPM && hours < 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
  }
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

/**
 * Safely fetches JSON with automatic retry on HTML / network / 5xx errors.
 * Prevents "Unexpected token '<'..." errors when server returns HTML or gateway timeouts.
 */
export async function safeFetchJson(
  url: string,
  options?: RequestInit,
  retries = 2,
  delayMs = 1000
): Promise<{ ok: boolean; status: number; data: any }> {
  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((res) => setTimeout(res, delayMs * attempt));
      }

      const resp = await fetch(url, options);
      const text = await resp.text();

      // Catch HTML error responses from server, cold-start, or reverse proxy
      if (!text || text.trim().startsWith('<')) {
        throw new Error(`Server merespons format HTML (HTTP ${resp.status})`);
      }

      let parsedData: any = {};
      try {
        parsedData = JSON.parse(text);
      } catch (jsonErr) {
        throw new Error('Respons server bukan format JSON yang valid.');
      }

      return {
        ok: resp.ok,
        status: resp.status,
        data: parsedData,
      };
    } catch (err: any) {
      lastError = err;
      console.warn(`[safeFetchJson] Percobaan ${attempt + 1}/${retries + 1} gagal untuk ${url}:`, err?.message);
    }
  }

  return {
    ok: false,
    status: 500,
    data: {
      success: false,
      error: 'Respon server bukan JSON valid (HTML/Timeout). Silakan coba lagi.',
    },
  };
}

/**
 * Universal media downloader for images and videos.
 * Bypasses browser cross-origin CORS limitations by leveraging the server proxy download endpoint.
 * Ensures the file is genuinely downloaded to the user's device with the correct filename and extension.
 */
export async function downloadMediaFile(
  mediaUrl: string,
  title?: string,
  mode: 'image' | 'video' | string = 'image',
  model?: string
): Promise<boolean> {
  if (!mediaUrl || typeof mediaUrl !== 'string') {
    console.warn('[downloadMediaFile] Media URL is empty or invalid.');
    return false;
  }

  const isVideo =
    mode === 'video' ||
    mediaUrl.toLowerCase().includes('.mp4') ||
    mediaUrl.toLowerCase().includes('.mov') ||
    mediaUrl.toLowerCase().includes('.webm') ||
    (Boolean(title) && Boolean(title?.toLowerCase().match(/\.(mp4|mov|webm)$/i)));
  
  // Clean title & determine extension
  let ext = isVideo ? 'mp4' : 'png';
  const urlLower = mediaUrl.toLowerCase();
  if (!isVideo) {
    if (urlLower.includes('.webp')) ext = 'webp';
    else if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) ext = 'jpg';
    else if (urlLower.includes('.gif')) ext = 'gif';
  }

  const modelStr = (model || '').toLowerCase();
  const titleStr = (title || '').trim();
  const isS2 = model === 'S2 Motion Control' || modelStr.includes('s2') || titleStr.toLowerCase().includes('s2');
  const isRunningHubOrAmb = modelStr.includes('ambmedia') || modelStr.includes('runninghub') || model === 'Motion Control' || isS2;

  let cleanBase = '';

  if (isS2) {
    if (!titleStr || titleStr.toLowerCase().includes('kling') || titleStr === 'Untitled Generation' || titleStr === 'Motion Control' || titleStr === 'S2 Motion Control' || titleStr === 'Ambmedia S2 Motion Control') {
      cleanBase = 'Ambmedia_S2_Motion_Control';
    } else {
      let customTitle = titleStr
        .replace(/kling/gi, 'Ambmedia')
        .replace(/\.(mp4|mov|webm|png|jpg|jpeg|webp|gif)$/i, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 32)
        .replace(/^_|_$/g, '');
      if (!customTitle.toLowerCase().startsWith('ambmedia')) {
        customTitle = `Ambmedia_S2_${customTitle}`;
      }
      cleanBase = customTitle;
    }
  } else if (isRunningHubOrAmb && !modelStr.includes('roboneo') && !modelStr.includes('galleri5') && !modelStr.includes('kling 3.0')) {
    if (!titleStr || titleStr.toLowerCase().includes('kling') || titleStr === 'Untitled Generation' || titleStr === 'Motion Control' || titleStr === 'Ambmedia Motion Control') {
      cleanBase = 'Ambmedia_Motion_Control';
    } else {
      let customTitle = titleStr
        .replace(/kling/gi, 'Ambmedia')
        .replace(/\.(mp4|mov|webm|png|jpg|jpeg|webp|gif)$/i, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 32)
        .replace(/^_|_$/g, '');
      if (!customTitle.toLowerCase().startsWith('ambmedia')) {
        customTitle = `Ambmedia_${customTitle}`;
      }
      cleanBase = customTitle;
    }
  } else {
    cleanBase = (title || model || (isVideo ? 'Ambmedia_video' : 'Ambmedia_image'))
      .replace(/\.(mp4|mov|webm|png|jpg|jpeg|webp|gif)$/i, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 40)
      .replace(/^_|_$/g, '');
  }

  if (!cleanBase) {
    cleanBase = isVideo ? 'Ambmedia_video' : 'Ambmedia_image';
  }

  // 6-digit random number suffix
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const filename = `${cleanBase}_${randomSuffix}.${ext}`;

  // Strategy 1: Base64 Data URLs (immediate blob download)
  if (mediaUrl.startsWith('data:')) {
    try {
      const parts = mediaUrl.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : (isVideo ? 'video/mp4' : 'image/png');
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      return true;
    } catch (dataErr) {
      console.warn('[downloadMediaFile] Base64 decoding failed:', dataErr);
    }
  }

  // Strategy 2: Direct same-origin or cached file download (e.g. /media-cache/...)
  const isLocalOrigin =
    mediaUrl.startsWith('/') ||
    (typeof window !== 'undefined' && mediaUrl.startsWith(window.location.origin));

  if (isLocalOrigin) {
    try {
      const localResp = await fetch(mediaUrl);
      if (localResp.ok) {
        const localBlob = await localResp.blob();
        if (localBlob.size > 0) {
          const blobUrl = URL.createObjectURL(localBlob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = filename;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
          return true;
        }
      }
    } catch (localErr) {
      console.warn('[downloadMediaFile] Direct local origin fetch failed, trying proxy:', localErr);
    }
  }

  // Strategy 3: Proxy Download via server (Guaranteed CORS bypass & Content-Disposition attachment)
  let activeToken = '';
  if (mediaUrl.includes('googleusercontent.com') || mediaUrl.includes('contribution.usercontent') || mediaUrl.includes('gemini.google.com')) {
    try {
      const gAccounts = JSON.parse(localStorage.getItem('gemini_accounts') || '[]');
      const active = gAccounts.find((a: any) => a.isActive) || gAccounts[0];
      if (active?.refreshToken) activeToken = active.refreshToken;
    } catch (e) {}
  }

  let proxyUrl = `/api/proxy-download?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(filename)}`;
  if (activeToken) {
    proxyUrl += `&token=${encodeURIComponent(activeToken)}`;
  }

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`Proxy response error: HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json') || contentType.includes('text/html') || contentType.includes('text/plain')) {
      throw new Error(`Proxy returned non-media content-type: ${contentType}`);
    }

    const blob = await response.blob();
    if (!blob || blob.size === 0) {
      throw new Error('Downloaded blob is empty');
    }

    // Inspect first bytes to guarantee no HTML error / cookie-check page is saved as media
    if (blob.size < 50000) {
      const textHead = await blob.slice(0, 512).text().catch(() => '');
      const lowerHead = textHead.toLowerCase();
      if (
        lowerHead.includes('<!doctype') ||
        lowerHead.includes('<html') ||
        lowerHead.includes('<body') ||
        lowerHead.includes('cookie check') ||
        lowerHead.includes('service login') ||
        lowerHead.includes('accounts.google.com')
      ) {
        throw new Error('Response berisi halaman HTML login/cookie check dari Google, bukan file media.');
      }
    }

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    return true;
  } catch (proxyErr) {
    console.warn('[downloadMediaFile] Proxy blob fetch failed, falling back to direct CORS fetch:', proxyErr);

    // Fallback A: Direct CORS fetch from mediaUrl
    try {
      const directResp = await fetch(mediaUrl, { mode: 'cors' });
      if (directResp.ok) {
        const directBlob = await directResp.blob();
        if (directBlob.size > 0) {
          const directBlobUrl = URL.createObjectURL(directBlob);
          const a = document.createElement('a');
          a.href = directBlobUrl;
          a.download = filename;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(directBlobUrl), 5000);
          return true;
        }
      }
    } catch (directErr) {
      console.warn('[downloadMediaFile] Direct fetch failed:', directErr);
    }

    // Fallback B: If valid external non-google URL, open in separate tab
    const isGoogle = mediaUrl.includes('googleusercontent.com') || mediaUrl.includes('contribution.usercontent');
    if (!isGoogle && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://'))) {
      window.open(mediaUrl, '_blank');
    }
    return false;
  }
}

export interface UploadMediaProgressOptions {
  url: string;
  file?: File | Blob | null;
  base64Data?: string | null;
  fileName?: string;
  mimeType?: string;
  fields?: Record<string, any>;
  headers?: Record<string, string>;
  onProgress?: (percent: number) => void;
  timeoutMs?: number;
}

export interface UploadMediaResult {
  success: boolean;
  url?: string;
  fileName?: string;
  error?: string;
  data?: any;
}

/**
 * Universal high-performance file uploader with smooth progress events (0-100%),
 * automatic Base64 JSON fallback if gateway/multipart fails, and robust error recovery.
 */
export async function uploadMediaWithProgress(options: UploadMediaProgressOptions): Promise<UploadMediaResult> {
  const {
    url,
    file,
    base64Data: initialBase64,
    fileName = 'upload_file',
    mimeType = 'application/octet-stream',
    fields = {},
    headers = {},
    onProgress,
    timeoutMs = 300000, // 5 minutes
  } = options;

  // Helper function to perform XHR upload
  const performUpload = (isBase64: boolean, dataToSend: FormData | string, customContentType?: string): Promise<UploadMediaResult> => {
    return new Promise((resolve) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.timeout = timeoutMs;
        // Do NOT set withCredentials=true to avoid Cloud Run iframe auth cookie gateway intercept

        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

        if (customContentType) {
          xhr.setRequestHeader('Content-Type', customContentType);
        }

        Object.entries(headers).forEach(([k, v]) => {
          if (v) xhr.setRequestHeader(k, v);
        });

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && event.total > 0) {
              const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
              onProgress(percent);
            }
          };
        }

        xhr.onload = () => {
          const text = xhr.responseText || '';
          if (text.trim().startsWith('<')) {
            return resolve({
              success: false,
              error: 'GATEWAY_HTML_RETURNED',
            });
          }

          try {
            const res = JSON.parse(text);
            if (xhr.status >= 200 && xhr.status < 300) {
              const resolvedUrl = res.url || res.fileName || res.data?.url || res.data?.fileName || res.filePath || '';
              if (res.success !== false && resolvedUrl) {
                if (onProgress) onProgress(100);
                return resolve({
                  success: true,
                  url: resolvedUrl,
                  fileName: resolvedUrl,
                  data: res,
                });
              }
            }
            return resolve({
              success: false,
              error: res.error || res.msg || res.message || `Gagal mengunggah file (HTTP ${xhr.status}).`,
              data: res,
            });
          } catch (e) {
            return resolve({
              success: false,
              error: `Respon server tidak valid (HTTP ${xhr.status}).`,
            });
          }
        };

        xhr.onerror = () => {
          resolve({
            success: false,
            error: 'Koneksi jaringan terputus saat mengunggah. Silakan klik Ulangi.',
          });
        };

        xhr.ontimeout = () => {
          resolve({
            success: false,
            error: 'Waktu upload melebihi batas (Timeout). Koneksi jaringan lambat.',
          });
        };

        xhr.send(dataToSend);
      } catch (err: any) {
        resolve({
          success: false,
          error: err.message || 'Gagal memulai proses unggah.',
        });
      }
    });
  };

  // 1. Try Primary Upload
  let firstResult: UploadMediaResult;

  if (file) {
    // Put text fields FIRST so multer fills req.body before reading stream
    const formData = new FormData();
    Object.entries(fields).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        formData.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      }
    });
    formData.append('file', file, fileName);
    firstResult = await performUpload(false, formData);
  } else if (initialBase64) {
    const payload = {
      fileData: initialBase64,
      fileName,
      mimeType,
      ...fields,
    };
    firstResult = await performUpload(true, JSON.stringify(payload), 'application/json');
  } else {
    return {
      success: false,
      error: 'Tidak ada file atau data untuk diunggah.',
    };
  }

  // 2. If Gateway HTML returned (Cloud Run / AI Studio session intercept) or multipart failed and we have file object, fallback to Base64 JSON
  if (!firstResult.success && firstResult.error === 'GATEWAY_HTML_RETURNED' && file) {
    try {
      console.warn('[Upload] Multipart gateway intercepted by proxy, auto-retrying via Base64 JSON payload...');
      const base64Str = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      const jsonPayload = {
        fileData: base64Str,
        fileName,
        mimeType,
        ...fields,
      };

      const fallbackResult = await performUpload(true, JSON.stringify(jsonPayload), 'application/json');
      if (fallbackResult.success) {
        return fallbackResult;
      }
    } catch (e: any) {
      console.warn('[Upload] Base64 fallback error:', e.message);
    }
  }

  if (firstResult.error === 'GATEWAY_HTML_RETURNED') {
    return {
      success: false,
      error: 'Server gateway mengembalikan halaman proxy. Silakan klik Ulangi.',
    };
  }

  return firstResult;
}



